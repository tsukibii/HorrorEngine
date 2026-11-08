## A shadow that isn't yours (docs/research/intensity.md §5.4; P.T.): you cast no shadow, so the one that crosses the
## wall in front of you belongs to someone behind you. Put it on a Node3D with the figure (her copy) as its child and
## set `lamp` (a lamp that casts shadows: a floor lamp, the street lamp through a window). Once armed (arm() from a
## signal), the next time you stand with that lamp behind you (within `behind_deg` of your back), within `range_m` of
## it and with a wall within `wall_m` ahead, she passes behind you: a figure that only casts a shadow, `behind_m` back
## toward the lamp, crossing `cross_m` behind your back over `secs`, so her shadow slides over the wall in front of you.
## Then nothing, and turning round shows nobody: there's no body to see. Once. `passed` when it's over.
extends Node3D

signal passed

@export var figure: Node3D                        ## who; empty: its first Node3D child
@export var lamp: Light3D                         ## the light behind you that throws her shadow
@export var armed := false
@export var behind_m := 0.7                       ## how far behind you she passes
@export var cross_m := 1.4                        ## how far she walks across behind you
@export var secs := 1.8                           ## how long it takes
@export var range_m := 6.0                        ## you're at most this far from the lamp
@export var behind_deg := 50.0                    ## the lamp is at most this far off straight behind you
@export var wall_m := 4.0                         ## a wall at most this far ahead to throw it on

var running := false
var done := false
var _t := 0.0
var _from := Vector3.ZERO
var _to := Vector3.ZERO


func _ready() -> void:
	if figure == null:
		for c in get_children():
			if c is Node3D:
				figure = c
				break
	if figure != null:
		figure.visible = false
		for g in [figure] + figure.find_children("*", "GeometryInstance3D", true, false):
			if g is GeometryInstance3D:
				(g as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY


func arm(_a = null, _b = null) -> void:
	if not done:
		armed = true


func _process(dt: float) -> void:
	if not armed or done or figure == null or lamp == null:
		return
	var cam := get_viewport().get_camera_3d()
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	if cam == null or pl == null:
		return
	if not running:
		if not lamp.is_visible_in_tree() or lamp.light_energy <= 0.01:
			return
		var you := pl.global_position
		var from_lamp := you - lamp.global_position
		from_lamp.y = 0.0
		var fwd := -cam.global_basis.z
		fwd.y = 0.0
		if from_lamp.length() > range_m or from_lamp.length() < behind_m + 0.3 or fwd.length() < 0.01:
			return
		if rad_to_deg(fwd.angle_to(from_lamp)) > behind_deg:
			return                                     # the lamp isn't behind you
		var q := PhysicsRayQueryParameters3D.create(cam.global_position, cam.global_position + fwd.normalized() * wall_m)
		q.exclude = [pl.get_rid()] if pl is CollisionObject3D else []
		if get_world_3d().direct_space_state.intersect_ray(q).is_empty():
			return                                     # nothing ahead to throw it on
		_lay(you)
		running = true
		_t = 0.0
		return
	_t += dt
	var k := clampf(_t / secs, 0.0, 1.0)
	_at(k)
	if k >= 1.0:
		figure.visible = false
		running = false
		done = true
		armed = false
		passed.emit()


## her way across behind someone standing at `you` (their feet), the lamp behind them
func _lay(you: Vector3) -> void:
	var from_lamp := you - lamp.global_position
	from_lamp.y = 0.0
	var back := -from_lamp.normalized()                # from you toward the lamp
	var side := back.cross(Vector3.UP).normalized()
	var mid := you + back * behind_m
	_from = mid - side * cross_m * 0.5
	_to = mid + side * cross_m * 0.5
	figure.global_rotation = Vector3(0.0, atan2(side.x, side.z), 0.0)   # her front (+Z) the way she walks
	_at(0.0)                                           # on her way before she's there
	figure.visible = true


func _at(k: float) -> void:
	figure.global_position = _from.lerp(_to, k * k * (3.0 - 2.0 * k))


## her shadow held `k` of the way across behind `you` (a picture's): nothing runs
func pose(you: Vector3, k := 0.5) -> void:
	_lay(you)
	_at(k)

