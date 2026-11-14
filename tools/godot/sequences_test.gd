extends SceneTree
## SEQUENCES: the guide of sequences' scene (res://main.tscn, built by sequences_build.gd) played as a player would
## play it, a recipe at a time, each measured. `-- --only=evening,customer` plays only those (a recipe that needs
## what an earlier one leaves is given it).
##
##   godot --headless --path <project> --fixed-fps 60 -s sequences_test.gd        -> "SEQUENCES result {...}"

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var story: Node
var hud: Node
var only: Array = []


func say(what: String, how: String = "") -> void:
	print("SEQUENCES " + what + ((" " + how) if how != "" else ""))


func bad(e: String) -> void:
	errors.append(e)


func ok(cond: bool, what: String, how: String = "") -> void:
	if cond:
		say(what, how)
	else:
		bad(what + ((": " + how) if how != "" else ""))


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 60.0)))


func watch(cond: Callable, t: float, each: Callable = Callable()) -> bool:
	for i in int(ceil(t * 60.0)):
		if each.is_valid():
			each.call()
		if cond.call():
			return true
		await physics_frame
	return cond.call()


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


func yaw_of(n: Node3D) -> float:
	var f := n.global_basis.z
	return rad_to_deg(atan2(f.x, f.z))


func ang(a: float, b: float) -> float:
	return absf(rad_to_deg(angle_difference(deg_to_rad(a), deg_to_rad(b))))


func now() -> float:
	return Engine.get_physics_frames() / 60.0


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


func bone(who: Node3D, nm: String) -> Vector3:
	var sk := HSNpcBody.skeleton_of(who)
	return sk.global_transform * sk.get_bone_global_pose(sk.find_bone(nm)).origin


# a bone as it is after the modifiers (a skeleton rolls them back after each frame)
func probe(who: Node3D, nm: String) -> BoneAttachment3D:
	var sk := HSNpcBody.skeleton_of(who)
	var a := sk.get_node_or_null("Probe_" + nm) as BoneAttachment3D
	if a == null:
		a = BoneAttachment3D.new()
		a.name = "Probe_" + nm
		sk.add_child(a)
		a.bone_name = nm
	return a


# she's at a marker and done with getting there (one that stays "until the next can start" is done at once: the runner
# is already at the next one's Starts when)
func rests_at(run: HSNpcRunner, m: Node) -> bool:
	return run.at == m and not run.body.busy


# what a runner did, marker by marker: {marker: {first, last, postures, nows}} filled by `each`
func tracker(run: HSNpcRunner) -> Dictionary:
	var t := {"at": {}, "each": Callable()}
	t["each"] = func() -> void:
		var c: Node = run.at                                       # (the marker she's at: the last one started, also while the next one waits for its Starts when)
		if c == null or not is_instance_valid(c):
			return
		if not (t["at"] as Dictionary).has(c):
			t["at"][c] = {"first": now(), "last": now(), "postures": {}, "nows": {}}
		var e: Dictionary = t["at"][c]
		e["last"] = now()
		e["postures"][run.body.posture] = true
		e["nows"][run.body.now] = true
	return t


func took(t: Dictionary, m: Node) -> float:
	return float(t["at"][m]["last"]) - float(t["at"][m]["first"]) if (t["at"] as Dictionary).has(m) else 0.0


func seen_at(t: Dictionary, m: Node, what: String, key := "nows") -> bool:
	return (t["at"] as Dictionary).has(m) and (t["at"][m][key] as Dictionary).has(what)


func box() -> HSNpcTalkBox:
	return HSNpcTalkBox.of(root.get_tree())


# E on whoever you're aimed at, her lines hurried through, the answer picked (-1: it has none). -> it was a conversation
func talk(answer := -1) -> bool:
	var hit: Node = player.call("use")
	await frames(3)
	var b := box()
	if hit == null or not b.open_now:
		return false
	for i in 12:
		if b.stage != "lines" or not b.open_now:
			break
		b.advance()
		await frames(3)
		if b.stage == "answers" and answer >= 0:
			break
	if b.stage == "answers" and answer >= 0:
		if hud != null and hud.has_method("choice_pick") and not bool(hud.get("choice_over")):
			hud.choice_pick(answer + 1)                         # (the HUD's own: the k-th answer, counted from 1)
		else:
			b.select(answer)
			var ev := InputEventKey.new()
			ev.physical_keycode = KEY_ENTER
			ev.keycode = KEY_ENTER
			ev.pressed = true
			b._opened = 0
			b._input(ev)
		await frames(4)
	for i in 12:
		if not b.open_now:
			break
		b.advance()
		await frames(3)
	return true


func wants(stage: String) -> bool:
	return only.is_empty() or stage in only


func _initialize() -> void:
	create_timer(1500.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("SEQUENCES result " + JSON.stringify({"errors": errors}))
		quit())
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = Array(a.substr(7).split(",", false))
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	story = main.get_node("Story")
	hud = main.get_node_or_null("Hud")
	look(Vector3(0.6, 1.0, -1.9))
	var checks := {"evening": false}
	if wants("evening") or wants("tidy"):
		await stage_flat()                                         # (Mio's evening and Aya's tidying happen at once, as they do in the game)
	for st in [["apple", stage_apple], ["key", stage_key], ["customer", stage_customer], ["last", stage_last], ["corner", stage_corner], ["cellar", stage_cellar]]:
		if wants(st[0]):
			await (st[1] as Callable).call()
	print("SEQUENCES result " + JSON.stringify({"errors": errors}))
	quit()


# ---- 1 and 2: a mug, the sofa, a look at it; tidying up, then asking you for something --------------------------------------------
func stage_flat() -> void:
	var mio := runner("Mio")
	var aya := runner("Aya")
	var mug := thing("Mug")
	var book := thing("Book")
	var mg: Node = mio.body.gesture()
	var ag: Node = aya.body.gesture()
	ok(mg != null and ag != null, "the flat: both characters have the Look plugin's layer for small movements")
	if mg == null or ag == null:
		return
	var m_began: Array = []
	mg.started.connect(func(n: String) -> void: m_began.append([n, mio.body.report()["doing"], mio.cur]))
	var a_began: Array = []
	ag.started.connect(func(n: String) -> void: a_began.append([n, aya.body.report()["doing"], aya.cur]))
	var mt := tracker(mio)
	var at := tracker(aya)
	var q := "An evening in"
	var m_pick := marker("Mio", q, "Pick up")
	var m_walk2 := marker("Mio", q, "Walk2")
	var m_sit := marker("Mio", q, "Sit")
	var m_look := marker("Mio", q, "Looks at her hand")
	var m_wait := marker("Mio", q, "Wait")
	var m_sigh := marker("Mio", q, "Sighs")
	var tip := [0.0]                                               # the mug's lean while she walks with it and sits (degrees from upright)
	var carried := {}
	var each := func() -> void:
		(mt["each"] as Callable).call()
		(at["each"] as Callable).call()
		if mio.cur == m_walk2 and mio.phase == "run" and mio.body.now == "walk" and took(mt, m_walk2) > 1.2:
			tip[0] = maxf(tip[0], rad_to_deg(mug.global_basis.y.angle_to(Vector3.UP)))
			carried[String(mio.body.report()["carried"])] = true
	var a_talk := marker("Aya", "Tidying up", "Talk")
	await watch(func() -> bool: return flag("mio_settled") and aya.cur == a_talk and aya.phase == "stay", 90.0, each)
	# Mio
	var pel := bone(her("Mio"), "root")
	ok(is_instance_valid(mio.body.held) and mio.body.held == mug and seen_at(mt, m_pick, "reach_mid"), "1: she takes the mug off the table and keeps it", "held: %s" % (mio.body.held.name if is_instance_valid(mio.body.held) else "nothing"))
	ok(carried.has("front") and tip[0] < 12.0, "1: walking to the sofa she carries it in front of her, upright (its grip says so)", "carried %s, at most %.1f degrees off upright" % [carried.keys(), tip[0]])
	ok(mio.body.posture == "sitting" and pel.y > 0.38 and pel.y < 0.68 and flat(pel).distance_to(Vector2(0.6, -2.2)) < 0.45, "1: she sits on the sofa where its pin is",
		"her pelvis %.2f m up, %.2f m from the middle of her seat" % [pel.y, flat(pel).distance_to(Vector2(0.6, -2.2))])
	var looks := m_began.filter(func(b: Array) -> bool: return b[2] == m_look)
	ok(looks.size() == 1 and String(looks[0][0]) == "life_look_hand" and looks[0][1] == "sit" and took(mt, m_look) > 1.0, "1: sat, she looks at the mug in her hand, and the next marker waits for it",
		"%s over '%s', %.1f s" % [looks.map(func(b: Array) -> String: return String(b[0])), looks[0][1] if not looks.is_empty() else "", took(mt, m_look)])
	var sighs := m_began.filter(func(b: Array) -> bool: return b[2] == m_sigh and String(b[0]).begins_with("life_sigh"))
	var sat_all := true
	for m in [m_look, m_wait, m_sigh]:
		sat_all = sat_all and (mt["at"] as Dictionary).has(m) and (mt["at"][m]["postures"] as Dictionary).keys() == ["sitting"]
	ok(sat_all and sighs.size() == 1 and took(mt, m_wait) > 3.8 and flag("mio_settled"), "1: she stays sat through the look, the Wait and a sigh", "the Wait took %.1f s" % took(mt, m_wait))
	# Aya
	var a_pick := marker("Aya", "Tidying up", "Pick up")
	var a_put := marker("Aya", "Tidying up", "Put down")
	var a_rub := marker("Aya", "Tidying up", "Rubs her hands")
	ok(seen_at(at, a_pick, "reach_low") and seen_at(at, a_put, "reach_high"), "2: the book comes off the floor with her low reach and goes onto the shelf with her high one",
		"%s, then %s" % [(at["at"][a_pick]["nows"] as Dictionary).keys() if (at["at"] as Dictionary).has(a_pick) else [], (at["at"][a_put]["nows"] as Dictionary).keys() if (at["at"] as Dictionary).has(a_put) else []])
	ok(book.global_position.distance_to(Vector3(3.62, 1.435, -1.8)) < 0.06 and not is_instance_valid(aya.body.held), "2: and it's on the shelf where the Put down's pin is",
		"%.1f cm from the pin" % (book.global_position.distance_to(Vector3(3.62, 1.435, -1.8)) * 100.0))
	var rubs := a_began.filter(func(b: Array) -> bool: return b[2] == a_rub)
	ok(rubs.size() == 1 and String(rubs[0][0]) == "life_rub_hands" and rubs[0][1] == "stand", "2: then she rubs her hands together, stood where she is", str(rubs.map(func(b: Array) -> String: return String(b[0]))))
	ok(aya.can_talk() and flat(her("Aya").global_position).distance_to(Vector2(2.6, 1.3)) < 0.1, "2: back at her spot, she waits to be talked to")
	put(Vector3(1.3, 0.05, 1.3))
	look(Vector3(2.6, 1.25, 1.3))
	await frames(8)
	var talked: bool = await talk()
	await watch(func() -> bool: return story.has_task("apple"), 6.0)
	ok(talked and story.has_task("apple") and not story.done("apple") and bool((aya.snapshot()["head"] as Dictionary).get("on", false)),
		"2: E on her: she asks for the apple, the task is on your list, and her head follows you from here", "tasks: apple %s" % story.has_task("apple"))


# ---- 3: you give her the apple and she eats it ----------------------------------------------------------------------------------
func stage_apple() -> void:
	var aya := runner("Aya")
	var apple := thing("Apple")
	put(Vector3(-2.3, 0.05, 0.05))
	look(apple.global_position)
	await frames(8)
	var hit: Node = player.call("use")
	await frames(4)
	ok(hit == apple and story.has("apple") and not apple.visible, "3: E on the apple (a Pickup): it's in your pocket", "you carry: %s" % str((story.get("items") as Dictionary).keys()))
	ok(aya.cur == null or String(aya.cur.get_parent().name) != "The apple", "3: across the room, nothing of hers has started")
	put(Vector3(1.3, 0.05, 1.3))
	look(Vector3(2.6, 1.25, 1.3))
	var wrist := probe(her("Aya"), "r_wrist")
	var shoulder := probe(her("Aya"), "r_uparm")
	var head := probe(her("Aya"), "c_head")
	var out := [0.0, 0.0, 99.0]                                     # as it changes hands: her wrist ahead of her shoulder, its height, how far she's turned from you
	var mouth := [9.0]
	var held := {}
	var t := tracker(aya)
	var each := func() -> void:
		(t["each"] as Callable).call()
		var hd: Node3D = aya.body.held
		if is_instance_valid(hd):
			held[String(hd.name)] = true
			if out[0] == 0.0:
				out[0] = (her("Aya").global_basis.inverse() * (wrist.global_position - shoulder.global_position)).z
				out[1] = wrist.global_position.y
				var d := player.global_position - her("Aya").global_position
				out[2] = ang(yaw_of(her("Aya")), rad_to_deg(atan2(d.x, d.z)))
			mouth[0] = minf(mouth[0], hd.global_position.distance_to(head.global_position))
	await watch(func() -> bool: return flag("aya_fed"), 40.0, each)
	ok(not story.has("apple") and held.has("Apple"), "3: near her with it, she takes it: out of your pocket, into her hand", "in her hand: %s" % str(held.keys()))
	ok(out[0] > 0.18 and out[1] > 0.75 and out[1] < 1.35 and out[2] < 12.0, "3: turned to you, her hand held out for it",
		"her wrist %.0f cm ahead of her shoulder, %.2f m up; %.0f degrees off facing you" % [out[0] * 100.0, out[1], out[2]])
	ok(mouth[0] < 0.24 and not is_instance_valid(aya.body.held) and story.done("apple") and flag("aya_fed"), "3: she eats it where she stands, it's gone, the task is ticked and the flag aya_fed is on",
		"the apple %.0f cm from her head at the nearest" % (mouth[0] * 100.0))


# ---- 4: she fetches a key and hands it to you -------------------------------------------------------------------------------------
func stage_key() -> void:
	var aya := runner("Aya")
	var key := thing("CellarKey")
	if not flag("aya_fed"):
		story.set_flag("aya_fed", true)
	put(Vector3(1.3, 0.05, 1.3))
	look(Vector3(2.6, 1.25, 1.3))
	var t := tracker(aya)
	var cash0 := float(story.get("cash"))
	var had_key := [false]
	var each := func() -> void:
		(t["each"] as Callable).call()
		if is_instance_valid(aya.body.held) and aya.body.held == key:
			had_key[0] = true
	await watch(func() -> bool: return story.has("cellar_key"), 60.0, each)
	var d := player.global_position - her("Aya").global_position
	ok(had_key[0] and story.has("cellar_key") and String((story.get("names") as Dictionary).get("cellar_key", "")) == "Cellar key" and not key.visible,
		"4: she takes the key off its hook, comes to you and hands it over: it's in your pocket as 'Cellar key'", "you carry: %s" % str((story.get("items") as Dictionary).keys()))
	ok(flat(d).length() < 1.35 and flat(d).length() > 0.7 and ang(yaw_of(her("Aya")), rad_to_deg(atan2(d.x, d.z))) < 12.0 and is_equal_approx(float(story.get("cash")), cash0),
		"4: stood a step from you, turned to you; no money with it", "%.2f m from you" % flat(d).length())
	await watch(func() -> bool: return story.has_task("cellar") and aya.at != null and aya.at.name == "Wait2" and not aya.body.busy, 30.0, t["each"])
	ok(story.has_task("cellar") and flat(her("Aya").global_position).distance_to(Vector2(2.6, 1.3)) < 0.1 and not is_instance_valid(aya.body.held),
		"4: the cellar task is on your list and she's back at her spot, her hand empty")


# ---- 5: a customer at the till ------------------------------------------------------------------------------------------------------
func stage_customer() -> void:
	var ken := runner("Ken")
	var man := her("Ken")
	ok(not man.visible, "5: before you're behind the counter, the customer isn't there")
	put(Vector3(-2.2, 0.05, 4.3))
	look(Vector3(-2.2, 1.0, 3.4))
	await frames(12)
	ok(flag("behind_counter"), "5: stepping behind the counter sets the area's flag")
	var t := tracker(ken)
	var q := "A can of soda"
	var k_talk := marker("Ken", q, "Talk")
	await watch(func() -> bool: return ken.cur == k_talk and ken.phase == "stay", 45.0, t["each"])
	ok(man.visible and flat(man.global_position).distance_to(Vector2(-1.4, 5.95)) < 0.1 and ang(yaw_of(man), 180.0) < 3.0 and bool((ken.snapshot()["head"] as Dictionary).get("on", false)),
		"5: he comes in off the street to the till, facing the counter, his head following you", "%.2f m from the till's spot" % flat(man.global_position).distance_to(Vector2(-1.4, 5.95)))
	look(Vector3(-1.4, 1.3, 5.95))
	await frames(10)
	var talked: bool = await talk(0)
	await frames(10)
	ok(talked and flag("soda_yes") and not flag("soda_no"), "5: E on him: he asks for a can of soda; 'Coming up' sets its flag")
	var cash0 := float(story.get("cash"))
	await secs(2.0)
	ok(is_equal_approx(float(story.get("cash")), cash0) and man.visible and ken.waiting_for != "" or ken.phase == "gate", "5: he waits at the till until you have one", "waiting for: %s" % ken.waiting_for)
	put(Vector3(-2.5, 0.05, 4.3))
	look(thing("Soda2").global_position)
	await frames(8)
	var hit: Node = player.call("use")
	await frames(4)
	ok(hit == thing("Soda2") and story.has("soda"), "5: a can off the shelf behind you (a Pickup)")
	put(Vector3(-1.4, 0.05, 4.45))
	look(Vector3(-1.4, 1.3, 5.95))
	var g: Node = ken.body.gesture()
	var began: Array = []
	if g != null:
		g.started.connect(func(n: String) -> void: began.append([n, ken.body.report()["doing"], ken.cur]))
	var held := {}
	var each := func() -> void:
		(t["each"] as Callable).call()
		if is_instance_valid(ken.body.held):
			held[String(ken.body.held.name)] = true
	await watch(func() -> bool: return flag("ken_gone"), 60.0, each)
	ok(absf(float(story.get("cash")) - cash0 - 1.5) < 0.001 and not story.has("soda") and held.has("Soda"), "5: back at the counter with it: he pays, then takes it", "cash +%.2f, in his hand: %s" % [float(story.get("cash")) - cash0, held.keys()])
	var looks := began.filter(func(b: Array) -> bool: return String(b[0]).begins_with("life_look_hand") and b[1] == "walk")
	ok(looks.size() >= 1, "5: on his way out he looks at the can in his hand, without stopping", str(began.map(func(b: Array) -> String: return "%s over %s" % [b[0], b[1]])))
	ok(flag("ken_gone") and not man.visible and man.process_mode == Node.PROCESS_MODE_DISABLED, "5: out of the door, he's hidden and switched off, and the flag ken_gone is on")


# ---- 6: the last customer, nearer each time you look away ------------------------------------------------------------------------
func stage_last() -> void:
	var rin := runner("Rin")
	var she := her("Rin")
	if not flag("ken_gone"):
		story.set_flag("ken_gone", true)
	put(Vector3(-2.5, 0.05, 4.3))
	var shelf := Vector3(-2.5, 1.0, 3.4)
	look(shelf)
	var q := "The last customer"
	var r_talk := marker("Rin", q, "Wait")
	var jumps: Array = []                                           # every time she's somewhere else from one frame to the next: [how far, you could see her or where she went]
	var last := [she.global_position, she.visible]
	var each := func() -> void:
		if she.visible and bool(last[1]) and she.global_position.distance_to(last[0]) > 0.4:
			jumps.append([she.global_position.distance_to(last[0]), rin.seen() or rin.spot_seen(she.global_position)])
		last[0] = she.global_position
		last[1] = she.visible
	await watch(func() -> bool: return rests_at(rin, r_talk) and flat(she.global_position).distance_to(Vector2(-1.4, 5.95)) < 0.1, 60.0, each)
	look(Vector3(-1.4, 1.4, 5.95))                                 # (at once: from here she moves whenever you aren't looking)
	ok(she.visible and flat(she.global_position).distance_to(Vector2(-1.4, 5.95)) < 0.1 and ang(yaw_of(she), 180.0) < 4.0 and float((rin.snapshot()["head"] as Dictionary).get("range", 0.0)) > 200.0,
		"6: she walks in slowly and stops at the till facing the counter, her head following you through 220 degrees", "turned %.0f degrees from the counter" % ang(yaw_of(she), 180.0))
	look(Vector3(-1.4, 1.4, 5.95))
	await watch(func() -> bool: return false, 3.5, each)
	ok(flat(she.global_position).distance_to(Vector2(-1.4, 5.95)) < 0.1, "6: while you look at her she doesn't move", "3.5 s watched")
	look(shelf)
	await watch(func() -> bool: return flat(she.global_position).distance_to(Vector2(0.75, 5.2)) < 0.1, 8.0, each)
	ok(flat(she.global_position).distance_to(Vector2(0.75, 5.2)) < 0.1, "6: you turn to the shelf: she's at the end of the counter")
	look(Vector3(0.75, 1.4, 5.2))
	await watch(func() -> bool: return false, 3.0, each)
	ok(flat(she.global_position).distance_to(Vector2(0.75, 5.2)) < 0.1, "6: watched again, she stays there")
	look(shelf)
	await watch(func() -> bool: return flat(she.global_position).distance_to(Vector2(-0.1, 4.3)) < 0.1, 8.0, each)
	ok(flat(she.global_position).distance_to(Vector2(-0.1, 4.3)) < 0.1, "6: you look away again: she's behind the counter with you")
	look(Vector3(-0.1, 1.4, 4.3))
	await watch(func() -> bool: return false, 2.5, each)
	look(shelf)
	var scared := [0]
	(main.get_node("Rin markers") as HSNpc).scared.connect(func() -> void: scared[0] += 1)
	var fired := [0]
	(main.get_node("Areas/ShopScare") as Node).connect("scared", func() -> void: fired[0] += 1)
	var first := {}
	var shown := [0]
	var each2 := func() -> void:
		each.call()
		if she.visible and rin.body.now.begins_with("scare"):
			shown[0] += 1
			if first.is_empty():
				var d := player.global_position - she.global_position
				first["gap"] = flat(d).length()                    # (filled in place: a lambda's own copy of a local can't be given a new value)
				first["off"] = ang(yaw_of(she), rad_to_deg(atan2(d.x, d.z)))
				first["clip"] = rin.body.now
	await watch(func() -> bool: return flag("rin_gone"), 12.0, each2)
	ok(scared[0] == 1 and fired[0] == 1 and not first.is_empty() and float(first.get("gap", 9.0)) < 1.9 and float(first.get("off", 99.0)) < 12.0,
		"6: the third time, a jump scare beside you: already lunging, turned to you; the scare is heard and the shop's lights flicker", str(first))
	ok(shown[0] > 30 and shown[0] < 110 and not she.visible and flag("rin_gone"), "6: shown for about a second, then gone", "%d frames" % shown[0])
	var seen_jumps := jumps.filter(func(j: Array) -> bool: return bool(j[1]))
	ok(jumps.size() == 3 and seen_jumps.is_empty(), "6: she changed places three times, never where you could see her go", str(jumps.map(func(j: Array) -> String: return "%.1f m" % j[0])))


# ---- 7: round the corner, then behind you ------------------------------------------------------------------------------------------
func stage_corner() -> void:
	var it := runner("It")
	var c := her("It")
	var corner := Vector3(10.0, 0, 1.45)
	put(Vector3(5.3, 0.05, 0.45))
	look(Vector3(10.0, 1.5, 1.2))
	await frames(12)
	ok(flag("in_corridor"), "7: walking into the corridor sets its area's flag")
	var q := "Round the corner"
	var peek := marker("It", q, "Peek")
	var head := probe(c, "c_head")
	var want := HSNpcFlow.peek_stand(corner, Vector3(-1, 0, 0), false, it.body.record)
	var past := [-9.0]
	var stood := [9.0]
	var saw := [false]
	var t := tracker(it)
	var each := func() -> void:
		(t["each"] as Callable).call()
		if rests_at(it, peek):
			past[0] = maxf(past[0], corner.z - head.global_position.z)
			stood[0] = minf(stood[0], flat(c.global_position).distance_to(flat(want)))
			saw[0] = saw[0] or it.seen()
	await watch(func() -> bool: return it.body.hidden and (t["at"] as Dictionary).has(peek), 40.0, each)
	ok(stood[0] < 0.04 and past[0] > 0.02 and seen_at(t, peek, "peeking", "postures") and saw[0], "7: it leans out past the wall's end at the far corner, where you can see it",
		"%.1f cm from where its clip stands it, its head %.0f cm past the edge" % [stood[0] * 100.0, past[0] * 100.0])
	var away := marker("It", q, "Creep")
	ok(seen_at(t, away, "peek_back") and seen_at(t, away, "creep") and it.body.hidden and took(t, peek) > 1.4, "7: seen for a moment, it draws back, creeps off down the side corridor and is gone",
		"watched %.1f s; then %s" % [took(t, peek), (t["at"][away]["nows"] as Dictionary).keys() if (t["at"] as Dictionary).has(away) else []])
	put(Vector3(11.0, 0.05, 0.6))
	look(Vector3(11.0, 1.2, 6.0))
	await frames(12)
	ok(flag("at_corner"), "7: at the corner, looking down the empty side corridor: its area's flag")
	await watch(func() -> bool: return c.visible and flat(c.global_position).distance_to(Vector2(9.3, 0.45)) < 0.1, 6.0, t["each"])
	var d := player.global_position - c.global_position
	ok(c.visible and flat(c.global_position).distance_to(Vector2(9.3, 0.45)) < 0.1 and not it.seen(), "7: it's standing in the corridor behind you",
		"%.1f m behind you" % flat(d).length())
	await secs(1.0)
	ok(it.body.now != "scare_lunge" and c.visible, "7: and stays there for as long as you don't turn round")
	var scared := [0]
	(main.get_node("It markers") as HSNpc).scared.connect(func() -> void: scared[0] += 1)
	var fired := [0]
	(main.get_node("Areas/CorridorScare") as Node).connect("scared", func() -> void: fired[0] += 1)
	look(Vector3(9.3, 1.4, 0.45))
	var shown := [0]
	var each2 := func() -> void:
		if c.visible and it.body.now.begins_with("scare"):
			shown[0] += 1
	await watch(func() -> bool: return flag("corridor_done"), 10.0, each2)
	ok(scared[0] == 1 and fired[0] == 1 and shown[0] > 30 and shown[0] < 110 and not c.visible and flag("corridor_done"),
		"7: you turn round: the jump scare, the corridor's lights flickering, and it's gone", "shown %d frames" % shown[0])


# ---- 8: out of the dark: a crawl, a creep, a blow ------------------------------------------------------------------------------------
func stage_cellar() -> void:
	var it := runner("It")
	var c := her("It")
	var door := thing("CellarDoor")
	put(Vector3(11.0, 0.05, 6.9))
	look(Vector3(11.0, 1.1, 7.95))
	await frames(10)
	if not story.has("cellar_key"):
		var hit0: Node = player.call("use")
		await frames(4)
		ok(not flag("cellar_open"), "8: without the key the cellar door only says it's locked (its Logic)", str(hit0))
		story.give("cellar_key", "Cellar key")
		await frames(2)
	var hit: Node = player.call("use")
	await frames(6)
	ok(flag("cellar_open"), "8: with the key in your pocket, E on the cellar door: its Logic sets cellar_open", str(hit))
	var blows: Array = []
	(main.get_node("It markers") as HSNpc).struck.connect(func(tg: Node, k: String) -> void: blows.append([String(tg.name), k]))
	var hits := [0]
	if player.has_signal("hit"):
		player.connect("hit", func(_a = null, _b = null) -> void: hits[0] += 1)
	var t := tracker(it)
	var q := "Out of the dark"
	var crawl := marker("It", q, "Crawl")
	var creep := marker("It", q, "Creep")
	var low := [9.0]
	var each := func() -> void:
		(t["each"] as Callable).call()
		if it.cur == crawl and it.body.now == "crawl":
			low[0] = minf(low[0], bone(c, "c_head").y)
	await watch(func() -> bool: return flag("it_done"), 90.0, each)
	ok(seen_at(t, crawl, "crawl") and low[0] < 1.0, "8: behind you it comes down the corridor on all fours", "its head as low as %.2f m" % low[0])
	ok(seen_at(t, creep, "creep") and took(t, creep) > 0.8, "8: then it's up, hunched, and comes for you", "%.1f s of it" % took(t, creep))
	ok(blows.size() == 1 and blows[0][0] == "Player" and blows[0][1] == "punch" and hits[0] >= 1, "8: its blow lands on you: the character's struck signal, and the starter's player is knocked", "%s, the player hit %d" % [blows, hits[0]])
	ok(flag("it_done") and not c.visible, "8: and it's gone")
