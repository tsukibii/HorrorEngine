"""Curtains (the user, 2026-11-04: "a curtain generator prop that uses a bit of drape physics to get more natural
curtains ... how many sides (1 curtain or 2 on each side), you add the height and length of the window and it
generates curtains"; the technique: docs/research/curtains.md). A window's curtains on their rail or rod, made for the
window: its opening's size (`window`, mm wide and high) and its sill's height (`sill`) set the rail's length and height
and the curtains' drop; `panels` 1 or 2.

The way (shape it, then let it settle): each panel's hung shape is built from its heading's own geometry (a wave's
carriers with the cloth bulging front and back between them, pinch pleats pinched in threes, grommets on a rod, a rod
pocket's gathers, a flat heading's hooks), every row as long across as the cloth is wide, the folds a little wider and
softer toward the hem; the heading pinned and the rest settled by the cloth simulation (sim.Cloth): gravity, the bend
(its rest the shaped folds at the top, flatter toward the hem), tethers (each point kept within its rest distance of
the heading, so the cloth can't stretch), a tie-back's ring drawn in, the wall, the window's frame and the floor (a
pooling hem) in the way. The fine creases, the hems' stitching and the weave in the detailed copy, baked.

    {"family": "curtain", "window": [1800, 1300], "sill": 800, "panels": 2, "heading": "pinch", "length": "floor",
     "open": 0.2, "fabric": "cotton", "cover": {"color": "#8a6f5a"}, "rod": {"kind": "rail"}}
    ... "tie": {"at": 0.42, "bundle": 150}: each panel gathered to its side at 0.42 of its hang (from the hem)

Set down with the floor under the window's middle at the origin and the wall's face at y = 0, the curtains in front
of it (-y: facing the room): in a level, at the window's middle on the wall's face, turned as the wall faces; its box
from there in meta.json's `box_m` (keep_z: its heights as made).
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N
from .. import sim
from .bedding import grid_normals, paint_cover, sheet_grid

# the page's settings (PROPGEN §13: a family's own, picked from a list), their choices and a list's labels
FIELDS = {"window": [1800, 1300], "sill": 800, "panels": 2, "side": "left", "heading": "pinch", "fullness": 2.2, "pitch": 120,
          "length": "floor", "open": 0.15, "tie": {"at": 0.42, "bundle": 150, "depth": 90}, "fabric": "cotton",
          "rod": {"kind": "rail", "over": 150, "above": 120, "out": 200, "d": 25, "color": "#e6e4de", "metal": 0.0, "finial": "ball"},
          "cover": {"color": "#a89a80", "pattern": "plain", "rough": 0.9}, "air": 1.0, "flare": 0.08, "relax": 0.35, "settle": 150}
CHOICES = {"side": ["left", "right"], "heading": ["pinch", "wave", "grommet", "gather", "flat"], "length": ["floor", "sill", "below", "puddle"],
           "fabric": ["sheer", "cotton", "linen", "blackout", "velvet"], "rod.kind": ["rail", "track", "rod", "none"],
           "rod.finial": ["ball", "cap"], "cover.pattern": ["plain", "stripes", "check", "dots", "seigaiha"]}
LABELS = {"window": ["width", "height"]}

# fabric: thickness (mm), the bend's stiffness, roughness, opacity (a sheer is see-through)
FABRICS = {
    "sheer": dict(thick=0.6, stiff=0.012, rough=0.8, opacity=0.4),
    "cotton": dict(thick=1.2, stiff=0.03, rough=0.9, opacity=1.0),
    "linen": dict(thick=1.5, stiff=0.04, rough=0.93, opacity=1.0),
    "blackout": dict(thick=3.0, stiff=0.07, rough=0.88, opacity=1.0),
    "velvet": dict(thick=2.5, stiff=0.05, rough=0.55, opacity=1.0),
}
# heading: fullness (cloth over rail), pitch (mm between pleats, carriers, grommets, gathers or hooks), header (mm
# pinned: the heading tape, the grommets' band, the rod pocket), stack (mm of rail a fold takes drawn fully open),
# its rod by default (docs/research/curtains.md's numbers)
HEADINGS = {
    "pinch": dict(fullness=2.2, pitch=120, header=80, stack=34, rod="rail"),
    "wave": dict(fullness=2.0, pitch=72, header=40, stack=16, rod="track"),
    "grommet": dict(fullness=1.8, pitch=160, header=90, stack=58, rod="rod"),
    "gather": dict(fullness=2.5, pitch=40, header=55, stack=9, rod="rod"),
    "flat": dict(fullness=1.3, pitch=120, header=40, stack=24, rod="rail"),
}

# a half sine's length over its chord for its height over its chord (k): inverted to find a fold's depth
_KS = np.concatenate([np.linspace(0.0, 2.0, 801), np.linspace(2.005, 60.0, 2000)])
_TT = np.linspace(0.0, 1.0, 257)
_trap = getattr(np, "trapezoid", None) or np.trapz
_RATIO = _trap(np.sqrt(1.0 + (_KS[:, None] * math.pi * np.cos(math.pi * _TT[None])) ** 2), _TT, axis=1)


def fold_depth(chord, arc):
    """The height of a half sine over `chord` whose length is `arc` (a fold's depth: the cloth between two carriers)."""
    r = np.maximum(np.asarray(arc, float) / np.maximum(np.asarray(chord, float), 1e-6), 1.0)
    return np.interp(r, _RATIO, _KS) * chord


def _sizes(spec):
    """The window and what hangs at it, metres: (W, H, sill, rod dict, z of the rod, x ends of the rod)."""
    W, H = [float(v) * 0.001 for v in spec.get("window", (1800, 1300))]
    sill = float(spec.get("sill", 800)) * 0.001
    hd = HEADINGS[spec.get("heading", "pinch")]
    rod = dict({"kind": hd["rod"], "over": 150, "above": 120, "out": 200, "d": 25, "color": "#e6e4de", "metal": 0.0,
                "finial": "ball"}, **(spec.get("rod") or {}))
    over, above = float(rod["over"]) * 0.001, float(rod["above"]) * 0.001
    z_rod = sill + H + above
    return W, H, sill, rod, z_rod, (-(W / 2 + over), W / 2 + over)


def _top_edge(heading, rod, z_rod):
    """Where the cloth's top edge is for its heading on its rod (the hooks under a rail, rings under a rod, a grommet's
    band round it, a pocket over it)."""
    kind, d = rod["kind"], float(rod["d"]) * 0.001
    if kind in ("rail", "track", "none"):
        return z_rod - 0.012
    if heading == "grommet":
        return z_rod + 0.045
    if heading == "gather":
        return z_rod + 0.03
    return z_rod - d / 2 - 0.032                       # rings on the rod, the cloth hooked below them


def _hem(spec, sill):
    ln = spec.get("length", "floor")
    if isinstance(ln, (int, float)):
        return sill - float(ln) * 0.001
    return {"sill": sill + 0.01, "below": sill - 0.15, "floor": 0.012, "puddle": -0.1}[ln]


def _crossings(heading, F, S_closed, S, pitch, r):
    """The heading's crossings below its tape: the cloth's places u (fabric metres from the panel's home end) and the
    rail's x (from the home end) where its folds cross the rail's line, and each fold's side (-1 toward the room)."""
    if heading == "pinch":
        n = max(2, int(round(S_closed / pitch)))
        cell = F / n
        space = min(1.08 * S_closed / n, 0.5 * cell)             # the flat between two pleats, a little fuller than its chord
        pleat = cell - space
        jit = 1 + 0.08 * r.uniform(-1, 1, n)
        fronts = (pleat + 0.5 * space) * jit                     # each pleat's fold to the front with half its spaces
        backs = np.full(n + 1, 0.5 * space)                      # the spaces' folds to the back; the ends half ones
        backs[0] = backs[-1] = 0.25 * space
        fab = np.empty(2 * n + 1)
        fab[0::2], fab[1::2] = backs, fronts
        fab *= F / fab.sum()
        xr = np.concatenate([[0.0], (np.arange(2 * n) + 0.5) / (2 * n), [1.0]])   # crossings at the cells' quarters
        sides = np.where(np.arange(2 * n + 1) % 2 == 1, -1.0, 1.0)
    else:
        n = max(2, int(round(S_closed / pitch)))
        jit = {"gather": 0.35, "flat": 0.06}.get(heading, 0.08)
        fab = (F / n) * (1 + jit * r.uniform(-1, 1, n))
        fab *= F / fab.sum()
        xr = np.linspace(0, 1, n + 1)
        xr[1:-1] += r.uniform(-0.05, 0.05, n - 1) / n
        sides = np.where(np.arange(n) % 2 == 0, -1.0, 1.0)
    u = np.concatenate([[0.0], np.cumsum(fab)])
    return u, xr * S, sides


def _row(u_cols, u, x, sides, depth_scale=1.0):
    """One row of the hung cloth: for each column's fabric place, its (x along the rail, y out from the curtain's line);
    the cloth between crossings a half sine as deep as its length over its chord asks (scaled by depth_scale)."""
    pts = []
    for k in range(len(sides)):
        chord, arc = max(x[k + 1] - x[k], 1e-5), u[k + 1] - u[k]
        A = float(fold_depth(chord, arc)) * depth_scale
        t = _TT[:-1] if k < len(sides) - 1 else _TT
        pts.append(np.stack([x[k] + t * chord, sides[k] * A * np.sin(math.pi * t)], 1))
    P = np.concatenate(pts)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    want = u_cols * (s[-1] / max(u[-1], 1e-9))                   # by length along it (scaled: a shallower row is shorter)
    return np.stack([np.interp(want, s, P[:, 0]), np.interp(want, s, P[:, 1])], 1)


def _pinch_head(u_cols, F, S_closed, S, pitch, r):
    """The pinch pleats' tape row: each pleat's cloth taken up in one narrow loop standing to the room (its three
    pinched folds are finer than the cloth's grid: they're the stitching and the bake's), the spaces between flat on
    the rail's line."""
    n = max(2, int(round(S_closed / pitch)))
    cell = F / n
    space = min(1.08 * S_closed / n, 0.5 * cell)
    pleat = cell - space
    w = min(0.026, 0.4 * S / n)                                  # the loop's width where it's pinched
    pts = [[0.0, 0.0]]
    for i in range(n):
        xc = S * (i + 0.5) / n
        depth = max(0.006, (pleat - 0.6 * w) / 2)                # a narrow half ellipse as long as the pleat's cloth
        a = np.linspace(0, math.pi, 13)
        pts += [[xc - (w / 2) * math.cos(t), -depth * math.sin(t)] for t in a]
    pts.append([S, 0.0])
    P = np.array(pts)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    want = u_cols * (s[-1] / max(F, 1e-9))
    return np.stack([np.interp(want, s, P[:, 0]), np.interp(want, s, P[:, 1])], 1)


def _panel(spec, fab, z_top, z_hem, home, span_closed, S, single, plane_y, seed, r, step):
    """One panel's cloth hung, settled: (grid (ny, nx, 3), flat (ny, nx, 2), F, Hc, the tie's band's points or None,
    the rings' or grommets' x on the rod, the tie-back's middle or None)."""
    heading = spec.get("heading", "pinch")
    hd = HEADINGS[heading]
    fullness = float(spec.get("fullness", hd["fullness"]))
    pitch = float(spec.get("pitch", hd["pitch"])) * 0.001
    header = float(spec.get("header", hd["header"])) * 0.001
    F = fullness * span_closed
    Hc = z_top - z_hem
    flat, T, nx, ny = sheet_grid(F, Hc, step)
    FG = flat.reshape(ny, nx, 2)
    u_cols = FG[0, :, 0]
    w_rows = FG[:, 0, 1]                                         # up from the hem; the top at Hc
    v_rows = Hc - w_rows                                         # down from the top
    u, xr, sides = _crossings(heading, F, span_closed, S, pitch, r)
    nfold = len(sides)
    lean = r.normal(0, 0.22, nfold + 1) * min(pitch, S / max(nfold, 1)) * 1.6
    lean[0] = lean[-1] = 0.0
    open_ = float(spec.get("open", 0.0))
    flare = float(spec.get("flare", 0.05 + 0.3 * open_))
    anchor = S / 2 if single else S                             # it flares out from its inner edge (both ways alone)
    head_row = _pinch_head(u_cols, F, span_closed, S, pitch, r) if heading == "pinch" else None
    relax = float(spec.get("relax", 0.35))
    rings = home + (1.0 if home < 0 else -1.0) * ((np.arange(max(2, int(round(span_closed / pitch)))) + 0.5) / max(2, int(round(span_closed / pitch))) * S
                                                  if heading == "pinch" else xr)
    G = np.zeros((ny, nx, 3))
    for j in range(ny):
        v = v_rows[j]
        t = float(np.clip((v - header) / max(Hc - header, 1e-6), 0, 1))
        x = anchor + (xr - anchor) * (1 + flare * t) + lean * t ** 1.5
        row = _row(u_cols, u, x, sides, depth_scale=1.0)
        if head_row is not None:                                 # pinch pleats: the tape's clusters, eased into the folds below
            b = float(np.clip((v - header) / 0.14, 0, 1)) if v > header else 0.0
            b = b * b * (3 - 2 * b)
            row = head_row * (1 - b) + row * b
        G[j, :, 0] = row[:, 0]
        G[j, :, 1] = row[:, 1]
        G[j, :, 2] = z_top - v
    # to the world: from the home end inward; columns kept left to right (the cover to the room)
    sgn = 1.0 if home < 0 else -1.0
    G[..., 0] = home + sgn * G[..., 0]
    G[..., 1] = plane_y + G[..., 1]
    if sgn < 0:
        G = G[:, ::-1].copy()
    pad = fab["thick"] * 0.0005 + 0.002
    low = G[..., 2] < pad                                        # a pooling hem: what's below the floor laid out along it
    if low.any():
        G[..., 1] = np.where(low, G[..., 1] - (pad - G[..., 2]) * 0.8, G[..., 1])
        G[..., 2] = np.where(low, pad, G[..., 2])
    cl = sim.Cloth(G.reshape(-1, 3), T, flat, stiff=float(spec.get("stiff", fab["stiff"])), thick=fab["thick"] * 0.001)
    cl.d = float(spec.get("collide", 0.012))
    rows_pinned = v_rows <= header + 1e-6
    pin_idx = np.nonzero(np.repeat(rows_pinned, nx))[0]
    cl.pinned[pin_idx] = True
    # tethers: each point no further from its column's lowest pinned point than the cloth between them
    jh = int(np.nonzero(rows_pinned)[0].min())
    col = np.tile(np.arange(nx), ny)
    rowi = np.repeat(np.arange(ny), nx)
    free = rowi < jh
    ti = (jh * nx + col)[free]
    tj = np.nonzero(free)[0]
    td = w_rows[jh] - w_rows[rowi[free]]
    cl.ties = (ti, tj, td)
    # the bend's rest: the shaped folds near the heading, flatter toward the hem (they soften as they fall)
    bt = (v_rows[rowi[cl.B[:, 0]]] + v_rows[rowi[cl.B[:, 1]]]) / 2
    bt = np.clip((bt - header) / max(Hc - header, 1e-6), 0, 1)
    cl.D0 = cl.D0 * (1 - relax * bt) + cl.Dflat * relax * bt
    # the wall behind and the window's frame standing into the room, in the way
    W, H, sill = spec["_W"], spec["_H"], spec["_sill"]
    fo = float(spec.get("frame_out", 120)) * 0.001
    boxes = [((-20.0, 0.0, -1.0), (20.0, 1.0, 10.0), 0.0)]
    if fo > 0:
        boxes.append(((-W / 2 - 0.06, -fo, sill - 0.04), (W / 2 + 0.06, 0.0, sill + H + 0.06), 0.004))
    tie = spec.get("tie")
    extra, band = None, None
    steps = int(spec.get("settle", 150))
    if tie:
        at = float(tie.get("at", 0.42))
        w_tie = at * Hc
        band = np.nonzero(np.abs(w_rows[rowi] - w_tie) <= step * 0.75)[0]
        bw = float(tie.get("bundle", 150)) * 0.001
        bd = float(tie.get("depth", 90)) * 0.001
        outer = home
        c1 = np.array([outer + (bw / 2 + 0.03) * (1 if outer < 0 else -1), plane_y - 0.005])
        Pb = cl.X[band, :2]
        c0 = (Pb.max(0) + Pb.min(0)) / 2
        r0 = (Pb.max(0) - Pb.min(0)) / 2 + 0.02
        r1 = np.array([bw / 2, bd / 2])
        state = {"k": 0}
        draw_in = max(1, int(steps * 0.5))

        def ring(P, X0):
            e = min(1.0, state["k"] / draw_in)
            e = e * e * (3 - 2 * e)
            c, rr = c0 + (c1 - c0) * e, r0 + (r1 - r0) * e
            q = P[band, :2] - c
            m = (q[:, 0] / rr[0]) ** 2 + (q[:, 1] / rr[1]) ** 2
            out = m > 1.0
            if out.any():
                P[band[out], :2] = c + q[out] / np.sqrt(m[out])[:, None]
        extra = ring
    # a breeze while it settles (gone by half way): the folds pushed about a little, so no two hang alike
    air = float(spec.get("air", 1.0)) * 0.0012
    q = np.stack([cl.flat[:, 0] / 0.5, cl.flat[:, 1] / 0.7, np.full(cl.n, seed * 0.13)], 1)
    gust = np.stack([N.fbm3(q, seed + 41, 2) * 0.4, N.fbm3(q, seed + 42, 2), np.zeros(cl.n)], 1) * air
    gust[cl.pinned] = 0.0
    for k in range(steps):
        if tie:
            state["k"] = k
        a = max(0.0, 1.0 - k / (0.5 * steps))
        if a > 0:
            cl.V += gust * a * math.sin(k * 0.21 + seed)
        cl.step(gravity=float(spec.get("gravity", 0.0005)), damping=0.86, iters=int(spec.get("iters", 10)), boxes=boxes,
                floor=0.0, friction=0.75, collide=True, extra=extra)
    return cl.X.reshape(ny, nx, 3), FG, F, Hc, band, np.sort(rings), (c1 if tie else None)


def _creases(FG, seed, amp):
    """Fine creases running down the cloth (metres, along its normal): long ridges a few centimetres across."""
    q = np.stack([FG[..., 0] / 0.035, FG[..., 1] / 0.32, np.full(FG.shape[:2], seed * 0.37)], -1).reshape(-1, 3)
    rdg = N.ridged3(q, seed + 21, 3).reshape(FG.shape[:2]) - 0.5
    f = N.fbm3(q * np.array([0.5, 2.0, 1.0]), seed + 22, 2).reshape(FG.shape[:2])
    return amp * (0.75 * rdg + 0.25 * f)


def _sheet(G, FG, isl, F, Hc):
    """A panel as one sheet (ny, nx grid, its faces toward the room), mapped by its flat cloth onto its island."""
    ny, nx = G.shape[:2]
    q = M.grid_faces(ny, nx)
    fx, fy = FG[..., 0].ravel() / F, FG[..., 1].ravel() / Hc
    m = M.Mesh(G.reshape(-1, 3), q, isl.to_uv(fx[q], fy[q]), mats=["main"])
    m.a["rest"] = np.concatenate([FG.reshape(-1, 2), np.zeros((nx * ny, 1))], 1)
    return m


def _rod_parts(rod, heading, z_rod, plane_y, ends, isl, rings_x):
    """The rail or the rod with its brackets back to the wall, finials, and rings or grommets: (meshes)."""
    kind = rod["kind"]
    x0, x1 = ends
    out = []
    if kind == "none":
        return out
    d = float(rod["d"]) * 0.001
    y = plane_y
    brk = [x0 + 0.09, x1 - 0.09] + ([0.0] if x1 - x0 > 2.4 else [])
    if kind in ("rail", "track"):
        h, dep = (0.016, 0.03) if kind == "rail" else (0.012, 0.022)
        out.append(M.box((x1 - x0 + 0.02, dep, h), at=(0, y, z_rod - h / 2), island="rod", islands=isl, mat="rod"))
        for bx in brk:
            out.append(M.box((0.024, -y + 0.004, 0.012), at=(bx, y / 2, z_rod - 0.004), island="rod", islands=isl, mat="rod"))
            out.append(M.box((0.05, 0.004, 0.05), at=(bx, -0.002, z_rod - 0.025), island="rod", islands=isl, mat="rod"))
        return out
    # a round rod, its finials, brackets (an arm and a plate), rings or grommets
    path = np.array([[x0 - 0.03, y, z_rod], [x1 + 0.03, y, z_rod]])
    out.append(M.tube(np.linspace(path[0], path[1], 12), d / 2, isl["rod"], n=14, mat="rod"))
    fin = rod.get("finial", "ball")
    for sgn, xe in ((-1, x0 - 0.03), (1, x1 + 0.03)):
        if fin == "ball":
            t = np.linspace(0, 1, 9)
            pth = np.stack([xe + sgn * (0.004 + t * 0.05), np.full(9, y), np.full(9, z_rod)], 1)
            rad = np.maximum(0.003, 0.028 * np.sin(math.pi * np.clip(t * 1.05, 0, 1)) ** 0.8)
            rad[0] = d / 2
            out.append(M.tube(pth, rad, isl["rod"], n=14, mat="rod", caps=(False, True), cap_bulge=0.2))
        else:
            pth = np.stack([np.array([xe, xe + sgn * 0.03]), np.full(2, y), np.full(2, z_rod)], 1)
            out.append(M.tube(pth, d / 2 + 0.004, isl["rod"], n=14, mat="rod", caps=(False, True), cap_bulge=0.3))
    for bx in brk:
        out.append(M.tube(np.array([[bx, 0.0, z_rod], [bx, y * 0.5, z_rod], [bx, y + d * 0.4, z_rod]]), 0.007, isl["rod"], n=8, mat="rod"))
        out.append(M.box((0.04, 0.006, 0.06), at=(bx, -0.003, z_rod - 0.03), island="rod", islands=isl, mat="rod"))
    if heading == "grommet":
        for gx in rings_x:
            out.append(M.tube(M.ring_path((gx, y, z_rod), (1, 0, 0), d / 2 + 0.012, n=14), 0.0055, isl["rod"], n=6, mat="rod"))
    else:
        for gx in rings_x:
            out.append(M.tube(M.ring_path((gx, y, z_rod), (1, 0, 0), d / 2 + 0.005, n=10), 0.003, isl["rod"], n=4, mat="rod"))
    return out


def make(spec, th):
    seed = int(spec.get("seed", 0))
    r = np.random.default_rng(seed * 7919 + 11)
    heading = spec.get("heading", "pinch")
    if heading not in HEADINGS:
        raise ValueError(f"curtain heading {heading!r}: one of {', '.join(HEADINGS)}")
    fab = dict(FABRICS[spec.get("fabric", "cotton")])
    if spec.get("thick"):
        fab["thick"] = float(spec["thick"])
    W, H, sill, rod, z_rod, ends = _sizes(spec)
    spec["_W"], spec["_H"], spec["_sill"] = W, H, sill
    z_top = _top_edge(heading, rod, z_rod)
    z_hem = _hem(spec, sill)
    out_y = -float(rod["out"]) * 0.001
    n_panels = 2 if int(spec.get("panels", 2)) >= 2 else 1
    hd = HEADINGS[heading]
    pitch = float(spec.get("pitch", hd["pitch"])) * 0.001
    fullness = float(spec.get("fullness", hd["fullness"]))
    step = float(spec.get("step", 32)) * 0.001
    open_ = float(np.clip(spec.get("open", 0.0), 0.0, 1.0))
    x0, x1 = ends
    if n_panels == 2:
        ov = 0.04
        layout = [(x0, (0.0 - x0) + ov / 2, out_y), (x1, (x1 - 0.0) + ov / 2, out_y - 0.022)]
    else:
        home = x0 if spec.get("side", "left") == "left" else x1
        layout = [(home, x1 - x0, out_y)]
    cov = dict(spec.get("cover") or {})
    th.material("main", "fabric", alpha=fab["opacity"] < 0.99, double=True, color=cov.get("color", "#d8d0c2"), rough=float(cov.get("rough", fab["rough"])))
    rmetal = float(rod.get("metal", 0.0))
    th.material("rod", "metal" if rmetal > 0.5 else "paint", color=rod["color"], rough=0.35 if rmetal > 0.5 else 0.5, metal=rmetal,
                px=max(64, int(spec.get("tex", 1024)) // 8), bake=False)
    panels, isl_names = [], []
    for pi, (home, span_closed, py) in enumerate(layout):
        n = max(2, int(round(span_closed / pitch)))
        S = span_closed * (1 - open_) + min(span_closed, n * hd["stack"] * 0.001 * (fullness / hd["fullness"])) * open_
        single = n_panels == 1
        G, FG, F, Hc, band, xc, tie_c = _panel(spec, fab, z_top, z_hem, home, span_closed, S, single, py, seed + 31 * pi, r, step)
        tag = "lr"[pi] if n_panels == 2 else "c"
        names = (f"cloth_{tag}", f"tie_{tag}")
        th.island(names[0], F * 1000, Hc * 1000)                 # one sheet, both sides drawn: a curtain is seen from the room
        if tie_c is not None:
            th.island(names[1], 600, 40)                         # its tie-back's band, the same cloth
        panels.append(dict(G=G, FG=FG, F=F, Hc=Hc, names=names, xc=xc, band=band, tie=tie_c, home=home, y=py))
        isl_names.append(names)
    th.island("rod", 200, 200, mat="rod")
    th.pack()
    isl = th.islands
    lows, highs = [], []
    for p in panels:
        G, FG, F, Hc = p["G"], p["FG"], p["F"], p["Hc"]
        n = grid_normals(G)
        cr = _creases(FG, seed + len(lows), float(spec.get("crease", 1.2 if fab["thick"] >= 1 else 0.6)) * 0.001)
        isl_c = isl[p["names"][0]]
        highs.append(_sheet(G + n * cr[..., None], FG, isl_c, F, Hc))
        lows.append(_sheet(G[::2], FG[::2], isl_c, F, Hc))
        if p["tie"] is not None:                                   # the tie-back: a band of the same cloth round the bundle
            zt = z_hem + float(spec["tie"].get("at", 0.42)) * Hc
            bw = float(spec["tie"].get("bundle", 150)) * 0.001
            bd = float(spec["tie"].get("depth", 90)) * 0.001
            a = np.linspace(0, 2 * math.pi, 33)
            ring = np.stack([p["tie"][0] + np.cos(a) * (bw / 2 + 0.01), p["tie"][1] + np.sin(a) * (bd / 2 + 0.01), np.full(33, zt)], 1)
            band_m = M.tube(ring, 0.006, isl[p["names"][1]], n=8, mat="main")
            band_m.v[:, 2] = zt + (band_m.v[:, 2] - zt) * 3.5        # a flat band 4 cm high, not a cord
            lows.append(band_m)
            highs.append(band_m)
    rings_x = []
    if rod["kind"] == "rod":
        for p in panels:
            rings_x.extend(list(p["xc"][1:-1]) if heading == "grommet" else list(p["xc"]))
    parts = _rod_parts(rod, heading, z_rod, out_y, ends, isl, rings_x)
    th.low = M.join(lows + parts)
    th.high = M.join(highs + parts)
    th.pose = "stand"
    th.anchor = (0.0, 0.0, 0.0)                                    # the floor under the window's middle, the wall at y = 0
    th.keep_z = True
    th.view = {"azim": -18, "elev": 8}
    th.reach = 0.004
    th.cage = 0.003
    op = float(cov.get("opacity", fab["opacity"]))

    def paint(fr):
        hdr = float(spec.get("header", HEADINGS[heading]["header"]))
        for p in panels:
            F, Hc = p["F"] * 1000, p["Hc"] * 1000
            f = fr[p["names"][0]]
            paint_cover(f, cov, seed, None, (F, Hc), weave=0.4 if fab["thick"] < 1 else 0.7)
            X, Y = f.grid()
            # the hems' and the heading tape's stitching, a dashed thread in a groove
            line = (np.abs(Y - 92) < 1.2) | (np.abs(X - 36) < 1.0) | (np.abs(X - (F - 36)) < 1.0) | (np.abs(Y - (Hc - 14)) < 1.0) | (np.abs(Y - (Hc - hdr + 6)) < 1.0)
            stitch = (line & (np.mod((X + Y) / 5.0, 1.0) < 0.6)).astype(np.float32)
            f.lay_island(stitch, height=(-0.15 * stitch).astype(np.float32), add_height=True,
                         **({"color": cov["thread"]} if cov.get("thread") else {}))
            # the doubled cloth at the hems and the tape: a shade deeper (and less see-through in a sheer)
            dbl = ((Y < 95) | (X < 38) | (X > F - 38) | (Y > Hc - hdr - 4)).astype(np.float32)
            f.lay_island(dbl * 0.06, color="#000000")
            if op < 0.99:
                f.lay_island(np.ones_like(X, dtype=np.float32), opacity=op)
                f.lay_island(dbl, opacity=min(1.0, op * 1.9))
            if p["tie"] is not None:
                tc = (spec.get("tie") or {}).get("color", cov.get("color", "#d8d0c2"))
                fr[p["names"][1]].fill(color=tc, rough=float(cov.get("rough", fab["rough"])), **({"opacity": 1.0} if op < 0.99 else {}))
        fr["rod"].fill(color=rod["color"], rough=0.35 if rmetal > 0.5 else 0.5, metal=rmetal)

    th.paint = paint
    return th
