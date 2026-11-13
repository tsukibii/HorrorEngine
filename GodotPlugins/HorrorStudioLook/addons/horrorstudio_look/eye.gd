## The Studio's eye on a Character Studio export in Godot (eye.gdshader; docs/GODOT_LOOK.md §5): each eyeball in the
## glb carries its paint baked flat and, in its material's extras, `studioEye` (the eye's shape: the limbus, the
## cornea's dome, the iris's plane; its paint's numbers). `HSEye.wear(node, glb_path)` reads them from the glb's own
## JSON (Godot's importer keeps no material extras), makes the shader material for each eye (the baked paint as its
## texture, the shape and the paint's numbers as its uniforms: people.py's `params`) and puts it on the eye meshes
## (named `<name>_eye_L` / `_R`). The eye's refraction is then the Studio's and Unreal's. Over each eyeball goes its wet
## layer (eye_wet.gdshader, the eye's material_overlay: HumanShaders' eye wetness and MetaHuman's eye occlusion, the
## lids found in the depth buffer, so the shade follows the real lids in any pose; docs/GODOT_LOOK.md §5h). The tear
## line (`<name>_tearline`, its record `studioTear`) wears tear.gdshader, a wet glint along each lower lid; a character
## whose export blinks gets an HSBlink (blink.gd).
class_name HSEye

## the socket's shade kept under the wet layer: the Studio's is a guess at the lids' shadow (darker all over, more toward
## the brow and the corners); with the real lids' shade on top, its whole was the grey, dead white (GODOT_LOOK §5h)
const WET_SOCKET := 0.5
## the eyeball drawn this much (m) deeper than it is (eye.gdshader's and the wet layer's `lid_room`; GODOT_LOOK §5f): a
## lid that expressions played together have slid a little into the eye still covers it. MHR's face shapes are baked
## with the lids kept off the eye one shape at a time (tools/face_morphs.mjs); a smile is five at once, and their sum
## went up to 1.2 mm in. Her blinker (HSBlink) turns it on only while such shapes play and off at rest, where the eye
## is drawn where it is; a character with no blinker (an export from before the blink) keeps it on always
const LID_ROOM := HSBlink.LID_ROOM


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/eye.gdshader")


static func wet_shader() -> Shader:
	return load("res://addons/horrorstudio_look/eye_wet.gdshader")


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


## the studioEye records by material name (and the tear line's studioTear)
static func records(glb_path: String, key: String = "studioEye") -> Dictionary:
	var out := {}
	var j := gltf_json(glb_path)
	for m in j.get("materials", []):
		var ex = m.get("extras")
		if ex is Dictionary and ex.has(key):
			out[str(m.get("name", ""))] = ex[key]
	return out


## the tear line's material: added over what's behind, a glint only
static func tear_material(rec: Dictionary) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load("res://addons/horrorstudio_look/tear.gdshader")
	m.set_shader_parameter("strength", float(rec.get("strength", 0.4)))
	return m


## a catchlight's direction for its place on the iris (eyes v3; eye.gdshader's kept_dir1/2): `x`, `y` in iris radii as
## the eye is seen straight on (x toward the picture's right, y up), on a cornea of `rho` (the limbus's radius) and `rc`
## (the dome's radius): the view ray reflected at that point of the dome, about the view ray (x right, y up, z back at
## the camera). Past the dome's edge it's held at the edge
static func catch_dir(x: float, y: float, rho: float, rc: float) -> Vector3:
	var n := Vector2(x, y) * rho / maxf(rc, 0.0001)
	if n.length() > 0.98:
		n = n.normalized() * 0.98
	var nz := sqrt(1.0 - n.length_squared())
	return Vector3(2.0 * nz * n.x, 2.0 * nz * n.y, 2.0 * nz * nz - 1.0)


## M_StudioEye's parameters for an eye's record (people.py's params): a painted eye (Refracting cornea off) bends nothing
static func params(rec: Dictionary) -> Dictionary:
	var s: Dictionary = rec.get("shape", {}) if rec.get("shape") is Dictionary else {}
	var p: Dictionary = rec.get("paint", {}) if rec.get("paint") is Dictionary else {}
	var real: bool = not (p.get("real") is bool and p["real"] == false)
	var gloss: float = float(p.get("gloss", 0.9))
	var rho: float = float(s.get("rho", 0.5))
	var rc: float = float(s.get("rc", 0.65))
	var size1: float = 2.0 * float(p.get("catchSize", 0.17)) * rho / maxf(rc, 0.0001)   # (a disc that wide on the dome, as the reflected ray's angle: twice the normal's)
	var out := {
		# eyes v3 (docs/GODOT_LOOK.md §5v): the catchlights that stay (0 in a record that says none: an export from before them), the white's own brightness and warmth
		"kept_amount": float(p.get("catchKeep", 0.0)) if real else 0.0,
		"kept_dir1": catch_dir(float(p.get("catchX", -0.35)), float(p.get("catchY", 0.4)), rho, rc),
		"kept_dir2": catch_dir(float(p.get("catch2X", 0.3)), float(p.get("catch2Y", -0.1)), rho, rc),
		"kept_size": Vector2(size1, size1 * float(p.get("catch2Size", 0.6))),
		"kept_gain": Vector2(float(p.get("catch1", 0.9)), float(p.get("catch2", 0.5))),
		"kept_line": float(p.get("catchLine", 0.0)),
		"kept_line_at": Vector4(0.0, catch_dir(0.0, float(p.get("catchLineY", -0.86)), rho, rc).y, 0.55, 0.012),
		"lamp_catch": float(p.get("catchRoom", 1.0)),
		# the white's scattered light (the wrap past the terminator): warm and pinkish in a warm white, bluish in a cool one
		"scatter_color": Color(0.86, 0.9, 1.0).lerp(Color(1.0, 0.72, 0.62), clampf((float(p.get("whiteWarm", 0.35)) + 0.35) / 0.7, 0.0, 1.0)),
		"kept_lit": float(p.get("catchLit", 6.0)), "kept_glow": float(p.get("catchGlow", 0.0)),
		"sclera_bright": float(p.get("whiteBright", 0.58)), "sclera_warm": float(p.get("whiteWarm", 0.35)),     # a white that isn't paper, warmer toward the corners (a doll's eyes glow: docs/GODOT_LOOK.md §5d, §5f); below 0 a cool, bluish white
	}
	out.merge({"rho": float(s.get("rho", 0.5)), "limbus_plane": float(s.get("zl", 0.866)), "dome_centre": float(s.get("zc", 0.4)),
		"dome_radius": float(s.get("rc", 0.65)), "iris_plane": float(s.get("zi", 0.85)),
		"ior": max(1.0, float(p.get("ior", 1.336))) if real else 1.0, "iris_bright": float(p.get("irisBright", 1.0)) if real else 1.0,
		"limbus_view": float(p.get("limbusView", 0.0)), "limbal": float(p.get("limbal", 0.5)), "limbal_width": float(p.get("limbalWidth", 0.18)),
		"limbal_soft": float(p.get("limbalSoft", 0.0)), "caustic": float(p.get("caustic", 0.6)) if real else 0.0,
		"roughness": 0.4 - 0.34 * gloss, "coat_roughness": 0.18 - 0.16 * gloss,
		"occlusion": 1.0,                                                # the lids' shadow (the wet layer's instead, when it's worn)
		"fx_pupil": float(p.get("pupil", 0.31)),                         # the painted pupil's share of the iris (HSEyeFx's glow leaves it a hole)
		"socket": float(p.get("socket", 0.35)),                          # the socket's shade (the Studio's; an export from before it, the Studio's default)
		"lid_room": LID_ROOM})
	return out


static func material(rec: Dictionary, paint: Texture2D) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader()
	if paint != null:
		m.set_shader_parameter("paint", paint)
	apply(m, rec, false)
	return m


## an eye's record onto its material (and again by HSEyePaint: the record with something changed); `wet`: it wears the
## wet layer, which shades by the real lids, so the lids' ellipse goes and the socket's guess halves; `overrides` the
## shader's numbers asked for by hand (HSEye.wear's), kept over the record's. Once worn, `lid_room` is left to what
## set it (her blinker)
static func apply(m: ShaderMaterial, rec: Dictionary, wet: bool, overrides: Dictionary = {}) -> void:
	var p := params(rec)
	if m.has_meta("hs_eye"):
		p.erase("lid_room")
	if wet:
		p["occlusion"] = 0.0
		p["socket"] = WET_SOCKET * float(p["socket"])
	for k in overrides:
		if k != "wet" and not String(k).begins_with("wet_") and (k != "lid_room" or not m.has_meta("hs_eye")):
			p[k] = overrides[k]
	for k in p:
		m.set_shader_parameter(k, p[k])
	m.set_meta("hs_eye", {"rec": rec, "wet": wet, "over": overrides})


## the wet layer over an eye (eye_wet.gdshader): the eye's shape from its record, the eyeball's radius from the mesh's
## bounds (a sphere: as wide as tall, the cornea's dome only adds depth)
static func wet_material(rec: Dictionary, mesh: Mesh) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = wet_shader()
	var p := params(rec)
	for k in ["rho", "limbus_plane", "dome_centre", "dome_radius", "lid_room"]:
		m.set_shader_parameter(k, p[k])
	var q: Dictionary = rec.get("paint", {}) if rec.get("paint") is Dictionary else {}
	if q.has("lidShade"):                         # the Studio's Lid shadow and Eye occlusion (an export since eyes v3 says them): 0.6 and 0.5 are the layer's own 0.45 and 0.6
		m.set_shader_parameter("top_shade", 0.75 * float(q["lidShade"]))
	if q.has("occlusion"):
		m.set_shader_parameter("shade", minf(0.95, 1.2 * float(q["occlusion"])))
	if mesh != null:
		var box := mesh.get_aabb()
		m.set_shader_parameter("eye_radius", 0.5 * minf(box.size.x, box.size.y))
	return m


## the eyes under a node given the Studio's eye; returns {material name: ShaderMaterial} (the eyes' and the tear line's;
## each eye's wet layer is its mesh's material_overlay). `overrides` go to the eye's shader, `wet_*` ones to its wet
## layer without the prefix, and `"wet": false` leaves the layer off (the lids' shadow then the eye's own ellipse)
static func wear(node: Node, glb_path: String, overrides: Dictionary = {}) -> Dictionary:
	var out := {}
	var recs := records(glb_path)
	if recs.is_empty():
		return out
	var wet: bool = not overrides.has("wet") or bool(overrides["wet"])
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
			apply(m, rec, wet, overrides)             # (the wet layer shades by the real lids: the ellipse goes and the socket's guess halves)
			mi.set_surface_override_material(s, m)
			out[name] = m
			if wet:
				var wm := wet_material(rec, mi.mesh)
				for k in overrides:
					if String(k).begins_with("wet_"):
						wm.set_shader_parameter(String(k).substr(4), overrides[k])
				if overrides.has("lid_room"):          # (the layer lies where the eye is drawn)
					wm.set_shader_parameter("lid_room", overrides["lid_room"])
				mi.material_overlay = wm
	var bl := HSBlink.attach(node) if not out.is_empty() else null   # her blinker: the blink, and the eyes' room while the face moves its lids (0 at rest)
	if bl != null:
		bl._find_eyes(node)
		bl.room = -1.0                                 # (set on its next frame, whatever the materials start with)
		if overrides.has("lid_room"):
			bl.room_scale = float(overrides["lid_room"]) / LID_ROOM
	var tears := records(glb_path, "studioTear")
	for mi in node.find_children("*", "MeshInstance3D", true, false):   # the tear line, wet
		if mi.mesh == null:
			continue
		for s in mi.mesh.get_surface_count():
			var old = mi.get_active_material(s)
			var name: String = old.resource_name if old != null else ""
			if tears.has(name) or (name == "" and String(mi.name).begins_with("tearline")):
				var m := tear_material(tears.get(name, {}))
				mi.set_surface_override_material(s, m)
				out[name if name != "" else String(mi.name)] = m
	if not out.is_empty():
		HSBlink.attach(node)                          # and the lids blink, when the export carries the blink (blink.gd)
		HSJiggle.attach(node)                         # and its ears flop, when it carries chains to jiggle (jiggle.gd)
	return out
