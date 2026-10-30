## The tape (UltraVHS, vhs.gd; docs/GODOT_LOOK.md §0): the camcorder look over the picture. In the game it is the
## level's own tape while the level is loaded, over the story's `game.vhs` (which comes back when the level goes); in
## a project of your own it adds the tape itself. Presets camcorder, camhybrid (less fisheye, soft only with
## distance), worn, nightmare, off; `strength` 0..1. Seen when the game runs.
@tool
@icon("res://addons/horrorstudio_look/icons/tape.svg")
class_name HSTape
extends Node

const VHS := preload("res://addons/horrorstudio_look/vhs.gd")

@export_enum("camcorder", "camhybrid", "worn", "nightmare", "off") var preset: String = "camhybrid"
@export_range(0.0, 1.0) var strength: float = 1.0
var vhs: CanvasLayer = null
var _prev := []
var _own := false


func _ready() -> void:
	if Engine.is_editor_hint():
		return
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		if n.get_script() == VHS:
			vhs = n
			break
	if vhs == null:
		vhs = VHS.new()
		vhs.name = "Tape"
		vhs.preset_name = preset
		vhs.strength = strength
		_own = true
		add_child(vhs)
		return
	_prev = [vhs.preset_name, vhs.strength]
	vhs.strength = strength
	vhs.preset(preset)


func _exit_tree() -> void:
	if not Engine.is_editor_hint() and not _own and vhs != null and is_instance_valid(vhs) and _prev.size() == 2:
		vhs.strength = float(_prev[1])
		vhs.preset(str(_prev[0]))
