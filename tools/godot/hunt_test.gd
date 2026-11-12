## HUNT's playthrough (tools/godot/hunt_check.py): the starter kit's hunt (hunt.gd, hunt_spot.gd, moves.gd,
## checkpoint.gd, the Story's die()) in a made-up place: a floor, a wall across the north with a doorway in it, the
## starter's player at the middle looking north, stand-ins to hunt you. Headless (--fixed-fps 60). Prints
## `HUNT <what> <how>` lines and `HUNT result {errors}`, quits.
extends SceneTree

const S := "res://starter/"

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var story: Node


func say(what: String, how: String) -> void:
	print("HUNT %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("HUNT ERROR %s" % e)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 60.0)))


func until(cond: Callable, t: float) -> bool:
	for i in int(ceil(t * 60.0)):
		if cond.call():
			return true
		await physics_frame
	return cond.call()


func look(p: Vector3) -> void:
	var d := p - player.global_position
	player.rotation = Vector3(0, atan2(-d.x, -d.z), 0)
	var e := p - eye.global_position
	var pt := atan2(e.y, Vector2(e.x, e.z).length())
	player.set("pitch", pt)
	eye.rotation = Vector3(pt, 0, 0)


func put(p: Vector3) -> void:
	player.global_position = p
	player.velocity = Vector3.ZERO


func made(src: String) -> GDScript:
	var s := GDScript.new()
	s.source_code = src
	s.reload()
	return s


func wall(mid: Vector3, size: Vector3) -> void:
	var b := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = size
	cs.shape = sh
	b.add_child(cs)
	main.add_child(b)
	b.global_position = mid


func standin(nm: String) -> Node3D:
	var h := Node3D.new()
	h.name = nm
	var m := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 0.22
	cap.height = 1.7
	m.mesh = cap
	m.position = Vector3(0, 0.85, 0)
	h.add_child(m)
	main.add_child(h)
	h.visible = false
	return h


func spot(nm: String, kind: String, at: Vector3, hunt: Node, words := {}) -> Marker3D:
	var s := Marker3D.new()
	s.name = nm
	s.set_script(load(S + "hunt_spot.gd"))
	s.set("kind", kind)
	s.set("hunt", hunt)
	s.set("cooldown", 0.5)
	for k in words:
		if k != "box":
			s.set(k, words[k])
	if words.has("box"):
		var a := Area3D.new()
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = words["box"]
		cs.shape = sh
		cs.position = Vector3(0, 1, 0)
		a.add_child(cs)
		s.add_child(a)
	main.add_child(s)
	s.global_position = at
	return s


func hunt(nm: String, hunter: Node3D, words: Dictionary) -> Node:
	var h := Node.new()
	h.name = nm
	h.set_script(load(S + "hunt.gd"))
	h.set("hunter", hunter)
	for k in words:
		h.set(k, words[k])
	main.add_child(h)
	return h


func mark(at: Vector3) -> Marker3D:
	var m := Marker3D.new()
	main.add_child(m)
	m.global_position = at
	return m


func _initialize() -> void:
	create_timer(500.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("HUNT result " + JSON.stringify({"errors": errors}))
		quit())
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	story = main.get_node("Story")
	var torch := player.get_node("Eye/Flashlight") as Light3D
	# the place: a wall across the north (z -8) with a doorway 3 m wide in its middle
	wall(Vector3(-5.75, 1.5, -8), Vector3(8.5, 3, 0.3))
	wall(Vector3(5.75, 1.5, -8), Vector3(8.5, 3, 0.3))
	put(Vector3.ZERO)
	var north := Vector3(0, 1.2, -10)
	look(north)
	await frames(20)

	# ---- A. a haunting -------------------------------------------------------------------------------------------
	var her := standin("Her")
	var h := hunt("Power", her, {"kind": "haunting", "needs": "power_out", "ends_when": "task:power", "stages": 3,
		"stage_secs": PackedFloat32Array([400.0, 400.0]), "gap_min": 500.0, "gap_max": 600.0, "reveal_task": "dark: Something's in here with you.",
		"fact": "power_back", "end_says": "The lights come back."})
	var s_watch := spot("Watch", "watch", Vector3(7, 0, 7), h, {"hold": 2.0})
	var s_dart := spot("Dart", "dart", Vector3(-4, 0, -10), h, {"to": mark(Vector3(4, 0, -10)), "speed": 6.0})
	var s_peek := spot("Peek", "peek", Vector3(-7, 0, 6), h)
	var door := Node3D.new()
	door.set_script(made("extends Node3D\nvar open := false\nvar locked := false\nfunc lock() -> String:\n\treturn \"key\" if locked else \"\"\n"))
	main.add_child(door)
	door.global_position = Vector3(0, 0, 10)
	var s_door := spot("Door", "door", Vector3(0, 0, 10), h, {"door": door})
	var s_decoy := spot("Decoy", "decoy", Vector3(-9, 0, 9), h, {"sound": "knock_three"})
	var s_amb := spot("Ambush", "ambush", Vector3(12, 0, 1.5), h, {"box": Vector3(2, 2, 2), "catches": true})
	var s_follow := spot("Follow", "follow", Vector3(0, 0, 0), h, {"stage_min": 9})   # (kept out of the automatic run: played by hand)
	var scares := [0]
	h.scared.connect(func() -> void: scares[0] += 1)
	var touches := [0]
	h.touched.connect(func() -> void: touches[0] += 1)
	var ends: Array = []
	h.ended.connect(func(how: String) -> void: ends.append(how))
	await frames(30)
	var a0: bool = h.get("running")
	story.flag("power_out")
	await frames(5)
	say("starts", "before its fact: running %s; after: running %s, stage %d, the fact hunt:Power %s, hunt:Power:1 %s, on the list %s, her seen %s" % [
		a0, h.get("running"), h.get("stage"), story.is_set("hunt:Power"), story.is_set("hunt:Power:1"), story.has_task("dark"), her.visible])
	if a0 or not h.get("running") or int(h.get("stage")) != 1 or not story.is_set("hunt:Power") or not story.is_set("hunt:Power:1") or story.has_task("dark") or her.visible:
		bad("the haunting didn't start hidden on its fact (before %s, running %s, stage %d, task %s, her %s)" % [a0, h.get("running"), h.get("stage"), story.has_task("dark"), her.visible])

	# a watch: only set up out of your sight; looked at, gone, and the quest shows
	look(s_watch.global_position + Vector3.UP)
	await frames(3)
	var w_seen: bool = s_watch.ready_for(h, player, eye, 100.0)
	look(north)
	await frames(3)
	var w_unseen: bool = s_watch.ready_for(h, player, eye, 100.0)
	h.play_spot(s_watch)
	await frames(3)
	var w_there := her.visible and her.global_position.distance_to(s_watch.global_position) < 0.1
	var w_task0: bool = story.has_task("dark")
	look(s_watch.global_position + Vector3.UP)
	await secs(0.4)
	var w_mid := her.visible
	await secs(0.8)
	say("watch", "looking at its spot: possible %s; looking away: %s; played: there %s; looked at 0.4 s: there %s, after 1.2 s gone %s; scares %d; the task shown before %s, after %s" % [
		w_seen, w_unseen, w_there, w_mid, not her.visible, scares[0], w_task0, story.has_task("dark")])
	if w_seen or not w_unseen or not w_there or not w_mid or her.visible or scares[0] != 1 or w_task0 or not story.has_task("dark"):
		bad("the watch spot (possible in view %s, out of view %s, there %s, at 0.4 s %s, gone %s, scares %d, task %s)" % [w_seen, w_unseen, w_there, w_mid, not her.visible, scares[0], story.has_task("dark")])
	# never looked at: gone after its hold
	look(north)
	await frames(3)
	h.play_spot(s_watch)
	await secs(1.0)
	var w_h1 := her.visible
	await secs(1.4)
	say("watch unseen", "never looked at: there at 1 s %s, gone after its hold (2 s) %s" % [w_h1, not her.visible])
	if not w_h1 or her.visible:
		bad("a watch never looked at didn't go after its hold")

	# a dart: only while you look at the doorway; across it in about a second and a third, seen on the way
	look(Vector3(8, 1, 3))
	await frames(3)
	var d_away: bool = s_dart.ready_for(h, player, eye, 100.0)
	look(north)
	await frames(3)
	var d_ok: bool = s_dart.ready_for(h, player, eye, 100.0)
	h.play_spot(s_dart)
	var d_seen := 0
	var d_frames := 0
	var d_midx := 99.0
	while her.visible and d_frames < 300:
		d_frames += 1
		d_midx = minf(d_midx, absf(her.global_position.x))
		if absf(her.global_position.x) < 1.2:
			d_seen += 1
		await physics_frame
	say("dart", "looking away: possible %s; at the doorway: %s; played: across in %.2f s, through the doorway's middle (%.2f m off), in the opening %d frames, gone at the end %s (%.1f, %.1f)" % [
		d_away, d_ok, d_frames / 60.0, d_midx, d_seen, not her.visible, her.global_position.x, her.global_position.z])
	if d_away or not d_ok or d_frames < 60 or d_frames > 100 or d_midx > 0.2 or d_seen < 15 or her.visible or her.global_position.distance_to(Vector3(4, 0, -10)) > 0.2:
		bad("the dart (possible away %s, at the doorway %s, %d frames, %.2f m off the middle, ended at %s)" % [d_away, d_ok, d_frames, d_midx, str(her.global_position)])

	# a peek: looked straight at, she draws back behind her corner and is gone
	look(north)
	await frames(3)
	h.play_spot(s_peek)
	await frames(5)
	var p0 := her.global_position
	look(s_peek.global_position + Vector3.UP * 1.4)
	await secs(0.45)
	var p_moved := her.global_position.distance_to(p0)
	await secs(0.4)
	say("peek", "looked straight at: drew back %.2f m along her corner, gone %s" % [p_moved, not her.visible])
	if p_moved < 0.15 or her.visible:
		bad("the peek didn't draw back and go (%.2f m, gone %s)" % [p_moved, not her.visible])

	# a door, a decoy: at once, and the hunt quiet again; a locked door never
	look(north)
	await frames(3)
	var dr_ok: bool = s_door.ready_for(h, player, eye, 100.0)
	h.play_spot(s_door)
	await frames(2)
	var dr_open: bool = door.get("open")
	var dr_again: bool = s_door.ready_for(h, player, eye, 200.0)
	door.set("open", false)
	door.set("locked", true)
	var dr_locked: bool = s_door.ready_for(h, player, eye, 300.0)
	door.set("locked", false)
	var dc_ok: bool = s_decoy.ready_for(h, player, eye, 100.0)
	h.play_spot(s_decoy)
	await frames(2)
	say("door, decoy", "the door: possible %s, opened %s, again while open %s, locked %s; the decoy: possible %s; the hunt %s, her seen %s" % [
		dr_ok, dr_open, dr_again, dr_locked, dc_ok, h.get("state"), her.visible])
	if not dr_ok or not dr_open or dr_again or dr_locked or not dc_ok or str(h.get("state")) != "quiet" or her.visible:
		bad("the door or the decoy (door possible %s, opened %s, again %s, locked %s; decoy %s; state %s)" % [dr_ok, dr_open, dr_again, dr_locked, dc_ok, h.get("state")])

	# too close: she's gone, nothing else
	look(north)
	await frames(3)
	h.play_spot(s_watch)
	await frames(3)
	put(s_watch.global_position + Vector3(0.6, 0, 0))
	await frames(8)
	say("too close", "0.6 m from her: touched %d, gone %s, you alive %s" % [touches[0], not her.visible, not story.get("dead")])
	if touches[0] != 1 or her.visible or story.get("dead"):
		bad("getting close in a haunting (touched %d, gone %s)" % [touches[0], not her.visible])

	# an ambush in its box: there at a metre, a scare, gone; nobody caught in a haunting
	put(Vector3(12, 0, 0.9))
	look(Vector3(12, 1.2, -10))
	await frames(12)
	var am_ok: bool = s_amb.ready_for(h, player, eye, 100.0)
	var sc0: int = scares[0]
	h.play_spot(s_amb)
	await frames(3)
	var am_d := her.global_position.distance_to(player.global_position)
	var am_there := her.visible
	await secs(1.2)
	say("ambush", "in its box: possible %s; played: there %s, %.2f m from you, a scare %s, gone %s, dead %s" % [am_ok, am_there, am_d, scares[0] > sc0, not her.visible, story.get("dead")])
	if not am_ok or not am_there or am_d > 1.6 or scares[0] <= sc0 or her.visible or story.get("dead"):
		bad("the ambush (possible %s, there %s, %.2f m, gone %s, dead %s)" % [am_ok, am_there, am_d, not her.visible, story.get("dead")])

	# a follow: down the way you came, nearer each time you look away, never nearer than its least, gone when watched
	put(Vector3(0, 0, 12))
	look(Vector3(0, 1.2, -20))
	await frames(5)
	for i in 48:
		put(Vector3(0, 0, 12.0 - i * 0.25))
		await frames(2)
	s_follow.set("stage_min", 1)
	var f_ok: bool = s_follow.ready_for(h, player, eye, 100.0)
	h.play_spot(s_follow)
	await frames(3)
	var f_d0 := her.global_position.distance_to(player.global_position)
	await secs(1.6)
	var f_d1 := her.global_position.distance_to(player.global_position)
	await secs(9.0)
	var f_d2 := her.global_position.distance_to(player.global_position)
	var f_touch: int = touches[0]
	look(her.global_position + Vector3.UP * 1.4)
	await secs(0.5)
	var f_still := her.visible and absf(her.global_position.distance_to(player.global_position) - f_d2) < 0.01
	await secs(1.3)
	s_follow.set("stage_min", 9)
	say("follow", "possible %s; behind you at %.1f m; 1.6 s unseen: %.1f m; 10 s: %.1f m (never under %.1f), touched %d; looked at: still for half a second %s, then gone %s" % [
		f_ok, f_d0, f_d1, f_d2, float(h.get("follow_min_m")), f_touch - 1, f_still, not her.visible])
	if not f_ok or absf(f_d0 - 7.0) > 0.4 or f_d1 > f_d0 - 1.0 or f_d2 < float(h.get("follow_min_m")) - 0.1 or f_d2 > 2.6 or f_touch != 1 or not f_still or her.visible:
		bad("the follow (%.1f, %.1f, %.1f m, touched %d, still %s, gone %s)" % [f_d0, f_d1, f_d2, f_touch, f_still, not her.visible])

	# by themselves: a few seconds apart, never the same twice running; the stages and their facts; no rush in a haunting
	put(Vector3.ZERO)
	look(north)
	h.set("gap_min", 0.6)
	h.set("gap_max", 1.0)
	s_peek.set("hold", 2.0)
	h.set("stage_secs", PackedFloat32Array([4.0, 4.0]))
	h.set("_next", 0.5)
	h.set("_stage_t", 0.0)
	torch.visible = false
	var n0: int = (h.get("played") as Array).size()
	for i in 22:
		look(north if i % 2 == 0 else Vector3(8, 1, 3))
		await secs(1.0)
	var auto: Array = (h.get("played") as Array).slice(n0)
	var twice := false
	for i in range(1, auto.size()):
		if auto[i] == auto[i - 1]:
			twice = true
	say("by itself", "22 s: %d spots %s, the same twice running %s; stage %d, hunt:Power:2 %s, hunt:Power:3 %s; in the dark all the while: rushes %d" % [
		auto.size(), str(auto), twice, h.get("stage"), story.is_set("hunt:Power:2"), story.is_set("hunt:Power:3"), h.get("rushes")])
	if auto.size() < 3 or twice or int(h.get("stage")) != 3 or not story.is_set("hunt:Power:3") or int(h.get("rushes")) != 0:
		bad("the hunt by itself (%d spots, twice running %s, stage %d, rushes %d)" % [auto.size(), twice, h.get("stage"), h.get("rushes")])

	# ended by its task: she's gone, its fact set, its running fact taken back, the shown task ticked
	story.tick("power")
	await frames(4)
	say("ends", "the task ticked: ended %s, running %s, power_back %s, hunt:Power %s, the shown task done %s, her seen %s" % [
		str(ends), h.get("running"), story.is_set("power_back"), story.is_set("hunt:Power"), story.done("dark"), her.visible])
	if ends != ["task"] or h.get("running") or not story.is_set("power_back") or story.is_set("hunt:Power") or not story.done("dark") or her.visible:
		bad("the haunting didn't end on its task (%s, running %s, fact %s)" % [str(ends), h.get("running"), story.is_set("power_back")])
	for s in [s_watch, s_dart, s_peek, s_door, s_decoy, s_amb, s_follow]:
		s.queue_free()

	# ---- B. a lethal hunt ----------------------------------------------------------------------------------------
	put(Vector3.ZERO)
	look(north)
	torch.visible = true
	torch.light_energy = 4.0
	var it := standin("It")
	var down_src := "extends Node\nsignal down\nsignal touched(info: Dictionary)\n"
	var it_react := Node.new()
	it_react.set_script(made(down_src))
	it.add_child(it_react)
	var k := hunt("Night", it, {"kind": "lethal", "stages": 3, "stage_secs": PackedFloat32Array([1.0, 1.0]), "gap_min": 500.0, "gap_max": 600.0,
		"rush_stage": 3, "dark_secs": 1.0, "tell_secs": 1.2, "rush_rest": 4.0, "grace": 3.0, "death_title": "She has you"})
	spot("Behind", "watch", Vector3(0, 0, 9), k)
	var tells := [0]
	var tell_at := [0.0]
	var rush_at := [0.0]
	k.telling.connect(func() -> void:
		tells[0] += 1
		tell_at[0] = float(k.get("clock")))
	k.rushed.connect(func() -> void: rush_at[0] = float(k.get("clock")))
	var k_ends: Array = []
	k.ended.connect(func(how: String) -> void: k_ends.append(how))
	await frames(20)
	story.set("death_secs", 1.5)
	story.flag("before_death")
	k.start()
	await secs(5.0)
	say("light", "a lethal hunt at stage %d with your flashlight on for 5 s: tells %d, rushes %d; a checkpoint kept %s" % [k.get("stage"), tells[0], k.get("rushes"), story.has_checkpoint()])
	if int(k.get("stage")) != 3 or tells[0] != 0 or int(k.get("rushes")) != 0 or not story.has_checkpoint():
		bad("she rushed in the light, or no checkpoint was kept (stage %d, tells %d, rushes %d)" % [k.get("stage"), tells[0], k.get("rushes")])

	# the dark: a tell first, from where you can't see her; hiding calls it off
	torch.visible = false
	var t_ok := await until(func() -> bool: return str(k.get("state")) == "tell", 4.0)
	var t_d := it.global_position.distance_to(player.global_position)
	var t_unseen: bool = not load(S + "sight.gd").figure_seen(eye, it.global_position, 1.5, [player])
	player.set("pose", "hiding")
	await frames(4)
	var off_state := str(k.get("state"))
	player.set("pose", "standing")
	say("tell", "your flashlight off: a tell %s, her %.1f m off and out of your sight %s; you hid: the hunt %s, her seen %s, rushes %d" % [
		t_ok, t_d, t_unseen, off_state, it.visible, k.get("rushes")])
	if not t_ok or t_d < 5.0 or not t_unseen or off_state != "quiet" or it.visible or int(k.get("rushes")) != 0:
		bad("the tell, or hiding to call it off (tell %s, %.1f m, unseen %s, then %s, rushes %d)" % [t_ok, t_d, t_unseen, off_state, k.get("rushes")])

	# again: the tell, then the rush no sooner than a second after; caught: dead, a card, back at the checkpoint as
	# you were, the hunt a stage lower and no rush for its grace
	put(Vector3(3, 0, 2))
	look(Vector3(3, 1.2, -10))
	story.flag("after_checkpoint")
	k.set("_rest", 0.0)
	var r_ok := await until(func() -> bool: return str(k.get("state")) == "rush", 6.0)
	var died := await until(func() -> bool: return bool(story.get("dead")), 12.0)
	var d_over: bool = story.get("over")
	var back := await until(func() -> bool: return not bool(story.get("dead")), 5.0)
	await frames(5)
	var at_check := player.global_position.distance_to(Vector3.ZERO)
	say("caught", "the rush %.2f s after its tell (%s); caught: dead %s, everything stopped %s; back %s: %.2f m from the checkpoint, the fact from before it %s, the one after it %s, deaths %d; the hunt at stage %d, running %s, her seen %s" % [
		rush_at[0] - tell_at[0], r_ok, died, d_over, back, at_check, story.is_set("before_death"), story.is_set("after_checkpoint"),
		story.get("deaths"), k.get("stage"), k.get("running"), it.visible])
	if not r_ok or rush_at[0] - tell_at[0] < 1.0 or not died or not d_over or not back or at_check > 0.3 or story.is_set("after_checkpoint") or not story.is_set("before_death") \
			or int(story.get("deaths")) != 1 or int(k.get("stage")) != 2 or not k.get("running") or it.visible:
		bad("caught and back (rush %s after %.2f s, died %s, back %s, %.2f m, the later fact %s, stage %d)" % [r_ok, rush_at[0] - tell_at[0], died, back, at_check, story.is_set("after_checkpoint"), k.get("stage")])
	var g_tells: int = tells[0]
	await secs(2.5)
	say("grace", "2.5 s in the dark after the retry: new tells %d" % (tells[0] - g_tells))
	if tells[0] != g_tells:
		bad("she rushed inside the grace after a retry")

	# out of her sight: she's lost you, you live
	var lost_ok := await until(func() -> bool: return str(k.get("state")) == "rush", 14.0)
	put(Vector3(-6, 0, -11))
	var lost_done := await until(func() -> bool: return str(k.get("state")) == "quiet", 12.0)
	say("lost", "a rush %s; behind the wall: she lost you %s (the chase ended %s), you alive %s, her seen %s" % [
		lost_ok, lost_done, str(k.get("chase").get("how")) if k.get("chase") != null else "", not story.get("dead"), it.visible])
	if not lost_ok or not lost_done or story.get("dead") or it.visible or str(k.get("chase").get("how")) != "lost":
		bad("breaking her sight didn't lose her (rush %s, lost %s, how %s)" % [lost_ok, lost_done, str(k.get("chase").get("how"))])

	# mercy: after two deaths her tell is longer and her aggression capped
	put(Vector3.ZERO)
	look(north)
	k.set("deaths", 2)
	k.set("_rest", 0.0)
	k.set("_grace", 0.0)
	k.set("aggression", 1.0)
	var m_ok := await until(func() -> bool: return str(k.get("state")) == "tell", 6.0)
	var m_tell := float(k.get("_tell_t"))
	await frames(2)
	say("mercy", "two deaths: the tell %.2f s (its own 1.2), her aggression capped at %.2f" % [m_tell, k.get("aggression")])
	if not m_ok or m_tell < 1.6 or float(k.get("aggression")) > 0.61:
		bad("no mercy after two deaths (tell %.2f s, aggression %.2f)" % [m_tell, k.get("aggression")])
	# shot down: it ends
	it_react.emit_signal("down")
	await frames(3)
	say("shot", "her shot down: ended %s, her seen %s" % [str(k_ends), it.visible])
	if k_ends != ["shot"] or it.visible:
		bad("the hunt didn't end when she was shot down (%s)" % str(k_ends))

	# survived by time, its target fired
	var tg := Node.new()
	tg.set_script(made("extends Node\nvar got := 0\nfunc fire(_a = null, _b = null) -> void:\n\tgot += 1\n"))
	main.add_child(tg)
	var sv := hunt("Wait", standin("Third"), {"kind": "stalking", "survive_secs": 2.0, "target": tg, "tick": "power", "gap_min": 500.0, "gap_max": 600.0})
	var sv_ends: Array = []
	sv.ended.connect(func(how: String) -> void: sv_ends.append(how))
	await frames(5)
	sv.start()
	await secs(2.3)
	say("survived", "2 s: ended %s, its target fired %d" % [str(sv_ends), tg.get("got")])
	if sv_ends != ["survived"] or int(tg.get("got")) != 1:
		bad("a hunt didn't end by its time (%s)" % str(sv_ends))

	# ---- C. the cloak as a state ---------------------------------------------------------------------------------
	torch.visible = true
	var ghost := standin("Ghost")
	var cl := Node.new()
	cl.name = "Cloak"
	cl.set_script(made("extends Node\nvar on := false\nvar log: Array = []\nfunc cloak(_s := -1.0) -> void:\n\ton = true\n\tlog.append(\"cloak\")\nfunc reveal(_s := -1.0) -> void:\n\ton = false\n\tlog.append(\"reveal\")\nfunc is_cloaked() -> bool:\n\treturn on\n"))
	ghost.add_child(cl)
	var g_react := Node.new()
	g_react.set_script(made(down_src))
	ghost.add_child(g_react)
	var c := hunt("Unseen", ghost, {"kind": "haunting", "cloaked": true, "gap_min": 500.0, "gap_max": 600.0})
	var s_pass := spot("Pass", "pass", Vector3(-5, 0, -4), c, {"to": mark(Vector3(5, 0, -4))})
	var s_cw := spot("CloakWatch", "watch", Vector3(7, 0, 7), c)
	await frames(10)
	put(Vector3.ZERO)
	look(north)
	var pass_no: bool = s_pass.ready_for(h, player, eye, 100.0)     # (the first hunt's hunter has no cloak)
	c.start()
	await frames(3)
	var c_on0: bool = cl.get("on")
	var pass_ok: bool = s_pass.ready_for(c, player, eye, 100.0)
	c.play_spot(s_pass)
	await secs(1.0)
	var c_pass: bool = cl.get("on") and ghost.visible
	var c_x := ghost.global_position.x
	await until(func() -> bool: return str(c.get("state")) == "quiet", 9.0)
	c.play_spot(s_cw)
	await frames(3)
	var c_shown: bool = not cl.get("on") and ghost.visible
	look(s_cw.global_position + Vector3.UP)
	await secs(1.2)
	var c_after: bool = cl.get("on")
	g_react.emit_signal("touched", {"touch": "soak", "kind": "water"})
	await frames(2)
	say("cloak", "started: cloaked %s; a pass possible without a cloak %s, with one %s; passing: cloaked and there %s (%.1f m along); a watch: shown %s, cloaked again after %s; soaked: seen for %.0f s more, cloaked %s" % [
		c_on0, pass_no, pass_ok, c_pass, c_x + 5.0, c_shown, c_after, float(c.get("revealed_until")) - float(c.get("clock")), cl.get("on")])
	if not c_on0 or pass_no or not pass_ok or not c_pass or c_x < -4.5 or not c_shown or not c_after or float(c.get("revealed_until")) - float(c.get("clock")) < 10.0 or cl.get("on"):
		bad("the cloak as a state (started %s, pass %s/%s, passing %s, shown %s, again %s, soaked %s)" % [c_on0, pass_no, pass_ok, c_pass, c_shown, c_after, cl.get("on")])
	c.stop()

	# ---- D. her moves: Kimodo clips --------------------------------------------------------------------------------
	var R: GDScript = load("res://kimodo/retarget.gd") if ResourceLoader.exists("res://kimodo/retarget.gd") else null
	var N: GDScript = load("res://kimodo/npz.gd") if ResourceLoader.exists("res://kimodo/npz.gd") else null
	if R == null or N == null:
		bad("the Kimodo reader isn't in the project (res://kimodo/)")
	else:
		var soma: Dictionary = R.call("soma")
		var names: Array = soma["names"]
		var rest: Array = soma["rest"]
		var n := 31
		for clip in ["walk", "idle"]:
			var flat := PackedFloat32Array()
			for f in n:
				var t := f / float(n - 1)
				for j in names.size():
					var p := Vector3(float(rest[j][0]), float(rest[j][1]), float(rest[j][2]))
					var nm := str(names[j])
					if clip == "walk":
						p.z += 1.2 * t                                    # 1.2 m in a second: 1.2 m/s
						if nm in ["LeftShin", "LeftFoot", "LeftToeBase", "LeftToeEnd"]:
							p.z += 0.25 * sin(TAU * t)
						if nm in ["RightShin", "RightFoot", "RightToeBase", "RightToeEnd"]:
							p.z -= 0.25 * sin(TAU * t)
					elif nm.begins_with("LeftForeArm") or nm.begins_with("LeftHand"):
						p.y += 0.1 * sin(TAU * t)
					flat.append_array([p.x, p.y, p.z])
			DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://animations"))
			N.call("write", ProjectSettings.globalize_path("res://animations/test_%s.npz" % clip), {"posed_joints": [[n, 77, 3], flat]})
		var body_scene := load("res://bodies/MHR.fbx") as PackedScene if ResourceLoader.exists("res://bodies/MHR.fbx") else null
		if body_scene == null:
			say("moves", "no MHR body in the project: her Kimodo clips not tried")
			bad("bodies/MHR.fbx didn't import: the Kimodo clips weren't tried")
		else:
			var mh := Node3D.new()
			mh.name = "Mover"
			mh.add_child(body_scene.instantiate())
			main.add_child(mh)
			mh.global_position = Vector3(-12, 0, 0)
			var mv := Node.new()
			mv.name = "Moves"
			mv.set_script(load(S + "moves.gd"))
			mv.set("walk", "res://animations/test_walk.npz")
			mv.set("idle", "res://animations/test_idle.npz")
			mh.add_child(mv)
			await until(func() -> bool: return bool(mv.get("ready_now")), 30.0)
			var rep: Dictionary = mv.report()
			var sk := mh.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
			var thigh := sk.find_bone("l_upleg")
			if thigh < 0:
				for i in sk.get_bone_count():
					if sk.get_bone_name(i).to_lower().contains("upleg") or sk.get_bone_name(i).to_lower().contains("thigh"):
						thigh = i
						break
			var len_walk: float = mv.play("stalk", 0.6)          # no stalk clip: her walk, at half its pace
			await frames(4)
			var q0 := sk.get_bone_pose_rotation(thigh) if thigh >= 0 else Quaternion()
			var ap := mh.get_node_or_null("MovesPlayer") as AnimationPlayer
			var scale0 := ap.speed_scale if ap != null else 0.0
			await secs(0.5)
			var q1 := sk.get_bone_pose_rotation(thigh) if thigh >= 0 else Quaternion()
			var hips_at := mh.global_position
			var len_lunge: float = mv.play("lunge", 3.0)         # no lunge, no run: her walk again, faster
			await frames(3)
			var scale1 := ap.speed_scale if ap != null else 0.0
			var len_none: float = mv.play("hit")                 # falls back to idle
			var none_now := str((mv.report() as Dictionary)["playing"])
			say("moves", "on MHR's body: clips %s, their speeds %s m/s, problems %s; 'stalk' at 0.6 m/s: her walk (%.2f s) played at %.2f of its pace, her thigh turning %.1f°; she stays put (%.2f m: in place); 'lunge' at 3 m/s: the walk at %.2f; 'hit': %s" % [
				str(rep["moves"]), str(rep["speeds"]), str(rep["problems"]), len_walk, scale0, rad_to_deg(q0.angle_to(q1)), mh.global_position.distance_to(hips_at), scale1, none_now])
			if not (rep["moves"] as Array).has("walk") or not (rep["moves"] as Array).has("idle") or not (rep["problems"] as Array).is_empty():
				bad("her Kimodo clips weren't made (%s, %s)" % [str(rep["moves"]), str(rep["problems"])])
			elif absf(float((rep["speeds"] as Array)[(rep["moves"] as Array).find("walk")]) - 1.2) > 0.1 or absf(len_walk - 1.0) > 0.1 or absf(scale0 - 0.5) > 0.05 \
					or rad_to_deg(q0.angle_to(q1)) < 2.0 or absf(scale1 - 2.5) > 0.05 or none_now != "idle" or len_lunge <= 0.0 or len_none <= 0.0:
				bad("her moves didn't play by her speed with their fallbacks (speeds %s, walk %.2f s at %.2f, thigh %.1f°, lunge at %.2f, hit %s)" % [
					str(rep["speeds"]), len_walk, scale0, rad_to_deg(q0.angle_to(q1)), scale1, none_now])
		# a stand-in has no skeleton: she slides, said once, nothing breaks; a clip by its name on her own player
		var st := standin("Slider")
		st.visible = true
		var own := AnimationPlayer.new()
		var lib := AnimationLibrary.new()
		var wave := Animation.new()
		wave.length = 0.7
		lib.add_animation("wave", wave)
		own.add_animation_library("", lib)
		st.add_child(own)
		var mv2 := Node.new()
		mv2.set_script(load(S + "moves.gd"))
		mv2.set("walk", "res://animations/test_walk.npz")
		mv2.set("more", {"wave": "wave"})
		st.add_child(mv2)
		await until(func() -> bool: return bool(mv2.get("ready_now")), 10.0)
		var rep2: Dictionary = mv2.report()
		var none_len: float = mv2.play("walk", 1.0)
		var wave_len: float = mv2.play("wave")
		say("moves, a stand-in", "no skeleton: clips %s, said %d problem(s), 'walk' plays %.1f s (she slides); a clip by its name: 'wave' %.1f s, playing %s" % [
			str(rep2["moves"]), (rep2["problems"] as Array).size(), none_len, wave_len, own.is_playing()])
		if (rep2["moves"] as Array) != ["wave"] or (rep2["problems"] as Array).size() != 1 or none_len != 0.0 or absf(wave_len - 0.7) > 0.01 or not own.is_playing():
			bad("a stand-in's moves (%s, %d problems, walk %.1f, wave %.1f)" % [str(rep2["moves"]), (rep2["problems"] as Array).size(), none_len, wave_len])

	# ---- E. a close call: reloading with her nearly on you ---------------------------------------------------------
	for hn in [h, k, sv, c]:
		if is_instance_valid(hn):
			hn.queue_free()
	await frames(3)
	torch.visible = true
	var gun := Node3D.new()
	gun.name = "Shotgun"
	gun.set_script(load("res://addons/horrorstudio_weapons/double.gd"))
	gun.set("spare", 12)
	eye.add_child(gun)
	await secs(1.0)
	await until(func() -> bool: return not gun.get("busy"), 4.0)
	# how long a reload takes
	gun.set("loaded", 0)
	await frames(3)
	var rt := [0.0]
	var clocking := [true]
	process_frame.connect(func() -> void:
		if clocking[0]:
			rt[0] += 1.0 / 60.0)
	gun.reload()
	await frames(2)
	await until(func() -> bool: return not gun.get("reloading"), 8.0)
	clocking[0] = false
	var reload_s: float = rt[0]
	var runner := standin("Runner")
	var ch := Node.new()
	ch.name = "Chase"
	ch.set_script(load(S + "chase.gd"))
	ch.set("mood", "")
	ch.set("secs_min", 60.0)
	ch.set("secs_max", 60.0)
	runner.add_child(ch)
	var cc := Node.new()
	cc.name = "CloseCall"
	cc.set_script(load(S + "close_call.gd"))
	cc.set("cooldown", 0.0)
	runner.add_child(cc)
	var caught_n := [0]
	ch.caught.connect(func() -> void: caught_n[0] += 1)
	var calls: Array = []
	cc.began.connect(func(kd: String) -> void: calls.append(kd))
	var cc_ends: Array = []
	cc.ended.connect(func(kd: String, ok: bool) -> void: cc_ends.append([kd, ok]))
	var her_speed := 0.95 * float(player.get("run_speed"))
	var at_m := 0.8 + her_speed * reload_s * 0.55              # she'd reach you a little over half way through the reload
	var runs: Array = []
	for with_call in [false, true]:
		cc.set("chance", 1.0 if with_call else 0.0)
		cc.set("first_sure", with_call)
		put(Vector3.ZERO)
		look(Vector3(0, 1.2, 10))
		runner.global_position = Vector3(0, 0, maxf(at_m + 4.0, 9.0))
		runner.visible = true
		await until(func() -> bool: return not gun.get("busy"), 6.0)
		gun.set("loaded", 0)
		await frames(3)
		caught_n[0] = 0
		ch.start()
		await until(func() -> bool: return runner.global_position.distance_to(player.global_position) <= at_m, 8.0)
		gun.reload()
		await frames(2)
		var cc_near := 99.0
		var caught_in := false
		for i in 600:
			cc_near = minf(cc_near, runner.global_position.distance_to(player.global_position))
			if caught_n[0] > 0:
				caught_in = true
				break
			if not gun.get("reloading"):
				break
			await physics_frame
		var loaded_at_end: int = gun.get("loaded")
		var cc_rep: Dictionary = cc.report()
		# the reload done: she comes on cc_after her moment; you don't shoot, so she has you
		var cc_after := await until(func() -> bool: return caught_n[0] > 0, 4.0)
		runs.append({"call": with_call, "caught_reloading": caught_in, "nearest": cc_near, "loaded": loaded_at_end, "holding": bool(cc_rep["holding"]),
			"kind": str(cc_rep["kind"]), "caught_after": cc_after})
		ch.stop()
		await secs(1.2)
	say("close call", "a reload takes %.2f s; started with her %.1f m off. Without one: caught while reloading %s (%d shells in). With one: %s, caught while reloading %s, her nearest %.2f m, faltering as it ended %s (%s), %d shells in; you didn't shoot: caught afterwards %s; it began %s, ended %s" % [
		reload_s, at_m, runs[0]["caught_reloading"], runs[0]["loaded"], "she faltered" if runs[1]["holding"] or not calls.is_empty() else "NOTHING", runs[1]["caught_reloading"],
		runs[1]["nearest"], runs[1]["holding"], runs[1]["kind"], runs[1]["loaded"], runs[1]["caught_after"], str(calls), str(cc_ends)])
	if not runs[0]["caught_reloading"] or runs[1]["caught_reloading"] or int(runs[1]["loaded"]) != 2 or float(runs[1]["nearest"]) < 0.85 or float(runs[1]["nearest"]) > 2.2 \
			or calls.size() != 1 or not (calls[0] in ["reloading", "empty"]) or not runs[1]["caught_after"] or cc_ends.size() != 1 or not bool(cc_ends[0][1]):
		bad("the close call while reloading (without: caught %s; with: caught %s, nearest %.2f, loaded %d, began %s, ended %s, caught cc_after %s)" % [
			runs[0]["caught_reloading"], runs[1]["caught_reloading"], runs[1]["nearest"], runs[1]["loaded"], str(calls), str(cc_ends), runs[1]["caught_after"]])

	# it never lasts: the Story's words keep her off only `max_secs`; one a chase; hiding's, once, and not when it's off
	calls.clear()
	cc_ends.clear()
	await until(func() -> bool: return not gun.get("busy"), 6.0)
	gun.set("loaded", 2)
	await frames(3)
	cc.set("while_needs", "at_the_fuse")
	cc.set("max_secs", 1.5)
	cc.set("chance", 1.0)
	story.flag("at_the_fuse")
	put(Vector3.ZERO)
	look(Vector3(0, 1.2, 10))
	runner.global_position = Vector3(0, 0, 7)
	runner.visible = true
	caught_n[0] = 0
	ch.start()
	var held_ok := await until(func() -> bool: return bool(cc.get("holding")), 6.0)
	var t_hold := [0.0]
	var timing := [true]
	process_frame.connect(func() -> void:
		if timing[0] and bool(cc.get("holding")):
			t_hold[0] += 1.0 / 60.0)
	var cc_got := await until(func() -> bool: return caught_n[0] > 0, 6.0)
	timing[0] = false
	ch.stop()
	story.unflag("at_the_fuse")
	var sp1: bool = cc.spare("hiding", runner)
	cc.set("cooldown", 30.0)
	var sp2: bool = cc.spare("hiding", runner)
	cc.set("cooldown", 0.0)
	cc.set("hiding", false)
	var sp3: bool = cc.spare("hiding", runner)
	say("close call, its limits", "busy at something (the Story's words): she faltered %s for %.2f s (its most 1.5), then had you %s; began %s, ended %s; hiding: spared %s, again inside its rest %s, with hiding off %s; close calls so far %d" % [
		held_ok, t_hold[0], cc_got, str(calls), str(cc_ends), sp1, sp2, sp3, cc.get("count")])
	if not held_ok or absf(t_hold[0] - 1.5) > 0.15 or not cc_got or calls.slice(0, 1) != ["busy"] or cc_ends.slice(0, 1) != [["busy", false]] or calls.slice(1) != ["hiding"] or not sp1 or sp2 or sp3:
		bad("the close call's limits (held %s %.2f s, caught %s, %s, %s, hiding %s %s %s)" % [held_ok, t_hold[0], cc_got, str(calls), str(cc_ends), sp1, sp2, sp3])

	print("HUNT result " + JSON.stringify({"errors": errors}))
	quit()
