## A headlight sweep (HSSweep; docs/GODOT_LOOK.md §0): a car passing outside a window at night, its beam sliding
## across the room. Put the node at the window's middle with its forward (-Z) into the room: the street runs along
## its X, `out` metres outside. A pass every `every` seconds (0: only when `fire()` is called), `secs` long.
## In the editor a pass comes every `preview_every` seconds so you can see it (0: none).
@tool
@icon("res://addons/horrorstudio_look/icons/sweep.svg")
class_name HSHeadlightSweep
extends Node3D

@export_range(0.0, 600.0) var every: float = 40.0
@export_range(0.5, 20.0) var secs: float = 3.0
@export_range(1.0, 30.0) var out: float = 6.0
@export_range(1.0, 40.0) var span: float = 10.0
@export_range(0.0, 60.0) var energy: float = 10.0
@export_range(0.0, 10.0) var aim: float = 1.5
@export var seed: int = 1
@export var color := Color(0.95, 0.92, 0.8)
@export_range(0.0, 60.0) var preview_every: float = 6.0
var sweep: HSSweep = null
var _key := 0


func _ready() -> void:
	set_notify_transform(true)
	_rebuild()


func _settings() -> Dictionary:
	return {"every": every, "secs": secs, "out": out, "span": span, "energy": energy, "aim": aim, "seed": seed, "color": color, "pe": preview_every}


func _rebuild() -> void:
	_key = _settings().hash()
	if sweep != null:
		sweep.free()
	var s := _settings()
	if Engine.is_editor_hint():
		s["every"] = preview_every
	sweep = HSSweep.make(global_position, global_basis.z, global_basis.x, s)
	sweep.lamp.light_color = color
	add_child(sweep)                                  # no owner: never saved


## a car now
func fire() -> void:
	if sweep != null:
		sweep.fire()


func passing() -> bool:
	return sweep != null and sweep.passing()


func _notification(what: int) -> void:
	if what == NOTIFICATION_TRANSFORM_CHANGED and sweep != null:
		sweep.window_at = global_position
		sweep.outward = global_basis.z.normalized()
		sweep.along = global_basis.x.normalized()


func _process(_dt: float) -> void:
	if _settings().hash() != _key:
		_rebuild()
