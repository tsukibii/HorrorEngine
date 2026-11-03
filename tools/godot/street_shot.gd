extends SceneTree
# A street's .glb pictured through one of its shots, as Godot draws it (tools/godot/street_check.py --shot): the
# camera at the shot's eye looking at its look (the street's x east, y north, z up as Godot's x, z, -y), the shot's
# lens upright, a dusk sky lighting it, its lamps and lit windows as they came in. Args after --: the shot's JSON,
# the .glb's path in the project, the picture's path.
func _initialize():
	var a := OS.get_cmdline_user_args()
	var shot = JSON.parse_string(FileAccess.get_file_as_string(a[0]))
	var s = (load(a[1]) as PackedScene).instantiate()
	root.add_child(s)
	var g3 = func(p): return Vector3(p[0], p[2], -p[1])
	var cam := Camera3D.new()
	cam.fov = float(shot.get("vfov", 60))
	cam.keep_aspect = Camera3D.KEEP_HEIGHT
	cam.near = 0.05
	cam.far = 1500.0
	root.add_child(cam)
	cam.look_at_from_position(g3.call(shot.eye), g3.call(shot.look), Vector3.UP)
	cam.current = true
	var sky := ProceduralSkyMaterial.new()
	sky.sky_top_color = Color("5d7fa3")
	sky.sky_horizon_color = Color("d8c6cc")
	sky.ground_horizon_color = Color("8a8a90")
	sky.ground_bottom_color = Color("2a2a30")
	sky.sun_angle_max = 0.0
	sky.sky_energy_multiplier = 1.0
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = Sky.new()
	env.sky.sky_material = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 1.0
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.0
	env.glow_enabled = true
	env.glow_intensity = 0.6
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	for i in 12:
		await process_frame
	var img := root.get_viewport().get_texture().get_image()
	img.save_png(a[2])
	var shaders := 0
	var stack: Array = [s]
	while stack.size():
		var n = stack.pop_back()
		if n is MeshInstance3D and n.mesh:
			for i in n.mesh.get_surface_count():
				if n.mesh.surface_get_material(i) is ShaderMaterial:
					shaders += 1
		stack.append_array(n.get_children())
	print("GDSHOT ", a[2], " ", img.get_width(), "x", img.get_height(), " street-shader surfaces ", shaders)
	quit(0)
