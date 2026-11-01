## The guide's pictures of the game (guides/director/, `tools/godot_director.py guide`): the sample played under xvfb
## through its Director file's quests and pictured at its moments: the house from above with its areas and spots, the
## hall at the start (the first quest's objective and its steps), the cursor on the letter and its card, the read step
## crossed out, F9's panel (the quest, the facts), the figure's jumpscare in the kitchen's doorway, the kettle's steam
## from its spout, the ornament taken up in the hands, Mari close, the wrong thing given ("Nah, that's not what I
## want"), her question's two answers, the ending's card. JPEGs into --out=<folder>; prints GUIDEGAME {...}.
extends SceneTree

var hs
var g
var rt
var out := ""
var made: Array = []


func frames(n: int) -> void:
	for i in n:
		await process_frame


func snap(name: String, rect: Rect2i = Rect2i()) -> void:
	await frames(4)
	var img := root.get_viewport().get_texture().get_image()
	if rect.size != Vector2i.ZERO:
		img = img.get_region(rect.intersection(Rect2i(Vector2i.ZERO, img.get_size())))
	img.save_jpg(out.path_join(name + ".jpg"), 0.86)
	made.append(name)


func game_wait(secs: float) -> void:
	var c0: float = rt.clock
	var n := 0
	while rt.clock - c0 < secs and n < 4000:
		await process_frame
		n += 1


func until(fn: Callable, limit: int = 3000) -> bool:
	var k := 0
	while not fn.call() and k < limit:
		await process_frame
		k += 1
	return fn.call()


func playing() -> bool:
	return g.play != null and g.play.active and not g.play.busy


func trail(id: String) -> bool:
	return g.run != null and g.run["trail"].has(id)


## the eye where it is now, looking as the player does
func eye_sync() -> void:
	g.camera.global_position = rt.eye_pos()
	g.camera.rotation_degrees = Vector3(rt.player.pitch, rt.player.yaw - 90.0, 0.0)


## stand d metres from a thing facing it, the cursor on it (a person: aimed at at_y of her height); where nothing stands
## between it and the eye (a ray from inside a wall finds nothing: the eye mustn't be in one), else wherever the cursor lands
func face(id: String, d: float, at_y: float = -1.0) -> bool:
	var n := 0
	while (rt.look_tween != null or rt.moving != null) and n < 3000:
		await process_frame
		n += 1
	var o = rt.by_id.get(id)
	if o == null:
		return false
	var at: Vector3 = o["node"].global_position
	if o["kind"] == "person":
		at.y += float(o["size"][2]) * (0.6 if at_y < 0 else at_y)
	for clear in [true, false]:
		for k in 16:
			var a := k * PI / 8.0
			var feet := Vector3(at.x + cos(a) * d, rt.player.pos.y, at.z - sin(a) * d)
			rt.place(feet, rad_to_deg(atan2(-(at.z - feet.z), at.x - feet.x)), 0.0)
			var eye: Vector3 = rt.eye_pos()
			rt.player.pitch = rad_to_deg(atan2(at.y - eye.y, Vector2(at.x - feet.x, at.z - feet.z).length()))
			eye_sync()
			await physics_frame
			if clear:
				var dir: Vector3 = (eye - at).normalized()
				if rt.ray_hit(at + dir * 0.15, dir, max(0.0, (eye - at).length() - 0.15), rt.blocks()) != null:
					continue
			rt.update_cursor(0.0)
			if rt.target != null and rt.target["id"] == id:
				return true
	return false


## the one in the hand: the inventory's slot holding this item
func in_hand(item: String) -> void:
	for i in rt.inv.size():
		if rt.inv[i]["id"] == item:
			rt.inv_at = i


func _initialize() -> void:
	create_timer(480.0, true, false, true).timeout.connect(func() -> void: print("GUIDEGAME " + JSON.stringify({"made": made, "timeout": true})); quit(1))
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	DirAccess.make_dir_recursive_absolute(out)
	hs = (load("res://main.tscn") as PackedScene).instantiate()
	root.add_child(hs)
	var n := 0
	while not (hs.runtime != null and hs.runtime.run != null and hs.runtime.run["trail"].has("q_key") and hs.runtime.play != null and hs.runtime.play.active and not hs.runtime.play.busy) and n < 3000:
		await process_frame
		n += 1
	g = hs.runtime
	rt = g.play
	await game_wait(1.5)
	# the house from above: the ceilings off, the areas and spots drawn as the editor draws them, no HUD
	var lvl: Node = g.level
	var hidden: Array = []
	for r in lvl.find_children("*", "", true, false):
		if str(r.name) == "ceiling" and r is Node3D:
			r.visible = false
			hidden.append(r)
	for t in lvl.find_children("*", "", true, false):
		if HSDirector.class_of(t) == "HSTrigger":
			t._rebuild()
		elif HSDirector.class_of(t) == "HSSpot":
			t._draw()
	var top := Camera3D.new()                          # from above at a slant: the walls' height, the doors, the things
	top.projection = Camera3D.PROJECTION_ORTHOGONAL
	top.size = 12.5
	g.world.add_child(top)
	var mid := Vector3(2.0, 0.6, -2.1)
	top.global_transform = Transform3D(Basis(), mid + Vector3(7.0, 13.0, 9.0)).looking_at(mid, Vector3.UP)
	top.current = true
	g.hud.root.visible = false
	var sun := DirectionalLight3D.new()
	sun.light_energy = 0.6
	g.world.add_child(sun)
	sun.global_transform = Transform3D(Basis(), Vector3(0, 10, 0)).looking_at(Vector3(2, 0, -3), Vector3.UP)
	await frames(30)
	await snap("g_topdown")
	sun.queue_free()
	top.queue_free()
	for r in hidden:
		r.visible = true
	for t in lvl.find_children("_gen", "", true, false):
		if t.get_parent() != null and HSDirector.class_of(t.get_parent()) in ["HSTrigger", "HSSpot"]:
			t.free()
	g.camera.current = true
	g.hud.root.visible = true
	# the hall at the start: the first quest's objective and its two steps
	rt.place(Vector3(-0.6, 0, 1.6), 50.0, -6.0)
	await game_wait(1.0)
	await snap("g_hall")
	# Mari, close: Talk on the cursor
	if await face("mari", 1.6, 0.85):
		await game_wait(0.6)
		await snap("g_mari")
	# the letter: the cursor on it, its card; then its step crossed out on the list
	if await face("letter", 0.8):
		await snap("g_cursor")
		rt.use(true)
		await frames(40)
		await snap("g_note")
		g.hud._finish_panel(true)
	await game_wait(4.0)
	var tl: Control = g.hud.root.get_node_or_null("TopLeft")
	if tl != null:
		var r := tl.get_global_rect()
		await snap("g_strike", Rect2i(0, 0, int(max(560.0, r.end.x + 60.0)), int(r.end.y + 34.0)))
	# F9's panel: the quest, its steps, the facts so far
	rt.place(Vector3(0.6, 0, 1.4), 120.0, -4.0)
	await game_wait(0.5)
	var dbg = hs.get_node_or_null("HSDebug")
	if dbg != null:
		dbg.shown = true
		dbg.box.visible = true
		dbg._draw()
		await snap("g_debug")
		dbg.shown = false
		dbg.box.visible = false
	# the kitchen door open, the doorway walked into: the figure (a moment: after the letter's read)
	rt.door("kitchen_door", "open")
	await game_wait(1.0)
	rt.place(Vector3(1.9, 0, 0.8), 0.0, 0.0)
	rt.key_event("W", true)
	var fig = rt.by_id.get("figure")
	await until(func(): return fig != null and fig["node"].visible, 400)
	rt.key_event("W", false)
	if fig != null and fig["node"].visible:
		var fp: Vector3 = fig["node"].global_position
		var eye: Vector3 = rt.eye_pos()
		rt.player.yaw = rad_to_deg(atan2(-(fp.z - eye.z), fp.x - eye.x))
		rt.player.pitch = -4.0
		await frames(6)
		await snap("g_jumpscare")
	await game_wait(4.0)
	# the kettle (a Kettle part on a model): switched on, boiling, its steam from where its spout marker was put
	if await face("kettle", 0.85):
		rt.use(true)
		await frames(10)
		rt.set_state("kettle", "boiling")
		rt.player.pitch += 9.0
		eye_sync()
		await game_wait(3.0)
		await snap("g_kettle")
	# the ornament (an Inspect part): taken up in the hands, turned a little by a drag
	if await face("ornament", 0.7):
		rt.use(true)
		await frames(20)
		rt.exam_turn(-55.0, -18.0)
		await game_wait(0.8)
		await snap("g_inspect")
		rt.key_event("E", true)
		await frames(10)
	# the key: the first quest done, the drink errand next
	if await face("bedroom_key", 0.8):
		rt.use(true)
	await until(func(): return trail("q_drink") and playing(), 1200)
	# the wrong thing given: the bottle in the hand, Mari's answer
	for id in ["bottle", "mug"]:
		if await face(id, 0.8):
			rt.use(true)
			await frames(20)
	in_hand("bottle")
	rt.inv_draw(false)
	if await face("mari", 1.3, 0.85):
		rt.use(true)
		await until(func(): return g.hud.line_text.find("not what") >= 0, 200)
		g.hud.line_until += 30.0                        # her line is up for seconds of the wall clock's: held for the picture (it renders slowly here)
		await snap("g_wrong")
		g.hud.line_until = Time.get_ticks_msec() / 1000.0
	await game_wait(3.0)
	# the right one: the mug given, her conversation offered now
	in_hand("mug")
	rt.inv_draw(false)
	if await face("mari", 1.0):
		rt.use(true)
	await until(func(): return trail("q_talk") and playing(), 1200)
	rt = g.play
	if await face("mari", 1.3, 0.85):
		rt.use(true)
	await until(func(): return not g.hud.choice_over, 3000)
	if not g.hud.choice_over:                           # her question's two answers, the eye on Mari (her line ends as they come up)
		var mn = g.play.cast_nodes.get("mari")
		if mn != null:
			var mp: Vector3 = mn.global_position + Vector3(0, 1.45, 0)
			var e2: Vector3 = g.play.eye_pos()
			g.play.player.yaw = rad_to_deg(atan2(-(mp.z - e2.z), mp.x - e2.x))
			g.play.player.pitch = rad_to_deg(atan2(mp.y - e2.y, Vector2(mp.x - e2.x, mp.z - e2.z).length())) - 4.0
			var back: Vector3 = e2 - mn.global_position          # turned to the player at once (face_player turns her there in a moment)
			mn.global_rotation = Vector3(0, atan2(back.x, back.z), 0)
		await frames(2)
		await snap("g_dialogue")
		g.hud.choice_pick(1)
	await until(func(): return trail("q_bedroom") and playing(), 3000)
	rt = g.play
	# the bedroom, opened with the key and walked into; the night's quest: hidden in the wardrobe, the good ending
	if await face("bedroom_door", 1.0):
		rt.use(true)
	await game_wait(1.0)
	rt.place(Vector3(-1.2, 0, -1.2), 90.0, 0.0)
	rt.key_event("W", true)
	await until(func(): return trail("q_night"), 600)
	rt.key_event("W", false)
	await until(playing, 600)
	rt = g.play
	if await face("wardrobe", 0.9):
		rt.use(true)
	await until(func(): return g.watch_end != null, 1500)
	await frames(60)
	await snap("g_ending")
	print("GUIDEGAME " + JSON.stringify({"made": made}))
	quit()
