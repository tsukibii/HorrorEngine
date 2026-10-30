"""Cutlery and kitchen tools: a spoon, a teaspoon, a fork, a table knife, a chef's knife with wooden scales, chopsticks.
Each is cut from its outline (half-widths along its length: the handle's end, the neck, the bowl or the tines, softly
joined), its edges rounded, its thickness varying along it (and across a blade: the grind), its handle bowed, a spoon's
bowl pressed in; the game mesh keeps a few rings round each edge and the detailed one's rounding is baked into it.
The metal's finish is finish.py's (mirror, satin, brushed, swirl, scratched...) and it can age (tarnish, rust).

    {"family": "utensil", "kind": "spoon" | "teaspoon" | "fork" | "knife" | "chef_knife" | "chopsticks",
     "metal": "steel", "finish": "swirl", "age": "tarnish", "age_amount": 0.4, "handle": "#5a3a22", "length": 200}
"""
import math

import numpy as np

from .. import designs
from .. import finish as FN
from .. import mesh as M
from .. import noise as N


def smooth_max(a, b, p=6.0):
    return (np.maximum(a, 0) ** p + np.maximum(b, 0) ** p) ** (1 / p)


def interp(xs, ctrl):
    """A smooth curve through (x, y) control points (monotone cubic), at xs."""
    cx, cy = np.array(ctrl, float).T
    d = np.diff(cy) / np.diff(cx)
    m = np.concatenate([[d[0]], (d[:-1] + d[1:]) / 2, [d[-1]]])
    for i in range(len(d)):
        if d[i] == 0:
            m[i] = m[i + 1] = 0
    i = np.clip(np.searchsorted(cx, xs) - 1, 0, len(cx) - 2)
    h = cx[i + 1] - cx[i]
    t = (xs - cx[i]) / h
    h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
    return h00 * cy[i] + h10 * h * m[i] + h01 * cy[i + 1] + h11 * h * m[i + 1]


def from_widths(L, wfun, step):
    """An outline (mm, anticlockwise) from a half-width function along x in [0, L], its ends rounded by the function
    going to 0 there."""
    xs = np.linspace(0, L, max(8, int(L / step)) + 1)
    # more points near the rounded ends
    xs = np.unique(np.concatenate([xs, np.linspace(0, 6, 7), L - np.linspace(0, 6, 7)]))
    w = np.maximum(wfun(xs), 0)
    right = np.stack([xs, -w], 1)
    left = np.stack([xs[::-1], w[::-1]], 1)
    pts = np.concatenate([right, left[1:-1]])
    keep = np.ones(len(pts), bool)
    keep[1:] = np.linalg.norm(np.diff(pts, axis=0), axis=1) > 1e-6
    return pts[keep]


def end_cap(xs, x0, r, w0, side=1):
    """An elliptical end: half-width w0 at x0 +- r falling to 0 at the end (side -1 the start, 1 the end)."""
    t = np.clip((xs - x0) * side / r, 0, 1)
    return w0 * np.sqrt(np.clip(1 - t * t, 0, 1))


def spoon_widths(L, k=1.0):
    hx = 0.62 * L

    def w(xs):
        handle = interp(np.clip(xs, 12 * k, hx), [(12 * k, 11 * k), (40 * k, 10.4 * k), (70 * k, 8.4 * k), (100 * k, 5.8 * k), (hx, 4.2 * k)])
        handle = np.where(xs < 12 * k, end_cap(xs, 12 * k, 12 * k, 11 * k, -1), handle)
        handle = np.where(xs > hx, 4.2 * k, handle) * (xs <= L * 0.8)
        bx, ax, ay = L - 0.17 * L, 0.17 * L, 0.105 * L
        bowl = ay * np.sqrt(np.clip(1 - ((xs - bx) / ax) ** 2, 0, 1))
        return smooth_max(handle, bowl, 5)
    return w, (L - 0.17 * L, 0.17 * L * 0.9, 0.105 * L * 0.86)


def fork_outline(L, step):
    """The fork: the spoon's handle, a head widening to four tines with three gaps (mm)."""
    head0, tines0 = 0.65 * L, 0.82 * L
    hw = 12.5 * L / 195

    def w(xs):
        handle = interp(np.clip(xs, 12, head0), [(12, 11), (40, 10.4), (70, 8.4), (100, 5.8), (head0, 4.4)])
        handle = np.where(xs < 12, end_cap(xs, 12, 12, 11, -1), handle)
        head = interp(np.clip(xs, head0, tines0), [(head0, 4.4), (head0 + 0.06 * L, 7.0), (head0 + 0.11 * L, 10.5), (tines0, hw)])
        return np.where(xs <= head0, handle, head)

    xs = np.linspace(0, tines0, int(tines0 / step) + 1)
    xs = np.unique(np.concatenate([xs, np.linspace(0, 6, 7)]))
    ww = w(xs)
    right = [(x, -y) for x, y in zip(xs, ww)]
    left = [(x, y) for x, y in zip(xs[::-1], ww[::-1])]
    # the tines from the right (y < 0) to the left, each a rounded tip, each gap a rounded slot
    g, n = 2.0 * L / 195, 4
    wt = (2 * hw - (n - 1) * g) / n
    tip = L
    gap_bottom = tines0 + 0.03 * L
    pts = []
    for i in range(n):
        y0 = -hw + i * (wt + g)
        y1 = y0 + wt
        x_tip = tip - (0.012 * L if i in (0, n - 1) else 0)
        steps = max(3, int(2 * (x_tip - gap_bottom) / step))
        if i == 0:
            pts += [(x, y0 + 0.1 * (x - tines0) / (tip - tines0)) for x in np.linspace(tines0, x_tip - wt * 0.6, steps)[1:]]
        else:
            pts += [(x, y0) for x in np.linspace(gap_bottom, x_tip - wt * 0.6, steps)[1:]]
        for a in np.linspace(math.pi, 0, 7):
            pts.append((x_tip - wt * 0.6 + wt * 0.6 * math.sin(a) * 0.9, (y0 + y1) / 2 - wt / 2 * math.cos(a)))
        if i == n - 1:
            pts += [(x, y1 - 0.1 * (x - tines0) / (tip - tines0)) for x in np.linspace(x_tip - wt * 0.6, tines0, steps)[1:]]
        else:
            pts += [(x, y1) for x in np.linspace(x_tip - wt * 0.6, gap_bottom, steps)[1:]]
            for a in np.linspace(math.pi, 0, 5)[1:-1]:
                pts.append((gap_bottom - g / 2 * math.sin(a), y1 + g / 2 - g / 2 * math.cos(a)))
    out = np.array(right + pts + left[1:-1])
    keep = np.ones(len(out), bool)
    keep[1:] = np.linalg.norm(np.diff(out, axis=0), axis=1) > 1e-6
    return out[keep]


def knife_outline(L, step, chef=False):
    """A table knife (a rounded blade on a heavy handle) or a chef's knife's blade alone (mm). Returns the blade's and
    the handle's outlines, and where the blade starts."""
    if chef:
        b0, H = 0.36 * L, 0.14 * L
        xs = np.linspace(b0, L, int((L - b0) / step) + 1)
        t = (xs - b0) / (L - b0)
        spine = H * 0.5 - 0.06 * H * t ** 3 - 0.45 * H * np.clip((t - 0.72) / 0.28, 0, 1) ** 1.6
        edge = -H * 0.5 + H * 0.05 * t + 0.93 * H * np.clip((t - 0.45) / 0.55, 0, 1) ** 2.2
        # the tip: where the spine comes down to meet the rising edge
        meet = np.nonzero(spine - edge < 1.2)[0]
        if len(meet):
            k = meet[0]
            xs, spine, edge = xs[:k + 1], spine[:k + 1], edge[:k + 1]
            mid = (spine[-1] + edge[-1]) / 2
            spine[-1] = edge[-1] = mid
        blade = np.concatenate([np.stack([xs, edge], 1), np.stack([xs[::-1], spine[::-1]], 1)[1:-1]])
        hx = np.linspace(0, b0 + 4, int((b0 + 4) / step) + 1)
        hw = interp(np.clip(hx, 10, b0 + 4), [(10, 10.5), (0.15 * L, 11.5), (0.28 * L, 10.5), (b0 + 4, 9.5)])
        hw = np.where(hx < 10, end_cap(hx, 10, 10, 10.5, -1), hw)
        handle = np.concatenate([np.stack([hx, -hw + 0.12 * H], 1), np.stack([hx[::-1], hw[::-1] + 0.12 * H], 1)[1:-1]])
        return blade, handle, b0
    b0 = 0.5 * L

    def w(xs):
        h = interp(np.clip(xs, 10, b0), [(10, 9.0), (0.2 * L, 8.6), (0.4 * L, 7.6), (b0, 6.2)])
        return np.where(xs < 10, end_cap(xs, 10, 10, 9.0, -1), h)

    hx = np.linspace(0, b0 + 2, int((b0 + 2) / step) + 1)
    handle = from_widths(b0 + 2, w, step)
    xs = np.linspace(b0 - 1, L, int((L - b0) / step) + 1)
    t = (xs - b0) / (L - b0)
    spine = 7.2 - 1.6 * t ** 2 - 4.2 * np.clip((t - 0.8) / 0.2, 0, 1) ** 2
    edge = -7.2 + 1.5 * t + 6.0 * np.clip((t - 0.55) / 0.45, 0, 1) ** 2.4
    edge = np.minimum(edge, spine - 0.3)
    blade = np.concatenate([np.stack([xs, edge], 1), np.stack([xs[::-1], spine[::-1]], 1)[1:-1]])
    return blade, handle, b0


SIZES = {"spoon": 200, "teaspoon": 138, "fork": 195, "knife": 215, "chef_knife": 320, "chopsticks": 230}


def make(spec, th):
    kind = spec.get("kind", "spoon")
    L = float(spec.get("length", SIZES[kind]))
    seed = int(spec.get("seed", 0))
    metal = spec.get("metal", "steel")
    fin = spec.get("finish", "swirl")
    age = spec.get("age")
    th.material("main", "steel" if metal not in ("brass", "copper", "bronze") else "metal", rough=0.25, metal=1.0, color=FN.METALS.get(metal, "#c6c9cc"))
    parts = []
    mm = 0.001
    if kind == "chopsticks":
        th.material("main", "plastic", rough=0.25, metal=0.0, color=spec.get("color", "#7a1f1a"))
        th.island("stick", 2 * math.pi * 3.6, L, wrap=True)
        th.pack()

        def build(n, step):
            prof = [(0, 0), (1.15, 0.0), (1.25, 0.6)] + [(1.25 + (3.5 - 1.25) * (z / L) ** 0.9, z) for z in np.linspace(2, L - 1, 12)] + [(3.4, L), (0, L)]
            out = []
            for i, dy in enumerate((-6.5, 6.5)):
                st = M.lathe([M.Seg(np.array(prof) * mm, "stick", "band")], n, th.islands, step=step, mats=["main"])
                # lying along x, a little apart and askew
                v = st.v.copy()
                st.v = np.stack([v[:, 2] - L * mm / 2, v[:, 1] + dy * mm + v[:, 2] * (0.02 if i else -0.01), v[:, 0] + 3.5 * mm], 1)
                st.a["rest"] = st.v.copy()
                out.append(st)
            return M.join(out)

        th.low = build(8, 0.02)
        th.high = None
        th.sharp_angle = 50

        def paint(fr):
            designs.draw(fr["stick"], dict(spec.get("art") or {"design": "lacquer"}), seed, "lacquer")

        th.paint = paint
        th.pose = "stand"
        th.view = {"azim": -20, "elev": 40}
        return th

    if kind in ("spoon", "teaspoon"):
        k = L / 200.0
        wfun, bowl = spoon_widths(L, k)
        outline_of = lambda step: from_widths(L, wfun, step)
        width = 2 * 0.105 * L
    elif kind == "fork":
        outline_of = lambda step: fork_outline(L, step)
        width = 25.0 * L / 195
    else:
        outline_of = lambda step: knife_outline(L, step, kind == "chef_knife")
        width = (0.14 * L if kind == "chef_knife" else 16.0) + 2
    th.island("top", L, width + 2)
    th.island("bottom", L, width + 2)
    th.island("edge", 2.2 * L + 2 * width, 6)
    if kind == "chef_knife":
        th.material("wood", "wood", rough=0.6, color=spec.get("handle", "#5a3622"))
        th.island("h_top", 0.4 * L, 26, mat="wood")
        th.island("h_bottom", 0.4 * L, 26, mat="wood")
        th.island("h_edge", 0.9 * L, 24, mat="wood")
    th.pack()
    I = th.islands

    def shape(m, blade_from=None, chef=False):
        """Bends, thickness and the bowl, from each vertex's rest place (mm)."""
        p = m.a["rest"] / mm
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        t_ref = 2.0
        if kind in ("spoon", "teaspoon"):
            k = L / 200
            th_ = interp(np.clip(x, 0, L), [(0, 1.7), (0.3 * L, 2.4), (0.6 * L, 2.9), (0.68 * L, 2.0), (L, 1.4)]) * k ** 0.5
            bx, ax, ay = bowl
            r2 = ((x - bx) / ax) ** 2 + (y / ay) ** 2
            dip = -0.034 * L * np.clip(1 - r2, 0, 1) ** 0.9
            lift = 0.045 * L * np.clip(1 - x / (0.55 * L), 0, 1) ** 2
            zc = lift + dip + 0.012 * L * np.exp(-((x - 0.64 * L) / (0.05 * L)) ** 2)
        elif kind == "fork":
            th_ = interp(np.clip(x, 0, L), [(0, 1.7), (0.3 * L, 2.4), (0.62 * L, 2.9), (0.75 * L, 1.9), (L, 1.4)])
            lift = 0.045 * L * np.clip(1 - x / (0.55 * L), 0, 1) ** 2
            zc = lift - 0.03 * L * np.clip((x - 0.7 * L) / (0.3 * L), 0, 1) ** 1.5 + 0.01 * L * np.exp(-((x - 0.66 * L) / (0.05 * L)) ** 2)
        elif kind == "knife":
            spine = 7.2
            th_ = np.where(x < blade_from, interp(np.clip(x, 0, blade_from), [(0, 4.0), (0.25 * L, 5.0), (blade_from, 4.2)]),
                           0.5 + 1.3 * np.clip((y + 7.2) / (2 * spine), 0, 1))
            zc = 0.012 * L * np.clip(1 - x / (0.5 * L), 0, 1) ** 2
        else:
            # the chef's blade: spine 2.6 mm thinning to the edge; the handle is its own part
            H = 0.14 * L
            th_ = 0.35 + 2.3 * np.clip((y + H * 0.5) / H, 0, 1) ** 1.3
            zc = np.zeros_like(x)
        z2 = z / (t_ref / 2) * (th_ / 2) + zc
        m.v = np.stack([x, y, z2], 1) * mm
        return m

    def build(step, steps, fill):
        out = outline_of(step)
        if kind in ("knife", "chef_knife"):
            blade, handle, b0 = out
            bl = M.slab([M.resample_loop(blade, step) * mm], 2.0 * mm, 0.5 * mm, I, steps=steps, fill=fill)
            shape(bl, b0, kind == "chef_knife")
            res = [bl]
            if kind == "knife":
                hd = M.slab([M.resample_loop(handle, step) * mm], 2.0 * mm, 0.9 * mm, I, steps=steps, fill=fill)
                shape(hd, b0)
                res.append(hd)
            else:
                hd = M.slab([M.resample_loop(handle, step) * mm], 20.0 * mm, 6.0 * mm, I, "h_top", "h_bottom", "h_edge",
                            steps=max(steps, 3), mat="wood", fill=fill)
                hd.v[:, 2] += 0.0
                res.append(hd)
            return M.join(res, ["main"] + (["wood"] if kind == "chef_knife" else []))
        sl = M.slab([M.resample_loop(out, step) * mm], 2.0 * mm, 0.85 * mm, I, steps=steps, fill=fill)
        return shape(sl)

    th.low = build(3.5, 1, 6.0 * mm if kind in ("spoon", "teaspoon", "fork") else None)
    th.high = build(0.6, 5, 1.6 * mm if kind in ("spoon", "teaspoon", "fork") else None)
    th.pose = "auto"
    th.sharp_angle = None
    art = spec.get("art") or {}

    def paint(fr):
        along = 0.0
        for nm in ("top", "bottom", "edge"):
            FN.metal(fr[nm], fin if nm != "edge" else ("satin" if fin != "mirror" else "polished"), metal, seed + len(nm), along=along,
                     age=age, age_amount=float(spec.get("age_amount", 0.4)))
        if kind == "knife":
            f = fr["top"]
            f.text(art.get("stamp", "STAINLESS"), (L * 0.56, f.H / 2 + 1.5), 1.4, font="archivo", height=-0.01, add_height=True)
        if kind == "chef_knife":
            for nm in ("h_top", "h_bottom", "h_edge"):
                designs.draw(fr[nm], {"design": "wood_grain", "color": spec.get("handle", "#5a3622"), "part": nm}, seed + 3, "wood_grain")
            for f in (fr["h_top"], fr["h_bottom"]):
                for xr in (0.18, 0.5, 0.8):
                    cx, cy = f.W * xr * 0.85 + 4, f.H / 2 + 3
                    f.ellipse(cx, cy, 2.4, color="#c9ccce", rough=0.25, metal=1.0, height=0.1)
                    f.ring(cx, cy, 2.4, 0.3, color="#55585a", rough=0.4, metal=1.0)
            f = fr["top"]
            f.text(art.get("stamp", "KUROGANE  鋼"), (0.45 * L, f.H * 0.62), 2.2, font="gothic_jp", color="#2b2c2e", rough=0.5, metal=0.6, alpha=0.85)

    th.paint = paint
    th.view = {"azim": -25, "elev": 48}
    return th
