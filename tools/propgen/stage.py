"""The preview: a thing on a grey floor under a big soft key light, seen from a little above (Cycles), the way the
litter sampler shows its props; and a contact sheet of many with their names under them.

The preview is rendered as light (linear) and toned by tone.py's curve, and beside it, at half its size, the sticker
passes (docs/PROPGEN.md §25): the light a white matt surface would get there, the gloss a clear coat would show, and
which texture's which point each pixel sees; the page lays any picture onto the picture with them, lit and toned as
the render would have, without Blender."""
import math
import os

import numpy as np

from . import paint as P

PASSES = 2          # the sticker passes' version (thumbs.py makes older ones again): 2 with the materials' normal maps


def _clear_stage():
    import bpy
    for o in list(bpy.data.objects):
        if o.name.startswith("PG_"):
            bpy.data.objects.remove(o, do_unlink=True)


def _world(color=0.5, strength=0.55):
    import bpy
    sc = bpy.context.scene
    w = sc.world or bpy.data.worlds.new("propgen_world")
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (color, color, color, 1)
    bg.inputs["Strength"].default_value = strength


def preview(objects, path, size=(800, 600), samples=48, gpu=False, elev=30.0, azim=-35.0, lens=55.0, floor=0.42,
            fill=0.62, passes=None, mats=None, ground=None):
    """Renders `objects` (bpy objects, already standing on z = 0) to `path` (PNG); with `passes` (a PNG's path) the
    sticker passes too, at half the size: the first object's materials, `mats` their names in its slots' order;
    `ground` {material: its paint with every picture slot empty}: that picture too (`<passes>_ground.png`), so a
    picture swapped into a slot hides what was drawn there."""
    import bpy
    from mathutils import Vector
    from .bake import cycles
    _clear_stage()
    sc = cycles(samples, gpu)
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Base Contrast" if "AgX - Base Contrast" in [x.identifier for x in sc.view_settings.bl_rna.properties["look"].enum_items] else "None"
    except TypeError:
        sc.view_settings.view_transform = "Filmic"
    sc.view_settings.exposure = 0.0
    try:
        sc.cycles.use_denoising = True
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 16
    # the thing's bounds
    lo = np.array([1e9] * 3)
    hi = -lo
    for o in objects:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = np.minimum(lo, w)
            hi = np.maximum(hi, w)
    ctr = (lo + hi) / 2
    rad = max(np.linalg.norm(hi - lo) / 2, 0.01)
    # floor
    me = bpy.data.meshes.new("PG_floor")
    S = rad * 60
    me.from_pydata([(-S, -S, 0), (S, -S, 0), (S, S, 0), (-S, S, 0)], [], [(0, 1, 2, 3)])
    fl = bpy.data.objects.new("PG_floor", me)
    sc.collection.objects.link(fl)
    from .surface import flat_material
    fm = flat_material("PG_floor_mat", (floor, floor, floor), rough=0.75)
    fl.data.materials.append(fm)
    _world()
    # the key: a big soft square above and to the left, a smaller fill opposite
    d = rad * 7
    for nm, (ax, ay, az), size_k, e in (("PG_key", (-0.55, -0.45, 1.0), 2.2, 5.5), ("PG_fill", (0.7, -0.6, 0.45), 1.4, 1.2)):
        ld = bpy.data.lights.new(nm, "AREA")
        ld.shape = "SQUARE"
        ld.size = rad * size_k * 2
        dirv = np.array([ax, ay, az]) / np.linalg.norm([ax, ay, az])
        dist = d
        ld.energy = e * math.pi * dist * dist * 1.0
        lo_ = bpy.data.objects.new(nm, ld)
        lo_.location = Vector(ctr + dirv * dist)
        lo_.rotation_euler = (Vector(ctr) - lo_.location).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(lo_)
    # camera fitted to the bounding sphere
    cd = bpy.data.cameras.new("PG_cam")
    cd.lens = lens
    cd.sensor_width = 36
    cam = bpy.data.objects.new("PG_cam", cd)
    sc.collection.objects.link(cam)
    fov = 2 * math.atan(cd.sensor_width / 2 / lens)
    aspect = size[0] / size[1]
    th, tv = math.tan(fov / 2), math.tan(fov / 2) / aspect
    e, a = math.radians(elev), math.radians(azim)
    off = np.array([math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)])
    fwd = -off
    right = np.cross(fwd, (0, 0, 1))
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    # the distance at which every corner of the box is inside the frame, `fill` the share of it the box may take
    corners = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]) - ctr
    dist = 0.0
    for c in corners:
        dist = max(dist, float(c @ off) + abs(float(c @ right)) / (th * fill), float(c @ off) + abs(float(c @ up)) / (tv * fill))
    dist = max(dist, rad * 1.2)
    cam.location = Vector(ctr + off * dist)
    cam.rotation_euler = (Vector(ctr) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cd.clip_start = dist * 0.01
    cd.clip_end = dist * 100
    sc.camera = cam
    from .tone import agx
    lin = _render_exr(sc, path + ".tmp.exr")
    P.write_png(path, agx(lin[..., :3]))
    if passes:
        _passes(sc, objects, fl, passes, mats or [], ground or {})
    _clear_stage()
    return path


def _render_exr(sc, exr):
    """The scene rendered as light (RGBA floats, rows top first), through a scratch OpenEXR file."""
    import bpy
    st = sc.render.image_settings
    st.file_format, st.color_mode, st.color_depth = "OPEN_EXR", "RGBA", "32"
    sc.render.filepath = os.path.abspath(exr)
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(os.path.abspath(exr), check_existing=False)
    w, h = im.size
    px = np.zeros(w * h * 4, np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    try:
        os.remove(exr)
    except OSError:
        pass
    return px.reshape(h, w, 4)[::-1].copy()


def _override(mts, shader):
    """Each material's surface swapped for `shader(tree, k)` (an output socket), see-through where it was (its alpha
    still cutting it); returns what puts them back."""
    undo = []
    for k, mt in enumerate(mts):
        if mt is None or not mt.use_nodes:
            continue
        t = mt.node_tree
        outs = [n for n in t.nodes if n.type == "OUTPUT_MATERIAL"]
        if not outs:
            continue
        out = next((n for n in outs if n.is_active_output), outs[0])
        orig = out.inputs["Surface"].links[0].from_socket if out.inputs["Surface"].is_linked else None
        bs = next((n for n in t.nodes if n.type == "BSDF_PRINCIPLED"), None)
        asrc = bs.inputs["Alpha"].links[0].from_socket if bs is not None and bs.inputs["Alpha"].is_linked else None
        nsrc = bs.inputs["Normal"].links[0].from_socket if bs is not None and bs.inputs["Normal"].is_linked else None
        before = set(t.nodes)
        sh = shader(t, k)
        if nsrc is not None and "Normal" in sh.node.inputs:      # its dents, crumples and pressed letters: a sticker on it is too
            t.links.new(nsrc, sh.node.inputs["Normal"])
        if asrc is not None:
            tr = t.nodes.new("ShaderNodeBsdfTransparent")
            mx = t.nodes.new("ShaderNodeMixShader")
            t.links.new(asrc, mx.inputs[0])
            t.links.new(tr.outputs[0], mx.inputs[1])
            t.links.new(sh, mx.inputs[2])
            sh = mx.outputs[0]
        t.links.new(sh, out.inputs["Surface"])
        es = getattr(mt.cycles, "emission_sampling", None)
        if es is not None:
            mt.cycles.emission_sampling = "NONE"
        undo.append((mt, out, orig, [n for n in t.nodes if n not in before], es))

    def back():
        for mt, out, orig, added, es in undo:
            t = mt.node_tree
            for n in added:
                t.nodes.remove(n)
            if orig is not None:
                t.links.new(orig, out.inputs["Surface"])
            if es is not None:
                mt.cycles.emission_sampling = es
    return back


def _albedo_node(mt):
    """The image node a material's base colour comes from (through its tint), or None."""
    bs = next((n for n in mt.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if mt and mt.use_nodes else None
    if bs is None or not bs.inputs["Base Color"].is_linked:
        return None
    n = bs.inputs["Base Color"].links[0].from_node
    if n.type == "MIX":
        n = next((lk.from_node for i in n.inputs if i.is_linked for lk in i.links if lk.from_node.type == "TEX_IMAGE"), None)
    return n if n is not None and n.type == "TEX_IMAGE" else None


def _passes(sc, objects, floor_ob, out, names, ground=None):
    """The sticker passes at half the preview's size, one PNG of two panes side by side (8 bits, no alpha):
    left the texture's point each pixel sees (u and v in 12 bits each: R u's high 8, G v's high 8, B their low 4 and
    4), right R the material (its slot + 1, 0 none: the high 4 bits) and how much of the pixel it covers (the low 4),
    G the light a white matt surface gets there and B the gloss of a clear coat at roughness 0.35, each coded by
    tone.enc. A picture laid at a texture point is lit as its colour x light + gloss and toned by tone.agx."""
    import bpy
    from .tone import agx, enc
    r, cy = sc.render, sc.cycles
    keep = dict(pct=r.resolution_percentage, transp=r.film_transparent, samples=cy.samples, den=cy.use_denoising,
                fw=cy.filter_width, bounces=cy.max_bounces, cam=floor_ob.visible_camera)
    r.resolution_percentage = 50
    r.film_transparent = True
    floor_ob.visible_camera = False                     # still lighting the thing and bouncing, but not in the picture
    obj = objects[0]
    mts = [s.material for s in obj.material_slots]
    # the other objects' materials: a part of the thing (a lid, a door, a cover) shares the thing's own, so those are its
    others = [s.material for o in objects[1:] for s in o.material_slots if s.material is not None and s.material not in mts]

    def white(t, k):
        n = t.nodes.new("ShaderNodeBsdfDiffuse")
        n.inputs["Color"].default_value = (1, 1, 1, 1)
        return n.outputs[0]

    def coat(t, k):
        n = t.nodes.new("ShaderNodeBsdfPrincipled")
        n.inputs["Base Color"].default_value = (0, 0, 0, 1)
        n.inputs["Roughness"].default_value = 0.35
        return n.outputs[0]

    def where(t, k):
        uv = t.nodes.new("ShaderNodeUVMap")
        sep = t.nodes.new("ShaderNodeSeparateXYZ")
        cmb = t.nodes.new("ShaderNodeCombineXYZ")
        em = t.nodes.new("ShaderNodeEmission")
        t.links.new(uv.outputs["UV"], sep.inputs[0])
        t.links.new(sep.outputs[0], cmb.inputs[0])
        t.links.new(sep.outputs[1], cmb.inputs[1])
        cmb.inputs[2].default_value = float(k + 1) if k < 15 else 0.0
        t.links.new(cmb.outputs[0], em.inputs["Color"])
        em.inputs["Strength"].default_value = 1.0
        return em.outputs[0]

    def nothing(t, k):
        return t.nodes.new("ShaderNodeHoldout").outputs[0]

    try:
        cy.samples, cy.use_denoising = 24, True
        back = _override(mts, white)
        back2 = _override(others, white)
        E = _render_exr(sc, out + ".e.exr")
        back(), back2()
        back = _override(mts, coat)
        back2 = _override(others, coat)
        G = _render_exr(sc, out + ".g.exr")
        back(), back2()
        cy.samples, cy.use_denoising, cy.filter_width, cy.max_bounces = 1, False, 0.01, 0
        back = _override(mts, where)
        back2 = _override(others, nothing)
        W = _render_exr(sc, out + ".w.exr")
        back(), back2()
        swaps = []
        for k, mt in enumerate(mts):
            nm = names[k] if k < len(names) else None
            node = _albedo_node(mt) if nm in (ground or {}) else None
            if node is not None:
                im = bpy.data.images.load(os.path.abspath(ground[nm]), check_existing=False)
                swaps.append((node, node.image, im))
                node.image = im
        if swaps:                                       # the picture again with the slots' drawings left out
            r.film_transparent = False
            floor_ob.visible_camera = True
            cy.samples, cy.use_denoising, cy.filter_width, cy.max_bounces = 32, True, keep["fw"], keep["bounces"]
            try:
                Gd = _render_exr(sc, out + ".ground.exr")
            finally:
                for node, old_im, im in swaps:
                    node.image = old_im
                    bpy.data.images.remove(im)
            P.write_png(out[:-4] + "_ground.png", agx(Gd[..., :3]))
    finally:
        r.resolution_percentage, r.film_transparent = keep["pct"], keep["transp"]
        cy.samples, cy.use_denoising, cy.filter_width, cy.max_bounces = keep["samples"], keep["den"], keep["fw"], keep["bounces"]
        floor_ob.visible_camera = keep["cam"]
    lum = np.array([0.2126, 0.7152, 0.0722])
    cov = np.clip(E[..., 3], 0, 1)
    light = (E[..., :3] @ lum) / np.maximum(cov, 1e-4)
    gloss = (G[..., :3] @ lum) / np.maximum(np.clip(G[..., 3], 0, 1), 1e-4)
    hit = W[..., 3] > 0.5
    mid = np.where(hit, np.rint(W[..., 2]), 0).astype(np.int64)
    mid[(mid < 0) | (mid > 15)] = 0
    u12 = np.clip(np.rint(np.mod(W[..., 0], 1.0 + 1e-9) * 4095), 0, 4095).astype(np.int64)
    v12 = np.clip(np.rint(np.mod(W[..., 1], 1.0 + 1e-9) * 4095), 0, 4095).astype(np.int64)
    u12[mid == 0] = 0
    v12[mid == 0] = 0
    left = np.stack([u12 >> 4, v12 >> 4, ((u12 & 15) << 4) | (v12 & 15)], -1)
    c4 = np.clip(np.rint(cov * 15), 0, 15).astype(np.int64)
    right = np.stack([(mid << 4) | np.where(mid > 0, c4, 0), np.rint(enc(light) * 255), np.rint(enc(gloss) * 255)], -1)
    right[mid == 0, 1:] = 0
    P.write_png(out, np.concatenate([left, right], 1).astype(np.uint8))
    with open(out[:-4] + ".json", "w", encoding="utf-8") as fh:
        import json
        json.dump({"v": PASSES, "mats": list(names)[:15], "size": [int(left.shape[1]), int(left.shape[0])], "tone": "agx",
                   "ground": bool(ground) and os.path.exists(out[:-4] + "_ground.png"), "about": "docs/PROPGEN.md §25"}, fh)
    return out


def sheet(tiles, out, title="", cols=5, tile=(400, 300), caption=22):
    """A contact sheet: each (path, label) a tile, captions under them, a title on top (rows top first)."""
    imgs = []
    for p, label in tiles:
        im = P.read_image(p)[..., :3] if os.path.exists(p) else np.full((tile[1], tile[0], 3), 0.3, np.float32)
        imgs.append((_resize(im, tile), label))
    rows = (len(imgs) + cols - 1) // cols
    pad, top = 8, (60 if title else 10)
    W = cols * tile[0] + (cols + 1) * pad
    H = top + rows * (tile[1] + caption + pad) + pad
    cv = P.Canvas(W, H, "#121316")
    from .mesh import Island
    whole = Island("sheet", W, H)
    fr = P.Frame(cv, whole)
    if title:
        fr.text(title, (pad + 6, H - 34), 26, font="archivo", anchor="left", color="#f2efe8")
    for i, (im, label) in enumerate(imgs):
        r, c = divmod(i, cols)
        x0 = pad + c * (tile[0] + pad)
        y0 = top + r * (tile[1] + caption + pad)
        cv.col[y0:y0 + tile[1], x0:x0 + tile[0]] = im
        fr.text(label, (x0 + 4, H - (y0 + tile[1] + caption * 0.55)), caption * 0.5, font="archivo", anchor="left", color="#c9c6be")
    P.write_png(out, cv.col)
    return out


def _resize(im, size):
    w, h = size
    ih, iw = im.shape[:2]
    ys = np.clip(((np.arange(h) + 0.5) * ih / h).astype(int), 0, ih - 1)
    xs = np.clip(((np.arange(w) + 0.5) * iw / w).astype(int), 0, iw - 1)
    if ih > h * 1.5:
        k = int(ih // h)
        im = im[:ih // k * k, :iw // k * k].reshape(ih // k, k, iw // k, k, -1).mean((1, 3))
        ih, iw = im.shape[:2]
        ys = np.clip(((np.arange(h) + 0.5) * ih / h).astype(int), 0, ih - 1)
        xs = np.clip(((np.arange(w) + 0.5) * iw / w).astype(int), 0, iw - 1)
    return im[ys][:, xs]
