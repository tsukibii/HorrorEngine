## A Character Studio export as a portrait (docs/GODOT_LOOK.md §5d; tools/godot/portrait_check.py runs it): the glb
## worn as the game wears it (HSSkin, HSEye, HSHair), lit like a character reel (a big soft key from the side and
## above, a weak fill, a cool rim, a muted ground) and pictured at four distances: a medium close-up at three-quarter,
## a close-up, an extreme close-up of the cheek and the nose's side (about 9 cm across: the pores), and the game's own
## medium shot (the player's 90° lens at 1.2 m under a warm lamp). `--detail=off` pictures the same with the skin's
## detail layer off (HSSkin's `detail` 0), for the before and after.
##   godot --path PROJECT -s res://addons/horrorstudio_look/demo/portrait.gd -- --glb=res://people/NAME.glb --out=DIR [--detail=off] [--tag=NAME] [--preset=NAME] [--shots=ecu,cu]
extends SceneTree

var glb := "res://people/_studiotest.glb"
var out_dir := "res://"
var tag := "portrait"
var detail_on := true
var preset := ""
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
	var settings := {}
	if preset != "":                                 # a preset's name, or its numbers as JSON over "natural"
		settings["detail_preset"] = JSON.parse_string(preset) if preset.begins_with("{") else preset
	mats = HSSkin.wear(who, settings, glb)
	if not detail_on:
		for m in mats:
			m.set_shader_parameter("detail", 0.0)
	HSEye.wear(who, glb)
	HSHair.wear(who, {})
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
		"pov":
			room()
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
	img.save_png(out_dir.path_join("%s_%s.png" % [tag, name]))
	report["shots"][name] = grain(img)
	stage += 1
	n = 0
	if stage >= STAGES.size():
		var f := FileAccess.open(out_dir.path_join("%s.json" % tag), FileAccess.WRITE)
		f.store_string(JSON.stringify(report, "  "))
		f.close()
		print("PORTRAIT ", JSON.stringify(report))
		return true
	return false


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
