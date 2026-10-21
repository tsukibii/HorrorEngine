"""Runs when the editor starts (Unreal runs every Content/Python/init_unreal.py). UnrealClaude starts its own MCP
server (port 3000); this makes the story tools importable, and runs a Generate the desk asked for while the editor was
closed (tools/unreal_link.py leaves Saved/Story/<Game>/generate/pending), once the editor has finished loading."""
import unreal

from storykit import storylib


def _no_auto_import():
    """Content/ holds the studio's own files (story.json, the kit's index, glb, png). Unreal must never offer to import
    them: its prompt is modal, can open blank or deaf under XWayland, and holds the editor and every MCP call (LESSONS).
    The settings aren't visible to Python, and the editor saves its own per-user value over the project's default, so
    the saved file is put right here, for the next start (this one read it already)."""
    try:
        f = storylib.ROOT / "Saved" / "Config" / "LinuxEditor" / "EditorPerProjectUserSettings.ini"
        if f.exists():
            text = f.read_text(encoding="utf-8")
            fixed = text.replace("bMonitorContentDirectories=True", "bMonitorContentDirectories=False") \
                        .replace("bAutoCreateAssets=True", "bAutoCreateAssets=False")
            if fixed != text:
                f.write_text(fixed, encoding="utf-8")
                unreal.log_warning("storykit: Unreal's auto-import was back on; off again from the next start")
    except Exception as e:  # noqa: BLE001 - never stop the editor's start for this
        unreal.log_warning(f"storykit: couldn't check the auto-import setting: {e}")


_no_auto_import()
unreal.log(f"storykit: ready, games {storylib.games()} (import storykit.importer as i; i.build('<Game>'))")

_pending = sorted(storylib.ROOT.glob("Saved/Story/*/generate/pending"))
_handle, _quiet = None, 0.0


def _when_loaded(dt):
    global _handle, _quiet
    if unreal.AssetRegistryHelpers.get_asset_registry().is_loading_assets():
        _quiet = 0.0
        return
    _quiet += dt
    if _quiet < 3.0:                     # a few seconds after the last asset loaded: the start map is open and drawn
        return
    unreal.unregister_slate_post_tick_callback(_handle)
    from storykit import generate
    for f in _pending:
        game = f.parent.parent.name
        f.unlink()
        generate.run(game)


if _pending:
    _handle = unreal.register_slate_post_tick_callback(_when_loaded)
