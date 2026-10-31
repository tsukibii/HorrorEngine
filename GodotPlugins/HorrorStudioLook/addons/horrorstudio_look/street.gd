@tool
class_name HSStreet
extends RefCounted
## A street's materials from the Blender bake (tools/street.py bake, docs/STREET_TEXTURING.md §3). The .glb is plain
## glTF: each surface's finish as a tileable set at its real size, the street's wear atlas as its occlusion on UV2, and
## the wear's recipe in the material's extras (`hs_wear`). With this plugin enabled, every scene imported into the
## project goes through street_import.gd (registered by plugin.gd): each such material becomes the street shader
## (street.gdshader: the dirt, rain streaks, worn edges and wet patches laid back on, as Blender rendered them),
## reusing the textures the import already made. Without the plugin the street still has its finishes and occlusion.
## `HSStreet.weather(root, amount)` turns every street surface's wear up or down at run time.

const SHADER := preload("res://addons/horrorstudio_look/street.gdshader")
const SHADER_CUT := preload("res://addons/horrorstudio_look/street_cut.gdshader")


static func wear_of(m: Material) -> Dictionary:
	if m == null or not m.has_meta("extras"):
		return {}
	var x = m.get_meta("extras")
	if x is Dictionary and x.get("hs_wear") is Dictionary:
		return x["hs_wear"]
	return {}


static func _v3(a, d: Vector3) -> Vector3:
	return Vector3(a[0], a[1], a[2]) if a is Array and a.size() >= 3 else d


## The street shader in place of a material from the bake (the same material back when it isn't one).
static func street_material(m: Material) -> Material:
	var w := wear_of(m)
	if w.is_empty() or not (m is BaseMaterial3D) or m.ao_texture == null:
		return m
	var b := m as BaseMaterial3D
	var cut := b.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED
	var s := ShaderMaterial.new()
	s.shader = SHADER_CUT if cut else SHADER
	s.resource_name = b.resource_name
	s.set_shader_parameter("albedo_color", b.albedo_color)
	if b.albedo_texture:
		s.set_shader_parameter("albedo_tex", b.albedo_texture)
	if b.roughness_texture:
		s.set_shader_parameter("orm_tex", b.roughness_texture)
	s.set_shader_parameter("roughness", b.roughness)
	s.set_shader_parameter("metallic", b.metallic)
	if b.normal_enabled and b.normal_texture:
		s.set_shader_parameter("normal_tex", b.normal_texture)
		s.set_shader_parameter("has_normal", true)
		s.set_shader_parameter("normal_scale", b.normal_scale)
	s.set_shader_parameter("uv1_scale", b.uv1_scale)
	s.set_shader_parameter("uv1_offset", b.uv1_offset)
	s.set_shader_parameter("wear_tex", b.ao_texture)
	s.set_shader_parameter("dirt_color", _v3(w.get("dirt_color"), Vector3(0.55, 0.52, 0.48)))
	s.set_shader_parameter("dirt", float(w.get("dirt", 1.0)))
	s.set_shader_parameter("streak_color", _v3(w.get("streak_color"), Vector3(0.5, 0.48, 0.45)))
	s.set_shader_parameter("streaks", float(w.get("streaks", 1.0)))
	s.set_shader_parameter("edge_color", _v3(w.get("edge_color"), Vector3(0.9, 0.9, 0.9)))
	s.set_shader_parameter("edge_lighter", float(w.get("edge_lighter", 1.0)))
	s.set_shader_parameter("edges", float(w.get("edges", 0.5)))
	s.set_shader_parameter("wet", float(w.get("wet", 0.0)))
	s.set_shader_parameter("tone", float(w.get("tone", 1.0)))
	if cut:
		s.set_shader_parameter("alpha_cut", b.alpha_scissor_threshold)
	s.set_meta("extras", b.get_meta("extras"))
	return s


## Every street material under `root` made the street shader; how many.
static func apply(root: Node) -> int:
	var done := {}
	var stack: Array = [root]
	while stack.size():
		var n = stack.pop_back()
		if n is MeshInstance3D and n.mesh:
			for i in n.mesh.get_surface_count():
				var m = n.mesh.surface_get_material(i)
				if m and not wear_of(m).is_empty() and m is BaseMaterial3D:
					if not done.has(m):
						done[m] = street_material(m)
					n.mesh.surface_set_material(i, done[m])
		elif n is ImporterMeshInstance3D and n.mesh:
			for i in n.mesh.get_surface_count():
				var m2 = n.mesh.get_surface_material(i)
				if m2 and not wear_of(m2).is_empty() and m2 is BaseMaterial3D:
					if not done.has(m2):
						done[m2] = street_material(m2)
					n.mesh.set_surface_material(i, done[m2])
		stack.append_array(n.get_children())
	return done.size()


## Every street surface's wear under `root` scaled (0 clean, 1 as baked, 2 twice as worn): rain, a night's grime.
static func weather(root: Node, amount: float) -> void:
	var stack: Array = [root]
	while stack.size():
		var n = stack.pop_back()
		if n is MeshInstance3D and n.mesh:
			for i in n.mesh.get_surface_count():
				var m = n.mesh.surface_get_material(i)
				if m is ShaderMaterial and (m.shader == SHADER or m.shader == SHADER_CUT):
					m.set_shader_parameter("wear_amount", amount)
		stack.append_array(n.get_children())
