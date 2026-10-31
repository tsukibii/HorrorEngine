extends SceneTree
# GDSTREET's door test: the street's .glb and a set's level in the set's own exported project; the level put at the
# street's marker for it, as the user would; then a ray from outside, level, through the street's doorway. It should
# meet the level's own door leaf there (expect.json: the marker, the level, the ray, the door's id).
func _initialize():
	var expect = JSON.parse_string(FileAccess.get_file_as_string("res://street_door.json"))
	var street = (load("res://street_check.glb") as PackedScene).instantiate()
	root.add_child(street)
	var marker = street.find_child(expect.marker, true, false)
	if marker == null:
		print("GDDOOR error no-marker ", expect.marker); quit(1); return
	var level = (load(expect.level) as PackedScene).instantiate()
	marker.add_child(level)
	await physics_frame
	await physics_frame
	var space = street.get_world_3d().direct_space_state
	var p = Vector3(expect.at[0], expect.at[1], expect.at[2])
	var d = Vector3(expect.dir[0], expect.dir[1], expect.dir[2]).normalized()
	var hit = space.intersect_ray(PhysicsRayQueryParameters3D.create(p, p + d * 6.0))
	if hit:
		print("GDDOOR hit ", (hit.position - p).length(), " ", hit.collider.name, " ", hit.collider.get_parent().name)
	else:
		print("GDDOOR hit 6.0 nothing nothing")
	quit(0)
