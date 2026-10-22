"""Hair batched the way anime games do it: tens of thousands of strands (fitted by hair_fit.py)
grouped into a few hundred clumps; each clump is one guide, a chain of joints, and only the chains get physics. Every
strand rides its clump: each of its points is kept as an offset in its guide's frame at the same distance from the
root, so the strands are rebuilt from the moving chains on the GPU and nothing per strand is simulated. numpy only.

    python tools/character/hair_batch.py --fit DIR/fit.npz --out DIR [--clumps 256] [--joints 12] [--strands 20000]
                                         [--points 24] [--material DIR/hair.json]

Writes DIR/batch.json (the guides' rest chains, their frames, the colour and the report) and DIR/batch.bin (per
point of the strands drawn: its clump, its place along the guide, its offset and tangent in the guide's frame, how
deep in the hair it sits). The clumps: k-means on where a strand starts and where it goes (its root and four points
along it), so a clump is a lock that starts together and hangs together. The depth: how far in from the hair's outside
a point is (a radial field round the roots' middle), darkening the inside like the shadow real hair casts on itself.
"""
import argparse
import json
from pathlib import Path

import numpy as np


def resample(S, n):
    """strands (s, p, 3) -> (s, n, 3) evenly along their length, and their lengths"""
    seg = np.linalg.norm(np.diff(S, axis=1), axis=2)
    acc = np.concatenate([np.zeros((len(S), 1)), np.cumsum(seg, 1)], 1)
    L = acc[:, -1]
    out = np.empty((len(S), n, 3))
    for j, f in enumerate(np.linspace(0, 1, n)):
        d = L * f
        k = np.clip((acc < d[:, None]).sum(1) - 1, 0, S.shape[1] - 2)
        a, b = acc[np.arange(len(S)), k], acc[np.arange(len(S)), k + 1]
        t = np.clip((d - a) / np.maximum(b - a, 1e-9), 0, 1)[:, None]
        out[:, j] = S[np.arange(len(S)), k] * (1 - t) + S[np.arange(len(S)), k + 1] * t
    return out, L


def kmeans(X, k, iters=20, seed=3, sample=30000):
    """k-means++ on a sample, then Lloyd on everything; returns the labels and the centres"""
    rng = np.random.default_rng(seed)
    Xs = X[rng.choice(len(X), min(sample, len(X)), replace=False)]
    C = [Xs[rng.integers(len(Xs))]]
    d2 = ((Xs - C[0]) ** 2).sum(1)
    for _ in range(1, k):
        C.append(Xs[rng.choice(len(Xs), p=d2 / d2.sum())]); d2 = np.minimum(d2, ((Xs - C[-1]) ** 2).sum(1))
    C = np.array(C)
    for _ in range(iters):
        lab = assign(X, C)
        for j in range(k):
            m = lab == j
            if m.any(): C[j] = X[m].mean(0)
    return assign(X, C), C


def assign(X, C, chunk=8192):
    out = np.empty(len(X), int); c2 = (C ** 2).sum(1)
    for i in range(0, len(X), chunk):
        out[i:i + chunk] = np.argmin(c2[None] - 2 * X[i:i + chunk] @ C.T, 1)
    return out


def frames(G, out_from):
    """parallel-transport frames along each chain (k, j, 3): T along it, N out from out_from (the roots' middle), B"""
    T = np.gradient(G, axis=1); T /= np.linalg.norm(T, axis=2, keepdims=True) + 1e-12
    N = np.empty_like(G); B = np.empty_like(G)
    n0 = G[:, 0] - out_from; n0 -= T[:, 0] * (n0 * T[:, 0]).sum(1, keepdims=True)
    N[:, 0] = n0 / (np.linalg.norm(n0, axis=1, keepdims=True) + 1e-12)
    for j in range(1, G.shape[1]):
        n = N[:, j - 1] - T[:, j] * (N[:, j - 1] * T[:, j]).sum(1, keepdims=True)
        N[:, j] = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    B[:] = np.cross(T, N)
    return T, N, B


def colour(mat):
    """a base colour from a melanin and a redness (Blender's Principled Hair absorption, seen through about a
    strand's width), and the root darkening"""
    m = float(mat.get("melanin", 0.85)); r = float(mat.get("redness", 0.15))     # without a guess: dark brown
    q = -np.log(max(1 - m, 1e-4))
    sigma = q * (1 - r) * np.array([0.506, 0.841, 1.653]) + q * r * np.array([0.343, 0.733, 1.924])
    rgb = np.exp(-sigma * 0.9)
    return dict(rgb=[round(float(c), 4) for c in rgb], root_dark=dict(start=float(mat.get("root_darkness_start", 0.0)),
                end=float(mat.get("root_darkness_end", 0.15)), strength=float(mat.get("root_darkness_strength", 0.3))))


def batch(S, clumps=256, joints=12, strands=20000, points=24, seed=3):
    rng = np.random.default_rng(seed)
    S, L = resample(S, 64)
    roots = S[:, 0]; middle = roots.mean(0) - np.array([0, 0.03, 0])
    feat = np.concatenate([roots * 2.0, S[:, 16], S[:, 32], S[:, 48], S[:, 63]], 1)
    lab, _ = kmeans(feat, min(clumps, len(S)), seed=seed)
    used = np.unique(lab); remap = -np.ones(lab.max() + 1, int); remap[used] = np.arange(len(used)); lab = remap[lab]
    K = len(used)
    # the guides: each clump's mean strand at its median length, rooted at its members' mean root
    Gl = np.zeros(K); G = np.zeros((K, joints, 3))
    for c in range(K):
        m = lab == c
        Gl[c] = np.median(L[m])
        g, _ = resample(S[m].mean(0)[None], joints)                 # the mean shape...
        gl = np.linalg.norm(np.diff(g[0], axis=0), axis=1).sum()
        G[c] = g[0][0] + (g[0] - g[0][0]) * (Gl[c] / max(gl, 1e-6))  # ...stretched back to the clump's length
        G[c] += roots[m].mean(0) - G[c][0]
    T, N, B = frames(G, middle)
    # the strands drawn: a sample, each riding its clump by distance from the root
    pick = np.sort(rng.choice(len(S), min(strands, len(S)), replace=False))
    R, Lr = resample(S[pick], points)
    c = lab[pick]
    s = np.linspace(0, 1, points)[None] * Lr[:, None]                 # each point's distance from the root
    u = np.clip(s / Gl[c][:, None], 0, 1) * (joints - 1)             # its place along the guide, in joints
    j0 = np.minimum(np.floor(u).astype(int), joints - 2); f = (u - j0)[..., None]
    lerp = lambda A: A[c[:, None], j0] * (1 - f) + A[c[:, None], j0 + 1] * f
    gp, gT, gN, gB = lerp(G), lerp(T), lerp(N), lerp(B)
    d = R - gp
    off = np.stack([(d * gT).sum(2), (d * gN).sum(2), (d * gB).sum(2)], 2)
    tan = np.gradient(R, axis=1); tan /= np.linalg.norm(tan, axis=2, keepdims=True) + 1e-12
    tl = np.stack([(tan * gT).sum(2), (tan * gN).sum(2), (tan * gB).sum(2)], 2)
    # depth in the hair: a radial field round the middle, the outermost hair per direction
    allp = S[:, ::4].reshape(-1, 3) - middle
    AZ, EL = 64, 32
    def bins(v):
        r = np.linalg.norm(v, axis=-1); el = np.arcsin(np.clip(v[..., 1] / (r + 1e-12), -1, 1)); az = np.arctan2(v[..., 0], v[..., 2])
        return r, np.minimum(EL - 1, ((el + np.pi / 2) / np.pi * EL).astype(int)), np.minimum(AZ - 1, ((az + np.pi) / (2 * np.pi) * AZ).astype(int))
    r, e, a = bins(allp); outer = np.zeros((EL, AZ)); np.maximum.at(outer, (e, a), r)
    for _ in range(2): outer = np.maximum(outer, 0.5 * (np.roll(outer, 1, 1) + np.roll(outer, -1, 1)))
    r, e, a = bins(R - middle)
    depth = np.clip((outer[e, a] - r) / 0.03, 0, 1)                    # 0 on the outside, 1 three cm in
    occ = 1 - 0.65 * depth
    rep = dict(strands_in=int(len(S)), clumps=int(K), joints=joints, strands_drawn=int(len(pick)), points=points,
               offset_mm=dict(mean=round(float(np.linalg.norm(off, axis=2).mean() * 1000), 1),
                              p95=round(float(np.percentile(np.linalg.norm(off, axis=2), 95) * 1000), 1)),
               clump_size=dict(min=int(np.bincount(lab).min()), median=int(np.median(np.bincount(lab))), max=int(np.bincount(lab).max())))
    return dict(G=G, T=T, N=N, B=B, Gl=Gl, clump=c, u=u, off=off, tan=tl, occ=occ, middle=middle, report=rep)


def write(out, b, mat):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    n, p = b["u"].shape
    head = dict(about="hair batched: guides (clumps x joints) and the strands that ride them; tools/character/hair_batch.py",
                clumps=int(len(b["G"])), joints=int(b["G"].shape[1]), strands=int(n), points=int(p),
                guides=b["G"].round(5).tolist(), lengths=b["Gl"].round(5).tolist(),
                frames=dict(T=b["T"].round(5).tolist(), N=b["N"].round(5).tolist()), middle=b["middle"].round(5).tolist(),
                colour=colour(mat), report=b["report"],
                bin="float32 per point, strand by strand: clump, u (joints), offset (T,N,B), tangent (T,N,B), occlusion: 9 floats")
    (out / "batch.json").write_text(json.dumps(head), encoding="utf-8")
    per = np.concatenate([np.repeat(b["clump"][:, None], p, 1)[..., None], b["u"][..., None], b["off"], b["tan"], b["occ"][..., None]], 2)
    (out / "batch.bin").write_bytes(per.astype(np.float32).tobytes())
    return head


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--fit", required=True, help="fit.npz (positions), a .npy (strands x points x 3) or a raw .f32 with fit.json {points}")
    ap.add_argument("--out", required=True)
    ap.add_argument("--clumps", type=int, default=256); ap.add_argument("--joints", type=int, default=12)
    ap.add_argument("--strands", type=int, default=20000); ap.add_argument("--points", type=int, default=24)
    ap.add_argument("--material")
    a = ap.parse_args()
    if a.fit.endswith(".npz"): S = np.load(a.fit)["positions"]
    elif a.fit.endswith(".f32"):                                     # raw float32, its points per strand beside it (fit.json)
        S = np.fromfile(a.fit, np.float32).reshape(-1, json.loads(Path(a.fit).with_suffix(".json").read_text())["points"], 3)
    else: S = np.load(a.fit)
    mat = json.loads(Path(a.material).read_text()) if a.material and Path(a.material).exists() else {}
    b = batch(S.astype(float), a.clumps, a.joints, a.strands, a.points)
    head = write(a.out, b, mat)
    print(json.dumps(head["report"]))
    print("HAIRBATCH ok")


if __name__ == "__main__":
    main()
