@tool
@icon("res://addons/horrorstudio_weapons/icons/blow_up.svg")
class_name HSBlowUp
extends Node3D
## Anything that breaks when it's shot (DECISIONS 2026-11-09, latest: "lets any object we attach be blow up by shotgun
## shots, e.g. a kettle, a box, but it should look like the object itself got destroyed"): put one under a kettle, a box,
## a mug, a crate. When the thing loads, its own meshes are cut into pieces in a worker thread (HSFracture); when a
## shot's damage passes its strength it's swapped for them in a frame: its own materials on every piece, the broken faces
## drawn by its kind's inside, small pieces where it was hit and big ones away from it, flying out along the shot, the
## pellets' holes going with them, its dust, bits and sound. Weaker shots dent metal, card and plastic and wear it down.
## docs/research/breaking_props.md.
##
## What it's made of is its `kind` (HSBreakKind; the plugin's ceramic, glass, wood, metal, cardboard, plastic and stone
## in blowup/kinds/), guessed from its name, its materials and its hs_surface when it isn't given. A made prop's parts
## (a lid on its hinge) and its contents (a box's shells: parts made of materials the rest isn't) fly off whole; its
## liquid splashes. A thing with no collider gets one (a hull round its meshes), so the pellets find it. Bigger pieces are
## rigid bodies whose colliders are at least 5 cm thick (thinner sinks through a level's floor: LESSONS), laid down onto
## the floor when they come to rest; little ones fall by rays, as the gun's hulls do. The player's feet push them.
## `blow_up()` breaks it from a script (a cue); `restore()` puts it back. `preview` shows its pieces in the editor.

signal prepared                                   ## its pieces are cut and ready
signal hit(info: Dictionary)                      ## a shot that didn't break it: {damage, worn, point, pellets, dented}
signal blown_up(pieces: Array)                    ## it broke: its pieces (rigid bodies, and the little ones' nodes)

const DIR := "res://addons/horrorstudio_weapons/"
const MIN_THICK := 0.06                           # a piece's collider at least this thick along each of its axes
const TINY := 0.045                               # a piece smaller than this (its radius) falls by rays (a smaller rigid body
                                                  # landing fast sinks through a level's floor: LESSONS)
const KINDS := ["ceramic", "glass", "wood", "metal", "cardboard", "plastic", "stone"]

@export var kind: HSBreakKind                     ## what it's made of (none: guessed: its name, its materials, its hs_surface)
@export var strength := -1.0                      ## a shot's damage that breaks it (below 0: its kind's; a buckshot pellet's is 1)
@export_range(0, 64) var pieces := 0              ## how many pieces it's cut into (0: its kind's, by its size)
@export var whole: Array[Node3D] = []             ## parts that fly off whole (a made prop's parts and contents always do)
@export var liquid := Color(0, 0, 0, 0)           ## what's in it, splashed when it breaks (alpha 0: a made prop's own liquid, if any)
@export var push := 1.0                           ## times its kind's speed
@export var keep_s := 0.0                         ## its pieces cleared after this long (0: they stay, the mess it left)
@export var kick := true                          ## the player's feet push the pieces they walk into
@export var target: Node                          ## its fire() when it breaks (a scare, a cue)
@export var collider := true                      ## a hull round its meshes to be shot, when it has no collider of its own
@export var preview := false:                     ## in the editor: its pieces drawn apart round it (nothing saved)
	set(v):
		preview = v
		_preview()
@export var preview_spread := 0.35                ## how far apart, of its size

var damage := 0.0                                 ## worn so far by shots that didn't break it
var is_broken := false
var pieces_out: Array = []                        ## its pieces once broken
var last := {}                                    ## the last break, a check's (see blow_up)

var _k: HSBreakKind
var _task := -1
var _fr: HSFracture
var _res := {}
var _done := false
var _mats: Array = []
var _area: PackedFloat32Array = PackedFloat32Array()
var _inside: ShaderMaterial
var _avg := Color(0.7, 0.7, 0.7)
var _intact: Array = []                           # each mesh as it was: {mi, mesh, xf, arrays}
var _dents: Array = []                            # [where, way, depth, radius] in the thing's space
var _whole_nodes: Array = []
var _liquids: Array = []
var _solid: Array = []
var _rigid: Array = []
var _bits: Array = []
var _container: Node3D
var _guns: Array = []
var _t := 0.0
var _clinks := 0
var _clink_t := 0.0
var _broke_s := 0.0
var _chip_meshes := {}
var _fell := 0
var _unsunk := 0                                     # pieces put back on top of a floor they'd gone under (a check's)
var _puff: Mesh


func _ready() -> void:
	if Engine.is_editor_hint():
		if preview:
			_preview.call_deferred()
		return
	add_to_group("hs_shootable")                  # (a blast reaching its thing counts it as hit: HSImpacts)
	add_to_group("hs_blowup")
	var host := get_parent() as Node3D
	if host == null:
		push_warning("HSBlowUp: put it under the thing that breaks (a Node3D).")
		return
	_k = _kind_of(host)
	_find_parts(host)
	_listen()
	_prepare.call_deferred()


func _exit_tree() -> void:
	if _task >= 0:
		WorkerThreadPool.wait_for_task_completion(_task)
		_task = -1


func _process(dt: float) -> void:
	if Engine.is_editor_hint():
		return
	_t += dt
	if _t > 0.5:                                  # (a gun made after this: listened to once it's there)
		_t = 0.0
		_listen()
	if _task >= 0 and WorkerThreadPool.is_task_completed(_task):
		_finish()
	_clink_t = maxf(_clink_t - dt, 0.0)
	if is_broken and keep_s > 0.0 and Time.get_ticks_msec() / 1000.0 - _broke_s > keep_s:
		_clear_pieces()


## Whether its pieces are cut and ready (it can still be shot before: it waits for them then).
func is_prepared() -> bool:
	return _done


## What it is, a check's: its kind, strength, pieces cut, worn, broken.
func report() -> Dictionary:
	return {"kind": _k.id if _k != null else "", "strength": _strength(), "prepared": _done, "damage": damage,
		"broken": is_broken, "leaves": (_res.get("leaves", []) as Array).size(), "whole": (_res.get("whole", []) as Array).size(),
		"cut": _res.get("report", {}), "dents": _dents.size(), "fell": _fell, "unsunk": _unsunk}


# ---- what it's made of ------------------------------------------------------------------------------------------

func _kind_of(host: Node) -> HSBreakKind:
	if kind != null:
		return kind
	var id := guess_kind(host)
	var r = load(DIR + "blowup/kinds/%s.tres" % id)
	return r if r is HSBreakKind else HSBreakKind.new()


func _strength() -> float:
	return strength if strength > 0.0 else (_k.strength if _k != null else 1.5)


## What a thing is made of, by its hs_surface (or acoustic) metadata, its name and its meshes' and materials' names,
## its materials (metallic, see-through): one of KINDS.
static func guess_kind(host: Node) -> String:
	var by_meta := {"metal": "metal", "sheet_metal": "metal", "steel": "metal", "glass": "glass", "wood": "wood", "door": "wood",
		"tatami": "wood", "plastic": "plastic", "ceramic": "ceramic", "tile": "ceramic", "stone": "stone", "concrete": "stone",
		"cardboard": "cardboard", "paper": "cardboard", "cloth": "cardboard", "carpet": "cardboard"}
	var nodes: Array = [host] + host.find_children("*", "CollisionObject3D", true, false)
	for n in nodes:
		for key in ["hs_surface", "acoustic"]:
			if (n as Node).has_meta(key) and by_meta.has(str(n.get_meta(key))):
				return by_meta[str(n.get_meta(key))]
	var words := str(host.name).to_lower()
	var meshes := host.find_children("*", "MeshInstance3D", true, false)
	if host is MeshInstance3D:
		meshes.append(host)
	for mi in meshes:
		words += " " + str(mi.name).to_lower()
		var mesh: Mesh = (mi as MeshInstance3D).mesh
		if mesh == null:
			continue
		for s in mesh.get_surface_count():
			var m := (mi as MeshInstance3D).get_active_material(s)
			if m != null:
				words += " " + m.resource_name.to_lower() + " " + m.resource_path.get_file().to_lower()
	var table := [
		["metal", ["kettle", "stockpot", "saucepan", "frying", "pan_", "_pan", "can_", "_can", "soda", "bucket", "lantern",
			"metal", "steel", "iron", "enamel", "chrome", "toolbox", "tin_"]],
		["glass", ["bottle", "glass", "jar", "window", "mirror", "pane"]],
		["ceramic", ["mug", "teapot", "teacup", "plate", "bowl", "vase", "ceramic", "porcelain", "stoneware", "pottery",
			"terracotta", "pot_", "tile", "cup"]],
		["wood", ["crate", "chair", "table", "stool", "plank", "wood", "shelf", "drawer", "cabinet", "barrel", "pallet"]],
		["cardboard", ["box", "carton", "card", "paper", "book", "parcel", "package"]],
		["stone", ["rock", "stone", "brick", "statue", "concrete", "marble", "boulder"]],
		["plastic", ["plastic"]]]
	for row in table:
		for w in row[1]:
			if words.contains(w):
				return row[0]
	for mi in meshes:
		var mesh: Mesh = (mi as MeshInstance3D).mesh
		if mesh == null or mesh.get_surface_count() == 0:
			continue
		var m := (mi as MeshInstance3D).get_active_material(0)
		if m is BaseMaterial3D:
			if (m as BaseMaterial3D).metallic >= 0.5:
				return "metal"
			if (m as BaseMaterial3D).transparency != BaseMaterial3D.TRANSPARENCY_DISABLED and (m as BaseMaterial3D).roughness < 0.25:
				return "glass"
	return "plastic"


# its parts that go whole (the list, a made prop's propgen_part nodes) and its liquids (a made prop's <name>_liquid)
func _find_parts(host: Node) -> void:
	_whole_nodes.clear()
	_liquids.clear()
	for n in whole:
		if n != null and is_instance_valid(n):
			_whole_nodes.append(n)
	for n in host.find_children("*", "Node3D", true, false):
		if _under_other(n, host):
			continue
		var ex: Dictionary = n.get_meta("extras", {}) if n.has_meta("extras") else {}
		if n is MeshInstance3D and (str(n.name).ends_with("_liquid") or ex.has("propgen_liquid")):
			_liquids.append(n)
		elif ex.has("propgen_part") and not _whole_nodes.has(n):
			_whole_nodes.append(n)


# is n another HSBlowUp's (a breakable thing inside this one breaks on its own)
func _under_other(n: Node, host: Node) -> bool:
	var k := n
	while k != null and k != host:
		for c in k.get_children():
			if c is HSBlowUp and c != self:
				return true
		k = k.get_parent()
	return false


# the meshes it's cut from: under it, drawn, not a part that goes whole, not its liquid, not another HSBlowUp's
func _meshes(host: Node) -> Array:
	var out: Array = []
	var stack: Array = [host]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		if n != host:
			if n == self or n is HSBlowUp or _whole_nodes.has(n) or _liquids.has(n):
				continue
			if n is Node3D and not (n as Node3D).visible:
				continue
			var own := false
			for c in n.get_children():
				if c is HSBlowUp and c != self:
					own = true
			if own:
				continue
		if n is MeshInstance3D and (n as MeshInstance3D).mesh != null and not n.has_meta("_hs_preview"):
			out.append(n)
		for c in n.get_children():
			stack.append(c)
	return out


# ---- cut when it loads ------------------------------------------------------------------------------------------

func _prepare() -> void:
	if _task >= 0 or _done or not is_inside_tree():
		return
	var host := get_parent() as Node3D
	var rd := _read(host)
	if (rd["src"] as Array).is_empty():
		push_warning("HSBlowUp: %s has no mesh to break." % host.name)
		return
	_add_collider(host, rd)
	_avg = _average_color()
	_inside = _make_inside()
	_fr = HSFracture.new()
	var size: float = rd["size"]
	_fr.pieces = _fine_count(size)
	_fr.grain = _k.grain
	_fr.crumple_m = _k.crumple_m
	_fr.hollow = _k.hollow
	_fr.seed = absi(hash(str(host.name))) % 100000 + 7
	_task = WorkerThreadPool.add_task(_cut.bind(rd["src"]), true, "HSBlowUp: cutting %s" % host.name)   # (high: a low one waits behind the game's own)


# how many it's cut into: finer than it breaks into (a break keeps the cuts away from the hit together), by its size
func _fine_count(size: float) -> int:
	var want := float(pieces) if pieces > 0 else float(_k.pieces) * sqrt(clampf(size / 0.25, 0.12, 4.0))
	return clampi(roundi(want * 2.5), 6, 96)


# (in a worker thread: plain data only)
func _cut(src: Array) -> void:
	_res = _fr.run(src)


# its meshes read into its own space (where it stands and how it's turned, its scale kept in the numbers), each
# surface's material kept
func _read(host: Node3D) -> Dictionary:
	var F := host.global_transform.orthonormalized()
	var finv := F.affine_inverse()
	var src: Array = []
	_mats.clear()
	_area = PackedFloat32Array()
	_intact.clear()
	var bb := AABB()
	var first := true
	for mi in _meshes(host):
		var m := mi as MeshInstance3D
		var xf := finv * m.global_transform
		var flip := xf.basis.determinant() < 0.0
		var nxf := Transform3D(xf.basis.inverse().transposed(), Vector3.ZERO)
		var keep: Array = []
		for s in m.mesh.get_surface_count():
			if m.mesh.surface_get_primitive_type(s) != Mesh.PRIMITIVE_TRIANGLES:
				keep.append(null)
				continue
			var arr := m.mesh.surface_get_arrays(s)
			keep.append(arr)
			var P0 = arr[Mesh.ARRAY_VERTEX]
			if not (P0 is PackedVector3Array) or (P0 as PackedVector3Array).is_empty():
				continue
			var P: PackedVector3Array = xf * (P0 as PackedVector3Array)
			var N := PackedVector3Array()
			if arr[Mesh.ARRAY_NORMAL] is PackedVector3Array and (arr[Mesh.ARRAY_NORMAL] as PackedVector3Array).size() == P.size():
				N = nxf * (arr[Mesh.ARRAY_NORMAL] as PackedVector3Array)
				for i in N.size():
					N[i] = N[i].normalized()
			var T := PackedFloat32Array()
			if arr[Mesh.ARRAY_TANGENT] is PackedFloat32Array and (arr[Mesh.ARRAY_TANGENT] as PackedFloat32Array).size() == P.size() * 4:
				T = (arr[Mesh.ARRAY_TANGENT] as PackedFloat32Array).duplicate()
				for i in P.size():
					var tv := (xf.basis * Vector3(T[i * 4], T[i * 4 + 1], T[i * 4 + 2])).normalized()
					T[i * 4] = tv.x
					T[i * 4 + 1] = tv.y
					T[i * 4 + 2] = tv.z
					if flip:
						T[i * 4 + 3] = -T[i * 4 + 3]
			var I := PackedInt32Array()
			if arr[Mesh.ARRAY_INDEX] is PackedInt32Array and not (arr[Mesh.ARRAY_INDEX] as PackedInt32Array).is_empty():
				I = arr[Mesh.ARRAY_INDEX]
			else:
				I.resize(P.size())
				for i in P.size():
					I[i] = i
			var U = arr[Mesh.ARRAY_TEX_UV]
			var U2 = arr[Mesh.ARRAY_TEX_UV2]
			var C = arr[Mesh.ARRAY_COLOR]
			src.append({"P": P, "N": N, "T": T, "I": I,
				"U": U if U is PackedVector2Array else PackedVector2Array(),
				"U2": U2 if U2 is PackedVector2Array else PackedVector2Array(),
				"C": C if C is PackedColorArray else PackedColorArray()})
			_mats.append(_material(m, s))
			var a := 0.0
			for t in range(0, I.size(), 3):
				a += (P[I[t + 1]] - P[I[t]]).cross(P[I[t + 2]] - P[I[t]]).length() * 0.5
			_area.append(a)
			for p in P:
				if first:
					bb = AABB(p, Vector3.ZERO)
					first = false
				bb = bb.expand(p)
		_intact.append({"mi": m, "mesh": m.mesh, "xf": xf, "arrays": keep})
	return {"src": src, "size": bb.size.length(), "aabb": bb, "F": F}


# a surface's material for its pieces: its own, unless it's laid in the world's space (a world triplanar would slide
# over a piece as it flies): then the thing's own space
func _material(m: MeshInstance3D, s: int) -> Material:
	var mat := m.get_active_material(s)
	if mat is BaseMaterial3D and ((mat as BaseMaterial3D).uv1_world_triplanar or (mat as BaseMaterial3D).uv2_world_triplanar):
		mat = mat.duplicate()
		(mat as BaseMaterial3D).uv1_world_triplanar = false
		(mat as BaseMaterial3D).uv2_world_triplanar = false
	return mat


# a hull round its meshes to be shot, when nothing under it is solid; its hs_surface on whatever is (the marks a pellet
# leaves on it, HSImpacts)
func _add_collider(host: Node3D, rd: Dictionary) -> void:
	var cols: Array = []
	if host is CollisionObject3D:
		cols.append(host)
	for n in host.find_children("*", "CollisionObject3D", true, false):
		if not _under_other(n, host):
			cols.append(n)
	if cols.is_empty() and collider:
		var pts := PackedVector3Array()
		var to_host: Transform3D = host.global_transform.affine_inverse() * (rd["F"] as Transform3D)
		for sf in rd["src"]:
			var P: PackedVector3Array = sf["P"]
			var step := maxi(1, P.size() / 400)
			for i in range(0, P.size(), step):
				pts.append(to_host * P[i])
		for n in _whole_nodes:
			for mi in [n] + (n as Node).find_children("*", "MeshInstance3D", true, false):
				if mi is MeshInstance3D and (mi as MeshInstance3D).mesh != null:
					var xf: Transform3D = host.global_transform.affine_inverse() * (mi as MeshInstance3D).global_transform
					var bb := (mi as MeshInstance3D).mesh.get_aabb()
					for c in 8:
						pts.append(xf * bb.get_endpoint(c))
		var body := StaticBody3D.new()
		body.name = "BlowUpBody"
		var cs := CollisionShape3D.new()
		var mid := Vector3.ZERO                    # (the shape at the thing's middle: a blast looks for it there, not on the floor)
		for p in pts:
			mid += p / float(pts.size())
		for i in pts.size():
			pts[i] -= mid
		cs.position = mid
		var sh := ConvexPolygonShape3D.new()
		sh.points = pts
		cs.shape = sh
		body.add_child(cs)
		host.add_child(body)
		cols.append(body)
	for c in cols:
		if not (c as Node).has_meta("hs_surface"):
			(c as Node).set_meta("hs_surface", _k.surface)


func _finish() -> void:
	if _task >= 0:
		WorkerThreadPool.wait_for_task_completion(_task)
		_task = -1
	if _res.is_empty():
		return
	_inside.set_shader_parameter("grain_axis", _fr.grain_axis)
	for lf in _res["leaves"]:
		lf["mesh"] = _mesh_of(lf)
		lf["shape"] = _shape_of(lf)
	for lf in _res["whole"]:
		lf["mesh"] = _mesh_of(lf)
		lf["shape"] = _shape_of(lf)
	_done = true
	prepared.emit()


func _mesh_of(lf: Dictionary, dents := false) -> ArrayMesh:
	var am := ArrayMesh.new()
	var surf: Array = lf["surfaces"]
	var ins := surf.size() - 1
	for s in surf.size():
		var sf = surf[s]
		if sf == null:
			continue
		var P: PackedVector3Array = sf["P"]
		var N: PackedVector3Array = sf["N"]
		if dents and not _dents.is_empty():
			var moved := _dent_points(P)
			if moved:
				N = _normals_of(P, sf["I"], N, _w_of(s))
		var arr := []
		arr.resize(Mesh.ARRAY_MAX)
		arr[Mesh.ARRAY_VERTEX] = P
		arr[Mesh.ARRAY_NORMAL] = N
		if (sf["T"] as PackedFloat32Array).size() == P.size() * 4:
			arr[Mesh.ARRAY_TANGENT] = sf["T"]
		if (sf["U"] as PackedVector2Array).size() == P.size():
			arr[Mesh.ARRAY_TEX_UV] = sf["U"]
		if (sf["U2"] as PackedVector2Array).size() == P.size():
			arr[Mesh.ARRAY_TEX_UV2] = sf["U2"]
		if (sf["C"] as PackedColorArray).size() == P.size():
			arr[Mesh.ARRAY_COLOR] = sf["C"]
		arr[Mesh.ARRAY_INDEX] = sf["I"]
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		am.surface_set_material(am.get_surface_count() - 1, _inside if s == ins else (_mats[s] if s < _mats.size() else null))
	return am


# a piece's collider: its hull, at least MIN_THICK along each of its own axes (a thinner body sinks through a level's
# floor: its thin shard of a mug wall, a sheet of a kettle)
func _shape_of(lf: Dictionary) -> ConvexPolygonShape3D:
	var pts: PackedVector3Array = (lf["hull"] as PackedVector3Array).duplicate()
	var axes: Array = lf.get("axes", [])
	var ext: Vector3 = lf.get("ext", Vector3.ONE)
	for k in axes.size():
		if ext[k] < MIN_THICK:
			var add: Vector3 = (axes[k] as Vector3) * ((MIN_THICK - ext[k]) * 0.5)
			var n := pts.size()
			for i in n:
				pts.append(pts[i] + add)
				pts[i] -= add
	var sh := ConvexPolygonShape3D.new()
	sh.points = pts
	return sh


func _w_of(s: int) -> float:
	return -1.0 if _fr != null and s < _fr._w.size() and _fr._w[s] < 0.0 else 1.0


# the faces' normals again where a dent moved them (the outward side by the surface's winding)
func _normals_of(P: PackedVector3Array, I: PackedInt32Array, N0: PackedVector3Array, w: float) -> PackedVector3Array:
	var N := PackedVector3Array()
	N.resize(P.size())
	for t in range(0, I.size(), 3):
		var f := (P[I[t + 1]] - P[I[t]]).cross(P[I[t + 2]] - P[I[t]]) * w
		N[I[t]] += f
		N[I[t + 1]] += f
		N[I[t + 2]] += f
	for i in N.size():
		N[i] = N[i].normalized() if N[i].length() > 1e-12 else N0[i]
		if N0.size() == N.size() and N[i].dot(N0[i]) < -0.2:
			N[i] = N0[i]
	return N


# the dents pushed into points in the thing's space; whether any moved
func _dent_points(P: PackedVector3Array) -> bool:
	var moved := false
	for i in P.size():
		var p := P[i]
		var off := Vector3.ZERO
		for d in _dents:
			var r: float = d[3]
			var dist := p.distance_to(d[0])
			if dist < r:
				var k := 1.0 - dist / r
				off += (d[1] as Vector3) * float(d[2]) * k * k * (3.0 - 2.0 * k)
		if off != Vector3.ZERO:
			P[i] = p + off
			moved = true
	return moved


func _average_color() -> Color:
	var sum := Vector3.ZERO
	var w := 0.0
	for i in _mats.size():
		var m = _mats[i]
		var c := Color(0.7, 0.7, 0.7)
		if m is BaseMaterial3D:
			c = (m as BaseMaterial3D).albedo_color
			var tex := (m as BaseMaterial3D).albedo_texture
			if tex != null:
				var img := tex.get_image()
				if img != null and not img.is_empty():
					img = img.duplicate()
					if img.is_compressed():
						img.decompress()
					if not img.is_compressed():
						img.resize(16, 16, Image.INTERPOLATE_BILINEAR)
						var t := Vector3.ZERO
						for y in 16:
							for x in 16:
								var px := img.get_pixel(x, y)
								t += Vector3(px.r, px.g, px.b)
						t /= 256.0
						c = Color(c.r * t.x, c.g * t.y, c.b * t.z)
		var a := _area[i] if i < _area.size() else 1.0
		sum += Vector3(c.r, c.g, c.b) * a
		w += a
	return Color(sum.x / w, sum.y / w, sum.z / w) if w > 0.0 else Color(0.7, 0.7, 0.7)


func _make_inside() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(DIR + ("blowup/inside_glass.gdshader" if _k.see_through else "blowup/inside.gdshader"))
	var col := _k.inside_color.lerp(_avg.lightened(0.2), _k.inside_from_surface)
	col.a = _k.inside_color.a
	m.set_shader_parameter("inside_color", col)
	m.set_shader_parameter("roughness_v", _k.inside_roughness)
	m.set_shader_parameter("metallic_v", _k.inside_metallic)
	m.set_shader_parameter("speckle", _k.speckle)
	m.set_shader_parameter("fibres", _k.fibres)
	return m


# ---- shot ---------------------------------------------------------------------------------------------------------

func _listen() -> void:
	for w in get_tree().get_nodes_in_group("hs_weapon"):
		if not _guns.has(w) and w.has_signal("fired"):
			w.fired.connect(_on_fired)
			_guns.append(w)


func _on_fired(shot_hits: Array) -> void:
	var host := get_parent() as Node3D
	if host == null or is_broken or not host.is_visible_in_tree():
		return
	var mine := shot_hits.filter(func(h) -> bool:
		var c = h.get("collider")
		return c is Node and is_instance_valid(c) and (c == host or host.is_ancestor_of(c)))
	mine = mine.filter(func(h) -> bool: return bool(h.get("blast", false)) or float(h.get("damage", 1.0)) > 0.0)
	if mine.is_empty():                                  # (nothing of it, or only a harmless shell's hearts or water)
		return
	var dmg := 0.0
	var at := Vector3.ZERO
	var dir := Vector3.ZERO
	var n := 0
	var blast_at := Vector3.INF
	for h in mine:
		dmg += float(h.get("damage", 1.0))
		if bool(h.get("blast", false)):
			blast_at = h.get("from", h.get("point", Vector3.ZERO))
			continue
		at += h.get("point", Vector3.ZERO)
		dir += h.get("dir", Vector3.ZERO)
		n += 1
	if n > 0:
		at /= float(n)
		dir = dir.normalized()
	else:
		at = mine[0].get("point", host.global_position)
		dir = (at - blast_at).normalized() if blast_at != Vector3.INF else Vector3.ZERO
	var s := _strength()
	if blast_at != Vector3.INF or dmg >= s or damage + dmg >= s * 2.5:
		blow_up.call_deferred(at, dir, maxf(dmg / s, 1.0), blast_at)
		return
	damage += dmg
	var dented := 0
	if _k.dent_m > 0.0:
		for h in mine:
			if not bool(h.get("blast", false)):
				_dent(h.get("point", at), h.get("dir", dir))
				dented += 1
		if dented > 0:
			_dent_intact()
	hit.emit({"damage": dmg, "worn": damage, "point": at, "pellets": n, "dented": dented})


func _dent(point: Vector3, dir: Vector3) -> void:
	var host := get_parent() as Node3D
	var finv := host.global_transform.orthonormalized().affine_inverse()
	_dents.append([finv * point, (finv.basis * dir).normalized(), _k.dent_m * randf_range(0.7, 1.2), _k.dent_r_m])


# the dents in the thing as it stands: each mesh made again from its own arrays with them pushed in
func _dent_intact() -> void:
	for e in _intact:
		var m: MeshInstance3D = e["mi"]
		if not is_instance_valid(m):
			continue
		var xf: Transform3D = e["xf"]
		var inv := xf.affine_inverse()
		var src: Mesh = e["mesh"]
		var am := ArrayMesh.new()
		var any := false
		for s in (e["arrays"] as Array).size():
			var arr = e["arrays"][s]
			if arr == null:
				continue
			var a2: Array = (arr as Array).duplicate()
			var P: PackedVector3Array = xf * (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array)
			if _dent_points(P):
				any = true
				P = inv * P
				a2[Mesh.ARRAY_VERTEX] = P
				var I = arr[Mesh.ARRAY_INDEX]
				if I is PackedInt32Array and arr[Mesh.ARRAY_NORMAL] is PackedVector3Array:
					var N0: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
					var w := 0.0
					var I2: PackedInt32Array = I
					var P0: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
					for t in range(0, mini(I2.size(), 300), 3):
						w += (P0[I2[t + 1]] - P0[I2[t]]).cross(P0[I2[t + 2]] - P0[I2[t]]).dot(N0[I2[t]])
					a2[Mesh.ARRAY_NORMAL] = _normals_of(P, I2, N0, 1.0 if w >= 0.0 else -1.0)
			am.add_surface_from_arrays(src.surface_get_primitive_type(s), a2)
			am.surface_set_material(am.get_surface_count() - 1, src.surface_get_material(s))
		if any:
			m.mesh = am


# ---- breaking -----------------------------------------------------------------------------------------------------

## Breaks it: `at` where it's hit (the world's; INF: its middle), `dir` the shot's way, `power` how far past its strength
## the shot was (1: just), `blast_at` an explosion's middle (INF: none; its pieces thrown out of it, all of them small).
## Its pieces come out where its parts were, its own materials on them, small near `at` and bigger away.
func blow_up(at := Vector3.INF, dir := Vector3.ZERO, power := 1.5, blast_at := Vector3.INF) -> void:
	if is_broken or Engine.is_editor_hint():
		return
	var host := get_parent() as Node3D
	if host == null:
		return
	if not _done:
		if _task < 0:
			_prepare()
		if _task >= 0:
			_finish()                             # (waits for the cut: a hitch only when it's shot before it's ready)
		if not _done:
			return
	is_broken = true
	_broke_s = Time.get_ticks_msec() / 1000.0
	_clinks = 0
	var F := host.global_transform.orthonormalized()
	var finv := F.affine_inverse()
	var R: float = _res["radius"]
	var mid := F * (_res["center"] as Vector3)
	if at == Vector3.INF:
		at = mid
	if dir == Vector3.ZERO:
		dir = (mid - at).normalized() if mid.distance_to(at) > 0.005 else -F.basis.z
	var blast := blast_at != Vector3.INF
	var base_v := (host as RigidBody3D).linear_velocity if host is RigidBody3D else Vector3.ZERO
	# where they go: the scene beside it
	var par: Node = host.get_parent() if host.get_parent() != null else get_tree().current_scene
	_container = Node3D.new()
	_container.name = "%s_pieces" % host.name
	par.add_child(_container)
	_container.global_transform = Transform3D.IDENTITY
	_hide(host)
	# the pieces: the cut's tree taken apart where the hit is
	var groups := _groups(finv * at, power, blast)
	var made: Array = []
	for g in groups:
		var lfs: Array = []
		for l in g:
			lfs.append(_res["leaves"][l])
		made.append(_piece(lfs, F, at, dir, power, blast_at, base_v, R))
	for lf in _res["whole"]:
		made.append(_piece([lf], F, at, dir, power * 0.8, blast_at, base_v, R, true))
	for n in _whole_nodes:
		if is_instance_valid(n):
			var e := _piece_node(n, F, at, dir, power, blast_at, base_v, R)
			if not e.is_empty():
				made.append(e)
	pieces_out.clear()
	var bodies: Array = []
	for e in made:
		pieces_out.append(e["node"])
		if e["node"] is RigidBody3D:
			bodies.append(e["node"])
	# they never knock each other about (they start touching), nor you
	var pl := get_tree().get_first_node_in_group("hs_player")
	for i in bodies.size():
		var a: RigidBody3D = bodies[i]
		if pl is PhysicsBody3D:
			a.add_collision_exception_with(pl)
		for j in range(i + 1, bodies.size()):
			a.add_collision_exception_with(bodies[j])
	var moved := _move_marks(host, F, made)
	_effects(at, dir, R, power, blast)
	_splash(host, F, at)
	_play(_k.sound if _k.sound != null else _sound("break"), at, clampf(-2.0 + 3.0 * log(maxf(power, 1.0)), -2.0, 3.0))
	last = {"pieces": made.size(), "rigid": bodies.size(), "little": _bits.size(), "groups": groups.size(),
		"whole": (_res["whole"] as Array).size() + _whole_nodes.size(), "leaves": (_res["leaves"] as Array).size(),
		"power": power, "blast": blast, "at": at, "dir": dir, "marks_moved": moved, "kind": _k.id,
		"sizes": made.map(func(e) -> Vector2: return Vector2(float(e["r"]), (finv * at).distance_to(e["c"])))}
	blown_up.emit(pieces_out)
	if target != null and target.has_method("fire"):
		target.fire()


# its leaves gathered into pieces: from the farthest from the hit in, each piece grown over the leaves it touches as long
# as it stays as big as a piece should be there (small near the hit, bigger away from it; all small in a blast)
func _groups(h: Vector3, power: float, blast: bool) -> Array:
	var leaves: Array = _res["leaves"]
	var touch: Array = _res["touch"]
	var R: float = _res["radius"]
	var order: Array = []
	for i in leaves.size():
		order.append(i)
	order.sort_custom(func(a: int, b: int) -> bool:
		return (leaves[a]["center"] as Vector3).distance_to(h) > (leaves[b]["center"] as Vector3).distance_to(h))
	var taken := {}
	var out: Array = []
	for i in order:
		if taken.has(i):
			continue
		var seed: Vector3 = leaves[i]["center"]
		var want := R * _k.coarse * (0.25 + seed.distance_to(h) / maxf(R, 0.01)) / sqrt(maxf(power, 0.5))
		if blast:
			want *= 0.35
		var grp := PackedInt32Array([i])
		taken[i] = true
		var q: Array = [i]
		while not q.is_empty():
			var a: int = q.pop_back()
			for b in touch[a]:
				if taken.has(b):
					continue
				if seed.distance_to(leaves[b]["center"]) + float(leaves[b]["radius"]) <= want:
					taken[b] = true
					grp.append(b)
					q.append(b)
		out.append(grp)
	return out


# a piece from leaves: a rigid body (bigger) or a little one moved by rays, its leaves' meshes on it where they were,
# thrown out of the hit along the shot
func _piece(lfs: Array, F: Transform3D, at: Vector3, dir: Vector3, power: float, blast_at: Vector3, base_v: Vector3, R: float,
		is_whole := false) -> Dictionary:
	var c := Vector3.ZERO
	var w := 0.0
	var area := 0.0
	for lf in lfs:
		var a := maxf(float(lf["area"]), 1e-6)
		c += (lf["center"] as Vector3) * a
		w += a
		area += float(lf["area"])
	c /= w
	var r := 0.0
	for lf in lfs:
		r = maxf(r, c.distance_to(lf["center"]) + float(lf["radius"]))
	var little := lfs.size() == 1 and r < TINY and not is_whole
	var node: Node3D
	var rb: RigidBody3D = null
	if little:
		node = Node3D.new()
		node.name = "Bit"
	else:
		rb = RigidBody3D.new()
		rb.name = "Piece"
		rb.mass = clampf(area * _k.areal_kg, 0.05, 8.0)       # (a few grams on a 5 cm collider jitters)
		var pm := PhysicsMaterial.new()
		pm.bounce = _k.bounce
		pm.friction = _k.friction
		rb.physics_material_override = pm
		rb.continuous_cd = true
		rb.linear_damp = 0.05
		rb.angular_damp = 0.9
		rb.contact_monitor = true
		rb.max_contacts_reported = 2
		rb.set_meta("hs_surface", _k.surface)
		node = rb
	var dented := false
	for lf in lfs:
		var mi := MeshInstance3D.new()
		var near_dent := false
		for d in _dents:
			if (lf["aabb"] as AABB).grow(float(d[3])).has_point(d[0]):
				near_dent = true
				break
		mi.mesh = _mesh_of(lf, true) if near_dent else lf["mesh"]
		dented = dented or near_dent
		mi.position = -c
		node.add_child(mi)
		if rb != null:
			var cs := CollisionShape3D.new()
			cs.shape = lf["shape"]
			cs.position = -c
			rb.add_child(cs)
	_container.add_child(node)
	node.global_transform = Transform3D(F.basis, F * c)
	if rb != null:
		_lift_clear(rb, lfs, c)
	var cw := F * c
	var sp := _k.speed * push * clampf(sqrt(maxf(power, 0.5)), 0.8, 1.8)
	var v: Vector3
	if blast_at != Vector3.INF:
		var out := cw - blast_at
		out = out.normalized() if out.length() > 0.001 else Vector3.UP
		v = (out + Vector3.UP * 0.45).normalized() * sp * 1.8 * randf_range(0.7, 1.3)
	else:
		var rr := cw - at
		var out := rr.normalized() if rr.length() > 0.001 else dir
		var near := clampf(1.25 - rr.length() / maxf(R * 2.0, 0.05), 0.3, 1.2)
		v = (dir * 0.8 + out * 0.45 + Vector3.UP * 0.15).normalized() * sp * near * randf_range(0.75, 1.25)
	v += base_v
	if rb != null and v.y < -0.4:
		# on a floor already (a thing on the floor shot from above): the floor takes its fall at once, as it would; a
		# level's floor is one-sided, and a piece driven into it a few centimetres a step is under it before it can stop
		var low := _lowest(rb, lfs, c)
		var fq := PhysicsRayQueryParameters3D.create(Vector3(cw.x, low + 0.02, cw.z), Vector3(cw.x, low - 0.12, cw.z), 1)
		if not get_world_3d().direct_space_state.intersect_ray(fq).is_empty():
			v.y = -0.4
	var spin := Vector3(randfn(0.0, 1.0), randfn(0.0, 1.0), randfn(0.0, 1.0)).normalized() * _k.spin * randf_range(0.3, 1.0)
	if r > 0.06:
		spin *= 0.6
	var e := {"node": node, "leaves": lfs, "c": c, "r": r, "whole": is_whole}
	if rb != null:
		rb.linear_velocity = v
		rb.angular_velocity = spin
		rb.body_entered.connect(_on_piece_hit.bind(rb))
		var pts := PackedVector3Array()
		for lf in lfs:
			for p in lf.get("verts", lf["hull"]):
				pts.append((p as Vector3) - c)
		_rigid.append({"body": rb, "leaves": lfs, "c": c, "r": r, "still": 0.0, "age": 0.0, "frozen": false, "snap": 0.0,
			"cool": 0.3, "pts": pts, "from": rb.global_position})
	else:
		var lf: Dictionary = lfs[0]
		var pts := PackedVector3Array()
		for p in lf.get("verts", lf["hull"]):
			pts.append((p as Vector3) - c)
		_lift_bit(node, pts)
		_bits.append({"node": node, "v": v, "w": spin, "rest": false, "thin": lf["thin"], "thick": maxf(float(lf["thick"]), 0.001),
			"r": r, "cool": 0.3, "pts": pts})
	return e


# a piece whose collider (thicker than it) starts in the floor it stood on: lifted clear of it, or it jitters there
# the lowest point of a piece's collider in the world
func _lowest(rb: RigidBody3D, lfs: Array, c: Vector3) -> float:
	var low := INF
	for lf in lfs:
		for p in (lf["shape"] as ConvexPolygonShape3D).points:
			low = minf(low, (rb.global_transform * ((p as Vector3) - c)).y)
	return low


func _lift_clear(rb: RigidBody3D, lfs: Array, c: Vector3) -> void:
	var low := _lowest(rb, lfs, c)
	if low == INF:
		return
	var at := rb.global_position
	var q := PhysicsRayQueryParameters3D.create(at + Vector3.UP * 0.05, Vector3(at.x, low - 0.05, at.z), 1)
	var hit := rb.get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty() and (hit["position"] as Vector3).y > low:
		rb.global_position.y += (hit["position"] as Vector3).y - low + 0.002


# a little piece that starts under what it stood on (its corners pushed down by the crumple): lifted onto it first, or
# its rays start below the floor and it falls for ever
func _lift_bit(n: Node3D, pts: PackedVector3Array) -> void:
	var low := INF
	for p in pts:
		low = minf(low, (n.global_transform * p).y)
	if low == INF:
		return
	var at := n.global_position
	var q := PhysicsRayQueryParameters3D.create(at + Vector3.UP * 0.1, Vector3(at.x, low - 0.02, at.z), 1)
	var hit := n.get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty() and (hit["position"] as Vector3).y > low:
		n.global_position.y += (hit["position"] as Vector3).y - low + 0.001


# a part that goes whole (a lid, a handle): a rigid body wearing its own meshes, a box round them for its collider
func _piece_node(n: Node3D, F: Transform3D, at: Vector3, dir: Vector3, power: float, blast_at: Vector3, base_v: Vector3, R: float) -> Dictionary:
	var meshes: Array = [n] if n is MeshInstance3D else []
	meshes.append_array(n.find_children("*", "MeshInstance3D", true, false))
	if meshes.is_empty():
		return {}
	var nf := n.global_transform.orthonormalized()
	var inv := nf.affine_inverse()
	var bb := AABB()
	var first := true
	var rb := RigidBody3D.new()
	rb.name = "Piece"
	for mi in meshes:
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		var copy := MeshInstance3D.new()
		copy.mesh = m.mesh
		for s in m.get_surface_override_material_count():
			copy.set_surface_override_material(s, m.get_surface_override_material(s))
		copy.material_override = m.material_override
		copy.transform = inv * m.global_transform
		rb.add_child(copy)
		var mb := copy.transform * m.mesh.get_aabb()
		if first:
			bb = mb
			first = false
		bb = bb.merge(mb)
	var sz := bb.size
	sz = Vector3(maxf(sz.x, MIN_THICK), maxf(sz.y, MIN_THICK), maxf(sz.z, MIN_THICK))
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = sz
	cs.shape = box
	cs.position = bb.get_center()
	rb.add_child(cs)
	rb.mass = clampf(bb.size.x * bb.size.z * 2.0 * _k.areal_kg, 0.02, 6.0)
	var pm := PhysicsMaterial.new()
	pm.bounce = _k.bounce
	pm.friction = _k.friction
	rb.physics_material_override = pm
	rb.continuous_cd = true
	rb.angular_damp = 0.9
	rb.contact_monitor = true
	rb.max_contacts_reported = 2
	rb.set_meta("hs_surface", _k.surface)
	_container.add_child(rb)
	rb.global_transform = nf
	var cw := nf * bb.get_center()
	var out := (cw - (blast_at if blast_at != Vector3.INF else at))
	out = out.normalized() if out.length() > 0.001 else Vector3.UP
	var sp := _k.speed * push * clampf(sqrt(maxf(power, 0.5)), 0.7, 2.5) * randf_range(0.8, 1.2)
	rb.linear_velocity = (dir * 0.4 + out * 0.6 + Vector3.UP * 0.7).normalized() * sp + base_v
	rb.angular_velocity = Vector3(randfn(0.0, 1.0), randfn(0.0, 1.0), randfn(0.0, 1.0)).normalized() * _k.spin * 0.5
	rb.body_entered.connect(_on_piece_hit.bind(rb))
	var lf := {"hull": PackedVector3Array(), "aabb": AABB(F.affine_inverse() * nf * bb.position, Vector3.ZERO).expand(F.affine_inverse() * nf * bb.end)}
	var pts := PackedVector3Array()
	for k in 8:
		pts.append(F.affine_inverse() * nf * bb.get_endpoint(k))
	lf["hull"] = pts
	var c := F.affine_inverse() * cw
	var local := PackedVector3Array()
	for k in 8:
		local.append(bb.get_endpoint(k))
	_rigid.append({"body": rb, "leaves": [lf], "c": c, "r": bb.size.length() * 0.5, "still": 0.0, "age": 0.0, "frozen": false,
		"snap": 0.0, "cool": 0.3, "pts": local})
	return {"node": rb, "leaves": [lf], "c": c, "r": bb.size.length() * 0.5, "whole": true}


# the thing gone: not drawn, nothing under it solid (a rigid one held still), so a pellet or a piece passes where it was
func _hide(host: Node3D) -> void:
	host.visible = false
	_solid.clear()
	for n in [host] + host.find_children("*", "", true, false):
		if n is CollisionObject3D:
			var co := n as CollisionObject3D
			_solid.append([co, co.collision_layer, co.collision_mask, (co as RigidBody3D).freeze if co is RigidBody3D else false])
			co.collision_layer = 0
			co.collision_mask = 0
			if co is RigidBody3D:
				(co as RigidBody3D).freeze = true
		elif n is CSGShape3D and (n as CSGShape3D).use_collision:
			_solid.append([n, -1, -1, false])
			(n as CSGShape3D).use_collision = false


# the pellets' holes on it go with the piece they were on (gone with what turned to dust)
func _move_marks(host: Node3D, F: Transform3D, made: Array) -> int:
	var finv := F.affine_inverse()
	var moved := 0
	for d in host.find_children("*", "Decal", true, false):
		if not (d as Node).has_meta("hs_mark"):
			continue
		var p := finv * (d as Decal).global_position
		var best: Node3D = null
		var bd := INF
		for e in made:
			for lf in e["leaves"]:
				var dist := _dist_to(lf["aabb"], p)
				if dist < bd:
					bd = dist
					best = e["node"]
		if best != null and bd < 0.02:
			(d as Node).reparent(best, true)
			moved += 1
		else:
			(d as Node).queue_free()
	return moved


func _dist_to(bb: AABB, p: Vector3) -> float:
	var q := p.clamp(bb.position, bb.end)
	return q.distance_to(p)


# ---- after: the pieces settle, are kicked, clink ---------------------------------------------------------------------

func _physics_process(dt: float) -> void:
	if Engine.is_editor_hint() or not is_broken:
		return
	var space := get_world_3d().direct_space_state
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	var pv := Vector3.ZERO
	if pl is CharacterBody3D:
		pv = (pl as CharacterBody3D).velocity
		pv.y = 0.0
	for e in _rigid:
		var body = e["body"]
		if not is_instance_valid(body):
			continue
		var rb := body as RigidBody3D
		if rb.global_position.y < -60.0:
			_fell += 1
			push_warning("HSBlowUp: a piece of %s fell out of the world (from %s)" % [get_parent().name, str(e.get("from", Vector3.ZERO))])
			rb.queue_free()
			continue
		e["cool"] = maxf(float(e["cool"]) - dt, 0.0)
		if not bool(e["frozen"]):
			_unsink(e, rb, space)
			e["age"] = float(e["age"]) + dt
			var v := rb.linear_velocity.length()
			var slow := v < 0.08 and rb.angular_velocity.length() < 0.8
			e["still"] = float(e["still"]) + dt if slow else 0.0
			# gone nowhere for half a second (a light piece resting a little sunk jitters on its collider, never asleep)
			e["held"] = float(e.get("held", 0.0)) + dt
			if float(e["held"]) > 0.5:
				var moved := rb.global_position.distance_to(e.get("anchor", Vector3.INF))
				e["anchor"] = rb.global_position
				e["held"] = 0.0
				e["nowhere"] = moved < 0.01
			if float(e["age"]) > 0.25 and (rb.sleeping or float(e["still"]) > 0.4 or bool(e.get("nowhere", false))
					or (float(e["age"]) > 4.0 and v < 0.25)):
				_settle(e, space)
		if kick and pl != null and float(e["cool"]) <= 0.0 and pv.length() > 0.4:
			_kick(e, pl, pv)
	for b in _bits:
		_bit_step(b, dt, space, pl, pv)


# a piece whose middle has gone under a floor it fell onto (a level's floor is a one-sided mesh: driven into it hard, the
# physics let it in and nothing pushes it back out, and it falls out of the world): back on top, its fall taken off
func _unsink(e: Dictionary, rb: RigidBody3D, space: PhysicsDirectSpaceState3D) -> void:
	var c := rb.global_position
	var q := PhysicsRayQueryParameters3D.create(c + Vector3.UP * 0.15, c, 1)
	var ex: Array = []
	for o in _rigid:
		if is_instance_valid(o["body"]):
			ex.append((o["body"] as RigidBody3D).get_rid())
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		ex.append((pl as CollisionObject3D).get_rid())
	q.exclude = ex
	var h := space.intersect_ray(q)
	if h.is_empty() or (h["normal"] as Vector3).y < 0.7:
		return
	var low := INF
	for p in e["pts"]:                                   # (its own points: a cut piece's and a whole part's alike)
		low = minf(low, (rb.global_transform * (p as Vector3)).y)
	if low == INF:
		return
	rb.global_position.y += (h["position"] as Vector3).y - low + 0.002
	var lv := rb.linear_velocity
	rb.linear_velocity = Vector3(lv.x * 0.6, absf(lv.y) * 0.2, lv.z * 0.6)
	e["unsunk"] = int(e.get("unsunk", 0)) + 1
	_unsunk += 1


# come to rest: held there (a static body), laid down onto what it's on (its collider is thicker than it)
func _settle(e: Dictionary, space: PhysicsDirectSpaceState3D) -> void:
	var rb: RigidBody3D = e["body"]
	rb.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	rb.freeze = true
	e["frozen"] = true
	var low := INF
	var low_p := Vector3.ZERO
	for p in e["pts"]:
		var g := rb.global_transform * (p as Vector3)
		if g.y < low:
			low = g.y
			low_p = g
	if low == INF:
		return
	var q := PhysicsRayQueryParameters3D.create(low_p + Vector3.UP * 0.07, low_p - Vector3.UP * 0.12, 1)
	q.hit_from_inside = false
	var ex: Array = []
	for o in _rigid:
		if is_instance_valid(o["body"]):
			ex.append((o["body"] as RigidBody3D).get_rid())
	q.exclude = ex
	var hit := space.intersect_ray(q)
	if hit.is_empty():
		return
	var gap := low - (hit["position"] as Vector3).y
	if absf(gap - 0.001) > 0.0005 and gap < 0.06 and gap > -0.035:
		rb.global_position.y -= gap - 0.001
		e["snap"] = gap - 0.001


# walked into: off the floor again, along your way
func _kick(e: Dictionary, pl: Node3D, pv: Vector3) -> void:
	var rb: RigidBody3D = e["body"]
	var d := rb.global_position - pl.global_position
	if absf(d.y) > 0.4:
		return
	d.y = 0.0
	if d.length() > float(e["r"]) + 0.25:
		return
	if bool(e["frozen"]):
		rb.global_position.y += float(e["snap"])
		e["snap"] = 0.0
		rb.freeze = false
		e["frozen"] = false
		e["still"] = 0.0
		e["age"] = 0.0
		e["nowhere"] = false
		e["anchor"] = Vector3.INF
	rb.apply_central_impulse((pv * 0.55 + Vector3.UP * 0.6) * rb.mass)
	rb.angular_velocity += Vector3(randfn(0.0, 1.0), randfn(0.0, 1.0), randfn(0.0, 1.0)) * 3.0
	e["cool"] = 0.6
	_clink(rb.global_position, 0.45)


# a little piece by rays: falling, bouncing off what it meets, lying down flat on what it comes to rest on
func _bit_step(b: Dictionary, dt: float, space: PhysicsDirectSpaceState3D, pl: Node3D, pv: Vector3) -> void:
	var nn = b["node"]
	if not is_instance_valid(nn):
		return
	var n := nn as Node3D
	b["cool"] = maxf(float(b["cool"]) - dt, 0.0)
	if bool(b["rest"]):
		if kick and pl != null and pv.length() > 0.4 and float(b["cool"]) <= 0.0:
			var d := n.global_position - pl.global_position
			if absf(d.y) < 0.4 and Vector2(d.x, d.z).length() < 0.2:
				b["rest"] = false
				b["v"] = pv * 0.7 + Vector3.UP * 0.9
				b["w"] = Vector3(randfn(0.0, 1.0), randfn(0.0, 1.0), randfn(0.0, 1.0)) * 8.0
				b["cool"] = 0.6
		return
	var v: Vector3 = b["v"]
	v.y -= 9.8 * dt
	v *= 1.0 - 0.05 * dt
	var from := n.global_position
	var to := from + v * dt
	var q := PhysicsRayQueryParameters3D.create(from, to + v.normalized() * 0.004, 1)
	q.hit_from_inside = true
	if pl is CollisionObject3D:
		q.exclude = [(pl as CollisionObject3D).get_rid()]
	var hit := space.intersect_ray(q)
	if not hit.is_empty() and (hit["normal"] as Vector3) == Vector3.ZERO:
		n.global_position = from + Vector3.UP * 0.01         # (it started inside something: out of it first)
		v.y = maxf(v.y, 0.0)
		b["v"] = v
		return
	var w: Vector3 = b["w"]
	if hit.is_empty():
		n.global_position = to
		if w.length() > 0.001:
			n.global_basis = Basis(w.normalized(), w.length() * dt) * n.global_basis
		b["v"] = v
		if to.y < -60.0:
			_fell += 1
			push_warning("HSBlowUp: a little piece of %s fell out of the world" % get_parent().name)
			n.queue_free()
		return
	var nrm: Vector3 = hit["normal"]
	var p: Vector3 = hit["position"]
	var vn := v.dot(nrm)
	var speed := v.length()
	if vn < 0.0:
		v = (v - nrm * vn * (1.0 + _k.bounce)) * (1.0 - _k.friction * 0.45)
		if speed > 1.2:
			_clink(p, clampf(speed / 5.0, 0.15, 0.6))
	b["w"] = w * 0.5
	var thick: float = b["thick"]
	n.global_position = p + nrm * maxf(thick * 0.5, 0.0015)
	if nrm.y > 0.55 and v.length() < 0.7:
		b["rest"] = true
		var thin: Vector3 = b["thin"]
		if thin != Vector3.ZERO:
			var tw := (n.global_basis * thin).normalized()
			var to_n := nrm if tw.dot(nrm) >= 0.0 else -nrm
			n.global_basis = Basis(Quaternion(tw, to_n)) * n.global_basis
		# its lowest corner on the surface
		n.global_position = p
		var under := INF
		for pt in b["pts"]:
			under = minf(under, (n.global_transform * (pt as Vector3) - p).dot(nrm))
		if under != INF:
			n.global_position = p + nrm * (0.0006 - under)
		v = Vector3.ZERO
	b["v"] = v


func _on_piece_hit(_other: Node, rb: RigidBody3D) -> void:
	if not is_instance_valid(rb):
		return
	rb.angular_damp = 6.0                                      # (landed: a curved piece rocks only a moment)
	rb.set_meta("_landed", true)
	if rb.linear_velocity.length() > 0.7:
		_clink(rb.global_position, clampf(rb.linear_velocity.length() / 5.0, 0.2, 0.8))


func _clink(at: Vector3, vol: float) -> void:
	if _clink_t > 0.0 or _clinks > 14:
		return
	_clink_t = 0.05
	_clinks += 1
	_play(_k.clink if _k.clink != null else _sound("debris"), at, linear_to_db(vol) - 3.0, "sfx")


# ---- what it leaves: dust, bits, sparks, a splash, its sound --------------------------------------------------------

func _effects(at: Vector3, dir: Vector3, R: float, power: float, blast: bool) -> void:
	var imp := HSImpacts.of(get_tree())
	var b := imp._up_along(-dir if dir != Vector3.ZERO else Vector3.UP)
	var k := clampf(R / 0.08, 0.6, 3.0)
	var inside: Color = _inside.get_shader_parameter("inside_color")
	var dc: Color = _k.dust_color if _k.dust_color.a > 0.0 else inside.lightened(0.15)
	var n_dust := int(round(float(_k.dust) * (1.0 + minf(power, 4.0) * 0.25)))
	if n_dust > 0:
		if _puff == null:
			_puff = HSMuzzle.puff_mesh(imp._t("puff"), 0.0)
		var g := Gradient.new()
		g.set_color(0, Color(dc, 0.0))
		g.set_color(1, Color(dc, 0.0))
		g.add_point(0.06, Color(dc, 0.5))
		g.add_point(0.4, Color(dc, 0.3))
		imp._burst(_puff, n_dust, 1.6, Vector2(0.25, 1.1), 100.0, Vector3(0, -0.2, 0), Vector2(0.025, 0.06) * k, g, at, b, false,
			imp._grow(3.2), 1.6)
	var n_chips := int(round(float(_k.chips) * (1.0 + minf(power, 4.0) * 0.2)))
	if n_chips > 0:
		var cc := _avg.lerp(inside, 0.5)
		var g2 := Gradient.new()
		g2.set_color(0, Color(cc, 1.0))
		g2.set_color(1, Color(cc * 0.85, 1.0))
		var paper := _k.chip_style == "paper"
		imp._burst(_chip_mesh(_k.chip_style), n_chips, 1.4 if paper else 1.0, Vector2(0.8, 3.2) * clampf(sqrt(power), 1.0, 1.8), 85.0,
			Vector3(0, -1.6 if paper else -9.0, 0), (Vector2(0.008, 0.02) if paper else Vector2(0.004, 0.011)) * clampf(k, 0.8, 1.6),
			g2, at, b, _k.chip_style == "splinter", imp._grow(0.8), 2.5 if paper else 0.0)
	if _k.sparks > 0:
		var sp := HSMuzzle.spark_mesh()
		var g3 := Gradient.new()
		g3.set_color(0, Color(1.0, 0.82, 0.45, 1.0))
		g3.set_color(1, Color(0.9, 0.25, 0.05, 0.0))
		imp._burst(sp, _k.sparks, 0.32, Vector2(2.0, 6.0), 70.0, Vector3(0, -6.0, 0), Vector2(0.02, 0.05), g3, at, b, true, imp._grow(0.3), 0.5)
	if blast:
		var inside_m := _inside
		inside_m.set_shader_parameter("scorch_at", (get_parent() as Node3D).global_transform.orthonormalized().affine_inverse() * at)
		inside_m.set_shader_parameter("scorch_r", R * 1.6)
		inside_m.set_shader_parameter("scorch", 0.85)


func _chip_mesh(style: String) -> Mesh:
	if _chip_meshes.has(style):
		return _chip_meshes[style]
	var m := BoxMesh.new()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	match style:
		"splinter":
			m.size = Vector3(0.35, 2.6, 0.25)
			mat.roughness = 0.9
		"paper":
			m.size = Vector3(1.0, 0.05, 0.8)
			mat.roughness = 0.95
		"glint":
			m.size = Vector3(1.0, 0.12, 0.7)
			mat.roughness = 0.05
			mat.metallic_specular = 1.0
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			mat.albedo_color = Color(1, 1, 1, 0.65)
		_:
			m.size = Vector3(1.0, 0.45, 0.8)
			mat.roughness = 0.9
	m.material = mat
	_chip_meshes[style] = m
	return m


# what was in it: drops flung out, a pool spreading under it
func _splash(host: Node3D, F: Transform3D, at: Vector3) -> void:
	var col := liquid
	if col.a <= 0.0:
		for n in _liquids:
			var ex: Dictionary = n.get_meta("extras", {}) if (n as Node).has_meta("extras") else {}
			var info = ex.get("propgen_liquid")
			if info is String:
				info = JSON.parse_string(info)
			if info is Dictionary and info.has("color"):
				col = Color(str(info["color"]))
			elif (n as MeshInstance3D).get_active_material(0) is BaseMaterial3D:
				col = ((n as MeshInstance3D).get_active_material(0) as BaseMaterial3D).albedo_color
			col.a = 1.0
			break
	if col.a <= 0.0:
		return
	var imp := HSImpacts.of(get_tree())
	var mid := F * (_res["center"] as Vector3)
	var drop := SphereMesh.new()
	drop.radius = 0.5
	drop.height = 1.0
	drop.radial_segments = 6
	drop.rings = 3
	var dm := StandardMaterial3D.new()
	dm.vertex_color_use_as_albedo = true
	dm.roughness = 0.08
	drop.material = dm
	var g := Gradient.new()
	g.set_color(0, Color(col, 1.0))
	g.set_color(1, Color(col, 1.0))
	imp._burst(drop, 30, 0.9, Vector2(0.8, 2.6), 75.0, Vector3(0, -9.8, 0), Vector2(0.004, 0.011), g, mid, imp._up_along(Vector3.UP), false,
		imp._grow(0.6), 0.2)
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(mid + Vector3.UP * 0.05, mid + Vector3.DOWN * 3.0, 1)
	var hit := space.intersect_ray(q)
	if hit.is_empty():
		return
	var pool := Decal.new()
	pool.name = "Pool"
	var gt := GradientTexture2D.new()
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = 128
	gt.height = 128
	var gg := Gradient.new()
	gg.set_color(0, Color(col.darkened(0.25), 0.82))
	gg.set_color(1, Color(col.darkened(0.25), 0.0))
	gg.add_point(0.72, Color(col.darkened(0.2), 0.7))
	gt.gradient = gg
	pool.texture_albedo = gt
	var orm := GradientTexture2D.new()
	orm.width = 4
	orm.height = 4
	var og := Gradient.new()
	og.set_color(0, Color(1.0, 0.06, 0.0))
	og.set_color(1, Color(1.0, 0.06, 0.0))
	orm.gradient = og
	pool.texture_orm = orm
	pool.size = Vector3(0.06, 0.1, 0.06)
	pool.cull_mask = HSImpacts.MARK_MASK
	_container.add_child(pool)
	pool.global_position = (hit["position"] as Vector3) + Vector3.UP * 0.02
	var tw := pool.create_tween()
	var sz := clampf(_res["radius"] * 4.5, 0.25, 0.8)
	tw.tween_property(pool, "size", Vector3(sz, 0.1, sz * 0.85), 1.4).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)


func _sound(what: String) -> AudioStream:
	var p := DIR + "sounds/%s_%s.ogg" % [what, _k.id]
	return load(p) if ResourceLoader.exists(p) else null


func _play(st: AudioStream, at: Vector3, db := 0.0, kind_word := "event") -> void:
	if st == null:
		return
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null and snd.has_method("play"):
		snd.play(st, at, db, kind_word)
		return
	var p := AudioStreamPlayer3D.new()
	p.stream = st
	p.volume_db = db
	(_container if _container != null else self).add_child(p)
	p.global_position = at
	p.play()
	p.finished.connect(p.queue_free)


# ---- put back -----------------------------------------------------------------------------------------------------

## Puts it back as it was before it was shot (its pieces gone, its dents out).
func restore() -> void:
	_clear_pieces()
	var host := get_parent() as Node3D
	if host == null:
		return
	host.visible = true
	for e in _solid:
		if not is_instance_valid(e[0]):
			continue
		if e[0] is CollisionObject3D:
			(e[0] as CollisionObject3D).collision_layer = int(e[1])
			(e[0] as CollisionObject3D).collision_mask = int(e[2])
			if e[0] is RigidBody3D:
				(e[0] as RigidBody3D).freeze = bool(e[3])
		elif e[0] is CSGShape3D:
			(e[0] as CSGShape3D).use_collision = true
	_solid.clear()
	for e in _intact:
		if is_instance_valid(e["mi"]):
			(e["mi"] as MeshInstance3D).mesh = e["mesh"]
	_dents.clear()
	damage = 0.0
	is_broken = false
	if _inside != null:
		_inside.set_shader_parameter("scorch", 0.0)


func _clear_pieces() -> void:
	if _container != null and is_instance_valid(_container):
		_container.queue_free()
	_container = null
	_rigid.clear()
	_bits.clear()
	pieces_out.clear()


# ---- the editor's preview -------------------------------------------------------------------------------------------

func _preview() -> void:
	if not Engine.is_editor_hint() or not is_inside_tree():
		return
	for c in get_children():
		if c.has_meta("_hs_preview"):
			c.queue_free()
	var host := get_parent() as Node3D
	if host == null:
		return
	_k = _kind_of(host)
	_find_parts(host)
	var meshes := _meshes(host)
	for mi in meshes:
		RenderingServer.instance_set_visible((mi as MeshInstance3D).get_instance(), not preview and (mi as MeshInstance3D).visible)
	if not preview:
		return
	var rd := _read(host)
	if (rd["src"] as Array).is_empty():
		return
	_avg = _average_color()
	_inside = _make_inside()
	var fr := HSFracture.new()
	var size: float = rd["size"]
	fr.pieces = _fine_count(size)
	fr.grain = _k.grain
	fr.crumple_m = _k.crumple_m
	fr.hollow = _k.hollow
	fr.seed = absi(hash(str(host.name))) % 100000 + 7
	_fr = fr
	var res := fr.run(rd["src"])
	_inside.set_shader_parameter("grain_axis", fr.grain_axis)
	var F: Transform3D = rd["F"]
	var mid: Vector3 = res["center"]
	var R: float = res["radius"]
	for lf in (res["leaves"] as Array) + (res["whole"] as Array):
		var mi := MeshInstance3D.new()
		mi.mesh = _mesh_of(lf)
		mi.set_meta("_hs_preview", true)
		mi.top_level = true
		add_child(mi)
		var out := (lf["center"] as Vector3) - mid
		out = out.normalized() if out.length() > 0.001 else Vector3.UP
		mi.global_transform = Transform3D(F.basis, F.origin + F.basis * (out * R * preview_spread))
	print_verbose("HSBlowUp: %s's preview, %d pieces (%s)" % [host.name, (res["leaves"] as Array).size(), JSON.stringify(res["report"])])
