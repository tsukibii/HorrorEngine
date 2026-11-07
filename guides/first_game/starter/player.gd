## The player of a game built by hand (guides/first_game, guides/tutorial_v2): a body you walk with WASD (Shift runs),
## look with the mouse, E uses what's in front of you (anything with a use() method: a door from an interior's export, a
## pickup, a note) or puts a note's card away, F the flashlight (flashlight.gd's batteries when it has them), Esc lets
## the mouse go (a click takes it back). The camera is the player's eye. It steps up what's no higher than
## `step_height` (a kerb, a genkan's step, a stair's tread): Godot's CharacterBody3D takes any step for a wall. In the
## group hs_player (the other starter scripts find it so); it stops when the Story ends.
extends CharacterBody3D

@export var walk_speed := 1.6          ## metres a second
@export var run_speed := 3.2
@export var mouse_turn := 0.0025       ## radians a pixel
@export var reach := 2.0               ## how far E reaches
@export var gravity := 9.8
@export var step_height := 0.5         ## the highest step it walks up

var pitch := 0.0
@onready var eye: Camera3D = $Eye
@onready var aim: RayCast3D = $Eye/Aim
@onready var torch: SpotLight3D = $Eye/Flashlight


func _ready() -> void:
	add_to_group("hs_player")
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	aim.target_position = Vector3(0, 0, -reach)
	aim.add_exception(self)


func _unhandled_input(e: InputEvent) -> void:
	if ended():
		return
	if e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-e.relative.x * mouse_turn)
		pitch = clamp(pitch - e.relative.y * mouse_turn, -1.4, 1.4)
		eye.rotation.x = pitch
	elif e is InputEventMouseButton and e.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif e is InputEventKey and e.pressed and not e.echo:
		match e.physical_keycode:
			KEY_ESCAPE: Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			KEY_E:
				var st := story()
				if st != null and st.card_up():
					st.close_card()
				else:
					use()
			KEY_F:
				if torch.has_method("toggle"):
					torch.toggle()
				else:
					torch.visible = not torch.visible


## the Story node (story.gd), if the scene has one
func story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


func ended() -> bool:
	var st := story()
	return st != null and bool(st.get("over"))


## what's in front of the eye, if it (or a node above it) can be used
func use() -> Node:
	aim.force_raycast_update()
	var n: Node = aim.get_collider()
	while n != null and not n.has_method("use"):
		n = n.get_parent()
	if n != null:
		n.use(self)
	return n


func _physics_process(dt: float) -> void:
	var want := Vector3.ZERO
	if ended():
		velocity = Vector3(0, velocity.y, 0)
		return
	if Input.is_physical_key_pressed(KEY_W): want.z -= 1
	if Input.is_physical_key_pressed(KEY_S): want.z += 1
	if Input.is_physical_key_pressed(KEY_A): want.x -= 1
	if Input.is_physical_key_pressed(KEY_D): want.x += 1
	want = (global_transform.basis * want).normalized()
	var speed := run_speed if Input.is_physical_key_pressed(KEY_SHIFT) else walk_speed
	velocity.x = want.x * speed
	velocity.z = want.z * speed
	velocity.y = 0.0 if is_on_floor() else velocity.y - gravity * dt
	var grounded := is_on_floor()
	move_and_slide()
	if grounded and is_on_wall() and want.length() > 0.1:
		step_up(want * speed * dt)


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
