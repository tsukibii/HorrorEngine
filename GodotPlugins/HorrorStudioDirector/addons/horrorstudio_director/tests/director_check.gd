## DIRECTOR's play (tools/godot_director.py check): the sample game (make_sample.gd) compiled and played headless on
## the studio's runtime, the way a player would: the compiled story's shape, the chapter card, the task's objective
## and to-do list, a wall that stops the player (Godot's physics), the letter read (a to-do ticked, its event's flag),
## the kitchen door opened and walked through, the figure's jumpscare in the doorway (the user's example: an area
## after a flag), Mari's "not now" every time she's clicked, the key (the task done), the dialogue's answer, the
## locked bedroom door opened by the key, the bedroom entered, the choice by act (hiding in the wardrobe): the good
## ending. Ends "DIRECTORPLAY ok".
extends SceneTree

var hs: Node
var g
var rt
var fails := 0


func fail(what: String, why: String) -> void:
	printerr("BAD %s: %s  %s" % [what, why, where()])
	fails += 1


func step(what: String, fn: Callable) -> void:
	if fails > 0:
		return
	var r = await fn.call()
	if r is String and r != "":
		fail(what, r)
		return
	print("ok  %s" % what)


func where() -> String:
	if rt == null:
		return "(no play)"
	return JSON.stringify({"trail": g.run["trail"] if g.run != null else null, "active": rt.active, "at": [snapped(rt.player.pos.x, 0.01), snapped(rt.player.pos.y, 0.01), snapped(rt.player.pos.z, 0.01)],
		"busy": rt.busy, "line": g.hud.line_text, "flags": g.run["flags"].keys() if g.run != null else [], "todo": g.hud.tasks.map(func(t): return str(t["id"]) + ":" + str(t["state"]))})


func frames(n: int) -> void:
	for i in n:
		await process_frame


func game_wait(secs: float) -> void:
	var c0: float = rt.clock
	var n := 0
	while rt.active and rt.clock - c0 < secs and n < 20000:
		await process_frame
		n += 1


func playing(on: bool, limit := 6000) -> bool:
	var n := 0
	while n < limit:
		var p = g.play if g != null else null
		if (p != null and p.active) == on:
			return true
		await process_frame
		n += 1
	return false


func hold(key: String, secs: float) -> void:
	rt.key_event(key, true)
	await game_wait(secs)
	rt.key_event(key, false)


## stand d metres from a thing facing it, where the cursor lands on it: the cursor's kind
func go_to(id: String, d: float = 0.9) -> String:
	var n := 0
	while (rt.look_tween != null or rt.moving != null) and n < 3000:
		await process_frame
		n += 1
	var o = rt.by_id.get(id)
	if o == null:
		return "ERR no " + id
	var at: Vector3 = o["node"].global_position
	if o["kind"] == "person":                     # a character's node is at her feet: aim at her chest
		at.y += float(o["size"][2]) * 0.6
	for k in 16:
		var a := k * PI / 8.0
		var feet := Vector3(at.x + cos(a) * d, rt.player.pos.y, at.z - sin(a) * d)
		var yaw := rad_to_deg(atan2(-(at.z - feet.z), at.x - feet.x))
		rt.place(feet, yaw, 0.0)
		var eye: Vector3 = rt.eye_pos()
		rt.player.pitch = rad_to_deg(atan2(at.y - eye.y, Vector2(at.x - feet.x, at.z - feet.z).length()))
		g.camera.global_position = eye
		g.camera.rotation_degrees = Vector3(rt.player.pitch, rt.player.yaw - 90.0, 0.0)
		await physics_frame
		rt.update_cursor(0.0)
		if rt.target != null and rt.target["id"] == id:
			return g.hud.cursor_kind
	return "ERR can't get the cursor on %s (hit %s, vis %s)" % [id, rt.look["id"], o["node"].visible]


func flag(f: String) -> bool:
	return g.run != null and g.run["flags"].has(f)


func todo_state(id: String) -> String:
	for t in g.hud.tasks:
		if str(t["id"]) == id:
			return str(t["state"])
	return "missing"


## skip scenes, answer choices with the first, until play is back
func scenes_until_play() -> String:
	var n := 0
	while n < 12000:
		if g.play != null and g.play.active:
			return ""
		if not g.hud.choice_over:
			g.hud.choice_pick(1)
			await frames(10)
		elif g.scene_player.playing:
			await frames(2)
		else:
			await process_frame
		n += 1
	return "play never came back"


func _initialize() -> void:
	create_timer(600.0, true, false, true).timeout.connect(func() -> void: printerr("BAD watchdog " + where()); quit(1))
	var ps: PackedScene = load("res://main.tscn")
	hs = ps.instantiate()
	root.add_child(hs)
	current_scene = hs
	var n := 0
	while (hs.runtime == null or hs.runtime.story == null) and n < 600:
		await process_frame
		n += 1
	g = hs.runtime
	await step("the scene compiles into a story the runtime plays", func():
		var st: Dictionary = hs.compiled["story"]
		var errs: Array = hs.compiled["problems"].filter(func(p): return p["error"])
		if errs.size():
			return "problems: " + str(errs.map(func(p): return p["text"]))
		var fl: Dictionary = st["flow"]
		for k in ["night1__card", "arrive", "mari_talk", "bedroom", "hide_or_sleep", "morning", "asleep"]:
			if not fl.has(k):
				return "no flow node %s in %s" % [k, fl.keys()]
		if st["game"]["start"] != "night1__card" or fl["night1__card"]["next"] != "arrive" or fl["arrive"]["next"] != "mari_talk" or fl["bedroom"]["next"] != "hide_or_sleep":
			return "the order: " + JSON.stringify(fl)
		if fl["hide_or_sleep"]["by"] != "act" or fl["hide_or_sleep"]["options"][0]["to"] != "morning":
			return "the choice: " + JSON.stringify(fl["hide_or_sleep"])
		var beats: Array = st["stitches"]["arrive"]["beats"].map(func(b): return b["id"])
		if not beats.has("figure_scare") or not beats.has("letter_thought") or not beats.has("not_now"):
			return "the arrival's beats: %s (the game's events in every task)" % [beats]
		if not st["items"].has("bedroom_key") or not st["notes"].has("letter") or not st["cast"].has("mari"):
			return "items %s notes %s cast %s" % [st["items"].keys(), st["notes"].keys(), st["cast"].keys()]
		return "")
	await step("the chapter card, then the first task: its objective and its two to-dos", func():
		var k := 0
		while not (g.run != null and g.run["trail"].has("arrive") and g.play != null and g.play.active and not g.play.busy) and k < 3000:
			await process_frame
			k += 1
		if g.play == null or not g.run["trail"].has("arrive"):
			return "never got past the chapter card"
		rt = g.play
		k = 0
		while g.hud.tasks.size() < 2 and k < 200:
			await process_frame
			k += 1
		if g.hud.obj.text != "Find the bedroom key":
			return "objective %s" % g.hud.obj.text
		if g.hud.tasks.size() != 2:
			return "to-dos %s" % [g.hud.tasks]
		if rt.collide == null:
			return "not on Godot's physics"
		return "")
	await step("a wall stops the player (Godot's physics: the hall's west wall)", func():
		rt.place(Vector3(-1.0, 0.0, 0.0), 180.0, 0.0)
		await hold("W", 2.0)
		var x: float = rt.player.pos.x
		if x < -2.5 or x > -2.0:
			return "walked to x=%.2f: the wall's inner face is at -2.5" % x
		if abs(rt.player.pos.y) > 0.05:
			return "the feet at y=%.2f, not on the floor" % rt.player.pos.y
		return "")
	await step("the letter: read (the note's card), its to-do ticked, its event's thought and flag", func():
		var c := await go_to("letter", 0.8)
		if c != "read":
			return "cursor " + c
		rt.use(true)
		await frames(10)
		if g.hud.panel_el == null:
			return "no note's card"
		g.hud._finish_panel(true)
		var k := 0
		while not flag("read_letter") and k < 600:
			await process_frame
			k += 1
		if todo_state("read_letter") != "done":
			return "read_letter %s" % todo_state("read_letter")
		if not flag("read_letter"):
			return "no read_letter flag"
		return "")
	await step("the kitchen door: shut it stops the player; a click opens it", func():
		rt.place(Vector3(1.6, 0.0, 0.8), 0.0, 0.0)
		await hold("W", 1.5)
		if rt.player.pos.x > 2.5:
			return "walked through the shut door to x=%.2f" % rt.player.pos.x
		var c := await go_to("kitchen_door", 1.0)
		if c != "open":
			return "cursor " + c
		rt.use(true)
		await game_wait(1.0)
		if not rt.doors["kitchen_door"]["open"]:
			return "not open"
		return "")
	await step("walking into the kitchen's doorway after the letter: the figure's jumpscare (an event in an area, if a flag)", func():
		rt.place(Vector3(1.4, 0.0, 0.8), 0.0, 0.0)
		rt.player.yaw = 0.0
		rt.key_event("W", true)
		var seen := false
		var k := 0
		while k < 400 and not flag("saw_figure"):
			await process_frame
			if rt.by_id.has("figure") and rt.by_id["figure"]["node"].visible:
				seen = true
			k += 1
		rt.key_event("W", false)
		if not flag("saw_figure"):
			return "no saw_figure (at x=%.2f)" % rt.player.pos.x
		if not seen:
			return "the figure never showed"
		return "")
	await step("Mari says not now each time she's clicked (an event on a character, every time)", func():
		var c := await go_to("mari", 1.0)
		if c != "talk":
			return "cursor " + c
		rt.use(true)
		await frames(5)
		if g.hud.line_text.find("Not now") < 0:
			return "line %s" % g.hud.line_text
		await game_wait(4.0)
		g.hud.line("", "", 0.0, false)
		c = await go_to("mari", 1.0)
		rt.use(true)
		await frames(5)
		if g.hud.line_text.find("Not now") < 0:
			return "the second time: line %s" % g.hud.line_text
		return "")
	await step("the key: taken, its to-do ticked, the task done, the dialogue with Mari answered", func():
		var c := await go_to("bedroom_key", 0.8)
		if c != "take":
			return "cursor " + c
		rt.use(true)
		var k := 0
		while g.play != null and g.play.active and k < 600:
			await process_frame
			k += 1
		if not rt.items.has("bedroom_key"):
			return "no key held"
		var r := await scenes_until_play()
		if r != "":
			return r
		if not flag("promised"):
			return "the first answer's flag isn't set"
		if not g.run["trail"].has("mari_talk"):
			return "the dialogue didn't play: " + str(g.run["trail"])
		return "")
	await step("the locked bedroom door opens with the key; walking in ticks the task", func():
		rt = g.play
		if g.hud.obj.text != "Get into the bedroom":
			return "objective %s" % g.hud.obj.text
		var c := await go_to("bedroom_door", 1.0)
		if c != "open":
			return "cursor " + c
		rt.use(true)
		await game_wait(1.0)
		if not rt.doors["bedroom_door"]["open"]:
			return "not open (locked %s)" % rt.doors["bedroom_door"]["locked"]
		rt.place(Vector3(-1.2, 0.0, -1.2), 90.0, 0.0)
		rt.key_event("W", true)
		var k := 0
		while g.play != null and g.play.active and not g.run["trail"].has("hide_or_sleep") and k < 600:
			await process_frame
			k += 1
		rt.key_event("W", false)
		if not g.run["trail"].has("hide_or_sleep"):
			return "the bedroom never reached (at z=%.2f)" % rt.player.pos.z
		return "")
	await step("the choice by act: hiding in the wardrobe is the good ending", func():
		if not await playing(true, 2000):
			return "no play for the choice"
		rt = g.play
		var c := await go_to("wardrobe", 0.9)
		if c != "hide":
			return "cursor " + c
		rt.use(true)
		var k := 0
		while g.watch_end == null and k < 1500:
			await process_frame
			k += 1
		if str(g.watch_end) != "Morning":
			return "ended at %s" % g.watch_end
		return "")
	if fails == 0:
		print("DIRECTORPLAY ok")
	quit(0 if fails == 0 else 1)
