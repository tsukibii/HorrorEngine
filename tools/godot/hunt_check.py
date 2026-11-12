#!/usr/bin/env python3
"""HUNT: being hunted as a hidden quest (the starter kit's hunt.gd, hunt_spot.gd, moves.gd, checkpoint.gd and the
Story's die(): docs/HUNT_PLAN.md, DECISIONS 2026-11-12).

A `godot_byhand.py new` project with a floor, a wall with a doorway, the starter's player and Story and stand-ins to
hunt you, played headless (`hunt_test.gd`): a haunting that starts on a fact, hidden; each kind of spot by its own rule
(a watch set up only out of your sight and gone when looked at, a dart across the doorway only while you look at it, a
peek drawing back, a door, a decoy, an ambush in its box, a follow nearer each time you look away and never touching);
getting too close; the spots by themselves, never the same twice running; the stages and their facts; no rush in a
haunting; ended by a task. A lethal hunt: no rush in the light, a tell before the rush, hiding calling it off, caught
and dead, back at the checkpoint as you were with the hunt a stage lower and a grace, out of her sight and she's lost
you, mercy after two deaths, shot down, survived by time. The cloak as a state and a water shell showing her. Her
moves: a made-up Kimodo .npz retargeted onto MHR's body, played by how fast she goes, the fallbacks, a stand-in that
slides, a clip by its name.

    python tools/godot/hunt_check.py [--reuse] [--keep DIR]
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

args = sys.argv[1:]
G = os.environ.get("GODOT") or shutil.which("godot") or shutil.which("godot-mono")
proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_hunt"
MHR = ROOT / "Content/Studio/Bodies/MHR.fbx"
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("HUNT FAILED: no godot (tools/godot_setup.sh on a cloud session)")
if "--reuse" in args and (proj / "hunt.json").is_file():
    BH.install(proj, starter=True)
    print(f"  reusing {proj}")
else:
    if proj.exists() and any(proj.iterdir()) and not (proj / "hunt.json").exists():
        sys.exit(f"HUNT FAILED: {proj} has things in it this didn't make: give --keep a new folder")
    shutil.rmtree(proj, ignore_errors=True)
    if BH.main(["new", str(proj), "--name", "Hunt"]):
        sys.exit("HUNT FAILED: godot_byhand.py new")
    (proj / "hunt.json").write_text("{}", encoding="utf-8")
(proj / "bodies").mkdir(exist_ok=True)
if MHR.is_file() and not (proj / "bodies/MHR.fbx").is_file():
    shutil.copy(MHR, proj / "bodies/MHR.fbx")
for _ in range(3):
    run([G, "--headless", "--path", str(proj), "--import"], timeout=2400)
    if not MHR.is_file() or list((proj / ".godot" / "imported").glob("MHR.fbx-*.scn")):
        break

ext = [("PackedScene", "res://starter/player.tscn", "player"), ("Script", "res://starter/story.gd", "story")]
lines = [f"[gd_scene load_steps={len(ext) + 2} format=3]", ""]
lines += [f'[ext_resource type="{t}" path="{p}" id="{i}"]' for t, p, i in ext] + [""]
lines += ['[sub_resource type="BoxShape3D" id="floor"]', "size = Vector3(60, 0.2, 60)", ""]
lines += ['[node name="Main" type="Node3D"]', "",
          '[node name="Floor" type="StaticBody3D" parent="."]', "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.1, 0)", "",
          '[node name="Shape" type="CollisionShape3D" parent="Floor"]', 'shape = SubResource("floor")', "",
          '[node name="Story" type="CanvasLayer" parent="."]', 'script = ExtResource("story")',
          'tasks = PackedStringArray("power: Get the power back on.")', "",
          '[node name="Player" parent="." instance=ExtResource("player")]', ""]
(proj / "main.tscn").write_text("\n".join(lines), encoding="utf-8")
shutil.copy(ROOT / "tools/godot/hunt_test.gd", proj / "hunt_test.gd")

r = run([G, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "hunt_test.gd"], timeout=900)
got = [ln for ln in r.stdout.splitlines() if ln.startswith("HUNT ")]
for ln in got:
    print("  " + ln[5:])
res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("HUNT result ")), None)
if res is None:
    sys.exit("HUNT FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-3000:])
errs += res.get("errors", [])
errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:8]

for e in errs:
    print("ERROR: " + e)
print("HUNT ok" if not errs else f"HUNT FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
