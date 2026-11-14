#!/usr/bin/env python3
"""A Godot project for building a game by hand (DECISIONS 2026-11-03, night: "if I decide to build the game completely in
Godot instead of through Director I can"; guides/godot_by_hand): what guides/godot_by_hand's setup does, in one go.

    python tools/godot_byhand.py new ~/Games/MyGame [--name "My Game"]
        a new project: project.godot (the HorrorStudio Look, UI, Weapons, Devices and Markers plugins on, the balanced
        look's settings), addons/horrorstudio_look, addons/horrorstudio_ui (the HUD and the quest marker),
        addons/horrorstudio_weapons (HSDoubleBarrel: a double-barrelled shotgun in first person, its shells, what a shot
        leaves, pickups), addons/horrorstudio_devices (HSLaptop: a laptop whose green terminal sells things for cash),
        addons/horrorstudio_markers (the NPC Markers tab: a character's whole part in the game placed as markers),
        HumanShaders/ (the skin's and the eyes' textures), starter/ (the by-hand guides' scripts: the player and its
        flashlight, doors and locks, the story on screen, the music and room tones, scares, pickups, notes, a
        character who doesn't like the light), sfx/ (the studio's sound shelf, CC0), music/ (the four moods),
        exports/interiors, exports/streets, exports/characters (where the studio's exports go)
    python tools/godot_byhand.py install ~/Games/MyGame
        the same add-ons into a project you have (again after a pull of the studio: they're copies; one the project
        didn't have yet is switched on in its project.godot); starter/, sfx/ and music/ only if they aren't there
        (they're yours to change)
    python tools/godot_byhand.py exports ~/Games/MyGame [--link]
        the studio's Exports/ (interiors, streets, characters) copied into the project's exports/; --link makes them
        links instead, so an export from the studio's editors is in the project at once (Godot imports it on focus)
    python tools/godot_byhand.py ready [--check]
        the ready-made exports (DECISIONS 2026-11-11: tutorial v2's hotel floor, Exports/interiors/hotel_floor, tracked
        in git so the tutorial can start in Godot) made again from their sets, the desk's server running; a .glb is kept
        as it was when what it holds is the same, so git sees a new one only when there is one. --check (READYMADE, in
        check_all): each one there, the one its ready.json records, and made from what its set holds now

Ends with what it did. The Director route instead: tools/godot_director.py."""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import godot as GD  # noqa: E402
from storykit import exports as EX  # noqa: E402

LOOK = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
UI = ROOT / "GodotPlugins" / "HorrorStudioUI" / "addons" / "horrorstudio_ui"
WEAPONS = ROOT / "GodotPlugins" / "HorrorStudioWeapons" / "addons" / "horrorstudio_weapons"
DEVICES = ROOT / "GodotPlugins" / "HorrorStudioDevices" / "addons" / "horrorstudio_devices"
MARKERS = ROOT / "GodotPlugins" / "HorrorStudioMarkers" / "addons" / "horrorstudio_markers"
PLUGINS = ["horrorstudio_look", "horrorstudio_ui", "horrorstudio_weapons", "horrorstudio_devices", "horrorstudio_markers"]   # what a by-hand project has switched on
HUMAN = ROOT / "GodotPlugins" / "HumanShaders"
STARTER = ROOT / "guides" / "first_game" / "starter"
SFX = ROOT / "Content" / "Studio" / "SFX"                       # the sound shelf (docs/SFX.md, CC0)
MOODS = ROOT / "Content" / "Studio" / "Music" / "moods"         # the music's moods (tools/score/moods.mjs)
TAILS = ROOT / "Saved" / "SFX" / "tails"                         # the sounds' reverb tails (tools/sfx.py tails)
KIMODO = ROOT / "GodotPlugins" / "HorrorStudioDirector" / "addons" / "horrorstudio_director" / "kimodo"   # the Kimodo reader and retarget
SOMA = ROOT / "Content" / "Studio" / "soma77.json"              # Kimodo's skeleton (the retarget reads it)


def project_godot(name):
    """project.godot: the name, the look plugin on, the balanced look's settings (what enabling it in the editor writes)"""
    lines = ["; Engine configuration file. Made by tools/godot_byhand.py (guides/godot_by_hand); yours to change.", "",
             "config_version=5", "", "[application]", f'config/name="{name}"', "",
             "[editor_plugins]", "enabled=PackedStringArray(%s)" % ", ".join(f'"res://addons/{n}/plugin.cfg"' for n in PLUGINS), ""]
    by = {}
    for k, v in GD.PROJECT_LOOK.items():
        sec, key = k.split("/", 1)
        by.setdefault(sec, []).append(f"{key}={'true' if v is True else 'false' if v is False else v}")
    for sec, kv in by.items():
        lines += [f"[{sec}]"] + kv + [""]
    return "\n".join(lines)


def enable(proj):
    """the studio's plugins a project.godot doesn't have switched on yet, switched on (one added since the project
    was made); -> the names added"""
    pg = proj / "project.godot"
    if not pg.is_file():
        return []
    text = pg.read_text(encoding="utf-8")
    added = [n for n in PLUGINS if f"res://addons/{n}/plugin.cfg" not in text and (proj / "addons" / n / "plugin.cfg").is_file()]
    if not added:
        return []
    more = ", ".join(f'"res://addons/{n}/plugin.cfg"' for n in added)
    if "enabled=PackedStringArray(" in text:
        head, rest = text.split("enabled=PackedStringArray(", 1)
        text = head + "enabled=PackedStringArray(" + (more + ", " if rest.lstrip()[:1] != ")" else more) + rest
    elif "[editor_plugins]" in text:
        text = text.replace("[editor_plugins]", f"[editor_plugins]\n\nenabled=PackedStringArray({more})", 1)
    else:
        text = text.rstrip("\n") + f"\n\n[editor_plugins]\n\nenabled=PackedStringArray({more})\n"
    pg.write_text(text, encoding="utf-8")
    return added


def install(proj, starter=True):
    """the look and UI plugins, HumanShaders and (when missing, or `starter`) the starter scripts into the project"""
    (proj / "addons").mkdir(parents=True, exist_ok=True)
    shutil.rmtree(proj / "addons" / "horrorstudio_look", ignore_errors=True)
    shutil.copytree(LOOK, proj / "addons" / "horrorstudio_look", ignore=shutil.ignore_patterns("*.import", "demo"))
    shutil.rmtree(proj / "addons" / "horrorstudio_ui", ignore_errors=True)
    shutil.copytree(UI, proj / "addons" / "horrorstudio_ui", ignore=shutil.ignore_patterns("*.import", "demo"))
    shutil.rmtree(proj / "addons" / "horrorstudio_weapons", ignore_errors=True)
    shutil.copytree(WEAPONS, proj / "addons" / "horrorstudio_weapons", ignore=shutil.ignore_patterns("*.import", "demo"))
    shutil.rmtree(proj / "addons" / "horrorstudio_devices", ignore_errors=True)
    shutil.copytree(DEVICES, proj / "addons" / "horrorstudio_devices", ignore=shutil.ignore_patterns("*.import", "demo"))
    shutil.rmtree(proj / "addons" / "horrorstudio_markers", ignore_errors=True)
    shutil.copytree(MARKERS, proj / "addons" / "horrorstudio_markers", ignore=shutil.ignore_patterns("*.import", "demo"))
    shutil.rmtree(proj / "HumanShaders", ignore_errors=True)
    shutil.copytree(HUMAN, proj / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    did = ["addons/horrorstudio_look", "addons/horrorstudio_ui", "addons/horrorstudio_weapons", "addons/horrorstudio_devices", "addons/horrorstudio_markers", "HumanShaders"]
    did += [f"{n} switched on" for n in enable(proj)]
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
    # Kimodo motions for a character's moves (starter/moves.gd): the Director's reader and retarget, the studio's code
    # as the add-ons are (copied every time), and a folder to drop the .npz files into
    if (KIMODO / "retarget.gd").is_file() and SOMA.is_file():
        (proj / "kimodo").mkdir(exist_ok=True)
        for f in ("npz.gd", "retarget.gd"):
            shutil.copy2(KIMODO / f, proj / "kimodo" / f)
        shutil.copy2(SOMA, proj / "kimodo" / "soma77.json")
        (proj / "animations").mkdir(exist_ok=True)
        did.append("kimodo (the Kimodo reader), animations/")
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


READY_HOW = "python tools/godot_byhand.py ready (the desk's server running: python tools/director/serve.py)"


def ready(check=False):
    """the ready-made exports (storykit/exports.py READY_MADE) made again from their sets, or (check) each one there, the
    one its ready.json records, and made from what its set holds now: (lines said, problems). A browser writes a level's
    pictures in a different order each time, so what's compared is the .glb's signature, not its bytes; when that's the
    same the bytes it had are put back."""
    said, bad = [], []
    for (kind, name), src in EX.READY_MADE.items():
        d, where = EX.EXPORTS / kind / name, f"Exports/{kind}/{name}"
        glb, rec_f, meta_f = d / f"{name}.glb", d / "ready.json", d / "export.json"
        rec = json.loads(rec_f.read_text(encoding="utf-8")) if rec_f.is_file() else {}
        if check:
            if not glb.is_file() or not rec:
                bad.append(f"{where}: no {glb.name if not glb.is_file() else 'ready.json'}: {READY_HOW}")
            elif EX.signature(glb)[0] != rec.get("signature"):
                bad.append(f"{where}/{glb.name} isn't the one its ready.json records (an export of your own over it? "
                           f"git checkout {where} puts the ready-made one back; {READY_HOW} makes it {src}'s again)")
            elif EX.fingerprint(src) != rec.get("story"):
                bad.append(f"{where} is older than {src}, changed since it was made ({rec.get('made', '?')}): {READY_HOW}")
            else:
                said.append(f"{where}: {src} as it is now (made {rec.get('made', '?')})")
            continue
        if kind != "interiors":
            bad.append(f"{where}: only interiors are made here (tools/director/levelexport.mjs)")
            continue
        desk = os.environ.get("DESK_URL", "http://127.0.0.1:8780/")
        try:
            urllib.request.urlopen(desk, timeout=5).read(1)
        except OSError:
            bad.append(f"{where}: the desk's server isn't answering at {desk}: python tools/director/serve.py, then again")
            continue
        old = (glb.read_bytes(), EX.signature(glb), meta_f.read_bytes() if meta_f.is_file() else None) if glb.is_file() else None
        r = subprocess.run([shutil.which("node") or "node", str(ROOT / "tools" / "director" / "levelexport.mjs"), "--game", src],
                           cwd=ROOT, capture_output=True, text=True, timeout=900)
        if r.returncode or not glb.is_file():
            bad.append(f"{where}: the export failed: " + (r.stdout + r.stderr).strip()[-400:])
            continue
        new = EX.signature(glb)
        if old and old[1][0] == new[0]:                # the same level: the bytes it had, so git sees nothing new
            glb.write_bytes(old[0])
            if old[2] is not None:
                meta_f.write_bytes(old[2])
            made = rec.get("made") or json.loads(old[2] or b"{}").get("made") or time.strftime("%Y-%m-%d %H:%M:%S")
            said.append(f"{where}: the same as before, kept")
        else:
            made = time.strftime("%Y-%m-%d %H:%M:%S")
            said.append(f"{where}: made again from {src} ({round(glb.stat().st_size / 1048576, 1)} MB)"
                        + (f": {EX.differ(old[1][1], new[1], ('the old', 'the new'))}" if old else ""))
        rec_f.write_text(json.dumps({"from": src, "made": made, "story": EX.fingerprint(src), "signature": new[0],
                                     "how": READY_HOW}, indent=1) + "\n", encoding="utf-8")
    return said, bad


def main(argv):
    if argv and argv[0] == "ready":
        said, bad = ready(check="--check" in argv)
        for s in said:
            print("  " + s)
        for b in bad:
            print("FAIL " + b)
        if "--check" in argv:
            print("READYMADE ok" if not bad else f"READYMADE FAILED ({len(bad)})")
        else:
            print("ready-made: done; commit what changed in Exports/" if not bad else "ready-made: not all made")
        return 1 if bad else 0
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
