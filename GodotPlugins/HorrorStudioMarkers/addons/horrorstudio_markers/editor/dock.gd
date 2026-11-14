@tool
## The NPC Markers tab (docs/MARKERS.md §7): along the bottom of the editor, three parts.
##   Characters   everyone with markers: her colour, her name, an eye (her markers drawn in the 3D view or not), solo
##   her quests   the quest picked (new, renamed, deleted, what starts it), the palette of cards (click one, then click
##                in the 3D view), the storyboard: her markers in order, numbered as their pins are, dragged to reorder
##   the marker   what's picked, as a short form in plain words; Try it and From here on top
## Everything it changes goes through the plugin's functions, so through the editor's undo. It's built from the scene
## each time something changes; it keeps nothing of its own but what's picked.
extends EditorDock

const Glyphs := preload("res://addons/horrorstudio_markers/editor/glyphs.gd")
const CondEdit := preload("res://addons/horrorstudio_markers/editor/cond_edit.gd")
const KIND_TITLES := [["appear", "Start here"], ["walk", "Walk (or run)"], ["wait", "Wait (or talk)"], ["sit", "Sit"], ["sleep", "Sleep"], ["grab", "Grab, pick up, open"],
	["animation", "Animation"], ["event", "Event"], ["disappear", "Disappear"], ["choice", "Choice"], ["repeat", "Repeat"]]
const STAYS := [["next", "until the next marker can start"], ["secs", "for some seconds"], ["talked", "until you talk to her"]]
const HOWS := [["now", "at once"], ["unseen", "when you're not looking"], ["fade", "fading (the look plugin)"]]
const REBUILD := ["kind", "stay", "action", "loop", "talk", "to_player", "pace", "clip_file", "look", "talks", "face_rules", "fire", "target", "take_secs"]   # fields that change which rows the form has
const CLIP_FOLDERS := ["res://animations"]

var plugin: EditorPlugin
var chars: VBoxContainer
var quest_pick: OptionButton
var quest_title: LineEdit
var quest_when: Control
var board: Tree
var form: VBoxContainer
var form_head: HBoxContainer
var status: Label
var problems_btn: Button
var all_btn: Button
var stop_btn: Button
var cards := {}
var _flags := PackedStringArray()
var _tasks := PackedStringArray()
var _problems: Array = []
var _busy := false
var _sig := ""
var _prob_t := 0
var _pop: PopupPanel


func _init() -> void:
	title = "NPC Markers"
	layout_key = "horrorstudio_markers"
	default_slot = EditorDock.DOCK_SLOT_BOTTOM
	available_layouts = EditorDock.DOCK_LAYOUT_HORIZONTAL | EditorDock.DOCK_LAYOUT_FLOATING
	dock_icon = Glyphs.icon("markers", Color("#6CB4F5"), 16)


func _ready() -> void:
	var s := Glyphs.scale()
	custom_minimum_size = Vector2(0, 250) * s
	var bg := PanelContainer.new()
	bg.add_theme_stylebox_override("panel", Glyphs.box(Color(0.105, 0.12, 0.145, 0.94), 0, 6))
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var cols := HBoxContainer.new()
	cols.add_theme_constant_override("separation", int(8 * s))
	bg.add_child(cols)
	# -- characters
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(205, 0) * s
	cols.add_child(left)
	left.add_child(_head("CHARACTERS"))
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	left.add_child(sc)
	chars = VBoxContainer.new()
	chars.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.add_child(chars)
	var add_char := _button("Character", "plus", "Markers for the character selected in the scene (or pick one from the list).")
	add_char.name = "AddCharacter"
	add_char.pressed.connect(_add_character.bind(add_char))
	left.add_child(add_char)
	all_btn = _button("All quests", "eye", "Draw every quest's markers in the 3D view, not just the one picked.")
	all_btn.toggle_mode = true
	all_btn.toggled.connect(func(on: bool) -> void:
		plugin.all_quests = on
		plugin.update_overlays())
	left.add_child(all_btn)
	problems_btn = _button("No problems", "warn", "What can't work as it is. Click to see; each takes you to its marker.")
	problems_btn.name = "Problems"
	problems_btn.pressed.connect(_show_problems)
	left.add_child(problems_btn)
	# -- quests and storyboard
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.size_flags_stretch_ratio = 1.4
	cols.add_child(mid)
	var qrow := HBoxContainer.new()
	mid.add_child(qrow)
	qrow.add_child(_head("QUEST"))
	quest_pick = OptionButton.new()
	quest_pick.name = "QuestPick"
	quest_pick.custom_minimum_size = Vector2(150, 0) * s
	quest_pick.tooltip_text = "Her quests, in order. A quest's markers run top to bottom."
	quest_pick.item_selected.connect(_on_quest_picked)
	qrow.add_child(quest_pick)
	quest_title = LineEdit.new()
	quest_title.name = "QuestTitle"
	quest_title.placeholder_text = "its name"
	quest_title.custom_minimum_size = Vector2(130, 0) * s
	quest_title.tooltip_text = "The quest's name."
	quest_title.text_submitted.connect(func(t: String) -> void: _rename_quest(t))
	quest_title.focus_exited.connect(func() -> void: _rename_quest(quest_title.text))
	qrow.add_child(quest_title)
	var nq := _button("", "plus", "A new quest for her.")
	nq.name = "NewQuest"
	nq.pressed.connect(func() -> void:
		if plugin.valid(plugin.cur_npc):
			plugin.add_quest(plugin.cur_npc))
	qrow.add_child(nq)
	var dq := _button("", "trash", "Delete this quest and its markers.")
	dq.pressed.connect(func() -> void:
		if plugin.valid(plugin.cur_quest):
			plugin.delete_node(plugin.cur_quest, "delete the quest"))
	qrow.add_child(dq)
	var sl := Label.new()
	sl.text = "  starts"
	sl.add_theme_color_override("font_color", Color(1, 1, 1, 0.6))
	qrow.add_child(sl)
	quest_when = CondEdit.new()
	quest_when.name = "QuestWhen"
	quest_when.none = "after the quest before (the first: when the game starts)"
	quest_when.about_her = false
	quest_when.waits = false
	quest_when.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	quest_when.changed.connect(func(t: String) -> void:
		if plugin.valid(plugin.cur_quest):
			plugin.set_prop(plugin.cur_quest, "starts_when", t, "what starts the quest"))
	qrow.add_child(quest_when)
	var pq := _button("Play", "play", "Play this whole quest in the 3D view on a copy of her.")
	pq.name = "PlayQuest"
	pq.pressed.connect(func() -> void: _test("quest"))
	qrow.add_child(pq)
	stop_btn = _button("Stop", "stop", "Stop the tester.")
	stop_btn.name = "Stop"
	stop_btn.visible = false
	stop_btn.pressed.connect(func() -> void: plugin.tester.stop())
	qrow.add_child(stop_btn)
	var pal := HFlowContainer.new()
	pal.name = "Palette"
	pal.add_theme_constant_override("h_separation", int(3 * s))
	pal.add_theme_constant_override("v_separation", int(3 * s))
	mid.add_child(pal)
	for card in plugin.CARDS:
		var b := Button.new()
		b.name = "Card_" + String(card["id"])
		b.text = String(card["title"])
		b.icon = Glyphs.icon(String(card["id"]) if Glyphs.G.has(card["id"]) else String(card["kind"]), Color("#E6E9EE"), 16)
		b.tooltip_text = String(card.get("tip", ""))
		b.focus_mode = Control.FOCUS_NONE
		b.toggle_mode = true
		b.add_theme_font_size_override("font_size", int(12 * s))
		b.add_theme_stylebox_override("normal", Glyphs.box(Color("#2A303A"), 6, 4))
		b.add_theme_stylebox_override("hover", Glyphs.box(Color("#353D4A"), 6, 4))
		b.add_theme_stylebox_override("pressed", Glyphs.box(Color("#3F6FA8"), 6, 4))
		b.pressed.connect(_card.bind(card))
		pal.add_child(b)
		cards[card["id"]] = b
	board = Tree.new()
	board.name = "Board"
	board.columns = 3
	board.hide_root = true
	board.select_mode = Tree.SELECT_ROW
	board.size_flags_vertical = Control.SIZE_EXPAND_FILL
	board.set_column_expand(0, true)
	board.set_column_expand_ratio(0, 3)
	board.set_column_expand(1, true)
	board.set_column_expand_ratio(1, 2)
	board.set_column_expand(2, true)
	board.set_column_expand_ratio(2, 2)
	board.add_theme_constant_override("v_separation", int(5 * s))
	board.item_selected.connect(_on_row)
	board.button_clicked.connect(func(item: TreeItem, _col: int, _id: int, _mb: int) -> void:
		var n = item.get_metadata(0)
		if n is HSNpcMarker:
			plugin.pick_node(n)
			_test("one"))
	board.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventKey and e.pressed and (e as InputEventKey).keycode == KEY_DELETE and plugin.valid(plugin.cur):
			plugin.delete_node(plugin.cur))
	board.set_drag_forwarding(_drag, _can_drop, _drop)
	mid.add_child(board)
	status = Label.new()
	status.name = "Status"
	status.add_theme_color_override("font_color", Color(1, 1, 1, 0.62))
	status.add_theme_font_size_override("font_size", int(12 * s))
	status.clip_text = true
	mid.add_child(status)
	# -- the marker picked
	var right := VBoxContainer.new()
	right.custom_minimum_size = Vector2(350, 0) * s
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cols.add_child(right)
	form_head = HBoxContainer.new()
	right.add_child(form_head)
	var fs := ScrollContainer.new()
	fs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fs.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(fs)
	form = VBoxContainer.new()
	form.name = "Form"
	form.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	form.add_theme_constant_override("separation", int(3 * s))
	fs.add_child(form)
	visibility_changed.connect(func() -> void:
		if is_visible_in_tree():
			refresh())
	refresh()


# ---- small parts ------------------------------------------------------------------------------------------------------------
func _head(t: String) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", int(11 * Glyphs.scale()))
	l.add_theme_color_override("font_color", Color("#8FA3B8"))
	return l


func _button(t: String, icon: String, tip: String) -> Button:
	var b := Button.new()
	b.text = t
	if icon != "":
		b.icon = Glyphs.icon(icon, Color("#E6E9EE"), 15)
	b.tooltip_text = tip
	b.focus_mode = Control.FOCUS_NONE
	return b


func say(t: String) -> void:
	if status != null:
		status.text = t


# ---- everything again, from the scene -------------------------------------------------------------------------------------------
func refresh() -> void:
	if chars == null or plugin == null:
		return
	_busy = true
	if not plugin.valid(plugin.cur_npc):
		plugin.cur_npc = null
		var list: Array = plugin.npcs()
		if not list.is_empty():
			plugin.cur_npc = list[0]
	if plugin.cur_npc != null and (not plugin.valid(plugin.cur_quest) or HSNpcFlow.npc_of(plugin.cur_quest) != plugin.cur_npc):
		var qs := HSNpcFlow.quests(plugin.cur_npc)
		plugin.cur_quest = plugin.quests_shown(plugin.cur_npc)[0] if not qs.is_empty() else null
	if not plugin.valid(plugin.cur) or HSNpcFlow.npc_of(plugin.cur) != plugin.cur_npc:
		plugin.cur = null
	_scan()
	_fill_chars()
	_fill_quests()
	refresh_board()
	refresh_form()
	_busy = false
	_sig = _signature()


func _signature() -> String:
	var parts := PackedStringArray()
	for n in plugin.npcs():
		parts.append("%d:%s:%d" % [n.get_instance_id(), n.name, n.get_child_count()])
		for q in HSNpcFlow.quests(n):
			parts.append("%s:%d" % [q.name, HSNpcFlow.board(q).size()])
	return "|".join(parts)


## now and then: the scene changed under it (not through undo), the problems counted again
func tick() -> void:
	if plugin == null or chars == null:
		return
	if _signature() != _sig:
		refresh()
	elif plugin.valid(_form_node) and (_vals(_form_node) != _form_vals or not _form_ok()):
		var f := get_viewport().gui_get_focus_owner()          # (changed from outside: the Inspector, an undo; not while a field of the form is being typed in)
		if f == null or not form.is_ancestor_of(f):
			refresh_board()
			_fill_quest_row()
			refresh_form()
	if Time.get_ticks_msec() - _prob_t > 1800:
		_count_problems()
	for id in cards:
		(cards[id] as Button).set_pressed_no_signal(plugin.armed.get("id") == id)
	stop_btn.visible = plugin.tester.playing()
	if plugin.tester.playing():
		say("Testing: " + plugin.tester.status())


## the scene changed through undo; own: by this tab's own form (which then keeps its fields as they are)
func changed(own: bool) -> void:
	if chars == null:
		return
	if own and _form_ok():
		refresh_board()
		_fill_quest_row()
		_form_vals = _vals(_form_node)
		return
	refresh()


func tested() -> void:
	if stop_btn != null:
		stop_btn.visible = false
		say("")


func _scan() -> void:
	var r: Node = plugin.scene_root()
	var set := HSNpcFlow.flags_set(r)
	_flags = PackedStringArray()
	for f in set.keys():
		_flags.append(str(f))
	for n in plugin.npcs():
		for k in ["talked:", "shot:", "down:"]:
			var w: String = k + (n as HSNpc).id()
			if not (w in _flags):
				_flags.append(w)
	_flags.sort()
	_tasks = HSNpcFlow.tasks_known(r)


func _count_problems() -> void:
	_prob_t = Time.get_ticks_msec()
	_problems = []
	var r: Node = plugin.scene_root()
	if r == null:
		return
	var set := HSNpcFlow.flags_set(r)
	var tasks := HSNpcFlow.tasks_known(r)
	for n in plugin.npcs():
		var npc := n as HSNpc
		for p in HSNpcFlow.problems(npc, HSNpcBody.clips_of(npc.character_node()), set, tasks if not tasks.is_empty() else null):
			p["npc"] = npc
			_problems.append(p)
	var bad := 0
	for p in _problems:
		if p["level"] != "tip":
			bad += 1
	problems_btn.text = "No problems" if _problems.is_empty() else ("%d problem%s" % [bad, "" if bad == 1 else "s"] if bad > 0 else "%d tip%s" % [_problems.size(), "" if _problems.size() == 1 else "s"])
	problems_btn.icon = Glyphs.icon("warn", Color("#E0A030") if bad > 0 else (Color("#8FA3B8") if _problems.is_empty() else Color("#6CB4F5")), 15)


func problems() -> Array:
	_count_problems()
	return _problems


func _show_problems() -> void:
	_count_problems()
	if _pop != null:
		_pop.queue_free()
	_pop = PopupPanel.new()
	add_child(_pop)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(520, 0) * Glyphs.scale()
	_pop.add_child(box)
	if _problems.is_empty():
		var l := Label.new()
		l.text = "Nothing that can't work."
		box.add_child(l)
	for p in _problems:
		var b := Button.new()
		b.text = "%s: %s" % [(p["npc"] as HSNpc).display_name(), p["text"]]
		b.icon = Glyphs.icon("warn", {"error": Color("#E57373"), "warn": Color("#E0A030")}.get(p["level"], Color("#6CB4F5")), 14)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.flat = true
		b.pressed.connect(func() -> void:
			_pop.hide()
			if plugin.valid(p["node"]):
				plugin.pick_node(p["node"]))
		box.add_child(b)
	_pop.position = Vector2i(problems_btn.get_screen_position() - Vector2(0, minf(420.0, 34.0 * maxi(_problems.size(), 1) + 20.0) * Glyphs.scale()))
	_pop.popup()


# ---- characters ---------------------------------------------------------------------------------------------------------------
func _fill_chars() -> void:
	for c in chars.get_children():
		chars.remove_child(c)
		c.queue_free()
	var list: Array = plugin.npcs()
	if list.is_empty():
		var l := Label.new()
		l.text = "Nobody yet.\nSelect a character's model in the scene, then press + Character."
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.add_theme_color_override("font_color", Color(1, 1, 1, 0.55))
		chars.add_child(l)
	for n in list:
		var npc := n as HSNpc
		var row := HBoxContainer.new()
		row.name = "Char_" + String(npc.name).validate_node_name()
		var sw := ColorPickerButton.new()
		sw.color = npc.color
		sw.custom_minimum_size = Vector2(18, 18) * Glyphs.scale()
		sw.edit_alpha = false
		sw.tooltip_text = "Her markers' colour."
		sw.popup_closed.connect(func() -> void: plugin.set_prop(npc, "color", sw.color, "her colour"))
		row.add_child(sw)
		var b := Button.new()
		b.text = npc.display_name()
		b.toggle_mode = true
		b.button_pressed = npc == plugin.cur_npc
		b.flat = npc != plugin.cur_npc
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.clip_text = true
		b.focus_mode = Control.FOCUS_NONE
		b.tooltip_text = "Her quests and markers."
		b.pressed.connect(func() -> void:
			plugin.cur = null
			plugin.pick_node(npc, false))
		row.add_child(b)
		var eye := Button.new()
		eye.flat = true
		eye.focus_mode = Control.FOCUS_NONE
		eye.icon = Glyphs.icon("eye" if plugin.is_shown(npc) else "eye_off", Color("#E6E9EE") if plugin.is_shown(npc) else Color("#6B7686"), 15)
		eye.tooltip_text = "Her markers drawn in the 3D view, or not."
		eye.pressed.connect(func() -> void:
			if plugin.hidden.has(npc.get_instance_id()):
				plugin.hidden.erase(npc.get_instance_id())
			else:
				plugin.hidden[npc.get_instance_id()] = true
			plugin.solo = null
			_fill_chars()
			plugin.update_overlays())
		row.add_child(eye)
		var so := Button.new()
		so.flat = true
		so.focus_mode = Control.FOCUS_NONE
		so.icon = Glyphs.icon("solo", Color("#FFD54F") if plugin.solo == npc else Color("#6B7686"), 15)
		so.tooltip_text = "Only her markers drawn."
		so.pressed.connect(func() -> void:
			plugin.solo = null if plugin.solo == npc else npc
			_fill_chars()
			plugin.update_overlays())
		row.add_child(so)
		chars.add_child(row)


func _add_character(from: Control) -> void:
	var sel := EditorInterface.get_selection().get_selected_nodes()
	if sel.size() == 1 and sel[0] is Node3D and not plugin._handles(sel[0]):
		plugin.add_character(sel[0])
		return
	var cands := candidates()
	if cands.is_empty():
		say("Put a character's model in the scene first, select it, then press + Character.")
		return
	var menu := PopupMenu.new()
	add_child(menu)
	for c in cands:
		menu.add_item(String((c as Node).name))
	menu.index_pressed.connect(func(i: int) -> void:
		plugin.add_character(cands[i])
		menu.queue_free())
	menu.position = Vector2i(from.get_screen_position() - Vector2(0, 26.0 * cands.size() * Glyphs.scale()))
	menu.popup()


## who in the scene could have markers: models with a skeleton or animations, not yet anyone's
func candidates() -> Array:
	var out := []
	var r: Node = plugin.scene_root()
	if r == null:
		return out
	var taken := []
	for n in plugin.npcs():
		taken.append((n as HSNpc).character_node())
	for sk in r.find_children("*", "Skeleton3D", true, false) + r.find_children("*", "AnimationPlayer", true, false):
		var p: Node = sk
		while p != null and p != r and p.owner != r:
			p = p.get_parent()
		if p is Node3D and p != r and not (p in out) and not (p in taken) and not String(p.name).begins_with("_"):
			out.append(p)
	return out


# ---- quests -------------------------------------------------------------------------------------------------------------------
func _fill_quests() -> void:
	quest_pick.clear()
	var npc: HSNpc = plugin.cur_npc
	var qs := HSNpcFlow.quests(npc) if npc != null else []
	for i in qs.size():
		quest_pick.add_item("%d  %s" % [i + 1, (qs[i] as HSNpcQuest).label()])
		if qs[i] == plugin.cur_quest:
			quest_pick.select(i)
	quest_pick.disabled = qs.is_empty()
	_fill_quest_row()


func _fill_quest_row() -> void:
	var q: HSNpcQuest = plugin.cur_quest if plugin.valid(plugin.cur_quest) else null
	if not quest_title.has_focus():
		quest_title.text = q.label() if q != null else ""
	quest_title.editable = q != null
	quest_when.flags = _flags
	quest_when.tasks = _tasks
	quest_when.set_text(q.starts_when if q != null else "")
	if q != null:
		var qs := HSNpcFlow.quests(plugin.cur_npc)
		var i := qs.find(q)
		if i >= 0 and i < quest_pick.item_count:
			quest_pick.set_item_text(i, "%d  %s" % [i + 1, q.label()])


func _on_quest_picked(i: int) -> void:
	var qs := HSNpcFlow.quests(plugin.cur_npc)
	if i >= 0 and i < qs.size():
		plugin.pick_node(qs[i], false)


func _rename_quest(t: String) -> void:
	var q: HSNpcQuest = plugin.cur_quest
	if plugin.valid(q) and t.strip_edges() != "" and t.strip_edges() != q.label():
		plugin.set_prop(q, "title", t.strip_edges(), "the quest's name")


# ---- the storyboard -----------------------------------------------------------------------------------------------------------
func _speeds(npc: HSNpc) -> Array:
	var rec := npc.record()
	var clips: Dictionary = rec.get("clips", {}) if rec.get("clips") is Dictionary else {}
	var walk := float((clips.get("walk_loop", {}) as Dictionary).get("speed", HSNpcBody.WALK))
	var run := float((clips.get("run_loop", {}) as Dictionary).get("speed", HSNpcBody.RUN))
	return [npc.walk_speed if npc.walk_speed > 0.0 else walk, npc.run_speed if npc.run_speed > 0.0 else run]


func _clip_len(npc: HSNpc, n: String) -> float:
	for p in HSNpcBody.players_of(npc.character_node()):
		for cand in [n, n + "_loop", n.trim_suffix("_loop")]:
			if (p as AnimationPlayer).has_animation(cand):
				return (p as AnimationPlayer).get_animation(cand).length
	return 0.0


## how long a marker takes, in words
func timing(m: HSNpcMarker) -> String:
	var npc := HSNpcFlow.npc_of(m) as HSNpc
	if npc == null:
		return ""
	var sp := _speeds(npc)
	var from: Vector3 = HSNpcFlow.starts_of(m, HSNpcFlow.home_of(npc), npc.record())[0]["pos"]
	if m.kind == "walk" and not m.to_player:
		var d := HSNpcFlow.length(HSNpcFlow.walk_points(m, from))
		return "%.1f m · %.1f s" % [d, HSNpcFlow.seconds_of(m, from, sp[0], sp[1])]
	if m.kind == "walk":
		return "to you"
	if m.stays():
		return {"next": "until the next", "secs": "%.1f s" % m.stay_secs, "talked": "until you talk"}.get(m.stay, "")
	if m.kind == "animation" and m.clip != "":
		var l := _clip_len(npc, m.clip)
		return "%.1f s" % (l * m.times / maxf(m.anim_speed, 0.05)) if l > 0.0 else ""
	if m.kind == "repeat":
		return ("%d times" % m.repeat_times) if m.repeat_times > 0 else ("until " + HSNpcCond.says(m.repeat_until) if m.repeat_until != "" else "on and on")
	if m.kind in ["appear", "disappear"] and m.how != "now":
		return "when you're not looking" if m.how == "unseen" else "fading"
	return ""


func refresh_board() -> void:
	if board == null:
		return
	var was := _busy
	_busy = true
	board.clear()
	var root := board.create_item()
	var q: HSNpcQuest = plugin.cur_quest if plugin.valid(plugin.cur_quest) else null
	if q != null:
		var labels := {}
		for row in HSNpcFlow.board(q):
			labels[row["node"]] = row["label"]
		_fill(root, q, labels)
	_busy = was


func _fill(parent: TreeItem, container: Node, labels: Dictionary) -> void:
	var col: Color = plugin.cur_npc.color if plugin.cur_npc != null else Color.WHITE
	for it in HSNpcFlow.items(container):
		var m := it as HSNpcMarker
		var row := board.create_item(parent)
		row.set_metadata(0, m)
		row.set_icon(0, Glyphs.icon(Glyphs.of_marker(m), col, 16))
		row.set_text(0, "%s   %s%s" % [labels.get(m, ""), m.title(), ("  ·  " + m.note) if m.note != "" else ""])
		row.set_text(1, HSNpcCond.says(m.start_when))
		row.set_custom_color(1, Color("#9CCB9F"))
		row.set_tooltip_text(1, "Starts when: " + (HSNpcCond.says(m.start_when) if m.start_when != "" else "at once"))
		var extra := PackedStringArray()
		var tm := timing(m)
		if tm != "":
			extra.append(tm)
		if m.talk:
			extra.append("talk")
		if m.face != "" or not m.face_rules.is_empty():
			extra.append("face")
		if m.look != "" or m.look_skin != "" or m.look_eyes != "":
			extra.append("look")
		if m.set_flags != "":
			extra.append(m.set_flags)
		row.set_text(2, "  ·  ".join(extra))
		row.set_custom_color(2, Color(1, 1, 1, 0.6))
		if m.needs_body() or m.kind in ["event", "disappear"]:
			row.add_button(2, Glyphs.icon("play", Color("#9CCB9F"), 13), 0, false, "Try this marker in the 3D view.")
		if m == plugin.cur:
			row.select(0)
		if m.kind == "choice":
			for w in m.ways():
				var way := w as HSNpcWay
				var wr := board.create_item(row)
				wr.set_metadata(0, way)
				wr.set_icon(0, Glyphs.icon("way", col.darkened(0.2), 16))
				wr.set_text(0, "%s   %s" % [labels.get(way, ""), way.title()])
				wr.set_custom_color(0, Color("#C9B6E8"))
				if plugin.picks.get(m, 0) == m.ways().find(way):
					wr.set_text(2, "the tester takes this way")
					wr.set_custom_color(2, Color(1, 1, 1, 0.4))
				if way == plugin.cur:
					wr.select(0)
				_fill(wr, way, labels)
		elif m.kind == "repeat":
			_fill(row, m, labels)


func _on_row() -> void:
	if _busy:
		return
	var it := board.get_selected()
	if it == null:
		return
	var n = it.get_metadata(0)
	if n is HSNpcWay:
		var ch := (n as Node).get_parent() as HSNpcMarker
		plugin.picks[ch] = ch.ways().find(n)                   # (the way picked is the way the tester takes)
	if n is Node and n != plugin.cur:
		plugin.pick_node(n)


func _drag(_at: Vector2):
	var it := board.get_selected()
	if it == null or not (it.get_metadata(0) is Node):
		return null
	var l := Label.new()
	l.text = it.get_text(0)
	board.set_drag_preview(l)
	board.drop_mode_flags = Tree.DROP_MODE_INBETWEEN | Tree.DROP_MODE_ON_ITEM
	return {"type": "hs_marker", "node": it.get_metadata(0)}


func _can_drop(at: Vector2, data) -> bool:
	return data is Dictionary and data.get("type") == "hs_marker" and not _drop_spot(at, data.get("node")).is_empty()


# where a row dropped at a place in the list goes: [its new parent, the index there], or [] when it can't
func _drop_spot(at: Vector2, n) -> Array:
	if not (n is Node) or not plugin.valid(plugin.cur_quest):
		return []
	var it := board.get_item_at_position(at)
	if it == null:
		return [plugin.cur_quest, plugin.cur_quest.get_child_count()] if n is HSNpcMarker else []
	var t: Node = it.get_metadata(0)
	var sect := board.get_drop_section_at_position(at)
	if t == n or (n as Node).is_ancestor_of(t):
		return []
	if n is HSNpcWay:                                          # a way: among the ways of a Choice
		if t is HSNpcWay:
			return [t.get_parent(), t.get_index() + (1 if sect > 0 else 0)]
		return [t, t.get_child_count()] if t is HSNpcMarker and (t as HSNpcMarker).kind == "choice" else []
	if sect == 0 and (t is HSNpcWay or (t is HSNpcMarker and (t as HSNpcMarker).kind == "repeat")):
		return [t, t.get_child_count()]                        # onto a way or a Repeat: inside it, last
	if t is HSNpcWay:
		return [t, 0] if sect > 0 else []
	return [t.get_parent(), t.get_index() + (1 if sect > 0 else 0)]


func _drop(at: Vector2, data) -> void:
	var spot := _drop_spot(at, data.get("node"))
	if not spot.is_empty():
		plugin.move_node(data["node"], spot[0], int(spot[1]))


func _card(card: Dictionary) -> void:
	for id in cards:
		(cards[id] as Button).set_pressed_no_signal(false)
	if not plugin.valid(plugin.cur_npc):
		say("Add a character first: select her model in the scene and press + Character.")
		return
	var m := HSNpcMarker.new()
	m.kind = String(card["kind"])
	for k in (card.get("set", {}) as Dictionary):
		if k != "talks":
			m.set(k, card["set"][k])
	var placed := m.is_placed()
	m.free()
	if placed:
		if plugin.armed.get("id") == card["id"]:
			plugin.arm({})
		else:
			plugin.arm(card)
			(cards[card["id"]] as Button).set_pressed_no_signal(true)
	else:
		plugin.arm({})
		plugin.add_marker(card)


func _test(mode: String) -> void:
	var m: HSNpcMarker = plugin.cur as HSNpcMarker if plugin.cur is HSNpcMarker else null
	if m == null and plugin.valid(plugin.cur_quest):
		var first := HSNpcFlow.items(plugin.cur_quest)
		m = first[0] if not first.is_empty() else null
	var why: String = plugin.tester.play(plugin.cur_npc, m, mode)
	say(why if why != "" else "Testing…")
	stop_btn.visible = plugin.tester.playing()


# ---- the form -----------------------------------------------------------------------------------------------------------------
var _form_node: Node
var _form_shape := ""
var _form_vals := 0


# everything a node keeps, as one number: to see it changed from outside the form
func _vals(n: Node) -> int:
	if n == null or not is_instance_valid(n):
		return 0
	var parts := []
	for p in n.get_property_list():
		if (int(p["usage"]) & PROPERTY_USAGE_STORAGE) and (int(p["usage"]) & PROPERTY_USAGE_SCRIPT_VARIABLE):
			parts.append(str(n.get(p["name"])))
	if n is Node3D:
		parts.append(str((n as Node3D).transform))
	return hash(parts)


func _shape(n: Node) -> String:
	if not (n is HSNpcMarker):
		return str(n.get_instance_id()) if n != null else ""
	var parts := PackedStringArray([str(n.get_instance_id())])
	for k in REBUILD:
		parts.append(str(n.get(k)))
	parts.append(str((n as HSNpcMarker).ways().size()))
	return "|".join(parts)


func _form_ok() -> bool:
	var n: Node = plugin.cur if plugin.valid(plugin.cur) else (plugin.cur_npc if plugin.valid(plugin.cur_npc) else null)
	return n == _form_node and _shape(n) == _form_shape


func _sec(t: String) -> VBoxContainer:
	var l := _head(t.to_upper())
	var m := MarginContainer.new()
	m.add_theme_constant_override("margin_top", int(7 * Glyphs.scale()))
	m.add_child(l)
	form.add_child(m)
	var box := VBoxContainer.new()
	box.name = "Sec_" + t.validate_node_name()
	box.add_theme_constant_override("separation", int(3 * Glyphs.scale()))
	form.add_child(box)
	return box


func _row(box: Container, label: String, ctl: Control, tip := "") -> Control:
	var r := HBoxContainer.new()
	var l := Label.new()
	l.text = label
	l.custom_minimum_size = Vector2(108, 0) * Glyphs.scale()
	l.add_theme_color_override("font_color", Color(1, 1, 1, 0.78))
	l.tooltip_text = tip
	l.mouse_filter = Control.MOUSE_FILTER_STOP if tip != "" else Control.MOUSE_FILTER_IGNORE
	r.add_child(l)
	ctl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if tip != "" and ctl.tooltip_text == "":
		ctl.tooltip_text = tip
	r.add_child(ctl)
	box.add_child(r)
	return ctl


func _note(box: Container, t: String) -> void:
	var l := Label.new()
	l.text = t
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_color_override("font_color", Color(1, 1, 1, 0.5))
	l.add_theme_font_size_override("font_size", int(11 * Glyphs.scale()))
	box.add_child(l)


func _num(n: Object, prop: String, lo: float, hi: float, step: float, suffix := "") -> SpinBox:
	var sb := SpinBox.new()
	sb.name = "F_" + prop
	sb.min_value = lo
	sb.max_value = hi
	sb.step = step
	sb.suffix = suffix
	sb.value = float(n.get(prop))
	sb.value_changed.connect(func(v: float) -> void: _put(n, prop, int(v) if typeof(n.get(prop)) == TYPE_INT else v))
	return sb


func _check(n: Object, prop: String, t: String, tip := "") -> CheckBox:
	var cb := CheckBox.new()
	cb.name = "F_" + prop
	cb.text = t
	cb.tooltip_text = tip
	cb.button_pressed = bool(n.get(prop))
	cb.toggled.connect(func(on: bool) -> void: _put(n, prop, on))
	return cb


func _text(n: Object, prop: String, hint := "") -> LineEdit:
	var le := LineEdit.new()
	le.name = "F_" + prop
	le.text = str(n.get(prop))
	le.placeholder_text = hint
	le.text_submitted.connect(func(t: String) -> void: _put(n, prop, t))
	le.focus_exited.connect(func() -> void: _put(n, prop, le.text))
	return le


func _pick(n: Object, prop: String, items: Array) -> OptionButton:
	var ob := OptionButton.new()
	ob.name = "F_" + prop
	var cur := str(n.get(prop))
	var found := false
	for i in items.size():
		ob.add_item(str(items[i][1]))
		ob.set_item_metadata(i, items[i][0])
		if str(items[i][0]) == cur:
			ob.select(i)
			found = true
	if not found and cur != "":
		ob.add_item(cur)
		ob.set_item_metadata(ob.item_count - 1, cur)
		ob.select(ob.item_count - 1)
	ob.item_selected.connect(func(i: int) -> void: _put(n, prop, ob.get_item_metadata(i)))
	return ob


func _cond(n: Object, prop: String, none: String, about_her := true, waits := true) -> Control:
	var ce := CondEdit.new()
	ce.name = "F_" + prop
	ce.none = none
	ce.about_her = about_her
	ce.waits = waits
	ce.flags = _flags
	ce.tasks = _tasks
	ce.text = str(n.get(prop))
	ce.changed.connect(func(t: String) -> void: _put(n, prop, t))
	return ce


# a field set from the form (undoable); the form made again when it changes which rows there are
func _put(n: Object, prop: String, value) -> void:
	if _busy or n == null or not is_instance_valid(n):
		return
	if typeof(n.get(prop)) == typeof(value) and n.get(prop) == value:
		return
	plugin.set_prop(n, prop, value)
	if prop in REBUILD:
		refresh_form.call_deferred()
	plugin.update_overlays()


func refresh_form() -> void:
	if form == null:
		return
	var was := _busy
	_busy = true
	for c in form.get_children():
		form.remove_child(c)
		c.queue_free()
	for c in form_head.get_children():
		form_head.remove_child(c)
		c.queue_free()
	var n: Node = plugin.cur if plugin.valid(plugin.cur) else (plugin.cur_npc if plugin.valid(plugin.cur_npc) else null)
	_form_node = n
	_form_shape = _shape(n)
	_form_vals = _vals(n)
	var t := Label.new()
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.clip_text = true
	var th := EditorInterface.get_editor_theme()
	if th != null and th.has_font("bold", "EditorFonts"):
		t.add_theme_font_override("font", th.get_font("bold", "EditorFonts"))
	form_head.add_child(t)
	if n == null:
		t.text = "NPC Markers"
		_note(form, "Put a character's model in the scene, select it and press + Character. Then pick a card (Walk, Sit, Talk...) and click in the 3D view where it goes.")
	elif n is HSNpc:
		t.text = (n as HSNpc).display_name()
		_form_npc(n)
	elif n is HSNpcWay:
		t.text = "%s  ·  a way of the Choice" % HSNpcFlow.label_of(n)
		_form_way(n)
	elif n is HSNpcBend:
		t.text = "A bend of %s" % HSNpcFlow.label_of(n.get_parent())
		_note(form, "A point the path goes through. Drag it in the 3D view; right-click it there to delete it.")
		var del := _button("Delete this bend", "trash", "")
		del.pressed.connect(func() -> void: plugin.delete_node(n, "delete a bend"))
		form.add_child(del)
	else:
		var m := n as HSNpcMarker
		t.text = "%s  ·  %s" % [HSNpcFlow.label_of(m), m.title()]
		if m.needs_body() or m.kind in ["event", "disappear"]:
			var b1 := _button("Try it", "play", "Play this marker in the 3D view on a copy of her.")
			b1.name = "TryIt"
			b1.pressed.connect(func() -> void: _test("one"))
			form_head.add_child(b1)
			var b2 := _button("From here", "play", "Play from this marker to the end of the quest.")
			b2.name = "FromHere"
			b2.pressed.connect(func() -> void: _test("from"))
			form_head.add_child(b2)
		var del2 := _button("", "trash", "Delete this marker.")
		del2.name = "Delete"
		del2.pressed.connect(func() -> void: plugin.delete_node(m))
		form_head.add_child(del2)
		_form_marker(m)
	_busy = was


func _form_npc(npc: HSNpc) -> void:
	var b := _sec("Who she is")
	_row(b, "Name", _text(npc, "npc_name", String(npc.character_node().name) if npc.character_node() != null else "her name"), "In conversations and here. Empty: her model's name.")
	var who := Label.new()
	who.text = String(npc.character_node().name) if npc.character_node() != null else "nobody: pick her model in the Inspector (Character)"
	_row(b, "Her model", who)
	b.add_child(_check(npc, "starts_hidden", "Hidden until her first marker that needs her"))
	var w := _sec("How she moves")
	_row(w, "Walk speed", _num(npc, "walk_speed", 0.0, 8.0, 0.05, " m/s"), "0: as her own walk was made (the Animator's).")
	_row(w, "Run speed", _num(npc, "run_speed", 0.0, 12.0, 0.05, " m/s"), "0: as her own run was made.")
	w.add_child(_check(npc, "waits_for_player", "Waits a moment when you're in her way"))
	w.add_child(_check(npc, "solid", "You can't walk through her"))
	var sh := _sec("If she's shot down")
	_row(sh, "Then", _pick(npc, "when_shot_down", [[0, "her quest stops (a later quest brings her back)"], [1, "she's gone for good"], [2, "she can't be killed: up again and on"]]),
		"What the weapons plugin's HSHitReact going down means for her markers. Flags either way: shot:%s, down:%s." % [npc.id(), npc.id()])
	_row(sh, "Down for", _num(npc, "back_up_secs", 0.5, 60.0, 0.5, " s"), "She can't be killed: how long she's down.")
	sh.add_child(_check(npc, "threat", "The player's fear rises near her (a threat)"))
	_note(form, "Her flags: talked:%s when you've talked to her, shot:%s at her first hit, down:%s when she's shot down." % [npc.id(), npc.id(), npc.id()])


func _form_way(way: HSNpcWay) -> void:
	var b := _sec("Taken when")
	b.add_child(_cond(way, "when", "otherwise (when no way above is taken)", true, false))
	_row(b, "Note", _text(way, "note", "what it's for"))
	_note(form, "The Choice takes the first way, top to bottom, whose flags are on. Markers dropped while this way is picked go inside it. Picking a way here also tells the tester to take it.")
	var del := _button("Delete this way", "trash", "")
	del.pressed.connect(func() -> void: plugin.delete_node(way))
	form.add_child(del)


func _clip_items(npc: HSNpc, none: String) -> Array:
	var items := [["", none]]
	for c in HSNpcBody.clips_of(npc.character_node() if npc != null else null):
		items.append([c, String(c).replace("_", " ")])
	return items


func _file_items() -> Array:
	var items := [["", "(none)"]]
	for folder in CLIP_FOLDERS:
		_files(folder, items, 0)
	return items


func _files(folder: String, items: Array, depth: int) -> void:
	if not DirAccess.dir_exists_absolute(folder) or depth > 2:
		return
	for f in DirAccess.get_files_at(folder):
		if f.get_extension().to_lower() in ["npz", "res", "tres", "anim"]:
			items.append([folder + "/" + f, f])
	for d in DirAccess.get_directories_at(folder):
		if not d.begins_with("_") and not d.begins_with("."):
			_files(folder + "/" + d, items, depth + 1)


func _face_items(none: String) -> Array:
	var items := [["", none]]
	for f in HSNpcFace.names():
		items.append([f, HSNpcFace.title_of(f)])
	return items


func _look_lists() -> Dictionary:
	var path := "res://addons/horrorstudio_look/look_preset.gd"
	if not ResourceLoader.exists(path):
		return {}
	var consts: Dictionary = (load(path) as Script).get_script_constant_map()
	return {"skins": consts.get("SKINS", []), "eyes": consts.get("EYES", [])}


func _form_marker(m: HSNpcMarker) -> void:
	var npc := HSNpcFlow.npc_of(m) as HSNpc
	var what := _sec("What")
	_row(what, "Kind", _pick(m, "kind", KIND_TITLES), "What she does here. It can be changed; what the new kind doesn't use is kept and ignored.")
	_row(what, "Note", _text(m, "note", "what it's for (shown on its pin)"))
	if m.kind != "choice" and m.kind != "repeat":
		var st := _sec("Starts when")
		st.add_child(_cond(m, "start_when", "at once (when the marker before is done)"))
	match m.kind:
		"walk":
			var b := _sec("The walk")
			b.add_child(_check(m, "to_player", "She comes to you instead of to the pin"))
			if m.to_player:
				_row(b, "Stops", _num(m, "stop_short", 0.3, 5.0, 0.05, " m from you"))
			_row(b, "Pace", _pick(m, "pace", [["walk", "her walk"], ["run", "her run"]]))
			_row(b, "Speed", _num(m, "pace_scale", 0.2, 4.0, 0.05, " ×"), "Times her own speed: 0.5 a slow walk. Her feet keep step.")
			if not m.to_player:
				_row(b, "Or take", _num(m, "take_secs", 0.0, 120.0, 0.5, " s"), "Over 0: she gets there in this many seconds, whatever the distance.")
				_note(b, "Now: " + timing(m))
				b.add_child(_check(m, "smooth", "One smooth curve through her bends", "Off: straight from bend to bend (stairs: a bend at the foot, one at the top)."))
				b.add_child(_check(m, "face_arrow", "There, she turns to the arrow", "Off: she stays facing the way she came."))
			b.add_child(_check(m, "follow_floor", "Her height from the floor under the path", "Stairs and slopes. Off: the path's own height."))
			if not m.to_player:
				_note(b, "Click the + on her path in the 3D view for a bend; drag it. Right-click a bend to delete it.")
		"grab":
			var g := _sec("Her hand")
			_row(g, "Does", _pick(m, "action", [["reach", "reach for the pin"], ["pick_up", "pick a thing up"], ["put_down", "put down what she holds"], ["open", "open a door"]]))
			if m.action in ["pick_up", "open"]:
				var tr := HBoxContainer.new()
				var tl := Label.new()
				var tn := m.get_node_or_null(m.target) if not m.target.is_empty() else null
				tl.text = String(tn.name) if tn != null else "nothing yet"
				tl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				tl.clip_text = true
				tr.add_child(tl)
				var pk := _button("Pick", "target", "Then click it in the 3D view.")
				pk.name = "PickTarget"
				pk.pressed.connect(func() -> void:
					plugin.pick_in_view("the thing" if m.action == "pick_up" else "the door", func(node: Node, _where: Vector3) -> void: set_target(m, node)))
				tr.add_child(pk)
				_row(g, "The thing" if m.action == "pick_up" else "The door", tr)
			if m.action == "open":
				_row(g, "It opens", _pick(m, "door_opens", [["push", "pushed"], ["pull", "pulled"], ["slide", "slid"]]))
			if m.action == "pick_up":
				g.add_child(_check(m, "keep_in_hand", "It stays in her hand", "Off: it's put away (hidden)."))
			g.add_child(_check(m, "left_hand", "With her left hand"))
			_note(g, "The pin is where her hand goes and the arrow the way she faces. She has three reaches: the floor, a table, a shelf: the one nearest the pin's height.")
		"sleep":
			var sl := _sec("The bed")
			sl.add_child(_check(m, "head_right", "Her head goes to her right", "As she sits on the edge. Off: to her left."))
			_note(sl, "The pin on the bed's edge at the mattress's height, the arrow pointing away from the bed.")
		"sit":
			_note(_sec("The seat"), "The pin on the seat's front edge at the height she sits at, the arrow the way her knees point.")
		"animation":
			var an := _sec("The animation")
			_row(an, "One of hers", _pick(m, "clip", _clip_items(npc, "(none)")))
			_row(an, "Or a file", _pick(m, "clip_file", _file_items()), "A Kimodo .npz or a Godot animation dropped in res://animations/. It's fitted to her skeleton the first time it plays.")
			an.add_child(_check(m, "loop", "It loops (she stays in it)"))
			if not m.loop:
				_row(an, "Times", _num(m, "times", 1, 99, 1))
		"appear", "disappear":
			var h := _sec("How")
			_row(h, "She " + ("comes" if m.kind == "appear" else "goes"), _pick(m, "how", HOWS))
			if m.kind == "disappear":
				_note(h, "Hidden, she isn't drawn, animated or processed. She comes back with a Start here, or by herself (where she vanished) when a later marker needs her.")
		"repeat":
			var r := _sec("Again and again")
			_row(r, "Times", _num(m, "repeat_times", 0, 999, 1), "0: until its flags are so, or until a later quest starts.")
			var ul := Label.new()
			ul.text = "Until"
			r.add_child(ul)
			r.add_child(_cond(m, "repeat_until", "no flags: on and on", true, false))
			_note(r, "Markers dropped while the Repeat is picked go inside it.")
		"choice":
			var c := _sec("Its ways")
			for w in m.ways():
				var way := w as HSNpcWay
				var wr := HBoxContainer.new()
				var wl := Button.new()
				wl.text = HSNpcFlow.label_of(way)
				wl.flat = true
				wl.tooltip_text = "Pick this way: markers dropped then go inside it."
				wl.pressed.connect(func() -> void: plugin.pick_node(way))
				wr.add_child(wl)
				var ce := _cond(way, "when", "otherwise", true, false)
				ce.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				wr.add_child(ce)
				var wx := _button("", "trash", "Delete this way.")
				wx.pressed.connect(func() -> void: plugin.delete_node(way))
				wr.add_child(wx)
				c.add_child(wr)
			var aw := _button("Way", "plus", "Another way.")
			aw.name = "AddWay"
			aw.pressed.connect(func() -> void: add_way(m, "new_flag"))
			c.add_child(aw)
			_note(c, "She takes the first way, top to bottom, whose flags are on, then goes on after the Choice. A way with no flags is 'otherwise': keep it last. With no 'otherwise' she waits until a way opens.")
		"event":
			var e := _sec("The event")
			e.add_child(_check(m, "scare", "It's a jump scare", "The starter's Fear node and night director hear it."))
			e.add_child(_check(m, "let_go", "Let go of her", "From here another script moves her (a chase, a hunt) until her next marker."))
	if m.stays():
		var sb := _sec("She stays")
		_row(sb, "How long", _pick(m, "stay", STAYS))
		if m.stay == "secs":
			_row(sb, "Seconds", _num(m, "stay_secs", 0.0, 600.0, 0.5, " s"))
		if m.kind == "wait":
			sb.add_child(_check(m, "face_player", "She keeps turning to face you"))
	if m.kind in HSNpcMarker.BODY and m.kind != "appear":
		var a := _sec("Animation")
		if m.kind == "wait":
			_row(a, "She waits in", _pick(m, "clip", _clip_items(npc, "her idle")))
		if m.kind != "walk":
			_row(a, "Speed", _num(m, "anim_speed", 0.1, 4.0, 0.05, " ×"), "How fast the clip plays.")
		_row(a, "Eased in", _num(m, "blend", 0.0, 2.0, 0.05, " s"), "Seconds blended into it from what she was doing.")
	if m.kind in HSNpcMarker.BODY or m.kind == "event":
		_form_face(m)
		_form_talk(m, npc)
	if m.kind in HSNpcMarker.BODY or m.kind in ["event", "disappear"]:
		_form_then(m)


func _form_face(m: HSNpcMarker) -> void:
	var f := _sec("Face and look")
	_row(f, "Her face", _pick(m, "face", _face_items("as she was")), "Worn from here on, until another marker's.")
	if m.face != "":
		_row(f, "How much", _num(m, "face_amount", 0.0, 1.5, 0.05))
	for i in m.face_rules.size():
		var r := HSNpcMarker.rule(m.face_rules[i])
		var row := HBoxContainer.new()
		var ce := CondEdit.new()
		ce.none = "otherwise"
		ce.about_her = true
		ce.waits = false
		ce.flags = _flags
		ce.tasks = _tasks
		ce.text = String(r["when"])
		ce.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		ce.changed.connect(func(t: String) -> void: _rule(m, i, t, String(r["face"])))
		row.add_child(ce)
		var ob := OptionButton.new()
		var faces := _face_items("(pick)")
		for k in faces.size():
			ob.add_item(str(faces[k][1]))
			ob.set_item_metadata(k, faces[k][0])
			if faces[k][0] == r["face"]:
				ob.select(k)
		ob.item_selected.connect(func(k: int) -> void: _rule(m, i, String(r["when"]), str(ob.get_item_metadata(k))))
		row.add_child(ob)
		var x := _button("", "trash", "")
		x.pressed.connect(func() -> void: _rule(m, i, "", "", true))
		row.add_child(x)
		f.add_child(row)
	var ar := _button("A face by flags", "plus", "While she's at this marker: a face for when some flags are on (the first that's so). An answer of a conversation can turn a flag on.")
	ar.name = "AddFaceRule"
	ar.pressed.connect(func() -> void: _rule(m, m.face_rules.size(), "new_flag" if m.face_rules.is_empty() else "", "smile"))
	f.add_child(ar)
	var lists := _look_lists()
	if lists.is_empty():
		_note(f, "Her look (skin and eyes) changes with the HorrorStudio Look plugin in the project.")
		return
	var skins := [["", "as it was"]]
	for sk in lists["skins"]:
		skins.append([sk, "her own" if sk == "default" else String(sk)])
	var eyes := [["", "as they were"]]
	for ey in lists["eyes"]:
		eyes.append([ey, "her own" if ey == "default" else String(ey)])
	_row(f, "Her skin", _pick(m, "look_skin", skins), "A creature skin from here on (chrome, ember, the cloak...), or her own again.")
	_row(f, "Her eyes", _pick(m, "look_eyes", eyes), "Creepy eyes from here on (glow, black, void...), or her own again.")
	if m.look_eyes != "" and m.look_eyes != "default":
		var cp := ColorPickerButton.new()
		cp.color = m.look_eye_color if m.look_eye_color.a > 0.0 else Color(1, 0.1, 0.1)
		cp.popup_closed.connect(func() -> void: _put(m, "look_eye_color", cp.color))
		_row(f, "Their colour", cp)
	if m.look_skin != "" or m.look_eyes != "" or m.look != "":
		_row(f, "Turns over", _num(m, "look_secs", 0.0, 5.0, 0.05, " s"))
	var npc := HSNpcFlow.npc_of(m) as HSNpc
	var her := npc.character_node() if npc != null else null
	var sw: Node = her.get_node_or_null("HSLookSwitch") if her != null else null
	if sw != null and sw.has_method("names") and not (sw.call("names") as PackedStringArray).is_empty():
		var looks := [["", "(none)"], ["default", "her own"]]
		for nm in sw.call("names"):
			looks.append([nm, String(nm)])
		_row(f, "Or a saved look", _pick(m, "look", looks), "One of her look switch's looks, by name.")


func _rule(m: HSNpcMarker, i: int, when: String, face: String, remove := false) -> void:
	var rules := PackedStringArray(m.face_rules)
	if remove:
		if i < rules.size():
			rules.remove_at(i)
	else:
		var line := "%s => %s" % [when, face]
		if i < rules.size():
			rules[i] = line
		else:
			rules.append(line)
	_put(m, "face_rules", rules)


func _talks(m: HSNpcMarker) -> Array:
	var out := []
	for c in m.conversations():
		out.append(c)
	if out.is_empty():
		out.append({"when": "", "lines": [], "answers": [], "sets": "", "again": ""})
	return out


func _save_talks(m: HSNpcMarker, list: Array) -> void:
	var typed: Array[Dictionary] = []
	for c in list:
		typed.append(c)
	_put(m, "talks", typed)


func _form_talk(m: HSNpcMarker, npc: HSNpc) -> void:
	var tk := _sec("Talk")
	tk.add_child(_check(m, "talk", "You can talk to her here (E)"))
	if not m.talk:
		return
	var list := _talks(m)
	for i in list.size():
		var c: Dictionary = list[i]
		var cb := VBoxContainer.new()
		cb.name = "Talk%d" % i
		tk.add_child(cb)
		if list.size() > 1:
			var hr := HBoxContainer.new()
			var hl := Label.new()
			hl.text = "Conversation %d, when" % (i + 1)
			hr.add_child(hl)
			var ce := CondEdit.new()
			ce.none = "any time"
			ce.about_her = false
			ce.waits = false
			ce.flags = _flags
			ce.tasks = _tasks
			ce.text = String(c["when"])
			ce.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			ce.changed.connect(func(t: String) -> void:
				var l2 := _talks(m)
				l2[i]["when"] = t
				_save_talks(m, l2))
			hr.add_child(ce)
			var cx := _button("", "trash", "Delete this conversation.")
			cx.pressed.connect(func() -> void:
				var l2 := _talks(m)
				l2.remove_at(i)
				_save_talks(m, l2))
			hr.add_child(cx)
			cb.add_child(hr)
		var te := TextEdit.new()
		te.name = "Lines"
		te.text = "\n".join(PackedStringArray(c["lines"]))
		te.placeholder_text = "What she says, a line a row.\n%s: Looking for something?\n[smile] I can show you.\nYou: Please." % (npc.display_name() if npc != null else "Alex")
		te.custom_minimum_size = Vector2(0, 64) * Glyphs.scale()
		te.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
		te.tooltip_text = "A line a row. 'Name: words' names who says it (just words: her; 'You:' you). '[smile]' in front wears that face while it's said."
		te.focus_exited.connect(func() -> void:
			var l2 := _talks(m)
			var lines := []
			for ln in te.text.split("\n", false):
				if ln.strip_edges() != "":
					lines.append(ln.strip_edges())
			if lines != l2[i]["lines"]:
				l2[i]["lines"] = lines
				_save_talks(m, l2))
		cb.add_child(te)
		var answers: Array = c["answers"]
		for a in answers.size():
			var an: Dictionary = answers[a]
			var arow := HBoxContainer.new()
			arow.name = "Answer%d" % a
			var num := Label.new()
			num.text = "%d" % (a + 1)
			arow.add_child(num)
			var at := LineEdit.new()
			at.text = String(an["text"])
			at.placeholder_text = "an answer"
			at.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			at.size_flags_stretch_ratio = 1.3
			at.tooltip_text = "What you can answer."
			arow.add_child(at)
			var af := LineEdit.new()
			af.text = String(an["sets"])
			af.placeholder_text = "+flag"
			af.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			af.tooltip_text = "Flags it switches: +name on, -name off. A Choice after this marker takes the way of the flag."
			arow.add_child(af)
			var fo := OptionButton.new()
			var faces := _face_items("face")
			for k in faces.size():
				fo.add_item(str(faces[k][1]))
				fo.set_item_metadata(k, faces[k][0])
				if faces[k][0] == an["face"]:
					fo.select(k)
			fo.tooltip_text = "The face she wears from this answer on."
			arow.add_child(fo)
			var ax := _button("", "trash", "Delete this answer.")
			arow.add_child(ax)
			cb.add_child(arow)
			var rep := LineEdit.new()
			rep.text = String(an["reply"])
			rep.placeholder_text = "    her reply to it (optional)"
			cb.add_child(rep)
			var save := func() -> void:
				var l2 := _talks(m)
				var ans: Array = l2[i]["answers"]
				if a >= ans.size():
					return
				var sets := af.text.strip_edges()
				if sets == "" and at.text.strip_edges() != "" and npc != null:      # an answer with no flag yet gets one of its own
					sets = "+%s_%s" % [npc.id(), HSNpcCond.slug(at.text)]
				var now := {"text": at.text.strip_edges(), "sets": sets, "face": str(fo.get_item_metadata(fo.selected)) if fo.selected >= 0 else "", "reply": rep.text.strip_edges()}
				if now != ans[a]:
					ans[a] = now
					_save_talks(m, l2)
			at.text_submitted.connect(func(_t: String) -> void: save.call())
			at.focus_exited.connect(save)
			af.text_submitted.connect(func(_t: String) -> void: save.call())
			af.focus_exited.connect(save)
			rep.text_submitted.connect(func(_t: String) -> void: save.call())
			rep.focus_exited.connect(save)
			fo.item_selected.connect(func(_k: int) -> void: save.call())
			ax.pressed.connect(func() -> void:
				var l2 := _talks(m)
				(l2[i]["answers"] as Array).remove_at(a)
				_save_talks(m, l2))
		var brow := HBoxContainer.new()
		var aa := _button("Answer", "plus", "Something you can answer. It can switch a flag, change her face, get a reply.")
		aa.name = "AddAnswer"
		aa.pressed.connect(func() -> void:
			var l2 := _talks(m)
			(l2[i]["answers"] as Array).append({"text": "Yes" if (l2[i]["answers"] as Array).is_empty() else "No", "sets": "", "face": "", "reply": ""})
			if npc != null:
				var ans: Dictionary = (l2[i]["answers"] as Array).back()
				ans["sets"] = "+%s_%s" % [npc.id(), HSNpcCond.slug(String(ans["text"]))]
			_save_talks(m, l2))
		brow.add_child(aa)
		if not answers.is_empty():
			var mw := _button("A way for each answer", "choice", "Adds a Choice after this marker with a way for each answer's flag.")
			mw.name = "MakeWays"
			mw.pressed.connect(func() -> void: ways_for_answers(m, i))
			brow.add_child(mw)
		cb.add_child(brow)
		var se := LineEdit.new()
		se.text = String(c["sets"])
		se.placeholder_text = "+met_her"
		se.text_submitted.connect(func(t: String) -> void:
			var l2 := _talks(m)
			l2[i]["sets"] = t.strip_edges()
			_save_talks(m, l2))
		se.focus_exited.connect(func() -> void:
			var l2 := _talks(m)
			if l2[i]["sets"] != se.text.strip_edges():
				l2[i]["sets"] = se.text.strip_edges()
				_save_talks(m, l2))
		_row(cb, "When it ends", se, "Flags switched when this conversation is over, whatever was answered.")
		if not answers.is_empty():
			var ag := LineEdit.new()
			ag.text = String(c["again"])
			ag.placeholder_text = "I told you already."
			ag.focus_exited.connect(func() -> void:
				var l2 := _talks(m)
				if l2[i]["again"] != ag.text.strip_edges():
					l2[i]["again"] = ag.text.strip_edges()
					_save_talks(m, l2))
			_row(cb, "Asked again", ag, "Answers are given once. Talked to again she says this (empty: nothing, and no prompt).")
	var ac := _button("Another conversation, for when flags are on", "plus", "She has the first conversation whose flags are on: so a flag picks what she says.")
	ac.pressed.connect(func() -> void:
		var l2 := _talks(m)
		l2.insert(0, {"when": "new_flag", "lines": ["..."], "answers": [], "sets": "", "again": ""})
		_save_talks(m, l2))
	tk.add_child(ac)
	_row(tk, "Prompt", _text(m, "talk_prompt", "Talk"), "The prompt's word: 'E   Talk to her'.")
	tk.add_child(_check(m, "turn_to_player", "She turns to you"))


func _form_then(m: HSNpcMarker) -> void:
	var t := _sec("Then")
	_row(t, "Says", _text(m, "say", "a line, as it starts"))
	if m.say != "":
		_row(t, "For", _num(m, "say_secs", 0.5, 20.0, 0.5, " s"))
	_row(t, "Sound", _text(m, "sound", "a shelf sound's name, or a file"), "Played where she is as the marker starts.")
	var fr := VBoxContainer.new()
	for i in m.fire.size():
		var row := HBoxContainer.new()
		var tn := m.get_node_or_null(m.fire[i])
		var l := Label.new()
		l.text = String(tn.name) if tn != null else "(gone)"
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(l)
		var x := _button("", "trash", "")
		x.pressed.connect(func() -> void:
			var paths: Array[NodePath] = m.fire.duplicate()
			paths.remove_at(i)
			_put(m, "fire", paths))
		row.add_child(x)
		fr.add_child(row)
	var af := _button("Something to fire", "plus", "A scare area, a cue, a look switch, a flag switch: anything with fire(). Fired as the marker starts.")
	af.name = "AddFire"
	af.pressed.connect(_pick_fire.bind(m, af))
	fr.add_child(af)
	_row(t, "Fires", fr)
	_row(t, "Flags", _text(m, "set_flags", "+met_her, -door_locked"), "Switched when the marker is done: +name on, -name off, ~name flipped.")
	var tasks := [["", "(none)"]]
	for id in _tasks:
		tasks.append([id, id])
	_row(t, "Ticks", _pick(m, "tick", tasks), "A task of the Story's to-do list ticked when the marker is done.")
	var at := LineEdit.new()
	at.text = "; ".join(m.add_tasks)
	at.placeholder_text = "id: what to do"
	var save := func() -> void:
		var lines := PackedStringArray()
		for part in at.text.split(";", false):
			if part.strip_edges() != "":
				lines.append(part.strip_edges())
		_put(m, "add_tasks", lines)
	at.text_submitted.connect(func(_x: String) -> void: save.call())
	at.focus_exited.connect(save)
	_row(t, "Adds tasks", at, "Tasks put on the to-do list when the marker is done: 'id: what to do'; several apart by ';'.")


func _pick_fire(m: HSNpcMarker, from: Control) -> void:
	var r: Node = plugin.scene_root()
	var cands := []
	for n in ([r] + r.find_children("*", "", true, false)):
		if n is HSNpcMarker or n is HSNpc or String((n as Node).name).begins_with("_"):
			continue
		if (n as Node).has_method("fire") or (n as Node).has_method("start"):
			cands.append(n)
	if cands.is_empty():
		say("Nothing in the scene can be fired yet (a scare area, a cue, a look switch...).")
		return
	var menu := PopupMenu.new()
	add_child(menu)
	for c in cands:
		menu.add_item(str(r.get_path_to(c)))
	menu.index_pressed.connect(func(i: int) -> void:
		var paths: Array[NodePath] = m.fire.duplicate()
		paths.append(m.get_path_to(cands[i]))
		_put(m, "fire", paths)
		menu.queue_free())
	menu.position = Vector2i(from.get_screen_position())
	menu.popup()


# ---- what the form's buttons do (the check calls these too) ---------------------------------------------------------------------
func set_target(m: HSNpcMarker, node: Node) -> void:
	if not plugin.valid(m) or not plugin.valid(node):
		return
	var t := node
	if m.action == "open":                                     # a door: what has a use() to call, from what was clicked up
		var p := node
		while p != null and p != plugin.scene_root():
			if p.has_method("use") or p.has_method("fire") or p.has_method("open"):
				t = p
				break
			p = p.get_parent()
	_put(m, "target", m.get_path_to(t))
	if m.action == "pick_up" and t is Node3D:                  # (its pin goes to the thing)
		plugin.place_node(m, Transform3D(m.global_transform.basis, (t as Node3D).global_position), m.global_transform, "the pin onto the thing")
	refresh_form.call_deferred()


func add_way(choice: HSNpcMarker, when: String) -> HSNpcWay:
	var w := HSNpcWay.new()
	w.when = when
	w.name = "Way" if when != "" else "Otherwise"
	var ways := choice.ways()
	var at := -1
	if when != "" and not ways.is_empty() and (ways.back() as HSNpcWay).when.strip_edges() == "":
		at = (ways.back() as Node).get_index()                 # (before 'otherwise', which stays last)
	plugin.add_node(choice, w, "a way", at)
	return w


## a Choice after a marker with a way for each answer of its conversation
func ways_for_answers(m: HSNpcMarker, conv: int) -> HSNpcMarker:
	var list := _talks(m)
	if conv >= list.size():
		return null
	var c := HSNpcMarker.new()
	c.kind = "choice"
	c.name = "Choice"
	for a in list[conv]["answers"]:
		var on := ""
		for f in HSNpcCond.switched(String(a["sets"])):
			if f["op"] == "+":
				on = String(f["name"])
				break
		if on == "":
			continue
		var w := HSNpcWay.new()
		w.when = on
		w.note = "answered: " + String(a["text"])
		w.name = "Way"
		c.add_child(w)
	plugin.add_node(m.get_parent(), c, "a Choice for the answers", m.get_index() + 1)
	plugin.pick_node(c)
	return c
