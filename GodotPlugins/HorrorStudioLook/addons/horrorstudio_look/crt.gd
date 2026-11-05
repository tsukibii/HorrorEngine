## A CRT screen (crt.gdshader; docs/GODOT_LOOK.md §5i): a tube television's glass seen close, on a flat mesh (a quad
## on the set's front, or the glass surface of a set's mesh): `HSCrt.screen(mesh_instance, size_mm)` puts it on,
## `HSCrt.set_picture(material, texture)` gives it a picture (null: snow), `HSCrt.set_brightness(material, k)` turns
## it up or off (0: the dark glass alone, the room's lights in it). The runtime's little things put it on the kit's
## televisions and phones (lifefx.gd) when the plugin is in the project.
class_name HSCrt

const KEYS := ["brightness", "tint", "pitch_mm", "scan_lines", "scan_dark", "phosphor", "scale", "curve", "border_mm", "bleed", "flicker", "roll", "roll_secs", "fade_px", "glass", "roughness", "seed", "use_picture"]


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/crt.gdshader")


## the material: `size_mm` the glass's size (the pitch and the lines at their true size), `settings` the shader's
## uniforms by name (`picture` a Texture2D, or null for snow)
static func material(size_mm: Vector2, settings: Dictionary = {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader()
	m.set_shader_parameter("size_mm", size_mm)
	for k in settings:
		if k == "picture":
			set_picture(m, settings[k])
		elif k == "tint" and settings[k] is Color:
			m.set_shader_parameter("tint", Vector3(settings[k].r, settings[k].g, settings[k].b))
		else:
			m.set_shader_parameter(k, settings[k])
	return m


## the screen on a mesh: the whole mesh (`surface` -1: material_override) or one of its surfaces
static func screen(mi: MeshInstance3D, size_mm: Vector2, settings: Dictionary = {}, surface: int = -1) -> ShaderMaterial:
	var m := material(size_mm, settings)
	if surface >= 0 and mi.mesh != null and surface < mi.mesh.get_surface_count():
		mi.set_surface_override_material(surface, m)
	else:
		mi.material_override = m
	return m


static func set_picture(m: Material, tex: Texture2D) -> void:
	if m is ShaderMaterial:
		m.set_shader_parameter("picture", tex)
		m.set_shader_parameter("use_picture", tex != null)


static func set_brightness(m: Material, k: float) -> void:
	if m is ShaderMaterial:
		m.set_shader_parameter("brightness", maxf(k, 0.0))


## the glass's size in mm from a flat mesh: its two long sides (a quad's, or a thin box's)
static func size_of(mi: MeshInstance3D) -> Vector2:
	if mi == null or mi.mesh == null:
		return Vector2(280.0, 210.0)
	var sc := mi.global_transform.basis.get_scale() if mi.is_inside_tree() else mi.scale
	var e: Vector3 = mi.mesh.get_aabb().size * sc
	var d: Array = [e.x, e.y, e.z]
	d.sort()
	return Vector2(d[2], d[1]) * 1000.0
