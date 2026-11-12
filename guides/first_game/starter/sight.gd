## What the player can see, for the starter scripts that must happen in view or out of it (hunt.gd, hunt_spot.gd):
## static functions over the player's camera. Preload it:
##     const Sight := preload("res://starter/sight.gd")
##     if Sight.seen(cam, point, [player]): ...
extends RefCounted


## degrees between where the camera looks and a point
static func off_deg(cam: Camera3D, p: Vector3) -> float:
	var to := p - cam.global_position
	if to.length() < 0.001:
		return 0.0
	return rad_to_deg((-cam.global_basis.z).angle_to(to.normalized()))


## a point inside the camera's frame (widened by `margin_deg` on every side; nothing asked about walls)
static func in_frame(cam: Camera3D, p: Vector3, margin_deg := 0.0) -> bool:
	var l := cam.global_transform.affine_inverse() * p
	if l.z > -0.05:
		return false
	var size := cam.get_viewport().get_visible_rect().size if cam.is_inside_tree() else Vector2(16, 9)
	var aspect := size.x / maxf(size.y, 1.0)
	var half_v := deg_to_rad(cam.fov * 0.5 + margin_deg)
	var half_h := atan(tan(deg_to_rad(cam.fov * 0.5)) * aspect) + deg_to_rad(margin_deg)
	return absf(atan2(l.x, -l.z)) <= half_h and absf(atan2(l.y, -l.z)) <= half_v


## nothing solid between two points (the world's layer 1; `skip` bodies left out: the player)
static func clear(from_node: Node3D, a: Vector3, b: Vector3, skip: Array = []) -> bool:
	var q := PhysicsRayQueryParameters3D.create(a, b, 1)
	var rids: Array[RID] = []
	for s in skip:
		if s is CollisionObject3D:
			rids.append((s as CollisionObject3D).get_rid())
	q.exclude = rids
	return from_node.get_world_3d().direct_space_state.intersect_ray(q).is_empty()


## a point in the frame with nothing in the way
static func seen(cam: Camera3D, p: Vector3, skip: Array = [], margin_deg := 0.0) -> bool:
	return in_frame(cam, p, margin_deg) and clear(cam, cam.global_position, p, skip)


## someone standing at `feet` seen: her head, her middle or her feet
static func figure_seen(cam: Camera3D, feet: Vector3, head_m: float, skip: Array = [], margin_deg := 0.0) -> bool:
	for h in [head_m, head_m * 0.55, 0.12]:
		if seen(cam, feet + Vector3.UP * h, skip, margin_deg):
			return true
	return false


## the player in light: their flashlight on, or a lamp that's on reaching where they stand with nothing in the way
## (never the sun or the moon). What sanity.gd calls the dark is this being false
static func in_light(pl: Node3D) -> bool:
	if pl == null or not pl.is_inside_tree():
		return true
	var t := pl.get_node_or_null("Eye/Flashlight") as Light3D
	if t != null and t.visible and not bool(t.get("is_dead")) and t.light_energy > 0.02:
		return true
	var at := pl.global_position + Vector3.UP
	for l in pl.get_tree().root.find_children("*", "Light3D", true, false):
		var li := l as Light3D
		if li == t or li is DirectionalLight3D or not li.is_visible_in_tree() or li.light_energy <= 0.05:
			continue
		if li.has_meta("hs_lit") and not bool(li.get_meta("hs_lit")):
			continue
		var reach := float(li.get("omni_range")) if li is OmniLight3D else float(li.get("spot_range"))
		if li.global_position.distance_to(at) <= reach * 0.8 and clear(pl, li.global_position, at, [pl]):
			return true
	return false
