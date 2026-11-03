"""Sinks. A kitchen sink: one pressed sheet of stainless steel, its deck rolled down at the edge, a basin with rounded
corners and a floor falling to the drain, a ribbed drainboard beside it, a basket strainer, a gooseneck mixer tap; water
spots, a ring of grime and rust round the drain. A washbasin: glazed white fireclay, a deep oval bowl in a deck with two
pillar taps (hot and cold), a chrome drain and bottle trap; crazing in the glaze, limescale and rust streaks under the
taps. Either can hold standing water (a liquid: Godot's shader keeps it level). Sockets: spout (where the tap's water
comes out, pointing down), handle, drain.

    {"family": "sink", "kind": "kitchen" | "basin", "liquid": {"kind": "water", "fill": 0.4}, "rust": 0.4,
     "limescale": 0.5, "glaze": "#f4f3ef"}
"""
import math

import numpy as np

from .. import designs
from .. import finish as FN
from .. import mesh as M
from .. import noise as N

MM = 0.001


def _liquid(wall_rings, islands, island, kind, fill, color, seed):
    """Standing water in a basin: its inside (the wall's rings from the top down to the drain, a little in from the
    wall) closed top and bottom as the shader needs, and the points under each level for its fill table."""
    from .. import liquid as LQ
    W = np.asarray(wall_rings, float)
    c = W.mean(1, keepdims=True)
    inset = c + (W - c) * 0.985
    rings = list(inset)
    top_c = rings[0].mean(0)
    bot_c = rings[-1].mean(0)
    k, n = len(rings), len(rings[0])
    v = np.concatenate(rings + [top_c[None], bot_c[None]])
    f = []
    jj = np.arange(n)
    j1 = (jj + 1) % n
    for i in range(k - 1):
        f.append(np.stack([i * n + j1, i * n + jj, (i + 1) * n + jj, (i + 1) * n + j1], 1))
    t, b = k * n, k * n + 1
    f.append(np.stack([jj, j1, np.full(n, t), np.full(n, -1)], 1))
    f.append(np.stack([(k - 1) * n + j1, (k - 1) * n + jj, np.full(n, b), np.full(n, -1)], 1))
    f = np.concatenate(f)
    uv = np.tile(islands[island].to_uv(np.array([0.5]), np.array([0.5])).reshape(1, 1, 2), (len(f), 4, 1))
    m = M.Mesh(v * MM, f, uv, mats=["liquid"])
    m.a["rest"] = m.v.copy()
    # points inside: between each pair of rings, inside the ring at their middle height
    r = N.rng(seed, "basin_pts")
    lo, hi = v.min(0), v.max(0)
    pts = []
    zs = np.array([rg[:, 2].mean() for rg in rings])
    while sum(len(p) for p in pts) < 24000:
        p = r.uniform(lo, hi, (24000, 3))
        ok = np.zeros(len(p), bool)
        for i in range(k - 1):
            z0, z1 = zs[i + 1], zs[i]
            sel = (p[:, 2] >= min(z0, z1)) & (p[:, 2] < max(z0, z1))
            if sel.any():
                poly = (rings[i][:, :2] + rings[i + 1][:, :2]) / 2
                ok[sel] = M._in_poly(poly, p[sel, :2])
        pts.append(p[ok])
    P = np.concatenate(pts)[:24000] * MM
    return m, LQ.info(kind, fill, P, color)


def tap_pillar(at, hot, I, cap_isl="tap_caps"):
    """A pillar tap (mm): its body standing on the deck, the spout out of its front curving down, a cross head on top
    and its cap, red for hot, blue for cold. Returns the parts and the spout's mouth."""
    x, y, z = at
    body = M.lathe([M.Seg(np.array([(0, 0), (24, 0), (24.5, 2), (22, 5), (16, 9), (15, 60), (17, 64), (17, 70), (13, 73), (0, 73)]) * MM, "tap", "band")],
                   28, I, step=0.008, mats=["chrome"])
    body.v += np.array([x, y, z]) * MM
    body.a["rest"] = body.v.copy()
    sp = M.spline([(x, y - 6, z + 48), (x, y - 40, z + 52), (x, y - 62, z + 42), (x, y - 66, z + 28)], 5)
    spout = M.tube(np.array(sp) * MM, 7.5 * MM, I["tap_spout"], n=14, caps=(False, False))
    parts = [body, spout]
    for ax in ((1, 0), (0, 1)):
        a = np.array([x - ax[0] * 28, y - ax[1] * 28, z + 80])
        b = np.array([x + ax[0] * 28, y + ax[1] * 28, z + 80])
        arm = M.tube(np.stack([a, (a + b) / 2, b]) * MM, np.array([5.5, 4.0, 5.5]) * MM, I["tap"], n=12, caps=(True, True), cap_bulge=0.6)
        arm.mats = ["chrome"]
        parts.append(arm)
    hub = M.lathe([M.Seg(np.array([(0, 0), (9, 0), (10, 4), (9, 10), (6.5, 12), (0, 12.5)]) * MM, cap_isl, "band")], 20, I, step=0.004, mats=["chrome"])
    hub.v += np.array([x, y, z + 72]) * MM
    hub.a["rest"] = hub.v.copy()
    parts.append(hub)
    return parts, np.array(sp[-1]) + (0, 0, -2)


def kitchen(spec, th):
    seed = int(spec.get("seed", 0))
    W, D, Z = 920.0, 520.0, 196.0
    bx, by, bw, bd, bc = -195.0, -14.0, 460.0, 400.0, 52.0
    n = 112
    th.material("main", "steel", color="#c6c9cc", rough=0.28, metal=1.0, double=True)     # one pressed sheet: seen from both sides
    th.material("chrome", "steel", color="#dfe2e5", rough=0.06, metal=1.0, px=512)
    rings = []
    for (ins, z) in ((0, Z - 24), (0, Z - 4), (1.6, Z - 0.8), (4.5, Z)):
        rings.append(M.rrect_ring(0, 0, W - 2 * ins, D - 2 * ins, 16 - ins * 0.5, n, z))
    outer = rings[-1]
    hole = M.rrect_ring(bx, by, bw, bd, bc, n, Z)
    deck0 = len(rings) - 1
    for t in (0.25, 0.5, 0.75, 0.94, 1.0):
        rr = outer * (1 - t) + hole * t
        rr[:, 2] = Z
        rings.append(rr)
    deck1 = len(rings) - 1
    wall = [(1.2, Z - 2.2), (2.4, Z - 9), (8, 46)]
    for k_, a in enumerate(np.radians(np.linspace(15, 90, 6))):
        wall.append((8 + 38 * (1 - math.cos(a)), 38 - 38 * math.sin(a)))
    for ins, z in wall:
        rings.append(M.rrect_ring(bx, by, bw - 2 * ins, bd - 2 * ins, max(bc - ins, 4), n, z))
    wall1 = len(rings) - 1
    floor_rect = rings[-1]
    for t in (0.3, 0.6, 0.85, 1.0):
        rings.append(M.toward(floor_rect, (bx, by), (46, 46), t, z=-4 * t))
    th.island("rim", M.rperim(W, D, 16), 30, wrap=True)
    th.island("deck", W, D)
    th.island("basin", M.rperim(bw, bd, bc), Z + 90, wrap=True)
    th.island("floor", bw, bd)
    th.island("strainer", 110, 110)
    th.island("strainer_side", 2 * math.pi * 56, 40, wrap=True)
    th.island("pipe", 2 * math.pi * 22, 90, wrap=True)
    th.island("tap", 2 * math.pi * 30, 120, mat="chrome", wrap=True)
    th.island("tap_spout", 2 * math.pi * 14, 260, mat="chrome", wrap=True)
    th.island("lever", 60, 20, mat="chrome")
    th.island("lever_e", 140, 12, mat="chrome", wrap=True)
    lq = spec.get("liquid")
    th.pack()
    I = th.islands
    parts = [M.ring_strip(np.array(rings) * MM, [(0, deck0, "rim", "band"), (deck0, deck1, "deck", "plan"), (deck1, wall1, "basin", "band"),
                                             (wall1, len(rings) - 1, "floor", "plan")], I, ["main"])]
    # the basket strainer: its flange in the drain, a shallow perforated cup, the tail pipe under it
    st = M.lathe([M.Seg(np.array([(57, 0.0), (58, 1.6), (54, 3.0)]) * MM, "strainer_side", "band"),
                  M.Seg(np.array([(54, 3.0), (46, 2.2), (44, -8), (40, -12), (0, -12.5)]) * MM, "strainer", "top", disc=56 * MM)], 48, I, step=0.004,
                 mats=["main"])
    st.v += np.array([bx, by, -5.2]) * MM
    st.a["rest"] = st.v.copy()
    parts.append(st)
    pp = M.tube(np.array([(bx, by, -10), (bx, by, -50), (bx, by, -86)]) * MM, 21 * MM, I["pipe"], n=16, caps=(False, True), cap_bulge=0.05)
    parts.append(pp)
    # the mixer: a column on the deck behind the basin, a gooseneck over it, the lever on top
    tx, ty = bx, by + bd / 2 + 34
    base = M.lathe([M.Seg(np.array([(0, 0), (29, 0), (29.5, 2.5), (26, 6), (19, 10), (17, 120), (16.5, 128), (0, 129)]) * MM, "tap", "band")], 36, I,
                   step=0.01, mats=["chrome"])
    base.v += np.array([tx, ty, Z]) * MM
    base.a["rest"] = base.v.copy()
    parts.append(base)
    neck = M.spline([(tx, ty, Z + 110), (tx, ty, Z + 250), (tx, ty - 30, Z + 318), (tx, ty - 110, Z + 330), (tx, ty - 175, Z + 290), (tx, ty - 190, Z + 240)], 8)
    t = np.linspace(0, 1, len(neck))
    parts.append(M.tube(np.array(neck) * MM, np.interp(t, [0, 1], [13.5, 11]) * MM, I["tap_spout"], n=16, caps=(False, False)))
    lv = M.rbox((56 * MM, 14 * MM, 9 * MM), 3.5 * MM, I, "lever", "lever", "lever_e", at=(0, 0, -4.5 * MM), corner=6 * MM, mat="chrome")
    M.turn(lv, M.rot("y", -18), move=((tx + 26) * MM, ty * MM, (Z + 134) * MM))
    parts.append(lv)
    mouth = np.array(neck[-1])
    th.low = M.join(parts, ["main", "chrome"])
    th.high = None
    th.weighted = 46
    th.pose = "stand"
    th.view = {"azim": -28, "elev": 40}
    th.sockets["spout"] = ((mouth + (0, 0, -1)) * MM, (0, 0, -1))
    th.sockets["handle"] = (np.array([tx + 26, ty, Z + 140]) * MM, (0, 0, 1))
    th.sockets["drain"] = (np.array([bx, by, -4]) * MM, (0, 0, -1))
    if lq:
        lq = lq if isinstance(lq, dict) else {"kind": lq}
        wall_rings = [M.rrect_ring(bx, by, bw - 2 * ins, bd - 2 * ins, max(bc - ins, 4), n, z) for ins, z in wall]
        wall_rings.append(M.toward(floor_rect, (bx, by), (46, 46), 1.0, z=-4))
        th.liquid = _liquid(wall_rings, I, "basin", lq.get("kind", "water"), float(lq.get("fill", 0.4)), lq.get("color"), seed)

    def paint(fr):
        for nm in ("rim", "deck", "basin", "floor"):
            FN.metal(fr[nm], "brushed" if nm in ("deck", "rim") else "satin", "steel", seed + len(nm), along=0)
        f = fr["deck"]
        # the drainboard: pressed ribs running to the basin, a channel round them
        x0 = (bx + bw / 2 + 30 + W / 2)
        for k in range(14):
            y = 60 + k * (D - 120) / 13
            f.rect(x0, y - 4, W - x0 - 40, 8, r=4, color="#c0c3c6", rough=0.22, metal=1.0, height=-1.4, add_height=True)
        f.rect(x0 - 12, 44, W - x0 - 16, D - 88, r=18, color="#bfc2c5", rough=0.3, metal=1.0, height=-0.4, add_height=True, alpha=0.6)
        # water spots: dried rings of minerals, thickest in the basin and round the drain
        rng = N.rng(seed, "spots")
        for nm, cnt in (("basin", 260), ("floor", 160), ("deck", 120)):
            f = fr[nm]
            for _ in range(int(cnt * float(spec.get("limescale", 0.6)))):
                cx, cy = rng.uniform(0, f.W), rng.uniform(0, f.H) * (0.45 if nm == "basin" else 1.0)
                r0 = rng.uniform(0.8, 5.0)
                f.ring(cx, cy, r0, rng.uniform(0.2, 0.6), color="#e9ebe8", rough=0.6, metal=0.2, alpha=rng.uniform(0.3, 0.7))
        f = fr["floor"]
        X, Y = f.grid()
        d = np.hypot(X - f.W / 2, Y - f.H / 2)
        g = N.fbm3(np.stack([X / 8, Y / 8, np.full_like(X, 2.0)], -1), seed + 3, 3) * 0.5 + 0.5
        grime = np.clip(1 - (d - 46) / 40, 0, 1) * (0.5 + 0.5 * g)
        f.lay_island((grime * 0.85).astype(np.float32), color="#3a3226", rough=0.8, metal=0.1)
        rust = float(spec.get("rust", 0.4))
        if rust:
            streak = np.clip(1 - (d - 46) / 24, 0, 1) * np.clip(N.fbm3(np.stack([X / 3, Y / 3, np.full_like(X, 5.0)], -1), seed + 4, 3) + 0.3, 0, 1)
            f.lay_island((streak * rust).astype(np.float32), color="#7a3a14", rough=0.85, metal=0.05)
        FN.metal(fr["strainer"], "satin", "steel", seed + 5)
        f = fr["strainer"]
        f.dots(5, 1.1, color="#1a1816", rough=0.9, metal=0.0, height=-0.6, mask=None)
        f.lay_island(np.clip(1 - np.hypot(*np.array(f.grid()) - np.array([f.W / 2, f.H / 2])[:, None, None]) / 30, 0, 1).astype(np.float32) * 0.8,
                     color="#3a3226", rough=0.8)
        FN.metal(fr["strainer_side"], "polished", "steel", seed + 6)
        FN.metal(fr["pipe"], "satin", "steel", seed + 7)
        for nm in ("tap", "tap_spout", "lever", "lever_e"):
            FN.metal(fr[nm], "mirror", "chrome", seed + len(nm))
        f = fr["tap"]
        f.lay_island(np.clip(1 - np.array(f.grid())[1] / 18, 0, 1).astype(np.float32) * float(spec.get("limescale", 0.6)), color="#e4e6e2", rough=0.6,
                     metal=0.2)

    th.paint = paint
    return th


def basin(spec, th):
    seed = int(spec.get("seed", 0))
    W, D, Z = 560.0, 440.0, 184.0
    cx, cy, ea, eb = 0.0, -22.0, 205.0, 148.0
    n = 112
    glaze = spec.get("glaze", "#f4f3ef")
    th.material("main", "paint", color=glaze, rough=0.08)
    th.material("chrome", "steel", color="#dfe2e5", rough=0.06, metal=1.0, px=512)
    rings = [M.rrect_ring(0, 0, (W - 120) * 0.05, (D - 120) * 0.05, 4, n, 22)]
    for ins, z in ((60, 22), (30, 27), (8, 62), (0, 140), (0, 172), (3, 181), (9, Z)):
        rings.append(M.rrect_ring(0, 0, W - 2 * ins, D - 2 * ins, max(40 - ins, 6), n, z))
    out1 = len(rings) - 1
    top = rings[-1]
    for t in (0.35, 0.7, 0.92, 1.0):
        rings.append(M.toward(top, (cx, cy), (ea, eb), t, z=Z))
    deck1 = len(rings) - 1
    rim = rings[-1]
    bowl = [(1.012, Z - 4), (1.0, Z - 10), (0.975, 160), (0.93, 132), (0.85, 104), (0.72, 80), (0.54, 63), (0.34, 54), (0.2, 51)]
    for s_, z in bowl:
        rr = rim.copy()
        rr[:, :2] = (rim[:, :2] - (cx, cy)) * s_ + (cx, cy)
        rr[:, 2] = z
        rings.append(rr)
    bowl1 = len(rings) - 1
    rings.append(M.toward(rings[-1], (cx, cy), (27, 27), 1.0, z=50))
    th.island("outside", M.rperim(W, D, 40), 260, wrap=True)
    th.island("deck", W, D)
    th.island("bowl", 2 * math.pi * 180, 200, wrap=True)
    th.island("drain_top", 70, 70, mat="chrome")
    th.island("trap", 2 * math.pi * 32, 300, mat="chrome", wrap=True)
    th.island("tap", 2 * math.pi * 25, 90, mat="chrome", wrap=True)
    th.island("tap_spout", 2 * math.pi * 8, 90, mat="chrome", wrap=True)
    th.island("tap_hot", 2 * math.pi * 10, 16, mat="chrome", wrap=True)
    th.island("tap_cold", 2 * math.pi * 10, 16, mat="chrome", wrap=True)
    th.pack()
    I = th.islands
    parts = [M.ring_strip(np.array(rings) * MM, [(0, out1, "outside", "band"), (out1, deck1, "deck", "plan"), (deck1, len(rings) - 1, "bowl", "band")], I,
                          ["main"])]
    dr = M.lathe([M.Seg(np.array([(32, 0), (32.5, 1.5), (30, 3), (24, 3.4), (22, -6), (0, -6.5)]) * MM, "drain_top", "top", disc=33 * MM)], 40, I, step=0.004,
                 mats=["chrome"])
    dr.v += np.array([cx, cy, 49]) * MM
    dr.a["rest"] = dr.v.copy()
    parts.append(dr)
    trap = M.spline([(cx, cy, 40), (cx, cy, -30)], 10)
    parts.append(M.tube(np.array(trap) * MM, 16 * MM, I["trap"], n=16))
    bt = M.lathe([M.Seg(np.array([(0, 0), (28, 0), (31, 4), (31, 96), (27, 102), (17, 104), (16, 106)]) * MM, "trap", "band")], 32, I, step=0.01, mats=["chrome"])
    bt.v += np.array([cx, cy, -136]) * MM
    bt.a["rest"] = bt.v.copy()
    parts.append(bt)
    wp = np.array([(cx, cy + 26, -96), (cx, D / 2 + 30, -96)])
    parts.append(M.tube(wp * MM, 16 * MM, I["trap"], n=16, caps=(False, True), cap_bulge=0.05))
    spouts = []
    for sx, hot in ((-1, True), (1, False)):
        ps, mouth = tap_pillar((sx * 92, D / 2 - 46, Z), hot, I, cap_isl="tap_hot" if hot else "tap_cold")
        parts += ps
        spouts.append(mouth)
    th.low = M.join(parts, ["main", "chrome"])
    th.high = None
    th.weighted = 46
    th.pose = "stand"
    th.view = {"azim": -24, "elev": 44}
    th.sockets["spout"] = (spouts[0] * MM, (0, 0, -1))
    th.sockets["spout_cold"] = (spouts[1] * MM, (0, 0, -1))
    th.sockets["handle"] = (np.array([-92, D / 2 - 46, Z + 86]) * MM, (0, 0, 1))
    th.sockets["drain"] = (np.array([cx, cy, 50]) * MM, (0, 0, -1))
    lq = spec.get("liquid")
    if lq:
        lq = lq if isinstance(lq, dict) else {"kind": lq}
        wall_rings = [r for r in rings[deck1 + 1:]]
        th.liquid = _liquid(wall_rings, I, "bowl", lq.get("kind", "water"), float(lq.get("fill", 0.4)), lq.get("color"), seed)

    def paint(fr):
        from .. import noise as Nn
        for nm in ("outside", "deck", "bowl"):
            f = fr[nm]
            f.fill(color=glaze, rough=0.07)
            X, Y = f.grid()
            f1, f2, _ = Nn.cells3(np.stack([X / 9.0, Y / 9.0, np.full_like(X, 1.7)], -1), seed + len(nm))
            craze = designs.N_edge(f2 - f1, 0.05 * 9.0) * float(spec.get("crazing", 0.4))
            f.lay_island((craze * 0.5).astype(np.float32), color=designs.P.mix(designs.P.rgb(glaze), "#5a5042", 0.5), height=-0.004, add_height=True)
        f = fr["deck"]
        # limescale and rust: a crust round each tap's foot, a brown streak from each down the bowl's back
        rust = float(spec.get("rust", 0.45))
        X, Y = f.grid()
        for sx in (-1, 1):
            px, py = W / 2 + sx * 92, D / 2 + (D / 2 - 46)          # the deck maps over the basin's box: (0, 0) its corner
            d = np.hypot(X - px, Y - py)
            crust = np.clip(1 - (d - 24) / 14, 0, 1) * (0.6 + 0.4 * Nn.fbm3(np.stack([X / 2, Y / 2, np.full_like(X, sx)], -1), seed, 2))
            f.lay_island((crust * float(spec.get("limescale", 0.5))).astype(np.float32), color="#d8d2c0", rough=0.7)
            f.lay_island((np.clip(1 - (d - 22) / 6, 0, 1) * rust * 0.8).astype(np.float32), color="#8a4a1c", rough=0.8)
        f = fr["bowl"]
        X, Y = f.grid()
        g = Nn.fbm3(np.stack([X / 3, Y / 30, np.full_like(X, 3.0)], -1), seed + 2, 3) * 0.5 + 0.5
        # the back of the bowl is the band's quarter mark (it starts at +x, anticlockwise: +y a quarter round)
        for k, xb in enumerate((f.W * 0.25 - 26, f.W * 0.25 + 26)):
            streak = np.exp(-((X - xb) / 7) ** 2) * np.clip(1 - Y / (f.H * 0.9), 0, 1) ** 0.5 * g
            f.lay_island((streak * rust).astype(np.float32), color="#8a5424", rough=0.4)
        d = np.clip(Y / f.H, 0, 1)
        f.lay_island((np.clip((d - 0.82) / 0.18, 0, 1) * 0.55).astype(np.float32), color="#5a4a34", rough=0.6)
        f.rect(f.W * 0.25 - 14, f.H * 0.12, 28, 5, r=2.5, color="#141210", rough=0.9, height=-0.8, add_height=True)
        for nm in ("drain_top", "trap", "tap", "tap_spout"):
            FN.metal(fr[nm], "mirror", "chrome", seed + len(nm))
        f = fr["drain_top"]
        for k in range(6):
            f.rect(f.W / 2 - 12, f.H / 2 - 9 + k * 3.6, 24, 1.4, r=0.7, color="#141210", rough=0.9, height=-0.5, add_height=True)
        for nm, c in (("tap_hot", "#c0281e"), ("tap_cold", "#1e4ab8")):
            FN.metal(fr[nm], "mirror", "chrome", seed)
            fr[nm].rect(0, fr[nm].H * 0.7, fr[nm].W, fr[nm].H * 0.35, color=c, rough=0.15, metal=0.1)

    th.paint = paint
    return th


def make(spec, th):
    return basin(spec, th) if spec.get("kind") == "basin" else kitchen(spec, th)
