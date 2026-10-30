## A door (docs/GODOT_DIRECTOR.md §3): a leaf on its hinges (or sliding) in a frame, the node's origin at the doorway's
## foot in the middle, its x along the doorway. Put it on a room's wall and the wall opens for it. It swings away
## from the player (the runtime's doors), locked until the player has `key` (an item's id) or a flag
## (`flag:<name>`); a peephole and a latch (a thumb turn on the side of the room it belongs to) if asked. Drop a door
## model in as a child to wear it instead of the plain leaf (its origin at the leaf's foot, its x along the leaf).
@tool
@icon("res://addons/horrorstudio_director/icons/door.svg")
class_name HSDoor
extends Node3D

@export var id: String = ""
@export_range(0.4, 3.0) var width: float = 0.9
@export_range(1.0, 4.0) var height: float = 2.05
@export_range(0.02, 0.2) var thickness: float = 0.045
@export_enum("left", "right") var hinge: String = "left"
@export var sliding: bool = false
## locked until the player has this item (its id), or a flag (`flag:<name>`) is set; empty: never locked
@export var locked_by: String = ""
@export var peephole: bool = false
## a thumb turn: the player locks it shut from inside (heard as "locked <door>")
@export var latch: bool = false
@export var frame: bool = true
@export_range(0.05, 0.4) var frame_depth: float = 0.14
@export var leaf_color: Color = Color(0.42, 0.3, 0.2)
@export var leaf_material: Material

var _gen: Node3D = null
var _key := 0
var _tick := 0


func _enter_tree() -> void:
	HSDirector.auto_id(self)
	add_to_group("hs_doors")


func _validate_property(p: Dictionary) -> void:
	if p["name"] == "locked_by":
		HSDirector.hint(p, "item")


func _ready() -> void:
	if not Engine.is_editor_hint() and HSDirector.holding:
		return
	_rebuild()
	if not Engine.is_editor_hint():
		_setup()


func _process(_dt: float) -> void:
	if not Engine.is_editor_hint():
		return
	_tick += 1
	if _tick % 10 == 0 and _settings().hash() != _key:
		_rebuild()


func _settings() -> Array:
	return [width, height, thickness, hinge, frame, frame_depth, leaf_color, leaf_material, own_model() != null]


## the door model dropped in as a child, if any
func own_model() -> Node3D:
	for c in get_children():
		if c is Node3D and not str(c.name).begins_with("_"):
			return c
	return null


func _box(parent: Node3D, nm: String, sz: Vector3, at: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = nm
	var bm := BoxMesh.new()
	bm.size = sz
	mi.mesh = bm
	mi.material_override = mat
	mi.position = at
	parent.add_child(mi)
	return mi


func _rebuild() -> void:
	_key = _settings().hash()
	var old := get_node_or_null("_gen")
	if old != null:
		old.free()
	_gen = Node3D.new()
	_gen.name = "_gen"
	add_child(_gen)
	var wood: Material = leaf_material if leaf_material != null else HSDirector.grey(leaf_color, 0.6)
	if own_model() == null:
		var leaf := Node3D.new()
		leaf.name = "leaf"
		_gen.add_child(leaf)
		_box(leaf, "mesh", Vector3(width - 0.01, height - 0.01, thickness), Vector3(0, height / 2.0, 0), wood)
		var brass := HSDirector.grey(Color(0.62, 0.55, 0.36), 0.3)
		brass.metallic = 0.85
		var hx: float = (width / 2.0 - 0.07) * (1.0 if hinge == "left" else -1.0)
		for side in [1.0, -1.0]:
			_box(leaf, "handle", Vector3(0.11, 0.02, 0.02), Vector3(hx - 0.04 * (1.0 if hinge == "left" else -1.0), 1.0, side * (thickness / 2.0 + 0.03)), brass)
	if frame:
		var fm := HSDirector.grey(leaf_color.darkened(0.25), 0.7)
		var j := 0.05
		_box(_gen, "jamb_l", Vector3(j, height + j, frame_depth), Vector3(-(width / 2.0 + j / 2.0), (height + j) / 2.0, 0), fm)
		_box(_gen, "jamb_r", Vector3(j, height + j, frame_depth), Vector3(width / 2.0 + j / 2.0, (height + j) / 2.0, 0), fm)
		_box(_gen, "head", Vector3(width + j * 2.0, j, frame_depth), Vector3(0, height + j / 2.0, 0), fm)


## for play: the leaf as the runtime's door piece, its origin at its middle, what it wears moving with it
func _setup() -> void:
	var leaf := Node3D.new()
	leaf.name = "_leaf"
	leaf.position = Vector3(0, height / 2.0, 0)
	add_child(leaf)
	var moved: Array = []
	var own := own_model()
	if own != null:
		moved.append(own)
	var gl = _gen.get_node_or_null("leaf")
	if gl != null:
		moved.append(gl)
	for m in moved:
		var t: Transform3D = m.global_transform
		m.get_parent().remove_child(m)
		leaf.add_child(m)
		m.global_transform = t
	if own == null or not HSDirector.has_collider(own):
		var body := StaticBody3D.new()
		body.name = "_solid"
		var cs := CollisionShape3D.new()
		var bx := BoxShape3D.new()
		bx.size = Vector3(width - 0.02, height - 0.02, max(thickness, 0.03))
		cs.shape = bx
		body.add_child(cs)
		leaf.add_child(body)
	if frame:
		for nm in ["jamb_l", "jamb_r", "head"]:
			var mi: MeshInstance3D = _gen.get_node_or_null(nm)
			if mi != null:
				var b := StaticBody3D.new()
				b.name = "_" + nm
				var cs2 := CollisionShape3D.new()
				var bx2 := BoxShape3D.new()
				bx2.size = (mi.mesh as BoxMesh).size
				cs2.shape = bx2
				b.add_child(cs2)
				b.position = mi.position
				_gen.add_child(b)
	var tags: Array = []
	if locked_by != "":
		tags.append("locked_by:" + locked_by)
	var d := {}
	if peephole:
		d["peephole"] = true
	if latch:
		d["latch"] = true
	var rid := room_id()
	HSDirector.stamp(leaf, {"id": HSDirector.id_of(self), "kind": "door", "shape": "box", "size": [width, thickness, height], "room": rid,
		"yaw": HSDirector.story_yaw(self) + 90.0, "pos": HSDirector.story_pos(leaf.global_position), "tags": tags, "d": d,
		"swing": {"pivot": [(-1.0 if hinge == "left" else 1.0) * width / 2.0, 0.0, 0.0], "hinge": hinge, "slide": sliding, "w": width, "handle_z": 1.0}})


## the room it belongs to: the one its +z side looks into, else the one it's in or beside
func room_id() -> String:
	if not is_inside_tree():
		return ""
	var probe: Vector3 = global_position + global_transform.basis.z.normalized() * 0.5 + Vector3(0, 0.5, 0)
	var back: Vector3 = global_position - global_transform.basis.z.normalized() * 0.5 + Vector3(0, 0.5, 0)
	var best := ""
	for r in get_tree().get_nodes_in_group("hs_rooms"):
		if r.holds(probe):
			return HSDirector.id_of(r)
		if best == "" and r.holds(back):
			best = HSDirector.id_of(r)
	return best
