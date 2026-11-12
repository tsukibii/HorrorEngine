## SEATS's playthrough (tools/godot/seat_check.py): the starter kit's seat.gd and the player's settle on furniture
## made of boxes. Headless (--fixed-fps 60). Prints `SEATS <what> <how>` lines and `SEATS result {errors}`, quits.
extends SceneTree

const S := "res://starter/"

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D


func say(what: String, how: String) -> void:
	print("SEATS %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("SEATS ERROR %s" % e)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 60.0)))


func v3(v: Vector3) -> String:
	return "(%.2f, %.2f, %.2f)" % [v.x, v.y, v.z]


func box(parent: Node3D, size: Vector3, at: Vector3, solid := false) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	m.mesh = b
	m.position = at
	parent.add_child(m)
	if solid:
		var sb := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		sb.add_child(cs)
		m.add_child(sb)
	return m


## a bed 2.0 x 1.0, its mattress top 0.5 m up, its long way x (or z); a headboard 6 cm thick to 1.0 m at its +end (-end, none)
func bed(at: Vector3, yaw_deg: float, head := 1, long_x := true) -> Node3D:
	var r := Node3D.new()
	r.name = "Bed"
	main.add_child(r)
	box(r, Vector3(2.0, 0.5, 1.0) if long_x else Vector3(1.0, 0.5, 2.0), Vector3(0, 0.25, 0), true)
	if head != 0:
		box(r, Vector3(0.06, 1.0, 1.0) if long_x else Vector3(1.0, 1.0, 0.06), Vector3(1.03 * head, 0.5, 0) if long_x else Vector3(0, 0.5, 1.03 * head))
	r.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(yaw_deg)), at)
	return r


## a chair: a seat 0.45 square, its top `h` up, four legs, a back to 0.95 m at its +z side (or none: a stool)
func chair(at: Vector3, yaw_deg: float, back := true, h := 0.45) -> Node3D:
	var r := Node3D.new()
	r.name = "Chair"
	main.add_child(r)
	box(r, Vector3(0.45, 0.05, 0.45), Vector3(0, h - 0.025, 0), true)
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			box(r, Vector3(0.04, h - 0.05, 0.04), Vector3(0.2 * sx, (h - 0.05) * 0.5, 0.2 * sz))
	if back:
		box(r, Vector3(0.45, 0.5, 0.04), Vector3(0, h + 0.25, 0.205))
	r.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(yaw_deg)), at)
	return r


func seat_on(furn: Node3D, scene: String, props := {}) -> Node3D:
	var s := (load(S + scene) as PackedScene).instantiate() as Node3D
	for k in props:
		s.set(k, props[k])
	furn.add_child(s)
	return s


func solid(size: Vector3, at: Vector3, yaw_deg := 0.0) -> StaticBody3D:
	var sb := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	sb.add_child(cs)
	main.add_child(sb)
	sb.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(yaw_deg)), at)
	return sb


func close(a: Vector3, b: Vector3, tol := 0.02) -> bool:
	return a.distance_to(b) <= tol


func turn_mouse(dx: float, dy: float) -> void:        # (headless the mouse is never captured: the player's own turn())
	player.turn(Vector2(dx, dy))


func press_e() -> void:
	for down in [true, false]:
		var e := InputEventKey.new()
		e.physical_keycode = KEY_E
		e.keycode = KEY_E
		e.pressed = down
		Input.parse_input_event(e)
		await frames(2)


func _initialize() -> void:
	create_timer(240.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("SEATS result " + JSON.stringify({"errors": errors}))
		quit())
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	var settle := float(player.settle_secs)

	# 1. a bed with a headboard, the bed scene dropped onto it: the pillow, facing its foot; eased there; a head's limits
	var b1 := bed(Vector3(3, 0, 0), 0.0, 1, true)
	var s1 := seat_on(b1, "seat_bed.tscn")
	await frames(6)
	var r1: Dictionary = s1.report()
	var want1 := Vector3(3.0 + 0.03 + 1.03 - 0.30, 0.5 + 0.22, 0.0)
	player.global_position = Vector3(3, 0.02, 2.0)
	player.rotation = Vector3.ZERO
	await frames(3)
	var eye0 := eye.global_position
	s1.use(player)
	await frames(1)
	var early := eye.global_position
	await secs(settle * 0.5)
	var mid := eye.global_position
	await secs(settle * 0.5 + 0.1)
	var there := eye.global_position
	var facing := -player.global_basis.z
	var pitch_deg := rad_to_deg(float(player.pitch))
	say("a bed with a headboard", "fitted from its %s: the mattress's top %.2f, the headboard at its %s end; the eye %s (wanted %s), facing %s, tilted up %.0f deg; eased: a frame after %.2f m from where it was, half way %.2f m from the pillow, then %.3f m; lying %s" % [
		r1["fitted"], float(r1["top"]), "+x" if float(r1["head"]) > 0.0 else ("-x" if float(r1["head"]) < 0.0 else "no"), v3(there), v3(want1), v3(facing), pitch_deg,
		early.distance_to(eye0), mid.distance_to(want1), there.distance_to(want1), player.pose])
	if r1["fitted"] != "meshes" or absf(float(r1["top"]) - 0.5) > 0.005 or float(r1["head"]) <= 0.0 or not close(there, want1) or not close(facing, Vector3.LEFT, 0.02) or absf(pitch_deg - 50.0) > 0.5 or player.pose != "lying":
		bad("the bed's eye (%s: top %.2f, head %s, eye %s wanted %s, facing %s, pitch %.0f, %s)" % [r1["fitted"], float(r1["top"]), r1["head"], v3(there), v3(want1), v3(facing), pitch_deg, player.pose])
	if early.distance_to(eye0) > 0.25 or mid.distance_to(want1) < 0.1 or mid.distance_to(eye0) < 0.1:
		bad("the eye should ease onto the pillow over %.2f s (a frame after %.2f m from the start, half way %.2f m from the pillow)" % [settle, early.distance_to(eye0), mid.distance_to(want1)])
	# the head: turned far right, far left, up and down
	var yaw0 := player.rotation.y
	turn_mouse(800, 0)                                   # 115 deg to the right
	await frames(3)
	var right_deg := rad_to_deg(wrapf(player.rotation.y - yaw0, -PI, PI))
	turn_mouse(-1600, 0)
	await frames(3)
	var left_deg := rad_to_deg(wrapf(player.rotation.y - yaw0, -PI, PI))
	turn_mouse(0, 800)
	await frames(3)
	var down_deg := rad_to_deg(float(player.pitch))
	turn_mouse(0, -1600)
	await frames(3)
	var up_deg := rad_to_deg(float(player.pitch))
	await press_e()
	await frames(1)
	var rising := eye.global_position
	await secs(settle + 0.1)
	var up_again: bool = player.pose == "standing" and player.global_position.distance_to(Vector3(3, 0.02, 2.0)) < 0.05 and absf(eye.position.y - 1.6) < 0.005
	turn_mouse(800, 0)
	await frames(3)
	var free_deg := absf(rad_to_deg(wrapf(player.rotation.y, -PI, PI)))   # (you stood facing 0)
	say("a head on a pillow", "turned right %.0f deg, left %.0f, down %.0f, up %.0f; E: a frame after still %.2f m from standing, then up where you stood %s; standing, the turn free (%.0f deg)" % [
		right_deg, left_deg, down_deg, up_deg, rising.distance_to(eye0), up_again, free_deg])
	if absf(right_deg + 75.0) > 1.0 or absf(left_deg - 75.0) > 1.0 or absf(down_deg + 5.0) > 1.0 or absf(up_deg - 80.0) > 1.0 or not up_again or rising.distance_to(eye0) < 0.3 or free_deg < 100.0:
		bad("a head lying down turns 75 deg each way, 5 down and 80 up, and E eases you up (%.0f, %.0f, %.0f, %.0f, up %s, %.2f)" % [right_deg, left_deg, down_deg, up_deg, up_again, rising.distance_to(eye0)])

	# 2. the same bed turned and moved: the eye goes with it
	b1.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(90.0)), Vector3(-4, 0, 3))
	await secs(0.6)
	var t2: Transform3D = s1.eye_transform()
	var want2: Vector3 = b1.global_transform * Vector3(0.76, 0.72, 0.0)
	# 3. no headboard, its long way z: the end behind the node; flip: the other end; the script on the bed itself
	var b3 := bed(Vector3(8, 0, 0), 0.0, 0, false)
	var s3 := seat_on(b3, "seat_bed.tscn")
	await frames(4)
	var t3: Transform3D = s3.eye_transform()
	s3.flip = true
	var t3f: Transform3D = s3.eye_transform()
	var b4 := bed(Vector3(8, 0, 5), 0.0, -1, true)
	b4.set_script(load(S + "seat.gd"))
	b4.set("pose", "lying")
	b4._ready()
	await frames(4)
	var t4: Transform3D = b4.eye_transform()
	say("beds", "turned 90 deg and moved: the eye %s (wanted %s), facing %s; no headboard, long in z: the eye %s facing %s; flipped: %s facing %s; the script on a bed with its headboard at -x: %s (%s), the eye %s facing %s" % [
		v3(t2.origin), v3(want2), v3(-t2.basis.z), v3(t3.origin), v3(-t3.basis.z), v3(t3f.origin), v3(-t3f.basis.z), b4.fitted, "head -x" if float(b4.report()["head"]) < 0.0 else "?", v3(t4.origin), v3(-t4.basis.z)])
	if not close(t2.origin, want2) or not close(-t2.basis.z, b1.global_basis * Vector3.LEFT):
		bad("a bed turned and moved takes its eye with it (%s, wanted %s)" % [v3(t2.origin), v3(want2)])
	if not close(t3.origin, Vector3(8, 0.72, 0.7)) or not close(-t3.basis.z, Vector3.FORWARD) or not close(t3f.origin, Vector3(8, 0.72, -0.7)) or not close(-t3f.basis.z, Vector3.BACK):
		bad("a bed with no headboard: your head at the end behind the node, flip the other (%s, %s)" % [v3(t3.origin), v3(t3f.origin)])
	if b4.fitted != "meshes" or not close(t4.origin, Vector3(8.0 - 0.03 - 1.03 + 0.30, 0.72, 5.0)) or not close(-t4.basis.z, Vector3.RIGHT):
		bad("the script on the bed itself (%s, the eye %s facing %s)" % [b4.fitted, v3(t4.origin), v3(-t4.basis.z)])

	# 4. a chair with a back: over its seat, facing away from the back; turned; a child's eye
	var c1 := chair(Vector3(0, 0, -4), 0.0, true)
	var sc := seat_on(c1, "seat_chair.tscn")
	await frames(4)
	var rc: Dictionary = sc.report()
	var tc: Transform3D = sc.eye_transform()
	var kid: Transform3D = sc.eye_transform(1.2)
	c1.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(180.0)), Vector3(0, 0, -4))
	await secs(0.5)
	var tcr: Transform3D = sc.eye_transform()
	player.global_position = Vector3(0, 0.02, -2.5)
	player.rotation = Vector3.ZERO
	await frames(2)
	sc.use(player)
	await secs(settle + 0.1)
	var sit_eye := eye.global_position
	var sit_pose: String = player.pose
	turn_mouse(1200, 0)
	await frames(3)
	var sit_turn := absf(rad_to_deg(wrapf(player.rotation.y - tcr.basis.get_euler().y, -PI, PI)))
	sc.use(player)
	await secs(settle + 0.1)
	say("a chair", "fitted from its %s: the seat %.2f m up, its back at %s; the eye %s facing %s; a child (eye 1.2 m): %.2f m up; turned round: facing %s; E: %s, the eye %s; the head turns %.0f deg" % [
		rc["fitted"], float(rc["top"]), v3(rc["back"]), v3(tc.origin), v3(-tc.basis.z), kid.origin.y, v3(-tcr.basis.z), sit_pose, v3(sit_eye), sit_turn])
	if rc["fitted"] != "meshes" or absf(float(rc["top"]) - 0.45) > 0.005 or not close(rc["back"], Vector3.BACK) or absf(tc.origin.y - 1.2) > 0.005 or absf(tc.origin.x) > 0.01 \
			or tc.origin.z > -4.0 or tc.origin.z < -4.06 or not close(-tc.basis.z, Vector3.FORWARD) or absf(kid.origin.y - (0.45 + 0.75 * 0.75)) > 0.005:
		bad("a chair's eye (%s: seat %.2f, back %s, eye %s facing %s, a child's %.2f)" % [rc["fitted"], float(rc["top"]), v3(rc["back"]), v3(tc.origin), v3(-tc.basis.z), kid.origin.y])
	if not close(-tcr.basis.z, Vector3.BACK) or sit_pose != "sitting" or not close(sit_eye, tcr.origin) or absf(sit_turn - 125.0) > 1.0:
		bad("a chair turned round, sat on (%s, %s, eye %s wanted %s, the head %.0f deg)" % [v3(-tcr.basis.z), sit_pose, v3(sit_eye), v3(tcr.origin), sit_turn])

	# 5. a stool (no back): the node's own facing; its height measured; then the adjusters
	var st := chair(Vector3(-6, 0, -4), 0.0, false, 0.75)
	var ss := seat_on(st, "seat_stool.tscn")
	ss.rotation.y = deg_to_rad(90.0)                     # facing -x
	await frames(4)
	var ts: Transform3D = ss.eye_transform()
	ss.seat_height = 0.6
	var ts_h: Transform3D = ss.eye_transform()
	ss.seat_height = 0.0
	ss.view_offset = Vector3(0.1, 0.05, -0.2)            # right, up, forward
	var ts_o: Transform3D = ss.eye_transform()
	ss.view_offset = Vector3.ZERO
	ss.view_turn_deg = 30.0
	var ts_t: Transform3D = ss.eye_transform()
	ss.view_turn_deg = 0.0
	ss.flip = true
	var ts_f: Transform3D = ss.eye_transform()
	ss.flip = false
	say("a stool", "no back found %s; the eye %s facing %s (the node's own); seat_height 0.6: %.2f m up; view_offset (0.1, 0.05, -0.2): %s; view_turn_deg 30: facing %s; flipped: facing %s; its head free (%s)" % [
		ss.report()["back"] == Vector3.ZERO, v3(ts.origin), v3(-ts.basis.z), ts_h.origin.y, v3(ts_o.origin), v3(-ts_t.basis.z), v3(-ts_f.basis.z), v3(ss.look_limits())])
	if ss.report()["back"] != Vector3.ZERO or not close(ts.origin, Vector3(-6, 1.5, -4)) or not close(-ts.basis.z, Vector3.LEFT) or absf(ts_h.origin.y - 1.35) > 0.005:
		bad("a stool's eye (%s facing %s; seat_height: %.2f)" % [v3(ts.origin), v3(-ts.basis.z), ts_h.origin.y])
	if not close(ts_o.origin, Vector3(-6 - 0.2, 1.55, -4 - 0.1)) or not close(-ts_t.basis.z, Vector3(-cos(deg_to_rad(30.0)), 0, sin(deg_to_rad(30.0)))) or not close(-ts_f.basis.z, Vector3.RIGHT) or ss.look_limits().x < 179.0:
		bad("a stool's adjusters (offset %s, turned %s, flipped %s, limits %s)" % [v3(ts_o.origin), v3(-ts_t.basis.z), v3(-ts_f.basis.z), v3(ss.look_limits())])

	# 6. a collider alone (an interior's export): a bed's box, a chair's tall box, a low stool's; the node anywhere over it
	solid(Vector3(2.0, 0.55, 1.0), Vector3(0, 0.275, 8), 0.0)
	var sb := (load(S + "seat_bed.tscn") as PackedScene).instantiate() as Node3D
	main.add_child(sb)
	sb.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(90.0)), Vector3(0.2, 0.7, 8.1))   # facing -x: your head at its +x end
	solid(Vector3(0.5, 0.9, 0.5), Vector3(4, 0.45, 8), 0.0)
	var sch := (load(S + "seat_chair.tscn") as PackedScene).instantiate() as Node3D
	main.add_child(sch)
	sch.global_position = Vector3(4, 1.0, 8)
	solid(Vector3(0.4, 0.5, 0.4), Vector3(7, 0.25, 8), 0.0)
	var sst := (load(S + "seat_stool.tscn") as PackedScene).instantiate() as Node3D
	main.add_child(sst)
	sst.global_position = Vector3(7, 0.6, 8)
	var bare := (load(S + "seat_chair.tscn") as PackedScene).instantiate() as Node3D   # nothing under it but the floor
	main.add_child(bare)
	bare.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(45.0)), Vector3(12, 1.1, 8))
	var hide := (load(S + "seat_bed.tscn") as PackedScene).instantiate() as Node3D     # hiding: always as placed
	hide.pose = "hiding"
	main.add_child(hide)
	hide.global_position = Vector3(-0.3, 0.9, 8)
	var off := (load(S + "seat_bed.tscn") as PackedScene).instantiate() as Node3D      # fit off: as placed
	off.fit = false
	main.add_child(off)
	off.global_position = Vector3(0.5, 0.61, 8)
	await frames(8)
	var tb: Transform3D = sb.eye_transform()
	var tch: Transform3D = sch.eye_transform()
	var tst: Transform3D = sst.eye_transform()
	var tbare: Transform3D = bare.eye_transform()
	var thide: Transform3D = hide.eye_transform()
	var toff: Transform3D = off.eye_transform()
	say("a collider alone", "a bed's box: %s, the eye %s facing %s; a chair's tall box: %s, the eye %.2f m up; a low box: %.2f m up; nothing but the floor: '%s', the eye where the node is %s; hiding over the bed: '%s' %s; fit off: '%s' %s" % [
		sb.fitted, v3(tb.origin), v3(-tb.basis.z), sch.fitted, tch.origin.y, tst.origin.y, bare.fitted, close(tbare.origin, Vector3(12, 1.1, 8)), hide.fitted, close(thide.origin, Vector3(-0.3, 0.9, 8)), off.fitted, close(toff.origin, Vector3(0.5, 0.61, 8))])
	if sb.fitted != "collider" or not close(tb.origin, Vector3(0.7, 0.77, 8.0)) or not close(-tb.basis.z, Vector3.LEFT) or sch.fitted != "collider" or absf(tch.origin.y - 1.2) > 0.005 or not close(tch.origin * Vector3(1, 0, 1), Vector3(4, 0, 8)) or absf(tst.origin.y - 1.25) > 0.005:
		bad("fitted to a collider alone (a bed %s %s facing %s; a chair %s %.2f; a low box %.2f)" % [sb.fitted, v3(tb.origin), v3(-tb.basis.z), sch.fitted, tch.origin.y, tst.origin.y])
	if bare.fitted != "" or not close(tbare.origin, Vector3(12, 1.1, 8)) or hide.fitted != "" or not close(thide.origin, Vector3(-0.3, 0.9, 8)) or off.fitted != "" or not close(toff.origin, Vector3(0.5, 0.61, 8)):
		bad("as placed when there's nothing to fit, when hiding and with fit off ('%s', '%s', '%s')" % [bare.fitted, hide.fitted, off.fitted])
	hide.queue_free()
	off.queue_free()
	await frames(2)

	# 7. E's box is the furniture's own: looked at from beside it, E lies you down; lying on the collider's bed the
	# eye is over its box; a chair shoved, its seat with it
	player.global_position = Vector3(0.0, 0.02, 9.6)
	player.rotation = Vector3.ZERO                       # facing -z: the bed's long side
	player.pitch = deg_to_rad(-40.0)
	eye.rotation.x = player.pitch
	await frames(3)
	var used: Node = player.use()
	await secs(settle + 0.1)
	var on_box := eye.global_position
	var on_pose: String = player.pose
	await press_e()
	await secs(settle + 0.1)
	c1.global_position = Vector3(2.0, 0, -4)             # the chair shoved 2 m
	await secs(0.6)
	var reach: Node3D = sc.get_node("Reach")
	player.global_position = Vector3(2.0, 0.02, -5.3)
	player.rotation = Vector3(0, PI, 0)                  # facing +z: the chair
	player.pitch = deg_to_rad(-35.0)
	eye.rotation.x = player.pitch
	await frames(3)
	var used2: Node = player.use()
	await secs(settle + 0.1)
	var shoved_eye := eye.global_position
	sc.use(player)
	await secs(settle + 0.1)
	say("E", "looking at the bed's side: E found %s, %s, the eye %s; the chair shoved 2 m: its box %.2f m from it, E found %s, the eye %s" % [
		used.name if used != null else "nothing", on_pose, v3(on_box), Vector2(reach.global_position.x - 2.0, reach.global_position.z + 4.0).length(), used2.name if used2 != null else "nothing", v3(shoved_eye)])
	if used != sb or on_pose != "lying" or not close(on_box, Vector3(0.7, 0.77, 8.0)):
		bad("E on the bed's box (found %s, %s, the eye %s)" % [used.name if used != null else "nothing", on_pose, v3(on_box)])
	if used2 != sc or Vector2(reach.global_position.x - 2.0, reach.global_position.z + 4.0).length() > 0.05 or absf(shoved_eye.x - 2.0) > 0.01 or absf(shoved_eye.z + 4.0) > 0.06 or absf(shoved_eye.y - 1.2) > 0.01:
		bad("a chair shoved takes its seat with it (found %s, the eye %s)" % [used2.name if used2 != null else "nothing", v3(shoved_eye)])

	# 8. an interior's export: the bed a node of meshes, the room's collider one mesh in which the bed is a box to its
	# headboard's top. The seat anywhere over it: measured from the meshes, the box swapped for a truer solid
	var level := Node3D.new()
	level.name = "Level"
	level.scene_file_path = "res://made_up_interior.glb"
	main.add_child(level)
	var vis := Node3D.new()
	vis.name = "visual"
	level.add_child(vis)
	var piece := Node3D.new()
	piece.name = "r1_bed"
	vis.add_child(piece)
	piece.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(90.0)), Vector3(20, 0, 0))   # its long way (z) lies along x
	var grp := Node3D.new()
	piece.add_child(grp)
	box(grp, Vector3(1.4, 0.5, 2.0), Vector3(0, 0.25, 0))                  # the mattress
	box(grp, Vector3(1.4, 0.95, 0.06), Vector3(0, 0.475, -1.03))           # the headboard, at its -z end
	box(grp, Vector3(0.6, 0.12, 0.35), Vector3(0, 0.56, -0.75))            # a pillow
	var lamp := box(vis, Vector3(0.2, 0.3, 0.2), Vector3(20.6, 0.65, 0.3)) # something small standing on it
	var room := StaticBody3D.new()
	room.name = "r1"
	level.add_child(room)
	var rcs := CollisionShape3D.new()
	var tri := ConcavePolygonShape3D.new()
	var faces := PackedVector3Array()
	var blo: Vector3 = piece.global_transform * Vector3(-0.7, 0.0, -1.06)
	var bhi: Vector3 = piece.global_transform * Vector3(0.7, 0.95, 1.0)
	var mn := blo.min(bhi)
	var mx := blo.max(bhi)
	var bm := BoxMesh.new()
	bm.size = mx - mn
	for vtx in bm.get_faces():
		faces.append(vtx + (mn + mx) * 0.5)
	var wall := BoxMesh.new()                                              # and a wall, the room's other solid
	wall.size = Vector3(0.2, 2.4, 4.0)
	for vtx in wall.get_faces():
		faces.append(vtx + Vector3(23, 1.2, 0))
	tri.set_faces(faces)
	rcs.shape = tri
	room.add_child(rcs)
	var si := (load(S + "seat_bed.tscn") as PackedScene).instantiate() as Node3D
	main.add_child(si)
	si.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(180.0)), Vector3(20.2, 1.3, 0.1))   # anywhere over it
	await frames(8)
	var ri: Dictionary = si.report()
	var ti: Transform3D = si.eye_transform()
	var want_i := Vector3(20.0 - 1.06 + 0.30, 0.72, 0.0)
	var left_tris: int = (rcs.shape as ConcavePolygonShape3D).get_faces().size() / 3
	var space := root.get_world_3d().direct_space_state
	var down_mid := space.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(20.3, 2, 0), Vector3(20.3, -1, 0), 1))
	var down_head := space.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(19.0, 2, 0), Vector3(19.0, -1, 0), 1))
	var to_eye := space.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(21.5, 1.7, 1.5), ti.origin, 1))
	player.global_position = Vector3(20.3, 0.02, 2.0)
	player.rotation = Vector3.ZERO
	await frames(2)
	si.use(player)
	await secs(settle + 0.1)
	var in_eye := eye.global_position
	var in_feet := player.global_position.y
	si.use(player)
	await secs(settle + 0.1)
	say("an interior's bed", "fitted from its %s (the piece under it, not the lamp on it): the blanket's top %.2f, its headboard at the -z end %s; the eye %s (wanted %s) facing %s; its box to 0.95 m swapped %s: %d triangles left of 24, the solid now %.2f m up in its middle and %.2f at its head, a look down at the pillow %s; lying there the eye %s, the body resting %.2f m up" % [
		ri["fitted"], float(ri["top"]), float(ri["head"]) < 0.0, v3(ti.origin), v3(want_i), v3(-ti.basis.z), si.carved, left_tris,
		float((down_mid.get("position", Vector3.ZERO) as Vector3).y), float((down_head.get("position", Vector3.ZERO) as Vector3).y), "clear" if to_eye.is_empty() else "stopped", v3(in_eye), in_feet])
	if ri["fitted"] != "meshes" or absf(float(ri["top"]) - 0.5) > 0.005 or float(ri["head"]) >= 0.0 or not close(ti.origin, want_i) or not close(-ti.basis.z, Vector3.RIGHT):
		bad("an interior's bed measured from its meshes (%s, top %.2f, head %s, the eye %s wanted %s)" % [ri["fitted"], float(ri["top"]), ri["head"], v3(ti.origin), v3(want_i)])
	if not si.carved or left_tris != 12 or absf(float((down_mid.get("position", Vector3.ZERO) as Vector3).y) - 0.5) > 0.01 or absf(float((down_head.get("position", Vector3.ZERO) as Vector3).y) - 0.95) > 0.01 or not to_eye.is_empty():
		bad("the bed's one solid box swapped for a truer one (carved %s, %d triangles left, %.2f in the middle, %.2f at the head, a look at the pillow %s)" % [si.carved, left_tris, float((down_mid.get("position", Vector3.ZERO) as Vector3).y), float((down_head.get("position", Vector3.ZERO) as Vector3).y), "clear" if to_eye.is_empty() else "stopped"])
	if not close(in_eye, want_i) or absf(in_feet - 0.5) > 0.02:
		bad("lying on an interior's bed: the eye on the pillow %s (wanted %s), the body on the mattress %.2f" % [v3(in_eye), v3(want_i), in_feet])
	lamp.queue_free()

	# 9. the editor's marker: a small camera at the eye, tilted as you'll look
	var mk: MeshInstance3D = s3.show_marker()
	var mk_fwd := -mk.global_basis.z
	say("the marker", "at the eye %s, looking %s (tilted up %.0f deg), %d lines" % [close(mk.global_position, s3.eye_transform().origin), v3(mk_fwd), rad_to_deg(asin(clampf(mk_fwd.y, -1, 1))), mk.mesh.get_surface_count()])
	if not close(mk.global_position, s3.eye_transform().origin) or absf(rad_to_deg(asin(clampf(mk_fwd.y, -1, 1))) - 50.0) > 1.0:
		bad("the editor's marker should sit at the eye, tilted as you'll look")

	print("SEATS result " + JSON.stringify({"errors": errors}))
	quit()
