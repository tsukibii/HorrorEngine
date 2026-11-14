## The player of a game built by hand (guides/first_game, guides/tutorial_v2): a body you walk with WASD (Shift runs),
## look with the mouse, E uses what's in front of you (anything with a use() method: a door from an interior's export, a
## pickup, a note) or puts a note's card away, F the flashlight (flashlight.gd's batteries when it has them), Esc lets
## the mouse go (a click takes it back). The camera is the player's eye. It steps up what's no higher than
## `step_height` (a kerb, a genkan's step, a stair's tread): Godot's CharacterBody3D takes any step for a wall. In the
## group hs_player (the other starter scripts find it so); it stops when the Story ends. Its footsteps: one a stride
## walked (footsteps.gd), the floor's own off the sound shelf through the Sound node (sound.gd step(): carpet, concrete,
## wood, wet), traced through the room like every sound. A seat (seat.gd) sits you down or lays you down: the eye
## where the seat says (worked out from its furniture: over the chair's seat, on the bed's pillow), eased there over
## `settle_secs` as a head would go, the body resting on what's under it, your head turning only as far as a head
## does there; E or a step gets you up where you stood. doing() says what you're
## doing (standing, walking, running, sitting, lying, hiding), which a cue (cue.gd) asks. Space holds your breath (the
## Fear node's breathing stops) for up to `breath_secs`; past it you gasp, loud. Your steps (louder running), a gasp
## and the doors you use are noises a searcher (searcher.gd) hears (noise.gd).
extends CharacterBody3D

const Footsteps := preload("res://starter/footsteps.gd")
const Noises := preload("res://starter/noise.gd")

signal stepped(at: Vector3, run: bool)  ## each footstep (behind_you.gd answers them)
signal sat(seat: Node)                  ## sat down or lay down (seat.gd)
signal stood                            ## up again
signal gasped                           ## you held your breath too long

@export var walk_speed := 1.6          ## metres a second
@export var run_speed := 3.2
@export var mouse_turn := 0.0025       ## radians a pixel
@export var reach := 2.0               ## how far E reaches
@export var gravity := 9.8
@export var step_height := 0.5         ## the highest step it walks up
@export var breath_secs := 8.0         ## how long you can hold your breath (Space)
@export var gasp_sound := "breath_02"  ## off the shelf: the gasp when you can't any longer
@export var settle_secs := 0.35        ## how long the eye takes down onto a seat and up again (0: at once)

var pitch := 0.0
var steps := Footsteps.new()
var steps_heard := 0                    ## footsteps played (a check's)
var pose := "standing"                  ## standing, sitting, lying or hiding (a seat's)
var holding := false                    ## holding your breath now (Space)
var breath_left := 8.0
var _gasp_wait := 0.0
var seat: Node3D = null                 ## the seat you're on
var _was := Vector3.INF
var _stood := Transform3D()             # where you stood before you sat
var _stood_pitch := 0.0
var _eye_y := 1.6
var _eye_now := 1.6                     # the eye's height over your feet now (lower on a seat)
var _ease_from := Transform3D()         # the eye easing onto a seat or up: where it was
var _ease_t := -1.0                     # 0..1 (-1: not easing)
var _seat_yaw := 0.0                    # the way the seat faces, and how far your head turns from it
var _look_side := PI
var _look_lo := -1.4
var _look_hi := 1.4
@onready var eye: Camera3D = $Eye
@onready var aim: RayCast3D = $Eye/Aim
@onready var torch: SpotLight3D = $Eye/Flashlight


func _ready() -> void:
	add_to_group("hs_player")
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	aim.target_position = Vector3(0, 0, -reach)
	aim.add_exception(self)
	aim.collision_mask |= 2                  # and layer 2: the seats (seat.gd), which only E finds
	eye.cull_mask &= ~(1 << 18)              # layer 19: what's only in mirrors (the Look plugin's HSMirror.MIRROR_ONLY) is never seen straight
	_eye_y = eye.position.y
	_eye_now = _eye_y
	breath_left = breath_secs


func _unhandled_input(e: InputEvent) -> void:
	if ended():
		return
	if e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		turn(e.relative)
	elif e is InputEventMouseButton and e.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif e is InputEventKey and e.pressed and not e.echo:
		match e.physical_keycode:
			KEY_ESCAPE: Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			KEY_E:
				var st := story()
				if st != null and st.card_up():
					st.close_card()
				elif seat != null:
					seat.use(self)                # up again
				else:
					use()
			KEY_F:
				if torch.has_method("toggle"):
					torch.toggle()
				else:
					torch.visible = not torch.visible


## the look turned by a move of the mouse (pixels). On a seat a head turns only so far (the seat's look_limits()).
func turn(by: Vector2) -> void:
	rotate_y(-by.x * mouse_turn)
	if seat != null and _look_side < PI:
		rotation.y = _seat_yaw + clampf(wrapf(rotation.y - _seat_yaw, -PI, PI), -_look_side, _look_side)
	pitch = clamp(pitch - by.y * mouse_turn, _look_lo if seat != null else -1.4, _look_hi if seat != null else 1.4)
	if _ease_t < 0.0:
		eye.rotation.x = pitch


## the Story node (story.gd), if the scene has one
func story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


func ended() -> bool:
	var st := story()
	return st != null and bool(st.get("over"))


## your breath: held while Space is down (the Fear node's breathing stops), up to breath_secs; then a gasp, loud, and
## a few seconds before you can again
func _process(dt: float) -> void:
	if _ease_t >= 0.0:                               # the eye on its way onto a seat, or up from it
		_ease_t += dt / maxf(0.01, settle_secs)
		var k := smoothstep(0.0, 1.0, clampf(_ease_t, 0.0, 1.0))
		var to := global_transform * Transform3D(Basis(Vector3.RIGHT, pitch), Vector3(0, _eye_now, 0))
		if _ease_t >= 1.0:
			_ease_t = -1.0
			eye.transform = Transform3D(Basis(Vector3.RIGHT, pitch), Vector3(0, _eye_now, 0))
		else:
			eye.global_transform = _ease_from.interpolate_with(to, k)
	var want := Input.is_physical_key_pressed(KEY_SPACE) and _gasp_wait <= 0.0 and not ended()
	var fear := get_tree().get_first_node_in_group("hs_fear")
	if want and not holding:
		holding = true
		if fear != null:
			fear.hold_breath(true)
	elif holding and not want:
		holding = false
		if fear != null:
			fear.hold_breath(false)
	if holding:
		breath_left -= dt
		if breath_left <= 0.0:
			holding = false
			_gasp_wait = 3.0
			if fear != null:
				fear.hold_breath(false)
			var snd := get_tree().get_first_node_in_group("hs_sound")
			if snd != null and snd.has_method("play"):
				snd.play(gasp_sound, Vector3.INF, 0.0, "foley")
			Noises.make(get_tree(), eye.global_position, Noises.GASP)
			gasped.emit()
	else:
		breath_left = minf(breath_secs, breath_left + dt * 1.5)
		_gasp_wait = maxf(0.0, _gasp_wait - dt)


## what you're doing now: sitting, lying or hiding while on a seat, else running, walking or standing by how fast you go
func doing() -> String:
	if seat != null:
		return pose
	var v := Vector2(velocity.x, velocity.z).length()
	if v > (walk_speed + run_speed) * 0.5:
		return "running"
	if v > 0.25:
		return "walking"
	return "standing"


## onto a seat (seat.gd calls this): turned its way, the eye where the seat says (its eye_transform(): worked out
## from the furniture, or the seat's own place) and tilted up by its look_up_deg, the body resting on what's under it
## (the chair's seat, the mattress); nothing moves you until you rise(). The eye goes there over settle_secs. An eye
## that would be inside what's under it (an interior's export makes each piece of furniture a solid box to its top)
## goes just over it instead: inside, every sound would come through the box's walls.
func settle(s: Node3D) -> void:
	if seat != null:
		return
	seat = s
	pose = str(s.get("pose")) if s.get("pose") != null else "sitting"
	_stood = global_transform
	_stood_pitch = pitch
	velocity = Vector3.ZERO
	var eye_was := eye.global_transform
	var et: Transform3D = s.eye_transform(_eye_y) if s.has_method("eye_transform") else Transform3D(Basis(Vector3.UP, s.global_rotation.y), s.global_position)
	var at := et.origin
	var lid := PhysicsRayQueryParameters3D.create(at + Vector3.UP * 0.35, at + Vector3.DOWN * 0.05, 1)
	lid.exclude = [get_rid()]
	var over := get_world_3d().direct_space_state.intersect_ray(lid)
	if not over.is_empty():
		at.y = (over["position"] as Vector3).y + 0.06
	var ground := at.y - _eye_y
	var q := PhysicsRayQueryParameters3D.create(at, at + Vector3.DOWN * (_eye_y + 0.5), 1)   # the world under it (not the seats' layer 2)
	q.exclude = [get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty():
		ground = (hit["position"] as Vector3).y
	_seat_yaw = et.basis.get_euler().y
	global_transform = Transform3D(Basis(Vector3.UP, _seat_yaw), Vector3(at.x, ground, at.z))
	_eye_now = at.y - ground
	pitch = deg_to_rad(float(s.get("look_up_deg") if s.get("look_up_deg") != null else 0.0))
	var lim: Vector3 = s.look_limits() if s.has_method("look_limits") else Vector3(180, 80, 80)
	_look_side = deg_to_rad(lim.x) if lim.x < 179.5 else PI
	_look_lo = -deg_to_rad(minf(lim.y, 80.0))
	_look_hi = deg_to_rad(minf(lim.z, 80.0))
	_ease_eye(eye_was)
	_was = Vector3.INF
	sat.emit(s)


## the eye where it belongs at once (pulled out of a hiding place, back at a checkpoint: no easing)
func snap_eye() -> void:
	_ease_t = -1.0
	eye.transform = Transform3D(Basis(Vector3.RIGHT, pitch), Vector3(0, _eye_now, 0))


# the eye from where it was to where it belongs now, over settle_secs
func _ease_eye(was: Transform3D) -> void:
	if settle_secs <= 0.0:
		_ease_t = -1.0
		eye.transform = Transform3D(Basis(Vector3.RIGHT, pitch), Vector3(0, _eye_now, 0))
		return
	_ease_from = was
	_ease_t = 0.0
	eye.global_transform = was


## up again where you stood
func rise() -> void:
	if seat == null:
		return
	seat = null
	pose = "standing"
	var eye_was := eye.global_transform
	global_transform = _stood
	_eye_now = _eye_y
	pitch = _stood_pitch
	_ease_eye(eye_was)
	velocity = Vector3.ZERO
	_was = Vector3.INF
	stood.emit()


## what's in front of the eye, if it (or a node above it) can be used. A thing with Logic (the Markers plugin's
## HSLogic under it: "works only when these flags are so", "when it's used, switch these") is asked first and told
## after: what it says no to isn't used (it says why itself), and null comes back.
func use() -> Node:
	aim.force_raycast_update()
	var n: Node = aim.get_collider()
	while n != null and not n.has_method("use"):
		n = n.get_parent()
	if n == null:
		return null
	var logic := logic_of(n)
	for l in logic:
		if not l.allows(self):
			return null
	n.use(self)
	for l in logic:
		if is_instance_valid(l):
			l.used(self)
	return n


## the Logic nodes of a thing (the group hs_logic: anything with thing_node(), allows(by) and used(by))
func logic_of(thing: Node) -> Array:
	return get_tree().get_nodes_in_group("hs_logic").filter(func(l: Node) -> bool:
		return l.has_method("thing_node") and l.has_method("allows") and l.has_method("used") and l.thing_node() == thing)


func _physics_process(dt: float) -> void:
	var want := Vector3.ZERO
	if ended():
		velocity = Vector3(0, velocity.y, 0)
		return
	if Input.is_physical_key_pressed(KEY_W): want.z -= 1
	if Input.is_physical_key_pressed(KEY_S): want.z += 1
	if Input.is_physical_key_pressed(KEY_A): want.x -= 1
	if Input.is_physical_key_pressed(KEY_D): want.x += 1
	if seat != null:                         # seated: nothing moves you; a step gets you up
		velocity = Vector3.ZERO
		if want != Vector3.ZERO:
			seat.use(self)
		return
	want = (global_transform.basis * want).normalized()
	var speed := run_speed if Input.is_physical_key_pressed(KEY_SHIFT) else walk_speed
	velocity.x = want.x * speed
	velocity.z = want.z * speed
	velocity.y = 0.0 if is_on_floor() else velocity.y - gravity * dt
	var grounded := is_on_floor()
	move_and_slide()
	if grounded and is_on_wall() and want.length() > 0.1:
		step_up(want * speed * dt)
	_footsteps(dt, speed > walk_speed)


## a step sounds every stride walked on the floor (the Sound node plays the floor's own)
func _footsteps(dt: float, run: bool) -> void:
	var at := global_position
	var moved := Vector2(at.x - _was.x, at.z - _was.z).length() if _was != Vector3.INF else 0.0
	_was = at
	if steps.update(moved, dt, is_on_floor()):
		var snd := get_tree().get_first_node_in_group("hs_sound")
		if snd != null and snd.has_method("step"):
			snd.step(at, run)
			steps_heard += 1
		Noises.make(get_tree(), at, Noises.RUN if run else Noises.STEP)
		stepped.emit(at, run)


## up onto a step in the way: room above it, nothing in the way up there, then down onto its top
func step_up(ahead: Vector3) -> void:
	var up := Vector3.UP * step_height
	var from := global_transform
	if test_move(from, up):
		return
	ahead = ahead.normalized() * max(ahead.length(), 0.02) + ahead.normalized() * 0.1
	var top := from.translated(up)
	if test_move(top, ahead):
		return
	top = top.translated(ahead)
	var hit := KinematicCollision3D.new()
	if test_move(top, -up, hit) and top.origin.y + hit.get_travel().y - from.origin.y > 0.02:
		global_position = top.origin + hit.get_travel()
		velocity.y = 0.0
