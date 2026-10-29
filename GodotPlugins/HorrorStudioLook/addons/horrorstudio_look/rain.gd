## Rain (rain.gdshader; docs/GODOT_LOOK.md): a box of falling streaks, `HSRain.make(size, count)` as a node placed at
## the box's middle (a room with no ceiling, the ground outside a window), or `follow` a node (the camera) so the rain
## stays round the player outdoors. `strength` 0..1 is the downpour; `wind` the lean. A few hundred streaks are
## enough in a room, a few thousand outside; each is two triangles moved in the vertex shader. Where they land, on the
## box's floor, `splashes` (on by default: a child MultiMesh "Splashes", splash.gdshader): a flash, a widening ring and
## spikes at seats over the floor, as many as a third of the streaks; `set_splashes(on)`.
class_name HSRain
extends MultiMeshInstance3D

@export var size: Vector3 = Vector3(8, 4, 8)
@export var count: int = 600
@export var strength: float = 0.45
@export var wind: float = 0.25
@export var follow: Node3D = null
@export var splashes: bool = true
var mat: ShaderMaterial
var splash_mat: ShaderMaterial
var splash_node: MultiMeshInstance3D


static func make(size_: Vector3, count_: int = 600, strength_: float = 0.45) -> HSRain:
	var r := HSRain.new()
	r.name = "Rain"
	r.size = size_
	r.count = count_
	r.strength = strength_
	return r


func _ready() -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	mm.mesh = q
	mm.instance_count = count
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in count:
		mm.set_instance_transform(i, Transform3D.IDENTITY)
		mm.set_instance_custom_data(i, Color(rng.randf(), rng.randf(), rng.randf(), rng.randf()))
	multimesh = mm
	mat = ShaderMaterial.new()
	mat.shader = load("res://addons/horrorstudio_look/rain.gdshader")
	mat.set_shader_parameter("box_size", size)
	mat.set_shader_parameter("strength", strength)
	mat.set_shader_parameter("wind", wind)
	material_override = mat
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	custom_aabb = AABB(-size * 0.5 - Vector3(1, 1, 1), size + Vector3(2, 2, 2))
	splash_node = MultiMeshInstance3D.new()
	splash_node.name = "Splashes"
	var sm := MultiMesh.new()
	sm.transform_format = MultiMesh.TRANSFORM_3D
	sm.use_custom_data = true
	var sq := QuadMesh.new()
	sq.size = Vector2(1, 1)
	sm.mesh = sq
	var ns: int = max(count / 3, 40)
	sm.instance_count = ns
	for i in ns:
		sm.set_instance_transform(i, Transform3D.IDENTITY)
		sm.set_instance_custom_data(i, Color(rng.randf(), rng.randf(), rng.randf(), rng.randf()))
	splash_node.multimesh = sm
	splash_mat = ShaderMaterial.new()
	splash_mat.shader = load("res://addons/horrorstudio_look/splash.gdshader")
	splash_mat.set_shader_parameter("box_size", size)
	splash_mat.set_shader_parameter("strength", strength)
	splash_node.material_override = splash_mat
	splash_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	splash_node.custom_aabb = AABB(-size * 0.5 - Vector3(1, 1, 1), size + Vector3(2, 2, 2))
	splash_node.visible = splashes
	add_child(splash_node)


## the box rides with the player (play.gd moves it): the drops keep world seats, and only the open rooms get them
func set_follow(on: bool) -> void:
	for m in [mat, splash_mat]:
		if m != null:
			m.set_shader_parameter("follow", on)


## the open rooms it rains in, as world boxes [[lo: Vector3, hi: Vector3], ...] (up to 8; none: the whole box)
func set_rooms(boxes: Array) -> void:
	var lo := PackedVector4Array()
	var hi := PackedVector4Array()
	for i in 8:
		var b: Array = boxes[i] if i < boxes.size() else [Vector3.ZERO, Vector3.ZERO]
		lo.append(Vector4(b[0].x, b[0].y, b[0].z, 0.0))
		hi.append(Vector4(b[1].x, b[1].y, b[1].z, 0.0))
	for m in [mat, splash_mat]:
		if m != null:
			m.set_shader_parameter("rooms_n", min(boxes.size(), 8))
			m.set_shader_parameter("rooms_lo", lo)
			m.set_shader_parameter("rooms_hi", hi)


func set_splashes(on: bool) -> void:
	splashes = on
	if splash_node != null:
		splash_node.visible = on


func set_strength(k: float) -> void:
	strength = clamp(k, 0.0, 1.0)
	if mat != null:
		mat.set_shader_parameter("strength", strength)
	if splash_mat != null:
		splash_mat.set_shader_parameter("strength", strength)


func _process(_dt: float) -> void:
	if follow != null and is_instance_valid(follow):
		global_position = follow.global_position + Vector3(0, size.y * 0.25, 0)
