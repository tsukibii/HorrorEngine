@tool
## A place to sit, lie down or hide (guides/tutorial_v2: 304's desk chair and its bed, the linen closet's corner).
## E on it sits you there or lays you down; E again, or a step, gets you up where you stood. While you're there the
## player's doing() says sitting, lying or hiding, which a cue (cue.gd) asks; a searcher (searcher.gd) checks a place
## to hide from its Approach (and Via) Marker3D children.
##
## Where your eye goes (DECISIONS 2026-11-12, after the close calls: "the camera adjust appropriately if we are on a
## chair or bed, sort of how a pov head would be, maybe slightly hovering above the bed as if the person's head was on
## a large pillow; if we drop a bed interactable on a bed prop it should calculate it based off the middle of the bed
## + height + length; similar with chairs, though since we can have stools maybe make the drop script have a height /
## pos adjuster for view"). With `fit` on it's worked out from the furniture:
##   which furniture   `furniture` when set; else this node's own meshes (the script on the prop itself); else what
##                     it's a child of (dropped onto a bed or a chair in the Scene tree: res://starter/seat_bed.tscn,
##                     seat_chair.tscn, seat_stool.tscn); else the furniture under it (an interior's export: put the
##                     node anywhere over the bed; its piece of the level is found and measured), else the solid
##                     box under it
##   lying             the middle of the bed across, 0.30 m in from its head end, 0.22 m over the mattress (a head on
##                     a large pillow), facing its foot. The head end is the one with a headboard; with none, the
##                     end behind this node's own -Z; `flip` the other one
##   sitting           the middle of the seat, a seated eye (0.75 m for a 1.6 m player) over it, facing away from
##                     its back; with no back (a stool, a bench) this node's own -Z; `flip` turns you round
##   seat_height       where you sit or lie, from the furniture's foot, when what's measured is wrong (a bar stool
##                     that's only a tall box: 0.75)
##   view_offset       the eye moved from there: x to your right, y up, z back, in metres; view_turn_deg turns you
## An interior's export makes each piece of furniture solid as one box to its top, a bed's to its headboard's: your
## head on the pillow would be inside it (every sound and every look at you stopped by its lid). So a seat whose eye
## would be in there takes that box out of the room's collider and puts a truer one in its place: solid to where you
## lie, and each side that stands over that (the headboard, a sofa's back). `carved` says it did.
## In the editor a small orange camera shows where the eye will be and which way it looks. With `fit` off, or nothing
## furniture-sized found, or pose hiding, the eye is where this node is, its -Z the way you face (as before), and E's
## box is `reach_size` at `reach_at`; fitted, E's box is the furniture's own.
## Your head on a seat turns like a head: `look_limit_deg` to each side (lying 75, sitting 125, hiding free).
## The box is on collision layer 2, the seats': the player's aim looks there, but your body walks, the sound travels
## and sight passes through it, so lying in the bed doesn't muffle the room round you.
extends Node3D

const LAYER := 2                                  ## collision layer 2 (its bit): only E's aim finds what's on it
const SIT_EYE := 0.75                             ## a seated eye over the seat, for a standing eye of 1.6 m
const PILLOW := 0.22                              ## lying: the eye over the mattress, a head on a large pillow
const HEAD_IN := 0.30                             ## lying: the eye in from the bed's head end
const CHAIR_SEAT := 0.45                          ## a chair's seat from the floor, when all there is is a box with its back

signal sat(by: Node)                              ## sat down or lay down
signal left(by: Node)                             ## up again

@export_enum("sitting", "lying", "hiding") var pose := "sitting"
@export_range(-30.0, 85.0) var look_up_deg := 0.0    ## the eye tilted up as you settle (lying on a pillow: 50; flat on your back: 70)
@export var say := ""                                ## a line as you settle
@export_group("View")
@export var fit := true                              ## work the eye out from the furniture (off: the eye is where this node is)
@export var furniture: NodePath                      ## the bed or the chair (empty: this node's own meshes, what it's a child of, or what's under it)
@export_range(0.0, 2.0, 0.01) var seat_height := 0.0 ## metres from the furniture's foot to where you sit or lie (0: measured; a bar stool: 0.75)
@export var view_offset := Vector3.ZERO              ## the eye moved: x to your right, y up, z back (metres)
@export_range(-180.0, 180.0) var view_turn_deg := 0.0   ## and turned (degrees, to your left)
@export var flip := false                            ## a bed: your head at its other end; a seat: facing the other way
@export_range(-1.0, 180.0) var look_limit_deg := -1.0   ## how far your head turns to each side there (-1: by the pose; 180: free)
@export_group("Reach")
@export var reach_size := Vector3(0.55, 0.9, 0.55)   ## the box E finds it by when it isn't fitted (a chair's: from the floor to over its back)
@export var reach_at := Vector3(0, -0.7, 0)           ## that box's middle, from here (a chair's eye is 1.2 m up)

var by: Node = null                               ## who's there
var uses := 0                                     ## times someone's been here (a searcher checks one used three times first)
var fitted := ""                                  ## what the eye was worked out from: "meshes", "collider", or "" (as placed)
var carved := false                               ## the furniture's one solid box was swapped for a truer one (see above)
var _under: Node3D = null                         # the furniture found under this node (an interior's piece)
var _under_at := Vector3.INF                      # where this node was when it was looked for
var _under_cs: CollisionShape3D = null            # the collider the ray down met
var _solid: StaticBody3D = null                   # the truer solid
var _shape: Dictionary = {}                       # the furniture measured in its own frame (meshes: kept; it may move)
var _shape_of: Node3D = null
var _body: StaticBody3D = null
var _box: BoxShape3D = null
var _marker: MeshInstance3D = null
var _tick := 0.0


func _ready() -> void:
	if Engine.is_editor_hint():
		show_marker()
		return
	_body = StaticBody3D.new()
	_body.name = "Reach"
	var shape := CollisionShape3D.new()
	_box = BoxShape3D.new()
	_box.size = reach_size
	shape.shape = _box
	_body.add_child(shape)
	_body.collision_layer = LAYER
	_body.collision_mask = 0
	_body.top_level = true
	add_child(_body)
	_place_reach()
	await get_tree().physics_frame                 # (what's under it is found by a ray: the world's colliders first)
	await get_tree().physics_frame
	_place_reach()
	_carve()


func _process(dt: float) -> void:
	_tick += dt
	if _tick < 0.4:
		return
	_tick = 0.0
	if Engine.is_editor_hint():
		show_marker()
	elif by == null:
		_place_reach()                             # (a chair that's been shoved: E's box goes with it)


## E: there, or up again
func use(p: Node = null) -> void:
	if p == null:
		p = get_tree().get_first_node_in_group("hs_player")
	if p == null or not p.has_method("settle"):
		return
	if by != null:
		leave()
		return
	by = p
	uses += 1
	p.settle(self)
	if say != "":
		var st := get_tree().get_first_node_in_group("hs_story")
		if st != null:
			st.say(say)
	sat.emit(p)


## up again, where they stood
func leave() -> void:
	if by == null:
		return
	var p := by
	by = null
	if p.has_method("rise"):
		p.rise()
	left.emit(p)


## Where the eye goes and which way it faces (its -Z), in the world: worked out from the furniture, or this node as
## placed. `eye_h` is the player's standing eye height: a seated eye is that much of an adult's.
func eye_transform(eye_h := 1.6) -> Transform3D:
	var box := _measure()
	var at := global_position
	var dir := -global_basis.z
	if not box.is_empty():
		var fr: Transform3D = box["frame"]
		var lo: Vector3 = box["lo"]
		var hi: Vector3 = box["hi"]
		var mid := (lo + hi) * 0.5
		var top: float = lo.y + seat_height if seat_height > 0.0 else float(box["top"])
		var mine := fr.basis.inverse() * (-global_basis.z)          # this node's own facing, in the furniture's frame
		mine.y = 0.0
		if pose == "lying":
			var along := Vector3.RIGHT if hi.x - lo.x >= hi.z - lo.z else Vector3.BACK
			var half: float = (hi - lo).dot(along) * 0.5
			var head: float = float(box["head"])                     # which end the headboard's at (0: none found)
			if head == 0.0:
				head = 1.0 if mine.dot(along) <= 0.3 else -1.0       # behind the way this node faces
			if flip:
				head = -head
			var l := mid + along * head * maxf(0.0, half - HEAD_IN)
			l.y = top + PILLOW * eye_h / 1.6
			at = fr * l
			dir = fr.basis * (along * -head)
		else:
			var back: Vector3 = box["back"]                          # the side its back is on (zero: none found)
			var face := -back if back != Vector3.ZERO else (mine.normalized() if mine.length() > 0.05 else Vector3.FORWARD)
			if flip:
				face = -face
			var s := Vector3(mid.x, top + SIT_EYE * eye_h / 1.6, mid.z)
			if back != Vector3.ZERO:                                 # the seat's own middle: the footprint less its back
				var c: Vector3 = box["seat_mid"]
				s.x = c.x
				s.z = c.z
			at = fr * s
			dir = fr.basis * face
	dir.y = 0.0
	if dir.length() < 0.001:
		dir = Vector3.FORWARD
	var yaw := atan2(-dir.x, -dir.z) + deg_to_rad(view_turn_deg)
	var b := Basis(Vector3.UP, yaw)
	return Transform3D(b, at + b * view_offset)


## How far a head turns there, in degrees: x to each side, y down, z up.
func look_limits() -> Vector3:
	var side := look_limit_deg
	if side < 0.0:
		side = 75.0 if pose == "lying" else (125.0 if pose == "sitting" else 180.0)
	if pose == "lying":
		return Vector3(side, 5.0, 80.0)
	return Vector3(side, 80.0, 80.0)


## What it found, a check's: {fitted, eye, facing, top, size}
func report() -> Dictionary:
	var box := _measure()
	var t := eye_transform()
	return {"fitted": fitted, "eye": t.origin, "facing": -t.basis.z, "top": (float(box["top"]) if not box.is_empty() else 0.0),
		"size": ((box["hi"] as Vector3) - (box["lo"] as Vector3)) if not box.is_empty() else Vector3.ZERO,
		"head": float(box.get("head", 0.0)), "back": box.get("back", Vector3.ZERO), "carved": carved}


# ---- the furniture, measured -------------------------------------------------------------------------------------

# furniture-sized: not a whole room's mesh, not a pebble
func _sized(lo: Vector3, hi: Vector3) -> bool:
	var s := hi - lo
	return maxf(s.x, s.z) <= 3.6 and maxf(s.x, s.z) >= 0.2 and s.y <= 2.7 and s.y >= 0.05


# the furniture's box in a frame of its own: {frame, lo, hi, top, head, back, seat_mid}; empty: as placed
func _measure() -> Dictionary:
	fitted = ""
	if not fit or pose == "hiding" or not is_inside_tree():
		return {}
	var root: Node3D = null
	if not furniture.is_empty():
		root = get_node_or_null(furniture) as Node3D
	elif _has_meshes(self):
		root = self
	elif get_parent() is Node3D and _has_meshes(get_parent()):
		root = get_parent() as Node3D
	if root != null:
		if _shape_of != root or Engine.is_editor_hint():   # (measured once: it may move, it doesn't change shape)
			_shape = _from_meshes(root)
			_shape_of = root
		if not _shape.is_empty():
			var out := _shape.duplicate()
			out["frame"] = _frame(root.global_transform)
			fitted = "meshes"
			return out
		if not furniture.is_empty():                   # no meshes under it: its colliders
			var c := _from_shapes(root)
			if not c.is_empty():
				fitted = "collider"
				return c
	if Engine.is_editor_hint():
		return {}
	return _from_under()                               # (it says what it was fitted from)


func _frame(t: Transform3D) -> Transform3D:
	return Transform3D(t.basis.orthonormalized(), t.origin)


func _has_meshes(n: Node) -> bool:
	for m in n.find_children("*", "MeshInstance3D", true, false):
		if m != _marker and (m as MeshInstance3D).mesh != null:
			return true
	return n is MeshInstance3D and (n as MeshInstance3D).mesh != null


# every corner of every triangle under `root`, in its frame; then where you'd sit or lie and which end is which
func _from_meshes(root: Node3D) -> Dictionary:
	var inv := _frame(root.global_transform).affine_inverse()
	var pts := PackedVector3Array()
	var list: Array = root.find_children("*", "MeshInstance3D", true, false)
	if root is MeshInstance3D:
		list.append(root)
	var rough := AABB()                                # its bounds first, cheaply: a room of things isn't furniture
	var any := false
	for m in list:
		var mi := m as MeshInstance3D
		if mi == _marker or mi.mesh == null or not mi.visible:
			continue
		var bb: AABB = (inv * mi.global_transform) * mi.get_aabb()
		rough = bb if not any else rough.merge(bb)
		any = true
	if not any or not _sized(rough.position, rough.end):
		return {}
	for m in list:
		var mi := m as MeshInstance3D
		if mi == _marker or mi.mesh == null or not mi.visible:
			continue
		var t := inv * mi.global_transform
		var f := mi.mesh.get_faces()                   # points over each triangle, not its corners alone (a box's top is two)
		for i in range(0, f.size() - 2, 3):
			var pa := t * f[i]
			var pb := t * f[i + 1]
			var pc := t * f[i + 2]
			var n := clampi(int(ceil(maxf(pa.distance_to(pb), maxf(pb.distance_to(pc), pc.distance_to(pa))) / 0.06)), 1, 24)
			for u in n + 1:
				for w in n + 1 - u:
					pts.append(pa + (pb - pa) * (float(u) / n) + (pc - pa) * (float(w) / n))
	if pts.is_empty():
		return {}
	var lo := pts[0]
	var hi := pts[0]
	for p in pts:
		lo = lo.min(p)
		hi = hi.max(p)
	if not _sized(lo, hi):
		return {}
	var mid := (lo + hi) * 0.5
	var sx := hi.x - lo.x
	var sz := hi.z - lo.z
	# the highest thing in the middle of it: the mattress, the seat (a headboard or a back is at an edge)
	var top := lo.y
	for p in pts:
		if absf(p.x - mid.x) <= sx * 0.22 and absf(p.z - mid.z) <= sz * 0.22:
			top = maxf(top, p.y)
	# how high each side stands over that along its whole length: a headboard, a back (five stretches a side, the
	# second lowest of them: a back's corner post at the end of an arm isn't a back, a gap between spindles is no gap)
	var sides := [Vector3.RIGHT, Vector3.LEFT, Vector3.BACK, Vector3.FORWARD]
	var bins := []
	for i in 4:
		bins.append([lo.y, lo.y, lo.y, lo.y, lo.y])
	for p in pts:
		var bx := clampi(int((p.x - lo.x) / maxf(sx, 0.001) * 5.0), 0, 4)
		var bz := clampi(int((p.z - lo.z) / maxf(sz, 0.001) * 5.0), 0, 4)
		if p.x >= hi.x - sx * 0.12: bins[0][bz] = maxf(bins[0][bz], p.y)
		if p.x <= lo.x + sx * 0.12: bins[1][bz] = maxf(bins[1][bz], p.y)
		if p.z >= hi.z - sz * 0.12: bins[2][bx] = maxf(bins[2][bx], p.y)
		if p.z <= lo.z + sz * 0.12: bins[3][bx] = maxf(bins[3][bx], p.y)
	var rise := {}
	for i in 4:
		var b: Array = bins[i]
		b.sort()
		rise[sides[i]] = float(b[1])
	var head := 0.0
	var plus: float = rise[Vector3.RIGHT] if sx >= sz else rise[Vector3.BACK]      # a bed's long way: its two ends
	var minus: float = rise[Vector3.LEFT] if sx >= sz else rise[Vector3.FORWARD]
	if plus - top > 0.12 and plus > minus + 0.05:
		head = 1.0
	elif minus - top > 0.12 and minus > plus + 0.05:
		head = -1.0
	var back := Vector3.ZERO
	var best := top + 0.2                                                   # a back stands a hand over the seat
	for side in rise:
		if float(rise[side]) > best:
			best = float(rise[side])
			back = side
	var seat_mid := mid
	if back != Vector3.ZERO:                                                # the seat is what's in front of its back
		var depth := sx if back.x != 0.0 else sz
		seat_mid = mid - back * depth * 0.06
	return {"lo": lo, "hi": hi, "top": top, "head": head, "back": back, "seat_mid": seat_mid, "rise": rise}


# a collider's box, all there is of the furniture: its top is where you lie; a seat's is its top, or a chair's 0.45 m
# when the box is tall enough to be a chair with its back
func _from_box(fr: Transform3D, lo: Vector3, hi: Vector3) -> Dictionary:
	if not _sized(lo, hi):
		return {}
	var top := hi.y
	if pose == "sitting" and hi.y - lo.y > 0.62:
		top = lo.y + CHAIR_SEAT
	return {"frame": fr, "lo": lo, "hi": hi, "top": top, "head": 0.0, "back": Vector3.ZERO, "seat_mid": (lo + hi) * 0.5}


func _shape_box(cs: CollisionShape3D) -> Dictionary:
	if cs == null or cs.shape == null:
		return {}
	var sc := cs.global_basis.get_scale()
	var lo := Vector3.ZERO
	var hi := Vector3.ZERO
	if cs.shape is BoxShape3D:
		hi = (cs.shape as BoxShape3D).size * 0.5 * sc
		lo = -hi
	else:
		var pts := PackedVector3Array()
		if cs.shape is ConcavePolygonShape3D:
			pts = (cs.shape as ConcavePolygonShape3D).get_faces()
		elif cs.shape is ConvexPolygonShape3D:
			pts = (cs.shape as ConvexPolygonShape3D).points
		if pts.is_empty():
			return {}
		lo = pts[0] * sc
		hi = lo
		for p in pts:
			lo = lo.min(p * sc)
			hi = hi.max(p * sc)
	return _from_box(_frame(cs.global_transform), lo, hi)


func _from_shapes(root: Node3D) -> Dictionary:
	for c in root.find_children("*", "CollisionShape3D", true, false):
		var b := _shape_box(c as CollisionShape3D)
		if not b.is_empty():
			return b
	return {}


# what's under this node: the furniture's own meshes when they can be found (an interior's export: each piece of
# furniture a node of meshes, the room's collider one mesh of boxes), else the solid box alone
func _from_under() -> Dictionary:
	var w := get_world_3d()
	if w == null:
		return {}
	var q := PhysicsRayQueryParameters3D.create(global_position + Vector3.UP * 0.6, global_position + Vector3.DOWN * 2.6, 1)
	q.hit_from_inside = true                           # (a node set inside the bed's box still finds the bed)
	var skip: Array[RID] = []
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		skip.append((pl as CollisionObject3D).get_rid())
	if _solid != null:
		skip.append(_solid.get_rid())
	q.exclude = skip
	if _under == null or _under_at != global_position:
		_under_at = global_position
		_under = null
		_under_cs = null
		var hit := w.direct_space_state.intersect_ray(q)
		if hit.is_empty() or not (hit["collider"] is CollisionObject3D):
			return {}
		var co := hit["collider"] as CollisionObject3D
		_under_cs = co.shape_owner_get_owner(co.shape_find_owner(int(hit["shape"]))) as CollisionShape3D
		_under = _piece_at(co, hit["position"])
	if _under != null and is_instance_valid(_under):
		if _shape_of != _under:
			_shape = _from_meshes(_under)
			_shape_of = _under
		if not _shape.is_empty():
			var out := _shape.duplicate()
			out["frame"] = _frame(_under.global_transform)
			fitted = "meshes"
			return out
	var box := _shape_box(_under_cs) if is_instance_valid(_under_cs) else {}
	if not box.is_empty():
		fitted = "collider"
	return box


# the piece of furniture whose meshes are at `p` (where the ray down met something solid): searched in the scene the
# collider came with (an instanced interior), a mesh alone or a node of meshes, furniture-sized, the biggest footprint
func _piece_at(co: Node, p: Vector3) -> Node3D:
	var top: Node = co
	while top.get_parent() != null and top.get_parent() != get_tree().root and top.scene_file_path == "":
		top = top.get_parent()
	var best: Node3D = null
	var best_area := 0.0
	var seen := {}
	for m in top.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		if mi.mesh == null or mi == _marker or not mi.is_visible_in_tree():
			continue
		var bb: AABB = mi.global_transform * mi.get_aabb()
		if p.x < bb.position.x - 0.02 or p.x > bb.end.x + 0.02 or p.z < bb.position.z - 0.02 or p.z > bb.end.z + 0.02 \
				or bb.end.y > p.y + 0.08 or bb.end.y < p.y - 1.5:      # under where the ray met its solid, not far under
			continue
		var cands: Array = [mi]
		if mi.get_parent() is Node3D and mi.get_parent() != top:
			cands.append(mi.get_parent())
		for c in cands:
			if seen.has(c):
				continue
			seen[c] = true
			var u := bb
			if c != mi:
				for o in (c as Node).find_children("*", "MeshInstance3D", true, false):
					if (o as MeshInstance3D).mesh != null:
						u = u.merge((o as MeshInstance3D).global_transform * (o as MeshInstance3D).get_aabb())
			var long := maxf(u.size.x, u.size.z)
			if absf(u.end.y - p.y) > 0.08:                 # the solid is this thing's own box: their tops are one
				continue
			if long > 3.6 or u.size.y > 2.7 or (pose == "lying" and long < 1.2) or (pose != "lying" and (long < 0.25 or u.size.y < 0.2)):
				continue
			if u.size.x * u.size.z >= best_area:
				best_area = u.size.x * u.size.z
				best = c as Node3D
	return best


# the furniture's one solid box (to its headboard's top) out of the room's collider, a truer one in: only when the
# eye would be inside it, and only when the box is found whole (its twelve triangles on the furniture's own bounds)
func _carve() -> void:
	if carved or fitted != "meshes" or _under == null or not is_instance_valid(_under_cs) or not (_under_cs.shape is ConcavePolygonShape3D):
		return
	var box := _measure()
	if box.is_empty():
		return
	var fr: Transform3D = box["frame"]
	var lo: Vector3 = box["lo"]
	var hi: Vector3 = box["hi"]
	var top: float = lo.y + seat_height if seat_height > 0.0 else float(box["top"])
	var eye_up := top + (PILLOW if pose == "lying" else SIT_EYE)
	if eye_up > hi.y + 0.05:                           # the eye's over it anyway (a chair)
		return
	var f := (_under_cs.shape as ConcavePolygonShape3D).get_faces()
	var inv := fr.affine_inverse() * _under_cs.global_transform
	var keep := PackedVector3Array()
	var n := 0
	for i in range(0, f.size() - 2, 3):
		var on := true
		for k in 3:
			var p := inv * f[i + k]
			for a in 3:
				if absf(p[a] - lo[a]) > 0.015 and absf(p[a] - hi[a]) > 0.015:
					on = false
		if on:
			n += 1
		else:
			keep.append(f[i])
			keep.append(f[i + 1])
			keep.append(f[i + 2])
	if n != 12:
		return
	if keep.is_empty():
		_under_cs.disabled = true
	else:
		var sh := _under_cs.shape.duplicate() as ConcavePolygonShape3D   # (the imported scene's own shape stays whole)
		sh.set_faces(keep)
		_under_cs.shape = sh
	_solid = StaticBody3D.new()
	_solid.name = "Solid"
	_solid.top_level = true
	var parts: Array = [[lo, Vector3(hi.x, top, hi.z)]]                  # to where you lie
	var rise: Dictionary = box.get("rise", {})
	for side in rise:                                                     # and each side standing over that
		var h := float(rise[side])
		if h < top + 0.1:
			continue
		var a := lo
		var b := hi
		var d: Vector3 = side
		if d.x > 0.0: a.x = hi.x - minf(0.1, (hi.x - lo.x) * 0.12)
		elif d.x < 0.0: b.x = lo.x + minf(0.1, (hi.x - lo.x) * 0.12)
		elif d.z > 0.0: a.z = hi.z - minf(0.1, (hi.z - lo.z) * 0.12)
		else: b.z = lo.z + minf(0.1, (hi.z - lo.z) * 0.12)
		parts.append([Vector3(a.x, top, a.z), Vector3(b.x, h, b.z)])
	for part in parts:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = (part[1] as Vector3) - (part[0] as Vector3)
		cs.shape = bs
		cs.position = ((part[0] as Vector3) + (part[1] as Vector3)) * 0.5
		_solid.add_child(cs)
	add_child(_solid)
	_solid.global_transform = fr
	carved = true


# ---- E's box, and the editor's marker ----------------------------------------------------------------------------

# E's box: the furniture's own when it's fitted (a little bigger, so the aim meets it before the furniture's
# collider), else reach_size at reach_at from here
func _place_reach() -> void:
	if _body == null:
		return
	var box := _measure()
	if box.is_empty():
		_box.size = reach_size
		_body.global_transform = Transform3D(global_basis.orthonormalized(), global_transform * reach_at)
		return
	var lo: Vector3 = box["lo"]
	var hi: Vector3 = box["hi"]
	hi.y = maxf(hi.y, float(box["top"]) + 0.3)
	_box.size = (hi - lo) + Vector3(0.08, 0.04, 0.08)
	_body.global_transform = (box["frame"] as Transform3D) * Transform3D(Basis(), (lo + hi) * 0.5)


## A small camera where the eye will be (the editor draws it by itself; a check can ask for it).
func show_marker() -> MeshInstance3D:
	if _marker == null:
		_marker = MeshInstance3D.new()
		_marker.name = "_EyeMarker"
		_marker.top_level = true
		_marker.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var im := ImmediateMesh.new()
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.albedo_color = Color(1.0, 0.55, 0.1)
		mat.no_depth_test = true
		im.surface_begin(Mesh.PRIMITIVE_LINES, mat)
		var c := [Vector3(-0.16, 0.09, -0.3), Vector3(0.16, 0.09, -0.3), Vector3(0.16, -0.09, -0.3), Vector3(-0.16, -0.09, -0.3)]
		for i in 4:
			im.surface_add_vertex(Vector3.ZERO)
			im.surface_add_vertex(c[i])
			im.surface_add_vertex(c[i])
			im.surface_add_vertex(c[(i + 1) % 4])
		im.surface_add_vertex(Vector3(0, 0.09, -0.3))                       # which way is up
		im.surface_add_vertex(Vector3(0, 0.15, -0.3))
		im.surface_end()
		_marker.mesh = im
		add_child(_marker, false, Node.INTERNAL_MODE_BACK)
	var t := eye_transform()
	_marker.global_transform = Transform3D(t.basis * Basis(Vector3.RIGHT, deg_to_rad(look_up_deg)), t.origin)
	return _marker
