#!/usr/bin/env python3
"""The skin's detail layer (docs/GODOT_LOOK.md §5d, DECISIONS 2026-10-30, night): what no bake on MHR's shared UVs can
hold, drawn by Godot's skin shader (HSSkin) at its true size from textures made here once and kept in the look plugin
(`addons/horrorstudio_look/textures/`). A face's texel in the export's normal map is 0.35 mm; a pore's opening is
0.05 to 0.15 mm across and the furrows between them a fiftieth of a millimetre wide, so they're tiles laid over the
skin at their real size, the size read from the island's own metres:

  skin_pores.png        10 mm of skin in 1024 px: the follicles' openings, about 130 a cm², each a pit in a shallow
                        funnel, a few drawn out; HSSkin lays it twice, the second turned and larger, so the cheek gets
                        the 250 to 300 a cm² measured on the reference (docs/research/skin_v2.md §1) and no tile repeats
  skin_micro.png        5 mm in 1024 px: the furrows' network (cells about 0.55 mm and finer ones about 0.23 mm, half
                        what shows once it's laid twice), a little cushion in each cell, a fine grain
                        (both: RG the normal, OpenGL's way: +Y up the picture; B how open the skin is there, 1 a plateau
                        and 0 the floor of a pit or a furrow: the cavity, which darkens and dulls)
  skin_tone.png         40 mm in 1024 px, the colour's own unevenness (a scanned face has it; a painted one hasn't):
                        R the melanin (a mottle of 1 to 2 mm, a few blotches of 5, faint brown specks 0.3 to 1 mm), G the
                        blood (redder and paler patches of 0.6 to 5 mm), B a fine grain; 0.5 the skin's own colour
  mhr_skin_regions.png  MHR's UV layout in 1024 px (every Studio export and the bake's bodies share it): R how much
                        the pores show (the nose most, the cheeks beside it, the chin and the forehead, then the rest
                        of the face; the lids, the lips and the body little), G the furrows (the lids' fine crepe
                        most, the nose least), B the lips (their lines instead), A which of MHR's two texel densities
                        the island has: 0 the head's and the hands' (about 0.72 m a UV unit), 1 the body's and the
                        legs' (about 1.9): HSSkin lays the tiles at a constant scale for each and blends where they
                        meet (a scale that changed across the skin would squeeze the pattern where it changes)
  mhr_skin_depth.png    MHR's UV layout in 1024 px, where light shows that has travelled under the skin (the skin's
                        depth layer, docs/GODOT_LOOK.md §5g): R round the eyes (the lids, their creases, the inner
                        corners, under them), G the nose (its tip, its wings and the creases round them, the nostrils),
                        B the ears (all of each, their folds most: the shader's switch for ears under hair), A the
                        mouth's corners and the creases round it; each the region times how deep a crease it is (MHR's
                        own surface under its neighbourhood's, a centimetre or so across: the creases most, what bulges
                        out least, never nothing inside the region)

The regions come from where MediaPipe's 468 points sit on MHR (Content/Studio/Bodies/MHR_landmarks.json, face_mesh.py's
landmarks op kept as data). Plain numpy and Pillow; seeded, so a run makes the same files.

    python tools/skin_detail.py tiles | regions | depth | all | check
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look" / "textures"
BODIES = ROOT / "Content" / "Studio" / "Bodies"
N = 1024
PORE_MM, MICRO_MM, TONE_MM = 10.0, 5.0, 40.0   # the tiles' sizes (HSSkin's detail_metres is the pores' tile; the micro is half, the tone four times)
SEED = 20261030


def blur(a, sigma):
    """a Gaussian blur on a torus (the tiles wrap), sigma in pixels"""
    f = np.fft.fftfreq(a.shape[0])
    g = np.exp(-2.0 * (np.pi * sigma) ** 2 * (f[:, None] ** 2 + f[None, :] ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def worley(n, cells, rng, warp=0.0, wide=1.0):
    """F1 and F2 (cell units) over an n x n torus with one jittered seed a cell, `cells` across and `wide` times as
    many down (cells drawn out across: skin's lines run one way more than the other), the place bent by a slow field
    `warp` cells deep (the furrows wander instead of running straight)"""
    cy_n = int(round(cells * wide))
    seeds = 0.1 + 0.8 * rng.random((cy_n, cells, 2))
    y, x = np.mgrid[0:n, 0:n] + 0.5
    x, y = x * (cells / n), y * (cy_n / n)
    if warp:
        wx, wy = (blur(rng.standard_normal((n, n)), n / cells / 1.5) for _ in range(2))
        x, y = x + wx * (warp / wx.std()), y + wy * (warp / wy.std())
    cx, cy = np.floor(x).astype(int), np.floor(y).astype(int)
    f1 = np.full((n, n), 9.0)
    f2 = np.full((n, n), 9.0)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            gx, gy = cx + dx, cy + dy
            s = seeds[gy % cy_n, gx % cells]
            d = np.hypot(gx + s[..., 0] - x, gy + s[..., 1] - y)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            f1 = np.where(closer, d, f1)
    return f1, f2


def smooth_field(rng, n, sigma, lo, hi):
    """a slow random field between lo and hi (the furrows' depth along them)"""
    a = blur(rng.standard_normal((n, n)), sigma)
    a = (a - a.min()) / (a.max() - a.min() + 1e-12)
    return lo + (hi - lo) * a


def normals(h, px_mm):
    """the height (mm) as normals, OpenGL's way (+X along the picture's rows, +Y up it)"""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * px_mm)
    dy = -(np.roll(h, -1, 0) - np.roll(h, 1, 0)) / (2 * px_mm)
    nrm = np.stack([-dx, -dy, np.ones_like(h)], -1)
    return nrm / np.linalg.norm(nrm, axis=-1, keepdims=True)


def cavity(h, sigma_px, ref_mm):
    """1 on the plateau, toward 0 down a pit or a furrow: the height against its neighbourhood's"""
    return np.clip(1.0 + (h - blur(h, sigma_px)) / ref_mm, 0.0, 1.0)


def pores_height(rng):
    """10 mm of skin: about 130 openings a cm² (one in nine cells of 0.83 mm left out), 0.15 mm across at the median
    and up to 0.4 (a face's visible pores: 0.02 to 0.1 mm² of opening), each a Gaussian pit as deep as half its radius
    in a funnel 2.8 times as wide, a few drawn out up to 1.6 times; under them a fine grain"""
    n, px = N, PORE_MM / N
    h = np.zeros((n, n))
    cells = 12
    for cy in range(cells):
        for cx in range(cells):
            if rng.random() > 0.9:
                continue
            c = (np.array([cx, cy]) + 0.15 + 0.7 * rng.random(2)) * (n / cells)
            r = float(np.clip(rng.lognormal(np.log(0.075), 0.4), 0.03, 0.2)) / px
            depth = 0.5 * r * px
            ang, asp = rng.random() * np.pi, 1.0 + 0.6 * rng.random() ** 2
            R = int(np.ceil(6.0 * r * asp)) + 2
            ys, xs = np.mgrid[-R:R + 1, -R:R + 1]
            fx, fy = np.floor(c).astype(int)
            ox, oy = xs + fx + 0.5 - c[0], ys + fy + 0.5 - c[1]
            ca, sa = np.cos(ang), np.sin(ang)
            u, v = (ox * ca + oy * sa) / asp, -ox * sa + oy * ca
            q = (u * u + v * v) / (r * r)
            np.add.at(h, ((fy + ys) % n, (fx + xs) % n), -depth * (np.exp(-2.2 * q) + 0.22 * np.exp(-q / 7.8)))
    g = blur(rng.standard_normal((n, n)), 1.2)
    return h + g * (0.0015 / g.std())


def micro_height(rng):
    """5 mm of skin: the furrows' network, cells about 0.55 mm drawn out a quarter one way, their lines wandering
    (V-grooves 22 µm wide and up to 30 µm deep, some fading out along their length), finer ones about 0.23 mm inside
    them, each cell a cushion (its edge 11 µm under its middle: the pebbled look under a low light, which is what
    survives at a few pixels a cell), and a fine grain"""
    n = N
    f1, f2 = worley(n, 9, rng, warp=0.12, wide=1.25)
    e1 = (f2 - f1) * (MICRO_MM / 9)
    D, W = 0.022, 0.022
    h = -D * smooth_field(rng, n, 28, 0.0, 1.4) ** 1.3 * np.exp(-(e1 / W) ** 2)
    h -= 1.0 * D * f1 ** 2
    g1, g2 = worley(n, 22, rng, warp=0.18, wide=1.2)
    e2 = (g2 - g1) * (MICRO_MM / 22)
    h -= 0.45 * D * smooth_field(rng, n, 18, 0.0, 1.4) ** 1.5 * np.exp(-(e2 / (0.6 * W)) ** 2)
    g = blur(rng.standard_normal((n, n)), 1.0)
    return h + g * (0.0012 / g.std())


def tone_tile(rng):
    """40 mm of skin's colour: R melanin (mostly a mottle of 1 to 2 mm, some blotches of 5 mm, faint specks 0.3 to 1 mm,
    ten a cm²), G blood (patches of 0.6 to 5 mm), B a grain of 0.1 mm; each 0.5 on average, about 0.12 either way"""
    n, px = N, TONE_MM / N

    def band(*sig_mm):
        a = sum(w * blur(rng.standard_normal((n, n)), s / px) for s, w in sig_mm)
        return (a - a.mean()) / (a.std() + 1e-12)
    mel = band((0.8, 0.5), (2.0, 0.6), (5.0, 0.35))
    spk = np.zeros((n, n))
    for _ in range(int(10 * (TONE_MM / 10) ** 2)):
        c, r = rng.random(2) * n, float(np.clip(rng.lognormal(np.log(0.25), 0.4), 0.15, 0.6)) / px
        R = int(3 * r) + 2
        ys, xs = np.mgrid[-R:R + 1, -R:R + 1]
        fx, fy = np.floor(c).astype(int)
        q = ((xs + fx + 0.5 - c[0]) ** 2 + (ys + fy + 0.5 - c[1]) ** 2) / (r * r)
        np.add.at(spk, ((fy + ys) % n, (fx + xs) % n), (0.4 + rng.random()) * np.exp(-q))
    mel = mel + spk / (spk.std() + 1e-12) * 0.45
    mel = (mel - mel.mean()) / mel.std()
    red = band((0.6, 0.4), (2.0, 0.7), (5.0, 0.3))
    grain = band((0.1, 1.0))
    rgb = np.stack([0.5 + 0.12 * mel, 0.5 + 0.12 * red, 0.5 + 0.12 * grain], -1)
    return np.clip(rgb, 0.0, 1.0)


def tile_png(h, px_mm, ref_mm, path):
    from PIL import Image
    nrm = normals(h, px_mm)
    cav = cavity(h, 10, ref_mm)
    rgb = np.stack([nrm[..., 0] * 0.5 + 0.5, nrm[..., 1] * 0.5 + 0.5, cav], -1)
    Image.fromarray(np.clip(np.round(rgb * 255), 0, 255).astype(np.uint8), "RGB").save(path, optimize=True)
    return dict(tilt=float(np.degrees(np.arccos(np.clip(nrm[..., 2], -1, 1))).mean()), cavity=float(cav.mean()))


def cmd_tiles(_a):
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)
    p = tile_png(pores_height(rng), PORE_MM / N, 0.02, OUT / "skin_pores.png")
    m = tile_png(micro_height(rng), MICRO_MM / N, 0.015, OUT / "skin_micro.png")
    from PIL import Image
    t = tone_tile(rng)
    Image.fromarray(np.round(t * 255).astype(np.uint8), "RGB").save(OUT / "skin_tone.png", optimize=True)
    print(f"skin_pores.png: {PORE_MM:g} mm, mean tilt {p['tilt']:.1f}°, cavity {p['cavity']:.2f}")
    print(f"skin_micro.png: {MICRO_MM:g} mm, mean tilt {m['tilt']:.1f}°, cavity {m['cavity']:.2f}")
    print(f"skin_tone.png: {TONE_MM:g} mm, melanin {t[..., 0].std():.3f}, blood {t[..., 1].std():.3f}, grain {t[..., 2].std():.3f} either way")


# ---- the regions, on MHR's body, into its UV layout ------------------------------------------------------------------

LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
EYES = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
        263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]


def landmarks(m):
    j = json.loads((BODIES / "MHR_landmarks.json").read_text(encoding="utf-8"))
    tri, bary = np.array(j["tri"]), np.array(j["bary"])
    return (m["points"][m["tris"][tri]] * bary[:, :, None]).sum(1)


def inside(poly, pts):
    """each point (x, y) inside the polygon (x, y)"""
    c = np.zeros(len(pts), bool)
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        cross = ((yi > pts[:, 1]) != (yj > pts[:, 1])) & (pts[:, 0] < (xj - xi) * (pts[:, 1] - yi) / (yj - yi + 1e-12) + xi)
        c ^= cross
        j = i
    return c


def fields(m):
    """each of MHR's points: pores, furrows, lips (0..1)"""
    P = m["points"]
    lm = landmarks(m)
    top = P[:, 1].max()

    def near(i, r):
        d = (P - lm[i]) / r
        return np.exp(-(d * d).sum(1))

    def ramp(x, a, b):
        t = np.clip((x - a) / (b - a), 0.0, 1.0)
        return t * t * (3 - 2 * t)

    head = ramp(P[:, 1], top - 0.33, top - 0.26)                          # down the neck to the shoulders: the body's
    face = head * ramp(P[:, 2] - lm[234][2], -0.01, 0.03)                  # in front of the cheeks' sides (234, 454)
    nose = np.max([near(4, 0.018), near(1, 0.016), near(5, 0.014), near(195, 0.012), 0.9 * near(129, 0.011), 0.9 * near(358, 0.011),
                   0.8 * near(98, 0.01), 0.8 * near(327, 0.01)], 0)
    cheek = np.max([near(205, 0.022), near(425, 0.022), 0.8 * near(50, 0.022), 0.8 * near(280, 0.022), 0.7 * near(36, 0.016), 0.7 * near(266, 0.016)], 0)
    brow = np.max([near(151, 0.045), near(9, 0.025), 0.8 * near(108, 0.03), 0.8 * near(337, 0.03)], 0)
    chin = np.max([near(152, 0.02), near(199, 0.02), near(200, 0.016)], 0)
    lipskin = np.max([near(164, 0.012), 0.8 * near(167, 0.01), 0.8 * near(393, 0.01)], 0)
    eye = np.max([near(i, 0.009) for i in EYES], 0) * face
    # the lips: inside their outer ring seen from the front, eased over a millimetre
    ring = lm[LIPS_OUTER][:, :2]
    front = P[:, 2] > lm[LIPS_OUTER][:, 2].min() - 0.012
    lips = (inside(ring, P[:, :2]) & front).astype(float)
    centre = lm[LIPS_OUTER].mean(0)
    lips *= np.exp(-((P - centre) ** 2).sum(1) / 0.04 ** 2) > 0.05
    pores = 0.3 + 0.12 * head + 0.15 * face
    pores = np.max([pores, nose * 1.0, cheek * 0.9 * face, brow * 0.75 * face, chin * 0.75 * face, lipskin * 0.6 * face], 0)
    pores *= (1 - 0.88 * eye) * (1 - lips)
    furrows = 0.7 - 0.1 * face
    furrows = furrows * (1 - 0.45 * nose) + 0.45 * eye
    furrows = np.clip(furrows, 0, 1) * (1 - lips)
    return np.stack([pores, furrows, lips], 1)


# ---- where light has travelled under the skin (the depth layer, GODOT_LOOK §5g) ---------------------------------------

EYE_UPPER = [247, 30, 29, 27, 28, 56, 190, 467, 260, 259, 257, 258, 286, 414]          # MediaPipe's rows: the upper lid's crease
EYE_SULCUS = [113, 225, 224, 223, 222, 221, 189, 342, 445, 444, 443, 442, 441, 413]    # above it, under the brow
EYE_LOWER = [130, 25, 110, 24, 23, 22, 26, 112, 243, 359, 255, 339, 254, 253, 252, 256, 341, 463]
EYE_UNDER = [226, 31, 228, 229, 230, 231, 232, 233, 244, 446, 261, 448, 449, 450, 451, 452, 453, 464]
EYE_INNER = [133, 362, 243, 463, 244, 464, 189, 413]
NOSE_TIP = [1, 4, 2, 19, 94]
NOSE_WINGS = [98, 327, 129, 358, 64, 294, 48, 278, 102, 331, 49, 279, 115, 344, 219, 439, 218, 438, 240, 460, 75, 305,
              235, 455, 166, 392, 79, 309, 237, 457, 242, 462, 97, 326, 99, 328, 141, 370, 44, 274, 45, 275, 220, 440, 125, 354]
MOUTH_CORNERS = [61, 291, 57, 287]
DEPTH_BASE = (0.55, 0.6, 0.75, 0.35)    # the eyes', nose's, ears' and mouth's depth where the skin bulges out (1 in a crease)


def creases(m, rings=3):
    """each of MHR's points: how far under its neighbourhood's surface it lies along its normal, in mm (the surface's
    points averaged `rings` times, about a centimetre on the face): + in a crease (the eyes' corners, round the nose's
    wings, the ears' folds), - where it bulges out (the nose's tip, the lips, the ears' rims)"""
    P, T = m["points"], m["tris"]
    n = len(P)
    fn = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    vn = np.zeros_like(P)
    for k in range(3):
        np.add.at(vn, T[:, k], fn)
    vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
    E = np.unique(np.sort(np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]), 1), axis=0)
    deg = np.maximum(np.bincount(E.ravel(), minlength=n), 1).astype(float)[:, None]
    Q = P.copy()
    for _ in range(rings):
        s = np.zeros_like(Q)
        np.add.at(s, E[:, 0], Q[E[:, 1]])
        np.add.at(s, E[:, 1], Q[E[:, 0]])
        Q = s / deg
    return ((Q - P) * vn).sum(1) * 1000.0


def ear_frame(m):
    """the ears on MHR's base: the middle of what stands out past the skull at their height (the head's widest points
    there, mirrored) and its spread up and back"""
    P, lm = m["points"], landmarks(m)
    s = (np.abs(P[:, 0]) > 0.075) & (np.abs(P[:, 1] - lm[234][1]) < 0.06) & (P[:, 2] < lm[234][2]) & (P[:, 2] > lm[234][2] - 0.1)
    return np.array([np.abs(P[s, 0]).mean(), P[s, 1].mean(), P[s, 2].mean()]), P[s].std(0)


def depth_fields(m):
    """each of MHR's points: the eyes, the nose, the ears, the mouth (0..1), each its region times how deep a crease
    it lies in (DEPTH_BASE where it bulges out)"""
    P = m["points"]
    lm = landmarks(m)
    top = P[:, 1].max()

    def near(i, r):
        d = (P - lm[i]) / r
        return np.exp(-(d * d).sum(1))

    def ring(ids, r, w=1.0):
        return w * np.max([near(i, r) for i in ids], 0)

    def ramp(x, a, b):
        t = np.clip((x - a) / (b - a), 0.0, 1.0)
        return t * t * (3 - 2 * t)

    head = ramp(P[:, 1], top - 0.33, top - 0.26)
    face = head * ramp(P[:, 2] - lm[234][2], -0.01, 0.03)
    eyes = np.max([ring(EYES, 0.009), ring(EYE_UPPER, 0.009), ring(EYE_SULCUS, 0.009, 0.8), ring(EYE_LOWER, 0.008),
                   ring(EYE_UNDER, 0.008, 0.6), ring(EYE_INNER, 0.011)], 0) * face
    nose = np.max([ring(NOSE_TIP, 0.012), ring(NOSE_WINGS, 0.008), ring([5, 195], 0.010, 0.5)], 0) * face
    mouth = np.max([ring(MOUTH_CORNERS, 0.009), ring([164, 0], 0.007, 0.5), ring([18], 0.009, 0.5),
                    ring([92, 322, 186, 410, 165, 391], 0.008, 0.45)], 0) * face
    c, _ = ear_frame(m)                                                     # an ellipse seen from the side, out past the skull: the
    dy, dz = P[:, 1] - c[1], P[:, 2] - c[2]                                 # helix's top 2.7 cm over the middle, the lobe 4.6 under,
    er = np.hypot(dz / np.where(dz > 0, 0.029, 0.025), dy / np.where(dy > 0, 0.027, 0.046))   # its back 2.5 (the skull round the ear left out)
    ears = (1 - ramp(er, 0.8, 1.05)) * ramp(np.abs(P[:, 0]), c[0] - 0.016, c[0] - 0.008) * head
    cav = ramp(creases(m), 0.0, 1.2)
    return np.stack([r * (b + (1 - b) * cav) for r, b in zip((eyes, nose, ears, mouth), DEPTH_BASE)], 1)


METRES = (0.72, 1.9)                    # the metres one UV unit spans on MHR's head and hands (its UVs' lower half), and on its body and legs (the upper)


def densities(m):
    """each triangle's metres a UV unit, and which of MHR's two densities it belongs to (0 the head's and the hands':
    the UVs' lower half; 1 the body's: the upper)"""
    T, UV, P = m["tris"], m["uv"], m["points"]
    a3 = 0.5 * np.linalg.norm(np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]), axis=1)
    u, v = UV[:, 1] - UV[:, 0], UV[:, 2] - UV[:, 0]
    auv = 0.5 * np.abs(u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0])
    return np.sqrt(a3 / np.maximum(auv, 1e-14)), (UV[:, :, 1].mean(1) < 0.5).astype(float), a3, auv


def raster(UV, vals, n):
    """the triangles (UV corners, m x 3 x 2, row = v) filled with their corners' values (m x 3 x k) blended: (n, n, k), covered"""
    k = vals.shape[2]
    img = np.zeros((n, n, k))
    cov = np.zeros((n, n), bool)
    for t in range(len(UV)):
        tri = UV[t] * n - 0.5
        x0, y0 = np.maximum(np.floor(tri.min(0)).astype(int), 0)
        x1, y1 = np.minimum(np.ceil(tri.max(0)).astype(int), n - 1)
        if x1 < x0 or y1 < y0:
            continue
        ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1]
        (ax, ay), (bx, by), (cx, cy) = tri
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-12:
            continue
        w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d
        w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d
        w2 = 1 - w0 - w1
        e = -0.02
        s = (w0 >= e) & (w1 >= e) & (w2 >= e)
        if not s.any():
            continue
        W = np.stack([w0[s], w1[s], w2[s]], 1)
        img[ys[s], xs[s]] = W @ vals[t]
        cov[ys[s], xs[s]] = True
    return img, cov


def dilate(img, cov, rings=12):
    """the empty texels round the islands from their neighbours (so a filtered read at an island's edge pulls in its
    own values), the rest the mean"""
    img, cov = img.copy(), cov.copy()
    for _ in range(rings):
        s = np.zeros_like(img)
        c = np.zeros(cov.shape)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx or dy:
                    s += np.roll(np.roll(img * cov[..., None], dy, 0), dx, 1)
                    c += np.roll(np.roll(cov.astype(float), dy, 0), dx, 1)
        grow = (~cov) & (c > 0)
        img[grow] = s[grow] / c[grow][:, None]
        cov = cov | grow
    img[~cov] = img[cov].mean(0)
    return img


def cmd_regions(_a):
    from PIL import Image
    sys.path.insert(0, str(ROOT / "tools" / "character"))
    import mhr
    m = mhr.load()
    f = fields(m)
    dens, coarse, a3, auv = densities(m)
    vals = np.concatenate([f[m["tris"]], np.repeat(coarse[:, None, None], 3, 1)], 2)   # (tris, 3 corners, 4)
    img, cov = raster(m["uv"], vals, N)
    img = dilate(img, cov)
    Image.fromarray(np.clip(np.round(img * 255), 0, 255).astype(np.uint8), "RGBA").save(OUT / "mhr_skin_regions.png", optimize=True)
    fine = coarse < 0.5
    print(f"mhr_skin_regions.png: {cov.mean():.0%} covered; metres a UV unit: the head's and hands' "
          f"{np.sqrt(a3[fine].sum() / auv[fine].sum()):.2f} (HSSkin takes {METRES[0]}), the body's {np.sqrt(a3[~fine].sum() / auv[~fine].sum()):.2f} ({METRES[1]})")


def cmd_depth(_a):
    from PIL import Image
    sys.path.insert(0, str(ROOT / "tools" / "character"))
    import mhr
    m = mhr.load()
    f = depth_fields(m)
    img, cov = raster(m["uv"], f[m["tris"]], N)
    img = dilate(img, cov)
    Image.fromarray(np.clip(np.round(img * 255), 0, 255).astype(np.uint8), "RGBA").save(OUT / "mhr_skin_depth.png", optimize=True)
    print("mhr_skin_depth.png: " + ", ".join(f"{k} on {np.mean(f[:, i] > 0.1):.1%} of MHR's points" for i, k in enumerate(("eyes", "nose", "ears", "mouth"))))


PROBES = {"inner corner": 133, "upper crease": 27, "cheek": 205, "forehead": 151, "nose wing": 64, "nose tip": 4,
          "mouth corner": 61, "chin": 152, "alar crease": 48,                     # the face's right (-x) by MediaPipe's index
          "inner corner +x": 362, "upper crease +x": 257, "nose wing +x": 294, "alar crease +x": 278, "cheek +x": 425,
          "lower lip": 16, "upper lip": 11}                                       # the lips' middles (17 and 0 their borders, 12 by their parting)


def probe_uvs(m):
    """points on MHR's skin by their UV (its layout, every Studio export's): the PROBES landmarks, each ear's middle (the
    point of it furthest out, near the ear frame's middle: "ear +x", "ear -x"), a finger of the +x hand (2 cm back from
    its furthest tip, the point most forward there: "finger +x") and the chest"""
    J = json.loads((BODIES / "MHR_landmarks.json").read_text(encoding="utf-8"))
    luv = (m["uv"][np.array(J["tri"])] * np.array(J["bary"])[:, :, None]).sum(1)
    P, T = m["points"], m["tris"]

    def uv_of(p):                                                            # the UV of MHR's corner nearest a point
        i = int(np.argmin(np.linalg.norm(P - p, axis=1)))
        t, k = np.argwhere(T == i)[0]
        return m["uv"][t, k]
    out = {k: luv[i] for k, i in PROBES.items()}
    c, _ = ear_frame(m)
    for side, sx in (("ear +x", 1.0), ("ear -x", -1.0)):
        s = np.linalg.norm(P - c * [sx, 1, 1], axis=1) < 0.02
        out[side] = uv_of(P[s][np.argmax(np.abs(P[s, 0]))])
    tip = P[np.argmax(P[:, 0])]
    wrist = P[(P[:, 0] > 0.5) & (P[:, 0] < 0.51)].mean(0)
    at = tip + 0.02 * (wrist - tip) / np.linalg.norm(wrist - tip)
    s = np.linalg.norm(P - at, axis=1) < 0.008
    out["finger +x"] = uv_of(P[s][np.argmax(P[s, 2])])
    out["chest"] = uv_of(np.array([0.0, P[:, 1].max() - 0.45, P[np.abs(P[:, 1] - (P[:, 1].max() - 0.45)) < 0.01, 2].max()]))
    return {k: [round(float(v[0]), 4), round(float(v[1]), 4)] for k, v in out.items()}


def hands_quarter(m):
    """skin_wet.gdshader's rule for MHR's hands (the depth layer's fingers): its UVs' quarter past u 0.5 and v 0.5. Returns
    how far out the nearest of that quarter's triangles lies (metres from the middle: the wrist, about 0.5) and how many
    of the hands' own (past 0.55 m) lie outside it (none)"""
    tc, uvc = m["points"][m["tris"]].mean(1), m["uv"].mean(1)
    q = (uvc[:, 0] > 0.5) & (uvc[:, 1] > 0.5)
    return float(np.abs(tc[q, 0]).min()), int(((np.abs(tc[:, 0]) > 0.55) & ~q).sum())


def depth_at(m, r):
    """the depth map's RGBA at the probes (probe_uvs)"""
    return {k: r[min(N - 1, int(v * N)), min(N - 1, int(u * N))] for k, (u, v) in probe_uvs(m).items()}


def cmd_check(_a):
    """the files there and as made: the tiles wrap (their edges meet), their normals point out and lean as skin does,
    the regions put the nose's pores over the lids' and the body's, and the lips' mask on the lips"""
    from PIL import Image
    bad = []
    for name, mm in (("skin_pores.png", PORE_MM), ("skin_micro.png", MICRO_MM), ("skin_tone.png", TONE_MM)):
        p = OUT / name
        if not p.exists():
            bad.append(f"{name} missing (python tools/skin_detail.py tiles)")
            continue
        a = np.asarray(Image.open(p).convert("RGB")).astype(float) / 255.0
        nx, ny = a[..., 0] * 2 - 1, a[..., 1] * 2 - 1
        nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
        tilt = float(np.degrees(np.arccos(nz)).mean())
        rows = np.abs(a[1:] - a[:-1]).mean((1, 2))                                        # each pair of neighbouring rows
        cols = np.abs(a[:, 1:] - a[:, :-1]).mean((0, 2))
        seam = float(max(np.abs(a[0] - a[-1]).mean() / np.percentile(rows, 99), np.abs(a[:, 0] - a[:, -1]).mean() / np.percentile(cols, 99)))
        inner = 1.0                                                                         # across the wrap against the rows' 99th percentile
        if a.shape[:2] != (N, N):
            bad.append(f"{name}: {a.shape[1]} x {a.shape[0]}, not {N}")
        if name != "skin_tone.png" and not 3.0 < tilt < 40.0:
            bad.append(f"{name}: mean tilt {tilt:.1f}° (skin's relief leans 3 to 40°)")
        if name == "skin_tone.png" and not all(abs(a[..., k].mean() - 0.5) < 0.03 for k in range(3)):
            bad.append(f"{name}: not the skin's own colour on average ({a.reshape(-1, 3).mean(0).round(3)})")
        if seam > 1.3 * inner:
            bad.append(f"{name}: its edges don't meet (across the wrap {seam:.2f} of the rows' 99th percentile)")
        what = f"spread {a.reshape(-1, 3).std(0).round(3)}" if name == "skin_tone.png" else f"mean tilt {tilt:.1f}°, cavity {a[..., 2].mean():.2f}"
        print(f"  ok  {name}: {mm:g} mm, {what}, its edges meet (across the wrap {seam:.2f} of the rows' 99th percentile)")
    p = OUT / "mhr_skin_regions.png"
    if p.exists():
        sys.path.insert(0, str(ROOT / "tools" / "character"))
        import mhr
        m = mhr.load()
        r = np.asarray(Image.open(p).convert("RGBA")).astype(float) / 255.0
        lm = landmarks(m)
        J = json.loads((BODIES / "MHR_landmarks.json").read_text(encoding="utf-8"))
        luv = (m["uv"][np.array(J["tri"])] * np.array(J["bary"])[:, :, None]).sum(1)

        def at(i):
            u, v = luv[i]
            return r[min(N - 1, int(v * N)), min(N - 1, int(u * N))]
        nose, lid, lip, chin = at(4), at(159), at(13), at(152)
        body = r[int(0.3 * N), int(0.25 * N)]
        checks = [(nose[0] > 0.8, "the nose's pores %.2f (over 0.8)" % nose[0]), (lid[0] < 0.25, "the lid's %.2f (under 0.25)" % lid[0]),
                  (lid[1] > nose[1], "the lid's furrows %.2f over the nose's %.2f" % (lid[1], nose[1])), (lip[2] > 0.7, "the lips' mask %.2f on the lips" % lip[2]),
                  (chin[2] < 0.2, "and %.2f on the chin" % chin[2]), (nose[3] < 0.1, "the face laid at the head's density (%.2f)" % nose[3]),
                  (body[3] > 0.9, "the body at the body's (%.2f)" % body[3])]
        for ok, what in checks:
            print(("  ok  " if ok else "  BAD ") + what)
            if not ok:
                bad.append(what)
        del lm
    else:
        bad.append("mhr_skin_regions.png missing (python tools/skin_detail.py regions)")
    p = OUT / "mhr_skin_depth.png"
    if p.exists():                                                          # the depth layer's regions: each where it belongs, the ears apart (their switch)
        sys.path.insert(0, str(ROOT / "tools" / "character"))
        import mhr
        mm = mhr.load()
        d = depth_at(mm, np.asarray(Image.open(p).convert("RGBA")).astype(float) / 255.0)
        near, out = hands_quarter(mm)
        checks = [(d["inner corner"][0] > 0.7, "round the eyes: the inner corner %.2f (over 0.7)" % d["inner corner"][0]),
                  (d["upper crease"][0] > 0.4, "the upper lid's crease %.2f (over 0.4)" % d["upper crease"][0]),
                  (d["nose wing"][1] > 0.5 and d["nose tip"][1] > 0.5, "the nose: its wing %.2f, its tip %.2f (over 0.5)" % (d["nose wing"][1], d["nose tip"][1])),
                  (d["mouth corner"][3] > 0.4, "the mouth's corner %.2f (over 0.4)" % d["mouth corner"][3]),
                  (min(d["ear +x"][2], d["ear -x"][2]) > 0.6, "the ears %.2f and %.2f (over 0.6)" % (d["ear +x"][2], d["ear -x"][2])),
                  (max(d["cheek"].max(), d["forehead"].max(), d["chin"].max(), d["chest"].max()) < 0.15,
                   "nothing on the cheek, the forehead, the chin or the chest (at most %.2f)" % max(d["cheek"].max(), d["forehead"].max(), d["chin"].max(), d["chest"].max())),
                  (max(d["nose tip"][2], d["inner corner"][2], d["mouth corner"][2], d["ear +x"][0], d["ear +x"][1]) < 0.05,
                   "the ears' channel off the face and the face's off the ears (at most %.2f)" % max(d["nose tip"][2], d["inner corner"][2], d["mouth corner"][2], d["ear +x"][0], d["ear +x"][1])),
                  (near > 0.45 and out == 0, "MHR's hands are its UVs' quarter past u 0.5 and v 0.5 (the shader's fingers): nothing in it nearer the middle than %.2f m, %d of the hands' triangles outside it" % (near, out))]
        for ok, what in checks:
            print(("  ok  " if ok else "  BAD ") + "depth: " + what)
            if not ok:
                bad.append("depth: " + what)
    else:
        bad.append("mhr_skin_depth.png missing (python tools/skin_detail.py depth)")
    for b in bad:
        print("  BAD " + b)
    print("SKINDETAIL ok" if not bad else "SKINDETAIL FAIL")
    return 1 if bad else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("op", choices=["tiles", "regions", "depth", "all", "check"])
    a = ap.parse_args()
    if a.op in ("tiles", "all"):
        cmd_tiles(a)
    if a.op in ("regions", "all"):
        cmd_regions(a)
    if a.op in ("depth", "all"):
        cmd_depth(a)
    if a.op == "check":
        return cmd_check(a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
