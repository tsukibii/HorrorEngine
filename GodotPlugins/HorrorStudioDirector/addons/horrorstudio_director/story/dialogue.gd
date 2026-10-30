## A dialogue (docs/GODOT_DIRECTOR.md §2): a conversation played live, the eye the player's own (they look round,
## they can walk if standing; no cuts), its lines in order (HSLine children: who says it and the words, or the
## player's thought), a line's answers (HSOption children of that line: the player picks one, she answers back, flags
## and karma set, the story going on or to the step it names). A step in the list, or played by an event (Play
## dialogue: talking to someone, a phone call).
@tool
@icon("res://addons/horrorstudio_director/icons/dialogue.svg")
class_name HSDialogue
extends Node

@export var id: String = ""
@export var title: String = ""
## the level it plays in; empty: where the player is (the step before's)
@export var level: NodePath
## whom the view's attention holds on (a character)
@export var look_at: String = ""
## the step after it (empty: the next in the list)
@export var next: NodePath


func _enter_tree() -> void:
	HSDirector.auto_id(self)
	if title == "":
		title = str(name)


func _validate_property(p: Dictionary) -> void:
	if p["name"] == "look_at":
		HSDirector.hint(p, "actor")


func lines() -> Array:
	var out: Array = []
	for c in get_children():
		if c is HSLine:
			out.append(c)
	return out
