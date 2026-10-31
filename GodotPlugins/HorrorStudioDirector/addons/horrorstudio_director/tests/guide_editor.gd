## The guide's pictures of the editor (guides/director/, `tools/godot_director.py guide` installs this as a plugin of its
## own and opens the editor on the sample under xvfb): the whole editor with the dock, each of the dock's tabs, and
## the Inspector on an event, an action, a thing, a character, a room and a task. JPEGs into $HSGUIDE_OUT; prints
## GUIDEEDITOR {...} and quits.
@tool
extends EditorPlugin

const TABS := ["Story", "Events", "Flags", "Things", "Add", "Check", "Kimodo"]
const INSPECT := [["e_insp_event", "FigureScare"], ["e_insp_thing", "Letter"], ["e_insp_actor", "Mari"], ["e_insp_room", "Hall"],
	["e_insp_task", "Arrive"], ["e_insp_door", "BedroomDoor"]]

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


func _tab(name: String) -> void:
	for i in dock.tabs.get_tab_count():
		if dock.tabs.get_tab_control(i).name == name:
			dock.tabs.current_tab = i
	dock.refresh()


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
			dock.select(r.find_child("Arrive", true, false))
			_tab("Story")
			at = t
			phase = 2
		2:
			if t - at < 6.0:
				return
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
			if TABS[step] == "Flags":
				var root_it: TreeItem = dock.flags_tab.tree.get_root()
				if root_it != null:
					for it in root_it.get_children():
						if it.get_text(0).begins_with("read_letter"):
							it.collapsed = false
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
		5:                                            # the Inspector on the main kinds of node
			var r := EditorInterface.get_edited_scene_root()
			if step >= INSPECT.size() + 1:
				_tab("Story")
				print("GUIDEEDITOR " + JSON.stringify({"made": made}))
				get_tree().quit()
				return
			if step < INSPECT.size():
				dock.select(r.find_child(INSPECT[step][1], true, false))
			else:
				var ev = r.find_child("FigureScare", true, false)
				EditorInterface.edit_resource(ev.actions[0])     # one of an event's actions: its verb's fields only
			at = t
			phase = 6
		6:
			if t - at < 1.5:
				return
			_shot(INSPECT[step][0] if step < INSPECT.size() else "e_insp_action", _inspector_rect())
			step += 1
			phase = 5
