## MARKERS's playthrough (tools/godot/markers_check.py; docs/MARKERS.md): markers built in code in a by-hand project
## and played headless (--fixed-fps 60), every kind of §4 and every rule of §6 measured. Prints `MARKERS <what> <how>`
## lines and `MARKERS result {errors}`, quits. `-- --only=a,b`: just those stages.
extends SceneTree

const WOMAN := "res://characters/normal_woman.glb"

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var story: Node
var only: Array = []
var spot := 0                                      # each stage gets its own patch of floor


func say(what: String, how: String = "") -> void:
	print("MARKERS %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("MARKERS ERROR %s" % e)


func ok(cond: bool, what: String, how: String = "") -> void:
	if cond:
		say(what, how)
	else:
		bad("%s%s" % [what, (": " + how) if how != "" else ""])


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 60.0)))


func until(cond: Callable, t: float) -> bool:
	for i in int(ceil(t * 60.0)):
		if cond.call():
			return true
		await physics_frame
	return cond.call()


# every frame until `cond` (or `t` seconds): `each` called first
func watch(cond: Callable, t: float, each: Callable) -> bool:
	for i in int(ceil(t * 60.0)):
		each.call()
		if cond.call():
			return true
		await physics_frame
	return cond.call()


func put(p: Vector3) -> void:
	player.global_position = p
	player.velocity = Vector3.ZERO


func look(p: Vector3) -> void:
	var from := eye.global_position
	var d := p - from
	player.rotation.y = atan2(-d.x, -d.z)
	player.set("pitch", atan2(d.y, Vector2(d.x, d.z).length()))
	eye.rotation.x = float(player.get("pitch"))


# ---- building ---------------------------------------------------------------------------------------------------------------
func origin() -> Vector3:
	spot += 1
	return Vector3(-36.0 + 12.0 * (spot % 6), 0, -30.0 + 12.0 * (spot / 6))


func woman(at: Vector3, nm: String) -> Node3D:
	var her := (load(WOMAN) as PackedScene).instantiate() as Node3D
	her.name = nm
	main.add_child(her)
	her.global_position = at
	return her


# someone with no skeleton and no animations: a box, and a face of four shapes
func standin(at: Vector3, nm: String, face := true) -> Node3D:
	var n := Node3D.new()
	n.name = nm
	var mi := MeshInstance3D.new()
	mi.name = "Body"
	var bm := BoxMesh.new()
	bm.size = Vector3(0.4, 1.7, 0.25)
	mi.mesh = bm
	mi.position.y = 0.85
	n.add_child(mi)
	if face:
		var fm := MeshInstance3D.new()
		fm.name = "Face"
		var am := ArrayMesh.new()
		for s in ["lipCornerPuller_L", "lipCornerPuller_R", "lipCornerDepressor_L", "lipCornerDepressor_R", "cheekRaiser_L", "browLowerer_L", "jawDrop", "innerBrowRaiser_L"]:
			am.add_blend_shape(s)
		var arr := []
		arr.resize(Mesh.ARRAY_MAX)
		arr[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(-0.1, 1.5, 0.13), Vector3(0.1, 1.5, 0.13), Vector3(0, 1.7, 0.13)])
		var shapes := []
		for i in am.get_blend_shape_count():
			var b := []
			b.resize(Mesh.ARRAY_MAX)
			b[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(-0.1, 1.5 + 0.01 * i, 0.13), Vector3(0.1, 1.5, 0.13), Vector3(0, 1.7, 0.13)])
			shapes.append([b[Mesh.ARRAY_VERTEX], null, null])
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, shapes)
		fm.mesh = am
		n.add_child(fm)
	main.add_child(n)
	n.global_position = at
	return n


func new_npc(her: Node3D, nm: String, set: Dictionary = {}) -> HSNpc:
	var n := HSNpc.new()
	n.name = nm + " markers"
	n.npc_name = nm
	for k in set:
		n.set(k, set[k])
	n.set_meta("her", her)
	return n


# into the tree, pointed at her
func go(npc: HSNpc) -> void:
	main.add_child(npc)
	npc.character = npc.get_path_to(npc.get_meta("her"))


func quest(npc: HSNpc, title: String, starts := "") -> HSNpcQuest:
	var q := HSNpcQuest.new()
	q.name = title
	q.title = title
	q.starts_when = starts
	npc.add_child(q)
	return q


func mk(parent: Node, kind: String, at: Vector3 = Vector3.ZERO, yaw_deg := 0.0, set: Dictionary = {}) -> HSNpcMarker:
	var m := HSNpcMarker.new()
	m.kind = kind
	m.name = "%s%d" % [kind, parent.get_child_count() + 1]
	m.position = at
	m.rotation_degrees.y = yaw_deg
	for k in set:
		if k == "talks":
			var list: Array[Dictionary] = []
			list.assign(set[k])
			m.talks = list
		elif k == "fire":
			var paths: Array[NodePath] = []
			paths.assign(set[k])
			m.fire = paths
		else:
			m.set(k, set[k])
	parent.add_child(m)
	return m


func bend(m: HSNpcMarker, at: Vector3) -> void:
	var b := HSNpcBend.new()
	b.position = at                                            # (a bend is a place in the world)
	m.add_child(b)


func way(choice: HSNpcMarker, when: String) -> HSNpcWay:
	var w := HSNpcWay.new()
	w.when = when
	w.name = "way%d" % (choice.get_child_count() + 1)
	w.position = -choice.position
	choice.add_child(w)
	return w


func box(mid: Vector3, size: Vector3, nm := "Box") -> StaticBody3D:
	var b := StaticBody3D.new()
	b.name = nm
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = size
	cs.shape = sh
	b.add_child(cs)
	main.add_child(b)
	b.global_position = mid
	return b


func flat(v: Vector3) -> Vector2:
	return Vector2(v.x, v.z)


func yaw_of(n: Node3D) -> float:
	var f := n.global_basis.z
	return rad_to_deg(atan2(f.x, f.z))


func ang(a: float, b: float) -> float:
	return absf(rad_to_deg(angle_difference(deg_to_rad(a), deg_to_rad(b))))


func now() -> float:
	return Engine.get_physics_frames() / 60.0


func wants(stage: String) -> bool:
	return only.is_empty() or stage in only


# ---- the stages -------------------------------------------------------------------------------------------------------------
func _initialize() -> void:
	create_timer(900.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("MARKERS result " + JSON.stringify({"errors": errors}))
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
	for st in [["order", stage_order], ["gates", stage_gates], ["quests", stage_quests], ["talk", stage_talk], ["repeat", stage_repeat], ["hide", stage_hide],
			["sit", stage_sit], ["clips", stage_clips], ["speed", stage_speed], ["stairs", stage_stairs], ["faces", stage_faces], ["looks", stage_looks],
			["shot", stage_shot], ["checkpoint", stage_checkpoint], ["event", stage_event], ["you", stage_you], ["problems", stage_problems], ["tester", stage_tester], ["v3", stage_v3]]:
		if wants(st[0]):
			await (st[1] as Callable).call()
	print("MARKERS result " + JSON.stringify({"errors": errors}))
	quit()


# A. in order: put somewhere, a curved walk at her own pace, a wait, a straight walk; where she ends, how she faces
func stage_order() -> void:
	var o := origin()
	var her := woman(o + Vector3(-2, 0, -2), "HerA")
	var npc := new_npc(her, "Ana")
	var q := quest(npc, "One")
	var m1 := mk(q, "appear", o + Vector3(1, 0, 0), 90.0)
	var m2 := mk(q, "walk", o + Vector3(5, 0, 0), 0.0)
	bend(m2, o + Vector3(3, 0, 1.5))
	var m3 := mk(q, "wait", Vector3.ZERO, 0.0, {"stay": "secs", "stay_secs": 1.0})
	var m4 := mk(q, "walk", o + Vector3(5, 0, 4), 180.0, {"smooth": false})
	var started := []
	var times := {}
	var clock := [0.0]
	npc.marker_started.connect(func(m): started.append(String(m.name)); times[String(m.name)] = clock[0])
	var put_at := []
	npc.marker_done.connect(func(m):
		if m == m1:
			put_at.append([her.global_position, yaw_of(her)]))
	go(npc)
	await frames(4)
	var run: HSNpcRunner = npc.runner
	ok(run != null, "A: her markers started")
	if run == null:
		return
	ok(put_at.size() == 1 and (put_at[0][0] as Vector3).distance_to(o + Vector3(1, 0, 0)) < 0.06 and ang(put_at[0][1], 90.0) < 1.0, "A: Start here put her at its pin, facing its arrow", str(put_at))
	var est := HSNpcFlow.seconds_of(m2, o + Vector3(1, 0, 0), run.body.pace(false), run.body.pace(true))
	var near_bend := [INF]
	var speeds := []
	var last := [her.global_position]
	var jump := [0.0]
	var clips := {}
	var each := func() -> void:
		clock[0] += 1.0 / 60.0
		var p := her.global_position
		near_bend[0] = minf(near_bend[0], flat(p).distance_to(flat(o + Vector3(3, 0, 1.5))))
		var v := flat(p).distance_to(flat(last[0])) * 60.0
		jump[0] = maxf(jump[0], flat(p).distance_to(flat(last[0])))
		if run.cur == m2 and run.phase == "run":
			speeds.append(v)
			clips[run.body.now] = true
		last[0] = p
	var t_walk: float = clock[0]
	await watch(func(): return run.cur == m3 or run.cur == m4, 20.0, each)
	var took: float = clock[0] - t_walk
	speeds.sort()
	var mid: float = speeds[speeds.size() / 2] if not speeds.is_empty() else 0.0
	ok(near_bend[0] < 0.12, "A: the walk goes through its bend", "%.2f m from it at the nearest" % near_bend[0])
	ok(absf(mid - run.body.pace(false)) < 0.12 * run.body.pace(false), "A: she walks at her own walk's speed", "%.2f m/s, her walk %.2f" % [mid, run.body.pace(false)])
	ok(clips.has("walk"), "A: her walk plays while she goes", str(clips.keys()))
	ok(jump[0] < 0.06, "A: no jump on the way", "%.3f m in a frame at the most" % jump[0])
	ok(her.global_position.distance_to(o + Vector3(5, 0, 0)) < 0.05, "A: she ends at the Walk's pin", "%.3f m off" % her.global_position.distance_to(o + Vector3(5, 0, 0)))
	ok(ang(yaw_of(her), 0.0) < 2.0, "A: and turns to its arrow", "%.1f deg" % yaw_of(her))
	ok(absf(took - est) < 0.3 * est, "A: it took about what the tab says", "%.1f s, said %.1f" % [took, est])
	await watch(func(): return run.cur == m4, 6.0, each)
	var waited: float = float(times.get(String(m4.name), clock[0])) - float(times.get(String(m3.name), 0.0))
	ok(absf(waited - 1.0) < 0.15, "A: Wait for 1 s waits 1 s", "%.2f s" % waited)
	ok(run.body.now == "walk" or run.body.now == "turn" or run.body.now == "idle", "A: then walks on")
	await watch(func(): return run.finished, 12.0, each)
	ok(her.global_position.distance_to(o + Vector3(5, 0, 4)) < 0.05 and ang(yaw_of(her), 180.0) < 2.0, "A: the straight walk ends at its pin, facing its arrow",
		"%.3f m off, %.1f deg" % [her.global_position.distance_to(o + Vector3(5, 0, 4)), yaw_of(her)])
	ok(started == [String(m1.name), String(m2.name), String(m3.name), String(m4.name)], "A: the markers ran in order", str(started))
	await secs(0.5)
	ok(run.body.now == "idle", "A: with nothing left she idles", run.body.now)
	npc.queue_free()
	her.queue_free()


# B. Starts when: a flag, a wait, you near, a task; she holds meanwhile
func stage_gates() -> void:
	var o := origin()
	var her := woman(o, "HerB")
	var npc := new_npc(her, "Bea")
	var q := quest(npc, "One")
	var m1 := mk(q, "walk", o + Vector3(2, 0, 0), 90.0, {"start_when": "gate_b"})
	var m2 := mk(q, "walk", o + Vector3(2, 0, 2), 0.0, {"start_when": "@wait:1.5"})
	var m3 := mk(q, "walk", o + Vector3(0, 0, 2), 0.0, {"start_when": "@near:2.5"})
	var m4 := mk(q, "walk", o + Vector3(0, 0, 0), 0.0, {"start_when": "task:book, !gate_off"})
	go(npc)
	put(o + Vector3(8, 0.1, 8))
	await secs(1.0)
	var run: HSNpcRunner = npc.runner
	ok(run.cur == m1 and run.phase == "gate" and flat(her.global_position).distance_to(flat(o)) < 0.02, "B: a marker whose flag isn't on waits", run.status())
	ok(run.body.now == "idle", "B: she idles while she waits", run.body.now)
	story.flag("gate_b")
	await until(func(): return run.cur == m2, 8.0)
	ok(run.cur == m2, "B: the flag on, it runs", run.status())
	var t := [0.0]
	await watch(func(): return run.phase == "run", 5.0, func(): t[0] += 1.0 / 60.0)
	ok(absf(t[0] - 1.5) < 0.2, "B: @wait:1.5 starts 1.5 s after she's ready", "%.2f s" % t[0])
	await until(func(): return run.cur == m3 and run.phase == "gate", 8.0)
	await secs(0.6)
	ok(run.cur == m3 and run.phase == "gate", "B: @near waits while you're far", "%.1f m" % run.player_dist())
	put(o + Vector3(3.2, 0.1, 3.2))
	await until(func(): return run.phase == "run", 2.0)
	ok(run.cur == m3 and run.phase == "run", "B: and starts when you're within 2.5 m", "%.1f m" % run.player_dist())
	put(o + Vector3(8, 0.1, 8))
	await until(func(): return run.cur == m4 and run.phase == "gate", 8.0)
	story.flag("gate_off")
	story.tick("book")
	await secs(0.5)
	ok(run.cur == m4 and run.phase == "gate", "B: two words: both must be so", run.waiting_for)
	story.unflag("gate_off")
	await until(func(): return run.phase == "run", 1.0)
	ok(run.phase == "run", "B: 'not' a flag is so once it's off")
	await until(func(): return run.finished, 8.0)
	ok(flat(her.global_position).distance_to(flat(o)) < 0.05, "B: she's back where she began")
	npc.queue_free()
	her.queue_free()


# C. quests: carried on, cut short by a later one, never back up the list, the next in order by itself
func stage_quests() -> void:
	var o := origin()
	var her := woman(o, "HerC")
	var npc := new_npc(her, "Cyd")
	var q1 := quest(npc, "One")
	mk(q1, "walk", o + Vector3(3, 0, 0), 90.0)
	var q2 := quest(npc, "Two", "on:night2")
	var w2 := mk(q2, "walk", o + Vector3(3, 0, 6), 0.0)
	var q3 := quest(npc, "Three", "jump_c")
	var w3 := mk(q3, "walk", o + Vector3(-2, 0, 1), 0.0)
	var q4 := quest(npc, "Four")
	var w4 := mk(q4, "walk", o + Vector3(-2, 0, -2), 180.0)
	var began := []
	npc.quest_started.connect(func(q): began.append(String(q.name)))
	go(npc)
	put(o + Vector3(9, 0.1, 9))
	await frames(4)
	var run: HSNpcRunner = npc.runner
	await until(func(): return run.finished, 8.0)
	ok(run.qi == 0 and run.finished and flat(her.global_position).distance_to(flat(o + Vector3(3, 0, 0))) < 0.05, "C: the first quest runs by itself and she holds where it left her")
	await secs(1.0)
	ok(run.qi == 0, "C: a quest that waits for a task doesn't start before it", run.status())
	var last := [her.global_position]
	var jump := [0.0]
	var each := func() -> void:
		jump[0] = maxf(jump[0], flat(her.global_position).distance_to(flat(last[0])))
		last[0] = her.global_position
	story.add_task("night2", "The second night.")
	await watch(func(): return run.qi == 1 and run.phase == "run", 2.0, each)
	ok(run.qi == 1, "C: the task on the list, its quest starts", run.status())
	await watch(func(): return flat(her.global_position).distance_to(flat(o + Vector3(3, 0, 0))) > 2.5, 8.0, each)
	ok(jump[0] < 0.06, "C: she goes on from where the quest before left her", "%.3f m in a frame at the most" % jump[0])
	var here := her.global_position
	put(her.global_position + Vector3(2.5, 0.1, 0))             # you're watching her
	look(her.global_position + Vector3.UP)
	await frames(3)
	ok(run.seen(), "C: (you can see her)")
	last[0] = her.global_position
	story.flag("jump_c")
	await watch(func(): return run.qi == 2, 1.0, each)
	ok(run.qi == 2 and run.cur == w3, "C: a later quest whose flag comes on cuts in", run.status())
	ok(flat(her.global_position).distance_to(flat(here)) < 0.3, "C: watched, she goes on from where she is", "%.2f m" % flat(her.global_position).distance_to(flat(here)))
	await watch(func(): return run.qi == 3, 10.0, each)
	ok(jump[0] < 0.06, "C: with no jump", "%.3f m" % jump[0])
	put(o + Vector3(9, 0.1, 9))
	ok(run.qi == 3, "C: its markers done, the next quest (no Starts when) starts by itself", run.status())
	await until(func(): return run.finished, 10.0)
	ok(flat(her.global_position).distance_to(flat(o + Vector3(-2, 0, -2))) < 0.05, "C: and runs to its end")
	story.tick("night2")
	story.unflag("jump_c")
	story.flag("jump_c")
	await secs(0.6)
	ok(run.qi == 3 and began == ["One", "Two", "Three", "Four"], "C: she never goes back up the list", str(began))
	ok(flat(her.global_position).distance_to(flat(o + Vector3(3, 0, 6))) > 3.0, "C: the quest cut short never finished its walk")
	npc.queue_free()
	her.queue_free()


func bone_at(her: Node3D, nm: String) -> Vector3:
	var sk := HSNpcBody.skeleton_of(her)
	return sk.global_transform * sk.get_bone_global_pose(sk.find_bone(nm)).origin


func made(src: String) -> GDScript:
	var sc := GDScript.new()
	sc.source_code = src
	sc.reload()
	return sc


func box_of() -> HSNpcTalkBox:
	return HSNpcTalkBox.of(root.get_tree())


# D. talking: the prompt, lines, answers to flags, a Choice taking the answer's way, once, again, by flag
func stage_talk() -> void:
	var o := origin()
	var her := woman(o, "HerD")
	var npc := new_npc(her, "Dee")
	var q := quest(npc, "One")
	var talks := [{"when": "knows_d", "lines": ["Dee: You again."]},
		{"when": "", "lines": ["Dee: Looking for something?", "[smile] I can show you."], "sets": "+met_dee", "again": "Dee: I told you already.",
			"answers": [{"text": "The kitchen", "sets": "+dee_kitchen", "face": "smile", "reply": "Dee: This way."}, {"text": "The garden", "sets": "+dee_garden", "face": "sad", "reply": "Dee: Oh. The garden."}]}]
	var m1 := mk(q, "wait", Vector3.ZERO, 0.0, {"talk": true, "stay": "talked", "talks": talks})
	var c := mk(q, "choice")
	var wk := way(c, "dee_kitchen")
	mk(wk, "walk", o + Vector3(4, 0, 0), 0.0)
	var wg := way(c, "dee_garden")
	mk(wg, "walk", o + Vector3(0, 0, -4), 0.0)
	var m3 := mk(q, "wait", Vector3.ZERO, 0.0, {"stay": "secs", "stay_secs": 0.3, "set_flags": "+dee_done"})
	var heard := []
	npc.talked.connect(func(m, i): heard.append(i))
	go(npc)
	put(o + Vector3(0, 0.1, 1.4))
	look(o + Vector3(0, 1.1, 0))
	await secs(0.6)
	var run: HSNpcRunner = npc.runner
	var box := box_of()
	ok(run.cur == m1 and run.phase == "stay" and run.can_talk(), "D: she stays until you talk to her", run.status())
	ok(box.prompt_text() == "Talk Dee" and box.get_node("Root/Ring").visible and box.get_node("Root/Prompt/Verb").text == "Talk" and box.get_node("Root/Prompt/ThingName").text == "Dee",
		"D: aimed at her, a ring with the verb beside it and her name under it", box.prompt_text())
	ok(box.find_children("*", "PanelContainer", true, false).is_empty(), "D: no panel anywhere in it")
	look(o + Vector3(6, 1.1, 0))
	await frames(4)
	ok(box.prompt_text() == "", "D: looking away, no prompt", box.prompt_text())
	look(o + Vector3(0, 1.1, 0))
	await frames(4)
	var hit: Node = player.call("use")
	await frames(2)
	ok(hit != null and box.open_now and run.talking, "D: E on her opens the conversation", str(hit))
	ok(player.process_mode == Node.PROCESS_MODE_DISABLED, "D: you stand still while it's open")
	ok(box.showing()["who"] == "Dee" and box.showing()["text"] == "Looking for something?", "D: her first line", str(box.showing()))
	await secs(0.5)
	ok(run.cur == m1, "D: nothing of hers starts while you talk")
	var foot := box.get_node("Root/Footer") as Control
	var row := box.get_node("Root/Footer/Dock/Choice") as HBoxContainer
	ok(foot.visible and (box.get_node("Root/Footer/Line") as Label).text == "Looking for something?" and (box.get_node("Root/Footer/Who") as Label).text == "Dee" and not row.visible,
		"D: drawn as a line at the foot of the view with her name over it, no answers yet")
	box.advance()
	ok(box.showing()["text"] == "I can show you." and box.showing()["who"] == "Dee", "D: a line that names nobody is hers", str(box.showing()))
	ok(box.stage == "answers" and box.options() == ["The kitchen", "The garden"], "D: the last line comes with the answers, as their question", str(box.options()))
	await frames(2)
	var opts := []
	var dashes := 0
	for ch in row.get_children():
		if ch.has_meta("label"):
			opts.append(ch)
		elif ch is Label and (ch as Label).text == "—":
			dashes += 1
	var a0: Color = (opts[0] as Button).get_theme_color("font_color") if opts.size() == 2 else Color.BLACK
	var a1: Color = (opts[1] as Button).get_theme_color("font_color") if opts.size() == 2 else Color.BLACK
	ok(row.visible and opts.size() == 2 and dashes == 1 and (opts[0] as Button).text == "The kitchen" and (opts[1] as Button).text == "The garden" and absf((opts[0] as Control).global_position.y - (opts[1] as Control).global_position.y) < 1.0,
		"D: the answers on one line under it, a dash between, their own words and no numbers", "%d answers, %d dash" % [opts.size(), dashes])
	ok(a0.a > 0.9 and a1.a < a0.a * 0.6, "D: the one pointed at white, the other dimmed", "%.2f and %.2f" % [a0.a, a1.a])
	box.advance()
	ok(box.stage == "answers" and box.open_now and not story.is_set("dee_kitchen"), "D: E hurries the lines and never picks an answer")
	var key := func(code: Key) -> void:
		var ev := InputEventKey.new()
		ev.physical_keycode = code
		ev.keycode = code
		ev.pressed = true
		box._input(ev)
	box._opened = 0
	key.call(KEY_1)
	key.call(KEY_2)
	ok(box.stage == "answers" and not story.is_set("dee_kitchen") and not story.is_set("dee_garden"), "D: nor does 1 or 2")
	key.call(KEY_D)
	a0 = (opts[0] as Button).get_theme_color("font_color")
	a1 = (opts[1] as Button).get_theme_color("font_color")
	ok(box.selected == 1 and a1.a > 0.9 and a0.a < a1.a * 0.6, "D: D (or the right arrow) points at the next one")
	key.call(KEY_LEFT)
	ok(box.selected == 0, "D: A (or the left arrow) back")
	key.call(KEY_RIGHT)
	key.call(KEY_ENTER)
	ok(story.is_set("dee_garden") and not story.is_set("dee_kitchen"), "D: the answer picked switches its flags")
	ok(box.showing()["text"] == "Oh. The garden." and not row.visible, "D: Enter picks it: her reply, the answers gone", str(box.showing()))
	var wait := HSNpcTalkBox.read_secs("Oh. The garden.")
	await secs(wait - 0.4)
	ok(box.open_now, "D: a line stays as long as it takes to read", "%.1f s" % wait)
	await secs(0.7)
	ok(not box.open_now and not run.talking and player.process_mode != Node.PROCESS_MODE_DISABLED and not foot.visible, "D: then it's over by itself, and you can move again")
	ok(story.is_set("met_dee") and story.is_set("talked:dee") and heard == [1], "D: the conversation's own flag, talked:dee, the signal", str(heard))
	await until(func(): return story.is_set("dee_done"), 12.0)
	ok(flat(her.global_position).distance_to(flat(o + Vector3(0, 0, -4))) < 0.05, "D: the Choice took the way of the answer", "%.2f m from the garden" % flat(her.global_position).distance_to(flat(o + Vector3(0, 0, -4))))
	ok(story.is_set("dee_done"), "D: and the markers after the Choice ran")
	npc.queue_free()
	her.queue_free()
	# once, again, by flag
	var o2 := origin()
	var her2 := woman(o2, "HerD2")
	var npc2 := new_npc(her2, "Dot")
	var q2 := quest(npc2, "One")
	var t2 := [{"when": "knows_d", "lines": ["Dot: You again."]},
		{"when": "", "lines": ["Dot: Yes or no?"], "again": "Dot: I told you already.", "answers": [{"text": "Yes", "sets": "+dot_yes"}, {"text": "No", "sets": "+dot_no"}]}]
	var w := mk(q2, "wait", Vector3.ZERO, 0.0, {"talk": true, "stay": "secs", "stay_secs": 60.0, "talks": t2})
	go(npc2)
	put(o2 + Vector3(0, 0.1, 1.4))
	look(o2 + Vector3(0, 1.1, 0))
	await secs(0.5)
	var run2: HSNpcRunner = npc2.runner
	player.call("use")
	await frames(2)
	box.advance()
	box.pick(0)
	await frames(3)
	ok(story.is_set("dot_yes") and not box.open_now, "D: an answer with no reply ends it")
	player.call("use")
	await frames(2)
	ok(box.open_now and box.showing()["text"] == "I told you already." and box.options().is_empty(), "D: asked again, her 'again' line and no answers", str(box.showing()))
	box.advance()
	await frames(2)
	ok(not story.is_set("dot_no"), "D: an answer is given once")
	story.flag("knows_d")
	await secs(0.3)
	player.call("use")
	await frames(2)
	ok(box.open_now and box.showing()["text"] == "You again.", "D: a flag picks which conversation she has", str(box.showing()))
	box.advance()
	await frames(2)
	ok(run2.cur == w and not box.open_now, "D: a conversation with no answers can be had again")
	await frames(6)
	var up_before := box.prompt_text()
	npc2.queue_free()
	her2.queue_free()
	await frames(4)
	ok(up_before == "Talk Dot" and box.prompt_text() == "" and not story.is_connected("kept", run2._on_kept) and not story.is_connected("revived", run2._on_revived),
		"D: taken out of the scene while you're aimed at her: her prompt goes and nothing of hers still listens to the Story", "'%s' then '%s'" % [up_before, box.prompt_text()])
	# with the UI plugin's HUD in the scene: its own line, its own one-line choice, its own ring and prompt
	var hud_script = load("res://addons/horrorstudio_ui/hud.gd") if ResourceLoader.exists("res://addons/horrorstudio_ui/hud.gd") else null
	ok(hud_script != null, "D: the UI plugin is in the project")
	if hud_script != null:
		var hud = hud_script.new()
		hud.name = "Hud"
		main.add_child(hud)
		box._hud_t = -100000
		var o3 := origin()
		var her3 := woman(o3, "HerD3")
		var npc3 := new_npc(her3, "Eve")
		var q3 := quest(npc3, "One")
		var t3 := [{"when": "", "lines": ["Eve: Tea?", "Eve: Or something stronger?"], "answers": [{"text": "Tea", "sets": "+eve_tea", "reply": "Eve: Tea it is."}, {"text": "Stronger", "sets": "+eve_strong"}]}]
		mk(q3, "wait", Vector3.ZERO, 0.0, {"talk": true, "stay": "secs", "stay_secs": 60.0, "talks": t3})
		go(npc3)
		put(o3 + Vector3(0, 0.1, 1.4))
		look(o3 + Vector3(0, 1.1, 0))
		await secs(0.6)
		ok(str(hud.cursor_label) == "Talk" and str(hud.cursor_name) == "Eve" and not box.get_node("Root/Ring").visible and not box.get_node("Root/Prompt").visible,
			"D: with a HUD in the scene the prompt is the HUD's own ring, verb and name", "%s %s" % [hud.cursor_label, hud.cursor_name])
		look(o3 + Vector3(6, 1.1, 0))
		await frames(4)
		ok(str(hud.cursor_label) == "", "D: and gone from it when you look away")
		look(o3 + Vector3(0, 1.1, 0))
		await frames(4)
		player.call("use")
		await frames(2)
		ok(box.open_now and str(hud.line_el.text) == "Tea?" and str(hud.who_el.text) == "Eve" and not (box.get_node("Root/Footer") as Control).visible,
			"D: her line is the HUD's own line, nothing drawn beside it", "%s: %s" % [hud.who_el.text, hud.line_el.text])
		box.advance()
		await frames(2)
		ok(box.stage == "answers" and not bool(hud.choice_over) and hud.choice_options() == ["Tea", "Stronger"] and str(hud.line_el.text) == "Or something stronger?",
			"D: the answers are the HUD's own choice under the question", str(hud.choice_options()))
		box._opened = 0
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_D
		ev.pressed = true
		box._input(ev)
		ok(int(hud.choice_sel) == 1 and box.selected == 1, "D: D moves the HUD's own pick")
		box.select(0)
		ok(int(hud.choice_sel) == 0, "D: and back")
		hud.choice_pick(1)                                     # (as a player: to it, then Enter)
		await frames(2)
		ok(story.is_set("eve_tea") and not story.is_set("eve_strong") and bool(hud.choice_over) and str(hud.line_el.text) == "Tea it is.", "D: picked in the HUD: its flag, her reply on the HUD", str(hud.line_el.text))
		box.advance()
		await frames(2)
		ok(not box.open_now and player.process_mode != Node.PROCESS_MODE_DISABLED, "D: and over")
		story.set_flag("eve_tea", false)
		npc3.runner.asked.clear()
		await frames(4)                                        # (the box E finds her by comes back once she has something to say again)
		player.call("use")
		await frames(2)
		box.advance()
		await frames(2)
		ok(box.open_now and box.stage == "answers" and not bool(hud.choice_over), "D: (asked again, the answers up)")
		box.close()
		await frames(2)
		ok(bool(hud.choice_over) and not box.open_now and not story.is_set("eve_tea") and not story.is_set("eve_strong"), "D: shut with the answers up (she's shot): the HUD's choice put away, nothing answered")
		npc3.queue_free()
		her3.queue_free()
		hud.queue_free()
		await frames(2)
		box._hud_t = -100000
	put(Vector3(20, 0.1, 20))


# E. Repeat: N times, until a flag, and one of only instant markers doesn't freeze the game
func stage_repeat() -> void:
	var o := origin()
	var her := woman(o, "HerE")
	var npc := new_npc(her, "Eve")
	var q := quest(npc, "One")
	var r := mk(q, "repeat", Vector3.ZERO, 0.0, {"repeat_times": 2})
	var a := mk(r, "walk", o + Vector3(2, 0, 0), 0.0)
	var b := mk(r, "walk", o, 0.0)
	mk(q, "event", Vector3.ZERO, 0.0, {"set_flags": "+rep_done"})
	var q2 := quest(npc, "Two", "go_e2")
	var r2 := mk(q2, "repeat", Vector3.ZERO, 0.0, {"repeat_until": "stop_e"})
	mk(r2, "event", Vector3.ZERO, 0.0, {"set_flags": "~spin_e"})
	mk(q2, "event", Vector3.ZERO, 0.0, {"set_flags": "+after_e"})
	var count := {}
	var per_frame := [0, 0]
	npc.marker_started.connect(func(m): count[m] = int(count.get(m, 0)) + 1; per_frame[0] += 1)
	go(npc)
	await until(func(): return story.is_set("rep_done"), 20.0)
	ok(int(count.get(a, 0)) == 2 and int(count.get(b, 0)) == 2 and story.is_set("rep_done"), "E: a Repeat of 2 runs its markers twice, then the next", "%d and %d" % [count.get(a, 0), count.get(b, 0)])
	story.flag("go_e2")
	var most := [0]
	var n := [0]
	await watch(func(): return n[0] >= 60, 3.0, func(): most[0] = maxi(most[0], per_frame[0]); per_frame[0] = 0; n[0] += 1)
	ok(n[0] >= 60 and most[0] <= 16, "E: a Repeat of only instant markers doesn't hold the frame", "%d markers a frame at the most" % most[0])
	ok(not story.is_set("after_e"), "E: with no end it keeps going")
	story.flag("stop_e")
	await until(func(): return story.is_set("after_e"), 2.0)
	ok(story.is_set("after_e"), "E: until its flags are so; then the next marker")
	npc.queue_free()
	her.queue_free()


# F. Disappear: not drawn, not processed, still there; back by herself, or put somewhere; only when you're not looking
func stage_hide() -> void:
	var o := origin()
	var her := woman(o, "HerF")
	var npc := new_npc(her, "Fay")
	var q := quest(npc, "One")
	mk(q, "walk", o + Vector3(2, 0, 0), 90.0)
	var d1 := mk(q, "disappear")
	var back := mk(q, "wait", Vector3.ZERO, 0.0, {"start_when": "back_f", "stay": "secs", "stay_secs": 0.3})
	var d2 := mk(q, "disappear", Vector3.ZERO, 0.0, {"how": "unseen", "start_when": "hide_f"})
	var ap := mk(q, "appear", o + Vector3(-2, 0, 2), 180.0, {"start_when": "again_f"})
	go(npc)
	put(o + Vector3(9, 0.1, 9))
	await frames(4)
	var run: HSNpcRunner = npc.runner
	await until(func(): return run.cur == back, 8.0)
	var ap_node := her.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer
	var pos0 := ap_node.current_animation_position
	var bone0 := bone_at(her, "r_wrist")
	await secs(0.5)
	ok(not her.visible and her.process_mode == Node.PROCESS_MODE_DISABLED and run.body.hidden, "F: Disappear hides her and switches her processing off")
	ok(is_equal_approx(ap_node.current_animation_position, pos0) and bone_at(her, "r_wrist").distance_to(bone0) < 1e-5, "F: nothing of hers animates while she's gone",
		"her clip at %.3f s then %.3f s" % [pos0, ap_node.current_animation_position])
	ok(is_instance_valid(her) and her.is_inside_tree(), "F: she still exists")
	story.flag("back_f")
	await until(func(): return her.visible, 1.0)
	ok(her.visible and her.process_mode != Node.PROCESS_MODE_DISABLED and flat(her.global_position).distance_to(flat(o + Vector3(2, 0, 0))) < 0.05, "F: a marker that needs her brings her back where she vanished")
	await until(func(): return run.cur == d2 and run.phase == "gate", 3.0)
	put(o + Vector3(2, 0.1, 3))
	look(o + Vector3(2, 1.0, 0))
	await frames(3)
	story.flag("hide_f")
	await secs(1.0)
	ok(her.visible and run.cur == d2, "F: 'when you're not looking' waits while you look at her", run.status())
	look(o + Vector3(2, 1.0, 9))
	await until(func(): return not her.visible, 1.0)
	ok(not her.visible, "F: and takes her the moment you look away")
	story.flag("again_f")
	await until(func(): return her.visible, 1.0)
	ok(her.visible and flat(her.global_position).distance_to(flat(o + Vector3(-2, 0, 2))) < 0.05 and ang(yaw_of(her), 180.0) < 1.0, "F: Start here brings her back at its pin")
	HSNpc.debug = true
	await frames(3)
	var said: String = npc.debug_text()
	ok(npc.get_node_or_null("_Debug") != null and said.contains("Fay") and said.contains("One"), "F: F7 shows over her what she's doing", said.replace("\n", " | "))
	HSNpc.debug = false
	await frames(3)
	ok(npc.get_node_or_null("_Debug") == null, "F: and takes it away again")
	npc.queue_free()
	her.queue_free()
	# fading out and in
	var o2 := origin()
	var her2 := woman(o2, "HerF2")
	var npc2 := new_npc(her2, "Fen")
	var q2 := quest(npc2, "One")
	var out := mk(q2, "disappear", Vector3.ZERO, 0.0, {"how": "fade", "start_when": "fade_f"})
	var back2 := mk(q2, "appear", o2 + Vector3(2, 0, 0), 0.0, {"how": "fade", "start_when": "unfade_f"})
	var plain := mk(q2, "disappear", Vector3.ZERO, 0.0, {"how": "fade", "start_when": "fade2_f"})
	var back3 := mk(q2, "wait", Vector3.ZERO, 0.0, {"start_when": "plain_f", "stay": "secs", "stay_secs": 0.2})
	go(npc2)
	await secs(0.4)
	var run2: HSNpcRunner = npc2.runner
	story.flag("fade_f")
	await secs(0.25)
	var ph := her2.get_node_or_null("HSPhase")
	ok(ph != null and her2.visible and float(ph.get("amount")) > 0.02 and float(ph.get("amount")) < 1.0, "F: fading out, she's still there and going", "%.2f gone" % (float(ph.get("amount")) if ph != null else -1.0))
	await until(func(): return run2.body.hidden, 4.0)
	ok(run2.body.hidden and not her2.visible and her2.process_mode == Node.PROCESS_MODE_DISABLED, "F: then gone and switched off")
	story.flag("unfade_f")
	await secs(0.25)
	ok(her2.visible and float(ph.get("amount")) > 0.05, "F: fading in, she's back and coming", "%.2f gone" % float(ph.get("amount")))
	await until(func(): return float(ph.get("amount")) <= 0.0, 4.0)
	ok(float(ph.get("amount")) <= 0.0 and flat(her2.global_position).distance_to(flat(o2 + Vector3(2, 0, 0))) < 0.05, "F: and whole again at the pin")
	story.flag("fade2_f")
	await until(func(): return run2.body.hidden, 4.0)
	story.flag("plain_f")
	await secs(0.3)
	ok(her2.visible and float(ph.get("amount")) <= 0.0, "F: faded out, then brought back by a plain marker: whole at once", "%.2f gone" % float(ph.get("amount")))
	npc2.queue_free()
	her2.queue_free()
	put(Vector3(20, 0.1, 20))


# G. sit, sleep, a hand put out, a thing taken and put down
func stage_sit() -> void:
	var o := origin()
	box(o + Vector3(3, 0.225, -0.3), Vector3(1.2, 0.45, 0.6), "Sofa")
	box(o + Vector3(-3.5, 0.225, 0), Vector3(1.0, 0.45, 2.0), "Bed")
	var her := woman(o, "HerG")
	var npc := new_npc(her, "Gia")
	var q := quest(npc, "One")
	mk(q, "walk", o + Vector3(3, 0, 1.0), 0.0)
	var sit := mk(q, "sit", o + Vector3(3, 0.45, 0), 0.0, {"stay": "secs", "stay_secs": 0.8})
	var w2 := mk(q, "walk", o + Vector3(-2.2, 0, 0), 90.0)
	var sl := mk(q, "sleep", o + Vector3(-3.0, 0.45, 0), 90.0, {"stay": "secs", "stay_secs": 0.8})
	var w3 := mk(q, "walk", o + Vector3(0, 0, 3.0), 0.0)
	var reach := mk(q, "grab", o + Vector3(0.2, 0.86, 3.6), 0.0, {"action": "reach"})
	var thing := MeshInstance3D.new()
	thing.name = "Book"
	var bm := BoxMesh.new()
	bm.size = Vector3(0.12, 0.04, 0.18)
	thing.mesh = bm
	main.add_child(thing)
	thing.global_position = o + Vector3(1.2, 0.9, 3.6)
	var pick := mk(q, "grab", o + Vector3(1.2, 0.9, 3.6), 0.0, {"action": "pick_up", "keep_in_hand": true})
	var put_m := mk(q, "grab", o + Vector3(-1.0, 0.9, 3.6), 0.0, {"action": "put_down"})
	# a door: its handle 1.04 m up, a little higher than her clip is made for (the hand's IK carries her hand onto it)
	var door := Node3D.new()
	var dsrc := GDScript.new()
	dsrc.source_code = "extends Node3D\nvar used := 0\nfunc use(_b: Node = null) -> void:\n\tused += 1\n"
	dsrc.reload()
	door.set_script(dsrc)
	door.name = "Door"
	main.add_child(door)
	var open_m := mk(q, "grab", o + Vector3(2.5, 1.04, 5.5), 0.0, {"action": "open", "door_opens": "push"})
	go(npc)
	pick.target = pick.get_path_to(thing)
	open_m.target = open_m.get_path_to(door)
	put(o + Vector3(9, 0.1, 9))
	await frames(4)
	var run: HSNpcRunner = npc.runner
	await until(func(): return run.cur == sit and run.phase == "stay", 12.0)
	var pel := bone_at(her, "root")
	ok(run.body.posture == "sitting", "G: she sits", run.body.posture)
	ok(pel.y > 0.40 and pel.y < 0.66 and absf(pel.x - (o.x + 3.0)) < 0.12 and pel.z < o.z + 0.05 and ang(yaw_of(her), 0.0) < 2.0, "G: on the seat at its pin, facing its arrow",
		"her pelvis %.2f m up, %.2f m behind the seat's edge" % [pel.y, o.z - pel.z])
	var seen_now := {}
	await watch(func(): return run.cur == sl and run.phase == "stay", 25.0, func(): seen_now[run.body.now] = true)
	ok(seen_now.has("stand_up") and seen_now.has("walk"), "G: asked to walk, she stands up first", str(seen_now.keys()))
	var head := bone_at(her, "c_head")
	var pv := bone_at(her, "root")
	ok(run.body.posture == "lying" and absf(head.y - pv.y) < 0.25 and head.y < 0.85, "G: she lies down on the bed", "her head %.2f m up, her pelvis %.2f" % [head.y, pv.y])
	var grab_d := [INF]
	seen_now.clear()
	await watch(func(): return run.cur == pick, 25.0, func():
		seen_now[run.body.now] = true
		if run.cur == reach and run.phase == "run":
			grab_d[0] = minf(grab_d[0], bone_at(her, "r_wrist").distance_to(reach.global_position)))
	ok(seen_now.has("get_up"), "G: asleep, she gets up first", str(seen_now.keys()))
	ok(grab_d[0] < 0.2, "G: a Grab puts her hand at its pin", "%.2f m from it at the nearest" % grab_d[0])
	await until(func(): return run.cur == put_m, 12.0)
	ok(thing.get_parent() is BoneAttachment3D and thing.visible and run.body.held == thing, "G: Pick up: the thing is in her hand", str(thing.get_parent()))
	await until(func(): return run.cur == open_m, 12.0)
	ok(thing.get_parent() == main and thing.global_position.distance_to(put_m.global_position) < 0.03 and run.body.held == null, "G: Put down: it's left at the pin",
		"%.3f m from it" % thing.global_position.distance_to(put_m.global_position))
	var on_handle := [INF]
	await watch(func(): return run.finished, 16.0, func():
		var ik: Node = run.body.ik()
		if run.cur == open_m and is_instance_valid(ik) and ik.last.has("r") and float(ik.last["r"]["weight"]) > 0.98:
			on_handle[0] = minf(on_handle[0], float(ik.last["r"]["error"])))
	ok(door.used == 1 and on_handle[0] < 0.02, "G: a Grab that opens a door: her hand is on its handle where the pin is (4 cm over what her clip is made for), the door's own use() once",
		"%.1f cm from it as she holds it, used %d" % [on_handle[0] * 100.0, door.used])
	door.queue_free()
	npc.queue_free()
	her.queue_free()
	thing.queue_free()


# H. animations: one of her own N times, a loop for a while at a speed, a file of your own, a Kimodo .npz
func stage_clips() -> void:
	var o := origin()
	var her := woman(o, "HerH")
	var sk := HSNpcBody.skeleton_of(her)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://animations"))
	var anim := Animation.new()
	var tr := anim.add_track(Animation.TYPE_ROTATION_3D)
	anim.track_set_path(tr, NodePath("%s:c_head" % her.get_path_to(sk)) if sk.find_bone("c_head") >= 0 else NodePath("%s:head" % her.get_path_to(sk)))
	var head_bone := "c_head" if sk.find_bone("c_head") >= 0 else "head"
	var rest_q := sk.get_bone_rest(sk.find_bone(head_bone)).basis.get_rotation_quaternion()
	for i in 5:
		anim.rotation_track_insert_key(tr, i * 0.25, rest_q * Quaternion(Vector3.RIGHT, 0.5 * sin(i * PI / 2.0)))
	anim.length = 1.0
	ResourceSaver.save(anim, "res://animations/nod.res")
	var R: GDScript = load("res://kimodo/retarget.gd") if ResourceLoader.exists("res://kimodo/retarget.gd") else null
	var N: GDScript = load("res://kimodo/npz.gd") if ResourceLoader.exists("res://kimodo/npz.gd") else null
	if R != null and N != null:
		var soma: Dictionary = R.call("soma")
		var names: Array = soma["names"]
		var rest: Array = soma["rest"]
		var nf := 31
		var flat_a := PackedFloat32Array()
		for f in nf:
			var t := f / float(nf - 1)
			for j in names.size():
				var p := Vector3(float(rest[j][0]), float(rest[j][1]), float(rest[j][2]))
				var nm := str(names[j])
				if nm.begins_with("LeftForeArm") or nm.begins_with("LeftHand") or nm.begins_with("RightForeArm") or nm.begins_with("RightHand"):
					p.y += 0.25 * sin(TAU * t)
				flat_a.append_array([p.x, p.y, p.z])
		N.call("write", ProjectSettings.globalize_path("res://animations/dance.npz"), {"posed_joints": [[nf, 77, 3], flat_a]})
	else:
		bad("H: the Kimodo reader isn't in the project (res://kimodo/)")
	var npc := new_npc(her, "Hal")
	var q := quest(npc, "One")
	var twice := mk(q, "animation", Vector3.ZERO, 0.0, {"clip": "reach_high", "times": 2})
	var loop := mk(q, "animation", Vector3.ZERO, 0.0, {"clip": "walk_loop", "loop": true, "stay": "secs", "stay_secs": 1.5, "anim_speed": 0.5})
	var nod := mk(q, "animation", Vector3.ZERO, 0.0, {"clip_file": "res://animations/nod.res"})
	var dance := mk(q, "animation", Vector3.ZERO, 0.0, {"clip_file": "res://animations/dance.npz", "loop": true, "stay": "secs", "stay_secs": 1.5})
	var none := mk(q, "animation", Vector3.ZERO, 0.0, {"clip": "no_such_clip"})
	mk(q, "wait", Vector3.ZERO, 0.0, {"stay": "secs", "stay_secs": 0.3, "set_flags": "+clips_done"})
	var at := {}
	npc.marker_started.connect(func(m): at[m] = now())
	go(npc)
	await frames(4)
	var run: HSNpcRunner = npc.runner
	var one := run.body.clip_secs("reach_high")
	var tick := func(): pass
	await watch(func(): return run.cur == loop and run.phase != "gate", 12.0, tick)
	var took: float = float(at.get(loop, 0.0)) - float(at.get(twice, 0.0))
	ok(one > 0.5 and absf(took - 2.0 * one) < 0.25, "H: one of her own clips, twice, takes twice its length", "%.2f s, the clip %.2f" % [took, one])
	await frames(20)
	var ap_node := run.body._player
	ok(run.body.now == "walk_loop" and ap_node != null and is_equal_approx(ap_node.speed_scale, 0.5), "H: a loop plays at the speed asked", "%s at %.2f" % [run.body.now, ap_node.speed_scale if ap_node != null else -1.0])
	ok(flat(her.global_position).distance_to(flat(o)) < 0.01, "H: a clip moves her bones, not where she stands")
	await watch(func(): return run.cur == nod and run.phase != "gate", 5.0, tick)
	ok(absf(float(at.get(nod, 0.0)) - float(at.get(loop, 0.0)) - 1.5) < 0.2, "H: a loop stays for its seconds", "%.2f s" % (float(at.get(nod, 0.0)) - float(at.get(loop, 0.0))))
	var swing := [0.0]
	await watch(func(): return run.cur == dance and run.phase != "gate", 5.0, func():
		swing[0] = maxf(swing[0], sk.get_bone_pose_rotation(sk.find_bone(head_bone)).angle_to(rest_q)))
	ok(swing[0] > 0.3, "H: an animation file of your own plays on her", "her head turned %.0f deg" % rad_to_deg(swing[0]))
	var arm := sk.find_bone("l_lowarm") if sk.find_bone("l_lowarm") >= 0 else sk.find_bone("l_wrist")
	var lo := [INF]
	var hi := [-INF]
	await watch(func(): return run.cur != dance, 6.0, func():
		var y := (sk.global_transform * sk.get_bone_global_pose(arm).origin).y
		lo[0] = minf(lo[0], y)
		hi[0] = maxf(hi[0], y))
	ok(R == null or hi[0] - lo[0] > 0.08, "H: a Kimodo .npz is fitted to her skeleton and plays", "her forearm rose and fell %.2f m; problems: %s" % [hi[0] - lo[0], str(run.problems)])
	await until(func(): return story.is_set("clips_done"), 5.0)
	ok(story.is_set("clips_done"), "H: a clip she hasn't got is passed over, and said", str(run.body.problems))
	ok(str(run.body.problems).contains("no_such_clip"), "H: (the problem names it)")
	npc.queue_free()
	her.queue_free()


# I. speed: slower, in a time, running
func stage_speed() -> void:
	var o := origin()
	var her := woman(o, "HerI")
	var npc := new_npc(her, "Ivy")
	var q := quest(npc, "One")
	var slow := mk(q, "walk", o + Vector3(3, 0, 0), 0.0, {"pace_scale": 0.5, "face_arrow": false})
	var timed := mk(q, "walk", o + Vector3(3, 0, 4), 0.0, {"take_secs": 6.0, "face_arrow": false})
	var fast := mk(q, "walk", o + Vector3(-5, 0, 4), 0.0, {"pace": "run", "face_arrow": false})
	var at := {}
	var clock := [0.0]
	npc.marker_started.connect(func(m): at[m] = clock[0])
	go(npc)
	await frames(4)
	var run: HSNpcRunner = npc.runner
	var speeds := {slow: [], timed: [], fast: []}
	var clips := {}
	var last := [her.global_position]
	var each := func() -> void:
		clock[0] += 1.0 / 60.0
		if run.cur != null and run.phase == "run" and speeds.has(run.cur):
			(speeds[run.cur] as Array).append(flat(her.global_position).distance_to(flat(last[0])) * 60.0)
			clips[run.cur] = run.body.now
		last[0] = her.global_position
	await watch(func(): return run.finished, 40.0, each)
	var mid := func(list: Array) -> float:
		list.sort()
		return list[list.size() / 2] if not list.is_empty() else 0.0
	var walk := run.body.pace(false)
	var s1: float = mid.call(speeds[slow])
	ok(absf(s1 - 0.5 * walk) < 0.07, "I: a walk at half her pace goes at half her speed", "%.2f m/s, her walk %.2f" % [s1, walk])
	var t2: float = float(at.get(fast, 0.0)) - float(at.get(timed, 0.0))
	ok(absf(t2 - 6.0) < 0.7, "I: 'take 6 s' takes 6 s", "%.1f s for 4 m" % t2)
	var s3: float = mid.call(speeds[fast])
	ok(absf(s3 - run.body.pace(true)) < 0.12 * run.body.pace(true) and clips.get(fast) == "run" or clips.get(fast) == "turn", "I: Run runs at her run's speed", "%.2f m/s, her run %.2f, %s" % [s3, run.body.pace(true), clips.get(fast)])
	var ends := (HSNpcFlow.end_of(fast, {"pos": o + Vector3(3, 0, 4), "yaw": 0.0}) as Dictionary)
	ok(ang(yaw_of(her), rad_to_deg(float(ends["yaw"]))) < 3.0 and ang(yaw_of(her), -90.0) < 3.0, "I: with no arrow to turn to she ends facing the way she came", "%.0f deg" % yaw_of(her))
	npc.queue_free()
	her.queue_free()


# J. stairs: her height from the steps under the path, eased; the floor above never taken for hers
func stage_stairs() -> void:
	var o := origin()
	var rise := 0.18
	var going := 0.28
	for i in 6:
		box(o + Vector3(2.0 + going * i + going * 0.5, rise * (i + 1) * 0.5, 0), Vector3(going, rise * (i + 1), 1.4), "Step%d" % i)
	var top := rise * 6
	box(o + Vector3(2.0 + going * 6 + 1.5, top - 0.05, 0), Vector3(3.0, 0.1, 1.4), "Landing")
	box(o + Vector3(3.5, 3.05, 0), Vector3(9.0, 0.1, 3.0), "FloorAbove")
	var her := woman(o, "HerJ")
	var npc := new_npc(her, "Joy")
	var q := quest(npc, "One")
	var up := mk(q, "walk", o + Vector3(2.0 + going * 6 + 1.5, top, 0), 90.0, {"smooth": false})
	bend(up, o + Vector3(2.0, 0, 0))
	bend(up, o + Vector3(2.0 + going * 6, top, 0))
	var down := mk(q, "walk", o, -90.0, {"smooth": false})
	bend(down, o + Vector3(2.0 + going * 6, top, 0))
	bend(down, o + Vector3(2.0, 0, 0))
	go(npc)
	await frames(4)
	var run: HSNpcRunner = npc.runner
	var surface := func(x: float) -> float:
		var d := x - (o.x + 2.0)
		if d < 0.0:
			return 0.0
		return minf(top, rise * (floor(d / going) + 1.0))
	var last := [her.global_position.y]
	var worst_step := [0.0]
	var back := [0.0]
	var under := [0.0]
	var highest := [0.0]
	var each := func() -> void:
		var y := her.global_position.y
		if absf(y - last[0]) > 0.035:
			say("J: (a step of %.3f m at x %.2f, %s, the path %s)" % [y - last[0], her.global_position.x - o.x, run.status(), str(run.body._step.get("s", -1))])
		worst_step[0] = maxf(worst_step[0], absf(y - last[0]))
		back[0] = maxf(back[0], last[0] - y)
		under[0] = maxf(under[0], float(surface.call(her.global_position.x)) - y)
		highest[0] = maxf(highest[0], y)
		last[0] = y
	await watch(func(): return run.cur == down, 20.0, each)
	ok(absf(her.global_position.y - top) < 0.02, "J: she climbs the stair to the landing", "%.2f m up, the landing %.2f" % [her.global_position.y, top])
	ok(worst_step[0] < 0.035 and back[0] < 0.002, "J: gliding over each riser, never dropping on the way up", "%.3f m in a frame at the most" % worst_step[0])
	ok(under[0] < 0.14, "J: never more than a riser's ease under a step", "%.2f m under at the most" % under[0])
	ok(highest[0] < top + 0.05, "J: the floor above isn't taken for hers", "%.2f m at the highest" % highest[0])
	worst_step[0] = 0.0
	await watch(func(): return run.finished, 20.0, each)
	ok(absf(her.global_position.y) < 0.02 and worst_step[0] < 0.035, "J: and back down the same way", "%.2f m up, %.3f m a frame" % [her.global_position.y, worst_step[0]])
	npc.queue_free()
	her.queue_free()


func shape(n: Node3D, nm: String) -> float:
	var mi := n.get_node("Face") as MeshInstance3D
	return mi.get_blend_shape_value(mi.find_blend_shape_by_name(nm))


# K. faces: worn and kept, by flag while she's at a marker, for a line; and a character with no clips still gets there
func stage_faces() -> void:
	var o := origin()
	var her := standin(o, "HerK")
	var npc := new_npc(her, "Kim")
	var q := quest(npc, "One")
	mk(q, "wait", Vector3.ZERO, 0.0, {"face": "smile", "stay": "secs", "stay_secs": 0.8})
	var by := mk(q, "wait", Vector3.ZERO, 0.0, {"face_rules": PackedStringArray(["gift_k => smile", "=> sad"]), "stay": "next"})
	var after := mk(q, "walk", o + Vector3(2, 0, 0), 0.0, {"start_when": "go_k"})
	var neutral := mk(q, "event", Vector3.ZERO, 0.0, {"face": "neutral", "start_when": "calm_k"})
	go(npc)
	await secs(0.6)
	var run: HSNpcRunner = npc.runner
	ok(run.face.has_shapes() and shape(her, "lipCornerPuller_L") > 0.6 and shape(her, "cheekRaiser_L") > 0.3, "K: a marker's face is worn", "her lip corners %.2f" % shape(her, "lipCornerPuller_L"))
	await until(func(): return run.at == by, 2.0)
	await secs(0.8)
	ok(shape(her, "lipCornerDepressor_L") > 0.5 and shape(her, "lipCornerPuller_L") < 0.05, "K: by flag: none on, the 'otherwise' face", "sad %.2f, smile %.2f" % [shape(her, "lipCornerDepressor_L"), shape(her, "lipCornerPuller_L")])
	story.flag("gift_k")
	await secs(0.8)
	ok(shape(her, "lipCornerPuller_L") > 0.6 and shape(her, "lipCornerDepressor_L") < 0.05, "K: the flag on, the face it names", "smile %.2f, sad %.2f" % [shape(her, "lipCornerPuller_L"), shape(her, "lipCornerDepressor_L")])
	story.flag("go_k")
	await until(func(): return run.cur == neutral, 6.0)
	ok(flat(her.global_position).distance_to(flat(o + Vector3(2, 0, 0))) < 0.05, "K: someone with no animations still gets where she's sent (she slides)", str(run.body.problems))
	ok(shape(her, "lipCornerPuller_L") > 0.6, "K: her face is carried to the markers after")
	story.flag("calm_k")
	await secs(0.8)
	ok(shape(her, "lipCornerPuller_L") < 0.02, "K: until one says neutral")
	# a face clip as the Face page exports it (res://faces/<id>.tres), read as text
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://faces"))
	var f := FileAccess.open("res://faces/test_gasp.tres", FileAccess.WRITE)
	f.store_string("[gd_resource type=\"Resource\" script_class=\"HSFaceClip\" load_steps=2 format=3]\n\n[ext_resource type=\"Script\" path=\"res://addons/horrorstudio/face_clip.gd\" id=\"1_face\"]\n\n[resource]\nscript = ExtResource(\"1_face\")\nid = \"test_gasp\"\ntitle = \"Gasp\"\nloop = false\nsecs = 1.0\nfps = 2.0\nframes = 3\nshapes = PackedStringArray(\"jawDrop\", \"innerBrowRaiser_L\")\nweights = PackedFloat32Array(0, 0, 0.8, 0.4, 0.2, 1)\n")
	f.close()
	ok("clip:test_gasp" in HSNpcFace.names(), "K: a face clip in res://faces is on the list", str(HSNpcFace.names().size()))
	run.face.wear("clip:test_gasp", 1.0, 0.1)
	await secs(0.5)
	var half := shape(her, "jawDrop")
	await secs(1.2)
	ok(absf(half - 0.8) < 0.12 and absf(shape(her, "jawDrop") - 0.2) < 0.05 and absf(shape(her, "innerBrowRaiser_L") - 1.0) < 0.05, "K: and plays on her face, holding its last frame",
		"her jaw %.2f half a second in, %.2f at the end" % [half, shape(her, "jawDrop")])
	npc.queue_free()
	her.queue_free()


# L. looks: a skin, then eyes with the skin kept, then her own again (the look plugin's switch under her)
func stage_looks() -> void:
	var o := origin()
	var her := woman(o, "HerL")
	var npc := new_npc(her, "Lou")
	var q := quest(npc, "One")
	mk(q, "event", Vector3.ZERO, 0.0, {"look_skin": "chrome", "look_secs": 0.2})
	mk(q, "event", Vector3.ZERO, 0.0, {"look_eyes": "glow", "look_eye_color": Color(1, 0, 0), "look_secs": 0.2, "start_when": "eyes_l"})
	mk(q, "event", Vector3.ZERO, 0.0, {"look_skin": "default", "look_eyes": "default", "look_secs": 0.2, "start_when": "own_l"})
	go(npc)
	await secs(0.8)
	var sw := her.get_node_or_null("HSLookSwitch")
	ok(sw != null, "L: a marker with a look puts a look switch under her")
	if sw != null:
		var w: Dictionary = sw.call("wearing")
		ok(str(w.get("skin")) == "chrome", "L: a marker's skin is worn", str(w.get("skin")))
		story.flag("eyes_l")
		await secs(0.8)
		w = sw.call("wearing")
		ok(str(w.get("skin")) == "chrome" and str(w.get("eyes")) == "glow", "L: eyes on a later marker: the skin is kept", "%s, %s" % [w.get("skin"), w.get("eyes")])
		story.flag("own_l")
		await secs(0.8)
		w = sw.call("wearing")
		ok(str(w.get("skin")) == "default" and str(w.get("eyes")) == "default", "L: and 'default' is her own again", "%s, %s" % [w.get("skin"), w.get("eyes")])
	npc.queue_free()
	her.queue_free()


const REACT := "extends Node\nsignal hit(info)\nsignal down\nvar is_down := false\nvar restored := 0\nfunc go_down() -> void:\n\tis_down = true\n\tget_parent().visible = false\n\tdown.emit()\nfunc restore() -> void:\n\tis_down = false\n\trestored += 1\n\tget_parent().visible = true\n"


func shootable(at: Vector3, nm: String) -> Array:
	var her := standin(at, nm, false)
	var r := Node.new()
	r.name = "React"
	r.set_script(made(REACT))
	her.add_child(r)
	return [her, r]


# M. shot: the flags; her quest stops (and only a quest that asks comes next), gone for good, can't be killed
func stage_shot() -> void:
	var o := origin()
	var pair := shootable(o, "HerM")
	var her: Node3D = pair[0]
	var react: Node = pair[1]
	var npc := new_npc(her, "Mia")
	var q1 := quest(npc, "One")
	mk(q1, "walk", o + Vector3(8, 0, 0), 0.0)
	var q2 := quest(npc, "Two")
	mk(q2, "walk", o + Vector3(0, 0, 5), 0.0)
	var q3 := quest(npc, "Three", "down:mia, later_m")
	mk(q3, "appear", o + Vector3(-3, 0, 0), 0.0)
	go(npc)
	await secs(1.0)
	var run: HSNpcRunner = npc.runner
	react.emit_signal("hit", {})
	await frames(3)
	ok(story.is_set("shot:mia") and run.shot and run.body.busy, "M: a hit sets shot:mia; she goes on")
	react.call("go_down")
	await frames(3)
	var where := her.global_position
	ok(story.is_set("down:mia") and run.down, "M: shot down sets down:mia")
	await secs(1.5)
	ok(her.global_position.distance_to(where) < 0.01 and run.qi == 0, "M: her quest stops where she fell", run.status())
	ok(int(react.get("restored")) == 0, "M: and the next quest in order doesn't start by itself (those markers are skipped)")
	story.flag("later_m")
	await until(func(): return run.qi == 2, 1.0)
	await frames(5)
	ok(run.qi == 2 and int(react.get("restored")) == 1 and her.visible and flat(her.global_position).distance_to(flat(o + Vector3(-3, 0, 0))) < 0.05, "M: a later quest that asks for it brings her back", run.status())
	npc.queue_free()
	her.queue_free()
	# gone for good
	var o2 := origin()
	pair = shootable(o2, "HerM2")
	her = pair[0]
	react = pair[1]
	npc = new_npc(her, "Moe", {"when_shot_down": 1})
	q1 = quest(npc, "One")
	mk(q1, "walk", o2 + Vector3(8, 0, 0), 0.0)
	q2 = quest(npc, "Two", "more_m")
	mk(q2, "appear", o2 + Vector3(-3, 0, 0), 0.0)
	go(npc)
	await secs(0.8)
	run = npc.runner
	react.call("go_down")
	story.flag("more_m")
	await secs(1.0)
	ok(run.dead and run.qi == 0 and not her.visible, "M: gone for good: nothing of hers runs again", run.status())
	npc.queue_free()
	her.queue_free()
	# can't be killed
	var o3 := origin()
	pair = shootable(o3, "HerM3")
	her = pair[0]
	react = pair[1]
	npc = new_npc(her, "Max", {"when_shot_down": 2, "back_up_secs": 1.0})
	q1 = quest(npc, "One")
	mk(q1, "walk", o3 + Vector3(4, 0, 0), 0.0)
	go(npc)
	await secs(0.8)
	run = npc.runner
	react.call("go_down")
	await secs(0.5)
	where = her.global_position
	ok(run.down and not her.visible, "M: can't be killed: down for a while")
	await until(func(): return run.finished, 12.0)
	ok(int(react.get("restored")) == 1 and her.visible and flat(her.global_position).distance_to(flat(o3 + Vector3(4, 0, 0))) < 0.05 and story.is_set("down:max"), "M: then up again and on to the end; down:max remembers",
		"restored %d" % int(react.get("restored")))
	npc.queue_free()
	her.queue_free()


# N. a checkpoint: where she was in her markers comes back with the Story's flags
func stage_checkpoint() -> void:
	var o := origin()
	var her := woman(o, "HerN")
	var npc := new_npc(her, "Nan")
	var q := quest(npc, "One")
	mk(q, "walk", o + Vector3(2, 0, 0), 0.0)
	var m2 := mk(q, "walk", o + Vector3(2, 0, 3), 0.0, {"start_when": "go_n", "face": "smile"})
	mk(q, "sit", o + Vector3(0, 0.45, 3), 0.0)
	go(npc)
	put(o + Vector3(6, 0.1, 6))
	await frames(4)
	var run: HSNpcRunner = npc.runner
	await until(func(): return run.cur == m2 and run.phase == "gate", 8.0)
	story.set("death_secs", 0.4)
	story.call("checkpoint")
	story.flag("go_n")
	await until(func(): return run.finished, 15.0)
	ok(run.body.posture == "sitting", "N: (she went on and sat down)")
	story.call("die", "test")
	await until(func(): return not bool(story.get("dead")), 4.0)
	await frames(5)
	ok(not story.is_set("go_n"), "N: (the Story put its flags back)")
	ok(run.cur == m2 and run.phase == "gate" and run.body.posture == "standing" and flat(her.global_position).distance_to(flat(o + Vector3(2, 0, 0))) < 0.05, "N: revived, she's where she was at the checkpoint, before the same marker", run.status())
	story.flag("go_n")
	await until(func(): return run.finished, 15.0)
	ok(run.body.posture == "sitting", "N: and plays on from there")
	npc.queue_free()
	her.queue_free()
	put(Vector3(20, 0.1, 20))


# O. an Event: things fired, a task ticked and one added, a line, a scare; let go of, and taken back
func stage_event() -> void:
	var o := origin()
	var her := woman(o, "HerO")
	var target := Node.new()
	target.name = "Scare"
	target.set_script(made("extends Node\nvar fired := 0\nfunc fire(_a = null, _b = null) -> void:\n\tfired += 1\n"))
	main.add_child(target)
	story.add_task("chore_o", "Do the chore.")
	var npc := new_npc(her, "Ola")
	var q := quest(npc, "One")
	var ev := mk(q, "event", Vector3.ZERO, 0.0, {"say": "Did you hear that?", "scare": true, "tick": "chore_o", "add_tasks": PackedStringArray(["extra_o: One more thing."]), "set_flags": "+ev_o"})
	var free := mk(q, "event", Vector3.ZERO, 0.0, {"let_go": true})
	var take := mk(q, "walk", o + Vector3(0, 0, 3), 0.0, {"start_when": "take_o"})
	var scares := [0]
	npc.scared.connect(func(): scares[0] += 1)
	go(npc)
	ev.fire = [ev.get_path_to(target)] as Array[NodePath]
	await secs(0.5)
	var run: HSNpcRunner = npc.runner
	ok(int(target.get("fired")) == 1, "O: an Event fires what it names")
	ok(scares[0] == 1 and npc.is_in_group("hs_scare"), "O: a scare is one the Fear node hears")
	ok(story.done("chore_o") and story.has_task("extra_o") and story.is_set("ev_o"), "O: it ticks a task, adds one, switches flags")
	ok((story.get("_line") as Label).text == "Did you hear that?", "O: and says its line")
	ok(run.body.released, "O: 'let go of her': her body is left alone")
	her.global_position = o + Vector3(3, 0, 0)
	await secs(0.5)
	ok(her.global_position.distance_to(o + Vector3(3, 0, 0)) < 0.01, "O: so another script can move her")
	story.flag("take_o")
	await until(func(): return run.finished, 10.0)
	ok(not run.body.released and flat(her.global_position).distance_to(flat(o + Vector3(0, 0, 3))) < 0.05, "O: her next marker takes her back, from where she was left")
	npc.queue_free()
	her.queue_free()
	target.queue_free()


# P. you: she comes to you and stops short; you in her way, she waits a moment and passes
func stage_you() -> void:
	var o := origin()
	var her := woman(o, "HerP")
	var npc := new_npc(her, "Pam")
	var q := quest(npc, "One")
	mk(q, "walk", Vector3.ZERO, 0.0, {"to_player": true, "stop_short": 1.0})
	var past := mk(q, "walk", o + Vector3(0, 0, 8), 0.0, {"start_when": "pass_p"})
	put(o + Vector3(5, 0.1, 0))
	go(npc)
	await secs(1.5)
	var run: HSNpcRunner = npc.runner
	put(o + Vector3(5, 0.1, 3))
	await until(func(): return run.cur == past, 12.0)
	var gap := flat(her.global_position).distance_to(flat(player.global_position))
	ok(gap > 0.9 and gap < 1.15, "P: 'to you' follows you and stops short", "%.2f m from you" % gap)
	put(o + Vector3(5, 0.1, 6))
	var est := HSNpcFlow.seconds_of(past, her.global_position, run.body.pace(false), run.body.pace(true))
	story.flag("pass_p")
	# her path to the pin: you stand on it
	await until(func(): return run.phase == "run", 1.0)
	var mid_pt := her.global_position.lerp(o + Vector3(0, 0, 8), 0.5)
	put(Vector3(mid_pt.x, 0.1, mid_pt.z))
	var t := [0.0]
	var stopped := [0.0]
	var last := [her.global_position]
	await watch(func(): return run.finished, 25.0, func():
		t[0] += 1.0 / 60.0
		if flat(her.global_position).distance_to(flat(last[0])) < 0.0005 and run.phase == "run":
			stopped[0] += 1.0 / 60.0
		last[0] = her.global_position)
	ok(stopped[0] > 2.0 and stopped[0] < 3.2, "P: you in her way: she waits a moment", "%.1f s" % stopped[0])
	ok(run.finished and flat(her.global_position).distance_to(flat(o + Vector3(0, 0, 8))) < 0.05 and t[0] < est + 4.0, "P: then passes and gets there", "%.1f s, %.1f with nobody in the way" % [t[0], est])
	npc.queue_free()
	her.queue_free()
	put(Vector3(20, 0.1, 20))


# R. Problems: what can never work is said, at its marker
func stage_problems() -> void:
	var o := origin()
	var her := woman(o, "HerR")
	var npc := new_npc(her, "Roy")
	var q := quest(npc, "One", "never_set_r")
	var stay := mk(q, "wait", Vector3.ZERO, 0.0, {"stay": "talked"})
	var pick := mk(q, "grab", o + Vector3(1, 1, 0), 0.0, {"action": "pick_up"})
	var anim := mk(q, "animation", Vector3.ZERO, 0.0, {"clip": "moonwalk"})
	var c := mk(q, "choice")
	var w1 := way(c, "")
	var w2 := way(c, "flag_r")
	mk(q, "disappear")
	var far := mk(q, "sit", o + Vector3(6, 0.45, 6), 0.0)
	var rep := mk(q, "repeat")
	mk(rep, "event")
	mk(q, "event", Vector3.ZERO, 0.0, {"start_when": "@nonsense"})
	mk(q, "wait", Vector3.ZERO, 0.0, {"talk": true, "talks": [{"lines": ["Roy: Which?"], "answers": [{"text": "One"}, {"text": "Two"}, {"text": "Three"}]}]})
	main.add_child(npc)
	npc.set_physics_process(false)
	npc.character = npc.get_path_to(her)
	var found := HSNpcFlow.problems(npc, HSNpcBody.clips_of(her), HSNpcFlow.flags_set(main), HSNpcFlow.tasks_known(main))
	var texts := ""
	for p in found:
		texts += str(p["text"]) + "\n"
	for need in [["nothing in the scene turns it on", "a flag nothing sets"], ["has nothing to say", "staying until a talk with no conversation"], ["pick the thing", "a Pick up with nothing to pick"],
			["no animation called 'moonwalk'", "a clip she hasn't got"], ["Move it last", "a way after 'otherwise'"], ["comes back where they vanished", "a body marker after Disappear"],
			["Put a Walk marker before it", "a Sit far from where she'll be"], ["never ends", "a Repeat with no end before other markers"], ["isn't a word it knows", "a word that isn't one"],
			["3 answers to one question", "more than two answers"]]:
		ok(texts.contains(need[0]), "R: Problems says: " + need[1])
	var at_marker := 0
	for p in found:
		if p["node"] in [stay, pick, anim, w1, far, rep]:
			at_marker += 1
	ok(at_marker >= 6, "R: each at its marker", "%d of them" % at_marker)
	var none := new_npc(her, "Nobody")
	main.add_child(none)
	none.set_physics_process(false)
	ok(str(HSNpcFlow.problems(none)).contains("No character yet"), "R: and an HSNpc with no character")
	ok(HSNpcFlow.label_of(far) == "6" and HSNpcFlow.board(q).size() == 12, "R: the storyboard numbers them", "%s, %d rows" % [HSNpcFlow.label_of(far), HSNpcFlow.board(q).size()])
	npc.queue_free()
	none.queue_free()
	her.queue_free()


# S. the tester's runner: a copy of her put where the markers before leave her, one marker played, nothing set or fired
func stage_tester() -> void:
	var o := origin()
	var her := woman(o, "HerS")
	var npc := new_npc(her, "Sue")
	var q := quest(npc, "One")
	mk(q, "walk", o + Vector3(3, 0, 0), 0.0)
	mk(q, "sit", o + Vector3(3, 0.45, 1.0), 0.0, {"stay": "talked", "talk": true, "talks": [{"lines": ["Sue: Hm."]}]})
	var c := mk(q, "choice")
	var wa := way(c, "s_a")
	mk(wa, "walk", o + Vector3(6, 0, 0), 0.0)
	var wb := way(c, "s_b")
	var target := mk(wb, "walk", o + Vector3(0, 0, 4), 180.0, {"start_when": "never_s", "set_flags": "+prev_s", "say": "Off I go."})
	mk(wb, "wait", Vector3.ZERO, 0.0, {"stay": "secs", "stay_secs": 0.3})
	main.add_child(npc)
	npc.set_physics_process(false)                             # (the game's own runner isn't started: only the tester's)
	npc.character = npc.get_path_to(her)
	var ghost := her.duplicate() as Node3D
	ghost.name = "_Ghost"
	main.add_child(ghost)
	var notes := []
	var r := HSNpcRunner.new()
	r.on_note = func(t): notes.append(t)
	r.begin(npc, ghost, true)
	r.jump_to(target, true)
	var st := HSNpcFlow.stand_for(q.get_child(1) as HSNpcMarker, r.body.record)
	ok(flat(ghost.global_position).distance_to(flat(st["pos"])) < 0.05 and r.body.posture == "sitting", "S: the copy starts as the markers before leave her (sat at the seat)",
		"%.2f m off, %s" % [flat(ghost.global_position).distance_to(flat(st["pos"])), r.body.posture])
	r.stop_after = target
	var n := [0]
	await watch(func(): return r.over, 20.0, func(): r.tick(1.0 / 60.0); n[0] += 1)
	ok(r.over and flat(ghost.global_position).distance_to(flat(o + Vector3(0, 0, 4))) < 0.05 and ang(yaw_of(ghost), 180.0) < 2.0, "S: 'Try it' plays that marker on the copy and stops", "%.1f s" % (n[0] / 60.0))
	ok(flat(her.global_position).distance_to(flat(o)) < 0.001 and not story.is_set("prev_s"), "S: the real one isn't touched and no flag is set")
	ok(str(notes).contains("waits for: never_s") and str(notes).contains("flags: +prev_s") and str(notes).contains("says: Off I go."), "S: what would happen is noted", str(notes))
	var r2 := HSNpcRunner.new()
	r2.picks = {c: 0}
	r2.begin(npc, ghost, true)
	r2.jump_to(q.get_child(0) as HSNpcMarker, true)
	n[0] = 0
	await watch(func(): return r2.over, 40.0, func(): r2.tick(1.0 / 60.0); n[0] += 1)
	ok(r2.over and flat(ghost.global_position).distance_to(flat(o + Vector3(6, 0, 0))) < 0.05, "S: 'From here' plays to the quest's end, the Choice's way as picked", "%.1f s" % (n[0] / 60.0))
	ghost.queue_free()
	npc.queue_free()
	her.queue_free()


# S. animations v3 (docs/ANIMATOR_V3.md): the low paces and what she rests in, her head following you and carried on,
# eating a thing by its grip, an attack that lands on you, a jump scare from one marker
func probe(her: Node3D, bone: String) -> BoneAttachment3D:      # a bone as it is after the modifiers (a skeleton rolls them back after each frame)
	var sk := her.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	var a := sk.get_node_or_null("_Probe_" + bone) as BoneAttachment3D
	if a == null:
		a = BoneAttachment3D.new()
		a.name = "_Probe_" + bone
		sk.add_child(a)
		a.bone_name = bone
	return a


func stage_v3() -> void:
	const LOOKP := "res://addons/horrorstudio_look/"
	if not ResourceLoader.exists(LOOKP + "hand_ik.gd"):
		bad("S: the look plugin's hand_ik.gd isn't in the project")
		return
	# ---- the low paces ----
	var o := origin()
	var her := woman(o, "HerS")
	var npc := new_npc(her, "Sam")
	var q := quest(npc, "One")
	var sneak := mk(q, "walk", o + Vector3(0, 0, 2.0), 0.0, {"pace": "sneak", "face_arrow": false})
	var w1 := mk(q, "wait", Vector3.ZERO, 0.0, {"stay": "secs", "stay_secs": 0.9})
	var crawl := mk(q, "walk", o + Vector3(0, 0, 3.6), 0.0, {"pace": "crawl", "face_arrow": false})
	var w2 := mk(q, "wait", Vector3.ZERO, 0.0, {"stay": "secs", "stay_secs": 0.9})
	var up := mk(q, "walk", o + Vector3(1.6, 0, 3.6), 0.0, {"face_arrow": false})
	put(o + Vector3(8, 0, 8))
	go(npc)
	await frames(4)
	var run: HSNpcRunner = npc.runner
	var speeds := {sneak: [], crawl: []}
	var doing := {}
	var last := [her.global_position]
	var each := func() -> void:
		if run.cur != null and run.phase == "run" and speeds.has(run.cur):
			(speeds[run.cur] as Array).append(flat(her.global_position).distance_to(flat(last[0])) * 60.0)
			doing[run.cur] = run.body.now
		elif run.cur != null and run.phase == "stay":
			doing[run.cur] = run.body.now
		last[0] = her.global_position
	await watch(func(): return run.finished, 40.0, each)
	await frames(20)
	var mid := func(list: Array) -> float:
		list.sort()
		return list[list.size() / 2] if not list.is_empty() else 0.0
	var vs: float = mid.call(speeds[sneak])
	var vc: float = mid.call(speeds[crawl])
	ok(absf(vs - run.body.gait_pace("sneak")) < 0.07 and doing.get(sneak) in ["sneak", "turn"] and vs < 0.6 * run.body.pace(false), "S: a Walk at a sneak goes at her sneak's own speed", "%.2f m/s (made at %.2f; her walk %.2f)" % [vs, run.body.gait_pace("sneak"), run.body.pace(false)])
	ok(absf(vc - run.body.gait_pace("crawl")) < 0.07 and doing.get(crawl) in ["crawl", "turn"], "S: and at a crawl at her crawl's", "%.2f m/s (made at %.2f)" % [vc, run.body.gait_pace("crawl")])
	ok(doing.get(w1) == "crouch_loop" and doing.get(w2) == "crawl_idle_loop", "S: she waits low where a low pace left her: crouched after the sneak, on all fours after the crawl", "%s, %s" % [doing.get(w1), doing.get(w2)])
	ok(run.body.hold_clip == "" and run.body.now == "idle", "S: a plain Walk after stands her up again", "resting in '%s', doing '%s'" % [run.body.hold_clip, run.body.now])
	ok(absf(HSNpcFlow.seconds_of(sneak, o) - (2.0 / 0.42 + 0.45)) < 0.2 and sneak.title() == "Sneak" and crawl.title() == "Crawl", "S: the tab's time for a sneak is a sneak's", "%.1f s for 2 m" % HSNpcFlow.seconds_of(sneak, o))
	var probs := HSNpcFlow.problems(npc, PackedStringArray(["idle_loop", "walk_loop"]), null, null).filter(func(p): return "no 'sneak'" in String(p["text"]))
	ok(probs.size() == 1, "S: Problems says when she has no sneak of her own", str(probs.size()))
	npc.queue_free()
	her.queue_free()
	# ---- her head follows you, from a marker on ----
	o = origin()
	her = woman(o, "HerS2")
	npc = new_npc(her, "Sal")
	q = quest(npc, "One")
	mk(q, "appear", o, 0.0)
	var h1 := mk(q, "wait", Vector3.ZERO, 0.0, {"stay": "secs", "stay_secs": 2.2, "head": "follow", "head_range": 160.0})
	var h2 := mk(q, "wait", Vector3.ZERO, 0.0, {"stay": "secs", "stay_secs": 1.6})
	var h3 := mk(q, "event", Vector3.ZERO, 0.0, {"head": "free"})
	var h4 := mk(q, "wait", Vector3.ZERO, 0.0, {"stay": "secs", "stay_secs": 1.6})
	var a50 := deg_to_rad(50.0)
	put(o + Vector3(sin(a50), 0, cos(a50)) * 2.2)
	go(npc)
	await frames(4)
	run = npc.runner
	var head := probe(her, "c_head")
	var facing := func() -> float:
		var f := her.global_basis.inverse() * head.global_basis.z
		return rad_to_deg(atan2(f.x, f.z))
	var bearing := func() -> float:
		var d := her.global_basis.inverse() * (eye.global_position - head.global_position)
		return rad_to_deg(atan2(d.x, d.z))
	var seen := {}
	var kept := [{}]                                     # (a lambda takes a local by value: what it sets goes in a holder)
	await watch(func(): return run.finished, 20.0, func() -> void:
		if run.cur != null:
			seen[run.cur] = [facing.call(), bearing.call()]
			if run.cur == h2 and (kept[0] as Dictionary).is_empty() and run.phase == "stay":
				kept[0] = run.snapshot())
	var snap: Dictionary = kept[0]
	await frames(40)
	var free_now: float = facing.call()
	ok(absf(float(seen[h1][0]) - float(seen[h1][1])) < 4.0 and float(seen[h1][1]) > 35.0, "S: 'Her head follows you' on a marker: you 50 degrees to her left, her head is turned to you", "%.1f degrees (you're at %.1f)" % seen[h1])
	ok(absf(float(seen[h2][0]) - float(seen[h2][1])) < 4.0, "S: it's carried on to the next marker", "%.1f" % seen[h2][0])
	ok(absf(free_now) < 6.0 and not bool((run.snapshot()["head"] as Dictionary).get("on", true)), "S: 'the animation's again' lets it go", "%.1f degrees" % free_now)
	ok(bool((snap.get("head", {}) as Dictionary).get("on", false)) and absf(float(snap["head"]["range"]) - 160.0) < 0.01, "S: a checkpoint keeps it", str(snap.get("head", {})))
	run.restore(snap)
	await frames(50)
	ok(absf(float(facing.call()) - float(bearing.call())) < 5.0, "S: and puts it back", "%.1f degrees (you're at %.1f)" % [facing.call(), bearing.call()])
	npc.queue_free()
	her.queue_free()
	# ---- eating a thing by its grip ----
	o = origin()
	her = woman(o, "HerS3")
	npc = new_npc(her, "Sue")
	q = quest(npc, "One")
	var apple := MeshInstance3D.new()
	apple.name = "Apple"
	var ball := SphereMesh.new()
	ball.radius = 0.035
	ball.height = 0.07
	apple.mesh = ball
	main.add_child(apple)
	apple.global_position = o + Vector3(0.9, 0.9, 0.9)
	var grip: Node3D = load(LOOKP + "grip.gd").new()
	grip.name = "Grip"
	apple.add_child(grip)
	grip.set("shape", 1)
	grip.set("size", 0.07)
	grip.set("use", 1)
	grip.set("mouth", Vector3(0, 0, -0.035))
	var eat := mk(q, "grab", apple.global_position, 45.0, {"action": "eat"})
	put(o + Vector3(8, 0, 8))
	go(npc)
	eat.target = eat.get_path_to(apple)
	await frames(4)
	run = npc.runner
	var nearest := [9.0]
	var held_it := [false]
	await watch(func(): return run.finished, 30.0, func() -> void:
		if run.body.held == apple:
			held_it[0] = true
			var ik: Node = run.body.ik()
			if ik != null and ik.last.has("r"):
				nearest[0] = minf(nearest[0], (apple.global_transform * Vector3(0, 0, -0.035)).distance_to(ik.last["r"]["target"])))
	await frames(20)
	ok(held_it[0] and nearest[0] < 0.03 and not apple.visible and run.body.held == null and eat.title() == "Eat", "S: a Grab that eats: the thing is taken by its grip, its bitten side brought to her lips, then it's gone", "%.1f cm from her lips at the nearest; shown %s" % [nearest[0] * 100.0, apple.visible])
	npc.queue_free()
	her.queue_free()
	apple.queue_free()
	# ---- an attack on you ----
	o = origin()
	her = woman(o, "HerS4")
	npc = new_npc(her, "Sid")
	q = quest(npc, "One")
	var atk := mk(q, "attack", Vector3.ZERO, 0.0, {"attack": "punch", "attack_times": 2})
	put(o + Vector3(0.6, 0, 2.6))
	look(o + Vector3(0, 1.5, 0))
	var blows := []
	npc.struck.connect(func(t: Node, k: String) -> void: blows.append([String(t.name), k]))
	go(npc)
	await frames(4)
	run = npc.runner
	var wrist := probe(her, "r_wrist")
	var close := [9.0]
	await watch(func(): return run.finished, 40.0, func() -> void:
		var ik: Node = run.body.ik()
		if ik != null:
			close[0] = minf(close[0], (wrist.global_transform * (ik.knuckles("r") as Vector3)).distance_to(eye.global_position)))
	var gap := flat(her.global_position).distance_to(flat(player.global_position))
	ok(blows == [["Player", "punch"], ["Player", "punch"]] and atk.title() == "Punch", "S: an Attack: she comes for you and both punches land", str(blows))
	ok(close[0] > 0.08 and close[0] < 0.4 and gap < 1.0 and gap > 0.4, "S: her fist stops short of your eye, from where a punch reaches", "%.0f cm from your eye, stood %.2f m from you" % [close[0] * 100.0, gap])
	npc.queue_free()
	her.queue_free()
	# ---- a jump scare from one marker ----
	o = origin()
	her = woman(o, "HerS5")
	npc = new_npc(her, "Sol")
	q = quest(npc, "One", "s_go")
	mk(q, "disappear")
	var q2 := quest(npc, "Scare", "s_scare")
	var js := mk(q2, "scare", o + Vector3(2, 0, 2), 0.0, {"scare_kind": "lunge", "face_player": true})    # (as its card makes it: turned to you)
	var after := mk(q2, "event", Vector3.ZERO, 0.0, {"set_flags": "+s_scared"})
	put(o + Vector3(3.2, 0, 2.6))
	look(o + Vector3(2, 1.4, 2))
	var heard := [0]
	npc.scared.connect(func() -> void: heard[0] += 1)
	go(npc)
	story.set_flag("s_go", true)
	await frames(30)
	var hidden_first := not her.visible
	story.set_flag("s_scare", true)
	var shown_for := [0]
	var first := {}
	await watch(func(): return HSNpcCond.holds("s_scared", self, null), 8.0, func() -> void:
		if her.visible:
			shown_for[0] += 1
			if first.is_empty():
				var to := player.global_position - her.global_position
				first["at"] = her.global_position
				first["off"] = ang(yaw_of(her), rad_to_deg(atan2(to.x, to.z)))
				first["doing"] = npc.runner.body.now)
	await frames(5)
	var info: Dictionary = npc.runner.body.scare_info("lunge")
	ok(hidden_first and not first.is_empty() and (first["at"] as Vector3).distance_to(o + Vector3(2, 0, 2)) < 0.05 and float(first["off"]) < 4.0 and first["doing"] == "scare_lunge",
		"S: a Jump scare marker: she appears at its pin turned to you, already lunging", "%.1f degrees off you, doing '%s'" % [first.get("off", 99.0), first.get("doing", "")])
	ok(absf(shown_for[0] / 60.0 - float(info.get("show", 0))) < 0.2 and not her.visible and heard[0] == 1 and js.title() == "Jump scare", "S: and is gone when it's been shown; the scare is heard once", "shown %.2f s (her lunge is shown %.2f), heard %d" % [shown_for[0] / 60.0, info.get("show", 0), heard[0]])
	ok(absf(HSNpcFlow.seconds_of(js, o) - 1.0) < 0.01 and (HSNpcFlow.end_of(js, {"pos": o, "yaw": 0.0})["pos"] as Vector3).distance_to(js.place()) < 0.01, "S: the tab knows where it leaves her and about how long it is")
	npc.queue_free()
	her.queue_free()
	# ---- what Problems says about them ----
	o = origin()
	her = woman(o, "HerS6")
	npc = new_npc(her, "Sy")
	q = quest(npc, "One")
	var p_eat := mk(q, "grab", o + Vector3(1, 0.9, 0), 0.0, {"action": "eat"})            # nothing named, nothing in her hand
	var p_atk := mk(q, "attack", Vector3.ZERO, 0.0, {"attack": "swing", "head": "follow"})
	var p_js := mk(q, "scare", o + Vector3(2, 0, 0), 0.0, {"scare_kind": "claw"})
	var q3 := quest(npc, "Two")
	var cup := Node3D.new()
	cup.name = "Cup"
	main.add_child(cup)
	var p_pick := mk(q3, "grab", o + Vector3(1, 0.9, 1), 0.0, {"action": "pick_up"})
	var p_drink := mk(q3, "grab", o + Vector3(1, 0.9, 1), 0.0, {"action": "drink"})        # nothing named: what she picked up
	var p_drink2 := mk(q3, "grab", o + Vector3(1, 0.9, 1), 0.0, {"action": "drink"})       # drunk from, it's still in her hand
	var p_eat2 := mk(q3, "grab", o + Vector3(1, 0.9, 1), 0.0, {"action": "eat"})           # eaten: gone
	var p_eat3 := mk(q3, "grab", o + Vector3(1, 0.9, 1), 0.0, {"action": "eat"})           # and nothing left for this one
	main.add_child(npc)
	npc.set_physics_process(false)
	npc.character = npc.get_path_to(her)
	p_pick.target = p_pick.get_path_to(cup)
	var said := func(list: Array, node: Node, words: String) -> bool:
		for pr in list:
			if pr["node"] == node and words in String(pr["text"]):
				return true
		return false
	var old_clips := HSNpcFlow.problems(npc, PackedStringArray(["idle_loop", "walk_loop"]), null, null)
	ok(said.call(old_clips, p_eat, "no 'eat'") and said.call(old_clips, p_atk, "no 'swing'") and said.call(old_clips, p_js, "no 'scare_claw'"),
		"S: Problems says which of the new clips a character baked before them lacks, at its marker", "eat, swing, scare_claw")
	var hers := HSNpcFlow.problems(npc, HSNpcBody.clips_of(her), null, null)
	ok(not said.call(hers, p_eat, "of her own") and not said.call(hers, p_atk, "of her own") and not said.call(hers, p_js, "of her own") and not said.call(hers, p_atk, "Look plugin"),
		"S: and nothing of the kind about one baked since, in a project with the Look plugin")
	ok(said.call(hers, p_eat, "hand is empty") and said.call(hers, p_eat3, "hand is empty") and not said.call(hers, p_drink, "hand is empty") and not said.call(hers, p_drink2, "hand is empty")
		and not said.call(hers, p_eat2, "hand is empty"), "S: an Eat with nothing named and an empty hand is pointed out; after a Pick up, or a Drink, it isn't; after an Eat it is again")
	p_atk.attack_at = NodePath("../../Nobody")
	p_js.head = "follow"
	p_js.head_at = NodePath("../../Nobody")
	var gone := HSNpcFlow.problems(npc, HSNpcBody.clips_of(her), null, null)
	ok(said.call(gone, p_atk, "pick who she attacks") and said.call(gone, p_js, "pick who her head follows"), "S: and an Attack or a head pointed at someone who isn't there")
	npc.queue_free()
	her.queue_free()
	cup.queue_free()
