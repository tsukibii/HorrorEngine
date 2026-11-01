## Where the player begins (docs/GODOT_DIRECTOR.md §3, the panel's Player category): the game's start in this level
## (it wins over the level's own `start`), or a Test start: where the game begins while you test (a level played
## alone, F6, or the panel's Play from here) and nowhere else. The player faces its arrow (+Z) at their eye height
## (the HSGame's player settings) and starts with what's listed here.
@tool
@icon("res://addons/horrorstudio_director/icons/player.svg")
class_name HSPlayerStart
extends HSSpot

## the game's start in this level, or the test start
@export_enum("game", "test") var start_for: String = "game":
	set(v):
		start_for = v
		if is_inside_tree() and Engine.is_editor_hint():
			_draw()
## what the player has with them when they start here (items' ids: flashlight, bedroom_key)
@export var starts_with: PackedStringArray = PackedStringArray()


func _validate_property(p: Dictionary) -> void:
	if p["name"] in ["wait", "pose", "check"]:         # a path's point's words, not a start's
		p["usage"] = PROPERTY_USAGE_NO_EDITOR


## the player as a figure where they'll stand, and an arrow the way they'll look (fainter for a test start)
func _draw() -> void:
	var old := get_node_or_null("_gen")
	if old != null:
		old.free()
	_gen = Node3D.new()
	_gen.name = "_gen"
	add_child(_gen)
	var m := HSDirector.glow(Color(0.95, 0.76, 0.48, 0.5 if start_for == "game" else 0.25))
	var body := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 0.22
	cap.height = 1.7
	body.mesh = cap
	body.material_override = m
	body.position = Vector3(0, 0.85, 0)
	_gen.add_child(body)
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.3
	tm.outer_radius = 0.36
	ring.mesh = tm
	ring.material_override = m
	ring.position = Vector3(0, 0.01, 0)
	_gen.add_child(ring)
	var am := HSDirector.glow(Color(0.95, 0.76, 0.48, 0.9))
	var arrow := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.06, 0.02, 0.5)
	arrow.mesh = bm
	arrow.material_override = am
	arrow.position = Vector3(0, 0.02, 0.6)
	_gen.add_child(arrow)
	var head := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0
	cm.bottom_radius = 0.12
	cm.height = 0.22
	head.mesh = cm
	head.material_override = am
	head.rotation_degrees = Vector3(90, 0, 0)
	head.position = Vector3(0, 0.02, 0.92)
	_gen.add_child(head)
