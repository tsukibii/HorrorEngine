## Animator v2: a character's baked clips pictured in Godot (tools/godot/motion_check.py shots). The .glb read as a
## game reads a body at run time (GLTFDocument), a clip held at a moment, the whole body in the frame:
##   -- --glb=FILE --out=DIR --tag=NAME --plan=JSON [--size=WxH] [--frames=N] [--wear] [--light=reel|room]
## plan: [{"clip": "walk_loop", "t": 0.25, "view": "side"|"front"|"q"|"back"|"top", "name": "walk_3", "at": [x,y,z], "dist": 3.2}, ...]
## (t in seconds; "f": a share of the clip's length instead; "bone": a bone to look at instead of `at`, where it is at
## that moment, for a close-up of a hand: "l_wrist", with "dist" some 0.6; "yaw", "pitch", "fov" the camera's own;
## "boxes": [[x, y, z, sx, sy, sz], ...] plain boxes in that picture, by their middles and sizes: a wall for a peek).
## Prints MOTIONSHOTS {json}: the clips the file has, their lengths and loop modes, each picture's file.
extends SceneTree

var glb := ""
var out_dir := ""
var tag := "motion"
var plan: Array = []
var size := Vector2i(480, 640)
var frames := 6
var wear := false
var light := "reel"
var env: Environment
var world: Node3D
var cam: Camera3D
var who: Node3D
var ap: AnimationPlayer
var n := 0
var stage := 0
var tall := 1.7
var report := {"shots": [], "clips": {}}
var t0 := 0


func _initialize() -> void:
	t0 = Time.get_ticks_msec()
	var plan_file := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--glb="):
			glb = a.substr(6)
		elif a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--tag="):
			tag = a.substr(6)
		elif a.begins_with("--plan="):
			plan_file = a.substr(7)
		elif a.begins_with("--size="):
			var p := a.substr(7).split("x")
			size = Vector2i(int(p[0]), int(p[1]))
		elif a.begins_with("--frames="):
			frames = int(a.substr(9))
		elif a == "--wear":
			wear = true
		elif a.begins_with("--light="):
			light = a.substr(8)
	plan = JSON.parse_string(FileAccess.get_file_as_string(plan_file))
	root.size = size
	world = Node3D.new()
	root.add_child(world)
	env = Environment.new()
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(glb, st) == OK:
		who = doc.generate_scene(st)
	if who == null:
		print("MOTIONSHOTS FAIL: no glb at " + glb)
		quit(1)
		return
	world.add_child(who)
	for p in who.find_children("*", "AnimationPlayer", true, false):
		ap = p
		break
	if ap != null:
		for nm in ap.get_animation_list():
			var an := ap.get_animation(nm)
			report["clips"][String(nm)] = {"secs": an.length, "loop": an.loop_mode, "tracks": an.get_track_count()}
	var top := 0.0
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh != null:
			var bb: AABB = mi.mesh.get_aabb()
			top = max(top, bb.position.y + bb.size.y)
	if top > 0.5:
		tall = top
	if wear:                                                        # a Studio export dressed as the game dresses it (the look plugin, when the project has it)
		var base := "res://addons/horrorstudio_look/"
		if ResourceLoader.exists(base + "eye.gd"):
			load(base + "skin.gd").wear(who, {}, glb)
			load(base + "hair.gd").wear(who, {}, glb)
			load(base + "eye.gd").wear(who, glb)
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.2, 0.21, 0.23)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.66, 0.74)
	env.ambient_light_energy = 0.55 if light != "room" else 0.2
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-38, 35, 0)
	key.light_energy = 1.25 if light != "room" else 0.9
	key.shadow_enabled = true
	world.add_child(key)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-10, -120, 0)
	fill.light_energy = 0.35
	fill.light_color = Color(0.8, 0.86, 1.0)
	world.add_child(fill)
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(8, 8)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.33, 0.33, 0.34)
	fm.roughness = 0.9
	floor.material_override = fm
	world.add_child(floor)
	cam = Camera3D.new()
	world.add_child(cam)
	cam.current = true
	cam.fov = 28.0
	DirAccess.make_dir_recursive_absolute(out_dir)


func pose(s: Dictionary) -> void:
	for old in world.get_children():                                   # the boxes of the picture before
		if old.name.begins_with("_Box"):
			old.free()
	for b in s.get("boxes", []):
		var box := MeshInstance3D.new()
		box.name = "_Box"
		var bm := BoxMesh.new()
		bm.size = Vector3(b[3], b[4], b[5])
		box.mesh = bm
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.52, 0.5, 0.47)
		mat.roughness = 0.95
		box.material_override = mat
		world.add_child(box, true)
		box.position = Vector3(b[0], b[1], b[2])
	if ap != null and s.has("clip") and ap.has_animation(s["clip"]):
		var an := ap.get_animation(s["clip"])
		var t: float = float(s.get("t", float(s.get("f", 0.0)) * an.length))
		ap.play(s["clip"])
		ap.seek(clamp(t, 0.0, an.length), true)
		ap.speed_scale = 0.0
	var at := Vector3(0, tall * 0.5, 0)
	if s.has("at"):
		at = Vector3(s["at"][0], s["at"][1], s["at"][2])
	if s.has("bone"):                                               # where a bone is in this pose (a hand's close-up)
		for sk in who.find_children("*", "Skeleton3D", true, false):
			var bi: int = sk.find_bone(String(s["bone"]))
			if bi >= 0:
				at = sk.global_transform * sk.get_bone_global_pose(bi).origin
				if s.has("off"):
					at += Vector3(s["off"][0], s["off"][1], s["off"][2])
				break
	var dist: float = float(s.get("dist", tall * 2.35))
	var yaw := 0.0
	var pitch := 4.0
	match String(s.get("view", "side")):
		"front":
			yaw = 0.0
		"side":
			yaw = -90.0
		"q":
			yaw = -35.0
		"back":
			yaw = 180.0
		"left":
			yaw = 90.0
		"top":
			pitch = 60.0
	if s.has("yaw"):
		yaw = float(s["yaw"])
	if s.has("pitch"):
		pitch = float(s["pitch"])
	var y := deg_to_rad(yaw)
	var p := deg_to_rad(pitch)
	cam.position = at + Vector3(sin(y) * cos(p), sin(p), cos(y) * cos(p)) * dist
	cam.look_at(at, Vector3.UP)
	if s.has("fov"):
		cam.fov = float(s["fov"])


func _process(_d: float) -> bool:
	if stage >= plan.size():
		return done()
	n += 1
	if n == 1:
		pose(plan[stage])
	if n < frames:
		return false
	var s: Dictionary = plan[stage]
	var file := "%s_%s.png" % [tag, String(s.get("name", "%03d" % stage))]
	root.get_texture().get_image().save_png(out_dir.path_join(file))
	report["shots"].append(file)
	n = 0
	stage += 1
	return stage >= plan.size() and done()


func done() -> bool:
	report["seconds"] = (Time.get_ticks_msec() - t0) / 1000.0
	print("MOTIONSHOTS " + JSON.stringify(report))
	quit(0)
	return true
