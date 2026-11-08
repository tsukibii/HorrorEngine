@tool
@icon("res://addons/horrorstudio_ui/icons/hsquestmarker.svg")
class_name HSQuestMarker
extends Node3D
## A quest marker for anything in your scene (HorrorStudio UI): add this node as a child of a door, a person, an item, a
## trigger, and while it is `active` an HSHud hangs the studio's guide marker over it: a diamond that is faint far off and
## through walls, clearer the nearer you get, with `label` over it once you are close, and a small pointer at the screen's
## edge when it is out of view. Switch `active` off when the task is done (or free the node). The HSHud does the drawing;
## this is only where it points.

const GROUP := "hs_quest_marker"

## the marker shows while this is on
@export var active := true
## what it's called over the marker once you're near (a person's name, an item's: empty, nothing)
@export var label := ""
## metres from this node's origin up to the top of the thing it marks (the diamond hangs a little over that)
@export_range(0.0, 4.0, 0.05, "or_greater") var height := 1.0
## what stops the line of sight from the eye to it (a wall between makes it fainter): physics layers of the building
@export_flags_3d_physics var sight_mask := 1


func _enter_tree() -> void:
	add_to_group(GROUP)


## the world point at the top of what it marks
func top() -> Vector3:
	return global_position + Vector3(0.0, height, 0.0)
