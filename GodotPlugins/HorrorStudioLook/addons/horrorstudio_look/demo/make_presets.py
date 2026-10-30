"""The look plugin's presets (presets/*.tscn), written as text: each a node of nodes/ with its numbers. Run it after
changing one here (python make_presets.py); the presets are the files, this is how they were made."""
import pathlib
D = pathlib.Path(__file__).resolve().parent.parent / "presets"
D.mkdir(exist_ok=True)
N = "res://addons/horrorstudio_look/nodes/"
def scene(fname, nodes, subs=()):
    # nodes: [(name, type, parent, script or None, {prop: text})]
    scripts = []
    for n in nodes:
        if n[3] and n[3] not in scripts:
            scripts.append(n[3])
    out = [f'[gd_scene load_steps={1 + len(scripts) + len(subs)} format=3]', '']
    for i, s in enumerate(scripts):
        out.append(f'[ext_resource type="Script" path="{s}" id="{i + 1}"]')
    if scripts: out.append('')
    for sid, stype, props in subs:
        out.append(f'[sub_resource type="{stype}" id="{sid}"]')
        out += [f'{k} = {v}' for k, v in props.items()]
        out.append('')
    for name, typ, parent, scr, props in nodes:
        head = f'[node name="{name}" type="{typ}"' + (f' parent="{parent}"' if parent is not None else '') + ']'
        out.append(head)
        if scr: out.append(f'script = ExtResource("{scripts.index(scr) + 1}")')
        out += [f'{k} = {v}' for k, v in props.items()]
        out.append('')
    (D / fname).write_text("\n".join(out))

def one(fname, name, typ, script, props=None):
    scene(fname, [(name, typ, None, N + script, props or {})])

one("rain.tscn", "Rain", "Node3D", "rain_box.gd", {"size": "Vector3(8, 4, 8)", "strength": "0.45"})
one("downpour.tscn", "Downpour", "Node3D", "rain_box.gd", {"size": "Vector3(10, 5, 10)", "count": "1600", "strength": "0.9", "wind": "0.5"})
one("wet_floor.tscn", "WetFloor", "Node3D", "wet_surface.gd")
one("wet_floor_raining.tscn", "WetFloorRaining", "Node3D", "wet_surface.gd", {"wetness": "0.95", "puddles": "0.8", "ripples": "0.7"})
one("damp_floor.tscn", "DampFloor", "Node3D", "wet_surface.gd", {"wetness": "0.45", "puddles": "0.15"})
one("puddle.tscn", "Puddle", "Node3D", "puddle.gd")
one("blood_pool.tscn", "BloodPool", "Node3D", "blood_splat.gd", {"size": "0.8"})
one("blood_dried.tscn", "BloodDried", "Node3D", "blood_splat.gd", {"size": "0.7", "dry": "0.85", "seed": "3.0"})
one("blood_wall.tscn", "BloodWall", "Node3D", "blood_splat.gd", {"rotation": "Vector3(1.5708, 0, 0)", "size": "0.6", "drips": "0.6", "pool": "0.4"})
one("wall_leak.tscn", "WallLeak", "Node3D", "wall_leak.gd")
one("window_shaft.tscn", "WindowShaft", "Node3D", "light_shaft.gd")
scene("window_sun.tscn", [
    ("WindowSun", "Node3D", None, N + "light_shaft.gd", {}),
    ("Sun", "SpotLight3D", ".", None, {"light_color": "Color(1, 0.9, 0.74, 1)", "light_energy": "6.0", "shadow_enabled": "true", "light_size": "0.15", "spot_range": "9.0", "spot_angle": "20.0", "spot_angle_attenuation": "0.4"}),
])
one("headlight_sweep.tscn", "HeadlightSweep", "Node3D", "headlight_sweep.gd")
spot = {"shadow_enabled": "true", "spot_range": "8.0", "spot_angle": "38.0"}
one("caustics_light.tscn", "CausticsLight", "SpotLight3D", "pattern_light.gd", {**spot, "light_color": "Color(0.62, 0.86, 1, 1)", "light_energy": "3.0", "pattern": '"caustics"'})
one("blinds_light.tscn", "BlindsLight", "SpotLight3D", "pattern_light.gd", {**spot, "light_color": "Color(1, 0.88, 0.7, 1)", "light_energy": "5.0", "pattern": '"blinds"', "open": "0.45"})
one("leaves_light.tscn", "LeavesLight", "SpotLight3D", "pattern_light.gd", {**spot, "light_color": "Color(1, 0.95, 0.8, 1)", "light_energy": "4.0", "pattern": '"leaves"'})
one("clouds_light.tscn", "CloudsLight", "SpotLight3D", "pattern_light.gd", {**spot, "spot_range": "30.0", "spot_angle": "50.0", "light_color": "Color(1, 0.96, 0.88, 1)", "light_energy": "3.0", "pattern": '"clouds"', "aim_distance": "12.0"})
omni = {"shadow_enabled": "true"}
one("fluorescent_tube.tscn", "FluorescentTube", "OmniLight3D", "flicker_omni.gd", {**omni, "light_color": "Color(0.9, 0.97, 1, 1)", "light_energy": "1.6", "omni_range": "6.0", "mode": '"fluorescent"'})
one("dying_bulb.tscn", "DyingBulb", "OmniLight3D", "flicker_omni.gd", {**omni, "light_color": "Color(1, 0.8, 0.55, 1)", "light_energy": "1.2", "omni_range": "4.5", "mode": '"dying"'})
one("candle.tscn", "Candle", "OmniLight3D", "flicker_omni.gd", {**omni, "light_color": "Color(1, 0.62, 0.3, 1)", "light_energy": "0.8", "omni_range": "3.5", "light_size": "0.02", "mode": '"candle"', "on_mains": "false"})
one("alarm_pulse.tscn", "AlarmPulse", "OmniLight3D", "flicker_omni.gd", {"light_color": "Color(1, 0.12, 0.08, 1)", "light_energy": "2.0", "omni_range": "6.0", "mode": '"pulse"', "rate": "0.8"})
one("faulty_neon.tscn", "FaultyNeon", "OmniLight3D", "flicker_omni.gd", {"light_color": "Color(1, 0.3, 0.6, 1)", "light_energy": "1.4", "omni_range": "4.0", "mode": '"custom"', "letters": '"mmmmamammmmmmmmammaaammmmmmmmammmm"', "rate": "12.0"})
one("desk_lamp_dying.tscn", "DeskLampDying", "SpotLight3D", "flicker_spot.gd", {"shadow_enabled": "true", "light_color": "Color(1, 0.82, 0.6, 1)", "light_energy": "3.0", "spot_range": "3.0", "spot_angle": "40.0", "rotation": "Vector3(-1.5708, 0, 0)", "mode": '"dying"'})
mat = ("glass", "StandardMaterial3D", {"albedo_color": "Color(0.8, 0.84, 0.88, 1)", "metallic": "1.0", "roughness": "0.05"})
scene("mirror.tscn", [
    ("WallMirror", "MeshInstance3D", None, None, {"mesh": 'SubResource("quad")'}),
    ("Reflection", "Node", ".", N + "mirror_surface.gd", {}),
], subs=[mat, ("quad", "QuadMesh", {"size": "Vector2(0.6, 0.9)", "material": 'SubResource("glass")'})])
scene("window_pane.tscn", [
    ("WindowPane", "MeshInstance3D", None, None, {"mesh": 'SubResource("quad")'}),
    ("Glass", "Node3D", ".", N + "window_pane.gd", {"rain": "0.6"}),
], subs=[("quad", "QuadMesh", {"size": "Vector2(1.2, 1.1)"})])
one("grade_cinema.tscn", "GradeCinema", "Node", "grade.gd")
one("grade_cold.tscn", "GradeCold", "Node", "grade.gd", {"preset": '"cold"', "lift": "Vector3(0, 0.012, 0.035)", "gamma": "Vector3(0.98, 1, 1.04)", "gain": "Vector3(1, 1, 1)",
    "warmth": "-0.45", "saturation": "0.8", "contrast": "1.06", "vignette": "0.35", "grain": "0.2", "aberration": "0.0"})
one("grade_noir.tscn", "GradeNoir", "Node", "grade.gd", {"preset": '"noir"', "lift": "Vector3(0.01, 0.01, 0.015)", "gain": "Vector3(1, 1, 1)", "saturation": "0.12",
    "contrast": "1.3", "fade": "0.04", "vignette": "0.45", "grain": "0.35", "aberration": "0.0"})
one("tape_camhybrid.tscn", "TapeCamhybrid", "Node", "tape.gd")
one("tape_worn.tscn", "TapeWorn", "Node", "tape.gd", {"preset": '"worn"'})
one("character_look.tscn", "CharacterLook", "Node", "character_look.gd")
one("character_sweating.tscn", "CharacterSweating", "Node", "character_look.gd", {"sweat": "0.7", "drips": "0.3"})
scene("look_environment.tscn", [("LookEnvironment", "WorldEnvironment", None, "res://addons/horrorstudio_look/look_env.gd", {})])
print(len(list(D.glob("*.tscn"))))
