## Life and carrying pictured in the game (tools/godot/motion_check.py shotslife; docs/ANIMATOR_V3.md §11, §12): a
## baked character in the by-hand scratch project with the starter's motion.gd under her and the look plugin's
## HSGesture, doing what a clip alone can't show: a flourish laid over what she's doing, and a thing carried in it.
##   a scratch of her head standing, walking and sat; a look at what she holds as she walks; a knuckle under her chin
##   and a stretch on a chair; her hand on her head while her head follows someone;
##   a mug carried in front of her standing, walking and sat; a bottle at her side walking and sneaking.
##   -- --glb=FILE --out=DIR [--only=stand,walk,sit,follow,cup,bottle]
## The .glb is read at run time (a Studio export is 60 MB: no import) and dressed as the game dresses it.
## Prints MOTIONLIFESHOTS {json}: the pictures' files and what each showed.
extends SceneTree

const S := "res://starter/"
const LOOK := "res://addons/horrorstudio_look/"
var glb := ""
var out_dir := ""
var main: Node3D
var her: Node3D
var m: Node
var g: Node
var ap: AnimationPlayer
var cam: Camera3D
var shots: Array = []
var notes: Array = []
var tall := 1.63
var k := 1.0
var only: Array = []
var chair: Node3D
var seat: Marker3D


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func until(cond: Callable, secs: float) -> bool:
	for i in int(secs * 60.0):
		if cond.call():
			return true
		await physics_frame
	return cond.call()


## a picture of this frame. Nothing is drawn between pictures (the game's frames go by some twenty times faster for
## it: a dressed character's skin on a software renderer is most of a frame's time)
func shot(name: String) -> void:
	RenderingServer.render_loop_enabled = true
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	shots.append(name + ".png")
	RenderingServer.render_loop_enabled = false


## the camera round her where she is now: `yaw_deg` from in front of her (minus: round to her right), looking at a
## place `up` of her height over her feet
func see_her(yaw_deg: float, up: float, dist: float, pitch_deg := 5.0, fov := 30.0) -> void:
	var y := her.global_rotation.y + deg_to_rad(yaw_deg)
	var p := deg_to_rad(pitch_deg)
	var at := her.global_position + Vector3(0, up * tall, 0)
	cam.position = at + Vector3(sin(y) * cos(p), sin(p), cos(y) * cos(p)) * dist * k
	cam.look_at(at, Vector3.UP)
	cam.fov = fov


func box(size: Vector3, at: Vector3, colour: Color, under: Node3D = null) -> MeshInstance3D:
	var b := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	b.mesh = bm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = colour
	mat.roughness = 0.9
	b.material_override = mat
	(under if under != null else main).add_child(b)
	b.position = at
	return b


func bounds(n: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false) + ([n] if n is MeshInstance3D else []):
		if (mi as MeshInstance3D).mesh == null:
			continue
		var bb: AABB = n.global_transform.affine_inverse() * (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).mesh.get_aabb()
		out = bb if first else out.merge(bb)
		first = false
	return out


## a prop from one of the project's models (a plain cylinder when it isn't there), with a grip on it
func thing(nm: String, scene: String, grip: Dictionary, plain := Vector3(0.035, 0.035, 0.1)) -> Node3D:
	var t: Node3D
	if ResourceLoader.exists(scene):
		t = (load(scene) as PackedScene).instantiate() as Node3D
	else:
		var mi := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = plain.x
		cyl.bottom_radius = plain.y
		cyl.height = plain.z
		mi.mesh = cyl
		t = mi
	t.name = nm
	main.add_child(t)
	var bb := bounds(t)
	var gr: Node3D = load(LOOK + "grip.gd").new()
	gr.name = "Grip"
	t.add_child(gr)
	var wide := minf(bb.size.x, bb.size.z)
	gr.position = Vector3(bb.get_center().x, bb.position.y + float(grip.get("at", 0.5)) * bb.size.y, bb.get_center().z)
	gr.set("size", float(grip.get("size", wide * 0.96)))
	gr.set("length", float(grip.get("length", 0.5)) * bb.size.y)
	for key in ["use", "carry", "upright"]:
		if grip.has(key):
			gr.set(key, grip[key])
	if grip.has("mouth"):
		gr.set("mouth", Vector3(0, (float(grip["mouth"]) - float(grip.get("at", 0.5))) * bb.size.y, 0))
	return t


func reset_her(at := Vector3.ZERO, yaw := 0.0) -> void:
	if is_instance_valid(m.held()):
		var was: Node3D = m.held()
		m.drop()
		was.visible = false
	m.stop()
	m.stance = ""
	m.seated = false
	m.asleep = false
	g.alive = false
	if String(g.now) != "":
		g.stop(0.01)
	her.global_position = at
	her.global_rotation.y = yaw
	m.head_follow(false)
	m.idle()
	await frames(30)


## a flourish started, and waited for until it's `share` of the way through the time her hand is where it goes
func flourish(name: String, share := 0.5, o := {}) -> bool:
	if not bool(g.play(name, o)):
		notes.append("%s: not played (%s)" % [name, "she hasn't got it" if not g.flourishes().has("life_" + name) else "not over what she's doing"])
		return false
	var meta: Dictionary = g.life_of(String(g.now))
	var an: Animation = ap.get_animation(String(g.now)) if ap != null and ap.has_animation(String(g.now)) else null
	var secs := an.length if an != null else 2.5
	var a := float(meta.get("in", 0.5))
	var b := maxf(a + 0.1, secs - float(meta.get("out", 0.5)))
	if meta.get("touch") is Dictionary:
		a = float(meta["touch"]["from"])
		b = float(meta["touch"]["to"])
	var at := a + (b - a) * share
	await until(func() -> bool: return String(g.now) == "" or float(g.t) >= at, 8.0)
	return String(g.now) != ""


func want(what: String) -> bool:
	return only.is_empty() or only.has(what)


func sit_her(at: Vector3) -> void:
	chair.visible = true
	chair.global_position = at
	seat.global_position = at + Vector3(0, 0.45, 0)
	seat.global_rotation.y = 0.0
	await reset_her(at + Vector3(0, 0, 1.2 * k))
	m.sit(seat)
	await until(func() -> bool: return bool(m.seated) and not bool(m.busy), 20.0)
	await frames(40)


func _initialize() -> void:
	create_timer(900.0).timeout.connect(func() -> void:
		print("MOTIONLIFESHOTS FAIL: it never ended (%s)" % str(notes))
		quit(1))
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--glb="):
			glb = a.substr(6)
		elif a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--only="):
			only = Array(a.substr(7).split(","))
	DirAccess.make_dir_recursive_absolute(out_dir)
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	if main.get_node_or_null("Story") != null:                    # (the Story's to-do list isn't part of these pictures)
		main.get_node("Story").set("visible", false)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.2, 0.21, 0.23)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.66, 0.74)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	main.add_child(we)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-38, 35, 0)
	key.light_energy = 1.25
	key.shadow_enabled = true
	main.add_child(key)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-10, -120, 0)
	fill.light_energy = 0.35
	fill.light_color = Color(0.8, 0.86, 1.0)
	main.add_child(fill)
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 60)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.33, 0.33, 0.34)
	fm.roughness = 0.9
	floor.material_override = fm
	main.add_child(floor)
	cam = Camera3D.new()
	main.add_child(cam)
	cam.current = true
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(glb, st) == OK:
		her = doc.generate_scene(st) as Node3D
	if her == null or not ResourceLoader.exists(LOOK + "gesture.gd"):
		print("MOTIONLIFESHOTS FAIL: no character at %s, or no look plugin with the gesture layer in the project" % glb)
		quit(1)
		return
	her.name = "Her"
	main.add_child(her)
	load(LOOK + "skin.gd").wear(her, {}, glb)
	load(LOOK + "hair.gd").wear(her, {}, glb)
	load(LOOK + "eye.gd").wear(her, glb)
	ap = her.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer
	m = Node.new()
	m.name = "Motion"
	m.set_script(load(S + "motion.gd"))
	her.add_child(m)
	await frames(10)
	RenderingServer.render_loop_enabled = false
	g = m.gesture()
	if g == null or g.flourishes().is_empty():
		print("MOTIONLIFESHOTS FAIL: %s has no life flourishes (baked before them: node tools/animator/bake.mjs)" % glb)
		quit(1)
		return
	tall = float(m.record.get("body", {}).get("height", 163.0)) / 100.0 if m.record.get("body") is Dictionary else 1.63
	k = tall / 1.63
	# a chair to sit on, as the modelling rules have one (docs/ANIMATION_RULES.md): its seat 45 cm up and 46 cm deep
	# behind its front edge, where the seat's marker is; its back behind that
	chair = Node3D.new()
	main.add_child(chair)
	box(Vector3(0.46, 0.05, 0.46), Vector3(0, 0.425, -0.23), Color(0.42, 0.33, 0.26), chair)
	box(Vector3(0.46, 0.5, 0.04), Vector3(0, 0.7, -0.5), Color(0.42, 0.33, 0.26), chair)
	for x in [-0.2, 0.2]:
		for z in [-0.44, -0.03]:
			box(Vector3(0.04, 0.4, 0.04), Vector3(x, 0.2, z), Color(0.36, 0.28, 0.22), chair)
	chair.visible = false
	seat = Marker3D.new()
	main.add_child(seat)

	# ---- 1. the same scratch standing, walking and sat ----
	if want("stand"):
		await reset_her()
		if await flourish("scratch_head", 0.5):
			see_her(-32.0, 0.6, 3.6)
			await shot("stand_scratch")
		await until(func() -> bool: return String(g.now) == "", 6.0)
	if want("walk"):
		await reset_her()
		m.walk_to(Vector3(0, 0, 24))
		await until(func() -> bool: return String(m.now) == "walk", 3.0)
		await frames(50)
		if await flourish("scratch_head", 0.5):
			see_her(-32.0, 0.6, 3.6)
			await shot("walk_scratch")
			var ik: Node = m.hand_ik()
			if ik != null and ik.last.has("r"):
				notes.append("walking, scratching her head: her hand's point %.1f mm from where the clip has it on her head, carried there %.0f mm by her hand's IK" % [float(ik.last["r"]["error"]) * 1000.0, float(ik.last["r"]["moved"]) * 1000.0])
		await until(func() -> bool: return String(g.now) == "", 6.0)
		await frames(30)
		if await flourish("wipe_brow", 0.5):
			see_her(-25.0, 0.6, 3.6)
			await shot("walk_brow")
		await until(func() -> bool: return String(g.now) == "", 6.0)
		await frames(20)
		if await flourish("rub_neck", 0.5):
			see_her(28.0, 0.6, 3.6)
			await shot("walk_neck")
		await until(func() -> bool: return String(g.now) == "", 6.0)
	if want("sit"):
		await sit_her(Vector3(4, 0, 0))
		if await flourish("scratch_head", 0.5):
			see_her(-32.0, 0.5, 3.6)
			await shot("sit_scratch")
		await until(func() -> bool: return String(g.now) == "", 6.0)
		await frames(20)
		if await flourish("chin", 0.5):
			see_her(-28.0, 0.5, 3.6)
			await shot("sit_chin")
		await until(func() -> bool: return String(g.now) == "", 6.0)
		await frames(20)
		if await flourish("stretch", 0.5):
			see_her(-20.0, 0.55, 4.2)
			await shot("sit_stretch")
		await until(func() -> bool: return String(g.now) == "", 8.0)
		m.stand()
		await until(func() -> bool: return not bool(m.seated) and not bool(m.busy), 10.0)
		chair.visible = false

	# ---- 2. her hand on her head while her head follows someone ----
	if want("follow"):
		await reset_her(Vector3(8, 0, 0))
		var you := MeshInstance3D.new()                              # who she looks at: a small ball where their eyes are
		var sm := SphereMesh.new()
		sm.radius = 0.05
		sm.height = 0.1
		you.mesh = sm
		var ym := StandardMaterial3D.new()
		ym.albedo_color = Color(1.0, 0.72, 0.25)
		ym.emission_enabled = true
		ym.emission = Color(1.0, 0.62, 0.15)
		ym.emission_energy_multiplier = 1.2
		you.material_override = ym
		main.add_child(you)
		var a := deg_to_rad(56.0)
		you.global_position = her.global_position + Vector3(sin(a), 0, cos(a)) * 0.85 * k + Vector3(0, 0.94 * tall, 0)
		m.head_follow(true, you, 160.0)
		await frames(100)
		if await flourish("scratch_head", 0.5):
			see_her(8.0, 0.82, 2.5)
			await shot("follow_scratch")
		await until(func() -> bool: return String(g.now) == "", 6.0)
		m.head_follow(false)
		you.visible = false

	# ---- 3. a mug carried in front of her: standing, walking, sat; looked at as she walks ----
	if want("cup"):
		await reset_her(Vector3(12, 0, 0))
		var mug := thing("Mug", "res://addons/horrorstudio_weapons/models/mug_stoneware.glb", {"at": 0.5, "length": 0.7, "use": 2, "mouth": 1.0})
		m.hold(mug)
		await frames(80)
		notes.append("the mug: carried '%s'" % String(g.carrying("r")))
		see_her(-38.0, 0.6, 3.6)
		await shot("cup_stand")
		m.walk_to(her.global_position + Vector3(0, 0, 24))
		await until(func() -> bool: return String(m.now) == "walk", 3.0)
		await frames(75)
		see_her(-60.0, 0.6, 3.6)
		await shot("cup_walk")
		if await flourish("look_hand", 0.5):
			see_her(-38.0, 0.6, 3.6)
			await shot("cup_walk_look")
		await until(func() -> bool: return String(g.now) == "", 6.0)
		await sit_with(mug)
		see_her(-38.0, 0.5, 3.6)
		await shot("cup_sit")
		m.stand()
		await until(func() -> bool: return not bool(m.seated) and not bool(m.busy), 10.0)
		chair.visible = false
		m.drop()
		mug.visible = false

	# ---- 4. a bottle at her side: walking, sneaking ----
	if want("bottle"):
		await reset_her(Vector3(20, 0, 0))
		var bottle := thing("Bottle", "res://addons/horrorstudio_devices/shop/models/water_bottle.glb", {"at": 0.42, "length": 0.5}, Vector3(0.016, 0.034, 0.26))
		m.hold(bottle)
		await frames(60)
		m.walk_to(her.global_position + Vector3(0, 0, 24))
		await until(func() -> bool: return String(m.now) == "walk", 3.0)
		await frames(80)
		see_her(-70.0, 0.55, 3.8)
		await shot("bottle_walk")
		m.stop()
		await frames(20)
		m.sneak_to(her.global_position + Vector3(0, 0, 6))
		await until(func() -> bool: return String(m.now).contains("sneak"), 4.0)
		await frames(90)
		see_her(-70.0, 0.5, 3.8)
		await shot("bottle_sneak")
		notes.append("the bottle: carried '%s' sneaking" % String(g.carrying("r")))
		m.stop()
		m.drop()
		bottle.visible = false
	print("MOTIONLIFESHOTS " + JSON.stringify({"shots": shots, "notes": notes}))
	quit()


## sat down where she is, keeping what she holds
func sit_with(_thing: Node3D) -> void:
	m.stop()
	await frames(10)
	var at := her.global_position + Vector3(0, 0, -1.2 * k)
	chair.visible = true
	chair.global_position = at
	seat.global_position = at + Vector3(0, 0.45, 0)
	seat.global_rotation.y = 0.0
	m.sit(seat)
	await until(func() -> bool: return bool(m.seated) and not bool(m.busy), 25.0)
	await frames(60)
