## Window panes (glass.gdshader; docs/GODOT_LOOK.md §2): `HSGlass.pane(mesh_instance, size_m)` puts the glass on a
## quad in a window's opening; `HSGlass.set_rain(material, k)` puts the rain on it (drops running down, a mist), 0
## for dry. The export writes a pane in every window; the runtime rains on them with `game.weather`.
class_name HSGlass


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/glass.gdshader")


static func material(size_m: Vector2, seed: float = 1.0, settings: Dictionary = {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader()
	m.set_shader_parameter("size_m", size_m)
	m.set_shader_parameter("seed", seed)
	for k in settings:
		m.set_shader_parameter(k, settings[k])
	return m


static func pane(mi: MeshInstance3D, size_m: Vector2, seed: float = 1.0, settings: Dictionary = {}) -> ShaderMaterial:
	var m := material(size_m, seed, settings)
	mi.material_override = m
	return m


static func set_rain(m: Material, k: float) -> void:
	if m is ShaderMaterial:
		m.set_shader_parameter("rain", clamp(k, 0.0, 1.0))
