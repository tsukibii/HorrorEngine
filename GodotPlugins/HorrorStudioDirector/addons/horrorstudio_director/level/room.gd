## A room (docs/GODOT_DIRECTOR.md §3): a floor, four walls and a ceiling from its size, a box as the user's
## architecture is (DECISIONS 2026-10-30, evening). The node's origin is the floor's middle; `size` the space
## inside (x wide, y high, z deep); north is -z. A door (HSDoor) placed on one of its walls cuts its own opening;
## `openings` are the doorways and windows with no door (a window's glass, its daylight, its shaft, a car passing
## outside), `leaks` water running down a wall. Its floor's kind is the footsteps', its id an area an event
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
## water running down a wall from where it comes in (a wet band below it, drips)
@export var leaks: Array[HSRoomLeak] = []
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
			o.append([op.side, op.offset, op.width, op.height, op.sill, op.window_key()])
	for lk in leaks:
		if lk != null:
			o.append([lk.side, lk.offset, lk.height, lk.width, lk.drip, lk.wet])
	for h in door_holes():
		o.append(h)
	for r in _level_rooms():                          # a neighbour moved or changed can change which corners this room closes and where its floor stops
		o.append([r.global_transform, r.size, r.wall, r.walls, r.floor_on, r.ceiling_on, r.id])
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
	var mates := _level_rooms()
	if floor_on:
		for f in _slab("floor", mates):
			f.set_meta("hs_floor", floor_kind)
	if ceiling_on:
		_slab("ceiling", mates)
	var holes := _holes()
	var others := _neighbours()
	for side in ["north", "south", "east", "west"]:
		var bit: int = {"north": N, "south": S, "east": E, "west": W}[side]
		if not (walls & bit):
			continue
		if side == "east" or side == "west":
			_wall(side, holes[side])
			continue
		# a north or south wall closes the corners: past them where nothing else fills them, to their middles where
		# another room's wall does (its end inside that wall: run on to its face, the two faces lay in one plane and
		# z-fought, a line down the wall flickering as the eye moves), capped where it does only part of the way up
		var g0 := _corner_gaps(side, 0, others)
		var g1 := _corner_gaps(side, 1, others)
		var whole0 := _whole(g0)
		var whole1 := _whole(g1)
		_wall(side, holes[side], wall if whole0 else wall / 2.0, wall if whole1 else wall / 2.0)
		if not whole0:
			_caps(side, 0, g0)
		if not whole1:
			_caps(side, 1, g1)
	var i := 0
	for op in openings:                               # a window's glass, in the editor too
		if op != null and op.glass:
			_pane(op, i)
		i += 1
	if Engine.is_editor_hint():
		_show_leaks()
		i = 0
		for op in openings:
			if op != null and op.daylight:
				_daylight(op, i, _time_now())
			i += 1


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


## the floor or the ceiling, a slab 10 cm thick: out to the walls' middle lines (its core), and past them to the walls'
## outer faces only where no other room of the level carries a slab of its own on at that height (its core). Two rooms'
## floors never lie in one plane: run under the wall they share, they did, and in its doorway they z-fought, a strip
## flickering between the two floors (DECISIONS 2026-11-03, later evening). Returns the slab's blocks.
func _slab(kind: String, mates: Array) -> Array:
	var thick := 0.1
	var y := -thick / 2.0 if kind == "floor" else size.y + thick / 2.0
	var mat := _mat(floor_material if kind == "floor" else ceiling_material, kind)
	var out: Array = [_block(kind, Vector3(size.x + wall, thick, size.z + wall), Vector3(0, y, 0), mat)]
	var hx := size.x / 2.0 + wall / 2.0                   # the walls' middle lines
	var hz := size.z / 2.0 + wall / 2.0
	# [this room's space into theirs, their core's half size, their whole slab's, its face there, their id]
	var others: Array = []
	var me := HSDirector.id_of(self)
	for r in mates:
		if (kind == "floor" and r.floor_on) or (kind == "ceiling" and r.ceiling_on):
			others.append([r.global_transform.affine_inverse() * global_transform, Vector2(r.size.x / 2.0 + r.wall / 2.0, r.size.z / 2.0 + r.wall / 2.0),
				Vector2(r.size.x / 2.0 + r.wall, r.size.z / 2.0 + r.wall), 0.0 if kind == "floor" else r.size.y, HSDirector.id_of(r)])
	var top := 0.0 if kind == "floor" else size.y         # the face two rooms' slabs share: a floor's top, a ceiling's bottom
	# past the middle lines a point is someone else's where another room's core holds it, or where another room's whole
	# slab would reach it and that room's id comes first (the outer corners two rooms' strips both reach: one builds it)
	var covered := func(px: float, pz: float) -> bool:
		for o in others:
			var q: Vector3 = o[0] * Vector3(px, top, pz)
			if abs(q.y - float(o[3])) >= 0.002:
				continue
			if abs(q.x) <= o[1].x + 1e-4 and abs(q.z) <= o[1].y + 1e-4:
				return true
			if str(o[4]) < me and abs(q.x) <= o[2].x + 1e-4 and abs(q.z) <= o[2].y + 1e-4:
				return true
		return false
	# the strips past the middle lines: east and west along the core's depth, north and south the whole width with the corners
	var sides := [["e", Vector2(hx + wall / 4.0, 0.0), Vector2(0.0, 1.0), -hz, hz], ["w", Vector2(-hx - wall / 4.0, 0.0), Vector2(0.0, 1.0), -hz, hz],
		["s", Vector2(0.0, hz + wall / 4.0), Vector2(1.0, 0.0), -hx - wall / 2.0, hx + wall / 2.0], ["n", Vector2(0.0, -hz - wall / 4.0), Vector2(1.0, 0.0), -hx - wall / 2.0, hx + wall / 2.0]]
	for sd in sides:
		var mid: Vector2 = sd[1]
		var along: Vector2 = sd[2]
		var a0: float = sd[3]
		var a1: float = sd[4]
		var open := func(t: float) -> bool:
			var p: Vector2 = mid + along * t
			return not covered.call(p.x, p.y)
		var n := maxi(2, int(ceil((a1 - a0) / 0.025)))    # sampled every 2.5 cm, each run's ends found by halving between samples
		var cell := (a1 - a0) / n
		var state: Array = []
		for k in n:
			state.append(open.call(a0 + cell * (k + 0.5)))
		var i := 0
		var k := 0
		while k < n:
			if not state[k]:
				k += 1
				continue
			var j := k
			while j < n and state[j]:
				j += 1
			var s0: float = a0 if k == 0 else _edge(open, a0 + cell * (k - 0.5), a0 + cell * (k + 0.5))
			var s1: float = a1 if j == n else _edge(open, a0 + cell * (j - 0.5), a0 + cell * (j + 0.5))
			if s1 - s0 > 0.002:
				var c: Vector2 = mid + along * ((s0 + s1) / 2.0)
				var sz := Vector3(wall / 2.0, thick, s1 - s0) if along.y != 0.0 else Vector3(s1 - s0, thick, wall / 2.0)
				out.append(_block("%s_%s%d" % [kind, sd[0], i], sz, Vector3(c.x, y, c.y), mat))
				i += 1
			k = j
	return out


## where `open` changes between lo and hi (one each way), to a tenth of a millimetre
static func _edge(open: Callable, lo: float, hi: float) -> float:
	var at_lo: bool = open.call(lo)
	for _i in 12:
		var m := (lo + hi) / 2.0
		if open.call(m) == at_lo:
			lo = m
		else:
			hi = m
	return (lo + hi) / 2.0


## the holes in each wall, [offset, width, bottom, top] along it: the openings and the doors on it
func _holes() -> Dictionary:
	var holes := {"north": [], "south": [], "east": [], "west": []}
	for op in openings:
		if op != null:
			holes[op.side].append([op.offset, op.width, op.sill, op.sill + op.height])
	for h in door_holes():
		holes[h[0]].append([h[1], h[2], 0.0, h[3]])
	return holes


## the level this room is in (rooms in another level are another place, wherever they stand)
static func _level_of(n: Node) -> Node:
	var p := n.get_parent()
	while p != null and not (p is HSLevel):
		p = p.get_parent()
	return p


## the other rooms of this room's level, each [this room's space into theirs, their walls' boxes with their north and
## south walls stopped on their corners' middles]: what can fill one of this room's corners. Never another room's own
## corner, so two rooms meeting decide alike (both stop on the middle, between them the corner is filled)
func _neighbours() -> Array:
	var out: Array = []
	for r in _level_rooms():
		out.append([r.global_transform.affine_inverse() * global_transform, r.core_boxes()])
	return out


## the other rooms in this room's level
func _level_rooms() -> Array:
	var out: Array = []
	if not is_inside_tree():
		return out
	var lv := _level_of(self)
	for r in get_tree().get_nodes_in_group("hs_rooms"):
		if r != self and r is HSRoom and r.is_inside_tree() and _level_of(r) == lv:
			out.append(r)
	return out


## this room's walls as boxes ([centre, size], its own space), its north and south walls stopped on their corners' middles
func core_boxes() -> Array:
	var holes := _holes()
	var out: Array = []
	for side in ["north", "south", "east", "west"]:
		if walls & ({"north": N, "south": S, "east": E, "west": W}[side] as int):
			out.append_array(wall_boxes(side, holes[side], wall / 2.0, wall / 2.0))
	return out


## where nothing but this wall fills its corner's square at `end` (0 west, 1 east) of a north or south wall: the
## heights, [bottom, top] in the room's own space, of the square's outer half (beyond its middle, away from the room)
## that no other room's wall fills, sampled 5 by 5, its edges left out; gaps under a centimetre ignored
func _corner_gaps(side: String, end: int, others: Array) -> Array:
	var H := size.y
	if others.is_empty():
		return [[0.0, H]]
	var cx := (size.x / 2.0 + wall / 2.0) * (1.0 if end == 1 else -1.0)
	var cz := (size.z / 2.0 + wall / 2.0) * (1.0 if side == "south" else -1.0)
	var out_x := 1.0 if end == 1 else -1.0
	var filled: Array = [[0.0, H]]
	for i in 5:
		for j in 5:
			var p := Vector3(cx + out_x * (0.004 + (wall / 2.0 - 0.008) * i / 4.0), 0.0, cz - wall / 2.0 + 0.004 + (wall - 0.008) * j / 4.0)
			var here: Array = []
			for o in others:
				var q: Vector3 = o[0] * p                   # in that room's space; its y there is this room's floor
				for b in o[1]:
					var c: Vector3 = b[0]
					var s: Vector3 = b[1]
					if abs(q.x - c.x) <= s.x / 2.0 + 1e-5 and abs(q.z - c.z) <= s.z / 2.0 + 1e-5:
						here.append([c.y - s.y / 2.0 - q.y, c.y + s.y / 2.0 - q.y])
			here = _merged(here)
			var next: Array = []
			for a in filled:
				for b in here:
					var lo: float = max(a[0], b[0])
					var hi: float = min(a[1], b[1])
					if hi - lo > 1e-5:
						next.append([lo, hi])
			filled = next
			if filled.is_empty():
				return [[0.0, H]]
	var gaps: Array = []
	var cur := 0.0
	for f in _merged(filled):
		if f[0] > cur + 0.01:
			gaps.append([cur, f[0]])
		cur = max(cur, f[1])
	if H > cur + 0.01:
		gaps.append([cur, H])
	return gaps


static func _merged(iv: Array) -> Array:
	iv.sort_custom(func(a, b): return a[0] < b[0])
	var out: Array = []
	for v in iv:
		if out.size() and v[0] <= out[-1][1] + 1e-5:
			out[-1] = [out[-1][0], max(out[-1][1], v[1])]
		else:
			out.append([v[0], v[1]])
	return out


## the corner open over the whole wall (nothing else there): the wall runs past it as it always has
func _whole(gaps: Array) -> bool:
	return gaps.size() == 1 and gaps[0][0] <= 0.01 and gaps[0][1] >= size.y - 0.01


## a north or south wall's corner closed where nothing else fills it, over those heights: its square's outer half
func _caps(side: String, end: int, gaps: Array) -> void:
	var x := (size.x / 2.0 + wall * 0.75) * (1.0 if end == 1 else -1.0)
	var z := (size.z / 2.0 + wall / 2.0) * (1.0 if side == "south" else -1.0)
	var i := 0
	for g in gaps:
		var lo: float = clamp(float(g[0]), 0.0, size.y)
		var hi: float = clamp(float(g[1]), 0.0, size.y)
		if hi - lo > 0.01:
			_block("wall_%sc%d_%d" % [side[0], end, i], Vector3(wall / 2.0, hi - lo, wall), Vector3(x, (lo + hi) / 2.0, z), _mat(wall_material, "wall"))
			i += 1


## one wall built as boxes round its holes ([offset, width, bottom, top] along it); a north or south wall runs `e0`
## past the space inside at its west end and `e1` at its east (a whole wall closes the corner, the default)
func _wall(side: String, holes: Array, e0: float = -1.0, e1: float = -1.0) -> void:
	var i := 0
	for b in wall_boxes(side, holes, e0, e1):
		_block("wall_%s_%d" % [side[0], i], b[1], b[0], _mat(wall_material, "wall"))
		i += 1


## one wall as boxes round its holes, [centre, size] each in the room's own space (see _wall)
func wall_boxes(side: String, holes: Array, e0: float = -1.0, e1: float = -1.0) -> Array:
	var along_x := side == "north" or side == "south"
	if e0 < 0.0:
		e0 = wall
	if e1 < 0.0:
		e1 = wall
	var lo_u: float = -(size.x / 2.0 + e0) if along_x else -size.z / 2.0
	var hi_u: float = (size.x / 2.0 + e1) if along_x else size.z / 2.0
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
		var u0: float = clamp(float(h[0]) - float(h[1]) / 2.0, lo_u, hi_u)
		var u1: float = clamp(float(h[0]) + float(h[1]) / 2.0, lo_u, hi_u)
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
	var u := lo_u
	for h in merged:
		if h[0] > u + 0.005:
			segs.append([u, h[0], 0.0, H])
		if h[2] > 0.005:
			segs.append([h[0], h[1], 0.0, h[2]])
		if h[3] < H - 0.005:
			segs.append([h[0], h[1], h[3], H])
		u = max(u, h[1])
	if u < hi_u - 0.005:
		segs.append([u, hi_u, 0.0, H])
	var out: Array = []
	for s in segs:
		var len_: float = s[1] - s[0]
		var hgt: float = s[3] - s[2]
		var mid: float = (s[0] + s[1]) / 2.0
		var at := c + Vector3(mid if along_x else 0.0, (s[2] + s[3]) / 2.0, 0.0 if along_x else mid)
		out.append([at, Vector3(len_, hgt, wall) if along_x else Vector3(wall, hgt, len_)])
	return out


## a window's frame in the room's own space: mid (its middle on the wall's middle line), face (its middle on the inside
## face), inward (into the room), along (story north or east, the street's way), turn (the glass's, about y)
func window_frame(op: HSOpening) -> Dictionary:
	var y := op.sill + op.height / 2.0
	match op.side:
		"north":
			return {"mid": Vector3(op.offset, y, -(size.z / 2.0 + wall / 2.0)), "face": Vector3(op.offset, y, -size.z / 2.0), "inward": Vector3.BACK, "along": Vector3.RIGHT, "turn": 0.0}
		"south":
			return {"mid": Vector3(op.offset, y, size.z / 2.0 + wall / 2.0), "face": Vector3(op.offset, y, size.z / 2.0), "inward": Vector3.FORWARD, "along": Vector3.RIGHT, "turn": 0.0}
		"east":
			return {"mid": Vector3(size.x / 2.0 + wall / 2.0, y, op.offset), "face": Vector3(size.x / 2.0, y, op.offset), "inward": Vector3.LEFT, "along": Vector3.FORWARD, "turn": 90.0}
	return {"mid": Vector3(-(size.x / 2.0 + wall / 2.0), y, op.offset), "face": Vector3(-size.x / 2.0, y, op.offset), "inward": Vector3.RIGHT, "along": Vector3.FORWARD, "turn": 90.0}


## the glass in a window: a quad in the opening, see-through, casting no shadow (a car's headlights shine in through it);
## at play the runtime puts the rain on it (HSGlass)
func _pane(op: HSOpening, i: int) -> MeshInstance3D:
	var fr := window_frame(op)
	var mi := MeshInstance3D.new()
	mi.name = "_pane_%d" % i
	var q := QuadMesh.new()
	q.size = Vector2(op.width, op.height)
	mi.mesh = q
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(0.85, 0.9, 0.95, 0.12)
	m.roughness = 0.05
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.transform = Transform3D(Basis(Vector3.UP, deg_to_rad(float(fr["turn"]))), fr["mid"])
	_gen.add_child(mi)
	return mi


## the time it is, for the editor's look at a window's daylight (at play the runtime sets it: game.gd _windows_by_time)
func _time_now() -> String:
	var n: Node = get_parent()
	while n != null:
		var t = n.get("time_of_day")
		if t is String and t != "" and t != "keep":
			return t
		n = n.get_parent()
	return "night"


## a window's daylight: a soft spot just inside it, aimed two metres in and down (the export's windows' fill: its colour,
## strength a square metre of glass and reach by the time of day, the runtime's TIME_LOOK)
func _daylight(op: HSOpening, i: int, t: String) -> SpotLight3D:
	var fr := window_frame(op)
	var win: Array = [Color(0.35, 0.5, 1.0), 1.0, 5.0]
	var tl := "res://addons/horrorstudio/game.gd"
	if ResourceLoader.exists(tl):
		var L: Dictionary = load(tl).TIME_LOOK
		win = L.get(t, L.get("night", {})).get("win", win)
	var area := op.width * op.height
	var li := SpotLight3D.new()
	li.name = "_window_%d" % i
	li.light_color = win[0]
	li.light_energy = float(win[1]) * area
	li.spot_range = float(win[2])
	li.spot_angle = 63.0
	li.spot_attenuation = 1.5
	li.distance_fade_enabled = true
	li.distance_fade_begin = 24.0
	li.distance_fade_shadow = 14.0
	li.distance_fade_length = 4.0
	if op.shaft > 0.0:                                # the beam shows in the haze, the frame's shadow cut into it
		li.light_volumetric_fog_energy = 4.0 * op.shaft
		li.shadow_enabled = true
		li.shadow_blur = 1.5
	_gen.add_child(li)
	var a: Vector3 = global_transform * (fr["face"] as Vector3)
	var b: Vector3 = global_transform * ((fr["face"] as Vector3) + (fr["inward"] as Vector3) * (2.0 - wall / 2.0) + Vector3(0, -0.8, 0))
	li.look_at_from_position(a, b, Vector3.UP)
	li.set_meta("window", JSON.stringify({"room": HSDirector.id_of(self), "area": area, "energy": float(win[1]) * area}))
	return li


## for play: each window's glass, daylight, shaft and passing car as the runtime's (play.gd and game.gd find them among
## the level's pieces by their words: pane, window, shaft, sweep)
func _windows() -> void:
	var rid := HSDirector.id_of(self)
	var i := -1
	for op in openings:
		i += 1
		if op == null:
			continue
		var fr := window_frame(op)
		var pane = _gen.get_node_or_null("_pane_%d" % i)
		if pane != null:
			pane.set_meta("pane", JSON.stringify({"room": rid, "w": op.width, "h": op.height}))
			pane.add_to_group("hs_piece")
		if op.daylight:
			var li := _daylight(op, i, "night")
			li.add_to_group("hs_piece")
			if op.shaft > 0.0:                            # a FogVolume laid along the light: the runtime makes it the beam and its dust (HSShaft)
				var fv := FogVolume.new()
				fv.name = "_shaft_%d" % i
				fv.shape = RenderingServer.FOG_VOLUME_SHAPE_BOX
				fv.size = Vector3(op.width * 1.15, op.height * 1.15, op.shaft_reach)
				_gen.add_child(fv)
				var a := li.global_position
				var dir := -li.global_transform.basis.z
				fv.look_at_from_position(a + dir * op.shaft_reach / 2.0, a + dir * op.shaft_reach, Vector3.UP)
				fv.set_meta("shaft", JSON.stringify({"room": rid, "strength": op.shaft, "dust": op.shaft_dust, "drift": 0.12, "reach": op.shaft_reach}))
				fv.add_to_group("hs_piece")
		if op.sweep_on:                               # a car passing outside now and then (HSSweep): a marker at the window's middle
			var mk := Node3D.new()
			mk.name = "_sweep_%d" % i
			_gen.add_child(mk)
			mk.global_position = global_transform * (fr["mid"] as Vector3)
			var b := global_transform.basis.orthonormalized()
			var outw: Vector3 = (b * -(fr["inward"] as Vector3)).normalized()
			var alg: Vector3 = (b * (fr["along"] as Vector3)).normalized()
			mk.set_meta("sweep", JSON.stringify({"room": rid, "outward": [outw.x, outw.y, outw.z], "along": [alg.x, alg.y, alg.z], "every": op.sweep_every,
				"secs": op.sweep_secs, "out": op.sweep_out, "span": op.sweep_span, "energy": op.sweep_energy, "aim": op.sweep_aim}))
			mk.add_to_group("hs_piece")


## a leak's place on its wall's inside face, in the world: {at, axis (along the wall), inward (into the room), bottom (the floor)}
func leak_place(lk: HSRoomLeak) -> Dictionary:
	var at := Vector3.ZERO
	var axis := Vector3.RIGHT
	var inward := Vector3.BACK
	match lk.side:
		"north":
			at = Vector3(lk.offset, lk.height, -size.z / 2.0)
		"south":
			at = Vector3(lk.offset, lk.height, size.z / 2.0)
			inward = Vector3.FORWARD
		"east":
			at = Vector3(size.x / 2.0, lk.height, lk.offset)
			axis = Vector3.FORWARD
			inward = Vector3.LEFT
		"west":
			at = Vector3(-size.x / 2.0, lk.height, lk.offset)
			axis = Vector3.FORWARD
			inward = Vector3.RIGHT
	var b := global_transform.basis.orthonormalized()
	return {"at": global_transform * at, "axis": (b * axis).normalized(), "inward": (b * inward).normalized(), "bottom": global_position.y}


## a leak's words as the runtime's `leak` (play.gd: the band on this room's walls on its side, the drips)
func leak_words(lk: HSRoomLeak) -> Dictionary:
	var pl := leak_place(lk)
	var ax: Vector3 = pl["axis"]
	var inw: Vector3 = pl["inward"]
	return {"room": HSDirector.id_of(self), "wall": lk.side.substr(0, 1), "axis": [ax.x, ax.y, ax.z], "inward": [inw.x, inw.y, inw.z],
		"width": lk.width, "top": (pl["at"] as Vector3).y, "bottom": pl["bottom"], "drip": lk.drip, "wet": lk.wet}


## in the editor: each leak's band on the walls built for it and its drips (the Look plugin's HSLeak, under _gen: never saved)
func _show_leaks() -> void:
	if leaks.is_empty() or not ResourceLoader.exists("res://addons/horrorstudio_look/leak.gd"):
		return
	var Leak = load("res://addons/horrorstudio_look/leak.gd")
	for lk in leaks:
		if lk == null:
			continue
		var ms: Array = []
		for b in _gen.get_children():
			if str(b.name).begins_with("wall_" + lk.side.substr(0, 1) + "_"):
				var mi = b.get_node_or_null("mesh")
				if mi != null:
					ms.append(mi)
		var pl := leak_place(lk)
		var w := leak_words(lk)
		_gen.add_child(Leak.make(ms, {"centre": pl["at"], "axis": pl["axis"], "inward": pl["inward"], "width": lk.width,
			"top": w["top"], "bottom": w["bottom"], "drip": lk.drip, "wet": lk.wet}))


## for play: the floor, walls and ceiling as the runtime's pieces, the room's volume as an area to enter
func _stamp() -> void:
	var rid := HSDirector.id_of(self)
	for b in _gen.get_children():
		if not (b is StaticBody3D):
			continue                                  # (a window's glass: its own words below)
		var nm := str(b.name)
		var kind := "floor" if nm.begins_with("floor") else ("ceiling" if nm.begins_with("ceiling") else "wall")   # (a slab's strips past the walls' middles too)
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
	_windows()
	var i := 0
	for lk in leaks:                                  # each leak a marker on its wall's face: the runtime wets the wall and drips (play.gd)
		if lk == null:
			continue
		var m := Node3D.new()
		m.name = "_leak_%d" % i
		_gen.add_child(m)
		m.global_position = leak_place(lk)["at"]
		HSDirector.stamp(m, {"id": lk.id if lk.id != "" else "%s__leak_%d" % [rid, i], "kind": "leak", "shape": null, "size": [lk.width, 0, 0],
			"room": rid, "yaw": 0.0, "pos": HSDirector.story_pos(m.global_position), "tags": ["wall:" + lk.side.substr(0, 1)], "d": {}})
		m.set_meta("leak", JSON.stringify(leak_words(lk)))
		i += 1


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
