@tool
## One way of a Choice (docs/MARKERS.md §6.5): the markers under it run when its flags are so. The ways are looked at
## top to bottom, the first that's so is taken; one with no flags is "otherwise" and belongs last.
class_name HSNpcWay
extends Node3D

@export var when := ""                     ## the condition's words (cond.gd); empty: otherwise
@export var note := ""                     ## what it's for, shown on the storyboard


func _get_configuration_warnings() -> PackedStringArray:
	var p := get_parent()
	if not (p is HSNpcMarker) or (p as HSNpcMarker).kind != "choice":
		return PackedStringArray(["A way belongs under a Choice marker."])
	return PackedStringArray()


## what the storyboard calls it
func title() -> String:
	if note != "":
		return note
	return ("if " + HSNpcCond.says(when)) if when.strip_edges() != "" else "otherwise"
