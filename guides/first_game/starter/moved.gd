## Something that isn't where you left it (DECISIONS 2026-11-12, after the seats: "things that make the player think,
## am I going crazy"). Put it on a thing (a chair, a doll, a picture frame, a cup). Once you've seen it, and only
## while you can't see it (out of your view, or something solid between), it changes a little: turned to face you,
## moved to the next of its marks, tipped over, or gone. Never while you look, never a sound unless you give it one.
## You look back and it's facing you. Was it?
##   what   face you:  it turns (about its own up) to face where you are, as far as `turn_max_deg` each time
##          next mark: it goes to the next Marker3D of `marks`, and takes that marker's turn
##          nudge:     it shifts `nudge_m` along its own floor, a little turned
##          tip:       it falls over (once)
##          vanish:    it isn't there any more (once); `target`'s fire() can bring something else
## How often: only after `unseen_secs` out of your sight, at most `times`, `cooldown` between, by `chance` each
## chance it gets, only while the Story's `needs` hold (`sanity:uneasy`: only once you're slipping), and with
## `far_m`, only when you're at least that far away. `moved(count)` when it does; fire() does it now if you can't see.
extends Node3D

const Sight := preload("res://starter/sight.gd")

signal moved(count: int)

@export_enum("face you", "next mark", "nudge", "tip", "vanish") var what := "face you"
@export var marks: Array[NodePath] = []             ## next mark: where it goes, in turn (Marker3Ds)
@export_range(0.0, 180.0) var turn_max_deg := 180.0  ## face you: the most it turns in one go
@export var nudge_m := 0.25                         ## nudge: how far it shifts
@export var times := 3                              ## at most this many changes (0: no end)
@export var unseen_secs := 4.0                      ## out of your sight this long first
@export var cooldown := 25.0                        ## seconds between changes
@export_range(0.0, 1.0) var chance := 0.6           ## each time it could
@export var far_m := 0.0                            ## only when you're at least this far (0: any)
@export var needs := ""                             ## the Story's words: only while they hold
@export var seen_first := true                      ## only once you've seen it where it was
@export var sound := ""                             ## off the shelf, played there as it changes (empty: silent)
@export var target: Node                            ## its fire() called as it changes
@export var size_m := 0.8                           ## about how big it is: seen when its middle or its top is

var count := 0                                      ## changes so far
var was_seen := false                               ## you've looked at it
var _unseen := 0.0
var _rest := 0.0
var _mark := 0
var _tried := false


func _cam() -> Camera3D:
	return get_viewport().get_camera_3d() if get_viewport() != null else null


## Whether the player can see it now (its middle or its top in the frame, widened a little, nothing solid between).
func seen() -> bool:
	var cam := _cam()
	if cam == null or not is_visible_in_tree():
		return false
	var pl := get_tree().get_first_node_in_group("hs_player")
	for h in [size_m * 0.5, size_m * 0.95, 0.05]:
		var p: Vector3 = global_position + Vector3.UP * h
		if Sight.in_frame(cam, p, 12.0) and _clear(cam.global_position, p, pl):
			return true
	return false


func _clear(a: Vector3, b: Vector3, pl: Node) -> bool:
	var q := PhysicsRayQueryParameters3D.create(a, b, 1)
	if pl is CollisionObject3D:
		q.exclude = [(pl as CollisionObject3D).get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit.is_empty() or (hit["position"] as Vector3).distance_to(b) < size_m * 0.6   # (its own collider is it)


func _process(dt: float) -> void:
	_rest = maxf(0.0, _rest - dt)
	if seen():
		was_seen = true
		_unseen = 0.0
		_tried = false
		return
	_unseen += dt
	if _tried or _unseen < unseen_secs or _rest > 0.0 or (times > 0 and count >= times) or (seen_first and not was_seen):
		return
	_tried = true                                   # one chance each time you look away
	if randf() <= chance:
		change()


## It changes now, if it may (unseen, its needs, its distance). True when it did.
func change() -> bool:
	if seen() or not is_visible_in_tree() or (times > 0 and count >= times):
		return false
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null and (bool(st.get("over")) or (st.has_method("card_up") and st.card_up())):
		return false
	if needs != "" and (st == null or not st.has_method("holds") or not st.holds(needs)):
		return false
	var cam := _cam()
	if cam != null and far_m > 0.0 and cam.global_position.distance_to(global_position) < far_m:
		return false
	match what:
		"next mark":
			if marks.is_empty():
				return false
			var m := get_node_or_null(marks[_mark % marks.size()]) as Node3D
			_mark += 1
			if m == null:
				return false
			global_transform = Transform3D(m.global_basis.orthonormalized() * Basis.from_scale(global_basis.get_scale()), m.global_position)
		"nudge":
			var a := randf() * TAU
			global_position += Vector3(cos(a), 0.0, sin(a)) * nudge_m
			rotate_y(deg_to_rad(randf_range(-25.0, 25.0)))
		"tip":
			rotate_object_local(Vector3.RIGHT if randf() < 0.5 else Vector3.BACK, deg_to_rad(90.0))
			global_position.y += size_m * 0.15
			times = count + 1
		"vanish":
			visible = false
			times = count + 1
		_:
			if cam == null:
				return false
			var to := cam.global_position - global_position
			var want := atan2(-to.x, -to.z)
			var d := wrapf(want - global_rotation.y, -PI, PI)
			global_rotation.y += clampf(d, -deg_to_rad(turn_max_deg), deg_to_rad(turn_max_deg))
	count += 1
	_rest = cooldown
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if sound != "" and snd != null and snd.has_method("play"):
		snd.play(sound, global_position, -6.0, "sfx")
	if target != null and target.has_method("fire"):
		target.fire()
	moved.emit(count)
	return true


## an area's or a cue's target: change now, if you can't see it
func fire(_a = null) -> void:
	change()
