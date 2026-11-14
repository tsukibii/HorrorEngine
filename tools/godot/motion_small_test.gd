## GDSMALL (tools/godot/motion_check.py small): short bodies on a person's furniture, in a by-hand Godot project,
## headless (DECISIONS 2026-11-14, short NPCs: "children npcs (really short npcs), can you figure out a way to adjust
## the animations proportionally to height"; docs/ANIMATOR_V3.md §10). A small child (1.10 m), a goblin (1.15 m) and
## an imp (0.90 m) baked by the Animator, each with the starter's Motion under it: onto a 45 cm chair and off it, onto
## a 60 cm seat (lifted the rest of the way), into a 45 cm bed and out, a door's handle a metre up; an adult beside
## them for what stays as it was. What it prints: lines "MOTION ..." and at the end "MOTION result {json}".
extends SceneTree

const S := "res://starter/"
var main: Node3D
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


func skel(h: Node3D) -> Skeleton3D:
	return h.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D


func bone_at(h: Node3D, nm: String) -> Vector3:
	var sk := skel(h)
	return sk.global_transform * sk.get_bone_global_pose(sk.find_bone(nm)).origin


## the lowest of her body's own joints (not the root, the soft bones or a chain's end)
func lowest(h: Node3D) -> Array:
	var sk := skel(h)
	var low := 99.0
	var who := ""
	for b in sk.get_bone_count():
		var nm := sk.get_bone_name(b)
		if nm == "root" or nm == "body_world" or nm.begins_with("soft_") or nm.ends_with("_null") or nm.begins_with("jiggle_"):
			continue
		var y := (sk.global_transform * sk.get_bone_global_pose(b).origin).y
		if y < low:
			low = y
			who = nm
	return [low, who]


func feet(h: Node3D) -> float:
	var lo := 99.0
	for nm in ["l_foot", "r_foot", "l_ball", "r_ball"]:
		lo = minf(lo, bone_at(h, nm).y)
	return lo


## how far any of her legs' joints is inside a box whose top is `top` and whose front edge is at `edge`, `front` the
## way out of it, `wide` across and 0.9 m deep (metres; 0: outside)
func in_box(h: Node3D, edge: Vector3, front: Vector3, top: float, wide := 0.6) -> float:
	var deep := 0.0
	var across := Vector3(front.z, 0, -front.x)
	for nm in ["l_foot", "r_foot", "l_ball", "r_ball", "l_lowleg", "r_lowleg"]:
		var p := bone_at(h, nm)
		var back := -(p - edge).dot(front)
		if absf((p - edge).dot(across)) < wide * 0.5 and back < 0.9:
			deep = maxf(deep, minf(top - p.y, back))
	return deep


func _initialize() -> void:
	create_timer(900.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
		quit())
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(5)
	var only := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = a.substr(7)
	var x := 0.0
	for who in ["child_small", "goblin", "imp", "normal_woman"]:
		if only != "" and not only.split(",").has(who):
			continue
		await one(who, x)
		x += 12.0
	print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
	quit()


func one(who: String, x0: float) -> void:
	var ps := load("res://characters/%s.glb" % who) as PackedScene
	if ps == null:
		bad("%s: the editor didn't import the baked file" % who)
		return
	var her := ps.instantiate() as Node3D
	her.name = who
	main.add_child(her)
	her.global_position = Vector3(x0, 0, 0)
	var m := Node.new()
	m.name = "Motion"
	m.set_script(load(S + "motion.gd"))
	her.add_child(m)
	await frames(6)
	var rep: Dictionary = m.report()
	var F: Dictionary = m.record.get("furniture", {})
	var small := who != "normal_woman"
	var tall := bone_at(her, "c_head").y
	if not rep["baked"] or int(m.record.get("version", 0)) < 4 or F.is_empty() or not (rep["problems"] as Array).is_empty():
		bad("%s: baked by version %s, its furniture %s, problems %s" % [who, m.record.get("version"), F, rep.get("problems")])
		return
	var seat_info: Dictionary = m.clip_info("sit_down").get("seat", {})
	var high := bool(seat_info.get("high", false))
	if high != small or absf(float(F.get("seat", 0.0)) - 0.45) > 0.001:
		bad("%s: its clips' seat is %s m, high for it: %s" % [who, F.get("seat"), high])
	var stood := feet(her)
	var dones: Array = []
	m.done.connect(func(w: String) -> void: dones.append(w))
	var evs: Array = []
	m.event.connect(func(e: String) -> void: evs.append(e))

	# ---- A. a person's chair, 45 cm: onto it, sat, off it ------------------------------------------------------------
	var edge := Vector3(x0 + 3, 0.45, 2)
	var front := Vector3(1, 0, 0)
	var seat := mark(edge, PI * 0.5)
	var deep := [0.0]
	var low := [99.0]
	var watch := func() -> void:                               # (while she gets onto it, sits and gets off: she walks to it and away through where it would stand)
		if String(m.now) in ["sit_down", "sit_loop", "stand_up"]:
			deep[0] = maxf(deep[0], in_box(her, edge, front, 0.45))
			low[0] = minf(low[0], feet(her))
	process_frame.connect(watch)
	her.global_position = Vector3(x0 + 4.6, 0, 2.6)              # (in front of the chair: nothing stands where it would be, and from behind it she'd walk through it)
	await frames(2)
	m.sit(seat)
	var sat := await until(func() -> bool: return dones.has("sit"), 16.0)
	await frames(40)
	var pel := bone_at(her, "root")
	var up := feet(her)
	if not sat or not m.seated or m.now != "sit_loop":
		bad("%s: sit: not sat (%s, %s)" % [who, m.now, dones])
	if pel.y < 0.455 or pel.y > 0.62 or pel.x > edge.x - 0.05 or absf(pel.z - edge.z) > 0.08:
		bad("%s: sat with its pelvis at %s: the seat's edge is at %s, 0.45 m up" % [who, pel, edge])
	if absf(her.global_position.y) > 0.005:
		bad("%s: on a 45 cm seat it's lifted %.3f m: its clip is made for that seat" % [who, her.global_position.y])
	if small and up < stood + 0.05:
		bad("%s: sat on a seat that's high for it with its feet %.3f m up (%.3f standing): they should hang" % [who, up, stood])
	if not small and absf(up - stood) > 0.01:
		bad("%s: an adult's feet are %.3f m up as she sits (%.3f standing)" % [who, up, stood])
	dones.clear()
	m.walk_to(Vector3(x0 + 3, 0, 4.5))
	await until(func() -> bool: return dones.has("walk"), 16.0)
	process_frame.disconnect(watch)
	if dones.find("stand") < 0 or m.seated or absf(feet(her) - stood) > 0.012 or absf(her.global_position.y) > 0.005:
		bad("%s: asked to walk while sat: %s, its feet %.3f m up" % [who, dones, feet(her)])
	if deep[0] > 0.02 or low[0] < 0.003:
		bad("%s: getting onto the chair and off it, a foot or a shin %.3f m into it, the lowest foot joint %.3f m" % [who, deep[0], low[0]])
	say("%s (%.2f m to its head): a 45 cm chair: sat with its pelvis %.2f m up, %.2f m back from the edge, its feet %s; up again and walking; no leg in the chair (%.0f mm at the most)" % [
		who, tall, pel.y, edge.x - pel.x, ("hanging %.0f cm off the floor" % ((up - stood) * 100.0)) if small else "on the floor", deep[0] * 1000.0])

	# ---- B. a seat 60 cm up: lifted the rest of the way, as far as its clip allows ------------------------------------
	var stool := mark(Vector3(x0 + 3, 0.6, 6), PI * 0.5)
	dones.clear()
	m.sit(stool)
	await until(func() -> bool: return dones.has("sit"), 16.0)
	await frames(20)
	var lifted: float = her.global_position.y
	var want := 0.15 if small else 0.12
	if absf(lifted - want) > 0.004:
		bad("%s: on a 60 cm seat it's lifted %.3f m, not %.2f" % [who, lifted, want])
	dones.clear()
	m.stand()
	await until(func() -> bool: return not m.seated and not m.busy, 12.0)
	if absf(her.global_position.y) > 0.005:
		bad("%s: stood up from the high seat %.3f m off the floor" % [who, her.global_position.y])
	say("%s: a 60 cm seat: lifted %.0f cm onto it (%s), on the floor again when it stands" % [who, lifted * 100.0, "its legs hang anyway" if small else "an adult's clip is good for 12"])

	# ---- C. a person's bed, 45 cm: asleep on it, its head by the pillow, nothing of it in the bed; awake, on its feet ---
	var bed := mark(Vector3(x0 - 3, 0.45, 2), -PI * 0.5)
	var bfront := Vector3(-1, 0, 0)
	var pillow := mark(Vector3(x0 - 3 + 0.5 * clampf(tall / 1.5, 0.5, 1.0), 0.5, 2.0 - 0.7 * clampf(tall / 1.5, 0.45, 1.0)))
	var bdeep := [0.0]
	var bwatch := func() -> void:
		if String(m.now).begins_with("lie_down") or String(m.now).begins_with("get_up"):
			bdeep[0] = maxf(bdeep[0], in_box(her, bed.global_position, bfront, 0.45, 2.4))
	process_frame.connect(bwatch)
	her.global_position = Vector3(x0 - 4.6, 0, 2.6)              # (in front of the bed)
	await frames(2)
	dones.clear()
	m.sleep(bed, pillow)
	var slept := await until(func() -> bool: return dones.has("sleep"), 24.0)
	await frames(30)
	var head := bone_at(her, "c_head")
	var pv := bone_at(her, "root")
	var lo := lowest(her)
	var off := Vector2(head.x - pillow.global_position.x, head.z - pillow.global_position.z).length()
	if not slept or not m.asleep:
		bad("%s: sleep: not asleep (%s, %s)" % [who, m.now, dones])
	if off > 0.25 or pv.y < 0.45 or pv.y > 0.7 or float(lo[0]) < 0.445:
		bad("%s: asleep with its head %.2f m from the pillow, its pelvis %.2f m up, its lowest joint %.3f m up (%s): the bed's top is at 0.45" % [who, off, pv.y, lo[0], lo[1]])
	dones.clear()
	m.wake()
	var woke := await until(func() -> bool: return dones.has("wake"), 16.0)
	process_frame.disconnect(bwatch)
	if not woke or m.asleep or bone_at(her, "c_head").y < 0.8 * tall or absf(her.global_position.y) > 0.005:
		bad("%s: wake: %s, its head %.2f m up" % [who, dones, bone_at(her, "c_head").y])
	if bdeep[0] > 0.02:
		bad("%s: getting into bed and out, a foot or a shin %.3f m into the bed" % [who, bdeep[0]])
	say("%s: a 45 cm bed: asleep with its head %.2f m from the pillow, its pelvis %.2f m up, its lowest joint %.1f cm over the bed (%s); awake and on its feet; no leg in the bed (%.0f mm)" % [who, off, pv.y, (float(lo[0]) - 0.45) * 100.0, lo[1], bdeep[0] * 1000.0])

	# ---- D. a door: its hand on the handle where the handle is ---------------------------------------------------------
	var door := Node3D.new()
	var ds := GDScript.new()
	ds.source_code = "extends Node3D\nvar used := 0\nfunc use(_b: Node = null) -> void:\n\tused += 1\n"
	ds.reload()
	door.set_script(ds)
	main.add_child(door)
	var made_for := float(F.get("handle", 1.0))
	var said: Array = []
	var k := 0
	for hy: float in ([made_for, 1.0] if absf(made_for - 1.0) > 0.01 else [1.0, 1.04]):
		var handle := mark(Vector3(x0, hy, -3.0 - 2.0 * k), PI)
		k += 1
		dones.clear()
		evs.clear()
		var got := {"err": 9.0, "moved": 0.0, "wrist": 9.0}
		var on_grab := func(e: String) -> void:
			if e == "grab":
				var ik: Node = m.hand_ik()
				if ik != null and ik.last.has("r"):
					got["err"] = float(ik.last["r"]["error"])
					got["moved"] = float(ik.last["r"].get("moved", 0.0))
				got["wrist"] = bone_at(her, "r_wrist").distance_to(handle.global_position)
		m.event.connect(on_grab)
		var used0: int = door.used
		m.open(handle, door, "push")
		await until(func() -> bool: return dones.has("open"), 16.0)
		m.event.disconnect(on_grab)
		if door.used != used0 + 1 or evs.find("grab") < 0 or evs.find("open") < evs.find("grab") or evs.find("release") < evs.find("open"):
			bad("%s: a door's handle %.2f m up: use() called %d times, its moments %s" % [who, hy, door.used - used0, evs])
		var reach_it: bool = hy <= made_for + 0.05                       # (higher than its clip was made for by more than its arm has left: it does what it can)
		if reach_it and float(got["err"]) > 0.02:
			bad("%s: a handle %.2f m up (its clip is made for %.2f): its hand ends %.3f m from it as it takes hold" % [who, hy, made_for, got["err"]])
		if float(got["wrist"]) > (0.14 if reach_it else 0.3):
			bad("%s: a handle %.2f m up: its wrist is %.2f m from it as it takes hold" % [who, hy, got["wrist"]])
		if feet(her) < 0.003:
			bad("%s: at the door a foot joint is %.3f m up" % [who, feet(her)])
		said.append("%.2f m: its hand %.1f cm from it as it takes hold, carried %.1f cm by the hand's IK" % [hy, float(got["err"]) * 100.0, float(got["moved"]) * 100.0])
	say("%s: a door, its clip made for a handle %.2f m up. %s" % [who, made_for, "; ".join(said)])
	notes[who] = {"tall": snappedf(tall, 0.01), "furniture": F}
	her.queue_free()
	await frames(3)
