"""The weapons plugin's effect textures, made from nothing (numpy; DECISIONS 2026-11-09, latest: the muzzle flash, the
shell kinds and what a hit leaves). Written as PNGs into the plugin's `fx/` so they can be painted over in Krita and
the plugin reads whatever is there:

- `flash_noise.png`   tileable fire noise (grey): the muzzle flash's wings sample it triplanar on each sphere, the burn
                      eats their edges with it (muzzle/flash.gdshader)
- `puff.png`          a soft round puff with ragged edges (white, alpha): the smoke thrown out with a shot
- `crater_<n>_albedo/normal/orm.png` (n 0..3): a pellet's crater as a decal's three maps, from one height field: the
                      hole, the cone of broken material round it, chips of the surface missing at its edge; the normal
                      map in Godot's convention (OpenGL, green up), the ORM's red the cavity's occlusion; the albedo's
                      alpha where it covers (its colour neutral: the impact tints it by what was hit)
- `scorch_<n>_albedo/normal/orm/emission.png` (n 0..1): an explosive shell's crater: a deeper broken hole, cracks
                      running out of it, soot fanned round it, embers glowing in it (the emission, faded in play)
- `blast_<n>_albedo/normal/orm.png` (n 0..2): pellets landing together in a soft wall: their holes run into one
                      ragged hole, the paper torn back round it in flaps, the plaster broken out, cracks (the shot
                      column at close range, a pattern's merged middle)
- `smear_<n>_albedo/normal/orm.png` (n 0..1): a lead pellet flattened on concrete, stone or steel: a grey metallic
                      splash over a shallow dent, chips round it (the ORM's blue its metal)
- `wad_0_albedo/normal/orm.png`: a wad's strike a few metres out: a shallow dent, a scuffed ring, its petals' marks
- `soot_0_albedo.png` the smoke a shot from under about 40 cm leaves on the wall: a black ring fanned out round the hole
- `grains_0_albedo.png` the powder's grains a shot from under about 90 cm peppers round it (the stippling): burnt and
                      unburnt specks, thick in the middle, thinning out (docs/research/shotgun_damage.md)
- `ichor_<kind>_<n>_albedo/normal/orm/emission.png`: a demon's black ichor instead of blood (HSHitReact,
                      docs/research/hit_reactions.md): `splat` (n 0..2, thrown out along the texture's right: a blob,
                      spikes and the drops flung past it), `drip` (n 0..1, on a wall: runs down the texture's bottom),
                      `wound` (n 0..1, on the body: a ragged dark hole, a glossy rim, short runs) and `drop` (n 0..1, a
                      drop landed, its crown of droplets; a pool scaled up). Black and glossy (the flashlight's highlight
                      is what shows it), a dark oxblood in its thin film, raised like a liquid, a few ember flecks in
                      the emission (faded in play)

    python tools/weapon_fx.py [--out DIR]       make them
    python tools/weapon_fx.py check             WEAPONFX: every map there and well formed, the noise tiling, each
                                                crater's normals leaning into it, its occlusion darker inside
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "GodotPlugins" / "HorrorStudioWeapons" / "addons" / "horrorstudio_weapons" / "fx"
CRATERS = 4
SCORCHES = 2


# ---- noise ---------------------------------------------------------------------------------------------------------

def spectral(n, beta, seed, lo=1.0, hi=None):
    """Tileable noise: white noise shaped in the frequency domain (power falling as f^-beta between lo and hi cycles
    across the tile), so it wraps at its edges by construction. Zero mean, unit deviation."""
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((n, n))
    F = np.fft.fft2(w)
    fy = np.fft.fftfreq(n)[:, None] * n
    fx = np.fft.fftfreq(n)[None, :] * n
    f = np.sqrt(fx * fx + fy * fy)
    g = np.where(f < 1e-9, 0.0, np.maximum(f, lo) ** (-beta / 2.0))
    g *= 1.0 / (1.0 + (lo / np.maximum(f, 1e-9)) ** 6)
    if hi:
        g *= 1.0 / (1.0 + (f / hi) ** 6)
    x = np.real(np.fft.ifft2(F * g))
    x -= x.mean()
    return x / (x.std() + 1e-12)


def blur_wrap(x, r):
    """A Gaussian blur of `r` px that wraps (the FFT's)."""
    n0, n1 = x.shape
    fy = np.fft.fftfreq(n0)[:, None]
    fx = np.fft.fftfreq(n1)[None, :]
    g = np.exp(-2.0 * (np.pi * r) ** 2 * (fx * fx + fy * fy))
    return np.real(np.fft.ifft2(np.fft.fft2(x) * g))


def blur(x, r):
    """A Gaussian blur of `r` px that doesn't wrap (padded by the edge)."""
    p = int(3 * r + 2)
    y = np.pad(x, p, mode="edge")
    return blur_wrap(y, r)[p:-p, p:-p]


def flash_noise(n=256):
    """Fire's grain: soft clouds (fBm, broad), a finer layer over them, some contrast for the burn to follow."""
    a = spectral(n, 2.8, 101, lo=1.5, hi=14)
    b = spectral(n, 2.0, 202, lo=4.0, hi=28)
    v = 0.5 + 0.5 * np.tanh(0.8 * (0.78 * a + 0.32 * b))
    v = (v - v.min()) / (v.max() - v.min())
    return v


def puff(n=128):
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx + 0.5) / n * 2 - 1
    v = (yy + 0.5) / n * 2 - 1
    r = np.sqrt(u * u + v * v)
    nz = spectral(n, 1.8, 303, lo=2.0, hi=40)
    a = np.clip(1.0 - (r + 0.16 * nz), 0.0, 1.0)
    a = a * a * (0.7 + 0.3 * np.clip(0.5 + 0.35 * spectral(n, 1.4, 304, lo=4.0, hi=60), 0, 1))
    rgba = np.zeros((n, n, 4))
    rgba[..., :3] = 1.0
    rgba[..., 3] = np.clip(a / max(a.max(), 1e-6), 0, 1)
    return rgba


# ---- a height field into a decal's maps ------------------------------------------------------------------------------

def normals(h, strength):
    """Godot's decal normal map (OpenGL: x right, green toward the image's top, z out of the surface) of a height field
    in pixels times `strength`."""
    dy, dx = np.gradient(h * strength)              # d/drow (down the image), d/dcol (right)
    nx = -dx
    ny = dy                                          # the image's up is -row: a height rising downward faces up
    nz = np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / ln, ny / ln, nz / ln], -1)


def cavity(h, radii=(2.0, 6.0, 14.0), k=(0.9, 0.6, 0.35)):
    """Occlusion from the height field: how far below its neighbourhood each point lies, at a few sizes."""
    occ = np.zeros_like(h)
    for r, kk in zip(radii, k):
        occ += kk * np.maximum(blur(h, r) - h, 0.0)
    return np.clip(1.0 - occ, 0.0, 1.0)


def save(path, arr, mode):
    a = np.clip(arr, 0.0, 1.0)
    Image.fromarray((a * 255.0 + 0.5).astype(np.uint8), mode).save(path)


def polar(noise, a, r, k_a, k_r):
    """`noise` (a tileable tile) read at polar coordinates: k_a repeats round the circle (so it closes), k_r tiles along
    the radius: stretched one way it makes radial streaks."""
    n = noise.shape[0]
    x = (a / (2 * np.pi) % 1.0) * n * k_a
    y = r * n * k_r
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx = x - x0
    fy = y - y0
    x0 %= n
    y0 %= n
    x1 = (x0 + 1) % n
    y1 = (y0 + 1) % n
    return ((noise[y0, x0] * (1 - fx) + noise[y0, x1] * fx) * (1 - fy) + (noise[y1, x0] * (1 - fx) + noise[y1, x1] * fx) * fy)


def seg_dist(px, py, ax, ay, bx, by):
    """Each pixel's distance to the segment a-b and how far along it (0..1) its nearest point is."""
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy + 1e-12
    t = np.clip(((px - ax) * dx + (py - ay) * dy) / L2, 0.0, 1.0)
    qx, qy = ax + t * dx, ay + t * dy
    return np.sqrt((px - qx) ** 2 + (py - qy) ** 2), t


def crater(seed, n=128):
    """A pellet's crater on a painted wall: a dark hole a fifth of the decal across, a bowl of broken material round
    it to about three fifths (its rim the paint's ragged edge), a few flakes of paint gone just past the rim, dust
    round it. Returns (rgba, normal, orm, h)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx + 0.5) / n * 2 - 1
    v = (yy + 0.5) / n * 2 - 1
    nz = spectral(n, 1.9, seed * 7 + 1, lo=2.0, hi=24)
    fine = spectral(n, 1.4, seed * 7 + 2, lo=10.0, hi=60)
    cx, cy = rng.uniform(-0.04, 0.04, 2)                     # (a pellet doesn't land square)
    rh = np.sqrt((u - cx) ** 2 + (v - cy) ** 2)
    a = np.arctan2(v - cy, u - cx)
    lobes = sum(rng.uniform(0.03, 0.08) * np.cos(k * a + rng.uniform(0, 2 * np.pi)) for k in (2, 3, 5))
    jag = polar(spectral(n, 1.6, seed * 7 + 5, lo=3.0, hi=50), a, rh, 3, 0.3)   # the paint's broken edge: jagged
    r_cone = rng.uniform(0.5, 0.6) * (1.0 + lobes + 0.07 * jag)
    r_hole = rng.uniform(0.13, 0.17) * (1.0 + 0.12 * nz)
    hole = np.clip((r_hole - rh) / 0.03, 0.0, 1.0)
    t = np.clip(rh / r_cone, 0.0, 1.0)
    in_cone = np.clip((r_cone - rh) / 0.022, 0.0, 1.0)
    # flakes of paint gone past the rim: a few blobs where a coarse noise peaks in a band just outside it
    chipn = spectral(n, 2.4, seed * 7 + 3, lo=2.5, hi=18)
    band = np.clip(1.0 - np.abs(rh - r_cone * 1.1) / (0.13 * r_cone), 0.0, 1.0)
    chips = np.clip((chipn * 0.55 + band * 1.2 - 1.25) / 0.08, 0.0, 1.0) * np.clip(band * 4.0, 0.0, 1.0) * (1.0 - in_cone)
    paint = 0.05
    # the bowl: steepest near the hole, easing out to the rim (a cone's profile, rounded)
    bowl = (1.0 - t) ** 1.7
    h = -paint * np.maximum(in_cone, chips) - 0.42 * bowl * in_cone - 1.0 * hole
    h += 0.018 * fine * in_cone * (1.0 - hole) + 0.03 * nz * bowl * in_cone      # broken plaster's grain, gently
    h = blur(h, 0.7)
    cover = np.maximum(in_cone, chips)
    dust = np.clip(1.0 - rh / (r_cone * 1.75), 0.0, 1.0) ** 2 * np.clip(0.4 + 0.25 * nz, 0, 1) * (1.0 - cover)
    # the albedo: what's under the paint, lighter, a little uneven; darker toward the hole (less light gets in); black in it
    base = 0.86 + 0.035 * fine + 0.03 * nz
    col = base * (0.8 + 0.2 * t) * (1.0 - 0.95 * hole)
    col = np.where(cover > 0.02, col, 0.9)
    alpha = np.clip(cover + 0.3 * dust, 0.0, 1.0)
    rgba = np.stack([col, col * 0.985, col * 0.96, alpha], -1)
    nrm = normals(h, n / 12.0)
    occ = cavity(h * n / 36.0) * (1.0 - 0.8 * hole)
    orm = np.stack([occ, np.clip(0.9 - 0.03 * fine, 0, 1), np.zeros_like(h)], -1)
    return rgba, nrm, orm, h


def scorch(seed, n=512):
    """An explosive shell's mark: a jagged crater a quarter across punched through in its middle, cracks running out
    of it as broken lines, soot thrown out round it in streaks, embers in it. Returns (rgba, normal, orm, emission, h)."""
    rng = np.random.default_rng(seed + 50)
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx + 0.5) / n * 2 - 1
    v = (yy + 0.5) / n * 2 - 1
    r = np.sqrt(u * u + v * v)
    a = np.arctan2(v, u)
    nz = spectral(n, 1.9, seed * 11 + 1, lo=2.0, hi=40)
    fine = spectral(n, 1.4, seed * 11 + 2, lo=14.0, hi=140)
    jag = polar(spectral(256, 1.6, seed * 11 + 6, lo=3.0, hi=60), a, r, 4, 0.25)
    lobes = sum(rng.uniform(0.05, 0.1) * np.cos(k * a + rng.uniform(0, 2 * np.pi)) for k in (3, 4, 7))
    r_crater = 0.23 * (1.0 + lobes + 0.1 * jag)
    crater_m = np.clip((r_crater - r) / 0.012, 0.0, 1.0)
    t = np.clip(r / r_crater, 0.0, 1.0)
    core = np.clip((0.075 * (1 + 0.25 * nz) - r) / 0.015, 0.0, 1.0)
    # cracks: broken lines from the rim, each a few straight runs turning a little, a branch or two, thinning out
    crack = np.zeros((n, n))
    for i in range(int(rng.integers(6, 9))):
        th = rng.uniform(0, 2 * np.pi)
        r0 = 0.2 + 0.02 * rng.standard_normal()
        length = rng.uniform(0.3, 0.6)
        x, y = r0 * np.cos(th), r0 * np.sin(th)
        head = th
        steps = int(rng.integers(5, 8))
        for s in range(steps):
            head += rng.normal(0.0, 0.32)
            head = th + np.clip(head - th, -0.7, 0.7)
            ln = length / steps * rng.uniform(0.7, 1.3)
            nx, ny = x + ln * np.cos(head), y + ln * np.sin(head)
            w = 0.0055 * (1.0 - s / steps) + 0.0012
            d, _ = seg_dist(u, v, x, y, nx, ny)
            crack = np.maximum(crack, np.clip(1.0 - d / w, 0.0, 1.0))
            if rng.random() < 0.35 and s < steps - 2:          # a branch
                bh = head + rng.choice([-1, 1]) * rng.uniform(0.5, 0.9)
                bl = ln * rng.uniform(0.8, 1.6)
                bx, by = nx + bl * np.cos(bh), ny + bl * np.sin(bh)
                d, _ = seg_dist(u, v, nx, ny, bx, by)
                crack = np.maximum(crack, np.clip(1.0 - d / (w * 0.6), 0.0, 1.0))
            x, y = nx, ny
    crack *= (1.0 - crater_m)
    # soot: thrown out in streaks (noise stretched along the radius), heaviest at the rim, fading out by 0.95
    fan = polar(spectral(256, 2.0, seed * 11 + 3, lo=3.0, hi=22), a, r, 1, 0.05)       # broad fans round it
    fine_fan = polar(spectral(256, 1.6, seed * 11 + 7, lo=3.0, hi=30), a, r, 1, 0.08)
    streak = 0.75 * fan + 0.25 * fine_fan
    reach = r_crater + (0.95 - r_crater) * (0.62 + 0.26 * np.tanh(streak * 0.9)) * (0.88 + 0.12 * nz)
    soot = np.clip(1.0 - (r - r_crater) / np.maximum(reach - r_crater, 0.05), 0.0, 1.0)
    blot = 0.5 + 0.5 * np.tanh(spectral(n, 2.0, seed * 11 + 8, lo=3.0, hi=40) * 0.9)
    soot = soot ** 1.3 * np.clip(0.7 + 0.25 * np.tanh(streak) + 0.15 * blot, 0, 1) * (1.0 - crater_m)
    # the height: the bowl falling to the punched-through middle, rubble in it, the cracks' grooves
    h = -0.85 * (1.0 - t) ** 1.4 * crater_m - 1.2 * core - 0.05 * crater_m
    h += 0.05 * fine * crater_m * (1 - core) + 0.06 * nz * crater_m * (1 - t)
    h -= 0.14 * crack
    h = blur(h, 0.9)
    # albedo: the broken material inside, greyed and darkened by soot toward the middle; soot black; cracks darker
    inside = (0.5 + 0.05 * fine + 0.06 * nz) * (0.45 + 0.55 * t)
    col = inside * crater_m + 0.05 * (1.0 - crater_m)
    col = col * (1.0 - 0.9 * core) * (1.0 - 0.7 * crack)
    alpha = np.clip(np.maximum(crater_m, np.maximum(soot * 0.94, crack * 0.95)), 0, 1)
    rgba = np.stack([col, col * 0.97, col * 0.93, alpha], -1)
    nrm = normals(h, n / 20.0)
    occ = cavity(h * n / 56.0, radii=(3.0, 10.0, 28.0)) * (1.0 - 0.8 * core)
    orm = np.stack([occ, np.clip(0.95 - 0.02 * fine, 0, 1), np.zeros_like(h)], -1)
    # embers: specks in the crater's rubble and along the cracks near the rim, glowing
    speck = np.clip((spectral(n, 0.8, seed * 11 + 4, lo=24.0, hi=200) - 1.4) / 0.9, 0.0, 1.0)
    glow = speck * crater_m * (1 - core) * (0.4 + 0.6 * t) + crack * np.clip(1.0 - (r - r_crater) / 0.18, 0, 1) * 0.55
    glow = np.clip(blur(glow, 1.3) * 2.2, 0, 1)
    em = np.stack([glow, glow * 0.4, glow * 0.1], -1)
    return rgba, nrm, orm, em, h


BLASTS = 3
SMEARS = 2


def blast(seed, n=256):
    """Pellets landing together in a soft wall (plaster, plasterboard and its paper or wallpaper): their holes run
    into one ragged hole about two fifths of the decal across (the shot column at close range, or a pattern's merged
    middle), the paper torn back round it in flaps, the plaster under it broken out to about three quarters, cracks
    running from it. Returns (rgba, normal, orm, h)."""
    rng = np.random.default_rng(seed + 300)
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx + 0.5) / n * 2 - 1
    v = (yy + 0.5) / n * 2 - 1
    r = np.sqrt(u * u + v * v)
    a = np.arctan2(v, u)
    nz = spectral(n, 1.9, seed * 13 + 1, lo=2.0, hi=40)
    fine = spectral(n, 1.4, seed * 13 + 2, lo=12.0, hi=110)
    # the hole: the pellets' own holes (a few), run together, ragged
    hole = np.zeros((n, n))
    for i in range(int(rng.integers(6, 10))):
        rr = rng.uniform(0.0, 0.26) * np.sqrt(rng.uniform(0.2, 1.0))
        th = rng.uniform(0, 2 * np.pi)
        cx, cy = rr * np.cos(th), rr * np.sin(th)
        rad = rng.uniform(0.085, 0.13)
        d = np.sqrt((u - cx) ** 2 + (v - cy) ** 2) / rad
        hole = np.maximum(hole, np.clip((1.0 - d) / 0.12 + 0.5 * nz * 0.3, 0.0, 1.0))
    core = np.clip((0.2 * (1 + 0.25 * nz) - r) / 0.03, 0.0, 1.0)
    hole = np.clip(np.maximum(hole, core), 0.0, 1.0)
    jag = polar(spectral(256, 1.6, seed * 13 + 3, lo=3.0, hi=60), a, r, 4, 0.3)
    lobes = sum(rng.uniform(0.04, 0.09) * np.cos(k * a + rng.uniform(0, 2 * np.pi)) for k in (2, 3, 5))
    r_break = 0.72 * (1.0 + lobes + 0.08 * jag)
    broke = np.clip((r_break - r) / 0.02, 0.0, 1.0)
    t = np.clip(r / r_break, 0.0, 1.0)
    # the paper: torn back round the hole in flaps (a ring past the hole, cut by angle into tongues)
    flap_a = 0.5 + 0.5 * np.cos(a * rng.integers(5, 9) + 2.5 * polar(spectral(256, 2.0, seed * 13 + 4, lo=2.0, hi=20), a, r, 1, 0.1))
    ring = np.clip(1.0 - np.abs(r - 0.36) / 0.09, 0.0, 1.0)
    flaps = np.clip((flap_a * 1.4 - 0.55) * ring * 2.0, 0.0, 1.0) * (1.0 - hole)
    # cracks out of the broken plaster
    crack = np.zeros((n, n))
    for i in range(int(rng.integers(4, 7))):
        th = rng.uniform(0, 2 * np.pi)
        x, y = 0.45 * np.cos(th), 0.45 * np.sin(th)
        head = th
        for s in range(4):
            head += rng.normal(0.0, 0.3)
            ln = rng.uniform(0.07, 0.13)
            nx2, ny2 = x + ln * np.cos(head), y + ln * np.sin(head)
            d, _ = seg_dist(u, v, x, y, nx2, ny2)
            crack = np.maximum(crack, np.clip(1.0 - d / (0.0045 * (1 - s / 5) + 0.0015), 0.0, 1.0))
            x, y = nx2, ny2
    crack *= (1.0 - broke * 0.6)
    # height: the paper's layer gone, the broken plaster falling in toward the hole, the hole deep, flaps standing
    paper = 0.05
    h = -paper * broke - 0.5 * (1.0 - t) ** 1.5 * broke - 1.3 * hole
    h += 0.014 * fine * broke * (1.0 - hole) + 0.02 * nz * broke
    h += 0.1 * flaps - 0.1 * crack
    h = blur(h, 0.8)
    # albedo: black down the hole, the broken plaster light and uneven, the torn paper's back pale, cracks dark
    plaster = (0.84 + 0.02 * fine + 0.02 * nz) * (0.72 + 0.28 * t)
    col = plaster * broke + 0.9 * (1.0 - broke)
    col = col * (1.0 - 0.96 * hole) * (1.0 - 0.55 * crack)
    col = np.where(flaps > 0.05, col * (1 - flaps) + 0.97 * flaps, col)
    dust = np.clip(1.0 - r / (r_break * 1.4), 0.0, 1.0) ** 2 * np.clip(0.35 + 0.2 * nz, 0, 1) * (1.0 - broke)
    alpha = np.clip(np.maximum(broke, crack * 0.9) + 0.3 * dust, 0.0, 1.0)
    rgba = np.stack([col, col * 0.985, col * 0.96, alpha], -1)
    nrm = normals(h, n / 14.0)
    occ = cavity(h * n / 40.0, radii=(2.0, 7.0, 18.0)) * (1.0 - 0.85 * hole)
    orm = np.stack([occ, np.clip(0.9 - 0.03 * fine, 0, 1), np.zeros_like(h)], -1)
    return rgba, nrm, orm, h


def soot(seed=0, n=256):
    """The smoke a shot from under about 40 cm leaves on a wall: a soot ring fanned out round the hole, a few grains
    caught in it (the rest of the powder is `grains`). Flat: only colour. Returns rgba."""
    rng = np.random.default_rng(seed + 400)
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx + 0.5) / n * 2 - 1
    v = (yy + 0.5) / n * 2 - 1
    r = np.sqrt(u * u + v * v)
    a = np.arctan2(v, u)
    fan = polar(spectral(256, 2.0, seed * 7 + 11, lo=3.0, hi=30), a, r, 1, 0.06)
    reach = 0.74 * (0.8 + 0.25 * np.tanh(fan))
    sooty = np.clip(1.0 - r / reach, 0.0, 1.0) ** 0.75 * (0.88 + 0.12 * np.tanh(spectral(n, 1.8, seed * 7 + 12, lo=4.0, hi=50)))
    specks = np.zeros((n, n))
    for i in range(70):                                         # a few burnt grains caught in the smoke
        rr = 0.6 * np.sqrt(rng.uniform(0, 1)) ** 0.8
        th = rng.uniform(0, 2 * np.pi)
        cx, cy = rr * np.cos(th), rr * np.sin(th)
        rad = rng.uniform(0.004, 0.011)
        specks = np.maximum(specks, np.clip(1.0 - np.sqrt((u - cx) ** 2 + (v - cy) ** 2) / rad, 0.0, 1.0) * (1.0 - 0.6 * rr))
    alpha = np.clip(np.maximum(sooty * 0.92, specks), 0.0, 1.0)
    col = 0.06 + 0.05 * (1.0 - sooty)
    return np.stack([col * 1.0, col * 0.96, col * 0.92, alpha], -1)


def grains(seed=0, n=256):
    """The powder's grains a shot from under about 90 cm peppers round the hole (the stippling the forensic books
    measure): burnt specks and a few paler unburnt ones, thick in the middle and thinning out to the edge, each a
    little pit with a darker core. Flat: only colour. Returns rgba."""
    rng = np.random.default_rng(seed + 500)
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx + 0.5) / n * 2 - 1
    v = (yy + 0.5) / n * 2 - 1
    alpha = np.zeros((n, n))
    col = np.full((n, n), 0.08)
    for i in range(900):
        rr = 0.92 * rng.uniform(0, 1) ** 0.75                   # (thicker in the middle: more of them at small radii)
        th = rng.uniform(0, 2 * np.pi)
        cx, cy = rr * np.cos(th), rr * np.sin(th)
        rad = rng.uniform(0.004, 0.011) * (1.15 - 0.4 * rr)
        d = np.sqrt((u - cx) ** 2 + (v - cy) ** 2) / rad
        a = np.clip(1.4 - d, 0.0, 1.0) * (1.0 - 0.55 * rr)
        pale = rng.uniform() < 0.18                              # an unburnt grain: greyer, a flake of the powder itself
        c = 0.30 if pale else 0.05
        take = a > alpha
        col = np.where(take, c + 0.06 * np.clip(d, 0, 1), col)
        alpha = np.maximum(alpha, a)
    return np.stack([col, col * 0.97, col * 0.94, np.clip(alpha, 0.0, 1.0)], -1)


def wad(seed=0, n=128):
    """A shotgun wad's strike a few metres out: a shallow round dent with a scuffed ring and its petals' four marks
    round it, no hole. Returns (rgba, normal, orm, h)."""
    rng = np.random.default_rng(seed + 500)
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx + 0.5) / n * 2 - 1
    v = (yy + 0.5) / n * 2 - 1
    r = np.sqrt(u * u + v * v)
    a = np.arctan2(v, u)
    fine = spectral(n, 1.5, seed * 5 + 21, lo=8.0, hi=60)
    dish = np.clip(1.0 - r / 0.38, 0.0, 1.0)
    ring = np.clip(1.0 - np.abs(r - 0.36) / 0.06, 0.0, 1.0)
    rot = rng.uniform(0, np.pi / 2)
    petals = np.zeros((n, n))
    for k in range(4):
        th = rot + k * np.pi / 2 + rng.normal(0, 0.12)
        cx, cy = 0.62 * np.cos(th), 0.62 * np.sin(th)
        d, _ = seg_dist(u, v, cx * 0.85, cy * 0.85, cx * 1.15, cy * 1.15)
        petals = np.maximum(petals, np.clip(1.0 - d / 0.07, 0.0, 1.0))
    h = -0.25 * dish ** 1.2 - 0.04 * petals + 0.02 * fine * dish
    h = blur(h, 0.7)
    scuff = np.clip(ring * 0.8 + petals * 0.7, 0.0, 1.0)
    col = (0.82 - 0.24 * scuff + 0.05 * fine) * (0.92 + 0.08 * (1 - dish))
    alpha = np.clip(np.maximum(np.clip(dish * 3.0, 0, 1) * 0.97, scuff * 0.9), 0.0, 1.0)
    rgba = np.stack([col, col * 0.98, col * 0.95, alpha], -1)
    nrm = normals(h, n / 10.0)
    occ = cavity(h * n / 30.0)
    orm = np.stack([occ, np.full_like(h, 0.85), np.zeros_like(h)], -1)
    return rgba, nrm, orm, h


def smear(seed, n=128):
    """A lead pellet flattened on a hard surface (concrete, stone, steel): no hole, a grey metallic splash thrown out in
    streaks over a shallow dent, its rim crushed, a few chips round it. Returns (rgba, normal, orm, h)."""
    rng = np.random.default_rng(seed + 600)
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx + 0.5) / n * 2 - 1
    v = (yy + 0.5) / n * 2 - 1
    r = np.sqrt(u * u + v * v)
    a = np.arctan2(v, u)
    streak = polar(spectral(128, 1.8, seed * 9 + 31, lo=3.0, hi=40), a, r, 1, 0.07)
    reach = 0.5 * (0.7 + 0.35 * np.tanh(streak))
    lead = np.clip(1.0 - r / reach, 0.0, 1.0) ** 0.8
    dent = np.clip(1.0 - r / 0.22, 0.0, 1.0)
    chipn = spectral(n, 2.2, seed * 9 + 32, lo=3.0, hi=24)
    band = np.clip(1.0 - np.abs(r - 0.34) / 0.12, 0.0, 1.0)
    chips = np.clip((chipn * 0.5 + band - 1.25) / 0.1, 0.0, 1.0) * np.clip(band * 4, 0, 1)
    h = -0.3 * dent ** 1.4 + 0.05 * lead * (1 - dent) - 0.05 * chips
    h = blur(h, 0.6)
    col = 0.42 + 0.06 * np.tanh(streak)
    alpha = np.clip(np.maximum(np.clip(lead * 1.6, 0, 1), chips * 0.8), 0.0, 1.0)
    rgba = np.stack([col * 0.98, col, col * 1.04, alpha], -1)
    nrm = normals(h, n / 12.0)
    occ = cavity(h * n / 30.0)
    metal = np.clip(lead * 1.2 - chips, 0.0, 1.0) * 0.8
    orm = np.stack([occ, np.clip(0.45 + 0.4 * (1 - lead), 0, 1), metal], -1)
    return rgba, nrm, orm, h


ICHOR = {"splat": 3, "drip": 2, "wound": 2, "drop": 2}
ICHOR_N = {"splat": 512, "drip": 512, "wound": 256, "drop": 256}


def ichor(kind, seed, n=None):
    """A demon's black ichor as a decal's maps (see the module doc): its cover from shapes (a ragged blob, spikes thrown
    along +u ending in drops, flung droplets drawn out along their way, runs down a wall, a wound's hole), its thickness
    a liquid's rounded domes, black where it's thick and dark oxblood in its thin film, glossy, ember flecks in it.
    Returns (rgba, normal, orm, emission, cover)."""
    n = n or ICHOR_N[kind]
    rng = np.random.default_rng(seed * 97 + {"splat": 900, "drip": 950, "wound": 980, "drop": 990}[kind])
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx + 0.5) / n * 2 - 1
    v = (yy + 0.5) / n * 2 - 1
    px = 2.0 / n

    def disc(cx, cy, r, ax=1.0, ang=0.0):
        """a soft ellipse: `ax` its length over its width along `ang`"""
        du, dv = u - cx, v - cy
        ca, sa = np.cos(ang), np.sin(ang)
        a = du * ca + dv * sa
        b = -du * sa + dv * ca
        d = np.sqrt((a / ax) ** 2 + b * b)
        return np.clip((r - d) / (1.5 * px) + 0.5, 0.0, 1.0)

    def capsule(ax_, ay_, bx_, by_, w0, w1):
        """a run from a to b, its width w0 tapering to w1"""
        d, t = seg_dist(u, v, ax_, ay_, bx_, by_)
        w = w0 + (w1 - w0) * t
        return np.clip((w - d) / (1.5 * px) + 0.5, 0.0, 1.0)

    cov = np.zeros((n, n))
    if kind in ("splat", "drip", "drop", "wound"):
        cx, cy, r0 = {"splat": (-0.3, 0.0, 0.26), "drip": (0.0, -0.32, 0.3), "drop": (0.0, 0.0, 0.2), "wound": (0.0, 0.0, 0.34)}[kind]
        r0 *= rng.uniform(0.85, 1.12)
        a = np.arctan2(v - cy, u - cx)
        r = np.hypot(u - cx, v - cy)
        edge = polar(spectral(128, 1.6, seed * 7 + 401, lo=3.0, hi=30), a, r, 1, 0.04)
        R = r0 * (1.0 + 0.2 * np.tanh(edge))
        cov = np.maximum(cov, np.clip((R - r) / (2.0 * px) + 0.5, 0.0, 1.0))
        # spikes out of the blob (thrown along +u for a splat; all round a drop's crown and a drip's)
        spikes = {"splat": 14, "drip": 9, "drop": 11, "wound": 7}[kind]
        for i in range(spikes):
            if kind == "splat":
                ang = rng.normal(0.0, 0.55)
                L = rng.uniform(0.25, 0.7) * (1.2 - abs(ang) * 0.5)
            else:
                ang = rng.uniform(-np.pi, np.pi)
                L = rng.uniform(0.12, 0.35) * (0.6 if kind == "wound" else 1.0)
            sx, sy = cx + np.cos(ang) * r0 * 0.8, cy + np.sin(ang) * r0 * 0.8
            ex, ey = sx + np.cos(ang) * L, sy + np.sin(ang) * L
            w = rng.uniform(0.018, 0.045) * (1.3 if kind == "splat" else 1.0)
            cov = np.maximum(cov, capsule(sx, sy, ex, ey, w, w * 0.35))
            if rng.random() < 0.7:
                cov = np.maximum(cov, disc(ex, ey, w * rng.uniform(0.8, 1.5)))
        # droplets flung past it, drawn out along their way (a splat's mostly ahead)
        drops = {"splat": 40, "drip": 18, "drop": 26, "wound": 10}[kind]
        for i in range(drops):
            ang = rng.normal(0.0, 0.6) if kind == "splat" else rng.uniform(-np.pi, np.pi)
            dist = r0 * rng.uniform(1.25, 3.4 if kind == "splat" else 2.4)
            dxp, dyp = cx + np.cos(ang) * dist, cy + np.sin(ang) * dist
            if abs(dxp) > 0.95 or abs(dyp) > 0.95:
                continue
            size = rng.uniform(0.008, 0.03) * (r0 / dist) ** 0.5 * 2.0
            cov = np.maximum(cov, disc(dxp, dyp, size, ax=rng.uniform(1.4, 2.6), ang=ang))
        if kind == "drip":
            # runs down from the blob's lower edge, a bulb at each end
            for i in range(int(rng.integers(5, 9))):
                x0 = cx + rng.uniform(-0.75, 0.75) * r0
                y0 = cy + r0 * rng.uniform(0.3, 0.8)
                y1 = min(0.93, y0 + rng.uniform(0.25, 0.95))
                w = rng.uniform(0.012, 0.028)
                wob = x0 + rng.normal(0, 0.01)
                cov = np.maximum(cov, capsule(x0, y0, wob, y1, w, w * 0.8))
                cov = np.maximum(cov, disc(wob, y1, w * 1.5))
        if kind == "wound":
            # its hole: the ragged middle, deeper and darker
            hole = np.clip((r0 * 0.45 * (1.0 + 0.3 * np.tanh(edge)) - r) / (2.0 * px) + 0.5, 0.0, 1.0)
        else:
            hole = np.zeros_like(cov)
    cov = np.clip(cov, 0.0, 1.0)
    # its thickness: a liquid's rounded domes, thickest inside, a fine ripple
    thick = blur(cov, 3.0)
    ripple = spectral(n, 2.4, seed * 7 + 402, lo=6.0, hi=n / 6.0)
    h = np.sqrt(np.clip(thick, 0.0, 1.0)) * (0.85 + 0.15 * np.tanh(ripple)) * cov
    if kind == "wound":
        h -= 0.6 * blur(hole, 2.0)
    film = np.clip((thick - 0.15) / 0.6, 0.0, 1.0)                 # 0 at its thin edges, 1 where it's thick
    black = np.array([0.012, 0.010, 0.012])
    blood = np.array([0.075, 0.014, 0.016])                       # a dark oxblood in the thin film
    col = black[None, None, :] * film[..., None] + blood[None, None, :] * (1.0 - film[..., None])
    if kind == "wound":
        col *= (1.0 - 0.7 * hole)[..., None]
    rgba = np.concatenate([col, cov[..., None]], -1)
    nrm = normals(h, n / 40.0)
    occ = cavity(h * n / 40.0)
    rough = np.clip(0.07 + 0.25 * (1.0 - film) + 0.04 * np.tanh(ripple), 0.04, 0.6)
    orm = np.stack([occ, rough, np.zeros_like(rough)], -1)
    flecks = spectral(n, 1.0, seed * 7 + 403, lo=n / 10.0)
    ember = np.clip((flecks - 2.4) / 0.6, 0.0, 1.0) * film * cov
    em = np.stack([ember * 1.0, ember * 0.24, ember * 0.05], -1)
    return rgba, nrm, orm, em, cov


def make(out):
    out.mkdir(parents=True, exist_ok=True)
    save(out / "flash_noise.png", flash_noise(), "L")
    save(out / "puff.png", puff(), "RGBA")
    for i in range(CRATERS):
        rgba, nrm, orm, _ = crater(i)
        save(out / f"crater_{i}_albedo.png", rgba, "RGBA")
        save(out / f"crater_{i}_normal.png", nrm * 0.5 + 0.5, "RGB")
        save(out / f"crater_{i}_orm.png", orm, "RGB")
    for i in range(SCORCHES):
        rgba, nrm, orm, em, _ = scorch(i)
        save(out / f"scorch_{i}_albedo.png", rgba, "RGBA")
        save(out / f"scorch_{i}_normal.png", nrm * 0.5 + 0.5, "RGB")
        save(out / f"scorch_{i}_orm.png", orm, "RGB")
        save(out / f"scorch_{i}_emission.png", em, "RGB")
    for i in range(BLASTS):
        rgba, nrm, orm, _ = blast(i)
        save(out / f"blast_{i}_albedo.png", rgba, "RGBA")
        save(out / f"blast_{i}_normal.png", nrm * 0.5 + 0.5, "RGB")
        save(out / f"blast_{i}_orm.png", orm, "RGB")
    for i in range(SMEARS):
        rgba, nrm, orm, _ = smear(i)
        save(out / f"smear_{i}_albedo.png", rgba, "RGBA")
        save(out / f"smear_{i}_normal.png", nrm * 0.5 + 0.5, "RGB")
        save(out / f"smear_{i}_orm.png", orm, "RGB")
    rgba, nrm, orm, _ = wad(0)
    save(out / "wad_0_albedo.png", rgba, "RGBA")
    save(out / "wad_0_normal.png", nrm * 0.5 + 0.5, "RGB")
    save(out / "wad_0_orm.png", orm, "RGB")
    save(out / "soot_0_albedo.png", soot(0), "RGBA")
    save(out / "grains_0_albedo.png", grains(0), "RGBA")
    for kind, count in ICHOR.items():
        for i in range(count):
            rgba, nrm, orm, em, _ = ichor(kind, i)
            save(out / f"ichor_{kind}_{i}_albedo.png", rgba, "RGBA")
            save(out / f"ichor_{kind}_{i}_normal.png", nrm * 0.5 + 0.5, "RGB")
            save(out / f"ichor_{kind}_{i}_orm.png", orm, "RGB")
            save(out / f"ichor_{kind}_{i}_emission.png", em, "RGB")
    print(f"  {2 + 3 * CRATERS + 4 * SCORCHES + 3 * BLASTS + 3 * SMEARS + 5 + 4 * sum(ICHOR.values())} maps into {out}")


def check(out):
    errs = []

    def img(name, mode, size=None):
        p = out / name
        if not p.is_file():
            errs.append(f"{name} missing (python tools/weapon_fx.py)")
            return None
        im = Image.open(p)
        if im.mode != mode:
            errs.append(f"{name} is {im.mode}, not {mode}")
        if size and im.size != (size, size):
            errs.append(f"{name} is {im.size}, not {size} square")
        return np.asarray(im.convert(mode), dtype=np.float64) / 255.0

    nz = img("flash_noise.png", "L", 256)
    if nz is not None:
        inner = np.abs(np.diff(nz, axis=1)).mean()
        wrap = np.abs(nz[:, 0] - nz[:, -1]).mean()
        wrapv = np.abs(nz[0, :] - nz[-1, :]).mean()
        if max(wrap, wrapv) > 2.5 * inner:
            errs.append(f"flash_noise doesn't tile (its edges differ {max(wrap, wrapv):.3f}, inside {inner:.3f})")
        if nz.std() < 0.2:
            errs.append(f"flash_noise is too flat for the burn to find edges in it (deviation {nz.std():.2f})")
    pf = img("puff.png", "RGBA", 128)
    if pf is not None and not (pf[64, 64, 3] > 0.6 and pf[2, 2, 3] < 0.05):
        errs.append("puff.png isn't a round puff (full in the middle, clear at the corners)")

    def bowl(prefix, n, deep, within):
        al = img(f"{prefix}_albedo.png", "RGBA", n)
        nm = img(f"{prefix}_normal.png", "RGB", n)
        om = img(f"{prefix}_orm.png", "RGB", n)
        if al is None or nm is None or om is None:
            return
        cov = al[..., 3]
        c = n // 2
        if cov[c, c] < 0.95 or cov[1, 1] > 0.05 or cov[1, -2] > 0.05:
            errs.append(f"{prefix}: its cover isn't the crater (middle {cov[c, c]:.2f}, corners {cov[1, 1]:.2f})")
        nx = nm[..., 0] * 2 - 1
        ny = nm[..., 1] * 2 - 1
        yy, xx = np.mgrid[0:n, 0:n]
        ring = (cov > 0.5) & (np.hypot(xx - c, yy - c) < within * c)
        left = ring & (xx < c - n * 0.06)
        right = ring & (xx > c + n * 0.06)
        top = ring & (yy < c - n * 0.06)
        bottom = ring & (yy > c + n * 0.06)
        lean = (nx[left].mean() - nx[right].mean()) / 2.0      # into it: the left side's lean right, the right's left
        lean_v = (ny[bottom].mean() - ny[top].mean()) / 2.0    # the bottom side's lean up (green +), the top's down
        if lean < deep or lean_v < deep:
            errs.append(f"{prefix}: its normals don't lean into it (across {lean:.3f}, up and down {lean_v:.3f}, want {deep})")
        occ_in = om[c - 3:c + 4, c - 3:c + 4, 0].mean()
        occ_out = om[..., 0][cov < 0.05].mean()
        if occ_in > occ_out - 0.15:
            errs.append(f"{prefix}: its occlusion isn't darker inside ({occ_in:.2f} in, {occ_out:.2f} out)")
        return lean, occ_in

    leans = []
    for i in range(CRATERS):
        x = bowl(f"crater_{i}", 128, 0.05, 0.7)
        if x:
            leans.append(x[0])
    for i in range(SCORCHES):
        x = bowl(f"scorch_{i}", 512, 0.05, 0.3)
        em = img(f"scorch_{i}_emission.png", "RGB", 512)
        if em is not None and em[..., 0].max() < 0.5:
            errs.append(f"scorch_{i}: no embers in its emission")
    for i in range(BLASTS):
        bowl(f"blast_{i}", 256, 0.05, 0.5)
    for i in range(SMEARS):
        bowl(f"smear_{i}", 128, 0.02, 0.4)
        om = img(f"smear_{i}_orm.png", "RGB", 128)
        if om is not None and om[56:72, 56:72, 2].mean() < 0.3:
            errs.append(f"smear_{i}: the lead isn't metallic in its middle ({om[56:72, 56:72, 2].mean():.2f})")
    bowl("wad_0", 128, 0.01, 0.4)
    st = img("soot_0_albedo.png", "RGBA", 256)
    if st is not None and not (st[128, 128, 3] > 0.6 and st[128, 128, 0] < 0.2 and st[2, 2, 3] < 0.05):
        errs.append("soot_0 isn't a dark ring fading out (its middle dark and covered, its corners clear)")
    gr = img("grains_0_albedo.png", "RGBA", 256)
    if gr is not None:
        yy, xx = np.mgrid[0:256, 0:256]
        rad = np.sqrt(((xx + 0.5) / 128 - 1) ** 2 + ((yy + 0.5) / 128 - 1) ** 2)
        mid = (gr[..., 3] > 0.3)[rad < 0.3].mean()
        edge = (gr[..., 3] > 0.3)[(rad > 0.6) & (rad < 0.9)].mean()
        cover = (gr[..., 3] > 0.3).mean()
        if not (mid > edge * 1.8 and 0.02 < cover < 0.35 and gr[2, 2, 3] < 0.05 and gr[..., 0][gr[..., 3] > 0.5].mean() < 0.3):
            errs.append(f"grains_0 isn't dark specks thick in the middle thinning out (middle {mid:.3f}, edge {edge:.3f}, cover {cover:.3f})")
    # the ichor: black and glossy where it covers, raised (its normals out of it), thrown the way it's drawn, embers sparse
    for kind, count in ICHOR.items():
        nn = ICHOR_N[kind]
        for i in range(count):
            pre = f"ichor_{kind}_{i}"
            al = img(f"{pre}_albedo.png", "RGBA", nn)
            nm = img(f"{pre}_normal.png", "RGB", nn)
            om = img(f"{pre}_orm.png", "RGB", nn)
            em = img(f"{pre}_emission.png", "RGB", nn)
            if al is None or nm is None or om is None or em is None:
                continue
            cov = al[..., 3]
            on = cov > 0.6
            frac = on.mean()
            if not (0.04 < frac < 0.6):
                errs.append(f"{pre}: covers {frac:.2f} of its square (a splatter, not a blot or nothing)")
                continue
            if al[..., :3][on].mean() > 0.08:
                errs.append(f"{pre}: not black where it covers ({al[..., :3][on].mean():.3f})")
            if om[..., 1][on].mean() > 0.3:
                errs.append(f"{pre}: not glossy where it covers (roughness {om[..., 1][on].mean():.2f})")
            if (nm[..., 2] * 2 - 1)[on].mean() < 0.75:
                errs.append(f"{pre}: its normals don't face out of the surface")
            lit = (em[..., 0] > 0.3).mean()
            if not (0.0 < lit < 0.03):
                errs.append(f"{pre}: its embers aren't a few flecks ({lit:.4f} of it)")
            yy, xx = np.mgrid[0:nn, 0:nn]
            if kind == "splat":
                ahead = (on & (xx > nn * 0.45)).sum()                 # past the blob (its middle at a third across)
                behind = (on & (xx < nn * 0.2)).sum()
                if ahead < 2.0 * behind:
                    errs.append(f"{pre}: not thrown toward its right ({ahead} covered ahead of the blob, {behind} behind it)")
            if kind == "drip" and (on & (yy > nn * 0.7)).sum() < 40:
                errs.append(f"{pre}: no runs down its bottom")
    for e in errs:
        print("ERROR " + e)
    if errs:
        print("WEAPONFX FAILED")
        return 1
    print(f"WEAPONFX ok ({CRATERS} craters leaning in {min(leans):.2f}..{max(leans):.2f}, {SCORCHES} scorches, {BLASTS} torn holes, {SMEARS} lead smears, a wad's dent, the powder's soot and grains, {sum(ICHOR.values())} ichor splatters, the noise tiling)")
    return 0


def main():
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else OUT
    if "check" in sys.argv[1:]:
        return check(out)
    make(out)
    return check(out)


if __name__ == "__main__":
    sys.exit(main())
