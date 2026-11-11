extends SceneTree
# The fit test's layers in Godot: a layered outfit's .glb (wear.py --glb), every mesh on cover.gdshader, pictured
#   worn        everything on: what's covered isn't drawn
#   coat_off    the outerwear taken off at run time (its band turned down): what it hid is drawn again
#   half        half way through taking it off: the dissolve
#   under       the outerwear only made invisible: what the dissolve leaves out of the layers under it
#   covers      the same with what's hidden painted red instead
# and what the vertex colours say came through the import, per mesh: how much of it each band hides.
#   godot --path <project> -s res://shots.gd -- --out=<dir> [--glb=res://outfit.glb]
var out := "res://"
var glb := "res://outfit.glb"
var meshes: Array = []
var outer: Array = []
var plan: Array = []
var at := 0
var wait := 0
var cam: Camera3D
var vp: SubViewport
var rig: Node3D

func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--glb="):
			glb = a.substr(6)
	vp = SubViewport.new()                                  # (a picture of a fixed size, whatever window the display gives)
	vp.size = Vector2i(640, 960)
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var world := Node3D.new()
	var we := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.11, 0.12, 0.14)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.57, 0.62)
	e.ambient_light_energy = 0.45
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	we.environment = e
	world.add_child(we)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-38, -32, 0)
	key.light_energy = 1.05
	key.light_color = Color(1.0, 0.95, 0.88)
	world.add_child(key)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-20, 140, 0)
	fill.light_energy = 0.35
	fill.light_color = Color(0.75, 0.83, 1.0)
	world.add_child(fill)
	rig = Node3D.new()
	world.add_child(rig)
	var scene: Node3D = (load(glb) as PackedScene).instantiate()
	rig.add_child(scene)
	var shader: Shader = load("res://cover.gdshader")
	for mi in scene.find_children("*", "MeshInstance3D", true, false):
		var m: Mesh = mi.mesh
		var ex: Dictionary = mi.get_meta("extras", {})
		for s in m.get_surface_count():
			var old := m.surface_get_material(s)
			var sm := ShaderMaterial.new()
			sm.shader = shader
			if old is BaseMaterial3D:
				sm.set_shader_parameter("albedo", old.albedo_color)
				if old.albedo_texture:
					sm.set_shader_parameter("albedo_tex", old.albedo_texture)
				if old.transparency == BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR:
					sm.set_shader_parameter("alpha_cut", old.alpha_scissor_threshold)
			var arr := m.surface_get_arrays(s)
			var col = arr[Mesh.ARRAY_COLOR]
			var has: bool = col != null and col.size() > 0
			sm.set_shader_parameter("use_cover", has)
			mi.set_surface_override_material(s, sm)
			if has:
				_report(mi.name, ex, arr)
		meshes.append(mi)
		if ex.get("hs_band", "") == "outer":
			outer.append(mi)
	cam = Camera3D.new()
	cam.fov = 30
	world.add_child(cam)
	vp.add_child(world)
	root.add_child(vp)
	# name, the outerwear's band (1 worn .. 0 off), is the outerwear drawn, covers painted, the turn in degrees, close up
	plan = [["worn", 1.0, true, false, 25.0, false], ["under", 1.0, false, false, 25.0, false], ["covers", 1.0, false, true, 25.0, false], ["half", 0.5, false, false, 25.0, false],
		["coat_off", 0.0, false, false, 25.0, false], ["worn_close", 1.0, true, false, 20.0, true], ["under_close", 1.0, false, false, 20.0, true], ["half_close", 0.5, false, false, 20.0, true],
		["coat_off_close", 0.0, false, false, 20.0, true]]
	_state(plan[0])

func _report(name: String, ex: Dictionary, arr: Array) -> void:
	# how much of the mesh's area each band hides (every corner of a triangle at a cover of 1 or more: red 2/3 and up)
	var P: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var C: PackedColorArray = arr[Mesh.ARRAY_COLOR]
	var I: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var total := 0.0
	var hid := [0.0, 0.0, 0.0, 0.0, 0.0]
	for t in range(0, I.size(), 3):
		var a := I[t]; var b := I[t + 1]; var c := I[t + 2]
		var area := 0.5 * (P[b] - P[a]).cross(P[c] - P[a]).length()
		total += area
		var any := false
		for k in 4:
			var lo: float = min(_ch(C[a], k), min(_ch(C[b], k), _ch(C[c], k)))
			if lo * 3.0 - 1.0 >= 0.99:
				hid[k] += area
				any = true
		if any:
			hid[4] += area
	print("GDCOVER ", name, " layer=", ex.get("hs_layer", 0), " band=", ex.get("hs_band", "skin"), " area=", snappedf(total, 0.0001), " hidden=", snappedf(hid[4] / max(total, 1e-9), 0.001),
		" by bottoms=", snappedf(hid[0] / max(total, 1e-9), 0.001), " tops=", snappedf(hid[1] / max(total, 1e-9), 0.001), " outerwear=", snappedf(hid[2] / max(total, 1e-9), 0.001), " footwear=", snappedf(hid[3] / max(total, 1e-9), 0.001))

func _ch(c: Color, k: int) -> float:
	return c.r if k == 0 else c.g if k == 1 else c.b if k == 2 else c.a

func _state(p: Array) -> void:
	for mi in meshes:
		for s in mi.mesh.get_surface_count():
			var sm: ShaderMaterial = mi.get_surface_override_material(s)
			sm.set_shader_parameter("outerwear", p[1])
			sm.set_shader_parameter("show_cover", p[3])
	for mi in outer:
		mi.visible = p[2]
	rig.rotation_degrees = Vector3(0, p[4], 0)
	if p[5]:
		cam.position = Vector3(0, 1.22, 1.75)
		cam.look_at(Vector3(0, 1.2, 0))
	else:
		cam.position = Vector3(0, 0.95, 3.6)
		cam.look_at(Vector3(0, 0.86, 0))
	wait = 0

func _process(_d: float) -> bool:
	wait += 1
	if wait < 6:
		return false
	var img := vp.get_texture().get_image()
	var f: String = out.path_join(plan[at][0] + ".png")
	img.save_png(f)
	print("GDSHOT ", plan[at][0], " ", img.get_width(), "x", img.get_height())
	at += 1
	if at >= plan.size():
		print("GDLAYERS done")
		quit()
		return true
	_state(plan[at])
	return false
