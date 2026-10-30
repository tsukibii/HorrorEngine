## The Studio's eye on a Character Studio export in Godot (eye.gdshader; docs/GODOT_LOOK.md §5): each eyeball in the
## glb carries its paint baked flat and, in its material's extras, `studioEye` (the eye's shape: the limbus, the
## cornea's dome, the iris's plane; its paint's numbers). `HSEye.wear(node, glb_path)` reads them from the glb's own
## JSON (Godot's importer keeps no material extras), makes the shader material for each eye (the baked paint as its
## texture, the shape and the paint's numbers as its uniforms: people.py's `params`) and puts it on the eye meshes
## (named `<name>_eye_L` / `_R`). The eye's refraction is then the Studio's and Unreal's.
class_name HSEye


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/eye.gdshader")


## the glb's JSON chunk (a binary glTF)
static func gltf_json(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}
	var magic := f.get_buffer(4)
	if magic.get_string_from_ascii() != "glTF":
		return {}
	f.get_32()                                   # the version
	f.get_32()                                   # the length
	var n := f.get_32()
	f.get_32()                                   # JSON
	var txt := f.get_buffer(n).get_string_from_utf8()
	var parsed = JSON.parse_string(txt)
	return parsed if parsed is Dictionary else {}


## the studioEye records by material name
static func records(glb_path: String) -> Dictionary:
	var out := {}
	var j := gltf_json(glb_path)
	for m in j.get("materials", []):
		var ex = m.get("extras")
		if ex is Dictionary and ex.has("studioEye"):
			out[str(m.get("name", ""))] = ex["studioEye"]
	return out


## M_StudioEye's parameters for an eye's record (people.py's params): a painted eye (Refracting cornea off) bends nothing
static func params(rec: Dictionary) -> Dictionary:
	var s: Dictionary = rec.get("shape", {}) if rec.get("shape") is Dictionary else {}
	var p: Dictionary = rec.get("paint", {}) if rec.get("paint") is Dictionary else {}
	var real: bool = not (p.get("real") is bool and p["real"] == false)
	var gloss: float = float(p.get("gloss", 0.9))
	return {"rho": float(s.get("rho", 0.5)), "limbus_plane": float(s.get("zl", 0.866)), "dome_centre": float(s.get("zc", 0.4)),
		"dome_radius": float(s.get("rc", 0.65)), "iris_plane": float(s.get("zi", 0.85)),
		"ior": max(1.0, float(p.get("ior", 1.336))) if real else 1.0, "iris_bright": float(p.get("irisBright", 1.0)) if real else 1.0,
		"limbus_view": float(p.get("limbusView", 0.0)), "limbal": float(p.get("limbal", 0.5)), "limbal_width": float(p.get("limbalWidth", 0.18)),
		"limbal_soft": float(p.get("limbalSoft", 0.0)), "caustic": float(p.get("caustic", 0.6)) if real else 0.0,
		"roughness": 0.4 - 0.34 * gloss, "coat_roughness": 0.18 - 0.16 * gloss}


static func material(rec: Dictionary, paint: Texture2D) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader()
	if paint != null:
		m.set_shader_parameter("paint", paint)
	var p := params(rec)
	for k in p:
		m.set_shader_parameter(k, p[k])
	return m


## the eyes under a node given the Studio's eye; returns {material name: ShaderMaterial}
static func wear(node: Node, glb_path: String, overrides: Dictionary = {}) -> Dictionary:
	var out := {}
	var recs := records(glb_path)
	if recs.is_empty():
		return out
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		for s in mi.mesh.get_surface_count():
			var old = mi.get_active_material(s)
			var name: String = old.resource_name if old != null else ""
			var rec = recs.get(name)
			if rec == null:                           # by the mesh's name when the material's was lost
				for k in recs:
					if mi.name.ends_with(k.substr(k.length() - 6)):
						rec = recs[k]
						name = k
			if rec == null:
				continue
			var tex: Texture2D = old.albedo_texture if old is BaseMaterial3D else null
			var m := material(rec, tex)
			for k in overrides:
				m.set_shader_parameter(k, overrides[k])
			mi.set_surface_override_material(s, m)
			out[name] = m
	return out
