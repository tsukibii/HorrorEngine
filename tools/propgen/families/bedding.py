"""Bedding (the user, 2026-11-04: "proper better pillows and blankets"): pillows and cushions sewn from two pieces and
filled, blankets and quilted futons laid over what they're on or folded away, by the cloth simulation (sim.Cloth).

- `pillow` (a makura, a bed pillow, a zabuton): the bag's two pieces sewn at their edge and inflated until it holds
  `fill` of what it could (the seam a ridge, the corners pinched), set on the floor by gravity (its bottom flat), a
  head's `dent` pressed into it, a cushion's `tuft` tied through its middle; the folds a filled bag makes at its
  corners and along its seam, a buckwheat pillow's `lumps`, in the detailed copy.
- `blanket` (a kakebuton, a blanket, a throw): a cloth `thick` mm laid over what it's `on` (the kit's `futon` or
  `bed_single`, as boxes with rounded edges, or boxes of your own; `floor` mm the ground round it, a tatami's 60) by
  gravity, `spread`, its head end `turned` back
  (its lining up) or `rumpled`; quilted (`quilt`: cells or channels, the cloth thinner along the stitches) in the
  detailed copy; set down with the bed's middle at x = y = 0 and the floor at z = 0, so it goes on the kit's bed at
  the bed's own place.
- `folded` (a futon put away): the same cloth folded in halves or thirds (`folds`, in order), each fold rolled round
  the layers inside it, one layer on the other, left as folded with a soft unevenness and a `sag`.

The cover painted by code: a `pattern` (plain, stripes, check, dots, seigaiha waves) in its colours, the quilting's
stitches, the weave's fine relief; the lining (`back`) and the hem their own colour.

    {"family": "bedding", "kind": "pillow", "size": [500, 350], "fill": 0.8, "dent": 0.5, "lumps": 0.6, "tuft": 0,
     "cover": {"pattern": "stripes", "color": "#e9e5dc", "ink": "#3d5a80"}}
    {"family": "bedding", "kind": "blanket", "size": [1500, 2000], "thick": 50, "on": "futon", "at": [0, -180],
     "mode": "turned", "turn_back": 500, "quilt": {"cell": 330}, "cover": {...}, "back": {"color": "#efe9dc"}}
    {"family": "bedding", "kind": "folded", "size": [1000, 2000], "thick": 60, "folds": [["x", 2], ["y", 3]]}
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N
from .. import sim

# what a blanket lies on, as the kit's beds are built (kit.js bedGen; x across, y along, the head at +y): boxes
# (lo, hi, edge radius) in metres, the floor under them at z = 0
SUPPORTS = {
    "floor": [],
    "futon": [((-0.49, -1.04, 0.0), (0.49, 1.045, 0.125), 0.03)],
    "bed_single": [((-0.475, -0.99, 0.25), (0.475, 0.935, 0.476), 0.03), ((-0.485, -1.0, 0.0875), (0.485, 0.94, 0.25), 0.004),
                   ((-0.435, -0.95, 0.0), (0.435, 0.94, 0.0875), 0.0), ((-0.485, 0.94, 0.0), (0.485, 1.0, 0.9), 0.004)],
}


def sheet_grid(W, L, step):
    """A regular grid over the flat piece (metres, its corner at 0, 0), odd counts both ways so every other point is
    one too (the game mesh), triangles with their diagonals alternating: (flat (n, 2), T, nx, ny)."""
    nx, ny = int(round(W / step)) // 2 * 2 + 1, int(round(L / step)) // 2 * 2 + 1
    xs, ys = np.linspace(0, W, max(nx, 5)), np.linspace(0, L, max(ny, 5))
    nx, ny = len(xs), len(ys)
    X, Y = np.meshgrid(xs, ys)
    idx = np.arange(nx * ny).reshape(ny, nx)
    a, b, c, d = idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, 1:].ravel(), idx[1:, :-1].ravel()
    alt = ((np.arange(ny - 1)[:, None] + np.arange(nx - 1)[None, :]) % 2).ravel().astype(bool)
    t1 = np.where(alt[:, None], np.stack([a, b, c], 1), np.stack([a, b, d], 1))
    t2 = np.where(alt[:, None], np.stack([a, c, d], 1), np.stack([b, c, d], 1))
    return np.stack([X.ravel(), Y.ravel()], 1), np.concatenate([t1, t2]), nx, ny


def border_loop(nx, ny):
    """The grid's border, counter-clockwise from its first corner."""
    return np.concatenate([np.arange(nx), np.arange(1, ny) * nx + nx - 1, (ny - 1) * nx + np.arange(nx - 2, -1, -1), np.arange(ny - 2, 0, -1) * nx])


def grid_normals(G, smooth=2):
    """A grid's (ny, nx, 3) normals from its tangents across and along, smoothed with their neighbours."""
    gu = np.gradient(G, axis=1)
    gv = np.gradient(G, axis=0)
    n = np.cross(gu, gv)
    for _ in range(smooth):
        p = np.pad(n, ((1, 1), (1, 1), (0, 0)), mode="edge")
        n = n * 2 + p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    return n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-12)


def shell(G, flat_g, half, isl_top, isl_bot, isl_edge, W, L, edge_seg=6, mat="main"):
    """A thick cloth from its mid-surface grid G (ny, nx, 3): its top face out along the normals by `half` (ny, nx:
    half its thickness there), its bottom in, and a rounded hem between them all round its border (a half round of
    edge_seg steps). UVs: the top and bottom from the flat piece (the bottom mirrored to read from below), the hem a
    strip its length by its round. `rest`: the flat piece (metres) for the paint by place."""
    ny, nx = G.shape[:2]
    n = grid_normals(G)
    top = G + n * half[..., None]
    bot = G - n * half[..., None]
    k = nx * ny
    loop = border_loop(nx, ny)
    # each border point's way out: away from the grid's inside, in its own plane
    gi = np.zeros_like(G)
    gi[0, :] += G[1, :] - G[0, :]
    gi[-1, :] += G[-2, :] - G[-1, :]
    gi[:, 0] += G[:, 1] - G[:, 0]
    gi[:, -1] += G[:, -2] - G[:, -1]
    o = -gi.reshape(-1, 3)[loop]
    nl = n.reshape(-1, 3)[loop]
    o -= (o * nl).sum(1, keepdims=True) * nl
    o /= np.maximum(np.linalg.norm(o, axis=1, keepdims=True), 1e-12)
    hl = half.reshape(-1)[loop]
    gl = G.reshape(-1, 3)[loop]
    rings = []
    for s in range(1, edge_seg):
        a = math.pi * s / edge_seg
        rings.append(gl + nl * (hl * math.cos(a))[:, None] + o * (hl * math.sin(a))[:, None])
    V = np.concatenate([top.reshape(-1, 3), bot.reshape(-1, 3)] + rings)
    q = M.grid_faces(ny, nx)
    ft = q
    fb = q[:, ::-1] + k
    # the hem: ring 0 the top's border, ring edge_seg the bottom's, the rest between
    m = len(loop)
    ring_idx = [loop] + [2 * k + i * m + np.arange(m) for i in range(edge_seg - 1)] + [loop + k]
    fe = []
    for s in range(edge_seg):
        r0, r1 = ring_idx[s], ring_idx[s + 1]
        fe.append(np.stack([r0, r1, np.roll(r1, -1), np.roll(r0, -1)], 1))   # out: along the loop, then down the round
    fe = np.concatenate(fe)
    fx, fy = flat_g[..., 0].ravel() / W, flat_g[..., 1].ravel() / L
    uv_t = isl_top.to_uv(fx[q], fy[q])
    uv_b = isl_bot.to_uv(1 - fx[q[:, ::-1]], fy[q[:, ::-1]])
    seg = np.linalg.norm(np.diff(np.concatenate([flat_g.reshape(-1, 2)[loop], flat_g.reshape(-1, 2)[loop[:1]]]), axis=0), axis=1)
    along = np.concatenate([[0], np.cumsum(seg)]) / max(seg.sum(), 1e-9)
    uv_e = []
    for s in range(edge_seg):
        a0, a1 = along[:-1], along[1:]
        b0, b1 = np.full(m, s / edge_seg), np.full(m, (s + 1) / edge_seg)
        uv_e.append(np.stack([isl_edge.to_uv(a0, b0), isl_edge.to_uv(a0, b1), isl_edge.to_uv(a1, b1), isl_edge.to_uv(a1, b0)], 1))
    mesh = M.Mesh(V, np.concatenate([ft, fb, fe]), np.concatenate([uv_t, uv_b, np.concatenate(uv_e)]), mats=[mat])
    fr = np.concatenate([flat_g.reshape(-1, 2), np.zeros((k, 1))], 1)
    rest = np.concatenate([fr + (0, 0, 0.004), fr - (0, 0, 0.004)] + [np.concatenate([flat_g.reshape(-1, 2)[loop], np.zeros((m, 1))], 1)] * (edge_seg - 1))
    mesh.a["rest"] = rest
    return mesh


def quilt_puff(flat_g, W, L, q, edge_in, hem=0.55):
    """How full the quilted cloth is at each point (1 in a cell's middle, `low` along a stitch and at the hem):
    `cell` mm squares (or `channels` along its length)."""
    if not q:
        p = np.ones(flat_g.shape[:2])
    else:
        c = float(q.get("cell", 330)) * 0.001
        lo = float(q.get("low", 0.35))
        x, y = flat_g[..., 0], flat_g[..., 1]
        ox, oy = (W % c) / 2, (L % c) / 2
        dx = np.abs(np.mod(x - ox + c / 2, c) - c / 2)
        dy = np.abs(np.mod(y - oy + c / 2, c) - c / 2)
        d = dx if q.get("style") == "channels" else np.minimum(dx, dy)
        t = np.clip(d / (c * 0.34), 0, 1)
        p = lo + (1 - lo) * (t * t * (3 - 2 * t)) ** 0.6
    be = np.minimum.reduce([flat_g[..., 0], W - flat_g[..., 0], flat_g[..., 1], L - flat_g[..., 1]])
    t = np.clip(be / max(edge_in, 1e-6), 0, 1)
    return p * (hem + (1 - hem) * t * t * (3 - 2 * t))


def wrinkles(flat_g, seed, amp, scale=0.09):
    """A cloth's soft creases (metres out of it): ridges a few centimetres across, one way and another."""
    q = np.concatenate([flat_g / scale, np.full(flat_g.shape[:-1] + (1,), seed * 0.31)], -1)
    r = N.ridged3(q.reshape(-1, 3), seed + 4, 3).reshape(flat_g.shape[:-1]) - 0.5
    f = N.fbm3(q.reshape(-1, 3) * 0.5, seed + 5, 2).reshape(flat_g.shape[:-1])
    return amp * (0.7 * r + 0.3 * f)


# ---- the cover's paint ----------------------------------------------------------------------------------------------

def _pattern(kind, X, Y, size):
    """Coverage (0..1) of a cover's pattern's ink on a frame's pixels (mm)."""
    s = float(size)
    if kind == "stripes":
        t = np.mod(X, s) / s
        return ((t > 0.12) & (t < 0.34)).astype(np.float32) + 0.5 * ((t > 0.42) & (t < 0.47))
    if kind == "check":                                   # gingham: two ways of stripes, darker where they cross
        a = (np.mod(X, s) < s / 2).astype(np.float32)
        b = (np.mod(Y, s) < s / 2).astype(np.float32)
        return np.clip(0.5 * a + 0.5 * b, 0, 1)
    if kind == "dots":
        r = s * 0.16
        cx = np.mod(X, s) - s / 2
        row = np.floor(Y / (s * 0.866))
        cy = np.mod(Y, s * 0.866) - s * 0.433
        cx = np.where(np.mod(row, 2) == 1, np.mod(X + s / 2, s) - s / 2, cx)
        return np.clip((r - np.hypot(cx, cy)) / 0.6 + 0.5, 0, 1)
    if kind == "seigaiha":                                # waves: rows of concentric half rings, each row over the one above
        R = s
        out = np.zeros_like(X)
        done = np.zeros(X.shape, bool)
        j0 = np.floor(Y / (R / 2))
        for dj in (-1, 0, 1, 2):
            j = j0 - dj
            cy = j * R / 2
            off = np.where(np.mod(j, 2) == 1, R, 0.0)
            cx = np.round((X - off) / (2 * R)) * 2 * R + off
            d = np.hypot(X - cx, Y - cy)
            inside = (d < R) & (Y >= cy - 1e-6) & ~done
            ring = np.mod(np.floor(d / (R / 4.5)), 2)
            out = np.where(inside, ring, out)
            done |= inside
        return out.astype(np.float32)
    return np.zeros_like(X, dtype=np.float32)


def paint_cover(f, cov, seed, quilt=None, flat_size=None, weave=0.6):
    """A cloth's cover on frame f: its colour, its pattern's ink, the weave's fine relief and its sheen; a quilt's
    stitches as thread in a groove (flat_size: the piece's size in mm, so the stitches meet the puff)."""
    cov = cov or {}
    base = cov.get("color", "#e8e4da")
    rough = float(cov.get("rough", 0.88))
    f.fill(color=base, rough=rough, metal=0.0)
    X, Y = f.grid()
    kind = cov.get("pattern", "plain")
    if kind != "plain":
        m = _pattern(kind, X, Y, cov.get("size", 60))
        f.lay_island(m, color=cov.get("ink", "#3d5a80"), rough=rough)
        if cov.get("ink2"):
            m2 = _pattern(kind, X + float(cov.get("size", 60)) / 2, Y, float(cov.get("size", 60)) * 0.5) * (1 - m)
            f.lay_island(m2, color=cov["ink2"], rough=rough)
    # the weave: a fine cross-hatch in the relief, and the cloth's uneven tone
    g = N.fbm3(np.stack([X / 40.0, Y / 40.0, np.full_like(X, seed * 0.7)], -1), seed + 11, 3)
    tone = np.clip(0.5 + 0.5 * g, 0, 1)
    f.lay_island(np.ones_like(X), height=(weave * 0.06 * (np.sin(X * 2.9) * np.sin(Y * 2.9)) + 0.04 * g).astype(np.float32), add_height=True)
    f.lay_island((0.08 * tone).astype(np.float32), color="#000000")
    if quilt and flat_size:
        c = float(quilt.get("cell", 330))
        W, L = flat_size
        ox, oy = (W % c) / 2, (L % c) / 2
        dx = np.abs(np.mod(X - ox + c / 2, c) - c / 2)
        dy = np.abs(np.mod(Y - oy + c / 2, c) - c / 2)
        d = dx if quilt.get("style") == "channels" else np.minimum(dx, dy)
        dash = (np.mod((np.where(dx < dy, Y, X)) / 6.0, 1.0) < 0.62).astype(np.float32)
        line = np.clip(1.6 - d / 0.7, 0, 1) * dash
        f.lay_island(line.astype(np.float32), color=quilt.get("thread", "#d8d2c4"), height=(-0.25 * line).astype(np.float32), add_height=True)


# ---- the kinds ------------------------------------------------------------------------------------------------------

def _bag(W, L, step, bulge):
    """A pillow's two pieces on one flat (metres, centred): the top all of its grid, the bottom its inside (they share
    the border: the seam), a little apart at the start so the bag has an inside. (V, T, flat, sep, top index grid,
    bottom index grid)."""
    flat2, T0, nx, ny = sheet_grid(W, L, step)
    F = flat2 - (W / 2, L / 2)
    top = np.arange(nx * ny).reshape(ny, nx)
    border = np.zeros((ny, nx), bool)
    border[[0, -1], :] = True
    border[:, [0, -1]] = True
    bot = top.copy()
    bot[~border] = nx * ny + np.arange(int((~border).sum()))
    X, Y = F[:, 0].reshape(ny, nx), F[:, 1].reshape(ny, nx)
    bump = (1 - (2 * X / W) ** 2) * (1 - (2 * Y / L) ** 2)
    Vt = np.stack([X.ravel(), Y.ravel(), (bulge * bump).ravel()], 1)
    Vb = np.stack([X[~border], Y[~border], -bulge * bump[~border]], 1)
    V = np.concatenate([Vt, Vb])
    flat = V[:, :2].copy()
    sep = np.concatenate([np.concatenate([Vt[:, :2], np.zeros((len(Vt), 1))], 1), np.concatenate([Vb[:, :2], np.ones((len(Vb), 1))], 1)])
    q = M.grid_faces(ny, nx)
    tt = np.concatenate([q[:, [0, 1, 2]], q[:, [0, 2, 3]]])
    tb = np.concatenate([bot.ravel()[q][:, [0, 2, 1]], bot.ravel()[q][:, [0, 3, 2]]])
    return V, np.concatenate([tt, tb]), flat, sep, top, bot


def _bag_mesh(P, top, bot, W, L, isl_top, isl_bot, every=1, mat="main"):
    """The bag's surface as a mesh, on every `every`th point of its grids: quads, UVs from its pieces (the bottom
    mirrored to read from below), `rest` its flat place."""
    t, b = top[::every, ::every], bot[::every, ::every]
    ny, nx = t.shape
    used = np.unique(np.concatenate([t.ravel(), b.ravel()]))
    remap = np.full(len(P), -1)
    remap[used] = np.arange(len(used))
    q = M.grid_faces(ny, nx)
    ft = remap[t.ravel()][q]
    fb = remap[b.ravel()][q][:, ::-1]
    xs = np.linspace(0, 1, nx)[None, :].repeat(ny, 0).ravel()
    ys = np.linspace(0, 1, ny)[:, None].repeat(nx, 1).ravel()
    uv_t = isl_top.to_uv(xs[q], ys[q])
    uv_b = isl_bot.to_uv(1 - xs[q[:, ::-1]], ys[q[:, ::-1]])
    m = M.Mesh(P[used], np.concatenate([ft, fb]), np.concatenate([uv_t, uv_b]), mats=[mat])
    rest = np.zeros((len(used), 3))
    gx, gy = np.meshgrid(np.linspace(-W / 2, W / 2, nx), np.linspace(-L / 2, L / 2, ny))
    rest[remap[t.ravel()]] = np.stack([gx.ravel(), gy.ravel(), np.full(nx * ny, 0.01)], 1)
    inner = b.ravel() != t.ravel()
    rest[remap[b.ravel()[inner]]] = np.stack([gx.ravel()[inner], gy.ravel()[inner], np.full(int(inner.sum()), -0.01)], 1)
    m.a["rest"] = rest
    return m


def _pillow(spec, th, seed, r):
    W, L = [float(v) * 0.001 for v in spec.get("size", (500, 350))]
    fill = float(spec.get("fill", 0.8))
    cov = spec.get("cover") or {}
    th.material("main", "fabric", color=cov.get("color", "#e8e4da"), rough=float(cov.get("rough", 0.88)))
    it = th.island("top", W * 1000, L * 1000)
    ib = th.island("bottom", W * 1000, L * 1000)
    th.pack()
    step = float(spec.get("step", 10)) * 0.001
    V, T, flat, sep, top, bot = _bag(W, L, step, 0.012)
    V = V + r.normal(0, 0.0015, V.shape)
    cl = sim.Cloth(V, T, flat, stiff=float(spec.get("stiff", 0.004)), sep=sep)
    vmax = W * L * min(W, L) * 0.32
    vol = vmax * fill
    sim.inflate(cl, vol, steps=int(spec.get("inflate_steps", 240)), pressure=0.0015)
    tuft = float(spec.get("tuft", 0))
    if tuft:                                           # tied through its middle (a zabuton's thread): top and bottom held close
        ny, nx = top.shape
        cyx = [(ny // 2, nx // 2)]
        ti = np.array([top[a, b] for a, b in cyx])
        tj = np.array([bot[a, b] for a, b in cyx])
        cl.ties = (ti, tj, np.full(len(ti), max(0.012, (1 - tuft) * 0.05)))
    cl.X[:, 2] -= cl.X[:, 2].min()
    cl.V[:] = 0
    spheres = []
    dent = float(spec.get("dent", 0))
    if dent:                                           # a head's: a ball pressed down into the top, off its middle
        h0 = cl.X[:, 2].max()
        R = 0.11
        cx, cy = r.uniform(-0.08, 0.08) * W, r.uniform(-0.12, 0.05) * L
        spheres = [((cx, cy, h0 + R - dent * 0.075), R)]
    sim.settle(cl, steps=int(spec.get("settle_steps", 140)), gravity=0.0002, floor=0.0, pressure=0.0008, volume=vol, spheres=spheres, friction=0.5)
    P = cl.X.copy()
    # the folds a filled bag makes: at its corners (toward its middle), along its seam (the stitching gathers it), a
    # buckwheat pillow's lumps; on the detailed copy, along its normals
    ny, nx = top.shape
    gx, gy = np.meshgrid(np.linspace(-1, 1, nx), np.linspace(-1, 1, ny))
    nrm = cl.normals(P)
    disp = np.zeros(len(P))
    for piece, sgn in ((top, 1.0), (bot, -1.0)):
        ids = piece.ravel()
        x, y = gx.ravel(), gy.ravel()
        d_edge = np.minimum(1 - np.abs(x), 1 - np.abs(y))
        cd = np.hypot(1 - np.abs(x), 1 - np.abs(y))                     # to the nearest corner
        ang = np.arctan2(1 - np.abs(y), 1 - np.abs(x))
        fade = np.clip(d_edge / 0.09, 0, 1) ** 1.5                         # nothing at the seam itself: the two pieces meet there
        corner = np.exp(-(cd / 0.42) ** 2) * np.sin(ang * float(spec.get("corner_folds", 5)) * 2 + seed + sgn) * 0.006 * fade
        seam = np.exp(-(d_edge / 0.06) ** 2) * np.sin((x * W + y * L) / 0.022 + seed) * 0.0018
        lumps = float(spec.get("lumps", 0)) * 0.006 * (N.fbm3(np.stack([x * W / 0.035, y * L / 0.035, np.full_like(x, sgn + seed)], 1), seed + 7, 2))
        soft = wrinkles(np.stack([x * W / 2, y * L / 2], -1)[:, None, :], seed + int(sgn), 0.0022, 0.07)[:, 0]
        add = (corner + seam + lumps + soft) * (d_edge > 1e-6)
        disp[ids] = add if sgn > 0 else np.where(piece.ravel() == top.ravel(), disp[ids], add)   # the seam's points: the top's
    Ph = P + nrm * disp[:, None]
    th.high = _bag_mesh(Ph, top, bot, W, L, it, ib, 1)
    th.low = _bag_mesh(P, top, bot, W, L, it, ib, 2)
    _floored(th)
    th.pose = "stand"
    th.view = {"azim": -30, "elev": 28}

    def paint(fr):
        paint_cover(fr["top"], cov, seed)
        paint_cover(fr["bottom"], spec.get("back") or cov, seed + 1)
        if tuft:                                        # the thread's knot at the middle
            for nm in ("top", "bottom"):
                f = fr[nm]
                f.ellipse(f.W / 2, f.H / 2, 9, 9, color=spec.get("thread", "#8a2b2b"), rough=0.7, height=1.2)
                for a in (0, 90):
                    f.line([(f.W / 2 - 22 * math.cos(math.radians(a)), f.H / 2 - 22 * math.sin(math.radians(a))),
                            (f.W / 2 + 22 * math.cos(math.radians(a)), f.H / 2 + 22 * math.sin(math.radians(a)))], 2.2, color=spec.get("thread", "#8a2b2b"), rough=0.7, height=0.6)

    th.paint = paint
    return th


def _floored(th):
    """The detail no lower than the game mesh: what lies on the floor lies flat on it (its folds and wrinkles never
    under it), so both are set down together and the game mesh rests on the floor."""
    th.high.v[:, 2] = np.maximum(th.high.v[:, 2], th.low.v[:, 2].min())


def _cloth(spec, th, seed, r, folded=False):
    W, L = [float(v) * 0.001 for v in spec.get("size", (1500, 2000))]
    thick = float(spec.get("thick", 50)) * 0.001
    cov, back = spec.get("cover") or {}, spec.get("back") or {}
    quilt = spec.get("quilt")
    th.material("main", "fabric", color=cov.get("color", "#d9d2c3"), rough=float(cov.get("rough", 0.9)))
    it = th.island("top", W * 1000, L * 1000)
    ib = th.island("bottom", W * 1000, L * 1000)
    per = 2 * (W + L) * 1000
    ie = th.island("hem", per, math.pi * thick * 1000 / 2 + 2)
    th.pack()
    step = float(spec.get("step", 30 if folded else 25)) * 0.001
    flat, T, nx, ny = sheet_grid(W, L, step)
    cl = sim.Cloth(np.concatenate([flat, np.zeros((len(flat), 1))], 1), T, flat, stiff=float(spec.get("stiff", 0.05 if thick > 0.02 else 0.012)), thick=thick)
    on = spec.get("on", "floor")
    boxes = SUPPORTS.get(on, []) if isinstance(on, str) else [(tuple(b[0]), tuple(b[1]), float(b[2]) if len(b) > 2 else 0.0) for b in on]
    if folded:
        cl.X[:, 2] = thick / 2
        cl.X[:, 0] -= W / 2
        cl.X[:, 1] -= L / 2
        n = 1                                           # the layers in the stack so far
        for axis, parts in spec.get("folds", [["x", 2], ["y", 3]]):
            ax = 0 if axis == "x" else 1
            lo, hi = cl.X[:, ax].min(), cl.X[:, ax].max()
            span, t = hi - lo, thick
            if int(parts) == 3:                         # in thirds: the near third over, then the far third round both
                # each flap a little longer than the middle by what its bend takes (the far one's wraps n layers more),
                # so the layers end even: the near flap just short of the far bend, the far flap over the whole top
                b = (span - 0.5 * (math.pi - 1) * t - math.pi * n * t) / 3
                sim.hinge(cl, ax, lo + b + 0.5 * (math.pi - 1) * t, -1, t)
                sim.hinge(cl, ax, lo + 2 * b + 0.5 * (math.pi - 1) * t, 1, t)
                n *= 3
            else:                                       # in half: the far half over, a little shorter than the near
                sim.hinge(cl, ax, lo + (span - (math.pi - 1) * t * (n - 0.5)) / 2, 1, t)
                n *= 2
        # left as folded (a settle crumples a stack of layers this thick into a heap): only a soft unevenness over it,
        # the top sagging a little between its fold edges, the folds' outer bends slumping under their own weight
        P = cl.X
        q = np.concatenate([cl.flat / 0.35, np.full((cl.n, 1), seed * 0.17)], 1)
        P += np.stack([N.fbm3(q, seed + 11, 2), N.fbm3(q, seed + 12, 2), N.fbm3(q, seed + 13, 2)], 1) * 0.004
        ztop = P[:, 2].max()
        mid = (P[:, :2].max(0) + P[:, :2].min(0)) / 2
        half = np.maximum((P[:, :2].max(0) - P[:, :2].min(0)) / 2, 1e-3)
        u = np.clip(1 - np.max(np.abs(P[:, :2] - mid) / half, 1), 0, 1)
        P[:, 2] -= float(spec.get("sag", 8)) * 0.001 * (P[:, 2] / max(ztop, 1e-3)) * (0.4 + 0.6 * u)
        if int(spec.get("settle_steps", 0)):
            sim.settle(cl, steps=int(spec["settle_steps"]), gravity=0.0003, floor=0.0, friction=0.75)
    else:
        mode = spec.get("mode", "spread")
        if mode in ("turned", "rumpled"):               # the head end turned back over the rest, its lining up
            back_m = float(spec.get("turn_back", 500)) * 0.001
            ang = math.radians(float(spec.get("skew", 4)) * (1 if r.random() < 0.5 else -1))
            a = np.array([0.0, L - back_m])
            sim.fold(cl, a, a + np.array([math.cos(ang), math.sin(ang)]), angle=178, radius=thick * 0.55, side=1, under=False)
        if mode == "rumpled":                           # pushed about: soft heaps it settles round
            for _ in range(int(spec.get("heaps", 4))):
                c = r.uniform([0.15 * W, 0.1 * L], [0.85 * W, 0.75 * L])
                s = r.uniform(0.12, 0.26)
                cl.X[:, 2] += r.uniform(0.04, 0.09) * np.exp(-np.sum((cl.flat - c) ** 2, 1) / (2 * s * s))
        at = np.array(spec.get("at", (0, 0)), float) * 0.001
        ground = float(spec.get("floor", 0)) * 0.001     # what it falls onto round its support (tatami: 60 mm up)
        top_z = max([b[1][2] for b in boxes], default=ground)
        cl.X[:, 0] += -W / 2 + at[0]
        cl.X[:, 1] += -L / 2 + at[1]
        cl.X[:, 2] += top_z + thick / 2 + 0.03
        cl.V[:] = 0
        sim.settle(cl, steps=int(spec.get("settle_steps", 200)), gravity=0.0006, boxes=boxes, floor=ground, friction=float(spec.get("friction", 0.6)))
        th.anchor = (0.0, 0.0, 0.0)                     # the bed's middle over the origin, whatever way it hangs
        th.keep_z = True                                # and the floor under it at z = 0 (on a bed it hangs clear of the floor)
    G = cl.X.reshape(ny, nx, 3)
    FG = flat.reshape(ny, nx, 2)
    edge_in = max(thick * 1.2, 0.03)
    puff = quilt_puff(FG, W, L, quilt, edge_in, float(spec.get("hem_full", 0.55)))
    wr = wrinkles(FG, seed, float(spec.get("wrinkle", 2.0)) * 0.001)
    hi_half = thick / 2 * puff + wr * 0.5
    th.high = shell(G, FG, np.maximum(hi_half, 0.002), it, ib, ie, W, L, edge_seg=8)
    lo_half = np.full((ny, nx), thick / 2 * float(np.mean(puff)))
    hem = float(spec.get("hem_full", 0.55))
    lo_half = np.minimum(lo_half, thick / 2 * (hem + (1 - hem) * np.clip(np.minimum.reduce([FG[..., 0], W - FG[..., 0], FG[..., 1], L - FG[..., 1]]) / edge_in, 0, 1)))
    th.low = shell(G[::2, ::2], FG[::2, ::2], np.maximum(lo_half[::2, ::2], 0.002), it, ib, ie, W, L, edge_seg=5)
    _floored(th)
    th.pose = "stand"
    th.view = {"azim": -35, "elev": 32}
    if thick > 0.004:
        th.reach = max(0.012, thick * 0.6)
        th.cage = max(0.003, thick * 0.4)

    def paint(fr):
        paint_cover(fr["top"], cov, seed, quilt, (W * 1000, L * 1000))
        paint_cover(fr["bottom"], {"color": back.get("color", cov.get("color", "#d9d2c3")), **back}, seed + 1, quilt, (W * 1000, L * 1000))
        h = fr["hem"]
        h.fill(color=spec.get("hem", back.get("color", cov.get("color", "#d9d2c3"))), rough=0.85)

    th.paint = paint
    return th


def make(spec, th):
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "bedding")
    kind = spec.get("kind", "pillow")
    if kind in ("pillow", "cushion"):
        return _pillow(spec, th, seed, r)
    if kind == "folded":
        return _cloth(spec, th, seed, r, folded=True)
    return _cloth(spec, th, seed, r)
