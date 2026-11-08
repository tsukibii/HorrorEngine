## Closer each time you look away (docs/research/intensity.md §5.2; Japan's daruma-san ga koronda, Condemned's
## mannequins: "I would turn around to see more mannequins than before, inching their way towards me, although I never
## saw them physically move"): a figure that moves only while you aren't looking, a mark at a time, toward you.
## Put it on a Node3D with its marks as Marker3D children, far to near (each facing where she looks: a marker's -Z), and
## the figure (her copy) as another child. Armed (`armed`, or arm() from a signal: an area's `entered`), she's on the
## first mark the first moment it's unseen; each time she's been unseen for `unseen_secs` she steps to the next mark,
## only onto one that's unseen too, turned a little more toward you each time. **Unseen** means all of it: outside your
## view widened by `margin_deg` on every side, the rays from your eye to her head, her middle and her feet all stopped
## by something, and in no mirror (the Look plugin's HSMirror) you can see. After the last mark the last step is
## `behind_m` (0.35 m) behind your eye, silent, facing your back (and again behind you if you walk on without turning);
## turn round and she's there (`caught`), and after `stare` seconds she's gone in a blink: `blink`'s lamp and your
## flashlight out for 100 to 200 ms. Look away instead and she's gone. She never moves while she's seen, and never goes
## in plain view: come within `reach_m` of her and she's gone in a blink; walk `leave_m` away and she's gone unseen.
extends Node3D

signal stepped(mark: int)                         ## she's on a mark now (the marks' count: behind you)
signal caught                                     ## you turned round and she was there
signal gone

const Lights := preload("res://starter/lights.gd")

@export var figure: Node3D                        ## who moves; empty: its first child that isn't a Marker3D
@export var armed := false                        ## watching (or arm() from a signal)
@export var unseen_secs := 1.5                    ## seconds unseen before each step
@export var margin_deg := 15.0                    ## your view widened by this on every side (an arm at the frame's edge)
@export var behind := true                        ## the last step behind you (off: she stays on the last mark)
@export var behind_m := 0.35                      ## how far behind your eye
@export var stare := 0.8                          ## seconds she's looked at behind you before she goes
@export var give_up := 30.0                       ## seconds behind you, never caught, before she goes (unseen)
@export var reach_m := 0.9                        ## you come this close to her on a mark: gone in a blink
@export var leave_m := 9.0                        ## you're this far from her: gone (once she's unseen)
@export var blink: Light3D                        ## a lamp that blinks out as she goes (your flashlight always does)
@export var head_y := 1.5                         ## her head over her feet (the rays' top point)

var mark := -1                                    ## the mark she's on (-1: not out yet; the marks' count: behind you)
var seen := false                                 ## seen now (a check's)
var moved_seen := 0                               ## steps taken while seen (a check's: always 0)
var marks: Array = []                             ## the Marker3Ds, far to near
var _unseen := 0.0
var _caught := -1.0
var _behind_t := 0.0
var _done := false
var _at := Vector3.ZERO                           # where the player stood when she stepped behind


func _ready() -> void:
	for c in get_children():
		if c is Marker3D:
			marks.append(c)
		elif figure == null and c is Node3D:
			figure = c
	if figure != null:
		figure.visible = false


func arm(_a = null, _b = null) -> void:
	if not _done:
		armed = true


func _process(dt: float) -> void:
	if not armed or _done or figure == null or marks.is_empty():
		return
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	if mark < 0:                                       # out onto the first mark, unseen
		if not _sees(cam, marks[0].global_position):
			_place(0, marks[0].global_position, cam)
		return
	seen = _sees(cam, figure.global_position)
	var you := _feet(cam)
	var near := Vector2(figure.global_position.x - you.x, figure.global_position.z - you.z).length()
	var last := marks.size()
	if mark == last:                                   # behind you
		if seen:
			if _caught < 0.0:
				_caught = 0.0
				caught.emit()
			_caught += dt
			if _caught >= stare:
				_go(true)
		elif _caught >= 0.0:
			_go(false)                                 # you looked away again: gone
		else:
			_behind_t += dt
			if _behind_t > give_up:
				_go(false)
			elif you.distance_to(_at) > 1.2:           # you walked on without turning: behind you again
				var p = _behind_spot(cam)
				if p != null:
					_place(last, p, cam)
		return
	if near < reach_m:
		_go(seen)
		return
	if near > leave_m and not seen:
		_go(false)
		return
	if seen:
		_unseen = 0.0
		return
	_unseen += dt
	if _unseen < unseen_secs:
		return
	var nxt := mark + 1
	if nxt < last:
		if not _sees(cam, marks[nxt].global_position):
			_place(nxt, marks[nxt].global_position, cam)
	elif behind:
		var p = _behind_spot(cam)
		if p != null:
			_place(last, p, cam)


func _place(i: int, p: Vector3, cam: Camera3D) -> void:
	if seen:
		moved_seen += 1
	var you := _feet(cam)
	var to := you - p
	var face := atan2(to.x, to.z)                      # her front (+Z, a glTF character's) to you
	var yaw := face
	if i < marks.size():                               # a mark's own facing, turned a little more to you each time
		var f: Vector3 = -(marks[i] as Node3D).global_basis.z
		yaw = lerp_angle(atan2(f.x, f.z), face, float(i) / float(marks.size()))
	figure.global_position = p
	figure.global_rotation = Vector3(0.0, yaw, 0.0)
	figure.visible = true
	mark = i
	_unseen = 0.0
	_at = you
	stepped.emit(i)


func _go(in_view: bool) -> void:
	_done = true
	armed = false
	figure.visible = false
	if in_view:                                        # never in plain view: the lights blink and she's gone in it
		Lights.blink(get_tree(), blink, randf_range(0.1, 0.2))
	gone.emit()


## the spot `behind_m` behind your eye, at your feet's height (null when a wall's there)
func _behind_spot(cam: Camera3D):
	var back := cam.global_basis.z
	back.y = 0.0
	if back.length() < 0.01:
		return null
	back = back.normalized()
	var eye := cam.global_position
	var q := PhysicsRayQueryParameters3D.create(eye, eye + back * (behind_m + 0.3))
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [pl.get_rid()]
	if not get_world_3d().direct_space_state.intersect_ray(q).is_empty():
		return null
	var you := _feet(cam)
	return Vector3(eye.x, you.y, eye.z) + back * behind_m


func _feet(cam: Camera3D) -> Vector3:
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	return pl.global_position if pl != null else cam.global_position - Vector3(0, 1.6, 0)


## whether she'd be seen standing at `p` (her feet): her head, her middle or her feet
func _sees(cam: Camera3D, p: Vector3) -> bool:
	for h: float in [head_y, head_y * 0.6, 0.15]:
		var pt: Vector3 = p + Vector3.UP * h
		if _in_view(cam, pt) and _clear(cam.global_position, pt):
			return true
		if _in_mirror(cam, pt):
			return true
	return false


## inside the camera's view widened by margin_deg
func _in_view(cam: Camera3D, p: Vector3) -> bool:
	var lp := cam.global_transform.affine_inverse() * p
	if lp.z > -0.01:
		return false
	var size := get_viewport().get_visible_rect().size
	var aspect := size.x / maxf(size.y, 1.0)
	var half := deg_to_rad(cam.fov) * 0.5
	var hv := half
	var hh := atan(tan(half) * aspect)
	if cam.keep_aspect == Camera3D.KEEP_WIDTH:
		hh = half
		hv = atan(tan(half) / aspect)
	var m := deg_to_rad(margin_deg)
	return atan2(absf(lp.x), -lp.z) < hh + m and atan2(absf(lp.y), -lp.z) < hv + m


func _clear(from: Vector3, to: Vector3, slack := 0.0) -> bool:
	var q := PhysicsRayQueryParameters3D.create(from, to)
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [pl.get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty() or (hit.collider is Node and figure.is_ancestor_of(hit.collider)):
		return true
	return from.distance_to(hit["position"]) >= from.distance_to(to) - slack


## seen in a mirror you can see (HSMirror: its glass in view, she in its camera's)
func _in_mirror(cam: Camera3D, p: Vector3) -> bool:
	for m in get_tree().get_nodes_in_group("hs_mirror"):
		var mc = m.get("mcam")
		var mi = m.get("mi")
		if not (mc is Camera3D) or not (mi is MeshInstance3D) or not (mi as Node3D).is_visible_in_tree():
			continue
		var c: Vector3 = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb().get_center()
		if not cam.is_position_in_frustum(c) or not _clear(cam.global_position, c, 0.15):
			continue
		if (mc as Camera3D).is_position_in_frustum(p) and _clear(c + (p - c).normalized() * 0.05, p):
			return true
	return false
