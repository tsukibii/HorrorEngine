#!/usr/bin/env python3
"""FIRSTGAME: guides/first_game built for real (DECISIONS 2026-11-03, night: "a basic tutorial for your first game that
tells you how to set up each part (interior, street and character)"). The tutorial's project, made as its steps say:

- the exports as the editors make them (the Bungalow set's interior without its outside, the hill motel street it
  stands in, a Character Studio character made Godot's) in the project's exports/ folders;
- the HorrorStudio Look plugin in addons/, the guide's starter scripts in starter/, a sting off the sound shelf;
- main.tscn as the guide builds it: the street, the Bungalow on it (interior.gd at the street's inside_bungalow1), the
  character in the guest room (HSCharacterLook, arms_down.gd), the player in front of the house, the scare over the
  guest room (scare_area.gd), the look (HSLookEnvironment), a moon.

Then played headless (tools/godot/first_game_test.gd): the player lands on the street and walks toward the house, a ray
through the street's doorway meets the Bungalow's own door, E slides the front door open, walking into the guest room
puts its lamps out and she's there. `--pictures` makes the guides' pictures too, by Godot under xvfb
(first_game_shots.gd): guides/first_game/img and guides/godot_by_hand/img. `--keep DIR` builds it in DIR instead of
Saved/Godot/_first_game (a project to open in Godot and play).

    python tools/godot/first_game.py [--pictures] [--keep DIR]     (the desk's server running; Godot: $GODOT or godot)

Ends "FIRSTGAME ok"."""
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import exports as EX  # noqa: E402

args = sys.argv[1:]
G = os.environ.get("GODOT") or shutil.which("godot") or shutil.which("godot-mono")
node = shutil.which("node") or "node"
proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_first_game"
STREET, BUILDING, SET, ROOM = "hill_motel", "bungalow1", "bungalow", "kyakuma"
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("FIRSTGAME FAILED: no godot (tools/godot_setup.sh on a cloud session)")
if proj.exists() and any(proj.iterdir()) and not (proj / "first.json").exists():
    sys.exit(f"FIRSTGAME FAILED: {proj} has things in it that this didn't make: give --keep a new folder (it's emptied each time)")
shutil.rmtree(proj, ignore_errors=True)
# the guide's setup: a new project with the look plugin, HumanShaders and the starter scripts (tools/godot_byhand.py new)
sys.path.insert(0, str(ROOT / "tools"))
import godot_byhand as BH  # noqa: E402
if BH.main(["new", str(proj), "--name", "My first game"]):
    sys.exit("FIRSTGAME FAILED: godot_byhand.py new")
for d in ["exports/interiors/bungalow", "exports/streets/hill_motel", "sounds"]:
    (proj / d).mkdir(parents=True, exist_ok=True)

# 1-3. the exports, as the editors make them (the interior without its outside: the street has the shell)
r = run([node, str(ROOT / "tools/director/levelexport.mjs"), "--game", "set:" + SET, "--no-outside", "--out", str(proj / "exports/interiors/bungalow/bungalow.glb")], cwd=ROOT, timeout=900)
if r.returncode:
    sys.exit("FIRSTGAME FAILED: the interior's export: " + (r.stdout + r.stderr)[-500:])
r = run([node, str(ROOT / "tools/director/streetexport.mjs"), "--street", STREET, "--out", str(proj / "exports/streets/hill_motel/hill_motel.glb")], cwd=ROOT, timeout=900)
if r.returncode:
    sys.exit("FIRSTGAME FAILED: the street's export: " + (r.stdout + r.stderr)[-500:])
people = ROOT / "Content" / "Studio" / "People"
who = "_studiotest" if (people / "_studiotest/export/_studiotest.glb").is_file() else next((p.name for p in sorted(people.glob("*")) if (p / "export" / f"{p.name}.glb").is_file()), None) if people.is_dir() else None
if who:
    out, said = EX.character(who, people, node=node, into=proj / "exports/characters" / who)
    print(f"  {who} made Godot's: {said}")
else:
    print("  note: no Character Studio export on this machine: she's a stand-in capsule (STUDIO makes _studiotest)")

# a sting off the sound shelf
shutil.copy(ROOT / "Content/Studio/SFX/stings/sting_short.ogg", proj / "sounds/sting_short.ogg")

# where things go: the street's marker for the Bungalow, its doorway from outside (street-gen in node, as GDSTREET)
probe = r'''
import fs from "fs"; import { pathToFileURL } from "url";
const SG = await import(pathToFileURL(process.argv[1] + "/tools/director/street-gen.js").href);
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), T = SG.terrain(S), b = S.buildings.find(q => q.id === process.argv[3]);
const g3 = (x, y, z) => [x, z, -y], foot = SG.footing(b, T), fr = SG.insideFrame(b.inside), ol = SG.insideOutline(fr.rooms);
const e = ol.edges.find(e => (e.holes || []).some(h => !h.window)), h = e.holes.find(h => !h.window), mid = (h.a0 + h.a1) / 2, lv = e.axis === "x" ? [mid, e.v] : [e.v, mid];
const L2 = (x, y) => { const [u, v] = fr.toLocal(x, y); return [u, v]; };
const p0 = L2(...lv), p1 = L2(lv[0] + e.n[0], lv[1] + e.n[1]), z = foot.z + (+b.inside.raise || 0.15) + 1.0;
const w0 = SG.place([p0[0], p0[1], z], { at: b.at, turn: b.turn }), w1 = SG.place([p1[0], p1[1], z], { at: b.at, turn: b.turn });
const M = SG.insideMarkers(b, foot)[0];
console.log(JSON.stringify({ marker: { name: M.name, at: g3(...M.at), turn: M.turn || 0 }, door: (h.door || {}).id, out1: g3(...w1), in0: g3(...w0), ground: T.ground ? T.ground(w1[0], w1[1]) : foot.z }));
'''
r = run([node, "--input-type=module", "-e", probe, str(ROOT), str(ROOT / "Content/Studio/Streets" / STREET / "street.json"), BUILDING])
if r.returncode:
    sys.exit("FIRSTGAME FAILED: the street's numbers: " + r.stderr[-400:])
P = json.loads(r.stdout)
M = P["marker"]
th = math.radians(M["turn"])
c, s = math.cos(th), math.sin(th)


def world(local):                                        # the interior's own (Godot, from its level's origin) into the world
    x, y, z = local
    return [M["at"][0] + c * x + s * z, M["at"][1] + y, M["at"][2] - s * x + c * z]


level = json.loads((ROOT / "Content/Studio/Sets" / SET / "story.json").read_text(encoding="utf-8"))["levels"][SET]
room = next(q for q in level["rooms"] if q["id"] == ROOM)
rx, ry, rz = room["at"][0] + room["size"][0] / 2, room["at"][1] + room["size"][1] / 2, room["at"][2]
her = world([rx - 0.4, rz, -ry])                         # she stands in the guest room, a little off its middle
scare = world([rx, rz + 1.2, -ry])
d = [P["in0"][0] - P["out1"][0], P["in0"][2] - P["out1"][2]]
dl = math.hypot(*d) or 1
d = [d[0] / dl, d[1] / dl]
start = [P["out1"][0] - d[0] * 2.5, P["out1"][1] - 0.6, P["out1"][2] - d[1] * 2.5]   # 3.5 m out from the doorway, on the street
yaw_player = math.atan2(-d[0], -d[1])                    # its -Z toward the house
yaw_her = th + math.radians(90)                          # her +Z (a glTF character's front) toward the entry, east in the set


def tf(pos, yaw):
    cy, sy = math.cos(yaw), math.sin(yaw)
    return f"Transform3D({cy:.6f}, 0, {sy:.6f}, 0, 1, 0, {-sy:.6f}, 0, {cy:.6f}, {pos[0]:.4f}, {pos[1]:.4f}, {pos[2]:.4f})"   # a turn about Y (the basis by rows)


# main.tscn as the guide builds it
ext = [("PackedScene", "res://exports/streets/hill_motel/hill_motel.glb", "street"),
       ("PackedScene", "res://exports/interiors/bungalow/bungalow.glb", "bungalow"),
       ("Script", "res://starter/interior.gd", "interior"), ("PackedScene", "res://starter/player.tscn", "player"),
       ("Script", "res://starter/scare_area.gd", "scare"), ("Script", "res://addons/horrorstudio_look/look_env.gd", "lookenv"),
       ("AudioStream", "res://sounds/sting_short.ogg", "sting")]
if who:
    ext += [("PackedScene", f"res://exports/characters/{who}/{who}.glb", "her"), ("Script", "res://addons/horrorstudio_look/nodes/character_look.gd", "charlook"),
            ("Script", "res://starter/arms_down.gd", "arms")]
rw, rd, rh = room["size"][0] - 0.3, room["size"][1] - 0.3, 2.2
lines = [f"[gd_scene load_steps={len(ext) + 3} format=3]", ""]
lines += [f'[ext_resource type="{t}" path="{p}" id="{i}"]' for t, p, i in ext] + [""]
lines += ['[sub_resource type="BoxShape3D" id="room"]', f"size = Vector3({rw:.3f}, {rh:.3f}, {rd:.3f})", ""]
lines += ['[sub_resource type="CapsuleMesh" id="standin"]', "radius = 0.22", "height = 1.62", ""]
lines += ['[node name="Main" type="Node3D"]', "",
          '[node name="Look" type="WorldEnvironment" parent="."]', 'script = ExtResource("lookenv")', 'preset = "balanced"', "editor_only = false", "",
          '[node name="Moon" type="DirectionalLight3D" parent="."]',
          "transform = Transform3D(0.866025, -0.25, 0.433013, 0, 0.866025, 0.5, -0.5, -0.433013, 0.75, 0, 30, 0)",
          "light_color = Color(0.62, 0.7, 0.95, 1)", "light_energy = 0.18", "shadow_enabled = true", "",
          '[node name="Street" parent="." instance=ExtResource("street")]', "",
          '[node name="Bungalow" parent="." node_paths=PackedStringArray("street") instance=ExtResource("bungalow")]', 'script = ExtResource("interior")',
          'street = NodePath("../Street")', f'marker = "{M["name"]}"', ""]
if who:
    lines += [f'[node name="Mari" parent="." instance=ExtResource("her")]', f"transform = {tf(her, yaw_her)}", "",
              '[node name="Look" type="Node" parent="Mari"]', 'script = ExtResource("charlook")', "",
              '[node name="ArmsDown" type="Node" parent="Mari"]', 'script = ExtResource("arms")', ""]
else:
    lines += ['[node name="Mari" type="MeshInstance3D" parent="."]', f"transform = {tf([her[0], her[1] + 0.81, her[2]], yaw_her)}", 'mesh = SubResource("standin")', ""]
lines += ['[node name="Player" parent="." instance=ExtResource("player")]', f"transform = {tf(start, yaw_player)}", "",
          '[node name="Scare" type="Area3D" parent="." node_paths=PackedStringArray("lights_of", "appear")]', f"transform = {tf(scare, th)}", 'script = ExtResource("scare")',
          'lights_of = NodePath("../Bungalow")', 'appear = NodePath("../Mari")', "",
          '[node name="Shape" type="CollisionShape3D" parent="Scare"]', 'shape = SubResource("room")', "",
          '[node name="Sound" type="AudioStreamPlayer3D" parent="Scare"]', 'stream = ExtResource("sting")', ""]
(proj / "main.tscn").write_text("\n".join(lines), encoding="utf-8")
# main.tscn the main scene (Project Settings > Run > Main Scene, as the guide says), the pictures' size
pg = (proj / "project.godot").read_text(encoding="utf-8").replace('config/name="My first game"', 'config/name="My first game"\nrun/main_scene="res://main.tscn"')
(proj / "project.godot").write_text(pg + "\n[display]\nwindow/size/viewport_width=1600\nwindow/size/viewport_height=900\n", encoding="utf-8")
(proj / "first.json").write_text(json.dumps({"street": P, "her": her, "scare": scare, "start": start, "room": room["id"], "who": who}), encoding="utf-8")
for f in ["first_game_test.gd", "first_game_shots.gd"]:
    shutil.copy(ROOT / "tools/godot" / f, proj / f)

# into Godot: imported as dragging the folders in does, then played
run([G, "--headless", "--path", str(proj), "--import"], timeout=1200)
r = run([G, "--headless", "--path", str(proj), "-s", "first_game_test.gd"], timeout=600)
got = [ln for ln in r.stdout.splitlines() if ln.startswith("FIRST ")]
for ln in got:
    print("  " + ln[6:])
res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("FIRST result ")), None)
if res is None:
    sys.exit("FIRSTGAME FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-1500:])
errs += res.get("errors", [])
bad_script = [ln for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln]
errs += [f"a script error: {ln.strip()}" for ln in bad_script[:5]]

if "--pictures" in args and not errs:
    shots = proj / "_shots"
    shots.mkdir(exist_ok=True)
    cmd = [G, "--path", str(proj), "--rendering-driver", "vulkan", "--fixed-fps", "30", "-s", "first_game_shots.gd", "--", f"--out={shots}"]
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
    r = run(cmd, timeout=1800)
    made = sorted(shots.glob("*.png"))
    if not made:
        errs.append("no pictures came out: " + (r.stdout + r.stderr)[-800:])
    from PIL import Image
    to = {"street": "first_game", "door": "first_game", "inside": "first_game", "scare": "first_game", "her": "first_game",
          "interior_top": "godot_by_hand", "street_top": "godot_by_hand", "character": "godot_by_hand"}
    for p in made:
        g = to.get(p.stem)
        if not g:
            continue
        im = Image.open(p).convert("RGB")
        im.save(ROOT / "guides" / g / "img" / f"{p.stem}.jpg", quality=86, optimize=True)
        print(f"  picture: guides/{g}/img/{p.stem}.jpg ({im.width}x{im.height})")

# the look plugin's guide wears its own check's pictures (LOOKPLUGIN: python tools/godot/plugin_check.py)
LOOK_PICS = ["nodes", "look_plain", "look_realism", "pattern", "shaft", "sweep", "zones", "wet", "blood_rain", "leak", "mirror",
             "skin", "hair", "grade", "window_sun", "air_level_25", "air_level_50", "air_woods_mist", "air_side"]
if "--pictures" in args:
    from PIL import Image
    src = ROOT / "Saved" / "Story" / "_look" / "godot_plugin"
    missing = [n for n in LOOK_PICS if not (src / f"{n}.png").is_file()]
    if missing:
        errs.append(f"the look plugin's pictures aren't made yet ({', '.join(missing[:4])}...): python tools/godot/plugin_check.py first")
    for n in LOOK_PICS:
        if (src / f"{n}.png").is_file():
            Image.open(src / f"{n}.png").convert("RGB").save(ROOT / "guides" / "look_plugin" / "img" / f"{n}.jpg", quality=86, optimize=True)


# the three guides: every picture they show is there and every one there is shown, every link lands (its #place too)
def guides_check():
    from html.parser import HTMLParser
    out = []

    class P(HTMLParser):
        def __init__(self):
            super().__init__()
            self.srcs, self.hrefs, self.ids = [], [], set()

        def handle_starttag(self, tag, attrs):
            a = dict(attrs)
            if a.get("id"):
                self.ids.add(a["id"])
            if tag == "img" and a.get("src"):
                self.srcs.append(a["src"])
            if tag == "a" and a.get("href"):
                self.hrefs.append(a["href"])

    pages = {}
    for g in ["godot_by_hand", "look_plugin", "first_game"]:
        p = ROOT / "guides" / g / "index.html"
        if not p.is_file():
            out.append(f"guides/{g}/index.html is missing")
            continue
        h = P()
        h.feed(p.read_text(encoding="utf-8"))
        pages[p.resolve()] = h
    used = set()
    for p, h in pages.items():
        for src in h.srcs:
            f = (p.parent / src).resolve()
            used.add(f)
            if not f.is_file():
                out.append(f"{p.relative_to(ROOT)} shows {src}, which isn't there")
        for href in h.hrefs:
            if href.startswith(("http:", "https:", "mailto:")):
                continue
            path, _, frag = href.partition("#")
            tgt = (p.parent / path).resolve() if path else p
            if not tgt.exists():
                out.append(f"{p.relative_to(ROOT)} links to {href}, which isn't there")
            elif frag and tgt.suffix == ".html":
                th = pages.get(tgt)
                if th is None:
                    th = P()
                    th.feed(tgt.read_text(encoding="utf-8"))
                if frag not in th.ids:
                    out.append(f"{p.relative_to(ROOT)} links to {href}: no #{frag} there")
    for g in ["godot_by_hand", "look_plugin", "first_game"]:
        for f in sorted((ROOT / "guides" / g / "img").glob("*.jpg")):
            if f.resolve() not in used:
                out.append(f"guides/{g}/img/{f.name} is shown nowhere")
    idx = (ROOT / "guides" / "index.html").read_text(encoding="utf-8")
    for g in ["godot_by_hand", "look_plugin", "first_game"]:
        if f'href="{g}/index.html"' not in idx:
            out.append(f"guides/index.html has no card for {g}")
    return out


gc = guides_check()
errs += gc
if not gc:
    print("  the guides: godot_by_hand, look_plugin and first_game, every picture there and shown, every link landing")

for e in errs:
    print("ERROR: " + e)
print("FIRSTGAME ok" if not errs else f"FIRSTGAME FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
