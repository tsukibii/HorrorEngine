## A window pane (HSGlass; docs/GODOT_LOOK.md §0): glass on a flat mesh in a window's opening (a quad or a thin box),
## bending the room behind it a little, with rain running down it (`rain` 0 dry, 1 a downpour) and a mist. Drop it
## under the pane's mesh. `size_m` the glass in metres for the drops' real size (zero: the mesh's own).
@tool
@icon("res://addons/horrorstudio_look/icons/pane.svg")
class_name HSWindowPane
extends HSOnMesh

@export var size_m := Vector2.ZERO
@export var seed: float = 1.0
@export_range(0.0, 1.0) var rain: float = 0.6
@export_range(0.0, 1.0) var clarity: float = 0.96
@export var tint := Color(0.94, 0.96, 0.98)
@export_range(0.5, 6.0) var drop_cm: float = 2.2
@export_range(0.0, 4.0) var speed: float = 1.0
@export_range(0.0, 0.1) var bend: float = 0.02


func _settings() -> Dictionary:
	return {"rain": rain, "clarity": clarity, "tint": tint, "drop_cm": drop_cm, "speed": speed, "bend": bend, "seed": seed, "size": size_m}


func _apply(ms: Array) -> void:
	for mi in ms:
		var sz := size_m
		if sz == Vector2.ZERO and mi.mesh != null:
			var e: Vector3 = mi.mesh.get_aabb().size * mi.global_basis.get_scale()
			var d: Array = [e.x, e.y, e.z]
			d.sort()
			sz = Vector2(d[2], d[1])                  # the glass's two long sides
		HSGlass.pane(mi, sz, seed, {"rain": rain, "clarity": clarity, "tint": tint, "drop_cm": drop_cm, "speed": speed, "bend": bend})
