## A spot on the floor (docs/GODOT_DIRECTOR.md §3): where the player starts (a level's `start`, a task's start), where
## a character stands or is sent, a point a path goes by. It faces its +Z (the arrow), as a character placed here
## would.
@tool
@icon("res://addons/horrorstudio_director/icons/spot.svg")
class_name HSSpot
extends Marker3D

@export var id: String = ""
## a path's point: the seconds she waits here
@export var wait: float = 0.0

var _gen: Node3D = null


func _enter_tree() -> void:
	HSDirector.auto_id(self)


func _ready() -> void:
	if Engine.is_editor_hint():
		_draw()
	elif not HSDirector.holding:
		HSDirector.stamp(self, {"id": HSDirector.id_of(self), "kind": "spot", "shape": "box", "size": [0.3, 0.3, 0.0], "room": "",
			"yaw": HSDirector.story_yaw(self), "pos": HSDirector.story_pos(global_position), "tags": ["use:spot"], "d": {}})


func _draw() -> void:
	var old := get_node_or_null("_gen")
	if old != null:
		old.free()
	_gen = Node3D.new()
	_gen.name = "_gen"
	add_child(_gen)
	var m := HSDirector.glow(Color(0.95, 0.3, 0.3, 0.85))
	var disc := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.18
	cm.bottom_radius = 0.18
	cm.height = 0.01
	disc.mesh = cm
	disc.material_override = m
	disc.position = Vector3(0, 0.005, 0)
	_gen.add_child(disc)
	var arrow := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.05, 0.012, 0.32)
	arrow.mesh = bm
	arrow.material_override = m
	arrow.position = Vector3(0, 0.012, 0.2)
	_gen.add_child(arrow)
