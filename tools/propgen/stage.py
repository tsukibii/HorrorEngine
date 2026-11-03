"""The preview: a thing on a grey floor under a big soft key light, seen from a little above (Cycles), the way the
litter sampler shows its props; and a contact sheet of many with their names under them."""
import math
import os

import numpy as np

from . import paint as P


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
            fill=0.62):
    """Renders `objects` (bpy objects, already standing on z = 0) to `path` (PNG)."""
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
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
    _clear_stage()
    return path


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
