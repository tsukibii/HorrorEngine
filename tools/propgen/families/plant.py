"""Potted plants for indoors, a table's to a floor's: a pot turned from a profile with a real wall (the ware family's
way: terracotta, a glazed belly, a plastic taper, a cylinder, a bonsai's shallow bowl) or cut as a cube planter (a slab
ring with its hole, a bottom and the soil in it), the soil a lumpy surface a little below the rim (with a topping:
pebbles, pumice, moss, bark), and the plant on top from the tree family's growth and cards (families/tree.py): a
small tree (a ficus, a bonsai pine, a herb bush, a dead one), leaves radiating from the soil (an aloe's rosette, a snake
plant's blades, a fern's fronds), big leaves on petioles up a stem (a monstera with its splits, a rubber plant, a fiddle
leaf fig), canes with crowns (an areca palm, a yucca, lucky bamboo), vines trailing over the rim (a pothos, an ivy), a
ribbed cactus turned and bent. Every leaf is drawn by code on a card, cut in Godot; the pot's glaze or clay too.

    {"family": "plant", "form": "rosette", "pot": {"kind": "terracotta", "d": 95, "h": 85, "color": "#b8643c",
     "soil": 12, "topping": "pebbles"}, "plant": {"size": 0.14, "count": 22, "color": ["#7a9a6a", "#5f7f52"]}, "seed": 3}

    "form": "rosette" | "blades" | "fern" | "palm" | "big_leaf" | "tree" | "trailing" | "canes" | "yucca" | "cactus"
    "pot.kind": "terracotta" | "glazed" | "plastic" | "cylinder" | "bowl" | "cube" | "concrete"
    "pot.topping": "none" | "pebbles" | "pumice" | "moss" | "bark"
    "plant.leaf": "aloe" | "blade" | "fern" | "frond" | "monstera" | "rubber" | "fiddle" | "heart" | "ivy" | "strap" | "echeveria"
    "plant.species": "ficus" | "bonsai" | "herb" | "dead"

`pot`: `d` the diameter (a cube's `w`, `dd` its depth) and `h` its height in mm, `color`, `soil` mm below the rim,
`cracked` (a terracotta pot's crack), `glaze` a design's fields for a glazed pot (designs.glaze: `rim`, `crackle`).
`plant`: `size` metres (a leaf's length, a tree's height, a cane's), `count`, `color` the leaves' colours (one or a
few), `leaf` the leaf drawn (each form has its own by default), `species` for the `tree` form, `lean`, `spread`.
"""
import math

import numpy as np

from .. import bake as BK
from .. import designs
from .. import mesh as M
from .. import mtree as T
from .. import noise as N
from ..paint import rgb
from . import tree as TR

MM = 0.001
UP = np.array([0.0, 0.0, 1.0])

# the forms' defaults: their leaf, colours, sizes, how the pot is filled
FORMS = {
    "rosette":  {"leaf": "aloe", "color": ["#7a9a6a", "#5f7f52"], "size": 0.13, "count": 20, "gloss": 0.45},
    "blades":   {"leaf": "blade", "color": ["#2f5a30", "#4e7f3a"], "size": 0.6, "count": 11, "gloss": 0.35},
    "fern":     {"leaf": "fern", "color": ["#4a8a34", "#6aa84a"], "size": 0.45, "count": 22, "gloss": 0.5},
    "palm":     {"leaf": "frond", "color": ["#4e8a3c", "#6fa852"], "size": 0.8, "count": 7, "canes": 4, "gloss": 0.4},
    "big_leaf": {"leaf": "monstera", "color": ["#2e6a36", "#4a8a48"], "size": 0.5, "count": 9, "gloss": 0.25},
    "tree":     {"species": "ficus", "color": ["#3f7a34", "#6a9e46"], "size": 1.2, "gloss": 0.4},
    "trailing": {"leaf": "heart", "color": ["#4a8a3a", "#8cb85a"], "size": 0.09, "count": 6, "length": 0.45, "gloss": 0.35},
    "canes":    {"leaf": "strap", "color": ["#4f8a3c", "#7aa850"], "size": 0.5, "count": 5, "gloss": 0.5},
    "yucca":    {"leaf": "strap", "color": ["#4a7a3c", "#6a9a50"], "size": 0.9, "count": 2, "gloss": 0.45},
    "cactus":   {"color": ["#4f7a3e", "#6a9a52"], "size": 0.3, "ribs": 12, "gloss": 0.6},
}
# the plant's tiny species for the tree form, in the tree family's words (heights in metres at their default)
SPECIES = {
    "ficus": {"height": 1.2, "clear": 0.35, "radius": 0.018, "trunk": {"frac": 0.75, "shape": 0.8, "randomness": 0.5, "up": 0.7},
              "levels": [
                  {"end": 0.97, "density": 13.0, "length": {"from": 0.3, "to": 0.14}, "angle": {"from": 62, "to": 40}, "start_radius": 0.4,
                   "end_radius": 0.15, "randomness": 0.45, "gravity": 3.0, "stiffness": 0.2, "split": 0.55, "split_angle": 34, "split_radius": 0.8,
                   "up": 0.35, "flatness": 0.3, "break": 0.01, "resolution": 8},
                  {"start": 0.15, "density": 14.0, "length": [0.07, 0.14], "angle": [35, 62], "start_radius": 0.4, "end_radius": 0.2,
                   "randomness": 0.5, "gravity": 4.0, "stiffness": 0.12, "split": 0.4, "split_angle": 36, "split_radius": 0.8, "up": 0.25,
                   "flatness": 0.4, "break": 0.02, "resolution": 12}],
              "leaf": {"shape": "ovate", "mm": (62, 30), "card": 0.14, "cluster": 7, "gloss": 0.4, "count": 650, "on": "all",
                       "colors": {"summer": ["#3f7a34", "#6a9e46"], "spring": ["#5a9a40", "#8cbe5a"], "autumn": ["#3f7a34", "#6a9e46"]}},
              "bark": {"style": "smooth", "color": "#8a8070", "relief": 0.4, "pbr": "pbr/bark/Bark006_1K-PNG", "tint": "#b0a898"},
              "pipe": {"end": 0.0022, "growth": 0.3, "power": 2.3}},
    "bonsai": {"height": 0.42, "clear": 0.08, "radius": 0.014, "trunk": {"frac": 0.7, "shape": 0.5, "randomness": 2.6, "up": 0.25}, "lean": 16,
               "levels": [
                   {"start": 0.22, "end": 0.97, "density": 26.0, "length": {"from": 0.22, "to": 0.1}, "angle": {"from": 86, "to": 66}, "start_radius": 0.5,
                    "end_radius": 0.22, "randomness": 0.6, "gravity": 6.0, "stiffness": 0.15, "split": 0.55, "split_angle": 40, "split_radius": 0.82,
                    "up": 0.1, "flatness": 0.8, "break": 0.01, "resolution": 12},
                   {"start": 0.25, "density": 34.0, "length": [0.035, 0.075], "angle": [45, 80], "start_radius": 0.45, "end_radius": 0.25,
                    "randomness": 0.4, "gravity": 1.5, "stiffness": 0.15, "split": 0.5, "split_angle": 44, "split_radius": 0.8, "up": 0.9,
                    "flatness": 0.7, "break": 0.02, "resolution": 16}],
               "leaf": {"shape": "needles", "mm": (30, 30), "card": 0.075, "cluster": 1, "gloss": 0.55, "count": 520, "on": "all",
                        "colors": {"summer": ["#2f5a2e", "#4a7a3e"], "spring": ["#3f6f36", "#6a9a4a"], "autumn": ["#2f5a2e", "#4a7a3e"]}},
               "bark": {"style": "scaly", "color": "#6b5a4e", "crack": "#2a2320", "plate": "#8a6e5a", "relief": 1.2, "pbr": "pbr/bark/Bark014_1K-PNG"},
               "pipe": {"end": 0.0025, "growth": 0.5, "power": 2.4}},
    "herb": {"height": 0.3, "clear": 0.0, "radius": 0.004, "trunk": {"frac": 0.5, "shape": 0.8, "randomness": 0.7, "up": 0.6}, "multi": 7, "spread_m": 0.03,
             "levels": [
                 {"start": 0.1, "end": 1.0, "density": 14.0, "length": [0.08, 0.16], "angle": [30, 60], "start_radius": 0.55, "end_radius": 0.3,
                  "randomness": 0.5, "gravity": 1.5, "stiffness": 0.2, "split": 0.6, "split_angle": 40, "split_radius": 0.85, "up": 0.6,
                  "flatness": 0.2, "break": 0.01, "resolution": 18}],
             "leaf": {"shape": "ovate", "mm": (36, 22), "card": 0.11, "cluster": 7, "gloss": 0.45, "count": 260, "on": "all",
                      "colors": {"summer": ["#4a8a34", "#7ab050"], "spring": ["#5a9a40", "#8cbe5a"], "autumn": ["#4a8a34", "#7ab050"]}},
             "bark": {"style": "smooth", "color": "#6a8a4a", "relief": 0.2},
             "pipe": {"end": 0.0015, "growth": 0.2, "power": 2.3}},
    "dead": {"height": 0.5, "clear": 0.05, "radius": 0.006, "trunk": {"frac": 0.6, "shape": 0.8, "randomness": 1.0, "up": 0.3}, "multi": 3, "spread_m": 0.02,
             "levels": [
                 {"start": 0.1, "end": 1.0, "density": 8.0, "length": [0.1, 0.24], "angle": [30, 70], "start_radius": 0.5, "end_radius": 0.25,
                  "randomness": 0.8, "gravity": 9.0, "stiffness": 0.1, "split": 0.5, "split_angle": 40, "split_radius": 0.85, "up": 0.0,
                  "flatness": 0.3, "break": 0.08, "resolution": 12}],
             "leaf": {"shape": "ovate", "mm": (30, 14), "card": 0.1, "cluster": 4, "gloss": 0.7, "count": 40, "on": "all",
                      "colors": {"summer": ["#7a6a4a", "#8a7656"], "spring": ["#7a6a4a", "#8a7656"], "autumn": ["#7a6a4a", "#8a7656"]}},
             "bark": {"style": "smooth", "color": "#7a6e62", "relief": 0.3},
             "pipe": {"end": 0.0015, "growth": 0.2, "power": 2.3}},
}
POTS = {
    "terracotta": {"color": "#b8643c", "kind": "stone", "rough": 0.9},
    "glazed": {"color": "#3a6e8a", "kind": "plastic", "rough": 0.14},
    "plastic": {"color": "#3a3a3c", "kind": "plastic", "rough": 0.45},
    "cylinder": {"color": "#e8e4dc", "kind": "plastic", "rough": 0.2},
    "bowl": {"color": "#4a3a30", "kind": "plastic", "rough": 0.25},
    "cube": {"color": "#e6e2da", "kind": "plastic", "rough": 0.22},
    "concrete": {"color": "#9a9690", "kind": "stone", "rough": 0.92},
}


# ---- the pot ---------------------------------------------------------------------------------------------------------------

def pot_profile(kind, R, h):
    """The outside (r, z) in mm from the foot up to the rim, and the wall's thickness, for a round pot."""
    if kind == "terracotta":
        rim = max(6.0, h * 0.11)
        out = [(R * 0.62, 0), (R * 0.64, 2.0), (R * 0.93, h - rim - 1.5), (R * 0.93, h - rim), (R, h - rim + 1.0), (R, h)]
        return out, max(4.5, R * 0.075)
    if kind == "glazed":
        out = [(R * 0.58, 0), (R * 0.72, h * 0.07), (R * 0.93, h * 0.3), (R, h * 0.6), (R * 0.97, h * 0.86), (R * 0.9, h)]
        return out, max(4.0, R * 0.07)
    if kind == "plastic":
        out = [(R * 0.7, 0), (R * 0.71, 1.5), (R * 0.96, h - 6), (R, h - 5), (R, h)]
        return out, max(2.2, R * 0.035)
    if kind == "bowl":
        out = [(R * 0.8, 0), (R * 0.82, 2.0), (R * 0.97, h * 0.45), (R, h)]
        return out, max(4.0, R * 0.08)
    # cylinder, concrete
    b = min(6.0, h * 0.08)
    out = [(R - b, 0), (R - b * 0.3, b * 0.3), (R, b), (R, h - b * 0.5), (R - b * 0.3, h)]
    return out, max(4.0, R * 0.08)


def pot_wall(out, t, soil_z):
    """The closed profile of a round pot: under the foot, the outside up, round the lip, the inside down to the soil, the
    soil inward to the middle (the walk that makes every face look out, the soil's up: LESSONS 2026-10-31)."""
    r0 = out[0][0]
    under = [(0, 1.2), (r0 - 3.0, 1.0), (r0 - 1.2, 0.0), (r0, out[0][1])]
    r_lip, z_lip = out[-1]
    lip = [(r_lip - t / 2 + t / 2 * math.cos(a), z_lip + t / 2 * math.sin(a) * 0.9) for a in np.linspace(0, math.pi, 7)]
    o = np.array(out, float)
    d = np.gradient(o, axis=0)
    nrm = np.stack([d[:, 1], -d[:, 0]], 1)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    inner = o - nrm * t
    inside = [(max(r, t), z) for r, z in inner[::-1] if z > soil_z + 1.0]
    r_soil = float(np.interp(soil_z, o[:, 1], o[:, 0])) - t
    inside.append((r_soil, soil_z))
    soil = [(r_soil, soil_z), (r_soil - 2.0, soil_z + 1.0), (r_soil * 0.55, soil_z + 3.0), (r_soil * 0.2, soil_z + 4.0), (0.0, soil_z + 4.2)]
    return {"under": under, "outside": list(out), "lip": lip, "inside": inside, "soil": soil, "r_soil": r_soil}


def round_pot(spec_pot, kind, th, I, seed):
    """A round pot and its soil as one lathe (metres): the pot's faces on `pot`, the soil's on `soil`."""
    d = float(spec_pot.get("d", 140))
    h = float(spec_pot.get("h", d * 0.9))
    R = d / 2
    out, t = pot_profile(kind, R, h)
    soil_z = h - float(spec_pot.get("soil", max(10.0, h * 0.12)))
    prof = pot_wall(out, t, soil_z)
    segs = [M.Seg(np.array(prof["under"]) * MM, "pot_under", "bottom", disc=R * MM, mat="pot"),
            M.Seg(np.array(prof["outside"]) * MM, "pot_out", "band", mat="pot"),
            M.Seg(np.array(prof["lip"]) * MM, "pot_lip", "band", mat="pot"),
            M.Seg(np.array(prof["inside"]) * MM, "pot_in", "band", mat="pot"),
            M.Seg(np.array(prof["soil"]) * MM, "soil", "top", disc=prof["r_soil"] * MM, mat="soil")]
    n = 32 if d < 120 else (40 if d < 200 else 52)
    arclen = sum(M.arclen(np.array(prof[k]) * MM) for k in ("under", "outside", "lip", "inside", "soil"))
    m = M.lathe(segs, n, I, step=max(0.004, arclen / 44), mats=["pot", "soil"])
    _lump_soil(m, soil_z * MM, prof["r_soil"] * MM, seed)
    return m, {"R": R * MM, "h": h * MM, "soil_z": soil_z * MM, "r_soil": prof["r_soil"] * MM, "out": out, "t": t}


def cube_pot(spec_pot, th, I, seed):
    """A cube planter: a slab ring with its hole (the walls), a bottom, the soil as a slab in it, lumpy."""
    w = float(spec_pot.get("w", spec_pot.get("d", 160)))
    dd = float(spec_pot.get("dd", w))
    h = float(spec_pot.get("h", w * 0.95))
    t = max(5.0, w * 0.05)
    soil_z = h - float(spec_pot.get("soil", max(10.0, h * 0.12)))
    from ..paint import rrect_poly
    outer = rrect_poly(-w / 2, -dd / 2, w, dd, max(4.0, w * 0.04), n=6) * MM
    inner = rrect_poly(-(w / 2 - t), -(dd / 2 - t), w - 2 * t, dd - 2 * t, max(2.0, w * 0.04 - t * 0.5), n=6)[::-1] * MM
    walls = M.slab([outer, inner], h * MM, min(2.5, t * 0.4) * MM, I, top="pot_lip", bottom="pot_under", edge="pot_out", hole_edge="pot_in", mat="pot")
    walls.v[:, 2] += h * MM / 2
    walls.a["rest"] = walls.v.copy()
    bottom = M.box(((w - 2 * t + 0.4) * MM, (dd - 2 * t + 0.4) * MM, 4 * MM), at=(0, 0, 1.5 * MM), island="pot_under", islands=I, mat="pot")
    soil = M.rbox(((w - 2 * t + 0.6) * MM, (dd - 2 * t + 0.6) * MM, 18 * MM), 2 * MM, I, top="soil", bottom="soil_under", edge="soil_under",
                  at=(0, 0, (soil_z - 18) * MM), fill=0.012, mat="soil")
    _lump_soil(soil, soil_z * MM, min(w, dd) / 2 * MM - t * MM, seed)
    m = M.join([walls, bottom, soil], ["pot", "soil"])
    return m, {"R": max(w, dd) / 2 * MM, "h": h * MM, "soil_z": soil_z * MM, "r_soil": (min(w, dd) / 2 - t) * MM, "w": w * MM, "dd": dd * MM, "t": t}


def _lump_soil(m, soil_z, r_soil, seed):
    """The soil's surface lumpy: its vertices at the soil's height (or within 5 mm) raised and lowered by noise, more
    toward the middle, nothing at the wall."""
    v = m.v
    top = (np.abs(v[:, 2] - soil_z) < 0.0052) & (np.hypot(v[:, 0], v[:, 1]) < r_soil + 1e-4)
    if "soil" in m.mats:
        si = m.mats.index("soil")
        soil_vs = np.unique(m.f[m.fm == si][m.f[m.fm == si] >= 0])
        mask = np.zeros(len(v), bool)
        mask[soil_vs] = True
        top &= mask
    if not top.any():
        return
    p = v[top]
    rr = np.hypot(p[:, 0], p[:, 1]) / max(r_soil, 1e-6)
    edge = np.clip(1 - rr, 0, 1) ** 0.5
    n = N.fbm3(p / 0.03, seed + 5, 3) * 0.004 + N.fbm3(p / 0.008, seed + 6, 2) * 0.0012
    v[top, 2] += n * edge
    m.a["rest"] = v.copy()


# ---- cards: leaves standing where the form puts them -----------------------------------------------------------------------

class Cards:
    """Leaf cards collected as corners (n, 4, 3), their cells and their lighting normals."""

    def __init__(self, isls, rng):
        self.c, self.uv, self.n, self.isls, self.r = [], [], [], isls, rng

    def add(self, foot, up, side, w, h, normal, cell=None, flip=None):
        up, side = T._unit(up), T._unit(side)
        c = np.stack([foot - side * w / 2, foot + side * w / 2, foot + side * w / 2 + up * h, foot - side * w / 2 + up * h])
        self.c.append(c)
        isl = self.isls[int(self.r.integers(len(self.isls))) if cell is None else cell % len(self.isls)]
        fl = self.r.random() < 0.5 if flip is None else flip
        uu = np.array([1, 0, 0, 1], float) if fl else np.array([0, 1, 1, 0], float)
        self.uv.append(isl.to_uv(uu, np.array([0, 0, 1, 1], float)))
        self.n.append(np.repeat(T._unit(normal)[None], 4, 0))

    def leaf(self, foot, direction, length, width, lean_normal, twist=0.0):
        """A leaf standing from `foot` along `direction` (its axis), its face turned to `lean_normal` as far as the axis
        allows, `twist` degrees about its axis."""
        a = T._unit(direction)
        n = T.project(T._unit(lean_normal), a)
        n = T._unit(n) if np.linalg.norm(n) > 1e-6 else T.orthogonal(a)
        if twist:
            n = T.axis_angle(a, math.radians(twist)) @ n
        s = np.cross(a, n)
        self.add(foot, a, s, width, length, n)

    def mesh(self, mat="leaf"):
        if not self.c:
            return None
        V = np.concatenate(self.c)
        m = M.Mesh(V, np.arange(len(V)).reshape(-1, 4), np.stack(self.uv), mats=[mat])
        m.a["rest"] = V.copy()
        m.a["normal"] = np.concatenate(self.n)
        return m


def _out(angle):
    return np.array([math.cos(angle), math.sin(angle), 0.0])


def radial_leaves(cards, centre, n, size, lean0, lean1, rng, width=0.3, twist=18.0, rings=2, lift=0.0):
    """Leaves radiating from a point: `n` of them in `rings` rings, the inner ones nearer upright (`lean0` degrees off
    the vertical), the outer leaning out to `lean1`, each `size` long (the outer longer), `width` of its length wide;
    the faces turned up and out."""
    per = max(1, n // rings)
    k = 0
    for ring in range(rings):
        t = ring / max(rings - 1, 1) if rings > 1 else 1.0
        lean = math.radians(lean0 + (lean1 - lean0) * t)
        cnt = per if ring < rings - 1 else n - per * (rings - 1)
        for i in range(cnt):
            a = 2 * math.pi * (i + 0.5 * ring) / max(cnt, 1) + float(rng.uniform(-0.25, 0.25))
            o = _out(a)
            d = T._unit(UP * math.cos(lean) + o * math.sin(lean) + np.array([0, 0, float(rng.uniform(-0.06, 0.06))]))
            L = size * (0.75 + 0.35 * t) * float(rng.uniform(0.88, 1.12))
            foot = centre + o * (0.012 + 0.02 * t) * L / max(size, 1e-6) - UP * 0.006
            cards.leaf(foot, d, L, L * width, o * 0.8 + UP * 0.6, twist=float(rng.uniform(-twist, twist)))
            k += 1


def paint_single(f, leaf, cols, rng, seed, gloss):
    """One leaf drawn over the whole card, its base at the card's foot, its tip near the top: the form's own shape."""
    W, H = f.W, f.H
    c0 = cols[int(rng.integers(len(cols)))] * float(rng.uniform(0.9, 1.08))
    c1 = cols[(int(rng.integers(len(cols))) + 1) % len(cols)] * float(rng.uniform(0.9, 1.08))
    f.fill(color=TR._hex(c0), opacity=0.0, rough=gloss, height=0.0)
    L = H * 0.96
    base = (W / 2, H * 0.02)
    if leaf == "aloe":
        # a thick, tapering lanceolate leaf, grey-green, paler flecks, pale teeth along its edges
        pts = _lance(L, W * 0.6, 0.3)
        f.poly(_at(pts, base), color=TR._hex(c0), opacity=1.0, rough=gloss, height=0.6)
        X, Y = f.grid()
        fl = N.fbm3(np.stack([X / 4.0, Y / 9.0, np.full_like(X, seed * 0.3)], -1), seed + 3, 2)
        cov = f.cov_of([_at(pts, base)])
        f.lay_island(cov * np.clip(fl, 0, 1) * 0.5, color=TR._hex(np.clip(c0 * 1.35, 0, 1)))
        for sgn in (-1, 1):
            for t in np.linspace(0.08, 0.92, 14):
                x, y = _edge_point(pts, t, sgn)
                f.ellipse(base[0] + x, base[1] + y, 1.4, 0.9, color="#e8e6d8", opacity=1.0, rough=0.6, height=0.4)
        f.line([(base[0], base[1] + L * 0.1), (base[0], base[1] + L * 0.85)], 1.6, color=TR._hex(c0 * 0.85), opacity=1.0, height=-0.3)
    elif leaf == "echeveria":
        pts = _lance(L, W * 0.62, 0.55, round_tip=True)
        f.poly(_at(pts, base), color=TR._hex(c0), opacity=1.0, rough=gloss, height=0.8)
        f.ellipse(base[0], base[1] + L * 0.96, W * 0.06, W * 0.04, color="#c86a7a", opacity=1.0, rough=gloss)
    elif leaf == "blade":
        # a snake plant's sword: dark green banded across with lighter grey-green, a yellow edge, a twist drawn as a lean
        pts = _lance(L, W * 0.34, 0.06, round_tip=False)
        f.poly(_at(pts, base), color=TR._hex(c0 * 0.9), opacity=1.0, rough=gloss, height=0.5)
        X, Y = f.grid()
        band = N.fbm3(np.stack([X / 20.0, Y / 6.0, np.full_like(X, seed * 0.7)], -1), seed + 7, 3) * 0.5 + 0.5
        cov = f.cov_of([_at(pts, base)])
        f.lay_island(cov * N.smoothstep(0.45, 0.7, band), color=TR._hex(np.clip(c0 * 1.6, 0, 1)), alpha=0.9)
        f.line(_at(_outline_side(pts, 1), base), 1.2, color="#d6c860", opacity=1.0, rough=gloss)
        f.line(_at(_outline_side(pts, -1), base), 1.2, color="#d6c860", opacity=1.0, rough=gloss)
    elif leaf in ("fern", "frond"):
        # a pinnate frond: a midrib bending to one side, pinnae each side, shorter toward the tip (a fern's fine,
        # a palm's long and few)
        pinnae = 22 if leaf == "fern" else 14
        bend = float(rng.uniform(-0.18, 0.18)) * W
        mid = [(base[0] + bend * (t * t), base[1] + L * t) for t in np.linspace(0, 1, 12)]
        f.line(mid, 2.2 if leaf == "fern" else 3.0, color=TR._hex(c0 * 0.6), opacity=1.0, rough=0.7, height=0.3)
        for i in range(pinnae):
            t = 0.1 + 0.88 * i / (pinnae - 1)
            p = TR._along(mid, t)
            nxt = TR._along(mid, min(t + 0.03, 1.0))
            d = math.degrees(math.atan2(nxt[0] - p[0], nxt[1] - p[1]))
            fall = 1 - 0.8 * max(0, t - 0.55) / 0.45
            pl = (W * 0.42 if leaf == "fern" else W * 0.46) * fall * float(rng.uniform(0.85, 1.1))
            pw = (W * 0.07 if leaf == "fern" else W * 0.05)
            for sgn in (-1, 1):
                ang = d + sgn * (62 if leaf == "fern" else 48) + float(rng.uniform(-6, 6))
                pin = _lance(pl, pw, 0.12 if leaf == "fern" else 0.05, round_tip=leaf == "fern")
                col = c0 * (1 - 0.3 * t) + c1 * 0.3 * t
                f.poly(TR._turn(pin, -ang, p), color=TR._hex(col * float(rng.uniform(0.9, 1.08))), opacity=1.0, rough=gloss, height=0.15)
    elif leaf in ("monstera", "rubber", "fiddle"):
        if leaf == "monstera":
            outer, holes = _monstera(L, W * 0.9, rng)
            f.fill_polys([_at(outer, base)] + [_at(h_, base) for h_ in holes], evenodd=True, color=TR._hex(c0), opacity=1.0, rough=gloss, height=0.5)
        elif leaf == "rubber":
            pts = _lance(L, W * 0.72, 0.5, round_tip=True)
            f.poly(_at(pts, base), color=TR._hex(c0 * 0.8), opacity=1.0, rough=gloss, height=0.6)
        else:
            pts = _fiddle(L, W * 0.85)
            f.poly(_at(pts, base), color=TR._hex(c0), opacity=1.0, rough=gloss, height=0.6)
        # the midrib and the side veins, lighter (a rubber plant's midrib reddish)
        rib = "#b85a4a" if leaf == "rubber" else TR._hex(np.clip(c0 * 1.5, 0, 1))
        f.line([(base[0], base[1]), (base[0], base[1] + L * 0.94)], 2.4, color=rib, opacity=1.0, rough=gloss, height=-0.25)
        for i in range(1, 9):
            t = i / 9.5
            y = base[1] + L * t
            reach = W * 0.4 * math.sin(math.pi * min(t * 1.1, 1.0)) ** 0.6
            for sgn in (-1, 1):
                f.line([(base[0], y), (base[0] + sgn * reach, y + L * 0.09)], 1.1, color=rib, opacity=1.0, alpha=0.7, height=-0.12)
    elif leaf in ("heart", "ivy"):
        pts = _heart(L, W * 0.85) if leaf == "heart" else _ivy(L, W * 0.9)
        f.poly(_at(pts, base), color=TR._hex(c0), opacity=1.0, rough=gloss, height=0.4)
        if leaf == "heart" and rng.random() < 0.7:
            # a pothos's cream splash
            X, Y = f.grid()
            sp = N.fbm3(np.stack([X / 12.0, Y / 12.0, np.full_like(X, seed * 0.9)], -1), seed + 11, 3)
            cov = f.cov_of([_at(pts, base)])
            f.lay_island(cov * N.smoothstep(0.25, 0.5, sp), color="#e8e6a8", alpha=0.85)
        rib = TR._hex(np.clip(c0 * 1.4, 0, 1))
        f.line([(base[0], base[1] + L * 0.1), (base[0], base[1] + L * 0.9)], 1.4, color=rib, opacity=1.0, height=-0.15)
        for i in range(1, 5):
            t = 0.2 + 0.6 * i / 5
            for sgn in (-1, 1):
                f.line([(base[0], base[1] + L * t), (base[0] + sgn * W * 0.32 * (1 - t * 0.5), base[1] + L * (t + 0.15))], 0.9, color=rib, opacity=1.0, alpha=0.7)
    else:  # strap (yucca, bamboo): a long narrow leaf folded along its middle, a pale edge
        pts = _lance(L, W * 0.26, 0.1, round_tip=False)
        f.poly(_at(pts, base), color=TR._hex(c0), opacity=1.0, rough=gloss, height=0.5)
        f.line([(base[0], base[1]), (base[0], base[1] + L * 0.95)], 1.6, color=TR._hex(c0 * 0.72), opacity=1.0, height=-0.4)
    # a soft shade over the whole card
    X, Y = f.grid()
    sh = N.fbm3(np.stack([X / 40.0, Y / 40.0, np.full_like(X, seed * 0.37)], -1), seed + 41, 2)
    f.lay_island(np.ones_like(X), color=np.clip(c0[None, None] * (1 + 0.4 * sh[..., None]), 0, 1).astype(np.float32), alpha=0.18)


def _at(pts, at):
    return np.asarray(pts, float) + np.asarray(at, float)


def _lance(L, Wd, base_w, round_tip=False):
    """A lanceolate outline (mm), the stalk's end at (0, 0), the tip up: `base_w` its width at the foot as a share."""
    n = 26
    right = []
    for i in range(n + 1):
        t = i / n
        if round_tip:
            w = (math.sin(math.pi * min(t, 1.0) * 0.86 + 0.14 * math.pi * t) ** 0.8) * (1 - 0.15 * t) + base_w * (1 - t)
        else:
            w = math.sin(math.pi * t) ** 0.9 * (1 - 0.25 * t) + base_w * (1 - t) ** 1.5
        right.append((w * Wd / 2, t * L))
    left = [(-x, y) for x, y in reversed(right)]
    return np.array(right + left)


def _outline_side(pts, sgn):
    half = len(pts) // 2
    side = pts[:half] if sgn > 0 else pts[half:][::-1]
    return side[2:-2]


def _edge_point(pts, t, sgn):
    half = len(pts) // 2
    side = pts[:half] if sgn > 0 else pts[half:][::-1]
    i = int(t * (len(side) - 1))
    return side[i]


def _heart(L, Wd):
    pts = []
    n = 40
    for i in range(n + 1):
        t = i / n
        a = math.pi * t
        # a heart: two lobes at the foot, a point at the tip
        x = math.sin(a) * (0.55 + 0.45 * math.sin(a) ** 0.5) * Wd / 2 * (1 - 0.1 * t)
        y = L * (0.14 + 0.86 * t) - L * 0.12 * math.sin(a) ** 2 * (1 - t)
        pts.append((x, y))
    left = [(-x, y) for x, y in reversed(pts)]
    return np.array([(0.0, 0.0), (0.8, 0.0)] + pts + left + [(-0.8, 0.0)])


def _ivy(L, Wd):
    """An ivy leaf: three to five lobes, the middle one longest, a heart's notch at the foot."""
    pts = [(0.0, 0.0), (0.8, 0.0), (0.8, L * 0.16)]
    n = 60
    k = 5
    for i in range(n + 1):
        a = math.radians(-125 + 250 * i / n)
        u = (a + math.radians(125)) / math.radians(250) * k
        frac = u - math.floor(u)
        lobe = (1 - abs(frac - 0.5) * 2) ** 0.6
        rr = L * 0.5 * (0.45 + 0.55 * lobe) * (1.0 - 0.3 * abs(a) / math.radians(125))
        pts.append((math.sin(a) * rr * Wd / L, L * 0.16 + math.cos(a) * rr * 1.15))
    pts += [(-0.8, L * 0.16), (-0.8, 0.0)]
    return np.array(pts)


def _fiddle(L, Wd):
    right = []
    n = 30
    for i in range(n + 1):
        t = i / n
        w = (0.35 + 0.65 * (0.5 - 0.5 * math.cos(math.pi * t * 1.35))) * (1 - 0.1 * max(0, t - 0.8) / 0.2) if t < 0.92 else (0.9 * (1 - t) / 0.08)
        w = max(w, 0.02) * (0.7 if t < 0.4 else 1.0)
        right.append((w * Wd / 2, t * L))
    left = [(-x, y) for x, y in reversed(right)]
    return np.array([(0.0, 0.0)] + right + left)


def _monstera(L, Wd, rng):
    """A monstera's leaf: a heart with deep splits between its ribs and holes along the midrib."""
    outer = []
    n = 130
    for i in range(n + 1):
        t = i / n
        a = math.pi * t
        w = math.sin(a) ** 0.55 * (1 - 0.12 * t) * Wd / 2
        y = L * (0.12 + 0.88 * t) - L * 0.1 * math.sin(a) ** 2 * (1 - t)
        # the splits: narrow cuts toward the midrib between five wide rounded lobes a side
        rib = math.sin(math.pi * 5 * (t - 0.08) / 0.84)
        notch = max(0.0, 1 - abs(rib) * 2.2) ** 1.2 * 0.7 if 0.1 < t < 0.9 else 0.0
        outer.append((w * (1 - notch), y))
    left = [(-x, y) for x, y in reversed(outer)]
    pts = np.array([(0.0, 0.0), (1.0, 0.0)] + outer + left + [(-1.0, 0.0)])
    holes = []
    for i in range(int(rng.integers(3, 6))):
        t = float(rng.uniform(0.3, 0.75))
        sgn = 1 if i % 2 else -1
        cx, cy = sgn * Wd * float(rng.uniform(0.07, 0.16)), L * t
        rx, ry = Wd * float(rng.uniform(0.03, 0.06)), L * float(rng.uniform(0.02, 0.045))
        hole = [(cx + rx * math.cos(a), cy + ry * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
        holes.append(np.array(hole))
    return pts, holes


# ---- the family --------------------------------------------------------------------------------------------------------------

def make(spec, th):
    seed = int(spec.get("seed", 0))
    rng = N.rng(seed, "plant")
    form = spec.get("form", "rosette")
    if form not in FORMS:
        raise ValueError(f"plant form {form!r}: one of {', '.join(FORMS)}")
    P = dict(FORMS[form])
    P.update(spec.get("plant") or {})
    pot = {"kind": "terracotta"}
    pot.update(spec.get("pot") or {})
    pk = pot.get("kind", "terracotta")
    if pk not in POTS:
        raise ValueError(f"pot kind {pk!r}: one of {', '.join(POTS)}")
    pd = POTS[pk]
    pot_col = pot.get("color", pd["color"])
    if form == "tree" and "color" not in (spec.get("plant") or {}):
        P["color"] = list(SPECIES[P.get("species", "ficus")]["leaf"]["colors"]["summer"])
    cols = [rgb(c) for c in (P["color"] if isinstance(P["color"], list) else [P["color"]])]
    gloss = float(P.get("gloss", 0.45))
    # materials and islands
    px_pot = 512 if float(pot.get("d", pot.get("w", 140))) < 220 else 1024
    th.material("pot", pd["kind"], color=pot_col, rough=pd["rough"], px=px_pot)
    th.material("soil", "stone", color="#3a2d22", rough=0.98, px=256)
    R_mm = float(pot.get("d", pot.get("w", 140))) / 2
    h_mm = float(pot.get("h", R_mm * 1.8))
    th.island("pot_out", 2 * math.pi * R_mm, h_mm * 1.3, mat="pot", wrap=True)
    th.island("pot_in", 2 * math.pi * R_mm, h_mm * 0.5, mat="pot", wrap=True)
    th.island("pot_lip", 2 * math.pi * R_mm, 14, mat="pot", wrap=True)
    th.island("pot_under", 2 * R_mm, 2 * R_mm, mat="pot")
    th.island("soil", 2 * R_mm, 2 * R_mm, mat="soil")
    th.island("soil_under", 2 * R_mm, 60, mat="soil")
    leafy = form != "cactus"
    size = float(P.get("size", 0.2))
    card_mm = None
    if leafy:
        th.material("leaf", "paint", alpha="clip", double=True, color=TR._hex(cols[0]), rough=gloss, px=int(spec.get("tex", 1024)) if size > 0.25 else 512)
    stemmy = form in ("palm", "big_leaf", "canes", "yucca", "trailing", "tree", "cactus")
    if stemmy:
        th.material("stem", "weathered" if form in ("tree", "palm", "yucca") else "paint", color=P.get("stem_color", "#6a5a48"), rough=0.8, px=512)
        th.island("stem", 120, 120, mat="stem", wrap=True)
    # the plant: which cards and what each card shows
    tree_sp = None
    if form == "tree":
        tree_sp = SPECIES[P.get("species", "ficus")]
        leaf = dict(tree_sp["leaf"])
        leaf.update(P.get("leaves") or {})
        card_mm = leaf["card"] * 1000.0 * (size / tree_sp["height"]) ** 0.5
        leaf_isls = [th.island(f"leaf{i}", card_mm, card_mm, mat="leaf") for i in range(4)]
    elif leafy:
        lk = P.get("leaf", FORMS[form]["leaf"])
        aspect = {"aloe": 0.42, "echeveria": 0.62, "blade": 0.34, "fern": 0.84, "frond": 0.92, "monstera": 0.9, "rubber": 0.72, "fiddle": 0.85,
                  "heart": 0.85, "ivy": 0.9, "strap": 0.26}[lk]
        L_mm = size * 1000.0
        W_mm = L_mm * aspect
        card_mm = (W_mm, L_mm)
        leaf_isls = [th.island(f"leaf{i}", W_mm, L_mm, mat="leaf") for i in range(4)]
    th.pack()
    I = th.islands
    if stemmy and form != "cactus":
        I["stem"].rect = (0.0, 0.0, 1.0, 1.0)                  # the stems' bark tile is its whole texture: it goes round and along
        th.density["stem"] = th.mats["stem"]["px"] / 120.0
    # the pot and its soil
    if pk == "cube":
        pot_m, G = cube_pot(pot, th, I, seed)
    else:
        pot_m, G = round_pot(pot, pk, th, I, seed)
    parts = [pot_m]
    soil_z, r_soil = G["soil_z"], G["r_soil"]
    top = np.array([0.0, 0.0, soil_z + 0.003])
    cards = Cards(leaf_isls, rng) if leafy else None
    stems = []
    tree_stems = None
    if form == "rosette":
        n = int(P.get("count", 20))
        if P.get("leaf") == "echeveria":
            radial_leaves(cards, top, n, size, 8, 64, rng, width=0.72, twist=8, rings=4)
        else:
            radial_leaves(cards, top, n, size, 14, 52, rng, width={"aloe": 0.5}.get(P.get("leaf", "aloe"), 0.42), rings=3)
    elif form == "blades":
        n = int(P.get("count", 11))
        for i in range(n):
            a = 2 * math.pi * i / n + float(rng.uniform(-0.3, 0.3))
            o = _out(a) * float(rng.uniform(0.2, 1.0)) * r_soil * 0.7
            lean = math.radians(float(rng.uniform(3, 16)))
            d = T._unit(UP * math.cos(lean) + T._unit(o) * math.sin(lean))
            L = size * float(rng.uniform(0.6, 1.12))
            cards.leaf(top + o - UP * 0.008, d, L, L * 0.34, _out(a + float(rng.uniform(-0.6, 0.6))), twist=float(rng.uniform(-25, 25)))
    elif form == "fern":
        n = int(P.get("count", 22))
        radial_leaves(cards, top, n, size, 30, 88, rng, width=0.84, twist=10, rings=3)
    elif form in ("palm", "canes", "yucca"):
        n_canes = int(P.get("canes", {"palm": 4, "canes": 5, "yucca": 2}[form]))
        for i in range(n_canes):
            a = 2 * math.pi * i / n_canes + float(rng.uniform(-0.4, 0.4))
            r0 = r_soil * (0.15 if n_canes == 1 else float(rng.uniform(0.25, 0.6)))
            foot = top + _out(a) * r0
            lean = _out(a) * float(rng.uniform(0.04, 0.16)) if form != "canes" else _out(a) * float(rng.uniform(0.0, 0.05))
            H = (size if form != "palm" else size * 0.8) * float(rng.uniform(0.75, 1.1))
            if form == "palm":
                H = size * 0.9 * float(rng.uniform(0.55, 1.0))
            k = 6
            path = np.stack([foot + (UP + lean * (j / k) ** 1.5) * H * j / k + _out(a + 1.3) * 0.01 * math.sin(j * 1.7) for j in range(k + 1)])
            rad = {"palm": 0.012, "canes": 0.011, "yucca": 0.03}[form] * (size / FORMS[form]["size"]) ** 0.5
            radii = np.full(k + 1, rad) * (1.0 if form != "yucca" else np.linspace(1.2, 0.85, k + 1))
            parts.append(TR.tube(path, radii, 8 if form == "yucca" else 6, I["stem"], "stem", cap=True, v0=float(rng.uniform(0, 1)), base=True))
            if form == "canes":
                for j in range(1, k):                            # the canes' nodes as rings
                    ring = TR.tube(np.stack([path[j] - UP * 0.004, path[j], path[j] + UP * 0.004]), np.full(3, rad * 1.15), 8, I["stem"], "stem", cap=False)
                    parts.append(ring)
            crown = path[-1]
            if form == "palm":
                nf = int(P.get("count", 7))
                for q in range(nf):
                    aa = 2 * math.pi * q / nf + float(rng.uniform(-0.3, 0.3))
                    o = _out(aa)
                    lean2 = math.radians(float(rng.uniform(28, 68)))
                    d = T._unit(UP * math.cos(lean2) + o * math.sin(lean2))
                    L = size * float(rng.uniform(0.6, 0.85))
                    cards.leaf(crown - UP * 0.01, d, L, L * 0.92, o * 0.6 + UP * 0.8, twist=float(rng.uniform(-12, 12)))
            elif form == "yucca":
                radial_leaves(cards, crown, 52, size * 0.4, 8, 72, rng, width=0.22, twist=15, rings=4)
            else:
                for q in range(int(rng.integers(3, 6))):
                    aa = 2 * math.pi * q / 4 + float(rng.uniform(-0.5, 0.5))
                    o = _out(aa)
                    lean2 = math.radians(float(rng.uniform(25, 70)))
                    d = T._unit(UP * math.cos(lean2) + o * math.sin(lean2))
                    L = size * 0.28 * float(rng.uniform(0.8, 1.15))
                    at = path[-1] - UP * 0.02 * q
                    cards.leaf(at, d, L, L * 0.26, o * 0.7 + UP * 0.5, twist=float(rng.uniform(-20, 20)))
    elif form == "big_leaf":
        lk = P.get("leaf", "monstera")
        n = int(P.get("count", 8))
        H = size * float(P.get("stem", 1.6 if lk == "monstera" else 2.6))
        k = 10
        lean = _out(float(rng.uniform(0, 2 * math.pi))) * 0.06
        path = np.stack([top + (UP + lean * (j / k)) * H * j / k for j in range(k + 1)])
        r_stem = 0.012 * (size / 0.4) ** 0.7
        parts.append(TR.tube(path, np.linspace(r_stem * 1.1, r_stem * 0.7, k + 1), 8, I["stem"], "stem", cap=True, v0=0.1, base=True))
        for i in range(n):
            t = 0.25 + 0.72 * i / max(n - 1, 1)
            a = i * 2.4 + float(rng.uniform(-0.4, 0.4))
            o = _out(a)
            at = path[0] + (path[-1] - path[0]) * t
            pl = size * (0.45 if lk == "monstera" else 0.22) * float(rng.uniform(0.8, 1.2))
            lean2 = math.radians(float(rng.uniform(55, 95)) - 25 * (1 - t))
            pd_ = T._unit(UP * math.cos(lean2) + o * math.sin(lean2))
            pet = np.stack([at, at + pd_ * pl * 0.5 + UP * pl * 0.08, at + pd_ * pl])
            parts.append(TR.tube(pet, np.full(3, r_stem * 0.45), 5, I["stem"], "stem", cap=False))
            L = size * float(rng.uniform(0.85, 1.12)) * (0.7 + 0.3 * t)
            droop = math.radians(float(rng.uniform(48, 82)) - 18 * (1 - t))
            d = T._unit(UP * math.cos(droop) + o * math.sin(droop))
            cards.leaf(pet[-1] - d * L * 0.04, d, L, L * {"monstera": 0.9, "rubber": 0.72, "fiddle": 0.85}.get(lk, 0.8), o * 0.4 + UP * 0.9, twist=float(rng.uniform(-10, 10)))
    elif form == "trailing":
        n = int(P.get("count", 6))
        length = float(P.get("length", 0.7))
        lk = P.get("leaf", "heart")
        rim_r = G["R"] if pk != "cube" else min(G["w"], G["dd"]) / 2
        for i in range(n):
            a = 2 * math.pi * i / n + float(rng.uniform(-0.35, 0.35))
            o = _out(a)
            Lv = length * float(rng.uniform(0.55, 1.15))
            pts = [top + o * r_soil * 0.5, top + o * rim_r * 0.9 + UP * 0.03, top + o * (rim_r + 0.02) + UP * 0.01]
            z0 = pts[-1][2]
            # down the pot's outside (a little off it, swaying), then curling round its foot on the floor
            kk = max(4, int(Lv / 0.05))
            turn = float(rng.uniform(-1.0, 1.0))
            for j in range(1, kk + 1):
                s = Lv * j / kk
                z = max(0.012, z0 - s)
                over = max(0.0, s - (z0 - 0.012))
                ang = a + turn * over / max(rim_r + 0.05, 1e-6) * 0.9
                rr = rim_r + 0.035 + min(over * 0.35, 0.12)
                pts.append(np.array([math.cos(ang) * rr + 0.012 * math.sin(j * 1.3 + i), math.sin(ang) * rr + 0.012 * math.cos(j * 1.1 + i), z]))
            path = np.array(pts)
            parts.append(TR.tube(path, np.full(len(path), 0.0028), 5, I["stem"], "stem", cap=True, v0=float(rng.uniform(0, 1))))
            # leaves alternating along the vine, their faces up and out
            seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
            total = seg.sum()
            m_leaves = max(3, int(total / (size * 0.7)))
            for q in range(m_leaves):
                t = (q + 0.6) / (m_leaves + 0.2)
                at = np.asarray(TR._along(path, t))
                nxt = np.asarray(TR._along(path, min(t + 0.03, 1.0)))
                dirv = T._unit(nxt - at) if np.linalg.norm(nxt - at) > 1e-6 else o
                sgn = 1 if q % 2 else -1
                side = T._unit(np.cross(dirv, UP)) if abs(dirv[2]) < 0.95 else T._unit(np.cross(dirv, o))
                d = T._unit(dirv * 0.4 + side * sgn * 0.8 + UP * 0.2)
                L = size * float(rng.uniform(0.8, 1.2))
                cards.leaf(at, d, L, L * (0.85 if lk == "heart" else 0.9), UP * 0.7 + o * 0.4, twist=float(rng.uniform(-15, 15)))
    elif form == "tree":
        tspec = {"height": size, "clear": float(P.get("clear", tree_sp["clear"] * size / tree_sp["height"])), "seed": seed,
                 "lean": float(P.get("lean", tree_sp.get("lean", 0.0))), "spread": float(P.get("spread", 1.0)), "droop": float(P.get("droop", 1.0)),
                 "density": float(P.get("density", 1.0)), "crown": float(P.get("crown", 1.0))}
        if "multi" in tree_sp:
            tspec["multi"] = tree_sp["multi"]
        tree_stems, ids = TR.grow(tspec, tree_sp, seed)
        for st in tree_stems:
            st.position = st.position + top
        # the stems' positions moved up onto the soil: the nodes' own positions are relative to their stem's
        woods = TR.mesh_wood(tree_stems, ids, set(ids), I["stem"], "stem", seed, 1.0)
        parts += woods
        leaf = dict(tree_sp["leaf"])
        leaf.update(P.get("leaves") or {})
        leaf["count"] = int(leaf.get("count", 600) * (size / tree_sp["height"]) ** 1.2)
        leaf["size"] = card_mm / 1000.0
        lc, _ = TR.leaf_cards(tree_stems, ids, leaf, tspec, seed, leaf_isls, "leaf")
        if lc is not None:
            parts.append(lc)
    elif form == "cactus":
        ribs = int(P.get("ribs", 12))
        H = size
        rc = float(P.get("radius", H * 0.28))
        prof = [(0.0, soil_z + 0.002), (rc * 0.7, soil_z + 0.004), (rc * 0.96, soil_z + H * 0.1), (rc, soil_z + H * 0.5), (rc * 0.9, soil_z + H * 0.84),
                (rc * 0.55, soil_z + H * 0.97), (0.0, soil_z + H)]
        th.island("cactus", 2 * math.pi * rc * 1000, M.arclen(np.array(prof) * 1000), mat="stem", wrap=True)
        th.pack()
        I = th.islands
        cm = M.lathe([M.Seg(np.array(prof[::-1]), "cactus", "band", mat="stem")], 36, I, step=max(0.006, H / 28), mats=["stem"])
        M.flip(cm)
        sh = cm.a["shell"]
        ang, zz, rr = sh[:, 0], sh[:, 1], sh[:, 2]
        k = 1 + 0.11 * np.cos(ribs * ang) * np.clip(rr / max(rc, 1e-6), 0, 1)
        cm.v[:, 0] = rr * k * np.cos(ang)
        cm.v[:, 1] = rr * k * np.sin(ang)
        cm.a["rest"] = cm.v.copy()
        parts.append(cm)
    # normals: the pot's and stems' smooth, the cards' their own
    for p in parts:
        if "normal" not in p.a:
            p.a["normal"] = BK.vertex_normals(p)
    if cards is not None:
        cm_ = cards.mesh("leaf")
        if cm_ is not None:
            parts.append(cm_)
    mats = ["pot", "soil"] + (["stem"] if stemmy else []) + (["leaf"] if leafy else [])
    th.low = M.join(parts, mats)
    th.high = None
    nrm = th.low.a.get("normal")
    if nrm is not None:
        bad = np.linalg.norm(nrm, axis=1) < 0.5
        if bad.any():
            nrm[bad] = BK.vertex_normals(th.low)[bad]
    th.pose = "stand"
    th.anchor = np.zeros(3)
    th.bake_ao = False
    for m_ in ("leaf", "stem"):
        if m_ in th.mats:
            th.mats[m_]["wear"] = {k: 0.0 for k in ("grime", "dirt", "dust", "scratches", "edges", "stains", "fade")}
    th.sockets["soil"] = (tuple(top), (0, 0, 1))
    th.view = {"azim": -28, "elev": 14, "lens": 55, "fill": 0.9}
    th.tree = {"kind": "plant:" + form, "pot": pk, "height_m": round(float(th.low.v[:, 2].max()), 3), "cards": 0 if cards is None else len(cards.c)}
    lk = P.get("leaf", FORMS[form].get("leaf", "")) if form != "tree" else None

    def paint(fr):
        paint_pot(fr, pot, pk, pd, pot_col, seed, G)
        paint_soil(fr["soil"], pot.get("topping", "none"), seed)
        if "soil_under" in fr:
            fr["soil_under"].fill(color="#2a2018", rough=1.0)
        if stemmy:
            if form == "cactus":
                paint_cactus(fr["cactus"], cols, ribs, seed, gloss)
                fr["stem"].fill(color="#4f7a3e", rough=0.6)
            elif form == "tree":
                TR.paint_bark(fr["stem"], tree_sp["bark"], seed, 120.0)
            else:
                paint_stem(fr["stem"], form, P.get("stem_color"), seed)
        if leafy:
            for i, isl in enumerate(leaf_isls):
                if form == "tree":
                    leaf2 = dict(tree_sp["leaf"])
                    leaf2.update(P.get("leaves") or {})
                    TR.paint_cluster(fr[isl.name], leaf2, [TR._hex(c) for c in cols], "summer", seed * 4 + i, P.get("species", "ficus"))
                else:
                    paint_single(fr[isl.name], lk, cols, N.rng(seed, "leaf", i), seed * 4 + i, gloss)

    th.paint = paint
    return th


# ---- paint: the pot, the soil, the stems ------------------------------------------------------------------------------------

def paint_pot(fr, pot, pk, pd, color, seed, G):
    """Terracotta (orange clay, a lime bloom near the rim, fine grain, a crack if asked), a glaze (designs.glaze), plastic
    (flat, a mould line), concrete (grey, pores)."""
    rng = N.rng(seed, "pot")
    if pk == "glazed" or (pk in ("cylinder", "bowl", "cube") and pot.get("glaze", True) is not False):
        art = {"design": "glaze", "glaze": color}
        if isinstance(pot.get("glaze"), dict):
            art.update(pot["glaze"])
        for nm in ("pot_out", "pot_in", "pot_lip"):
            designs.draw(fr[nm], dict(art, part="outside" if nm == "pot_out" else "inside"), seed, "glaze")
        f = fr["pot_under"]
        clay = pot.get("clay", "#a08a72")
        f.fill(color=clay, rough=0.85)
        f.ring(f.W / 2, f.H / 2, f.W * 0.22, 1.2, color="#5a4a3a", rough=0.8, alpha=0.5)
        return
    base = rgb(color)
    for nm in ("pot_out", "pot_in", "pot_lip", "pot_under"):
        f = fr[nm]
        X, Y = f.grid()
        g = N.fbm3(np.stack([X / 3.0, Y / 3.0, np.full_like(X, seed * 0.1 + sum(map(ord, nm)))], -1), seed + 3, 3)
        col = base[None, None] * (1 + 0.1 * g[..., None])
        if pk == "terracotta":
            # the lime bloom: whitish patches, strongest under the rim and at the foot; darker damp low down
            bloom = N.fbm3(np.stack([X / 30.0, Y / 18.0, np.full_like(X, 2.0)], -1), seed + 5, 3) * 0.5 + 0.5
            where = N.smoothstep(0.45, 0.7, bloom) * (0.4 + 0.6 * np.clip(Y / max(f.H, 1e-6), 0, 1) ** 2 if nm == "pot_out" else 0.5)
            col = col * (1 - 0.55 * where[..., None]) + np.array([0.86, 0.84, 0.78])[None, None] * 0.55 * where[..., None]
            damp = np.clip(1 - Y / max(f.H, 1e-6) * 2.5, 0, 1) * 0.3 if nm == "pot_out" else 0.0
            col = col * (1 - damp[..., None] if nm == "pot_out" else 1.0)
            f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.9, height=(0.06 * g).astype(np.float32))
            if pot.get("cracked") and nm == "pot_out":
                x0 = float(rng.uniform(0.2, 0.8)) * f.W
                pts = [(x0, 0.0)]
                for j in range(8):
                    pts.append((pts[-1][0] + float(rng.uniform(-6, 6)), pts[-1][1] + f.H * 0.09 * float(rng.uniform(0.6, 1.2))))
                f.line(pts, 0.9, color="#3a2418", opacity=1.0, rough=1.0, height=-0.6)
        elif pk == "concrete":
            pores = N.fbm3(np.stack([X / 1.2, Y / 1.2, np.full_like(X, 4.0)], -1), seed + 9, 2)
            f.lay_island(np.ones_like(X), color=np.clip(col * (1 - 0.15 * np.clip(-pores, 0, 1)[..., None]), 0, 1).astype(np.float32), rough=0.92,
                         height=(-0.35 * np.clip(-pores - 0.3, 0, 1) + 0.05 * g).astype(np.float32))
        else:  # plastic
            f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.45 + 0.05 * g.astype(np.float32))
            if nm == "pot_out":
                for xm in (0.0, f.W / 2):
                    f.line([(xm, 0), (xm, f.H)], 0.5, color=TR._hex(base * 0.85), alpha=0.6, height=0.04)


def paint_soil(f, topping, seed):
    X, Y = f.grid()
    lumps = N.fbm3(np.stack([X / 9.0, Y / 9.0, np.full_like(X, 2.0)], -1), seed + 63, 3)
    fine = N.fbm3(np.stack([X / 1.6, Y / 1.6, np.full_like(X, 5.0)], -1), seed + 65, 2)
    col = rgb("#3a2d22")[None, None] * (1 + 0.3 * lumps[..., None] + 0.15 * fine[..., None])
    f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.98, height=(0.9 * lumps + 0.25 * fine).astype(np.float32))
    rng = N.rng(seed, "topping")
    cx, cy, rr = f.W / 2, f.H / 2, min(f.W, f.H) / 2 * 0.98
    if topping == "pebbles":
        for _ in range(int(rr * rr * 0.12)):
            a, d = rng.uniform(0, 2 * math.pi), rr * math.sqrt(rng.uniform(0, 1))
            r_ = rng.uniform(1.8, 4.5)
            f.ellipse(cx + d * math.cos(a), cy + d * math.sin(a), r_, r_ * rng.uniform(0.6, 0.95), rot=rng.uniform(0, 180),
                      color=TR._hex(np.array([0.55, 0.53, 0.5]) * rng.uniform(0.75, 1.15)), rough=0.7, height=1.2)
    elif topping == "pumice":
        for _ in range(int(rr * rr * 0.5)):
            a, d = rng.uniform(0, 2 * math.pi), rr * math.sqrt(rng.uniform(0, 1))
            r_ = rng.uniform(0.7, 1.8)
            f.ellipse(cx + d * math.cos(a), cy + d * math.sin(a), r_, r_ * rng.uniform(0.7, 1.0), color=TR._hex(np.array([0.78, 0.76, 0.72]) * rng.uniform(0.8, 1.1)), rough=0.95, height=0.5)
    elif topping == "moss":
        m = N.fbm3(np.stack([X / 6.0, Y / 6.0, np.full_like(X, 7.0)], -1), seed + 71, 3) * 0.5 + 0.5
        f.lay_island(N.smoothstep(0.35, 0.6, m), color="#4f7a2e", rough=0.95, height=0.6)
        f.lay_island(N.smoothstep(0.55, 0.8, m), color="#7aa848", rough=0.95, height=0.3)
    elif topping == "bark":
        for _ in range(int(rr * rr * 0.08)):
            a, d = rng.uniform(0, 2 * math.pi), rr * math.sqrt(rng.uniform(0, 1))
            w_, h_ = rng.uniform(4, 9), rng.uniform(2, 4)
            f.rect(cx + d * math.cos(a) - w_ / 2, cy + d * math.sin(a) - h_ / 2, w_, h_, r=0.8, color=TR._hex(np.array([0.42, 0.3, 0.2]) * rng.uniform(0.7, 1.2)), rough=0.9, height=0.8)


def paint_stem(f, form, color, seed):
    """A palm's ringed canes, lucky bamboo's green canes with pale nodes, a yucca's rough brown trunk, a vine's green
    stem, a monstera's."""
    X, Y = f.grid()
    base = rgb(color) if color else rgb({"palm": "#b8a888", "canes": "#6a9a4a", "yucca": "#6a5a48", "trailing": "#5a7a3a", "big_leaf": "#5a6e3a"}.get(form, "#6a5a48"))
    g = N.fbm3(np.stack([X / 2.0, Y / 6.0, np.full_like(X, 3.0)], -1), seed + 51, 3)
    col = base[None, None] * (1 + 0.16 * g[..., None])
    if form == "palm":
        rings = 0.5 + 0.5 * np.sin(Y / 9.0 * 2 * math.pi)
        col = col * (1 - 0.18 * rings[..., None])
    f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.75 if form != "canes" else 0.45, height=(0.12 * g).astype(np.float32))


def paint_cactus(f, cols, ribs, seed, gloss):
    """The cactus's skin: green, lighter along each rib's crest, areoles with pale spines on the crests."""
    X, Y = f.grid()
    c0 = cols[0]
    g = N.fbm3(np.stack([X / 3.0, Y / 3.0, np.full_like(X, 1.0)], -1), seed + 81, 3)
    crest = 0.5 + 0.5 * np.cos(X / f.W * 2 * math.pi * ribs)
    col = c0[None, None] * (1 + 0.1 * g[..., None]) * (1 + 0.25 * crest[..., None] ** 3)
    f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=gloss, height=(0.1 * g).astype(np.float32))
    rng = N.rng(seed, "spines")
    step = max(5.0, f.H / 26)
    for i in range(ribs):
        x = (i + 0.5) / ribs * f.W
        for y in np.arange(step * 0.6, f.H * 0.985, step):
            yy = y + float(rng.uniform(-1.0, 1.0))
            f.ellipse(x, yy, 0.9, 0.7, color="#e8e2cc", opacity=1.0, rough=0.9, height=0.25)
            for _ in range(4):
                a = float(rng.uniform(0, 2 * math.pi))
                ln = float(rng.uniform(1.6, 3.2))
                f.line([(x, yy), (x + math.cos(a) * ln, yy + math.sin(a) * ln)], 0.3, color="#f2ecd8", opacity=1.0, rough=0.8)
