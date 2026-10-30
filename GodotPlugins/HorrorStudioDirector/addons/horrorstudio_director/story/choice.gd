## A choice (docs/GODOT_DIRECTOR.md §2): where the story branches, its ways HSOption children (each `go_to` a step).
## `by`: flags (the first option whose flags hold; the last with none is the otherwise), act (the player plays on in
## the level until one option's `when` happens: through the front door or down to the cellar), karma (by the karma
## the player has earned).
@tool
@icon("res://addons/horrorstudio_director/icons/choice.svg")
class_name HSChoice
extends Node

@export var id: String = ""
@export var title: String = ""
@export_enum("flags", "act", "karma") var by: String = "flags"
## act: the line shown while the player decides
@export var prompt: String = ""


func _enter_tree() -> void:
	HSDirector.auto_id(self)
	if title == "":
		title = str(name)


func options() -> Array:
	var out: Array = []
	for c in get_children():
		if c is HSOption:
			out.append(c)
	return out
