## Creature skins (HSCreatureSkin, docs/GODOT_LOOK.md §5o; tools/godot/creature_skin_check.py runs it: CREATURESKIN).
## A dark stage, a warm lamp, eleven balls with a made-up skin's paint: one plain, one for each look. Pictured lit, with
## the lamp out (what glows of itself), with the lamp behind (what lets light through), at half the look and at none;
## each ball measured where it lands in the picture (its brightness, its brightest point, how much colour, how the
## colour turns from its middle to its edge, how broken its surface is, what glows). Then, given a Studio export
## (`--glb=`), each look on the character (her skin, and her horns and ears with `extend`), pictured head and shoulders;
## what she wore before put back at the end and counted.
## The cloak (§5p) has stages of its own: a ball in front of a lit wall of stripes with a red post between it and the
## eye, pictured without the ball, cloaked standing still, moving, with the lamp out, half turned, broken up and with
## its shadow kept, each compared with the wall alone; then a made-up figure (skin, eyes with a wet layer, a card of
## hair, a tear line, a shirt) through HSCreatureSkin.wear and the HSCloak node, counted, no pictures.
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
var cloak_at := Vector3(0, 1.0, -40.0)    # the cloak's own stage, far from the balls
var cloak_holder: Node3D = null
var cloak_ball: MeshInstance3D = null
var cloak_post: MeshInstance3D = null
var cloak_bg: Image = null
var cloak_on: Image = null


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
	if looks.has("cloak"):
		cloak_stage()
		cloak_figure()
		stages.append_array(["cloak_bg", "cloak_on", "cloak_post", "cloak_noguard", "cloak_moving", "cloak_dark", "cloak_half", "cloak_glitch", "cloak_shadow"])
	if glb != "":
		load_who()
		if who != null:
			if looks.has("cloak"):                      # her in front of the stripes: cloaked, half turned, cloaked with her eyes left glowing
				stages.append_array(["cloak_who", "cloak_who_half", "cloak_who_eyes"])
			for l in looks:
				stages.append("who:" + str(l))
			stages.append("who:off")
	print("CREATURE stages ", stages)


## the cloak's stage: a wall of stripes 1 m behind a ball with the made-up skin, a thin red post between it and the eye
func cloak_stage() -> void:
	var img := Image.create(256, 8, false, Image.FORMAT_RGB8)
	var cols := [Color(0.85, 0.85, 0.8), Color(0.04, 0.04, 0.05), Color(0.1, 0.55, 0.2), Color(0.8, 0.7, 0.1)]
	for y in 8:
		for x in 256:
			img.set_pixel(x, y, cols[(x / 4) % 4])                # 64 stripes over 4 m: each 6.25 cm
	var wall := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(4, 3)
	wall.mesh = qm
	var wm := StandardMaterial3D.new()
	wm.albedo_texture = ImageTexture.create_from_image(img)
	wm.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	wm.roughness = 0.9
	wall.material_override = wm
	world.add_child(wall)
	wall.position = cloak_at + Vector3(0, 0, -1.0)
	cloak_holder = Node3D.new()
	cloak_holder.name = "Cloaked"
	world.add_child(cloak_holder)
	cloak_holder.position = cloak_at
	cloak_ball = MeshInstance3D.new()
	cloak_ball.name = "her_skin"
	var sm := SphereMesh.new()
	sm.radius = R
	sm.height = 2.0 * R
	sm.radial_segments = 96
	sm.rings = 48
	var bm := StandardMaterial3D.new()
	bm.albedo_texture = skin_paint()
	bm.roughness = 0.62
	sm.material = bm
	cloak_ball.mesh = sm
	cloak_holder.add_child(cloak_ball)
	cloak_post = MeshInstance3D.new()
	var bx := BoxMesh.new()
	bx.size = Vector3(0.03, 1.2, 0.03)
	cloak_post.mesh = bx
	var pm := StandardMaterial3D.new()
	pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	pm.albedo_color = Color(1, 0, 0)
	cloak_post.material_override = pm
	cloak_post.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(cloak_post)
	cloak_post.position = cloak_at + Vector3(0.09, 0, 0.6)


## a made-up figure through wear() and the HSCloak node (no pictures): what's cloaked, what's put away, what comes back
func cloak_figure() -> void:
	var rep := {}
	var her := Node3D.new()
	her.name = "Figure"
	world.add_child(her)
	her.position = Vector3(0, 0, 60.0)
	var parts := {}
	for nm in ["fig_skin", "fig_eye_L", "fig_eye_R", "fig_hair", "fig_tearline", "fig_shirt"]:
		var mi := MeshInstance3D.new()
		mi.name = nm
		var sm := SphereMesh.new()
		sm.radius = 0.05
		sm.height = 0.1
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.7, 0.5, 0.4)
		sm.material = mat
		mi.mesh = sm
		her.add_child(mi)
		parts[nm] = mi
	var wet := StandardMaterial3D.new()                        # an eye's wet layer
	parts["fig_eye_L"].material_overlay = wet
	parts["fig_eye_R"].material_overlay = wet
	var mats: Array = HSCreatureSkin.wear(her, "cloak")
	var cloak_shader: Shader = HSCreatureSkin.shader_of("cloak")
	var on := 0
	for m in mats:
		if m is ShaderMaterial and m.shader == cloak_shader:
			on += 1
	rep["worn"] = on                                          # every mesh but the tear line: 5
	rep["own_shader"] = cloak_shader != HSCreatureSkin.shader()
	rep["tear_hidden"] = not parts["fig_tearline"].visible
	rep["overlay_off"] = parts["fig_eye_L"].material_overlay == null
	rep["shadow_off"] = parts["fig_skin"].cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	rep["hair_cut"] = (parts["fig_hair"].get_surface_override_material(0) as ShaderMaterial).get_shader_parameter("alpha_cut") == true
	HSCreatureSkin.wear(her, "chrome")                        # another look after it: the cloak wholly off first
	rep["after_chrome"] = [HSCreatureSkin.worn(her).size(), parts["fig_tearline"].visible, parts["fig_eye_L"].material_overlay == wet, parts["fig_shirt"].get_surface_override_material(0) == null]
	HSCreatureSkin.clear(her)
	HSCreatureSkin.wear(her, "cloak", {"eyes": true, "shadow": true})
	rep["eyes_kept"] = parts["fig_eye_L"].get_surface_override_material(0) == null and parts["fig_eye_L"].material_overlay == wet
	rep["shadow_kept"] = parts["fig_skin"].cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	rep["cleared"] = HSCreatureSkin.clear(her)
	rep["left"] = HSCreatureSkin.worn(her).size()
	rep["back"] = parts["fig_tearline"].visible and parts["fig_eye_L"].material_overlay == wet and parts["fig_skin"].cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	# the node: she starts cloaked, shows when she moves, comes back over a second, goes again, breaks up when asked
	var c := HSCloak.new()
	c.cloaked = false
	her.add_child(c)
	var heard: Array = []
	c.cloaked_changed.connect(func(v): heard.append(v))
	c.advance(0.1)
	rep["node_starts_plain"] = HSCreatureSkin.worn(her).size() == 0
	c.cloak(1.0)
	c.advance(0.5)
	rep["node_half"] = [c.amount, HSCreatureSkin.worn(her).size()]
	c.advance(0.6)
	rep["node_on"] = [c.amount, float(c.materials[0].get_shader_parameter("amount")) if c.materials.size() > 0 else -1.0]
	for i in 30:                                              # walking at 1.4 m/s for half a second
		her.position.x += 1.4 / 60.0
		c.advance(1.0 / 60.0)
	rep["node_moving"] = c.motion
	for i in 240:                                             # standing four seconds
		c.advance(1.0 / 60.0)
	rep["node_still"] = c.motion
	c.flicker(0.5)
	rep["node_glitch"] = [c.glitch]
	c.advance(0.25)
	rep["node_glitch"].append(c.glitch)
	c.advance(0.3)
	rep["node_glitch"].append(c.glitch)
	c.on_fire = "toggle"
	c.fire()                                                  # cloaked: revealed
	c.advance(0.6)
	rep["node_revealing"] = c.amount
	c.advance(0.7)
	c.advance(0.1)
	rep["node_revealed"] = [c.amount, HSCreatureSkin.worn(her).size(), parts["fig_tearline"].visible]
	rep["node_heard"] = heard
	report["cloak_figure"] = rep
	her.visible = false


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


## the cloaked ball against the wall alone: how much it shows inside its outline (the picture's difference from the
## wall's, 0..1), how much of that is her skin's colour, how much brighter than the wall (the crackle), what changed
## round it, how dark the wall is where her shadow would fall, and (the post's shot) how much inside her outline, away
## from the post itself, differs from the shot without the post: the post pulled into her
func measure_cloak(img: Image) -> Dictionary:
	var d := disc(cloak_ball)
	var c: Vector2 = d[0]
	var r: float = d[1]
	var post_x := cam.unproject_position(cloak_post.global_position).x
	var post_w := absf(cam.unproject_position(cloak_post.global_position + cam.global_basis.x * 0.015).x - post_x) + 3.0
	var post_c := img.get_pixel(int(post_x), int(c.y - 1.3 * r))           # the post as the picture has it, above her
	var seen := 0.0
	var cnt := 0
	var skin := 0
	var bright := 0
	var red := 0
	var around := 0.0
	var mean := Vector3.ZERO
	var bmean := Vector3.ZERO
	var lum := 0.0
	var round_it := 0.0
	var rn := 0
	for y in range(int(c.y - 1.6 * r), int(c.y + 1.6 * r) + 1):
		for x in range(int(c.x - 1.6 * r), int(c.x + 1.6 * r) + 1):
			if x < 0 or y < 0 or x >= img.get_width() or y >= img.get_height():
				continue
			var q := Vector2(x + 0.5, y + 0.5).distance_to(c) / r
			var p := img.get_pixel(x, y)
			var b := cloak_bg.get_pixel(x, y)
			var l := p.r * 0.3 + p.g * 0.59 + p.b * 0.11
			var bl := b.r * 0.3 + b.g * 0.59 + b.b * 0.11
			if q < 0.97:
				cnt += 1
				seen += (absf(p.r - b.r) + absf(p.g - b.g) + absf(p.b - b.b)) / 3.0
				mean += Vector3(p.r, p.g, p.b)
				bmean += Vector3(b.r, b.g, b.b)
				lum += l
				if p.r > 0.2 and p.r > p.g * 1.25 and p.g > p.b * 1.05:
					skin += 1
				if l - bl > 0.3:
					bright += 1
				if cloak_post.visible and absf(x + 0.5 - post_x) > post_w:      # the post's own colour, away from the post
					if absf(p.r - post_c.r) + absf(p.g - post_c.g) + absf(p.b - post_c.b) < 0.3:
						red += 1
			elif q > 1.08 and q < 1.6:
				rn += 1
				round_it += absf(l - bl)
				around += l
	# where her shadow falls on the wall: her middle carried along the lamp's ray to the wall's plane
	var to := (cloak_ball.global_position - key.global_position).normalized()
	var hit := cloak_ball.global_position + to * ((cloak_at.z - 1.0 - cloak_ball.global_position.z) / to.z)
	var sc := cam.unproject_position(hit)
	var shade := 0.0
	var sn := 0
	for y in range(int(sc.y - 0.4 * r), int(sc.y + 0.4 * r) + 1):
		for x in range(int(sc.x - 0.4 * r), int(sc.x + 0.4 * r) + 1):
			if x < 0 or y < 0 or x >= img.get_width() or y >= img.get_height():
				continue
			var p := img.get_pixel(x, y)
			var b := cloak_bg.get_pixel(x, y)
			shade += (b.r * 0.3 + b.g * 0.59 + b.b * 0.11) - (p.r * 0.3 + p.g * 0.59 + p.b * 0.11)
			sn += 1
	mean /= maxf(cnt, 1)
	bmean /= maxf(cnt, 1)
	return {"seen": seen / maxf(cnt, 1), "skin": float(skin) / maxf(cnt, 1), "bright": float(bright) / maxf(cnt, 1), "red": red,
		"mean": [mean.x, mean.y, mean.z], "wall": [bmean.x, bmean.y, bmean.z], "lum": lum / maxf(cnt, 1), "round": round_it / maxf(rn, 1), "around": around / maxf(rn, 1),
		"shade": shade / maxf(sn, 1), "px": cnt}


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
	if name.begins_with("cloak_"):                     # the cloak's own stage: the ball in front of the stripes
		cam.look_at_from_position(cloak_at + Vector3(0, 0, 2.6), cloak_at)
		key.position = cloak_at + Vector3(-1.6, 1.8, 2.4)
		key.look_at(cloak_at + Vector3(0, 0, -0.5))
		key.light_energy = 9.0
		key.visible = name != "cloak_dark"
		fill.position = cloak_at + Vector3(2.0, 0.4, 2.0)
		HSCreatureSkin.clear(cloak_holder)
		if name.begins_with("cloak_who"):                  # the character in the ball's place
			cloak_ball.visible = false
			cloak_post.visible = false
			var tall := 1.7
			for mi in who.find_children("*", "MeshInstance3D", true, false):
				if String(mi.name).to_lower().ends_with("_skin"):
					tall = (mi as MeshInstance3D).get_aabb().size.y
			who.position = cloak_at + Vector3(0, 0.55 - tall, 0)       # her head in the picture's upper half
			var bl = HSBlink.of(who)
			if bl != null:
				bl.idle = false
			HSCreatureSkin.clear(who)
			HSEyeFx.clear(who)
			if name == "cloak_who_eyes":
				HSEyeFx.wear(who, "glow")
			HSCreatureSkin.wear(who, "cloak", {"amount": 0.5 if name == "cloak_who_half" else 1.0, "eyes": name == "cloak_who_eyes"})
			return
		cloak_ball.visible = name != "cloak_bg"
		cloak_post.visible = name == "cloak_post" or name == "cloak_noguard"   # (in the other shots it would only be in the way of the measure)
		if name != "cloak_bg":
			var st := {"motion": 1.0 if name == "cloak_moving" else 0.0, "amount": 0.5 if name == "cloak_half" else 1.0,
				"glitch": 1.0 if name == "cloak_glitch" else 0.0, "shadow": name == "cloak_shadow", "depth_guard": name != "cloak_noguard"}
			HSCreatureSkin.wear(cloak_holder, "cloak", st)
		return
	if name.begins_with("who:") and who != null:
		var l := name.substr(4)
		if who.position.z < 0.0:                           # back from the cloak's stage, as she was
			HSCreatureSkin.clear(who)
			HSEyeFx.clear(who)
			who.position = Vector3(0, 0.35, 40.0)
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
	if name.begins_with("cloak_who"):
		pass
	elif name.begins_with("cloak_"):
		if name == "cloak_bg":
			cloak_bg = img
		elif cloak_bg != null:
			if not report.has("cloak"):
				report["cloak"] = {}
			report["cloak"][name.substr(6)] = measure_cloak(img)
			if name == "cloak_on":
				cloak_on = img
	elif not name.begins_with("who:"):
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
