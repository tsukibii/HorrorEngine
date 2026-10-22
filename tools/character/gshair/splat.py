"""Step 4: the splat. 3D Gaussian Splatting (Kerbl et al. 2023) of the hair alone, our own: ellipsoid Gaussians
(position, three scales, a rotation, opacity, colour) seeded in the hair's visual hull, optimised through the
pure-PyTorch splatter against the keyed frames: the 3DGS photometric loss (L1 and D-SSIM) on the hair's pixels, an
alpha loss (what's rendered must cover the hair mask and nothing else), and, from GaussianHair, an orientation loss
that turns the longer Gaussians along the hair's 2D direction (the Gabor maps) so hair reads as hair and not as
blobs. Adaptive density as 3DGS: clone and split the Gaussians that keep pulling, drop the faint and the huge. The
head isn't in the splat: the character's own head sits under it in the Studio.

Every tenth frame is held out; its PSNR is the measure. splat_sheet.jpg shows held-out frames beside the render."""
import json
import time
from pathlib import Path

import numpy as np
import torch

from .common import jsave, project_np
from .data import Views
from .raster import orient_feats, project_cov, psnr, quat_to_mat, splat, ssim


def hull_box(views):
    """the point the cameras look at (least squares on their rays) and their mean distance from it"""
    centres = np.array([(-f["R"].cpu().numpy().T @ f["t"].cpu().numpy()) for f in views.frames], float)
    fwd = np.array([f["R"].cpu().numpy()[2] for f in views.frames], float)
    A = np.zeros((3, 3)); b = np.zeros(3)
    for c, d in zip(centres, fwd):
        P = np.eye(3) - np.outer(d, d); A += P; b += P @ c
    look = np.linalg.solve(A + 1e-9 * np.eye(3), b)
    return look, float(np.linalg.norm(centres - look, axis=1).mean())


def hull(views, voxel=0.01, keep=0.85, max_voxels=None, pad=1.3):
    """voxel centres inside the hair mask of nearly every frame that sees them; the box from the cameras' look-at"""
    look, dist = hull_box(views)
    half = 0.45 * dist * pad
    xs = np.arange(-half, half + 1e-9, voxel)
    G = np.stack(np.meshgrid(xs, xs, xs, indexing="ij"), -1).reshape(-1, 3) + look
    seen = np.zeros(len(G), int); inside = np.zeros(len(G), int)
    import cv2
    for f in views.frames:
        R, t = f["R"].cpu().numpy().astype(float), f["t"].cpu().numpy().astype(float)
        p, z = project_np(G, R, t, f["K"])
        W, H = f["W"], f["H"]
        ok = (z > 0.05) & (p[:, 0] >= 0) & (p[:, 0] < W) & (p[:, 1] >= 0) & (p[:, 1] < H)
        m = cv2.dilate((f["hair"].cpu().numpy() > 0.3).astype(np.uint8), np.ones((7, 7), np.uint8))
        u, v = p[ok, 0].astype(int), p[ok, 1].astype(int)
        seen[ok] += 1; inside[np.flatnonzero(ok)] += m[v, u]
    good = (seen >= max(3, len(views.frames) // 4)) & (inside >= keep * seen)
    G = G[good]
    if max_voxels and len(G) > max_voxels: G = G[np.random.default_rng(0).choice(len(G), max_voxels, replace=False)]
    return G, look, dist


def seed_colours(views, G, n_frames=12):
    """each seed's colour: the mean of what the frames show where it lands on hair"""
    acc = np.zeros((len(G), 3)); cnt = np.zeros(len(G))
    for f in views.train[:: max(1, len(views.train) // n_frames)]:
        R, t = f["R"].cpu().numpy().astype(float), f["t"].cpu().numpy().astype(float)
        p, z = project_np(G, R, t, f["K"])
        ok = (z > 0.05) & (p[:, 0] >= 0) & (p[:, 0] < f["W"] - 1) & (p[:, 1] >= 0) & (p[:, 1] < f["H"] - 1)
        u, v = p[ok, 0].astype(int), p[ok, 1].astype(int)
        img = f["img"].cpu().numpy(); hm = f["hair"].cpu().numpy()
        w = hm[v, u]
        acc[ok] += img[v, u] * w[:, None]; cnt[ok] += w
    rgb = np.where(cnt[:, None] > 0, acc / np.maximum(cnt, 1e-6)[:, None], 0.3)
    return np.clip(rgb, 0, 1)


class Gaussians:
    def __init__(self, mu, rgb, scale0, device):
        n = len(mu)
        self.mu = torch.nn.Parameter(torch.as_tensor(mu, dtype=torch.float32, device=device))
        self.log_s = torch.nn.Parameter(torch.full((n, 3), float(np.log(scale0)), device=device))
        q = torch.zeros(n, 4, device=device); q[:, 0] = 1
        self.quat = torch.nn.Parameter(q)
        self.op = torch.nn.Parameter(torch.full((n,), -2.2, device=device))          # sigmoid: 0.1, as 3DGS
        self.rgb = torch.nn.Parameter(torch.as_tensor(rgb, dtype=torch.float32, device=device))
        self.reset_stats()

    @property
    def n(self): return len(self.mu)

    def reset_stats(self):
        self.grad_acc = torch.zeros(self.n, device=self.mu.device); self.grad_n = torch.zeros(self.n, device=self.mu.device)

    def groups(self, lr):
        return [dict(params=[self.mu], lr=lr["mu"], name="mu"), dict(params=[self.log_s], lr=lr["s"], name="s"),
                dict(params=[self.quat], lr=lr["q"], name="q"), dict(params=[self.op], lr=lr["op"], name="op"),
                dict(params=[self.rgb], lr=lr["rgb"], name="rgb")]

    def shape(self):
        """cov (N,3,3), the longest axis (N,3), its anisotropy (N) in [0,1]"""
        Rq = quat_to_mat(self.quat)
        s = torch.exp(self.log_s)
        M = Rq * s[:, None, :]
        cov = M @ M.transpose(1, 2)
        k = torch.argmax(s, 1)
        axis = Rq[torch.arange(self.n, device=s.device), :, k]
        ss = torch.sort(s, 1).values
        aniso = (1 - ss[:, 1] / (ss[:, 2] + 1e-9)).clamp(0, 1)
        return cov, axis, aniso

    @torch.no_grad()
    def densify(self, top=0.08, split_above=0.01, max_scale=0.06, prune_op=0.01, cap=400000):
        g = self.grad_acc / self.grad_n.clamp(min=1)
        s = torch.exp(self.log_s); smax = s.max(1).values
        op = torch.sigmoid(self.op)
        keep = (op > prune_op) & (smax < max_scale)
        n_new = min(int(top * self.n), max(0, cap - int(keep.sum())))
        pick = torch.zeros_like(keep)
        if n_new > 0: pick[torch.topk(g * keep, n_new).indices] = True
        split = pick & (smax > split_above); clone = pick & ~split
        Rq = quat_to_mat(self.quat)
        parts = {k: [getattr(self, k).data[keep & ~split]] for k in ("mu", "log_s", "quat", "op", "rgb")}
        # clones: beside the original along its longest axis
        if clone.any():
            k = torch.argmax(s[clone], 1); ax = Rq[clone][torch.arange(int(clone.sum()), device=s.device), :, k]
            parts["mu"].append(self.mu[clone] + ax * smax[clone][:, None] * (torch.rand(int(clone.sum()), 1, device=s.device) - 0.5))
            for key in ("log_s", "quat", "op", "rgb"): parts[key].append(getattr(self, key).data[clone])
        # splits: two smaller ones either side, the original gone
        if split.any():
            k = torch.argmax(s[split], 1); ax = Rq[split][torch.arange(int(split.sum()), device=s.device), :, k]
            for sign in (-0.5, 0.5):
                parts["mu"].append(self.mu[split] + ax * smax[split][:, None] * sign)
                parts["log_s"].append(self.log_s.data[split] - float(np.log(1.6)))
                for key in ("quat", "op", "rgb"): parts[key].append(getattr(self, key).data[split])
        for key, lst in parts.items(): setattr(self, key, torch.nn.Parameter(torch.cat(lst)))
        self.reset_stats()
        return int((~keep).sum()), int(clone.sum()), int(split.sum())


def render_view(G, cam, with_orient=True, bg=None):
    cov, axis, aniso = G.shape()
    uv, z, cov2, d2 = project_cov(G.mu, cov, cam["R"], cam["t"], cam["K"], axis if with_orient else None)
    feats = G.rgb.clamp(0, 1)
    if with_orient: feats = torch.cat([feats, orient_feats(d2) * aniso[:, None]], 1)
    img, acc, pairs = splat(uv, z, cov2, torch.sigmoid(G.op), feats, cam["W"], cam["H"], bg)
    return img, acc, pairs


def losses(img, acc, f, w_ori=0.1, w_alpha=0.5, w_ssim=0.2):
    region = f["region"]
    target = f["img"] * f["hair"][..., None]
    rgb = img[..., :3]
    l1 = ((rgb - target).abs().mean(-1) * region).sum() / (region.sum() + 1e-6)
    dss = 1 - ssim(rgb, target, region)
    la = ((acc - f["hair"]).abs() * region).sum() / (region.sum() + 1e-6)
    out = dict(l1=l1, dssim=dss, alpha=la)
    total = l1 + w_ssim * dss + w_alpha * la
    if img.shape[-1] >= 5 and w_ori > 0:
        o = img[..., 3:5] / (acc[..., None] + 1e-3)
        on = o / (torch.linalg.norm(o, dim=-1, keepdim=True) + 1e-3)
        w = f["conf"]
        out["ori"] = ((1 - (on * f["orient"]).sum(-1)) * 0.5 * w).sum() / (w.sum() + 1e-6)
        total = total + w_ori * out["ori"]
    out["total"] = total
    return out


def sheet(views, G, path, n=4):
    import cv2
    tiles = []
    for f in (views.heldout or views.frames)[:n]:
        with torch.no_grad(): img, acc, _ = render_view(G, views.cam(f))
        gt = (f["img"] * f["hair"][..., None]).cpu().numpy(); rg = img[..., :3].clamp(0, 1).cpu().numpy()
        o = (img[..., 3:5] / (acc[..., None] + 1e-3)).cpu().numpy()
        hue = (np.degrees(np.arctan2(o[..., 1], o[..., 0])) % 360) / 2
        hsv = np.stack([hue, np.clip(np.linalg.norm(o, axis=-1), 0, 1) * 255, acc.cpu().numpy().clip(0, 1) * 255], -1).astype(np.uint8)
        ori = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB).astype(np.float32) / 255
        row = (np.clip(np.hstack([gt, rg, ori]), 0, 1) * 255).astype(np.uint8)
        cv2.putText(row, f"{f['name']} psnr {psnr(img[..., :3], f['img'] * f['hair'][..., None], f['region']):.1f}", (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        tiles.append(row)
    cv2.imwrite(str(path), cv2.cvtColor(np.vstack(tiles), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 80])


def run(out, res=540, iters=4000, device=None, voxel=0.01, n_init=40000, seed=0, orient=0.1, densify_every=100, log_every=100,
        max_frames=None, cap=400000, refine_poses=None):
    """refine_poses None: the cameras move with the splat when nothing anchored them (a wig's capture, no face)"""
    out = Path(out)
    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    torch.manual_seed(seed); rng = np.random.default_rng(seed)
    views = Views(out, res, device, max_frames=max_frames)
    if refine_poses is None: refine_poses = not views.cap.cameras()["report"].get("anchored", False)
    t0 = time.time()
    anchored = views.cap.cameras()["report"].get("anchored", False)
    look0, dist0 = hull_box(views)
    if not anchored: voxel = voxel * dist0 / 0.9                      # a free world: its unit is the starting pair's baseline; the cameras stood about 0.9 m away
    voxel = max(voxel, 0.9 * dist0 * 1.3 / 160)                        # never more than 160 voxels a side
    H, look, dist = hull(views, voxel, max_voxels=n_init)
    if len(H) < 50: raise SystemExit(f"the hair's visual hull has only {len(H)} voxels: the masks or the poses are off (poses_sheet.jpg, masks/)")
    H = H + rng.uniform(-voxel / 2, voxel / 2, H.shape)
    G = Gaussians(H, seed_colours(views, H), voxel * 0.6, device)
    extent = float(dist)
    lr = dict(mu=1.6e-4 * extent, s=5e-3, q=1e-3, op=5e-2, rgb=2.5e-3)
    opt = torch.optim.Adam(G.groups(lr), eps=1e-15)
    deltas = {f["name"]: torch.nn.Parameter(torch.zeros(6, device=device)) for f in views.frames} if refine_poses else None
    opt_pose = torch.optim.Adam(list(deltas.values()), lr=1e-4) if deltas else None
    log, hist = [], []
    rep = dict(hull_voxels=int(len(H)), frames=len(views.frames), heldout=len(views.heldout), device=device, res=[views.W, views.H], look=look.round(4).tolist(), camera_distance=round(extent, 3), refine_poses=bool(refine_poses))
    for it in range(1, iters + 1):
        f = views.sample(rng)
        d = deltas[f["name"]] if (deltas and it > iters // 6) else None
        img, acc, pairs = render_view(G, views.cam(f, d), with_orient=orient > 0)
        L = losses(img, acc, f, w_ori=orient)
        opt.zero_grad(set_to_none=True)
        if opt_pose: opt_pose.zero_grad(set_to_none=True)
        L["total"].backward()
        if G.mu.grad is not None:
            gn = G.mu.grad.norm(dim=1); G.grad_acc += gn; G.grad_n += (gn > 0).float()
        opt.step()
        if d is not None: opt_pose.step()
        for g in opt.param_groups:
            if g["name"] == "mu": g["lr"] = lr["mu"] * (0.01 ** (it / iters))
        hist.append(float(L["total"]))
        if it % log_every == 0 or it == 1:
            line = dict(it=it, loss=round(float(np.mean(hist[-log_every:])), 4), l1=round(float(L["l1"]), 4), alpha=round(float(L["alpha"]), 4),
                        ori=round(float(L.get("ori", 0)), 4), n=G.n, pairs=pairs, s=round(time.time() - t0, 1))
            log.append(line); print(json.dumps(line), flush=True)
        if densify_every and iters // 8 <= it <= 0.7 * iters and it % densify_every == 0:
            pruned, cloned, split = G.densify(cap=cap, split_above=voxel)
            opt = torch.optim.Adam(G.groups(lr), eps=1e-15)
            if it % (densify_every * 5) == 0: print(json.dumps(dict(it=it, pruned=pruned, cloned=cloned, split=split, n=G.n)), flush=True)
    with torch.no_grad():
        pruned, _, _ = G.densify(top=0, cap=cap)                                   # a last prune
        ps = []
        for f in views.heldout or views.train[:3]:
            img, acc, _ = render_view(G, views.cam(f), with_orient=False)
            ps.append(psnr(img[..., :3], f["img"] * f["hair"][..., None], f["region"]))
        rep["psnr_heldout"] = round(float(np.mean(ps)), 2)
        cov, axis, aniso = G.shape()
    np.savez_compressed(out / "splat.npz", mu=G.mu.detach().cpu().numpy(), scales=torch.exp(G.log_s).detach().cpu().numpy(),
                        quat=torch.nn.functional.normalize(G.quat, dim=1).detach().cpu().numpy(), opacity=torch.sigmoid(G.op).detach().cpu().numpy(),
                        rgb=G.rgb.clamp(0, 1).detach().cpu().numpy(), look=look.astype(np.float32), camera_distance=np.float32(extent))
    if deltas:
        cams = views.cap.cameras()
        for c in cams["frames"]:
            with torch.no_grad(): cam = views.cam(next(f for f in views.frames if f["name"] == c["name"]), deltas[c["name"]])
            c["R"] = cam["R"].cpu().numpy(); c["t"] = cam["t"].cpu().numpy()
        views.cap.save_cameras(cams["frames"], dict(cams["report"], refined="splat"))
    rep.update(iters=iters, gaussians=int(G.n), seconds=round(time.time() - t0, 1), loss=log[-1]["loss"] if log else None,
               anisotropy_mean=round(float(aniso.mean()), 3), opacity_mean=round(float(torch.sigmoid(G.op).mean()), 3))
    jsave(out / "splat.json", dict(rep, log=log))
    sheet(views, G, out / "splat_sheet.jpg")
    return rep


def main(a):
    rep = run(a.out, a.res, a.iters, a.device, a.voxel, a.init, a.seed, a.orient, max_frames=a.max_frames, refine_poses=a.refine_poses)
    print(json.dumps({k: v for k, v in rep.items() if k != "log"}))
    print("GSHAIR splat ok")
