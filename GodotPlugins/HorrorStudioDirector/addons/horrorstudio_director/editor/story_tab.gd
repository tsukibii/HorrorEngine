@tool
extends HBoxContainer
## The panel's Story tab (docs/GODOT_DIRECTOR.md §6e, the design's Story board): the Director file
## (director/director.json) without JSON. On the left its quests in play order, each with its steps (ticked and crossed
## out as the running game does them) and the endings; in the middle what happens in the quest being edited, each a
## sentence: its steps (WHEN it's done, tick “the step”) and its moments (WHEN, ONLY IF, THEN, how often), one opened
## at a time with a picker for each blue word, what it reads as, Try this moment and Show it in the 3D view; on the
## right the ready-made moments (the Scares cards), clicked onto the selected area or door or dragged onto one in the 3D
## view. The words are the Director Manager's (story/commands.gd: the desk's commands.js and the Manager's words.js).
## Every change is written to the file at once and is on the editor's undo (Ctrl+Z).

const Glyphs := preload("res://addons/horrorstudio_director/editor/glyphs.gd")
const BuildTab := preload("res://addons/horrorstudio_director/editor/build_tab.gd")
const RUN_FILE := "user://hs_director_run.json"
const ROOT := "res://addons/horrorstudio_director/"
const KINDS_ENDING := ["good", "bad", "neutral", "secret", "death"]
const C_TEXT := Color("#E8EBF0")
const C_MUTED := Color("#A3ACB9")
const C_FAINT := Color("#8A93A1")
const C_BLUE := Color("#6CB4F5")
const C_BLUE_TEXT := Color("#CFE5FB")
const C_BLUE_BG := Color("#22303F")
const C_BLUE_LINE := Color("#34506E")
const C_CARD := Color("#262B33")
const C_LINE := Color("#353C47")
const C_SIDE := Color("#1A1E23")
const C_DONE := Color("#7FD1A0")
const C_WHEN := Color("#F3C27A")
const C_IF := Color("#B79BE8")
const C_THEN := Color("#6CB4F5")

var panel = null                  # the panel (editor/panel.gd): the dock's helpers, say(), the plugin
var f: Dictionary = {}            # the Director file as read
var quest := ""                   # the quest being edited
var ending := ""                  # or the ending being edited
var opened := ""                  # the item open in the middle: "m:<moment id>", "s:<step id>"
var left: VBoxContainer
var mid: VBoxContainer
var right: VBoxContainer
var mid_scroll: ScrollContainer
var ready_cards := {}             # ready-made moment id -> its card
var _sig := ""
var _quiet := false               # a change typed in a box: saved and its words shown, the tab not drawn again


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 0)
	var ls := _scroll(260)
	left = _column(ls, C_SIDE)
	add_child(VSeparator.new())
	mid_scroll = _scroll(0)
	mid_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid = _column(mid_scroll, Color(0, 0, 0, 0))
	add_child(VSeparator.new())
	var rs := _scroll(250)
	right = _column(rs, C_SIDE)
	refresh()


func _scroll(w: float) -> ScrollContainer:
	var s := ScrollContainer.new()
	s.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	s.size_flags_vertical = Control.SIZE_EXPAND_FILL
	if w > 0:
		s.custom_minimum_size = Vector2(w, 0) * _s()
	add_child(s)
	return s


func _column(s: ScrollContainer, bg: Color) -> VBoxContainer:
	var p := PanelContainer.new()
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p.size_flags_vertical = Control.SIZE_EXPAND_FILL
	p.add_theme_stylebox_override("panel", BuildTab._box(bg, Color(0, 0, 0, 0), 0, 0, 12))
	s.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", int(8 * _s()))
	p.add_child(v)
	return v


# ---- the file ---------------------------------------------------------------------------------------------------------
func file_path() -> String:
	var g = panel.dock.game() if panel != null and panel.dock != null else null
	return str(g.story_file) if g != null else HSStoryFile.DEFAULT


func _sig_now() -> String:
	var p := file_path()
	var d = panel.dock if panel != null else null
	return "%s|%s|%s|%s|%d" % [p, FileAccess.get_modified_time(p) if FileAccess.file_exists(p) else 0,
		d.running if d != null else false, d.run_step if d != null else "", d.run_flags.size() if d != null else 0]


## the panel's poll: drawn again when the file changes on disk (the Manager saved it) or the running game moves on
func tick() -> void:
	if is_visible_in_tree() and _sig_now() != _sig:
		refresh()


## a change to the file: made by `fn` on `f`, written, and on the editor's undo (its global history: Ctrl+Z). Words
## typed in a box (`redraw` false) are saved without drawing the tab again, so the click that left the box still lands
func change(what: String, fn: Callable, redraw := true) -> void:
	var before := JSON.stringify(f)
	fn.call()
	var after := JSON.stringify(f)
	if before == after:
		return
	var ur = panel.plugin.get_undo_redo() if panel != null and panel.plugin != null else null
	_quiet = not redraw
	if ur == null:
		_put(after)
	else:
		ur.create_action("HorrorStudio: " + what)
		ur.add_do_method(self, "_put", after)
		ur.add_undo_method(self, "_put", before)
		ur.commit_action()
	_quiet = false


func _put(text: String) -> void:
	var j = JSON.parse_string(text)
	if not (j is Dictionary):
		return
	f = j
	HSStoryFile.write(f, file_path())
	_sig = _sig_now()
	if _quiet:
		_words_again()
	else:
		refresh.call_deferred(false)                  # once the menu or the button that did it has let go


## after words typed in a box: the quest list and the open moment's sentence say them
func _words_again() -> void:
	for c in left.get_children():
		left.remove_child(c)
		c.queue_free()
	_draw_left()
	if opened.begins_with("m:"):
		var box := mid.find_child("Moment_" + opened.substr(2), true, false)
		var ra = box.find_child("ReadsAs", true, false) if box != null else null
		if ra is Label:
			ra.text = reads_as(moment_of(opened.substr(2)))


func quest_of(qid: String) -> Dictionary:
	for q in f.get("quests", []):
		if str(q.get("id", "")) == qid:
			return q
	return {}


func moment_of(mid_: String) -> Dictionary:
	for m in f.get("moments", []):
		if str(m.get("id", "")) == mid_:
			return m
	return {}


## the moments that play during a quest: theirs, and the ones with no `during` (the whole game's)
func moments_in(qid: String) -> Array:
	return (f.get("moments", []) as Array).filter(func(m):
		var d = m.get("during", [])
		return not (d is Array) or d.is_empty() or d.has(qid))


func fresh_id(base: String) -> String:
	var taken := {}
	for q in f.get("quests", []):
		taken[str(q.get("id", ""))] = true
		for s in q.get("steps", []):
			taken[str(s.get("id", ""))] = true
	for k in ["moments", "endings", "achievements"]:
		for x in f.get(k, []):
			if x is Dictionary:
				taken[str(x.get("id", ""))] = true
	base = HSDirector.snake(base)
	if base == "":
		base = "x"
	var id := base
	var n := 2
	while taken.has(id):
		id = "%s_%d" % [base, n]
		n += 1
	return id


# ---- drawing ----------------------------------------------------------------------------------------------------------
func refresh(read := true) -> void:
	if left == null:
		return
	if read:
		var r := HSStoryFile.read(file_path())
		f = r
	_sig = _sig_now()
	var keep := mid_scroll.scroll_vertical if mid_scroll != null else 0
	for col in [left, mid, right]:
		for c in col.get_children():
			col.remove_child(c)
			c.queue_free()
	if f.has("_error"):
		mid.add_child(_wrap(_label(str(f["_error"]), 14, C_WHEN)))
		return
	var qs: Array = f.get("quests", [])
	if ending == "" and (quest == "" or quest_of(quest).is_empty()):
		quest = str(qs[0].get("id", "")) if qs.size() else ""
	_draw_left()
	_draw_mid()
	_draw_right()
	if mid_scroll != null:
		mid_scroll.set_deferred("scroll_vertical", keep)


func _draw_left() -> void:
	var d = panel.dock if panel != null else null
	var flags: Dictionary = d.run_flags if d != null else {}
	left.add_child(_label("Quests, in order", 12, C_FAINT, true))
	var qs: Array = f.get("quests", [])
	for i in qs.size():
		var q: Dictionary = qs[i]
		var qid := str(q.get("id", ""))
		var on: bool = qid == quest and ending == ""
		var b := Button.new()
		b.name = "Quest_" + qid
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.clip_text = true
		b.custom_minimum_size = Vector2(0, 36) * _s()
		var mark := "▶ " if (d != null and d.running and d.run_step == qid) else ("✓ " if flags.has("done:" + qid) else "")
		if q.get("desk") is Dictionary:
			b.text = "%s%d · ◆ %s" % [mark, i + 1, qid]
			b.tooltip_text = "A desk game's %s, as the desk had it: in the Director Manager" % str(q["desk"].get("type", "item"))
		else:
			b.text = "%s%d · %s" % [mark, i + 1, str(q.get("title", qid))]
			b.tooltip_text = str(q.get("objective", ""))
		b.add_theme_stylebox_override("normal", BuildTab._box(C_BLUE_BG if on else C_CARD, C_BLUE if on else C_LINE, 8, 1, 8))
		b.add_theme_stylebox_override("hover", BuildTab._box(C_BLUE_BG, C_BLUE_LINE, 8, 1, 8))
		b.pressed.connect(func(): quest = qid; ending = ""; opened = ""; refresh(false))
		left.add_child(b)
		var steps := VBoxContainer.new()
		steps.add_theme_constant_override("separation", int(2 * _s()))
		for s in q.get("steps", []):
			var done := flags.has("step:" + str(s.get("id", "")))
			var words := str(s.get("text", s.get("id", ""))).replace("[", "[lb]")
			var l := RichTextLabel.new()                # a step done: ticked and crossed out, as the game's list has it
			l.bbcode_enabled = true
			l.fit_content = true
			l.scroll_active = false
			l.autowrap_mode = TextServer.AUTOWRAP_OFF
			l.add_theme_font_size_override("normal_font_size", int(12 * _s()))
			l.add_theme_stylebox_override("normal", StyleBoxEmpty.new())
			l.text = ("[color=#%s]✓ [s]%s[/s][/color]" % [C_DONE.to_html(false), words]) if done else ("[color=#%s]· %s[/color]" % [C_MUTED.to_html(false), words])
			steps.add_child(l)
		if on:
			steps.add_child(_label("   Being edited", 11, C_BLUE))
		var sm := MarginContainer.new()
		sm.add_theme_constant_override("margin_left", int(14 * _s()))
		sm.add_child(steps)
		left.add_child(sm)
	var aq := BuildTab._button("+ Add a quest", false)
	aq.name = "AddQuest"
	aq.pressed.connect(add_quest)
	left.add_child(aq)
	left.add_child(_label("Endings", 12, C_FAINT, true))
	for e in f.get("endings", []):
		var eid := str(e.get("id", ""))
		var on: bool = eid == ending
		var b := Button.new()
		b.name = "Ending_" + eid
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.text = "%s%s   · %s" % ["✓ " if flags.has("ending:" + eid) else "", str(e.get("title", eid)), str(e.get("kind", "neutral"))]
		b.custom_minimum_size = Vector2(0, 34) * _s()
		b.add_theme_stylebox_override("normal", BuildTab._box(C_BLUE_BG if on else C_CARD, C_BLUE if on else C_LINE, 8, 1, 8))
		b.add_theme_stylebox_override("hover", BuildTab._box(C_BLUE_BG, C_BLUE_LINE, 8, 1, 8))
		b.pressed.connect(func(): ending = eid; opened = ""; refresh(false))
		left.add_child(b)
	var ae := BuildTab._button("+ Add an ending", false)
	ae.name = "AddEnding"
	ae.pressed.connect(add_ending)
	left.add_child(ae)
	left.add_child(_wrap(_label("Conversations, states, facts and achievements: in the Director Manager.", 12, C_FAINT)))
	var mg := BuildTab._button("Open the Manager", false)
	mg.pressed.connect(func(): panel.say(panel.dock.open_manager()))
	left.add_child(mg)


func _draw_mid() -> void:
	if ending != "":
		_draw_ending()
		return
	var q := quest_of(quest)
	if q.is_empty():
		mid.add_child(_label("No quests yet", 16, C_TEXT, true))
		mid.add_child(_wrap(_label("Add a quest on the left: a goal on the screen and its steps. Until there is one, the game is a free roam, and the moments below play in it.", 13, C_MUTED)))
		_draw_moments("")
		return
	if q.get("desk") is Dictionary:
		mid.add_child(_label("◆ %s" % quest, 16, C_TEXT, true))
		mid.add_child(_wrap(_label("A desk game's %s, kept as the desk had it (tools/godot_director.py from-desk). The Director Manager shows it." % str(q["desk"].get("type", "item")), 13, C_MUTED)))
		return
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", int(10 * _s()))
	head.add_child(_label("Moments in “%s”" % str(q.get("title", quest)), 16, C_TEXT, true))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)
	var i := (f["quests"] as Array).find(q)
	for spec in [["↑", "Earlier in the game", -1], ["↓", "Later in the game", 1]]:
		var mb := Button.new()
		mb.text = spec[0]
		mb.tooltip_text = spec[1]
		mb.flat = true
		mb.disabled = i + int(spec[2]) < 0 or i + int(spec[2]) >= (f["quests"] as Array).size()
		mb.pressed.connect(func(): change("move %s" % quest, func():
			var qs: Array = f["quests"]
			var j := qs.find(quest_of(quest))
			var k: int = j + int(spec[2])
			var t = qs[j]
			qs[j] = qs[k]
			qs[k] = t))
		head.add_child(mb)
	var del := Button.new()
	del.text = "Delete the quest"
	del.flat = true
	del.add_theme_color_override("font_color", Color("#F2A79D"))
	del.pressed.connect(func():
		if del.text != "Click again to delete":
			del.text = "Click again to delete"
			return
		change("delete %s" % quest, func(): (f["quests"] as Array).erase(quest_of(quest)))
		quest = "")
	head.add_child(del)
	mid.add_child(head)
	mid.add_child(_label("What happens, written as a sentence. Pick each blue word.", 12, C_MUTED))
	var g := GridContainer.new()
	g.columns = 4
	g.add_theme_constant_override("h_separation", int(8 * _s()))
	for k in [["title", "The quest"], ["objective", "On the screen"]]:
		g.add_child(_label(k[1], 12, C_FAINT))
		var le := LineEdit.new()
		le.name = "Quest_" + k[0]
		le.text = str(q.get(k[0], ""))
		le.custom_minimum_size = Vector2(200, 34) * _s()
		le.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_on_commit(le, func(t): change("the quest's %s" % k[0], func(): quest_of(quest)[k[0]] = t, false))
		g.add_child(le)
	mid.add_child(g)
	for s in q.get("steps", []):
		var sid := str(s.get("id", ""))
		if opened == "s:" + sid:
			_step_editor(q, s)
		else:
			_line(C_WHEN, "WHEN", _when_words(s.get("done")) + ", tick “%s”" % str(s.get("text", sid)), "once", "s:" + sid)
			var wr = s.get("wrong")
			if wr is Dictionary and str(wr.get("say", "")) != "":
				var g2 = s.get("done", {})
				_line(C_WHEN, "WHEN", "anything else is given to %s, %s says “%s”" % [_name("cast", g2.get("to") if g2 is Dictionary else ""),
					_name("cast", wr.get("who", g2.get("to") if g2 is Dictionary else "")), str(wr["say"])], "every time", "s:" + sid)
	_draw_moments(quest)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", int(8 * _s()))
	var nm := BuildTab._button("+ New moment", false)
	nm.name = "NewMoment"
	nm.pressed.connect(func(): add_moment({}, []))
	row.add_child(nm)
	var ns := BuildTab._button("+ New step", false)
	ns.name = "NewStep"
	ns.pressed.connect(add_step)
	row.add_child(ns)
	mid.add_child(row)


func _draw_moments(qid: String) -> void:
	for m in moments_in(qid):
		var mid_ := str(m.get("id", ""))
		if opened == "m:" + mid_:
			_moment_editor(m)
		else:
			var w = m.get("when")
			var t := _when_words(w)
			if not HSCond.empty(m.get("if")):
				t += ", if " + HSCommands.cond_text(m["if"])
			var acts := _acts_words(m.get("do", []))
			if acts != "":
				t += ": " + acts
			var tag := "every time" if not m.get("once", true) else "once"
			if not (m.get("during") is Array) or (m.get("during") as Array).is_empty():
				tag += " · every quest"
			_line(C_WHEN, "WHEN", t, tag, "m:" + mid_)


## a closed item: one line, its tag on the right; a click opens it
func _line(c: Color, tag: String, text: String, how: String, key: String) -> void:
	var b := Button.new()
	b.name = "Line_" + key.replace(":", "_")
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.text = "%s   %s" % [tag, text]
	b.clip_text = true
	b.tooltip_text = text + " (" + how + ")"
	b.custom_minimum_size = Vector2(0, 38) * _s()
	b.add_theme_stylebox_override("normal", BuildTab._box(C_CARD, C_LINE, 10, 1, 10))
	b.add_theme_stylebox_override("hover", BuildTab._box(C_CARD, C_BLUE_LINE, 10, 1, 10))
	b.add_theme_color_override("font_color", C_TEXT)
	b.pressed.connect(func(): opened = key; refresh(false))
	var h := HBoxContainer.new()
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(b)
	h.add_child(_label(how, 12, C_FAINT))
	mid.add_child(h)


# ---- a moment, opened -------------------------------------------------------------------------------------------------
func _moment_editor(m: Dictionary) -> void:
	var mid_ := str(m.get("id", ""))
	var box := _open_box("Moment_" + mid_)
	var v: VBoxContainer = box.get_child(0)
	var top := HBoxContainer.new()
	top.add_child(_label(mid_, 13, C_FAINT))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(sp)
	var close := Button.new()
	close.text = "Close"
	close.flat = true
	close.pressed.connect(func(): opened = ""; refresh(false))
	top.add_child(close)
	v.add_child(top)
	v.add_child(_when_row(m, "when", "WHEN", func(fn: Callable, redraw := true): change("when %s" % mid_, func(): fn.call(moment_of(mid_)), redraw)))
	v.add_child(_if_row(m, "if", "ONLY IF", func(fn: Callable, redraw := true): change("only if %s" % mid_, func(): fn.call(moment_of(mid_)), redraw)))
	v.add_child(_then_rows(m, "do", func(fn: Callable, redraw := true): change("then %s" % mid_, func(): fn.call(moment_of(mid_)), redraw)))
	var how := HBoxContainer.new()
	how.add_theme_constant_override("separation", int(8 * _s()))
	how.add_child(_tag("HOW OFTEN", C_FAINT))
	var once: bool = m.get("once", true)
	for spec in [["Just once", true], ["Every time", false]]:
		var b := Button.new()
		b.name = "Often_" + ("once" if spec[1] else "every")
		b.text = spec[0]
		b.toggle_mode = true
		b.button_pressed = once == spec[1]
		b.custom_minimum_size = Vector2(110, 34) * _s()
		b.add_theme_stylebox_override("normal", BuildTab._box(C_CARD, C_LINE, 8, 1, 8))
		b.add_theme_stylebox_override("pressed", BuildTab._box(C_BLUE_BG, C_BLUE, 8, 1, 8))
		b.pressed.connect(func(): change("how often %s" % mid_, func():
			var mm := moment_of(mid_)
			if spec[1]:
				mm.erase("once")
				mm.erase("every")
			else:
				mm["once"] = false))
		how.add_child(b)
	v.add_child(how)
	v.add_child(_label("It reads as", 12, C_FAINT, true))
	var ra := _wrap(_label(reads_as(m), 14, C_TEXT))
	ra.name = "ReadsAs"
	v.add_child(ra)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", int(8 * _s()))
	var tb := BuildTab._button("Try this moment", true)
	tb.name = "TryMoment"
	tb.icon = Glyphs.icon("play", "#0E1A27", 14)
	tb.tooltip_text = "The game from this quest as a test, what it asks for already done, you standing by where it happens"
	tb.pressed.connect(func(): try_moment(moment_of(mid_)))
	row.add_child(tb)
	var sb := BuildTab._button("Show it in the 3D view", false)
	sb.name = "ShowIt"
	sb.pressed.connect(func(): show_it(moment_of(mid_)))
	row.add_child(sb)
	var del := BuildTab._button("Delete", false)
	del.pressed.connect(func():
		if del.text != "Click again to delete":
			del.text = "Click again to delete"
			return
		opened = ""
		change("delete %s" % mid_, func(): (f["moments"] as Array).erase(moment_of(mid_))))
	row.add_child(del)
	v.add_child(row)


## a step, opened: what the list says, when it's done, who asked, the answer to the wrong thing given
func _step_editor(q: Dictionary, s: Dictionary) -> void:
	var qid := str(q.get("id", ""))
	var sid := str(s.get("id", ""))
	var box := _open_box("Step_" + sid)
	var v: VBoxContainer = box.get_child(0)
	var edit := func(what: String, fn: Callable, redraw := true): change("%s of %s" % [what, sid], func():
		for st in quest_of(qid).get("steps", []):
			if str(st.get("id", "")) == sid:
				fn.call(st), redraw)
	var top := HBoxContainer.new()
	top.add_child(_label("A step on the list", 13, C_FAINT))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(sp)
	var close := Button.new()
	close.text = "Close"
	close.flat = true
	close.pressed.connect(func(): opened = ""; refresh(false))
	top.add_child(close)
	v.add_child(top)
	var tr := HBoxContainer.new()
	tr.add_child(_label("The list says", 12, C_FAINT))
	var le := LineEdit.new()
	le.name = "StepText"
	le.text = str(s.get("text", ""))
	le.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_on_commit(le, func(t): edit.call("the words", func(st): st["text"] = t, false))
	tr.add_child(le)
	v.add_child(tr)
	v.add_child(_when_row(s, "done", "TICKED WHEN", func(fn: Callable, redraw := true): edit.call("when it's done", fn, redraw)))
	var g = s.get("done")
	if g is Dictionary and g.has("gave"):
		var wr: Dictionary = s.get("wrong", {}) if s.get("wrong") is Dictionary else {}
		var wl := HBoxContainer.new()
		wl.add_child(_label("Anything else given: she says", 12, C_FAINT))
		var we := LineEdit.new()
		we.name = "Wrong"
		we.text = str(wr.get("say", ""))
		we.placeholder_text = "Nah, that's not what I want."
		we.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_on_commit(we, func(t): edit.call("the answer to the wrong thing", func(st):
			if t == "":
				st.erase("wrong")
			else:
				var w2: Dictionary = st.get("wrong", {}) if st.get("wrong") is Dictionary else {}
				w2["say"] = t
				st["wrong"] = w2, false))
		wl.add_child(we)
		v.add_child(wl)
	var del := BuildTab._button("Delete the step", false)
	del.pressed.connect(func():
		if del.text != "Click again to delete":
			del.text = "Click again to delete"
			return
		opened = ""
		change("delete %s" % sid, func():
			var steps: Array = quest_of(qid).get("steps", [])
			for st in steps.duplicate():
				if str(st.get("id", "")) == sid:
					steps.erase(st)))
	v.add_child(del)


func _open_box(nm: String) -> PanelContainer:
	var box := PanelContainer.new()
	box.name = nm
	box.add_theme_stylebox_override("panel", BuildTab._box(Color("#20262E"), C_BLUE, 12, 2, 14))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", int(10 * _s()))
	box.add_child(v)
	mid.add_child(box)
	return box


# ---- WHEN, ONLY IF, THEN ----------------------------------------------------------------------------------------------
## `apply` takes a function of the object holding `key` (the moment, the step) and makes the change through change()
func _when_row(o: Dictionary, key: String, tag: String, apply: Callable) -> Control:
	var row := HFlowContainer.new()
	row.name = "When"
	row.add_theme_constant_override("h_separation", int(8 * _s()))
	row.add_theme_constant_override("v_separation", int(6 * _s()))
	row.add_child(_tag(tag, C_WHEN))
	var w = o.get(key)
	var holds: bool = w is Dictionary and w.has("holds")
	var verb := "" if holds else HSCommands.verb_of_trigger(w)
	var d := HSCommands.trigger_def(verb)
	var mb := MenuButton.new()
	mb.name = "WhenVerb"
	mb.text = "once this becomes true" if holds else (str(d.get("label", "")).to_lower() if not d.is_empty() else "(choose when)")
	mb.flat = false
	_blue(mb)
	var pop := mb.get_popup()
	var defs := HSCommands.triggers()
	for i in defs.size():
		pop.add_item(str(defs[i]["label"]), i)
	pop.add_separator()
	pop.add_item("Once a condition becomes true…", 9999)
	pop.id_pressed.connect(func(id):
		apply.call(func(x: Dictionary):
			x[key] = {"holds": []} if id == 9999 else (defs[id]["make"] as Dictionary).duplicate(true)))
	row.add_child(mb)
	if holds:
		row.add_child(_cond_chips(w, "holds", func(fn: Callable, redraw := true): apply.call(func(x: Dictionary): fn.call(x[key]), redraw)))
	elif not d.is_empty():
		for fd in HSCommands.fields_of(d, w):
			if not fd.get("verb", false):
				row.add_child(_label(str(fd.get("label", "")), 12, C_FAINT))
			row.add_child(_field(w, fd, func(fn: Callable, redraw := true): apply.call(func(x: Dictionary): fn.call(x[key]), redraw)))
	return row


func _if_row(o: Dictionary, key: String, tag: String, apply: Callable) -> Control:
	var row := HFlowContainer.new()
	row.name = "OnlyIf"
	row.add_theme_constant_override("h_separation", int(8 * _s()))
	row.add_child(_tag(tag, C_IF))
	row.add_child(_cond_chips(o, key, apply))
	return row


## a condition's clauses as chips (a click says not, ✕ takes it away), and/or between them, + and… to add one
func _cond_chips(o: Dictionary, key: String, apply: Callable) -> Control:
	var box := HFlowContainer.new()
	box.name = "Clauses"
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL   # the rest of the row's width (a flow in a flow gets only its least)
	box.add_theme_constant_override("h_separation", int(6 * _s()))
	var p := HSCommands.parse_cond(o.get(key))
	var items: Array = p["items"]
	var put := func(mode: String, its: Array):
		apply.call(func(x: Dictionary):
			var c = HSCommands.build_cond(mode, its)
			if c == null:
				x.erase(key)
			else:
				x[key] = c)
	if items.is_empty():
		box.add_child(_label("always", 13, C_FAINT))
	for i in items.size():
		if i > 0:
			var ao := Button.new()
			ao.text = "and" if p["mode"] == "all" else "or"
			ao.flat = true
			ao.tooltip_text = "All of them, or any one"
			ao.pressed.connect(func(): put.call("any" if p["mode"] == "all" else "all", items))
			box.add_child(ao)
		var x: Dictionary = items[i]
		var chip := Button.new()
		chip.name = "Clause_%d" % i
		chip.text = HSCommands.clause_text(x)
		chip.tooltip_text = "Click: the opposite (not). ✕ next to it takes it away"
		_blue(chip, Color("#2B2540"), Color("#5A4A86"), Color("#DCCFFA"))
		chip.pressed.connect(func():
			var its := items.duplicate(true)
			its[i]["not"] = not its[i].get("not", false)
			put.call(p["mode"], its))
		box.add_child(chip)
		var rm := Button.new()
		rm.text = "✕"
		rm.flat = true
		rm.tooltip_text = "Take it away"
		rm.pressed.connect(func():
			var its := items.duplicate(true)
			its.remove_at(i)
			put.call(p["mode"], its))
		box.add_child(rm)
	var add := MenuButton.new()
	add.name = "AddClause"
	add.text = "+ and…" if items.size() else "+ only if…"
	add.flat = false
	var pop := add.get_popup()
	var choices := clause_choices()
	var k := 0
	for grp in choices:
		var sub := PopupMenu.new()
		sub.name = "Sub%d" % k
		for j in (grp[1] as Array).size():
			sub.add_item(str(grp[1][j][1]), j)
		var g_items: Array = grp[1]
		sub.id_pressed.connect(func(j):
			var its := items.duplicate(true)
			its.append(g_items[j][0])
			put.call(p["mode"], its))
		pop.add_submenu_node_item(str(grp[0]), sub)
		k += 1
	if choices.is_empty():
		add.disabled = true
	box.add_child(add)
	return box


## what can be asked: [phrase, [[clause, the id's words]...]] for the facts the scene and the file have
func clause_choices() -> Array:
	var out: Array = []
	var by_kind := {"note": _ids("note"), "thing": _ids("thing"), "item": _ids("item"), "area": _ids("area"), "actor": _ids("actor"),
		"step": _steps(), "quest": _quests(), "ending": _endings(), "talk": _talks(), "achievement": (f.get("achievements", []) as Array).map(func(a): return str(a.get("id", "")))}
	for fw in HSCommands.data()["fact_words"]:
		var kind: String = fw[3]
		if not by_kind.has(kind):
			continue
		var vals: Array = by_kind[kind]
		if vals.is_empty():
			continue
		out.append([str(fw[1]), vals.map(func(v): return [{"kind": "fact", "v": str(fw[0]) + str(v), "not": false}, str(v)])])
	var gv: Array = []
	for it in by_kind["item"]:
		for who in by_kind["actor"]:
			gv.append([{"kind": "fact", "v": "gave:%s:%s" % [it, who], "not": false}, "%s to %s" % [it, who]])
	if gv.size():
		out.append(["they've given", gv])
	var fl: Array = flag_names()
	if fl.size():
		out.append(["a flag of the story's is set", fl.map(func(v): return [{"kind": "fact", "v": v, "not": false}, v])])
	for spec in [["quest", "a quest is the one on", _quests()], ["done", "a quest is done", _quests()], ["step", "a step is ticked", by_kind["step"]],
			["has", "they hold an item", by_kind["item"]], ["ending", "an ending was reached", by_kind["ending"]]]:
		if (spec[2] as Array).size():
			out.append([spec[1], (spec[2] as Array).map(func(v): return [{"kind": spec[0], "v": str(v), "not": false}, str(v)])])
	return out


## the flags the story sets itself (a moment's Set flag, an answer's sets, a code lock's) and the facts the file names
func flag_names() -> Array:
	var out := {}
	for k in f.get("facts", {}):
		out[str(k)] = true
	for fl in _ids("flag"):
		out[fl] = true
	var acts: Array = []
	for m in f.get("moments", []):
		acts.append_array(m.get("do", []))
	for q in f.get("quests", []):
		acts.append_array(q.get("on_start", []))
		acts.append_array(q.get("on_done", []))
	for a in acts:
		if a is Dictionary and a.get("flag") is String and a["flag"] != "":
			out[a["flag"]] = true
	var talk = f.get("talk", {})
	if talk is Dictionary:
		for who in talk:
			for t in talk[who]:
				for ln in t.get("lines", []):
					for an in ln.get("answers", []):
						for s in an.get("sets", []):
							out[str(s)] = true
	var names: Array = out.keys().filter(func(x): return not str(x).contains(":") and not str(x).begins_with("@"))
	names.sort()
	return names


func _then_rows(o: Dictionary, key: String, apply: Callable) -> Control:
	var v := VBoxContainer.new()
	v.name = "Then"
	v.add_theme_constant_override("separation", int(6 * _s()))
	var acts: Array = o.get(key, []) if o.get(key) is Array else []
	var first := HBoxContainer.new()
	first.add_child(_tag("THEN", C_THEN))
	if acts.is_empty():
		first.add_child(_label("nothing yet", 13, C_FAINT))
	v.add_child(first)
	for i in acts.size():
		var a = acts[i]
		var row := HFlowContainer.new()
		row.name = "Do_%d" % i
		row.add_theme_constant_override("h_separation", int(8 * _s()))
		row.add_theme_constant_override("v_separation", int(6 * _s()))
		var num := _label("%d" % (i + 1), 12, C_BLUE, true)
		num.custom_minimum_size = Vector2(22, 0) * _s()
		num.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		row.add_child(num)
		var verb := HSCommands.verb_of_action(a)
		var d := HSCommands.action_def(verb)
		var mb := MenuButton.new()
		mb.name = "Verb"
		mb.text = str(d.get("label", verb)).to_lower() if not d.is_empty() else verb
		mb.flat = false
		_blue(mb)
		_actions_menu(mb.get_popup(), func(def: Dictionary): apply.call(func(x: Dictionary): x[key][i] = (def["make"] as Dictionary).duplicate(true)))
		row.add_child(mb)
		if not d.is_empty() and a is Dictionary:
			for fd in HSCommands.fields_of(d, a):
				if fd.get("kind") == "trigger":
					continue                               # (a to-do's own trigger: the Manager)
				if not fd.get("verb", false):
					row.add_child(_label(str(fd.get("label", "")), 12, C_FAINT))
				row.add_child(_field(a, fd, func(fn: Callable, redraw := true): apply.call(func(x: Dictionary): fn.call(x[key][i]), redraw)))
		for spec in [["↑", -1], ["↓", 1]]:
			var mv := Button.new()
			mv.text = spec[0]
			mv.flat = true
			mv.disabled = i + int(spec[1]) < 0 or i + int(spec[1]) >= acts.size()
			mv.pressed.connect(func(): apply.call(func(x: Dictionary):
				var l: Array = x[key]
				var t = l[i]
				l[i] = l[i + int(spec[1])]
				l[i + int(spec[1])] = t))
			row.add_child(mv)
		var rm := Button.new()
		rm.text = "✕"
		rm.flat = true
		rm.tooltip_text = "Take it away"
		rm.pressed.connect(func(): apply.call(func(x: Dictionary): (x[key] as Array).remove_at(i)))
		row.add_child(rm)
		v.add_child(row)
	var add := MenuButton.new()
	add.name = "AddThen"
	add.text = "+ Then…"
	add.flat = false
	_actions_menu(add.get_popup(), func(def: Dictionary): apply.call(func(x: Dictionary):
		if not (x.get(key) is Array):
			x[key] = []
		(x[key] as Array).append((def["make"] as Dictionary).duplicate(true))))
	var am := MarginContainer.new()
	am.add_theme_constant_override("margin_left", int(30 * _s()))
	am.add_child(add)
	v.add_child(am)
	return v


## every command, by its group, into a menu
func _actions_menu(pop: PopupMenu, on_pick: Callable) -> void:
	var defs := HSCommands.actions()
	var k := 0
	for grp in HSCommands.data()["groups"]:
		var sub := PopupMenu.new()
		sub.name = "Group%d" % k
		var mine: Array = defs.filter(func(dd): return dd.get("group") == grp["id"] and not dd.get("rare", false))
		for j in mine.size():
			sub.add_item(str(mine[j]["label"]), j)
			if mine[j].has("hint"):
				sub.set_item_tooltip(j, str(mine[j]["hint"]))
		sub.id_pressed.connect(func(j): on_pick.call(mine[j]))
		pop.add_submenu_node_item(str(grp["label"]), sub)
		k += 1


## a command's or a trigger's field: an id picked from the scene's, words, a number, yes or no, one of its choices
func _field(o, fd: Dictionary, apply: Callable) -> Control:
	var k := str(fd.get("key", ""))
	var kind := str(fd.get("kind", "text"))
	var cur = o.get(k) if o is Dictionary else null
	var set_to := func(v, redraw := true):
		apply.call(func(x: Dictionary):
			if v == null or (v is String and v == "" and fd.get("opt", false)):
				x.erase(k)
			else:
				x[k] = v, redraw)
	match kind:
		"text", "longtext", "pose", "facing", "lifestate", "ask", "askanswer", "sound", "expr", "flag":
			var le := LineEdit.new()
			le.name = "F_" + k
			le.text = HSCommands.js(cur) if cur != null else ""
			le.placeholder_text = str(fd.get("ph", fd.get("label", "")))
			le.custom_minimum_size = Vector2(220 if kind == "longtext" else 150, 32) * _s()
			_on_commit(le, func(t): set_to.call(t, false))
			return le
		"number", "karma":
			var le := LineEdit.new()
			le.name = "F_" + k
			le.text = HSCommands.js(cur) if cur != null and not (cur is Dictionary) else ""
			le.placeholder_text = str(fd.get("ph", ""))
			le.custom_minimum_size = Vector2(70, 32) * _s()
			_on_commit(le, func(t):
				var s := str(t).strip_edges()
				set_to.call(null if s == "" or not s.is_valid_float() else (int(s) if s.is_valid_int() else float(s)), false))
			return le
		"bool":
			var cb := CheckBox.new()
			cb.name = "F_" + k
			cb.text = "" if fd.get("verb", false) else "yes"
			cb.button_pressed = cur == true
			cb.toggled.connect(func(on): set_to.call(true if on else null))
			return cb
		"choice":
			var ob := OptionButton.new()
			ob.name = "F_" + k
			var opts: Array = fd.get("opts", [])
			var labels: Dictionary = fd.get("labels", {}) if fd.get("labels") is Dictionary else {}
			var vals: Array = []
			if fd.get("opt", false) or cur == null:
				ob.add_item("—")
				vals.append(null)
			for v in opts:
				ob.add_item(str(labels.get(v, v)))
				vals.append(v)
			ob.select(max(0, vals.find(cur)))
			ob.item_selected.connect(func(i): set_to.call(vals[i]))
			return ob
		"many", "routes":
			var le := LineEdit.new()
			le.name = "F_" + k
			le.text = ", ".join(PackedStringArray((cur if cur is Array else []).map(func(x): return str(x))))
			le.placeholder_text = "a, b"
			le.custom_minimum_size = Vector2(150, 32) * _s()
			_on_commit(le, func(t):
				var l: Array = Array(str(t).split(",", false)).map(func(x): return x.strip_edges()).filter(func(x): return x != "")
				set_to.call(l if l.size() else null, false))
			return le
	return _pick(kind, cur, func(v): set_to.call(v))


## an id from the scene's (or the file's): its node's name shown, the id kept; one the scene hasn't got stays, marked
func _pick(kind: String, cur, on_pick: Callable) -> OptionButton:
	var ob := OptionButton.new()
	ob.name = "Pick_" + kind
	var vals: Array = [null]
	ob.add_item("—")
	var any := {"anyone": "anyone", "anylocker": "anywhere", "anycarry": "anything", "anytodo": "every task"}
	if any.has(kind):
		ob.add_item(any[kind])
		vals.append(true)
	for v in refs(kind):
		ob.add_item(_name(kind, v) if _name(kind, v) == str(v) else "%s (%s)" % [_name(kind, v), v])
		vals.append(v)
	if cur != null and not (cur is String and cur == "") and not vals.has(cur):
		ob.add_item("%s (not in the scene)" % HSCommands.js(cur))
		vals.append(cur)
	ob.select(max(0, vals.find(cur)))
	_blue(ob)
	ob.item_selected.connect(func(i): on_pick.call(vals[i]))
	return ob


## the ids a field of this kind picks from (the Manager's refs)
func refs(kind: String) -> Array:
	match kind:
		"thing", "table", "die", "carry", "anylocker", "anycarry":
			return _ids("thing")
		"door":
			return _ids("door")
		"spot":
			return _ids("spot")
		"cast", "anyone":
			return _ids("actor")
		"zone":
			return _ids("area")
		"room":
			return _ids("room")
		"item":
			var it := _ids("item")
			for q in f.get("quests", []):
				for s in q.get("steps", []):
					var g = s.get("done")
					if g is Dictionary and g.get("gave") is String and g["gave"] != "*" and not it.has(g["gave"]):
						it.append(g["gave"])
			return it
		"note":
			return _ids("note")
		"light":
			return _ids("light")
		"life":
			return _ids("life")
		"route":
			return _ids("path")
		"motion":
			return _ids("motion")
		"counter":
			return _ids("counter")
		"todo", "anytodo":
			return _steps()
		"scene":                                      # a conversation as the runtime's scene (the Manager's refs)
			var out: Array = []
			var talk = f.get("talk", {})
			if talk is Dictionary:
				for who in talk:
					for t in talk[who]:
						out.append("talk__%s__%s" % [who, t.get("id", "")])
			return out
		"beat":
			return (f.get("moments", []) as Array).map(func(m): return "m_" + str(m.get("id", "")))
	return []


func _ids(kind: String) -> Array:
	var r = panel.dock.root() if panel != null and panel.dock != null else null
	return Array(HSDirector.ids(kind, r)) if r != null else []


func _steps() -> Array:
	var out: Array = []
	for q in f.get("quests", []):
		for s in q.get("steps", []):
			out.append(str(s.get("id", "")))
	return out


func _quests() -> Array:
	return (f.get("quests", []) as Array).filter(func(q): return not (q.get("desk") is Dictionary)).map(func(q): return str(q.get("id", "")))


func _endings() -> Array:
	return (f.get("endings", []) as Array).map(func(e): return str(e.get("id", "")))


func _talks() -> Array:
	var out: Array = []
	var talk = f.get("talk", {})
	if talk is Dictionary:
		for who in talk:
			for t in talk[who]:
				out.append(str(t.get("id", "")))
	return out


# ---- words ------------------------------------------------------------------------------------------------------------
## a thing's name for a person: its node's (a thing's display name, else its node's name in words), else the id
func _name(_kind, v) -> String:
	if v == null or (v is String and v == ""):
		return "…"
	if v is String and v == "*":
		return "anything"
	var n = node_of(str(v))
	if n != null:
		var dn = n.get("display_name")
		if dn is String and dn != "":
			return dn
		return _words(str(n.name))
	return HSCommands.js(v)


## "KitchenDoorway" -> "Kitchen doorway"
static func _words(s: String) -> String:
	var t := HSDirector.snake(s).replace("_", " ")
	return t.substr(0, 1).to_upper() + t.substr(1)


func _when_words(w) -> String:
	if w is Dictionary and w.has("holds"):
		var c := HSCommands.cond_text(w["holds"])
		return "this becomes true: " + (c if c != "" else "…")
	if not (w is Dictionary) or w.is_empty():
		return "(choose when)"
	return HSCommands.trigger_text(w, _name)


func _acts_words(acts) -> String:
	var l: Array = (acts if acts is Array else []).map(func(a): return _lower(HSCommands.action_text(a, _name)))
	if l.size() <= 1:
		return "".join(PackedStringArray(l))
	return ", ".join(PackedStringArray(l.slice(0, l.size() - 1))) + " and " + str(l[-1])


static func _lower(s: String) -> String:
	return s.substr(0, 1).to_lower() + s.substr(1) if s != "" else s


## the whole moment as a sentence (the panel's It reads as)
func reads_as(m: Dictionary) -> String:
	var s := "When " + _when_words(m.get("when"))
	if not HSCond.empty(m.get("if")):
		s += ", if " + HSCommands.cond_text(m["if"])
	var acts := _acts_words(m.get("do", []))
	s += ": " + (acts if acts != "" else "nothing yet")
	s += ". " + ("Just once." if m.get("once", true) else "Every time.")
	return s


# ---- adding -----------------------------------------------------------------------------------------------------------
func add_quest() -> void:
	var qid := fresh_id("q_quest")
	change("a new quest", func():
		(f["quests"] as Array).append({"id": qid, "title": "A new quest", "objective": "", "steps": []}))
	quest = qid
	ending = ""
	refresh(false)


func add_ending() -> void:
	var eid := fresh_id("e_ending")
	change("a new ending", func(): (f["endings"] as Array).append({"id": eid, "kind": "neutral", "title": "A new ending", "text": ""}))
	ending = eid
	refresh(false)


func add_step() -> void:
	if quest_of(quest).is_empty():
		return
	var sid := fresh_id("step")
	var qid := quest
	change("a new step", func():
		var q := quest_of(qid)
		if not (q.get("steps") is Array):
			q["steps"] = []
		(q["steps"] as Array).append({"id": sid, "text": "A new step", "done": {}}))
	opened = "s:" + sid
	refresh(false)


## a new moment in the quest being edited (none: the whole game's): its when and its commands
func add_moment(when: Dictionary, acts: Array, base := "moment") -> String:
	var id := fresh_id(base)
	var m := {"id": id, "when": when, "do": acts}
	if quest != "" and not quest_of(quest).is_empty():
		m["during"] = [quest]
	change("a new moment", func(): (f["moments"] as Array).append(m))
	opened = "m:" + id
	refresh(false)
	return id


## a ready-made moment (a Scares card) clicked: on the selected area, room, door or thing, else for you to say when
func add_ready(it: Dictionary, target: Node = null) -> String:
	var sel = target if target != null else (panel.dock.selected() if panel != null else null)
	var cls := HSDirector.class_of(sel) if sel != null and is_instance_valid(sel) else ""
	var when := {}
	var tid := HSDirector.id_of(sel) if cls.begins_with("HS") else ""
	if cls in ["HSTrigger", "HSCheckpoint", "HSRoom"]:
		when = {"enter": tid}
	elif cls in ["HSDoor", "HSThing", "HSActor"]:
		when = {"use": tid}
	var room = panel.build.room_of(sel) if panel != null and sel != null and cls != "" else null
	var acts: Array = (it.get("moment", {}).get("do", []) as Array).duplicate(true)
	for a in acts:
		for k in a.keys():
			if str(a[k]) == "{room}":
				a[k] = HSDirector.id_of(room) if room != null else ""
			elif str(a[k]) == "" and cls == "HSDoor" and k in ["at", "door"]:
				a[k] = tid                                 # a knock on it, it slamming
	var id := add_moment(when, acts, str(it.get("name", "moment")))
	if panel != null:
		panel.say("%s: %s. Change any word in the moment." % [it.get("title", "A moment"), ("when " + _when_words(when)) if not when.is_empty() else "say when it happens (WHEN)"])
	return id


## a ready-made moment dropped in the 3D view (plugin.gd _unlink): on the area it fell in or the door it fell by, the
## new area taken back; elsewhere the new area is its place (as Build's Scares cards)
func landed(area: Node, ps: Dictionary) -> void:
	var p: Vector3 = area.global_position
	var target: Node = null
	var r = panel.dock.root()
	for a in HSDirector.nodes_of(r, "HSTrigger"):
		if a != area and a.has_method("to_local") and _inside(a, p):
			target = a
			break
	if target == null:
		var best := 1.2
		for d in HSDirector.nodes_of(r, "HSDoor"):
			var dd := Vector2(d.global_position.x - p.x, d.global_position.z - p.z).length()
			if dd < best:
				best = dd
				target = d
	if target == null:
		panel.build.scare_landed(area, ps["item"], [quest] if quest != "" and not quest_of(quest).is_empty() else [])
		return
	var ur = panel.plugin.get_undo_redo()
	ur.get_history_undo_redo(ur.get_object_history_id(r)).undo()   # the drop's new area, taken back
	add_ready(ps["item"], target)
	panel.dock.select(target)


static func _inside(a: Node3D, p: Vector3) -> bool:
	var l: Vector3 = a.to_local(p)
	var sz = a.get("size")
	if not (sz is Vector3):
		return false
	return absf(l.x) <= sz.x / 2.0 and absf(l.z) <= sz.z / 2.0 and l.y >= -0.5 and l.y <= sz.y + 0.5


# ---- an ending ----------------------------------------------------------------------------------------------------------
func _draw_ending() -> void:
	var e: Dictionary = {}
	for x in f.get("endings", []):
		if str(x.get("id", "")) == ending:
			e = x
	if e.is_empty():
		ending = ""
		_draw_mid()
		return
	var eid := ending
	var edit := func(what: String, fn: Callable, redraw := true): change("%s of %s" % [what, eid], func():
		for x in f.get("endings", []):
			if str(x.get("id", "")) == eid:
				fn.call(x), redraw)
	mid.add_child(_label("The ending “%s”" % str(e.get("title", eid)), 16, C_TEXT, true))
	mid.add_child(_label("A quest's next (the Director Manager) or a moment can end the game here.", 12, C_MUTED))
	var g := GridContainer.new()
	g.columns = 2
	g.add_theme_constant_override("h_separation", int(10 * _s()))
	g.add_child(_label("Its title", 12, C_FAINT))
	var le := LineEdit.new()
	le.name = "EndingTitle"
	le.text = str(e.get("title", ""))
	le.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_on_commit(le, func(t): edit.call("the title", func(x): x["title"] = t, false))
	g.add_child(le)
	g.add_child(_label("What kind", 12, C_FAINT))
	var ob := OptionButton.new()
	ob.name = "EndingKind"
	for k in KINDS_ENDING:
		ob.add_item(k)
	ob.select(max(0, KINDS_ENDING.find(str(e.get("kind", "neutral")))))
	ob.item_selected.connect(func(i): edit.call("the kind", func(x): x["kind"] = KINDS_ENDING[i]))
	g.add_child(ob)
	g.add_child(_label("Its words", 12, C_FAINT))
	var te := LineEdit.new()
	te.name = "EndingText"
	te.text = str(e.get("text", ""))
	te.placeholder_text = "You waited in the dark until the sun came up."
	te.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_on_commit(te, func(t): edit.call("the words", func(x): x["text"] = t, false))
	g.add_child(te)
	mid.add_child(g)
	var del := BuildTab._button("Delete the ending", false)
	del.pressed.connect(func():
		if del.text != "Click again to delete":
			del.text = "Click again to delete"
			return
		change("delete %s" % eid, func():
			for x in (f["endings"] as Array).duplicate():
				if str(x.get("id", "")) == eid:
					(f["endings"] as Array).erase(x))
		ending = ""
		refresh(false))
	mid.add_child(del)


# ---- the ready-made moments ---------------------------------------------------------------------------------------
func ready_items() -> Array:
	var cat := BuildTab.load_catalog()
	return (cat.get("items", []) as Array).filter(func(it): return str(it.get("kind")) == "scare")


func _draw_right() -> void:
	ready_cards.clear()
	right.add_child(_label("Ready-made moments", 12, C_FAINT, true))
	right.add_child(_wrap(_label("Drag one onto an area or a door, or click it to add it here (onto what's selected). You can change every word after.", 12, C_MUTED)))
	for it in ready_items():
		var b := Button.new()
		b.name = "Ready_" + str(it["id"])
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.text = "%s\n%s" % [it.get("title", ""), it.get("desc", "")]
		b.icon = Glyphs.icon(str(it.get("glyph", "scare")), "#F3C27A", 18)
		b.custom_minimum_size = Vector2(0, 54) * _s()
		b.add_theme_stylebox_override("normal", BuildTab._box(C_CARD, C_LINE, 10, 1, 8))
		b.add_theme_stylebox_override("hover", BuildTab._box(C_CARD, C_BLUE_LINE, 10, 1, 8))
		b.add_theme_font_size_override("font_size", int(12 * _s()))
		b.pressed.connect(func(): add_ready(it))
		b.set_drag_forwarding(func(_pos): return _drag(it), func(_p, _d): return false, func(_p, _d): pass)
		right.add_child(b)
		ready_cards[str(it["id"])] = b


func _drag(it: Dictionary):
	if panel == null:
		return null
	panel.plugin.pending_scare = {"item": it, "at": Time.get_ticks_msec(), "from": "story"}
	var pv := _label(str(it.get("title", "")), 13, C_TEXT)
	set_drag_preview(pv)
	return {"type": "files", "files": [ROOT + "presets/area.tscn"]}


# ---- trying it, showing it ----------------------------------------------------------------------------------------
## the node a moment's WHEN names (an area walked into, a thing used or looked at), if the scene has it
func when_node(m: Dictionary) -> Node:
	var w = m.get("when")
	if not (w is Dictionary):
		return null
	for k in ["enter", "exit", "use", "look", "read", "pickup", "hidden", "peeping", "locked", "state", "played", "rolled", "dropped", "carrying"]:
		if w.get(k) is String and w[k] != "":
			var n = node_of(w[k])
			if n == null and k == "pickup":
				n = _thing_with_item(w[k])
			return n
	return null


func _thing_with_item(item: String) -> Node:
	var r = panel.dock.root() if panel != null else null
	for t in HSDirector.nodes_of(r, "HSThing"):
		if str(t.get("item")) == item:
			return t
	return null


## a node of the open scene by its story id (lights by their name)
func node_of(id: String) -> Node:
	var r = panel.dock.root() if panel != null and panel.dock != null else null
	if r == null or id == "":
		return null
	var stack: Array = [r]
	while stack.size():
		var n: Node = stack.pop_back()
		if HSDirector.class_of(n).begins_with("HS") and HSDirector.id_of(n) == id:
			return n
		if n is Light3D and HSDirector.snake(str(n.name)) == id:
			return n
		if n.name == "_gen":
			continue
		stack.append_array(n.get_children())
	return null


## the play-from-here file for Try this moment: the game from its quest as a test, the facts its ONLY IF asks for
## already done and the items it asks for in hand, the player standing by where it happens
func try_request(m: Dictionary) -> Dictionary:
	var req := {"test": true, "flags": [], "items": []}
	var during = m.get("during", [])
	var q := quest if quest != "" and not quest_of(quest).is_empty() else (str(during[0]) if during is Array and during.size() else "")
	if q != "":
		req["from"] = q
	var p := HSCommands.parse_cond(m.get("if"))
	var clauses: Array = p["items"] if p["mode"] == "all" else (p["items"] as Array).slice(0, 1)
	for x in clauses:
		if x.get("not", false):
			continue
		match str(x["kind"]):
			"fact":
				req["flags"].append(str(x["v"]))
			"done":
				req["flags"].append("done:" + str(x["v"]))
			"step":
				req["flags"].append("step:" + str(x["v"]))
			"has":
				req["items"].append(str(x["v"]))
	var n = when_node(m)
	if n is Node3D:
		var lv = panel.build._level_of(n) if panel != null else null
		if lv != null:
			var at: Vector3 = n.global_position
			var away := Vector3(0, 0, 1)
			var vp := EditorInterface.get_editor_viewport_3d(0)
			var cam: Camera3D = vp.get_camera_3d() if vp != null else null
			if cam != null:
				away = cam.global_position - at
			away.y = 0.0
			if away.length() < 0.01:
				away = Vector3(0, 0, 1)
			away = away.normalized()
			var reach := 1.4
			var sz = n.get("size")
			if HSDirector.class_of(n) in ["HSTrigger", "HSCheckpoint"] and sz is Vector3:
				reach = maxf(sz.x, sz.z) / 2.0 + 0.8      # outside the area: walk in
			var pos: Vector3 = at + away * reach
			var room = panel.build.room_of(n)
			pos.y = room.global_position.y if room != null else at.y
			var d: Vector3 = at - pos
			req["near"] = {"level": HSDirector.id_of(lv), "pos": [pos.x, pos.y, pos.z], "yaw": rad_to_deg(atan2(d.x, d.z))}
	return req


func try_moment(m: Dictionary) -> void:
	var req := try_request(m)
	var fl := FileAccess.open(RUN_FILE, FileAccess.WRITE)
	if fl != null:
		fl.store_string(JSON.stringify(req))
		fl.close()
	EditorInterface.play_main_scene()
	panel.say("Trying %s: from %s, you standing by %s (F8 stops it)" % [m.get("id", "the moment"), req.get("from", "the start"), _name("", (m.get("when") as Dictionary).values()[0]) if m.get("when") is Dictionary and not (m["when"] as Dictionary).is_empty() else "the start"])


func show_it(m: Dictionary) -> void:
	var n = when_node(m)
	if n == null:
		panel.say("Its WHEN names nothing in this scene yet: pick it there")
		return
	panel.dock.select(n)
	panel.say("%s is selected: press F over the 3D view to frame it" % n.name)


# ---- small pieces ---------------------------------------------------------------------------------------------------
static func _s() -> float:
	return Glyphs.scale()


static func _label(t: String, size: int, color: Color, bold := false) -> Label:
	return BuildTab._label(t, size, color, bold)


static func _wrap(l: Label) -> Label:
	return BuildTab._wrap(l)


func _tag(t: String, c: Color) -> Label:
	var l := _label(t, 11, c, true)
	l.custom_minimum_size = Vector2(76, 0) * _s()
	return l


## a blue word: a picker's look
static func _blue(b: Button, bg := C_BLUE_BG, line := C_BLUE_LINE, text := C_BLUE_TEXT) -> void:
	for st in ["normal", "hover", "pressed", "focus"]:
		b.add_theme_stylebox_override(st, BuildTab._box(bg if st != "hover" else bg.lightened(0.08), line if st == "normal" else C_BLUE, 7, 1, 6))
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(k, text)


## a LineEdit's words taken when Enter is pressed or it loses focus (not on every key)
static func _on_commit(le: LineEdit, fn: Callable) -> void:
	le.text_submitted.connect(func(_t): le.release_focus())
	le.focus_exited.connect(func():
		if le.has_meta("hs_was") and str(le.get_meta("hs_was")) == le.text:
			return
		le.set_meta("hs_was", le.text)
		fn.call(le.text))
	le.set_meta("hs_was", le.text)
