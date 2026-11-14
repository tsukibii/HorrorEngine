"""LOGIC: flags, things and markers as one system (docs/FLAGS.md), played headless in Godot 4.7.

    python tools/godot/logic_check.py [--reuse] [--keep DIR] [--only A,B]
        a by-hand project (godot_byhand.py new: the Markers plugin on), a floor, the starter's Story and player.
        logic_test.gd builds things with a Logic node (HSLogic) and a character's markers and plays them: a door that
        works only while a flag is on (and says why when it isn't), a pickup that switches flags and ticks a task when
        it's used, a door's own signal, an area only the player sets off, a rule that happens by itself, a marker
        waiting for a door and a safe waiting for a marker, a checkpoint put back, and the scene read (HSLogicScan):
        every flag with who turns it on and who needs it, whose it is, what can't work, a rename moving every use.
        Ends "LOGIC ok".

    python tools/godot/logic_check.py --editor [--reuse] [--shots DIR]
        LOGICEDITOR: the Flags and Things tabs driven in the editor itself on the same project (logic_editor_test.gd,
        installed as a plugin of its own). --shots: pictures of the editor, under xvfb.

Godot is $GODOT, else godot.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import godot_byhand as BH  # noqa: E402

HERE = Path(__file__).resolve().parent

MAIN = """[gd_scene load_steps=4 format=3]

[ext_resource type="PackedScene" path="res://starter/player.tscn" id="player"]
[ext_resource type="Script" path="res://starter/story.gd" id="story"]

[sub_resource type="BoxShape3D" id="floor"]
size = Vector3(80, 0.2, 80)

[node name="Main" type="Node3D"]

[node name="Floor" type="StaticBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.1, 0)

[node name="Shape" type="CollisionShape3D" parent="Floor"]
shape = SubResource("floor")

[node name="Story" type="CanvasLayer" parent="."]
script = ExtResource("story")
tasks = PackedStringArray("book: Find the missing book.")

[node name="Player" parent="." instance=ExtResource("player")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 20, 0.1, 20)
"""


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def run(cmd, timeout=1800, env=None):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)


def project(args, name):
    """the scratch project, made or reused; -> its folder"""
    g = godot_bin()
    proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_logic"
    mark = proj / "logic.json"
    if "--reuse" in args and mark.is_file():
        BH.install(proj, starter=True)
        print(f"  reusing {proj}")
    else:
        if proj.exists() and any(proj.iterdir()) and not mark.exists():
            sys.exit(f"{name} FAILED: {proj} has things in it this didn't make: give --keep a new folder")
        shutil.rmtree(proj, ignore_errors=True)
        if BH.main(["new", str(proj), "--name", "Logic"]):
            sys.exit(f"{name} FAILED: godot_byhand.py new")
        mark.write_text("{}", encoding="utf-8")
    (proj / "logic_main.tscn").write_text(MAIN, encoding="utf-8")
    run([g, "--headless", "--path", str(proj), "--import"], timeout=2400)
    return proj


def game(args):
    g = godot_bin()
    if not g:
        sys.exit("LOGIC FAILED: no godot (tools/godot_setup.sh on a cloud session)")
    proj = project(args, "LOGIC")
    shutil.copy(HERE / "logic_test.gd", proj / "logic_test.gd")
    cmd = [g, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "logic_test.gd"]
    if "--only" in args:
        cmd += ["--", "--only=" + args[args.index("--only") + 1]]
    r = run(cmd, timeout=900)
    got = [ln for ln in r.stdout.splitlines() if ln.startswith("LOGIC ")]
    for ln in got:
        print("  " + ln[6:])
    res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("LOGIC result ")), None)
    if res is None:
        sys.exit("LOGIC FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-4000:])
    errs = list(res.get("errors", []))
    errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:10]
    for e in errs:
        print("ERROR: " + e)
    print("LOGIC ok" if not errs else f"LOGIC FAILED ({len(errs)})")
    return 1 if errs else 0


if __name__ == "__main__":
    a = sys.argv[1:]
    sys.exit(game(a))
