"""Rocks and stones (docs/research/rocks.md, PROPGEN §28): a boulder, a rock, a river stone, a flat slab, a patch of
pebbles, a cluster of rocks leaning together. The shape is a star-shaped radius about the rock's centre, in numpy on an
icosphere: an ellipsoid of a random aspect (sizes skewed small, as Blender's rock generator's presets), facets cut by
random planes (a fractured rock's flat faces) blended by a soft minimum whose width is the rounding (river stones
round, quarried rock crisp), Voronoi crackle lumps and a fractal swell (the generator's Voronoi and Musgrave layers),
a flat underside so it sits; on the detailed mesh alone cracks (a ridged noise over its threshold, cut in), pits
(basalt's vesicles, weathered granite) and grain. The game mesh is the same shape on a coarse icosphere; the bake
carries the rest as its normal map and occlusion. The paint reads the same fields by each texel's place: the stone's
tone mottled and tinted per facet, granite's speckles, sandstone's strata, the cracks darkened and dented, the cavities
dirtied by the bake's occlusion, moss where it faces up and sits low, lichen crusts, a wet band to a water line, dirt
at the foot.

    {"family": "rock", "kind": "boulder" | "stone" | "river" | "slab" | "pebbles" | "cluster",
     "stone": "granite" | "basalt" | "sandstone" | "limestone" | "slate" | "river", "size": 1.2 (m, the longest way),
     "aspect": [1, 0.85, 0.7], "facets": 0.6 (none to eight cuts), "rounding": 0.02 (of the size), "lumps": 0.1,
     "waves": 0.1, "cracks": 0.4, "pits": 0.2, "grain": 0.3, "flat": 0.3 (the underside cut, of the lower half),
     "moss": 0.3, "lichen": 0.2, "wet": 0 (a water line, of the height), "dirt": 0.3,
     "count": 4 (a cluster's rocks, a patch's pebbles), "seed": 1}
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N
from ..paint import rgb

# a stone: its tone, roughness, how much it speckles and with what (quartz, feldspar, mica), its mottling, strata, pits
STONES = {
    "granite":   dict(color="#6f6a64", rough=0.84, speckle=0.8, tones=["#b5afa6", "#9a8a80", "#2e2e30", "#58534d"], mottle=0.2, strata=0.0, pits=0.2),
    "basalt":    dict(color="#3b3c40", rough=0.8, speckle=0.25, tones=["#4e4f53", "#27282b"], mottle=0.1, strata=0.0, pits=0.6),
    "sandstone": dict(color="#a98a66", rough=0.92, speckle=0.3, tones=["#c2a47e", "#8a6e4e", "#b8a68a"], mottle=0.14, strata=1.0, pits=0.1),
    "limestone": dict(color="#a7a292", rough=0.88, speckle=0.3, tones=["#c4bfae", "#8c877a", "#b0a58d"], mottle=0.16, strata=0.3, pits=0.3),
    "slate":     dict(color="#4f545e", rough=0.72, speckle=0.15, tones=["#636873", "#3c4048"], mottle=0.1, strata=0.6, pits=0.0),
    "river":     dict(color="#7d7870", rough=0.58, speckle=0.5, tones=["#9c968c", "#5d5851", "#857868", "#8e8880", "#6c645a"], mottle=0.2, strata=0.0, pits=0.05),
}
# what a kind brings: the aspect (x the longest), facets 0..1 (none to eight cuts), rounding (of the size), lumps,
# waves, cracks, pits, grain, the underside's cut (of the lower half), the speckles' size (mm)
KINDS = {
    "boulder": dict(aspect=(1.0, 0.85, 0.72), facets=0.85, rounding=0.012, lumps=0.025, waves=0.05, cracks=0.4, pits=0.2, grain=0.5, flat=0.3, speck=4.0),
    "stone":   dict(aspect=(1.0, 0.8, 0.62), facets=0.7, rounding=0.02, lumps=0.03, waves=0.06, cracks=0.3, pits=0.2, grain=0.5, flat=0.25, speck=3.0),
    "river":   dict(aspect=(1.0, 0.75, 0.5), facets=0.15, rounding=0.14, lumps=0.012, waves=0.08, cracks=0.0, pits=0.03, grain=0.15, flat=0.2, speck=1.6),
    "slab":    dict(aspect=(1.0, 0.72, 0.22), facets=0.5, rounding=0.03, lumps=0.03, waves=0.05, cracks=0.3, pits=0.15, grain=0.3, flat=0.65, speck=3.0),
    "pebbles": dict(aspect=(1.0, 0.78, 0.5), facets=0.1, rounding=0.14, lumps=0.012, waves=0.08, cracks=0.0, pits=0.03, grain=0.12, flat=0.15, speck=1.2),
    "cluster": dict(aspect=(1.0, 0.85, 0.7), facets=0.8, rounding=0.015, lumps=0.03, waves=0.06, cracks=0.35, pits=0.2, grain=0.5, flat=0.3, speck=4.0),
}
MOSS = ["#4b6b2a", "#6a8a34", "#3d5a24", "#7d9a40"]
LICHEN = ["#a9b194", "#8e968b", "#c8903a", "#b9bfa6"]


def icosphere(level):
    """A unit icosphere: vertices (n, 3) and triangles (m, 3), 20 * 4^level of them."""
    t = (1 + 5 ** 0.5) / 2
    v = np.array([[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
                  [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]], float)
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    f = np.array([[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
                  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]], np.int64)
    for _ in range(level):
        e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
        e = np.sort(e, axis=1)
        key = e[:, 0] * (len(v) + 1) + e[:, 1]
        uniq, inv = np.unique(key, return_inverse=True)
        ue = np.stack([uniq // (len(v) + 1), uniq % (len(v) + 1)], 1)
        mid = v[ue[:, 0]] + v[ue[:, 1]]
        mid /= np.linalg.norm(mid, axis=1, keepdims=True)
        m01, m12, m20 = (inv[:len(f)] + len(v), inv[len(f):2 * len(f)] + len(v), inv[2 * len(f):] + len(v))
        v = np.concatenate([v, mid])
        f = np.concatenate([np.stack([f[:, 0], m01, m20], 1), np.stack([f[:, 1], m12, m01], 1),
                            np.stack([f[:, 2], m20, m12], 1), np.stack([m01, m12, m20], 1)])
    return v, f


def smin(a, b, k):
    """A soft minimum: the nearer of a and b, blended over k about where they meet (the rounding of a cut)."""
    if k <= 1e-9:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0) / k                        # 0 where they're k apart (an infinite b: 0)
    return np.minimum(a, b) - h * h * k / 4


def num(spec, kd, key):
    v = spec.get(key)
    return float(kd[key]) if v is None else float(v)


def params(spec, kind, seed, k, scale):
    """One rock's numbers: its aspect (leaning by the seed), yaw, the planes that cut its facets, its underside's cut,
    the rounding; `scale` its longest way in metres."""
    kd = KINDS[kind]
    r = N.rng(seed, "rock", k)
    aspect = np.array(spec.get("aspect") or kd["aspect"], float) * np.clip(1 + 0.1 * r.normal(size=3), 0.75, 1.25)
    aspect = aspect / aspect.max()
    facets = num(spec, kd, "facets")
    n_planes = int(round(8 * facets))
    planes = []
    while len(planes) < n_planes:
        n = r.normal(size=3)
        n /= np.linalg.norm(n)
        if n[2] < -0.3 or n[2] > 0.75:                                 # not from under (the underside is its own cut), nor a flat top
            continue
        support = math.sqrt(float(((aspect * n) ** 2).sum()))        # the ellipsoid's reach along n
        planes.append((n, support * r.uniform(0.58, 0.86)))
    flat = num(spec, kd, "flat")
    zb = aspect[2] * (1 - flat)                                       # the underside: the lower half cut this far up
    return dict(aspect=aspect, planes=planes, zb=zb, rounding=num(spec, kd, "rounding") * 2,   # of the size: twice, in half-sizes
                lumps=num(spec, kd, "lumps"), waves=num(spec, kd, "waves"), cracks=num(spec, kd, "cracks"),
                pits=num(spec, kd, "pits"), grain=num(spec, kd, "grain"), yaw=r.uniform(0, 2 * math.pi), scale=scale,
                seed=int(r.integers(0, 1 << 30)))


def warped(d, s):
    """The direction bent by a slow noise, so the cells it's read through are no tidy honeycomb."""
    return d + 0.22 * np.stack([N.fbm3(d * 2.3 + 7.1 * k, s + 71 + k, octaves=2) for k in range(3)], 1)


def fields(d, P):
    """The fine fields of a direction: the cracks (0..1), the pits (0..1), the grain (-1..1), the facet cells' ids."""
    s = P["seed"]
    dw = warped(d, s)
    f1c, f2c, cid = N.cells3(dw * 2.2, s + 3)
    seam = N.smoothstep(0.08, 0.012, (f2c - f1c) * 2.2)                              # the joints between the facet cells
    along = N.smoothstep(-0.1, 0.35, N.fbm3(d * 6 + 2.9, s + 29, octaves=2))         # a joint runs a way, then closes
    where = N.smoothstep(0.55 - 0.5 * P["cracks"], 0.85 - 0.4 * P["cracks"], 0.5 + 0.5 * N.fbm3(d * 2.5 + 1.3, s + 13, octaves=2))   # in patches
    ridge = N.ridged3(d * 5.5 + 7.7, s + 11, octaves=2)
    crack = np.clip(seam * along * where + 0.4 * N.smoothstep(0.88, 0.98, ridge) * where, 0, 1)
    f1, _, _ = N.cells3(d * 12, s + 17)
    pit = N.smoothstep(0.1, 0.03, f1 * 12) * N.smoothstep(-0.3, 0.3, N.fbm3(d * 3 + 9, s + 23, octaves=2))
    grain = N.fbm3(d * 28 + 5, s + 19, octaves=3) + 0.5 * N.fbm3(d * 90 + 2, s + 20, octaves=2)
    f1k, _, _ = N.cells3(d * 7 + 3.3, s + 21)
    chip = N.smoothstep(0.42, 0.2, f1k * 7) * N.smoothstep(-0.2, 0.3, N.fbm3(d * 4 + 6, s + 22, octaves=2))   # shallow angular chips
    return crack, pit, grain - 1.2 * chip, cid


def shape(d, P, fine):
    """Points of the rock for unit directions d (n, 3): on the ellipsoid, swollen and lumped, cut by its planes and its
    underside with the rounding, and with the fine detail when `fine`; in units of half its longest way."""
    q = d * P["aspect"]
    L = np.linalg.norm(q, axis=1)
    dirn = q / L[:, None]
    f1, f2, _ = N.cells3(warped(d, P["seed"]) * 2.2, P["seed"] + 3)
    lumps = P["lumps"] * np.clip((f2 - f1) * 2.2 * 1.8, 0, 1)
    waves = P["waves"] * N.fbm3(d * 1.8 + 3.1, P["seed"] + 5, octaves=3)
    R = L * (1 + lumps + waves)
    k = P["rounding"]
    for n, dist in P["planes"]:
        c = dirn @ n
        t = np.where(c > 0.03, dist / np.maximum(c, 0.03), np.inf)
        R = smin(R, t, k)
    c = -dirn[:, 2]
    t = np.where(c > 0.03, P["zb"] / np.maximum(c, 0.03), np.inf)
    R = smin(R, t, k * 0.6)
    if fine:
        crack, pit, grain, _ = fields(d, P)
        R = R * (1 - 0.016 * P["cracks"] * crack - 0.01 * P["pits"] * pit + 0.004 * P["grain"] * grain)
    return dirn * R[:, None]


def rock_mesh(level, P, fine):
    """The rock as a Mesh (metres, its centre at the origin, turned by its yaw), smooth-shaded, no UVs yet."""
    d, f = icosphere(level)
    pts = shape(d, P, fine) * (P["scale"] / 2) @ yaw_of(P).T
    return M.Mesh(pts, f, mats=["stone"])


def yaw_of(P):
    cy, sy = math.cos(P["yaw"]), math.sin(P["yaw"])
    return np.array([[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]])


def face_normals(m):
    t = m.f[:, :3]
    n = np.cross(m.v[t[:, 1]] - m.v[t[:, 0]], m.v[t[:, 2]] - m.v[t[:, 0]])
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def cube_uv(m, isl, lo, hi):
    """Each face's corners into one of six islands by its normal's main axis (a cube projection), the far side of each
    axis mirrored so no island reads inside out. isl: {"px": Island, "nx", "py", "ny", "pz", "nz"}."""
    fn = face_normals(m)
    ax = np.argmax(np.abs(fn), axis=1)
    sg = np.sign(fn[np.arange(len(fn)), ax])
    uv = np.zeros((len(m.f), 4, 2))
    ext = np.maximum(hi - lo, 1e-6)
    for a, (name_p, name_n, ua, va) in enumerate((("px", "nx", 1, 2), ("py", "ny", 0, 2), ("pz", "nz", 0, 1))):
        for s, name in ((1, name_p), (-1, name_n)):
            sel = np.nonzero((ax == a) & (sg == s))[0]
            if not len(sel):
                continue
            u0, v0, u1, v1 = isl[name].rect
            for c in range(3):
                p = m.v[m.f[sel, c]]
                uu = (p[:, ua] - lo[ua]) / ext[ua]
                vv = (p[:, va] - lo[va]) / ext[va]
                if s < 0:
                    uu = 1 - uu
                uv[sel, c, 0] = u0 + (u1 - u0) * uu
                uv[sel, c, 1] = v0 + (v1 - v0) * vv
    m.uv = uv


def top_uv(m, isl_top, isl_under, lo, hi):
    """Two islands: what faces up or sideways projected from above, the rest from below (a patch of pebbles)."""
    fn = face_normals(m)
    up = fn[:, 2] >= -0.25
    uv = np.zeros((len(m.f), 4, 2))
    ext = np.maximum(hi - lo, 1e-6)
    for sel, isl, flipu in ((np.nonzero(up)[0], isl_top, False), (np.nonzero(~up)[0], isl_under, True)):
        if not len(sel):
            continue
        u0, v0, u1, v1 = isl.rect
        for c in range(3):
            p = m.v[m.f[sel, c]]
            uu = (p[:, 0] - lo[0]) / ext[0]
            vv = (p[:, 1] - lo[1]) / ext[1]
            if flipu:
                uu = 1 - uu
            uv[sel, c, 0] = u0 + (u1 - u0) * uu
            uv[sel, c, 1] = v0 + (v1 - v0) * vv
    m.uv = uv


def levels(scale):
    """The icosphere levels for a rock this big: the game mesh's and the detailed one's."""
    if scale >= 0.8:
        return 3, 6
    if scale >= 0.3:
        return 2, 5
    return 1, 4


def layout(spec, kind, seed, size):
    """Where each rock of the thing goes: [(k, scale, offset)], the first at the origin."""
    r = N.rng(seed, "layout")
    if kind == "cluster":
        n = max(2, min(6, int(spec.get("count", 4))))
        fac = [1.0, 0.62, 0.5, 0.42, 0.36, 0.3][:n]
        out = [(0, size, np.zeros(3))]
        ang = r.uniform(0, 2 * math.pi)
        for k in range(1, n):
            ang += r.uniform(1.4, 2.6)
            dist = (size + size * fac[k]) / 2 * 0.72
            out.append((k, size * fac[k], np.array([math.cos(ang) * dist, math.sin(ang) * dist, 0.0])))
        return out
    if kind == "pebbles":
        n = max(3, min(80, int(spec.get("count", 34))))
        out, tries = [], 0
        while len(out) < n and tries < 800:
            tries += 1
            s = r.uniform(0.06, 0.2) * size
            p = r.uniform(-1, 1, size=2) * (size / 2 - s / 2)
            if np.hypot(*p) > size / 2 - s / 2:
                continue
            if all(np.hypot(*(p - o[2][:2])) > (s + o[1]) / 2 * 0.7 for o in out):
                out.append((len(out), s, np.array([p[0], p[1], 0.0])))
        return out
    return [(0, size, np.zeros(3))]


def make(spec, th):
    kind = spec.get("kind", "boulder")
    if kind not in KINDS:
        raise ValueError(f"rock: no kind {kind!r} ({', '.join(KINDS)})")
    stone = STONES.get(spec.get("stone", "granite"), STONES["granite"])
    seed = int(spec.get("seed", 0))
    size = float(spec.get("size", {"boulder": 1.2, "stone": 0.6, "river": 0.35, "slab": 0.9, "pebbles": 0.5, "cluster": 1.2}[kind]))
    kd = KINDS[kind]
    tex = int(spec.get("tex", 1024))
    th.material("stone", "stone", px=tex, color=stone["color"], rough=stone["rough"])
    rocks = []                                   # (P, offset, low Mesh, high Mesh)
    for k, scale, off in layout(spec, kind, seed, size):
        P = params(spec, "river" if kind == "pebbles" else kind, seed, k, scale)
        if kind == "pebbles":
            P["pits"] = 0.0
        lo_l, hi_l = levels(scale)
        if kind == "pebbles":
            lo_l, hi_l = 1, 4
        low, high = rock_mesh(lo_l, P, False), rock_mesh(hi_l, P, True)
        orig = off + np.array([0.0, 0.0, -high.v[:, 2].min()])    # where the rock's own origin lands: its underside on the floor
        for m in (low, high):
            m.v += orig
        rocks.append((P, orig, low, high))
    # islands: a cube projection a rock (six faces of its box, in mm), or a patch's top and underside
    if kind == "pebbles":
        allv = np.concatenate([r[3].v for r in rocks])
        lo, hi = allv.min(0), allv.max(0)
        mm = (hi - lo) * 1000
        top = th.island("top", mm[0], mm[1], mat="stone")
        under = th.island("under", mm[0], mm[1], mat="stone")
        th.pack()
        for P, off, low, high in rocks:
            top_uv(low, top, under, lo, hi)
            top_uv(high, top, under, lo, hi)
    else:
        boxes = []
        for i, (P, off, low, high) in enumerate(rocks):
            lo, hi = high.v.min(0), high.v.max(0)
            mm = (hi - lo) * 1000
            boxes.append((lo, hi))
            for nm, (w, h) in (("px", (mm[1], mm[2])), ("nx", (mm[1], mm[2])), ("py", (mm[0], mm[2])), ("ny", (mm[0], mm[2])),
                               ("pz", (mm[0], mm[1])), ("nz", (mm[0], mm[1]))):
                th.island(f"{i}{nm}", w, h, mat="stone")
        th.pack()
        for i, (P, off, low, high) in enumerate(rocks):
            isl = {nm: th.islands[f"{i}{nm}"] for nm in ("px", "nx", "py", "ny", "pz", "nz")}
            cube_uv(low, isl, *boxes[i])
            cube_uv(high, isl, *boxes[i])
    th.low = M.join([r[2] for r in rocks], ["stone"])
    th.high = M.join([r[3] for r in rocks], ["stone"])
    # the detailed mesh kept inside the game mesh's box (its grain pokes a millimetre or two past it), so the thing is set
    # down and centred by the game mesh, the one a level places (PROPGEN's check: on the floor, centred)
    lo, hi = th.low.v.min(0), th.low.v.max(0)
    th.high.v = np.clip(th.high.v, lo, hi)
    th.low.a["rest"] = th.low.v.copy()
    th.pose = "stand"
    th.cage = max(0.004, 0.02 * size)
    th.reach = max(0.012, 0.08 * size)
    th.sharp_angle = None
    th.view = {"azim": -35, "elev": 22, "lens": 50}
    th.paint = lambda fr: None
    centres = [(orig, P, float(high.v[:, 2].min()), float(high.v[:, 2].max()), high.v.min(0), high.v.max(0)) for P, orig, low, high in rocks]
    moss, lichen, wet, dirt = (float(spec.get(k, d)) for k, d in (("moss", 0.0), ("lichen", 0.0), ("wet", 0.0), ("dirt", 0.3)))
    speck_mm = float(spec.get("speck", kd["speck"]))
    speckle = float(spec.get("speckle", stone["speckle"]))
    strata = float(spec.get("strata", stone["strata"]))

    def texel_paint(mname, cv, tx):
        hit = tx["hit"]
        cv.used |= hit
        Pm = tx["rest"][hit]
        nrm = tx["nrm"][hit]
        ao = np.clip(tx["ao"][hit], 0, 1)
        curv = tx["curv"][hit]
        n = len(Pm)
        if not n:
            return
        # which rock each texel is on (the nearest centre, by its own size), its direction from it, its height on it
        best = np.full(n, np.inf)
        who = np.zeros(n, np.int64)
        for i, (c, P, z0, z1, lo, hi) in enumerate(centres):
            dd = np.linalg.norm((Pm - c) / ((hi - lo) / 2 + 1e-6), axis=1)
            closer = dd < best
            best[closer] = dd[closer]
            who[closer] = i
        col = np.empty((n, 3), np.float32)
        rough = np.full(n, stone["rough"], np.float32)
        height = np.zeros(n, np.float32)
        base = rgb(stone["color"])
        tones = np.array([rgb(c) for c in stone["tones"]], np.float32)
        mossc = np.array([rgb(c) for c in MOSS], np.float32)
        lichc = np.array([rgb(c) for c in LICHEN], np.float32)
        for i, (c, P, z0, z1, lo, hi) in enumerate(centres):
            sel = np.nonzero(who == i)[0]
            if not len(sel):
                continue
            p = Pm[sel]
            d = (p - c) @ yaw_of(P)                                 # back into the rock's own frame: the fields the shape read
            d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
            z01 = np.clip((p[:, 2] - z0) / max(z1 - z0, 1e-6), 0, 1)
            s = P["seed"]
            crack, pit, grain, cid = fields(d, P)
            crack = crack * min(1.0, P["cracks"] * 1.5)
            rk = N.rng(s, "tone")                                     # this stone's own tone: river stones each their own
            own = 0.28 if stone is STONES["river"] else 0.1
            base = rgb(stone["color"]) * (1 + own * (rk.uniform() * 2 - 1)) * np.array([1 + own * 0.3 * (rk.uniform() * 2 - 1), 1.0, 1 - own * 0.3 * (rk.uniform() * 2 - 1)])
            rr = np.full(len(sel), stone["rough"], np.float32)
            hh = np.zeros(len(sel), np.float32)
            # the tone: mottled slow and fast by place, tinted per facet, a little warmer or cooler in patches
            mot = 1 + stone["mottle"] * (1.3 * N.fbm3(p * 3.5 + 0.7, s + 31, octaves=2) + 0.8 * N.fbm3(p * 14 + 0.7, s + 32, octaves=3))
            tint = 1 + 0.06 * ((cid % 97) / 48.0 - 1)
            warm = 0.04 * N.fbm3(p * 2 + 5.5, s + 33, octaves=2)
            cc = base[None] * (mot * tint)[:, None] * np.stack([1 + warm, np.ones_like(warm), 1 - warm], 1)
            # streaks run down the sides (water's stains), where the rock faces out, not up
            side = np.clip(1 - np.abs(nrm[sel][:, 2]) * 1.6, 0, 1)
            streak = N.smoothstep(0.55, 0.9, 0.5 + 0.5 * N.fbm3(np.stack([p[:, 0] * 22, p[:, 1] * 22, p[:, 2] * 2.5], 1), s + 34, octaves=3)) * side
            cc = cc * (1 - 0.22 * streak)[:, None]
            # the speckles: a fine cellular noise, each grain a mineral
            if speckle > 0:
                f1s, _, ids = N.cells3(p * (1000.0 / speck_mm), s + 37)
                grain_in = N.smoothstep(0.34, 0.18, f1s * (1000.0 / speck_mm))
                tone = tones[ids % len(tones)]
                w = (grain_in * speckle * 0.9 * ((ids // 7) % 2 == 0))[:, None]     # every other grain the stone's own tone
                cc = cc + (tone - cc) * w
                hh += 0.04 * speckle * grain_in
            # strata: bands with the height, warped
            if strata > 0:
                band = 0.5 + 0.5 * np.sin(p[:, 2] * (2 * math.pi / 0.09) + 2.6 * N.fbm3(p * 4 + 2, s + 41, octaves=2))
                thick = N.smoothstep(-0.4, 0.4, N.fbm3(p * 1.5 + 8, s + 42, octaves=2))
                cc = cc * (1 - 0.16 * strata * band * thick)[:, None]
            # the grain's relief and roughness
            hh += 0.3 * P["grain"] * grain + 0.12 * N.fbm3(p * 400, s + 61, octaves=3) + 0.05 * N.fbm3(p * 1400, s + 62, octaves=2)
            rr += 0.08 * grain
            # the cracks: darker, rougher, cut in
            cc = cc * (1 - 0.45 * crack)[:, None]
            rr += 0.1 * crack
            hh -= 0.45 * crack
            # pits: darker, dented
            cc = cc * (1 - 0.3 * pit * P["pits"])[:, None]
            hh -= 0.3 * pit * P["pits"]
            # the cavities: dirt by the bake's occlusion and the creases
            cav = np.clip((1 - ao[sel]) * 1.3 + np.clip(-curv[sel], 0, 1) * 0.4, 0, 1)
            dirtc = rgb("#4a4238")
            cc = cc + (dirtc[None] - cc) * (0.45 * cav * (0.4 + 0.6 * dirt))[:, None]
            rr += 0.1 * cav
            # moss: where it faces up, sits low and shades, in patches
            mask_m = np.zeros(len(sel), np.float32)
            if moss > 0:
                big = 0.5 + 0.5 * N.fbm3(p * 2.6 + 4.2, s + 43, octaves=3)                     # the patches
                fine = 0.5 + 0.5 * N.fbm3(p * 40 + 1.1, s + 44, octaves=2)                     # their ragged edge
                patch = N.smoothstep(0.6 - 0.38 * moss, 0.78 - 0.3 * moss, big * 0.85 + fine * 0.15)
                up = np.clip(nrm[sel][:, 2], 0, 1)
                mask_m = np.clip(patch * (0.3 + 0.7 * up) * (0.55 + 0.45 * (1 - z01)) * (0.75 + 0.25 * cav), 0, 1)
                mossv = mossc[(N.cells3(p * 30, s + 47)[2] % len(mossc))]
                mc = mossv * (0.85 + 0.3 * fine)[:, None]
                cc = cc + (mc - cc) * mask_m[:, None]
                rr = rr + (0.93 - rr) * mask_m
                hh += 0.4 * mask_m
            # lichen: crusts on the sun side, where no moss
            if lichen > 0:
                f1l, _, idl = N.cells3(p * 22, s + 57)
                crust = N.smoothstep(0.34 * math.sqrt(lichen), 0.22 * math.sqrt(lichen), f1l * 22)
                crust = crust * (idl % 5 < max(1, int(round(lichen * 4)))) * (nrm[sel][:, 2] > -0.15) * (1 - mask_m) ** 2
                lc = lichc[idl % len(lichc)]
                cc = cc + (lc - cc) * (0.85 * crust)[:, None]
                rr = rr + (0.95 - rr) * crust
                hh += 0.12 * crust
            # wet to the water line: darker and glossy, a pale line at the surface
            if wet > 0:
                under = N.smoothstep(wet + 0.015, wet - 0.015, z01)
                cc = cc * (1 - 0.45 * under)[:, None]
                rr = rr + (0.16 - rr) * under
                line = np.exp(-((z01 - wet) / 0.012) ** 2)
                cc = cc + (rgb("#cfc8b6")[None] - cc) * (0.3 * line)[:, None]
            # dirt at the foot
            foot = N.smoothstep(0.14, 0.0, z01) * dirt
            cc = cc + (rgb("#5a4a3a")[None] - cc) * (0.6 * foot)[:, None]
            rr = rr + (0.95 - rr) * foot
            col[sel] = np.clip(cc, 0, 1)
            rough[sel] = rr
            height[sel] = hh
        cv.col[hit] = col
        cv.rough[hit] = np.clip(rough, 0.05, 1)
        cv.metal[hit] = 0.0
        cv.height[hit] = height

    th.texel_paint = texel_paint
    return th
