"""A Character Studio character in Unreal (docs/UNREAL_FLOW.md §1d, docs/CHARACTER_STUDIO.md §3.1).

The Studio's export, `Content/Studio/People/<name>/export/<name>.glb` (neutral, rigged on MHR's skeleton, every part
skinned on it, the eyes on `l_eye` and `r_eye`), comes in as one skeletal mesh in `/Game/Studio/Imported/People/<name>/v<hash>`
(a folder per version of the file: an unchanged character isn't imported again, a changed one never replaces an asset
a map still uses). Its eyes get **M_StudioEye**, the Studio's eye (tools/shared/eye.js) as an Unreal material: the
eye's point read back from its flat layout (uv = 0.5 + 0.5 xy, the eyeball's radius 1), the view brought into the
eye's own frame from the tangent space the Studio wrote (the eye's X along the surface), bent at the cornea's dome by
Snell's law onto the iris's plane, and the iris read there from the paint the file carries baked flat; the white read
where it is; the cornea a clear coat, the iris without a shine of its own. The shape and the paint's numbers come from
the eye material's `extras.studioEye`.

Plain Python down to the editor's part, so `node tools/character/ueeye.mjs` (UEEYE) reads the files and runs the
material's HLSL as GLSL against a ray traced through the dome, without an editor (and compiles it with DXC when
`DXC` is set). In the editor (or by Generate: a cast member whose previs_body is people/<name> goes across as that
character):

    import storykit.people as p; p.import_character("Mari")

Written blind (no editor in the session that wrote it): the first time it runs, check the log and a close-up of an
eye from the front and from above, and fix this file where the engine disagrees (UNREAL_FLOW §1d says what to look
for: the iris sliding the wrong way when seen from above or below is `Handed`, a picture upside down `FlipV`).
"""
import hashlib
import json
import struct

from . import storylib as L

PEOPLE = L.STUDIO / "People"                       # the Studio's characters (git-ignored: each stays on its machine)
DEST = "/Game/Studio/Imported/People"               # shared by every game (a character may play in several); not /Game/Studio/People: that is the Studio's own folder on disk
MATERIALS = "/Game/Studio/Materials"
EYE_MATERIAL = f"{MATERIALS}/M_StudioEye"
SKIN_MATERIAL = f"{MATERIALS}/M_StudioSkin"
SKIN_PROFILE = f"{MATERIALS}/SP_StudioSkin"

# M_StudioSkin's scalar parameters and their defaults; a character's instance sets them from its skin's studioSkin
# (skin_params()). The Studio lights its skin after HumanShaders (tools/shared/skinlight.js); Unreal has the real
# thing, a Subsurface Profile, so the numbers are translated, not copied: Specular from the skin's (f0 = 0.04 s², its
# two highlights about twice one), the subsurface amount from its smoothness, more of it where the skin is thin
SKIN_PARAMS = [("Specular", 0.25), ("RoughScale", 1.0), ("Subsurface", 0.85), ("ThinBoost", 0.15)]
SKIN_VERSION = hashlib.sha1(f"{SKIN_PARAMS}skin-1".encode("utf-8")).hexdigest()[:10]

# M_StudioEye's scalar parameters and their defaults (eye units: the eyeball's radius is 1); a character's instance
# sets them from its eyes' studioEye (params()). Handed and FlipV are the engine's conventions, not the character's.
EYE_PARAMS = [
    ("Rho", 0.5),                  # the limbus's radius (the cornea's edge)
    ("LimbusPlane", 0.866),        # where the cornea meets the white, along the eye's axis
    ("DomeCentre", 0.4),           # the cornea's sphere: its centre along the axis and its radius
    ("DomeRadius", 0.65),
    ("IrisPlane", 0.85),           # the iris's plane, behind the cornea
    ("IOR", 1.336),                # the aqueous humour's (1 bends nothing: the iris painted on the eyeball)
    ("IrisBright", 1.0),           # the iris lit through the cornea
    ("LimbusView", 0.5),           # the limbus darker seen from the side
    ("Limbal", 0.5),               # the paint's limbal ring and its width and softness (what the bake already holds
    ("LimbalWidth", 0.18),         # at a straight look; LimbusView adds to it at a slant)
    ("LimbalSoft", 0.6),
    ("Handed", 1.0),               # the tangent frame's handedness as the importer leaves it (+1 or -1)
    ("FlipV", 0.0),                # 1 if the importer flipped the texture coordinates' V
]
ROUGHNESS = [("Roughness", 0.094), ("ClearCoatRoughness", 0.036)]   # the white under the cornea; the cornea's wet coat
ENGINE = ("Handed", "FlipV")       # set once on M_StudioEye, never on a character's instance

# the eye's point, its surface's frame and the view in the eye's own frame, the view bent at the cornea onto the
# iris's plane (q) and how much of the iris is there (irisW): eye.js's map_fragment, from the flat layout and the
# tangent space instead of an attribute and the eye's axes. Written so it also runs as GLSL (ueeye.mjs): float
# literals only, no functions, no HLSL-only intrinsics
_FRAME = """
float fv = FlipV > 0.5 ? -1.0 : 1.0;
float2 xy = (UV - 0.5) * 2.0;
xy.y = xy.y * fv;
float r2 = dot(xy, xy);
bool onC = r2 < Rho * Rho;
float z = onC ? DomeCentre + sqrt(max(DomeRadius * DomeRadius - r2, 0.0)) : sqrt(max(1.0 - r2, 0.0));
float3 eP = float3(xy.x, xy.y, z);
float3 eN = onC ? normalize(eP - float3(0.0, 0.0, DomeCentre)) : normalize(eP);
float3 eT = float3(1.0 - eN.x * eN.x, -eN.x * eN.y, -eN.x * eN.z);
eT = dot(eT, eT) < 1e-8 ? float3(0.0, 0.0, eN.x > 0.0 ? -1.0 : 1.0) : normalize(eT);
float3 eB = cross(eN, eT) * Handed;
float3 eD = -normalize(Vt.x * eT + Vt.y * eB + Vt.z * eN);
float2 q = xy;
if (onC)
{
    float3 tr = refract(eD, eN, 1.0 / max(IOR, 1.0));
    q = xy + tr.xy * max(z - IrisPlane, 0.0) / max(-tr.z, 0.08);
}
float rq = length(q) / max(Rho, 0.0001);
float irisW = onC ? 1.0 - smoothstep(0.95, 1.08, rq) : 0.0;
"""

# the colour: the white where the point is (on the cornea, read just outside the limbus: the bake holds the iris
# there), the iris where the view lands on its plane, darker at its edge seen from the side; linear (the sampler
# undoes the texture's sRGB)
EYE_COLOR = _FRAME + """
float w = 0.03 + 0.24 * LimbalSoft;
float sl = max(length(xy), 0.0001);
float2 s = onC ? xy / sl * max(sl, Rho * (1.02 + 0.65 * w)) : xy;
float3 white = Texture2DSample(Paint, PaintSampler, float2(0.5 + 0.5 * s.x, 0.5 + 0.5 * s.y * fv)).rgb;
float3 iris = Texture2DSample(Paint, PaintSampler, float2(0.5 + 0.5 * q.x, 0.5 + 0.5 * q.y * fv)).rgb;
float graze = 1.0 - saturate(-eD.z);
float extra = saturate(Limbal * (1.0 + 1.5 * LimbusView * graze)) - saturate(Limbal);
iris = lerp(iris, float3(0.003, 0.0021, 0.0021), extra * smoothstep(1.0 - LimbalWidth - 0.3 * w, 1.0, rq));
return lerp(white, iris, irisW) * lerp(1.0, IrisBright, irisW);
"""

# how much of the iris is seen there: it has no shine of its own (the base layer's specular off under the cornea)
EYE_IRIS = _FRAME + """
return irisW;
"""

GRAPH = 1                                           # eye_material()'s graph: one more when it's built differently
EYE_VERSION = hashlib.sha1(f"{EYE_COLOR}{EYE_IRIS}{GRAPH}{EYE_PARAMS}{ROUGHNESS}".encode("utf-8")).hexdigest()[:10]   # rebuilt when any of it changes


# ---- the files (plain Python)

def export_path(name):
    return PEOPLE / name / "export" / f"{name}.glb"


def exported():
    """The characters with an Export for desk / Unreal on this machine."""
    return sorted(d.name for d in PEOPLE.iterdir() if d.is_dir() and not d.name.startswith(".") and export_path(d.name).is_file()) \
        if PEOPLE.is_dir() else []


def cast_people(story):
    """{cast id: character name} for the cast members whose previs_body is a Studio character (people/<name>)."""
    out = {}
    for cid, c in (story.get("cast") or {}).items():
        b = str(c.get("previs_body") or "")
        if b.startswith("people/") and b[7:] and "/" not in b[7:]:
            out[cid] = b[7:]
    return out


def read_glb(path):
    """(the glTF json, the binary chunk) of a .glb."""
    b = path.read_bytes()
    if b[:4] != b"glTF":
        raise ValueError(f"{path.name} isn't a binary glTF")
    n = struct.unpack_from("<I", b, 12)[0]
    gltf = json.loads(b[20:20 + n].decode("utf-8"))
    off, binary = 20 + n, b""
    if off + 8 <= len(b):
        size, kind = struct.unpack_from("<II", b, off)
        if kind == 0x004E4942:                      # "BIN"
            binary = b[off + 8:off + 8 + size]
    return gltf, binary


def _image(gltf, binary, tex_index):
    src = gltf["textures"][tex_index]["source"]
    img = gltf["images"][src]
    bv = gltf["bufferViews"][img["bufferView"]]
    start = bv.get("byteOffset", 0)
    return binary[start:start + bv["byteLength"]], img.get("mimeType", "image/png")


def eyes(path):
    """Each eye in an export: {side, material (the slot's name), record (studioEye: side, shape, paint), image (the
    paint baked flat, bytes), ext}."""
    gltf, binary = read_glb(path)
    out = []
    for m in gltf.get("materials", []):
        rec = (m.get("extras") or {}).get("studioEye")
        tex = ((m.get("pbrMetallicRoughness") or {}).get("baseColorTexture") or {}).get("index")
        if not rec or tex is None:
            continue
        data, mime = _image(gltf, binary, tex)
        out.append({"side": rec.get("side"), "material": m.get("name", ""), "record": rec, "image": data,
                    "ext": ".jpg" if "jpeg" in mime else ".png"})
    return sorted(out, key=lambda e: str(e["side"]))


def skin(path):
    """The skin in an export, if it carries one: {material (the slot's name), record (studioSkin: the light on it),
    color, normal, orm: (bytes, ext)}: the colour, the relief (a normal map in glTF's convention: +Y up the picture) and
    one map of R 1, G the roughness, B how thin the skin is (the file's metalness is 0, so its blue is free)."""
    gltf, binary = read_glb(path)
    for m in gltf.get("materials", []):
        rec = (m.get("extras") or {}).get("studioSkin")
        if not rec:
            continue
        pbr, out = m.get("pbrMetallicRoughness") or {}, {"material": m.get("name", ""), "record": rec}
        for k, ref in (("color", pbr.get("baseColorTexture")), ("normal", m.get("normalTexture")), ("orm", pbr.get("metallicRoughnessTexture"))):
            if ref and ref.get("index") is not None:
                data, mime = _image(gltf, binary, ref["index"])
                out[k] = (data, ".jpg" if "jpeg" in mime else ".png")
        return out
    return None


def skin_params(record):
    """M_StudioSkin's scalar parameters for a skin's studioSkin (skinlight.js's numbers in Unreal's words)."""
    s, out = float(record.get("spec", 0.5)), dict(SKIN_PARAMS)
    if record.get("on", 1):
        out["Specular"] = min(1.0, 0.5 * s * s * (2.0 if record.get("double", 1) else 1.0) / 0.5 * 0.5 + 0.125)
        out["Subsurface"] = min(1.0, 0.55 + 0.06 * float(record.get("smooth", 5)))
        out["ThinBoost"] = 0.2 * float(record.get("trans", 0.75))
    return {k: float(v) for k, v in out.items()}


def height(path, name=None):
    """The character's height in metres: its skin's (the node `<name>_skin`, else the first skinned mesh) from the
    floor to its top."""
    gltf, _ = read_glb(path)
    nodes = [n for n in gltf.get("nodes", []) if "mesh" in n]
    node = next((n for n in nodes if name and n.get("name") == f"{name}_skin"), None) or next((n for n in nodes if "skin" in n), None)
    if not node:
        return None
    acc = gltf["accessors"][gltf["meshes"][node["mesh"]]["primitives"][0]["attributes"]["POSITION"]]
    return float(acc["max"][1]) - float(acc["min"][1]) if "max" in acc and "min" in acc else None


def params(record):
    """M_StudioEye's scalar parameters for an eye's studioEye (eye.js's setUniforms and setEye, in the material's
    words). A painted eye (Refracting cornea off) bends nothing and isn't brightened."""
    s, p = record.get("shape") or {}, record.get("paint") or {}
    real = p.get("real", True) is not False
    gloss = float(p.get("gloss", 0.9))
    out = {k: v for k, v in EYE_PARAMS if k not in ENGINE}
    out.update({"Rho": s.get("rho", out["Rho"]), "LimbusPlane": s.get("zl", out["LimbusPlane"]),
                "DomeCentre": s.get("zc", out["DomeCentre"]), "DomeRadius": s.get("rc", out["DomeRadius"]),
                "IrisPlane": s.get("zi", out["IrisPlane"]),
                "IOR": max(1.0, float(p.get("ior", 1.336))) if real else 1.0,
                "IrisBright": float(p.get("irisBright", 1.0)) if real else 1.0,
                "LimbusView": float(p.get("limbusView", 0.0)), "Limbal": float(p.get("limbal", 0.5)),
                "LimbalWidth": float(p.get("limbalWidth", 0.18)), "LimbalSoft": float(p.get("limbalSoft", 0.0)),
                "Roughness": 0.4 - 0.34 * gloss, "ClearCoatRoughness": 0.18 - 0.16 * gloss})
    return {k: float(v) for k, v in out.items()}


def version(path):
    return hashlib.sha1(path.read_bytes()).hexdigest()[:10]


# ---- in the editor

def _unreal():
    import unreal  # noqa: PLC0415 - only inside the editor
    return unreal


def eye_material(rebuild=False):
    """M_StudioEye, made from the text above the first time (and again when the code changes: its version is a tag
    on the asset). Clear Coat: the base colour and the iris from two Custom nodes, the white's roughness under the
    cornea's coat, no specular of the base layer on the iris."""
    unreal = _unreal()
    EAL, MEL = unreal.EditorAssetLibrary, unreal.MaterialEditingLibrary
    if EAL.does_asset_exist(EYE_MATERIAL) and not rebuild:
        mat = unreal.load_asset(EYE_MATERIAL)
        if EAL.get_metadata_tag(mat, "StudioEyeVersion") == EYE_VERSION:
            return mat
    if EAL.does_asset_exist(EYE_MATERIAL):
        mat = unreal.load_asset(EYE_MATERIAL)
        MEL.delete_all_material_expressions(mat)
    else:
        mat = unreal.AssetToolsHelpers.get_asset_tools().create_asset("M_StudioEye", MATERIALS, unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_CLEAR_COAT)
    mat.set_editor_property("used_with_skeletal_mesh", True)                 # on a character (an automated run doesn't set it itself)
    make = lambda cls, x, y: MEL.create_material_expression(mat, cls, x, y)  # noqa: E731

    uv = make(unreal.MaterialExpressionTextureCoordinate, -1300, -400)
    cam = make(unreal.MaterialExpressionCameraVectorWS, -1500, -300)
    to_tangent = make(unreal.MaterialExpressionTransform, -1300, -300)       # the camera vector in the surface's tangent space
    to_tangent.set_editor_property("transform_source_type", unreal.MaterialVectorCoordTransformSource.TRANSFORMSOURCE_WORLD)
    to_tangent.set_editor_property("transform_type", unreal.MaterialVectorCoordTransform.TRANSFORM_TANGENT)
    MEL.connect_material_expressions(cam, "", to_tangent, "")
    paint = make(unreal.MaterialExpressionTextureObjectParameter, -1300, -200)
    paint.set_editor_property("parameter_name", "Paint")
    grey = unreal.load_asset("/Engine/EngineResources/DefaultTexture")
    if grey:
        paint.set_editor_property("texture", grey)
    scalars = {}
    for k, (n, d) in enumerate(EYE_PARAMS + ROUGHNESS):
        x = make(unreal.MaterialExpressionScalarParameter, -1300, -100 + k * 60)
        x.set_editor_property("parameter_name", n)
        x.set_editor_property("default_value", float(d))
        scalars[n] = x

    def custom(code, name, out3, y, texture):
        c = make(unreal.MaterialExpressionCustom, -700, y)
        c.set_editor_property("code", code)
        c.set_editor_property("description", f"{name} {EYE_VERSION}")
        c.set_editor_property("output_type", unreal.CustomMaterialOutputType.CMOT_FLOAT3 if out3 else unreal.CustomMaterialOutputType.CMOT_FLOAT1)
        names = ["UV", "Vt"] + (["Paint"] if texture else []) + [n for n, _ in EYE_PARAMS]
        pins = []
        for n in names:
            pin = unreal.CustomInput()
            pin.set_editor_property("input_name", n)
            pins.append(pin)
        c.set_editor_property("inputs", pins)
        MEL.connect_material_expressions(uv, "", c, "UV")
        MEL.connect_material_expressions(to_tangent, "", c, "Vt")
        if texture:
            MEL.connect_material_expressions(paint, "", c, "Paint")
        for n, _ in EYE_PARAMS:
            MEL.connect_material_expressions(scalars[n], "", c, n)
        return c

    P = unreal.MaterialProperty
    colour = custom(EYE_COLOR, "StudioEyeColor", True, -300, True)
    iris = custom(EYE_IRIS, "StudioEyeIris", False, 0, False)
    bare = make(unreal.MaterialExpressionOneMinus, -400, 0)                  # the base layer's shine: the white's, none on the iris
    MEL.connect_material_expressions(iris, "", bare, "")
    half = make(unreal.MaterialExpressionMultiply, -250, 0)
    half.set_editor_property("const_b", 0.5)
    MEL.connect_material_expressions(bare, "", half, "A")
    coat = make(unreal.MaterialExpressionConstant, -250, 120)
    coat.set_editor_property("r", 1.0)
    MEL.connect_material_property(colour, "", P.MP_BASE_COLOR)
    MEL.connect_material_property(half, "", P.MP_SPECULAR)
    MEL.connect_material_property(scalars["Roughness"], "", P.MP_ROUGHNESS)
    MEL.connect_material_property(coat, "", P.MP_CUSTOM_DATA0)               # Clear Coat
    MEL.connect_material_property(scalars["ClearCoatRoughness"], "", P.MP_CUSTOM_DATA1)
    MEL.recompile_material(mat)
    EAL.set_metadata_tag(mat, "StudioEyeVersion", EYE_VERSION)
    EAL.save_loaded_asset(mat)
    unreal.log(f"storykit: made {EYE_MATERIAL} ({EYE_VERSION})")
    return mat


def skin_material(rebuild=False):
    """M_StudioSkin, made the first time (and again when its version changes): Subsurface Profile (SP_StudioSkin), the
    colour, the relief (Normal), the roughness and the occlusion from one map, the subsurface amount more where it's
    thin (the map's blue)."""
    unreal = _unreal()
    EAL, MEL = unreal.EditorAssetLibrary, unreal.MaterialEditingLibrary
    if EAL.does_asset_exist(SKIN_MATERIAL) and not rebuild:
        mat = unreal.load_asset(SKIN_MATERIAL)
        if EAL.get_metadata_tag(mat, "StudioSkinVersion") == SKIN_VERSION:
            return mat
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    profile = unreal.load_asset(SKIN_PROFILE) if EAL.does_asset_exist(SKIN_PROFILE) else \
        tools.create_asset("SP_StudioSkin", MATERIALS, unreal.SubsurfaceProfile, None)   # the engine's defaults are skin's
    if EAL.does_asset_exist(SKIN_MATERIAL):
        mat = unreal.load_asset(SKIN_MATERIAL)
        MEL.delete_all_material_expressions(mat)
    else:
        mat = tools.create_asset("M_StudioSkin", MATERIALS, unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_SUBSURFACE_PROFILE)
    if profile:
        mat.set_editor_property("subsurface_profile", profile)
    mat.set_editor_property("used_with_skeletal_mesh", True)
    make = lambda cls, x, y: MEL.create_material_expression(mat, cls, x, y)  # noqa: E731
    P = unreal.MaterialProperty

    def tex(name, y, kind):
        t = make(unreal.MaterialExpressionTextureSampleParameter2D, -700, y)
        t.set_editor_property("parameter_name", name)
        t.set_editor_property("sampler_type", kind)
        return t
    ST = unreal.MaterialSamplerType
    colour, normal, orm = tex("Color", -400, ST.SAMPLERTYPE_COLOR), tex("Normal", -100, ST.SAMPLERTYPE_NORMAL), tex("ORM", 200, ST.SAMPLERTYPE_MASKS)
    scal = {}
    for k, (n, d) in enumerate(SKIN_PARAMS):
        x = make(unreal.MaterialExpressionScalarParameter, -700, 500 + k * 60)
        x.set_editor_property("parameter_name", n)
        x.set_editor_property("default_value", float(d))
        scal[n] = x
    rough = make(unreal.MaterialExpressionMultiply, -350, 200)
    MEL.connect_material_expressions(orm, "G", rough, "A")
    MEL.connect_material_expressions(scal["RoughScale"], "", rough, "B")
    thin = make(unreal.MaterialExpressionMultiply, -350, 330)                 # more scattering where it's thin
    MEL.connect_material_expressions(orm, "B", thin, "A")
    MEL.connect_material_expressions(scal["ThinBoost"], "", thin, "B")
    amount = make(unreal.MaterialExpressionAdd, -200, 330)
    MEL.connect_material_expressions(scal["Subsurface"], "", amount, "A")
    MEL.connect_material_expressions(thin, "", amount, "B")
    sat = make(unreal.MaterialExpressionSaturate, -80, 330)
    MEL.connect_material_expressions(amount, "", sat, "")
    MEL.connect_material_property(colour, "RGB", P.MP_BASE_COLOR)
    MEL.connect_material_property(normal, "RGB", P.MP_NORMAL)
    MEL.connect_material_property(rough, "", P.MP_ROUGHNESS)
    MEL.connect_material_property(orm, "R", P.MP_AMBIENT_OCCLUSION)
    MEL.connect_material_property(scal["Specular"], "", P.MP_SPECULAR)
    MEL.connect_material_property(sat, "", P.MP_OPACITY)                        # Subsurface Profile: the scattering's amount
    MEL.recompile_material(mat)
    EAL.set_metadata_tag(mat, "StudioSkinVersion", SKIN_VERSION)
    EAL.save_loaded_asset(mat)
    unreal.log(f"storykit: made {SKIN_MATERIAL} ({SKIN_VERSION})")
    return mat


def wear_skin(name, mesh, path, dest):
    """The skin's three maps imported as textures (the relief's green flipped to Unreal's convention, the ORM linear)
    and an instance of M_StudioSkin with the skin's numbers, on the skin's slot. False when the export carries none (an
    export made before the skin light: the skin keeps the import's own material)."""
    unreal = _unreal()
    EAL, MEL = unreal.EditorAssetLibrary, unreal.MaterialEditingLibrary
    sk = skin(path)
    if not sk:
        return False
    parent = skin_material()
    tmp = L.ROOT / "Saved" / "People" / name
    tmp.mkdir(parents=True, exist_ok=True)
    TC = unreal.TextureCompressionSettings
    texs = {}
    for k, param in (("color", "Color"), ("normal", "Normal"), ("orm", "ORM")):
        if k not in sk:
            continue
        data, ext = sk[k]
        f = tmp / f"skin_{k}{ext}"
        f.write_bytes(data)
        tex_name = f"T_{name}_skin_{k}"
        t = unreal.load_asset(f"{dest}/{tex_name}") if EAL.does_asset_exist(f"{dest}/{tex_name}") else None
        if t is None:
            got = _import(f, dest, tex_name)
            t = unreal.load_asset(got[0]) if got else None
        if t is None:
            unreal.log_warning(f"storykit: {name}'s skin: its {k} map didn't import")
            continue
        if k == "normal":
            t.set_editor_property("compression_settings", TC.TC_NORMALMAP)
            t.set_editor_property("flip_green_channel", True)                 # glTF's +Y up to Unreal's
        elif k == "orm":
            t.set_editor_property("srgb", False)
            t.set_editor_property("compression_settings", TC.TC_MASKS)
        EAL.save_loaded_asset(t)
        texs[param] = t
    mi_name = f"MI_{name}_skin"
    mi_path = f"{dest}/{mi_name}"
    mi = unreal.load_asset(mi_path) if EAL.does_asset_exist(mi_path) else \
        unreal.AssetToolsHelpers.get_asset_tools().create_asset(mi_name, dest, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, parent)
    for k, v in skin_params(sk["record"]).items():
        MEL.set_material_instance_scalar_parameter_value(mi, k, v)
    for param, t in texs.items():
        MEL.set_material_instance_texture_parameter_value(mi, param, t)
    MEL.update_material_instance(mi)
    EAL.save_loaded_asset(mi)
    mats = list(mesh.get_editor_property("materials"))
    worn = False
    for m in mats:
        slot = str(m.get_editor_property("material_slot_name"))
        if slot == sk["material"] or slot.endswith("_skin"):
            m.set_editor_property("material_interface", mi)
            worn = True
    mesh.set_editor_property("materials", mats)
    EAL.save_loaded_asset(mesh)
    if not worn:
        unreal.log_warning(f"storykit: {name}: no skin slot found for {sk['material']} (slots: {_slots(mesh)})")
    return worn


def _import(file, dest, name=None):
    unreal = _unreal()
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", str(file))
    task.set_editor_property("destination_path", dest)
    if name:
        task.set_editor_property("destination_name", name)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    return list(task.get_editor_property("imported_object_paths") or [])


def _slots(mesh):
    return [str(m.get_editor_property("material_slot_name")) for m in mesh.get_editor_property("materials")]


def _mesh_in(dest):
    """The character's skeletal mesh in a version folder: the one with the eyes' slots (the whole character, if the
    import combined its parts as it should)."""
    unreal = _unreal()
    EAL = unreal.EditorAssetLibrary
    if not EAL.does_directory_exist(dest):
        return None
    meshes = [a for a in (unreal.load_asset(p) for p in EAL.list_assets(dest, recursive=True)) if isinstance(a, unreal.SkeletalMesh)]
    if len(meshes) > 1:
        unreal.log_warning(f"storykit: {dest} holds {len(meshes)} skeletal meshes: the import split the character's parts "
                           "(Interchange's Combine Skeletal Meshes should be on); the one with the eyes plays")
    return next((m for m in meshes if any("_eye_" in s for s in _slots(m))), meshes[0] if meshes else None)


def wear_eyes(name, mesh, path, dest):
    """Each eye's paint imported as a texture and an instance of M_StudioEye with the eye's numbers, on its slot."""
    unreal = _unreal()
    EAL, MEL = unreal.EditorAssetLibrary, unreal.MaterialEditingLibrary
    parent = eye_material()
    tmp = L.ROOT / "Saved" / "People" / name
    tmp.mkdir(parents=True, exist_ok=True)
    made = {}
    for e in eyes(path):
        side = e["side"]
        f = tmp / f"eye_{side}{e['ext']}"
        f.write_bytes(e["image"])
        tex_name, mi_name = f"T_{name}_eye_{side}", f"MI_{name}_eye_{side}"
        tex = unreal.load_asset(f"{dest}/{tex_name}") if EAL.does_asset_exist(f"{dest}/{tex_name}") else None
        if tex is None:
            got = _import(f, dest, tex_name)
            tex = unreal.load_asset(got[0]) if got else None
        mi_path = f"{dest}/{mi_name}"
        mi = unreal.load_asset(mi_path) if EAL.does_asset_exist(mi_path) else \
            unreal.AssetToolsHelpers.get_asset_tools().create_asset(mi_name, dest, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
        MEL.set_material_instance_parent(mi, parent)
        for k, v in params(e["record"]).items():
            MEL.set_material_instance_scalar_parameter_value(mi, k, v)
        if tex:
            MEL.set_material_instance_texture_parameter_value(mi, "Paint", tex)
        else:
            unreal.log_warning(f"storykit: {name}'s {side} eye: its paint didn't import (the eye draws grey)")
        MEL.update_material_instance(mi)
        EAL.save_loaded_asset(mi)
        made[side] = mi
    mats = list(mesh.get_editor_property("materials"))
    worn = []
    for m in mats:
        slot = str(m.get_editor_property("material_slot_name"))
        side = next((s for s in made if f"_eye_{s}" in slot), None)
        if side:
            m.set_editor_property("material_interface", made[side])
            worn.append(side)
    mesh.set_editor_property("materials", mats)
    EAL.save_loaded_asset(mesh)
    if sorted(worn) != sorted(made):
        unreal.log_warning(f"storykit: {name}: eye slots found for {worn or 'none'} of {sorted(made)} (slots: {_slots(mesh)})")
    return worn


def import_character(name, force=False):
    """A Studio character as a skeletal mesh (importing it the first time, or when its file changed), its eyes wearing
    M_StudioEye. None if it hasn't been exported here."""
    unreal = _unreal()
    path = export_path(name)
    if not path.is_file():
        unreal.log_warning(f"storykit: no export of {name} from the Character Studio ({path})")
        return None
    dest = f"{DEST}/{name}/v{version(path)}"
    mesh = None if force else _mesh_in(dest)
    if mesh is None:
        _import(path, dest)
        mesh = _mesh_in(dest)
        if mesh is None:
            unreal.log_warning(f"storykit: {path.name} didn't import as a skeletal mesh")
            return None
        wear_eyes(name, mesh, path, dest)
        wear_skin(name, mesh, path, dest)
    else:
        if not unreal.EditorAssetLibrary.get_metadata_tag(mesh, "StudioEyeVersion") == EYE_VERSION:
            wear_eyes(name, mesh, path, dest)                 # the eye's material changed since: its instances again
        if not unreal.EditorAssetLibrary.get_metadata_tag(mesh, "StudioSkinVersion") == SKIN_VERSION:
            wear_skin(name, mesh, path, dest)                 # and the skin's
    unreal.EditorAssetLibrary.set_metadata_tag(mesh, "StudioEyeVersion", EYE_VERSION)
    unreal.EditorAssetLibrary.set_metadata_tag(mesh, "StudioSkinVersion", SKIN_VERSION)
    unreal.EditorAssetLibrary.save_loaded_asset(mesh)
    unreal.log(f"storykit: {name} from the Character Studio: {mesh.get_path_name()}")
    return mesh


def safe_import(name):
    """import_character, but never the reason a build fails: written without an editor, its first run may meet an
    engine that disagrees; then the cast member stays a stand-in and the log says why."""
    try:
        return import_character(name)
    except Exception as e:  # noqa: BLE001
        import traceback
        _unreal().log_error(f"storykit: {name} from the Character Studio didn't come in ({type(e).__name__}: {e}); "
                            f"a stand-in plays instead (docs/UNREAL_FLOW.md §1d)\n{traceback.format_exc()}")
        return None


def cast_meshes(story):
    """{cast id: (skeletal mesh, the character's height in metres)} for the cast members who are Studio characters."""
    out = {}
    for cid, name in cast_people(story).items():
        mesh = safe_import(name)
        if mesh:
            out[cid] = (mesh, height(export_path(name), name) or 1.7)
    return out
