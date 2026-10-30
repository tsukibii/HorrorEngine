"""A thing's surface: the wear laid over its paint, the maps a game wants from it, and the Blender material that carries
them through the glTF export as Godot reads it (base colour, an ORM texture: occlusion, roughness, metalness, and a
tangent-space normal map, OpenGL's way).

Wear goes by each texel's place on the thing (`raster`'s attributes: the rest position, so the noise sticks to the
material and has no seams; the normal and the baked occlusion and curvature, so dirt gathers in creases and dust on
what faces up). Each layer is 0 to 1 in the recipe's `wear` (dirt, dust, scratches, edges, stains, fade, grime) and
does what suits the material's kind."""
import math

import numpy as np

from . import noise as N
from .paint import rgb

# what wear does on each kind of material: the dirt's colour, dust's, what a scratch or a worn edge shows
KINDS = {
    "metal":   {"dirt": "#2e2a24", "dust": "#a9a397", "scratch": ("#d9dbdd", 1.0, 0.28), "edge": ("#cfd2d4", 1.0, 0.3),
                "stain": "#7a4a22", "stain_rough": 0.7},
    "paint":   {"dirt": "#2e2a24", "dust": "#a9a397", "scratch": ("#c9c9c6", 0.0, 0.55), "edge": ("#e6e1d6", 0.0, 0.7),
                "stain": "#5a4630", "stain_rough": 0.6},
    "paper":   {"dirt": "#5b4a36", "dust": "#b3ab9c", "scratch": ("#f2efe6", 0.0, 0.95), "edge": ("#efe9dc", 0.0, 0.95),
                "stain": "#8a5a2b", "stain_rough": 0.75},
    "card":    {"dirt": "#4a3a28", "dust": "#aaa190", "scratch": ("#d8c7a2", 0.0, 0.95), "edge": ("#d9c9a6", 0.0, 0.95),
                "stain": "#6e4522", "stain_rough": 0.8},
    "plastic": {"dirt": "#35322c", "dust": "#b0aa9e", "scratch": ("#f4f4f2", 0.0, 0.6), "edge": ("#f0f0ee", 0.0, 0.55),
                "stain": "#6b5a40", "stain_rough": 0.6},
    "clear":   {"dirt": "#4b4840", "dust": "#c2bdb2", "scratch": ("#ffffff", 0.0, 0.4), "edge": ("#ffffff", 0.0, 0.35),
                "stain": "#8a7a5a", "stain_rough": 0.5},
    "film":    {"dirt": "#3b382f", "dust": "#9e988b", "scratch": ("#5a5a5a", 0.0, 0.5), "edge": ("#4a4a4a", 0.0, 0.5),
                "stain": "#5b4d36", "stain_rough": 0.7},
    "filter":  {"dirt": "#4a3a28", "dust": "#a8a090", "scratch": ("#e8d8b8", 0.0, 0.9), "edge": ("#e0d0b0", 0.0, 0.9),
                "stain": "#6e4a22", "stain_rough": 0.85},
}


def _ss(e0, e1, x):
    return N.smoothstep(e0, e1, x)


def _field(fn, P, step, shape, idx):
    """A smooth field evaluated on every `step`-th texel and spread to the rest (big blotches don't need every texel)."""
    if step <= 1:
        return fn(P)
    hh, ww = shape
    yy, xx = idx
    sub = (yy % step == 0) & (xx % step == 0)
    vals = np.zeros(shape, np.float32)
    have = np.zeros(shape, bool)
    vals[yy[sub], xx[sub]] = fn(P[sub])
    have[yy[sub], xx[sub]] = True
    # nearest sample of the coarse grid (the texel's own step cell), falling back to the full evaluation
    cy, cx = (yy // step) * step, (xx // step) * step
    ok = have[cy, cx]
    out = np.empty(len(yy), np.float32)
    out[ok] = vals[cy[ok], cx[ok]]
    if (~ok).any():
        out[~ok] = fn(P[~ok])
    return out


def wear(cv, tex, w, kind="paint", seed=0, density=4.0, mask=None):
    """Lays the wear `w` ({layer: 0-1}) over the canvas `cv` where `tex['hit']` (and `mask`). tex: raster's output
    with 'rest' (m), 'nrm' (world normal), 'ao' (1 open, 0 shut), 'curv' (+ ridges, - creases)."""
    if not w or not any(w.values()):
        return
    k = KINDS.get(kind, KINDS["paint"])
    hit = tex["hit"] if mask is None else tex["hit"] & mask
    yy, xx = np.nonzero(hit)
    if not len(yy):
        return
    P = tex["rest"][yy, xx] * 1000.0                     # millimetres
    nz = tex["nrm"][yy, xx, 2] if "nrm" in tex else np.zeros(len(yy))
    ao = tex["ao"][yy, xx] if "ao" in tex else np.ones(len(yy))
    cu = tex["curv"][yy, xx] if "curv" in tex else np.zeros(len(yy))
    col = cv.col[yy, xx]
    rough = cv.rough[yy, xx]
    metal = cv.metal[yy, xx]
    shape = hit.shape
    step = 2 if density > 3 else 1

    def blend(c, target, m):
        return c + (np.asarray(target, np.float32) - c) * m[:, None]

    if w.get("grime"):
        g = _field(lambda p: N.fbm3(p / 25.0, seed + 11, 3), P, step, shape, (yy, xx)) * 0.5 + 0.5
        m = np.clip(w["grime"] * (0.25 + 0.6 * g), 0, 1) * 0.55
        col = col * (1 - m[:, None] * 0.45) + rgb(k["dirt"])[None] * m[:, None] * 0.25
        rough = rough + (np.maximum(rough, 0.6) - rough) * m
    if w.get("dirt"):
        occl = np.clip(1 - ao, 0, 1)
        crease = np.clip(-cu * 1.5, 0, 1)
        n = _field(lambda p: N.fbm3(p / 6.0, seed + 21, 4), P, step, shape, (yy, xx)) * 0.5 + 0.5
        m = np.clip((occl ** 0.8 * 1.6 + crease * 0.9) * (0.45 + 0.9 * n) * w["dirt"], 0, 1)
        col = col * (1 - m[:, None] * 0.55) + rgb(k["dirt"])[None] * m[:, None] * 0.3
        rough = rough + (np.maximum(rough, 0.8) - rough) * m * 0.8
        metal = metal * (1 - 0.6 * m)
    if w.get("stains"):
        n = _field(lambda p: N.fbm3(p / 14.0, seed + 31, 4), P, step, shape, (yy, xx))
        thr = 0.55 - 0.45 * w["stains"]
        body = _ss(thr, thr + 0.08, n)
        rim = np.exp(-((n - thr - 0.02) / 0.025) ** 2) * (n > thr - 0.03)
        m = np.clip(body * 0.35 + rim * 0.55, 0, 1) * min(1.0, 0.4 + w["stains"])
        st = rgb(k["stain"])
        col = col * (1 - m[:, None] * 0.5) + (col * st[None] * 1.2) * m[:, None] * 0.5
        rough = rough + (k["stain_rough"] - rough) * m * 0.6
        metal = metal * (1 - 0.5 * m)
    if w.get("edges"):
        n = N.fbm3(P / 1.5, seed + 41, 3) * 0.5 + 0.5
        m = _ss(0.25, 0.7, np.clip(cu * 2.0, 0, 1) * (0.4 + 1.1 * n) * w["edges"] * 1.4)
        c, mt, rr = k["edge"]
        col = blend(col, rgb(c), m)
        metal = metal + (mt - metal) * m
        rough = rough + (rr - rough) * m
    if w.get("scratches"):
        r = N.rng(seed, "scratches")
        tot = np.zeros(len(P))
        patches = _field(lambda p: N.fbm3(p / 12.0, seed + 51, 2), P, step, shape, (yy, xx)) * 0.5 + 0.5
        for i in range(3):
            q, _ = np.linalg.qr(r.normal(size=(3, 3)))
            pr = P @ q
            # long thin lines: stretched along one axis, thin across another
            line = 1 - np.abs(N.perlin3(np.stack([pr[:, 0] * 0.06, pr[:, 1] * 1.6, pr[:, 2] * 0.06], 1), seed + 61 + i))
            tot = np.maximum(tot, _ss(0.965, 0.99, line))
        m = tot * _ss(0.45, 0.75, patches + 0.25 * (w["scratches"] - 0.5)) * min(1.0, 0.3 + w["scratches"])
        c, mt, rr = k["scratch"]
        col = blend(col, rgb(c), m * 0.85)
        metal = metal + (mt - metal) * m * 0.85
        rough = rough + (rr - rough) * m * 0.85
    if w.get("dust"):
        up = np.clip(nz, 0, 1) ** 1.5
        n = N.fbm3(P / 2.5, seed + 71, 3) * 0.5 + 0.5
        m = np.clip(w["dust"] * up * (0.3 + 0.9 * _ss(0.35, 0.75, n)), 0, 1) * 0.7
        col = blend(col, rgb(k["dust"]), m)
        rough = rough + (0.92 - rough) * m
        metal = metal * (1 - m)
    if w.get("fade"):
        lum = (col * np.array([0.3, 0.59, 0.11])).sum(1, keepdims=True)
        f = w["fade"] * 0.6
        col = col * (1 - f) + (lum * 0.85 + 0.12) * f
    cv.col[yy, xx] = np.clip(col, 0, 1)
    cv.rough[yy, xx] = np.clip(rough, 0.02, 1)
    cv.metal[yy, xx] = np.clip(metal, 0, 1)


def height_normal(height, s, strength=1.0):
    """A tangent-space normal (h, w, 3, -1 to 1) from a height map in mm at s pixels a mm (u right, v up)."""
    h = height.astype(np.float32)
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * s
    dy = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) * 0.5 * s       # rows run down, v up
    n = np.stack([-dx * strength, -dy * strength, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


def combine_normals(base, detail):
    """A baked normal (h, w, 3, -1 to 1) with a finer one laid over it (the 'whiteout' blend)."""
    n = np.stack([base[..., 0] + detail[..., 0], base[..., 1] + detail[..., 1], base[..., 2] * detail[..., 2]], -1)
    return n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-9)


# ---- the Blender material ------------------------------------------------------------------------------------------------

def _gltf_output_group():
    """The node group the glTF exporter reads occlusion from (its own 'glTF Material Output')."""
    import bpy
    g = bpy.data.node_groups.get("glTF Material Output")
    if g:
        return g
    g = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
    if hasattr(g, "interface"):
        g.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
        g.interface.new_socket("Thickness", in_out="INPUT", socket_type="NodeSocketFloat")
    else:
        g.inputs.new("NodeSocketFloat", "Occlusion")
        g.inputs.new("NodeSocketFloat", "Thickness")
    return g


def material(name, albedo, orm, normal, kind="paint", alpha=False, double_sided=False, specular=None):
    """A Principled material on the three images (bpy images or paths): base colour (sRGB, its alpha the opacity when
    `alpha`), ORM (occlusion, roughness, metalness: non-colour) and the normal map (non-colour, OpenGL)."""
    import bpy

    def img(x, data):
        im = bpy.data.images.load(x, check_existing=True) if isinstance(x, str) else x
        if data:
            im.colorspace_settings.name = "Non-Color"
        return im

    mt = bpy.data.materials.new(name)
    mt.use_nodes = True
    t = mt.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    out = t.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    bs = t.nodes.new("ShaderNodeBsdfPrincipled")
    bs.location = (250, 0)
    t.links.new(bs.outputs["BSDF"], out.inputs["Surface"])
    ia = t.nodes.new("ShaderNodeTexImage")
    ia.image = img(albedo, False)
    ia.location = (-500, 300)
    t.links.new(ia.outputs["Color"], bs.inputs["Base Color"])
    if alpha:
        t.links.new(ia.outputs["Alpha"], bs.inputs["Alpha"])
        for attr, val in (("blend_method", "BLEND"), ("surface_render_method", "BLENDED")):
            if hasattr(mt, attr):
                try:
                    setattr(mt, attr, val)
                except TypeError:
                    pass
        if hasattr(mt, "show_transparent_back"):
            mt.show_transparent_back = False
    io = t.nodes.new("ShaderNodeTexImage")
    io.image = img(orm, True)
    io.location = (-500, 0)
    sep = t.nodes.new("ShaderNodeSeparateColor")
    sep.location = (-200, 0)
    t.links.new(io.outputs["Color"], sep.inputs["Color"])
    t.links.new(sep.outputs["Green"], bs.inputs["Roughness"])
    t.links.new(sep.outputs["Blue"], bs.inputs["Metallic"])
    grp = t.nodes.new("ShaderNodeGroup")
    grp.node_tree = _gltf_output_group()
    grp.location = (250, -350)
    t.links.new(sep.outputs["Red"], grp.inputs["Occlusion"])
    inn = t.nodes.new("ShaderNodeTexImage")
    inn.image = img(normal, True)
    inn.location = (-500, -300)
    nm = t.nodes.new("ShaderNodeNormalMap")
    nm.location = (-200, -300)
    t.links.new(inn.outputs["Color"], nm.inputs["Color"])
    t.links.new(nm.outputs["Normal"], bs.inputs["Normal"])
    if specular is not None:
        for key in ("Specular IOR Level", "Specular"):
            if key in bs.inputs:
                bs.inputs[key].default_value = specular
                break
    mt.use_backface_culling = not double_sided
    return mt


def flat_material(name, color, rough=0.5, metal=0.0):
    """A plain material (for bakes before the maps exist, and the stage)."""
    import bpy
    mt = bpy.data.materials.new(name)
    mt.use_nodes = True
    bs = next(n for n in mt.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    c = rgb(color)
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    bs.inputs["Base Color"].default_value = (*lin, 1.0)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    return mt


def save_maps(base, cv, tex, nrm, ao, alpha=None):
    """Writes <base>_albedo.png (RGB, or RGBA with the opacity), _orm.png and _normal.png; returns their paths."""
    from .paint import write_png
    col = cv.col
    if alpha is not None:
        col = np.concatenate([col, alpha[..., None]], -1)
    pa, po, pn = base + "_albedo.png", base + "_orm.png", base + "_normal.png"
    write_png(pa, col)
    write_png(po, np.stack([ao, cv.rough, cv.metal], -1))
    write_png(pn, nrm * 0.5 + 0.5)
    return pa, po, pn
