## The cloth shader (HSCloth, cloth.gdshaderinc; docs/GODOT_LOOK.md §5x; tools/godot/cloth_check.py runs it: GDCLOTH):
## every clothing fabric set the plugin has on a ball of cloth with folds in it, its weave magnified and at a garment's
## distance in four dyes, as the Character Studio's own sheet has them (tools/character/tailor/swatch.mjs); then one
## ball in a small room of its own, lit so each thing the shader does can be measured (the dye, the weave's relief,
## the fuzz against a light behind it, a sheer knit over skin); and, given a Character Studio export that wears
## fabric sets, its garments as the file has them beside the cloth shader's.
##   godot --path PROJECT -s res://addons/horrorstudio_look/demo/cloth.gd -- --out=DIR [--glb=res://people/NAME.glb] [--sets=A,B]
extends SceneTree

const DYES := ["#e9e4d8", "#8a2432", "#22304e", "#19191b"]
const CELL := 0.25
const PX := 250
var out_dir := "res://"
var glb := ""
var only: PackedStringArray = []
var report := {}


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		if a.begins_with("--glb="):
			glb = a.substr(6)
		if a.begins_with("--sets="):
			only = a.substr(7).split(",", false)
	run.call_deferred()


func ball(rad: float, seg: int = 200, rings: int = 140) -> ArrayMesh:
	var pos := PackedVector3Array()
	var nrm := PackedVector3Array()
	var uv := PackedVector2Array()
	var uv2 := PackedVector2Array()
	var idx := PackedInt32Array()
	var at := func(u: float, v: float) -> Vector3:
		var th := v * PI
		var ph := u * TAU
		var d := Vector3(sin(th) * sin(ph), cos(th), sin(th) * cos(ph))
		var a := atan2(d.x, d.z)
		var h := d.y
		var f := 1.0 + 0.035 * sin(a * 5.0 + h * 2.2) * (0.4 + 0.6 * cos(h * 1.3)) + 0.018 * sin(a * 11.0 - h * 5.0) + 0.012 * sin(h * 9.0 + a * 3.0)
		return d * rad * f
	for j in rings + 1:
		var v: float = clamp(float(j) / rings, 0.002, 0.998)
		for i in seg + 1:
			var u := float(i) / seg
			var p: Vector3 = at.call(u, v)
			var du: Vector3 = at.call(u + 0.001, v) - at.call(u - 0.001, v)
			var dv: Vector3 = at.call(u, v + 0.001) - at.call(u, v - 0.001)
			pos.append(p)
			nrm.append(du.cross(dv).normalized() * -1.0 if du.cross(dv).dot(p) < 0.0 else du.cross(dv).normalized())
			uv.append(Vector2(u, v))
			uv2.append(Vector2(u * TAU * rad, (1.0 - v) * PI * rad))      # the cloth's metres: u round, v up
	for j in rings:
		for i in seg:
			var a := j * (seg + 1) + i
			idx.append_array([a, a + 1, a + seg + 2, a, a + seg + 2, a + seg + 1])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = pos
	arr[Mesh.ARRAY_NORMAL] = nrm
	arr[Mesh.ARRAY_TEX_UV] = uv
	arr[Mesh.ARRAY_TEX_UV2] = uv2
	arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return m


func stage(size: Vector2i, bg: Color, ambient: float) -> Dictionary:
	var vp := SubViewport.new()
	vp.size = size
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = bg
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.87, 0.9, 0.94)
	env.ambient_light_energy = ambient
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.0
	var we := WorldEnvironment.new()
	we.environment = env
	vp.add_child(we)
	var world := Node3D.new()
	vp.add_child(world)
	var cam := Camera3D.new()
	world.add_child(cam)
	cam.current = true
	return {"vp": vp, "env": env, "world": world, "cam": cam}


func sun(world: Node3D, from: Vector3, color: Color, energy: float) -> DirectionalLight3D:
	var l := DirectionalLight3D.new()
	l.light_color = color
	l.light_energy = energy
	l.shadow_enabled = false
	world.add_child(l)
	l.look_at_from_position(from, Vector3.ZERO, Vector3.UP)
	return l


func shot(st: Dictionary, name: String) -> void:
	for _i in 4:
		await process_frame
	await RenderingServer.frame_post_draw
	var im: Image = st["vp"].get_texture().get_image()
	im.save_png(out_dir.path_join(name))


func run() -> void:
	var table := HSCloth.table()
	var names: Array = []
	for k in table.keys():
		if only.is_empty() or k in only:
			names.append(k)
	names.sort()
	report["sets"] = names
	report["made"] = []
	report["cells"] = {"px": PX, "cols": 2 + DYES.size(), "rows": names.size(), "dyes": DYES}
	# 1. the sheet: a wall of balls seen square on; the two on the left wear the cloth magnified
	var mesh := ball(0.105)
	var st := stage(Vector2i(PX * (2 + DYES.size()), PX * max(1, names.size())), Color("#1b1d22"), 0.38)
	var cam: Camera3D = st["cam"]
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = CELL * max(1, names.size())
	cam.position = Vector3(0, 0, 3)
	cam.near = 0.1
	cam.far = 10.0
	sun(st["world"], Vector3(-1.6, 2.2, 2.2), Color("#fff4e8"), 2.3)
	sun(st["world"], Vector3(2.2, 1.2, -2.4), Color("#bcd0ff"), 1.3)
	for r in names.size():
		var t: Dictionary = table[names[r]]
		var tile_m := float(t.get("tile_m", 0.03))
		var zoom: float = 0.23 / clamp(tile_m * 0.55, 0.008, 0.045)        # the weave as if the ball were this many times smaller
		var ok := true
		for c in 2 + DYES.size():
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			st["world"].add_child(mi)
			mi.position = Vector3((c - (1 + DYES.size()) * 0.5) * CELL, ((names.size() - 1) * 0.5 - r) * CELL, 0)
			var dye := Color(DYES[min(c, 1) if c < 2 else c - 2])
			var m := HSCloth.dress(mi, 0, names[r], dye, {"uv_scale": 1.0 / zoom if c < 2 else 1.0, "denier": 0.3})
			ok = ok and m != null
			if str(t.get("mask", "")) == "opacity":                        # the skin under a sheer knit
				var skin := MeshInstance3D.new()
				skin.mesh = mesh
				skin.scale = Vector3.ONE * 0.994
				var sm := StandardMaterial3D.new()
				sm.albedo_color = Color("#c8a28c")
				sm.roughness = 0.55
				skin.material_override = sm
				mi.add_child(skin)
				skin.position = Vector3.ZERO
		if ok:
			report["made"].append(names[r])
	await shot(st, "cloth_sheet.png")
	st["vp"].queue_free()
	# 2. the lab: one ball, its lights and settings changed a picture at a time
	var lab := stage(Vector2i(512, 512), Color(0.02, 0.02, 0.025), 0.0)
	lab["cam"].fov = 24
	lab["cam"].position = Vector3(0, 0.0, 0.5)
	lab["cam"].look_at(Vector3.ZERO)
	var key := sun(lab["world"], Vector3(-1.2, 1.4, 2.0), Color.WHITE, 2.0)
	var back := sun(lab["world"], Vector3(0.4, 0.5, -2.0), Color.WHITE, 3.0)
	var side := sun(lab["world"], Vector3(2.0, 0.5, 0.7), Color.WHITE, 0.0)
	var small := ball(0.085)
	var one := MeshInstance3D.new()
	one.mesh = small
	lab["world"].add_child(one)
	var lit := func(k: float, b: float, amb: float, s: float = 0.0) -> void:
		key.light_energy = k
		back.light_energy = b
		side.light_energy = s
		lab["env"].ambient_light_energy = amb
	var wool: String = "WoolKnit001" if "WoolKnit001" in names else (names[0] if names.size() else "")
	var hide: String = "Leather001" if "Leather001" in names else wool
	if wool != "":
		for dye in ["#e9e4d8", "#8a2432", "#19191b", "#2f6b3a"]:           # the dye: front lit, each colour its own
			lit.call(2.0, 0.0, 0.5)
			HSCloth.dress(one, 0, "CottonPoplin001" if "CottonPoplin001" in names else wool, Color(dye))
			await shot(lab, "lab_dye_%s.png" % dye.substr(1))
		for set_name in [wool, hide]:                                      # the fuzz: a light from the side, with it and without
			for k in [1.0, 0.0]:
				lit.call(0.0, 0.0, 0.0, 2.5)
				HSCloth.dress(one, 0, set_name, Color("#8a2432"), {"sheen": k})
				await shot(lab, "lab_fuzz_%s_%d.png" % [set_name, int(k)])
			for k in [1.0, 0.0]:                                           # the halo: a light behind
				lit.call(0.0, 3.0, 0.0)
				HSCloth.dress(one, 0, set_name, Color("#8a2432"), {"sheen": k})
				await shot(lab, "lab_halo_%s_%d.png" % [set_name, int(k)])
			for k in [1.0, 0.0]:                                           # and in the sky's light alone
				lit.call(0.0, 0.0, 1.0)
				HSCloth.dress(one, 0, set_name, Color("#8a2432"), {"sheen": k})
				await shot(lab, "lab_sky_%s_%d.png" % [set_name, int(k)])
		for k in [1.0, 0.0]:                                               # the weave's relief: a low light across it, magnified
			lit.call(2.4, 0.0, 0.15)
			HSCloth.dress(one, 0, wool, Color("#e9e4d8"), {"detail": k, "uv_scale": 0.25})
			await shot(lab, "lab_detail_%d.png" % int(k))
	if "HosierySheer001" in names:                                         # a sheer knit over skin: black at 0.3 and 0.7, and no knit
		var skin := MeshInstance3D.new()
		skin.mesh = small
		skin.scale = Vector3.ONE * 0.994
		var sm := StandardMaterial3D.new()
		sm.albedo_color = Color("#c8a28c")
		sm.roughness = 0.55
		skin.material_override = sm
		lab["world"].add_child(skin)
		lit.call(2.0, 0.0, 0.6)
		for d in [0.3, 0.7]:
			HSCloth.dress(one, 0, "HosierySheer001", Color("#19191b"), {"denier": d})
			await shot(lab, "lab_sheer_%d.png" % int(d * 10))
		one.visible = false
		await shot(lab, "lab_sheer_skin.png")
		one.visible = true
		skin.queue_free()
	lab["vp"].queue_free()
	# 3. a Character Studio export that wears fabric sets: as the file has it, then on the cloth shader
	if glb != "":
		await person()
	var f := FileAccess.open(out_dir.path_join("cloth_report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, " "))
	f.close()
	print("CLOTH demo done: %d sets" % names.size())
	quit(0)


func person() -> void:
	var who: Node3D = null
	var ps = load(glb) if ResourceLoader.exists(glb) else null
	if ps != null:
		who = ps.instantiate()
	else:
		var doc := GLTFDocument.new()
		var gs := GLTFState.new()
		if doc.append_from_file(glb, gs) == OK:
			who = doc.generate_scene(gs)
	if who == null:
		report["person"] = {"error": "no glb at " + glb}
		return
	var st := stage(Vector2i(900, 1200), Color("#23262d"), 0.6)
	st["world"].add_child(who)
	var k := sun(st["world"], Vector3(1.5, 3.0, 2.5), Color("#fff4e8"), 1.8)
	k.shadow_enabled = true
	sun(st["world"], Vector3(-2.0, 2.0, -2.5), Color("#bcd0ff"), 1.0)
	var top := 1.6
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		if String(mi.name).to_lower().ends_with("_skin"):
			top = (mi.global_transform * mi.get_aabb()).end.y
	var cam: Camera3D = st["cam"]
	cam.fov = 28
	var views := {"full": [Vector3(0.55, top * 0.55, 2.7 * top / 1.62), Vector3(0, top * 0.52, 0)],
			"chest": [Vector3(0.35, top * 0.8, 0.95), Vector3(0, top * 0.76, 0)],
			"legs": [Vector3(0.4, top * 0.3, 1.25), Vector3(0, top * 0.25, 0)],
			"feet": [Vector3(0.45, 0.22, 0.75), Vector3(0.05, 0.08, 0.05)]}
	HSSkin.wear(who, {}, glb)
	HSEye.wear(who, glb)
	HSHair.wear(who, {}, glb)
	for v in views:
		cam.position = views[v][0]
		cam.look_at(views[v][1])
		await shot(st, "person_%s_file.png" % v)
	var mats := HSCloth.wear(who, {}, glb)
	var worn := {}
	for m in mats:
		var s: String = m.get_meta("hs_cloth").get("set", "")
		worn[s] = int(worn.get(s, 0)) + 1
	report["person"] = {"glb": glb, "records": HSCloth.records(glb).size(), "cloth_materials": mats.size(), "sets": worn}
	for v in views:
		cam.position = views[v][0]
		cam.look_at(views[v][1])
		await shot(st, "person_%s_cloth.png" % v)
	st["vp"].queue_free()
