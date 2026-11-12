## The effect nodes and their presets (docs/GODOT_LOOK.md §0; tools/godot/plugin_check.py runs it: LOOKPLUGIN's
## nodes part): a small room with every preset in addons/horrorstudio_look/presets/ dropped in where it belongs (the
## wet floors under floor meshes, the leak and the blood on the wall, the lights over the floor...), run a few
## seconds, each node's work measured, the room pictured; then a save as the editor does it (the pre-save
## notification): every mesh's own material back, every light at its full energy, no projector, and nothing the
## nodes made in the packed scene; after the save they're on again. Writes nodes.json and nodes.png in --out.
##   godot --path PROJECT --fixed-fps 60 -s res://addons/horrorstudio_look/demo/nodes.gd -- --out=DIR
extends SceneTree

const P := "res://addons/horrorstudio_look/presets/"
var lightning_peak := 0.0                     # the lightning preset's flash at its brightest (fired with the sweep)
var out_dir := "res://"
var world: Node3D
var cam: Camera3D
var floor_mi: MeshInstance3D
var wall: MeshInstance3D
var tiles: Array = []
var body: Node3D
var creatures: Array = []     # [look, its figure]
var eye_figs: Array = []      # [look, its figure, its preset's node]
var cloak_fig: Node3D = null
var got := {}                  # preset name -> its node
var rep := {}
var n := 0
var energies := {}             # flicker light -> [min, max]
var fired := false


func mesh(m: Mesh, at: Vector3, col: Color, parent: Node = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = m
	var sm := StandardMaterial3D.new()
	sm.albedo_color = col
	sm.roughness = 0.8
	m.surface_set_material(0, sm)
	(parent if parent != null else world).add_child(mi)
	mi.position = at
	return mi


func put(name: String, parent: Node, at: Vector3, rot := Vector3.INF) -> Node:
	var node: Node = (load(P + name + ".tscn") as PackedScene).instantiate()
	parent.add_child(node)
	if node is Node3D:
		node.position = at
		if rot != Vector3.INF:
			node.rotation = rot
	got[name] = node
	return node


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
	world = Node3D.new()
	world.name = "Room"
	root.add_child(world)
	var we := WorldEnvironment.new()
	we.environment = Environment.new()
	we.environment.background_mode = Environment.BG_COLOR
	we.environment.background_color = Color(0.02, 0.02, 0.03)
	we.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	we.environment.ambient_light_color = Color(0.5, 0.55, 0.65)
	we.environment.ambient_light_energy = 0.3
	HSLook.apply(root, we.environment, "realism")
	world.add_child(we)
	cam = Camera3D.new()
	cam.position = Vector3(0, 1.7, 4.2)
	cam.rotation_degrees = Vector3(-12, 0, 0)
	cam.fov = 75
	world.add_child(cam)
	cam.current = true
	var pm := PlaneMesh.new()
	pm.size = Vector2(8, 8)
	floor_mi = mesh(pm, Vector3.ZERO, Color(0.35, 0.3, 0.26))
	floor_mi.name = "Floor"
	var bm := BoxMesh.new()
	bm.size = Vector3(8, 3, 0.2)
	wall = mesh(bm, Vector3(0, 1.5, -3.1), Color(0.55, 0.52, 0.48))
	wall.name = "Wall"
	for i in 3:
		var tm := PlaneMesh.new()
		tm.size = Vector2(1, 1)
		tiles.append(mesh(tm, Vector3(-3.0 + i * 1.2, 0.01, 2.6), Color(0.4, 0.36, 0.3)))
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(0, 2.6, 0.5)
	lamp.light_energy = 1.5
	lamp.omni_range = 9
	lamp.shadow_enabled = true
	world.add_child(lamp)
	body = Node3D.new()
	body.name = "Character"
	world.add_child(body)
	body.position = Vector3(1.6, 1.0, 0.6)
	var sph := SphereMesh.new()
	sph.radius = 0.25
	sph.height = 0.5
	var bmi := mesh(sph, Vector3.ZERO, Color(0.85, 0.66, 0.55), body)
	bmi.name = "body_skin"
	# the presets, each where it belongs
	put("rain", world, Vector3(3, 1.5, 0)).size = Vector3(2, 3, 2)
	put("downpour", world, Vector3(-3.4, 1.5, -1)).size = Vector3(1.2, 3, 1.2)
	put("wet_floor", floor_mi, Vector3.ZERO)
	put("wet_floor_raining", tiles[0], Vector3.ZERO)
	put("damp_floor", tiles[1], Vector3.ZERO)
	put("puddle", world, Vector3(-1.8, 0, 1.2))
	put("blood_pool", world, Vector3(-0.8, 0, 0.6))
	put("blood_dried", world, Vector3(0.9, 0, 1.6))
	put("blood_wall", world, Vector3(-2.0, 1.2, -2.995))
	put("wall_leak", wall, Vector3(1.4, 1.1, 0.105), Vector3(0, PI, 0))   # on the wall's face, forward into the room
	put("window_shaft", world, Vector3(2.4, 2.6, 1.2))
	put("window_sun", world, Vector3(-1.0, 2.8, 2.0))
	put("headlight_sweep", world, Vector3(0, 1.6, -3.0), Vector3(0, PI, 0))
	put("lightning", world, Vector3(0, 3.0, 0), Vector3(-1.0, 0.6, 0))
	var down := Vector3(-PI / 2.0, 0, 0)
	put("caustics_light", world, Vector3(-2.5, 2.8, 0), down)
	put("blinds_light", world, Vector3(-0.8, 2.8, -1.5), down)
	put("leaves_light", world, Vector3(0.8, 2.8, -1.5), down)
	put("clouds_light", world, Vector3(2.5, 6.0, -1.5), down)
	put("fluorescent_tube", world, Vector3(-2.8, 2.7, 1.8))
	put("dying_bulb", world, Vector3(2.8, 2.6, 1.8))
	put("candle", world, Vector3(0.3, 0.3, 1.0))
	put("alarm_pulse", world, Vector3(-3.6, 2.6, -2.6))
	put("faulty_neon", world, Vector3(3.6, 2.6, -2.6))
	put("desk_lamp_dying", world, Vector3(0, 2.0, 2.4))
	put("mirror", world, Vector3(2.6, 1.4, -2.99))
	put("window_pane", world, Vector3(-2.7, 1.6, -2.99))
	put("crt_screen", world, Vector3(0.3, 2.2, -2.99))
	put("character_look", body, Vector3.ZERO)
	put("character_sweating", body, Vector3.ZERO).target = body
	# the creature skins: each preset on a small figure of its own (a ball named skin: what a character's look finds)
	var ci := 0
	for look in HSCreatureSkin.names():
		var fig := Node3D.new()
		fig.name = "Creature_%s" % look
		world.add_child(fig)
		fig.position = Vector3(-2.6 + 0.48 * ci, 0.25, 2.7)
		var ball := SphereMesh.new()
		ball.radius = 0.16
		ball.height = 0.32
		mesh(ball, Vector3.ZERO, Color(0.78, 0.56, 0.47), fig).name = "skin"
		put("creature_%s" % look, fig, Vector3.ZERO)
		creatures.append([look, fig])
		ci += 1
	# creepy eyes: each preset on a figure with a plain ball named eye (the stand-in's version: the glow and the black)
	ci = 0
	for look in HSEyeFx.names():
		var fig := Node3D.new()
		fig.name = "Eyes_%s" % look
		world.add_child(fig)
		fig.position = Vector3(-2.6 + 0.4 * ci, 0.12, 3.1)
		var ball := SphereMesh.new()
		ball.radius = 0.08
		ball.height = 0.16
		mesh(ball, Vector3.ZERO, Color(0.9, 0.9, 0.88), fig).name = "doll_eye"
		eye_figs.append([look, fig, put("eyes_%s" % look, fig, Vector3.ZERO)])
		ci += 1
	# the cloak that comes and goes: the node under a figure
	cloak_fig = Node3D.new()
	cloak_fig.name = "Cloaked"
	world.add_child(cloak_fig)
	cloak_fig.position = Vector3(3.2, 0.25, 2.7)
	var cb := SphereMesh.new()
	cb.radius = 0.16
	cb.height = 0.32
	mesh(cb, Vector3.ZERO, Color(0.78, 0.56, 0.47), cloak_fig).name = "skin"
	put("cloak", cloak_fig, Vector3.ZERO)
	put("look_switch", body, Vector3.ZERO)             # a character's looks, switched: with no looks in its list it leaves her as she is
	put("look_environment", world, Vector3.ZERO)
	# the air: one atmosphere acts (the first in), the others wait; a flashlight and an LED torch aimed across the room
	# with their beams; a lamp's cone; motes; a dusty room's own air
	for k in ["air_hazy_night", "air_clean_room", "air_dusty_room", "air_woods_mist", "air_fog", "air_thick_fog"]:
		put(k, world, Vector3.ZERO)
	put("flashlight", world, Vector3(-3.2, 1.6, 2.4), Vector3(0, -0.9, 0))
	put("flashlight_led", world, Vector3(3.2, 1.6, 2.4), Vector3(0, 0.9, 0))
	put("lamp_beam", world, Vector3(0.0, 2.9, 0.4))
	put("dust", world, Vector3.ZERO)
	put("air_zone_dusty", world, Vector3(0, 1.5, 0))


func _process(dt: float) -> bool:
	n += 1
	for k in ["fluorescent_tube", "dying_bulb", "candle", "alarm_pulse", "faulty_neon", "desk_lamp_dying"]:
		var l: Light3D = got[k]
		var e: Array = energies.get(k, [INF, -INF])
		energies[k] = [min(e[0], l.light_energy), max(e[1], l.light_energy)]
	if got.has("lightning") and got["lightning"].storm != null:
		lightning_peak = maxf(lightning_peak, got["lightning"].storm.level)
	if n == 60 and not fired:
		fired = true
		got["headlight_sweep"].fire()
		got["lightning"].fire()
	if n == 150:
		measure()
		var img := root.get_texture().get_image()
		img.save_png(out_dir.path_join("nodes.png"))
		saving()
		add_screen_ones()
	if n == 152:
		after_save()
	if n == 160:
		rep["grade_own"] = got["grade_cinema"].post != null and got["grade_cinema"].post.visible
		rep["grade_over"] = got["grade_noir"].post == got["grade_cinema"].post and str(got["grade_cinema"].post.preset_name) == "noir"
		rep["tape_own"] = got["tape_camhybrid"].vhs != null and got["tape_camhybrid"].vhs.visible
		rep["tape_over"] = got["tape_worn"].vhs == got["tape_camhybrid"].vhs and str(got["tape_camhybrid"].vhs.preset_name) == "worn"
		got["grade_noir"].queue_free()                    # gone: the grade it went over comes back
		got["tape_worn"].queue_free()
	if n == 165:
		rep["grade_back"] = str(got["grade_cinema"].post.preset_name) == "cold"
		rep["tape_back"] = str(got["tape_camhybrid"].vhs.preset_name) == "camhybrid"
		var zl := 0
		for r in ["room_bulb", "room_fluorescent", "room_dying", "room_lamp", "room_candle", "room_night"]:
			if got[r].layer > 0 and not got[r].lights.is_empty():
				zl += 1
		rep["room_presets"] = zl
		put("look_balanced", world, Vector3.ZERO)          # a project of your own's look in one drop (after the grade and tape's test: it brings its own)
	if n == 170:
		var lb: Node = got["look_balanced"]
		var le: WorldEnvironment = lb.get_node("Environment")
		rep["look_balanced"] = le.environment != null and le.environment.ssr_enabled and le.environment.ssr_max_steps == 48 and not le.environment.ssil_enabled and root.use_taa
		rep["presets"] = got.size()
		var files := 0
		for f in DirAccess.get_files_at(P):
			if f.ends_with(".tscn"):
				files += 1
		rep["preset_files"] = files
		var f := FileAccess.open(out_dir.path_join("nodes.json"), FileAccess.WRITE)
		f.store_string(JSON.stringify(rep, "  "))
		f.close()
		print("LOOKNODES " + JSON.stringify(rep))
		quit()
	return false


func measure() -> void:
	var rb: HSRainBox = got["rain"]
	rep["rain"] = rb.rain != null and rb.rain.multimesh != null and rb.rain.multimesh.instance_count == rb.count
	rep["wet"] = floor_mi.material_override is ShaderMaterial and floor_mi.material_override.shader == HSWet.shader()
	rep["wet_ripples"] = tiles[0].material_override is ShaderMaterial and float(tiles[0].material_override.get_shader_parameter("ripples")) > 0.5
	rep["puddle"] = got["puddle"].decal != null and got["puddle"].decal.texture_albedo != null
	rep["blood"] = got["blood_pool"].splat != null and got["blood_wall"].splat != null and float(got["blood_wall"].splat.material_override.get_shader_parameter("drips")) > 0.5
	rep["leak"] = got["wall_leak"].leak != null and wall.material_override is ShaderMaterial and bool(wall.material_override.get_shader_parameter("band_on"))
	rep["leak_drops"] = got["wall_leak"].leak.drops if got["wall_leak"].leak != null else 0
	var beam: FogVolume = got["window_shaft"].beam
	rep["shaft"] = beam != null and beam.get_node_or_null("Card") != null and absf(beam.size.z - got["window_shaft"].length) < 0.001 and got["window_shaft"].length < got["window_shaft"].reach
	rep["sweep_passing"] = got["headlight_sweep"].passing() and got["headlight_sweep"].sweep.lamp.visible
	rep["lightning"] = lightning_peak > 0.95 and got["lightning"].storm.strikes == 1 and not got["lightning"].striking() and not got["lightning"].storm.light.visible
	var pats := 0
	for k in ["caustics_light", "blinds_light", "leaves_light", "clouds_light"]:
		if got[k].hp != null and got[k].light_projector != null:
			pats += 1
	rep["patterns"] = pats
	var acting := 0
	for k in ["air_hazy_night", "air_clean_room", "air_dusty_room", "air_woods_mist", "air_fog", "air_thick_fog"]:
		acting += int(got[k].active())
	rep["air_one_acts"] = acting == 1 and got["air_hazy_night"].active()
	rep["air_presets"] = is_equal_approx(got["air_dusty_room"].dust, HSAir.PRESETS["dusty_room"]["dust"]) and is_equal_approx(got["air_thick_fog"].fog, HSAir.PRESETS["thick_fog"]["fog"])
	var beams := 0
	for k in ["flashlight", "flashlight_led", "lamp_beam"]:
		var b: HSBeam = got[k].get_node("AirBeam")
		beams += int(b.hull != null and b.hull.visible)
	rep["air_beams"] = beams
	rep["air_cookies"] = got["flashlight"].light_projector != null and got["flashlight_led"].light_projector != null and is_zero_approx(got["flashlight"].light_volumetric_fog_energy)
	rep["air_dust"] = got["dust"].particles != null and got["air_zone_dusty"].is_in_group("hs_air_zone")
	var fl := {}
	for k in energies:
		fl[k] = [snappedf(energies[k][0], 0.001), snappedf(energies[k][1], 0.001)]
	rep["flicker"] = fl
	var hm: HSMirror = got["mirror"].get_node("Reflection").mirror
	rep["mirror"] = hm != null and hm.frames > 10 and got["mirror"].material_override == null   # drawing its reflection, nothing over it
	rep["mirror_frames"] = hm.frames if hm != null else 0
	rep["pane"] = got["window_pane"].material_override is ShaderMaterial and got["window_pane"].material_override.shader == HSGlass.shader()
	rep["crt"] = got["crt_screen"].material_override is ShaderMaterial and got["crt_screen"].material_override.shader == HSCrt.shader() and got["crt_screen"].get_node("Screen").materials.size() == 1
	rep["character"] = got["character_look"].materials.size()
	var worn := 0                                    # each creature preset's figure wears its own look, over the skin shader the same node put on
	for c in creatures:
		var ms: Array = HSCreatureSkin.worn(c[1])
		if ms.size() == 1 and str(ms[0].get_meta("hs_creature")) == str(c[0]):
			worn += 1
	rep["creatures"] = worn
	rep["creature_looks"] = creatures.size()
	var eyes_ok := 0                                 # each eye preset's node names its own look; the glow and the black go on a plain eye
	var eyes_plain := 0
	for e in eye_figs:
		if str(e[2].eye_fx) == str(e[0]):
			eyes_ok += 1
		if HSEyeFx.worn(e[1]).size() == 1:
			eyes_plain += 1
	rep["eyes"] = eyes_ok
	rep["eye_looks"] = eye_figs.size()
	rep["eyes_plain"] = eyes_plain
	var cm: Array = HSCreatureSkin.worn(cloak_fig)   # the cloak's node: its figure cloaked from the start, on the cloak's own shader
	rep["cloak_node"] = cm.size() == 1 and cm[0].shader == HSCreatureSkin.shader_of("cloak") and float(cm[0].get_shader_parameter("amount")) == 1.0
	rep["look_env_freed"] = not is_instance_valid(got["look_environment"])


## the editor's save: the pre-save notification, the scene packed, then the post-save one
func saving() -> void:
	var lights := {}
	for k in ["fluorescent_tube", "dying_bulb", "candle"]:
		lights[k] = got[k].drive.base
	world.propagate_notification(Node.NOTIFICATION_EDITOR_PRE_SAVE)
	var ok := floor_mi.material_override == null and wall.material_override == null and tiles[0].material_override == null and not floor_mi.has_meta(HSWet.META)
	ok = ok and got["window_pane"].material_override == null and got["crt_screen"].material_override == null
	var lit := true
	for k in lights:
		lit = lit and absf(got[k].light_energy - float(lights[k])) < 0.0001
	var proj := true
	for k in ["caustics_light", "blinds_light", "leaves_light", "clouds_light", "flashlight", "flashlight_led"]:
		proj = proj and got[k].light_projector == null
	rep["save_air_back"] = got["air_hazy_night"]._env == null and is_equal_approx(got["flashlight"].light_volumetric_fog_energy, 1.0)
	rep["save_materials_back"] = ok
	rep["save_lights_full"] = lit
	rep["save_no_projector"] = proj
	_own(world)
	var ps := PackedScene.new()
	ps.pack(world)
	var st := ps.get_state()
	var made: Array = []
	for i in st.get_node_count():
		var nm := str(st.get_node_name(i))
		if nm in ["Beam", "Card", "Sweep", "Lamp", "Pattern", "Leak", "Splashes", "Draw", "Mirror", "BeamCone", "Air", "Motes"] or nm.begins_with("puddle_") or nm.begins_with("blood_"):
			made.append(nm)
	rep["save_nothing_made"] = made.is_empty()
	rep["save_made"] = made
	world.propagate_notification(Node.NOTIFICATION_EDITOR_POST_SAVE)


func after_save() -> void:
	rep["after_save_on"] = floor_mi.material_override is ShaderMaterial and got["window_pane"].material_override is ShaderMaterial and wall.material_override is ShaderMaterial and got["crt_screen"].material_override is ShaderMaterial
	# a node taken off: its mesh's own material back
	var t0: MeshInstance3D = tiles[0]
	got["wet_floor_raining"].get_parent().remove_child(got["wet_floor_raining"])
	rep["removed_dry"] = t0.material_override == null


## what a scene file holds: the nodes the user placed (owned by the room), not what the nodes made inside themselves
func _own(node: Node) -> void:
	for ch in node.get_children():
		if ch == cam or (ch.owner == null and ch.get_parent() == world) or got.values().has(ch) or ch in [floor_mi, wall, body] or tiles.has(ch) or ch.get_parent() == body:
			if ch.owner == null:
				ch.owner = world
			if ch.scene_file_path == "":
				_own(ch)


func add_screen_ones() -> void:
	put("grade_cinema", world, Vector3.ZERO)
	put("grade_cold", world, Vector3.ZERO)
	put("grade_noir", world, Vector3.ZERO)
	put("tape_camhybrid", world, Vector3.ZERO)
	put("tape_worn", world, Vector3.ZERO)
	var k := 0
	for r in ["room_bulb", "room_fluorescent", "room_dying", "room_lamp", "room_candle", "room_night"]:   # (zones.gd measures them in two rooms)
		put(r, world, Vector3(-30.0 + 10.0 * k, 1.5, 30.0))
		k += 1          # a project of your own's look in one drop: the balanced environment, the camhybrid tape, the cinema grade
