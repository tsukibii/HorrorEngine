## A task (a stitch) as a scene the user can edit in Godot (docs/GODOT_EXPORT.md §3, the editable layer): the export
## writes one per flow node of type stitch into game/acts/<nn>_<node>/stitch.tscn, numbered in play order; its beats
## are StoryBeat children in order (dragged to reorder, duplicated, deleted), each beat's `when` and `do` as
## Dictionaries and Arrays in the Inspector, read back by the runtime when the task plays (story.gd edited_stitch), so
## an edit here plays without the desk. The stitch's other fields (title, objective, timer, done...) sit in `fields`.
## A re-export keeps a stitch.tscn the user has changed and writes the new one beside it (§5).
@tool
class_name StoryStitch
extends Node

@export var node_id: String = ""           # the flow node (n_x)
@export var ref: String = ""               # the stitch's id in the story
@export var fields: Dictionary = {}        # the stitch's words besides its beats (title, objective, timer, done, play...)


## the stitch as story.json has it, from this scene's state: its fields and its beats in the tree's order
func to_stitch() -> Dictionary:
	var st: Dictionary = fields.duplicate(true)
	var beats: Array = []
	for c in get_children():
		if c is StoryBeat:
			beats.append(c.to_beat())
	st["beats"] = beats
	return st
