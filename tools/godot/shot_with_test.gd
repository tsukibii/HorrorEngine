## SHOTWITH's playthrough (tools/godot/shot_with_check.py): the weapons plugin's HSShotWith (DECISIONS 2026-11-12, last:
## "an npc gets shot with love, then it ticks that flag as true") with the real double barrel, the real shells and the
## starter's Story, headless (--fixed-fps 60): people stood round the player, each with an HSShotWith under them, shot
## with buckshot, love hearts, water and an explosive shell. Prints `SHOTWITH <what> <how>` lines and
## `SHOTWITH result {errors}`, quits.
extends SceneTree

const DIR := "res://addons/horrorstudio_weapons/"

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var gun: Node3D
var story: Node
var kinds := {}


func say(what: String, how: String) -> void:
	print("SHOTWITH %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("SHOTWITH ERROR %s" % e)


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


func look(p: Vector3) -> void:
	var d := p - player.global_position
	player.rotation = Vector3(0, atan2(-d.x, -d.z), 0)
	var e := p - eye.global_position
	var pt := atan2(e.y, Vector2(e.x, e.z).length())
	player.set("pitch", pt)
	eye.rotation = Vector3(pt, 0, 0)


func made(src: String) -> GDScript:
	var s := GDScript.new()
	s.source_code = src
	s.reload()
	return s


## someone to shoot, `turn` degrees round the player 2.5 m off: a box 0.5 m wide and 1.7 m tall
func person(nm: String, turn: float) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.name = nm
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = Vector3(0.5, 1.7, 0.5)
	cs.shape = sh
	cs.position = Vector3(0, 0.85, 0)
	b.add_child(cs)
	main.add_child(b)
	var a := deg_to_rad(turn)
	b.global_position = Vector3(sin(a), 0, -cos(a)) * 2.5
	return b


## an HSShotWith under someone, with its words
func ask(under: Node, words: Dictionary) -> HSShotWith:
	var q := HSShotWith.new()
	for k in words:
		q.set(k, words[k])
	under.add_child(q)
	return q


## one shot of a kind at a point: the right barrel loaded with it, aimed, fired
func shoot(kind: String, at: Vector3) -> Array:
	await until(func() -> bool: return not gun.get("busy"), 5.0)
	var k: HSShellType = kinds[kind]
	gun.set("loaded", 0)
	await frames(2)
	gun.add_shells(2, k)
	gun.set_load_kind(k)
	gun.reload()
	await frames(2)
	await until(func() -> bool: return not gun.get("busy"), 6.0)
	look(at)
	await frames(6)
	gun.pull()
	await frames(4)
	return gun.get("last_hits")


func chest(b: Node3D) -> Vector3:
	return b.global_position + Vector3(0, 1.15, 0)


func _initialize() -> void:
	create_timer(240.0).timeout.connect(func() -> void:
		bad("the test never ended")
		print("SHOTWITH result " + JSON.stringify({"errors": errors}))
		quit())
	var ms := load("res://main.tscn") as PackedScene
	main = ms.instantiate() as Node3D
	root.add_child(main)
	await frames(10)
	player = main.get_node("Player") as CharacterBody3D
	eye = player.get_node("Eye") as Camera3D
	gun = player.get_node("Eye/Shotgun") as Node3D
	story = main.get_node("Story")
	for k in ["buckshot", "explosive", "heart", "water"]:
		kinds[k] = load(DIR + "shells/%s.tres" % k)
	if not (gun is HSDoubleBarrel) or kinds.values().any(func(k) -> bool: return k == null):
		bad("the gun or its shells didn't load")
		print("SHOTWITH result " + JSON.stringify({"errors": errors}))
		quit()
		return
	var said: Array = []
	var say_src := "extends Node\nvar got: Array = []\nfunc fire(_a = null, _b = null) -> void:\n\tgot.append(1)\n"

	# 1. she wants love hearts: buckshot counts nothing; love hearts set her fact, tick her task, fire a target, once
	var a := person("Her", 0.0)
	var a_target := Node.new()
	a_target.set_script(made(say_src))
	main.add_child(a_target)
	var a_q := ask(a, {"shell": "heart", "fact": "her_loved", "tick": "love", "say": "She blushes.", "objective": "Now the other one.",
		"add_tasks": PackedStringArray(["dry: Find a towel."]), "target": a_target})
	var a_counted: Array = []
	var a_happened: Array = []
	a_q.counted.connect(func(i: Dictionary) -> void: a_counted.append(i))
	a_q.happened.connect(func(i: Dictionary) -> void: a_happened.append(i))
	await frames(40)                                      # (the gun found: every half second)
	var h0 := await shoot("buckshot", chest(a))
	var on0 := h0.filter(func(h): return h.get("collider") == a).size()
	say("buckshot", "%d pellets on her: counted %d, her fact %s, her task done %s" % [on0, a_q.count, story.is_set("her_loved"), story.done("love")])
	if on0 < 1 or a_q.count != 0 or a_q.done or story.is_set("her_loved") or story.done("love"):
		bad("buckshot counted for someone who wants love hearts (%d pellets, count %d, done %s)" % [on0, a_q.count, a_q.done])
	var h1 := await shoot("heart", chest(a))
	var on1 := h1.filter(func(h): return h.get("collider") == a).size()
	say("love", "%d hearts on her: counted %d, happened %d (kind %s, touch %s, %d pellets), her fact %s, her task done %s, the target fired %d, a task added %s, holds('her_loved, task:love') %s, was() %s" % [
		on1, a_counted.size(), a_happened.size(), str(a_q.last.get("kind", "")), str(a_q.last.get("touch", "")), int(a_q.last.get("pellets", 0)),
		story.is_set("her_loved"), story.done("love"), (a_target.get("got") as Array).size(), story.has_task("dry"),
		story.holds("her_loved, task:love"), HSShotWith.was(a)])
	if on1 < 1 or a_counted.size() != 1 or a_happened.size() != 1 or not a_q.done or not story.is_set("her_loved") or not story.done("love") \
			or (a_target.get("got") as Array).size() != 1 or not story.has_task("dry") or not story.holds("her_loved, task:love") or not HSShotWith.was(a) \
			or str(a_q.last.get("kind", "")) != "heart" or str(a_q.last.get("touch", "")) != "charm" or int(a_q.last.get("pellets", 0)) != on1:
		bad("love hearts on her didn't set her fact, tick her task and fire her target once (counted %d, happened %d, fact %s, task %s, target %d, last %s)" % [
			a_counted.size(), a_happened.size(), story.is_set("her_loved"), story.done("love"), (a_target.get("got") as Array).size(), str(a_q.last)])
	await shoot("heart", chest(a))
	say("once", "love hearts again: happened %d, the target fired %d" % [a_happened.size(), (a_target.get("got") as Array).size()])
	if a_happened.size() != 1 or (a_target.get("got") as Array).size() != 1:
		bad("it happened again though once is on (%d)" % a_happened.size())

	# 2. water twice before it happens; his HSShootable counts none of it; love hearts don't count for him
	var b := person("Him", 60.0)
	var b_sh := HSShootable.new()
	b_sh.hits = 3
	b.add_child(b_sh)
	var b_q := ask(b, {"shell": "water", "times": 2, "fact": "him_soaked", "tick": "wet"})
	await shoot("heart", chest(b))
	var b_c0 := b_q.count
	await shoot("water", chest(b))
	var b_c1 := b_q.count
	var b_d1 := b_q.done
	await shoot("water", chest(b))
	say("water twice", "love hearts first: counted %d; water: %d, done %s; water again: %d, done %s, his fact %s, his task done %s; his shootable counted %d" % [
		b_c0, b_c1, b_d1, b_q.count, b_q.done, story.is_set("him_soaked"), story.done("wet"), b_sh.count])
	if b_c0 != 0 or b_c1 != 1 or b_d1 or b_q.count != 2 or not b_q.done or not story.is_set("him_soaked") or not story.done("wet") or b_sh.count != 0:
		bad("water twice didn't happen at the second shot (counts %d, %d, %d, done %s then %s, shootable %d)" % [b_c0, b_c1, b_q.count, b_d1, b_q.done, b_sh.count])

	# 3. needs: love hearts on the third count only once a fact is set; a shell that hurts; any harmless shell, twice
	var c := person("Third", 120.0)
	var c_q := ask(c, {"shell": "heart", "needs": "third_ready, !never", "fact": "third_loved"})
	var c_hurt := ask(c, {"shell": "harmful", "fact": "third_hurt"})
	var c_soft := ask(c, {"shell": "harmless", "times": 2, "fact": "third_soft"})
	await shoot("heart", chest(c))
	var c_c0 := c_q.count
	story.flag("third_ready")
	await shoot("heart", chest(c))
	var c_h0 := c_hurt.count
	await shoot("buckshot", chest(c))
	say("needs", "love hearts before its needs hold: counted %d; after: %d, the fact %s; the one that wants a shell that hurts: %d after the hearts, %d after buckshot, its fact %s; harmless twice: %s" % [
		c_c0, c_q.count, story.is_set("third_loved"), c_h0, c_hurt.count, story.is_set("third_hurt"), story.is_set("third_soft")])
	if c_c0 != 0 or c_q.count != 1 or not story.is_set("third_loved"):
		bad("needs didn't hold love hearts back and then let them count (%d, then %d)" % [c_c0, c_q.count])
	if c_h0 != 0 or c_hurt.count != 1 or not story.is_set("third_hurt") or not story.is_set("third_soft"):
		bad("harmful and harmless didn't sort the shells (harmful %d then %d, harmless fact %s)" % [c_h0, c_hurt.count, story.is_set("third_soft")])

	# 4. a part of her: someone with an HSHitReact (a stand-in of meshes: her hitbox), love hearts at her legs don't
	# count, at her head they do; her look turned, and back after a while
	var d := Node3D.new()
	d.name = "Fourth"
	var d_mesh := MeshInstance3D.new()
	var d_cap := CapsuleMesh.new()
	d_cap.radius = 0.2
	d_cap.height = 1.7
	d_mesh.mesh = d_cap
	d_mesh.position = Vector3(0, 0.85, 0)
	d.add_child(d_mesh)
	main.add_child(d)
	d.global_position = Vector3(sin(PI), 0, -cos(PI)) * 2.5
	var d_hr := HSHitReact.new()
	d.add_child(d_hr)
	var d_sw := Node.new()
	d_sw.name = "Looks"
	d_sw.set_script(made("extends Node\nvar now := \"\"\nvar log: Array = []\nfunc set_look(n: String, _s := -1.0) -> bool:\n\tnow = n\n\tlog.append(n)\n\treturn true\nfunc default(_s := -1.0) -> void:\n\tnow = \"\"\n\tlog.append(\"\")\nfunc current() -> String:\n\treturn now\n"))
	d.add_child(d_sw)
	var d_q := ask(d, {"shell": "heart", "part": "head", "fact": "fourth_head", "her_look": "smitten", "look_secs": 1.0})
	await frames(30)
	var d_boxes := int((d_hr.report() as Dictionary).get("boxes", 0))
	var hl := await shoot("heart", d.global_position + Vector3(0, 0.35, 0))
	var d_legs := hl.filter(func(h): return h.get("collider") is Node and d.is_ancestor_of(h["collider"])).size()
	var d_c0 := d_q.count
	var d_touch0 := int(d_hr.get("touches"))
	var hh := await shoot("heart", d.global_position + Vector3(0, 1.62, 0))
	var d_head := hh.filter(func(h): return h.get("collider") is Node and d.is_ancestor_of(h["collider"])).size()
	var d_look := str(d_sw.get("now"))
	await secs(1.3)
	say("part", "her hitboxes %d; %d hearts at her legs (her HSHitReact touched %d): counted %d; %d at her head: counted %d (a %s hit, %d pellets there), her fact %s; her look '%s', a second later '%s' (%s)" % [
		d_boxes, d_legs, d_touch0, d_c0, d_head, d_q.count, str(d_q.last.get("part", "")), int(d_q.last.get("pellets", 0)), story.is_set("fourth_head"), d_look,
		str(d_sw.get("now")), str(d_sw.get("log"))])
	if d_legs < 1 or d_c0 != 0 or d_head < 1 or d_q.count != 1 or not story.is_set("fourth_head") or str(d_q.last.get("part", "")) != "head":
		bad("a head shot wasn't told from her legs (%d on her legs counted %d, %d at her head counted %d, part %s)" % [d_legs, d_c0, d_head, d_q.count, str(d_q.last.get("part", ""))])
	if d_look != "smitten" or str(d_sw.get("now")) != "":
		bad("her look wasn't turned and then given back (%s, then %s)" % [d_look, str(d_sw.get("now"))])

	# 5. an explosive shell: its blast reaches someone its slug never touched; every time, with once off
	var e := person("Fifth", 240.0)
	var e_q := ask(e, {"shell": "explosive", "once": false, "fact": "fifth_blown"})
	var e_any := ask(e, {"shell": "any", "once": false})
	var e_n := [0]
	e_any.happened.connect(func(_i: Dictionary) -> void: e_n[0] += 1)
	var e_side := e.global_position.normalized().cross(Vector3.UP) * 0.9
	var he := await shoot("explosive", Vector3(e.global_position.x, 0.02, e.global_position.z) + e_side)
	var e_direct := he.filter(func(h): return h.get("collider") == e and not bool(h.get("blast", false))).size()
	var e_blast := he.filter(func(h): return h.get("collider") == e and bool(h.get("blast", false))).size()
	await shoot("water", chest(e))
	await shoot("heart", chest(e))
	say("blast", "an explosive shell into the floor beside her: %d of its slug on her, its blast on her %d: counted %s, blast %s, her fact %s; then water and hearts: 'any' with once off happened %d times" % [
		e_direct, e_blast, e_q.done, bool(e_q.last.get("blast", false)), story.is_set("fifth_blown"), e_n[0]])
	if e_direct != 0 or e_blast < 1 or not e_q.done or not bool(e_q.last.get("blast", false)) or not story.is_set("fifth_blown"):
		bad("an explosive shell's blast didn't count (slug on her %d, blast %d, done %s)" % [e_direct, e_blast, e_q.done])
	if e_n[0] != 3:
		bad("with once off, 'any' didn't happen at each of three shots (%d)" % e_n[0])

	# 6. hidden: nothing's counted; a kind of your own by its id; who; fire(), reset()
	var f := person("Sixth", 300.0)
	var f_q := ask(f, {"shell": "heart", "fact": "sixth_loved"})
	var f_vis := MeshInstance3D.new()                    # (a body is hidden by what it's under: a Node3D of hers)
	f.add_child(f_vis)
	f.visible = false
	await shoot("heart", chest(f))
	var f_c0 := f_q.count
	f.visible = true
	var own := (kinds["heart"] as HSShellType).duplicate() as HSShellType
	own.id = "confetti"
	kinds["confetti"] = own
	var f_own := ask(main, {"shell_id": "confetti", "who": f, "fact": "sixth_confetti"})
	await shoot("heart", chest(f))
	var f_o0 := f_own.count
	await shoot("confetti", chest(f))
	var f_by := ask(f, {"shell": "water", "fact": "sixth_by_hand"})
	f_by.fire()
	var f_done := f_by.done
	f_by.reset()
	say("hidden, own, who", "hidden: counted %d; shown: %d, her fact %s; a kind of your own (confetti) under another node with who: %d after hearts, %d after confetti, its fact %s; fire(): done %s, its fact %s; reset(): done %s" % [
		f_c0, f_q.count, story.is_set("sixth_loved"), f_o0, f_own.count, story.is_set("sixth_confetti"), f_done, story.is_set("sixth_by_hand"), f_by.done])
	if f_c0 != 0 or f_q.count != 1 or not story.is_set("sixth_loved"):
		bad("someone hidden was counted, or wasn't once shown (%d, then %d)" % [f_c0, f_q.count])
	if f_o0 != 0 or f_own.count != 1 or not story.is_set("sixth_confetti"):
		bad("a kind of your own by its id, on `who`, didn't count (%d then %d)" % [f_o0, f_own.count])
	if not f_done or not story.is_set("sixth_by_hand") or f_by.done:
		bad("fire() and reset() (done %s, fact %s, after reset %s)" % [f_done, story.is_set("sixth_by_hand"), f_by.done])

	# 7. the ready-made scenes, and the lists the Inspector offers
	var lv := (load(DIR + "quest/loved.tscn") as PackedScene).instantiate()
	var sk := (load(DIR + "quest/soaked.tscn") as PackedScene).instantiate()
	var ids: Array = kinds.keys().filter(func(k): return k != "confetti")
	say("ready-made", "loved.tscn: %s, shell %s, fact %s; soaked.tscn: %s, shell %s, fact %s; the shells offered %s" % [
		lv.get_class() if not (lv is HSShotWith) else "HSShotWith", str(lv.get("shell")), str(lv.get("fact")),
		sk.get_class() if not (sk is HSShotWith) else "HSShotWith", str(sk.get("shell")), str(sk.get("fact")), str(HSShotWith.SHELLS)])
	if not (lv is HSShotWith) or str(lv.get("shell")) != "heart" or not (sk is HSShotWith) or str(sk.get("shell")) != "water":
		bad("the ready-made scenes aren't an HSShotWith for hearts and for water")
	for id in ids:
		if not HSShotWith.SHELLS.has(id):
			bad("the plugin's shell '%s' isn't offered by HSShotWith's list" % id)
	lv.free()
	sk.free()

	print("SHOTWITH result " + JSON.stringify({"errors": errors}))
	quit()
