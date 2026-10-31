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
## **The salon's bake, MetaHuman's way** (docs/GODOT_LOOK.md §5e): with the glb's path, `wear` reads each hair
## material's record from the file (its extras: the salon's `look` and the bake's `studioHair`) and `set_bake` turns on
## what the bake carries: each strand's numbers (the occlusion slot: its shift, its glint), the tangent along the strand,
## the hair volume's shell normals, the occlusion (UV2), the look's highlight colours, glosses and shifts, and the
## coverage dithered for the TAA (soft, see-through strands), the roots fading in, light through the hair from behind,
## a soft scatter. A glb without the record (an older export, a model from elsewhere) keeps the look above.
## **Brows and lashes** wear `hair_fine.gdshader` (the same look blended at the hairs' true coverage: GODOT_LOOK §5f).
class_name HSHair

## the bake's look in Godot (set_bake): the coverage dithered and thickened, the roots fading in, the card's own face
## fading edge-on and its sides tapering, glints, light through from behind, the scatter, the diffuse by the strand's
## angle, the occlusion in full, the highlights 2.5 times the flat card's (a soft volume holds them; tuned on the
## portrait's close-up and back view: 4 washed the colour out)
## the brows' and lashes' blended coverage thickened (hair_fine.gdshader's coverage_gain): the lash line, where a hundred
## roots crowd along the lid's edge and read as one dark line (MetaHuman's, measured: GODOT_LOOK §5f), the lashes, the brows
const FINE_GAIN := {"lash_line": 2.2, "lashes": 1.4, "brows": 1.3}

const BAKED := {"hashed": true, "density": 1.15, "root_fade": 0.06, "edge_fade": 0.85, "side_fade": 0.45, "soft": 0.6, "glints": 0.6, "transmission": 1.0, "scatter": 0.35,
	"kajiya": 0.3, "occlusion": 1.0, "spec_gain": 2.5, "spec_cap": 0.8}


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/hair.gdshader")


## the brows' and lashes' shader: the same look, blended at the hairs' true coverage (GODOT_LOOK §5f)
static func fine_shader() -> Shader:
	return load("res://addons/horrorstudio_look/hair_fine.gdshader")


## is a hair mesh's name a brow's or a lash's (fine hairs lying on the skin or the lid, a tenth of a millimetre wide)
static func is_fine(names: String) -> bool:
	var n := names.to_lower()
	return n.contains("lash") or n.contains("brow")


static func material(albedo: Texture2D = null, look: Dictionary = {}, tint: Color = Color(1, 1, 1), fine := false) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = fine_shader() if fine else shader()
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


## the hair records of a glb by material name (the salon's bake and the Studio's brows and lashes write `look` and
## `studioHair` in their materials' extras); Godot's importer keeps no extras, so the file's JSON is read (HSEye)
static func records(glb_path: String) -> Dictionary:
	var out := {}
	if glb_path == "":
		return out
	var j := HSEye.gltf_json(glb_path)
	for mat in j.get("materials", []):
		var ex = mat.get("extras")
		if ex is Dictionary and (ex.has("studioHair") or ex.has("look")):
			out[str(mat.get("name", ""))] = ex
	return out


## the salon's bake on a material, as its record says: the strand numbers (the imported material's occlusion texture),
## the tangents, shell normals and occlusion it carries, the look's colours and numbers, and BAKED's settings
static func set_bake(m: ShaderMaterial, rec: Dictionary, strands: Texture2D = null) -> void:
	var sh = rec.get("studioHair")
	if sh is Dictionary:
		if strands != null and str(sh.get("strands", "")).begins_with("occlusion"):
			m.set_shader_parameter("texture_strands", strands)
			m.set_shader_parameter("use_strands", true)
		var shell := str(sh.get("normal", "")).contains("shell")
		m.set_shader_parameter("tangent_along", str(sh.get("tangent", "")).begins_with("along"))
		m.set_shader_parameter("shell_normals", shell)
		m.set_shader_parameter("baked_occlusion", str(sh.get("uv1", "")).begins_with("x "))
		if shell:                                      # the head's hair (the salon's volume bake); brows and lashes keep the soft cut (a lash a pixel wide dithers away)
			for k in BAKED:
				m.set_shader_parameter(k, BAKED[k])
	var k = rec.get("look")
	if k is Dictionary:
		for pair in [["spec1", "spec_color"], ["spec2", "spec2_color"]]:
			if k.has(pair[0]):
				m.set_shader_parameter(pair[1], Color.html(str(k[pair[0]])))
		for pair in [["gloss1", "gloss1"], ["gloss2", "gloss2"], ["shift1", "shift1"], ["shift2", "shift2"], ["shiftNoise", "shift_noise"], ["shine", "shine"], ["rimAmount", "rim"]]:
			if k.has(pair[0]):
				m.set_shader_parameter(pair[1], float(k[pair[0]]))


## the darkened scalp under the hair (the salon's: its colour and its see-through by vertex, unlit in the file) and the
## brows' see-through fill: Godot's importer leaves their vertex colours off, and the scalp's cap showed white at the
## parting and the hairline; here their colour by vertex, faintly lit, no shine
static func scalp_material(colour := Color(1, 1, 1)) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.resource_name = "hair_scalp"
	m.albedo_color = colour                          # the file's own colour (the brows' fill carries the brows' colour there; the scalp white)
	m.vertex_color_use_as_albedo = true
	m.vertex_color_is_srgb = false
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = 1.0
	m.metallic_specular = 0.0
	return m


## is a mesh's or material's name hair: hair, lash or brow in it, and not the scalp
static func is_hair(names: String) -> bool:
	var n := names.to_lower()
	if n.contains("scalp") or n.contains("brow_fill"):
		return false
	if n.contains("_skin") or n.contains("_eye_"):              # a Studio export's skin and eyes (<name>_skin, <name>_eye_L): a character called Hairo is still skin
		return false
	return n.contains("hair") or n.contains("lash") or n.contains("brow")


## the hair meshes under a node given the material, each keeping its own atlas and colour; with the glb's path, the
## salon's bake as its records say (set_bake); returns the materials made
static func wear(node: Node, look: Dictionary = {}, glb_path: String = "") -> Array:
	var out: Array = []
	var recs := records(glb_path)
	var meshes: Array = node.find_children("*", "MeshInstance3D", true, false)
	if node is MeshInstance3D:
		meshes.push_front(node)                      # the node itself when it is the hair
	for mi in meshes:
		if mi.mesh == null:
			continue
		for s in mi.mesh.get_surface_count():
			var old = mi.get_active_material(s)
			var names: String = mi.name + " " + (mi.mesh.surface_get_name(s) if mi.mesh is ArrayMesh else "") + " " + (old.resource_name if old != null else "")
			if names.to_lower().contains("scalp") or names.to_lower().contains("brow_fill"):   # the darkened scalp, the brows' see-through fill: colour by vertex
				if not (old is StandardMaterial3D and old.vertex_color_use_as_albedo):
					mi.set_surface_override_material(s, scalp_material(old.albedo_color if old is BaseMaterial3D else Color(1, 1, 1)))
				continue
			if not is_hair(names):
				continue
			if old is ShaderMaterial and (old.shader == shader() or old.shader == fine_shader()):
				set_look(old, look)
				out.append(old)
				continue
			var tex: Texture2D = null
			var tint := Color(1, 1, 1)
			var strands: Texture2D = null
			if old is BaseMaterial3D:
				tex = old.albedo_texture
				tint = old.albedo_color
				strands = old.ao_texture
			var fine := is_fine(names)
			var m := material(tex, {}, tint, fine)
			if fine:                                     # blended after the opaque world: the lashes over the lash line, both over the brows' fill
				var n := names.to_lower()
				m.render_priority = 2 if n.contains("lashes") else 1
				m.set_shader_parameter("coverage_gain", FINE_GAIN["lash_line"] if n.contains("lash_line") else (FINE_GAIN["lashes"] if n.contains("lash") else FINE_GAIN["brows"]))
			var rec = recs.get(old.resource_name if old != null else "")
			if rec is Dictionary:
				set_bake(m, rec, strands)
			set_look(m, look)                            # the story's words over the bake's
			mi.set_surface_override_material(s, m)
			out.append(m)
	return out
