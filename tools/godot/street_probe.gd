extends SceneTree
# GDSTREET's look inside: the street's .glb as Godot imported it (tools/godot/street_check.py writes expect.json beside it).
# Prints one line a finding, "GDPROBE <what> <value>", and a ray's hit for each place expect.json asks about.
func _initialize():
	var ps: PackedScene = load("res://street.glb")
	if ps == null:
		print("GDPROBE error no-scene"); quit(1); return
	var s = ps.instantiate()
	root.add_child(s)
	var counts := {}
	var colours := {}
	var vc := 0
	var markers := []
	var stack := [s]
	while stack.size():
		var n = stack.pop_back()
		counts[n.get_class()] = counts.get(n.get_class(), 0) + 1
		if String(n.name).begins_with("inside_"): markers.append({"name": String(n.name), "meta": n.get_meta("extras", {}), "at": [n.global_position.x, n.global_position.y, n.global_position.z]})
		if n is MeshInstance3D and n.mesh:
			for i in n.mesh.get_surface_count():
				var m = n.mesh.surface_get_material(i)
				if m is StandardMaterial3D:
					colours[m.albedo_color.to_html(false)] = 1
					if m.vertex_color_use_as_albedo: vc += 1
		for c in n.get_children(): stack.append(c)
	print("GDPROBE counts ", JSON.stringify(counts))
	print("GDPROBE colours ", colours.size(), " vertexcolour ", vc)
	print("GDPROBE markers ", JSON.stringify(markers))
	await physics_frame
	await physics_frame
	var expect = JSON.parse_string(FileAccess.get_file_as_string("res://expect.json"))
	var space = s.get_world_3d().direct_space_state
	for r in expect.get("rays", []):
		var p = Vector3(r.at[0], r.at[1], r.at[2])
		if r.has("dir"):                                              # level, toward a door: how far it gets
			var d = Vector3(r.dir[0], r.dir[1], r.dir[2]).normalized()
			var h2 = space.intersect_ray(PhysicsRayQueryParameters3D.create(p, p + d * 6.0))
			print("GDPROBE ray ", r.name, " ", (h2.position - p).length() if h2 else 6.0)
			continue
		var hit = space.intersect_ray(PhysicsRayQueryParameters3D.create(p, p + Vector3(0, -80, 0)))
		print("GDPROBE ray ", r.name, " ", hit.get("position", Vector3(0, -999, 0)).y)
	quit(0)
