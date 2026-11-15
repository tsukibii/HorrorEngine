## Animations v3 pictured in the game (tools/godot/motion_check.py shots3; docs/ANIMATOR_V3.md): a baked character in
## the by-hand scratch project with the starter's motion.gd under her and the look plugin's head tracker, hand IK and
## grips, doing the things a clip alone can't show:
##   her head following someone to her left, to her right, and let go of when they're behind her;
##   a bottle taken from a table by its grip and drunk from; a bat taken and swung onto someone; a punch landing.
##   -- --glb=FILE --out=DIR [--size=WxH]
## The .glb is read at run time (a Studio export is 60 MB: no import) and dressed as the game dresses it.
## Prints MOTION3SHOTS {json}: the pictures' files.
extends SceneTree

const S := "res://starter/"
const LOOK := "res://addons/horrorstudio_look/"
var glb := ""
var out_dir := ""
var main: Node3D
var her: Node3D
var m: Node
var ap: AnimationPlayer
var cam: Camera3D
var evs: Array = []
var dones: Array = []
var shots: Array = []
var notes: Array = []
var tall := 1.63
var only: Array = []


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func until(cond: Callable, secs: float) -> bool:
	for i in int(secs * 60.0):
		if cond.call():
			return true
		await physics_frame
	return cond.call()


func shot(name: String) -> void:
	await frames(2)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	shots.append(name + ".png")


func look_from(at: Vector3, yaw_deg: float, pitch_deg: float, dist: float, fov := 30.0) -> void:
	var y := deg_to_rad(yaw_deg)
	var p := deg_to_rad(pitch_deg)
	cam.position = at + Vector3(sin(y) * cos(p), sin(p), cos(y) * cos(p)) * dist
	cam.look_at(at, Vector3.UP)
	cam.fov = fov


func box(size: Vector3, at: Vector3, colour: Color) -> MeshInstance3D:
	var b := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	b.mesh = bm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = colour
	mat.roughness = 0.9
	b.material_override = mat
	main.add_child(b)
	b.global_position = at
	return b


func grip_on(thing: Node3D, values: Dictionary) -> Node3D:
	var g: Node3D = load(LOOK + "grip.gd").new()
	g.name = "Grip"
	thing.add_child(g)
	for k in values:
		g.set(k, values[k])
	return g


func reset_her(at := Vector3.ZERO, yaw := 0.0) -> void:
	m.stop()
	her.global_position = at
	her.global_rotation.y = yaw
	m.idle()
	evs.clear()
	dones.clear()
	await frames(24)


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


func _initialize() -> void:
	create_timer(600.0).timeout.connect(func() -> void:
		print("MOTION3SHOTS FAIL: it never ended (%s)" % str(notes))
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
	# a room to see her in: a floor, a key light with shadows, a fill, a plain background
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
	pm.size = Vector2(14, 14)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.33, 0.33, 0.34)
	fm.roughness = 0.9
	floor.material_override = fm
	main.add_child(floor)
	cam = Camera3D.new()
	main.add_child(cam)
	cam.current = true
	# her
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(glb, st) == OK:
		her = doc.generate_scene(st) as Node3D
	if her == null or not ResourceLoader.exists(LOOK + "hand_ik.gd"):
		print("MOTION3SHOTS FAIL: no character at %s, or no look plugin in the project" % glb)
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
	m.event.connect(func(n: String) -> void: evs.append(n))
	m.done.connect(func(w: String) -> void: dones.append(w))
	await frames(10)
	tall = float(m.record.get("body", {}).get("height", 163.0)) / 100.0 if m.record.get("body") is Dictionary else 1.63
	var k := tall / 1.63
	var head_y := 0.9 * tall

	# ---- 1. her head follows someone: to her left, to her right; behind her she lets go ----
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
	for item in ([["head_left", 62.0, 0.8], ["head_right", -70.0, 0.8], ["head_behind", 150.0, 0.8]] if only.is_empty() or only.has("head") else []):
		await reset_her()
		var a := deg_to_rad(float(item[1]))
		you.global_position = Vector3(sin(a), 0, cos(a)) * float(item[2]) * k + Vector3(0, head_y + 0.06 * k, 0)
		m.head_follow(true, you, 160.0)
		await frames(100)
		look_from(Vector3(0, head_y - 0.12 * k, 0.1 * k), 0.0 if String(item[0]) != "head_behind" else 28.0, 6.0, 2.9 * k, 30.0)
		await shot(String(item[0]))
		var ht: Node = load(LOOK + "head_track.gd").of(her)
		notes.append("%s: her head turned %.0f degrees, following %s" % [item[0], rad_to_deg(float(ht.yaw)) * float(ht.weight) if ht != null else 0.0, str(ht.following) if ht != null else "?"])   # (yaw: where it's turned to at its full weight; let go of, the weight goes to nothing)
	m.head_follow(false)
	you.visible = false

	# ---- 2. a bottle taken from a table by its grip, and drunk from ----
	if only.is_empty() or only.has("drink"):
		await drink_shots(k, head_y)
	if only.is_empty() or only.has("swing"):
		await blow_shots(k)
	print("MOTION3SHOTS " + JSON.stringify({"shots": shots, "notes": notes}))
	quit()


func drink_shots(k: float, head_y: float) -> void:
	await reset_her()
	var table := box(Vector3(0.9, 0.84 * k, 0.5), Vector3(0.25, 0.42 * k, 1.75 * k), Color(0.42, 0.33, 0.26))
	var bottle_scene := "res://addons/horrorstudio_devices/shop/models/water_bottle.glb"
	var bottle: Node3D
	if ResourceLoader.exists(bottle_scene):
		bottle = (load(bottle_scene) as PackedScene).instantiate() as Node3D
	else:                                                         # (a project without the devices plugin: a plain bottle)
		var bm := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.02
		cyl.bottom_radius = 0.0325
		cyl.height = 0.21
		bm.mesh = cyl
		bottle = bm
	bottle.name = "Bottle"
	main.add_child(bottle)
	await frames(2)
	var bb := bounds(bottle)
	bottle.global_position = Vector3(0.2, 0.84 * k - bb.position.y + 0.002, 1.62 * k)
	var wide := maxf(bb.size.x, bb.size.z)
	grip_on(bottle, {"position": Vector3(0, bb.position.y + 0.42 * bb.size.y, 0), "size": wide * 0.96, "length": 0.5 * bb.size.y, "use": 2, "mouth": Vector3(0, 0.58 * bb.size.y, 0)})
	notes.append("the bottle: %.1f cm tall, %.1f cm thick" % [bb.size.y * 100.0, wide * 100.0])
	m.drink(bottle)
	await until(func(): return evs.has("grab"), 25.0)
	await frames(3)
	look_from(Vector3(0.1, 0.95 * k, 1.2 * k), -62.0, 12.0, 2.6 * k, 30.0)
	await shot("drink_take")
	await until(func(): return evs.has("sip"), 20.0)
	await frames(26)                                              # (the sip's deepest: the rim at her lips, tipped)
	var hb := her.global_position
	look_from(Vector3(hb.x, head_y - 0.1 * k, hb.z), rad_to_deg(her.global_rotation.y) - 58.0, 4.0, 1.25 * k, 30.0)
	await shot("drink_sip")
	var ik: Node = m.hand_ik()
	if ik != null and ik.last.has("r"):
		notes.append("the sip: the rim %.1f cm from her lips" % (float(ik.last["r"]["error"]) * 100.0))
	await until(func(): return dones.has("drink"), 12.0)
	if m.held() != null:
		m.drop()
	bottle.visible = false
	table.visible = false



# ---- 3. a bat taken and swung onto someone; a punch ----
func blow_shots(k: float) -> void:
	var ik: Node = m.hand_ik()
	await reset_her()
	var rack := box(Vector3(0.9, 0.8 * k, 0.4), Vector3(-0.2, 0.4 * k, 1.6 * k), Color(0.42, 0.33, 0.26))
	var bat := MeshInstance3D.new()
	var cyl2 := CylinderMesh.new()
	cyl2.top_radius = 0.03
	cyl2.bottom_radius = 0.0175
	cyl2.height = 0.78
	bat.mesh = cyl2
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.72, 0.55, 0.36)
	wood.roughness = 0.6
	bat.material_override = wood
	bat.name = "Bat"
	main.add_child(bat)
	bat.global_transform = Transform3D(Basis(Vector3(0, 0, 1), deg_to_rad(90.0)), Vector3(-0.2, 0.8 * k + 0.031, 1.5 * k))   # lying on the rack, its handle toward her right
	grip_on(bat, {"position": Vector3(0, -0.27, 0), "size": 0.036, "length": 0.2, "tip": Vector3(0, 0.6, 0)})
	var victim: Node3D
	if ResourceLoader.exists("res://characters/normal_woman.glb"):
		victim = (load("res://characters/normal_woman.glb") as PackedScene).instantiate() as Node3D
		victim.name = "Victim"
		main.add_child(victim)
		var vm := Node.new()
		vm.name = "Motion"
		vm.set_script(load(S + "motion.gd"))
		victim.add_child(vm)
	else:
		victim = box(Vector3(0.4, 1.7, 0.3), Vector3(0, 0.85, 0), Color(0.5, 0.5, 0.52))
	victim.global_position = Vector3(1.9, 0, 2.6)
	victim.global_rotation.y = deg_to_rad(-140.0)
	m.pick_up(bat, true)
	await until(func(): return dones.has("pick_up"), 30.0)
	rack.visible = false
	evs.clear()
	dones.clear()
	m.swing(victim)
	await until(func(): return String(ap.current_animation).contains("swing") and ap.current_animation_position > 0.24 * ap.current_animation_length, 20.0)
	var mid := (her.global_position + victim.global_position) * 0.5
	look_from(Vector3(mid.x, 0.95 * k, mid.z), rad_to_deg(atan2(victim.global_position.x - her.global_position.x, victim.global_position.z - her.global_position.z)) - 90.0, 8.0, 4.3 * k, 30.0)
	await shot("swing_up")
	await until(func(): return evs.has("hit"), 10.0)
	await frames(1)
	mid = (her.global_position + victim.global_position) * 0.5
	look_from(Vector3(mid.x, 0.95 * k, mid.z), rad_to_deg(atan2(victim.global_position.x - her.global_position.x, victim.global_position.z - her.global_position.z)) - 90.0, 8.0, 4.3 * k, 30.0)
	await shot("swing_hit")
	if ik != null and ik.last.has("r"):
		notes.append("the swing: the bat's end %.1f cm from where it was aimed" % (float(ik.last["r"]["error"]) * 100.0))
	await until(func(): return dones.has("swing"), 10.0)
	m.drop()
	bat.visible = false
	await frames(50)
	evs.clear()
	dones.clear()
	m.punch(victim)
	await until(func(): return evs.has("hit"), 20.0)
	await frames(1)
	mid = (her.global_position + victim.global_position) * 0.5
	look_from(Vector3(mid.x, 1.0 * k, mid.z), rad_to_deg(atan2(victim.global_position.x - her.global_position.x, victim.global_position.z - her.global_position.z)) - 90.0, 6.0, 3.6 * k, 30.0)
	await shot("punch_hit")
	if ik != null and ik.last.has("r"):
		notes.append("the punch: her fist %.1f cm from where it was aimed" % (float(ik.last["r"]["error"]) * 100.0))
