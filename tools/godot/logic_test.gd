## LOGIC's playthrough (tools/godot/logic_check.py; docs/FLAGS.md): things with a Logic node and a character's markers
## tied by flags, built in code in a by-hand project and played headless (--fixed-fps 60). Prints `LOGIC <what> <how>`
## lines and `LOGIC result {errors}`, quits. `-- --only=a,b`: just those stages.
extends SceneTree

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var story: Node
var only: Array = []
var spot := 0


func say(what: String, how: String = "") -> void:
	print("LOGIC %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("LOGIC ERROR %s" % e)


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


func put(p: Vector3) -> void:
	player.global_position = p
	player.velocity = Vector3.ZERO


func look(p: Vector3) -> void:
	var from := eye.global_position
	var d := p - from
	player.rotation.y = atan2(-d.x, -d.z)
	player.set("pitch", atan2(d.y, Vector2(d.x, d.z).length()))
	eye.rotation.x = float(player.get("pitch"))


func origin() -> Vector3:
	spot += 1
	return Vector3(-36.0 + 12.0 * (spot % 6), 0, -30.0 + 12.0 * (spot / 6))


func wants(st: String) -> bool:
	return only.is_empty() or st in only


func line() -> String:
	var l := story.get("_line") as Label
	return l.text if l != null and l.visible else ""


# ---- building -----------------------------------------------------------------------------------------------------------------
# a box you can see and aim at, with a script on its root
func thing(nm: String, at: Vector3, script: String, size := Vector3(0.9, 2.0, 0.1), collider := true) -> Node3D:
	var n := Node3D.new()
	n.name = nm
	var mi := MeshInstance3D.new()
	mi.name = "Mesh"
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position.y = size.y * 0.5
	n.add_child(mi)
	if collider:
		var sb := StaticBody3D.new()
		sb.name = "Body"
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		cs.position.y = size.y * 0.5
		sb.add_child(cs)
		n.add_child(sb)
	if script != "":
		n.set_script(load(script))
	n.position = main.global_transform.affine_inverse() * at       # (before it's in the tree: a door keeps where it was shut)
	main.add_child(n)
	return n


func logic(under: Node, set: Dictionary) -> HSLogic:
	var l := HSLogic.new()
	l.name = "Logic"
	for k in set:
		l.set(k, set[k])
	under.add_child(l)
	return l


func standin(at: Vector3, nm: String) -> Node3D:
	var n := Node3D.new()
	n.name = nm
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.4, 1.7, 0.25)
	mi.mesh = bm
	mi.position.y = 0.85
	n.add_child(mi)
	main.add_child(n)
	n.global_position = at
	return n


func npc_for(her: Node3D, nm: String) -> HSNpc:
	var n := HSNpc.new()
	n.name = nm + " markers"
	n.npc_name = nm
	main.add_child(n)
	n.character = n.get_path_to(her)
	return n


func quest(npc: HSNpc, nm: String, when := "") -> HSNpcQuest:
	var q := HSNpcQuest.new()
	q.name = nm
	q.title = nm
	q.starts_when = when
	npc.add_child(q)
	return q


func mk(parent: Node, kind: String, at: Vector3, set: Dictionary = {}) -> HSNpcMarker:
	var m := HSNpcMarker.new()
	m.kind = kind
	for k in set:
		m.set(k, set[k])
	m.name = "%s%d" % [m.title(), parent.get_child_count() + 1]
	parent.add_child(m)
	m.global_position = at
	return m


func use_at(n: Node3D, h := 1.0) -> Node:
	look(n.global_position + Vector3(0, h, 0))
	await frames(3)
	return player.call("use")


# ---- A. a thing that works only when a flag is on -------------------------------------------------------------------------------
func stage_gate() -> void:
	var o := origin()
	var door := thing("DoorA", o, "res://starter/door.gd")
	var lg := logic(door, {"needs": "alex_gone", "locked_says": "Not while Alex is watching."})
	var refused := [0]
	lg.refused.connect(func() -> void: refused[0] += 1)
	put(o + Vector3(0, 0.1, 1.5))
	await frames(4)
	ok(player.has_method("logic_of") and player.call("logic_of", door) == [lg], "A: the player finds a thing's Logic")
	var hit: Node = await use_at(door)
	await frames(2)
	ok(hit == null and not bool(door.get("open")) and refused[0] == 1, "A: E on a door whose flag is off does nothing", "open %s refused %d" % [door.get("open"), refused[0]])
	ok(line() == "Not while Alex is watching.", "A: it says why", line())
	lg.locked_says = ""
	door.set("locked_says", "It won't budge.")
	await use_at(door)
	ok(line() == "It won't budge.", "A: with no line of its own, a door's Logic says the door's own", line())
	story.call("set_flag", "alex_gone")
	hit = await use_at(door)
	await frames(2)
	ok(hit == door and bool(door.get("open")), "A: the flag on, the same E opens it", str(hit))
	story.call("set_flag", "alex_gone", false)
	hit = await use_at(door)
	await frames(2)
	ok(hit == null and bool(door.get("open")), "A: the flag off again, it can't be used again (it stays as it was)")
	# a task and a thing carried, and a not
	var chest := thing("ChestA", o + Vector3(3, 0, 0), "res://starter/door.gd", Vector3(0.9, 0.9, 0.6))
	logic(chest, {"needs": "task:book, item:key, !alarm"})
	put(o + Vector3(3, 0.1, 1.6))
	hit = await use_at(chest, 0.5)
	ok(hit == null, "A: 'task:book, item:key, !alarm': nothing so yet, no use")
	story.call("tick", "book")
	story.call("give", "key")
	hit = await use_at(chest, 0.5)
	ok(hit == chest, "A: the task ticked and the key carried: used")
	story.call("set_flag", "alarm")
	hit = await use_at(chest, 0.5)
	ok(hit == null, "A: its 'not' flag on: no use")
	# a Logic somewhere else, pointed at the thing
	var crate := thing("CrateA", o + Vector3(-3, 0, 0), "res://starter/door.gd", Vector3(0.9, 0.9, 0.6))
	var far := HSLogic.new()
	far.name = "CrateLogic"
	far.needs = "crate_ok"
	main.add_child(far)
	far.thing = far.get_path_to(crate)
	put(o + Vector3(-3, 0.1, 1.6))
	hit = await use_at(crate, 0.5)
	ok(hit == null and HSLogic.of(crate) == [far], "A: a Logic elsewhere in the scene, pointed at the thing, is asked too")
	ok(not HSLogic.may_use(crate) and HSLogic.may_use(door.get_node("Mesh")), "A: may_use for a script of your own")
	# a door of an interior's export: no script until the interior gives it one, after its Logic is ready
	var doors := Node3D.new()
	doors.name = "doors"
	main.add_child(doors)
	var was_main := main
	main = doors
	var xdoor := thing("door_7", o + Vector3(6, 0, 0), "")
	var xl := logic(xdoor, {"needs": "x_ok", "on": "signal", "on_signal": "opened", "set_flags": "+x_opened"})
	main = was_main
	xdoor.set_script(load("res://starter/door.gd"))            # (as interior.gd does in its _ready)
	xdoor.call("setup")
	xdoor.set_process(true)
	put(o + Vector3(6, 0.1, 1.5))
	await secs(0.5)
	hit = await use_at(xdoor)
	ok(hit == null and line() == "Locked." and not bool(xdoor.get("open")), "A: an export's door given its script after its Logic was ready: the gate holds, with the door's own line", line())
	story.call("set_flag", "x_ok")
	await use_at(xdoor)
	await frames(4)
	ok(bool(xdoor.get("open")) and bool(story.call("is_set", "x_opened")) and xl.times == 1, "A: and its 'opened' is heard (the signal looked for again once the door has it)")
	# a mesh with no script at all: its Logic makes it something to use
	var button := thing("ButtonA", o + Vector3(0, 0, 4), "", Vector3(0.3, 0.3, 0.1), false)
	button.position.y = 1.0
	var bl := logic(button, {"needs": "power_a", "locked_says": "Dead.", "set_flags": "~lift_a", "once": false})
	put(o + Vector3(0, 0.1, 5.2))
	await frames(4)
	var reach := button.get_node_or_null("_LogicReach") as StaticBody3D
	ok(reach != null and reach.collision_layer == 2 and reach.collision_mask == 0, "A: a plain mesh with a Logic gets a box only E's aim finds")
	hit = await use_at(button, 0.15)
	ok(hit == reach and bl.times == 0 and line() == "Dead.", "A: E on it while its needs aren't so: its line, nothing else", line())
	story.call("set_flag", "power_a")
	await use_at(button, 0.15)
	ok(bl.times == 1 and bool(story.call("is_set", "lift_a")), "A: its needs so: E does its Then (a button that flips a flag)")
	await use_at(button, 0.15)
	ok(bl.times == 2 and not bool(story.call("is_set", "lift_a")), "A: and again (not a once)")


# ---- B. used, a signal, by itself: then --------------------------------------------------------------------------------------------
func stage_then() -> void:
	var o := origin()
	story.call("add_task", "find_key", "Find the key.")
	var key := thing("KeyB", o, "res://starter/pickup.gd", Vector3(0.2, 0.2, 0.2), false)
	key.set("item", "key_b")
	var lg := logic(key, {"set_flags": "+has_key_b, -searching_b", "tick": "find_key", "add_tasks": PackedStringArray(["cellar_b: Open the cellar."]), "say": "That's the cellar's."})
	story.call("set_flag", "searching_b")
	put(o + Vector3(0, 0.1, 1.2))
	await frames(4)
	var hit: Node = await use_at(key, 0.1)
	await frames(2)
	ok(hit == key and bool(story.call("has", "key_b")), "B: the pickup itself still works (the key's in the pocket)")
	ok(bool(story.call("is_set", "has_key_b")) and not bool(story.call("is_set", "searching_b")), "B: when it's used, its flags are switched (+one, -another)")
	ok(bool(story.call("done", "find_key")) and bool(story.call("has_task", "cellar_b")), "B: a task ticked, a task put on the list")
	ok(line() == "That's the cellar's." and lg.times == 1, "B: its line said (after the pickup's own)", line())
	# a signal: a door's `opened`
	var door := thing("DoorB", o + Vector3(3, 0, 0), "res://starter/door.gd")
	var dl := logic(door, {"on": "signal", "on_signal": "opened", "set_flags": "+cellar_open_b"})
	put(o + Vector3(3, 0.1, 1.5))
	await use_at(door)
	await frames(3)
	ok(bool(story.call("is_set", "cellar_open_b")) and dl.times == 1, "B: 'when it's opened' (the door's own signal): the flag on")
	story.call("set_flag", "cellar_open_b", false)
	await use_at(door)
	await frames(3)
	await use_at(door)
	await frames(3)
	ok(not bool(story.call("is_set", "cellar_open_b")) and dl.times == 1, "B: once: opened again, nothing more")
	var door2 := thing("DoorB2", o + Vector3(6, 0, 0), "res://starter/door.gd")
	var dl2 := logic(door2, {"on": "signal", "on_signal": "opened", "once": false, "needs": "armed_b", "set_flags": "~lamp_b"})
	put(o + Vector3(6, 0.1, 1.5))
	await use_at(door2)
	await frames(3)
	ok(not bool(door2.get("open")) and dl2.times == 0, "B: a signal's Logic with needs: the door doesn't open while they aren't so")
	story.call("set_flag", "armed_b")
	for i in 3:
		await use_at(door2)
		await frames(3)
	ok(dl2.times == 2 and not bool(story.call("is_set", "lamp_b")), "B: every time: opened twice, the flag flipped twice", "times %d" % dl2.times)
	# an area: only the player counts
	var area := Area3D.new()
	area.name = "AreaB"
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(2, 2, 2)
	cs.shape = bs
	cs.position.y = 1.0
	area.add_child(cs)
	main.add_child(area)
	area.global_position = o + Vector3(0, 0, -5)
	var al := logic(area, {"on": "signal", "on_signal": "body_entered", "set_flags": "+in_room_b"})
	var ball := RigidBody3D.new()
	var bcs := CollisionShape3D.new()
	bcs.shape = SphereShape3D.new()
	ball.add_child(bcs)
	main.add_child(ball)
	ball.global_position = o + Vector3(0, 1.0, -5)
	await frames(8)
	ok(al.times == 0, "B: something else in an area's box doesn't set it off")
	ball.queue_free()
	put(o + Vector3(0, 0.1, -5))
	await frames(8)
	ok(al.times == 1 and bool(story.call("is_set", "in_room_b")), "B: you walking into it does")
	# by itself, when its needs come to be so; things fired
	var fired := [0]
	var target := thing("LampB", o + Vector3(-3, 0, 0), "res://starter/flag_switch.gd", Vector3(0.2, 0.2, 0.2), false)
	target.set("flags", PackedStringArray(["+lamp_fired_b"]))
	var rule := HSLogic.new()
	rule.name = "RuleB"
	rule.on = "itself"
	rule.needs = "has_key_b, task:cellar_b"
	rule.set_flags = "+ready_b"
	rule.once = false
	main.add_child(rule)
	rule.fires = [rule.get_path_to(target)] as Array[NodePath]
	rule.done.connect(func() -> void: fired[0] += 1)
	await secs(0.4)
	ok(rule.times == 0, "B: 'by itself': not while one of its needs isn't so")
	story.call("tick", "cellar_b")
	await secs(0.4)
	ok(rule.times == 1 and bool(story.call("is_set", "ready_b")) and bool(story.call("is_set", "lamp_fired_b")) and fired[0] == 1, "B: the moment they're all so: its flags, the thing it fires")
	await secs(0.4)
	ok(rule.times == 1, "B: not again while they stay so")
	story.call("set_flag", "has_key_b", false)
	await secs(0.3)
	story.call("set_flag", "has_key_b")
	await secs(0.3)
	ok(rule.times == 2, "B: every time they come to be so again")


# ---- C. a marker and a thing tied by flags, both ways --------------------------------------------------------------------------------
func stage_tie() -> void:
	var o := origin()
	var her := standin(o, "HerC")
	var npc := npc_for(her, "Cora")
	var q := quest(npc, "One")
	mk(q, "appear", o)
	var walk := mk(q, "walk", o + Vector3(4, 0, 0), {"start_when": "cellar_open_c", "set_flags": "+cora_gone"})
	var cellar := thing("CellarC", o + Vector3(0, 0, -3), "res://starter/door.gd")
	logic(cellar, {"on": "signal", "on_signal": "opened", "set_flags": "+cellar_open_c"})
	var safe := thing("SafeC", o + Vector3(-3, 0, 0), "res://starter/door.gd")
	logic(safe, {"needs": "cora_gone", "locked_says": "She'd see."})
	# a marker's Fires sets a Logic off; that Logic's flag is what her next quest starts on
	var lamp := thing("LampC", o + Vector3(3, 0, 3), "", Vector3(0.2, 0.2, 0.2), false)
	var ll := logic(lamp, {"set_flags": "+lamp_c_on"})
	var ev := mk(q, "event", Vector3.ZERO)
	ev.fire = [ev.get_path_to(ll)] as Array[NodePath]
	var q2 := quest(npc, "Two", "lamp_c_on")
	var m2 := mk(q2, "walk", o + Vector3(4, 0, 3))
	npc.start()
	await secs(0.6)
	var run: HSNpcRunner = npc.runner
	ok(run != null and run.cur == walk and run.phase == "gate", "C: her walk waits for a flag a door's Logic turns on", run.status() if run != null else "")
	put(o + Vector3(-3, 0.1, 1.5))
	var hit: Node = await use_at(safe)
	ok(hit == null and line() == "She'd see.", "C: the safe can't be opened while she's there", line())
	put(o + Vector3(0, 0.1, -1.5))
	await use_at(cellar)
	var left := await until(func() -> bool: return run.cur == walk and run.phase != "gate", 2.0)
	ok(left, "C: the cellar door opened: she starts walking", run.status())
	var gone := await until(func() -> bool: return bool(story.call("is_set", "cora_gone")), 12.0)
	ok(gone and her.global_position.distance_to(o + Vector3(4, 0, 0)) < 0.3, "C: there, her marker turns its own flag on", str(her.global_position - o))
	put(o + Vector3(-3, 0.1, 1.5))
	hit = await use_at(safe)
	await frames(2)
	ok(hit == safe and bool(safe.get("open")), "C: and the safe opens: one flag, a marker at one end and a thing at the other")
	var started := await until(func() -> bool: return run.cur == m2 or run.quest == q2, 4.0)
	ok(started and ll.times == 1, "C: a marker fires a Logic, whose flag starts her next quest", run.status())


# ---- D. dying puts flags back: a Logic that fired once fires again -------------------------------------------------------------------
func stage_checkpoint() -> void:
	var o := origin()
	var door := thing("DoorD", o, "res://starter/door.gd")
	var lg := logic(door, {"set_flags": "+opened_d"})
	put(o + Vector3(0, 0.1, 1.5))
	await frames(3)
	story.call("checkpoint")
	await use_at(door)
	await frames(2)
	ok(bool(story.call("is_set", "opened_d")) and lg.times == 1, "D: used once: its flag on")
	story.set("death_secs", 0.3)
	story.call("die", "test")
	await secs(1.2)
	ok(not bool(story.call("is_set", "opened_d")) and lg.times == 0, "D: died and back at the checkpoint: the flag is off again, and the Logic hasn't fired", "times %d" % lg.times)
	put(o + Vector3(0, 0.1, 1.5))
	await use_at(door)
	await frames(2)
	ok(bool(story.call("is_set", "opened_d")) and lg.times == 1, "D: used again: on again (a once counts from the checkpoint)")


# ---- E. the scene read: who turns each flag on, who needs it; a rename; what can't work ----------------------------------------------
func stage_scan() -> void:
	var o := origin()
	var room := Node3D.new()
	room.name = "RoomE"
	main.add_child(room)
	var was := main
	main = room
	var her := standin(o, "HerE")
	var npc := npc_for(her, "Eve")
	var q := quest(npc, "Night one", "on:book_e")
	var talk := mk(q, "wait", Vector3.ZERO, {"talk": true, "stay": "talked", "start_when": "eve_ready, !alarm_e"})
	var talks: Array[Dictionary] = [{"when": "knows_e", "lines": ["You again."]},
		{"when": "", "lines": ["Well?"], "sets": "+met_eve", "answers": [{"text": "Kitchen", "sets": "+eve_kitchen"}, {"text": "Garden", "sets": "+eve_garden, -eve_ready"}]}]
	talk.talks = talks
	talk.face_rules = PackedStringArray(["eve_kitchen => smile", "=> sad"])
	var ch := mk(q, "choice", Vector3.ZERO)
	var w1 := HSNpcWay.new()
	w1.name = "Way1"
	w1.when = "eve_kitchen"
	ch.add_child(w1)
	mk(w1, "walk", o + Vector3(2, 0, 0), {"set_flags": "+eve_gone", "tick": "book_e", "add_tasks": PackedStringArray(["garden_e: Go to the garden."])})
	var q2 := quest(npc, "Night two", "eve_gone")
	mk(q2, "walk", o + Vector3(3, 0, 0), {"repeat_until": "", "start_when": "item:key_e"})
	var door := thing("DoorE", o + Vector3(0, 0, -3), "res://starter/door.gd")
	door.set("locked_by", "flag:eve_gone")
	logic(door, {"needs": "eve_gone, !alarm_e", "on": "signal", "on_signal": "opened", "set_flags": "+eve_ready"})
	var key := thing("KeyE", o + Vector3(1, 0, -3), "res://starter/pickup.gd", Vector3(0.2, 0.2, 0.2), false)
	key.set("item", "key_e")
	var sw := thing("SwitchE", o + Vector3(2, 0, -3), "res://starter/flag_switch.gd", Vector3(0.2, 0.2, 0.2), false)
	sw.set("flags", PackedStringArray(["+alarm_e", "~eve_ready"]))
	sw.set("when", "task:book_e")
	var own := thing("OwnE", o + Vector3(3, 0, -3), "", Vector3(0.2, 0.2, 0.2), false)
	var gs := GDScript.new()
	gs.source_code = "extends Node3D\n@export var needs := \"eve_gone\"\n@export var flags := 3\n@export var when := \"never_a_flag\"\n"
	gs.reload()
	own.set_script(gs)
	main = was
	var found := HSLogicScan.scan(room)
	var flags: Dictionary = found["flag"]
	var roles := func(name: String) -> Array:
		var out := []
		for u in (flags.get(name, []) as Array):
			out.append("%s.%s:%s" % [(u["node"] as Node).name, u["prop"], u["role"]])
		out.sort()
		return out
	ok(HSLogicScan.names(found, "flag") == PackedStringArray(["alarm_e", "down:eve", "eve_garden", "eve_gone", "eve_kitchen", "eve_ready", "knows_e", "met_eve", "shot:eve", "talked:eve"]),
		"E: every flag the room names", str(HSLogicScan.names(found, "flag")))
	ok(roles.call("eve_gone") == ["DoorE.locked_by:needs", "Logic.needs:needs", "Night two.starts_when:needs", "OwnE.needs:needs", "Walk1.set_flags:on"],
		"E: a flag's uses: a marker turns it on; a quest, a door's lock, its Logic and a script of your own need it", str(roles.call("eve_gone")))
	ok(roles.call("eve_ready") == ["Logic.set_flags:on", "SwitchE.flags:flip", "Talk1.start_when:needs", "Talk1.talks:off"],
		"E: on by a thing's Logic, flipped by a flag switch, needed by a marker, off by a conversation's answer", str(roles.call("eve_ready")))
	ok(roles.call("alarm_e") == ["Logic.needs:needs_not", "SwitchE.flags:on", "Talk1.start_when:needs_not"], "E: a 'not' is its own role", str(roles.call("alarm_e")))
	ok(not flags.has("never_a_flag") and not flags.has("3"), "E: a plain field name (when, flags) on a script that isn't the studio's is left alone")
	ok(HSLogicScan.names(found, "task") == PackedStringArray(["book_e", "garden_e"]) and HSLogicScan.names(found, "item") == PackedStringArray(["key_e"]),
		"E: its tasks and the things carried", "%s %s" % [HSLogicScan.names(found, "task"), HSLogicScan.names(found, "item")])
	ok(HSLogicScan.home_of(flags["eve_kitchen"]) == "eve/Night one" and HSLogicScan.home_of(flags["met_eve"]) == "eve/Night one" and HSLogicScan.home_of(flags["eve_gone"]) == ""
		and HSLogicScan.home_of(flags["talked:eve"]) == "", "E: whose a flag is: one quest's, or the game's once a thing uses it",
		"%s | %s" % [HSLogicScan.home_of(flags["eve_kitchen"]), HSLogicScan.home_of(flags["eve_gone"])])
	ok(HSLogicScan.place(talk) == "Eve › Night one › 1 Talk" and HSLogicScan.place(door) == "DoorE (door)" and HSLogicScan.place(sw.get_parent()) == "RoomE" and HSLogicScan.place(door.get_node("Logic")) == "DoorE (door)",
		"E: where a use is, in plain words", HSLogicScan.place(talk))
	var probs := HSLogicScan.problems(found, {"eve_kitchen": {"home": "eve/Night two"}, "unused_e": {}})
	var texts := PackedStringArray()
	for p in probs:
		texts.append("%s:%s:%s" % [p["level"], p["kind"], p["name"]])
	texts.sort()
	ok(texts == PackedStringArray(["tip:flag:eve_garden", "tip:flag:met_eve", "tip:flag:unused_e", "warn:flag:eve_kitchen", "warn:flag:knows_e", "warn:task:book_e"]),
		"E: what can't work: asked and never on, switched and never asked, a task nothing lists, a quest's own flag used outside it, one written down and unused", str(texts))
	# things that wait for each other
	var ring := Node3D.new()
	ring.name = "RingE"
	was.add_child(ring)
	main = ring
	var r_her := standin(o + Vector3(6, 0, 0), "HerR")
	var r_npc := npc_for(r_her, "Rae")
	var r_walk := mk(quest(r_npc, "One"), "walk", o + Vector3(7, 0, 0), {"start_when": "r_door_open", "set_flags": "+rae_gone"})
	var r_door := thing("DoorR", o + Vector3(6, 0, -3), "res://starter/door.gd")
	r_door.set("locked_by", "r_key")
	logic(r_door, {"on": "signal", "on_signal": "opened", "set_flags": "+r_door_open"})
	var r_key := thing("KeyR", o + Vector3(7, 0, -3), "res://starter/pickup.gd", Vector3(0.2, 0.2, 0.2), false)
	r_key.set("item", "r_key")
	logic(r_key, {"needs": "rae_gone"})
	main = was
	var locks := HSLogicScan.deadlocks(HSLogicScan.scan(ring))
	ok(locks.size() == 1 and (locks[0]["keys"] as Array).size() == 3, "E: a circle found: a key that needs her gone, who needs the door open, which needs the key", str(locks.map(func(d): return d["keys"])))
	var ring_probs := HSLogicScan.problems(HSLogicScan.scan(ring)).filter(func(p): return String(p["text"]).contains("wait for each other"))
	ok(ring_probs.size() == 1 and String(ring_probs[0]["text"]).contains("r_key") and String(ring_probs[0]["text"]).contains("rae_gone") and String(ring_probs[0]["text"]).contains("r_door_open"),
		"E: said once, as a Problem, with who asks for what", String(ring_probs[0]["text"]) if not ring_probs.is_empty() else "")
	var spare := thing("SpareR", o + Vector3(8, 0, -3), "res://starter/pickup.gd", Vector3(0.2, 0.2, 0.2), false)
	spare.set("item", "r_key")
	spare.reparent(ring)
	ok(HSLogicScan.deadlocks(HSLogicScan.scan(ring)).is_empty(), "E: a second key that asks for nothing: no circle any more")
	ok(HSLogicScan.deadlocks(found).is_empty(), "E: and none in a room where everything can happen")
	ring.queue_free()
	# a rename moves every use
	var plan := HSLogicScan.rename_plan(found, "flag", "eve_gone", "eve_left")
	for ch2 in plan:
		(ch2[0] as Node).set(ch2[1], ch2[2])
	var after := HSLogicScan.scan(room)
	ok(plan.size() == 5 and not (after["flag"] as Dictionary).has("eve_gone") and (after["flag"]["eve_left"] as Array).size() == 5, "E: a flag renamed: all five uses move", str(plan.size()))
	ok(str(door.get("locked_by")) == "flag:eve_left" and (door.get_node("Logic") as HSLogic).needs == "eve_left, !alarm_e" and q2.starts_when == "eve_left" and str(own.get("needs")) == "eve_left",
		"E: the door's lock, its Logic, the quest and your script say the new name", "%s | %s" % [door.get("locked_by"), (door.get_node("Logic") as HSLogic).needs])
	plan = HSLogicScan.rename_plan(after, "flag", "eve_ready", "ready")
	for ch3 in plan:
		(ch3[0] as Node).set(ch3[1], ch3[2])
	ok(talk.start_when == "ready, !alarm_e" and str((talk.talks[1]["answers"] as Array)[1]["sets"]) == "+eve_garden, -ready" and sw.get("flags") == PackedStringArray(["+alarm_e", "~ready"]),
		"E: inside a condition, a conversation's answer and a flag switch's lines, the signs kept", "%s | %s" % [talk.start_when, sw.get("flags")])
	plan = HSLogicScan.rename_plan(HSLogicScan.scan(room), "task", "book_e", "the_book")
	for ch4 in plan:
		(ch4[0] as Node).set(ch4[1], ch4[2])
	ok(q.starts_when == "on:the_book" and str(sw.get("when")) == "task:the_book" and str((w1.get_child(0) as HSNpcMarker).tick) == "the_book", "E: a task renamed: on:, task: and what ticks it")
	plan = HSLogicScan.rename_plan(HSLogicScan.scan(room), "flag", "alarm_e", "")
	for ch5 in plan:
		(ch5[0] as Node).set(ch5[1], ch5[2])
	ok(talk.start_when == "ready" and (door.get_node("Logic") as HSLogic).needs == "eve_left" and sw.get("flags") == PackedStringArray(["~ready"]), "E: a flag taken out everywhere: its words gone, the rest as they were",
		"%s | %s | %s" % [talk.start_when, (door.get_node("Logic") as HSLogic).needs, sw.get("flags")])
	room.queue_free()


# ---- F. with no Story the flags are the plugin's own --------------------------------------------------------------------------------
func stage_alone() -> void:
	var o := origin()
	story.remove_from_group("hs_story")
	HSNpcCond.flags.clear()
	var door := thing("DoorF", o, "res://starter/door.gd")
	var lg := logic(door, {"needs": "open_f", "locked_says": "Stuck."})
	var rule := HSLogic.new()
	rule.on = "itself"
	rule.needs = "open_f"
	rule.set_flags = "+after_f"
	main.add_child(rule)
	put(o + Vector3(0, 0.1, 1.5))
	var hit: Node = await use_at(door)
	ok(hit == null and lg.times == 0, "F: no Story in the scene: a gate still holds")
	HSNpcCond.set_flag(self, "open_f")
	await secs(0.3)
	hit = await use_at(door)
	ok(hit == door and bool(HSNpcCond.is_set(self, "after_f")), "F: and the plugin's own flags tie a thing and a rule")
	story.add_to_group("hs_story")


# ---- G. F7: the flags on the screen -----------------------------------------------------------------------------------------------
func stage_board() -> void:
	var o := origin()
	var a := npc_for(standin(o, "HerG1"), "Gia")
	var b := npc_for(standin(o + Vector3(2, 0, 0), "HerG2"), "Gus")
	mk(quest(a, "One"), "wait", Vector3.ZERO, {"start_when": "gate_g"})
	mk(quest(b, "One"), "wait", Vector3.ZERO, {"start_when": "gate_g, never_g", "set_flags": "+gus_done"})
	var lamp := thing("LampG", o + Vector3(0, 0, 2), "", Vector3(0.2, 0.2, 0.2), false)
	logic(lamp, {"set_flags": "+gate_g", "tick": "book"})
	await frames(6)
	var boards := root.find_children("_HSFlagBoard*", "CanvasLayer", false, false)
	ok(boards.size() == 1 and boards[0] is HSFlagBoard, "G: one flag board under the root, however many characters and Logic nodes", str(boards.size()))
	var board := boards[0] as HSFlagBoard
	board.most = 1000                                         # (every stage's flags are in this one scene)
	ok(not HSNpc.debug and not board.showing(), "G: nothing shown until F7")
	var ev := InputEventKey.new()
	ev.physical_keycode = KEY_F7
	ev.keycode = KEY_F7
	ev.pressed = true
	Input.parse_input_event(ev)
	await frames(4)
	ok(HSNpc.debug and board.showing(), "G: F7 turns it on once (two characters don't flip it back)")
	var t := board.text()
	ok(t.contains("○ gate_g") and t.contains("○ gus_done") and not t.contains("talked:gia"), "G: every flag the scene names, the ones that are off dim; the kit's own only once on", t.replace("\n", " / ").substr(0, 160))
	story.call("set_flag", "gate_g")
	await secs(0.4)
	t = board.text()
	ok(t.contains("● gate_g") and t.find("● gate_g") < t.find("○ gus_done"), "G: a flag turned on is bright, and first")
	ok(t.contains("TASKS") and (t.contains("☐ book") or t.contains("☑ book")), "G: the to-do list's tasks", "")
	ok(a.debug_text().contains("Gia"), "G: and each character's chip, as before", a.debug_text())
	Input.parse_input_event(ev)
	await frames(4)
	ok(not HSNpc.debug and not board.showing(), "G: F7 again: off")


func _initialize() -> void:
	create_timer(600.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("LOGIC result " + JSON.stringify({"errors": errors}))
		quit())
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = Array(a.substr(7).split(",", false))
	main = (load("res://logic_main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	story = main.get_node("Story")
	for st in [["gate", stage_gate], ["then", stage_then], ["tie", stage_tie], ["checkpoint", stage_checkpoint], ["scan", stage_scan], ["board", stage_board], ["alone", stage_alone]]:
		if wants(st[0]):
			await (st[1] as Callable).call()
	print("LOGIC result " + JSON.stringify({"errors": errors}))
	quit()
