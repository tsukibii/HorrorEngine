#!/usr/bin/env python3
"""A Godot project for building a game by hand (DECISIONS 2026-11-03, night: "if I decide to build the game completely in
Godot instead of through Director I can"; guides/godot_by_hand): what guides/godot_by_hand's setup does, in one go.

    python tools/godot_byhand.py new ~/Games/MyGame [--name "My Game"]
        a new project: project.godot (the HorrorStudio Look and UI plugins on, the balanced look's settings),
        addons/horrorstudio_look, addons/horrorstudio_ui (the HUD and the quest marker),
        HumanShaders/ (the skin's and the eyes' textures), starter/ (the by-hand guides' scripts: the player and its
        flashlight, doors and locks, the story on screen, the music and room tones, scares, pickups, notes, a
        character who doesn't like the light), sfx/ (the studio's sound shelf, CC0), music/ (the four moods),
        exports/interiors, exports/streets, exports/characters (where the studio's exports go)
    python tools/godot_byhand.py install ~/Games/MyGame
        the same add-ons into a project you have (again after a pull of the studio: they're copies); starter/, sfx/ and
        music/ only if they aren't there (they're yours to change)
    python tools/godot_byhand.py exports ~/Games/MyGame [--link]
        the studio's Exports/ (interiors, streets, characters) copied into the project's exports/; --link makes them
        links instead, so an export from the studio's editors is in the project at once (Godot imports it on focus)

Ends with what it did. The Director route instead: tools/godot_director.py."""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import godot as GD  # noqa: E402
from storykit import exports as EX  # noqa: E402

LOOK = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
UI = ROOT / "GodotPlugins" / "HorrorStudioUI" / "addons" / "horrorstudio_ui"
HUMAN = ROOT / "GodotPlugins" / "HumanShaders"
STARTER = ROOT / "guides" / "first_game" / "starter"
SFX = ROOT / "Content" / "Studio" / "SFX"                       # the sound shelf (docs/SFX.md, CC0)
MOODS = ROOT / "Content" / "Studio" / "Music" / "moods"         # the music's moods (tools/score/moods.mjs)
TAILS = ROOT / "Saved" / "SFX" / "tails"                         # the sounds' reverb tails (tools/sfx.py tails)


def project_godot(name):
    """project.godot: the name, the look plugin on, the balanced look's settings (what enabling it in the editor writes)"""
    lines = ["; Engine configuration file. Made by tools/godot_byhand.py (guides/godot_by_hand); yours to change.", "",
             "config_version=5", "", "[application]", f'config/name="{name}"', "",
             "[editor_plugins]", 'enabled=PackedStringArray("res://addons/horrorstudio_look/plugin.cfg", "res://addons/horrorstudio_ui/plugin.cfg")', ""]
    by = {}
    for k, v in GD.PROJECT_LOOK.items():
        sec, key = k.split("/", 1)
        by.setdefault(sec, []).append(f"{key}={'true' if v is True else 'false' if v is False else v}")
    for sec, kv in by.items():
        lines += [f"[{sec}]"] + kv + [""]
    return "\n".join(lines)


def install(proj, starter=True):
    """the look and UI plugins, HumanShaders and (when missing, or `starter`) the starter scripts into the project"""
    (proj / "addons").mkdir(parents=True, exist_ok=True)
    shutil.rmtree(proj / "addons" / "horrorstudio_look", ignore_errors=True)
    shutil.copytree(LOOK, proj / "addons" / "horrorstudio_look", ignore=shutil.ignore_patterns("*.import", "demo"))
    shutil.rmtree(proj / "addons" / "horrorstudio_ui", ignore_errors=True)
    shutil.copytree(UI, proj / "addons" / "horrorstudio_ui", ignore=shutil.ignore_patterns("*.import", "demo"))
    shutil.rmtree(proj / "HumanShaders", ignore_errors=True)
    shutil.copytree(HUMAN, proj / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    did = ["addons/horrorstudio_look", "addons/horrorstudio_ui", "HumanShaders"]
    if starter or not (proj / "starter").exists():
        shutil.copytree(STARTER, proj / "starter", dirs_exist_ok=True)
        did.append("starter")
    if (starter or not (proj / "sfx").exists()) and (SFX / "index.json").is_file():
        shutil.copytree(SFX, proj / "sfx", dirs_exist_ok=True, ignore=shutil.ignore_patterns("*.import", "__pycache__", "*.py"))
        did.append("sfx")
        # the rooms' reverb for the sound physics (starter/sound.gd): every sound's tails, rendered when stale
        # (tools/sfx.py tails: Saved/SFX/tails), into sfx/_tails
        if shutil.which("ffmpeg"):
            subprocess.run([sys.executable, str(ROOT / "tools" / "sfx.py"), "tails"], capture_output=True, text=True)
        if TAILS.is_dir():
            shutil.copytree(TAILS, proj / "sfx" / "_tails", dirs_exist_ok=True, ignore=shutil.ignore_patterns("*.import"))
            did.append("sfx/_tails")
    if (starter or not (proj / "music").exists()) and MOODS.is_dir():
        (proj / "music").mkdir(exist_ok=True)
        for f in MOODS.glob("*.ogg"):
            shutil.copy2(f, proj / "music" / f.name)
        did.append("music")
    for k in EX.KINDS:
        (proj / "exports" / k).mkdir(parents=True, exist_ok=True)
    return did


def exports(proj, link=False):
    """the studio's Exports/<kind>/ into the project's exports/<kind>/, copied or linked"""
    did = []
    for k in EX.KINDS:
        src, dst = EX.EXPORTS / k, proj / "exports" / k
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.is_symlink():
            dst.unlink()
        elif link and dst.exists():
            if any(dst.iterdir()):
                raise SystemExit(f"{dst} has files of its own: move them out first (--link puts a link to the studio's {src} there)")
            dst.rmdir()
        if link:
            dst.symlink_to(src.resolve(), target_is_directory=True)
            did.append(f"exports/{k} -> {src}")
            continue
        dst.mkdir(exist_ok=True)
        for d in sorted(p for p in src.iterdir() if p.is_dir()):
            shutil.rmtree(dst / d.name, ignore_errors=True)
            shutil.copytree(d, dst / d.name)
            did.append(f"exports/{k}/{d.name}")
    return did


def main(argv):
    if len(argv) < 2 or argv[0] not in ("new", "install", "exports"):
        print(__doc__)
        return 2
    proj = Path(argv[1]).expanduser().resolve()
    if argv[0] == "new":
        if (proj / "project.godot").exists():
            print(f"{proj} is a Godot project already: python tools/godot_byhand.py install {proj}")
            return 1
        proj.mkdir(parents=True, exist_ok=True)
        name = argv[argv.index("--name") + 1] if "--name" in argv else proj.name
        (proj / "project.godot").write_text(project_godot(name), encoding="utf-8")
        did = install(proj)
        print(f"a new Godot project in {proj}: project.godot, {', '.join(did)}, exports/{{interiors,streets,characters}}")
        print("open it in Godot 4.7 (Import, its project.godot); guides/godot_by_hand and guides/first_game say what's next")
    elif argv[0] == "install":
        if not (proj / "project.godot").exists():
            print(f"no project.godot in {proj}: python tools/godot_byhand.py new {proj}")
            return 1
        did = install(proj, starter=False)
        print(f"into {proj}: {', '.join(did)}")
    else:
        if not (proj / "project.godot").exists():
            print(f"no project.godot in {proj}")
            return 1
        did = exports(proj, link="--link" in argv)
        print(f"into {proj}: " + (", ".join(did) or "nothing yet: export from the scene builder, the street builder or the Character Studio first"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
