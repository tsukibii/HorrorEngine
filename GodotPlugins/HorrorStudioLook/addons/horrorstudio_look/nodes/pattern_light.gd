## A spot light throwing a moving pattern (HSPattern, Light Kit's light functions; docs/GODOT_LOOK.md §0): caustics
## (water's light), leaves, blinds (bars, `open` how far, `angle`), clouds (their shadows passing). Aim it at what it
## lights; `aim_distance` how far that is, so a feature is `feature_m` metres where it lands (0: the pattern's own).
## The pattern is drawn when the scene starts (a few dozen frames of a loop) and never saved. Its shadows stay on:
## Godot projects only through a shadowed spot.
@tool
@icon("res://addons/horrorstudio_look/icons/pattern.svg")
class_name HSPatternLight
extends SpotLight3D

@export_enum("caustics", "leaves", "blinds", "clouds") var pattern: String = "caustics"
@export_range(0.0, 20.0) var feature_m: float = 0.0
@export_range(-1.0, 4.0) var speed: float = -1.0     ## -1: the pattern's own
@export_range(0.0, 1.0) var open: float = 0.5
@export_range(-90.0, 90.0) var angle: float = 0.0
@export_range(0.1, 30.0) var aim_distance: float = 3.0
@export_enum("64:64", "128:128", "256:256") var size_px: int = 128
@export_range(1, 120) var frames: int = 40
@export_range(0.5, 30.0) var period: float = 5.0
var hp: HSPattern = null
var _key := 0


func _ready() -> void:
	_rebuild()


func _settings() -> Dictionary:
	return {"pattern": pattern, "f": feature_m, "sp": speed, "open": open, "angle": angle, "aim": aim_distance, "size": size_px, "frames": frames, "period": period, "spot": spot_angle}


func _rebuild() -> void:
	_key = _settings().hash()
	var s := {"pattern": pattern, "open": open, "angle": angle, "size": size_px, "frames": frames, "period": period}
	if feature_m > 0.0:
		s["scale"] = feature_m
	if speed >= 0.0:
		s["speed"] = speed
	hp = HSPattern.attach(self, s, aim_distance)


func _process(_dt: float) -> void:
	if _settings().hash() != _key:
		_rebuild()


func _notification(what: int) -> void:
	if what == NOTIFICATION_EDITOR_PRE_SAVE:
		light_projector = null                         # the frames are made, never saved
	elif what == NOTIFICATION_EDITOR_POST_SAVE and hp != null:
		hp.shown = -1
