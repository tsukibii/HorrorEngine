## A character's look as one thing to name (docs/GODOT_LOOK.md §5r, DECISIONS 2026-11-12, later: "a tool that lets us
## toggle between the eyes and skin shades (allows us to use default too), we should be able to make events or quests
## trigger different looks"): a skin (her own, or a creature skin: §5o, the cloak: §5p) and eyes (her own, or an eye
## look: §5q) with their numbers, how long turning to it takes, and the Story's words it's worn under. An HSLookSwitch
## (nodes/look_switch.gd) keeps a list of these and turns her from one to another; the look viewer
## (tools/look_viewer.tscn) saves them as .tres files.
##     var p := HSLookPreset.make({"name": "angry", "skin": "ember", "eyes": "glow", "eye_color": Color.RED})
@tool
@icon("res://addons/horrorstudio_look/icons/switch.svg")
class_name HSLookPreset
extends Resource

@export var name: String = ""                     ## what the switch, the areas and your scripts call it
@export_group("Skin")
@export_enum("default", "chrome", "mirror", "pearl", "greasy", "slime", "oil", "porcelain", "ember", "stone", "scales", "wax", "cloak") var skin: String = "default"   ## her own skin (default), a creature skin (HSCreatureSkin.LOOKS) or the cloak
@export_range(0.0, 1.0) var skin_amount: float = 1.0      ## how much of it: 0 her own paint, 1 the look
@export var skin_tint: Color = Color(0, 0, 0, 0)          ## its colour in place of the look's own (see-through: the look's)
@export var skin_extend: bool = true                      ## her horns and ears wear it too
@export_group("Eyes")
@export_enum("default", "glow", "black", "void", "white", "blind", "bloodshot", "spiral", "hearts", "star", "slit", "cross", "dilated", "pinprick") var eyes: String = "default"   ## her own eyes (default) or an eye look (HSEyeFx.LOOKS)
@export var eye_color: Color = Color(0, 0, 0, 0)          ## the look's colour in place of its own (see-through: the look's): the glow's, the hearts', the spiral's
@export_range(0.0, 1.0) var eye_amount: float = 1.0
@export_enum("both", "L", "R") var eye_side: String = "both"   ## one eye only
@export_group("Under the cloak")
@export var eyes_show: bool = false                       ## cloaked, her eyes are left to see (on by itself when Eyes isn't default)
@export var shadow: bool = false                          ## cloaked, she still casts a shadow
@export_group("When")
@export var seconds: float = -1.0                         ## how long turning to it takes (under 0: the switch's own Seconds)
@export var needs: String = ""                            ## the Story's words (task:<id> done, on:<id>, item:<name>, a fact, ! for not, commas for all): she wears it while they hold; empty: only when asked

const SKINS := ["default", "chrome", "mirror", "pearl", "greasy", "slime", "oil", "porcelain", "ember", "stone", "scales", "wax", "cloak"]
const EYES := ["default", "glow", "black", "void", "white", "blind", "bloodshot", "spiral", "hearts", "star", "slit", "cross", "dilated", "pinprick"]
const KEYS := ["name", "skin", "skin_amount", "skin_tint", "skin_extend", "eyes", "eye_color", "eye_amount", "eye_side", "eyes_show", "shadow", "seconds", "needs"]


## a look from a dictionary of its own words (what it doesn't name: the default)
static func make(d: Dictionary) -> HSLookPreset:
	var p := HSLookPreset.new()
	for k in d:
		if KEYS.has(str(k)):
			p.set(str(k), d[k])
	return p


## its words as a dictionary (all of them)
func words() -> Dictionary:
	var d := {}
	for k in KEYS:
		d[k] = get(k)
	return d


## in a sentence: "ember skin, glowing eyes"
func says() -> String:
	var parts: PackedStringArray = []
	parts.append("her own skin" if skin == "default" else ("cloaked" if skin == "cloak" else skin + " skin"))
	parts.append("her own eyes" if eyes == "default" else eyes + " eyes" + (" (" + eye_side + ")" if eye_side != "both" else ""))
	return ", ".join(parts)
