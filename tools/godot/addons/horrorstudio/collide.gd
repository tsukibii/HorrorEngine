## The player against Godot's own physics: a Director game (`game.collision: physics`, GodotPlugins/HorrorStudioDirector),
## whose levels are built in Godot's editor out of anything (CSG, imported models with their collision, the plugin's
## rooms), not only the plan's boxes. The player is a capsule floating a step above the feet, slid along what it
## touches (move_and_collide, a few slides a frame); the feet find the floor by a ray down, so a step lower than the
## walk's `step` is walked up and a drop is fallen, as the desk's boxes do. The cursor's ray and the cast's sight are
## physics rays: a hit is the thing whose node holds the collider, or a stub for a wall that's no thing (it still
## stops the ray). The export's games keep their boxes (play.gd's own collision: the desk's parity).
extends RefCounted

const WORLD := 1                # collision layer 1: the level's colliders
const INTERACT := 1 << 19       # layer 20: the areas a thing with no collider of its own is clicked by (the plugin makes them)
const GRAVITY := 9.8
const DEEP := 60.0              # how far down a floor is looked for before a fall is taken for a hole with none

var rt
var body: CharacterBody3D = null
var cap: CapsuleShape3D = null
var shape: CollisionShape3D = null
var fall := 0.0


func _init(rt_) -> void:
	rt = rt_


## the capsule, once a run, under the world (levels come and go round it)
func make() -> void:
	if body != null and is_instance_valid(body):
		return
	body = CharacterBody3D.new()
	body.name = "PlayerBody"
	body.collision_layer = 0
	body.collision_mask = WORLD
	body.motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	shape = CollisionShape3D.new()
	cap = CapsuleShape3D.new()
	shape.shape = cap
	body.add_child(shape)
	rt.game.world.add_child(body)
	body.global_position = rt.player.pos


func free_body() -> void:
	if body != null and is_instance_valid(body):
		body.queue_free()
	body = null


## the capsule's size from the walk's radius and step and the eye's height now (it shrinks crouched)
func fit(radius: float, step: float) -> void:
	var top: float = float(rt.player.eye) + 0.1
	var h: float = max(top - step, radius * 2.0 + 0.02)
	cap.radius = radius
	cap.height = h
	shape.position = Vector3(0, step + h / 2.0, 0)


func space() -> PhysicsDirectSpaceState3D:
	return rt.game.world.get_world_3d().direct_space_state


func _ray(from: Vector3, to: Vector3, mask: int, areas: bool, bodies: bool = true) -> Dictionary:
	var q := PhysicsRayQueryParameters3D.create(from, to, mask)
	q.collide_with_areas = areas
	q.collide_with_bodies = bodies
	if body != null and is_instance_valid(body):
		q.exclude = [body.get_rid()]
	return space().intersect_ray(q)


## the walk: dx, dz in metres this frame, slid along what's in the way, then the feet onto the floor
func move(dx: float, dz: float, s: Dictionary) -> void:
	make()
	var step := float(s["step"])
	fit(float(s["radius"]), step)
	body.global_position = rt.player.pos
	var motion := Vector3(dx, 0.0, dz)
	for i in 4:
		var c := body.move_and_collide(motion)
		if c == null:
			break
		var n := c.get_normal()
		n.y = 0.0                                       # a slope or a step's edge: slid along it level, the feet find its height
		if n.length() < 0.01:
			break
		motion = c.get_remainder().slide(n.normalized())
		if motion.length() < 1e-5:
			break
	var p: Vector3 = body.global_position
	p.y = float(rt.player.pos.y)
	rt.player.pos = p
	settle(step)


## the feet onto the floor: a floor within a step up or down is stood on; none, and the player falls toward the one
## below (or stays, over a hole with nothing under it)
func settle(step: float) -> void:
	var dt: float = min(0.05, rt.get_process_delta_time())
	var p: Vector3 = rt.player.pos
	var near = floor_y(p, step, step + 0.05)
	if near != null:
		p.y = float(near)
		fall = 0.0
	else:
		var deep = floor_y(p, step, DEEP)
		if deep == null:
			fall = 0.0
		else:
			fall += GRAVITY * dt
			p.y = max(float(deep), p.y - fall * dt)
			if p.y <= float(deep) + 1e-4:
				fall = 0.0
	rt.player.pos = p
	if body != null and is_instance_valid(body):
		body.global_position = p


## the top of the floor under a point: looked for from `up` above it to `down` below; null without one
func floor_y(p: Vector3, up: float, down: float) -> Variant:
	var h := _ray(p + Vector3(0, up, 0), p - Vector3(0, down, 0), WORLD, false)
	return float(h["position"].y) if not h.is_empty() else null


func ground_at(pos: Vector3, step: float) -> float:
	var g = floor_y(pos, step, DEEP)
	return float(g) if g != null else pos.y


## the floor's kind under the feet (the footsteps): the room's (`hs_floor`, the plugin's rooms) or a floor piece's tag
func floor_under(p: Vector3) -> String:
	var h := _ray(p + Vector3(0, 0.3, 0), p - Vector3(0, 1.0, 0), WORLD, false)
	if h.is_empty():
		return "wood"
	var n = h["collider"]
	while n != null and n is Node:
		if n.has_meta("hs_floor"):
			return str(n.get_meta("hs_floor"))
		if rt.by_node.has(n):
			var f = rt._tag(rt.by_node[n]["tags"], "floor:")
			if f != null:
				return f
		n = n.get_parent()
	return "wood"


## the thing a collider belongs to: the nearest node up from it that's a thing of the level
func thing_of(col) -> Variant:
	var n = col
	while n != null and n is Node:
		if rt.by_node.has(n):
			return rt.by_node[n]
		n = n.get_parent()
	return null


func stub(col) -> Dictionary:
	return {"id": null, "kind": "wall", "node": col, "piece": {}, "tags": [], "size": [0, 0, 0], "use": null, "hollow": false}


## a ray against the level's colliders (and the clickable areas with `areas`): {thing, dist, point, normal} or null
func ray(from: Vector3, dir: Vector3, far: float, areas: bool = false) -> Variant:
	var d := dir.normalized()
	var to := from + d * far
	var h := _ray(from, to, WORLD, false)
	if areas:
		var a := _ray(from, to, INTERACT, true, false)
		if not a.is_empty() and (h.is_empty() or from.distance_to(a["position"]) < from.distance_to(h["position"])):
			h = a
	if h.is_empty():
		return null
	var t = thing_of(h["collider"])
	return {"thing": t if t != null else stub(h["collider"]), "dist": from.distance_to(h["position"]), "point": h["position"], "normal": h["normal"]}


## what the eye points at (the cursor)
func aim() -> Variant:
	var cam: Camera3D = rt.game.camera
	return ray(cam.global_position, -cam.global_transform.basis.z, rt.LOOK_RANGE, true)


## a thing hidden (taken, gone) stops nothing and takes no click; shown, it does again
static func enable(n: Node, on: bool) -> void:
	if n == null:
		return
	if n is CollisionShape3D or n is CollisionPolygon3D:
		n.set_deferred("disabled", not on)
	for c in n.get_children():
		enable(c, on)
