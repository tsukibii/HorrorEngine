@tool
class_name HSCloth
extends RefCounted
## Cloth: a garment wearing one of the studio's clothing fabric sets (tools/fabricpbr.py; GODOT_LOOK §5x). The
## Character Studio's Export for Godot bakes a garment's dye (its colour, pattern and prints) and its creases and says,
## in its material's extras (`studioCloth`), which fabric it wears: the set's name, its repeat in metres and its numbers.
## Godot 4.7 keeps a glTF material's extras on the material it imports (its `extras` metadata), so the record is read
## off each garment's own material; where it isn't kept, the file's JSON is read by material name (HSEye.gltf_json,
## which can't tell two parts of one name apart: a waistband and a belt). `wear(node, settings, glb)`
## gives every such garment under a node the cloth shader (cloth.gdshaderinc), with the set's tiles from
## `textures/cloth/` drawn at their real size on the garment's second UV (the cloth's metres): the weave's relief, its
## roughness and occlusion, the dye deeper down between the yarns, and the fuzz lobe Godot's own material hasn't got.
## A sheer knit (tights) is blended over the skin by its yarn's cover, denser at a slant.
##
## By hand: `HSCloth.dress(mesh_instance, surface, "WoolKnit001", Color(...), {"uv_scale": 1.0})` on any mesh whose
## second UV is in metres (or `"uv": 1` and a scale for one laid out on its first).
##
## settings: detail (the weave's relief, 0..1), sheen (times the fabric's own), denier (a sheer knit's), fuzz_flat.

const TEX := "res://addons/horrorstudio_look/textures/cloth/"
const INC := "res://addons/horrorstudio_look/cloth.gdshaderinc"

static var _shaders := {}
static var _table = null


## the shader for a cloth: opaque or sheer (blended), one or both sides drawn
static func shader(sheer: bool = false, both_sides: bool = false) -> Shader:
	var key := ("s" if sheer else "o") + ("2" if both_sides else "1")
	if not _shaders.has(key):
		var s := Shader.new()
		s.code = "shader_type spatial;\nrender_mode blend_mix, %s%s;\n%s#include \"%s\"\n" % [
			"cull_disabled" if both_sides else "cull_back", ", depth_draw_never, shadows_disabled" if sheer else "", "#define SHEER\n" if sheer else "", INC]
		_shaders[key] = s
	return _shaders[key]


## the fabric sets the plugin has: {name: {tile_m, label, mask, files, fabric}} (textures/cloth/cloth.json)
static func table() -> Dictionary:
	if _table == null:
		_table = {}
		var f := FileAccess.open(TEX + "cloth.json", FileAccess.READ)
		if f != null:
			var j = JSON.parse_string(f.get_as_text())
			if j is Dictionary:
				_table = j
	return _table


static func sets() -> PackedStringArray:
	return PackedStringArray(table().keys())


## the studioCloth records of a glb by material name
static func records(glb_path: String) -> Dictionary:
	var out := {}
	if glb_path == "":
		return out
	var j := HSEye.gltf_json(glb_path)
	for mat in j.get("materials", []):
		var ex = mat.get("extras")
		if ex is Dictionary and ex.get("studioCloth") is Dictionary:
			out[str(mat.get("name", ""))] = ex["studioCloth"]
	return out


## the record a material carries itself (the importer's `extras` metadata), or null
static func record_of(m: Material):
	if m == null or not m.has_meta("extras"):
		return null
	var ex = m.get_meta("extras")
	return ex["studioCloth"] if ex is Dictionary and ex.get("studioCloth") is Dictionary else null


static func _tex(file: String) -> Texture2D:
	return load(TEX + file) as Texture2D if file != "" and ResourceLoader.exists(TEX + file) else null


## a cloth material: the set by name, the garment's dye (a texture and/or a colour), its creases' normal map (or null);
## `rec` the file's record (its numbers win over the plugin's table), `settings` the caller's. null when the plugin has
## no such set
static func material(set_name: String, albedo: Texture2D = null, tone: Color = Color.WHITE, crease: Texture2D = null, rec: Dictionary = {}, settings: Dictionary = {}) -> ShaderMaterial:
	var t = table().get(set_name)
	if not (t is Dictionary):
		return null
	var fb: Dictionary = (t.get("fabric", {}) as Dictionary).duplicate()
	for k in ["cavity", "sheen", "sheen_rough", "sheen_dye", "wrap", "spec", "macro", "cover", "halo"]:
		if rec.has(k):
			fb[k] = rec[k]
	var files: Dictionary = t.get("files", {})
	var pa := _tex(str(files.get("a", "")))
	var pb := _tex(str(files.get("b", "")))
	if pa == null or pb == null:
		return null
	var sheer: bool = str(t.get("mask", "")) == "opacity"
	var m := ShaderMaterial.new()
	m.shader = shader(sheer, bool(settings.get("both_sides", false)))
	m.set_shader_parameter("albedo_tex", albedo if albedo != null else HSSkin.white())
	m.set_shader_parameter("albedo_color", tone)
	m.set_shader_parameter("crease_tex", crease if crease != null else HSSkin.flat_normal())
	m.set_shader_parameter("crease_on", 1.0 if crease != null else 0.0)
	m.set_shader_parameter("pack_a", pa)
	m.set_shader_parameter("pack_b", pb)
	var po := _tex(str(files.get("o", "")))
	m.set_shader_parameter("pack_o", po if po != null else HSSkin.white())
	m.set_shader_parameter("dye_mask", 1.0 if str(t.get("mask", "")) == "tint" and po != null else 0.0)
	m.set_shader_parameter("dye_mean", max(0.05, float(fb.get("dye_mean", 1.0))))
	var mean = fb.get("mean", [0.8, 0.8, 0.8])
	if mean is Array and mean.size() >= 3:
		m.set_shader_parameter("undyed", Vector3(float(mean[0]), float(mean[1]), float(mean[2])))
	var tile_m: float = float(rec.get("tile_m", t.get("tile_m", 0.03)))
	m.set_shader_parameter("tile", 1.0 / max(tile_m, 1e-4) * float(settings.get("uv_scale", 1.0)))
	m.set_shader_parameter("detail", float(settings.get("detail", 1.0)))
	m.set_shader_parameter("cavity", float(fb.get("cavity", 0.5)))
	m.set_shader_parameter("sheen", float(fb.get("sheen", 0.3)) * float(rec.get("fuzz", 1.0)) * float(settings.get("sheen", 1.0)))
	m.set_shader_parameter("sheen_rough", float(fb.get("sheen_rough", 0.5)))
	m.set_shader_parameter("sheen_dye", float(fb.get("sheen_dye", 0.85)))
	m.set_shader_parameter("fuzz_flat", float(settings.get("fuzz_flat", 0.8)))
	m.set_shader_parameter("halo", float(fb.get("halo", 0.0)) * float(rec.get("fuzz", 1.0)) * float(settings.get("sheen", 1.0)))
	m.set_shader_parameter("wrap", float(fb.get("wrap", 0.3)))
	m.set_shader_parameter("spec", float(fb.get("spec", 0.5)))
	m.set_shader_parameter("macro", float(fb.get("macro", 0.0)))
	m.set_shader_parameter("cover", float(fb.get("cover", 0.25)))
	m.set_shader_parameter("denier", float(settings.get("denier", rec.get("denier", 0.3))))
	m.set_shader_parameter("vertex_shade", float(settings.get("vertex_shade", 1.0)))
	m.set_shader_parameter("flip_v", float(settings.get("flip_v", 1.0)))
	m.set_meta("hs_cloth", {"set": set_name, "sheer": sheer})
	return m


## a fabric on one surface of any mesh whose second UV is the cloth's metres (settings.uv_scale for another scale);
## returns the material, or null when the plugin has no such set
static func dress(mi: MeshInstance3D, surface: int, set_name: String, tone: Color = Color.WHITE, settings: Dictionary = {}) -> ShaderMaterial:
	var old = mi.get_active_material(surface)
	var tex: Texture2D = null
	if old is BaseMaterial3D and settings.get("keep_texture", false):
		tex = old.albedo_texture
	var m := material(set_name, tex, tone, null, {}, settings)
	if m != null:
		mi.set_surface_override_material(surface, m)
	return m


## every garment under a node that the glb says wears a fabric set, given the cloth shader: its baked dye and its
## creases kept, the fabric's own surface drawn over them; returns the materials made
static func wear(node: Node, settings: Dictionary = {}, glb_path: String = "") -> Array:
	var out: Array = []
	var meshes := node.find_children("*", "MeshInstance3D", true, false)
	var own := false                                   # do the materials carry their records themselves? (then a name is never guessed from)
	for mi in meshes:
		if mi.mesh != null:
			for s in mi.mesh.get_surface_count():
				own = own or record_of(mi.get_active_material(s)) != null
	var recs := {} if own else records(glb_path)
	if not own and recs.is_empty():
		return out
	for mi in meshes:
		if mi.mesh == null:
			continue
		var all_sheer := true
		var any := false
		for s in mi.mesh.get_surface_count():
			var old = mi.get_active_material(s)
			if old is ShaderMaterial and old.has_meta("hs_cloth"):   # worn already
				out.append(old)
				any = true
				all_sheer = all_sheer and bool(old.get_meta("hs_cloth").get("sheer", false))
				continue
			if not (old is BaseMaterial3D):
				all_sheer = false
				continue
			var rec = record_of(old)
			if rec == null and not own:
				rec = recs.get(old.resource_name)
				if rec == null:
					rec = recs.get(String(mi.name))
			if not (rec is Dictionary):
				all_sheer = false
				continue
			var st := settings.duplicate()
			st["both_sides"] = old.cull_mode == BaseMaterial3D.CULL_DISABLED
			var crease: Texture2D = old.normal_texture if old.normal_enabled and str(rec.get("normal", "")) == "creases" else null
			var m := material(str(rec.get("set", "")), old.albedo_texture, old.albedo_color, crease, rec, st)
			if m == null:                                  # a set this plugin hasn't got: the garment as the file has it
				all_sheer = false
				continue
			mi.set_surface_override_material(s, m)
			out.append(m)
			any = true
			all_sheer = all_sheer and bool(m.get_meta("hs_cloth").get("sheer", false))
		if any and all_sheer:                              # tights throw no shadow on the leg under them
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return out
