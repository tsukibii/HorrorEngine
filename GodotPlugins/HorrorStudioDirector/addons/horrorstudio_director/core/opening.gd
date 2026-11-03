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

@export_group("A window")
## glass in it (the rain runs down the pane when it rains)
@export var glass: bool = false:
	set(v):
		glass = v
		emit_changed()
## the sky's light coming in, by the time of day: a soft spot just inside, into the room (the windows' fill, as a
## desk game's export has; a Director game is lit by hand: on only where you want it)
@export var daylight: bool = false:
	set(v):
		daylight = v
		emit_changed()
## that light's beam seen in the haze, dust drifting in it (0: none, to 1)
@export_range(0.0, 1.0) var shaft: float = 0.0:
	set(v):
		shaft = v
		emit_changed()
## how far the beam reaches into the room, metres
@export_range(0.5, 10.0) var shaft_reach: float = 3.0:
	set(v):
		shaft_reach = v
		emit_changed()
@export_range(0.0, 1.0) var shaft_dust: float = 0.5:
	set(v):
		shaft_dust = v
		emit_changed()
@export_group("A car passing", "sweep_")
## headlights sliding along the street outside now and then, aimed in through the glass (an event's `sweep` fires one too)
@export var sweep_on: bool = false:
	set(v):
		sweep_on = v
		emit_changed()
## seconds between cars (0: only when an event fires one)
@export var sweep_every: float = 40.0:
	set(v):
		sweep_every = v
		emit_changed()
## how long one takes to pass
@export var sweep_secs: float = 3.0:
	set(v):
		sweep_secs = v
		emit_changed()
## metres out to the street (keep it inside a yard the window gives onto)
@export var sweep_out: float = 6.0:
	set(v):
		sweep_out = v
		emit_changed()
## metres of street it lights along the way
@export var sweep_span: float = 10.0:
	set(v):
		sweep_span = v
		emit_changed()
@export var sweep_energy: float = 10.0:
	set(v):
		sweep_energy = v
		emit_changed()
## how high up the ceiling the headlights aim, metres
@export var sweep_aim: float = 1.5:
	set(v):
		sweep_aim = v
		emit_changed()


## its window words as a list (the room's settings hash)
func window_key() -> Array:
	return [glass, daylight, shaft, shaft_reach, shaft_dust, sweep_on, sweep_every, sweep_secs, sweep_out, sweep_span, sweep_energy, sweep_aim]
