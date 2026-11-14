## A conversation on screen (docs/MARKERS.md §6.7), in the studio's own style for lines and choices (the user,
## DECISIONS 2026-10-30, evening: "go back to our original of --- between the choices ... close to the bottom of the
## frame, below the question; we don't want 1 or 2 to select: click with the mouse or move between the choices with A
## or D (or the arrow keys) + Enter"; and 2026-11-14, on a boxed panel this plugin first drew: "Keep it the prior
## style"). No panel: the speaker's name small, the line under it in the serif voice over a scrim that rises from the
## foot; the answers on one line under the question with a dash between, the one pointed at white and the others
## dimmed, no numbers, two at the most.
##     the lines      one after another, each for as long as it takes to read; E, Enter, Space or a click: the next now
##     the answers    A / D or the arrows move, Enter or Space picks, or a click on one (the mouse is freed for it)
## With an HSHud in the scene (the UI plugin's) all of it is that HUD's own: its `line`, its `choose`, its reticle's
## prompt. With none, this draws the same thing itself. It also shows the prompt over someone you can talk to and, in a
## game with no Story node, the line a marker says.
## One for the whole game, made the first time it's needed (`HSNpcTalkBox.of(tree)`); the runner of whoever is talked
## to starts it and hears `line_shown`, `answered` and `finished`.
##
## A line is "Alex: Looking for something?", or just the words (then it's hers), or "You: ..." for yours; "[smile]"
## in front wears that face while it's said.
class_name HSNpcTalkBox
extends CanvasLayer

signal line_shown(face: String, who: String, text: String)
signal answered(index: int)
signal finished(index: int)                # the answer picked, -1 when it had none

const NAME := "HSNpcTalkBox"
const UI_THEME := "res://addons/horrorstudio_ui/theme.gd"
const FOOT_REST := 150.0                   # the HUD's own numbers: the footer's bottom above the screen's foot, px
const FOOT_CHOOSING := 44.0                # and while the answers are up: low, the view above them clear
const DIM := 0.5                           # how much of the lines' brightness an answer not pointed at keeps
const GLASS := {"text": Color(1.0, 0.98, 0.94, 0.93), "muted": Color(1.0, 0.98, 0.94, 0.58), "who": Color("#f6f1e8"), "shadow": true, "font": "serif"}
const SERIF := ["Source Serif 4", "Noto Serif", "Georgia", "Liberation Serif", "DejaVu Serif", "Times New Roman", "Times", "serif"]

var open_now := false
var stage := ""                            ## "lines", "answers", "reply"
var selected := 0

var _conv := {}
var _who := ""
var _i := 0
var _reply: Array = []
var _answer := -1
var _opened := 0
var _left := -1.0                          # seconds the line on show still has (under 0: it stays)
var _gen := 0
var _now := {"who": "", "text": ""}
var _mouse_was := -1
var _hud_node: Node = null
var _hud_t := -100000
var _on_hud := false                       # this conversation is drawn by the scene's HUD
var _cursor_set := false
var _colors := {}
var _scrim: TextureRect
var _foot: VBoxContainer
var _who_l: Label
var _line_l: Label
var _row: HBoxContainer
var _ring: Control
var _prompt: VBoxContainer
var _verb_l: Label
var _name_l: Label
var _prompts := {}
var _prompt_state := ""
var _prompt_t := 0.0
var _caption_left := 0.0
var _scrim_tw: Tween


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


## how long a line stays before the next comes by itself: time to read it (E moves on sooner)
static func read_secs(text: String) -> float:
	return clampf(1.6 + 0.065 * text.length(), 2.4, 10.0)


## the ring the prompt sits beside (the HUD's reticle, open)
class Ring extends Control:
	var col := Color(1.0, 0.98, 0.94, 0.9)

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		size = Vector2(44, 44)
		custom_minimum_size = size

	func _draw() -> void:
		var c := size / 2.0
		draw_arc(c, 9.5, 0.0, TAU, 40, Color(0, 0, 0, 0.3), 3.6, true)
		draw_arc(c, 9.5, 0.0, TAU, 40, col, 1.5, true)


func _init() -> void:
	layer = 7
	_colors = GLASS.duplicate()
	if ResourceLoader.exists(UI_THEME):                    # the game's own theme, when the UI plugin is in the project
		var t = load(UI_THEME)
		if t != null and t.has_method("colors"):
			_colors = t.colors(str(ProjectSettings.get_setting("horrorstudio/ui/theme", "glass")))
	var root := Control.new()
	root.name = "Root"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	var g := Gradient.new()                                # the footer's scrim: rises from the foot while someone talks or asks
	g.offsets = PackedFloat32Array([0.0, 0.7, 1.0])
	g.colors = PackedColorArray([Color(0.016, 0.024, 0.04, 0.62), Color(0.016, 0.024, 0.04, 0.18), Color(0.016, 0.024, 0.04, 0.0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_LINEAR
	gt.fill_from = Vector2(0, 1)
	gt.fill_to = Vector2(0, 0)
	gt.width = 4
	gt.height = 256
	_scrim = TextureRect.new()
	_scrim.name = "Scrim"
	_scrim.texture = gt
	_scrim.stretch_mode = TextureRect.STRETCH_SCALE
	_scrim.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_scrim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scrim.anchor_left = 0.0
	_scrim.anchor_right = 1.0
	_scrim.anchor_top = 0.56
	_scrim.anchor_bottom = 1.0
	_scrim.modulate.a = 0.0
	root.add_child(_scrim)
	_foot = VBoxContainer.new()                            # who, the line, the answers: no panel
	_foot.name = "Footer"
	_foot.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_foot.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_foot.offset_top = -FOOT_REST
	_foot.offset_bottom = -FOOT_REST
	_foot.alignment = BoxContainer.ALIGNMENT_END
	_foot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_foot.visible = false
	root.add_child(_foot)
	_who_l = _label(14, _colors["who"], true)
	_who_l.name = "Who"
	_who_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_foot.add_child(_who_l)
	_line_l = _label(20, _colors["text"], false)
	_line_l.name = "Line"
	_line_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_line_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_foot.add_child(_line_l)
	var dock := CenterContainer.new()
	dock.name = "Dock"
	dock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_foot.add_child(dock)
	_row = HBoxContainer.new()                             # the answers as the dialogue's own words on one line, a dash between
	_row.name = "Choice"
	_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_row.add_theme_constant_override("separation", 6)
	_row.visible = false
	dock.add_child(_row)
	var under := _label(14, _colors["text"], false, false)   # (the HUD's footer ends in the name of what's in the hand, an empty line here: the same place on screen)
	under.name = "Under"
	_foot.add_child(under)
	_ring = Ring.new()                                     # the prompt: a ring, the verb right of it and who under the verb
	_ring.name = "Ring"
	_ring.col = Color(_colors["text"].r, _colors["text"].g, _colors["text"].b, 0.9)
	_ring.set_anchors_preset(Control.PRESET_CENTER)
	_ring.offset_left = -22.0
	_ring.offset_top = -22.0
	_ring.offset_right = 22.0
	_ring.offset_bottom = 22.0
	_ring.visible = false
	root.add_child(_ring)
	_prompt = VBoxContainer.new()
	_prompt.name = "Prompt"
	_prompt.set_anchors_preset(Control.PRESET_CENTER)
	_prompt.offset_left = 24.0
	_prompt.offset_top = -13.0
	_prompt.add_theme_constant_override("separation", -1)
	_prompt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_prompt.visible = false
	root.add_child(_prompt)
	_verb_l = _label(16, _colors["text"], false, false)
	_verb_l.name = "Verb"
	_prompt.add_child(_verb_l)
	_name_l = _label(12, _colors["muted"], false, false)
	_name_l.name = "ThingName"
	_prompt.add_child(_name_l)


# a label as the HUD's are: the theme's colour, a soft dark edge; `voice`: in the serif the lines are said in
func _label(px: int, col: Color, bold: bool, voice := true) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85 if _colors.get("shadow", true) else 0.0))
	l.add_theme_constant_override("shadow_offset_y", 1)
	l.add_theme_constant_override("shadow_outline_size", 2 if _colors.get("shadow", true) else 0)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var f := _serif(bold) if voice else null
	if f != null:
		l.add_theme_font_override("font", f)
	return l


func _serif(bold := false) -> Font:
	if str(_colors.get("font", "sans")) != "serif":
		return null
	if ResourceLoader.exists(UI_THEME):
		var t = load(UI_THEME)
		if t != null and t.has_method("serif"):
			return t.serif(_colors, false, bold)
	var f := SystemFont.new()
	f.font_names = PackedStringArray(SERIF)
	f.font_weight = 700 if bold else 400
	return f


## the scene's HUD (the UI plugin's HSHud), when it has one that's shown
func hud() -> Node:
	if _hud_node != null and is_instance_valid(_hud_node) and _hud_node.is_inside_tree():
		return _hud_node if (_hud_node as CanvasLayer).visible else null
	_hud_node = null
	if Time.get_ticks_msec() - _hud_t < 1000:              # (none a moment ago: not looked for again every frame)
		return null
	_hud_t = Time.get_ticks_msec()
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		var sc: Script = n.get_script()
		if sc != null and sc.get_global_name() == &"HSHud" and n.has_method("choose") and n.has_method("line"):
			_hud_node = n
			break
	return _hud_node if _hud_node != null and (_hud_node as CanvasLayer).visible else null


func lines() -> Array:
	return _conv.get("lines", [])


func options() -> Array:
	var out := []
	for a in _conv.get("answers", []):
		out.append(str(a.get("text", "")))
	return out


## what's on show now: {who, text, stage}
func showing() -> Dictionary:
	return {"who": _now["who"], "text": _now["text"], "stage": stage}


## a conversation started: {lines, answers: [{text, sets, face, reply}]}; `hers`: her name, for lines that name nobody
func start(conv: Dictionary, hers: String) -> void:
	if open_now:
		close()
	_conv = conv
	_who = hers
	_i = 0
	_answer = -1
	_reply = []
	selected = 0
	_gen += 1
	open_now = true
	_opened = Time.get_ticks_msec()
	_on_hud = hud() != null
	_prompt_show()
	if lines().is_empty() and options().is_empty():
		_finish(-1)
		return
	stage = "lines"
	_show()


# the line this point of the conversation is at; the last of them comes with the answers under it, as their question
func _show() -> void:
	var list: Array = _reply if stage == "reply" else lines()
	var line := str(list[mini(_i, list.size() - 1)]) if not list.is_empty() else ""
	var p := parse_line(line, _who) if line != "" else {"face": "", "who": "", "text": ""}
	_now = {"who": String(p["who"]), "text": String(p["text"])}
	var asks := stage == "lines" and not options().is_empty() and _i >= list.size() - 1
	if line != "":
		line_shown.emit(String(p["face"]), String(p["who"]), String(p["text"]))
	if asks:
		stage = "answers"
		_left = -1.0
		_ask()
		return
	_left = read_secs(String(p["text"]))
	if _on_hud and hud() != null:
		hud().line(_now["text"], _now["who"], _left + 0.5, false)
	else:
		_draw_line()


# ---- drawn here (a scene with no HUD) ------------------------------------------------------------------------------------------
func _draw_line() -> void:
	_who_l.text = _now["who"]
	_who_l.visible = _now["who"] != ""
	_line_l.text = _now["text"]
	_line_l.visible = _now["text"] != ""
	_foot.visible = true
	_foot.offset_bottom = -(FOOT_CHOOSING if stage == "answers" else FOOT_REST)
	_foot.offset_top = _foot.offset_bottom
	_fade_scrim(true)


func _fade_scrim(up: bool) -> void:
	if _scrim_tw != null and _scrim_tw.is_valid():
		_scrim_tw.kill()
	if not is_inside_tree():
		_scrim.modulate.a = 1.0 if up else 0.0
		return
	_scrim_tw = create_tween()
	_scrim_tw.tween_property(_scrim, "modulate:a", 1.0 if up else 0.0, 0.35)


func _draw_answers() -> void:
	for c in _row.get_children():
		_row.remove_child(c)
		c.queue_free()
	var opts := options()
	for i in opts.size():
		if i > 0:
			var dash := _label(18, _colors["text"], false)   # the dash between, as quiet as the dimmed answers
			dash.name = "Dash%d" % i
			dash.text = "—"
			dash.modulate = Color(1, 1, 1, DIM)
			_row.add_child(dash)
		var b := Button.new()
		b.name = "Opt%d" % i
		b.set_meta("label", opts[i])
		b.text = opts[i]
		b.alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.focus_mode = Control.FOCUS_NONE
		b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		b.add_theme_font_size_override("font_size", 18)
		var voice := _serif()
		if voice != null:
			b.add_theme_font_override("font", voice)
		b.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8 if _colors.get("shadow", true) else 0.0))
		b.add_theme_constant_override("outline_size", 4 if _colors.get("shadow", true) else 0)
		var pad := StyleBoxEmpty.new()                     # no box and no colour of its own
		pad.content_margin_left = 18
		pad.content_margin_right = 18
		pad.content_margin_top = 3
		pad.content_margin_bottom = 3
		for st in ["normal", "focus", "disabled", "hover", "pressed", "hover_pressed"]:
			b.add_theme_stylebox_override(st, pad)
		for fc in ["font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
			b.add_theme_color_override(fc, _colors["text"])
		b.mouse_entered.connect(select.bind(i))
		b.pressed.connect(pick.bind(i))
		_row.add_child(b)
	_row.visible = true
	_mark()


func _mark() -> void:
	var full: Color = _colors["text"]
	var dim := Color(full.r, full.g, full.b, full.a * DIM)
	var i := 0
	for c in _row.get_children():
		if c.has_meta("label"):
			for fc in ["font_color", "font_focus_color"]:
				(c as Button).add_theme_color_override(fc, full if i == selected else dim)   # the one pointed at as bright as the lines, the rest waiting dimmed
			i += 1


# ---- the answers ----------------------------------------------------------------------------------------------------------------
func _ask() -> void:
	selected = 0
	if _mouse_was < 0:                                     # the mouse freed to click an answer, and taken back after
		_mouse_was = int(Input.mouse_mode)
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var h := hud() if _on_hud else null
	if h == null:
		_draw_line()
		_draw_answers()
		return
	var gen := _gen
	var i = await h.choose({"prompt": _now["text"], "who": _now["who"], "options": options()})
	if gen == _gen and open_now and stage == "answers":
		_picked(int(i))


## another answer pointed at
func select(i: int) -> void:
	var n := options().size()
	if n == 0 or stage != "answers":
		return
	selected = clampi(i, 0, n - 1)
	var h := hud() if _on_hud else null
	if h != null and not bool(h.get("choice_over")):
		while int(h.get("choice_sel")) < selected:
			h.choice_key("D")
		while int(h.get("choice_sel")) > selected:
			h.choice_key("A")
	else:
		_mark()


## the answer pointed at, picked (Enter, Space)
func confirm() -> void:
	if stage == "answers":
		pick(selected)


## an answer picked
func pick(i: int) -> void:
	if not open_now or stage != "answers" or i < 0 or i >= options().size():
		return
	var h := hud() if _on_hud else null
	if h != null and not bool(h.get("choice_over")):
		h.choice_pick(i + 1)                               # (the HUD's own choice answers it: _ask hears it and goes on)
		return
	_picked(i)


func _picked(i: int) -> void:
	if not open_now or stage != "answers" or i < 0 or i >= options().size():
		return
	_answer = i
	_row.visible = false
	_mouse_back()
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


func _mouse_back() -> void:
	if _mouse_was >= 0:
		Input.mouse_mode = _mouse_was as Input.MouseMode
		_mouse_was = -1


## the next line now (E; a line's time running out does the same). While the answers are up it does nothing: an answer
## is picked with Enter, Space or a click, never by the key that hurries the lines along
func advance() -> void:
	if not open_now or stage == "answers":
		return
	var list: Array = _reply if stage == "reply" else lines()
	if _i < list.size() - 1:
		_i += 1
		_show()
	elif stage == "reply":
		_finish(_answer)
	else:
		_finish(-1)


func _finish(i: int) -> void:
	open_now = false
	stage = ""
	_gen += 1
	_left = -1.0
	_now = {"who": "", "text": ""}
	_mouse_back()
	_foot.visible = false
	_row.visible = false
	_fade_scrim(false)
	var h := hud() if _on_hud else null
	if h != null:
		if not bool(h.get("choice_over")):
			h.choice_pick(1)                               # (shut with its answers still up: the HUD's choice put away; nobody hears it)
		h.line("", "", 0.01, false)
	_on_hud = false
	_prompt_show()
	finished.emit(i)


## shut without an answer (she was shot, you died)
func close() -> void:
	if open_now:
		_finish(-1)


# ---- the prompt over someone you can talk to ------------------------------------------------------------------------------------
## `key` whoever asks; `verb` "" takes theirs away. The HUD's own reticle and prompt when the scene has a HUD
func prompt(key, verb: String, who := "") -> void:
	if key is Object:
		key = (key as Object).get_instance_id()            # (by its number: holding whoever asks would keep them alive after they're gone)
	if verb == "":
		if not _prompts.has(key):
			return                                         # (asked every frame: nothing changed, nothing done)
		_prompts.erase(key)
	else:
		if _prompts.has(key) and _prompts[key][0] == verb and _prompts[key][1] == who:
			return
		_prompts[key] = [verb, who]
	_prompt_show()


# where the prompt is drawn now: the scene's HUD when it has one, else here. Called whenever it may have changed (and
# a couple of times a second while one is up: a HUD can come and go); it does something only when it has
func _prompt_show() -> void:
	var up := not _prompts.is_empty() and not open_now
	var verb := ""
	var who := ""
	if up:
		var p: Array = _prompts.values()[0]
		verb = str(p[0])
		who = str(p[1])
	var h := hud() if is_inside_tree() else null
	var on_hud := h != null and h.has_method("set_cursor")
	var state := "%s|%s|%s|%s" % [up, on_hud, verb, who]
	if state == _prompt_state:
		return
	_prompt_state = state
	_verb_l.text = verb
	_name_l.text = who
	_name_l.visible = who != ""
	_ring.visible = up and not on_hud
	_prompt.visible = up and not on_hud
	if on_hud and up:
		h.set_cursor("use", verb, who)
		_cursor_set = true
	elif _cursor_set:
		if h != null and h.has_method("set_cursor"):
			h.set_cursor("none", "", null)
		_cursor_set = false


## the prompt shown now: "Talk Alex" ("" when none)
func prompt_text() -> String:
	if _prompts.is_empty() or open_now:
		return ""
	return ("%s %s" % [_verb_l.text, _name_l.text]).strip_edges()


## a line on screen for a while (a game with no Story node to say it), as the lines of a conversation are drawn
func caption(text: String, secs := 3.0) -> void:
	if open_now:
		return
	var h := hud() if is_inside_tree() else null
	if h != null:
		h.line(text, "", secs, false)
		return
	_who_l.visible = false
	_line_l.text = text
	_line_l.visible = text != ""
	_foot.visible = text != ""
	_foot.offset_bottom = -FOOT_REST
	_foot.offset_top = -FOOT_REST
	_fade_scrim(text != "")
	_caption_left = secs if text != "" else 0.0


func _process(dt: float) -> void:
	if not _prompts.is_empty() or _cursor_set:
		_prompt_t -= dt
		if _prompt_t <= 0.0:
			_prompt_t = 0.5
			_prompt_show()
	if _caption_left > 0.0 and not open_now:
		_caption_left -= dt
		if _caption_left <= 0.0:
			_foot.visible = false
			_fade_scrim(false)
	if open_now and _left > 0.0:
		_left -= dt
		if _left <= 0.0:
			advance()


func _input(event: InputEvent) -> void:
	if not open_now:
		return
	var key := event as InputEventKey
	var click := event as InputEventMouseButton
	if Time.get_ticks_msec() - _opened < 220:              # (the E that started it isn't the first thing it hears)
		if key != null or click != null:
			get_viewport().set_input_as_handled()
		return
	if stage == "answers":
		if key == null or not key.pressed:
			return                                         # (the mouse is the answers' own: a click on one picks it)
		get_viewport().set_input_as_handled()
		if key.echo:
			return
		match key.physical_keycode:
			KEY_A, KEY_LEFT:
				select(selected - 1)
			KEY_D, KEY_RIGHT:
				select(selected + 1)
			KEY_ENTER, KEY_KP_ENTER, KEY_SPACE:
				confirm()
		return
	if key != null:
		get_viewport().set_input_as_handled()
		if key.pressed and not key.echo and key.physical_keycode in [KEY_E, KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
			advance()
	elif click != null and click.pressed and click.button_index == MOUSE_BUTTON_LEFT:
		get_viewport().set_input_as_handled()
		advance()
