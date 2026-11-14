## LOGICEDITOR's last step (tools/godot/logic_check.py --editor): the scene the Things and Flags tabs built and saved
## in the editor (logic_scene.tscn), loaded as a game and played headless: what was tied there by clicks holds here.
## Prints `LOGICPLAY <what>` lines and `LOGICPLAY result {errors}`, quits.
extends SceneTree

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var eye: Camera3D
var story: Node


func ok(cond: bool, what: String, how: String = "") -> void:
	if cond:
		print("LOGICPLAY %s %s" % [what, how])
	else:
		errors.append("%s%s" % [what, (": " + how) if how != "" else ""])
		print("LOGICPLAY ERROR %s %s" % [what, how])


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func until(cond: Callable, t: float) -> bool:
	for i in int(ceil(t * 60.0)):
		if cond.call():
			return true
		await physics_frame
	return cond.call()


func put(p: Vector3) -> void:
	player.global_position = p
	player.velocity = Vector3.ZERO


func use_at(p: Vector3) -> Node:
	var d := p - eye.global_position
	player.rotation.y = atan2(-d.x, -d.z)
	player.set("pitch", atan2(d.y, Vector2(d.x, d.z).length()))
	eye.rotation.x = float(player.get("pitch"))
	await frames(3)
	return player.call("use")


func _initialize() -> void:
	create_timer(240.0).timeout.connect(func() -> void:
		errors.append("the play never ended")
		print("LOGICPLAY result " + JSON.stringify({"errors": errors}))
		quit())
	main = (load("res://logic_scene.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(12)
	player = main.get_node_or_null("Player") as CharacterBody3D
	story = main.get_node_or_null("Story")
	ok(player != null and story != null and main.get_node_or_null("Hud") != null and main.get_node_or_null("Sound") != null, "the scene the editor set up has its player, Story, HUD and Sound")
	if player == null or story == null:
		print("LOGICPLAY result " + JSON.stringify({"errors": errors}))
		quit()
		return
	eye = player.get_node("Eye") as Camera3D
	var door := main.get_node("Door") as Node3D
	var key := main.get_node("Key") as Node3D
	var lamp := main.get_node("Lamp") as Node3D
	var ann := main.get_node("Ann") as Node3D
	var npc := main.get_node("Ann markers") as HSNpc
	var walk := npc.get_node("Quest 1/Walk") as HSNpcMarker
	var door_logic := door.get_node("Logic") as HSLogic
	var key_logic := key.get_node("Logic") as HSLogic
	var lamp_logic := lamp.get_node("Logic") as HSLogic
	ok(npc.runner != null and npc.runner.cur == walk and npc.runner.phase == "gate", "Ann's walk waits (for the flag the door's Logic turns on)", npc.runner.status() if npc.runner != null else "")
	var refused := [0]
	key_logic.refused.connect(func() -> void: refused[0] += 1)
	put(Vector3(1.5, 0.1, -0.4))
	var hit: Node = await use_at(key.global_position)
	ok(hit == null and refused[0] == 1 and key.visible and not bool(story.call("has", "cellar_key")), "the key can't be taken yet: it needs Ann's walk done", "refused %d" % refused[0])
	put(Vector3(0, 0.1, -1.0))
	hit = await use_at(door.global_position + Vector3(0, 1.0, 0))
	await frames(3)
	ok(hit == door and not bool(door.get("open")), "the door is locked by the key (its own lock, set in the form)")
	story.call("set_flag", "door_opened")                    # (as if it had been opened: the tie's other end)
	var gone := await until(func() -> bool: return bool(story.call("is_set", "ann_walk_done")), 14.0)
	ok(gone and ann.global_position.distance_to(walk.global_position) < 0.3, "the flag on: Ann walks to her pin and her marker turns its own flag on", str(ann.global_position))
	put(Vector3(1.5, 0.1, -0.4))
	hit = await use_at(key.global_position)
	await frames(2)
	ok(hit == key and bool(story.call("has", "cellar_key")), "now the key is taken", str(hit))
	story.call("set_flag", "door_opened", false)
	put(Vector3(0, 0.1, -1.0))
	hit = await use_at(door.global_position + Vector3(0, 1.0, 0))
	await frames(4)
	ok(bool(door.get("open")) and bool(story.call("is_set", "door_opened")) and door_logic.times == 1, "the key opens the door, and its Logic (when it's opened) turns the flag on")
	put(Vector3(-2.0, 0.1, 1.5))
	await frames(10)
	ok(bool(story.call("has_task", "cellar")), "the area placed by a click, which needs that flag, adds its task when you walk in")
	var reach := lamp.get_node_or_null("_LogicReach")
	put(Vector3(-3.0, 0.1, -0.8))
	hit = await use_at(lamp.global_position)
	ok(reach != null and hit == reach and lamp_logic.times == 0, "the lamp (a plain mesh with a Logic) is something to use; not while its flag is off")
	story.call("set_flag", "power_on")
	await use_at(lamp.global_position)
	await frames(4)
	ok(lamp_logic.times == 1 and bool(story.call("is_set", "lamp_lit")) and not bool(door.get("open")), "its flag on: E switches its flags and fires the door (which shuts)")
	print("LOGICPLAY result " + JSON.stringify({"errors": errors}))
	quit()
