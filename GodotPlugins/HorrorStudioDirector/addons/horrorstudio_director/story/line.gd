## A line of a dialogue (docs/GODOT_DIRECTOR.md §2): who says it (a character's id; empty: the player's own thought)
## and the words; HSOption children make it a question the player answers. `actions` run as it starts (a light
## flickers on her line, a sound).
@tool
@icon("res://addons/horrorstudio_director/icons/line.svg")
class_name HSLine
extends Node

@export var who: String = ""
@export_multiline var text: String = ""
## an acting note (not shown)
@export var act: String = ""
@export var actions: Array[HSAction] = []


func _validate_property(p: Dictionary) -> void:
	if p["name"] == "who":
		HSDirector.hint(p, "actor")


func options() -> Array:
	var out: Array = []
	for c in get_children():
		if c is HSOption:
			out.append(c)
	return out
