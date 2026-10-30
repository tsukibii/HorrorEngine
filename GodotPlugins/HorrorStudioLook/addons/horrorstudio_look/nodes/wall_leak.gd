## Water running down a wall (HSLeak; docs/GODOT_LOOK.md §0): a band of the wall wet below where it comes in, darker
## and glossy in rivulets, spreading as it goes down, and drips falling to the floor with a ring where each lands.
## Put the node on the wall's face where the water comes in, its forward (-Z) into the room and its X along the wall,
## under the wall's mesh (or set Target). `length` metres down to the floor.
@tool
@icon("res://addons/horrorstudio_look/icons/leak.svg")
class_name HSWallLeak
extends HSOnMesh

@export_range(0.05, 3.0) var width: float = 0.4
@export_range(0.1, 6.0) var length: float = 2.6
@export_range(0.0, 1.0) var wet: float = 0.8
@export_range(0.0, 20.0) var drip: float = 2.6     ## seconds between drops (0: none)
var leak: HSLeak = null


func _settings() -> Dictionary:
	return {"width": width, "length": length, "wet": wet, "drip": drip}


func _extra_key():
	return global_transform


func _apply(ms: Array) -> void:
	var p := global_position
	leak = HSLeak.make(ms, {"centre": p, "axis": global_basis.x.normalized(), "inward": -global_basis.z.normalized(), "width": width,
		"top": p.y, "bottom": p.y - length, "drip": drip, "wet": wet})
	add_child(leak)                                    # no owner: never saved


func _unapply() -> void:
	if leak != null and is_instance_valid(leak):
		leak.queue_free()
	leak = null
