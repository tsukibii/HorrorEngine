"""Light Kit's materials, made in the editor from text (nothing binary in git).

In the editor's Python console (or through UnrealClaude's unreal_execute_script):

    import lightkit_materials; lightkit_materials.build()

Makes, in /LightKit/Materials (the plugin's content):
    LF_LightKit_Caustics, LF_LightKit_Leaves, LF_LightKit_Blinds, LF_LightKit_Clouds   light functions
    M_LightKit_Shaft                                                                  additive light-shaft card
    M_LightKit_Wet                                                                    puddle decal
Each is one Custom node (the HLSL below) fed by a few inputs and parameters, so the look lives here in text and
Tools/preview_patterns.py draws the same thing offline. Run it again after changing the code: it rebuilds in place.

Light functions see light-space coordinates as their texture coordinates (Unreal hands them LightVector.zy), and the
kit's lights set LightFunctionScale to 100, so UV is in metres across the light.
"""

# value noise, written out per octave (Custom nodes can't declare functions)
_NOISE = """
    {{
        float2 i = floor({q});
        float2 f = frac({q});
        f = f * f * (3.0 - 2.0 * f);
        float h00 = frac(sin(dot(i, float2(127.1, 311.7))) * 43758.5453);
        float h10 = frac(sin(dot(i + float2(1.0, 0.0), float2(127.1, 311.7))) * 43758.5453);
        float h01 = frac(sin(dot(i + float2(0.0, 1.0), float2(127.1, 311.7))) * 43758.5453);
        float h11 = frac(sin(dot(i + float2(1.0, 1.0), float2(127.1, 311.7))) * 43758.5453);
        {out} += {amp} * lerp(lerp(h00, h10, f.x), lerp(h01, h11, f.x), f.y);
    }}"""


def _fbm(q, out, octaves, step):
    return f"""
float {out} = 0.0;
float {out}_a = 0.5;
for (int o = 0; o < {octaves}; o++)
{{{_NOISE.format(q=q, out=out, amp=out + '_a')}
    {q} = {q} * 2.07 + {step};
    {out}_a *= 0.5;
}}"""


LEAVES = """
float2 p = UV / max(Scale, 0.01) * 3.0;
float t = T * Speed;
float2 w = 0.12 * float2(sin(t * 1.3 + p.y * 0.9), cos(t * 1.1 + p.x * 0.8));
float2 q = p + w;""" + _fbm("q", "n", 3, "float2(13.7, 7.3) + w") + """
float cut = lerp(0.68, 0.42, saturate(Openness));
float lit = smoothstep(cut - 0.05, cut + 0.05, n);
return lerp(0.06, 1.0, lit);
"""

BLINDS = """
float a = radians(Angle);
float s = UV.x * cos(a) + UV.y * sin(a);
float f = frac(s / max(Scale, 0.005));
float lit = 1.0 - smoothstep(Openness - 0.06, Openness + 0.06, f);
return lerp(0.04, 1.0, lit);
"""

CAUSTICS = """
float t = T * Speed;
float acc = 0.0;
for (int layer = 0; layer < 2; layer++)
{
    float2 p = UV / max(Scale, 0.01) * (layer == 0 ? 1.0 : 1.7) + layer * float2(3.1, 1.7);
    p += 0.2 * float2(sin(p.y * 2.3 + t), cos(p.x * 2.1 - t * 0.8));
    float2 i = floor(p);
    float2 f = frac(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int y = -1; y <= 1; y++)
    {
        for (int x = -1; x <= 1; x++)
        {
            float2 g = float2(x, y);
            float2 c = i + g;
            float2 h = frac(sin(float2(dot(c, float2(127.1, 311.7)), dot(c, float2(269.5, 183.3)))) * 43758.5453);
            float2 o = 0.5 + 0.4 * sin(t * 0.7 + 6.2831853 * h);
            float d = length(g + o - f);
            if (d < d1) { d2 = d1; d1 = d; }
            else if (d < d2) { d2 = d; }
        }
    }
    acc += (1.0 - smoothstep(0.0, 0.12, d2 - d1)) * (layer == 0 ? 0.7 : 0.45);
}
float base = lerp(0.05, 0.5, saturate(Openness));
return base + (1.2 - base) * saturate(acc);
"""

CLOUDS = """
float2 q = UV / max(Scale, 0.01) + float2(T * Speed, T * Speed * 0.37);""" + _fbm("q", "n", 5, "float2(5.3, 9.1)") + """
float cover = lerp(0.35, 0.65, saturate(Openness));
return lerp(1.0, 0.35, smoothstep(cover - 0.08, cover + 0.08, n));
"""

WET = """
float2 q = UV * max(Cells, 0.1) + Seed * float2(0.137, 0.271);""" + _fbm("q", "n", 4, "float2(3.7, 1.9)") + """
float2 e = abs(UV - 0.5) * 2.0;
float box = 1.0 - smoothstep(0.35, 0.95, length(e) * 0.8);
float c = (1.0 - saturate(Coverage)) * 0.8;
return smoothstep(c - Edge, c + 0.02, n * box);
"""

SHAFT = """
float along = UV.x;
float ends = smoothstep(0.0, 0.12, along) * (1.0 - smoothstep(0.55, 1.0, along));
float soft = saturate((SceneD - PixelD) / 40.0);
float nearCam = saturate((PixelD - 40.0) / 160.0);
float facing = pow(saturate(abs(dot(normalize(N), normalize(V)))), 1.5);
float3 p = WP * 0.03;
float motes = 0.5 + 0.5 * sin(p.x * 3.1 + sin(p.y * 2.3 + T * 0.2) * 2.0) * sin(p.z * 2.7 + sin(p.x * 1.9 - T * 0.15) * 2.0);
float dust = lerp(1.0, 0.4 + 1.2 * motes, saturate(Dust));
return Color.rgb * Intensity * ends * soft * nearCam * facing * dust;
"""

# name -> (kind, code, output, inputs); an input is (name, source, default)
PATTERN_INPUTS = [("UV", "uv", None), ("T", "time", None), ("Scale", "scalar", 0.6), ("Speed", "scalar", 0.4),
                  ("Openness", "scalar", 0.5), ("Angle", "scalar", 0.0)]
MATERIALS = {
    "LF_LightKit_Caustics": ("light", CAUSTICS, 1, PATTERN_INPUTS),
    "LF_LightKit_Leaves": ("light", LEAVES, 1, PATTERN_INPUTS),
    "LF_LightKit_Blinds": ("light", BLINDS, 1, [("UV", "uv", None), ("Scale", "scalar", 0.05),
                                                 ("Openness", "scalar", 0.5), ("Angle", "scalar", 0.0)]),
    "LF_LightKit_Clouds": ("light", CLOUDS, 1, [("UV", "uv", None), ("T", "time", None), ("Scale", "scalar", 40.0),
                                                 ("Speed", "scalar", 0.04), ("Openness", "scalar", 0.5)]),
    "M_LightKit_Wet": ("decal", WET, 1, [("UV", "uv", None), ("Seed", "scalar", 0.0), ("Coverage", "scalar", 0.45),
                                         ("Edge", "scalar", 0.15), ("Cells", "scalar", 3.0)]),
    "M_LightKit_Shaft": ("shaft", SHAFT, 3, [("UV", "uv", None), ("SceneD", "scenedepth", None),
                                             ("PixelD", "pixeldepth", None), ("N", "normal", None),
                                             ("V", "camera", None), ("WP", "worldpos", None), ("T", "time", None),
                                             ("Color", "vector", (1.0, 0.95, 0.85, 1.0)),
                                             ("Intensity", "scalar", 0.12), ("Dust", "scalar", 0.5)]),
}

ROOT = "/LightKit/Materials"


def _source(unreal, mat, mel, src, name, default, y):
    E = unreal
    make = lambda cls: mel.create_material_expression(mat, cls, -900, y)  # noqa: E731
    if src == "uv":
        return make(E.MaterialExpressionTextureCoordinate)
    if src == "time":
        return make(E.MaterialExpressionTime)
    if src == "worldpos":
        return make(E.MaterialExpressionWorldPosition)
    if src == "scenedepth":
        return make(E.MaterialExpressionSceneDepth)
    if src == "pixeldepth":
        return make(E.MaterialExpressionPixelDepth)
    if src == "normal":
        return make(E.MaterialExpressionVertexNormalWS)
    if src == "camera":
        return make(E.MaterialExpressionCameraVectorWS)
    if src == "scalar":
        x = make(E.MaterialExpressionScalarParameter)
        x.set_editor_property("parameter_name", name)
        x.set_editor_property("default_value", float(default))
        return x
    if src == "vector":
        x = make(E.MaterialExpressionVectorParameter)
        x.set_editor_property("parameter_name", name)
        x.set_editor_property("default_value", E.LinearColor(*default))
        return x
    raise ValueError(src)


def _make(unreal, name, kind, code, outputs, inputs):
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    mel = unreal.MaterialEditingLibrary
    path = f"{ROOT}/{name}"
    mat = unreal.load_asset(path) if unreal.EditorAssetLibrary.does_asset_exist(path) else None
    if mat:
        mel.delete_all_material_expressions(mat)
    else:
        mat = tools.create_asset(name, ROOT, unreal.Material, unreal.MaterialFactoryNew())

    if kind == "light":
        mat.set_editor_property("material_domain", unreal.MaterialDomain.MD_LIGHT_FUNCTION)
    elif kind == "decal":
        mat.set_editor_property("material_domain", unreal.MaterialDomain.MD_DEFERRED_DECAL)
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        try:  # older engines pick the decal's blend here
            mat.set_editor_property("decal_blend_mode", unreal.DecalBlendMode.DBM_TRANSLUCENT)
        except Exception:  # noqa: BLE001
            pass
    elif kind == "shaft":
        mat.set_editor_property("material_domain", unreal.MaterialDomain.MD_SURFACE)
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_ADDITIVE)
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        mat.set_editor_property("two_sided", True)

    custom = mel.create_material_expression(mat, unreal.MaterialExpressionCustom, -400, 0)
    custom.set_editor_property("code", code)
    custom.set_editor_property("description", name)
    custom.set_editor_property("output_type", unreal.CustomMaterialOutputType.CMOT_FLOAT3 if outputs == 3
                               else unreal.CustomMaterialOutputType.CMOT_FLOAT1)
    pins = []
    for n, _src, _d in inputs:
        pin = unreal.CustomInput()
        pin.set_editor_property("input_name", n)
        pins.append(pin)
    custom.set_editor_property("inputs", pins)
    for k, (n, src, default) in enumerate(inputs):
        mel.connect_material_expressions(_source(unreal, mat, mel, src, n, default, k * 90 - 300), "", custom, n)

    P = unreal.MaterialProperty
    if kind == "light":
        mel.connect_material_property(custom, "", P.MP_EMISSIVE_COLOR)
    elif kind == "decal":
        mel.connect_material_property(custom, "", P.MP_OPACITY)
        water = _source(unreal, mat, mel, "vector", "WaterColor", (0.02, 0.02, 0.022, 1.0), 400)
        rough = _source(unreal, mat, mel, "scalar", "Roughness", 0.03, 500)
        spec = _source(unreal, mat, mel, "scalar", "Specular", 0.5, 600)
        mel.connect_material_property(water, "", P.MP_BASE_COLOR)
        mel.connect_material_property(rough, "", P.MP_ROUGHNESS)
        mel.connect_material_property(spec, "", P.MP_SPECULAR)
    elif kind == "shaft":
        # screen-relative brightness: the same Intensity reads the same by day and by night
        inverse = getattr(unreal, "MaterialExpressionEyeAdaptationInverse", None)
        if inverse:
            node = mel.create_material_expression(mat, inverse, -150, 0)
            mel.connect_material_expressions(custom, "", node, "")
            mel.connect_material_property(node, "", P.MP_EMISSIVE_COLOR)
        else:
            unreal.log_warning("lightkit: no EyeAdaptationInverse node; the shaft's Intensity is in absolute units")
            mel.connect_material_property(custom, "", P.MP_EMISSIVE_COLOR)

    mel.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
    return path


def build():
    import unreal  # noqa: PLC0415 - only inside the editor
    made = [_make(unreal, name, *spec) for name, spec in MATERIALS.items()]
    unreal.log(f"lightkit: made {len(made)} materials in {ROOT}")
    return made
