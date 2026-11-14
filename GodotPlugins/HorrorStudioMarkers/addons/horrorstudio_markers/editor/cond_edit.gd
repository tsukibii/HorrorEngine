@tool
## A condition as chips (docs/MARKERS.md §5, §7): each word of it a chip in plain words ("after 3 s", "not seen",
## "alex_kitchen"), a + that offers what can be asked, a click on a chip to change it, turn it into its "not" or take
## it out. Used wherever the tab asks "when": a marker's Starts when, a quest's, a way's flags, a Repeat's until, a
## conversation's. Nobody has to type the words; whoever wants to can (the chip's box holds the word itself).
extends HFlowContainer

signal changed(text: String)

const Glyphs := preload("res://addons/horrorstudio_markers/editor/glyphs.gd")

var text := ""
var none := "at once"                      ## what it says with no word
var about_her := true                      ## offer the words about her and you (@near, @seen...)
var waits := true                          ## offer "after a wait"
var flags: PackedStringArray = []          ## flags the scene knows, for the menu
var groups: Array = []                     ## or in groups: [[title, [names]]] (this quest's first, then the game's)
var tasks: PackedStringArray = []          ## tasks the scene knows
var items: PackedStringArray = []          ## things carried the scene knows
var links: Array = []                      ## ways to make a tie in one gesture: [[label, Callable(this editor)]] ("A thing… (click it)")
var _menu: PopupMenu
var _pop: PopupPanel
var _line: LineEdit
var _at := -1


func _ready() -> void:
	add_theme_constant_override("h_separation", int(4 * Glyphs.scale()))
	add_theme_constant_override("v_separation", int(4 * Glyphs.scale()))
	_build()


func set_text(t: String) -> void:
	text = ", ".join(HSNpcCond.words(t))
	if is_inside_tree():
		_build()


func _chip(label: String, color: Color) -> Button:
	var b := Button.new()
	b.text = label
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", int(12 * Glyphs.scale()))
	for st in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(st, Glyphs.box(color if st == "normal" else color.lightened(0.12), 10, 3))
	return b


func _build() -> void:
	for c in get_children():
		remove_child(c)
		c.queue_free()
	var ws := HSNpcCond.words(text)
	if ws.is_empty():
		var l := Label.new()
		l.text = none
		l.add_theme_color_override("font_color", Color(1, 1, 1, 0.5))
		l.add_theme_font_size_override("font_size", int(12 * Glyphs.scale()))
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART           # (it wraps: a long "none" never widens what it's in)
		l.custom_minimum_size = Vector2(96, 0) * Glyphs.scale()
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		add_child(l)
	for i in ws.size():
		var p := HSNpcCond.parse(ws[i])
		var col := Color("#3B5B7A") if String(p["kind"]) in HSNpcCond.LOCAL else (Color("#5B4A7A") if String(p["kind"]) in ["task", "on", "item"] else Color("#3F6B52"))
		if bool(p["neg"]):
			col = Color("#7A4444")
		var b := _chip(HSNpcCond.says_word(ws[i]), col)
		b.name = "Chip%d" % i
		b.tooltip_text = "Click to change it, turn it into its 'not', or take it out.   (%s)" % ws[i]
		b.pressed.connect(_open.bind(i, b))
		add_child(b)
	var plus := _chip("+", Color("#2E3440"))
	plus.name = "Add"
	plus.tooltip_text = "Add something that must be so."
	plus.pressed.connect(_show_menu.bind(plus))
	add_child(plus)


func _emit(t: String) -> void:
	text = ", ".join(HSNpcCond.words(t))
	_build()
	changed.emit(text)


## a word added (what the + menu does)
func add_word(word: String) -> void:
	_emit(HSNpcCond.with_word(text, word))


## a flag asked for, or not any more (its tick in the menu)
func toggle_flag(flag: String) -> void:
	var ws := HSNpcCond.words(text)
	for i in ws.size():
		var p := HSNpcCond.parse(ws[i])
		if String(p["kind"]) == "flag" and String(p["arg"]) == flag:
			remove_at(i)
			return
	add_word(flag)


func remove_at(i: int) -> void:
	_emit(HSNpcCond.without_word(text, i))


func flip_at(i: int) -> void:
	_emit(HSNpcCond.flipped(text, i))


func replace_at(i: int, word: String) -> void:
	var ws := HSNpcCond.words(text)
	if i < 0 or i >= ws.size():
		return
	if word.strip_edges() in ["", "!"]:
		ws.remove_at(i)
	else:
		ws[i] = word.strip_edges()
	_emit(", ".join(ws))


func _show_menu(from: Control) -> void:
	if _menu != null:
		_menu.queue_free()
	_menu = PopupMenu.new()
	add_child(_menu)
	var words := []
	var add := func(label: String, word: String) -> void:
		_menu.add_item(label)
		words.append(word)
	if waits:
		add.call("After a wait (3 s)…", "@wait:3")
	if about_her:
		add.call("You're near (2 m)…", "@near:2")
		add.call("You're far away (6 m)…", "@far:6")
		add.call("In your sight", "@seen")
		add.call("Out of your sight", "@unseen")
		add.call("Has been shot", "@shot")
		add.call("Has been shot down", "@down")
	for ln in links:                                           # (a tie made in one gesture: its Callable gets this editor and adds the word)
		add.call(String(ln[0]), "?link%d" % links.find(ln))
	var have := {}
	for w in HSNpcCond.words(text):
		var pw := HSNpcCond.parse(w)
		if String(pw["kind"]) == "flag" and not bool(pw["neg"]):
			have[String(pw["arg"])] = true
	var list: Array = groups if not groups.is_empty() else [["Flags (ticked: must be on)", Array(flags)]]
	for g in list:                                             # (the user's "Boolean Flags Trigger": the scene's flags, a tick each)
		if (g[1] as Array).is_empty() and list.size() > 1:
			continue
		_menu.add_separator(String(g[0]))
		words.append("")
		for f in (g[1] as Array):
			_menu.add_check_item(String(f))
			_menu.set_item_checked(_menu.item_count - 1, have.has(String(f)))
			words.append("?" + String(f))
	add.call("New flag…", "new_flag")
	if not tasks.is_empty():
		_menu.add_separator("A quest (task)")
		words.append("")
		for t in tasks:
			add.call("%s is open" % t, "on:" + t)
			add.call("%s is done" % t, "task:" + t)
	_menu.add_separator("You carry")
	words.append("")
	for it in items:
		add.call(String(it), "item:" + String(it))
	add.call("Something else…", "item:key")
	_menu.index_pressed.connect(func(i: int) -> void:
		var w := String(words[i])
		if w == "":
			return
		if w.begins_with("?link"):
			var ln2: Array = links[int(w.substr(5))]
			(ln2[1] as Callable).call(self)
			return
		if w.begins_with("?"):                                 # a flag's tick: on, or off again
			toggle_flag(w.substr(1))
			return
		add_word(w)
		if w in ["new_flag", "item:key"] or w.begins_with("@wait") or w.begins_with("@near") or w.begins_with("@far"):
			var ws := HSNpcCond.words(text)
			var at := ws.find(w)
			if at >= 0 and get_child_count() > at:
				_open.call_deferred(at, get_child(at)))
	_menu.position = Vector2i(from.get_screen_position() + Vector2(0, from.size.y))
	_menu.popup()


# a chip's own little box: the word itself to change, Not, Remove
func _open(i: int, from: Control) -> void:
	var ws := HSNpcCond.words(text)
	if i < 0 or i >= ws.size() or not is_instance_valid(from):
		return
	if _pop != null:
		_pop.queue_free()
	_at = i
	_pop = PopupPanel.new()
	add_child(_pop)
	var row := HBoxContainer.new()
	_pop.add_child(row)
	_line = LineEdit.new()
	_line.text = ws[i]
	_line.custom_minimum_size = Vector2(170, 0) * Glyphs.scale()
	_line.tooltip_text = "The word itself: a flag's name; task:id, on:id, item:name; @wait:3, @near:2, @far:6, @seen, @unseen, @shot, @down. ! in front for not."
	_line.text_submitted.connect(func(t: String) -> void:
		_pop.hide()
		replace_at(_at, t))
	row.add_child(_line)
	var no := Button.new()
	no.text = "Not"
	no.tooltip_text = "Turn it into its opposite."
	no.pressed.connect(func() -> void:
		_pop.hide()
		flip_at(_at))
	row.add_child(no)
	var rm := Button.new()
	rm.icon = Glyphs.icon("trash", Color("#E57373"), 14)
	rm.tooltip_text = "Take it out."
	rm.pressed.connect(func() -> void:
		_pop.hide()
		remove_at(_at))
	row.add_child(rm)
	_pop.position = Vector2i(from.get_screen_position() + Vector2(0, from.size.y))
	_pop.popup()
	_line.grab_focus()
	_line.select_all()
