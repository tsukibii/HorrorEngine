## The air, measured (tools/godot/plugin_check.py runs it: LOOKPLUGIN's air part; docs/GODOT_LOOK.md §5j,
## docs/research/eye_candy.md §2): a night in the woods, a flashlight held at the hand with an HSBeam and a
## flashlight's cookie, an HSAtmosphere. It measures:
##   - the beam in the air at each fog level;
##   - the beam following the battery, and gone with the light off;
##   - no trail after a turn;
##   - motes lit in the beam and not beside it, and none by moonlight;
##   - fog_to reaching its level on time;
##   - an HSAirZone's air while the eye is in it, and back after;
##   - the mist thicker low down;
##   - a save putting the light's and the environment's own values back.
## Pictures and air.json into --out; prints LOOKAIR {json}.
extends SceneTree

const Look := preload("res://addons/horrorstudio_look/look.gd")

var out := ""
var env: Environment
var cam: Camera3D
var side: Camera3D
var torch: SpotLight3D
var beam: HSBeam
var air: HSAtmosphere
var trees: Node3D
var world: Node3D
var R := {}


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	root.size = Vector2i(960, 540)
	world = Node3D.new()
	root.add_child(world)
	var we := WorldEnvironment.new()
	env = Environment.new()
	we.environment = env
	world.add_child(we)
	Look.apply(root, env, "balanced")
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0, 0, 0)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.25, 0.3, 0.4)
	env.ambient_light_energy = 0.05
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(120, 120)
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color(0.2, 0.17, 0.13)
	gm.roughness = 0.95
	pm.material = gm
	ground.mesh = pm
	world.add_child(ground)
	trees = Node3D.new()
	world.add_child(trees)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color(0.32, 0.27, 0.22)
	bark.roughness = 0.9
	for i in 46:
		var t := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		var r := rng.randf_range(0.14, 0.32)
		cm.top_radius = r * 0.8
		cm.bottom_radius = r
		cm.height = 10.0
		cm.material = bark
		t.mesh = cm
		var x := rng.randf_range(-9.0, 9.0)
		var z := rng.randf_range(-3.5, -34.0)
		if absf(x) < 0.9 and z > -9.0:
			x += 2.2 * signf(x + 0.01)
		t.position = Vector3(x, 5.0, z)
		trees.add_child(t)
	cam = Camera3D.new()
	cam.fov = 75.0
	cam.position = Vector3(0, 1.6, 0)
	cam.rotation_degrees = Vector3(3, 0, 0)
	world.add_child(cam)
	cam.current = true
	side = Camera3D.new()
	side.fov = 60.0
	world.add_child(side)
	side.look_at_from_position(Vector3(7.0, 1.9, -5.0), Vector3(0, 1.6, -5.0))
	torch = SpotLight3D.new()                              # the starter flashlight (guides/first_game/starter/player.tscn)
	torch.light_color = Color(1, 0.94, 0.84)
	torch.light_energy = 4.0
	torch.shadow_enabled = true
	torch.spot_range = 14.0
	torch.spot_angle = 24.0
	torch.spot_angle_attenuation = 2.5
	cam.add_child(torch)
	torch.position = Vector3(0.18, -0.2, -0.1)
	beam = HSBeam.new()
	beam.cookie = "flashlight"
	torch.add_child(beam)
	air = HSAtmosphere.new()
	air.fog = 0.25
	air.dust = 0.0
	air.mist = 0.0
	air.noise = 0.5
	world.add_child(air)
	await _run()
	var f := FileAccess.open(out.path_join("air.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(R, "  "))
	f.close()
	print("LOOKAIR " + JSON.stringify(R))
	quit()


func settle(n := 50) -> void:
	for i in n:
		await process_frame
	await RenderingServer.frame_post_draw


func snap(name: String) -> Image:
	var img := root.get_texture().get_image()
	if out != "" and name != "":
		img.save_png(out.path_join("air_" + name + ".png"))
	return img


## mean luma (0..255, of the sRGB picture) in a box round a screen point
func patch(img: Image, at: Vector2, half := Vector2i(10, 7)) -> float:
	var s := 0.0
	var n := 0
	for y in range(int(at.y) - half.y, int(at.y) + half.y + 1):
		for x in range(int(at.x) - half.x, int(at.x) + half.x + 1):
			if x < 0 or y < 0 or x >= img.get_width() or y >= img.get_height():
				continue
			var c := img.get_pixel(x, y)
			s += (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * 255.0
			n += 1
	return s / maxf(1.0, n)


func axis_point(d: float) -> Vector3:
	return torch.global_position - torch.global_basis.z * d


func beam_at(d := 6.0) -> float:
	return patch(snap(""), cam.unproject_position(axis_point(d)))


## lit motes per thousand pixels inside the cookie's core (the beam's middle 8 degrees) and beside the cone
func motes(a: Image, b: Image) -> Array:
	var inside := 0
	var outside := 0
	var n_in := 0
	var n_out := 0
	var ax := -torch.global_basis.z
	for y in range(0, b.get_height(), 2):
		for x in range(0, b.get_width(), 2):
			var ang := rad_to_deg(cam.project_ray_normal(Vector2(x, y)).angle_to(ax))
			var d1 := b.get_pixel(x, y)
			var d0 := a.get_pixel(x, y)
			var lit := ((d1.r + d1.g + d1.b) - (d0.r + d0.g + d0.b)) * 85.0 > 4.0
			if ang < 8.0:
				n_in += 1
				inside += int(lit)
			elif ang > 30.0:
				n_out += 1
				outside += int(lit)
	return [1000.0 * inside / maxf(1, n_in), 1000.0 * outside / maxf(1, n_out)]


func _run() -> void:
	await settle(30)
	# the levels: the beam in the air (the trees hidden, the black sky behind it), and the woods' pictures
	R["levels"] = {}
	for lv in [0.0, 0.25, 0.5, 0.75]:
		air.fog = lv
		trees.visible = false
		await settle(60)
		R["levels"][str(lv)] = snappedf(beam_at(), 0.01)
		trees.visible = true
		await settle(40)
		snap("level_%02d" % int(lv * 100))
	print("AIR levels ", R["levels"])
	# the battery and the switch, at fog 0.5
	air.fog = 0.5
	trees.visible = false
	await settle(50)
	var full := beam_at()
	torch.light_energy = 2.0
	await settle(30)
	R["battery_half"] = snappedf(beam_at() / maxf(full, 0.001), 0.001)
	torch.light_energy = 4.0
	torch.visible = false
	await settle(30)
	R["off"] = snappedf(beam_at(), 0.01)
	torch.visible = true
	# the turn: 40 degrees left in 6 frames; the old beam's place on the first frame after
	await settle(40)
	var P := axis_point(6.0)
	var lb := patch(snap(""), cam.unproject_position(P))
	for i in 6:
		cam.rotation_degrees.y += 40.0 / 6.0
		await process_frame
	await RenderingServer.frame_post_draw
	R["turn_first"] = snappedf(patch(snap(""), cam.unproject_position(P)) / maxf(lb, 0.001), 0.001)
	cam.rotation_degrees = Vector3(3, 0, 0)
	trees.visible = true
	# from the side: someone else's flashlight
	side.current = true
	await settle(50)
	snap("side")
	cam.current = true
	# the dust: motes in the core of the beam and not beside it (no fog: the motes alone)
	air.fog = 0.0
	air.dust = 0.0
	await settle(40)
	var d0 := snap("")
	air.dust = 0.9
	await settle(60)
	var d1 := snap("dust")
	R["motes"] = motes(d0, d1).map(func(v): return snappedf(v, 0.01))
	# real dust twinkles and varies: a quarter of a second later the lit motes have changed, and they're many faint and
	# a few bright, not one kind of dot (docs/research/eye_candy.md §2.3b)
	for i in 15:
		await process_frame
	await RenderingServer.frame_post_draw
	var d2 := snap("")
	var s1 := {}
	var s2 := {}
	for y in d1.get_height():
		for x in d1.get_width():
			var b0 := d0.get_pixel(x, y).get_luminance()
			var a1 := (d1.get_pixel(x, y).get_luminance() - b0) * 255.0
			var a2 := (d2.get_pixel(x, y).get_luminance() - b0) * 255.0
			if a1 > 3.0:
				s1[Vector2i(x, y)] = a1
			if a2 > 3.0:
				s2[Vector2i(x, y)] = a2
	var changed := 0
	var keys := {}
	for k in s1:
		keys[k] = true
	for k in s2:
		keys[k] = true
	for k in keys:
		var v1: float = s1.get(k, 0.0)
		var v2: float = s2.get(k, 0.0)
		if absf(v1 - v2) > 0.5 * maxf(v1, v2):
			changed += 1
	R["twinkle"] = snappedf(float(changed) / maxf(1.0, keys.size()), 0.01)
	var vals: Array = s1.values()
	vals.sort()
	var nv := vals.size()
	R["mote_spread"] = snappedf(float(vals[int(nv * 0.9)]) / maxf(float(vals[int(nv * 0.1)]), 0.5), 0.01) if nv >= 10 else 0.0
	R["mote_pixels"] = nv
	# by moonlight alone: none
	var moon := DirectionalLight3D.new()
	moon.light_color = Color(0.6, 0.7, 1.0)
	moon.light_energy = 0.06
	moon.rotation_degrees = Vector3(-35, 30, 0)
	world.add_child(moon)
	torch.visible = false
	air.dust = 0.0
	await settle(40)
	var m0 := snap("")
	air.dust = 0.9
	await settle(60)
	var m1 := snap("moon")
	var cnt := 0
	var tot := 0
	for y in range(0, m1.get_height(), 2):
		for x in range(0, m1.get_width(), 2):
			tot += 1
			var a1 := m1.get_pixel(x, y)
			var a0 := m0.get_pixel(x, y)
			if ((a1.r + a1.g + a1.b) - (a0.r + a0.g + a0.b)) * 85.0 > 4.0:
				cnt += 1
	R["moon_motes"] = snappedf(1000.0 * cnt / maxf(1, tot), 0.01)
	torch.visible = true
	moon.light_energy = 0.0
	print("AIR motes ", R["motes"], " moon ", R["moon_motes"])
	# fog_to: 0.25 to 0.75 over a second
	air.dust = 0.3
	air.fog = 0.25
	await settle(20)
	air.fog_to(0.75, 1.0)
	for i in 30:
		await process_frame
	R["fog_to_half"] = snappedf(env.volumetric_fog_density, 0.0001)
	for i in 42:
		await process_frame
	R["fog_to_end"] = snappedf(env.volumetric_fog_density, 0.0001)
	R["fog_to_want"] = snappedf(HSAir.density(0.75), 0.0001)
	R["fog_to_from"] = snappedf(HSAir.density(0.25), 0.0001)
	# a zone round the eye: its air while inside, the level's again after
	air.fog = 0.25
	var z := HSAirZone.new()
	z.size = Vector3(4, 4, 4)
	z.fog = 0.7
	z.dust = 0.9
	z.seconds = 0.4
	world.add_child(z)
	z.global_position = cam.global_position
	for i in 120:
		await process_frame
	R["zone_in"] = snappedf(float(air.now()["fog"]), 0.001)
	z.global_position = Vector3(40, 0, 40)
	for i in 120:
		await process_frame
	R["zone_out"] = snappedf(float(air.now()["fog"]), 0.001)
	z.queue_free()
	# the mist: a lamp low by the trees; the air lit near the ground and up high, without mist and with it
	var lamp := OmniLight3D.new()
	lamp.light_color = Color(1, 0.8, 0.55)
	lamp.light_energy = 2.5
	lamp.omni_range = 7.0
	world.add_child(lamp)
	lamp.position = Vector3(3.0, 1.2, -7.0)
	torch.visible = false
	trees.visible = false
	air.fog = 0.25
	air.dust = 0.0
	air.mist = 0.0
	await settle(60)
	var lo_p := cam.unproject_position(Vector3(1.4, 0.35, -7.0))
	var hi_p := cam.unproject_position(Vector3(1.4, 2.7, -7.0))
	var i0 := snap("")
	var low0 := patch(i0, lo_p)
	var high0 := patch(i0, hi_p)
	air.mist = 0.7
	await settle(80)
	var i1 := snap("")
	R["mist_low"] = snappedf(patch(i1, lo_p) - low0, 0.01)
	R["mist_high"] = snappedf(patch(i1, hi_p) - high0, 0.01)
	trees.visible = true
	torch.visible = true
	lamp.visible = false
	air.fog = 0.42
	air.dust = 0.4
	await settle(80)
	snap("woods_mist")
	print("AIR fog_to ", R["fog_to_half"], " ", R["fog_to_end"], " zone ", R["zone_in"], " ", R["zone_out"], " mist ", R["mist_low"], " ", R["mist_high"])
	# a save: the light's projector and fog energy, the environment's density back; then on again
	beam._notification(Node.NOTIFICATION_EDITOR_PRE_SAVE)
	air._notification(Node.NOTIFICATION_EDITOR_PRE_SAVE)
	R["save_projector_back"] = torch.light_projector == null
	R["save_fog_energy_back"] = is_equal_approx(torch.light_volumetric_fog_energy, 1.0)
	R["save_env_back"] = is_equal_approx(env.volumetric_fog_density, Look.PRESETS["balanced"]["haze_density"])
	beam._notification(Node.NOTIFICATION_EDITOR_POST_SAVE)
	await settle(5)
	R["save_taken_again"] = torch.light_projector != null and is_zero_approx(torch.light_volumetric_fog_energy) and is_equal_approx(env.volumetric_fog_density, HSAir.density(0.42))
