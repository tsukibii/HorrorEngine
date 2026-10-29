## The look plugin's demo and check (docs/GODOT_LOOK.md; tools/godot/plugin_check.py runs it: LOOKPLUGIN): a small
## room (a floor, walls, a lamp with its bulb, a cool fill), pictured with each part of the plugin in turn: the plain
## look and the realism preset, the floor wet with puddles and rain's rings, blood on the floor and up the wall, the
## rain, and three skin spheres (dry, sweating, oiled). Each picture is measured (report.json) so a change that
## breaks a part is seen: the lamp's reflection in the wet floor, the rain moving between frames, the blood's red,
## the sweat's glints and the oil's gloss against dry skin.
##   godot --path PROJECT -s res://addons/horrorstudio_look/demo/demo.gd -- --out=DIR
extends SceneTree

var out_dir := "res://"
var n := 0
var stage := 0
var env: Environment
var world: Node3D
var cam: Camera3D
var floor_mi: MeshInstance3D
var rain: HSRain = null
var spheres: Array = []
var report := {}
var prev: Image = null
var skin_mode := false

const STAGES := ["plain", "realism", "wet", "blood_rain", "skin"]


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
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
	cam.position = Vector3(0, 1.5, 3.0)
	cam.look_at(Vector3(0, 0.55, -1.0))
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
			prev = null
		"skin":
			var img := shot("skin")
			report["skin_dry"] = measure(img, 170, 160, 480, 560)
			report["skin_sweat"] = measure(img, 480, 160, 800, 560)
			report["skin_oil"] = measure(img, 800, 160, 1110, 560)
			report["glint_dry"] = measure(img, 325, 360, 480, 560)      # the lower right of each sphere: the fill's glint
			report["glint_sweat"] = measure(img, 640, 360, 800, 560)
			report["glint_oil"] = measure(img, 955, 360, 1110, 560)
	stage += 1
	if stage >= STAGES.size():
		finish()
		return true
	match STAGES[stage]:
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
		"skin":
			cam.position = Vector3(0, 1.0, 1.2)
			cam.look_at(Vector3(0, 1.0, -0.8))
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
	n = 0
	return false


func finish() -> void:
	var f := FileAccess.open(out_dir.path_join("report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, "  "))
	f.close()
	print("LOOKDEMO ", JSON.stringify(report))
	quit()
