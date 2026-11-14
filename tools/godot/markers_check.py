"""MARKERS: the HorrorStudio Markers plugin's runtime (docs/MARKERS.md), played headless in Godot 4.7.

    python tools/godot/markers_check.py [--reuse] [--keep DIR] [--only A,B]
        a by-hand project (godot_byhand.py new: the Markers plugin on), a floor, the starter's Story and player, and the
        Animator's normal woman baked and dropped in. markers_test.gd builds markers in code and plays them:
        every kind of §4 and every rule of §6, each measured (where she ends up, how fast she went, what waited for
        what, what a Disappear switches off, a conversation's answer taking a Choice's way, faces by flags, the three
        things being shot down can mean, a checkpoint put back, the tester's runner changing nothing). Ends "MARKERS ok".

    python tools/godot/markers_check.py --editor [--reuse] [--shots DIR]
        MARKERSEDITOR: the NPC Markers tab driven in the editor itself on the same project (a scene made from nothing
        by the tab's own functions: a character added, a quest, markers placed in the 3D view, dragged, turned, a
        bend, the storyboard reordered, the form filled, Problems, the tester run, saved clean). --shots: the guide's
        pictures of the editor, under xvfb.

    python tools/godot/markers_check.py guide DIR
        the guide's pictures (guides/markers/img): the editor's from DIR (a run with --editor --shots DIR), the game's
        two made now under xvfb (markers_shots.gd: F7's label, the talk box), all as JPEGs.

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

PLUGIN = ROOT / "GodotPlugins" / "HorrorStudioMarkers" / "addons" / "horrorstudio_markers"
HERE = Path(__file__).resolve().parent


EDITOR_SCENE = """[gd_scene load_steps=19 format=3]

[ext_resource type="PackedScene" path="res://characters/normal_woman.glb" id="her"]

[sub_resource type="BoxShape3D" id="floor_s"]
size = Vector3(30, 0.2, 30)

[sub_resource type="StandardMaterial3D" id="c_floor"]
albedo_color = Color(0.62, 0.47, 0.33, 1)

[sub_resource type="StandardMaterial3D" id="c_wall"]
albedo_color = Color(0.86, 0.82, 0.74, 1)

[sub_resource type="StandardMaterial3D" id="c_sofa"]
albedo_color = Color(0.27, 0.5, 0.32, 1)

[sub_resource type="StandardMaterial3D" id="c_wood"]
albedo_color = Color(0.42, 0.28, 0.18, 1)

[sub_resource type="StandardMaterial3D" id="c_book"]
albedo_color = Color(0.7, 0.2, 0.2, 1)

[sub_resource type="StandardMaterial3D" id="c_bob"]
albedo_color = Color(0.45, 0.48, 0.55, 1)

[sub_resource type="BoxMesh" id="floor_m"]
material = SubResource("c_floor")
size = Vector3(9, 0.2, 7)

[sub_resource type="BoxMesh" id="wall_back_m"]
material = SubResource("c_wall")
size = Vector3(9, 2.6, 0.15)

[sub_resource type="BoxMesh" id="wall_left_m"]
material = SubResource("c_wall")
size = Vector3(0.15, 2.6, 7)

[sub_resource type="BoxMesh" id="sofa_m"]
material = SubResource("c_sofa")
size = Vector3(1.8, 0.45, 0.8)

[sub_resource type="BoxMesh" id="sofa_back_m"]
material = SubResource("c_sofa")
size = Vector3(1.8, 0.55, 0.2)

[sub_resource type="BoxMesh" id="shelf_m"]
material = SubResource("c_wood")
size = Vector3(1.4, 2, 0.4)

[sub_resource type="BoxMesh" id="table_m"]
material = SubResource("c_wood")
size = Vector3(1, 0.4, 0.5)

[sub_resource type="BoxMesh" id="book_m"]
material = SubResource("c_book")
size = Vector3(0.14, 0.04, 0.2)

[sub_resource type="BoxMesh" id="bob_m"]
material = SubResource("c_bob")
size = Vector3(0.4, 1.7, 0.25)

[node name="Level" type="Node3D"]

[node name="Floor" type="StaticBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.1, 0)

[node name="Shape" type="CollisionShape3D" parent="Floor"]
shape = SubResource("floor_s")

[node name="Mesh" type="MeshInstance3D" parent="Floor"]
mesh = SubResource("floor_m")

[node name="WallBack" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.3, -3.5)
mesh = SubResource("wall_back_m")

[node name="WallLeft" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -4.5, 1.3, 0)
mesh = SubResource("wall_left_m")

[node name="Sofa" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2.5, 0.225, -1.5)
mesh = SubResource("sofa_m")

[node name="SofaBack" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2.5, 0.72, -1.8)
mesh = SubResource("sofa_back_m")

[node name="Shelf" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 1, -3.2)
mesh = SubResource("shelf_m")

[node name="Table" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.6, 0.2, -2.9)
mesh = SubResource("table_m")

[node name="Book" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -1.5, 0.02, 1)
mesh = SubResource("book_m")

[node name="Alex" parent="." instance=ExtResource("her")]

[node name="Bob" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -3, 0, -2)

[node name="Body" type="MeshInstance3D" parent="Bob"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.85, 0)
mesh = SubResource("bob_m")
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
    proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_markers"
    mark = proj / "markers.json"
    if "--reuse" in args and mark.is_file() and (proj / "characters" / "normal_woman.glb").is_file():
        BH.install(proj, starter=True)
        print(f"  reusing {proj}")
    else:
        if proj.exists() and any(proj.iterdir()) and not mark.exists():
            sys.exit(f"{name} FAILED: {proj} has things in it this didn't make: give --keep a new folder")
        shutil.rmtree(proj, ignore_errors=True)
        if BH.main(["new", str(proj), "--name", "Markers"]):
            sys.exit(f"{name} FAILED: godot_byhand.py new")
        mark.write_text("{}", encoding="utf-8")
        (proj / "characters").mkdir(exist_ok=True)
        scratch = ROOT / "Saved" / "Animator" / "check"
        r = run(["node", str(ROOT / "tools" / "animator" / "bodies.mjs"), "--out", str(scratch), "normal_woman"], timeout=900)
        if "BODIES ok" not in r.stdout:
            sys.exit(f"{name} FAILED: the test body: " + (r.stdout + r.stderr)[-1500:])
        r = run(["node", str(ROOT / "tools" / "animator" / "bake.mjs"), str(scratch / "normal_woman.glb"), "--out", str(proj / "characters" / "normal_woman.glb")], timeout=900)
        if "BAKE ok" not in r.stdout:
            sys.exit(f"{name} FAILED: the bake: " + (r.stdout + r.stderr)[-1500:])
    ext = [("PackedScene", "res://starter/player.tscn", "player"), ("Script", "res://starter/story.gd", "story")]
    lines = [f"[gd_scene load_steps={len(ext) + 2} format=3]", ""]
    lines += [f'[ext_resource type="{t}" path="{p}" id="{i}"]' for t, p, i in ext] + [""]
    lines += ['[sub_resource type="BoxShape3D" id="floor"]', "size = Vector3(80, 0.2, 80)", ""]
    lines += ['[node name="Main" type="Node3D"]', "",
              '[node name="Floor" type="StaticBody3D" parent="."]', "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.1, 0)", "",
              '[node name="Shape" type="CollisionShape3D" parent="Floor"]', 'shape = SubResource("floor")', "",
              '[node name="Story" type="CanvasLayer" parent="."]', 'script = ExtResource("story")',
              'tasks = PackedStringArray("book: Find the missing book.")', "",
              '[node name="Player" parent="." instance=ExtResource("player")]', "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 20, 0.1, 20)", ""]
    (proj / "main.tscn").write_text("\n".join(lines), encoding="utf-8")
    for _ in range(3):
        run([g, "--headless", "--path", str(proj), "--import"], timeout=2400)
        if list((proj / ".godot" / "imported").glob("normal_woman.glb-*.scn")):
            break
    return proj


def game(args):
    g = godot_bin()
    if not g:
        sys.exit("MARKERS FAILED: no godot (tools/godot_setup.sh on a cloud session)")
    proj = project(args, "MARKERS")
    shutil.copy(HERE / "markers_test.gd", proj / "markers_test.gd")
    cmd = [g, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "markers_test.gd"]
    if "--only" in args:
        cmd += ["--", "--only=" + args[args.index("--only") + 1]]
    r = run(cmd, timeout=1500)
    got = [ln for ln in r.stdout.splitlines() if ln.startswith("MARKERS ")]
    for ln in got:
        print("  " + ln[8:])
    res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("MARKERS result ")), None)
    if res is None:
        sys.exit("MARKERS FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-4000:])
    errs = list(res.get("errors", []))
    errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:10]
    for e in errs:
        print("ERROR: " + e)
    print("MARKERS ok" if not errs else f"MARKERS FAILED ({len(errs)})")
    return 1 if errs else 0


def editor(args):
    g = godot_bin()
    if not g:
        sys.exit("MARKERSEDITOR FAILED: no godot (tools/godot_setup.sh on a cloud session)")
    proj = project(args, "MARKERSEDITOR")
    shots = Path(args[args.index("--shots") + 1]).resolve() if "--shots" in args else None
    t = proj / "addons" / "hs_markers_editor_test"
    t.mkdir(parents=True, exist_ok=True)
    (t / "plugin.cfg").write_text('[plugin]\nname="hs markers editor test"\ndescription=""\nauthor=""\nversion="1"\nscript="plugin.gd"\n', encoding="utf-8")
    shutil.copy(HERE / "markers_editor_test.gd", t / "plugin.gd")
    (proj / "editor_scene.tscn").write_text(EDITOR_SCENE, encoding="utf-8")       # a room made from nothing: a floor, a sofa (a mesh with no collider), a book, a character, someone with no skeleton
    for _ in range(2):
        run([g, "--headless", "--path", str(proj), "--import"], timeout=1200)
    pg = proj / "project.godot"
    before = pg.read_text(encoding="utf-8").replace('"res://addons/hs_markers_editor_test/plugin.cfg", ', "")   # (a run that was killed leaves it in)
    pg.write_text(before.replace("enabled=PackedStringArray(", 'enabled=PackedStringArray("res://addons/hs_markers_editor_test/plugin.cfg", ', 1), encoding="utf-8")
    (proj / "markers_editor.json").write_text(json.dumps({"shots": str(shots) if shots else ""}), encoding="utf-8")
    try:
        if shots:
            shots.mkdir(parents=True, exist_ok=True)
            shutil.rmtree(proj / ".godot" / "editor", ignore_errors=True)       # (the dock's place is kept per project: a fresh layout)
            env = dict(os.environ)
            if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json") and not env.get("DISPLAY"):
                env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
            cmd = [g, "--editor", "--path", str(proj), "--rendering-driver", "vulkan", "--resolution", "1920x1080"]
            if shutil.which("xvfb-run"):
                cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
            r = run(cmd, timeout=1500, env=env)
        else:
            r = run([g, "--headless", "--editor", "--path", str(proj)], timeout=1500)
    finally:
        pg.write_text(before, encoding="utf-8")
        shutil.rmtree(t, ignore_errors=True)
    text = r.stdout + r.stderr
    line = next((ln for ln in text.splitlines() if ln.startswith("MARKERSEDITOR ")), None)
    if line is None:
        sys.exit("MARKERSEDITOR FAILED: the editor said nothing: " + text[-4000:])
    rep = json.loads(line[len("MARKERSEDITOR "):])
    errs = list(rep.get("errors", []))
    for what in rep.get("did", []):
        print("  " + what)
    errs += [f"a script error: {ln.strip()}" for ln in text.splitlines() if ("SCRIPT ERROR" in ln or "Parse Error" in ln) and "hs_markers_editor_test" not in ln][:10]
    saved = (proj / "editor_scene.tscn").read_text(encoding="utf-8") if (proj / "editor_scene.tscn").is_file() else ""
    if not saved:
        errs.append("the scene wasn't saved")
    for word in ["_Ghost", "_Talk", "_MarkerClips", "hsm"]:
        if word in saved:
            errs.append(f"the saved scene holds '{word}': something made for the tester or the game was saved")
    for e in errs:
        print("ERROR: " + e)
    print("MARKERSEDITOR ok" if not errs else f"MARKERSEDITOR FAILED ({len(errs)})")
    return 1 if errs else 0


def jpeg(src, dst):
    """a picture as a JPEG (Pillow, else ffmpeg)"""
    try:
        from PIL import Image
        Image.open(src).convert("RGB").save(dst, quality=88, optimize=True)
        return True
    except ImportError:
        pass
    ff = shutil.which("ffmpeg")
    if not ff:
        return False
    return run([ff, "-y", "-loglevel", "error", "-i", str(src), "-q:v", "3", str(dst)], timeout=120).returncode == 0


def guide(args):
    g = godot_bin()
    src = Path(args[args.index("guide") + 1]).resolve() if len(args) > args.index("guide") + 1 else None
    if not g or src is None or not src.is_dir():
        sys.exit("guide: python tools/godot/markers_check.py guide DIR  (DIR: the pictures of a run with --editor --shots DIR)")
    proj = ROOT / "Saved" / "Godot" / "_markers"
    if not (proj / "editor_scene.tscn").is_file():
        sys.exit("guide: run the editor check first (python tools/godot/markers_check.py --editor --shots DIR)")
    shutil.copy(HERE / "markers_shots.gd", proj / "markers_shots.gd")
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json") and not env.get("DISPLAY"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    cmd = [g, "--path", str(proj), "--rendering-driver", "vulkan", "--resolution", "1280x720", "--fixed-fps", "60", "-s", "markers_shots.gd", "--", "--out=" + str(src)]
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1280x720x24"] + cmd
    r = run(cmd, timeout=900, env=env)
    for ln in r.stdout.splitlines():
        if ln.startswith("MARKERSSHOTS "):
            print("  " + ln[13:])
    out = ROOT / "guides" / "markers" / "img"
    out.mkdir(parents=True, exist_ok=True)
    made = 0
    for png in sorted(src.glob("*.png")):
        if png.stem.startswith("00_"):
            continue
        if jpeg(png, out / (png.stem + ".jpg")):
            made += 1
        else:
            sys.exit("guide: no Pillow and no ffmpeg to make the JPEGs with")
    want = [m for m in __import__("re").findall(r'src="img/([^"]+)"', (ROOT / "guides" / "markers" / "index.html").read_text(encoding="utf-8"))]
    missing = [w for w in want if not (out / w).is_file()]
    for w in missing:
        print("ERROR: the guide shows img/%s, which wasn't made" % w)
    print(f"guide: {made} pictures in {out}" if not missing else f"guide FAILED ({len(missing)})")
    return 1 if missing else 0


if __name__ == "__main__":
    a = sys.argv[1:]
    sys.exit(guide(a) if "guide" in a else editor(a) if "--editor" in a else game(a))
