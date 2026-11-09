"""Firearms for the first-person weapon system (DECISIONS 2026-11-09, the user's `weapon-system`): a pump-action
12-gauge shotgun at a riot gun's real sizes and the shells it takes.

The shotgun: a receiver 200 mm long, an 18.5" (470 mm) barrel with its bore and a bead at the muzzle, the magazine
tube under it holding four (its cap and the band that ties it to the barrel), the pump (the fore-end, grooved, on
its 90 mm track, with the action bars that run into the receiver), the trigger in its guard, a stock with a rubber
pad. The pump is a part that slides (PROPGEN §26), the bolt's face a part there only while the action is shut (the
ejection port dark behind it when it's racked open), the trigger a part on its hinge. Sockets: `muzzle`, `eject`
(the ejection port, the right side), `port` (the loading port underneath), `chamber`, `pump` and `grip` (where the
hands hold it), `trigger`, `shoulder`, `light` (where a flashlight is taped under the barrel).

The shell: a 2 3/4" 12-gauge, its brass head (rim, extractor groove, primer), its plastic hull and the six-point star
crimp closing its front; `spent` opens the crimp into a mouth, its inside dark, the brass a little scorched.

    {"family": "weapon", "kind": "shotgun", "steel": "#2b2e33", "wood": "#5b3a24", "furniture": "wood" | "synthetic",
     "barrel_mm": 470, "finish": "satin", "age": "rust", "age_amount": 0.15}
    {"family": "weapon", "kind": "shell", "hull": "#a3241f", "brass_mm": 16, "spent": false}
"""
import math

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
    return _shell(spec, th) if spec.get("kind", "shotgun") == "shell" else _shotgun(spec, th)
