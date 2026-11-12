## The look picker (docs/GODOT_LOOK.md §5r): a panel to toggle a character's skin and eyes by hand. Every skin (her own,
## the creature skins, the cloak) and every eye look (her own, HSEyeFx's) as two lists, their amounts and colours, the
## cloak's two words, how long a turn takes; her named looks (her HSLookSwitch's list) as buttons with Default first;
## Save as a look (an HSLookPreset .tres in `save_dir`, added to her switch's list) and Copy as code. What it sets goes
## to her HSLookSwitch (`show`), so what you see is what an event or a quest will turn her to.
## It's the left side of the look viewer (tools/look_viewer.tscn), and over a running game: `HSLookPicker.toggle(tree)`
## (an HSLookSwitch's `panel_key`, F8 in a debug build) for every switch in the scene.
class_name HSLookPicker
extends PanelContainer

signal picked(words: Dictionary)                  ## something was set: the look as it is now
signal saved(path: String)

const LAYER := "HSLookPickerLayer"
var save_dir := "res://looks"
var switches: Array = []
var sw: HSLookSwitch = null
var words: Dictionary = HSLookPreset.new().words()     # the look being set
var secs := 0.4
var _ui := {}
var _quiet := false


## over the running game: the picker for every HSLookSwitch in the scene, or (it's up) closed; the mouse freed while it's up
static func toggle(tree: SceneTree) -> HSLookPicker:
	var old := tree.root.get_node_or_null(LAYER)
	if old != null:
		Input.mouse_mode = old.get_meta("mouse", Input.MOUSE_MODE_VISIBLE)
		old.queue_free()
		return null
	var layer := CanvasLayer.new()
	layer.name = LAYER
	layer.layer = 120
	layer.set_meta("mouse", Input.mouse_mode)
	tree.root.add_child(layer)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var p := HSLookPicker.new()
	layer.add_child(p)
	p.position = Vector2(12, 12)
	p.setup(tree.get_nodes_in_group(HSLookSwitch.GROUP))
	return p


func _init() -> void:
	custom_minimum_size = Vector2(300, 0)
	var back := StyleBoxFlat.new()                    # a panel of its own: readable over any game
	back.bg_color = Color(0.07, 0.07, 0.08, 0.94)
	back.set_corner_radius_all(6)
	back.set_content_margin_all(10)
	add_theme_stylebox_override("panel", back)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	add_child(box)
	_ui["box"] = box
	box.add_child(_label("Looks", true))
	var who := OptionButton.new()
	who.item_selected.connect(func(i): _choose(i))
	box.add_child(who)
	_ui["who"] = who
	var named := HFlowContainer.new()
	box.add_child(named)
	_ui["named"] = named
	# ---- skin
	box.add_child(_label("Skin", true))
	_ui["skin"] = _options(box, HSLookPreset.SKINS, func(v): pick("skin", v))
	_ui["skin_amount"] = _slider(box, "How much", func(v): pick("skin_amount", v))
	_ui["skin_tint"] = _colour(box, "Its colour", "skin_tint")
	_ui["skin_extend"] = _check(box, "Her horns and ears too", true, func(v): pick("skin_extend", v))
	# ---- eyes
	box.add_child(_label("Eyes", true))
	_ui["eyes"] = _options(box, HSLookPreset.EYES, func(v): pick("eyes", v))
	_ui["eye_amount"] = _slider(box, "How much", func(v): pick("eye_amount", v))
	_ui["eye_color"] = _colour(box, "Its colour", "eye_color")
	_ui["eye_side"] = _options(box, ["both", "L", "R"], func(v): pick("eye_side", v))
	# ---- the cloak's words
	box.add_child(_label("Under the cloak", true))
	_ui["eyes_show"] = _check(box, "Her eyes left to see", false, func(v): pick("eyes_show", v))
	_ui["shadow"] = _check(box, "She still casts a shadow", false, func(v): pick("shadow", v))
	# ---- the turn, and keeping it
	var row := HBoxContainer.new()
	box.add_child(row)
	row.add_child(_label("A turn takes (s)"))
	var sb := SpinBox.new()
	sb.min_value = 0.0
	sb.max_value = 5.0
	sb.step = 0.1
	sb.value = secs
	sb.value_changed.connect(func(v): secs = v)
	row.add_child(sb)
	_ui["secs"] = sb
	box.add_child(_label("Keep it", true))
	var keep := HBoxContainer.new()
	box.add_child(keep)
	var nm := LineEdit.new()
	nm.placeholder_text = "a name: angry"
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	keep.add_child(nm)
	_ui["name"] = nm
	var sv := Button.new()
	sv.text = "Save as a look"
	sv.pressed.connect(func(): save_as(nm.text))
	keep.add_child(sv)
	var cp := Button.new()
	cp.text = "Copy as code"
	cp.pressed.connect(func():
		DisplayServer.clipboard_set(code())
		_say("Copied: " + code()))
	box.add_child(cp)
	var st := _label("")
	st.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(st)
	_ui["status"] = st


func _label(text: String, head := false) -> Label:
	var l := Label.new()
	l.text = text
	if head:
		l.add_theme_color_override("font_color", Color(0.88, 0.64, 0.37))
	return l


func _options(parent: Node, items: Array, on: Callable) -> OptionButton:
	var o := OptionButton.new()
	for it in items:
		o.add_item(str(it))
	o.item_selected.connect(func(i): on.call(o.get_item_text(i)))
	parent.add_child(o)
	return o


func _slider(parent: Node, text: String, on: Callable) -> HSlider:
	var row := HBoxContainer.new()
	parent.add_child(row)
	row.add_child(_label(text))
	var s := HSlider.new()
	s.min_value = 0.0
	s.max_value = 1.0
	s.step = 0.01
	s.value = 1.0
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.value_changed.connect(func(v): on.call(v))
	row.add_child(s)
	return s


func _check(parent: Node, text: String, on: bool, cb: Callable) -> CheckBox:
	var c := CheckBox.new()
	c.text = text
	c.button_pressed = on
	c.toggled.connect(func(v): cb.call(v))
	parent.add_child(c)
	return c


## a colour and "the look's own" beside it (its own: a see-through colour, which the looks read as theirs)
func _colour(parent: Node, text: String, key: String) -> ColorPickerButton:
	var row := HBoxContainer.new()
	parent.add_child(row)
	row.add_child(_label(text))
	var own := CheckBox.new()
	own.text = "the look's own"
	own.button_pressed = true
	var c := ColorPickerButton.new()
	c.color = Color(1, 0.1, 0.05)
	c.edit_alpha = false
	c.custom_minimum_size = Vector2(48, 24)
	c.color_changed.connect(func(v):
		own.set_pressed_no_signal(false)
		pick(key, Color(v.r, v.g, v.b, 1.0)))
	own.toggled.connect(func(v): pick(key, Color(0, 0, 0, 0) if v else Color(c.color.r, c.color.g, c.color.b, 1.0)))
	row.add_child(c)
	row.add_child(own)
	_ui[key + "_own"] = own
	return c


func _say(text: String) -> void:
	_ui["status"].text = text


## the switches it works on (the first is shown; the list at the top picks another)
func setup(list: Array) -> void:
	switches = []
	for s in list:
		if s is HSLookSwitch and is_instance_valid(s):
			switches.append(s)
	var who: OptionButton = _ui["who"]
	who.clear()
	for s in switches:
		var t: Node = s.character()
		who.add_item(str(t.name) if t != null else str(s.name))
	who.visible = switches.size() > 1
	if switches.is_empty():
		_say("No HSLookSwitch in this scene: put one under a character.")
		sw = null
		return
	_choose(0)


func _choose(i: int) -> void:
	sw = switches[i]
	_named()
	var w: Dictionary = sw.wearing()
	if not w.is_empty():                              # what she wears now, into the controls
		for k in ["skin_amount", "eye_amount"]:
			if float(w[k]) <= 0.0:
				w[k] = 1.0
		_load(w)
	_say(("She's in '%s': %s." % [sw.current(), HSLookPreset.make(w).says()]) if sw.current() != "" else "She's in her default look.")


func _named() -> void:
	var named: HFlowContainer = _ui["named"]
	for c in named.get_children():
		c.queue_free()
	var d := Button.new()
	d.text = "Default"
	d.pressed.connect(func(): choose_look(""))
	named.add_child(d)
	for n in (sw.names() if sw != null else PackedStringArray()):
		var b := Button.new()
		b.text = n
		b.pressed.connect(func(): choose_look(n))
		named.add_child(b)


## the controls set to a look's words (nothing sent to her)
func _load(w: Dictionary) -> void:
	_quiet = true
	for k in HSLookPreset.KEYS:
		if w.has(k):
			words[k] = w[k]
	for k in ["skin", "eyes", "eye_side"]:
		var o: OptionButton = _ui[k]
		for i in o.item_count:
			if o.get_item_text(i) == str(words[k]):
				o.select(i)
	_ui["skin_amount"].set_value_no_signal(float(words["skin_amount"]))
	_ui["eye_amount"].set_value_no_signal(float(words["eye_amount"]))
	for k in ["skin_extend", "eyes_show", "shadow"]:
		_ui[k].set_pressed_no_signal(bool(words[k]))
	for k in ["skin_tint", "eye_color"]:
		var c: Color = words[k]
		_ui[k + "_own"].set_pressed_no_signal(c.a <= 0.0)
		if c.a > 0.0:
			_ui[k].color = c
	_quiet = false


## one of her named looks ("" her default): she turns to it, the controls follow
func choose_look(look_name: String) -> void:
	if sw == null:
		return
	var p: HSLookPreset = sw.preset(look_name) if look_name != "" else HSLookPreset.new()
	if p == null:
		return
	_load(p.words())
	words["name"] = ""
	if look_name == "":
		sw.default(secs)
	else:
		sw.set_look(look_name, secs)
	_say(("'%s': %s" % [look_name, p.says()]) if look_name != "" else "Her default look.")
	picked.emit(words.duplicate())


## one word of the look set (skin, eyes, eye_color...): she turns to the look as it now is
func pick(key: String, value) -> void:
	words[key] = value
	if _quiet:
		return
	_load(words)
	if sw != null:
		var w := words.duplicate()
		w["name"] = ""
		w["needs"] = ""
		sw.show(w, secs)
	_say(HSLookPreset.make(words).says())
	picked.emit(words.duplicate())


## the look as it is, kept as an HSLookPreset: `<save_dir>/<name>.tres`, and in her switch's list (a look of that name
## there is replaced); returns the file's path ("" when it has no name or can't be written)
func save_as(look_name: String) -> String:
	var nm := look_name.strip_edges()
	if nm == "" or nm == "default" or nm == "next":
		_say("Give it a name first (not default or next).")
		return ""
	var w := words.duplicate()
	w["name"] = nm
	var p := HSLookPreset.make(w)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(save_dir))
	var path := save_dir.path_join(nm.validate_filename().replace(" ", "_") + ".tres")
	var err := ResourceSaver.save(p, path)
	if err != OK:
		_say("Couldn't write %s (error %d)." % [path, err])
		return ""
	if sw != null:
		var at := -1
		for i in sw.looks.size():
			if sw.looks[i] != null and sw.looks[i].name == nm:
				at = i
		if at >= 0:
			sw.looks[at] = p
		else:
			sw.looks.append(p)
		_named()
	_say("Saved %s: drag it into an HSLookSwitch's Looks." % path)
	saved.emit(path)
	return path


## the look as one line of GDScript for an event of your own
func code() -> String:
	var d := HSLookPreset.new().words()
	var parts: PackedStringArray = []
	for k in HSLookPreset.KEYS:
		if k == "name" or k == "needs" or k == "seconds" or words[k] == d[k]:
			continue
		var v = words[k]
		parts.append('"%s": %s' % [k, ("Color(%.2f, %.2f, %.2f)" % [v.r, v.g, v.b]) if v is Color else var_to_str(v)])
	return "$Her/HSLookSwitch.show({%s}, %.1f)" % [", ".join(parts), secs] if not parts.is_empty() else "$Her/HSLookSwitch.default(%.1f)" % secs
