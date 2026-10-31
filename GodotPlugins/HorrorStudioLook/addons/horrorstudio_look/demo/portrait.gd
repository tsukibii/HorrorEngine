## A Character Studio export as a portrait (docs/GODOT_LOOK.md §5d; tools/godot/portrait_check.py runs it): the glb
## worn as the game wears it (HSSkin, HSEye, HSHair), lit like a character reel (a big soft key from the side and
## above, a weak fill, a cool rim, a muted ground) and pictured at four distances: a medium close-up at three-quarter,
## a close-up, an extreme close-up of the cheek and the nose's side (about 9 cm across: the pores; the hair hidden for
## it), and the game's own
## medium shot (the player's 90° lens at 1.2 m under a warm lamp); `--shots=hair,hairecu` the hair from behind and to
## one side, and its strands close over the ear; `--shots=front,eyes` the head from the front and both eyes close under
## a portrait grid's soft frontal light (the eyes, brows and lashes against their reference). `--detail=off` pictures the same with the skin's detail layer off
## (HSSkin's `detail` 0), for the before and after. `--blink=W` holds both eyes that far shut (the export's blink, blink.gd;
## the idle blink is always off here) and `--eyes=mask` draws the eyeballs a flat green, each shot counting the green
## pixels (`eye_px`): a shut eye shows none (tools/godot/eyelids_check.py, EYELIDS).
## `--hide=lash,hair` leaves out the meshes whose names hold those words.
##   godot --path PROJECT -s res://addons/horrorstudio_look/demo/portrait.gd -- --glb=res://people/NAME.glb --out=DIR [--detail=off] [--tag=NAME] [--preset=NAME] [--shots=ecu,cu] [--hair=JSON] [--eye=JSON] [--ssr=off] [--blink=W] [--eyes=mask] [--hide=WORDS]
extends SceneTree

var glb := "res://people/_studiotest.glb"
var out_dir := "res://"
var tag := "portrait"
var detail_on := true
var preset := ""
var hair_json := ""
var eye_json := ""
var ssr_off := false
var blink := 0.0                  # how far shut both eyes are held
var eye_mask := false             # the eyeballs a flat green (counted in each shot)
var hide: Array = []              # meshes left out by name (what a look is made of)
var n := 0
var stage := 0
var env: Environment
var world: Node3D
var cam: Camera3D
var who: Node3D
var mats: Array = []
var rig: Array = []
var report := {"shots": {}}
var STAGES := ["mcu", "cu", "ecu", "pov"]
var lit := "reel"                 # the light the shots are under now
var top := 1.7
var face := Vector3.ZERO          # the face's front, about the nose's bridge
var eye_l := Vector3.ZERO


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--glb="):
			glb = a.substr(6)
		elif a.begins_with("--tag="):
			tag = a.substr(6)
		elif a == "--detail=off":
			detail_on = false
		elif a.begins_with("--preset="):
			preset = a.substr(9)
		elif a.begins_with("--hair="):
			hair_json = a.substr(7)
		elif a.begins_with("--eye="):
			eye_json = a.substr(6)
		elif a == "--ssr=off":
			ssr_off = true
		elif a.begins_with("--blink="):
			blink = clampf(float(a.substr(8)), 0.0, 1.0)
		elif a == "--eyes=mask":
			eye_mask = true
		elif a.begins_with("--hide="):
			hide = Array(a.substr(7).split(","))
		elif a.begins_with("--shots="):
			STAGES = Array(a.substr(8).split(","))
	root.size = Vector2i(1280, 720)
	world = Node3D.new()
	root.add_child(world)
	env = Environment.new()
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var ps = load(glb) if ResourceLoader.exists(glb) else null
	if ps != null:
		who = ps.instantiate()
	else:
		var doc := GLTFDocument.new()
		var st := GLTFState.new()
		if doc.append_from_file(glb, st) == OK:
			who = doc.generate_scene(st)
	if who == null:
		print("PORTRAIT FAIL: no glb at " + glb)
		quit(1)
		return
	world.add_child(who)
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		for h in hide:
			if String(mi.name).to_lower().contains(String(h).to_lower()):
				mi.visible = false
				mi.set_meta("hidden", true)
	var settings := {}
	if preset != "":                                 # a preset's name, or its numbers as JSON over "natural"
		settings["detail_preset"] = JSON.parse_string(preset) if preset.begins_with("{") else preset
	mats = HSSkin.wear(who, settings, glb)
	if not detail_on:
		for m in mats:
			m.set_shader_parameter("detail", 0.0)
	var eye_over = JSON.parse_string(eye_json) if eye_json != "" else {}   # the eye shader's numbers tried over the record's (tuning)
	report["eye_mats"] = HSEye.wear(who, glb, eye_over if eye_over is Dictionary else {}).size()
	var bl = who.get_node_or_null("HSBlink")         # the blink held, never idle in a picture (an older plugin has none)
	report["blink_meshes"] = bl.shapes.size() if bl != null else 0
	report["blink"] = blink
	if bl != null:
		bl.idle = false
		bl.hold = Vector2(blink, blink)
	if eye_mask:                                     # the eyeballs flat green: what shows of them, counted
		var green := StandardMaterial3D.new()
		green.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		green.albedo_color = Color(0.0, 1.0, 0.0)
		for mi in who.find_children("*", "MeshInstance3D", true, false):
			if String(mi.name).contains("_eye_") and mi.mesh != null:
				for k in mi.mesh.get_surface_count():
					mi.set_surface_override_material(k, green)
	var hs: Script = load("res://addons/horrorstudio_look/hair.gd")       # an older plugin's wear takes no glb (--plugin pictures one)
	var hair_mats: Array = hs.callv("wear", [who, {}, glb] if hs.has_method("records") else [who, {}])
	report["hair_mats"] = hair_mats.size()           # the hair: how much of it wears the salon's bake MetaHuman's way, and the scalp in its own colour
	report["hair_baked"] = 0
	for hm in hair_mats:
		if hm is ShaderMaterial and hm.get_shader_parameter("shell_normals") == true and hm.get_shader_parameter("use_strands") == true:
			report["hair_baked"] += 1
	report["scalps"] = 0
	report["scalps_coloured"] = 0
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		if String(mi.name).to_lower().contains("scalp") and mi.mesh != null:
			report["scalps"] += 1
			var sm = mi.get_active_material(0)
			if sm is StandardMaterial3D and sm.vertex_color_use_as_albedo:
				report["scalps_coloured"] += 1
	if hair_json != "":                              # the hair shader's numbers tried over the bake's (tuning)
		var o = JSON.parse_string(hair_json)
		if o is Dictionary:
			for hm in hair_mats:
				for k in o:
					hm.set_shader_parameter(k, o[k])
	report["skin_mats"] = mats.size()
	report["detail"] = detail_on
	if mats.size():
		report["detail_amount"] = mats[0].get_shader_parameter("detail")
		report["detail_scale"] = mats[0].get_shader_parameter("detail_metres")
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		if mi.name.to_lower().ends_with("skin") and mi.mesh != null:
			top = (mi.global_transform * mi.get_aabb()).end.y
		if mi.name.ends_with("_eye_L") and mi.mesh != null:
			eye_l = (mi.global_transform * mi.get_aabb()).get_center()
	face = Vector3(0.0, top - 0.115, 0.095) if eye_l == Vector3.ZERO else Vector3(0.0, eye_l.y - 0.02, eye_l.z + 0.02)
	report["top"] = top
	cam = Camera3D.new()
	world.add_child(cam)
	reel()


## the reel's light: a big soft key from the side and above (warm white), a weak fill from the other side, a cool rim
## from behind, a dim sky for the ambient and the reflections, a muted teal-grey ground; the realism look (AgX, SSAO)
func reel() -> void:
	for l in rig:
		l.queue_free()
	rig.clear()
	HSLook.apply(root, env, "realism")
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.16, 0.2, 0.21)
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.32, 0.36, 0.4)
	sm.sky_horizon_color = Color(0.25, 0.26, 0.27)
	sm.ground_horizon_color = Color(0.18, 0.17, 0.16)
	sm.ground_bottom_color = Color(0.08, 0.08, 0.08)
	sm.sun_angle_max = 0.0
	sky.sky_material = sm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.ambient_light_energy = 0.55
	env.fog_enabled = false
	env.volumetric_fog_enabled = false
	var key := OmniLight3D.new()
	key.position = face + Vector3(0.75, 0.45, 0.85)
	key.light_energy = 2.2
	key.omni_range = 8.0
	key.omni_attenuation = 1.0
	key.light_size = 0.35
	key.light_color = Color(1.0, 0.94, 0.86)
	key.shadow_enabled = true
	key.shadow_blur = 1.5
	var fill := OmniLight3D.new()
	fill.position = face + Vector3(-1.0, 0.1, 0.9)
	fill.light_energy = 0.35
	fill.omni_range = 8.0
	fill.light_color = Color(0.85, 0.9, 1.0)
	var rim := OmniLight3D.new()
	rim.position = face + Vector3(-0.8, 0.35, -0.9)
	rim.light_energy = 1.6
	rim.omni_range = 6.0
	rim.light_color = Color(0.7, 0.8, 1.0)
	for l in [key, fill, rim]:
		world.add_child(l)
		rig.append(l)


## a portrait grid's light for the front shots (the reference faces the eyes are held to: docs/research/eyes.md §5): a
## soft key above the camera and a little to one side, a weak fill, a mid-grey ground, the realism look
func front_light() -> void:
	for l in rig:
		l.queue_free()
	rig.clear()
	HSLook.apply(root, env, "realism")
	env.ssr_enabled = env.ssr_enabled and not ssr_off
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.1, 0.1, 0.1)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.42, 0.42, 0.44)
	env.ambient_light_energy = 0.5
	env.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	env.fog_enabled = false
	env.volumetric_fog_enabled = false
	var key := OmniLight3D.new()
	key.position = face + Vector3(0.3, 0.55, 1.1)
	key.light_energy = 2.0
	key.omni_range = 8.0
	key.light_size = 0.25
	key.light_color = Color(1.0, 0.97, 0.93)
	key.shadow_enabled = true
	key.shadow_blur = 1.5
	var fill := OmniLight3D.new()
	fill.position = face + Vector3(-0.8, 0.05, 1.0)
	fill.light_energy = 0.45
	fill.omni_range = 8.0
	fill.light_color = Color(0.92, 0.95, 1.0)
	for l in [key, fill]:
		world.add_child(l)
		rig.append(l)


## the game's own light for the POV shot: a warm ceiling lamp and the room's dim fill, the balanced look
func room() -> void:
	for l in rig:
		l.queue_free()
	rig.clear()
	HSLook.apply(root, env, "balanced")
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.05, 0.045, 0.04)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.45, 0.4)
	env.ambient_light_energy = 0.3
	env.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	env.fog_enabled = false
	env.volumetric_fog_enabled = false
	var lamp := OmniLight3D.new()
	lamp.position = face + Vector3(0.4, 0.9, 0.7)
	lamp.light_energy = 1.6
	lamp.omni_range = 6.0
	lamp.light_color = Color(1.0, 0.82, 0.6)
	lamp.shadow_enabled = true
	world.add_child(lamp)
	rig.append(lamp)


func shoot(name: String) -> void:
	var want := "front" if name in ["front", "eyes"] else ("room" if name == "pov" else "reel")   # each shot under its own light
	if want != lit:
		lit = want
		call(want if want != "front" else "front_light")
	for mi in who.find_children("*", "MeshInstance3D", true, false):     # the cheek's close-up is the skin's pores: the hair (and its scalp) out of it
		var nm := String(mi.name).to_lower()
		if HSHair.is_hair(nm) or nm.contains("scalp"):
			mi.visible = name != "ecu" and not mi.has_meta("hidden")
	match name:
		"mcu":
			cam.fov = 26.0
			cam.position = face + Vector3(0.42, 0.0, 0.62)
			cam.look_at(face + Vector3(0, -0.05, 0))
		"cu":
			cam.fov = 18.0
			cam.position = face + Vector3(0.3, 0.02, 0.5)
			cam.look_at(face + Vector3(0.005, -0.02, -0.02))
		"ecu":
			cam.fov = 9.0
			var cheek := face + Vector3(0.035, -0.035, -0.015)
			cam.position = cheek + Vector3(0.22, 0.02, 0.5)
			cam.look_at(cheek)
		"hair":                                      # the hair from behind and to one side (its mass, the highlight's band), the reel's light
			cam.fov = 30.0
			cam.position = face + Vector3(-0.55, 0.12, -0.75)
			cam.look_at(face + Vector3(0.0, -0.04, -0.09))
		"hairecu":                                   # the strands close, over the ear (about 12 cm across)
			cam.fov = 10.0
			var side := face + Vector3(0.075, 0.02, -0.09)
			cam.position = side + Vector3(0.62, 0.06, 0.25)
			cam.look_at(side)
		"front":                                     # the head from the front, framed as a portrait grid's tile (the eyes' reference)
			cam.fov = 21.0
			cam.position = face + Vector3(0.0, -0.01, 0.85)
			cam.look_at(face + Vector3(0.0, -0.025, 0.0))
		"eyes":                                      # both eyes from the front, about 9 cm across (the lids, the lashes, the brows' heads)
			cam.fov = 4.4
			cam.position = face + Vector3(0.0, 0.012, 0.75)
			cam.look_at(face + Vector3(0.0, 0.012, 0.0))
		"pov":
			cam.fov = rad_to_deg(2.0 * atan(tan(deg_to_rad(45.0)) * 9.0 / 16.0))   # the game's 90° across a 16:9 frame: 59° up and down
			cam.position = face + Vector3(0.15, 0.04, 1.2)
			cam.look_at(face + Vector3(0, -0.04, 0))


func _process(_d: float) -> bool:
	n += 1
	if n == 1:
		shoot(STAGES[stage])
	if n < 24:                                   # TAA and the SSS settle
		return false
	var name: String = STAGES[stage]
	var img := root.get_texture().get_image()
	if img.save_png(out_dir.path_join("%s_%s.png" % [tag, name])) != OK:   # (a path Godot can't write: say so and stop, never loop on)
		print("PORTRAIT FAIL: can't write into " + out_dir)
		quit(1)
		return true
	report["shots"][name] = grain(img)
	if eye_mask:
		report["shots"][name]["eye_px"] = greens(img)
	stage += 1
	n = 0
	if stage >= STAGES.size():
		var f := FileAccess.open(out_dir.path_join("%s.json" % tag), FileAccess.WRITE)
		if f != null:
			f.store_string(JSON.stringify(report, "  "))
			f.close()
		print("PORTRAIT ", JSON.stringify(report))
		return true
	return false


## how many pixels are the masked eyeballs' green (green well over red and blue: skin never is)
func greens(img: Image) -> int:
	var k := 0
	for y in img.get_height():
		for x in img.get_width():
			var c := img.get_pixel(x, y)
			if c.g - maxf(c.r, c.b) > 0.3:
				k += 1
	return k


## the picture's fine grain in its middle: the mean step between neighbouring pixels' luminance over the middle third
## (the skin's detail raises it), and the mean luminance there
func grain(img: Image) -> Dictionary:
	var w := img.get_width()
	var h := img.get_height()
	var s := 0.0
	var l := 0.0
	var k := 0
	for y in range(h / 3, 2 * h / 3):
		for x in range(w / 3, 2 * w / 3):
			var c := img.get_pixel(x, y)
			var d := img.get_pixel(x + 1, y)
			s += abs(c.get_luminance() - d.get_luminance())
			l += c.get_luminance()
			k += 1
	return {"grain": s / max(1, k), "lum": l / max(1, k)}
