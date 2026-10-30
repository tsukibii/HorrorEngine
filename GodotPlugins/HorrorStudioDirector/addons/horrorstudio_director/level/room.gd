## A room (docs/GODOT_DIRECTOR.md §3): a floor, four walls and a ceiling from its size, a box as the user's
## architecture is (DECISIONS 2026-10-30, evening). The node's origin is the floor's middle; `size` the space
## inside (x wide, y high, z deep); north is -z. A door (HSDoor) placed on one of its walls cuts its own opening;
## `openings` are the doorways and windows with no door. Its floor's kind is the footsteps', its id an area an event
## hears the player enter ("the player enters kitchen"), the lights inside it the room's (a switch, the lights dying).
## What it builds is made again whenever it changes and never saved (only its numbers are).
@tool
@icon("res://addons/horrorstudio_director/icons/room.svg")
class_name HSRoom
extends Node3D

const N := 1
const S := 2
const E := 4
const W := 8
const OCCLUDE_MIN := 1.0
const FRAME := 0.05               # a door's frame, each side: the opening a door cuts is this much wider and taller

@export var id: String = ""
## the space inside: width (x), height (y), depth (z), metres
@export var size: Vector3 = Vector3(4.0, 2.6, 4.0)
@export_range(0.05, 0.6) var wall: float = 0.12
@export_flags("North", "South", "East", "West") var walls: int = 15
@export var floor_on: bool = true
@export var ceiling_on: bool = true
@export_enum("wood", "stone", "tile", "carpet", "dirt", "metal", "water") var floor_kind: String = "wood"
## doorways and windows with no door in them
@export var openings: Array[HSOpening] = []
## doors on this room's walls cut their openings by themselves
@export var cut_for_doors: bool = true
## a damp floor (0 to 1: pools from 0.3, wet steps from 0.5)
@export_range(0.0, 1.0) var wet: float = 0.0
@export var floor_material: Material
@export var wall_material: Material
@export var ceiling_material: Material

var _gen: Node3D = null
var _key := 0
var _tick := 0


func _enter_tree() -> void:
	HSDirector.auto_id(self)
	add_to_group("hs_rooms")


func _ready() -> void:
	if not Engine.is_editor_hint() and HSDirector.holding:
		return
	_rebuild()
	if not Engine.is_editor_hint():
		_stamp()


func _process(_dt: float) -> void:
	if not Engine.is_editor_hint():
		return
	_tick += 1
	if _tick % 10 != 0:
		return
	var k := _settings().hash()
	if k != _key:
		_rebuild()


func _settings() -> Array:
	var o: Array = [size, wall, walls, floor_on, ceiling_on, floor_material, wall_material, ceiling_material, cut_for_doors, global_transform]
	for op in openings:
		if op != null:
			o.append([op.side, op.offset, op.width, op.height, op.sill])
	for h in door_holes():
		o.append(h)
	return o


## the doors on this room's walls, as holes: [side, offset along the wall, width, height]
func door_holes() -> Array:
	var out: Array = []
	if not cut_for_doors or not is_inside_tree():
		return out
	var inv := global_transform.affine_inverse()
	for d in get_tree().get_nodes_in_group("hs_doors"):
		if not (d is Node3D) or not d.is_inside_tree():
			continue
		var p: Vector3 = inv * d.global_position
		var ax: Vector3 = (inv.basis * d.global_transform.basis.x).normalized()
		var w: float = float(d.get("width")) + FRAME * 2.0
		var h: float = float(d.get("height")) + FRAME
		var reach: float = wall / 2.0 + 0.2
		if abs(ax.x) > 0.9 and abs(p.x) < size.x / 2.0 + wall:            # along a north or south wall
			if abs(p.z + size.z / 2.0 + wall / 2.0) < reach:
				out.append(["north", p.x, w, h])
			elif abs(p.z - size.z / 2.0 - wall / 2.0) < reach:
				out.append(["south", p.x, w, h])
		elif abs(ax.z) > 0.9 and abs(p.z) < size.z / 2.0 + wall:          # along an east or west wall
			if abs(p.x - size.x / 2.0 - wall / 2.0) < reach:
				out.append(["east", p.z, w, h])
			elif abs(p.x + size.x / 2.0 + wall / 2.0) < reach:
				out.append(["west", p.z, w, h])
	return out


func _mat(m: Material, kind: String) -> Material:
	if m != null:
		return m
	match kind:
		"floor":
			return HSDirector.grey(Color(0.34, 0.28, 0.22))
		"ceiling":
			return HSDirector.grey(Color(0.78, 0.77, 0.74))
	return HSDirector.grey(Color(0.62, 0.61, 0.58))


func _rebuild() -> void:
	_key = _settings().hash()
	var old := get_node_or_null("_gen")
	if old != null:
		old.free()
	_gen = Node3D.new()
	_gen.name = "_gen"
	add_child(_gen)
	var thick := 0.1
	if floor_on:
		_block("floor", Vector3(size.x + wall * 2.0, thick, size.z + wall * 2.0), Vector3(0, -thick / 2.0, 0), _mat(floor_material, "floor")).set_meta("hs_floor", floor_kind)
	if ceiling_on:
		_block("ceiling", Vector3(size.x + wall * 2.0, thick, size.z + wall * 2.0), Vector3(0, size.y + thick / 2.0, 0), _mat(ceiling_material, "ceiling"))
	var holes := {"north": [], "south": [], "east": [], "west": []}
	for op in openings:
		if op != null:
			holes[op.side].append([op.offset, op.width, op.sill, op.sill + op.height])
	for h in door_holes():
		holes[h[0]].append([h[1], h[2], 0.0, h[3]])
	for side in ["north", "south", "east", "west"]:
		var bit: int = {"north": N, "south": S, "east": E, "west": W}[side]
		if walls & bit:
			_wall(side, holes[side])


func _block(nm: String, sz: Vector3, at: Vector3, mat: Material) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.name = nm
	b.position = at
	var mi := MeshInstance3D.new()
	mi.name = "mesh"
	var bm := BoxMesh.new()
	bm.size = sz
	mi.mesh = bm
	mi.material_override = mat
	b.add_child(mi)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = sz
	cs.shape = bs
	b.add_child(cs)
	var face: bool = max(sz.x, sz.z) >= OCCLUDE_MIN and (sz.y >= OCCLUDE_MIN or min(sz.x, sz.z) >= OCCLUDE_MIN)   # a wall or a floor big enough to hide what's behind it
	if face:
		var oc := OccluderInstance3D.new()
		var bo := BoxOccluder3D.new()
		bo.size = Vector3(max(sz.x - 0.02, 0.01), max(sz.y - 0.02, 0.01), max(sz.z - 0.02, 0.01))
		oc.occluder = bo
		b.add_child(oc)
	_gen.add_child(b)
	return b


## one wall as boxes round its holes ([offset, width, bottom, top] along it)
func _wall(side: String, holes: Array) -> void:
	var along_x := side == "north" or side == "south"
	var L: float = size.x + wall * 2.0 if along_x else size.z
	var H: float = size.y
	var c := Vector3.ZERO
	match side:
		"north":
			c = Vector3(0, 0, -(size.z / 2.0 + wall / 2.0))
		"south":
			c = Vector3(0, 0, size.z / 2.0 + wall / 2.0)
		"east":
			c = Vector3(size.x / 2.0 + wall / 2.0, 0, 0)
		"west":
			c = Vector3(-(size.x / 2.0 + wall / 2.0), 0, 0)
	var hs: Array = []
	for h in holes:
		var u0: float = clamp(float(h[0]) - float(h[1]) / 2.0, -L / 2.0, L / 2.0)
		var u1: float = clamp(float(h[0]) + float(h[1]) / 2.0, -L / 2.0, L / 2.0)
		if u1 - u0 > 0.01:
			hs.append([u0, u1, clamp(float(h[2]), 0.0, H), clamp(float(h[3]), 0.0, H)])
	hs.sort_custom(func(a, b): return a[0] < b[0])
	var merged: Array = []
	for h in hs:
		if merged.size() and h[0] <= merged[-1][1]:
			merged[-1] = [merged[-1][0], max(merged[-1][1], h[1]), min(merged[-1][2], h[2]), max(merged[-1][3], h[3])]
		else:
			merged.append(h)
	var segs: Array = []
	var u := -L / 2.0
	for h in merged:
		if h[0] > u + 0.005:
			segs.append([u, h[0], 0.0, H])
		if h[2] > 0.005:
			segs.append([h[0], h[1], 0.0, h[2]])
		if h[3] < H - 0.005:
			segs.append([h[0], h[1], h[3], H])
		u = max(u, h[1])
	if u < L / 2.0 - 0.005:
		segs.append([u, L / 2.0, 0.0, H])
	var i := 0
	for s in segs:
		var len_: float = s[1] - s[0]
		var hgt: float = s[3] - s[2]
		var mid: float = (s[0] + s[1]) / 2.0
		var at := c + Vector3(mid if along_x else 0.0, (s[2] + s[3]) / 2.0, 0.0 if along_x else mid)
		var sz := Vector3(len_, hgt, wall) if along_x else Vector3(wall, hgt, len_)
		_block("wall_%s_%d" % [side[0], i], sz, at, _mat(wall_material, "wall"))
		i += 1


## for play: the floor, walls and ceiling as the runtime's pieces, the room's volume as an area to enter
func _stamp() -> void:
	var rid := HSDirector.id_of(self)
	for b in _gen.get_children():
		var nm := str(b.name)
		var kind := "floor" if nm == "floor" else ("ceiling" if nm == "ceiling" else "wall")
		var sh: BoxShape3D = (b.find_children("*", "CollisionShape3D", false, false)[0] as CollisionShape3D).shape
		var piece := {"id": rid + "__" + nm, "kind": kind, "shape": "box", "size": [sh.size.x, sh.size.z, sh.size.y], "room": rid,
			"yaw": HSDirector.story_yaw(b) + 90.0, "pos": HSDirector.story_pos(b.global_position), "tags": ["floor:" + floor_kind] if kind == "floor" else [], "d": {}}
		HSDirector.stamp(b, piece)
	var vol := Node3D.new()
	vol.name = "_volume"
	_gen.add_child(vol)
	var bb := volume()
	HSDirector.stamp(vol, {"id": rid + "__volume", "kind": "trigger", "shape": "box", "size": [bb.size.x, bb.size.z, bb.size.y], "room": rid,
		"yaw": 0.0, "pos": HSDirector.story_pos(bb.get_center()), "tags": ["room_volume:" + rid], "d": {}})
	vol.set_meta("trigger", JSON.stringify({"id": rid, "safe": false,
		"min": [bb.position.x, -(bb.position.z + bb.size.z), bb.position.y], "max": [bb.position.x + bb.size.x, -bb.position.z, bb.position.y + bb.size.y]}))


## the space inside in the world (axis-aligned)
func volume() -> AABB:
	var a := AABB(Vector3(-size.x / 2.0, 0.0, -size.z / 2.0), size)
	return global_transform * a


## whether a point of the world is inside it
func holds(p: Vector3) -> bool:
	var l := global_transform.affine_inverse() * p
	return abs(l.x) <= size.x / 2.0 + 0.01 and abs(l.z) <= size.z / 2.0 + 0.01 and l.y >= -0.05 and l.y <= size.y + 0.05


## the room as the story's level keeps it (rain, a wet floor): its corner, size, ceiling
func as_story() -> Dictionary:
	var bb := volume()
	var r := {"id": HSDirector.id_of(self), "at": [bb.position.x, -(bb.position.z + bb.size.z), bb.position.y], "size": [bb.size.x, bb.size.z, bb.size.y],
		"floor": floor_kind, "ceiling": ceiling_on, "name": str(name)}
	if wet > 0.0:
		r["wet"] = wet
	return r
