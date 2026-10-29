## Wet surfaces (wet.gdshader; docs/GODOT_LOOK.md): a floor's material swapped for a wet one that keeps its colour,
## texture and roughness: `HSWet.wet(mesh_instance, {wetness, puddles, ripples})`; `HSWet.dry(mesh_instance)` puts
## the old one back. The runtime wets the floors of the rooms the rain falls in (`game.weather`). For the reflections
## the environment needs SSR on (HSLook's realism has it).
class_name HSWet

const META := "hs_wet_was"


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/wet.gdshader")


## the mesh's material made wet; settings: wetness 0..1 (0.8), puddles 0..1 (0.5), puddle_scale m (0.9), ripples 0..1 (0),
## water_tint (Color), roughness (the base's, when the old material has none)
static func wet(mi: MeshInstance3D, settings: Dictionary = {}) -> ShaderMaterial:
	if mi == null:
		return null
	var old = mi.material_override if mi.material_override != null else (mi.get_active_material(0) if mi.mesh != null and mi.mesh.get_surface_count() > 0 else null)
	if old is ShaderMaterial and old.shader == shader():
		for k in settings:
			old.set_shader_parameter(k, settings[k])
		return old
	var m := ShaderMaterial.new()
	m.shader = shader()
	var col := Color(0.23, 0.2, 0.18)
	var rough := 1.0
	var tex = null
	var uvs := Vector3.ONE
	if old is StandardMaterial3D:
		col = old.albedo_color
		rough = old.roughness
		tex = old.albedo_texture
		uvs = old.uv1_scale
	m.set_shader_parameter("albedo", col)
	m.set_shader_parameter("roughness", float(settings.get("roughness", rough)))
	m.set_shader_parameter("uv1_scale", uvs)
	if tex != null:
		m.set_shader_parameter("texture_albedo", tex)
		m.set_shader_parameter("use_texture", true)
	for k in ["wetness", "puddles", "puddle_scale", "ripples", "ripple_rate", "water_tint", "edge"]:
		if settings.has(k):
			m.set_shader_parameter(k, settings[k])
	mi.set_meta(META, old)
	mi.material_override = m
	return m


static func dry(mi: MeshInstance3D) -> void:
	if mi != null and mi.has_meta(META):
		mi.material_override = mi.get_meta(META)
		mi.remove_meta(META)


## every floor under a node (the level) made wet: the pieces whose kind is floor (the export's metadata), in the rooms
## named (all when the list is empty); returns how many
static func wet_floors(level: Node, rooms: Array = [], settings: Dictionary = {}) -> int:
	var n := 0
	for ch in level.get_children():
		if not ch.has_meta("piece"):
			continue
		var p = JSON.parse_string(ch.get_meta("piece"))
		if not (p is Dictionary) or p.get("kind") != "floor":
			continue
		if not rooms.is_empty() and not rooms.has(p.get("room")):
			continue
		var mi = ch.get_node_or_null("mesh")
		if mi is MeshInstance3D:
			wet(mi, settings)
			n += 1
	return n
