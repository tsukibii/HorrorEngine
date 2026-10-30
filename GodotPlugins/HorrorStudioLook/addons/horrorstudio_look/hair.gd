## Hair on an imported model (hair.gdshader; docs/GODOT_LOOK.md §5c): the Studio's hair look (tools/character/
## hairshader.js) on any hair made of cards with a strand atlas whose alpha is its coverage: the salon's bake in a
## Character Studio export (`hair_static`, the swinging locks), its brows and lashes, or a glb from anywhere whose
## hair is cards. Anisotropic highlights along the strands from the scene's lights, soft tips and edge-on fades,
## and the retro look as toggles: `flat` (unlit), `steps` (so many colour levels), `dither` (the PSX's ordered
## dither); `retro` all three at once (flat, 8 steps, dither). `HSHair.material(albedo_tex, look, tint)`,
## `HSHair.wear(node, look)` on every mesh under a node whose name says hair, lash or brow (never the scalp: that's
## a plain dark cap), each keeping its albedo texture and colour; `HSHair.set_look(material, look)` later.
## The look's words (the story's `hair` on a cast member or the game, STORY_FORMAT §2): retro, flat, gain, steps,
## dither, shine, soft, cut.
class_name HSHair


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/hair.gdshader")


static func material(albedo: Texture2D = null, look: Dictionary = {}, tint: Color = Color(1, 1, 1)) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader()
	m.set_shader_parameter("albedo", tint)
	if albedo != null:
		m.set_shader_parameter("texture_albedo", albedo)
	else:
		m.set_shader_parameter("texture_albedo", HSSkin.white())
	set_look(m, look)
	return m


## the look's words onto a material: `retro` true is flat, 8 steps and the dither at once (each can then be set apart)
static func set_look(m: Material, look: Dictionary) -> void:
	if not (m is ShaderMaterial):
		return
	if look.get("retro", false):
		m.set_shader_parameter("unlit", true)
		m.set_shader_parameter("steps", 8.0)
		m.set_shader_parameter("dither", true)
	for pair in [["flat", "unlit"], ["dither", "dither"]]:
		if look.has(pair[0]):
			m.set_shader_parameter(pair[1], bool(look[pair[0]]))
	for pair in [["steps", "steps"], ["gain", "flat_gain"], ["shine", "shine"], ["soft", "soft"], ["cut", "cut"]]:
		if look.has(pair[0]):
			m.set_shader_parameter(pair[1], float(look[pair[0]]))


## is a mesh's or material's name hair: hair, lash or brow in it, and not the scalp
static func is_hair(names: String) -> bool:
	var n := names.to_lower()
	if n.contains("scalp"):
		return false
	return n.contains("hair") or n.contains("lash") or n.contains("brow")


## the hair meshes under a node given the material, each keeping its own atlas and colour; returns the materials made
static func wear(node: Node, look: Dictionary = {}) -> Array:
	var out: Array = []
	var meshes: Array = node.find_children("*", "MeshInstance3D", true, false)
	if node is MeshInstance3D:
		meshes.push_front(node)                      # the node itself when it is the hair
	for mi in meshes:
		if mi.mesh == null:
			continue
		for s in mi.mesh.get_surface_count():
			var old = mi.get_active_material(s)
			var names: String = mi.name + " " + (mi.mesh.surface_get_name(s) if mi.mesh is ArrayMesh else "") + " " + (old.resource_name if old != null else "")
			if not is_hair(names):
				continue
			if old is ShaderMaterial and old.shader == shader():
				set_look(old, look)
				out.append(old)
				continue
			var tex: Texture2D = null
			var tint := Color(1, 1, 1)
			if old is BaseMaterial3D:
				tex = old.albedo_texture
				tint = old.albedo_color
			var m := material(tex, look, tint)
			mi.set_surface_override_material(s, m)
			out.append(m)
	return out
