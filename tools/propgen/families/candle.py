"""Wax candles, melted: a pillar, a tall church candle, a taper in its brass candlestick, a votive burning down in its
glass, a cluster stuck together on its own puddle. Each is turned, then burned: its rim uneven and breached where the
wax ran over, a glossy pool round a bent, burnt wick (`socket_flame` at its tip, for a light or a flame effect), wax
drips running from the breaches over the lip and down its side (ribbons half sunk in the wall, thin at the top, a bulb
at the end), a puddle where it pooled.

    {"family": "candle", "kind": "pillar" | "church" | "taper" | "votive" | "cluster", "color": "#e9dcc4",
     "burn": 0.5 (0 new: a flat top and a straight wick), "drips": 6, "count": 5 (a cluster's), "puddle": true,
     "holder": "#c9a25e" (the taper's brass), "patina": 0.35, "soot": 0.6 (the votive glass's)}
"""
import math

import numpy as np

from .. import designs
from .. import finish as FN
from .. import mesh as M
from .. import noise as N

KINDS = {"pillar": (30.0, 110.0), "church": (38.0, 180.0), "taper": (11.0, 230.0), "votive": (21.0, 46.0)}
MM = 0.001


def _rim(seed, depth, burn, breaches):
    """The rim's dip (mm) by angle: a little uneven all round, low where it was breached."""
    def dip(th_):
        th_ = np.asarray(th_, float)
        d = 1.4 * N.fbm3(np.stack([np.cos(th_) * 1.5, np.sin(th_) * 1.5, np.full_like(th_, seed * 0.7)], -1), seed, 3)
        for a, w in breaches:
            da = np.angle(np.exp(1j * (th_ - a)))
            d = d - depth * 0.8 * np.exp(-(da / w) ** 2) * burn
        return d
    return dip


def _drip(path_rz, ang, width, thick, isl, ring=10):
    """A run of wax: a flattened tube along a path in a candle's radial plane ((r, z) mm, its angle per point), its
    cross-section `width` across the wall and `thick` out of it, half sunk in the surface, closed at its end."""
    K = len(path_rz)
    d = np.gradient(path_rz, axis=0)
    d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9)
    out_rz = np.stack([-d[:, 1], d[:, 0]], 1)                    # the path's tangent turned a quarter: away from the wax
    phi = np.linspace(0, 2 * math.pi, ring, endpoint=False)
    verts = []
    for k in range(K):
        rad = np.array([math.cos(ang[k]), math.sin(ang[k]), 0.0])
        tg = np.array([-math.sin(ang[k]), math.cos(ang[k]), 0.0])
        out = rad * out_rz[k, 0] + np.array([0, 0, 1.0]) * out_rz[k, 1]
        c = rad * path_rz[k, 0] + np.array([0, 0, path_rz[k, 1]]) + out * thick[k] * 0.1
        for p in phi:
            verts.append(c + tg * (width[k] / 2 * math.cos(p)) + out * (thick[k] / 2 * math.sin(p)))
    down = np.array([0, 0, -1.0])
    verts.append(c + down * width[-1] * 0.32 + out * thick[-1] * 0.1)
    verts = np.array(verts) * MM
    f, uv = [], []
    for k in range(K - 1):
        for j in range(ring):
            j1 = (j + 1) % ring
            f.append([k * ring + j1, k * ring + j, (k + 1) * ring + j, (k + 1) * ring + j1])
            uv.append(isl.to_uv(np.array([j1 if j1 else ring, j, j, j1 if j1 else ring]) / ring, np.array([k, k, k + 1, k + 1]) / (K - 1)))
    last = (K - 1) * ring
    for j in range(ring):
        j1 = (j + 1) % ring
        f.append([last + j1, last + j, len(verts) - 1, -1])
        uv.append(np.concatenate([isl.to_uv(np.array([j1 if j1 else ring, j, j + 0.5]) / ring, np.array([1.0, 1.0, 1.0])), [[0, 0]]]))
    m = M.Mesh(verts, f, np.array(uv), mats=["wax"])
    M.flip(m)           # wound as built, the tube's faces looked into the wax (the section turns one way, the path runs down)
    m.a["rest"] = m.v.copy()
    return m


def candle_parts(tag, R, H, burn, n_drips, seed, I, n_seg, ring_mm, taper=0.0, front=True, max_run=None):
    """One candle (mm, its base's middle at 0): the body turned and melted, its drips, its wick. Returns the meshes and
    the wick's tip."""
    r = N.rng(seed, "candle", tag)
    depth = 2.0 + 13.0 * burn
    lip = max(2.2, R * 0.12)
    Ht = H * (1 - 0.45 * burn)                          # what's left of it
    Rt = R * (1 - taper)
    side = [(R + (Rt - R) * z / Ht, z) for z in np.linspace(4, Ht - 2, max(3, int(Ht / 12)))]
    if burn > 0:
        top = [(Rt, Ht - 1.5), (Rt - 0.4, Ht), (Rt - lip * 0.6, Ht - 0.3), (Rt - lip, Ht - 1.6), (Rt - lip - 2.0, Ht - depth * 0.7),
               (Rt * 0.45, Ht - depth), (2.5, Ht - depth - 0.4), (0, Ht - depth - 0.4)]
    else:
        top = [(Rt, Ht - 1.2), (Rt - 0.8, Ht), (Rt * 0.5, Ht + 0.2), (0, Ht + 0.2)]
    m = M.lathe([M.Seg(np.array([(0, 0), (R - 1.4, 0.0), (R - 0.4, 0.4), (R, 1.6)]) * MM, f"{tag}_base", "bottom", disc=R * MM),
                 M.Seg(np.array([(R, 1.6)] + side + [top[0]]) * MM, f"{tag}_side", "band"),
                 M.Seg(np.array(top) * MM, f"{tag}_top", "top", disc=Rt * MM)], n_seg, I, step=ring_mm * MM, mats=["wax"])
    # melting: the rim uneven, breached where the wax ran over (the first breach toward the front, -y), the side lumpy
    a_front = -math.pi / 2 + r.uniform(-0.5, 0.5)
    breaches = [((a_front if (i == 0 and front) else r.uniform(0, 2 * math.pi)), r.uniform(0.2, 0.5)) for i in range(max(1, (n_drips + 1) // 2))]
    dip = _rim(seed, depth, burn, breaches)
    th_ = m.a["shell"][:, 0]
    z = m.a["shell"][:, 1] / MM
    near_top = N.smoothstep(Ht - depth - 8, Ht - 1, z)
    m.v[:, 2] += dip(th_) * near_top * MM
    lump = 1 + 0.01 * N.fbm3(np.stack([np.cos(th_) * 3, np.sin(th_) * 3, z / 25.0], 1), seed + 1, 3)
    m.v[:, 0] *= lump
    m.v[:, 1] *= lump
    parts = [m]
    # the drips: from the pool over the lip at a breach, down the wall, a bulb where each stopped
    for i in range(n_drips):
        a0, w = breaches[i % len(breaches)]
        a0 += r.uniform(-w, w) * 0.7
        rz = Ht + float(dip(a0))
        L = (rz - 3) * (r.uniform(0.2, 0.9) if burn > 0 else r.uniform(0.05, 0.2))
        if max_run is not None:
            L = min(L, max_run)
        K = 14
        ts = np.linspace(0, 1, K)
        zs = rz - 2.2 - L * ts
        rad = R + (Rt - R) * np.clip(zs / Ht, 0, 1)
        path = np.concatenate([[(Rt - lip * 0.5, rz - 0.25), (Rt - 0.1, rz - 0.7)], np.stack([rad, zs], 1)])
        ang = a0 + 0.05 * np.sin(np.linspace(0, 1, K + 2) * 5 + i) * np.linspace(0, 1, K + 2)
        tt = np.concatenate([[0, 0], ts])
        size = r.uniform(0.8, 1.3)
        thick = (0.8 + 1.5 * tt ** 1.5 + 2.0 * np.exp(-((tt - 1) / 0.12) ** 2)) * size
        width = (2.4 + 2.4 * tt ** 0.7 + 2.4 * np.exp(-((tt - 1) / 0.12) ** 2)) * size
        parts.append(_drip(path, ang, width, thick, I[f"{tag}_drip{i}"]))
    # the wick: braided cotton bent over at its top, burnt black there
    wz = (Ht - depth - 0.4) if burn > 0 else Ht + 0.2
    tlen = 7.0 if burn > 0 else 10.0
    t = np.linspace(0, 1, 9)
    bend = 0.35 if burn > 0 else 0.05
    path = np.stack([np.sin(t * bend * 3) * tlen * 0.35, np.zeros_like(t), wz - 1.5 + t * tlen], 1)
    a = np.linspace(0, 2 * math.pi, 8, endpoint=False)
    sec = np.stack([0.75 * np.cos(a), 0.75 * np.sin(a)], 1) * MM
    parts.append(M.sweep(path * MM, sec, I[f"{tag}_wick"], mat="wax"))
    return parts, path[-1] + (0, 0, 1.5)


def puddle(R_out, seed, I, island, thick=1.8, lumpy=0.22):
    """A spill of wax: a flat, lumpy disc with its edge rounded, a little higher toward its middle."""
    r = N.rng(seed, "puddle")
    t = np.linspace(0, 2 * math.pi, 72, endpoint=False)
    rr = R_out * (1 + lumpy * N.fbm3(np.stack([np.cos(t) * 1.3, np.sin(t) * 1.3, np.full_like(t, r.uniform(0, 9))], 1), seed, 3))
    poly = np.stack([rr * np.cos(t), rr * np.sin(t)], 1)
    sl = M.slab([M.resample_loop(poly, max(2.5, R_out / 14)) * MM], thick * MM, thick * 0.48 * MM, I, top=island, bottom=island + "_under",
                edge=island + "_edge", steps=2, fill=max(4.0, R_out / 6) * MM)
    sl.v[:, 2] += thick / 2 * MM
    d = np.hypot(sl.v[:, 0], sl.v[:, 1]) / (R_out * MM)
    sl.v[:, 2] *= 1 + 0.6 * np.clip(1 - d, 0, 1)
    sl.a["rest"] = sl.v.copy()
    return sl


HOLDER = [(0, 0), (44, 0), (45, 1.5), (44, 4), (38, 7), (24, 11), (12, 16), (8, 24), (10.5, 30), (8, 36), (6.5, 70), (9.5, 78), (7, 86),
          (6.5, 120), (10, 128), (26, 133), (28, 135), (27, 137), (13, 137), (12.4, 155), (13.5, 158), (11.6, 158.5), (11.3, 140), (0, 140)]
"""A brass candlestick (mm): its foot, a stem with knops, the drip pan at 137, the socket the taper stands in (to 158)."""


def make(spec, th):
    kind = spec.get("kind", "pillar")
    seed = int(spec.get("seed", 0))
    burn = float(spec.get("burn", 0.5))
    n_drips = int(spec.get("drips", 6))
    wax = spec.get("color", "#e9dcc4")
    th.material("wax", "wax", color=wax, rough=0.42)
    r = N.rng(seed, "candles")
    candles = []                                       # (tag, R, H, x, y, drips, burn)
    if kind == "cluster":
        n = int(spec.get("count", 5))
        placed = []
        for i in range(n):
            R = r.uniform(17, 30)
            H = r.uniform(50, 140) * (1.35 if i == 0 else 1.0)
            for _try in range(200):
                p = r.uniform(-1, 1, 2) * (14 + 8 * n) if i else np.zeros(2)
                if all(np.hypot(*(p - q)) > R + rq + 1.0 for q, rq in placed):
                    break
            placed.append((p, R))
            candles.append((f"c{i}", R, H, p[0], p[1], max(2, n_drips - i), min(0.95, burn * r.uniform(0.6, 1.3))))
    else:
        R, H = KINDS[kind]
        R = float(spec.get("radius", R))
        H = float(spec.get("height", H))
        candles.append(("c0", R, H, 0.0, 0.0, n_drips, burn))
    for tag, R, H, x, y, nd, b in candles:
        Ht = H * (1 - 0.45 * b)
        th.island(f"{tag}_side", 2 * math.pi * R, Ht, mat="wax", wrap=True)
        th.island(f"{tag}_top", 2 * R, 2 * R, mat="wax")
        th.island(f"{tag}_base", 2 * R, 2 * R, mat="wax")
        th.island(f"{tag}_wick", 2 * math.pi * 0.8, 12, mat="wax", wrap=True)
        for i in range(nd):
            th.island(f"{tag}_drip{i}", 14, Ht * 0.8, mat="wax", wrap=True)
    pud = spec.get("puddle", kind in ("cluster", "pillar", "church"))
    span = max(np.hypot(c[3], c[4]) + c[1] for c in candles)
    if pud:
        th.island("pool", 2.6 * span, 2.6 * span, mat="wax")
        th.island("pool_under", 1.3 * span, 1.3 * span, mat="wax")
        th.island("pool_edge", 2 * math.pi * 1.3 * span, 4, mat="wax", wrap=True)
    if kind == "taper":
        th.material("brass", "metal", color=spec.get("holder", "#c9a25e"), rough=0.25, metal=1.0, px=512)
        th.island("holder", 2 * math.pi * 45, M.arclen(HOLDER[3:]), mat="brass", wrap=True)
        th.island("holder_base", 90, 90, mat="brass")
        th.island("pan", 60, 60, mat="wax")
        th.island("pan_under", 30, 30, mat="wax")
        th.island("pan_edge", 2 * math.pi * 30, 4, mat="wax", wrap=True)
    if kind == "votive":
        th.material("glass", "clear", alpha=True, double=False, color="#e4ecee", rough=0.05, px=512, specular=0.6)
        th.island("glass_out", 2 * math.pi * 29, 66, mat="glass", wrap=True)
        th.island("glass_in", 2 * math.pi * 29, 66, mat="glass", wrap=True)
        th.island("glass_lip", 2 * math.pi * 29, 6, mat="glass", wrap=True)
        th.island("glass_under", 58, 58, mat="glass")
    th.pack()
    I = th.islands
    parts, tips = [], []
    base_z = 0.0
    if kind == "taper":
        parts.append(M.lathe([M.Seg(np.array(HOLDER[:4]) * MM, "holder_base", "bottom", disc=45 * MM),
                              M.Seg(np.array(HOLDER[3:]) * MM, "holder", "band")], 40, I, step=0.006, mats=["brass"]))
        base_z = 140.0
        pan = puddle(21, seed + 5, I, "pan", thick=1.3, lumpy=0.18)
        pan.v[:, 2] += 136.9 * MM
        pan.a["rest"] = pan.v.copy()
        parts.append(pan)
    cluster = kind == "cluster"
    for ci, (tag, R, H, x, y, nd, b) in enumerate(candles):
        ps, tip = candle_parts(tag, R, H, b, nd, seed * 31 + ci, I, 30 if cluster else (24 if kind == "taper" else 40), 4.0 if cluster else 3.0,
                               taper=0.18 if kind == "taper" else 0.0, front=not cluster or ci == 0,
                               max_run=(H * (1 - 0.45 * b) - 22) if kind == "taper" else None)
        for p in ps:
            p.v += np.array([x, y, base_z]) * MM
            p.a["rest"] = p.v.copy()
        parts += ps
        tips.append(np.array([x, y, base_z]) + tip)
    if pud:
        parts.append(puddle(span * 1.25, seed + 3, I, "pool"))
    if kind == "votive":
        R0 = 25.0
        prof = [(0, 1.0), (R0 - 3, 0.8), (R0 - 1, 0.0), (R0, 1.5), (R0 + 1.5, 30), (R0 + 3, 62), (R0 + 3.2, 64), (R0 + 0.8, 64.2), (R0 + 0.6, 62),
                (R0 - 0.5, 30), (R0 - 2, 7), (0, 7)]
        for p in parts:
            p.v[:, 2] += 7 * MM
            p.a["rest"] = p.v.copy()
        tips = [t + (0, 0, 7) for t in tips]
        parts.append(M.lathe([M.Seg(np.array(prof[:3]) * MM, "glass_under", "bottom", disc=R0 * MM),
                              M.Seg(np.array(prof[2:7]) * MM, "glass_out", "band"),
                              M.Seg(np.array(prof[6:9]) * MM, "glass_lip", "band"),
                              M.Seg(np.array(prof[8:]) * MM, "glass_in", "band")], 40, I, step=0.004, mats=["glass"]))
    th.low = M.join(parts, ["wax"] + (["brass"] if kind == "taper" else []) + (["glass"] if kind == "votive" else []))
    th.high = None
    for i, tp in enumerate(tips):
        th.sockets["flame" if len(tips) == 1 else f"flame_{i}"] = (tp * MM, (0, 0, 1))
    th.fx = {"flame": {"sockets": list(th.sockets), "on": burn > 0}, "wax": {"materials": ["wax"]},
             "glow": {"energy": 3.0, "follows": "flame"}}
    th.pose = "stand"
    th.view = {"azim": -18, "elev": 32}
    soot = float(spec.get("soot", 0.6))

    def paint(fr):
        c = designs.P.rgb(wax)
        for ci, (tag, R, H, x, y, nd, b) in enumerate(candles):
            f = fr[f"{tag}_side"]
            # wax: a little darker at its foot, warmer toward the top (the flame's glow through it), poured in faint
            # layers, mottled
            f.gradient(designs.P.mix(c, "#000000", 0.07), designs.P.mix(c, "#fff1d6", 0.16), angle=90, rough=0.45, metal=0.0)
            X, Y = f.grid()
            g = N.fbm3(np.stack([X / 7, Y / 7, np.full_like(X, 3.1 + ci)], -1), seed + 2, 3)
            col = f.cv.col[f.box[0]:f.box[2], f.box[1]:f.box[3]] * (1 + 0.035 * g[..., None])
            f.lay_island(np.ones_like(X), color=col.astype(np.float32), height=(g * 0.05).astype(np.float32))
            f.stripes(4.5, 0.5, angle=90, height=0.012)
            f = fr[f"{tag}_top"]
            # the pool: glossy, sooted toward the wick
            f.fill(color=c, rough=0.18)
            if b > 0:
                Xc, Yc = f.grid()
                d = np.hypot(Xc - f.W / 2, Yc - f.H / 2) / (f.W / 2)
                s = np.clip(1 - d / 0.32, 0, 1) ** 1.5
                f.lay_island(np.ones_like(Xc), color=(c[None, None] * (1 - 0.6 * s[..., None])).astype(np.float32),
                             rough=(0.18 + 0.3 * s).astype(np.float32))
            fr[f"{tag}_base"].fill(color=designs.P.mix(c, "#000000", 0.12), rough=0.7)
            f = fr[f"{tag}_wick"]
            f.fill(color="#efe9da", rough=0.9)
            f.stripes(1.2, 0.5, angle=45, height=0.08)
            f.gradient("#efe9da", "#0d0b0a", angle=90, t0=0.35, t1=0.75, rough=0.95)
            Xw, Yw = f.grid()
            ember = N.smoothstep(0.8, 0.95, Yw / max(f.H, 1e-6)).astype(np.float32)       # the burning tip glows
            f.lay_island(ember, emit="#ff5a14")
            for i in range(nd):
                f = fr[f"{tag}_drip{i}"]
                f.fill(color=designs.P.mix(c, "#fff1d6", 0.1), rough=0.28)
        for nm in ("pool", "pool_under", "pool_edge", "pan", "pan_under", "pan_edge"):
            if nm in fr:
                fr[nm].fill(color=designs.P.mix(c, "#000000", 0.04), rough=0.26)
        if "holder" in fr:
            FN.metal(fr["holder"], "polished", spec.get("holder", "#c9a25e"), seed + 4, age="patina", age_amount=float(spec.get("patina", 0.35)))
            FN.metal(fr["holder_base"], "satin", spec.get("holder", "#c9a25e"), seed + 5, age="patina", age_amount=0.3)
        for nm in ("glass_out", "glass_in", "glass_lip", "glass_under"):
            if nm in fr:
                f = fr[nm]
                f.fill(color="#e4ecee", rough=0.05, opacity=0.12 if nm != "glass_lip" else 0.35)
                if nm in ("glass_in", "glass_out"):
                    # soot: black up the glass where the flame licked it, thickest inside
                    X, Y = f.grid()
                    up = np.clip((Y / max(f.H, 1)) if nm == "glass_out" else (1 - Y / max(f.H, 1)), 0, 1)
                    s = N.smoothstep(0.3, 0.9, up) * (0.75 + 0.25 * N.fbm3(np.stack([X / 6, Y / 6, np.full_like(X, 1.0)], -1), seed + 6, 3))
                    s = np.clip(s * soot * (1.5 if nm == "glass_in" else 0.8), 0, 1).astype(np.float32)
                    f.lay_island(s, color="#0a0908", opacity=0.97, rough=0.92)

    th.paint = paint
    return th
