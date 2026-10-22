"""A synthetic capture for the check: a known wig (procedural strands on MHR's own head, drawn as thin Gaussians), a
dotted wall round the room for the feature chaining, cameras swept round the head, every frame rendered with the
same splatter the reconstruction uses (so the check measures the pipeline, not the renderer), with its hair masks and
orientation maps. As a mannequin capture (the default) the head is keyed away and no face is seen; as a person's,
the head is drawn and the face points of the frames that see it are given. truth.npz keeps the hair's points and the
cameras to measure against."""
from pathlib import Path

import numpy as np

from .common import HOME, HeadField, head_frame, jsave, landmarks_on, load_head, mhr_scale, project_np, sample_triangles, scalp


def look_at(pos, target, up):
    """an OpenCV camera (x right, y down, z forward) at pos looking at target: R rows = right, down, forward"""
    f = target - pos; f /= np.linalg.norm(f)
    r = np.cross(f, up); r /= np.linalg.norm(r)
    return np.stack([r, np.cross(f, r), f]), None


class Room:
    """a textured room behind the head: a wall round it (a cylinder, 1.6 m) and a table under it (0.32 m down, to
    1.3 m out), both painted with random shapes, as a feature matcher sees a real room; ray-cast per pixel"""
    def __init__(self, C, rng, radius=1.6, table_y=-0.32, table_r=1.3):
        self.C, self.radius, self.ty, self.tr = C, radius, table_y, table_r
        self.wall = self.paint(rng, 3072, 768); self.table = self.paint(rng, 1024, 1024)

    @staticmethod
    def paint(rng, w, h):
        import cv2
        img = np.full((h, w, 3), rng.uniform(0.3, 0.7, 3) * 255, np.uint8)
        for _ in range(w * h // 1500):
            c = tuple(int(x) for x in rng.uniform(20, 235, 3)); x, y = int(rng.integers(w)), int(rng.integers(h))
            k = rng.random()
            if k < 0.4: cv2.rectangle(img, (x, y), (x + int(rng.integers(4, 60)), y + int(rng.integers(4, 60))), c, -1)
            elif k < 0.7: cv2.circle(img, (x, y), int(rng.integers(2, 25)), c, -1)
            else: cv2.line(img, (x, y), (x + int(rng.integers(-80, 80)), y + int(rng.integers(-80, 80))), c, int(rng.integers(1, 4)))
        noise = rng.normal(0, 6, img.shape)
        return np.clip(cv2.GaussianBlur(img, (0, 0), 0.6).astype(np.float32) + noise, 0, 255) / 255

    def view(self, R, t, K, W, H):
        import cv2
        u, v = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
        d = np.stack([(u - K[2]) / K[0], (v - K[3]) / K[1], np.ones_like(u)], -1) @ R          # rays in the world
        o = -R.T @ t
        out = np.zeros((H, W, 3), np.float32)
        # the table: where the ray goes down to its plane within its radius
        s = (self.C[1] + self.ty - o[1]) / np.where(np.abs(d[..., 1]) < 1e-9, 1e-9, d[..., 1])
        hit = o + d * s[..., None]
        on_table = (s > 0) & (np.hypot(hit[..., 0] - self.C[0], hit[..., 2] - self.C[2]) < self.tr)
        tx = ((hit[..., 0] - self.C[0]) / self.tr * 0.5 + 0.5) * (self.table.shape[1] - 1); ty = ((hit[..., 2] - self.C[2]) / self.tr * 0.5 + 0.5) * (self.table.shape[0] - 1)
        tab = cv2.remap(self.table, tx.astype(np.float32), ty.astype(np.float32), cv2.INTER_LINEAR)
        # the wall: the cylinder round the head's axis
        ox, oz = o[0] - self.C[0], o[2] - self.C[2]; dx, dz = d[..., 0], d[..., 2]
        a = dx * dx + dz * dz; b = 2 * (ox * dx + oz * dz); c = ox * ox + oz * oz - self.radius ** 2
        disc = np.maximum(b * b - 4 * a * c, 0); sw = (-b + np.sqrt(disc)) / (2 * np.maximum(a, 1e-9))
        hw = o + d * sw[..., None]
        ang = (np.arctan2(hw[..., 0] - self.C[0], hw[..., 2] - self.C[2]) + np.pi) / (2 * np.pi) * (self.wall.shape[1] - 1)
        hgt = np.clip((0.9 - (hw[..., 1] - self.C[1])) / 1.8, 0, 1) * (self.wall.shape[0] - 1)
        wall = cv2.remap(self.wall, ang.astype(np.float32), hgt.astype(np.float32), cv2.INTER_LINEAR)
        out[:] = wall; out[on_table] = tab[on_table]
        return out


def strands_on(pts, tris, lm, fr, S, field, n, nodes, rng):
    ids = scalp(pts, tris, lm, fr, S)
    roots, nrm = sample_triangles(pts, tris, ids, n, rng)
    down = -fr["U"]
    L = rng.uniform(0.12, 0.28, n) * S
    steps = 60
    d = nrm * 0.5 + down * 0.5; d /= np.linalg.norm(d, axis=1, keepdims=True)
    p = roots + nrm * 0.002 * S
    P = [roots.copy()]
    phase = rng.uniform(0, 2 * np.pi, n); side = np.cross(down, fr["F"])
    for j in range(steps):
        t = j / steps
        d = d + 0.25 * down + 0.08 * np.sin(phase + 6 * t)[:, None] * side
        d /= np.linalg.norm(d, axis=1, keepdims=True)
        q = p + d * (L / steps)[:, None]
        q, _ = field.push(q, 0.002 * S)
        P.append(q); p = q
    P = np.stack(P, 1)
    seg = np.linalg.norm(np.diff(P, axis=1), axis=2); acc = np.concatenate([np.zeros((n, 1)), np.cumsum(seg, 1)], 1)
    out = np.empty((n, nodes, 3))
    for j, f in enumerate(np.linspace(0, 1, nodes)):
        dd = acc[:, -1] * f
        k = np.clip((acc < dd[:, None]).sum(1) - 1, 0, steps - 1)
        a, b = acc[np.arange(n), k], acc[np.arange(n), k + 1]
        t = np.clip((dd - a) / np.maximum(b - a, 1e-9), 0, 1)[:, None]
        out[:, j] = P[np.arange(n), k] * (1 - t) + P[np.arange(n), k + 1] * t
    return out.astype(np.float32)


def make(out, n_strands=600, nodes=48, views=36, size=320, seed=0, radius=4e-4, home=HOME, person=False, device="cpu"):
    import cv2
    import torch
    from .raster import render
    from .masks import orientation, gabor_bank
    out = Path(out); rng = np.random.default_rng(seed)
    for d in ("frames", "masks", "orient"): (out / d).mkdir(parents=True, exist_ok=True)
    pts, tris, name = load_head("mhr")
    lm = landmarks_on(pts, tris, name, home)
    fr = head_frame(lm); S = mhr_scale(fr["h"]); field = HeadField(pts, fr, S)
    C = field.C
    hair = strands_on(pts, tris, lm, fr, S, field, n_strands, nodes, rng)
    seg = hair[:, 1:] - hair[:, :-1]; s = np.linalg.norm(seg, axis=2); ax = seg / (s[..., None] + 1e-12)
    mu_h = ((hair[:, 1:] + hair[:, :-1]) / 2).reshape(-1, 3)
    base = np.array([0.26, 0.15, 0.09]) + rng.normal(0, 0.03, (n_strands, 1, 3))
    v = np.linspace(0, 1, nodes - 1)[None, :, None]
    rgb_h = np.clip(base * (0.6 + 0.4 * v), 0, 1).reshape(-1, 3)
    nh = len(mu_h)
    if person:
        near = np.linalg.norm(pts - C, axis=1) < 0.45 * S
        head_mu, _ = sample_triangles(pts, tris, np.flatnonzero(near[tris].all(1)), 25000, rng)
    else:
        head_mu = np.zeros((0, 3))
    nd = len(head_mu)
    nd = len(head_mu); n_wall = 0
    T = lambda a: torch.as_tensor(np.asarray(a), dtype=torch.float32, device=device)
    MU = T(np.concatenate([mu_h, head_mu])); AX = T(np.concatenate([ax.reshape(-1, 3), np.tile([1, 0, 0], (nd, 1))]))
    R_ = T(np.concatenate([np.full(nh, radius), np.full(nd, 0.0025)]))
    SG = T(np.concatenate([s.reshape(-1) * 0.5, np.full(nd, 0.0025)]))
    OP = T(np.concatenate([np.full(nh, 0.9), np.full(nd, 0.97)]))
    RGB = T(np.concatenate([rgb_h, np.tile([0.80, 0.64, 0.55], (nd, 1))]))
    ISH = T(np.concatenate([np.ones(nh), np.zeros(nd)]))[:, None]
    room = Room(C, rng)
    f_px = 1.4 * size; K = [f_px, f_px, size / 2, size / 2]
    names, cams, lms = [], [], {}
    bank = gabor_bank()
    for i in range(views):
        a = 2 * np.pi * i / views
        pos = C + np.array([0.9 * np.sin(a), 0.18, 0.9 * np.cos(a)])
        R, _ = look_at(pos, C - fr["U"] * 0.1, fr["U"]); t = -R @ pos
        cam = dict(R=T(R), t=T(t), K=tuple(K), W=size, H=size)
        with torch.no_grad():
            img, acc_p, _ = render(MU, AX, R_, SG, OP, torch.cat([RGB, ISH], 1), cam)
        bg = room.view(R, t, K, size, size)
        rgb = np.clip(img[..., :3].cpu().numpy() + (1 - acc_p.cpu().numpy())[..., None] * bg, 0, 1); hairv = img[..., 3].clamp(0, 1).cpu().numpy()
        name = f"{i:03d}"; names.append(name)
        cv2.imwrite(str(out / "frames" / f"{name}.jpg"), cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
        hm = np.clip(hairv / (acc_p.cpu().numpy() + 1e-3), 0, 1)
        cv2.imwrite(str(out / "masks" / f"{name}_hair.png"), (hm * 255).astype(np.uint8))
        cv2.imwrite(str(out / "masks" / f"{name}_alpha.png"), (acc_p.clamp(0, 1).cpu().numpy() * 255).astype(np.uint8))
        theta, conf = orientation(cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY), bank)
        np.savez_compressed(out / "orient" / f"{name}.npz", theta=theta.astype(np.float16), conf=(conf * (hm > 0.3)).astype(np.float16))
        if person and (pos - C) @ fr["F"] / np.linalg.norm(pos - C) > np.cos(np.radians(70)):
            p, z = project_np(lm, R, t, K)
            lms[name] = (p + rng.normal(0, 0.7, p.shape)).round(2).tolist()
        cams.append(dict(name=name, R=R, t=t))
    jsave(out / "capture.json", dict(source="synthetic", frames=names, width=size, height=size, original=[size, size], fps=0, focal35=0, K=K, sources=names))
    jsave(out / "landmarks.json", lms)
    jsave(out / "masks.json", dict(frames=views, faces=len(lms), res=size, key="synthetic"))
    np.savez_compressed(out / "head.npz", points=pts.astype(np.float32), tris=tris.astype(np.int32), landmarks=lm.astype(np.float32))
    np.savez_compressed(out / "truth.npz", positions=hair, mu=mu_h.astype(np.float32), R=np.stack([c["R"] for c in cams]), t=np.stack([c["t"] for c in cams]), K=np.array(K))
    return dict(frames=views, faces=len(lms), strands=n_strands, nodes=nodes, size=size, person=person)
