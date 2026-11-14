@tool
## Flags switched, as chips (docs/FLAGS.md §6): "+met_alex, -door_locked, ~lights" drawn as a green chip for a flag
## turned on, a red one for off, a blue one for flipped. The + lists the scene's flags with a tick each (ticked: it's
## switched here); a click on a chip changes what's done to it, its name, or takes it out. Used wherever something
## switches flags: a marker's Then, a conversation's answer, a thing's Logic, a field in the Inspector.
extends HFlowContainer

signal changed(text: String)

const Glyphs := preload("res://addons/horrorstudio_markers/editor/glyphs.gd")
const SIGNS := {"+": ["on", Color("#3F6B52")], "-": ["off", Color("#7A4444")], "~": ["flipped", Color("#3B5B7A")]}

var text := ""
var none := "no flags"
var flags: PackedStringArray = []          ## flags the scene knows, for the menu
var groups: Array = []                     ## or in groups: [[title, [names]]] (what's nearest first)
var _menu: PopupMenu
var _pop: PopupPanel
var _at := -1


func _ready() -> void:
	add_theme_constant_override("h_separation", int(4 * Glyphs.scale()))
	add_theme_constant_override("v_separation", int(4 * Glyphs.scale()))
	_build()


## the switches of a text: [[sign, name]]
static func parts(t: String) -> Array:
	var out := []
	for f in HSNpcCond.switched(t):
		out.append([String(f["op"]), String(f["name"])])
	return out


static func joined(list: Array) -> String:
	var ws := PackedStringArray()
	for p in list:
		if String(p[1]).strip_edges() != "":
			ws.append(String(p[0]) + String(p[1]).strip_edges())
	return ", ".join(ws)


func set_text(t: String) -> void:
	text = joined(parts(t))
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
	var ps := parts(text)
	if ps.is_empty():
		var l := Label.new()
		l.text = none
		l.add_theme_color_override("font_color", Color(1, 1, 1, 0.5))
		l.add_theme_font_size_override("font_size", int(12 * Glyphs.scale()))
		add_child(l)
	for i in ps.size():
		var sign := String(ps[i][0])
		var b := _chip("%s %s" % [{"+": "+", "-": "−", "~": "~"}[sign], ps[i][1]], SIGNS[sign][1])
		b.name = "Chip%d" % i
		b.tooltip_text = "'%s' is turned %s. Click to change that, its name, or take it out." % [ps[i][1], SIGNS[sign][0]]
		b.pressed.connect(_open.bind(i, b))
		add_child(b)
	var plus := _chip("+", Color("#2E3440"))
	plus.name = "Add"
	plus.tooltip_text = "A flag to switch."
	plus.pressed.connect(_show_menu.bind(plus))
	add_child(plus)


func _emit(t: String) -> void:
	text = joined(parts(t))
	_build()
	changed.emit(text)


## a flag switched here (sign "+", "-" or "~"); one already here gets the new sign
func add_flag(flag: String, sign := "+") -> void:
	var ps := parts(text)
	for p in ps:
		if String(p[1]) == flag:
			p[0] = sign
			_emit(joined(ps))
			return
	ps.append([sign, flag])
	_emit(joined(ps))


func remove_at(i: int) -> void:
	var ps := parts(text)
	if i >= 0 and i < ps.size():
		ps.remove_at(i)
	_emit(joined(ps))


func set_at(i: int, sign: String, flag: String) -> void:
	var ps := parts(text)
	if i < 0 or i >= ps.size():
		return
	if flag.strip_edges() == "":
		ps.remove_at(i)
	else:
		ps[i] = [sign, flag.strip_edges().trim_prefix("+").trim_prefix("-").trim_prefix("~")]
	_emit(joined(ps))


## a flag's tick in the menu: switched on here, or not switched any more
func toggle_flag(flag: String) -> void:
	var ps := parts(text)
	for i in ps.size():
		if String(ps[i][1]) == flag:
			remove_at(i)
			return
	add_flag(flag)


func _show_menu(from: Control) -> void:
	if _menu != null:
		_menu.queue_free()
	_menu = PopupMenu.new()
	add_child(_menu)
	var words := []
	var have := {}
	for p in parts(text):
		have[String(p[1])] = true
	var list: Array = groups if not groups.is_empty() else [["Flags (ticked: switched here)", Array(flags)]]
	for g in list:
		if (g[1] as Array).is_empty():
			continue
		_menu.add_separator(String(g[0]))
		words.append("")
		for f in (g[1] as Array):
			_menu.add_check_item(String(f))
			_menu.set_item_checked(_menu.item_count - 1, have.has(String(f)))
			words.append(String(f))
	_menu.add_separator("")
	words.append("")
	_menu.add_item("New flag…")
	words.append("?new")
	_menu.index_pressed.connect(func(i: int) -> void:
		var w := String(words[i])
		if w == "":
			return
		if w == "?new":
			add_flag("new_flag")
			var at := parts(text).size() - 1
			if at >= 0 and get_child_count() > at:
				_open.call_deferred(at, get_child(at))
			return
		toggle_flag(w))
	_menu.position = Vector2i(from.get_screen_position() + Vector2(0, from.size.y))
	_menu.popup()


# a chip's own little box: on / off / flipped, its name, Remove
func _open(i: int, from: Control) -> void:
	var ps := parts(text)
	if i < 0 or i >= ps.size() or not is_instance_valid(from):
		return
	if _pop != null:
		_pop.queue_free()
	_at = i
	_pop = PopupPanel.new()
	add_child(_pop)
	var row := HBoxContainer.new()
	_pop.add_child(row)
	var line := LineEdit.new()
	for sign in ["+", "-", "~"]:
		var sb := Button.new()
		sb.text = {"+": "On", "-": "Off", "~": "Flip"}[sign]
		sb.toggle_mode = true
		sb.button_pressed = String(ps[i][0]) == sign
		sb.tooltip_text = "Turned %s." % SIGNS[sign][0]
		sb.pressed.connect(func() -> void:
			_pop.hide()
			set_at(_at, sign, line.text))
		row.add_child(sb)
	line.text = String(ps[i][1])
	line.custom_minimum_size = Vector2(150, 0) * Glyphs.scale()
	line.tooltip_text = "The flag's name."
	line.text_submitted.connect(func(t: String) -> void:
		_pop.hide()
		set_at(_at, String(parts(text)[_at][0]) if _at < parts(text).size() else "+", t))
	row.add_child(line)
	var rm := Button.new()
	rm.icon = Glyphs.icon("trash", Color("#E57373"), 14)
	rm.tooltip_text = "Take it out."
	rm.pressed.connect(func() -> void:
		_pop.hide()
		remove_at(_at))
	row.add_child(rm)
	_pop.position = Vector2i(from.get_screen_position() + Vector2(0, from.size.y))
	_pop.popup()
	line.grab_focus()
	line.select_all()
