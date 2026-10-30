"""Liquid in a container, for Godot's liquid shader (GodotPlugins/HorrorStudioLook: liquid.gdshader, HSLiquidFill;
docs/PROPGEN.md §10). The container's inside goes out as a closed mesh of its own (<name>_liquid) carrying, in its
glTF extras (`propgen_liquid`), a fill table: for each tilt of the container against the world's up and each fill (a
share of its volume), the height of the level over the container's base. It's found from points spread evenly through
the inside (the level with `fill` of them under it), so a bottle tipped on its side keeps its volume instead of its
height. The shader cuts the mesh at that level (kept flat in the world, tilted by the slosh) and draws the inside's
back faces, seen through the cut, as the surface: Valve's bottles in Half-Life: Alyx work from the same idea (a fill
plane held level in world space, a spring for the slosh; nothing is simulated inside)."""
import json
import math

import numpy as np

from . import noise as N

LIQUIDS = {   # colour of the body, of the surface seen from above, of the line where it meets the wall; clarity 0-1
    "water": ("#9fb9c4", "#c9dde4", "#e8f2f5", 0.75),
    "soy":   ("#1d0703", "#3a1207", "#5a2410", 0.0),
    "sake":  ("#e9e2c4", "#f3eedb", "#ffffff", 0.7),
    "tea":   ("#6b3a12", "#8a5422", "#a8763e", 0.25),
    "coffee": ("#2a160b", "#3b2213", "#8a6a4c", 0.0),
    "whisky": ("#8a4a12", "#a86422", "#c98a44", 0.45),
    "medicine": ("#7a1f2a", "#9a2f3a", "#c45a64", 0.3),
    "blood": ("#4a0306", "#6a0a0e", "#8a1a1e", 0.0),
    "oil":   ("#c9a23a", "#e0bf5a", "#f3dc8a", 0.5),
}


def interior_points(R_of_z, z0, z1, r_max, n=24000, seed=0):
    """Points spread evenly through a turned inside: radius R_of_z(z) between heights z0 and z1 (metres)."""
    r = N.rng(seed, "liquid_pts")
    out = []
    while sum(len(o) for o in out) < n:
        p = np.stack([r.uniform(-r_max, r_max, n), r.uniform(-r_max, r_max, n), r.uniform(z0, z1, n)], 1)
        keep = np.hypot(p[:, 0], p[:, 1]) < R_of_z(p[:, 2])
        out.append(p[keep])
    return np.concatenate(out)[:n]


def fill_table(points, tilts=24, fills=33):
    """Rows by tilt (0 upright to pi upside down), columns by fill (0 to 1): the level's height over the container's
    base along the world's up, the container turned by the tilt about its x axis (any way round is the same by its
    symmetry). Returns the table normalised 0-1, and its range (metres)."""
    t = np.linspace(0, math.pi, tilts)
    f = np.linspace(0, 1, fills)
    tab = np.zeros((tilts, fills))
    for i, a in enumerate(t):
        h = points[:, 2] * math.cos(a) + points[:, 1] * math.sin(a)
        tab[i] = np.quantile(h, f)
    lo, hi = float(tab.min()), float(tab.max())
    return (tab - lo) / max(hi - lo, 1e-9), lo, hi


def level(tab, lo, hi, tilt, fill):
    """The table read back: the level at a tilt (radians) and fill, metres over the base."""
    tilts, fills = tab.shape
    ti = np.clip(tilt / math.pi * (tilts - 1), 0, tilts - 1)
    fi = np.clip(fill * (fills - 1), 0, fills - 1)
    i0, j0 = int(ti), int(fi)
    i1, j1 = min(i0 + 1, tilts - 1), min(j0 + 1, fills - 1)
    a, b = ti - i0, fi - j0
    v = (tab[i0, j0] * (1 - a) + tab[i1, j0] * a) * (1 - b) + (tab[i0, j1] * (1 - a) + tab[i1, j1] * a) * b
    return lo + v * (hi - lo)


def info(kind, fill, points, color=None):
    """What the liquid node carries: its look, the fill and the table (the axis and origin are added once it's set down)."""
    body, top, foam, clarity = LIQUIDS.get(kind, LIQUIDS["water"])
    if color:
        body = color
    tab, lo, hi = fill_table(points)
    return {"kind": kind, "fill": float(fill), "color": body, "surface": top, "foam": foam, "clarity": clarity,
            "tilts": tab.shape[0], "fills": tab.shape[1], "table": [round(float(x), 5) for x in tab.ravel()], "h_min": lo, "h_max": hi,
            "_tab": tab}


def turned(inner, islands, island, kind="water", fill=0.6, color=None, seed=0, n=32):
    """A turned container's liquid from its inside's profile (r, z) in mm from the bottom up: the closed mesh (its
    own material, `liquid`) and its info with the fill table."""
    from . import mesh as M
    mm = 0.001
    inner = [(0.0, inner[0][1])] + [q for q in inner if q[0] > 0.2] + [(0.0, inner[-1][1])]
    zs = np.array([z for r, z in inner])
    rs = np.array([r for r, z in inner])
    order = np.argsort(zs, kind="stable")
    lm = M.lathe([M.Seg(np.array(inner) * mm, island, "band", mat="liquid")], n, islands, step=0.006, mats=["liquid"])
    Rz = lambda z: np.interp(z / mm, zs[order], rs[order]) * mm
    p = interior_points(Rz, zs.min() * mm, zs.max() * mm, rs.max() * mm, seed=seed)
    return lm, info(kind, fill, p, color)


def extras(d, axis_gltf, origin_gltf):
    out = {k: v for k, v in d.items() if not k.startswith("_")}
    out["axis"] = [round(float(x), 6) for x in axis_gltf]
    out["origin"] = [round(float(x), 6) for x in origin_gltf]
    return json.dumps(out)


def preview_material(name, d, h_world):
    """A Cycles material that does what Godot's shader does at rest: cut at the level (world height h_world), the
    inside's back faces lit as a flat surface, clear liquids partly see-through."""
    import bpy
    from .paint import rgb
    mt = bpy.data.materials.new(name)
    mt.use_nodes = True
    t = mt.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)

    def lin(c):
        c = rgb(c)
        return (*np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4), 1.0)

    out = t.nodes.new("ShaderNodeOutputMaterial")
    geo = t.nodes.new("ShaderNodeNewGeometry")
    sep = t.nodes.new("ShaderNodeSeparateXYZ")
    t.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    above = t.nodes.new("ShaderNodeMath")
    above.operation = "GREATER_THAN"
    above.inputs[1].default_value = h_world
    t.links.new(sep.outputs["Z"], above.inputs[0])
    body = t.nodes.new("ShaderNodeBsdfPrincipled")
    body.inputs["Base Color"].default_value = lin(d["color"])
    body.inputs["Roughness"].default_value = 0.12
    top = t.nodes.new("ShaderNodeBsdfPrincipled")
    top.inputs["Base Color"].default_value = lin(d["surface"])
    top.inputs["Roughness"].default_value = 0.05
    up = t.nodes.new("ShaderNodeCombineXYZ")
    up.inputs["Z"].default_value = 1.0
    t.links.new(up.outputs["Vector"], top.inputs["Normal"])
    face = t.nodes.new("ShaderNodeMixShader")
    t.links.new(geo.outputs["Backfacing"], face.inputs["Fac"])
    t.links.new(body.outputs["BSDF"], face.inputs[1])
    t.links.new(top.outputs["BSDF"], face.inputs[2])
    clear = t.nodes.new("ShaderNodeMixShader")
    clear.inputs["Fac"].default_value = float(d["clarity"]) * 0.75
    see = t.nodes.new("ShaderNodeBsdfTransparent")
    t.links.new(face.outputs["Shader"], clear.inputs[1])
    t.links.new(see.outputs["BSDF"], clear.inputs[2])
    cut = t.nodes.new("ShaderNodeMixShader")
    gone = t.nodes.new("ShaderNodeBsdfTransparent")
    t.links.new(above.outputs["Value"], cut.inputs["Fac"])
    t.links.new(clear.outputs["Shader"], cut.inputs[1])
    t.links.new(gone.outputs["BSDF"], cut.inputs[2])
    t.links.new(cut.outputs["Shader"], out.inputs["Surface"])
    mt.use_backface_culling = False
    return mt
