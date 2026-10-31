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
	var wear := 0
	var paint := 0
	var flat := 0
	var markers := []
	var stack := [s]
	while stack.size():
		var n = stack.pop_back()
		counts[n.get_class()] = counts.get(n.get_class(), 0) + 1
		if String(n.name).begins_with("inside_"): markers.append({"name": String(n.name), "meta": n.get_meta("extras", {}), "at": [n.global_position.x, n.global_position.y, n.global_position.z]})
		if n is MeshInstance3D and n.mesh:
			var on: bool = n.mesh.get_surface_count() > 0
			for i in n.mesh.get_surface_count():
				var nm := String(n.mesh.surface_get_material(i).resource_name) if n.mesh.surface_get_material(i) else ""
				on = on and (nm.begins_with("street_paint") or nm.begins_with("street_glyph:") or nm.begins_with("street_decal:"))
			if on:                                                      # road paint and decals: the plugin lays them flat (no shadow)
				paint += 1
				if n.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
					flat += 1
			for i in n.mesh.get_surface_count():
				var m = n.mesh.surface_get_material(i)
				if m is StandardMaterial3D:
					colours[m.albedo_color.to_html(false)] = 1
					if m.vertex_color_use_as_albedo: vc += 1
				elif m is ShaderMaterial and m.shader and String(m.shader.resource_path).get_file().begins_with("street"):
					wear += 1
		for c in n.get_children(): stack.append(c)
	print("GDPROBE counts ", JSON.stringify(counts))
	print("GDPROBE colours ", colours.size(), " vertexcolour ", vc)
	print("GDPROBE wear ", wear)
	print("GDPROBE paint ", paint, " ", flat)
	print("GDPROBE markers ", JSON.stringify(markers))
	await physics_frame
	await physics_frame
	var expect = JSON.parse_string(FileAccess.get_file_as_string("res://expect.json"))
	# a body a person's size dropped on the ground (it must stand there), then walked at a building's front (it must stop)
	for w in expect.get("walks", []):
		var b := _body(s, Vector3(w.at[0], w.at[1], w.at[2]))
		for i in 90:
			b.velocity = Vector3(0, b.velocity.y - 9.8 / 60.0, 0)
			b.move_and_slide()
			await physics_frame
		print("GDPROBE stand ", w.name, " ", b.global_position.y - 0.85, " ", b.is_on_floor())
		b.queue_free()
	for w in expect.get("bumps", []):
		var b := _body(s, Vector3(w.at[0], w.at[1], w.at[2]))
		for i in 90:
			b.velocity = Vector3(0, b.velocity.y - 9.8 / 60.0, 0)
			b.move_and_slide()
			await physics_frame
		var p0 := b.global_position
		var d := Vector3(w.dir[0], 0, w.dir[2]).normalized()
		for i in 120:
			b.velocity = Vector3(d.x * 2.0, b.velocity.y - 9.8 / 60.0, d.z * 2.0)
			b.move_and_slide()
			await physics_frame
		print("GDPROBE bump ", w.name, " ", Vector2(b.global_position.x - p0.x, b.global_position.z - p0.z).length())
		b.queue_free()
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


# a capsule a person's size (1.7 m tall, 0.3 m round), its middle at `at`
func _body(parent: Node, at: Vector3) -> CharacterBody3D:
	var b := CharacterBody3D.new()
	var c := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.7
	c.shape = cap
	b.add_child(c)
	parent.add_child(b)
	b.global_position = at
	return b
