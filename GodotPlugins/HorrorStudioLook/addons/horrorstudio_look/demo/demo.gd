## The look plugin's demo and check (docs/GODOT_LOOK.md; tools/godot/plugin_check.py runs it: LOOKPLUGIN): a small
## room (a floor, walls, a lamp with its bulb, a cool fill), pictured with each part of the plugin in turn: the plain
## look and the realism preset, the floor wet with puddles and rain's rings, blood on the floor and up the wall, the
## rain, and three skin spheres (dry, sweating, oiled). Each picture is measured (report.json) so a change that
## breaks a part is seen: the lamp's reflection in the wet floor, the rain moving between frames, the blood's red,
## the sweat's glints and the oil's gloss against dry skin.
##   godot --path PROJECT -s res://addons/horrorstudio_look/demo/demo.gd -- --out=DIR
extends SceneTree

var out_dir := "res://"
var only := ""                 # --only=<stage>: that stage alone (its setup after the realism preset), for a quick look
var n := 0
var stage := 0
var env: Environment
var world: Node3D
var cam: Camera3D
var floor_mi: MeshInstance3D
var rain: HSRain = null
var nosplash: Image = null
var mirror_q: MeshInstance3D = null
var mirror2_q: MeshInstance3D = null
var spheres: Array = []
var report := {}
var prev: Image = null
var skin_mode := false
var near_q: MeshInstance3D = null      # the softener's stage: a fine checker close, one far, a glow between
var far_q: MeshInstance3D = null
var glow_q: MeshInstance3D = null
var pat_spot: SpotLight3D = null       # the pattern stage: caustics thrown on the back wall
var pat_prev: Image = null
var splash_sum := 0.0
var shaft_fv: HSShaft = null
var shaft_off: Image = null
var sweep_n: HSSweep = null
var sweep_before: Image = null
var iris_lamp: OmniLight3D = null
var leak_n: HSLeak = null
var leak_wall: MeshInstance3D = null
var leak_dry: Image = null
var iris_means: Dictionary = {}
var splash_peak := 0.0
var splash_n := 0

const STAGES := ["plain", "realism", "wet", "blood_rain", "mirror", "skin", "soften_off", "soften", "pattern", "shaft", "sweep", "iris", "leak"]


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		if a.begins_with("--only="):
			only = a.substr(7)
	root.size = Vector2i(1280, 720)
	world = Node3D.new()
	root.add_child(world)
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.02, 0.025, 0.04)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.45, 0.5, 0.65)
	env.ambient_light_energy = 0.25
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	cam = Camera3D.new()
	cam.fov = 75
	world.add_child(cam)
	cam.look_at_from_position(Vector3(0, 1.5, 3.0), Vector3(0, 0.55, -1.0))   # not in the tree yet: look_at alone errors
	# the room
	floor_mi = box(Vector3(8, 0.1, 8), Vector3(0, -0.05, 0), Color(0.36, 0.31, 0.27), 0.92)
	box(Vector3(8, 3, 0.1), Vector3(0, 1.5, -3.05), Color(0.5, 0.48, 0.44), 0.9)
	box(Vector3(0.1, 3, 8), Vector3(-4.05, 1.5, 0), Color(0.5, 0.48, 0.44), 0.9)
	box(Vector3(0.1, 3, 8), Vector3(4.05, 1.5, 0), Color(0.5, 0.48, 0.44), 0.9)
	box(Vector3(1.2, 0.75, 0.6), Vector3(-2.2, 0.375, -1.8), Color(0.35, 0.22, 0.14), 0.7)   # a table
	box(Vector3(0.4, 0.9, 0.4), Vector3(2.4, 0.45, -1.6), Color(0.6, 0.62, 0.66), 0.25)     # a glossy cabinet
	# the lamp: a bulb to see in the floor
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(0, 2.3, -1.2)
	lamp.light_energy = 5.0
	lamp.omni_range = 9.0
	lamp.light_color = Color(1.0, 0.85, 0.65)
	lamp.shadow_enabled = true
	world.add_child(lamp)
	var bulb := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.06
	sm.height = 0.12
	bulb.mesh = sm
	var bm := StandardMaterial3D.new()
	bm.emission_enabled = true
	bm.emission = Color(1.0, 0.85, 0.6)
	bm.emission_energy_multiplier = 8.0
	bulb.material_override = bm
	bulb.position = lamp.position
	world.add_child(bulb)
	var fill := OmniLight3D.new()
	fill.position = Vector3(3, 1.0, 2.5)
	fill.light_energy = 0.8
	fill.omni_range = 7.0
	fill.light_color = Color(0.55, 0.65, 1.0)
	world.add_child(fill)
	stage = 0
	HSLook.apply(root, env, "plain")
	if only != "" and STAGES.has(only):
		stage = STAGES.find(only)
		HSLook.apply(root, env, "realism")
		setup(only)


func box(size: Vector3, at: Vector3, col: Color, rough: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = rough
	mi.material_override = m
	mi.position = at
	world.add_child(mi)
	return mi


func shot(name: String) -> Image:
	var img := root.get_texture().get_image()
	img.save_png(out_dir.path_join(name + ".png"))
	return img


## the mean luminance in a box of the picture (pixels), and its max
func measure(img: Image, x0: int, y0: int, x1: int, y1: int) -> Dictionary:
	var sum := 0.0
	var mx := 0.0
	var cnt := 0
	var red := 0
	for y in range(y0, y1):
		for x in range(x0, x1):
			var c := img.get_pixel(x, y)
			var l := c.r * 0.3 + c.g * 0.59 + c.b * 0.11
			sum += l
			mx = max(mx, l)
			cnt += 1
			if c.r > 0.12 and c.r > c.g * 2.2 and c.r > c.b * 2.2:
				red += 1
	return {"mean": sum / max(cnt, 1), "max": mx, "red": red}


## where a flat quad lands in the picture (pixels)
func screen_rect(q: MeshInstance3D, size: Vector2) -> Rect2i:
	var lo := Vector2(1e9, 1e9)
	var hi := Vector2(-1e9, -1e9)
	for sx in [-0.5, 0.5]:
		for sy in [-0.5, 0.5]:
			var s := cam.unproject_position(q.global_transform * Vector3(sx * size.x, sy * size.y, 0))
			lo = lo.min(s)
			hi = hi.max(s)
	var vs := root.get_visible_rect().size
	lo = lo.clamp(Vector2.ZERO, vs - Vector2(1, 1))
	hi = hi.clamp(Vector2.ZERO, vs - Vector2(1, 1))
	return Rect2i(Vector2i(lo) + Vector2i(2, 2), Vector2i(hi - lo) - Vector2i(4, 4))


## how sharp a box of the picture is: the variance of its Laplacian (edges strong or smeared)
func sharpness(img: Image, r: Rect2i) -> float:
	var sum := 0.0
	var sq := 0.0
	var cnt := 0
	for y in range(r.position.y + 1, r.end.y - 1):
		for x in range(r.position.x + 1, r.end.x - 1):
			var l := 4.0 * img.get_pixel(x, y).get_luminance() - img.get_pixel(x - 1, y).get_luminance() - img.get_pixel(x + 1, y).get_luminance() - img.get_pixel(x, y - 1).get_luminance() - img.get_pixel(x, y + 1).get_luminance()
			sum += l
			sq += l * l
			cnt += 1
	if cnt == 0:
		return 0.0
	var m := sum / cnt
	return sq / cnt - m * m


func checker_quad(size: float, cells: int, at: Vector3) -> MeshInstance3D:
	var img := Image.create(64, 64, false, Image.FORMAT_RGB8)
	for y in 64:
		for x in 64:
			var on := ((x / 8) + (y / 8)) % 2 == 0
			img.set_pixel(x, y, Color(0.9, 0.9, 0.9) if on else Color(0.1, 0.1, 0.1))
	var tex := ImageTexture.create_from_image(img)
	var q := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(size, size)
	q.mesh = qm
	var m := StandardMaterial3D.new()
	m.albedo_texture = tex
	m.uv1_scale = Vector3(cells / 8.0, cells / 8.0, 1.0)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED                # its contrast the texture's own, wherever the lamp is
	q.material_override = m
	q.position = at
	world.add_child(q)
	return q


func diff(a: Image, b: Image, x0: int, y0: int, x1: int, y1: int) -> float:
	var s := 0.0
	var cnt := 0
	for y in range(y0, y1, 2):
		for x in range(x0, x1, 2):
			var p := a.get_pixel(x, y)
			var q := b.get_pixel(x, y)
			s += abs(p.r - q.r) + abs(p.g - q.g) + abs(p.b - q.b)
			cnt += 1
	return s / max(cnt, 1)


func _process(_d: float) -> bool:
	n += 1
	if STAGES[stage] == "blood_rain" and n == 16 and prev == null:
		prev = root.get_texture().get_image()  # a frame before the shot: the rain has moved by it
	if STAGES[stage] == "blood_rain" and n == 20 and rain != null:
		rain.set_splashes(false)                # a frame without the splashes, to measure what they add to the floor
	if STAGES[stage] == "blood_rain" and n == 22 and rain != null:
		nosplash = root.get_texture().get_image()
		rain.set_splashes(true)
	if STAGES[stage] == "blood_rain" and n >= 24 and n < 30 and rain != null:   # six frames with the splashes: their glints are sparse, one still can miss them
		var m := measure(root.get_texture().get_image(), 200, 480, 1080, 720)
		splash_sum += m["mean"]
		splash_peak = max(splash_peak, m["max"])
		splash_n += 1
		if n < 29:
			return false
	if STAGES[stage] == "pattern" and n == 70:
		pat_prev = root.get_texture().get_image()  # before the shot: the caustics have moved by it (the loop drawn by then; its clock run on two seconds)
		pat_prev.save_png(out_dir.path_join("pattern_before.png"))
		var hp0 = pat_spot.get_node_or_null("Pattern")
		if hp0 != null:
			hp0.clock += 2.0
	if STAGES[stage] == "pattern" and n < 90:
		return false
	if STAGES[stage] == "shaft" and n == 40 and shaft_fv != null:
		shaft_off = root.get_texture().get_image()   # the haze settled without the beam; then the beam, and frames for it to settle
		shaft_off.save_png(out_dir.path_join("shaft_off.png"))
		shaft_fv.visible = true
	if STAGES[stage] == "shaft" and n < 90:
		return false
	if STAGES[stage] == "sweep" and n == 60 and sweep_n != null:          # late enough for the shaft stage's fog to have faded
		sweep_before = root.get_texture().get_image()
		sweep_before.save_png(out_dir.path_join("sweep_before.png"))
		sweep_n.fire()                                     # the car, then its clock run on to mid-pass and held there for the shot (the pass made very long)
		sweep_n.clock += 0.5 * sweep_n.secs
	if STAGES[stage] == "sweep" and n < 90:
		return false
	if STAGES[stage] == "leak":
		if n == 40 and leak_n != null:
			leak_dry = root.get_texture().get_image()         # the wall dry (the band at zero), then wet
			leak_n.set_wet(0.85)
		if n < 160:                                           # frames for the drips (the check runs at a fixed 60 fps: two seconds)
			return false
	if STAGES[stage] == "iris":
		if n == 60:
			iris_means["settled"] = measure(root.get_texture().get_image(), 300, 100, 980, 620)["mean"]
			iris_lamp.light_energy = 30.0                        # a bright light on: the iris closes against it
		if n == 150:
			iris_means["closed"] = measure(root.get_texture().get_image(), 300, 100, 980, 620)["mean"]
			HSLook.iris(root, false)                             # the iris off: the same light, the eye wide open
		if n == 210:
			iris_means["open"] = measure(root.get_texture().get_image(), 300, 100, 980, 620)["mean"]
			HSLook.iris(root, true, true)                        # night: held a stop under
		if n < 280:
			return false
	if n < 24:                                 # the first frames: TAA settles, the lamp's shadow maps
		return false
	var name: String = STAGES[stage]
	match name:
		"plain":
			var img := shot("look_plain")
			report["plain"] = measure(img, 500, 600, 780, 720)          # the floor where the lamp's reflection lies
		"realism":
			var img := shot("look_realism")
			report["realism"] = measure(img, 500, 600, 780, 720)
		"wet":
			var img := shot("wet")
			report["wet"] = measure(img, 500, 600, 780, 720)
		"blood_rain":
			var img := shot("blood_rain")
			report["blood"] = measure(img, 0, 300, 1280, 720)
			if prev != null:
				report["rain_motion"] = diff(prev, img, 300, 100, 980, 500)
			if nosplash != null:                 # the floor in view (the rain's box reaches it): the splashes' glints, over the same floor without them
				var without := measure(nosplash, 200, 480, 1080, 720)
				report["splash_glow"] = splash_sum / max(splash_n, 1) - without["mean"]
				report["splash_peak"] = splash_peak - without["max"]
			prev = null
		"mirror":
			var img := shot("mirror")
			var r := screen_rect(mirror_q, Vector2(1.0, 1.4))
			var top := measure(img, r.position.x, r.position.y, r.end.x, int((r.position.y + r.end.y) / 2))
			var bottom := measure(img, r.position.x, int((r.position.y + r.end.y) / 2), r.end.x, r.end.y)
			var wall := measure(img, max(r.position.x - 160, 0), r.position.y, max(r.position.x - 10, 1), r.end.y)   # the wall beside it
			report["mirror_top"] = top
			report["mirror_bottom"] = bottom
			report["mirror_wall"] = wall
			var hm := mirror_q.get_node("Mirror") as HSMirror
			report["mirror_frames"] = hm.frames
			var mv: Image = hm.view.get_texture().get_image()
			mv.save_png(out_dir.path_join("mirror_view.png"))   # what the mirror's camera sees
			var hm2 := mirror2_q.get_node("Mirror") as HSMirror   # the second mirror as the first's camera sees it: its glass with the room in it, not a hole or a flat wall
			var lo := Vector2(1e9, 1e9)
			var hi := Vector2(-1e9, -1e9)
			var vs := Vector2(mv.get_width(), mv.get_height())
			for sx in [-0.5, 0.5]:
				for sy in [-0.5, 0.5]:
					var sp := hm.mcam.unproject_position(mirror2_q.global_transform * Vector3(sx * 1.0, sy * 1.4, 0)) / Vector2(hm.view.size) * vs
					lo = lo.min(sp)
					hi = hi.max(sp)
			lo = lo.clamp(Vector2.ZERO, vs - Vector2(2, 2))
			hi = hi.clamp(Vector2.ZERO, vs - Vector2(1, 1))
			var in2 := measure(mv, int(lo.x) + 1, int(lo.y) + 1, max(int(hi.x), int(lo.x) + 2), max(int(hi.y), int(lo.y) + 2))
			report["mirror2_in_first"] = in2
			report["mirror2_layers"] = {"first": hm.layer, "second": hm2.layer, "second_seen_by_first": (hm.mcam.cull_mask & (1 << (hm2.layer - 1))) != 0, "first_not_itself": (hm.mcam.cull_mask & (1 << (hm.layer - 1))) == 0, "active2": hm2.active}
			print("MIRROR normal ", hm.normal, " centre ", hm.centre, " corners ", hm.corners.size(), " in frustum ", cam.is_position_in_frustum(mirror_q.global_transform * hm.centre), " d ", (cam.global_position - mirror_q.global_transform * hm.centre).dot(mirror_q.global_transform.basis * hm.normal))
			print("MIRROR eye ", hm.mcam.global_position, " near ", hm.mcam.near, " active ", hm.active, " vp ", hm.mat.get_shader_parameter("mirror_vp"))
		"skin":
			var img := shot("skin")
			report["skin_dry"] = measure(img, 170, 160, 480, 560)
			report["skin_sweat"] = measure(img, 480, 160, 800, 560)
			report["skin_oil"] = measure(img, 800, 160, 1110, 560)
			report["glint_dry"] = measure(img, 325, 360, 480, 560)      # the lower right of each sphere: the fill's glint
			report["glint_sweat"] = measure(img, 640, 360, 800, 560)
			report["glint_oil"] = measure(img, 955, 360, 1110, 560)
		"soften_off", "soften":
			var img := shot(name)
			var tag := "off" if name == "soften_off" else "on"
			report["soften_near_" + tag] = sharpness(img, screen_rect(near_q, Vector2(0.5, 0.5)))
			report["soften_far_" + tag] = sharpness(img, screen_rect(far_q, Vector2(3.0, 3.0)))
			report["soften_glow_" + tag] = measure(img, screen_rect(glow_q, Vector2(0.12, 0.12)).position.x - 2, screen_rect(glow_q, Vector2(0.12, 0.12)).position.y - 2, screen_rect(glow_q, Vector2(0.12, 0.12)).end.x + 2, screen_rect(glow_q, Vector2(0.12, 0.12)).end.y + 2)
			if name == "soften":
				var sft := HSSoften.on(cam)
				report["soften_frames"] = sft.frames if sft != null else -1
		"leak":
			var img := shot("leak")
			var lo := Vector2(1e9, 1e9)                                       # the band's strip on the left wall's face, in the picture
			var hi := Vector2(-1e9, -1e9)
			for wy in [0.3, 2.6]:
				for wz in [-1.4, -0.2]:
					var sp := cam.unproject_position(Vector3(-3.99, wy, wz))
					lo = lo.min(sp)
					hi = hi.max(sp)
			var vs := root.get_visible_rect().size
			lo = lo.clamp(Vector2.ZERO, vs - Vector2(2, 2))
			hi = hi.clamp(Vector2.ZERO, vs - Vector2(1, 1))
			var box := Rect2i(Vector2i(lo) + Vector2i(2, 2), Vector2i(hi - lo) - Vector2i(4, 4))
			var wet_ := measure(img, box.position.x, box.position.y, box.end.x, box.end.y)
			var dry := measure(leak_dry, box.position.x, box.position.y, box.end.x, box.end.y) if leak_dry != null else wet_
			report["leak_wet"] = wet_
			report["leak_dry"] = dry
			report["leak_drops"] = leak_n.drops if leak_n != null else 0
		"iris":
			var img := shot("iris")
			iris_means["night"] = measure(img, 300, 100, 980, 620)["mean"]
			report["iris"] = iris_means
		"sweep":
			var img := shot("sweep")
			var box := Rect2i(0, 0, 1280, 360)                            # the upper half: the left wall and the ceiling the headlights land on
			var with_ := measure(img, box.position.x, box.position.y, box.end.x, box.end.y)
			var before := measure(sweep_before, box.position.x, box.position.y, box.end.x, box.end.y) if sweep_before != null else with_
			report["sweep_on"] = with_
			report["sweep_before"] = before
			report["sweep_gain"] = with_["mean"] - before["mean"]
			report["sweep_passing"] = 1 if sweep_n != null and sweep_n.passing() else 0
			if sweep_n != null:
				print("SWEEP lamp at ", sweep_n.lamp.global_position, " energy ", sweep_n.lamp.light_energy, " visible ", sweep_n.lamp.visible, " passing ", sweep_n.passing(), " clock ", sweep_n.clock, " started ", sweep_n.started, " aimed ", -sweep_n.lamp.global_transform.basis.z)
		"shaft":
			var img := shot("shaft")
			var box := Rect2i(360, 150, 420, 200)                        # the air the beam crosses, against the dark back of the room
			var with_ := measure(img, box.position.x, box.position.y, box.end.x, box.end.y)
			var without := measure(shaft_off, box.position.x, box.position.y, box.end.x, box.end.y) if shaft_off != null else with_
			report["shaft_on"] = with_
			report["shaft_off"] = without
			report["shaft_gain"] = with_["mean"] - without["mean"]
		"pattern":
			var img := shot("pattern")
			var box := Rect2i(420, 180, 180, 150)                        # the back wall left of the mirror, where the spot lands
			report["pattern_lit"] = measure(img, box.position.x, box.position.y, box.end.x, box.end.y)
			var sum := 0.0
			var sq := 0.0
			var cnt := 0
			for y in range(box.position.y, box.end.y, 2):
				for x in range(box.position.x, box.end.x, 2):
					var l := img.get_pixel(x, y).get_luminance()
					sum += l
					sq += l * l
					cnt += 1
			report["pattern_var"] = sq / cnt - (sum / cnt) * (sum / cnt)   # the caustics' light and dark over the wall
			report["pattern_motion"] = diff(pat_prev, img, box.position.x, box.position.y, box.end.x, box.end.y) if pat_prev != null else 0.0
			var hp = pat_spot.get_node_or_null("Pattern")
			report["pattern_attached"] = 1 if hp != null and hp is HSPattern and pat_spot.light_projector != null and hp.textures.size() == 40 else 0
	stage += 1
	if stage >= STAGES.size() or only != "":
		finish()
		return true
	setup(STAGES[stage])
	n = 0
	return false


## a stage's things, put in before its frames run
func setup(name: String) -> void:
	match name:
		"realism":
			HSLook.apply(root, env, "realism")
		"wet":
			HSWet.wet(floor_mi, {"wetness": 0.85, "puddles": 0.55, "puddle_scale": 1.1, "ripples": 0.8})
		"blood_rain":
			HSBlood.splat(world, Vector3(0.9, 0.0, -0.3), Vector3.UP, 0.8, 3.0)
			HSBlood.splat(world, Vector3(-1.0, 1.2, -3.0), Vector3.BACK, 0.7, 5.0)
			HSBlood.splat(world, Vector3(-0.3, 0.0, 0.9), Vector3.UP, 0.35, 8.0)
			HSWet.puddle(world, Vector3(-1.6, 0.0, 1.2), 0.9, 3)   # one puddle as a decal, beside the wet floor's pools
			var pane := MeshInstance3D.new()                           # a window pane with the rain running down it
			var qm := QuadMesh.new()
			qm.size = Vector2(1.2, 1.1)
			pane.mesh = qm
			world.add_child(pane)
			pane.position = Vector3(2.2, 1.3, 0.4)
			pane.rotation_degrees.y = -25.0
			HSGlass.set_rain(HSGlass.pane(pane, Vector2(1.2, 1.1), 2.0), 0.9)
			rain = HSRain.make(Vector3(7, 3, 6), 900, 0.6)
			world.add_child(rain)
			rain.position = Vector3(0, 1.5, -0.5)
			prev = null
		"mirror":
			if rain != null:
				rain.visible = false
			mirror_q = MeshInstance3D.new()
			var mq := QuadMesh.new()
			mq.size = Vector2(1.0, 1.4)
			mirror_q.mesh = mq
			world.add_child(mirror_q)
			mirror_q.position = Vector3(0.3, 1.6, -2.99)
			var sb := StaticBody3D.new()                   # the mirror's body, so the ray finds the wall behind it and not the glass
			world.add_child(sb)
			HSMirror.attach(mirror_q, 0, cam, 288)
			mirror2_q = MeshInstance3D.new()               # a second mirror on the right wall, facing the first across the room: seen in the first, with the room's bulb in it
			var mq2 := QuadMesh.new()
			mq2.size = Vector2(1.0, 1.4)
			mirror2_q.mesh = mq2
			world.add_child(mirror2_q)
			mirror2_q.position = Vector3(3.99, 1.6, -1.2)
			mirror2_q.rotation_degrees.y = -90.0
			HSMirror.attach(mirror2_q, 0, cam, 288)
		"soften_off":
			for sp in spheres:
				sp.visible = false
			cam.look_at_from_position(Vector3(0, 1.2, 2.5), Vector3(0, 1.2, -5.0))
			near_q = checker_quad(0.5, 32, Vector3(-0.45, 1.05, 1.8))          # 0.7 m from the eye
			far_q = checker_quad(3.0, 32, Vector3(0.8, 1.4, -2.9))            # 5.4 m
			glow_q = MeshInstance3D.new()                                      # a glow drawn in the transparent pass (an LED, a digit, steam)
			var gm := QuadMesh.new()
			gm.size = Vector2(0.12, 0.12)
			glow_q.mesh = gm
			var m := StandardMaterial3D.new()
			m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
			m.albedo_color = Color(1.0, 0.6, 0.2, 1.0)
			glow_q.material_override = m
			glow_q.position = Vector3(1.0, 0.3, 0.0)                           # 2.5 m, low on the right, clear of both checkers
			world.add_child(glow_q)
		"soften":
			HSSoften.attach(cam).set_amounts(0.9, 7.0, 1.6, 0.25)
		"leak":
			if iris_lamp != null:
				iris_lamp.light_energy = 0.0
			HSLook.iris(root, false)
			cam.position = Vector3(-1.2, 1.4, 1.2)
			cam.look_at(Vector3(-4.0, 1.3, -0.8))                              # the left wall, a leak running down it from near the ceiling
			for c in world.get_children():
				if c is MeshInstance3D and c.position.x < -4.0 and c.mesh is BoxMesh and (c.mesh as BoxMesh).size.x < 0.2:
					leak_wall = c
			leak_n = HSLeak.make([leak_wall], {"centre": Vector3(-3.99, 2.8, -0.8), "axis": Vector3(0, 0, 1), "inward": Vector3(1, 0, 0), "width": 0.5, "top": 2.8, "bottom": 0.0, "drip": 0.5, "wet": 0.0})
			world.add_child(leak_n)
		"iris":
			if sweep_n != null:
				sweep_n.visible = false
			cam.look_at_from_position(Vector3(0, 1.3, 2.4), Vector3(0, 1.2, -2.0))
			iris_lamp = OmniLight3D.new()
			iris_lamp.light_energy = 0.0
			iris_lamp.omni_range = 8.0
			world.add_child(iris_lamp)
			iris_lamp.position = Vector3(0.0, 2.2, 0.0)
			HSLook.iris(root, true, false)
		"sweep":
			if shaft_fv != null:
				shaft_fv.visible = false
			for c in world.get_children():
				if c is SpotLight3D and c.light_volumetric_fog_energy >= 4.0:
					c.visible = false                                          # the shaft stage's window light
			cam.look_at_from_position(Vector3(1.5, 1.3, 2.4), Vector3(-1.5, 1.6, -1.5))
			sweep_n = HSSweep.make(Vector3(3.9, 1.5, -1.0), Vector3(1, 0, 0), Vector3(0, 0, 1), {"every": 0, "secs": 100000.0, "out": -1.0, "span": 2.5, "energy": 20.0, "aim": 5.0})   # a "window" on the right wall, inside the demo's closed room ("outside" is a metre in): the headlights cross the room onto the left wall the camera sees
			world.add_child(sweep_n)
		"shaft":
			if pat_spot != null:
				pat_spot.visible = false
			cam.look_at_from_position(Vector3(1.5, 1.3, 2.4), Vector3(-1.5, 1.2, -1.5))
			var win := SpotLight3D.new()                                       # a window-sized light on the left wall, into the room and a little down
			win.light_color = Color(0.8, 0.88, 1.0)
			win.light_energy = 5.0
			win.spot_range = 7.0
			win.spot_angle = 32.0
			win.shadow_enabled = true
			win.light_volumetric_fog_energy = 4.0
			world.add_child(win)
			win.position = Vector3(-3.9, 1.9, -0.6)
			win.look_at(Vector3(1.0, 0.3, -0.9))
			shaft_fv = HSShaft.make(Vector3(-3.9, 1.9, -0.6), Vector3(4.9, -1.6, -0.3), 1.0, 1.1, 4.0, {"strength": 1.0, "dust": 0.6})
			shaft_fv.visible = false
			world.add_child(shaft_fv)
		"pattern":
			HSSoften.detach(cam)
			if near_q != null:
				near_q.visible = false
				far_q.visible = false
				glow_q.visible = false
			cam.look_at_from_position(Vector3(0, 1.3, 2.0), Vector3(0, 1.4, -3.0))
			pat_spot = SpotLight3D.new()                                       # a lamp low by the back wall, its light through water onto it
			pat_spot.light_color = Color(0.75, 0.9, 1.0)
			pat_spot.light_energy = 6.0
			pat_spot.spot_range = 6.0
			pat_spot.spot_angle = 32.0
			pat_spot.shadow_enabled = true                                    # a projector needs the spot's shadows on
			world.add_child(pat_spot)
			pat_spot.position = Vector3(0.0, 0.6, -0.4)
			pat_spot.look_at(Vector3(0.0, 1.6, -3.0))
			HSPattern.attach(pat_spot, {"pattern": "caustics", "scale": 0.5, "speed": 0.8, "open": 0.3}, 2.8)
		"skin":
			cam.look_at_from_position(Vector3(0, 1.0, 1.2), Vector3(0, 1.0, -0.8))
			if rain != null:
				rain.visible = false
			var tone := Color(0.78, 0.56, 0.47)
			var i := 0
			for s in [{}, {"wetness": 0.8, "sweat": 0.8, "drips": 0.4}, {"oil": 1.0}]:
				var mi := MeshInstance3D.new()
				var sm := SphereMesh.new()
				sm.radius = 0.27
				sm.height = 0.54
				sm.radial_segments = 96
				sm.rings = 48
				mi.mesh = sm
				mi.material_override = HSSkin.material(null, s, tone)
				mi.position = Vector3(-0.68 + 0.68 * i, 1.0, -0.8)
				world.add_child(mi)
				spheres.append(mi)
				i += 1


func finish() -> void:
	var f := FileAccess.open(out_dir.path_join("report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, "  "))
	f.close()
	print("LOOKDEMO ", JSON.stringify(report))
	quit()
