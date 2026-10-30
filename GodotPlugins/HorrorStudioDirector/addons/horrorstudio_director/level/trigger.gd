## An area the player walks into (docs/GODOT_DIRECTOR.md §3): a box on the floor, drawn in the editor only. An event
## inside it fires when the player enters it (unless the event says otherwise): put a jumpscare's event in the
## hallway's trigger. `safe`: a cast member who watches for the player doesn't see them in here.
@tool
@icon("res://addons/horrorstudio_director/icons/trigger.svg")
class_name HSTrigger
extends Node3D

@export var id: String = ""
## the box: width (x), height (y), depth (z); the node's origin at its floor in the middle
@export var size: Vector3 = Vector3(2.0, 2.5, 2.0)
@export var safe: bool = false
@export var color: Color = Color(1.0, 0.55, 0.15, 0.18)

var _gen: Node3D = null
var _key := 0


func _enter_tree() -> void:
	HSDirector.auto_id(self)


func _ready() -> void:
	if Engine.is_editor_hint():
		_rebuild()
	elif not HSDirector.holding:
		_stamp()


func _process(_dt: float) -> void:
	if Engine.is_editor_hint() and [size, color, safe].hash() != _key:
		_rebuild()


func _rebuild() -> void:
	_key = [size, color, safe].hash()
	var old := get_node_or_null("_gen")
	if old != null:
		old.free()
	_gen = Node3D.new()
	_gen.name = "_gen"
	add_child(_gen)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = Vector3(0, size.y / 2.0, 0)
	mi.material_override = HSDirector.glow(Color(0.3, 0.8, 0.4, color.a) if safe else color)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_gen.add_child(mi)


## the box in the world (axis-aligned)
func box() -> AABB:
	return global_transform * AABB(Vector3(-size.x / 2.0, 0.0, -size.z / 2.0), size)


func _stamp() -> void:
	var tid := HSDirector.id_of(self)
	var bb := box()
	HSDirector.stamp(self, {"id": tid, "kind": "trigger", "shape": "box", "size": [bb.size.x, bb.size.z, bb.size.y], "room": "",
		"yaw": 0.0, "pos": HSDirector.story_pos(bb.get_center()), "tags": [], "d": {"safe": safe}})
	set_meta("trigger", JSON.stringify({"id": tid, "safe": safe,
		"min": [bb.position.x, -(bb.position.z + bb.size.z), bb.position.y], "max": [bb.position.x + bb.size.x, -bb.position.z, bb.position.y + bb.size.y]}))
