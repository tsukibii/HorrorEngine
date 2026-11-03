"""The Add tab's drag-in presets (docs/GODOT_DIRECTOR.md §6), written as text: one node each with its numbers. A preset
dropped into the viewport is made a node of the scene's own (plugin.gd unlinks it from its file, its curve copied)."""
from pathlib import Path

HERE = Path(__file__).resolve().parent
S = "res://addons/horrorstudio_director/"
PRESETS = {
    "player_start": ("PlayerStart", "Marker3D", "level/player_start.gd", {}),
    "test_start": ("TestStart", "Marker3D", "level/player_start.gd", {"start_for": '"test"'}),
    "checkpoint": ("Checkpoint", "Node3D", "level/checkpoint.gd", {}),
    "level": ("Level", "Node3D", "level/level.gd", {}),
    "room": ("Room", "Node3D", "level/room.gd", {"size": "Vector3(4, 2.6, 4)"}),
    "room_big": ("BigRoom", "Node3D", "level/room.gd", {"size": "Vector3(7, 3, 6)"}),
    "corridor": ("Corridor", "Node3D", "level/room.gd", {"size": "Vector3(1.6, 2.6, 6)"}),
    "door": ("Door", "Node3D", "level/door.gd", {}),
    "door_locked": ("LockedDoor", "Node3D", "level/door.gd", {"locked_by": '"key"'}),
    "area": ("Area", "Node3D", "level/trigger.gd", {}),
    "area_safe": ("SafeArea", "Node3D", "level/trigger.gd", {"safe": "true"}),
    "spot": ("Spot", "Marker3D", "level/spot.gd", {}),
    "path": ("Path", "Path3D", "level/path.gd", {"curve": "SubResource(\"curve\")"}),
    "character": ("Character", "Node3D", "level/actor.gd", {}),
    "watcher": ("Watcher", "Node3D", "level/actor.gd", {"sees_player": "true", "face_player": "false"}),
    "light": ("Light", "OmniLight3D", None, {"light_energy": "1.2", "omni_range": "5.0", "shadow_enabled": "true", "transform": "Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2.3, 0)"}),
    "key": ("Key", "Node3D", "level/thing.gd", {"use": '"pickup"', "item": '"key"', "item_name": '"Key"', "display_name": '"Key"'}),
    "flashlight": ("Flashlight", "Node3D", "level/thing.gd", {"use": '"pickup"', "item": '"flashlight"', "item_name": '"Flashlight"', "flashlight": "true", "display_name": '"Flashlight"'}),
    "note": ("Note", "Node3D", "level/thing.gd", {"use": '"note"', "note_title": '"A note"', "note_text": '"..."', "display_name": '"Note"'}),
    "inspect": ("Curio", "Node3D", "level/thing.gd", {"use": '"inspect"', "inspect_text": '"..."'}),
    "switch": ("LightSwitch", "Node3D", "level/thing.gd", {"use": '"switch"', "display_name": '"Light switch"', "transform": "Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.15, 0)"}),
    "breaker": ("Breaker", "Node3D", "level/thing.gd", {"use": '"breaker"', "display_name": '"Breaker"', "transform": "Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.2, 0)"}),
    "chair": ("Chair", "Node3D", "level/thing.gd", {"use": '"sit"', "display_name": '"Chair"'}),
    "bed": ("Bed", "Node3D", "level/thing.gd", {"use": '"sleep"', "display_name": '"Bed"'}),
    "wardrobe": ("Wardrobe", "Node3D", "level/thing.gd", {"use": '"hide"', "display_name": '"Wardrobe"'}),
    "box": ("Box", "Node3D", "level/thing.gd", {"use": '"carry"', "item": '"box"', "item_name": '"Box"'}),
    "die": ("Die", "Node3D", "level/thing.gd", {"use": '"roll"'}),
    "code_lock": ("CodeLock", "Node3D", "level/thing.gd", {"use": '"code"', "code": '"1234"', "display_name": '"Keypad"', "transform": "Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.3, 0)"}),
    "use_item": ("NeedsAnItem", "Node3D", "level/thing.gd", {"use": '"use_item"', "needs_item": '"key"'}),
    "stain": ("Stain", "Node3D", "level/thing.gd", {"use": '"clean"', "stain": '"blood"'}),
    "table_game": ("GameTable", "Node3D", "level/thing.gd", {"use": '"game"', "board_game": '"chohan"'}),
    "prop": ("Prop", "Node3D", "level/thing.gd", {"use": '"none"'}),
}
CURVE = '''[sub_resource type="Curve3D" id="curve"]
_data = {
"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, -2),
"tilts": PackedFloat32Array(0, 0, 0)
}
point_count = 3

'''
for key, (name, typ, script, props) in PRESETS.items():
    lines = []
    steps = 1 + (1 if script else 0) + (1 if key == "path" else 0)
    lines.append(f"[gd_scene load_steps={steps} format=3]\n")
    if script:
        lines.append(f'[ext_resource type="Script" path="{S}{script}" id="1"]\n')
    if key == "path":
        lines.append(CURVE)
    lines.append(f'[node name="{name}" type="{typ}"]')
    for k, v in props.items():
        if k == "transform":
            lines.append(f"{k} = {v}")
    if key == "path":
        lines.append('curve = SubResource("curve")')
    if script:
        lines.append('script = ExtResource("1")')
    for k, v in props.items():
        if k not in ("transform", "curve"):
            lines.append(f"{k} = {v}")
    (HERE / f"{key}.tscn").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"PRESETS {len(PRESETS)}")
