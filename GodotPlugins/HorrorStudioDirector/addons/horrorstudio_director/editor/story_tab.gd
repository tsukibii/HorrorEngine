@tool
extends VBoxContainer
## The dock's Story tab (docs/GODOT_DIRECTOR.md §6): the quest log. The chapters and their steps in play order (a
## task's objective, its to-dos and events under it; a dialogue's lines; a choice's ways and where they go), the
## step the running game is at marked ▶. Buttons add a chapter, a task, a dialogue, a choice, an ending, a to-do or
## an event where it belongs (after the selected step, in the selected chapter); rows drag to reorder or into
## another chapter; ▲ ▼ move the selected one; Play from here starts the game at the selected step with the flags
## typed under it.

const RUN_FILE := "user://hs_director_run.json"
const STEP_ICON := {"HSTask": "task", "HSDialogue": "dialogue", "HSChoice": "choice", "HSEnding": "ending"}

var dock = null
var tree: Tree
var flags_edit: LineEdit
var note: Label
var _sig := ""


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var bar := HBoxContainer.new()
	add_child(bar)
	var add := MenuButton.new()
	add.text = "+ Add"
	add.flat = false
	add.tooltip_text = "Add a chapter, a step, a to-do, an event, a line or an option where it belongs (after the selected step, in the selected chapter, task or line)"
	var pm := add.get_popup()
	var adds := [["Chapter", "chapter", _add_chapter], ["Task", "task", _add_task], ["Dialogue", "dialogue", _add_dialogue],
		["Choice", "choice", _add_choice], ["Ending", "ending", _add_ending], ["To-do (in the task)", "todo", _add_todo],
		["Event (in the task or chapter)", "event", _add_event], ["Line (in the dialogue)", "line", _add_line], ["Option (of the line or choice)", "option", _add_option]]
	for i in adds.size():
		pm.add_icon_item(dock.icon(adds[i][1]) if dock != null else null, adds[i][0], i)
	pm.id_pressed.connect(func(id): adds[id][2].call())
	bar.add_child(add)
	for spec in [["▲", func(): _nudge(-1), "Move the selected row up"], ["▼", func(): _nudge(1), "Move the selected row down"],
			["✕", _delete, "Delete the selected row's node"], ["▶", _play, "Play the game from its start"],
			["▶ Here", _play_here, "Play the game from the selected step, with the flags below set"]]:
		var b := Button.new()
		b.text = spec[0]
		b.tooltip_text = spec[2]
		b.pressed.connect(spec[1])
		bar.add_child(b)
	tree = Tree.new()
	tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree.custom_minimum_size = Vector2(0, 160)
	tree.columns = 2
	tree.column_titles_visible = false
	tree.set_column_expand_ratio(0, 3)
	tree.set_column_expand_ratio(1, 2)
	tree.set_column_clip_content(1, true)
	tree.hide_root = true
	tree.select_mode = Tree.SELECT_ROW
	tree.drop_mode_flags = Tree.DROP_MODE_INBETWEEN | Tree.DROP_MODE_ON_ITEM
	tree.item_selected.connect(_picked)
	tree.set_drag_forwarding(_drag, _can_drop, _drop)
	add_child(tree)
	flags_edit = LineEdit.new()
	flags_edit.placeholder_text = "▶ Here starts with these flags: read_letter, saw_figure"
	flags_edit.tooltip_text = "The flags set when ▶ Here starts the game at the selected step (commas between)"
	add_child(flags_edit)
	note = Label.new()
	note.clip_text = true
	note.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
	add_child(note)


func tick() -> void:
	var g = dock.game() if dock != null else null
	var sig := _signature(g)
	if sig != _sig:
		refresh()


## what the tree shows, cheaply (redrawn when it changes)
func _signature(g) -> String:
	if g == null:
		return ""
	var parts: Array = [dock.run_step]
	for n in g.find_children("*", "", true, false):
		var c := HSDirector.class_of(n)
		if c in ["HSChapter", "HSTask", "HSTodo", "HSEvent", "HSDialogue", "HSLine", "HSOption", "HSChoice", "HSEnding"]:
			parts.append(str(n.get_path()) + _detail(n))
	return str(parts.hash())


func refresh() -> void:
	if tree == null or dock == null:
		return
	var g = dock.game()
	_sig = _signature(g)
	var keep = _selected_node()
	tree.clear()
	var top := tree.create_item()
	if g == null:
		note.text = "Open the game's main scene (its root an HSGame) for the story. A level open on its own has its events in the Events tab." if dock.root() != null else "No scene open."
		return
	note.text = ("▶ the game is at %s" % dock.run_step) if dock.running and dock.run_step != "" else "Steps play top to bottom; a choice's options and a step's next go elsewhere."
	_rows(g, top, keep)


func _rows(n: Node, parent_item: TreeItem, keep) -> void:
	for c in n.get_children():
		var cls := HSDirector.class_of(c)
		if cls == "HSLevel" or str(c.name).begins_with("_"):
			continue
		if cls == "" and not (c is Node3D) and c.get_child_count() > 0:      # a folder of the user's (a plain Node)
			var f := tree.create_item(parent_item)
			f.set_text(0, str(c.name))
			f.set_metadata(0, c)
			f.set_custom_color(0, Color(0.75, 0.75, 0.75))
			_rows(c, f, keep)
			continue
		if not (cls in ["HSChapter", "HSTask", "HSTodo", "HSEvent", "HSDialogue", "HSLine", "HSOption", "HSChoice", "HSEnding"]):
			continue
		var it := tree.create_item(parent_item)
		it.set_metadata(0, c)
		it.set_icon(0, dock.icon_of(c))
		it.set_text(0, _title(c))
		it.set_text(1, _detail(c))
		it.set_tooltip_text(0, _tooltip(c))
		if cls in STEP_ICON and dock.running and HSDirector.id_of(c) == dock.run_step:
			it.set_text(0, "▶ " + _title(c))
			it.set_custom_color(0, Color(1.0, 0.82, 0.35))
		if cls == "HSChapter":
			it.set_custom_color(0, Color(0.8, 0.85, 1.0))
		if c == keep:
			it.select(0)
		if cls in ["HSChapter", "HSTask", "HSDialogue", "HSLine", "HSChoice"]:
			_rows(c, it, keep)


func _title(c: Node) -> String:
	match HSDirector.class_of(c):
		"HSChapter":
			return "Chapter · " + c.title
		"HSTask":
			return c.title
		"HSDialogue":
			return "Dialogue · " + c.title
		"HSChoice":
			return "Choice · " + c.title
		"HSEnding":
			return "Ending · " + c.title
		"HSTodo":
			return c.text
		"HSEvent":
			return str(c.name)
		"HSLine":
			return "%s: %s" % [c.who if c.who != "" else "(thought)", c.text]
		"HSOption":
			return "↳ " + c.label
	return str(c.name)


func _detail(c: Node) -> String:
	match HSDirector.class_of(c):
		"HSChapter":
			return (c.time() if c.time() != "" else "") + ("" if c.show_card else " (no card)")
		"HSTask":
			var tail := ""
			if not c.next.is_empty():
				var t = c.get_node_or_null(c.next)
				tail = " → " + (str(t.name) if t != null else "?")
			return c.objective + tail
		"HSDialogue":
			return "%d lines" % c.lines().size()
		"HSChoice":
			return "by " + c.by
		"HSEnding":
			return c.kind
		"HSTodo":
			return ("when " + c.done_when.describe()) if c.done_when != null else "(an event ticks it)"
		"HSOption":
			var t = c.get_node_or_null(c.go_to) if not c.go_to.is_empty() else null
			return ("→ " + str(t.name)) if t != null else ""
		"HSEvent":
			var w: String = c.when.describe(c.host()[1]) if c.when != null else ("enters " + c.host()[1] if c.host()[0] == "enter" else ("uses " + c.host()[1] if c.host()[0] == "use" else "the task starts"))
			return w.replace("the player ", "")
	return ""


func _tooltip(c: Node) -> String:
	var what := ""
	match HSDirector.class_of(c):
		"HSEvent":
			what = c.describe() + "\n"
		"HSLine":
			what = c.text + "\n"
		"HSTask":
			what = "%s\n" % c.objective
	return "%s%s (%s): select it to edit it in the Inspector; drag it to move it" % [what, c.name, HSDirector.class_of(c)]


func _picked() -> void:
	var n = _selected_node()
	if n != null:
		dock.select(n)


func _selected_node():
	var it := tree.get_selected() if tree != null else null
	return it.get_metadata(0) if it != null else null


# ---- adding ---------------------------------------------------------------------------------------------------
## where a new step goes: after the selected step, at the end of the selected chapter, else at the end of the story
func _step_place() -> Array:
	var g = dock.game()
	var s = _selected_node()
	if s == null:
		s = dock.selected()
	while s != null and s != g:
		var c := HSDirector.class_of(s)
		if c in STEP_ICON:
			return [s.get_parent(), s.get_index() + 1]
		if c == "HSChapter":
			return [s, -1]
		s = s.get_parent()
	if g == null:
		return [null, -1]
	var story = g.get_node_or_null("Story")
	if story == null:
		var chs := HSDirector.nodes_of(g, "HSChapter")
		if chs.size():
			return [chs[-1], -1]
		return [g, -1]
	var chs2 := HSDirector.nodes_of(story, "HSChapter")
	return [chs2[-1], -1] if chs2.size() else [story, -1]


func _add_step(n: Node, base: String) -> void:
	var p := _step_place()
	if p[0] == null:
		return
	n.name = dock.fresh_name(p[0], base)
	dock.add_node(p[0], n, "add " + base, p[1])


func _add_chapter() -> void:
	var g = dock.game()
	if g == null:
		return
	var parent = g.get_node_or_null("Story")
	if parent == null:
		parent = g
	var ch := HSChapter.new()
	ch.name = dock.fresh_name(parent, "Chapter")
	dock.add_node(parent, ch, "add a chapter")


func _add_task() -> void:
	var t := HSTask.new()
	t.objective = "What the player should do"
	var td := HSTodo.new()
	td.name = "Todo"
	td.text = "The first thing to do"
	t.add_child(td)
	_add_step(t, "Task")


func _add_dialogue() -> void:
	var d := HSDialogue.new()
	var l := HSLine.new()
	l.name = "Line"
	l.text = "..."
	d.add_child(l)
	_add_step(d, "Dialogue")


func _add_choice() -> void:
	var c := HSChoice.new()
	for nm in ["OptionA", "OptionB"]:
		var o := HSOption.new()
		o.name = nm
		o.label = nm
		c.add_child(o)
	_add_step(c, "Choice")


func _add_ending() -> void:
	_add_step(HSEnding.new(), "Ending")


## into the selected task (or the task the selected row is in)
func _add_todo() -> void:
	var t = _up_to(_selected_node(), ["HSTask"])
	if t == null:
		dock.say("Select a task first: the to-do goes into it.")
		return
	var td := HSTodo.new()
	td.text = "Something to do"
	td.done_when = HSWhen.make("use", "")
	td.name = dock.fresh_name(t, "Todo")
	dock.add_node(t, td, "add a to-do")


## into the selected task or chapter (it listens there), else the whole game
func _add_event() -> void:
	var host = _up_to(_selected_node(), ["HSTask", "HSChapter"])
	if host == null:
		host = dock.game()
	if host == null:
		return
	var ev := HSEvent.new()
	ev.when = HSWhen.make("enter", "")
	ev.actions.assign([HSAction.make("think", {"text": "..."})])
	ev.name = dock.fresh_name(host, "Event")
	dock.add_node(host, ev, "add an event")


func _add_line() -> void:
	var d = _up_to(_selected_node(), ["HSDialogue"])
	if d == null:
		return
	var l := HSLine.new()
	l.text = "..."
	var s = _selected_node()
	var at: int = s.get_index() + 1 if (s != null and HSDirector.class_of(s) == "HSLine") else -1
	l.name = dock.fresh_name(d, "Line")
	dock.add_node(d, l, "add a line", at)


func _add_option() -> void:
	var h = _up_to(_selected_node(), ["HSLine", "HSChoice"])
	if h == null:
		return
	var o := HSOption.new()
	o.label = "An answer"
	o.name = dock.fresh_name(h, "Option")
	dock.add_node(h, o, "add an option")


func _up_to(n, classes: Array):
	while n != null and n is Node:
		if HSDirector.class_of(n) in classes:
			return n
		n = n.get_parent()
	return null


# ---- moving -----------------------------------------------------------------------------------------------------
func _nudge(d: int) -> void:
	var n = _selected_node()
	if n == null:
		return
	var p: Node = n.get_parent()
	var i: int = n.get_index() + d
	if i < 0 or i >= p.get_child_count():
		return
	dock.move_node(n, p, i + (1 if d > 0 else 0))


func _delete() -> void:
	var n = _selected_node()
	if n != null:
		dock.delete_node(n)


func _drag(at: Vector2):
	var it := tree.get_item_at_position(at)
	if it == null:
		return null
	var n = it.get_metadata(0)
	if n == null:
		return null
	var l := Label.new()
	l.text = it.get_text(0)
	set_drag_preview(l)
	return {"type": "hs_story_row", "node": n}


func _can_drop(at: Vector2, data) -> bool:
	if not (data is Dictionary) or data.get("type") != "hs_story_row":
		return false
	return _drop_target(at, data["node"]).size() > 0


func _drop(at: Vector2, data) -> void:
	var t := _drop_target(at, data["node"])
	if t.size():
		dock.move_node(data["node"], t[0], t[1])


## where a dragged row lands: [parent, index] or [] where it can't go (a to-do only in a task, a line only in a
## dialogue, a step in a chapter or the story)
func _drop_target(at: Vector2, n: Node) -> Array:
	var it := tree.get_item_at_position(at)
	if it == null:
		return []
	var over = it.get_metadata(0)
	if over == null or over == n or n.is_ancestor_of(over):
		return []
	var sec := tree.get_drop_section_at_position(at)
	var cls := HSDirector.class_of(n)
	var into_ok := {"HSChapter": ["HSTask", "HSDialogue", "HSChoice", "HSEnding", "HSEvent"], "HSTask": ["HSTodo", "HSEvent"],
		"HSDialogue": ["HSLine"], "HSLine": ["HSOption"], "HSChoice": ["HSOption"]}
	var oc := HSDirector.class_of(over)
	if sec == 0:
		if (into_ok.get(oc, []) as Array).has(cls) or (oc == "" and cls in ["HSChapter", "HSTask", "HSDialogue", "HSChoice", "HSEnding", "HSEvent"]):
			return [over, over.get_child_count()]
		return []
	var p: Node = over.get_parent()
	var pc := HSDirector.class_of(p)
	var ok: bool = (into_ok.get(pc, []) as Array).has(cls) or ((pc == "HSGame" or pc == "") and cls in ["HSChapter", "HSTask", "HSDialogue", "HSChoice", "HSEnding", "HSEvent"])
	if not ok:
		return []
	return [p, over.get_index() + (1 if sec > 0 else 0)]


# ---- playing ----------------------------------------------------------------------------------------------------
func _play() -> void:
	if FileAccess.file_exists(RUN_FILE):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(RUN_FILE))
	_run()


func _play_here() -> void:
	var n = _up_to(_selected_node(), STEP_ICON.keys() + ["HSChapter"])
	if n == null:
		note.text = "Select a step (a task, a dialogue, a choice or an ending) to play from."
		return
	if HSDirector.class_of(n) == "HSChapter":
		var first = null
		for c in n.get_children():
			if HSDirector.class_of(c) in STEP_ICON:
				first = c
				break
		if first == null:
			return
		n = first
	var flags: Array = []
	for f in flags_edit.text.split(",", false):
		if f.strip_edges() != "":
			flags.append(f.strip_edges())
	var fa := FileAccess.open(RUN_FILE, FileAccess.WRITE)
	fa.store_string(JSON.stringify({"from": HSDirector.id_of(n), "flags": flags, "items": []}))
	fa.close()
	_run()


func _run() -> void:
	var r: Node = dock.root()
	var main := str(ProjectSettings.get_setting("application/run/main_scene", ""))
	if r != null and r.scene_file_path != "" and r.scene_file_path != main and HSDirector.class_of(r) == "HSGame":
		EditorInterface.play_current_scene()
	else:
		EditorInterface.play_main_scene()
