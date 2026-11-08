## A moment for the dread director (dread.gd; docs/research/intensity.md §2.1, §4): something small that can happen
## between the story's own beats: three knocks on a door down the corridor, a door shutting far off, steps on the floor
## above, a handle tried from outside, a chain sliding behind a door. Put it where it happens (a Node3D at the door, on
## the ceiling) with a `sound` off the shelf, played there through the Sound node (so the walls muffle it), and/or a
## `target` whose fire() it calls (a scare area with Walk In off, an event area). The director picks among the ready
## ones; this says when it's ready:
## - `tier` 1 (a creak, a far door), 2 (steps above, a knock, a light dying), 3 (a shadow crossing, her glimpse);
## - `weight` (how often against the others), `cooldown` seconds before it can come again, `once`;
## - `needs` (the Story's words, as an area's), `near_m` to `far_m` from you;
## - `where`: anywhere, behind you, in view, or out of sight (beyond the walls or behind you).
extends Node3D

signal fired

@export var sound := ""                           ## off the shelf ("knock_three"), played here
@export var db := 0.0
@export var target: Node                          ## something to fire() too (empty: only the sound)
@export_range(1, 3) var tier := 1
@export var weight := 1.0
@export var cooldown := 180.0
@export var once := false
@export var needs := ""
@export var near_m := 0.0
@export var far_m := 40.0
@export_enum("anywhere", "behind", "in view", "out of sight") var where := "anywhere"

var count := 0                                    ## times it's come (a check's)
var last_at := -1e9                               ## the director's clock when it last came


func _ready() -> void:
	add_to_group("hs_dread_moment")


## whether it could come now (the director's clock `now`, the camera you see through)
func ready_now(now: float, cam: Camera3D) -> bool:
	if (once and count > 0) or now - last_at < cooldown:
		return false
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null and needs != "" and not st.holds(needs):
		return false
	var d := cam.global_position.distance_to(global_position)
	if d < near_m or d > far_m:
		return false
	match where:
		"behind":
			return (-cam.global_basis.z).dot(global_position - cam.global_position) < 0.0
		"in view":
			return cam.is_position_in_frustum(global_position) and _clear(cam)
		"out of sight":
			return not cam.is_position_in_frustum(global_position) or not _clear(cam)
	return true


## it happens (the director calls this; anything else may too)
func fire(_a = null, _b = null) -> void:
	count += 1
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if sound != "" and snd != null and snd.has_method("play"):
		snd.play(sound, global_position, db, "sfx")
	if target != null and target.has_method("fire"):
		target.fire()
	fired.emit()


func _clear(cam: Camera3D) -> bool:
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, global_position)
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [pl.get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit.is_empty() or (hit["position"] as Vector3).distance_to(global_position) < 0.3
