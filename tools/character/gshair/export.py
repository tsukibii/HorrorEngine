"""Helpers for the clay (clumps.py): k-means, chain frames by parallel transport, the body's slices for the page's
collision."""
import numpy as np

def kmeans(X, k, iters=20, seed=3, sample=30000):
    rng = np.random.default_rng(seed)
    Xs = X[rng.choice(len(X), min(sample, len(X)), replace=False)]
    C = [Xs[rng.integers(len(Xs))]]; d2 = ((Xs - C[0]) ** 2).sum(1)
    for _ in range(1, k):
        C.append(Xs[rng.choice(len(Xs), p=d2 / d2.sum())]); d2 = np.minimum(d2, ((Xs - C[-1]) ** 2).sum(1))
    C = np.array(C)
    assign = lambda X, C: np.argmin(((C ** 2).sum(1))[None] - 2 * X @ C.T, 1)
    for _ in range(iters):
        lab = assign(X, C)
        for j in range(k):
            m = lab == j
            if m.any(): C[j] = X[m].mean(0)
    return assign(X, C)


def resample(S, n):
    seg = np.linalg.norm(np.diff(S, axis=1), axis=2)
    acc = np.concatenate([np.zeros((len(S), 1)), np.cumsum(seg, 1)], 1); L = acc[:, -1]
    out = np.empty((len(S), n, 3))
    for j, f in enumerate(np.linspace(0, 1, n)):
        d = L * f
        k = np.clip((acc < d[:, None]).sum(1) - 1, 0, S.shape[1] - 2)
        a, b = acc[np.arange(len(S)), k], acc[np.arange(len(S)), k + 1]
        t = np.clip((d - a) / np.maximum(b - a, 1e-9), 0, 1)[:, None]
        out[:, j] = S[np.arange(len(S)), k] * (1 - t) + S[np.arange(len(S)), k + 1] * t
    return out, L


def frames(G, out_from):
    T = np.gradient(G, axis=1); T /= np.linalg.norm(T, axis=2, keepdims=True) + 1e-12
    N = np.empty_like(G); B = np.empty_like(G)
    n0 = G[:, 0] - out_from; n0 -= T[:, 0] * (n0 * T[:, 0]).sum(1, keepdims=True)
    N[:, 0] = n0 / (np.linalg.norm(n0, axis=1, keepdims=True) + 1e-12)
    for j in range(1, G.shape[1]):
        n = N[:, j - 1] - T[:, j] * (N[:, j - 1] * T[:, j]).sum(1, keepdims=True)
        N[:, j] = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    B[:] = np.cross(T, N)
    return T, N, B


def body_slices(pts, field, S, step=0.015, sectors=32):
    """the neck, shoulders and chest as rows of radii round each row's middle (for the page's collision)"""
    y0 = field.C[1] - 0.02 * S; rows = int(0.6 * S / step)
    row = np.floor((y0 - pts[:, 1]) / step).astype(int)
    ok = (row >= 0) & (row < rows) & (np.abs(pts[:, 0] - field.C[0]) < 0.3 * S)
    mid = np.zeros((rows, 2)); cnt = np.zeros(rows)
    np.add.at(mid, row[ok], pts[ok][:, [0, 2]]); np.add.at(cnt, row[ok], 1)
    mid /= np.maximum(cnt, 1)[:, None]
    dx = pts[ok, 0] - mid[row[ok], 0]; dz = pts[ok, 2] - mid[row[ok], 1]
    sec = ((np.arctan2(dx, dz) + np.pi) / (2 * np.pi) * sectors).astype(int) % sectors
    R = np.zeros((rows, sectors)); np.maximum.at(R, (row[ok], sec), np.hypot(dx, dz))
    return dict(y0=float(y0), step=step, rows=rows, sectors=sectors, mid=mid.round(4).tolist(), radii=R.round(4).tolist(), count=cnt.astype(int).tolist())
