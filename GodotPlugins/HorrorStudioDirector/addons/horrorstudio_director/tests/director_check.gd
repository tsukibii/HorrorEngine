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
		for k in ["q_key__card", "q_key", "q_drink", "q_talk", "q_bedroom", "q_night", "q_night__next", "e_morning", "e_asleep"]:
			if not fl.has(k):
				return "no flow node %s in %s" % [k, fl.keys()]
		if st["game"]["start"] != "q_key__card" or fl["q_key__card"]["next"] != "q_key" or fl["q_key"]["next"] != "q_drink" or fl["q_talk"]["next"] != "q_bedroom" or fl["q_night"]["next"] != "q_night__next":
			return "the order: " + JSON.stringify(fl)
		var ch: Dictionary = fl["q_night__next"]
		if ch["by"] != "flag" or ch["options"][0]["to"] != "e_morning" or ch["options"][1]["to"] != "e_asleep" or not str(ch["options"][0]["if"][0]).begins_with("?c"):
			return "what comes after the night, by what was done: " + JSON.stringify(ch)
		var beats: Array = st["stitches"]["q_key"]["beats"].map(func(b): return b["id"])
		if not beats.has("m_figure_scare") or not beats.has("m_letter_thought") or not beats.has("talk__mari__t_not_now"):
			return "the first quest's beats: %s (the moments and the conversations in every quest)" % [beats]
		if not st["items"].has("bedroom_key") or not st["items"].has("mug") or not st["notes"].has("letter") or not st["cast"].has("mari"):
			return "items %s notes %s cast %s" % [st["items"].keys(), st["notes"].keys(), st["cast"].keys()]
		var br: Dictionary = hs.compiled["brain"]
		if br["talks"].get("mari", []).size() != 4 or br["states"].size() != 1 or br["conds"].is_empty():
			return "the brain's: %d conversations, %d states, %d conditions" % [br["talks"].get("mari", []).size(), br["states"].size(), br["conds"].size()]
		return "")
	await step("the chapter card, then the first task: its objective and its two to-dos", func():
		var k := 0
		while not (g.run != null and g.run["trail"].has("q_key") and g.play != null and g.play.active and not g.play.busy) and k < 3000:
			await process_frame
			k += 1
		if g.play == null or not g.run["trail"].has("q_key"):
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
	await step("Mari in her MHR body plays her idle, a motion made on Kimodo's skeleton and brought in", func():
		var node = rt.cast_nodes.get("mari")
		if node == null:
			return "no Mari"
		var ap = load("res://addons/horrorstudio/play.gd").player_with(node, "sample_idle")
		if ap == null:
			return "no player with sample_idle under her (the sample has no body: res://bodies/MHR.fbx?)"
		await game_wait(0.5)
		if not ap.is_playing() or not str(ap.current_animation).ends_with("sample_idle"):
			return "playing %s" % ap.current_animation
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
	await step("the letter: read (the note's card), its to-do ticked, its moment's thought, the fact read:letter", func():
		var c := await go_to("letter", 0.8)
		if c != "read":
			return "cursor " + c
		rt.use(true)
		await frames(10)
		if g.hud.panel_el == null:
			return "no note's card"
		g.hud._finish_panel(true)
		var k := 0
		while not flag("read:letter") and k < 600:
			await process_frame
			k += 1
		if todo_state("read_letter") != "done":
			return "read_letter %s" % todo_state("read_letter")
		if not flag("read:letter"):
			return "no fact read:letter"
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
	await step("walking into the kitchen's doorway after the letter: the figure's jumpscare (a moment: when, if a fact, then)", func():
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
	await step("parts on models: the kettle switched on, its steam where its spout marker was moved; the ornament taken up in the hands, turned by a drag, put back; the finished step crossed out", func():
		var c := await go_to("kettle", 0.8)
		if c != "use":
			return "the kettle's cursor " + c
		var before = rt.state_of("kettle")
		rt.use(true)
		await game_wait(1.0)
		var now = rt.state_of("kettle")
		if now == null or now == before:
			return "the kettle's state %s -> %s" % [before, now]
		var it = rt.lifefx.items.get("kettle")
		if it == null or not it["S"].has("spout"):
			return "the kettle has no spout among its points (%s)" % (it["S"].keys() if it != null else "no kettle in lifefx")
		var marker: Node3D = rt.by_id["kettle"]["node"].get_node_or_null("spout")
		if marker == null:
			return "no spout marker in the level"
		var w: Dictionary = rt.lifefx.socket_world(it, it["S"]["spout"])
		if w["p"].distance_to(marker.global_position) > 0.005:
			return "the steam comes out at %s, the marker is at %s" % [w["p"], marker.global_position]
		c = await go_to("ornament", 0.7)
		if c == "" or c.begins_with("ERR"):
			return "the ornament's cursor " + c
		rt.use(true)
		await frames(20)
		if rt.examining == null or rt.exam == null:
			return "the ornament wasn't taken up in the hands"
		if rt.by_id["ornament"]["node"].visible:
			return "the ornament is still on the table while it's in the hands"
		var shown: int = rt.exam["pivot"].find_children("*", "MeshInstance3D", true, false).size()
		if shown < 2:
			return "nothing in the hands to look at (%d meshes)" % shown
		rt.exam_turn(120.0, 0.0)                      # a drag across: turned about the view's up
		await frames(40)
		if abs(rt.exam_angle() - 120.0 * float(rt.EXAMINE["turn"])) > 0.05:
			return "a drag didn't turn it as far (%.2f rad)" % rt.exam_angle()
		rt.key_event("E", true)
		await frames(10)
		if rt.examining != null or rt.exam != null or not rt.by_id["ornament"]["node"].visible:
			return "E didn't put it back on the table"
		var struck := false
		for l in g.hud.todo_box.get_children():
			if l.get_meta("state", "") == "done" and l.get_node_or_null("strike") != null:
				struck = true
		if not struck:
			return "the read letter's to-do isn't crossed out"
		return "")
	await step("Mari says not now each time she's clicked (the conversation she offers before the key, heard out each time)", func():
		for time in 2:
			var c := await go_to("mari", 1.0)
			if c != "talk":
				return "cursor " + c
			g.run["flags"].erase("heard:t_not_now")
			rt.use(true)
			var k := 0
			var said := false
			while not flag("heard:t_not_now") and k < 900:
				await process_frame
				said = said or g.hud.line_text.find("Not now") >= 0
				k += 1
			if not said:
				return "time %d: her line never came (line %s)" % [time + 1, g.hud.line_text]
			if not flag("heard:t_not_now"):
				return "time %d: the conversation never ended" % (time + 1)
			k = 0
			while not (g.play.active and not g.play.busy) and k < 300:
				await process_frame
				k += 1
			await game_wait(0.5)                      # a moment, as a player takes, before clicking her again
		return "")
	await step("the key: taken, its to-do ticked, the quest done: the drink errand next", func():
		var c := await go_to("bedroom_key", 0.8)
		if c != "take":
			return "cursor " + c
		rt.use(true)
		var k := 0
		while not (g.run["trail"].has("q_drink") and g.play != null and g.play.active and not g.play.busy) and k < 1200:
			await process_frame
			k += 1
		if not rt.items.has("bedroom_key"):
			return "no key held"
		if not g.run["trail"].has("q_drink") or not flag("done:q_key"):
			return "the errand didn't start (trail %s)" % [g.run["trail"]]
		if g.hud.obj.text != "Bring Mari something to drink":
			return "objective %s" % g.hud.obj.text
		return "")
	await step("giving: the wrong thing answered (Nah, that's not what I want), the right one taken and its step ticked; an achievement", func():
		for id in ["bottle", "mug"]:
			var c := await go_to(id, 0.8)
			if c != "take":
				return "%s's cursor %s" % [id, c]
			rt.use(true)
			await frames(20)
		for i in rt.inv.size():                     # the bottle in the hand
			if rt.inv[i]["id"] == "bottle":
				rt.inv_at = i
		var c2 := await go_to("mari", 1.0)
		if c2 == "" or c2.begins_with("ERR"):
			return "Mari's cursor " + c2
		rt.use(true)
		await frames(10)
		if g.hud.line_text.find("not what I want") < 0:
			return "the bottle: her line %s" % g.hud.line_text
		if todo_state("give_mug") != "open" or not flag("gave:bottle:mari"):
			return "the bottle: give_mug %s" % todo_state("give_mug")
		await game_wait(3.0)
		for i in rt.inv.size():
			if rt.inv[i]["id"] == "mug":
				rt.inv_at = i
		c2 = await go_to("mari", 1.0)
		rt.use(true)
		var k := 0
		while not g.run["trail"].has("q_talk") and k < 600:
			await process_frame
			k += 1
		if not flag("gave:mug:mari") or not g.run["trail"].has("q_talk"):
			return "the mug: give_mug %s, trail %s" % [todo_state("give_mug"), g.run["trail"]]
		if rt.items.has("mug"):
			return "the mug wasn't taken"
		if not flag("achievement:ACH_HOST"):
			return "no achievement for it"
		return "")
	await step("the conversation the story offers now: talked to, answered Yes, heard out (its step ticks); a state sends Mari to the bedroom door", func():
		var k := 0
		while not (g.play != null and g.play.active and not g.play.busy) and k < 1200:
			await process_frame
			k += 1
		rt = g.play
		var c := await go_to("mari", 1.0)
		if c == "" or c.begins_with("ERR"):
			return "Mari's cursor " + c
		rt.use(true)
		await frames(5)
		var r := await scenes_until_play()
		if r != "":
			return r
		k = 0
		while not g.run["trail"].has("q_bedroom") and k < 1200:
			await process_frame
			k += 1
		for f in ["talked:t_open", "answered:t_open:yes", "promised", "heard:t_open"]:
			if not flag(f):
				return "no fact %s (trail %s)" % [f, g.run["trail"]]
		if not g.run["trail"].has("q_bedroom"):
			return "the bedroom quest didn't start"
		await game_wait(1.0)
		var npc = g.play.npcs.get("mari")
		if npc == null or str(npc.get("as")) != "go":
			return "Mari isn't going anywhere: %s" % [npc]
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
		while g.play != null and g.play.active and not g.run["trail"].has("q_night") and k < 600:
			await process_frame
			k += 1
		rt.key_event("W", false)
		if not g.run["trail"].has("q_night"):
			return "the bedroom never reached (at z=%.2f)" % rt.player.pos.z
		return "")
	await step("a quest that ends on its first step: hiding in the wardrobe, and what comes next by what was done: the good ending", func():
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
