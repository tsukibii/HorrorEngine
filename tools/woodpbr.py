#!/usr/bin/env python3
"""Wood sets made from code (the user, 2026-11-04: "the wooden inside floor tiles look very fake ... make a custom pbr
for japanese wooden floors, aim to capture the realism of the pbrs that we imported from other sources so nothing
stands out too much and looks more cohesive"): Japanese flooring (フローリング) and furniture woods, in the shape the
imported ambientCG sets have (`<Set>_Color`, `_NormalGL`, `_Roughness`, `_AmbientOcclusion`, `_Displacement`, a
meta.json with one repeat's real size), into the project's own sets in git: pbr/floor/<Set>/ and pbr/wood/<Set>/.

How the wood is made (docs/ASSETS.md §6d): every board its own cut of a log. The board's face lies a little off the
log's pith and at a slight slant to it, so its growth rings (each its own width, wandering) cut the face in the arches
flat-sawn boards show (cathedrals), or in near straight lines when the cut is far from the pith; each ring's earlywood
light and its latewood darker, a hard edge on one side and a soft one on the other; oak's earlywood full of open pores
(short dark dashes along the grain) and its rays as thin flecks; a board's own tone, warmth and long streaks; now and
then a pin knot the rings swirl round. Japanese sheet flooring: 303 x 1818 mm sheets of two boards (2P: a V-groove down
the middle, a micro-bevel at the sheet's edges), staggered; furniture wood: an edge-glued panel of strips. The finish
in the roughness (satin urethane or oil, open pores and grooves rougher, scratches, a dent), the grooves and pores in
the height, normal and occlusion. Made at twice the size and halved, so pores and rings are antialiased; tileable; its
colours kept to measured wood (sRGB a light oak floor about 200, 160, 115: the imported sets' own, never saturated).

    python tools/woodpbr.py [sets...] [--size 2048]     made into pbr/<category>/<Set>_2K-JPG/
    python tools/woodpbr.py list
    python tools/woodpbr.py check                       WOODPBR: every set tiles (its edges meet), its boards are
                                                        found as cells, its colours and roughness in wood's range

Plain Python with numpy and Pillow.
"""
import json
import math
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PBR = ROOT / "pbr"

# ---- the sets -----------------------------------------------------------------------------------------------------------
# colours sRGB: `base` the wood's ground, `band` its figure (a ring-porous wood's earlywood pore band, oak's dark lines;
# a diffuse-porous wood's latewood), `pore`, `knot`; a board's tone spread `vary`, and how far some boards go toward
# `greyc` (`grey`) or `warmc` (`warm`); `ring` mm between rings (each its own width, `ring_var`), `band_w` the share of a
# ring its band takes and `band_k` how dark it is; `porous` oak's open pores in the band (`pores`), `rays` its flecks;
# `straight` a share of boards cut far from the pith (straight grain); `knots` a share with a pin knot; `streaks`
# mineral streaks (birch); `fibre` the fine fibres along the grain; layout: `floor` sheets of `boards` of `board` mm
# across `sheet_len` long, or `panel` glued strips `strip` mm wide; finish: `rough` and its spread, `wear`.
SETS = {
    "FlooringOak001": dict(
        category="floor", label="Japanese flooring, oak, natural satin: 2P sheets (303 x 1818 mm), 151.5 mm boards",
        layout="floor", board=151.5, boards=2, sheet_len=1818.0, tile=1818.0,
        base="#d2ad7f", band="#9c7148", pore="#5e412b", knot="#5b3d27", greyc="#b9a487", warmc="#d9a874",
        vary=0.095, grey=0.55, warm=0.5, ring=3.4, ring_var=0.35, band_w=0.34, band_k=0.82, porous=True, pores=1.0, rays=1.0,
        straight=0.28, knots=0.05, streaks=0.0, fibre=1.0, rough=0.33, rough_var=0.04, wear=0.25, seed=11),
    "FlooringOak002": dict(
        category="floor", label="Japanese flooring, oak, medium brown stain, lived on: 2P sheets, 151.5 mm boards",
        layout="floor", board=151.5, boards=2, sheet_len=1818.0, tile=1818.0,
        base="#94693f", band="#5b3c22", pore="#2a1c11", knot="#2e1f14", greyc="#7f6750", warmc="#a06a3a",
        vary=0.1, grey=0.45, warm=0.4, ring=3.6, ring_var=0.35, band_w=0.36, band_k=0.85, porous=True, pores=1.2, rays=0.9,
        straight=0.28, knots=0.07, streaks=0.0, fibre=1.0, rough=0.36, rough_var=0.06, wear=0.7, seed=23),
    "FlooringBirch001": dict(
        category="floor", label="Japanese flooring, birch (kaba-zakura), warm natural: 2P sheets, 151.5 mm boards",
        layout="floor", board=151.5, boards=2, sheet_len=1818.0, tile=1818.0,
        base="#c69470", band="#9c6744", pore="#7d5236", knot="#5a3a26", greyc="#b39579", warmc="#c98a5c",
        vary=0.1, grey=0.35, warm=0.45, ring=2.8, ring_var=0.3, band_w=0.6, band_k=0.6, porous=False, pores=0.0, rays=0.0,
        straight=0.35, knots=0.05, streaks=0.6, fibre=0.7, rough=0.31, rough_var=0.04, wear=0.25, seed=37),
    "WoodOak001": dict(
        category="wood", label="oak, oiled: an edge-glued panel of 45-110 mm strips (furniture, tops, frames)",
        layout="panel", strip=(45.0, 110.0), tile=1200.0,
        base="#c9a375", band="#946a43", pore="#5a3e29", knot="#553925", greyc="#b29d80", warmc="#d4a370",
        vary=0.08, grey=0.45, warm=0.4, ring=3.2, ring_var=0.35, band_w=0.34, band_k=0.8, porous=True, pores=1.0, rays=1.0,
        straight=0.4, knots=0.03, streaks=0.0, fibre=1.0, rough=0.46, rough_var=0.05, wear=0.15, seed=51),
    "WoodWalnut001": dict(
        category="wood", label="walnut, oiled: an edge-glued panel of 45-110 mm strips (furniture, tops, frames)",
        layout="panel", strip=(45.0, 110.0), tile=1200.0,
        base="#7a5439", band="#4f3322", pore="#2b1c13", knot="#26180f", greyc="#6a5546", warmc="#87593a",
        vary=0.1, grey=0.4, warm=0.35, ring=3.8, ring_var=0.4, band_w=0.5, band_k=0.6, porous=True, pores=0.5, rays=0.0,
        straight=0.4, knots=0.04, streaks=0.3, fibre=0.9, rough=0.42, rough_var=0.05, wear=0.15, seed=67),
}


# ---- noise: a hashed lattice, smooth, as fast as numpy goes (no tables: no repeats) -------------------------------------

def _hash(ix, iy, seed):
    """A float in [0, 1) for each lattice point (int64 arrays)."""
    h = (ix.astype(np.uint64) * np.uint64(0x9E3779B97F4A7C15)) ^ (iy.astype(np.uint64) * np.uint64(0xC2B2AE3D27D4EB4F)) \
        ^ np.uint64((seed * 0x165667B19E3779F9) & 0xFFFFFFFFFFFFFFFF)
    h ^= h >> np.uint64(29)
    h *= np.uint64(0xBF58476D1CE4E5B9)
    h ^= h >> np.uint64(32)
    return (h >> np.uint64(11)).astype(np.float64) / float(1 << 53)


def vnoise(x, y, seed, period=None):
    """Smooth value noise in [-1, 1] at (x, y) in lattice units; `period` (px, py) lattice cells makes it tile."""
    xi, yi = np.floor(x), np.floor(y)
    fx, fy = x - xi, y - yi
    xi, yi = xi.astype(np.int64), yi.astype(np.int64)
    u = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    v = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    if period:
        px, py = period
        a0, a1, b0, b1 = xi % px, (xi + 1) % px, yi % py, (yi + 1) % py
    else:
        a0, a1, b0, b1 = xi, xi + 1, yi, yi + 1
    n00, n10, n01, n11 = _hash(a0, b0, seed), _hash(a1, b0, seed), _hash(a0, b1, seed), _hash(a1, b1, seed)
    return (n00 + (n10 - n00) * u + (n01 - n00) * v + (n00 - n10 - n01 + n11) * u * v) * 2 - 1


def fbm(x, y, seed, octaves=4, gain=0.5, period=None):
    s, a, tot = 0.0, 1.0, 0.0
    for o in range(octaves):
        k = 2 ** o
        s = s + a * vnoise(x * k, y * k, seed + o * 101, None if period is None else (period[0] * k, period[1] * k))
        tot += a
        a *= gain
    return s / tot


def noise1(t, seed, octaves=3):
    """1D fbm along t (lattice units)."""
    return fbm(t, np.zeros_like(t), seed, octaves)


# ---- colour ----------------------------------------------------------------------------------------------------------------

def lin(hexc):
    c = np.array([int(hexc[i:i + 2], 16) for i in (1, 3, 5)], np.float64) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---- the layouts: boards as rects of one repeat (mm), x along the grain --------------------------------------------------

def floor_boards(P, rng):
    """Sheets of `boards` boards across, one sheet long, staggered sheet by sheet (their end joints at least a fifth of
    a sheet apart): [(y0, width, x0 where it starts, its length, kind of its long edges)]."""
    T, B, n = P["tile"], P["board"], P["boards"]
    rows = int(round(T / B))
    out, prev = [], None
    for s in range(rows // n):
        while True:
            off = float(rng.uniform(0, T))
            if prev is None or min(abs(off - prev), T - abs(off - prev)) > T * 0.2:
                break
        prev = off
        for k in range(n):
            out.append(dict(y0=(s * n + k) * B, w=B, x0=off, L=P["sheet_len"], first=k == 0, last=k == n - 1))
    return out


def panel_boards(P, rng):
    """An edge-glued panel: strips of random width the whole repeat long (no end joints)."""
    T, (lo, hi) = P["tile"], P["strip"]
    ws = []
    while sum(ws) < T - lo:
        ws.append(float(rng.uniform(lo, hi)))
    ws[-1] += T - sum(ws)
    out, y = [], 0.0
    for w in ws:
        out.append(dict(y0=y, w=w, x0=float(rng.uniform(0, T)), L=T, first=True, last=True))
        y += w
    return out


# ---- a board: its rings, pores, rays, tone and knots ----------------------------------------------------------------------

def ring_table(P, rng, seed):
    """The rings counted from the pith out, each ring its own width (good years and lean ones, a slow trend among them):
    (radii where each ring starts, their widths)."""
    n = 400
    trend = np.exp(0.25 * noise1(np.arange(n) / 14.0, seed, 2))
    w = P["ring"] * trend * np.exp(rng.normal(0, P["ring_var"], n))
    w = np.clip(w, P["ring"] * 0.35, P["ring"] * 2.4)
    return np.concatenate([[0.0], np.cumsum(w)[:-1]]), w


def board(P, b, lx1, ly1, rng, seed):
    """One board at its own coordinates (mm: lx1 (columns) along it from its end, ly1 (rows) across from its edge):
    linear albedo (rows, cols, 3), height (mm), roughness. Every pattern along the grain repeats with the repeat (a
    glued panel's strips have no end joint to hide a seam in)."""
    W, T = b["w"], P["tile"]
    base, band_c, pore, knot = lin(P["base"]), lin(P["band"]), lin(P["pore"]), lin(P["knot"])
    greyc, warmc = lin(P["greyc"]), lin(P["warmc"])
    # its tone: lighter or darker, and how far it leans toward grey or warm
    tone = float(np.clip(rng.normal(1.0, P["vary"]), 0.82, 1.2))
    grey = float(rng.uniform(0, P["grey"]))
    warm = float(rng.uniform(0, P["warm"]))

    def per(scale):                                   # a lattice size along the grain that fits the repeat whole
        n = max(1, int(round(T / scale)))
        return T / n, n

    def along(scale, sd, octaves=3):                  # 1D noise along the grain, repeating with the repeat
        sx, n = per(scale)
        return fbm(lx1 / sx, np.zeros_like(lx1), sd, octaves, period=(n, 1 << 40))

    def both(sxa, sya, sd, octaves=3):               # 2D noise, repeating along the grain
        sx, n = per(sxa)
        return fbm(lx[None, :] / sx + 0 * ly[:, None], ly[:, None] / sya + 0 * lx[None, :], sd, octaves, period=(n, 1 << 40))

    def cell(sxa, sya, sd):                           # one octave of it
        sx, n = per(sxa)
        return vnoise(lx[None, :] / sx + 0 * ly[:, None], ly[:, None] / sya + 0 * lx[None, :], sd, period=(n, 1 << 40))
    lx, ly = lx1, ly1
    # the cut: the face h mm from the pith and slanting a little to its axis along the board (a floor board's face
    # straight, a glued strip's rising and falling slowly so its pattern repeats with the repeat): the rings it crosses
    # are the arches (cathedrals); the pith wandering across it; a board cut far from the pith shows near straight lines
    straight = rng.random() < P["straight"]
    floor = P["layout"] == "floor"
    if straight:
        h0, cy0 = float(rng.uniform(190, 360)), float(rng.uniform(-3.0, 4.0)) * W
        slant, amp = float(rng.uniform(-0.004, 0.004)), float(rng.uniform(2, 6))
    else:
        h0, cy0 = float(rng.uniform(55, 150)), float(rng.uniform(0.0, 1.0)) * W
        slant, amp = float(rng.uniform(0.006, 0.018)) * (1 if rng.random() < 0.5 else -1), float(rng.uniform(6, 16))
    ph = float(rng.uniform(0, 2 * math.pi))
    lx0 = float(rng.uniform(0.2, 0.8)) * T
    cy = cy0 + 0.22 * W * along(520.0, seed + 1) + 2.5 * along(110.0, seed + 2)
    tilt = slant * (lx - lx0) if floor else amp * np.sin(2 * math.pi * lx / T + ph)
    hh = np.maximum(np.abs(h0 + tilt + 5.0 * along(340.0, seed + 3)), 4.0)
    r = np.sqrt((ly[:, None] - cy[None, :]) ** 2 + (hh ** 2)[None, :])
    # the rings aren't smooth: they wave along the grain and wander
    r = r + 0.9 * both(70.0, 9.0, seed + 4, 3) + 0.3 * both(14.0, 2.4, seed + 5, 2)
    rows, cols = r.shape
    LX = np.broadcast_to(lx[None, :], (rows, cols))
    LY = np.broadcast_to(ly[:, None], (rows, cols))
    # a pin knot: the rings swirl round it, a brown core with a darker rim
    kmask = None
    if rng.random() < P["knots"]:
        kx, ky = float(rng.uniform(0.15, 0.85)) * T, float(rng.uniform(0.25, 0.75)) * W
        ks = float(rng.uniform(3.0, 6.0))
        dxk = (LX - kx + T / 2) % T - T / 2
        d2 = (dxk / (ks * 3.6)) ** 2 + ((LY - ky) / (ks * 1.4)) ** 2
        r = r + ks * 1.8 * np.exp(-d2 * 0.5)
        kd = np.sqrt((dxk / (ks * 1.3)) ** 2 + ((LY - ky) / ks) ** 2)
        kmask = (1 - smooth(0.7, 1.0, kd)) * (0.75 + 0.25 * smooth(0.35, 0.8, kd))
    starts, widths = ring_table(P, rng, seed + 6)
    k = np.clip(np.searchsorted(starts, r, side="right") - 1, 0, len(widths) - 1)
    phi = np.clip((r - starts[k]) / widths[k], 0, 1)
    # the figure: a ring-porous wood's earlywood band at each ring's start (a hard edge where the ring begins, fading into
    # the latewood), a diffuse-porous wood's latewood darkening toward the ring's end; broken by noise, not drawn
    jitter = 0.12 * both(9.0, 1.2, seed + 13, 2)
    if P["porous"]:
        band = (1 - smooth(0.0, P["band_w"], phi + jitter)) * smooth(-0.02, 0.05, phi)
    else:
        band = smooth(1 - P["band_w"], 1.0, phi + jitter)
    band = np.clip(band, 0, 1) * P["band_k"]
    # a board's ground: its tone and a lean toward grey or warm, streaks along the grain
    lean = rng.random()
    ground = base * (1 - grey) + greyc * grey if lean < 0.5 else base * (1 - warm) + warmc * warm
    figure = band_c * (1 - grey) + greyc * 0.6 * grey if lean < 0.5 else band_c * (1 - warm) + warmc * 0.7 * warm
    col = ground[None, None] * tone + (figure - ground)[None, None] * tone * band[..., None]
    col = col * (1 + 0.06 * both(190.0, 8.0, seed + 7, 3))[..., None]
    # fibres: fine light and dark threads along the grain
    if P["fibre"]:
        col = col * (1 + 0.045 * P["fibre"] * cell(5.0, 0.55, seed + 14) + 0.03 * P["fibre"] * cell(1.6, 0.3, seed + 15))[..., None]
    hgt = -0.018 * band
    rough = np.zeros_like(r)
    if P["porous"]:
        # open pores: dark specks crowded in the band, a few in the ground; a stain or the dust gathers in them
        sp = cell(1.3, 0.45, seed + 8)
        sp2 = cell(0.9, 0.35, seed + 9)
        pores = np.clip(band / max(P["band_k"], 1e-3) * smooth(0.05, 0.55, sp) + 0.25 * smooth(0.72, 0.92, sp2), 0, 1) * P["pores"]
        col = col + (pore[None, None] * tone - col) * (0.5 * np.minimum(pores, 1))[..., None]
        hgt = hgt - 0.035 * pores
        rough = rough + 0.08 * pores
    if P["rays"]:
        # rays seen end on (a flat-sawn face): thin dark dashes along the grain, 3 to 15 mm long
        rays = smooth(0.8, 0.94, cell(7.0, 0.5, seed + 10)) * P["rays"]
        col = col * (1 - 0.22 * rays)[..., None]
    if P["streaks"]:
        # mineral streaks (birch, maple): a grey-brown thread along the grain here and there
        ms = smooth(0.58, 0.82, both(260.0, 2.2, seed + 11, 2)) * P["streaks"]
        grey_brown = col.mean(axis=-1, keepdims=True) * np.array([0.8, 0.74, 0.68])
        col = col + (grey_brown - col) * (0.55 * ms)[..., None]
    if kmask is not None:
        core = knot[None, None] * tone * (0.85 + 0.3 * cell(0.9, 0.9, seed + 12))[..., None]
        col = col + (core - col) * kmask[..., None]
        hgt = hgt - 0.02 * kmask
    # the board's own height: a few hundredths up or down, its edges a little higher (cupping)
    e = (LY / W - 0.5) * 2
    hgt = hgt + float(rng.uniform(-0.035, 0.035)) + 0.025 * e * e
    return col, hgt, rough


# ---- a whole repeat ---------------------------------------------------------------------------------------------------------

def blur_wrap(a, rad):
    """A box blur of radius `rad` pixels each way, wrapping (the repeat tiles), done twice (near a Gaussian)."""
    for _ in range(2):
        for ax in (0, 1):
            c = np.cumsum(np.concatenate([np.take(a, range(-rad - 1, 0), axis=ax), a, np.take(a, range(0, rad), axis=ax)], axis=ax), axis=ax)
            n = a.shape[ax]
            hi = np.take(c, range(2 * rad + 1, 2 * rad + 1 + n), axis=ax)
            lo = np.take(c, range(0, n), axis=ax)
            a = (hi - lo) / (2 * rad + 1)
    return a


def make(name, size=2048, ss=2):
    P = dict(SETS[name])
    rng = np.random.default_rng(P["seed"])
    T = P["tile"]
    N = size * ss
    px = T / N                                                # mm a (supersampled) pixel
    xs = (np.arange(N) + 0.5) * px
    alb = np.zeros((N, N, 3))
    hgt = np.zeros((N, N))
    rgh = np.zeros((N, N))
    boards = floor_boards(P, rng) if P["layout"] == "floor" else panel_boards(P, rng)
    groove = np.zeros((N, N))
    for i, b in enumerate(boards):
        r0, r1 = int(round(b["y0"] / px)), int(round((b["y0"] + b["w"]) / px))
        ly1 = (np.arange(r0, r1) + 0.5) * px - b["y0"]
        lx1 = (xs - b["x0"]) % T
        col, h, rg = board(P, b, lx1, ly1, np.random.default_rng(P["seed"] * 1000 + i), P["seed"] * 7919 + i * 131)
        ly = np.broadcast_to(ly1[:, None], h.shape)
        lx = np.broadcast_to(lx1[None, :], h.shape)
        alb[r0:r1], hgt[r0:r1], rgh[r0:r1] = col, h, rg
        # its edges: the long ones a V-groove (the sheet's own groove inside it, a micro-bevel at the sheet's edge), its
        # ends a butt joint with a micro-bevel; a glued panel's strips meet in a hairline
        if P["layout"] == "floor":
            d_long = np.minimum(ly, b["w"] - ly)
            gw, gd = (1.0, 0.75) if not (b["first"] and b["last"]) else (0.9, 0.6)
            g = np.clip(1 - d_long / gw, 0, 1) ** 1.6 * gd
            d_end = np.minimum(lx, b["L"] - lx) if b["L"] < T else np.minimum(lx, T - lx)
            g = np.maximum(g, np.clip(1 - d_end / 0.7, 0, 1) ** 1.6 * 0.5)
        else:
            d_long = np.minimum(ly, b["w"] - ly)
            g = np.clip(1 - d_long / 0.25, 0, 1) * 0.04
        groove[r0:r1] = np.maximum(groove[r0:r1], g)
    hgt = hgt - groove
    gmask = np.clip(groove / 0.5, 0, 1)
    alb = alb * (1 - 0.55 * gmask)[..., None]
    # the finish: satin urethane (or oil), rougher in the grooves and open pores, a broad unevenness, scratches, dents
    yy, xx = np.meshgrid(xs, xs, indexing="ij")
    per = 6
    broad = fbm(xx / T * per, yy / T * per, P["seed"] + 500, 3, period=(per, per))
    rgh = P["rough"] + P["rough_var"] * broad + rgh + 0.35 * gmask
    srng = np.random.default_rng(P["seed"] + 900)
    n_scr = int(60 * P["wear"] * (T / 1000) ** 2) + 4
    scr = np.zeros((N, N))
    for _ in range(n_scr):
        x0, y0 = srng.uniform(0, T, 2)
        ang = srng.uniform(0, math.pi) if srng.random() < 0.5 else srng.normal(0, 0.25)
        ln = srng.uniform(15, 140)
        wd = srng.uniform(0.15, 0.35)
        dx, dy = math.cos(ang), math.sin(ang)
        # the scratch's own small patch (wrapped), not the whole repeat
        ext = ln / 2 + 2
        c0, c1 = int((x0 - ext) / px), int((x0 + ext) / px)
        q0, q1 = int((y0 - ext) / px), int((y0 + ext) / px)
        cols, rows = np.arange(c0, c1) % N, np.arange(q0, q1) % N
        X = (np.arange(c0, c1) + 0.5) * px - x0
        Y = (np.arange(q0, q1) + 0.5) * px - y0
        Xg, Yg = np.meshgrid(X, Y)
        t = np.clip(Xg * dx + Yg * dy, -ln / 2, ln / 2)
        dist = np.hypot(Xg - t * dx, Yg - t * dy)
        fade = 1 - np.abs(t) / (ln / 2)
        s = np.clip(1 - dist / wd, 0, 1) * np.sqrt(np.clip(fade, 0, 1)) * srng.uniform(0.4, 1.0)
        scr[np.ix_(rows, cols)] = np.maximum(scr[np.ix_(rows, cols)], s)
    hgt = hgt - 0.012 * scr
    rgh = rgh + 0.1 * scr
    alb = alb * (1 + 0.05 * scr)[..., None]                    # a scratch through the finish catches light paler
    for _ in range(int(14 * P["wear"] * (T / 1000) ** 2) + 2):
        x0, y0 = srng.uniform(0, T, 2)
        rad = srng.uniform(1.0, 3.5)
        ext = rad * 3
        c0, c1 = int((x0 - ext) / px), int((x0 + ext) / px)
        q0, q1 = int((y0 - ext) / px), int((y0 + ext) / px)
        cols, rows = np.arange(c0, c1) % N, np.arange(q0, q1) % N
        X = (np.arange(c0, c1) + 0.5) * px - x0
        Y = (np.arange(q0, q1) + 0.5) * px - y0
        Xg, Yg = np.meshgrid(X, Y)
        dent = np.exp(-(Xg ** 2 + Yg ** 2) / (rad * rad)) * srng.uniform(0.03, 0.09)
        hgt[np.ix_(rows, cols)] -= dent
    rgh = np.clip(rgh, 0.12, 0.95)
    # halved: the antialiased maps
    def half(a):
        return a.reshape(size, ss, size, ss, *a.shape[2:]).mean(axis=(1, 3))
    alb, hgt, rgh = half(alb), half(hgt), half(rgh)
    p = T / size
    # occlusion: what's lower than round it (grooves, pores) darker
    cav = np.clip(blur_wrap(hgt, max(1, int(round(1.6 / p)))) - hgt, 0, None)
    ao = np.clip(1 - cav / 0.22, 0.35, 1.0)
    # the normal from the height (OpenGL: green up, the picture's rows down)
    dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) / (2 * p)
    dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) / (2 * p)
    n = np.stack([-dx, dy, np.ones_like(dx)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    disp = np.clip(0.5 + hgt / 2.0, 0, 1)                      # a millimetre up or down from mid grey
    return dict(albedo=alb, normal=n, rough=rgh, ao=ao, height=disp, boards=boards, P=P)


def save(name, m, size):
    from PIL import Image
    P = m["P"]
    folder = f"{name}_{size // 1024}K-JPG"
    d = PBR / P["category"] / folder
    d.mkdir(parents=True, exist_ok=True)
    out = {}
    for key, word, img in (("albedo", "Color", to_srgb(m["albedo"])), ("normal", "NormalGL", m["normal"] * 0.5 + 0.5),
                           ("rough", "Roughness", m["rough"]), ("ao", "AmbientOcclusion", m["ao"]), ("height", "Displacement", m["height"])):
        a = (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
        f = f"{folder}_{word}.jpg"
        Image.fromarray(a, "RGB" if a.ndim == 3 else "L").save(d / f, quality=94 if key in ("albedo", "normal") else 92, subsampling=0 if key == "normal" else 2)
        out[key] = f
    meta = {"maps": out, "normal": "gl", "tile_m": round(P["tile"] / 1000.0, 4), "source": f"ours: tools/woodpbr.py {name}",
            "url": "", "licence": "ours", "label": P["label"]}
    (d / "meta.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for f in d.glob("_thumb.jpg"):
        f.unlink()
    return d


def stats(m):
    a = to_srgb(m["albedo"]).reshape(-1, 3) * 255
    return {"mean": a.mean(0).round(0).tolist(), "std": a.std(0).round(1).tolist(), "rough": round(float(m["rough"].mean()), 3)}


def main(argv):
    args = list(argv)
    size = 2048
    if "--size" in args:
        i = args.index("--size")
        size = int(args[i + 1])
        del args[i:i + 2]
    if args and args[0] == "list":
        for k, v in SETS.items():
            print(f"  {k:18} pbr/{v['category']}/{k}_2K-JPG  {v['tile'] / 1000:g} m  {v['label']}")
        return 0
    if args and args[0] == "check":
        return check()
    names = args or list(SETS)
    for n in names:
        if n not in SETS:
            sys.exit(f"no set {n}: {', '.join(SETS)}")
        t = time.time()
        m = make(n, size)
        d = save(n, m, size)
        print(f"  {n}: {d.relative_to(ROOT)}  {stats(m)}  ({time.time() - t:.0f} s)")
    print(f"WOODPBR made {len(names)}")
    return 0


def check():
    """WOODPBR: each set made small tiles (its opposite edges alike), its boards found as cells (the kit floor lays its
    real boards there), its colour a wood's (not saturated, in a floor's lightness) and its roughness a finish's."""
    sys.path.insert(0, str(ROOT / "Content" / "Python"))
    bad = []
    for n, P in SETS.items():
        m = make(n, 512, 2)
        a = m["albedo"]
        # along the grain the boards run on across the repeat's edge: as alike there as a step inside; across it the
        # repeat's edge is a joint between two boards: as alike as the joints inside it
        seam_x = float(np.abs(a[:, 0] - a[:, -1]).mean()) / max(float(np.abs(a[:, 0] - a[:, 1]).mean()), 1e-6)
        nrows = a.shape[0]
        rows = sorted({int(round(b["y0"] / P["tile"] * nrows)) for b in m["boards"]} - {0})
        inner = np.mean([float(np.abs(a[r - 1] - a[r]).mean()) for r in rows]) if rows else 1e-6
        seam_y = float(np.abs(a[0] - a[-1]).mean()) / max(inner, 1e-6)
        st = stats(m)
        mean = np.array(st["mean"])
        sat = (mean.max() - mean.min()) / max(mean.max(), 1)
        notes = []
        if seam_x > 2.5 or seam_y > 2.0:
            notes.append(f"its edges don't meet (along {seam_x:.1f} times a step inside, across {seam_y:.1f} times a joint inside)")
        if not (0.25 < sat < 0.62):
            notes.append(f"its colour's saturation {sat:.2f}")
        if not (40 < mean.mean() < 210):
            notes.append(f"its lightness {mean.mean():.0f}")
        if not (0.2 < st["rough"] < 0.7):
            notes.append(f"its roughness {st['rough']}")
        if not np.isfinite(m["normal"]).all():
            notes.append("NaN in its normal")
        if P["layout"] == "floor" and len(m["boards"]) != int(round(P["tile"] / P["board"])):
            notes.append(f"{len(m['boards'])} boards for {P['tile'] / P['board']:.0f} strips")
        print(f"  {n:18} {'ok  ' if not notes else 'BAD '} mean sRGB {st['mean']}, saturation {sat:.2f}, roughness {st['rough']}" + ("; " + "; ".join(notes) if notes else ""))
        if notes:
            bad.append(n)
    # the kit floor's boards where the set's are: the made sets' cells (pbrcells reads the height map's grooves)
    try:
        from storykit import pbrcells as C
        for n, P in SETS.items():
            if P["layout"] != "floor":
                continue
            ref = f"pbr/{P['category']}/{n}_2K-JPG"
            if not (ROOT / ref).exists():
                print(f"  {ref}: not made yet (python tools/woodpbr.py {n})")
                continue
            c = C.cells(ref)
            want = int(round(P["tile"] / P["board"]))
            got = len(c["rects"]) if c else 0
            okc = c is not None and got >= want
            print(f"  {ref:40} {'ok  ' if okc else 'BAD '} {got} boards found as cells (at least {want})")
            if not okc:
                bad.append(ref)
    except Exception as e:  # noqa: BLE001
        bad.append(f"cells: {e}")
        print(f"  cells: {e}")
    print("WOODPBR ok" if not bad else f"WOODPBR FAILED: {', '.join(bad)}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
