## Rain in a box (HSRain, docs/GODOT_LOOK.md §0): drop it where it should rain, size the box, and it rains in the
## editor's viewport as in the game. Streaks lit by every light that reaches them, splashes where they land on the
## box's floor. `follow_camera` keeps the box over the player in the game (the drops keep their places in the world).
## The streaks and splashes are made by the node and never saved in your scene.
@tool
@icon("res://addons/horrorstudio_look/icons/rain.svg")
class_name HSRainBox
extends Node3D

@export var size := Vector3(8, 4, 8)
@export_range(50, 4000) var count: int = 600
@export_range(0.0, 1.0) var strength: float = 0.45
@export_range(-2.0, 2.0) var wind: float = 0.25
@export var splashes := true
@export var follow_camera := false
var rain: HSRain = null
var _key := 0


func _ready() -> void:
	_rebuild()


func _settings() -> Dictionary:
	return {"size": size, "count": count, "strength": strength, "wind": wind, "splashes": splashes}


func _rebuild() -> void:
	_key = _settings().hash()
	if rain != null:
		rain.free()
	rain = HSRain.make(size, count, strength)
	rain.wind = wind
	rain.splashes = splashes
	add_child(rain)                                  # no owner: made again on load, never saved
	if follow_camera and not Engine.is_editor_hint():
		rain.top_level = true
		rain.follow = get_viewport().get_camera_3d()
		rain.set_follow(true)


func _process(_dt: float) -> void:
	if _settings().hash() != _key:
		_rebuild()
	if rain != null and rain.follow == null and follow_camera and not Engine.is_editor_hint():
		rain.follow = get_viewport().get_camera_3d()
