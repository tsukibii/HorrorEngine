## A chapter (docs/GODOT_DIRECTOR.md §2): a group of steps in play order (tasks, dialogue, choices, endings) with a
## title card when it starts (the view dark, the title held up, an autosave), the time of day from here on, and the
## level its tasks play in unless they say. An event inside it (not in one of its tasks) listens through all of them.
@tool
@icon("res://addons/horrorstudio_director/icons/chapter.svg")
class_name HSChapter
extends Node

@export var id: String = ""
@export var title: String = ""
@export var subtitle: String = ""
@export var show_card: bool = true
@export_enum("keep", "day", "dusk", "night") var time_of_day: String = "keep"
## the level its tasks play in (an HSLevel), unless a task names its own
@export var level: NodePath


## the time of day it sets, or "" (it keeps the one before)
func time() -> String:
	return "" if time_of_day == "keep" else time_of_day


func _enter_tree() -> void:
	if id == "":
		id = HSDirector.snake(str(name))
	if title == "":
		title = str(name)
