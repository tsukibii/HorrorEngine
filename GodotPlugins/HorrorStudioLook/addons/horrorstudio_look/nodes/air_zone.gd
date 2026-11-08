## A room's own air (docs/GODOT_LOOK.md §5j): a box where the air is different, a dusty stairwell, a damp cellar, a
## foggy yard. While the eye is inside it, the scene's HSAtmosphere eases its fog level, dust and mist to these over
## `seconds`; outside, back to the level's. The smallest box holding the eye wins. A value under 0 keeps the level's.
## The box is drawn in the editor only.
@tool
@icon("res://addons/horrorstudio_look/icons/air_zone.svg")
class_name HSAirZone
extends Node3D

@export var size := Vector3(4, 3, 4):
	set(v):
		size = v
		_outline()
@export_range(-0.01, 1.0, 0.01) var fog: float = 0.4         ## the fog level in here (under 0: the level's)
@export_range(-0.01, 1.0, 0.01) var dust: float = 0.6        ## the dust in here (under 0: the level's)
@export_range(-0.01, 1.0, 0.01) var mist: float = -0.01      ## the ground mist in here (under 0: the level's)
@export_range(0.1, 10.0, 0.1, "suffix:s") var seconds: float = 1.5   ## how long the air takes to change, walking in or out

var outline: MeshInstance3D = null


func _ready() -> void:
	add_to_group("hs_air_zone")
	_outline()


## is a point (world) inside the box?
func contains(p: Vector3) -> bool:
	var lp := global_transform.affine_inverse() * p
	return absf(lp.x) <= size.x * 0.5 and absf(lp.y) <= size.y * 0.5 and absf(lp.z) <= size.z * 0.5


func _outline() -> void:
	if not is_inside_tree() or not Engine.is_editor_hint():
		return
	if outline == null:
		outline = MeshInstance3D.new()
		outline.name = "Outline"
		add_child(outline)                                    # no owner: never saved
	var im := ImmediateMesh.new()
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(0.6, 0.85, 1.0)
	var h := size * 0.5
	var c := [Vector3(-h.x, -h.y, -h.z), Vector3(h.x, -h.y, -h.z), Vector3(h.x, -h.y, h.z), Vector3(-h.x, -h.y, h.z)]
	im.surface_begin(Mesh.PRIMITIVE_LINES, m)
	for i in 4:
		var a: Vector3 = c[i]
		var b: Vector3 = c[(i + 1) % 4]
		for y in [0.0, size.y]:
			im.surface_add_vertex(a + Vector3(0, y, 0))
			im.surface_add_vertex(b + Vector3(0, y, 0))
		im.surface_add_vertex(a)
		im.surface_add_vertex(a + Vector3(0, size.y, 0))
	im.surface_end()
	outline.mesh = im
