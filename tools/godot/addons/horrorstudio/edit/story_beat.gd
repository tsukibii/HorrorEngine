## One beat of a task, as a node under its StoryStitch (docs/GODOT_EXPORT.md §3): when it fires (`when`, a trigger as
## the story writes it: {"enter": "kitchen"}, {"use": "door"}, {"flag": "x"}, {"all": [...]}...), what it does (`do`,
## the actions in order: [{"say": "mari_001"}, {"wait": 0.8}, {"flag": "met"}]), `optional` (the story check doesn't
## expect it on every path), `only_if` (flags that must hold), and `extra` for any other word the beat carries
## (`once`, `after`...). The same words the desk's palette writes (STORY_FORMAT §4), edited here as data.
@tool
class_name StoryBeat
extends Node

@export var id: String = ""
@export var when: Dictionary = {}
@export var do: Array = []
@export var optional: bool = false
@export var only_if: Array = []
@export var extra: Dictionary = {}


func to_beat() -> Dictionary:
	var b: Dictionary = extra.duplicate(true)
	b["id"] = id if id != "" else str(name)
	b["when"] = when.duplicate(true)
	b["do"] = do.duplicate(true)
	if optional:
		b["optional"] = true
	if not only_if.is_empty():
		b["if"] = only_if.duplicate()
	return b
