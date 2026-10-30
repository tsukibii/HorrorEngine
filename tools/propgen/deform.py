"""Deformers: what happens to a thing after it's made. They change a Mesh's vertices from its attributes (a turned
thing's `shell`: angle, height, radius at rest), never its UVs, so the print goes where the material goes.

- crush: a turned wall squashed flat in a band (stepped on, squeezed in a fist). Each ring keeps its length: the circle
  becomes a stadium of the same perimeter (two flat faces, two folds), the wall buckles where the flat part meets the
  round, the faces bend together, the band can twist; the ends (a can's rims, a bottle's neck) stay round.
- dents: pushed-in spots with creases in them.
- settle: how a thing comes to rest on the floor: the faces of its convex hull it can stand on (its centre of mass
  over the face), the one asked for (standing, lying, the lowest), turned to it, its lowest point on z = 0.
"""
import math

import numpy as np

from . import noise as N
from .bake import vertex_normals


def _stadium(theta, r, B):
    """Points of a stadium with perimeter 2 pi r and half-thickness B (B <= r), at arc fraction theta/(2 pi) from its
    right end going anticlockwise, and their outward normals. All arrays the same shape."""
    B = np.minimum(B, r)
    L = np.pi * (r - B) / 2
    P = 2 * np.pi * r
    s = np.mod(theta, 2 * np.pi) / (2 * np.pi) * P
    q1 = np.pi * B / 2
    sB, sC, sD, sE = q1, q1 + 2 * L, q1 + 2 * L + np.pi * B, q1 + 4 * L + np.pi * B
    x = np.empty_like(s)
    y = np.empty_like(s)
    nx = np.empty_like(s)
    ny = np.empty_like(s)
    Bs = np.maximum(B, 1e-9)
    # right cap, upper quarter
    m = s < sB
    ph = s[m] / Bs[m]
    x[m], y[m], nx[m], ny[m] = L[m] + B[m] * np.cos(ph), B[m] * np.sin(ph), np.cos(ph), np.sin(ph)
    m = (s >= sB) & (s < sC)
    x[m], y[m], nx[m], ny[m] = L[m] - (s[m] - sB[m]), B[m], 0, 1
    m = (s >= sC) & (s < sD)
    ph = np.pi / 2 + (s[m] - sC[m]) / Bs[m]
    x[m], y[m], nx[m], ny[m] = -L[m] + B[m] * np.cos(ph), B[m] * np.sin(ph), np.cos(ph), np.sin(ph)
    m = (s >= sD) & (s < sE)
    x[m], y[m], nx[m], ny[m] = -L[m] + (s[m] - sD[m]), -B[m], 0, -1
    m = s >= sE
    ph = 3 * np.pi / 2 + (s[m] - sE[m]) / Bs[m]
    x[m], y[m], nx[m], ny[m] = L[m] + B[m] * np.cos(ph), B[m] * np.sin(ph), np.cos(ph), np.sin(ph)
    return x, y, nx, ny


def crush(m, amount=0.8, at=0.5, spread=0.28, squash=0.0, twist=0.0, buckle=0.6, wrinkle=0.5, shorten=0.08,
          bend=0.0, rigid=(0.0, 1.0), thin=0.06, seed=0, z_range=None):
    """Squashes a turned mesh (attribute `shell`: angle, z, r) flat round height fraction `at` of its z range.
    amount: 0 round, 1 flat to `thin` of its radius. spread: the band's half-width (fraction of the height).
    squash: the direction it's pressed from (degrees round Z). twist: degrees the top turns against the bottom.
    buckle: the folds where flat meets round; wrinkle: the flat faces' waves; shorten: how much shorter it ends up
    (fraction of the band); bend: the band's own bow (degrees). rigid: the height fractions outside which nothing is
    squashed (a can's rims)."""
    th, z, r = m.a["shell"][:, 0], m.a["shell"][:, 1], m.a["shell"][:, 2]
    z0, z1 = z_range or (z.min(), z.max())
    H = max(z1 - z0, 1e-6)
    t = (z - z0) / H
    lo, hi = rigid

    def band(tt):
        # 1 in the band's middle, falling smoothly to 0 at `spread` either side, never past the rigid ends
        zz = np.clip(1 - np.abs(tt - at) / max(spread, 1e-6), 0, 1)
        return zz * zz * (3 - 2 * zz) * N.smoothstep(lo, lo + 0.06, tt) * (1 - N.smoothstep(hi - 0.06, hi, tt))

    zone = band(t)
    q = np.clip(amount, 0, 1) * zone
    rr = np.maximum(r, 1e-6)
    B = rr * (1 - (1 - thin) * q ** 0.85)
    sq = math.radians(squash)
    tp = th - sq
    x, y, nx, ny = _stadium(tp, rr, B)
    # the flat faces bend together (both faces move the same way: no folding through each other)
    rs = N.rng(seed, "crush")
    off = rs.uniform(-100, 100, 3)
    span = np.pi * rr / 2
    wave = N.fbm3(np.stack([x / (span.max() * 0.6) + off[0], (z - z0) / (H * 0.25) + off[1], np.full_like(x, off[2])], 1), seed + 3, 3)
    y = y + wrinkle * 0.35 * B.max() * q * wave * 1.8
    # buckles: sharp diagonal folds where the wall turns from round to flat, and some across the flat faces
    trans = np.clip(zone * (1 - zone) * 4, 0, 1) * np.clip(amount, 0, 1)
    sarc = np.mod(tp, 2 * np.pi) * rr
    u1 = (sarc + (z - z0) * 1.0) / (H * 0.18)
    u2 = (sarc - (z - z0) * 1.0) / (H * 0.18)
    rid = np.maximum(N.ridged3(np.stack([u1, u2 * 0.3, np.full_like(u1, off[0])], 1), seed + 5, 2),
                     N.ridged3(np.stack([u2, u1 * 0.3, np.full_like(u1, off[1])], 1), seed + 7, 2))
    bk = buckle * rr * (0.18 * trans + 0.07 * q) * (rid - 0.45)
    x = x + nx * bk
    y = y + ny * bk
    # the band turns (twist) and bows (bend) as it goes; the whole thing shortens through the band
    tw = math.radians(twist) * (np.clip((t - (at - spread)) / max(2 * spread, 1e-6), 0, 1))
    tw = tw * tw * (3 - 2 * tw)
    c, s = np.cos(tw + sq), np.sin(tw + sq)
    X = c * x - s * y
    Y = s * x + c * y
    # shortening: what's above the band comes down by `shorten` of the band's length (the same on any mesh)
    tg = np.linspace(0, 1, 4001)
    qg = np.clip(amount, 0, 1) * band(tg)
    cum = np.concatenate([[0], np.cumsum(np.diff(tg) * 0.5 * (qg[1:] + qg[:-1]))]) * H
    shrink = np.interp(t, tg, cum)
    Z = z - shorten * shrink
    if bend:
        # bow the axis in the squash direction (the pressed side goes in): a rotation about the band's middle
        zc = z0 + at * H
        ang = math.radians(bend) * np.clip((z - zc) / (H * spread + 1e-9), -1, 1)
        dirx, diry = math.cos(sq + math.pi / 2), math.sin(sq + math.pi / 2)
        rel = Z - zc
        side = X * dirx + Y * diry
        side2 = side * np.cos(ang) - rel * np.sin(ang)
        rel2 = side * np.sin(ang) + rel * np.cos(ang)
        X = X + (side2 - side) * dirx
        Y = Y + (side2 - side) * diry
        Z = zc + rel2
    m.v = np.stack([X, Y, Z], 1)
    return m


def dents(m, centres, depth=0.002, radius=0.008, seed=0, where=None, creases=0.5):
    """Pushes spots in along the normal: `centres` (k, 3) rest positions (so any mesh of the thing dents alike),
    `depth` m at their middle over about `radius` m, with creases in them. where: (n,) 0-1, what may be dented."""
    if centres is None or not len(centres):
        return m
    r = N.rng(seed, "dents")
    n = vertex_normals(m)
    rest = m.a.get("rest", m.v)
    disp = np.zeros(len(m.v))
    for i, c in enumerate(np.asarray(centres, float)):
        rad = radius * r.uniform(0.6, 1.4)
        fall = np.exp(-((rest - c) ** 2).sum(1) / rad ** 2 * 1.6)
        rid = N.ridged3((rest - c) / (rad * 0.5), seed + 13 * i, 2)
        disp += depth * r.uniform(0.5, 1.2) * fall * (1 - creases + creases * rid)
    if where is not None:
        disp *= where
    m.v = m.v - n * disp[:, None]
    return m


def displace(m, amount, scale, seed=0, ridged=False, mask=None):
    """Noise along the normal: amount m, features about `scale` m across (rest position, so it follows the material)."""
    n = vertex_normals(m)
    p = m.a.get("rest", m.v) / scale
    f = N.ridged3(p, seed, 3) - 0.5 if ridged else N.fbm3(p, seed, 3)
    if mask is not None:
        f = f * mask
    m.v = m.v + n * (amount * f)[:, None]
    return m


# ---- coming to rest -----------------------------------------------------------------------------------------------------

def _hull_faces(v):
    """The convex hull's faces as (normal, offset, vertex points) groups, coplanar triangles merged."""
    import bmesh
    from mathutils import Vector
    pts = v
    if len(pts) > 30000:
        pts = pts[np.linspace(0, len(pts) - 1, 30000).astype(int)]
    bm = bmesh.new()
    for p in pts:
        bm.verts.new(Vector(p))
    bmesh.ops.convex_hull(bm, input=list(bm.verts))
    faces = []
    for f in bm.faces:
        if f.calc_area() < 1e-12:
            continue
        nrm = np.array(f.normal)
        faces.append((nrm, float(np.dot(nrm, np.array(f.verts[0].co))), np.array([list(x.co) for x in f.verts]), f.calc_area()))
    bm.free()
    groups = []
    for nrm, off, ps, area in faces:
        for g in groups:
            if np.dot(g[0], nrm) > 0.9995 and abs(g[1] - off) < 1e-5:
                g[2].append(ps)
                g[3] += area
                break
        else:
            groups.append([nrm, off, [ps], area])
    return [(g[0], g[1], np.concatenate(g[2]), g[3]) for g in groups]


def _hull2(p):
    p = np.unique(np.round(p, 9), axis=0)
    if len(p) < 3:
        return p
    p = p[np.lexsort((p[:, 1], p[:, 0]))]

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for q in p:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0:
            lower.pop()
        lower.append(q)
    for q in p[::-1]:
        while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0:
            upper.pop()
        upper.append(q)
    return np.array(lower[:-1] + upper[:-1])


def _inside(poly, q, margin=0.0):
    n = len(poly)
    if n < 3:
        return False
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        e = b - a
        L = np.hypot(*e)
        if L < 1e-12:
            continue
        if (e[0] * (q[1] - a[1]) - e[1] * (q[0] - a[0])) / L < margin:
            return False
    return True


def centre_of_mass(m):
    """The centre of a thin shell: its triangles' centres weighted by their areas."""
    t, _, _ = m.tris()
    a, b, c = m.v[t[:, 0]], m.v[t[:, 1]], m.v[t[:, 2]]
    ar = np.linalg.norm(np.cross(b - a, c - a), axis=1)
    return ((a + b + c) / 3 * ar[:, None]).sum(0) / max(ar.sum(), 1e-12)


def _rot_to(n, target=(0, 0, -1)):
    """The rotation matrix turning unit vector n onto target."""
    a = np.asarray(n, float) / np.linalg.norm(n)
    b = np.asarray(target, float)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if np.linalg.norm(v) < 1e-9:
        if c > 0:
            return np.eye(3)
        perp = np.array([1, 0, 0]) if abs(a[0]) < 0.9 else np.array([0, 1, 0])
        v = np.cross(a, perp)
        v /= np.linalg.norm(v)
        return 2 * np.outer(v, v) - np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1 / (1 + c))


def rest_pose(m, pose="auto", axis=(0, 0, 1), seed=0, com=None, prefer=(0, 1, 0)):
    """The rotation (3 x 3) that sets a mesh down: 'stand' (as made), 'lie' (on a face across `axis`), 'auto' (the
    stablest face: the centre of mass lowest), 'any' (a stable face picked by the seed, the stabler likelier),
    'upside' (on its top). Of faces about as stable, the one whose normal is nearest `prefer` goes down (+y, the
    back: the front faces up)."""
    if pose == "stand":
        return np.eye(3)
    if pose == "upside":
        return _rot_to((0, 0, 1))
    com = centre_of_mass(m) if com is None else com
    cands = []
    for nrm, off, pts, area in _hull_faces(m.v):
        R = _rot_to(nrm)
        q = (pts - com) @ R.T
        c2 = np.zeros(2)
        poly = _hull2(q[:, :2])
        if len(poly) < 3:
            continue
        margin = 0.02 * math.sqrt(max(area, 1e-12))
        if not _inside(poly, c2, margin * 0.1):
            continue
        h = off - float(np.dot(nrm, com))            # the centre's height over that face
        cands.append((h, nrm, R, area))
    if not cands:
        return np.eye(3)
    ax = np.asarray(axis, float)
    ax /= np.linalg.norm(ax)
    pref = np.asarray(prefer, float) / max(np.linalg.norm(prefer), 1e-9)
    size = float(np.ptp(m.v, axis=0).max())

    def best(pool):
        h0 = min(c[0] for c in pool)
        near = [c for c in pool if c[0] <= h0 + 0.04 * size]
        return max(near, key=lambda c: (float(np.dot(c[1], pref)), c[3]))[2]

    if pose == "lie":
        side = [c for c in cands if abs(np.dot(c[1], ax)) < 0.35]
        return best(side or cands)
    if pose == "any":
        r = N.rng(seed, "pose")
        hs = np.array([c[0] for c in cands])
        wts = np.exp(-(hs - hs.min()) / max(hs.ptp() * 0.25, 1e-6)) * np.array([c[3] for c in cands]) ** 0.5
        return cands[r.choice(len(cands), p=wts / wts.sum())][2]
    return best(cands)


def place(meshes, R, yaw=0.0):
    """Turns meshes by R then by `yaw` degrees round Z, centred over the origin, lowest point on z = 0."""
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    Y = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    M = Y @ R
    allv = np.concatenate([x.v for x in meshes if x is not None]) @ M.T
    lo, hi = allv.min(0), allv.max(0)
    shift = np.array([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
    for x in meshes:
        if x is not None:
            x.v = x.v @ M.T + shift
    return M, shift
