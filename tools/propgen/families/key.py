"""Keys. A pin-tumbler house key cut from its outline: a bow (round, oval, square, clover, a heart, a wide grip) with
its ring hole, the shoulder that stops it in the lock, the blade with its bitting (V cuts at real spacing and depths,
from `cuts` or the seed) and the warding grooves milled along both faces; or an old warded key: a ring bow, a round
shaft, a bit with notches. Brass, nickel or iron, its edges rounded, worn bright where fingers and locks rub it.

    {"family": "key", "kind": "house" | "skeleton", "bow": "round", "cuts": [3, 1, 4, 1, 5], "metal": "brass",
     "finish": "scratched", "age": "patina", "ring": true, "tag": "#c0392b"}
"""
import math

import numpy as np

from .. import finish as FN
from .. import mesh as M
from .. import noise as N


def bow_outline(kind, s=1.0):
    """The bow's outline (mm, centred at its middle, the blade toward +x) and its ring hole (or None)."""
    t = np.linspace(0, 2 * math.pi, 72, endpoint=False)
    if kind == "oval":
        pts = np.stack([11.5 * np.cos(t), 13.5 * np.sin(t)], 1)
    elif kind == "square":
        from ..paint import rrect_poly
        pts = rrect_poly(-11, -12, 22, 24, 5.5, n=8)
    elif kind == "clover":
        r = 10.5 + 2.2 * np.cos(3 * t) ** 2
        pts = np.stack([r * np.cos(t), r * np.sin(t)], 1)
    elif kind == "heart":
        x = 16 * np.sin(t) ** 3
        y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
        pts = np.stack([-y, x], 1) * 0.8
    elif kind == "grip":
        r = 12.5 + 1.2 * np.cos(2 * t)
        pts = np.stack([r * np.cos(t) * 0.95, r * np.sin(t) * 1.15], 1)
    else:
        pts = np.stack([12.5 * np.cos(t), 12.5 * np.sin(t)], 1)
    hole = np.stack([-6.0 + 2.6 * np.cos(-t), 2.6 * np.sin(-t)], 1)
    return pts * s, hole * s


def house_outline(spec, r):
    """Bow, shoulder and blade as one outline (mm, the bow's middle at x = 0, the blade along +x, the cuts on top),
    anticlockwise: the neck's underside, the blade's, the tip, the cuts back to the shoulder, the neck's top, then
    round the bow's back."""
    bow, hole = bow_outline(spec.get("bow", "round"))
    cuts = spec.get("cuts") or [int(c) for c in r.integers(0, 7, int(spec.get("pins", 5)))]
    pitch, first, depth_step, bh = 3.8, 6.2, 0.38, 8.4
    x0 = 10.5                                    # where the neck leaves the bow
    sh = x0 + 3.5                                # the shoulder
    L = sh + first + pitch * (len(cuts) - 1) + 5.5
    hn = bh / 2 + 2.4                            # the neck's half-height
    under = [(x0, -hn), (sh - 0.4, -bh / 2 - 2.0), (sh, -bh / 2 - 0.8), (sh + 0.8, -bh / 2), (L - 1.2, -bh / 2 + 0.6), (L, -0.4), (L, 0.6)]
    # the cut edge: the union of the V notches (90 degrees, a small flat at each bottom), the deepest winning
    xs = np.linspace(L - 2.5, sh + 0.8, int((L - 3.3 - sh) / 0.12))
    cut = np.zeros_like(xs)
    for c in range(len(cuts)):
        xc = sh + first + c * pitch
        d = 0.6 + depth_step * float(cuts[c])
        cut = np.maximum(cut, np.clip(d - np.maximum(np.abs(xs - xc) - 0.35, 0), 0, d))
    top = [(x, bh / 2 - y) for x, y in zip(xs, cut)]
    # keep only the corners: points where the edge bends
    pts = np.array(top)
    turn = np.ones(len(pts), bool)
    if len(pts) > 2:
        a, b, c3 = pts[:-2], pts[1:-1], pts[2:]
        turn[1:-1] = np.abs((b[:, 0] - a[:, 0]) * (c3[:, 1] - a[:, 1]) - (b[:, 1] - a[:, 1]) * (c3[:, 0] - a[:, 0])) > 1e-6
    top = [tuple(q) for q in pts[turn]]
    top += [(sh + 0.8, bh / 2), (sh, bh / 2 + 0.6), (sh - 0.4, bh / 2 + 2.0), (x0, hn)]
    # the bow's own outline, round its back from the neck's top to its bottom
    keep = ~((bow[:, 0] > x0 - 1.0) & (np.abs(bow[:, 1]) < hn))
    bp = bow[keep]
    ang = np.mod(np.arctan2(bp[:, 1], bp[:, 0]), 2 * math.pi)
    bp = bp[np.argsort(ang)]
    poly = np.concatenate([np.array(under), np.array(top), bp])
    d = np.linalg.norm(np.diff(np.concatenate([poly, poly[:1]]), axis=0), axis=1)
    poly = poly[d > 1e-6]
    return (poly if _area(poly) > 0 else poly[::-1]), hole, L, cuts


def _area(p):
    return 0.5 * float(np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1]))


def make(spec, th):
    kind = spec.get("kind", "house")
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "key")
    metal = spec.get("metal", "brass")
    fin = spec.get("finish", "scratched")
    age = spec.get("age")
    th.material("main", "metal", rough=0.3, metal=1.0, color=FN.METALS.get(metal, "#c9a25e"))
    mm = 0.001
    th.island("top", 60, 32)
    th.island("bottom", 60, 32)
    th.island("edge", 200, 4)
    th.island("hole", 20, 4)
    if kind == "skeleton":
        th.island("shaft", 2 * math.pi * 3.2, 62, wrap=True)
    th.pack()
    I = th.islands

    def build(step, steps):
        if kind == "skeleton":
            # a ring bow, a round shaft, a bit with notches (mm, along +x)
            t = np.linspace(0, 2 * math.pi, int(90 / step * 2) + 24, endpoint=False)
            ring = np.stack([-9 + 11 * np.cos(t), 12.5 * np.sin(t)], 1)
            hole = np.stack([-9 + 7.2 * np.cos(-t), 8.6 * np.sin(-t)], 1)
            bow = M.slab([ring * mm, hole * mm], 3.2 * mm, 1.2 * mm, I, hole_edge="hole", steps=steps)
            L = 62.0
            prof = [(0, 0), (2.2, 0.0), (2.9, 1.5), (3.0, 4), (2.6, 6)] + [(2.6, z) for z in np.linspace(8, L - 4, 6)] + [(2.9, L - 2), (2.2, L), (0, L)]
            sh = M.lathe([M.Seg(np.array(prof) * mm, "shaft", "band")], 16 if steps < 3 else 40, I, step=step * mm * 3, mats=["main"])
            v = sh.v.copy()
            sh.v = np.stack([v[:, 2] + 0.0005, v[:, 1], v[:, 0]], 1)
            sh.a["rest"] = sh.v.copy()
            notch = [(L - 9, 2.4), (L - 9, 13), (L - 6.5, 13), (L - 6.5, 9), (L - 4.5, 9), (L - 4.5, 13), (L - 1.5, 13), (L - 1.5, 2.4)]
            bit = M.slab([np.array(notch) * mm], 3.0 * mm, 0.6 * mm, I, steps=steps)
            return M.join([bow, sh, bit])
        poly, hole, L, cuts = house_outline(spec, N.rng(seed, "cuts"))
        th.cuts = cuts
        return M.slab([M.resample_loop(poly, step) * mm, M.resample_loop(hole, step) * mm], 2.0 * mm, 0.6 * mm, I, hole_edge="hole", steps=steps)

    th.low = build(1.6, 1)
    th.high = build(0.35, 5)
    th.pose = "auto"
    tag = spec.get("tag")

    def paint(fr):
        for nm in ("top", "bottom", "edge", "hole") + (("shaft",) if kind == "skeleton" else ()):
            FN.metal(fr[nm], fin if nm in ("top", "bottom", "shaft") else "satin", metal, seed + len(nm), along=0.0, age=age,
                     age_amount=float(spec.get("age_amount", 0.4)))
        if kind == "house":
            for nm in ("top", "bottom"):
                f = fr[nm]
                # the warding grooves along the blade (its relief) and a maker's mark on the bow
                for gy, gw in ((0.5, 0.8), (-1.6, 0.7)):
                    f.rect(f.W * 0.38, f.H / 2 + gy * (1 if nm == "top" else -1), f.W * 0.55, gw, height=-0.25, add_height=True, alpha=1.0)
                f.text(spec.get("mark", "KEYWAY"), (f.W * 0.17, f.H * 0.18), 1.6, font="archivo", height=-0.04, add_height=True, alpha=0.0)
            if tag:
                f = fr["top"]
                f.ellipse(f.W * 0.17, f.H / 2, 12.5, color=tag, rough=0.5, metal=0.0)

    th.paint = paint
    th.view = {"azim": -20, "elev": 55}
    th.sharp_angle = None
    return th
