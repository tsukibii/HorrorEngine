## FIRSTGAME's playthrough (tools/godot/first_game.py): guides/first_game's main.tscn played headless as a person would
## play it. The Bungalow stands at the street's marker; the player lands on the street and walks toward the house; a ray
## through the street's doorway meets the Bungalow's own colliders; E at the front door slides it open; walking into the
## guest room puts its lamps out and she's there. Prints `FIRST <what> <how>` lines and `FIRST result {errors}`, quits.
extends SceneTree

var errors: Array = []


func say(what: String, how: String) -> void:
	print("FIRST %s %s" % [what, how])


func key(code: int, down: bool) -> void:
	var e := InputEventKey.new()
	e.physical_keycode = code as Key
	e.keycode = code as Key
	e.pressed = down
	Input.parse_input_event(e)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func middle(n: Node3D) -> Vector3:                      # the middle of what's drawn under a node
	var box := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		if (mi as MeshInstance3D).mesh == null:
			continue
		var b: AABB = mi.global_transform * (mi as MeshInstance3D).get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box.get_center() if not first else n.global_position


func stand(player: CharacterBody3D, at: Vector3, toward: Vector3) -> void:
	player.global_position = at
	player.velocity = Vector3.ZERO
	var d := toward - at
	player.rotation = Vector3(0, atan2(-d.x, -d.z), 0)
	player.pitch = 0.0
	(player.get_node("Eye") as Camera3D).rotation = Vector3.ZERO


func _initialize() -> void:
	var cfg: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://first.json"))
	var main := (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	await frames(3)
	var player := main.get_node("Player") as CharacterBody3D
	var bung := main.get_node("Bungalow") as Node3D
	var her := main.get_node("Mari") as Node3D
	# the Bungalow at the street's marker, its doors and lamps found
	var mk := main.get_node("Street").find_child(str(cfg["street"]["marker"]["name"]), true, false) as Node3D
	if mk == null:
		errors.append("the street has no marker %s" % cfg["street"]["marker"]["name"])
	elif bung.global_position.distance_to(mk.global_position) > 0.01:
		errors.append("the Bungalow isn't at its marker: %s, the marker %s" % [bung.global_position, mk.global_position])
	var doors: Array = bung.doors()
	var lamps: Array = bung.lamps()
	say("placed", "the Bungalow at %s (%s), %d doors, %d lamps; she's %s" % [mk.name if mk else "?", bung.global_position, doors.size(), lamps.size(), "hidden till the scare" if not her.visible else "SHOWN"])
	if doors.is_empty() or lamps.is_empty():
		errors.append("the Bungalow's doors or lamps weren't found (interior.gd)")
	if her.visible:
		errors.append("she's there before the scare (scare_area.gd hides who appears)")
	# 1. the player lands on the street
	await frames(90)
	var landed := player.is_on_floor()
	say("landed", "on the street at %.2f m: %s" % [player.global_position.y, "standing" if landed else "NOT on a floor"])
	if not landed:
		errors.append("the player didn't land on the street (the street's colliders)")
	# 2. walks up to the house (W held three seconds): up the garden path's step, across the engawa, to the front door
	var p0 := player.global_position
	key(KEY_W, true)
	await frames(180)
	key(KEY_W, false)
	await frames(3)
	var walked := Vector2(player.global_position.x - p0.x, player.global_position.z - p0.z).length()
	var fd := bung.find_child("door_front_door", true, false) as Node3D
	var to_door := 99.0
	if fd != null:
		var fm := middle(fd)
		to_door = Vector2(player.global_position.x - fm.x, player.global_position.z - fm.z).length()
	say("walked", "%.2f m, %.2f m up the step, to %.2f m from the front door" % [walked, player.global_position.y - p0.y, to_door])
	if walked < 1.5 or to_door > 1.0:
		errors.append("W didn't walk the player up to the front door: %.2f m walked, %.2f m from the door" % [walked, to_door])
	# 3. a ray through the street's doorway meets the Bungalow's own colliders (its front door or what's past the doorway)
	var space := player.get_world_3d().direct_space_state
	var a := v3(cfg["street"]["out1"])
	var b := v3(cfg["street"]["in0"])
	var q := PhysicsRayQueryParameters3D.create(a, a + (b - a).normalized() * 6.0)
	q.exclude = [player.get_rid()]
	var hit := space.intersect_ray(q)
	var into := hit.size() > 0 and bung.is_ancestor_of(hit["collider"])
	say("doorway", "a ray through the street's doorway meets %s %.2f m in" % [hit["collider"].get_path() if hit else "nothing", a.distance_to(hit["position"]) if hit else 0.0])
	if not into:
		errors.append("through the street's doorway the ray met %s, not the Bungalow" % (hit["collider"].name if hit else "nothing"))
	# 4. the front door: E in front of it slides it open
	var door: Node3D = null
	for d in doors:
		if str(d.name) == "door_" + str(cfg["street"]["door"] if cfg["street"]["door"] else "front_door"):
			door = d
	if door == null:
		for d in doors:
			if str(d.name) == "door_front_door":
				door = d
	if door == null:
		errors.append("no front door among %s" % [doors.map(func(x): return str(x.name))])
	else:
		var mid := middle(door)
		var shut := door.global_transform
		var used: Node = null
		for side in [1.0, -1.0]:
			var n: Vector3 = door.global_basis.z.normalized() * float(side)
			stand(player, Vector3(mid.x, mid.y - 1.0, mid.z) + n * 0.9, mid)
			await frames(12)
			stand(player, Vector3(player.global_position.x, player.global_position.y, player.global_position.z), mid)
			used = player.use()
			if used == door:
				break
		if used != door:
			errors.append("E in front of %s used %s" % [door.name, used.name if used else "nothing"])
		await frames(70)
		var moved := door.global_position.distance_to(shut.origin)
		var turned := door.global_basis.z.angle_to(shut.basis.z)
		say("door", "E at %s: %s, %.2f m along, %.0f° round" % [door.name, "open" if door.open else "shut", moved, rad_to_deg(turned)])
		if not door.open or (moved < 0.3 and turned < 0.5):
			errors.append("the front door didn't open with E (door.gd): %.2f m, %.2f rad" % [moved, turned])
	# 5. into the guest room: its lamps out, she's there
	var sc := v3(cfg["scare"])
	stand(player, Vector3(sc.x, sc.y - 1.1, sc.z), v3(cfg["her"]))
	await frames(20)
	var lit := 0
	for l in lamps:
		if (l as Node3D).visible:
			lit += 1
	say("scare", "in the guest room: %d of %d lamps still on, she's %s" % [lit, lamps.size(), "there" if her.visible else "NOT there"])
	if lit > 0 or not her.visible:
		errors.append("walking into the guest room didn't scare (scare_area.gd): %d lamps on, she %s" % [lit, "shown" if her.visible else "hidden"])
	var look := her.get_node_or_null("Look")
	if look != null:
		say("her look", "HSCharacterLook wore %d materials" % look.materials.size())
		if look.materials.is_empty():
			errors.append("HSCharacterLook put nothing on her")
	print("FIRST result " + JSON.stringify({"errors": errors}))
	quit()
