## The pause menu (Esc in Play; docs/GAMEPLAY_PLAN.md §10; the desk's play/menu.js, ported): the game holds, the lights
## go out (the frame darkens) and the menu is drawn over it in the HUD's theme. The controls on the left (each key as a
## tile with what it does beside it), then Resume, Save game (slots and the autosave), Settings (Display, Graphics,
## Audio: rows stepped with ‹ › (A/D), never a slider; levels as ten dashes), Quit (a footer choice). Every setting
## keeps the desk's name and its Unreal name (`ue`); what Godot can apply, it applies (`apply`): the window mode, VSync,
## the frame rate limit, brightness, the volumes, the subtitles. Settings in user://horrorstudio_settings.json, the
## saves in user://saves_<game>.json. open(ctx) returns "resume", "escaped" or {"quit": "title" | "desktop"}.
extends Control

const ThemeC := preload("res://addons/horrorstudio/theme.gd")
const ONOFF := ["Off", "On"]
const QUALITY := ["Low", "Medium", "High", "Epic"]
const SETTINGS := [
	{"id": "display", "title": "Display", "groups": [
		{"title": "Display", "rows": [
			{"id": "window", "label": "Window mode", "values": ["Fullscreen", "Borderless", "Windowed"], "def": 1, "ue": "r.FullScreenMode", "godot": "DisplayServer.window_set_mode"},
			{"id": "resolution", "label": "Resolution", "values": ["1280 × 720", "1600 × 900", "1920 × 1080", "2560 × 1440", "3840 × 2160"], "def": 2, "ue": "r.SetRes", "godot": "DisplayServer.window_set_size"},
			{"id": "vsync", "label": "VSync", "values": ONOFF, "def": 1, "ue": "r.VSync", "godot": "DisplayServer.window_set_vsync_mode"},
			{"id": "fps", "label": "Frame rate limit", "values": ["30", "60", "120", "144", "Unlimited"], "def": 1, "ue": "t.MaxFPS", "godot": "Engine.max_fps"},
			{"id": "brightness", "label": "Brightness", "steps": 10, "def": 5, "ue": "r.TonemapperGamma", "godot": "Environment.adjustment_brightness"},
			{"id": "motion_blur", "label": "Motion blur", "values": ONOFF, "def": 0, "ue": "r.MotionBlurQuality", "godot": "(a post effect, later)"},
			{"id": "grain", "label": "Film grain", "values": ONOFF, "def": 1, "ue": "PostProcess FilmGrainIntensity", "godot": "(the camcorder look, later)"}]}]},
	{"id": "graphics", "title": "Graphics", "groups": [
		{"title": "Graphics", "rows": [
			{"id": "quality", "label": "Quality", "values": ["Low", "Medium", "High", "Epic", "Custom"], "def": 2, "ue": "scalability <0-3>"},
			{"id": "scale", "label": "Resolution scale", "values": ["50 %", "67 %", "75 %", "100 %"], "def": 3, "ue": "r.ScreenPercentage", "godot": "Viewport.scaling_3d_scale"},
			{"id": "aa", "label": "Anti-aliasing", "values": ["Off", "FXAA", "TAA", "TSR"], "def": 3, "ue": "r.AntiAliasingMethod", "godot": "Viewport.screen_space_aa / use_taa"},
			{"id": "shadows", "label": "Shadows", "values": QUALITY, "def": 2, "sg": true, "ue": "sg.ShadowQuality", "godot": "rendering/lights_and_shadows"},
			{"id": "gi", "label": "Global illumination", "values": QUALITY, "def": 2, "sg": true, "ue": "sg.GlobalIlluminationQuality", "godot": "rendering/global_illumination"},
			{"id": "reflections", "label": "Reflections", "values": QUALITY, "def": 2, "sg": true, "ue": "sg.ReflectionQuality", "godot": "Environment.ssr"},
			{"id": "textures", "label": "Textures", "values": QUALITY, "def": 2, "sg": true, "ue": "sg.TextureQuality", "godot": "rendering/textures"},
			{"id": "effects", "label": "Effects", "values": QUALITY, "def": 2, "sg": true, "ue": "sg.EffectsQuality", "godot": "the little things' puffs"},
			{"id": "post", "label": "Post-processing", "values": QUALITY, "def": 2, "sg": true, "ue": "sg.PostProcessQuality", "godot": "Environment.glow / ssao"},
			{"id": "view", "label": "View distance", "values": QUALITY, "def": 2, "sg": true, "ue": "sg.ViewDistanceQuality", "godot": "Camera3D.far"}]}]},
	{"id": "audio", "title": "Audio", "groups": [
		{"title": "Volume", "rows": [
			{"id": "master", "label": "Master", "steps": 10, "def": 8, "ue": "SoundClass Master", "godot": "AudioServer bus Master"},
			{"id": "music", "label": "Music", "steps": 10, "def": 7, "ue": "SoundClass Music", "godot": "AudioServer bus Music"},
			{"id": "sfx", "label": "Effects", "steps": 10, "def": 8, "ue": "SoundClass SFX", "godot": "AudioServer bus SFX"},
			{"id": "voices", "label": "Voices", "steps": 10, "def": 9, "ue": "SoundClass Voice", "godot": "AudioServer bus Voice"},
			{"id": "background", "label": "In the background", "values": ["Mute", "Keep playing"], "def": 0, "ue": "au.UnfocusedVolumeMultiplier", "godot": "audio/general/mute_on_focus_loss"}]},
		{"title": "Subtitles", "rows": [
			{"id": "subs", "label": "Subtitles", "values": ONOFF, "def": 1, "ue": "UI", "godot": "the HUD's line"},
			{"id": "sub_size", "label": "Size", "values": ["Small", "Medium", "Large"], "def": 1, "ue": "UI", "godot": "the HUD's line"}]}]},
]
## the controls, as the menu shows them on its left: the keys (or the mouse), what they do; `only`: while the player has it
const CONTROLS := [
	{"keys": ["W", "A", "S", "D"], "label": "Movement", "ue": "IA_Move"},
	{"mouse": "click", "label": "Interact", "ue": "IA_Interact"},
	{"keys": ["E"], "label": "Inventory", "ue": "IA_Inventory"},
	{"mouse": "wheel", "label": "Switch item", "ue": "IA_InventoryScroll"},
	{"keys": ["G"], "label": "Drop", "ue": "IA_Drop"},
	{"keys": ["Shift"], "label": "Run", "ue": "IA_Run"},
	{"keys": ["C"], "label": "Crouch", "ue": "IA_Crouch"},
	{"keys": ["F"], "label": "Flashlight", "ue": "IA_Flashlight", "only": "torch"},
]
const SETTINGS_FILE := "user://horrorstudio_settings.json"

signal closed(result)

var hud
var up: bool = false
var theme_name: String = "glass"
var c: Dictionary = {}
var s: Dictionary = {}                     # the settings
var saves: Dictionary = {}
var ctx: Dictionary = {}
var at: String = "root"
var col: String = "nav"
var idx: int = 0
var items: Dictionary = {"nav": [], "page": []}
var quit_open: bool = false
var quit_sel: int = 0
var confirm = null
var dark: ColorRect
var controls_box: VBoxContainer
var nav: VBoxContainer
var page: PanelContainer
var page_box: VBoxContainer
var legend: HBoxContainer
var footer: VBoxContainer
var quit_opts: Array = []


static func rows() -> Array:
	var out: Array = []
	for p in SETTINGS:
		for g in p["groups"]:
			for r in g["rows"]:
				out.append(r)
	return out


static func read_json(path: String, def):
	if not FileAccess.file_exists(path):
		return def
	var v = JSON.parse_string(FileAccess.get_file_as_string(path))
	return v if v != null else def


static func write_json(path: String, v) -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(v))
		f.close()


static func load_settings() -> Dictionary:
	var st = read_json(SETTINGS_FILE, {})
	var out: Dictionary = st if st is Dictionary else {}
	for r in rows():
		if not out.has(r["id"]):
			out[r["id"]] = r["def"]
	return out


static func saves_file(game: String) -> String:
	return "user://saves_%s.json" % game


## the autosave slot (a chapter, a checkpoint): where the game was, its time, when
static func autosave(game: String, where: String, secs: float) -> void:
	var sv = read_json(saves_file(game), {})
	var d: Dictionary = sv if sv is Dictionary else {}
	d["auto"] = {"where": where, "secs": secs, "at": Time.get_unix_time_from_system()}
	write_json(saves_file(game), d)


static func clock(secs: float) -> String:
	return "%d:%02d:%02d" % [int(secs / 3600), int(secs / 60) % 60, int(secs) % 60]


func _init(hud_, theme_name_: String) -> void:
	hud = hud_
	theme_name = theme_name_
	c = ThemeC.colors(theme_name)
	name = "Menu"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false
	s = load_settings()


func _ready() -> void:
	dark = ColorRect.new()
	dark.set_anchors_preset(Control.PRESET_FULL_RECT)
	dark.color = Color(c["dark"].r, c["dark"].g, c["dark"].b, 0.96)
	dark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(dark)
	controls_box = VBoxContainer.new()
	controls_box.position = Vector2(48, 90)
	controls_box.add_theme_constant_override("separation", 14)
	add_child(controls_box)
	nav = VBoxContainer.new()
	nav.position = Vector2(48, 90)
	nav.add_theme_constant_override("separation", 4)
	add_child(nav)
	page = PanelContainer.new()
	page.position = Vector2(420, 80)
	page.custom_minimum_size = Vector2(620, 0)
	page_box = VBoxContainer.new()
	page_box.add_theme_constant_override("separation", 6)
	page.add_child(page_box)
	add_child(page)
	legend = HBoxContainer.new()
	legend.position = Vector2(48, 640)
	legend.add_theme_constant_override("separation", 18)
	add_child(legend)
	footer = VBoxContainer.new()
	footer.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	footer.position = Vector2(200, 560)
	footer.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(footer)


func label(text: String, size: int, color = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	if color != null:
		l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func key_tile(k: String) -> PanelContainer:         # a key as a frosted tile standing on its lip, the legend in its middle
	var p := PanelContainer.new()
	var sb := ThemeC.box(c, 8, c["key_bg"], Color(1, 1, 1, 0.24) if c["shadow"] else Color(0.7, 0.72, 0.76))
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 6
	sb.content_margin_bottom = 8
	p.add_theme_stylebox_override("panel", sb)
	p.custom_minimum_size = Vector2(34 if k.length() == 1 else 58, 34)
	var l := label(k, 14, c["key_text"])
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	p.add_child(l)
	return p


func mouse_tile(what: String) -> PanelContainer:    # a mouse without a cable: its left button, or its wheel, lit
	var p := PanelContainer.new()
	var sb := ThemeC.box(c, 14, c["key_bg"], Color(1, 1, 1, 0.3))
	sb.content_margin_left = 8
	sb.content_margin_right = 8
	sb.content_margin_top = 4
	sb.content_margin_bottom = 4
	p.add_theme_stylebox_override("panel", sb)
	p.custom_minimum_size = Vector2(30, 44)
	p.add_child(label("●" if what == "click" else "≡", 13, c["accent"]))
	return p


func controls_panel(has: Dictionary) -> void:
	for ch in controls_box.get_children():
		ch.queue_free()
	for ctl in CONTROLS:
		if ctl.has("only") and not has.get(ctl["only"], false):
			continue
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 20)
		row.tooltip_text = "Unreal: " + str(ctl["ue"])
		var icon := HBoxContainer.new()
		icon.custom_minimum_size = Vector2(140, 0)
		icon.add_theme_constant_override("separation", 4)
		if ctl.has("keys"):
			for k in ctl["keys"]:
				icon.add_child(key_tile(k))
		else:
			icon.add_child(mouse_tile(ctl["mouse"]))
		row.add_child(icon)
		row.add_child(label(ctl["label"], 19, c["text"]))
		controls_box.add_child(row)


func item(column: String, el: Control, act: Callable, change = null) -> Control:
	el.set_meta("act", act)
	el.set_meta("change", change if change != null else Callable())
	items[column].append(el)
	return el


func focus(column: String, i: int) -> void:
	col = column
	idx = clampi(i, 0, max(0, items[column].size() - 1))
	for k in ["nav", "page"]:
		for j in items[k].size():
			var e: Control = items[k][j]
			var on: bool = k == col and j == idx
			if e.has_meta("mark"):
				(e.get_meta("mark") as Label).text = "›" if on else " "
			if e.has_meta("label"):
				(e.get_meta("label") as Label).add_theme_color_override("font_color", c["accent"] if on else (c["text"] if e.get_meta("open", false) else c["muted"]))


func legend_for() -> void:
	for ch in legend.get_children():
		ch.queue_free()
	var pairs: Array = [["A D", "choose"], ["Enter", "select"], ["Esc", "back"]] if quit_open \
		else [["W S", "move"], ["A D", "change"] if (col == "page" and at.begins_with("set:")) else ["Enter", "select"], ["Esc", "resume" if (at == "root" and col == "nav") else "back"]]
	for pr in pairs:
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 6)
		h.add_child(key_tile(pr[0]))
		h.add_child(label(pr[1], 13, c["muted"]))
		legend.add_child(h)


func show_nav() -> void:
	items["nav"] = []
	for ch in nav.get_children():
		ch.queue_free()
	var settings: bool = at.begins_with("set:") or at == "settings"
	nav.add_child(label("Settings" if settings else "Paused", 11, c["muted"]))
	if not settings:
		nav.add_child(label("%s · %s" % [ctx.get("where", ctx.get("game", "")), clock(float(ctx.get("secs", 0)))], 14, c["muted"]))
	var list: Array = []
	if settings:
		for p in SETTINGS:
			list.append([p["title"], func(): open_page("set:" + p["id"]), "set:" + p["id"]])
	else:
		list = [["Resume", func(): close("resume"), ""], ["Save game", func(): open_page("save"), "save"], ["Settings", func(): open_page("set:" + SETTINGS[0]["id"]), "settings"], ["Quit", func(): open_page("quit"), "quit"]]
	for row in list:
		var b := HBoxContainer.new()
		b.add_theme_constant_override("separation", 12)
		var mark := label(" ", 18, c["accent"])
		var l := label(row[0], 18, c["muted"])
		b.add_child(mark)
		b.add_child(l)
		b.set_meta("mark", mark)
		b.set_meta("label", l)
		b.set_meta("open", row[2] == at or (row[2] == "settings" and settings))
		nav.add_child(item("nav", b, row[1]))


func slot_el(name_: String, sv, auto: bool, n = null) -> VBoxContainer:
	var e := VBoxContainer.new()
	e.add_theme_constant_override("separation", 2)
	var l := label(name_, 17, c["text"])
	e.add_child(l)
	e.set_meta("label", l)
	e.add_child(label(str(sv["where"]) if sv != null else ("None yet" if auto else "Empty"), 14, c["muted"]))
	var meta := ""
	if sv != null:
		meta = "%s played · %s" % [clock(float(sv["secs"])), Time.get_datetime_string_from_unix_time(int(sv["at"]), true)]
	if confirm != null and confirm == n:
		meta = "Overwrite?   Enter yes   Esc no"
	e.add_child(label(meta, 12, c["bad"] if (confirm != null and confirm == n) else c["muted"]))
	return e


func save_to(n: int) -> void:
	if saves.has(str(n)) and confirm != n:
		confirm = n
		var i := idx
		show_page()
		focus("page", i)
		return
	saves[str(n)] = {"where": ctx.get("where", ctx.get("game", "")), "secs": float(ctx.get("secs", 0)), "at": Time.get_unix_time_from_system()}
	write_json(saves_file(str(ctx.get("game", "game"))), saves)
	confirm = null
	var i := idx
	show_page()
	focus("page", i)
	hud.log("saved to slot %d" % n)


func row_el(r: Dictionary) -> HBoxContainer:
	var e := HBoxContainer.new()
	e.tooltip_text = "Unreal: %s · Godot: %s" % [r.get("ue", ""), r.get("godot", "")]
	var l := label(r["label"], 15, c["text"])
	l.custom_minimum_size = Vector2(240, 0)
	e.add_child(l)
	e.set_meta("label", l)
	var val := HBoxContainer.new()
	val.add_theme_constant_override("separation", 8)
	val.add_child(label("‹", 16, c["muted"]))
	if r.has("steps"):
		var dashes := ""
		for i in range(1, int(r["steps"]) + 1):
			dashes += "━" if i <= int(s[r["id"]]) else "╌"
		val.add_child(label(dashes, 14, c["accent"]))
		val.add_child(label(str(s[r["id"]]), 14, c["muted"]))
	else:
		val.add_child(label(str(r["values"][int(s[r["id"]])]), 15, c["accent"]))
	val.add_child(label("›", 16, c["muted"]))
	e.add_child(val)
	return e


func show_page() -> void:
	items["page"] = []
	for ch in page_box.get_children():
		ch.queue_free()
	page.visible = at == "save" or at.begins_with("set:")
	controls_box.visible = at == "root" or at == "quit"
	nav.position = Vector2(430, 90) if controls_box.visible else Vector2(48, 90)   # the controls on the left till a page opens
	if at == "save":
		page_box.add_child(label("Save game", 11, c["muted"]))
		page_box.add_child(slot_el("Autosave", saves.get("auto"), true))
		for n in [1, 2, 3]:
			page_box.add_child(item("page", slot_el("Slot %d" % n, saves.get(str(n)), false, n), func(): save_to(n)))
	if at.begins_with("set:"):
		for p in SETTINGS:
			if "set:" + p["id"] != at:
				continue
			for g in p["groups"]:
				page_box.add_child(label(g["title"], 11, c["muted"]))
				for r in g["rows"]:
					page_box.add_child(item("page", row_el(r), func(): step(r, 1), func(d): step(r, d)))


func set_value(r: Dictionary, v: int) -> void:
	s[r["id"]] = v
	if r["id"] == "quality" and v < QUALITY.size():
		for x in rows():
			if x.get("sg", false):
				s[x["id"]] = v
	if r.get("sg", false):
		var same := true
		for x in rows():
			if x.get("sg", false) and int(s[x["id"]]) != v:
				same = false
		s["quality"] = v if same else QUALITY.size()
	write_json(SETTINGS_FILE, s)
	apply(s, hud)
	var i := idx
	show_page()
	focus("page", i)


func step(r: Dictionary, d: int) -> void:
	if r.has("steps"):
		set_value(r, clampi(int(s[r["id"]]) + d, 0, int(r["steps"])))
	else:
		var n: int = (r["values"] as Array).size()
		set_value(r, (int(s[r["id"]]) + d + n) % n)


## what Godot can apply of the settings (the rest wait for the look pass): the window, VSync, the frame rate limit,
## brightness, the volumes, the subtitles
static func apply(st: Dictionary, hud_) -> void:
	if DisplayServer.get_name() != "headless":
		var modes := [DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN, DisplayServer.WINDOW_MODE_FULLSCREEN, DisplayServer.WINDOW_MODE_WINDOWED]
		DisplayServer.window_set_mode(modes[clampi(int(st.get("window", 1)), 0, 2)])
		DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if int(st.get("vsync", 1)) == 1 else DisplayServer.VSYNC_DISABLED)
		if int(st.get("window", 1)) == 2:
			var sizes := [Vector2i(1280, 720), Vector2i(1600, 900), Vector2i(1920, 1080), Vector2i(2560, 1440), Vector2i(3840, 2160)]
			DisplayServer.window_set_size(sizes[clampi(int(st.get("resolution", 2)), 0, 4)])
	Engine.max_fps = [30, 60, 120, 144, 0][clampi(int(st.get("fps", 1)), 0, 4)]
	for pair in [["master", "Master"], ["music", "Music"], ["sfx", "SFX"], ["voices", "Voice"]]:
		var bus := AudioServer.get_bus_index(pair[1])
		if bus >= 0:
			var k: float = float(st.get(pair[0], 8)) / 10.0
			AudioServer.set_bus_volume_db(bus, linear_to_db(max(0.0001, k)))
			AudioServer.set_bus_mute(bus, k <= 0.0)
	if hud_ != null:
		var vhsn = hud_.get_parent().get_node_or_null("VHS") if hud_.get_parent() != null else null
		if vhsn != null:
			vhsn.set_grain_cap(1.0 if int(st.get("grain", 1)) == 1 else 0.0)   # Film grain: the player's cap on the tape's noise
		hud_.subs_on = int(st.get("subs", 1)) == 1
		hud_.sub_scale = [0.85, 1.0, 1.2][clampi(int(st.get("sub_size", 1)), 0, 2)]
		hud_.brightness = 0.6 + float(st.get("brightness", 5)) * 0.08
		hud_.apply_settings()


func ask_quit() -> void:
	quit_open = true
	quit_sel = 0
	for ch in footer.get_children():
		ch.queue_free()
	footer.add_child(label("Leave the game? Anything since your last save is lost.", 18, c["text"]))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 20)
	quit_opts = []
	for o in ["Stay", "Quit to title", "Quit to desktop"]:
		var l := label(o, 16, c["muted"])
		row.add_child(l)
		quit_opts.append(l)
	footer.add_child(row)
	mark_quit()


func mark_quit() -> void:
	for i in quit_opts.size():
		(quit_opts[i] as Label).add_theme_color_override("font_color", c["accent"] if i == quit_sel else c["muted"])


func open_page(p: String) -> void:
	if quit_open:
		quit_open = false
		for ch in footer.get_children():
			ch.queue_free()
	at = p
	confirm = null
	show_nav()
	show_page()
	if p == "quit":
		ask_quit()
		focus("nav", 3)
	elif items["page"].size():
		focus("page", 0)
	else:
		focus("nav", 0)
	legend_for()


func back(esc: bool = false) -> void:
	if confirm != null:
		confirm = null
		var i := idx
		show_page()
		focus("page", i)
		return
	if at == "quit":
		open_page("root")
		return
	if col == "page" and at == "save":
		open_page("root")
		focus("nav", 1)
		return
	if at.begins_with("set:") and col == "page":
		var i := 0
		for k in SETTINGS.size():
			if "set:" + SETTINGS[k]["id"] == at:
				i = k
		col = "nav"
		focus("nav", i)
		legend_for()
		return
	if at.begins_with("set:"):
		open_page("root")
		focus("nav", 2)
		return
	close("escaped" if esc else "resume")


## a key by its name while the menu is up (play.gd routes them here)
func key(code: String) -> void:
	if quit_open:
		if code == "Escape" or code == "Backspace":
			back()
		elif code == "A" or code == "Left":
			quit_sel = (quit_sel + 2) % 3
			mark_quit()
		elif code == "D" or code == "Right":
			quit_sel = (quit_sel + 1) % 3
			mark_quit()
		elif code == "Enter" or code == "Space" or (code.length() == 1 and code >= "1" and code <= "3"):
			var i: int = int(code) - 1 if (code.length() == 1 and code >= "1" and code <= "3") else quit_sel
			if i == 0:
				back()
			else:
				close({"quit": "title" if i == 1 else "desktop"})
		legend_for()
		return
	var cur: Control = items[col][idx] if idx < items[col].size() else null
	if code == "Escape" or code == "Backspace":
		back(code == "Escape")
	elif code == "W" or code == "Up":
		focus(col, idx - 1)
	elif code == "S" or code == "Down":
		focus(col, idx + 1)
	elif (code == "A" or code == "Left") and cur != null and (cur.get_meta("change") as Callable).is_valid():
		(cur.get_meta("change") as Callable).call(-1)
	elif (code == "D" or code == "Right") and cur != null and (cur.get_meta("change") as Callable).is_valid():
		(cur.get_meta("change") as Callable).call(1)
	elif (code == "Enter" or code == "Space") and cur != null:
		(cur.get_meta("act") as Callable).call()
	else:
		return
	legend_for()


## over the HUD; ctx {game, where, secs, has}. Returns "resume", "escaped" or {"quit": "title" | "desktop"}
func open(ctx_: Dictionary) -> Variant:
	ctx = ctx_
	s = load_settings()
	var sv = read_json(saves_file(str(ctx.get("game", "game"))), {})
	saves = sv if sv is Dictionary else {}
	controls_panel(ctx.get("has", {}))
	up = true
	visible = true
	hud.paused(true)
	open_page("root")
	var r = await closed
	return r


func close(v) -> void:
	up = false
	visible = false
	hud.paused(false)
	quit_open = false
	for ch in footer.get_children():
		ch.queue_free()
	closed.emit(v)
