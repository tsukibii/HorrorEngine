## Skin on HumanShaders (skin_wet.gdshader; docs/GODOT_LOOK.md): a skin material from a baked albedo (the Character
## Studio's export carries its colours on MHR's UVs) with HumanShaders' lightwarp, noise and micro detail wired in
## from res://HumanShaders/ (the export copies them beside the add-on), and the wetness layer's sliders:
## `HSSkin.material(albedo_tex, {wetness, sweat, drips, oil})`; `HSSkin.set_wet(material, settings)` later (a scene
## sweating her, a shower). `HSSkin.wear(node, settings)` puts it on every mesh under a node whose material or mesh
## name says skin (the Studio's export names them), keeping each one's albedo texture.
class_name HSSkin

const HUMAN := "res://HumanShaders/"


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/skin_wet.gdshader")


static func material(albedo: Texture2D = null, settings: Dictionary = {}, tone: Color = Color(1, 1, 1)) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader()
	m.set_shader_parameter("albedo", tone)
	if albedo != null:
		m.set_shader_parameter("texture_albedo", albedo)
	m.set_shader_parameter("texture_normal", flat_normal())        # the shader samples these whether or not a map is given
	m.set_shader_parameter("texture_micro_detail", flat_normal())
	m.set_shader_parameter("texture_roughness", white())
	m.set_shader_parameter("texture_translucency", white())
	m.set_shader_parameter("ambient_occlusion_texture", white())
	m.set_shader_parameter("texture_metallic", white())
	m.set_shader_parameter("metallic_texture_channel", Vector4(1, 0, 0, 0))
	m.set_shader_parameter("roughness", 0.55)
	m.set_shader_parameter("specular", 0.45)
	m.set_shader_parameter("use_subsurface_scattering", true)
	m.set_shader_parameter("subsurface_scattering_strength", 0.35)
	m.set_shader_parameter("skin_smoothness", 4.0)
	for pair in [["lightwarp", "Resources/lightwarp_skin1.tres"], ["texture_sss_noise", "Resources/InterleavedGradientNoise.png"], ["texture_translucency_color", "Resources/translucency_gradient.tres"]]:
		var path: String = HUMAN + pair[1]
		if ResourceLoader.exists(path):
			var res = load(path)
			if res is Texture2D:
				m.set_shader_parameter(pair[0], res)
	var micro := HUMAN + "Resources/MicroDetail/"
	if DirAccess.dir_exists_absolute(micro):
		var d := DirAccess.open(micro)
		if d != null:
			for f in d.get_files():
				if f.ends_with(".png") and not f.ends_with(".import"):
					var t = load(micro + f)
					if t is Texture2D:
						m.set_shader_parameter("texture_micro_detail", t)
						m.set_shader_parameter("use_micro_detail", true)
						m.set_shader_parameter("micro_detail_scale", 30.0)
						break
	set_wet(m, settings)
	return m


static var _flat: ImageTexture = null
static var _white: ImageTexture = null


static func flat_normal() -> ImageTexture:
	if _flat == null:
		var im := Image.create(4, 4, false, Image.FORMAT_RGB8)
		im.fill(Color(0.5, 0.5, 1.0))
		_flat = ImageTexture.create_from_image(im)
	return _flat


static func white() -> ImageTexture:
	if _white == null:
		var im := Image.create(4, 4, false, Image.FORMAT_RGB8)
		im.fill(Color(1, 1, 1))
		_white = ImageTexture.create_from_image(im)
	return _white


static func set_wet(m: Material, settings: Dictionary) -> void:
	if not (m is ShaderMaterial):
		return
	for k in ["wetness", "sweat", "sweat_scale", "sweat_size", "drips", "oil", "oil_roughness"]:
		if settings.has(k):
			m.set_shader_parameter(k, float(settings[k]))


## the skin meshes under a node (the Studio's export: a mesh or material named skin, body, head, face) given the
## material, each keeping its own albedo texture; returns the materials made
static func wear(node: Node, settings: Dictionary = {}) -> Array:
	var out: Array = []
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		for s in mi.mesh.get_surface_count():
			var old = mi.get_active_material(s)
			var names: String = (mi.name + " " + mi.mesh.surface_get_name(s) + " " + (old.resource_name if old != null else "")).to_lower()
			if not (names.contains("skin") or names.contains("body") or names.contains("head") or names.contains("face")):
				continue
			if names.contains("eye") or names.contains("lash") or names.contains("brow") or names.contains("hair") or names.contains("teeth") or names.contains("tongue"):
				continue
			var tex: Texture2D = null
			var tone := Color(1, 1, 1)
			if old is BaseMaterial3D:
				tex = old.albedo_texture
				tone = old.albedo_color
			var m := material(tex, settings, tone)
			mi.set_surface_override_material(s, m)
			out.append(m)
	return out
