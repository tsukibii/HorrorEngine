#!/usr/bin/env python3
"""Clothing fabric sets made from code (the user, 2026-11-14: "hyper realistic clothing fabric pbrs ... that work well
with being tinted (maybe base pbrs should all be white or cream so tints apply well) ... knitted wool, wool, cotton,
spin cotton, leather, spandex, sheer hosier, fluffy cotton (for socks), matte leather (for shoes)"): every set built
from what the cloth is made of at its real size, as a height first (docs/research/fabric_pbr.md, docs/TAILOR.md §1k),
then every map from that one height and what's known about each point of it (which yarn, how deep, how hairy):

  weaves   each warp and weft a tube with its own width, wander and slubs, crimped over and under the other by the
           weave's draft (plain, twill, satin), its fibres' twist as fine diagonal ridges
  knits    the yarn's own centre line, loop by loop (x = w t/2pi + b sin 2t, y = -h cos t, z = -d cos 2t: legs in
           front, heads and sinkers behind), every ply its own tube wound round it, drawn deepest first
  hides    the grain as cells inside cells (creases between plates, the plates domed), follicle pores, a fine tooth
  hairs    stray fibres drawn as curled hairs over all of it: the halo a wool has and a filament yarn hasn't

The maps, in the shape the imported ambientCG sets have (`<Set>_Color`, `_NormalGL`, `_Roughness`,
`_AmbientOcclusion`, `_Displacement`), and three more: `_Sheen` (how hairy each point is: where the fuzz lobe is
strongest), `_Opacity` (a sheer knit's yarn against its holes) and `_Tint` (where a dye takes: a denim's white weft,
a marl's undyed fibres). The colour is the undyed cloth's (white or cream): a garment's colour is laid over it, and the
set's `fabric` block in its meta.json says how (its mean, so the colour picked is the colour worn; how much deeper the
dye reads down between the yarns; the fuzz lobe's strength, roughness and how much of the dye it carries; a sheer
knit's cover). Into the project's own sets in git: pbr/fabric/<Set>_1K-JPG/.

    python tools/fabricpbr.py [sets...] [--size 1024]    made into pbr/fabric/<Set>_<size>-JPG/
    python tools/fabricpbr.py list
    python tools/fabricpbr.py sheet [sets...]            each set lit and tinted, one sheet: Saved/Story/_look/fabricpbr/sheet.jpg
    python tools/fabricpbr.py godot                      the sets packed for the look plugin's cloth shader (textures/cloth/)
    python tools/fabricpbr.py check                      FABRICPBR: every set tiles, its colour pale and neutral, its
                                                         maps in range, its fabric block whole, the same twice

Plain Python with numpy and Pillow.
"""
import json
import math
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PBR = ROOT / "pbr" / "fabric"
LOOK = ROOT / "Saved" / "Story" / "_look" / "fabricpbr"
PACK = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look" / "textures" / "cloth"
F = np.float32
TAU = 2 * math.pi
GONE = -1e6                                                           # a height where nothing is (a hole between yarns)


# ---- small tools: periodic noise, blurs, colour ------------------------------------------------------------------------
def rng(seed):
    return np.random.default_rng(seed)


def fnoise(n, seed, lo, hi, stretch=(1.0, 1.0), angle=0.0):
    """White noise kept between `lo` and `hi` cycles a tile (so it repeats with the tile), its features `stretch`
    times longer along the direction `angle` and across it; zero mean, unit deviation."""
    W = np.fft.rfft2(rng(seed).standard_normal((n, n)))
    fy = (np.fft.fftfreq(n) * n)[:, None]
    fx = (np.fft.rfftfreq(n) * n)[None, :]
    c, s = math.cos(angle), math.sin(angle)
    u, v = (fx * c + fy * s) * stretch[0], (-fx * s + fy * c) * stretch[1]
    r2 = u * u + v * v
    a = np.fft.irfft2(W * (np.exp(-r2 / (hi * hi)) * (1 - np.exp(-r2 / (lo * lo)))), s=(n, n))
    a -= a.mean()
    return (a / (a.std() + 1e-9)).astype(F)


def blur(a, sigma):
    """A periodic Gaussian blur, `sigma` in pixels."""
    if sigma <= 0:
        return a
    fy = np.fft.fftfreq(a.shape[0])[:, None]
    fx = np.fft.rfftfreq(a.shape[1])[None, :]
    return np.fft.irfft2(np.fft.rfft2(a) * np.exp(-2 * (math.pi * sigma) ** 2 * (fx * fx + fy * fy)), s=a.shape).astype(F)


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def srgb(c):
    """'#rrggbb' -> linear rgb."""
    v = np.array([int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4).astype(F)


def to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)


def sample(field, x, y):
    """A periodic field read at pixel positions (nearest: the fields read this way are smooth)."""
    n = field.shape[0]
    return field[np.floor(y).astype(int) % n, np.floor(x).astype(int) % n]


def yarn_waves(r, count, freqs, t):
    """`count` yarns' own smooth periodic functions of `t` (0..1 along the yarn): (count, len(t)), about unit size."""
    out = np.zeros((count, len(t)), F)
    for f in freqs:
        out += (r.normal(0, 1, (count, 1)) / math.sqrt(f)) * np.sin(TAU * (f * t[None, :] + r.random((count, 1))))
    return (out / (out.std() + 1e-9)).astype(F)


# ---- weaves ------------------------------------------------------------------------------------------------------------
DRAFTS = {                                                             # 1: the warp over the weft there; [warp, weft]
    "plain": lambda i, j: (i + j) % 2 == 0,
    "twill21": lambda i, j: (i - j) % 3 < 2,
    "twill22": lambda i, j: (i - j) % 4 < 2,
    "twill31": lambda i, j: (i - j) % 4 < 3,
    "satin5": lambda i, j: (2 * i + j) % 5 != 0,
    "basket": lambda i, j: ((i // 2) + (j // 2)) % 2 == 0,
}
REPEAT = {"plain": 2, "twill21": 3, "twill22": 4, "twill31": 4, "satin5": 5, "basket": 4}


def weave(n, nw, nf, draft, seed, aw=0.47, af=0.47, tw=0.42, tf=0.42, cw=0.42, cf=0.42, k=2.2, wander=0.035, slub=0.06,
          twist=(2.0, 0.9, 0.07), slubs=0.0):
    """A woven cloth `nw` warps by `nf` wefts a tile, in units of the warp's pitch (heights too). Each yarn half its
    pitch times `aw`/`af` wide and `tw`/`tf` high above its centre (a flattened tube: the profile's exponent `k`),
    riding `cw`/`cf` up over the other and down under it by the draft; each wanders `wander` of a pitch and swells
    `slub` along its length; `twist`: its fibres' ridges (ridges a pitch along it, across its width, their height);
    `slubs` the share of yarns with a thick place. Returns H, TOP (the warp on top), P (how near the yarn's middle),
    YV (each yarn's own random number), GAP (no yarn)."""
    r = rng(seed)
    t = (np.arange(n) + 0.5) / n
    u, v = t * nw, t * nf
    iu, jv = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = u - iu, v - jv
    sg = np.array([[1.0 if DRAFTS[draft](i, j) else -1.0 for j in range(REPEAT[draft])] for i in range(REPEAT[draft])], F)
    R = REPEAT[draft]

    def thick(count, along):                                           # a yarn's own width along it: slow swell, a slub now and then
        s = slub * yarn_waves(r, count, (2, 3, 5, 8, 13), t)
        if slubs > 0:
            for y in np.nonzero(r.random(count) < slubs)[0]:
                at, ln = r.random(), r.uniform(0.04, 0.12)
                d = np.abs((t - at + 0.5) % 1 - 0.5) / ln
                s[y] += r.uniform(0.25, 0.5) * np.exp(-d * d)
        return s

    # the warps: functions of y, one row a yarn; spread onto the pixels by each column's yarn
    off = wander * yarn_waves(r, nw, (1, 2, 3, 5), t)[iu].T
    rad = aw * (1 + thick(nw, t)[iu].T)
    dw = ((fu[None, :] - 0.5) - off) / rad
    pw = (1 - np.minimum(np.abs(dw), 1) ** k) ** (1 / k)
    j0 = np.floor(v - 0.5).astype(int)
    ii = (np.arange(nw) % R)[:, None]
    A, B = sg[ii, (j0 % R)[None, :]], sg[ii, ((j0 + 1) % R)[None, :]]
    sw = (A + (B - A) * smooth(v - 0.5 - j0)[None, :])[iu].T
    ft = max(1, round(twist[0] * nw)) / nw
    stw = np.sin(TAU * (t[:, None] * nw * ft + dw * twist[1] + r.random(nw)[iu][None, :]))
    Hw = np.where(np.abs(dw) < 1, cw * sw + tw * pw * (1 + twist[2] * stw), GONE)
    # the wefts: functions of x, one row a yarn; spread by each row's yarn
    off = wander * yarn_waves(r, nf, (1, 2, 3, 5), t)[jv]
    rad = af * (1 + thick(nf, t)[jv])
    df = ((fv[:, None] - 0.5) - off) / rad
    pf = (1 - np.minimum(np.abs(df), 1) ** k) ** (1 / k)
    i0 = np.floor(u - 0.5).astype(int)
    jj = (np.arange(nf) % R)[:, None]
    A, B = sg[(i0 % R)[None, :], jj], sg[((i0 + 1) % R)[None, :], jj]
    sf = -(A + (B - A) * smooth(u - 0.5 - i0)[None, :])[jv]
    ft = max(1, round(twist[0] * nf * (nw / nf))) / nf
    stf = np.sin(TAU * (t[None, :] * nf * ft - df * twist[1] + r.random(nf)[jv][:, None]))
    Hf = np.where(np.abs(df) < 1, cf * sf * (nw / nf) ** 0 + tf * pf * (1 + twist[2] * stf), GONE)
    top = Hw >= Hf
    H = np.maximum(Hw, Hf)
    gap = H < GONE / 2
    floor = -(max(cw, cf) + 0.35 * max(tw, tf))
    H = np.where(gap, floor, H)
    yv = np.where(top, r.random(nw).astype(F)[iu][None, :], r.random(nf).astype(F)[jv][:, None])
    return dict(H=H.astype(F), TOP=top, P=np.where(top, pw, pf).astype(F), YV=yv.astype(F), GAP=gap, D=np.where(top, dw, df).astype(F))


# ---- knits: tubes along the yarn's own path -----------------------------------------------------------------------------
def stamp(n, X, Y, Z, RAD, LX, LY, **attrs):
    """Tubes drawn as balls along their paths, the highest kept: centres X, Y, heights Z, radii RAD (all in pixels,
    periodic), each ball's sideways direction LX, LY; `attrs` are numbers a ball carries. Returns H (GONE where
    nothing is), Q (where across its tube each pixel is, -1..1) and each attr as a field."""
    H = np.full((n, n), GONE, F)
    Q = np.zeros((n, n), F)
    out = {k: np.zeros((n, n), F) for k in attrs}
    vals = {k: np.asarray(a, F) for k, a in attrs.items()}
    order = np.argsort(Z)                                               # (deepest first: fewer rewrites)
    for m in order:
        cx, cy, z, rad = float(X[m]), float(Y[m]), float(Z[m]), float(RAD[m])
        R = int(rad) + 2
        x0, y0 = int(math.floor(cx)) - R, int(math.floor(cy)) - R
        gx, gy = np.arange(x0, x0 + 2 * R + 1), np.arange(y0, y0 + 2 * R + 1)
        dx, dy = (gx + 0.5 - cx).astype(F), (gy + 0.5 - cy).astype(F)
        d2 = dy[:, None] ** 2 + dx[None, :] ** 2
        zz = z + np.sqrt(np.maximum(rad * rad - d2, 0))
        inside = x0 >= 0 and y0 >= 0 and x0 + 2 * R + 1 <= n and y0 + 2 * R + 1 <= n
        ix = (slice(y0, y0 + 2 * R + 1), slice(x0, x0 + 2 * R + 1)) if inside else np.ix_(gy % n, gx % n)
        cur = H[ix]
        upd = (d2 < rad * rad) & (zz > cur)
        if not upd.any():
            continue
        q = (dx[None, :] * LX[m] + dy[:, None] * LY[m]) / rad
        if inside:
            cur[upd] = zz[upd]
            Q[ix][upd] = q[upd]
            for k in out:
                out[k][ix][upd] = vals[k][m]
        else:
            cur[upd] = zz[upd]
            H[ix] = cur
            a = Q[ix]
            a[upd] = q[upd]
            Q[ix] = a
            for k in out:
                a = out[k][ix]
                a[upd] = vals[k][m]
                out[k][ix] = a
    return dict(H=H, Q=Q, **out)


def knit(n, nw, nc, seed, r=0.2, hl=1.75, b=0.26, dz=1.0, plies=1, twist=2.5, ply_r=0.56, ply_off=0.46, jitter=0.05,
         swell=0.08, rib=None, purl=None):
    """A weft knit, `nw` wales by `nc` courses a tile: each course one yarn through its loops (the module's top has
    the path), its radius `r` of a wale, a loop `hl` courses tall leaning `b` of a wale, the legs `dz` radii in front
    of the heads; `plies` tubes wound round the path `twist` turns a stitch; every loop pushed about by `jitter` and
    the yarn swelling by `swell`. `rib` (k, p): k wales knit then p purled (the purled ones' loops the other way
    round: heads in front), `purl` a function (wale, course) -> purled there. Returns stamp()'s fields, in pixels."""
    rr = rng(seed)
    w, c = n / nw, n / nc
    rad = r * w
    rp, ro = (rad, 0.0) if plies == 1 else (rad * ply_r, rad * ply_off)
    per = max(24, int(math.ceil((2 * hl * c + w) / (0.4 * rp))))        # balls a stitch: closer than half a radius
    N1, N2, N3 = (fnoise(256, seed * 7 + i, 1.0, f) for i, f in ((1, 7.0), (2, 7.0), (3, 24.0)))
    k = n / 256
    tw = max(1, round(twist * nw)) / nw
    xs, ys, zs, rs, lx, ly, ply, var, arc = [], [], [], [], [], [], [], [], []
    for row in range(nc):
        t = (np.arange(nw * per) + 0.5) / per * TAU
        wale = np.floor(t / TAU).astype(int) % nw
        x = (t / TAU + b * np.sin(2 * t)) * w
        y = (row + 0.5) * c - 0.5 * hl * c * np.cos(t)
        back = np.zeros(len(t), bool)
        if rib:
            back = (wale % (rib[0] + rib[1])) >= rib[0]
        if purl:
            back = np.array([purl(int(a), row) for a in range(nw)], bool)[wale]
        z = -dz * rad * np.cos(2 * t) * np.where(back, -1.0, 1.0)
        if rib:                                                         # a rib's knit wales stand proud of its purled ones
            z += np.where(back, -1.1, 0.5) * rad
        x += jitter * w * sample(N1, x / k, y / k)
        y += jitter * c * sample(N2, x / k, y / k)
        rad_t = 1 + swell * sample(N3, x / k, y / k)
        dx, dy, dzz = (np.roll(a, -1) - np.roll(a, 1) for a in (x, y, z))
        dx = (dx + n / 2) % n - n / 2                                   # (the path wraps at the tile's edge)
        ln = np.sqrt(dx * dx + dy * dy + dzz * dzz) + 1e-9
        tx, ty, tz = dx / ln, dy / ln, dzz / ln
        nl = np.sqrt(tx * tx + ty * ty) + 1e-9
        ax, ay = ty / nl, -tx / nl                                      # sideways, in the cloth's plane
        bx, by, bz = -ay * tz, ax * tz, ay * tx - ax * ty               # the other way across the yarn: mostly up
        s = np.cumsum(ln / 2)
        phase = TAU * tw * (s / (s[-1] / nw)) + rr.random() * TAU
        for p in range(plies):
            al = phase + TAU * p / plies
            xs.append(x + ro * (np.cos(al) * ax + np.sin(al) * bx))
            ys.append(y + ro * (np.cos(al) * ay + np.sin(al) * by))
            zs.append(z + ro * np.sin(al) * bz)
            rs.append(rp * rad_t)
            lx.append(ax)
            ly.append(ay)
            ply.append(np.full(len(t), rr.random()))
            var.append(np.full(len(t), rr.random()))
            arc.append(s / (s[-1] / nw) * 1.0)
    cat = np.concatenate
    return stamp(n, cat(xs) % n, cat(ys) % n, cat(zs), cat(rs), cat(lx), cat(ly), PLY=cat(ply), YV=cat(var), ARC=cat(arc))


# ---- hides ---------------------------------------------------------------------------------------------------------------
def cells(n, count, seed, jitter=0.9, warp=None, stretch=1.0):
    """A periodic cell pattern, `count` cells across: F1 and F2 (the distances to the nearest and second nearest cell
    middle, in cells) and each pixel's cell's random number; `warp` (dx, dy fields in tiles) bends it, `stretch`
    makes the cells that much longer across than up."""
    r = rng(seed)
    cy = max(2, int(round(count * stretch)))
    pts = (np.stack(np.meshgrid(np.arange(count), np.arange(cy), indexing="xy"), -1) + 0.5 + jitter * (r.random((cy, count, 2)) - 0.5)).astype(F)
    val = r.random((cy, count)).astype(F)
    t = (np.arange(n) + 0.5) / n
    X, Y = np.meshgrid(t, t)
    if warp is not None:
        X, Y = X + warp[0], Y + warp[1]
    gx, gy = X * count, Y * cy
    ix, iy = np.floor(gx).astype(int), np.floor(gy).astype(int)
    f1 = np.full((n, n), 9.0, F)
    f2 = np.full((n, n), 9.0, F)
    idv = np.zeros((n, n), F)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            jx, jy = ix + ox, iy + oy
            p = pts[jy % cy, jx % count]
            dx = (p[..., 0] + (jx - jx % count) - gx)
            dy = (p[..., 1] + (jy - jy % cy) - gy) / stretch
            d = np.sqrt(dx * dx + dy * dy)
            near = d < f1
            f2 = np.where(near, f1, np.minimum(f2, d))
            idv = np.where(near, val[jy % cy, jx % count], idv)
            f1 = np.where(near, d, f1)
    return f1, f2, idv


# ---- hairs ----------------------------------------------------------------------------------------------------------------
def hairs(n, count, seed, length=(20, 60), width=1.2, curl=0.35, lean=None, spread=math.pi, strength=(0.4, 1.0)):
    """Stray fibres as curled hairs, `count` of them, each `length` pixels long (a range), `width` wide, turning by
    `curl` a segment; `lean` their mean direction (None: any) within `spread`. A field 0..1: how much hair is there."""
    from PIL import Image, ImageDraw
    r = rng(seed)
    ss = 2
    im = Image.new("L", (n * ss, n * ss), 0)
    d = ImageDraw.Draw(im)
    acc = np.zeros((n, n), F)
    for layer in range(3):
        im.paste(0, (0, 0, n * ss, n * ss))
        for _ in range(count // 3):
            x, y = r.random(2) * n
            a = r.uniform(0, TAU) if lean is None else lean + r.uniform(-spread, spread) + (math.pi if r.random() < 0.5 else 0)
            ln = r.uniform(*length)
            seg = max(4, int(ln / 6))
            pts = [(x, y)]
            for _s in range(seg):
                a += r.normal(0, curl)
                x, y = x + math.cos(a) * ln / seg, y + math.sin(a) * ln / seg
                pts.append((x, y))
            fill = int(255 * r.uniform(*strength))
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            for ox in ((0, n, -n) if min(xs) < 0 or max(xs) >= n else (0,)):
                for oy in ((0, n, -n) if min(ys) < 0 or max(ys) >= n else (0,)):
                    d.line([((px + ox) * ss, (py + oy) * ss) for px, py in pts], fill=fill, width=max(1, int(round(width * ss))), joint="curve")
        acc += np.asarray(im.resize((n, n), Image.BOX), F) / 255
    return np.clip(acc, 0, 1.5)


# ---- from a height to a set ---------------------------------------------------------------------------------------------
def occlusion(H, px, reach, dirs=12, steps=7):
    """How much of the sky each point of a height sees (cosine weighted, by the horizon in `dirs` directions out to
    `reach` metres): 1 open, toward 0 shut in."""
    n = H.shape[0]
    vis = np.zeros_like(H)
    for d in range(dirs):
        a = TAU * (d + 0.5) / dirs
        t = np.zeros_like(H)
        for s in range(1, steps + 1):
            dist = reach * (s / steps) ** 1.6
            ox, oy = int(round(math.cos(a) * dist / px)), int(round(math.sin(a) * dist / px))
            if ox == 0 and oy == 0:
                continue
            t = np.maximum(t, (np.roll(H, (-oy, -ox), (0, 1)) - H) / (math.hypot(ox, oy) * px))
        vis += 1 / (1 + t * t)                                          # cos^2 of the horizon's elevation
    return (vis / dirs).astype(F)


def half(a, ss):
    n = a.shape[0] // ss
    return a.reshape(n, ss, n, ss, *a.shape[2:]).mean(axis=(1, 3))


def finish(P, H, px, alb, rough, sheen, opacity=None, tint=None, ss=2):
    """The set's maps from its height in metres at `px` metres a pixel and what was painted beside it (the colour,
    roughness and hairiness; a sheer knit's cover; where a dye takes), made at `ss` times the size and brought down:
    what's finer than a texel is averaged, the normals too, and what the normals lose in length is given to the
    roughness (Toksvig's, so a far view's highlight widens instead of sparkling)."""
    dx = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) / (2 * px)
    dy = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) / (2 * px)
    k = P.get("normal", 1.0)
    nrm = np.stack([-dx * k, -dy * k, np.ones_like(dx)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    nrm, H, alb, rough, sheen = (half(a, ss) for a in (nrm, H, alb, rough, sheen))
    ln = np.linalg.norm(nrm, axis=-1)
    nrm /= ln[..., None]
    var = np.clip((1 - ln) / np.maximum(ln, 1e-4), 0, 1)                # the normals' spread inside a texel
    rough = np.sqrt(np.clip(rough * rough + P.get("toksvig", 0.5) * var, 0, 1))
    px *= ss
    ao = occlusion(H, px, P["reach"] / 1000) ** P.get("ao_k", 1.0)
    lo, hi = float(np.percentile(H, 0.2)), float(np.percentile(H, 99.8))
    m = dict(albedo=np.clip(alb, 0, 1), normal=nrm, rough=np.clip(rough, 0.04, 1), ao=np.clip(ao, 0, 1), height=np.clip((H - lo) / max(hi - lo, 1e-9), 0, 1),
             sheen=np.clip(sheen, 0, 1), relief=hi - lo, P=P)
    if opacity is not None:
        m["opacity"] = np.clip(half(opacity, ss), 0, 1)
    if tint is not None:
        m["tint"] = np.clip(half(tint, ss), 0, 1)
    return m


def shade(P, H, base, deep, yv=None, vary=0.03, fibre=None, fuzz=None, fuzz_k=0.25, seed=0, mottle=0.012):
    """The undyed cloth's colour (linear): `base`, down to `deep` of it at the height's lowest (dust and shade between
    the yarns; the dye reads deeper there: the shader's), each yarn its own tone (`yv`, by `vary`), a fibre grain,
    hairs a little lighter, a slow mottle."""
    n = H.shape[0]
    lo, hi = np.percentile(H, 1), np.percentile(H, 99.5)
    d = np.clip((hi - H) / max(hi - lo, 1e-9), 0, 1)
    v = 1 - (1 - deep) * d ** 1.3
    if yv is not None:
        v *= 1 + vary * (yv - 0.5) * 2
    if fibre is not None:
        v *= 1 + fibre
    v *= 1 + mottle * fnoise(n, seed + 991, 0.6, 3.0)
    if fuzz is not None:
        v = v + (1.04 - v) * np.clip(fuzz, 0, 1) * fuzz_k
    return (v[..., None] * np.asarray(base, F)[None, None, :]).astype(F)


# ---- the sets -------------------------------------------------------------------------------------------------------------
# `tile` mm a repeat (a whole number of its yarns or stitches, so it repeats without a seam); `base` the undyed cloth's
# colour (sRGB: never above 240, bleached cotton's own) and `deep` how much of it is left down between the yarns;
# `rough` the roughness of a yarn's crown, a hollow's and a hair's; `sheen` the hairiness of a crown and of a hair
# (the map), `reach` mm the occlusion looks round; `fabric` what the shaders are told (tools/character/tailor/look.js,
# the look plugin's cloth.gdshader): `cavity` how much deeper a dye reads down in the cloth (the colour to the power
# 1 + cavity where the map is darkest), `sheen` the fuzz lobe's strength, `sheen_rough` its roughness, `sheen_dye` how
# much of the dye the fuzz carries (0 white hairs, 1 the dyed fibre's own: the square root of the colour, lighter and
# less saturated, as a hair lit through is), `wrap` how far the cloth's diffuse light wraps past the terminator (the
# light through and between its fibres), `spec` the fibres'
# own reflectance (0.5: F0 0.04), `aniso` a filament yarn's highlight drawn out along the yarn, `cover` a sheer knit's
# yarn share at 20 denier, `crease` the surface the tailor's creases behave as, `macro` a slow unevenness over many
# repeats.
SETS = {
    "WoolKnit001": dict(
        label="knitted wool: a hand knit's stockinette, 18 stitches and 24 rows to 10 cm, a three-ply worsted yarn with its halo",
        family="knit", tile=66.0, nw=12, nc=16, seed=11, base="#e9e2d2", deep=0.7,
        loop=dict(r=0.215, hl=1.72, b=0.25, dz=1.05, plies=3, twist=2.4, jitter=0.07, swell=0.09),
        strand=(9.0, 1.6, 0.05), hair=dict(count=5200, mm=(0.8, 3.2), um=30, curl=0.45, lift=0.10), fibre=0.035,
        rough=(0.9, 1.0, 1.0), sheen=(0.55, 1.0), reach=3.2, normal=0.8,
        fabric=dict(cavity=0.75, sheen=0.85, sheen_rough=0.62, sheen_dye=0.88, wrap=0.4, spec=0.35, crease="knit", macro=0.035)),
    "WoolRib001": dict(
        label="knitted wool, ribbed: a 2 x 2 rib in a finer two-ply yarn (cuffs, hems, a fitted jumper)",
        family="knit", tile=48.0, nw=24, nc=32, seed=17, base="#e9e2d2", deep=0.55,
        loop=dict(r=0.23, hl=1.7, b=0.25, dz=1.0, plies=2, twist=2.0, jitter=0.05, swell=0.08, rib=(2, 2)),
        strand=(8.0, 1.4, 0.05), hair=dict(count=7000, mm=(0.5, 2.2), um=26, curl=0.45, lift=0.10), fibre=0.03,
        rough=(0.9, 1.0, 1.0), sheen=(0.5, 1.0), reach=2.4, normal=0.8,
        fabric=dict(cavity=0.75, sheen=0.75, sheen_rough=0.6, sheen_dye=0.88, wrap=0.4, spec=0.35, crease="rib", macro=0.03)),
    "WoolFlannel001": dict(
        label="wool: a 2/2 twill flannel, 26 ends and 22 picks a cm in a woollen yarn, milled and brushed so its nap half hides the weave",
        family="weave", tile=32.0, nw=84, nf=72, draft="twill22", seed=23, base="#e7e0d1", deep=0.66,
        yarn=dict(aw=0.5, af=0.5, tw=0.4, tf=0.4, cw=0.34, cf=0.34, k=2.0, wander=0.06, slub=0.11, twist=(1.5, 0.9, 0.10)),
        hair=dict(count=30000, mm=(0.5, 2.0), um=24, curl=0.5, lift=0.28), fibre=0.04, soften=0.9,
        rough=(0.9, 1.0, 1.0), sheen=(0.6, 1.0), reach=1.2, normal=0.75,
        fabric=dict(cavity=0.6, sheen=0.8, sheen_rough=0.6, sheen_dye=0.88, wrap=0.35, spec=0.3, crease="wool", macro=0.035)),
    "CottonPoplin001": dict(
        label="cotton: a shirt's poplin, plain weave, 52 ends and 28 picks a cm of combed 40s yarn (a fine rib across it)",
        family="weave", tile=24.0, nw=124, nf=68, draft="plain", seed=31, base="#eceae4", deep=0.74,
        yarn=dict(aw=0.48, af=0.34, tw=0.3, tf=0.34, cw=0.34, cf=0.1, k=2.4, wander=0.035, slub=0.07, twist=(1.0, 0.8, 0.07)),
        hair=dict(count=5200, mm=(0.2, 0.6), um=14, curl=0.4, lift=0.05), fibre=0.03,
        rough=(0.8, 0.93, 0.95), sheen=(0.22, 0.8), reach=0.5, normal=0.85,
        fabric=dict(cavity=0.5, sheen=0.3, sheen_rough=0.5, sheen_dye=0.85, wrap=0.25, spec=0.45, crease="cotton", macro=0.03)),
    "CottonJersey001": dict(
        label="spun cotton: a T-shirt's single jersey, 28 gauge, 16 wales and 21 courses a cm of ring-spun 30s yarn, its hairs standing off it",
        family="knit", tile=24.0, nw=38, nc=51, seed=41, base="#edebe5", deep=0.66,
        loop=dict(r=0.15, hl=1.66, b=0.24, dz=1.15, plies=1, twist=3.0, jitter=0.06, swell=0.11),
        strand=(5.0, 1.1, 0.10), hair=dict(count=9000, mm=(0.25, 0.9), um=15, curl=0.4, lift=0.07), fibre=0.03,
        rough=(0.84, 0.96, 0.98), sheen=(0.32, 0.9), reach=0.7, normal=0.85,
        fabric=dict(cavity=0.6, sheen=0.42, sheen_rough=0.55, sheen_dye=0.86, wrap=0.3, spec=0.42, crease="jersey", macro=0.03)),
    "CottonFluffy001": dict(
        label="fluffy cotton: a thick sock's brushed terry, a 1 x 1 rib under a pile of loops and loose fibre",
        family="pile", tile=38.4, nw=24, nc=30, seed=53, base="#eeebe4", deep=0.6,
        loop=dict(r=0.25, hl=1.7, b=0.25, dz=1.0, plies=2, twist=1.6, jitter=0.1, swell=0.14, rib=(1, 1)),
        strand=(6.0, 1.3, 0.05), hair=dict(count=42000, mm=(0.6, 2.4), um=22, curl=0.75, lift=0.42), fibre=0.04, soften=1.6, clump=0.16,
        rough=(0.95, 1.0, 1.0), sheen=(0.75, 1.0), reach=2.4, normal=0.8,
        fabric=dict(cavity=0.6, sheen=1.0, sheen_rough=0.7, sheen_dye=0.88, wrap=0.45, spec=0.25, crease="knit", macro=0.04)),
    "Spandex001": dict(
        label="spandex: a nylon and elastane jersey for leggings and swimwear, 16 wales and 23 courses a cm of filament yarn, smooth, with a soft sheen down its wales",
        family="knit", tile=24.0, nw=40, nc=56, seed=61, base="#eeeeec", deep=0.8,
        loop=dict(r=0.21, hl=1.6, b=0.24, dz=0.55, plies=1, twist=1.0, jitter=0.018, swell=0.03),
        strand=(14.0, 2.6, 0.03), hair=None, fibre=0.012,
        rough=(0.44, 0.62, 0.6), sheen=(0.12, 0.2), reach=0.5, normal=0.7,
        fabric=dict(cavity=0.35, sheen=0.18, sheen_rough=0.35, sheen_dye=0.9, wrap=0.12, spec=0.55, aniso=0.45, crease="spandex", macro=0.02)),
    "HosierySheer001": dict(
        label="sheer hosiery: a 20 denier nylon tight as it sits on the leg, its loops opened to 0.8 by 0.5 mm, the skin through them",
        family="sheer", tile=16.0, nw=20, nc=32, seed=71, base="#eeeeee", deep=0.9,
        loop=dict(r=0.036, hl=1.78, b=0.27, dz=1.0, plies=1, twist=1.0, jitter=0.05, swell=0.1),
        strand=(6.0, 1.0, 0.0), hair=None, fibre=0.0,
        rough=(0.5, 0.6, 0.6), sheen=(0.5, 0.6), reach=0.3, normal=0.6,
        fabric=dict(cavity=0.2, sheen=0.5, sheen_rough=0.4, sheen_dye=0.85, wrap=0.2, spec=0.55, aniso=0.3, crease="sheer", macro=0.0, denier=20)),
    "Leather001": dict(
        label="leather: a jacket's full-grain cowhide, semi-aniline, its grain in plates of 2 to 3 mm with finer creases inside them, follicle pores, a soft polish",
        family="hide", tile=80.0, seed=83, base="#e4e1da", deep=0.8,
        grain=((27, 0.2, 0.075, 1.0), (66, 0.24, 0.04, 1.2), (150, 0.3, 0.014, 1.0)), pores=(250, 0.3, 0.17, 0.02), tooth=0.003, wave=0.05, stretch=1.25,
        rough=(0.4, 0.66, 0.5), sheen=(0.05, 0.12), reach=1.2, normal=1.0,
        fabric=dict(cavity=0.45, sheen=0.08, sheen_rough=0.5, sheen_dye=0.9, wrap=0.04, spec=0.5, crease="leather", macro=0.045)),
    "LeatherMatte001": dict(
        label="matte leather: a shoe's calf, a tight fine grain under a matte finish, pores close up, hardly a highlight",
        family="hide", tile=60.0, seed=97, base="#e4e1da", deep=0.86,
        grain=((44, 0.22, 0.012, 1.0), (115, 0.26, 0.011, 1.0), (240, 0.3, 0.005, 1.0)), pores=(200, 0.42, 0.2, 0.011), tooth=0.004, wave=0.02, stretch=1.15,
        rough=(0.68, 0.8, 0.74), sheen=(0.2, 0.3), reach=0.6, normal=1.0,
        fabric=dict(cavity=0.35, sheen=0.22, sheen_rough=0.65, sheen_dye=0.9, wrap=0.08, spec=0.45, crease="leather", macro=0.035, shoe=True)),
}


def _hairs(P, n, px, seed):
    h = P.get("hair")
    if not h:
        return np.zeros((n, n), F)
    mm = 0.001 / px                                                    # pixels a millimetre
    return hairs(n, h["count"], seed, length=(h["mm"][0] * mm, h["mm"][1] * mm), width=max(0.6, h["um"] * 1e-3 * mm), curl=h["curl"])


def build_weave(P, n, ss):
    r, px = P["seed"], P["tile"] / 1000 / n
    W = weave(n, P["nw"], P["nf"], P["draft"], r, **P.get("yarn", {}))
    pitch = P["tile"] / 1000 / P["nw"]
    H = W["H"] * pitch
    # the fibres' grain along each yarn: streaks up the warps, across the wefts
    g = np.where(W["TOP"], fnoise(n, r + 1, P["nw"] * 0.7, P["nw"] * 4.0, (1, 9)), fnoise(n, r + 2, P["nf"] * 0.7, P["nf"] * 4.0, (9, 1))) * ~W["GAP"]
    H = H + g * P["fibre"] * pitch * W["P"]
    fz = _hairs(P, n, px, r + 3)
    if P.get("soften"):                                                # a milled cloth: the yarns felted together, the nap over them
        H = blur(H, P["soften"] * P["tile"] / 32.0 * n / 1024 * 1.2)
    lift = (P.get("hair") or {}).get("lift", 0)
    H = H + blur(fz, 0.7) * lift * pitch
    crown = W["P"] * ~W["GAP"]
    rough = P["rough"][1] + (P["rough"][0] - P["rough"][1]) * crown
    rough = rough + (P["rough"][2] - rough) * np.clip(fz, 0, 1) * 0.8 + 0.02 * g
    sheen = P["sheen"][0] * (0.75 + 0.25 * (1 - crown)) + (P["sheen"][1] - P["sheen"][0]) * np.clip(fz, 0, 1)
    alb = shade(P, H, srgb(P["base"]), P["deep"], W["YV"], P.get("vary", 0.035), g * P["fibre"] * 0.6, fz, 0.3, r)
    tint = None
    if P.get("undyed") is not None:                                    # a yarn-dyed cloth: the weft left white (denim), fading on the crowns
        tint = np.where(W["TOP"], 1.0, P["undyed"]) - P.get("fade", 0) * smooth((W["P"] - 0.55) / 0.45) * W["TOP"] * (0.6 + 0.4 * fnoise(n, r + 9, 2, 9))
        tint = np.clip(tint - 0.25 * np.clip(fz, 0, 1), 0, 1)
    return finish(P, H, px, alb, rough, sheen, tint=tint, ss=ss)


def build_knit(P, n, ss):
    r, px = P["seed"], P["tile"] / 1000 / n
    K = knit(n, P["nw"], P["nc"], r, **P["loop"])
    Hp, Q = K["H"], K["Q"]
    gap = Hp < GONE / 2
    rad = P["loop"]["r"] * n / P["nw"]
    fs, fq, amp = P["strand"]
    st = np.sin(TAU * (K["ARC"] * fs + Q * fq + K["PLY"] * 5.0)) * (1 - Q * Q)        # the fibres' twist on each ply
    g = fnoise(n, r + 1, P["nw"] * 1.5, P["nw"] * 9.0)
    crown = np.clip(1 - Q * Q, 0, 1) * ~gap
    Hp = np.where(gap, np.percentile(Hp[~gap], 3) - 0.6 * rad, Hp + rad * (amp * st + P["fibre"] * g) * crown)
    H = Hp * px
    sheer = P["family"] == "sheer"
    fz = _hairs(P, n, px, r + 3)
    if P.get("soften"):
        H = blur(H, P["soften"] * n / 1024)
    if P.get("clump"):                                                 # a pile's tufts: soft heaps a few millimetres across
        H = H + P["clump"] * rad * px * fnoise(n, r + 5, P["nw"] * 0.5, P["nw"] * 1.6)
    lift = (P.get("hair") or {}).get("lift", 0)
    H = H + blur(fz, 0.8) * lift * rad * px
    rough = P["rough"][1] + (P["rough"][0] - P["rough"][1]) * crown
    rough = rough + (P["rough"][2] - rough) * np.clip(fz, 0, 1) * 0.8 + 0.015 * g
    sheen = P["sheen"][0] * (0.7 + 0.3 * (1 - crown)) + (P["sheen"][1] - P["sheen"][0]) * np.clip(fz, 0, 1)
    if sheer:
        alb = np.broadcast_to(srgb(P["base"])[None, None, :], (n, n, 3)).astype(F) * (1 - 0.06 * (1 - crown[..., None]))
        return finish(P, H, px, alb, rough, sheen, opacity=(~gap).astype(F), ss=ss)
    alb = shade(P, H, srgb(P["base"]), P["deep"], K["YV"], P.get("vary", 0.03), g * P["fibre"] * 0.5 + st * amp * 0.25 * crown, fz, 0.3, r)
    return finish(P, H, px, alb, rough, sheen, ss=ss)


def build_hide(P, n, ss):
    """A hide's grain: cells inside cells, each scale's borders creases of their own depth (some nearly gone: a hide's
    creases come and go), the cells between them pillowed; follicle pores; a fine tooth; the hide's own slow lie."""
    r, px = P["seed"], P["tile"] / 1000 / n
    wx = fnoise(n, r + 1, 1.0, 4.0) * 0.011 + fnoise(n, r + 11, 5.0, 18.0) * 0.0035   # the grain bent: slowly, and finely
    wy = fnoise(n, r + 2, 1.0, 4.0) * 0.011 + fnoise(n, r + 12, 5.0, 18.0) * 0.0035
    H = np.zeros((n, n), F)
    low = np.zeros((n, n), F)
    tone = np.zeros((n, n), F)
    for i, (count, width, depth, sharp) in enumerate(P["grain"]):
        f1, f2, idv = cells(n, count, r + 20 + i, 0.95, (wx, wy), P.get("stretch", 1.0))
        e = f2 - f1
        keep = 0.2 + 0.8 * smooth((fnoise(n, r + 30 + i, count * 0.12, count * 0.5) * 0.5 + 0.42) / 0.8)
        v = (1 - smooth(e / width)) ** sharp * keep
        H += depth * (0.42 * smooth(e / (width * 2.6)) ** 0.6 * (0.75 + 0.5 * idv) - v)
        low += v * (1.0, 0.7, 0.45)[min(i, 2)]
        tone += (idv - 0.5) * (0.5, 1.0, 0.6)[min(i, 2)]
    pc, share, pr, pd = P["pores"]
    p1, _, pid = cells(n, pc, r + 5, 1.0, (wx, wy))
    pit = np.exp(-(p1 / pr) ** 2) * (pid < share)
    H -= pd * pit
    tooth = fnoise(n, r + 6, n * 0.05, n * 0.28)
    H += P["tooth"] * tooth + P["wave"] * fnoise(n, r + 7, 1.0, 4.0)
    H = H * 0.001
    low = np.clip(low + pit, 0, 1)
    mott = fnoise(n, r + 8, 1.0, 6.0)
    rough = P["rough"][0] + (P["rough"][1] - P["rough"][0]) * low + 0.03 * mott + 0.018 * tooth
    sheen = P["sheen"][0] + (P["sheen"][1] - P["sheen"][0]) * low
    v = (1 - (1 - P["deep"]) * low) * (1 + 0.02 * mott + 0.012 * tone + 0.006 * tooth)
    alb = (v[..., None] * srgb(P["base"])[None, None, :]).astype(F)
    return finish(P, H, px, alb, rough, sheen, ss=ss)


BUILD = {"weave": build_weave, "knit": build_knit, "sheer": build_knit, "pile": build_knit, "hide": build_hide}


def make(name, size=1024, ss=2):
    P = SETS[name]
    return BUILD[P["family"]](P, size * ss, ss)


# ---- saving, the sheet, the checks ---------------------------------------------------------------------------------------
WORDS = (("albedo", "Color"), ("normal", "NormalGL"), ("rough", "Roughness"), ("ao", "AmbientOcclusion"), ("height", "Displacement"),
         ("sheen", "Sheen"), ("opacity", "Opacity"), ("tint", "Tint"))


def folder_of(name, size=1024):
    return f"{name}_{size // 1024}K-JPG"


def images(m):
    """The set's maps as 8-bit pictures, the fabric's up at the picture's top: {key: array}."""
    out = {}
    for key, _ in WORDS:
        if key not in m:
            continue
        a = to_srgb(m[key]) if key == "albedo" else m[key] * 0.5 + 0.5 if key == "normal" else m[key]
        out[key] = np.flipud((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    return out


def fabric_block(name, m):
    P = SETS[name]
    a = m["albedo"].reshape(-1, 3)
    b = dict(v=1, kind=P["family"], mean=[round(float(x), 4) for x in a.mean(0)], rough=round(float(m["rough"].mean()), 3))
    b.update(P["fabric"])
    if "opacity" in m:
        b["cover"] = round(float(m["opacity"].mean()), 3)
    return b


def save(name, m, size):
    from PIL import Image
    P = SETS[name]
    folder = folder_of(name, size)
    d = PBR / folder
    d.mkdir(parents=True, exist_ok=True)
    for f in d.iterdir():
        if f.suffix.lower() in (".jpg", ".png") or f.name == "meta.json":
            f.unlink()
    maps = {}
    for key, a in images(m).items():
        word = dict(WORDS)[key]
        if key == "opacity":                                           # (a mask: no JPEG ringing round a 4 pixel yarn)
            f = f"{folder}_{word}.png"
            Image.fromarray(a, "L").save(d / f, optimize=True)
        else:
            f = f"{folder}_{word}.jpg"
            Image.fromarray(a, "RGB" if a.ndim == 3 else "L").save(d / f, quality=93 if key in ("albedo", "normal") else 90, subsampling=0)
        maps[key] = f
    meta = {"maps": maps, "normal": "gl", "tile_m": round(P["tile"] / 1000.0, 5), "source": f"ours: tools/fabricpbr.py {name}", "url": "",
            "licence": "ours", "tint": True, "label": P["label"], "group": "fabric", "family": P["family"],
            "relief_m": round(float(m["relief"]), 6), "fabric": fabric_block(name, m)}
    (d / "meta.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return d


def dye(rel, tint, cavity):
    """The colour a dyed cloth shows: `rel` the undyed map over its mean, `tint` the dye (linear); down between the
    yarns (where the map is darker) the light meets the dye more than once: the colour to a higher power there."""
    lum = rel.mean(-1, keepdims=True)
    return np.asarray(tint, F)[None, None, :] ** (1 + cavity * np.clip(1 - lum, 0, 1)) * rel


def lit(m, tint="#ffffff", light=(-0.55, 0.6, 0.58), reps=1):
    """The set lit on a flat patch by a low light (a quick look, no browser): the dye over it, the fuzz lobe a soft
    glow off the hairy places."""
    fb = fabric_block(m["P"]["name"], m) if "name" in m["P"] else m["P"]["fabric"]
    mean = m["albedo"].reshape(-1, 3).mean(0)
    col = dye(m["albedo"] / mean, srgb(tint), m["P"]["fabric"].get("cavity", 0.5))
    L = np.array(light, F)
    L /= np.linalg.norm(L)
    nl = np.clip((m["normal"] * L).sum(-1), 0, 1)
    hv = L + np.array([0, 0, 1], F)
    hv /= np.linalg.norm(hv)
    nh = np.clip((m["normal"] * hv).sum(-1), 0, 1)
    a = np.clip(m["rough"], 0.08, 1) ** 2
    spec = (a * a / (math.pi * ((nh * nh) * (a * a - 1) + 1) ** 2)) * 0.04 * m["P"]["fabric"].get("spec", 0.5) * 2
    fuzz = m["sheen"] * m["P"]["fabric"]["sheen"] * 0.12 * (1 - nl * 0.5)
    out = col * (0.22 * m["ao"] + 0.86 * nl * (0.55 + 0.45 * m["ao"]))[..., None] + (spec * nl * 2.2 + fuzz)[..., None] * (0.6 + 0.4 * np.sqrt(col))
    if "opacity" in m:                                                 # a sheer knit over skin
        skin = srgb("#c99a7e")[None, None, :] * 0.9
        out = skin + (out - skin) * m["opacity"][..., None]
    out = np.flipud(out)
    return (to_srgb(np.tile(out, (reps, reps, 1))) * 255 + 0.5).astype(np.uint8)


TINTS = ("#ffffff", "#7a1f2b", "#1d2a44", "#161616")


def cmd_sheet(names, size=512):
    from PIL import Image, ImageDraw
    names = names or list(SETS)
    T, cap = 300, 30
    sheet = Image.new("RGB", (len(TINTS) * T, len(names) * (T + cap)), (26, 28, 34))
    dr = ImageDraw.Draw(sheet)
    for k, name in enumerate(names):
        m = make(name, size, 2)
        for j, tint in enumerate(TINTS):
            crop = max(1, round(0.02 / (SETS[name]["tile"] / 1000)))           # about 2 cm of cloth a picture, at least a tile
            a = lit(m, tint, reps=1 if SETS[name]["tile"] >= 20 else crop)
            sheet.paste(Image.fromarray(a).resize((T - 6, T - 6), Image.LANCZOS), (j * T + 3, k * (T + cap) + 3))
        dr.text((6, k * (T + cap) + T + 4), f"{name}: {SETS[name]['label'][:150]}", fill=(228, 226, 218))
        print(f"  {name}")
    LOOK.mkdir(parents=True, exist_ok=True)
    sheet.save(LOOK / "sheet.jpg", quality=90)
    print(f"the sheet: {(LOOK / 'sheet.jpg').relative_to(ROOT)}")
    return 0


def main(argv):
    args = list(argv)
    size = 1024
    if "--size" in args:
        i = args.index("--size")
        size = int(args[i + 1])
        del args[i:i + 2]
    if args and args[0] == "list":
        for k, v in SETS.items():
            print(f"  {k:18} pbr/fabric/{folder_of(k)}  {v['tile'] / 10:g} cm  {v['label']}")
        return 0
    if args and args[0] == "sheet":
        return cmd_sheet(args[1:], min(size, 512))
    names = args or list(SETS)
    for nme in names:
        if nme not in SETS:
            sys.exit(f"no set {nme}: {', '.join(SETS)}")
        t = time.time()
        m = make(nme, size)
        d = save(nme, m, size)
        fb = fabric_block(nme, m)
        print(f"  {nme}: {d.relative_to(ROOT)}  mean {[round(x, 3) for x in fb['mean']]} rough {fb['rough']} relief {m['relief'] * 1000:.3f} mm  ({time.time() - t:.0f} s)")
    print(f"FABRICPBR made {len(names)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
