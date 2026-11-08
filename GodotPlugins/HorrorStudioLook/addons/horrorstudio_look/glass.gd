## Window panes (glass.gdshader; docs/GODOT_LOOK.md §2): `HSGlass.pane(mesh_instance, size_m)` puts the glass on a
## quad in a window's opening; `HSGlass.set_rain(material, k)` puts the rain on it (drops running down, a mist), 0
## for dry. The export writes a pane in every window; the runtime rains on them with `game.weather`.
## `HSGlass.frost(mesh_instance, k)` frosts its pane over from the bottom edge (0 none, 1 three quarters up: §5l).
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
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF   # glass: a light outside (a headlight sweep) shines in through it
	return m


static func set_rain(m: Material, k: float) -> void:
	if m is ShaderMaterial:
		m.set_shader_parameter("rain", clamp(k, 0.0, 1.0))


## frost up from a pane's bottom edge (HSGlass.pane's material on `mi`): `k` 0 none, 1 three quarters of the way up
static func frost(mi: MeshInstance3D, k: float) -> void:
	var m := mi.material_override as ShaderMaterial
	if m == null or m.shader != shader():
		return
	var ab := mi.global_transform * mi.get_aabb()
	m.set_shader_parameter("frost", clampf(k, 0.0, 1.0))
	m.set_shader_parameter("frost_bottom", ab.position.y)
	m.set_shader_parameter("frost_top", ab.end.y)
