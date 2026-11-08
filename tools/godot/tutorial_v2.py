#!/usr/bin/env python3
"""TUTORIAL2: guides/tutorial_v2 built for real (the user, 2026-11-07: "a tutorial that goes from modelling an interior
for a floor in a hotel to building out the story from scratch in godot using our plugin (not director), should make
use of every aspect we've added so far"). The tutorial's project, made as its steps say:

- a new by-hand project (tools/godot_byhand.py new: the Look plugin, the starter kit, the sound shelf, the moods);
- the hotel floor set (Content/Studio/Sets/hotel_floor) exported as the scene builder's Export for Godot does;
- a Character Studio character made Godot's (a capsule stand-in when the machine has none);
- main.tscn as the guide builds it: the look and the grade, the hotel (its own lamps off), a light zone a room lit by
  the plugin's presets, rain at the end window and a car's lights past 304's, the TV's static, the bath's mirror, wet
  floor and blood, a room tone a room, the Story and the Sound, the note, the key and the batteries, her (who doesn't
  like the light) and her again at the fire exit, the moments and the scares wired up, the fire door's ending.

Then played headless (tools/godot/tutorial_v2_test.gd): up the stairwell's dog-leg, the corridor's lights dimming and
coming back, 304 locked, the note, the key and the lights going out one by one, 304 opened, the flashlight running low,
dying and its batteries going in, her backing off from the light and the corridor going dark when she's flashed twice,
the hush before the jump scare, the fire door and the ending. `--pictures` draws the guide's pictures: Godot's under
xvfb (tutorial_v2_shots.gd) and the scene builder's in a headless browser (tutorial_v2_builder.mjs). `--keep DIR` builds
it in DIR instead of Saved/Godot/_tutorial_v2 (a project to open in Godot and play).

    python tools/godot/tutorial_v2.py [--pictures] [--keep DIR] [--reuse]     (the desk's server running; Godot: $GODOT or godot)

`--reuse` keeps the last run's project (its export and import: the hotel's takes minutes) and makes the kit and the
scene again: for working on the guide.

Ends "TUTORIAL2 ok"."""
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
sys.path.insert(0, str(ROOT / "tools"))
from storykit import exports as EX  # noqa: E402
import godot_byhand as BH  # noqa: E402

args = sys.argv[1:]
G = os.environ.get("GODOT") or shutil.which("godot") or shutil.which("godot-mono")
node = shutil.which("node") or "node"
proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_tutorial_v2"
SET = "hotel_floor"
GUIDE = ROOT / "guides" / "tutorial_v2"
errs = []


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


if not G:
    sys.exit("TUTORIAL2 FAILED: no godot (tools/godot_setup.sh on a cloud session)")
reuse = "--reuse" in args and (proj / "hotel.json").is_file() and (proj / "tutorial.json").is_file()
if reuse:                                                  # the project as the last run made it: the kit and the scene again
    who = json.loads((proj / "tutorial.json").read_text(encoding="utf-8")).get("who")
    BH.install(proj, starter=True)
    run([G, "--headless", "--path", str(proj), "--import"], timeout=1200)   # the scripts' classes registered again (a new class_name in the kit or the plugin)
    print(f"  reusing {proj} (its exports and import kept)")
else:
    if proj.exists() and any(proj.iterdir()) and not (proj / "tutorial.json").exists():
        sys.exit(f"TUTORIAL2 FAILED: {proj} has things in it that this didn't make: give --keep a new folder (it's emptied each time)")
    shutil.rmtree(proj, ignore_errors=True)
    if BH.main(["new", str(proj), "--name", "Room 304"]):
        sys.exit("TUTORIAL2 FAILED: godot_byhand.py new")
    (proj / "tutorial.json").write_text("{}", encoding="utf-8")
    # 1. the hotel floor, exported as the scene builder's button does
    r = run([node, str(ROOT / "tools/director/levelexport.mjs"), "--game", "set:" + SET, "--out", str(proj / "exports/interiors/hotel_floor/hotel_floor.glb")], cwd=ROOT, timeout=900)
    if r.returncode:
        sys.exit("TUTORIAL2 FAILED: the hotel's export: " + (r.stdout + r.stderr)[-500:])
    # 2. her
    people = ROOT / "Content" / "Studio" / "People"
    who = "_studiotest" if (people / "_studiotest/export/_studiotest.glb").is_file() else next((p.name for p in sorted(people.glob("*")) if (p / "export" / f"{p.name}.glb").is_file()), None) if people.is_dir() else None
    if who:
        out, said = EX.character(who, people, node=node, into=proj / "exports/characters" / who)
        print(f"  {who} made Godot's: {said}")
    else:
        print("  note: no Character Studio export on this machine: she's a stand-in capsule (STUDIO makes _studiotest)")
    # 3. what's where in the hotel (Godot reads its own import)
    for _ in range(3):                                     # a fresh project's first import can stop short of the exports
        run([G, "--headless", "--path", str(proj), "--import"], timeout=2400)
        if list((proj / ".godot" / "imported").glob("hotel_floor.glb-*.scn")):
            break
    shutil.copy(ROOT / "tools/godot/tutorial_v2_paths.gd", proj / "tutorial_v2_paths.gd")
    r = run([G, "--headless", "--path", str(proj), "-s", "tutorial_v2_paths.gd"], timeout=600)
    if not (proj / "hotel.json").is_file():
        sys.exit("TUTORIAL2 FAILED: the hotel's places: " + (r.stdout + r.stderr)[-1200:])
H = json.loads((proj / "hotel.json").read_text(encoding="utf-8"))
need = ["tv_screen", "mirror", "end_glass", "window_304", "r304_bath_fx_floor", "linen_kt_bookshelf_1", "vending_kt_desk_1", "door_corridor_e_door", "door_door_304"]
miss = [k for k in need if k not in H["paths"]] + [k for k in ["stairs", "corridor", "r304", "r304_entry", "r304_bath", "vending", "linen"] if k not in H["rooms"]]
if miss:
    sys.exit("TUTORIAL2 FAILED: the hotel's export has no " + ", ".join(miss))


def f3(v):
    return f"Vector3({v[0]:.3f}, {v[1]:.3f}, {v[2]:.3f})"


def tf(pos, turn_deg=0.0):
    a = math.radians(turn_deg)
    c, s = math.cos(a), math.sin(a)
    return f"Transform3D({c:.6f}, 0, {s:.6f}, 0, 1, 0, {-s:.6f}, 0, {c:.6f}, {pos[0]:.4f}, {pos[1]:.4f}, {pos[2]:.4f})"   # a turn about Y


def q(s):
    return json.dumps(s, ensure_ascii=False)


# the numbers the guide gives, read off the export
L, R, B, P = H["lights"], H["rooms"], H["boxes"], H["paths"]
start = H["markers"]["player_start"]
spot = H["markers"]["spot_someone_spot"]
tubes = sorted((n for n in L if n.startswith("light_corridor_kt_tube_batten_")), key=lambda n: L[n][0])
stair_tubes = sorted((n for n in L if n.startswith("light_stairs_kt_tube_batten_")), key=lambda n: L[n][1])
lamp = L.get("light_r304_kt_floor_lamp_1", [4.9, 2.82, -0.3])
corr = R["corridor"]
floor_y = corr["at"][1] - corr["size"][1] / 2 - 0.025                # the corridor's floor (its volume is 0.05 short of its ceiling)
shelf = B["linen_kt_bookshelf_1"]
desk = B["vending_kt_desk_1"]
d304 = B["door_door_304"]["at"]
fire = B["door_corridor_e_door"]["at"]
glass = B["end_glass"]
win304 = B["window_304"]
tub = B["r304_bath_fx_tub"]
her_at = [spot["at"][0], floor_y, spot["at"][2]]
her_turn = spot["turn"] + 180.0                                         # a character's front is its +Z, a marker's its -Z
again_at = [fire[0] - 0.9, floor_y, corr["at"][2]]                     # by the fire door, facing back down the corridor
key_at = [shelf["at"][0] - 0.2, shelf["at"][1] - shelf["size"][1] / 2 + 1.109, shelf["at"][2] + shelf["size"][2] / 2 + 0.006]   # on the third shelf's front edge (kit.js: four a column, 1.105 m up): in front of the bookshelf's own collider, so E finds it
bat_at = [desk["at"][0] + 0.35, desk["top"] + 0.012, desk["at"][2]]
note_at = [d304[0] + 0.35, floor_y + 0.002, d304[2] - 0.45]            # on the carpet in front of 304's door
jump = [fire[0] - 2.4, corr["at"][1], corr["at"][2]]

ext = [("PackedScene", "res://exports/interiors/hotel_floor/hotel_floor.glb", "hotel"), ("Script", "res://starter/interior.gd", "interior"),
       ("PackedScene", "res://starter/player.tscn", "player"), ("Script", "res://starter/story.gd", "story"), ("Script", "res://starter/sound.gd", "sound"),
       ("Script", "res://addons/horrorstudio_look/look_env.gd", "lookenv"), ("Script", "res://addons/horrorstudio_look/nodes/grade.gd", "grade"),
       ("Script", "res://addons/horrorstudio_look/nodes/light_zone.gd", "zone"), ("PackedScene", "res://addons/horrorstudio_look/presets/fluorescent_tube.tscn", "tube"),
       ("PackedScene", "res://addons/horrorstudio_look/presets/dying_bulb.tscn", "bulb"), ("Script", "res://addons/horrorstudio_look/nodes/rain_box.gd", "rain"),
       ("Script", "res://addons/horrorstudio_look/nodes/window_pane.gd", "pane"), ("Script", "res://addons/horrorstudio_look/nodes/headlight_sweep.gd", "sweep"),
       ("Script", "res://addons/horrorstudio_look/nodes/wet_surface.gd", "wet"), ("Script", "res://addons/horrorstudio_look/nodes/mirror_surface.gd", "mirror"),
       ("Script", "res://addons/horrorstudio_look/nodes/crt_screen.gd", "crt"), ("Script", "res://addons/horrorstudio_look/nodes/blood_splat.gd", "blood"),
       ("Script", "res://starter/room_tone.gd", "tone"), ("Script", "res://starter/event_area.gd", "event"), ("Script", "res://starter/scare_area.gd", "scare"),
       ("Script", "res://starter/pickup.gd", "pickup"), ("Script", "res://starter/note.gd", "note"), ("Script", "res://starter/door.gd", "door"),
       ("Script", "res://starter/light_shy.gd", "shy")]
SOUNDS = {"hum": "ambience/electric_hum_01.ogg", "hum3": "ambience/electric_hum_03.ogg", "room": "ambience/room_tone_02.ogg", "closet": "ambience/room_tone_05.ogg",
          "water": "ambience/water_running.ogg", "drone": "ambience/ambient_01.ogg", "cut": "house/power_hum_cut.ogg", "creak": "house/floorboard_creak.ogg",
          "sting": "stings/sting_short.ogg", "big": "stings/sting_big.ogg"}
ext += [("AudioStream", f"res://sfx/{f}", "s_" + k) for k, f in SOUNDS.items()]
if who:
    ext += [("PackedScene", f"res://exports/characters/{who}/{who}.glb", "her"), ("Script", "res://addons/horrorstudio_look/nodes/character_look.gd", "charlook"),
            ("Script", "res://starter/arms_down.gd", "arms")]
subs = [("StandardMaterial3D", "paper", ["albedo_color = Color(0.93, 0.91, 0.84, 1)", "roughness = 0.9"]),
        ("PlaneMesh", "sheet", ["size = Vector2(0.21, 0.297)", 'material = SubResource("paper")']),
        ("StandardMaterial3D", "brass", ["albedo_color = Color(0.78, 0.62, 0.3, 1)", "metallic = 0.9", "roughness = 0.35"]),
        ("BoxMesh", "keymesh", ["size = Vector3(0.075, 0.008, 0.026)", 'material = SubResource("brass")']),
        ("StandardMaterial3D", "cells", ["albedo_color = Color(0.12, 0.12, 0.13, 1)", "roughness = 0.5"]),
        ("BoxMesh", "pack", ["size = Vector3(0.06, 0.022, 0.09)", 'material = SubResource("cells")']),
        ("BoxShape3D", "jumpbox", ["size = Vector3(1.0, 2.5, 1.9)"]),
        ("StandardMaterial3D", "skin", ["albedo_color = Color(0.82, 0.8, 0.78, 1)", "roughness = 0.8"]),
        ("QuadMesh", "screen", [f"size = Vector2({B['tv_screen']['size'][2] - 0.02:.3f}, {B['tv_screen']['size'][1] - 0.02:.3f})"]),
        ("StandardMaterial3D", "dress", ["albedo_color = Color(0.86, 0.85, 0.81, 1)", "roughness = 0.85"]),
        ("StandardMaterial3D", "hair", ["albedo_color = Color(0.02, 0.02, 0.025, 1)", "roughness = 0.35"]),
        ("CylinderMesh", "gown", ["top_radius = 0.16", "bottom_radius = 0.31", "height = 1.36", 'material = SubResource("dress")']),
        ("CapsuleMesh", "arm", ["radius = 0.042", "height = 0.66", 'material = SubResource("skin")']),
        ("SphereMesh", "head", ["radius = 0.1", "height = 0.23", 'material = SubResource("skin")']),
        ("SphereMesh", "scalp", ["radius = 0.118", "height = 0.25", 'material = SubResource("hair")']),
        ("CylinderMesh", "locks", ["top_radius = 0.112", "bottom_radius = 0.17", "height = 0.64", 'material = SubResource("hair")']),
        ("CapsuleMesh", "standin", ["radius = 0.22", "height = 1.62", 'material = SubResource("skin")'])]   # (her stand-in is a figure: a gown, arms, a head, hair down over her face)
lines = [f"[gd_scene load_steps={len(ext) + len(subs) + 1} format=3]", ""]
lines += [f'[ext_resource type="{t}" path="{p}" id="{i}"]' for t, p, i in ext] + [""]
for t, i, props in subs:
    lines += [f'[sub_resource type="{t}" id="{i}"]'] + props + [""]


def nd(name, parent=None, typ=None, inst=None, script=None, props=(), paths=()):
    head = f'[node name="{name}"' + (f' type="{typ}"' if typ else "") + (f' parent="{parent}"' if parent is not None else "")
    if paths:
        head += ' node_paths=PackedStringArray(' + ", ".join(q(p) for p in paths) + ")"
    if inst:
        head += f' instance=ExtResource("{inst}")'
    lines.append(head + "]")
    if script:
        lines.append(f'script = ExtResource("{script}")')
    lines.extend(props)
    lines.append("")


def area(name, parent, script, room=None, props=(), paths=()):
    pp = list(paths) + (["interior"] if room else [])
    pr = list(props) + ([f'interior = NodePath("{"../" * (parent.count("/") + 2)}Hotel")', f'room = {q(room)}'] if room else [])
    nd(name, parent, "Area3D", script=script, props=pr, paths=pp)


def snd(parent, key, db=0.0):
    nd("Sound", parent, "AudioStreamPlayer3D", props=[f'stream = ExtResource("s_{key}")', f"volume_db = {db}"])


nd("Main", typ="Node3D")
nd("Look", ".", "WorldEnvironment", script="lookenv", props=['preset = "balanced"', "editor_only = false"])
nd("Grade", ".", "Node", script="grade", props=['preset = "cold"'])
nd("Hotel", ".", inst="hotel", script="interior", props=["lights_on = false"])
# light zones, a room each, lit by the Look plugin's presets
nd("Zones", ".", "Node3D")


def zone(name, room, kids):
    z = R[room]
    nd(name, "Zones", "Node3D", script="zone", props=[f"transform = {tf(z['at'])}", f"size = {f3(z['size'])}"])
    for kid in kids:
        kid()


zone("Stairwell", "stairs", [lambda: [nd(f"Tube{i + 1}", "Zones/Stairwell", inst="tube", props=[f"transform = {tf([L[n][0] - R['stairs']['at'][0], L[n][1] - R['stairs']['at'][1], L[n][2] - R['stairs']['at'][2]])}", "amount = 0.15"]) for i, n in enumerate(stair_tubes)]])
zone("Corridor", "corridor", [lambda: [nd(f"Tube{i + 1}", "Zones/Corridor", inst="tube", props=[f"transform = {tf([L[n][0] - corr['at'][0], L[n][1] - corr['at'][1], L[n][2] - corr['at'][2]])}", f"amount = {1.0 if i == 2 else 0.12}", "light_energy = 1.3", "omni_range = 5.0"]) for i, n in enumerate(tubes)]])
r304 = R["r304"]
zone("Room304", "r304", [lambda: nd("Lamp", "Zones/Room304", "OmniLight3D", props=[f"transform = {tf([lamp[0] - r304['at'][0], lamp[1] + 0.25 - r304['at'][1], lamp[2] - r304['at'][2]])}", "light_color = Color(1, 0.78, 0.55, 1)", "light_energy = 1.1", "omni_range = 5.0", "shadow_enabled = true"])])
ent = R["r304_entry"]
zone("Entry304", "r304_entry", [lambda: nd("Light", "Zones/Entry304", "OmniLight3D", props=[f"transform = {tf([0, ent['size'][1] / 2 - 0.25, 0])}", "light_color = Color(1, 0.9, 0.75, 1)", "light_energy = 0.5", "omni_range = 3.5"])])
bath = R["r304_bath"]
zone("Bath304", "r304_bath", [lambda: nd("Light", "Zones/Bath304", "OmniLight3D", props=[f"transform = {tf([0, bath['size'][1] / 2 - 0.2, 0])}", "light_color = Color(0.85, 0.92, 1, 1)", "light_energy = 0.9", "omni_range = 3.0", "shadow_enabled = true"])])
vend = R["vending"]
zone("Vending", "vending", [lambda: nd("Bulb", "Zones/Vending", inst="bulb", props=[f"transform = {tf([0, vend['size'][1] / 2 - 0.3, 0])}"])])
# the weather outside and the rooms' dressing (the plugin's nodes on the hotel's meshes)
nd("Weather", ".", "Node3D")
nd("Rain", "Weather", "Node3D", script="rain", props=[f"transform = {tf([glass['at'][0] - 2.2, glass['at'][1] - 0.4, glass['at'][2]])}", "size = Vector3(3.6, 7, 6)", "count = 3000", "strength = 0.75"])
nd("StreetLamp", "Weather", "OmniLight3D", props=[f"transform = {tf([glass['at'][0] - 1.8, glass['at'][1] - 1.2, glass['at'][2] + 1.3])}", "light_color = Color(1, 0.66, 0.34, 1)",
   "light_energy = 4.0", "omni_range = 10.0", "shadow_enabled = true"])
nd("Pane", "Weather", "Node3D", script="pane", props=[f'target = NodePath("../../Hotel/{P["end_glass"]}")', "rain = 0.7"], paths=["target"])
nd("Sweep", "Weather", "Node3D", script="sweep", props=[f"transform = {tf([win304['at'][0], win304['at'][1], win304['at'][2] - 0.1])}", "every = 18.0", "out = 7.0", "energy = 8.0"])
nd("Dressing", ".", "Node3D")
tv = B["tv_screen"]                                                     # its front faces the room (west): a quad 4 mm in front of it
nd("TV", "Dressing", "MeshInstance3D", props=[f"transform = {tf([tv['at'][0] - tv['size'][0] / 2 - 0.004, tv['at'][1], tv['at'][2]], -90.0)}", 'mesh = SubResource("screen")'])
nd("Static", "Dressing/TV", "Node3D", script="crt", props=["brightness = 1.3"])
nd("Mirror", "Dressing", "Node", script="mirror", props=[f'target = NodePath("../../Hotel/{P["mirror"]}")'], paths=["target"])
nd("WetFloor", "Dressing", "Node3D", script="wet", props=[f'target = NodePath("../../Hotel/{P["r304_bath_fx_floor"]}")', "wetness = 0.85", "puddles = 0.6"], paths=["target"])
nd("Blood", "Dressing", "Node3D", script="blood", props=[f"transform = {tf([tub['at'][0] + 0.72, floor_y + 0.012, tub['at'][2] - 0.1])}", "size = 0.55", "seed = 3.0"])
# a room tone a room
nd("Tones", ".", "Node3D")
for name, room, key in [("Stairwell", "stairs", "drone"), ("Corridor", "corridor", "hum"), ("Room304", "r304", "room"), ("Entry304", "r304_entry", "room"),
                        ("Bath304", "r304_bath", "water"), ("Linen", "linen", "closet"), ("Vending", "vending", "hum3")]:
    area(name, "Tones", "tone", room, props=[f'tone = ExtResource("s_{key}")'])
# the things the story is told with
nd("Things", ".", "Node3D")
nd("Note", "Things", "Node3D", script="note", props=[f"transform = {tf(note_at, 20.0)}", 'title = "Under 304\'s door"',
   'text = "Sorry, the card reader on 304 is broken again. The master key is on the shelf in the linen closet, across the corridor. Leave it there after. Please don\'t knock on 308.\\n\\n- the night desk"',
   'add_tasks = PackedStringArray("key: Find the master key in the linen closet")'])
nd("Paper", "Things/Note", "MeshInstance3D", props=['mesh = SubResource("sheet")'])
nd("Key", "Things", "Node3D", script="pickup", props=[f"transform = {tf(key_at, 15.0)}", 'item = "key_304"', 'label = "the master key"', 'tick = "key"'])
nd("Mesh", "Things/Key", "MeshInstance3D", props=['mesh = SubResource("keymesh")'])
nd("Batteries", "Things", "Node3D", script="pickup", props=[f"transform = {tf(bat_at, 30.0)}", 'item = "batteries"', 'label = "a pack of batteries"', 'tick = "batteries"'])
nd("Mesh", "Things/Batteries", "MeshInstance3D", props=['mesh = SubResource("pack")'])
# her, and her again at the fire exit (the jump scare)


def person(name, at, turn, shy):
    if who:
        nd(name, ".", inst="her", props=[f"transform = {tf(at, turn)}", "visible = false"])
        nd("Look", name, "Node", script="charlook")
        nd("ArmsDown", name, "Node", script="arms")
    else:
        nd(name, ".", "Node3D", props=[f"transform = {tf(at, turn)}", "visible = false"])     # a stand-in: a pale gown, long black hair over her face
        nd("Gown", name, "MeshInstance3D", props=[f"transform = {tf([0, 0.68, 0])}", 'mesh = SubResource("gown")'])
        nd("ArmL", name, "MeshInstance3D", props=[f"transform = {tf([-0.185, 0.99, 0.02])}", 'mesh = SubResource("arm")'])
        nd("ArmR", name, "MeshInstance3D", props=[f"transform = {tf([0.185, 0.99, 0.02])}", 'mesh = SubResource("arm")'])
        nd("Head", name, "MeshInstance3D", props=[f"transform = {tf([0, 1.5, 0])}", 'mesh = SubResource("head")'])
        nd("Scalp", name, "MeshInstance3D", props=[f"transform = {tf([0, 1.53, -0.005])}", 'mesh = SubResource("scalp")'])
        nd("Hair", name, "MeshInstance3D", props=[f"transform = {tf([0, 1.2, 0.01])}", 'mesh = SubResource("locks")'])
    if shy:
        nd("LightShy", name, "Node", script="shy", props=['does = "backs off"', "distance = 2.5", "after = 0.4"])


person("Her", her_at, her_turn, True)
person("HerAgain", again_at, her_turn, False)
# the moments and the scares
nd("Events", ".", "Node3D")
area("UpStairs", "Events", "event", "corridor", props=['tick = "up"', 'say = "The third floor."'])
area("Welcome", "Events", "scare", "corridor", props=['lights_do = "dim"', "dim_to = 0.15", "for_seconds = 3.0", 'lights_of = NodePath("../../Zones/Corridor")'], paths=["lights_of"])
snd("Events/Welcome", "cut", -4.0)
area("In304", "Events", "event", "r304", props=['tick = "find304"', 'music = "dread"', 'objective = "Get out. The fire exit is at the end of the corridor."',
                                                'add_tasks = PackedStringArray("out: Get out by the fire exit")'])
area("LightsDie", "Events", "scare", None, props=['lights_do = "one by one"', "gap = 0.35", "for_seconds = 4.0", "walk_in = false", 'lights_of = NodePath("../../Zones/Corridor")'], paths=["lights_of"])
snd("Events/LightsDie", "sting", -6.0)
area("SheIsThere", "Events", "scare", "r304_entry", props=['needs = "task:find304"', 'appear = NodePath("../../Her")'], paths=["appear"])
snd("Events/SheIsThere", "creak")
area("LightsOut", "Events", "scare", None, props=['lights_do = "one by one"', "gap = 0.25", "walk_in = false", 'lights_of = NodePath("../../Zones/Corridor")'], paths=["lights_of"])
nd("Jump", "Events", "Area3D", script="scare", props=[f"transform = {tf(jump)}", 'needs = "task:find304"', "quiet = 1.5", "appear_for = 0.9",
                                                  'appear = NodePath("../../HerAgain")', 'hide = NodePath("../../Her")'], paths=["appear", "hide"])
nd("Shape", "Events/Jump", "CollisionShape3D", props=['shape = SubResource("jumpbox")'])
snd("Events/Jump", "big")
# the player, its flashlight on a battery that's seen better days
nd("Player", ".", inst="player", props=[f"transform = {tf(start['at'], start['turn'])}"])
nd("Flashlight", "Player/Eye", props=["battery = 90.0", "charge = 0.5", "low_at = 0.3", 'low_says = "The flashlight is dying."',
                                      'low_task = "batteries: Find batteries (the vending corner)"'])
nd("Story", ".", "CanvasLayer", script="story", props=['objective_text = "Room 304, third floor. The lift is out."',
   'tasks = PackedStringArray("up: Go up to the third floor", "find304: Find room 304")', 'ending_title = "Checked out"',
   'ending_text = "The fire stairs took you down to the street. Nobody ever asked who was staying in 308."'])
nd("Sound", ".", "Node", script="sound", props=['mood = "uneasy"'])
# the fire door: given door.gd in the scene (Hotel's Editable Children) so its signal can end the game
nd(P["door_corridor_e_door"].split("/")[-1], "Hotel/" + "/".join(P["door_corridor_e_door"].split("/")[:-1]), script="door", props=['tick = "out"'])
lines += ['[connection signal="picked" from="Things/Key" to="Events/LightsDie" method="fire"]',
          '[connection signal="flashed_twice" from="Her/LightShy" to="Events/LightsOut" method="fire"]',
          f'[connection signal="opened" from="Hotel/{P["door_corridor_e_door"]}" to="Story" method="end"]', "", '[editable path="Hotel"]', '[editable path="Player"]', ""]
(proj / "main.tscn").write_text("\n".join(lines), encoding="utf-8")
pg = (proj / "project.godot").read_text(encoding="utf-8")
if "run/main_scene" not in pg:
    pg = pg.replace('config/name="Room 304"', 'config/name="Room 304"\nrun/main_scene="res://main.tscn"') + "\n[display]\nwindow/size/viewport_width=1600\nwindow/size/viewport_height=900\n"
    (proj / "project.godot").write_text(pg, encoding="utf-8")
(proj / "tutorial.json").write_text(json.dumps({"who": who, "start": start, "her": her_at, "again": again_at, "note": note_at, "key": key_at, "batteries": bat_at,
                                                "door304": d304, "fire": fire, "jump": jump, "floor": floor_y, "rooms": R, "lights": L, "paths": P, "boxes": B}, indent=1), encoding="utf-8")
for f in ["tutorial_v2_test.gd", "tutorial_v2_shots.gd"]:
    shutil.copy(ROOT / "tools/godot" / f, proj / f)

# 4. played through headless
r = run([G, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "tutorial_v2_test.gd"], timeout=900)
got = [ln for ln in r.stdout.splitlines() if ln.startswith("TUTORIAL ")]
for ln in got:
    print("  " + ln[9:])
res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("TUTORIAL result ")), None)
if res is None:
    sys.exit("TUTORIAL2 FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-2500:])
errs += res.get("errors", [])
bad_script = [ln for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln]
errs += [f"a script error: {ln.strip()}" for ln in bad_script[:6]]

# 5. the pictures: Godot's of the game, the browser's of the scene builder
if "--pictures" in args and not errs:
    from PIL import Image
    shots = proj / "_shots"
    shots.mkdir(exist_ok=True)
    cmd = [G, "--path", str(proj), "--rendering-driver", "vulkan", "--fixed-fps", "30", "-s", "tutorial_v2_shots.gd", "--", f"--out={shots}"]
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
    r = run(cmd, timeout=3600)
    made = sorted(shots.glob("*.png"))
    if not made:
        errs.append("no pictures came out of Godot: " + (r.stdout + r.stderr)[-800:])
    (GUIDE / "img").mkdir(parents=True, exist_ok=True)
    for p in made:
        im = Image.open(p).convert("RGB")
        im.save(GUIDE / "img" / f"{p.stem}.jpg", quality=86, optimize=True)
        print(f"  picture: guides/tutorial_v2/img/{p.stem}.jpg ({im.width}x{im.height})")
    r = run([node, str(ROOT / "tools/godot/tutorial_v2_builder.mjs"), "--out", str(GUIDE / "img")], cwd=ROOT, timeout=1800)
    print("  " + "\n  ".join((r.stdout.strip() or r.stderr.strip()[-600:]).splitlines()[-8:]))
    if r.returncode:
        errs.append("the scene builder's pictures: " + (r.stdout + r.stderr)[-600:])


# 6. the guide: every picture it shows is there and every one there is shown, every link lands (its #place too)
def guide_check():
    from html.parser import HTMLParser
    out = []

    class Pg(HTMLParser):
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

    page = GUIDE / "index.html"
    if not page.is_file():
        return ["guides/tutorial_v2/index.html is missing"]
    h = Pg()
    h.feed(page.read_text(encoding="utf-8"))
    used = set()
    for src in h.srcs:
        f = (page.parent / src).resolve()
        used.add(f)
        if not f.is_file():
            out.append(f"guides/tutorial_v2/index.html shows {src}, which isn't there")
    for href in h.hrefs:
        if href.startswith(("http:", "https:", "mailto:")):
            continue
        path, _, frag = href.partition("#")
        tgt = (page.parent / path).resolve() if path else page.resolve()
        if not tgt.exists():
            out.append(f"guides/tutorial_v2/index.html links to {href}, which isn't there")
        elif frag and tgt.suffix == ".html":
            th = h if tgt == page.resolve() else Pg()
            if th is not h:
                th.feed(tgt.read_text(encoding="utf-8"))
            if frag not in th.ids:
                out.append(f"guides/tutorial_v2/index.html links to {href}: no #{frag} there")
    for f in sorted((GUIDE / "img").glob("*.jpg")):
        if f.resolve() not in used:
            out.append(f"guides/tutorial_v2/img/{f.name} is shown nowhere")
    if 'href="tutorial_v2/index.html"' not in (ROOT / "guides" / "index.html").read_text(encoding="utf-8"):
        out.append("guides/index.html has no card for tutorial_v2")
    return out


gc = guide_check()
errs += gc
if not gc:
    print("  the guide: every picture there and shown, every link landing, its card in guides/index.html")
for e in errs:
    print("ERROR: " + e)
print("TUTORIAL2 ok" if not errs else f"TUTORIAL2 FAILED ({len(errs)})")
sys.exit(1 if errs else 0)
