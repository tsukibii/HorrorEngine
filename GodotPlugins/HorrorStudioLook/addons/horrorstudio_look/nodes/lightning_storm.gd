## Lightning (HSLightning; docs/GODOT_LOOK.md §5k): the storm outside, flashing through the windows within the flash
## limits (one flash a strike, at least a second of dark between), its thunder `km` kilometres off arriving 3 s a
## kilometre later. Turn the node so its forward (-Z) points the way the light falls (down through the windows). A
## strike every `every` seconds, jittered (0: only when `fire()` is called). `figure`: someone there only while the
## flash lights them (hidden otherwise), in the first `figure_times` strikes (0: every one). `reduce` for your
## players' Reduce flashes setting. No strikes in the editor unless `preview_every` asks for them: a flashing viewport
## is as hard on the eyes as a flashing game.
@tool
@icon("res://addons/horrorstudio_look/icons/lightning.svg")
class_name HSLightningStorm
extends Node3D

@export_range(0.0, 600.0) var every: float = 45.0
@export_range(0.0, 20.0) var strength: float = 4.0
@export_range(0, 2) var restrikes: int = 2        ## re-brightenings on the glow (none counts as a flash of its own)
@export_range(0.0, 10.0) var km: float = 1.5      ## how far off: the thunder 3 s a kilometre after the flash
@export_range(0.0, 1.0) var reduce: float = 1.0   ## the players' setting: 1 full, 0 no flash (the thunder stays)
@export var color := Color(0.78, 0.84, 1.0)
@export var thunder: AudioStream
@export var thunder_db := 0.0
@export var bus := "Master"
@export var figure: Node3D                        ## shown only while the flash lights them
@export var figure_times: int = 0                 ## in this many strikes (0: every one)
@export var seed: int = 1
@export_range(0.0, 120.0) var preview_every: float = 0.0
var storm: HSLightning = null
var _key := 0


func _ready() -> void:
	_rebuild()


func _settings() -> Dictionary:
	return {"every": every, "strength": strength, "restrikes": restrikes, "km": km, "reduce": reduce, "color": color,
		"thunder_db": thunder_db, "bus": bus, "seed": seed, "pe": preview_every, "figure": figure, "figure_times": figure_times, "thunder": thunder}


func _rebuild() -> void:
	_key = _settings().hash()
	if storm != null:
		storm.free()
	var s := _settings()
	if Engine.is_editor_hint():
		s["every"] = preview_every
		s.erase("figure")                              # the editor never hides what you're placing
	if s.get("thunder") == null:
		s.erase("thunder")
	storm = HSLightning.make(s)
	add_child(storm)                                   # no owner: never saved
	if figure != null and not Engine.is_editor_hint():
		figure.visible = false


## a strike now (or as soon as the dark between allows)
func fire(_a = null, _b = null) -> void:
	if storm != null:
		storm.fire()


func striking() -> bool:
	return storm != null and storm.striking()


func _process(_dt: float) -> void:
	if _settings().hash() != _key:
		_rebuild()
