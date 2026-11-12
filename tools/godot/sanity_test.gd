## SANITY's playthrough (tools/godot/sanity_check.py): the starter kit's sanity.gd and food.gd, and hunt.gd and
## dread.gd synced to them, in a made-up place (a floor, a wall), the starter's player and Story. Headless
## (--fixed-fps 60). Prints `SANITY <what> <how>` lines and `SANITY result {errors}`, quits.
extends SceneTree

const S := "res://starter/"

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var story: Node
var san: Node
var torch: Light3D


func say(what: String, how: String) -> void:
	print("SANITY %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("SANITY ERROR %s" % e)


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


func made(src: String) -> GDScript:
	var s := GDScript.new()
	s.source_code = src
	s.reload()
	return s


func standin(nm: String, at: Vector3) -> Node3D:
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
	h.global_position = at
	return h


func click(down: bool) -> void:                      # (headless the mouse is never captured: the Story's own hold_eat())
	story.hold_eat(down)


func v() -> float:
	return float(san.get("sanity"))


func near(a: float, b: float, tol := 0.02) -> bool:
	return absf(a - b) <= tol


func _initialize() -> void:
	create_timer(300.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("SANITY result " + JSON.stringify({"errors": errors}))
		quit())
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	story = main.get_node("Story")
	torch = player.get_node("Eye/Flashlight") as Light3D
	var w := StaticBody3D.new()                          # a wall to the north
	var ws := CollisionShape3D.new()
	var wb := BoxShape3D.new()
	wb.size = Vector3(20, 3, 0.3)
	ws.shape = wb
	w.add_child(ws)
	main.add_child(w)
	w.global_position = Vector3(0, 1.5, -6)
	var scare := Node.new()
	scare.set_script(made("extends Node\nsignal scared\nfunc _ready() -> void:\n\tadd_to_group(\"hs_scare\")\n"))
	main.add_child(scare)
	san = Node.new()
	san.name = "Sanity"
	san.set_script(load(S + "sanity.gd"))
	for k in {"dark_drain": 0.05, "near_drain": 0.1, "hunt_drain": 0.05, "scare_cost": 0.1, "sit_rate": 0.2, "lie_rate": 0.3,
			"sleep_after": 1.0, "sleep_secs": 0.5, "foods": {"soda": 0.1}}.keys():
		san.set(k, {"dark_drain": 0.05, "near_drain": 0.1, "hunt_drain": 0.05, "scare_cost": 0.1, "sit_rate": 0.2, "lie_rate": 0.3,
			"sleep_after": 1.0, "sleep_secs": 0.5, "foods": {"soda": 0.1}}[k])
	main.add_child(san)
	var bands: Array = []
	san.band_changed.connect(func(b: String) -> void: bands.append(b))
	await frames(10)

	# 1. the light keeps it; the dark wears it down; the meter
	torch.visible = true
	torch.light_energy = 4.0
	await secs(0.5)                                      # (it looks for light five times a second)
	san.set_to(1.0)
	await secs(2.0)
	var lit_v := v()
	var m0: Dictionary = san.report()
	torch.visible = false
	await secs(0.5)
	san.set_to(1.0)
	await secs(2.0)
	var dark_v := v()
	var m1: Dictionary = san.report()
	say("light and dark", "2 s with your flashlight on: %.3f (the meter shown %.2f); 2 s in the dark: %.3f (worn by the %s; the meter shown %.2f, its bar %.0f of 180 px)" % [
		lit_v, float(m0["meter_shown"]), dark_v, str(m1["why_down"]), float(m1["meter_shown"]), float(m1["fill"])])
	if not near(lit_v, 1.0, 0.001) or not near(dark_v, 0.9) or str(m1["why_down"]) != "dark" or float(m0["meter_shown"]) > 0.01 \
			or float(m1["meter_shown"]) < 0.9 or not near(float(m1["fill"]), 180.0 * dark_v, 1.0):
		bad("the light and the dark (%.3f lit, %.3f dark, by %s, meter %.2f then %.2f, bar %.0f)" % [lit_v, dark_v, str(m1["why_down"]), float(m0["meter_shown"]), float(m1["meter_shown"]), float(m1["fill"])])

	# 2. a scare; her near in the open, and not behind a wall; a hunt running
	torch.visible = true
	san.set_to(1.0)
	scare.emit_signal("scared")
	var sc_v := v()
	var her := standin("Her", Vector3(0, 0, -3))
	her.add_to_group("hs_threat")
	san.set_to(1.0)
	await secs(1.0)
	var near_v := v()
	her.global_position = Vector3(0, 0, -8)             # behind the wall
	san.set_to(1.0)
	await secs(1.0)
	var wall_v := v()
	her.visible = false
	var hunt := Node.new()
	hunt.name = "Night"
	hunt.set_script(load(S + "hunt.gd"))
	hunt.set("hunter", standin("It", Vector3(0, 0, 12)))
	hunt.set("kind", "stalking")
	hunt.set("gap_min", 500.0)
	hunt.set("gap_max", 600.0)
	hunt.set("stage_secs", PackedFloat32Array([1000.0, 1000.0]))
	main.add_child(hunt)
	await frames(5)
	hunt.start()
	san.set_to(1.0)
	await secs(1.0)
	var hunt_v := v()
	say("scares, her, a hunt", "a scare: %.2f; her 3 m off in the open for a second: %.3f; behind a wall: %.3f; a hunt running a second: %.3f" % [sc_v, near_v, wall_v, hunt_v])
	if not near(sc_v, 0.9, 0.001) or not near(near_v, 0.9) or not near(wall_v, 1.0, 0.002) or not near(hunt_v, 0.95):
		bad("what wears it down (a scare %.2f, her near %.3f, behind a wall %.3f, a hunt %.3f)" % [sc_v, near_v, wall_v, hunt_v])

	# 3. its bands and the Story's facts
	bands.clear()
	var f: Array = []
	for x in [0.6, 0.4, 0.2, 0.9]:
		san.set_to(x)
		f.append([str(san.band()), story.is_set("sanity:uneasy"), story.is_set("sanity:shaken"), story.is_set("sanity:breaking")])
	say("bands", "at 0.6, 0.4, 0.2 and 0.9: %s; the bands it passed through %s; holds('sanity:shaken') now %s" % [str(f), str(bands), story.holds("sanity:shaken")])
	if f != [["uneasy", true, false, false], ["shaken", true, true, false], ["breaking", true, true, true], ["calm", false, false, false]] \
			or bands != ["uneasy", "shaken", "breaking", "calm"]:
		bad("the bands and their facts (%s, %s)" % [str(f), str(bands)])

	# 4. eating: a thing has to be in the pocket and eatable, the left button held until the meter fills, then it's gone
	var apple := MeshInstance3D.new()
	apple.mesh = SphereMesh.new()
	(apple.mesh as SphereMesh).radius = 0.05
	(apple.mesh as SphereMesh).height = 0.1
	apple.set_script(load(S + "food.gd"))
	apple.set("restores", 0.25)
	apple.set("label", "an apple")
	apple.name = "Apple"
	main.add_child(apple)
	apple.global_position = Vector3(1, 1, 0)
	await frames(3)
	var rates := {}                                      # (eating takes seconds now: nothing else moving the meter meanwhile)
	for k in ["drain", "dark_drain", "near_drain", "hunt_drain", "light_rate"]:
		rates[k] = san.get(k)
		san.set(k, 0.0)
	san.set_to(0.3)
	story.give("key", "a key", null, 1)                  # something that isn't food
	click(true)
	await secs(2.3)
	click(false)
	var key_kept: bool = story.has("key") and near(v(), 0.3, 0.01) and story.eating == ""
	apple.use(player)                                    # E: into the pocket, not eaten
	await frames(2)
	var picked: bool = not apple.visible and story.has("apple") and story.is_eatable("apple") and near(v(), 0.3, 0.01)
	click(true)                                          # held a second, let go: nothing eaten
	await secs(1.0)
	var half := float(story.eat_progress)
	var meter_up: bool = story._eat_box.visible and story.eating == "apple"
	var fill_px := float(story._eat_fill.size.x)
	click(false)
	await frames(3)
	var let_go: bool = story.has("apple") and float(story.eat_progress) == 0.0 and not story._eat_box.visible and near(v(), 0.3, 0.01)
	var gun := Node.new()                                # a gun that's up: the click is the gun's
	gun.set_script(made("extends Node\nvar owned := true\nvar raised := true\nfunc _ready() -> void:\n\tadd_to_group(\"hs_weapon\")\n"))
	main.add_child(gun)
	click(true)
	await secs(2.3)
	click(false)
	var gun_up: bool = story.has("apple") and near(v(), 0.3, 0.01)
	gun.set("raised", false)                             # lowered: held all the way
	click(true)
	var t_eat := 0.0
	while story.has("apple") and t_eat < 4.0:
		await physics_frame
		t_eat += 1.0 / 60.0
	var ap_v := v()
	var ap_gone: bool = not story.has("apple")
	gun.queue_free()
	# still held after it's eaten: the next one needs a new hold. Two sodas (the Sanity node's foods)
	story.give("soda", "a soda", null, 2)
	await secs(2.3)
	var one_a_hold: bool = story.count_of("soda") == 2
	click(false)
	await frames(2)
	click(true)
	await secs(2.2)
	click(false)
	var so_v := v()
	var so_left: int = story.count_of("soda")
	var by_script: bool = san.eat_item("soda")           # a script's: at once
	var none: bool = san.eat_item("soda")
	for k in rates:
		san.set(k, rates[k])
	say("food", "a key in the hand, held 2.3 s: nothing eaten %s; an apple with E: in the pocket and eatable, not eaten %s; held 1 s: the meter up %s at %.2f (%.0f px of 180), let go: nothing eaten %s; a gun up: nothing eaten %s; held: eaten after %.2f s, 0.30 to %.2f, gone from the pocket %s; still held: the sodas kept %s; a new hold: one soda, %.2f, %d left; a script's eat_item: %s, then none left %s" % [
		key_kept, picked, meter_up, half, fill_px, let_go, gun_up, t_eat, ap_v, ap_gone, one_a_hold, so_v, so_left, by_script, not none])
	if not key_kept or not picked or not meter_up or absf(half - 0.5) > 0.05 or absf(fill_px - 90.0) > 9.0 or not let_go or not gun_up:
		bad("eating, what stops it (a key %s, picked %s, the meter %s at %.2f, let go %s, a gun up %s)" % [key_kept, picked, meter_up, half, let_go, gun_up])
	if absf(t_eat - 2.0) > 0.1 or not near(ap_v, 0.55, 0.01) or not ap_gone or not one_a_hold or not near(so_v, 0.65, 0.01) or so_left != 1 or not by_script or none:
		bad("eating (after %.2f s, %.2f, gone %s, one a hold %s, a soda %.2f, %d left, a script's %s, more %s)" % [t_eat, ap_v, ap_gone, one_a_hold, so_v, so_left, by_script, none])

	# 5. rest: sitting and lying mend it to their caps, in the dark too; a hunt running: no sleep
	torch.visible = false
	san.set_to(0.3)
	player.set("pose", "sitting")
	await secs(1.0)
	var sit1 := v()
	await secs(2.5)
	var sit2 := v()
	var no_hunt: Array = []
	san.couldnt_sleep.connect(func(why: String) -> void: no_hunt.append(why))
	player.set("pose", "lying")
	await secs(1.5)
	var lie_v := v()
	var slept_hunt: bool = san.get("sleeping") or story.is_set("slept")
	player.set("pose", "standing")
	hunt.stop()
	torch.visible = true
	await frames(5)
	say("rest", "sitting in the dark from 0.30: %.2f after a second, %.2f after 3.5 (its cap 0.70); lying 1.5 s with a hunt on: %.2f, slept %s, told why %s" % [sit1, sit2, lie_v, slept_hunt, str(no_hunt)])
	if not near(sit1, 0.3 + 0.2 - 0.05, 0.03) or not near(sit2, 0.7, 0.01) or slept_hunt or no_hunt != ["hunt"] or lie_v <= 0.7 or lie_v > 0.81:
		bad("rest, or sleep with a hunt on (%.2f, %.2f, lying %.2f, slept %s, %s)" % [sit1, sit2, lie_v, slept_hunt, str(no_hunt)])

	# 6. sleep: lying down a second; not while a task on the list says no, a script blocks it or its needs don't hold
	var slept_n := [0]
	san.slept.connect(func() -> void: slept_n[0] += 1)
	san.set("no_sleep", PackedStringArray(["on:power", "never_set"]))
	var w1: String = san.why_not_sleep()
	story.tick("power")
	var w2: String = san.why_not_sleep()
	san.block_sleep("the baby's crying")
	var w3: String = san.why_not_sleep()
	san.allow_sleep("the baby's crying")
	san.set("sleep_needs", "night")
	var w4: String = san.why_not_sleep()
	story.flag("night")
	var w5: String = san.why_not_sleep()
	san.set_to(0.3)
	player.set("pose", "lying")
	var asleep := await until(func() -> bool: return bool(san.get("sleeping")), 2.0)
	var woke := await until(func() -> bool: return slept_n[0] == 1, 2.0)
	player.set("pose", "standing")
	say("sleep", "why not: with the task 'power' on the list '%s'; ticked '%s'; blocked by a script '%s'; needing 'night' '%s'; at night '%s'; lying down: asleep %s, woke %s at %.2f, the fact 'slept' %s" % [
		w1, w2, w3, w4, w5, asleep, woke, v(), story.is_set("slept")])
	if w1 != "on:power" or w2 != "" or w3 != "the baby's crying" or w4 != "needs" or w5 != "" or not asleep or not woke or not near(v(), 1.0, 0.001) or not story.is_set("slept"):
		bad("sleep and what stops it ('%s', '%s', '%s', '%s', '%s', asleep %s, woke %s, %.2f)" % [w1, w2, w3, w4, w5, asleep, woke, v()])

	# 7. synced: a hunt and the night's director faster as it falls; the rush a stage early when it's breaking; a hunt
	# that only starts once you're shaken
	san.set("dark_drain", 0.0)
	san.set("hunt_drain", 0.0)
	san.set("near_drain", 0.0)
	var h2 := Node.new()
	h2.name = "Synced"
	h2.set_script(load(S + "hunt.gd"))
	h2.set("hunter", standin("Two", Vector3(0, 0, 14)))
	for k in {"kind": "stalking", "gap_min": 500.0, "gap_max": 600.0, "stage_secs": PackedFloat32Array([1000.0, 1000.0]), "rush_stage": 3, "dark_secs": 0.5, "tell_secs": 1.4}.keys():
		h2.set(k, {"kind": "stalking", "gap_min": 500.0, "gap_max": 600.0, "stage_secs": PackedFloat32Array([1000.0, 1000.0]), "rush_stage": 3, "dark_secs": 0.5, "tell_secs": 1.4}[k])
	main.add_child(h2)
	var sp := Marker3D.new()
	sp.set_script(load(S + "hunt_spot.gd"))
	sp.set("hunt", h2)
	sp.set("stage_min", 9)                              # (never played by itself: only somewhere for her to come from)
	main.add_child(sp)
	sp.global_position = Vector3(0, 0, 9)               # behind you
	player.rotation = Vector3.ZERO
	await frames(5)
	h2.start()
	san.set_to(1.0)
	h2.set("_next", 100.0)
	h2.set("_stage_t", 0.0)
	await secs(1.0)
	var calm_gap := 100.0 - float(h2.get("_next"))
	var calm_stage := float(h2.get("_stage_t"))
	var p1: float = h2.pressure()
	san.set_to(0.0)
	h2.set("_next", 100.0)
	h2.set("_stage_t", 0.0)
	await secs(1.0)
	var low_gap := 100.0 - float(h2.get("_next"))
	var low_stage := float(h2.get("_stage_t"))
	var p0: float = h2.pressure()
	var dr := Node.new()
	dr.set_script(load(S + "dread.gd"))
	main.add_child(dr)
	await frames(3)
	var g_low := 0.0
	var g_calm := 0.0
	for i in 200:
		g_low += float(dr.call("_gap")) / 200.0
	san.set_to(1.0)
	for i in 200:
		g_calm += float(dr.call("_gap")) / 200.0
	dr.queue_free()
	# the rush: stage 2 of a hunt whose rush waits for stage 3, in the dark
	h2.call("_set_stage", 2)
	torch.visible = false
	await secs(1.5)
	var tell_calm := str(h2.get("state"))
	san.set_to(0.2)
	var told := await until(func() -> bool: return str(h2.get("state")) == "tell", 3.0)
	var tell_len := float(h2.get("_tell_t"))
	h2.stop()
	torch.visible = true
	var h3 := Node.new()
	h3.name = "WhenShaken"
	h3.set_script(load(S + "hunt.gd"))
	h3.set("hunter", standin("Three", Vector3(0, 0, 16)))
	h3.set("needs", "sanity:shaken")
	main.add_child(h3)
	san.set_to(0.6)
	await frames(10)
	var h3a: bool = h3.get("running")
	san.set_to(0.45)
	await frames(10)
	var h3b: bool = h3.get("running")
	h3.stop()
	say("synced", "a hunt's pace: calm x%.2f (a second: %.2f off its gap, %.2f on its stage), at nothing x%.2f (%.2f, %.2f); the director's gap %.1f s calm, %.1f s at nothing; in the dark at stage 2: calm '%s', at 0.2 a tell %s (%.2f s where calm it's 1.40); a hunt needing 'sanity:shaken': at 0.6 %s, at 0.45 %s" % [
		p1, calm_gap, calm_stage, p0, low_gap, low_stage, g_calm, g_low, tell_calm, told, tell_len, h3a, h3b])
	if not near(p1, 1.0, 0.001) or not near(p0, 2.0, 0.001) or not near(calm_gap, 1.0, 0.05) or not near(low_gap, 2.0, 0.1) or not near(low_stage, 2.0, 0.1) \
			or g_low > g_calm * 0.72 or tell_calm == "tell" or tell_calm == "rush" or not told or tell_len < 1.0 or tell_len > 1.2 or h3a or not h3b:
		bad("the sync (x%.2f, x%.2f, gaps %.2f and %.2f, director %.1f and %.1f, calm '%s', told %s %.2f, shaken hunt %s then %s)" % [
			p1, p0, calm_gap, low_gap, g_calm, g_low, tell_calm, told, tell_len, h3a, h3b])

	# 8. at nothing: its target fired once; or death, and back with some of it
	var tg := Node.new()
	tg.set_script(made("extends Node\nvar got := 0\nfunc fire(_a = null, _b = null) -> void:\n\tgot += 1\n"))
	main.add_child(tg)
	san.set("zero_target", tg)
	var broke_n := [0]
	san.broke.connect(func() -> void: broke_n[0] += 1)
	san.set_to(0.3)
	san.lose(0.5)
	san.lose(0.5)
	var z_fired: int = tg.get("got")
	san.set_to(0.6)
	san.set("zero_dies", true)
	story.set("death_secs", 0.6)
	story.checkpoint()
	san.set_to(0.0)
	var dead: bool = story.get("dead")
	await until(func() -> bool: return not bool(story.get("dead")), 3.0)
	await frames(3)
	say("at nothing", "to nothing twice over: broke %d time(s), its target fired %d; with zero_dies: dead %s, then back at %.2f" % [broke_n[0] - 1, z_fired, dead, v()])
	if z_fired != 1 or broke_n[0] != 2 or not dead or story.get("dead") or not near(v(), 0.5, 0.001):
		bad("at nothing (fired %d, broke %d, dead %s, back at %.2f)" % [z_fired, broke_n[0], dead, v()])

	print("SANITY result " + JSON.stringify({"errors": errors}))
	quit()
