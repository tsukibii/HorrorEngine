@tool
extends VBoxContainer
## The dock's Things tab (docs/GODOT_DIRECTOR.md §6): what the open scene holds, by kind, each with its id (what an
## event, a to-do or a door names it by) and where it is: the items (taken from pickups), the notes, the characters
## and what they do, the areas (rooms and triggers), the doors and their locks, the spots, the paths, the lights.

var dock = null
var tree: Tree
var _sig := ""


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree = Tree.new()
	tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree.hide_root = true
	tree.columns = 2
	tree.set_column_expand_ratio(0, 2)
	tree.item_selected.connect(func(): var it := tree.get_selected(); if it != null and it.get_metadata(0) != null: dock.select(it.get_metadata(0)))
	add_child(tree)


func tick() -> void:
	var r = dock.root() if dock != null else null
	var s := str(r.find_children("*", "", true, false).size()) if r != null else ""
	if s != _sig:
		refresh()


func refresh() -> void:
	if tree == null or dock == null:
		return
	tree.clear()
	var top := tree.create_item()
	var r = dock.root()
	if r == null:
		return
	_sig = str(r.find_children("*", "", true, false).size())
	var groups := [["Items (picked up)", "HSThing", func(n): return n.use in ["pickup", "carry"], func(n): return [n.item_id(), n.item_name if n.item_name != "" else n.display_name]],
		["Notes", "HSThing", func(n): return n.use == "note", func(n): return [HSDirector.id_of(n), n.note_title]],
		["Things to use", "HSThing", func(n): return not (n.use in ["pickup", "carry", "note"]), func(n): return [HSDirector.id_of(n), n.use + ("  hidden at start" if n.hidden_at_start else "")]],
		["Characters", "HSActor", func(n): return true, func(n): return [HSDirector.id_of(n), n.behaviour + (" · watches" if n.sees_player else "") + (" · talks" if n.talk else "") + (" · hidden at start" if n.hidden_at_start else "")]],
		["Rooms", "HSRoom", func(n): return true, func(n): return [HSDirector.id_of(n), "%s floor, %.1f × %.1f m" % [n.floor_kind, n.size.x, n.size.z]]],
		["Areas", "HSTrigger", func(n): return true, func(n): return [HSDirector.id_of(n), "%d events%s" % [HSDirector.nodes_of(n, "HSEvent").size(), " · safe" if n.safe else ""]]],
		["Doors", "HSDoor", func(n): return true, func(n): return [HSDirector.id_of(n), ("locked by " + n.locked_by) if n.locked_by != "" else "open"]],
		["Spots", "HSSpot", func(n): return true, func(n): return [HSDirector.id_of(n), ""]],
		["Paths", "HSPath", func(n): return true, func(n): return [HSDirector.id_of(n), "%d points, %s" % [n.points().size(), n.mode]]],
		["Levels", "HSLevel", func(n): return true, func(n): return [HSDirector.id_of(n), "starts at " + n.start_id()]]]
	for g in groups:
		var nodes: Array = HSDirector.nodes_of(r, g[1]).filter(g[2])
		if HSDirector.class_of(r) == g[1] and g[2].call(r):
			nodes.push_front(r)
		if nodes.is_empty():
			continue
		var gi := tree.create_item(top)
		gi.set_text(0, "%s (%d)" % [g[0], nodes.size()])
		gi.set_custom_color(0, Color(0.75, 0.82, 1.0))
		gi.set_selectable(0, false)
		gi.set_selectable(1, false)
		for n in nodes:
			var it := tree.create_item(gi)
			var d: Array = g[3].call(n)
			it.set_text(0, str(d[0]))
			it.set_text(1, str(d[1]))
			it.set_icon(0, dock.icon_of(n))
			it.set_metadata(0, n)
			it.set_tooltip_text(0, str(r.get_path_to(n)))
	var lights: Array = r.find_children("*", "Light3D", true, false).filter(func(l): return not (l is DirectionalLight3D))
	if lights.size():
		var li := tree.create_item(top)
		li.set_text(0, "Lights (%d)" % lights.size())
		li.set_custom_color(0, Color(0.75, 0.82, 1.0))
		li.set_selectable(0, false)
		for l in lights:
			var it := tree.create_item(li)
			it.set_text(0, HSDirector.snake(str(l.name)))
			it.set_text(1, "%s%s" % [l.get_class(), "" if l.visible else " · off at start"])
			it.set_metadata(0, l)
