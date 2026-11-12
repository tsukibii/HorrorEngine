#!/usr/bin/env python3
"""SANITY: the sanity meter (the starter kit's sanity.gd and food.gd, and the hunt and the night's director synced to it:
DECISIONS 2026-11-12, the last).

A `godot_byhand.py new` project with a floor, a wall, the starter's player and Story, played headless
(`sanity_test.gd`): steady in the light; worn down by the dark, a scare, her near (not behind a wall) and a hunt
running; its bands and their facts in the Story; food eaten with E and out of the pocket; sitting and lying mending it
up to their caps; sleep after lying down, and not while a task says no, a hunt runs, a script blocks it or its needs
don't hold; a hunt and the director going faster as it falls, the rush a stage early when it's breaking, a hunt that
starts only once you're shaken; at nothing its target fired, or death and back with some of it; the meter.

    python tools/godot/sanity_check.py [--reuse] [--keep DIR]
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
proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_sanity"
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("SANITY FAILED: no godot (tools/godot_setup.sh on a cloud session)")
if "--reuse" in args and (proj / "sanity.json").is_file():
    BH.install(proj, starter=True)
    print(f"  reusing {proj}")
else:
    if proj.exists() and any(proj.iterdir()) and not (proj / "sanity.json").exists():
        sys.exit(f"SANITY FAILED: {proj} has things in it this didn't make: give --keep a new folder")
    shutil.rmtree(proj, ignore_errors=True)
    if BH.main(["new", str(proj), "--name", "Sanity"]):
        sys.exit("SANITY FAILED: godot_byhand.py new")
    (proj / "sanity.json").write_text("{}", encoding="utf-8")
run([G, "--headless", "--path", str(proj), "--import"], timeout=2400)

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
shutil.copy(ROOT / "tools/godot/sanity_test.gd", proj / "sanity_test.gd")

r = run([G, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "sanity_test.gd"], timeout=900)
got = [ln for ln in r.stdout.splitlines() if ln.startswith("SANITY ")]
for ln in got:
    print("  " + ln[7:])
res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("SANITY result ")), None)
if res is None:
    sys.exit("SANITY FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-3000:])
errs += res.get("errors", [])
errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:8]

for e in errs:
    print("ERROR: " + e)
print("SANITY ok" if not errs else f"SANITY FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
