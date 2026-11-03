## EXPORTS' probe (tools/godot/exports_check.py): each .glb in the project's root as a person drags it in, its scene
## instanced and measured: what Godot made of its nodes (meshes, static bodies and their shapes, occluders, lights,
## skeletons, blend shapes), its markers' metadata, a ray down from the player's start (or a room's middle) onto the
## floor's collider and one level from it into the nearest wall, each door's node with its own collider. Prints a line
## `EXPROBE <file> <json>` a file and quits.
##   godot --headless --path PROJECT -s exports_probe.gd
extends SceneTree


func _initialize() -> void:
	var files: Array = []
	for f in DirAccess.get_files_at("res://"):
		if f.ends_with(".glb"):
			files.append(f)
	files.sort()
	for f in files:
		var ps := load("res://" + f) as PackedScene
		if ps == null:
			print("EXPROBE %s %s" % [f, JSON.stringify({"error": "didn't import"})])
			continue
		var n := ps.instantiate() as Node3D
		root.add_child(n)
		await physics_frame
		await physics_frame
		print("EXPROBE %s %s" % [f, JSON.stringify(_measure(n))])
		n.queue_free()
		await process_frame
	quit()


func _measure(n: Node3D) -> Dictionary:
	var base: Node = n                                     # the export's own group: the file's root has it as its child
	for c in n.get_children():
		for k in ["visual", "markers", "insides", "lamps"]:
			if c.get_node_or_null(k) != null:
				base = c
	var counts := {}
	var shapes := 0
	var blend := []
	var textured := 0
	var mats := 0
	for c in n.find_children("*", "", true, false):
		var k := c.get_class()
		counts[k] = int(counts.get(k, 0)) + 1
		if c is CollisionShape3D and (c as CollisionShape3D).shape != null:
			shapes += 1
		if c is MeshInstance3D and (c as MeshInstance3D).mesh != null:
			var m := (c as MeshInstance3D).mesh
			if m is ArrayMesh:
				for i in (m as ArrayMesh).get_blend_shape_count():
					blend.append(str((m as ArrayMesh).get_blend_shape_name(i)))
			for s in m.get_surface_count():
				var mat := m.surface_get_material(s)
				if mat is BaseMaterial3D:
					mats += 1
					if (mat as BaseMaterial3D).albedo_texture != null:
						textured += 1
	var markers := {}
	var mk := base.get_node_or_null("markers")
	if mk:
		for c in mk.get_children():
			markers[str(c.name)] = c.get_meta("extras", {}) if c.has_meta("extras") else {}
	var doors := []
	var dn := base.get_node_or_null("doors")
	if dn:
		for d in dn.get_children():
			doors.append({"name": str(d.name), "body": d.find_children("*", "StaticBody3D", true, false).size(), "meta": d.get_meta("extras", {}) if d.has_meta("extras") else {}})
	var top := []
	for c in base.get_children():
		top.append(str(c.name))
	var out := {"top": top, "counts": counts, "shapes": shapes, "blend": blend.size(), "blend_names": blend.slice(0, 400), "materials": mats, "textured": textured, "markers": markers, "doors": doors,
		"meta": base.get_meta("extras", {}) if base.has_meta("extras") else {}}
	# a ray down onto the floor where the player starts (or in a room's trigger volume's middle), then level into a wall
	var from = null
	var start := base.get_node_or_null("markers/player_start") as Node3D
	if start:
		from = start.global_position
	elif mk and mk.get_child_count():
		from = (mk.get_child(0) as Node3D).global_position
	if from != null:
		var space := n.get_world_3d().direct_space_state
		var hit := space.intersect_ray(PhysicsRayQueryParameters3D.create(from + Vector3(0, 1.0, 0), from + Vector3(0, -3.0, 0)))
		out["floor"] = {"from": [from.x, from.y, from.z], "hit": hit.position.y if hit else null}
		if hit:
			var eye: Vector3 = hit.position + Vector3(0, 1.2, 0)
			var best := INF
			for dir in [Vector3.FORWARD, Vector3.BACK, Vector3.LEFT, Vector3.RIGHT]:
				var h2 := space.intersect_ray(PhysicsRayQueryParameters3D.create(eye, eye + dir * 30.0))
				if h2:
					best = min(best, eye.distance_to(h2.position))
			out["wall"] = best if best < INF else null
	return out
