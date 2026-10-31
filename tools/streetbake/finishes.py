"""The finishes: what a street's surfaces are made of, as procedural node groups read in the street's own UVs (metres,
docs/STREET_BUILDER.md §5), so each tiles at its real size and can be baked once into a tileable set; and the wear
group that lays the street's own wear atlas (wear.py: dirt, rain streaks, worn edges, the wet patches, the occlusion)
over any of them. Every noise a finish reads is on a flat torus of the finish's period, so what's baked from it tiles
without a seam. A material is rebuilt in place on the imported one: UVs -> finish -> wear -> bump -> Principled."""
import math

import bpy

from .nodes import group

GROUP_IO = ([("UV", "NodeSocketVector", None), ("Color", "NodeSocketColor", (0.8, 0.8, 0.8, 1.0))],
            [("Color", "NodeSocketColor"), ("Roughness", "NodeSocketFloat"), ("Height", "NodeSocketFloat"),
             ("Metallic", "NodeSocketFloat"), ("Alpha", "NodeSocketFloat")])

# what each slot is made of (a street's finish.json names others per material or per slot)
SLOT_FINISH = {
    "wall": "render", "wall2": "render", "trim": "render", "plaster": "render", "grime": "render",
    "concrete": "concrete", "plinth": "concrete", "roof_flat": "concrete", "pole": "concrete", "blocks": "blocks",
    "kerb": "kerb", "asphalt": "asphalt", "ground": "ground", "gravel": "ground", "pavement": "paving",
    "paint": "paint", "paint_y": "paint",
    "frame": "metal", "rail": "metal", "metal": "metal", "pipe": "metal", "steel": "metal", "post": "metal",
    "iron": "metal", "chrome": "metal", "shutter_box": "metal", "car": "metal",
    "shutter": "corrugated", "panel": "corrugated", "tiles": "roof_tiles", "roof": "roof_sheet",
    "glass": "glass", "car_glass": "glass", "glassblock": "glass",
    "wood": "wood", "wood_dark": "wood", "door": "wood",
    "awning": "fabric", "noren": "fabric", "cloth": "fabric", "cloth2": "fabric",
    "ac": "plastic", "vend": "plastic", "tank": "plastic", "white": "plastic", "red": "plastic", "black": "plastic",
    "yellow": "plastic", "blue": "plastic", "green": "plastic", "orange": "plastic", "hazard": "plastic",
    "plant_pot": "plastic",
    "lit": "glow", "lit_cool": "glow", "shop": "glow", "lobby": "glow", "paper": "glow", "lamp": "glow",
    "lamp_cool": "glow", "vend_lit": "glow", "headlight": "glow", "taillight": "glow",
}
# cut-out slots keep the street's own pattern (it is their shape), and pictures keep their picture
KEEP_IMAGE = {"bars", "chainlink", "lattice", "boards", "bamboo", "grate", "fan"}
GLOW = {"lit": 2.2, "lit_cool": 2.0, "shop": 2.2, "lobby": 2.5, "paper": 3.0, "lamp": 25.0, "lamp_cool": 25.0,
        "vend_lit": 6.0, "headlight": 20.0, "taillight": 6.0}

# how wear shows on each finish: dirt (a multiplier on the colour, and how much), rain streaks (the same), worn edges
# (the colour they show: "lighter", or one), the wet patches on what faces up, the tone's spread
WEAR = {
    "render":     dict(dirt=("#8c8478", 1.0), streak=("#7d776e", 1.0), edge=("lighter", 0.6), wet=0.0, tone=1.0),
    "tile":       dict(dirt=("#8a8277", 0.8), streak=("#837c72", 0.8), edge=("lighter", 0.3), wet=0.0, tone=0.8),
    "panel":      dict(dirt=("#8d857a", 0.8), streak=("#80786f", 0.9), edge=("lighter", 0.4), wet=0.0, tone=0.8),
    "concrete":   dict(dirt=("#7f786e", 1.0), streak=("#6f6a62", 1.0), edge=("lighter", 0.6), wet=0.0, tone=1.0),
    "blocks":     dict(dirt=("#7f786e", 1.0), streak=("#6f6a62", 0.9), edge=("lighter", 0.5), wet=0.0, tone=1.0),
    "kerb":       dict(dirt=("#6e675e", 1.0), streak=("#77716a", 0.4), edge=("lighter", 0.7), wet=0.3, tone=1.0),
    "asphalt":    dict(dirt=("#8a8379", 0.7), streak=("#ffffff", 0.0), edge=("lighter", 0.0), wet=0.9, tone=0.6),
    "ground":     dict(dirt=("#8a8379", 0.6), streak=("#ffffff", 0.0), edge=("lighter", 0.0), wet=0.6, tone=1.0),
    "paving":     dict(dirt=("#7c7368", 0.9), streak=("#ffffff", 0.0), edge=("lighter", 0.3), wet=0.6, tone=0.6),
    "paint":      dict(dirt=("#8c867c", 0.8), streak=("#ffffff", 0.0), edge=("lighter", 0.0), wet=0.5, tone=0.3),
    "metal":      dict(dirt=("#837a6e", 0.8), streak=("#7a6a58", 0.7), edge=("#5a3a22", 0.8), wet=0.0, tone=0.4),
    "corrugated": dict(dirt=("#837a6e", 0.8), streak=("#7a6a58", 0.8), edge=("#5a3a22", 0.6), wet=0.0, tone=0.4),
    "roof_tiles": dict(dirt=("#8a8379", 0.7), streak=("#7d776e", 0.4), edge=("lighter", 0.3), wet=0.0, tone=0.6),
    "roof_sheet": dict(dirt=("#837a6e", 0.7), streak=("#6e5a48", 0.6), edge=("#5a3a22", 0.5), wet=0.0, tone=0.5),
    "glass":      dict(dirt=("#9a948a", 0.6), streak=("#8e887e", 0.5), edge=("lighter", 0.0), wet=0.0, tone=0.0),
    "wood":       dict(dirt=("#7c7268", 0.8), streak=("#6e665c", 0.7), edge=("lighter", 0.4), wet=0.0, tone=0.6),
    "fabric":     dict(dirt=("#8a8278", 0.6), streak=("#857d72", 0.5), edge=("lighter", 0.2), wet=0.0, tone=0.5),
    "plastic":    dict(dirt=("#8a8278", 0.8), streak=("#7f776c", 0.8), edge=("lighter", 0.2), wet=0.0, tone=0.3),
    "plain":      dict(dirt=("#8a8278", 0.4), streak=("#ffffff", 0.0), edge=("lighter", 0.0), wet=0.0, tone=0.2),
    "image":      dict(dirt=("#8a8278", 0.5), streak=("#827a70", 0.4), edge=("lighter", 0.0), wet=0.0, tone=0.0),
    "glow":       dict(dirt=("#ffffff", 0.0), streak=("#ffffff", 0.0), edge=("lighter", 0.0), wet=0.0, tone=0.0),
}

# the period each finish's noise repeats (metres: its baked tile), chosen to hold whole bricks, tiles and seams
PERIOD = {"render": (4.0, 4.0), "tile": (1.864, 1.864), "panel": (3.6, 3.6), "concrete": (3.6, 3.6), "blocks": (2.4, 2.4),
          "kerb": (4.0, 4.0), "asphalt": (6.0, 6.0), "ground": (6.0, 6.0), "paving": (2.4, 2.4), "paint": (4.0, 4.0),
          "metal": (2.0, 2.0), "corrugated": (2.0, 2.0), "roof_tiles": (2.4, 2.4), "roof_sheet": (2.7, 2.7), "glass": (3.0, 3.0),
          "wood": (2.4, 2.4), "fabric": (2.0, 2.0), "plastic": (2.0, 2.0), "plain": (2.0, 2.0)}


def bricks(nb, uv, bw, rh, mortar, offset=0.5, soft=0.0015, seed=0.0, period=None):
    """A bond of bricks or tiles (bw wide, rh tall, `mortar` joints, every other row shifted by `offset` of a brick):
    (the mortar's mask, a random number per brick that repeats with the period (pu, pv), the place inside the brick
    (u, v), the distance to the nearest joint)."""
    u, v, _ = nb.sep(uv)
    vr = nb.div(v, rh)
    row = nb.floor(vr)
    fy = nb.mul(nb.fract(vr), rh)
    odd = nb.math("FLOORED_MODULO", row, 2.0)
    ur = nb.div(nb.add(u, nb.mul(odd, offset * bw)), bw)
    col = nb.floor(ur)
    fx = nb.mul(nb.fract(ur), bw)
    dx = nb.mn(fx, nb.sub(bw, fx))
    dy = nb.mn(fy, nb.sub(rh, fy))
    d = nb.mn(dx, dy)
    m = nb.one_minus(nb.ramp(d, mortar / 2 - soft, mortar / 2 + soft))
    if period:
        col = nb.math("FLOORED_MODULO", col, max(1, round(period[0] / bw)))
        row = nb.math("FLOORED_MODULO", row, max(1, round(period[1] / rh)))
    wn = nb.node("ShaderNodeTexWhiteNoise", noise_dimensions="3D")
    nb.put(nb.comb(col, row, seed), wn.inputs["Vector"])
    return m, wn.outputs["Value"], (fx, fy), d


def finish_group(name):
    """The node group of a finish (made once a file)."""
    ng = bpy.data.node_groups.get("Finish " + name)
    if ng:
        return ng
    ng, nb, gi, go = group("Finish " + name, *GROUP_IO)
    P = PERIOD.get(name, (2.0, 2.0))
    uv, col = gi.outputs["UV"], gi.outputs["Color"]
    T = nb.torus(uv, P)
    tint, rough, height, metal, alpha = BUILD[name](nb, uv, T, P)
    c = nb.cmul(col, tint)
    nb.put(c, go.inputs["Color"])
    for k, v in (("Roughness", rough), ("Height", height), ("Metallic", metal), ("Alpha", alpha)):
        nb.put(v, go.inputs[k])
    return ng


def lin(nb, x, a, b):
    """a + b x"""
    return nb.madd(x, b, a)


def f_render(nb, uv, T, P):
    m1 = nb.noise(T, 0.5, 3, 0.55)
    m2 = nb.noise(T, 3.0, 4, 0.6)
    g = nb.noise(T, 80, 2, 0.5)
    tint = lin(nb, m1, 0.80, 0.16)
    tint = nb.add(tint, nb.mul(nb.sub(m2, 0.5), 0.08))
    tint = nb.add(tint, nb.mul(nb.sub(g, 0.5), 0.05))
    edge = nb.voronoi(T, 1.4, "DISTANCE_TO_EDGE")
    cm = nb.ramp(nb.noise(T, 0.9, 2), 0.56, 0.68)
    crack = nb.mul(nb.one_minus(nb.ramp(edge, 0.0, 0.012)), cm)
    tint = nb.mul(tint, nb.one_minus(nb.mul(crack, 0.35)))
    h = nb.add(nb.mul(nb.noise(T, 28, 5, 0.65), 0.6), nb.mul(g, 0.25))
    h = nb.sub(h, crack)
    rough = lin(nb, m2, 0.80, 0.14)
    return tint, rough, h, 0.0, 1.0


def f_tile(nb, uv, T, P):
    m, rnd, _, d = bricks(nb, uv, 0.233, 1.864 / 28, 0.006, 0.5, period=P)
    tint = lin(nb, rnd, 0.86, 0.12)
    tint = nb.add(tint, nb.mul(nb.sub(nb.noise(T, 2.0, 3), 0.5), 0.06))
    tint = nb.mixf(m, tint, 0.62)
    h = nb.mixf(m, nb.add(0.9, nb.mul(nb.noise(T, 60, 2), 0.1)), 0.0)
    rough = nb.mixf(m, lin(nb, nb.noise(T, 6.0, 2), 0.28, 0.2), 0.95)
    return tint, rough, h, 0.0, 1.0


def f_panel(nb, uv, T, P):
    m, rnd, _, d = bricks(nb, uv, 1.8, 0.9, 0.01, 0.0, period=P)
    tint = lin(nb, rnd, 0.84, 0.1)
    s = nb.noise(T, 1.6, 4, 0.6)
    tint = nb.add(tint, nb.mul(nb.sub(s, 0.5), 0.1))
    spk = nb.ramp(nb.noise(T, 120, 1), 0.62, 0.72)
    tint = nb.add(tint, nb.mul(spk, 0.04))
    tint = nb.mixf(m, tint, 0.5)
    h = nb.mixf(m, nb.add(0.8, nb.mul(nb.noise(T, 40, 3), 0.2)), 0.0)
    rough = nb.mixf(m, lin(nb, s, 0.45, 0.3), 0.95)
    return tint, rough, h, 0.0, 1.0


def f_concrete(nb, uv, T, P):
    u, v, _ = nb.sep(uv)
    m1 = nb.noise(T, 0.7, 4, 0.6)
    m2 = nb.noise(T, 5.0, 3, 0.6)
    tint = lin(nb, m1, 0.74, 0.2)
    tint = nb.add(tint, nb.mul(nb.sub(m2, 0.5), 0.1))
    pour = nb.mul(nb.sin(nb.mul(v, 6.2832 / 0.6)), nb.mul(nb.noise(T, 1.0, 2), 0.04))
    tint = nb.add(tint, pour)
    seam, _, _, _ = bricks(nb, uv, 1.8, 0.9, 0.004, 0.0, period=P)
    tint = nb.mul(tint, nb.one_minus(nb.mul(seam, 0.12)))
    # the form ties' holes (P-cones), every 450 x 600 mm
    cu = nb.sub(nb.fract(nb.div(nb.add(u, 0.225), 0.45)), 0.5)
    cv = nb.sub(nb.fract(nb.div(nb.add(v, 0.3), 0.6)), 0.5)
    dist = nb.vmath("LENGTH", nb.comb(nb.mul(cu, 0.45), nb.mul(cv, 0.6), 0.0), out=1)
    hole = nb.one_minus(nb.ramp(dist, 0.011, 0.014))
    tint = nb.mul(tint, nb.one_minus(nb.mul(hole, 0.45)))
    pits = nb.ramp(nb.voronoi(T, 90, "F1"), 0.05, 0.0)
    h = nb.sub(nb.sub(nb.mul(nb.noise(T, 35, 5, 0.65), 0.5), nb.mul(hole, 1.0)), nb.mul(pits, 0.4))
    h = nb.sub(h, nb.mul(seam, 0.4))
    rough = lin(nb, m2, 0.82, 0.12)
    return tint, rough, h, 0.0, 1.0


def f_blocks(nb, uv, T, P):
    m, rnd, _, _ = bricks(nb, uv, 0.4, 0.2, 0.01, 0.5, period=P)
    tint = lin(nb, rnd, 0.85, 0.12)
    tint = nb.add(tint, nb.mul(nb.sub(nb.noise(T, 8, 3), 0.5), 0.12))
    tint = nb.mixf(m, tint, 0.7)
    h = nb.mixf(m, nb.add(0.8, nb.mul(nb.noise(T, 50, 3), 0.25)), 0.0)
    return tint, nb.mixf(m, 0.88, 0.95), h, 0.0, 1.0


def f_kerb(nb, uv, T, P):
    m, rnd, _, _ = bricks(nb, uv, 1.0, 4.0, 0.008, 0.0, period=P)
    tint = lin(nb, rnd, 0.86, 0.12)
    g = nb.noise(T, 30, 4, 0.6)
    tint = nb.add(tint, nb.mul(nb.sub(g, 0.5), 0.12))
    tint = nb.mixf(m, tint, 0.55)
    h = nb.mixf(m, nb.add(0.7, nb.mul(g, 0.3)), 0.0)
    return tint, lin(nb, g, 0.8, 0.15), h, 0.0, 1.0


def f_asphalt(nb, uv, T, P):
    stones = nb.voronoi(T, 55, "F1", out="Color")
    sr, _, _ = nb.sepc(stones)
    sd = nb.voronoi(T, 55, "F1")
    light = nb.mul(nb.ramp(sr, 0.78, 0.9), nb.ramp(sd, 0.35, 0.15))
    fine = nb.noise(T, 160, 2)
    big = nb.noise(T, 0.35, 3, 0.55)
    tint = lin(nb, big, 0.6, 0.18)                       # a tint stays under 1: a baked map can't hold more
    tint = nb.add(tint, nb.mul(light, 0.26))
    tint = nb.add(tint, nb.mul(nb.sub(fine, 0.5), 0.08))
    # repairs: square patches darker and smoother
    pc = nb.voronoi(T, 0.32, "F1", "CHEBYCHEV", out="Color")
    pr, _, _ = nb.sepc(pc)
    patch = nb.ramp(pr, 0.86, 0.87)
    tint = nb.mul(tint, nb.one_minus(nb.mul(patch, 0.22)))
    # cracks, sparse
    e = nb.voronoi(T, 0.9, "DISTANCE_TO_EDGE")
    cm = nb.ramp(nb.noise(T, 0.6, 3), 0.64, 0.7)
    crack = nb.mul(nb.one_minus(nb.ramp(e, 0.0, 0.006)), cm)
    tint = nb.mul(tint, nb.one_minus(nb.mul(crack, 0.5)))
    h = nb.sub(nb.add(nb.mul(nb.ramp(sd, 0.45, 0.0), 0.7), nb.mul(fine, 0.3)), nb.mul(crack, 1.2))
    rough = nb.sub(lin(nb, fine, 0.84, 0.12), nb.mul(patch, 0.12))
    return tint, rough, h, 0.0, 1.0


def f_ground(nb, uv, T, P):
    g = nb.noise(T, 0.6, 4, 0.6)
    tint = lin(nb, g, 0.75, 0.3)
    tint = nb.add(tint, nb.mul(nb.sub(nb.noise(T, 25, 2), 0.5), 0.12))
    return tint, 0.95, nb.noise(T, 20, 4), 0.0, 1.0


def f_paving(nb, uv, T, P):
    m, rnd, _, d = bricks(nb, uv, 0.3, 0.3, 0.005, 0.0, period=P)
    tint = lin(nb, rnd, 0.82, 0.16)
    odd = nb.ramp(rnd, 0.93, 0.94)
    tint = nb.mul(tint, nb.one_minus(nb.mul(odd, 0.18)))
    g = nb.noise(T, 40, 3, 0.6)
    tint = nb.add(tint, nb.mul(nb.sub(g, 0.5), 0.1))
    tint = nb.mixf(m, tint, 0.45)
    bev = nb.ramp(d, 0.0025, 0.012)
    h = nb.mul(bev, nb.add(0.8, nb.mul(g, 0.2)))
    rough = nb.mixf(m, lin(nb, g, 0.55, 0.25), 0.95)
    return tint, rough, h, 0.0, 1.0


def f_paint(nb, uv, T, P):
    w1 = nb.noise(T, 2.5, 4, 0.65)
    w2 = nb.noise(T, 22, 3, 0.6)
    worn = nb.one_minus(nb.ramp(nb.add(nb.mul(w1, 0.75), nb.mul(w2, 0.25)), 0.36, 0.44))
    tint = nb.mixf(worn, lin(nb, w2, 0.88, 0.1), 0.05)
    h = nb.mixf(worn, 1.0, 0.0)
    return tint, nb.mixf(worn, 0.62, 0.9), h, 0.0, nb.one_minus(worn)


def f_metal(nb, uv, T, P):
    n = nb.noise(T, 3, 3, 0.6)
    peel = nb.noise(T, 140, 2)
    tint = lin(nb, n, 0.9, 0.1)
    return tint, lin(nb, n, 0.42, 0.2), nb.mul(peel, 0.3), 0.0, 1.0


def f_corrugated(nb, uv, T, P):
    u, v, _ = nb.sep(uv)
    rib = nb.sin(nb.mul(v, 6.2832 / 0.08))
    n = nb.noise(T, 2.5, 3, 0.6)
    tint = nb.add(lin(nb, n, 0.84, 0.12), nb.mul(rib, 0.03))
    return tint, lin(nb, n, 0.4, 0.25), nb.mul(rib, 0.5), 0.3, 1.0


def slope_axes(nb, uv):
    """On a roof (UVs looked at from above), (across the slope, along it): which of u and v runs down the slope,
    from where +u points on the face."""
    t = nb.node("ShaderNodeTangent", direction_type="UV_MAP", uv_map="UVMap").outputs[0]
    _, _, tz = nb.sep(t)
    along_u = nb.ramp(nb.absf(tz), 0.15, 0.25)          # 1: u runs down the slope
    u, v, _ = nb.sep(uv)
    return nb.mixf(along_u, u, v), nb.mixf(along_u, v, u)


def f_roof_tiles(nb, uv, T, P):
    a, s = slope_axes(nb, uv)
    rib = nb.cos(nb.mul(a, 2 * math.pi / 0.3))
    course = nb.fract(nb.div(s, 0.24))
    lip = nb.ramp(course, 0.86, 0.98)
    n = nb.noise(T, 1.2, 3, 0.6)
    tint = nb.add(lin(nb, n, 0.8, 0.18), nb.mul(rib, 0.06))
    tint = nb.mul(tint, nb.one_minus(nb.mul(lip, 0.25)))
    h = nb.add(nb.mul(rib, 0.6), nb.mul(lip, -0.6))
    return tint, lin(nb, n, 0.5, 0.25), h, 0.0, 1.0


def f_roof_sheet(nb, uv, T, P):
    a, s = slope_axes(nb, uv)
    seam = nb.one_minus(nb.ramp(nb.absf(nb.sub(nb.fract(nb.div(a, 0.45)), 0.5)), 0.46, 0.49))
    n = nb.noise(T, 1.5, 3, 0.6)
    tint = nb.mul(lin(nb, n, 0.78, 0.18), nb.one_minus(nb.mul(seam, 0.12)))
    return tint, lin(nb, n, 0.45, 0.3), nb.mul(nb.one_minus(seam), 1.0), 0.4, 1.0


def f_glass(nb, uv, T, P):
    smudge = nb.noise(T, 2.0, 4, 0.6)
    return 1.0, lin(nb, smudge, 0.03, 0.16), 0.0, 0.0, 1.0


def f_wood(nb, uv, T, P):
    u, v, _ = nb.sep(uv)
    d = nb.noise(T, 1.5, 3)
    grain = nb.sin(nb.add(nb.mul(u, 2 * math.pi / 0.012), nb.mul(d, 9.0)))
    planks, rnd, _, _ = bricks(nb, nb.comb(v, u, 0.0), 2.4, 0.15, 0.004, 0.37, period=P)
    tint = nb.add(lin(nb, rnd, 0.8, 0.2), nb.mul(grain, 0.05))
    tint = nb.mixf(planks, tint, 0.5)
    return tint, lin(nb, d, 0.6, 0.2), nb.add(nb.mul(grain, 0.2), nb.mul(planks, -1.0)), 0.0, 1.0


def f_fabric(nb, uv, T, P):
    n = nb.noise(T, 4, 3, 0.6)
    weave = nb.noise(T, 300, 1)
    return nb.add(lin(nb, n, 0.85, 0.12), nb.mul(weave, 0.03)), 0.95, nb.mul(weave, 0.3), 0.0, 1.0


def f_plastic(nb, uv, T, P):
    n = nb.noise(T, 2, 3, 0.6)
    return lin(nb, n, 0.9, 0.1), lin(nb, n, 0.45, 0.2), nb.mul(nb.noise(T, 90, 2), 0.2), 0.0, 1.0


def f_plain(nb, uv, T, P):
    return 1.0, 0.7, 0.0, 0.0, 1.0


BUILD = {"render": f_render, "tile": f_tile, "panel": f_panel, "concrete": f_concrete, "blocks": f_blocks, "kerb": f_kerb,
         "asphalt": f_asphalt, "ground": f_ground, "paving": f_paving, "paint": f_paint, "metal": f_metal,
         "corrugated": f_corrugated, "roof_tiles": f_roof_tiles, "roof_sheet": f_roof_sheet, "glass": f_glass,
         "wood": f_wood, "fabric": f_fabric, "plastic": f_plastic, "plain": f_plain}
FINISHES = sorted(BUILD)


def wear_group(img):
    """The wear laid over a finish from the street's wear atlas (UV 'Wear': R the occlusion, G dirt, B rain streaks on
    walls or the wet patches on what faces up, A worn edges), with a slow tone in the world's space. The Godot
    plugin's street shader (horrorstudio_look/street.gdshader) does the same sums."""
    ng = bpy.data.node_groups.get("Street wear")
    if ng:
        return ng
    ins = [("Color", "NodeSocketColor", (0.8, 0.8, 0.8, 1.0)), ("Roughness", "NodeSocketFloat", 0.8),
           ("DirtColor", "NodeSocketColor", (0.5, 0.48, 0.45, 1.0)), ("Dirt", "NodeSocketFloat", 1.0),
           ("StreakColor", "NodeSocketColor", (0.5, 0.48, 0.45, 1.0)), ("Streaks", "NodeSocketFloat", 1.0),
           ("EdgeColor", "NodeSocketColor", (0.9, 0.9, 0.9, 1.0)), ("EdgeLighter", "NodeSocketFloat", 1.0),
           ("Edges", "NodeSocketFloat", 0.5), ("Wet", "NodeSocketFloat", 0.0), ("Tone", "NodeSocketFloat", 1.0),
           ("Amount", "NodeSocketFloat", 1.0)]
    outs = [("Color", "NodeSocketColor"), ("Roughness", "NodeSocketFloat"), ("AO", "NodeSocketFloat")]
    ng, nb, gi, go = group("Street wear", ins, outs)
    I = gi.outputs
    tex = nb.node("ShaderNodeTexImage", image=img, interpolation="Linear", extension="EXTEND")
    nb.put(nb.uv("Wear"), tex.inputs["Vector"])
    A, R, G = nb.sepc(tex.outputs["Color"])            # occlusion, dirt, streaks / wet
    B = tex.outputs["Alpha"]                           # worn edges
    _, _, nz = nb.sep(nb.geo("Normal"))
    vertical = nb.one_minus(nb.ramp(nb.absf(nz), 0.45, 0.7))
    up = nb.ramp(nz, 0.6, 0.85)
    c = I["Color"]
    tone = nb.noise(nb.geo("Position"), 0.12, 2, 0.5)
    c = nb.cmul(c, nb.add(1.0, nb.mul(nb.mul(nb.sub(tone, 0.5), 0.3), I["Tone"])))
    amt = I["Amount"]
    f = nb.clamp(nb.mul(nb.mul(R, I["Dirt"]), amt))
    c = nb.mix(f, c, nb.mix(1.0, c, I["DirtColor"], "MULTIPLY"))
    s = nb.clamp(nb.mul(nb.mul(nb.mul(G, I["Streaks"]), vertical), amt))
    c = nb.mix(s, c, nb.mix(1.0, c, I["StreakColor"], "MULTIPLY"))
    w = nb.clamp(nb.mul(nb.mul(nb.mul(G, I["Wet"]), up), amt))
    c = nb.cmul(c, nb.one_minus(nb.mul(w, 0.35)))
    e = nb.clamp(nb.mul(nb.mul(B, I["Edges"]), amt))
    lighter = nb.mix(1.0, nb.cmul(c, 1.3), (0.03, 0.03, 0.03, 1.0), "ADD")
    ec = nb.mix(I["EdgeLighter"], I["EdgeColor"], lighter)
    c = nb.mix(e, c, ec)
    r = nb.add(I["Roughness"], nb.add(nb.mul(f, 0.08), nb.mul(s, 0.04)))
    r = nb.mul(r, nb.one_minus(nb.mul(w, 0.7)))
    nb.put(c, go.inputs["Color"])
    nb.put(nb.clamp(r), go.inputs["Roughness"])
    nb.put(A, go.inputs["AO"])
    return ng
