## GDRANGE (tools/godot/motion_check.py ranges): what heights her hand really gets to, measured in Godot
## (docs/ANIMATION_RULES.md quotes it). A baked character with the starter's Motion under her, headless: a door's
## handle at every 5 cm from 0.6 to 1.5 m (how far the middle of her closed hand is from it as she takes hold), and a
## thing to pick up at every 10 cm from the floor to 2.1 m (how far her hand's grip is from the thing's as it closes).
## Prints "MOTION ..." lines and at the end "MOTION result {json}" with the tables.
extends SceneTree

const S := "res://starter/"
var main: Node3D
var errors: Array = []
var notes := {}


func say(t: String) -> void:
	print("MOTION " + t)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func until(cond: Callable, secs: float) -> bool:
	for i in int(secs * 60.0):
		if cond.call():
			return true
		await physics_frame
	return cond.call()


func bone_at(h: Node3D, nm: String) -> Vector3:
	var sk := h.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	return sk.global_transform * sk.get_bone_global_pose(sk.find_bone(nm)).origin


func _initialize() -> void:
	create_timer(1500.0).timeout.connect(func() -> void:
		errors.append("the test never ended")
		print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
		quit())
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(5)
	var only := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = a.substr(7)
	for who in ["normal_woman", "child_small", "imp"]:
		if only != "" and not only.split(",").has(who):
			continue
		await one(who)
	print("MOTION result " + JSON.stringify({"errors": errors, "notes": notes}))
	quit()


func one(who: String) -> void:
	var ps := load("res://characters/%s.glb" % who) as PackedScene
	if ps == null:
		errors.append("%s isn't imported" % who)
		return
	var her := ps.instantiate() as Node3D
	main.add_child(her)
	var m := Node.new()
	m.name = "Motion"
	m.set_script(load(S + "motion.gd"))
	her.add_child(m)
	await frames(6)
	var dones: Array = []
	m.done.connect(func(w: String) -> void: dones.append(w))
	var door := Node3D.new()
	main.add_child(door)
	var handles := {}
	var hy := 0.6
	while hy < 1.501:
		her.global_position = Vector3(0, 0, 0)
		var handle := Marker3D.new()
		main.add_child(handle)
		handle.global_position = Vector3(0, hy, -2.0)
		handle.global_rotation.y = PI
		var got := [9.0]
		var on_grab := func(e: String) -> void:
			if e == "grab":
				var ik: Node = m.hand_ik()
				if ik != null and ik.last.has("r"):
					got[0] = float(ik.last["r"]["error"])
		m.event.connect(on_grab)
		dones.clear()
		m.open(handle, door, "push")
		await until(func() -> bool: return dones.has("open"), 16.0)
		m.event.disconnect(on_grab)
		handles["%.2f" % hy] = snappedf(got[0] * 100.0, 0.1)
		handle.queue_free()
		hy += 0.05
	say("%s: a handle's height -> her hand from it, cm: %s" % [who, handles])
	var picks := {}
	var py := 0.0
	while py < 2.101:
		her.global_position = Vector3(4, 0, 0)
		var thing := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.06, 0.12, 0.06)
		thing.mesh = bm
		main.add_child(thing)
		thing.global_position = Vector3(4, py + 0.06, -2.0)
		var d := [9.0]
		var lvl := [""]
		var on_grab2 := func(e: String) -> void:
			if e == "grab":
				var ik: Node = m.hand_ik()
				if ik != null and ik.last.has("r"):
					d[0] = float(ik.last["r"]["error"])
				lvl[0] = String(m.now)
		m.event.connect(on_grab2)
		dones.clear()
		m.pick_up(thing)
		await until(func() -> bool: return dones.has("pick_up"), 16.0)
		m.event.disconnect(on_grab2)
		picks["%.1f" % py] = [snappedf(d[0] * 100.0, 0.1), lvl[0].replace("reach_", "")]
		if is_instance_valid(thing):
			thing.queue_free()
		m.drop()
		py += 0.1
	say("%s: what a thing stands on, its height -> her hand's grip from the thing's, cm, and the reach used: %s" % [who, picks])
	notes[who] = {"handles": handles, "picks": picks}
	her.queue_free()
	await frames(3)
