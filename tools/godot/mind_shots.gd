## MIND's pictures (tools/godot/mind_check.py, under xvfb): the look plugin's phase shader and unease shader drawn
## and measured. Prints `MIND <what> <how>` lines and `MIND result {errors}`; writes phase_sheet.png and
## unease_sheet.png into --out.
extends SceneTree

var errors: Array = []
var out := "user://"
var glb := ""
var cam: Camera3D
var stage: Node3D


func say(what: String, how: String) -> void:
	print("MIND %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("MIND ERROR %s" % e)


func frames(n: int) -> void:
	for i in n:
		await process_frame


func grab() -> Image:
	await frames(3)
	await RenderingServer.frame_post_draw
	var img := root.get_texture().get_image()
	img.convert(Image.FORMAT_RGBA8)
	return img


func lum(c: Color) -> float:
	return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b


## the figure in a picture of it against black: {n, x0, x1, y0, y1, mean, empty_rows}
func figure_of(img: Image) -> Dictionary:
	var n := 0
	var sum := 0.0
	var x0 := img.get_width()
	var x1 := -1
	var y0 := img.get_height()
	var y1 := -1
	var rows := {}
	for y in range(0, img.get_height(), 2):
		for x in range(0, img.get_width(), 2):
			var l := lum(img.get_pixel(x, y))
			if l > 0.05:
				n += 1
				sum += l
				x0 = mini(x0, x)
				x1 = maxi(x1, x)
				y0 = mini(y0, y)
				y1 = maxi(y1, y)
				rows[y] = true
	var empty := 0
	for y in range(y0, y1 + 1, 2):
		if not rows.has(y):
			empty += 1
	return {"n": n, "wide": maxi(0, x1 - x0), "tall": maxi(0, y1 - y0), "mean": sum / maxf(1.0, n), "empty_rows": empty}


## a picture's mean colour over a box given as fractions of it
func box_mean(img: Image, fx0: float, fy0: float, fx1: float, fy1: float) -> Color:
	var s := Vector3.ZERO
	var n := 0
	for y in range(int(fy0 * img.get_height()), int(fy1 * img.get_height()), 2):
		for x in range(int(fx0 * img.get_width()), int(fx1 * img.get_width()), 2):
			var c := img.get_pixel(x, y)
			s += Vector3(c.r, c.g, c.b)
			n += 1
	s /= maxf(1.0, n)
	return Color(s.x, s.y, s.z)


func box_diff(a: Image, b: Image, fx0: float, fy0: float, fx1: float, fy1: float) -> float:
	var s := 0.0
	var n := 0
	for y in range(int(fy0 * a.get_height()), int(fy1 * a.get_height()), 2):
		for x in range(int(fx0 * a.get_width()), int(fx1 * a.get_width()), 2):
			s += absf(lum(a.get_pixel(x, y)) - lum(b.get_pixel(x, y)))
			n += 1
	return s / maxf(1.0, n)


func sat(c: Color) -> float:
	var mx := maxf(c.r, maxf(c.g, c.b))
	return (mx - minf(c.r, minf(c.g, c.b))) / maxf(mx, 0.001)


func stand_in() -> Node3D:
	var h := Node3D.new()
	var m := MeshInstance3D.new()
	m.name = "Body"
	var cap := CapsuleMesh.new()
	cap.radius = 0.22
	cap.height = 1.7
	cap.rings = 48                                       # (slices want corners to move: a character's mesh is dense)
	m.mesh = cap
	m.position = Vector3(0, 0.85, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.85, 0.8, 0.75)
	m.set_surface_override_material(0, mat)
	h.add_child(m)
	return h


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--glb="):
			glb = a.substr(6)
	create_timer(600.0).timeout.connect(func() -> void:
		bad("the pictures never ended")
		print("MIND result " + JSON.stringify({"errors": errors}))
		quit())
	stage = Node3D.new()
	root.add_child(stage)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color.BLACK
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color.BLACK
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	we.environment = env
	stage.add_child(we)
	cam = Camera3D.new()
	cam.fov = 60.0
	stage.add_child(cam)
	cam.global_position = Vector3(0, 1.0, 3.0)
	cam.current = true
	var lamp := OmniLight3D.new()
	lamp.omni_range = 12.0
	lamp.light_energy = 2.5
	stage.add_child(lamp)
	lamp.global_position = Vector3(1.5, 2.2, 3.0)

	# ---- the phase: a figure against black
	var fig := stand_in()
	stage.add_child(fig)
	var plain := figure_of(await grab())
	var look := {"shader": "phase", "all": true, "shadow": true}
	var mats: Array = HSCreatureSkin.wear(fig, look, {"amount": 0.0, "seed": 3.0})
	var at0 := figure_of(await grab())
	var steps := {}
	for a in [0.3, 0.55, 0.8, 1.0]:
		for m in mats:
			m.set_shader_parameter("amount", a)
		var best := {}                                   # (the slices jump a dozen times a second: the widest of a few pictures)
		for i in 4:
			var f := figure_of(await grab())
			if best.is_empty() or int(f["wide"]) > int(best["wide"]):
				best = f
			await frames(4)
		steps[a] = best
	for m in mats:
		m.set_shader_parameter("amount", 0.0)
		m.set_shader_parameter("stutter", 0.7)
	var torn := {}
	for i in 4:
		var f := figure_of(await grab())
		if torn.is_empty() or int(f["wide"]) > int(torn["wide"]):
			torn = f
		await frames(4)
	HSCreatureSkin.clear(fig)
	var back := figure_of(await grab())
	say("the phase", "plain: %d points of her, %d px wide, brightness %.2f; at none of it: %d, %d px, %.2f; at 0.3: %d, %d px wide, %d rows cut, %.2f; at 0.55: %d, %d px, %d rows, %.2f; at 0.8: %d, %.2f; at 1: %d; a stutter: %d, %d px wide, %d rows cut; cleared: %d" % [
		plain["n"], plain["wide"], plain["mean"], at0["n"], at0["wide"], at0["mean"], steps[0.3]["n"], steps[0.3]["wide"], steps[0.3]["empty_rows"], steps[0.3]["mean"],
		steps[0.55]["n"], steps[0.55]["wide"], steps[0.55]["empty_rows"], steps[0.55]["mean"], steps[0.8]["n"], steps[0.8]["mean"], steps[1.0]["n"], torn["n"], torn["wide"], torn["empty_rows"], back["n"]])
	if absf(float(at0["n"]) / float(plain["n"]) - 1.0) > 0.03 or absf(int(at0["wide"]) - int(plain["wide"])) > 4 or absf(float(at0["mean"]) / float(plain["mean"]) - 1.0) > 0.2:
		bad("at none of the phase she's her own paint, whole (%d points against %d, %d px wide against %d, brightness %.2f against %.2f)" % [at0["n"], plain["n"], at0["wide"], plain["wide"], at0["mean"], plain["mean"]])
	if int(steps[0.3]["wide"]) < int(plain["wide"]) + 6 or int(steps[0.55]["empty_rows"]) < 10 or float(steps[0.3]["mean"]) > 0.92 * float(at0["mean"]):
		bad("a third of the way: torn (wider than she is: %d px against %d), darker (%.2f against %.2f); half way whole slices gone (%d rows)" % [steps[0.3]["wide"], plain["wide"], steps[0.3]["mean"], at0["mean"], steps[0.55]["empty_rows"]])
	if not (int(steps[0.55]["n"]) < 0.8 * int(at0["n"]) and int(steps[0.8]["n"]) < int(steps[0.55]["n"]) and int(steps[0.8]["n"]) < 0.3 * int(at0["n"]) and float(steps[0.55]["mean"]) < 0.5 * float(at0["mean"])):
		bad("the slices go, and what's left is dark (%d, then %d, of %d; brightness %.2f of %.2f)" % [steps[0.55]["n"], steps[0.8]["n"], at0["n"], steps[0.55]["mean"], at0["mean"]])
	if int(steps[1.0]["n"]) > 2 or int(torn["n"]) < 0.7 * int(at0["n"]) or int(torn["wide"]) < int(plain["wide"]) + 6 or absf(float(back["n"]) / float(plain["n"]) - 1.0) > 0.03:
		bad("gone at 1 (%d points), a stutter tears and takes nothing (%d of %d, %d px wide), cleared she's back (%d)" % [steps[1.0]["n"], torn["n"], at0["n"], torn["wide"], back["n"]])
	# the sheet: a character when there's one on the machine, going
	var model: Node3D = fig
	if glb != "" and FileAccess.file_exists(glb):
		var doc := GLTFDocument.new()
		var st := GLTFState.new()
		if doc.append_from_file(glb, st) == OK:
			var made := doc.generate_scene(st) as Node3D
			if made != null:
				fig.visible = false
				stage.add_child(made)
				model = made
	cam.global_position = Vector3(0, 1.05, 2.3)
	mats = HSCreatureSkin.wear(model, look, {"amount": 0.0, "seed": 3.0})
	var sheet := Image.create(1280, 440, false, Image.FORMAT_RGBA8)
	sheet.fill(Color.BLACK)
	var i := 0
	for a in [0.0, 0.25, 0.5, 0.72, 0.9]:
		for m in mats:
			m.set_shader_parameter("amount", a)
		await frames(6)
		var img := await grab()
		sheet.blit_rect(img, Rect2i(640 - 128, 250, 256, 440), Vector2i(i * 256, 0))
		i += 1
	sheet.save_png(out.path_join("phase_sheet.png"))
	HSCreatureSkin.clear(model)
	model.visible = false
	fig.visible = false

	# ---- unease: a lit wall of orange stripes
	cam.global_position = Vector3(0, 1.0, 3.0)
	var wallm := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(12, 6)
	wallm.mesh = q
	var wm := StandardMaterial3D.new()
	wm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var grad := Image.create(64, 4, false, Image.FORMAT_RGBA8)
	for x in 64:
		for y in 4:
			grad.set_pixel(x, y, Color(0.95, 0.55, 0.15) if (x / 4) % 2 == 0 else Color(0.12, 0.1, 0.1))
	wm.albedo_texture = ImageTexture.create_from_image(grad)
	wm.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	wallm.set_surface_override_material(0, wm)
	stage.add_child(wallm)
	wallm.global_position = Vector3(0, 1.0, -1.0)
	var base := await grab()
	var un := HSUnease.new()
	un.follow_sanity = false
	stage.add_child(un)
	un.hold_clock = 3.0
	await frames(4)
	var none := await grab()
	var d_none := box_diff(base, none, 0.0, 0.0, 1.0, 1.0)
	un.set_amount(1.0)
	await frames(120)
	var allp := await grab()
	var corner0 := lum(box_mean(base, 0.0, 0.0, 0.08, 0.1))
	var corner1 := lum(box_mean(allp, 0.0, 0.0, 0.08, 0.1))
	var mid0 := lum(box_mean(base, 0.42, 0.42, 0.58, 0.58))
	var mid1 := lum(box_mean(allp, 0.42, 0.42, 0.58, 0.58))
	var sat0 := sat(box_mean(base, 0.42, 0.42, 0.58, 0.58))
	var sat1 := sat(box_mean(allp, 0.42, 0.42, 0.58, 0.58))
	un.crawl = 0.0
	un.doubled = 0.0
	un.drain = 0.0
	un.warp = 1.0
	await frames(6)
	var warped := await grab()
	var edge_moved := box_diff(base, warped, 0.03, 0.35, 0.14, 0.65)
	var mid_moved := box_diff(base, warped, 0.44, 0.44, 0.56, 0.56)
	un.warp = 0.0
	un.doubled = 1.0
	await frames(6)
	var two := await grab()
	var two_moved := box_diff(base, two, 0.03, 0.35, 0.14, 0.65)
	un.warp = 0.6
	un.doubled = 0.5
	un.crawl = 0.6
	un.drain = 0.4
	say("unease", "at none of it the plain picture (%.4f off it); all of it: a corner %.2f of what it was, the middle %.2f of it, its colour %.2f of it; the edges swimming alone: the edge moved %.3f, the middle %.3f; a second picture alone: the edge %.3f" % [
		d_none, corner1 / maxf(corner0, 0.001), mid1 / maxf(mid0, 0.001), sat1 / maxf(sat0, 0.001), edge_moved, mid_moved, two_moved])
	if d_none > 0.004 or corner1 > 0.4 * corner0 or absf(mid1 / maxf(mid0, 0.001) - 1.0) > 0.25 or sat1 > 0.9 * sat0:
		bad("unease: nothing at 0 (%.4f), the corners dark (%.2f), the middle steady (%.2f), the colour going (%.2f)" % [d_none, corner1 / maxf(corner0, 0.001), mid1 / maxf(mid0, 0.001), sat1 / maxf(sat0, 0.001)])
	if edge_moved < 0.03 or edge_moved < 3.0 * mid_moved or two_moved < 0.02:
		bad("unease: the edges move and the middle doesn't (%.3f against %.3f); a second picture (%.3f)" % [edge_moved, mid_moved, two_moved])
	var sh2 := Image.create(1280, 360, false, Image.FORMAT_RGBA8)
	var b2 := base.duplicate() as Image
	b2.resize(640, 360)
	var a2 := allp.duplicate() as Image
	a2.resize(640, 360)
	sh2.blit_rect(b2, Rect2i(0, 0, 640, 360), Vector2i(0, 0))
	sh2.blit_rect(a2, Rect2i(0, 0, 640, 360), Vector2i(640, 0))
	sh2.save_png(out.path_join("unease_sheet.png"))

	print("MIND result " + JSON.stringify({"errors": errors}))
	quit()
