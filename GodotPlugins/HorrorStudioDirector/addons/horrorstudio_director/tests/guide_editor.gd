## The guide's pictures of the editor (guides/director/, `tools/godot_director.py guide` installs this as a plugin of its
## own and opens the editor on the sample under xvfb): the whole editor with the dock, each of the dock's tabs (the
## Director tab on the sample's Director file, a quest picked), the Scene tree on a part's effect points, and the
## Inspector on a thing, a character, a room, a door and a little thing. JPEGs into $HSGUIDE_OUT; prints
## GUIDEEDITOR {...} and quits.
@tool
extends EditorPlugin

const TABS := ["Director", "Things", "Add", "Check", "Kimodo"]
const INSPECT := [["e_insp_thing", "Letter"], ["e_insp_actor", "Mari"], ["e_insp_room", "Hall"], ["e_insp_door", "BedroomDoor"],
	["e_insp_life", "Kettle"]]

var t := 0.0
var phase := 0
var at := 0.0
var step := 0
var out := ""
var dock = null
var made: Array = []


func _enter_tree() -> void:
	out = OS.get_environment("HSGUIDE_OUT")
	set_process(true)


func _find(n: Node):
	for c in n.get_children():
		if c.get_script() != null and str(c.get_script().resource_path).ends_with("horrorstudio_director/editor/dock.gd"):
			return c
		var f = _find(c)
		if f != null:
			return f
	return null


func _shot(name: String, rect: Rect2 = Rect2()) -> void:
	var img := EditorInterface.get_base_control().get_viewport().get_texture().get_image()
	if rect.size != Vector2.ZERO:
		var r := Rect2i(rect).intersection(Rect2i(Vector2i.ZERO, img.get_size()))
		img = img.get_region(r)
	img.save_jpg(out.path_join(name + ".jpg"), 0.9)
	made.append(name)


## the dock's area with its title row above it
func _dock_rect() -> Rect2:
	var r: Rect2 = dock.get_global_rect()
	return r.grow_side(SIDE_TOP, 34)


func _inspector_rect() -> Rect2:
	var ins := EditorInterface.get_inspector()
	var r: Rect2 = ins.get_global_rect()
	return r.grow_side(SIDE_TOP, 110)


## the Scene dock (its tree of nodes) with its title row
func _scene_rect() -> Rect2:
	for c in EditorInterface.get_base_control().find_children("*", "", true, false):
		if c.get_class() == "SceneTreeDock" and c is Control and (c as Control).is_visible_in_tree():
			var r: Rect2 = (c as Control).get_global_rect().grow_side(SIDE_TOP, 34)
			return Rect2(r.position, Vector2(r.size.x, min(r.size.y, 640.0)))
	return Rect2(0, 0, 420, 700)


func _tab(name: String) -> void:
	for i in dock.tabs.get_tab_count():
		if dock.tabs.get_tab_control(i).name == name:
			dock.tabs.current_tab = i
	dock.refresh()


## the Director tab's row for a quest, picked (as a click would: ▶ Here plays from it)
func _pick_quest(id: String) -> void:
	var tree: Tree = dock.director_tab.tree
	var top := tree.get_root()
	if top == null:
		return
	for sec in top.get_children():
		for it in sec.get_children():
			var m = it.get_metadata(0)
			if m is Dictionary and m.get("quest") == id:
				it.select(0)
				tree.scroll_to_item(it)
				return


func _process(dt: float) -> void:
	t += dt
	if t > 300.0:
		print("GUIDEEDITOR " + JSON.stringify({"made": made, "timeout": true}))
		get_tree().quit()
		return
	match phase:
		0:
			if t > 3.0:
				EditorInterface.open_scene_from_path("res://main.tscn")
				phase = 1
		1:
			var r := EditorInterface.get_edited_scene_root()
			if r == null or r.name != "Game" or t < 9.0:
				return
			dock = _find(EditorInterface.get_base_control())
			if dock == null:
				print("GUIDEEDITOR " + JSON.stringify({"made": made, "no_dock": true}))
				get_tree().quit()
				return
			var q: Node = dock                           # the right-hand column wider than its default, so the pictures' rows read whole
			while q != null:
				var par = q.get_parent()
				if par is SplitContainer and not par.vertical:
					var offs = par.get("split_offsets")      # 4.7's editor: one split holding every column, a dragger between the shown ones ([left, -right])
					if offs is PackedInt32Array and offs.size() >= 1:
						offs[offs.size() - 1] -= 170
						par.set("split_offsets", offs)
					else:
						par.split_offset -= 170
					break
				q = par
			dock.select(r.find_child("Kettle", true, false))
			_tab("Director")
			at = t
			phase = 2
		2:
			if t - at < 6.0:
				return
			_pick_quest("q_drink")
			_shot("e_overview")
			step = 0
			at = t
			phase = 3
		3:                                            # each tab of the dock
			if step >= TABS.size():
				step = 0
				phase = 5
				return
			if at >= 0.0 and t - at < 0.2:
				return
			_tab(TABS[step])
			if TABS[step] == "Director":
				_pick_quest("q_drink")
			if TABS[step] == "Check":
				dock.check_tab.refresh()
			at = t
			phase = 4
		4:
			if t - at < 1.5:
				return
			_shot("e_tab_" + TABS[step].to_lower(), _dock_rect())
			step += 1
			at = t
			phase = 3
		5:                                            # the Inspector on the main kinds of node, then the Scene tree on a part's points
			var r := EditorInterface.get_edited_scene_root()
			if step >= INSPECT.size() + 1:
				_tab("Director")
				print("GUIDEEDITOR " + JSON.stringify({"made": made}))
				get_tree().quit()
				return
			if step < INSPECT.size():
				dock.select(r.find_child(INSPECT[step][1], true, false))
			else:
				var kettle = r.find_child("Kettle", true, false)
				dock.select(kettle.get_node_or_null("spout") if kettle != null else null)
			at = t
			phase = 6
		6:
			if t - at < 1.5:
				return
			if step < INSPECT.size():
				_shot(INSPECT[step][0], _inspector_rect())
			else:
				_shot("e_tree_parts", _scene_rect())
			step += 1
			phase = 5
