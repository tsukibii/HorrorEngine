## Creepy eyes (docs/GODOT_LOOK.md §5q, DECISIONS 2026-11-12: "some glowing eye shaders or creepy eye effects,
## spiral eyes, glowing eyes (adjustable color), black eye, love hearts inside the eyes"): looks for a Character Studio
## export's eyes, drawn by the eye's own shader (eye.gdshader's `fx_*` numbers) on the iris's disc behind the cornea,
## so the cornea's catchlight, the lids' shadow and the wet layer stay over them. A look is a set of those numbers
## (`LOOKS`): glow (lit from inside, any colour: seen in the dark), black (the whole eye), void (black, a point of
## light in the middle), white (no iris, the whole eye a pale lamp), blind (clouded over), bloodshot, spiral (turning),
## hearts (throbbing), star, slit (a serpent's pupil), cross, dilated, pinprick.
##     HSEyeFx.wear($Her, "glow", {"color": Color(0.2, 1.0, 0.3)})     # green
##     HSEyeFx.wear($Her, "hearts")
##     HSEyeFx.wear($Her, "black", {"side": "L"})                      # one eye
##     HSEyeFx.set_amount($Her, 0.5)                                   # coming on: 0 her own eyes, 1 the look
##     HSEyeFx.clear($Her)
## On the HSCharacterLook node it's the Creepy eyes row (`set_eyes`). It needs the eyes on the eye shader (HSEye.wear:
## the node does it; a Studio export). Eyes that aren't (a stand-in's) get the plain version: `glow` an emission of the
## colour, `black` a black glossy ball; the other looks need the Studio's eye.
class_name HSEyeFx
extends RefCounted

const WAS := "hs_eye_fx_was"                      # on a mesh with plain eyes: {surface: the override before}
## every number a look can set, and what it's at with no look
const NONE := {"fx_amount": 1.0, "fx_glow": 0.0, "fx_glow_color": Color(1.0, 0.1, 0.05), "fx_glow_pupil": 0.0, "fx_glow_white": 0.0, "fx_glow_pulse": 0.0,
	"fx_black": 0.0, "fx_black_iris": 1.0, "fx_blind": 0.0, "fx_blood": 0.0, "fx_dilate": 0.0,
	"fx_spiral": 0.0, "fx_spiral_a": Color(0.95, 0.05, 0.1), "fx_spiral_b": Color(0.02, 0.0, 0.01), "fx_spiral_arms": 2.0, "fx_spiral_twist": 1.6, "fx_spiral_speed": 0.5, "fx_spiral_glow": 0.0,
	"fx_mark": 0.0, "fx_mark_shape": 0, "fx_mark_color": Color(1.0, 0.25, 0.5), "fx_mark_size": 0.5, "fx_mark_beat": 0.0, "fx_mark_glow": 0.0}

## each look: the shader's numbers, a title, a word about it, and `color`: which of its colours the `color` setting changes
const LOOKS := {
	"glow": {"title": "Glowing", "about": "the iris lit from inside, any colour: two points in the dark",
		"color": "fx_glow_color", "fx_glow": 2.2, "fx_glow_color": Color(1.0, 0.1, 0.05)},
	"black": {"title": "Black", "about": "the whole eye black and wet, no white, no iris",
		"fx_black": 1.0, "fx_black_iris": 1.0},
	"void": {"title": "Void", "about": "black, with a point of light in the middle",
		"color": "fx_mark_color", "fx_black": 1.0, "fx_black_iris": 1.0, "fx_mark": 1.0, "fx_mark_shape": 3, "fx_mark_size": 0.09, "fx_mark_color": Color(1.0, 0.95, 0.9), "fx_mark_glow": 8.0},
	"white": {"title": "White", "about": "no iris, no pupil: the whole eye a pale lamp",
		"color": "fx_glow_color", "fx_blind": 1.0, "fx_glow": 1.2, "fx_glow_color": Color(0.85, 0.9, 1.0), "fx_glow_pupil": 1.0, "fx_glow_white": 0.7},
	"blind": {"title": "Blind", "about": "the iris and pupil clouded over, milky",
		"fx_blind": 0.92},
	"bloodshot": {"title": "Bloodshot", "about": "the white reddened, veins toward the corners, the pupil wide",
		"fx_blood": 1.0, "fx_dilate": 0.35},
	"spiral": {"title": "Spiral", "about": "a spiral turning in place of the iris",
		"color": "fx_spiral_a", "fx_spiral": 1.0, "fx_spiral_a": Color(0.95, 0.05, 0.1), "fx_spiral_b": Color(0.02, 0.0, 0.01), "fx_spiral_arms": 2.0, "fx_spiral_twist": 1.6, "fx_spiral_speed": 0.5, "fx_spiral_glow": 0.8},
	"hearts": {"title": "Hearts", "about": "a heart in each eye in place of the pupil, throbbing",
		"color": "fx_mark_color", "fx_dilate": -1.0, "fx_mark": 1.0, "fx_mark_shape": 0, "fx_mark_size": 0.5, "fx_mark_color": Color(1.0, 0.22, 0.5), "fx_mark_beat": 1.2, "fx_mark_glow": 1.2},
	"star": {"title": "Stars", "about": "a star in each eye",
		"color": "fx_mark_color", "fx_dilate": -1.0, "fx_mark": 1.0, "fx_mark_shape": 4, "fx_mark_size": 0.5, "fx_mark_color": Color(1.0, 0.85, 0.3), "fx_mark_glow": 1.5},
	"slit": {"title": "Slit", "about": "a serpent's upright pupil",
		"color": "fx_mark_color", "fx_dilate": -1.0, "fx_mark": 1.0, "fx_mark_shape": 1, "fx_mark_size": 0.85, "fx_mark_color": Color(0.004, 0.003, 0.003)},
	"cross": {"title": "Cross", "about": "a cross where the pupil was",
		"color": "fx_mark_color", "fx_dilate": -1.0, "fx_mark": 1.0, "fx_mark_shape": 2, "fx_mark_size": 0.55, "fx_mark_color": Color(0.004, 0.003, 0.003)},
	"dilated": {"title": "Dilated", "about": "the pupils blown wide: hardly any iris left",
		"fx_dilate": 0.85},
	"pinprick": {"title": "Pinprick", "about": "the pupils shrunk to points",
		"fx_dilate": -0.75},
}


static func names() -> PackedStringArray:
	return PackedStringArray(LOOKS.keys())


## a look's numbers: by its name, or a dictionary of the shader's own (a look of yours)
static func look(which) -> Dictionary:
	var d: Dictionary = which if which is Dictionary else LOOKS.get(str(which), {})
	var out := {}
	for k in d:
		if str(k).begins_with("fx_"):
			out[k] = d[k]
	return out


static func _meshes(node: Node) -> Array:
	var meshes: Array = node.find_children("*", "MeshInstance3D", true, false)
	if node is MeshInstance3D:
		meshes.append(node)
	return meshes


static func _side(mi: MeshInstance3D, side: String) -> bool:
	if side == "" or side == "both":
		return true
	var nm := String(mi.name).to_lower()
	return nm.ends_with("_" + side.to_lower()) or nm.ends_with("." + side.to_lower()) or nm.contains("_" + side.to_lower() + "_")


## the eyes under a node on the eye shader: [[mesh, surface, material]] (`side`: "L" or "R" for one of them)
static func eyes(node: Node, side: String = "") -> Array:
	var out: Array = []
	if node == null:
		return out
	for mi in _meshes(node):
		if mi.mesh == null or not _side(mi, side):
			continue
		for s in mi.mesh.get_surface_count():
			var m: Material = mi.get_active_material(s)
			if m is ShaderMaterial and (m as ShaderMaterial).shader == HSEye.shader():
				out.append([mi, s, m])
	return out


static func _plain_eye(mi: MeshInstance3D) -> bool:
	var nm := String(mi.name).to_lower()
	return nm.contains("eye") and not (nm.contains("lash") or nm.contains("brow") or nm.contains("lid") or nm.contains("tear"))


## the look on a character's eyes; returns the materials. `settings`: `color` (the look's own colour changed: a glow's,
## a heart's, a spiral's), `amount` (0 her own eyes, 1 the look), `side` ("L" or "R": one eye), and any of the eye
## shader's fx_ numbers by name. Worn again with another look, it takes the first one's place
static func wear(node: Node, which = "glow", settings: Dictionary = {}) -> Array:
	var out: Array = []
	if node == null or (not (which is Dictionary) and not LOOKS.has(str(which))):
		return out
	var d: Dictionary = which if which is Dictionary else LOOKS[str(which)]
	var nums := NONE.duplicate()
	nums.merge(look(which), true)
	for k in settings:
		if str(k).begins_with("fx_"):
			nums[k] = settings[k]
	if settings.get("color") is Color and (settings["color"] as Color).a > 0.0 and d.has("color"):
		var c: Color = settings["color"]
		nums[str(d["color"])] = Color(c.r, c.g, c.b)
	nums["fx_amount"] = clampf(float(settings.get("amount", 1.0)), 0.0, 1.0)
	var side := str(settings.get("side", ""))
	for e in eyes(node, side):
		var m: ShaderMaterial = e[2]
		for k in nums:
			m.set_shader_parameter(k, nums[k])
		m.set_meta("hs_eye_fx", str(which) if not (which is Dictionary) else "custom")
		out.append(m)
	if out.is_empty():                               # no Studio eyes: the plain version on meshes named eye
		var glow: float = float(nums["fx_glow"]) * float(nums["fx_amount"])
		var black: float = float(nums["fx_black"]) * float(nums["fx_amount"])
		if glow <= 0.0 and black <= 0.0:
			return out
		for mi in _meshes(node):
			if mi.mesh == null or not _plain_eye(mi) or not _side(mi, side):
				continue
			var was: Dictionary = mi.get_meta(WAS) if mi.has_meta(WAS) else {}
			for s in mi.mesh.get_surface_count():
				if not was.has(s):
					was[s] = mi.get_surface_override_material(s)
				var old: Material = was[s] if was[s] != null else mi.mesh.surface_get_material(s)
				var m := (old.duplicate() if old is StandardMaterial3D else StandardMaterial3D.new()) as StandardMaterial3D
				if black > 0.0:
					m.albedo_color = m.albedo_color.lerp(Color(0.003, 0.003, 0.003), black)
					m.albedo_texture = null if black > 0.5 else m.albedo_texture
					m.roughness = 0.08
				if glow > 0.0:
					m.emission_enabled = true
					m.emission = nums["fx_glow_color"]
					m.emission_energy_multiplier = glow
				m.set_meta("hs_eye_fx", str(which) if not (which is Dictionary) else "custom")
				mi.set_surface_override_material(s, m)
				out.append(m)
			mi.set_meta(WAS, was)
	return out


## her own eyes back; returns how many eyes it left
static func clear(node: Node) -> int:
	var n := 0
	if node == null:
		return n
	for e in eyes(node):
		var m: ShaderMaterial = e[2]
		if m.has_meta("hs_eye_fx"):
			for k in NONE:
				m.set_shader_parameter(k, NONE[k])
			m.remove_meta("hs_eye_fx")
			n += 1
	for mi in _meshes(node):
		if mi.has_meta(WAS):
			var was: Dictionary = mi.get_meta(WAS)
			for s in was:
				mi.set_surface_override_material(int(s), was[s])
				n += 1
			mi.remove_meta(WAS)
	return n


## the eyes' materials wearing a look now
static func worn(node: Node) -> Array:
	var out: Array = []
	for mi in (_meshes(node) if node != null else []):
		if mi.mesh == null:
			continue
		for s in mi.mesh.get_surface_count():
			var m: Material = mi.get_active_material(s)
			if m != null and m.has_meta("hs_eye_fx"):
				out.append(m)
	return out


## how much of the look (0 her own eyes, 1 the look): eyes that light up over a second
static func set_amount(node_or_materials, k: float) -> void:
	var mats: Array = node_or_materials if node_or_materials is Array else worn(node_or_materials)
	for m in mats:
		if m is ShaderMaterial:
			m.set_shader_parameter("fx_amount", clampf(k, 0.0, 1.0))


## the look's colour changed while it's worn (a glow going from amber to red)
static func set_color(node: Node, c: Color) -> void:
	for m in worn(node):
		if not (m is ShaderMaterial):
			if m is StandardMaterial3D and (m as StandardMaterial3D).emission_enabled:
				(m as StandardMaterial3D).emission = c
			continue
		var d: Dictionary = LOOKS.get(str(m.get_meta("hs_eye_fx")), {})
		if d.has("color"):
			m.set_shader_parameter(str(d["color"]), Color(c.r, c.g, c.b))
