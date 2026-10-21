"""Glass skin on a MetaHuman, in the editor (docs/METAHUMAN_LOOKS.md §2). Editor-only (imports unreal).

    import storykit.skin as s
    s.load()                                   # the set from Content/Studio/Skin/GlassSkin -> /Game/Studio/Skin/GlassSkin
    s.creator("/Game/MetaHumans/Mari/Mari")    # before assembly: Creator's own skin and foundation settings (5.8 API)
    s.apply("/Game/MetaHumans/Mari")           # after assembly: the head material's global scalars and our SRMF map

Written blind (no editor in the session that wrote it), like surfaces.py: every call that touches a MetaHuman name
is marked VERIFY and prints what it found, so the first run (SETUP S12) is a read of the log and a fix of the names
here. `apply` never edits Epic's textures in place: it sets parameters on the character's own material instances,
which `BuildMetaHuman` regenerates, so rerun it after every re-assembly (the same rule as the jiggle bones).
"""
import json
from pathlib import Path

import unreal

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "Content" / "Studio" / "Skin" / "GlassSkin"
DEST = "/Game/Studio/Skin/GlassSkin"
EAL = unreal.EditorAssetLibrary
MEL = unreal.MaterialEditingLibrary

# file -> (sRGB, compression) ; the maps are linear data, never colour
FILES = {
    "T_GlassSkin_Roughness.png": (False, unreal.TextureCompressionSettings.TC_GRAYSCALE),
    "T_GlassSkin_Specular.png": (False, unreal.TextureCompressionSettings.TC_GRAYSCALE),
    "T_GlassSkin_Cavity.png": (False, unreal.TextureCompressionSettings.TC_GRAYSCALE),
    "T_GlassSkin_SRMF.png": (False, unreal.TextureCompressionSettings.TC_MASKS),
    "T_GlassSkin_NormalMicro.png": (False, unreal.TextureCompressionSettings.TC_NORMALMAP),
}


def recipe():
    return json.loads((SRC / "glass_skin.json").read_text())


def load():
    """Imports the set once (replace on reimport) and fixes each texture's sRGB and compression. Returns {name: Texture2D}."""
    out = {}
    for name, (srgb, comp) in FILES.items():
        f = SRC / name
        if not f.exists():
            unreal.log_warning(f"storykit.skin: {f} missing (python tools/glass_skin.py)")
            continue
        task = unreal.AssetImportTask()
        task.set_editor_property("filename", str(f))
        task.set_editor_property("destination_path", DEST)
        task.set_editor_property("automated", True)
        task.set_editor_property("replace_existing", True)
        task.set_editor_property("save", False)
        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
        for p in list(task.get_editor_property("imported_object_paths") or []):
            t = unreal.load_asset(p)
            if isinstance(t, unreal.Texture2D):
                t.set_editor_property("srgb", srgb)
                t.set_editor_property("compression_settings", comp)
                if comp == unreal.TextureCompressionSettings.TC_NORMALMAP:
                    t.set_editor_property("flip_green_channel", False)   # the file is DirectX green already
                EAL.save_loaded_asset(t)
                out[name.split(".")[0]] = t
    unreal.log(f"storykit.skin: loaded {sorted(out)} into {DEST}")
    return out


def _skin_mis(folder):
    """The character's head/face skin material instances (VERIFY the names: MI_HeadSynthesized_Baked and kin)."""
    found = []
    for p in EAL.list_assets(folder, recursive=True):
        a = unreal.load_asset(p)
        if isinstance(a, unreal.MaterialInstanceConstant):
            n = a.get_name().lower()
            if ("head" in n or "face" in n) and not any(k in n for k in ("eye", "lash", "teeth", "saliva", "hair", "brow")):
                found.append(a)
    return found


def apply(folder, roughness=None, specular=None, scatter=None, normal=None, srmf=True):
    """After assembly: the head material's global multipliers for glass skin, and our packed SRMF map in place of the
    baked one. Scalars default to the recipe; names are matched by substring and every parameter found is logged."""
    r = recipe()["material_after_assembly"]
    want = {"rough": roughness if roughness is not None else r["roughness multiplier"],
            "spec": specular if specular is not None else r["specular multiplier"],
            "scatter": scatter if scatter is not None else r["scatter / subsurface multiplier"],
            "normal": normal if normal is not None else r["normal strength"]}
    tex = load() if srmf else {}
    mis = _skin_mis(folder)
    if not mis:
        unreal.log_warning(f"storykit.skin: no head/face material instance under {folder}; is it assembled?")
        return
    for mi in mis:
        scalars = [str(n) for n in MEL.get_scalar_parameter_names(mi)]
        textures = [str(n) for n in MEL.get_texture_parameter_names(mi)]
        unreal.log(f"storykit.skin: {mi.get_name()} scalars {scalars} textures {textures}")
        for key, val in want.items():
            hits = [n for n in scalars if key in n.lower() and ("mult" in n.lower() or "scale" in n.lower() or "strength" in n.lower() or "amount" in n.lower())]
            for n in hits:
                MEL.set_material_instance_scalar_parameter_value(mi, n, float(val))     # VERIFY which of these it has
                unreal.log(f"  {n} = {val}")
        if srmf and "T_GlassSkin_SRMF" in tex:
            for n in textures:
                if "srmf" in n.lower():
                    MEL.set_material_instance_texture_parameter_value(mi, n, tex["T_GlassSkin_SRMF"])
                    unreal.log(f"  {n} = T_GlassSkin_SRMF (check the channel order: docs/METAHUMAN_LOOKS.md §2.4)")
        MEL.update_material_instance(mi)
        EAL.save_loaded_asset(mi)
    unreal.log(f"storykit.skin: applied to {len(mis)} material instance(s) under {folder}")


def creator(asset_path):
    """Before assembly, through the 5.8 MetaHuman Character API: the recipe's Creator settings on the character asset
    (skin roughness multiplier, foundation make-up), committed so the viewport and the asset take them. VERIFY the
    struct and function names against Engine/Plugins/MetaHuman/MetaHumanCharacter/Content/Python/examples."""
    c = recipe()["creator"]
    char = unreal.load_asset(asset_path)
    sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
    if not sub.try_add_object_to_edit(char):                                  # VERIFY
        unreal.log_warning("storykit.skin: could not register the character for editing")
        return
    try:
        skin = sub.get_skin_settings(char)                                     # VERIFY: getter name
        props = skin.get_editor_property("skin")                               # FMetaHumanCharacterSkinProperties
        props.set_editor_property("roughness", float(c["skin.roughness"]))    # the UI multiplier, 0.85 to 1.15
        skin.set_editor_property("skin", props)
        sub.commit_skin_settings(char, skin)
        makeup = char.get_editor_property("makeup_settings")                   # FMetaHumanCharacterMakeupSettings
        f = makeup.get_editor_property("foundation")                           # FMetaHumanCharacterFoundationMakeupProperties
        fo = c["makeup.foundation"]
        f.set_editor_property("apply_foundation", True)
        f.set_editor_property("intensity", float(fo["intensity"]))
        f.set_editor_property("roughness", float(fo["roughness"]))
        f.set_editor_property("concealer", float(fo["concealer"]))
        makeup.set_editor_property("foundation", f)
        sub.commit_makeup_settings(char, makeup)                               # VERIFY: the makeup commit's name
        unreal.log(f"storykit.skin: Creator settings committed on {asset_path}: {c}")
    finally:
        sub.remove_object_to_edit(char)                                        # VERIFY
