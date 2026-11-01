## GDPLAY: the Pilot played headless from its start to its good ending, as the desk's playtest.js plays it (the story's
## own steps: a wall stops you, the front door, the hall's trigger, the message scene blending in, the to-do list, the
## letter, the kitchen's glimpse, the drawer's code, the key, the cellar door, the grab answered, the timed run out).
##   godot --headless --fixed-fps 60 --path Saved/Godot/Pilot -s res://addons/horrorstudio/tests/gdplay.gd
## Ends "GDPLAY ok".
extends SceneTree

var g
var rt
var fails := 0
var t_start := 0


func fail(what: String, why: String) -> void:
	printerr("GDPLAY FAIL: %s: %s" % [what, why])
	fails += 1
	quit(1)


func step(what: String, fn: Callable) -> void:
	if fails > 0:
		return
	var r = await fn.call()
	if r is String and r != "":
		fail(what, r + "  " + where())
		return
	print("  ok  %s" % what)


func where() -> String:
	if rt == null:
		return "(no play)"
	return JSON.stringify({"trail": g.run["trail"] if g.run != null else null, "active": rt.active, "at": [snapped(rt.player.pos.x, 0.01), snapped(-rt.player.pos.z, 0.01)],
		"busy": rt.busy, "line": g.hud.line_text, "todo": g.hud.tasks.map(func(t): return str(t["id"]) + ":" + str(t["state"]))})


func frames(n: int) -> void:
	for i in n:
		await process_frame


## wait for the game's own clock, not the wall's; done early when play ends
func game_wait(secs: float) -> void:
	var c0: float = rt.clock
	var n := 0
	while rt.active and rt.clock - c0 < secs and n < 20000:
		await process_frame
		n += 1


func hold(key: String, secs: float) -> void:
	rt.key_event(key, true)
	await game_wait(secs)
	rt.key_event(key, false)


func playing(on: bool, limit := 6000) -> bool:
	var n := 0
	while n < limit:
		var p = g.play
		var is_on: bool = p != null and p.active
		if is_on == on:
			return true
		await process_frame
		n += 1
	return false


## skip scenes (the dev skip), answer choices with the first option, until Play is back
func scenes_until_play() -> String:
	var n := 0
	while n < 12000:
		if g.play != null and g.play.active:
			return ""
		if not g.hud.choice_over:
			g.hud.choice_pick(1)
			await frames(10)
		elif g.scene_player.playing:
			g.scene_player.skip()
			await frames(5)
		else:
			await process_frame
		n += 1
	return "Play never came back"


## stand d metres from a thing, facing it, where the cursor lands on it; the cursor's kind
func go_to(id: String, d: float = 0.9) -> String:
	var n := 0
	while (rt.look_tween != null or rt.moving != null) and n < 3000:
		await process_frame
		n += 1
	var o = rt.by_id.get(id)
	if o == null:
		return "ERR no " + id
	var at: Vector3 = o["node"].global_position
	for k in 16:
		var a := k * PI / 8.0
		var feet := Vector3(at.x + cos(a) * d, 0.0, at.z - sin(a) * d)
		var yaw := rad_to_deg(atan2(-(at.z - feet.z), at.x - feet.x))
		rt.place(feet, yaw, 0.0)
		var before: Vector3 = rt.player.pos
		rt.push_out(rt.setting("walk"))
		if before.distance_to(rt.player.pos) > 1e-3:
			continue
		var trips := false
		for t in rt.triggers:
			if rt.is_in(t) and not rt.inside.has(t["id"]):
				trips = true
		if trips:
			continue
		var eye: Vector3 = rt.eye_pos()
		rt.player.pitch = rad_to_deg(atan2(at.y - eye.y, d))
		g.camera.global_position = eye
		g.camera.rotation_degrees = Vector3(rt.player.pitch, rt.player.yaw - 90.0, 0.0)
		rt.update_cursor(0.0)
		if rt.target != null and rt.target["id"] == id:
			return g.hud.cursor_kind
	return "ERR can't get the cursor on %s (hit %s, vis %s)" % [id, rt.look["id"], o["node"].visible]


func click() -> void:
	rt.use(true)


func flag(f: String) -> bool:
	return g.run != null and g.run["flags"].has(f)


func walk_in(x: float, y: float, yaw: float, secs: float) -> void:
	rt.place(Vector3(x, 0.0, -y), yaw, 0.0)
	await hold("W", secs)


func tasks() -> Array:
	return g.hud.tasks


func _initialize() -> void:
	create_timer(900.0, true, false, true).timeout.connect(func() -> void: printerr("GDPLAY FAIL: watchdog"); quit(1))
	t_start = Time.get_ticks_msec()
	if OS.get_cmdline_user_args().has("--director"):     # a Director project (godot_director.py from-desk): its HSGame makes the runtime and starts it
		var hs: Node = (load("res://main.tscn") as PackedScene).instantiate()
		root.add_child(hs)
		var k := 0
		while hs.get("runtime") == null and k < 3000:
			await process_frame
			k += 1
		g = hs.runtime
	else:
		g = (load("res://addons/horrorstudio/main.tscn") as PackedScene).instantiate()
		g.autostart = false
		root.add_child(g)
		await process_frame
		g.watch(null, null)
	await step("the arrival plays on the porch", func():
		if not await playing(true):
			return "no play"
		rt = g.play
		return "")
	await step("a wall stops you", func():
		rt.place(Vector3(2, 0, -1.5), 180.0, 0.0)
		await hold("W", 2.5)
		var x: float = rt.player.pos.x
		if x < 0.2 or x > 0.6:
			return "walked to x=%.2f: the hall's west wall is at 0" % x
		rt.place_at(rt.level, "start")
		return "")
	await step("the front door: the cursor says open, a click opens it", func():
		var c := await go_to("front_door", 1.0)
		if c != "open":
			return "cursor " + c
		click()
		await game_wait(0.9)
		if not rt.doors["front_door"]["open"]:
			return "not open"
		return "")
	await step("walking in through it ends the arrival (the hall's trigger)", func():
		rt.place(Vector3(2, 0, 0.6), 90.0, 0.0)
		rt.key_event("W", true)
		var ok := await playing(false, 1500)
		rt.key_event("W", false)
		if not ok:
			return "the arrival never ended"
		if not rt.doors["front_door"]["locked"]:
			return "the slam didn't lock it"
		return "")
	await step("the message scene blends in from the eye: no black", func():
		var most := 0.0
		for i in 50:
			most = max(most, g.hud.fade_alpha())
			await process_frame
		if most > 0.15:
			return "black went to %.2f" % most
		return "")
	await step("the message scene, then the search", func(): return await scenes_until_play())
	await step("the to-do list: the search puts two tasks on the HUD, both open", func():
		var t := tasks()
		if t.size() != 2 or t[0]["state"] != "open" or not str(t[0]["text"]).contains("letter"):
			return JSON.stringify(t)
		return "")
	await step("the letter: the cursor says read, the note opens", func():
		var c := await go_to("letter_hall", 0.7)
		if c != "read":
			return "cursor " + c
		click()
		await frames(5)
		if g.hud.panel_el == null:
			return "no panel"
		var text: String = g.hud.panel_el.find_child("Text", true, false).text
		if not text.contains("door open"):
			return "note text " + text
		rt.key_event("Escape", true)
		await frames(3)
		return "")
	await step("reading the letter ticks its task on the list by itself", func():
		var t := tasks()
		for x in t:
			if x["id"] == "read_letter" and x["state"] != "done":
				return JSON.stringify(t)
			if x["id"] == "find_key" and x["state"] != "open":
				return JSON.stringify(t)
		return "")
	await step("the kitchen's glimpse fires on entering", func():
		await walk_in(2, 5.4, 90.0, 1.3)
		await game_wait(1.2)
		if not g.hud.lines_shown.any(func(t): return t.contains("Mari?")):
			return "lines %s, inside %s, ended %s" % [JSON.stringify(g.hud.lines_shown), JSON.stringify(rt.inside.keys()), JSON.stringify(rt.ended.keys())]
		return "")
	await step("the drawer's code on the keypad sets drawer_open and shows the key", func():
		var c := await go_to("desk_lock", 0.8)
		click()
		await frames(5)
		if g.hud.panel_el == null:
			return "no pad"
		for k in ["0", "3", "1", "4", "Enter"]:
			rt.key_event(k, true)
		await frames(5)
		if not flag("drawer_open"):
			return "no flag"
		if not rt.by_id["cellar_key_pickup"]["node"].visible:
			return "the key isn't shown"
		return "")
	await step("the bed after the drawer's open: its if no longer holds, it says Not now", func():
		var c := await go_to("study_bed", 0.9)
		if c != "locked":
			return "cursor " + c
		click()
		await frames(10)
		if rt.player.sleeping != null or not g.hud.line_text.contains("Not now"):
			return "line: " + g.hud.line_text
		return "")
	await step("the cellar door is locked without the key", func():
		var c := await go_to("cellar_door", 1.0)
		if c != "locked":
			return "cursor " + c
		return "")
	await step("the key: taken, the stitch ends after the knocking", func():
		var c := await go_to("cellar_key_pickup", 0.7)
		if c != "take":
			return "cursor " + c
		click()
		await frames(5)
		var done := false
		for x in tasks():
			if x["id"] == "find_key" and x["state"] == "done":
				done = true
		if not done:
			return "find_key not ticked " + JSON.stringify(tasks())
		if rt.carried() == null or rt.carried()["id"] != "cellar_key_pickup":
			return "the key isn't in the hand"
		var n := 0
		while rt.has_end and n < 3000:
			await process_frame
			n += 1
		if rt.has_end:
			return "the search didn't end"
		if tasks().size():
			return "the list isn't cleared at the end of the search"
		return "")
	await step("the choice by act: the key opens the cellar door, walking in chooses it", func():
		if not await playing(true):
			return "no play"
		var c := await go_to("cellar_door", 1.0)
		click()
		await game_wait(0.9)
		if not rt.doors["cellar_door"]["open"]:
			return "not open (cursor %s)" % c
		await walk_in(0.7, 2, 180.0, 1.4)
		if not await playing(false, 1500):
			return "walking in didn't choose"
		return "")
	await step("the cellar, the grab (answered: let go of me), then the run", func(): return await scenes_until_play())
	await step("the run out has its timer", func():
		if rt.timer_left == null or float(rt.timer_left) <= 0:
			return "timer %s" % str(rt.timer_left)
		return "")
	await step("out onto the porch: the good ending", func():
		await walk_in(2, -3.6, 90.0, 1.2)
		var n := 0
		while g.watch_end == null and n < 3000:
			await process_frame
			n += 1
		if g.watch_end != "Out of the house":
			return "ending %s" % str(g.watch_end)
		return "")
	await step("a second playtest starts from the story's level: the cellar door shut and locked, in its frame", func():
		g.watch(null, null)
		var r := await scenes_until_play()
		if r != "":
			return r
		rt = g.play
		var d: Dictionary = rt.doors["cellar_door"]
		var t: Dictionary = rt.by_id["cellar_door"]
		var turned: float = (t["node"].transform.origin - t["base"].origin).length() + abs(t["node"].rotation.y - t["base"].basis.get_euler().y)
		if d["open"] or not d["locked"] or turned > 1e-3:
			return "the cellar door: %s turned %.3f" % [JSON.stringify({"open": d["open"], "locked": d["locked"]}), turned]
		return "")
	if fails > 0:
		return
	print("GDPLAY ok (%.1f s)" % ((Time.get_ticks_msec() - t_start) / 1000.0))
	quit(0)
