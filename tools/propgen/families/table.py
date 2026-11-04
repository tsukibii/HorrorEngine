"""Wooden tables (the user, 2026-11-04: "a prop gen for tables ... take a length/width/height input"; the research:
docs/research/tables_chairs.md). `size` [length, width, height] mm and a `style`, each style a base and its numbers,
every one of them a setting of its own:

- `dining` (square legs, an apron), `shaker` (legs tapered on their inside faces, a thin top), `farmhouse` (a thick
  top of planks on turned legs, worn), `parsons` (legs as thick as the apron is deep, flush with the top), `midcentury`
  (a rounded top with a bevel underneath on splayed round legs, no apron), `trestle` (two end frames and a stretcher),
  `pedestal` (a turned column on four feet), `chabudai` (a low round Japanese table on a frame and short legs);
- the top: `top` "rect" | "rounded" | "round" | "oval" (`corner` mm for a rounded one), `edge` "eased" | "square" |
  "chamfer" | "round" | "bullnose" | "underbevel", `thick` (mm), `overhang` (mm past the legs), `boards` (planks in
  the top: their joins);
- the legs: `leg` "square" | "taper" | "turned" | "round", `leg_w` (mm), `taper` (the foot's share of the leg's
  width), `splay` (degrees out); `apron` (mm deep, 0 for none); `stretcher` "none" | "h" | "box";
- the wood: `wood` (its colour, under a PBR set of your own laid over the material `wood`), `ring` (mm between its
  growth rings, 5), `finish` "raw" | "oil" | "satin" | "gloss", `flaws` {grain, cracks, scratches, dents: 0 to 1} as
  relief and roughness, `painted` (a painted table: `paint_color`) and `wear` as any prop's.

Every part is a plank unwrapped along its grain (families/furniture.py): lay a wood set over it with the recipe's
`pbr` {"wood": "pbr/Wood/<set>"} and its flaws stay in the relief under it.

    {"family": "table", "size": [1600, 900, 740], "style": "dining", "wood": "#8a5a36"}
    {"family": "table", "size": [800, 800, 320], "style": "chabudai", "wood": "#6b4428", "finish": "satin"}
"""
import math

import numpy as np

from . import furniture as FU

# the page's settings (PROPGEN §13: a family's own settings, picked from a list), their choices and a list's labels
FIELDS = {"size": [1600, 900, 740], "style": "dining", "top": "rect", "corner": 60, "edge": "eased", "thick": 30, "overhang": 40,
          "boards": 1, "leg": "square", "leg_w": 70, "taper": 0.6, "splay": 0, "apron": 90, "stretcher": "none", "wood": "#8a5a36",
          "ring": 5.0, "finish": "oil", "flaws": {"grain": 0.5, "cracks": 0.2, "scratches": 0.3, "dents": 0.2}, "painted": False,
          "paint_color": "#d8d4cc"}
CHOICES = {"style": ["dining", "shaker", "farmhouse", "parsons", "midcentury", "trestle", "pedestal", "chabudai"],
           "top": ["rect", "rounded", "round", "oval"], "edge": ["eased", "square", "chamfer", "round", "bullnose", "underbevel"],
           "leg": ["square", "taper", "turned", "round"], "stretcher": ["none", "h", "box"], "finish": ["raw", "oil", "satin", "gloss"]}
LABELS = {"size": ["length", "width", "height"]}

STYLES = {
    "dining": dict(base="legs", top="rect", edge="eased", thick=30, overhang=40, leg="square", leg_w=70, apron=90),
    "shaker": dict(base="legs", top="rect", edge="eased", thick=22, overhang=45, leg="taper", leg_w=50, taper=0.62, apron=100),
    "farmhouse": dict(base="legs", top="rect", edge="eased", thick=45, overhang=60, leg="turned", leg_w=90, apron=110, boards=5,
                      flaws={"grain": 0.8, "cracks": 0.6, "scratches": 0.6, "dents": 0.5}),
    "parsons": dict(base="legs", top="rect", edge="square", thick=45, overhang=0, leg="square", leg_w=70, apron=70, flush=True),
    "midcentury": dict(base="legs", top="rounded", corner=90, edge="underbevel", thick=25, overhang=110, leg="round", leg_w=46,
                       taper=0.55, splay=8, apron=0),
    "trestle": dict(base="trestle", top="rect", edge="eased", thick=40, overhang=220),
    "pedestal": dict(base="pedestal", top="round", edge="round", thick=30),
    "chabudai": dict(base="legs", top="round", edge="round", thick=25, overhang=110, leg="square", leg_w=36, apron=40),
}


def _turned_leg(L, lw):
    """A turned leg's profile below its square block, foot (x = 0) to the block (x = L): (x, radius) metres."""
    t = np.array([0.0, 0.03, 0.06, 0.1, 0.16, 0.3, 0.48, 0.62, 0.74, 0.8, 0.86, 0.93, 0.97, 1.0])
    r = np.array([0.4, 0.43, 0.36, 0.4, 0.33, 0.37, 0.45, 0.43, 0.34, 0.38, 0.31, 0.35, 0.48, 0.48]) * lw
    return [(float(a * L), float(b)) for a, b in zip(t, r)]


def make(spec, th):
    seed = int(spec.get("seed", 0))
    r = np.random.default_rng(seed * 104729 + 7)
    style = spec.get("style", "dining")
    if style not in STYLES:
        raise ValueError(f"table style {style!r}: one of {', '.join(STYLES)}")
    S = dict(STYLES[style])
    S.update({k: v for k, v in spec.items() if k in FIELDS or k in ("flush", "base")})
    L, W, H = [float(v) * 0.001 for v in spec.get("size", (1600, 900, 740))]
    if S["top"] in ("round",):
        W = L
    t = float(S["thick"]) * 0.001
    ov = float(S.get("overhang", 40)) * 0.001
    lw = float(S.get("leg_w", 70)) * 0.001
    ap = float(S.get("apron", 0)) * 0.001
    zu = H - t                                            # the top's underside
    flaws = dict({"grain": 0.5, "cracks": 0.2, "scratches": 0.3, "dents": 0.2}, **(S.get("flaws") or {}))
    th.material("wood", "wood", color=S.get("paint_color", "#d8d4cc") if S.get("painted") else S.get("wood", "#8a5a36"),
                rough=FU.FINISH.get(S.get("finish", "oil"), 0.55))
    P = FU.Plan(th, "wood")
    P.top("top", S["top"], L, W, t, edge=S.get("edge", "eased"), rc=float(S.get("corner", 60)) * 0.001, at=(0, 0, zu))
    base = S.get("base", "legs")
    if base == "legs":
        if S["top"] in ("round", "oval"):
            cx = (L / 2 - ov) * math.cos(math.pi / 4) - lw / 2
            cy = (W / 2 - ov) * math.sin(math.pi / 4) - lw / 2
        else:
            cx, cy = L / 2 - ov - lw / 2, W / 2 - ov - lw / 2
        kind = S.get("leg", "square")
        splay = math.radians(float(S.get("splay", 0)))
        for i, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
            px, py = sx * cx, sy * cy
            nm = f"leg{i}"
            if kind in ("square", "taper"):
                tp = float(S.get("taper", 0.6)) if kind == "taper" else 1.0
                P.board(nm, zu, lw, lw, R=FU.UP, at=(px, py, 0.0), r=0.003, taper=(tp, 1.0),
                        anchor=(sy * lw / 2, -sx * lw / 2))
            elif kind == "turned":
                blk = ap + 0.03 if ap > 0 else 0.12
                P.board(nm + "_blk", blk, lw, lw, R=FU.UP, at=(px, py, zu - blk), r=0.003)
                P.turned(nm, _turned_leg(zu - blk, lw), R=FU.UP, at=(px, py, 0.0))
            else:                                         # round, tapered, splayed out along its diagonal
                Ll = zu / max(math.cos(splay), 0.5)
                tp = float(S.get("taper", 0.55))
                prof = [(0.0, lw / 2 * tp), (Ll * 0.97, lw / 2), (Ll, lw / 2)]
                d = np.array([sx, sy, 0.0]) / math.sqrt(2)
                axis = np.cross(d, [0, 0, 1.0])
                R = _axis_rot(axis, -splay) @ FU.UP
                topp = np.array([px, py, zu])
                at = topp - R @ np.array([Ll, 0.0, 0.0])
                P.turned(nm, prof, R=R, at=tuple(at), smooth=False)
        if ap > 0:
            sb = 0.0 if S.get("flush") else 0.008
            at_ = 0.022 if not S.get("flush") else lw * 0.4
            lx = 2 * (cx - lw / 2) + 0.004
            ly = 2 * (cy - lw / 2) + 0.004
            for j, sy in enumerate((1, -1)):
                y = sy * (cy + lw / 2 - sb - at_ / 2)
                P.board(f"apron_x{j}", lx, at_, ap, at=(-lx / 2, y, zu - ap / 2), r=0.002, kind="rail")
            for j, sx in enumerate((1, -1)):
                x = sx * (cx + lw / 2 - sb - at_ / 2)
                P.board(f"apron_y{j}", ly, at_, ap, R=FU.rot(("z", 90)), at=(x, -ly / 2, zu - ap / 2), r=0.002, kind="rail")
        st = S.get("stretcher", "none")
        if st in ("h", "box"):
            zs = max(0.08, H * 0.17)
            sw, sh = 0.026, 0.045
            ly = 2 * (cy - lw / 2) + 0.004
            lx = 2 * (cx - lw / 2) + 0.004
            for j, sx in enumerate((1, -1)):
                P.board(f"str_y{j}", ly, sw, sh, R=FU.rot(("z", 90)), at=(sx * cx, -ly / 2, zs), r=0.002, kind="rail")
            if st == "h":
                P.board("str_x", 2 * cx, sw, sh, at=(-cx, 0.0, zs + 0.06), r=0.002, kind="rail")
            else:
                for j, sy in enumerate((1, -1)):
                    P.board(f"str_x{j}", lx, sw, sh, at=(-lx / 2, sy * cy, zs), r=0.002, kind="rail")
    elif base == "trestle":
        xe = L / 2 - ov
        fw, fh = 0.075, 0.065
        lf = W * 0.78
        pw, pt = min(0.18, W * 0.22), 0.055
        ch = 0.05
        for j, sx in enumerate((1, -1)):
            x = sx * xe
            P.board(f"foot{j}", lf, fw, fh, R=FU.rot(("z", 90)), at=(x, -lf / 2, fh / 2), r=0.006)
            P.board(f"post{j}", zu - fh - ch + 0.004, pw, pt, R=FU.rot(("z", 90)) @ FU.UP, at=(x, 0.0, fh - 0.002), r=0.004)
            P.board(f"cleat{j}", W * 0.72, fw, ch, R=FU.rot(("z", 90)), at=(x, -W * 0.36, zu - ch / 2), r=0.004, kind="rail")
        P.board("stretcher", 2 * xe, 0.045, 0.1, at=(-xe, 0.0, H * 0.38), r=0.004, kind="rail")
    elif base == "pedestal":
        D = min(L, W)
        zc0, zc1 = 0.06, zu - 0.03
        Lc = zc1 - zc0
        rc = max(0.045, D * 0.06)
        prof = [(0.0, rc * 1.3), (0.06 * Lc, rc * 1.1), (0.12 * Lc, rc * 0.85), (0.35 * Lc, rc * 1.15), (0.55 * Lc, rc * 0.8),
                (0.82 * Lc, rc * 0.7), (0.9 * Lc, rc * 0.95), (Lc, rc * 1.05)]
        P.turned("column", prof, R=FU.UP, at=(0.0, 0.0, zc0))
        lf = D * 0.36
        for k in range(4):
            a = 45 + 90 * k
            P.board(f"foot{k}", lf, 0.06, 0.08, R=FU.rot(("z", a)), at=(0.0, 0.0, 0.04), r=0.008, taper=(1.0, 0.45), anchor=(0.0, -0.04))
        P.board("cross0", D * 0.55, 0.05, 0.03, at=(-D * 0.275, 0.0, zu - 0.015), r=0.003, kind="rail")
        P.board("cross1", D * 0.55, 0.05, 0.03, R=FU.rot(("z", 90)), at=(0.0, -D * 0.275, zu - 0.015), r=0.003, kind="rail")
    else:
        raise ValueError(f"table base {base!r}")
    kinds = P.islands()
    th.pack()
    isl = th.islands
    th.low = P.build(False, isl)
    th.high = P.build(True, isl)
    th.weighted = 35                                     # the game mesh's normals by face size (its chamfers smooth)
    th.pose = "stand"
    th.view = {"azim": -35, "elev": 24}
    th.reach = 0.008
    th.cage = 0.004
    boards = int(S.get("boards", 1))
    d = {"wood": S.get("wood", "#8a5a36"), "ring": S.get("ring", 5.0), "finish": S.get("finish", "oil"), "flaws": flaws,
         "painted": S.get("painted", False), "paint_color": S.get("paint_color", "#d8d4cc")}

    def paint(fr):
        for i, (nm, kd) in enumerate(kinds.items()):
            f = fr[nm]
            FU.paint_wood(f, kd, d, np.random.default_rng(seed * 7 + i), seed * 13 + i)
            if nm == "top_top" and boards > 1:                # the top's planks: their joins, a dark hairline groove
                X, Y = f.grid()
                for k in range(1, boards):
                    y = f.H * k / boards + r.normal(0, 1.5)
                    m = np.clip(1 - np.abs(Y - y) / 0.9, 0, 1).astype(np.float32)
                    f.lay_island(m, color="#1d140d", height=(-0.5 * m).astype(np.float32), add_height=True, rough=0.9)

    th.paint = paint
    return th


def _axis_rot(axis, ang):
    """A rotation by ang (radians) round a unit axis (Rodrigues)."""
    a = np.asarray(axis, float)
    a = a / max(np.linalg.norm(a), 1e-12)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * (K @ K)
