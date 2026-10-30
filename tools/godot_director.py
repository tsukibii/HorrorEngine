#!/usr/bin/env python3
"""The Director plugin's projects (docs/GODOT_DIRECTOR.md, DECISIONS 2026-10-30, night): a game built in Godot itself.

    python tools/godot_director.py new <folder> [--title T] [--sample] [--link]
        a new Godot 4.7 project ready to build a game in: the four add-ons (the runtime, the look, the Director,
        HumanShaders), the sound shelf and the little things' lives, the balanced look's project settings, the
        plugins on, a main scene with an HSGame and a first room (--sample: the sample game, a small house with a
        story to play through, built by Godot itself)
    python tools/godot_director.py install <folder> [--link]
        the add-ons, the shelf and the lives into an existing project (again after a pull: they're copies), the
        plugins switched on; --link makes them symlinks into this repo instead, so a pull reaches the project at once
    python tools/godot_director.py check [--keep]
        DIRECTOR: a sample project made in Saved/Godot/_director_check, imported, and its game compiled and played
        headless to its ending (tests/director_check.gd), the editor opened on it with the plugin (the dock, the
        nodes; tests/editor_check.gd), a Kimodo motion retargeted onto a skeleton (tests/kimodo_check.gd). Ends
        "DIRECTOR ok".
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import godot as G  # noqa: E402

DIRECTOR = ROOT / "GodotPlugins" / "HorrorStudioDirector" / "addons" / "horrorstudio_director"
RUNTIME = ROOT / "tools" / "godot" / "addons" / "horrorstudio"
LOOK = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
HUMAN = ROOT / "GodotPlugins" / "HumanShaders"
SFX = ROOT / "Content" / "Studio" / "SFX"
LIVES = ROOT / "Content" / "Studio" / "Life" / "lives.json"
SOMA = ROOT / "Content" / "Studio" / "soma77.json"
CHECK = ROOT / "Saved" / "Godot" / "_director_check"
PLUGINS = ["res://addons/horrorstudio_director/plugin.cfg", "res://addons/horrorstudio_look/plugin.cfg"]

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def project_godot(title):
    safe = "".join(ch if ch.isalnum() else "_" for ch in title).strip("_") or "game"
    return f'''; Engine configuration file.
; Made by tools/godot_director.py (the HorrorStudio Director plugin); the game's own settings go here too.

config_version=5

[application]

config/name={G.gstr(title)}
config/use_custom_user_dir=true
config/custom_user_dir_name={G.gstr("horrorstudio_" + safe)}
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.7", "Forward Plus")

[display]

window/size/viewport_width=1280
window/size/viewport_height=720

[editor_plugins]

enabled=PackedStringArray({", ".join(G.gstr(p) for p in PLUGINS)})

[rendering]

renderer/rendering_method="forward_plus"
''' + "".join(f"{k[len('rendering/'):]}={'true' if v is True else 'false' if v is False else v}\n" for k, v in G.PROJECT_LOOK.items()) + '''
[horrorstudio]

look/settings_applied=true
'''


FIRST_SCENE = '''[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://addons/horrorstudio_director/story/game.gd" id="game"]
[ext_resource type="Script" path="res://addons/horrorstudio_director/level/level.gd" id="level"]
[ext_resource type="Script" path="res://addons/horrorstudio_director/level/room.gd" id="room"]
[ext_resource type="Script" path="res://addons/horrorstudio_director/level/spot.gd" id="spot"]

[node name="Game" type="Node"]
script = ExtResource("game")
title = {title}

[node name="House" type="Node3D" parent="."]
script = ExtResource("level")
id = "house"

[node name="Hall" type="Node3D" parent="House"]
script = ExtResource("room")
id = "hall"

[node name="Start" type="Marker3D" parent="House"]
transform = Transform3D(-1, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1)
script = ExtResource("spot")
id = "start"

[node name="Story" type="Node" parent="."]
'''


def place(src, dst, link):
    """One add-on (or folder) into the project: a copy, or a symlink into the repo."""
    if dst.is_symlink() or dst.is_file():
        dst.unlink()
    elif dst.exists():
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if link:
        os.symlink(src, dst, target_is_directory=True)
    else:
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns(".godot", "*.uid.bak", "__pycache__", "*.import") if src != HUMAN else shutil.ignore_patterns("*.import"))


def install(out, link=False):
    out = Path(out).resolve()
    place(RUNTIME, out / "addons" / "horrorstudio", link)
    place(LOOK, out / "addons" / "horrorstudio_look", link)
    place(DIRECTOR, out / "addons" / "horrorstudio_director", link)
    if HUMAN.exists():
        place(HUMAN, out / "HumanShaders", link)
    game = out / "game"
    game.mkdir(exist_ok=True)
    if (SFX / "index.json").exists():
        place(SFX, game / "sfx", link)
    if LIVES.exists():
        shutil.copy(LIVES, game / "lives.json")
    if not (game / "life_things.json").exists():
        (game / "life_things.json").write_text("{}", encoding="utf-8")
    kimodo = out / "kimodo"
    kimodo.mkdir(exist_ok=True)
    if SOMA.exists():
        shutil.copy(SOMA, kimodo / "soma77.json")
    (kimodo / "studio_root.txt").write_text(str(ROOT), encoding="utf-8")     # where Kimodo's stage file and tools/kimodo.py are
    (kimodo / "motions").mkdir(exist_ok=True)
    bodies = out / "bodies"                                                   # MHR (Meta's, Apache-2.0): a body to try motions on
    bodies.mkdir(exist_ok=True)
    for f in ("MHR.fbx", "MHR_LICENSE.txt"):
        if (ROOT / "Content" / "Studio" / "Bodies" / f).exists():
            shutil.copy(ROOT / "Content" / "Studio" / "Bodies" / f, bodies / f)
    pg = out / "project.godot"
    if pg.exists():
        text = pg.read_text(encoding="utf-8")
        if "[editor_plugins]" not in text:
            text += "\n[editor_plugins]\n\nenabled=PackedStringArray(%s)\n" % ", ".join(G.gstr(p) for p in PLUGINS)
        else:
            for p in PLUGINS:
                if p not in text:
                    text = text.replace("enabled=PackedStringArray(", "enabled=PackedStringArray(%s, " % G.gstr(p), 1)
        pg.write_text(text, encoding="utf-8")
    gi = out / ".gitignore"
    if not gi.exists():
        gi.write_text(".godot/\n*.import\n", encoding="utf-8")
    return out


def godot():
    g = G.godot_bin()
    if not g:
        sys.exit("no godot on the PATH ($GODOT, godot or godot-mono; tools/godot_setup.sh on a cloud session)")
    return g


def run_godot(args, timeout=600, env=None):
    e = dict(os.environ)
    if env:
        e.update(env)
    try:
        r = subprocess.run([godot(), *args], capture_output=True, text=True, timeout=timeout, env=e)
        return r.returncode, r.stdout + r.stderr
    except subprocess.TimeoutExpired as ex:
        return 124, (ex.stdout or b"").decode("utf-8", "replace") if isinstance(ex.stdout, bytes) else str(ex.stdout or "")


def quiet(text):
    return "\n".join(l for l in text.splitlines() if not any(w in l for w in ("ALSA", "snd_", "ERR_CANT_OPEN", "at: cleanup", "at: clear (core")))


def new(out, title="My HorrorStudio game", sample=False, link=False):
    out = Path(out).resolve()
    if out.exists() and any(out.iterdir()):
        sys.exit(f"{out} isn't empty: `install` puts the add-ons into an existing project")
    out.mkdir(parents=True, exist_ok=True)
    (out / "project.godot").write_text(project_godot(title), encoding="utf-8")
    install(out, link)
    (out / "main.tscn").write_text(FIRST_SCENE.format(title=G.gstr(title)), encoding="utf-8")
    code, text = run_godot(["--headless", "--path", str(out), "--import"], timeout=900)
    if sample:
        code, text = run_godot(["--headless", "--path", str(out), "-s", "res://addons/horrorstudio_director/tests/make_sample.gd"], timeout=300)
        if "SAMPLE ok" not in text:
            print(quiet(text)[-3000:])
            sys.exit("the sample wasn't made")
        run_godot(["--headless", "--path", str(out), "--import"], timeout=900)
    print(f"DIRECTOR project {out}: open it in Godot 4.7 (the HorrorStudio dock is on the right), F5 plays main.tscn")
    return out


def check(keep=False):
    if CHECK.exists():
        shutil.rmtree(CHECK)
    out = new(CHECK, "Director check", sample=True)
    ok = True
    code, text = run_godot(["--headless", "--fixed-fps", "60", "--path", str(out), "-s", "res://addons/horrorstudio_director/tests/director_check.gd"], timeout=900)
    text = quiet(text)
    for l in text.splitlines():
        if l.strip().startswith(("ok ", "BAD", "DIRECTOR")) or "SCRIPT ERROR" in l or "Parse Error" in l:
            print("  " + l.strip())
    if "DIRECTORPLAY ok" not in text:
        print(text[-4000:])
        ok = False
    ok = kimodo_check(out) and ok
    ok = editor_check(out) and ok
    print("DIRECTOR ok" if ok else "DIRECTOR FAIL")
    return 0 if ok else 1


def kimodo_check(out):
    """The Kimodo link (tests/kimodo_check.gd): a motion made on SOMA through an .npz and back, retargeted onto SOMA and onto
    MHR, in place, and the sample's house sent as a stage from where Mari stands."""
    code, text = run_godot(["--headless", "--path", str(out), "-s", "res://addons/horrorstudio_director/tests/kimodo_check.gd"], timeout=300)
    line = next((l for l in quiet(text).splitlines() if l.startswith("KIMODOCHECK ")), None)
    if line is None:
        print(quiet(text)[-3000:])
        print("  BAD the Kimodo check's report never came")
        return False
    r = json.loads(line[len("KIMODOCHECK "):])
    kinds = r.get("stage_kinds", {})
    checks = [
        ("a Kimodo .npz written and read back: %s frames, %.6f m off" % (r.get("npz_frames"), r.get("npz_err", 1)), r.get("npz_frames") == 31 and r.get("npz_err", 1) < 1e-6),
        ("onto Kimodo's own skeleton: every joint where the motion put it (%.2f cm at worst, %s)" % (r.get("soma_err_cm", 99), r.get("soma_err_at")), r.get("family_soma") == "soma" and r.get("soma_err_cm", 99) < 0.5),
        ("onto the Character Studio's MHR: the limbs pointing SOMA's way (%.2f° at worst), the hips at its height (%.3f)" % (r.get("mhr_limb_deg", 99), r.get("mhr_hip_ratio", 0)),
         r.get("family_mhr") == "mhr" and r.get("mhr_limb_deg", 99) < 1.0 and 0.88 < r.get("mhr_hip_ratio", 0) < 0.97),
        ("in place: the travel gone (%.3f m of %.2f), the sway kept (%.3f m), looping" % (r.get("in_place_travel", 9), r.get("full_travel", 0), r.get("in_place_sway", 0)),
         r.get("in_place_travel", 9) < 0.01 and abs(r.get("full_travel", 0) - 1.2) < 0.01 and r.get("in_place_sway", 0) > 0.02 and r.get("in_place_loop") is True),
        ("the house as Kimodo's stage from Mari: %d boxes %s, %d door swings, marks %s, the hall's floor where it is from her" % (r.get("stage_boxes", 0), json.dumps(kinds), r.get("stage_arcs", 0), r.get("stage_marks")),
         r.get("stage_boxes", 0) >= 20 and all(kinds.get(k, 0) > 0 for k in ("floor", "wall", "door", "use")) and r.get("stage_arcs") == 2
         and any(m.endswith(":player") for m in r.get("stage_marks", [])) and r.get("stage_floor_ok") is True),
    ]
    ok = True
    for what, good in checks:
        print(("  ok  " if good else "  BAD ") + what)
        ok = ok and good
    return ok


def editor_check(out):
    """The plugin in the editor itself: tests/editor_check.gd installed as a plugin of its own beside the Director's, the
    editor opened on the sample (headless: the dock's logic, no pictures), its report read."""
    t = out / "addons" / "hs_director_editor_test"
    t.mkdir(parents=True, exist_ok=True)
    (t / "plugin.cfg").write_text('[plugin]\nname="hs director editor test"\ndescription=""\nauthor=""\nversion="1"\nscript="plugin.gd"\n', encoding="utf-8")
    shutil.copy(DIRECTOR / "tests" / "editor_check.gd", t / "plugin.gd")
    pg = out / "project.godot"
    before = pg.read_text(encoding="utf-8")
    pg.write_text(before.replace("enabled=PackedStringArray(", 'enabled=PackedStringArray("res://addons/hs_director_editor_test/plugin.cfg", ', 1), encoding="utf-8")
    code, text = run_godot(["--headless", "--editor", "--path", str(out)], timeout=600)
    pg.write_text(before, encoding="utf-8")
    shutil.rmtree(t, ignore_errors=True)
    text = quiet(text)
    line = next((l for l in text.splitlines() if l.startswith("HSDIRECTOREDITOR ")), None)
    errs = [l for l in text.splitlines() if ("SCRIPT ERROR" in l or "Parse Error" in l) and "hs_director_editor_test" not in l]
    if line is None:
        print(text[-4000:])
        print("  BAD the editor's report never came")
        return False
    rep = json.loads(line[len("HSDIRECTOREDITOR "):])
    flags = rep.get("flags_rows", [])
    checks = [
        ("the editor opens the sample with the plugin on: the dock found", rep.get("dock") is True),
        ("Story: the chapter, its steps and the choice in play order (%d rows)" % rep.get("story_rows", 0), rep.get("story_has") is True),
        ("Events: the figure's jumpscare as its sentence (when the player enters kitchen_doorway, if read_letter, then JUMPSCARE)", rep.get("events_has_scare") is True),
        ("Flags: read_letter, promised, saw_figure and the rest (%s)" % ", ".join(flags), any(f.startswith("read_letter") for f in flags) and any(f.startswith("saw_figure") for f in flags)),
        ("Things and Check drawn (%s)" % rep.get("check_summary", ""), rep.get("things_rows", 0) > 10 and "tasks" in rep.get("check_summary", "")),
        ("the running game followed: ▶ on the step it's at, ● on the flags it has set", rep.get("live_now") is True and rep.get("live_flags") is True),
        ("+ Task after the selected step, with its first to-do; undone and redone", rep.get("task_added") is True and rep.get("task_has_todo") is True and rep.get("task_undone") is True and rep.get("task_redone") is True),
        ("the jumpscare template: an area with its event (jumpscare, a thought, a flag), listed", rep.get("jumpscare_made") is True and rep.get("jumpscare_listed") is True),
        ("Add: a key placed in the selected room, a node of the scene's own", rep.get("preset_placed") is True),
        ("saved: the new nodes in the file, nothing the nodes make for themselves", rep.get("saved") is True and rep.get("saved_task") is True and rep.get("saved_nothing_made") is True),
        ("no script errors in the editor", not errs),
    ]
    if errs:
        print("\n".join(errs[:12]))
    ok = True
    for what, good in checks:
        print(("  ok  " if good else "  BAD ") + what)
        ok = ok and good
    return ok


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    opt = lambda k, d=None: rest[rest.index(k) + 1] if k in rest else d   # noqa: E731
    if cmd == "new":
        if not rest:
            sys.exit("new <folder>")
        new(rest[0], opt("--title", "My HorrorStudio game"), "--sample" in rest, "--link" in rest)
        return 0
    if cmd == "install":
        if not rest:
            sys.exit("install <folder>")
        print(f"DIRECTOR installed into {install(rest[0], '--link' in rest)}")
        return 0
    if cmd == "check":
        return check("--keep" in rest)
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
