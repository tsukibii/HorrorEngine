## An option (docs/GODOT_DIRECTOR.md §2). Under a dialogue's line: an answer the player can pick (`label`, a thought
## with it), what she says back (`reply_lines`), the flags and karma it sets, and `go_to` a step to branch the
## story there (empty: the dialogue goes on). Under a choice: a way the story can go (`go_to`), taken when its flags
## hold (`if_flags`; the last one with none is the otherwise), when its `when` happens first (a choice by what the
## player does), or by karma (`karma_min`, `karma_max`).
@tool
@icon("res://addons/horrorstudio_director/icons/option.svg")
class_name HSOption
extends Node

@export var label: String = ""
@export var think: String = ""
@export var reply_lines: PackedStringArray = PackedStringArray()
@export var set_flags: PackedStringArray = PackedStringArray()
@export var karma: float = 0.0
@export var go_to: NodePath
@export var if_flags: PackedStringArray = PackedStringArray()
@export var when: HSWhen
@export var karma_min: float = -INF
@export var karma_max: float = INF


func _enter_tree() -> void:
	if label == "":
		label = str(name)


func option_id() -> String:
	return HSDirector.snake(label if label != "" else str(name))
