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


EDITOR_SCENE = """[gd_scene load_steps=12 format=3]

[ext_resource type="Script" path="res://starter/door.gd" id="door"]

[sub_resource type="BoxShape3D" id="floor_s"]
size = Vector3(30, 0.2, 30)

[sub_resource type="StandardMaterial3D" id="c_floor"]
albedo_color = Color(0.62, 0.47, 0.33, 1)

[sub_resource type="StandardMaterial3D" id="c_wood"]
albedo_color = Color(0.42, 0.28, 0.18, 1)

[sub_resource type="StandardMaterial3D" id="c_brass"]
albedo_color = Color(0.85, 0.68, 0.25, 1)

[sub_resource type="StandardMaterial3D" id="c_paper"]
albedo_color = Color(0.93, 0.9, 0.82, 1)

[sub_resource type="BoxMesh" id="floor_m"]
material = SubResource("c_floor")
size = Vector3(9, 0.2, 7)

[sub_resource type="BoxMesh" id="door_m"]
material = SubResource("c_wood")
size = Vector3(0.9, 2, 0.08)

[sub_resource type="BoxShape3D" id="door_s"]
size = Vector3(0.9, 2, 0.08)

[sub_resource type="BoxMesh" id="key_m"]
material = SubResource("c_brass")
size = Vector3(0.12, 0.03, 0.05)

[sub_resource type="BoxMesh" id="paper_m"]
material = SubResource("c_paper")
size = Vector3(0.21, 0.01, 0.3)

[sub_resource type="BoxMesh" id="lamp_m"]
material = SubResource("c_brass")
size = Vector3(0.25, 0.5, 0.25)

[sub_resource type="BoxMesh" id="ann_m"]
size = Vector3(0.4, 1.7, 0.25)

[node name="Level" type="Node3D"]

[node name="Floor" type="StaticBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.1, 0)

[node name="Shape" type="CollisionShape3D" parent="Floor"]
shape = SubResource("floor_s")

[node name="Mesh" type="MeshInstance3D" parent="Floor"]
mesh = SubResource("floor_m")

[node name="Door" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -2.5)
script = ExtResource("door")

[node name="Mesh" type="MeshInstance3D" parent="Door"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
mesh = SubResource("door_m")

[node name="Body" type="StaticBody3D" parent="Door"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)

[node name="Shape" type="CollisionShape3D" parent="Door/Body"]
shape = SubResource("door_s")

[node name="Key" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1.5, 0.02, -1)
mesh = SubResource("key_m")

[node name="Paper" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -1.5, 0.01, -1)
mesh = SubResource("paper_m")

[node name="Lamp" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -3, 0.25, -2)
mesh = SubResource("lamp_m")

[node name="Ann" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, -2)

[node name="Body" type="MeshInstance3D" parent="Ann"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.85, 0)
mesh = SubResource("ann_m")
"""


def editor(args):
    g = godot_bin()
    if not g:
        sys.exit("LOGICEDITOR FAILED: no godot (tools/godot_setup.sh on a cloud session)")
    proj = project(args, "LOGICEDITOR")
    shots = Path(args[args.index("--shots") + 1]).resolve() if "--shots" in args else None
    t = proj / "addons" / "hs_logic_editor_test"
    t.mkdir(parents=True, exist_ok=True)
    (t / "plugin.cfg").write_text('[plugin]\nname="hs logic editor test"\ndescription=""\nauthor=""\nversion="1"\nscript="plugin.gd"\n', encoding="utf-8")
    shutil.copy(HERE / "logic_editor_test.gd", t / "plugin.gd")
    (proj / "logic_scene.tscn").write_text(EDITOR_SCENE, encoding="utf-8")
    (proj / "flags.json").unlink(missing_ok=True)
    run([g, "--headless", "--path", str(proj), "--import"], timeout=1200)
    pg = proj / "project.godot"
    before = pg.read_text(encoding="utf-8").replace('"res://addons/hs_logic_editor_test/plugin.cfg", ', "")   # (a run that was killed leaves it in)
    pg.write_text(before.replace("enabled=PackedStringArray(", 'enabled=PackedStringArray("res://addons/hs_logic_editor_test/plugin.cfg", ', 1), encoding="utf-8")
    (proj / "logic_editor.json").write_text(json.dumps({"shots": str(shots) if shots else ""}), encoding="utf-8")
    try:
        if shots:
            shots.mkdir(parents=True, exist_ok=True)
            shutil.rmtree(proj / ".godot" / "editor", ignore_errors=True)
            env = dict(os.environ)
            if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json") and not env.get("DISPLAY"):
                env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
            cmd = [g, "--editor", "--path", str(proj), "--rendering-driver", "vulkan", "--resolution", "1920x1080"]
            if shutil.which("xvfb-run"):
                cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
            r = run(cmd, timeout=1500, env=env)
        else:
            r = run([g, "--headless", "--editor", "--path", str(proj)], timeout=540)
    except subprocess.TimeoutExpired as e:                 # (it never quit: what it said is still read)
        def txt(b):
            return b.decode("utf-8", "replace") if isinstance(b, bytes) else (b or "")
        r = subprocess.CompletedProcess([], 1, txt(e.stdout), txt(e.stderr) + "\nSCRIPT ERROR: the editor never quit (the test stopped part way: see above)")
    finally:
        pg.write_text(before, encoding="utf-8")
        shutil.rmtree(t, ignore_errors=True)
    text = r.stdout + r.stderr
    line = next((ln for ln in text.splitlines() if ln.startswith("LOGICEDITOR ")), None)
    if line is None:
        sys.exit("LOGICEDITOR FAILED: the editor said nothing: " + text[-4000:])
    rep = json.loads(line[len("LOGICEDITOR "):])
    errs = list(rep.get("errors", []))
    for what in rep.get("did", []):
        print("  " + what)
    errs += [f"a script error: {ln.strip()}" for ln in text.splitlines() if ("SCRIPT ERROR" in ln or "Parse Error" in ln) and "hs_logic_editor_test" not in ln][:10]
    saved = (proj / "logic_scene.tscn").read_text(encoding="utf-8") if (proj / "logic_scene.tscn").is_file() else ""
    if "Logic" not in saved:
        errs.append("the scene wasn't saved with its Logic nodes")
    if '[node name="@' in saved or saved.count("[node name=") > 60:
        errs.append("the saved scene holds nodes a script made for itself (%d nodes)" % saved.count("[node name="))
    for word in ["_LogicReach", "_Ghost", "_Talk"]:
        if word in saved:
            errs.append(f"the saved scene holds '{word}': something made for the game was saved")
    for e in errs:
        print("ERROR: " + e)
    if "--verbose" in args:
        print(text[-6000:])
    print("LOGICEDITOR ok" if not errs else f"LOGICEDITOR FAILED ({len(errs)})")
    return 1 if errs else 0


if __name__ == "__main__":
    a = sys.argv[1:]
    sys.exit(editor(a) if "--editor" in a else game(a))
