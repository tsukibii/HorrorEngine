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
## how a quest ends: [its finish, the words]
const FINISH := [["steps", "when its steps are done"], ["any", "when any one step is done"], ["opening", "when what happens as it starts is over (an intro)"],
	["never", "when a moment ends it"]]
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


signal changed                    # the file read again or changed here (the Story Flow tab draws it again)


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
	changed.emit()


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
		changed.emit()
		return
	var qs: Array = f.get("quests", [])
	if ending == "" and (quest == "" or quest_of(quest).is_empty()):
		quest = str(qs[0].get("id", "")) if qs.size() else ""
	_draw_left()
	_draw_mid()
	_draw_right()
	if mid_scroll != null:
		mid_scroll.set_deferred("scroll_vertical", keep)
	changed.emit()


func _draw_left() -> void:
	var d = panel.dock if panel != null else null
	var flags: Dictionary = d.run_flags if d != null else {}
	left.add_child(_label("Quests, in order", 12, C_FAINT, true))
	var qs: Array = (f.get("quests", []) as Array).filter(func(x): return x is Dictionary and x.get("egg", false) != true)
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
		if str(q.get("finish", "")) == "opening":
			steps.add_child(_label("   its opening, then on", 11, C_FAINT))
		elif q.get("list", true) == false and not (q.get("desk") is Dictionary):
			steps.add_child(_label("   no to-do list", 11, C_FAINT))
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
	left.add_child(_label("Easter eggs", 12, C_FAINT, true))       # found during the quests, not in their order
	for e in f.get("quests", []):
		if not (e is Dictionary) or e.get("egg", false) != true:
			continue
		var eid := str(e.get("id", ""))
		var on: bool = eid == quest and ending == ""
		var b := Button.new()
		b.name = "Egg_" + eid
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.clip_text = true
		b.text = "%s%s" % ["✓ " if flags.has("done:" + eid) else "", str(e.get("title", eid))]
		b.tooltip_text = ("Found when " + _when_words(e.get("found"))) if e.get("found") is Dictionary and not (e["found"] as Dictionary).is_empty() else "Say how it's found"
		b.custom_minimum_size = Vector2(0, 34) * _s()
		b.add_theme_stylebox_override("normal", BuildTab._box(Color("#3A3020") if on else C_CARD, Color("#E6C36A") if on else Color("#5A4A2A"), 8, 1, 8))
		b.add_theme_stylebox_override("hover", BuildTab._box(Color("#3A3020"), Color("#E6C36A"), 8, 1, 8))
		b.pressed.connect(func(): quest = eid; ending = ""; opened = ""; refresh(false))
		left.add_child(b)
	var ag := BuildTab._button("+ Add an easter egg", false)
	ag.name = "AddEgg"
	ag.pressed.connect(add_egg)
	left.add_child(ag)
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
	if q.get("egg", false) == true:
		_draw_egg(q)
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
		mb.disabled = _neighbour(i, int(spec[2])) < 0
		mb.pressed.connect(func(): change("move %s" % quest, func():
			var qs: Array = f["quests"]
			var j := qs.find(quest_of(quest))
			var k: int = _neighbour(j, int(spec[2]))
			if k < 0:
				return
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
	var qid := quest
	var ends := HBoxContainer.new()                     # how it ends, and whether its steps are a to-do list on the screen
	ends.add_theme_constant_override("separation", int(10 * _s()))
	ends.add_child(_label("It ends", 12, C_FAINT))
	var fo := OptionButton.new()
	fo.name = "QuestFinish"
	for spec in FINISH:
		fo.add_item(str(spec[1]))
	fo.select(max(0, FINISH.map(func(x): return x[0]).find(str(q.get("finish", "steps")))))
	_blue(fo)
	fo.item_selected.connect(func(i): change("how %s ends" % qid, func():
		var qq := quest_of(qid)
		if FINISH[i][0] == "steps":
			qq.erase("finish")
		else:
			qq["finish"] = FINISH[i][0]))
	ends.add_child(fo)
	var lc := CheckBox.new()
	lc.name = "QuestList"
	lc.text = "Its steps as a to-do list on the screen"
	lc.tooltip_text = "Off: the steps still count, unseen (a marker over what a step needs can show the way)"
	lc.button_pressed = q.get("list", true) != false
	lc.toggled.connect(func(on): change("%s's to-do list" % qid, func():
		var qq := quest_of(qid)
		if on:
			qq.erase("list")
		else:
			qq["list"] = false))
	ends.add_child(lc)
	mid.add_child(ends)
	_draw_stage(q)
	var opening := _then_rows(q, "on_start", func(fn: Callable, redraw := true): change("what happens as %s starts" % qid, func(): fn.call(quest_of(qid)), redraw), "AS IT STARTS")
	opening.name = "Opening"
	mid.add_child(opening)
	for s in q.get("steps", []):
		var sid := str(s.get("id", ""))
		if opened == "s:" + sid:
			_step_editor(q, s)
		else:
			var marked: bool = s.get("guide") is String or (s.get("guide") is bool and s["guide"])
			_line(C_WHEN, "WHEN", _when_words(s.get("done")) + ", tick “%s”" % str(s.get("text", sid)) + (" · with a marker" if marked else ""), "once", "s:" + sid)
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
				t += ", if " + HSCommands.cond_text(m["if"], talk_ctx())
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
	v.add_child(_cutscene_row(m))
	if m.get("cutscene") is Dictionary:
		v.add_child(_timeline(m))
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


# ---- a cutscene in the level (docs/GODOT_ANIMATION_PLAN.md step 7) -------------------------------------------------
## the user (DECISIONS 2026-11-02, night): "Cutscenes no black bars, not skippable... everything should feel like its
## happening in your gameplay... a soft lock... keep the camera focused on the spot or npc that is the target of that
## cutscene, maybe even allow a camera style zoom in. Need a safety lock". A moment played as a cutscene: the view held
## on its target (a cone to look round in), closer (a lean in, a held focus), the walk slowed or held, let go when its
## THEN is over or after at most `max` seconds whatever happens (compile: story_compile.gd cutscene_do)
const CLOSER := [["not closer", 0.0, 0.0], ["a little closer", 0.15, 0.05], ["closer", 0.3, 0.12]]
const WALKS := [["slow", "walking slowed"], ["held", "standing still"], ["free", "walking freely"]]


func _cutscene_row(m: Dictionary) -> Control:
	var mid_ := str(m.get("id", ""))
	var cs = m.get("cutscene")
	var on := cs is Dictionary
	var row := HFlowContainer.new()
	row.name = "Cutscene"
	row.add_theme_constant_override("h_separation", int(8 * _s()))
	row.add_child(_tag("CUTSCENE", C_FAINT))
	var tg := Button.new()
	tg.name = "AsCutscene"
	tg.text = "Played as a cutscene" if on else "Not a cutscene"
	tg.toggle_mode = true
	tg.button_pressed = on
	tg.tooltip_text = "In the level, no black bars, no skipping: the view held on what it's about while it plays, let go at its end (or after at most its seconds)"
	tg.add_theme_stylebox_override("normal", BuildTab._box(C_CARD, C_LINE, 8, 1, 8))
	tg.add_theme_stylebox_override("pressed", BuildTab._box(C_BLUE_BG, C_BLUE, 8, 1, 8))
	tg.pressed.connect(func(): change("cutscene %s" % mid_, func():
		var mm := moment_of(mid_)
		if mm.get("cutscene") is Dictionary:
			mm.erase("cutscene")
		else:
			mm["cutscene"] = {"target": cutscene_target(mm), "walk": "slow"}))
	row.add_child(tg)
	if not on:
		return row
	var set_cs := func(k: String, val) -> void:
		change("cutscene %s" % mid_, func():
			var c: Dictionary = moment_of(mid_)["cutscene"]
			if val == null:
				c.erase(k)
			else:
				c[k] = val)
	row.add_child(_label("the view held on", 13, C_MUTED))
	var tp := OptionButton.new()
	tp.name = "CutTarget"
	var vals: Array = []
	for k in ["cast", "spot", "thing"]:
		for v in refs(k):
			if not vals.has(v):
				vals.append(v)
				tp.add_item(_name(k, v))
	var cur := str(cs.get("target", ""))
	if cur != "" and not vals.has(cur):
		vals.append(cur)
		tp.add_item("%s (not in the scene)" % cur)
	tp.select(max(0, vals.find(cur)))
	tp.item_selected.connect(func(i): set_cs.call("target", vals[i]))
	row.add_child(tp)
	var cl := OptionButton.new()
	cl.name = "CutCloser"
	var ci := 0
	for i in CLOSER.size():
		cl.add_item(CLOSER[i][0])
		if is_equal_approx(float(cs.get("push", 0.0)), CLOSER[i][1]) and is_equal_approx(float(cs.get("zoom", 0.0)), CLOSER[i][2]):
			ci = i
	cl.select(ci)
	cl.item_selected.connect(func(i): change("cutscene %s" % mid_, func():
		var c: Dictionary = moment_of(mid_)["cutscene"]
		for kv in [["push", CLOSER[i][1]], ["zoom", CLOSER[i][2]]]:
			if float(kv[1]) > 0.0:
				c[kv[0]] = kv[1]
			else:
				c.erase(kv[0])))
	row.add_child(cl)
	var wk := OptionButton.new()
	wk.name = "CutWalk"
	for w in WALKS:
		wk.add_item(w[1])
	wk.select(max(0, WALKS.map(func(w): return w[0]).find(str(cs.get("walk", "slow")))))
	wk.item_selected.connect(func(i): set_cs.call("walk", WALKS[i][0]))
	row.add_child(wk)
	row.add_child(_label("let go after at most", 13, C_MUTED))
	var mx := SpinBox.new()
	mx.name = "CutMax"
	mx.min_value = 1
	mx.max_value = 60
	mx.step = 1
	mx.suffix = "s"
	mx.value = float(cs.get("max", 20))
	mx.tooltip_text = "The safety release: whatever happens, the player is let go after this long"
	mx.value_changed.connect(func(x): set_cs.call("max", null if is_equal_approx(x, 20.0) else int(x)))
	row.add_child(mx)
	return row


## who a new cutscene holds the view on: the first character its THEN names, else the nearest to where it happens
func cutscene_target(m: Dictionary) -> String:
	for w in timeline_people(m):
		return w
	var near = when_node(m)
	var a = BuildTab.nearest_actor(near, panel.dock.root()) if panel != null and panel.dock != null else null
	return a.cast_id() if a != null else ""


## the characters a moment's THEN names, in order (whom it animates, sends, puts a face on, gives a line, moves)
func timeline_people(m: Dictionary) -> Array:
	var cast := refs("cast")
	var out: Array = []
	for a in (m.get("do", []) if m.get("do") is Array else []):
		if not (a is Dictionary):
			continue
		for k in ["anim", "behave", "who", "move"]:
			var w = a.get(k)
			if w is String and cast.has(w) and not out.has(w):
				out.append(w)
	return out


## a cutscene's THEN as a timeline: the view, a row per character (her commands in order; a clip or a face added from
## her row, or a card from the Animate tab dropped on it), the lines; Play it here (Try this moment)
func _timeline(m: Dictionary) -> Control:
	var mid_ := str(m.get("id", ""))
	var cs: Dictionary = m["cutscene"]
	var box := VBoxContainer.new()
	box.name = "Timeline"
	box.add_theme_constant_override("separation", int(4 * _s()))
	var head := HBoxContainer.new()
	head.add_child(_tag("TIMELINE", C_FAINT))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)
	var play := BuildTab._button("Play it here", true)
	play.name = "PlayItHere"
	play.icon = Glyphs.icon("play", "#0E1A27", 14)
	play.tooltip_text = "The game from this quest as a test, standing by where it happens (Try this moment)"
	play.pressed.connect(func(): try_moment(moment_of(mid_)))
	head.add_child(play)
	box.add_child(head)
	var closer := "not closer"
	for c in CLOSER:
		if is_equal_approx(float(cs.get("push", 0.0)), c[1]) and is_equal_approx(float(cs.get("zoom", 0.0)), c[2]):
			closer = c[0]
	var walk := str(WALKS.filter(func(w): return w[0] == str(cs.get("walk", "slow")))[0][1]) if WALKS.any(func(w): return w[0] == str(cs.get("walk", "slow"))) else "walking slowed"
	box.add_child(_timeline_row("The view", "held on %s, %s, %s; let go at the end, or after %d s at most" % [_name("cast", cs.get("target", "")), closer, walk, int(cs.get("max", 20))], "View", ""))
	for who in timeline_people(m):
		var words: Array = []
		for a in m.get("do", []):
			if a is Dictionary and (a.get("anim") == who or a.get("behave") == who or a.get("who") == who or a.get("move") == who):
				words.append(HSCommands.action_text(a, Callable(self, "_name")))
		box.add_child(_timeline_row(_name("cast", who), " → ".join(PackedStringArray(words)), "Who_" + str(who), str(who)))
	var lines: Array = []
	for a in m.get("do", []):
		if a is Dictionary and (a.has("say") or a.has("think")):
			lines.append(HSCommands.action_text(a, Callable(self, "_name")))
	box.add_child(_timeline_row("Lines", " → ".join(PackedStringArray(lines)) if lines.size() else "none yet (THEN: Say a line)", "Lines", ""))
	return box


## a row of the timeline: its name, what happens in it, and for a character a clip or a face to add (and a drop target)
func _timeline_row(title: String, text: String, nm: String, who: String) -> Control:
	var row := HBoxContainer.new()
	row.name = "Row_" + nm
	row.add_theme_constant_override("separation", int(8 * _s()))
	var t := _label(title, 13, C_STAGE if who != "" else C_TEXT, true)
	t.custom_minimum_size = Vector2(110, 0) * _s()
	row.add_child(t)
	var w := _wrap(_label(text, 13, C_MUTED))
	w.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(w)
	if who == "":
		return row
	var add := MenuButton.new()
	add.name = "AddClip"
	add.text = "+ a clip or a face…"
	add.flat = false
	var pop := add.get_popup()
	var actor = node_of(who)
	var clips: Array = HSLibrary.hers(actor) if actor != null else []
	var faces: Array = HSDirector.faces()
	for i in clips.size():
		pop.add_item("%s (a clip)" % clips[i], i)
	for j in faces.size():
		pop.add_item("%s (a face)" % faces[j], 1000 + j)
	pop.id_pressed.connect(func(id):
		if id >= 1000:
			add_to_cutscene(who, {"expr": faces[id - 1000], "who": who})
		else:
			add_to_cutscene(who, {"anim": who, "clip": clips[id], "wait": true}))
	row.add_child(add)
	row.set_drag_forwarding(func(_p): return null, func(_p, d): return _anim_drop_ok(d), func(_p, _d): _anim_dropped(who))
	return row


## the open moment's THEN gets this command at its end (the timeline's order is the order it plays in)
func add_to_cutscene(_who: String, act: Dictionary) -> void:
	var mid_ := opened.trim_prefix("m:")
	change("add to %s" % mid_, func():
		var mm := moment_of(mid_)
		if not (mm.get("do") is Array):
			mm["do"] = []
		(mm["do"] as Array).append(act))


## a card from the Animate tab dragged over a character's row (plugin.gd's pending_anim) and dropped: hers in the THEN
func _anim_drop_ok(d) -> bool:
	return d is Dictionary and str(d.get("type", "")) == "files" and panel != null and panel.plugin.pending_anim is Dictionary


func _anim_dropped(who: String) -> void:
	var pa: Dictionary = panel.plugin.pending_anim
	panel.plugin.pending_anim = null
	var c: Dictionary = pa["clip"]
	if bool(pa.get("face", false)):
		add_to_cutscene(who, {"expr": str(c["id"]), "who": who})
		return
	var actor = node_of(who)
	var nm := str(c["id"])
	if actor != null:
		var why := [""]
		nm = HSLibrary.make_for(actor, c, why)
		if nm == "":
			panel.say(why[0])
			return
	add_to_cutscene(who, {"anim": who, "clip": nm, "wait": true})


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
	v.add_child(_marker_row(s, func(gv): edit.call("its marker", func(st):
		if gv == null:
			st.erase("guide")
		else:
			st["guide"] = gv)))
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


## a step's marker (STORY_FORMAT §4 a todo's `guide`: the diamond bobbing over what it needs, in the game): on or off, and
## over what (what its WHEN names, or a thing, a person or an area picked); `put` takes true, an id, or null (none)
func _marker_row(s: Dictionary, put: Callable) -> Control:
	var row := HFlowContainer.new()
	row.name = "Marker"
	row.add_theme_constant_override("h_separation", int(8 * _s()))
	row.add_child(_tag("MARKER", Color("#F3C27A")))
	var g = s.get("guide")
	var on: bool = g is String or (g is bool and g)
	var cb := CheckBox.new()
	cb.name = "Guide"
	cb.text = "Show a marker over it in the game"
	cb.tooltip_text = "A small diamond bobbing over what this step needs, so the player knows what to go to (no words needed)"
	cb.button_pressed = on
	cb.toggled.connect(func(t): put.call(true if t else null))
	row.add_child(cb)
	if on:
		var ob := OptionButton.new()
		ob.name = "GuideOver"
		var auto := marker_auto(s)
		var vals: Array = [true]
		ob.add_item(("over %s" % _name("", auto)) if auto != "" else "over what its WHEN names (pick it if it can't tell)")
		var ids: Array = []
		for k in ["actor", "thing", "area", "door"]:
			for id in _ids(k):
				if not ids.has(id):
					ids.append(id)
		for id in ids:
			ob.add_item("over %s (%s)" % [_name("", id), id])
			vals.append(id)
		ob.select(max(0, vals.find(g)))
		_blue(ob)
		ob.item_selected.connect(func(i): put.call(vals[i]))
		row.add_child(ob)
	return row


## what a step's marker hangs over by itself (its WHEN's thing, person or area; a talk's person), "" if it can't tell
func marker_auto(s: Dictionary) -> String:
	var d = s.get("done")
	if not (d is Dictionary):
		return ""
	var tk := HSCommands.talk_when(d, talk_ctx())
	if not tk.is_empty():
		return str(tk["who"])
	for k in ["use", "read", "pickup", "look", "enter", "hidden", "peeping", "locked", "state", "played", "rolled", "dropped", "carrying", "arrived"]:
		if d.get(k) is String and d[k] != "":
			return str(d[k])
	if d.get("to") is String:
		return str(d["to"])
	if d.has("holds"):
		var p := HSCommands.parse_cond(d["holds"])
		if (p["items"] as Array).size() == 1 and p["items"][0]["kind"] == "fact" and not p["items"][0].get("not", false):
			var f := str(p["items"][0]["v"])
			for pre in ["used:", "picked:", "read:", "entered:", "dropped:", "rolled:", "played:"]:
				if f.begins_with(pre):
					return f.substr(pre.length())
	return ""


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
	var talk := HSCommands.talk_when(w, talk_ctx())        # a talk: someone talked to, heard out (the facts it waits for)
	var holds: bool = w is Dictionary and w.has("holds") and talk.is_empty()
	var verb := "" if (holds or not talk.is_empty()) else HSCommands.verb_of_trigger(w)
	var d := HSCommands.trigger_def(verb)
	var mb := MenuButton.new()
	mb.name = "WhenVerb"
	mb.text = "the player talks to" if not talk.is_empty() else ("once this becomes true" if holds else (str(d.get("label", "")).to_lower() if not d.is_empty() else "(choose when)"))
	mb.flat = false
	_blue(mb)
	var pop := mb.get_popup()
	var defs := HSCommands.triggers()
	pop.add_item("Talk to someone…", 9998)
	pop.set_item_tooltip(0, "When the player talks to someone: when she's clicked, when she's heard out, or when one of her conversations is heard to the end")
	pop.add_separator()
	for i in defs.size():
		pop.add_item(str(defs[i]["label"]), i)
	pop.add_separator()
	pop.add_item("Once a condition becomes true…", 9999)
	pop.id_pressed.connect(func(id):
		apply.call(func(x: Dictionary):
			if id == 9998:
				var ps := talk_people()
				x[key] = {"holds": "talked:" + (str(ps[0]) if ps.size() else "")}
			else:
				x[key] = {"holds": []} if id == 9999 else (defs[id]["make"] as Dictionary).duplicate(true)))
	row.add_child(mb)
	if not talk.is_empty():
		row.add_child(_talk_pickers(talk, func(fact: String): apply.call(func(x: Dictionary): x[key] = {"holds": fact})))
	elif holds:
		row.add_child(_cond_chips(w, "holds", func(fn: Callable, redraw := true): apply.call(func(x: Dictionary): fn.call(x[key]), redraw)))
	elif not d.is_empty():
		for fd in HSCommands.fields_of(d, w):
			if not fd.get("verb", false):
				row.add_child(_label(str(fd.get("label", "")), 12, C_FAINT))
			row.add_child(_field(w, fd, func(fn: Callable, redraw := true): apply.call(func(x: Dictionary): fn.call(x[key]), redraw)))
	return row


## a talk's blue words: who (the people with conversations), and when (she's clicked, she's heard out, one of her
## conversations heard out, by its title or first line); `put` takes the fact the WHEN waits for
func _talk_pickers(talk: Dictionary, put: Callable) -> Control:
	var box := HBoxContainer.new()
	box.name = "Talk"
	box.add_theme_constant_override("separation", int(8 * _s()))
	var who := str(talk["who"])
	var people := talk_people()
	if not people.has(who):
		people.append(who)
	var wo := OptionButton.new()
	wo.name = "TalkWho"
	for i in people.size():
		wo.add_item(_name("cast", people[i]), i)
	wo.select(people.find(who))
	_blue(wo)
	var how := str(talk["how"])
	wo.item_selected.connect(func(i): put.call(("%s:%s" % [how, people[i]]) if str(talk["talk"]) == "" else "heard:" + str(people[i])))
	box.add_child(wo)
	var ho := OptionButton.new()
	ho.name = "TalkHow"
	var hows := HSCommands.talk_hows(f.get("talk", {}), who)
	var now := ("%s:%s" % [how, talk["talk"] if str(talk["talk"]) != "" else who])
	var at := -1
	for i in hows.size():
		ho.add_item(str(hows[i][1]), i)
		if hows[i][0] == now:
			at = i
	if at < 0:                                      # (begun one particular conversation: a fact the pickers don't offer, kept)
		ho.add_item("when “%s” begins" % talk["label"], hows.size())
		hows.append([now, ""])
		at = hows.size() - 1
	ho.select(at)
	_blue(ho)
	ho.item_selected.connect(func(i): put.call(str(hows[i][0])))
	box.add_child(ho)
	return box


## who can be talked to: the people the Director file has conversations for (else the scene's characters)
func talk_people() -> Array:
	var talk = f.get("talk", {})
	var out: Array = (talk as Dictionary).keys().map(func(k): return str(k)) if talk is Dictionary else []
	if out.is_empty():
		out = _ids("actor")
	out.sort()
	return out


## the talk words' context: the file's conversations, and a person's name as the panel says it
func talk_ctx() -> Dictionary:
	return {"talks": f.get("talk", {}) if f.get("talk") is Dictionary else {}, "name": _name}


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
		chip.text = HSCommands.clause_text(x, talk_ctx())
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
		if kind == "talk" or not by_kind.has(kind):
			continue
		var vals: Array = by_kind[kind]
		if vals.is_empty():
			continue
		out.append([str(fw[1]), vals.map(func(v): return [{"kind": "fact", "v": str(fw[0]) + str(v), "not": false}, str(v)])])
	var talks: Dictionary = f.get("talk", {}) if f.get("talk") is Dictionary else {}
	var tw: Array = []                              # talking: someone talked to, heard out, one of her conversations heard out
	var th: Array = []
	for who in talk_people():
		tw.append([{"kind": "fact", "v": "talked:" + who, "not": false}, _name("cast", who)])
		th.append([{"kind": "fact", "v": "heard:" + who, "not": false}, "%s (anything she says)" % _name("cast", who)])
		for t in talks.get(who, []):
			if t is Dictionary and str(t.get("id", "")) != "":
				th.append([{"kind": "fact", "v": "heard:" + str(t["id"]), "not": false}, "%s's “%s”" % [_name("cast", who), HSCommands.talk_of(talks, str(t["id"]))["label"]]])
	if tw.size():
		out.append(["they've talked to", tw])
		out.append(["they've heard out", th])
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


func _then_rows(o: Dictionary, key: String, apply: Callable, tag := "THEN") -> Control:
	var v := VBoxContainer.new()
	v.name = "Then"
	v.add_theme_constant_override("separation", int(6 * _s()))
	var acts: Array = o.get(key, []) if o.get(key) is Array else []
	var first := HBoxContainer.new()
	first.add_child(_tag(tag, C_THEN))
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
		"thing":                                     # a thing or a character (the format's: whom an `anim`, a jumpscare, a look names)
			var th := _ids("thing")
			return th + _ids("actor").filter(func(x): return not th.has(x))
		"table", "die", "carry", "anylocker", "anycarry":
			return _ids("thing")
		"door":
			return _ids("door")
		"spot":
			return _ids("spot")
		"seat":                                      # a spot, or a thing that's sat on
			var r = panel.dock.root() if panel != null and panel.dock != null else null
			var seats: Array = _ids("spot")
			for t in (HSDirector.nodes_of(r, "HSThing") if r != null else []):
				if str(t.get("use")) == "sit" and not seats.has(HSDirector.id_of(t)):
					seats.append(HSDirector.id_of(t))
			return seats
		"face":
			return HSDirector.faces()
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
	if v is String and v.ends_with("__home"):        # a character's own place (where the level has her at its start)
		return "%s's place" % _name("cast", v.trim_suffix("__home"))
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
	var talk := HSCommands.talk_when_text(w, talk_ctx())
	if talk != "":
		return talk
	if w is Dictionary and w.has("holds"):
		var c := HSCommands.cond_text(w["holds"], talk_ctx())
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
		s += ", if " + HSCommands.cond_text(m["if"], talk_ctx())
	var acts := _acts_words(m.get("do", []))
	s += ": " + (acts if acts != "" else "nothing yet")
	s += ". " + ("Just once." if m.get("once", true) else "Every time.")
	return s


# ---- adding -----------------------------------------------------------------------------------------------------------
func add_quest() -> void:
	var first := (f.get("quests", []) as Array).all(func(q): return q is Dictionary and q.get("egg", false) == true)
	var qid := fresh_id("q_intro" if first else "q_quest")
	change("a new quest", func():                     # (none yet: the Intro, what happens as the game opens; the last keeps its ending)
		HSFlow.add_quest(f, qid, "Intro" if first else "A new quest"))
	quest = qid
	ending = ""
	refresh(false)


## an easter egg (the user, 2026-11-02): found during the quests (none named: any of them), what it plays, then the game
## goes on where it was or jumps ahead
func add_egg() -> void:
	var eid := fresh_id("egg")
	change("a new easter egg", func(): HSFlow.add_egg(f, eid, "An easter egg"))
	quest = eid
	ending = ""
	opened = ""
	refresh(false)


## an easter egg's editor: how it's found, only if, during which quests, what it plays, and then
func _draw_egg(q: Dictionary) -> void:
	var eid := str(q.get("id", ""))
	var apply := func(fn: Callable, redraw := true): change("the easter egg %s" % eid, func(): fn.call(quest_of(eid)), redraw)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", int(10 * _s()))
	head.add_child(_label("Easter egg “%s”" % str(q.get("title", eid)), 16, C_TEXT, true))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)
	var del := Button.new()
	del.text = "Delete the egg"
	del.flat = true
	del.add_theme_color_override("font_color", Color("#F2A79D"))
	del.pressed.connect(func():
		if del.text != "Click again to delete":
			del.text = "Click again to delete"
			return
		change("delete %s" % eid, func(): HSFlow.remove(f, eid))
		quest = "")
	head.add_child(del)
	mid.add_child(head)
	mid.add_child(_wrap(_label("Hidden: nothing on the screen announces it. It's found while one of its quests is on, plays what it plays, and then the game goes on where it was, or jumps ahead (a skip).", 12, C_MUTED)))
	var g := HBoxContainer.new()
	g.add_theme_constant_override("separation", int(8 * _s()))
	g.add_child(_label("The egg", 12, C_FAINT))
	var le := LineEdit.new()
	le.name = "Quest_title"
	le.text = str(q.get("title", ""))
	le.custom_minimum_size = Vector2(260, 34) * _s()
	_on_commit(le, func(t): change("the egg's title", func(): quest_of(eid)["title"] = t, false))
	g.add_child(le)
	mid.add_child(g)
	var w := _when_row(q, "found", "FOUND WHEN", apply)
	w.name = "Found"
	mid.add_child(w)
	mid.add_child(_if_row(q, "if", "ONLY IF", apply))
	var dr := HFlowContainer.new()                       # during which quests (none: any)
	dr.name = "During"
	dr.add_theme_constant_override("h_separation", int(8 * _s()))
	dr.add_child(_tag("DURING", C_IF))
	var during: Array = q.get("during", []) if q.get("during") is Array else []
	if during.is_empty():
		dr.add_child(_label("any quest", 13, C_MUTED))
	for qd in during:
		var chip := Button.new()
		chip.text = str(quest_of(str(qd)).get("title", qd)) + "  ✕"
		chip.tooltip_text = "Not during this quest any more"
		_blue(chip)
		chip.pressed.connect(func(): change("%s's quests" % eid, func(): HSFlow.set_during(f, eid, str(qd), false)))
		dr.add_child(chip)
	var add := MenuButton.new()
	add.name = "AddDuring"
	add.text = "+ during…"
	add.flat = false
	var pop := add.get_popup()
	var others: Array = (f.get("quests", []) as Array).filter(func(x): return x is Dictionary and x.get("egg", false) != true and not (x.get("desk") is Dictionary) and not during.has(str(x.get("id", ""))))
	for k in others.size():
		pop.add_item(str(others[k].get("title", others[k].get("id", ""))), k)
	pop.id_pressed.connect(func(k): change("%s's quests" % eid, func(): HSFlow.set_during(f, eid, str(others[k].get("id", "")), true)))
	add.disabled = others.is_empty()
	dr.add_child(add)
	mid.add_child(dr)
	var plays := _then_rows(q, "on_start", apply, "IT PLAYS")
	plays.name = "Plays"
	mid.add_child(plays)
	var th := HBoxContainer.new()                         # then: the game goes on, or a jump (a skip)
	th.name = "EggThen"
	th.add_theme_constant_override("separation", int(8 * _s()))
	th.add_child(_tag("THEN", C_THEN))
	var ob := OptionButton.new()
	ob.name = "EggTo"
	var ids: Array = [""]
	ob.add_item("the game goes on where it was")
	for x in f.get("quests", []):
		if x is Dictionary and x.get("egg", false) != true:
			ids.append(str(x.get("id", "")))
			ob.add_item("it jumps to: " + str(x.get("title", x.get("id", ""))))
	for e in f.get("endings", []):
		ids.append(str(e.get("id", "")))
		ob.add_item("it jumps to the ending: " + str(e.get("title", e.get("id", ""))))
	var cur := HSStoryCompiler._egg_to(q)
	ob.select(maxi(0, ids.find(cur)))
	_blue(ob)
	ob.item_selected.connect(func(k): change("where %s goes on" % eid, func():
		var e := quest_of(eid)
		if str(ids[k]) == "":
			e.erase("next")
		else:
			e["next"] = [{"go": str(ids[k])}]))
	th.add_child(ob)
	mid.add_child(th)


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


## a ready-made moment (a Scares or Reactions card) clicked: on the selected area, room, door or thing, else for you to
## say when; its words filled in for where it is (build_tab.gd fill_ready: the room, the door, who reacts)
func add_ready(it: Dictionary, target: Node = null) -> String:
	var sel = target if target != null else (panel.dock.selected() if panel != null else null)
	var cls := HSDirector.class_of(sel) if sel != null and is_instance_valid(sel) else ""
	var when := {}
	var tid := HSDirector.id_of(sel) if cls.begins_with("HS") else ""
	if cls in ["HSTrigger", "HSCheckpoint", "HSRoom"]:
		when = {"enter": tid}
	elif cls in ["HSDoor", "HSThing", "HSActor"]:
		when = {"use": tid}
	var acts: Array = panel.build.fill_ready(it.get("moment", {}).get("do", []), sel if cls != "" else null) if panel != null else \
		(it.get("moment", {}).get("do", []) as Array).duplicate(true)
	var id := add_moment(when, acts, str(it.get("name", "moment")))
	if panel != null:
		panel.say("%s: %s. Change any word in the moment." % [it.get("title", "A moment"), ("when " + _when_words(when)) if not when.is_empty() else "say when it happens (WHEN)"])
	return id


# ---- On stage ------------------------------------------------------------------------------------------------------
const C_STAGE := Color("#9AD0B4")
## what a person does on stage, as the line's `do` (and `then` for walking to a seat)
const STAGE_DO := [["idle", "stands at"], ["sit", "sits on"], ["go", "walks to, then stands"], ["go_sit", "walks to, then sits"],
	["path", "walks a path"], ["patrol", "patrols paths"], ["off", "isn't there"]]
var staged := {}                  # Show on stage: actor -> {xf, visible, ap} (put back by ■ or before a save)


## the quests On stage counts down (no eggs, no desk items), in the file's order
func stage_quests() -> Array:
	return (f.get("quests", []) as Array).filter(func(q): return q is Dictionary and q.get("egg", false) != true)


## each person's line in a quest: her own there, or the one carried to it from an earlier quest ({who: [from, line]})
func stage_lines(qid: String) -> Dictionary:
	var out := {}
	for ln in HSStoryCompiler.new().stage_cover(stage_quests()):
		if (ln["quests"] as Array).has(qid):
			out[ln["who"]] = [ln["from"], ln["line"]]
	return out


## On stage (docs/GODOT_ANIMATION_PLAN.md §6, the user: "at this point npc is doing this, then if quest complete they
## get up and walk here with this animation, you can talk to them here, they have this expression"): a line per
## character, hers in this quest or carried from an earlier one; the in-between plays by itself from her moves
func _draw_stage(q: Dictionary) -> void:
	var qid := str(q["id"])
	var box := VBoxContainer.new()
	box.name = "OnStage"
	box.add_theme_constant_override("separation", int(4 * _s()))
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", int(8 * _s()))
	head.add_child(_tag("ON STAGE", C_STAGE))
	head.add_child(_label("who's where, doing what, while it's on (carried on until a later quest changes it)", 12, C_MUTED))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(sp)
	var show := BuildTab._button("■ Back to the scene" if staged.size() else "Show on stage", staged.size() > 0)
	show.name = "ShowOnStage"
	show.tooltip_text = "Everyone where they'll be in this quest, doing it, in the 3D view (nothing saved; ■ puts them back)"
	show.pressed.connect(func():
		if staged.size():
			unshow_stage()
		else:
			show_stage(qid)
		refresh(false))
	head.add_child(show)
	box.add_child(head)
	var lines := stage_lines(qid)
	var own: Dictionary = q.get("stage", {}) if q.get("stage") is Dictionary else {}
	for who in refs("cast"):
		if own.has(who):
			box.add_child(_stage_row(qid, str(who), own[who]))
		else:
			box.add_child(_stage_carried(qid, str(who), lines.get(who)))
	if refs("cast").is_empty():
		box.add_child(_wrap(_label("No characters in the scene yet (the Build tab's People).", 12, C_FAINT)))
	mid.add_child(box)


func _stage_carried(qid: String, who: String, carried) -> Control:
	var row := HBoxContainer.new()
	row.name = "Stage_" + who
	row.add_theme_constant_override("separation", int(8 * _s()))
	row.add_child(_label(_name("cast", who), 13, C_FAINT, true))
	var words := "as the level has her" if carried == null else "as in “%s”: %s" % [str(quest_of(carried[0]).get("title", carried[0])), stage_words(carried[1], true)]
	var l := _label(words, 12, C_FAINT)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.clip_text = true
	row.add_child(l)
	var b := Button.new()
	b.name = "StageHere"
	b.text = "Change it here"
	b.flat = true
	b.add_theme_color_override("font_color", C_BLUE)
	b.pressed.connect(func(): change("%s on stage in %s" % [who, qid], func():
		var qq := quest_of(qid)
		if not (qq.get("stage") is Dictionary):
			qq["stage"] = {}
		var ln: Dictionary = (carried[1] as Dictionary).duplicate(true) if carried != null else {"do": "idle"}
		ln.erase("talk")                               # (a conversation belongs to its own quest)
		qq["stage"][who] = ln))
	row.add_child(b)
	return row


## a line's key set, or taken off (null)
static func _keep(x: Dictionary, k: String, v) -> void:
	if v == null:
		x.erase(k)
	else:
		x[k] = v


## her line as words (Story Flow's chips and a carried line say it): "sits on Sofa · reading · face tired · talks …"
## (carried: without the conversation, which belongs to its quest)
func stage_words(ln: Dictionary, carried := false) -> String:
	var d := str(ln.get("do", "idle"))
	if d == "go" and str(ln.get("then", "")) == "sit":
		d = "go_sit"
	var w := ""
	for x in STAGE_DO:
		if x[0] == d:
			w = x[1]
	var place = ln.get("at", ln.get("to", ln.get("path", null)))
	if ln.get("paths") is Array:
		place = ", ".join(PackedStringArray((ln["paths"] as Array).map(func(p): return _name("route", p))))
	if d != "off":
		w += " " + (_name("spot", place) if place != null else "…")
	for k in [["motion", ""], ["expr", "face "]]:
		if str(ln.get(k[0], "")) != "":
			w += " · %s%s" % [k[1], ln[k[0]]]
	if ln.has("talk") and not carried:
		w += " · busy" if str(ln["talk"]) == "" else " · talks %s" % ln["talk"]
	return w


func _stage_row(qid: String, who: String, ln: Dictionary) -> Control:
	var put := func(fn: Callable, redraw := true):
		change("%s on stage in %s" % [who, qid], func(): fn.call(quest_of(qid)["stage"][who]), redraw)
	var row := HFlowContainer.new()
	row.name = "Stage_" + who
	row.add_theme_constant_override("h_separation", int(6 * _s()))
	row.add_theme_constant_override("v_separation", int(4 * _s()))
	var nm := _label(_name("cast", who), 13, C_TEXT, true)
	nm.custom_minimum_size = Vector2(90, 30) * _s()
	nm.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(nm)
	var d := str(ln.get("do", "idle"))
	if d == "go" and str(ln.get("then", "")) == "sit":
		d = "go_sit"
	var dob := OptionButton.new()                    # what she does
	dob.name = "StageDo"
	for x in STAGE_DO:
		dob.add_item(str(x[1]))
	dob.select(max(0, STAGE_DO.map(func(x): return x[0]).find(d)))
	_blue(dob)
	dob.item_selected.connect(func(i): put.call(func(x: Dictionary):
		var nd: String = STAGE_DO[i][0]
		var place = x.get("at", x.get("to"))
		for k in ["do", "then", "at", "to", "path", "paths"]:
			x.erase(k)
		x["do"] = "go" if nd == "go_sit" else nd
		if nd == "go_sit":
			x["then"] = "sit"
		if nd in ["idle", "sit"] and place != null:
			x["at"] = place
		elif nd in ["go", "go_sit"] and place != null:
			x["to"] = place))
	row.add_child(dob)
	match d:                                         # where
		"idle", "sit":
			row.add_child(_pick("seat" if d == "sit" else "spot", ln.get("at"), func(v): put.call(func(x: Dictionary): _keep(x, "at", v))))
		"go", "go_sit":
			row.add_child(_pick("seat" if d == "go_sit" else "spot", ln.get("to"), func(v): put.call(func(x: Dictionary): _keep(x, "to", v))))
		"path":
			row.add_child(_pick("route", ln.get("path"), func(v): put.call(func(x: Dictionary): _keep(x, "path", v))))
		"patrol":
			row.add_child(_field(ln, {"key": "paths", "kind": "routes"}, put))
	if d != "off":
		row.add_child(_label("doing", 12, C_FAINT))       # what she plays there (none: her moves)
		var mb := _pick("motion", ln.get("motion"), func(v): put.call(func(x: Dictionary): _keep(x, "motion", v)))
		mb.name = "StageMotion"
		mb.set_item_text(0, "her moves")
		row.add_child(mb)
		row.add_child(_label("face", 12, C_FAINT))
		var fb := _pick("face", ln.get("expr"), func(v): put.call(func(x: Dictionary): _keep(x, "expr", v)))
		fb.name = "StageFace"
		fb.set_item_text(0, "as she is")
		row.add_child(fb)
		row.add_child(_label("talks", 12, C_FAINT))       # the conversation she offers here
		var tb := OptionButton.new()
		tb.name = "StageTalk"
		var tv: Array = [null, ""]
		tb.add_item("as she does")                   # (in this quest only: a conversation isn't carried on)
		tb.add_item("not now: she's busy")
		for t in (f.get("talk", {}).get(who, []) as Array):   # each by its title, else its first line
			var first := str(((t.get("lines", [{}]) as Array) + [{}])[0].get("text", "")) if t.get("lines") is Array else ""
			var said := str(t.get("title", "")) if str(t.get("title", "")) != "" else (first if first != "" else str(t.get("id", "")))
			tb.add_item("“%s”" % (said.left(44) + ("…" if said.length() > 44 else "")))
			tv.append(str(t.get("id", "")))
		tb.select(max(0, tv.find(ln.get("talk")) if ln.has("talk") else 0))
		_blue(tb)
		tb.item_selected.connect(func(i): put.call(func(x: Dictionary): _keep(x, "talk", tv[i])))
		row.add_child(tb)
		var more := MenuButton.new()                 # the in-between's own clips, and whom she faces
		more.name = "StageMore"
		more.text = "…"
		more.tooltip_text = "walks with, gets up with, arrives with; faces you"
		var pop := more.get_popup()
		var acts := {}
		var i := 0
		for spec in [["walk", "walks with"], ["leave", "gets up with"], ["arrive", "arrives with"]]:
			var sub := PopupMenu.new()
			sub.name = "More_" + spec[0]
			sub.add_item("her own (her moves)", 0)
			var clips: Array = refs("motion")
			for j in clips.size():
				sub.add_item(str(clips[j]), j + 1)
			var key: String = spec[0]
			sub.id_pressed.connect(func(id): put.call(func(x: Dictionary): _keep(x, key, null if id == 0 else clips[id - 1])))
			pop.add_child(sub)
			pop.add_submenu_node_item("%s: %s" % [spec[1], str(ln.get(key, "her own"))], sub)
			i += 1
		pop.add_check_item("faces you", 100)
		pop.set_item_checked(pop.get_item_index(100), str(ln.get("face", "")) == "player")
		pop.id_pressed.connect(func(id):
			if id == 100:
				put.call(func(x: Dictionary): _keep(x, "face", null if str(x.get("face", "")) == "player" else "player")))
		_blue(more)
		row.add_child(more)
	var del := Button.new()                          # back to what's carried
	del.name = "StageClear"
	del.flat = true
	del.text = "×"
	del.tooltip_text = "Take her line off this quest (she carries on as in the quest before)"
	del.pressed.connect(func(): change("%s off stage in %s" % [who, qid], func():
		var qq := quest_of(qid)
		(qq["stage"] as Dictionary).erase(who)
		if (qq["stage"] as Dictionary).is_empty():
			qq.erase("stage")))
	row.add_child(del)
	return row


## Show on stage: everyone moved to where this quest has them (her own line or the one carried there), playing what
## she does there (her line's motion, else her sitting or her idle), hidden when she isn't there; nothing saved,
## put back by ■ or before a save (plugin.gd _apply_changes)
func show_stage(qid: String) -> void:
	unshow_stage()
	var lines := stage_lines(qid)
	var r = panel.dock.root()
	for a in HSDirector.nodes_of(r, "HSActor"):
		var who: String = a.cast_id()
		if not lines.has(who):
			continue
		var ln: Dictionary = lines[who][1]
		staged[a] = {"xf": a.global_transform, "visible": a.visible, "ap": null}
		var d := str(ln.get("do", "idle"))
		if d == "off":
			a.visible = false
			continue
		var place = ln.get("at", ln.get("to"))
		if d == "path" and ln.get("path") != null:     # a path: its first stop
			var pn = node_of(str(ln["path"]))
			for c in (pn.get_children() if pn != null else []):
				if HSDirector.is_a(c, "HSSpot"):
					place = HSDirector.id_of(c)
					break
		var target = node_of(str(place)) if place != null else null
		if target is Node3D:
			a.global_transform = Transform3D(target.global_transform.basis.orthonormalized(), target.global_position)
		var sitting: bool = d == "sit" or (d == "go" and str(ln.get("then", "")) == "sit")
		var clip := str(ln.get("motion", ""))
		if clip == "":
			clip = a.move("sitting") if sitting and a.move("sitting") != "" else a.move("idle")
		var src: AnimationPlayer = load("res://addons/horrorstudio/play.gd").player_with(a, clip) if clip != "" else null
		if src == null:
			continue
		var ap := AnimationPlayer.new()              # a throwaway player of its own (as the Animate tab's preview): never saved
		ap.name = "_Staged"
		a.add_child(ap)
		ap.root_node = NodePath("..")
		var lib := AnimationLibrary.new()
		var anim: Animation = (src.get_animation(load("res://addons/horrorstudio/play.gd").anim_name(src, clip)) as Animation).duplicate()
		anim.loop_mode = Animation.LOOP_LINEAR
		lib.add_animation("clip", anim)
		ap.add_animation_library("p", lib)
		ap.play("p/clip")
		staged[a]["ap"] = ap
	panel.say("On stage in “%s”: ■ Back to the scene puts everyone back" % str(quest_of(qid).get("title", qid)))


func unshow_stage() -> void:
	for a in staged:
		if not is_instance_valid(a):
			continue
		var st: Dictionary = staged[a]
		var ap = st.get("ap")
		if ap != null and is_instance_valid(ap):
			ap.stop()
			ap.get_parent().remove_child(ap)
			ap.queue_free()
		var sk := HSRetarget.skeleton_of(a)
		if sk != null:
			sk.reset_bone_poses()
		a.global_transform = st["xf"]
		a.visible = st["visible"]
	staged.clear()


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
## the quest next to the i-th in the story's order, earlier (d -1) or later (1), stepping over the easter eggs; -1 none
func _neighbour(i: int, d: int) -> int:
	var qs: Array = f.get("quests", [])
	var k := i + d
	while k >= 0 and k < qs.size() and qs[k] is Dictionary and qs[k].get("egg", false) == true:
		k += d
	return k if k >= 0 and k < qs.size() and i >= 0 else -1


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
	var talk := HSCommands.talk_when(w, talk_ctx())
	if not talk.is_empty():
		return node_of(str(talk["who"]))
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
