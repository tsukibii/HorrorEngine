## GDUI: the HUD's own rules (ui-v3), the Pilot started headless and the HUD driven from the runtime:
##   - the guide marker: its strength a smooth function of distance (the nearer the clearer, a faint floor far off, gone at
##     the end of its reach); in clear view stronger than behind walls and still there behind them; the name over it near;
##     a pointer toward it after a moment out of view, and none while it's in view; Off hides it, Clear is stronger;
##     a task done takes it away
##   godot --headless --fixed-fps 60 --path Saved/Godot/_check/Pilot -s res://addons/horrorstudio/tests/gdui.gd
##   - the rest of the HUD (ui-v3): the to-do's rows (a marked task's bullet the marker's diamond, a ticked one struck through
##     and dimmed), the corners resting dim and coming up on a change, the key hints fitting on the screen, the reticle opening
##     into a ring with the verb and what it's on, a card that is only its words (no panel, no edge), the lines easing in and
##     out over a scrim, the timer's format, the dark closing in while hidden
## Ends "GDUI ok". (tools/godot/ui_check.py exports the Pilot, runs this, and with --pictures makes the HUD's pictures.)
extends SceneTree

const MarkerC := preload("res://addons/horrorstudio_ui/marker.gd")

var g
var rt
var fails := 0
var t_start := 0


func fail(what: String, why: String) -> void:
	printerr("GDUI FAIL: %s: %s" % [what, why])
	fails += 1
	quit(1)


func step(what: String, fn: Callable) -> void:
	if fails > 0:
		return
	var r = await fn.call()
	if r is String and r != "":
		fail(what, r)
		return
	print("  ok  %s" % what)


func frames(n: int) -> void:
	for i in n:
		await process_frame


func mark(id: String) -> Dictionary:
	return g.hud.guide.marks.get(id, {})


func stand(x: float, y: float, yaw: float, pitch: float = 0.0) -> void:
	rt.place(Vector3(x, 0.0, -y), yaw, pitch)


func _initialize() -> void:
	create_timer(900.0, true, false, true).timeout.connect(func() -> void: printerr("GDUI FAIL: watchdog"); quit(1))
	t_start = Time.get_ticks_msec()
	root.size = Vector2i(1280, 720)                       # (headless Godot's window is 64 px square)
	g = (load("res://addons/horrorstudio/main.tscn") as PackedScene).instantiate()
	g.autostart = false
	root.add_child(g)
	await process_frame
	g.watch(null, null)
	var k := 0
	while k < 3000 and (g.play == null or not g.play.active):
		await process_frame
		k += 1
	rt = g.play
	if rt == null or not rt.active:
		fail("start", "the game never started")
		return
	await frames(30)
	await run_all()
	if fails == 0:
		print("GDUI ok (%.1f s)" % ((Time.get_ticks_msec() - t_start) / 1000.0))
		quit(0)


func run_all() -> void:
	await step("the marker's strength: the nearer the clearer, a faint floor far off, gone at the end of its reach", func():
		var prev := 2.0
		for i in 161:
			var d := float(i) * 0.5
			var a: float = MarkerC.base_alpha(d)
			if a > prev + 1e-6:
				return "stronger farther off: %.3f at %.1f m after %.3f" % [a, d, prev]
			prev = a
		var near: float = MarkerC.base_alpha(3.0)
		var far: float = MarkerC.base_alpha(MarkerC.FAINT_AT)
		if near < 0.85 or near > 1.0 or far < 0.15 or far > 0.3 or MarkerC.base_alpha(MarkerC.FAR) > 0.001 or MarkerC.base_alpha(100.0) != 0.0:
			return "3 m %.3f, %.0f m %.3f, %.0f m %.3f" % [near, MarkerC.FAINT_AT, far, MarkerC.FAR, MarkerC.base_alpha(MarkerC.FAR)]
		return "")
	rt.todo.remove(true)
	g.hud.objective(null)
	await step("a task with a guide: the marker over the thing, the nearer the stronger, its name over it near", func():
		rt.todo.add({"todo": "find_doll", "text": "Find the doll", "guide": "doll_on_table"})
		stand(2.0, 1.0, 90.0)                                   # the hall, the kitchen's table 7 m on, through its doorway
		await frames(150)
		var far := mark("doll_on_table")
		if far.is_empty():
			return "no marker after a second and a half"
		var kf: float = far["k"]
		if kf < 0.5 or kf > 0.85 or float(far["seen"]) < 0.95 or float(far["on"]) < 0.95:
			return "7 m in clear view: k %.2f seen %.2f on %.2f" % [kf, far["seen"], far["on"]]
		stand(2.0, 3.2, 90.0)
		await frames(150)
		var near := mark("doll_on_table")
		if float(near["k"]) <= kf + 0.05:
			return "nearer wasn't clearer: %.2f at %.1f m, then %.2f at %.1f m" % [kf, far["d"], near["k"], near["d"]]
		if str(near["name"]) != "Porcelain doll" or float(near["label"]) < 0.9:
			return "the name near: %s, label %.2f" % [near["name"], near["label"]]
		return "")
	await step("behind walls it's still there, fainter, and bare (no name)", func():
		var kc: float = mark("doll_on_table")["k"]
		stand(6.0, 3.0, 135.0)                                  # the study, the kitchen's table through two walls
		await frames(150)
		var m := mark("doll_on_table")
		if m.is_empty() or float(m["seen"]) > 0.05:
			return "behind walls: %s" % [m]
		if float(m["k"]) < 0.1 or float(m["k"]) > kc * 0.7 or float(m["label"]) > 0.01:
			return "behind walls: k %.2f (clear near %.2f), label %.2f" % [m["k"], kc, m["label"]]
		return "")
	await step("turned away: the pointer comes after a moment, and while it's in view there's none", func():
		stand(2.0, 3.2, 90.0)
		await frames(120)
		if float(mark("doll_on_table")["ptr"]) > 0.001:
			return "a pointer while it's in view: %.3f" % mark("doll_on_table")["ptr"]
		stand(2.0, 3.2, 270.0)                                  # facing south: the kitchen behind
		await frames(40)
		if float(mark("doll_on_table")["ptr"]) > 0.05:
			return "a pointer at once: %.3f after 0.7 s" % mark("doll_on_table")["ptr"]
		await frames(240)
		var m := mark("doll_on_table")
		if float(m["ptr"]) < 0.15 or float(m["on"]) > 0.05:
			return "no pointer after 4 s turned away: ptr %.3f on %.2f" % [m["ptr"], m["on"]]
		var e: Vector2 = m["edge"]
		var vp: Vector2 = g.hud.guide.get_viewport_rect().size
		if e.y < vp.y * 0.6:                                    # behind: at the bottom of the ellipse
			return "behind you should point down: edge %s of %s" % [e, vp]
		return "")
	await step("the player's setting: Clear is stronger and shows the pointer at once; Off takes it away", func():
		stand(2.0, 3.2, 90.0)
		g.hud.guide.mode = 1
		await frames(150)
		var k1: float = mark("doll_on_table")["k"]
		g.hud.guide.mode = 2
		await frames(150)
		var k2: float = mark("doll_on_table")["k"]
		if k2 <= k1 + 0.01 and k1 < 0.9:
			return "Clear no stronger: %.2f then %.2f" % [k1, k2]
		g.hud.guide.mode = 0
		await frames(90)
		if not g.hud.guide.marks.is_empty():
			return "Off left marks: %s" % [g.hud.guide.marks.keys()]
		g.hud.guide.mode = 1
		return "")
	await step("a done task takes its marker away", func():
		await frames(120)
		if mark("doll_on_table").is_empty():
			return "the marker didn't come back with the setting"
		rt.todo.set_state("find_doll", "done")
		await frames(90)
		if not g.hud.guide.marks.is_empty():
			return "still marked after it was done: %s" % [g.hud.guide.marks.keys()]
		return "")

	await step("the to-do list: a row a task; the marked one's bullet is the marker's diamond; a ticked task is struck through and dims", func():
		rt.todo.remove(true)
		rt.todo.add({"todo": "t_marked", "text": "Find the doll", "guide": "doll_on_table"})
		rt.todo.add({"todo": "t_plain", "text": "Turn the lamp on"})
		await frames(30)
		var by := {}
		for l in g.hud.todo_box.get_children():
			by[l.get_meta("task")] = l
		if not (by.has("t_marked") and by.has("t_plain")):
			return "rows: %s" % [by.keys()]
		if by["t_marked"].get_node("Bullet").shape != "diamond" or by["t_plain"].get_node("Bullet").shape != "box":
			return "bullets: %s and %s" % [by["t_marked"].get_node("Bullet").shape, by["t_plain"].get_node("Bullet").shape]
		rt.todo.set_state("t_plain", "done")
		await frames(60)
		var row = by["t_plain"]
		var strike = row.get_node_or_null("strike")
		if strike == null or float(strike.size.x) < 20.0 or float(row.modulate.a) > 0.6 or row.get_meta("state") != "done":
			return "the ticked row: strike %s, alpha %.2f" % [strike, row.modulate.a]
		rt.todo.remove(true)
		await frames(40)
		if not g.hud.todo_box.get_children().all(func(c): return c.is_queued_for_deletion() or float(c.modulate.a) < 0.05):
			return "rows left after the list was cleared"
		return "")
	await step("the corners rest dim, and come up to full when something changes", func():
		g.hud.objective("Find the doll")
		await frames(10)
		if float(g.hud.tl.modulate.a) < 0.99 or g.hud.obj_head.text != "NEW OBJECTIVE":
			return "not up on a change: alpha %.2f, %s" % [g.hud.tl.modulate.a, g.hud.obj_head.text]
		await frames(int((g.hud.FRESH_SECS + 2.5) * 60.0))
		if float(g.hud.tl.modulate.a) > g.hud.REST_ALPHA + 0.02 or g.hud.obj_head.text != "OBJECTIVE":
			return "not at rest after %.1f s: alpha %.2f, %s" % [g.hud.FRESH_SECS + 2.5, g.hud.tl.modulate.a, g.hud.obj_head.text]
		g.hud.objective(null)
		return "")
	await step("the key hints are chips, anchored in from the right edge and narrow enough for a 1152 px window (they used to run off it)", func():
		var vp: Rect2 = g.hud.root.get_viewport_rect()
		g.hud.hint_key("F", "flashlight")
		await frames(10)
		var r: Rect2 = g.hud.hint_el.get_global_rect()
		if g.hud.hint_el.get_child_count() < 9 or r.size.x > 1152.0 - 48.0 or absf(r.end.x - (vp.size.x - 24.0)) > 2.0:
			return "hints: %d of them, %.0f px wide, ending at %.0f of %.0f" % [g.hud.hint_el.get_child_count(), r.size.x, r.end.x, vp.size.x]
		return "")
	await step("the reticle opens into a ring over what can be used; its verb and what it's on beside it; a hold fills round it", func():
		rt.busy = true                                         # (the game would set the cursor itself every frame)
		g.hud.set_cursor("use", "Open", "Front door")
		await frames(25)
		if float(g.hud.cursor_el.open) < 0.95 or g.hud.prompt_verb.text != "Open" or g.hud.prompt_name.text != "Front door" or float(g.hud.prompt_el.modulate.a) < 0.95:
			return "ring %.2f, verb %s, name %s, alpha %.2f" % [g.hud.cursor_el.open, g.hud.prompt_verb.text, g.hud.prompt_name.text, g.hud.prompt_el.modulate.a]
		g.hud.progress(0.4)
		if absf(float(g.hud.cursor_el.progress) - 0.4) > 0.001:
			return "progress %s" % g.hud.cursor_el.progress
		g.hud.progress(null)
		g.hud.set_cursor("none", "")
		await frames(30)
		rt.busy = false
		if float(g.hud.cursor_el.open) > 0.05 or float(g.hud.prompt_el.modulate.a) > 0.05:
			return "didn't close: ring %.2f, prompt %.2f" % [g.hud.cursor_el.open, g.hud.prompt_el.modulate.a]
		return "")
	await step("a card is only its words: no panel to see, a soft dark behind (no edge), the world dimmed a little; gone when put away", func():
		g.hud.panel({"title": "A letter", "text": "Mari,\n\nDon't open the door until the knocking stops."})
		await frames(30)
		if g.hud.panel_el == null or not (g.hud.panel_el.get_theme_stylebox("panel") is StyleBoxEmpty):
			return "the card has a panel: %s" % [g.hud.panel_el.get_theme_stylebox("panel") if g.hud.panel_el != null else null]
		if g.hud.card_halo == null or g.hud.veil == null or float(g.hud.veil.modulate.a) < 0.9:
			return "no halo or veil behind the words: %s %s" % [g.hud.card_halo, g.hud.veil]
		g.hud._finish_panel(true)
		await frames(40)
		if g.hud.card_halo != null or float(g.hud.veil.modulate.a) > 0.05:
			return "the card's halo or veil stayed: %s, veil %.2f" % [g.hud.card_halo, g.hud.veil.modulate.a]
		return "")
	await step("a line eases in over the scrim and out again; the scrim comes and goes with it", func():
		g.hud.line("You shouldn't be here.", "Mari", 0.6, false)
		await frames(30)
		if float(g.hud.line_el.modulate.a) < 0.9 or float(g.hud.scrim.modulate.a) < 0.9 or g.hud.line_text == "":
			return "line alpha %.2f, scrim %.2f" % [g.hud.line_el.modulate.a, g.hud.scrim.modulate.a]
		var k := 0
		while g.hud.line_until > 0.0 and k < 60000:           # (the HUD times a line by the clock on the wall, not by frames)
			await process_frame
			k += 1
		await frames(60)
		if g.hud.line_text != "" or float(g.hud.line_el.modulate.a) > 0.05 or float(g.hud.scrim.modulate.a) > 0.05 or g.hud.line_el.text != "":
			return "after it: text %s, alpha %.2f, scrim %.2f" % [g.hud.line_text, g.hud.line_el.modulate.a, g.hud.scrim.modulate.a]
		return "")
	await step("the timer: whole seconds, minutes and seconds over a minute, tenths and the bad colour in the last ten", func():
		g.hud.timer(125.0)
		var a: String = g.hud.timer_el.text
		g.hud.timer(42.3)
		var b: String = g.hud.timer_el.text
		g.hud.timer(8.46)
		var c: String = g.hud.timer_el.text
		g.hud.timer(null)
		if a != "2:05" or b != "43" or c != "8.5" or g.hud.timer_el.text != "":
			return "%s %s %s" % [a, b, c]
		return "")
	await step("hidden: the dark closes in round the edge, and opens again", func():
		rt.player["hiding"] = "hall_locker"                    # (the game sets the stance from this every frame)
		await frames(90)
		if float(g.hud.vignette.modulate.a) < 0.95 or g.hud.stance_el.text != "HIDDEN":
			rt.player["hiding"] = null
			return "vignette %.2f, %s" % [g.hud.vignette.modulate.a, g.hud.stance_el.text]
		rt.player["hiding"] = null
		await frames(90)
		if float(g.hud.vignette.modulate.a) > 0.05:
			return "the dark stayed: %.2f" % g.hud.vignette.modulate.a
		return "")
