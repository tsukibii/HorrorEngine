"""Clothes as props (DECISIONS 2026-11-05, later; the hanging ones scrapped the same day: "the clothing on the
hangers looks bad, just scrap it, all we need is the folded clothing for the suitcase"): folded garments for a suitcase
or a closet's shelf, and a stack of them.

- `folded`: one garment folded into a soft slab (a tee, a shirt, a sweater, jeans, a towel), its top a thick cloth with
  the fold's dome, soft wrinkles and the garment's marks painted (a tee's neckline, a shirt's placket and buttons, a
  sweater's rib, a jean's seam, a towel's terry), its edges the hem round a thick cloth (the bedding's `shell`).
- `stack`: several folded garments one on another, each turned a little, sizes and colours by the seed.

    {"family": "clothes", "kind": "folded" | "stack", "garment": "tee" | "shirt" | "sweater" | "jeans" | "towel",
     "size": [w, d] (mm folded) or the garment's own, "thick": 30, "color": "#...", "pattern": ..., "count": 4 (a stack),
     "seed": 1}
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N
from .bedding import paint_cover, sheet_grid, shell

MM = 0.001
FIELDS = {"kind": "folded", "garment": "tee", "size": [300, 230], "thick": 30, "color": "#c9cfd6", "pattern": "plain", "count": 4}
CHOICES = {"kind": ["folded", "stack"], "garment": ["tee", "shirt", "sweater", "jeans", "towel"],
           "pattern": ["plain", "stripes", "check", "dots"]}
LABELS = {"size": ["width", "depth"]}
PALETTE = ["#c9cfd6", "#2f3e5c", "#8c2f2f", "#e6dfd0", "#5a6b4a", "#3a3a3a", "#d7a86e", "#7e9bb8", "#b9b2a8", "#4a3b5c"]
GARMENTS = {               # folded size (w, d mm), thickness, the cloth's roughness and weave
    "tee": dict(size=(300, 230), thick=28, rough=0.92, weave=0.9),
    "shirt": dict(size=(320, 240), thick=24, rough=0.85, weave=1.1),
    "sweater": dict(size=(330, 260), thick=48, rough=0.95, weave=1.6),
    "jeans": dict(size=(340, 240), thick=42, rough=0.8, weave=1.3),
    "towel": dict(size=(360, 260), thick=40, rough=0.98, weave=2.0),
}


def folded_piece(W, L, thick, seed, isl_top, isl_bot, isl_edge, mat="main", dome=0.3, step=0.018):
    """One folded garment as a thick cloth lying flat: (the game mesh, the detailed mesh), its middle at the origin, on
    z = 0. The top rises in a soft dome (the layers inside) with wrinkles; the fold's edges are rounder than the open ones."""
    r = N.rng(seed, "folded")
    flat, T, nx, ny = sheet_grid(W, L, step)
    FG = flat.reshape(ny, nx, 2)
    u = FG[..., 0] / W
    v = FG[..., 1] / L
    pillow = np.sin(np.pi * u) ** 0.6 * np.sin(np.pi * v) ** 0.6
    q = np.stack([FG[..., 0] / 0.09, FG[..., 1] / 0.09, np.full_like(u, seed * 0.37)], -1)
    wr = N.fbm3(q, seed + 21, 3) * 0.0035 + N.ridged3(q * 0.55, seed + 22, 2) * 0.0015
    mid = thick / 2 * (0.55 + 0.45 * pillow) + dome * thick * 0.5 * pillow + wr
    G = np.stack([FG[..., 0] - W / 2, FG[..., 1] - L / 2, mid], -1)
    half_hi = np.maximum(thick / 2 * (0.5 + 0.5 * pillow) + wr * 0.4, 0.002)
    half_lo = np.maximum(thick / 2 * (0.5 + 0.5 * pillow), 0.002)
    high = shell(G, FG, half_hi, isl_top, isl_bot, isl_edge, W, L, edge_seg=7, mat=mat)
    low = shell(G[::2, ::2], FG[::2, ::2], half_lo[::2, ::2], isl_top, isl_bot, isl_edge, W, L, edge_seg=4, mat=mat)
    for m in (low, high):
        m.v[:, 2] -= m.v[:, 2].min()
    high.v[:, 2] = np.maximum(high.v[:, 2], low.v[:, 2].min())
    return low, high


def paint_garment(f, garment, cov, seed, weave):
    """The folded garment's top: its cloth, then what the fold shows of it."""
    paint_cover(f, cov, seed, weave=weave)
    X, Y = f.grid()
    W, H = f.W, f.H
    ink = _shade(cov.get("color", "#c9cfd6"), 0.72)
    if garment == "tee":                              # the neckline's band at the head end, the sleeves' fold lines down the sides
        f.line([(W * 0.3, H * 0.86), (W * 0.42, H * 0.76), (W * 0.58, H * 0.76), (W * 0.7, H * 0.86)], 5.0, color=ink, alpha=0.5, height=0.15)
        for x in (W * 0.17, W * 0.83):
            f.line([(x, H * 0.12), (x, H * 0.88)], 1.4, color=ink, alpha=0.35, height=-0.3)
    elif garment == "shirt":                          # the placket with its buttons, the collar's points
        f.line([(W / 2, H * 0.1), (W / 2, H * 0.9)], 3.0, color=ink, alpha=0.3, height=0.25)
        for k in range(5):
            f.ellipse(W / 2, H * (0.18 + 0.15 * k), 3.2, color="#efe7d2", rough=0.4, height=0.3)
            f.ellipse(W / 2, H * (0.18 + 0.15 * k), 1.1, color="#9a8f78", rough=0.5)
        f.line([(W * 0.36, H * 0.92), (W * 0.5, H * 0.8), (W * 0.64, H * 0.92)], 2.2, color=ink, alpha=0.45, height=0.2)
    elif garment == "sweater":                        # the rib's lines across the hem's end and the knit's cables
        rib = ((np.mod(Y, 4.0) < 2.0) & (Y < H * 0.16)).astype(np.float32)
        f.lay_island(rib, color=ink, alpha=0.3, height=(0.5 * rib).astype(np.float32), add_height=True)
        knit = (0.5 + 0.5 * np.sin(X * 1.8) * np.sin(Y * 1.1)).astype(np.float32)
        f.lay_island(np.ones_like(X), height=(0.35 * knit).astype(np.float32), add_height=True)
    elif garment == "jeans":                          # the seams' double stitching, the fade along the fold
        for x in (W * 0.12, W * 0.88):
            f.line([(x, 2), (x, H - 2)], 2.4, color=_shade(cov.get("color", "#2f3e5c"), 1.25), alpha=0.5, height=0.3)
            st = ((np.mod(Y, 3.0) < 1.5) & (np.abs(X - x) < 1.0)).astype(np.float32)
            f.lay_island(st, color="#d9b56a", rough=0.7)
        fade = np.exp(-((Y - H / 2) / (H * 0.18)) ** 2).astype(np.float32)
        f.lay_island((0.22 * fade).astype(np.float32), color="#ffffff")
    elif garment == "towel":                          # terry loops: a dense relief; a woven band near each end
        q = N.fbm3(np.stack([X / 1.3, Y / 1.3, np.full_like(X, seed * 0.5)], -1), seed + 31, 2)
        f.lay_island(np.ones_like(X), height=(0.35 * q).astype(np.float32), add_height=True, rough=0.98)
        band = ((np.abs(Y - H * 0.1) < 6.0) | (np.abs(Y - H * 0.9) < 6.0)).astype(np.float32)
        f.lay_island(band, color=ink, alpha=0.25, height=(-0.3 * band).astype(np.float32), add_height=True)
    # the fold's crease across the middle: a soft groove, darker in it
    crease = np.exp(-((Y - H / 2) / 2.2) ** 2).astype(np.float32)
    f.lay_island(crease, color="#000000", alpha=0.18, height=(-0.45 * crease).astype(np.float32), add_height=True)


def paint_hem(f, cov, seed):
    """A folded garment's edge: the layers of cloth, one over another, as light and dark lines along it."""
    paint_cover(f, {"color": cov.get("color", "#c9cfd6"), "rough": cov.get("rough", 0.9)}, seed, weave=0.8)
    X, Y = f.grid()
    layers = (0.5 + 0.5 * np.sin(Y * 1.9 + 0.3 * np.sin(X * 0.4))).astype(np.float32)
    f.lay_island((0.22 * layers).astype(np.float32), color="#000000")
    f.lay_island(np.ones_like(X), height=(0.5 * layers).astype(np.float32), add_height=True)


def make(spec, th):
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "clothes")
    kind = spec.get("kind", "folded")
    garment = spec.get("garment", "tee")
    if garment not in GARMENTS:
        raise ValueError(f"garment {garment!r}: one of {', '.join(GARMENTS)}")
    Gm = GARMENTS[garment]
    # folded, or a stack of folded
    count = int(spec.get("count", 4)) if kind == "stack" else 1
    th.material("main", "fabric", color=spec.get("color", PALETTE[0]), rough=0.9)
    pieces = []                                       # (garment, W, L, thick, cov)
    for i in range(count):
        g = garment if kind == "folded" or not spec.get("mix", True) else list(GARMENTS)[int(r.integers(5))]
        G2 = GARMENTS[g]
        W, L = [float(v) * MM for v in (spec.get("size") or G2["size"])] if kind == "folded" else [float(v) * MM * r.uniform(0.9, 1.08) for v in G2["size"]]
        thick = float(spec.get("thick", G2["thick"])) * MM if kind == "folded" else G2["thick"] * MM * r.uniform(0.85, 1.1)
        col = spec.get("color") if (kind == "folded" and spec.get("color")) else PALETTE[int(r.integers(len(PALETTE)))]
        cov = {"color": col, "pattern": spec.get("pattern", "plain") if i == 0 else ["plain", "plain", "stripes", "check"][int(r.integers(4))],
               "size": spec.get("pattern_size", 28), "ink": spec.get("ink", _hex(_shade(col, 0.72))), "rough": G2["rough"]}
        pieces.append((g, W, L, thick, cov, G2))
    for i, (g, W, L, thick, cov, G2) in enumerate(pieces):
        th.island(f"top{i}", W * 1000, L * 1000)
        th.island(f"hem{i}", 2 * (W + L) * 1000, math.pi * thick * 1000 / 2 + 2)
    th.island("bottom", pieces[0][1] * 1000 * 0.5, pieces[0][2] * 1000 * 0.5)
    th.pack()
    I = th.islands
    lows, highs = [], []
    z = 0.0
    for i, (g, W, L, thick, cov, G2) in enumerate(pieces):
        low, high = folded_piece(W, L, thick, seed + 17 * i, I[f"top{i}"], I["bottom"], I[f"hem{i}"])
        if kind == "stack":
            yaw = r.uniform(-7, 7)
            mv = (r.uniform(-0.012, 0.012), r.uniform(-0.01, 0.01), z)
            for m in (low, high):
                M.turn(m, M.rot("z", yaw), move=mv)
            z += float(low.v[:, 2].max()) - z - 0.004 if i else float(low.v[:, 2].max()) - 0.004
        lows.append((f"g{i}", low))
        highs.append((f"g{i}", high))
    th.assemble(lows, high=highs)
    th.pose = "stand"
    th.view = {"azim": -35, "elev": 34}
    th.reach, th.cage = 0.012, 0.004

    def paint(fr):
        for i, (g, W, L, thick, cov, G2) in enumerate(pieces):
            paint_garment(fr[f"top{i}"], g, cov, seed + 3 * i, G2["weave"])
            paint_hem(fr[f"hem{i}"], cov, seed + 5 * i)
        paint_cover(fr["bottom"], pieces[0][4], seed + 9, weave=0.8)
    th.paint = paint
    return th


def _shade(color, k):
    c = color.lstrip("#")
    v = np.array([int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])
    return np.clip(v * k, 0, 1)


def _hex(v):
    return "#%02x%02x%02x" % tuple(int(round(float(x) * 255)) for x in v)
