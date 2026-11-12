## MIND's playthrough (tools/godot/mind_check.py): the starter kit's flicker_lit.gd, moved.gd and gaslight.gd, and the
## look plugin's HSPhase and HSUnease as nodes (what they do, not how they draw: mind_shots.gd draws them). Headless
## (--fixed-fps 60). Prints `MIND <what> <how>` lines and `MIND result {errors}`, quits.
extends SceneTree

const S := "res://starter/"
const Lights := preload("res://starter/lights.gd")

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var story: Node
var torch: Light3D


func say(what: String, how: String) -> void:
	print("MIND %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("MIND ERROR %s" % e)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 60.0)))


func made(src: String) -> GDScript:
	var s := GDScript.new()
	s.source_code = src
	s.reload()
	return s


func figure(nm: String, at: Vector3) -> Node3D:
	var h := Node3D.new()
	h.name = nm
	var m := MeshInstance3D.new()
	m.name = "Body"
	var cap := CapsuleMesh.new()
	cap.radius = 0.22
	cap.height = 1.7
	m.mesh = cap
	m.position = Vector3(0, 0.85, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.8, 0.7, 0.6)
	m.set_surface_override_material(0, mat)
	h.add_child(m)
	var head := MeshInstance3D.new()
	head.name = "Head"
	var sp := SphereMesh.new()
	sp.radius = 0.12
	sp.height = 0.24
	head.mesh = sp
	head.position = Vector3(0, 1.75, 0)
	h.add_child(head)
	main.add_child(h)
	h.global_position = at
	return h


func wall(size: Vector3, at: Vector3) -> StaticBody3D:
	var w := StaticBody3D.new()
	var ws := CollisionShape3D.new()
	var wb := BoxShape3D.new()
	wb.size = size
	ws.shape = wb
	w.add_child(ws)
	main.add_child(w)
	w.global_position = at
	return w


func omni(nm: String, at: Vector3, reach := 5.0) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.name = nm
	l.omni_range = reach
	l.light_energy = 2.0
	main.add_child(l)
	l.global_position = at
	return l


func face(p: Vector3) -> void:
	var d := p - player.global_position
	player.rotation = Vector3(0, atan2(-d.x, -d.z), 0)
	var e := p - eye.global_position
	player.pitch = atan2(e.y, Vector2(e.x, e.z).length())
	eye.rotation = Vector3(player.pitch, 0, 0)


func flick_of(l: Light3D) -> float:
	return float(l.flick) if "flick" in l else float(l.get_meta("hs_flick", 1.0))


## over `t` seconds: each light's lowest flicker, and the most times any of them went from full to dipped in a second
func watch(lights: Array, t: float) -> Dictionary:
	var low := {}
	var falls := {}
	var was := {}
	for l in lights:
		low[l] = 1.0
		falls[l] = 0
		was[l] = flick_of(l)
	for i in int(ceil(t * 60.0)):
		await physics_frame
		for l in lights:
			var f := flick_of(l)
			low[l] = minf(low[l], f)
			if f < 0.9 and float(was[l]) >= 0.9:
				falls[l] += 1
			was[l] = f
	var most := 0.0
	for l in lights:
		most = maxf(most, float(falls[l]) / t)
	return {"low": low, "rate": most}


func _initialize() -> void:
	create_timer(300.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("MIND result " + JSON.stringify({"errors": errors}))
		quit())
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	story = main.get_node("Story")
	torch = player.get_node("Eye/Flashlight") as Light3D
	player.global_position = Vector3(0, 0.02, 0)

	# ---- 1. the light that's on her flickers: the lamps that reach her and your beam; not the moon, not a lamp
	# behind a wall, round a corner, pointed away or marked ambient
	var her := figure("Her", Vector3(0, 0, -5))
	var fl := Node.new()
	fl.name = "FlickerLit"
	fl.set_script(load(S + "flicker_lit.gd"))
	her.add_child(fl)
	var tube := omni("Tube", Vector3(0, 2.4, -5))
	var far := omni("Far", Vector3(20, 2.4, -5))
	wall(Vector3(6, 3, 0.2), Vector3(0, 1.5, -7.5))
	var behind := omni("BehindTheWall", Vector3(0, 1.5, -9))
	var amb := omni("Glow", Vector3(1, 2.0, -5))
	amb.add_to_group("hs_ambient")
	var desk := SpotLight3D.new()
	desk.name = "Desk"
	desk.spot_range = 8.0
	desk.spot_angle = 30.0
	main.add_child(desk)
	desk.global_position = Vector3(3, 1.2, -5)
	desk.look_at(Vector3(0, 1.2, -5))
	var away := SpotLight3D.new()
	away.name = "PointedAway"
	away.spot_range = 8.0
	away.spot_angle = 30.0
	main.add_child(away)
	away.global_position = Vector3(-3, 1.2, -5)
	away.look_at(Vector3(-9, 1.2, -5))
	var moon := DirectionalLight3D.new()
	moon.name = "Moon"
	moon.light_energy = 0.3
	main.add_child(moon)
	var all := [tube, far, behind, amb, desk, away, torch]
	face(her.global_position + Vector3.UP * 1.3)
	torch.visible = true
	await secs(0.4)
	var w1: Dictionary = await watch(all, 4.0)
	var on_her: Array = fl.lit_by.map(func(l): return str(l.name))
	on_her.sort()
	var moon_e := moon.light_energy
	var lows := all.map(func(l): return "%s %.2f" % [l.name, float(w1["low"][l])])
	say("the light on her", "on her: %s; over 4 s each light's lowest: %s; the moon at %.2f; at most %.1f dips a second" % [str(on_her), ", ".join(lows), moon_e, float(w1["rate"])])
	if on_her != ["Desk", "Flashlight", "Tube"]:
		bad("the lights on her should be the tube over her, the desk lamp turned on her and your beam (%s)" % str(on_her))
	for l in [tube, desk, torch]:
		if float(w1["low"][l]) > 0.4:
			bad("%s is on her and never dipped (%.2f)" % [l.name, float(w1["low"][l])])
	for l in [far, behind, amb, away]:
		if float(w1["low"][l]) < 0.999:
			bad("%s isn't on her and flickered (%.2f)" % [l.name, float(w1["low"][l])])
	if float(w1["rate"]) > 3.0 or float(w1["rate"]) < 0.5 or absf(moon_e - 0.3) > 0.001:
		bad("the dips: within three a second, and some (%.1f); the moon left alone (%.2f)" % [float(w1["rate"]), moon_e])
	# your beam off her; her hidden; the boolean off
	face(Vector3(0, 1.3, 5))
	await secs(0.4)
	var w2: Dictionary = await watch([torch, tube], 1.5)
	var beam_off: bool = not fl.lit_by.has(torch) and float(w2["low"][torch]) >= 0.999 and float(w2["low"][tube]) < 0.4
	face(her.global_position + Vector3.UP * 1.3)
	her.visible = false
	await secs(0.4)
	var w3: Dictionary = await watch([torch, tube, desk], 1.5)
	var hidden_ok: bool = fl.lit_by.is_empty() and float(w3["low"][torch]) >= 0.999 and float(w3["low"][tube]) >= 0.999
	her.visible = true
	fl.enabled = false
	await secs(0.4)
	var w4: Dictionary = await watch([torch, tube, desk], 1.5)
	var off_ok: bool = fl.lit_by.is_empty() and float(w4["low"][torch]) >= 0.999 and float(w4["low"][desk]) >= 0.999
	fl.enabled = true
	# dim: it sinks while it's on her and comes back; die: out after a while, and stays out a while once it's off her
	fl.mode = "dim"
	await secs(1.5)
	var dimmed := flick_of(tube)
	her.global_position = Vector3(40, 0, -5)
	await secs(0.5)
	var undimmed := flick_of(tube)
	her.global_position = Vector3(0, 0, -5)
	fl.mode = "die"
	fl.die_after = 1.0
	fl.dead_secs = 1.5
	await secs(0.5)
	var failing := flick_of(tube) > 0.0
	await secs(1.2)
	var died := flick_of(tube)
	var torch_died := flick_of(torch)
	her.global_position = Vector3(40, 0, -5)
	await secs(0.8)
	var still_out := flick_of(tube)
	await secs(1.4)
	var back_on := flick_of(tube)
	say("the light on her, more", "your beam turned away: it's steady and the tube still dips %s; her hidden: nothing flickers %s; the boolean off: nothing %s; dim: the tube at %.2f on her, %.2f once she's gone; die: failing first %s, out after a second (%.2f, your flashlight %.2f), still out 0.8 s after she's gone (%.2f), back after 2.2 (%.2f)" % [
		beam_off, hidden_ok, off_ok, dimmed, undimmed, failing, died, torch_died, still_out, back_on])
	if not beam_off or not hidden_ok or not off_ok:
		bad("the light on her: your beam off her %s, her hidden %s, the boolean off %s" % [beam_off, hidden_ok, off_ok])
	if absf(dimmed - 0.12) > 0.02 or undimmed < 0.999 or not failing or died > 0.001 or torch_died > 0.001 or still_out > 0.001 or back_on < 0.999:
		bad("dim and die (dim %.2f then %.2f; die %.2f, the flashlight %.2f, still out %.2f, back %.2f)" % [dimmed, undimmed, died, torch_died, still_out, back_on])
	fl.queue_free()
	her.global_position = Vector3(40, 0, 40)
	await frames(3)

	# ---- 2. something that isn't where you left it
	var chair := figure("Chair", Vector3(3, 0, -3))
	chair.rotation.y = deg_to_rad(140.0)
	chair.set_script(load(S + "moved.gd"))
	for k in {"what": "face you", "unseen_secs": 0.5, "cooldown": 0.5, "chance": 1.0, "times": 0, "size_m": 1.7}:
		chair.set(k, {"what": "face you", "unseen_secs": 0.5, "cooldown": 0.5, "chance": 1.0, "times": 0, "size_m": 1.7}[k])
	chair.set_process(true)
	var never := figure("NeverLookedAt", Vector3(-6, 0, 6))
	never.set_script(load(S + "moved.gd"))
	for k in {"unseen_secs": 0.3, "cooldown": 0.3, "chance": 1.0}:
		never.set(k, {"unseen_secs": 0.3, "cooldown": 0.3, "chance": 1.0}[k])
	never.set_process(true)
	face(chair.global_position + Vector3.UP)
	var rot0 := chair.global_rotation.y
	await secs(2.0)
	var watched: int = chair.count
	var watched_rot := absf(chair.global_rotation.y - rot0)
	face(Vector3(-3, 1, 3))                              # away from it
	await secs(1.0)
	var c1: int = chair.count
	var to := player.global_position - chair.global_position
	var off_deg := rad_to_deg(absf(wrapf(atan2(-to.x, -to.z) - chair.global_rotation.y, -PI, PI)))
	var never_n: int = never.count
	# its needs; a wall between; too near
	chair.needs = "sanity:uneasy"
	chair.rotation.y = deg_to_rad(140.0)
	face(chair.global_position + Vector3.UP)
	await secs(0.3)
	face(Vector3(-3, 1, 3))
	await secs(1.2)
	var no_need: int = chair.count
	story.flag("sanity:uneasy")
	await secs(0.2)
	face(chair.global_position + Vector3.UP)
	await secs(0.3)
	face(Vector3(-3, 1, 3))
	await secs(1.2)
	var with_need: int = chair.count
	chair.needs = ""
	chair.rotation.y = deg_to_rad(140.0)
	face(chair.global_position + Vector3.UP)
	await secs(0.3)                                      # seen; then a wall comes between: still in your view, not in your sight
	var screen := wall(Vector3(3, 3, 0.2), Vector3(1.5, 1.5, -1.5))
	screen.rotation.y = deg_to_rad(-45.0)
	await secs(1.3)
	var behind_wall: int = chair.count
	screen.queue_free()
	chair.far_m = 30.0
	face(chair.global_position + Vector3.UP)
	await secs(0.3)
	face(Vector3(-3, 1, 3))
	await secs(1.2)
	var too_near: int = chair.count
	# the other kinds
	var doll := figure("Doll", Vector3(-4, 0, -4))
	var m1 := Marker3D.new()
	var m2 := Marker3D.new()
	main.add_child(m1)
	main.add_child(m2)
	m1.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(90.0)), Vector3(-5, 0, -2))
	m2.global_position = Vector3(-2, 0, -6)
	doll.set_script(load(S + "moved.gd"))
	doll.set("what", "next mark")
	doll.set("marks", [doll.get_path_to(m1), doll.get_path_to(m2)] as Array[NodePath])
	for k in {"unseen_secs": 0.3, "cooldown": 0.3, "chance": 1.0, "size_m": 1.7}:
		doll.set(k, {"unseen_secs": 0.3, "cooldown": 0.3, "chance": 1.0, "size_m": 1.7}[k])
	doll.set_process(true)
	face(doll.global_position + Vector3.UP)
	await secs(0.4)
	face(Vector3(5, 1, 5))
	await secs(0.8)
	var at1: bool = doll.global_position.distance_to(m1.global_position) < 0.01 and absf(doll.global_rotation.y - deg_to_rad(90.0)) < 0.01
	face(doll.global_position + Vector3.UP)
	await secs(0.4)
	face(Vector3(5, 1, 5))
	await secs(0.8)
	var at2: bool = doll.global_position.distance_to(m2.global_position) < 0.01
	doll.set("what", "vanish")
	face(doll.global_position + Vector3.UP)
	await secs(0.4)
	face(Vector3(5, 1, 5))
	await secs(0.8)
	var gone: bool = not doll.visible
	say("moved", "watched 2 s: %d changes, turned %.3f; looked away a second: %d, now facing you within %.1f deg; one you never looked at: %d; needing sanity:uneasy: %d, then with it %d; behind a wall in your view: %d; too near for far_m: %d; next mark: at the first %s, then the second %s; vanish: gone %s" % [
		watched, watched_rot, c1, off_deg, never_n, no_need - c1, with_need - no_need, behind_wall - with_need, too_near - behind_wall, at1, at2, gone])
	if watched != 0 or watched_rot > 0.001 or c1 != 1 or off_deg > 2.0 or never_n != 0:
		bad("a thing moves only once seen and only while unseen (watched %d, away %d, %.1f deg off you, never seen %d)" % [watched, c1, off_deg, never_n])
	if no_need != c1 or with_need != no_need + 1 or behind_wall != with_need + 1 or too_near != behind_wall or not at1 or not at2 or not gone:
		bad("moved's rules (needs %d then %d, behind a wall %d, too near %d, marks %s %s, vanish %s)" % [no_need - c1, with_need - no_need, behind_wall - with_need, too_near - behind_wall, at1, at2, gone])
	chair.queue_free()
	never.queue_free()

	# ---- 3. the game's words lying for a moment
	story.unflag("sanity:uneasy")
	story.objective("Find room 304")
	story.add_task("key", "Find the master key")
	story.add_task("out", "Get out")
	story.tick("out")
	story.give("soda", "a soda", null, 1)
	var gl := Node.new()
	gl.set_script(load(S + "gaslight.gd"))
	for k in {"gap_min": 0.6, "gap_max": 0.9, "secs": 0.5}:
		gl.set(k, {"gap_min": 0.6, "gap_max": 0.9, "secs": 0.5}[k])
	main.add_child(gl)
	var told: Array = []
	gl.lied.connect(func(kind: String, words: String) -> void: told.append([kind, words]))
	await secs(2.5)
	var quiet: int = gl.count                             # its needs (sanity:shaken) don't hold
	var k1: String = gl.tell("task")
	var lie: String = story.task_text("key")
	var done_text: String = story.task_text("out")
	await secs(0.7)
	var task_back: String = story.task_text("key")
	var k2: String = gl.tell("objective")
	var scr: String = story.objective_now()
	var same_letters: bool = "".join(Array(scr.split("")).filter(func(c): return c != " ")).length() == "Findroom304".length()
	var sl := Array(scr.split(""))
	sl.sort()
	var ol := Array("Find room 304".split(""))
	ol.sort()
	await secs(0.7)
	var obj_back: String = story.objective_now()
	var k3: String = gl.tell("pickup")
	var pick_line: String = story._line.text
	await secs(0.7)
	var k4: String = gl.tell("line")
	var whisper: String = story._line.text
	await secs(0.7)
	var before := told.size()
	story.flag("sanity:shaken")
	await secs(6.0)
	var own: Array = told.slice(before).map(func(t): return t[0])
	var twice := false
	for i in range(1, own.size()):
		if own[i] == own[i - 1]:
			twice = true
	story.card("A note", "words")
	await secs(0.8)                                      # (one on screen ends; no new one under the card)
	var n_card: int = gl.count
	await secs(3.0)
	var under_card: int = gl.count - n_card
	story.close_card()
	var the_lies: PackedStringArray = gl.lies
	var the_whispers: PackedStringArray = gl.whispers
	gl.queue_free()
	await secs(0.3)
	say("gaslight", "its needs not holding: %d lies in 2.5 s; a task: '%s' read '%s' (the done one still '%s'), then '%s' again; the objective: '%s', the same letters %s, then '%s'; a false pickup: '%s'; a line: '%s'; by itself once you're shaken: %d in 6 s (%s), the same twice running %s; under a card: %d; ticked %s, sodas %d" % [
		quiet, "Find the master key", lie, done_text, task_back, scr, sl == ol and same_letters, obj_back, pick_line, whisper, own.size(), ", ".join(own), twice, under_card, story.done("key"), story.count_of("soda")])
	if quiet != 0 or k1 != "task" or lie == "Find the master key" or not the_lies.has(lie) or done_text != "Get out" or task_back != "Find the master key":
		bad("a task lying for a moment (%d first; '%s' then '%s')" % [quiet, lie, task_back])
	if k2 != "objective" or scr == "Find room 304" or sl != ol or obj_back != "Find room 304" or k3 != "pickup" or pick_line != "Picked up: a soda" or k4 != "line" or not the_whispers.has(whisper):
		bad("the objective, a false pickup, a line ('%s' then '%s'; '%s'; '%s')" % [scr, obj_back, pick_line, whisper])
	if own.size() < 3 or twice or under_card != 0 or story.done("key") or story.count_of("soda") != 1 or story.task_text("key") != "Find the master key" or story.objective_now() != "Find room 304":
		bad("gaslight by itself (%d lies: %s; twice running %s; under a card %d; nothing really changed: ticked %s, sodas %d)" % [own.size(), str(own), twice, under_card, story.done("key"), story.count_of("soda")])

	# ---- 4. phasing out of the world and back (the node: what it wears and when; mind_shots.gd draws it)
	var ghost := figure("Ghost", Vector3(2, 0, -6))
	var body := ghost.get_node("Body") as MeshInstance3D
	var own_mat := body.get_surface_override_material(0)
	var ph := HSPhase.attach(ghost, {"seconds": 0.5})
	var events: Array = []
	ph.phased.connect(func(o: bool) -> void: events.append(o))
	await frames(4)
	ph.phase_out()
	await frames(2)
	var worn: Material = body.get_surface_override_material(0)
	var worn_ok: bool = worn is ShaderMaterial and (worn as ShaderMaterial).shader.resource_path.ends_with("creature_phase.gdshader") and ghost.visible
	var head_worn: bool = (ghost.get_node("Head") as MeshInstance3D).get_surface_override_material(0) is ShaderMaterial
	await secs(0.25)
	var half := float((worn as ShaderMaterial).get_shader_parameter("amount")) if worn is ShaderMaterial else -1.0
	await secs(0.4)
	var out_ok: bool = not ghost.visible and body.get_surface_override_material(0) == own_mat and events == [true] and ph.is_out()
	ph.phase_in()
	await frames(2)
	var in_start: bool = ghost.visible and body.get_surface_override_material(0) is ShaderMaterial and float((body.get_surface_override_material(0) as ShaderMaterial).get_shader_parameter("amount")) > 0.9
	await secs(0.7)
	var in_ok: bool = ghost.visible and body.get_surface_override_material(0) == own_mat and events == [true, false]
	ph.stutter(0.3)
	await frames(2)
	var st_worn: bool = body.get_surface_override_material(0) is ShaderMaterial and float((body.get_surface_override_material(0) as ShaderMaterial).get_shader_parameter("stutter")) > 0.3 \
		and float((body.get_surface_override_material(0) as ShaderMaterial).get_shader_parameter("amount")) == 0.0
	await secs(0.5)
	var st_ok: bool = st_worn and ghost.visible and body.get_surface_override_material(0) == own_mat
	ph.blink(0.3)
	await secs(0.6)
	var mid_blink: bool = not ghost.visible
	await secs(0.9)
	var blink_ok: bool = mid_blink and ghost.visible and ghost.global_position.distance_to(Vector3(2, 0, -6)) < 0.001 and body.get_surface_override_material(0) == own_mat
	var pm := Marker3D.new()
	main.add_child(pm)
	pm.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(90.0)), Vector3(-3, 0, -8))
	ph.phase_to(pm, 0.2)
	await secs(1.6)
	var to_ok: bool = ghost.visible and ghost.global_position.distance_to(pm.global_position) < 0.001 and absf(ghost.global_rotation.y - deg_to_rad(90.0)) < 0.01
	ph.places = [ph.get_path_to(pm), ph.get_path_to(m2)] as Array[NodePath]
	ph.on_fire = "next place"
	ph.away_secs = 0.1
	ph.fire()
	await secs(1.4)
	ph.fire()
	await secs(1.4)
	var places_ok: bool = ghost.global_position.distance_to(m2.global_position) < 0.001
	# a creature skin she wore by a look switch is on her again once she's back
	var sw := HSLookSwitch.new()
	sw.looks = [HSLookPreset.make({"name": "chrome", "skin": "chrome"})] as Array[HSLookPreset]
	ghost.add_child(sw)
	await frames(3)
	sw.set_look("chrome", 0.0)
	await frames(3)
	var chrome_before: bool = HSCreatureSkin.worn(ghost).size() > 0
	ph.on_fire = "blink"
	ph.fire()
	await secs(1.6)
	var skins: Array = HSCreatureSkin.worn(ghost).map(func(m): return str(m.get_meta("hs_creature")))
	say("phasing", "going: everything she has on the phase's shader and still shown %s (her head too %s), half way at %.2f; gone: hidden, her own material back, phased(true) %s; coming: shown and worn from 1 %s, herself again with phased(false) %s; a stutter: torn, none of her gone, herself after %s; a blink: gone then back where she stood %s; phase_to a marker: there and turned its way %s; her places in turn %s; the chrome she wore: worn before %s, after a blink %s" % [
		worn_ok, head_worn, half, out_ok, in_start, in_ok, st_ok, blink_ok, to_ok, places_ok, chrome_before, str(skins)])
	if not worn_ok or not head_worn or half < 0.3 or half > 0.75 or not out_ok or not in_start or not in_ok:
		bad("phasing out and in (worn %s %s, half way %.2f, gone %s, coming %s, back %s, events %s)" % [worn_ok, head_worn, half, out_ok, in_start, in_ok, str(events)])
	if not st_ok or not blink_ok or not to_ok or not places_ok or not chrome_before or skins.is_empty() or skins.any(func(s): return s != "chrome"):
		bad("a stutter %s, a blink %s, phase_to %s, her places %s, her creature skin back %s" % [st_ok, blink_ok, to_ok, places_ok, str(skins)])

	# ---- 5. unease: nothing until sanity slips, all of it at the bottom, a spike that falls away
	var san := Node.new()
	san.set_script(load(S + "sanity.gd"))
	for k in ["drain", "dark_drain", "near_drain", "hunt_drain", "light_rate"]:
		san.set(k, 0.0)
	main.add_child(san)
	var un := HSUnease.new()
	main.add_child(un)
	await frames(5)
	var a_full := float(un.amount)
	var hidden0: bool = not un.rect.visible
	san.set_to(0.35)
	await secs(1.5)
	var a_mid := float(un.amount)
	var shown_mid := float(un.shown)
	san.set_to(0.05)
	await secs(1.5)
	var a_low := float(un.amount)
	san.set_to(1.0)
	await secs(3.5)
	var a_back := float(un.shown)
	un.fire()
	await secs(0.6)
	var spiked := float(un.shown)
	await secs(5.0)
	var fell := float(un.shown)
	say("unease", "sanity full: %.2f and nothing drawn %s; at 0.35: %.2f (drawn %.2f, on layer %d under the tape's 5); at 0.05: %.2f; full again: %.2f; fire(): up to %.2f, then %.2f" % [a_full, hidden0, a_mid, shown_mid, un.layer, a_low, a_back, spiked, fell])
	if a_full != 0.0 or not hidden0 or absf(a_mid - 0.5) > 0.01 or absf(shown_mid - 0.5) > 0.05 or a_low != 1.0 or a_back > 0.01 or spiked < 0.4 or fell > 0.01 or un.layer >= 5 or un.rect.visible:
		bad("unease by sanity (%.2f, %.2f, %.2f, back %.2f; a spike %.2f then %.2f)" % [a_full, a_mid, a_low, a_back, spiked, fell])

	print("MIND result " + JSON.stringify({"errors": errors}))
	quit()
