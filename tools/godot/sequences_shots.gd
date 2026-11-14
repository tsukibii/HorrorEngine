extends SceneTree
## The guide of sequences' pictures of the game (guides/sequences/img): the built scene played through as
## sequences_test.gd plays it, pictured at each recipe's moments, from the player's eye or from a camera beside the
## character. Nothing is drawn between pictures (the render loop is off), so it's as quick as the headless check.
##
##   godot --path <project> --rendering-driver vulkan --resolution 1280x720 --fixed-fps 60 -s sequences_shots.gd -- --out=DIR [--only=a,b]

var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var story: Node
var hud: Node
var cam: Camera3D
var out_dir := ""
var only: Array = []
var made: Array = []


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func shot(name: String) -> void:
	RenderingServer.render_loop_enabled = true
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	made.append(name)
	print("SEQSHOTS pictured " + name)
	RenderingServer.render_loop_enabled = false
	eye.make_current()                                         # (a head that follows "you" follows the camera in use: back to the player's eye between pictures)
	if hud != null:
		hud.visible = true


func put(p: Vector3) -> void:
	player.global_position = p
	player.velocity = Vector3.ZERO


func look(p: Vector3) -> void:
	var d := p - eye.global_position
	player.rotation.y = atan2(-d.x, -d.z)
	player.set("pitch", atan2(d.y, Vector2(d.x, d.z).length()))
	eye.rotation.x = float(player.get("pitch"))


func flat(v: Vector3) -> Vector2:
	return Vector2(v.x, v.z)


func flag(n: String) -> bool:
	return HSNpcCond.holds(n, self, null)


func runner(who: String) -> HSNpcRunner:
	return (main.get_node("%s markers" % who) as HSNpc).runner


func her(who: String) -> Node3D:
	return main.get_node(who) as Node3D


func thing(n: String) -> Node3D:
	return main.get_node("Things/" + n) as Node3D


func marker(who: String, quest: String, nm: String) -> HSNpcMarker:
	return main.get_node("%s markers/%s/%s" % [who, quest, nm]) as HSNpcMarker


func head_of(who: Node3D) -> Vector3:
	var sk := HSNpcBody.skeleton_of(who)
	return sk.global_transform * sk.get_bone_global_pose(sk.find_bone("c_head")).origin


# ---- the views ---------------------------------------------------------------------------------------------------------------
func spect(from: Vector3, at: Vector3, fov := 45.0) -> void:
	cam.global_position = from
	cam.look_at(at, Vector3.UP)
	cam.fov = fov
	cam.make_current()
	if hud != null:
		hud.visible = false                                    # (a picture from beside her isn't the player's view: no HUD on it)


# a camera round a character: `yaw_deg` from in front of them (plus: round to their left), `dist` away, `h` up, looking `look_h` up them
func see(who: Node3D, yaw_deg: float, dist: float, h: float, look_h: float, fov := 42.0) -> void:
	var y := who.global_rotation.y + deg_to_rad(yaw_deg)
	spect(who.global_position + Vector3(sin(y), 0, cos(y)) * dist + Vector3(0, h, 0), who.global_position + Vector3(0, look_h, 0), fov)


func eye_view(at = null) -> void:
	if at is Vector3:
		look(at)
	eye.make_current()
	if hud != null:
		hud.visible = true


# so `n` frames after `cond` was first so
func after(cond: Callable, n: int) -> Callable:
	var c := [0]
	return func() -> bool:
		if c[0] > 0 or cond.call():
			c[0] += 1
		return c[0] > n


# each frame the first of the moments whose `when` is so is pictured (its `view` first); until `done` or `t` seconds
func moments(list: Array, done: Callable, t: float) -> void:
	var pending := list.duplicate()
	for i in int(ceil(t * 60.0)):
		for m in pending:
			if (m["when"] as Callable).call():
				pending.erase(m)
				if m.has("view"):
					(m["view"] as Callable).call()
				await shot(String(m["name"]))
				break
		if done.call():
			break
		await physics_frame
	for m in pending:
		print("SEQSHOTS missed " + String(m["name"]))


func wait_for(cond: Callable, t: float) -> bool:
	for i in int(ceil(t * 60.0)):
		if cond.call():
			return true
		await physics_frame
	return cond.call()


func box() -> HSNpcTalkBox:
	return HSNpcTalkBox.of(root.get_tree())


# E, and her lines hurried on to the last (with its answers, when it has them): the conversation left open
func ask() -> void:
	player.call("use")
	await frames(3)
	var b := box()
	for i in 10:
		if not b.open_now or b.stage != "lines":
			break
		var before := String(b.showing()["text"])
		b.advance()
		await frames(3)
		if not b.open_now:
			break
		if b.stage == "answers" or String(b.showing()["text"]) == before:
			break
		if b.lines().size() > 0 and String(b.showing()["text"]) == String(b.lines()[b.lines().size() - 1]).get_slice(": ", 1):
			break


# the answer picked (-1: none to pick), and the rest hurried through
func finish(answer := -1) -> void:
	var b := box()
	if b.open_now and b.stage == "answers" and answer >= 0:
		if hud != null and hud.has_method("choice_pick") and not bool(hud.get("choice_over")):
			hud.choice_pick(answer + 1)
		else:
			b.select(answer)
		await frames(4)
	for i in 12:
		if not b.open_now:
			break
		b.advance()
		await frames(3)


func wants(stage: String) -> bool:
	return only.is_empty() or stage in only


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--only="):
			only = Array(a.substr(7).split(",", false))
	DirAccess.make_dir_recursive_absolute(out_dir)
	create_timer(3000.0).timeout.connect(func() -> void:
		print("SEQSHOTS never ended")
		quit())
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	cam = Camera3D.new()
	cam.near = 0.05
	root.add_child(cam)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	story = main.get_node("Story")
	hud = main.get_node_or_null("Hud")
	look(Vector3(0.6, 1.0, -1.9))
	RenderingServer.render_loop_enabled = false
	if wants("evening") or wants("tidy") or wants("apple") or wants("key"):
		await flat_shots()
	if wants("apple") or wants("key"):
		await apple_shots()
	if wants("key"):
		await key_shots()
	if wants("customer") or wants("last"):
		await customer_shots()
	if wants("last"):
		await last_shots()
	if wants("corner") or wants("cellar"):
		await corner_shots()
	if wants("cellar"):
		await cellar_shots()
	print("SEQSHOTS %d pictures" % made.size())
	RenderingServer.render_loop_enabled = true
	quit()


func flat_shots() -> void:
	var mio := runner("Mio")
	var aya := runner("Aya")
	var mug := thing("Mug")
	var book := thing("Book")
	var mg: Node = mio.body.gesture()
	var q := "An evening in"
	var m_walk2 := marker("Mio", q, "Walk2")
	var a_pick := marker("Aya", "Tidying up", "Pick up")
	var a_put := marker("Aya", "Tidying up", "Put down")
	var a_talk := marker("Aya", "Tidying up", "Talk")
	await moments([
		{"name": "evening_1_pick", "when": after(func() -> bool: return is_instance_valid(mio.body.held) and mio.body.held == mug, 5),
			"view": func() -> void: spect(Vector3(-2.3, 1.4, -2.55), Vector3(-3.05, 0.95, -1.0), 42.0)},
		{"name": "evening_2_carry", "when": after(func() -> bool: return mio.cur == m_walk2 and mio.body.now == "walk", 75),
			"view": func() -> void: see(her("Mio"), 22.0, 2.4, 1.25, 1.05, 40.0)},
		{"name": "evening_3_look", "when": func() -> bool: return mg != null and String(mg.now) == "life_look_hand" and float(mg.t) > 1.35,
			"view": func() -> void: spect(Vector3(1.95, 1.05, -0.15), Vector3(0.6, 0.85, -2.25), 38.0)},
		{"name": "tidy_1_floor", "when": after(func() -> bool: return aya.cur == a_pick and is_instance_valid(aya.body.held) and aya.body.held == book, 2),
			"view": func() -> void: spect(Vector3(1.95, 0.8, 1.6), Vector3(2.1, 0.5, -0.3), 45.0)},
		{"name": "tidy_2_shelf", "when": func() -> bool: return aya.cur == a_put and aya.body.now == "reach_high" and not is_instance_valid(aya.body.held),
			"view": func() -> void: spect(Vector3(2.15, 1.5, 0.15), Vector3(3.45, 1.3, -1.8), 42.0)},
	], func() -> bool: return flag("mio_settled") and aya.cur == a_talk and aya.phase == "stay", 100.0)
	put(Vector3(1.3, 0.05, 1.3))
	look(Vector3(2.6, 1.42, 1.3))
	await frames(10)
	await ask()
	await frames(70)                                           # (her line eased in, her head on you)
	eye_view()
	if wants("tidy"):
		await shot("tidy_3_talk")
	await finish()
	await wait_for(func() -> bool: return story.has_task("apple"), 6.0)


func apple_shots() -> void:
	var aya := runner("Aya")
	var apple := thing("Apple")
	put(Vector3(-2.3, 0.05, 0.05))
	look(apple.global_position)
	await frames(8)
	player.call("use")
	await frames(4)
	put(Vector3(1.3, 0.05, 1.3))
	look(Vector3(2.6, 1.2, 1.3))
	await moments([
		{"name": "apple_1_take", "when": after(func() -> bool: return is_instance_valid(aya.body.held), 4), "view": func() -> void: eye_view(Vector3(2.5, 1.2, 1.3))},
		{"name": "apple_2_eat", "when": func() -> bool: return aya.body.now == "eat" and is_instance_valid(aya.body.held) and aya.body.held.global_position.distance_to(head_of(her("Aya"))) < 0.15,
			"view": func() -> void: eye_view(Vector3(2.6, 1.4, 1.3))},
	], func() -> bool: return flag("aya_fed"), 45.0)


func key_shots() -> void:
	var aya := runner("Aya")
	var key := thing("CellarKey")
	var give := marker("Aya", "The cellar key", "Hand to you")
	look(Vector3(2.6, 1.2, 1.3))
	await moments([
		{"name": "key_1_hook", "when": after(func() -> bool: return is_instance_valid(aya.body.held) and aya.body.held == key, 3),
			"view": func() -> void: spect(Vector3(2.45, 1.4, 2.8), Vector3(3.75, 1.0, 2.0), 46.0)},
		{"name": "key_2_hand", "when": after(func() -> bool: return aya.cur == give and aya.body.now == "reach_mid", 40),
			"view": func() -> void: eye_view(her("Aya").global_position + Vector3(0, 1.2, 0))},
	], func() -> bool: return story.has("cellar_key") and aya.at != null and aya.at.name == "Wait2" and not aya.body.busy, 70.0)


func customer_shots() -> void:
	var ken := runner("Ken")
	var man := her("Ken")
	put(Vector3(-2.2, 0.05, 4.3))
	look(Vector3(-2.2, 1.0, 3.4))
	var q := "A can of soda"
	var k_talk := marker("Ken", q, "Talk")
	await wait_for(func() -> bool: return ken.cur == k_talk and ken.phase == "stay", 50.0)
	put(Vector3(-1.7, 0.05, 4.4))
	look(Vector3(-1.4, 1.5, 5.95))
	await frames(12)
	await ask()
	await frames(70)
	eye_view()
	if wants("customer"):
		await shot("customer_1_ask")
	await finish(0)
	await frames(60)
	put(Vector3(-2.5, 0.05, 4.3))
	look(thing("Soda2").global_position)
	await frames(8)
	player.call("use")
	await frames(4)
	put(Vector3(-1.7, 0.05, 4.4))
	look(Vector3(-1.4, 1.3, 5.95))
	var give := main.get_node("Ken markers/%s/Choice/Served/Hand to you" % q) as HSNpcMarker
	var g: Node = ken.body.gesture()
	var list := [
		{"name": "customer_2_pay", "when": after(func() -> bool: return ken.cur == give and ken.body.now == "reach_mid", 42), "view": func() -> void: eye_view(Vector3(-1.4, 1.2, 5.9))},
		{"name": "customer_3_take", "when": after(func() -> bool: return is_instance_valid(ken.body.held), 5), "view": func() -> void: eye_view(Vector3(-1.4, 1.2, 5.9))},
		{"name": "customer_4_leave", "when": func() -> bool: return g != null and String(g.now).begins_with("life_look_hand") and float(g.t) > 1.2 and ken.body.now == "walk",
			"view": func() -> void: see(man, 24.0, 2.3, 1.3, 1.15, 40.0)},
	]
	await moments(list if wants("customer") else [], func() -> bool: return flag("ken_gone"), 70.0)


func last_shots() -> void:
	var rin := runner("Rin")
	var she := her("Rin")
	put(Vector3(-2.5, 0.05, 4.3))
	var shelf := Vector3(-2.5, 1.0, 3.4)
	look(shelf)
	var r_wait := marker("Rin", "The last customer", "Wait")
	await wait_for(func() -> bool: return rin.at == r_wait and not rin.body.busy and flat(she.global_position).distance_to(Vector2(-1.4, 5.95)) < 0.1, 70.0)
	look(Vector3(-1.4, 1.45, 5.95))
	await frames(60)
	eye_view()
	await shot("last_1_till")
	look(shelf)
	await wait_for(func() -> bool: return flat(she.global_position).distance_to(Vector2(0.75, 5.2)) < 0.1, 9.0)
	look(Vector3(0.75, 1.45, 5.2))
	await frames(40)
	await shot("last_2_end")
	await frames(60)
	look(shelf)
	await wait_for(func() -> bool: return flat(she.global_position).distance_to(Vector2(-0.1, 4.3)) < 0.1, 9.0)
	look(Vector3(-0.1, 1.45, 4.3))
	await frames(40)
	await shot("last_3_behind")
	await frames(60)
	look(shelf)
	await wait_for(func() -> bool: return she.visible and rin.body.now.begins_with("scare"), 9.0)
	for i in 21:                                                   # (turned to her as she comes: the lunge's reach is at 0.38 s)
		look(head_of(she))
		await physics_frame
	await shot("last_4_scare")
	await wait_for(func() -> bool: return flag("rin_gone"), 8.0)


func corner_shots() -> void:
	var it := runner("It")
	var c := her("It")
	put(Vector3(5.3, 0.05, 0.45))
	look(Vector3(10.0, 1.5, 1.2))
	var q := "Round the corner"
	var peek := marker("It", q, "Peek")
	await moments([
		{"name": "corner_1_peek", "when": after(func() -> bool: return it.at == peek and it.body.posture == "peeking", 30),
			"view": func() -> void: spect(eye.global_position, Vector3(10.0, 1.45, 1.25), 30.0)},
	] if wants("corner") else [], func() -> bool: return it.body.hidden and it.at != null and it.at.name == "Disappear", 45.0)
	await wait_for(func() -> bool: return it.body.hidden, 30.0)
	put(Vector3(11.0, 0.05, 0.6))
	look(Vector3(11.0, 1.2, 6.0))
	await wait_for(func() -> bool: return c.visible and flat(c.global_position).distance_to(Vector2(9.3, 0.45)) < 0.1, 8.0)
	await frames(50)
	if wants("corner"):
		spect(Vector3(11.75, 1.8, 0.95), Vector3(9.3, 1.2, 0.45), 55.0)
		await shot("corner_2_behind")
	look(Vector3(9.3, 1.5, 0.45))
	await wait_for(func() -> bool: return c.visible and it.body.now.begins_with("scare"), 6.0)
	for i in 21:
		look(head_of(c))
		await physics_frame
	if wants("corner"):
		await shot("corner_3_scare")
	await wait_for(func() -> bool: return flag("corridor_done"), 10.0)


func cellar_shots() -> void:
	var it := runner("It")
	var c := her("It")
	put(Vector3(11.0, 0.05, 6.9))
	look(Vector3(11.0, 1.1, 7.95))
	await frames(10)
	if not story.has("cellar_key"):
		story.give("cellar_key", "Cellar key")
	player.call("use")
	await frames(6)
	var hit := [false]
	(main.get_node("It markers") as HSNpc).struck.connect(func(_t: Node, _k: String) -> void: hit[0] = true)
	var turn := [false]
	var each := func() -> bool:
		if it.body.now == "creep" or it.body.now == "punch":       # (you've heard it: you turn round)
			turn[0] = true
		if turn[0] and c.visible:
			look(head_of(c))
		return false
	await moments([
		{"name": "cellar_0_turn", "when": each},
		{"name": "cellar_1_crawl", "when": after(func() -> bool: return it.body.now == "crawl", 80),
			"view": func() -> void: spect(Vector3(11.6, 0.6, 6.7), c.global_position + Vector3(0, 0.45, 0), 50.0)},
		{"name": "cellar_2_creep", "when": after(func() -> bool: return it.body.now == "creep", 45),
			"view": func() -> void: spect(Vector3(11.65, 1.3, 7.4), c.global_position + Vector3(0, 1.15, 0), 50.0)},
		{"name": "cellar_3_blow", "when": func() -> bool: return hit[0], "view": func() -> void: eye.make_current()},
	], func() -> bool: return flag("it_done"), 95.0)
