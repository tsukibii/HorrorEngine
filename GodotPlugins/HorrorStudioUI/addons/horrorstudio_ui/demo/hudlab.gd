## The HUD on its own over a picture (the UI's design bench: seconds a picture, not minutes): the real hud.gd and marker.gd
## in a bare window over a backdrop image, the camera and what the marker marks made up. --plan=PATH is a JSON array of
## steps done in order, each with an optional "shot" taken after "wait" frames (at the fixed rate):
##   bg "PATH.png"            the backdrop (a picture of a game, say), kept until another
##   theme "glass|glass-rose|neumorph|plain", guide 0|1|2 (the Quest marker setting)
##   marks [{id, at: [fx, fy], depth, name, seen, aimed}]   markers over the screen's fraction (fx, fy) at that many metres;
##        or marks: [] to clear; seen false = a wall between; name shown when near
##   look [yaw, pitch]        the camera turned (degrees): a mark off to a side or behind shows as the pointer
##   objective "text", todo [{id, text, state, who, left}], fresh true, line {text, who, think}, log ["a"], hint [key, what]
##   cursor [kind, label, name], progress 0..1|null, seen 0..1, stance, timer secs, board, chapter [t, s], choice {...}
##   take [{id, name}] with at / shown   the inventory's row;   modal true|false
## Under xvfb with --fixed-fps 30 and --resolution 1920x1080.
extends SceneTree

var hud
var cam: Camera3D
var bg: TextureRect
var plan: Array = []
var out_dir := "res://ui_shots"
var targets: Dictionary = {}
var ctx_seen: Dictionary = {}
var ctx_names: Dictionary = {}
var ctx_aimed := ""
var marks_spec: Array = []
var yaw := 0.0
var pitch := 0.0
var running := false


func _initialize() -> void:
	create_timer(600.0, true, false, true).timeout.connect(func() -> void: print("HUDLAB watchdog"); quit(1))
	var plan_path := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--plan="):
			plan_path = a.substr(7)
		elif a.begins_with("--out="):
			out_dir = a.substr(6)
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(plan_path))
	if not (parsed is Array):
		print("HUDLAB FAIL: no plan at ", plan_path)
		quit(1)
		return
	plan = parsed
	DirAccess.make_dir_recursive_absolute(out_dir)
	bg = TextureRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_SCALE
	var layer := CanvasLayer.new()
	layer.layer = 1
	layer.add_child(bg)
	root.add_child(layer)
	cam = Camera3D.new()
	cam.fov = 60.0
	root.add_child(cam)
	cam.current = true
	hud = load("res://addons/horrorstudio_ui/hud.gd").new()
	hud.standalone = false                                  # (this bench drives the HUD and its marker itself)
	root.add_child(hud)
	await process_frame
	hud.wear("glass")
	hud.set_fade(0.0)                                    # the HUD starts under a black fade; the game lifts it
	running = true
	run_plan()


func _process(delta: float) -> bool:
	if not running or hud == null:
		return false
	cam.rotation_degrees = Vector3(pitch, yaw, 0.0)
	hud.guide.update(targets, cam, delta, {"seen": ctx_seen, "names": ctx_names, "aimed": ctx_aimed})
	return false


## the marks put in the world where the camera looks now (a screen fraction at a depth), to stay there while it turns
func place_marks(list: Array) -> void:
	marks_spec = list
	targets = {}
	ctx_seen = {}
	ctx_names = {}
	ctx_aimed = ""
	cam.rotation_degrees = Vector3(pitch, yaw, 0.0)
	var vp := root.get_visible_rect().size
	for m in list:
		var f: Array = m.get("at", [0.5, 0.5])
		targets[str(m["id"])] = cam.project_position(Vector2(float(f[0]) * vp.x, float(f[1]) * vp.y), float(m.get("depth", 7.0)))
		ctx_seen[str(m["id"])] = bool(m.get("seen", true))
		ctx_names[str(m["id"])] = str(m.get("name", ""))
		if m.get("aimed", false):
			ctx_aimed = str(m["id"])


func frames(n: int) -> void:
	for _i in n:
		await process_frame


func run_plan() -> void:
	var n := 0
	for st in plan:
		n += 1
		await do_step(st)
	print("HUDLAB ok %d steps" % n)
	quit()


func do_step(st: Dictionary) -> void:
	if st.has("bg"):
		var img := Image.load_from_file(st["bg"])
		bg.texture = ImageTexture.create_from_image(img)
	if st.has("theme"):
		hud.wear(st["theme"])
	if st.has("guide"):
		hud.guide.mode = int(st["guide"])
	if st.has("look"):
		yaw = float(st["look"][0])
		pitch = float(st["look"][1]) if st["look"].size() > 1 else 0.0
	if st.has("marks"):
		place_marks(st["marks"])
	if st.has("sight"):                                      # a mark's wall put between or taken away: {id: bool}
		for id in st["sight"]:
			ctx_seen[id] = bool(st["sight"][id])
	if st.has("objective"):
		hud.objective(st["objective"])
	if st.has("todo"):
		hud.todo(st["todo"], bool(st.get("fresh", true)))
	if st.has("line"):
		var l: Dictionary = st["line"]
		hud.line(l.get("text", ""), l.get("who", ""), float(l.get("secs", 600.0)), bool(l.get("think", false)))
	if st.has("log"):
		for t in st["log"]:
			hud.log(str(t))
	if st.has("hint"):
		hud.hint_key(str(st["hint"][0]), str(st["hint"][1]))
	if st.has("cursor"):
		var c: Array = st["cursor"]
		hud.set_cursor(c[0], c[1] if c.size() > 1 else "", c[2] if c.size() > 2 else null)
	if st.has("progress"):
		hud.progress(st["progress"])
	if st.has("seen"):
		hud.seen(float(st["seen"]))
	if st.has("stance"):
		hud.set_stance(str(st["stance"]))
	if st.has("timer"):
		hud.timer(st["timer"])
	if st.has("board"):
		hud.board(st["board"])
	if st.has("chapter"):
		hud.chapter(st["chapter"][0], st["chapter"][1] if st["chapter"].size() > 1 else "", float(st.get("chapter_secs", 600.0)))
	if st.has("choice"):
		var ch: Dictionary = st["choice"]
		var opts: Array = []
		for o in ch.get("options", []):
			opts.append({"label": o})
		hud.choose({"prompt": ch.get("prompt", ""), "who": ch.get("who", ""), "options": opts})
	if st.has("take"):
		var list: Array = []
		for it in st["take"]:
			list.append({"id": it["id"], "name": it.get("name", it["id"]), "model": null})
		hud.inventory(list, int(st.get("at", 0)), bool(st.get("shown", true)), false)
	if st.has("panel"):
		hud.panel(st["panel"])                                 # (not awaited: it waits for its keys)
	if st.has("menu"):                                         # the pause menu (not awaited): "root", or a page "set:display"
		hud.menu.open({"game": "lab", "where": "The hall", "secs": 754.0, "has": {"torch": true}})
		if str(st["menu"]) != "root":
			hud.menu.open_page(str(st["menu"]))
	if st.has("modal"):
		hud.modal(bool(st["modal"]))
	await frames(int(st.get("wait", 20)))
	if st.has("report"):
		for id in st["report"]:
			var m = hud.guide.marks.get(id)
			print("HUDLAB mark %s %s" % [id, "none" if m == null else "k %.3f d %.2f seen %.2f on %.2f ptr %.3f label %.2f" % [m["k"], m["d"], m["seen"], m["on"], m["ptr"], m["label"]]])
	if st.has("shot"):
		await RenderingServer.frame_post_draw
		var img := root.get_texture().get_image()
		var path := "%s/%s" % [out_dir, st["shot"]]
		img.save_png(path)
		print("HUDLAB shot %s %dx%d" % [path, img.get_width(), img.get_height()])
