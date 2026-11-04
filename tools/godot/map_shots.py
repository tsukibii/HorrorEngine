#!/usr/bin/env python3
"""A map pictured by Godot (.claude/skills/build-map): a set's interior stood in its street as a project built by hand
would have them (guides/first_game): a Godot project (tools/godot_byhand.py new), the set's interior exported without
its outside (the street has the shell) and the street, as the editors' Export for Godot makes them, the interior at the
street's marker (starter/interior.gd), the look (balanced) and a sun; then named shots, a contact sheet of them.

    python tools/godot/map_shots.py --set maison_1f --street maison_lane [--building maison] [--shots shots.json]
                                    [--time day|dusk|night] [--nofog] [--reuse] [--out DIR]

`--shots`: a JSON list of {name, eye, look, vfov?} in the street's metres (x east, y north, z up; `"in": true` makes z
over the interior's floor: an eye's 1.6). Without it: the street's own shots and a look from above. The interior's floor
height is printed. `--reuse` the last exports (only the shots changed). Pictures and sheet.jpg in --out (default
Saved/Godot/_map/<set>/shots_<time>). The desk's server running (restarted after changing storykit's Python: it keeps
the modules it started with). Ends "MAPSHOTS ok"."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[1:]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
SET, STREET, TIME = opt("--set"), opt("--street"), opt("--time", "dusk")
if not SET or not STREET:
    print(__doc__)
    sys.exit(2)
G = os.environ.get("GODOT") or shutil.which("godot")
node = shutil.which("node") or "node"
base = ROOT / "Saved" / "Godot" / "_map" / SET
proj, cache = base / "project", base / "exports"
run = lambda cmd, **kw: subprocess.run(cmd, capture_output=True, text=True, **kw)
if not G:
    sys.exit("MAPSHOTS FAILED: no godot (tools/godot_setup.sh on a cloud session)")
street_json = json.loads((ROOT / "Content/Studio/Streets" / STREET / "street.json").read_text(encoding="utf-8"))
bid = opt("--building") or next((b["id"] for b in street_json.get("buildings", []) if (b.get("inside") or {}).get("set") == SET), None)
if not bid:
    sys.exit(f"MAPSHOTS FAILED: no building in {STREET} has the set {SET} inside (its inside.set)")

shutil.rmtree(proj, ignore_errors=True)
sys.path.insert(0, str(ROOT / "tools"))
import godot_byhand as BH  # noqa: E402
if BH.main(["new", str(proj), "--name", SET]):
    sys.exit("MAPSHOTS FAILED: godot_byhand.py new")
cache.mkdir(parents=True, exist_ok=True)
glb_in, glb_st = cache / f"{SET}.glb", cache / f"{STREET}.glb"
if "--reuse" not in args or not glb_in.is_file() or not glb_st.is_file():
    for cmd in ([node, "tools/director/levelexport.mjs", "--game", "set:" + SET, "--no-outside", "--out", str(glb_in)],
                [node, "tools/director/streetexport.mjs", "--street", STREET, "--out", str(glb_st)]):
        r = run(cmd, cwd=ROOT, timeout=1800)
        if r.returncode:
            sys.exit(f"MAPSHOTS FAILED: {cmd[1]}: " + (r.stdout + r.stderr)[-600:])
for kind, name, src in (("interiors", SET, glb_in), ("streets", STREET, glb_st)):
    (proj / "exports" / kind / name).mkdir(parents=True, exist_ok=True)
    shutil.copy(src, proj / "exports" / kind / name / src.name)

probe = r'''
import fs from "fs"; import { pathToFileURL } from "url";
const SG = await import(pathToFileURL(process.argv[1] + "/tools/director/street-gen.js").href);
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), T = SG.terrain(S), b = S.buildings.find(q => q.id === process.argv[3]);
const M = SG.insideMarkers(b, SG.footing(b, T))[0];
console.log(JSON.stringify({ name: M.name, at: M.at, turn: M.turn || 0 }));'''
r = run([node, "--input-type=module", "-e", probe, str(ROOT), str(ROOT / "Content/Studio/Streets" / STREET / "street.json"), bid])
if r.returncode:
    sys.exit("MAPSHOTS FAILED: the street's marker: " + r.stderr[-400:])
M = json.loads(r.stdout)
floor = M["at"][2]
print(f"  the interior stands at the street's {M['name']}: its origin at ({M['at'][0]:.2f}, {M['at'][1]:.2f}), turned {M['turn']:g}°, its floor {floor:.2f} m up")

ext = [("PackedScene", f"res://exports/streets/{STREET}/{STREET}.glb", "street"), ("PackedScene", f"res://exports/interiors/{SET}/{SET}.glb", "inside"),
       ("Script", "res://starter/interior.gd", "interior"), ("Script", "res://addons/horrorstudio_look/look_env.gd", "lookenv")]
SUN = {"day": ("Transform3D(0.77, -0.45, 0.45, 0, 0.71, 0.71, -0.64, -0.54, 0.54, 0, 30, 0)", "Color(1, 0.97, 0.92, 1)", 2.2),
       "dusk": ("Transform3D(0.5, -0.3, 0.81, 0, 0.94, 0.34, -0.87, -0.17, 0.47, 0, 30, 0)", "Color(1, 0.78, 0.6, 1)", 1.4),
       "night": ("Transform3D(0.866025, -0.25, 0.433013, 0, 0.866025, 0.5, -0.5, -0.433013, 0.75, 0, 30, 0)", "Color(0.62, 0.7, 0.95, 1)", 0.18)}[TIME]
L = [f"[gd_scene load_steps={len(ext) + 1} format=3]", ""] + [f'[ext_resource type="{t}" path="{p}" id="{i}"]' for t, p, i in ext] + ["",
     '[node name="Main" type="Node3D"]', "",
     '[node name="Look" type="WorldEnvironment" parent="."]', 'script = ExtResource("lookenv")', 'preset = "balanced"', "editor_only = false", "",
     '[node name="Sun" type="DirectionalLight3D" parent="."]', f"transform = {SUN[0]}", f"light_color = {SUN[1]}", f"light_energy = {SUN[2]}", "shadow_enabled = true", "",
     '[node name="Street" parent="." instance=ExtResource("street")]', "",
     '[node name="Inside" parent="." node_paths=PackedStringArray("street") instance=ExtResource("inside")]', 'script = ExtResource("interior")',
     'street = NodePath("../Street")', f'marker = "{M["name"]}"', ""]
(proj / "main.tscn").write_text("\n".join(L), encoding="utf-8")

g3 = lambda p, up=0.0: [p[0], p[2] + up, -p[1]]            # the street's metres into Godot's
if opt("--shots"):
    want = json.loads(Path(opt("--shots")).read_text(encoding="utf-8"))
else:
    want = [dict(s, name=s["id"]) for s in street_json.get("shots", [])]
    cx = sum(b["at"][0] for b in street_json["buildings"]) / len(street_json["buildings"])
    cy = sum(b["at"][1] for b in street_json["buildings"]) / len(street_json["buildings"])
    want.append({"name": "zz_above", "eye": [cx, cy - 34, 30], "look": [cx, cy, 0]})
shots = [{"name": s["name"], "vfov": s.get("vfov", 62), "eye": g3(s["eye"], floor if s.get("in") else 0.0), "look": g3(s["look"], floor if s.get("in") else 0.0)} for s in want]
(proj / "shots.json").write_text(json.dumps(shots), encoding="utf-8")
shutil.copy(ROOT / "tools/godot/map_shots.gd", proj / "map_shots.gd")
pg = (proj / "project.godot").read_text(encoding="utf-8").replace(f'config/name="{SET}"', f'config/name="{SET}"\nrun/main_scene="res://main.tscn"')
(proj / "project.godot").write_text(pg + "\n[display]\nwindow/size/viewport_width=1600\nwindow/size/viewport_height=900\n", encoding="utf-8")
run([G, "--headless", "--path", str(proj), "--import"], timeout=1800)
out = Path(opt("--out") or base / f"shots_{TIME}")
shutil.rmtree(out, ignore_errors=True)
out.mkdir(parents=True)
cmd = [G, "--path", str(proj), "--rendering-driver", "vulkan", "--fixed-fps", "30", "-s", "map_shots.gd", "--", f"--out={out}"] + (["--nofog"] if "--nofog" in args else [])
if shutil.which("xvfb-run"):
    cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
r = run(cmd, timeout=3600)
made = sorted(out.glob("*.png"))
if len(made) < len(shots):
    sys.exit(f"MAPSHOTS FAILED: {len(made)} of {len(shots)} pictures: " + (r.stdout + r.stderr)[-800:])
from PIL import Image, ImageDraw  # noqa: E402
W, H, cols = 560, 315, 3
sheet = Image.new("RGB", (W * cols, H * ((len(made) + cols - 1) // cols)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, p in enumerate(made):
    x, y = (i % cols) * W, (i // cols) * H
    sheet.paste(Image.open(p).convert("RGB").resize((W, H)), (x, y))
    d.text((x + 6, y + 4), p.stem, fill=(255, 255, 0))
sheet.save(out / "sheet.jpg", quality=85)
print(f"  {len(made)} pictures and their sheet in {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
print("MAPSHOTS ok")
