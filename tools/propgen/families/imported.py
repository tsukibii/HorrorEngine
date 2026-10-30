"""Your own things, worn: a mesh you made (a .glb, .fbx or .obj, or a kit preset built by the kit's own code) dented,
scratched, dirtied and stained the way the made props are, each of its materials kept as it is (its colour, or its own
textures when its UVs are kept) or given a PBR set off the shelf (laid by triplanar projection at the set's real size,
whatever the UVs), all baked onto its own UVs (or new ones, a material each, when it has none or they tile) and exported.

    {"family": "import", "file": "Content/Games/<G>/Art/chair.glb"   (or "kit": "dining_chair", "kit_spec": {...})
     "uv": "auto" | "keep" | "new", "scale": 1.0,
     "materials": {"kit_wood": {"pbr": "pbr/Wood/oak", "tile": 0.9, "kind": "wood"}, "*": {"kind": "paint"}},
     "dents": {"count": 8, "depth": 2.0, "radius": 30}, "detail": 8, "wear": {"edges": 0.5, "scratches": 0.4, ...}}

A material's settings: pbr (a shelf ref or a folder), tile (metres a repeat), tint, color / rough / metal (in place of
what it has), kind (what wear does to it: paint, wood, metal, fabric, plastic, paper, card), wear (its own layers).
"""
import math
import os
import subprocess

import numpy as np

from .. import deform as D
from .. import mesh as M
from .. import noise as N
from ..recipes import ROOT

KIT_KINDS = {"wood": "wood", "fabric": "fabric", "rug": "fabric", "sheer": "fabric", "metal": "metal", "steel": "metal",
             "chrome": "metal", "brass": "metal", "iron": "metal", "paper": "paper", "kraft": "card", "ceramic": "plastic",
             "glaze": "plastic", "enamel": "plastic", "plastic": "plastic", "rubber": "plastic"}


def _kind_of(name):
    base = name.lower().replace("kit_", "").rstrip("_0123456789")
    for k, v in KIT_KINDS.items():
        if base.startswith(k):
            return v
    return "paint"


def _source(spec):
    if spec.get("kit"):
        import json
        out = os.path.join(ROOT, "Saved", "Props", "_kit", f"{spec['kit']}.glb")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        ks = dict(spec.get("kit_spec") or {}, preset=spec["kit"])
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "kit", "build.mjs"), "--spec", json.dumps(ks), "--out", out],
                           capture_output=True, text=True, cwd=ROOT)
        if r.returncode or not os.path.exists(out):
            raise SystemExit(f"kit {spec['kit']}: the kit's build failed\n{r.stdout[-800:]}{r.stderr[-800:]}")
        return out
    f = spec.get("file")
    if not f:
        raise SystemExit("import: give a `file` (.glb, .fbx, .obj) or a `kit` preset")
    return f if os.path.isabs(f) else os.path.join(ROOT, f)


def _load(path):
    """Imports the file and joins its meshes into one object, transforms applied; returns it."""
    import bpy
    before = set(bpy.data.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    else:
        raise SystemExit(f"import: {ext} isn't one of .glb .gltf .fbx .obj")
    obs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if not obs:
        raise SystemExit(f"import: no mesh in {path}")
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    for o in list(bpy.data.objects):
        if o not in before and o is not ob:
            bpy.data.objects.remove(o, do_unlink=True)
    ob.parent = None
    ob.matrix_world = ob.matrix_world.copy()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


def _uvs(ob, mode):
    """Keeps the UVs when they're one layout in 0-1, else unwraps each material into its own 0-1 (Smart UV Project)."""
    import bpy
    me = ob.data
    renew = mode == "new"
    if mode == "auto":
        if not me.uv_layers:
            renew = True
        else:
            uv = np.zeros(len(me.loops) * 2, np.float32)
            me.uv_layers.active.data.foreach_get("uv", uv)
            renew = bool(uv.size) and (uv.min() < -0.01 or uv.max() > 1.01)
    if not renew:
        return False
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    for i in range(max(1, len(ob.material_slots))):
        bpy.ops.mesh.select_all(action="DESELECT")
        if ob.material_slots:
            ob.active_material_index = i
            bpy.ops.object.material_slot_select()
        else:
            bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006, area_weight=0.0, correct_aspect=True,
                                 scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return True


def _looks(ob):
    """Each material's own look: base colour (constant or its image), roughness, metalness, the image's pixels."""
    out = {}
    for slot in ob.material_slots:
        mt = slot.material
        if mt is None or mt.name in out:
            continue
        lk = {"color": (0.6, 0.6, 0.6), "rough": 0.6, "metal": 0.0, "image": None}
        if mt.use_nodes:
            bs = next((n for n in mt.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if bs:
                bc = bs.inputs["Base Color"]
                c = bc.default_value
                lin = np.array(c[:3])
                lk["color"] = tuple(np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055))
                lk["rough"] = float(bs.inputs["Roughness"].default_value)
                lk["metal"] = float(bs.inputs["Metallic"].default_value)
                if bc.links and bc.links[0].from_node.type == "TEX_IMAGE" and bc.links[0].from_node.image:
                    im = bc.links[0].from_node.image
                    w, h = im.size
                    if w and h:
                        px = np.zeros(w * h * 4, np.float32)
                        im.pixels.foreach_get(px)
                        lk["image"] = px.reshape(h, w, 4)[::-1].copy()
        else:
            c = mt.diffuse_color
            lk["color"] = tuple(c[:3])
        out[mt.name] = lk
    return out


def _subdivide(m, max_edge, cap=300000):
    """Midpoint subdivision (every triangle into four, shared edges split once) until its edges are under max_edge or
    it would pass `cap` triangles: a mesh fine enough to dent. UVs and rest positions go with it."""
    t, tuv, tf = m.tris()
    v = m.v.copy()
    rest = m.a.get("rest", m.v).copy()
    fm = m.fm[tf]
    while True:
        e = np.linalg.norm(v[t[:, [1, 2, 0]]] - v[t], axis=2).max()
        if e <= max_edge or len(t) * 4 > cap:
            break
        ed = np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]])
        key = np.sort(ed, 1)
        uk, inv = np.unique(key, axis=0, return_inverse=True)
        inv = inv.ravel()
        mid = len(v) + np.arange(len(uk))
        v = np.concatenate([v, (v[uk[:, 0]] + v[uk[:, 1]]) / 2])
        rest = np.concatenate([rest, (rest[uk[:, 0]] + rest[uk[:, 1]]) / 2])
        n = len(t)
        m01, m12, m20 = mid[inv[:n]], mid[inv[n:2 * n]], mid[inv[2 * n:]]
        a, b, c = t[:, 0], t[:, 1], t[:, 2]
        uva, uvb, uvc = tuv[:, 0], tuv[:, 1], tuv[:, 2]
        u01, u12, u20 = (uva + uvb) / 2, (uvb + uvc) / 2, (uvc + uva) / 2
        t = np.concatenate([np.stack([a, m01, m20], 1), np.stack([m01, b, m12], 1), np.stack([m20, m12, c], 1), np.stack([m01, m12, m20], 1)])
        tuv = np.concatenate([np.stack([uva, u01, u20], 1), np.stack([u01, uvb, u12], 1), np.stack([u20, u12, uvc], 1), np.stack([u01, u12, u20], 1)])
        fm = np.concatenate([fm, fm, fm, fm])
    f = np.concatenate([t, np.full((len(t), 1), -1)], 1)
    uv = np.concatenate([tuv, np.zeros((len(t), 1, 2))], 1)
    out = M.Mesh(v, f, uv, mats=m.mats)
    out.fm = fm
    out.a["rest"] = rest
    return out


def make(spec, th):
    import bpy
    from .. import pbrset
    path = _source(spec)
    ob = _load(path)
    if spec.get("scale"):
        ob.scale = (float(spec["scale"]),) * 3
        bpy.ops.object.transform_apply(scale=True)
    renewed = _uvs(ob, spec.get("uv", "auto"))
    looks = _looks(ob)
    me = ob.data
    # n-gons into triangles (the Mesh takes threes and fours)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    big = [f for f in bm.faces if len(f.verts) > 4]
    if big:
        bmesh.ops.triangulate(bm, faces=big)
    bm.to_mesh(me)
    bm.free()
    low = M.from_blender(me)
    low.a["rest"] = low.v.copy()
    names = [s.material.name if s.material else "main" for s in ob.material_slots] or ["main"]
    low.mats = names
    bpy.data.objects.remove(ob, do_unlink=True)
    mspec = spec.get("materials") or {}
    tex = int(spec.get("tex", 2048))
    settings = {}
    for n in dict.fromkeys(names):
        ms = dict(mspec.get("*") or {}, **(mspec.get(n) or {}))
        lk = looks.get(n, {"color": (0.6, 0.6, 0.6), "rough": 0.6, "metal": 0.0, "image": None})
        kind = ms.get("kind") or _kind_of(n)
        col = ms.get("color") or tuple(float(x) for x in lk["color"])
        th.material(n, kind, px=int(ms.get("px", tex)), color=col, rough=float(ms.get("rough", lk["rough"])),
                    metal=float(ms.get("metal", lk["metal"])))
        if ms.get("wear"):
            th.mats[n]["wear"] = ms["wear"]
        settings[n] = (ms, lk)
    th.low = low
    th.high = None
    seed = int(spec.get("seed", 0))
    dn = spec.get("dents")
    if dn or spec.get("creases"):
        hi = _subdivide(low, float(spec.get("detail", 8.0)) * 0.001)
        if dn:
            r = N.rng(dn.get("seed", seed), "import_dents")
            t, _, _ = hi.tris()
            a, b, c = hi.v[t[:, 0]], hi.v[t[:, 1]], hi.v[t[:, 2]]
            ar = np.linalg.norm(np.cross(b - a, c - a), axis=1)
            pick = r.choice(len(t), size=int(dn.get("count", 6)), p=ar / ar.sum())
            centres = hi.a["rest"][t[pick]].mean(1)
            D.dents(hi, centres, depth=dn.get("depth", 2.0) * 0.001, radius=dn.get("radius", 25) * 0.001, seed=seed,
                    creases=dn.get("creases", 0.4))
        if spec.get("creases"):
            D.displace(hi, float(spec["creases"]) * 0.001, float(spec.get("crease_scale", 40)) * 0.001, seed + 5, ridged=True)
        th.high = hi
    th.pose = spec.get("pose", "stand")
    th.sharp_angle = spec.get("sharp_angle", 35)

    def texel_paint(mname, cv, tx):
        ms, lk = settings[mname]
        hit = tx["hit"]
        cv.used |= hit
        if ms.get("pbr"):
            st = pbrset.load(ms["pbr"])
            P, Nn, T, B = tx["rest"][hit], tx["nrm"][hit], tx["tan"][hit], tx["bit"][hit]
            alb, rough, metal, nts = pbrset.triplanar(st, P, Nn, T, B, tile=ms.get("tile"))
            if ms.get("tint"):
                from ..paint import rgb
                alb = alb * rgb(ms["tint"])[None]
            cv.col[hit] = np.clip(alb, 0, 1)
            cv.rough[hit] = np.clip(rough * float(ms.get("rough_scale", 1.0)), 0.02, 1)
            cv.metal[hit] = metal if "metal" not in ms else float(ms["metal"])
            cv.nrm[hit] = nts
        elif lk["image"] is not None and not renewed and not ms.get("color"):
            img = lk["image"]
            h, w = img.shape[:2]
            ys = np.clip(((np.arange(cv.h) + 0.5) * h / cv.h).astype(int), 0, h - 1)
            xs = np.clip(((np.arange(cv.w) + 0.5) * w / cv.w).astype(int), 0, w - 1)
            res = img[ys][:, xs][..., :3]
            cv.col[hit] = res[hit]

    th.paint = lambda fr: None
    th.texel_paint = texel_paint
    th.view = spec.get("view") or {"azim": -35, "elev": 28}
    if renewed and any(lk["image"] is not None for lk in looks.values()):
        print("  import: its own textures were left out (its UVs were made again); give its materials a pbr, or keep its UVs (uv: keep)")
    return th
