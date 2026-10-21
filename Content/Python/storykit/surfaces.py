"""The CC0 library and the PBR shelf in the editor (docs/ASSETS.md §5, §6): imports a library mesh or texture set once
(into /Game/Studio/Library, or /Game/Studio/PBR/<category>/<name> for the shelf's sets),
and gives each texture set a material instance of the studio's one world-aligned surface material, so a texture keeps
its real size on any block (blocks are scaled cubes: their own UVs stretch).

Written blind (no editor in the session that wrote it): the first time it runs, check the log and one screenshot of a
textured room, and fix this file if the engine disagrees. ASSETS.md §5 says what M_StudioSurface must do if
master_material() can't build it, so Claude in the editor can make it by hand with the same parameter names.
"""
import unreal

from . import library as LIB
from . import pbr as PBR

DEST = "/Game/Studio/Library"
MASTER = "/Game/Studio/Materials/M_StudioSurface"
WA_TEX = "/Engine/Functions/Engine_MaterialFunctions01/Texturing/WorldAlignedTexture"
WA_NOR = "/Engine/Functions/Engine_MaterialFunctions01/Texturing/WorldAlignedNormal"
EAL = unreal.EditorAssetLibrary
MEL = unreal.MaterialEditingLibrary
_done = {}


def _import(file, dest):
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", str(file))
    task.set_editor_property("destination_path", dest)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    paths = list(task.get_editor_property("imported_object_paths") or [])
    return paths


def mesh(ref):
    """The imported StaticMesh for a library mesh ref, importing it the first time; None if it isn't fetched."""
    if ref in _done:
        return _done[ref]
    lib, name = LIB.split(ref)
    dest = f"{DEST}/Meshes/{lib}/{name}"
    found = None
    if EAL.does_directory_exist(dest):
        for p in EAL.list_assets(dest, recursive=True):
            a = unreal.load_asset(p)
            if isinstance(a, unreal.StaticMesh):
                found = a
                break
    if found is None and LIB.mesh_file(ref).exists():
        for p in _import(LIB.mesh_file(ref), dest):
            a = unreal.load_asset(p)
            if isinstance(a, unreal.StaticMesh):
                found = a
                break
    if found is None:
        unreal.log_warning(f"storykit: {ref} isn't fetched or didn't import (`python tools/cc0.py fetch`)")
    _done[ref] = found
    return found


def _connect(a, out, b, inp):
    if not MEL.connect_material_expressions(a, out, b, inp):
        raise RuntimeError(f"couldn't connect {out!r} -> {inp!r}")


def master_material():
    """M_StudioSurface: world-aligned Albedo, Normal, Rough, AO texture parameters and a TileCm scalar."""
    if EAL.does_asset_exist(MASTER):
        return unreal.load_asset(MASTER)
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    folder, name = MASTER.rsplit("/", 1)
    m = tools.create_asset(name, folder, unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property("tangent_space_normal", False)       # WorldAlignedNormal gives world-space normals
    tile = MEL.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -900, 0)
    tile.set_editor_property("parameter_name", "TileCm")
    tile.set_editor_property("default_value", 200.0)
    y = -300
    for pname, default, out_prop, normal in (("Albedo", "/Engine/EngineResources/DefaultTexture", unreal.MaterialProperty.MP_BASE_COLOR, False),
                                             ("Normal", "/Engine/EngineMaterials/DefaultNormal", unreal.MaterialProperty.MP_NORMAL, True),
                                             ("Rough", "/Engine/EngineResources/WhiteSquareTexture", unreal.MaterialProperty.MP_ROUGHNESS, False),
                                             ("AO", "/Engine/EngineResources/WhiteSquareTexture", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION, False)):
        t = MEL.create_material_expression(m, unreal.MaterialExpressionTextureObjectParameter, -900, y)
        t.set_editor_property("parameter_name", pname)
        t.set_editor_property("texture", unreal.load_asset(default))
        f = MEL.create_material_expression(m, unreal.MaterialExpressionMaterialFunctionCall, -500, y)
        f.set_material_function(unreal.load_asset(WA_NOR if normal else WA_TEX))
        _connect(t, "", f, "TextureObject")
        _connect(tile, "", f, "TextureSize")
        if out_prop in (unreal.MaterialProperty.MP_ROUGHNESS, unreal.MaterialProperty.MP_AMBIENT_OCCLUSION):
            mask = MEL.create_material_expression(m, unreal.MaterialExpressionComponentMask, -250, y)
            mask.set_editor_property("r", True)
            _connect(f, "XYZ Texture", mask, "")
            MEL.connect_material_property(mask, "", out_prop)
        else:
            MEL.connect_material_property(f, "XYZ Texture", out_prop)
        y += 250
    MEL.recompile_material(m)
    EAL.save_loaded_asset(m)
    return m


STAMP = "storykit_stamp"     # metadata on a material instance: the set's maps when it was imported (pbr.stamp)
_stats = {"had": 0, "imported": 0, "updated": 0, "failed": 0}


def _where(ref):
    """(folder, material instance name): /Game/Studio/PBR/<category>/<name>/ for the shelf, Library/Textures for the rest."""
    lib, name = LIB.split(ref)
    if lib == "pbr":
        return PBR.unreal_path(ref)
    return f"{DEST}/Textures/{lib}/{name}", f"MI_{name}"


def _import_maps(ref, meta, dest):
    d, tex = LIB.texture_dir(ref), {}
    for k, fn in meta["maps"].items():
        paths = _import(d / fn, dest)
        t = unreal.load_asset(paths[0]) if paths else None
        if t is None:
            continue
        if k == "normal":
            t.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
            t.set_editor_property("flip_green_channel", meta.get("normal") != "dx")   # GL normals: Unreal is DX
        elif k == "height":           # kept for displacement later (Nanite tessellation); M_StudioSurface doesn't use it yet
            t.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_GRAYSCALE)
            t.set_editor_property("srgb", False)
        elif k != "albedo":
            t.set_editor_property("srgb", False)
        EAL.save_loaded_asset(t)
        tex[k] = t
    return tex


def material(ref):
    """A material instance of M_StudioSurface for a texture set (the library's or the PBR shelf's); None if it isn't
    fetched or can't be made. Unreal's copy is checked first: it's imported only when it isn't there, or when the set's
    maps changed since (the stamp), so a rebuild costs nothing for sets Unreal already has."""
    key = "mat:" + ref
    if key in _done:
        return _done[key]
    meta = LIB.texture_meta(ref)
    mi = None
    if meta is None:
        unreal.log_warning(f"storykit: texture {ref} isn't fetched or on the PBR shelf (`python tools/cc0.py fetch`, "
                           f"`python tools/pbr.py`): keeping the grey")
    else:
        try:
            parent = master_material()
            dest, name = _where(ref)
            mpath = f"{dest}/{name}"
            stamp = str(meta.get("stamp") or "")
            tile = float(meta.get("tile_m", 2)) * 100
            mi = unreal.load_asset(mpath) if EAL.does_asset_exist(mpath) else None
            if mi is not None and (EAL.get_metadata_tag(mi, STAMP) or "") == stamp:
                _stats["had"] += 1
                if abs(MEL.get_material_instance_scalar_parameter_value(mi, "TileCm") - tile) > 0.01:
                    MEL.set_material_instance_scalar_parameter_value(mi, "TileCm", tile)
                    EAL.save_loaded_asset(mi)
            else:
                _stats["updated" if mi is not None else "imported"] += 1
                tex = _import_maps(ref, meta, dest)
                if mi is None:
                    tools = unreal.AssetToolsHelpers.get_asset_tools()
                    mi = tools.create_asset(name, dest, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
                    MEL.set_material_instance_parent(mi, parent)
                for k, pname in (("albedo", "Albedo"), ("normal", "Normal"), ("rough", "Rough"), ("ao", "AO")):
                    if k in tex:
                        MEL.set_material_instance_texture_parameter_value(mi, pname, tex[k])
                MEL.set_material_instance_scalar_parameter_value(mi, "TileCm", tile)
                if stamp:
                    EAL.set_metadata_tag(mi, STAMP, stamp)
                EAL.save_loaded_asset(mi)
        except Exception as e:   # noqa: BLE001 - a texture is a nicety: the grey block still works
            _stats["failed"] += 1
            unreal.log_warning(f"storykit: texture {ref} failed ({e}); see docs/ASSETS.md §5")
            mi = None
    _done[key] = mi
    return mi


def sync_pbr(refs=None):
    """The PBR shelf into Unreal (docs/ASSETS.md §6): every set (or `refs`) that Unreal hasn't got, or whose maps
    changed, is imported into /Game/Studio/PBR/<category>/<name>/ with its material instance. Returns the counts."""
    for k in _stats:
        _stats[k] = 0
    for ref in (refs or sorted(PBR.scan())):
        _done.pop("mat:" + ref, None)
        material(ref)
    unreal.log(f"storykit: PBR shelf: {_stats['had']} already in Unreal, {_stats['imported']} imported, "
               f"{_stats['updated']} re-imported (maps changed), {_stats['failed']} failed")
    return dict(_stats)
