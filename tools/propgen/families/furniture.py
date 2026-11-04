"""Furniture's parts, shared by the table and chair families (PROPGEN §23, §24; docs/research/tables_chairs.md).

Each part is built from numbers twice, rounded for the detailed copy and chamfered once for the game mesh (the bevels
and the parts' contact shadows baked from the one onto the other; the game mesh's normals weighted by face size), and
unwrapped as the plank it was cut from: its island's x along its grain, every island at the material's one density,
so a wood set of your own laid over the material (the recipe's `pbr`) runs along each leg, rail and board.

- `board`: a box along its own x with its long edges rounded (a section `w` by `h`, `r` its rounding), tapered from
  its foot (a Shaker leg: about a corner, the outer faces kept plumb), turned and placed;
- `turned`: a profile turned round its own x (a turned leg, a spindle, a pedestal's column);
- `top`: a flat top from its plan's outline (rect, rounded, round, oval) and its edge's profile (square, eased,
  chamfer, round, bullnose, underbevel), the band round it in islands of a side and a corner each.

The wood's paint (`paint_wood`): its colour (the prop generator's wood_grain design, rings along the island's x) and
its flaws as relief and roughness only (`flaws`: grain, cracks, scratches, dents, each 0 to 1), so they stay under a
set laid over the colour.
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N
from ..paint import rrect_poly

FINISH = {"raw": 0.82, "oil": 0.55, "satin": 0.42, "gloss": 0.2, "paint": 0.5}


def rot(*turns):
    """A 3x3 rotation from turns (axis letter, degrees) applied in order."""
    R = np.eye(3)
    for ax, deg in turns:
        a = math.radians(deg)
        c, s = math.cos(a), math.sin(a)
        Q = {"x": [[1, 0, 0], [0, c, -s], [0, s, c]], "y": [[c, 0, s], [0, 1, 0], [-s, 0, c]], "z": [[c, -s, 0], [s, c, 0], [0, 0, 1]]}[ax]
        R = np.array(Q) @ R
    return R


UP = rot(("y", -90))            # a part built along x stood up along z (its x end 0 at the bottom)


def _orient(V, F, UV, inside):
    """Faces turned to face away from `inside(face centres) -> points`: each face's corners reversed where its normal
    points back."""
    P = V[np.maximum(F, 0)]
    a, b, c = P[:, 0], P[:, 1], P[:, 2]
    n = np.cross(b - a, c - a)
    cen = np.where((F >= 0)[..., None], P, 0).sum(1) / (F >= 0).sum(1, keepdims=True)
    back = (n * (cen - inside(cen))).sum(1) < 0
    for i in np.nonzero(back)[0]:
        k = int((F[i] >= 0).sum())
        F[i, :k] = F[i, :k][::-1].copy()
        UV[i, :k] = UV[i, :k][::-1].copy()
    return F, UV


def _mesh(V, F, UV, mat):
    m = M.Mesh(V, F, UV, mats=[mat])
    m.a["rest"] = m.v.copy()
    return m


def _cap(ring, centre, isl, uvf):
    """A fan closing a loop round its centre: (vertices, faces as triangles padded to quads, uv)."""
    k = len(ring)
    V = np.concatenate([ring, centre[None]])
    F = np.array([[i, (i + 1) % k, k, -1] for i in range(k)], np.int64)
    uv = np.zeros((k, 4, 2))
    for i in range(k):
        for j, vi in enumerate(F[i, :3]):
            uv[i, j] = isl.to_uv(*uvf(V[vi]))
    return V, F, uv


def board(p, isl, hi):
    """A board along its own x (0 to L), its section w (y) by h (z) rounded by r: four steps round each long edge in
    the detailed copy, one (a chamfer) in the game mesh; its ends capped. Sides on island `name` (x along L, y round
    the section), the ends on `name_a` (x = 0) and `name_b`."""
    L, w, h, r = p["L"], p["w"], p["h"], p["r"]
    n = 4 if hi else 1
    sec = rrect_poly(-w / 2, -h / 2, w, h, max(min(r, w * 0.45, h * 0.45), 2e-4), n=n)
    k = len(sec)
    s0, s1 = p.get("taper", (1.0, 1.0))
    anc = np.asarray(p.get("anchor", (0.0, 0.0)), float)
    rings = []
    for x, sc in ((0.0, s0), (L, s1)):
        q = anc + (sec - anc) * sc
        rings.append(np.concatenate([np.full((k, 1), x), q], 1))
    V = np.concatenate(rings)
    per = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(np.concatenate([sec, sec[:1]]), axis=0), axis=1))])
    bt = per / per[-1]
    F, UV = [], []
    S = isl[p["name"]]
    for i in range(k):
        j = (i + 1) % k
        F.append([i, j, k + j, k + i])
        b0, b1 = bt[i], bt[i + 1]
        UV.append([S.to_uv(0.0, b0), S.to_uv(0.0, b1), S.to_uv(1.0, b1), S.to_uv(1.0, b0)])
    F, UV = np.array(F, np.int64), np.array(UV)

    def axis(c):
        return np.stack([c[:, 0], np.zeros(len(c)), np.zeros(len(c))], 1)

    F, UV = _orient(V, F, UV, axis)
    parts = [_mesh(V, F, UV, p["mat"])]
    for end, x in (("_a", 0), ("_b", 1)):
        ring = rings[x]
        ce = ring.mean(0)
        sy, sz = max(np.ptp(ring[:, 1]), 1e-6), max(np.ptp(ring[:, 2]), 1e-6)
        y0, z0 = ring[:, 1].min(), ring[:, 2].min()
        cv, cf, cu = _cap(ring, ce, isl[p["name"] + end], lambda q: ((q[1] - y0) / sy, (q[2] - z0) / sz))
        sgn = -1.0 if x == 0 else 1.0
        cf, cu = _orient(cv, cf, cu, lambda c: c - np.array([sgn, 0.0, 0.0]))
        parts.append(_mesh(cv, cf, cu, p["mat"]))
    m = M.join(parts)
    m.v = m.v @ np.asarray(p["R"], float).T + np.asarray(p["at"], float)
    m.a["rest"] = m.v.copy()
    return m


def turned(p, isl, hi):
    """A profile turned round its own x: `prof` [(x, radius)] from 0 to L; 16 round (10 in the game mesh), the radius
    smoothed between its points; capped where it's thick. Its island: x along L, y round it."""
    prof = np.asarray(p["prof"], float)
    L = float(prof[-1, 0])
    rmax = float(prof[:, 1].max())
    n = 18 if hi else (10 if rmax > 0.012 else 8)
    xs = np.linspace(0, L, 64 if hi else int(np.clip(L / 0.04, 6, 24))) if p.get("smooth", True) else prof[:, 0]
    rs = np.interp(xs, prof[:, 0], prof[:, 1])
    if p.get("smooth", True):
        rs = np.convolve(np.pad(rs, 2, mode="edge"), np.ones(5) / 5, mode="valid")
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    V = np.concatenate([np.stack([np.full(n, x), r * np.cos(a), r * np.sin(a)], 1) for x, r in zip(xs, rs)])
    S = isl[p["name"]]
    F, UV = [], []
    for j in range(len(xs) - 1):
        for i in range(n):
            i1 = (i + 1) % n
            F.append([j * n + i, j * n + i1, (j + 1) * n + i1, (j + 1) * n + i])
            ua, ub = xs[j] / L, xs[j + 1] / L
            va, vb = i / n, (i + 1) / n
            UV.append([S.to_uv(ua, va), S.to_uv(ua, vb), S.to_uv(ub, vb), S.to_uv(ub, va)])
    F, UV = np.array(F, np.int64), np.array(UV)
    F, UV = _orient(V, F, UV, lambda c: np.stack([c[:, 0], np.zeros(len(c)), np.zeros(len(c))], 1))
    parts = [_mesh(V, F, UV, p["mat"])]
    for end, j in (("_a", 0), ("_b", len(xs) - 1)):
        if rs[j] < 0.003:
            continue
        ring = V[j * n:(j + 1) * n]
        r0 = rs[j]
        cv, cf, cu = _cap(ring, ring.mean(0), isl[p["name"] + end], lambda q: (0.5 + q[1] / (2 * r0), 0.5 + q[2] / (2 * r0)))
        sgn = -1.0 if j == 0 else 1.0
        cf, cu = _orient(cv, cf, cu, lambda c: c - np.array([sgn, 0.0, 0.0]))
        parts.append(_mesh(cv, cf, cu, p["mat"]))
    m = M.join(parts)
    m.v = m.v @ np.asarray(p["R"], float).T + np.asarray(p["at"], float)
    m.a["rest"] = m.v.copy()
    return m


def bent(p, isl, hi):
    """A round part bent along a path (bentwood, a steel tube): `path` (k, 3) points it passes through (smoothed),
    radius `rad` (or [at its start, at its end]: a bentwood leg thinning to its foot); rings round it framed by
    parallel transport, capped at its ends unless `closed`. Its island: x along its length, y round it."""
    P0 = np.asarray(p["path"], float)
    closed = bool(p.get("closed", False))
    r0, r1 = _radii(p["rad"])
    rad = max(r0, r1)
    step = max(rad * (1.2 if hi else 3.5), 0.006)
    if closed:
        Q = M.spline(np.concatenate([P0[-2:], P0, P0[:2]]), step)
        L0 = np.linalg.norm(np.diff(np.concatenate([P0[-2:], P0[:1]]), axis=0), axis=1).sum()
        cum = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(Q, axis=0), axis=1))])
        Q = Q[(cum >= L0 - 1e-9) & (cum <= cum[-1] - (np.linalg.norm(np.diff(np.concatenate([P0[-1:], P0[:2]]), axis=0), axis=1).sum()) + 1e-9)]
        if np.linalg.norm(Q[0] - Q[-1]) < step * 0.5:
            Q = Q[:-1]
    else:
        Q = M.spline(P0, step)
    n = 14 if hi else 8
    k = len(Q)
    Tn = np.gradient(Q, axis=0)
    if closed:
        Tn = np.roll(Q, -1, 0) - np.roll(Q, 1, 0)
    Tn /= np.maximum(np.linalg.norm(Tn, axis=1, keepdims=True), 1e-12)
    up = np.array([0.0, 0.0, 1.0]) if abs(Tn[0, 2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    Nn = np.zeros_like(Q)
    nv = np.cross(Tn[0], up)
    for i in range(k):
        nv = nv - (nv @ Tn[i]) * Tn[i]
        nv /= max(np.linalg.norm(nv), 1e-12)
        Nn[i] = nv
    Bn = np.cross(Tn, Nn)
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    seg = np.linalg.norm(np.diff(np.concatenate([Q, Q[:1]]) if closed else Q, axis=0), axis=1)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    Ltot = max(cum[-1], 1e-9)
    rr = r0 + (r1 - r0) * (cum[:k] / (cum[k - 1] if k > 1 and cum[k - 1] > 0 else 1.0))
    V = (Q[:, None, :] + rr[:, None, None] * (np.cos(a)[None, :, None] * Nn[:, None, :] + np.sin(a)[None, :, None] * Bn[:, None, :])).reshape(-1, 3)
    S = isl[p["name"]]
    F, UV = [], []
    for j in range(k if closed else k - 1):
        j1 = (j + 1) % k
        for i in range(n):
            i1 = (i + 1) % n
            F.append([j * n + i, j * n + i1, j1 * n + i1, j1 * n + i])
            ua, ub = cum[j] / Ltot, cum[j + 1] / Ltot
            UV.append([S.to_uv(ua, i / n), S.to_uv(ua, (i + 1) / n), S.to_uv(ub, (i + 1) / n), S.to_uv(ub, i / n)])
    F, UV = np.array(F, np.int64), np.array(UV)
    F, UV = _orient(V, F, UV, lambda c: _nearest(Q, c))
    parts = [_mesh(V, F, UV, p["mat"])]
    if not closed:
        for end, j in (("_a", 0), ("_b", k - 1)):
            ring = V[j * n:(j + 1) * n]
            cv, cf, cu = _cap(ring, Q[j], isl[p["name"] + end], lambda q, j=j: (0.5 + (q - Q[j]) @ Nn[j] / (2 * rr[j]), 0.5 + (q - Q[j]) @ Bn[j] / (2 * rr[j])))
            sgn = -1.0 if j == 0 else 1.0
            cf, cu = _orient(cv, cf, cu, lambda c, j=j, sgn=sgn: c - sgn * Tn[j])
            parts.append(_mesh(cv, cf, cu, p["mat"]))
    m = M.join(parts)
    m.v = m.v @ np.asarray(p["R"], float).T + np.asarray(p["at"], float)
    m.a["rest"] = m.v.copy()
    return m


def _radii(rad):
    """A bent part's radius at its start and its end: one number for both, or a pair."""
    if isinstance(rad, (list, tuple, np.ndarray)):
        return float(rad[0]), float(rad[-1])
    return float(rad), float(rad)


def _nearest(Q, c):
    """Each point of c's nearest point on the path Q (its axis, for turning faces outward)."""
    out = np.empty_like(c)
    for i in range(0, len(c), 512):
        d = ((c[i:i + 512, None, :] - Q[None, :, :]) ** 2).sum(-1)
        out[i:i + 512] = Q[np.argmin(d, axis=1)]
    return out


def _rounded_quad(C, rr, nc):
    """A convex quad's corners (4, 2, anticlockwise) each rounded by a fillet of radius rr, a side's middle after each
    corner: (points, the middles' indices)."""
    pts, cuts = [], []
    for i in range(4):
        c, a, b = C[i], C[i - 1], C[(i + 1) % 4]
        u, v = (a - c) / np.linalg.norm(a - c), (b - c) / np.linalg.norm(b - c)
        th = math.acos(float(np.clip(u @ v, -1, 1)))
        d = rr / math.tan(th / 2)
        p0, p1 = c + u * d, c + v * d
        bis = (u + v) / np.linalg.norm(u + v)
        ce = c + bis * rr / math.sin(th / 2)
        a0, a1 = math.atan2(*(p0 - ce)[::-1]), math.atan2(*(p1 - ce)[::-1])
        if a1 < a0:
            a1 += 2 * math.pi
        for t in np.linspace(a0, a1, nc + 1):
            pts.append(ce + rr * np.array([math.cos(t), math.sin(t)]))
        nb = C[(i + 1) % 4]
        nxt = (nb - C[(i + 2) % 4]) / np.linalg.norm(nb - C[(i + 2) % 4])
        th2 = math.acos(float(np.clip(((c - nb) / np.linalg.norm(c - nb)) @ nxt, -1, 1)))
        q0 = nb + (c - nb) / np.linalg.norm(c - nb) * rr / math.tan(th2 / 2)
        cuts.append(len(pts))
        pts.append((p1 + q0) / 2)
    return np.array(pts), cuts


def outline(shape, L, W, rc, o, hi, back=1.0):
    """A top's plan inset by o (metres), anticlockwise: (points, the indices where its band's islands part). A
    "trapezoid" (a chair's seat) is L wide at its front (-y), back * L at its back."""
    if shape == "trapezoid":
        hf, hb, hd = L / 2, back * L / 2, W / 2
        C = np.array([[hf, -hd], [hb, hd], [-hb, hd], [-hf, -hd]], float)
        # each side moved in by o: the corners along their bisectors
        n_ = []
        for i in range(4):
            e = C[(i + 1) % 4] - C[i]
            n_.append(np.array([e[1], -e[0]]) / np.linalg.norm(e))     # outward normal (anticlockwise)
        Ci = []
        for i in range(4):
            na, nb = n_[i - 1], n_[i]
            m = na + nb
            Ci.append(C[i] - m / max(m @ nb, 1e-6) * o)
        return _rounded_quad(np.array(Ci), max(rc - o, 0.0015), 6 if hi else 2)
    if shape in ("round", "oval"):
        n = 96 if hi else 40
        ang = math.pi / 4 + np.arange(n) * 2 * math.pi / n
        pts = np.stack([(L / 2 - o) * np.cos(ang), (W / 2 - o) * np.sin(ang)], 1)
        return pts, [0, n // 4, n // 2, 3 * n // 4]
    rr = max((rc if shape == "rounded" else 0.004) - o, 0.0015)
    nc = 6 if hi else 2
    w, d = L - 2 * o, W - 2 * o
    pts, cuts = [], []
    corners = ((w / 2 - rr, -d / 2 + rr, -90), (w / 2 - rr, d / 2 - rr, 0), (-w / 2 + rr, d / 2 - rr, 90), (-w / 2 + rr, -d / 2 + rr, 180))
    for ci, (cx, cy, a0) in enumerate(corners):
        for k in range(nc + 1):
            a = math.radians(a0 + 90 * k / nc)
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        nx_, ny_ = corners[(ci + 1) % 4][:2]
        a1 = math.radians(a0 + 90)
        b0 = (cx + rr * math.cos(a1), cy + rr * math.sin(a1))
        a2 = math.radians(corners[(ci + 1) % 4][2])
        b1 = (nx_ + rr * math.cos(a2), ny_ + rr * math.sin(a2))
        cuts.append(len(pts))
        pts.append(((b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2))       # the side's middle: where an island ends
    return np.array(pts), cuts


def edge_profile(edge, t, hi):
    """A top's edge from its bottom up as (inset, z) metres: square, eased, chamfer, round, bullnose, underbevel; arcs
    in five steps in the detailed copy, one (a chamfer) in the game mesh."""
    st = 5 if hi else 1

    def arc_bottom(r):        # from (r, 0) round to (0, r)
        return [(r - r * math.sin(f), r - r * math.cos(f)) for f in np.linspace(0, math.pi / 2, st + 1)]

    def arc_top(r, z1):       # from (0, z1 - r) round to (r, z1)
        return [(r - r * math.cos(f), z1 - r + r * math.sin(f)) for f in np.linspace(0, math.pi / 2, st + 1)]
    e = 0.0015
    if edge == "square":
        return [(e, 0.0), (0.0, e), (0.0, t - e), (e, t)]
    if edge == "eased":
        r = min(0.003, t / 3)
        return arc_bottom(r) + arc_top(r, t)
    if edge == "chamfer":
        c1, c0 = min(0.006, t / 3), min(0.003, t / 4)
        return [(c0, 0.0), (0.0, c0), (0.0, t - c1), (c1, t)]
    if edge == "round":
        r1, r0 = min(0.6 * t, 0.016), min(0.002, t / 4)
        return arc_bottom(r0) + arc_top(r1, t)
    if edge == "bullnose":
        r = t / 2
        return [(r - r * math.sin(f), r - r * math.cos(f)) for f in np.linspace(0, math.pi, 2 * st + 1)]
    if edge == "underbevel":
        b, r = min(0.9 * t, 0.022), min(0.002, t / 5)
        return [(b, 0.0), (0.0, 0.5 * t)] + arc_top(r, t)
    raise ValueError(f"top edge {edge!r}: square, eased, chamfer, round, bullnose or underbevel")


def top(p, isl, hi):
    """A flat top: its outline inset along its edge's profile, ring by ring from the bottom up, the band round it in
    four islands (`name_e0`..`name_e3`, each a side's half, a corner and the next side's half), the top face on
    `name_top`, the underside on `name_bot` (both from above: x along the top's length, its grain)."""
    L, W, t = p["L"], p["W"], p["t"]
    prof = edge_profile(p.get("edge", "eased"), t, hi)
    rings, cuts = [], None
    for o, z in prof:
        pts, cuts = outline(p.get("shape", "rect"), L, W, p.get("rc", 0.05), o, hi, p.get("back", 1.0))
        rings.append(np.concatenate([pts, np.full((len(pts), 1), z)], 1))
    k = len(rings[0])
    V = np.concatenate(rings)
    outer = min(range(len(prof)), key=lambda j: prof[j][0])
    seg = np.linalg.norm(np.diff(np.concatenate([rings[outer], rings[outer][:1]]), axis=0), axis=1)
    pz = np.array(prof)
    pv = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(pz, axis=0), axis=1))])
    pv /= max(pv[-1], 1e-9)
    piece = np.zeros(k, int)
    for q in range(4):
        a0, a1 = cuts[q], cuts[(q + 1) % 4]
        idx = [(a0 + s) % k for s in range((a1 - a0) % k or k)]
        piece[idx] = q
    pstart = {q: cuts[q] for q in range(4)}
    plen = {q: max(sum(seg[(cuts[q] + s) % k] for s in range((cuts[(q + 1) % 4] - cuts[q]) % k or k)), 1e-6) for q in range(4)}
    along = np.zeros(k)
    for q in range(4):
        acc = 0.0
        for s in range((cuts[(q + 1) % 4] - cuts[q]) % k or k):
            i = (pstart[q] + s) % k
            along[i] = acc
            acc += seg[i]
    F, UV = [], []
    for j in range(len(prof) - 1):
        for i in range(k):
            i1 = (i + 1) % k
            q = piece[i]
            S = isl[f"{p['name']}_e{q}"]
            ua, ub = along[i] / plen[q], (along[i] + seg[i]) / plen[q]
            F.append([j * k + i, j * k + i1, (j + 1) * k + i1, (j + 1) * k + i])
            UV.append([S.to_uv(ua, pv[j]), S.to_uv(ub, pv[j]), S.to_uv(ub, pv[j + 1]), S.to_uv(ua, pv[j + 1])])
    F, UV = np.array(F, np.int64), np.array(UV)
    F, UV = _orient(V, F, UV, lambda c: np.stack([np.zeros(len(c)), np.zeros(len(c)), c[:, 2]], 1))
    parts = [_mesh(V, F, UV, p["mat"])]
    for nm, ring, sgn in (("_bot", rings[0], -1.0), ("_top", rings[-1], 1.0)):
        cv, cf, cu = _cap(ring, np.array([0.0, 0.0, ring[0, 2]]), isl[p["name"] + nm], lambda q: ((q[0] + L / 2) / L, (q[1] + W / 2) / W))
        cf, cu = _orient(cv, cf, cu, lambda c: c - np.array([0.0, 0.0, sgn]))
        parts.append(_mesh(cv, cf, cu, p["mat"]))
    m = M.join(parts)
    m.v = m.v + np.asarray(p["at"], float)
    m.a["rest"] = m.v.copy()
    return m


class Plan:
    """A piece of furniture's parts, declared first (their islands made on the Thing and packed together), built after
    twice (the detailed copy and the game mesh)."""

    def __init__(self, th, mat="wood"):
        self.th, self.mat, self.parts = th, mat, []

    def board(self, name, L, w, h, R=None, at=(0, 0, 0), r=0.004, taper=(1.0, 1.0), anchor=(0.0, 0.0), mat=None, kind="board"):
        self.parts.append(dict(part="board", name=name, L=L, w=w, h=h, R=np.eye(3) if R is None else R, at=at, r=r, taper=taper,
                               anchor=anchor, mat=mat or self.mat, kind=kind))

    def turned(self, name, prof, R=None, at=(0, 0, 0), mat=None, kind="turned", smooth=True):
        self.parts.append(dict(part="turned", name=name, prof=prof, R=np.eye(3) if R is None else R, at=at, mat=mat or self.mat,
                               kind=kind, smooth=smooth))

    def top(self, name, shape, L, W, t, edge="eased", rc=0.05, at=(0, 0, 0), mat=None, back=1.0, kind="top"):
        self.parts.append(dict(part="top", name=name, shape=shape, L=L, W=W, t=t, edge=edge, rc=rc, at=at, mat=mat or self.mat, kind=kind,
                               back=back))

    def bent(self, name, path, rad, R=None, at=(0, 0, 0), closed=False, mat=None, kind="turned"):
        self.parts.append(dict(part="bent", name=name, path=np.asarray(path, float), rad=rad, R=np.eye(3) if R is None else R, at=at,
                               closed=closed, mat=mat or self.mat, kind=kind))

    def islands(self):
        """Every part's islands on the Thing (mm), their kinds for the paint: {island: kind}."""
        th, kinds = self.th, {}
        for p in self.parts:
            nm = p["name"]
            if p["part"] == "board":
                per = 2 * (p["w"] + p["h"])
                th.island(nm, p["L"] * 1000, per * 1000, mat=p["mat"])
                kinds[nm] = p["kind"]
                for e in ("_a", "_b"):
                    th.island(nm + e, p["w"] * 1000, p["h"] * 1000, mat=p["mat"])
                    kinds[nm + e] = "end"
            elif p["part"] == "bent":
                Lp = float(np.linalg.norm(np.diff(p["path"], axis=0), axis=1).sum()) + (float(np.linalg.norm(p["path"][0] - p["path"][-1])) if p["closed"] else 0.0)
                rmax = max(_radii(p["rad"]))
                th.island(nm, Lp * 1000, 2 * math.pi * rmax * 1000, mat=p["mat"])
                kinds[nm] = p["kind"]
                if not p["closed"]:
                    for e in ("_a", "_b"):
                        th.island(nm + e, 2 * rmax * 1000, 2 * rmax * 1000, mat=p["mat"])
                        kinds[nm + e] = "end"
            elif p["part"] == "turned":
                rmax = max(r for _, r in p["prof"])
                th.island(nm, p["prof"][-1][0] * 1000, 2 * math.pi * rmax * 1000, mat=p["mat"])
                kinds[nm] = p["kind"]
                for e in ("_a", "_b"):
                    th.island(nm + e, 2 * rmax * 1000, 2 * rmax * 1000, mat=p["mat"])
                    kinds[nm + e] = "end"
            else:
                L, W, t = p["L"], p["W"], p["t"]
                th.island(nm + "_top", L * 1000, W * 1000, mat=p["mat"])
                th.island(nm + "_bot", L * 300, W * 300, mat=p["mat"])   # the underside: seldom seen, a third the density
                kinds[nm + "_top"], kinds[nm + "_bot"] = (p["kind"] if p["kind"] != "top" else "top"), "under"
                prof_len = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(edge_profile(p["edge"], t, True), edge_profile(p["edge"], t, True)[1:]))
                for q in range(4):
                    side = (L + W) / 2 if p["shape"] not in ("round", "oval") else math.pi * (L + W) / 8
                    th.island(f"{nm}_e{q}", side * 1000, max(prof_len, 0.004) * 1000, mat=p["mat"])
                    kinds[f"{nm}_e{q}"] = "edge"
        return kinds

    def build(self, hi, isl):
        out = []
        for p in self.parts:
            out.append({"board": board, "turned": turned, "top": top, "bent": bent}[p["part"]](p, isl, hi))
        return M.join(out)


# ---- the wood's paint: its colour and its flaws as relief ---------------------------------------------------------

def _segment(X, Y, a, b, width):
    """A soft line from a to b (mm) on the island's grid: 1 on it, 0 a half width off it."""
    d = np.asarray(b, float) - np.asarray(a, float)
    L = max(np.hypot(*d), 1e-6)
    ux, uy = d / L
    px, py = X - a[0], Y - a[1]
    t = np.clip(px * ux + py * uy, 0, L)
    dist = np.hypot(px - t * ux, py - t * uy)
    return np.clip(1 - dist / max(width / 2, 1e-3), 0, 1)


def wood_color(f, kind, d, rng, seed):
    """A wooden island's colour: flat-sawn (the board cut at a slant through the log: its growth rings as arches along
    the grain, x), or end grain (rings round the pith); late wood darker and a little glossier, fibres along the grain,
    a slow change of tone; the rings never finer than the texture can show. Returns the late wood's share (for the
    relief)."""
    from ..paint import rgb
    X, Y = f.grid()
    X = X.astype(np.float32)
    Y = Y.astype(np.float32)
    base = np.asarray(rgb(d.get("wood", "#8a5a36")), np.float32)
    light, dark = np.clip(base * 1.16, 0, 1), base * 0.6
    ring = max(float(d.get("ring", 5.0)), 4.0 / max(f.s, 1e-3))
    s0 = seed * 0.37
    wy = 9.0 * N.fbm3(np.stack([X / 170.0, Y / 45.0, np.full_like(X, s0)], -1), seed + 51, 3)
    if kind == "end":
        cx, cy = f.W * rng.uniform(-0.4, 1.4), f.H * rng.uniform(-0.4, 1.4)
        r = np.hypot(X - cx, Y - cy) + 0.3 * wy
    else:
        # a wide face is glued up from boards 12 to 22 cm wide, each cut from its own log: its heart's line, how deep
        # the cut ran under it (shallow: the cathedral arches) and its own tone
        bounds = [0.0]
        while bounds[-1] < f.H:
            bounds.append(bounds[-1] + (rng.uniform(120, 220) if kind in ("top", "under", "seat") else f.H + 1))
        nb = len(bounds) - 1
        bi = np.clip(np.searchsorted(np.array(bounds[1:-1]), Y), 0, nb - 1)
        bw = np.diff(bounds)
        yp = (np.array(bounds[:-1]) + bw * rng.uniform(-0.3, 1.3, nb))[bi]
        z0 = rng.uniform(8, 45, nb)[bi] if kind in ("top", "under", "seat") else rng.uniform(150, 400) if kind == "edge" else rng.uniform(25, 140)
        slope = rng.uniform(-0.05, 0.05, nb)[bi] if kind in ("top", "under", "seat") else rng.uniform(-0.06, 0.06)
        zx = z0 + slope * (X - f.W / 2) + 5.0 * N.fbm3(np.stack([X / 260.0, Y / 300.0, np.full_like(X, s0 + 3)], -1), seed + 52, 2)
        r = np.sqrt((Y + wy - yp) ** 2 + zx * zx)
        if kind == "edge":                                  # a top's edge: its edge grain, straight along it
            r = Y + 0.4 * wy + 37.0
        if nb > 1:
            base = base[None, None] * (1 + rng.uniform(-0.07, 0.07, nb)[bi][..., None]).astype(np.float32)
            light, dark = np.clip(base * 1.16, 0, 1), base * 0.6
    fr = np.mod(r / ring, 1.0)
    late = (np.clip((fr - 0.62) / 0.18, 0, 1) - np.clip((fr - 0.9) / 0.1, 0, 1)).astype(np.float32)
    late = late * late * (3 - 2 * late)
    fib = N.fbm3(np.stack([X / 140.0, Y / max(0.9, 1.6 / max(f.s, 1e-3)), np.full_like(X, s0 + 7)], -1), seed + 53, 2) * 0.5 + 0.5
    tone = N.fbm3(np.stack([X / 420.0, Y / 160.0, np.full_like(X, s0 + 11)], -1), seed + 54, 2)
    t = np.clip(0.62 * late + 0.22 * fib + 0.1 * tone + 0.08, 0, 1)[..., None]
    if light.ndim == 1:
        light, dark = light[None, None], dark[None, None]
    col = light * (1 - t) + dark * t
    col = col * (1 + 0.1 * tone[..., None])
    f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), metal=0.0)
    return late


def paint_wood(f, kind, d, rng, seed):
    """One island of a wooden part: its colour (rings along x), its finish, and its flaws as relief and roughness:
    raised grain and fibres (`grain`), checks along the grain toward a board's ends (`cracks`), scratches every way on a
    top (`scratches`), dents (`dents`); `d`: wood (colour), ring (mm), finish (raw, oil, satin, gloss), flaws."""
    fl = dict({"grain": 0.5, "cracks": 0.2, "scratches": 0.3, "dents": 0.2}, **(d.get("flaws") or {}))
    rough0 = FINISH.get(d.get("finish", "oil"), 0.55)
    px = 1.0 / max(f.s, 1e-3)                           # a texel in mm: nothing finer than about two can be seen
    late = wood_color(f, kind, d, rng, seed)
    if d.get("painted"):
        f.fill(color=d.get("paint_color", "#d8d4cc"), rough=FINISH["paint"], metal=0.0)
        rough0 = FINISH["paint"]
    X, Y = f.grid()
    X = X.astype(np.float32)
    Y = Y.astype(np.float32)
    H = np.zeros_like(X)
    R = np.full_like(X, rough0) - 0.06 * late * (0 if d.get("painted") else 1)
    if kind == "end":                                   # end grain: open and dull, darker under any finish
        R = np.full_like(X, min(0.95, rough0 + 0.25))
        f.lay_island(np.ones_like(X) * 0.2, color="#000000")
    if kind == "under":                                 # the underside: left rough from the saw
        R = np.full_like(X, min(0.95, rough0 + 0.3))
    g = float(fl.get("grain", 0.5))
    if g > 0 and not d.get("painted"):                  # raised grain: the late wood standing, fibres along the grain
        H += 0.18 * g * late * max(px, 0.3)
        q = np.stack([X / 70.0, Y / max(1.2, 2.2 * px), np.full_like(X, seed * 0.11)], -1)
        H += 0.1 * g * max(px, 0.4) * N.fbm3(q, seed + 31, 2)
    elif g > 0:                                         # under paint only the brush's drag shows
        q = np.stack([X / 40.0, Y / max(1.5, 2.5 * px), np.full_like(X, seed * 0.11)], -1)
        H += 0.05 * g * max(px, 0.4) * N.fbm3(q, seed + 31, 2)
    area = f.W * f.H / 1e6                              # square metres
    nc = int(round(float(fl.get("cracks", 0.2)) * (6 if kind in ("board", "top", "turned") else 2) * max(area, 0.02) ** 0.5 * 3))
    for _ in range(nc if kind != "under" else 0):
        L = rng.uniform(30, 180)
        end = rng.random() < 0.7
        x0 = (rng.uniform(-L * 0.3, f.W * 0.12) if rng.random() < 0.5 else rng.uniform(f.W * 0.88 - L, f.W - L * 0.7)) if end else rng.uniform(0, max(f.W - L, 1))
        y0 = rng.uniform(f.H * 0.05, f.H * 0.95)
        xs = np.linspace(x0, x0 + L, 12)
        ys = y0 + np.cumsum(rng.normal(0, 0.35, 12))
        w0 = max(rng.uniform(0.6, 1.2), 2.2 * px)
        for k in range(11):
            taper = math.sin(math.pi * (k + 0.5) / 11) ** 0.6
            m = _segment(X, Y, (xs[k], ys[k]), (xs[k + 1], ys[k + 1]), w0 * taper + 0.6 * px)
            H -= 0.45 * w0 * m
            R = np.maximum(R, m * 0.95)
            f.lay_island((m * 0.55).astype(np.float32), color="#140d08")
    if kind in ("top", "edge", "seat"):
        ns = int(round(float(fl.get("scratches", 0.3)) * 60 * max(area, 0.01) ** 0.7 * (1 if kind != "edge" else 0.3)))
        for _ in range(ns):
            c = np.array([rng.uniform(0, f.W), rng.uniform(0, f.H)])
            a = rng.uniform(0, math.pi) if rng.random() < 0.6 else rng.normal(0, 0.25)
            L = rng.uniform(15, 160)
            v = np.array([math.cos(a), math.sin(a)]) * L / 2
            wd = max(rng.uniform(0.3, 0.6), 1.6 * px)
            m = _segment(X, Y, c - v, c + v, wd)
            H -= 0.22 * wd * m
            R = R + (m * (0.15 if rng.random() < 0.5 else -0.12))
    nd = int(round(float(fl.get("dents", 0.2)) * (40 if kind in ("top", "seat") else 12) * max(area, 0.01) ** 0.7))
    for _ in range(nd if kind != "under" else 0):
        cx, cy = rng.uniform(0, f.W), rng.uniform(0, f.H)
        rad = max(rng.uniform(2.0, 6.0), 2.5 * px)
        x0, x1, y0, y1 = cx - 3 * rad, cx + 3 * rad, cy - 3 * rad, cy + 3 * rad
        sel = (X > x0) & (X < x1) & (Y > y0) & (Y < y1)
        if sel.any():
            H[sel] -= rng.uniform(0.08, 0.16) * rad * np.exp(-((X[sel] - cx) ** 2 + (Y[sel] - cy) ** 2) / (rad * rad))
    f.lay_island(np.ones_like(X), height=H.astype(np.float32), add_height=True, rough=np.clip(R, 0.05, 1.0).astype(np.float32))
