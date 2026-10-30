## An ending (docs/GODOT_DIRECTOR.md §2): where a way through the story stops, its card's title and words; a death
## (`kind` death) offers the retry from the last checkpoint.
@tool
@icon("res://addons/horrorstudio_director/icons/ending.svg")
class_name HSEnding
extends Node

@export var id: String = ""
@export var title: String = ""
@export_enum("good", "bad", "neutral", "secret", "death") var kind: String = "good"
@export_multiline var text: String = ""


func _enter_tree() -> void:
	HSDirector.auto_id(self)
	if title == "":
		title = str(name)
