"""Paper: a sheet of a real size (a newspaper page, A4, a napkin, a receipt, a note) printed on both sides, then folded,
curled, crumpled into a ball or laid down by the paper simulation (sim.py), its creases and edges real geometry and its
print going where the paper goes. The mesh is the sheet's two faces `thick` apart and the edge between them.

    {"family": "sheet", "size": [300, 420], "art": {"design": "newspaper", ...}, "back": {"design": "newspaper", ...},
     "folds": [{"line": [[0, 210], [300, 210]], "angle": 176}], "curl": {"edge": "top", "amount": 0.3},
     "crumple": {"amount": 0.8}, "drape": true, "step": 4, "thick": 0.25}
"""
import math

import numpy as np

from .. import designs
from .. import mesh as M
from .. import noise as N
from .. import sim

SIZES = {"A4": (210, 297), "A5": (148, 210), "news": (300, 420), "napkin": (330, 330), "receipt": (80, 210), "letter": (216, 279)}


def grid(w, h, step, seed):
    """A jittered grid over the flat sheet (mm), triangles with their diagonals chosen at random, the border straight."""
    nx, ny = max(3, int(round(w / step)) + 1), max(3, int(round(h / step)) + 1)
    xs, ys = np.linspace(0, w, nx), np.linspace(0, h, ny)
    X, Y = np.meshgrid(xs, ys)
    r = N.rng(seed, "sheetgrid")
    jx = r.uniform(-0.32, 0.32, X.shape) * (w / (nx - 1))
    jy = r.uniform(-0.32, 0.32, Y.shape) * (h / (ny - 1))
    jx[:, [0, -1]] = 0
    jy[[0, -1], :] = 0
    F = np.stack([(X + jx).ravel(), (Y + jy).ravel()], 1)
    q = M.grid_faces(ny, nx)
    flip = r.random(len(q)) < 0.5
    t1 = np.where(flip[:, None], q[:, [0, 1, 2]], q[:, [0, 1, 3]])
    t2 = np.where(flip[:, None], q[:, [0, 2, 3]], q[:, [1, 2, 3]])
    T = np.concatenate([t1, t2])
    loop = np.concatenate([np.arange(nx), np.arange(1, ny) * nx + nx - 1, (ny - 1) * nx + np.arange(nx - 2, -1, -1), np.arange(ny - 2, 0, -1) * nx])
    return F, T, loop


def shell(X, T, F, loop, w, h, thick, front, back, mat="main"):
    """The sheet's mesh: front (+normal) and back faces thick apart, the edge strip, UVs from the flat sheet."""
    from ..bake import vertex_normals
    mid = M.Mesh(X, np.concatenate([T, np.full((len(T), 1), -1)], 1))
    n = vertex_normals(mid)
    k = len(X)
    v = np.concatenate([X + n * thick / 2, X - n * thick / 2])
    a, b = F[:, 0] / w, F[:, 1] / h
    tf = np.concatenate([T, np.full((len(T), 1), -1)], 1)
    tb = np.concatenate([T[:, ::-1] + k, np.full((len(T), 1), -1)], 1)
    uv_f = np.zeros((len(T), 4, 2))
    uv_f[:, :3] = front.to_uv(a[T], b[T])
    Tr = T[:, ::-1]
    uv_b = np.zeros((len(T), 4, 2))
    uv_b[:, :3] = back.to_uv(1 - a[Tr], b[Tr])
    a0, a1 = loop, np.roll(loop, -1)
    te = np.stack([a1, a0, a0 + k, a1 + k], 1)
    uv_e = np.repeat(front.to_uv(a[a0], b[a0])[:, None, :], 4, 1)
    m = M.Mesh(v, np.concatenate([tf, tb, te]), np.concatenate([uv_f, uv_b, uv_e]), mats=[mat])
    rest = np.concatenate([F, np.zeros((k, 1))], 1) * 0.001
    m.a["rest"] = np.concatenate([rest, rest + (0, 0, thick)])
    m.a["sheet"] = np.concatenate([np.concatenate([F, np.ones((k, 1))], 1), np.concatenate([F, -np.ones((k, 1))], 1)])
    return m


def make(spec, th):
    size = spec.get("size", "A4")
    w, h = SIZES[size] if isinstance(size, str) else tuple(size)
    seed = int(spec.get("seed", 0))
    kind = spec.get("paper", "paper")
    th.material("main", kind if kind in ("paper", "card", "film") else "paper", color=spec.get("color", "#efece4"),
                rough=float(spec.get("rough", 0.85)), double=bool(spec.get("crumple") or spec.get("fold") or spec.get("folds") or spec.get("squeeze") or spec.get("wrinkle")))
    # crumpled or folded, the sheet's two faces cross at its sharpest creases (each offset by half its thickness): both sides drawn
    fr_isl = th.island("front", w, h)
    bk_isl = th.island("back", w, h)
    th.pack()
    step = float(spec.get("step", 5.0))
    F, T, loop = grid(w, h, step, seed)
    flat = F * 0.001
    X = np.concatenate([flat, np.zeros((len(F), 1))], 1)
    c = spec.get("crumple") or {}
    pp = sim.Paper(X, T, flat, stiff=float(c.get("stiff", spec.get("stiff", 0.08))), yield_=float(c.get("yield", 0.02)),
                   plastic=float(c.get("plastic", 0.25)))
    for fd in spec.get("folds") or ():
        (ax, ay), (bx, by) = fd["line"]
        sim.fold(pp, (ax * 0.001, ay * 0.001), (bx * 0.001, by * 0.001), fd.get("angle", 175), fd.get("radius", 2.0) * 0.001, fd.get("side", 1),
                 fd.get("under", True))
    cu = spec.get("curl")
    if cu:
        sim.curl(pp, cu.get("edge", "top"), cu.get("amount", 0.25), cu.get("radius", 30) * 0.001)
    if c:
        sim.crumple(pp, c.get("amount", 0.7), c.get("seed", seed), int(c.get("steps", 90)), int(c.get("release", 30)), c.get("folds"))
    wr = float(spec.get("wrinkle", 0))
    if wr:
        # handled paper: soft waves out of its plane, millimetres high, a few centimetres across
        q = np.concatenate([flat / 0.045, np.full((len(flat), 1), seed * 0.37)], 1)
        pp.X[:, 2] += wr * 0.001 * (N.fbm3(q, seed + 9, 3) * 0.7 + 0.3 * (N.ridged3(q * 1.7, seed + 10, 2) - 0.5))
        pp.D0 = np.linalg.norm(pp.X[pp.B[:, 0]] - pp.X[pp.B[:, 1]], axis=1)
    if spec.get("drape", not c):
        sim.drape(pp, int(spec.get("drape_steps", 90)))
    thick = float(spec.get("thick", 0.25)) * 0.001
    th.low = shell(pp.X, T, F, loop, w, h, thick, fr_isl, bk_isl)
    th.high = None
    th.pose = "auto" if c else "stand"
    art = spec.get("art") or {"design": "paper"}
    back = spec.get("back") or {"design": art.get("design", "paper"), "page": 2, **{k: v for k, v in art.items() if k not in ("design",)}}

    def paint(fr):
        designs.draw(fr["front"], art, seed, "paper")
        designs.draw(fr["back"], back, seed + 1, "paper")

    th.paint = paint
    return th
