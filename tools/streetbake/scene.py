"""The street's .glb in Blender: imported and sorted into collections (what's drawn, what's bumped into, the
occluders, the lamps, where each inside goes), its materials rebuilt as finishes with the wear, a shot's camera, the
dusk and the lamps. Blender's space is the street's (x east, y north, z up): the glTF importer undoes three's turn."""
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

from . import finishes as F
from .nodes import NB, srgb

ROOT = Path(__file__).resolve().parents[2]


def slot_table():
    """The street generator's slots {name: (colour, roughness, metalness, flag)} read from street-gen.js."""
    src = (ROOT / "tools" / "director" / "street-gen.js").read_text(encoding="utf-8")
    body = src[src.index("export const SLOTS = {"):src.index("};", src.index("export const SLOTS = {"))]
    out = {}
    for m in re.finditer(r'(\w+): \["(#[0-9a-fA-F]{6})", ([\d.]+)(?:, ([\d.]+))?(?:, "(\w)")?\]', body):
        out[m.group(1)] = (m.group(2), float(m.group(3)), float(m.group(4) or 0), m.group(5) or "")
    return out


SLOTS = slot_table()


def parse(name):
    """'street_wall_dcb4a6' -> ('wall', '#dcb4a6'); 'street_sign:far_5f.0' -> ('sign:far_5f.0', None)."""
    s = name[len("street_"):] if name.startswith("street_") else name
    m = re.match(r"^(.*?)_+([0-9a-f]{6})$", s)
    if m and ":" not in s:
        return m.group(1), "#" + m.group(2)
    return s, None


def base_slot(slot):
    if slot.startswith("glyph:"):
        return "glyph"
    if slot.startswith("decal:"):
        return "decal"
    if slot.startswith(("sign:", "tsign:")):
        return "sign"
    return slot


# ---- import --------------------------------------------------------------------------------------------------------

def load(glb):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb), export_import_convert_lighting_mode="RAW")
    for o in bpy.data.objects:                          # what the lamps came in as, for the way out
        if o.type == "LIGHT":
            o["glb_energy"] = o.data.energy
            o["glb_colour"] = list(o.data.color)
    cols = {}
    for nm in ("Street", "Collision", "Occluders", "Lamps", "Insides", "Foliage"):
        c = bpy.data.collections.new(nm)
        bpy.context.scene.collection.children.link(c)
        cols[nm] = c
    vis = []
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name.endswith("-colonly"):
            to = "Collision"
        elif o.type == "MESH" and o.name.endswith("-occonly"):
            to = "Occluders"
        elif o.type == "LIGHT":
            to = "Lamps"
        elif o.type == "MESH":
            to = "Street"
            vis.append(o)
        elif o.parent and o.parent.name == "insides":
            to = "Insides"
        else:
            to = "Street"
        for c in list(o.users_collection):
            c.objects.unlink(o)
        cols[to].objects.link(o)
    for nm in ("Collision", "Occluders"):
        cols[nm].hide_render = True
        for o in cols[nm].objects:
            o.hide_render = True
            o.display_type = "WIRE"
    return vis, cols


# ---- materials -----------------------------------------------------------------------------------------------------

_REFS = []


def pbr_ref(name):
    """A surface the street put a shelf set on (a piece's or the street's `look`, the paint page): its material's name
    carries the set ('street_wall_pbr_Procedural_jp_tile45_white') -> (the slot, 'pbr/Procedural/jp_tile45_white')."""
    s, _ = parse(name)                                  # its colour's suffix off (a vertex-coloured material's)
    i = s.find("_pbr_")
    if i < 0:
        return None
    m = re.match(r"^_pbr_+made_([0-9a-f]{12})$", s[i:])   # a tuned look's made set (storykit/pbrmix.py; the export writes pbr/_made/<hash> as _pbr_made_<hash>)
    if m:
        return s[:i], f"pbr/_made/{m.group(1)}"
    if not _REFS:
        sys.path.insert(0, str(ROOT / "Content" / "Python"))
        from storykit import pbr as PBR  # noqa: PLC0415
        _REFS.extend(PBR.scan(write=False))
    flat = s[i + 1:]
    for ref in _REFS:
        if re.sub(r"[^a-z0-9]+", "_", ref, flags=re.I) == flat:
            return s[:i], ref
    return None


def wear_kind(fin, slot):
    """The wear recipe a surface takes: its finish's, or for a set off the shelf its slot's (asphalt wears as asphalt,
    a wall as render)."""
    if fin in F.WEAR:
        return fin
    if fin.startswith("pbr/"):
        k = F.SLOT_FINISH.get(base_slot(slot), "render")
        return k if k in F.WEAR else "render"
    return "plain"


def wear_amount(fin, book):
    """The street's wear amounts ({dirt, streaks, edges, wet}), times a tuned look's own (its wear layers)."""
    amount = dict(book.get("wear") or {})
    if fin.startswith("pbr/_made/"):
        from . import tiles as T
        mine = (T.maps(fin)[1] or {}).get("wear") or {}
        for k, v in mine.items():
            amount[k] = amount.get(k, 1.0) * float(v)
    return amount


def finish_of(name, book):
    slot, _ = parse(name)
    b = base_slot(slot)
    over = (book.get("finishes") or {})
    if name in over:
        return over[name]
    if slot in over:
        return over[slot]
    pr = pbr_ref(name)                                  # a set painted on it in the street
    if pr:
        return pr[1]
    if b in ("sign", "glyph", "decal") or b in F.KEEP_IMAGE:
        return "image"
    return F.SLOT_FINISH.get(b, "plain")


def decal_info(slot):
    """A decal's shine from the decals' catalogue (assets/decals/decals.json)."""
    try:
        cat = json.loads((ROOT / "assets" / "decals" / "decals.json").read_text(encoding="utf-8"))["decals"]
        return cat.get(slot.split(":", 1)[1], {})
    except (OSError, ValueError, KeyError, IndexError):
        return {}


def _image_of(mat):
    """The picture an imported material carries, with its UV transform (scale, offset), if any."""
    if not mat.use_nodes:
        return None
    img, mp = None, None
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            img = n.image
        if n.type == "MAPPING":
            mp = (tuple(n.inputs["Location"].default_value), tuple(n.inputs["Rotation"].default_value), tuple(n.inputs["Scale"].default_value))
    return (img, mp) if img else None


def _colour_of(mat, slot):
    _, hx = parse(mat.name)
    if hx:
        return srgb(hx)
    p = mat.node_tree.nodes.get("Principled BSDF") if mat.use_nodes else None
    if p and not p.inputs["Base Color"].is_linked:
        return tuple(p.inputs["Base Color"].default_value)
    s = SLOTS.get(base_slot(slot))
    return srgb(s[0]) if s else (0.6, 0.6, 0.6, 1.0)


def _emits(mat):
    p = mat.node_tree.nodes.get("Principled BSDF") if mat.use_nodes else None
    return bool(p) and (p.inputs["Emission Color"].is_linked or (p.inputs["Emission Strength"].default_value > 0 and max(p.inputs["Emission Color"].default_value[:3]) > 0.01))


INFO = {}                                               # what each material was, for the export


def rebuild(mat, book, wear_img):
    """The imported material made again as its finish under the wear, in place (the meshes keep their slots)."""
    slot, _ = parse(mat.name)
    vc = next((n.layer_name for n in mat.node_tree.nodes if n.type == "VERTEX_COLOR"), None) if mat.use_nodes else None
    b = base_slot(slot)
    fin = finish_of(mat.name, book)
    col = _colour_of(mat, slot)
    picture = _image_of(mat)
    emits = _emits(mat)
    INFO[mat.name] = {"finish": fin, "colour": col, "picture": picture, "emits": emits, "slot": slot}
    st = SLOTS.get(b, ("#999999", 0.7, 0.0, ""))
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    nb = NB(nt)
    out = nb.node("ShaderNodeOutputMaterial")
    bs = nb.node("ShaderNodeBsdfPrincipled")
    nt.links.new(bs.outputs[0], out.inputs["Surface"])
    uv = nb.uv("UVMap")
    pnrm = None                                         # a shelf set's normal map, when it has one
    W = F.WEAR[wear_kind(fin, slot)]
    amount = wear_amount(fin, book)
    if fin == "glow":
        c = col
        if vc:                                # the windows' own colours (lit or not), on the vertices
            c = nb.mix(1.0, col, nb.attr(vc, "Color"), "MULTIPLY")
        rnd = nb.geo("Random Per Island")
        var = nb.mul(nb.madd(rnd, 0.7, 0.55), nb.madd(nb.noise(nb.geo("Position"), 0.8, 2), 0.5, 0.75))
        nb.put(nb.cmul(c, 0.25), bs.inputs["Base Color"])
        nb.put(nb.cmul(c, var), bs.inputs["Emission Color"])
        nb.put(F.GLOW.get(b, 3.0) * float(book.get("glow", 1.0)), bs.inputs["Emission Strength"])
        nb.put(0.3, bs.inputs["Roughness"])
        return fin
    if fin == "image" and picture:
        img, mp = picture
        at = uv
        if mp:
            m = nb.node("ShaderNodeMapping")
            nb.put(uv, m.inputs["Vector"])
            m.inputs["Location"].default_value, m.inputs["Rotation"].default_value, m.inputs["Scale"].default_value = mp
            at = m.outputs[0]
        t = nb.node("ShaderNodeTexImage", image=img, interpolation="Linear")
        nb.put(at, t.inputs["Vector"])
        base = nb.mix(1.0, t.outputs["Color"], col, "MULTIPLY") if b in F.KEEP_IMAGE else t.outputs["Color"]
        alpha = t.outputs["Alpha"]
        rough, height, metal = st[1], 0.0, st[2]
        if b == "decal":                      # a decal: its catalogue's shine (a puddle's wet, a manhole's iron)
            di = decal_info(slot)
            rough, metal = di.get("rough") if di.get("rough") is not None else 0.85, di.get("metal") or 0.0
        if b == "glyph":                      # road letters: worn like paint, the road through the holes
            g = nb.group(F.finish_group("paint"), UV=uv, Color=(1, 1, 1, 1))
            base = nb.mix(1.0, base, g.outputs["Color"], "MULTIPLY")
            alpha = nb.mul(alpha, g.outputs["Alpha"])
            rough, height = g.outputs["Roughness"], g.outputs["Height"]
            W = F.WEAR["paint"]
        if emits:
            nb.put(t.outputs["Color"], bs.inputs["Emission Color"])
            nb.put(1.5 * float(book.get("glow", 1.0)), bs.inputs["Emission Strength"])
    else:
        if fin == "image":
            fin = "plain"
            INFO[mat.name]["finish"] = "plain"
        if fin.startswith("pbr/"):
            g = pbr_group(fin, nb, uv, col)
            pnrm = pbr_normal(fin, nb, uv)        # its normal map: the relief it was made with
            fin = "render"
        else:
            g = nb.group(F.finish_group(fin), UV=uv, Color=col)
        base, alpha = g.outputs["Color"], g.outputs["Alpha"]
        rough, height, metal = g.outputs["Roughness"], g.outputs["Height"], g.outputs["Metallic"]
        if fin == "plain":
            rough, metal = st[1], st[2]
    wg = F.wear_group(wear_img)
    dc, d = W["dirt"]
    sc, s = W["streak"]
    ec, e = W["edge"]
    w = nb.group(wg, Color=base, Roughness=rough, DirtColor=srgb(dc), Dirt=d * amount.get("dirt", 1.0),
                 StreakColor=srgb(sc), Streaks=s * amount.get("streaks", 1.0),
                 EdgeColor=srgb(ec) if ec != "lighter" else (0.9, 0.9, 0.9, 1), EdgeLighter=1.0 if ec == "lighter" else 0.0,
                 Edges=e * amount.get("edges", 1.0), Wet=W["wet"] * amount.get("wet", 1.0), Tone=W["tone"])
    nb.put(w.outputs["Color"], bs.inputs["Base Color"])
    nb.put(w.outputs["Roughness"], bs.inputs["Roughness"])
    nb.put(metal, bs.inputs["Metallic"])
    if pnrm is not None:
        nb.put(pnrm, bs.inputs["Normal"])
    elif not isinstance(height, (int, float)):
        bump = nb.node("ShaderNodeBump")
        nb.put(0.6, bump.inputs["Strength"])
        nb.put(0.004, bump.inputs["Distance"])
        nb.put(height, bump.inputs["Height"])
        nb.put(bump.outputs[0], bs.inputs["Normal"])
    nb.put(alpha, bs.inputs["Alpha"])
    if fin == "glass":
        nb.put(0.5, bs.inputs["Specular IOR Level"])
        nb.put(1.52, bs.inputs["IOR"])
    if not isinstance(alpha, (int, float)):
        mat.blend_method = "HASHED"
    return fin


def pbr_group(ref, nb, uv, col):
    """A set of your own off the shelf in place of a finish: a node with the finish group's outputs."""
    from . import tiles as T
    d, meta = T.maps(ref)
    if meta is None:
        raise SystemExit(f"no PBR set {ref} on the shelf (python tools/pbr.py list)")
    su, sv = T.size_of(meta)
    ng = bpy.data.node_groups.get("Set " + ref)
    if not ng:
        from .nodes import group
        ng, gb, gi, go = group("Set " + ref, *F.GROUP_IO)
        mp = gb.node("ShaderNodeMapping")
        gb.put(gi.outputs["UV"], mp.inputs["Vector"])
        mp.inputs["Scale"].default_value = (1.0 / su, 1.0 / sv, 1.0)
        def tex(k, colour):
            im = bpy.data.images.load(str(d / meta["maps"][k]), check_existing=True)
            im.colorspace_settings.name = "sRGB" if colour else "Non-Color"
            t = gb.node("ShaderNodeTexImage", image=im)
            gb.put(mp.outputs[0], t.inputs["Vector"])
            return t
        ta = tex("albedo", True)
        c = gb.mix(1.0, ta.outputs["Color"], gi.outputs["Color"], "MULTIPLY") if meta.get("tint") else ta.outputs["Color"]
        gb.put(c, go.inputs["Color"])
        gb.put(ta.outputs["Alpha"], go.inputs["Alpha"])
        gb.put(tex("rough", False).outputs["Color"] if "rough" in meta["maps"] else 0.8, go.inputs["Roughness"])
        gb.put(tex("height", False).outputs["Color"] if "height" in meta["maps"] else 0.0, go.inputs["Height"])
        gb.put(tex("metal", False).outputs["Color"] if "metal" in meta["maps"] else 0.0, go.inputs["Metallic"])
    return nb.group(ng, UV=uv, Color=col)


def pbr_normal(ref, nb, uv):
    """A shelf set's normal map at its size, as a normal for the BSDF (None if it has none)."""
    from . import tiles as T
    d, meta = T.maps(ref)
    if not meta or "normal" not in meta.get("maps", {}):
        return None
    su, sv = T.size_of(meta)
    mp = nb.node("ShaderNodeMapping")
    nb.put(uv, mp.inputs["Vector"])
    mp.inputs["Scale"].default_value = (1.0 / su, 1.0 / sv, 1.0)
    im = bpy.data.images.load(str(d / meta["maps"]["normal"]), check_existing=True)
    im.colorspace_settings.name = "Non-Color"
    t = nb.node("ShaderNodeTexImage", image=im)
    nb.put(mp.outputs[0], t.inputs["Vector"])
    nm = nb.node("ShaderNodeNormalMap", uv_map="UVMap")
    nb.put(t.outputs["Color"], nm.inputs["Color"])
    if meta.get("normal") == "dx":                      # a DirectX normal: its green the other way
        sep = nb.sepc(t.outputs["Color"])
        nb.put(nb.node("ShaderNodeCombineColor").outputs[0], nm.inputs["Color"])
        cc = nm.inputs["Color"].links[0].from_node
        nb.put(sep[0], cc.inputs[0]); nb.put(nb.one_minus(sep[1]), cc.inputs[1]); nb.put(sep[2], cc.inputs[2])
    return nm.outputs["Normal"]


# ---- the camera, the dusk, the lamps -------------------------------------------------------------------------------

def camera(shot, height):
    a = shot["aspect"][0] / shot["aspect"][1] if isinstance(shot.get("aspect"), list) else 16 / 9
    sc = bpy.context.scene
    sc.render.resolution_y = int(height)
    sc.render.resolution_x = int(round(height * a))
    sc.render.resolution_percentage = 100
    cd = bpy.data.cameras.new("shot")
    cd.sensor_fit = "VERTICAL"
    cd.angle_y = math.radians(shot.get("vfov", 60))
    cd.clip_start, cd.clip_end = 0.05, 2000
    cam = bpy.data.objects.new("shot_" + shot.get("id", "camera"), cd)
    sc.collection.objects.link(cam)
    eye, look = Vector(shot["eye"]), Vector(shot["look"])
    cam.location = eye
    cam.rotation_euler = (look - eye).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    return cam


TIME = {
    # zenith, horizon, under, strength; the lamps' watts and colour
    "dusk": ("#5d7fa3", "#d8c6cc", "#2a2a30", 2.2, 30.0, "#ffd9b0"),
    "night": ("#0b1424", "#1c2a44", "#08080a", 0.25, 60.0, "#ffd2a0"),
    "day": ("#6fa3d8", "#dfe8ee", "#5a5a58", 1.4, 0.0, "#ffffff"),
}


# the physical sky (Blender's Nishita) for a time of day: the sun's elevation and turn (degrees), the sky's strength,
# the air, dust and ozone, the sun as a light (its strength, colour, the disc's angle); research/photoreal.md §3: the
# sky's soft light and its bounce are most of a lane's realism. Night keeps the gradient (no sun to model)
SKY = {
    "dusk": dict(elev=1.5, rot=0.0, strength=0.5, air=1.3, dust=3.5, ozone=1.2, sun=0.06, sun_col="#ffb27a", angle=1.5),
    "day": dict(elev=38.0, rot=215.0, strength=0.22, air=1.0, dust=1.5, ozone=1.0, sun=4.0, sun_col="#fff2e0", angle=0.6),
}


def _nishita():
    try:
        t = bpy.data.node_groups.new("_probe", "ShaderNodeTree")
        ok = "NISHITA" in [i.identifier for i in t.nodes.new("ShaderNodeTexSky").bl_rna.properties["sky_type"].enum_items]
        bpy.data.node_groups.remove(t)
        return ok
    except Exception:  # noqa: BLE001 - an older or newer Blender: the gradient
        return False


def world(time="dusk"):
    z, h, u, s, _, _ = TIME.get(time, TIME["dusk"])
    w = bpy.data.worlds.new("street_" + time)
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    nb = NB(nt)
    out = nb.node("ShaderNodeOutputWorld")
    bg = nb.node("ShaderNodeBackground")
    k = SKY.get(time)
    if k and _nishita():
        sky = nb.node("ShaderNodeTexSky", sky_type="NISHITA")
        sky.sun_disc = False                            # the sun is a light of its own: sampled cleanly
        sky.sun_elevation, sky.sun_rotation = math.radians(k["elev"]), math.radians(k["rot"])
        sky.air_density, sky.dust_density, sky.ozone_density = k["air"], k["dust"], k["ozone"]
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
        nb.put(k["strength"], bg.inputs["Strength"])
        nt.links.new(bg.outputs[0], out.inputs["Surface"])
        sun = bpy.data.lights.new("sun_" + time, "SUN")
        sun.energy, sun.color, sun.angle = k["sun"], srgb(k["sun_col"])[:3], math.radians(k["angle"])
        so = bpy.data.objects.new("sun_" + time, sun)
        bpy.context.scene.collection.objects.link(so)
        el, az = math.radians(k["elev"]), math.radians(k["rot"])
        so.rotation_euler = (math.pi / 2 - el, 0.0, az + math.pi / 2)   # its light along the sky's own sun
        return
    d = nb.vmath("NORMALIZE", nb.node("ShaderNodeTexCoord").outputs["Generated"])
    _, _, dz = nb.sep(d)
    sky = nb.mix(nb.ramp(dz, 0.0, 0.55), srgb(h), srgb(z))
    c = nb.mix(nb.ramp(dz, -0.02, 0.02), srgb(u), sky)
    nb.put(c, bg.inputs["Color"])
    nb.put(s, bg.inputs["Strength"])
    nt.links.new(bg.outputs[0], out.inputs["Surface"])


def lamps(time="dusk"):
    _, _, _, _, watts, colour = TIME.get(time, TIME["dusk"])
    for o in bpy.data.objects:
        if o.type == "LIGHT" and o.data.type != "SUN":                # the street's lamps (the sky's sun is its own)
            o.data.energy = watts
            o.data.shadow_soft_size = 0.06
            if o.name.startswith("lamp_vending"):
                o.data.energy = watts * 0.35
                o.data.color = srgb("#e8f0ff")[:3]
            else:
                o.data.color = srgb(colour)[:3]


def render_settings(samples, threads=0):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 6
    sc.cycles.glossy_bounces = 3
    sc.cycles.transparent_max_bounces = 12
    sc.cycles.use_adaptive_sampling = True
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = 0.0
    if threads:
        sc.render.threads_mode = "FIXED"
        sc.render.threads = threads


def load_book(path):
    return json.loads(Path(path).read_text(encoding="utf-8")) if path and Path(path).is_file() else {}
