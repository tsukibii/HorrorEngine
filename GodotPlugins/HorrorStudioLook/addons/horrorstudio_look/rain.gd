## Rain (rain.gdshader; docs/GODOT_LOOK.md): a box of falling streaks, `HSRain.make(size, count)` as a node placed at
## the box's middle (a room with no ceiling, the ground outside a window), or `follow` a node (the camera) so the rain
## stays round the player outdoors. `strength` 0..1 is the downpour; `wind` the lean. A few hundred streaks are
## enough in a room, a few thousand outside; each is two triangles moved in the vertex shader.
class_name HSRain
extends MultiMeshInstance3D

@export var size: Vector3 = Vector3(8, 4, 8)
@export var count: int = 600
@export var strength: float = 0.45
@export var wind: float = 0.25
@export var follow: Node3D = null
var mat: ShaderMaterial


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


func set_strength(k: float) -> void:
	strength = clamp(k, 0.0, 1.0)
	if mat != null:
		mat.set_shader_parameter("strength", strength)


func _process(_dt: float) -> void:
	if follow != null and is_instance_valid(follow):
		global_position = follow.global_position + Vector3(0, size.y * 0.25, 0)
