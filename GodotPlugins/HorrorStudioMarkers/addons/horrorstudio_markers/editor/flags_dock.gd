@tool
## The Flags tab (docs/FLAGS.md §4): along the bottom of the editor, beside NPC Markers. Three parts.
##   Show       a search box; everything, the game's, each character and her quests, things, problems; which kinds
##   the list   every flag, task and thing carried the scene names: whose it is, on at the start, who turns it on,
##              who needs it, a mark when something's wrong with it
##   the one    its name (typed over: renamed everywhere), a note, who it belongs to, every use as a row that takes
##   picked     you there, and Use it: on the thing selected in the scene, or on one clicked in the 3D view
## It keeps nothing but what's picked: the list is read off the scene (HSLogicScan) each time something changes.
extends "res://addons/horrorstudio_markers/editor/panel.gd"

const KINDS := {"flag": ["flag", "Flags", Color("#81C784")], "task": ["task", "Tasks", Color("#BA68C8")], "item": ["carry", "Carried", Color("#FFB74D")]}

var search: LineEdit
var shows: Tree
var table: Tree
var head: HBoxContainer
var add_btn: Button
var kind_btns := {}
var kinds := {"flag": true, "task": true, "item": true}
var filter := "all"                        ## all, game, things, problems, npc:<id>, quest:<id>/<quest>
var picked: Array = []                     ## [kind, name]
var _sig := ""
var _form_sig := ""
var _probs := {}


func _init() -> void:
	title = "Flags"
	layout_key = "horrorstudio_flags"
	default_slot = EditorDock.DOCK_SLOT_BOTTOM
	available_layouts = EditorDock.DOCK_LAYOUT_HORIZONTAL | EditorDock.DOCK_LAYOUT_FLOATING
	dock_icon = Glyphs.icon("flag", Color("#81C784"), 16)


func _ready() -> void:
	var s := Glyphs.scale()
	var cols := _bg()
	# -- what's shown
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(176, 0) * s
	cols.add_child(left)
	search = LineEdit.new()
	search.name = "Search"
	search.placeholder_text = "find a flag…"
	search.clear_button_enabled = true
	search.text_changed.connect(func(_t: String) -> void: refresh_table())
	left.add_child(search)
	left.add_child(_head("SHOW"))
	shows = Tree.new()
	shows.name = "Show"
	shows.hide_root = true
	shows.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shows.add_theme_constant_override("v_separation", int(2 * s))
	shows.item_selected.connect(func() -> void:
		var it := shows.get_selected()
		if it != null and not _busy:
			filter = String(it.get_metadata(0))
			refresh_table())
	left.add_child(shows)
	var krow := HBoxContainer.new()
	left.add_child(krow)
	for k in ["flag", "task", "item"]:
		var b := Button.new()
		b.name = "Kind_" + k
		b.text = KINDS[k][1]
		b.toggle_mode = true
		b.button_pressed = true
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", int(11 * s))
		b.tooltip_text = {"flag": "Flags: on or off.", "task": "Tasks: the to-do list's.", "item": "Things carried: the pocket's."}[k]
		b.toggled.connect(func(on: bool) -> void:
			kinds[k] = on
			refresh_table())
		krow.add_child(b)
		kind_btns[k] = b
	add_btn = _button("Flag", "plus", "A new flag, written down before anything uses it. (Typing a new name in any picker makes one too.)")
	add_btn.name = "AddFlag"
	add_btn.pressed.connect(func() -> void:
		var nm: String = wiring.declare(search.text if search.text.strip_edges() != "" else "new_flag")
		search.text = ""
		pick("flag", nm)
		var le := form.find_child("F_name", true, false) as LineEdit
		if le != null:
			le.grab_focus()
			le.select_all())
	left.add_child(add_btn)
	# -- the list
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.size_flags_stretch_ratio = 1.5
	cols.add_child(mid)
	table = Tree.new()
	table.name = "Table"
	table.columns = 5
	table.hide_root = true
	table.column_titles_visible = true
	table.select_mode = Tree.SELECT_ROW
	table.size_flags_vertical = Control.SIZE_EXPAND_FILL
	for i in 5:
		table.set_column_title(i, ["Name", "Belongs to", "At start", "Turned on by", "Needed by"][i])
		table.set_column_title_alignment(i, HORIZONTAL_ALIGNMENT_LEFT)
		table.set_column_clip_content(i, true)
	table.set_column_expand(0, true)
	table.set_column_custom_minimum_width(0, int(150 * s))
	table.set_column_expand(1, true)
	table.set_column_custom_minimum_width(1, int(110 * s))
	table.set_column_expand(2, false)
	table.set_column_custom_minimum_width(2, int(62 * s))
	table.set_column_expand(3, true)
	table.set_column_expand_ratio(3, 2)
	table.set_column_expand(4, true)
	table.set_column_expand_ratio(4, 2)
	table.item_selected.connect(_on_row)
	table.item_edited.connect(_on_edited)
	mid.add_child(table)
	status = Label.new()
	status.name = "Status"
	status.add_theme_color_override("font_color", Color(1, 1, 1, 0.6))
	status.add_theme_font_size_override("font_size", int(11 * s))
	status.clip_text = true
	mid.add_child(status)
	# -- the one picked
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.custom_minimum_size = Vector2(300, 0) * s
	cols.add_child(right)
	head = HBoxContainer.new()
	right.add_child(head)
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(sc)
	form = VBoxContainer.new()
	form.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.add_child(form)
	refresh()


# ---- everything again, from the scene -------------------------------------------------------------------------------------------
func refresh() -> void:
	if table == null or plugin == null:
		return
	wiring.touch()
	_fill_shows()
	refresh_table()


func _signature() -> String:
	var f: Dictionary = wiring.found()
	var parts := PackedStringArray()
	for k in ["flag", "task", "item"]:
		for name in (f[k] as Dictionary):
			var sets := 0
			var n := 0
			for u in (f[k][name] as Array):
				n += 1
				if String(u["role"]) in HSLogicScan.SETS:
					sets += 1
			parts.append("%s:%s:%d:%d" % [k, name, n, sets])
	for n2 in plugin.npcs():
		parts.append((n2 as HSNpc).id())
		for q in HSNpcFlow.quests(n2):
			parts.append((q as HSNpcQuest).label())
	parts.append(str(wiring.notes().hash()))
	return "|".join(parts)


## now and then (the plugin, while the tab is shown): the scene changed under it
func tick() -> void:
	if table == null:
		return
	wiring.touch()
	if _signature() != _sig:
		var f := get_viewport().gui_get_focus_owner()
		if f == null or not form.is_ancestor_of(f):
			refresh()


## something was done to the scene through undo: read again at the tab's next look
func changed(_own: bool) -> void:
	wiring.touch()
	_sig = "?"


func _fill_shows() -> void:
	_busy = true
	shows.clear()
	var root := shows.create_item()
	var add := func(parent: TreeItem, text: String, meta: String, icon: String, col := Color("#C8D2DC")) -> TreeItem:
		var it := shows.create_item(parent)
		it.set_text(0, text)
		it.set_metadata(0, meta)
		it.set_icon(0, Glyphs.icon(icon, col, 14))
		if meta == filter:
			it.select(0)
		return it
	add.call(root, "Everything", "all", "flag")
	add.call(root, "The game's", "game", "solo")
	for n in plugin.npcs():
		var npc := n as HSNpc
		var it: TreeItem = add.call(root, npc.display_name(), "npc:" + npc.id(), "person", npc.color)
		for q in HSNpcFlow.quests(npc):
			add.call(it, (q as HSNpcQuest).label(), "quest:%s/%s" % [npc.id(), (q as HSNpcQuest).label()], "markers", npc.color)
	add.call(root, "Things", "things", "logic")
	var probs: Array = wiring.problems()
	var bad := 0
	for p in probs:
		if p["level"] != "tip":
			bad += 1
	add.call(root, "Problems (%d)" % bad if bad > 0 else ("Tips (%d)" % probs.size() if not probs.is_empty() else "No problems"), "problems", "warn",
		Color("#E0A030") if bad > 0 else Color("#8FA3B8"))
	if shows.get_selected() == null:
		filter = "all"
		root.get_first_child().select(0)
	_busy = false


# does a name pass what's shown?
func _passes(kind: String, name: String, uses: Array) -> bool:
	if not bool(kinds[kind]):
		return false
	var q := search.text.strip_edges().to_lower()
	if q != "" and not name.to_lower().contains(q) and not String((wiring.notes().get(name, {}) as Dictionary).get("note", "")).to_lower().contains(q):
		return false
	match filter.get_slice(":", 0):
		"all":
			return true
		"game":
			return kind != "flag" or (wiring.home(name) == "" and not HSLogicScan.kit_flag(name))
		"problems":
			return _probs.has(kind + ":" + name)
		"things":
			for u in uses:
				if HSNpcFlow.npc_of(u["node"]) == null:
					return true
			return false
		"npc", "quest":
			var home := filter.substr(filter.find(":") + 1)
			for u in uses:
				if HSLogicScan._inside(u["node"], home):
					return true
			return kind == "flag" and wiring.home(name) == home
	return true


func _first(uses: Array, sets: bool) -> String:
	var n := 0
	var first := ""
	for u in uses:
		if (String(u["role"]) in HSLogicScan.SETS) == sets:
			n += 1
			if first == "":
				first = HSLogicScan.place(u["node"])
	if n == 0:
		return ""
	return first if n == 1 else "%s  +%d" % [first, n - 1]


func refresh_table() -> void:
	if table == null:
		return
	_busy = true
	_sig = _signature()
	_probs = {}
	for p in wiring.problems():
		var key := "%s:%s" % [p["kind"], p["name"]]
		if not _probs.has(key) or p["level"] != "tip":
			_probs[key] = p
	table.clear()
	var root := table.create_item()
	var found: Dictionary = wiring.found()
	var shown := 0
	var has_story: bool = wiring.story() != null
	for kind in ["flag", "task", "item"]:
		for name in wiring.names(kind):
			var uses: Array = (found[kind] as Dictionary).get(name, [])
			if not _passes(kind, name, uses):
				continue
			shown += 1
			var it := table.create_item(root)
			it.set_metadata(0, [kind, name])
			it.set_text(0, name)
			it.set_icon(0, Glyphs.icon(KINDS[kind][0], KINDS[kind][2], 14))
			var note := String((wiring.notes().get(name, {}) as Dictionary).get("note", "")) if kind == "flag" else ""
			it.set_tooltip_text(0, note if note != "" else name)
			var prob = _probs.get(kind + ":" + name)
			if prob != null:
				it.set_icon(0, Glyphs.icon("warn", Color("#E0A030") if prob["level"] != "tip" else Color("#6CB4F5"), 14))
				it.set_tooltip_text(0, String(prob["text"]))
			if kind == "flag":
				it.set_text(1, "by itself" if HSLogicScan.kit_flag(name) else wiring.home_says(wiring.home(name)))
				it.set_cell_mode(2, TreeItem.CELL_MODE_CHECK)
				it.set_checked(2, wiring.starts_on(name))
				it.set_editable(2, has_story and not HSLogicScan.kit_flag(name))
				it.set_tooltip_text(2, "On when the game starts (the Story's Flags Start)." if has_story else "No Story in this scene to start it on (the Things tab's Set up the scene adds one).")
			else:
				it.set_text(1, "the to-do list" if kind == "task" else "the pocket")
			var on_by := _first(uses, true)
			var by := _first(uses, false)
			it.set_text(3, on_by if on_by != "" else ("nothing yet" if kind != "item" else "—"))
			it.set_text(4, by if by != "" else "nothing yet")
			for col in [3, 4]:
				if it.get_text(col) in ["nothing yet", "—"]:
					it.set_custom_color(col, Color(1, 1, 1, 0.38))
			it.set_custom_color(1, Color(1, 1, 1, 0.6))
			if picked == [kind, name]:
				it.select(0)
	if table.get_selected() == null and not picked.is_empty():
		if wiring.names(String(picked[0])).has(String(picked[1])):
			pass                                               # (picked, but filtered out of the list: its form stays)
		else:
			picked = []
			plugin.cur_name = []
	say("%d shown.  A flag is on or off; anything's condition can ask for it, anything's Then can switch it." % shown if shown > 0 else
		"Nothing here yet. A flag appears as soon as something names it: a marker's Starts when, a thing's Logic, + Flag.")
	_busy = false
	refresh_form()


func _on_row() -> void:
	var it := table.get_selected()
	if it == null or _busy:
		return
	var m: Array = it.get_metadata(0)
	if m != picked:
		picked = m
		plugin.cur_name = picked
		plugin.update_overlays()
		refresh_form()


func _on_edited() -> void:
	var it := table.get_edited()
	if it == null or _busy or table.get_edited_column() != 2:
		return
	var m: Array = it.get_metadata(0)
	wiring.set_start(String(m[1]), it.is_checked(2))


## a name picked (from anywhere): its row, its form
func pick(kind: String, name: String) -> void:
	picked = [kind, name]
	plugin.cur_name = picked
	if not bool(kinds[kind]):
		(kind_btns[kind] as Button).button_pressed = true
	wiring.touch()
	refresh_table()
	var it := table.get_selected()
	if it != null:
		table.scroll_to_item(it)
	plugin.update_overlays()


# ---- the one picked -------------------------------------------------------------------------------------------------------------
func refresh_form() -> void:
	if form == null:
		return
	var was := _busy
	_busy = true
	_clear(form)
	_clear(head)
	var t := _bold(Label.new())
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.clip_text = true
	head.add_child(t)
	if picked.is_empty():
		t.text = "Flags"
		_note(form, "Every flag, task and thing carried this scene names, with who turns each on and who needs it. Pick one to see both ends, rename it everywhere, or use it on the thing selected in the scene.")
		if not wiring.player_asks():
			_note(form, "This project's starter/player.gd is from before the Logic node: a thing's 'works only when' won't hold until it's replaced (python tools/godot_byhand.py install <this project> --starter).")
		_busy = was
		return
	var kind := String(picked[0])
	var name := String(picked[1])
	var uses: Array = wiring.uses(kind, name)
	var kit := kind == "flag" and HSLogicScan.kit_flag(name)
	t.text = "%s  ·  %s" % [name, {"flag": "a flag", "task": "a task", "item": "a thing carried"}[kind]]
	if not kit:
		var del := _button("", "trash", "Take it out of everything that names it." if not uses.is_empty() else "Forget it.")
		del.name = "Delete"
		del.pressed.connect(func() -> void: remove(kind, name))
		head.add_child(del)
	var prob = _probs.get(kind + ":" + name)
	if prob != null:
		var pl := _note(form, String(prob["text"]))
		pl.add_theme_color_override("font_color", Color("#E0A030") if prob["level"] != "tip" else Color("#6CB4F5"))
	var box := _sec("What it is")
	if kit:
		_note(box, "Set by itself: by a character with markers (talked:, shot:, down:) or by the kit (a hunt, the sanity meter). Anything can ask for it.")
	else:
		var le := LineEdit.new()
		le.name = "F_name"
		le.text = name
		le.tooltip_text = "Type over it and press Enter: it's renamed in everything that names it."
		le.text_submitted.connect(func(nt: String) -> void: rename(kind, name, nt))
		_row(box, "Name", le)
	if kind == "flag" and not kit:
		var nl := LineEdit.new()
		nl.name = "F_note"
		nl.text = String((wiring.notes().get(name, {}) as Dictionary).get("note", ""))
		nl.placeholder_text = "what it means"
		var save := func() -> void:
			if nl.text != String((wiring.notes().get(name, {}) as Dictionary).get("note", "")):
				wiring.set_note(name, "note", nl.text)
		nl.text_submitted.connect(func(_x: String) -> void: save.call())
		nl.focus_exited.connect(save)
		_row(box, "Note", nl)
		var ob := OptionButton.new()
		ob.name = "F_home"
		ob.fit_to_longest_item = false
		ob.clip_text = true
		var pinned := String((wiring.notes().get(name, {}) as Dictionary).get("home", ""))
		var homes := [["", "worked out: %s" % wiring.home_says(HSLogicScan.home_of(uses))], ["game", "the game (anything may use it)"]]
		for n in plugin.npcs():
			var npc := n as HSNpc
			homes.append([npc.id(), "only %s" % npc.display_name()])
			for q in HSNpcFlow.quests(npc):
				homes.append(["%s/%s" % [npc.id(), (q as HSNpcQuest).label()], "only %s › %s" % [npc.display_name(), (q as HSNpcQuest).label()]])
		for i in homes.size():
			ob.add_item(String(homes[i][1]))
			ob.set_item_metadata(i, homes[i][0])
			if String(homes[i][0]) == pinned:
				ob.select(i)
		ob.item_selected.connect(func(i: int) -> void: wiring.set_note(name, "home", String(ob.get_item_metadata(i))))
		_row(box, "Belongs to", ob, "Worked out from who uses it. Pinned to a character or a quest, using it anywhere else is a Problem.")
		var cb := CheckBox.new()
		cb.name = "F_start"
		cb.text = "On when the game starts"
		cb.button_pressed = wiring.starts_on(name)
		cb.disabled = wiring.story() == null
		cb.tooltip_text = "The Story's Flags Start." if not cb.disabled else "No Story in this scene (the Things tab's Set up the scene adds one)."
		cb.toggled.connect(func(on: bool) -> void: wiring.set_start(name, on))
		box.add_child(cb)
	var sets := _sec({"flag": "Switched by", "task": "Listed and ticked by", "item": "Given by"}[kind])
	var asks := _sec("Needed by")
	var ns := 0
	var na := 0
	for u in uses:
		var is_set: bool = String(u["role"]) in HSLogicScan.SETS
		var b := _button("%s   ·   %s%s" % [HSLogicScan.place(u["node"]), (String(HSLogicScan.SAYS.get(u["prop"], "")).to_lower() + ": ") if String(u["prop"]) != "" else "",
			HSLogicScan.role_says(String(u["role"]), kind)], "target", "Go there.")
		b.name = "Use%d" % (ns + na)
		b.flat = true
		b.clip_text = true
		b.pressed.connect(func() -> void: plugin.go_to(u["node"]))
		(sets if is_set else asks).add_child(b)
		if is_set:
			ns += 1
		else:
			na += 1
	if ns == 0:
		_note(sets, "Nothing yet." if not kit else "The kit, by itself.")
	if na == 0:
		_note(asks, "Nothing yet.")
	if kind == "flag":
		var use := _sec("Use it")
		var sel: Node = plugin.selected()
		var on_what := "On %s" % sel.name if sel != null else "Select a thing or a marker in the scene, or:"
		_note(use, on_what)
		var row := HFlowContainer.new()
		row.name = "UseRow"
		use.add_child(row)
		for a in [["needs", "needs it on", "It only works (a marker: only starts) while this flag is on."], ["needs_not", "needs it off", "Only while this flag is off."],
				["on", "turns it on", "When it's used (a door: opened; an area: walked into; a marker: done)."], ["off", "turns it off", "The same, off."]]:
			if kit and String(a[0]) in ["on", "off"]:
				continue
			var b2 := _button(String(a[1]), "", String(a[2]))
			b2.name = "Use_" + String(a[0])
			b2.disabled = sel == null
			b2.pressed.connect(func() -> void: use_on(plugin.selected(), name, String(a[0])))
			row.add_child(b2)
		var row2 := HFlowContainer.new()
		use.add_child(row2)
		for a2 in [["needs", "Click a thing that needs it…"], ["on", "Click a thing that turns it on…"]]:
			if kit and String(a2[0]) == "on":
				continue
			var b3 := _button(String(a2[1]), "target", "Then click it in the 3D view.")
			b3.name = "Click_" + String(a2[0])
			b3.pressed.connect(func() -> void:
				plugin.pick_in_view("the thing", func(node: Node, _at: Vector3) -> void: use_on(node, name, String(a2[0]))))
			row2.add_child(b3)
	_form_sig = "%s:%s:%d" % [kind, name, uses.size()]
	_busy = was


# ---- what the form's buttons do (the check calls these too) ---------------------------------------------------------------------
## a name changed everywhere
func rename(kind: String, old: String, new: String) -> void:
	if new.strip_edges() == "" or new.strip_edges() == old:
		refresh_form()
		return
	if kind == "flag" and wiring.names("flag").has(HSNpcCond.slug(new)):
		say("There's a flag '%s' already: its uses would be mixed with this one's. Pick another name." % HSNpcCond.slug(new))
		refresh_form()
		return
	var r: Dictionary = wiring.rename(kind, old, new)
	picked = [kind, String(r["name"])]
	plugin.cur_name = picked
	refresh()
	say("'%s' is now '%s' in %d place%s%s." % [old, r["name"], r["changed"], "" if int(r["changed"]) == 1 else "s",
		("  (%d inside another scene couldn't be changed from here.)" % (r["skipped"] as Array).size()) if not (r["skipped"] as Array).is_empty() else ""])


## a name taken out of everything
func remove(kind: String, name: String) -> void:
	var r: Dictionary = wiring.rename(kind, name, "")
	picked = []
	plugin.cur_name = []
	refresh()
	plugin.update_overlays()
	say("'%s' was taken out of %d place%s." % [name, r["changed"], "" if int(r["changed"]) == 1 else "s"])


## a flag used on a node: it needs it (on, or off), or it turns it on or off
func use_on(node: Node, flag: String, how: String) -> void:
	if not plugin.valid(node):
		say("Select a thing or a marker in the scene first.")
		return
	var who: Node = null
	match how:
		"needs":
			who = wiring.ask(node, flag)
		"needs_not":
			who = wiring.ask(node, "!" + flag)
		"on":
			who = wiring.switch(node, "+" + flag)
		"off":
			who = wiring.switch(node, "-" + flag)
	refresh()
	plugin.update_overlays()
	if who != null:
		say("%s now %s '%s'." % [HSLogicScan.place(node), {"needs": "needs", "needs_not": "needs the absence of", "on": "turns on", "off": "turns off"}[how], flag])
