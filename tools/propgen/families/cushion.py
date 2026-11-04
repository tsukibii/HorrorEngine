"""Cushions shaped to what they sit on (the user, 2026-11-04: "all chairs should be able to support simple cushions ...
puffy soft physics and stuff that gets baked ... keeping the poly count low, it's fine to increase polys for the sim
physics then bake and simplify before the final export"; docs/research/tables_chairs.md §5).

The bedding's bag (PROPGEN §21) made to any outline: the outline (a chair's seat, its back, a round stool's top)
triangulated finely (a constrained Delaunay of the outline and a grid inside it) as two pieces sewn round their border,
filled by pressure firm between the floor and a ceiling at its thickness (a pad's foam: `thick`; `fill` how firm),
then let go and settled by gravity onto what it sits on (its bottom flat there); the seam's puckers and soft wrinkles drawn into the dense copy; then a coarse
triangulation of the same outline takes the dense one's shape by its flat place (each coarse point found in the dense
flat sheet and moved where that point went: no retopology), and the dense one is baked onto it. A seat pad of a few
hundred triangles with its puff, its seam and its folds in its maps. Ties round the posts as loops with two tails.
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N
from .. import sim


def _area(poly):
    x, y = poly[:, 0], poly[:, 1]
    return 0.5 * abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))))


def _border_dist(pts, ring):
    """Each point's distance to the closed outline."""
    a, b = ring, np.roll(ring, -1, 0)
    ab = b - a
    L2 = np.maximum((ab ** 2).sum(1), 1e-30)
    out = np.empty(len(pts))
    for i in range(0, len(pts), 1024):
        p = pts[i:i + 1024, None, :]
        t = np.clip(((p - a[None]) * ab[None]).sum(2) / L2[None], 0, 1)
        out[i:i + 1024] = np.linalg.norm(p - (a[None] + t[..., None] * ab[None]), axis=2).min(1)
    return out


def flat_bag(outline, step):
    """The outline's flat sheet: (points (n, 2): the border's first, then the inside; triangles; the border's count)."""
    ring = M.resample_loop(outline, step)
    inner = M._fill_points([ring], step)
    tris = np.array(M._cdt([ring], inner), np.int64)
    P2 = np.concatenate([ring, inner]) if len(inner) else ring
    return P2, tris, len(ring)


def _two_pieces(P2, T, nb):
    """The bag's two pieces on one flat: the top all its points, the bottom its inside again, the border shared:
    (bottom's index for each flat point, the top's and the bottom's triangles, outward)."""
    n = len(P2)
    bot = np.arange(n)
    bot[nb:] = n + np.arange(n - nb)
    a, b, c = P2[T[:, 0]], P2[T[:, 1]], P2[T[:, 2]]
    up = ((b - a)[:, 0] * (c - a)[:, 1] - (b - a)[:, 1] * (c - a)[:, 0]) > 0
    Tt = np.where(up[:, None], T, T[:, ::-1])               # the top's faces up (anticlockwise seen from above)
    Tb = bot[Tt][:, ::-1]                                    # the bottom's down
    return bot, Tt, Tb


def _locate(P2, T, q):
    """For each point q (m, 2) the triangle of T it lies in (the most inside one) and its barycentric weights."""
    a, b, c = P2[T[:, 0]], P2[T[:, 1]], P2[T[:, 2]]
    v0, v1 = b - a, c - a
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    den = np.where(np.abs(d00 * d11 - d01 * d01) < 1e-30, 1e-30, d00 * d11 - d01 * d01)
    tri = np.empty(len(q), np.int64)
    w = np.empty((len(q), 3))
    for i in range(0, len(q), 128):
        v2 = q[i:i + 128, None, :] - a[None]
        d20, d21 = (v2 * v0[None]).sum(2), (v2 * v1[None]).sum(2)
        vv = (d11[None] * d20 - d01[None] * d21) / den[None]
        ww = (d00[None] * d21 - d01[None] * d20) / den[None]
        uu = 1 - vv - ww
        worst = np.minimum(np.minimum(uu, vv), ww)
        k = np.argmax(worst, axis=1)
        tri[i:i + 128] = k
        r = np.arange(len(k))
        w[i:i + 128] = np.stack([uu[r, k], vv[r, k], ww[r, k]], 1)
    return tri, np.clip(w, 0, 1) / np.maximum(np.clip(w, 0, 1).sum(1, keepdims=True), 1e-12)


def make(outline, thick, seed, isl_top, isl_bot, fill=0.75, step=0.012, step_lo=0.045, stiff=0.004, mat="fabric", detail=1.0):
    """A cushion of the outline (k, 2 metres, anticlockwise, round its middle), about `thick` metres thick, its bottom
    flat on z = 0: (the game mesh, the detailed mesh, its top's height at the middle). UVs: both faces from above over
    the outline's box (the bottom mirrored)."""
    r = np.random.default_rng(seed * 7717 + 3)
    outline = np.asarray(outline, float)
    P2, T, nb = flat_bag(outline, step)
    n = len(P2)
    bot, Tt, Tb = _two_pieces(P2, T, nb)
    d = _border_dist(P2, outline)
    bump = 1 - np.exp(-d / 0.02)
    bulge = min(0.012, thick * 0.3)
    V = np.concatenate([np.c_[P2, bulge * bump], np.c_[P2[nb:], -bulge * bump[nb:]]])
    flat = V[:, :2].copy()
    sep = np.concatenate([np.c_[P2, np.zeros(n)], np.c_[P2[nb:], np.ones(n - nb)]])
    cl = sim.Cloth(V + r.normal(0, 0.0012, V.shape), np.concatenate([Tt, Tb]), flat, stiff=stiff, sep=sep)
    # filled firm between the floor and a ceiling at its thickness (a pad's foam): its top and bottom pressed flat,
    # its sides bulging round the seam; then let go to settle, keeping its filling
    vol = _area(outline) * thick * (0.55 + 0.4 * float(np.clip(fill, 0, 1)))
    ceil = [((-10.0, -10.0, thick * 0.4), (10.0, 10.0, 10.0), 0.0)]                 # it rises a little when let go
    for k in range(280):
        p = 0.0018 * float(np.clip(1 - cl.volume() / vol, 0, 1)) ** 0.5
        cl.step(pressure=p, damping=0.6, iters=16, boxes=ceil, floor=-thick * 0.4, friction=0.3, collide=True)
    sim.settle(cl, steps=60, gravity=0.0002, floor=float(cl.X[:, 2].min()), friction=0.6, pressure=0.0018, volume=vol)
    X = cl.X - np.array([0.0, 0.0, float(cl.X[:, 2].min())])
    # the detail: soft wrinkles, the seam's puckers round the border, faded to nothing at the seam itself so the two
    # pieces still meet; along each point's normal
    nrm = cl.normals(X)
    allP2 = np.concatenate([P2, P2[nb:]])
    dd = np.concatenate([d, d[nb:]])
    ang = np.arctan2(allP2[:, 1] - outline[:, 1].mean(), allP2[:, 0] - outline[:, 0].mean())
    q = np.c_[allP2 / 0.045, np.full(len(allP2), seed * 0.3)]
    wr = (N.ridged3(q, seed + 61, 2) - 0.5) * 0.0011 + N.fbm3(q * 0.4, seed + 62, 2) * 0.0007
    perim = float(np.linalg.norm(np.diff(np.concatenate([outline, outline[:1]]), axis=0), axis=1).sum())
    pk = np.sin(ang * max(8.0, perim / 0.05) + seed) * 0.0016 * np.exp(-((dd - 0.012) / 0.01) ** 2)
    fade = np.clip(dd / 0.006, 0, 1)
    Xh = X + nrm * ((wr + pk) * fade * detail)[:, None]
    # the game mesh: the same outline coarsely, each point where the dense one's same flat place went
    Q2, TQ, nq = flat_bag(outline, step_lo)
    botq, Qt, Qb = _two_pieces(Q2, TQ, nq)
    ti, w = _locate(P2, Tt, Q2)
    top_pos = (X[Tt[ti]] * w[..., None]).sum(1)
    tb, wb = _locate(P2, Tt, Q2[nq:])
    bot_pos = (X[bot[Tt[tb]]] * wb[..., None]).sum(1)
    VL = np.concatenate([top_pos, bot_pos])
    lo, hi_ = outline.min(0), outline.max(0)
    span = np.maximum(hi_ - lo, 1e-6)

    def mesh(Vv, P, Ttop, Tbot, nb_):
        uvt = (P[Ttop] - lo) / span
        uvb = (P[np.where(Tbot >= len(P), Tbot - len(P) + nb_, Tbot)] - lo) / span
        F = np.concatenate([np.c_[Ttop, np.full(len(Ttop), -1)], np.c_[Tbot, np.full(len(Tbot), -1)]])
        UV = np.zeros((len(F), 4, 2))
        UV[:len(Ttop), :3] = isl_top.to_uv(uvt[..., 0], uvt[..., 1])
        UV[len(Ttop):, :3] = isl_bot.to_uv(1 - uvb[..., 0], uvb[..., 1])
        m = M.Mesh(Vv, F, UV, mats=[mat])
        m.a["rest"] = np.c_[np.concatenate([P, P[nb_:]]), np.zeros(len(Vv))]
        return m
    low = mesh(VL, Q2, Qt, Qb, nq)
    high = mesh(Xh, P2, Tt, Tb, nb)
    mid = np.argmin(np.linalg.norm(P2 - outline.mean(0), axis=1))
    return low, high, float(X[mid, 2])


def tie(centre, half, z, side, isl, mat="fabric"):
    """A cushion's tie round a post: a loop round its section (half: its half width, metres) at height z and two tails
    hanging from the loop's front, leaning to `side` (+1 or -1 in x)."""
    a = np.linspace(0, 2 * math.pi, 13)
    rr = half + 0.006
    loop = np.stack([centre[0] + np.cos(a) * rr, centre[1] + np.sin(a) * rr, np.full(13, z)], 1)
    front = np.array([centre[0], centre[1] - rr, z])
    parts = [M.tube(loop, 0.0035, isl, n=5, mat=mat)]
    for k, dx in enumerate((0.012, -0.004)):
        path = np.array([front, front + [side * dx * 0.5, -0.008, -0.03], front + [side * dx, -0.012 - 0.004 * k, -0.07 - 0.015 * k]])
        parts.append(M.tube(path, np.array([0.004, 0.0035, 0.003]), isl, n=5, mat=mat))
    m = M.join(parts)
    m.a["rest"] = m.v.copy()
    return m
