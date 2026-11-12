#!/usr/bin/env python3
"""SHOTWITH: a quest for being shot with a kind of shell (the weapons plugin's HSShotWith, DECISIONS 2026-11-12, last:
"an npc gets shot with love, then it ticks that flag as true").

A `godot_byhand.py new` project with a floor, the starter's player and Story and the double barrel under the player's
eye, people to shoot stood round it, each with an HSShotWith under them. Played headless (`shot_with_test.gd`) with the
real gun and the real shells: buckshot at someone who wants love hearts counts nothing; love hearts set her fact, tick
her task and say her line, once; water twice before it happens, her HSShootable counting none of it; a `needs` that
holds it back until another fact is set; a shell that hurts; a part of her (an HSHitReact's hitboxes: her legs don't
count, her head does), her look turned and back after a while; an explosive shell's blast reaching someone it never
touched; every time when `once` is off; someone hidden; a kind of your own by its id; `fire()`, `reset()`,
`HSShotWith.was`; the two ready-made scenes.

    python tools/godot/shot_with_check.py [--reuse] [--keep DIR]
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
proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_shotwith"
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("SHOTWITH FAILED: no godot (tools/godot_setup.sh on a cloud session)")
if "--reuse" in args and (proj / "shotwith.json").is_file():
    BH.install(proj, starter=True)
    print(f"  reusing {proj}")
else:
    if proj.exists() and any(proj.iterdir()) and not (proj / "shotwith.json").exists():
        sys.exit(f"SHOTWITH FAILED: {proj} has things in it this didn't make: give --keep a new folder")
    shutil.rmtree(proj, ignore_errors=True)
    if BH.main(["new", str(proj), "--name", "ShotWith"]):
        sys.exit("SHOTWITH FAILED: godot_byhand.py new")
    (proj / "shotwith.json").write_text("{}", encoding="utf-8")
for _ in range(3):
    run([G, "--headless", "--path", str(proj), "--import"], timeout=2400)
    if list((proj / ".godot" / "imported").glob("shotgun_double.glb-*.scn")):
        break

ext = [("PackedScene", "res://starter/player.tscn", "player"), ("Script", "res://starter/story.gd", "story"),
       ("Script", "res://addons/horrorstudio_weapons/double.gd", "shotgun")]
lines = [f"[gd_scene load_steps={len(ext) + 2} format=3]", ""]
lines += [f'[ext_resource type="{t}" path="{p}" id="{i}"]' for t, p, i in ext] + [""]
lines += ['[sub_resource type="BoxShape3D" id="floor"]', "size = Vector3(30, 0.2, 30)", ""]
lines += ['[node name="Main" type="Node3D"]', "",
          '[node name="Floor" type="StaticBody3D" parent="."]', "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.1, 0)", "",
          '[node name="Shape" type="CollisionShape3D" parent="Floor"]', 'shape = SubResource("floor")', "",
          '[node name="Story" type="CanvasLayer" parent="."]', 'script = ExtResource("story")',
          'tasks = PackedStringArray("love: Make her love you.", "wet: Soak him twice.")', "",
          '[node name="Player" parent="." instance=ExtResource("player")]', "",
          '[node name="Shotgun" type="Node3D" parent="Player/Eye"]', 'script = ExtResource("shotgun")', "spare = 12", "",
          '[editable path="Player"]', ""]
(proj / "main.tscn").write_text("\n".join(lines), encoding="utf-8")
shutil.copy(ROOT / "tools/godot/shot_with_test.gd", proj / "shot_with_test.gd")

r = run([G, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "shot_with_test.gd"], timeout=600)
got = [ln for ln in r.stdout.splitlines() if ln.startswith("SHOTWITH ")]
for ln in got:
    print("  " + ln[9:])
res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("SHOTWITH result ")), None)
if res is None:
    sys.exit("SHOTWITH FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-2500:])
errs += res.get("errors", [])
errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:6]

for e in errs:
    print("ERROR: " + e)
print("SHOTWITH ok" if not errs else f"SHOTWITH FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
