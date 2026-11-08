## Breath in the cold (HSBreath; docs/GODOT_LOOK.md §5l): someone's breath showing. Put it where the breath comes out,
## its -Z the way it goes: under the player's Eye at (0, -0.1, -0.15), under a character's head at the mouth. `on`
## breathing or not (the starter's cold area turns the player's on and off, or a script of yours); `every` seconds
## between breaths; `strength` how white. The puffs show only where a light reaches them. Nothing in the editor unless
## `preview`.
@tool
@icon("res://addons/horrorstudio_look/icons/breath.svg")
class_name HSBreathPuffs
extends Node3D

@export var on := true
@export_range(0.5, 12.0) var every: float = 4.0
@export_range(0.0, 1.0) var strength: float = 0.6
@export var preview := false
var breath: HSBreath = null
var _key := 0


func _ready() -> void:
	_rebuild()


func _settings() -> Dictionary:
	return {"on": on, "every": every, "strength": strength, "preview": preview}


func _rebuild() -> void:
	_key = _settings().hash()
	if breath == null:
		breath = HSBreath.make(self, {"offset": Vector3.ZERO})
		add_child(breath)                              # no owner: never saved
	breath.settings({"on": on, "every": every, "strength": strength, "offset": Vector3.ZERO})
	breath.set_meta("preview", preview)


## a breath out now
func exhale() -> void:
	if breath != null:
		breath.exhale()


func _process(_dt: float) -> void:
	if _settings().hash() != _key:
		_rebuild()
