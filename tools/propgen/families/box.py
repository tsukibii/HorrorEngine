"""Card and board boxes from their outline: a tray is a profile swept round it (the bottom, a slanted wall, a flange,
then the same back down inside a card's thickness in), so a burger clamshell is two trays hinged at the back with a
tongue at the front, a pizza-slice box a triangular tray under a flat lid propped open, a takeaway tray one tray.

    {"family": "box", "kind": "clamshell" | "slice" | "tray", "size": [w, d, h], "open": 0 (degrees),
     "art": {"design": "burger_box", ...}, "dents": {"count": 3, "depth": 1.5, "radius": 15}, "squash": 0.3}
"""
import math

import numpy as np

from .. import deform as D
from .. import designs
from .. import mesh as M
from .. import noise as N


def chamfered(w, d, c):
    """A rectangle w x d (mm) with its corners cut by c, anticlockwise, centred."""
    x, y = w / 2, d / 2
    return np.array([(x - c, -y), (x, -y + c), (x, y - c), (x - c, y), (-x + c, y), (-x, y - c), (-x, -y + c), (-x + c, -y)])


def rounded(w, d, r, n=4):
    out = []
    x, y = w / 2 - r, d / 2 - r
    for cx, cy, a0 in ((x, -y, -90), (x, y, 0), (-x, y, 90), (-x, -y, 180)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return np.array(out)


def triangle(w, d, r=6.0):
    """A pizza slice from above: its point at the front (-y), its crust along the back."""
    pts = np.array([(0, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)])
    out = []
    for i in range(3):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % 3]
        u, v = (a - b) / np.linalg.norm(a - b), (c - b) / np.linalg.norm(c - b)
        ang = math.acos(np.clip(u @ v, -1, 1))
        t = r / math.tan(ang / 2)
        p0, p1 = b + u * t, b + v * t
        for k in range(5):
            s = k / 4
            q = (1 - s) ** 2 * p0 + 2 * (1 - s) * s * b + s * s * p1
            out.append(q)
    return np.array(out)


def tray_segs(prefix, depth, taper, flange, t, step, upside=False):
    """A tray's profile: outside bottom (capped), the wall, the flange round its top, back down inside. upside: it
    will be turned over (a lid), so its bottom reads from above."""
    mm = 0.001
    out = [(0, 0), (taper, depth)]
    fl = [(taper, depth)] + ([(taper + flange, depth), (taper + flange, depth + t)] if flange > 0 else [(taper + t * 0.5, depth + t * 0.5)]) + [(taper - t, depth + t)]
    inn = [(taper - t, depth + t), (-t, t)]
    return [M.Seg(np.array(out) * mm, prefix + "wall", "band", cap="down", cap_at="start", cap_island=prefix + "bottom", step=step,
                  cap_mirror=not upside),
            M.Seg(np.array(fl) * mm, prefix + "flange", "band", step=step),
            M.Seg(np.array(inn) * mm, "inside", "band", cap="up", cap_at="end", cap_island="inside_floor", step=step)]


def make(spec, th):
    kind = spec.get("kind", "clamshell")
    seed = int(spec.get("seed", 0))
    w, d, h = spec.get("size") or {"clamshell": (125, 125, 75), "slice": (190, 240, 32), "tray": (150, 100, 45)}[kind]
    t = float(spec.get("thick", 0.7))
    paper = "card"
    th.material("main", paper, color=spec.get("color", "#f1ede2" if kind == "clamshell" else "#b78d5c"), rough=0.85)
    if kind == "clamshell":
        hb, hl = h * 0.45, h * 0.55
        taper, flange = 11.0, 7.0
        base = chamfered(w - 2 * taper, d - 2 * taper, (w - 2 * taper) * 0.2)
    elif kind == "slice":
        hb, hl = h, 0.0
        taper, flange = 1.5, 0.0
        base = triangle(w, d)
    else:
        hb, hl = h, 0.0
        taper, flange = 10.0, 0.0
        base = rounded(w - 2 * taper, d - 2 * taper, 8.0)
    per = float(np.linalg.norm(np.diff(np.concatenate([base, base[:1]]), axis=0), axis=1).sum())
    big = max(w, d) + 2 * flange
    th.island("base_bottom", big, big)
    th.island("base_wall", per * 1.2, math.hypot(taper, hb))
    th.island("base_flange", per * 1.3, flange + 2 * t + 1)
    th.island("inside", per * 1.2, math.hypot(taper, hb) + 2)
    th.island("inside_floor", big, big)
    if kind == "clamshell":
        th.island("lid_bottom", big, big)
        th.island("lid_wall", per * 1.2, math.hypot(taper, hl))
        th.island("lid_flange", per * 1.3, flange + 2 * t + 1)
        th.island("tab", 24, 14)
    if kind == "slice":
        th.island("lid_top", w, d)
        th.island("lid_under", w, d)
    th.pack()
    I = th.islands
    mm = 0.001

    def build(step):
        outline = M.resample_loop(base, step * 1000) * mm
        parts = [M.loft(outline, tray_segs("base_", hb, taper, flange, t, step), I, ["main"])]
        if kind == "clamshell":
            lid = M.loft(outline, tray_segs("lid_", hl, taper, flange, t, step, upside=True), I, ["main"])
            # upside down onto the base: its flange on the base's, its bottom now its top
            lid.v[:, 2] = -lid.v[:, 2] + (hb + hl + 2 * t) * mm
            M.flip(lid)
            # the tongue: down from the lid's front flange
            y0 = (-(d / 2) - flange + 0.8) * mm
            tab = M.extrude([np.array([(-11, 0), (11, 0), (9, -13), (-9, -13)]) * mm], t * mm, I["tab"])
            tv = tab.v.copy()
            tab.v = np.stack([tv[:, 0], np.full(len(tv), y0) + tv[:, 2], (hb + t) * mm + tv[:, 1]], 1)
            M.flip(tab)
            tab.a["rest"] = tab.v.copy()
            ang = math.radians(float(spec.get("open", 0)))
            if ang:
                yh, zh = (d / 2 + flange) * mm, (hb + t) * mm
                for p in (lid, tab):
                    yy, zz = p.v[:, 1] - yh, p.v[:, 2] - zh
                    p.v[:, 1] = yh + yy * math.cos(ang) + zz * math.sin(ang)
                    p.v[:, 2] = zh - yy * math.sin(ang) + zz * math.cos(ang)
            parts += [lid, tab]
        if kind == "slice":
            lid = M.extrude([M.offset_poly(base, taper + 0.5) * mm], 1.2 * mm, I["lid_top"], under=I["lid_under"], flip_bottom=False)
            lid.v[:, 2] += (hb + 0.6) * mm
            ang = math.radians(float(spec.get("open", 110)))
            yh, zh = (d / 2) * mm, (hb + 0.6) * mm
            yy, zz = lid.v[:, 1] - yh, lid.v[:, 2] - zh
            lid.v[:, 1] = yh + yy * math.cos(ang) + zz * math.sin(ang)
            lid.v[:, 2] = zh - yy * math.sin(ang) + zz * math.cos(ang)
            lid.a["rest"] = lid.v.copy()
            parts.append(lid)
        m = M.join(parts, ["main"])
        m.a["rest"] = m.v.copy()
        return m

    dn = spec.get("dents")
    sq = float(spec.get("squash", 0))
    th.low = build(0.03)
    th.high = build(0.003) if dn or sq else None
    for m in (th.low, th.high):
        if m is None:
            continue
        if sq:
            # pressed from above: the top comes down, the walls bow out a little, creases where they bend
            z = m.v[:, 2] / max(m.v[:, 2].max(), 1e-9)
            m.v[:, 2] *= 1 - sq * 0.35 * z
            bow = np.sin(np.clip(z, 0, 1) * math.pi) * sq * 0.004
            r = np.linalg.norm(m.v[:, :2], axis=1, keepdims=True)
            m.v[:, :2] += m.v[:, :2] / np.maximum(r, 1e-9) * bow[:, None]
            D.displace(m, sq * 1.2 * mm, 25 * mm, seed + 3, ridged=True)
        if dn:
            r = N.rng(dn.get("seed", seed), "box_dents")
            lo, hi = m.v.min(0), m.v.max(0)
            cnt = int(dn.get("count", 3))
            centres = np.stack([r.uniform(lo[0], hi[0], cnt), r.uniform(lo[1], hi[1], cnt), r.uniform(lo[2], hi[2], cnt)], 1)
            D.dents(m, centres, depth=dn.get("depth", 1.5) * mm, radius=dn.get("radius", 14) * mm, seed=seed)
    th.pose = "stand"
    th.sharp_angle = 32
    art = spec.get("art") or {"design": "burger_box" if kind == "clamshell" else "kraft"}

    def paint(fr):
        for nm, f in fr.items():
            if nm in ("inside", "inside_floor", "lid_under"):
                designs.draw(f, {"design": "card_plain", "color": spec.get("inside", "#d9cfbf" if kind == "clamshell" else "#a57c4f")}, seed, "card_plain")
            else:
                designs.draw(f, dict(art, part=nm), seed, "kraft")

    th.paint = paint
    th.view = {"azim": -25, "elev": 34}
    return th
