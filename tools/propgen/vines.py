"""Vines as seamless PBR sets for walls (the user, 2026-11-02: "vine patterns, seamless so I can just place vines on
exterior buildings"): a tile of stems climbing a wall with leaves along them, drawn by code the way the trees' leaf
clusters are (families/tree.py, families/plant.py's leaf outlines) or laid from a leaf set's real leaves
(leafset.py), every stroke repeated across the tile's edges so it repeats both ways with no seam. Each set is a
folder on the project's own shelf (`pbr/foliage/vine_<kind>/`): its colour with the opacity as alpha, the opacity
alone, a normal map from the leaves' and stems' relief, the roughness, and a meta.json with its size (a metre a
repeat). A set lies over any wall set in the street paint as a layer with its own opacity as the mask
(`{"set": "pbr/foliage/vine_ivy", "mask": "own"}`, storykit/pbrmix.py), on a slot of its own (the desk cuts it out by
the opacity map), or on a vine prop.

    python tools/propgen.py vines [ivy ivy_real creeper creeper_autumn bare] [--px 1024] [--out pbr/foliage]
"""
import json
import math
import os

import numpy as np

from . import leafset as LS
from . import noise as N
from . import paint as P
from . import surface as S
from .families import plant as PL
from .families import tree as TR
from .mesh import Island
from .paint import rgb

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "pbr", "foliage")

KINDS = {
    "ivy": {"label": "vine: English ivy, dense, drawn leaves (a metre a repeat)", "leaf": "ivy", "stems": 9, "branches": (2, 5), "cover": 0.78,
            "leaf_mm": (60, 115), "spacing": 0.3, "colors": ["#2f5f2a", "#3f7a36", "#4f8a40"], "stem": "#5a4a3c", "gloss": 0.4, "climb": 0.5},
    "ivy_real": {"label": "vine: ivy in the leaf set's real leaves (pbr/leaf/LeafSet029), dense", "set": "pbr/leaf/LeafSet029_1K-PNG", "stems": 8,
                 "branches": (2, 5), "cover": 0.8, "leaf_mm": (60, 115), "spacing": 0.32, "colors": ["#3f7a36"], "stem": "#5a4a3c", "gloss": 0.45,
                 "climb": 0.5, "sat": 1.05, "light": 0.95},
    "creeper": {"label": "vine: a creeper, thin stems climbing, five-lobed leaves, the wall showing through", "leaf": "palmate", "lobes": 5,
                "stems": 5, "branches": (1, 3), "cover": 0.42, "leaf_mm": (70, 120), "spacing": 0.55, "colors": ["#3a7a30", "#5a9a44", "#7ab050"],
                "stem": "#6a5648", "gloss": 0.45, "climb": 0.8},
    "creeper_autumn": {"label": "vine: the creeper turned crimson and orange in autumn", "leaf": "palmate", "lobes": 5, "stems": 5, "branches": (1, 3),
                       "cover": 0.42, "leaf_mm": (70, 120), "spacing": 0.55, "colors": ["#a8301e", "#c8502a", "#d88a2a", "#7a2418"], "stem": "#6a5648",
                       "gloss": 0.5, "climb": 0.8},
    "bare": {"label": "vine: bare dry stems in winter, a few dead leaves (a horror wall)", "leaf": "ivy", "stems": 7, "branches": (1, 4), "cover": 0.08,
             "leaf_mm": (45, 70), "spacing": 2.6, "colors": ["#6a5a44", "#7a6a50"], "stem": "#5a5048", "gloss": 0.75, "climb": 0.7, "dead": True},
}


def _shifts(bbox, W, H):
    """The tile shifts a shape needs, from where its box crosses the edges."""
    x0, y0, x1, y1 = bbox
    xs = [0.0] + ([W] if x0 < 0 else []) + ([-W] if x1 > W else [])
    ys = [0.0] + ([H] if y0 < 0 else []) + ([-H] if y1 > H else [])
    return [(sx, sy) for sx in xs for sy in ys]


def _tiled_polys(f, polys, W, H, **props):
    allp = np.concatenate(polys)
    for sx, sy in _shifts((allp[:, 0].min(), allp[:, 1].min(), allp[:, 0].max(), allp[:, 1].max()), W, H):
        f.fill_polys([p + (sx, sy) for p in polys], **props)


def _tiled_line(f, pts, width, W, H, **props):
    p = np.asarray(pts, float)
    for sx, sy in _shifts((p[:, 0].min() - width, p[:, 1].min() - width, p[:, 0].max() + width, p[:, 1].max() + width), W, H):
        f.line(p + (sx, sy), width, **props)


def _stems(rng, W, H, n, climb, branches=(1, 4)):
    """Stems climbing the tile: each from a point along the bottom, wandering up (`climb` how straight), with a side
    branch or two; a stem leaving the top comes back at the bottom (the tile repeats), so every path is cut into the
    pieces the tile holds. Returns [(points (k, 2) mm, width mm)]."""
    out = []
    for i in range(n):
        x = (i + float(rng.uniform(0.15, 0.85))) / n * W
        y = float(rng.uniform(-H * 0.3, 0.0))
        ang = math.radians(90 + float(rng.uniform(-20, 20)))
        pts = [(x, y)]
        total = H * float(rng.uniform(1.0, 1.35))
        step = 22.0
        s = 0.0
        while s < total:
            ang += math.radians(float(rng.uniform(-18, 18))) * (1 - climb) * 2.2 + (math.radians(90) - ang) * 0.08 * climb
            x += math.cos(ang) * step
            y += math.sin(ang) * step
            pts.append((x, y))
            s += step
        w0 = float(rng.uniform(4.5, 7.5))
        out.append((np.array(pts), w0))
        # side branches off it, shorter, leaning out
        for j in range(int(rng.integers(branches[0], branches[1]))):
            k = int(rng.integers(3, max(4, len(pts) - 3)))
            bx, by = pts[k]
            bang = math.atan2(pts[k + 1][1] - pts[k - 1][1], pts[k + 1][0] - pts[k - 1][0]) + math.radians(float(rng.uniform(35, 75))) * (1 if j % 2 else -1)
            bpts = [(bx, by)]
            for q in range(int(rng.integers(5, 12))):
                bang += math.radians(float(rng.uniform(-14, 14))) + (math.radians(90) - bang) * 0.05
                bx += math.cos(bang) * step * 0.8
                by += math.sin(bang) * step * 0.8
                bpts.append((bx, by))
            out.append((np.array(bpts), w0 * 0.55))
    return out


def _wrap_pts(pts, W, H):
    """A path brought into the tile: every point taken modulo the tile (as separate pieces where it crosses)."""
    pieces, cur = [], []
    last = None
    for p in pts:
        q = (p[0] % W, p[1] % H)
        if last is not None and (abs(q[0] - last[0]) > W / 2 or abs(q[1] - last[1]) > H / 2):
            # it crossed an edge: end the piece on the far side of the edge, begin the next on the near side
            dx = (p[0] - prev[0], p[1] - prev[1])
            cur.append((last[0] + dx[0], last[1] + dx[1]))
            pieces.append(np.array(cur))
            cur = [(q[0] - dx[0], q[1] - dx[1])]
        cur.append(q)
        last, prev = q, p
    if len(cur) > 1:
        pieces.append(np.array(cur))
    return pieces


def make_vine(kind, px=1024, tile_m=1.0, out_dir=None, seed=7, say=print):
    K = KINDS[kind]
    rng = N.rng(seed, "vine", kind)
    W = H = tile_m * 1000.0
    cv = P.Canvas(px, px, K["colors"][0], 0.6, 0.0)
    isl = Island("vine", W, H, "vine")
    isl.rect = (0.0, 0.0, 1.0, 1.0)
    f = P.Frame(cv, isl, wrap=False)
    cols = [rgb(c) for c in K["colors"]]
    f.fill(color=K["colors"][0], opacity=0.0, rough=K["gloss"], height=0.0)
    cuts = LS.load(K["set"]) if K.get("set") else None
    stems = _stems(rng, W, H, K["stems"], K["climb"], K.get("branches", (1, 4)))
    stem_col = rgb(K["stem"])
    # the stems first, under the leaves: each a ridge (its height a bump along the line)
    for pts, w0 in stems:
        for piece in _wrap_pts(pts, W, H):
            n = len(piece)
            for i in range(n - 1):
                t = i / max(n - 1, 1)
                w = w0 * (1 - 0.45 * t)
                c = stem_col * float(rng.uniform(0.85, 1.1)) * (1 - 0.15 * t)
                seg = piece[i:i + 2]
                _tiled_line(f, seg, w, W, H, color=TR._hex(np.clip(c, 0, 1)), opacity=1.0, rough=0.82, height=w * 0.35)
                _tiled_line(f, seg, w * 0.4, W, H, color=TR._hex(np.clip(c * 1.2, 0, 1)), opacity=1.0, rough=0.78, height=w * 0.5)
    # the leaves: along every stem, alternately each side, their stalks a short line to the stem, the cover asked for
    lo_mm, hi_mm = K["leaf_mm"]
    leaves = []
    for pts, w0 in stems:
        seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        total = float(seg.sum())
        spacing = (lo_mm + hi_mm) / 2 * K.get("spacing", 0.5)
        n = max(1, int(total / spacing))
        for q in range(n):
            t = (q + 0.5) / n
            at = np.asarray(TR._along(pts, t))
            nxt = np.asarray(TR._along(pts, min(t + 0.02, 1.0)))
            d = math.degrees(math.atan2(nxt[0] - at[0], nxt[1] - at[1]))     # the stem's heading, 0 up, clockwise
            sgn = 1 if q % 2 else -1
            ang = d + sgn * float(rng.uniform(55, 110))
            L = float(rng.uniform(lo_mm, hi_mm)) * (0.75 + 0.25 * (1 - t))
            leaves.append((at, ang, L))
    if K.get("dead"):
        leaves = [lf for lf in leaves if rng.random() < 0.12]
    # the leaves drawn (or laid) in order along the tile from its top down, so lower leaves overlap the ones above
    leaves.sort(key=lambda lf: -lf[0][1])
    for at, ang, L in leaves:
        at = (at[0] % W, at[1] % H)
        # the stalk (petiole) from the stem out to the leaf's foot
        a = math.radians(ang)
        foot = (at[0] + math.sin(a) * L * 0.22, at[1] + math.cos(a) * L * 0.22)
        _tiled_line(f, [at, foot], 1.4, W, H, color=TR._hex(stem_col * 1.1), opacity=1.0, rough=0.8, height=0.4)
        c = cols[int(rng.integers(len(cols)))] * float(rng.uniform(0.86, 1.1))
        if cuts is not None:
            cut = cuts[int(rng.integers(len(cuts)))]
            tint = ("hue", {"sat": K.get("sat", 1.0), "light": K.get("light", 1.0)}) if ("sat" in K or "light" in K) else None
            for sx, sy in _shifts((foot[0] - L, foot[1] - L, foot[0] + L, foot[1] + L), W, H):
                LS.lay(f, cut, (foot[0] + sx, foot[1] + sy), ang, L, tint=tint, flip=rng.random() < 0.5, shade=float(rng.uniform(0.85, 1.08)), height=0.5)
            continue
        if K["leaf"] == "ivy":
            poly = PL._ivy(L, L * 0.95)
        else:
            poly = TR.leaf_poly("palmate", L, L * 1.05, rng, lobes=K.get("lobes", 5))
        if K.get("dead"):
            poly[:, 0] *= 0.7
        pts = TR._turn(poly, -ang, foot)
        _tiled_polys(f, [pts], W, H, color=TR._hex(np.clip(c, 0, 1)), opacity=1.0, rough=K["gloss"], height=1.4)
        rib = TR._hex(np.clip(c * (1.5 if not K.get("dead") else 0.7), 0, 1))
        _tiled_line(f, TR._turn(np.array([[0.0, L * 0.1], [0.0, L * 0.9]]), -ang, foot), 1.1, W, H, color=rib, opacity=1.0, height=-0.3)
        for i in range(1, 4):
            tt = 0.18 + 0.6 * i / 4
            for sg in (-1, 1):
                _tiled_line(f, TR._turn(np.array([[0.0, L * tt], [sg * L * 0.32 * (1 - tt * 0.5), L * (tt + 0.14)]]), -ang, foot), 0.8, W, H,
                            color=rib, opacity=1.0, alpha=0.7)
    # light and shade over it all (tiled noise: the flat torus in 4D), and the normal from the relief
    X, Y = f.grid()
    sh = TR._tiled(lambda p: N.fbm4(p, seed + 41, 2), X, Y, W, H, 90.0)
    f.lay_island(np.ones_like(X), color=np.clip(cols[0][None, None] * (1 + 0.45 * sh[..., None]), 0, 1).astype(np.float32), alpha=0.2)
    density = px / W
    nrm = S.height_normal(cv.height, density, 1.0)
    out_dir = out_dir or OUT
    d = os.path.join(out_dir, f"vine_{kind}")
    os.makedirs(d, exist_ok=True)
    base = os.path.join(d, f"vine_{kind}")
    P.write_png(base + "_albedo.png", np.concatenate([cv.col, cv.opacity[..., None]], -1))
    P.write_png(base + "_opacity.png", cv.opacity)
    P.write_png(base + "_normal.png", nrm * 0.5 + 0.5)
    P.write_png(base + "_roughness.png", cv.rough)
    meta = {"tile_m": tile_m, "label": K["label"], "source": "ours: tools/propgen.py vines (tools/propgen/vines.py)", "url": "", "licence": "ours",
            "note": "seamless both ways; its opacity cuts the wall out between the leaves: a layer with mask 'own' in the street paint, or a slot of its own"}
    with open(os.path.join(d, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=1, ensure_ascii=False)
    cover = float(cv.opacity.mean())
    say(f"  vine_{kind}: {px} px, {tile_m} m a repeat, {cover * 100:.0f}% leaf and stem -> {os.path.relpath(d, ROOT)}")
    return d, cover


def seam(path_png):
    """How far the tile's right edge is from its left and its top from its bottom, against the steps inside (0: no seam)."""
    a = P.read_image(path_png)[..., :3]
    inside = max(float(np.abs(np.diff(a, axis=1)).mean()), float(np.abs(np.diff(a, axis=0)).mean()), 1e-6)
    wrap = max(float(np.abs(a[:, 0] - a[:, -1]).mean()), float(np.abs(a[0] - a[-1]).mean()))
    return wrap / inside


def run(names, px=1024, out_dir=None, tile_m=1.0, seed=7):
    names = names or list(KINDS)
    done = []
    for n in names:
        if n not in KINDS:
            raise SystemExit(f"no vine {n!r}: one of {', '.join(KINDS)}")
        d, cover = make_vine(n, px=px, tile_m=tile_m, out_dir=out_dir, seed=seed)
        done.append((n, cover, seam(os.path.join(d, f"vine_{n}_albedo.png"))))
    print("PROPGEN vines: " + ", ".join(f"{n} ({c * 100:.0f}% cover, seam {s:.2f})" for n, c, s in done))
    return done
