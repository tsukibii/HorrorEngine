@icon("res://addons/horrorstudio_devices/icons/laptop.svg")
class_name HSTerminal
extends Control
## The laptop's screen (HSLaptop makes it in a SubViewport and shows it on the glass; DECISIONS 2026-11-10): a green
## terminal of tabs. Its header (the system's name, the tabs, the cash, the clock), the tab that's up, a status line
## typed at its foot with LOG OFF beside it, the pointer drawn in its own green, the rain behind; the boot's lines the
## first time it wakes, the rain alone while it sleeps. Its tabs: HOME, ORDER (HSOrderTab: the shop) and LOG; your own
## with add_tab(name, control). Everything outside it (the cash, an order, the sounds) it asks its laptop for.

signal tab_changed(name: String)

const Rain := preload("res://addons/horrorstudio_devices/terminal/rain.gd")
const OrderTab := preload("res://addons/horrorstudio_devices/terminal/order_tab.gd")

var laptop: Node                                    # the HSLaptop it's on
var look: HSTerminalLook
var awake := false
var tabs := {}                                      # name -> its Control
var tab_buttons := {}                               # name -> its Button
var current := ""
var order: Control                                  # the Order tab
var log_lines: PackedStringArray = []
var _rain: Control
var _frame: Control
var _body: Control
var _bar: HBoxContainer
var _boot: Label
var _idle: Label
var _status: Label
var _status_text := ""
var _status_t := 0.0
var _cash_label: Label
var _clock_label: Label
var _pointer: Control
var _home: Label
var _log_label: Label
var _booted := false
var _boot_lines: PackedStringArray = []
var _boot_t := -1.0
var _blink := 0.0
var _group := ButtonGroup.new()


class Pointer:
	extends Control
	var ink := Color.GREEN
	var paper := Color.BLACK

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		size = Vector2(28, 34)

	func _draw() -> void:
		var s := 1.4
		var p := PackedVector2Array([Vector2(0, 0), Vector2(0, 17), Vector2(4, 13), Vector2(7, 20), Vector2(10, 19), Vector2(7, 12),
				Vector2(12, 12)])
		for i in p.size():
			p[i] *= s
		draw_colored_polygon(p, ink)
		draw_polyline(p + PackedVector2Array([p[0]]), paper, 2.0)


func setup(lt: Node, lk: HSTerminalLook) -> void:
	laptop = lt
	look = lk
	_build()


func _build() -> void:
	theme = _make_theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS
	var bg := ColorRect.new()
	bg.color = look.paper
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	_rain = Rain.new()
	_rain.font = look.font_or_default()
	_rain.px = int(look.text_px * 0.75)
	_rain.ink = look.ink
	_rain.hot = look.hot
	_rain.glyphs = look.glyphs
	_rain.amount = look.rain_idle
	_rain.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_rain)
	_idle = _label("[ %s ]" % str(laptop.get("system_name")), look.dim)
	_idle.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_idle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_idle.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_idle.grow_vertical = Control.GROW_DIRECTION_BOTH
	add_child(_idle)
	var m := MarginContainer.new()
	m.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		m.add_theme_constant_override("margin_" + side, 16)
	m.visible = false
	add_child(m)
	_frame = m
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	m.add_child(col)
	_bar = HBoxContainer.new()
	_bar.add_theme_constant_override("separation", 10)
	col.add_child(_bar)
	var title := _label(str(laptop.get("system_name")), look.hot)
	_bar.add_child(title)
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(10, 0)
	_bar.add_child(gap)
	var spring := Control.new()
	spring.name = "Spring"
	spring.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_bar.add_child(spring)
	_cash_label = _label("", look.ink)
	_bar.add_child(_cash_label)
	_clock_label = _label("", look.dim)
	_bar.add_child(_clock_label)
	col.add_child(_rule(look.dim))
	_body = Control.new()
	_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.mouse_filter = Control.MOUSE_FILTER_PASS
	col.add_child(_body)
	col.add_child(_rule(look.faint))
	var foot := HBoxContainer.new()
	col.add_child(foot)
	_status = _label("", look.ink)
	_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_status.clip_text = true
	foot.add_child(_status)
	var off := Button.new()
	off.name = "LogOff"
	off.text = " LOG OFF "
	off.focus_mode = Control.FOCUS_NONE
	off.pressed.connect(func() -> void:
		laptop.sound("blip")
		laptop.call_deferred("leave"))
	foot.add_child(off)
	_boot = _label("", look.ink)
	_boot.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_boot.offset_left = 24                             # (after the preset: it zeroes the offsets)
	_boot.offset_top = 20
	_boot.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	_boot.visible = false
	add_child(_boot)
	_pointer = Pointer.new()
	_pointer.ink = look.ink
	_pointer.paper = look.paper
	_pointer.visible = false
	add_child(_pointer)
	add_tab("HOME", _make_home())
	order = OrderTab.new()
	order.name = "Order"
	add_tab("ORDER", order)
	order.setup(self)
	add_tab("LOG", _make_log())
	show_tab("HOME")
	set_cash(float(laptop.call("cash_now")))


# ---- what the laptop calls ---------------------------------------------------------------------------------------------
## awake: its windows up (the boot's lines first, the first time), the rain thinned behind them
func wake() -> void:
	awake = true
	_idle.visible = false
	_rain.amount = look.rain
	_pointer.visible = true
	set_cash(float(laptop.call("cash_now")))
	order.refresh()
	if look.boot and not _booted:
		_booted = true
		_frame.visible = false
		_boot.visible = true
		var who := str(laptop.get("user")).to_upper()
		_boot_lines = PackedStringArray([
				"%s BIOS 4.06   (C) 1998" % str(laptop.get("system_name")).get_slice("/", 0),
				"MEMORY TEST ........ 65536K OK",
				"LOADING %s ......... OK" % str(laptop.get("system_name")),
				"MOUNT /home/%s ...... OK" % who.to_lower(),
				"LINK  %s ............ CONNECTED" % str(laptop.call("store_name")),
				"", "LOGIN: %s" % who])
		_boot.text = ""
		_boot_t = 0.0
		laptop.sound("boot")
	else:
		_frame.visible = true
		say("WELCOME BACK, %s." % str(laptop.get("user")).to_upper())


## asleep: the rain alone, the system's name in the middle
func sleep() -> void:
	awake = false
	_frame.visible = false
	_boot.visible = false
	_boot_t = -1.0
	_idle.visible = true
	_rain.amount = look.rain_idle
	_pointer.visible = false


func set_cash(v: float) -> void:
	_cash_label.text = "CASH %s" % money(v)
	if order != null:
		order.cash_changed(v)
	if _home != null:
		_home.text = _home_text()


func money(v: float) -> String:
	return "%s%.2f" % [str(laptop.call("currency")), v]


## the status line, typed out
func say(text: String) -> void:
	_status_text = "> " + text
	_status_t = 0.0


func log(text: String) -> void:
	var t := Time.get_time_string_from_system().substr(0, 5)
	log_lines.append("%s  %s" % [t, text])
	if _log_label != null:
		_log_label.text = "\n".join(log_lines)


## the pointer at p (the screen's pixels)
func pointer(p: Vector2) -> void:
	_pointer.position = p
	_pointer.visible = awake


func add_tab(nm: String, c: Control) -> void:
	tabs[nm] = c
	c.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	c.visible = false
	_body.add_child(c)
	var b := Button.new()
	b.name = "Tab_" + nm
	b.text = " %s " % nm
	b.toggle_mode = true
	b.button_group = _group
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func() -> void:
		laptop.sound("blip")
		show_tab(nm))
	_bar.add_child(b)
	_bar.move_child(b, _bar.get_node("Spring").get_index())
	tab_buttons[nm] = b


func show_tab(nm: String) -> void:
	if not tabs.has(nm):
		return
	for k in tabs:
		tabs[k].visible = k == nm
	(tab_buttons[nm] as Button).button_pressed = true
	current = nm
	tab_changed.emit(nm)


## a text field has the keys (E and the laptop's own keys then type)
func typing() -> bool:
	var f := get_viewport().gui_get_focus_owner() if get_viewport() != null else null
	return f is LineEdit or f is TextEdit


# ---- the tabs ------------------------------------------------------------------------------------------------------------
func _make_home() -> Control:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 18)
	var pad := Control.new()
	pad.custom_minimum_size = Vector2(0, 10)
	v.add_child(pad)
	_home = _label(_home_text(), look.ink)
	v.add_child(_home)
	var b := Button.new()
	b.name = "Browse"
	b.text = "  OPEN THE CATALOGUE  >  "
	b.focus_mode = Control.FOCUS_NONE
	b.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	b.pressed.connect(func() -> void:
		laptop.sound("blip")
		show_tab("ORDER"))
	v.add_child(b)
	return v


func _home_text() -> String:
	var t := str(laptop.get("home_text"))
	return t.replace("{user}", str(laptop.get("user")).to_upper()).replace("{store}", str(laptop.call("store_name"))) \
			.replace("{cash}", money(float(laptop.call("cash_now"))))


func _make_log() -> Control:
	var sc := ScrollContainer.new()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_log_label = _label("", look.ink)
	_log_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_log_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sc.add_child(_log_label)
	return sc


# ---- every frame -----------------------------------------------------------------------------------------------------
func _process(dt: float) -> void:
	_blink += dt
	if _clock_label != null:
		_clock_label.text = str(laptop.call("clock_text"))
	if _status != null:
		_status_t += dt
		var n := int(_status_t * 70.0)
		var cur := "_" if fmod(_blink, 1.0) < 0.55 else " "
		_status.text = _status_text.left(n) + (cur if n >= _status_text.length() else "")
	if _boot_t >= 0.0:
		_boot_t += dt
		var total := 0
		var shown := int(_boot_t * 95.0)
		var out := PackedStringArray()
		for ln in _boot_lines:
			if shown <= total:
				break
			out.append(ln.left(shown - total))
			total += ln.length() + 6                       # a beat between the lines
		_boot.text = "\n".join(out) + ("_" if fmod(_blink, 0.5) < 0.25 else "")
		if shown > total + 40:
			_boot_t = -1.0
			_boot.visible = false
			_frame.visible = true
			say("WELCOME, %s. %s IS OPEN." % [str(laptop.get("user")).to_upper(), str(laptop.call("store_name"))])


# ---- the look ------------------------------------------------------------------------------------------------------------
func _label(text: String, c: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", c)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _rule(c: Color) -> ColorRect:
	var r := ColorRect.new()
	r.color = c
	r.custom_minimum_size = Vector2(0, 2)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


func box(bg: Color, line: Color, width := 2, margin := 6.0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = line
	s.set_border_width_all(width)
	s.set_corner_radius_all(0)
	s.set_content_margin_all(margin)
	s.anti_aliasing = false
	return s


func _make_theme() -> Theme:
	var t := Theme.new()
	t.default_font = look.font_or_default()
	t.default_font_size = look.text_px
	t.set_color("font_color", "Label", look.ink)
	var clear := Color(0, 0, 0, 0)
	t.set_stylebox("normal", "Button", box(clear, look.dim, 2, 4))
	t.set_stylebox("hover", "Button", box(look.faint, look.ink, 2, 4))
	t.set_stylebox("pressed", "Button", box(look.ink, look.ink, 2, 4))
	t.set_stylebox("hover_pressed", "Button", box(look.hot, look.hot, 2, 4))
	t.set_stylebox("disabled", "Button", box(clear, look.faint, 2, 4))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	t.set_color("font_color", "Button", look.ink)
	t.set_color("font_hover_color", "Button", look.hot)
	t.set_color("font_pressed_color", "Button", look.paper)
	t.set_color("font_hover_pressed_color", "Button", look.paper)
	t.set_color("font_focus_color", "Button", look.ink)
	t.set_color("font_disabled_color", "Button", look.dim)
	t.set_stylebox("panel", "PanelContainer", box(Color(look.paper, 0.92), look.dim, 2, 10))
	var bar := box(look.faint, look.faint, 0, 0)
	bar.content_margin_left = 3
	bar.content_margin_right = 3
	t.set_stylebox("scroll", "VScrollBar", bar)
	t.set_stylebox("grabber", "VScrollBar", box(look.dim, look.dim, 0, 0))
	t.set_stylebox("grabber_highlight", "VScrollBar", box(look.ink, look.ink, 0, 0))
	t.set_stylebox("grabber_pressed", "VScrollBar", box(look.hot, look.hot, 0, 0))
	return t
