"""Shrine things. A hokora (a little wayside shrine: a wooden box on a stone footing, a gabled copper roof gone green,
double doors with their lattice, `sealed` with an ofuda pasted across them), a sanbō (the plain hinoki offering stand:
its tray with cut corners on a base pierced on three sides, salt or rice on a clay dish), an orin (the brass bowl struck
at a butsudan, on its brocade cushion, its striker beside it), a kōro (a bronze incense burner on three feet, its ash
with sticks burning down in it: `socket_tip_1`... where their smoke starts) and an an (the eight-legged offering table).
Hard surfaces: their bevels are real and their normals weighted, so they shade like solid things on few faces.

    {"family": "shrine", "kind": "hokora" | "sanbo" | "orin" | "koro" | "an", "sealed": true, "roof": "copper" | "wood",
     "offering": "salt" | "rice" | "none", "sticks": 3, "cushion": "#6a1f5a", "wood": "#d9bc8c"}
"""
import math

import numpy as np

from .. import designs
from .. import finish as FN
from .. import mesh as M
from .. import noise as N

MM = 0.001


def _wood(fr, names, color, seed, ring=2.4, rough=0.55):
    for nm in names:
        if nm in fr:
            designs.wood_grain(fr[nm], {"color": color, "ring": ring}, N.rng(seed, nm))
            fr[nm].fill(color=color, rough=rough, alpha=0.25)


def hokora(spec, th):
    seed = int(spec.get("seed", 0))
    wood = spec.get("wood", "#8a6a48")
    roof = spec.get("roof", "copper")
    th.material("main", "weathered", color=wood, rough=0.7)
    th.material("stone", "stone", color="#8d8a82", rough=0.9, px=512)
    th.material("roof", "metal" if roof == "copper" else "weathered", color="#5f9a84" if roof == "copper" else "#6a5a48", rough=0.6, px=1024)
    W, D, H = 300.0, 250.0, 270.0
    BW, BD, BH = 440.0, 380.0, 90.0
    pitch, over = 30.0, 70.0
    ridge_z = BH + H + (D / 2 + 6) * math.tan(math.radians(pitch))
    slope = (D / 2 + over) / math.cos(math.radians(pitch))
    RW = W + 2 * over + 40
    th.island("st_top", BW, BD, mat="stone")
    th.island("st_bot", BW * 0.5, BD * 0.5, mat="stone")
    th.island("st_side", 2 * (BW + BD), BH + 10, mat="stone", wrap=True)
    th.island("body_top", W, D)
    th.island("body_bot", W * 0.5, D * 0.5)
    th.island("body_side", 2 * (W + D), H + 10, wrap=True)
    th.island("door", 128, 206)
    th.island("door_back", 64, 103)
    th.island("door_edge", 640, 14, wrap=True)
    th.island("sill_top", W + 40, D + 40)
    th.island("sill_bot", (W + 40) * 0.4, (D + 40) * 0.4)
    th.island("sill_side", 2 * (W + 70), 30, wrap=True)
    for k in ("f", "b"):
        th.island(f"roof_{k}", RW, slope, mat="roof")
        th.island(f"roof_{k}_under", RW, slope, mat="roof")
        th.island(f"roof_{k}_edge", 2 * (RW + slope), 24, mat="roof", wrap=True)
    th.island("ridge_top", RW, 40, mat="roof")
    th.island("ridge_bot", RW * 0.5, 20, mat="roof")
    th.island("ridge_side", 2 * (RW + 40), 40, mat="roof", wrap=True)
    th.island("gable", 2 * (D + 2 * over), 120)
    th.island("logs", 2 * math.pi * 14, 140, mat="roof", wrap=True)
    sealed = spec.get("sealed", False)
    if sealed:
        th.material("paper", "paper", color="#efe8d6", rough=0.85, px=512)
        th.island("seal", 46, 230, mat="paper")
        th.island("seal_back", 46, 230, mat="paper")
    th.pack()
    I = th.islands
    parts = [M.rbox((BW * MM, BD * MM, BH * MM), 8 * MM, I, "st_top", "st_bot", "st_side", fill=60 * MM, step=30 * MM, mat="stone"),
             M.rbox((W * MM, D * MM, H * MM), 6 * MM, I, "body_top", "body_bot", "body_side", at=(0, 0, BH * MM), fill=50 * MM, step=40 * MM),
             M.rbox(((W + 40) * MM, (D + 40) * MM, 22 * MM), 5 * MM, I, "sill_top", "sill_bot", "sill_side", at=(0, 0, BH * MM), fill=60 * MM)]
    # the doors: two leaves standing a little proud of the front, their lattice painted in relief
    for sx in (-1, 1):
        dr = M.rbox((128 * MM, 206 * MM, 10 * MM), 2.5 * MM, I, "door", "door_back", "door_edge", at=(0, 0, -5 * MM), fill=30 * MM)
        # made lying, its front up: stood up facing -y, a little proud of the front
        M.turn(dr, M.rot("x", 90), move=(sx * 66 * MM, (-D / 2 - 3) * MM, (BH + 30 + 103) * MM))
        parts.append(dr)
    # the gabled roof: two planes meeting over the ridge, a slight upward sweep (sori) at the eaves
    for k, sy in (("f", -1), ("b", 1)):
        rf = M.rbox((RW * MM, slope * MM, 18 * MM), 4 * MM, I, f"roof_{k}", f"roof_{k}_under", f"roof_{k}_edge", fill=45 * MM, step=40 * MM, mat="roof")
        u = (rf.v[:, 1] / MM + slope / 2) / slope                      # 0 at the ridge, 1 at the eave
        if sy < 0:
            u = 1 - u
        ub = (D / 2 + 8) / math.cos(math.radians(pitch)) / slope       # past the body's edge the eave sweeps up
        rf.v[:, 2] += (np.clip((u - ub) / (1 - ub), 0, 1) ** 2 * 26) * MM
        rf.v[:, 1] += (sy * slope / 2) * MM
        M.turn(rf, M.rot("x", -sy * pitch), about=(0, 0, 0), move=(0, 0, ridge_z * MM))
        parts.append(rf)
    parts.append(M.rbox((RW * MM, 40 * MM, 34 * MM), 8 * MM, I, "ridge_top", "ridge_bot", "ridge_side", at=(0, 0, (ridge_z - 8) * MM), fill=50 * MM,
                        mat="roof"))
    for xk in (-110, 0, 110):
        lg = M.tube(np.array([(xk, -70, ridge_z + 36), (xk, 70, ridge_z + 36)]) * MM, 13 * MM, I["logs"], n=16, caps=(True, True), cap_bulge=0.08)
        parts.append(lg)
    # the gables: the triangle under each end of the roof, boarded
    for sx in (-1, 1):
        x = sx * (W / 2 + 1)
        top = ridge_z - 6
        tri = np.array([(-D / 2 - 10, BH + H), (D / 2 + 10, BH + H), (0, top)])
        g = M.extrude([tri], 8, I["gable"])
        g.v = np.stack([np.full(len(g.v), x) + g.v[:, 2] * sx, g.v[:, 0], g.v[:, 1]], 1) * MM
        if sx < 0:
            M.flip(g)
        g.a["rest"] = g.v.copy()
        parts.append(g)
    if sealed:
        sl = M.sheet(0.046, 0.23, 0.01, I, front="seal", back="seal_back", thick=0.0002, mats=["paper"])
        v = sl.v.copy()
        a = math.radians(spec.get("seal_angle", -8))
        x2, z2 = v[:, 0] * math.cos(a) - v[:, 1] * math.sin(a), v[:, 0] * math.sin(a) + v[:, 1] * math.cos(a)
        sl.v = np.stack([x2, -v[:, 2] + (-D / 2 - 8.6) * MM, z2 + (BH + 140) * MM], 1)
        sl.a["rest"] = sl.v.copy()
        parts.append(sl)
    th.low = M.join(parts, ["main", "stone", "roof"] + (["paper"] if sealed else []))
    th.high = None
    th.weighted = 48
    th.pose = "stand"
    th.view = {"azim": -28, "elev": 18}

    def paint(fr):
        _wood(fr, ["body_top", "body_bot", "body_side", "sill_top", "sill_side", "door_edge", "gable"], wood, seed, rough=0.75)
        f = fr["door"]
        designs.wood_grain(f, {"color": wood, "ring": 2.0}, N.rng(seed, "door"))
        ink = dict(color=designs.P.mix(designs.P.rgb(wood), "#000000", 0.45), rough=0.8, height=0.6)
        for x in np.linspace(14, f.W - 14, 7):
            f.rect(x - 2.2, 14, 4.4, f.H - 28, **ink)
        for y in np.linspace(14, f.H - 14, 9):
            f.rect(10, y - 2.0, f.W - 20, 4.0, **ink)
        f.line([(6, 6), (f.W - 6, 6), (f.W - 6, f.H - 6), (6, f.H - 6)], 5, closed=True, color=designs.P.mix(designs.P.rgb(wood), "#000000", 0.2),
               rough=0.7, height=0.4)
        for y in (30, f.H - 30):
            f.rect(f.W - 24, y - 6, 22, 12, r=2, color="#3a3632", rough=0.5, metal=0.8, height=0.5)
        for nm in ("st_top", "st_bot", "st_side"):
            f = fr[nm]
            X, Y = f.grid()
            g = N.fbm3(np.stack([X / 30, Y / 30, np.full_like(X, 1.3)], -1), seed + 3, 4)
            grain = N.fbm3(np.stack([X / 1.5, Y / 1.5, np.full_like(X, 4.4)], -1), seed + 4, 3)
            c = designs.P.rgb("#8d8a82")[None, None] * (1 + 0.14 * g[..., None] + 0.08 * grain[..., None])
            f.lay_island(np.ones_like(X), color=np.clip(c, 0, 1).astype(np.float32), rough=0.92, height=(0.25 * grain + 0.6 * g).astype(np.float32))
        roofs = [n for n in fr if n.startswith("roof_") or n.startswith("ridge_") or n == "logs"]
        for nm in roofs:
            f = fr[nm]
            if roof == "copper":
                X, Y = f.grid()
                g = N.fbm3(np.stack([X / 25, Y / 25, np.full_like(X, 2.2)], -1), seed + 5, 4) * 0.5 + 0.5
                streak = N.fbm3(np.stack([X / 6, Y / 60, np.full_like(X, 5.5)], -1), seed + 6, 3) * 0.5 + 0.5
                verd = designs.P.rgb("#5f9a84")[None, None] * (0.85 + 0.3 * g[..., None])
                dark = designs.P.rgb("#3b4a3c")[None, None]
                t = np.clip(streak * 0.7, 0, 1)[..., None] * 0.5
                col = verd * (1 - t) + dark * t
                brown = (N.smoothstep(0.7, 0.85, g) * 0.55)[..., None]
                col = col * (1 - brown) + designs.P.rgb("#6b4a2a")[None, None] * brown
                f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.62, metal=0.25,
                             height=(0.05 * g).astype(np.float32))
                if nm.startswith("roof_") and not nm.endswith("edge") and not nm.endswith("under"):
                    f.stripes(18, 0.08, angle=0, height=0.8, color=designs.P.rgb("#4c7a68"), rough=0.6)
            else:
                designs.wood_grain(f, {"color": "#6a5a48", "ring": 1.4}, N.rng(seed, nm))
                f.stripes(12, 0.1, angle=90, height=-0.5, add_height=True)
        if "seal" in fr:
            designs.draw(fr["seal"], {"design": "ofuda", "text": spec.get("seal_text", "封"), "side": ["急急如律令", "悪霊退散"], "seal": "封印", "seal2": "",
                                      "age_tint": "#c9a85e", "paper": "#e8dcb8"}, seed + 7)
            designs.paper_base(fr["seal_back"], "#e8dcb8", fibres=1.6, seed=seed)

    th.paint = paint
    return th


def _eye(w, h, cx, cy, n=36):
    """The kurikata: a sanbō's eye-shaped piercing, pointed at both ends (clockwise, as a hole)."""
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x = w / 2 * np.cos(t)
    y = h / 2 * np.sin(t) * (1 - 0.35 * np.cos(t) ** 2)
    return np.stack([cx + x, cy - y], 1)


def sanbo(spec, th):
    seed = int(spec.get("seed", 0))
    wood = spec.get("wood", "#e2c89a")
    th.material("main", "wood", color=wood, rough=0.6)
    T, Bw, Bh = 240.0, 168.0, 140.0
    cut = 26.0
    oct_ = np.array([(-T / 2 + cut, -T / 2), (T / 2 - cut, -T / 2), (T / 2, -T / 2 + cut), (T / 2, T / 2 - cut), (T / 2 - cut, T / 2), (-T / 2 + cut, T / 2),
                     (-T / 2, T / 2 - cut), (-T / 2, -T / 2 + cut)])
    th.island("tray_top", T, T)
    th.island("tray_bot", T * 0.6, T * 0.6)
    th.island("tray_edge", 4 * T, 10, wrap=True)
    th.island("rim", 4 * T, 52, wrap=True)
    for i in range(4):
        th.island(f"w{i}_out", Bw, Bh)
        th.island(f"w{i}_in", Bw * 0.6, Bh * 0.6)
        th.island(f"w{i}_edge", 2 * (Bw + Bh), 8, wrap=True)
    th.island("eye", 260, 8, wrap=True)
    off = spec.get("offering", "salt")
    if off != "none":
        th.material("clay", "paint", color="#c49a72", rough=0.85, px=512)
        th.island("dish", 2 * math.pi * 50, 30, mat="clay", wrap=True)
        th.island("dish_bot", 70, 70, mat="clay")
        th.island("mound", 2 * math.pi * 34, 60, mat="clay", wrap=True)
    th.pack()
    I = th.islands
    parts = []
    z0 = Bh
    parts.append(M.slab([oct_ * MM], 7 * MM, 1.6 * MM, I, "tray_top", "tray_bot", "tray_edge", steps=3, fill=40 * MM))
    parts[-1].v[:, 2] += (z0 + 3.5) * MM
    rim_prof = [(0, 0), (0, 21), (-0.8, 22.5), (-3.4, 22.5), (-4.2, 21), (-4.2, 6.5)]
    rim = M.loft([oct_ * MM], [M.Seg(np.array(rim_prof) * MM, "rim", "band")], I)
    rim.v[:, 2] += (z0 + 0.5) * MM
    parts.append(rim)
    # the base: four boards, pierced on three sides (not the back), standing round a square
    for i, ang in enumerate((0, 90, 180, 270)):
        holes = [_eye(92, 36, 0, Bh * 0.52)] if ang != 180 else []
        out = np.array([(-Bw / 2, 0), (Bw / 2, 0), (Bw / 2, Bh), (-Bw / 2, Bh)])
        wb = M.slab([M.resample_loop(out, 12) * MM] + [h * MM for h in holes], 6 * MM, 1.2 * MM, I, f"w{i}_out", f"w{i}_in", f"w{i}_edge",
                    hole_edge="eye", steps=2, fill=24 * MM)
        # lying in x, y with its outside up: stand it up facing out (-y), then turn it round the middle
        M.turn(wb, M.rot("x", 90), move=(0, -(Bw / 2 - 3) * MM, 0))
        M.turn(wb, M.rot("z", ang))
        parts.append(wb)
    tip = None
    if off != "none":
        dish = [(0, 0), (22, 0), (24, 1.2), (36, 6), (48, 13), (50, 14.5), (48.6, 15), (36, 8.5), (24, 4.2), (0, 3.8)]
        dm = M.lathe([M.Seg(np.array(dish[:2]) * MM, "dish_bot", "bottom", disc=24 * MM), M.Seg(np.array(dish[1:]) * MM, "dish", "band")], 40, I,
                     step=0.004, mats=["clay"])
        dm.v[:, 2] += (z0 + 7) * MM
        parts.append(dm)
        hgt = 38 if off == "salt" else 22
        mound = [(34, 0), (30, hgt * 0.35), (22, hgt * 0.7), (12, hgt * 0.92), (4, hgt), (0, hgt)] if off == "salt" else \
            [(36, 0), (32, hgt * 0.5), (22, hgt * 0.85), (10, hgt), (0, hgt + 1)]
        mm_ = M.lathe([M.Seg(np.array(mound) * MM, "mound", "band")], 32, I, step=0.004, mats=["clay"])
        mm_.v[:, 2] += (z0 + 7 + 4.0) * MM
        mm_.a["rest"] = mm_.v.copy()
        parts.append(mm_)
    th.low = M.join(parts, ["main"] + (["clay"] if off != "none" else []))
    th.high = None
    th.weighted = 48
    th.pose = "stand"
    th.view = {"azim": -24, "elev": 26}

    def paint(fr):
        _wood(fr, [n for n in fr if n not in ("dish", "dish_bot", "mound")], wood, seed, ring=1.8, rough=0.6)
        if "dish" in fr:
            for nm in ("dish", "dish_bot"):
                f = fr[nm]
                X, Y = f.grid()
                g = N.fbm3(np.stack([X / 3, Y / 3, np.full_like(X, 2.0)], -1), seed + 8, 3)
                f.lay_island(np.ones_like(X), color=np.clip(designs.P.rgb("#c49a72")[None, None] * (1 + 0.1 * g[..., None]), 0, 1).astype(np.float32),
                             rough=0.9, height=(0.05 * g).astype(np.float32))
            f = fr["mound"]
            X, Y = f.grid()
            if off == "salt":
                g = N.fbm3(np.stack([X / 0.5, Y / 0.5, np.full_like(X, 3.0)], -1), seed + 9, 2)
                f.lay_island(np.ones_like(X), color=np.clip(np.full(X.shape + (3,), 0.93) + 0.05 * g[..., None], 0, 1).astype(np.float32), rough=0.7,
                             height=(0.12 * g).astype(np.float32))
            else:
                f.fill(color="#f1ede2", rough=0.55)
                rng = N.rng(seed, "rice")
                for _ in range(int(f.W * f.H / 9)):
                    f.ellipse(rng.uniform(0, f.W), rng.uniform(0, f.H), 2.6, 1.2, rot=rng.uniform(0, 180), color="#fbf9f2", rough=0.45, height=0.35,
                              alpha=0.9)

    th.paint = paint
    return th


def orin(spec, th):
    seed = int(spec.get("seed", 0))
    brass = spec.get("metal", "#c9a25e")
    th.material("main", "metal", color=brass, rough=0.2, metal=1.0)
    th.material("cloth", "fabric", color=spec.get("cushion", "#6a1f5a"), rough=0.6)
    th.material("stick", "wood", color="#2a1a12", rough=0.4, px=256)
    out = [(0, 0), (20, 0), (30, 3), (40, 14), (45, 30), (46.5, 46), (46.6, 55), (46.2, 57.5), (45, 58), (43.6, 57.4)]
    inn = [(43.6, 57.4), (43.4, 54), (41.8, 40), (36.5, 22), (24, 8.6), (0, 7.2)]
    th.island("b_bot", 40, 40)
    th.island("b_out", 2 * math.pi * 47, M.arclen(out[1:]))
    th.island("b_in", 2 * math.pi * 44, M.arclen(inn))
    C, Hc = 130.0, 26.0
    th.island("c_top", C, C, mat="cloth")
    th.island("c_bot", C, C, mat="cloth")
    th.island("c_edge", 4 * C, Hc + 14, mat="cloth", wrap=True)
    th.island("tassel", 2 * math.pi * 5, 40, mat="cloth", wrap=True)
    th.island("stick", 2 * math.pi * 5, 150, mat="stick", wrap=True)
    th.island("wrap", 2 * math.pi * 7, 40, mat="cloth", wrap=True)
    th.pack()
    I = th.islands
    cush = M.rbox((C * MM, C * MM, 10 * MM), 4.5 * MM, I, "c_top", "c_bot", "c_edge", fill=8 * MM, step=3 * MM, mat="cloth")
    p2 = cush.v[:, :2] / MM
    d = np.minimum(C / 2 - np.abs(p2[:, 0]), C / 2 - np.abs(p2[:, 1]))
    top = cush.v[:, 2] > 5 * MM
    puff = (Hc - 10) * np.clip(d / 26, 0, 1) ** 0.6
    rr = np.hypot(p2[:, 0], p2[:, 1])
    dip = 7.0 * np.exp(-(rr / 34) ** 2)
    cush.v[:, 2] = np.where(top, cush.v[:, 2] + (puff - dip) * MM, cush.v[:, 2])
    cush.a["rest"] = cush.v.copy()
    parts = [cush]
    for sx in (-1, 1):
        for sy in (-1, 1):
            c = np.array([sx * (C / 2 - 3), sy * (C / 2 - 3), 6])
            path = np.array([c, c + (sx * 6, sy * 6, -2), c + (sx * 9, sy * 9, -4.5)])
            parts.append(M.tube(path * MM, np.array([2.5, 3.6, 4.2]) * MM, I["tassel"], n=10, caps=(True, True), cap_bulge=0.3))
    zc = Hc - 7.0 - 1.0
    bowl = M.lathe([M.Seg(np.array(out[:2]) * MM, "b_bot", "bottom", disc=20 * MM), M.Seg(np.array(out[1:]) * MM, "b_out", "band"),
                    M.Seg(np.array(inn) * MM, "b_in", "band")], 64, I, step=0.003, mats=["main"])
    bowl.v[:, 2] += zc * MM
    bowl.a["rest"] = bowl.v.copy()
    parts.append(bowl)
    a = math.radians(-12)
    s0 = np.array([-75, -C / 2 - 16, 4.4])
    dirv = np.array([math.cos(a), math.sin(a), 0.0])
    st = s0 + dirv[None] * np.linspace(0, 150, 6)[:, None]
    parts.append(M.tube(st * MM, 4.4 * MM, I["stick"], n=12, caps=(True, True), cap_bulge=0.4))
    wp = s0 + dirv[None] * np.linspace(112, 152, 5)[:, None] + (0, 0, 2.2)
    parts.append(M.tube(wp * MM, 6.6 * MM, I["wrap"], n=14, caps=(True, True), cap_bulge=0.5))
    th.low = M.join(parts, ["main", "cloth", "stick"])
    th.high = None
    th.weighted = 55
    th.pose = "stand"
    th.view = {"azim": -22, "elev": 30}
    th.sockets["strike"] = (np.array([46.5, 0, zc + 50]) * MM, (1, 0, 0))

    def paint(fr):
        FN.metal(fr["b_out"], "satin", brass, seed + 1, age="tarnish", age_amount=0.35)
        FN.metal(fr["b_in"], "polished", brass, seed + 2)
        FN.metal(fr["b_bot"], "cast", brass, seed + 3)
        f = fr["b_out"]
        for y in (f.H - 6, f.H - 9):
            f.rect(0, y, f.W, 0.6, color=designs.P.rgb(brass) * 0.7, rough=0.3, metal=1.0, height=-0.05, add_height=True)
        col = spec.get("cushion", "#6a1f5a")
        for nm, part in (("c_top", "plain"), ("c_bot", "plain"), ("c_edge", "plain"), ("tassel", "plain"), ("wrap", "plain")):
            designs.draw(fr[nm], {"design": "brocade", "color": col, "pattern": "kikko" if nm != "tassel" else "dots", "scale": 6.0, "part": part}, seed)
        f = fr["stick"]
        f.fill(color="#2a1a12", rough=0.3)
        f.stripes(6, 0.5, angle=0, height=0.01)

    th.paint = paint
    return th


def koro(spec, th):
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "koro")
    bronze = spec.get("metal", "#7a5a32")
    th.material("main", "metal", color=bronze, rough=0.4, metal=1.0)
    th.material("ash", "paper", color="#b9b4aa", rough=0.95, px=512)
    out = [(0, 12), (24, 12), (34, 13.5), (44, 19), (51, 28), (54, 38), (54.5, 46), (56.5, 50), (57, 52.5), (55.6, 53.5), (53.4, 52.5), (52.4, 48)]
    th.island("bowl", 2 * math.pi * 57, M.arclen(out))
    th.island("bowl_bot", 50, 50)
    th.island("feet", 2 * math.pi * 7, 24, wrap=True)
    th.island("ears", 2 * math.pi * 3.5, 60, wrap=True)
    th.island("ash", 106, 106, mat="ash")
    n = int(spec.get("sticks", 3))
    for i in range(n):
        th.island(f"stick{i}", 2 * math.pi * 1.1, 140, mat="ash", wrap=True)
    th.island("crumbs", 30, 30, mat="ash")
    th.pack()
    I = th.islands
    bowl = M.lathe([M.Seg(np.array(out[:2]) * MM, "bowl_bot", "bottom", disc=24 * MM), M.Seg(np.array(out[1:]) * MM, "bowl", "band"),
                    M.Seg(np.array([(52.4, 48), (51.5, 45), (0, 45.2)]) * MM, "ash", "top", disc=52 * MM, mat="ash")], 64, I, step=0.003, mats=["main", "ash"])
    # the ash a little uneven
    top = bowl.fm == bowl.mats.index("ash")
    vi = np.unique(bowl.f[top][bowl.f[top] >= 0])
    rr = np.hypot(bowl.v[vi, 0], bowl.v[vi, 1]) / MM
    inner = vi[rr < 49]
    bowl.v[inner, 2] += 0.8 * N.fbm3(bowl.v[inner] / 0.012, seed, 3) * MM
    bowl.a["rest"] = bowl.v.copy()
    parts = [bowl]
    for k in range(3):
        a = math.radians(90 + 120 * k)
        c = np.array([math.cos(a) * 34, math.sin(a) * 34])
        path = np.array([(c[0], c[1], 14), (c[0] * 1.05, c[1] * 1.05, 7), (c[0] * 1.12, c[1] * 1.12, 0)])
        parts.append(M.tube(path * MM, np.array([7.0, 5.2, 5.8]) * MM, I["feet"], n=12, caps=(False, True), cap_bulge=0.12))
    for sx in (-1, 1):
        ring = M.ring_path((sx * 58, 0, 44), (0, 1, 0), 9, 20)
        parts.append(M.tube(ring * MM, 3.0 * MM, I["ears"], n=8))
    tips = []
    for i in range(n):
        x, y = (i - (n - 1) / 2) * 15 + r.uniform(-3, 3), r.uniform(-12, 12)
        L = r.uniform(40, 120)
        lean = r.uniform(-0.06, 0.06, 2)
        p0 = np.array([x, y, 34.0])
        p1 = np.array([x + lean[0] * L, y + lean[1] * L, 45 + L])
        path = p0[None] + (p1 - p0)[None] * np.linspace(0, 1, 4)[:, None]
        parts.append(M.tube(path * MM, 1.05 * MM, I[f"stick{i}"], n=6, caps=(False, True), cap_bulge=0.8))
        tips.append(p1 + (p1 - p0) / np.linalg.norm(p1 - p0) * 0.9)
    for k in range(int(spec.get("fallen", 4))):
        a = r.uniform(0, 2 * math.pi)
        c = np.array([math.cos(a), math.sin(a)]) * r.uniform(8, 38)
        d = r.uniform(0, math.pi)
        L = r.uniform(4, 14)
        path = np.array([(c[0], c[1], 45.8), (c[0] + math.cos(d) * L, c[1] + math.sin(d) * L, 46.0)])
        parts.append(M.tube(path * MM, 1.0 * MM, I["crumbs"], n=5, caps=(True, True)))
    th.low = M.join(parts, ["main", "ash"])
    th.high = None
    th.weighted = 55
    th.pose = "stand"
    th.view = {"azim": -20, "elev": 36}
    for i, tp in enumerate(tips):
        th.sockets[f"tip_{i + 1}"] = (tp * MM, (0, 0, 1))
    if tips:
        th.sockets["tip"] = (tips[0] * MM, (0, 0, 1))
    stick = spec.get("stick", "#3d5a2c")

    def paint(fr):
        FN.metal(fr["bowl"], "cast", bronze, seed + 1, age="patina", age_amount=float(spec.get("patina", 0.55)))
        FN.metal(fr["bowl_bot"], "cast", bronze, seed + 2, age="patina", age_amount=0.4)
        FN.metal(fr["feet"], "cast", bronze, seed + 3, age="patina", age_amount=0.6)
        FN.metal(fr["ears"], "satin", bronze, seed + 4, age="patina", age_amount=0.4)
        f = fr["ash"]
        X, Y = f.grid()
        g = N.fbm3(np.stack([X / 2.0, Y / 2.0, np.full_like(X, 1.0)], -1), seed + 5, 4)
        burnt = N.smoothstep(0.35, 0.6, N.fbm3(np.stack([X / 7.0, Y / 7.0, np.full_like(X, 3.0)], -1), seed + 6, 3))
        col = designs.P.rgb("#bdb8ae")[None, None] * (1 + 0.12 * g[..., None]) * (1 - 0.35 * burnt[..., None])
        f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.96, height=(0.2 * g).astype(np.float32))
        for i in range(n):
            f = fr[f"stick{i}"]
            f.fill(color=stick, rough=0.85)
            f.stripes(0.8, 0.5, angle=90, height=0.02)
            f.gradient(stick, "#2a2622", angle=90, t0=0.93, t1=0.965, rough=0.9)
            f.gradient("#2a2622", "#c9c4ba", angle=90, t0=0.965, t1=0.99, rough=0.95)
        fr["crumbs"].fill(color="#a8a398", rough=0.95)

    th.paint = paint
    return th


def an(spec, th):
    """The eight-legged offering table: a long top on four legs a side, the legs joined on a foot rail."""
    seed = int(spec.get("seed", 0))
    wood = spec.get("wood", "#dcc396")
    th.material("main", "wood", color=wood, rough=0.55)
    L, Dp, H = float(spec.get("length", 900)), float(spec.get("depth", 360)), float(spec.get("height", 420))
    th.island("top_t", L, Dp)
    th.island("top_b", L * 0.5, Dp * 0.5)
    th.island("top_e", 2 * (L + Dp), 30, wrap=True)
    th.island("leg", 120, H)
    th.island("leg_b", 40, 30)
    th.island("leg_e", 140, 30, wrap=True)
    th.island("rail_t", Dp, 60)
    th.island("rail_b", Dp * 0.5, 30)
    th.island("rail_e", 2 * (Dp + 60), 30, wrap=True)
    th.island("apron", 2 * (L + Dp), 50, wrap=True)
    th.island("apron_t", L * 0.4, Dp * 0.4)
    th.island("apron_b", L * 0.4, Dp * 0.4)
    th.pack()
    I = th.islands
    parts = [M.rbox((L * MM, Dp * MM, 26 * MM), 4 * MM, I, "top_t", "top_b", "top_e", at=(0, 0, (H - 26) * MM), fill=90 * MM),
             M.rbox(((L - 60) * MM, (Dp - 60) * MM, 40 * MM), 3 * MM, I, "apron_t", "apron_b", "apron", at=(0, 0, (H - 66) * MM))]
    for sx in (-1, 1):
        x = sx * (L / 2 - 70)
        parts.append(M.rbox((50 * MM, (Dp - 30) * MM, 34 * MM), 4 * MM, I, "rail_t", "rail_b", "rail_e", at=(x * MM, 0, 0), fill=60 * MM))
        for yk in np.linspace(-(Dp / 2 - 40), Dp / 2 - 40, 4):
            leg = M.rbox((26 * MM, 18 * MM, (H - 26 - 30) * MM), 3 * MM, I, "leg_b", "leg_b", "leg", at=(x * MM, yk * MM, 30 * MM), step=60 * MM)
            parts.append(leg)
    th.low = M.join(parts, ["main"])
    th.high = None
    th.weighted = 48
    th.pose = "stand"
    th.view = {"azim": -30, "elev": 24}

    def paint(fr):
        _wood(fr, list(fr), wood, seed, ring=2.0, rough=0.55)

    th.paint = paint
    return th


def make(spec, th):
    return {"hokora": hokora, "sanbo": sanbo, "orin": orin, "koro": koro, "an": an}[spec.get("kind", "hokora")](spec, th)
