@tool
## A bend: a point a Walk marker's path goes through, in order (docs/MARKERS.md §4, Curves). A child of the Walk
## marker; nothing but where it is. It's a place in the world (`top_level`): turning the marker's arrow or moving its
## pin leaves its bends where they are.
class_name HSNpcBend
extends Node3D


func _init() -> void:
	top_level = true


func _get_configuration_warnings() -> PackedStringArray:
	var p := get_parent()
	if not (p is HSNpcMarker) or (p as HSNpcMarker).kind != "walk":
		return PackedStringArray(["A bend belongs under a Walk marker: it's a point her path goes through."])
	return PackedStringArray()
