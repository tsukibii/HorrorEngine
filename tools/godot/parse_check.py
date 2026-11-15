#!/usr/bin/env python3
"""PARSE: every runtime script of the by-hand plugins (Look, UI, Weapons, Devices, Markers) and the starter kit loaded
by Godot 4.7, and every preset and prefab instanced, in a small project of its own (Saved/Godot/_parse): a parse error
or a broken reference is found in about a minute instead of by whichever 2 to 50 minute suite loads that file (the
enhancements review, docs/TOOLS_REVIEW.md). Editor scripts are the editor checks' (MARKERSEDITOR, LOGICEDITOR).

    python tools/godot/parse_check.py          (Godot: $GODOT or godot; none on the PATH: said, and skipped)

The project is kept between runs: the files are copied with their times, so only what changed is imported again.
Ends "PARSE ok" (or "PARSE FAILED")."""
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PROJ = ROOT / "Saved" / "Godot" / "_parse"
PLUG = ROOT / "GodotPlugins"
COPIES = [(PLUG / "HorrorStudioLook/addons/horrorstudio_look", "addons/horrorstudio_look"),
          (PLUG / "HorrorStudioUI/addons/horrorstudio_ui", "addons/horrorstudio_ui"),
          (PLUG / "HorrorStudioWeapons/addons/horrorstudio_weapons", "addons/horrorstudio_weapons"),
          (PLUG / "HorrorStudioDevices/addons/horrorstudio_devices", "addons/horrorstudio_devices"),
          (PLUG / "HorrorStudioMarkers/addons/horrorstudio_markers", "addons/horrorstudio_markers"),
          (PLUG / "HumanShaders", "HumanShaders"),
          (ROOT / "guides/first_game/starter", "starter")]
KIMODO = PLUG / "HorrorStudioDirector/addons/horrorstudio_director/kimodo"
SOMA = ROOT / "Content/Studio/soma77.json"
PROJECT = """config_version=5

[application]

config/name="Parse"

[rendering]

renderer/rendering_method="forward_plus"
"""


def godot():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def main():
    g = godot()
    if not g:
        print("PARSE ok (skipped: no godot on the PATH; tools/godot_setup.sh on a cloud session)")
        return 0
    PROJ.mkdir(parents=True, exist_ok=True)
    (PROJ / "project.godot").write_text(PROJECT, encoding="utf-8")
    for src, dst in COPIES:                          # copy2 keeps each file's time: what hasn't changed isn't imported again
        shutil.rmtree(PROJ / dst, ignore_errors=True)
        shutil.copytree(src, PROJ / dst, ignore=shutil.ignore_patterns("*.import", "demo", "*.uid"))
    if (KIMODO / "retarget.gd").is_file():
        (PROJ / "kimodo").mkdir(exist_ok=True)
        for f in ("npz.gd", "retarget.gd"):
            shutil.copy2(KIMODO / f, PROJ / "kimodo" / f)
        if SOMA.is_file():
            shutil.copy2(SOMA, PROJ / "kimodo" / "soma77.json")
    shutil.copy2(HERE / "parse_all.gd", PROJ / "parse_all.gd")
    imp = subprocess.run([g, "--headless", "--path", str(PROJ), "--import"], capture_output=True, text=True, timeout=2400)
    r = subprocess.run([g, "--headless", "--path", str(PROJ), "-s", "parse_all.gd"], capture_output=True, text=True, timeout=600)
    text = r.stdout + r.stderr
    said = [l for l in text.splitlines() if l.startswith("PARSEALL")]
    errs = [l.strip() for l in text.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l or "Failed to load" in l or "Cannot load" in l]
    errs += [l.strip() for l in (imp.stdout + imp.stderr).splitlines() if "Parse Error" in l][:5]
    if said:
        print("  " + said[-1])
        if "failed []" not in said[-1]:
            errs.append(said[-1])
    else:
        errs.append("Godot said nothing: " + text.strip()[-600:])
    seen = []
    for e in errs:
        if e not in seen:
            seen.append(e)
    for e in seen[:25]:
        print("ERROR: " + e)
    if seen:
        print(f"PARSE FAILED ({len(seen)})")
        return 1
    print("PARSE ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
