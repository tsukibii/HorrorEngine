## GDLIFE (tools/godot/motion_check.py life): life and carrying (docs/ANIMATOR_V3.md §11, §12) in a by-hand Godot
## project, headless: a character baked by the Animator with the starter's motion.gd under her and the look plugin's
## HSGesture, HSHandIK, HSHeadTrack and HSGrip. A flourish laid over standing, walking and sitting; her legs and her
## pelvis the clip's own; a hand that touches her kept on her while her head follows the player; small movements by
## themselves; a thing carried standing, walking, sitting and sneaking. Prints "MOTION ..." lines and at the end
## "MOTION result {json}".
## A bone as her animation left it is read off the skeleton; as the modifiers left it, off a BoneAttachment3D: a
## skeleton rolls its modifiers' work back after each frame, and an attachment is where it shows.
extends SceneTree

const S := "res://starter/"
const LOOK := "res://addons/horrorstudio_look/"
var main: Node3D
var her: Node3D
var m: Node
var g: Node
var sk: Skeleton3D
var ap: AnimationPlayer
var player: Node3D
var cam: Camera3D
var errors: Array = []
var notes := {}
var only: Array = []
var atts := {}
var ticks := 0
var began: Array = []
var ended: Array = []


func say(t: String) -> void:
	print("MOTION " + t)


func bad(t: String) -> void:
	errors.append(t)
	print("MOTION !! " + t)


func frames(n: int) -> void:
	for i in n:
		await physics_frame
		ticks += 1


func until(cond: Callable, secs: float) -> bool:
	for i in int(secs * 60.0):
		if cond.call():
			return true
		await physics_frame
		ticks += 1
	return cond.call()


func att(nm: String) -> BoneAttachment3D:
	if not atts.has(nm):
		var a := BoneAttachment3D.new()
		a.name = "_Probe_" + nm
		sk.add_child(a)
		a.bone_name = nm
		atts[nm] = a
	return atts[nm]


# how far the modifiers have left a bone from where her animation has it: [metres, degrees]
func off(nm: String) -> Array:
	var a := att(nm).transform
	var b := sk.get_bone_global_pose(sk.find_bone(nm))
	return [a.origin.distance_to(b.origin), rad_to_deg(a.basis.get_rotation_quaternion().angle_to(b.basis.get_rotation_quaternion()))]


const LOWER := ["root", "l_upleg", "l_lowleg", "l_foot", "l_ball", "r_upleg", "r_lowleg", "r_foot", "r_ball"]
const ARM_L := ["l_uparm", "l_lowarm", "l_wrist", "l_index1"]
const ARM_R := ["r_uparm", "r_lowarm", "r_wrist", "r_index1"]

# how far the modifiers have left a bone from where her animation has it, as her chest carries it: metres. (A flourish
# may turn her chest a degree or two: her other arm hangs from it and goes with it; what mustn't change is the arm itself)
func off_in_chest(nm: String) -> float:
	var c := sk.find_bone("c_spine3")
	var a := att("c_spine3").transform.affine_inverse() * att(nm).transform.origin
	var b := sk.get_bone_global_pose(c).affine_inverse() * sk.get_bone_global_pose(sk.find_bone(nm)).origin
	return a.distance_to(b)


func most_off(names: Array) -> Array:
	var d := 0.0
	var a := 0.0
	for n in names:
		var o := off(n)
		d = maxf(d, float(o[0]))
		a = maxf(a, float(o[1]))
	return [d, a]


func probe_all() -> void:
	for n in LOWER + ARM_L + ARM_R + ["c_head", "c_neck", "c_spine3", "r_middle3", "r_clavicle", "l_clavicle"]:
		att(n)


func place_player(deg: float, dist := 2.5, eye := 1.6) -> void:
	var a := deg_to_rad(deg) + her.global_rotation.y
	player.global_position = her.global_position + Vector3(sin(a), 0, cos(a)) * dist
	cam.position = Vector3(0, eye, 0)


func mark(at: Vector3, yaw := 0.0) -> Marker3D:
	var k := Marker3D.new()
	main.add_child(k)
	k.global_position = at
	k.global_rotation.y = yaw
	return k


func prop(nm: String, mesh: Mesh, at: Vector3, grip := {}) -> MeshInstance3D:
	var p := MeshInstance3D.new()
	p.name = nm
	p.mesh = mesh
	main.add_child(p)
	p.global_position = at
	if not grip.is_empty():
		var gr: Node3D = load(LOOK + "grip.gd").new()
		gr.name = "Grip"
		p.add_child(gr)
		for k in grip:
			gr.set(k, grip[k])
	return p


func slab(at: Vector3, size: Vector3) -> StaticBody3D:          # something to stand a thing on (she doesn't bump into it)
	var b := StaticBody3D.new()
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	b.add_child(mi)
	b.collision_layer = 0
	main.add_child(b)
	b.global_position = at
	return b


func reset_her(at := Vector3.ZERO, yaw := 0.0) -> void:
	if is_instance_valid(m.held()):
		m.drop()
	m.stop()
	m.stance = ""
	m.seated = false
	m.asleep = false
	g.alive = false
	if String(g.now) != "":
		g.stop(0.01)
	her.visible = true
	her.global_position = at
	her.global_rotation.y = yaw
	m.head_follow(false)
	m.idle()
	began.clear()
	ended.clear()
	await frames(30)


func wants(stage: String) -> bool:
	return only.is_empty() or only.has(stage)


func tilt_of(thing: Node3D) -> float:                  # how far a thing leans from the way up it stands, degrees
	return rad_to_deg(thing.global_basis.orthonormalized().y.angle_to(Vector3.UP))


func in_chest(p: Vector3) -> Vector3:                  # a place in the world, as her chest carries it
	return att("c_spine3").global_transform.affine_inverse() * p


func _initialize() -> void:
	create_timer(900.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
		quit())
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = Array(a.trim_prefix("--only=").split(","))
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(5)
	var ps := load("res://characters/normal_woman.glb") as PackedScene
	if ps == null or not ResourceLoader.exists(LOOK + "gesture.gd"):
		bad("the baked character wasn't imported, or the look plugin has no gesture.gd")
		print("MOTION result " + JSON.stringify({"errors": errors}))
		quit()
		return
	her = ps.instantiate() as Node3D
	her.name = "Her"
	main.add_child(her)
	sk = her.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	ap = her.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer
	m = Node.new()
	m.name = "Motion"
	m.set_script(load(S + "motion.gd"))
	her.add_child(m)
	player = Node3D.new()
	player.name = "Player"
	player.add_to_group("hs_player")
	main.add_child(player)
	cam = Camera3D.new()
	player.add_child(cam)
	cam.current = true
	place_player(0.0)
	await frames(8)
	g = m.gesture()
	if g == null:
		bad("Motion gave no HSGesture")
		print("MOTION result " + JSON.stringify({"errors": errors}))
		quit()
		return
	g.started.connect(func(n: String) -> void: began.append(n))
	g.finished.connect(func(n: String) -> void: ended.append(n))
	probe_all()
	await frames(4)

	if wants("layer"):
		await stage_layer()
	if wants("stand"):
		await stage_stand()
	if wants("walk"):
		await stage_walk()
	if wants("sit"):
		await stage_sit()
	if wants("follow"):
		await stage_follow()
	if wants("alive"):
		await stage_alive()
	if wants("carry"):
		await stage_carry()
	if wants("acts"):
		await stage_acts()
	if wants("goblin"):
		await stage_goblin()

	print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
	quit()


# ---- what she has, and where the layer sits ----------------------------------------------------------------------------------
func stage_layer() -> void:
	var ver := int(m.record.get("version", 0))
	var fl: Array = g.flourishes()
	var carry := 0
	for n in (m.record.get("clips", {}) as Dictionary):
		if String(n).begins_with("carry_"):
			carry += 1
	if ver < 5 or fl.size() != 33 or carry != 10:
		bad("her bake: version %d, %d flourishes, %d carry poses (5, 33 and 10 expected)" % [ver, fl.size(), carry])
	var mods := []
	for c in sk.get_children():
		if c is SkeletonModifier3D:
			mods.append(c.name)
	if mods.is_empty() or String(mods[0]) != "HSGesture" or not ("HSHandIK" in mods):
		bad("the layer isn't the first of her skeleton's modifiers, or her hands' IK isn't there: %s" % [mods])
	# nothing playing, nothing carried: she is her clip
	await frames(20)
	var lo := most_off(LOWER + ARM_L + ARM_R + ["c_head"])
	if float(lo[0]) > 1e-4 or float(lo[1]) > 0.1:              # (two float32 turns that are the same still read 0.04 degrees apart)
		bad("with nothing playing the layer still moves her: %.1f mm, %.2f degrees" % [float(lo[0]) * 1000.0, float(lo[1])])
	var meta: Dictionary = g.life_of("life_scratch_head")
	if String(meta.get("hand", "")) != "r" or String((meta.get("touch", {}) as Dictionary).get("bone", "")) != "c_head":
		bad("life_scratch_head's record: %s" % [meta])
	say("baked by version %d: %d flourishes and %d carry poses; her skeleton's modifiers in order: %s" % [ver, fl.size(), carry, ", ".join(mods)])


# one flourish played to its end over whatever she's doing; -> what was measured
func run_one(name: String, o := {}) -> Dictionary:
	var out := {"played": false}
	var okay: bool = g.play(name, o)
	if not okay:
		return out
	out["played"] = true
	var n := String(g.now)
	var meta: Dictionary = g.life_of(n)
	var side := String(meta.get("hand", ""))
	var touch: Dictionary = meta.get("touch", {})
	var ik: Node = m.hand_ik()
	var lower := 0.0
	var lower_deg := 0.0
	var other := 0.0
	var err := 0.0
	var moved := 0.0
	var arm := 0.0
	var head := 0.0
	var samples := 0
	var free_arm: Array = ARM_L if side == "r" else (ARM_R if side == "l" else [])
	var own_arm: Array = ARM_R if side == "r" else (ARM_L if side == "l" else [])
	var guard := 0
	while String(g.now) == n and guard < 900:
		await frames(1)
		guard += 1
		if String(g.now) != n:
			break
		var lo := most_off(LOWER)
		lower = maxf(lower, float(lo[0]))
		lower_deg = maxf(lower_deg, float(lo[1]))
		for fa in free_arm:
			other = maxf(other, off_in_chest(fa))
		if not own_arm.is_empty():
			arm = maxf(arm, float(off(own_arm[2])[0]))
		head = maxf(head, float(off("c_head")[1]))
		var t := float(g.t)
		if not touch.is_empty() and t > float(touch["from"]) + 0.05 and t < float(touch["to"]) - 0.05 and ik.last.has(side):
			err = maxf(err, float(ik.last[side]["error"]))
			moved = maxf(moved, float(ik.last[side]["moved"]))
			samples += 1
	out.merge({"name": n, "lower": lower, "lower_deg": lower_deg, "other": other, "err": err, "moved": moved, "arm": arm, "head": head, "samples": samples, "touch": not touch.is_empty(), "frames": guard})
	await frames(4)
	out["after"] = float(most_off(ARM_L + ARM_R + ["c_head"])[0])
	return out


# ---- standing: every flourish she has, one after another ---------------------------------------------------------------------
func stage_stand() -> void:
	await reset_her()
	var worst_lower := 0.0
	var worst_err := 0.0
	var worst_after := 0.0
	var least_arm := 9.0
	var done := 0
	var where := ""
	for n in g.flourishes():
		if String(n).ends_with("_l") and String(n) != "life_scratch_head_l":       # (the left hand's are the right's in a mirror: one of them is enough here)
			continue
		var r: Dictionary = await run_one(n, {"force": true})
		if not bool(r["played"]):
			bad("standing, %s wouldn't play" % n)
			continue
		done += 1
		worst_lower = maxf(worst_lower, float(r["lower"]))
		worst_after = maxf(worst_after, float(r["after"]))
		if bool(r["touch"]):
			if int(r["samples"]) < 5:
				bad("%s: the hand's IK never ran while it touches her" % n)
			if float(r["err"]) > worst_err:
				worst_err = float(r["err"])
				where = n
		var meta: Dictionary = g.life_of(n)
		if String(meta.get("hand", "")) in ["l", "r"]:
			least_arm = minf(least_arm, float(r["arm"]))
	if worst_lower > 1e-4:
		bad("standing, a flourish moved her pelvis or her legs %.2f mm" % (worst_lower * 1000.0))
	if worst_err > 0.012:
		bad("standing, a hand that touches her ends %.1f cm from where it touches (%s)" % [worst_err * 100.0, where])
	if least_arm < 0.08:
		bad("a flourish that takes her arm moved its wrist only %.1f cm" % (least_arm * 100.0))
	if worst_after > 1e-4:
		bad("after a flourish she isn't her clip again: %.2f mm off" % (worst_after * 1000.0))
	if began.size() != done or ended.size() != done:
		bad("%d flourishes played, %d started and %d finished signalled" % [done, began.size(), ended.size()])
	notes["stand"] = {"done": done, "err_mm": worst_err * 1000.0}
	say("standing: %d flourishes played to their ends, her pelvis and legs her idle's to %.2f mm; a hand that touches her %.1f mm from where it touches at the most (%s); after each she is her clip again" % [done, worst_lower * 1000.0, worst_err * 1000.0, where.trim_prefix("life_")])


# ---- walking: the walk goes on under it ---------------------------------------------------------------------------------------
func stage_walk() -> void:
	await reset_her(Vector3(0, 0, -6))
	m.walk_to(Vector3(0, 0, 14))
	await until(func() -> bool: return String(m.now) == "walk", 2.0)
	await frames(40)
	var from := her.global_position
	var t0 := ticks
	var r: Dictionary = await run_one("scratch_head")
	var speed := from.distance_to(her.global_position) / (float(ticks - t0) / 60.0)
	if not bool(r["played"]):
		bad("walking, scratch_head wouldn't play (she's doing '%s')" % g.what_doing())
		return
	if float(r["lower"]) > 1e-4 or float(r["other"]) > 1e-4:
		bad("walking, the flourish moved her legs %.2f mm or her other arm %.2f mm" % [float(r["lower"]) * 1000.0, float(r["other"]) * 1000.0])
	if float(r["err"]) > 0.015:
		bad("walking, her hand ends %.1f cm from her head" % (float(r["err"]) * 100.0))
	if absf(speed - float(m.speed_of(false))) > 0.12:
		bad("with a flourish laid over it her walk goes at %.2f m/s, not its own %.2f" % [speed, float(m.speed_of(false))])
	if String(m.now) != "walk":
		bad("the flourish stopped her walk: she's '%s'" % m.now)
	# one made for standing only isn't laid over a walk
	if g.play("hand_hip"):
		bad("a hand on her hip was laid over a walk: it's made for standing")
		g.stop(0.01)
	var r2: Dictionary = await run_one("look_hand")
	if not bool(r2["played"]) or float(r2["head"]) < 15.0:
		bad("walking, look_hand: played %s, her head turned %.0f degrees from her walk's" % [r2["played"], float(r2.get("head", 0.0))])
	notes["walk"] = {"err_mm": float(r["err"]) * 1000.0, "moved_mm": float(r["moved"]) * 1000.0, "speed": speed}
	say("walking: scratch_head laid over her walk at %.2f m/s: her legs and her other arm the walk's to %.2f mm, her hand %.1f mm from her head at the most (carried %.0f mm there by its IK); look_hand turns her head %.0f degrees; a hand on her hip isn't offered" % [
		speed, maxf(float(r["lower"]), float(r["other"])) * 1000.0, float(r["err"]) * 1000.0, float(r["moved"]) * 1000.0, float(r2["head"])])
	m.stop()


# ---- sitting ----------------------------------------------------------------------------------------------------------------
func stage_sit() -> void:
	await reset_her(Vector3(4, 0, 0))
	var seat := mark(Vector3(4, 0.45, 1.2), PI)
	m.sit(seat)
	await until(func() -> bool: return bool(m.seated) and not bool(m.busy), 12.0)
	await frames(30)
	if g.what_doing() != "sit":
		bad("sat, the layer thinks she's '%s'" % g.what_doing())
	var worst := 0.0
	var werr := 0.0
	var done := 0
	for n in ["scratch_head", "look_hand", "rub_neck", "stretch", "chin", "scratch_belly"]:
		var r: Dictionary = await run_one(n)
		if not bool(r["played"]):
			bad("sat, %s wouldn't play" % n)
			continue
		done += 1
		worst = maxf(worst, float(r["lower"]))
		werr = maxf(werr, float(r["err"]))
	if worst > 1e-4:
		bad("sat, a flourish moved her pelvis or her legs %.2f mm" % (worst * 1000.0))
	if werr > 0.015:
		bad("sat, a hand that touches her ends %.1f cm from where it touches" % (werr * 100.0))
	if g.play("hand_hip"):
		bad("a hand on her hip was laid over sitting")
		g.stop(0.01)
	notes["sit"] = {"err_mm": werr * 1000.0}
	say("sitting: %d flourishes laid over her seat, her pelvis and legs the seat's to %.2f mm, a hand that touches her %.1f mm off at the most" % [done, worst * 1000.0, werr * 1000.0])
	m.stand()
	await until(func() -> bool: return not bool(m.seated) and not bool(m.busy), 8.0)
	seat.queue_free()


# ---- her head follows you, and her hand is still on it ------------------------------------------------------------------------
func stage_follow() -> void:
	await reset_her()
	var head := att("c_head")
	var yaw := func() -> float:
		var l := her.global_basis.inverse() * head.global_basis.z
		return rad_to_deg(atan2(l.x, l.z))
	var track: Node = m.head_follow(true, player)
	place_player(55.0)
	await frames(90)
	var turned: float = yaw.call()
	if absf(turned - 55.0) > 8.0:
		bad("her head isn't on you before the flourish: turned %.0f degrees" % turned)
	var r: Dictionary = await run_one("scratch_head")
	if not bool(r["played"]):
		bad("following you, scratch_head wouldn't play")
		return
	if float(r["err"]) > 0.015:
		bad("with her head turned %.0f degrees to follow you her hand ends %.1f cm from it" % [turned, float(r["err"]) * 100.0])
	if float(r["moved"]) < 0.03:
		bad("with her head turned %.0f degrees the hand's IK carried her hand only %.1f cm: it can't have had to" % [turned, float(r["moved"]) * 100.0])
	var during: float = yaw.call()
	# a look: her head leaves you for her hand, and comes back
	g.play("look_hand")
	var least := 999.0
	var held := 0.0
	while String(g.now) != "":
		await frames(1)
		least = minf(least, absf(float(yaw.call())))
		held = maxf(held, float(track.hold_off))
	await frames(70)
	var back: float = yaw.call()
	if held < 0.9 or least > 25.0:
		bad("looking at her hand, her head's follower was held off %.2f and her head came within %.0f degrees of straight ahead" % [held, least])
	if absf(back - 55.0) > 8.0 or float(track.hold_off) > 0.001:
		bad("after the look her head isn't back on you: %.0f degrees, held off %.2f" % [back, float(track.hold_off)])
	notes["follow"] = {"err_mm": float(r["err"]) * 1000.0, "moved_mm": float(r["moved"]) * 1000.0}
	say("her head turned %.0f degrees to follow you: scratching it, her hand ends %.1f mm from it (its IK carried it %.0f mm: the blend alone would have left it in the air); looking at her hand her head leaves you (to %.0f degrees) and is back on you after (%.0f)" % [
		turned, float(r["err"]) * 1000.0, float(r["moved"]) * 1000.0, least, back])
	m.head_follow(false)


# ---- by themselves ------------------------------------------------------------------------------------------------------------
func stage_alive() -> void:
	await reset_her(Vector3(-4, 0, 0))
	began.clear()
	m.life_every = Vector2(0.3, 0.7)
	m.alive_now(true)
	await frames(60 * 40)
	var n1 := began.size()
	var twice := 0
	for i in range(1, began.size()):
		if String(began[i]).trim_suffix("_l") == String(began[i - 1]).trim_suffix("_l"):
			twice += 1
	var kinds := {}
	for b in began:
		kinds[String(b).trim_suffix("_l")] = true
	if n1 < 8 or twice > 0 or kinds.size() < 6:
		bad("alive for 40 s standing: %d flourishes, %d of them the one before again, %d different ones" % [n1, twice, kinds.size()])
	# an act has her: none starts; then they go on
	began.clear()
	var door := mark(Vector3(-4, 1.0, 3.0), 0.0)
	m.open(door)
	await until(func() -> bool: return String(m.now).begins_with("open"), 8.0)
	var during := 0
	while String(m.now).begins_with("open"):
		await frames(1)
		if String(g.now) != "":
			during += 1
	if during > 12:                                         # (one that was already playing is let go over a few frames)
		bad("a flourish played for %d frames while she opened a door" % during)
	await until(func() -> bool: return not bool(m.busy), 6.0)
	began.clear()
	await frames(60 * 8)
	if began.is_empty():
		bad("after the door she did no more flourishes")
	# walking: only ones made for it
	began.clear()
	m.walk_to(her.global_position + Vector3(0, 0, 12))
	await until(func() -> bool: return String(m.now) == "walk", 2.0)
	await frames(60 * 7)
	var wrong := []
	for b in began:
		if not ("walk" in (g.life_of(b).get("over", []) as Array)):
			wrong.append(b)
	if began.is_empty() or not wrong.is_empty():
		bad("alive while walking: %d flourishes, not made for a walk: %s" % [began.size(), wrong])
	var walking := began.size()
	m.stop()
	m.alive_now(false)
	await until(func() -> bool: return String(g.now) == "", 6.0)
	began.clear()
	await frames(60 * 4)
	if not began.is_empty():
		bad("switched off, she still did %d" % began.size())
	notes["alive"] = {"standing": n1, "kinds": kinds.size(), "walking": walking}
	say("alive: %d flourishes in 40 s standing (%d different ones, never the one before again), none while she opens a door, %d in 7 s of walking and all made for it; switched off, none" % [n1, kinds.size(), walking])
	door.queue_free()


# ---- a thing carried ----------------------------------------------------------------------------------------------------------
func stage_carry() -> void:
	await reset_her(Vector3(8, 0, 0))
	# a cup: drunk from, so carried in front of her and kept upright
	var table := slab(Vector3(8, 0.84, 1.3), Vector3(0.6, 0.04, 0.5))
	var cm := CylinderMesh.new()
	cm.top_radius = 0.034
	cm.bottom_radius = 0.03
	cm.height = 0.1
	var cup := prop("Cup", cm, Vector3(8, 0.86 + 0.05, 1.3), {"shape": 0, "size": 0.066, "length": 0.09, "use": 2, "mouth": Vector3(0, 0.05, 0.03)})
	m.pick_up(cup, true)
	await until(func() -> bool: return not bool(m.busy), 14.0)
	await frames(70)
	if m.held() != cup or String(g.carrying("r")) != "front":
		bad("the cup kept: held %s, carried '%s' (in front of her expected: it's drunk from)" % [m.held(), g.carrying("r")])
		return
	var wrist := att("r_wrist")
	var elbow := att("r_lowarm")
	var shoulder := att("r_uparm")
	var ahead := (her.global_basis.inverse() * (wrist.global_position - shoulder.global_position)).z
	var level := wrist.global_position.y - elbow.global_position.y
	var stood := tilt_of(cup)
	if ahead < 0.1 or absf(level) > 0.08 or stood > 6.0:
		bad("standing with the cup: her wrist %.0f cm ahead of her shoulder, %.0f cm over her elbow, the cup leaning %.1f degrees" % [ahead * 100.0, level * 100.0, stood])
	if float(most_off(LOWER)[0]) > 1e-4:
		bad("carrying moves her legs")
	# walking with it: it stays level and doesn't swing with her arm; her other hand swings as it always did
	m.walk_to(her.global_position + Vector3(0, 0, 9))
	await until(func() -> bool: return String(m.now) == "walk", 2.0)
	await frames(40)
	var lean := 0.0
	var lo := Vector3(9, 9, 9)
	var hi := Vector3(-9, -9, -9)
	var lo2 := Vector3(9, 9, 9)
	var hi2 := Vector3(-9, -9, -9)
	for i in 150:
		await frames(1)
		lean = maxf(lean, tilt_of(cup))
		var p := in_chest(wrist.global_position)
		var p2 := in_chest(att("l_wrist").global_position)
		lo = lo.min(p)
		hi = hi.max(p)
		lo2 = lo2.min(p2)
		hi2 = hi2.max(p2)
	var swing := (hi - lo).length()
	var swing2 := (hi2 - lo2).length()
	if lean > 8.0 or swing > 0.06 or swing2 < 0.12:
		bad("walking with the cup: it leans up to %.1f degrees, the hand that holds it travels %.1f cm against her chest and her other hand %.1f cm" % [lean, swing * 100.0, swing2 * 100.0])
	m.stop()
	await frames(30)
	# sitting with it: still in front of her, clear of her thighs
	var seat := mark(her.global_position + Vector3(0, 0.45, 1.2), PI)
	m.sit(seat)
	await until(func() -> bool: return bool(m.seated) and not bool(m.busy), 12.0)
	await frames(80)
	var knee := att("r_lowleg").global_position
	var hip := att("r_upleg").global_position
	var bottom := cup.global_position - cup.global_basis.orthonormalized().y * 0.05
	var thigh_y := lerpf(hip.y, knee.y, clampf((her.global_basis.inverse() * (bottom - hip)).z / maxf(0.05, (her.global_basis.inverse() * (knee - hip)).z), 0.0, 1.0))
	var sat_tilt := tilt_of(cup)
	if String(g.carrying("r")) != "front" or sat_tilt > 8.0 or bottom.y < thigh_y + 0.05:
		bad("sat with the cup: carried '%s', leaning %.1f degrees, its foot %.1f cm over her thigh's bone" % [g.carrying("r"), sat_tilt, (bottom.y - thigh_y) * 100.0])
	var over_thigh := bottom.y - thigh_y
	# a look at it while she sits: a flourish from the carry pose and back to it
	var r: Dictionary = await run_one("look_hand")
	if not bool(r["played"]) or float(r["head"]) < 15.0:
		bad("sat with the cup, look_hand: played %s, her head turned %.0f degrees" % [r["played"], float(r.get("head", 0.0))])
	await frames(40)
	if tilt_of(cup) > 8.0:
		bad("after looking at it the cup leans %.1f degrees" % tilt_of(cup))
	m.stand()
	await until(func() -> bool: return not bool(m.seated) and not bool(m.busy), 8.0)
	# drinking from it: the carry gives her hand to the sip, and takes it back
	m.drink()
	var ik: Node = m.hand_ik()
	var sip := 9.0
	var let_go := 1.0
	await until(func() -> bool: return String(m.now) == "drink", 2.0)
	while String(m.now) == "drink":
		await frames(1)
		if ik.last.has("r") and float(ik.last["r"]["weight"]) > 0.95:
			sip = minf(sip, float(ik.last["r"]["error"]))
		let_go = minf(let_go, float(g.report()["carries"].get("r", {"hold": 1.0})["hold"]))
	await frames(70)
	if sip > 0.02 or let_go > 0.2 or String(g.carrying("r")) != "front" or tilt_of(cup) > 8.0:
		bad("drinking from the carried cup: its rim %.1f cm from her lips, the carry let go to %.2f, after it carried '%s' leaning %.1f degrees" % [sip * 100.0, let_go, g.carrying("r"), tilt_of(cup)])
	m.drop()
	await frames(40)
	if String(g.carrying("r")) != "" or float(most_off(ARM_R)[0]) > 1e-4:
		bad("dropped, her arm isn't her clip's again: carried '%s', %.1f mm off" % [g.carrying("r"), float(most_off(ARM_R)[0]) * 1000.0])
	cup.queue_free()
	# a bottle with nothing said: at her side; a share of her walk's swing kept; in front of her when she sits; hanging by gravity when she sneaks
	var bm := CylinderMesh.new()
	bm.top_radius = 0.016
	bm.bottom_radius = 0.034
	bm.height = 0.26
	var bottle := prop("Bottle", bm, her.global_position + Vector3(0.4, 1.0, 0), {"shape": 0, "size": 0.05, "length": 0.2})
	m.hold(bottle)
	await frames(60)
	if String(g.carrying("r")) != "side" or wrist.global_position.y > elbow.global_position.y:
		bad("a bottle put in her hand: carried '%s', her wrist %.0f cm over her elbow" % [g.carrying("r"), (wrist.global_position.y - elbow.global_position.y) * 100.0])
	m.walk_to(her.global_position + Vector3(0, 0, 8))
	await until(func() -> bool: return String(m.now) == "walk", 2.0)
	await frames(40)
	lo = Vector3(9, 9, 9)
	hi = Vector3(-9, -9, -9)
	lo2 = Vector3(9, 9, 9)
	hi2 = Vector3(-9, -9, -9)
	for i in 150:
		await frames(1)
		var p := in_chest(wrist.global_position)
		var p2 := in_chest(att("l_wrist").global_position)
		lo = lo.min(p)
		hi = hi.max(p)
		lo2 = lo2.min(p2)
		hi2 = hi2.max(p2)
	var side_swing := (hi - lo).length()
	var free_swing := (hi2 - lo2).length()
	if side_swing > 0.75 * free_swing or side_swing < 0.1 * free_swing:
		bad("walking with a bottle at her side: that hand travels %.1f cm against her chest, her free hand %.1f: a share of the swing is kept, not all of it and not none" % [side_swing * 100.0, free_swing * 100.0])
	m.stop()
	await frames(20)
	m.sneak_to(her.global_position + Vector3(0, 0, 3))
	await until(func() -> bool: return String(m.now) == "sneak", 3.0)
	await frames(60)
	var chest_lean := rad_to_deg(att("c_spine3").global_basis.orthonormalized().y.angle_to(Vector3.UP))
	var corrected := float((g.last.get("plumb", {}) as Dictionary).get("r", 0.0))
	var hang := rad_to_deg((wrist.global_position - shoulder.global_position).normalized().angle_to(Vector3.DOWN))
	if chest_lean < 10.0 or corrected < 0.5 * chest_lean or hang > 30.0:
		bad("sneaking with a bottle at her side: her chest leans %.0f degrees, her arm was hung back %.0f, it hangs %.0f degrees off straight down" % [chest_lean, corrected, hang])
	m.stop()
	m.rise()
	await until(func() -> bool: return not bool(m.busy), 5.0)
	m.sit(seat)
	await until(func() -> bool: return bool(m.seated) and not bool(m.busy), 12.0)
	await frames(60)
	var shown := String(g.report()["carries"].get("r", {}).get("shown", ""))
	if shown != "front":
		bad("sat with a bottle that's carried at her side: shown '%s' (in front of her expected)" % shown)
	m.stand()
	await until(func() -> bool: return not bool(m.seated) and not bool(m.busy), 8.0)
	await frames(60)
	var shown2 := String(g.report()["carries"].get("r", {}).get("shown", ""))
	if shown2 != "side":
		bad("stood again, the bottle is carried '%s'" % shown2)
	# alive with a thing in her right hand: never a flourish that wants that hand empty
	began.clear()
	m.life_every = Vector2(0.3, 0.6)
	m.alive_now(true)
	await frames(60 * 25)
	m.alive_now(false)
	var took := []
	var looked := 0
	for b in began:
		var meta: Dictionary = g.life_of(b)
		if String(meta.get("hand", "")) in ["r", "both"] and bool(meta.get("free", true)):
			took.append(b)
		if String(b) == "life_look_hand":
			looked += 1
	await until(func() -> bool: return String(g.now) == "", 6.0)
	# (what she'd pick, asked many times over: a look at what she holds comes up often, a flourish for the hand that holds it never)
	var picks := {}
	var empty := 0
	g.set("_last_pick", "")                                 # (the one she did last is never picked again straight after: not what's counted here)
	for i in 400:
		var pk := String(g.pick())
		picks[pk] = int(picks.get(pk, 0)) + 1
		var pm: Dictionary = g.life_of(pk)
		if String(pm.get("hand", "")) in ["r", "both"] and bool(pm.get("free", true)):
			empty += 1
	looked = int(picks.get("life_look_hand", 0))
	if began.size() < 5 or not took.is_empty() or empty > 0 or looked < 40:
		bad("alive with a bottle in her right hand: %d flourishes, ones that want that hand empty: %s; of 400 picks %d want it empty and %d are looks at what she holds" % [began.size(), took, empty, looked])
	# the other ways of carrying: each holds her hand where it says
	var where := {}
	for how in ["chest", "shoulder", "raised", "front", "side"]:
		m.carry(how)
		await frames(50)
		where[how] = her.global_basis.inverse() * (wrist.global_position - shoulder.global_position)
	if not ((where["raised"] as Vector3).y > 0.0 and (where["raised"] as Vector3).z > 0.12 and (where["shoulder"] as Vector3).length() < 0.24 and absf(((where["chest"] as Vector3) + her.global_basis.inverse() * (shoulder.global_position - att("c_spine3").global_position)).x) < 0.14 and (where["side"] as Vector3).y < -0.3):
		bad("the ways of carrying, her wrist from her shoulder: %s" % [where])
	notes["carry"] = {"lean": lean, "swing_cm": swing * 100.0, "free_cm": swing2 * 100.0, "side_cm": side_swing * 100.0, "over_thigh_cm": over_thigh * 100.0, "sip_cm": sip * 100.0}
	say("carrying: a cup picked up and kept is carried in front of her, leaning %.1f degrees standing and %.1f at the most walking, the hand that holds it travelling %.1f cm against her chest where her other hand swings %.1f; sat, its foot %.1f cm over her thigh; a look at it and back; a sip from it %.1f cm from her lips with the carry let go, and carried again after" % [
		stood, lean, swing * 100.0, swing2 * 100.0, over_thigh * 100.0, sip * 100.0])
	say("a bottle put in her hand is carried at her side with %.0f%% of her walk's swing; sneaking (her chest %.0f degrees over) the arm is hung back %.0f and hangs %.0f off straight down; sat it's carried in front of her, stood at her side again; alive with it: %d flourishes and none with the hand that holds it, a look at it %d times in 400 picks; chest, shoulder, raised: each where it says" % [
		100.0 * side_swing / maxf(0.001, free_swing), chest_lean, corrected, hang, began.size(), looked])
	m.drop()
	bottle.queue_free()
	table.queue_free()
	seat.queue_free()


# ---- an act.gd's acts ---------------------------------------------------------------------------------------------------------
func stage_acts() -> void:
	if not ResourceLoader.exists(S + "act.gd"):
		return
	await reset_her(Vector3(-8, 0, 0))
	var a := Node.new()
	a.set_script(load(S + "act.gd"))
	if not ("life" in String(a.get_script().source_code)):
		a.free()
		return
	a.name = "Fidget"
	a.set("act", "life")
	a.set("clip", "scratch_head")
	her.add_child(a)
	await frames(4)
	began.clear()
	a.call("fire")
	await frames(30)
	if not ("life_scratch_head" in began):
		bad("an act.gd 'life' act played %s" % [began])
	await until(func() -> bool: return String(g.now) == "", 6.0)
	say("act.gd: a 'life' act plays a flourish by its name")
	a.queue_free()


# ---- a creature: only the ones its body can do ----------------------------------------------------------------------------------
func stage_goblin() -> void:
	var ps := load("res://characters/goblin.glb") as PackedScene
	if ps == null:
		say("no goblin in the project: left out")
		return
	var gob := ps.instantiate() as Node3D
	gob.name = "Goblin"
	main.add_child(gob)
	gob.global_position = Vector3(-12, 0, 0)
	var gm := Node.new()
	gm.name = "Motion"
	gm.set_script(load(S + "motion.gd"))
	gob.add_child(gm)
	await frames(10)
	var gg: Node = gm.gesture()
	if gg == null:
		bad("the goblin has no HSGesture")
		return
	var have: Array = gg.flourishes()
	var skipped: Array = gm.record.get("skipped", [])
	var names := []
	for k in skipped:
		names.append(String(k["name"]))
	var got := []
	gg.started.connect(func(n: String) -> void: got.append(n))
	gm.life_every = Vector2(0.3, 0.6)
	gm.alive_now(true)
	await frames(60 * 20)
	gm.alive_now(false)
	var ik: Node = gm.hand_ik()
	var okay: bool = gg.play("scratch_head", {"force": true})
	var err := 0.0
	var touch: Dictionary = gg.life_of("life_scratch_head").get("touch", {})
	while okay and String(gg.now) != "":
		await frames(1)
		if not touch.is_empty() and float(gg.t) > float(touch["from"]) + 0.05 and float(gg.t) < float(touch["to"]) - 0.05 and ik.last.has("r"):
			err = maxf(err, float(ik.last["r"]["error"]))
	var wrong := got.filter(func(n): return String(n) in names)
	if have.is_empty() or names.is_empty() or got.size() < 5 or not wrong.is_empty() or not okay or err > 0.015:
		bad("the goblin: %d flourishes, %d left out for its body (%s), %d played by themselves, of the left-out ones %s, scratching its head its hand ends %.1f cm off" % [have.size(), names.size(), names, got.size(), wrong, err * 100.0])
	say("a goblin: %d flourishes, not %s (its body can't do them cleanly); alive, %d played in 20 s; scratching its head, its hand %.1f mm from it" % [have.size(), ", ".join(names.map(func(n): return String(n).trim_prefix("life_"))), got.size(), err * 1000.0])
	gob.queue_free()
