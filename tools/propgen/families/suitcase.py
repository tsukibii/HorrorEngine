"""Suitcases that open (DECISIONS 2026-11-05, later; PROPGEN §26): a base tray and a lid hinged along its back edge,
lying on the floor the way a case is opened. The lid is a **part** (`th.part`): it leaves the glb as a node of its own
on its hinge, built open at `open` degrees, and the runtime swings it shut and open again (the story's `container`
use holds what the player puts in it: the inside box is in the glb's `propgen_inside`). Three kinds from one sweep:

- `hardshell`: a polycarbonate spinner (two halves as deep as each other, a zip round the middle, four wheels at the
  foot, a handle on the head end and one on the front, a brand plate on the lid, the ribs' relief).
- `softside`: a fabric two-wheeler (a deep base, a shallow lid with a zipped front pocket, piping, webbing handles).
- `vintage`: a leather-over-board case (metal corners, two latches on the front, a stitched handle, straight sides).

Inside: a lining with a pattern, two elastic straps crossing the base with a buckle, a zipped pocket panel in the lid.

    {"family": "suitcase", "kind": "hardshell" | "softside" | "vintage", "size": [w, d, h] (mm, closed; w the long side,
     d front to back, h closed height), "open": 100 (degrees the lid is built at and opens to), "color": "#2a5f68",
     "lining": {"color": "#d9d2c3", "pattern": "dots" | "stripes" | "check" | "plain", "size": 40, "ink": "#..."},
     "metal": "steel" | "brass" | "chrome" | "#hex", "finish": "satin" | "brushed", "wheels": true, "brand": "KAWANO",
     "straps": true, "pocket": true, "seed": 1}
"""
import math

import numpy as np

from .. import finish as FN
from .. import mesh as M
from .. import noise as N
from .bedding import paint_cover

CUSTOM = True       # its brand plate is a picture of its own (the picture editor previews yours on it: PROPGEN §25)

MM = 0.001
FIELDS = {"kind": "hardshell", "size": [550, 400, 230], "open": 100, "color": "#2a5f68", "lining": {"color": "#d9d2c3", "pattern": "dots", "size": 40, "ink": "#b9ad99"},
          "metal": "steel", "finish": "satin", "wheels": True, "brand": "KAWANO", "straps": True, "pocket": True}
CHOICES = {"kind": ["hardshell", "softside", "vintage"], "metal": ["steel", "brass", "chrome", "iron"], "finish": ["satin", "brushed", "polished"]}
LABELS = {"size": ["width", "depth", "height"]}

KINDS = {                       # size (mm), the lid's share of the height, the shell's edge radius, wall thickness, the rim's gap
    "hardshell": dict(size=(550, 400, 230), lid=0.5, edge=24.0, t=3.0, gap=3.0, corner=60.0, color="#2a5f68", rough=0.34, kind="plastic"),
    "softside": dict(size=(600, 420, 250), lid=0.22, edge=12.0, t=6.0, gap=2.0, corner=40.0, color="#262a30", rough=0.9, kind="fabric"),
    "vintage": dict(size=(600, 400, 160), lid=0.33, edge=7.0, t=5.0, gap=1.5, corner=14.0, color="#8a5a34", rough=0.5, kind="paint"),
}
BRANDS = ["KAWANO", "Aoyama", "TRAVELER", "Hoshino", "MARUI", "Nagase"]


def tray(outline, depth, t, edge_r, names, I, lip=0.004, upside=False, bulge=0.0):
    """A shell tray swept round `outline` (metres, anticlockwise, the rim's outer edge): the outside from the bottom's
    rounded edge up the wall to the rim, the rim's flat lip (t + lip wide), and the inside down to its floor. `names`:
    the islands for its side band, bottom cap, rim band, inner wall band and inner floor cap. `upside`: it will be
    turned over (a lid), so its bottom reads from above. `bulge`: the wall bowed out at mid height (a soft case)."""
    out = [(-edge_r, 0.0)]
    for k in range(1, 5):
        a = math.radians(90 * k / 4)
        out.append((-edge_r + edge_r * math.sin(a), edge_r - edge_r * math.cos(a)))
    if bulge > 0:
        out.append((bulge, edge_r + (depth - edge_r) * 0.5))
    out.append((0.0, depth))
    rim = [(0.0, depth), (-t - lip, depth)]
    ri = max(edge_r - t - lip, 0.002)
    inn = [(-t - lip, depth), (-t - lip, edge_r)]
    for k in range(1, 5):
        a = math.radians(90 * k / 4)
        inn.append((-edge_r + ri * math.cos(a), edge_r - ri * math.sin(a)))
    # the profile's own points only (no resampling: the arcs are drawn with four steps, the walls are straight)
    segs = [M.Seg(np.array(out), names["side"], "band", mat="shell", cap="down", cap_at="start", cap_island=names["bottom"],
                  cap_mirror=not upside),
            M.Seg(np.array(rim), names["rim"], "band", mat="shell"),
            M.Seg(np.array(inn), names["in_wall"], "band", mat="lining", cap="up", cap_at="end", cap_island=names["in_floor"])]
    return M.loft(outline, segs, I, ["shell", "lining"])


def wheel(c, r, width, I, axis="x"):
    """A wheel: a capped cylinder of radius r, `width` along its axle, centred at c, its axle along x (it rolls along y)."""
    if axis == "x":
        path = np.array([[c[0] - width / 2, c[1], c[2]], [c[0] + width / 2, c[1], c[2]]])
    else:
        path = np.array([[c[0], c[1] - width / 2, c[2]], [c[0], c[1] + width / 2, c[2]]])
    return M.tube(path, r, I["wheel"], n=14, mat="rubber", caps=(True, True), cap_bulge=0.08)


def handle(pts, r, I, mat="rubber", n=10):
    """A grab handle: a round tube along a smoothed path (points in metres, the first and the last on the shell)."""
    path = M.spline(np.asarray(pts, float), 0.011)
    return M.tube(path, r, I["handle"], n=n, mat=mat, caps=(True, True), cap_bulge=0.2)


def strap(w, L, thick, at, yaw, I, isl="strap", mat="lining"):
    """A flat strap L long, w wide, lying at `at` (its middle, metres) turned `yaw` degrees."""
    m = M.box((L, w, thick), at=(0, 0, 0), island=isl, islands=I, mat=mat)
    return M.turn(m, M.rot("z", yaw), move=at)


def make(spec, th):
    kind = spec.get("kind", "hardshell")
    if kind not in KINDS:
        raise ValueError(f"suitcase kind {kind!r}: one of {', '.join(KINDS)}")
    K = KINDS[kind]
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "suitcase", kind)
    w, d, h = [float(v) * MM for v in (spec.get("size") or K["size"])]
    t, lip, gap = float(spec.get("thick", K["t"])) * MM, 0.004, K["gap"] * MM
    edge = float(spec.get("edge", K["edge"])) * MM
    corner = float(spec.get("corner", K["corner"])) * MM
    hl = (h - gap) * float(spec.get("lid_share", K["lid"]))
    hb = h - gap - hl
    open_deg = float(spec.get("open", 100.0))
    wheels = bool(spec.get("wheels", True))
    color = spec.get("color", K["color"])
    lining = dict({"color": "#d9d2c3", "pattern": "dots", "size": 40, "ink": "#b9ad99"}, **(spec.get("lining") or {}))
    metal_name = spec.get("metal", "brass" if kind == "vintage" else "steel")
    # materials and islands
    th.material("shell", K["kind"], color=color, rough=K["rough"])
    th.material("lining", "fabric", color=lining["color"], rough=0.9)
    th.material("metal", "metal", color="#9a9a9a", rough=0.3, metal=1.0)
    th.material("rubber", "plastic", color="#1b1b1b", rough=0.85)
    from ..paint import rrect_poly
    outline = M.resample_loop(rrect_poly(-w / 2, -d / 2, w, d, corner, n=5), 0.022)
    per = float(np.linalg.norm(np.diff(np.concatenate([outline, outline[:1]]), axis=0), axis=1).sum())
    side_len = edge * math.pi / 2 + max(hb - edge, 0.0)
    lid_len = edge * math.pi / 2 + max(hl - edge, 0.0)
    th.island("base_bottom", w * 1000, d * 1000, mat="shell")
    th.island("base_side", per * 1000, side_len * 1000 + 4, mat="shell")
    th.island("base_rim", per * 1000, (t + lip) * 1000 + 2, mat="shell")
    th.island("lid_top", w * 1000, d * 1000, mat="shell")
    th.island("lid_side", per * 1000, lid_len * 1000 + 4, mat="shell")
    th.island("lid_rim", per * 1000, (t + lip) * 1000 + 2, mat="shell")
    th.island("in_base_floor", w * 1000, d * 1000, mat="lining")
    th.island("in_base_wall", per * 1000, hb * 1000, mat="lining")
    th.island("in_lid_floor", w * 1000 * 0.7, d * 1000 * 0.7, mat="lining")
    th.island("in_lid_wall", per * 1000, max(hl, 0.01) * 1000, mat="lining")
    th.island("pocket", w * 1000 * 0.7, d * 1000 * 0.6, mat="lining")
    th.island("strap", 120, 30, mat="lining")
    th.island("hw", 60, 60, mat="metal")
    th.island("wheel", 80, 40, mat="rubber")
    th.island("handle", 90, 40, mat="rubber")
    th.island("webbing", 120, 30, mat="lining")
    th.pack()
    I = th.islands
    base_names = dict(side="base_side", bottom="base_bottom", rim="base_rim", in_wall="in_base_wall", in_floor="in_base_floor")
    lid_names = dict(side="lid_side", bottom="lid_top", rim="lid_rim", in_wall="in_lid_wall", in_floor="in_lid_floor")
    bulge = 0.012 if kind == "softside" else 0.0
    base = [tray(outline, hb, t, edge, base_names, I, lip=lip, bulge=bulge)]
    lid = [tray(outline, hl, t, edge, lid_names, I, lip=lip, upside=True, bulge=bulge * 0.4)]
    floor_z = t + lip                                 # the trays' inner floors (before the lid is turned over)
    # the inside: straps across the base, a pocket panel in the lid
    if spec.get("straps", True):
        L = math.hypot(w, d) * 0.72
        for ang in (math.degrees(math.atan2(d, w)), -math.degrees(math.atan2(d, w))):
            base.append(strap(0.025, L, 0.0015, (0, 0, floor_z + 0.0012), ang, I))
        base.append(M.rbox((0.034, 0.04, 0.006), 0.0015, I, top="hw", bottom="hw", edge="hw", at=(0, 0, floor_z + 0.002), mat="rubber"))
    if spec.get("pocket", True):
        pw, pd = (w - 2 * (t + lip + edge)) * 0.92, (d - 2 * (t + lip + edge)) * 0.92
        lid.append(M.rbox((pw, pd, 0.003), 0.001, I, top="pocket", bottom="pocket", edge="pocket", at=(0, 0, floor_z + 0.001), mat="lining"))
    # the lid turned over onto the base: its flange on the base's, its bottom now its top
    lid_m = M.join(lid, ["shell", "lining", "metal", "rubber"])
    lid_m.v[:, 2] = -lid_m.v[:, 2] + (hb + hl + gap)
    M.flip(lid_m)
    lid_m.a["rest"] = lid_m.v.copy()
    lid = [lid_m]
    top_z = hb + hl + gap
    foot = -w / 2                                     # the foot end (wheels) at -x, the head end (the top handle) at +x
    if kind == "hardshell":
        if wheels:                                    # four spinner wheels at the foot end: two under the base, two on the lid's top
            for y in (-d / 2 + 0.05, d / 2 - 0.05):
                base.append(wheel((foot + 0.045, y, -0.03), 0.026, 0.02, I))
                base.append(M.rbox((0.044, 0.036, 0.032), 0.006, I, top="hw", bottom="hw", edge="hw", at=(foot + 0.045, y, -0.031), mat="rubber"))
                lid.append(wheel((foot + 0.045, y, top_z + 0.03), 0.026, 0.02, I))
                lid.append(M.rbox((0.044, 0.036, 0.032), 0.006, I, top="hw", bottom="hw", edge="hw", at=(foot + 0.045, y, top_z - 0.001), mat="rubber"))
            for y in (-d / 2 + 0.05, d / 2 - 0.05):   # the head end's bumpers under the base, so it lies level
                base.append(M.rbox((0.04, 0.034, 0.056), 0.008, I, top="hw", bottom="hw", edge="hw", at=(w / 2 - 0.045, y, -0.056), mat="rubber"))
        zb = hb * 0.5
        base.append(handle([(w / 2 - 0.002, -0.055, zb), (w / 2 + 0.026, -0.05, zb), (w / 2 + 0.03, 0.0, zb), (w / 2 + 0.026, 0.05, zb), (w / 2 - 0.002, 0.055, zb)], 0.0085, I))
        base.append(handle([(0.08, -d / 2 + 0.002, zb), (0.075, -d / 2 - 0.024, zb), (0.0, -d / 2 - 0.028, zb), (-0.075, -d / 2 - 0.024, zb), (-0.08, -d / 2 + 0.002, zb)], 0.0085, I))
        for x in (-0.028, 0.028):                     # the zip's pulls on the front rim
            base.append(M.rbox((0.011, 0.004, 0.028), 0.0012, I, top="hw", bottom="hw", edge="hw", at=(x, -d / 2 - 0.0035, hb - 0.03), mat="metal"))
        base.append(M.rbox((0.03, 0.006, 0.02), 0.002, I, top="hw", bottom="hw", edge="hw", at=(w / 2 - 0.09, -d / 2 - 0.004, hb - 0.024), mat="metal"))   # the lock
    elif kind == "softside":
        if wheels:                                    # two wheels at the foot end under the base's back edge, two studs at the head
            for y in (d / 2 - 0.045,):
                for x in (foot + 0.04, foot + 0.04):
                    pass
            base.append(wheel((foot + 0.04, d / 2 - 0.045, -0.026), 0.024, 0.022, I))
            base.append(wheel((foot + 0.04, -d / 2 + 0.045, -0.026), 0.024, 0.022, I))
            for y in (-d / 2 + 0.045, d / 2 - 0.045):
                base.append(M.rbox((0.05, 0.032, 0.03), 0.006, I, top="hw", bottom="hw", edge="hw", at=(foot + 0.04, y, -0.03), mat="rubber"))
                base.append(M.rbox((0.03, 0.03, 0.05), 0.01, I, top="hw", bottom="hw", edge="hw", at=(w / 2 - 0.05, y, -0.05), mat="rubber"))
        zb = hb * 0.55                                # webbing handles: a flat loop standing off the shell
        for pts in ([(w / 2 - 0.002, -0.06, zb), (w / 2 + 0.022, -0.055, zb), (w / 2 + 0.026, 0.0, zb), (w / 2 + 0.022, 0.055, zb), (w / 2 - 0.002, 0.06, zb)],
                    [(0.09, -d / 2 + 0.002, zb), (0.085, -d / 2 - 0.022, zb), (0.0, -d / 2 - 0.026, zb), (-0.085, -d / 2 - 0.022, zb), (-0.09, -d / 2 + 0.002, zb)]):
            base.append(handle(pts, 0.009, I, mat="lining", n=8))
        # the lid's front pocket: a soft panel on its top with a zip across its head
        pw, pd = w * 0.78, d * 0.56
        lid.append(M.rbox((pw, pd, 0.014), 0.006, I, top="pocket", bottom="lid_top", edge="pocket", at=(0.0, -0.02, top_z - 0.002), mat="shell"))
        for x in (-0.02, 0.02):
            base.append(M.rbox((0.011, 0.004, 0.026), 0.0012, I, top="hw", bottom="hw", edge="hw", at=(x, -d / 2 - 0.004, hb - 0.028), mat="metal"))
    else:                                             # vintage: corner caps, two latches, a stitched handle on the front
        cz = 0.03
        for sx in (-1, 1):
            for sy in (-1, 1):
                base.append(M.rbox((cz, cz, cz), 0.005, I, top="hw", bottom="hw", edge="hw", at=(sx * (w / 2 - cz / 2 + 0.003), sy * (d / 2 - cz / 2 + 0.003), -0.003), mat="metal"))
                lid.append(M.rbox((cz, cz, cz), 0.005, I, top="hw", bottom="hw", edge="hw", at=(sx * (w / 2 - cz / 2 + 0.003), sy * (d / 2 - cz / 2 + 0.003), top_z - cz + 0.003), mat="metal"))
        for x in (-w * 0.3, w * 0.3):
            base.append(M.rbox((0.034, 0.006, 0.022), 0.002, I, top="hw", bottom="hw", edge="hw", at=(x, -d / 2 - 0.004, hb - 0.028), mat="metal"))
            lid.append(M.rbox((0.038, 0.007, 0.03), 0.0025, I, top="hw", bottom="hw", edge="hw", at=(x, -d / 2 - 0.0045, hb + gap + 0.004), mat="metal"))
        zb = hb * 0.6
        base.append(handle([(0.07, -d / 2 + 0.002, zb), (0.066, -d / 2 - 0.026, zb + 0.004), (0.0, -d / 2 - 0.032, zb + 0.006), (-0.066, -d / 2 - 0.026, zb + 0.004), (-0.07, -d / 2 + 0.002, zb)], 0.009, I, mat="shell", n=8))
        for sx in (-1, 1):                            # the handle's brackets
            base.append(M.rbox((0.022, 0.006, 0.026), 0.002, I, top="hw", bottom="hw", edge="hw", at=(sx * 0.075, -d / 2 - 0.004, zb - 0.013), mat="metal"))
        for x in (-w * 0.3, w * 0.3):                 # the hinges' plates on the back
            base.append(M.rbox((0.036, 0.004, 0.024), 0.0015, I, top="hw", bottom="hw", edge="hw", at=(x, d / 2 + 0.003, hb - 0.027), mat="metal"))
    # the lid swung open about its hinge at the back rim (right-handed about -x: its front edge goes up and back)
    pivot = (0.0, d / 2, hb + gap / 2)
    axis = (-1.0, 0.0, 0.0)
    lid_m = M.join(lid, ["shell", "lining", "metal", "rubber"])
    M.turn(lid_m, M.rodrigues(axis, open_deg), about=pivot)
    base_m = M.join(base, ["shell", "lining", "metal", "rubber"])
    th.assemble([("base", base_m), ("lid", lid_m)], mats=["shell", "lining", "metal", "rubber"])
    th.part("lid", pivot, axis, kind="hinge", open=open_deg, shut=0.0, built=open_deg)
    ins = t + lip + edge * 0.5
    th.inside = ((-w / 2 + ins, -d / 2 + ins, floor_z + 0.004), (w / 2 - ins, d / 2 - ins, hb))
    th.high = None
    th.pose = "stand"
    th.sharp_angle = 48
    th.view = {"azim": -38, "elev": 30}
    brand = spec.get("brand", BRANDS[int(r.integers(len(BRANDS)))])
    logo = spec.get("logo") or {}

    def paint(fr):
        # the shell by kind
        X, Y = None, None
        for nm in ("base_bottom", "base_side", "base_rim", "lid_top", "lid_side", "lid_rim"):
            f = fr[nm]
            f.fill(color=color, rough=K["rough"])
            X, Y = f.grid()
            g = N.fbm3(np.stack([X / 9.0, Y / 9.0, np.full_like(X, seed * 0.3)], -1), seed + 3, 3)
            if kind == "hardshell":                   # a polycarbonate's fine grain, and the ribs across the faces
                f.lay_island(np.ones_like(X), height=(g * 0.03).astype(np.float32), add_height=True,
                             rough=np.clip(K["rough"] + 0.05 * g, 0.05, 1).astype(np.float32))
                if nm in ("base_bottom", "lid_top"):
                    tt = np.mod(X + 7.0, 34.0) / 34.0
                    rib = np.clip(1 - np.abs(tt - 0.5) / 0.16, 0, 1).astype(np.float32) * (np.abs(Y - f.H / 2) < f.H * 0.44)
                    f.lay_island(rib, height=(-0.9 * rib).astype(np.float32), add_height=True, color=np.array(_shade(color, 0.86)), alpha=0.35)
                if nm.endswith("rim"):                # the zip's teeth along the rim
                    teeth = ((np.mod(X, 2.4) < 1.2) & (np.abs(Y - f.H / 2) < 1.4)).astype(np.float32)
                    f.lay_island(np.ones_like(X), color="#1f1f1f", rough=0.6)
                    f.lay_island(teeth, color="#b8b8b8", metal=0.9, rough=0.35, height=(0.25 * teeth).astype(np.float32), add_height=True)
            elif kind == "softside":                  # ballistic nylon: a coarse weave, piping along the bands' edges
                paint_cover(f, {"color": color, "rough": 0.9}, seed + 2, weave=1.3)
                if nm.endswith("side"):
                    pipe = np.clip(1 - np.abs(Y - 2.2) / 2.0, 0, 1) + np.clip(1 - np.abs(Y - (f.H - 2.2)) / 2.0, 0, 1)
                    f.lay_island(pipe.astype(np.float32), color=np.array(_shade(color, 1.25)), height=(0.7 * pipe).astype(np.float32), add_height=True, rough=0.75)
                if nm.endswith("rim"):
                    teeth = ((np.mod(X, 2.4) < 1.2) & (np.abs(Y - f.H / 2) < 1.4)).astype(np.float32)
                    f.lay_island(np.ones_like(X), color="#202020", rough=0.6)
                    f.lay_island(teeth, color="#a9a9a9", metal=0.9, rough=0.35, height=(0.25 * teeth).astype(np.float32), add_height=True)
            else:                                     # leather over board: its grain, the darker binding along the edges with its stitches
                f1, f2, _cid = N.cells3(np.stack([X / 1.6, Y / 1.6, np.full_like(X, seed * 0.5)], -1), seed + 5, 1.0)
                cells = np.clip(1.0 - f1 * 1.4, 0, 1)                                   # the pebble grain: each cell a soft bump
                f.lay_island(np.ones_like(X), height=(0.06 * cells + 0.03 * g).astype(np.float32), add_height=True,
                             rough=np.clip(K["rough"] + 0.12 * g, 0.2, 0.9).astype(np.float32))
                f.lay_island((0.14 * np.clip(g, -1, 1) + 0.14).astype(np.float32), color="#000000")
                if nm.endswith("side"):
                    bind = (Y < 9.0).astype(np.float32) + (Y > f.H - 9.0).astype(np.float32)
                    f.lay_island(np.clip(bind, 0, 1), color=np.array(_shade(color, 0.62)), rough=0.45, height=(0.3 * np.clip(bind, 0, 1)).astype(np.float32), add_height=True)
                    st = (np.mod(X, 3.2) < 1.6).astype(np.float32) * ((np.abs(Y - 4.5) < 0.5) | (np.abs(Y - (f.H - 4.5)) < 0.5))
                    f.lay_island(st.astype(np.float32), color="#e3d3a8", rough=0.8, height=(0.2 * st).astype(np.float32), add_height=True)
                if nm.endswith("rim"):
                    f.lay_island(np.ones_like(X), color=np.array(_shade(color, 0.62)), rough=0.45)
        # the brand plate on the lid's top (the prop's own picture to swap)
        f = fr["lid_top"]
        W, H = f.W, f.H
        if kind == "hardshell":
            box = (W / 2, H / 2 + 0.22 * H, 78, 24)
            def plate():
                f.rect(box[0] - 39, box[1] - 12, 78, 24, r=3, color="#cfcfcf", metal=0.9, rough=0.3, height=0.3)
                f.text(str(brand), (box[0], box[1]), 8.5, font="archivo", color="#2a2a2a", rough=0.4, metal=0.2)
            f.slot("logo", box, plate, kind="logo", about="the brand plate", rough=0.4)
        elif kind == "softside":
            box = (W / 2, H * 0.17, 60, 16)
            f.slot("logo", box, lambda: f.text(str(brand), box[:2], 7.0, font="bebas", color="#d8d2c6", rough=0.8), kind="logo", about="the brand's label")
        else:
            box = (W / 2, H / 2, 70, 30)
            f.slot("logo", box, lambda: f.text(str(brand), box[:2], 7.5, font="serif", color=np.array(_shade(color, 0.55)), rough=0.5,
                                               height=-0.15), kind="logo", about="the maker's mark pressed in")
        if logo.get("image"):
            f.image(logo["image"], box[0] - box[2] / 2, box[1] - box[3] / 2, box[2], box[3], rough=0.4)
        # the lining and the pocket
        for nm in ("in_base_floor", "in_base_wall", "in_lid_floor", "in_lid_wall"):
            paint_cover(fr[nm], lining, seed + 7, weave=0.8)
        fp = fr["pocket"]
        paint_cover(fp, {"color": lining.get("pocket", _shade(lining["color"], 0.9)), "pattern": "plain", "rough": 0.9}, seed + 8, weave=0.7)
        Xp, Yp = fp.grid()
        if kind == "vintage":                          # pleated elastic pocket: the pleats' shading
            pl = 0.5 + 0.5 * np.sin(Xp / 7.0)
            fp.lay_island((0.18 * pl).astype(np.float32), color="#000000")
            fp.lay_island(np.ones_like(Xp), height=(0.35 * pl).astype(np.float32), add_height=True)
        else:                                          # a mesh panel with a zip along its head
            mesh = ((np.mod(Xp, 1.6) < 0.8) ^ (np.mod(Yp, 1.6) < 0.8)).astype(np.float32) * 0.35
            fp.lay_island(mesh, color="#000000")
            zip_ = (np.abs(Yp - (fp.H - 6.0)) < 1.6).astype(np.float32)
            fp.lay_island(zip_, color="#1e1e1e", rough=0.6)
            teeth = zip_ * (np.mod(Xp, 2.2) < 1.1)
            fp.lay_island(teeth.astype(np.float32), color="#b5b5b5", metal=0.9, rough=0.35, height=(0.2 * teeth).astype(np.float32), add_height=True)
        fs = fr["strap"]
        fs.fill(color=lining.get("strap", "#2b2b2b"), rough=0.85)
        Xs, Ys = fs.grid()
        fs.lay_island(np.ones_like(Xs), height=(0.12 * np.sin(Xs * 3.1) * np.sin(Ys * 3.1)).astype(np.float32), add_height=True)
        fw = fr["webbing"]
        fw.fill(color=lining.get("strap", "#2b2b2b"), rough=0.85)
        # hardware, wheels, handles
        FN.metal(fr["hw"], spec.get("finish", "satin"), metal_name, seed)
        fr["wheel"].fill(color="#1a1a1a", rough=0.8)
        Xw, Yw = fr["wheel"].grid()
        fr["wheel"].lay_island(((np.mod(Xw, 4.0) < 2.0) & (np.abs(Yw - fr["wheel"].H / 2) < 5)).astype(np.float32), height=np.float32(-0.3), add_height=True, color="#111111")
        fh = fr["handle"]
        fh.fill(color=color if kind == "vintage" else "#1b1b1b", rough=0.5 if kind == "vintage" else 0.8)
        if kind == "vintage":
            Xh, Yh = fh.grid()
            st = (np.mod(Xh, 3.0) < 1.5).astype(np.float32) * (np.abs(Yh - fh.H * 0.5) < 0.5)
            fh.lay_island(st, color="#e3d3a8", rough=0.8)

    th.paint = paint
    return th


def _shade(color, k):
    """A colour (#hex) scaled by k, as rgb 0..1."""
    c = color.lstrip("#")
    v = np.array([int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])
    return np.clip(v * k, 0, 1)
