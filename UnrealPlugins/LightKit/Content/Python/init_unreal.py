"""Runs when the editor starts with Light Kit on (Unreal runs every Content/Python/init_unreal.py it finds, the
project's and each plugin's): makes the kit's materials once the editor has loaded, if any is missing, so a fresh
checkout needs nothing run by hand. They're made from text (lightkit_materials.py) into /LightKit/Materials."""
import unreal


def _missing():
    import lightkit_materials as lk
    return [n for n in lk.MATERIALS if not unreal.EditorAssetLibrary.does_asset_exist(f"{lk.ROOT}/{n}")]


_handle, _quiet = None, 0.0


def _when_loaded(dt):
    global _quiet
    if unreal.AssetRegistryHelpers.get_asset_registry().is_loading_assets():
        _quiet = 0.0
        return
    _quiet += dt
    if _quiet < 2.0:                     # a moment after the last asset loaded
        return
    unreal.unregister_slate_post_tick_callback(_handle)
    try:
        missing = _missing()
        if missing:
            unreal.log(f"lightkit: making the materials it hasn't got ({', '.join(missing)})")
            import lightkit_materials
            lightkit_materials.build()
    except Exception as e:  # noqa: BLE001 - never stop the editor's start for this
        unreal.log_warning(f"lightkit: materials not made ({e}); in the Python console: import lightkit_materials; lightkit_materials.build()")


if hasattr(unreal, "EditorAssetLibrary"):   # the editor (EditorScriptingUtilities on), not a game or a commandlet without it
    _handle = unreal.register_slate_post_tick_callback(_when_loaded)
