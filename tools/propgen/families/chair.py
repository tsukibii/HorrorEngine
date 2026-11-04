"""Chairs (the user, 2026-11-04: "chairs currently don't look quite right: create some basic chair styles, all chairs
should be able to support simple cushions"; the research: docs/research/tables_chairs.md). A `style` and its numbers,
the seat `seat_h` (mm) high and `seat` [width, depth] (mm), the whole `back_h` (mm) tall, its back raked `rake` degrees:

- `dining` (square legs, a seat board on rails, a top rail and three slats), `ladderback` (round posts, four slats
  across, rungs), `spindle` (a Windsor: a thick shaped seat, splayed turned legs, spindles to a bent crest), `cafe`
  (a bentwood stool: a round seat on a bent ring, four bent legs flaring to their feet), `school` (a steel tube
  frame, a plywood seat and back), `stool` (a round seat on splayed legs and a ring of rails), `bench` (a long seat on
  four legs), `zaisu` (a Japanese legless chair: a low seat and a reclined back);
- the wood as the table's (families/furniture.py): `wood`, `ring`, `finish` "raw" | "oil" | "satin" | "gloss",
  `flaws`, `painted` with `paint_color`; a school chair's tubes `frame_color`;
- `cushion`: {"on": true, "seat": true, "back": false, "thick": 45 (mm), "fill": 0.75, "ties": true, "color", "pattern",
  "ink", "rough"} or false: pads made by the cloth (families/cushion.py) to the seat's own outline and the back's,
  settled on them, baked onto a light mesh; ties round the back posts. `"on": false` makes it bare with the pads'
  settings kept (the page's switch on the cushion's box; a thumbnail of each, docs/PROPGEN.md §25).

    {"family": "chair", "style": "dining", "wood": "#6e4529", "cushion": {"seat": true, "color": "#7a2e2a"}}
    {"family": "chair", "style": "school", "frame_color": "#8a8f96", "wood": "#c9a46e"}
"""
import math

import numpy as np

from .. import mesh as M
from . import cushion as CU
from . import furniture as FU
from .bedding import paint_cover

FIELDS = {"style": "dining", "seat_h": 450, "seat": [440, 420], "back_h": 880, "rake": 8, "wood": "#7a4e2d", "ring": 5.0,
          "finish": "oil", "flaws": {"grain": 0.5, "cracks": 0.15, "scratches": 0.3, "dents": 0.2}, "painted": False,
          "paint_color": "#d8d4cc", "frame_color": "#8a8f96",
          "cushion": {"on": True, "seat": True, "back": False, "thick": 45, "fill": 0.75, "ties": True, "color": "#7a5c4a",
                      "pattern": "plain", "ink": "#c8b9a0", "rough": 0.9}}
CHOICES = {"style": ["dining", "ladderback", "spindle", "cafe", "school", "stool", "bench", "zaisu"],
           "finish": ["raw", "oil", "satin", "gloss"], "cushion.pattern": ["plain", "stripes", "check", "dots", "seigaiha"]}
LABELS = {"seat": ["width", "depth"]}

DEFAULTS = {   # each style's own numbers (mm, degrees) where the recipe gives none
    "dining": dict(seat_h=450, seat=[440, 420], back_h=880, rake=8),
    "ladderback": dict(seat_h=440, seat=[460, 400], back_h=1020, rake=7),
    "spindle": dict(seat_h=450, seat=[460, 420], back_h=900, rake=10),
    "cafe": dict(seat_h=460, seat=[360, 360], back_h=460, rake=0),
    "school": dict(seat_h=430, seat=[400, 380], back_h=780, rake=6),
    "stool": dict(seat_h=650, seat=[340, 340], back_h=650, rake=0),
    "bench": dict(seat_h=440, seat=[1200, 340], back_h=440, rake=0),
    "zaisu": dict(seat_h=70, seat=[440, 440], back_h=480, rake=20),
}


def _post_dir(rake):
    """A back post's way up, raked back (+y) by rake degrees."""
    a = math.radians(rake)
    return np.array([0.0, math.sin(a), math.cos(a)])


def _toward(d):
    """A rotation taking a part's own x onto direction d (unit)."""
    x = np.asarray(d, float) / np.linalg.norm(d)
    up = np.array([1.0, 0.0, 0.0]) if abs(x[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    y = np.cross(up, x)
    if np.linalg.norm(y) < 1e-6:
        y = np.cross([0.0, 0.0, 1.0], x)
    y /= np.linalg.norm(y)
    z = np.cross(x, y)
    return np.stack([x, y, z], 1)


def _board_between(P, name, a, b, w, h, r=0.003, kind="board", mat=None, twist=None):
    """A board from point a to point b (its section w by h, h along `twist`'s up if given)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = b - a
    L = float(np.linalg.norm(d))
    R = _toward(d)
    if twist is not None:                                  # keep the section's h along a chosen up
        x = d / L
        z = np.asarray(twist, float) - (np.asarray(twist, float) @ x) * x
        z /= np.linalg.norm(z)
        R = np.stack([x, np.cross(z, x), z], 1)
    P.board(name, L, w, h, R=R, at=tuple(a), r=r, kind=kind, mat=mat)


def _turned_between(P, name, a, b, prof_r, kind="turned", smooth=True, mat=None):
    """A turned part from a to b, its radius by a profile [(t 0..1, radius)]."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    L = float(np.linalg.norm(b - a))
    P.turned(name, [(t * L, rr) for t, rr in prof_r], R=_toward(b - a), at=tuple(a), kind=kind, smooth=smooth, mat=mat)


def _spindle_prof(r):
    return [(0.0, r * 0.8), (0.1, r), (0.5, r * 1.15), (0.9, r * 0.95), (1.0, r * 0.8)]


def _leg_prof(r):
    return [(0.0, r * 0.75), (0.25, r * 0.95), (0.5, r * 1.1), (0.62, r * 0.8), (0.7, r), (0.95, r * 0.9), (1.0, r * 0.85)]


def _build(S, P, spec):
    """The style's parts on the plan: (info for the cushions: the seat's outline and top, the back's plane, the posts)."""
    st = S["style"]
    sh, (W, D), bh = S["seat_h"] * 0.001, [v * 0.001 for v in S["seat"]], S["back_h"] * 0.001
    rake = float(S["rake"])
    up = _post_dir(rake)
    info = {"posts": [], "back": None}
    if st in ("dining", "ladderback"):
        ts = 0.022 if st == "dining" else 0.03
        Wb = W * 0.9
        P.top("seat", "trapezoid", W, D, ts, edge="eased", rc=0.025, at=(0, 0, sh - ts), back=0.9, kind="seat")
        lw = 0.038 if st == "dining" else 0.034
        fy, by = -D / 2 + 0.03, D / 2 - 0.03
        fx, bx = W / 2 - 0.03, Wb / 2 - 0.03
        zr = sh - ts                                        # the seat's underside
        for i, sx in enumerate((1, -1)):
            if st == "dining":
                P.board(f"leg_f{i}", zr, lw, lw, R=FU.UP, at=(sx * fx, fy, 0.0), r=0.003)
                _board_between(P, f"leg_b{i}", (sx * bx, by + 0.03, 0.0), (sx * bx, by, zr), lw, lw, twist=(1, 0, 0))
            else:
                _turned_between(P, f"leg_f{i}", (sx * fx, fy, 0.0), (sx * fx, fy, sh), [(0, 0.016), (0.95, 0.017), (1, 0.014)], smooth=False)
                _turned_between(P, f"leg_b{i}", (sx * bx, by + 0.025, 0.0), (sx * bx, by, sh), [(0, 0.017), (1, 0.017)], smooth=False)
            top = np.array([sx * bx, by, sh]) + up * (bh - sh)
            if st == "dining":
                _board_between(P, f"post{i}", (sx * bx, by, zr), top, lw, lw * 0.85, twist=(1, 0, 0))
            else:
                _turned_between(P, f"post{i}", (sx * bx, by, sh - 0.01), top, [(0, 0.017), (0.9, 0.016), (0.97, 0.018), (1, 0.008)])
            info["posts"].append((np.array([sx * bx, by]), lw / 2))
        # the seat's rails between the legs, and low stretchers
        for nm, a, b in (("rail_f", (-fx, fy, zr - 0.035), (fx, fy, zr - 0.035)), ("rail_b", (-bx, by, zr - 0.035), (bx, by, zr - 0.035)),
                         ("rail_l", (-fx, fy, zr - 0.035), (-bx, by, zr - 0.035)), ("rail_r", (fx, fy, zr - 0.035), (bx, by, zr - 0.035))):
            if st == "dining":
                _board_between(P, nm, a, b, 0.018, 0.06, r=0.002, kind="rail", twist=(0, 0, 1))
            else:
                _turned_between(P, nm, a, b, [(0, 0.011), (1, 0.011)], smooth=False)
        for k, z in enumerate((0.14, 0.26) if st == "ladderback" else (0.13,)):
            for nm, a, b in ((f"rung_l{k}", (-fx, fy, z), (-bx, by, z)), (f"rung_r{k}", (fx, fy, z), (bx, by, z))) + (((f"rung_f{k}", (-fx, fy, z + 0.03), (fx, fy, z + 0.03)),) if st == "ladderback" else ()):
                _turned_between(P, nm, a, b, [(0, 0.009), (0.5, 0.011), (1, 0.009)])
        # the back: between the posts, along the rake
        base_l, base_r = np.array([-bx, by, sh]), np.array([bx, by, sh])
        if st == "dining":
            for nm, t, hh in (("rail_top", bh - sh - 0.05, 0.07), ("rail_low", 0.2, 0.045)):
                _board_between(P, nm, base_l + up * t, base_r + up * t, 0.022, hh, r=0.004, kind="rail", twist=up)
            for k, x in enumerate((-0.1, 0.0, 0.1)):
                a, b = np.array([x * W / 0.44, by, sh]) + up * 0.2, np.array([x * W / 0.44, by, sh]) + up * (bh - sh - 0.05)
                _board_between(P, f"slat{k}", a, b, 0.045, 0.014, r=0.003, twist=(1, 0, 0))
            lo_t, hi_t = 0.06, bh - sh - 0.09                  # a back pad rests on the seat's and reaches the top rail
        else:
            ts_ = np.linspace(0.22, bh - sh - 0.06, 4)
            for k, t in enumerate(ts_):
                _board_between(P, f"slat{k}", base_l + up * t, base_r + up * t, 0.012, 0.055, r=0.003, kind="rail", twist=up)
            lo_t, hi_t = 0.12, bh - sh - 0.1
        info["seat"] = dict(shape="trapezoid", W=W, D=D, back=0.9, top=sh, post=lw)
        info["back"] = dict(y=by - 0.012, w=2 * bx - lw - 0.02, z0=lo_t, z1=hi_t, up=up)
    elif st == "spindle":
        ts = 0.042
        P.top("seat", "trapezoid", W, D, ts, edge="round", rc=0.11, at=(0, 0, sh - ts), back=0.94, kind="seat")
        zr = sh - ts
        splay = math.radians(9)
        for i, (sx, sy) in enumerate(((1, -1), (-1, -1), (1, 1), (-1, 1))):
            top = np.array([sx * (W / 2 - 0.07), sy * (D / 2 - 0.07), zr + 0.01])
            foot = top + np.array([sx * math.tan(splay) * zr, sy * math.tan(splay) * zr * 0.8, -zr - 0.01])
            _turned_between(P, f"leg{i}", foot, top, _leg_prof(0.019))
        for i, sx in enumerate((1, -1)):
            a = np.array([sx * (W / 2 - 0.07 + math.tan(splay) * zr * 0.6), -D / 2 + 0.07 - math.tan(splay) * zr * 0.4, 0.17])
            b = np.array([sx * (W / 2 - 0.07 + math.tan(splay) * zr * 0.6), D / 2 - 0.07 + math.tan(splay) * zr * 0.4, 0.17])
            _turned_between(P, f"stretch{i}", a, b, [(0, 0.011), (0.5, 0.014), (1, 0.011)])
        _turned_between(P, "stretch_m", (-(W / 2 - 0.05), 0.0, 0.17), ((W / 2 - 0.05), 0.0, 0.17), [(0, 0.011), (0.5, 0.014), (1, 0.011)])
        # the spindles from the seat's back to a bent crest
        ns = 7
        xs = np.linspace(-W * 0.36, W * 0.36, ns)
        ys = D / 2 - 0.05 - 0.035 * (1 - (xs / (W * 0.36)) ** 2)
        tops = []
        for k, (x, y) in enumerate(zip(xs, ys)):
            a = np.array([x * 0.92, y, sh - 0.005])
            b = np.array([x * 1.08, y, sh]) + up * (bh - sh - 0.03)
            _turned_between(P, f"spindle{k}", a, b, _spindle_prof(0.0085))
            tops.append(b + up * 0.005)
        crest = [tops[0] + np.array([-0.025, 0.0, -0.01])] + tops + [tops[-1] + np.array([0.025, 0.0, -0.01])]
        P.bent("crest", np.array(crest), 0.02, kind="rail")
        info["seat"] = dict(shape="trapezoid", W=W, D=D, back=0.94, top=sh, post=0.0, back_in=0.07)
        info["back"] = dict(y=float(ys.min()) - 0.012, w=W * 0.62, z0=0.08, z1=bh - sh - 0.08, up=up)
    elif st == "cafe":
        # a bentwood cafe stool (the user, 2026-11-04: the chair's back and its leg ring went): a round seat on a bent
        # ring, four bent legs inside the ring, each touching it and the seat's underside, thinning to feet splayed
        # out in a curve
        R = W / 2
        ts = 0.025
        P.top("seat", "round", W, W, ts, edge="round", at=(0, 0, sh - ts), kind="seat")
        Rr, tr = R * 0.86, 0.012                             # the ring's line and its tube
        zr = sh - ts - tr - 0.006                           # the ring's middle, its top under the seat
        P.bent("seat_ring", [[Rr * math.cos(a), Rr * math.sin(a), zr] for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)],
               tr, closed=True, kind="rail")
        rl = 0.016                                          # a leg's radius at the top (0.012 at the foot)
        r_top = Rr - tr - rl + 0.002                        # inside the ring, touching it
        flare = 0.055 + sh * 0.04
        for i in range(4):
            ang = math.pi / 4 + i * math.pi / 2
            c, s_ = math.cos(ang), math.sin(ang)
            path = [(r_top, sh - ts + 0.001), (r_top + 0.004, sh * 0.62), (r_top + flare * 0.45, sh * 0.22), (r_top + flare, 0.012)]
            P.bent(f"leg{i}", [[r * c, r * s_, z] for r, z in path], [rl, 0.012], kind="turned")
        info["seat"] = dict(shape="round", W=W, D=W, top=sh, post=0.0)
        info["back"] = None
    elif st == "school":
        P.top("seat", "rounded", W, D, 0.012, edge="round", rc=0.045, at=(0, 0, sh - 0.003), kind="seat")
        fx = W / 2 - 0.015
        fy, by = -D / 2 + 0.02, D / 2 - 0.02
        hb = bh - sh
        for i, sx in enumerate((1, -1)):
            x = sx * fx
            P.bent(f"frame{i}", [[x, fy, 0.0], [x, fy, sh - 0.025], [x, fy + 0.04, sh - 0.016], [x, by - 0.03, sh - 0.016], [x, by, sh - 0.01],
                                 [x, by + math.tan(math.radians(rake)) * hb * 0.5, sh + hb * 0.5], [x, by + math.tan(math.radians(rake)) * hb, sh + hb - 0.02]],
                   0.011, mat="frame", kind="rail")
            P.bent(f"legb{i}", [[x, by + 0.03, 0.0], [x, by + 0.012, sh * 0.5], [x, by, sh - 0.012]], 0.011, mat="frame", kind="rail")
        for nm, y, z in (("bar_f", fy, sh - 0.03), ("bar_b", by, sh - 0.03), ("bar_low", by + 0.02, 0.16)):
            P.bent(nm, [[-fx, y, z], [fx, y, z]], 0.009, mat="frame", kind="rail")
        bt = np.array([0.0, by + math.tan(math.radians(rake)) * hb * 0.82, sh + hb * 0.82])
        _board_between(P, "backrest", bt + np.array([-fx - 0.01, 0, 0]), bt + np.array([fx + 0.01, 0, 0]), 0.012, 0.17, r=0.005, kind="seat",
                       twist=_post_dir(rake))
        info["seat"] = dict(shape="rounded", W=W, D=D, top=sh + 0.009, post=0.0)
        info["back"] = dict(y=by + math.tan(math.radians(rake)) * hb * 0.82 - 0.008, w=W - 0.04, z0=hb * 0.82 - 0.08 - 0.0, z1=hb * 0.82 + 0.08, up=_post_dir(rake), at_top=True)
    elif st in ("stool", "bench"):
        if st == "stool":
            P.top("seat", "round", W, W, 0.035, edge="round", at=(0, 0, sh - 0.035), kind="seat")
            zr = sh - 0.035
            splay = math.radians(8)
            r0 = W / 2 - 0.06
            feet = []
            for i in range(4):
                ang = math.pi / 4 + i * math.pi / 2
                top = np.array([r0 * math.cos(ang), r0 * math.sin(ang), zr + 0.005])
                foot = top + np.array([math.cos(ang) * math.tan(splay) * zr, math.sin(ang) * math.tan(splay) * zr, -zr - 0.005])
                _turned_between(P, f"leg{i}", foot, top, [(0, 0.014), (1, 0.019)], smooth=False)
                feet.append((foot, top))
            for i in range(4):
                (f0, t0), (f1, t1) = feet[i], feet[(i + 1) % 4]
                a, b = f0 + (t0 - f0) * 0.3, f1 + (t1 - f1) * 0.3
                _turned_between(P, f"rail{i}", a, b, [(0, 0.009), (0.5, 0.011), (1, 0.009)])
            info["seat"] = dict(shape="round", W=W, D=W, top=sh, post=0.0)
        else:
            P.top("seat", "rect", W, D, 0.035, edge="eased", at=(0, 0, sh - 0.035), kind="seat")
            zr = sh - 0.035
            lw = 0.045
            cx, cy = W / 2 - 0.09, D / 2 - 0.035
            for i, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
                P.board(f"leg{i}", zr, lw, lw, R=FU.UP, at=(sx * cx, sy * (cy - lw / 2 + 0.001), 0.0), r=0.003)
            for j, sy in enumerate((1, -1)):
                P.board(f"apron_x{j}", 2 * cx - lw + 0.004, 0.02, 0.07, at=(-cx + lw / 2 - 0.002, sy * (cy - lw / 2), zr - 0.035), r=0.002, kind="rail")
            info["seat"] = dict(shape="rect", W=W, D=D, top=sh, post=0.0)
        info["back"] = None
    elif st == "zaisu":
        hb = bh
        P.board("base", W, D, sh, at=(-W / 2, 0.0, sh / 2), r=0.012, kind="seat")
        a = math.radians(rake)
        up = np.array([0.0, math.sin(a), math.cos(a)])
        b0 = np.array([0.0, D / 2 - 0.03, sh - 0.01])
        _board_between(P, "backrest", b0 + np.array([-W / 2 + 0.01, 0, 0]) + up * hb * 0.5, b0 + np.array([W / 2 - 0.01, 0, 0]) + up * hb * 0.5,
                       0.03, hb, r=0.01, kind="seat", twist=up)
        info["seat"] = dict(shape="rect", W=W, D=D - 0.06, top=sh, post=0.0, shift=-0.03)
        info["back"] = dict(y=D / 2 - 0.03 - 0.016, w=W - 0.06, z0=0.06, z1=hb - 0.05, up=up, base_z=sh - 0.01)
    else:
        raise ValueError(f"chair style {st!r}: one of {', '.join(DEFAULTS)}")
    return info


def _seat_outline(si):
    """The seat cushion's outline in the seat's plan: the seat's own shape a little in from its edge, its back in front
    of the back posts."""
    from .furniture import outline
    sh = si["shape"]
    W, D = si["W"], si["D"]
    if sh == "round":
        pts, _ = outline("round", W - 0.03, W - 0.03, 0.0, 0.0, True)
        return pts, (0.0, 0.0)
    back_in = si.get("back_in", si["post"] + 0.03)
    d = D - 0.015 - back_in
    shift = -(D / 2) + 0.015 + d / 2 + si.get("shift", 0.0)
    if sh == "trapezoid":
        frac = (d / 2 + shift + D / 2) / D                  # how far back the cushion's back edge sits along the seat
        wb = W * (1 - (1 - si.get("back", 1.0)) * frac)
        pts, _ = outline("trapezoid", W - 0.03, d, 0.035, 0.0, True, back=(wb - 0.03) / (W - 0.03))
    else:
        pts, _ = outline("rounded", W - 0.03, d, 0.035, 0.0, True)
    return pts, (0.0, shift)


def cushion_of(spec):
    """The recipe's cushions with the family's defaults under them, or None when it has none: `cushion` false, absent,
    or switched off (`"on": false`, its settings kept for when it's switched back on: the page's switch)."""
    cu = spec.get("cushion")
    cu = dict(FIELDS["cushion"], **cu) if isinstance(cu, dict) else (dict(FIELDS["cushion"]) if cu is True else None)
    return cu if cu is not None and cu.get("on", True) else None


def make(spec, th):
    seed = int(spec.get("seed", 0))
    style = spec.get("style", "dining")
    if style not in DEFAULTS:
        raise ValueError(f"chair style {style!r}: one of {', '.join(DEFAULTS)}")
    S = dict(DEFAULTS[style], style=style)
    S.update({k: v for k, v in spec.items() if k in FIELDS})
    flaws = dict({"grain": 0.5, "cracks": 0.15, "scratches": 0.3, "dents": 0.2}, **(spec.get("flaws") or {}))
    th.material("wood", "wood", color=S.get("paint_color", "#d8d4cc") if S.get("painted") else S.get("wood", "#7a4e2d"),
                rough=FU.FINISH.get(S.get("finish", "oil"), 0.55))
    if style == "school":
        th.material("frame", "metal", color=S.get("frame_color", "#8a8f96"), rough=0.32, metal=0.85)
    cu = cushion_of(spec)
    if cu is not None:
        th.material("fabric", "fabric", color=cu.get("color", "#7a5c4a"), rough=float(cu.get("rough", 0.9)))
    P = FU.Plan(th, "wood")
    info = _build(S, P, spec)
    kinds = P.islands()
    cush = []
    if cu is not None and info.get("seat") and cu.get("seat", True):
        pts, sh_ = _seat_outline(info["seat"])
        w_, d_ = np.ptp(pts[:, 0]), np.ptp(pts[:, 1])
        th.island("cushion_seat_top", w_ * 1000, d_ * 1000, mat="fabric")
        th.island("cushion_seat_bot", w_ * 1000 / 2, d_ * 1000 / 2, mat="fabric")   # its underside: seldom seen
        cush.append(("seat", pts, sh_))
    if cu is not None and info.get("back") and cu.get("back", False):
        b = info["back"]
        hgt = b["z1"] - b["z0"]
        from .furniture import outline
        pts, _ = outline("rounded", b["w"], hgt, 0.03, 0.0, True)
        th.island("cushion_back_top", b["w"] * 1000, hgt * 1000, mat="fabric")
        th.island("cushion_back_bot", b["w"] * 500, hgt * 500, mat="fabric")
        cush.append(("back", pts, None))
    ties = []
    if cu is not None and cu.get("ties", True) and info.get("posts") and any(c[0] == "seat" for c in cush):
        for k in range(len(info["posts"])):
            th.island(f"tie{k}", 160, 30, mat="fabric")
            ties.append(k)
    th.pack()
    isl = th.islands
    lows, highs = [P.build(False, isl)], [P.build(True, isl)]
    thick = float(cu.get("thick", 45)) * 0.001 if cu else 0.0
    seat_top = None
    for kind, pts, sh_ in cush:
        if kind == "seat":
            lo, hi, top = CU.make(pts, thick, seed + 1, isl["cushion_seat_top"], isl["cushion_seat_bot"], fill=float(cu.get("fill", 0.75)))
            off = np.array([sh_[0], sh_[1], info["seat"]["top"] - 0.002])
            lo.v += off
            hi.v += off
            seat_top = info["seat"]["top"] + top
        else:
            b = info["back"]
            lo, hi, _ = CU.make(pts, thick * 0.8, seed + 2, isl["cushion_back_top"], isl["cushion_back_bot"], fill=float(cu.get("fill", 0.75)) * 0.9)
            # stood against the back: its bottom (z = 0, the side that lay on the floor) to the back's front face
            upv = b["up"]
            nrm = np.cross(upv, [1.0, 0.0, 0.0])            # the back's face toward the sitter: -y-ish
            if nrm[1] > 0:
                nrm = -nrm
            Rm = np.stack([np.array([1.0, 0.0, 0.0]), upv, nrm], 1)     # its thickness toward the sitter
            mid = (b["z0"] + b["z1"]) / 2
            base = np.array([0.0, b["y"], b.get("base_z", info["seat"]["top"] if info.get("seat") else 0.0)]) + upv * mid
            for m in (lo, hi):
                m.v = m.v @ Rm.T + base
        lo.a["rest"] = lo.v.copy()
        hi.a["rest"] = hi.v.copy()
        lows.append(lo)
        highs.append(hi)
    for k in ties:
        (cxy, half) = info["posts"][k]
        z = (seat_top if seat_top is not None else info["seat"]["top"] + 0.02) - 0.012
        m = CU.tie(cxy, half, z, 1.0 if cxy[0] > 0 else -1.0, isl[f"tie{k}"])
        lows.append(m)
        highs.append(m)
    th.low = M.join(lows)
    th.high = M.join(highs)
    th.weighted = 35
    th.pose = "stand"
    th.view = {"azim": -32, "elev": 20}
    th.reach = 0.01
    th.cage = 0.004
    d = {"wood": S.get("wood", "#7a4e2d"), "ring": S.get("ring", 5.0), "finish": S.get("finish", "oil"), "flaws": flaws,
         "painted": S.get("painted", False), "paint_color": S.get("paint_color", "#d8d4cc")}

    def paint(fr):
        for i, (nm, kd) in enumerate(kinds.items()):
            f = fr[nm]
            if th.islands[nm].mat == "frame":
                f.fill(color=S.get("frame_color", "#8a8f96"), rough=0.32, metal=0.85)
                continue
            FU.paint_wood(f, kd, d, np.random.default_rng(seed * 7 + i), seed * 13 + i)
        if cu is not None:
            cov = {k: cu[k] for k in ("color", "pattern", "ink", "size", "rough") if k in cu}
            for nm in [n for n in th.islands if n.startswith("cushion_")]:
                f = fr[nm]
                paint_cover(f, cov if nm.endswith("_top") else {"color": cov.get("color", "#7a5c4a"), "rough": cov.get("rough", 0.9)},
                            seed + len(nm), None, (f.W, f.H), weave=0.6)
            for k in ties:
                fr[f"tie{k}"].fill(color=cu.get("tie_color", cu.get("color", "#7a5c4a")), rough=0.9)

    th.paint = paint
    return th
