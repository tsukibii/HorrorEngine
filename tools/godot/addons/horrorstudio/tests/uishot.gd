## A series of pictures of the HUD in a game, from a plan (GDUI's eyes; the UI's own pictures for the guide):
## --plan=PATH is a JSON array of steps, each a dictionary done in order, then (with "shot") a picture of the window:
##   at [x, y, yaw, pitch]    the player stood there (story metres, degrees: east 0, north 90)
##   time "day|dusk|night"    the time of day
##   todo [{todo, text, guide, ...}], untodo [ids], tick [ids]   the to-do list (a `guide` is the marker)
##   objective "text"         the objective line
##   line {text, who, think}  a line in the footer;   log ["a", "b"]  the toasts;   hint ["Key", "does"]  a key hint
##   cursor [kind, label, name], progress 0..1, seen 0..1, stance "hidden|crouched|", timer secs, board "text"
##   chapter [title, sub]     a title card (not awaited);   choice {prompt, who, options: [label...]}
##   take [thing ids]         things into the inventory's row, shown
##   setting {guide: 0|1|2, ...}   a menu setting applied
##   hud true|false           the HUD shown or hidden (a clean picture of the world);   wait N                   frames (at the fixed rate) before the picture;   shot "name.png"   saved in --out
##   report ["id", ...]       prints each marker's numbers (k, d, sight, ...) so a check can read them
## Run under xvfb on the vulkan driver, with --fixed-fps 30 so an animation of a second is thirty frames.
extends SceneTree

var g
var rt
var plan: Array = []
var out_dir := "res://ui_shots"


func _initialize() -> void:
	create_timer(900.0, true, false, true).timeout.connect(func() -> void: print("UISHOT watchdog"); quit(1))
	var plan_path := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--plan="):
			plan_path = a.substr(7)
		elif a.begins_with("--out="):
			out_dir = a.substr(6)
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(plan_path))
	if not (parsed is Array):
		print("UISHOT FAIL: no plan at ", plan_path)
		quit(1)
		return
	plan = parsed
	DirAccess.make_dir_recursive_absolute(out_dir)
	g = (load("res://addons/horrorstudio/main.tscn") as PackedScene).instantiate()
	g.autostart = false
	root.add_child(g)
	await process_frame
	g.watch(null, null)
	var k := 0
	while k < 600 and (g.play == null or not g.play.active):
		await process_frame
		k += 1
	rt = g.play
	if rt == null or not rt.active:
		print("UISHOT FAIL: the game never started")
		quit(1)
		return
	for _i in 20:
		await process_frame
	run_plan()


func frames(n: int) -> void:
	for _i in n:
		await process_frame


func run_plan() -> void:
	var step_n := 0
	for st in plan:
		step_n += 1
		await do_step(st)
	print("UISHOT ok %d steps" % step_n)
	quit()


func do_step(st: Dictionary) -> void:
	var hud = g.hud
	if st.has("setting"):
		var s: Dictionary = g.hud.MenuC.load_settings()
		for key in st["setting"]:
			s[key] = st["setting"][key]
		g.hud.MenuC.apply(s, hud)
	if st.has("hud"):                                         # the HUD shown or hidden (a clean backdrop for the lab)
		hud.visible = bool(st["hud"])
	if st.has("clear"):                                       # the story's own HUD words out of the way
		rt.todo.remove(true)
		hud.objective(null)
		hud.line("", "", 0.0, false)
	if st.has("time"):
		g.set_time(st["time"])
	if st.has("at"):
		var p: Array = st["at"]
		rt.place(Vector3(float(p[0]), 0.0, -float(p[1])), float(p[2]) if p.size() > 2 else 90.0, float(p[3]) if p.size() > 3 else 0.0)
	if st.has("untodo"):
		for id in st["untodo"]:
			rt.todo.remove(id)
	if st.has("todo"):
		for t in st["todo"]:
			rt.todo.add(t)
	if st.has("tick"):
		for id in st["tick"]:
			rt.todo.set_state(id, "done")
	if st.has("fail"):
		for id in st["fail"]:
			rt.todo.set_state(id, "failed")
	if st.has("objective"):
		hud.objective(st["objective"])
	if st.has("line"):
		var l: Dictionary = st["line"]
		hud.line(l.get("text", ""), l.get("who", ""), float(l.get("secs", 60.0)), bool(l.get("think", false)))
	if st.has("log"):
		for t in st["log"]:
			hud.log(str(t))
	if st.has("hint"):
		hud.hint_key(str(st["hint"][0]), str(st["hint"][1]))
	if st.has("cursor"):
		var c: Array = st["cursor"]
		hud.set_cursor(c[0], c[1] if c.size() > 1 else "", c[2] if c.size() > 2 else null)
	if st.has("progress"):
		hud.progress(st["progress"] if st["progress"] != null else null)
	if st.has("seen"):
		hud.seen(float(st["seen"]))
	if st.has("stance"):
		hud.set_stance(str(st["stance"]))
	if st.has("timer"):
		hud.timer(st["timer"])
	if st.has("board"):
		hud.board(st["board"])
	if st.has("chapter"):
		hud.chapter(st["chapter"][0], st["chapter"][1] if st["chapter"].size() > 1 else "", float(st.get("chapter_secs", 30.0)))
	if st.has("choice"):
		var ch: Dictionary = st["choice"]
		var opts: Array = []
		for o in ch.get("options", []):
			opts.append({"label": o})
		hud.choose({"prompt": ch.get("prompt", ""), "who": ch.get("who", ""), "options": opts})
	if st.has("take"):
		for id in st["take"]:
			if rt.things.has(id):
				rt.take(rt.things[id])
		rt.inv_shown = true
		rt.inv_draw(false)
	if st.has("modal"):
		hud.modal(bool(st["modal"]))
	await frames(int(st.get("wait", 20)))
	if st.has("report"):
		for id in st["report"]:
			var gd = hud.guide
			var m = gd.marks.get(id) if gd != null else null
			if m == null:
				print("UISHOT mark %s none" % id)
			else:
				var o := {}
				for key in m:
					var v = m[key]
					o[key] = snappedf(v, 0.001) if v is float else (str(v) if (v is Vector2 or v is Vector3) else v)
				print("UISHOT mark %s %s" % [id, JSON.stringify(o)])
	if st.has("shot"):
		await RenderingServer.frame_post_draw
		var img := root.get_texture().get_image()
		var path := "%s/%s" % [out_dir, st["shot"]]
		img.save_png(path)
		print("UISHOT shot %s %dx%d" % [path, img.get_width(), img.get_height()])
