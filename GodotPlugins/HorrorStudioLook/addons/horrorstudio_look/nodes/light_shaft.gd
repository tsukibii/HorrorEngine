## A light shaft (HSShaft; docs/GODOT_LOOK.md §0): a window's beam with dust drifting in it, as a soft card (no fog,
## no floor rectangle). Put the node at the glass's middle; the beam runs along its forward (-Z), so turn it the way
## the light comes in (tilted down for the sun). `width`, `height` the glass, `reach` how far the beam goes.
## Pair it with a light shining the same way (the window_sun preset has both).
@tool
@icon("res://addons/horrorstudio_look/icons/shaft.svg")
class_name HSLightShaft
extends Node3D

@export_range(0.1, 6.0) var width: float = 1.2
@export_range(0.1, 6.0) var height: float = 1.1
@export_range(0.2, 12.0) var reach: float = 3.0
@export_range(0.0, 3.0) var strength: float = 1.0
@export_range(0.0, 1.0) var dust: float = 0.5
@export_range(0.0, 1.0) var drift: float = 0.12
@export var color := Color(1.0, 0.93, 0.8)
var beam: FogVolume = null
var _key := 0


func _ready() -> void:
	_rebuild()


func _settings() -> Dictionary:
	return {"w": width, "h": height, "r": reach, "s": strength, "d": dust, "dr": drift, "c": color}


func _rebuild() -> void:
	_key = _settings().hash()
	if beam == null:
		beam = FogVolume.new()
		beam.name = "Beam"
		add_child(beam)                               # no owner: never saved
	beam.size = Vector3(width * 1.15, height * 1.15, reach)
	beam.position = Vector3(0, 0, -reach * 0.5)
	HSShaft.wear(beam, {"strength": strength, "dust": dust, "drift": drift, "color": color})


func _process(_dt: float) -> void:
	if _settings().hash() != _key:
		_rebuild()
