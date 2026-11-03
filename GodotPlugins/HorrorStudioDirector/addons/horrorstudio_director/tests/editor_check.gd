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
			EditorInterface.set_main_screen_editor("Story Flow")   # the quests as a flowchart, a main screen beside 2D and 3D
			at_t = t
			phase = 34
		34:
			if t - at_t < 1.5:
				return
			_flow_checks()
			_flow_edit_checks()
			_flow_egg_checks()
			_stage_checks()
			EditorInterface.set_main_screen_editor("3D")
			_path_checks()
			at_t = t
			phase = 340
		340:                                              # the card dropped on the path's stop lands a frame later
			if t - at_t < 0.5:
				return
			_path_dropped()
			_animate_checks()
			at_t = t
			phase = 35
		35:                                               # the previews play a while: her pose and face then
			if t - at_t < 0.5:
				return
			_animate_mid()
			at_t = t
			phase = 351
		351:                                              # and a moment later: moving
			if t - at_t < 0.5:
				return
			_animate_playing()
			at_t = t
			phase = 36
		36:                                               # the card dropped on Mari lands a frame later
			if t - at_t < 0.5:
				return
			_animate_dropped()
			at_t = t
			phase = 37
		37:                                               # a file dropped into animations/: a card, the tab polling its folders
			if t - at_t < 3.0:
				return
			_animate_polled()
			_react_checks()
			at_t = t
			phase = 38
		38:                                               # the card dropped on the reaction's area lands a frame later
			if t - at_t < 0.5:
				return
			_react_dropped()
			_cutscene_checks()
			phase = 4
		4:
			rep["saved"] = EditorInterface.save_scene() == OK
			var txt := FileAccess.get_file_as_string("res://main.tscn")
			rep["saved_task"] = txt.contains("[node name=\"OlderKey") and not txt.contains("HSEvent")
			rep["saved_nothing_made"] = not txt.contains("name=\"_gen\"") and not txt.contains("name=\"_solid\"")
			var pv = EditorInterface.get_edited_scene_root().find_child("Mari", true, false).get_node_or_null("_Preview")
			rep["anim_save_stopped"] = pan.get("anim_left_playing", false) == true and (pv == null or pv.is_queued_for_deletion()) \
				and panel.animate.playing.is_empty() and not txt.contains("_Preview")
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
	rep["director_has"] = rows.any(func(r): return r.begins_with("Quests (6)")) and rows.any(func(r): return r == "Intro") and rows.any(func(r): return r == "The key") and rows.any(func(r): return r == "A drink") \
		and rows.any(func(r): return r.begins_with("☐ Give Mari the mug")) and rows.any(func(r): return r.begins_with("Endings (2)")) and rows.any(func(r): return r == "figure_scare") \
		and rows.any(func(r): return r.begins_with("Easter eggs (2)"))
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
	st.quest = "q_intro"                              # the Intro: over once what happens as it starts is, no list, its opening's commands
	st.opened = ""
	st.refresh(false)
	var qf: OptionButton = st.mid.find_child("QuestFinish", true, false)
	var ql: CheckBox = st.mid.find_child("QuestList", true, false)
	var op: Control = st.mid.find_child("Opening", true, false)
	rep["story_intro"] = [qf.get_item_text(qf.selected) if qf != null else "", ql.button_pressed if ql != null else null,
		op.find_children("Do_*", "", true, false).size() if op != null else -1]
	st.quest = "q_talk"                               # Talk to…: the sample's talk step, in words, then till she's heard out at all
	st.opened = ""
	st.refresh(false)
	rep["story_talk_line"] = st.mid.find_children("Line_*", "Button", true, false).map(func(c): return str(c.text)).filter(func(t): return t.contains("Talk to Mari"))
	st.opened = "s:talk_mari"
	st.refresh(false)
	var tbox: Control = st.mid.find_child("Step_talk_mari", true, false)
	var tw: OptionButton = tbox.find_child("TalkWho", true, false) if tbox != null else null
	var th: OptionButton = tbox.find_child("TalkHow", true, false) if tbox != null else null
	rep["story_talk_pickers"] = [tw.get_item_text(tw.selected) if tw != null else "", th.get_item_text(th.selected) if th != null else "",
		str(tbox.find_child("WhenVerb", true, false).text) if tbox != null else ""]
	if th != null:
		th.select(1)
		th.item_selected.emit(1)                       # when she's heard out
	var tq: Dictionary = {}
	for q in HSStoryFile.read().get("quests", []):
		if q.get("id") == "q_talk":
			tq = q
	rep["story_talk_heard"] = tq.get("steps", [{}])[0].get("done") == {"holds": "heard:mari"}
	glob.undo()
	tq = {}
	for q in HSStoryFile.read().get("quests", []):
		if q.get("id") == "q_talk":
			tq = q
	rep["story_talk_undone"] = tq.get("steps", [{}])[0].get("done") == {"holds": "heard:t_open"}
	st.refresh(false)                                 # its marker (the diamond over Mari in the game): on, over her; off, and back
	tbox = st.mid.find_child("Step_talk_mari", true, false)
	var gcb: CheckBox = tbox.find_child("Guide", true, false) if tbox != null else null
	var gov: OptionButton = tbox.find_child("GuideOver", true, false) if tbox != null else null
	rep["story_marker"] = [gcb != null and gcb.button_pressed, gov.get_item_text(gov.selected) if gov != null else ""]
	if gcb != null:
		gcb.toggled.emit(false)
	var mq: Dictionary = {}
	for q in HSStoryFile.read().get("quests", []):
		if q.get("id") == "q_talk":
			mq = q
	rep["story_marker_off"] = not (mq.get("steps", [{}])[0] as Dictionary).has("guide")
	glob.undo()
	for q in HSStoryFile.read().get("quests", []):
		if q.get("id") == "q_talk":
			mq = q
	rep["story_marker_back"] = mq.get("steps", [{}])[0].get("guide") == true
	st.quest = "q_drink"
	st.opened = ""
	st.refresh(false)
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


## the Story Flow tab (editor/flow_tab.gd): a card for every quest and ending, the arrows as the game plays them, the
## branch's words on its card, the cards in reading order, a card's prerequisites, a card opened in the Story tab, a
## card moved (every card's place kept) and undone
func _flow_checks() -> void:
	var fl = EditorInterface.get_editor_main_screen().find_child("HorrorStudioFlow", false, false)
	rep["flow_found"] = fl != null and fl.visible
	if fl == null:
		return
	var f := HSStoryFile.read()
	var want: Array = []
	for q in f.get("quests", []):
		want.append(str(q["id"]))
	for e in f.get("endings", []):
		want.append(str(e["id"]))
	rep["flow_cards"] = fl.cards.size() == want.size() and want.all(func(id): return fl.cards.has(id))
	rep["flow_wires"] = fl.graph.get_connection_list().size()
	var night = fl.cards.get("q_night")
	var w0 = night.get_node_or_null("Out_0") if night != null else null
	rep["flow_branch"] = str(w0.text) if w0 is Label else ""
	var a: Vector2 = fl.cards["q_intro"].position_offset
	var b: Vector2 = fl.cards["q_key"].position_offset
	var z: Vector2 = fl.cards["q_night"].position_offset
	rep["flow_order"] = (a.y < b.y or (is_equal_approx(a.y, b.y) and a.x < b.x)) and (b.y < z.y or (is_equal_approx(b.y, z.y) and b.x < z.x))
	fl.pick("q_key")
	rep["flow_prereq"] = _texts(fl.side).has("after 1 · Intro")
	fl.pick("q_intro")
	rep["flow_start"] = _texts(fl.side).has("The game starts here.")
	fl.open_in_story("q_drink")
	rep["flow_open"] = panel.story.quest == "q_drink" and panel.page == "story"
	panel.show_page("build")
	var before := FileAccess.get_file_as_string("res://director/director.json")
	fl.cards["q_key"].position_offset += Vector2(0, 200)
	fl._moved()
	var f2 := HSStoryFile.read()
	var chm = f2.get("chart")
	rep["flow_moved"] = chm is Dictionary and (chm as Dictionary).size() == want.size() and chm.has("q_key")
	get_undo_redo().get_history_undo_redo(EditorUndoRedoManager.GLOBAL_HISTORY).undo()
	rep["flow_move_undone"] = _same(FileAccess.get_file_as_string("res://director/director.json"), before)


## setting the story up in Story Flow: a new quest where it's put, its title typed; the bedroom's then dropped on it
## and its own then on to the night; a branch on the key (if they've read the letter) sent to it; the quests numbered by
## the flow (the game playing the same); the new quest deleted (what pointed at it going on where it went); all undone
func _flow_edit_checks() -> void:
	var fl = EditorInterface.get_editor_main_screen().find_child("HorrorStudioFlow", false, false)
	if fl == null:
		return
	var st = panel.story
	var before := FileAccess.get_file_as_string("res://director/director.json")
	var ur := get_undo_redo().get_history_undo_redo(EditorUndoRedoManager.GLOBAL_HISTORY)
	var id: String = fl.add_card("quest", Vector2(380, 880))
	fl.redraw()
	var made: bool = id != "" and fl.cards.has(id) and st.quest_of(id).get("title") == "A new quest"
	fl.rename_to(id, "The cellar")
	fl.redraw()
	rep["flowedit_new"] = made and st.quest_of(id).get("title") == "The cellar" and (st.f.get("chart", {}) as Dictionary).has(id)
	fl._on_connect(fl.cards["q_bedroom"].name, int(fl.ports["q_bedroom"][0]), fl.cards[id].name, 0)
	fl.redraw()
	fl.connect_way(id, 0, "q_night")
	fl.redraw()
	rep["flowedit_wired"] = st.quest_of("q_bedroom").get("next") == [{"go": id}] and st.quest_of(id).get("next") == [{"go": "q_night"}]
	fl.add_way("q_key", {"kind": "fact", "v": "read:letter", "not": false})
	fl.redraw()
	fl.connect_way("q_key", 0, id)
	fl.redraw()
	var w0 = fl.cards["q_key"].get_node_or_null("Out_0")
	var kn = st.quest_of("q_key").get("next")
	rep["flowedit_branch"] = str(w0.text) if w0 is Label else ""
	rep["flowedit_branch_to"] = kn is Array and kn.size() == 1 and str(kn[0].get("go", "")) == id
	var ways0 := _ways_of(st.f)
	fl.renumber()
	fl.redraw()
	var order: Array = (st.f["quests"] as Array).filter(func(q): return q.get("egg", false) != true).map(func(q): return str(q["id"]))
	rep["flowedit_numbered"] = order
	rep["flowedit_same"] = _ways_of(st.f) == ways0 and not st.quest_of("q_bedroom").has("next") and not st.quest_of(id).has("next")
	fl.delete_cards([id])
	fl.redraw()
	var bed = HSFlow.card_of(fl.ch, "q_bedroom")
	rep["flowedit_deleted"] = st.quest_of(id).is_empty() and not fl.cards.has(id) and str(bed["outs"][0]["to"]) == "q_night" \
		and str(st.quest_of("q_key")["next"][0]["go"]) == "q_night"
	for i in 8:
		ur.undo()
	rep["flowedit_undone"] = _same(FileAccess.get_file_as_string("res://director/director.json"), before)
	var w := FileAccess.open("res://director/director.json", FileAccess.WRITE)   # as the sample had it, whatever happened
	w.store_string(before)
	w.close()


## the sample's easter eggs in Story Flow: gold cards out of the numbers, straight to bed found during the drink errand
## and jumping to the night; one made from the key's "easter eggs found during it", its jump to the bedroom, opened in
## the Story tab on its FOUND WHEN; undone
func _flow_egg_checks() -> void:
	var fl = EditorInterface.get_editor_main_screen().find_child("HorrorStudioFlow", false, false)
	if fl == null:
		return
	var st = panel.story
	fl.redraw()
	var cat = HSFlow.card_of(fl.ch, "egg_cat")
	var early = HSFlow.card_of(fl.ch, "egg_early")
	var lines: Array = fl.graph.get_connection_list().map(func(c): return "%s>%s" % [fl._id_of(c["from_node"]), fl._id_of(c["to_node"])])
	rep["flowegg_cards"] = str(cat.get("kind", "")) == "egg" and str(early.get("kind", "")) == "egg" and int(early.get("num", -1)) == 0 \
		and lines.has("q_drink>egg_early") and lines.has("egg_early>q_night") and str(cat.get("info", "")) == "during any quest"
	var before := FileAccess.get_file_as_string("res://director/director.json")
	var ur := get_undo_redo().get_history_undo_redo(EditorUndoRedoManager.GLOBAL_HISTORY)
	var id: String = fl.add_card("egg", Vector2(40, 1100), "q_key", -1)
	fl.redraw()
	fl.connect_way(id, 0, "q_bedroom")
	fl.redraw()
	var e: Dictionary = st.quest_of(id)
	rep["flowegg_made"] = e.get("egg", false) == true and e.get("during") == ["q_key"] and e.get("next") == [{"go": "q_bedroom"}]
	fl.open_in_story(id)
	rep["flowegg_story"] = st.quest == id and st.mid.find_child("Found", true, false) != null and st.mid.find_child("EggThen", true, false) != null
	panel.show_page("build")
	for i in 2:
		ur.undo()
	rep["flowegg_undone"] = _same(FileAccess.get_file_as_string("res://director/director.json"), before)


## the chart's arrows as from>to:kind (an otherwise is a then), sorted: what the game plays
## On stage (docs/GODOT_ANIMATION_PLAN.md §6): the sample's lines as chips on Story Flow's cards; in the Story tab a
## quest's own line in blue words and a carried one in grey (as in the Intro), changed here (a copy, without its
## conversation) and undone; Show on stage: Mari where the night has her, sitting, put back after
func _stage_checks() -> void:
	var fl = EditorInterface.get_editor_main_screen().find_child("HorrorStudioFlow", false, false)
	fl.redraw()
	var card: Control = fl.cards.get("q_drink")
	var chip: Label = card.find_child("Stage", true, false).get_child(0) if card != null and card.find_child("Stage", true, false) != null else null
	rep["stage_chip"] = str(chip.text) if chip != null else ""
	var st = panel.story
	panel.show_page("story")
	st.quest = "q_drink"
	st.opened = ""
	st.refresh(false)
	var row: Control = st.mid.find_child("Stage_mari", true, false)
	var dob: OptionButton = row.find_child("StageDo", true, false) if row != null else null
	var tb: OptionButton = row.find_child("StageTalk", true, false) if row != null else null
	rep["stage_own"] = [dob.get_item_text(dob.selected) if dob != null else "", tb.get_item_text(tb.selected) if tb != null else ""]
	st.quest = "q_key"
	st.refresh(false)
	row = st.mid.find_child("Stage_mari", true, false)
	rep["stage_carried"] = _texts(row).filter(func(x): return x.begins_with("as in")) if row != null else []
	var was: String = FileAccess.get_file_as_string("res://director/director.json")
	var here: Button = row.find_child("StageHere", true, false) if row != null else null
	if here != null:
		here.pressed.emit()
	st.refresh(false)                                 # (what the tab does a frame later, once the button has let go)
	var mine = st.quest_of("q_key").get("stage", {}).get("mari")
	rep["stage_changed_here"] = mine is Dictionary and mine.get("at") == "mari__home" and not (mine as Dictionary).has("talk") \
		and st.mid.find_child("Stage_mari", true, false).find_child("StageDo", true, false) != null
	get_undo_redo().get_history_undo_redo(EditorUndoRedoManager.GLOBAL_HISTORY).undo()
	rep["stage_undone"] = _same(FileAccess.get_file_as_string("res://director/director.json"), was)
	var mari: Node3D = EditorInterface.get_edited_scene_root().find_child("Mari", true, false)   # Show on stage: the night
	var at0: Vector3 = mari.global_position
	var spot: Node3D = EditorInterface.get_edited_scene_root().find_child("BedroomSpot", true, false)
	st.show_stage("q_night")
	var ap = mari.get_node_or_null("_Staged")
	rep["stage_shown"] = mari.global_position.distance_to(spot.global_position) < 0.01 and ap is AnimationPlayer and (ap as AnimationPlayer).is_playing()
	st.unshow_stage()
	rep["stage_put_back"] = mari.global_position.distance_to(at0) < 0.001 and st.staged.is_empty() \
		and (mari.get_node_or_null("_Staged") == null or mari.get_node("_Staged").is_queued_for_deletion())
	panel.show_page("build")


## a path's stops (docs/GODOT_ANIMATION_PLAN.md step 5): This object lists the hall path's two with their waits and
## clips; the second's clip picked there (and undone); an Animate card dropped on it gives it that clip
func _path_checks() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var hp: Node = r.find_child("HallPath", true, false)
	panel.show_page("build")
	dock.select(hp)
	panel.on_selection()
	var side: Control = panel.build.side
	var rows: Array = []
	for i in 2:
		var row: Control = side.find_child("Stop_%d" % i, true, false)
		var ob: OptionButton = row.find_child("Clip", true, false) if row != null else null
		var w: SpinBox = row.find_child("Wait", true, false) if row != null else null
		rows.append([_texts(row)[0] if row != null else "", w.value if w != null else -1.0, ob.get_item_text(ob.selected) if ob != null else ""])
	rep["path_stops"] = rows
	var ob2: OptionButton = side.find_child("Stop_1", true, false).find_child("Clip", true, false)
	var k := -1
	for i in ob2.item_count:
		if ob2.get_item_text(i) == "sample_idle":
			k = i
	ob2.select(k)
	ob2.item_selected.emit(k)
	var stop2: Node = hp.spots()[1]
	var set_ok: bool = stop2.clip == "sample_idle"
	var hist := get_undo_redo().get_history_undo_redo(get_undo_redo().get_object_history_id(r))
	hist.undo()
	rep["path_clip"] = [set_ok, stop2.clip == ""]
	panel.plugin.pending_anim = {"clip": HSLibrary.clip("mari_talk"), "face": false, "at": Time.get_ticks_msec()}   # a card dropped on the stop
	var tok: Node3D = (load("res://addons/horrorstudio_director/presets/spot.tscn") as PackedScene).instantiate()
	dock.add_node(stop2, tok, "drop Spot")
	pan["path_stop"] = stop2


## the Reactions cards (parts/catalog.json; build_tab.gd fill_ready): the category's five on the Build tab; Flinches
## clicked with the kitchen's doorway selected: a moment there in which Mari (the nearest of the cast there from the
## start: the hidden figure is nearer) plays her flinch turned to the player, no face (the sample has no shocked one);
## Waves: her wave (made hers by now); a face by its name's words; then the Animate tab's look round dropped on the
## doorway (a frame later: its clip swapped in)
func _react_checks() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var st = panel.story
	pan["react_was"] = FileAccess.get_file_as_string("res://director/director.json")
	panel.show_page("build")
	panel.build.show_category("reactions")
	rep["react_cards"] = panel.build.find_children("Card_react_*", "Button", true, false).map(func(b): return str(b.name).substr(5))
	panel.show_page("story")
	st.quest = ""
	st.refresh(false)
	var door := r.find_child("KitchenDoorway", true, false)
	var items: Array = st.ready_items()
	var ids: Array = []
	for card in ["react_flinch", "react_wave"]:
		ids.append(st.add_ready(items.filter(func(it): return it["id"] == card)[0], door))
	var words := []
	var dos := []
	for id in ids:
		var m := _moment(id)
		dos.append([m.get("when"), m.get("do")])
		for a in m.get("do", []):
			words.append(HSCommands.action_text(a, Callable(st, "_name")))
	rep["react_made"] = dos
	rep["react_words"] = words
	var bt = load("res://addons/horrorstudio_director/editor/build_tab.gd")
	rep["react_faces"] = [bt.face_by_words(["pout"]), bt.face_by_words(["grin"])]
	pan["react_ids"] = ids
	panel.plugin.pending_anim = {"clip": HSLibrary.clip("look_around"), "face": false, "at": Time.get_ticks_msec()}   # a card dropped on the doorway
	var tok: Node3D = (load("res://addons/horrorstudio_director/presets/spot.tscn") as PackedScene).instantiate()
	dock.add_node(door, tok, "drop Spot")


## a frame later: the flinch's clip swapped for the look round (the first moment there someone reacts in), the drop
## taken back; then all of it undone (the file as it was)
func _react_dropped() -> void:
	var ids: Array = pan["react_ids"]
	var r := EditorInterface.get_edited_scene_root()
	rep["react_dropped"] = [str(_moment(ids[0]).get("do", [{}])[0].get("clip", "")), str(_moment(ids[1]).get("do", [{}])[0].get("clip", "")),
		r.find_child("KitchenDoorway", true, false).get_children().filter(func(c): return HSDirector.is_a(c, "HSSpot")).size()]
	var glob := get_undo_redo().get_history_undo_redo(EditorUndoRedoManager.GLOBAL_HISTORY)
	for i in 3:
		glob.undo()
	rep["react_undone"] = _same(FileAccess.get_file_as_string("res://director/director.json"), pan["react_was"])


## a moment played as a cutscene (story_tab.gd _cutscene_row, _timeline; story_compile.gd cutscene_do): the sample's
## night_cutscene opened: its row (played as a cutscene, the view held on Mari, a little closer, walking slowed, 20 s
## at most) and its timeline (the view, Mari's row with her lines, the lines); a clip added from her row; the compile's
## THEN for one; made not a cutscene; all undone
func _cutscene_checks() -> void:
	var st = panel.story
	pan["cut_was"] = FileAccess.get_file_as_string("res://director/director.json")
	panel.show_page("story")
	st.quest = "q_night"
	st.ending = ""
	st.opened = "m:night_cutscene"
	st.refresh(false)
	var box: Control = st.mid.find_child("Moment_night_cutscene", true, false)
	var row: Control = box.find_child("Cutscene", true, false) if box != null else null
	var tl: Control = box.find_child("Timeline", true, false) if box != null else null
	var pick := func(nm: String) -> String:
		var ob: OptionButton = row.find_child(nm, true, false) if row != null else null
		return ob.get_item_text(ob.selected) if ob != null and ob.selected >= 0 else ""
	var tg: Button = row.find_child("AsCutscene", true, false) if row != null else null
	var mx: SpinBox = row.find_child("CutMax", true, false) if row != null else null
	rep["cut_row"] = [tg != null and tg.button_pressed, pick.call("CutTarget"), pick.call("CutCloser"), pick.call("CutWalk"), mx.value if mx != null else -1.0]
	rep["cut_rows"] = tl.get_children().filter(func(c): return str(c.name).begins_with("Row_")).map(func(c): return str(c.name)) if tl != null else []
	var mrow: Control = tl.find_child("Row_Who_mari", true, false) if tl != null else null
	rep["cut_mari"] = " ".join(PackedStringArray(_texts(mrow))) if mrow != null else ""
	var add: MenuButton = mrow.find_child("AddClip", true, false) if mrow != null else null
	if add != null:
		add.get_popup().id_pressed.emit(0)
	var dos: Array = _moment("night_cutscene").get("do", [])
	rep["cut_added"] = dos.back() if dos.size() else null
	rep["cut_compiled"] = HSStoryCompiler.cutscene_do({"target": "mari", "zoom": 0.05, "walk": "held"}, [{"say": "Hi", "who": "mari"}])
	st.refresh(false)
	box = st.mid.find_child("Moment_night_cutscene", true, false)
	tg = box.find_child("AsCutscene", true, false) if box != null else null
	if tg != null:
		tg.pressed.emit()
	rep["cut_off"] = not _moment("night_cutscene").has("cutscene")
	var glob := get_undo_redo().get_history_undo_redo(EditorUndoRedoManager.GLOBAL_HISTORY)
	glob.undo()
	glob.undo()
	rep["cut_undone"] = _same(FileAccess.get_file_as_string("res://director/director.json"), pan["cut_was"])
	st.opened = ""


## a frame later: the dropped card's clip on the stop, the drop taken back
func _path_dropped() -> void:
	var stop2: Node = pan["path_stop"]
	rep["path_dropped"] = [str(stop2.clip), stop2.get_children().filter(func(c): return HSDirector.is_a(c, "HSSpot")).size()]
	get_undo_redo().get_history_undo_redo(get_undo_redo().get_object_history_id(EditorInterface.get_edited_scene_root())).undo()
	rep["path_dropped_undone"] = str(stop2.clip) == ""


## the Animate tab (editor/animate_tab.gd over core/library.gd): the sample's two Kimodo clips as cards in their groups,
## each drawn as its figure, Mari's idle hers already; its two faces on the Face side; Mari selected, her idle and her
## resting face read; the story's clip she hasn't got warned of; the look round made hers (its file in
## res://animations/_made/mari/), then played on her body and a face on her face shapes at once (a throwaway player:
## nothing saved)
func _animate_checks() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var an = panel.animate
	DirAccess.copy_absolute(ProjectSettings.globalize_path("res://animations/look_around.npz"), ProjectSettings.globalize_path("res://animations/mari/mari_wave.npz"))   # a clip she hasn't been given yet
	panel.show_page("animate")
	an.face_side = false
	dock.select(null)
	EditorInterface.get_selection().clear()
	an.refresh()
	rep["anim_tab"] = panel.tab_buttons.has("animate") and an.visible
	rep["anim_cards"] = an.mid.find_children("Clip_*", "Button", true, false).map(func(b): return str(b.name))
	rep["anim_groups"] = _texts(an.mid).filter(func(x): return x == x.to_upper() and x.length() > 2)
	rep["anim_figures"] = an.figs.size() == 10 and an.figs.all(func(st): return (st["fig"]["frames"] as Array).size() >= 30 and float(st["fig"]["secs"]) > 1.1)
	rep["anim_loops"] = [HSLibrary.loops("mari_sitting"), HSLibrary.loops("mari_sit_down"), HSLibrary.loops("mari_stand_up"), HSLibrary.loops("mari_walk")]
	rep["anim_roles"] = [HSLibrary.role_of("mari_sit_reading"), HSLibrary.role_of("MariStandUp"), HSLibrary.role_of("standing_idle"),
		HSLibrary.role_of("walking_slow"), HSLibrary.role_of("jumpscare_lunge"), HSLibrary.role_of("return_home")]
	an.face_side = true
	an.refresh()
	rep["anim_faces"] = an.mid.find_children("Face_*", "Button", true, false).map(func(b): return str(b.name))
	var fcmd: Array = dock.face_page_cmd()             # the Face page's button: the studio's page started for this project
	rep["anim_face_page"] = an.mid.find_child("FacePage", true, false) != null and fcmd.size() >= 5 \
		and str(fcmd[fcmd.find("--project") + 1]) == ProjectSettings.globalize_path("res://") and fcmd.any(func(x): return str(x).ends_with("tools/facecap/serve.py"))
	an.face_side = false
	var mari: Node3D = r.find_child("Mari", true, false)
	dock.select(mari)
	an.refresh()
	var idle_card: Control = an.mid.find_child("Clip_sample_idle", true, false)
	rep["anim_hers"] = idle_card != null and _texts(idle_card).has("hers") and _texts(an.right).has("Resting face: pout_and_glance_loop")
	rep["anim_moves"] = an.right.find_children("Move_*", "Button", true, false).map(func(b): return str(b.text).replace("   ", ": "))
	var ur := get_undo_redo()                          # a move cleared, then filled again from the library (her talk: mari_talk, by its name)
	var glob := ur.get_history_undo_redo(ur.get_object_history_id(r))
	an._set_move_name(mari, "talk", "")
	var cleared: bool = mari.move("talk") == "" and str((an.right.find_child("Move_talk", true, false) as Button).text).ends_with("—")
	var filled: Array = an.fill_moves(mari)
	rep["anim_fill"] = [cleared, filled, mari.move("talk")]
	glob.undo()                                        # (the fill undone, then the clearing: as the sample had her)
	glob.undo()
	rep["anim_fill_undone"] = mari.move("talk") == "mari_talk"
	an.move_menu(mari, "sitting", Vector2.ZERO)        # a move clicked: the library's clips that suit it
	var mm: Array = []
	for i in an._menu.item_count:
		mm.append(an._menu.get_item_text(i))
	an._menu.hide()
	rep["anim_move_menu"] = mm
	var f := HSStoryFile.read()                       # the story animating her with a clip she hasn't got: warned, the library's named
	(f["moments"] as Array).append({"id": "anim_try", "when": {"enter": "kitchen_doorway"}, "do": [{"anim": "mari", "clip": "mari_wave"}, {"anim": "mari", "clip": "no_such_clip"}]})
	var c1 := HSCompiler.new()
	c1.compile(r, null, f)
	var warns: Array = c1.problems.map(func(p): return str(p["text"])).filter(func(x): return x.contains("animates mari"))
	var wave: Dictionary = HSLibrary.clip("mari_wave")
	an.set_move(mari, wave, "")
	var c2 := HSCompiler.new()
	c2.compile(r, null, f)
	var warns2: Array = c2.problems.map(func(p): return str(p["text"])).filter(func(x): return x.contains("animates mari"))
	rep["anim_warned"] = warns.size() == 2 and warns.any(func(x): return x.contains("mari_wave") and x.contains("Animate tab")) \
		and warns.any(func(x): return x.contains("no_such_clip") and x.contains("no clip of that name")) and warns2.size() == 1
	rep["anim_made"] = HSLibrary.hers(mari).has("mari_wave") and FileAccess.file_exists("res://animations/_made/mari/mari_wave.res") \
		and load("res://addons/horrorstudio/play.gd").anim_name(HSRetarget.player_of(mari), "mari_wave") == "anims/mari_wave" \
		and _texts(an.mid.find_child("Clip_mari_wave", true, false)).has("hers")
	rep["anim_cast_moves"] = c2.story["cast"].get("mari", {}).get("moves", {})   # her moves in the story the game plays
	var look: Dictionary = HSLibrary.clip("look_around")
	var sk := HSRetarget.skeleton_of(mari)
	var fo: Dictionary = load("res://addons/horrorstudio/face.gd").face_of(mari)
	pan["anim_pose0"] = _pose(sk)
	pan["anim_face0"] = _blends(fo.get("mesh"))
	an.preview(mari, look)
	an.preview_face(mari, {"id": "pout_and_glance", "path": "res://faces/pout_and_glance.tres", "loop": false, "secs": 1.0, "title": "pout_and_glance"})
	pan["anim_pose1"] = []
	pan["anim_face1"] = []
	rep["anim_preview"] = mari.get_node_or_null("_Preview") is AnimationPlayer and (mari.get_node("_Preview") as AnimationPlayer).is_playing() \
		and not an.face_play.is_empty()


static func _pose(sk: Skeleton3D) -> Array:
	var out: Array = []
	if sk != null:
		for i in sk.get_bone_count():
			out.append(sk.get_bone_pose_rotation(i))
	return out


static func _blends(mi) -> Array:
	var out: Array = []
	if mi is MeshInstance3D:
		for i in mi.get_blend_shape_count():
			out.append(mi.get_blend_shape_value(i))
	return out


static func _moved(a: Array, b: Array, eps := 0.002) -> int:
	var n := 0
	for i in mini(a.size(), b.size()):
		var d: float = (a[i] as Quaternion).angle_to(b[i]) if a[i] is Quaternion else absf(float(a[i]) - float(b[i]))
		if d > eps:
			n += 1
	return n


func _animate_mid() -> void:
	var mari: Node3D = EditorInterface.get_edited_scene_root().find_child("Mari", true, false)
	pan["anim_pose1"] = _pose(HSRetarget.skeleton_of(mari))
	pan["anim_face1"] = _blends(load("res://addons/horrorstudio/face.gd").face_of(mari).get("mesh"))


## a moment later: her bones and her face shapes moving at once (against the moment before, not her rest); stopped,
## both put back and the player gone; then a card dragged onto her (as the 3D view drops it: the spot preset under her)
func _animate_playing() -> void:
	var r := EditorInterface.get_edited_scene_root()
	var an = panel.animate
	var mari: Node3D = r.find_child("Mari", true, false)
	var sk := HSRetarget.skeleton_of(mari)
	var fo: Dictionary = load("res://addons/horrorstudio/face.gd").face_of(mari)
	var bones := _moved(pan["anim_pose1"], _pose(sk))
	var shapes := _moved(pan["anim_face1"], _blends(fo.get("mesh")))
	rep["anim_together"] = [bones, shapes]
	an.stop()
	rep["anim_put_back"] = _moved(pan["anim_pose0"], _pose(sk)) == 0 and _moved(pan["anim_face0"], _blends(fo.get("mesh"))) == 0 \
		and (mari.get_node_or_null("_Preview") == null or not is_instance_valid(mari.get_node_or_null("_Preview")) or mari.get_node("_Preview").is_queued_for_deletion()) \
		and an.playing.is_empty() and an.face_play.is_empty()
	panel.plugin.pending_anim = {"clip": HSLibrary.clip("look_around"), "face": false, "at": Time.get_ticks_msec()}
	var spot: Node3D = (load("res://addons/horrorstudio_director/presets/spot.tscn") as PackedScene).instantiate()
	dock.add_node(mari, spot, "drop Spot")
	spot.global_position = mari.global_position
	pan["anim_spot"] = spot


## the drop: Mari's menu (her idle, her walk, hers, a look), the spot taken back
func _animate_dropped() -> void:
	var an = panel.animate
	var spot = pan["anim_spot"]
	var items: Array = []
	for i in an._menu.item_count:
		if an._menu.get_item_text(i) != "":
			items.append(an._menu.get_item_text(i))
	rep["anim_dropped"] = items
	rep["anim_drop_gone"] = not is_instance_valid(spot) or spot.get_parent() == null
	an._menu.hide()
	var mari: Node3D = EditorInterface.get_edited_scene_root().find_child("Mari", true, false)
	an.preview(mari, HSLibrary.clip("look_around"))   # left playing: the save (phase 4) stops it first
	pan["anim_left_playing"] = mari.get_node_or_null("_Preview") != null
	DirAccess.copy_absolute(ProjectSettings.globalize_path("res://animations/look_around.npz"), ProjectSettings.globalize_path("res://animations/sit_down_tired.npz"))


## the copied file a card on its own (Godot's scan skips an .npz), in a group of its own in the tab's order; taken out
func _animate_polled() -> void:
	var an = panel.animate
	rep["anim_polled"] = an.mid.find_child("Clip_sit_down_tired", true, false) != null and not HSLibrary.loops("sit_down_tired")
	rep["anim_polled_groups"] = _texts(an.mid).filter(func(x): return x == x.to_upper() and x.length() > 2)
	DirAccess.remove_absolute(ProjectSettings.globalize_path("res://animations/sit_down_tired.npz"))
	panel.show_page("build")


func _ways_of(f: Dictionary) -> Array:
	var out: Array = []
	for w in HSFlow.chart(f)["wires"]:
		out.append("%s>%s:%s" % [w["from"], w["to"], "then" if w["kind"] == "else" else w["kind"]])
	out.sort()
	return out


## every Label's words under a node
func _texts(n: Node) -> Array:
	var out: Array = []
	for c in n.find_children("*", "Label", true, false):
		out.append(str(c.text))
	return out


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
