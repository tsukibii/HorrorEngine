## A scene as a Godot scene to scrub (docs/GODOT_EXPORT.md §3, the editable layer): the export writes one per flow node
## of type scene into game/acts/<nn>_<node>/scene.tscn when the desk's recording exists: a Camera3D the Animation
## `scene` drives along the bake (position, rotation and fov keys, thinned), and the lines and the cues as keys of a
## method track calling `line` and `cue` here, so the sequence shows on Godot's timeline and the camera can be scrubbed
## in the editor (open the level beside it). What plays in the game is still the recording (bakeplay.gd); edits here
## don't play back yet.
@tool
class_name StoryScene
extends Node3D

@export var node_id: String = ""
@export var scene_id: String = ""
@export var total: float = 0.0             # the recording's seconds


## a line's moment on the timeline (the method track's key): who says what, in English and Japanese
func line(who: String, en: String, ja: String = "") -> void:
	pass


## a cue's moment: the story's event or light change as JSON
func cue(what: String) -> void:
	pass
