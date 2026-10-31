"""Dolls. A wara-ningyo: the straw effigy of the ushi no koku mairi, bundles of straw bound at its neck, waist, wrists
and ankles, loose stalks sticking out, a paper slip on its chest with a name brushed on it and a forged gosun kugi (a
five-sun nail) driven through it, its point out of the back where the tree would be (`socket_nail_tip`). A kokeshi:
a turned wooden doll, its round head on a plain body, painted with a few brush strokes: the black bob and its fringe,
the sleepy eyes, a small red mouth, red rings from the lathe and chrysanthemums down its front.

    {"family": "doll", "kind": "wara" | "kokeshi", "name": "山田花子", "nails": 1, "straw": "#c2a66c",
     "height": 200 (a kokeshi's), "colors": ["#b8232b", "#3d6b35", "#16110f"] (its red, green, black), "eyes": "sleepy" | "open"}
"""
import math

import numpy as np

from .. import designs
from .. import finish as FN
from .. import mesh as M
from .. import noise as N

MM = 0.001


def _line(a, b, n=8):
    a, b = np.asarray(a, float), np.asarray(b, float)
    return a[None] + (b - a)[None] * np.linspace(0, 1, n)[:, None]


def _radii(t, at, r):
    return np.interp(t, at, r)


def nail(head_at, direction, length, I, island="nail", head_island="nail_head", seed=0):
    """A forged nail (mm): a square shank tapering to its point, a flat, uneven head; returns it and its tip."""
    d = np.asarray(direction, float)
    d /= np.linalg.norm(d)
    up = np.array([0.0, 0.0, 1.0]) if abs(d[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    u = np.cross(d, up)
    u /= np.linalg.norm(u)
    w = np.cross(d, u)
    r = N.rng(seed, "nail")
    k = 12
    t = np.linspace(0, 1, k)
    half = 3.0 * (1 - t ** 1.6) + 0.15
    bend = np.stack([np.zeros(k), r.uniform(-0.6, 0.6) * t ** 2, r.uniform(-0.6, 0.6) * t ** 2], 1)
    sq = np.array([(1, 1), (-1, 1), (-1, -1), (1, -1)], float)
    verts, f, uv = [], [], []
    for i in range(k):
        c = np.asarray(head_at, float) + d * length * t[i] + u * bend[i, 1] + w * bend[i, 2]
        for a, b in sq:
            verts.append(c + (u * a + w * b) * half[i])
    tip = np.asarray(head_at, float) + d * (length + 1.5)
    verts.append(tip)
    isl = I[island]
    for i in range(k - 1):
        for j in range(4):
            j1 = (j + 1) % 4
            f.append([i * 4 + j, i * 4 + j1, (i + 1) * 4 + j1, (i + 1) * 4 + j])
            uv.append(isl.to_uv(np.array([j, j + 1, j + 1, j]) / 4, np.array([t[i], t[i], t[i + 1], t[i + 1]])))
    for j in range(4):
        j1 = (j + 1) % 4
        f.append([(k - 1) * 4 + j, (k - 1) * 4 + j1, len(verts) - 1, -1])
        uv.append(np.concatenate([isl.to_uv(np.array([j, j + 1, j + 0.5]) / 4, np.ones(3)), [[0, 0]]]))
    shank = M.Mesh(np.array(verts) * MM, f, np.array(uv), mats=["iron"], smooth=False)
    shank.a["rest"] = shank.v.copy()
    # the head: a flat disc hammered out of round, its rim thinner
    a = np.linspace(0, 2 * math.pi, 18, endpoint=False)
    rr = 7.0 * (1 + 0.12 * N.fbm3(np.stack([np.cos(a), np.sin(a), np.full_like(a, seed * 0.3)], 1), seed, 2))
    ring = np.stack([rr * np.cos(a), rr * np.sin(a)], 1)
    hd = M.slab([ring * MM], 2.4 * MM, 0.9 * MM, I, head_island, head_island, head_island, steps=2)
    v = hd.v / MM
    hd.v = (np.asarray(head_at, float)[None] - d[None] * 1.2 + v[:, :1] * u[None] - v[:, 1:2] * w[None] - v[:, 2:3] * d[None]) * MM
    hd.mats = ["iron"]
    hd.a["rest"] = hd.v.copy()
    return [shank, hd], tip


def wara(spec, th):
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "wara")
    straw = spec.get("straw", "#c2a66c")
    th.material("main", "fabric", color=straw, rough=0.85)
    th.material("paper", "paper", color="#efe8d6", rough=0.85, px=512)
    nails = int(spec.get("nails", 1))
    if nails:
        th.material("iron", "metal", color="#4a4540", rough=0.6, metal=1.0, px=256)
        th.island("nail", 24, 150, mat="iron", wrap=True)
        th.island("nail_head", 16, 16, mat="iron")
    # the bundles: (name, path, radii at fractions, caps)
    bundles = [
        ("torso", _line((0, 0, 106), (0, 0, 201), 12), ([0, 0.3, 0.6, 0.9, 1], [21, 23.5, 24, 21.5, 16]), (False, False)),
        ("head", _line((0, 0, 196), (0, -1.5, 262), 12), ([0, 0.15, 0.4, 0.65, 0.88, 1], [14, 20, 24, 23, 18, 8]), (False, True)),
        ("arms", _line((-80, 0, 170), (80, 0, 170), 16), ([0, 0.1, 0.25, 0.75, 0.9, 1], [10.5, 8.6, 8, 8, 8.6, 10.5]), (True, True)),
        ("leg_l", _line((-11, 0, 114), (-18, -2, 0), 10), ([0, 0.5, 0.86, 1], [12, 11, 10.5, 12.8]), (False, True)),
        ("leg_r", _line((11, 0, 114), (18, -2, 0), 10), ([0, 0.5, 0.86, 1], [12, 11, 10.5, 12.8]), (False, True)),
    ]
    ties = [((0, 0, 199.5), (0, 0, 1), 15.8), ((0, 0, 110), (0, 0, 1), 21.5), ((-60, 0, 170), (1, 0, 0), 9.0), ((60, 0, 170), (1, 0, 0), 9.0),
            ((-16.6, -1.6, 20), (0, 0, 1), 11.4), ((16.6, -1.6, 20), (0, 0, 1), 11.4), ((0, 0, 150), (0, 0, 1), 23.8)]
    for nm, path, (at, rad), caps in bundles:
        th.island(nm, 2 * math.pi * max(rad), M.arclen(path) + 10, wrap=True)
    th.island("tie", 2 * math.pi * 1.6, 2 * math.pi * 24, wrap=True)
    th.island("strays", 30, 40)
    th.island("slip", 26, 64, mat="paper")
    th.island("slip_back", 26, 64, mat="paper")
    th.pack()
    I = th.islands
    parts = []
    for nm, path, (at, rad), caps in bundles:
        sl = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))])
        t = sl / sl[-1]
        rr = _radii(t, at, rad) * (1 + 0.04 * N.fbm3(np.stack([t * 4, np.zeros_like(t), np.full_like(t, len(nm))], 1), seed, 2))
        parts.append(M.tube(path * MM, rr * MM, I[nm], n=16, caps=caps, cap_bulge=0.18 if nm != "head" else 0.5))
    for c, ax, rad in ties:
        parts.append(M.tube(M.ring_path(c, ax, rad, 24) * MM, 1.7 * MM, I["tie"], n=6))
    # loose stalks: out of the bundles, a little bent
    for i in range(int(spec.get("strays", 34))):
        nm, path, (at, rad), caps = bundles[r.integers(len(bundles))]
        t0 = r.uniform(0.05, 0.95)
        p = path[0] + (path[-1] - path[0]) * t0
        ax = (path[-1] - path[0]) / np.linalg.norm(path[-1] - path[0])
        ang = r.uniform(0, 2 * math.pi)
        up = np.array([0.0, 0.0, 1.0]) if abs(ax[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
        e1 = np.cross(ax, up)
        e1 /= np.linalg.norm(e1)
        e2 = np.cross(ax, e1)
        out = math.cos(ang) * e1 + math.sin(ang) * e2
        rad0 = _radii(t0, at, rad)
        L = r.uniform(10, 28)
        lean = ax * r.choice([-1, 1]) * r.uniform(0.6, 1.4)
        pts = np.array([p + out * rad0 * 0.7, p + out * (rad0 + L * 0.4) + lean * L * 0.3, p + out * (rad0 + L * 0.75) + lean * L * 0.75 + (0, 0, -L * 0.1)])
        parts.append(M.tube(pts * MM, np.array([0.75, 0.6, 0.35]) * MM, I["strays"], n=4))
    # the name slip on its chest, pinned by the nail
    slip = M.sheet(0.026, 0.064, 0.008, I, front="slip", back="slip_back", thick=0.0003, mats=["paper"])
    v = slip.v.copy()
    slip.v = np.stack([v[:, 0], -v[:, 2] - 0.0245, v[:, 1] + 0.152], 1)
    slip.v[:, 1] -= (np.abs(v[:, 0]) / 0.013) ** 2 * 0.0012 * -1
    slip.a["rest"] = slip.v.copy()
    parts.append(slip)
    tip_at = None
    spots = [(0, 160), (0, 228), (-6, 128)]
    for ni in range(min(nails, len(spots))):
        x, z = spots[ni]
        ps, tip = nail((x, -48, z + 2), (0.02 * ni, 1, -0.06 - 0.03 * ni), 150, I, seed=seed + ni)
        parts += ps
        tip_at = tip_at if tip_at is not None else tip
    th.low = M.join(parts, ["main", "paper"] + (["iron"] if nails else []))
    th.high = None
    if tip_at is not None:
        th.sockets["nail_tip"] = (tip_at * MM, (0, 1, 0))
        th.sockets["nail_head"] = (np.array([0, -48, 162]) * MM, (0, -1, 0))
    th.pose = "stand"
    th.view = {"azim": -22, "elev": 14}
    name = spec.get("name", "山田花子")

    def paint(fr):
        base = designs.P.rgb(straw)
        for nm in [b[0] for b in bundles] + ["tie", "strays"]:
            f = fr[nm]
            X, Y = f.grid()
            i = sum(map(ord, nm))
            stalk = np.floor(X / 1.8 + 0.3 * N.fbm3(np.stack([X / 7, Y / 40, np.full_like(X, i)], -1), seed + i, 2))
            shade = N.fbm3(np.stack([stalk * 0.71, Y / 80.0, np.full_like(X, i * 0.3)], -1), seed + 1, 2)
            col = base[None, None] * (1 + 0.34 * shade[..., None])
            dark = (N.fbm3(np.stack([stalk * 1.3, Y / 150.0, np.full_like(X, 9.0 + i)], -1), seed + 3, 2) > 0.34)[..., None]
            col = np.where(dark, col * 0.7, col)
            fr_ = np.abs(((X / 1.8) % 1.0) - 0.5) * 2
            f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.86, height=(0.18 * (1 - fr_ ** 2)).astype(np.float32))
            if nm in ("tie",):
                f.stripes(2.0, 0.5, angle=55, height=0.08)
        f = fr["slip"]
        designs.paper_base(f, "#efe8d6", fibres=1.6, seed=seed, tint="#c9a85e")
        designs.tate_slot(f, "name", name, f.W / 2, f.H - 6, min(8.5, (f.H - 12) / max(len(name), 1) / 1.1), N.rng(seed, "name"),
                          "the name brushed on the slip", jitter=0.07, color="#17120f", rough=0.62, height=0.003)
        designs.paper_base(fr["slip_back"], "#efe8d6", fibres=1.6, seed=seed + 1, tint="#c9a85e")
        if nails:
            FN.metal(fr["nail"], "cast", "iron", seed + 5, age="rust", age_amount=0.75)
            FN.metal(fr["nail_head"], "hammered", "iron", seed + 6, age="rust", age_amount=0.6)

    th.paint = paint
    return th


def kokeshi(spec, th):
    seed = int(spec.get("seed", 0))
    Ht = float(spec.get("height", 200))
    s = Ht / 200.0
    red, green, black = spec.get("colors", ["#b8232b", "#3d6b35", "#16110f"])
    wood = spec.get("wood", "#e8d2a6")
    th.material("main", "wood", color=wood, rough=0.4)
    body = [(0, 0), (23, 0), (24, 1.5), (24, 6), (22.5, 8), (21.5, 20), (21, 80), (20.2, 125), (19, 136), (16, 142), (12, 146), (10.5, 148), (0, 148)]
    body = [(x * s, z * s) for x, z in body]
    z0, Rh = 145.5 * s, 25.0 * s
    a = np.radians(np.linspace(-70, 90, 24))
    head = [(Rh * math.cos(t), z0 + 24 * s + Rh * math.sin(t)) for t in a]
    head[-1] = (0.0, head[-1][1])
    th.island("base", 48 * s, 48 * s)
    th.island("body", 2 * math.pi * 24 * s, M.arclen(body[3:-2]), wrap=True)
    th.island("neck", 2 * math.pi * 12 * s, M.arclen(body[-3:]), wrap=True)
    th.island("head", 2 * math.pi * Rh, M.arclen(head), wrap=True)
    th.pack()
    I = th.islands
    bm = M.lathe([M.Seg(np.array(body[:4]) * MM, "base", "bottom", disc=24 * s * MM), M.Seg(np.array(body[3:-2]) * MM, "body", "band"),
                  M.Seg(np.array(body[-3:]) * MM, "neck", "band")], 48, I, step=0.004, mats=["main"])
    hm = M.lathe([M.Seg(np.array(head) * MM, "head", "band")], 48, I, step=0.003, mats=["main"])
    th.low = M.join([bm, hm], ["main"])
    th.high = None
    th.pose = "stand"
    th.view = {"azim": -8, "elev": 12}
    eyes = spec.get("eyes", "sleepy")

    def paint(fr):
        rng = N.rng(seed, "kokeshi")
        ink = dict(rough=0.35, height=0.004)
        for nm in ("base", "body", "neck", "head"):
            designs.wood_grain(fr[nm], {"color": wood, "ring": 2.6}, N.rng(seed, nm))
            fr[nm].fill(color=wood, rough=0.38, alpha=0.45)
        f = fr["body"]
        W, H = f.W, f.H

        def rings(bands):
            for y, c, w in bands:
                f.rect(0, y - w / 2, W, w, color=c, **ink)
        f.slot("rings_top", (W / 2, H - 9.25, W, 8.5), lambda: rings(((H - 6, red, 1.6), (H - 9.5, green, 1.0), (H - 12.5, red, 1.6))),
               kind="flourish", about="the lathe's rings round its shoulder", **ink)
        f.slot("rings_foot", (W / 2, 7.85, W, 7.9), lambda: rings(((5, red, 1.8), (8.5, black, 0.8), (11, red, 1.2))),
               kind="flourish", about="the lathe's rings round its foot", **ink)
        # chrysanthemums down the front (the band's middle is the front), smaller ones round the back
        flowers = ((W / 2, H * 0.58, 13 * s), (W / 2 - 3, H * 0.3, 9 * s), (W / 2 + 26 * s, H * 0.44, 7 * s), (W / 2 - 27 * s, H * 0.45, 7 * s),
                   (5, H * 0.5, 6 * s), (W - 5, H * 0.52, 6 * s))

        def chrysanthemums():
            for cx, cy, R in flowers:
                n = 12
                for k in range(n):
                    ang = 2 * math.pi * k / n + rng.uniform(-0.05, 0.05)
                    f.ellipse(cx + math.cos(ang) * R * 0.55, cy + math.sin(ang) * R * 0.55, R * 0.42, R * 0.14, rot=math.degrees(ang), color=red, **ink)
                f.ellipse(cx, cy, R * 0.22, color=black, **ink)
                for k in range(2):
                    ang = math.radians(-60 - 60 * k + rng.uniform(-15, 15))
                    f.ellipse(cx + math.cos(ang) * R * 1.25, cy + math.sin(ang) * R * 1.25, R * 0.5, R * 0.18, rot=math.degrees(ang) + 30, color=green, **ink)
        y0, y1 = min(cy - 1.8 * R for cx, cy, R in flowers), max(cy + R for cx, cy, R in flowers)    # its leaves below, its petals round
        f.slot("flowers", (W / 2, (y0 + y1) / 2, W, y1 - y0), chrysanthemums, kind="flourish",
               about="the chrysanthemums painted round its body", **ink)
        f = fr["head"]
        W, H = f.W, f.H
        cx = W / 2
        ye = H * 0.42

        def hair():
            # the black bob and its fringe, the side locks, red ornaments in the hair
            fringe = [(cx + d, H * 0.62 + 0.8 * math.sin(d * 0.9)) for d in np.linspace(14 * s, -14 * s, 9)]
            bob = [(-1, H + 2), (W + 1, H + 2), (W + 1, H * 0.2), (cx + 30 * s, H * 0.2), (cx + 19 * s, H * 0.3), (cx + 16 * s, H * 0.55),
                   (cx + 14 * s, H * 0.62)] + fringe + [(cx - 14 * s, H * 0.62), (cx - 16 * s, H * 0.55), (cx - 19 * s, H * 0.3), (cx - 30 * s, H * 0.2),
                                                       (-1, H * 0.2)]
            f.poly(bob, color=black, rough=0.3, height=0.004)
            for sx in (-1, 1):
                f.poly([(cx + sx * 16 * s, H * 0.6), (cx + sx * 19.5 * s, H * 0.58), (cx + sx * 18 * s, H * 0.26), (cx + sx * 15.5 * s, H * 0.3)], color=black,
                       rough=0.3, height=0.004)
                for k in range(5):
                    ang = 2 * math.pi * k / 5
                    f.ellipse(cx + sx * 24 * s + math.cos(ang) * 2.2 * s, H * 0.72 + math.sin(ang) * 2.2 * s, 1.8 * s, color=red, **ink)
                f.ellipse(cx + sx * 24 * s, H * 0.72, 1.0 * s, color="#e8c14a", **ink)
        f.slot("hair", (W / 2, H * 0.6, W, H * 0.8), hair, kind="picture",
               about="the black bob, its fringe and side locks, the red flowers in it", rough=0.3, height=0.004)

        def face():
            for sx in (-1, 1):
                ex = cx + sx * 8.5 * s
                # brows, then the eyes: a lid's stroke and the pupil under it
                f.line([(ex - 4.5 * s, ye + 7.5 * s), (ex, ye + 9 * s), (ex + 4.5 * s, ye + 7.5 * s)], 0.7 * s, color=black, **ink)
                if eyes == "sleepy":
                    f.line([(ex - 4.6 * s, ye + 0.4 * s), (ex - 1.5 * s, ye + 1.6 * s), (ex + 1.5 * s, ye + 1.6 * s), (ex + 4.6 * s, ye + 0.4 * s)], 0.9 * s,
                           color=black, **ink)
                    f.ellipse(ex, ye + 0.6 * s, 1.9 * s, 1.1 * s, color=black, **ink)
                else:
                    f.ellipse(ex, ye + 0.8 * s, 3.2 * s, 2.1 * s, color=black, **ink)
                    f.ellipse(ex + 0.8 * s, ye + 1.3 * s, 0.7 * s, color="#f2ece0", **ink)
            f.line([(cx, ye - 3 * s), (cx - 0.6 * s, ye - 6 * s), (cx + 0.5 * s, ye - 6.6 * s)], 0.6 * s, color=black, **ink)
            f.ellipse(cx, ye - 10.3 * s, 2.0 * s, 0.9 * s, color=red, **ink)
            f.ellipse(cx, ye - 11.6 * s, 1.5 * s, 0.8 * s, color=red, **ink)
        f.slot("face", (cx, ye - 1.5 * s, 27.4 * s + 0.6, 21.8 * s + 0.6), face, kind="picture",
               about="its face: the brows, the eyes, the nose and the little red mouth", **ink)

    th.paint = paint
    return th


def make(spec, th):
    return kokeshi(spec, th) if spec.get("kind") == "kokeshi" else wara(spec, th)
