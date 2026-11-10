#!/usr/bin/env python3
"""LAPTOP: the devices plugin's laptop in a game built by hand (DECISIONS 2026-11-10, later still, the user's `laptop`:
"when a player interacts with it the camera zooms in on the screen and a usable ui appears ... a order tab, a player can
order items with cash they have ... using the existing inventory system where we display the actual model in the slot
that's visible ... a preset scene (godot prefab) object ... the typical green matrix style terminal look").

A `godot_byhand.py new` project (the Look, UI, Weapons and Devices plugins, the starter), a small office at night built
in code (`laptop_scene.gd`: a desk with the laptop prefab on it, a lamp, a $20 note, the starter's player at the desk,
the Story with its cash, an HSHud), played headless at 1280 x 720 (`laptop_test.gd`): see its header.

    python tools/godot/laptop_check.py [--reuse] [--pictures [--only room,home]] [--keep DIR]

`--pictures` draws the guide's pictures under xvfb (`laptop_shots.gd`) into guides/laptop/img/.
"""
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
proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_laptop_check"
IMG = ROOT / "guides" / "laptop" / "img"
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("LAPTOP FAILED: no Godot (tools/godot_setup.sh on a cloud session)")
reuse = "--reuse" in args and (proj / "project.godot").is_file()
if not reuse:
    if proj.exists():
        shutil.rmtree(proj)
    if BH.main(["new", str(proj), "--name", "Laptop"]):
        sys.exit("LAPTOP FAILED: godot_byhand.py new")
else:
    BH.install(proj, starter=True)
for f in ["laptop_scene.gd", "laptop_test.gd", "laptop_shots.gd"]:
    if (ROOT / "tools/godot" / f).is_file():
        shutil.copy(ROOT / "tools/godot" / f, proj / f)
shutil.rmtree(proj / "lab_items", ignore_errors=True)
# the office as the project's main scene, to play (`--keep DIR`, then F5): the same room the check and the pictures use
(proj / "office.gd").write_text(
    "extends Node3D\n## the LAPTOP check's office to play: a desk, the laptop prefab on it, a $20 note, the starter's player, a door its parcels come to\n"
    "const Scene := preload(\"res://laptop_scene.gd\")\n\n\nfunc _ready() -> void:\n\tScene.build(self, 20.0, true)\n", encoding="utf-8")
(proj / "main.tscn").write_text('[gd_scene format=3]\n\n[ext_resource type="Script" path="res://office.gd" id="1"]\n\n'
                                '[node name="Office" type="Node3D"]\nscript = ExtResource("1")\n', encoding="utf-8")
pg = (proj / "project.godot").read_text(encoding="utf-8")
if "run/main_scene" not in pg:
    pg = pg.replace('config/name="Laptop"', 'config/name="Laptop"\nrun/main_scene="res://main.tscn"')
    (proj / "project.godot").write_text(pg, encoding="utf-8")
r = run([G, "--headless", "--path", str(proj), "--import"], timeout=1200)
bad = [ln.strip() for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln]
if bad:
    errs += [f"importing: {ln}" for ln in bad[:6]]

r = run([G, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "laptop_test.gd"], timeout=900)
out = r.stdout + r.stderr
for ln in r.stdout.splitlines():
    if ln.startswith("  ok  ") or ln.startswith("LAPTOP"):
        print(ln)
for ln in out.splitlines():
    if "LAPTOP FAIL" in ln or "SCRIPT ERROR" in ln or "Parse Error" in ln:
        errs.append(ln.strip())
if not any(ln.startswith("LAPTOP ok") for ln in r.stdout.splitlines()) and not errs:
    errs.append("Godot said nothing: " + out[-2000:])

if "--pictures" in args and not errs:
    from PIL import Image
    shots = proj / "_shots"
    shots.mkdir(exist_ok=True)
    (shots / ".gdignore").touch()
    for old in shots.glob("*.png"):
        old.unlink()
    cmd = [G, "--path", str(proj), "--rendering-driver", "vulkan", "--fixed-fps", "30", "-s", "laptop_shots.gd", "--", f"--out={shots}"]
    if "--only" in args:
        cmd.append("--only=" + args[args.index("--only") + 1])
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
    r = run(cmd, timeout=1800)
    made = sorted(shots.glob("*.png"))
    if not made:
        errs.append("no pictures came out of Godot: " + (r.stdout + r.stderr)[-1500:])
    IMG.mkdir(parents=True, exist_ok=True)
    for p in made:
        im = Image.open(p).convert("RGB")
        im.save(IMG / f"{p.stem}.jpg", quality=88, optimize=True)
        print(f"  picture: guides/laptop/img/{p.stem}.jpg ({im.width}x{im.height})")

for e in errs:
    print("ERROR: " + e)
print("LAPTOP ok" if not errs else f"LAPTOP FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
