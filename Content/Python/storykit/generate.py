"""The desk's Generate, in the editor: a game's story.json built as Unreal levels, the start level open, a result the
desk reads back. Started by tools/unreal_link.py: through UnrealClaude's port when the editor is open, or by
init_unreal.py when the desk started the editor for it. Never needs Claude.

    import storykit.generate as g; g.run("Pilot")

Writes Saved/Story/<Game>/generate/result.json: {"ok", "levels": {lid: {"pieces", "map"}}, "errors", "at"}.
"""
import importlib
import json
import time
import traceback

import unreal

from . import storylib as L


def fresh():
    """The editor imports storykit once; a Generate after a pull or an edit must run the files as they are now."""
    from . import importer, kit, library, pbr, plan, surfaces
    for m in (L, plan, library, kit, pbr, surfaces, importer):
        importlib.reload(m)
    return importer


def out_dir(game):
    d = L.ROOT / "Saved" / "Story" / game / "generate"
    d.mkdir(parents=True, exist_ok=True)
    return d


def write(game, result):
    (out_dir(game) / "result.json").write_text(json.dumps(result, indent=1), encoding="utf-8")


def run(game):
    result = {"ok": False, "game": game, "levels": {}, "errors": [], "started": time.time()}
    write(game, dict(result, state="building"))
    try:
        imp = fresh()
        story, _ = L.load(game)
        made = imp.build(game) or {}
        result["levels"] = made
        first = story["flow"].get(story["game"].get("start"), {})
        ref = story.get("scenes", {}).get(first.get("ref")) or story.get("stitches", {}).get(first.get("ref")) or {}
        start_level = ref.get("level") or next(iter(story["levels"]))
        if start_level in story["levels"]:
            unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(imp.map_path(game, start_level))
            result["open"] = imp.map_path(game, start_level)
        result["ok"] = True
    except Exception as e:  # noqa: BLE001 - the desk shows why
        result["errors"].append(f"{type(e).__name__}: {e}")
        result["trace"] = traceback.format_exc()
        unreal.log_error(f"storykit: generate {game} failed: {e}\n{result['trace']}")
    result["state"] = "done"
    result["at"] = time.time()
    write(game, result)
    unreal.log(f"GENERATE {'ok' if result['ok'] else 'FAILED'} ({game}: "
               + ", ".join(f"{k} {v.get('pieces', 0)} pieces" for k, v in result["levels"].items()) + ")")
    return result
