#!/usr/bin/env python3
"""GDPROPS: the made props in Godot 4.7, the way a game's export takes them (each .glb as it is, imported by Godot's
own glTF importer): every surface's material read back (base colour, the ORM texture, the normal map, see-through
where it should be), its size against the prop's meta.json, its triangles, and all of them pictured in a row under a
light (Saved/Props/_godot/godot_props.png; under xvfb and lavapipe in the cloud).

    python tools/propgen.py godot [names...]      (python tools/propgen/godot_check.py [names...])
        --night                                   and each by night: under the moon (the game's night), then in the
                                                  dark under the flashlight from the player's eye (godot_night.png)
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "Saved" / "Props"
PROJ = OUT / "_godot"

PROJECT = """config_version=5

[application]
config/name="propgen check"

[display]
window/size/viewport_width=1600
window/size/viewport_height=600

[rendering]
renderer/rendering_method="forward_plus"
anti_aliasing/quality/msaa_3d=2
"""

SCRIPT = r'''extends SceneTree

func _init():
	var out := ""
	var files := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--glb="):
			files.append(a.substr(6))
	var root := Node3D.new()
	get_root().add_child(root)
	var rep := {}
	var x := 0.0
	var tallest := 0.0
	for f in files:
		var ps = load(f)
		if ps == null:
			rep[f] = {"error": "load failed"}
			continue
		var inst: Node3D = ps.instantiate()
		root.add_child(inst)
		var info := {"surfaces": [], "tris": 0}
		var box := AABB()
		var first := true
		for mi in inst.find_children("*", "MeshInstance3D", true, false):
			var mesh: Mesh = mi.mesh
			for s in mesh.get_surface_count():
				var mat = mi.get_active_material(s)
				var d := {"class": mat.get_class() if mat else "none", "node": str(mi.name)}
				if mat is BaseMaterial3D:
					d["albedo"] = mat.albedo_texture != null
					d["normal"] = mat.normal_enabled and mat.normal_texture != null
					d["transparency"] = mat.transparency
					d["cull"] = mat.cull_mode
					if mat is ORMMaterial3D:
						d["orm"] = mat.orm_texture != null
					else:
						d["rough"] = mat.roughness_texture != null
						d["metal"] = mat.metallic_texture != null
						d["ao"] = mat.ao_enabled and mat.ao_texture != null
				info["surfaces"].append(d)
				var arr = mesh.surface_get_arrays(s)
				var idx = arr[Mesh.ARRAY_INDEX]
				info["tris"] += (idx.size() / 3) if idx != null and idx.size() > 0 else (arr[Mesh.ARRAY_VERTEX].size() / 3)
			var b: AABB = mi.global_transform * mi.get_aabb()
			box = b if first else box.merge(b)
			first = false
		info["size"] = [box.size.x, box.size.y, box.size.z]
		inst.position = Vector3(x - box.position.x, -box.position.y, -box.position.z - box.size.z / 2)
		x += box.size.x + 0.04
		tallest = maxf(tallest, box.size.y)
		rep[f] = info
	# the stage: a grey floor, a soft sun and a sky, a camera taking them all in
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.36, 0.36, 0.37)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.56, 0.6)
	e.ambient_light_energy = 0.7
	e.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.environment = e
	root.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -38, 0)
	sun.light_energy = 2.2
	sun.shadow_enabled = true
	root.add_child(sun)
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.42, 0.42, 0.42)
	fm.roughness = 0.8
	floor.material_override = fm
	root.add_child(floor)
	var cam := Camera3D.new()
	cam.fov = 30
	var mid := x / 2.0
	var dist: float = maxf(x * 0.95, tallest * 5.0) + 0.3
	cam.position = Vector3(mid, dist * 0.42, dist * 0.78)
	root.add_child(cam)
	cam.current = true
	await process_frame
	cam.look_at_from_position(Vector3(mid, dist * 0.42, dist * 0.78), Vector3(mid, tallest * 0.35, 0), Vector3.UP)
	for i in 12:
		await process_frame
	var img := get_root().get_viewport().get_texture().get_image()
	img.save_png(out + "/godot_props.png")
	var fh := FileAccess.open(out + "/godot_props.json", FileAccess.WRITE)
	fh.store_string(JSON.stringify(rep))
	fh.close()
	print("PROPS ", JSON.stringify({"n": files.size()}))
	quit()
'''


LIQUID_SCRIPT = r'''extends SceneTree

# the liquids: each prop upright and tipped over beside it, its liquid worn as the game wears it (HSLiquid.auto)
func _init():
	var out := ""
	var files := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--glb="):
			files.append(a.substr(6))
	var root := Node3D.new()
	get_root().add_child(root)
	var x := 0.0
	var tallest := 0.0
	for f in files:
		for tilt in [0.0, 70.0]:
			var inst: Node3D = load(f).instantiate()
			root.add_child(inst)
			inst.rotation_degrees = Vector3(0, 0, tilt)
			var box := AABB()
			var first := true
			for mi in inst.find_children("*", "MeshInstance3D", true, false):
				var b: AABB = mi.global_transform * mi.get_aabb()
				box = b if first else box.merge(b)
				first = false
			inst.position = Vector3(x - box.position.x, -box.position.y, 0)
			x += box.size.x + 0.03
			tallest = maxf(tallest, box.size.y)
	var n: int = load("res://addons/horrorstudio_look/liquid.gd").auto(root)
	await process_frame
	var rep := {"attached": n, "liquids": []}
	for mi in root.find_children("*_liquid", "MeshInstance3D", true, false):
		var m = mi.material_override
		rep["liquids"].append({"name": str(mi.name), "shader": m.shader.resource_path if m is ShaderMaterial and m.shader else ""})
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.36, 0.36, 0.37)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.56, 0.6)
	e.ambient_light_energy = 0.7
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.environment = e
	root.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, -30, 0)
	sun.light_energy = 2.0
	sun.shadow_enabled = true
	root.add_child(sun)
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(20, 20)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.42, 0.42, 0.42)
	floor.material_override = fm
	root.add_child(floor)
	var cam := Camera3D.new()
	cam.fov = 28
	root.add_child(cam)
	cam.current = true
	await process_frame
	var dist: float = maxf(x * 0.85, tallest * 4.0) + 0.1
	cam.look_at_from_position(Vector3(x / 2.0, tallest * 0.9 + dist * 0.18, dist), Vector3(x / 2.0, tallest * 0.4, 0), Vector3.UP)
	for i in 12:
		await process_frame
	get_root().get_viewport().get_texture().get_image().save_png(out + "/godot_liquids.png")
	print("LIQUIDS ", JSON.stringify(rep))
	quit()
'''


FX_SCRIPT = r'''extends SceneTree

# the enhancers: every prop that has some, in the dark, given its HSPropFX as the game gives it (HSPropFX.auto), steam
# switched on to see it; measured lit and pictured, then every switch off and measured again; each prop's own .tscn
# (its glb beside it, its HSPropFX and HSLiquidFill in it) loaded
func _init():
	var out := ""
	var files := []
	var scenes := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--glb="):
			files.append(a.substr(6))
		elif a.begins_with("--tscn="):
			scenes.append(a.substr(7))
	var root := Node3D.new()
	get_root().add_child(root)
	var x := 0.0
	var tallest := 0.0
	for f in files:
		var inst: Node3D = load(f).instantiate()
		inst.set_meta("prop", f.get_file().get_basename())   # Godot renames a glb's root apart from its mesh (candle_taper2)
		root.add_child(inst)
		var box := AABB()
		var first := true
		for mi in inst.find_children("*", "MeshInstance3D", true, false):
			var b: AABB = mi.global_transform * mi.get_aabb()
			box = b if first else box.merge(b)
			first = false
		inst.position = Vector3(x - box.position.x, -box.position.y, -box.position.z - box.size.z / 2)
		x += box.size.x + 0.05
		tallest = maxf(tallest, box.size.y)
	var n: int = load("res://addons/horrorstudio_look/nodes/prop_fx.gd").auto(root)
	for fx in root.find_children("HSPropFX", "", true, false):
		fx.steam = true
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.015, 0.015, 0.02)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.3, 0.32, 0.38)
	e.ambient_light_energy = 0.1
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	e.glow_enabled = true
	env.environment = e
	root.add_child(env)
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.3, 0.3, 0.3)
	fm.roughness = 0.7
	floor.material_override = fm
	root.add_child(floor)
	var cam := Camera3D.new()
	cam.fov = 30
	root.add_child(cam)
	cam.current = true
	await process_frame
	var dist: float = maxf(x * 0.8, tallest * 4.5) + 0.25
	cam.look_at_from_position(Vector3(x / 2.0, tallest * 0.9 + dist * 0.25, dist * 0.8), Vector3(x / 2.0, tallest * 0.4, 0), Vector3.UP)
	for i in 60:
		await process_frame
	var rep := {"attached": n, "lit": {}, "off": {}, "scenes": {}}
	for fx in root.find_children("HSPropFX", "", true, false):
		rep["lit"][str(fx.get_parent().get_meta("prop", fx.get_parent().name))] = fx.report()
	get_root().get_viewport().get_texture().get_image().save_png(out + "/godot_fx.png")
	for fx in root.find_children("HSPropFX", "", true, false):
		fx.glow = false
		fx.flame = false
		fx.smoke = false
		fx.steam = false
		fx.wax = false
	for i in 3:
		await process_frame
	for fx in root.find_children("HSPropFX", "", true, false):
		rep["off"][str(fx.get_parent().get_meta("prop", fx.get_parent().name))] = fx.report()
	for sc in scenes:
		var ps = load(sc)
		if ps == null:
			rep["scenes"][sc] = {"error": "load failed"}
			continue
		var inst: Node3D = ps.instantiate()
		root.add_child(inst)
		inst.position = Vector3(0, 0, 5)
		await process_frame
		await process_frame
		var fxn = inst.get_node_or_null("HSPropFX")
		rep["scenes"][sc] = {"fx": fxn != null, "fx_on": fxn.report() if fxn != null else {}, "meshes": inst.find_children("*", "MeshInstance3D", true, false).size(),
			"liquid": inst.find_children("HSLiquidFill", "", true, false).size()}
	print("FXCHECK " + JSON.stringify(rep))
	quit()
'''


NIGHT_SCRIPT = r"""extends SceneTree

# the props by night, in the game's night colours (game.gd's TIME_LOOK night: a navy sky, blue ambient, a blue moon,
# a thin blue haze, the eyes' colour down a fifth; the moon and the ambient four times the game's, a bright clear
# night, so the thing can be judged): each alone under the moon, seen whole from a little above, and then in the dark
# (the moon as the game has it, an overcast night) under the player's flashlight (play.gd's torch: a hot cone of 26
# degrees and its spill of 62, 5200 K, range 18 m) from the player's eye seven metres off, the game's 90 degree lens
func _init():
	var out := ""
	var files := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--glb="):
			files.append(a.substr(6))
	get_root().size = Vector2i(900, 600)
	var root := Node3D.new()
	get_root().add_child(root)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.027, 0.039, 0.086)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.478, 0.525, 0.667)
	e.ambient_light_energy = 0.22
	e.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	e.fog_enabled = true
	e.fog_light_color = Color(0.04, 0.07, 0.16)
	e.fog_light_energy = 1.0
	e.fog_density = 0.012
	e.adjustment_enabled = true
	e.adjustment_saturation = 0.8
	env.environment = e
	root.add_child(env)
	var moon := DirectionalLight3D.new()
	moon.rotation_degrees = Vector3(-35, -140, 0)
	moon.light_energy = 0.12
	moon.light_color = Color(0.55, 0.7, 1.0)
	moon.shadow_enabled = true
	root.add_child(moon)
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(80, 80)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.17, 0.17, 0.18)
	fm.roughness = 0.9
	floor.material_override = fm
	root.add_child(floor)
	var hot := SpotLight3D.new()
	var spill := SpotLight3D.new()
	for l in [hot, spill]:
		l.light_color = Color(1.0, 0.91, 0.83)
		l.spot_range = 18.0
		l.light_energy = 0.0
		root.add_child(l)
	hot.spot_angle = 13.0
	hot.shadow_enabled = true
	spill.spot_angle = 31.0
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.current = true
	var rep := {}
	for f in files:
		var ps = load(f)
		if ps == null:
			rep[f] = {"error": "load failed"}
			continue
		var inst: Node3D = ps.instantiate()
		root.add_child(inst)
		var box := AABB()
		var first := true
		for mi in inst.find_children("*", "MeshInstance3D", true, false):
			var b: AABB = mi.global_transform * mi.get_aabb()
			box = b if first else box.merge(b)
			first = false
		var name: String = f.get_file().get_basename()
		var h: float = box.size.y
		var ctr := box.get_center()
		# the moon: the whole tree from a little above, 32 degrees round from its front
		var az := deg_to_rad(-32.0)
		cam.fov = 30.0
		var dist: float = maxf(h, maxf(box.size.x, box.size.z) * 0.9) / (2.0 * tan(deg_to_rad(15.0))) * 1.15 + 0.5
		var from := ctr + Vector3(sin(az) * cos(deg_to_rad(7.0)), sin(deg_to_rad(7.0)), cos(az) * cos(deg_to_rad(7.0))) * dist
		hot.light_energy = 0.0
		spill.light_energy = 0.0
		moon.light_energy = 0.5
		e.ambient_light_energy = 0.9
		e.fog_density = 0.02
		await process_frame
		cam.look_at_from_position(from, ctr, Vector3.UP)
		for i in 10:
			await process_frame
		get_root().get_viewport().get_texture().get_image().save_png(out + "/night_" + name + "_moon.png")
		# the flashlight: the player seven metres from the trunk, looking up it, an overcast night round them
		cam.fov = 90.0
		var eye := Vector3(sin(az) * 7.0, 1.6, cos(az) * 7.0)
		var aim := Vector3(0.0, minf(3.2, h * 0.45), 0.0)
		moon.light_energy = 0.03
		e.ambient_light_energy = 0.22
		e.fog_density = 0.012
		hot.light_energy = 7.5
		spill.light_energy = 1.65
		cam.look_at_from_position(eye, aim, Vector3.UP)
		for l in [hot, spill]:
			l.global_position = eye
			l.look_at(aim, Vector3.UP)
		for i in 10:
			await process_frame
		get_root().get_viewport().get_texture().get_image().save_png(out + "/night_" + name + "_torch.png")
		rep[f] = {"size": [box.size.x, box.size.y, box.size.z]}
		root.remove_child(inst)
		inst.queue_free()
	print("NIGHT ", JSON.stringify(rep))
	quit()
"""


def night_sheet(names, out):
    """The night pictures as one sheet: each prop under the moon and under the flashlight, side by side, its name under."""
    from PIL import Image, ImageDraw
    tiles = []
    for n in names:
        row = []
        for kind in ("moon", "torch"):
            p = out / f"night_{n}_{kind}.png"
            if p.exists():
                im = Image.open(p).convert("RGB")
                w, h = im.size
                cw_ = min(w, h * 3 // 2)                      # the frame's middle, 3:2 (the window is wider than the thing)
                im = im.crop(((w - cw_) // 2, 0, (w - cw_) // 2 + cw_, h)).resize((450, 300))
            else:
                im = Image.new("RGB", (450, 300), (40, 40, 44))
            row.append(im)
        tiles.append((n, row))
    cols = 2
    cw, ch = 900, 300 + 22
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw + (cols + 1) * 8, rows * ch + (rows + 1) * 8 + 30), (18, 19, 22))
    d = ImageDraw.Draw(sheet)
    d.text((10, 8), "the props by night: under the moon (left), under the flashlight (right)", fill=(230, 226, 216))
    for i, (n, row) in enumerate(tiles):
        r, c = divmod(i, cols)
        x0, y0 = 8 + c * (cw + 8), 38 + r * (ch + 8)
        sheet.paste(row[0], (x0, y0))
        sheet.paste(row[1], (x0 + 450, y0))
        d.text((x0 + 4, y0 + 304), n, fill=(200, 198, 190))
    path = out / "godot_night.png"
    sheet.save(path)
    return path


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def main(argv):
    g = godot_bin()
    if not g:
        print("GDPROPS FAIL: no godot (tools/godot_setup.sh in the cloud; GODOT=path on your machine)")
        return 1
    night = "--night" in argv
    names = [a for a in argv if not a.startswith("-")] or sorted(p.name for p in OUT.iterdir() if (p / f"{p.name}.glb").exists())
    if not names:
        print("GDPROPS FAIL: no props made yet (python tools/propgen.py make <name>)")
        return 1
    if PROJ.exists():
        shutil.rmtree(PROJ)
    (PROJ / "props").mkdir(parents=True)
    (PROJ / "project.godot").write_text(PROJECT, encoding="utf-8")
    (PROJ / "check.gd").write_text(SCRIPT, encoding="utf-8")
    (PROJ / "liquids.gd").write_text(LIQUID_SCRIPT, encoding="utf-8")
    (PROJ / "fx.gd").write_text(FX_SCRIPT, encoding="utf-8")
    (PROJ / "night.gd").write_text(NIGHT_SCRIPT, encoding="utf-8")
    shutil.copytree(ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look", PROJ / "addons" / "horrorstudio_look",
                    ignore=shutil.ignore_patterns("*.import", "demo"))
    metas = {}
    for n in names:
        shutil.copy(OUT / n / f"{n}.glb", PROJ / "props" / f"{n}.glb")
        if (OUT / n / f"{n}.tscn").exists():
            shutil.copy(OUT / n / f"{n}.tscn", PROJ / "props" / f"{n}.tscn")
        mp = OUT / n / "meta.json"
        metas[n] = json.loads(mp.read_text(encoding="utf-8")) if mp.exists() else {}
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    subprocess.run([g, "--headless", "--path", str(PROJ), "--import"], capture_output=True, text=True, timeout=900, env=env)
    cmd = [g, "--path", str(PROJ), "--rendering-driver", "vulkan", "-s", "res://check.gd", "--", f"--out={PROJ}"] + \
          [f"--glb=res://props/{n}.glb" for n in names]
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1600x600x24"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l)
    if "PROPS {" not in text or "SCRIPT ERROR" in text:
        print(text[-3000:])
        print("GDPROPS FAIL: the check scene didn't run clean")
        return 1
    rep = json.loads((PROJ / "godot_props.json").read_text(encoding="utf-8"))
    ok = True
    for n in names:
        info = rep.get(f"res://props/{n}.glb") or {}
        if info.get("error") or not info.get("surfaces"):
            print(f"  BAD {n}: {info.get('error', 'no mesh')}")
            ok = False
            continue
        problems = []
        for i, s in enumerate(info["surfaces"]):
            if s.get("node", "").endswith("_liquid"):
                continue                                    # the liquid wears HSLiquid's shader in a game; its own material is plain
            if not s.get("albedo"):
                problems.append(f"surface {i} has no base colour texture")
            if not s.get("normal"):
                problems.append(f"surface {i} has no normal map")
            if not (s.get("orm") or (s.get("rough") and s.get("metal"))):
                problems.append(f"surface {i} has no roughness/metal texture")
        want = metas[n].get("size_m")
        if want:
            gx, gy, gz = info["size"]
            have = [gx, gz, gy]                                       # Godot's x, y up, z: the meta's Blender x, y, z up
            # 2%, or a millimetre and a half on a thing that thin (a sheet of paper laid flat: Godot reports to the mm)
            if any(abs(a - b) > max(0.02 * b, 0.0015) for a, b in zip(have, want)):
                problems.append(f"size {[round(v, 3) for v in have]} against {want}")
        clear = [s for s in info["surfaces"] if s.get("transparency", 0)]
        ok = ok and not problems
        kinds = ", ".join(sorted({s["class"].replace("Material3D", "") for s in info["surfaces"]}))
        print(("  ok  " if not problems else "  BAD ") + f"{n}: {len(info['surfaces'])} surface(s) ({kinds}{'; ' + str(len(clear)) + ' see-through' if clear else ''}), "
              f"{info['tris']} triangles, {' x '.join(f'{v * 1000:.0f}' for v in info['size'])} mm" + ("; " + "; ".join(problems) if problems else ""))
    wet = [n for n in names if metas[n].get("liquid")]
    if wet:
        cmd = [g, "--path", str(PROJ), "--rendering-driver", "vulkan", "-s", "res://liquids.gd", "--", f"--out={PROJ}"] + \
              [f"--glb=res://props/{n}.glb" for n in wet]
        if shutil.which("xvfb-run"):
            cmd = ["xvfb-run", "-a", "-s", "-screen 0 1600x600x24"] + cmd
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
        text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l)
        line = next((l for l in text.splitlines() if l.startswith("LIQUIDS ")), None)
        if line is None or "SCRIPT ERROR" in text or "SHADER ERROR" in text:
            print(text[-3000:])
            print("  BAD the liquids' scene didn't run clean")
            ok = False
        else:
            rep = json.loads(line[8:])
            good = [l for l in rep["liquids"] if l["shader"].endswith(("liquid.gdshader", "liquid_clear.gdshader"))]
            fine = len(good) == 2 * len(wet) and rep["attached"] == 2 * len(wet)
            ok = ok and fine
            print(("  ok  " if fine else "  BAD ") + f"liquids: {len(wet)} prop(s) upright and tipped 70 degrees, HSLiquid on {rep['attached']} "
                  f"({', '.join(sorted({l['shader'].rsplit('/', 1)[-1] for l in good}))}): {PROJ / 'godot_liquids.png'}")
    lit_ = [n for n in names if metas[n].get("fx")]
    if lit_:
        cmd = [g, "--path", str(PROJ), "--rendering-driver", "vulkan", "-s", "res://fx.gd", "--", f"--out={PROJ}"] + \
              [f"--glb=res://props/{n}.glb" for n in lit_] + [f"--tscn=res://props/{n}.tscn" for n in lit_ if (PROJ / "props" / f"{n}.tscn").exists()]
        if shutil.which("xvfb-run"):
            cmd = ["xvfb-run", "-a", "-s", "-screen 0 1600x600x24"] + cmd
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
        text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l)
        line = next((l for l in text.splitlines() if l.startswith("FXCHECK ")), None)
        if line is None or "SCRIPT ERROR" in text or "SHADER ERROR" in text:
            print(text[-3000:])
            print("  BAD the enhancers' scene didn't run clean")
            ok = False
        else:
            rep = json.loads(line[8:])
            for n in lit_:
                fx = metas[n]["fx"]
                on = rep["lit"].get(n) or {}
                off = rep["off"].get(n) or {}
                problems = []
                want_flames = len(fx["flame"]["sockets"]) if fx.get("flame") and fx["flame"].get("on", True) else 0
                g_ = fx.get("glow") or {}
                follows = g_.get("follows", "")
                glow_on = bool(g_) and (not follows or (fx.get(follows) or {}).get("on", True))
                want_puffs = sum(len((fx.get(k) or {}).get("sockets", [])) for k in ("smoke", "steam"))
                if glow_on and on.get("glowing", 0) < 1:
                    problems.append("nothing glows")
                if on.get("flames", 0) != want_flames or on.get("lights", 0) != want_flames:
                    problems.append(f"{on.get('flames')} flames and {on.get('lights')} lights, not {want_flames}")
                if on.get("puff_sources", 0) != want_puffs or (want_puffs and on.get("puffs", 0) < 1):
                    problems.append(f"{on.get('puff_sources')} smoke and steam sources ({on.get('puffs')} puffs), not {want_puffs}")
                if fx.get("wax") and on.get("waxed", 0) < 1:
                    problems.append("its wax doesn't let the light in")
                if any(off.get(k, 0) for k in ("glowing", "flames", "lights", "puff_sources", "waxed")):
                    problems.append(f"switched off it still has {off}")
                sc = rep["scenes"].get(f"res://props/{n}.tscn")
                if sc is None or not sc.get("fx") or sc.get("meshes", 0) < 1:
                    problems.append(f"its .tscn: {sc}")
                elif metas[n].get("liquid") and sc.get("liquid", 0) < 1:
                    problems.append("its .tscn has no HSLiquidFill")
                ok = ok and not problems
                print(("  ok  " if not problems else "  BAD ") + f"{n}'s enhancers: {on.get('glowing', 0)} glowing, {on.get('flames', 0)} flames with their lights, "
                      f"{on.get('puff_sources', 0)} smoke and steam ({on.get('puffs', 0)} puffs), {on.get('waxed', 0)} waxed; all off when switched off; "
                      f"its .tscn ready" + ("; " + "; ".join(problems) if problems else ""))
            print(f"  the enhancers lit in the dark: {PROJ / 'godot_fx.png'}")
    if night:
        # by night: under the moon, then under the flashlight (--night)
        cmd = [g, "--path", str(PROJ), "--rendering-driver", "vulkan", "-s", "res://night.gd", "--", f"--out={PROJ}"] + \
              [f"--glb=res://props/{n}.glb" for n in names]
        if shutil.which("xvfb-run"):
            cmd = ["xvfb-run", "-a", "-s", "-screen 0 1600x600x24"] + cmd
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600, env=env)
        text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l)
        if "NIGHT {" not in text or "SCRIPT ERROR" in text:
            print(text[-3000:])
            print("  BAD the night scene didn't run clean")
            ok = False
        else:
            missing = [n for n in names if not (PROJ / f"night_{n}_torch.png").exists()]
            if missing:
                print("  BAD no night picture of " + ", ".join(missing))
                ok = False
            print(f"  by night, under the moon and the flashlight: {night_sheet(names, PROJ)}")
    pic = PROJ / "godot_props.png"
    print(f"  the picture: {pic}")
    print("GDPROPS ok" if ok else "GDPROPS FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
