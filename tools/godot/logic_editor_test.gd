@tool
## LOGICEDITOR's hands (tools/godot/logic_check.py --editor; docs/FLAGS.md §4 to §6): installed as a plugin of its own
## in the scratch project, it opens a small room in the editor itself and uses the Things and Flags tabs as someone
## would: the scene set up, cards on what's selected and one placed by a click, a thing's Logic filled in, a marker
## tied to a door and a key tied to a marker by one click each, the Flags tab's list, filters, a flag's two ends, a
## rename everywhere and its undo, a flag written down, used on the thing selected, taken out; the Inspector's chips;
## a save. Prints `LOGICEDITOR {errors, did}` and quits. With a folder in logic_editor.json it also pictures the editor.
extends EditorPlugin

var errors: Array = []
var did: Array = []
var plug
var things
var flags
var mdock
var wiring
var vp: SubViewport
var cam: Camera3D
var surface: Control
var root: Node
var shots := ""


func ok(c: bool, what: String, how := "") -> void:
	if c:
		did.append(what + ((": " + how) if how != "" else ""))
	else:
		errors.append(what + ((": " + how) if how != "" else ""))


func frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func secs(t: float) -> void:
	await get_tree().create_timer(t).timeout


func _find_script(n: Node, tail: String):
	for c in n.get_children():
		if c.get_script() != null and str(c.get_script().resource_path).ends_with(tail):
			return c
		var f = _find_script(c, tail)
		if f != null:
			return f
	return null


func _done() -> void:
	print("LOGICEDITOR " + JSON.stringify({"errors": errors, "did": did}))
	if EditorInterface.get_edited_scene_root() != null:
		EditorInterface.save_scene()                            # (an unsaved scene makes the editor ask before it quits, and nobody's there to answer)
	await frames(10)
	get_tree().quit()


func _enter_tree() -> void:
	_run.call_deferred()


func k() -> Vector2:
	return plug.overlay._k(surface, vp) if surface != null else Vector2.ONE


func scr(p: Vector3) -> Vector2:
	return cam.unproject_position(p) * k()


func press(pos: Vector2, shift := false) -> void:
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = true
	e.position = pos
	e.shift_pressed = shift
	plug._forward_3d_gui_input(cam, e)
	var e2 := InputEventMouseButton.new()
	e2.button_index = MOUSE_BUTTON_LEFT
	e2.pressed = false
	e2.position = pos
	plug._forward_3d_gui_input(cam, e2)


func redraw() -> void:
	plug.update_overlays()
	await frames(3)


func hot(kind: String, node: Node = null) -> Array:
	var out := []
	for h in plug.overlay.hot.get(surface.get_instance_id(), []) if surface != null else []:
		if h["kind"] == kind and (node == null or h["node"] == node):
			out.append(h)
	return out


func undo() -> void:
	var ur := get_undo_redo()
	ur.get_history_undo_redo(ur.get_object_history_id(root)).undo()


func select(n: Node) -> void:
	var sel := EditorInterface.get_selection()
	sel.clear()
	sel.add_node(n)
	await frames(3)


func rows(tree: Tree) -> Array:
	var out := []
	var it: TreeItem = tree.get_root().get_first_child() if tree.get_root() != null else null
	while it != null:
		out.append(it)
		it = it.get_next()
	return out


func row_named(tree: Tree, name: String) -> TreeItem:
	for it in rows(tree):
		if (it as TreeItem).get_text(0) == name:
			return it
	return null


func names_in(tree: Tree) -> Array:
	return rows(tree).map(func(it): return (it as TreeItem).get_text(0))


func show_filter(meta: String) -> void:
	flags.filter = meta
	flags.refresh()
	await frames(2)


func shot(name: String) -> void:
	if shots == "":
		return
	await frames(6)
	var img := EditorInterface.get_base_control().get_viewport().get_texture().get_image()
	img.save_png(shots.path_join(name + ".png"))
	did.append("pictured " + name)


func _run() -> void:
	get_tree().create_timer(300.0).timeout.connect(func() -> void:
		errors.append("the editor test never ended")
		_done())
	var cfg = JSON.parse_string(FileAccess.get_file_as_string("res://logic_editor.json"))
	shots = str(cfg.get("shots", "")) if cfg is Dictionary else ""
	await secs(3.0)
	for i in 600:
		if not EditorInterface.get_resource_filesystem().is_scanning():
			break
		await frames(5)
	await secs(1.5)
	EditorInterface.open_scene_from_path("res://logic_scene.tscn")
	for i in 400:
		await frames(1)
		root = EditorInterface.get_edited_scene_root()
		if root != null and root.name == "Level":
			break
	ok(root != null and root.name == "Level", "the room opened in the editor")
	if root == null:
		_done()
		return
	EditorInterface.set_main_screen_editor("3D")
	await frames(10)
	mdock = _find_script(EditorInterface.get_base_control(), "horrorstudio_markers/editor/dock.gd")
	things = _find_script(EditorInterface.get_base_control(), "horrorstudio_markers/editor/things_dock.gd")
	flags = _find_script(EditorInterface.get_base_control(), "horrorstudio_markers/editor/flags_dock.gd")
	ok(mdock != null and things != null and flags != null, "the Things and Flags tabs are in the editor, beside NPC Markers")
	if mdock == null or things == null or flags == null:
		_done()
		return
	plug = mdock.plugin
	wiring = plug.wiring
	things.make_visible()
	await frames(5)
	ok(things.is_visible_in_tree(), "the Things tab is shown along the bottom")
	vp = EditorInterface.get_editor_viewport_3d(0)
	cam = vp.get_camera_3d()
	for c in vp.get_parent().get_parent().get_children():
		if c.get_class() == "Control":
			surface = c
	ok(cam != null and surface != null, "the 3D view and its camera")
	var door := root.get_node("Door") as Node3D
	var key := root.get_node("Key") as Node3D
	var paper := root.get_node("Paper") as Node3D
	var lamp := root.get_node("Lamp") as Node3D
	var ann := root.get_node("Ann") as Node3D
	await shot("01_things_empty")

	# ---- set up the scene ----
	ok(wiring.story() == null and names_in(things.list) == ["Door"], "to begin with: a door, and no Story", str(names_in(things.list)))
	(things.setup_btn as Button).pressed.emit()
	await frames(4)
	var player := root.get_node_or_null("Player")
	var story := root.get_node_or_null("Story")
	ok(player != null and story != null and root.get_node_or_null("Hud") != null and root.get_node_or_null("Sound") != null, "Set up the scene adds the player, the Story, the HUD and Sound")
	ok(player != null and player.owner == root and player.get_node("Eye").owner == player and player.scene_file_path == "res://starter/player.tscn", "the player is an instance of the starter's, its insides its own")
	ok(wiring.story() == story and story.owner == root, "the Story is found")
	(things.setup_btn as Button).pressed.emit()
	await frames(2)
	ok(root.find_children("Player*", "", false, false).size() == 1, "pressed again, nothing is added twice")

	# ---- cards on what's selected ----
	await select(key)
	ok(things.thing == key, "the tab follows the scene's selection", str(things.thing))
	things._card(wiring.card("pickup"))
	await frames(3)
	ok(key.get_script() != null and key.get_script().resource_path == "res://starter/pickup.gd" and "Key" in names_in(things.list), "Pickup on the selected key: it has the pickup's script and is in the list")
	undo()
	await frames(3)
	ok(key.get_script() == null, "undone: plain again")
	things._card(wiring.card("pickup"))
	await frames(3)
	plug.set_prop(key, "item", "cellar_key")
	things._card(wiring.card("pickup"))
	ok(String(things.status.text).contains("already"), "a thing that already is something says so", things.status.text)
	await select(paper)
	things._card(wiring.card("note"))
	await frames(3)
	ok(paper.get_script() != null and paper.get_script().resource_path == "res://starter/note.gd", "Note on the selected sheet of paper")
	await select(lamp)
	things._card(wiring.card("logic"))
	await frames(3)
	var lamp_logic := lamp.get_node_or_null("Logic") as HSLogic
	ok(lamp_logic != null and lamp_logic.owner == root and things.thing == lamp, "Logic on the selected lamp (a plain mesh): a Logic node under it, its form shown")
	ok(things.form.find_child("Only0", true, false) != null and things.form.find_child("Then0", true, false) != null, "its form: works only when, when, then")
	things._card(wiring.card("shown"))
	await frames(3)
	ok(lamp.get_node_or_null("Showhide") != null or lamp.find_children("*", "", false, false).any(func(c): return c.get_script() != null and c.get_script().resource_path.ends_with("shown.gd")), "Show / hide adds its node under the lamp")

	# ---- a card placed by a click ----
	things._card(wiring.card("area"))
	ok(plug.armed.get("id") == "area", "Area is armed for the 3D view")
	press(scr(Vector3(-2.0, 0, 1.5)))
	await frames(3)
	var area := root.get_node_or_null("Area") as Area3D
	ok(area != null and area.owner == root and area.global_position.distance_to(Vector3(-2.0, 0, 1.5)) < 0.05 and area.get_node("Shape").owner == root and area.get_script().resource_path == "res://starter/event_area.gd",
		"a click on the floor places an event area there, with its box", str(area.global_position) if area != null else "")
	ok(plug.armed.is_empty() and things.thing == area, "the card let go, the area's form shown")
	things._card(wiring.card("rule"))
	await frames(3)
	var rule := root.get_node_or_null("Rule") as HSLogic
	ok(rule != null and rule.on == "itself" and wiring.is_rule(rule) and "Rule" in names_in(things.list), "Rule: a Logic on its own that happens by itself")
	await shot("02_things_cards")

	# ---- a thing's form ----
	await select(door)
	ok(things.thing == door and things.form.find_child("AddLogic", true, false) != null and things.form.find_child("F_locked_by", true, false) != null,
		"the door's form: no Logic yet (a button for one), and its own Locked by with a picker")
	var lb = things.form.find_child("F_locked_by", true, false)
	(lb.get_node("Line") as LineEdit).text = "cellar_key"
	(lb.get_node("Line") as LineEdit).text_submitted.emit("cellar_key")
	await frames(2)
	ok(str(door.get("locked_by")) == "cellar_key", "its lock typed in the form")
	await select(lamp)
	var only = things.form.find_child("F_needs", true, false)
	ok(only != null and only.has_method("add_word"), "the lamp's Works only when is chips")
	only.add_word("power_on")
	await frames(2)
	ok(lamp_logic.needs == "power_on", "a flag added to it")
	var sw = things.form.find_child("F_set_flags", true, false)
	sw.add_flag("lamp_lit")
	sw.add_flag("dark", "-")
	await frames(2)
	ok(lamp_logic.set_flags == "+lamp_lit, -dark", "its Then's flags as chips: one on, one off", lamp_logic.set_flags)
	var row := row_named(things.list, "Lamp")
	ok(row != null and row.get_text(2) == "power_on" and row.get_text(3).contains("+lamp_lit") and row.get_text(3).contains("−dark"), "the list says what the lamp works only when, and then",
		"%s | %s" % [row.get_text(2), row.get_text(3)] if row != null else "")
	things.add_fire(lamp_logic, door.get_node("Body"))
	await frames(3)
	ok(lamp_logic.fires.size() == 1 and lamp_logic.get_node(lamp_logic.fires[0]) == door, "something to fire: the door, from its collider clicked")

	# ---- a marker tied to a thing, and a thing to a marker, one click each ----
	var npc: HSNpc = plug.add_character(ann)
	await frames(3)
	var quest: HSNpcQuest = HSNpcFlow.quests(npc)[0]
	var walk: HSNpcMarker = plug.add_marker({"id": "walk", "title": "Walk", "kind": "walk"}, Vector3(2, 0, 1))
	await frames(3)
	mdock.make_visible()
	await frames(4)
	var sw0 = mdock.form.find_child("F_start_when", true, false)
	ok(sw0 != null and sw0.links.size() == 1, "a marker's Starts when offers 'A thing… (click it)'")
	(sw0.links[0][1] as Callable).call(sw0)
	ok(plug.picking.is_valid(), "it waits for a click in the 3D view")
	press(scr(door.global_position + Vector3(0, 1.0, 0.06)))
	await frames(4)
	var door_logic := door.get_node_or_null("Logic") as HSLogic
	ok(door_logic != null and door_logic.on == "signal" and door_logic.on_signal == "opened" and door_logic.set_flags == "+door_opened",
		"the door clicked: it gets a Logic that turns 'door_opened' on when it's opened", "%s %s %s" % [door_logic.on, door_logic.on_signal, door_logic.set_flags] if door_logic != null else "none")
	ok(walk.start_when == "door_opened", "and the marker waits for that flag", walk.start_when)
	things.make_visible()
	await select(key)
	await frames(3)
	things._card(wiring.card("logic"))
	await frames(3)
	var key_logic := key.get_node_or_null("Logic") as HSLogic
	var kn = things.form.find_child("F_needs", true, false)
	ok(key_logic != null and kn != null and kn.links.size() == 1, "a thing's Works only when offers 'A character's marker… (click its pin)'")
	(kn.links[0][1] as Callable).call(kn)
	await redraw()
	var pin := hot("pin", walk)
	ok(plug.picking_pin.is_valid() and not pin.is_empty(), "it waits for a click on a pin")
	if not pin.is_empty():
		press(pin[0]["at"])
	await frames(4)
	ok(walk.set_flags == "+ann_walk_done" and key_logic.needs == "ann_walk_done", "the walk's pin clicked: its Then turns 'ann_walk_done' on and the key asks for it", "%s | %s" % [walk.set_flags, key_logic.needs])
	await shot("03_things_form")

	# ---- the Flags tab ----
	flags.make_visible()
	await frames(5)
	flags.refresh()
	await frames(2)
	ok(flags.is_visible_in_tree(), "the Flags tab is shown")
	var all := names_in(flags.table)
	for want in ["door_opened", "ann_walk_done", "power_on", "lamp_lit", "dark", "talked:ann", "cellar_key"]:
		ok(want in all, "the list has '%s'" % want, str(all))
	var r1 := row_named(flags.table, "door_opened")
	ok(r1 != null and r1.get_text(3) == "Door (door)" and r1.get_text(4) == "Ann › Quest 1 › 1 Walk", "a flag's two ends in its row: on by the door, needed by the marker",
		"%s | %s" % [r1.get_text(3), r1.get_text(4)] if r1 != null else "")
	ok(r1 != null and r1.get_text(1) == "the game", "it's the game's (a thing and a marker use it)")
	var r2 := row_named(flags.table, "power_on")
	ok(r2 != null and r2.get_text(3) == "nothing yet" and r2.get_tooltip_text(0).contains("nothing turns it on"), "a flag asked for and never turned on is marked", r2.get_tooltip_text(0) if r2 != null else "")
	await show_filter("quest:ann/Quest 1")
	ok(names_in(flags.table) == ["ann_walk_done", "door_opened"], "filtered to a quest: the flags its markers touch", str(names_in(flags.table)))
	await show_filter("things")
	ok("lamp_lit" in names_in(flags.table) and not ("talked:ann" in names_in(flags.table)), "filtered to things")
	await show_filter("problems")
	ok("power_on" in names_in(flags.table) and not ("door_opened" in names_in(flags.table)), "filtered to problems", str(names_in(flags.table)))
	await show_filter("all")
	flags.search.text = "lamp"
	flags.refresh_table()
	ok(names_in(flags.table) == ["lamp_lit"], "the search box", str(names_in(flags.table)))
	flags.search.text = ""
	flags.pick("flag", "door_opened")
	await redraw()
	ok(plug.cur_name == ["flag", "door_opened"] and flags.form.find_child("Use0", true, false) != null and flags.form.find_child("Use1", true, false) != null, "a flag picked: both its uses listed in its form")
	var marks := hot("use")
	ok(marks.size() == 2, "and marked in the 3D view, one chip over the door and one at the marker", str(marks.size()))
	(flags.form.find_child("Use1", true, false) as Button).pressed.emit()
	await frames(4)
	ok(plug.cur == walk, "a use clicked goes there: the marker opens in NPC Markers")
	flags.make_visible()
	await frames(3)
	await shot("04_flags")

	# ---- a rename everywhere, and its undo ----
	flags.rename("flag", "door_opened", "Cellar Open")
	await frames(3)
	ok(walk.start_when == "cellar_open" and door_logic.set_flags == "+cellar_open" and flags.picked == ["flag", "cellar_open"], "renamed: the marker and the door's Logic both say the new name (made safe)",
		"%s | %s" % [walk.start_when, door_logic.set_flags])
	undo()
	await frames(3)
	ok(walk.start_when == "door_opened" and door_logic.set_flags == "+door_opened", "one undo takes both back")
	flags.refresh()
	flags.rename("flag", "door_opened", "lamp_lit")
	ok(walk.start_when == "door_opened" and String(flags.status.text).contains("already"), "a name another flag has is refused", flags.status.text)

	# ---- a flag written down; its note; who it belongs to ----
	flags.search.text = "Night Two"
	(flags.add_btn as Button).pressed.emit()
	await frames(3)
	ok(FileAccess.file_exists("res://flags.json") and wiring.notes().has("night_two") and flags.picked == ["flag", "night_two"], "+ Flag writes one down (res://flags.json) before anything uses it")
	wiring.set_note("night_two", "note", "The second night has begun.")
	wiring.set_note("night_two", "home", "ann/Quest 1")
	flags.refresh()
	await frames(2)
	var rn := row_named(flags.table, "night_two")
	ok(rn != null and rn.get_text(1) == "Ann › Quest 1" and rn.get_tooltip_text(0).contains("nothing uses it"), "its note kept, pinned to a quest; said to be unused", rn.get_text(1) if rn != null else "")
	await select(lamp)
	flags.use_on(plug.selected(), "night_two", "needs")
	await frames(3)
	ok(lamp_logic.needs == "power_on, night_two", "Use it on the thing selected: the lamp needs it too", lamp_logic.needs)
	var probs: Array = wiring.problems()
	ok(probs.any(func(p): return String(p["name"]) == "night_two" and String(p["text"]).contains("belongs to")), "a quest's own flag used by a thing is a Problem")
	wiring.set_note("night_two", "home", "")
	flags.use_on(walk, "night_two", "on")
	await frames(2)
	ok(walk.set_flags == "+ann_walk_done, +night_two", "used on a marker: its Then turns it on", walk.set_flags)
	flags.pick("flag", "night_two")
	var st_box := flags.form.find_child("F_start", true, false) as CheckBox
	ok(st_box != null and not st_box.disabled and not st_box.button_pressed, "its form has 'On when the game starts'")
	if st_box != null:
		st_box.button_pressed = true
	await frames(2)
	ok(HSLogicScan.lines(story.get("flags_start")) == PackedStringArray(["night_two"]) and wiring.starts_on("night_two"), "on at the start: the Story's Flags Start", str(story.get("flags_start")))
	flags.remove("flag", "night_two")
	await frames(3)
	ok(lamp_logic.needs == "power_on" and walk.set_flags == "+ann_walk_done" and HSLogicScan.lines(story.get("flags_start")).is_empty() and not wiring.notes().has("night_two"),
		"deleted: out of the lamp, the marker, the Story and the notes", "%s | %s | %s" % [lamp_logic.needs, walk.set_flags, story.get("flags_start")])

	# ---- the markers tab knows things' flags; its Problems read the same scan ----
	mdock.refresh()
	ok("lamp_lit" in mdock._flags and "door_opened" in mdock._flags, "the NPC Markers tab's pickers list the things' flags too")
	ok(not mdock.problems().any(func(p): return String(p["text"]).contains("door_opened")), "a marker waiting for a flag a door's Logic turns on isn't a Problem")

	# ---- the Inspector ----
	await select(door_logic)
	await frames(6)
	var insp := EditorInterface.get_inspector()
	var chips := insp.find_children("*", "HFlowContainer", true, false).filter(func(c): return c.get_script() != null and (str(c.get_script().resource_path).ends_with("cond_edit.gd") or str(c.get_script().resource_path).ends_with("switch_edit.gd")))
	ok(chips.size() >= 2, "in the Inspector a Logic's Needs and Set Flags are chips", str(chips.size()))
	await select(area)
	await frames(6)
	chips = insp.find_children("*", "HFlowContainer", true, false).filter(func(c): return c.get_script() != null and str(c.get_script().resource_path).ends_with("cond_edit.gd"))
	ok(chips.size() == 1, "and an event area's own Needs", str(chips.size()))
	if chips.size() == 1:
		chips[0].add_word("door_opened")
		await frames(3)
		ok(str(area.get("needs")) == "door_opened", "a flag picked there is set on the area", str(area.get("needs")))
	await shot("05_inspector")

	# ---- a list on a script that isn't a tool (the editor's stand-in refuses its first value unless it's set right) ----
	await select(area)
	things.make_visible()
	await frames(4)
	var at := things.form.find_child("F_add_tasks", true, false) as LineEdit
	ok(at != null, "the area's own Adds the task is in its form")
	if at != null:
		at.text = "cellar: Open the cellar."
		at.text_submitted.emit(at.text)
		await frames(3)
		ok(HSLogicScan.lines(area.get("add_tasks")) == PackedStringArray(["cellar: Open the cellar."]) and typeof(area.get("add_tasks")) == TYPE_PACKED_STRING_ARRAY,
			"a task typed there is kept, as the list it's declared as", str(area.get("add_tasks")))
		ok("cellar" in wiring.names("task"), "and the pickers know the task")
	_done()
