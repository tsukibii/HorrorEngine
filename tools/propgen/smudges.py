"""The built-in smudges (docs/PROPGEN.md §15): stains drawn by code as RGBA pictures (their colour where their alpha
is), written on first use into tools/propgen/smudges/<name>.png (not kept in git: made again the same). A recipe names
one as "smudge/<name>" anywhere a picture goes; `INDEX` says how each is laid by default (its blend, the roughness it
leaves, how big it usually is). Your own smudge is any PNG: transparent round it, or dark on white."""

import math
import os

import numpy as np

from . import noise as N

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smudges")
PX = 512

# name: what it is, how it's laid (multiply: darkens toward its colour; mix: lays its colour), the roughness it leaves
# (None: as it was), mm it's usually laid at across
INDEX = {
    "coffee_ring": {"about": "the ring a wet cup leaves, darker at its edge", "blend": "multiply", "rough": None, "w": 75},
    "fingerprint": {"about": "a greasy thumbprint, shinier than round it", "blend": "multiply", "rough": 0.22, "w": 18},
    "grease": {"about": "a smear of grease wiped one way", "blend": "multiply", "rough": 0.18, "w": 60},
    "drip": {"about": "a run down from a spill, a drop at its foot", "blend": "multiply", "rough": 0.3, "w": 30},
    "soot": {"about": "a cloud of soot, matt black at its heart", "blend": "multiply", "rough": 0.92, "w": 90},
    "water_mark": {"about": "a pale ring of dried water and lime", "blend": "mix", "rough": 0.75, "w": 60},
    "blood": {"about": "a smear of dried blood with flung drops", "blend": "multiply", "rough": 0.35, "w": 80},
    "dust": {"about": "a pale drift of dust, matt", "blend": "mix", "rough": 0.96, "w": 120},
    "rust": {"about": "rust blooming through paint or steel", "blend": "mix", "rough": 0.9, "w": 50},
}


def path(name):
    """The built-in smudge's PNG, drawn if it isn't there yet."""
    if name not in INDEX:
        raise ValueError(f"smudge/{name}: one of {', '.join(INDEX)}")
    p = os.path.join(HERE, name + ".png")
    if not os.path.exists(p):
        from .paint import write_png
        os.makedirs(HERE, exist_ok=True)
        write_png(p, draw(name))
    return p


def _grid(n=PX):
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    return (x + 0.5) / n * 2 - 1, 1 - (y + 0.5) / n * 2          # -1..1 across, up


def _fbm(x, y, seed, scale=3.0, octaves=4):
    p = np.stack([x * scale, y * scale, np.full_like(x, seed * 7.31)], -1)
    return N.fbm3(p, seed=seed, octaves=octaves)


def _rgba(color, a):
    out = np.zeros(a.shape + (4,), np.float32)
    out[..., :3] = np.asarray(color, np.float32)
    x, y = _grid(a.shape[0])
    fade = np.clip((1 - np.maximum(abs(x), abs(y))) / 0.12, 0, 1)      # nothing at its border: no square's edge shows
    out[..., 3] = np.clip(a, 0, 1) * fade * fade * (3 - 2 * fade)
    return out


def draw(name, seed=1):
    """The smudge as an (PX, PX, 4) array, floats 0-1, rows top first."""
    x, y = _grid()
    r = np.hypot(x, y)
    th = np.arctan2(y, x)
    n = _fbm(x, y, seed)
    if name == "coffee_ring":
        R = 0.78 + 0.05 * _fbm(np.cos(th), np.sin(th), seed + 1, 1.5)
        edge = np.exp(-((r - R) / 0.025) ** 2) * 0.9 + np.exp(-((r - R + 0.05) / 0.06) ** 2) * 0.25
        inner = (r < R) * (0.06 + 0.06 * n)
        gap = np.clip((np.cos(th - 1.1) + 0.93) * 9, 0, 1)               # the ring broken where the cup was lifted
        return _rgba((0.42, 0.27, 0.15), (edge * gap + inner) * np.clip(1.2 - 0.25 * n, 0, 1))
    if name == "fingerprint":
        ex, ey = x / 0.72, (y + 0.05) / 0.92
        rr = np.hypot(ex, ey)
        warp = 0.08 * _fbm(x, y, seed, 2.0) + 0.12 * np.exp(-((ex - 0.1) ** 2 + (ey + 0.2) ** 2) * 3) * np.sin(np.arctan2(ey, ex))
        ridges = 0.5 + 0.5 * np.sin((rr + warp) * 2 * math.pi * 17)
        a = ridges ** 2 * np.clip((1 - rr) * 5, 0, 1) * (0.55 + 0.45 * np.clip(0.6 - 0.8 * _fbm(x, y, seed + 3, 4.0), 0, 1))
        return _rgba((0.18, 0.16, 0.14), a * 0.7)
    if name == "grease":
        u, v = (x + 0.15 * _fbm(x, y, seed + 4, 1.5)) * 0.62, y * 1.9      # wiped along x, its edge ragged
        body = np.clip(1 - np.hypot(u, v) ** 1.5 + 0.3 * n, 0, 1)
        # the fingers' streaks: along the wipe, uneven, broken by the noise, fading toward its tail
        streaks = np.clip(0.6 + 0.5 * _fbm(x * 0.25, y * 9.0, seed + 6, 1.0, 3) + 0.35 * np.sin(y * 23 + 2 * n), 0, 1)
        tail = np.clip(0.55 + 0.45 * (1 - x) / 2 + 0.2 * n, 0, 1)
        return _rgba((0.16, 0.12, 0.08), body * (0.45 + 0.55 * streaks) * tail * 0.8)
    if name == "drip":
        w = 0.16 + 0.04 * _fbm(x * 0.1, y, seed, 3.0)
        run = np.exp(-(x / w) ** 6) * (y < 0.75) * (y > -0.55)
        head = np.exp(-((np.hypot(x, (y - 0.72) * 1.4)) / 0.32) ** 4)
        drop = np.exp(-((np.hypot(x, (y + 0.62) * 0.9)) / 0.2) ** 4)
        dark = 0.7 + 0.3 * np.clip((0.75 - y) / 1.3, 0, 1)
        return _rgba((0.3, 0.22, 0.14), np.maximum.reduce([run * dark, head * 0.8, drop]) * 0.85)
    if name == "soot":
        a = np.clip(1 - r ** 1.4 + 0.45 * n, 0, 1) ** 1.5
        return _rgba((0.06, 0.05, 0.045), a * 0.92)
    if name == "water_mark":
        R = 0.74 + 0.07 * _fbm(np.cos(th), np.sin(th), seed + 2, 2.0)
        a = np.exp(-((r - R) / 0.03) ** 2) * 0.8 + (r < R) * 0.12 * (0.5 + n)
        return _rgba((0.92, 0.9, 0.86), a * 0.75)
    if name == "blood":
        rng = N.rng(seed, "blood")
        body = np.clip(1 - np.hypot(x * 1.25, (y - 0.05) * 1.7) ** 1.3 + 0.35 * n, 0, 1)
        a = np.clip(body * 1.6, 0, 1)
        for _ in range(26):
            ang, d = rng.uniform(0, 2 * math.pi), rng.uniform(0.55, 0.95)
            s = rng.uniform(0.012, 0.05)
            a = np.maximum(a, np.exp(-((x - d * math.cos(ang)) ** 2 + (y - d * math.sin(ang) * 0.8) ** 2) / s ** 2 * 2))
        dark = 0.75 + 0.25 * np.clip(body, 0, 1)
        out = _rgba((0.36, 0.03, 0.03), a * 0.95)
        out[..., :3] *= dark[..., None]
        return out
    if name == "dust":
        a = np.clip(0.75 - r * 0.7 + 0.5 * n, 0, 1) * (0.6 + 0.4 * np.clip(_fbm(x, y, seed + 5, 12.0) + 0.5, 0, 1))
        return _rgba((0.8, 0.77, 0.71), a * 0.8)
    if name == "rust":
        a = np.clip((0.2 + n * 1.6) * np.clip(1.15 - r, 0, 1) * 1.8, 0, 1)
        out = _rgba((0.46, 0.2, 0.07), a)
        out[..., :3] *= (0.8 + 0.35 * np.clip(_fbm(x, y, seed + 9, 9.0) + 0.5, 0, 1))[..., None]
        return out
    raise ValueError(f"smudge/{name}: one of {', '.join(INDEX)}")
