"""Step 5: the clay. The splat is fitted onto the character's head (a person's capture already is; a wig's is turned
by the cameras' down and the first frame's front, centred and scaled to the skull: a first guess, adjusted on the
page and kept in align.json), then grouped into a few clumps: invisible blobs of clay, one per lock of hair, each a
short chain of joints pinned to the scalp at its root. Every Gaussian is glued to its clump: its centre, rotation and
scales kept in the chain's frame at its distance from the root, so the page rebuilds the splat from the chains as
they jiggle (wig.js) and only the chains are simulated. Written:
  splat.json   the clumps (chains, frames, lengths, radii), the colour, the head's collision field, the alignment, the report
  splat.bin    float32 per Gaussian: clump, u (joints), offset (T,N,B), scales (3), rotation in the frame (quaternion
               w,x,y,z), r, g, b, opacity, occlusion: 17 floats
  head.json    the head and shoulders round the skull, for the page to draw and to hide hair behind
  align.json   the similarity from the splat's world onto the head (written only when none was there)"""
import json
from pathlib import Path

import numpy as np

from .common import HeadField, head_frame, jload, jsave, mhr_scale
from .export import body_slices, frames as chain_frames, kmeans


def quat_mul(a, b):
    """(w,x,y,z) products, (N,4) x (N,4) or (4,) x (N,4)"""
    a = np.broadcast_to(a, b.shape); w1, x1, y1, z1 = a.T; w2, x2, y2, z2 = b.T
    return np.stack([w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2, w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
                     w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2], 1)


def mat_to_quat(R):
    """rotation matrices (N,3,3) -> quaternions (N,4) (w,x,y,z)"""
    R = np.asarray(R); n = R.shape[0]
    q = np.empty((n, 4))
    tr = R[:, 0, 0] + R[:, 1, 1] + R[:, 2, 2]
    for i in range(n):
        m = R[i]
        if tr[i] > 0:
            s = np.sqrt(tr[i] + 1) * 2; q[i] = [0.25 * s, (m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s]
        elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
            s = np.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2; q[i] = [(m[2, 1] - m[1, 2]) / s, 0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s]
        elif m[1, 1] > m[2, 2]:
            s = np.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2; q[i] = [(m[0, 2] - m[2, 0]) / s, (m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s]
        else:
            s = np.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2; q[i] = [(m[1, 0] - m[0, 1]) / s, (m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s]
    return q / np.linalg.norm(q, axis=1, keepdims=True)


def quat_to_mat(q):
    w, x, y, z = q.T
    return np.stack([np.stack([1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], 1),
                     np.stack([2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], 1),
                     np.stack([2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)], 1)], 1)


def default_align(sp, cams, fr, field, S):
    """a wig's world onto the head: up from the cameras' down, front from the first frame, the top of the hair to the
    top of the skull, the width to the head's (a guess: the page's sliders finish it)"""
    rep = cams["report"]
    if rep.get("anchored"): return dict(R=np.eye(3).tolist(), t=[0, 0, 0], s=1.0, source="face")
    down = np.array(rep["down"], float); up_s = -down / np.linalg.norm(down)
    f0 = -np.array(rep["forward_first"], float); f_s = f0 - up_s * (f0 @ up_s); f_s /= np.linalg.norm(f_s) + 1e-12
    x_s = np.cross(up_s, f_s)
    Bs = np.stack([x_s, up_s, f_s], 1); Bh = np.stack([fr["X"], fr["U"], fr["F"]], 1)
    R = Bh @ Bs.T
    w = sp["opacity"]; mu = sp["mu"]
    loc = (mu - mu.mean(0)) @ Bs                                       # the splat in its own (x, up, front) frame
    lo, hi = np.percentile(loc[:, 0], [10, 90]); width = hi - lo
    top = np.percentile(loc[:, 1], 97)
    cx = np.average(loc[:, 0], weights=w); cz = np.average(loc[:, 2], weights=w)
    head_w = 2 * np.median(field.R[field.R > 0]) if (field.R > 0).any() else 0.16 * S
    s = (head_w * 1.25) / max(width, 1e-6)
    src = mu.mean(0) + Bs @ np.array([cx, top, cz])                     # the hair's top, middle
    dst = field.C + fr["U"] * (field.R.max() + 0.01 * S)
    t = dst - s * R @ src
    return dict(R=R.tolist(), t=t.tolist(), s=float(s), source="guess", width_m=round(float(width * s), 3))


def apply_align(sp, al):
    R, t, s = np.array(al["R"], float), np.array(al["t"], float), float(al["s"])
    mu = s * (sp["mu"] @ R.T) + t
    q = quat_mul(mat_to_quat(R[None])[0], sp["quat"])
    return dict(mu=mu, quat=q, scales=sp["scales"] * s, opacity=sp["opacity"], rgb=sp["rgb"])


def run(out, clumps=16, joints=4, seed=3, align=None, min_members=30, squash=0.45):
    out = Path(out)
    sp = {k: v.astype(float) for k, v in np.load(out / "splat.npz").items() if k in ("mu", "scales", "quat", "opacity", "rgb")}
    head = np.load(out / "head.npz")
    pts, tris, lm = head["points"].astype(float), head["tris"].astype(np.int64), head["landmarks"].astype(float)
    fr = head_frame(lm); S = mhr_scale(fr["h"]); field = HeadField(pts, fr, S)
    cams = jload(out / "cameras.json")
    al = jload(align or out / "align.json")
    if al is None:
        al = default_align(sp, cams, fr, field, S); jsave(out / "align.json", al)
    g = apply_align(sp, al)
    mu, op = g["mu"], g["opacity"]
    N = len(mu)
    # the clumps: compact in the head's frame, the vertical squashed so a lock stays one blob
    d = mu - field.C
    feat = np.stack([d @ fr["X"], squash * (d @ fr["U"]), d @ fr["F"]], 1)
    K = min(clumps, max(1, N // max(min_members, 1)))
    lab = kmeans(feat, K, seed=seed)
    # small clumps join their nearest big one
    counts = np.bincount(lab, minlength=K)
    cent = np.array([feat[lab == c].mean(0) if counts[c] else [1e9, 1e9, 1e9] for c in range(K)])
    big = np.flatnonzero(counts >= min_members)
    if len(big) and len(big) < K:
        for c in np.flatnonzero(counts < min_members):
            lab[lab == c] = big[np.argmin(np.linalg.norm(cent[big] - cent[c], axis=1))]
    used = np.unique(lab); remap = -np.ones(lab.max() + 1, int); remap[used] = np.arange(len(used)); lab = remap[lab]; K = len(used)
    # each clump's chain: root on the scalp nearest its members, joints down its long axis
    G = np.zeros((K, joints, 3)); radii = np.zeros(K); Gl = np.zeros(K)
    for c in range(K):
        P = mu[lab == c]; w = op[lab == c] + 1e-3
        r, R, el = field.radius(P)
        i = np.argmin(r - R)
        root = field.C + field.normal(P[i:i + 1])[0] * (R[i] + 0.002 * S)
        m = np.average(P, axis=0, weights=w)
        ev, evec = np.linalg.eigh(np.cov((P - m).T, aweights=w))
        a = evec[:, -1]
        if (m - root) @ a < 0: a = -a
        s = (P - root) @ a
        s = np.clip(s, 0, None)
        edges = np.quantile(s, np.linspace(0, 1, joints))
        G[c, 0] = root
        for j in range(1, joints):
            band = (s >= edges[j - 1]) & (s <= edges[j]) if j < joints - 1 else (s >= edges[j - 1])
            G[c, j] = np.average(P[band], axis=0, weights=w[band]) if band.any() else root + a * edges[j]
        for j in range(1, joints):                                           # never back up the chain
            step = G[c, j] - G[c, j - 1]
            if np.linalg.norm(step) < 0.005 * S: G[c, j] = G[c, j - 1] + a * 0.005 * S
        Gl[c] = np.linalg.norm(np.diff(G[c], axis=0), axis=1).sum()
        radii[c] = float(np.sqrt(np.average(np.linalg.norm(np.cross(P - root, a), axis=1) ** 2, weights=w)))
    middle = field.C - fr["U"] * 0.03 * S
    T, Nf, B = chain_frames(G, middle)
    # glue: nearest point on the clump's chain
    seg_a = G[:, :-1]; seg_b = G[:, 1:]
    A = seg_a[lab]; Bv = seg_b[lab] - A                                   # (N, J-1, 3)
    tt = np.clip(((mu[:, None] - A) * Bv).sum(2) / ((Bv * Bv).sum(2) + 1e-12), 0, 1)
    Q = A + Bv * tt[..., None]
    dist = np.linalg.norm(mu[:, None] - Q, axis=2)
    k = np.argmin(dist, 1)
    u = k + tt[np.arange(N), k]
    j0 = np.minimum(np.floor(u).astype(int), joints - 2); f = (u - j0)[:, None]
    lerp = lambda M: M[lab, j0] * (1 - f) + M[lab, j0 + 1] * f
    gp, gT, gN, gB = lerp(G), lerp(T), lerp(Nf), lerp(B)
    gN = gN - gT * (gN * gT).sum(1, keepdims=True); gN /= np.linalg.norm(gN, axis=1, keepdims=True) + 1e-12
    gB = np.cross(gT, gN)
    F = np.stack([gT, gN, gB], 2)                                          # columns: the frame
    off = np.einsum("nij,ni->nj", F, mu - gp)
    Rq = quat_to_mat(g["quat"])
    q_local = mat_to_quat(np.einsum("nji,njk->nik", F, Rq))               # F^T Rq
    # occlusion: depth in the hair
    AZ, EL = 64, 32
    def bins(v):
        r = np.linalg.norm(v, axis=-1); el = np.arcsin(np.clip(v[..., 1] / (r + 1e-12), -1, 1)); az = np.arctan2(v[..., 0], v[..., 2])
        return r, np.minimum(EL - 1, ((el + np.pi / 2) / np.pi * EL).astype(int)), np.minimum(AZ - 1, ((az + np.pi) / (2 * np.pi) * AZ).astype(int))
    r, e, a = bins(mu - middle); outer = np.zeros((EL, AZ)); np.maximum.at(outer, (e, a), r)
    for _ in range(2): outer = np.maximum(outer, 0.5 * (np.roll(outer, 1, 1) + np.roll(outer, -1, 1)))
    depth = np.clip((outer[e, a] - r) / (0.03 * S), 0, 1); occ = 1 - 0.65 * depth
    per = np.concatenate([lab[:, None], u[:, None], off, g["scales"], q_local, g["rgb"], op[:, None], occ[:, None]], 1).astype(np.float32)
    mean_rgb = (g["rgb"] * op[:, None]).sum(0) / (op.sum() + 1e-6)
    rep = dict(gaussians=int(N), clumps=int(K), joints=joints, offset_mm=dict(mean=round(float(np.linalg.norm(off, axis=1).mean() * 1000), 1), p95=round(float(np.percentile(np.linalg.norm(off, axis=1), 95) * 1000), 1)),
               clump_size=dict(min=int(np.bincount(lab).min()), median=int(np.median(np.bincount(lab))), max=int(np.bincount(lab).max())),
               chain_m=dict(median=round(float(np.median(Gl)), 3), max=round(float(Gl.max()), 3)), align=al.get("source"))
    near = np.linalg.norm(pts - field.C, axis=1) < 0.55 * S
    keep_t = near[tris].all(1); idx = np.flatnonzero(near); remap = -np.ones(len(pts), int); remap[idx] = np.arange(len(idx))
    jsave(out / "head.json", dict(about="the head and shoulders round the skull, metres, Y up, facing +Z", points=pts[idx].round(4).tolist(),
                                  tris=remap[tris[keep_t]].tolist(), C=field.C.round(4).tolist(), X=fr["X"].round(4).tolist(), U=fr["U"].round(4).tolist(),
                                  F=fr["F"].round(4).tolist(), S=round(S, 4)))
    jsave(out / "splat.json", dict(
        about="a hair splat glued to clay clumps on chains; tools/character/gshair/clumps.py", clumps=int(K), joints=joints, gaussians=int(N),
        guides=G.round(5).tolist(), lengths=Gl.round(5).tolist(), radii=radii.round(4).tolist(), members=np.bincount(lab).tolist(),
        frames=dict(T=T.round(5).tolist(), N=Nf.round(5).tolist()), middle=middle.round(5).tolist(), colour=mean_rgb.round(4).tolist(),
        head=dict(C=field.C.round(4).tolist(), X=fr["X"].round(4).tolist(), U=fr["U"].round(4).tolist(), F=fr["F"].round(4).tolist(), S=round(S, 4),
                  top=field.top.round(4).tolist(), radii=field.R.round(4).tolist(), body=body_slices(pts, field, S)),
        align=al, bin="float32 per Gaussian: clump, u (joints), offset (T,N,B), scales (3), quaternion in the frame (w,x,y,z), r, g, b, opacity, occlusion: 17",
        report=rep))
    (out / "splat.bin").write_bytes(per.tobytes())
    return rep


def main(a):
    rep = run(a.out, a.clumps, a.joints, align=a.align)
    print(json.dumps(rep))
    print("GSHAIR clumps ok")
