## The Play HUD (the desk's hud.js, ported to Controls): the objective and the to-do list top left, the timer, the
## log, the reticle and its prompt, the line (subtitle) in the footer with a choice's options under it, cards (a note,
## a code pad, the player's name), a chapter's title card, the suspicion meter, the inventory's row, the stance, the
## fade to black over everything, and under it all the guide markers over what open tasks need (marker.gd). The layout
## is one rule each; a game's theme comes later (play/ui/themes).
@icon("res://addons/horrorstudio_ui/icons/hshud.svg")
class_name HSHud
extends CanvasLayer

## ui-v3 (DECISIONS 2026-11-08): the rest of the HUD brought up to the desk's design (play/ui/hud.css) and quieted for
## horror: the corners' words rest dim and come up when something changes, nothing pops (every appearing and going is an
## ease), the lines in a serif voice on a scrim that rises while someone talks, the reticle a dot that opens into a ring,
## the to-do's bullets the marker's own diamond where the world marks the task.

## HorrorStudio UI's HUD (GodotPlugins/HorrorStudioUI, the user's "the ui should be part of the godot plugin"): add one to a
## scene and it is the studio's HUD: `objective(text)`, `todo(items, fresh)`, `line(text, who, secs, think)`, `log(text)`,
## `set_cursor(kind, label, name)`, `choose({prompt, options})`, `panel({title, text})`, `inventory(...)`, `chapter(...)`,
## and the quest marker over every active HSQuestMarker in the scene. Made by hand it sets itself up (`standalone`); the
## studio's runtime (the desk's export, the Director) turns that off and drives it all itself.
signal panel_done(value)
signal choice_done(index)
signal choosing(on)                # a choice up (true) and done (false): play frees the mouse for it and takes it back after

const SHOWN := 5
const REST_ALPHA := 0.74            # the corners' words at rest: there, not insistent; a change brings them to full a few seconds
const FRESH_SECS := 6.0
const HINT_REST := 0.45


## a to-do's bullet: a box to tick, or (for a task the world marks with the guide's diamond) that diamond, small; done
## ticked or filled, failed crossed
class Bullet extends Control:
	var shape := "box"
	var state := "open"
	var col := Color(1, 1, 1, 0.9)
	var bad := Color("#ff8c84")

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		size = Vector2(14, 14)
		custom_minimum_size = size

	func _draw() -> void:
		var c := size / 2.0
		var k := bad if state == "failed" else col
		if shape == "diamond":
			var pts := PackedVector2Array([c + Vector2(0, -6.0), c + Vector2(4.4, 0), c + Vector2(0, 6.0), c + Vector2(-4.4, 0)])
			if state == "done":
				draw_colored_polygon(pts, Color(k, k.a * 0.85))
			else:
				pts.append(pts[0])
				draw_polyline(pts, k, 1.4, true)
		else:
			draw_rect(Rect2(c - Vector2(5, 5), Vector2(10, 10)), k, false, 1.3, true)
			if state == "done":
				draw_polyline(PackedVector2Array([c + Vector2(-2.6, 0.2), c + Vector2(-0.6, 2.4), c + Vector2(3.0, -2.6)]), k, 1.5, true)
		if state == "failed":
			draw_line(c + Vector2(-3.2, -3.2), c + Vector2(3.2, 3.2), k, 1.4, true)
			draw_line(c + Vector2(3.2, -3.2), c + Vector2(-3.2, 3.2), k, 1.4, true)


## the reticle (the desk's .ph-cursor): a dot that opens into a ring over what can be used, the ring red and crossed when
## it's locked, an arc filling round it as a held use is done, squeezed a moment by a press
class Reticle extends Control:
	var kind := "none"
	var open := 0.0
	var progress := -1.0
	var press := 0.0
	var col := Color(1.0, 0.98, 0.94, 0.9)
	var accent := Color("#cfe6ff")
	var bad := Color("#ff8c84")

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		size = Vector2(44, 44)
		custom_minimum_size = size

	func _process(dt: float) -> void:
		open = move_toward(open, 0.0 if (kind == "none" and progress < 0.0) else 1.0, dt * 7.0)
		press = move_toward(press, 0.0, dt * 5.0)
		queue_redraw()

	func _draw() -> void:
		var c := size / 2.0
		var k := bad if kind == "locked" else col
		var r := lerpf(2.4, 9.5, open) * (1.0 - 0.22 * press)
		if open < 0.98:
			draw_circle(c, 3.6, Color(0, 0, 0, 0.35 * (1.0 - open)))
			draw_circle(c, 2.4, Color(k, k.a * (1.0 - open)))
		if open > 0.02:
			draw_arc(c, r, 0.0, TAU, 40, Color(0, 0, 0, 0.3 * open), 3.6, true)
			draw_arc(c, r, 0.0, TAU, 40, Color(k, k.a * open), 1.5, true)
			if kind == "locked":
				draw_line(c + Vector2(-3, -3), c + Vector2(3, 3), Color(k, k.a * open), 1.4, true)
				draw_line(c + Vector2(3, -3), c + Vector2(-3, 3), Color(k, k.a * open), 1.4, true)
		if progress >= 0.0:
			draw_arc(c, r, -PI / 2.0, -PI / 2.0 + TAU * clampf(progress, 0.0, 1.0), 40, accent, 2.6, true)


## a hairline fading outward either side of a small diamond (the chapter card's rule: the marker's own shape, quiet)
class Ornament extends Control:
	var col := Color(1, 1, 1, 0.5)

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		custom_minimum_size = Vector2(240, 18)

	func _draw() -> void:
		var c := size / 2.0
		for sgn in [-1.0, 1.0]:
			draw_polyline_colors(PackedVector2Array([c + Vector2(sgn * 13.0, 0), c + Vector2(sgn * 108.0, 0)]),
				PackedColorArray([col, Color(col, 0.0)]), 1.0, true)
		var d := PackedVector2Array([c + Vector2(0, -6), c + Vector2(4, 0), c + Vector2(0, 6), c + Vector2(-4, 0), c + Vector2(0, -6)])
		draw_polyline(d, col, 1.2, true)

var root: Control
## by hand (the default): it wears the project's UI settings (Project Settings > horrorstudio/ui), starts clear, has no pause
## menu, and hangs the quest marker over every active HSQuestMarker in the scene. The runtime sets this false before it is added.
@export var standalone := true
## by hand: the keys shown as chips at the foot, each "keys:what they do" ("W A S D:walk", "E:use", "Tab:pocket"), in
## place of the studio runtime's (Click to play, E inventory, G put down...); a script adds one with hint_key()
@export var keys: PackedStringArray = []
var auto_markers := false                      # standalone: feed the guide from the scene's HSQuestMarkers (their sight from physics rays)
var _los := {}                                 # marker id -> {clear, at}: its line of sight, looked at a few times a second
var guide = null                               # the markers over what open tasks need (marker.gd: a todo's `guide`)
var tl: VBoxContainer                          # the top left: the objective and the to-do list, resting dim
var obj_head: Label                            # OBJECTIVE (NEW OBJECTIVE in the accent while it's fresh)
var obj: Label
var todo_head: Label                           # TO DO
var todo_box: VBoxContainer
var rows: Dictionary = {}                      # task id -> its row (a Label): kept between changes so a tick can be eased
var fresh_tw: Tween = null
var line_el: Label
var who_el: Label
var prompt_el: Control                         # the verb and what it's on, right of the reticle
var prompt_verb: Label
var prompt_name: Label
var cursor_el: Control                         # the reticle (Reticle)
var log_box: VBoxContainer
var timer_el: Label
var stance_el: Label
var seen_el: ProgressBar
var scrim: TextureRect                         # under the footer: rises while someone talks or asks
var vignette: TextureRect                      # the dark round the edge while hidden
var inv_box: HBoxContainer
var inv_name: Label
var hint_el: HBoxContainer                     # the keys as chips, right at the foot
var hint_tw: Tween = null
var veil: ColorRect = null                     # behind a card held up to read: the world dims, a little
var card_halo: ColorRect = null                # the soft dark behind a card's words: no panel, no edge (halo.gdshader)
var inv_band: ColorRect = null                 # the same, softer, behind the inventory's row
var inv_ul: ColorRect = null                   # the line under the thing in the hand
var fade_el: ColorRect
var peep_el: ColorRect
var chapter_el: VBoxContainer
var chapter_t: Label
var chapter_rule: Control                       # the diamond rule between the title and its sub
var chapter_s: Label
var panel_el: PanelContainer = null
var choice_el: HBoxContainer = null   # the answers on one line under the question, a dash between, in choice_box
var choice_box: PanelContainer = null  # the glass panel round them
var foot: VBoxContainer = null          # who, the line, a choice's panel, the inventory's row
const FOOT_REST := 150.0                  # the footer's bottom above the screen's foot, px: the lines
const FOOT_CHOOSING := 44.0               # and while a choice is up: its panel low, the view above it clear
var board_el: Label

var cursor_kind: String = "none"
var cursor_label: String = ""
var cursor_name: String = ""
var line_until: float = 0.0
var line_text: String = ""
var typing = null
const Typing := preload("res://addons/horrorstudio_ui/typing.gd")
var line_think: bool = false
var modal_up: bool = false
var choice_keys: Array = []
var choice_sel: int = 0
var choice_spec: Dictionary = {}
var choice_over: bool = true
var panel_spec: Dictionary = {}
var panel_typed: String = ""
var tasks: Array = []
var logs: Array = []
var hints: Dictionary = {}
var player_name: String = "Alex"
var words: Callable = Callable()
var chapter_up: bool = false
var lines_shown: Array = []
const ThemeC := preload("res://addons/horrorstudio_ui/theme.gd")
const MenuC := preload("res://addons/horrorstudio_ui/menu.gd")
const HaloShader := preload("res://addons/horrorstudio_ui/halo.gdshader")
var theme_name: String = "glass"
var menu = null                              # the pause menu (menu.gd), under the root
var subs_on: bool = true
var sub_scale: float = 1.0
var brightness: float = 1.0
var env: Environment = null                  # the world's, for brightness


## the game's theme (game.ui_theme: glass, glass-rose, neumorph, plain) on everything, and the pause menu in it
func wear(name: String) -> void:
	theme_name = name if ThemeC.THEMES.has(name) or name == "glass-rose" else "glass"
	root.theme = ThemeC.make(theme_name)
	if guide != null:
		guide.accent = ThemeC.colors(theme_name)["accent"]
		guide.text_color = ThemeC.colors(theme_name)["text"]
	if menu != null:
		menu.queue_free()
		menu = null
	if not standalone:                                 # the runtime's pause menu and the player's saved settings
		menu = MenuC.new(self, theme_name)
		root.add_child(menu)
	_restyle()
	if not standalone:
		MenuC.apply(MenuC.load_settings(), self)


## what depends on the theme and lives on: the labels that name a part, the two voices, the reticle's colours, the keys
func _restyle() -> void:
	if line_el == null:
		return
	var c := ThemeC.colors(theme_name)
	for l in [obj_head, todo_head, stance_el]:
		l.add_theme_color_override("font_color", c["muted"])
	var serif: Font = ThemeC.serif(c)
	for l in [line_el, who_el]:
		if serif != null:
			l.add_theme_font_override("font", ThemeC.serif(c, false, l == who_el))
		else:
			l.remove_theme_font_override("font")
	who_el.add_theme_color_override("font_color", c["who"])
	cursor_el.col = Color(c["text"].r, c["text"].g, c["text"].b, 0.9)
	cursor_el.accent = c["accent"]
	cursor_el.bad = c["bad"]
	chapter_rule.col = Color(c["muted"].r, c["muted"].g, c["muted"].b, 0.7)
	inv_ul.color = Color(c["accent"].r, c["accent"].g, c["accent"].b, 0.85)
	if inv_band != null:
		(inv_band.material as ShaderMaterial).set_shader_parameter("tint", c.get("halo_tint", Color(0.01, 0.015, 0.025, 1.0)))
	chapter_s.add_theme_color_override("font_color", c["muted"])
	prompt_name.add_theme_color_override("font_color", c["muted"])
	var thin := StyleBoxFlat.new()                                  # the suspicion: one thin line, in the bad colour
	thin.bg_color = c["bad"]
	thin.set_corner_radius_all(2)
	seen_el.add_theme_stylebox_override("fill", thin)
	var track := StyleBoxFlat.new()
	track.bg_color = Color(1, 1, 1, 0.14)
	track.set_corner_radius_all(2)
	seen_el.add_theme_stylebox_override("background", track)
	_draw_hints()
	for id in rows:
		_task_set(rows[id], rows[id].get_meta("item"), "")


## the play HUD steps back while a scene holds the player (play.gd hold/go): the objective, the prompt and cursor,
## the inventory, the log; the footer stays (the scene's lines, who says them, a reply's choices), as do the fade and
## the chapter card. (hold() hid the whole root till 2026-10-30, the lines with it: the user saw no dialogue in
## a cutscene.)
var _held := false


func held(on: bool) -> void:
	if on == _held:
		return
	_held = on
	for ch in root.get_children():
		if ch == menu or ch == fade_el or ch == chapter_el or ch.name == "Footer":
			continue
		if on:
			ch.set_meta("held_visible", ch.visible)
			ch.visible = false
		elif ch.has_meta("held_visible"):
			ch.visible = ch.get_meta("held_visible")


## the rest of the HUD steps back while the menu is up (the desk's `paused`). Once each way: a second `paused(true)`
## wrote every part down as hidden, so after the menu nothing came back (the footer with it: the user saw no
## dialogue in a cutscene after using the menu, 2026-10-30)
var _paused := false


func paused(on: bool) -> void:
	if on == _paused:
		return
	_paused = on
	for ch in root.get_children():
		if ch == menu or ch == fade_el:
			continue
		if on:
			ch.set_meta("was_visible", ch.visible)
			ch.visible = false
		elif ch.has_meta("was_visible"):
			ch.visible = ch.get_meta("was_visible")


func apply_settings() -> void:
	line_el.add_theme_font_size_override("font_size", int(round(20 * sub_scale)))
	line_el.visible = subs_on
	who_el.visible = subs_on
	if env != null:
		env.adjustment_enabled = abs(brightness - 1.0) > 0.01
		env.adjustment_brightness = brightness

func _ready() -> void:
	layer = 10
	root = Control.new()
	root.name = "Root"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	guide = load("res://addons/horrorstudio_ui/marker.gd").new()   # first, so everything else draws over it
	guide.accent = ThemeC.colors(theme_name)["accent"]
	guide.text_color = ThemeC.colors(theme_name)["text"]
	root.add_child(guide)
	vignette = _gradient_rect("Vignette", GradientTexture2D.FILL_RADIAL, Vector2(0.5, 0.5), Vector2(1.0, 0.5),
		[0.0, 0.55, 1.0], [Color(0.03, 0.04, 0.06, 0.0), Color(0.03, 0.04, 0.06, 0.0), Color(0.02, 0.03, 0.05, 0.8)], Vector2i(256, 144))
	vignette.set_anchors_preset(Control.PRESET_FULL_RECT)               # hidden: the dark round the edge (the desk's data-stance=hidden)
	vignette.modulate.a = 0.0
	root.add_child(vignette)
	scrim = _gradient_rect("Scrim", GradientTexture2D.FILL_LINEAR, Vector2(0, 1), Vector2(0, 0),
		[0.0, 0.7, 1.0], [Color(0.016, 0.024, 0.04, 0.62), Color(0.016, 0.024, 0.04, 0.18), Color(0.016, 0.024, 0.04, 0.0)], Vector2i(4, 256))
	scrim.anchor_left = 0.0                                              # the footer's scrim: rises from the foot while someone talks or asks
	scrim.anchor_right = 1.0
	scrim.anchor_top = 0.56
	scrim.anchor_bottom = 1.0
	scrim.offset_left = 0.0
	scrim.offset_right = 0.0
	scrim.offset_top = 0.0
	scrim.offset_bottom = 0.0
	scrim.modulate.a = 0.0
	root.add_child(scrim)
	# top left: the objective and the list, resting dim, brought up to full by a change
	tl = VBoxContainer.new()
	tl.name = "TopLeft"
	tl.position = Vector2(24, 20)
	tl.add_theme_constant_override("separation", 3)
	tl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tl.modulate.a = REST_ALPHA
	root.add_child(tl)
	obj_head = _section("Objective")
	obj_head.name = "ObjectiveHead"
	obj_head.visible = false
	tl.add_child(obj_head)
	obj = _label("", 17)
	obj.name = "Objective"
	tl.add_child(obj)
	todo_head = _section("To do")
	todo_head.name = "TodoHead"
	todo_head.visible = false
	tl.add_child(todo_head)
	todo_box = VBoxContainer.new()
	todo_box.name = "Todo"
	todo_box.add_theme_constant_override("separation", 3)
	tl.add_child(todo_box)
	timer_el = _label("", 26)
	timer_el.name = "Timer"
	timer_el.set_anchors_preset(Control.PRESET_CENTER_TOP)
	timer_el.offset_left = -70.0
	timer_el.offset_right = 70.0
	timer_el.offset_top = 20.0
	timer_el.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(timer_el)
	board_el = _label("", 16)
	board_el.name = "Board"
	board_el.set_anchors_preset(Control.PRESET_CENTER_TOP)
	board_el.position = Vector2(-120, 56)
	root.add_child(board_el)
	log_box = VBoxContainer.new()
	log_box.name = "Log"
	log_box.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	log_box.position = Vector2(-340, 20)
	log_box.custom_minimum_size = Vector2(320, 0)
	root.add_child(log_box)
	# the reticle and the prompt
	cursor_el = Reticle.new()
	cursor_el.name = "Cursor"
	cursor_el.set_anchors_preset(Control.PRESET_CENTER)
	cursor_el.offset_left = -22.0
	cursor_el.offset_top = -22.0
	cursor_el.offset_right = 22.0
	cursor_el.offset_bottom = 22.0
	root.add_child(cursor_el)
	prompt_el = VBoxContainer.new()                                  # the verb, and what it's on under it, right of the ring
	prompt_el.name = "Prompt"
	prompt_el.set_anchors_preset(Control.PRESET_CENTER)
	prompt_el.offset_left = 24.0
	prompt_el.offset_top = -13.0
	prompt_el.add_theme_constant_override("separation", -1)
	prompt_el.mouse_filter = Control.MOUSE_FILTER_IGNORE
	prompt_el.modulate.a = 0.0
	root.add_child(prompt_el)
	prompt_verb = _label("", 16)
	prompt_verb.name = "Verb"
	prompt_el.add_child(prompt_verb)
	prompt_name = _label("", 12)
	prompt_name.name = "ThingName"
	prompt_el.add_child(prompt_name)
	seen_el = ProgressBar.new()
	seen_el.name = "Seen"
	seen_el.set_anchors_preset(Control.PRESET_CENTER)
	seen_el.offset_left = -60.0
	seen_el.offset_top = 38.0
	seen_el.offset_right = 60.0
	seen_el.offset_bottom = 41.0
	seen_el.show_percentage = false
	seen_el.visible = false
	root.add_child(seen_el)
	var fc := ThemeC.colors(theme_name)                              # the inventory's frosted band (the user, 2026-10-27: frosted glass, a gradient, no border)
	inv_band = halo(fc, 46.0, 0.34)
	inv_band.name = "InventoryBand"
	inv_band.modulate.a = 0.0
	root.add_child(inv_band)
	inv_ul = ColorRect.new()
	inv_ul.name = "InventoryHeld"
	inv_ul.mouse_filter = Control.MOUSE_FILTER_IGNORE
	inv_ul.modulate.a = 0.0
	root.add_child(inv_ul)
	# the footer: who, the line
	foot = VBoxContainer.new()
	foot.name = "Footer"
	foot.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	foot.grow_vertical = Control.GROW_DIRECTION_BEGIN        # grows up from the bottom edge as the row and a choice need
	foot.offset_top = -FOOT_REST
	foot.offset_bottom = -FOOT_REST
	foot.alignment = BoxContainer.ALIGNMENT_END
	foot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(foot)
	who_el = _label("", 14)
	who_el.name = "Who"
	who_el.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	foot.add_child(who_el)
	line_el = _label("", 20)
	line_el.name = "Line"
	line_el.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	line_el.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	foot.add_child(line_el)
	var dock := CenterContainer.new()
	dock.name = "Dock"
	foot.add_child(dock)
	choice_box = PanelContainer.new()                  # the answers as the dialogue's own words on one line, a dash between, no panel (the user, 2026-10-30, evening)
	choice_box.name = "ChoiceBox"
	choice_box.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	choice_box.visible = false
	dock.add_child(choice_box)
	choice_el = HBoxContainer.new()
	choice_el.name = "Choice"
	choice_el.alignment = BoxContainer.ALIGNMENT_CENTER
	choice_el.add_theme_constant_override("separation", 6)
	choice_box.add_child(choice_el)
	inv_box = HBoxContainer.new()
	inv_box.name = "Inventory"
	inv_box.alignment = BoxContainer.ALIGNMENT_CENTER
	inv_box.visible = false
	foot.add_child(inv_box)
	inv_name = _label("", 14)
	inv_name.name = "InventoryName"
	inv_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	foot.add_child(inv_name)
	stance_el = _section("")
	stance_el.name = "Stance"
	stance_el.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	stance_el.position = Vector2(24, -40)
	root.add_child(stance_el)
	hint_el = HBoxContainer.new()                                    # the keys as chips with what they do, right at the foot
	hint_el.name = "Hint"
	hint_el.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	hint_el.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	hint_el.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hint_el.offset_right = -24.0
	hint_el.offset_bottom = -24.0
	hint_el.add_theme_constant_override("separation", 18)
	hint_el.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hint_el.modulate.a = 1.0
	root.add_child(hint_el)
	for k in [["Click", "to play"], ["W A S D", "walk"], ["Shift", "run"], ["Click", "use"], ["E", "inventory"], ["G", "put down"], ["C", "crouch"], ["Esc", "pause"]]:
		hints[k[0] + ":" + k[1]] = true
	_draw_hints()
	_hint_fresh()
	# over everything: the peephole's mask, the fade, a chapter card
	peep_el = ColorRect.new()
	peep_el.name = "Peep"
	peep_el.set_anchors_preset(Control.PRESET_FULL_RECT)
	peep_el.color = Color(0, 0, 0, 0)
	peep_el.mouse_filter = Control.MOUSE_FILTER_IGNORE
	peep_el.visible = false
	root.add_child(peep_el)
	fade_el = ColorRect.new()
	fade_el.name = "Fade"
	fade_el.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade_el.color = Color(0, 0, 0, 1)
	fade_el.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(fade_el)
	chapter_el = VBoxContainer.new()
	chapter_el.name = "Chapter"
	chapter_el.set_anchors_preset(Control.PRESET_CENTER)
	chapter_el.grow_horizontal = Control.GROW_DIRECTION_BOTH       # it grows out from the middle (it grew right and down from it)
	chapter_el.grow_vertical = Control.GROW_DIRECTION_BOTH
	chapter_el.add_theme_constant_override("separation", 12)
	chapter_el.mouse_filter = Control.MOUSE_FILTER_IGNORE
	chapter_el.visible = false
	root.add_child(chapter_el)
	chapter_t = _label("", 32)
	chapter_t.add_theme_font_override("font", ThemeC.tracked(6.0))
	chapter_t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	chapter_el.add_child(chapter_t)
	chapter_rule = Ornament.new()
	chapter_rule.name = "Rule"
	chapter_rule.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	chapter_el.add_child(chapter_rule)
	chapter_s = _label("", 15)
	chapter_s.add_theme_font_override("font", ThemeC.tracked(2.0))
	chapter_s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	chapter_el.add_child(chapter_s)
	_restyle()
	if standalone:                                       # by hand: the project's theme and quest marker setting, no black fade, the scene's markers
		wear(str(ProjectSettings.get_setting("horrorstudio/ui/theme", "glass")))
		guide.mode = clampi(int(ProjectSettings.get_setting("horrorstudio/ui/quest_marker", 1)), 0, 2)
		set_fade(0.0)
		auto_markers = true
		if not keys.is_empty():                          # your game's keys in place of the studio runtime's
			hints.clear()
			for k in keys:
				if str(k).contains(":"):
					hints[str(k)] = true
			_draw_hints()


func _label(text: String, size: int) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


## the small letter-spaced label that names a part (OBJECTIVE, TO DO): muted, 11 px, its letters apart
func _section(text: String) -> Label:
	var l := _label(text.to_upper(), 11)
	l.add_theme_font_override("font", ThemeC.tracked(2.0))
	l.add_theme_color_override("font_color", ThemeC.colors(theme_name)["muted"])
	return l


## a full-size rectangle of a gradient (the footer's scrim, the dark round the edge when hidden)
func _gradient_rect(nm: String, fill: int, from: Vector2, to: Vector2, offsets: Array, cols: Array, size: Vector2i) -> TextureRect:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array(offsets)
	g.colors = PackedColorArray(cols)
	var tex := GradientTexture2D.new()
	tex.gradient = g
	tex.fill = fill
	tex.fill_from = from
	tex.fill_to = to
	tex.width = size.x
	tex.height = size.y
	var r := TextureRect.new()
	r.name = nm
	r.texture = tex
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_SCALE
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


## a soft, edgeless patch of dark (halo.gdshader) to sit behind words, `feather` pixels wider than they are: never a shape
## (the user, 2026-11-08: a glass panel takes some of the immersion away; "the panel isn't as noticeable and the text is there")
func halo(c: Dictionary, feather: float = 80.0, strength: float = 0.55) -> ColorRect:
	var r := ColorRect.new()
	r.name = "Halo"
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m := ShaderMaterial.new()
	m.shader = HaloShader
	m.set_shader_parameter("feather", feather)
	m.set_shader_parameter("strength", strength)
	m.set_shader_parameter("tint", c.get("halo_tint", Color(0.01, 0.015, 0.025, 1.0)))
	r.material = m
	r.resized.connect(func(): m.set_shader_parameter("rect_size", r.size))
	return r


## behind a card held up to read, the world dims (the desk's .ph-panel veil); away again when it's put down
func _veil(on: bool) -> void:
	if veil == null:
		veil = ColorRect.new()
		veil.name = "Veil"
		veil.set_anchors_preset(Control.PRESET_FULL_RECT)
		veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
		veil.modulate.a = 0.0
		root.add_child(veil)
	var vc: Color = ThemeC.colors(theme_name)["scrim"]
	veil.color = Color(vc.r, vc.g, vc.b, vc.a * 0.85)             # a little: the halo behind the words does the reading's work
	if on:
		root.move_child(veil, root.get_child_count() - 1)     # above the HUD's corners, under the card (added after)
	fade(veil, 1.0 if on else 0.0, 0.25)


## the halos follow what they sit behind (a card's rect, the inventory's row), every frame
func _sync_halo() -> void:
	if card_halo != null and panel_el != null:
		var f: float = card_halo.get_meta("feather")
		card_halo.size = panel_el.size + Vector2(f, f) * 2.0
		card_halo.global_position = panel_el.global_position - Vector2(f, f)
	if inv_band == null:
		return
	var show: bool = inv_box.is_visible_in_tree() and inv_box.get_child_count() > 0
	fade(inv_band, 1.0 if show else 0.0, 0.3)
	fade(inv_ul, 1.0 if show else 0.0, 0.3)
	if not show:
		return
	var r := inv_box.get_global_rect()
	var f := 46.0
	inv_band.size = Vector2(maxf(r.size.x + 120.0, 380.0), r.size.y + 8.0) + Vector2(f, f) * 2.0
	inv_band.global_position = Vector2(r.get_center().x - inv_band.size.x / 2.0, r.position.y - 4.0 - f)
	for sl in inv_box.get_children():
		if sl.has_meta("d") and int(sl.get_meta("d")) == 0:
			var sr: Rect2 = (sl as Control).get_global_rect()
			inv_ul.size = Vector2(26.0, 2.0)
			inv_ul.global_position = Vector2(sr.get_center().x - 13.0, sr.end.y + 5.0)


## an ease, then `done` (at once when there was nothing to ease)
func fade_then(n: CanvasItem, a: float, secs: float, done: Callable) -> void:
	var tw := fade(n, a, secs)
	if tw != null:
		tw.tween_callback(done)
	else:
		done.call()


## a node's alpha eased to `a` over `secs` (the tween kept on it: a new ease replaces the old one); null when it's there already
func fade(n: CanvasItem, a: float, secs: float = 0.25) -> Tween:
	if n.has_meta("fade_to") and is_equal_approx(float(n.get_meta("fade_to")), a):
		var cur = n.get_meta("fade") if n.has_meta("fade") else null
		if cur is Tween and cur.is_valid():
			return cur                                       # already on its way there
		if is_equal_approx(n.modulate.a, a):
			return null                                      # already there: nothing to ease
	if n.has_meta("fade"):
		var old = n.get_meta("fade")
		if old is Tween and old.is_valid():
			old.kill()
	var tw := n.create_tween()
	tw.tween_property(n, "modulate:a", a, secs).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	n.set_meta("fade", tw)
	n.set_meta("fade_to", a)
	return tw


## {name} and the game's words in what's shown
func named(t) -> String:
	var s := str(t if t != null else "")
	s = s.replace("{name}", player_name)
	var re := RegEx.new()
	re.compile("\\{([a-z][a-z0-9_]*)\\}")
	for m in re.search_all(s):
		var w: String = m.get_string(1)
		var v = words.call(w) if words.is_valid() else null
		if v != null:
			s = s.replace("{%s}" % w, str(v))
	return s


func set_cursor(kind, label, name = null) -> void:
	cursor_kind = str(kind) if kind != null else "none"
	cursor_label = str(label) if label != null else ""
	cursor_name = str(name) if name != null else ""
	cursor_el.kind = cursor_kind
	var c := ThemeC.colors(theme_name)
	prompt_verb.text = cursor_label
	prompt_verb.add_theme_color_override("font_color", c["bad"] if cursor_kind == "locked" else c["text"])
	prompt_name.text = cursor_name
	prompt_name.visible = cursor_name != ""
	fade(prompt_el, 1.0 if cursor_label != "" else 0.0, 0.14)


func objective(text) -> void:
	var s := named(text)
	var shown: bool = text != null and s != ""
	var changed: bool = shown and s != obj.text
	obj.text = s
	obj.visible = shown
	obj_head.visible = shown
	var gap := StyleBoxEmpty.new()                      # the list's label stands off the objective above it
	gap.content_margin_top = 9.0 if shown else 0.0
	todo_head.add_theme_stylebox_override("normal", gap)
	if changed:
		_fresh(true)


## the corners' words up to full for a few seconds (a new objective, a task added or ticked), the labels that name them
## in the accent, then eased back to rest
func _fresh(new_objective: bool = false) -> void:
	var c := ThemeC.colors(theme_name)
	tl.modulate.a = 1.0
	if new_objective:
		obj_head.text = "NEW OBJECTIVE"
	for l in [obj_head, todo_head]:
		l.add_theme_color_override("font_color", c["accent"])
	if fresh_tw != null and fresh_tw.is_valid():
		fresh_tw.kill()
	fresh_tw = create_tween()
	fresh_tw.tween_interval(FRESH_SECS)
	fresh_tw.tween_callback(_rest)
	fresh_tw.tween_property(tl, "modulate:a", REST_ALPHA, 1.4).set_trans(Tween.TRANS_SINE)


func _rest() -> void:
	var c := ThemeC.colors(theme_name)
	obj_head.text = "OBJECTIVE"
	for l in [obj_head, todo_head]:
		l.add_theme_color_override("font_color", c["muted"])


## the to-do list: a row a task, kept from one change to the next (a task that's new eases in, one ticked has its line drawn
## across and dims, one gone eases out); the bullet a box, or the marker's own diamond where the world marks the task
func todo(items: Array, fresh: bool) -> void:
	var before := {}
	for id in rows:
		before[id] = str(rows[id].get_meta("state", ""))
	tasks = items
	var keep := {}
	var i := 0
	for t in items:
		var id = t["id"]
		keep[id] = true
		var row: Label = rows.get(id)
		var is_new: bool = row == null or not is_instance_valid(row)
		if is_new:
			row = _task_row()
			row.modulate.a = 0.0
			rows[id] = row
			todo_box.add_child(row)
		todo_box.move_child(row, i)
		i += 1
		_task_set(row, t, "" if is_new else str(before.get(id, "")))
	for id in rows.keys():
		if not keep.has(id):
			var gone: Label = rows[id]
			rows.erase(id)
			if is_instance_valid(gone):
				fade_then(gone, 0.0, 0.3, gone.queue_free)
	todo_box.visible = items.size() > 0
	todo_head.visible = todo_box.visible
	if fresh and items.size() > 0:
		_fresh(false)


func _task_row() -> Label:
	var l := _label("", 15)
	var pad := StyleBoxEmpty.new()
	pad.content_margin_left = 22.0
	l.add_theme_stylebox_override("normal", pad)
	var b := Bullet.new()
	b.name = "Bullet"
	b.position = Vector2(2, 3)
	l.add_child(b)
	return l


## a row as the task is now; `before` is its state last time (a change to done or failed draws the line across)
func _task_set(row: Label, t: Dictionary, before: String) -> void:
	var c := ThemeC.colors(theme_name)
	var state := str(t["state"])
	var s := named(t["text"])
	if t.get("who") != null:
		s += "  · " + named(t["who"])
	if t.get("left") != null:
		s += "  %ds" % int(ceil(float(t["left"])))
	if row.text != s:
		row.text = s
	row.set_meta("task", t["id"])
	row.set_meta("state", state)
	row.set_meta("item", t)
	var b: Bullet = row.get_node("Bullet")
	b.shape = "diamond" if t.get("guide", false) else "box"
	b.state = state
	b.col = c["text"]
	b.bad = c["bad"]
	b.queue_redraw()
	row.self_modulate = c["bad"] if state == "failed" else Color(1, 1, 1, 1)
	fade(row, 0.5 if state == "done" else 1.0, 0.4)
	var strike: ColorRect = row.get_node_or_null("strike")
	if state == "open":
		if strike != null:
			row.remove_child(strike)
			strike.queue_free()
		return
	var f: Font = row.get_theme_font("font")                  # a line through the words (Godot's Label has no strikethrough), at the middle of its small letters
	var w: float = f.get_string_size(row.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
	var animate: bool = before == "open"
	if strike == null:
		strike = ColorRect.new()
		strike.name = "strike"
		strike.mouse_filter = Control.MOUSE_FILTER_IGNORE
		strike.size = Vector2(0.0 if animate else w, 1.5)
		row.add_child(strike)
	strike.color = c["bad"] if state == "failed" else c["text"]
	strike.position = Vector2(22.0, f.get_ascent(15) * 0.64 - strike.size.y / 2.0)
	if animate and strike.size.x < w:
		create_tween().tween_property(strike, "size:x", w, 0.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	else:
		strike.size.x = w


func chapter(title, sub, secs: float) -> void:
	chapter_t.text = str(title if title != null else "")
	chapter_s.text = str(sub if sub != null else "")
	chapter_el.modulate.a = 0.0
	chapter_el.visible = true
	chapter_up = true
	var total := 0.7 + secs
	var f := minf(0.5, total * 0.35)                           # in over half a second, out the same, inside the time it was given
	fade(chapter_el, 1.0, f)
	await get_tree().create_timer(maxf(0.05, total - f)).timeout
	fade(chapter_el, 0.0, f)
	await get_tree().create_timer(f).timeout
	chapter_el.visible = false
	chapter_up = false


func line(text, who, secs: float, think: bool, how = null) -> void:
	line_text = named(text)
	line_think = think
	typing = null
	line_until = Time.get_ticks_msec() / 1000.0 + secs
	who_el.text = str(who if who != null else "")
	var ital: Font = ThemeC.serif(ThemeC.colors(theme_name), think)    # a thought in the italic of the same voice
	if ital != null:
		line_el.add_theme_font_override("font", ital)
	_scrim()
	if how is Dictionary and (how.get("retype") != null or how.get("breaks", false)):
		typing = {"text": line_text, "retype": named(how["retype"]) if how.get("retype") != null else null, "breaks": bool(how.get("breaks", false)), "t": 0.0, "shown": null}
		type_tick(0.0)
		return
	_show_line(line_text)


## a thought typing itself out: what shows t seconds in (typing.gd), every change of it kept in lines_shown
func type_tick(dt: float) -> void:
	if typing == null:
		return
	typing["t"] += dt
	var s: Dictionary = Typing.typed_at(typing["text"], typing["retype"], typing["breaks"], typing["t"])
	var shown: String = Typing.glitched(s["shown"], s["glitch"], int(floor(typing["t"] * 20))) if s["glitch"] > 0 else s["shown"]
	if shown != typing["shown"]:
		typing["shown"] = shown
		_show_line(shown)
	if s["done"]:
		typing = null


func _show_line(words: String) -> void:
	if words != "":
		lines_shown.append(words)
		if lines_shown.size() > 200:
			lines_shown.pop_front()
	line_el.text = ("(%s)" % words) if line_think else words
	if words != "":
		fade(line_el, 1.0, 0.18)
		fade(who_el, 1.0, 0.18)


## the scrim under the footer: up while a line is up or a choice is, eased away after
func _scrim() -> void:
	fade(scrim, 1.0 if (line_text != "" or not choice_over) else 0.0, 0.35)


func log(text: String) -> void:
	logs.append(text)
	var l := _label(text, 13)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	l.add_theme_color_override("font_color", ThemeC.colors(theme_name)["muted"])
	l.modulate.a = 0.0
	log_box.add_child(l)
	while log_box.get_child_count() > 5:                         # five at most: the oldest goes
		var old := log_box.get_child(0)
		log_box.remove_child(old)
		old.queue_free()
	var tw := l.create_tween()                                   # in, a few seconds, out (the desk's ph-toast)
	tw.tween_property(l, "modulate:a", 1.0, 0.25)
	tw.tween_interval(4.1)
	tw.tween_property(l, "modulate:a", 0.0, 0.7)
	tw.tween_callback(l.queue_free)


## the countdown: whole seconds, minutes and seconds over a minute, tenths and the bad colour in the last ten
func timer(secs) -> void:
	if secs == null:
		timer_el.text = ""
		return
	var v: float = max(0.0, float(secs))
	timer_el.text = ("%d:%02d" % [int(v) / 60, int(v) % 60]) if v >= 60.0 else (("%.1f" % v) if v < 10.0 else ("%d" % int(ceil(v))))
	var c := ThemeC.colors(theme_name)
	timer_el.add_theme_color_override("font_color", c["bad"] if v < 10.0 else c["text"])


func board(text) -> void:
	board_el.text = str(text if text != null else "")


func seen(k: float) -> void:
	seen_el.visible = k > 0.01
	seen_el.value = min(1.0, k) * 100.0


func set_stance(s: String) -> void:
	stance_el.text = s.to_upper()
	fade(vignette, 1.0 if s == "hidden" else 0.0, 0.7)       # hidden: the dark closes in round the edge


func locked(on: bool) -> void:
	hint_el.visible = not on and not modal_up


func peep(on: bool) -> void:
	peep_el.visible = on


func progress(p) -> void:
	cursor_el.progress = clampf(float(p), 0.0, 1.0) if p != null else -1.0


func hint_key(k: String, w: String) -> void:
	hints[k + ":" + w] = true
	_draw_hints()
	_hint_fresh()


## a key as a chip: a frosted tile, the legend in it (the menu's, smaller)
func _chip(text: String) -> PanelContainer:
	var c := ThemeC.colors(theme_name)
	var p := PanelContainer.new()
	var sb := ThemeC.box(c, 6, Color(1, 1, 1, 0.07) if c["shadow"] else c["key_bg"], Color(1, 1, 1, 0.16) if c["shadow"] else Color(0.7, 0.72, 0.76))
	sb.content_margin_left = 7
	sb.content_margin_right = 7
	sb.content_margin_top = 1
	sb.content_margin_bottom = 2
	sb.shadow_size = 0
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := _label(text, 12)
	l.add_theme_color_override("font_color", c["key_text"])
	p.add_child(l)
	return p


func _draw_hints() -> void:
	for ch in hint_el.get_children():
		hint_el.remove_child(ch)
		ch.queue_free()
	var c := ThemeC.colors(theme_name)
	for h in hints:
		var kv: PackedStringArray = str(h).split(":", true, 1)
		var pair := HBoxContainer.new()
		pair.add_theme_constant_override("separation", 7)
		pair.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var keys := HBoxContainer.new()                          # W A S D: a chip each; a word (Shift, Click): one
		keys.add_theme_constant_override("separation", 3)
		keys.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var toks: PackedStringArray = kv[0].split(" ")
		var singles := toks.size() > 1
		for tk in toks:
			singles = singles and tk.length() == 1
		for tk in (toks if singles else PackedStringArray([kv[0]])):
			keys.add_child(_chip(tk))
		pair.add_child(keys)
		var w := _label(kv[1] if kv.size() > 1 else "", 13)
		w.add_theme_color_override("font_color", c["muted"])
		w.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		pair.add_child(w)
		hint_el.add_child(pair)


## the keys full for a while after one is new, then at rest
func _hint_fresh() -> void:
	hint_el.modulate.a = 1.0
	if hint_tw != null and hint_tw.is_valid():
		hint_tw.kill()
	hint_tw = create_tween()
	hint_tw.tween_interval(9.0)
	hint_tw.tween_property(hint_el, "modulate:a", HINT_REST, 2.0).set_trans(Tween.TRANS_SINE)


func press() -> void:
	cursor_el.press = 1.0                                         # the ring squeezes a moment


func shake() -> void:
	pass


func modal(up: bool) -> void:
	modal_up = up
	if guide != null:
		guide.modal = up                              # the marker steps back behind a card or a choice
	if up:
		hint_el.visible = false
	cursor_el.visible = not up                    # no dot and no "Look" over a card (the user's note, 2026-10-29)
	prompt_el.visible = not up


## the inventory's row: the things themselves, scaled into the slots. Each shown slot is a small viewport with a world
## of its own (its own lights and air) holding a copy of the thing's mesh, fitted to the slot and seen three-quarters
## from above; the one in the hand bigger, turning slowly, its name under it. Only the shown slots have a viewport (at
## most SHOWN): the side ones are drawn once when the row changes, the middle one every frame while the row shows;
## a thing scrolled out of the row has no model anywhere. (The common way: the model in a render target, not a picture.)
const SLOT := 56
var inv_models: Dictionary = {}       # id -> the icon's model (a copy of the thing), kept while it's in the row
var inv_turn: Array = []              # the pivots to turn (the middle slot's)


func inventory(list: Array, at: int, shown: bool, peek: bool, lowered: bool = false) -> void:
	for c in inv_box.get_children():
		var m = c.get_meta("model") if c.has_meta("model") else null
		if m != null and is_instance_valid(m) and m.get_parent() != null:
			m.get_parent().remove_child(m)                 # the model outlives its slot
		c.queue_free()
	inv_turn = []
	var ids := {}
	for it in list:
		ids[it["id"]] = true
	for id in inv_models.keys():
		if not ids.has(id):
			if is_instance_valid(inv_models[id]):
				inv_models[id].queue_free()
			inv_models.erase(id)
	var n := list.size()
	var row: Array = []                                # [d, item]: the hand's in the middle, the others either side
	for i in n:
		var d := i - at
		if n > 0:
			d = posmod(i - at, n)
			if d > n / 2:
				d -= n
		if abs(d) > (SHOWN - 1) / 2:
			continue
		row.append([d, list[i]])
	row.sort_custom(func(a, b): return a[0] < b[0])
	for r in row:
		var sl := inv_slot(r[1], r[0])
		if r[0] == 0 and lowered:                       # the thing in the hand lowered (Q): its slot dim, its name says so
			sl.modulate = Color(1, 1, 1, 0.4)
		inv_box.add_child(sl)
	inv_name.text = (named(list[at]["name"]) + ("  (lowered: Q or the wheel)" if lowered else "")) if (at >= 0 and at < n) else ""
	inv_box.visible = n > 0 and shown
	inv_name.visible = inv_box.visible
	hint_el.offset_bottom = -24.0 - (SLOT + 56 if inv_box.visible else 0)   # the hints lifted over the row


## one slot: a frosted panel, the viewport, its world (a cool fill, a warm key, a rim), the camera and the model
func inv_slot(it: Dictionary, d: int) -> Control:
	var box := PanelContainer.new()
	box.name = "Slot_" + str(it["id"])
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.07) if d == 0 else Color(1, 1, 1, 0.0)    # no border: the band is the glass
	sb.set_corner_radius_all(8)
	sb.set_content_margin_all(2)
	box.add_theme_stylebox_override("panel", sb)
	box.set_meta("d", d)
	box.set_meta("id", it["id"])
	if d != 0:
		box.modulate = Color(1, 1, 1, 0.55 if abs(d) == 1 else 0.3)
	var sz := SLOT + (20 if d == 0 else 0)
	var model = inv_models.get(it["id"])
	if model == null or not is_instance_valid(model):
		model = it.get("model")
		if model == null or not is_instance_valid(model):
			model = inv_placeholder(it)
		inv_models[it["id"]] = model
	var vc := HSModelSlot.make(model, Vector2i(sz, sz), d == 0)    # the slot's world, camera and the model fitted
	box.add_child(vc)
	var turn: Node3D = vc.get_meta("turn")
	box.set_meta("model", model)
	if d == 0:
		inv_turn.append(turn)
	return box


func _exit_tree() -> void:
	for id in inv_models:                              # the models out of the row's slots have no parent: freed by hand
		var m = inv_models[id]
		if is_instance_valid(m) and not m.is_inside_tree():
			m.free()
	inv_models = {}


## a thing with no mesh to copy (a pickup whose art never loaded): a small box in its place
static func inv_placeholder(it: Dictionary) -> Node3D:
	var mi := MeshInstance3D.new()
	mi.name = "placeholder"
	var bm := BoxMesh.new()
	bm.size = Vector3(0.2, 0.2, 0.2)
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.6, 0.6, 0.6)
	mi.material_override = m
	return mi


## the meshes' bounds under a node, in that node's space (the node need not be in the tree): HSModelSlot's
static func bounds_of(n: Node3D) -> AABB:
	return HSModelSlot.bounds_of(n)


func _process(delta: float) -> void:
	tick(delta)


func tick(dt: float = 0.0) -> void:
	type_tick(dt)
	_sync_halo()
	if auto_markers:
		_auto_guide(dt)
	if inv_box.visible:
		for t in inv_turn:
			if is_instance_valid(t):
				t.rotation.y += dt * 0.7                   # the one in the hand turns on its slot
	if line_until > 0 and Time.get_ticks_msec() / 1000.0 > line_until:
		line_text = ""
		line_until = 0.0
		_scrim()
		fade(line_el, 0.0, 0.3)
		fade_then(who_el, 0.0, 0.3, _line_cleared)


## the guide fed from the scene (by hand): every HSQuestMarker shown (active, its needs holding), its name, and whether
## there's a clear line to it
func _auto_guide(dt: float) -> void:
	var cam := get_viewport().get_camera_3d()
	var targets := {}
	var seen := {}
	var names := {}
	if cam != null and guide.mode > 0:
		for n in get_tree().get_nodes_in_group("hs_quest_marker"):
			if not ((n.shown() if n.has_method("shown") else n.get("active")) and (n as Node3D).is_visible_in_tree()):
				continue
			var id := str(n.get_path())
			var top: Vector3 = n.top()
			targets[id] = top
			names[id] = str(n.label)
			seen[id] = _clear_line(id, cam.global_position, top, int(n.sight_mask))
	guide.update(targets, cam, dt, {"seen": seen, "names": names, "aimed": ""})


## is there a clear line from the eye to that point (nothing in `mask` between, near it excepted: its own collider)
func _clear_line(id: String, eye: Vector3, p: Vector3, mask: int) -> bool:
	var now := Time.get_ticks_msec()
	var e = _los.get(id)
	if e != null and now - int(e["at"]) < 120:
		return bool(e["clear"])
	var to := p + Vector3(0, 0.15, 0)
	var w := get_viewport().find_world_3d()
	var clear := true
	if w != null:
		var hit: Dictionary = w.direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(eye, to, mask))
		clear = hit.is_empty() or eye.distance_to(hit["position"]) > eye.distance_to(to) - 0.35
	_los[id] = {"clear": clear, "at": now}
	return clear


func _line_cleared() -> void:
	if line_text == "" and choice_over:
		line_el.text = ""
		who_el.text = ""


func fade_alpha() -> float:
	return fade_el.color.a


func set_fade(a: float) -> void:
	fade_el.color = Color(0, 0, 0, clamp(a, 0.0, 1.0))


# ---- cards: a panel to read, a code lock, the player's name; resolves through panel_done ----
func panel(spec: Dictionary) -> Variant:
	if panel_el != null:
		panel_el.queue_free()
	if card_halo != null:
		card_halo.queue_free()
		card_halo = null
	panel_spec = spec
	panel_typed = ""
	panel_el = PanelContainer.new()
	panel_el.name = "Panel"
	var pc := ThemeC.colors(theme_name)
	var ghost: bool = pc.get("ghost", false)
	if ghost:                                         # no panel to see: its margins, and a soft dark behind the words (a halo)
		var pad := StyleBoxEmpty.new()
		pad.content_margin_left = 28.0
		pad.content_margin_right = 28.0
		pad.content_margin_top = 20.0
		pad.content_margin_bottom = 18.0
		panel_el.add_theme_stylebox_override("panel", pad)
	if spec.get("side", false):                   # beside a book in the hands: a column at the right, its words in the HUD's own font
		panel_el.anchor_left = 1.0
		panel_el.anchor_right = 1.0
		panel_el.anchor_top = 0.0
		panel_el.anchor_bottom = 1.0
		panel_el.offset_left = -470
		panel_el.offset_right = -36
		panel_el.offset_top = 48
		panel_el.offset_bottom = -64
		panel_el.grow_horizontal = Control.GROW_DIRECTION_BEGIN
		panel_el.custom_minimum_size = Vector2(430, 0)
	elif spec.get("low", false):                  # under a thing in the hands: low on the screen, growing up from its foot
		panel_el.anchor_left = 0.5
		panel_el.anchor_right = 0.5
		panel_el.anchor_top = 1.0
		panel_el.anchor_bottom = 1.0
		panel_el.offset_top = -36
		panel_el.offset_bottom = -36
		panel_el.grow_horizontal = Control.GROW_DIRECTION_BOTH
		panel_el.grow_vertical = Control.GROW_DIRECTION_BEGIN
		panel_el.custom_minimum_size = Vector2(520, 0)
	else:
		panel_el.set_anchors_preset(Control.PRESET_CENTER)
		panel_el.position = Vector2(-260, -160)
		panel_el.custom_minimum_size = Vector2(520, 200)
	var v := VBoxContainer.new()
	panel_el.add_child(v)
	var title := _label(named(spec.get("title", "")), 20)
	title.name = "Title"
	if ThemeC.serif(pc) != null:                       # the voice of what's written: a serif
		title.add_theme_font_override("font", ThemeC.serif(pc, false, true))
	v.add_child(title)
	if spec.has("name"):
		var inp := LineEdit.new()
		inp.name = "Name"
		inp.placeholder_text = str(spec["name"])
		inp.max_length = 20
		v.add_child(inp)
		inp.text_submitted.connect(func(t): _finish_panel(t.strip_edges() if t.strip_edges() != "" else spec["name"]))
		inp.call_deferred("grab_focus")
		v.add_child(_label("Enter  OK   ·   Esc", 12))
	elif spec.has("code"):
		var shown := _label("·".repeat(int(spec["code"])), 22)
		shown.name = "Code"
		v.add_child(shown)
		v.add_child(_label("type the digits, Enter OK, Backspace, Esc", 12))
	elif spec.get("side", false):
		var sc := ScrollContainer.new()
		sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
		sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		var text := _label(named(spec.get("text", "")), 17)
		text.name = "Text"
		text.add_theme_constant_override("line_spacing", 5)
		text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.custom_minimum_size = Vector2(400, 0)
		text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sc.add_child(text)
		v.add_child(sc)
		v.add_child(_label(str(spec.get("hint", "Esc or right click  Put it back")), 12))
	else:
		var text := _label(named(spec.get("text", "")), 17)
		text.name = "Text"
		text.add_theme_constant_override("line_spacing", 5)
		if ThemeC.serif(pc) != null:
			text.add_theme_font_override("font", ThemeC.serif(pc))
		text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.custom_minimum_size = Vector2(500, 0)
		v.add_child(text)
		var hint := _label(str(spec.get("hint", "Esc or click  Close")), 12)
		hint.add_theme_color_override("font_color", pc["muted"])
		v.add_child(hint)
	if not spec.get("side", false) and not spec.get("low", false) and not spec.has("name") and not spec.has("code"):
		_veil(true)                                       # a card to read: the world dims behind it (not for a book or a thing in the hands: those stay in view)
	if ghost:
		var hf := 100.0 if (spec.get("side", false) or spec.get("low", false)) else 160.0
		card_halo = halo(pc, hf, 0.78 if spec.get("side", false) else 0.30)
		card_halo.set_meta("feather", hf)
		card_halo.modulate.a = 0.0
		fade(card_halo, 1.0, 0.25)
		root.add_child(card_halo)
	panel_el.modulate.a = 0.0
	fade(panel_el, 1.0, 0.2)
	root.add_child(panel_el)
	modal(true)
	var v2 = await panel_done
	return v2


## the words on the card up now (a book's spread turned)
func panel_text(text: String) -> void:
	if panel_el == null:
		return
	var l = panel_el.find_child("Text", true, false)
	if l != null:
		l.text = named(text)


func _finish_panel(v) -> void:
	if panel_el == null:
		return
	panel_el.queue_free()
	panel_el = null
	if card_halo != null:
		card_halo.queue_free()
		card_halo = null
	_veil(false)
	modal(false)
	panel_done.emit(v)


## a click while a card of words is up puts it away (a name or a code card keeps waiting for its keys): true when it took it
func panel_click() -> bool:
	if panel_el == null or panel_spec.has("name") or panel_spec.has("code"):
		return false
	_finish_panel(true)
	return true


## a key while a card is up: true when it took it
func panel_key(key: String) -> bool:
	if panel_el == null:
		return false
	if panel_spec.has("name"):
		if key == "Escape":
			_finish_panel(panel_spec["name"])
		return true
	if panel_spec.has("code"):
		var n := int(panel_spec["code"])
		if key.length() == 1 and key >= "0" and key <= "9":
			if panel_typed.length() < n:
				panel_typed += key
		elif key == "Backspace":
			panel_typed = panel_typed.substr(0, max(0, panel_typed.length() - 1))
		elif key == "Enter":
			_finish_panel(panel_typed)
			return true
		elif key == "Escape":
			_finish_panel(null)
			return true
		var shown = panel_el.find_child("Code", true, false)
		if shown:
			shown.text = panel_typed + "·".repeat(max(0, n - panel_typed.length()))
		return true
	if key == "Escape" or key == "Enter":
		_finish_panel(true)
	return true


## a choice (the story's ask, a reply, a scene's choice): the question is the footer's line, the answers on one line
## right under it with a dash between (two at most: the story check warns past that), the footer lowered toward the
## screen's foot while it's up; A and D (or the arrows) move between them, Enter picks, the mouse points and clicks;
## no numbers (the user, 2026-10-30, evening); never timed (no quick-time events, the player must choose); resolves
## with the index picked through choice_done
func choose(spec: Dictionary) -> Variant:
	choice_spec = spec
	choice_over = false
	choice_sel = 0
	for c in choice_el.get_children():
		choice_el.remove_child(c)
		c.queue_free()
	var opts: Array = spec.get("options", [])
	for i in opts.size():
		var o = opts[i]
		var lab: String = named(o.get("label", "") if o is Dictionary else o)
		var think = o.get("think") if o is Dictionary else null
		if i > 0:
			var dash := _label("—", 18)                 # the dash between, as quiet as the dimmed answers
			dash.name = "Dash%d" % i
			dash.modulate = Color(1, 1, 1, CHOICE_DIM)
			choice_el.add_child(dash)
		var b := _choice_row(i, lab, named(think) if think != null else "")
		choice_el.add_child(b)
	if spec.get("prompt") != null and str(spec["prompt"]) != "":
		line_el.text = named(spec["prompt"])
		line_text = named(spec["prompt"])
		who_el.text = named(spec.get("who", "") if spec.get("who") != null else "")
		line_until = 0.0
	choice_box.visible = true
	_scrim()
	fade(line_el, 1.0, 0.18)
	fade(who_el, 1.0, 0.18)
	foot.offset_bottom = -FOOT_CHOOSING                 # lower while choosing: the panel near the screen's foot, under what's looked at
	modal(true)
	_mark_choice()
	choosing.emit(true)
	var i = await choice_done
	return i


## an answer as the dialogue's words, its thought under it, centred and shadowed as the lines are,
## no box and no colour of its own; the answers wait dimmed, and the one under the mouse (or the keys) comes up to the
## lines' full white (the user, 2026-10-30, evening: a glow and the accent "pop out too much and break the horror
## immersion"); a click picks it
const CHOICE_DIM := 0.5                   # how much of the lines' brightness an answer not pointed at keeps


func _choice_row(i: int, lab: String, think: String) -> Button:
	var c := ThemeC.colors(theme_name)
	var b := Button.new()
	b.name = "Opt%d" % i
	b.set_meta("label", lab)
	b.text = "%s%s" % [lab, ("\n" + think) if think != "" else ""]
	b.alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_STOP
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.add_theme_font_size_override("font_size", 18)
	var voice: Font = ThemeC.serif(c)
	if voice != null:
		b.add_theme_font_override("font", voice)                           # the voice of the lines
	b.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8 if c["shadow"] else 0.0))   # the lines' dark edge
	b.add_theme_constant_override("outline_size", 4 if c["shadow"] else 0)
	var pad := StyleBoxEmpty.new()
	pad.content_margin_left = 18
	pad.content_margin_right = 18
	pad.content_margin_top = 3
	pad.content_margin_bottom = 3
	for st in ["normal", "focus", "disabled", "hover", "pressed", "hover_pressed"]:
		b.add_theme_stylebox_override(st, pad)
	var full: Color = c["text"]
	for fc in ["font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(fc, full)
	b.mouse_entered.connect(_choice_hover.bind(i))
	b.pressed.connect(_finish_choice.bind(i))
	return b


func _choice_hover(i: int) -> void:
	choice_sel = i
	_mark_choice()


func _mark_choice() -> void:
	var full: Color = ThemeC.colors(theme_name)["text"]
	var dim := Color(full.r, full.g, full.b, full.a * CHOICE_DIM)
	var i := 0
	for c in choice_el.get_children():
		if c.has_meta("label"):
			for fc in ["font_color", "font_focus_color"]:
				c.add_theme_color_override(fc, full if i == choice_sel else dim)   # the one pointed at as bright as the lines, the rest waiting dimmed
			i += 1


func _finish_choice(i: int) -> void:
	if choice_over:
		return
	choice_over = true
	choice_box.visible = false
	_scrim()
	foot.offset_bottom = -FOOT_REST                     # the lines back where they sit
	if choice_spec.get("prompt") != null:
		line_el.text = ""
		line_text = ""
		who_el.text = ""
	modal(false)
	choosing.emit(false)
	choice_done.emit(i)


func choice_key(key: String) -> bool:
	if choice_over:
		return false
	var n: int = choice_spec.get("options", []).size()
	if key == "A" or key == "Left":                    # the answers on one line: A and D (or the arrows) move, Enter picks; no numbers
		choice_sel = max(0, choice_sel - 1)
		_mark_choice()
		return true
	if key == "D" or key == "Right":
		choice_sel = min(n - 1, choice_sel + 1)
		_mark_choice()
		return true
	if key == "Enter" or key == "Kp Enter" or key == "Space":
		_finish_choice(choice_sel)
		return true
	return true


## the k-th answer (1-based) picked as a player does: D (or A) to it, then Enter (the checks')
func choice_pick(k: int) -> void:
	while choice_sel < k - 1:
		choice_key("D")
	while choice_sel > k - 1:
		choice_key("A")
	choice_key("Enter")


func choice_options() -> Array:
	var out: Array = []
	for c in choice_el.get_children():
		if c.has_meta("label"):
			out.append(c.get_meta("label"))
	return out


## a thing looked at: its card, under it when it's in the hands (play.gd examine)
func examine(spec: Dictionary) -> Variant:
	if spec.get("held", false):
		return await panel({"title": spec.get("title", ""), "text": spec.get("text", ""), "low": true, "hint": "Drag to turn it   ·   Esc or click  Put it back"})
	return await panel({"title": spec.get("title", ""), "text": spec.get("text", "")})
