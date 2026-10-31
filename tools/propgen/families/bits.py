"""Small bits in a scatter, each its own: cigarette butts (a cork filter, the paper burnt back to char, stubbed out:
bent, its end squashed) and bottle caps (a crown cork's 21 crimps, a printed top, some bent double by an opener), each
lying as it came to rest, spread over a patch of ground.

    {"family": "bits", "kind": "butts" | "caps", "count": 12, "spread": 120 (mm across), "designs": [...]}
"""
import math

import numpy as np

from .. import deform as D
from .. import designs
from .. import mesh as M
from .. import noise as N

CAP_COLORS = [("#c8302b", "#ffffff"), ("#1f6f3c", "#f2d36b"), ("#e9e6df", "#c8302b"), ("#d4a32c", "#3a2412"), ("#2a4f8c", "#ffffff"),
              ("#5a1e1e", "#e8c27a")]


def butt_profile(L_f, L_p, r=3.9):
    """A butt along z (mm): the filter's end, the filter, its band, what's left of the paper, the charred end."""
    end = L_f + L_p
    return [(0, 0), (r - 0.4, 0.0), (r, 0.5), (r, L_f - 0.6), (r + 0.05, L_f), (r, L_f + 0.6), (r, end - 2.5),
            (r * 0.86, end - 1.2), (r * 0.55, end - 0.3), (0, end)]


def cap_profile():
    """A crown cork (mm): the printed top, the shoulder, the skirt flaring to its crimped edge, the liner inside."""
    return [(0, 6.0), (10, 5.95), (12.6, 5.75), (13.6, 5.2), (14.2, 4.0), (15.6, 0.9), (16.1, 0.0), (15.2, 0.3), (14.0, 3.6), (13.0, 4.9),
            (10, 5.3), (0, 5.35)]


def make(spec, th):
    kind = spec.get("kind", "butts")
    n = int(spec.get("count", 12 if kind == "butts" else 8))
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "bits")
    spread = float(spec.get("spread", 130 if kind == "butts" else 110))
    th.material("main", "filter" if kind == "butts" else "metal", rough=0.6 if kind == "butts" else 0.3,
                metal=0.0 if kind == "butts" else 1.0, color="#d29a5c" if kind == "butts" else "#c0392b")
    mm = 0.001
    items = []
    for i in range(n):
        if kind == "butts":
            L_f = r.uniform(20, 26)
            L_p = r.uniform(2, 14)
            th.island(f"b{i}", 2 * math.pi * 3.9, L_f + L_p, wrap=True)
            items.append(dict(L_f=L_f, L_p=L_p, bend=r.uniform(-40, 40) if r.random() < 0.6 else 0.0, squash=r.uniform(0.2, 0.75)))
        else:
            th.island(f"c{i}_top", 26, 26)
            th.island(f"c{i}_side", 2 * math.pi * 16.1, 10, wrap=True)
            items.append(dict(colors=CAP_COLORS[int(r.integers(len(CAP_COLORS)))], bent=r.random() < 0.35, flip=r.random() < 0.4))
    th.pack()
    I = th.islands
    parts = []
    placed = []
    for i, it in enumerate(items):
        if kind == "butts":
            prof = butt_profile(it["L_f"], it["L_p"])
            m = M.lathe([M.Seg(np.array(prof) * mm, f"b{i}", "band")], 14, I, step=0.004, mats=["main"])
            z = m.a["rest"][:, 2] / mm
            end = it["L_f"] + it["L_p"]
            # stubbed out: the burnt end squashed flat and the paper bent where it was pressed
            t = np.clip((z - (end - 6)) / 6, 0, 1)
            m.v[:, 0] *= 1 + 0.5 * it["squash"] * t
            m.v[:, 1] *= 1 - 0.8 * it["squash"] * t
            if it["bend"]:
                zb = it["L_f"] + 1.0
                ang = np.radians(it["bend"]) * np.clip((z - zb) / max(end - zb, 1), 0, 1)
                rel = (z - zb) * mm
                x0 = m.v[:, 0].copy()
                m.v[:, 0] = np.where(z > zb, x0 * np.cos(ang) + rel * np.sin(ang), x0)
                m.v[:, 2] = np.where(z > zb, zb * mm + rel * np.cos(ang) - x0 * np.sin(ang), m.v[:, 2])
            axis = (0, 0, 1)
        else:
            prof = cap_profile()
            m = M.lathe([M.Seg(np.array(prof[:4]) * mm, f"c{i}_top", "top", disc=13.6 * mm),
                         M.Seg(np.array(prof[3:]) * mm, f"c{i}_side", "band")], 42, I, step=0.002, mats=["main"])
            M.flip(m)       # lathed from the middle of its top outwards, its faces looked into it
            th_ = m.a["shell"][:, 0]
            z = m.a["rest"][:, 2] / mm
            rr = np.hypot(m.v[:, 0], m.v[:, 1])
            # the 21 crimps of the skirt, deepest at its edge
            crimp = 1 + 0.06 * np.cos(21 * th_) * np.clip((4.4 - z) / 4.4, 0, 1)
            m.v[:, 0] *= np.where(rr > 13.5 * mm, crimp, 1)
            m.v[:, 1] *= np.where(rr > 13.5 * mm, crimp, 1)
            if it["bent"]:
                # an opener's bend: the cap folded about a line across it
                ang = np.radians(r.uniform(25, 45))
                x = m.v[:, 0].copy()
                zz = m.v[:, 2].copy()
                side = x > 0
                m.v[side, 0] = x[side] * np.cos(ang) - (zz[side] - 6 * mm) * np.sin(ang)
                m.v[side, 2] = 6 * mm + x[side] * np.sin(ang) + (zz[side] - 6 * mm) * np.cos(ang)
            axis = (0, 0, 1)
        Rm = D.rest_pose(m, "lie" if kind == "butts" else ("upside" if it.get("flip") else "auto"), axis, seed + i)
        # somewhere in the patch, not on top of another
        for _try in range(40):
            p = r.uniform(-spread / 2, spread / 2, 2) * mm
            if all(np.linalg.norm(p - q) > 14 * mm for q in placed):
                break
        placed.append(p)
        yaw = r.uniform(0, 360)
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        v = m.v @ Rm.T
        v = v @ np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]).T
        v[:, :2] += p - v[:, :2].mean(0)
        v[:, 2] -= v[:, 2].min()
        m.v = v
        m.a["rest"] = m.a["rest"] + np.array([p[0], p[1], 0]) + i * 0.05
        parts.append(m)
    th.low = M.join(parts, ["main"])
    th.high = None
    th.pose = "stand"
    th.view = {"azim": -20, "elev": 42}

    def paint(fr):
        for i, it in enumerate(items):
            if kind == "butts":
                f = fr[f"b{i}"]
                L_f = it["L_f"]
                # cork: orange with darker speckles; a thin gold band; white paper; the char at the end
                f.rect(0, -1, f.W, L_f + 1, color="#d6995a", rough=0.75)
                for _ in range(int(f.W * L_f * 0.5)):
                    f.ellipse(r.uniform(0, f.W), r.uniform(0, L_f), r.uniform(0.1, 0.35), color="#9b5f2c", rough=0.8, alpha=0.7)
                f.rect(0, L_f - 0.9, f.W, 0.8, color="#c9a95a", rough=0.35, metal=0.7)
                f.rect(0, L_f, f.W, f.H - L_f + 1, color="#f3f1ea", rough=0.85)
                X, Y = f.grid()
                f.gradient("#f3f1ea", "#1a1714", angle=90, t0=max(0.0, 1 - 4.5 / f.H), t1=1.0, rough=0.95,
                           mask=(Y > L_f).astype(np.float32))
                f.slot("logo", designs.text_box("· SEVEN ·", (f.W / 2, L_f + 2.2), 0.9, font="archivo"),
                       lambda: f.text("· SEVEN ·", (f.W / 2, L_f + 2.2), 0.9, font="archivo", color="#9a8a6a", rough=0.85),
                       about="the brand printed round it, over the filter", rough=0.85)
            else:
                cA, cB = it["colors"]
                f = fr[f"c{i}_top"]
                f.fill(color=cA, rough=0.3, metal=0.7)

                def printed():
                    f.ring(f.W / 2, f.H / 2, 9.5, 0.7, color=cB, rough=0.3, metal=0.4)
                    f.text(["HOSHI", "TSUKI", "RAMUNE", "LAGER", "COLA", "SODA"][i % 6], (f.W / 2, f.H / 2), 3.0, font="bungee", color=cB,
                           rough=0.3, metal=0.4, fit=15)
                f.slot("print", (f.W / 2, f.H / 2, f.W, f.H), printed, kind="logo", about="its printed top: a ring and the brand",
                       rough=0.3, metal=0.4)
                fr[f"c{i}_side"].fill(color=cA, rough=0.3, metal=0.75)
                fr[f"c{i}_side"].rect(0, 0, fr[f"c{i}_side"].W, 3.4, color="#d8d8d4", rough=0.45, metal=0.2)

    th.paint = paint
    return th
