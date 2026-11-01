## DIRECTOR's editor part (tools/godot_director.py check installs this as a plugin of its own and opens the editor):
## the sample's main scene opened with the Director plugin on; its dock found and every tab drawn on it (the Story
## tab's chapters and steps, the events as sentences, the flags with the one checked and never set, the things, the
## check's summary); the dock's buttons used as the user would (a task added after the selected step, a to-do in
## it, a jumpscare made from its template with its area and figure), each on the editor's undo (undone and redone);
## the HorrorStudio panel (editor/panel.gd) as the user would use it: its categories and cards, a search, a model's
## suggestions (the panel's and the Inspector's box), one click making it the thing, made plain again, the mouse's
## ray finding a model, a window, a scare; the scene saved and read back. Prints HSDIRECTOREDITOR {...} and quits.
@tool
extends EditorPlugin

var t := 0.0
var phase := 0
var at_t := 0.0
var mug: MeshInstance3D = null
var book: MeshInstance3D = null
var rep := {}
var dock = null
var panel = null


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


func _find_script(n: Node, tail: String):
	for c in n.get_children():
		if c.get_script() != null and str(c.get_script().resource_path).ends_with(tail):
			return c
		var f = _find_script(c, tail)
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
			panel = _find_script(EditorInterface.get_base_control(), "horrorstudio_director/editor/panel.gd")
			rep["dock"] = dock != null
			rep["panel_found"] = panel != null
			if dock == null or panel == null:
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
			_panel_checks()
			at_t = t
			phase = 32
		32:
			if t - at_t < 0.5:
				return
			_panel_after()
			_player_checks()
			_story_checks()
			at_t = t
			phase = 33
		33:                                               # the Story tab's ready-made moment dropped in the 3D view lands a frame later
			if t - at_t < 0.5:
				return
			_story_after()
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
	dock.select(r.find_child("Hall", true, false))
	var things := r.find_children("*", "HSThing", true, false).size()
	panel.build.place("res://addons/horrorstudio_director/presets/key.tscn")
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
	panel.build.assign(mug, panel.build.items_by_id["cup"])
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


## the HorrorStudio panel (DECISIONS 2026-11-01, later: "work through everything"): the Build tab's categories and
## cards, a search, a model's suggestions by its name (the panel's and the Inspector's box), one click making it the
## thing, its card saying so, made plain again and undone, the mouse's ray finding a model with no collider, a window
## in a room's wall (undone), a scare's area and its moment
var pan := {}
func _panel_checks() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var b = panel.build
	var kitchen: Node = r.find_child("Kitchen", true, false)
	rep["panel_bottom"] = panel.default_slot == EditorDock.DOCK_SLOT_BOTTOM
	rep["panel_rail"] = b.rail_buttons.keys()
	b.show_category("kitchen")
	rep["panel_kitchen"] = b.cards.size()
	b.search("kettle")
	var found: Array = b.cards.keys()
	found.sort()
	rep["panel_search"] = found
	b.search("")
	var pot := MeshInstance3D.new()
	pot.name = "OldSaucepan"
	pot.mesh = CylinderMesh.new()
	pot.position = Vector3(-1.0, 0.8, 0.5)
	kitchen.add_child(pot)
	pot.owner = r
	dock.select(pot)
	panel.on_selection()
	rep["panel_suggest"] = b.suggestions(pot).map(func(x): return x["id"])
	b.show_category("kitchen")
	rep["panel_card_ready"] = b.cards["pot"].find_child("Foot", true, false).text
	var box: Control = panel.plugin.inspector.box(pot)
	var mb = box.find_child("MakeIt", true, false)
	rep["panel_inspector"] = mb is MenuButton and mb.get_popup().get_item_count() >= 10 and box.find_child("Suggest_pot", true, false) != null
	box.free()
	b.assign(pot, b.items_by_id["pot"])
	var thing: Node = pot.get_parent()
	rep["panel_assigned"] = HSDirector.class_of(thing) == "HSThing" and thing.use == "life" and thing.life == "pot" and str(thing.name) == "OldSaucepan" and thing.get_parent() == kitchen
	dock.select(thing)
	panel.on_selection()
	b.refresh()
	rep["panel_card_now"] = b.cards["pot"].find_child("Foot", true, false).text
	var said := []
	for l in b.side.find_children("*", "Label", true, false):
		said.append(l.text)
	rep["panel_side"] = said.has("is a pot") and said.any(func(x): return str(x).begins_with("Named by") or str(x).begins_with("Nothing in the story"))
	b._plain(thing)
	rep["panel_plain"] = pot.get_parent() == kitchen and thing.get_parent() == null and str(pot.name) == "OldSaucepan"
	var ur := get_undo_redo()
	ur.get_history_undo_redo(ur.get_object_history_id(r)).undo()
	rep["panel_plain_undone"] = pot.get_parent() == thing and thing.get_parent() == kitchen
	var top := pot.global_position + Vector3(0, 3, 0)
	var hit = panel.plugin.model_on_ray(top, Vector3.DOWN)
	rep["panel_ray"] = hit == thing                    # the mouse's ray meets the pot inside the thing: the thing
	var before: int = kitchen.openings.size()
	b.add_window(kitchen)
	var ops: Array = kitchen.openings
	rep["panel_window"] = ops.size() == before + 1 and ops[-1].glass and ops[-1].daylight and ops[-1].sill > 0.5
	ur.get_history_undo_redo(ur.get_object_history_id(r)).undo()
	rep["panel_window_undone"] = kitchen.openings.size() == before
	pan["story_was"] = FileAccess.get_file_as_string("res://director/director.json")
	dock.select(kitchen)
	b.activate(b.items_by_id["scare_jumpscare"])
	var area = dock.selected()
	pan["area"] = area
	var f := HSStoryFile.read()
	var m = null
	for x in f.get("moments", []):
		if area != null and x.get("when", {}).get("enter") == HSDirector.id_of(area):
			m = x
	rep["panel_scare"] = area != null and HSDirector.class_of(area) == "HSTrigger" and str(area.name) == "Jumpscare" and m != null and str(m["do"][0].get("trick")) == "jumpscare"
	pan["thing"] = thing


func _panel_after() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var ur := get_undo_redo()
	ur.get_history_undo_redo(ur.get_object_history_id(r)).undo()   # the scare's area
	rep["panel_scare_undone"] = not is_instance_valid(pan["area"]) or pan["area"].get_parent() == null
	var f := FileAccess.open("res://director/director.json", FileAccess.WRITE)   # the story as the sample had it
	f.store_string(pan["story_was"])
	f.close()
	var th = pan["thing"]
	if is_instance_valid(th) and th.get_parent() != null:
		th.get_parent().remove_child(th)
		th.free()


## the Player category: the sample's starts there already (one each a level: their cards say so, a click selects the
## one there), a start's facing and pocket set from This object and undone, a checkpoint placed (an area) and undone
func _player_checks() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var b = panel.build
	var ur := get_undo_redo()
	var hist = ur.get_history_undo_redo(ur.get_object_history_id(r))
	rep["player_rail_first"] = str(b.rail_buttons.keys()[0]) if b.rail_buttons.size() else ""
	var kitchen: Node = r.find_child("Kitchen", true, false)
	dock.select(kitchen)
	panel.on_selection()
	b.show_category("player")
	var cards: Array = b.cards.keys()
	rep["player_cards"] = cards
	rep["player_card_foot"] = b.cards["player_start"].find_child("Foot", true, false).text if b.cards.has("player_start") else ""
	b.activate(b.items_by_id["test_start"])
	var ts = dock.selected()
	rep["player_test_selected"] = ts != null and str(ts.name) == "TestStart"
	b.activate(b.items_by_id["player_start"])
	var st = dock.selected()
	rep["player_start_selected"] = st != null and str(st.name) == "Start"
	panel.on_selection()
	b.refresh()
	var ob: OptionButton = b.side.find_child("Facing", true, false)
	rep["player_facing"] = ob.get_item_text(ob.selected) if ob != null else ""
	var was: float = st.rotation_degrees.y if st != null else 0.0   # (read back from its basis: -180 is 180)
	if ob != null:
		ob.select(2)
		ob.item_selected.emit(2)                       # East
	rep["player_turned"] = st != null and absf(wrapf(st.rotation_degrees.y - 90.0, -180.0, 180.0)) < 0.01
	hist.undo()
	rep["player_turn_undone"] = st != null and absf(wrapf(st.rotation_degrees.y - was, -180.0, 180.0)) < 0.01 and absf(wrapf(was - 180.0, -180.0, 180.0)) < 0.01
	b.refresh()
	var add: MenuButton = b.side.find_child("AddItem", true, false)
	var pop: PopupMenu = add.get_popup() if add != null else null
	var mug := -1
	if pop != null:
		for i in pop.item_count:
			if pop.get_item_text(i) == "mug":
				mug = pop.get_item_id(i)
	if mug >= 0:
		pop.id_pressed.emit(mug)
	rep["player_item"] = st != null and Array(st.starts_with) == ["mug"]
	hist.undo()
	rep["player_item_undone"] = st != null and st.starts_with.is_empty()
	rep["player_play_button"] = b.side.find_child("PlayFromHere", true, false) != null
	dock.select(kitchen)
	b.activate(b.items_by_id["checkpoint"])
	var cp = dock.selected()
	rep["player_checkpoint"] = cp != null and HSDirector.class_of(cp) == "HSCheckpoint" and (HSDirector.scan(r).get("area", []) as Array).has(HSDirector.id_of(cp))
	hist.undo()
	rep["player_checkpoint_undone"] = not is_instance_valid(cp) or cp.get_parent() == null


## the Story tab (panel step 3): the sample's quests in order; the drink errand's steps and moments as sentences; a
## ready-made jumpscare clicked with the kitchen's doorway selected (a moment on it, in this quest); a clause, a
## command and its words added from the pickers, every time, what it reads as; Try this moment's request; a ready-made
## moment dropped inside the doorway in the 3D view landing on it (the new area taken back); all of it undone
func _story_checks() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var st = panel.story
	var ur := get_undo_redo()
	var glob := ur.get_history_undo_redo(EditorUndoRedoManager.GLOBAL_HISTORY)
	pan["story_was"] = FileAccess.get_file_as_string("res://director/director.json")
	panel.show_page("story")
	st.refresh()
	rep["story_quests"] = st.left.get_children().filter(func(c): return str(c.name).begins_with("Quest_")).map(func(c): return c.text)
	rep["story_struck"] = st.left.find_children("*", "RichTextLabel", true, false).any(func(l): return str(l.text).contains("✓ [s]Read the letter[/s]"))
	st.quest = "q_drink"
	st.opened = ""
	st.refresh(false)
	rep["story_lines"] = st.mid.find_children("Line_*", "Button", true, false).map(func(c): return str(c.text))
	var doorway := r.find_child("KitchenDoorway", true, false)
	dock.select(doorway)
	var jump: Dictionary = st.ready_items().filter(func(it): return it["id"] == "scare_jumpscare")[0]
	var mid_id: String = st.add_ready(jump)
	var m := _moment(mid_id)
	rep["story_ready"] = m.get("when") == {"enter": "kitchen_doorway"} and m.get("during") == ["q_drink"] and str(m["do"][0].get("trick")) == "jumpscare"
	var box: Control = st.mid.find_child("Moment_" + mid_id, true, false)
	rep["story_when"] = str(box.find_child("WhenVerb", true, false).text) if box != null else ""
	_menu_pick(box.find_child("AddClause", true, false), "they've read", "letter")
	st.refresh(false)                                 # (what the tab does once the menu has let go)
	box = st.mid.find_child("Moment_" + mid_id, true, false)
	_menu_pick(box.find_child("AddThen", true, false), "Story", "Think")
	st.refresh(false)
	box = st.mid.find_child("Moment_" + mid_id, true, false)
	var row: Control = box.find_child("Do_1", true, false)
	var le: LineEdit = row.find_child("F_think", true, false) if row != null else null
	if le != null:
		le.text = "Who's there?"
		le.focus_exited.emit()                        # (saved without drawing the tab again: its sentence says it)
	box = st.mid.find_child("Moment_" + mid_id, true, false)
	rep["story_typed"] = str(box.find_child("ReadsAs", true, false).text).contains("Who's there?") and le != null and le.is_inside_tree()
	(box.find_child("Often_every", true, false) as Button).pressed.emit()
	st.refresh(false)
	m = _moment(mid_id)
	rep["story_moment"] = m.get("if") == "read:letter" and (m.get("do", []) as Array).size() == 2 and m["do"][1] == {"think": "Who's there?"} and m.get("once") == false
	box = st.mid.find_child("Moment_" + mid_id, true, false)
	rep["story_reads"] = str(box.find_child("ReadsAs", true, false).text) if box != null else ""
	var req: Dictionary = st.try_request(m)
	rep["story_try"] = req.get("from") == "q_drink" and req.get("flags") == ["read:letter"] and req.get("test") == true and req.get("near", {}).get("level") == "house"
	for i in 5:                                       # the ready-made, the clause, the command, its words, every time
		glob.undo()
	rep["story_undone"] = _same(FileAccess.get_file_as_string("res://director/director.json"), pan["story_was"])
	var whisper: Dictionary = st.ready_items().filter(func(it): return it["id"] == "scare_whisper")[0]
	panel.plugin.pending_scare = {"item": whisper, "at": Time.get_ticks_msec(), "from": "story"}
	var dropped: Node3D = (load("res://addons/horrorstudio_director/presets/area.tscn") as PackedScene).instantiate()   # as the 3D view drops it: an instance of the preset's file
	dock.add_node(doorway.get_parent(), dropped, "drop Area")
	dropped.global_position = doorway.global_position   # inside the doorway's area (plugin.gd _unlink lands it a frame later)
	pan["story_dropped"] = dropped


## a frame after the drop: the moment on the doorway, the new area gone; undone
func _story_after() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var ur := get_undo_redo()
	var f := HSStoryFile.read()
	var on: Array = (f.get("moments", []) as Array).filter(func(m): return m.get("when") == {"enter": "kitchen_doorway"} and str(m["do"][0].get("sound", "")) == "breath_close")
	var gone: bool = not is_instance_valid(pan["story_dropped"]) or pan["story_dropped"].get_parent() == null
	rep["story_dropped"] = on.size() == 1 and on[0].get("during") == ["q_drink"] and gone
	ur.get_history_undo_redo(EditorUndoRedoManager.GLOBAL_HISTORY).undo()
	rep["story_drop_undone"] = _same(FileAccess.get_file_as_string("res://director/director.json"), pan["story_was"])
	var fl := FileAccess.open("res://director/director.json", FileAccess.WRITE)   # the story as the sample had it, whatever happened
	fl.store_string(pan["story_was"])
	fl.close()
	panel.show_page("test")                           # the Test page: the game checked as it will play
	var ct = panel.test.get_node_or_null("Checks")
	rep["panel_test"] = str(ct.summary.text) if ct != null else ""
	rep["panel_test_plays"] = panel.test.find_children("*", "Button", true, false).map(func(b): return str(b.text)).filter(func(t): return t.begins_with("Play"))
	panel.show_page("build")


func _moment(id: String) -> Dictionary:
	for m in HSStoryFile.read().get("moments", []):
		if str(m.get("id", "")) == id:
			return m
	return {}


## the same JSON (the panel writes it back with its own spacing)
func _same(a: String, b: String) -> bool:
	return JSON.stringify(JSON.parse_string(a)) == JSON.stringify(JSON.parse_string(b))


## a MenuButton's submenu item picked, as a click does
func _menu_pick(mb: MenuButton, group: String, item: String) -> void:
	if mb == null:
		return
	var pop := mb.get_popup()
	for i in pop.item_count:
		if pop.get_item_text(i) == group:
			var sub: PopupMenu = pop.get_item_submenu_node(i)
			for j in sub.item_count:
				if sub.get_item_text(j) == item:
					sub.id_pressed.emit(sub.get_item_id(j))
					return


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
