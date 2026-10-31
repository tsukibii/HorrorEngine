"""Metal finishes: how a bare metal surface was made and how it's been used, painted on an island as its colour,
roughness and fine relief (the normal map). `finish` is one of FINISHES, `age` lays tarnish, patina or rust over it.

    mirror    polished to a mirror: a few hairline scratches
    polished  bright, faint polishing marks
    satin     a fine even grain, soft highlights
    brushed   straight grain along `along` degrees (a knife's blade, a steel plate)
    swirl     used cutlery: thousands of tiny circular scratches from washing and drying, bright where they catch light
    scratched long random scratches over a satin base (keys in a pocket, a tool)
    hammered  hand-beaten dimples (a pot, a tray)
    cast      grainy, a little pitted (cast iron, a cheap key)
"""
import math

import numpy as np

from . import noise as N
from .paint import rgb

FINISHES = ("mirror", "polished", "satin", "brushed", "swirl", "scratched", "hammered", "cast")
BASE_ROUGH = {"mirror": 0.04, "polished": 0.1, "satin": 0.3, "brushed": 0.24, "swirl": 0.16, "scratched": 0.28, "hammered": 0.18, "cast": 0.55}
METALS = {"steel": "#c6c9cc", "silver": "#d8d8d4", "brass": "#c9a25e", "copper": "#c47a4f", "iron": "#5c5852", "nickel": "#c3c1b8",
          "gold": "#d9b45a", "aluminium": "#cfd2d5", "chrome": "#dfe2e5", "bronze": "#a5753f"}


def metal(f, finish="satin", color="steel", seed=0, along=0.0, amount=1.0, age=None, age_amount=0.5):
    """Lays a finished metal over a Frame: color a METALS name or '#hex'; age 'tarnish' | 'patina' | 'rust' | None."""
    c = rgb(METALS.get(color, color))
    r0 = BASE_ROUGH.get(finish, 0.3)
    f.fill(color=c, rough=r0, metal=1.0)
    X, Y = f.grid()
    r = N.rng(seed, "finish", finish)
    off = r.uniform(-100, 100, 3)
    a = math.radians(along)
    u = X * math.cos(a) + Y * math.sin(a)
    v = -X * math.sin(a) + Y * math.cos(a)
    if finish in ("brushed", "satin"):
        k = 25.0 if finish == "brushed" else 1.0
        g = N.fbm3(np.stack([u / (6.0 * k) + off[0], v / 0.35 + off[1], np.full_like(u, off[2])], -1), seed + 1, 3)
        f.lay_island(np.ones_like(X), rough=np.clip(r0 + 0.07 * g * amount, 0.02, 1).astype(np.float32),
                     height=(g * 0.0025 * amount).astype(np.float32))
    if finish in ("swirl", "polished", "mirror", "scratched"):
        # tiny arcs (washing and drying), or long straight hairlines
        n = int({"swirl": 900, "polished": 160, "mirror": 40, "scratched": 120}[finish] * amount * max(f.W * f.H, 1) / 2500)
        n = min(n, 4000)
        polys = []
        from .paint import stroke_polys
        for _ in range(n):
            cx, cy = r.uniform(0, f.W), r.uniform(0, f.H)
            if finish == "swirl":
                R = r.uniform(4, 40)
                a0 = r.uniform(0, 2 * math.pi)
                span = r.uniform(0.05, 0.35)
                t = np.linspace(a0, a0 + span, 6)
                pts = np.stack([cx + R * np.cos(t) - R * math.cos(a0), cy + R * np.sin(t) - R * math.sin(a0)], 1)
                w = r.uniform(0.02, 0.05)
            else:
                L = r.uniform(3, 25) if finish == "scratched" else r.uniform(1, 8)
                ang = r.uniform(0, math.pi)
                pts = np.array([(cx, cy), (cx + L * math.cos(ang), cy + L * math.sin(ang))])
                w = r.uniform(0.03, 0.09) if finish == "scratched" else 0.025
            polys += stroke_polys(pts, w)
        if polys:
            cov = f.cov_of(polys)
            f.lay_island(cov, rough=r0 * 0.6, height=-0.004, add_height=True, color=np.clip(c * 1.08 + 0.02, 0, 1).astype(np.float32), alpha=0.8)
    if finish == "hammered":
        f1, f2, _ = N.cells3(np.stack([X / 5.0, Y / 5.0, np.full_like(X, off[0])], -1), seed + 3)
        d = (f1 / 5.0) ** 2
        f.lay_island(np.ones_like(X), height=(-0.25 * (1 - np.clip(d * 3, 0, 1)) * amount).astype(np.float32), add_height=True)
    if finish == "cast":
        g = N.fbm3(np.stack([X / 0.6, Y / 0.6, np.full_like(X, off[1])], -1), seed + 4, 3)
        pits = N.smoothstep(0.55, 0.75, N.fbm3(np.stack([X / 1.5, Y / 1.5, np.full_like(X, off[2])], -1), seed + 5, 2) * 0.5 + 0.5)
        f.lay_island(np.ones_like(X), rough=np.clip(r0 + 0.12 * g + 0.2 * pits, 0, 1).astype(np.float32),
                     height=(0.01 * g - 0.04 * pits).astype(np.float32), color=(c[None, None] * (1 - 0.25 * pits[..., None])).astype(np.float32))
    if age:
        lay_age(f, age, age_amount, seed + 9, X, Y)


def lay_age(f, age, amount, seed, X=None, Y=None):
    """Tarnish (silver and steel going yellow-brown then dark), patina (brass and copper going brown, green in the
    hollows) or rust (orange-brown, rough, pitted), in blotches."""
    if X is None:
        X, Y = f.grid()
    off = N.rng(seed, "age").uniform(-50, 50, 2)
    g = N.fbm3(np.stack([X / 9.0 + off[0], Y / 9.0 + off[1], np.full_like(X, 2.3)], -1), seed, 4) * 0.5 + 0.5
    fine = N.fbm3(np.stack([X / 1.2, Y / 1.2, np.full_like(X, 7.1)], -1), seed + 1, 2) * 0.5 + 0.5
    m = N.smoothstep(0.62 - 0.45 * amount, 0.82 - 0.3 * amount, g * 0.8 + fine * 0.2)
    if age == "tarnish":
        # silver going warm and dull in soft clouds; the dark goes into the hollows with the grime (wear: dirt, grime)
        soft = N.smoothstep(0.2, 0.9, g) * amount
        col = rgb("#b09a6c")[None, None] * (1 - 0.35 * soft[..., None])
        f.lay_island(np.clip(soft * 0.55, 0, 1), color=col.astype(np.float32), rough=0.42, metal=0.85)
    elif age == "patina":
        green = N.smoothstep(0.7, 0.9, g)[..., None]
        col = rgb("#5e4a2e")[None, None] * (1 - green) + rgb("#4f8a72")[None, None] * green
        f.lay_island(m * 0.9, color=col.astype(np.float32), rough=0.7, metal=0.3)
    elif age == "rust":
        col = rgb("#7a3a18")[None, None] * (0.7 + 0.5 * fine[..., None])
        f.lay_island(m, color=col.astype(np.float32), rough=0.9, metal=0.05, height=(m * 0.03 * fine).astype(np.float32), add_height=True)
