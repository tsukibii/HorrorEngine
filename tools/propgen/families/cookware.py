"""Pots and pans, turned from their real profiles and finished as their metal or clay is: a stainless saucepan (an
encapsulated base, a rolled rim, a long strap handle riveted on, the heat's rainbow tint round its foot, stirring marks
inside), a stockpot (two loop handles, a lid), a frying pan (black non-stick worn silver where it was scraped, a
bakelite handle), a yukihira (hammered aluminium, a pouring lip each side, a wooden handle), a donabe (a clay pot, its
lid glazed dark with white brushed slip), a tetsubin (cast iron pebbled with arare: the bumps baked from a detailed
mesh onto a plain one) and an enamel pot (white enamel, its rim black, chipped to the steel, a flower on its side).
Each can hold a liquid (Godot's liquid shader keeps it level). Sockets as the kit's pots have them: steam, rim, lid,
handle, vent.

    {"family": "cookware", "kind": "saucepan" | "stockpot" | "frypan" | "yukihira" | "donabe" | "tetsubin" | "enamel",
     "lid": true, "liquid": {"kind": "broth", "fill": 0.6}, "tint": 0.6 (the heat tint), "color": "#f4f2ec" (enamel),
     "decal": true, "coating": "#1c1c1e" (a frying pan's)}
"""
import math

import numpy as np

from .. import designs
from .. import finish as FN
from .. import mesh as M
from .. import noise as N

MM = 0.001


def heat_tint(f, amount, seed, top=0.35):
    """Stainless steel's temper colours where a flame licked it: straw, bronze, purple and blue in bands up from the foot."""
    X, Y = f.grid()
    t = Y / max(f.H, 1e-6) / top
    t = t + 0.12 * N.fbm3(np.stack([X / 25, Y / 8, np.full_like(X, 1.5)], -1), seed, 3)
    stops = [(0.0, "#b8933e"), (0.25, "#9a6a3a"), (0.45, "#6e4a72"), (0.65, "#3e5f8f"), (0.85, "#8aa6c0"), (1.0, "#c6c9cc")]
    col = np.zeros(X.shape + (3,), np.float32)
    for (t0, c0), (t1, c1) in zip(stops[:-1], stops[1:]):
        m = (t >= t0) & (t < t1)
        u = ((t - t0) / (t1 - t0))[..., None]
        col[m] = (designs.P.rgb(c0) * (1 - u) + designs.P.rgb(c1) * u)[m]
    a = np.clip(1.15 - t, 0, 1) * amount
    f.lay_island(a.astype(np.float32), color=col, rough=0.22, metal=1.0)


def stir_marks(f, seed, amount=1.0):
    """Circles scratched into a pan's floor by spoons and scourers."""
    r = N.rng(seed, "stir")
    from ..paint import stroke_polys
    polys = []
    cx, cy = f.W / 2, f.H / 2
    for _ in range(int(220 * amount)):
        R = r.uniform(5, f.W / 2 * 0.95)
        a0 = r.uniform(0, 2 * math.pi)
        t = np.linspace(a0, a0 + r.uniform(0.2, 1.4), 10)
        polys += stroke_polys(np.stack([cx + R * np.cos(t), cy + R * np.sin(t)], 1), r.uniform(0.03, 0.08))
    f.lay_island(f.cov_of(polys), rough=0.1, color="#d8dadc", alpha=0.6, height=-0.003, add_height=True)


def make(spec, th):
    kind = spec.get("kind", "saucepan")
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "cookware")
    parts = []
    lid = spec.get("lid", kind in ("stockpot", "donabe", "tetsubin", "enamel"))
    steel = spec.get("metal", "#c6c9cc")
    inner = None
    rim_z = 0.0
    handle_at = None
    th.weighted = 50
    if kind in ("saucepan", "stockpot", "enamel"):
        R, H = {"saucepan": (80, 95), "stockpot": (118, 190), "enamel": (92, 112)}[kind]
        en = kind == "enamel"
        th.material("main", "paint" if en else "steel", color=spec.get("color", "#f4f2ec") if en else steel, rough=0.15 if en else 0.25,
                    metal=0.0 if en else 1.0)
        if en:
            prof = [(0, 0), (R - 14, 0), (R - 5, 1.5), (R - 0.6, 7), (R, 14), (R, H - 6), (R + 1.2, H - 2.5), (R + 3.2, H - 0.6), (R + 3.6, H + 0.8),
                    (R + 2.0, H + 1.6), (R + 0.4, H + 0.2), (R - 1.0, H - 4), (R - 1.0, 14), (R - 1.6, 8), (R - 6, 2.6), (R - 15, 1.0), (0, 1.0)]
            segs = [(0, 1, "bottom", "bottom"), (1, 5, "out", "band"), (5, 10, "rim", "band"), (10, 13, "in", "band"), (13, 16, "floor", "top")]
        else:
            prof = [(0, 0), (R - 8, 0), (R - 4, 1.0), (R - 2.2, 3.5), (R - 2.0, 6.5), (R - 2.6, 7.4), (R - 0.8, 9.5), (R, 14), (R, H - 4), (R + 0.6, H - 1.8),
                    (R + 2.6, H - 0.3), (R + 2.9, H + 0.9), (R + 1.4, H + 1.4), (R + 0.2, H + 0.1), (R - 1.0, H - 3), (R - 1.0, 12), (R - 2.5, 8.4),
                    (R - 8, 6.6), (0, 6.4)]
            segs = [(0, 1, "bottom", "bottom"), (1, 6, "base", "band"), (6, 9, "out", "band"), (9, 14, "rim", "band"), (14, 17, "in", "band"),
                    (17, 18, "floor", "top")]
        for a, b, nm, mp in segs:
            p = prof[a:b + 1]
            rmax = max(q[0] for q in p)
            th.island(nm, 2 * math.pi * rmax if mp == "band" else 2 * rmax, M.arclen(p) if mp == "band" else 2 * rmax, wrap=mp == "band")
        rim_z = H + 1.4
        inner = [(q[0], q[1]) for q in prof[segs[-2][0]:]][::-1]
        # handles: a long strap (saucepan), two loops (stockpot, enamel)
        if kind == "saucepan":
            th.island("handle", 2 * math.pi * 8, 200, wrap=True)
            th.island("rivets", 20, 20)
        else:
            th.island("handle", 2 * math.pi * 5, 90, wrap=True)
        if lid:
            lp = [(0, 0), (14, 0), (15, 2), (10, 6), (9, 12), (13, 15), (13.5, 19), (0, 20)]
            lidp = [(R + 3.0, H + 1.0), (R + 2.2, H + 3.5), (R - 10, H + 9), (R * 0.6, H + 16), (R * 0.2, H + 19), (0, H + 19.5)]
            th.island("lid", 2 * math.pi * (R + 3), M.arclen(lidp), wrap=True)
            th.island("lid_in", 2 * (R + 3), 2 * (R + 3))
            th.island("knob", 2 * math.pi * 15, M.arclen(lp), wrap=True)
        th.pack()
        I = th.islands
        ncol = 56 if R > 100 else 48
        body = M.lathe([M.Seg(np.array(prof[a:b + 1]) * MM, nm, mp, disc=(max(q[0] for q in prof[a:b + 1]) * MM) if mp != "band" else None)
                        for a, b, nm, mp in segs], ncol, I, step=0.03, mats=["main"])
        parts.append(body)
        if kind == "saucepan":
            path = np.array([(R - 1, 0, H - 22), (R + 14, 0, H - 17), (R + 60, 0, H - 4), (R + 140, 0, H + 12), (R + 178, 0, H + 19)])
            path = M.resample(path, 8)
            k = len(path)
            a = np.linspace(0, 2 * math.pi, 14, endpoint=False)
            sec = np.stack([11 * np.cos(a), 4.2 * np.sin(a)], 1) * MM
            hm = M.sweep(path * MM, sec, I["handle"], mat="main")
            ring = hm.v.reshape(k, 14, 3)
            t = np.linspace(0, 1, k)
            w = np.interp(t, [0, 0.12, 0.3, 0.9, 1], [0.75, 0.6, 0.85, 1.05, 0.7])
            ring[:] = path[:, None] * MM + (ring - path[:, None] * MM) * w[:, None, None]
            hm.v = ring.reshape(-1, 3)
            hm.a["rest"] = hm.v.copy()
            parts.append(hm)
            for zz in (H - 28, H - 14):
                rv = M.lathe([M.Seg(np.array([(0, 0), (3.2, 0), (2.8, 1.2), (1.4, 2.0), (0, 2.2)]) * MM, "rivets", "top", disc=3.2 * MM)], 12, I, step=0.002,
                             mats=["main"])
                M.turn(rv, M.rot("y", 90), move=((R - 0.2) * MM, 0, zz * MM))
                parts.append(rv)
            handle_at = (R + 178, 0, H + 19)
        else:
            zz = H - (26 if kind == "stockpot" else 22)
            span = 30 if kind == "stockpot" else 24
            reach = 21 if kind == "stockpot" else 18
            rod = 4.2 if kind == "stockpot" else 3.6
            # the ends go into the wall: at their own angle round the pot it curves away, so they're set by the radius
            ex = math.sqrt(max((R - rod - 0.6) ** 2 - span ** 2, 1.0))
            for sx in (-1, 1):
                path = np.array(M.spline([(ex, -span, zz), (R + 6, -span * 0.98, zz + 1), (R + reach * 0.78, -span * 0.72, zz + 3),
                                          (R + reach, 0, zz + 4), (R + reach * 0.78, span * 0.72, zz + 3), (R + 6, span * 0.98, zz + 1),
                                          (ex, span, zz)], 4))
                if sx < 0:
                    path[:, 0] *= -1
                parts.append(M.tube(path * MM, rod * MM, I["handle"], n=10, caps=(True, True), cap_bulge=0.4))
            handle_at = (R + reach, 0, zz + 4)
        if lid:
            # the underside from the middle out, then the top back in (a lathe's faces look to the right of its profile)
            under = [(0, H + 17.8), (R * 0.2, H + 17.3), (R * 0.6, H + 14.3), (R - 10, H + 7.4), (R + 1.4, H + 2.3), (R + 3.0, H + 1.0)]
            lm = M.lathe([M.Seg(M.spline(under, 16) * MM, "lid_in", "bottom", disc=(R + 3) * MM), M.Seg(M.spline(lidp, 11) * MM, "lid", "band")], ncol, I,
                         step=0.03, mats=["main"])
            parts.append(lm)
            km = M.lathe([M.Seg(M.spline(lp, 2.5) * MM, "knob", "band")], 20, I, step=0.01, mats=["main"])
            km.v[:, 2] += (H + 19.0) * MM
            km.a["rest"] = km.v.copy()
            parts.append(km)
            th.sockets["lid"] = (np.array([0, 0, H + 39]) * MM, (0, 0, 1))
        th.view = {"azim": -24, "elev": 26}
    elif kind == "frypan":
        R = 140.0
        th.material("main", "metal", color=spec.get("outside", "#3a3b3d"), rough=0.45, metal=0.8)
        th.material("grip", "plastic", color="#141414", rough=0.4, px=512)
        prof = [(0, 0), (104, 0), (110, 1.6), (113, 4), (126, 24), (138, 46.5), (140.5, 49.5), (140.2, 51.2), (138.6, 51.4), (136.2, 48.4), (123.6, 25), (110.6, 6.8),
                (106, 4.6), (0, 4.0)]
        segs = [(0, 1, "bottom", "bottom"), (1, 6, "out", "band"), (6, 9, "rim", "band"), (9, 12, "in", "band"), (12, 13, "floor", "top")]
        for a, b, nm, mp in segs:
            p = prof[a:b + 1]
            rmax = max(q[0] for q in p)
            th.island(nm, 2 * math.pi * rmax if mp == "band" else 2 * rmax, M.arclen(p) if mp == "band" else 2 * rmax, wrap=mp == "band")
        th.island("grip", 2 * math.pi * 14, 200, mat="grip", wrap=True)
        th.island("bracket", 2 * math.pi * 10, 50, wrap=True)
        th.pack()
        I = th.islands
        parts.append(M.lathe([M.Seg(np.array(prof[a:b + 1]) * MM, nm, mp, disc=(max(q[0] for q in prof[a:b + 1]) * MM) if mp != "band" else None)
                              for a, b, nm, mp in segs], 64, I, step=0.03, mats=["main"]))
        ang = math.radians(14)
        p0 = np.array([R - 6, 0, 36.0])
        d = np.array([math.cos(ang), 0, math.sin(ang)])
        br = p0[None] + d[None] * np.linspace(0, 42, 5)[:, None]
        parts.append(M.tube(br * MM, np.array([9, 8, 7.5, 7.5, 8]) * MM, I["bracket"], n=14))
        gp = p0[None] + d[None] * np.linspace(34, 205, 12)[:, None]
        t = np.linspace(0, 1, 12)
        parts.append(M.tube(gp * MM, np.interp(t, [0, 0.08, 0.5, 0.92, 1], [10, 11.5, 13, 12.5, 9.5]) * MM, I["grip"], n=16, caps=(False, True), cap_bulge=0.5))
        handle_at = tuple(gp[-1])
        rim_z = 51.0
        inner = [(q[0], q[1]) for q in prof[9:]][::-1]
        th.view = {"azim": -30, "elev": 40}
    elif kind == "yukihira":
        R, H = 90.0, 78.0
        th.material("main", "metal", color="#cfd2d5", rough=0.2, metal=1.0)
        th.material("wood", "wood", color="#b88a55", rough=0.55, px=512)
        prof = [(0, 0), (80, 0), (86, 2.4), (89, 10), (90.5, H - 2), (91.8, H), (91.6, H + 1.2), (90.2, H + 1.0), (89.4, H - 2), (87.6, 10), (84, 3), (79, 1.3),
                (0, 1.2)]
        segs = [(0, 1, "bottom", "bottom"), (1, 5, "out", "band"), (5, 8, "rim", "band"), (8, 11, "in", "band"), (11, 12, "floor", "top")]
        for a, b, nm, mp in segs:
            p = prof[a:b + 1]
            rmax = max(q[0] for q in p)
            th.island(nm, 2 * math.pi * rmax if mp == "band" else 2 * rmax, M.arclen(p) if mp == "band" else 2 * rmax, wrap=mp == "band")
        th.island("socket", 2 * math.pi * 11, 50, wrap=True)
        th.island("handle", 2 * math.pi * 15, 170, mat="wood", wrap=True)
        th.pack()
        I = th.islands
        body = M.lathe([M.Seg(np.array(prof[a:b + 1]) * MM, nm, mp, disc=(max(q[0] for q in prof[a:b + 1]) * MM) if mp != "band" else None)
                        for a, b, nm, mp in segs], 64, I, step=0.012, mats=["main"])
        # the pouring lips: the rim drawn out and up each side, square to the handle
        th_ = body.a["shell"][:, 0]
        z = body.a["shell"][:, 1] / MM
        for a0 in (math.pi / 2, -math.pi / 2):
            da = np.angle(np.exp(1j * (th_ - a0)))
            w = np.exp(-(da / 0.22) ** 2) * np.clip((z - 52) / (H - 52), 0, 1) ** 2
            rr = np.hypot(body.v[:, 0], body.v[:, 1])
            k = 1 + 9.0 * w / np.maximum(rr / MM, 1)
            body.v[:, 0] *= k
            body.v[:, 1] *= k
            body.v[:, 2] += 1.6 * w * MM
        body.a["rest"] = body.v.copy()
        parts.append(body)
        ang = math.radians(14)
        p0 = np.array([R - 2, 0, H - 22.0])
        d = np.array([math.cos(ang), 0, math.sin(ang)])
        sk = p0[None] + d[None] * np.linspace(0, 44, 5)[:, None]
        parts.append(M.tube(sk * MM, np.array([8, 9, 9.5, 10, 10.5]) * MM, I["socket"], n=14, caps=(True, False), cap_bulge=0.1))
        hp = p0[None] + d[None] * np.linspace(40, 200, 10)[:, None]
        t = np.linspace(0, 1, 10)
        parts.append(M.tube(hp * MM, np.interp(t, [0, 0.1, 0.6, 1], [11.5, 13.5, 15, 13.8]) * MM, I["handle"], n=16, caps=(False, True), cap_bulge=0.35))
        handle_at = tuple(hp[-1])
        rim_z = H + 1.2
        inner = [(q[0], q[1]) for q in prof[8:]][::-1]
        th.view = {"azim": -30, "elev": 36}
    elif kind == "donabe":
        th.material("main", "paint", color="#7a4a30", rough=0.8)
        out = [(0, 5), (54, 5), (56, 0), (63, 0)] + [tuple(q) for q in M.spline([(63, 0), (66, 5), (100, 24), (122, 46), (128, 62), (127.5, 74), (124, 80)], 8)[:-1]] + \
            [(124, 80), (116, 80.5), (115, 84)]
        inn = [(115, 84), (112, 84)] + [tuple(q) for q in M.spline([(112, 84), (111, 70), (104, 46), (86, 26), (50, 17), (0, 16)], 16)[1:]]
        lidu = [(0, 111), (25, 110), (60, 103.5), (95, 92), (113.5, 83.5), (116.5, 80.6)]
        lidp = [(116.5, 80.6), (119, 80.6), (119, 83)] + [tuple(q) for q in M.spline([(119, 83), (114, 86), (96, 96), (62, 108), (26, 115), (12, 117)], 9)[1:]] + \
            [tuple(q) for q in M.spline([(12, 117), (11, 120), (14, 126), (12, 130), (0, 130)], 1.5)[1:]]
        th.island("bottom", 112, 112)
        th.island("out", 2 * math.pi * 128, M.arclen(out[1:]), wrap=True)
        th.island("in", 2 * math.pi * 115, M.arclen(inn), wrap=True)
        th.island("lid", 2 * math.pi * 119, M.arclen(lidp), wrap=True)
        th.island("lid_in", 238, 238)
        th.island("ears", 2 * math.pi * 12, 40, wrap=True)
        th.pack()
        I = th.islands
        parts.append(M.lathe([M.Seg(np.array(out[:2]) * MM, "bottom", "bottom", disc=56 * MM), M.Seg(np.array(out[1:]) * MM, "out", "band"),
                              M.Seg(np.array(inn) * MM, "in", "band")], 56, I, step=0.03, mats=["main"]))
        if lid:
            parts.append(M.lathe([M.Seg(M.spline(lidu, 18) * MM, "lid_in", "bottom", disc=119 * MM), M.Seg(np.array(lidp) * MM, "lid", "band")], 56, I,
                                 step=0.03, mats=["main"]))
            th.sockets["lid"] = (np.array([0, 0, 130]) * MM, (0, 0, 1))
            vn = np.array([12 / 34, 0, 1.0])
            th.sockets["vent"] = (np.array([62, 0, 108.5]) * MM, tuple(vn / np.linalg.norm(vn)))
        for sx in (-1, 1):
            ep = np.array([(sx * 124, 0, 64), (sx * 138, 0, 66), (sx * 146, 0, 67)])
            parts.append(M.tube(ep * MM, np.array([12, 11, 10]) * MM, I["ears"], n=14, caps=(False, True), cap_bulge=0.4))
        rim_z = 84
        inner = inn
        handle_at = (146, 0, 67)
        th.view = {"azim": -22, "elev": 24}
    elif kind == "tetsubin":
        th.material("main", "metal", color="#2a2724", rough=0.6, metal=0.85)
        side = [tuple(q) for q in M.spline([(52, 0), (60, 2.5), (74, 12), (85, 29), (89.5, 48), (86, 66), (76, 80), (61, 91), (47, 98), (43, 99.5)], 5)]
        out = [(0, 0)] + side + [(42, 101.5), (40.5, 101.5), (40.5, 97), (0, 97)]
        nb = len(side) + 3
        th.island("bottom", 104, 104)
        th.island("body", 2 * math.pi * 90, M.arclen(out[1:len(out) - 3]), wrap=True)
        th.island("mouth", 82, 82)
        lp = [(43.5, 101), (44, 103.5), (40, 107.5), (22, 111), (12, 112), (9, 116), (11, 120), (6, 124), (0, 124.5)]
        th.island("lid", 2 * math.pi * 44, M.arclen(lp), wrap=True)
        th.island("spout", 2 * math.pi * 13, 70, wrap=True)
        th.island("tsuru", 2 * math.pi * 6, 260, wrap=True)
        th.island("lugs", 2 * math.pi * 5, 30, wrap=True)
        th.pack()
        I = th.islands

        def body(n, step):
            return M.lathe([M.Seg(np.array(out[:2]) * MM, "bottom", "bottom", disc=52 * MM), M.Seg(np.array(out[1:nb]) * MM, "body", "band"),
                            M.Seg(np.array(out[nb - 1:]) * MM, "mouth", "top", disc=41 * MM)], n, I, step=step, mats=["main"])

        low = body(56, 0.03)
        high = body(360, 0.0006)
        # arare: rows of round bumps over the shoulder, staggered, baked from the detailed mesh
        th_ = high.a["shell"][:, 0]
        z = high.a["shell"][:, 1] / MM
        rad = high.a["shell"][:, 2] / MM
        bump = np.zeros(len(z))
        prof = np.array(out[1:nb])
        for row, zr in enumerate(np.arange(54, 92, 8.6)):
            rr = np.interp(zr, prof[::-1, 1] if prof[0, 1] > prof[-1, 1] else prof[:, 1], prof[::-1, 0] if prof[0, 1] > prof[-1, 1] else prof[:, 0])
            cnt = int(round(2 * math.pi * rr / 9.0))
            for j in range(cnt):
                a = (j + 0.5 * (row % 2)) * 2 * math.pi / cnt
                da = np.angle(np.exp(1j * (th_ - a))) * rad
                dz = z - zr
                d2 = (da ** 2 + dz ** 2) / 2.9 ** 2
                bump = np.maximum(bump, np.clip(1 - d2, 0, 1) ** 0.6)
        on = (z > 48) & (z < 96)
        nrm = np.stack([np.cos(th_), np.sin(th_), np.zeros_like(th_)], 1)
        high.v += nrm * (bump * 1.7 * on)[:, None] * MM
        parts.append(low)
        hparts = [high]
        lm = M.lathe([M.Seg(np.array(lp) * MM, "lid", "band")], 48, I, step=0.003, mats=["main"])
        parts.append(lm)
        hparts.append(lm.copy())
        sp = np.array([(0, -70, 30), (0, -92, 46), (0, -108, 66), (0, -116, 82)])
        sp = M.spline(sp, 5)
        t = np.linspace(0, 1, len(sp))
        spm = M.tube(sp * MM, np.interp(t, [0, 1], [13, 6.5]) * MM, I["spout"], n=16)
        parts.append(spm)
        hparts.append(spm.copy())
        ts = np.array([(-46, 0, 99), (-58, 0, 120), (-52, 0, 150), (-28, 0, 170), (0, 0, 176), (28, 0, 170), (52, 0, 150), (58, 0, 120), (46, 0, 99)])
        ts = M.spline(ts, 6)
        tm = M.tube(ts * MM, 5.2 * MM, I["tsuru"], n=12, caps=(True, True), cap_bulge=0.3)
        parts.append(tm)
        hparts.append(tm.copy())
        for sx in (-1, 1):
            lg = M.tube(M.ring_path((sx * 46, 0, 99), (0, 1, 0), 5.5, 16) * MM, 2.2 * MM, I["lugs"], n=8)
            parts.append(lg)
            hparts.append(lg.copy())
        th.high = M.join(hparts, ["main"])
        tip = sp[-1] + (sp[-1] - sp[-2]) / np.linalg.norm(sp[-1] - sp[-2]) * 2
        th.sockets["spout"] = (tip * MM, tuple((sp[-1] - sp[-2]) / np.linalg.norm(sp[-1] - sp[-2])))
        th.sockets["lid"] = (np.array([0, 0, 124.5]) * MM, (0, 0, 1))
        rim_z = 101.5
        handle_at = (0, 0, 176)
        th.view = {"azim": -30, "elev": 22}
    th.low = M.join(parts, [m for m in th.mats])
    if kind != "tetsubin":
        th.high = None
    if inner is not None and spec.get("liquid") and not (lid and kind in ("tetsubin",)):
        from .. import liquid as LQ
        lq = spec["liquid"] if isinstance(spec["liquid"], dict) else {"kind": spec["liquid"]}
        ins = [(max(q[0] - 0.4, 0.0), q[1] + 0.4) for q in inner]
        ins = sorted(ins, key=lambda q: q[1])
        th.liquid = LQ.turned(ins, th.islands, "in" if "in" in th.islands else list(th.islands)[0], lq.get("kind", "water"), float(lq.get("fill", 0.6)),
                              lq.get("color"), seed)
    th.sockets.setdefault("steam", (np.array([0, 0, rim_z + 2]) * MM, (0, 0, 1)))
    vent = "spout" if kind == "tetsubin" else ("vent" if kind == "donabe" and lid else (None if lid else "steam"))
    if vent:
        th.fx = {"steam": {"sockets": [vent], "on": False}}
    th.sockets.setdefault("rim", (np.array([0, 0, rim_z]) * MM, (0, 0, 1)))
    if handle_at is not None:
        th.sockets.setdefault("handle", (np.array(handle_at) * MM, (0, 0, 1)))
    th.pose = "stand"

    def paint(fr):
        if kind in ("saucepan", "stockpot"):
            for nm in ("out", "base", "rim", "handle", "knob", "lid"):
                if nm in fr:
                    FN.metal(fr[nm], "brushed" if nm in ("out", "handle", "lid") else "satin", steel, seed + len(nm), along=90 if nm == "out" else 0)
            for nm in ("in", "floor", "lid_in"):
                if nm in fr:
                    FN.metal(fr[nm], "swirl", steel, seed + 3)
            if "floor" in fr:
                stir_marks(fr["floor"], seed, 1.0)
            FN.metal(fr["bottom"], "satin", steel, seed + 4)
            f = fr["bottom"]
            for k, rr in enumerate(np.linspace(8, f.W / 2 - 4, 9)):
                f.ring(f.W / 2, f.H / 2, rr, 0.5, color="#a8acb0", rough=0.3, metal=1.0, height=-0.01, add_height=True)
            mark = "18-10  INDUCTION"
            f.slot("mark", designs.text_box(mark, (f.W / 2, f.H / 2 - 14), 3.2, font="archivo"),
                   lambda: f.text(mark, (f.W / 2, f.H / 2 - 14), 3.2, font="archivo", color="#8a8e92", rough=0.3, metal=1.0, height=-0.012, alpha=0.8),
                   kind="stamp", about="the steel and INDUCTION stamped on its base", rough=0.3, metal=1.0, height=-0.012, alpha=0.8)
            tint = float(spec.get("tint", 0.6))
            if tint > 0:
                heat_tint(fr["base" if "base" in fr else "out"], tint, seed + 5, top=1.0)
                heat_tint(fr["out"], tint * 0.7, seed + 6, top=0.22)
            if "rivets" in fr:
                FN.metal(fr["rivets"], "polished", steel, seed + 7)
        elif kind == "enamel":
            col = spec.get("color", "#f4f2ec")
            for nm in ("out", "in", "floor", "lid", "lid_in", "knob", "handle", "bottom"):
                if nm in fr:
                    fr[nm].fill(color=col, rough=0.1, metal=0.0)
            for nm in ("rim",):
                fr[nm].fill(color="#1b1b1d", rough=0.2)
            f = fr["lid"]
            f.rect(0, -1, f.W, 3.5, color="#1b1b1d", rough=0.2)
            fr["knob"].fill(color="#1b1b1d", rough=0.2)
            fr["bottom"].fill(color="#2a2a2c", rough=0.5)
            # chips: the enamel gone at knocks, the dark steel under it, near the rim and the foot
            rng = N.rng(seed, "chips")
            for nm, ys in (("out", (0.0, 0.08, 0.9, 1.0)), ("lid", (0.0, 0.15, 0.0, 0.0))):
                f = fr[nm]
                for _ in range(int(spec.get("chips", 6))):
                    y = rng.uniform(ys[0], ys[1]) if rng.random() < 0.5 else rng.uniform(ys[2], ys[3])
                    cx, cy = rng.uniform(0, f.W), y * f.H
                    rr = rng.uniform(1.5, 5.0)
                    pts = designs.P.ellipse_poly(cx, cy, rr, rr * rng.uniform(0.5, 1), rng.uniform(0, 180))
                    pts = pts * (1 + 0.25 * rng.uniform(-1, 1, (len(pts), 1)) * 0) + rng.uniform(-0.4, 0.4, pts.shape)
                    f.poly(pts, color="#2b2b2e", rough=0.55, metal=0.4, height=-0.12, add_height=True)
                    f.ring(cx, cy, rr * 1.02, 0.5, color="#5a5450", rough=0.4, alpha=0.6)
            if spec.get("decal", True):
                f = fr["out"]
                cx, cy = f.W / 2, f.H * 0.55
                red = spec.get("decal_color", "#c0392b")

                def flower():
                    for k in range(5):
                        a = 2 * math.pi * k / 5 + math.pi / 2
                        f.ellipse(cx + math.cos(a) * 9, cy + math.sin(a) * 9, 8, 5, rot=math.degrees(a), color=red, rough=0.12)
                    f.ellipse(cx, cy, 4, color="#e8b830", rough=0.12)
                    for sxl in (-1, 1):
                        f.ellipse(cx + sxl * 22, cy - 12, 9, 3.2, rot=sxl * 25, color="#3d7a3a", rough=0.12)
                        f.ellipse(cx + sxl * 30, cy + 4, 4.5, color=red, rough=0.12, alpha=0.9)
                f.slot("flower", (cx, cy + 0.1, 69.6, 34.4), flower, kind="picture", about="the red flower on its side", rough=0.12)
        elif kind == "frypan":
            outside = spec.get("outside", "#3a3b3d")
            for nm in ("out", "rim"):
                FN.metal(fr[nm], "satin", outside, seed + 1)
                fr[nm].fill(color=outside, rough=0.5, metal=0.6, alpha=0.6)
            coat = spec.get("coating", "#1c1c1e")
            for nm in ("in", "floor"):
                f = fr[nm]
                X, Y = f.grid()
                g = N.fbm3(np.stack([X / 0.6, Y / 0.6, np.full_like(X, 1.0)], -1), seed + 2, 2)
                f.lay_island(np.ones_like(X), color=np.clip(designs.P.rgb(coat)[None, None] * (1 + 0.25 * g[..., None]), 0, 1).astype(np.float32),
                             rough=0.32, metal=0.05, height=(0.004 * g).astype(np.float32))
                # scraped: the coating worn to the aluminium in fine scratches, most in the middle
                rng = N.rng(seed, "scrape" + nm)
                from ..paint import stroke_polys
                polys = []
                for _ in range(int(160 * float(spec.get("scrape", 1.0)))):
                    cx, cy = rng.uniform(0, f.W), rng.uniform(0, f.H)
                    if nm == "floor" and np.hypot(cx - f.W / 2, cy - f.H / 2) > f.W / 2 * 0.9:
                        continue
                    L = rng.uniform(3, 18)
                    a = rng.uniform(0, math.pi)
                    polys += stroke_polys(np.array([(cx, cy), (cx + L * math.cos(a), cy + L * math.sin(a))]), rng.uniform(0.04, 0.12))
                if polys:
                    f.lay_island(f.cov_of(polys), color="#9a9ca0", rough=0.25, metal=1.0, alpha=0.85, height=-0.004, add_height=True)
            f = fr["bottom"]
            FN.metal(f, "satin", "steel", seed + 3)
            f.dots(6, 1.6, color="#5a5c60", rough=0.5, metal=0.8, height=-0.05)
            f.ring(f.W / 2, f.H / 2, f.W / 2 - 3, 2.5, color="#3a3b3d", rough=0.5, metal=0.6)
            fr["grip"].fill(color="#141414", rough=0.38)
            fr["grip"].stripes(40, 0.03, angle=90, height=-0.08, add_height=True)
            FN.metal(fr["bracket"], "satin", "steel", seed + 4)
        elif kind == "yukihira":
            for nm in ("out", "in", "rim", "floor"):
                FN.metal(fr[nm], "hammered", "aluminium", seed + len(nm), amount=1.0)
            FN.metal(fr["bottom"], "satin", "aluminium", seed + 2)
            heat_tint(fr["out"], float(spec.get("tint", 0.0)) * 0.4, seed + 3, top=0.2)
            fr["out"].gradient("#2a2420", "#cfd2d5", angle=90, t0=0.0, t1=0.25, rough=0.5, metal=0.6, mask=None, alpha=0.35)
            FN.metal(fr["socket"], "satin", "aluminium", seed + 4)
            designs.wood_grain(fr["handle"], {"color": "#b88a55", "ring": 1.6}, N.rng(seed, "handle"))
        elif kind == "donabe":
            clay = "#7a4a30"
            for nm in ("out", "bottom", "ears"):
                f = fr[nm]
                X, Y = f.grid()
                g = N.fbm3(np.stack([X / 2.5, Y / 2.5, np.full_like(X, 2.0)], -1), seed + 1, 3)
                f.lay_island(np.ones_like(X), color=np.clip(designs.P.rgb(clay)[None, None] * (1 + 0.14 * g[..., None]), 0, 1).astype(np.float32),
                             rough=0.85, height=(0.04 * g).astype(np.float32))
            f = fr["out"]
            # a glazed band round the shoulder, brown-black, dribbling down
            glaze = designs.P.rgb(spec.get("glaze", "#2a1c14"))
            X, Y = f.grid()
            drip = (Y / f.H) - 0.55 + 0.1 * np.maximum(N.fbm3(np.stack([X / 9, np.zeros_like(X), np.full_like(X, 4.0)], -1), seed + 2, 3), 0) * 3
            m = np.clip(drip * 12, 0, 1)
            f.lay_island(m.astype(np.float32), color=glaze, rough=0.12, height=0.03)
            fr["in"].fill(color=glaze * 1.3, rough=0.14)
            f = fr["lid"]
            f.fill(color=glaze, rough=0.1)
            X, Y = f.grid()
            # hakeme: white slip brushed in strokes from the knob outwards
            rng = N.rng(seed, "hakeme")
            for _ in range(int(spec.get("strokes", 26))):
                x = rng.uniform(0, f.W)
                w = rng.uniform(4, 12)
                y0, y1 = rng.uniform(0.12, 0.3) * f.H, rng.uniform(0.6, 0.92) * f.H
                pts = np.array([(x - w / 2, y0), (x + w / 2, y0), (x + w * 0.3, y1), (x - w * 0.3, y1)])
                cov = f.cov_of([pts])
                streak = np.clip(0.55 + 0.6 * N.fbm3(np.stack([X / 0.6, Y / 18, np.full_like(X, x)], -1), seed + 5, 2), 0, 1)
                f.lay_island((cov * streak).astype(np.float32), color="#ece4d2", rough=0.14, alpha=0.85, height=0.02)
            f.rect(0, 0, f.W, 9, color="#3a2a20", rough=0.3)
            fr["lid_in"].fill(color="#6e4a34", rough=0.8)
        elif kind == "tetsubin":
            for nm in ("body", "lid", "spout", "bottom", "mouth"):
                FN.metal(fr[nm], "cast", "#2a2724", seed + len(nm))
                if float(spec.get("rust", 0.1)) > 0:
                    f = fr[nm]
                    X, Y = f.grid()
                    g = N.fbm3(np.stack([X / 6, Y / 6, np.full_like(X, 3.3)], -1), seed + 11, 4) * 0.5 + 0.5
                    m = N.smoothstep(0.78 - 0.2 * float(spec.get("rust", 0.1)), 0.9, g)
                    f.lay_island((m * 0.8).astype(np.float32), color="#5a2e18", rough=0.85, metal=0.1)
            for nm in ("tsuru", "lugs"):
                FN.metal(fr[nm], "satin", "#24211f", seed + 9)

    th.paint = paint
    return th
