#!/usr/bin/env python3
"""Packages ONE game out of the studio project: only its maps, what they reference, and what its manifest lists.

    python tools/package_game.py --game Pilot [--config Shipping|Development] [--out D:/Builds] [--dry]

How (docs/STUDIO.md has the why):
  1. copies the game's story.json to Content/StoryData/<Game>/ (a folder holding only JSON, staged as a plain file;
     the runner reads it from there in a packaged build);
  2. writes the per-game packaging settings into Config/DefaultGame.ini between `; >>> package_game` markers:
     the maps to cook, the start map, the title, the JSON folder to stage, and the game's manifest folder to always
     cook (the importer writes /Game/Games/<Game>/Manifest/DA_<Game>_Manifest with a soft reference to every asset the
     story names: art, audio, sequences, MetaHumans, animations, so nothing reached only by a path string is missed);
  3. runs RunUAT BuildCookRun for Win64; 4. puts DefaultGame.ini back as it was, whatever happened.
The output is <out>/<Game>/Windows/. The .exe carries the project's name (rename the project once, not per game).
V0: written before it ever ran; SETUP S12 runs it on the pilot and fixes it.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402

MARK_A, MARK_B = "; >>> package_game (temporary)", "; <<< package_game"


def credits(story, folder):
    """THIRD_PARTY.md beside the build: the library assets this game uses, from the ledger (docs/ASSETS.md)."""
    from storykit import library as LIB
    led, used = LIB.ledger(), sorted({ref for _, ref, _ in LIB.refs(story)})
    rows = [f"| {r} | {led[r]['source']} | {led[r]['licence']} | {led[r]['url']} |" for r in used if r in led]
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "THIRD_PARTY.md").write_text("# Third-party assets\n\n| Asset | Source | Licence | From |\n| --- | --- | --- | --- |\n"
                                           + "\n".join(rows) + "\n", encoding="utf-8")


def main():
    game, args = L.pick_game(sys.argv[1:])
    story, spath = L.load(game)
    game = spath.parent.name
    cfg = args[args.index("--config") + 1] if "--config" in args else "Shipping"
    out = Path(args[args.index("--out") + 1]) if "--out" in args else ROOT / "Builds"
    env = json.loads((ROOT / "setup" / "env.json").read_text(encoding="utf-8"))
    uproject = Path(env["uproject"])
    flow = story["flow"]
    first = flow[story["game"]["start"]]
    first_ref = (story["scenes"] if first["type"] == "scene" else story["stitches"]).get(first.get("ref"), {})
    start_level = L.level_of(story, first_ref)
    maps = [f"/Game/Games/{game}/Maps/L_{lid}" for lid in story["levels"]]
    start_map = f"/Game/Games/{game}/Maps/L_{start_level}"

    data = ROOT / "Content" / "StoryData" / game
    data.mkdir(parents=True, exist_ok=True)
    shutil.copy(spath, data / "story.json")

    ini = ROOT / "Config" / "DefaultGame.ini"
    original = ini.read_text(encoding="utf-8") if ini.exists() else ""
    block = "\n".join([
        MARK_A,
        "[/Script/EngineSettings.GeneralProjectSettings]",
        f"ProjectDisplayedTitle=NSLOCTEXT(\"[/Script/EngineSettings]\", \"Title\", \"{story['game'].get('title', game)}\")",
        "[/Script/EngineSettings.GameMapsSettings]",
        f"GameDefaultMap={start_map}",
        "[/Script/UnrealEd.ProjectPackagingSettings]",
        "bCookAll=False",
        "bCookMapsOnly=False",
        *[f"+MapsToCook=(FilePath=\"{m}\")" for m in maps],
        f"+DirectoriesToAlwaysCook=(Path=\"/Game/Games/{game}/Manifest\")",
        f"+DirectoriesToAlwaysStageAsUFS=(Path=\"StoryData/{game}\")",
        MARK_B, ""])
    uat = Path(env["engine"]) / "Engine" / "Build" / "BatchFiles" / "RunUAT.bat"
    cmd = [str(uat), "BuildCookRun", f"-project={uproject}", "-noP4", "-platform=Win64", f"-clientconfig={cfg}",
           "-build", "-cook", "-stage", "-pak", "-archive", f"-archivedirectory={out / game}", "-utf8output",
           "-map=" + "+".join(maps)]
    print("maps:", ", ".join(maps), "| start:", start_map)
    print(" ".join(cmd))
    if "--dry" in args:
        print(block)
        print("PACKAGE dry run (nothing changed but Content/StoryData)")
        return
    try:
        ini.write_text(original.rstrip("\n") + "\n\n" + block, encoding="utf-8")
        r = subprocess.run(cmd)
    finally:
        ini.write_text(original, encoding="utf-8")
    if r.returncode == 0:
        credits(story, out / game)
    print(f"PACKAGE ok -> {out / game}" if r.returncode == 0 else f"PACKAGE FAILED ({r.returncode}): read the UAT log above")
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
