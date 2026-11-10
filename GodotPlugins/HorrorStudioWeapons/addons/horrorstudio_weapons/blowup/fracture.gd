@tool
class_name HSFracture
extends RefCounted
## A thing's meshes cut into pieces as plain data (docs/research/breaking_props.md): recursive plane slicing, each cut
## filled, the pieces split where they don't touch. No scene tree: HSBlowUp runs it in a worker thread when the thing
## loads, so nothing is cut when it's shot.
##
## In (`run`): its surfaces in the thing's own space, each `{P, N, T, U, U2, C, I}` (positions, normals, tangents as four
## floats a vertex, UVs, second UVs, colours, the triangles' indices; all but P and I may be empty). The cuts' faces are
## one more surface, the inside, after them.
## Out: `leaves` (the smallest pieces: each its surfaces as arrays for an ArrayMesh, its middle, size, thickness and
## hull), `nodes` (the tree of cuts, the root first: each node's children, its leaves, middle and radius), `touch` (the
## leaves each leaf touches), `whole` (what goes whole: a thing's contents, made of materials the rest isn't).

const KEY := 100000.0                    # positions welded to a hundredth of a millimetre
const MM := 1000.0                       # a cut's outline is filled in millimetres (Godot's triangulation and clipping)

var pieces := 12                         ## how many pieces to cut it into (each may still part where it doesn't touch)
var grain := 0.0                         ## 0: cut any way; 1: along `grain_axis` (wood)
var grain_axis := Vector3.ZERO           ## (none: the thing's longest side)
var crumple_m := 0.0                     ## its pieces crumpled this much (metal, card)
var seed := 1
var whole_contents := true               ## parts made of materials the biggest part isn't go whole (a box's shells)
var hollow := false                      ## its inside is air: every part a sheet, its cuts never filled, its back drawn

var report := {}                         ## what it did, a check's: {tris, open, closed, cuts, caps, leaves, whole, ms}

# the pool: every surface's vertices, the originals first, then those the cuts make; the surface being cut is taken
# out of it (its arrays held alone, so appending never copies them)
var _P: Array = []
var _N: Array = []
var _T: Array = []
var _U: Array = []
var _U2: Array = []
var _C: Array = []
var _O: Array = []                       # PackedByteArray: 1 where a vertex is a single sheet's (open: no fill)
var _has_t := PackedByteArray()
var _has_u := PackedByteArray()
var _has_u2 := PackedByteArray()
var _has_c := PackedByteArray()
var _w := PackedFloat32Array()           # each surface's winding: the outward normal is w * (b - a) x (c - a)
var _W := 1.0                            # the inside's (the most common)
var _S := 0
var _cs := -1
var _cP := PackedVector3Array()
var _cN := PackedVector3Array()
var _cT := PackedFloat32Array()
var _cU := PackedVector2Array()
var _cU2 := PackedVector2Array()
var _cC := PackedColorArray()
var _cO := PackedByteArray()
var _cache := {}
var _rng := RandomNumberGenerator.new()
var _cuts := 0
var _caps := 0


## Cuts the surfaces (see the class doc).
func run(src: Array) -> Dictionary:
	var t0 := Time.get_ticks_msec()
	_rng.seed = seed
	_S = src.size() + 1
	_load(src)
	var all := _all()
	var tris := 0
	for s in _S:
		tris += (all[s] as PackedInt32Array).size() / 3
	# the thing's parts as they're joined: which are single sheets (their backs drawn), which are its contents
	var comps := _components(all)
	if hollow:
		for c in comps:
			c["open"] = true
	_open_backs(all, comps)
	var whole: Array = []
	if whole_contents and comps.size() > 1:
		all = _take_contents(all, comps, whole)
	var me := _measure(all)
	if grain_axis.length() < 0.001:
		var sz: Vector3 = (me["aabb"] as AABB).size
		grain_axis = Vector3.RIGHT if sz.x >= sz.y and sz.x >= sz.z else (Vector3.UP if sz.y >= sz.z else Vector3.BACK)
	grain_axis = grain_axis.normalized()
	# the cuts: the biggest piece cut through its middle each time, the tree kept
	var nodes: Array = [{"children": [], "piece": all, "size": (me["aabb"] as AABB).get_longest_axis_size(), "m": me}]
	var live := [0]
	var failed := {}
	while live.size() < maxi(pieces, 1):
		var best := -1
		var bs := 0.0
		for j in live:
			if not failed.has(j) and float(nodes[j]["size"]) > bs:
				bs = float(nodes[j]["size"])
				best = j
		if best < 0:
			break
		var nd: Dictionary = nodes[best]
		var got: Array = []
		for attempt in 6:
			var m: Dictionary = nd["m"]
			var bb: AABB = m["aabb"]
			var mid: Vector3 = m["center"] + Vector3(_rng.randf_range(-0.18, 0.18) * bb.size.x, _rng.randf_range(-0.18, 0.18) * bb.size.y,
				_rng.randf_range(-0.18, 0.18) * bb.size.z)
			var n := _normal()
			got = _slice(nd["piece"], n, n.dot(mid))
			if not got.is_empty():
				break
		if got.is_empty():
			failed[best] = true
			continue
		live.erase(best)
		nd["piece"] = null
		for half in got:
			var hm := _measure(half)
			nodes.append({"children": [], "piece": half, "size": (hm["aabb"] as AABB).get_longest_axis_size(), "m": hm})
			nd["children"].append(nodes.size() - 1)
			live.append(nodes.size() - 1)
		_cuts += 1
	# each piece split where it doesn't touch, then made into arrays
	var leaves: Array = []
	var noise := FastNoiseLite.new()
	noise.seed = seed
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 22.0
	noise.fractal_octaves = 2
	for j in live:
		var nd: Dictionary = nodes[j]
		var parts := _split_apart(nd["piece"])
		nd["piece"] = null
		for part in parts:
			var lf := _leaf(part, noise if crumple_m > 0.0 else null)
			if lf.is_empty():
				continue
			leaves.append(lf)
			var k := nodes.size()
			nodes.append({"children": [], "leaf": leaves.size() - 1})
			nd["children"].append(k)
	var wholes: Array = []
	for g in whole:
		var lf := _leaf(g, null)
		if not lf.is_empty():
			lf["whole"] = true
			lf.erase("_used")
			wholes.append(lf)
	whole = wholes
	# the tree's nodes: their leaves, middle and radius, from the leaves up
	_fill_node(nodes, 0, leaves)
	for nd in nodes:
		nd.erase("piece")
		nd.erase("m")
		nd.erase("size")
	var touch := _touching(leaves)
	report = {"tris": tris, "open": comps.filter(func(c) -> bool: return bool(c["open"])).size(),
		"closed": comps.filter(func(c) -> bool: return not bool(c["open"])).size(), "cuts": _cuts, "caps": _caps,
		"leaves": leaves.size(), "whole": whole.size(), "ms": Time.get_ticks_msec() - t0}
	for lf in leaves:
		lf.erase("_used")
	return {"leaves": leaves, "nodes": nodes, "touch": touch, "whole": whole, "inside": _S - 1,
		"center": me["center"], "radius": maxf((me["aabb"] as AABB).size.length() * 0.5, 0.01), "report": report}


# ---- the pool ---------------------------------------------------------------------------------------------------

func _load(src: Array) -> void:
	var votes := 0.0
	for s in _S:
		var d: Dictionary = src[s] if s < src.size() else {}
		var P: PackedVector3Array = d.get("P", PackedVector3Array())
		var N: PackedVector3Array = d.get("N", PackedVector3Array())
		var I: PackedInt32Array = d.get("I", PackedInt32Array())
		if N.size() != P.size():
			N = _flat_normals(P, I)
		var T: PackedFloat32Array = d.get("T", PackedFloat32Array())
		var U: PackedVector2Array = d.get("U", PackedVector2Array())
		var U2: PackedVector2Array = d.get("U2", PackedVector2Array())
		var C: PackedColorArray = d.get("C", PackedColorArray())
		var inside := s == _S - 1
		_has_t.append(1 if inside or T.size() == P.size() * 4 else 0)
		_has_u.append(1 if inside or U.size() == P.size() else 0)
		_has_u2.append(1 if not inside and U2.size() == P.size() else 0)
		_has_c.append(1 if not inside and C.size() == P.size() else 0)
		_P.append(P.duplicate())
		_N.append(N.duplicate())
		_T.append(T.duplicate() if _has_t[s] and not inside else PackedFloat32Array())
		_U.append(U.duplicate() if _has_u[s] and not inside else PackedVector2Array())
		_U2.append(U2.duplicate() if _has_u2[s] else PackedVector2Array())
		_C.append(C.duplicate() if _has_c[s] else PackedColorArray())
		var O := PackedByteArray()
		O.resize(P.size())
		_O.append(O)
		# its winding, from the data: the normals point out
		var w := 0.0
		for t in range(0, I.size(), 3):
			var a := P[I[t]]
			w += (P[I[t + 1]] - a).cross(P[I[t + 2]] - a).dot(N[I[t]] + N[I[t + 1]] + N[I[t + 2]])
		_w.append(1.0 if w >= 0.0 else -1.0)
		votes += signf(w) * float(I.size())
	_W = 1.0 if votes >= 0.0 else -1.0
	_w[_S - 1] = _W
	_src_index = []
	for s in _S:
		var d: Dictionary = src[s] if s < src.size() else {}
		_src_index.append(d.get("I", PackedInt32Array()))


var _src_index: Array = []


func _all() -> Array:
	var pc: Array = []
	for s in _S:
		pc.append((_src_index[s] as PackedInt32Array).duplicate())
	return pc


func _flat_normals(P: PackedVector3Array, I: PackedInt32Array) -> PackedVector3Array:
	var N := PackedVector3Array()
	N.resize(P.size())
	for t in range(0, I.size(), 3):
		var f := (P[I[t + 1]] - P[I[t]]).cross(P[I[t + 2]] - P[I[t]])
		for k in 3:
			N[I[t + k]] += f
	for i in N.size():
		N[i] = N[i].normalized() if N[i].length() > 1e-12 else Vector3.UP
	return N


func _take(s: int) -> void:
	_cs = s
	_cP = _P[s]
	_cN = _N[s]
	_cT = _T[s]
	_cU = _U[s]
	_cU2 = _U2[s]
	_cC = _C[s]
	_cO = _O[s]
	_P[s] = PackedVector3Array()
	_N[s] = PackedVector3Array()
	_T[s] = PackedFloat32Array()
	_U[s] = PackedVector2Array()
	_U2[s] = PackedVector2Array()
	_C[s] = PackedColorArray()
	_O[s] = PackedByteArray()


func _put() -> void:
	var s := _cs
	_P[s] = _cP
	_N[s] = _cN
	_T[s] = _cT
	_U[s] = _cU
	_U2[s] = _cU2
	_C[s] = _cC
	_O[s] = _cO
	_cP = PackedVector3Array()
	_cN = PackedVector3Array()
	_cT = PackedFloat32Array()
	_cU = PackedVector2Array()
	_cU2 = PackedVector2Array()
	_cC = PackedColorArray()
	_cO = PackedByteArray()
	_cs = -1


static func _key(p: Vector3) -> Vector3i:
	return Vector3i(roundi(p.x * KEY), roundi(p.y * KEY), roundi(p.z * KEY))


# ---- parts: joined, single sheets, contents ---------------------------------------------------------------------

# the thing's parts as its triangles join them (by where their corners are): each part's surfaces, its box, its area,
# whether it's a single sheet (an edge with only one triangle: no inside to fill) and its triangles
func _components(pc: Array) -> Array:
	var ids := {}
	var parent := PackedInt32Array()
	var corner: Array = []
	for s in _S:
		var I: PackedInt32Array = pc[s]
		var P: PackedVector3Array = _P[s]
		var cs := PackedInt32Array()
		cs.resize(I.size())
		for t in I.size():
			var k := _key(P[I[t]])
			var id: int = ids.get(k, -1)
			if id < 0:
				id = parent.size()
				ids[k] = id
				parent.append(id)
			cs[t] = id
		corner.append(cs)
		for t in range(0, I.size(), 3):
			_union(parent, cs[t], cs[t + 1])
			_union(parent, cs[t], cs[t + 2])
	var comp_of := {}
	var comps: Array = []
	var edges := {}
	for s in _S:
		var I: PackedInt32Array = pc[s]
		var P: PackedVector3Array = _P[s]
		var cs: PackedInt32Array = corner[s]
		for t in range(0, I.size(), 3):
			var r := _find(parent, cs[t])
			var ci: int = comp_of.get(r, -1)
			if ci < 0:
				ci = comps.size()
				comp_of[r] = ci
				comps.append({"surfaces": {}, "aabb": AABB(P[I[t]], Vector3.ZERO), "area": 0.0, "open": false, "tris": []})
			var c: Dictionary = comps[ci]
			c["surfaces"][s] = true
			(c["tris"] as Array).append(Vector2i(s, t))
			var a := P[I[t]]
			var b := P[I[t + 1]]
			var d := P[I[t + 2]]
			c["aabb"] = (c["aabb"] as AABB).expand(b).expand(d).expand(a)
			c["area"] = float(c["area"]) + (b - a).cross(d - a).length() * 0.5
			for e in 3:
				var u := cs[t + e]
				var v := cs[t + (e + 1) % 3]
				if u == v:
					continue
				var ek := mini(u, v) * 4294967296 + maxi(u, v)
				edges[ek] = int(edges.get(ek, 0)) + 1
	# a part with an edge only one triangle has is a single sheet
	for ek in edges:
		if int(edges[ek]) == 1:
			var u := int(ek) / 4294967296
			var ci: int = comp_of.get(_find(parent, u), -1)
			if ci >= 0:
				comps[ci]["open"] = true
	return comps


func _union(p: PackedInt32Array, a: int, b: int) -> void:
	var ra := _find(p, a)
	var rb := _find(p, b)
	if ra != rb:
		p[maxi(ra, rb)] = mini(ra, rb)


func _find(p: PackedInt32Array, a: int) -> int:
	var r := a
	while p[r] != r:
		r = p[r]
	while p[a] != r:
		var nx := p[a]
		p[a] = r
		a = nx
	return r


# the parts made only of materials the biggest part isn't made of (a box's shells, a bottle's label?): taken out to go
# whole, the ones whose boxes overlap together
func _take_contents(pc: Array, comps: Array, whole: Array) -> Array:
	var main := 0
	for i in comps.size():
		if float(comps[i]["area"]) > float(comps[main]["area"]):
			main = i
	var mine: Dictionary = comps[main]["surfaces"]
	var big: AABB = comps[main]["aabb"]
	var out: Array = []
	for i in comps.size():
		if i == main:
			continue
		var own := true
		for s in comps[i]["surfaces"]:
			if mine.has(s):
				own = false
				break
		var bb: AABB = comps[i]["aabb"]
		if own and bb.size.length() < big.size.length() * 0.7:
			out.append(i)
	if out.is_empty():
		return pc
	# the ones that are mostly in each other go together (a shell's brass head round its hull), not the ones beside each
	# other (five shells lying side by side)
	var grp := PackedInt32Array()
	grp.resize(out.size())
	for i in out.size():
		grp[i] = i
	for i in out.size():
		for j in range(i + 1, out.size()):
			var a := (comps[out[i]]["aabb"] as AABB).grow(0.0005)
			var b := (comps[out[j]]["aabb"] as AABB).grow(0.0005)
			if a.intersects(b) and a.intersection(b).get_volume() >= 0.3 * minf(a.get_volume(), b.get_volume()):
				_union(grp, i, j)
	var taken := {}
	var groups := {}
	for i in out.size():
		var r := _find(grp, i)
		if not groups.has(r):
			groups[r] = _empty()
		var g: Array = groups[r]
		for st in comps[out[i]]["tris"]:
			var v: Vector2i = st
			var I: PackedInt32Array = pc[v.x]
			var gi: PackedInt32Array = g[v.x]
			gi.append(I[v.y])
			gi.append(I[v.y + 1])
			gi.append(I[v.y + 2])
			g[v.x] = gi
			taken[v] = true
	for r in groups:
		whole.append(groups[r])
	var rest := _empty()
	for s in _S:
		var I: PackedInt32Array = pc[s]
		var ri := PackedInt32Array()
		for t in range(0, I.size(), 3):
			if not taken.has(Vector2i(s, t)):
				ri.append(I[t])
				ri.append(I[t + 1])
				ri.append(I[t + 2])
		rest[s] = ri
	for i in range(comps.size() - 1, -1, -1):
		if out.has(i):
			comps.remove_at(i)
	return rest


# a single sheet's back drawn by the inside (the inside of a kettle, the plain side of a box's card): its triangles
# again, turned round, and every corner of it marked open (its cuts are never filled)
func _open_backs(pc: Array, comps: Array) -> void:
	var ins := _S - 1
	# their corners marked open, a surface at a time (the array held alone while it's written)
	for s in ins:
		var I: PackedInt32Array = pc[s]
		var O: PackedByteArray = _O[s]
		_O[s] = PackedByteArray()
		for c in comps:
			if bool(c["open"]):
				for st in c["tris"]:
					var v: Vector2i = st
					if v.x == s:
						O[I[v.y]] = 1
						O[I[v.y + 1]] = 1
						O[I[v.y + 2]] = 1
		_O[s] = O
	# their triangles again on the inside, turned round, each kept with its part (it goes whole with it, if it does)
	var ii: PackedInt32Array = pc[ins]
	_take(ins)
	for c in comps:
		if not bool(c["open"]):
			continue
		var backs: Array = []
		for st in c["tris"]:
			var v: Vector2i = st
			if v.x == ins:
				continue
			var I: PackedInt32Array = pc[v.x]
			var P: PackedVector3Array = _P[v.x]
			var N: PackedVector3Array = _N[v.x]
			var T: PackedFloat32Array = _T[v.x]
			backs.append(Vector2i(ins, ii.size()))
			for i in [I[v.y], I[v.y + 2], I[v.y + 1]]:
				_cP.append(P[i])
				_cN.append(-N[i])
				if _has_t[v.x]:
					_cT.append(T[i * 4])
					_cT.append(T[i * 4 + 1])
					_cT.append(T[i * 4 + 2])
					_cT.append(-T[i * 4 + 3])
				else:
					var tg := _tangent_of(-N[i])
					_cT.append(tg.x)
					_cT.append(tg.y)
					_cT.append(tg.z)
					_cT.append(1.0)
				_cU.append(Vector2(P[i].x + P[i].z, P[i].y))
				_cO.append(1)
				ii.append(_cP.size() - 1)
		(c["tris"] as Array).append_array(backs)
	_put()
	pc[ins] = ii


func _tangent_of(n: Vector3) -> Vector3:
	var t := n.cross(Vector3.UP if absf(n.y) < 0.9 else Vector3.RIGHT)
	return t.normalized() if t.length() > 1e-6 else Vector3.RIGHT


func _empty() -> Array:
	var pc: Array = []
	for s in _S:
		pc.append(PackedInt32Array())
	return pc


# ---- a cut ------------------------------------------------------------------------------------------------------

# a cut's normal: anywhere, or (wood) mostly across the grain's sides, so the pieces run along it
func _normal() -> Vector3:
	var r := Vector3(_rng.randfn(), _rng.randfn(), _rng.randfn())
	if r.length() < 1e-4:
		r = Vector3.UP
	r = r.normalized()
	if grain > 0.0 and _rng.randf() < grain:
		var q := r - grain_axis * r.dot(grain_axis)
		if q.length() > 0.05:
			r = q.normalized()
	return r


# the piece cut by the plane n.x = d: [behind, in front] with the cut filled on both, or [] when it misses
func _slice(pc: Array, n: Vector3, d: float) -> Array:
	var back := _empty()
	var front := _empty()
	var seg_a := PackedVector3Array()
	var seg_b := PackedVector3Array()
	var nb := 0
	var nf := 0
	_cache.clear()
	for s in _S:
		var I: PackedInt32Array = pc[s]
		if I.is_empty():
			continue
		_take(s)
		var bi := PackedInt32Array()
		var fi := PackedInt32Array()
		var w := _w[s]
		for t in range(0, I.size(), 3):
			var ia := I[t]
			var ib := I[t + 1]
			var ic := I[t + 2]
			var pa := _cP[ia]
			var pb := _cP[ib]
			var pq := _cP[ic]
			var sa := n.dot(pa) - d
			var sb := n.dot(pb) - d
			var sc := n.dot(pq) - d
			if sa <= 0.0 and sb <= 0.0 and sc <= 0.0:
				if sa == 0.0 and sb == 0.0 and sc == 0.0 and w * (pb - pa).cross(pq - pa).dot(n) < 0.0:
					fi.append(ia); fi.append(ib); fi.append(ic)
				else:
					bi.append(ia); bi.append(ib); bi.append(ic)
				continue
			if sa >= 0.0 and sb >= 0.0 and sc >= 0.0:
				fi.append(ia); fi.append(ib); fi.append(ic)
				continue
			# it crosses: each side's polygon (the triangle's own order), the crossing points shared by both
			var vi := [ia, ib, ic]
			var sv := [sa, sb, sc]
			var pbk := PackedInt32Array()
			var pft := PackedInt32Array()
			var on := PackedInt32Array()
			for k in 3:
				var i0: int = vi[k]
				var i1: int = vi[(k + 1) % 3]
				var s0: float = sv[k]
				var s1: float = sv[(k + 1) % 3]
				if s0 <= 0.0:
					pbk.append(i0)
				if s0 >= 0.0:
					pft.append(i0)
				if s0 == 0.0:
					on.append(i0)
				if (s0 < 0.0 and s1 > 0.0) or (s0 > 0.0 and s1 < 0.0):
					var m := _cut(s, i0, i1, s0, s1)
					pbk.append(m)
					pft.append(m)
					on.append(m)
			for k in range(1, pbk.size() - 1):
				bi.append(pbk[0]); bi.append(pbk[k]); bi.append(pbk[k + 1])
			for k in range(1, pft.size() - 1):
				fi.append(pft[0]); fi.append(pft[k]); fi.append(pft[k + 1])
			# its edge on the plane, turned so the solid is on its left seen from in front (n): a single sheet's never
			if on.size() == 2 and _cO[on[0]] == 0 and _cO[on[1]] == 0:
				var p := _cP[on[0]]
				var q := _cP[on[1]]
				if p.distance_squared_to(q) > 1e-14:
					var ng := (pb - pa).cross(pq - pa) * w
					var inward := -(ng - n * ng.dot(n))
					if n.cross(q - p).dot(inward) < 0.0:
						var tmp := p
						p = q
						q = tmp
					seg_a.append(p)
					seg_b.append(q)
		_put()
		back[s] = bi
		front[s] = fi
		nb += bi.size()
		nf += fi.size()
	if nb == 0 or nf == 0:
		return []
	if seg_a.size() >= 3:
		var cap := _fill(seg_a, seg_b, n, d)
		if cap.size() > 0:
			_caps += cap.size() / 3
			_add_cap(back, cap, n, false)
			_add_cap(front, cap, n, true)
	return [back, front]


# the vertex where the edge i0-i1 crosses the plane: one for both triangles that share the edge, worked out the same
# way whichever triangle asks (by the ends' places), so the cut's outline meets itself exactly
func _cut(s: int, i0: int, i1: int, s0: float, s1: float) -> int:
	var ck := s * 281474976710656 + mini(i0, i1) * 16777216 + maxi(i0, i1)
	if _cache.has(ck):
		return _cache[ck]
	var a := _cP[i0]
	var b := _cP[i1]
	var swap := b.x < a.x or (b.x == a.x and (b.y < a.y or (b.y == a.y and b.z < a.z)))
	var lo := i1 if swap else i0
	var hi := i0 if swap else i1
	var slo := s1 if swap else s0
	var shi := s0 if swap else s1
	var t := slo / (slo - shi)
	_cP.append(_cP[lo] + (_cP[hi] - _cP[lo]) * t)
	var nn := _cN[lo].lerp(_cN[hi], t)
	_cN.append(nn.normalized() if nn.length() > 1e-9 else _cN[lo])
	if _has_t[s]:
		var tv := Vector3(_cT[lo * 4], _cT[lo * 4 + 1], _cT[lo * 4 + 2]).lerp(Vector3(_cT[hi * 4], _cT[hi * 4 + 1], _cT[hi * 4 + 2]), t)
		tv = tv.normalized() if tv.length() > 1e-9 else Vector3.RIGHT
		_cT.append(tv.x)
		_cT.append(tv.y)
		_cT.append(tv.z)
		_cT.append(_cT[lo * 4 + 3])
	if _has_u[s]:
		_cU.append(_cU[lo].lerp(_cU[hi], t))
	if _has_u2[s]:
		_cU2.append(_cU2[lo].lerp(_cU2[hi], t))
	if _has_c[s]:
		_cC.append(_cC[lo].lerp(_cC[hi], t))
	_cO.append(1 if _cO[lo] == 1 and _cO[hi] == 1 else 0)
	var m := _cP.size() - 1
	_cache[ck] = m
	return m


# the cut's fill: its edges chained into outlines on the plane, the holes in them split off, filled; triangles in 3D
# (three points each) facing along n by the inside's winding
func _fill(seg_a: PackedVector3Array, seg_b: PackedVector3Array, n: Vector3, d: float) -> PackedVector3Array:
	var u := _tangent_of(n)
	var v := n.cross(u)
	var o := n * d
	var a2 := PackedVector2Array()
	var b2 := PackedVector2Array()
	for i in seg_a.size():
		var pa := seg_a[i] - o
		var pb := seg_b[i] - o
		a2.append(Vector2(pa.dot(u), pa.dot(v)) * MM)
		b2.append(Vector2(pb.dot(u), pb.dot(v)) * MM)
	var starts := {}
	for i in a2.size():
		var k := Vector2i(roundi(a2[i].x * 100.0), roundi(a2[i].y * 100.0))
		if not starts.has(k):
			starts[k] = PackedInt32Array()
		var lst: PackedInt32Array = starts[k]
		lst.append(i)
		starts[k] = lst
	var used := PackedByteArray()
	used.resize(a2.size())
	var outers: Array = []
	var holes: Array = []
	for i in a2.size():
		if used[i]:
			continue
		var loop := PackedVector2Array()
		var k0 := Vector2i(roundi(a2[i].x * 100.0), roundi(a2[i].y * 100.0))
		var cur := i
		var closed := false
		for guard in a2.size() + 1:
			used[cur] = 1
			loop.append(a2[cur])
			var kb := Vector2i(roundi(b2[cur].x * 100.0), roundi(b2[cur].y * 100.0))
			if kb == k0:
				closed = true
				break
			var nxt := -1
			for j in starts.get(kb, PackedInt32Array()):
				if not used[j]:
					nxt = j
					break
			if nxt < 0:
				break
			cur = nxt
		if not closed:
			continue
		loop = _clean(loop)
		if loop.size() < 3:
			continue
		var ar := _area(loop)
		if ar > 1e-4:
			outers.append(loop)
		elif ar < -1e-4:
			holes.append(loop)
	var out := PackedVector3Array()
	if outers.is_empty():
		return out
	# each hole in the smallest outline it's in
	var mine: Array = []
	for ol in outers:
		mine.append([])
	for h in holes:
		var best := -1
		var ba := INF
		for j in outers.size():
			if Geometry2D.is_point_in_polygon((h as PackedVector2Array)[0], outers[j]) and _area(outers[j]) < ba:
				ba = _area(outers[j])
				best = j
		if best >= 0:
			(mine[best] as Array).append(h)
	for j in outers.size():
		for poly in _no_holes(outers[j], mine[j], 0):
			var pp: PackedVector2Array = poly
			var tri := Geometry2D.triangulate_polygon(pp)
			if tri.is_empty():
				tri = _delaunay_fill(pp)
			for t in range(0, tri.size(), 3):
				var p0 := pp[tri[t]]
				var p1 := pp[tri[t + 1]]
				var p2 := pp[tri[t + 2]]
				var cr := (p1 - p0).cross(p2 - p0)
				if absf(cr) < 1e-9:
					continue
				if cr * _W < 0.0:
					var tmp := p1
					p1 = p2
					p2 = tmp
				for p in [p0, p1, p2]:
					var q: Vector2 = p / MM
					out.append(o + u * q.x + v * q.y)
	return out


# the outline without its repeated and straight-through points
func _clean(loop: PackedVector2Array) -> PackedVector2Array:
	var out := PackedVector2Array()
	for p in loop:
		if out.is_empty() or out[out.size() - 1].distance_squared_to(p) > 1e-8:
			out.append(p)
	if out.size() > 1 and out[0].distance_squared_to(out[out.size() - 1]) <= 1e-8:
		out.remove_at(out.size() - 1)
	var changed := true
	while changed and out.size() >= 3:
		changed = false
		for i in out.size():
			var a := out[(i - 1 + out.size()) % out.size()]
			var b := out[i]
			var c := out[(i + 1) % out.size()]
			if absf((b - a).cross(c - b)) < 1e-7 * maxf((b - a).length() * (c - b).length(), 1e-6) and (b - a).dot(c - b) > 0.0:
				out.remove_at(i)
				changed = true
				break
	return out


func _area(poly: PackedVector2Array) -> float:
	var s := 0.0
	for i in poly.size():
		var a := poly[i]
		var b := poly[(i + 1) % poly.size()]
		s += a.x * b.y - b.x * a.y
	return s * 0.5


# an outline with holes as outlines without: cut down a hole's middle, each half with the hole taken out of it (a
# notch), the holes left in each half the same way
func _no_holes(outer: PackedVector2Array, holes: Array, depth: int) -> Array:
	if holes.is_empty() or depth > 8:
		return [outer]
	var h: PackedVector2Array = holes[0]
	var cx := 0.0
	for p in h:
		cx += p.x
	cx /= float(h.size())
	var bb := Rect2(outer[0], Vector2.ZERO)
	for p in outer:
		bb = bb.expand(p)
	bb = bb.grow(1.0)
	var halves := [
		PackedVector2Array([bb.position, Vector2(cx, bb.position.y), Vector2(cx, bb.end.y), Vector2(bb.position.x, bb.end.y)]),
		PackedVector2Array([Vector2(cx, bb.position.y), Vector2(bb.end.x, bb.position.y), bb.end, Vector2(cx, bb.end.y)])]
	var out: Array = []
	for half in halves:
		for part in Geometry2D.intersect_polygons(outer, half):
			var parts: Array = [_ccw(part)]
			var inner: Array = []
			for hh in holes:
				var lo := INF
				var hi := -INF
				for p in hh:
					lo = minf(lo, p.x)
					hi = maxf(hi, p.x)
				if lo < cx and hi > cx:
					var nxt: Array = []
					for pp in parts:
						for q in Geometry2D.clip_polygons(pp, _ccw(hh)):
							if absf(_area(q)) > 1e-4:
								nxt.append(_ccw(q))
					parts = nxt
				else:
					inner.append(hh)
			for pp in parts:
				var here: Array = []
				for hh in inner:
					if Geometry2D.is_point_in_polygon((hh as PackedVector2Array)[0], pp):
						here.append(hh)
				out.append_array(_no_holes(pp, here, depth + 1))
	return out


func _ccw(p: PackedVector2Array) -> PackedVector2Array:
	if _area(p) >= 0.0:
		return p
	var r := p.duplicate()
	r.reverse()
	return r


# when the ear clipping can't: Delaunay's triangles of its points whose middles are inside it
func _delaunay_fill(poly: PackedVector2Array) -> PackedInt32Array:
	var tri := Geometry2D.triangulate_delaunay(poly)
	var out := PackedInt32Array()
	for t in range(0, tri.size(), 3):
		var m := (poly[tri[t]] + poly[tri[t + 1]] + poly[tri[t + 2]]) / 3.0
		if Geometry2D.is_point_in_polygon(m, poly):
			out.append(tri[t])
			out.append(tri[t + 1])
			out.append(tri[t + 2])
	return out


# the fill added to a piece's inside: behind the cut it faces n, in front of it the other way
func _add_cap(pc: Array, cap: PackedVector3Array, n: Vector3, flip: bool) -> void:
	var ins := _S - 1
	var nn := -n if flip else n
	var tg := _tangent_of(nn)
	var bt := nn.cross(tg)
	_take(ins)
	var ii: PackedInt32Array = pc[ins]
	for t in range(0, cap.size(), 3):
		var tri := [cap[t], cap[t + 2], cap[t + 1]] if flip else [cap[t], cap[t + 1], cap[t + 2]]
		for p in tri:
			var q: Vector3 = p
			_cP.append(q)
			_cN.append(nn)
			_cT.append(tg.x)
			_cT.append(tg.y)
			_cT.append(tg.z)
			_cT.append(1.0)
			_cU.append(Vector2(q.dot(tg), q.dot(bt)))
			_cO.append(0)
			ii.append(_cP.size() - 1)
	_put()
	pc[ins] = ii


# ---- the pieces --------------------------------------------------------------------------------------------------

# a piece's middle (by its triangles' areas), box and area
func _measure(pc: Array) -> Dictionary:
	var c := Vector3.ZERO
	var area := 0.0
	var bb := AABB()
	var first := true
	for s in _S:
		var I: PackedInt32Array = pc[s]
		var P: PackedVector3Array = _P[s]
		for t in range(0, I.size(), 3):
			var a := P[I[t]]
			var b := P[I[t + 1]]
			var d := P[I[t + 2]]
			var ar := (b - a).cross(d - a).length() * 0.5
			c += (a + b + d) * (ar / 3.0)
			area += ar
			if first:
				bb = AABB(a, Vector3.ZERO)
				first = false
			bb = bb.expand(a).expand(b).expand(d)
	return {"center": c / area if area > 1e-12 else bb.get_center(), "aabb": bb, "area": area}


# a piece split where its triangles don't join (by where their corners are)
func _split_apart(pc: Array) -> Array:
	var ids := {}
	var parent := PackedInt32Array()
	var corner: Array = []
	for s in _S:
		var I: PackedInt32Array = pc[s]
		var P: PackedVector3Array = _P[s]
		var cs := PackedInt32Array()
		cs.resize(I.size())
		for t in I.size():
			var k := _key(P[I[t]])
			var id: int = ids.get(k, -1)
			if id < 0:
				id = parent.size()
				ids[k] = id
				parent.append(id)
			cs[t] = id
		corner.append(cs)
		for t in range(0, I.size(), 3):
			_union(parent, cs[t], cs[t + 1])
			_union(parent, cs[t], cs[t + 2])
	var parts := {}
	for s in _S:
		var I: PackedInt32Array = pc[s]
		var cs: PackedInt32Array = corner[s]
		for t in range(0, I.size(), 3):
			var r := _find(parent, cs[t])
			if not parts.has(r):
				parts[r] = _empty()
			var g: Array = parts[r]
			var gi: PackedInt32Array = g[s]
			gi.append(I[t])
			gi.append(I[t + 1])
			gi.append(I[t + 2])
			g[s] = gi
	return parts.values()


# a piece as arrays for an ArrayMesh, crumpled (the same push for every surface at a place, so it stays joined), with
# what HSBlowUp needs to throw it: its middle, box, radius, area (its outside's), its thin side and how thin, its hull
func _leaf(pc: Array, noise: FastNoiseLite) -> Dictionary:
	var surfaces: Array = []
	var used := {}
	var all_p := PackedVector3Array()
	var n_tris := 0
	for s in _S:
		var I: PackedInt32Array = pc[s]
		if I.is_empty():
			surfaces.append(null)
			continue
		var P: PackedVector3Array = _P[s]
		var N: PackedVector3Array = _N[s]
		var T: PackedFloat32Array = _T[s]
		var U: PackedVector2Array = _U[s]
		var U2: PackedVector2Array = _U2[s]
		var C: PackedColorArray = _C[s]
		var local := {}
		var lp := PackedVector3Array()
		var ln := PackedVector3Array()
		var lt := PackedFloat32Array()
		var lu := PackedVector2Array()
		var lu2 := PackedVector2Array()
		var lc := PackedColorArray()
		var li := PackedInt32Array()
		li.resize(I.size())
		for t in I.size():
			var g := I[t]
			var l: int = local.get(g, -1)
			if l < 0:
				l = lp.size()
				local[g] = l
				lp.append(P[g])
				ln.append(N[g])
				if _has_t[s]:
					lt.append(T[g * 4])
					lt.append(T[g * 4 + 1])
					lt.append(T[g * 4 + 2])
					lt.append(T[g * 4 + 3])
				if _has_u[s]:
					lu.append(U[g])
				if _has_u2[s]:
					lu2.append(U2[g])
				if _has_c[s]:
					lc.append(C[g])
				used[s * 16777216 + g] = true
			li[t] = l
		n_tris += I.size() / 3
		surfaces.append({"P": lp, "N": ln, "T": lt, "U": lu, "U2": lu2, "C": lc, "I": li})
	if n_tris == 0:
		return {}
	# crumpled: one push a place, the normals made again from the faces (the outside and the inside apart, so a cut's
	# edge stays sharp)
	if noise != null:
		var acc := {}
		for s in _S:
			var sf = surfaces[s]
			if sf == null:
				continue
			var lp: PackedVector3Array = sf["P"]
			for i in lp.size():
				var p := lp[i]
				lp[i] = p + Vector3(noise.get_noise_3dv(p), noise.get_noise_3dv(p + Vector3(31.7, 0, 0)), noise.get_noise_3dv(p + Vector3(0, 47.3, 0))) * crumple_m
			sf["P"] = lp
		for s in _S:
			var sf = surfaces[s]
			if sf == null:
				continue
			var lp: PackedVector3Array = sf["P"]
			var li: PackedInt32Array = sf["I"]
			var side := 1 if s == _S - 1 else 0
			for t in range(0, li.size(), 3):
				var f := (lp[li[t + 1]] - lp[li[t]]).cross(lp[li[t + 2]] - lp[li[t]]) * _w[s]
				for k in 3:
					var key := [_key(lp[li[t + k]]), side]
					acc[key] = (acc.get(key, Vector3.ZERO) as Vector3) + f
		for s in _S:
			var sf = surfaces[s]
			if sf == null:
				continue
			var lp: PackedVector3Array = sf["P"]
			var ln: PackedVector3Array = sf["N"]
			var side := 1 if s == _S - 1 else 0
			for i in lp.size():
				var f: Vector3 = acc.get([_key(lp[i]), side], Vector3.ZERO)
				if f.length() > 1e-12:
					ln[i] = f.normalized()
			sf["N"] = ln
	# its middle, box, radius, area, thin side, hull
	var c := Vector3.ZERO
	var area_all := 0.0
	var area_out := 0.0
	var thin := Vector3.ZERO
	var bb := AABB()
	var first := true
	var pts := {}
	for s in _S:
		var sf = surfaces[s]
		if sf == null:
			continue
		var lp: PackedVector3Array = sf["P"]
		var li: PackedInt32Array = sf["I"]
		for t in range(0, li.size(), 3):
			var a := lp[li[t]]
			var b := lp[li[t + 1]]
			var d := lp[li[t + 2]]
			var cr := (b - a).cross(d - a)
			var ar := cr.length() * 0.5
			c += (a + b + d) * (ar / 3.0)
			area_all += ar
			if s != _S - 1:
				area_out += ar
				thin += cr * _w[s] * 0.5
		for p in lp:
			if first:
				bb = AABB(p, Vector3.ZERO)
				first = false
			bb = bb.expand(p)
			pts[_key(p)] = p
	if area_all < 1e-8:
		return {}
	c /= area_all
	var radius := 0.0
	var uniq: Array = pts.values()
	for p in uniq:
		radius = maxf(radius, c.distance_to(p))
	# its own axes (the points' principal axes, the thinnest last) and how far it reaches along each
	var axes := _axes(uniq)
	var ext := Vector3.ZERO
	for k in 3:
		var lo := INF
		var hi := -INF
		for p in uniq:
			var q: float = (p as Vector3).dot(axes[k])
			lo = minf(lo, q)
			hi = maxf(hi, q)
		ext[k] = hi - lo
	var thin_axis: Vector3 = axes[2]
	var thick := ext.z
	var verts := PackedVector3Array()
	for p in uniq:
		verts.append(p)
	return {"surfaces": surfaces, "center": c, "aabb": bb, "radius": radius, "area": area_out, "thin": thin_axis,
		"thick": thick, "axes": axes, "ext": ext, "hull": _hull_points(uniq, c), "verts": verts, "tris": n_tris, "_used": used}


# the points' principal axes, the longest first: the covariance's eigenvectors by power iteration, the largest, then
# the next with the first taken out, the third square to both
func _axes(pts: Array) -> Array:
	var n := float(pts.size())
	if n < 3.0:
		return [Vector3.RIGHT, Vector3.UP, Vector3.BACK]
	var m := Vector3.ZERO
	for p in pts:
		m += p
	m /= n
	var xx := 0.0
	var xy := 0.0
	var xz := 0.0
	var yy := 0.0
	var yz := 0.0
	var zz := 0.0
	for p in pts:
		var d: Vector3 = (p as Vector3) - m
		xx += d.x * d.x
		xy += d.x * d.y
		xz += d.x * d.z
		yy += d.y * d.y
		yz += d.y * d.z
		zz += d.z * d.z
	var C := Basis(Vector3(xx, xy, xz), Vector3(xy, yy, yz), Vector3(xz, yz, zz))
	var v1 := Vector3(0.6, 0.53, 0.6)
	for i in 40:
		var w := C * v1
		if w.length() < 1e-14:
			break
		v1 = w.normalized()
	var l1 := v1.dot(C * v1)
	var D := Basis(C.x - v1 * (l1 * v1.x), C.y - v1 * (l1 * v1.y), C.z - v1 * (l1 * v1.z))
	var v2 := v1.cross(Vector3.UP if absf(v1.y) < 0.9 else Vector3.RIGHT).normalized()
	for i in 40:
		var w := D * v2
		w -= v1 * w.dot(v1)
		if w.length() < 1e-14:
			break
		v2 = w.normalized()
	var v3 := v1.cross(v2).normalized()
	return [v1, v2, v3]


# up to 64 points for its hull: the farthest along 26 ways, and the rest evenly picked
func _hull_points(uniq: Array, c: Vector3) -> PackedVector3Array:
	var out := PackedVector3Array()
	if uniq.size() <= 64:
		for p in uniq:
			out.append(p)
		return out
	var dirs: Array = []
	for x in [-1, 0, 1]:
		for y in [-1, 0, 1]:
			for z in [-1, 0, 1]:
				if x != 0 or y != 0 or z != 0:
					dirs.append(Vector3(x, y, z).normalized())
	var picked := {}
	for dv in dirs:
		var best := 0
		var bd := -INF
		for i in uniq.size():
			var q: float = ((uniq[i] as Vector3) - c).dot(dv)
			if q > bd:
				bd = q
				best = i
		picked[best] = true
	var step := maxi(1, uniq.size() / (64 - picked.size()))
	for i in range(0, uniq.size(), step):
		picked[i] = true
	for i in picked:
		if out.size() >= 64:
			break
		out.append(uniq[i])
	return out


# which leaves touch: they share a vertex a cut made (or one on a cut's plane)
func _touching(leaves: Array) -> Array:
	var owner := {}
	var touch: Array = []
	for i in leaves.size():
		touch.append(PackedInt32Array())
	for i in leaves.size():
		for k in (leaves[i] as Dictionary).get("_used", {}):
			var o: int = owner.get(k, -1)
			if o < 0:
				owner[k] = i
			elif o != i:
				var a: PackedInt32Array = touch[o]
				if not a.has(i):
					a.append(i)
					touch[o] = a
				var b: PackedInt32Array = touch[i]
				if not b.has(o):
					b.append(o)
					touch[i] = b
	return touch


# a node's leaves, middle and radius, from its children up
func _fill_node(nodes: Array, j: int, leaves: Array) -> void:
	var nd: Dictionary = nodes[j]
	var ls := PackedInt32Array()
	if nd.has("leaf"):
		ls.append(int(nd["leaf"]))
	for ch in nd["children"]:
		_fill_node(nodes, ch, leaves)
		ls.append_array(nodes[ch]["leaves"])
	nd["leaves"] = ls
	var c := Vector3.ZERO
	var w := 0.0
	for l in ls:
		var lf: Dictionary = leaves[l]
		var a := maxf(float(lf["area"]), 1e-6)
		c += (lf["center"] as Vector3) * a
		w += a
	c = c / w if w > 0.0 else Vector3.ZERO
	var r := 0.0
	for l in ls:
		var lf: Dictionary = leaves[l]
		r = maxf(r, c.distance_to(lf["center"]) + float(lf["radius"]))
	nd["center"] = c
	nd["radius"] = r
