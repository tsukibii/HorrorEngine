"""Shrine charms: an ema (a wooden votive plaque, its front painted, a wish brushed on its back, hung by its red and
white cord) and an omamori (a little brocade pouch, its name embroidered down the front, closed with a cord knot). Flat
things cut from their outlines with their edges rounded; the pouch puffed by the paper it holds. Each hangs from its
cord: `socket_hang` is where a hook or peg goes.

    {"family": "charm", "kind": "ema" | "omamori",
     "art": {...the front's design fields: ema's motif, text, shrine; brocade's color, pattern, text},
     "back": {...the back's: ema's wish and name; brocade's name}, "cord": ["#c0262a", "#f2efe6"]}
"""
import math

import numpy as np

from .. import designs
from .. import mesh as M
from .. import noise as N

MM = 0.001


def rounded(pts, r, n=5):
    """A polygon's corners rounded by r mm (quadratic arcs), anticlockwise kept."""
    p = np.asarray(pts, float)
    out = []
    for i in range(len(p)):
        a, b, c = p[i - 1], p[i], p[(i + 1) % len(p)]
        ra = min(r, np.linalg.norm(a - b) / 2)
        rc = min(r, np.linalg.norm(c - b) / 2)
        p0 = b + (a - b) / np.linalg.norm(a - b) * ra
        p2 = b + (c - b) / np.linalg.norm(c - b) * rc
        for t in np.linspace(0, 1, n):
            out.append((1 - t) ** 2 * p0 + 2 * (1 - t) * t * b + t * t * p2)
    return np.array(out)


def _to_xz(m, y0=0.0):
    """A slab made lying (its outline in x, y; its faces up and down) stood up: the outline in x, z, the front toward -y."""
    v = m.v.copy()
    m.v = np.stack([v[:, 0], -v[:, 2] + y0, v[:, 1]], 1)
    m.a["rest"] = m.v.copy()
    return m


def cord_loop(hole, half_t, reach, I, island, radius=1.4, knot=True):
    """A cord through a hole (x, z in mm, the hole's top edge) up to a knot `reach` above it: its strand down the front,
    over the hole's top edge, up the back, joined at the knot, the loop above the knot to hang it by."""
    hx, hz = hole
    t = np.linspace(0, 1, 9)
    up_f = np.stack([hx + 0 * t, -half_t - radius * (1 - t) * 0.9 - 0.4, hz + reach * 0.62 * t ** 0.9], 1)
    up_b = np.stack([hx + 0 * t, half_t + radius * (1 - t) * 0.9 + 0.4, hz + reach * 0.62 * t ** 0.9], 1)
    a = np.linspace(-math.pi / 2, 1.5 * math.pi, 22)
    loop = np.stack([hx + 0 * a, 3.2 * np.cos(a), hz + reach * 0.62 + reach * 0.38 * (1 + np.sin(a)) / 2], 1)
    under = np.stack([hx + 0 * t[:5], np.linspace(half_t + radius, -half_t - radius, 5), hz - radius - 0.1 + 0 * t[:5]], 1)
    path = np.concatenate([under[2:], up_f[1:], loop[1:-1], up_b[::-1][:-1], under[:3]])
    k = np.linspace(0, 2 * math.pi, 8, endpoint=False)
    sec = np.stack([np.cos(k), np.sin(k)], 1) * radius * MM
    parts = [M.sweep(path * MM, sec, I[island], mat="cord")]
    if knot:
        kz = hz + reach * 0.62
        kp = M.lathe([M.Seg(np.array([(0, -radius * 2.0), (radius * 1.9, -radius * 1.1), (radius * 2.2, 0), (radius * 1.9, radius * 1.1),
                                      (0, radius * 2.0)]) * MM, island + "_knot", "band")], 12, I, step=0.002, mats=["cord"])
        kp.v += np.array([hx, 0, kz]) * MM
        kp.a["rest"] = kp.v.copy()
        parts.append(kp)
    return parts, np.array([hx, 0.0, hz + reach + radius])


def make(spec, th):
    kind = spec.get("kind", "ema")
    seed = int(spec.get("seed", 0))
    cord = spec.get("cord", ["#c0262a", "#f2efe6"])
    if kind == "ema":
        W, H, T = (float(x) for x in spec.get("size", (150, 102, 8)))
        th.material("main", "wood", color="#d8b98a", rough=0.6)
        th.material("cord", "fabric", color=cord[0], rough=0.8, px=256)
        th.island("front", W, H)
        th.island("back", W, H)
        th.island("edge", 2 * (W + H), T, wrap=True)
        th.island("hole", 2 * math.pi * 3, T, wrap=True)
        th.island("cord_a", 2 * math.pi * 1.4, 150, mat="cord", wrap=True)
        th.island("cord_a_knot", 2 * math.pi * 3, 6, mat="cord", wrap=True)
        th.pack()
        I = th.islands
        out = rounded([(-W / 2, 0), (W / 2, 0), (W / 2, H * 0.68), (0, H), (-W / 2, H * 0.68)], 3.5)
        hz = H * 0.84
        tt = np.linspace(0, 2 * math.pi, 28, endpoint=False)
        hole = np.stack([2.6 * np.cos(-tt), hz + 2.6 * np.sin(-tt)], 1)
        sl = M.slab([M.resample_loop(out, 3.0) * MM, hole * MM], T * MM, 1.6 * MM, I, "front", "back", "edge", hole_edge="hole", steps=3,
                    fill=10 * MM)
        _to_xz(sl)
        cparts, top = cord_loop((0, hz + 2.6), T / 2, 58, I, "cord_a")
        th.low = M.join([sl] + cparts, ["main", "cord"])
        th.sockets["hang"] = (top * MM, (0, 0, 1))
        th.view = {"azim": -24, "elev": 14}
    else:
        W, H, T = (float(x) for x in spec.get("size", (46, 72, 4)))
        th.material("main", "fabric", color=(spec.get("art") or {}).get("color", "#8e1b26"), rough=0.55)
        th.material("cord", "fabric", color=cord[0], rough=0.8, px=256)
        th.island("front", W, H)
        th.island("back", W, H)
        th.island("edge", 2 * (W + H), T + 8, wrap=True)
        th.island("cord_a", 2 * math.pi * 1.2, 120, mat="cord", wrap=True)
        th.island("cord_a_knot", 2 * math.pi * 3, 6, mat="cord", wrap=True)
        th.pack()
        I = th.islands
        c = W * 0.22
        out = rounded([(-W / 2, 0), (W / 2, 0), (W / 2, H - c), (W / 2 - c, H), (-W / 2 + c, H), (-W / 2, H - c)], 2.5)
        sl = M.slab([M.resample_loop(out, 2.0) * MM], T * MM, 1.8 * MM, I, "front", "back", "edge", steps=3, fill=3.0 * MM)
        # puffed: the faces bulge with what's inside, flat to the seam round the edge
        p2 = sl.v[:, :2] / MM
        poly = M.resample_loop(out, 1.0)
        d = np.min(np.linalg.norm(p2[:, None, :] - poly[None, :, :], axis=2), axis=1)
        bulge = float(spec.get("puff", 3.0)) * np.clip(d / 9.0, 0, 1) ** 0.6
        sl.v[:, 2] += np.sign(sl.v[:, 2]) * bulge * MM
        # the seam's crimp round the edge: a little wavy
        wav = 0.35 * np.sin(np.arctan2(p2[:, 1] - H / 2, p2[:, 0]) * 40) * (d < 1.5)
        sl.v[:, 2] += wav * MM * np.sign(sl.v[:, 2])
        _to_xz(sl)
        cparts, top = cord_loop((0, H - 1.0), T / 2 + float(spec.get("puff", 3.0)) * 0.3, 44, I, "cord_a", radius=1.2)
        th.low = M.join([sl] + cparts, ["main", "cord"])
        th.sockets["hang"] = (top * MM, (0, 0, 1))
        th.view = {"azim": -24, "elev": 12}
    th.high = None
    th.pose = spec.get("pose", "stand")
    art = dict(spec.get("art") or {})
    back = dict(spec.get("back") or {})

    def paint(fr):
        if kind == "ema":
            designs.draw(fr["front"], dict({"design": "ema"}, **art, part="front"), seed)
            designs.draw(fr["back"], dict({"design": "ema"}, **art, **back, part="back"), seed + 1)
            for nm in ("edge", "hole"):
                designs.wood_grain(fr[nm], {"color": art.get("wood", "#d8b98a"), "ring": 1.2}, N.rng(seed, nm))
        else:
            designs.draw(fr["front"], dict({"design": "brocade"}, **art, part="front"), seed)
            designs.draw(fr["back"], dict({"design": "brocade"}, **art, **back, part="back"), seed + 1)
            designs.draw(fr["edge"], dict({"design": "brocade"}, **art, part="edge"), seed + 2)
        f = fr["cord_a"]
        f.fill(color=cord[0], rough=0.8)
        f.stripes(3.0, 0.5, angle=62, color=cord[1 % len(cord)], rough=0.8, height=0.0)
        f.stripes(1.5, 0.5, angle=62, height=0.06)
        f = fr["cord_a_knot"]
        f.fill(color=cord[0], rough=0.8)
        f.stripes(2.0, 0.5, angle=50, color=cord[1 % len(cord)], rough=0.8, height=0.06)

    th.paint = paint
    return th
