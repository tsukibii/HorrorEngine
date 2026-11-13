## A character's look (HSSkin, HSEye, HSHair; docs/GODOT_LOOK.md §0): a model's skin on HumanShaders' skin shader (its
## own colour and maps kept; wet, sweating, dripping or oiled by the numbers; on a Studio export the skin's detail at its
## true size, its look picked from the export or named here: §5d; and its depth, warm light from under the skin round the
## eyes, the nose, the mouth and the ears: §5g, Ear Glow off when the hair covers the ears), a Character Studio export's eyes on the
## Studio's refracting eye, card hair, lashes and brows on the hair shader, and an export's animal ears on springs
## (HSJiggle: §5n), a creature skin over it all when one is picked (HSCreatureSkin: §5o; the cloak: §5p) and creepy eyes
## (HSEyeFx: §5q). Drop it under the character (an
## imported glb, or any model whose meshes are named skin/body/head, eye, hair/lash/brow). Put on when the game runs.
## The cast the game places itself already wear it (the story's `skin` word wets them).
@tool
@icon("res://addons/horrorstudio_look/icons/character.svg")
class_name HSCharacterLook
extends Node

@export var target: Node3D = null              ## the character; empty: the parent
@export var skin := true
@export_range(0.0, 1.0) var wetness: float = 0.0
@export_range(0.0, 1.0) var sweat: float = 0.0
@export_range(0.0, 1.0) var drips: float = 0.0
@export_range(0.0, 1.0) var oil: float = 0.0
@export_enum("auto", "young", "natural", "adult", "old", "off") var skin_detail: String = "auto"   ## the pores, furrows and colour's unevenness at their true size (HSSkin.DETAIL_PRESETS; auto: from the export's own age and pores)
@export_range(0.0, 2.0) var detail_amount: float = 1.0                 ## the detail layer as a whole
@export_range(0.0, 3.0) var skin_depth: float = 1.0                    ## light from under the skin, warm round the eyes, the nose, the mouth and the ears (HSSkin.set_depth): times the character's own Depth; 0 off
@export_enum("auto", "on", "off") var ear_glow: String = "auto"        ## the ears' share of it: off when the hair covers the ears (auto: the character's own Ear glow, the Studio's Skin light)
@export_group("Skin depth's parts")
@export_range(0.0, 2.0) var depth_edge: float = 0.25                   ## warmer where the skin turns away from the eye (a cheek's side, the jaw, the neck)
@export_range(0.0, 1.0) var depth_creases: float = 0.15                ## the creases everywhere else warm instead of grey (under the jaw, the neck's folds, between the fingers)
@export_range(0.0, 2.0) var depth_fingers: float = 0.7                 ## the fingers' thin skin lit through by the room, as an ear's
@export_range(0.0, 2.0) var depth_lips: float = 0.5                    ## the lips themselves
@export_group("")
@export var eyes := true
@export var hair := true
@export var jiggle := true                     ## an export's animal ears (any chain of bones named jiggle_<name>_0 ... _tip) flop as she moves (HSJiggle)
@export_range(0.0, 2.0) var jiggle_amount: float = 1.0   ## how lively: 0 still, 2 very floppy
@export_file("*.glb") var glb_path: String = ""  ## the export's glb (its skin and eye records); empty: the character's own file
@export_group("Creature skin")
@export_enum("none", "chrome", "mirror", "pearl", "greasy", "slime", "oil", "porcelain", "ember", "stone", "scales", "wax", "cloak") var creature_skin: String = "none"   ## a skin that isn't skin, over her own (HSCreatureSkin.LOOKS: chrome silver, a pearl's sheen, grease, slime, black oil, cracked porcelain, burning embers, stone, scales, wax; §5o; cloak: invisible, the room behind her bent through her shape, on everything she has: §5p, and an HSCloak node beside this one makes it come and go)
@export_range(0.0, 1.0) var creature_amount: float = 1.0   ## how much of it: 0 her own paint, 1 the look (set_creature_amount while the game runs: a skin turning)
@export var creature_tint: Color = Color(0, 0, 0, 0)       ## its colour in place of the look's own (see-through: the look's): chrome in gold, slime in purple
@export var creature_extend := true                        ## her horns and ears wear it too
@export_group("Creepy eyes")
@export_enum("none", "glow", "black", "void", "white", "blind", "bloodshot", "spiral", "hearts", "star", "slit", "cross", "dilated", "pinprick") var eye_fx: String = "none"   ## her eyes changed (HSEyeFx.LOOKS: lit from inside, all black, black with a point of light, a pale lamp, clouded over, bloodshot, a turning spiral, hearts, stars, a serpent's slit, a cross, pupils blown wide or shrunk to points; §5q)
@export var eye_fx_color: Color = Color(0, 0, 0, 0)        ## the look's colour in place of its own (see-through: the look's): the glow's, the hearts', the spiral's
@export_range(0.0, 1.0) var eye_fx_amount: float = 1.0     ## how much of it: 0 her own eyes, 1 the look (set_eyes_amount while the game runs: eyes that light up)
@export_enum("both", "L", "R") var eye_fx_side: String = "both"   ## one eye only
@export_group("Eye paint")
@export var eye_look: HSEyeLook = null                     ## her eyes painted again when the game runs (eyes v3: HSEyePaint): a saved eye look (the look viewer's Eye sliders save them; `eyes/` in the plugin has the ready-made ones)
@export var eye_paint: Dictionary = {}                     ## and single numbers over it, in the Studio's words ("iris": "#1a4a8a", "pupilShape": "slit", "irisSize": 36): the sliders below write here
@export_group("")
var materials: Array = []
var _own_eyes := {}                           # the export's own eye numbers (its record), read once for the Inspector's sliders


## the eye's sliders in the Inspector (eyes v3): every number HSEyePaint takes, shown under Eye paint as "eye/<name>",
## starting from the export's own (read from its record) and kept in `eye_paint` only where it differs
func _get_property_list() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for c in HSEyePaint.COLOURS:
		out.append({"name": "eye/" + c[0], "type": TYPE_COLOR, "hint": PROPERTY_HINT_COLOR_NO_ALPHA, "usage": PROPERTY_USAGE_EDITOR})
	for ch in HSEyePaint.CHOICES:
		out.append({"name": "eye/" + ch[0], "type": TYPE_STRING, "hint": PROPERTY_HINT_ENUM, "hint_string": ",".join(PackedStringArray(ch[2])), "usage": PROPERTY_USAGE_EDITOR})
	for c in HSEyePaint.CONTROLS:
		out.append({"name": "eye/" + c[0], "type": TYPE_FLOAT, "hint": PROPERTY_HINT_RANGE, "hint_string": "%s,%s,%s" % [c[2], c[3], c[4]], "usage": PROPERTY_USAGE_EDITOR})
	return out


## her export's own eye numbers (the left eye's record over the Studio's defaults, an eye look's over those)
func own_eye(key: String):
	if _own_eyes.is_empty():
		_own_eyes = HSEyePaint.DEFAULTS.duplicate()
		var t := character()
		var path := glb_path if glb_path != "" else (t.scene_file_path if t != null else "")
		if path.ends_with(".glb"):
			var recs := HSEye.records(path)
			for k in recs:
				if recs[k] is Dictionary and recs[k].get("paint") is Dictionary and (str(recs[k].get("side", "L")) == "L" or recs.size() == 1):
					_own_eyes.merge(recs[k]["paint"], true)
	if eye_look != null and eye_look.paint.has(key):
		return eye_look.paint[key]
	return _own_eyes.get(key)


func _get(prop: StringName):
	var p := String(prop)
	if not p.begins_with("eye/"):
		return null
	var key := p.substr(4)
	var v = eye_paint.get(key, own_eye(key))
	if v is String and Color.html_is_valid(v) and HSEyePaint.COLOURS.any(func(c): return c[0] == key):
		return Color.html(v)
	return v


func _set(prop: StringName, value) -> bool:
	var p := String(prop)
	if not p.begins_with("eye/"):
		return false
	var key := p.substr(4)
	if value is Color:
		value = "#" + Color(value.r, value.g, value.b).to_html(false)
	if value == own_eye(key):
		eye_paint.erase(key)
	else:
		eye_paint[key] = value
	if not Engine.is_editor_hint() and is_inside_tree():
		set_eye_paint({key: value})
	return true


func _property_can_revert(prop: StringName) -> bool:
	return String(prop).begins_with("eye/") and eye_paint.has(String(prop).substr(4))


func _property_get_revert(prop: StringName):
	var v = own_eye(String(prop).substr(4))
	return Color.html(v) if v is String and Color.html_is_valid(v) and String(prop).substr(4) in ["iris", "iris2", "accent", "pupilColor", "sclera", "corner"] else v


func character() -> Node3D:
	return target if target != null else get_parent() as Node3D


func _ready() -> void:
	if not Engine.is_editor_hint():
		wear.call_deferred()


func wear() -> void:
	var t := character()
	if t == null:
		return
	var path := glb_path if glb_path != "" else t.scene_file_path
	materials.clear()
	if skin:
		var st := {"wetness": wetness, "sweat": sweat, "drips": drips, "oil": oil, "detail": 0.0 if skin_detail == "off" else detail_amount,
				"depth": skin_depth, "depth_look": {"depth_edge": depth_edge, "depth_rest": depth_creases, "depth_hands": depth_fingers, "depth_lips": depth_lips}}
		if ear_glow != "auto":
			st["depth_ears"] = ear_glow == "on"
		if skin_detail != "auto" and skin_detail != "off":
			st["detail_preset"] = skin_detail
		materials.append_array(HSSkin.wear(t, st, path if path.ends_with(".glb") else ""))
	if eyes and path.ends_with(".glb"):
		materials.append_array(HSEye.wear(t, path).values())
	if hair:
		materials.append_array(HSHair.wear(t, {}, path if path.ends_with(".glb") else ""))
	if eyes and (eye_look != null or not eye_paint.is_empty()):   # her eyes painted again (eyes v3): the eye look, then the single numbers
		var words: Dictionary = eye_look.paint.duplicate() if eye_look != null else {}
		words.merge(eye_paint, true)
		set_eye_paint(words)
	if eye_fx != "none":                           # (before a cloak: it keeps what her eyes wear under it)
		HSEyeFx.wear(t, eye_fx, {"color": eye_fx_color, "amount": eye_fx_amount, "side": eye_fx_side})
	if creature_skin != "none":                    # over the skin's own material: what it had (its paint, its relief) kept under the look
		materials.append_array(HSCreatureSkin.wear(t, creature_skin, {"amount": creature_amount, "tint": creature_tint, "extend": creature_extend}))
	var j := HSJiggle.of(t)                        # (HSEye.wear may have added one already)
	if jiggle and j == null:
		j = HSJiggle.attach(t, {"amount": jiggle_amount})
	elif j != null:
		j.set_amount(jiggle_amount if jiggle else 0.0)


## the skin's wetness now (0..1 each)
func set_wet(s: Dictionary) -> void:
	for m in materials:
		if m is ShaderMaterial and m.shader == HSSkin.shader():
			HSSkin.set_wet(m, s)


## another creature skin while the game runs ("none": her own skin back)
func set_creature(look: String, amount: float = 1.0) -> void:
	var t := character()
	if t == null:
		return
	creature_skin = look
	creature_amount = amount
	HSCreatureSkin.clear(t)
	if look != "none":
		HSCreatureSkin.wear(t, look, {"amount": amount, "tint": creature_tint, "extend": creature_extend})


## how much of the creature skin (0 her own paint, 1 the look): for a skin that turns over a few seconds
func set_creature_amount(k: float) -> void:
	creature_amount = clampf(k, 0.0, 1.0)
	var t := character()
	if t != null:
		HSCreatureSkin.set_amount(t, creature_amount)


## her eyes' paint changed while the game runs (eyes v3: HSEyePaint's words, the Studio's: "iris", "pattern",
## "pupilShape", "irisSize", "catchKeep"...); returns her painter (its `painted` when the new picture is on)
func set_eye_paint(changes: Dictionary, side: String = "both") -> HSEyePaint:
	var t := character()
	var p := HSEyePaint.attach(t) if t != null else null
	if p != null:
		p.set_paint(changes, side)
	return p


## her export's own eyes again
func reset_eye_paint() -> void:
	var t := character()
	var p := HSEyePaint.of(t) if t != null else null
	if p != null:
		p.reset()


## other eyes while the game runs ("none": her own back); `color` see-through: the look's own
func set_eyes(look: String, color: Color = Color(0, 0, 0, 0), amount: float = 1.0) -> void:
	var t := character()
	if t == null:
		return
	eye_fx = look
	eye_fx_color = color
	eye_fx_amount = amount
	HSEyeFx.clear(t)
	if look != "none":
		HSEyeFx.wear(t, look, {"color": color, "amount": amount, "side": eye_fx_side})


## how much of the eyes' look (0 her own eyes, 1 the look): eyes that light up over a second
func set_eyes_amount(k: float) -> void:
	eye_fx_amount = clampf(k, 0.0, 1.0)
	var t := character()
	if t != null:
		HSEyeFx.set_amount(t, eye_fx_amount)


func _get_configuration_warnings() -> PackedStringArray:
	return PackedStringArray() if character() != null else PackedStringArray(["Put this under the character, or set Target."])
