## A Godot room as Kimodo's stage (docs/GODOT_DIRECTOR.md §6b; tools/kimodo.py stage writes the same from a story):
## the floors, walls, doors (their swing on the floor), the things and any other mesh near the character, and the
## marks (the spots, the other characters, the player's start with its eye), as boxes in Kimodo's axes (x her left,
## y up, z forward) from where the character stands, facing her +Z, scaled by Kimodo's body height over hers, so
## after the retarget a hand on a door handle stays on it. Kimodo's demo opens the last one written
## (Saved/Kimodo/stage.json in the studio, KIMODO_STAGE): its Stage panel.
@tool
class_name HSKimodoStage
extends RefCounted

const ALPHA := {"floor": 0.6, "door": 1.6, "use": 1.6}


static func soma_height() -> float:
	var S := HSRetarget.soma()
	if S.is_empty():
		return 1.764
	var lo := INF
	var hi := -INF
	for r in S["rest"]:
		lo = min(lo, float(r[1]))
		hi = max(hi, float(r[1]))
	return hi - lo


static func _r(x: float) -> float:
	return snappedf(x, 0.001)


## the stage around `origin` (an HSActor, an HSSpot or any Node3D) in `scope` (its level, or the scene); opts: all
## (the whole scope, not only the rooms by her), scale (over Kimodo's height over hers)
static func make(origin: Node3D, scope: Node, opts: Dictionary = {}) -> Dictionary:
	var who_h: float = float(origin.get("height")) if HSDirector.class_of(origin) == "HSActor" else 1.7
	var s: float = float(opts.get("scale", soma_height() / who_h))
	var fw: Vector3 = origin.global_transform.basis.z
	var f := Vector3(fw.x, 0, fw.z).normalized()
	if f.length() < 0.5:
		f = Vector3(0, 0, 1)
	var left := Vector3(f.z, 0, -f.x)
	var o := origin.global_position
	var kim := func(p: Vector3) -> Array:
		var d := p - o
		return [_r(s * d.dot(left)), _r(s * d.y), _r(s * d.dot(f))]
	var yaw_x := func(x_axis: Vector3) -> float:          # a box's own x axis, as Kimodo turns a box about y
		return _r(rad_to_deg(atan2(-x_axis.dot(f), x_axis.dot(left))))
	var heading := func(z_axis: Vector3) -> float:        # a mark's facing, as Kimodo turns a mark about y (0: the same way as her)
		return _r(rad_to_deg(atan2(z_axis.dot(left), z_axis.dot(f))))
	# the rooms she's in and the ones touching it (or every room)
	var rooms: Array = HSDirector.nodes_of(scope, "HSRoom")
	if HSDirector.class_of(scope) == "HSRoom":
		rooms.push_front(scope)
	var mine: Array = []
	if opts.get("all", false):
		mine = rooms
	else:
		var home = null
		for r in rooms:
			if r.holds(o + Vector3(0, 0.1, 0)):
				home = r
		if home == null and rooms.size():
			var best := INF
			for r in rooms:
				var dd: float = r.volume().get_center().distance_to(o)
				if dd < best:
					best = dd
					home = r
		if home != null:
			var hb: AABB = home.volume().grow(0.4)
			for r in rooms:
				if r == home or hb.intersects(r.volume().grow(0.05)):
					mine.append(r)
	var region := AABB()
	for i in mine.size():
		region = mine[i].volume().grow(0.3) if i == 0 else region.merge(mine[i].volume().grow(0.3))
	var inside := func(p: Vector3) -> bool:
		return mine.is_empty() or region.has_point(p)
	var boxes: Array = []
	var marks: Array = []
	var arcs: Array = []
	var box := func(id: String, kind: String, xf: Transform3D, size: Vector3, label: bool) -> void:
		var b := {"id": id, "kind": kind, "center": kim.call(xf.origin), "size": [_r(s * size.x), _r(s * size.y), _r(s * size.z)], "yaw": yaw_x.call(xf.basis.x.normalized())}
		if ALPHA.has(kind):
			b["alpha"] = ALPHA[kind]
		if label:
			b["label"] = id
		boxes.append(b)
	for r in mine:
		var g = r.get_node_or_null("_gen")
		if g == null:
			continue
		for blk in g.get_children():
			if not (blk is StaticBody3D) or str(blk.name) == "ceiling":
				continue
			var shapes: Array = blk.find_children("*", "CollisionShape3D", false, false)
			if shapes.is_empty() or not (shapes[0].shape is BoxShape3D):
				continue
			box.call(HSDirector.id_of(r) + "__" + str(blk.name), "floor" if str(blk.name) == "floor" else "wall", blk.global_transform, shapes[0].shape.size, false)
	for dn in HSDirector.nodes_of(scope, "HSDoor"):
		if not inside.call(dn.global_position):
			continue
		var dxf: Transform3D = dn.global_transform
		var did := HSDirector.id_of(dn)
		box.call(did, "door", Transform3D(dxf.basis, dxf * Vector3(0, dn.height / 2.0, 0)), Vector3(dn.width, dn.height, dn.thickness), true)
		if not dn.sliding:                                # the leaf's sweep on the floor, into the room its +Z faces
			var hx: float = (-1.0 if dn.hinge == "left" else 1.0) * dn.width / 2.0
			var pts: Array = []
			for k in range(0, 91, 6):
				var a := deg_to_rad(float(k))
				var lp := Vector3(hx - sign(hx) * dn.width * cos(a), 0.01, dn.width * sin(a))
				pts.append(kim.call(dxf * lp))
			pts.append(kim.call(dxf * Vector3(hx, 0.01, 0)))
			arcs.append({"id": did, "points": pts})
	for tn in HSDirector.nodes_of(scope, "HSThing"):
		if not inside.call(tn.global_position):
			continue
		var a: AABB = HSDirector.local_aabb(tn)
		if a.size == Vector3.ZERO:
			continue
		box.call(HSDirector.id_of(tn), "use" if tn.use != "none" else "mesh", Transform3D(tn.global_transform.basis.orthonormalized(), tn.global_transform * a.get_center()), a.size, true)
	if opts.get("meshes", true):                         # the user's own meshes in the rooms (furniture with no HSThing round it)
		for mi in scope.find_children("*", "MeshInstance3D", true, false):
			if _under_hs(mi, scope) or not mi.visible:
				continue
			var ma: AABB = mi.get_aabb()
			var c: Vector3 = mi.global_transform * ma.get_center()
			if not inside.call(c) or ma.size.length() < 0.05:
				continue
			box.call(str(mi.name), "mesh", Transform3D(mi.global_transform.basis.orthonormalized(), c), ma.size * mi.global_transform.basis.get_scale(), false)
	var level = scope if HSDirector.class_of(scope) == "HSLevel" else null
	var start_id: String = level.start_id() if level != null else ""
	for sp in HSDirector.nodes_of(scope, "HSSpot"):
		if not inside.call(sp.global_position) or sp == origin:
			continue
		var sid := HSDirector.id_of(sp)
		var player: bool = sid == start_id or sid.contains("start") or sid.contains("player") or sid.contains("view")
		var m := {"id": sid, "kind": "player" if player else "mark", "pos": kim.call(sp.global_position), "yaw": heading.call(sp.global_transform.basis.z)}
		if player:
			m["eye"] = _r(m["pos"][1] + s * 1.65)
		marks.append(m)
	for ac in HSDirector.nodes_of(scope, "HSActor"):
		if ac == origin or not inside.call(ac.global_position):
			continue
		marks.append({"id": HSDirector.id_of(ac), "kind": "mark", "pos": kim.call(ac.global_position), "yaw": heading.call(ac.global_transform.basis.z)})
	var who := HSDirector.id_of(origin)
	var info := "**%s** from `%s` (Godot): %s. Scaled x%.3f for %s (%.2f m; Kimodo's body %.2f m). Orange doors (arcs: their swing), green things to use, red player marks." % [
		str(scope.name), who, ", ".join(mine.map(func(r): return HSDirector.id_of(r))) if mine.size() else "everything near", s, who, who_h, soma_height()]
	var fov := 90.0
	var g = HSDirector.edited_root()
	if g != null and HSDirector.class_of(g) == "HSGame":
		fov = g.fov
	return {"info": info, "game": str(g.get("title")) if g != null and g.get("title") != null else "", "at": who, "who": who, "scale": snappedf(s, 0.0001), "fov": fov,
		"boxes": boxes, "marks": marks, "arcs": arcs}


## inside one of the plugin's own nodes (an HSRoom's walls, an HSThing's model are sent as theirs)
static func _under_hs(n: Node, stop: Node) -> bool:
	var p := n.get_parent()
	while p != null and p != stop:
		if HSDirector.class_of(p) in ["HSRoom", "HSDoor", "HSThing", "HSActor", "HSTrigger", "HSSpot"]:
			return true
		p = p.get_parent()
	return false


## where the studio is (tools/kimodo.py, Saved/Kimodo): kimodo/studio_root.txt (tools/godot_director.py writes it), or
## the project setting horrorstudio/director/studio_root
static func studio_root() -> String:
	var ps := str(ProjectSettings.get_setting("horrorstudio/director/studio_root", ""))
	if ps != "":
		return ps
	if FileAccess.file_exists("res://kimodo/studio_root.txt"):
		return FileAccess.get_file_as_string("res://kimodo/studio_root.txt").strip_edges()
	return ""


## the stage written where Kimodo's demo opens it, and kept in the project (kimodo/stages/<who>.json); the paths
static func write(stage: Dictionary) -> Array:
	var out: Array = []
	var txt := JSON.stringify(stage, " ")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://kimodo/stages"))
	var p1 := "res://kimodo/stages/%s.json" % stage.get("who", "stage")
	var f := FileAccess.open(p1, FileAccess.WRITE)
	if f != null:
		f.store_string(txt)
		f.close()
		out.append(ProjectSettings.globalize_path(p1))
	var root := studio_root()
	if root != "" and DirAccess.dir_exists_absolute(root):
		DirAccess.make_dir_recursive_absolute(root.path_join("Saved/Kimodo"))
		var p2 := root.path_join("Saved/Kimodo/stage.json")
		var f2 := FileAccess.open(p2, FileAccess.WRITE)
		if f2 != null:
			f2.store_string(txt)
			f2.close()
			out.append(p2)
	return out
