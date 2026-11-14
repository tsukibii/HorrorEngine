@tool
## What the Flags tab and the Things tab are both made of (docs/FLAGS.md §4, §5): a dock along the bottom in the NPC
## Markers tab's look, and the small pieces their forms are built from: a section's head, a row with its label, a
## field of a node as a text box, a tick, a list to pick from, a condition as chips, flags switched as chips, a name
## with the scene's names to pick from. Every field's change goes through the plugin (and the editor's undo).
extends EditorDock

const Glyphs := preload("res://addons/horrorstudio_markers/editor/glyphs.gd")
const CondEdit := preload("res://addons/horrorstudio_markers/editor/cond_edit.gd")
const SwitchEdit := preload("res://addons/horrorstudio_markers/editor/switch_edit.gd")

var plugin: EditorPlugin
var wiring: RefCounted
var form: VBoxContainer
var status: Label
var _busy := false


func say(t: String) -> void:
	if status != null:
		status.text = t


func _bg() -> HBoxContainer:
	var s := Glyphs.scale()
	custom_minimum_size = Vector2(0, 300) * s
	var bg := PanelContainer.new()
	bg.add_theme_stylebox_override("panel", Glyphs.box(Color(0.105, 0.12, 0.145, 0.94), 0, 6))
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var cols := HBoxContainer.new()
	cols.add_theme_constant_override("separation", int(8 * s))
	bg.add_child(cols)
	return cols


func _head(t: String) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", int(11 * Glyphs.scale()))
	l.add_theme_color_override("font_color", Color(1, 1, 1, 0.55))
	return l


func _button(t: String, icon: String, tip: String) -> Button:
	var b := Button.new()
	b.text = t
	if icon != "":
		b.icon = Glyphs.icon(icon, Color("#C8D2DC"), 15)
	b.tooltip_text = tip
	b.focus_mode = Control.FOCUS_NONE
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	return b


func _bold(l: Label) -> Label:
	var th := EditorInterface.get_editor_theme()
	if th != null and th.has_font("bold", "EditorFonts"):
		l.add_theme_font_override("font", th.get_font("bold", "EditorFonts"))
	return l


func _clear(box: Node) -> void:
	for c in box.get_children():
		box.remove_child(c)
		c.queue_free()


func _sec(t: String, into: Container = null) -> VBoxContainer:
	var to: Container = into if into != null else form
	var l := _head(t.to_upper())
	var m := MarginContainer.new()
	m.add_theme_constant_override("margin_top", int(7 * Glyphs.scale()))
	m.add_child(l)
	to.add_child(m)
	var box := VBoxContainer.new()
	box.name = "Sec_" + t.validate_node_name()
	box.add_theme_constant_override("separation", int(3 * Glyphs.scale()))
	to.add_child(box)
	return box


func _row(box: Container, label: String, ctl: Control, tip := "") -> Control:
	var r := HBoxContainer.new()
	var l := Label.new()
	l.text = label
	l.custom_minimum_size = Vector2(104, 0) * Glyphs.scale()
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


func _note(box: Container, t: String) -> Label:
	var l := Label.new()
	l.text = t
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_color_override("font_color", Color(1, 1, 1, 0.5))
	l.add_theme_font_size_override("font_size", int(11 * Glyphs.scale()))
	box.add_child(l)
	return l


# a field set from a form (undoable)
func _put(n: Object, prop: String, value) -> void:
	if _busy or n == null or not is_instance_valid(n):
		return
	var was = n.get(prop)
	if value is PackedStringArray and was is Array:           # (a list nobody set yet reads as a plain Array in the editor)
		was = HSLogicScan.lines(was)
	if typeof(was) == typeof(value) and was == value:
		return
	plugin.set_prop(n, prop, value)
	wiring.touch()
	plugin.update_overlays()
	_changed(n, prop)


# (a form's own change: what the tab brings up to date at once)
func _changed(_n: Object, _prop: String) -> void:
	pass


func _text(n: Object, prop: String, hint := "") -> LineEdit:
	var le := LineEdit.new()
	le.name = "F_" + prop
	le.text = str(n.get(prop))
	le.placeholder_text = hint
	le.text_submitted.connect(func(t: String) -> void: _put(n, prop, t))
	le.focus_exited.connect(func() -> void: _put(n, prop, le.text))
	return le


func _check(n: Object, prop: String, t: String, tip := "") -> CheckBox:
	var cb := CheckBox.new()
	cb.name = "F_" + prop
	cb.text = t
	cb.tooltip_text = tip
	cb.button_pressed = bool(n.get(prop))
	cb.toggled.connect(func(on: bool) -> void: _put(n, prop, on))
	return cb


func _pick(n: Object, prop: String, items: Array) -> OptionButton:
	var ob := OptionButton.new()
	ob.name = "F_" + prop
	ob.fit_to_longest_item = false
	ob.clip_text = true
	ob.custom_minimum_size = Vector2(90, 0) * Glyphs.scale()
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


## lines of text in one box, apart by ";" (a PackedStringArray field)
func _lines(n: Object, prop: String, hint := "") -> LineEdit:
	var le := LineEdit.new()
	le.name = "F_" + prop
	le.text = "; ".join(HSLogicScan.lines(n.get(prop)))
	le.placeholder_text = hint
	var save := func() -> void:
		var lines := PackedStringArray()
		for part in le.text.split(";", false):
			if part.strip_edges() != "":
				lines.append(part.strip_edges())
		_put(n, prop, lines)
	le.text_submitted.connect(func(_x: String) -> void: save.call())
	le.focus_exited.connect(save)
	return le


## a condition as chips, with the scene's names in its menu and the ties it can make in one gesture
func _cond(n: Object, prop: String, none: String, links: Array = []) -> Control:
	var ce := CondEdit.new()
	ce.name = "F_" + prop
	ce.none = none
	ce.about_her = false
	ce.waits = false
	ce.groups = wiring.flag_groups(n as Node)
	ce.tasks = wiring.names("task")
	ce.items = wiring.names("item")
	ce.links = links
	ce.text = str(n.get(prop))
	ce.changed.connect(func(t: String) -> void: _put(n, prop, t))
	return ce


## flags switched as chips. `lines`: the field is a list of lines (a flag switch's Flags), else one text; `bare`: the
## lines are names with no sign (the Story's Flags Start: all of them on)
func _switches(n: Object, prop: String, lines := false, none := "no flags", bare := false) -> Control:
	var se := SwitchEdit.new()
	se.name = "F_" + prop
	se.none = none
	se.groups = wiring.flag_groups(n as Node)
	se.text = ", ".join(HSLogicScan.lines(n.get(prop))) if lines else str(n.get(prop))
	se.changed.connect(func(t: String) -> void:
		if lines:
			var out := PackedStringArray()
			for p in SwitchEdit.parts(t):
				out.append(String(p[1]) if bare else String(p[0]) + String(p[1]))
			_put(n, prop, out)
		else:
			_put(n, prop, t))
	return se


## a name typed, or picked from the scene's (`kind`: flag, task or item); `pre`: what the field writes before it
## (a door's lock: "flag:")
func _name(n: Object, prop: String, kind: String, hint := "") -> Control:
	var row := HBoxContainer.new()
	row.name = "F_" + prop
	var le := LineEdit.new()
	le.name = "Line"
	le.text = str(n.get(prop))
	le.placeholder_text = hint
	le.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	le.text_submitted.connect(func(t: String) -> void: _put(n, prop, t))
	le.focus_exited.connect(func() -> void: _put(n, prop, le.text))
	row.add_child(le)
	var mb := MenuButton.new()
	mb.name = "Menu"
	mb.flat = false
	mb.icon = Glyphs.icon("down", Color("#C8D2DC"), 12)
	mb.tooltip_text = "Pick one the scene already has."
	var pm := mb.get_popup()
	mb.about_to_popup.connect(func() -> void:
		pm.clear()
		pm.add_item("(none)")
		pm.set_item_metadata(0, "")
		if kind == "lock":
			for it in wiring.names("item"):
				pm.add_item("carrying %s" % it)
				pm.set_item_metadata(pm.item_count - 1, String(it))
			for f in wiring.names("flag"):
				pm.add_item("the flag %s" % f)
				pm.set_item_metadata(pm.item_count - 1, "flag:" + String(f))
			pm.add_item("never opens")
			pm.set_item_metadata(pm.item_count - 1, "flag:never")
		else:
			for nm in wiring.names(kind):
				pm.add_item(String(nm))
				pm.set_item_metadata(pm.item_count - 1, String(nm)))
	pm.index_pressed.connect(func(i: int) -> void:
		le.text = str(pm.get_item_metadata(i))
		_put(n, prop, le.text))
	row.add_child(mb)
	return row


## The field of a node drawn with the picker of its kind (HSLogicScan's encodings): chips for a condition and for
## flags switched, a name with the scene's names, lines in one box.
func field(n: Object, prop: String, enc: String) -> Control:
	match enc:
		"cond":
			return _cond(n, prop, "always")
		"switch":
			return _switches(n, prop)
		"switches":
			return _switches(n, prop, true)
		"flags":
			return _switches(n, prop, true, "none", true)
		"flag":
			return _name(n, prop, "flag", "a flag's name")
		"task":
			return _name(n, prop, "task", "a task's id")
		"item":
			return _name(n, prop, "item", "what it's called")
		"lock":
			return _name(n, prop, "lock", "an item's name, or flag:<name>")
		"conds":
			return _lines(n, prop, "a condition; another")
		"tasks":
			return _lines(n, prop, "id: what to do; another: ...")
		"task_flags":
			return _lines(n, prop, "key: +flag_on, -flag_off; added key: +flag")
		"rules":
			return _lines(n, prop, "flag => smile; => sad")
	return _text(n, prop)
