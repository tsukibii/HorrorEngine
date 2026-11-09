#!/usr/bin/env python3
"""WEAPONS: the weapons plugin's shotgun, the double barrel, in a game built by hand (DECISIONS 2026-11-09, the user's
`weapon-system`; latest: "I don't want the single barrel shotgun, only the double barrel one").

A `godot_byhand.py new` project with the hotel floor's interior (the scene builder's export, tutorial v2's set) and the
starter's player standing in its corridor at night, an HSDoubleBarrel under the player's eye carrying the flashlight
under its barrels, a box of shells on the floor, boxes that move when hit. Played headless (`weapons_test.gd`): only
the barrels in the view; a shot at a dummy (the pellets in the right barrel's cone, every one a hole, the push, the
flash, the noise heard, the ears ringing, the kick), the right barrel then the left then a click, aimed and under a 4:3
tape, never three flashes in a second, the reload (broken open in the view, the hulls flicked onto the floor, a shell
popped into each chamber), one barrel's reload, a reload stopped by a shot, the keys, a shootable, a lamp shot out,
the muzzle's flash and trail, what a 12-gauge leaves on a wall at three distances and on concrete, the explosive shell
and its blast, the box of shells taken, lowered and raised, the gun found and taken.

    python tools/godot/weapons_check.py [--reuse] [--pictures [--only idle,fire]] [--keep DIR]

`--pictures` draws the guide's pictures under xvfb (`weapons_shots.gd`, `muzzle_shots.gd`) into guides/weapons/img/.
"""
import json
import math
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
node = shutil.which("node") or "node"
proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_weapons"
IMG = ROOT / "guides" / "weapons" / "img"
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("WEAPONS FAILED: no godot (tools/godot_setup.sh on a cloud session)")
reuse = "--reuse" in args and (proj / "hotel.json").is_file()
if reuse:
    BH.install(proj, starter=True)
    run([G, "--headless", "--path", str(proj), "--import"], timeout=1200)
    print(f"  reusing {proj}")
else:
    if proj.exists() and any(proj.iterdir()) and not (proj / "weapons.json").exists():
        sys.exit(f"WEAPONS FAILED: {proj} has things in it this didn't make: give --keep a new folder")
    shutil.rmtree(proj, ignore_errors=True)
    if BH.main(["new", str(proj), "--name", "Weapons"]):
        sys.exit("WEAPONS FAILED: godot_byhand.py new")
    (proj / "weapons.json").write_text("{}", encoding="utf-8")
    dst = proj / "exports/interiors/hotel_floor"
    have = ROOT / "Saved/Godot/_tutorial_v2/exports/interiors/hotel_floor/hotel_floor.glb"
    if have.is_file():                                   # tutorial v2's export of the same set: the same file
        shutil.copytree(have.parent, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns("*.import"))
    else:
        r = run([node, str(ROOT / "tools/director/levelexport.mjs"), "--game", "set:hotel_floor", "--out", str(dst / "hotel_floor.glb")],
                cwd=ROOT, timeout=900)
        if r.returncode:
            sys.exit("WEAPONS FAILED: the hotel's export: " + (r.stdout + r.stderr)[-500:])
    for _ in range(3):
        run([G, "--headless", "--path", str(proj), "--import"], timeout=2400)
        if list((proj / ".godot" / "imported").glob("hotel_floor.glb-*.scn")) and list((proj / ".godot" / "imported").glob("shotgun_double.glb-*.scn")):
            break
    shutil.copy(ROOT / "tools/godot/tutorial_v2_paths.gd", proj / "tutorial_v2_paths.gd")
    r = run([G, "--headless", "--path", str(proj), "-s", "tutorial_v2_paths.gd"], timeout=600)
    if not (proj / "hotel.json").is_file():
        sys.exit("WEAPONS FAILED: the hotel's places: " + (r.stdout + r.stderr)[-1200:])
H = json.loads((proj / "hotel.json").read_text(encoding="utf-8"))
corr = H["rooms"]["corridor"]
fl = corr["at"][1] - corr["size"][1] / 2 - 0.025
cz = corr["at"][2]


def tf(pos, turn_deg=0.0):
    a = math.radians(turn_deg)
    c, s = math.cos(a), math.sin(a)
    return f"Transform3D({c:.6f}, 0, {s:.6f}, 0, 1, 0, {-s:.6f}, 0, {c:.6f}, {pos[0]:.4f}, {pos[1]:.4f}, {pos[2]:.4f})"


start = [6.2, fl, cz + 0.15]                             # in the corridor, looking west down it to the end window
ext = [("PackedScene", "res://exports/interiors/hotel_floor/hotel_floor.glb", "hotel"), ("Script", "res://starter/interior.gd", "interior"),
       ("PackedScene", "res://starter/player.tscn", "player"), ("Script", "res://starter/story.gd", "story"), ("Script", "res://starter/sound.gd", "sound"),
       ("Script", "res://starter/fear.gd", "fear"), ("Script", "res://addons/horrorstudio_look/look_env.gd", "lookenv"),
       ("Script", "res://addons/horrorstudio_look/nodes/grade.gd", "grade"), ("Script", "res://addons/horrorstudio_look/nodes/tape.gd", "tape"),
       ("Script", "res://addons/horrorstudio_look/nodes/atmosphere.gd", "air"),
       ("Script", "res://addons/horrorstudio_weapons/double.gd", "shotgun"), ("Script", "res://addons/horrorstudio_weapons/pickup.gd", "pickup")]
lines = [f"[gd_scene load_steps={len(ext) + 3} format=3]", ""]
lines += [f'[ext_resource type="{t}" path="{p}" id="{i}"]' for t, p, i in ext] + [""]
lines += ['[sub_resource type="BoxShape3D" id="box"]', "size = Vector3(0.4, 0.4, 0.4)", "",
          '[sub_resource type="BoxMesh" id="boxmesh"]', "size = Vector3(0.4, 0.4, 0.4)", ""]


def nd(name, parent=None, typ=None, inst=None, script=None, props=(), paths=()):
    head = f'[node name="{name}"' + (f' type="{typ}"' if typ else "") + (f' parent="{parent}"' if parent is not None else "")
    if paths:
        head += " node_paths=PackedStringArray(" + ", ".join(json.dumps(p) for p in paths) + ")"
    if inst:
        head += f' instance=ExtResource("{inst}")'
    lines.append(head + "]")
    if script:
        lines.append(f'script = ExtResource("{script}")')
    lines.extend(props)
    lines.append("")


nd("Main", typ="Node3D")
nd("Look", ".", "WorldEnvironment", script="lookenv", props=['preset = "balanced"', "editor_only = false"])
nd("Grade", ".", "Node", script="grade", props=['preset = "cold"'])
nd("Tape", ".", "Node", script="tape", props=['preset = "off"'])
nd("Air", ".", "Node3D", script="air", props=["fog = 0.3", "dust = 0.4"])
nd("Hotel", ".", inst="hotel", script="interior", props=["lights_on = true"])
nd("Story", ".", "CanvasLayer", script="story", props=['objective_text = ""'])
nd("Sound", ".", "Node", script="sound", props=['mood = "silence"'])
nd("Fear", ".", "Node", script="fear")
nd("Player", ".", inst="player", props=[f"transform = {tf(start, 90.0)}"])
nd("Flashlight", "Player/Eye", props=["battery = 0.0"])
nd("Shotgun", "Player/Eye", "Node3D", script="shotgun", props=['light = NodePath("../Flashlight")', "spare = 12"], paths=["light"])   # the double (HSDoubleBarrel)
nd("Shells", ".", "Node3D", script="pickup", props=[f"transform = {tf([start[0] - 1.2, fl, cz - 0.55], 30.0)}", 'kind = "shells"', "shells = 5",
                                                   'say = "A box of shells."'])
for i, z in enumerate((cz - 0.55, cz + 0.5)):                                  # cardboard boxes down the corridor: shot, they move
    nd(f"Crate{i}", ".", "RigidBody3D", props=[f"transform = {tf([start[0] - 3.4 - 0.9 * i, fl + 0.2, z], 15.0 * i)}", "mass = 2.0"])
    nd("Shape", f"Crate{i}", "CollisionShape3D", props=['shape = SubResource("box")'])
    nd("Mesh", f"Crate{i}", "MeshInstance3D", props=['mesh = SubResource("boxmesh")'])
lines += ['[editable path="Player"]', ""]
(proj / "main.tscn").write_text("\n".join(lines), encoding="utf-8")
for old in ("double.tscn", "weapons_double_test.gd", "weapons_double_shots.gd"):     # (the pump gun's days: a second scene for the double)
    for f in (proj / old, proj / (old + ".uid")):
        f.unlink(missing_ok=True)
pg = (proj / "project.godot").read_text(encoding="utf-8")
if "run/main_scene" not in pg:
    pg = pg.replace('config/name="Weapons"', 'config/name="Weapons"\nrun/main_scene="res://main.tscn"') + "\n[display]\nwindow/size/viewport_width=1600\nwindow/size/viewport_height=900\n"
    (proj / "project.godot").write_text(pg, encoding="utf-8")
(proj / "weapons.json").write_text(json.dumps({"start": start, "floor": fl, "corridor": corr}, indent=1), encoding="utf-8")
for f in ["weapons_test.gd", "weapons_shots.gd", "muzzle_shots.gd"]:
    if (ROOT / "tools/godot" / f).is_file():
        shutil.copy(ROOT / "tools/godot" / f, proj / f)

# played headless
r = run([G, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "weapons_test.gd"], timeout=900)
got = [ln for ln in r.stdout.splitlines() if ln.startswith("WEAPONS ")]
for ln in got:
    print("  " + ln[8:])
res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("WEAPONS result ")), None)
if res is None:
    sys.exit("WEAPONS FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-2500:])
errs += res.get("errors", [])
errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:6]

if "--pictures" in args and not errs:
    from PIL import Image
    shots = proj / "_shots"
    shots.mkdir(exist_ok=True)
    (shots / ".gdignore").touch()
    for old in shots.glob("*.png"):
        old.unlink()
    only = args[args.index("--only") + 1].split(",") if "--only" in args else []
    for script in ("weapons_shots.gd", "muzzle_shots.gd"):
        if script == "muzzle_shots.gd" and only and "flash_parts" not in only:
            continue
        cmd = [G, "--path", str(proj), "--rendering-driver", "vulkan", "--fixed-fps", "30", "-s", script, "--", f"--out={shots}"]
        if only:
            cmd.append("--only=" + ",".join(only))
        if shutil.which("xvfb-run"):
            cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
        r = run(cmd, timeout=1800)
    made = sorted(shots.glob("*.png"))
    if not made:
        errs.append("no pictures came out of Godot: " + (r.stdout + r.stderr)[-800:])
    IMG.mkdir(parents=True, exist_ok=True)
    for p in made:
        im = Image.open(p).convert("RGB")
        im.save(IMG / f"{p.stem}.jpg", quality=86, optimize=True)
        print(f"  picture: guides/weapons/img/{p.stem}.jpg ({im.width}x{im.height})")

for e in errs:
    print("ERROR: " + e)
print("WEAPONS ok" if not errs else f"WEAPONS FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
