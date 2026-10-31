"""A bin bag: black film round whatever is in it. A sack turned from its profile, then pushed out by lumps (what's
inside), sagging onto the floor, the film's folds running up to the neck, the neck gathered into twisted pleats, the
knot's two ears on top. Its folds are in a detailed copy, baked into the game mesh's normal map.

    {"family": "sack", "size": [440, 560] (width, height mm), "color": "#141416", "lumps": 7, "folds": 0.7}
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N


def make(spec, th):
    W, H = spec.get("size", (440, 560))
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "sack")
    color = spec.get("color", "#141416")
    th.material("main", "film", color=color, rough=0.38, metal=0.0, specular=0.55)
    R = W / 2
    zn = H * 0.78                                     # where the neck starts
    prof = [(0, 0), (R * 0.55, 1.0), (R * 0.9, 6), (R * 1.0, H * 0.18), (R * 0.98, H * 0.42), (R * 0.86, H * 0.62), (R * 0.55, zn - 20),
            (R * 0.16, zn), (R * 0.1, zn + 28), (R * 0.06, zn + 50), (0, zn + 54)]
    th.island("film", 2 * math.pi * R, M.arclen(prof), wrap=True)
    th.island("ears", 120, 60)
    th.pack()
    I = th.islands
    mm = 0.001
    lumps = [(r.uniform(0, 2 * math.pi), r.uniform(0.12, 0.7), r.uniform(0.14, 0.3), r.uniform(0.06, 0.17)) for _ in range(int(spec.get("lumps", 7)))]
    folds = float(spec.get("folds", 0.7))
    off = r.uniform(-50, 50, 3)

    def shape(m):
        th_, z, rr = m.a["shell"][:, 0], m.a["shell"][:, 1] / mm, m.a["shell"][:, 2] / mm
        t = z / H
        # what's inside: lumps pushing the film out
        bump = np.zeros_like(z)
        for a, tz, w, amp in lumps:
            da = np.angle(np.exp(1j * (th_ - a)))
            bump += amp * np.exp(-(da / (w * 2.2)) ** 2 - ((t - tz) / w) ** 2)
        body = (t < zn / H).astype(float) * np.clip(rr / R, 0, 1)
        k = 1 + bump * body + 0.07 * N.fbm3(np.stack([np.cos(th_) * 2 + off[0], np.sin(th_) * 2 + off[1], t * 3], 1), seed, 3) * body
        x, y = rr * k * np.cos(th_), rr * k * np.sin(th_)
        # the film's folds: sharp ridges running up toward the neck, stronger where it's gathered
        u = th_ * R / 40.0
        rid = N.ridged3(np.stack([u + off[2], t * 2.2, np.full_like(u, off[0])], 1), seed + 3, 3)
        gather = np.clip((t - 0.45) / 0.35, 0, 1) ** 1.5
        fold = folds * (6 + 10 * gather) * (rid - 0.5) * body
        nx, ny = np.cos(th_), np.sin(th_)
        x, y = x + nx * fold, y + ny * fold
        # the neck: pleats twisted round it
        neck = np.clip((t - zn / H + 0.03) / 0.08, 0, 1)
        tw = neck * 2.2 * (t - zn / H) * 10
        pleat = 1 + 0.35 * neck * np.sin(9 * th_ + tw)
        c, s = np.cos(tw * 0.6), np.sin(tw * 0.6)
        x, y = (x * c - y * s) * pleat, (x * s + y * c) * pleat
        # sagging onto the floor: the bottom spreads and flattens
        sag = np.clip(1 - z / (H * 0.25), 0, 1) ** 2
        x *= 1 + 0.12 * sag
        y *= 1 + 0.12 * sag
        z2 = z * (1 - 0.1 * np.clip(1 - t, 0, 1))
        m.v = np.stack([x, y, z2], 1) * mm
        return m

    def ears(n):
        """The knot's two ears: flattened lobes of film sticking up and out of the neck."""
        out = []
        for side in (-1, 1):
            a = np.linspace(0, 2 * math.pi, n, endpoint=False)
            prof2 = [(0, 0), (9, 2), (16, 12), (17, 34), (12, 52), (5, 62), (0, 64)]
            e = M.lathe([M.Seg(np.array(prof2) * mm, "ears", "band")], n, I, step=0.004, mats=["main"])
            v = e.v.copy()
            v[:, 1] *= 0.35
            ang = math.radians(32 * side)
            x, z = v[:, 0], v[:, 2]
            v[:, 0] = x * math.cos(ang) + z * math.sin(ang)
            v[:, 2] = -x * math.sin(ang) + z * math.cos(ang)
            v[:, 2] += (zn + 40) * mm
            v += N.fbm3(v / (25 * mm) + side * 7.3, seed + 20 + side, 2)[:, None] * 2.5 * mm
            e.v = v
            e.a["rest"] = v.copy()
            out.append(e)
        return out

    def build(n, step):
        m = M.lathe([M.Seg(np.array(prof) * mm, "film", "band")], n, I, step=step, mats=["main"])
        shape(m)
        return M.join([m] + ears(max(12, n // 4)))

    th.low = build(int(spec.get("segments", 56)), 0.018)
    th.high = build(200, 0.0035)
    th.pose = "stand"
    th.view = {"azim": -25, "elev": 22}
    th.mats["main"]["wear"] = {}

    def paint(fr):
        for nm in ("film", "ears"):
            f = fr[nm]
            f.fill(color=color, rough=0.36, metal=0.0)
            X, Y = f.grid()
            g = N.fbm3(np.stack([X / 30.0, Y / 30.0, np.full_like(X, 1.3)], -1), seed + 8, 3)
            f.lay_island(np.ones_like(X), rough=np.clip(0.34 + 0.12 * g, 0, 1).astype(np.float32),
                         height=(N.fbm3(np.stack([X / 2.0, Y / 9.0, np.full_like(X, 2.2)], -1), seed + 9, 2) * 0.01).astype(np.float32))

    th.paint = paint
    return th
