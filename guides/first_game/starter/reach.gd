## A collider for a thing you use with E (pickup.gd, note.gd): a StaticBody3D with a box round what's drawn under the
## thing, made when the game runs (never saved), so the player's aim finds it even inside a room's own collider. `grow`
## metres added all round, at least `least` across (a key is hard to hit).
extends RefCounted


static func make(n: Node3D, grow := 0.03, least := 0.14) -> StaticBody3D:
	var box := AABB()
	var first := true
	var meshes: Array = n.find_children("*", "GeometryInstance3D", true, false)
	if n is GeometryInstance3D:
		meshes.append(n)
	for g in meshes:
		var ab: AABB = (g as GeometryInstance3D).get_aabb()
		if ab.size == Vector3.ZERO:
			continue
		var local: AABB = n.global_transform.affine_inverse() * (g as Node3D).global_transform * ab
		box = local if first else box.merge(local)
		first = false
	if first:
		box = AABB(Vector3(-least / 2.0, 0.0, -least / 2.0), Vector3(least, least, least))
	box = box.grow(grow)
	var c := box.get_center()
	var size := Vector3(maxf(box.size.x, least), maxf(box.size.y, least), maxf(box.size.z, least))
	var body := StaticBody3D.new()
	body.name = "_reach"
	var shape := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	shape.shape = bs
	shape.position = c
	body.add_child(shape)
	n.add_child(body)
	return body
