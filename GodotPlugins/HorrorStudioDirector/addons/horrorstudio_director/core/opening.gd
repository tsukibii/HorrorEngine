## A hole in a room's wall with no door in it (docs/GODOT_DIRECTOR.md §3): a doorway, an arch, a window (a sill
## above the floor). A door placed on a wall cuts its own; this is for the rest.
@tool
class_name HSOpening
extends Resource

@export_enum("north", "south", "east", "west") var side: String = "north":
	set(v):
		side = v
		emit_changed()
## metres from the wall's middle along it (east of it for a north or south wall, south of it for east or west)
@export var offset: float = 0.0:
	set(v):
		offset = v
		emit_changed()
@export_range(0.2, 10.0) var width: float = 0.9:
	set(v):
		width = v
		emit_changed()
@export_range(0.2, 6.0) var height: float = 2.05:
	set(v):
		height = v
		emit_changed()
## a window's sill above the floor (0: a doorway)
@export_range(0.0, 3.0) var sill: float = 0.0:
	set(v):
		sill = v
		emit_changed()
