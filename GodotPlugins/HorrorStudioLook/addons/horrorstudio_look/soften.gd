## The softener (soften.gdshader; docs/VHS.md): the picture soft by distance, almost sharp up close. A full-screen
## quad under the camera (the post-process trick: its vertices put straight on the screen), on layer 20 alone so a
## mirror's camera doesn't draw it. `HSSoften.attach(camera)` once; `set_amounts(near_m, far_m, soft, least)`. The
## camhybrid tape (vhs.gd) switches it on; `off()` frees it.
class_name HSSoften
extends MeshInstance3D

const HIDDEN_LAYER := 20
var mat: ShaderMaterial


static func attach(cam: Camera3D) -> HSSoften:
	var have = cam.get_node_or_null("Soften")
	if have != null and have is HSSoften:
		return have
	var s := HSSoften.new()
	s.name = "Soften"
	var q := QuadMesh.new()
	q.size = Vector2(2, 2)
	s.mesh = q
	s.mat = ShaderMaterial.new()
	s.mat.shader = load("res://addons/horrorstudio_look/soften.gdshader")
	s.material_override = s.mat
	s.extra_cull_margin = 16384.0
	s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	s.layers = 1 << (HIDDEN_LAYER - 1)
	cam.add_child(s)
	return s


func set_amounts(near_m: float, far_m: float, soft: float, least: float = 0.25) -> void:
	mat.set_shader_parameter("near_m", near_m)
	mat.set_shader_parameter("far_m", far_m)
	mat.set_shader_parameter("soft", soft)
	mat.set_shader_parameter("least", least)


func off() -> void:
	queue_free()
