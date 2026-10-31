"""Meshes as numpy arrays, made into one Blender mesh at the end. Metres, Z up (Blender's own: the glTF export turns it
Y up), a thing's base on z = 0.

A Mesh is vertices `v` (n, 3), faces `f` (m, 4: a triangle's fourth corner is -1), a UV per corner `uv` (m, 4, 2), a
material slot per face `fm` (a name in `mats`), smooth or flat per face `fs`, and per-vertex attributes `a` (name ->
(n, k)): the coordinates a deformer works in (a turned thing's angle, height and offset from its wall; a sheet's place
on the flat sheet) and the rest position the paint's noise follows. Parts are made separately and joined.

A turned thing is a profile, (r, z) points from the axis out, cut into segments that each map into a UV island of
their own (`Seg`): a label's band wraps round (u the angle, v the height), a lid or a bottom maps as seen from above.
"""
import math

import numpy as np


class Mesh:
    def __init__(self, v=None, f=None, uv=None, mat=0, smooth=True, attrs=None, mats=None):
        self.v = np.zeros((0, 3)) if v is None else np.asarray(v, float).reshape(-1, 3)
        self.f = np.zeros((0, 4), np.int64) if f is None else _pad(f)
        m = len(self.f)
        self.uv = np.zeros((m, 4, 2)) if uv is None else np.asarray(uv, float).reshape(m, 4, 2)
        self.mats = list(mats or ["main"])
        self.fm = np.full(m, mat if isinstance(mat, int) else self.mats.index(mat), np.int64)
        self.fs = np.full(m, bool(smooth))
        self.a = {k: np.asarray(x, float).reshape(len(self.v), -1) for k, x in (attrs or {}).items()}
        self.sharp = np.zeros((0, 2), np.int64)        # vertex pairs drawn as hard edges (a profile's corners)

    def copy(self):
        m = Mesh()
        m.v, m.f, m.uv, m.fm, m.fs, m.mats = self.v.copy(), self.f.copy(), self.uv.copy(), self.fm.copy(), self.fs.copy(), list(self.mats)
        m.a = {k: x.copy() for k, x in self.a.items()}
        m.sharp = self.sharp.copy()
        return m

    def tris(self):
        """The faces as triangles (k, 3) and their corners' UVs (k, 3, 2), quads split along 0-2."""
        q = self.f[:, 3] >= 0
        t = np.concatenate([self.f[:, [0, 1, 2]], self.f[q][:, [0, 2, 3]]])
        tuv = np.concatenate([self.uv[:, [0, 1, 2]], self.uv[q][:, [0, 2, 3]]])
        tf = np.concatenate([np.arange(len(self.f)), np.nonzero(q)[0]])
        return t, tuv, tf

    def bounds(self):
        return self.v.min(0), self.v.max(0)

    def ntris(self):
        return int(len(self.f) + (self.f[:, 3] >= 0).sum())


def _pad(f):
    if isinstance(f, np.ndarray) and f.ndim == 2 and f.shape[1] == 4:
        return f.astype(np.int64)
    rows = [list(x) + [-1] * (4 - len(x)) for x in f]
    return np.array(rows, np.int64).reshape(-1, 4)


def join(parts, mats=None):
    """One mesh from several; material names merge by name, attributes missing on a part are zero there."""
    parts = [p for p in parts if p is not None and len(p.v)]
    names = list(mats or [])
    for p in parts:
        for n in p.mats:
            if n not in names:
                names.append(n)
    keys = {}
    for p in parts:
        for k, x in p.a.items():
            keys[k] = max(keys.get(k, 0), x.shape[1])
    out = Mesh(mats=names)
    vs, fs, uvs, fms, fss, sharps, at = [], [], [], [], [], [], {k: [] for k in keys}
    off = 0
    for p in parts:
        vs.append(p.v)
        f = p.f.copy()
        f[f >= 0] += off
        fs.append(f)
        uvs.append(p.uv)
        fms.append(np.array([names.index(p.mats[i]) for i in p.fm], np.int64))
        fss.append(p.fs)
        sharps.append(p.sharp + off)
        for k, w in keys.items():
            x = p.a.get(k)
            z = np.zeros((len(p.v), w))
            if x is not None:
                z[:, :x.shape[1]] = x
            at[k].append(z)
        off += len(p.v)
    out.v = np.concatenate(vs) if vs else out.v
    out.f = np.concatenate(fs) if fs else out.f
    out.uv = np.concatenate(uvs) if uvs else out.uv
    out.fm = np.concatenate(fms) if fms else out.fm
    out.fs = np.concatenate(fss) if fss else out.fs
    out.sharp = np.concatenate(sharps) if sharps else out.sharp
    out.a = {k: np.concatenate(x) for k, x in at.items()}
    return out


def grid_faces(rows, cols, wrap=False):
    """Quads over a rows x cols vertex grid (row-major); with wrap the last column joins the first."""
    c = cols if wrap else cols - 1
    r = np.arange(rows - 1)[:, None]
    j = np.arange(c)[None, :]
    a = r * cols + j
    b = r * cols + (j + 1) % cols
    return np.stack([a, b, b + cols, a + cols], -1).reshape(-1, 4)


# ---- islands: where each segment's faces go in a material's texture -----------------------------------------------------

class Island:
    """A rectangle of a texture, (u0, v0, u1, v1) in UV space (v up), and its size on the thing in millimetres."""

    def __init__(self, name, w_mm, h_mm, mat="main", rot=False):
        self.name, self.w_mm, self.h_mm, self.mat, self.rot = name, float(w_mm), float(h_mm), mat, rot
        self.rect = (0.0, 0.0, 1.0, 1.0)

    def to_uv(self, a, b):
        """Island-local (a across, b up, 0 to 1) to the texture's UV."""
        u0, v0, u1, v1 = self.rect
        return np.stack([u0 + np.asarray(a) * (u1 - u0), v0 + np.asarray(b) * (v1 - v0)], -1)


# ---- turned things ----------------------------------------------------------------------------------------------------

class Seg:
    """A run of a profile: points (r, z) in metres, how its faces map (`band`: wrapped round, v along the profile's
    length, so its island is 2 pi r_max by `arclen(pts)`; `top` / `bottom`: seen from above or below, as a disc of
    radius `disc` metres), into which island; `sharp` marks a hard edge at its start."""

    def __init__(self, pts, island, map="band", mat=None, sharp=False, step=None, disc=None, cap=None, cap_at="end", cap_island=None,
                 cap_mirror=None, cap_fill=None):
        self.pts = np.asarray(pts, float).reshape(-1, 2)
        self.island, self.map, self.mat, self.sharp, self.step, self.disc = island, map, mat, sharp, step, disc
        self.cap, self.cap_at = cap, cap_at          # loft only: close the outline at this segment's end (or start)
        self.cap_island = cap_island                 # ... mapped from above into this island (its own, or they overlap)
        self.cap_mirror = cap_mirror                 # ... mirrored to read from below (a 'down' cap is, unless False)
        self.cap_fill = cap_fill                     # ... with points inside it every cap_fill metres (so it can bend)


def arclen(pts):
    """A polyline's length."""
    p = np.asarray(pts, float)
    return float(np.linalg.norm(np.diff(p, axis=0), axis=1).sum())


def resample(pts, step):
    """A polyline's points every `step` metres or closer, keeping its corners."""
    pts = np.asarray(pts, float)
    out = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        n = max(1, int(math.ceil(np.linalg.norm(b - a) / step)))
        for k in range(1, n + 1):
            out.append(a + (b - a) * k / n)
    return np.array(out)


def lathe(segs, n, islands, step=0.002, mats=None, seam=math.pi / 2):
    """A profile turned round Z with n columns. Consecutive segments share their joining ring. Attributes: `shell`
    (angle, height z, radius r at rest), `rest` (the rest position). The UV seam sits at angle `seam` (the back, +y: the print's middle faces -y, the front)."""
    rings, seg_of, sharp_rings = [], [], []
    for si, s in enumerate(segs):
        p = resample(s.pts, s.step or step)
        if rings:
            if np.allclose(rings[-1][-1], p[0], atol=1e-7):
                p = p[1:]
            if s.sharp:
                sharp_rings.append(sum(len(r) for r in rings) - 1)
        rings.append(p)
        seg_of += [si] * len(p)
    prof = np.concatenate(rings)
    seg_of = np.array(seg_of)
    R = len(prof)
    th = seam + np.arange(n) * 2 * math.pi / n
    r = prof[:, 0][:, None]
    z = prof[:, 1][:, None]
    v = np.stack([r * np.cos(th)[None], r * np.sin(th)[None], np.broadcast_to(z, (R, n))], -1).reshape(-1, 3)
    faces = grid_faces(R, n, wrap=True)
    # the faces between ring i and i+1 belong to the segment of ring i+1 (a segment's first ring is the joint)
    ring_of_face = np.repeat(np.arange(R - 1), n)
    fseg = seg_of[ring_of_face + 1]
    col = np.tile(np.arange(n), R - 1)
    uv = np.zeros((len(faces), 4, 2))
    names = list(mats or [])
    fmat = np.zeros(len(faces), np.int64)
    # per corner: (ring, column with the seam unwrapped)
    cr = np.stack([ring_of_face, ring_of_face, ring_of_face + 1, ring_of_face + 1], 1)
    cc = np.stack([col, col + 1, col + 1, col], 1)
    for si, s in enumerate(segs):
        isl = islands[s.island]
        m = s.mat or isl.mat
        if m not in names:
            names.append(m)
        sel = fseg == si
        fmat[sel] = names.index(m)
        rr, ccol = cr[sel], cc[sel]
        a = ccol / n
        if s.map == "band":
            # v by arc length along the segment (a profile may fold back on itself: a can's seam)
            # the segment's own rings; its faces start from the ring before them (the joint, s = 0)
            idx0 = np.nonzero(seg_of == si)[0]
            ring_s = np.zeros(R)
            pr = prof[idx0]
            ring_s[idx0] = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pr, axis=0), axis=1))]) + np.linalg.norm(pr[0] - s.pts[0])
            if si:
                ring_s[idx0[0] - 1] = 0.0
            b = ring_s[rr] / max(arclen(s.pts), 1e-9)
            uv[sel] = isl.to_uv(a, b)
        else:
            rad = s.disc or max(prof[seg_of == si, 0].max(), 1e-6)
            ang = seam + ccol * 2 * math.pi / n
            rs = prof[rr, 0]
            sx = np.cos(ang) * rs / rad
            sy = np.sin(ang) * rs / rad
            if s.map == "bottom":
                sx = -sx
            uv[sel] = isl.to_uv(0.5 + 0.5 * sx, 0.5 + 0.5 * sy)
    m = Mesh(v, faces, uv, mats=names)
    m.fm = fmat
    m.a["shell"] = np.stack([np.tile(th, R), np.repeat(prof[:, 1], n), np.repeat(prof[:, 0], n)], 1)
    m.a["rest"] = v.copy()
    if sharp_rings:
        pairs = []
        for ri in sharp_rings:
            idx = ri * n + np.arange(n)
            pairs.append(np.stack([idx, ri * n + (np.arange(n) + 1) % n], 1))
        m.sharp = np.concatenate(pairs)
    # a ring of radius 0 (the axis) makes degenerate quads: collapse them into triangles
    _close_poles(m, prof, n)
    return m


def _close_poles(m, prof, n):
    pole = np.nonzero(prof[:, 0] < 1e-9)[0]
    if not len(pole):
        return
    keep = np.ones(len(m.v), bool)
    remap = np.arange(len(m.v))
    for ri in pole:
        idx = ri * n + np.arange(n)
        remap[idx] = idx[0]
        keep[idx[1:]] = False
    f = m.f.copy()
    f[f >= 0] = remap[f[f >= 0]]
    uv = m.uv.copy()
    newf, newuv = [], []
    for i in range(len(f)):
        row, ruv = [], []
        for k in range(4):
            if f[i, k] < 0:
                continue
            if row and row[-1] == f[i, k]:
                continue
            row.append(f[i, k]); ruv.append(uv[i, k])
        if len(row) > 1 and row[0] == row[-1]:
            row.pop(); ruv.pop()
        while len(row) < 4:
            row.append(-1); ruv.append((0, 0))
        newf.append(row); newuv.append(ruv)
    m.f = np.array(newf, np.int64)
    m.uv = np.array(newuv, float)
    good = (m.f >= 0).sum(1) >= 3
    m.f, m.uv, m.fm, m.fs = m.f[good], m.uv[good], m.fm[good], m.fs[good]
    compact(m, keep)


def compact(m, keep):
    """Drops the vertices not kept (none may be used by a face), renumbering faces and sharp edges."""
    newi = np.cumsum(keep) - 1
    m.v = m.v[keep]
    m.a = {k: x[keep] for k, x in m.a.items()}
    f = m.f.copy()
    f[f >= 0] = newi[f[f >= 0]]
    m.f = f
    if len(m.sharp):
        ok = keep[m.sharp].all(1)
        m.sharp = newi[m.sharp[ok]]


def sheet(w, h, step, islands, front="front", back="back", thick=0.0, mats=None, mat=None):
    """A flat sheet w x h metres on z = 0, centred, a grid every `step`: front faces up (+z) into island `front`,
    the back down into `back` (seen from below: mirrored so print reads the right way), and with `thick` an edge
    strip round it. Attribute `sheet` (s, t, side): s and t the place on the flat sheet in metres from its corner."""
    nx = max(2, int(round(w / step)) + 1)
    ny = max(2, int(round(h / step)) + 1)
    xs = np.linspace(-w / 2, w / 2, nx)
    ys = np.linspace(-h / 2, h / 2, ny)
    X, Y = np.meshgrid(xs, ys)
    base = np.stack([X.ravel(), Y.ravel(), np.zeros(X.size)], 1)
    fq = grid_faces(ny, nx)
    a = (base[:, 0] + w / 2) / w
    b = (base[:, 1] + h / 2) / h
    fi, bi = islands[front], islands[back]
    names = list(mats or [])
    parts = []
    for side, isl in ((1, fi), (-1, bi)):
        v = base.copy()
        v[:, 2] = side * thick / 2
        f = fq if side > 0 else fq[:, ::-1]
        aa = a if side > 0 else 1 - a
        uv = isl.to_uv(aa[f], b[f])
        m = Mesh(v, f, uv, mats=[mat or isl.mat])
        m.a["sheet"] = np.stack([base[:, 0] + w / 2, base[:, 1] + h / 2, np.full(len(v), side)], 1)
        m.a["rest"] = v.copy()
        parts.append(m)
    out = join(parts, names)
    if thick > 0:
        # the edge: the border loop of the front joined to the same loop of the back
        loop = np.concatenate([np.arange(nx), np.arange(1, ny) * nx + nx - 1, (ny - 1) * nx + np.arange(nx - 2, -1, -1),
                               np.arange(ny - 2, 0, -1) * nx])
        nfront = nx * ny
        a0, a1 = loop, np.roll(loop, -1)
        f = np.stack([a1, a0, a0 + nfront, a1 + nfront], 1)
        uv = np.zeros((len(f), 4, 2))
        uv[:] = fi.to_uv(0.002, 0.002)
        out.f = np.concatenate([out.f, f])
        out.uv = np.concatenate([out.uv, uv])
        out.fm = np.concatenate([out.fm, np.full(len(f), out.mats.index(mat or fi.mat))])
        out.fs = np.concatenate([out.fs, np.ones(len(f), bool)])
    out.grid = (ny, nx)
    return out


def box(size, at=(0, 0, 0), island=None, islands=None, mat="main", bevel=0.0):
    """An axis-aligned box (w, d, h) standing on `at`, each face mapped across `island` (or the whole texture)."""
    w, d, h = size
    x0, y0, z0 = at[0] - w / 2, at[1] - d / 2, at[2]
    c = np.array([[x0, y0, z0], [x0 + w, y0, z0], [x0 + w, y0 + d, z0], [x0, y0 + d, z0],
                  [x0, y0, z0 + h], [x0 + w, y0, z0 + h], [x0 + w, y0 + d, z0 + h], [x0, y0 + d, z0 + h]])
    quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
    v = np.concatenate([c[q] for q in quads])
    f = np.arange(24).reshape(6, 4)
    isl = islands[island] if island else None
    base = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], float)
    uv = np.stack([isl.to_uv(base[:, 0], base[:, 1]) if isl else base for _ in range(6)])
    m = Mesh(v, f, uv, mats=[mat], smooth=False)
    m.a["rest"] = v.copy()
    return m


def weighted_normals(m, angle=50.0):
    """A normal per face corner, each the area-weighted mean of the faces round its vertex that turn less than `angle`
    degrees from its own face (flat faces keep their own): the hard-surface trick, so a big flat face shades flat and
    the rounded bevel round it takes the highlight, no matter how few faces the bevel has."""
    t, _, tf = m.tris()
    a, b, c = m.v[t[:, 0]], m.v[t[:, 1]], m.v[t[:, 2]]
    fn = np.zeros((len(m.f), 3))
    np.add.at(fn, tf, np.cross(b - a, c - a))               # a face's normal times twice its area
    area = np.linalg.norm(fn, axis=1)
    unit = fn / np.maximum(area[:, None], 1e-20)
    ok = m.f >= 0
    cf, ck = np.nonzero(ok)
    cv = m.f[cf, ck]
    order = np.argsort(cv, kind="stable")
    cv_s, cf_s = cv[order], cf[order]
    starts = np.searchsorted(cv_s, np.arange(len(m.v)))
    ends = np.searchsorted(cv_s, np.arange(len(m.v)), side="right")
    cos_lim = math.cos(math.radians(angle))
    out = np.zeros((len(cf), 3))
    for i in range(len(cf)):
        v = cv[i]
        nb = cf_s[starts[v]:ends[v]]
        own = unit[cf[i]]
        if not m.fs[cf[i]]:
            out[i] = own
            continue
        use = (unit[nb] @ own) >= cos_lim
        use &= m.fs[nb]
        s_ = fn[nb[use]].sum(0)
        n_ = np.linalg.norm(s_)
        out[i] = s_ / n_ if n_ > 1e-20 else own
    return out


def to_blender(m, name, materials=None, sharp_angle=None, weighted=None):
    """The Mesh as a Blender mesh datablock: smooth faces, hard edges at `sharp` and over `sharp_angle` degrees,
    material slots in `m.mats` order (from `materials`: name -> bpy material); `weighted` (an angle in degrees) sets
    the corners' normals by weighted_normals instead."""
    import bpy
    me = bpy.data.meshes.new(name)
    f = m.f
    sizes = (f >= 0).sum(1)
    corners = f[f >= 0]
    me.vertices.add(len(m.v))
    me.vertices.foreach_set("co", m.v.astype(np.float32).ravel())
    me.loops.add(len(corners))
    me.loops.foreach_set("vertex_index", corners.astype(np.int32))
    me.polygons.add(len(f))
    starts = np.concatenate([[0], np.cumsum(sizes)[:-1]]).astype(np.int32)
    me.polygons.foreach_set("loop_start", starts)
    me.update(calc_edges=True)
    uvs = m.uv[f >= 0]
    lay = me.uv_layers.new(name="UVMap")
    lay.data.foreach_set("uv", uvs.astype(np.float32).ravel())
    me.polygons.foreach_set("material_index", m.fm.astype(np.int32))
    for n in m.mats:
        me.materials.append((materials or {}).get(n))
    me.shade_smooth()
    if sharp_angle is not None:
        me.set_sharp_from_angle(angle=math.radians(sharp_angle))
    if len(m.sharp):
        ev = np.zeros(len(me.edges) * 2, np.int32)
        me.edges.foreach_get("vertices", ev)
        ev = ev.reshape(-1, 2)
        key = {(int(min(a, b)), int(max(a, b))): i for i, (a, b) in enumerate(ev)}
        att = me.attributes.get("sharp_edge") or me.attributes.new("sharp_edge", "BOOLEAN", "EDGE")
        vals = np.zeros(len(me.edges), bool)
        att.data.foreach_get("value", vals)
        for a, b in m.sharp:
            i = key.get((int(min(a, b)), int(max(a, b))))
            if i is not None:
                vals[i] = True
        att.data.foreach_set("value", vals)
    flat = ~m.fs
    if flat.any():
        att = me.attributes.get("sharp_face") or me.attributes.new("sharp_face", "BOOLEAN", "FACE")
        att.data.foreach_set("value", flat)
    me.validate()
    me.update()
    if weighted:
        cn = weighted_normals(m, float(weighted))
        if len(cn) == len(me.loops):
            me.normals_split_custom_set([tuple(x) for x in cn])
            me.update()
    return me


def from_blender(me):
    """A Blender mesh (triangles and quads, one UV layer) back as a Mesh: after Blender changed it (decimated)."""
    n = len(me.vertices)
    v = np.zeros(n * 3, np.float32)
    me.vertices.foreach_get("co", v)
    ls = np.zeros(len(me.polygons), np.int32)
    lt = np.zeros(len(me.polygons), np.int32)
    me.polygons.foreach_get("loop_start", ls)
    me.polygons.foreach_get("loop_total", lt)
    lv = np.zeros(len(me.loops), np.int32)
    me.loops.foreach_get("vertex_index", lv)
    luv = np.zeros(len(me.loops) * 2, np.float32)
    me.uv_layers.active.data.foreach_get("uv", luv)
    luv = luv.reshape(-1, 2)
    mi = np.zeros(len(me.polygons), np.int32)
    me.polygons.foreach_get("material_index", mi)
    if lt.max() > 4:
        raise ValueError("n-gons: triangulate first")
    f = np.full((len(ls), 4), -1, np.int64)
    uv = np.zeros((len(ls), 4, 2))
    for k in range(4):
        ok = lt > k
        f[ok, k] = lv[ls[ok] + k]
        uv[ok, k] = luv[ls[ok] + k]
    m = Mesh(v.reshape(-1, 3), f, uv, mats=[mt.name if mt else "main" for mt in me.materials] or ["main"])
    m.fm = mi.astype(np.int64)
    return m


def extrude(polys, thick, island, mat=None, flip_bottom=True, under=None):
    """A flat shape cut from a sheet `thick` metres thick: polys (outline first, then holes; (k, 2) metres, the outline
    anticlockwise) as a top and a bottom face and walls round every loop. The top maps over the island by the shape's
    box, the bottom mirrored under it (read from below) or over `under`, an island of its own (two faces on one
    island fight in a bake), the walls along the island's foot."""
    from mathutils import Vector
    from mathutils.geometry import tessellate_polygon
    loops = [np.asarray(p, float) for p in polys]
    allp = np.concatenate(loops)
    lo, hi = allp.min(0), allp.max(0)
    span = np.maximum(hi - lo, 1e-9)
    tri = tessellate_polygon([[Vector((x, y, 0)) for x, y in lp] for lp in loops])
    pts = allp
    n = len(pts)
    a = (pts - lo) / span
    top = np.concatenate([pts, np.full((n, 1), thick / 2)], 1)
    bot = np.concatenate([pts, np.full((n, 1), -thick / 2)], 1)
    v = np.concatenate([top, bot])
    faces, uvs = [], []
    for t in tri:
        i, j, k = t
        # tessellate_polygon's winding: make the top face up
        p0, p1, p2 = pts[i], pts[j], pts[k]
        if (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) < 0:
            j, k = k, j
        faces.append([i, j, k, -1])
        uvs.append([island.to_uv(a[q, 0], a[q, 1]) for q in (i, j, k)] + [(0, 0)])
        faces.append([k + n, j + n, i + n, -1])
        ui = under or island
        mir = (lambda q: ui.to_uv(1 - a[q, 0], a[q, 1])) if flip_bottom else (lambda q: ui.to_uv(a[q, 0], a[q, 1]))
        uvs.append([mir(k), mir(j), mir(i), (0, 0)])
    off = 0
    for lp in loops:
        L = len(lp)
        for q in range(L):
            i0, i1 = off + q, off + (q + 1) % L
            faces.append([i1, i0, i0 + n, i1 + n])
            c = island.to_uv(a[i0, 0], 0.0)
            uvs.append([c, c, c, c])
        off += L
    m = Mesh(v, faces, np.array(uvs, float).reshape(-1, 4, 2), mats=[mat or island.mat])
    m.a["rest"] = v.copy()
    return m


def offset_poly(poly, o):
    """A convex outline (k, 2, anticlockwise) moved out by o (in by -o), each corner along its bisector."""
    p = np.asarray(poly, float)
    prev, nxt = np.roll(p, 1, 0), np.roll(p, -1, 0)
    e1 = p - prev
    e2 = nxt - p
    e1 /= np.maximum(np.linalg.norm(e1, axis=1, keepdims=True), 1e-12)
    e2 /= np.maximum(np.linalg.norm(e2, axis=1, keepdims=True), 1e-12)
    n1 = np.stack([e1[:, 1], -e1[:, 0]], 1)
    n2 = np.stack([e2[:, 1], -e2[:, 0]], 1)
    b = n1 + n2
    b /= np.maximum(np.linalg.norm(b, axis=1, keepdims=True), 1e-12)
    cosh = np.maximum((b * n1).sum(1), 0.2)
    return p + b * (o / cosh)[:, None]


def loft(outline, segs, islands, mats=None, hole_island=None):
    """A profile swept round a closed outline instead of turned round an axis: `segs` like lathe's, each point
    (offset from the outline, z) in metres (offset < 0: into the material). `outline` is one loop (k, 2, anticlockwise)
    or a list: the outline, then holes (clockwise), each swept with the same profile. A segment with `cap` ('down' or
    'up') closes the shape at its end (or start) with the outline's face there, holes left open (concave outlines are
    tessellated properly). Bands map along each loop's length (u) and the profile's (v), a hole's into `hole_island`;
    caps map from above (mirrored when they face down, unless cap_mirror is False)."""
    from mathutils import Vector
    from mathutils.geometry import tessellate_polygon
    loops = [np.asarray(outline, float)] if isinstance(outline, np.ndarray) else [np.asarray(x, float) for x in outline]
    prof, ring_seg = [], []
    for si, s in enumerate(segs):
        pts = resample(s.pts, s.step) if s.step else s.pts
        if prof and np.allclose(prof[-1], pts[0]):
            pts = pts[1:]
        for p in pts:
            prof.append(np.asarray(p, float))
            ring_seg.append(si)
    nr = len(prof)
    names = list(mats or [])
    allp = np.concatenate(loops)
    lo, hi = allp.min(0), allp.max(0)
    span = np.maximum(hi - lo, 1e-9)
    base, verts = [], []
    off = 0
    for lp in loops:
        base.append(off)
        for o, z in prof:
            verts.append(np.concatenate([offset_poly(lp, o), np.full((len(lp), 1), z)], 1))
        off += len(lp) * nr
    verts = np.concatenate(verts)
    F, UV, FM = [], [], []
    extra_v = []

    def vid(li, r, j):
        k = len(loops[li])
        return base[li] + r * k + (j % k)

    for si, s in enumerate(segs):
        idx = [i for i, g in enumerate(ring_seg) if g == si]
        if not idx:
            continue
        start = idx[0] - 1 if si and idx[0] > 0 else idx[0]
        chain = list(range(start, idx[-1] + 1))
        m = s.mat or islands[s.island].mat
        if m not in names:
            names.append(m)
        sl = np.concatenate([[0], np.cumsum([np.linalg.norm(prof[b] - prof[a]) for a, b in zip(chain[:-1], chain[1:])])])
        tot = max(sl[-1], 1e-9)
        for li, lp in enumerate(loops):
            k = len(lp)
            isl = islands[hole_island] if li and hole_island else islands[s.island]
            per = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(np.concatenate([lp, lp[:1]]), axis=0), axis=1))])
            u = per / per[-1]
            for ci in range(len(chain) - 1):
                r0, r1 = chain[ci], chain[ci + 1]
                for j in range(k):
                    F.append([vid(li, r0, j), vid(li, r0, j + 1), vid(li, r1, j + 1), vid(li, r1, j)])
                    if s.map == "band":
                        UV.append(isl.to_uv(np.array([u[j], u[j + 1], u[j + 1], u[j]]), np.array([sl[ci], sl[ci], sl[ci + 1], sl[ci + 1]]) / tot))
                    else:
                        q = verts[[vid(li, r0, j), vid(li, r0, j + 1), vid(li, r1, j + 1), vid(li, r1, j)], :2]
                        a = (q - lo) / span * 0.9 + 0.05
                        if s.map == "bottom":
                            a[:, 0] = 1 - a[:, 0]
                        UV.append(isl.to_uv(a[:, 0], a[:, 1]))
                    FM.append(names.index(m))
        if s.cap:
            cisl = islands[s.cap_island or s.island]
            ri = chain[-1] if s.cap_at == "end" else chain[0]
            rings2d = [verts[base[li] + ri * len(lp): base[li] + (ri + 1) * len(lp), :2] for li, lp in enumerate(loops)]
            flat = np.concatenate(rings2d)
            ids = np.concatenate([base[li] + ri * len(lp) + np.arange(len(lp)) for li, lp in enumerate(loops)])
            if s.cap_fill:
                inner = _fill_points(rings2d, s.cap_fill)
                tris = _cdt(rings2d, inner)
                if len(inner):
                    ids = np.concatenate([ids, len(verts) + len(extra_v) + np.arange(len(inner))])
                    extra_v.extend(np.concatenate([inner, np.full((len(inner), 1), prof[ri][1])], 1))
                    flat = np.concatenate([flat, inner])
            else:
                tris = tessellate_polygon([[Vector((x, y, 0.0)) for x, y in r2] for r2 in rings2d])
            mirror = s.cap_mirror if s.cap_mirror is not None else (s.map == "bottom" or s.cap == "down")
            for t3 in tris:
                a_, b_, c_ = t3
                p0, p1, p2 = flat[a_], flat[b_], flat[c_]
                ccw = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) > 0
                if ccw != (s.cap == "up"):
                    b_, c_ = c_, b_
                tri = [ids[a_], ids[b_], ids[c_]]
                pts = flat[[a_, b_, c_]]
                aa = (pts - lo) / span * 0.9 + 0.05
                if mirror:
                    aa[:, 0] = 1 - aa[:, 0]
                F.append(tri + [-1])
                UV.append(np.concatenate([cisl.to_uv(aa[:, 0], aa[:, 1]), [[0, 0]]]))
                FM.append(names.index(m))
    if extra_v:
        verts = np.concatenate([verts, np.array(extra_v)])
    out = Mesh(verts, np.array(F, np.int64), np.array(UV, float), mats=names)
    out.fm = np.array(FM, np.int64)
    out.a["rest"] = verts.copy()
    return out


def _in_poly(poly, pts):
    x, y = pts[:, 0], pts[:, 1]
    ins = np.zeros(len(pts), bool)
    px, py = poly[:, 0], poly[:, 1]
    j = len(poly) - 1
    for i in range(len(poly)):
        ins ^= ((py[i] > y) != (py[j] > y)) & (x < (px[j] - px[i]) * (y - py[i]) / (py[j] - py[i] + 1e-30) + px[i])
        j = i
    return ins


def _fill_points(rings2d, step):
    """Points on a grid every `step` inside the outline (rings2d[0]), outside its holes, half a step from any edge."""
    outer = rings2d[0]
    lo, hi = outer.min(0), outer.max(0)
    xs = np.arange(lo[0] + step / 2, hi[0], step)
    ys = np.arange(lo[1] + step / 2, hi[1], step * 0.866)
    pts = np.array([(x + (step / 2 if i % 2 else 0), y) for i, y in enumerate(ys) for x in xs])
    if not len(pts):
        return np.zeros((0, 2))
    ok = _in_poly(outer, pts)
    for h in rings2d[1:]:
        ok &= ~_in_poly(h, pts)
    pts = pts[ok]
    for r in rings2d:
        a, b = r, np.roll(r, -1, 0)
        ab = b - a
        L2 = np.maximum((ab ** 2).sum(1), 1e-30)
        keep = np.ones(len(pts), bool)
        for i in range(0, len(pts), 2048):
            p = pts[i:i + 2048, None, :]
            t = np.clip(((p - a[None]) * ab[None]).sum(2) / L2[None], 0, 1)
            d = np.linalg.norm(p - (a[None] + t[..., None] * ab[None]), axis=2).min(1)
            keep[i:i + 2048] = d > step * 0.5
        pts = pts[keep]
    return pts


def _cdt(rings2d, inner):
    """Triangles over the outline and its holes with the inner points in them (indices: the rings' points in order,
    then the inner ones)."""
    from mathutils import Vector
    from mathutils.geometry import delaunay_2d_cdt
    pts = np.concatenate(rings2d + ([inner] if len(inner) else []))
    faces, o = [], 0
    for r in rings2d:
        faces.append(list(range(o, o + len(r))))
        o += len(r)
    vc, _, fcs, orig_v, _, _ = delaunay_2d_cdt([Vector(p) for p in pts], [], faces, 1, 1e-12)
    mapv = [ov[0] if ov else -1 for ov in orig_v]
    out = []
    for f in fcs:
        idx = [mapv[i] for i in f]
        if min(idx) < 0:
            continue
        c = pts[idx].mean(0)[None]
        if any(_in_poly(h, c)[0] for h in rings2d[1:]):
            continue
        out.append(idx)
    return out


def slab(loops, thick, bevel, islands, top="top", bottom="bottom", edge="edge", hole_edge=None, steps=3, mat=None, fill=None, step=None):
    """A flat part cut from a sheet `thick` metres thick with its edges rounded (a quarter circle of `bevel` at the top
    and at the bottom, `steps` rings each): the outline (and holes) as loft loops; top and bottom faces from above
    and below, the edge band all round."""
    b = min(bevel, thick / 2 * 0.999)
    h = thick / 2
    arc_t = [(-b * (1 - math.cos(a)), h - b + b * math.sin(a)) for a in np.linspace(math.pi / 2, 0, steps + 1)]
    arc_b = [(-b * (1 - math.cos(a)), -h + b - b * math.sin(a)) for a in np.linspace(0, math.pi / 2, steps + 1)]
    prof = arc_t + (arc_b if h - b > 1e-9 else arc_b[1:])
    # two runs: down to the last step (the top face capped at its start), then the last step (the bottom capped at its end)
    segs = [Seg(np.array(prof[:-1]), edge, "band", mat=mat, cap="up", cap_at="start", cap_island=top, cap_mirror=False, cap_fill=fill, step=step),
            Seg(np.array(prof[-2:]), edge, "band", mat=mat, cap="down", cap_at="end", cap_island=bottom, cap_fill=fill)]
    return loft(loops, segs, islands, hole_island=hole_edge)


def weld(m, tol=1e-7):
    """Vertices at one place made one (faces renumbered; UVs stay per corner)."""
    key = np.round(m.v / tol).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel()
    f = m.f.copy()
    f[f >= 0] = inv[f[f >= 0]]
    order = np.argsort(first)
    remap = np.empty_like(order)
    remap[order] = np.arange(len(order))
    f[f >= 0] = remap[f[f >= 0]]
    m.v = m.v[first[order]]
    m.a = {k: x[first[order]] for k, x in m.a.items()}
    m.f = f
    if len(m.sharp):
        m.sharp = remap[inv[m.sharp]]
    return m


def resample_loop(poly, step):
    """A closed outline's points every `step` metres or closer, keeping its corners."""
    p = np.asarray(poly, float)
    out = []
    for a, b in zip(p, np.roll(p, -1, 0)):
        L = np.linalg.norm(b - a)
        if L < 1e-9:
            continue
        n = max(1, int(math.ceil(L / step)))
        for k in range(n):
            out.append(a + (b - a) * k / n)
    return np.array(out)


def flip(m):
    """Turns a mesh's faces inside out (after a mirror): corners reversed, triangles' padding kept last."""
    f = m.f.copy()
    uv = m.uv.copy()
    tri = f[:, 3] < 0
    f[tri, :3] = f[tri, 2::-1]
    uv[tri, :3] = uv[tri, 2::-1]
    f[~tri] = f[~tri, ::-1]
    uv[~tri] = uv[~tri, ::-1]
    m.f, m.uv = f, uv
    return m


def sweep(path, section, island, mat=None, closed_section=True):
    """A cross-section carried along a path (k, 3) metres, turned with it (parallel transport): a handle, a wire, a
    straw's bend. section (m, 2) in the path's own frame (metres). Maps along the path (v) and round the section (u)."""
    P = np.asarray(path, float)
    S = np.asarray(section, float)
    k, m = len(P), len(S)
    T = np.gradient(P, axis=0)
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-12)
    up = np.array([0.0, 0.0, 1.0]) if abs(T[0, 2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    Nn = np.cross(up, T[0])
    Nn /= np.linalg.norm(Nn)
    frames = []
    for i in range(k):
        if i:
            Nn = Nn - T[i] * np.dot(Nn, T[i])
            Nn /= max(np.linalg.norm(Nn), 1e-12)
        Bn = np.cross(T[i], Nn)
        frames.append((Nn.copy(), Bn))
    v = np.concatenate([P[i][None] + S[:, :1] * frames[i][0][None] + S[:, 1:2] * frames[i][1][None] for i in range(k)])
    cols = m if closed_section else m - 1
    faces, uvs = [], []
    sl = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    sl /= max(sl[-1], 1e-12)
    for i in range(k - 1):
        for j in range(cols):
            j1 = (j + 1) % m
            faces.append([i * m + j, i * m + j1, (i + 1) * m + j1, (i + 1) * m + j])
            uvs.append(island.to_uv(np.array([j, j + 1, j + 1, j]) / cols, np.array([sl[i], sl[i], sl[i + 1], sl[i + 1]])))
    out = Mesh(v, np.array(faces, np.int64), np.array(uvs, float), mats=[mat or island.mat])
    out.a["rest"] = v.copy()
    return out

def tube(path, radii, island, n=10, mat=None, caps=(False, False), cap_bulge=0.6):
    """A round tube along a path (k, 3) metres, its radius per point (a bundle of straw, a rope's strand, a wire): a
    sweep of a circle, each ring scaled to its radius; `caps` closes the start and the end with a point `cap_bulge` of
    the radius beyond it. Maps round the tube (u) and along it (v)."""
    P = np.asarray(path, float)
    r = np.broadcast_to(np.asarray(radii, float), (len(P),)).copy()
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    m = sweep(P, np.stack([np.cos(a), np.sin(a)], 1), island, mat=mat)
    k = len(P)
    ring = m.v.reshape(k, n, 3)
    ring[:] = P[:, None, :] + (ring - P[:, None, :]) * r[:, None, None]
    m.v = ring.reshape(-1, 3)
    for end, on in ((0, caps[0]), (1, caps[1])):
        if not on:
            continue
        i = 0 if end == 0 else k - 1
        d = P[1] - P[0] if end == 0 else P[-1] - P[-2]
        d = d / max(np.linalg.norm(d), 1e-12)
        tip = P[i] + (-d if end == 0 else d) * r[i] * cap_bulge
        ti = len(m.v)
        m.v = np.concatenate([m.v, tip[None]])
        base = i * n
        f, uv = [], []
        vv = 0.0 if end == 0 else 1.0
        for j in range(n):
            j1 = (j + 1) % n
            f.append([base + j1, base + j, ti, -1] if end == 0 else [base + j, base + j1, ti, -1])
            us = np.array([j1 if j1 else n, j, j + 0.5]) / n if end == 0 else np.array([j, j1 if j1 else n, j + 0.5]) / n
            uv.append(np.concatenate([island.to_uv(us, np.full(3, vv)), [[0, 0]]]))
        m.f = np.concatenate([m.f, np.array(f, np.int64)])
        m.uv = np.concatenate([m.uv, np.array(uv)])
        m.fm = np.concatenate([m.fm, np.zeros(len(f), np.int64)])
        m.fs = np.concatenate([m.fs, np.ones(len(f), bool)])
    m.a["rest"] = m.v.copy()
    return m


def ring_path(c, axis, radius, n=24):
    """A closed circle of points (n + 1, the last the first) round centre c, square to axis: a binding, a torus's path."""
    ax = np.asarray(axis, float)
    ax = ax / np.linalg.norm(ax)
    up = np.array([0.0, 0.0, 1.0]) if abs(ax[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    u = np.cross(ax, up)
    u /= np.linalg.norm(u)
    w = np.cross(ax, u)
    t = np.linspace(0, 2 * math.pi, n + 1)
    return np.asarray(c, float)[None] + radius * (np.cos(t)[:, None] * u[None] + np.sin(t)[:, None] * w[None])


def rbox(size, bevel, islands, top="top", bottom="bottom", edge="edge", at=(0.0, 0.0, 0.0), corner=None, steps=3, fill=None, step=None, mat=None):
    """A box (w, d, h) metres standing on `at`, every edge rounded by `bevel` (its upright corners by `corner`): a slab
    of its rounded footprint. Its top and bottom map from above and below, its sides along the band round it."""
    from .paint import rrect_poly
    w, d, h = size
    c = bevel if corner is None else corner
    loop = rrect_poly(-w / 2, -d / 2, w, d, max(c, 1e-6), n=6)
    m = slab([loop], h, bevel, islands, top, bottom, edge, steps=steps, fill=fill, step=step, mat=mat)
    m.v += np.array([at[0], at[1], at[2] + h / 2])
    m.a["rest"] = m.v.copy()
    return m


def turn(m, R, about=(0.0, 0.0, 0.0), move=(0.0, 0.0, 0.0)):
    """A mesh turned by the 3x3 matrix R about a point, then moved (its rest position following)."""
    c = np.asarray(about, float)
    m.v = (m.v - c) @ np.asarray(R, float).T + c + np.asarray(move, float)
    m.a["rest"] = m.v.copy()
    return m


def rot(axis, deg):
    """The 3x3 rotation by `deg` degrees round 'x', 'y' or 'z'."""
    a = math.radians(deg)
    c, s_ = math.cos(a), math.sin(a)
    return {"x": np.array([[1, 0, 0], [0, c, -s_], [0, s_, c]]), "y": np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]]),
            "z": np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])}[axis]


def spline(pts, step):
    """A smooth curve through a profile's points (centripetal Catmull-Rom), its points about `step` apart (same units):
    a belly or a dome drawn with a few points comes out round, with points only where it bends."""
    p = np.asarray(pts, float)
    if len(p) < 3:
        return p
    q = np.concatenate([p[:1] * 2 - p[1:2], p, p[-1:] * 2 - p[-2:-1]])
    out = [p[0]]
    for i in range(1, len(q) - 2):
        p0, p1, p2, p3 = q[i - 1], q[i], q[i + 1], q[i + 2]
        t0 = 0.0
        t1 = t0 + max(np.linalg.norm(p1 - p0), 1e-9) ** 0.5
        t2 = t1 + max(np.linalg.norm(p2 - p1), 1e-9) ** 0.5
        t3 = t2 + max(np.linalg.norm(p3 - p2), 1e-9) ** 0.5
        n = max(1, int(math.ceil(np.linalg.norm(p2 - p1) / step)))
        for t in np.linspace(t1, t2, n + 1)[1:]:
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    return np.array(out)
