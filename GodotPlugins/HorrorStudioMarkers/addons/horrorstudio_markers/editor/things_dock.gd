@tool
## The Things tab (docs/FLAGS.md §5): along the bottom of the editor, beside NPC Markers and Flags. Three parts.
##   Make it a…   cards for what the kit can make of the node selected in the scene (Logic, Pickup, Note, Food, Show /
##                hide, Quest marker) and things put where you click in the 3D view (Area, Scare, Checkpoint), a Rule
##                that happens by itself; Set up the scene (the player, the Story, the HUD, Sound)
##   the things   every node of the scene that asks or switches something, or can be used: what it is, what it works
##                only when, what it does then
##   the thing    its Logic as a form in plain words (works only when, when, then), and its own fields with the
##                picker of each kind
## It follows the scene's selection: select anything and its form is here.
extends "res://addons/horrorstudio_markers/editor/panel.gd"

const WHENS := [["used", "it's used (E)"], ["signal", "one of its signals…"], ["itself", "by itself, once its needs are so"]]

var list: Tree
var head: HBoxContainer
var cards := {}
var setup_btn: Button
var problems_btn: Button
var thing: Node                            ## the thing whose form is shown
var _sig := ""
var _form_sig := ""
var _pop: PopupPanel


func _init() -> void:
	title = "Things"
	layout_key = "horrorstudio_things"
	default_slot = EditorDock.DOCK_SLOT_BOTTOM
	available_layouts = EditorDock.DOCK_LAYOUT_HORIZONTAL | EditorDock.DOCK_LAYOUT_FLOATING
	dock_icon = Glyphs.icon("logic", Color("#FFB74D"), 16)


func _ready() -> void:
	var s := Glyphs.scale()
	var cols := _bg()
	# -- the cards
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(250, 0) * s
	cols.add_child(left)
	left.add_child(_head("MAKE IT A…"))
	var sc0 := ScrollContainer.new()
	sc0.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc0.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	left.add_child(sc0)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc0.add_child(grid)
	for c in wiring.CARDS:
		var b := _button(String(c["title"]), String(c["icon"]), String(c["tip"]))
		b.name = "Card_" + String(c["id"])
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.toggle_mode = String(c["how"]) == "place"
		b.pressed.connect(_card.bind(c))
		grid.add_child(b)
		cards[c["id"]] = b
	setup_btn = _button("Set up the scene", "play", "Adds what a game needs and this scene lacks: the player, the Story (objective, to-do list, flags), the HUD, the Sound node.")
	setup_btn.name = "Setup"
	setup_btn.pressed.connect(func() -> void:
		var did: PackedStringArray = wiring.setup_scene()
		refresh()
		say(("Added: %s." % ", ".join(did)) if not did.is_empty() else "This scene has the player, the Story, the HUD and Sound already."))
	left.add_child(setup_btn)
	problems_btn = _button("No problems", "warn", "What can't work as it is. Click to see; each takes you there.")
	problems_btn.name = "Problems"
	problems_btn.pressed.connect(_show_problems)
	left.add_child(problems_btn)
	# -- the scene's things
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.size_flags_stretch_ratio = 1.4
	cols.add_child(mid)
	list = Tree.new()
	list.name = "List"
	list.columns = 4
	list.hide_root = true
	list.column_titles_visible = true
	list.select_mode = Tree.SELECT_ROW
	list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	for i in 4:
		list.set_column_title(i, ["Thing", "What", "Works only when", "Then"][i])
		list.set_column_title_alignment(i, HORIZONTAL_ALIGNMENT_LEFT)
		list.set_column_clip_content(i, true)
	list.set_column_expand(0, true)
	list.set_column_custom_minimum_width(0, int(130 * s))
	list.set_column_expand(1, false)
	list.set_column_custom_minimum_width(1, int(96 * s))
	list.set_column_expand(2, true)
	list.set_column_expand_ratio(2, 2)
	list.set_column_expand(3, true)
	list.set_column_expand_ratio(3, 2)
	list.item_selected.connect(_on_row)
	mid.add_child(list)
	status = Label.new()
	status.name = "Status"
	status.add_theme_color_override("font_color", Color(1, 1, 1, 0.6))
	status.add_theme_font_size_override("font_size", int(11 * s))
	status.clip_text = true
	mid.add_child(status)
	# -- the thing picked
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.custom_minimum_size = Vector2(320, 0) * s
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
	if list == null or plugin == null:
		return
	wiring.touch()
	if not plugin.valid(thing):
		thing = null
	refresh_list()
	refresh_form()
	_count_problems()


func _signature() -> String:
	var parts := PackedStringArray()
	for t in wiring.things():
		parts.append("%d:%s:%s:%s" % [(t as Node).get_instance_id(), (t as Node).name, _when_says(t), _then_says(t)])
	return "|".join(parts)


func tick() -> void:
	if list == null:
		return
	wiring.touch()
	var f := get_viewport().gui_get_focus_owner()
	var typing: bool = f != null and form.is_ancestor_of(f)
	if _signature() != _sig and not typing:
		refresh_list()
	if not typing and _shape(thing) != _form_sig:
		refresh_form()
	_count_problems()
	for id in cards:
		if (cards[id] as Button).toggle_mode:
			(cards[id] as Button).set_pressed_no_signal(plugin.armed.get("id") == id)


func changed(own: bool) -> void:
	wiring.touch()
	if own and plugin.valid(thing):
		refresh_list()
		return
	_sig = "?"
	_form_sig = "?"


func _changed(_n: Object, prop: String) -> void:
	refresh_list()
	if prop in ["on"]:
		refresh_form.call_deferred()


# every condition a thing has, in plain words: its Logic's needs, its own Needs, its lock
func _when_says(t: Node) -> String:
	var parts := PackedStringArray()
	for l in wiring.logics(t):
		if (l as HSLogic).needs.strip_edges() != "":
			parts.append(HSNpcCond.says((l as HSLogic).needs))
	if not (t is HSLogic):
		for f in HSLogicScan.fields_of(t):
			var v = t.get(f[0])
			match String(f[1]):
				"cond":
					if String(v).strip_edges() != "":
						parts.append(HSNpcCond.says(String(v)))
				"lock":
					if String(v).strip_edges() != "":
						parts.append(("flag %s" % String(v).substr(5)) if String(v).begins_with("flag:") else "carrying %s" % v)
	return ", ".join(parts)


# what a thing switches, ticks and gives, in a few words
func _then_says(t: Node) -> String:
	var parts := PackedStringArray()
	for u in HSLogicScan.uses_of(t):
		if String(u["role"]) in HSLogicScan.SETS:
			parts.append({"on": "+", "off": "−", "flip": "~", "start": "starts ", "ticks": "ticks ", "adds": "adds ", "gives": "gives "}[String(u["role"])] + String(u["name"]))
	for l in wiring.logics(t):
		if l == t:
			continue
		for u2 in HSLogicScan.uses_of(l):
			if String(u2["role"]) in HSLogicScan.SETS:
				parts.append({"on": "+", "off": "−", "flip": "~", "ticks": "ticks ", "adds": "adds "}.get(String(u2["role"]), "") + String(u2["name"]))
	return ", ".join(parts)


func refresh_list() -> void:
	if list == null:
		return
	var was := _busy
	_busy = true
	_sig = _signature()
	list.clear()
	var root := list.create_item()
	var n := 0
	for t in wiring.things():
		var node := t as Node
		n += 1
		var it := list.create_item(root)
		it.set_metadata(0, node)
		it.set_text(0, String(node.name))
		var rule: bool = wiring.is_rule(node)
		it.set_icon(0, Glyphs.icon("event" if rule else ("logic" if not wiring.logics(node).is_empty() else "target"), Color("#FFB74D") if not wiring.logics(node).is_empty() else Color("#8FA3B8"), 14))
		it.set_text(1, "rule" if rule else HSLogicScan.what(node))
		it.set_text(2, _when_says(node))
		it.set_text(3, _then_says(node))
		it.set_custom_color(1, Color(1, 1, 1, 0.6))
		if it.get_text(2) == "":
			it.set_text(2, "always")
			it.set_custom_color(2, Color(1, 1, 1, 0.38))
		if node == thing:
			it.select(0)
	if n == 0:
		say("No things yet. Select a model in the scene and click a card (Pickup, Note, Logic…), or place an Area.")
	elif status.text.begins_with("No things yet"):
		say("")
	_busy = was


func _on_row() -> void:
	var it := list.get_selected()
	if it == null or _busy:
		return
	var node := it.get_metadata(0) as Node
	if plugin.valid(node):
		plugin.go_to(node, false)


## the scene's selection changed: this thing's form (anything can be given Logic)
func show_thing(node: Node) -> void:
	var t := node
	if node is HSLogic and not wiring.is_rule(node):
		t = (node as HSLogic).thing_node()
	if t == thing:
		return
	thing = t
	if list == null:
		return
	_busy = true
	list.deselect_all()
	var it := list.get_root().get_first_child() if list.get_root() != null else null
	while it != null:
		if it.get_metadata(0) == thing:
			it.select(0)
			list.scroll_to_item(it)
		it = it.get_next()
	_busy = false
	refresh_form()


func _count_problems() -> void:
	var probs: Array = wiring.problems()
	var bad := 0
	for p in probs:
		if p["level"] != "tip":
			bad += 1
	if not wiring.player_asks():
		bad += 1
	problems_btn.text = "No problems" if probs.is_empty() and bad == 0 else ("%d problem%s" % [bad, "" if bad == 1 else "s"] if bad > 0 else "%d tip%s" % [probs.size(), "" if probs.size() == 1 else "s"])
	problems_btn.icon = Glyphs.icon("warn", Color("#E0A030") if bad > 0 else (Color("#8FA3B8") if probs.is_empty() else Color("#6CB4F5")), 15)


func _show_problems() -> void:
	var probs: Array = wiring.problems()
	if _pop != null:
		_pop.queue_free()
	_pop = PopupPanel.new()
	add_child(_pop)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(560, 0) * Glyphs.scale()
	_pop.add_child(box)
	if not wiring.player_asks():
		var l0 := Label.new()
		l0.text = "This project's starter/player.gd is from before the Logic node: 'works only when' on things won't hold.\nReplace it: python tools/godot_byhand.py install <this project> --starter"
		l0.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		box.add_child(l0)
	if probs.is_empty() and wiring.player_asks():
		var l := Label.new()
		l.text = "Nothing that can't work."
		box.add_child(l)
	for p in probs:
		var b := Button.new()
		b.text = String(p["text"])
		b.icon = Glyphs.icon("warn", {"warn": Color("#E0A030")}.get(p["level"], Color("#6CB4F5")), 14)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.flat = true
		b.pressed.connect(func() -> void:
			_pop.hide()
			plugin.show_name(String(p["kind"]), String(p["name"])))
		box.add_child(b)
	_pop.position = Vector2i(problems_btn.get_screen_position() - Vector2(0, minf(420.0, 34.0 * maxi(probs.size(), 1) + 30.0) * Glyphs.scale()))
	_pop.popup()


# ---- the cards ------------------------------------------------------------------------------------------------------------------
func _card(c: Dictionary) -> void:
	if String(c["how"]) == "place":
		if plugin.armed.get("id") == c["id"]:
			plugin.arm({})
		else:
			plugin.arm(c)
		return
	var sel: Node = plugin.selected()
	if sel is HSLogic and not wiring.is_rule(sel):               # (a thing's Logic selected: the card is for the thing)
		sel = (sel as HSLogic).thing_node()
	var made: Node = wiring.make(c, sel)
	if made != null:
		made_thing(made, c)


## a card's thing made: shown, and selected in the scene (a thing's Logic or its Show / hide: the thing stays selected)
func made_thing(made: Node, c: Dictionary) -> void:
	var show := made
	if String(c["how"]) in ["child", "child3d"] or (made is HSLogic and not wiring.is_rule(made)):
		show = made.get_parent()
	refresh()
	plugin.go_to(show, false)
	say("%s: %s" % [show.name, String(c["tip"])])


# ---- the thing's form -----------------------------------------------------------------------------------------------------------
# what decides which rows the form has
func _shape(t: Node) -> String:
	if not plugin.valid(t):
		return ""
	var parts := PackedStringArray([str(t.get_instance_id())])
	for l in wiring.logics(t):
		var lg := l as HSLogic
		parts.append("%d:%s:%s:%d" % [lg.get_instance_id(), lg.on, lg.on_signal, lg.fires.size()])
	for f in HSLogicScan.fields_of(t):
		parts.append(String(f[0]))
	return "|".join(parts)


func refresh_form() -> void:
	if form == null:
		return
	var was := _busy
	_busy = true
	_clear(form)
	_clear(head)
	_form_sig = _shape(thing)
	var t := _bold(Label.new())
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.clip_text = true
	head.add_child(t)
	if not plugin.valid(thing):
		t.text = "Things"
		_note(form, "Select anything in the scene: a door, a key, a lamp, an area. Its conditions are here as chips, with the scene's flags to pick from. A card on the left makes it something (a Pickup, a Note…); Logic makes it work only when its flags are so, and switch flags when it's used.")
		_busy = was
		return
	var rule: bool = wiring.is_rule(thing)
	t.text = "%s  ·  %s" % [thing.name, "a rule" if rule else HSLogicScan.what(thing)]
	var logics: Array = wiring.logics(thing)
	if thing is HSNpcMarker or thing is HSNpcQuest or thing is HSNpcWay or thing is HSNpc or thing is HSNpcBend:
		_note(form, "One of a character's markers: the NPC Markers tab is where it's filled in.")
		_busy = was
		return
	for i in logics.size():
		_form_logic(logics[i], i, logics.size(), rule)
	if logics.is_empty():
		var add := _button("Logic: works only when…, when it's used…", "plus", "Give %s a Logic: it can ask for flags and switch them." % thing.name)
		add.name = "AddLogic"
		add.pressed.connect(func() -> void:
			wiring.logic_for(thing)
			refresh())
		form.add_child(add)
	if not (thing is HSLogic):
		var fields := HSLogicScan.fields_of(thing)
		if not fields.is_empty():
			var box := _sec("Its own (%s)" % HSLogicScan.what(thing))
			for f in fields:
				var c := field(thing, String(f[0]), String(f[1]))
				_row(box, String(HSLogicScan.SAYS.get(f[0], f[0])), c, _field_tip(String(f[0]), String(f[1])))
	_busy = was


func _field_tip(prop: String, enc: String) -> String:
	match enc:
		"cond":
			return "The script's own '%s': flags, tasks and things carried that must be so." % prop
		"lock":
			return "What opens it: something carried by its name, or a flag (flag:<name>). 'flag:never': never."
		"switch", "switches":
			return "Flags it switches: + on, − off, ~ flipped."
		"flag":
			return "A flag it turns on."
		"task":
			return "A task of the to-do list it ticks."
		"tasks":
			return "Tasks it puts on the to-do list: 'id: what to do'; several apart by ';'."
		"item":
			return "What it's called in the pocket (a door locked by this name opens for it)."
	return ""


func _form_logic(lg: HSLogic, i: int, count: int, rule: bool) -> void:
	var title := "Logic" if count == 1 else "Logic %d" % (i + 1)
	var only := _sec(("Happens once" if rule else "Works only when") if count == 1 else "%s: %s" % [title, "happens once" if rule else "works only when"])
	only.name = "Only%d" % i
	var links := [["A character's marker… (click its pin)", func(ce: Control) -> void:
		plugin.pick_pin(func(m: Node) -> void:
			var flag: String = wiring.link_marker(m)
			if flag != "":
				ce.add_word(flag)
				say("%s is done: '%s' on. %s asks for it." % [HSLogicScan.place(m), flag, thing.name]))]]
	var ce0 := _cond(lg, "needs", "always" if not rule else "(add what must be so)", links)
	_row(only, "These are so" if rule else "Only when", ce0, "Flags, tasks and things carried that must be so. Empty: always.")
	if not rule:
		_row(only, "Else says", _text(lg, "locked_says", "a line when it's tried and they aren't so"))
	var when := _sec("When")
	when.name = "When%d" % i
	if not rule:
		var t := lg.thing_node()
		_row(when, "When", _pick(lg, "on", WHENS), "What sets off its Then.")
		if lg.on == "signal":
			var sigs := []
			for sname in wiring.signals_of(t):
				sigs.append([sname, sname.replace("_", " ")])
			if sigs.is_empty():
				sigs.append(["", "(it has no signals)"])
			_row(when, "Signal", _pick(lg, "on_signal", sigs), "One of %s's own signals: a door's 'opened', a pickup's 'picked', an area's 'body entered' (only you count)." % (t.name if t != null else "its"))
	when.add_child(_check(lg, "once", "Only the first time", "Off: every time."))
	var then := _sec("Then")
	then.name = "Then%d" % i
	_row(then, "Flags", _switches(lg, "set_flags"), "Switched: + on, − off, ~ flipped.")
	var tasks := [["", "(none)"]]
	for id in wiring.names("task"):
		tasks.append([id, id])
	_row(then, "Ticks", _pick(lg, "tick", tasks), "A task of the to-do list ticked.")
	_row(then, "Adds tasks", _lines(lg, "add_tasks", "id: what to do"), "Tasks put on the to-do list: 'id: what to do'; several apart by ';'.")
	_row(then, "Says", _text(lg, "say", "a line"))
	_row(then, "Sound", _text(lg, "sound", "a shelf sound's name"))
	var fr := VBoxContainer.new()
	for k in lg.fires.size():
		var row := HBoxContainer.new()
		var tn := lg.get_node_or_null(lg.fires[k])
		var l := Label.new()
		l.text = String(tn.name) if tn != null else "(gone)"
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(l)
		var x := _button("", "trash", "")
		x.pressed.connect(func() -> void:
			var paths: Array[NodePath] = lg.fires.duplicate()
			paths.remove_at(k)
			_put(lg, "fires", paths)
			refresh_form.call_deferred())
		row.add_child(x)
		fr.add_child(row)
	var af := _button("Something to fire (click it)", "target", "Click it in the 3D view: a scare area, a cue, another Logic, a door (its fire(), start() or use()).")
	af.name = "AddFire%d" % i
	af.pressed.connect(func() -> void:
		plugin.pick_in_view("what it fires", func(node: Node, _at: Vector3) -> void: add_fire(lg, node)))
	fr.add_child(af)
	_row(then, "Fires", fr)
	var del := _button("Remove this Logic" if not rule else "Delete this rule", "trash", "")
	del.name = "DelLogic%d" % i
	del.pressed.connect(func() -> void:
		if lg == thing:
			thing = null
		plugin.delete_node(lg, "remove a Logic")
		refresh())
	form.add_child(del)


## something a Logic fires (what the form's button does; the check calls it too)
func add_fire(lg: HSLogic, node: Node) -> void:
	if not plugin.valid(lg) or not plugin.valid(node):
		return
	var t := node
	var p := node
	while p != null and p != plugin.scene_root():                 # (what was clicked, up to something that can be fired)
		if p.has_method("fire") or p.has_method("start") or p.has_method("use"):
			t = p
			break
		p = p.get_parent()
	for c in t.get_children():                                    # (a thing whose Logic can be fired: its Logic)
		if c is HSLogic and not (t.has_method("fire") or t.has_method("start")):
			t = c
			break
	var paths: Array[NodePath] = lg.fires.duplicate()
	paths.append(lg.get_path_to(t))
	_put(lg, "fires", paths)
	refresh_form.call_deferred()
