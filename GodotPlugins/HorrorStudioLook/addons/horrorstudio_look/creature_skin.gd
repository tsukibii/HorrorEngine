## Creature skins (docs/GODOT_LOOK.md §5o, DECISIONS 2026-11-11: "some more weird skin shaders/textures for the monster
## characters that we can apply in godot, e.g. a chrome silver skin, a pearlescent skin, some kind of greasy shader"):
## a look for a character's skin that isn't skin. One shader (creature_skin.gdshader), a look a set of its numbers
## (`LOOKS`): chrome, mirror, pearl, greasy, slime, black oil, porcelain, ember, stone, scales, wax; and **the cloak**
## (§5p: a shader of its own, creature_cloak.gdshader: she's what's behind her, bent; on everything she has, not only
## her skin; HSCloak, cloak.gd, makes it come and go in play). `HSCreatureSkin.wear(node,
## "chrome")` puts one on every skin surface under a character (the same surfaces HSSkin finds: a Studio export's
## `<name>_skin`, or meshes named skin, body, head, face), keeping what the skin had: its own paint (as much as the look
## leaves of it), its relief, its occlusion; with `extend` its horns and ears wear it too. `clear(node)` puts back what
## was there. On the HSCharacterLook node it's the Creature skin row; from a script:
##     HSCreatureSkin.wear($Demon, "chrome")
##     HSCreatureSkin.wear($Goblin, "greasy", {"amount": 0.7, "tint": Color(0.8, 0.9, 0.6)})
##     HSCreatureSkin.set_amount($Demon, 0.4)     # a skin turning: 0 her own paint, 1 the look
class_name HSCreatureSkin
extends RefCounted

const SHADER := "res://addons/horrorstudio_look/creature_skin.gdshader"
const CLOAK := "res://addons/horrorstudio_look/creature_cloak.gdshader"
const REGIONS := "res://addons/horrorstudio_look/textures/mhr_skin_regions.png"
const WAS := "hs_creature_was"                    # on a mesh: {surface: what it wore before} (clear puts it back)
const WAS_MESH := "hs_creature_mesh"              # on a mesh a whole look changed: {overlay, cast, visible} (the cloak's)
const NOT_NUMBERS := ["title", "about", "shader", "all", "shadow"]   # a look's words that aren't the shader's numbers
const FINE := ["hair", "lash", "brow", "fringe", "beard"]            # cards: nothing where their picture is see-through
const TWIN := "hs_shadow_twin"                    # on a mesh made here: a shadow-only twin of a cloaked one
const NEVER := ["tear"]                           # under a whole look these are only hidden (the tear line: a glint added over an eye that isn't there)
const EXTEND := ["horn", "antler", "ear_l", "ear_r", "ear_inner", "tail", "wing"]   # with `extend`: meshes named so wear it too

## each look: the shader's numbers (what it doesn't name is the shader's default), a title and a word about it
const LOOKS := {
	"chrome": {"title": "Chrome", "about": "polished silver: bright under any lamp, the room mirrored in it, the skin's relief faint",
		"tint": Color(0.95, 0.96, 0.98), "keep_paint": 0.0, "metallic": 0.84, "roughness": 0.13, "specular": 0.6, "coat": 0.5, "coat_roughness": 0.3, "relief": 0.3,
		"rim": 0.75, "rim_tint": 1.0},
	"mirror": {"title": "Mirror", "about": "a perfect mirror: it shows the room and nothing of its own (black where the room is black: it wants a sky, a reflection probe or lit walls)",
		"tint": Color(0.97, 0.97, 0.98), "keep_paint": 0.0, "metallic": 1.0, "roughness": 0.04, "specular": 0.5, "coat": 0.0, "relief": 0.2, "rim": 0.4, "rim_tint": 1.0},
	"pearl": {"title": "Pearl", "about": "a pearl's white with pinks and greens that turn as she moves",
		"tint": Color(0.94, 0.91, 0.89), "keep_paint": 0.12, "metallic": 0.35, "roughness": 0.28, "specular": 0.6, "coat": 0.7, "coat_roughness": 0.12, "relief": 0.45,
		"rim": 0.35, "rim_tint": 0.3, "irid": 0.62, "irid_face": 0.35, "irid_bands": 1.4, "irid_shift": 0.92, "irid_soft": 0.6, "irid_swirl": 0.4},
	"greasy": {"title": "Greasy", "about": "her own skin, sallow, under a film of grease in smears, dirt in every crease",
		"tint": Color(0.9, 0.84, 0.7), "keep_paint": 1.0, "metallic": 0.0, "roughness": 0.4, "specular": 0.55, "coat": 1.0, "coat_roughness": 0.1, "relief": 1.0,
		"blotch": 1.0, "blotch_m": 0.045, "blotch_rough": 0.45, "grime": Color(0.17, 0.12, 0.06), "grime_amount": 0.65},
	"slime": {"title": "Slime", "about": "a wet green gel over her, thick in patches, the light coming through it",
		"tint": Color(0.42, 0.6, 0.24), "keep_paint": 0.7, "metallic": 0.0, "roughness": 0.16, "specular": 0.7, "coat": 1.0, "coat_roughness": 0.03, "relief": 0.6,
		"blotch": 0.8, "blotch_m": 0.09, "blotch_rough": 0.18, "grime": Color(0.08, 0.14, 0.03), "grime_amount": 0.7, "rim": 0.3, "rim_tint": 0.8,
		"backlight": Color(0.25, 0.5, 0.12), "sss": 0.3},
	"oil": {"title": "Black oil", "about": "black and wet, an oil slick's colours along its edges",
		"tint": Color(0.015, 0.015, 0.02), "keep_paint": 0.0, "metallic": 0.75, "roughness": 0.12, "specular": 0.6, "coat": 1.0, "coat_roughness": 0.05, "relief": 0.7,
		"irid": 0.6, "irid_face": 0.02, "irid_bands": 1.6, "irid_shift": 0.55, "irid_soft": 0.3, "irid_swirl": 0.5, "blotch": 0.5, "blotch_m": 0.12, "blotch_rough": 0.12},
	"porcelain": {"title": "Porcelain", "about": "a doll's glazed white, hairline cracks across it",
		"tint": Color(0.93, 0.92, 0.9), "keep_paint": 0.22, "metallic": 0.0, "roughness": 0.22, "specular": 0.6, "coat": 0.9, "coat_roughness": 0.04, "relief": 0.1,
		"cracks": 1.0, "crack_m": 0.03, "crack_width": 0.028, "crack_cover": 0.55, "crack_color": Color(0.16, 0.13, 0.12)},
	"ember": {"title": "Ember", "about": "burnt black, its cracks lit from inside and breathing",
		"tint": Color(0.035, 0.03, 0.03), "keep_paint": 0.15, "metallic": 0.0, "roughness": 0.85, "specular": 0.25, "coat": 0.0, "relief": 1.3,
		"cracks": 1.0, "crack_m": 0.04, "crack_width": 0.09, "crack_cover": 0.8, "crack_color": Color(0.5, 0.08, 0.0), "glow": Color(1.0, 0.33, 0.04), "glow_amount": 3.5, "glow_pulse": 0.35},
	"stone": {"title": "Stone", "about": "a statue: grey, matt, cracked here and there",
		"tint": Color(0.56, 0.56, 0.54), "keep_paint": 0.1, "metallic": 0.0, "roughness": 0.9, "specular": 0.25, "coat": 0.0, "relief": 0.8,
		"blotch": 0.6, "blotch_m": 0.14, "blotch_rough": 0.1, "grime": Color(0.3, 0.33, 0.24), "grime_amount": 0.45,
		"cracks": 0.9, "crack_m": 0.08, "crack_width": 0.03, "crack_cover": 0.4, "crack_color": Color(0.13, 0.13, 0.12)},
	"scales": {"title": "Scales", "about": "a reptile's: her own colour in small glossy scales, a green sheen along the edges",
		"tint": Color(0.62, 0.74, 0.5), "keep_paint": 0.8, "metallic": 0.15, "roughness": 0.3, "specular": 0.6, "coat": 0.45, "coat_roughness": 0.15, "relief": 0.5,
		"scales": 1.0, "scale_m": 0.006, "scale_bump": 0.9, "irid": 0.3, "irid_face": 0.0, "irid_bands": 1.0, "irid_shift": 0.3, "irid_soft": 0.3, "irid_swirl": 0.2},
	"wax": {"title": "Wax", "about": "pale wax, soft, the light glowing through its edges",
		"tint": Color(0.93, 0.86, 0.72), "keep_paint": 0.3, "metallic": 0.0, "roughness": 0.5, "specular": 0.4, "coat": 0.25, "coat_roughness": 0.35, "relief": 0.15,
		"rim": 0.25, "rim_tint": 0.6, "backlight": Color(0.55, 0.33, 0.15), "sss": 0.7},
	# the cloak: a shader of its own (it reads the screen), on everything she has (`all`), casting no shadow (`shadow`)
	"cloak": {"title": "Cloak", "about": "invisible: the room behind her bent through her shape, nearly gone standing still, rippling when she moves",
		"shader": "cloak", "all": true, "shadow": false,
		"bend": 0.035, "shells": 5.0, "shell_mix": 0.7, "split": 0.25, "relief": 0.6, "ripple": 0.004, "ripple_m": 0.07, "edge_dark": 0.16, "glint": 0.15},
}


static func shader() -> Shader:
	return load(SHADER)


## the shader a look is drawn by: the creature skin's, or the cloak's own
static func shader_of(which) -> Shader:
	var d: Dictionary = which if which is Dictionary else LOOKS.get(str(which), {})
	return load(CLOAK) if str(d.get("shader", "")) == "cloak" else load(SHADER)


## a look's own word (`all`: on every mesh she has; `shadow`: whether she still casts one), a setting over it
static func _word(which, settings: Dictionary, key: String, otherwise: bool) -> bool:
	if settings.has(key):
		return bool(settings[key])
	var d: Dictionary = which if which is Dictionary else LOOKS.get(str(which), {})
	return bool(d.get(key, otherwise))


static func names() -> PackedStringArray:
	return PackedStringArray(LOOKS.keys())


## a look's numbers: by its name, or a dictionary of the shader's own (a look of yours)
static func look(which) -> Dictionary:
	var d: Dictionary = which if which is Dictionary else LOOKS.get(str(which), {})
	var out := {}
	for k in d:
		if not NOT_NUMBERS.has(k):
			out[k] = d[k]
	return out


## what a material gives a look to keep: {albedo: Color, texture_albedo, texture_normal, texture_orm, regions: bool}
## (a plain imported material, HSSkin's, or a creature skin's own)
static func base_of(old: Material) -> Dictionary:
	var b := {"albedo": Color(1, 1, 1)}
	var real := func(t) -> bool: return t is Texture2D and (t as Texture2D).get_width() > 8   # (the skin shader's flat stand-ins are a few pixels)
	if old is BaseMaterial3D:
		b["albedo"] = old.albedo_color
		if old.albedo_texture != null:
			b["texture_albedo"] = old.albedo_texture
		if old.normal_enabled and old.normal_texture != null:
			b["texture_normal"] = old.normal_texture
		if old.roughness_texture != null:
			b["texture_orm"] = old.roughness_texture
	elif old is ShaderMaterial:
		var sm := old as ShaderMaterial
		var alb = sm.get_shader_parameter("albedo")
		if alb is Color:
			b["albedo"] = alb
		for pair in [["texture_albedo", "texture_albedo"], ["texture_normal", "texture_normal"], ["texture_orm", "texture_orm"], ["texture_orm", "texture_roughness"]]:
			var t = sm.get_shader_parameter(pair[1])
			if real.call(t) and not b.has(pair[0]):
				b[pair[0]] = t
		if sm.get_shader_parameter("use_regions") == true:
			b["regions"] = true
	return b


## a look's material over what the skin had (`base`, from base_of); `settings`: amount, tint (a colour: instead of the
## look's), and any of the shader's numbers by name
static func material(which, base: Dictionary = {}, settings: Dictionary = {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader_of(which)
	m.set_shader_parameter("albedo", base.get("albedo", Color(1, 1, 1)))
	m.set_shader_parameter("alpha_cut", bool(base.get("cut", false)))
	for k in ["texture_albedo", "texture_normal", "texture_orm"]:
		if base.get(k) is Texture2D:
			m.set_shader_parameter(k, base[k])
	m.set_shader_parameter("use_orm", base.get("texture_orm") is Texture2D)
	if base.get("texture_normal") == null:
		m.set_shader_parameter("texture_normal", HSSkin.flat_normal())
	var regions: bool = bool(base.get("regions", false)) and ResourceLoader.exists(REGIONS)
	m.set_shader_parameter("use_regions", regions)
	if regions:
		m.set_shader_parameter("texture_regions", load(REGIONS))
	m.set_shader_parameter("uv_metres", base.get("uv_metres", HSSkin.MHR_UV_METRES))
	var d := look(which)
	for k in d:
		m.set_shader_parameter(k, d[k])
	for k in settings:
		if k == "tint":
			if settings[k] is Color and (settings[k] as Color).a > 0.0:
				m.set_shader_parameter("tint", Color(settings[k].r, settings[k].g, settings[k].b))
		elif not ["extend", "all", "shadow", "eyes"].has(k):
			m.set_shader_parameter(k, settings[k])
	m.set_meta("hs_creature", str(which) if not (which is Dictionary) else "custom")
	return m


static func _is_skin(mi: MeshInstance3D, s: int, old: Material) -> bool:      # as HSSkin.wear finds it
	var names: String = (mi.name + " " + (mi.mesh.surface_get_name(s) if mi.mesh is ArrayMesh else "") + " " + (old.resource_name if old != null else "")).to_lower()
	if not (names.contains("skin") or names.contains("body") or names.contains("head") or names.contains("face")):
		return false
	if String(mi.name).to_lower().ends_with("_skin"):
		return true
	return not (names.contains("eye") or names.contains("lash") or names.contains("brow") or names.contains("hair") or names.contains("teeth") or names.contains("tongue"))


## the metres a UV unit spans on this character's skin: MHR's (its head and hands, its body), times her own head's
## scale (the export's word, `studioScale` in the mesh's extras: a child's or a creature's head isn't sized by its
## height) and her body's (her height less her head, against MHR's): a goblin's scales are as big on its small body as on
## its big head
static func _metres(mi: MeshInstance3D) -> Vector2:
	var head := 1.0
	if mi.has_meta("extras"):
		var ex = mi.get_meta("extras")
		if ex is Dictionary and float(ex.get("studioScale", 0.0)) > 0.0:
			head = float(ex["studioScale"])
	var tall: float = mi.get_aabb().size.y if mi.mesh != null else 1.727
	var body := clampf((tall - 0.24 * head) / (1.727 - 0.24), 0.2, 3.0) if tall > 0.3 else head
	return Vector2(HSSkin.MHR_UV_METRES.x * head, HSSkin.MHR_UV_METRES.y * body)


static func _is_extra(mi: MeshInstance3D) -> bool:
	var nm := String(mi.name).to_lower()
	for w in EXTEND:
		if nm.contains(w):
			return true
	return false


static func _named(mi: MeshInstance3D, words: Array) -> bool:
	var nm := String(mi.name).to_lower()
	for w in words:
		if nm.contains(w):
			return true
	return false


## the look on every skin surface under `node` (and, with settings.extend, on its horns and ears); returns the
## materials. Worn again with another look, it takes the first one's place; `clear` puts back what was there before any.
## A whole look (the cloak: its `all`) goes on every mesh she has, her eyes, hair and clothes too: `eyes: true` in the
## settings leaves her eyes as they are (two eyes in the air), `shadow: true` lets her go on casting a shadow (nobody
## there, and a shadow on the wall); her eyes' wet layer and tear line are put away with it and come back with `clear`
static func wear(node: Node, which = "chrome", settings: Dictionary = {}) -> Array:
	var out: Array = []
	if node == null or (not (which is Dictionary) and not LOOKS.has(str(which))):
		return out
	var extend := bool(settings.get("extend", false))
	var all := _word(which, settings, "all", false)
	var shadow := _word(which, settings, "shadow", true)
	var keep_eyes := bool(settings.get("eyes", false))
	for mi in node.find_children("*", "MeshInstance3D", true, false):   # a whole look worn before (the cloak): everything back first
		if mi.has_meta(WAS_MESH):
			clear(node)
			break
	var meshes: Array = node.find_children("*", "MeshInstance3D", true, false)
	if node is MeshInstance3D:
		meshes.append(node)
	for mi in meshes:
		if mi.mesh == null or mi.has_meta(TWIN):
			continue
		for s in mi.mesh.get_surface_count():
			var now: Material = mi.get_active_material(s)
			var was: Dictionary = mi.get_meta(WAS) if mi.has_meta(WAS) else {}
			var old: Material = was[s]["active"] if was.has(s) else now   # (what it had before any look: the maps come from there)
			var skin := _is_skin(mi, s, old)
			if all:
				if (keep_eyes and _named(mi, ["eye"]) and not _named(mi, FINE)) or _named(mi, NEVER):
					continue
			elif not skin and not (extend and _is_extra(mi)):
				continue
			if not was.has(s):
				was[s] = {"override": mi.get_surface_override_material(s), "active": now}
				mi.set_meta(WAS, was)
			var base := base_of(old)
			if skin and String(mi.name).to_lower().ends_with("_skin"):
				base["regions"] = true                   # a Studio export's skin: MHR's layout
				base["uv_metres"] = _metres(mi)
			elif not skin:
				base["uv_metres"] = Vector2(0.25, 0.25)   # a horn's or an ear's own UVs: about a quarter of a metre across
				base["cut"] = _named(mi, FINE)
			var m := material(which, base, settings)
			mi.set_surface_override_material(s, m)
			out.append(m)
		if all or not shadow:                            # the mesh as a whole: its overlay (an eye's wet layer), its shadow, a tear line hidden
			if not mi.has_meta(WAS_MESH):
				mi.set_meta(WAS_MESH, {"overlay": mi.material_overlay, "cast": mi.cast_shadow, "visible": mi.visible})
			var held: Dictionary = mi.get_meta(WAS_MESH)
			mi.cast_shadow = held["cast"] if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			# a look that reads the screen casts no shadow of its own: one that should gets a shadow-only twin (the
			# mesh again on the same skeleton, never drawn, never saved)
			var left_alone := _named(mi, NEVER) or (keep_eyes and _named(mi, ["eye"]) and not _named(mi, FINE))   # (hidden, or still itself: no twin)
			if shadow and shader_of(which) != shader() and not left_alone and mi.visible and not held.has("twin") and held["cast"] != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF and mi.get_parent() != null:
				var twin := MeshInstance3D.new()
				twin.name = String(mi.name) + "_shadow"
				twin.mesh = mi.mesh
				twin.skin = mi.skin
				twin.skeleton = mi.skeleton
				twin.transform = mi.transform
				twin.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
				twin.set_meta(TWIN, true)
				mi.get_parent().add_child(twin)
				held["twin"] = twin
				mi.set_meta(WAS_MESH, held)
			if all:
				if _named(mi, NEVER):
					mi.visible = false
				elif not (keep_eyes and _named(mi, ["eye"])):
					mi.material_overlay = null
	return out


## what every surface under `node` wore before its creature skin, back on; returns how many
static func clear(node: Node) -> int:
	var n := 0
	var meshes: Array = node.find_children("*", "MeshInstance3D", true, false)
	if node is MeshInstance3D:
		meshes.append(node)
	for mi in meshes:
		if mi.has_meta(WAS_MESH):
			var held: Dictionary = mi.get_meta(WAS_MESH)
			mi.material_overlay = held["overlay"]
			mi.cast_shadow = held["cast"]
			mi.visible = held["visible"]
			if held.get("twin") is Node and is_instance_valid(held["twin"]):
				held["twin"].queue_free()
			mi.remove_meta(WAS_MESH)
		if not mi.has_meta(WAS):
			continue
		var was: Dictionary = mi.get_meta(WAS)
		for s in was:
			mi.set_surface_override_material(int(s), was[s]["override"])
			n += 1
		mi.remove_meta(WAS)
	return n


## the creature skin's materials under a node now
static func worn(node: Node) -> Array:
	var out: Array = []
	var meshes: Array = node.find_children("*", "MeshInstance3D", true, false)
	if node is MeshInstance3D:
		meshes.append(node)
	for mi in meshes:
		if mi.mesh == null or mi.has_meta(TWIN):
			continue
		for s in mi.mesh.get_surface_count():
			var m = mi.get_surface_override_material(s)
			if m is ShaderMaterial and m.has_meta("hs_creature"):
				out.append(m)
	return out


## how much of the look (0 her own paint, 1 the look), on a node's creature skin or on a list of its materials
static func set_amount(node_or_materials, k: float) -> void:
	var mats: Array = node_or_materials if node_or_materials is Array else worn(node_or_materials)
	for m in mats:
		if m is ShaderMaterial:
			m.set_shader_parameter("amount", clampf(k, 0.0, 1.0))
