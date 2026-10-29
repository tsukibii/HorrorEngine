## A Character Studio export in Godot on HSSkin (docs/GODOT_LOOK.md §5; tools/godot/people_check.py runs it: GDPEOPLE):
## the glb loaded, its skin put on HumanShaders' skin shader with the wetness layer, its eyes as the export bakes them,
## pictured as a medium close-up: under a flat white ambient (the skin's colour measured against the export's own
## baked paint: the Studio's colours come across), under the studio's lights dry, sweating, and oiled.
##   godot --path PROJECT -s res://addons/horrorstudio_look/demo/people.gd -- --glb=res://people/NAME.glb --out=DIR
extends SceneTree

var glb := "res://people/_studiotest.glb"
var out_dir := "res://"
var n := 0
var stage := 0
var env: Environment
var world: Node3D
var cam: Camera3D
var who: Node3D
var mats: Array = []
var lights: Array = []
var report := {}
const STAGES := ["flat", "lit", "wet", "oil", "eye_front", "eye_slant", "eye_slant_flat"]
var eyes: Dictionary = {}
var eye_centre := Vector3.ZERO


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		if a.begins_with("--glb="):
			glb = a.substr(6)
	root.size = Vector2i(1280, 720)
	world = Node3D.new()
	root.add_child(world)
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.5, 0.5, 0.5)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1, 1, 1)
	env.ambient_light_energy = 1.0
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var ps = load(glb) if ResourceLoader.exists(glb) else null
	if ps == null:
		var doc := GLTFDocument.new()
		var st := GLTFState.new()
		if doc.append_from_file(glb, st) == OK:
			who = doc.generate_scene(st)
	else:
		who = ps.instantiate()
	if who == null:
		print("PEOPLE FAIL: no glb at " + glb)
		quit(1)
		return
	world.add_child(who)
	mats = HSSkin.wear(who, {})
	report["skin_mats"] = mats.size()
	eyes = HSEye.wear(who, glb)                      # the Studio's eye: the refracting cornea on the export's eyeballs
	report["eyes"] = eyes.keys()
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		if mi.name.ends_with("_eye_L") and mi.mesh != null:
			var a: AABB = mi.global_transform * mi.get_aabb()
			eye_centre = a.get_center()
	report["eye_centre"] = [eye_centre.x, eye_centre.y, eye_centre.z]
	var tex = mats[0].get_shader_parameter("texture_albedo") if mats.size() else null
	report["paint"] = tex_mean(tex) if tex is Texture2D else null
	# the head: the top of the skin mesh's bounds
	var top := 1.7
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		if mi.name.to_lower().contains("skin"):
			var a: AABB = mi.get_aabb()
			top = (mi.global_transform * a).end.y
	report["top"] = top
	cam = Camera3D.new()
	cam.fov = 30
	world.add_child(cam)
	cam.position = Vector3(0.0, top - 0.11, 0.9)
	cam.look_at(Vector3(0, top - 0.12, 0))
	HSLook.apply(root, env, "plain")


func tex_mean(t: Texture2D) -> Dictionary:
	var im: Image = t.get_image()
	if im == null:
		return {}
	if im.is_compressed():
		im.decompress()
	var s := Vector3.ZERO
	var k := 0
	for y in range(0, im.get_height(), 7):
		for x in range(0, im.get_width(), 7):
			var c := im.get_pixel(x, y)
			if c.a < 0.5:
				continue
			s += Vector3(c.r, c.g, c.b)
			k += 1
	if k == 0:
		return {}
	s /= k
	return {"r": s.x, "g": s.y, "b": s.z, "n": k}


## the picture's skin: the pixels of the face box that aren't the grey background, averaged
func face_mean(img: Image) -> Dictionary:
	var s := Vector3.ZERO
	var k := 0
	for y in range(200, 560, 2):
		for x in range(440, 840, 2):
			var c := img.get_pixel(x, y)
			if abs(c.r - c.g) < 0.02 and abs(c.g - c.b) < 0.02:   # the grey background, the teeth
				continue
			s += Vector3(c.r, c.g, c.b)
			k += 1
	if k == 0:
		return {}
	s /= k
	return {"r": s.x, "g": s.y, "b": s.z, "n": k}


func light_it() -> void:
	env.background_color = Color(0.03, 0.035, 0.05)
	env.ambient_light_color = Color(0.45, 0.5, 0.65)
	env.ambient_light_energy = 0.25
	HSLook.apply(root, env, "realism")
	var key := OmniLight3D.new()
	key.position = Vector3(0.7, report["top"] + 0.4, 0.9)
	key.light_energy = 3.0
	key.omni_range = 6.0
	key.light_color = Color(1.0, 0.9, 0.78)
	key.shadow_enabled = true
	world.add_child(key)
	var rim := OmniLight3D.new()
	rim.position = Vector3(-0.9, report["top"] + 0.2, -0.6)
	rim.light_energy = 2.0
	rim.omni_range = 5.0
	rim.light_color = Color(0.6, 0.7, 1.0)
	world.add_child(rim)


func _process(_d: float) -> bool:
	n += 1
	if n < 20:
		return false
	var name: String = STAGES[stage]
	var img := root.get_texture().get_image()
	img.save_png(out_dir.path_join("people_" + name + ".png"))
	if name == "flat":
		report["flat"] = face_mean(img)
	stage += 1
	if stage >= STAGES.size():
		var f := FileAccess.open(out_dir.path_join("people.json"), FileAccess.WRITE)
		f.store_string(JSON.stringify(report, "  "))
		f.close()
		print("PEOPLE ", JSON.stringify(report))
		quit()
		return true
	match STAGES[stage]:
		"lit":
			light_it()
		"wet":
			for m in mats:
				HSSkin.set_wet(m, {"wetness": 0.8, "sweat": 0.8, "sweat_scale": 220.0, "drips": 0.4})
		"oil":
			for m in mats:
				HSSkin.set_wet(m, {"wetness": 0.0, "sweat": 0.0, "drips": 0.0, "oil": 1.0})
		"eye_front":                                   # the left eye close, straight on: the iris behind its glass
			for m in mats:
				HSSkin.set_wet(m, {"oil": 0.0})
			cam.fov = 6.0
			cam.position = eye_centre + Vector3(0, 0, 0.6)
			cam.look_at(eye_centre)
		"eye_slant":                                   # from 35° above: the iris slides against the limbus (refraction)
			cam.position = eye_centre + Vector3(0, 0.6 * sin(deg_to_rad(35)), 0.6 * cos(deg_to_rad(35)))
			cam.look_at(eye_centre)
		"eye_slant_flat":                              # the same with the cornea bending nothing (IOR 1): the shift measured against it
			for k in eyes:
				eyes[k].set_shader_parameter("ior", 1.0)
	n = 0
	return false
