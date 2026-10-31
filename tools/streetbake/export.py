"""The street out of Blender for Godot: every material made again as plain glTF (what any engine reads), the finish's
tileable set at its real size (KHR_texture_transform) times the surface's own colour, its ORM and normal maps, the
street's wear atlas as the occlusion on the second UVs (Godot 4.7 reads texCoord 1 as ao_on_uv2), and the wear's
recipe in the material's extras (`hs_wear`) for the HorrorStudio Look plugin, which lays the dirt, streaks and worn
edges back on at import (horrorstudio_look/street.gd). The colliders (-colonly), occluders (-occonly), lamps and the
insides' markers go out as they came in, by name, so Godot makes them again; anything added in Blender follows
Godot's own name suffixes (docs/STREET_TEXTURING.md §4)."""
import json
from pathlib import Path

import bpy
import numpy as np

from . import finishes as F
from . import scene as S
from . import tiles as T
from .nodes import NB, srgb

ROOT = Path(__file__).resolve().parents[2]


def gltf_output(nb):
    """The glTF exporter's own node group (its Occlusion socket is how an occlusion map is exported)."""
    ng = bpy.data.node_groups.get("glTF Material Output")
    if not ng:
        ng = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        ng.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
        ng.interface.new_socket("Thickness", in_out="INPUT", socket_type="NodeSocketFloat")
    n = nb.node("ShaderNodeGroup")
    n.node_tree = ng
    return n


def _img(path, colour=True):
    p = str(path)
    for im in bpy.data.images:
        if im.filepath and bpy.path.abspath(im.filepath) == p:
            return im
    im = bpy.data.images.load(p)
    im.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    return im


def wear_params(fin, book):
    W = F.WEAR.get(fin, F.WEAR["plain"])
    amount = book.get("wear") or {}
    (dc, d), (sc, s), (ec, e) = W["dirt"], W["streak"], W["edge"]
    hexa = lambda h: list(srgb(h)[:3]) if h != "lighter" else [0.9, 0.9, 0.9]  # noqa: E731
    return {"kind": fin, "dirt_color": hexa(dc), "dirt": d * amount.get("dirt", 1.0), "streak_color": hexa(sc),
            "streaks": s * amount.get("streaks", 1.0), "edge_color": hexa(ec), "edge_lighter": 1.0 if ec == "lighter" else 0.0,
            "edges": e * amount.get("edges", 1.0), "wet": W["wet"] * amount.get("wet", 1.0), "tone": W["tone"]}


def material(mat, info, book, wear_img, kept):
    """`mat` made again as plain glTF. info: what the look knew of it (finish, colour, picture, emits, slot)."""
    fin, col, picture, emits, slot = info["finish"], info["colour"], info["picture"], info["emits"], info["slot"]
    nt = mat.node_tree
    nt.nodes.clear()
    nb = NB(nt)
    out = nb.node("ShaderNodeOutputMaterial")
    bs = nb.node("ShaderNodeBsdfPrincipled")
    nt.links.new(bs.outputs[0], out.inputs["Surface"])
    uv = nb.uv("UVMap")
    if fin == "glow":
        nb.put(tuple(c * 0.25 for c in col[:3]) + (1,), bs.inputs["Base Color"])
        nb.put(col, bs.inputs["Emission Color"])
        nb.put(F.GLOW.get(S.base_slot(slot), 3.0) * float(book.get("glow", 1.0)), bs.inputs["Emission Strength"])
        nb.put(0.3, bs.inputs["Roughness"])
        return "glow"
    if fin == "image" and picture:
        img, mp = picture
        at = uv
        if mp:
            m = nb.node("ShaderNodeMapping")
            nb.put(uv, m.inputs["Vector"])
            m.inputs["Location"].default_value, m.inputs["Rotation"].default_value, m.inputs["Scale"].default_value = mp
            at = m.outputs[0]
        t = nb.node("ShaderNodeTexImage", image=kept.get(mat.name, img))
        nb.put(at, t.inputs["Vector"])
        nb.put(t.outputs["Color"], bs.inputs["Base Color"])
        nb.put(nb.math("ROUND", t.outputs["Alpha"]), bs.inputs["Alpha"])      # rounded: glTF's alpha MASK, cut at 0.5
        nb.put(0.6, bs.inputs["Roughness"])
        if emits:
            nb.put(t.outputs["Color"], bs.inputs["Emission Color"])
            nb.put(1.5 * float(book.get("glow", 1.0)), bs.inputs["Emission Strength"])
        mat.blend_method = "CLIP"
        kind = "image" if S.base_slot(slot) != "glyph" else "paint"
    else:
        ref = fin if fin.startswith("pbr/") else T.ref_of(fin)
        d, meta = T.maps(ref) if fin != "plain" else (None, None)
        kind = fin
        if meta is None:                                          # plain: the colour and the slot's numbers
            st = S.SLOTS.get(S.base_slot(slot), ("#999999", 0.7, 0.0, ""))
            nb.put(col, bs.inputs["Base Color"])
            nb.put(st[1], bs.inputs["Roughness"])
            nb.put(st[2], bs.inputs["Metallic"])
            kind = "plain"
        else:
            su, sv = T.size_of(meta)
            mp = nb.node("ShaderNodeMapping")
            nb.put(uv, mp.inputs["Vector"])
            mp.inputs["Scale"].default_value = (1.0 / su, 1.0 / sv, 1.0)
            ta = nb.node("ShaderNodeTexImage", image=_img(d / meta["maps"]["albedo"]))
            nb.put(mp.outputs[0], ta.inputs["Vector"])
            tint = meta.get("tint", False) or not fin.startswith("pbr/")
            base = nb.mix(1.0, ta.outputs["Color"], col, "MULTIPLY") if tint else ta.outputs["Color"]
            nb.put(base, bs.inputs["Base Color"])
            if fin == "paint":
                nb.put(nb.math("ROUND", ta.outputs["Alpha"]), bs.inputs["Alpha"])
                mat.blend_method = "CLIP"
            orm = meta.get("orm")
            if orm:
                to = nb.node("ShaderNodeTexImage", image=_img(d / orm, False))
                nb.put(mp.outputs[0], to.inputs["Vector"])
                _, r, m = nb.sepc(to.outputs["Color"])
                nb.put(r, bs.inputs["Roughness"])
                nb.put(m, bs.inputs["Metallic"])
            else:
                if "rough" in meta["maps"]:
                    tr = nb.node("ShaderNodeTexImage", image=_img(d / meta["maps"]["rough"], False))
                    nb.put(mp.outputs[0], tr.inputs["Vector"])
                    nb.put(tr.outputs["Color"], bs.inputs["Roughness"])
            if "normal" in meta["maps"]:
                tn = nb.node("ShaderNodeTexImage", image=_img(d / meta["maps"]["normal"], False))
                nb.put(mp.outputs[0], tn.inputs["Vector"])
                nm = nb.node("ShaderNodeNormalMap", space="TANGENT", uv_map="UVMap")
                nb.put(tn.outputs["Color"], nm.inputs["Color"])
                nb.put(nm.outputs[0], bs.inputs["Normal"])
            if fin == "glass":
                nb.put(0.5, bs.inputs["Specular IOR Level"])
    # the street's wear atlas: the occlusion on UV2, the rest for the plugin
    tw = nb.node("ShaderNodeTexImage", image=wear_img, extension="EXTEND")
    nb.put(nb.uv("Wear"), tw.inputs["Vector"])
    ao, _, _ = nb.sepc(tw.outputs["Color"])
    go = gltf_output(nb)
    nb.put(ao, go.inputs["Occlusion"])
    mat["hs_wear"] = wear_params(kind if kind in F.WEAR else "plain", book)
    return kind


def fix_roof_uvs(objs, roof_mats):
    """On a roof whose +u runs down its slope, u and v swapped: a roof set's ribs run down every face."""
    n = 0
    for o in objs:
        me = o.data
        uvl = me.uv_layers.get("UVMap")
        if not uvl:
            continue
        idx = [i for i, m in enumerate(me.materials) if m and m.name in roof_mats]
        if not idx:
            continue
        for p in me.polygons:
            if p.material_index not in idx or len(p.loop_indices) < 3:
                continue
            L = list(p.loop_indices)
            P = [o.matrix_world @ me.vertices[me.loops[l].vertex_index].co for l in L[:3]]
            U = [uvl.data[l].uv.copy() for l in L[:3]]
            e1, e2 = P[1] - P[0], P[2] - P[0]
            du1, dv1 = U[1][0] - U[0][0], U[1][1] - U[0][1]
            du2, dv2 = U[2][0] - U[0][0], U[2][1] - U[0][1]
            det = du1 * dv2 - du2 * dv1
            if abs(det) < 1e-12:
                continue
            tu = (e1 * dv2 - e2 * dv1) / det                # where +u runs on the face
            if tu.length > 1e-9 and abs(tu.normalized().z) > 0.2:
                for l in L:
                    u, v = uvl.data[l].uv
                    uvl.data[l].uv = (v, u)
                n += 1
    return n


def glyph_images(objs, infos, out_dir, px=512, samples=4):
    """Each road letter's own picture with the paint's wear baked in (glTF can't multiply two maps): {material: image}."""
    kept = {}
    sc = bpy.context.scene
    sc.cycles.samples = samples
    for o in objs:
        for s in o.material_slots:
            m = s.material
            if not m or m.name in kept or S.base_slot(infos.get(m.name, {}).get("slot", "")) != "glyph":
                continue
            img = bpy.data.images.new(f"glyph_{len(kept)}", px, px, alpha=True)
            em = m.node_tree.nodes
            # bake the look's colour and alpha through UVMap (the letters fill 0..1)
            nb = NB(m.node_tree)
            t = nb.node("ShaderNodeTexImage", image=img)
            m.node_tree.nodes.active = t
            bs = next(n for n in em if n.type == "BSDF_PRINCIPLED")
            outn = next(n for n in em if n.type == "OUTPUT_MATERIAL")
            emn = nb.node("ShaderNodeEmission")
            nb.put(bs.inputs["Base Color"].links[0].from_socket if bs.inputs["Base Color"].is_linked else bs.inputs["Base Color"].default_value, emn.inputs["Color"])
            old = outn.inputs["Surface"].links[0].from_socket
            m.node_tree.links.new(emn.outputs[0], outn.inputs["Surface"])
            for oo in sc.objects:
                oo.select_set(False)
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            o.data.uv_layers.active = o.data.uv_layers["UVMap"]
            bpy.ops.object.bake(type="EMIT", margin=2, use_clear=True, uv_layer="UVMap")
            col = np.empty(px * px * 4, np.float32)
            img.pixels.foreach_get(col)
            # the alpha: emit it as a colour and bake again
            a_src = bs.inputs["Alpha"].links[0].from_socket if bs.inputs["Alpha"].is_linked else None
            if a_src is not None:
                nb.put(a_src, emn.inputs["Color"])
                bpy.ops.object.bake(type="EMIT", margin=2, use_clear=True, uv_layer="UVMap")
                al = np.empty(px * px * 4, np.float32)
                img.pixels.foreach_get(al)
                col = col.reshape(-1, 4)
                col[:, 3] = al.reshape(-1, 4)[:, 0]
            img.pixels.foreach_set(np.clip(col, 0, 1).ravel())
            m.node_tree.links.new(old, outn.inputs["Surface"])
            m.node_tree.nodes.remove(t)
            m.node_tree.nodes.remove(emn)
            img.filepath_raw = str(Path(out_dir) / f"{bpy.path.clean_name(m.name)}.png")
            img.file_format = "PNG"
            img.save()
            kept[m.name] = img
    return kept


def lamps_for_export():
    """The lamps back to what came in (the look turned them up to render)."""
    for o in bpy.data.objects:
        if o.type == "LIGHT" and "glb_energy" in o:
            o.data.energy = o["glb_energy"]
            o.data.color = o["glb_colour"]
            del o["glb_energy"], o["glb_colour"]


def tidy_uvs(objs):
    """UVMap and Wear only, in that order: TEXCOORD_0 the metres, TEXCOORD_1 the wear atlas."""
    for o in objs:
        uvs = o.data.uv_layers
        for l in [l for l in uvs if l.name not in ("UVMap", "Wear")]:
            uvs.remove(l)
        if "UVMap" in uvs:
            uvs.active = uvs["UVMap"]
            uvs["UVMap"].active_render = True


def export_glb(path):
    for o in [o for o in bpy.data.objects if o.type == "LIGHT" and o.data.type == "SUN" and "glb_energy" not in o]:
        bpy.data.objects.remove(o)                      # the look's sun: Godot's light is set by hand there (DECISIONS 2026-10-30)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_extras=True, export_lights=True,
                              export_import_convert_lighting_mode="RAW", export_yup=True, export_apply=False,
                              export_texcoords=True, export_normals=True, export_materials="EXPORT",
                              export_image_format="AUTO", use_selection=False, use_visible=False, use_renderable=False)


def report(path):
    """What the .glb says (its JSON chunk): materials, textures, extras, the second UVs, colliders, lamps."""
    import struct
    b = Path(path).read_bytes()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    mats = j.get("materials", [])
    nodes = j.get("nodes", [])
    return {"materials": len(mats), "textures": len(j.get("textures", [])), "images": len(j.get("images", [])),
            "with_wear": sum(1 for m in mats if (m.get("extras") or {}).get("hs_wear")),
            "occlusion_uv2": sum(1 for m in mats if (m.get("occlusionTexture") or {}).get("texCoord") == 1),
            "tiling": sum(1 for m in mats if "KHR_texture_transform" in json.dumps(m)),
            "colliders": sum(1 for x in nodes if x.get("name", "").endswith("-colonly")),
            "occluders": sum(1 for x in nodes if x.get("name", "").endswith("-occonly")),
            "lamps": len(((j.get("extensions") or {}).get("KHR_lights_punctual") or {}).get("lights", [])),
            "insides": sum(1 for x in nodes if x.get("name", "").startswith("inside_")),
            "bytes": len(b)}
