"""Batteries (DECISIONS 2026-11-10, later still: the laptop's shop sells the flashlight its spares): a dry cell turned
from its real profile, customizable (`CUSTOM`): the flat minus end, the steel can under a printed wrap (its edges
rolled over the shoulders), the plus end's nub; one, or a few lying side by side as they come out of a pack.

    {"family": "cell", "size": "aa", "count": 2, "art": {"brand": "OHMA", "colors": ["#16181d", "#e2a72a"]}}

- **Sizes** (`SIZES`, mm): aa 14.5 x 50.5, aaa 10.5 x 44.5, c 26.2 x 50.0, d 34.2 x 61.5; the nub's diameter and height
  in proportion. `count` cells lie side by side along x touching, their plus ends toward +y (the first one's print up).
- **Islands**: `wrap` (round it by along it, its x round the cell from the seam at the back, its y from the minus end to
  the plus), `minus` and `plus` (the ends seen from below and above). Materials `wrap` (a printed film) and `steel`
  (the ends, nickel-plated satin).
- **The print** on the wrap (`art`: `brand`, `colors` [body, band, ink], `volts`): the body's colour with a band toward
  the plus end, the brand along its length, the size big, the volts and a plus sign by the plus end, a lot number; own
  pictures `wrap.brand`, `wrap.size`, `wrap.band` (the band's pattern).

Every brand here is made up.
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N

CUSTOM = True       # your own pictures go on it: the picture editor previews them on its picture (PROPGEN §25)

SIZES = {"aa": (14.5, 50.5), "aaa": (10.5, 44.5), "c": (26.2, 50.0), "d": (34.2, 61.5)}   # diameter, length with its nub
INK = dict(rough=0.35, metal=0.0)


def cell_profile(D_mm, L_mm):
    """The runs the lathe turns (r, z metres), the minus end at z = 0: the minus end, the wrap (over the can, its edges
    rolled round the shoulders), the plus end (its shoulder and the nub)."""
    R = D_mm / 2000
    k = D_mm / 14.5
    nub_r, nub_h = 2.75e-3 * k ** 0.8, 1.0e-3 * k ** 0.5
    top = L_mm / 1000
    minus = [(0.0, 0.0), (R * 0.82, 0.0), (R * 0.9, 0.0002)]
    wrap = [(R * 0.9, 0.0002), (R - 0.0002, 0.0005), (R, 0.0011), (R, top - nub_h - 0.0011), (R - 0.0002, top - nub_h - 0.0005),
            (R * 0.88, top - nub_h - 0.0002)]
    plus = [(R * 0.88, top - nub_h - 0.0002), (nub_r * 1.25, top - nub_h), (nub_r, top - nub_h), (nub_r, top - 0.0002),
            (nub_r * 0.93, top), (0.0, top)]
    return minus, wrap, plus


def cell_islands(th, D_mm, L_mm, wrap="wrap", steel="steel"):
    minus, wr, plus = cell_profile(D_mm, L_mm)
    th.island("wrap", math.pi * D_mm, M.arclen(wr) * 1000, wrap, wrap=True)
    th.island("minus", D_mm, D_mm, steel)
    th.island("plus", D_mm, D_mm, steel)


def cell_mesh(I, D_mm, L_mm, n, step, mats):
    """One cell turned (metres, standing on its minus end at the origin, its print's middle facing -y)."""
    minus, wr, plus = cell_profile(D_mm, L_mm)
    R = D_mm / 2000
    segs = [M.Seg(minus, "minus", "bottom", disc=R, step=0.004), M.Seg(wr, "wrap", "band", sharp=True, step=0.008),
            M.Seg(plus, "plus", "top", disc=R, sharp=True, step=0.0025)]          # flat and straight runs need few rings
    m = M.lathe(segs, n, I, step=step, mats=mats)
    m.a["rest"] = m.v.copy()
    return m


def paint_cell(fr, spec, seed, D_mm, L_mm):
    from .. import finish as FN
    art = dict(spec.get("art") or {})
    cols = list(art.get("colors") or []) + [None] * 3
    body, band, ink = cols[0] or "#16181d", cols[1] or "#e2a72a", cols[2] or "#f2f2ee"
    brand = str(art.get("brand", "OHMA"))
    size = str(spec.get("size", "aa")).upper()
    volts = str(art.get("volts", "1.5V"))
    f = fr["wrap"]
    W, H = f.W, f.H
    f.fill(color=body, rough=0.32)
    bh = H * 0.3                                             # the band toward the plus end

    def band_draw():
        f.rect(-1, H - bh, W + 2, bh + 1, color=band, rough=0.3)
        f.rect(-1, H - bh - 0.6, W + 2, 0.6, color=ink, rough=0.3)
    f.slot("band", (W / 2, H - bh / 2, W, bh), band_draw, kind="pattern", about="the band toward the plus end")
    cx = W / 2                                               # the print's middle faces you (the seam at the back)
    s = D_mm / 14.5

    def brand_draw():
        f.text(brand, (cx, (H - bh) * 0.5), min(5.0 * s, W * 0.22), font="archivo", rot=90, color=ink, tracking=0.5, **INK)
    f.slot("brand", (cx, (H - bh) * 0.5, min(6.0 * s, W * 0.3), (H - bh) * 0.8), brand_draw, kind="logo", about="the brand along the cell",
           rot=90)

    def size_draw():
        f.text(size, (cx + W * 0.25, (H - bh) * 0.45), 3.4 * s, font="archivo", rot=90, color=band, **INK)
        f.text(volts, (cx - W * 0.25, (H - bh) * 0.45), 2.2 * s, font="archivo", rot=90, color=ink, **INK)
    f.slot("size", (cx, (H - bh) * 0.45, W * 0.75, 12.0 * s), size_draw, kind="text", about="the size and its volts")
    f.text("+", (cx, H - bh * 0.5), 3.6 * s, font="archivo", color=body, **INK)
    f.text("LOT 2611-0" + str(seed % 10), (cx + W * 0.36, H * 0.12), 1.0 * s, font="mono", rot=90, color=ink, alpha=0.7, **INK)
    X, Y = f.grid()
    g = N.fbm3(np.stack([X / 2.0, Y / 0.3, np.full_like(X, seed * 0.3)], -1), seed + 3, 2)
    f.lay_island(np.ones_like(X), height=(0.002 * g).astype(np.float32), add_height=True)   # the film's faint ripple
    for nm in ("minus", "plus"):
        fe = fr[nm]
        FN.metal(fe, "satin", "nickel", seed + (1 if nm == "plus" else 2))
        c = fe.W / 2
        if nm == "minus":
            fe.ring(c, c, fe.W * 0.4, 0.3, height=-0.03, add_height=True)          # the can's crimped edge
        else:
            fe.ring(c, c, fe.W * 0.19 * (14.5 / D_mm) ** 0.2, 0.25, height=0.03, add_height=True)


def make(spec, th):
    size = spec.get("size", "aa")
    D_mm, L_mm = SIZES[size] if isinstance(size, str) else size
    count = max(1, int(spec.get("count", 1)))
    seed = int(spec.get("seed", 0))
    px = int(spec.get("tex", 512))
    art = dict(spec.get("art") or {})
    th.material("wrap", "film", px=px, color=(art.get("colors") or ["#16181d"])[0], rough=0.32)
    th.material("steel", "metal", px=max(128, px // 4), color="#c4c8cd", rough=0.3, metal=1.0)
    cell_islands(th, D_mm, L_mm)
    th.pack()
    mats = ["wrap", "steel"]
    one = cell_mesh(th.islands, D_mm, L_mm, int(spec.get("segments", 20)), 0.0012, mats)
    R = D_mm / 2000
    parts = []
    for i in range(count):
        m = one.copy()
        if count > 1:                                        # lying along y, plus end toward +y, the print up
            m.v = m.v @ M.rot("x", -90).T
            m.v += np.array([(i - (count - 1) / 2) * (2 * R + 0.0002), -L_mm / 2000, R])
        m.a["rest"] = m.v.copy()
        parts.append(m)
    th.assemble([("cells", M.join(parts, mats))], None, mats)
    th.high = None
    top = L_mm / 1000
    if count == 1:
        th.sockets = {"plus": ((0.0, 0.0, top), (0.0, 0.0, 1.0)), "minus": ((0.0, 0.0, 0.0), (0.0, 0.0, -1.0))}
    else:
        th.sockets = {"plus": ((0.0, top / 2, R), (0.0, 1.0, 0.0)), "minus": ((0.0, -top / 2, R), (0.0, -1.0, 0.0))}
    th.extras["cell"] = {"size": size, "count": count, "volts": art.get("volts", "1.5V")}
    th.pose = "stand"
    th.sharp_angle = 40
    th.view = {"azim": -30, "elev": 40}
    th.reach = 0.0015
    th.cage = 0.0008
    th.ao_dist = 0.006
    th.paint = lambda fr: paint_cell(fr, spec, seed, D_mm, L_mm)
    return th
