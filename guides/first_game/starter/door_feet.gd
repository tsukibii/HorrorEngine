## Feet under the door (docs/research/intensity.md §5.4): the light under a door from the room behind it, and someone
## standing right behind the door: two dark bars that walk into the light, stop, and go. Put it on a Node3D by the door
## on your side and set `door` (an interior's door node): it sits itself at the leaf's foot facing you, the leaf's width
## (with no `door`, it stays where it's put, its +Z out of the door toward you, `width` wide). The light is made here, a thin glow
## at the gap and a fan of it on the floor fading off (on from the start: the room's light is on; `lit` off for none),
## added over the floor (in a lit corridor it's barely there; in the dark it's a line). Armed (arm() from a signal), the
## feet come the next time you're within `near_m` and looking at the door's foot (within `look_deg` of where you look,
## so they never walk in while your eyes are on something else): in from one side over `walk` seconds, standing `stand`
## seconds, then out the other way. Once. `came` when they stop, `left` when they've gone.
extends Node3D

signal came
signal left

@export var door: Node3D                          ## the door it's under (empty: where it's put)
@export var armed := false
@export var lit := true                           ## the light under the door
@export var width := 0.8                          ## the door's width (m)
@export var spill := 0.5                          ## how far the light reaches across the floor (m)
@export var color := Color(1.0, 0.78, 0.5)
@export var energy := 1.2
@export var near_m := 4.0
@export var look_deg := 30.0
@export var walk := 0.9                           ## seconds to walk in (and out)
@export var stand := 4.0                          ## seconds they stand there

var state := "away"                               ## away, in, standing, out, gone (a check's)
var feet_x := -1.0                                ## where the feet are across the door (m from its middle)
var _t := 0.0
var _gap: MeshInstance3D = null
var _floor: MeshInstance3D = null
var _mat: ShaderMaterial = null

const SHADER := """
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;
uniform vec3 glow = vec3(1.0, 0.78, 0.5);
uniform float energy = 1.2;
uniform float width = 0.8;
uniform float reach = 0.5;
uniform float feet_x = -1.0;     // the feet's middle across the door (m)
uniform float on_floor = 0.0;    // 0 the gap's strip, 1 the floor's fan
float bar(float x, float c, float w) { return 1.0 - smoothstep(w * 0.6, w, abs(x - c)); }
void fragment() {
	float x = (UV.x - 0.5) * width;
	float d = on_floor > 0.5 ? UV.y * reach : 0.0;                 // how far out from the door
	float w = 0.05 + d * 0.12;                                     // a foot's shadow widens away from the light behind it
	float feet = max(bar(x, feet_x - 0.1, w), bar(x, feet_x + 0.1, w));
	float edge = smoothstep(width * 0.5, width * 0.5 - 0.06 - d * 0.3, abs(x));   // the door's sides soft, the fan narrowing
	float fall = on_floor > 0.5 ? exp(-d * 7.0) * (1.0 - UV.y) : 1.0;
	ALBEDO = glow * energy * edge * fall * (1.0 - feet);
}
"""


func _ready() -> void:
	if door != null:
		_fit()
	_mat = ShaderMaterial.new()
	_mat.shader = Shader.new()
	_mat.shader.code = SHADER
	_mat.set_shader_parameter("glow", Vector3(color.r, color.g, color.b))
	_mat.set_shader_parameter("energy", energy)
	_mat.set_shader_parameter("width", width)
	_mat.set_shader_parameter("reach", spill)
	_gap = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(width, 0.014)
	_gap.mesh = q
	_gap.position = Vector3(0, 0.007, 0.004)
	_gap.material_override = _mat
	_gap.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_gap)
	_floor = MeshInstance3D.new()
	var f := PlaneMesh.new()
	f.size = Vector2(width, spill)
	_floor.mesh = f
	_floor.position = Vector3(0, 0.004, spill * 0.5)
	var fm: ShaderMaterial = _mat.duplicate()
	fm.set_shader_parameter("on_floor", 1.0)
	_floor.material_override = fm
	_floor.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_floor)
	_gap.visible = lit
	_floor.visible = lit
	_set_feet(-width)


## at the foot of the door's leaf on the side it was put, facing out, as wide as the leaf (a door square to x or z)
func _fit() -> void:
	var box := AABB()
	var first := true
	for mi in door.find_children("*", "MeshInstance3D", true, false) + ([door] if door is MeshInstance3D else []):
		var ab: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		box = ab if first else box.merge(ab)
		first = false
	if first:
		return
	var c := box.get_center()
	var thin_x := box.size.x < box.size.z
	var n := Vector3(1, 0, 0) if thin_x else Vector3(0, 0, 1)
	if (global_position - c).dot(n) < 0.0:
		n = -n                                         # your side: where it was put
	width = box.size.z if thin_x else box.size.x
	var foot := Vector3(c.x, box.position.y, c.z) + n * ((box.size.x if thin_x else box.size.z) * 0.5 + 0.003)
	var q := PhysicsRayQueryParameters3D.create(foot + Vector3.UP * 0.3, foot - Vector3.UP * 0.5)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty():
		foot.y = (hit["position"] as Vector3).y      # the floor (the leaf stops short of it)
	global_transform = Transform3D(Basis(Vector3.UP.cross(n), Vector3.UP, n), foot)


func arm(_a = null, _b = null) -> void:
	if state == "away":
		armed = true


## the feet standing there now (for a picture)
func pose() -> void:
	state = "standing"
	_set_feet(0.0)


func _set_feet(x: float) -> void:
	feet_x = x
	_mat.set_shader_parameter("feet_x", x)
	(_floor.material_override as ShaderMaterial).set_shader_parameter("feet_x", x)


func _process(dt: float) -> void:
	if not armed or not lit:
		return
	match state:
		"away":
			var cam := get_viewport().get_camera_3d()
			if cam == null or cam.global_position.distance_to(global_position) > near_m:
				return
			if rad_to_deg((-cam.global_basis.z).angle_to(global_position - cam.global_position)) > look_deg:
				return
			state = "in"
			_t = 0.0
		"in":
			_t += dt
			var k := clampf(_t / walk, 0.0, 1.0)
			_set_feet(lerpf(-width * 0.5 - 0.25, 0.0, k * k * (3.0 - 2.0 * k)))
			if k >= 1.0:
				state = "standing"
				_t = 0.0
				came.emit()
		"standing":
			_t += dt
			if _t >= stand:
				state = "out"
				_t = 0.0
		"out":
			_t += dt
			var k := clampf(_t / walk, 0.0, 1.0)
			_set_feet(lerpf(0.0, width * 0.5 + 0.25, k * k * (3.0 - 2.0 * k)))
			if k >= 1.0:
				state = "gone"
				armed = false
				left.emit()
