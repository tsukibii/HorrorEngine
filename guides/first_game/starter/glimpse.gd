## The corner of your eye (docs/research/intensity.md §5.1): a figure there only while it's off to the side of where you
## look, never where you look. Put it on a Node3D at the spot (a doorway it leans out of) with the figure as its child
## (her copy, hidden: it's shown here). Once armed it waits until the spot is `min_deg` to `max_deg` off your view's
## centre (30 to 42°: the edge of vision sees little detail but catches movement and fear), `near_m` to `far_m` away,
## nothing in between; then it's there, for `hold` seconds at most. It goes the moment you turn toward it (faster than
## `swing` degrees a second) or it comes within `gone_deg` of where you look, and it never vanishes in plain view: out of
## frame, behind something, or in a flicker of `flicker` (a lamp that blinks out 100 to 200 ms as it goes). Never while
## the view is already swinging toward it, nor under a note's card. No sound: with a sting it's a jump scare. A few an
## hour, each somewhere new; never a clue you need.
extends Node3D

signal glimpsed                                   ## it's there now
signal gone

@export var figure: Node3D                        ## what's seen; empty: its first Node3D child
@export var armed := false                        ## watching (or arm() from a signal)
@export var times := 1                            ## glimpses before it's spent
@export var min_deg := 30.0
@export var max_deg := 42.0
@export var near_m := 5.0
@export var far_m := 15.0
@export var hold := 1.2                           ## seconds it stays at most
@export var swing := 60.0                         ## degrees a second toward it that makes it go
@export var gone_deg := 25.0
@export var flicker: Light3D                      ## a lamp that blinks out as it goes (when it has to go in view)

const Lights := preload("res://starter/lights.gd")

var shown := false
var count := 0                                    ## glimpses so far (a check's)
var went_at := -1.0                               ## degrees off where you looked when it last went (a check's)
var _t := 0.0
var _prev := -1.0


func _ready() -> void:
	if figure == null:
		for c in get_children():
			if c is Node3D:
				figure = c
				break
	if figure != null:
		figure.visible = false


func arm(_a = null, _b = null) -> void:
	armed = true


## how far off the view's centre it is (degrees), and how far away (m); [-1, -1] when there's no camera
func off_view() -> Array:
	var cam := get_viewport().get_camera_3d() if get_viewport() else null
	if cam == null:
		return [-1.0, -1.0]
	var at := global_position + Vector3(0, 1.3, 0)
	var to := at - cam.global_position
	var fwd := -cam.global_basis.z
	return [rad_to_deg(fwd.angle_to(to.normalized())), to.length()]


func _process(dt: float) -> void:
	if not armed or figure == null:
		return
	var o := off_view()
	var ang: float = o[0]
	var d: float = o[1]
	if ang < 0.0:
		return
	var toward := (_prev - ang) / maxf(dt, 0.0001) if _prev >= 0.0 else 0.0   # degrees a second the view turns toward it
	_prev = ang
	if not shown:
		var story := get_tree().get_first_node_in_group("hs_story")
		var card: bool = story != null and story.has_method("card_up") and story.card_up()
		if count < times and not card and toward < swing * 0.5 and ang > min_deg and ang < max_deg and d > near_m and d < far_m and _clear():
			shown = true
			_t = 0.0
			figure.visible = true
			count += 1
			glimpsed.emit()
		return
	_t += dt
	var cam := get_viewport().get_camera_3d()
	var in_frame := cam.is_position_in_frustum(global_position + Vector3(0, 1.3, 0))
	if toward > swing or ang < gone_deg:
		_go(in_frame and _clear(), ang)                # turning to it: gone before it's looked at
	elif _t > hold and (not in_frame or not _clear()):
		_go(false, ang)                                # its time's up: once it's out of sight
	elif _t > hold * 2.5:
		_go(true, ang)


func _go(in_view: bool, ang: float) -> void:
	shown = false
	figure.visible = false
	went_at = ang
	if count >= times:
		armed = false
	if in_view:                                        # it can't just vanish in view: the lamp blinks out as it goes
		Lights.blink(get_tree(), flicker, randf_range(0.1, 0.2), false)
	gone.emit()


func _clear() -> bool:
	var cam := get_viewport().get_camera_3d()
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, global_position + Vector3(0, 1.3, 0))
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [pl.get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit.is_empty() or (hit.collider is Node and is_ancestor_of(hit.collider))
