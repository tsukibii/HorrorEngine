## The hair editor v2.0's pictures in Godot (docs/HAIR_V2.md; tools/godot/hair2_check.py and the Character Studio's
## "Preview in Godot" run it): a head and its hair as a glb (tools/character/hair2/make.mjs, or the page's own), worn as
## the game wears hair (HSHair with the bake's records read from the file), lit like a character reel, pictured from
## the sides asked for. Loaded at run time (no import step), so one picture set is seconds on a graphics card.
##   godot --path PROJECT -s res://hair2_shots.gd -- --glb=/abs/file.glb --out=/abs/dir [--tag=NAME]
##       [--shots=front,q,side,back,top,close,pov,v:yaw:pitch:dist:fov:x:y:z] [--size=960x720] [--frames=20]
##       [--look=balanced|realism] [--origin=x,y,z] [--hair=JSON] [--light=reel|front|room] [--marker] [--nohair] [--frame=head|bust]
## `--origin`: the point between the ears (the head's local origin); found from the skin's top when not given.
## `--marker`: a second picture of every shot with the hair-bearing scalp a flat magenta and the hair a flat green, and
## the report counts the magenta seen inside the hair's outline (skin through the hair: the gaps).
## Shots: front, q (three-quarter), side (her left), sider (her right), back, top, close (the parting and the hairline),
## pov (the game's 90-degree lens at 1.2 m), or `v:` a view by its numbers (yaw and pitch in degrees round the head, the
## distance, the lens, the point looked at from the origin).
extends SceneTree

var glb := ""
var out_dir := ""
var tag := "hair"
var shots: Array = ["front", "q", "side", "back", "top"]
var size := Vector2i(960, 720)
var frames := 20
var look := "balanced"
var light := "reel"
var origin := Vector3.ZERO
var has_origin := false
var hair_json := ""
var marker := false
var no_hair := false
var frame := "head"
var bg := Color(0.36, 0.38, 0.42)
var skin_colour := Color(0.80, 0.63, 0.54)

var env: Environment
var world: Node3D
var cam: Camera3D
var who: Node3D
var rig: Array = []
var n := 0
var stage := 0
var pass_marker := false
var report := {"shots": {}}
var hair_meshes: Array = []
var scalp_meshes: Array = []
var skin_meshes: Array = []
var kept := {}
var t0 := 0


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--glb="):
			glb = a.substr(6)
		elif a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--tag="):
			tag = a.substr(6)
		elif a.begins_with("--shots="):
			shots = Array(a.substr(8).split(","))
		elif a.begins_with("--size="):
			var p := a.substr(7).split("x")
			size = Vector2i(int(p[0]), int(p[1]))
		elif a.begins_with("--frames="):
			frames = int(a.substr(9))
		elif a.begins_with("--look="):
			look = a.substr(7)
		elif a.begins_with("--light="):
			light = a.substr(8)
		elif a.begins_with("--origin="):
			var p := a.substr(9).split(",")
			origin = Vector3(float(p[0]), float(p[1]), float(p[2]))
			has_origin = true
		elif a.begins_with("--hair="):
			hair_json = a.substr(7)
		elif a == "--marker":
			marker = true
		elif a == "--nohair":
			no_hair = true
		elif a.begins_with("--frame="):
			frame = a.substr(8)
		elif a.begins_with("--bg="):
			var p := a.substr(5).split(",")
			bg = Color(float(p[0]), float(p[1]), float(p[2]))
	root.size = size
	world = Node3D.new()
	root.add_child(world)
	env = Environment.new()
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(glb, st) == OK:
		who = doc.generate_scene(st)
	if who == null:
		print("HAIR2SHOTS FAIL: no glb at " + glb)
		quit(1)
		return
	world.add_child(who)
	var top := -1e9
	var tris := 0
	var verts := 0
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		var nm := String(mi.name).to_lower()
		if nm.begins_with("pores") or nm.begins_with("guides"):      # the pores as dots, the hairs as lines: their own colours, unlit
			var pm := StandardMaterial3D.new()
			pm.vertex_color_use_as_albedo = true
			pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			pm.cull_mode = BaseMaterial3D.CULL_DISABLED
			mi.set_surface_override_material(0, pm)
		elif nm.contains("scalp"):
			scalp_meshes.append(mi)
		elif HSHair.is_hair(nm):
			hair_meshes.append(mi)
			for s in mi.mesh.get_surface_count():
				var arr = mi.mesh.surface_get_arrays(s)
				verts += arr[Mesh.ARRAY_VERTEX].size()
				tris += (arr[Mesh.ARRAY_INDEX].size() if arr[Mesh.ARRAY_INDEX] != null else arr[Mesh.ARRAY_VERTEX].size()) / 3
			if no_hair:
				mi.visible = false
		elif nm.contains("skin"):
			skin_meshes.append(mi)
			top = max(top, (to_root(mi) * mi.get_aabb()).end.y)
			var old = mi.get_active_material(0)
			if not (old is BaseMaterial3D and old.albedo_texture != null):    # a plain head (make.mjs's): a skin tone, a little scattering
				var sm := StandardMaterial3D.new()
				sm.albedo_color = skin_colour
				sm.roughness = 0.58
				sm.subsurf_scatter_enabled = true
				sm.subsurf_scatter_strength = 0.25
				mi.set_surface_override_material(0, sm)
	if not has_origin:
		origin = Vector3(0.0, top - 0.122, 0.04)
	var mats: Array = HSHair.wear(who, {}, glb)
	report["hair_mats"] = mats.size()
	report["hair_baked"] = 0
	for hm in mats:
		if hm is ShaderMaterial and hm.get_shader_parameter("shell_normals") == true and hm.get_shader_parameter("use_strands") == true:
			report["hair_baked"] += 1
	if hair_json != "":
		var o = JSON.parse_string(hair_json)
		if o is Dictionary:
			for hm in mats:
				for k in o:
					hm.set_shader_parameter(k, o[k])
	report["hair_meshes"] = hair_meshes.size()
	report["hair_triangles"] = tris
	report["hair_vertices"] = verts
	report["scalps"] = scalp_meshes.size()
	var J := []                                      # a tail's chain: HSJiggle finds the bones named for it
	for sk in who.find_children("*", "Skeleton3D", true, false):
		for b in sk.get_bone_count():
			if String(sk.get_bone_name(b)).begins_with("jiggle_"):
				J.append(sk.get_bone_name(b))
	report["jiggle_bones"] = J.size()
	cam = Camera3D.new()
	cam.near = 0.02
	world.add_child(cam)
	lights(light)
	t0 = Time.get_ticks_msec()


## a node's transform up to the scene's root (the tree isn't running yet when the glb is read)
func to_root(node: Node3D) -> Transform3D:
	var t := node.transform
	var p := node.get_parent()
	while p is Node3D:
		t = p.transform * t
		p = p.get_parent()
	return t


func lights(kind: String) -> void:
	for l in rig:
		l.queue_free()
	rig.clear()
	HSLook.apply(root, env, look)
	env.background_mode = Environment.BG_COLOR
	env.background_color = bg
	env.fog_enabled = false
	env.volumetric_fog_enabled = false
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.42, 0.45, 0.5)
	sm.sky_horizon_color = Color(0.33, 0.34, 0.36)
	sm.ground_horizon_color = Color(0.22, 0.21, 0.2)
	sm.ground_bottom_color = Color(0.1, 0.1, 0.1)
	sm.sun_angle_max = 0.0
	sky.sky_material = sm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.ambient_light_energy = 0.6
	var f := origin + Vector3(0.0, 0.0, 0.06)
	var key := OmniLight3D.new()
	var fill := OmniLight3D.new()
	var rim := OmniLight3D.new()
	if kind == "front":                              # a portrait grid's: a soft key above the lens, a weak fill
		key.position = f + Vector3(0.3, 0.55, 1.1)
		key.light_energy = 2.0
		fill.position = f + Vector3(-0.8, 0.05, 1.0)
		fill.light_energy = 0.45
		rim.position = f + Vector3(0.0, 0.6, -1.0)
		rim.light_energy = 0.8
	elif kind == "room":                             # the game's: a warm lamp above and to one side, little else
		key.position = f + Vector3(0.9, 0.9, 0.6)
		key.light_energy = 1.6
		key.light_color = Color(1.0, 0.82, 0.62)
		fill.position = f + Vector3(-0.8, -0.2, 0.9)
		fill.light_energy = 0.12
		rim.position = f + Vector3(-0.6, 0.4, -0.9)
		rim.light_energy = 0.25
		env.ambient_light_energy = 0.25
	else:                                            # the reel's: a big soft key from the side and above, a fill, a cool rim
		key.position = f + Vector3(0.75, 0.45, 0.85)
		key.light_energy = 2.2
		fill.position = f + Vector3(-1.0, 0.1, 0.9)
		fill.light_energy = 0.4
		rim.position = f + Vector3(-0.8, 0.35, -0.9)
		rim.light_energy = 1.6
	if kind != "room":
		key.light_color = Color(1.0, 0.95, 0.88)
	fill.light_color = Color(0.86, 0.9, 1.0)
	rim.light_color = Color(0.72, 0.82, 1.0)
	key.omni_range = 8.0
	key.omni_attenuation = 1.0
	key.light_size = 0.35
	key.shadow_enabled = true
	key.shadow_blur = 1.5
	fill.omni_range = 8.0
	rim.omni_range = 6.0
	for l in [key, fill, rim]:
		world.add_child(l)
		rig.append(l)


func view(yaw: float, pitch: float, dist: float, fov: float, at: Vector3) -> void:
	var y := deg_to_rad(yaw)
	var p := deg_to_rad(pitch)
	cam.fov = fov
	cam.position = origin + at + Vector3(sin(y) * cos(p), sin(p), cos(y) * cos(p)) * dist
	cam.look_at(origin + at, Vector3(0, 0, -1) if abs(pitch) > 85.0 else Vector3.UP)


func shoot(name: String) -> void:
	var d := 0.74 if frame == "head" else 1.05           # the head alone, or down to the chest (long hair, tails)
	var fv := 27.0 if frame == "head" else 30.0
	var at := Vector3(0.0, 0.005, -0.035) if frame == "head" else Vector3(0.0, -0.06, -0.03)
	match name:
		"front":
			view(0.0, 2.0, d, fv, at)
		"q":
			view(38.0, 4.0, d, fv, at)
		"qr":
			view(-38.0, 4.0, d, fv, at)
		"side":
			view(90.0, 2.0, d, fv, at)
		"sider":
			view(-90.0, 2.0, d, fv, at)
		"back":
			view(180.0, 4.0, d, fv, at)
		"backq":
			view(142.0, 6.0, d, fv, at)
		"top":
			view(0.0, 62.0, d * 0.95, fv, at + Vector3(0.0, 0.03, 0.0))
		"close":
			view(24.0, 22.0, 0.5, 20.0, Vector3(0.01, 0.07, 0.0))
		"pov":
			view(8.0, 2.0, 1.2, rad_to_deg(2.0 * atan(tan(deg_to_rad(45.0)) * 9.0 / 16.0)), Vector3(0.0, -0.04, 0.0))
		_:
			if name.begins_with("v:"):
				var p := name.substr(2).split(":")
				view(float(p[0]), float(p[1]), float(p[2]), float(p[3]), Vector3(float(p[4]), float(p[5]), float(p[6])) if p.size() >= 7 else at)
			else:
				view(0.0, 2.0, d, fv, at)


## the second picture's flat colours: the hair-bearing scalp magenta, the hair green, everything else as it is
func flat(c: Color) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = Shader.new()
	m.shader.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled;\nuniform vec3 c;\nuniform sampler2D a : filter_linear_mipmap, repeat_enable;\nuniform bool cut = false;\nvoid fragment() {\n\tALBEDO = c;\n\tif (cut) {\n\t\tALPHA = texture(a, UV).a;\n\t\tALPHA_SCISSOR_THRESHOLD = 0.35;\n\t}\n}\n"
	m.set_shader_parameter("c", Vector3(c.r, c.g, c.b))
	return m


func marker_on(on: bool) -> void:
	for mi in hair_meshes:
		for s in mi.mesh.get_surface_count():
			if on:
				var own = mi.get_active_material(s)
				kept[[mi, s]] = own
				var g := flat(Color(0, 1, 0))
				if own is ShaderMaterial:
					g.set_shader_parameter("a", own.get_shader_parameter("texture_albedo"))
					g.set_shader_parameter("cut", true)
				mi.set_surface_override_material(s, g)
			else:
				mi.set_surface_override_material(s, kept[[mi, s]])
	for mi in scalp_meshes:
		if on:
			kept[[mi, 0]] = mi.get_active_material(0)
			mi.set_surface_override_material(0, flat(Color(1, 0, 1)))
		else:
			mi.set_surface_override_material(0, kept[[mi, 0]])


func count(img: Image) -> Dictionary:
	var hair := 0
	var skin := 0
	var w := img.get_width()
	var h := img.get_height()
	for y in range(0, h):
		for x in range(0, w):
			var c := img.get_pixel(x, y)
			if c.g > 0.6 and c.r < 0.35 and c.b < 0.35:
				hair += 1
			elif c.r > 0.6 and c.b > 0.6 and c.g < 0.35:
				skin += 1
	return {"hair_px": hair, "scalp_px": skin}


func _process(_d: float) -> bool:
	n += 1
	if n == 1:
		shoot(shots[stage])
	if n < frames:                                   # the TAA settles (the hair's coverage is dithered frame by frame)
		return false
	var name: String = shots[stage]
	var img := root.get_texture().get_image()
	var file := "%s_%s%s.png" % [tag, name.replace(":", "_"), "_marker" if pass_marker else ""]
	if img.save_png(out_dir.path_join(file)) != OK:
		print("HAIR2SHOTS FAIL: can't write into " + out_dir)
		quit(1)
		return true
	n = 0
	if pass_marker:
		report["shots"][name] = count(img)
		marker_on(false)
		pass_marker = false
		stage += 1
	elif marker:
		pass_marker = true
		marker_on(true)
		return false
	else:
		report["shots"][name] = {}
		stage += 1
	if stage >= shots.size():
		report["seconds"] = (Time.get_ticks_msec() - t0) / 1000.0
		var f := FileAccess.open(out_dir.path_join("%s.json" % tag), FileAccess.WRITE)
		if f != null:
			f.store_string(JSON.stringify(report, "  "))
			f.close()
		print("HAIR2SHOTS ", JSON.stringify(report))
		return true
	return false
