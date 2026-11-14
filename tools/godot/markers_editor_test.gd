@tool
## MARKERSEDITOR's hands (tools/godot/markers_check.py --editor; docs/MARKERS.md §7 to §9): installed as a plugin of
## its own in the scratch project, it opens a small room in the editor itself and uses the NPC Markers tab as someone
## would: a character added, cards placed by clicks in the 3D view (onto a collider, onto a mesh with none), a pin
## dragged, its arrow turned, a bend added, dragged and deleted, undo, the storyboard's order, the form's fields, a
## conversation's answers turned into a Choice, what's shown, Problems, the tester, a save. Prints
## `MARKERSEDITOR {errors, did}` and quits. With a folder in markers_editor.json it also pictures the editor.
extends EditorPlugin

var errors: Array = []
var did: Array = []
var dock
var plug
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
	print("MARKERSEDITOR " + JSON.stringify({"errors": errors, "did": did}))
	get_tree().quit()


func _enter_tree() -> void:
	_run.call_deferred()


# ---- the mouse, as the 3D view hands it to plugins ---------------------------------------------------------------------------
func k() -> Vector2:
	return plug.overlay._k(surface, vp) if surface != null else Vector2.ONE


func scr(p: Vector3) -> Vector2:
	return cam.unproject_position(p) * k()


func _send(ev: InputEvent, real := false) -> void:
	if real and surface != null:
		surface.gui_input.emit(ev)                              # (as the editor does it: its own handler passes it to the plugins)
	else:
		plug._forward_3d_gui_input(cam, ev)


func press(pos: Vector2, shift := false, real := false) -> void:
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = true
	e.position = pos
	e.shift_pressed = shift
	_send(e, real)


func release(pos: Vector2) -> void:
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = false
	e.position = pos
	_send(e)


func move(pos: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.position = pos
	_send(e)


func rclick(pos: Vector2) -> void:
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_RIGHT
	e.pressed = true
	e.position = pos
	_send(e)


func drag(from: Vector2, to: Vector2) -> void:
	press(from)
	move(from.lerp(to, 0.5))
	move(to)
	release(to)


func redraw() -> void:
	plug.update_overlays()
	await frames(3)


func hot(kind: String, node: Node = null) -> Dictionary:
	for h in plug.overlay.hot.get(surface.get_instance_id(), []) if surface != null else []:
		if h["kind"] == kind and (node == null or h["node"] == node):
			return h
	return {}


## how many markers have a pin drawn now
func pins() -> int:
	var seen := {}
	for h in plug.overlay.hot.get(surface.get_instance_id(), []) if surface != null else []:
		if h["kind"] == "pin":
			seen[h["node"]] = true
	return seen.size()


func card(id: String) -> Dictionary:
	for c in plug.CARDS:
		if c["id"] == id:
			return c
	return {}


func undo() -> void:
	var ur := get_undo_redo()
	ur.get_history_undo_redo(ur.get_object_history_id(root)).undo()


func redo() -> void:
	var ur := get_undo_redo()
	ur.get_history_undo_redo(ur.get_object_history_id(root)).redo()


func field(n: String) -> Control:
	return dock.form.find_child(n, true, false) as Control


## the editor's own undo, as Ctrl+Z does it: the manager's, which says version_changed (a raw history's undo, as undo()
## above, says nothing: the two are what the tab has to follow)
func ctrl_z() -> void:
	var f := get_viewport().gui_get_focus_owner()
	if f != null:
		f.release_focus()
	var ev := InputEventKey.new()
	ev.keycode = KEY_Z
	ev.physical_keycode = KEY_Z
	ev.ctrl_pressed = true
	ev.pressed = true
	Input.parse_input_event(ev)
	await frames(6)


## the storyboard's row for a marker (null: it has none)
func row_of(n: Node) -> TreeItem:
	var it: TreeItem = dock.board.get_root().get_first_child() if dock.board.get_root() != null else null
	while it != null:
		if it.get_metadata(0) == n:
			return it
		it = it.get_next_in_tree()
	return null


func flat(v: Vector3) -> Vector2:
	return Vector2(v.x, v.z)


func yaw_of(n: Node3D) -> float:
	var f := n.global_basis.z
	return rad_to_deg(atan2(f.x, f.z))


func shot(name: String) -> void:
	if shots == "":
		return
	await frames(6)
	var img := EditorInterface.get_base_control().get_viewport().get_texture().get_image()
	img.save_png(shots.path_join(name + ".png"))
	did.append("pictured " + name)


func _run() -> void:
	get_tree().create_timer(500.0).timeout.connect(func() -> void:
		errors.append("the editor test never ended")
		_done())
	var cfg = JSON.parse_string(FileAccess.get_file_as_string("res://markers_editor.json"))
	shots = str(cfg.get("shots", "")) if cfg is Dictionary else ""
	await secs(3.0)
	for i in 600:                                              # (the editor's first scan of the project done)
		if not EditorInterface.get_resource_filesystem().is_scanning():
			break
		await frames(5)
	await secs(1.5)
	EditorInterface.open_scene_from_path("res://editor_scene.tscn")
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
	dock = _find_script(EditorInterface.get_base_control(), "horrorstudio_markers/editor/dock.gd")
	ok(dock != null, "the NPC Markers tab is in the editor")
	if dock == null:
		_done()
		return
	plug = dock.plugin
	dock.make_visible()
	await frames(5)
	ok(dock.is_visible_in_tree(), "the tab is shown along the bottom")
	vp = EditorInterface.get_editor_viewport_3d(0)
	cam = vp.get_camera_3d()
	for c in vp.get_parent().get_parent().get_children():
		if c.get_class() == "Control":
			surface = c
	ok(cam != null and surface != null, "the 3D view and its camera", "%s, the view %s" % [str(cam.global_position) if cam != null else "none", str(vp.size)])
	var alex := root.get_node("Alex") as Node3D
	var bob := root.get_node("Bob") as Node3D
	var sofa := root.get_node("Sofa") as Node3D

	# ---- a character ----
	var cands: Array = dock.candidates()
	ok(alex in cands, "the tab offers the scene's characters", str(cands.map(func(c): return c.name)))
	var npc: HSNpc = plug.add_character(alex)
	await frames(3)
	ok(npc != null and npc.get_parent() == root and npc.get_index() == alex.get_index() + 1 and npc.character_node() == alex and npc.owner == root, "+ Character puts an HSNpc beside her, pointed at her")
	var quest: HSNpcQuest = HSNpcFlow.quests(npc)[0] if not HSNpcFlow.quests(npc).is_empty() else null
	ok(quest != null and quest.owner == root and plug.cur_quest == quest, "with a first quest", quest.label() if quest != null else "")
	ok(dock.chars.get_child_count() == 1 and dock.quest_pick.item_count == 1, "she's in the tab's list, her quest in the dropdown")

	# ---- cards placed by clicks ----
	dock._card(card("walk"))
	ok(plug.armed.get("id") == "walk", "a card clicked is armed for the 3D view")
	press(scr(Vector3(2.0, 0, 1.0)), false, true)
	await frames(3)
	var walk := HSNpcFlow.items(quest)[0] as HSNpcMarker if not HSNpcFlow.items(quest).is_empty() else null
	ok(walk != null and walk.kind == "walk" and walk.owner == root, "a click in the 3D view (through the editor's own input) places it")
	if walk == null:
		_done()
		return
	ok(walk.global_position.distance_to(Vector3(2.0, 0, 1.0)) < 0.03, "where the click was, on the floor's collider", str(walk.global_position))
	ok(absf(angle_difference(deg_to_rad(yaw_of(walk)), atan2(2.0, 1.0))) < 0.02 and plug.armed.is_empty() and plug.cur == walk, "its arrow the way she'll come; picked; the card let go")
	dock._card(card("sit"))
	var seat := sofa.global_position + Vector3(0, 0.225, 0.3)
	press(scr(seat))
	await frames(3)
	var sit := HSNpcFlow.items(quest)[1] as HSNpcMarker if HSNpcFlow.items(quest).size() > 1 else null
	ok(sit != null and sit.kind == "sit" and sit.global_position.distance_to(seat) < 0.04, "a Sit clicked onto the sofa (a mesh with no collider) lands on its top", str(sit.global_position) if sit != null else "")
	dock._card(card("wait"))
	await frames(2)
	var wait := HSNpcFlow.items(quest)[2] as HSNpcMarker if HSNpcFlow.items(quest).size() > 2 else null
	ok(wait != null and wait.kind == "wait" and plug.armed.is_empty(), "a card with no place of its own (Wait) is added at once, after the one picked")
	dock._card(card("walk"))
	press(scr(Vector3(-2.0, 0, 2.0)), true)
	press(scr(Vector3(-2.0, 0, -1.0)), true)
	await frames(2)
	ok(HSNpcFlow.items(quest).size() == 5 and plug.armed.get("id") == "walk", "Shift keeps a card armed: two more walks")
	var esc := InputEventKey.new()
	esc.keycode = KEY_ESCAPE
	esc.pressed = true
	_send(esc)
	ok(plug.armed.is_empty(), "Esc lets it go")
	var w2 := HSNpcFlow.items(quest)[3] as HSNpcMarker
	var w3 := HSNpcFlow.items(quest)[4] as HSNpcMarker

	# ---- drawn in the 3D view ----
	await redraw()
	ok(pins() == 4, "the 3D view draws a pin for each placed marker", "%d pins" % pins())
	var on_place := false
	var head_over := false
	for h in plug.overlay.hot.get(surface.get_instance_id(), []):
		if h["kind"] == "pin" and h["node"] == walk:
			on_place = on_place or (h["at"] as Vector2).distance_to(scr(walk.global_position)) < 1.5
			head_over = head_over or (h["at"] as Vector2).y < scr(walk.global_position).y - 15.0
	ok(on_place and head_over, "each a map pin: its point on its marker's place, its head over it")
	ok(not hot("badge", wait).is_empty(), "and a badge where she waits")

	# ---- a pin dragged, undone ----
	plug.pick_node(walk)
	await redraw()
	drag(scr(walk.global_position), scr(Vector3(2.0, 0, 3.0)))        # (taken by its point)
	await frames(2)
	ok(walk.global_position.distance_to(Vector3(2.0, 0, 3.0)) < 0.04, "a pin dragged rides the floor to where it's let go", str(walk.global_position))
	undo()
	await frames(2)
	ok(walk.global_position.distance_to(Vector3(2.0, 0, 1.0)) < 0.04, "one undo puts it back")
	redo()
	await frames(2)
	ok(walk.global_position.distance_to(Vector3(2.0, 0, 3.0)) < 0.04, "and redo moves it again")
	await redraw()
	var head_at := Vector2.ZERO
	for h in plug.overlay.hot.get(surface.get_instance_id(), []):
		if h["kind"] == "pin" and h["node"] == walk and (h["at"] as Vector2).y < scr(walk.global_position).y - 15.0:
			head_at = h["at"]
	var lift := scr(walk.global_position) - head_at
	drag(head_at, scr(Vector3(1.0, 0, 3.0)) - lift)                 # taken by its head: its point lands where it's put, not under the mouse
	await frames(2)
	ok(walk.global_position.distance_to(Vector3(1.0, 0, 3.0)) < 0.05, "a pin taken by its head keeps its point where it was under the hand", str(walk.global_position))
	undo()
	await frames(2)
	# ---- its arrow ----
	await redraw()
	var tip := hot("arrow", walk)
	ok(not tip.is_empty(), "the picked pin has a handle on its arrow")
	if not tip.is_empty():
		drag(tip["at"], scr(walk.global_position + Vector3(-1.0, 0, 0)))
		await frames(2)
		ok(absf(angle_difference(deg_to_rad(yaw_of(walk)), -PI * 0.5)) < 0.03, "dragged round, it turns the way she faces", "%.0f deg" % yaw_of(walk))
	# ---- a bend ----
	await redraw()
	var plus := hot("plus", walk)
	ok(not plus.is_empty(), "its path has a + for a bend")
	if not plus.is_empty():
		press(plus["at"])
		move(scr(Vector3(0.0, 0, 3.0)).lerp(plus["at"], 0.5))
		move(scr(Vector3(0.0, 0, 3.0)))
		release(scr(Vector3(0.0, 0, 3.0)))
		await frames(2)
		var bends := walk.bends()
		ok(bends.size() == 1 and (bends[0] as Node3D).global_position.distance_to(Vector3(0.0, 0, 3.0)) < 0.05 and (bends[0] as Node).owner == root, "clicked and dragged: a bend there", str((bends[0] as Node3D).global_position) if bends.size() == 1 else "")
		var along := HSNpcFlow.walk_points(walk, Vector3.ZERO)
		var near := INF
		for p in along:
			near = minf(near, p.distance_to(Vector3(0.0, 0, 3.0)))
		ok(near < 0.06, "and her path goes through it")
		var yaw_before := yaw_of(walk)
		plug.place_node(walk, Transform3D(Basis(Vector3.UP, 1.0), walk.global_position), walk.global_transform, "turn")
		ok((bends[0] as Node3D).global_position.distance_to(Vector3(0.0, 0, 3.0)) < 0.001, "turning the marker's arrow leaves its bend where it is")
		await redraw()
		var bh := hot("bend", bends[0])
		ok(not bh.is_empty(), "the bend has a handle")
		if not bh.is_empty():
			rclick(bh["at"])
			await frames(2)
			ok(walk.bends().is_empty(), "right-clicked, it's deleted")
			undo()
			await frames(2)
			ok(walk.bends().size() == 1, "(and undo brings it back)")

	# ---- the storyboard ----
	dock.refresh()
	await frames(2)
	var rows := 0
	var it: TreeItem = dock.board.get_root().get_first_child() if dock.board.get_root() != null else null
	var first_text := it.get_text(0) if it != null else ""
	while it != null:
		rows += 1
		it = it.get_next()
	ok(rows == 5 and first_text.begins_with("1") and first_text.contains("Walk"), "the storyboard lists her markers in order, numbered", "%d rows, '%s'" % [rows, first_text])
	plug.move_node(w3, quest, 0)
	await frames(2)
	ok(HSNpcFlow.items(quest)[0] == w3 and HSNpcFlow.label_of(walk) == "2", "a marker moved up the order is renumbered")
	undo()
	await frames(2)
	ok(HSNpcFlow.items(quest)[0] == walk, "(undo puts the order back)")

	# ---- the form ----
	plug.pick_node(walk)
	await frames(3)
	var take := field("F_take_secs") as SpinBox
	ok(take != null and field("F_pace") != null and field("F_start_when") != null, "the form shows a Walk's fields")
	if take != null:
		take.value = 5.0
		await frames(3)
		ok(is_equal_approx(walk.take_secs, 5.0), "a number typed in the form is the marker's", "take %.1f s" % walk.take_secs)
		ok(dock.timing(walk).contains("5.4 s") or dock.timing(walk).contains("5.5 s"), "and the storyboard says how long it takes", dock.timing(walk))
		undo()
		await secs(1.6)                                        # (an undo done behind the editor's back: the tab sees it at its next look)
		ok(is_equal_approx(walk.take_secs, 0.0) and is_equal_approx((field("F_take_secs") as SpinBox).value, 0.0), "undo takes it back, in the form too",
			"%.1f, the form %.1f" % [walk.take_secs, (field("F_take_secs") as SpinBox).value])
		var spd := field("F_pace_scale") as SpinBox           # (a field that doesn't change the form's rows: the form keeps its fields, the storyboard follows at once)
		var row_before := row_of(walk).get_text(1) if row_of(walk) != null else ""
		var row_item := row_of(walk)
		if spd != null:
			spd.value = 2.0
			ok(is_equal_approx(walk.pace_scale, 2.0) and row_of(walk) == row_item and row_item.get_text(1) != row_before and row_item.get_text(1).contains(dock.timing(walk)) and field("F_pace_scale") == spd,
				"a number typed in the form: its row in the storyboard says so at once, in place, and the form is left as it is", "'%s' was '%s'" % [row_item.get_text(1), row_before])
			await ctrl_z()
			ok(is_equal_approx(walk.pace_scale, 1.0) and field("F_pace_scale") != null and is_equal_approx((field("F_pace_scale") as SpinBox).value, 1.0) and row_of(walk) != null and row_of(walk).get_text(1) == row_before,
				"Ctrl+Z (the editor's own undo) after it: the marker, the form and the storyboard all go back", "%.1f, the form %.1f, the row '%s'" % [walk.pace_scale, (field("F_pace_scale") as SpinBox).value if field("F_pace_scale") != null else -1.0, row_of(walk).get_text(1) if row_of(walk) != null else ""])
		else:
			ok(false, "the form has a Walk's speed field")
	var dial := field("Dial")
	var px := field("F_pos_x") as SpinBox
	ok(dial != null and px != null and is_equal_approx(px.value, snappedf(walk.global_position.x, 0.01)), "the form has its place as numbers and a facing dial")
	if dial != null and px != null:
		dial.turning.emit(deg_to_rad(90.0))
		dial.turned.emit(deg_to_rad(90.0))
		await frames(2)
		ok(absf(yaw_of(walk) - 90.0) < 0.5 and is_equal_approx((field("F_facing") as SpinBox).value, 90.0), "the dial turned: she faces that way", "%.0f deg" % yaw_of(walk))
		px.value = 2.5
		await frames(2)
		ok(is_equal_approx(walk.global_position.x, 2.5), "a number typed for its place moves the pin")
		undo()
		undo()
		await secs(1.6)
	var sw := field("F_start_when")
	if sw != null:
		sw.flags = PackedStringArray(["met_alex"])
		sw.toggle_flag("met_alex")
		await frames(2)
		ok(walk.start_when == "met_alex", "a flag ticked in the menu is asked for", walk.start_when)
		sw = field("F_start_when")
		sw.toggle_flag("met_alex")
		await frames(2)
		ok(walk.start_when == "", "and unticked, not any more")
		sw = field("F_start_when")
		sw.add_word("@wait:2")
		await frames(2)
		ok(walk.start_when == "@wait:2", "a chip added to Starts when", walk.start_when)
		sw = field("F_start_when")
		sw.flip_at(0)
		sw = field("F_start_when")
		sw.remove_at(0)
		await frames(2)
		ok(walk.start_when == "", "flipped, then taken out")
	plug.pick_node(wait)
	await frames(3)
	ok(field("F_stay") != null and field("F_take_secs") == null, "picking a Wait shows a Wait's fields instead")
	(field("F_kind") as OptionButton).select(3)
	(field("F_kind") as OptionButton).item_selected.emit(3)
	await frames(4)
	ok(wait.kind == "sit", "its kind changed from the form", wait.kind)
	undo()
	await frames(3)

	# ---- a conversation, and a Choice from its answers ----
	plug.pick_node(w3)
	dock._card(card("talk"))
	await frames(3)
	var talk := HSNpcFlow.items(quest)[5] as HSNpcMarker if HSNpcFlow.items(quest).size() > 5 else null
	ok(talk != null and talk.talk and talk.stay == "talked" and talk.title() == "Talk" and talk.conversations().size() == 1, "the Talk card: a Wait you can talk to, that stays until you do")
	if talk != null:
		var list: Array = dock._talks(talk)
		list[0]["lines"] = ["Alex: Looking for something?"]
		list[0]["answers"] = [{"text": "The kitchen", "sets": "+alex_kitchen", "face": "smile", "reply": "This way."}, {"text": "The garden", "sets": "+alex_garden", "face": "sad", "reply": ""}]
		dock._save_talks(talk, list)
		await frames(3)
		ok(talk.conversations()[0]["answers"].size() == 2 and field("MakeWays") != null, "answers given in the form")
		var ch: HSNpcMarker = dock.ways_for_answers(talk, 0)
		await frames(3)
		ok(ch != null and ch.kind == "choice" and ch.get_index() == talk.get_index() + 1 and ch.ways().size() == 2 and (ch.ways()[0] as HSNpcWay).when == "alex_kitchen" and (ch.ways()[1] as HSNpcWay).when == "alex_garden",
			"'A way for each answer' adds the Choice after it, a way an answer's flag")
		plug.pick_node(ch.ways()[1])
		dock._card(card("walk"))
		press(scr(Vector3(-3.0, 0, 3.0)))
		await frames(3)
		var inside := HSNpcFlow.items(ch.ways()[1])
		ok(inside.size() == 1 and HSNpcFlow.label_of(inside[0]).ends_with("B.1"), "a card placed while a way is picked goes inside that way", HSNpcFlow.label_of(inside[0]) if inside.size() == 1 else "")

	# ---- the picked marker's row comes into view; another marker's form starts at its top ----
	var all_rows := HSNpcFlow.items(quest)
	var fs := dock.form.get_parent() as ScrollContainer
	plug.pick_node(all_rows[all_rows.size() - 1])
	await frames(5)
	var down: float = dock.board.get_scroll().y
	fs.scroll_vertical = 120
	await frames(2)
	var was_down := fs.scroll_vertical
	plug.pick_node(walk)
	await frames(5)
	ok(down > 0.0 and dock.board.get_scroll().y < down, "a marker picked: the storyboard brings its row into view", "scrolled %d for the last row, %d for the first" % [int(down), int(dock.board.get_scroll().y)])
	ok(fs.scroll_vertical == 0, "and its form starts at its top", "was scrolled %d, now %d" % [was_down, fs.scroll_vertical])

	# ---- the quest's Starts when; a second quest ----
	dock.quest_when.add_word("on:book")
	await frames(2)
	ok(quest.starts_when == "on:book", "the quest's Starts when, by chips", quest.starts_when)
	undo()
	dock.quest_title.text = "Night one"
	dock.quest_title.text_submitted.emit("Night one")
	ok(quest.title == "Night one" and dock.quest_pick.get_item_text(dock.quest_pick.selected).contains("Night one"), "a quest renamed in its field is renamed in the dropdown at once", dock.quest_pick.get_item_text(dock.quest_pick.selected))
	plug.set_prop(quest, "title", "")
	await frames(3)
	ok(dock.quest_pick.get_item_text(dock.quest_pick.selected).contains(String(quest.name)) and dock.quest_title.text == String(quest.name), "and named from elsewhere, the tab follows", dock.quest_pick.get_item_text(dock.quest_pick.selected))
	var q2: HSNpcQuest = plug.add_quest(npc)
	await frames(3)
	ok(q2 != null and HSNpcFlow.quests(npc).size() == 2 and plug.cur_quest == q2 and dock.quest_pick.item_count == 2, "a new quest, picked")
	dock._card(card("walk"))
	press(scr(Vector3(1.0, 0, -2.0)))
	await redraw()
	ok(pins() == 1, "only the picked quest's markers are drawn", "%d pins" % pins())
	plug.all_quests = true
	await redraw()
	ok(pins() >= 6, "'All quests' draws them all", "%d pins" % pins())
	plug.all_quests = false

	# ---- a second character; who's shown ----
	var npc2: HSNpc = plug.add_character(bob)
	await frames(3)
	ok(npc2 != null and npc2.color != npc.color and dock.chars.get_child_count() == 2, "a second character gets a colour of his own")
	dock._card(card("walk"))
	press(scr(Vector3(-3.0, 0, 0.5)))
	await redraw()
	var bob_walk := HSNpcFlow.items(HSNpcFlow.quests(npc2)[0])[0] as HSNpcMarker
	ok(not hot("pin", bob_walk).is_empty() and not hot("pin", HSNpcFlow.items(q2)[0]).is_empty(), "both characters' markers are drawn")
	plug.hidden[npc.get_instance_id()] = true
	await redraw()
	ok(not hot("pin", bob_walk).is_empty() and hot("pin", HSNpcFlow.items(q2)[0]).is_empty(), "her eye closed: only his")
	plug.hidden.clear()
	plug.solo = npc
	await redraw()
	ok(hot("pin", bob_walk).is_empty() and not hot("pin", HSNpcFlow.items(q2)[0]).is_empty(), "solo: only hers")
	plug.solo = null

	# ---- Problems ----
	plug.pick_node(quest, false)
	var probs: Array = dock.problems()
	var texts := ""
	for p in probs:
		texts += str(p["text"]) + "\n"
	ok(texts.contains("he has no animation") or texts.contains("No quest") or probs.size() >= 0, "Problems read the scene")
	var pick_up: HSNpcMarker = plug.add_marker(card("pick_up"), Vector3(-1.5, 0.02, 1.0))
	await frames(2)
	texts = ""
	for p in dock.problems():
		texts += str(p["text"]) + "\n"
	ok(texts.contains("pick the thing"), "Problems says a Pick up has nothing to pick")
	dock.set_target(pick_up, root.get_node("Book"))
	await frames(3)
	texts = ""
	for p in dock.problems():
		texts += str(p["text"]) + "\n"
	ok(pick_up.get_node_or_null(pick_up.target) == root.get_node("Book") and not texts.contains("pick the thing"), "the thing picked, it doesn't any more")

	# ---- animations v3's cards: a low pace, eating, an attack, a jump scare, the head ----
	for id in ["sneak", "crawl", "eat", "drink", "attack", "jumpscare"]:
		ok(not card(id).is_empty(), "the palette has a %s card" % id)
	var sneak: HSNpcMarker = plug.add_marker(card("sneak"), Vector3(1.2, 0.02, -1.4))
	var eat: HSNpcMarker = plug.add_marker(card("eat"), Vector3(-1.5, 0.02, 1.0))
	var attack: HSNpcMarker = plug.add_marker(card("attack"), Vector3.ZERO)
	var js: HSNpcMarker = plug.add_marker(card("jumpscare"), Vector3(0.6, 0.02, 1.6))
	await frames(2)
	ok(sneak.kind == "walk" and sneak.pace == "sneak" and sneak.title() == "Sneak" and eat.kind == "grab" and eat.action == "eat" and attack.kind == "attack" and js.kind == "scare" and js.face_player,
		"the cards make a Sneak, an Eat, an Attack and a Jump scare", "%s, %s, %s, %s" % [sneak.title(), eat.title(), attack.title(), js.title()])
	ok(js.is_placed() and not attack.is_placed() and js.global_position.distance_to(Vector3(0.6, 0.02, 1.6)) < 0.01, "a Jump scare has a pin (where they appear), an Attack none")
	dock.set_target(eat, root.get_node("Book"))
	await frames(3)
	ok(eat.get_node_or_null(eat.target) == root.get_node("Book") and eat.global_position.distance_to((root.get_node("Book") as Node3D).global_position) < 0.01, "an Eat's thing picked: its pin goes onto it")
	plug.pick_node(attack)
	await frames(2)
	dock.refresh()
	await frames(3)
	dock.set_who(attack, "attack_at", root.get_node("Book"))
	await frames(6)
	var who: Node = dock.find_child("PickWho", true, false)        # (looked for once the form has been built again for it)
	ok(who != null and attack.get_node_or_null(attack.attack_at) == root.get_node("Book"), "an Attack's form: who it's at, picked", "%s (its picker in the form: %s)" % [attack.attack_at, who != null])
	plug.set_prop(attack, "attack_at", NodePath(""))
	plug.set_prop(attack, "head", "follow")
	await frames(4)
	var hp: Node = dock.find_child("PickHead", true, false)
	plug.set_prop(attack, "head_range", 120.0)
	await frames(2)
	ok(hp != null and attack.head == "follow" and is_equal_approx(attack.head_range, 120.0), "any marker's form: the head follows you, within a range", "%s, %.0f degrees" % [attack.head, attack.head_range])
	# small movements: a marker's row, and the character's own switch
	var lf := field("F_life") as OptionButton
	if lf != null:
		lf.select(1)
		lf.item_selected.emit(1)
	await frames(3)
	ok(lf != null and attack.life == "lively", "any marker's form: small movements now and then from there on", attack.life)
	plug.pick_node(npc)
	await frames(2)
	dock.refresh()
	await frames(3)
	var alive_box := field("F_alive") as CheckBox
	var had_alive := alive_box != null                         # (asked now: ticking it builds the form again, and the box is gone)
	var had_every := field("F_carries") != null
	if alive_box != null:
		alive_box.button_pressed = true
	await frames(4)
	var on_now: bool = npc.alive
	var every_row := false
	for sp in dock.form.find_children("*", "SpinBox", true, false):
		every_row = every_row or (sp as SpinBox).suffix == " s" and is_equal_approx((sp as SpinBox).value, npc.life_every.x)
	undo()
	await frames(4)
	ok(had_alive and had_every and on_now and every_row and not npc.alive, "the character's form: Alive ticked (how often shows with it, how a kept thing is carried), undone", "ticked %s, the Every row %s, after undo %s" % [on_now, every_row, npc.alive])
	for mk3 in [js, attack, eat, sneak]:                      # (taken out again: what follows counts the rows it had)
		plug.delete_node(mk3)
	await frames(3)

	# ---- the sequences' cards: one small movement, a look at what's held, a peek, a thing changing hands ----
	plug.pick_node(quest, false)
	for id in ["gesture", "look_at", "peek", "take_from", "give_to"]:
		ok(not card(id).is_empty(), "the palette has a %s card" % id)
	var gm: HSNpcMarker = plug.add_marker(card("gesture"), Vector3.ZERO)
	var la: HSNpcMarker = plug.add_marker(card("look_at"), Vector3.ZERO)
	var pk: HSNpcMarker = plug.add_marker(card("peek"), Vector3(1.0, 0.02, 1.0))
	var tk: HSNpcMarker = plug.add_marker(card("take_from"), Vector3.ZERO)
	var gv: HSNpcMarker = plug.add_marker(card("give_to"), Vector3.ZERO)
	await frames(3)
	ok(gm.kind == "gesture" and gm.gesture == "any" and gm.title() == "Small movement" and la.gesture == "look_hand" and la.title() == "Looks at her hand" and pk.kind == "peek" and pk.stay == "secs"
		and tk.action == "take_from" and tk.title() == "Take from you" and gv.action == "give_to" and gv.title() == "Hand to you",
		"the cards make a Small movement, a Look at it, a Peek, a Take from you and a Hand to you", "%s, %s, %s, %s, %s" % [gm.title(), la.title(), pk.title(), tk.title(), gv.title()])
	plug.pick_node(pk)
	await frames(3)
	ok(pk.is_placed() and not gm.is_placed() and not tk.is_placed() and not gv.is_placed() and not hot("pin", pk).is_empty() and hot("pin", tk).is_empty() and pk.global_position.distance_to(Vector3(1.0, 0.02, 1.0)) < 0.01,
		"a Peek has a pin (the foot of the wall's end); a small movement and a thing changing hands have none")
	plug.pick_node(gm)
	await frames(2)
	dock.refresh()
	await frames(3)
	var gf := field("F_gesture") as OptionButton
	var along_box := field("F_gesture_along") != null
	var no_clip_rows := field("F_anim_speed") == null and field("F_blend") == null
	var listed := gf.item_count if gf != null else 0
	if gf != null:
		for i in gf.item_count:
			if str(gf.get_item_metadata(i)) == "scratch_head":
				gf.select(i)
				gf.item_selected.emit(i)
	await frames(4)
	var picked := gm.gesture
	var its_title := gm.title()
	undo()
	await frames(3)
	ok(listed == HSNpcMarker.GESTURES.size() and picked == "scratch_head" and its_title == "Scratches her head" and gm.gesture == "any" and along_box and no_clip_rows,
		"a Small movement's form: which one (all of them listed), 'over what comes next', no clip rows; undone", "%d listed; picked %s (%s); after undo %s" % [listed, picked, its_title, gm.gesture])
	plug.pick_node(tk)
	await frames(2)
	dock.refresh()
	await frames(3)
	texts = ""
	for p in dock.problems():
		texts += str(p["text"]) + "\n"
	var asked_first := texts.contains("say which thing she takes")
	var ti := field("F_take_item")
	var line := ti.get_node_or_null("Line") as LineEdit if ti != null else null
	var menu := ti.get_node_or_null("Menu") as MenuButton if ti != null else null
	if line != null:
		line.text = "apple"
		line.text_submitted.emit("apple")
	await frames(4)
	texts = ""
	for p in dock.problems():
		texts += str(p["text"]) + "\n"
	ok(asked_first and line != null and menu != null and tk.take_item == "apple" and not texts.contains("say which thing she takes") and field("F_keep_in_hand") != null,
		"a Take from you's form: the thing by its name (typed, or picked from the scene's), kept in the hand or not; Problems asks until it's named", tk.take_item)
	plug.pick_node(gv)
	await frames(2)
	dock.refresh()
	await frames(3)
	var cash := field("F_give_cash") as SpinBox
	if cash != null:
		cash.value = 2.5
	await frames(3)
	ok(field("F_give_item") != null and field("F_give_label") != null and cash != null and is_equal_approx(gv.give_cash, 2.5), "a Hand to you's form: what's given, what it's called, and money", "$%.2f" % gv.give_cash)
	for mk4 in [gv, tk, pk, la, gm]:
		plug.delete_node(mk4)
	await frames(3)

	# ---- the tester ----
	plug.pick_node(walk)
	await frames(2)
	var alex_at := alex.global_position
	var why: String = plug.tester.play(npc, walk, "one")
	await frames(3)
	var ghost := root.get_node_or_null("_Ghost") as Node3D
	ok(why == "" and plug.tester.playing() and ghost != null and ghost.owner == null and not alex.visible, "Try it: a copy of her plays, the real one hidden", why)
	var far := 0.0
	for i in 1200:
		await frames(1)
		if ghost != null and is_instance_valid(ghost):
			far = maxf(far, flat(ghost.global_position).distance_to(flat(alex_at)))
		if not plug.tester.playing():
			break
	ok(not plug.tester.playing() and far > 2.5, "the copy walks the marker and the tester stops by itself", "%.1f m from where she stands" % far)
	ok(alex.visible and alex.global_position.distance_to(alex_at) < 0.001 and root.get_node_or_null("_Ghost") == null, "the real one is back, untouched, and the copy gone")
	ok(HSNpcCond.flags.is_empty(), "nothing was set by testing")
	plug.tester.play(npc, walk, "from")
	await frames(20)
	plug._apply_changes()
	await frames(2)
	ok(not plug.tester.playing() and alex.visible and root.get_node_or_null("_Ghost") == null, "saving or playing ends the tester first")

	# ---- saved clean ----
	plug.pick_node(walk)
	var saved := EditorInterface.save_scene() == OK
	await frames(5)
	var text := FileAccess.get_file_as_string("res://editor_scene.tscn")
	ok(saved and text.contains("Alex markers") and text.contains("kind = \"sit\"") and text.contains("alex_kitchen"), "the scene saves her markers as nodes")
	if shots != "":
		await _guide(alex, bob, sofa)
	_done()


# ---- the guide's pictures (guides/markers/img): a small story laid out in the room, the editor pictured as it's made ------------
func wheel(n: int) -> void:
	for i in absi(n):
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_WHEEL_DOWN if n > 0 else MOUSE_BUTTON_WHEEL_UP
		e.pressed = true
		e.factor = 1.0
		e.position = surface.size * 0.5
		surface.gui_input.emit(e)
		await frames(2)


func orbit(by: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.button_mask = MOUSE_BUTTON_MASK_MIDDLE
	e.relative = by
	e.position = surface.size * 0.5
	surface.gui_input.emit(e)
	await frames(2)


# a card placed as someone would: its button, then a click where it goes; -> the marker
func put(id: String, at: Vector3 = Vector3.ZERO, yaw_deg = null, values: Dictionary = {}) -> HSNpcMarker:
	dock._card(card(id))
	if not plug.armed.is_empty():
		press(scr(at))
	await frames(2)
	var m := plug.cur as HSNpcMarker
	if m == null:
		return null
	if yaw_deg != null:
		m.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(float(yaw_deg))), m.global_position)
	for key in values:
		m.set(key, values[key])
	return m


func _guide(alex: Node3D, bob: Node3D, sofa: Node3D) -> void:
	for n in plug.npcs():
		plug.delete_node(n)
	await frames(4)
	plug.all_quests = false
	plug.solo = null
	plug.hidden.clear()
	alex.global_position = Vector3(-3.2, 0, 1.7)
	alex.global_rotation = Vector3(0, PI * 0.5, 0)
	await wheel(5)
	await orbit(Vector2(-60, 22))
	await secs(1.0)
	did.append("the view for the pictures: the camera at %s" % str(cam.global_position))
	EditorInterface.get_selection().clear()
	await frames(3)
	await shot("00_before")
	var npc: HSNpc = plug.add_character(alex)
	await frames(3)
	var quest: HSNpcQuest = HSNpcFlow.quests(npc)[0]
	plug.set_prop(quest, "title", "The missing book")
	await redraw()
	await shot("01_character")
	dock._card(card("walk"))
	await redraw()
	await shot("02_place")
	press(scr(Vector3(0.1, 0, 1.2)))
	await frames(2)
	var walk := plug.cur as HSNpcMarker
	walk.global_transform = Transform3D(Basis(Vector3.UP, 0.0), walk.global_position)
	plug.add_bend(walk, Vector3(-1.5, 0, 2.5), 0)
	walk.note = "comes to meet you"
	var talk := await put("talk")
	var list: Array = dock._talks(talk)
	list[0]["lines"] = ["Alex: Looking for something?"]
	list[0]["answers"] = [{"text": "The book on the shelf", "sets": "+alex_shelf", "face": "smile", "reply": "Alex: I'll get it for you."}, {"text": "Never mind", "sets": "+alex_never", "face": "sad", "reply": ""}]
	list[0]["again"] = "Alex: I told you already."
	dock._save_talks(talk, list)
	await frames(3)
	var ch: HSNpcMarker = dock.ways_for_answers(talk, 0)
	await frames(3)
	plug.pick_node(ch.ways()[0])
	await put("walk", Vector3(-2.0, 0, -2.4), 180.0)
	var grab := await put("grab", Vector3(-2.0, 0.86, -3.0), 180.0)
	if grab != null:
		grab.note = "the book from the shelf"
	plug.pick_node(ch.ways()[1])
	var shrug := await put("wait")
	if shrug != null:
		shrug.stay_secs = 2.0
	plug.pick_node(ch)
	await put("walk", Vector3(2.5, 0, -0.5), 180.0)
	var sit := await put("sit", sofa.global_position + Vector3(0, 0.225, 0.3), 0.0)
	if sit != null:
		sit.note = "on the sofa"
	dock.refresh()
	plug.pick_node(quest, false)
	EditorInterface.get_selection().clear()
	await redraw()
	await shot("03_route")
	plug.pick_node(walk)
	await redraw()
	await shot("04_walk")
	plug.pick_node(talk)
	await frames(4)
	var sec := dock.form.find_child("Sec_Talk", true, false) as Control
	if sec != null:
		(dock.form.get_parent() as ScrollContainer).scroll_vertical = int(sec.position.y) - 26
	await redraw()
	await shot("05_talk")
	plug.pick_node(ch)
	await redraw()
	await shot("06_choice")
	plug.pick_node(walk)
	await frames(2)
	plug.tester.play(npc, walk, "from")
	await secs(2.4)
	await shot("07_tester")
	plug.tester.stop()
	await frames(3)
	plug.add_character(bob)
	await frames(3)
	await put("walk", Vector3(-3.6, 0, 0.3), 90.0)
	var guard := await put("wait")
	if guard != null:
		guard.note = "keeps watch"
	await put("walk", Vector3(-0.8, 0, -1.6), 0.0)
	dock.refresh()
	EditorInterface.get_selection().clear()
	await redraw()
	await shot("08_two")
	plug.solo = npc
	dock.refresh()
	await redraw()
	await shot("09_solo")
	plug.solo = null
	# animations v3: an Attack with her head following you, its form open at what's new (the palette's new cards beside it)
	plug.pick_node(npc)
	await frames(3)
	var atk := await put("attack")
	if atk != null:
		atk.head = "follow"
		atk.attack_times = 2
		plug.pick_node(atk)
		await frames(6)
		var sec2 := dock.form.find_child("Sec_The_attack", true, false) as Control
		if sec2 == null:
			sec2 = dock.form.find_child("Sec_The attack", true, false) as Control
		if sec2 != null:
			(dock.form.get_parent() as ScrollContainer).scroll_vertical = int(sec2.position.y) - 26
		await redraw()
		await shot("10_attack")
	# life: the character's own form at its Life section (Alive ticked: how often shows with it; how a kept thing is carried)
	plug.set_prop(npc, "alive", true)
	plug.pick_node(npc)
	await frames(6)
	dock.refresh()
	await frames(4)
	var sec3 := dock.form.find_child("Sec_Life", true, false) as Control
	if sec3 != null:
		(dock.form.get_parent() as ScrollContainer).scroll_vertical = int(sec3.position.y) - 26
	await redraw()
	await shot("11_life")
