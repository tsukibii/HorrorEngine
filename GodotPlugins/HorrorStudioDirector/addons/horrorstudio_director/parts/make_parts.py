"""The parts (docs/GODOT_DIRECTOR_PLAN.md §2, DECISIONS 2026-11-01: "logic as droppables"), written as text: an HSThing
each, set to one use or one of the little things' lives. Drop one onto your object in the Scene tree (or select the
object and pick the part in the dock's Add tab): plugin.gd wraps the object in it, so your kettle model becomes a kettle
that boils, its spout a marker you drag. Run again when a use or a life is added:

    python GodotPlugins/HorrorStudioDirector/addons/horrorstudio_director/parts/make_parts.py
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
S = "res://addons/horrorstudio_director/"
USES = {                                   # file: (node name, its fields), the Add tab's order
    "pickup": ("Pickup", {"use": '"pickup"'}),
    "inspect": ("Inspect", {"use": '"inspect"', "inspect_text": '"..."'}),
    "note": ("Note", {"use": '"note"', "note_title": '"A note"', "note_text": '"..."'}),
    "flashlight": ("Flashlight", {"use": '"pickup"', "flashlight": "true"}),
    "switch": ("Switch", {"use": '"switch"'}),
    "breaker": ("Breaker", {"use": '"breaker"'}),
    "seat": ("Seat", {"use": '"sit"'}),
    "bed": ("Bed", {"use": '"sleep"'}),
    "hiding_place": ("HidingPlace", {"use": '"hide"'}),
    "carry": ("Carry", {"use": '"carry"'}),
    "die": ("Die", {"use": '"roll"'}),
    "code_lock": ("CodeLock", {"use": '"code"'}),
    "use_item": ("UseItem", {"use": '"use_item"'}),
    "stain": ("Stain", {"use": '"clean"'}),
    "game_table": ("GameTable", {"use": '"game"'}),
    "solid": ("Solid", {"use": '"none"'}),
}
LIVES = json.loads((HERE / "life_points.json").read_text(encoding="utf-8"))["lives"]


def camel(s):
    return "".join(w.capitalize() for w in s.split("_")).replace("Tv", "TV").replace("Coil", "MosquitoCoil")


def write(key, name, props):
    lines = ["[gd_scene load_steps=2 format=3]\n", f'[ext_resource type="Script" path="{S}level/thing.gd" id="1"]\n',
             f'[node name="{name}" type="Node3D"]', 'script = ExtResource("1")']
    lines += [f"{k} = {v}" for k, v in props.items()]
    (HERE / f"{key}.tscn").write_text("\n".join(lines) + "\n", encoding="utf-8")


for key, (name, props) in USES.items():
    write(key, name, props)
for life in LIVES:
    write(life, camel(life), {"use": '"life"', "life": f'"{life}"'})
index = {"uses": [[k, v[0]] for k, v in USES.items()], "lives": [[k, camel(k), LIVES[k].get("label", k)] for k in LIVES]}
(HERE / "parts.json").write_text(json.dumps(index, indent=1) + "\n", encoding="utf-8")
print(f"PARTS {len(USES)} uses, {len(LIVES)} little things")
