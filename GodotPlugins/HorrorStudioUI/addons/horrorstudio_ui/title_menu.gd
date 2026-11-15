@icon("res://addons/horrorstudio_ui/icons/titlemenu.svg")
class_name HSTitleMenu
extends Control
## The game's main menu (the user, 2026-11-15: "a main menu screen ... then main menu"): its name, then Continue (the
## newest save), New game, Load game (the saves there are), Settings (the pause menu's own pages) and Quit, in the HUD's
## look: words over the dark, the one picked in the accent with the pause menu's ›, no panels. W S or the arrows and Enter,
## Esc back, or the mouse. It starts `game_scene`; Continue and Load game tell the game which save to load as it starts
## (the tree's meta `hs_load_slot`: the starter Story reads it). The saves are the starter Story's
## (user://hs_save_<n>.save; 0 the Autosave), their words the pause menu's (user://saves_<game>.json).
## Put it as a scene's root (the project maker's menu.tscn). Yours to change: `title`, `subtitle`, `backdrop`, `game_scene`.

signal started(slot: int)                             ## the game's on its way: the save it loads (-1 a new game)

const MenuC := preload("res://addons/horrorstudio_ui/menu.gd")
const ThemeC := preload("res://addons/horrorstudio_ui/theme.gd")
const HudScript := preload("res://addons/horrorstudio_ui/hud.gd")
## the settings that do something in a game by hand (as the starter's pause.gd shows them)
const ROWS := ["window", "resolution", "vsync", "fps", "brightness", "guide", "scale", "aa", "master", "music", "sfx", "sub_size"]

@export var title := ""                               ## the game's name (empty: the project's)
@export var subtitle := ""                            ## a line under it
@export_file("*.tscn") var game_scene := "res://main.tscn"   ## what New game starts (Continue and Load game open the scene a save was made in)
@export var backdrop: Texture2D                       ## a picture behind it (none: the dark)
@export var theme_name := ""                          ## the UI plugin's theme (empty: the project's, horrorstudio/ui/theme)

var page := "root"                                    ## root or load
var items: Array = []                                 ## what's listed: {label, act, el}
var idx := 0
var settings_up := false
var c: Dictionary = {}
var _list: VBoxContainer
var _head: VBoxContainer
var _note: Label
var _hud: Node = null                                 # an HSHud while Settings is up (menu.gd lives on one), freed after
var _going := false
var _shown_ms := 0                                    # when the list was shown (the pointer put back by the game's mouse isn't a hover)


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var tn := theme_name if theme_name != "" else str(ProjectSettings.get_setting("horrorstudio/ui/theme", "glass"))
	c = ThemeC.colors(tn)
	theme = ThemeC.make(tn)
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.03, 0.035)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if backdrop != null:
		var tr := TextureRect.new()
		tr.texture = backdrop
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		tr.modulate = Color(1, 1, 1, 0.55)
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(tr)
		tr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var left := MarginContainer.new()
	left.add_theme_constant_override("margin_left", 96)
	left.add_theme_constant_override("margin_top", 120)
	left.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(left)
	left.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 36)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	left.add_child(col)
	_head = VBoxContainer.new()
	_head.add_theme_constant_override("separation", 6)
	col.add_child(_head)
	var t := Label.new()
	t.name = "Title"
	t.text = title if title != "" else str(ProjectSettings.get_setting("application/config/name", ""))
	t.add_theme_font_size_override("font_size", 64)
	t.add_theme_color_override("font_color", c["text"])
	var serif: Font = ThemeC.serif(c)
	if serif != null:
		t.add_theme_font_override("font", serif)
	_head.add_child(t)
	if subtitle != "":
		var st := Label.new()
		st.text = subtitle
		st.add_theme_font_size_override("font_size", 18)
		st.add_theme_color_override("font_color", c["muted"])
		_head.add_child(st)
	_list = VBoxContainer.new()
	_list.name = "List"
	_list.add_theme_constant_override("separation", 6)
	col.add_child(_list)
	_note = Label.new()
	_note.add_theme_font_size_override("font_size", 13)
	_note.add_theme_color_override("font_color", c["muted"])
	_note.anchor_top = 1.0
	_note.anchor_bottom = 1.0
	_note.offset_left = 96
	_note.offset_top = -64
	_note.text = "W S  move     Enter  select     Esc  back"
	add_child(_note)
	MenuC.apply(MenuC.load_settings(), null)          # (the window, VSync, the frame rate and the volumes as the player left them)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	show_page("root")


## the game's saves: slot -> its file's time (the Story's user://hs_save_<n>.save)
static func saves() -> Dictionary:
	var out := {}
	for n in [0, 1, 2, 3]:
		var f := "user://hs_save_%d.save" % n
		if FileAccess.file_exists(f):
			out[n] = FileAccess.get_modified_time(f)
	return out


## the scene a save was made in (the Story writes it: "" when it can't be read)
static func scene_of(slot: int) -> String:
	var f := "user://hs_save_%d.save" % slot
	if not FileAccess.file_exists(f):
		return ""
	var d = str_to_var(FileAccess.get_file_as_string(f))
	return str((d as Dictionary).get("scene", "")) if d is Dictionary else ""


## the newest save's slot (-1: none)
static func newest() -> int:
	var best := -1
	var at := -1
	var s := saves()
	for n in s:
		if int(s[n]) > at:
			at = int(s[n])
			best = n
	return best


func game_id() -> String:
	var out := ""
	for ch in str(ProjectSettings.get_setting("application/config/name", "game")).to_lower():
		out += ch if (ch >= "a" and ch <= "z") or (ch >= "0" and ch <= "9") else "_"
	return out if out.strip_edges() != "" else "game"


func show_page(p: String) -> void:
	page = p
	items = []
	_shown_ms = Time.get_ticks_msec()
	for ch in _list.get_children():
		ch.queue_free()
	if p == "root":
		if newest() >= 0:
			_add("Continue", func(): start(newest()))
		_add("New game", func(): start(-1))
		if not saves().is_empty():
			_add("Load game", func(): show_page("load"))
		_add("Settings", open_settings)
		_add("Quit", func(): get_tree().quit())
	else:
		var words = MenuC.read_json(MenuC.saves_file(game_id()), {})
		var sv: Dictionary = saves()
		for n in [0, 1, 2, 3]:
			if sv.has(n):
				var w = (words as Dictionary).get("auto" if n == 0 else str(n)) if words is Dictionary else null
				var about := ""
				if w is Dictionary:
					about = "%s  ·  %s played" % [str(w.get("where", "")), MenuC.clock(float(w.get("secs", 0)))]
				_add(("Autosave" if n == 0 else "Slot %d" % n) + ("     " + about if about != "" else ""), func(): start(n))
		_add("Back", func(): show_page("root"))
	focus(0)


func _add(label: String, act: Callable) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	var mark := Label.new()
	mark.text = " "
	mark.add_theme_font_size_override("font_size", 24)
	mark.add_theme_color_override("font_color", c["accent"])
	var l := Label.new()
	l.text = label
	l.add_theme_font_size_override("font_size", 24)
	l.add_theme_color_override("font_color", c["muted"])
	row.add_child(mark)
	row.add_child(l)
	row.mouse_filter = Control.MOUSE_FILTER_STOP
	var i := items.size()
	row.gui_input.connect(func(e: InputEvent):            # (the mouse moved over it: not a row laid out under where it rests)
		if e is InputEventMouseMotion and idx != i and Time.get_ticks_msec() - _shown_ms > 500 and (e as InputEventMouseMotion).relative.length() > 0.5:
			focus(i)
		elif e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
			focus(i)
			act.call())
	_list.add_child(row)
	items.append({"label": label, "act": act, "mark": mark, "text": l})


func focus(i: int) -> void:
	idx = clampi(i, 0, maxi(0, items.size() - 1))
	for j in items.size():
		var on: bool = j == idx
		(items[j]["mark"] as Label).text = "›" if on else " "
		(items[j]["text"] as Label).add_theme_color_override("font_color", c["accent"] if on else c["muted"])


## the game started: a new one (-1), or with the save in `slot` loaded as it starts
func start(slot: int) -> void:
	if _going:
		return
	_going = true
	if slot >= 0:
		get_tree().set_meta("hs_load_slot", slot)
	elif get_tree().has_meta("hs_load_slot"):
		get_tree().remove_meta("hs_load_slot")
	started.emit(slot)
	var go := game_scene
	var made_in := scene_of(slot) if slot >= 0 else ""
	if made_in != "" and ResourceLoader.exists(made_in):       # (a game of several scenes: the one the save was made in)
		go = made_in
	if go != "" and ResourceLoader.exists(go):
		get_tree().change_scene_to_file.call_deferred(go)


## the pause menu's Settings pages, on an HSHud of its own (freed when they're shut)
func open_settings() -> void:
	if settings_up:
		return
	settings_up = true
	_hud = CanvasLayer.new()
	_hud.set_script(HudScript)
	add_child(_hud)
	await get_tree().process_frame
	var m = _hud.call("make_menu")
	if m == null:
		settings_up = false
		return
	await m.call("open", {"game": game_id(), "where": "", "secs": 0.0, "has": {}, "rows": ROWS, "settings_only": true})
	settings_up = false
	_hud.queue_free()
	_hud = null
	focus(idx)


func _input(e: InputEvent) -> void:
	if not (e is InputEventKey) or not e.pressed or e.echo:
		return
	if settings_up:
		get_viewport().set_input_as_handled()
		var code := OS.get_keycode_string(e.physical_keycode)
		if code == "Kp Enter":
			code = "Enter"
		if _hud != null and _hud.get("menu") != null:
			_hud.get("menu").call("key", code)
		return
	match e.physical_keycode:
		KEY_W, KEY_UP:
			focus(idx - 1)
		KEY_S, KEY_DOWN:
			focus(idx + 1)
		KEY_ENTER, KEY_KP_ENTER, KEY_SPACE:
			if idx < items.size():
				(items[idx]["act"] as Callable).call()
		KEY_ESCAPE, KEY_BACKSPACE:
			if page != "root":
				show_page("root")
		_:
			return
	get_viewport().set_input_as_handled()
