"""Firearms for the first-person weapon system (DECISIONS 2026-11-09, the user's `weapon-system`): a pump-action
12-gauge shotgun at a riot gun's real sizes and the shells it takes.

The shotgun: a receiver 200 mm long, an 18.5" (470 mm) barrel with its bore and a bead at the muzzle, the magazine
tube under it holding four (its cap and the band that ties it to the barrel), the pump (the fore-end, grooved, on
its 90 mm track, with the action bars that run into the receiver), the trigger in its guard, a stock with a rubber
pad. The pump is a part that slides (PROPGEN §26), the bolt's face a part there only while the action is shut (the
ejection port dark behind it when it's racked open), the trigger a part on its hinge. Sockets: `muzzle`, `eject`
(the ejection port, the right side), `port` (the loading port underneath), `chamber`, `pump` and `grip` (where the
hands hold it), `trigger`, `shoulder`, `light` (where a flashlight is taped under the barrel).

The double (the user's v2, DECISIONS 2026-11-09): the user's own side-by-side, modelled in Blender (`model`, an .fbx
in Content/Studio/Props/models/: the barrels, the stock and action, the top lever and the two triggers as objects of
their own), brought in at its real size (`barrel_mm`), its barrels made round at their own bore, wall and taper
(`round`, 32 sides; 0 keeps the model's eight), cut into the parts that move (`barrels` on the hinge pin found in its
knuckle, 38 degrees open, with the fore-end; `lever` swinging right; `trigger` the front, the right barrel's;
`trigger2` the rear) and painted by each texel's place: blued steel polished along the barrels, the action
case-hardened and faded, walnut with its grain along the gun, the bores and chambers dark. Sockets `muzzle`,
`muzzle_r`, `muzzle_l`, `chamber`, `chamber_r`, `chamber_l`, `hinge`, `breech`, `grip`, `trigger`, `shoulder`, `light`,
all found from the model.

The shell: a 2 3/4" 12-gauge, its brass head (rim, extractor groove, primer), its plastic hull and the six-point star
crimp closing its front; `spent` opens the crimp into a mouth, its inside dark, the brass a little scorched.

    {"family": "weapon", "kind": "shotgun", "steel": "#2b2e33", "wood": "#5b3a24", "furniture": "wood" | "synthetic",
     "barrel_mm": 470, "finish": "satin", "age": "rust", "age_amount": 0.15}
    {"family": "weapon", "kind": "double", "model": "Content/Studio/Props/models/dbl_barrel.fbx", "barrel_mm": 711,
     "steel": "#1e2227", "action": "#8b8f95", "wood": "#4a2c1a"}
    {"family": "weapon", "kind": "shell", "hull": "#a3241f", "brass_mm": 16, "spent": false}
"""
import math
import os

import numpy as np

from .. import finish as FN
from .. import mesh as M
from .. import noise as N
from . import furniture as FU

ZT = -0.0275            # the magazine tube's axis under the bore (the bore on z = 0, the muzzle toward +x)
TRAVEL = 0.090          # the pump's stroke, metres


def _lathe_x(segs, n, I, step, mats, move=(0.0, 0.0, 0.0), scale_yz=(1.0, 1.0)):
    """A lathe turned about z, laid along +x (z -> x: a rotation about y, not a mirror), scaled across, then moved."""
    m = M.lathe(segs, n, I, step=step, mats=mats)
    m.v = m.v @ M.rot("y", 90).T
    m.v[:, 1] *= scale_yz[0]
    m.v[:, 2] *= scale_yz[1]
    m.v += np.asarray(move, float)
    m.a["rest"] = m.v.copy()
    return m


def _slab_side(loops_xz, thick, bevel, I, top, bottom, edge, steps, hole_edge=None, y=0.0):
    """A flat part in the side view (x along the gun, z up) cut from a sheet `thick` metres across: the slab made in
    x-y and stood up by a quarter turn about x (y -> z), a rotation, so its faces keep their fronts."""
    m = M.slab([np.asarray(l, float) for l in loops_xz], thick, bevel, I, top, bottom, edge, hole_edge=hole_edge, steps=steps)
    m.v = m.v @ M.rot("x", 90).T
    m.v[:, 1] += y
    m.a["rest"] = m.v.copy()
    return m


def _shotgun(spec, th):
    seed = int(spec.get("seed", 0))
    L = float(spec.get("barrel_mm", 470)) * 0.001
    synthetic = spec.get("furniture", "wood") == "synthetic"
    steel = spec.get("steel", "#2b2e33")
    fin = spec.get("finish", "satin")
    th.material("steel", "metal", px=int(spec.get("tex", 2048)), color=steel, rough=0.36, metal=1.0)
    th.material("wood", "paint" if synthetic else "wood", px=int(spec.get("tex", 2048)),
                color=spec.get("synthetic_color", "#1d1e20") if synthetic else spec.get("wood", "#5b3a24"),
                rough=0.62 if synthetic else FU.FINISH.get(spec.get("wood_finish", "oil"), 0.55))
    th.material("rubber", "paint", px=512, color="#141414", rough=0.85)

    bx0, bx1 = 0.075, 0.075 + L                   # the barrel's breech (inside the receiver) and muzzle
    tx0, tx1 = 0.090, bx1 - 0.100                 # the magazine tube
    cap1 = tx1 + 0.032
    px0, px1 = tx1 - 0.245, tx1 - 0.025           # the pump at rest (forward)
    # islands, millimetres
    th.island("rcv_top", 200, 32, "steel")
    th.island("rcv_bottom", 200, 32, "steel")
    th.island("rcv_side", 470, 70, "steel")
    th.island("barrel", 2 * math.pi * 14.5, 40 + L * 1000 + 8, "steel", wrap=True)
    th.island("bore", 2 * math.pi * 9.3, 62, "steel", wrap=True)
    th.island("tube", 2 * math.pi * 11, (tx1 - tx0) * 1000 + 24, "steel", wrap=True)
    th.island("cap", 2 * math.pi * 12.5, 48, "steel", wrap=True)
    th.island("bead", 12, 6, "steel", wrap=True)
    for nm, w, h in (("band", 12, 46), ("bars", 110, 7), ("bolt", 58, 18), ("ports", 75, 22), ("guard", 82, 30),
                     ("trigger", 10, 24)):
        th.island(nm + "_top", w, h, "steel")
        th.island(nm + "_bottom", w, h, "steel")
        th.island(nm + "_edge", 2 * (w + h) + 10, 12, "steel")
    th.island("stock_top", 330, 145, "wood")
    th.island("stock_bottom", 330, 145, "wood")
    th.island("stock_edge", 980, 48, "wood")
    th.island("pump", 2 * math.pi * 25, (px1 - px0) * 1000 + 40, "wood", wrap=True)
    th.island("pad_top", 26, 144, "rubber")
    th.island("pad_bottom", 26, 144, "rubber")
    th.island("pad_edge", 340, 46, "rubber")
    th.pack()
    I = th.islands
    mats = ["steel", "wood", "rubber"]

    def build(hi):
        n = 40 if hi else 20                      # columns round a lathe
        st = 0.002 if hi else 0.008               # metres between a profile's rings
        bev = 4 if hi else 2                      # rounded edges' rings
        out = []
        # the receiver: a rounded box, the bore 18 mm under its top
        rcv = M.rbox((0.200, 0.032, 0.062), 0.0035, I, "rcv_top", "rcv_bottom", "rcv_side", at=(0.0, 0.0, -0.040), steps=bev,
                     corner=0.004, mat="steel")
        # the ports, dark: the ejection port on the right side (-y), the loading port underneath
        ej = M.rbox((0.060, 0.0006, 0.019), 0.0002, I, "ports_top", "ports_bottom", "ports_edge", at=(0.0125, -0.0163, -0.0085), steps=1,
                    mat="steel")
        ld = M.rbox((0.074, 0.021, 0.0006), 0.0002, I, "ports_top", "ports_bottom", "ports_edge", at=(0.047, 0.0, -0.0406), steps=1,
                    mat="steel")
        # the barrel: its ring at the breech, tapering to the muzzle, the crown and the bore down into it
        prof = [(0.0, 0.0), (0.0145, 0.0), (0.0145, 0.050), (0.0128, 0.066), (0.0112, 0.20), (0.0106, L - 0.004), (0.0102, L)]
        bore = [(0.0102, L), (0.0093, L), (0.0093, L - 0.060), (0.0, L - 0.060)]
        bar = _lathe_x([M.Seg(prof, "barrel", "band"), M.Seg(bore, "bore", "band", sharp=True)], n, I, st, mats, move=(bx0, 0, 0))
        bead = _lathe_x([M.Seg([(0.0, 0.0), (0.0016, 0.0004), (0.0019, 0.0018), (0.0012, 0.0034), (0.0, 0.0038)], "bead", "band")],
                        12 if hi else 8, I, 0.0006, mats)
        bead.v = bead.v @ M.rot("y", -90).T       # standing up on the barrel's top, near the muzzle
        bead.v += np.array([bx1 - 0.009, 0.0, 0.0101])
        bead.a["rest"] = bead.v.copy()
        tube = _lathe_x([M.Seg([(0.0, 0.0), (0.0110, 0.0), (0.0110, tx1 - tx0), (0.0, tx1 - tx0)], "tube", "band")], n, I, st, mats,
                        move=(tx0, 0, ZT))
        capp = [(0.0, 0.0), (0.0125, 0.0)] + [(0.0125 - (0.0006 if (k % 2) else 0.0), 0.003 + k * 0.0024) for k in range(10)] + \
               [(0.0124, 0.027), (0.0100, 0.031), (0.0050, 0.0325), (0.0, 0.0328)]
        cap = _lathe_x([M.Seg(capp, "cap", "band")], n, I, st * 0.5, mats, move=(tx1, 0, ZT))
        band = M.rbox((0.012, 0.0255, 0.0465), 0.0025, I, "band_top", "band_bottom", "band_edge", at=(tx1 - 0.014, 0.0, ZT - 0.0125),
                      steps=bev, mat="steel")
        # the guard under the receiver and the trigger in it (side view outlines, x along the gun, z up)
        guard_o = [(0.004, -0.0385), (0.004, -0.060), (-0.006, -0.0695), (-0.070, -0.0695), (-0.079, -0.062), (-0.079, -0.0385)]
        guard_h = [(-0.016, -0.0445), (-0.068, -0.0445), (-0.0705, -0.058), (-0.062, -0.0635), (-0.020, -0.0635), (-0.0135, -0.056)]
        guard = _slab_side([M.resample_loop(np.array(guard_o), 0.003 if hi else 0.01), M.resample_loop(np.array(guard_h), 0.003 if hi else 0.01)],
                           0.0115, 0.002, I, "guard_top", "guard_bottom", "guard_edge", bev, hole_edge="guard_edge")
        trig_o = [(-0.0445, -0.0385), (-0.0375, -0.0385), (-0.0365, -0.050), (-0.0395, -0.0585), (-0.0455, -0.0605), (-0.0430, -0.0530),
                  (-0.0440, -0.0445)]
        trig = _slab_side([M.resample_loop(np.array(trig_o), 0.002 if hi else 0.006)], 0.0058, 0.0012, I, "trigger_top", "trigger_bottom",
                          "trigger_edge", bev)
        # the stock: its outline in the side view, slimmer at the wrist than at the butt
        stock_o = [(-0.098, 0.0165), (-0.180, 0.0125), (-0.300, 0.0050), (-0.418, -0.0010), (-0.418, -0.1385), (-0.300, -0.1060),
                   (-0.215, -0.0870), (-0.172, -0.0745), (-0.136, -0.0640), (-0.112, -0.0520), (-0.098, -0.0405)]
        stock = _slab_side([M.resample_loop(np.array(stock_o), 0.004 if hi else 0.016)], 0.041, 0.0125, I, "stock_top", "stock_bottom",
                           "stock_edge", bev)
        wx = np.array([-0.098, -0.120, -0.170, -0.260, -0.420])
        wf = np.array([0.80, 0.80, 0.84, 0.97, 1.03])
        stock.v[:, 1] *= np.interp(stock.v[:, 0], wx, wf)
        stock.a["rest"] = stock.v.copy()
        pad = M.rbox((0.022, 0.044, 0.1425), 0.005, I, "pad_top", "pad_bottom", "pad_edge", at=(-0.4285, 0.0, -0.1405), steps=bev,
                     corner=0.008, mat="rubber")
        # the pump: grooved, an ellipse across, round the tube; the action bars back from it into the receiver
        r0, rg = 0.0250, 0.0234
        pp = [(0.0114, 0.0), (0.0200, 0.0), (0.0236, 0.004), (r0, 0.012)]
        z = 0.030
        while z < (px1 - px0) - 0.040:
            pp += [(r0, z), (rg, z + 0.0012), (rg, z + 0.0040), (r0, z + 0.0052)]
            z += 0.0142
        pp += [(r0, (px1 - px0) - 0.012), (0.0236, (px1 - px0) - 0.004), (0.0200, px1 - px0), (0.0114, px1 - px0), (0.0114, 0.0)]
        pump = _lathe_x([M.Seg(pp, "pump", "band")], n, I, st * 0.5, mats, move=(px0, 0, ZT), scale_yz=(0.90, 1.07))
        bars = [M.rbox((px0 - 0.095 + 0.006, 0.0026, 0.0058), 0.0008, I, "bars_top", "bars_bottom", "bars_edge",
                       at=((0.095 + px0 + 0.006) / 2, s * 0.0121, ZT + 0.0052), steps=1, mat="steel") for s in (-1, 1)]
        pump = M.join([pump] + bars, mats)
        bolt = M.rbox((0.058, 0.0016, 0.0180), 0.0005, I, "bolt_top", "bolt_bottom", "bolt_edge", at=(0.0125, -0.0168, -0.0085), steps=1,
                      mat="steel")
        out = [("receiver", M.join([rcv, ej, ld, bar, bead, tube, cap, band, guard, stock, pad], mats)), ("trigger", trig), ("pump", pump),
               ("bolt", bolt)]
        return out

    th.assemble(build(False), build(True), mats)
    th.part("pump", (px0, 0.0, ZT), (-1.0, 0.0, 0.0), kind="slide", open=TRAVEL, shut=0.0, built=0.0)
    th.part("bolt", (0.0125, -0.0168, 0.0005), (0.0, 0.0, 1.0), kind="hide", open=1.0, shut=0.0, built=0.0)
    th.part("trigger", (-0.041, 0.0, -0.040), (0.0, 1.0, 0.0), kind="hinge", open=-14.0, shut=0.0, built=0.0)
    th.sockets = {"muzzle": ((bx1 + 0.002, 0.0, 0.0), (1.0, 0.0, 0.0)),
                  "eject": ((0.0125, -0.019, 0.001), (0.15, -0.9, 0.42)),
                  "port": ((0.047, 0.0, -0.041), (0.0, 0.0, -1.0)),
                  "chamber": ((0.020, 0.0, 0.0), (1.0, 0.0, 0.0)),
                  "pump": (((px0 + px1) / 2, 0.0, ZT - 0.026), (0.0, 0.0, -1.0)),
                  "grip": ((-0.150, 0.0, -0.058), (0.0, 0.0, -1.0)),
                  "trigger": ((-0.041, 0.0, -0.052), (1.0, 0.0, 0.0)),
                  "shoulder": ((-0.430, 0.0, -0.070), (-1.0, 0.0, 0.0)),
                  "light": ((tx1 - 0.060, -0.022, ZT), (1.0, 0.0, 0.0))}
    th.extras["weapon"] = {"kind": "shotgun", "gauge": 12, "capacity": 4, "chamber": 1, "travel_m": TRAVEL, "barrel_m": L}
    th.pose = "stand"
    th.weighted = 40.0
    th.view = {"azim": -62, "elev": 16}
    th.reach = 0.004
    th.cage = 0.002
    wood_d = {"wood": spec.get("wood", "#5b3a24"), "ring": 3.5, "finish": spec.get("wood_finish", "oil"),
              "flaws": {"grain": 0.6, "cracks": 0.1, "scratches": 0.5, "dents": 0.3}}

    def paint(fr):
        for i, nm in enumerate([k for k, v in I.items() if v.mat == "steel"]):
            f = fr[nm]
            if nm.startswith("ports"):
                f.fill(color="#050505", rough=0.8, metal=0.0)
            elif nm == "bore" or nm.startswith("bars") or nm.startswith("bolt"):
                FN.metal(f, "satin", "#8e949b" if nm != "bore" else "#3a3d41", seed + i, along=0.0)
            elif nm == "bead":
                FN.metal(f, "polished", "brass", seed + i)
            else:
                FN.metal(f, fin, steel, seed + i, along=90.0 if nm in ("barrel", "tube") else 0.0, age=spec.get("age"),
                         age_amount=float(spec.get("age_amount", 0.15)))
        f = fr["cap"]                               # the cap's knurling: fine diagonal grooves round it
        X, Y = f.grid()
        k = (np.sin((X + Y) * 2 * math.pi / 1.2) > 0.6).astype(np.float32)
        f.lay_island(k * (Y < f.H * 0.86).astype(np.float32), height=-0.05, add_height=True, rough=0.5)
        for i, nm in enumerate(("stock_top", "stock_bottom", "stock_edge", "pump")):
            f = fr[nm]
            if synthetic:
                f.fill(color=spec.get("synthetic_color", "#1d1e20"), rough=0.62, metal=0.0)
                X, Y = f.grid()
                g = N.fbm3(np.stack([X / 0.8, Y / 0.8, np.full_like(X, seed * 0.3)], -1), seed + 70 + i, 2)
                f.lay_island(np.ones_like(X), height=(0.006 * g).astype(np.float32), add_height=True)
            else:
                FU.paint_wood(f, "edge" if nm == "stock_edge" else "board", wood_d, np.random.default_rng(seed * 7 + i), seed * 13 + i)
        for nm in ("pad_top", "pad_bottom", "pad_edge"):   # the pad: rubber, a fine stipple
            f = fr[nm]
            X, Y = f.grid()
            g = N.fbm3(np.stack([X / 0.5, Y / 0.5, np.full_like(X, 3.0)], -1), seed + 90, 2)
            f.lay_island(np.ones_like(X), height=(0.01 * g).astype(np.float32), add_height=True)

    th.paint = paint
    return th


def _loose_parts(bm):
    """The bmesh's loose parts: a list of face lists, each part's faces joined by their vertices."""
    bm.verts.ensure_lookup_table()
    seen = set()
    parts = []
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        stack = [f0]
        seen.add(f0.index)
        part = []
        while stack:
            f = stack.pop()
            part.append(f)
            for v in f.verts:
                for g in v.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        parts.append(part)
    return parts


def _rings(tv):
    """A pair of barrels' tube (its vertices, the muzzles toward +x) measured: the muzzle's and the breech's x, each
    bore's axis (y, z) with its radius and the tube's at the muzzle, and the bore's and the tube's radius at both ends
    (barrels taper)."""
    xm, xb = float(tv[:, 0].max()), float(tv[:, 0].min())
    bores = []
    for sgn in (-1.0, 1.0):                           # the right (-y), then the left
        ring = tv[(tv[:, 0] > xm - 0.0015) & (tv[:, 1] * sgn > 0.001)][:, 1:]
        c = ring.mean(0)
        for _ in range(3):                              # the bore's own ring: the nearest half of the face's corners
            d = np.linalg.norm(ring - c, axis=1)
            c = ring[d <= np.median(d)].mean(0)
        d = np.linalg.norm(ring - c, axis=1)
        bores.append((float(c[0]), float(c[1]), float(d[d <= np.median(d)].mean()), float(d[d > np.median(d)].mean())))
    ends = []
    for sel in (tv[:, 0] < xb + 0.0015, tv[:, 0] > xm - 0.0015):
        d = np.concatenate([np.hypot(tv[sel & (tv[:, 1] * (1 if i else -1) > -0.0005), 1] - bores[i][0],
                                     tv[sel & (tv[:, 1] * (1 if i else -1) > -0.0005), 2] - bores[i][1]) for i in (0, 1)])
        ends.append((float(d[d <= np.median(d)].mean()), float(d[d > np.median(d)].mean())))
    return xm, xb, bores, ends


def _round_tubes(bm, xm, xb, bores, ends, n=32, mi=0):
    """Each barrel as a round tapered tube of n sides (its bore, its wall, its two ends) where the model's own was."""
    import bmesh
    made = []
    for by, bz_, _, _ in bores:
        rings = []
        for x, (rb, ro) in ((xb, ends[0]), (xm, ends[1])):
            a = np.linspace(0.0, 2 * math.pi, n, endpoint=False)
            rings.append([[bm.verts.new((x, by + r * math.cos(t), bz_ + r * math.sin(t))) for t in a] for r in (ro, rb)])
        (bo, bi), (mo, mi_) = rings
        fs = []
        for k in range(n):
            j = (k + 1) % n
            fs.append(bm.faces.new((bo[k], bo[j], mo[j], mo[k])))        # the outside
            fs.append(bm.faces.new((bi[k], mi_[k], mi_[j], bi[j])))      # the bore
            fs.append(bm.faces.new((mo[k], mo[j], mi_[j], mi_[k])))      # the muzzle's crown
            fs.append(bm.faces.new((bo[k], bi[k], bi[j], bo[j])))        # the breech's face
        for f in fs:
            f.material_index = mi
            f.smooth = True
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        made += fs
    return made


DOUBLE_PIECES = {"receiver": ["double_barrel", "shotgun_trigger"], "barrels": ["double_barrel_gun", "shotgun_shutter"],
                 "lever": ["double_barrel_separator"], "trigger": ["double_barrel_Right_Trigger"],
                 "trigger2": ["double_barrel_Left_Trigger"]}


def _double(spec, th):
    """The user's own double barrel (their model, `model`: an .fbx with the barrels, the stock and action, the top
    lever and the two triggers as objects of their own) at its real size, its muzzles toward +x, its eight-sided barrels
    made round at their own sizes (`round` sides; 0 keeps them), cut into the parts that move and painted by each
    texel's place: blued steel polished along the barrels and their bores dark, a matted rib and a brass bead, the
    action case-hardened and faded, walnut with its grain along the stock and the fore-end and checkering at the wrist
    and on the fore-end, an ebonite butt plate; then worn and baked as the made props are."""
    import bmesh
    import bpy
    import mathutils
    from ..paint import rgb
    from ..recipes import ROOT
    seed = int(spec.get("seed", 0))
    path = spec.get("model", "Content/Studio/Props/models/dbl_barrel.fbx")
    path = path if os.path.isabs(path) else os.path.join(ROOT, path)
    if not os.path.exists(path):
        raise SystemExit(f"weapon double: no model at {path}")
    pieces = spec.get("pieces") or DOUBLE_PIECES
    wood_objects = set(spec.get("wood_objects", ["shotgun_shutter"]))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    bpy.context.view_layer.update()
    obs = {o.name: o for o in bpy.data.objects if o not in before and o.type == "MESH"}
    missing = [n for ns in pieces.values() for n in ns if n not in obs]
    if missing:
        raise SystemExit(f"weapon double: {', '.join(missing)} not in {os.path.basename(path)} (its objects: {', '.join(sorted(obs))})")
    # its real size by the barrels' length, end to end (the model's muzzles toward -x: turned round to +x)
    turn = mathutils.Matrix.Rotation(math.pi, 4, "Z") if spec.get("muzzle", "-x") == "-x" else mathutils.Matrix.Identity(4)
    world = {n: o.matrix_world.copy() for n, o in obs.items()}
    bar = obs[pieces["barrels"][0]]
    bx = [(turn @ world[bar.name] @ v.co).x for v in bar.data.vertices]
    k = float(spec.get("barrel_mm", 711)) * 0.001 / max(max(bx) - min(bx), 1e-6)
    R = turn @ mathutils.Matrix.Scale(k, 4)
    mats = ["steel", "action", "wood"]
    for nm in mats:
        if nm not in bpy.data.materials:
            bpy.data.materials.new(nm)
    for n, o in obs.items():                         # every mesh at its place first (children follow their parents)
        o.data.transform(R @ world[n])
    for o in obs.values():
        o.parent = None
        o.matrix_world = mathutils.Matrix.Identity(4)
    order = list(pieces)
    loose = []                                       # (piece, object, part, its vertices, material)
    for pi, (pname, names) in enumerate(pieces.items()):
        for onm in names:
            me = obs[onm].data
            me.materials.clear()
            for nm in mats:
                me.materials.append(bpy.data.materials[nm])
            bm = bmesh.new()
            bm.from_mesh(me)
            parts = _loose_parts(bm)
            pv = [np.array([tuple(v.co) for v in {v for f in part for v in f.verts}]) for part in parts]
            lo = [p.min(0) for p in pv]
            hi = [p.max(0) for p in pv]
            first = onm == names[0]
            stock = min(range(len(parts)), key=lambda i: lo[i][0]) if pname == "receiver" and first else -1
            tube = max(range(len(parts)), key=lambda i: float(np.prod(hi[i] - lo[i]))) if pname == "barrels" and first else -1
            if tube >= 0:
                rings = _rings(pv[tube])
                if int(spec.get("round", 32)) > 0:      # the model's tube made round, its own sizes kept
                    bmesh.ops.delete(bm, geom=parts[tube], context="FACES")
                    parts[tube] = _round_tubes(bm, *rings, n=int(spec.get("round", 32)))
                    pv[tube] = np.array([tuple(v.co) for v in {v for f in parts[tube] for v in f.verts}])
            for i, part in enumerate(parts):
                if onm in wood_objects or i == stock:
                    mi = 2
                elif tube >= 0 and i != tube and hi[i][0] - lo[i][0] > 0.10 and hi[i][2] < lo[tube][2] + 0.008:
                    mi = 2                               # the fore-end under the barrels
                elif pname == "receiver" and max(-lo[i][1], hi[i][1]) >= 0.010:
                    mi = 1                               # the action's own: its body, the fences, the pins through it
                else:
                    mi = 0
                for f in part:
                    f.material_index = mi
                loose.append((pname, onm, "tube" if i == tube else "stock" if i == stock else i, pv[i], mi))
            bm.to_mesh(me)
            bm.free()
            at = me.attributes.get("hs_piece") or me.attributes.new("hs_piece", "INT", "FACE")
            at.data.foreach_set("value", [pi] * len(me.polygons))
    joined = [obs[n] for ns in pieces.values() for n in ns]
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in joined:
        o.select_set(True)
    bpy.context.view_layer.objects.active = joined[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    big = [f for f in bm.faces if len(f.verts) > 4]
    if big:
        bmesh.ops.triangulate(bm, faces=big)
    bm.to_mesh(me)
    bm.free()
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    for i in range(len(ob.material_slots)):             # a layout of its own a material, in 0-1, no overlaps
        bpy.ops.mesh.select_all(action="DESELECT")
        ob.active_material_index = i
        bpy.ops.object.material_slot_select()
        bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.006, area_weight=0.0, correct_aspect=True,
                                 scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    piece = np.zeros(len(me.polygons), np.int32)
    me.attributes["hs_piece"].data.foreach_get("value", piece)
    full = M.from_blender(me)
    full.mats = mats
    full.a["rest"] = full.v.copy()
    for o in list(bpy.data.objects):
        if o not in before:
            bpy.data.objects.remove(o, do_unlink=True)
    cut = {nm: M.select(full, piece == i) for i, nm in enumerate(order)}
    th.assemble([(nm, cut[nm]) for nm in order], None, mats)
    th.high = None

    # where things are, measured on the model
    def of(pname, tag):
        return next(v for p, _, t, v, _ in loose if p == pname and t == tag)

    xm, xb, bores, ends = rings
    bz = (bores[0][1] + bores[1][1]) / 2

    def radii(x):
        """The bore's and the barrel's radius at x: both taper from the breech to the muzzle."""
        t = np.clip((x - xb) / max(xm - xb, 1e-6), 0, 1)
        return ends[0][0] + (ends[1][0] - ends[0][0]) * t, ends[0][1] + (ends[1][1] - ends[0][1]) * t
    pins = [v for p, o, t, v, mi in loose if p == "receiver" and o == pieces["receiver"][0] and len(v) <= 24 and mi == 1
            and v[:, 2].max() < bz and v[:, 0].mean() > xb]
    hinge = spec.get("hinge")
    if hinge is None:                                  # the knuckle's pin: the action's foremost pin under the bores
        pin = max(pins, key=lambda v: v[:, 0].mean()) if pins else None
        hinge = ([float((pin[:, 0].min() + pin[:, 0].max()) / 2), 0.0, float((pin[:, 2].min() + pin[:, 2].max()) / 2)]
                 if pin is not None else [xb + 0.06, 0.0, bz - 0.02])
    lp = [v for p, _, _, v, _ in loose if p == "lever"]
    boss = max(lp, key=lambda v: v[:, 1].max() - v[:, 1].min())
    lever_pivot = [float((boss[:, 0].min() + boss[:, 0].max()) / 2), 0.0, float(boss[:, 2].min())]

    def top_of(v):
        t = v[v[:, 2] > v[:, 2].max() - 0.003]
        return [float(t[:, 0].mean()), 0.0, float(v[:, 2].max())]

    tr = cut["trigger"].v
    t2 = cut["trigger2"].v
    sv = of("receiver", "stock")
    butt_x = float(sv[:, 0].min())
    wood_b = np.concatenate([v for p, _, _, v, mi in loose if p == "barrels" and mi == 2])
    fe = [v for p, o, t, v, mi in loose if p == "barrels" and o == pieces["barrels"][0] and mi == 2]
    fore = fe[0] if fe else wood_b
    beads = [v for p, o, t, v, mi in loose if p == "barrels" and mi == 0 and t != "tube" and (v.max(0) - v.min(0)).max() < 0.012
             and v[:, 0].min() > xm - 0.08]
    bead = (beads[0].min(0) - 0.0006, beads[0].max(0) + 0.0006) if beads else None
    ribs = [v for p, o, t, v, mi in loose if p == "barrels" and mi == 0 and t != "tube" and v[:, 0].max() - v[:, 0].min() > 0.5
            and v[:, 1].max() - v[:, 1].min() < 0.012 and v[:, 2].min() > bz]
    rib_z = float(ribs[0][:, 2].min()) if ribs else bz + 0.009
    print(f"  double: {len(full.f)} faces, scale {k:.4f}; muzzle x {xm:.3f}, breech x {xb:.3f}; bores "
          + ", ".join(f"y {b[0]:+.4f} z {b[1]:.4f} r {b[2]:.4f}/{b[3]:.4f}" for b in bores)
          + f"; radii breech {np.round(ends[0], 4).tolist()} muzzle {np.round(ends[1], 4).tolist()}"
          + f"; hinge {np.round(hinge, 4).tolist()}, lever {np.round(lever_pivot, 4).tolist()}")
    open_deg = float(spec.get("open_deg", 38.0))
    th.part("barrels", tuple(hinge), (0.0, 1.0, 0.0), kind="hinge", open=open_deg, shut=0.0, built=0.0)
    th.part("lever", tuple(lever_pivot), (0.0, 0.0, 1.0), kind="hinge", open=30.0, shut=0.0, built=0.0)
    th.part("trigger", tuple(top_of(tr)), (0.0, 1.0, 0.0), kind="hinge", open=14.0, shut=0.0, built=0.0)
    th.part("trigger2", tuple(top_of(t2)), (0.0, 1.0, 0.0), kind="hinge", open=14.0, shut=0.0, built=0.0)
    th.sockets = {"muzzle": ((xm + 0.002, 0.0, bz), (1.0, 0.0, 0.0)),
                  "muzzle_r": ((xm + 0.002, bores[0][0], bores[0][1]), (1.0, 0.0, 0.0)),
                  "muzzle_l": ((xm + 0.002, bores[1][0], bores[1][1]), (1.0, 0.0, 0.0)),
                  "chamber": ((xb + 0.010, 0.0, bz), (1.0, 0.0, 0.0)),
                  "chamber_r": ((xb, bores[0][0], bores[0][1]), (1.0, 0.0, 0.0)),
                  "chamber_l": ((xb, bores[1][0], bores[1][1]), (1.0, 0.0, 0.0)),
                  "hinge": (tuple(hinge), (0.0, 1.0, 0.0)),
                  "breech": ((xb - 0.001, 0.0, bz), (-1.0, 0.0, 0.0)),
                  "grip": ((float(tr[:, 0].mean()) - 0.075, 0.0, float(tr[:, 2].min()) - 0.010), (0.0, 0.0, -1.0)),
                  "trigger": ((float(tr[:, 0].mean()), 0.0, float(tr[:, 2].mean())), (1.0, 0.0, 0.0)),
                  "shoulder": ((butt_x, 0.0, float(sv[sv[:, 0] < butt_x + 0.03][:, 2].mean())), (-1.0, 0.0, 0.0)),
                  "light": ((float(wood_b[:, 0].max()) + 0.03, 0.0, bz - float(radii(float(wood_b[:, 0].max()) + 0.03)[1]) - 0.010),
                            (1.0, 0.0, 0.0))}
    th.extras["weapon"] = {"kind": "double", "gauge": 12, "capacity": 2, "barrel_m": round(xm - xb, 3), "open_deg": open_deg,
                           "model": os.path.basename(path)}
    px = int(spec.get("tex", 2048))
    steel = rgb(spec.get("steel", "#262a30"))
    act = rgb(spec.get("action", "#8b8f95"))
    wood = rgb(spec.get("wood", "#4a2c1a"))
    th.material("steel", "metal", px=px, color=spec.get("steel", "#262a30"), rough=0.3, metal=1.0)
    th.material("action", "metal", px=px // 2, color=spec.get("action", "#8b8f95"), rough=0.34, metal=1.0)
    th.material("wood", "wood", px=px, color=spec.get("wood", "#4a2c1a"), rough=0.5)
    # each material's texels a millimetre (smart UVs: one density a material), for the relief and the wear's scale
    tt, tuv, tf = full.tris()
    a3 = 0.5 * np.linalg.norm(np.cross(full.v[tt[:, 1]] - full.v[tt[:, 0]], full.v[tt[:, 2]] - full.v[tt[:, 0]]), axis=1) * 1e6
    e1, e2 = tuv[:, 1] - tuv[:, 0], tuv[:, 2] - tuv[:, 0]
    a2 = 0.5 * np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0])
    for mi, nm in enumerate(mats):
        sel = full.fm[tf] == mi
        if sel.any():
            th.density[nm] = float(th.mats[nm]["px"] * math.sqrt(a2[sel].sum() / max(a3[sel].sum(), 1e-9)))
    th.pose = "stand"
    th.sharp_angle = float(spec.get("sharp_angle", 50))
    th.weighted = float(spec.get("weighted", 50))
    th.view = {"azim": -62, "elev": 16}

    def bore_r(y, z, n):
        """Each texel's distance from the nearer bore's axis, and whether its surface faces away from it (the barrel's
        outside, not its bore)."""
        d0 = np.hypot(y - bores[0][0], z - bores[0][1])
        d1 = np.hypot(y - bores[1][0], z - bores[1][1])
        near = np.where((d0 <= d1)[:, None], np.array(bores[0][:2])[None], np.array(bores[1][:2])[None])
        out = n[:, 1] * (y - near[:, 0]) + n[:, 2] * (z - near[:, 1]) > 0
        return np.minimum(d0, d1), out

    def checkering(x, z, n, cx, cz, ax, az, pitch=0.0013, ang=28.0):
        """Diamond checkering in an oval panel on the sides (the grooves 1, the diamonds 0), its border a groove."""
        e = ((x - cx) / ax) ** 2 + ((z - cz) / az) ** 2
        side = np.abs(n[:, 1]) > 0.35
        a = math.radians(ang)
        g1 = (x * math.cos(a) + z * math.sin(a)) / pitch
        g2 = (x * math.cos(a) - z * math.sin(a)) / pitch
        w = 0.28
        grooves = np.maximum(np.clip(1 - np.abs(g1 - np.round(g1)) / w, 0, 1), np.clip(1 - np.abs(g2 - np.round(g2)) / w, 0, 1))
        inside = (e < 1.0) & side
        border = side & (np.abs(np.sqrt(e) - 1.035) < 0.012)
        return np.where(inside, grooves, 0.0), border

    def texel_paint(mname, cv, tx):
        hit = tx["hit"]
        if not hit.any():
            return
        cv.used |= hit
        P = tx["rest"][hit].astype(np.float64)
        Nn = tx["nrm"][hit]
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        if mname == "steel":
            # blued steel polished along the gun, a faint blue-black mottle in it
            brush = N.fbm3(np.stack([x * 160.0, y * 1700.0, z * 1700.0], -1), seed + 1, 3)
            mott = N.fbm3(np.stack([x * 35.0, y * 60.0, z * 60.0], -1), seed + 2, 3)
            col = steel[None] * (1.0 + 0.10 * mott[:, None] + 0.04 * brush[:, None]) + np.array([0.0, 0.003, 0.010])[None]
            rough = 0.28 + 0.05 * brush + 0.04 * mott
            metal = np.ones(len(P))
            height = 0.0025 * brush
            on = (x > xb - 0.0005) & (x < xm + 0.0005)
            r, out = bore_r(y, z, Nn)
            rb, ro = radii(x)
            ends_ = np.abs(Nn[:, 0]) > 0.7
            inner = on & ~out & (r < rb + 0.0002) & ~ends_
            col[inner] = rgb("#1b1c1e")                 # the bores: dark, polished
            rough[inner] = 0.22
            crown = on & (x > xm - 0.0008) & (r < ro + 0.0005)
            col[crown] = rgb("#7b7f86")                 # the muzzles' crowns worn bright
            rough[crown] = 0.24
            face = on & (x < xb + 0.0008) & (r < ro + 0.0005)
            col[face] = rgb("#62666c")                  # the breech faces machined
            rough[face] = 0.36
            rib = on & (np.abs(y) < 0.0048) & (z > rib_z - 0.0004) & ~crown & ~face
            mat_ = np.abs(np.sin(x * math.pi / 0.0007))
            col[rib] = steel * 0.95 + 0.02 * mat_[rib, None]
            rough[rib] = 0.62 + 0.08 * mat_[rib]           # the rib matted (no glare along it)
            height[rib] = -0.012 * (mat_[rib] < 0.35)
            if bead is not None:
                bd = np.all((P > bead[0]) & (P < bead[1]), axis=1)
                col[bd] = rgb("#c4a060")                # the bead, brass
                rough[bd] = 0.22
            cv.col[hit] = np.clip(col, 0, 1)
            cv.rough[hit] = np.clip(rough, 0.05, 1)
            cv.metal[hit] = metal
            cv.height[hit] = height
            yy, xx = np.nonzero(hit)
            keep[mname] = (yy[inner], xx[inner])
            small = x < xb - 0.002                      # the lever, the tang, the guard and the triggers: thin, all edge
            keep["small"] = (yy[small], xx[small], cv.col[yy[small], xx[small]].copy(), cv.rough[yy[small], xx[small]].copy(),
                             cv.metal[yy[small], xx[small]].copy())
        elif mname == "action":
            # case-hardened and faded: straw, blue and a little purple mottling over the grey, polished over
            m1 = N.fbm3(P * 70.0, seed + 3, 4)
            m2 = N.fbm3(P * 160.0 + 3.1, seed + 4, 3)
            col = np.tile(act[None], (len(P), 1))
            for c_, w_ in ((rgb("#a68c58"), 0.34 * np.clip((m1 - 0.08) / 0.45, 0, 1)),
                           (rgb("#4b5a7d"), 0.40 * np.clip((-m1 - 0.08) / 0.45, 0, 1)),
                           (rgb("#6c4f74"), 0.26 * np.clip((m2 - 0.28) / 0.40, 0, 1))):
                col = col * (1 - w_[:, None]) + c_[None] * w_[:, None]
            cv.col[hit] = np.clip(col, 0, 1)
            cv.rough[hit] = np.clip(0.30 + 0.07 * m2, 0.05, 1)
            cv.metal[hit] = 1.0
            cv.height[hit] = 0.0015 * m2
        elif mname == "wood":
            # walnut, oiled (the furniture's wood, wood_color, in the solid): the growth rings 5 mm apart round a pith
            # along the gun (the stock's below it, the fore-end's beside it), wandering; the fibres and pores along
            # them; a slow change of tone and walnut's dark streaks; checkering at the wrist and on the fore-end; an
            # ebonite butt plate
            front = x > xb
            s0 = seed * 0.37 + np.where(front, 5.0, 0.0)
            py = np.where(front, -0.045, 0.040)
            pz = np.where(front, -0.030, -0.095)
            X = x * 1000.0
            wy = 9.0 * N.fbm3(np.stack([X / 170.0, y * 1000.0 / 45.0, z * 1000.0 / 45.0 + s0], -1), seed + 51, 3)
            r = np.hypot((y - py) * 1000.0, (z - pz) * 1000.0) + wy           # mm from the pith
            fr = np.mod(r / 5.0, 1.0)
            late = np.clip((fr - 0.62) / 0.18, 0, 1) - np.clip((fr - 0.9) / 0.1, 0, 1)
            late = late * late * (3 - 2 * late)
            fib = N.fbm3(np.stack([X / 140.0, r / 1.2, s0 + 7.0], -1), seed + 53, 2) * 0.5 + 0.5
            tone = N.fbm3(np.stack([X / 420.0, r / 160.0, s0 + 11.0], -1), seed + 54, 2)
            streak = np.clip((N.fbm3(np.stack([X / 300.0, r / 3.5, s0 + 13.0], -1), seed + 55, 3) - 0.18) / 0.3, 0, 1)
            pores = np.clip((N.fbm3(np.stack([X / 3.0, r / 0.35, s0 + 17.0], -1), seed + 56, 2) - 0.25) / 0.3, 0, 1)
            t = np.clip(0.5 * late + 0.22 * fib + 0.12 * tone + 0.08, 0, 1)
            col = (wood * 1.12)[None] * (1 - t)[:, None] + (wood * 0.62)[None] * t[:, None]
            col = col * ((1 + 0.1 * tone) * (1 - 0.3 * streak) * (1 - 0.2 * pores))[:, None]
            rough = 0.42 - 0.05 * late + 0.12 * pores
            height = 0.03 * late - 0.02 * pores
            tx_ = float(tr[:, 0].mean())
            wr = sv[(sv[:, 0] > tx_ - 0.11) & (sv[:, 0] < tx_ - 0.06)]
            cz_w = float((wr[:, 2].min() + wr[:, 2].max()) / 2) if len(wr) else float(sv[:, 2].mean())
            gw, bw = checkering(x, z, Nn, tx_ - 0.085, cz_w, 0.032, 0.011)
            fx0, fx1 = float(fore[:, 0].min()), float(fore[:, 0].max())
            gf, bf = checkering(x, z, Nn, (fx0 + fx1) / 2 + 0.01, float((fore[:, 2].min() + fore[:, 2].max()) / 2), (fx1 - fx0) * 0.30, 0.0075)
            g = np.where(front, gf, gw)
            b = np.where(front, bf, bw)
            cut_ = np.maximum(g, b.astype(float))
            col = col * (1 - 0.35 * cut_)[:, None]
            rough = rough + 0.18 * cut_
            height = height - 0.22 * cut_
            butt = (x < butt_x + 0.0035) & (Nn[:, 0] < -0.6)
            col[butt] = rgb("#161311")
            rough[butt] = 0.42
            height[butt] = -0.03 * (np.abs(np.sin((y[butt] + z[butt]) * math.pi / 0.0016)) < 0.3)
            cv.col[hit] = np.clip(col, 0, 1)
            cv.rough[hit] = np.clip(rough, 0.05, 1)
            cv.metal[hit] = 0.0
            cv.height[hit] = height

    def after_wear(mname, cv):
        """The bores as painted: the wear's scratches and edges belong on the outside."""
        if mname in keep:
            yy, xx = keep[mname]
            cv.col[yy, xx] = rgb("#1b1c1e")
            cv.rough[yy, xx] = 0.22
            cv.metal[yy, xx] = 1.0
        if mname == "steel" and "small" in keep:      # half the wear on the small parts, whose every edge would be worn
            yy, xx, c0, r0, m0 = keep["small"]
            cv.col[yy, xx] = cv.col[yy, xx] * 0.55 + c0 * 0.45
            cv.rough[yy, xx] = cv.rough[yy, xx] * 0.55 + r0 * 0.45
            cv.metal[yy, xx] = cv.metal[yy, xx] * 0.55 + m0 * 0.45

    keep = {}
    th.paint = lambda fr: None
    th.texel_paint = texel_paint
    th.after_wear = after_wear
    return th


def _shell(spec, th):
    seed = int(spec.get("seed", 0))
    spent = bool(spec.get("spent", False))
    hb = float(spec.get("brass_mm", 16)) * 0.001
    th.material("brass", "metal", px=int(spec.get("tex", 512)), color="#c9a25e", rough=0.28, metal=1.0)
    th.material("hull", "paint", px=int(spec.get("tex", 512)), color=spec.get("hull", "#a3241f"), rough=0.42)
    th.island("head", 2 * math.pi * 11.4, hb * 1000 + 6, "brass", wrap=True)
    th.island("base", 23, 23, "brass")
    th.island("hull", 2 * math.pi * 10.3, (0.070 - hb) * 1000 + 6, "hull", wrap=True)
    th.island("crimp", 21, 21, "hull")
    th.pack()
    I = th.islands
    mats = ["brass", "hull"]

    def build(hi):
        n = 36 if hi else 18
        st = 0.0006 if hi else 0.002
        base = M.Seg([(0.0, 0.0), (0.0040, 0.0), (0.0041, 0.0003), (0.0108, 0.0002), (0.01135, 0.0004)], "base", "bottom", disc=0.0114)
        head = M.Seg([(0.01135, 0.0004), (0.01135, 0.0014), (0.0102, 0.0016), (0.0102, 0.0026), (0.0105, 0.0030), (0.0105, hb)], "head", "band")
        if spent:
            # the crimp opened: the mouth flared a little, its lip, the hull's inside down to the wad's seat, dark
            hull = M.Seg([(0.0103, hb), (0.0103, 0.0690), (0.0106, 0.0702), (0.0098, 0.0705), (0.0094, 0.0690), (0.0094, 0.026),
                          (0.0, 0.026)], "hull", "band")
            segs = [base, head, hull]
        else:
            hull = M.Seg([(0.0103, hb), (0.0103, 0.0630), (0.0100, 0.0646), (0.0092, 0.0652)], "hull", "band")
            crimp = M.Seg([(0.0092, 0.0652), (0.0040, 0.0640), (0.0, 0.0636)], "crimp", "top", disc=0.0095)
            segs = [base, head, hull, crimp]
        return M.lathe(segs, n, I, step=st, mats=mats)

    th.low = build(False)
    th.high = build(True)
    th.sockets = {"front": ((0.0, 0.0, 0.066), (0.0, 0.0, 1.0)), "back": ((0.0, 0.0, 0.0), (0.0, 0.0, -1.0))}
    th.extras["weapon"] = {"kind": "shell", "gauge": 12, "spent": spent, "length_m": 0.0705 if spent else 0.0652}
    th.pose = "stand"
    th.view = {"azim": -30, "elev": 20}
    th.reach = 0.002
    th.cage = 0.001

    def paint(fr):
        FN.metal(fr["head"], "satin", "brass", seed, along=90.0, age="tarnish" if spent else None, age_amount=0.3)
        f = fr["base"]
        FN.metal(f, "satin", "brass", seed + 1)
        f.ellipse(f.W / 2, f.H / 2, 3.6, color="#b07a4a", rough=0.3, metal=1.0)          # the primer, copper
        if spent:
            f.ellipse(f.W / 2, f.H / 2, 1.2, height=-0.2, add_height=True)                  # the firing pin's dent
        f = fr["hull"]
        X, Y = f.grid()
        g = N.fbm3(np.stack([X / 3.0, Y / 0.2, np.full_like(X, seed * 0.1)], -1), seed + 3, 2)
        f.lay_island(np.ones_like(X), height=(0.004 * g).astype(np.float32), add_height=True)  # the hull's extruded streaks, along it
        if spent:
            m = (Y > f.H * 0.86).astype(np.float32)                                          # the inside, dark
            f.lay_island(m, color="#160c0a", rough=0.8)
        else:
            f = fr["crimp"]
            X, Y = f.grid()
            a = np.arctan2(Y - f.H / 2, X - f.W / 2)
            rr = np.hypot(X - f.W / 2, Y - f.H / 2)
            fold = np.abs(np.sin(3 * a)) ** 8 * np.clip(rr / 9.0, 0, 1)                       # the six folds of the star
            f.lay_island(np.clip(fold, 0, 1).astype(np.float32), height=-0.12, add_height=True, color="#5a1410")

    th.paint = paint
    return th


def make(spec, th):
    kind = spec.get("kind", "shotgun")
    return _shell(spec, th) if kind == "shell" else _double(spec, th) if kind == "double" else _shotgun(spec, th)
