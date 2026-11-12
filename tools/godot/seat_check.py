#!/usr/bin/env python3
"""SEATS: where your eye goes on a bed, a chair or a stool (the starter kit's seat.gd and the player's settle:
DECISIONS 2026-11-12, after the close calls).

A `godot_byhand.py new` project with a floor, the starter's player and Story, and furniture made of boxes, played
headless (`seat_test.gd`): a seat dropped onto a bed with a headboard (the middle of the bed across, 0.30 m in from
its head end, 0.22 m over the mattress, facing its foot), the same bed turned and moved, a bed with no headboard
(the end behind the node, `flip` the other), the three drop-in scenes; a chair with a back (over its seat, facing
away from the back), a stool (the node's own facing, `seat_height`, `view_offset`, `view_turn_deg`); a collider
alone, as an interior's export has (a bed's box, a chair's tall box); nothing furniture-sized: as placed; E's box
the furniture's own; the eye eased there and back over `settle_secs`; a head's limits lying and sitting; a child's
eye; a chair shoved, its seat with it; the editor's marker.

    python tools/godot/seat_check.py [--reuse] [--keep DIR]
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
proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_seats"
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("SEATS FAILED: no godot (tools/godot_setup.sh on a cloud session)")
if "--reuse" in args and (proj / "seats.json").is_file():
    BH.install(proj, starter=True)
    print(f"  reusing {proj}")
else:
    if proj.exists() and any(proj.iterdir()) and not (proj / "seats.json").exists():
        sys.exit(f"SEATS FAILED: {proj} has things in it this didn't make: give --keep a new folder")
    shutil.rmtree(proj, ignore_errors=True)
    if BH.main(["new", str(proj), "--name", "Seats"]):
        sys.exit("SEATS FAILED: godot_byhand.py new")
    (proj / "seats.json").write_text("{}", encoding="utf-8")
run([G, "--headless", "--path", str(proj), "--import"], timeout=2400)

ext = [("PackedScene", "res://starter/player.tscn", "player"), ("Script", "res://starter/story.gd", "story")]
lines = [f"[gd_scene load_steps={len(ext) + 2} format=3]", ""]
lines += [f'[ext_resource type="{t}" path="{p}" id="{i}"]' for t, p, i in ext] + [""]
lines += ['[sub_resource type="BoxShape3D" id="floor"]', "size = Vector3(60, 0.2, 60)", ""]
lines += ['[node name="Main" type="Node3D"]', "",
          '[node name="Floor" type="StaticBody3D" parent="."]', "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.1, 0)", "",
          '[node name="Shape" type="CollisionShape3D" parent="Floor"]', 'shape = SubResource("floor")', "",
          '[node name="Story" type="CanvasLayer" parent="."]', 'script = ExtResource("story")',
          "",
          '[node name="Player" parent="." instance=ExtResource("player")]', ""]
(proj / "main.tscn").write_text("\n".join(lines), encoding="utf-8")
shutil.copy(ROOT / "tools/godot/seat_test.gd", proj / "seat_test.gd")

r = run([G, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "seat_test.gd"], timeout=900)
got = [ln for ln in r.stdout.splitlines() if ln.startswith("SEATS ")]
for ln in got:
    print("  " + ln[6:])
res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("SEATS result ")), None)
if res is None:
    sys.exit("SEATS FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-3000:])
errs += res.get("errors", [])
errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:8]

for e in errs:
    print("ERROR: " + e)
print("SEATS ok" if not errs else f"SEATS FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
