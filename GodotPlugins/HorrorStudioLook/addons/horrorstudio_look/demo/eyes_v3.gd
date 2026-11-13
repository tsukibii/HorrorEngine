## Eyes v3 (docs/GODOT_LOOK.md §5v; tools/godot/eyes_v3_check.py runs it: EYESV3). A Character Studio export worn as
## the game wears it (HSSkin, HSEye, HSHair), her eyes pictured as the user's reference frames them (DECISIONS
## 2026-11-12, eyes v3: both eyes filling the picture's width, one eye close, the face), under a soft light from the
## front; then her eyes changed by HSEyePaint (the Studio's paint drawn again in Godot): another iris, a pattern, a
## pupil's shape, a bigger iris, the catchlights that stay moved and switched off, her own eyes back; each pictured and
## measured where the eye lands (the iris's colour, the pupil, the white, the catchlights' places against the iris).
##   godot --path PROJECT --rendering-driver vulkan --fixed-fps 60 -s res://addons/horrorstudio_look/demo/eyes_v3.gd -- --glb=res://people/NAME.glb --out=DIR
##         [--shots=pair,eye,face] [--paint=JSON] [--eye=JSON] [--stages=own,blue,...] [--light=soft|dark|lamp] [--tag=NAME] [--gaze=x,y] [--hide=lash]
extends SceneTree

var glb := ""
var out_dir := "res://"
var tag := "v3"
var shots: Array = ["pair", "eye", "face"]
var stages: Array = ["own"]
var paint_json := ""
var eye_json := ""
var light := "soft"
var gaze := Vector2.ZERO          # the eyes turned (degrees: across, up)
var hide: Array = []              # meshes left out, by a word of their names
var world: Node3D
var env: Environment
var cam: Camera3D
var who: Node3D
var painter: HSEyePaint
var rig: Array = []
var eye_l := Vector3.ZERO         # the eyeballs' middles
var eye_r := Vector3.ZERO
var eye_rad := 0.012
var report := {"shots": {}, "stages": {}}
var si := 0
var shi := 0
var n := 0
var waiting := false
var times := {}

## the stages: what's changed on her eyes before each is pictured (HSEyePaint's words), or a word for something else
const STAGES := {
	"own": {},
	"blue": {"iris": "#12365e", "iris2": "#6aa6e0", "pattern": "natural", "fibres": 0.6, "irisBright": 1.6},
	"sunburst": {"iris": "#4a1694", "iris2": "#7b3fd0", "accent": "#ffa21f", "pattern": "sunburst", "burst": 0.62, "detail": 0.55, "fibres": 0.55, "irisBright": 1.6, "pupil": 0.24},
	"slit": {"iris": "#7f8a06", "iris2": "#e6d23a", "accent": "#ff7a00", "pattern": "sunburst", "pupilShape": "slit", "pupil": 0.38, "irisBright": 1.6},
	"heart": {"iris": "#c9798f", "iris2": "#f0b5c4", "pattern": "natural", "pupilShape": "heart", "pupil": 0.36, "irisBright": 1.5},
	"big": {"irisSize": 40.0},
	"small": {"irisSize": 26.0},
	"nocatch": {"catchKeep": 0.0},
	"moved": {"catchKeep": 1.0, "catchX": -0.4, "catchY": 0.35, "catch2X": 0.35, "catch2Y": -0.3},
	"warm": {"whiteWarm": 0.6, "whiteBright": 0.45},
}


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--glb="):
			glb = a.substr(6)
		elif a.begins_with("--tag="):
			tag = a.substr(6)
		elif a.begins_with("--shots="):
			shots = Array(a.substr(8).split(","))
		elif a.begins_with("--stages="):
			stages = Array(a.substr(9).split(","))
		elif a.begins_with("--paint="):
			paint_json = a.substr(8)
		elif a.begins_with("--eye="):
			eye_json = a.substr(6)
		elif a.begins_with("--light="):
			light = a.substr(8)
		elif a.begins_with("--hide="):                       # meshes left out by a word of their names (lash: the lids' skin alone)
			hide = Array(a.substr(7).split(","))
		elif a.begins_with("--gaze="):
			var g := a.substr(7).split(",")
			gaze = Vector2(float(g[0]), float(g[1]) if g.size() > 1 else 0.0)
	root.size = Vector2i(1280, 720)
	world = Node3D.new()
	root.add_child(world)
	env = Environment.new()
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var ps = load(glb) if ResourceLoader.exists(glb) else null
	if ps != null:
		who = ps.instantiate()
	else:
		var doc := GLTFDocument.new()
		var st := GLTFState.new()
		if doc.append_from_file(glb, st) == OK:
			who = doc.generate_scene(st)
	if who == null:
		print("EYESV3 FAIL: no glb at " + glb)
		quit(1)
		return
	world.add_child(who)
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		for h in hide:
			if String(mi.name).to_lower().contains(String(h).to_lower()):
				mi.visible = false
	HSSkin.wear(who, {}, glb)
	var over = JSON.parse_string(eye_json) if eye_json != "" else {}
	report["eye_mats"] = HSEye.wear(who, glb, over if over is Dictionary else {}).size()
	HSHair.wear(who, {}, glb)
	var bl = who.get_node_or_null("HSBlink")
	if bl != null:
		bl.idle = false
		bl.hold = Vector2.ZERO
	painter = HSEyePaint.attach(who)
	report["painter"] = painter != null
	report["eyes"] = painter.eyes.size() if painter != null else 0
	if painter != null:
		report["own"] = painter.paint("L")
	print("EYESV3 stages ", stages, " shots ", shots)


## where her eyes are (once she's in the tree), the camera and the light
func stage_up() -> void:
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		if mi.name.ends_with("_eye_L"):
			eye_l = (mi.global_transform * mi.get_aabb()).get_center()
			eye_rad = 0.5 * minf(mi.get_aabb().size.x, mi.get_aabb().size.y)
		elif mi.name.ends_with("_eye_R"):
			eye_r = (mi.global_transform * mi.get_aabb()).get_center()
	report["eye_l"] = [eye_l.x, eye_l.y, eye_l.z]
	report["eye_r"] = [eye_r.x, eye_r.y, eye_r.z]
	report["eye_radius"] = eye_rad
	if gaze != Vector2.ZERO:
		turn_eyes()
	cam = Camera3D.new()
	world.add_child(cam)
	cam.current = true
	lights()

## her eyes turned on their bones (the export's eyes are skinned to them): the gaze, for a catchlight sliding over the iris
func turn_eyes() -> void:
	for sk in who.find_children("*", "Skeleton3D", true, false):
		for nm in ["l_eye", "r_eye"]:
			var b: int = sk.find_bone(nm)
			if b >= 0:
				sk.set_bone_pose_rotation(b, sk.get_bone_pose_rotation(b) * Quaternion.from_euler(Vector3(deg_to_rad(-gaze.y), deg_to_rad(gaze.x), 0.0)))


## the light: `soft` a big soft key from the front and a little above (the reference's: a beauty light, the room dim and
## rosy), `lamp` the game's warm ceiling lamp, `dark` the room's dim ambient alone; the game's balanced look
func lights() -> void:
	for l in rig:
		l.queue_free()
	rig.clear()
	HSLook.apply(root, env, "balanced")
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.09, 0.07, 0.065)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	env.fog_enabled = false
	env.volumetric_fog_enabled = false
	var mid := (eye_l + eye_r) * 0.5
	if light == "dark":
		env.ambient_light_color = Color(0.4, 0.42, 0.5)
		env.ambient_light_energy = 0.04
		return
	if light == "lamp":
		env.ambient_light_color = Color(0.5, 0.45, 0.4)
		env.ambient_light_energy = 0.3
		var lamp := OmniLight3D.new()
		lamp.position = mid + Vector3(0.4, 0.9, 0.7)
		lamp.light_energy = 1.6
		lamp.omni_range = 6.0
		lamp.light_color = Color(1.0, 0.82, 0.6)
		lamp.shadow_enabled = true
		world.add_child(lamp)
		rig.append(lamp)
		return
	env.ambient_light_color = Color(0.62, 0.5, 0.52)
	env.ambient_light_energy = 0.55
	var key := OmniLight3D.new()
	key.position = mid + Vector3(0.18, 0.3, 1.1)
	key.light_energy = 1.5
	key.omni_range = 8.0
	key.light_size = 0.3
	key.light_color = Color(1.0, 0.93, 0.92)
	key.shadow_enabled = true
	key.shadow_blur = 2.0
	var fill := OmniLight3D.new()
	fill.position = mid + Vector3(-0.5, -0.25, 0.9)
	fill.light_energy = 0.5
	fill.omni_range = 8.0
	fill.light_color = Color(0.95, 0.88, 0.95)
	for l in [key, fill]:
		world.add_child(l)
		rig.append(l)


func shoot(name: String) -> void:
	var mid := (eye_l + eye_r) * 0.5
	match name:
		"pair":                                      # both eyes across the picture, as the reference's first picture (about 10 cm across)
			cam.fov = 4.33 * (eye_l.x - eye_r.x) / 0.0673      # (her eyes' middles 0.668 of the picture's width apart, as the reference's)
			cam.position = mid + Vector3(0.0, -0.003, 0.75)
			cam.look_at(mid + Vector3(0.0, -0.003, 0.0))
		"eye":                                       # her left eye alone (about 4 cm across)
			cam.fov = 1.72
			cam.position = eye_l + Vector3(0.0, -0.001, 0.75)
			cam.look_at(eye_l + Vector3(0.0, -0.001, 0.0))
		"face":                                      # the face, as the reference's second picture
			cam.fov = 13.0
			cam.position = mid + Vector3(0.0, -0.03, 0.85)
			cam.look_at(mid + Vector3(0.0, -0.03, 0.0))
		"pov":                                       # the game's own medium shot (the player's 90 degree lens at 1.2 m)
			cam.fov = rad_to_deg(2.0 * atan(tan(deg_to_rad(45.0)) * 9.0 / 16.0))
			cam.position = mid + Vector3(0.1, 0.0, 1.2)
			cam.look_at(mid + Vector3(0, -0.06, 0))
		"side":                                      # her left eye from 50 degrees to her left (the iris behind the cornea, the catchlights sliding)
			cam.fov = 2.2
			cam.position = eye_l + Vector3(0.575, 0.0, 0.48)
			cam.look_at(eye_l)


## an eye in a picture: where its middle lands and how many pixels a millimetre is there
func eye_px(c: Vector3) -> Dictionary:
	var p := cam.unproject_position(c + Vector3(0, 0, eye_rad))
	var q := cam.unproject_position(c + Vector3(0.001, 0, eye_rad))
	return {"x": p.x, "y": p.y, "px_mm": absf(q.x - p.x)}


## the measures of one eye in a picture: the iris's mean colour (a ring between the pupil and the limbus), the pupil's,
## the white's (beside the iris, toward each corner), the brightest points over the iris (the catchlights) as places
## against the iris's middle in iris radii (x to the picture's right, y up)
func measure(img: Image, c: Vector3, rho_mm: float, pupil: float) -> Dictionary:
	var e := eye_px(c)
	var k: float = e["px_mm"]
	var cx: float = e["x"]
	var cy: float = e["y"]
	var R := rho_mm * k
	var out := {"cx": cx, "cy": cy, "iris_px": R}
	var iris := Vector3.ZERO
	var ni := 0
	var pup := Vector3.ZERO
	var np := 0
	var bright: Array = []
	var x0 := int(maxf(0.0, cx - R * 1.9))
	var x1 := int(minf(img.get_width() - 1.0, cx + R * 1.9))
	var y0 := int(maxf(0.0, cy - R * 1.1))
	var y1 := int(minf(img.get_height() - 1.0, cy + R * 1.1))
	var wl := Vector3.ZERO
	var nw := 0
	for y in range(y0, y1 + 1):
		for x in range(x0, x1 + 1):
			var d := Vector2(x - cx, y - cy).length() / R
			var col := img.get_pixel(x, y)
			var v := Vector3(col.r, col.g, col.b)
			var lum := col.get_luminance()
			if d < 1.0 and lum > 0.82:
				bright.append([(x - cx) / R, -(y - cy) / R, lum])
			elif d > pupil * 1.25 and d < 0.8 and absf(y - cy) < R * 0.35:
				iris += v
				ni += 1
			elif d < pupil * 0.6:
				pup += v
				np += 1
			elif d > 1.25 and d < 1.75 and absf(y - cy) < R * 0.3:
				wl += v
				nw += 1
	# the pupil's shape: the dark points along the row and the column through the iris's middle, in iris radii
	var across := 0
	var down := 0
	for i in range(int(-R), int(R) + 1):
		if img.get_pixel(clampi(int(cx) + i, 0, img.get_width() - 1), int(cy)).get_luminance() < 0.035:
			across += 1
		if img.get_pixel(int(cx), clampi(int(cy) + i, 0, img.get_height() - 1)).get_luminance() < 0.035:
			down += 1
	# how wide the iris is drawn (mm): out from its middle along the row until the white (a dark iris: under 0.3)
	var run := 0
	for dirn in [-1, 1]:
		for i in range(1, int(R * 2.2)):
			var xx: int = int(cx) + int(dirn) * i
			if xx < 0 or xx >= img.get_width() or img.get_pixel(xx, int(cy + 0.15 * R)).get_luminance() > 0.3:
				break
			run += 1
	out["iris_mm"] = run / maxf(k, 0.001)
	out["pupil_w"] = across / maxf(2.0 * R, 1.0)
	out["pupil_h"] = down / maxf(2.0 * R, 1.0)
	out["iris"] = [iris.x / maxf(ni, 1), iris.y / maxf(ni, 1), iris.z / maxf(ni, 1)]
	out["pupil"] = [pup.x / maxf(np, 1), pup.y / maxf(np, 1), pup.z / maxf(np, 1)]
	out["white"] = [wl.x / maxf(nw, 1), wl.y / maxf(nw, 1), wl.z / maxf(nw, 1)]
	out["bright_px"] = bright.size()
	# the bright points gathered into spots (within a fifth of the iris of each other)
	var spots: Array = []
	for b in bright:
		var hit := false
		for s in spots:
			if Vector2(b[0] - s["x"] / s["w"], b[1] - s["y"] / s["w"]).length() < 0.22:
				s["x"] += b[0] * b[2]
				s["y"] += b[1] * b[2]
				s["w"] += b[2]
				s["n"] += 1
				hit = true
				break
		if not hit:
			spots.append({"x": b[0] * b[2], "y": b[1] * b[2], "w": b[2], "n": 1})
	var places: Array = []
	for s in spots:
		places.append({"x": s["x"] / s["w"], "y": s["y"] / s["w"], "n": s["n"]})
	places.sort_custom(func(a, b): return a["n"] > b["n"])
	out["spots"] = places
	return out


## Godot's picture of each eye's own record against the picture the Studio baked into the export: the mean and the
## largest difference a channel (0..1), over the white and over the iris's disc
func against_bake() -> Dictionary:
	var out := {}
	for e in painter.eyes:
		var a: Texture2D = e["paint0"]
		var b = e["material"].get_shader_parameter("paint")
		if a == null or b == null:
			continue
		var ia: Image = a.get_image()
		var ib: Image = b.get_image()
		ia.decompress()
		ia.convert(Image.FORMAT_RGB8)
		ib.convert(Image.FORMAT_RGB8)
		if ia.get_size() != ib.get_size():
			ib.resize(ia.get_width(), ia.get_height(), Image.INTERPOLATE_BILINEAR)
		var n := ia.get_width()
		var rho := float(e["rec"].get("shape", {}).get("rho", 0.5))
		var sum_i := 0.0
		var sum_w := 0.0
		var ni := 0
		var nw := 0
		var worst := 0.0
		for y in range(0, n, 4):
			for x in range(0, n, 4):
				var r := Vector2((x + 0.5) / n * 2.0 - 1.0, (y + 0.5) / n * 2.0 - 1.0).length()
				if r > 0.97:
					continue
				var ca := ia.get_pixel(x, y)
				var cb := ib.get_pixel(x, y)
				var d := (absf(ca.r - cb.r) + absf(ca.g - cb.g) + absf(ca.b - cb.b)) / 3.0
				worst = maxf(worst, d)
				if r < rho:
					sum_i += d
					ni += 1
				else:
					sum_w += d
					nw += 1
		out[e["side"]] = {"iris": sum_i / maxf(ni, 1), "white": sum_w / maxf(nw, 1), "worst": worst, "size": n}
	return out


func _process(_d: float) -> bool:
	if waiting:
		return false
	if cam == null:
		stage_up()
	n += 1
	if n == 1:
		var st: String = stages[si]
		if shi == 0:
			var t0 := Time.get_ticks_usec()
			if st.begins_with("reset"):                    # her own eyes again ("reset", or "reset_<anything>" between two changes)
				if painter != null:
					painter.reset()
			elif st == "redraw":                           # her own numbers drawn by Godot: its picture against the one the Studio baked
				if painter != null:
					waiting = true
					painter.painted.connect(func():
						report["redraw"] = against_bake()
						waiting = false, CONNECT_ONE_SHOT)
					painter.redraw()
			elif st == "dark":
				light = "dark"
				lights()
			elif st == "glow":
				light = "dark"
				lights()
				if painter != null:
					painter.set_paint({"catchKeep": 1.0, "catchGlow": 2.0})
			elif painter != null:
				var ch: Dictionary = STAGES.get(st, {}).duplicate()
				if st == "own" and paint_json != "":
					var pj = JSON.parse_string(paint_json)
					if pj is Dictionary:
						ch = pj
				if not ch.is_empty():
					waiting = true
					painter.painted.connect(func(): waiting = false, CONNECT_ONE_SHOT)
					painter.set_paint(ch)
			times[st] = Time.get_ticks_usec() - t0
		shoot(shots[shi])
	if n < 26:                                           # TAA, the scattering and a new picture's mips settle
		return false
	var st: String = stages[si]
	var name: String = shots[shi]
	var img := root.get_texture().get_image()
	img.save_png(out_dir.path_join("%s_%s_%s.png" % [tag, st, name]))
	var rec := {}
	if name in ["pair", "eye"] and painter != null:
		var p := painter.paint("L")
		var rho_mm: float = 12.0 * sin(deg_to_rad(float(p.get("irisSize", 31.0))))
		rec["L"] = measure(img, eye_l, rho_mm, float(p.get("pupil", 0.31)))
		if name == "pair":
			rec["R"] = measure(img, eye_r, rho_mm, float(p.get("pupil", 0.31)))
	if not report["stages"].has(st):
		report["stages"][st] = {"bakes": painter.bakes if painter != null else 0, "paint": painter.changes("L") if painter != null else {}}
	report["stages"][st][name] = rec
	n = 0
	shi += 1
	if shi >= shots.size():
		shi = 0
		si += 1
		if si >= stages.size():
			var f := FileAccess.open(out_dir.path_join(tag + ".json"), FileAccess.WRITE)
			f.store_string(JSON.stringify(report, "  "))
			f.close()
			print("EYESV3 {done}")
			return true
	return false
