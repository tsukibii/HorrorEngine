## The eye picker (eyes v3; docs/GODOT_LOOK.md §5v, DECISIONS 2026-11-12, eyes v3: "make it easy to modify some things
## via sliders (different iris shape / patterns, colors etc)"): a panel of sliders for a character's eyes, working on
## her HSEyePaint. A look to start from (the ready-made eye looks, yours, the Studio's eye styles), the iris's colours,
## its pattern, the pupil's shape, and a slider for every number that reads in a game (the iris's and the pupil's size,
## the pattern, the limbal ring, the white, the catchlights that stay); one eye or both; Her own eyes; Save as eyes (an
## HSEyeLook .tres in `res://looks/eyes/`, for an HSCharacterLook's Eye Look) and Copy as code.
## It's the right side of the look viewer (tools/look_viewer.tscn: its Eyes button), and over a running game:
## `HSEyePicker.toggle(tree, character)`.
class_name HSEyePicker
extends PanelContainer

signal changed(key: String, value)                ## something was set
signal saved(path: String)

const LAYER := "HSEyePickerLayer"
## the sliders in their sections (HSEyePaint.CONTROLS' keys)
const SECTIONS := [
	["Iris", ["irisSize", "pupil", "pupilTurn", "patternAmt", "burst", "detail", "fibres", "limbal", "limbalWidth", "limbalSoft", "irisBright", "caustic"]],
	["White", ["whiteBright", "whiteWarm", "veins", "cornerPink", "scleraShade", "gloss"]],
	["Catchlights", ["catchKeep", "catch1", "catchSize", "catchX", "catchY", "catch2", "catch2Size", "catch2X", "catch2Y", "catchLine", "catchRoom", "catchGlow"]]]
var save_dir := HSEyeLook.SAVED
var who: Node = null
var painter: HSEyePaint = null
var side := "both"
var _ui := {}
var _starts: Array = []                           # the Start from list: [kind, key] an entry
var _quiet := false


## over the running game: the eye picker for a character (the first with the Studio's eyes when none is given), or (it's
## up) closed; the mouse freed while it's up
static func toggle(tree: SceneTree, character: Node = null) -> HSEyePicker:
	var old := tree.root.get_node_or_null(LAYER)
	if old != null:
		Input.mouse_mode = old.get_meta("mouse", Input.MOUSE_MODE_VISIBLE)
		old.queue_free()
		return null
	if character == null:
		for n in tree.root.find_children("*", "HSEyePaint", true, false):
			character = n.get_parent()
			break
	if character == null:
		for n in tree.root.find_children("*", "HSCharacterLook", true, false):
			if HSEyePaint.attach(n.character()) != null:
				character = n.character()
				break
	var layer := CanvasLayer.new()
	layer.name = LAYER
	layer.layer = 121
	layer.set_meta("mouse", Input.mouse_mode)
	tree.root.add_child(layer)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE)
	scroll.offset_left = -352
	scroll.offset_right = -12
	scroll.offset_top = 12
	scroll.offset_bottom = -12
	layer.add_child(scroll)
	var p := HSEyePicker.new()
	scroll.add_child(p)
	p.setup(character)
	return p


func _init() -> void:
	custom_minimum_size = Vector2(326, 0)
	var back := StyleBoxFlat.new()                    # a panel of its own: readable over any game
	back.bg_color = Color(0.07, 0.07, 0.08, 0.94)
	back.set_corner_radius_all(6)
	back.set_content_margin_all(10)
	add_theme_stylebox_override("panel", back)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 5)
	add_child(box)
	_ui["box"] = box
	box.add_child(_label("Eyes", true))
	# ---- a look to start from, which eye
	var start := OptionButton.new()
	start.item_selected.connect(func(i):
		if i > 0:
			start_from(_starts[i][0], _starts[i][1])
		start.select(0))
	box.add_child(start)
	_ui["start"] = start
	var row := HBoxContainer.new()
	box.add_child(row)
	row.add_child(_label("Which eye"))
	var sd := OptionButton.new()
	for s in ["both", "L", "R"]:
		sd.add_item(s)
	sd.item_selected.connect(func(i):
		side = sd.get_item_text(i)
		_load())
	row.add_child(sd)
	_ui["side"] = sd
	var own := Button.new()
	own.text = "Her own eyes"
	own.pressed.connect(reset)
	row.add_child(own)
	# ---- the colours, the pattern and the pupil
	box.add_child(_label("Colours", true))
	for c in HSEyePaint.COLOURS:
		var cr := HBoxContainer.new()
		box.add_child(cr)
		var l := _label(c[1])
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cr.add_child(l)
		var b := ColorPickerButton.new()
		b.edit_alpha = false
		b.custom_minimum_size = Vector2(64, 24)
		var key: String = c[0]
		b.color_changed.connect(func(v): set_value(key, "#" + Color(v.r, v.g, v.b).to_html(false)))
		cr.add_child(b)
		_ui[key] = b
	for ch in HSEyePaint.CHOICES:
		var hr := HBoxContainer.new()
		box.add_child(hr)
		var l := _label(ch[1])
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hr.add_child(l)
		var o := OptionButton.new()
		for it in ch[2]:
			o.add_item(str(it))
		var key: String = ch[0]
		o.item_selected.connect(func(i): set_value(key, o.get_item_text(i)))
		hr.add_child(o)
		_ui[key] = o
	# ---- the sliders
	var by_key := {}
	for c in HSEyePaint.CONTROLS:
		by_key[c[0]] = c
	for sec in SECTIONS:
		box.add_child(_label(sec[0], true))
		for key in sec[1]:
			var c: Array = by_key[key]
			var sr := HBoxContainer.new()
			box.add_child(sr)
			var l := _label(c[1])
			l.custom_minimum_size = Vector2(132, 0)
			l.clip_text = true
			sr.add_child(l)
			var s := HSlider.new()
			s.min_value = c[2]
			s.max_value = c[3]
			s.step = c[4]
			s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			var num := _label("")
			num.custom_minimum_size = Vector2(40, 0)
			num.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			var k: String = key
			s.value_changed.connect(func(v):
				num.text = _num(v)
				set_value(k, v))
			sr.add_child(s)
			sr.add_child(num)
			_ui[key] = s
			_ui[key + "_num"] = num
	# ---- keeping it
	box.add_child(_label("Keep it", true))
	var keep := HBoxContainer.new()
	box.add_child(keep)
	var nm := LineEdit.new()
	nm.placeholder_text = "a name: violet"
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	keep.add_child(nm)
	_ui["name"] = nm
	var sv := Button.new()
	sv.text = "Save as eyes"
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


func _num(v: float) -> String:
	return ("%.0f" % v) if absf(v) >= 20.0 else ("%.2f" % v)


func _say(text: String) -> void:
	_ui["status"].text = text


## the character it works on: her painter found (or made), the controls set to her eyes as they are
func setup(character: Node) -> void:
	who = character
	painter = HSEyePaint.attach(character) if character != null else null
	_fill_starts()
	if painter == null:
		_say("No eyes on the Studio's eye here: a Character Studio export under an HSCharacterLook (or HSEye.wear) has them.")
		return
	_load()
	_say("Her eyes as they are: every slider changes them now.")


## the Start from list: the eye looks (ready-made and saved), then the Studio's eye styles
func _fill_starts() -> void:
	var start: OptionButton = _ui["start"]
	start.clear()
	_starts = [["", ""]]
	start.add_item("Start from…")
	var looks := HSEyeLook.all()
	for t in looks:
		start.add_item(str(t))
		_starts.append(["look", looks[t]])
	for k in HSEyePaint.STYLES:
		start.add_item("%s (iris)" % HSEyePaint.STYLES[k][0])
		_starts.append(["style", k])


## the controls set to her eye's numbers (nothing sent to her)
func _load() -> void:
	if painter == null:
		return
	_quiet = true
	var p := painter.paint("L" if side == "both" else side)
	for c in HSEyePaint.COLOURS:
		if Color.html_is_valid(str(p.get(c[0], ""))):
			_ui[c[0]].color = Color.html(str(p[c[0]]))
	for ch in HSEyePaint.CHOICES:
		var o: OptionButton = _ui[ch[0]]
		for i in o.item_count:
			if o.get_item_text(i) == str(p.get(ch[0], "")):
				o.select(i)
	for c in HSEyePaint.CONTROLS:
		if _ui.has(c[0]):
			_ui[c[0]].set_value_no_signal(float(p.get(c[0], 0.0)))
			_ui[c[0] + "_num"].text = _num(float(p.get(c[0], 0.0)))
	_quiet = false


## one of her eyes' numbers set (what every control calls): her eyes change now
func set_value(key: String, value) -> void:
	if _quiet or painter == null:
		return
	painter.set_paint({key: value}, side)
	changed.emit(key, value)


## an eye look's file ("look") or one of the Studio's eye styles ("style") onto her eyes; the controls follow
func start_from(kind: String, key: String) -> void:
	if painter == null:
		return
	if kind == "look":
		var r = load(key)
		if r is HSEyeLook:
			painter.set_paint(r.paint, side)
			_say("%s%s" % [r.title, (": " + r.about) if r.about != "" else ""])
	elif kind == "style" and HSEyePaint.STYLES.has(key):
		painter.use_style(key, side)
		_say("%s: %s" % [HSEyePaint.STYLES[key][0], HSEyePaint.STYLES[key][1]])
	_load()
	changed.emit("", null)


## her own eyes again (the export's)
func reset() -> void:
	if painter == null:
		return
	painter.reset(side)
	_load()
	_say("Her own eyes.")
	changed.emit("", null)


## what differs from her own eyes, kept as an HSEyeLook: `<save_dir>/<name>.tres`; returns the file's path ("" when
## it has no name or can't be written)
func save_as(look_name: String) -> String:
	var nm := look_name.strip_edges()
	if nm == "" or painter == null:
		_say("Give it a name first.")
		return ""
	var l := HSEyeLook.make(nm, painter.changes("L" if side == "both" else side))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(save_dir))
	var path := save_dir.path_join(nm.validate_filename().replace(" ", "_") + ".tres")
	var err := ResourceSaver.save(l, path)
	if err != OK:
		_say("Couldn't write %s (error %d)." % [path, err])
		return ""
	_fill_starts()
	_say("Saved %s: drag it onto an HSCharacterLook's Eye Look." % path)
	saved.emit(path)
	return path


## her eyes as they are, as one line of GDScript for an event of your own
func code() -> String:
	if painter == null:
		return ""
	var ch := painter.changes("L" if side == "both" else side)
	if ch.is_empty():
		return "HSEyePaint.attach($Her).reset()"
	var parts: PackedStringArray = []
	for k in ch:
		parts.append('"%s": %s' % [k, var_to_str(ch[k])])
	return "HSEyePaint.attach($Her).set_paint({%s}%s)" % [", ".join(parts), "" if side == "both" else ', "%s"' % side]
