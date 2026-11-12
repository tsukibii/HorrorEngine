#!/usr/bin/env python3
"""MIND: things that make the player doubt what they saw (DECISIONS 2026-11-12, after the seats).

A `godot_byhand.py new` project with a floor, the starter's player and Story, played headless (`mind_test.gd`):
  - flicker_lit.gd: the lamps whose light reaches her and your beam flicker, within three dips a second; not the moon,
    a lamp behind a wall, out of reach, pointed away or marked ambient; your beam off her, her hidden, the boolean
    off; dim; die;
  - moved.gd: a thing changes only once seen and only while unseen: turned to face you, to its next mark, gone; its
    needs, a wall in your view, far_m;
  - gaslight.gd: a task, the objective, a pickup and a line lying for a moment and put back; by itself only while its
    needs hold, never the same twice running, never under a card, nothing really changed;
  - HSPhase (the look plugin): what she wears going and coming, hidden when gone, a stutter, a blink, phase_to, her
    places, a creature skin back on her after;
  - HSUnease: nothing until sanity slips, all of it at the bottom, a spike.
Then, under xvfb, `mind_shots.gd` draws the two shaders and measures them: the phase at none of it her own paint,
half way torn (wider than she is, slices missing, darker), gone at 1; unease at none the plain picture, at all of it
the corners dark, the middle steady, the edges moved. `--pictures` keeps the look guide's two sheets.

    python tools/godot/mind_check.py [--reuse] [--keep DIR] [--pictures]
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
proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_mind"
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("MIND FAILED: no godot (tools/godot_setup.sh on a cloud session)")
if "--reuse" in args and (proj / "mind.json").is_file():
    BH.install(proj, starter=True)
    print(f"  reusing {proj}")
else:
    if proj.exists() and any(proj.iterdir()) and not (proj / "mind.json").exists():
        sys.exit(f"MIND FAILED: {proj} has things in it this didn't make: give --keep a new folder")
    shutil.rmtree(proj, ignore_errors=True)
    if BH.main(["new", str(proj), "--name", "Mind"]):
        sys.exit("MIND FAILED: godot_byhand.py new")
    (proj / "mind.json").write_text("{}", encoding="utf-8")
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
shutil.copy(ROOT / "tools/godot/mind_test.gd", proj / "mind_test.gd")

r = run([G, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "mind_test.gd"], timeout=900)
got = [ln for ln in r.stdout.splitlines() if ln.startswith("MIND ")]
for ln in got:
    print("  " + ln[5:])
res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("MIND result ")), None)
if res is None:
    sys.exit("MIND FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-3000:])
errs += res.get("errors", [])
errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:8]

# the two shaders drawn and measured (Vulkan under xvfb: lavapipe here)
shutil.copy(ROOT / "tools/godot/mind_shots.gd", proj / "mind_shots.gd")
out = proj / "_shots"
out.mkdir(exist_ok=True)
env = dict(os.environ)
if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
    env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
cmd = [G, "--path", str(proj), "--rendering-driver", "vulkan", "--resolution", "1280x720", "-s", "mind_shots.gd", "--", f"--out={out}"]
for d in [ROOT / "Exports" / "characters", ROOT / "Saved" / "Exports" / "characters"]:      # a character for the sheet, when there's one
    found = sorted(d.glob("*/*.glb")) if d.is_dir() else []
    if found:
        cmd.append(f"--glb={found[0]}")
        break
if shutil.which("xvfb-run"):
    cmd = ["xvfb-run", "-a", "-s", "-screen 0 1280x720x24"] + cmd
r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
got = [ln for ln in r.stdout.splitlines() if ln.startswith("MIND ")]
for ln in got:
    print("  " + ln[5:])
res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("MIND result ")), None)
if res is None:
    errs.append("the pictures: Godot said nothing: " + (r.stdout + r.stderr)[-1500:])
else:
    errs += res.get("errors", [])
errs += [f"a shader or script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "SHADER ERROR" in ln or "Parse Error" in ln][:8]
if "--pictures" in args and not errs:
    from PIL import Image
    img = ROOT / "guides" / "look_plugin" / "img"
    for name in ["phase", "unease"]:
        Image.open(out / f"{name}_sheet.png").convert("RGB").save(img / f"{name}.jpg", quality=88)
        print(f"  picture: guides/look_plugin/img/{name}.jpg")

for e in errs:
    print("ERROR: " + e)
print("MIND ok" if not errs else f"MIND FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
