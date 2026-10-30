## A to-do (docs/GODOT_DIRECTOR.md §2): a line on the task's list under the objective, ticked by what the player does
## (`done_when`: picks up the key, enters the cellar, locks the door...) or by an event's Tick action; failed by
## `fail_when` or its time running out. A hidden one counts without showing (a task the player only knows from
## their thoughts). A task set to finish on its to-dos ends when the last is ticked.
@tool
@icon("res://addons/horrorstudio_director/icons/todo.svg")
class_name HSTodo
extends Node

@export var id: String = ""
@export var text: String = ""
@export var done_when: HSWhen
@export var fail_when: HSWhen
## seconds to do it in (0: no limit)
@export var time_limit: float = 0.0
@export var hidden: bool = false
## a character who asked for it (her request: once it's done she walks off)
@export var asked_by: String = ""


func _enter_tree() -> void:
	HSDirector.auto_id(self)
	if text == "":
		text = str(name)


func _validate_property(p: Dictionary) -> void:
	if p["name"] == "asked_by":
		HSDirector.hint(p, "actor")


## the to-do as the story's `todo` action
func to_story() -> Dictionary:
	var a := {"todo": HSDirector.id_of(self), "text": text}
	if done_when != null:
		a["ticks"] = done_when.to_story()
	if fail_when != null:
		a["fails"] = fail_when.to_story()
	if time_limit > 0.0:
		a["secs"] = time_limit
	if hidden:
		a["hidden"] = true
	if asked_by != "":
		a["who"] = asked_by
	return a
