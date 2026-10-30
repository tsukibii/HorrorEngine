## Blood (HSBlood; docs/GODOT_LOOK.md §0): a splat from a seed on the surface the node's green arrow (+Y) points
## out of: a ragged pool, flung drops, drips when it's on a wall (turn the node so +Y points out of the wall).
## `dry` from glossy wet to dull brown, `opacity` as it's scrubbed away.
@tool
@icon("res://addons/horrorstudio_look/icons/blood.svg")
class_name HSBloodSplat
extends Node3D

@export_range(0.05, 4.0) var size: float = 0.6
@export var seed: float = 1.0
@export_range(0.0, 1.0) var dry: float = 0.0
@export_range(0.0, 1.0) var opacity: float = 1.0
@export_range(0.0, 1.0) var pool: float = 0.55
@export_range(0.0, 1.0) var ragged: float = 0.35
@export_range(0.0, 1.0) var drops: float = 0.6
@export_range(-1.0, 1.0) var drips: float = -1.0     ## -1: by the surface (0.5 on a wall, none on a floor)
var splat: MeshInstance3D = null
var _key := 0


func _ready() -> void:
	set_notify_transform(true)
	_rebuild()


func _settings() -> Dictionary:
	return {"size": size, "seed": seed, "dry": dry, "opacity": opacity, "pool": pool, "ragged": ragged, "drops": drops, "drips": drips}


func _rebuild() -> void:
	_key = _settings().hash()
	if splat != null:
		splat.free()
	var s := {"dry": dry, "opacity": opacity, "pool": pool, "ragged": ragged, "drops": drops}
	if drips >= 0.0:
		s["drips"] = drips
	splat = HSBlood.splat(self, global_position, global_basis.y, size, seed, s)


func _notification(what: int) -> void:
	if what == NOTIFICATION_TRANSFORM_CHANGED and is_node_ready():
		_rebuild()                                   # the drips run down the world, so a turn redraws it


func _process(_dt: float) -> void:
	if _settings().hash() != _key:
		_rebuild()
