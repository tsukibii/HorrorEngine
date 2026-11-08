## GDUI: the HUD's own rules (ui-v3), the Pilot started headless and the HUD driven from the runtime:
##   - the guide marker: its strength a smooth function of distance (the nearer the clearer, a faint floor far off, gone at
##     the end of its reach); in clear view stronger than behind walls and still there behind them; the name over it near;
##     a pointer toward it after a moment out of view, and none while it's in view; Off hides it, Clear is stronger;
##     a task done takes it away
##   godot --headless --fixed-fps 60 --path Saved/Godot/_check/Pilot -s res://addons/horrorstudio/tests/gdui.gd
## Ends "GDUI ok". (tools/godot/ui_check.py exports the Pilot, runs this, and with --pictures makes the HUD's pictures.)
extends SceneTree

const MarkerC := preload("res://addons/horrorstudio/marker.gd")

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
