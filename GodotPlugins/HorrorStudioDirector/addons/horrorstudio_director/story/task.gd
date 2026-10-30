## A task (docs/GODOT_DIRECTOR.md §2): what the player does between the scenes, the quest log's entry: its objective
## (the line at the top left), its to-do list (HSTodo children: ticked in any order, by what the player does), the
## events that listen while it's on (HSEvent children), where the player starts it (or carries on from where they
## are) and when it's done: every to-do ticked, an event's Finish task, or never (a free roam). Then the next step in
## the list, or the one `next` names; a `time_limit` runs out into `on_timeout` (a death, a chase).
@tool
@icon("res://addons/horrorstudio_director/icons/task.svg")
class_name HSTask
extends Node

@export var id: String = ""
@export var title: String = ""
@export var objective: String = ""
## the level it plays in (an HSLevel); empty: the chapter's, else the one before, else the first
@export var level: NodePath
## where the player is put when it starts (an HSSpot); empty: they carry on from where they are
@export var start_at: NodePath
@export_enum("todos", "event", "never") var finish: String = "todos"
## seconds; 0: no limit
@export var time_limit: float = 0.0
@export var on_timeout: NodePath
## the step after it (empty: the next in the list)
@export var next: NodePath
@export var checkpoint: bool = true


func _enter_tree() -> void:
	HSDirector.auto_id(self)
	if title == "":
		title = str(name)


func todos() -> Array:
	var out: Array = []
	for c in get_children():
		if c is HSTodo:
			out.append(c)
	return out
