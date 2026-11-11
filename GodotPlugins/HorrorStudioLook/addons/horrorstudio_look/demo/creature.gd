## Creature skins (HSCreatureSkin, docs/GODOT_LOOK.md §5o; tools/godot/creature_skin_check.py runs it: CREATURESKIN).
## A dark stage, a warm lamp, eleven balls with a made-up skin's paint: one plain, one for each look. Pictured lit, with
## the lamp out (what glows of itself), with the lamp behind (what lets light through), at half the look and at none;
## each ball measured where it lands in the picture (its brightness, its brightest point, how much colour, how the
## colour turns from its middle to its edge, how broken its surface is, what glows). Then, given a Studio export
## (`--glb=`), each look on the character (her skin, and her horns and ears with `extend`), pictured head and shoulders;
## what she wore before put back at the end and counted.
##   godot --path PROJECT --rendering-driver vulkan -s res://addons/horrorstudio_look/demo/creature.gd -- --out=DIR [--glb=FILE] [--looks=chrome,pearl]
extends SceneTree

var out_dir := "res://"
var glb := ""
var looks: Array = []
var report := {"balls": {}, "shots": {}}
var world: Node3D
var env: Environment
var cam: Camera3D
var key: SpotLight3D
var fill: OmniLight3D
var balls: Array = []             # [{name, mi}]
var who: Node3D = null
var look_node: HSCharacterLook = null
var stages: Array = []
var stage := 0
var n := 0
const R := 0.2


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--glb="):
			glb = a.substr(6)
		elif a.begins_with("--looks="):
			looks = Array(a.substr(8).split(","))
	if looks.is_empty():
		looks = Array(HSCreatureSkin.names())
	root.size = Vector2i(1280, 720)
	world = Node3D.new()
	root.add_child(world)
	env = Environment.new()
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	HSLook.apply(root, env, "balanced")
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.012, 0.013, 0.016)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.55, 0.65)
	env.ambient_light_energy = 0.06
	env.volumetric_fog_enabled = false
	env.fog_enabled = false
	cam = Camera3D.new()
	cam.fov = 30.0
	world.add_child(cam)
	cam.look_at_from_position(Vector3(0, 1.0, 4.6), Vector3(0, 1.0, 0))
	cam.current = true
	key = SpotLight3D.new()
	key.light_color = Color(1.0, 0.93, 0.82)
	key.light_energy = 14.0
	key.spot_range = 12.0
	key.spot_angle = 38.0
	key.shadow_enabled = true
	world.add_child(key)
	fill = OmniLight3D.new()
	fill.light_color = Color(0.6, 0.72, 1.0)
	fill.light_energy = 0.5
	fill.omni_range = 10.0
	world.add_child(fill)
	fill.position = Vector3(3.5, 0.6, 3.0)
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(12, 12)
	floor_mi.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.09, 0.09, 0.1)
	fm.roughness = 0.9
	floor_mi.material_override = fm
	world.add_child(floor_mi)
	floor_mi.position = Vector3(0, 0.35, 0)
	# the balls: plain, then a look each, in two rows
	var paint := skin_paint()
	var names: Array = ["plain"] + looks
	var cols := int(ceil(names.size() / 2.0))
	for i in names.size():
		var mi := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = R
		sm.height = 2.0 * R
		sm.radial_segments = 96
		sm.rings = 48
		mi.mesh = sm
		var base := {"albedo": Color(1, 1, 1), "texture_albedo": paint, "uv_metres": Vector2(0.63, 0.63)}   # a ball of 20 cm: its UVs 1.26 m round, 0.63 m pole to pole
		var m: ShaderMaterial = HSCreatureSkin.material(names[i] if names[i] != "plain" else "chrome", base, {"amount": 0.0} if names[i] == "plain" else {})
		m.set_shader_parameter("uv_aspect", Vector2(2.0, 1.0))
		mi.material_override = m
		mi.position = Vector3((i % cols - (cols - 1) / 2.0) * 0.5, 1.28 if i < cols else 0.72, 0)
		world.add_child(mi)
		balls.append({"name": names[i], "mi": mi})
	stages = ["lit", "dark", "back", "half", "none"]
	if glb != "":
		load_who()
		if who != null:
			for l in looks:
				stages.append("who:" + str(l))
			stages.append("who:off")
	print("CREATURE stages ", stages)


## a made-up skin's paint: a tone with darker and redder patches (so a look that keeps the paint shows it)
func skin_paint() -> ImageTexture:
	var img := Image.create(256, 128, false, Image.FORMAT_RGB8)
	for y in 128:
		for x in 256:
			var k := 0.5 + 0.5 * sin(x * 0.19) * sin(y * 0.23)
			var c := Color(0.78, 0.56, 0.47).lerp(Color(0.62, 0.36, 0.3), k * 0.55)
			img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)


func load_who() -> void:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(glb, st) != OK:
		return
	who = doc.generate_scene(st) as Node3D
	if who == null:
		return
	world.add_child(who)
	who.position = Vector3(0, 0.35, 40.0)                # her own place, far from the balls
	look_node = HSCharacterLook.new()                    # as a game by hand wears her: the node under her, its Creature skin row
	look_node.glb_path = glb
	who.add_child(look_node)                             # (it wears her look by itself once the game runs: the frames before her pictures)
	var hint := ""
	for pr in look_node.get_property_list():
		if pr["name"] == "creature_skin":
			hint = str(pr["hint_string"])
	report["who"] = {"node_looks": hint, "looks": ",".join(HSCreatureSkin.names())}


## where a ball lands in the picture: its middle and its radius, in pixels
func disc(mi: MeshInstance3D) -> Array:
	var c := cam.unproject_position(mi.global_position)
	var e := cam.unproject_position(mi.global_position + cam.global_basis.x * R)
	return [c, c.distance_to(e)]


## a ball measured: over its whole disc and over rings of it
func measure(img: Image, mi: MeshInstance3D) -> Dictionary:
	var d := disc(mi)
	var c: Vector2 = d[0]
	var r: float = d[1]
	var sum := Vector3.ZERO
	var cnt := 0
	var mx := 0.0
	var sat := 0.0
	var lum2 := 0.0
	var lum1 := 0.0
	var mid := Vector3.ZERO
	var midn := 0
	var edge := Vector3.ZERO
	var edgen := 0
	var glow := 0
	var darkline := 0
	var lums: Array = []
	for y in range(int(c.y - r), int(c.y + r) + 1):
		for x in range(int(c.x - r), int(c.x + r) + 1):
			var q := Vector2(x + 0.5, y + 0.5).distance_to(c) / r
			if q > 0.96 or x < 0 or y < 0 or x >= img.get_width() or y >= img.get_height():
				continue
			var p := img.get_pixel(x, y)
			var l := p.r * 0.3 + p.g * 0.59 + p.b * 0.11
			sum += Vector3(p.r, p.g, p.b)
			cnt += 1
			mx = maxf(mx, l)
			sat += p.s
			lum1 += l
			lum2 += l * l
			if q < 0.4:
				mid += Vector3(p.r, p.g, p.b)
				midn += 1
			elif q > 0.72:
				edge += Vector3(p.r, p.g, p.b)
				edgen += 1
			if p.r > 0.25 and p.r > p.b * 2.5 and p.r > p.g * 1.3:
				glow += 1
			lums.append(l)
	var mean := lum1 / maxf(cnt, 1)
	for l in lums:
		if l < mean * 0.55:
			darkline += 1
	var m := mid / maxf(midn, 1)
	var e := edge / maxf(edgen, 1)
	return {"mean": mean, "max": mx, "sat": sat / maxf(cnt, 1), "std": sqrt(maxf(lum2 / maxf(cnt, 1) - mean * mean, 0.0)), "rgb": [sum.x / maxf(cnt, 1), sum.y / maxf(cnt, 1), sum.z / maxf(cnt, 1)],
		"mid": [m.x, m.y, m.z], "edge": [e.x, e.y, e.z], "mid_hue": Color(m.x, m.y, m.z).h, "edge_hue": Color(e.x, e.y, e.z).h, "edge_sat": Color(e.x, e.y, e.z).s,
		"glow": float(glow) / maxf(cnt, 1), "dark": float(darkline) / maxf(cnt, 1), "px": cnt}


func setup(name: String) -> void:
	key.visible = true
	key.light_energy = 14.0
	key.position = Vector3(-2.2, 3.2, 3.6)
	key.look_at(Vector3(0, 1.0, 0))
	for b in balls:
		(b["mi"].material_override as ShaderMaterial).set_shader_parameter("amount", 0.0 if b["name"] == "plain" else 1.0)
	match name:
		"dark":
			key.visible = false
		"back":
			key.position = Vector3(1.2, 2.2, -3.4)
			key.look_at(Vector3(0, 1.0, 0))
			key.light_energy = 22.0
		"half":
			for b in balls:
				if b["name"] != "plain":
					(b["mi"].material_override as ShaderMaterial).set_shader_parameter("amount", 0.5)
		"none":
			for b in balls:
				(b["mi"].material_override as ShaderMaterial).set_shader_parameter("amount", 0.0)
	if name.begins_with("who:") and who != null:
		var l := name.substr(4)
		if not report["who"].has("materials"):
			report["who"]["materials"] = look_node.materials.size()
			look_node.wear()                             # worn again (a script's call after the node's own): her skin keeps its paint
			var paint := 0
			for m in look_node.materials:
				if m is ShaderMaterial and m.shader == HSSkin.shader() and m.get_shader_parameter("texture_albedo") is Texture2D:
					paint += 1
			report["who"]["paint_kept"] = paint
			var bl = HSBlink.of(who)
			if bl != null:
				bl.idle = false
		if l == "off":
			look_node.set_creature("none")
			report["who"]["left"] = HSCreatureSkin.worn(who).size()
			var back := 0                               # her skin on the skin shader again
			for mi in who.find_children("*", "MeshInstance3D", true, false):
				for k in (mi.mesh.get_surface_count() if mi.mesh != null else 0):
					var m = mi.get_surface_override_material(k)
					if m is ShaderMaterial and m.shader == HSSkin.shader():
						back += 1
			report["who"]["skin_back"] = back
		else:
			look_node.set_creature(l)
			report["who"][l] = HSCreatureSkin.worn(who).size()
			if l == looks[0]:                           # how much of it, changed while it's worn
				look_node.set_creature_amount(0.25)
				var got := []
				for m in HSCreatureSkin.worn(who):
					got.append(float(m.get_shader_parameter("amount")))
				report["who"]["amount"] = got
				look_node.set_creature_amount(1.0)
		# head and shoulders: what stands over her chest, framed
		var bb := AABB()
		var first := true
		for mi in who.find_children("*", "MeshInstance3D", true, false):
			if not (mi as MeshInstance3D).visible:
				continue
			var a: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
			bb = a if first else bb.merge(a)
			first = false
		var top := bb.position.y + bb.size.y
		var tall := bb.size.y
		var sk: Skeleton3D = null
		for s in who.find_children("*", "Skeleton3D", true, false):
			sk = s
		var head_y := top - 0.12 * tall / 1.7
		if sk != null and sk.find_bone("c_head") >= 0:
			head_y = (sk.global_transform * sk.get_bone_global_rest(sk.find_bone("c_head"))).origin.y + 0.05
		var span := maxf(0.34, (top - head_y) * 2.0 + 0.24)       # the head, its horns, the shoulders' start
		var look_at := Vector3(who.global_position.x, head_y + (top - head_y) * 0.25 - span * 0.12, who.global_position.z)
		var dist := span / (2.0 * tan(deg_to_rad(cam.fov) / 2.0)) * 1.05
		if env.background_mode != Environment.BG_SKY:           # a level has a sky, however dim: something for a mirror to mirror
			var sky := Sky.new()
			var psm := ProceduralSkyMaterial.new()
			psm.sky_top_color = Color(0.03, 0.04, 0.07)
			psm.sky_horizon_color = Color(0.16, 0.18, 0.23)
			psm.ground_bottom_color = Color(0.015, 0.015, 0.015)
			psm.ground_horizon_color = Color(0.11, 0.11, 0.12)
			psm.sun_angle_max = 0.0
			sky.sky_material = psm
			env.sky = sky
			env.background_mode = Environment.BG_SKY
			env.background_energy_multiplier = 0.6
			env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
			env.ambient_light_energy = 0.5
			env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
		cam.look_at_from_position(look_at + Vector3(sin(0.5), 0.08, cos(0.5)) * dist, look_at)
		key.position = look_at + Vector3(-1.4, 1.3, 2.4)
		key.look_at(look_at)
		key.light_energy = 9.0
		fill.position = look_at + Vector3(2.0, 0.4, -1.6)
		fill.light_energy = 1.6
	else:
		cam.look_at_from_position(Vector3(0, 1.0, 4.6), Vector3(0, 1.0, 0))
		fill.position = Vector3(3.5, 0.6, 3.0)
		fill.light_energy = 0.5


func _process(_d: float) -> bool:
	n += 1
	if n == 1:
		setup(stages[stage])
	if n < 20:                                    # TAA settles
		return false
	var name: String = stages[stage]
	var img := root.get_texture().get_image()
	if img.save_png(out_dir.path_join("creature_%s.png" % name.replace(":", "_"))) != OK:
		print("CREATURE FAIL: can't write into " + out_dir)
		quit(1)
		return true
	if not name.begins_with("who:"):
		var row := {}
		for b in balls:
			row[b["name"]] = measure(img, b["mi"])
		report["shots"][name] = row
	stage += 1
	n = 0
	if stage >= stages.size():
		var f := FileAccess.open(out_dir.path_join("creature.json"), FileAccess.WRITE)
		if f != null:
			f.store_string(JSON.stringify(report, "  "))
			f.close()
		print("CREATURE {done}")
		return true
	return false
