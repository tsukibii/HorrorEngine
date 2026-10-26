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
    from . import importer, kit, library, pbr, people, plan, surfaces
    for m in (L, plan, library, kit, pbr, surfaces, people, importer):
        importlib.reload(m)
    return importer


def out_dir(game):
    d = L.ROOT / "Saved" / "Story" / game / "generate"
    d.mkdir(parents=True, exist_ok=True)
    return d


def write(game, result):
    (out_dir(game) / "result.json").write_text(json.dumps(result, indent=1), encoding="utf-8")


def import_bodies(game):
    """Each cast member's body as the desk shows it (Previs/Body_<who>.glb, written by the desk's bake) as a skeletal
    mesh in /Game/Games/<Game>/Imported/Bodies/<who>/<hash>: a folder per version of the file, so an unchanged body
    isn't imported again and a changed one never replaces an asset a map still uses. A cast member who is a Character
    Studio character (previs_body people/<name>) goes across as the Studio's own export instead (storykit.people:
    every part on the same skeleton, the eyes wearing M_StudioEye), posed by the same bake."""
    import hashlib
    from . import people
    studio = people.cast_people(L.load(game)[0])
    found = {}
    for f in sorted((L.GAMES / game / "Previs").glob("Body_*.glb")):
        who = f.stem[5:]
        if who in studio:
            mesh = people.safe_import(studio[who])
            if mesh is not None:
                found[who] = mesh
                continue
            unreal.log_warning(f"storykit: {who}'s Studio character ({studio[who]}) didn't import: the desk's body stands in")
        dest = f"/Game/Games/{game}/Imported/Bodies/{who}/v{hashlib.sha1(f.read_bytes()).hexdigest()[:10]}"

        def mesh_in(d):
            for path in unreal.EditorAssetLibrary.list_assets(d, recursive=True) if unreal.EditorAssetLibrary.does_directory_exist(d) else []:
                a = unreal.load_asset(path)
                if isinstance(a, unreal.SkeletalMesh):
                    return a
            return None

        found[who] = mesh_in(dest)
        if found[who] is None:
            task = unreal.AssetImportTask()
            task.set_editor_property("filename", str(f))
            task.set_editor_property("destination_path", dest)
            task.set_editor_property("automated", True)
            task.set_editor_property("save", True)
            unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
            found[who] = mesh_in(dest)
        if found[who] is None:
            del found[who]
            unreal.log_warning(f"storykit: {f.name} didn't import as a skeletal mesh: {who} stays a figure")
    return found


def run(game):
    result = {"ok": False, "game": game, "levels": {}, "errors": [], "started": time.time()}
    write(game, dict(result, state="building"))
    try:
        imp = fresh()
        story, _ = L.load(game)
        bodies = import_bodies(game)
        result["bodies"] = {k: v.get_path_name() for k, v in bodies.items()}
        made = imp.build(game, bodies=bodies) or {}
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
