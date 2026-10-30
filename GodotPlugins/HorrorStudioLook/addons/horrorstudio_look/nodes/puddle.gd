## A puddle (HSWet.puddle, Light Kit's Puddle; docs/GODOT_LOOK.md §0): a decal projected down onto whatever is
## under it, an irregular pool from its seed, mirror-smooth in the middle, damp at the edge. Turn the node to turn the
## pool; `size` metres across, `depth` how far down it reaches. Needs SSR on (the look preset) to reflect the room.
@tool
@icon("res://addons/horrorstudio_look/icons/puddle.svg")
class_name HSPuddle
extends Node3D

@export_range(0.1, 6.0) var size: float = 0.9
@export var seed: int = 1
@export_range(0.05, 2.0) var depth: float = 0.3
var decal: Decal = null
var _key := 0


func _ready() -> void:
	_rebuild()


func _settings() -> Dictionary:
	return {"size": size, "seed": seed, "depth": depth}


func _rebuild() -> void:
	_key = _settings().hash()
	if decal != null:
		decal.free()
	decal = HSWet.puddle(self, global_position, size, seed, depth)
	decal.position = Vector3.ZERO                   # held at the node: it moves and turns with it
	decal.rotation = Vector3.ZERO


func _process(_dt: float) -> void:
	if _settings().hash() != _key:
		_rebuild()
