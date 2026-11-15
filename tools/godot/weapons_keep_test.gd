## WEAPONS' second script (tools/godot/weapons_check.py runs it after weapons_test.gd, in the same project): what the gun
## breaks kept with the starter Story's checkpoint and saves (the group hs_keeps). A lamp shot out (HSShootable's
## lights_out) and a mug blown up (HSBlowUp) since the last checkpoint are whole again when you die; broken when a save
## is made, they're broken at once when it's loaded into a scene that has them whole, quietly (no sparks, no pieces).
## Prints `WEAPONS <what> <how>` lines and `WEAPONS result {errors}`.
extends SceneTree

var errors: Array = []


func say(what: String, how := "") -> void:
	print("WEAPONS keep: %s %s" % [what, how])


func ok(cond: bool, what: String, how := "") -> void:
	say(what, how)
	if not cond:
		errors.append("keep: " + what + (" (" + how + ")" if how != "" else ""))


func frames(n: int) -> void:
	for i in n:
		await process_frame


func finish() -> void:
	print("WEAPONS result " + JSON.stringify({"errors": errors}))
	quit()


func shoot(sh: Node, body: Node3D) -> void:
	sh.call("_on_fired", [{"collider": body, "point": body.global_position, "normal": Vector3.UP, "dir": Vector3.FORWARD, "damage": 1.0}])


func solid(n: Node) -> bool:
	for c in n.find_children("*", "CollisionObject3D", true, false):
		if (c as CollisionObject3D).collision_layer != 0:
			return true
	return false


func sparks(root_node: Node) -> int:
	return root_node.find_children("*", "CPUParticles3D", true, false).size()


func _initialize() -> void:
	create_timer(120.0).timeout.connect(func() -> void:
		errors.append("keep: the test never ended")
		finish())
	change_scene_to_file("res://main.tscn")
	await frames(12)
	var main := current_scene
	var story := main.get_node("Story")
	var w = JSON.parse_string(FileAccess.get_file_as_string("res://weapons.json"))
	var start := Vector3(w["start"][0], float(w["floor"]), w["start"][2]) if w is Dictionary else Vector3.ZERO
	# a lamp to shoot out: a box with a light in it
	var lamp := StaticBody3D.new()
	lamp.name = "KeepLamp"
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(0.3, 0.3, 0.3)
	cs.shape = bs
	lamp.add_child(cs)
	var light := OmniLight3D.new()
	light.light_energy = 2.5
	lamp.add_child(light)
	var sh := HSShootable.new()
	sh.lights_out = true
	lamp.add_child(sh)
	main.add_child(lamp)
	lamp.global_position = start + Vector3(0.0, 2.2, -2.0)
	# a mug that breaks, on the floor
	var mug: Node3D = (load("res://addons/horrorstudio_weapons/models/mug_stoneware.glb") as PackedScene).instantiate()
	mug.name = "KeepMug"
	var bu := HSBlowUp.new()
	mug.add_child(bu)
	main.add_child(mug)
	mug.global_position = start + Vector3(1.0, 0.0, -1.5)
	await frames(6)
	ok(lamp.is_in_group("hs_keeps") == false and sh.is_in_group("hs_keeps") and bu.is_in_group("hs_keeps"), "the shootable and the blow-up in the Story's world (hs_keeps)")
	story.call("checkpoint")
	shoot(sh, lamp)
	bu.blow_up()
	await frames(6)
	ok(bool(sh.get("is_down")) and not light.visible and light.light_energy == 0.0 and bool(bu.get("is_broken")) and not mug.visible and not solid(mug),
		"shot after the checkpoint: the lamp out, the mug in pieces", "lamp %s %.1f, mug broken %s" % [light.visible, light.light_energy, bu.get("is_broken")])
	story.call("die")
	story.call("revive")
	await frames(4)
	ok(not bool(sh.get("is_down")) and int(sh.get("count")) == 0 and light.visible and is_equal_approx(light.light_energy, 2.5) and not light.has_meta("hs_broken"),
		"died: the lamp whole and lit as it was", "visible %s, energy %.2f, count %d" % [light.visible, light.light_energy, int(sh.get("count"))])
	ok(not bool(bu.get("is_broken")) and mug.visible and solid(mug) and (bu.get("pieces_out") as Array).is_empty(),
		"and the mug whole, solid, its pieces gone", "broken %s, visible %s, solid %s" % [bu.get("is_broken"), mug.visible, solid(mug)])
	shoot(sh, lamp)
	await frames(2)
	ok(bool(sh.get("is_down")) and not light.visible, "the lamp can be shot out again")
	bu.blow_up()
	await frames(6)
	var wrote: bool = story.call("save_game", 3)
	sh.call("put_state", {"count": 0, "down": false})                    # (both whole, as a scene starts)
	bu.call("put_state", {"broken": false})
	await frames(4)
	ok(wrote and light.visible and mug.visible and not bool(bu.get("is_broken")), "a save with both broken; both whole again, as a scene starts")
	var sparks_before := sparks(main)
	var loaded: bool = story.call("load_game", 3)
	await frames(4)
	ok(loaded and bool(sh.get("is_down")) and not light.visible and light.light_energy == 0.0 and sparks(main) == sparks_before,
		"the save loaded: the lamp out at once, no sparks", "visible %s, sparks %d -> %d" % [light.visible, sparks_before, sparks(main)])
	ok(bool(bu.get("is_broken")) and not mug.visible and not solid(mug) and (bu.get("pieces_out") as Array).is_empty(),
		"and the mug gone, nothing solid, no pieces", "broken %s, visible %s, solid %s" % [bu.get("is_broken"), mug.visible, solid(mug)])
	story.call("delete_save", 3)
	finish()
