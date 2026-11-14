## A conversation on screen (docs/MARKERS.md §6.7): her lines one at a time, then the answers, then her reply.
## One box for the whole game, made the first time it's needed (`HSNpcTalkBox.of(tree)`); the runner of whoever is
## talked to starts it and hears `answered` and `finished`.
##     E, Enter, Space or a click      the next line; the answer picked
##     W / S, the arrows, the wheel    another answer          1 to 9   that answer at once
## Never timed: it waits for you. It also shows the prompt over someone you can talk to ("E  Talk to Alex") and, in a
## game with no Story node, the line a marker says.
##
## A line is "Alex: Looking for something?", or just the words (then it's hers), or "You: ..." for yours; "[smile]"
## in front wears that face while it's said.
class_name HSNpcTalkBox
extends CanvasLayer

signal line_shown(face: String, who: String, text: String)
signal answered(index: int)
signal finished(index: int)                # the answer picked, -1 when it had none

const NAME := "HSNpcTalkBox"
const ACCENT := Color(0.88, 0.64, 0.37)

var open_now := false
var stage := ""                            ## "lines", "answers", "reply"
var selected := 0

var _conv := {}
var _who := ""
var _i := 0
var _reply: Array = []
var _answer := -1
var _opened := 0
var _panel: PanelContainer
var _who_l: Label
var _text_l: Label
var _answers: VBoxContainer
var _hint: Label
var _prompt: PanelContainer
var _prompt_l: Label
var _prompts := {}
var _caption: Label
var _caption_left := 0.0


static func of(tree: SceneTree) -> HSNpcTalkBox:
	var n := tree.root.get_node_or_null(NAME)
	if n == null:
		n = HSNpcTalkBox.new()
		n.name = NAME
		tree.root.add_child(n)
	return n as HSNpcTalkBox


## a line read: {face, who, text}
static func parse_line(line: String, hers: String) -> Dictionary:
	var s := line.strip_edges()
	var face := ""
	if s.begins_with("["):
		var e := s.find("]")
		if e > 0:
			face = s.substr(1, e - 1).strip_edges()
			s = s.substr(e + 1).strip_edges()
	var who := hers
	var c := s.find(":")
	if c > 0 and c <= 22:
		var head := s.substr(0, c).strip_edges()
		if head.split(" ", false).size() <= 2 and head.length() > 0 and head[0] == head[0].to_upper() and not head[0].is_valid_int():
			who = head
			s = s.substr(c + 1).strip_edges()
	return {"face": face, "who": who, "text": s}


static func _box(bg: Color, radius := 10, pad := 16) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(pad)
	sb.border_color = Color(1, 1, 1, 0.08)
	sb.set_border_width_all(1)
	return sb


func _init() -> void:
	layer = 7
	var root := Control.new()
	root.name = "Root"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	_panel = PanelContainer.new()
	_panel.name = "Talk"
	_panel.add_theme_stylebox_override("panel", _box(Color(0.045, 0.045, 0.055, 0.84)))     # (not opaque: the room shows through)
	_panel.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_panel.offset_bottom = -56
	_panel.custom_minimum_size = Vector2(640, 0)
	_panel.visible = false
	root.add_child(_panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	_panel.add_child(col)
	_who_l = Label.new()
	_who_l.add_theme_font_size_override("font_size", 15)
	_who_l.add_theme_color_override("font_color", ACCENT)
	col.add_child(_who_l)
	_text_l = Label.new()
	_text_l.add_theme_font_size_override("font_size", 21)
	_text_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text_l.custom_minimum_size = Vector2(600, 0)
	col.add_child(_text_l)
	_answers = VBoxContainer.new()
	_answers.add_theme_constant_override("separation", 4)
	col.add_child(_answers)
	_hint = Label.new()
	_hint.add_theme_font_size_override("font_size", 12)
	_hint.add_theme_color_override("font_color", Color(1, 1, 1, 0.45))
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	col.add_child(_hint)
	_prompt = PanelContainer.new()
	_prompt.name = "Prompt"
	_prompt.add_theme_stylebox_override("panel", _box(Color(0.045, 0.045, 0.055, 0.72), 8, 8))
	_prompt.set_anchors_preset(Control.PRESET_CENTER)
	_prompt.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_prompt.offset_top = 46
	_prompt.offset_bottom = 46
	_prompt.visible = false
	root.add_child(_prompt)
	_prompt_l = Label.new()
	_prompt_l.add_theme_font_size_override("font_size", 15)
	_prompt.add_child(_prompt_l)
	_caption = Label.new()
	_caption.name = "Caption"
	_caption.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_caption.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_caption.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_caption.offset_bottom = -70
	_caption.add_theme_font_size_override("font_size", 20)
	_caption.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	_caption.add_theme_constant_override("outline_size", 5)
	_caption.visible = false
	root.add_child(_caption)


func lines() -> Array:
	return _conv.get("lines", [])


func options() -> Array:
	var out := []
	for a in _conv.get("answers", []):
		out.append(str(a.get("text", "")))
	return out


## what's on the box now: {who, text}
func showing() -> Dictionary:
	return {"who": _who_l.text, "text": _text_l.text, "stage": stage}


## a conversation started: {lines, answers: [{text, sets, face, reply}]}; `hers`: her name, for lines that name nobody
func start(conv: Dictionary, hers: String) -> void:
	_conv = conv
	_who = hers
	_i = 0
	_answer = -1
	_reply = []
	selected = 0
	open_now = true
	_opened = Time.get_ticks_msec()
	_panel.visible = true
	_prompt.visible = false
	stage = "lines" if not lines().is_empty() else "answers"
	if lines().is_empty() and options().is_empty():
		_finish(-1)
		return
	_show()


func _show() -> void:
	for c in _answers.get_children():
		_answers.remove_child(c)
		c.queue_free()
	var line := ""
	if stage == "reply":
		line = str(_reply[_i])
	elif not lines().is_empty():
		line = str(lines()[mini(_i, lines().size() - 1)])
	var p := parse_line(line, _who)
	_who_l.text = p["who"]
	_who_l.visible = p["who"] != "" and line != ""
	_text_l.text = p["text"]
	_text_l.visible = line != ""
	if stage == "answers":
		var opts := options()
		for i in opts.size():
			var b := Button.new()
			b.name = "Answer%d" % i
			b.text = "%d   %s" % [i + 1, opts[i]]
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
			b.focus_mode = Control.FOCUS_NONE
			b.add_theme_font_size_override("font_size", 19)
			b.pressed.connect(pick.bind(i))
			b.mouse_entered.connect(func(): select(i))
			_answers.add_child(b)
		_mark()
		_hint.text = "W / S  choose      E  answer"
	else:
		_hint.text = "E  next"
		if stage != "answers":
			line_shown.emit(String(p["face"]), String(p["who"]), String(p["text"]))


func _mark() -> void:
	var i := 0
	for b in _answers.get_children():
		var on := i == selected
		var sb := _box(Color(1, 1, 1, 0.13) if on else Color(1, 1, 1, 0.0), 6, 7)
		for st in ["normal", "hover", "pressed", "focus"]:
			(b as Button).add_theme_stylebox_override(st, sb)
		(b as Button).add_theme_color_override("font_color", Color(1, 1, 1, 1.0 if on else 0.6))
		i += 1


func select(i: int) -> void:
	var n := options().size()
	if n == 0:
		return
	selected = posmod(i, n)
	_mark()


## the next line (or, at the last, the answers)
func advance() -> void:
	if not open_now:
		return
	if stage == "lines":
		if _i < lines().size() - 1:
			_i += 1
			_show()
		elif not options().is_empty():
			stage = "answers"
			_show()
		else:
			_finish(-1)
	elif stage == "reply":
		if _i < _reply.size() - 1:
			_i += 1
			_show()
		else:
			_finish(_answer)
	elif stage == "answers":
		pick(selected)


func pick(i: int) -> void:
	if not open_now or stage != "answers" or i < 0 or i >= options().size():
		return
	_answer = i
	answered.emit(i)
	_reply = []
	for l in str((_conv["answers"][i] as Dictionary).get("reply", "")).split("\n", false):
		if l.strip_edges() != "":
			_reply.append(l)
	if _reply.is_empty():
		_finish(i)
	else:
		stage = "reply"
		_i = 0
		_show()


func _finish(i: int) -> void:
	open_now = false
	stage = ""
	_panel.visible = false
	finished.emit(i)


## shut without an answer (she was shot, you died)
func close() -> void:
	if open_now:
		_finish(-1)


## the prompt over someone you can talk to: `key` whoever asks, `text` "" to take theirs away
func prompt(key, text: String) -> void:
	if text == "":
		_prompts.erase(key)
	else:
		_prompts[key] = text
	_prompt.visible = not _prompts.is_empty() and not open_now
	if not _prompts.is_empty():
		_prompt_l.text = str(_prompts.values()[0])


## the prompt shown now ("" when none)
func prompt_text() -> String:
	return _prompt_l.text if _prompt.visible else ""


## a line on screen for a while (a game with no Story node to say it)
func caption(text: String, secs := 3.0) -> void:
	_caption.text = text
	_caption.visible = text != ""
	_caption_left = secs


func _process(dt: float) -> void:
	if _caption_left > 0.0:
		_caption_left -= dt
		if _caption_left <= 0.0:
			_caption.visible = false


func _input(event: InputEvent) -> void:
	if not open_now:
		return
	if Time.get_ticks_msec() - _opened < 220:              # (the E that started it isn't its first answer)
		if event is InputEventKey or event is InputEventMouseButton:
			get_viewport().set_input_as_handled()
		return
	var act := ""
	if event is InputEventKey and event.pressed and not event.echo:
		match (event as InputEventKey).physical_keycode:
			KEY_E, KEY_ENTER, KEY_KP_ENTER, KEY_SPACE:
				act = "go"
			KEY_W, KEY_UP:
				act = "up"
			KEY_S, KEY_DOWN:
				act = "down"
			_:
				var k := int((event as InputEventKey).physical_keycode)
				if k >= KEY_1 and k <= KEY_9 and stage == "answers":
					pick(k - KEY_1)
					get_viewport().set_input_as_handled()
					return
	elif event is InputEventMouseButton and event.pressed:
		match (event as InputEventMouseButton).button_index:
			MOUSE_BUTTON_LEFT:
				act = "go" if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else ""
			MOUSE_BUTTON_WHEEL_UP:
				act = "up"
			MOUSE_BUTTON_WHEEL_DOWN:
				act = "down"
	if act == "":
		if event is InputEventKey:
			get_viewport().set_input_as_handled()
		return
	get_viewport().set_input_as_handled()
	if act == "go":
		advance()
	elif stage == "answers":
		select(selected + (-1 if act == "up" else 1))
