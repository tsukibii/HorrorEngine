"""Drink cans: a two-piece aluminium can turned from its real profile (the domed base on its stand ring, the necked
shoulder, the double seam, the countersunk lid), a stay-on tab, the opening pushed in if it's been drunk; then dented
or crushed. The label is a design (designs.py) or your own picture over the `label` island (208 x 99 mm on a 330).

    {"family": "can", "size": "330", "art": {"design": "soda", ...}, "opened": true, "tab": "#c0c4c8",
     "crush": {"amount": 0.85, "twist": 20, ...}, "dents": {"count": 3, "depth": 1.5, "radius": 9}}
"""
import math

import numpy as np

from .. import deform as D
from .. import designs
from .. import mesh as M
from .. import noise as N

SIZES = {   # body diameter, height (mm)
    "330": (66.2, 115.2), "355": (66.2, 122.2), "500": (66.2, 168.0), "250": (53.0, 134.0),
    "190": (52.8, 105.0), "350": (66.2, 122.0),
}

ALU = dict(color="#c9ccd0", rough=0.26, metal=1.0)


def profile(D_mm, H_mm):
    """The can's profile as (name, points mm) runs, from the dome's middle out and up to the lid's middle."""
    R = D_mm / 2
    s = R / 33.1
    base = [(0, 9.8), (6, 9.6), (12, 8.8), (17, 7.2), (21, 4.9), (23.6, 2.6), (24.8, 1.1), (25.6, 0.3), (26.5, 0.0), (27.6, 0.35)]
    heel = [(27.6, 0.35), (29.6, 1.8), (31.2, 4.0), (32.4, 6.8), (33.0, 9.8), (33.1, 12.0)]
    shoulder = [(33.1, -14.0), (33.0, -12.2), (32.3, -9.6), (30.9, -7.0), (29.2, -4.9), (28.1, -3.8)]
    seam = [(28.1, -3.8), (27.7, -2.8), (27.9, -1.8), (28.2, -0.8), (28.0, -0.2), (27.5, 0.0), (26.8, -0.2), (26.5, -0.9), (26.3, -2.7), (26.0, -3.3)]
    lid = [(26.0, -3.3), (25.4, -3.5), (24.9, -3.2), (24.4, -2.95), (22.0, -2.85), (12.0, -2.7), (0.0, -2.6)]
    sc = lambda pts, top=False: [(r * s, (H_mm + z * s) if top else z * s) for r, z in pts]
    body = [(R, 12.0 * s), (R, H_mm - 14.0 * s)]
    return {"base": sc(base), "heel": sc(heel), "body": body + sc(shoulder, True)[1:], "seam": sc(seam, True), "lid": sc(lid, True)}


def _tab_outline(k=1.0):
    """The stay-on tab from above (mm, the rivet at 0, its nose to -y): the outline and the finger hole."""
    from ..paint import rrect_poly
    out = rrect_poly(-6.3, -9.5, 12.6, 21.5, 5.6)
    hole = rrect_poly(-4.1, 3.6, 8.2, 6.1, 2.8)[::-1]
    return [out * k, hole * k]


def _opening(k=1.0, n=40):
    """The opening's outline on the lid (mm): a rounded teardrop at the front."""
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x = np.sin(t) * (7.5 + 1.8 * np.cos(t))
    y = -12.5 + np.cos(t) * 6.2
    return np.stack([x, y], 1) * k


def _inside(poly, pts):
    """Points (k, 2) inside a polygon (even-odd)."""
    x, y = pts[:, 0], pts[:, 1]
    ins = np.zeros(len(pts), bool)
    px, py = poly[:, 0], poly[:, 1]
    j = len(poly) - 1
    for i in range(len(poly)):
        c = ((py[i] > y) != (py[j] > y)) & (x < (px[j] - px[i]) * (y - py[i]) / (py[j] - py[i] + 1e-12) + px[i])
        ins ^= c
        j = i
    return ins


def make(spec, th):
    size = spec.get("size", "330")
    D_mm, H_mm = SIZES[size] if isinstance(size, str) else size
    R = D_mm / 2
    k = R / 33.1
    prof = profile(D_mm, H_mm)
    crushed = bool(spec.get("crush"))
    th.material("main", "metal", color=ALU["color"], rough=ALU["rough"], metal=1.0)
    th.island("label", 2 * math.pi * R, M.arclen(prof["body"]), wrap=True)
    th.island("heel", 2 * math.pi * R, M.arclen(prof["heel"]), wrap=True)
    th.island("rim", 2 * math.pi * 28.2 * k, M.arclen(prof["seam"]), wrap=True)
    th.island("lid", 2 * 26.6 * k, 2 * 26.6 * k)
    th.island("base", 2 * 27.6 * k, 2 * 27.6 * k)
    th.island("tab", 13 * k, 22 * k)
    th.island("tab_under", 6.5 * k, 11 * k)
    th.pack()
    I = th.islands
    mm = 0.001

    def segs():
        return [M.Seg(np.array(prof["base"]) * mm, "base", "bottom", disc=27.6 * k * mm),
                M.Seg(np.array(prof["heel"]) * mm, "heel", "band"),
                M.Seg(np.array(prof["body"]) * mm, "label", "band"),
                M.Seg(np.array(prof["seam"]) * mm, "rim", "band"),
                M.Seg(np.array(prof["lid"]) * mm, "lid", "top", disc=26.6 * k * mm)]

    def build(n, step):
        body = M.lathe(segs(), n, I, step=step, mats=["main"])
        # the tab: on the lid, its rivet a little behind the middle, its nose over the opening
        lid_z = (H_mm - 2.6 * k) * mm
        tab = M.extrude([p * mm for p in _tab_outline(k)], 0.45 * mm, I["tab"], under=I["tab_under"])
        tab.v[:, 1] += 1.5 * k * mm
        tab.v[:, 2] += lid_z + 0.4 * mm
        # bend the tab's nose down a touch onto the lid
        yy = tab.v[:, 1] / (10 * k * mm)
        tab.v[:, 2] -= np.clip(-yy, 0, None) ** 2 * 0.25 * mm
        th_t = np.arctan2(tab.v[:, 1], tab.v[:, 0])
        tab.a["shell"] = np.stack([th_t, tab.v[:, 2], np.hypot(tab.v[:, 0], tab.v[:, 1])], 1)
        tab.a["rest"] = tab.v.copy()
        m = M.join([body, tab])
        # the opening: the lid pushed in where it was torn
        if spec.get("opened", True):
            rest = m.a["rest"]
            top = rest[:, 2] > (H_mm - 3.6 * k) * mm
            q = rest[:, :2] / mm
            ins = _inside(_opening(k), q) & top & (np.hypot(q[:, 0], q[:, 1]) < 24.4 * k)
            istab = np.zeros(len(m.v), bool)
            istab[len(body.v):] = True
            ins &= ~istab
            m.v[ins, 2] -= 1.2 * mm
        return m

    if crushed:
        th.low = build(int(spec.get("segments", 64)), 0.003)
        th.high = build(192, 0.0009)
    else:
        th.low = build(int(spec.get("segments", 48)), 0.012)
        th.high = None
    seed = int(spec.get("seed", 0))
    for m in (th.low, th.high):
        if m is None:
            continue
        c = spec.get("crush")
        if c:
            D.crush(m, amount=c.get("amount", 0.8), at=c.get("at", 0.5), spread=c.get("spread", 0.3), squash=c.get("squash", 0),
                    twist=c.get("twist", 0), buckle=c.get("buckle", 0.6), wrinkle=c.get("wrinkle", 0.5), shorten=c.get("shorten", 0.08),
                    bend=c.get("bend", 0), rigid=(0.1, 0.9), thin=c.get("thin", 0.07), seed=c.get("seed", seed),
                    z_range=(0.0, H_mm * mm))
        dn = spec.get("dents")
        if dn:
            r = N.rng(dn.get("seed", seed), "dent_centres")
            cnt = int(dn.get("count", 2))
            ang = r.uniform(0, 2 * math.pi, cnt)
            zs = r.uniform(0.25, 0.8, cnt) * H_mm * mm
            centres = np.stack([R * mm * np.cos(ang), R * mm * np.sin(ang), zs], 1)
            rest = m.a["rest"]
            wall = ((rest[:, 2] > 14 * k * mm) & (rest[:, 2] < (H_mm - 16 * k) * mm)).astype(float)
            D.dents(m, centres, depth=dn.get("depth", 1.5) * mm, radius=dn.get("radius", 9) * mm, seed=seed, where=wall)
    th.pose = "lie" if crushed else "stand"
    art = spec.get("art") or {"design": "soda"}
    tabc = spec.get("tab", ALU["color"])
    opened = spec.get("opened", True)

    def paint(fr):
        designs.draw(fr["label"], art, seed, "soda")
        for nm in ("heel", "rim"):
            f = fr[nm]
            f.fill(**ALU)
            f.stripes(0.8, 0.5, angle=0, height=0.002, alpha=0.5)
        f = fr["lid"]
        f.fill(color="#d3d6d9", rough=0.22, metal=1.0)
        c = f.W / 2
        for rr in np.arange(2, 25, 0.6):
            f.ring(c, c, rr * k, 0.12, height=0.0015, alpha=0.5)
        f.text("RECYCLE  ·  ALUMINIUM  ·  RECYCLE", (c, c + 19.5 * k), 1.5 * k, font="archivo", arc=19.5 * k, height=0.03, add_height=True)
        if opened:
            hole = _opening(k) + c
            f.poly(hole, color="#121212", rough=0.6, metal=0.2)
            f.line(np.concatenate([hole, hole[:1]]), 0.6 * k, height=0.15, color="#b9bcbf", rough=0.3, metal=1.0)
        f = fr["base"]
        f.fill(color="#c2c5c8", rough=0.3, metal=1.0)
        c = f.W / 2
        for rr in np.arange(3, 27, 0.5):
            f.ring(c, c, rr * k, 0.12, height=0.0015, alpha=0.6)
        f.text("L2 0947  23:41 B", (c, c + 4 * k), 1.6 * k, font="mono", color="#2a2a2a", rough=0.5, metal=0.0)
        fr["tab_under"].fill(color=tabc, rough=0.3, metal=1.0)
        f = fr["tab"]
        f.fill(color=tabc, rough=0.24, metal=1.0)
        f.ring(f.W / 2, 11.2 * k, 1.6 * k, 0.5 * k, height=0.08)

    th.paint = paint
    return th
