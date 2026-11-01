## A checkpoint (docs/GODOT_DIRECTOR.md §3, the panel's Player category): an area the player walks into; each time they
## do, the game autosaves there (the story's `checkpoint`, the pause menu's autosave slot: compile.gd gives it a moment
## of its own).
@tool
@icon("res://addons/horrorstudio_director/icons/checkpoint.svg")
class_name HSCheckpoint
extends HSTrigger


func _init() -> void:
	color = Color(0.95, 0.76, 0.48, 0.16)
	size = Vector3(1.6, 2.5, 1.6)


func _validate_property(p: Dictionary) -> void:
	if p["name"] == "safe":                             # an area's word, not a checkpoint's
		p["usage"] = PROPERTY_USAGE_NO_EDITOR
