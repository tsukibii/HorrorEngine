## DIRECTOR's editor part (tools/godot_director.py check installs this as a plugin of its own and opens the editor):
## the sample's main scene opened with the Director plugin on; its dock found and every tab drawn on it (the Story
## tab's chapters and steps, the events as sentences, the flags with the one checked and never set, the things, the
## check's summary); the dock's buttons used as the user would (a task added after the selected step, a to-do in
## it, a jumpscare made from its template with its area and figure, a preset placed from the Add tab), each on the
## editor's undo (undone and redone); the scene saved and read back. Prints HSDIRECTOREDITOR {...} and quits.
@tool
extends EditorPlugin

var t := 0.0
var phase := 0
var at_t := 0.0
var mug: MeshInstance3D = null
var book: MeshInstance3D = null
var rep := {}
var dock = null


func _enter_tree() -> void:
	set_process(true)


func _find_dock(n: Node):
	for c in n.get_children():
		if c.get_script() != null and str(c.get_script().resource_path).ends_with("horrorstudio_director/editor/dock.gd"):
			return c
		var f = _find_dock(c)
		if f != null:
			return f
	return null


func _done() -> void:
	print("HSDIRECTOREDITOR " + JSON.stringify(rep))
	get_tree().quit()


func _process(dt: float) -> void:
	t += dt
	if t > 300.0:
		rep["timeout"] = true
		_done()
		return
	match phase:
		0:
			if t > 2.0:
				EditorInterface.open_scene_from_path("res://main.tscn")
				phase = 1
		1:
			var r := EditorInterface.get_edited_scene_root()
			if r == null or r.name != "Game":
				return
			dock = _find_dock(EditorInterface.get_base_control())
			rep["dock"] = dock != null
			if dock == null:
				_done()
				return
			phase = 2
		2:
			_tabs()
			phase = 3
		3:
			_edits()
			_parts_start()
			at_t = t
			phase = 30
		30:                                               # the parts' markers and the dropped part's wrap come a frame later
			if t - at_t < 1.0:
				return
			_parts_check()
			at_t = t
			phase = 31
		31:
			if t - at_t < 0.5:
				return
			_parts_undone()
			phase = 4
		4:
			rep["saved"] = EditorInterface.save_scene() == OK
			var txt := FileAccess.get_file_as_string("res://main.tscn")
			rep["saved_task"] = txt.contains("[node name=\"OlderKey") and not txt.contains("HSEvent")
			rep["saved_nothing_made"] = not txt.contains("name=\"_gen\"") and not txt.contains("name=\"_solid\"")
			_done()


func _tab(name: String) -> Control:
	var tc: TabContainer = dock.tabs
	for i in tc.get_tab_count():
		if tc.get_tab_control(i).name == name:
			tc.current_tab = i
			return tc.get_tab_control(i)
	return null


func _rows(tree: Tree) -> Array:
	var out: Array = []
	var it := tree.get_root()
	var stack: Array = [it] if it != null else []
	while stack.size():
		var x: TreeItem = stack.pop_back()
		if x != tree.get_root():
			out.append(x.get_text(0))
		var ch := x.get_children()
		ch.reverse()
		stack.append_array(ch)
	return out


func _tabs() -> void:
	var dt = _tab("Director")
	dt.refresh()
	var rows := _rows(dt.tree)
	rep["director_rows"] = rows.size()
	rep["director_has"] = rows.any(func(r): return r.begins_with("Quests (5)")) and rows.any(func(r): return r == "The key") and rows.any(func(r): return r == "A drink") \
		and rows.any(func(r): return r.begins_with("☐ Give Mari the mug")) and rows.any(func(r): return r.begins_with("Endings (2)")) and rows.any(func(r): return r == "figure_scare")
	var th = _tab("Things")
	th.refresh()
	rep["things_rows"] = _rows(th.tree).size()
	var ck = _tab("Check")
	ck.refresh()
	rep["check_summary"] = ck.summary.text
	var gb = dock.find_child("Guide", true, false)        # the Guide button finds the project's own copy (install's guide/)
	rep["guide"] = gb is Button and dock.guide_path() == ProjectSettings.globalize_path("res://guide/index.html")
	dock.on_run_start("q_key__card", [])                 # what the running game sends (HSGame through the debugger)
	dock.on_run_step("q_drink", ["@q_key", "done:q_key", "read:letter", "step:read_letter"])
	dock.on_run_flag("saw_figure")
	dt = _tab("Director")
	dt.refresh()
	var live := _rows(dt.tree)
	rep["live_now"] = live.any(func(r): return r == "▶ A drink") and live.any(func(r): return r == "✓ The key")
	rep["live_facts"] = live.any(func(r): return r == "● read:letter") and live.any(func(r): return r == "● saw_figure") and live.any(func(r): return r.begins_with("✓ Read the letter"))
	dock.on_run_stop()


func _edits() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var add = _tab("Add")
	dock.select(r.find_child("Hall", true, false))
	var things := r.find_children("*", "HSThing", true, false).size()
	add._place("res://addons/horrorstudio_director/presets/key.tscn")
	var placed := r.find_children("*", "HSThing", true, false)
	var key = null
	for x in placed:
		if str(x.name).begins_with("Key"):
			key = x
	rep["preset_placed"] = placed.size() == things + 1 and key != null and key.scene_file_path == "" and key.owner == r and key.get_parent().name == "Hall"
	rep["preset_dbg"] = [placed.size(), things, str(key.name) if key != null else "", key.scene_file_path if key != null else "", str(key.owner.name) if key != null and key.owner != null else "", str(key.get_parent().name) if key != null else ""]
	var ck = _tab("Check")
	ck.refresh()
	rep["check_after"] = ck.summary.text
	var th := HSThing.new()                           # added as Add Child Node names it, then renamed: its id follows the name
	th.name = "HSThing"
	dock.add_node(r.find_child("Hall", true, false), th, "add a thing")
	var first: String = th.id
	th.name = "OldKey"
	rep["id_follows"] = [first, th.id]
	th.id = "my_key"
	th.name = "OlderKey"
	rep["id_kept"] = th.id


## parts (DECISIONS 2026-11-01): a mesh of the user's made a cup from the dock (selected, clicked), another dropped on by
## a pickup part as the Scene tree drops a file
func _parts_start() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var kitchen: Node = r.find_child("Kitchen", true, false)
	mug = MeshInstance3D.new()
	mug.name = "Teacup"
	var cm := CylinderMesh.new()
	cm.top_radius = 0.04
	cm.bottom_radius = 0.04
	cm.height = 0.1
	mug.mesh = cm
	mug.position = Vector3(1.0, 0.75, 1.0)
	kitchen.add_child(mug)
	mug.owner = r
	dock.select(mug)
	_tab("Add").make("res://addons/horrorstudio_director/parts/cup.tscn")
	book = MeshInstance3D.new()
	book.name = "Book"
	book.mesh = BoxMesh.new()
	book.position = Vector3(1.2, 0.75, 1.0)
	kitchen.add_child(book)
	book.owner = r
	var drop: Node3D = (load("res://addons/horrorstudio_director/parts/pickup.tscn") as PackedScene).instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)
	book.add_child(drop)
	drop.owner = r


func _parts_check() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var cup = mug.get_parent()
	var pts: Array = []
	var owned := true
	for c in cup.get_children():
		if c is Marker3D:
			pts.append(str(c.name))
			owned = owned and c.owner == r
	pts.sort()
	rep["part_made"] = HSDirector.class_of(cup) == "HSThing" and cup.use == "life" and cup.life == "cup" and str(cup.name) == "Teacup" and cup.owner == r and cup.get_parent().name == "Kitchen"
	rep["part_points"] = pts
	rep["part_points_owned"] = owned and pts.size() > 0
	var bk = book.get_parent()
	rep["part_dropped"] = HSDirector.class_of(bk) == "HSThing" and bk.use == "pickup" and str(bk.name) == "Book" and bk.scene_file_path == "" and book.get_child_count() == 0
	var ur := get_undo_redo()
	ur.get_history_undo_redo(ur.get_object_history_id(r)).undo()


func _parts_undone() -> void:
	var r := EditorInterface.get_edited_scene_root()
	rep["part_drop_undone"] = book.get_parent() != null and book.get_parent().name == "Kitchen" and book.get_child_count() == 1 and HSDirector.class_of(book.get_child(0)) == "HSThing"
	for n in [book, mug]:                              # the scene left as the sample had it, the parts too
		var top: Node = n
		while top.get_parent() != null and top.get_parent().name != "Kitchen":
			top = top.get_parent()
		top.get_parent().remove_child(top)
		top.free()


func _items(tree: Tree) -> Array:
	var out: Array = []
	var stack: Array = [tree.get_root()]
	while stack.size():
		var x: TreeItem = stack.pop_back()
		if x == null:
			continue
		out.append(x)
		stack.append_array(x.get_children())
	return out
