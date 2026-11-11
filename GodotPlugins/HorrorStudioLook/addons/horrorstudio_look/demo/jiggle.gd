## HSJiggle (docs/GODOT_LOOK.md §5n; tools/godot/jiggle_check.py runs it: JIGGLE). A skeleton made here with a head and
## two chains named as a Character Studio export names an animal ear's (a long one of four bones leaning out, a short
## upright one of two):
## the springs made, one setting a chain; still, the tips rest; the head jerked sideways, each tip lags behind and the
## long ear's further than the short one's; left alone, both settle back where they were; with gravity the long ear
## hangs lower; at amount 0 nothing moves. Then, given a Studio export with ears (`--glb=`), the same on the real thing:
## its chains found, its ears' meshes skinned to them, their softness read from the file, a jerk moving their tips.
##   godot --headless --fixed-fps 60 --path PROJECT -s res://addons/horrorstudio_look/demo/jiggle.gd -- --out=DIR [--glb=FILE]
extends SceneTree

var out_dir := "res://"
var glb := ""
var report := {}
var who: Node3D
var sk: Skeleton3D
var jig: HSJiggle
var frame := 0
var tips := {}                    # a chain's name -> its tip's bone
var now := {}                     # each tip where it is this frame, in the skeleton's space
var rest := {}
var most := {}
var stage := "made"
var stages: Array = []
var t0 := 0
var x0 := 0.0


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		if a.begins_with("--glb="):
			glb = a.substr(6)
	stages = ["made", "rest", "jerk", "settle", "gravity", "off"]
	who = Node3D.new()
	who.name = "who"
	root.add_child(who)
	sk = Skeleton3D.new()
	sk.name = "Skeleton3D"
	who.add_child(sk)
	var bone := func(nm: String, parent: int, at: Vector3) -> int:
		var b := sk.add_bone(nm)
		sk.set_bone_parent(b, parent)
		sk.set_bone_rest(b, Transform3D(Basis(), at))
		sk.set_bone_pose_position(b, at)
		return b
	var world := bone.call("body_world", -1, Vector3.ZERO)
	var head := bone.call("c_head", world, Vector3(0, 1.5, 0))
	var lean := Vector3(sin(0.6), cos(0.6), 0) * 0.035                        # (leaning out 34 degrees: gravity has something to pull on)
	var at := bone.call("jiggle_ear_L_0", head, Vector3(0.07, 0.12, 0))       # a long ear: four bones of 3.5 cm
	for k in [1, 2, 3]:
		at = bone.call("jiggle_ear_L_%d" % k, at, lean)
	bone.call("jiggle_ear_L_tip", at, lean)
	at = bone.call("jiggle_ear_R_0", head, Vector3(-0.07, 0.12, 0))           # a short one: two of 2 cm
	at = bone.call("jiggle_ear_R_1", at, Vector3(0, 0.02, 0))
	bone.call("jiggle_ear_R_tip", at, Vector3(0, 0.02, 0))
	wear(who, {"gravity": 0.0})


func wear(node: Node3D, settings: Dictionary) -> void:
	jig = HSJiggle.attach(node, settings)
	tips.clear()
	if jig == null:
		return
	var s: Skeleton3D = node.find_children("*", "Skeleton3D", true, false)[0] if not (node is Skeleton3D) else node
	sk = s
	for c in HSJiggle.chains_of(sk):
		tips[c["name"]] = sk.find_bone(c["tip"])
	if not sk.skeleton_updated.is_connected(_seen):
		sk.skeleton_updated.connect(_seen)


func _seen() -> void:                                   # after the springs: where each tip is now
	for k in tips:
		now[k] = sk.get_bone_global_pose(tips[k]).origin


func off(k: String) -> float:                           # how far a tip is from where it rested (m)
	return (now.get(k, Vector3.ZERO) - rest.get(k, Vector3.ZERO)).length()


func walk(f: int) -> void:
	var t := f / 60.0
	who.position = Vector3(x0 + 0.4 + 0.01 * sin(TAU * t), 0.025 * sin(TAU * 2.0 * t), 0)


func next(s: String) -> void:
	stage = s
	t0 = frame
	most.clear()


func _process(_delta: float) -> bool:
	frame += 1
	if frame > 4000 or (jig == null and frame > 4):   # (never left hanging: a script that didn't compile, a stage that never ends)
		print("JIGGLE FAIL: stopped at stage " + stage)
		quit(1)
		return true
	var f := frame - t0
	for k in tips:
		most[k] = maxf(most.get(k, 0.0), off(k))
	match stage:
		"made":
			if f == 8:
				report["made"] = jig.report() if jig != null else {}
				report["chains"] = HSJiggle.chains_of(sk)
				next("rest")
		"rest":
			if f == 40:
				for k in tips:
					rest[k] = now.get(k, Vector3.ZERO)
				report["rest"] = {"L": rest.get("ear_L", Vector3.ZERO).y, "R": rest.get("ear_R", Vector3.ZERO).y}
				x0 = who.position.x
				next("jerk")
		"jerk":                                           # the head thrown 40 cm sideways in a fifth of a second, then held
			who.position.x = x0 + 0.4 * clampf(f / 12.0, 0.0, 1.0)
			if f == 30:
				report["jerk"] = {"L": most.get("ear_L", 0.0), "R": most.get("ear_R", 0.0)}
				next("settle")
		"settle":
			if f == 240:
				report["settle"] = {"L": off("ear_L"), "R": off("ear_R")}
				next("walk")
		"walk":                                           # a walk's bob: the head up and down 2.5 cm twice a second, swaying a centimetre
			walk(f)
			if f == 180:
				report["walk"] = {"L": most.get("ear_L", 0.0), "R": most.get("ear_R", 0.0)}
				who.position = Vector3(x0 + 0.4, 0, 0)
				next("turn")
		"turn":                                           # the head turned 60 degrees in a third of a second
			who.rotation.y = deg_to_rad(60.0) * clampf((f - 60) / 20.0, 0.0, 1.0)
			if f == 60:
				most.clear()
			if f == 110:
				report["turn"] = {"L": most.get("ear_L", 0.0), "R": most.get("ear_R", 0.0)}
				who.rotation.y = 0.0
				next("unturn")
		"unturn":
			if f == 150:
				jig.gravity = 0.6
				jig.wear()
				next("gravity")
		"gravity":
			if f == 200:
				report["gravity"] = {"L": now.get("ear_L", Vector3.ZERO).y - rest.get("ear_L", Vector3.ZERO).y, "R": now.get("ear_R", Vector3.ZERO).y - rest.get("ear_R", Vector3.ZERO).y}
				jig.gravity = 0.0
				jig.set_amount(0.0)
				next("off")
		"off":
			if f > 20:
				who.position = Vector3(x0 + 0.4 - 0.4 * clampf((f - 20) / 12.0, 0.0, 1.0), 0, 0)
			if f == 20:
				most.clear()
			if f == 70:
				report["off"] = {"L": most.get("ear_L", 0.0), "R": most.get("ear_R", 0.0)}
				if glb != "":
					real()
					next("real_rest")
				else:
					return done()
		"real_rest":
			if f == 50:
				for k in tips:
					rest[k] = now.get(k, Vector3.ZERO)
				x0 = who.position.x
				next("real_jerk")
		"real_jerk":
			who.position.x = x0 + 0.4 * clampf(f / 12.0, 0.0, 1.0)
			if f == 40:
				var r: Dictionary = report["real"]
				r["jerk"] = {}
				for k in tips:
					r["jerk"][k] = most.get(k, 0.0)
				next("real_settle")
		"real_settle":
			if f == 300:
				var r: Dictionary = report["real"]
				r["settle"] = {}
				for k in tips:
					r["settle"][k] = off(k)
				next("real_walk")
		"real_walk":
			walk(f)
			if f == 180:
				var r: Dictionary = report["real"]
				r["walk"] = {}
				for k in tips:
					r["walk"][k] = most.get(k, 0.0)
				who.position = Vector3(x0 + 0.4, 0, 0)
				next("real_turn")
		"real_turn":
			who.rotation.y = deg_to_rad(60.0) * clampf((f - 60) / 20.0, 0.0, 1.0)
			if f == 60:
				most.clear()
			if f == 110:
				var r: Dictionary = report["real"]
				r["turn"] = {}
				for k in tips:
					r["turn"][k] = most.get(k, 0.0)
				return done()
	return false


## a Studio export with ears: loaded as it is, its look's jiggle put on as a game does (HSJiggle.attach)
func real() -> void:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	var r := {"glb": glb, "loaded": false}
	report["real"] = r
	if doc.append_from_file(glb, st) != OK:
		return
	var node := doc.generate_scene(st)
	if node == null:
		return
	who.queue_free()
	who = node
	root.add_child(who)
	r["loaded"] = true
	wear(who, {"gravity": 0.0})
	r["attached"] = jig != null
	if jig == null:
		return
	r["chains"] = HSJiggle.chains_of(sk)
	r["soft"] = HSJiggle.softness(who)
	var skinned := []
	var stray := 0
	for mi in who.find_children("*", "MeshInstance3D", true, false):       # the meshes whose points are weighted to a chain's bones, and to nothing else
		if mi.skin == null or not (mi.mesh is ArrayMesh) or mi.mesh.get_surface_count() == 0:
			continue
		var arr: Array = mi.mesh.surface_get_arrays(0)
		var bones = arr[Mesh.ARRAY_BONES]
		var weights = arr[Mesh.ARRAY_WEIGHTS]
		if bones == null or weights == null or bones.size() == 0:
			continue
		var on := 0
		var other := 0
		for i in bones.size():
			if weights[i] < 0.01:
				continue
			var bind: int = bones[i]
			var nm := String(mi.skin.get_bind_name(bind))
			if nm == "" and mi.skin.get_bind_bone(bind) >= 0:
				nm = sk.get_bone_name(mi.skin.get_bind_bone(bind))
			if nm.begins_with("jiggle_"):
				on += 1
			else:
				other += 1
		if on > 0:
			skinned.append(String(mi.name))
			stray += other
	r["meshes"] = skinned
	r["stray"] = stray                                 # weights of those meshes on bones that aren't a chain's
	r["head"] = sk.find_bone("c_head")
	var parents := []
	for c in r["chains"]:
		parents.append(sk.get_bone_name(sk.get_bone_parent(sk.find_bone(c["root"]))))
	r["parents"] = parents


func done() -> bool:
	if jig != null:
		report["final"] = jig.report()
	var f := FileAccess.open(out_dir.path_join("jiggle.json"), FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(report, "  "))
		f.close()
	print("JIGGLE " + JSON.stringify(report))
	quit(0)
	return true
