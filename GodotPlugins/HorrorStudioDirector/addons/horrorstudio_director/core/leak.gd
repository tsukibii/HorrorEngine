## Water running down one of a room's walls (docs/GODOT_DIRECTOR.md §3; the story's `use: leak`, GODOT_LOOK §2b): where
## it comes in, along the wall as an opening is, how high, its width at the top, the seconds between drops and how
## wet. At play the room puts a marker on the wall's inside face and the runtime wets a band of that wall below it
## (dark, glossy, in rivulets, no pools) and drops the drips; in the editor the room shows the band on its walls.
@tool
class_name HSRoomLeak
extends Resource

## its id (empty: the room's id, __leak_ and its place in the list)
@export var id: String = "":
	set(v):
		id = v
		emit_changed()
@export_enum("north", "south", "east", "west") var side: String = "north":
	set(v):
		side = v
		emit_changed()
## metres from the wall's middle along it (east of it for a north or south wall, south of it for east or west)
@export var offset: float = 0.0:
	set(v):
		offset = v
		emit_changed()
## where it comes in, metres above the floor
@export_range(0.1, 6.0) var height: float = 2.4:
	set(v):
		height = v
		emit_changed()
## metres wide at the top (it spreads as it runs down)
@export_range(0.05, 3.0) var width: float = 0.4:
	set(v):
		width = v
		emit_changed()
## seconds between drops (0: none)
@export_range(0.0, 20.0) var drip: float = 2.6:
	set(v):
		drip = v
		emit_changed()
@export_range(0.0, 1.0) var wet: float = 0.8:
	set(v):
		wet = v
		emit_changed()
