## GDMOTION (tools/godot/motion_check.py): a character baked by the Animator, in a by-hand Godot project, headless.
## What it prints: lines "MOTION ..." and at the end "MOTION result {json}".
extends SceneTree

const S := "res://starter/"
var main: Node3D
var story: Node
var errors: Array = []
var notes := {}


func say(t: String) -> void:
	print("MOTION " + t)


func bad(t: String) -> void:
	errors.append(t)
	print("MOTION !! " + t)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func until(cond: Callable, secs: float) -> bool:
	var n := int(secs * 60.0)
	for i in n:
		if cond.call():
			return true
		await physics_frame
	return cond.call()


func mark(at: Vector3, yaw := 0.0) -> Marker3D:
	var m := Marker3D.new()
	main.add_child(m)
	m.global_position = at
	m.global_rotation.y = yaw
	return m


func bone_at(h: Node3D, nm: String) -> Vector3:
	var sk := h.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	return sk.global_transform * sk.get_bone_global_pose(sk.find_bone(nm)).origin


func made(src: String) -> GDScript:
	var s := GDScript.new()
	s.source_code = src
	s.reload()
	return s


func _initialize() -> void:
	create_timer(600.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
		quit())
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(5)
	story = main.get_node("Story")
	var who := "normal_woman"
	var file := "res://characters/%s.glb" % who

	# ---- A. the file as a game reads a body at run time (GLTFDocument) -----------------------------------------------
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	var a: Node3D = null
	if doc.append_from_file(ProjectSettings.globalize_path(file), st) == OK:
		a = doc.generate_scene(st) as Node3D
	if a == null:
		bad("the baked file doesn't load")
		print("MOTION result " + JSON.stringify({"errors": errors}))
		quit()
		return
	main.add_child(a)
	var ap := a.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer
	var names := Array(ap.get_animation_list())
	for n in ["idle_loop", "walk_loop", "run_loop", "sit_down", "sit_loop", "stand_up", "lie_down", "sleep_loop", "get_up", "open_push", "open_pull", "open_slide", "reach_low", "reach_mid", "reach_high"]:
		if not names.has(n):
			bad("read at run time: no clip '%s' (it has %s)" % [n, names])
	var wrong_loop: Array = []
	var not_bone := 0
	var face_tracks: Array = []
	for n in names:
		var an := ap.get_animation(n)
		if (an.loop_mode == Animation.LOOP_LINEAR) != String(n).ends_with("_loop"):
			wrong_loop.append(n)
		for t in an.get_track_count():
			var ty := an.track_get_type(t)
			if ty != Animation.TYPE_POSITION_3D and ty != Animation.TYPE_ROTATION_3D and ty != Animation.TYPE_SCALE_3D:
				not_bone += 1
			var path := String(an.track_get_path(t))
			var bn := path.get_slice(":", 1)
			if bn.contains("eye") or bn.contains("jaw") or bn.contains("tongue") or bn.contains("teeth") or bn.begins_with("jiggle_"):
				face_tracks.append("%s %s" % [n, bn])
	if not wrong_loop.is_empty():
		bad("loop modes by name: wrong on %s" % [wrong_loop])
	if not_bone > 0:
		bad("%d tracks that aren't a bone's (a clip must move bones only: the face stays its own layer)" % not_bone)
	if not face_tracks.is_empty():
		bad("tracks on the face's or the springs' bones: %s" % [face_tracks.slice(0, 5)])
	var sk := a.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	var soft := 0
	for b in sk.get_bone_count():
		if sk.get_bone_name(b).begins_with("soft_"):
			soft += 1
	if soft < 7:
		bad("%d soft bones in her skeleton" % soft)
	var rec := {}
	for mi in a.find_children("*", "MeshInstance3D", true, false):
		if mi.has_meta("extras") and mi.get_meta("extras") is Dictionary and (mi.get_meta("extras") as Dictionary).has("hsMotion"):
			rec = mi.get_meta("extras")["hsMotion"]
	if rec.is_empty() or not (rec.get("clips", {}) as Dictionary).has("walk_loop"):
		bad("the bake's record isn't on her skin's node")
	say("read at run time: %d clips, loops by their names, %d soft bones, every track a bone's, none on the face; the record with her" % [names.size(), soft])
	# the soft bones move in the walk, and the body's bones only: the breast's bone against the chest's
	ap.play("walk_loop")
	var lo := 1e9
	var hi := -1e9
	var chest := sk.find_bone("c_spine3")
	var bust := sk.find_bone("soft_bust_l")
	for i in 70:
		await physics_frame
		if bust >= 0:
			var rel := (sk.get_bone_global_pose(chest).affine_inverse() * sk.get_bone_global_pose(bust)).origin.y
			lo = min(lo, rel)
			hi = max(hi, rel)
	if bust >= 0 and (hi - lo < 0.002 or hi - lo > 0.06):
		bad("the breast's bone moves %.1f mm against the chest over a stride" % ((hi - lo) * 1000.0))
	notes["bust_mm"] = snappedf((hi - lo) * 1000.0, 0.1)
	a.queue_free()
	await frames(2)

	# ---- B. the same file as the editor imported it, with the starter's Motion under her -----------------------------
	var ps := load(file) as PackedScene
	if ps == null:
		bad("the editor didn't import the baked file")
		print("MOTION result " + JSON.stringify({"errors": errors}))
		quit()
		return
	var her := ps.instantiate() as Node3D
	her.name = "Her"
	main.add_child(her)
	her.global_position = Vector3(0, 0, 0)
	var imp := Array((her.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer).get_animation_list())
	notes["imported_names"] = imp.slice(0, 6)
	var m := Node.new()
	m.name = "Motion"
	m.set_script(load(S + "motion.gd"))
	her.add_child(m)
	await frames(6)
	var rep: Dictionary = m.report()
	if not rep["baked"] or (rep["clips"] as Array).size() < 15 or not (rep["problems"] as Array).is_empty():
		bad("Motion under an imported character: %s" % [rep])
	if m.now != "idle":
		bad("she doesn't start idle (%s)" % m.now)
	say("imported by the editor: its clips are called %s...; Motion finds %d of them, her walk %.2f m/s, her run %.2f" % [imp.slice(0, 3), (rep["clips"] as Array).size(), rep["walk"], rep["run"]])

	# ---- C. walking somewhere: at her walk's own speed, her feet not sliding, there and idle -------------------------
	var dones: Array = []
	m.done.connect(func(w: String) -> void: dones.append(w))
	var evs: Array = []
	m.event.connect(func(e: String) -> void: evs.append(e))
	var goal := Vector3(0.6, 0, 4.0)
	m.walk_to(goal)
	await frames(50)                                  # (up to speed)
	var p0 := her.global_position
	var slip := 0.0
	var planted := 0
	var last := bone_at(her, "l_ball")
	for i in 60:
		await physics_frame
		var b := bone_at(her, "l_ball")
		if b.y < 0.035 and last.y < 0.035:                # the ball of her foot down: it shouldn't travel
			slip += Vector2(b.x - last.x, b.z - last.z).length()
			planted += 1
		last = b
	var v := (her.global_position - p0).length() / 1.0
	if absf(v - float(rep["walk"])) > 0.12 * float(rep["walk"]):
		bad("walking at %.2f m/s, her walk was made for %.2f" % [v, rep["walk"]])
	if planted < 10 or slip / max(1, planted) * 60.0 > 0.2:
		bad("her planted foot slides %.2f m/s (%d frames down)" % [slip / max(1, planted) * 60.0, planted])
	var there := await until(func() -> bool: return dones.has("walk"), 8.0)
	if not there or her.global_position.distance_to(goal) > 0.08 or m.now != "idle" or m.busy:
		bad("walk_to: %s from the goal, now %s" % [snappedf(her.global_position.distance_to(goal), 0.01), m.now])
	if not evs.has("step_l") or not evs.has("step_r"):
		bad("no steps heard from her walk (%s)" % [evs])
	say("walk_to: %.2f m/s (made for %.2f), her planted foot slides %.3f m/s, there within %.0f mm, idle; her steps as events" % [v, rep["walk"], slip / max(1, planted) * 60.0, her.global_position.distance_to(goal) * 1000.0])
	dones.clear()
	m.run_to(Vector3(0, 0, 0))
	await frames(40)
	var q0 := her.global_position
	await frames(30)
	var rv := (her.global_position - q0).length() / 0.5
	if rv < 1.6 * v:
		bad("running at %.2f m/s, walking at %.2f" % [rv, v])
	await until(func() -> bool: return dones.has("walk"), 8.0)
	say("run_to: %.2f m/s" % rv)

	# ---- D. sitting: to the seat, down, sat; asked to walk, she stands first --------------------------------------------
	var seat := mark(Vector3(3, 0.45, 2), PI * 0.5)                # the seat's front edge, 45 cm up, facing +X
	dones.clear()
	m.sit(seat)
	var sat := await until(func() -> bool: return dones.has("sit"), 14.0)
	var pel := bone_at(her, "root")
	if not sat or not m.seated or m.now != "sit_loop":
		bad("sit: not sat (%s, %s)" % [m.now, dones])
	if pel.y < 0.45 or pel.y > 0.62:
		bad("sat with her pelvis %.2f m up on a 0.45 m seat" % pel.y)
	if pel.x > 3.0 - 0.1 or pel.x < 3.0 - 0.6 or absf(pel.z - 2.0) > 0.08:
		bad("sat with her pelvis at %s: the seat's edge is at x 3, facing +X" % [pel])
	if absf(angle_difference(her.global_rotation.y, PI * 0.5)) > 0.05:
		bad("sat facing %.2f, not the seat's way" % her.global_rotation.y)
	say("sit: walked to the seat, sat (her pelvis %.2f m up, %.2f m back from its edge), facing its way" % [pel.y, 3.0 - pel.x])
	dones.clear()
	m.walk_to(Vector3(3, 0, 4.5))
	await until(func() -> bool: return dones.has("walk"), 14.0)
	if dones.find("stand") < 0 or dones.find("stand") > dones.find("walk") or m.seated:
		bad("asked to walk while sat: %s" % [dones])
	say("asked to walk while sat: she stands first, then walks (%s)" % [dones])

	# ---- E. sleeping: sits on the bed's edge, lies down with her head on the pillow; woken, she gets up ---------------
	var bed := mark(Vector3(-3, 0.45, 2), -PI * 0.5)               # the bed's edge, facing -X (the bed lies beyond, toward +X)
	var pillow := mark(Vector3(-2.5, 0.5, 1.3))                    # toward -Z along the edge: her right as she sits
	dones.clear()
	m.sleep(bed, pillow)
	var slept := await until(func() -> bool: return dones.has("sleep"), 22.0)
	await frames(30)
	var head := bone_at(her, "c_head")
	var pv := bone_at(her, "root")
	if not slept or not m.asleep:
		bad("sleep: not asleep (%s, %s)" % [m.now, dones])
	if Vector2(head.x - pillow.global_position.x, head.z - pillow.global_position.z).length() > 0.25:
		bad("asleep with her head %s, the pillow at %s" % [head, pillow.global_position])
	if absf(head.y - pv.y) > 0.2 or pv.y < 0.45 or pv.y > 0.7:
		bad("asleep but not lying flat on the bed: her head %.2f m up, her pelvis %.2f" % [head.y, pv.y])
	say("sleep: on the bed, her head %.2f m from the pillow, lying flat %.2f m up; the clip for that side (%s)" % [Vector2(head.x - pillow.global_position.x, head.z - pillow.global_position.z).length(), pv.y, m.now])
	dones.clear()
	m.wake()
	var woke := await until(func() -> bool: return dones.has("wake"), 14.0)
	if not woke or m.asleep or bone_at(her, "c_head").y < 1.2:
		bad("wake: %s, her head %.2f m up" % [dones, bone_at(her, "c_head").y])
	say("wake: up on her feet")

	# ---- F. a door: her hand on its handle as it opens ----------------------------------------------------------------
	var door := Node3D.new()
	door.set_script(made("extends Node3D\nvar used := 0\nvar by: Node\nfunc use(b: Node = null) -> void:\n\tused += 1\n\tby = b\n"))
	main.add_child(door)
	var handle := mark(Vector3(0, 1.0, -3), PI)                    # at the handle, into the door: facing -Z
	dones.clear()
	evs.clear()
	var grab_d := [9.0]
	m.event.connect(func(e: String) -> void:
		if e == "grab":
			grab_d[0] = min(grab_d[0], bone_at(her, "r_wrist").distance_to(handle.global_position)))
	m.open(handle, door, "push")
	await until(func() -> bool: return dones.has("open"), 14.0)
	if door.used != 1 or door.by != her:
		bad("open: the door's use() called %d times" % door.used)
	if grab_d[0] > 0.16:
		bad("open: her wrist %.2f m from the handle as she takes it" % grab_d[0])
	if evs.find("grab") < 0 or evs.find("open") < evs.find("grab") or evs.find("release") < evs.find("open"):
		bad("open: its moments out of order (%s)" % [evs])
	say("open: her wrist %.0f mm from the handle as she takes it, the door's use() as she pushes, then let go" % (grab_d[0] * 1000.0))

	# ---- G. picking something up: from the floor and from a table; an act for it, by the Story's words ----------------
	for hgt in [0.05, 0.85]:
		var thing := MeshInstance3D.new()
		thing.mesh = BoxMesh.new()
		(thing.mesh as BoxMesh).size = Vector3(0.06, 0.06, 0.06)
		main.add_child(thing)
		thing.global_position = Vector3(2.0, hgt, -2.0)
		dones.clear()
		var grabbed := [9.0, ""]
		var cb := func(e: String) -> void:
			if e == "grab":
				grabbed[0] = bone_at(her, "r_wrist").distance_to(thing.global_position)
				grabbed[1] = m.now
		m.event.connect(cb)
		m.pick_up(thing)
		await until(func() -> bool: return dones.has("pick_up"), 16.0)
		m.event.disconnect(cb)
		if grabbed[0] > 0.15:
			bad("pick_up at %.2f m: her wrist %.2f m from it as her hand closes" % [hgt, grabbed[0]])
		if not (thing.get_parent() is BoneAttachment3D) or thing.visible:
			bad("pick_up at %.2f m: it should be in her hand and put away (parent %s, visible %s)" % [hgt, thing.get_parent().name, thing.visible])
		say("pick_up from %.2f m: %s, her wrist %.0f mm from it as her hand closes; in her hand, then put away" % [hgt, grabbed[1], grabbed[0] * 1000.0])
	var key := MeshInstance3D.new()
	key.mesh = BoxMesh.new()
	main.add_child(key)
	key.global_position = Vector3(-2, 0.8, -2)
	var act2 := Node.new()
	act2.name = "TakeKey"
	act2.set_script(load(S + "act.gd"))
	act2.set("act", "pick_up")
	act2.set("tick", "key")
	main.add_child(act2)
	act2.set("who", act2.get_path_to(her))
	act2.set("target", act2.get_path_to(key))
	var act1 := Node.new()
	act1.name = "GoThere"
	act1.set_script(load(S + "act.gd"))
	act1.set("act", "walk_to")
	act1.set("needs", "wanted")
	main.add_child(act1)
	act1.set("who", act1.get_path_to(her))
	act1.set("target", act1.get_path_to(mark(Vector3(-1, 0, -1))))
	act1.set("then", act1.get_path_to(act2))
	await frames(30)
	if act1.times != 0:
		bad("an act fired before its needs held")
	story.flag("wanted")
	var ticked := await until(func() -> bool: return story.done("key"), 30.0)
	if not ticked or act1.times != 1 or act2.times != 1 or key.visible:
		bad("acts by the Story's words: the task ticked %s, the acts fired %d and %d times" % [ticked, act1.times, act2.times])
	say("acts: a flag set, she walks there, then takes the key, and the task is ticked")

	# ---- H. a clip of your own; the hunt's Moves node on her own clips ---------------------------------------------------
	var an := Animation.new()
	an.length = 0.6
	var tr := an.add_track(Animation.TYPE_ROTATION_3D)
	var skp := her.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	an.track_set_path(tr, NodePath("%s:r_uparm" % String((her.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer).get_node((her.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer).root_node).get_path_to(skp))))
	an.rotation_track_insert_key(tr, 0.0, Quaternion.IDENTITY)
	an.rotation_track_insert_key(tr, 0.3, Quaternion(Vector3(0, 0, 1), -1.2))
	an.rotation_track_insert_key(tr, 0.6, Quaternion.IDENTITY)
	DirAccess.make_dir_recursive_absolute("res://animations")
	ResourceSaver.save(an, "res://animations/wave.res")
	m.more = {"wave": "res://animations/wave.res"}
	m.setup()
	await frames(4)
	dones.clear()
	m.play("wave")
	await frames(12)
	var waving: String = (her.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer).current_animation
	await until(func() -> bool: return dones.has("play"), 5.0)
	if waving != "more/wave" or not dones.has("play") or m.now != "idle":
		bad("a clip of your own: playing '%s', then %s, %s" % [waving, dones, m.now])
	say("a clip of your own (a file in `more`): played, then idle again")
	var mv := Node.new()
	mv.name = "Moves"
	mv.set_script(load(S + "moves.gd"))
	her.add_child(mv)
	await frames(6)
	var mr: Dictionary = mv.report()
	if not (mr["moves"] as Array).has("walk") or not (mr["moves"] as Array).has("run") or not (mr["moves"] as Array).has("idle"):
		bad("moves.gd on a baked character: %s" % [mr])
	mv.play("walk", 0.65)
	await frames(3)
	var rate: float = (her.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer).speed_scale
	if absf(rate - 0.65 / float(rep["walk"])) > 0.03:
		bad("moves.gd: her own walk at 0.65 m/s plays at %.2f of its pace (her walk travels %.2f m/s)" % [rate, rep["walk"]])
	if mv.resolve("stalk") != "walk" or mv.resolve("lunge") != "run":
		bad("moves.gd: stalk falls back to %s, lunge to %s" % [mv.resolve("stalk"), mv.resolve("lunge")])
	say("moves.gd with nothing set: her own idle, walk and run; a walk at 0.65 m/s played at %.2f of its pace; stalk falls back to her walk" % rate)

	print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
	quit()
