## Skin on HumanShaders (skin_wet.gdshader; docs/GODOT_LOOK.md): a skin material from a baked albedo (the Character
## Studio's export carries its colours on MHR's UVs) with HumanShaders' lightwarp, noise and micro detail wired in
## from res://HumanShaders/ (the export copies them beside the add-on), and the wetness layer's sliders:
## `HSSkin.material(albedo_tex, {wetness, sweat, drips, oil}, tone, maps)`; `HSSkin.set_wet(material, settings)` later
## (a scene sweating her, a shower). `HSSkin.wear(node, settings, glb_path)` puts it on every mesh under a node whose
## material or mesh name says skin (the Studio's export names them), keeping each one's albedo texture and, from a
## Character Studio export, its **relief** (the Studio's tangent-space normal map: pores, wrinkles, the nails' edges;
## glTF's convention, no occlusion in its blue), its **roughness** (the export's ORM's green: the oily T-zone, the
## matte cheeks, the lips) and **how thin the skin is** (the ORM's blue, the light through ears and nostrils, as the
## shader's translucency map), and the export's own `studioSkin` numbers (the glb's material extras, read from the
## file when its path is given): smoothness, falloff, specular, the double lobe, translucency, the wrap as the SSS.
## Without them (the bake's plain body, the demo's spheres) the flat defaults stay.
class_name HSSkin

const HUMAN := "res://HumanShaders/"


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/skin_wet.gdshader")


static func material(albedo: Texture2D = null, settings: Dictionary = {}, tone: Color = Color(1, 1, 1), maps: Dictionary = {}) -> ShaderMaterial:
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
	m.set_shader_parameter("roughness", 0.62)                        # (0.55, specular 0.45 and SSS 0.35 until 2026-10-30: "bright plastic", the user)
	m.set_shader_parameter("specular", 0.35)
	m.set_shader_parameter("use_subsurface_scattering", true)
	m.set_shader_parameter("subsurface_scattering_strength", 0.45)
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
	set_maps(m, maps)
	set_wet(m, settings)
	return m


## the export's maps and numbers onto a material: `normal` (glTF's convention), `orm` (G roughness, B thinness),
## `skin` (the studioSkin record: on, smooth, fall, spec, double, trans, wrap)
static func set_maps(m: ShaderMaterial, maps: Dictionary) -> void:
	if maps.get("normal") is Texture2D:
		m.set_shader_parameter("texture_normal", maps["normal"])
		m.set_shader_parameter("normal_gl", true)
		m.set_shader_parameter("normal_has_ao", false)
		m.set_shader_parameter("normal_strength", 1.0)
		m.set_shader_parameter("micro_normal_strength", 0.15)       # the pores are in the map: the tile only breaks the highlights up
	if maps.get("orm") is Texture2D:
		m.set_shader_parameter("texture_roughness", maps["orm"])    # the shader reads the green, as glTF stores it
		m.set_shader_parameter("roughness", 1.4)                     # the map rules (the flat default scales a white map), lifted: the Studio's numbers (0.3 to 0.4 on a young face) read glossier under Godot's GGX than under its own light (1.25 till 2026-10-30)
		m.set_shader_parameter("texture_translucency", maps["orm"])  # its blue: how thin the skin is
		m.set_shader_parameter("translucency", true)
	var rec = maps.get("skin")
	if rec is Dictionary and float(rec.get("on", 1)) > 0.5:
		if rec.has("smooth"):
			m.set_shader_parameter("skin_smoothness", clamp(float(rec["smooth"]), 0.0, 10.0))
		if rec.has("fall"):
			m.set_shader_parameter("skin_fallof_smoothness", clamp(float(rec["fall"]), 0.7, 2.0))
		if rec.has("spec"):
			m.set_shader_parameter("specular", clamp(float(rec["spec"]), 0.0, 1.0))
		if rec.has("double"):
			m.set_shader_parameter("double_specularity", float(rec["double"]) > 0.5)
		if rec.has("trans"):
			m.set_shader_parameter("translucency_strength", clamp(float(rec["trans"]), 0.0, 2.0))
			m.set_shader_parameter("translucency", float(rec["trans"]) > 0.0 and maps.get("orm") is Texture2D)
		if rec.has("wrap"):
			m.set_shader_parameter("subsurface_scattering_strength", clamp(float(rec["wrap"]), 0.0, 1.0))


## the studioSkin records of a glb by material name (the Studio's export writes one on its skin material)
static func records(glb_path: String) -> Dictionary:
	var out := {}
	if glb_path == "":
		return out
	var j := HSEye.gltf_json(glb_path)
	for mat in j.get("materials", []):
		var ex = mat.get("extras")
		if ex is Dictionary and ex.has("studioSkin"):
			out[str(mat.get("name", ""))] = ex["studioSkin"]
	return out


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
## material, each keeping its own albedo texture, and its normal and ORM maps when the imported material carries them;
## with the glb's path, its studioSkin numbers too; returns the materials made
static func wear(node: Node, settings: Dictionary = {}, glb_path: String = "") -> Array:
	var out: Array = []
	var recs := records(glb_path)
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
			var maps := {}
			if old is BaseMaterial3D:
				tex = old.albedo_texture
				tone = old.albedo_color
				if old.normal_enabled and old.normal_texture != null:
					maps["normal"] = old.normal_texture
				if old.roughness_texture != null:
					maps["orm"] = old.roughness_texture
				var rec = recs.get(old.resource_name)
				if rec == null:
					for k in recs:
						if k.ends_with("skin") and mi.name.ends_with("skin"):
							rec = recs[k]
				if rec is Dictionary:
					maps["skin"] = rec
			var m := material(tex, settings, tone, maps)
			mi.set_surface_override_material(s, m)
			out.append(m)
	return out
