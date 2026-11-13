## An eye's paint as one thing to name (eyes v3; docs/GODOT_LOOK.md §5v): what HSEyePaint changes on a character's eyes
## (an iris's colours, its pattern, the pupil's shape, the iris's size, the white, the catchlights that stay), kept as a
## file. The look viewer's Eyes panel (eye_picker.gd) saves them into `res://looks/eyes/`; an HSCharacterLook's Eye Look
## wears one when the game runs; `eyes/` beside this file holds the ready-made ones (the eyes v3 look's own).
##     load("res://looks/eyes/violet.tres").wear($Her)      # her eyes painted so, now
@tool
@icon("res://addons/horrorstudio_look/icons/character.svg")
class_name HSEyeLook
extends Resource

const READY := "res://addons/horrorstudio_look/eyes"      ## the ready-made ones
const SAVED := "res://looks/eyes"                         ## where the Eyes panel saves yours

@export var title: String = ""                    ## what it's called
@export_multiline var about: String = ""
@export var paint: Dictionary = {}                ## HSEyePaint's words (the Studio's): only what's named is changed


static func make(look_title: String, words: Dictionary) -> HSEyeLook:
	var l := HSEyeLook.new()
	l.title = look_title
	l.paint = words.duplicate()
	return l


## onto a character's eyes (after HSEye.wear: an HSCharacterLook does it); returns her painter, or null when her eyes
## aren't the Studio's
func wear(node: Node, side: String = "both") -> HSEyePaint:
	var p := HSEyePaint.attach(node)
	if p != null:
		p.set_paint(paint, side)
	return p


## every eye look in the project: the ready-made ones and the saved ones, {title: path}
static func all() -> Dictionary:
	var out := {}
	for dir in [READY, SAVED]:
		var d := DirAccess.open(dir)
		if d == null:
			continue
		for f in d.get_files():
			var name := f.trim_suffix(".remap")
			if name.ends_with(".tres"):
				var r = load(dir.path_join(name))
				if r is HSEyeLook:
					out[r.title if r.title != "" else name.get_basename()] = dir.path_join(name)
	return out
