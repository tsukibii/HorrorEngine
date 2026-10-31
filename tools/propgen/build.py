"""A recipe made into a prop. The family makes the thing at rest (its islands, a game mesh and, when it has detail the
game mesh can't carry, a detailed one) and deforms it; then here: set down on the floor, painted, the detailed mesh
baked onto the game mesh (normals, occlusion, creases), worn, its maps written, its material made, and the files.

    Thing.mats      {name: {kind, px, alpha, double, color, rough, metal}}: each material one texture set
    Thing.islands   {name: Island}: where each part's print goes (sizes in mm; packed per material)
    Thing.low       the game mesh; Thing.high the detailed one (or None)
    Thing.paint     fn(frames): draws every island (frames: {island name: Frame})
"""
import json
import math
import os
import time

import numpy as np

from . import bake as BK
from . import deform as D
from . import mesh as M
from . import noise as N
from . import paint as P
from . import surface as S

VERSION = 1


class Thing:
    def __init__(self, spec):
        self.spec = spec
        self.mats, self.islands, self.wrap = {}, {}, set()
        self.low = self.high = None
        self.paint = None
        self.pose, self.axis = "stand", (0, 0, 1)
        self.density = {}
        self.view = None
        self.sharp_angle = None
        self.weighted = None        # an angle (degrees): the game mesh's normals weighted by face area (hard surfaces)
        self.texel_paint = None     # fn(material name, canvas, texels): paint by each texel's place (an imported mesh)
        self.liquid = None          # (Mesh of the container's inside, liquid.info(...)): a node of its own for Godot's shader
        self.sockets = {}           # name -> (point, direction) at rest, metres: empties in the glb (socket_flame, socket_steam...)

    def material(self, name, kind="paint", px=None, alpha=False, double=False, color="#808080", rough=0.5, metal=0.0, specular=None):
        self.mats[name] = dict(kind=kind, px=px or int(self.spec.get("tex", 1024)), alpha=alpha, double=double,
                               color=color, rough=rough, metal=metal, specular=specular)

    def island(self, name, w_mm, h_mm, mat="main", wrap=False):
        self.islands[name] = M.Island(name, w_mm, h_mm, mat)
        if wrap:
            self.wrap.add(name)
        return self.islands[name]

    def pack(self, margin=6):
        """Every material's islands into its texture at one density (pixels a mm), the most that fits."""
        for mname, mat in self.mats.items():
            items = sorted([i for i in self.islands.values() if i.mat == mname], key=lambda i: (-i.h_mm, -i.w_mm, i.name))
            if not items:
                continue
            px = mat["px"]

            def fits(d):
                x = y = sh = 0.0
                out = []
                for it in items:
                    w, h = it.w_mm * d + 2 * margin, it.h_mm * d + 2 * margin
                    if w > px:
                        return None
                    if x + w > px:
                        y += sh
                        x, sh = 0.0, 0.0
                    if y + h > px:
                        return None
                    out.append((it, x, y))
                    x += w
                    sh = max(sh, h)
                return out

            lo, hi = 1e-3, 200.0
            for _ in range(50):
                mid = math.sqrt(lo * hi)
                lo, hi = (mid, hi) if fits(mid) else (lo, mid)
            d = lo * 0.999
            for it, x, y in fits(d):
                x0, y0 = x + margin, y + margin
                x1, y1 = x0 + it.w_mm * d, y0 + it.h_mm * d
                it.rect = (x0 / px, 1 - y1 / px, x1 / px, 1 - y0 / px)
            self.density[mname] = d


def lay_extras(spec, th, frames):
    """What every family takes over its own paint: a PBR set off the shelf on a material's islands (`pbr`: {material
    or "*": "pbr/<set>" or {set, tile (metres a repeat), rot, tint, alpha, normal, islands: [names]}}), then
    pictures on any island (`decals`: [{image, island, x, y (its middle, mm across and up the island; the middle if
    not given), w (mm; a third of the island), h (from the picture's shape), fit, rough, metal, alpha, height}]).
    `fit` wraps a picture over the whole island: "stretch" to its size, "width" its width with its own shape (centred
    up and down), "height" the same the other way."""
    for mname, ps in (spec.get("pbr") or {}).items():
        ps = ps if isinstance(ps, dict) else {"set": ps}
        only = ps.get("islands")
        for iname, isl in th.islands.items():
            if (mname == "*" or isl.mat == mname) and (not only or iname in only):
                frames[iname].pbr(ps["set"], tile=ps.get("tile"), rot=float(ps.get("rot", 0.0)), tint=ps.get("tint"),
                                  alpha=float(ps.get("alpha", 1.0)), normal_strength=float(ps.get("normal", 1.0)))
    for dc in spec.get("decals") or ():
        f = frames.get(dc.get("island"))
        if f is None:
            raise ValueError(f"decal on island {dc.get('island')!r}: one of {', '.join(sorted(frames))}")
        img = P.read_image(dc["image"])
        asp = img.shape[0] / img.shape[1]
        fit = dc.get("fit")
        if fit == "stretch":
            w, h, x, y = f.W, f.H, f.W / 2, f.H / 2
        elif fit == "width":
            w, h, x, y = f.W, f.W * asp, f.W / 2, float(dc.get("y", f.H / 2))
        elif fit == "height":
            w, h, x, y = f.H / asp, f.H, float(dc.get("x", f.W / 2)), f.H / 2
        else:
            w = float(dc.get("w", f.W / 3))
            h = float(dc.get("h", w * asp))
            x, y = float(dc.get("x", f.W / 2)), float(dc.get("y", f.H / 2))
        f.image(img, x - w / 2, y - h / 2, w, h, rough=float(dc.get("rough", 0.3)), metal=float(dc.get("metal", 0.0)),
                alpha=float(dc.get("alpha", 1.0)), height=float(dc.get("height", 0.01)))


def families():
    from .families import FAMILIES
    return FAMILIES


def _filter_kwargs(op, kw):
    try:
        props = {p.identifier for p in op.get_rna_type().properties}
        return {k: v for k, v in kw.items() if k in props}
    except Exception:
        return kw


def export(obs, base, formats):
    """The selected objects as <base>.glb / .fbx / .obj (+ .mtl and textures beside them) / .blend."""
    import bpy
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    out = []
    if "glb" in formats:
        op = bpy.ops.export_scene.gltf
        op(**_filter_kwargs(op, dict(filepath=base + ".glb", export_format="GLB", use_selection=True, export_yup=True,
                                     export_apply=True, export_texcoords=True, export_normals=True, export_tangents=True,
                                     export_materials="EXPORT", export_image_format="AUTO", export_cameras=False,
                                     export_lights=False, export_animations=False, export_extras=True)))
        out.append(base + ".glb")
    if "fbx" in formats:
        op = bpy.ops.export_scene.fbx
        op(**_filter_kwargs(op, dict(filepath=base + ".fbx", use_selection=True, path_mode="COPY", embed_textures=True,
                                     apply_unit_scale=True, apply_scale_options="FBX_SCALE_UNITS", axis_forward="-Z",
                                     axis_up="Y", mesh_smooth_type="OFF", use_tspace=True, bake_anim=False)))
        out.append(base + ".fbx")
    if "obj" in formats:
        op = bpy.ops.wm.obj_export
        op(**_filter_kwargs(op, dict(filepath=base + ".obj", export_selected_objects=True, export_materials=True,
                                     path_mode="RELATIVE", forward_axis="NEGATIVE_Z", up_axis="Y", export_uv=True,
                                     export_normals=True, export_triangulated_mesh=False)))
        out.append(base + ".obj")
    if "blend" in formats:
        bpy.ops.wm.save_as_mainfile(filepath=base + ".blend", copy=True, relative_remap=True, compress=True)
        out.append(base + ".blend")
    return out


def run(name, spec, out_dir, formats=("glb",), preview=True, samples=None, gpu=False, log=print):
    """Makes the prop `name` from `spec` into out_dir/<name>/; returns its record (what meta.json holds)."""
    import bpy
    t0 = time.time()
    seed = int(spec.get("seed", 0))
    fam = families()[spec["family"]]
    th = fam.make(spec, Thing(spec))
    log(f"  {name}: made ({th.low.ntris()} triangles{'; detail ' + str(th.high.ntris()) if th.high is not None else ''})")
    # set down
    pose = spec.get("pose", th.pose)
    R = D.rest_pose(th.high if th.high is not None else th.low, pose, th.axis, seed, prefer=spec.get("down", (0, 1, 0)))
    Mx, shift = D.place([th.high, th.low] + ([th.liquid[0]] if th.liquid else []), R, float(spec.get("yaw", 0)))
    odir = os.path.join(out_dir, name)
    os.makedirs(odir, exist_ok=True)
    # Blender objects with stand-in materials (the bakes need materials to put their images in)
    temp = {m: S.flat_material(f"{name}_{m}_tmp", v["color"], v["rough"], v["metal"]) for m, v in th.mats.items()}
    sharp = spec.get("sharp_angle", th.sharp_angle)
    low_me = M.to_blender(th.low, name, temp, sharp_angle=sharp, weighted=spec.get("weighted", th.weighted))
    low_ob = bpy.data.objects.new(name, low_me)
    bpy.context.scene.collection.objects.link(low_ob)
    high_ob = None
    curv_hi = None
    if th.high is not None:
        high_me = M.to_blender(th.high, name + "_detail", temp, sharp_angle=sharp)
        k = BK.curvature(th.high)
        curv_hi = k
        att = high_me.color_attributes.new("curv", "FLOAT_COLOR", "POINT")
        cvals = np.zeros((len(k), 4), np.float32)
        cvals[:, 0] = np.clip(k * 0.5 + 0.5, 0, 1)
        cvals[:, 3] = 1
        att.data.foreach_set("color", cvals.ravel())
        high_ob = bpy.data.objects.new(name + "_detail", high_me)
        bpy.context.scene.collection.objects.link(high_ob)
    # paint every material's islands
    canvases, frames = {}, {}
    for mname, mt in th.mats.items():
        cv = P.Canvas(mt["px"], mt["px"], mt["color"], mt["rough"], mt["metal"])
        canvases[mname] = cv
    for iname, isl in th.islands.items():
        frames[iname] = P.Frame(canvases[isl.mat], isl, wrap=iname in th.wrap)
    th.paint(frames)
    lay_extras(spec, th, frames)
    log(f"  {name}: painted ({time.time() - t0:.1f}s)")
    # per-texel attributes of the game mesh, and the bakes from the detailed one
    bs = int(samples or spec.get("bake_samples", 24))
    ao = BK.bake("AO", low_ob, high_ob, px=max(v["px"] for v in th.mats.values()), samples=bs, gpu=gpu,
                 ao_dist=float(spec.get("ao_dist", 0.012)), extrude=float(spec.get("cage", 0.003)), reach=float(spec.get("reach", 0.012)))
    nb = BK.bake("NORMAL", low_ob, high_ob, px=max(v["px"] for v in th.mats.values()), samples=4, gpu=gpu,
                 extrude=float(spec.get("cage", 0.003)), reach=float(spec.get("reach", 0.012))) if high_ob else {}
    cb = BK.bake("EMIT", low_ob, high_ob, px=max(v["px"] for v in th.mats.values()), samples=1, gpu=gpu, attr="curv",
                 extrude=float(spec.get("cage", 0.003)), reach=float(spec.get("reach", 0.012))) if high_ob else {}
    log(f"  {name}: baked ({time.time() - t0:.1f}s)")
    vn = BK.vertex_normals(th.low)
    kl = BK.curvature(th.low, vn)
    files = {}
    wspec = dict(spec.get("wear") or {})
    for mi, (mname, mt) in enumerate(th.mats.items()):
        cv = canvases[mname]
        px = mt["px"]
        fa = None
        if th.texel_paint:
            T, B = BK.tangent_frames(th.low)
            fa = {"tan": T, "bit": B}
        tex = BK.raster(th.low, px, {"rest": th.low.a.get("rest", th.low.v), "nrm": vn, "curv": kl[:, None]}, mat=th.low.mats.index(mname),
                        face_attrs=fa)
        tex["curv"] = tex["curv"][..., 0]
        key = f"{name}_{mname}_tmp"

        def fit(a):
            if a.shape[0] == px:
                return a
            k2 = a.shape[0] // px
            return a.reshape(px, k2, px, k2, -1).mean((1, 3))

        a_ao = fit(ao[key])[..., 0] if key in ao else np.ones((px, px), np.float32)
        tex["ao"] = a_ao
        if key in cb:
            tex["curv"] = (fit(cb[key])[..., 0] - 0.5) * 2
        if th.texel_paint:
            th.texel_paint(mname, cv, tex)
        S.wear(cv, tex, {**wspec, **(th.mats[mname].get("wear") or {})}, mt["kind"], seed + 7 * mi, th.density.get(mname, 4.0))
        det = S.combine_normals(cv.nrm, S.height_normal(cv.height, th.density.get(mname, 4.0), float(spec.get("relief", 1.0))))
        if key in nb:
            base = fit(nb[key])[..., :3] * 2 - 1
            base /= np.maximum(np.linalg.norm(base, axis=-1, keepdims=True), 1e-9)
            nrm = S.combine_normals(base, det)
        else:
            nrm = det
        aomap = np.clip(a_ao, 0, 1) ** float(spec.get("ao_gamma", 0.8))
        alpha = cv.opacity if mt["alpha"] else None
        used = cv.used
        wraps = []
        for iname in th.wrap:
            isl = th.islands[iname]
            if isl.mat == mname:
                u0, v0, u1, v1 = isl.rect
                wraps.append((int((1 - v1) * px), int(round(u0 * px)), int(math.ceil((1 - v0) * px)), int(round(u1 * px))))
        maps = [cv.col, cv.rough, cv.metal, nrm, aomap] + ([alpha] if alpha is not None else [])
        BK.bleed(maps, used, wraps)
        base_path = os.path.join(odir, f"{name}_{mname}")
        files[mname] = S.save_maps(base_path, cv, tex, nrm, aomap, alpha)
    # the real materials on the game mesh
    for i, mname in enumerate(th.low.mats):
        mt = th.mats[mname]
        pa, po, pn = files[mname]
        mat = S.material(f"{name}_{mname}", pa, po, pn, mt["kind"], alpha=mt["alpha"], double_sided=mt["double"], specular=mt["specular"],
                         tint=mt.get("tint"))
        low_me.materials[i] = mat
    if high_ob is not None:
        bpy.data.objects.remove(high_ob, do_unlink=True)
    for m in temp.values():
        bpy.data.materials.remove(m)
    liq_ob = None
    if th.liquid:
        from . import liquid as LQ
        lm, ld = th.liquid
        ax = Mx @ np.array([0.0, 0.0, 1.0])
        tilt = math.acos(float(np.clip(ax[2], -1, 1)))
        h_world = float(shift[2]) + LQ.level(ld["_tab"], ld["h_min"], ld["h_max"], tilt, ld["fill"])
        plain = S.flat_material(f"{name}_liquid", ld["color"], 0.1)
        liq_me = M.to_blender(lm, name + "_liquid", {lm.mats[0]: plain})
        liq_ob = bpy.data.objects.new(name + "_liquid", liq_me)
        bpy.context.scene.collection.objects.link(liq_ob)
        # glTF is y up: Blender's (x, y, z) goes out as (x, z, -y)
        liq_ob["propgen_liquid"] = LQ.extras(ld, (ax[0], ax[2], -ax[1]), (shift[0], shift[2], -shift[1]))
        th.liquid_preview = LQ.preview_material(f"{name}_liquid_preview", ld, h_world)
    socks = []
    for sname, (sp, sd) in th.sockets.items():
        # set down with the thing, then an empty under it pointing its +Z along the socket's direction
        from mathutils import Matrix, Vector
        p = Mx @ np.asarray(sp, float) + shift
        dvec = Mx @ np.asarray(sd, float)
        em = bpy.data.objects.new(f"socket_{sname}", None)
        em.empty_display_type = "SINGLE_ARROW"
        em.empty_display_size = 0.02
        rot = Vector((0, 0, 1)).rotation_difference(Vector(dvec)).to_matrix().to_4x4()
        em.matrix_world = Matrix.Translation(Vector(p)) @ rot
        bpy.context.scene.collection.objects.link(em)
        em.parent = low_ob
        em.matrix_parent_inverse = low_ob.matrix_world.inverted()
        socks.append(em)
    base = os.path.join(odir, name)
    outs = export([low_ob] + ([liq_ob] if liq_ob else []) + socks, base, formats)
    pv = None
    if preview:
        pv = base + "_preview.png"
        from .stage import preview as render
        if liq_ob is not None:
            liq_ob.data.materials[0] = th.liquid_preview
        render([low_ob] + ([liq_ob] if liq_ob else []), pv, samples=int(spec.get("preview_samples", 48)), gpu=gpu,
               **(spec.get("view") or th.view or {}))
    lo, hi = th.low.bounds()
    rec_sockets = {k: [round(float(x), 5) for x in (Mx @ np.asarray(v[0], float) + shift)] for k, v in th.sockets.items()}
    rec = {"name": name, "family": spec["family"], "version": VERSION, "seed": seed, "size_m": [round(float(x), 4) for x in (hi - lo)],
           "tris": th.low.ntris(), "files": [os.path.basename(p) for p in outs], "preview": os.path.basename(pv) if pv else None,
           "textures": {m: [os.path.basename(p) for p in f] for m, f in files.items()}, "spec": spec,
           "secs": round(time.time() - t0, 1), "sockets": rec_sockets,
           "islands": {n: {"mat": i.mat, "mm": [round(i.w_mm, 2), round(i.h_mm, 2)], "rect": [round(float(x), 5) for x in i.rect],
                           "wrap": n in th.wrap} for n, i in th.islands.items()},
           "materials": {m: {"kind": v["kind"], "px": v["px"], "color": v["color"]} for m, v in th.mats.items()}}
    with open(os.path.join(odir, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1)
    if th.liquid:
        rec["liquid"] = {k: th.liquid[1][k] for k in ("kind", "fill", "color", "clarity")}
        with open(os.path.join(odir, "meta.json"), "w", encoding="utf-8") as fh:
            json.dump(rec, fh, indent=1)
    log(f"  {name}: done in {rec['secs']}s -> {odir}")
    bpy.data.objects.remove(low_ob, do_unlink=True)
    if liq_ob is not None:
        bpy.data.objects.remove(liq_ob, do_unlink=True)
    for em in socks:
        bpy.data.objects.remove(em, do_unlink=True)
    return rec
