## The rooms' walls as a level builds them (HSRoom, docs/GODOT_DIRECTOR.md §3): the project's main scene loaded, its
## levels taken out of the game so every room builds as it does in the editor, and the boxes of their walls measured:
## never two rooms' wall faces in one plane facing the same way (they z-fight: a line down the wall flickering as the
## eye moves, the user's of 2026-11-03: a room's north or south wall run on to the face of the corridor's wall it met),
## nor two rooms' floors or ceilings (in a doorway they did), every room's corner closed all the way up and its floor and
## ceiling whole out to its walls' outer faces. Prints WALLS ok or WALLS FAIL and quits.
##   godot --headless --path PROJECT -s res://addons/horrorstudio_director/tests/walls_check.gd [-- --scene=res://main.tscn]
extends SceneTree


func _initialize() -> void:
	var scene := "res://main.tscn"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--scene="):
			scene = a.substr(8)
	var ps := load(scene) as PackedScene
	if ps == null:
		print("WALLS FAIL: no %s" % scene)
		quit(1)
		return
	var game := ps.instantiate()
	var levels: Array = []
	_find_levels(game, levels)
	var holder := Node3D.new()                            # out of the game (it holds its levels as templates) and not straight
	holder.name = "Walls"                                 # under the root (a level there plays alone): under this they build
	root.add_child(holder)
	for lv in levels:
		lv.get_parent().remove_child(lv)
		lv.owner = null
		holder.add_child(lv)
	await process_frame                                   # (in the tree once the loop runs: the rooms build in their _ready)
	await process_frame
	var rooms_n := 0
	var walls_n := 0
	var bad: Array = []
	for lv in levels:
		var rooms: Array = []
		_find_rooms(lv, rooms)
		rooms_n += rooms.size()
		var boxes: Array = []                             # [room, world AABB] of every wall
		var slabs := {"floor": [], "ceiling": []}         # and of every floor and ceiling block
		for r in rooms:
			var gen: Node = r.get_node_or_null("_gen")
			if gen == null:
				continue
			for b in gen.get_children():
				if not (b is StaticBody3D):
					continue
				var cs := b.find_children("*", "CollisionShape3D", false, false)
				if cs.is_empty():
					continue
				var sz: Vector3 = ((cs[0] as CollisionShape3D).shape as BoxShape3D).size
				var bb: AABB = b.global_transform * AABB(-sz / 2.0, sz)
				var nm := str(b.name)
				if nm.begins_with("wall_"):
					boxes.append([r, bb])
				elif nm.begins_with("floor"):
					slabs["floor"].append([r, bb])
				elif nm.begins_with("ceiling"):
					slabs["ceiling"].append([r, bb])
		walls_n += boxes.size()
		for kind in slabs:                                # two rooms' floors (ceilings) never in one plane: in a doorway they z-fought
			var sl: Array = slabs[kind]
			for i in sl.size():
				for j in range(i + 1, sl.size()):
					var a: AABB = sl[i][1]
					var c: AABB = sl[j][1]
					if sl[i][0] == sl[j][0] or abs((a.end.y if kind == "floor" else a.position.y) - (c.end.y if kind == "floor" else c.position.y)) > 1e-5:
						continue
					var ox: float = min(a.end.x, c.end.x) - max(a.position.x, c.position.x)
					var oz: float = min(a.end.z, c.end.z) - max(a.position.z, c.position.z)
					if ox > 0.001 and oz > 0.001:                 # (under a millimetre: a sliver no eye sees)
						bad.append("%s and %s: %ss in one plane (%.2f x %.2f m)" % [sl[i][0].name, sl[j][0].name, kind, ox, oz])
		for r in rooms:                                   # and every room's floor and ceiling whole, out to its walls' outer faces
			for kind in ["floor", "ceiling"]:
				if not r.get(kind + "_on"):
					continue
				var holes := 0
				for i in 13:
					for j in 13:
						var p := Vector3((r.size.x / 2.0 + r.wall - 0.002) * (i / 6.0 - 1.0), -0.001 if kind == "floor" else r.size.y + 0.001,
							(r.size.z / 2.0 + r.wall - 0.002) * (j / 6.0 - 1.0))
						var g: Vector3 = r.global_transform * p
						var inside := false
						for b in slabs[kind]:
							if (b[1] as AABB).grow(1e-4).has_point(g):
								inside = true
								break
						if not inside:
							holes += 1
				if holes:
					bad.append("%s's %s has holes (%d of 169 points)" % [r.name, kind, holes])
		for i in boxes.size():
			for j in range(i + 1, boxes.size()):
				if boxes[i][0] != boxes[j][0]:
					var f := _fight(boxes[i][1], boxes[j][1])
					if f != "":
						bad.append("%s and %s: faces in one plane (%s)" % [boxes[i][0].name, boxes[j][0].name, f])
		for r in rooms:
			for c in _open_corners(r, boxes):
				bad.append("%s's %s corner open" % [r.name, c])
	holder.queue_free()
	game.free()
	for b in bad.slice(0, 12):
		print("  BAD " + str(b))
	if bad.is_empty():
		print("WALLS ok (%d levels, %d rooms, %d walls: no two rooms' wall faces, floors or ceilings in one plane, every corner closed, every floor and ceiling whole)" % [levels.size(), rooms_n, walls_n])
	else:
		print("WALLS FAIL (%d)" % bad.size())
	quit(0 if bad.is_empty() else 1)


func _find_levels(n: Node, out: Array) -> void:
	for c in n.get_children():
		if c is HSLevel:
			out.append(c)
		else:
			_find_levels(c, out)


func _find_rooms(n: Node, out: Array) -> void:
	for c in n.get_children():
		if c is HSRoom:
			out.append(c)
		_find_rooms(c, out)


## two walls' upright faces in one plane, facing the same way and overlapping (by more than a tenth of a millimetre)
func _fight(a: AABB, b: AABB) -> String:
	for ax: int in [0, 2]:
		var other: int = 2 - ax
		for side in [0, 1]:
			var fa: float = a.position[ax] + (a.size[ax] if side else 0.0)
			var fb: float = b.position[ax] + (b.size[ax] if side else 0.0)
			if abs(fa - fb) > 1e-5:
				continue
			var ov: float = min(a.end[other], b.end[other]) - max(a.position[other], b.position[other])
			var oy: float = min(a.end.y, b.end.y) - max(a.position.y, b.position.y)
			if ov > 1e-4 and oy > 1e-4:
				return "%s = %.3f" % ["x" if ax == 0 else "z", fa]
	return ""


## a room's corners where it has both walls, its square not filled all the way up by the level's walls
func _open_corners(r: HSRoom, boxes: Array) -> Array:
	var out: Array = []
	var w: float = r.wall
	for zs in [[-1.0, HSRoom.N, "north"], [1.0, HSRoom.S, "south"]]:
		for xs in [[-1.0, HSRoom.W, "west"], [1.0, HSRoom.E, "east"]]:
			if not (r.walls & int(zs[1])) or not (r.walls & int(xs[1])):
				continue
			var open := false
			for i in 5:
				for j in 5:
					for k in 5:
						var p := Vector3(float(xs[0]) * (r.size.x / 2.0 + 0.004 + (w - 0.008) * i / 4.0), 0.01 + (r.size.y - 0.02) * k / 4.0,
							float(zs[0]) * (r.size.z / 2.0 + 0.004 + (w - 0.008) * j / 4.0))
						var g: Vector3 = r.global_transform * p
						var inside := false
						for b in boxes:
							if (b[1] as AABB).grow(1e-5).has_point(g):
								inside = true
								break
						if not inside:
							open = true
			if open:
				out.append("%s-%s" % [zs[2], xs[2]])
	return out
