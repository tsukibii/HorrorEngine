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
			phase = 4
		4:
			rep["saved"] = EditorInterface.save_scene() == OK
			var txt := FileAccess.get_file_as_string("res://main.tscn")
			rep["saved_task"] = txt.contains("[node name=\"Task") and txt.contains("[node name=\"ScareArea")
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
	var st = _tab("Story")
	st.refresh()
	var rows := _rows(st.tree)
	rep["story_rows"] = rows.size()
	rep["story_has"] = rows.any(func(r): return r.begins_with("Chapter · Night 1")) and rows.any(func(r): return r == "The key") and rows.any(func(r): return r.begins_with("Choice · "))
	var ev = _tab("Events")
	ev.refresh()
	var er := _rows(ev.tree)
	rep["events_rows"] = er
	rep["events_has_scare"] = er.any(func(r): return r.contains("JUMPSCARE: figure") and r.contains("if read_letter"))
	var fl = _tab("Flags")
	fl.refresh()
	var fr := _rows(fl.tree)
	rep["flags_rows"] = fr.filter(func(r): return not r.begins_with("set by") and not r.begins_with("checked by"))
	var th = _tab("Things")
	th.refresh()
	rep["things_rows"] = _rows(th.tree).size()
	var ck = _tab("Check")
	ck.refresh()
	rep["check_summary"] = ck.summary.text
	var gb = dock.find_child("Guide", true, false)        # the Guide button finds the project's own copy (install's guide/)
	rep["guide"] = gb is Button and dock.guide_path() == ProjectSettings.globalize_path("res://guide/index.html")
	dock.on_run_start("night1__card", [])                 # what the running game sends (HSGame through the debugger)
	dock.on_run_step("arrive", ["@arrive", "read_letter"])
	dock.on_run_flag("saw_figure")
	st = _tab("Story")
	st.refresh()
	rep["live_now"] = _rows(st.tree).any(func(r): return r == "▶ The key")
	fl = _tab("Flags")
	fl.refresh()
	rep["live_flags"] = _rows(fl.tree).any(func(r): return r.begins_with("● read_letter")) and _rows(fl.tree).any(func(r): return r.begins_with("● saw_figure"))
	dock.on_run_stop()


func _edits() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var ur := get_undo_redo()
	var st = _tab("Story")
	var arrive := r.find_child("Arrive", true, false)
	dock.select(arrive)
	st.refresh()
	for it in _items(st.tree):
		if it.get_metadata(0) == arrive:
			it.select(0)
	var before := r.find_children("*", "HSTask", true, false).size()
	st._add_task()
	var tasks := r.find_children("*", "HSTask", true, false)
	var added = null
	for x in tasks:
		if str(x.name).begins_with("Task"):
			added = x
	rep["task_added"] = tasks.size() == before + 1 and added != null and added.get_index() == arrive.get_index() + 1 and added.get_parent() == arrive.get_parent()
	rep["task_has_todo"] = added != null and added.get_child_count() == 1 and added.get_child(0) is HSTodo
	ur.get_history_undo_redo(ur.get_object_history_id(r)).undo()
	rep["task_undone"] = r.find_children("*", "HSTask", true, false).size() == before
	ur.get_history_undo_redo(ur.get_object_history_id(r)).redo()
	rep["task_redone"] = r.find_children("*", "HSTask", true, false).size() == before + 1
	var ev = _tab("Events")
	ev.picker.select(0)
	dock.select(r.find_child("House", true, false))
	var areas := r.find_children("*", "HSTrigger", true, false).size()
	ev._make()
	var scare := r.find_child("ScareArea", true, false)
	var sev: Array = scare.find_children("*", "HSEvent", false, false) if scare != null else []
	rep["jumpscare_made"] = r.find_children("*", "HSTrigger", true, false).size() == areas + 1 and sev.size() == 1 and sev[0].actions.size() == 3
	ev.refresh()
	rep["jumpscare_listed"] = _rows(ev.tree).any(func(x): return x.contains("JUMPSCARE") and x.contains("scare_area_done"))
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
