## HITBOXES (tools/godot/hitbox_check.py runs it): the weapons plugin's HSHitReact on bodies of different sizes
## (DECISIONS 2026-11-11: children and creatures are shot at too). For each body given (`--body=name=path`: a Studio
## export read at run time, or an imported scene), an HSHitReact under it: the sizes it measures from her bones (legs,
## arms, shoulders, head against an adult's), each hitbox's capsule (its bone, radius, length), her height; then a ray
## from in front of her at her chest's side (0.62 of the way from her spine to her shoulder joint): does it meet a
## hitbox. `--girth=N` on every body.
extends SceneTree

var out_dir := "res://"
var bodies: Array = []       # [name, path]
var girth := 1.0
var rep := {}


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--body="):
			var kv := a.substr(7).split("=", true, 1)
			bodies.append([kv[0], kv[1]])
		elif a.begins_with("--girth="):
			girth = float(a.substr(8))
	run.call_deferred()


func load_body(path: String) -> Node3D:
	if path.begins_with("res://") and ResourceLoader.exists(path):
		var ps = load(path)
		if ps is PackedScene:
			return ps.instantiate() as Node3D
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(path, st) != OK:
		return null
	return doc.generate_scene(st) as Node3D


func run() -> void:
	var x := 0.0
	for b in bodies:
		var who := load_body(b[1])
		var r := {"loaded": who != null}
		rep[b[0]] = r
		if who == null:
			continue
		root.add_child(who)
		who.position = Vector3(x, 0, 0)
		x += 6.0
		var react := HSHitReact.new()
		react.name = "HSHitReact"
		react.girth = girth
		who.add_child(react)
		for i in 6:
			await physics_frame
		r["sizes"] = react.sizes()
		var boxes := {}
		var sk: Skeleton3D = null
		for s in who.find_children("*", "Skeleton3D", true, false):
			sk = s
		for body in who.find_children("Hitbox_*", "AnimatableBody3D", true, false):
			var cs := body.get_child(0) as CollisionShape3D
			var cap := cs.shape as CapsuleShape3D
			boxes[str(body.name).substr(7)] = {"r": cap.radius, "h": cap.height, "part": str(body.get_meta("hs_part")), "layer": body.collision_layer}
		r["boxes"] = boxes
		var bb := AABB()
		var first := true
		for mi in who.find_children("*", "MeshInstance3D", true, false):
			var a: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
			bb = a if first else bb.merge(a)
			first = false
		r["tall"] = bb.size.y
		# a shot at her chest's side: from two metres in front, level with her upper spine, 0.62 of the way out to her shoulder's joint
		if sk != null:
			var sh := -1
			var chest := -1
			for i in sk.get_bone_count():
				var nm := sk.get_bone_name(i).to_lower()
				if sh < 0 and (nm == "l_uparm" or nm == "leftarm" or nm == "upperarm_l" or nm.ends_with(":leftarm")):
					sh = i
				if nm == "c_spine3" or nm == "spine2" or nm == "spine_03" or nm.ends_with(":spine2"):
					chest = i
			if sh >= 0 and chest >= 0:
				var ps := sk.global_transform * sk.get_bone_global_pose(sh).origin
				var pc := sk.global_transform * sk.get_bone_global_pose(chest).origin
				var at := Vector3(lerpf(pc.x, ps.x, 0.62), lerpf(pc.y, ps.y, 0.3), pc.z)
				var q := PhysicsRayQueryParameters3D.create(at + Vector3(0, 0, 2.0), at + Vector3(0, 0, -2.0), HSGun.SHOT_MASK)
				q.collide_with_bodies = true
				var hit := who.get_world_3d().direct_space_state.intersect_ray(q)
				r["side_shot"] = {"hit": not hit.is_empty(), "part": str((hit["collider"] as Node).get_meta("hs_part", "")) if not hit.is_empty() else "", "off_m": absf(at.x - pc.x), "half_shoulders": absf(ps.x - pc.x)}
	var f := FileAccess.open(out_dir.path_join("hitboxes.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(rep, "  "))
	f.close()
	print("HITBOXES {done}")
	quit()
