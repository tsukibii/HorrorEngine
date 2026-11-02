#!/usr/bin/env python3
"""A street dressed with the prop generator's trees and bushes, pictured in Godot by day and by night, to judge the
look (docs/PROPGEN.md §18, docs/STREET_BUILDER.md): the street's .glb as the page exports it, trees along its
pavements (every `--gap` metres, each side in turn, clear of lamps, poles and buildings), bushes and tufts at the
pavements' back edges between them, each a made prop (Saved/Props/<name>/<name>.glb) standing on the pavement at the
road's height there; then every shot of the street, a walk along it at the player's eye and a look up the road from
its middle, under the street check's dusk sky with a sun, and under the game's night (its lamps lit); the pictures as
one sheet.

    python tools/godot/street_dress.py --street hill_motel [--trees zelkova_street,cherry_tree,ginkgo_street]
        [--small small_zelkova,small_hornbeam_real,small_cherry,small_ginkgo] [--room 4.5] [--bushes azalea_ball,...]
        [--gap 11] [--shots shot_hill,walk] [--no-night] [--out Saved/Streets/<street>/dressed]

A big tree (`--trees`) stands only where no building is within `--room` metres; beside a house a small upright one
(`--small`, the small_* recipes, under a two-storey house, its branches steep) takes the place, so no crown reaches
into a wall.

The desk's server running (the export), Godot 4.7 (tools/godot_setup.sh in the cloud), the props made
(python tools/propgen.py make <names>). Writes <out>/placements.json (what went where: a start for the street's own
`tree` stand-ins), the pictures, and <out>/sheet.jpg. Ends "GDDRESS ok".
"""
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[1:]


def opt(k, d=None):
    return args[args.index(k) + 1] if k in args else d


street = opt("--street", "hill_motel")
trees = [t for t in opt("--trees", "zelkova_street,cherry_tree,ginkgo_street,camphor_tree").split(",") if t]
small = [t for t in opt("--small", "small_zelkova,small_hornbeam_real,small_cherry,small_ginkgo").split(",") if t]
bushes = [b for b in opt("--bushes", "azalea_ball,azalea_low,shrub_loose,grass_tuft,azalea_hedge").split(",") if b]
room = float(opt("--room", "4.5"))                        # a big tree wants no building within this; nearer a house a small tree stands
gap = float(opt("--gap", "11"))
shots_want = [s_ for s_ in opt("--shots", "").split(",") if s_]
night = "--no-night" not in args
out = Path(opt("--out", str(ROOT / "Saved" / "Streets" / street / "dressed"))).resolve()
G = os.environ.get("GODOT") or shutil.which("godot") or shutil.which("godot-mono")
node = shutil.which("node")
PROPS = ROOT / "Saved" / "Props"
SJ = ROOT / "Content" / "Studio" / "Streets" / street / "street.json"


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("GDDRESS FAILED: no godot (tools/godot_setup.sh on a cloud session; godot-mono on the user's machine)")
if not SJ.exists():
    sys.exit(f"GDDRESS FAILED: no street {street} (python tools/street.py list)")
for n in trees + small + bushes:
    if not (PROPS / n / f"{n}.glb").exists():
        sys.exit(f"GDDRESS FAILED: {n} isn't made (python tools/propgen.py make {n})")
out.mkdir(parents=True, exist_ok=True)
proj = ROOT / "Saved" / "Godot" / "_street_dress" / street
shutil.rmtree(proj, ignore_errors=True)
(proj / "props").mkdir(parents=True)
# the street's .glb, exported fresh when the street is newer
glb = ROOT / "Saved" / "Streets" / street / f"{street}.glb"
if not glb.exists() or glb.stat().st_mtime < SJ.stat().st_mtime:
    r = run([node, str(ROOT / "tools/director/streetexport.mjs"), "--street", street, "--out", str(glb)], cwd=ROOT)
    if r.returncode or not glb.exists():
        sys.exit("GDDRESS FAILED: the export (is the desk's server running? python tools/director/serve.py): " + (r.stdout + r.stderr)[-500:])
shutil.copy(glb, proj / "street.glb")
# where the trees and bushes go: along each road with pavements, by the generator's own road curve (street-gen in node)
PLACE = r'''
import fs from "fs"; import { pathToFileURL } from "url";
const SG = await import(pathToFileURL(process.argv[1] + "/tools/director/street-gen.js").href);
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), gap = +process.argv[3], room = +process.argv[4], T = SG.terrain(S);
const feet = (S.buildings || []).map(b => ({ id: b.id, P: SG.footprint(b) }));
const pip = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
const nearBuilding = (x, y, m) => feet.some(f => pip(x, y, f.P) || f.P.some((p, i) => { const q = f.P[(i + 1) % f.P.length], dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy || 1e-9; let u = ((x - p[0]) * dx + (y - p[1]) * dy) / l2; u = Math.max(0, Math.min(1, u)); return Math.hypot(x - p[0] - dx * u, y - p[1] - dy * u) < m; }));
const things = (S.things || []).filter(t => ["lamp", "lantern", "postlamp", "pole", "sign", "mirror", "vending", "postbox", "bench", "bin"].includes(t.kind));
const nearThing = (x, y, m) => things.some(t => Math.hypot(t.at[0] - x, t.at[1] - y) < m);
const out = { trees: [], bushes: [], walk: null };
let flip = 0, k = 0;
for (const r of S.roads || []) {
  const f = SG.roadPath(r); if (Math.max(...f.walks) < 1.2) continue;
  // trees: every `gap` metres, each side in turn, by the kerb (a street tree's pit sits at the kerb, its crown over the
  // road and the pavement), clear of lamps and poles and of buildings' fronts
  for (let s = 7; s <= f.L - 7; s += gap) {
    for (let tries = 0; tries < 2; tries++) {
      const side = (flip + tries) % 2 === 0 ? 1 : -1, walk = f.walks[side > 0 ? 0 : 1]; if (walk < 1.2) continue;
      const p = f.at(s, side * (f.W / 2 + Math.min(0.65, walk * 0.4)));
      if (nearThing(p[0], p[1], 2.2) || nearBuilding(p[0], p[1], 0.5)) continue;
      out.trees.push({ at: [p[0], p[1], p[2] + f.kerb], s, side, road: r.id, house: nearBuilding(p[0], p[1], room) }); break;
    }
    flip++;
  }
  // bushes and tufts: at the pavements' back edge between the trees, both sides, a few metres apart
  for (let s = 3; s <= f.L - 3; s += 3.4) {
    for (const side of [1, -1]) {
      const walk = f.walks[side > 0 ? 0 : 1]; if (walk < 1.2) continue;
      if (out.trees.some(t => Math.abs(t.s - s) < 2.2 && t.side === side)) continue;
      const back = f.at(s, side * (f.W / 2 + walk - 0.38));
      if (nearThing(back[0], back[1], 1.3) || nearBuilding(back[0], back[1], 0.45)) continue;
      out.bushes.push({ at: [back[0], back[1], back[2] + f.kerb], s, side, road: r.id, edge: "back" });
      if ((k++) % 3 === 0) {                                     // a tuft at the kerb now and then
        const kerb = f.at(s + 1.2, side * (f.W / 2 + 0.25));
        if (!nearThing(kerb[0], kerb[1], 1.0)) out.bushes.push({ at: [kerb[0], kerb[1], kerb[2] + f.kerb], s: s + 1.2, side, road: r.id, edge: "kerb" });
      }
    }
  }
  if (!out.walk) {                                               // the player at the back of the pavement a third of the way, looking on up the road
    const s0 = f.L * 0.3, e = f.at(s0, f.W / 2 + Math.max(1.3, f.walks[0] - 0.4)), l = f.at(Math.min(f.L, s0 + 30), 0.5);
    out.walk = { id: "walk", eye: [e[0], e[1], e[2] + f.kerb + 1.6], look: [l[0], l[1], l[2] + 2.4], vfov: 60, aspect: [16, 9] };
    const s1 = f.L * 0.18, e2 = f.at(s1, 0), l2 = f.at(Math.min(f.L, s1 + 40), 0);          // and from the middle of the road, the trees down both sides
    out.road = { id: "road", eye: [e2[0], e2[1], e2[2] + 1.6], look: [l2[0], l2[1], l2[2] + 3.0], vfov: 55, aspect: [16, 9] };
  }
}
console.log(JSON.stringify(out));
'''
r = run([node, "--input-type=module", "-e", PLACE, str(ROOT), str(SJ), str(gap), str(room)])
if r.returncode:
    sys.exit("GDDRESS FAILED: the places: " + r.stderr[-600:])
P = json.loads(r.stdout)
S = json.loads(SJ.read_text(encoding="utf-8"))
# which prop where: the trees in turn, the bushes in turn (the hedges only at a back edge, the tufts anywhere)
placements = []
hedges = {b for b in bushes if "hedge" in b}
tufts = {b for b in bushes if "grass" in b}
ti = si = 0
for t in P["trees"]:
    # a big tree only with room round it; beside a house a small upright one, whose crown stays off the wall
    if t.get("house") and small:
        name, si = small[si % len(small)], si + 1
    elif trees:
        name, ti = trees[ti % len(trees)], ti + 1
    else:
        continue
    placements.append({"prop": name, "at": t["at"], "yaw": ((ti + si) * 137.5) % 360, "kind": "tree", "size": "small" if t.get("house") else "big",
                       "road": t["road"], "s": round(t["s"], 1)})
bi = 0
for b in P["bushes"]:
    pool = [x for x in bushes if (x in tufts)] if b["edge"] == "kerb" else [x for x in bushes if x not in tufts]
    if not pool:
        continue
    name = pool[bi % len(pool)]
    yaw = None if name in hedges else (bi * 97.0) % 360      # a hedge lies along the pavement: its turn is the road's there
    placements.append({"prop": name, "at": b["at"], "yaw": yaw, "kind": "bush", "road": b["road"], "s": round(b["s"], 1), "side": b["side"]})
    bi += 1
# a hedge's turn: along the road at its place (asked of the generator)
if any(p["yaw"] is None for p in placements):
    TURN = r'''
import fs from "fs"; import { pathToFileURL } from "url";
const SG = await import(pathToFileURL(process.argv[1] + "/tools/director/street-gen.js").href);
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), want = JSON.parse(process.argv[3]);
console.log(JSON.stringify(want.map(w => { const r = S.roads.find(x => x.id === w.road), f = SG.roadPath(r), fr = f.frame(w.s); return Math.atan2(fr.t[1], fr.t[0]) * 180 / Math.PI; })));
'''
    need = [p for p in placements if p["yaw"] is None]
    r = run([node, "--input-type=module", "-e", TURN, str(ROOT), str(SJ), json.dumps([{"road": p["road"], "s": p["s"]} for p in need])])
    for p, a in zip(need, json.loads(r.stdout)):
        p["yaw"] = a
(out / "placements.json").write_text(json.dumps({"street": street, "placements": placements}, indent=1), encoding="utf-8")
print(f"{len([p for p in placements if p['kind'] == 'tree' and p['size'] == 'big'])} big trees (room round them), "
      f"{len([p for p in placements if p['kind'] == 'tree' and p['size'] == 'small'])} small trees (by a house) and "
      f"{len([p for p in placements if p['kind'] == 'bush'])} bushes along {street}'s pavements")
for n in sorted({p["prop"] for p in placements}):
    shutil.copy(PROPS / n / f"{n}.glb", proj / "props" / f"{n}.glb")
# the shots: the street's own, and the walk
shots = [dict(s_) for s_ in S.get("shots", []) if not shots_want or s_.get("id") in shots_want]
for extra in ("walk", "road"):
    if P.get(extra) and (not shots_want or extra in shots_want):
        shots.append(P[extra])
if not shots:
    sys.exit("GDDRESS FAILED: no shots")
(proj / "scene.json").write_text(json.dumps({"placements": placements, "shots": shots, "night": night}), encoding="utf-8")
(proj / "project.godot").write_text('config_version=5\n\n[application]\nconfig/name="street_dress"\n\n[display]\nwindow/size/viewport_width=1600\nwindow/size/viewport_height=900\n', encoding="utf-8")
(proj / "dress.gd").write_text(r'''extends SceneTree
# the street with its trees and bushes, every shot by day (the street check's dusk sky, a sun) and by night (the game's
# night: a navy sky, blue ambient and moon, the street's lamps lit)
func _initialize():
	var a := OS.get_cmdline_user_args()
	var scene = JSON.parse_string(FileAccess.get_file_as_string(a[0]))
	var outdir: String = a[1]
	var g3 = func(p): return Vector3(p[0], p[2], -p[1])
	var s = (load("res://street.glb") as PackedScene).instantiate()
	root.add_child(s)
	var packed := {}
	for p in scene.placements:
		var name: String = p.prop
		if not packed.has(name):
			packed[name] = load("res://props/" + name + ".glb")
		var inst: Node3D = packed[name].instantiate()
		root.add_child(inst)
		inst.position = g3.call(p.at)
		inst.rotation_degrees = Vector3(0, float(p.yaw), 0)
	var cam := Camera3D.new()
	cam.keep_aspect = Camera3D.KEEP_HEIGHT
	cam.near = 0.05
	cam.far = 1500.0
	root.add_child(cam)
	cam.current = true
	var we := WorldEnvironment.new()
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.shadow_enabled = true
	root.add_child(sun)
	for mode in (["day", "night"] if scene.night else ["day"]):
		var env := Environment.new()
		if mode == "day":
			var sky := ProceduralSkyMaterial.new()
			sky.sky_top_color = Color("5d7fa3")
			sky.sky_horizon_color = Color("d8c6cc")
			sky.ground_horizon_color = Color("8a8a90")
			sky.ground_bottom_color = Color("2a2a30")
			env.background_mode = Environment.BG_SKY
			env.sky = Sky.new()
			env.sky.sky_material = sky
			env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
			env.ambient_light_energy = 1.0
			env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
			sun.rotation_degrees = Vector3(-38, -55, 0)
			sun.light_energy = 1.1
			sun.light_color = Color(1.0, 0.93, 0.85)
		else:
			env.background_mode = Environment.BG_COLOR
			env.background_color = Color(0.027, 0.039, 0.086)
			env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
			env.ambient_light_color = Color(0.478, 0.525, 0.667)
			env.ambient_light_energy = 0.45
			env.fog_enabled = true
			env.fog_light_color = Color(0.04, 0.07, 0.16)
			env.fog_density = 0.012
			env.adjustment_enabled = true
			env.adjustment_saturation = 0.85
			sun.rotation_degrees = Vector3(-35, -140, 0)
			sun.light_energy = 0.25
			sun.light_color = Color(0.55, 0.7, 1.0)
		env.tonemap_mode = Environment.TONE_MAPPER_AGX
		env.glow_enabled = true
		env.glow_intensity = 0.5 if mode == "day" else 0.9
		we.environment = env
		for shot in scene.shots:
			cam.fov = float(shot.get("vfov", 60))
			var asp = shot.get("aspect")
			var w := 1600
			if asp is Array and asp.size() == 2 and float(asp[1]) > 0:
				w = int(round(900.0 * float(asp[0]) / float(asp[1])))
			get_root().size = Vector2i(w, 900)
			await process_frame
			cam.look_at_from_position(g3.call(shot.eye), g3.call(shot.look), Vector3.UP)
			for i in 10:
				await process_frame
			var img := root.get_viewport().get_texture().get_image()
			img.save_png(outdir + "/" + mode + "_" + str(shot.id) + ".png")
			print("GDDRESS shot ", mode, " ", shot.id, " ", img.get_width(), "x", img.get_height())
	print("GDDRESS done")
	quit(0)
''', encoding="utf-8")
env = dict(os.environ)
if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
    env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
run([G, "--headless", "--path", str(proj), "--import"], timeout=900, env=env)
cmd = [G, "--path", str(proj), "--rendering-driver", "vulkan", "-s", "dress.gd", "--", str(proj / "scene.json"), str(out)]
if shutil.which("xvfb-run"):
    cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
r = run(cmd, timeout=3600, env=env)
text = "\n".join(ln for ln in (r.stdout + r.stderr).splitlines() if ln and "ALSA" not in ln and "snd_" not in ln)
if "GDDRESS done" not in text or "SCRIPT ERROR" in text:
    print(text[-3000:])
    sys.exit("GDDRESS FAILED: the scene didn't run clean")
for ln in text.splitlines():
    if ln.startswith("GDDRESS shot"):
        print("  " + ln[13:])
# the sheet
try:
    from PIL import Image, ImageDraw
    modes = ["day", "night"] if night else ["day"]
    cols = len(modes)
    tiles = []
    for sh in shots:
        row = []
        for m in modes:
            p = out / f"{m}_{sh['id']}.png"
            im = Image.open(p).convert("RGB") if p.exists() else Image.new("RGB", (800, 450), (40, 40, 44))
            w, h = im.size
            row.append(im.resize((800, int(round(800 * h / w)))))
        tiles.append((sh["id"], row))
    th = max(max(im.size[1] for im in row) for _, row in tiles)
    sheet = Image.new("RGB", (cols * 808 + 8, len(tiles) * (th + 30) + 40), (18, 19, 22))
    d = ImageDraw.Draw(sheet)
    d.text((10, 8), f"{street}, dressed: big trees {', '.join(trees)} where there's room, small trees {', '.join(small)} by the houses, bushes {', '.join(bushes)}: day (left), night (right)", fill=(230, 226, 216))
    for i, (sid, row) in enumerate(tiles):
        for j, im in enumerate(row):
            sheet.paste(im, (8 + j * 808, 36 + i * (th + 30)))
        d.text((12, 36 + i * (th + 30) + th + 6), sid, fill=(200, 198, 190))
    sheet.save(out / "sheet.jpg", quality=86)
    print(f"  the sheet: {out / 'sheet.jpg'}")
except ImportError:
    print("  (no PIL: the pictures alone, no sheet)")
print("GDDRESS ok")
