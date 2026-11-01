@tool
extends EditorDock
## The HorrorStudio panel (docs/GODOT_DIRECTOR.md §6e; the design: "Director Panel Design"): along the bottom of the
## editor (or floating on a second screen), three tabs: Build (what the game is made of, as cards: build_tab.gd), Story
## (the quests and moments as sentences: story_tab.gd) and Test (play, and what's wrong). Its header searches every card and says what's
## selected. The old dock (dock.gd, under the Inspector) keeps the running game's marks, the things and Kimodo.

const Glyphs := preload("res://addons/horrorstudio_director/editor/glyphs.gd")
const BuildTab := preload("res://addons/horrorstudio_director/editor/build_tab.gd")
const StoryTab := preload("res://addons/horrorstudio_director/editor/story_tab.gd")
const CheckTab := preload("res://addons/horrorstudio_director/editor/check_tab.gd")

var plugin: EditorPlugin = null
var dock = null                    # the dock's helpers (root, selected, select, add_node, view_spot...)
var build
var story
var test
var tab_buttons := {}
var pages := {}
var page := "build"
var search: LineEdit
var chip: PanelContainer
var chip_name: Label
var chip_kind: Label
var status: Label
var hints: HBoxContainer


func _init() -> void:
	title = "HorrorStudio"
	layout_key = "horrorstudio_panel"
	default_slot = EditorDock.DOCK_SLOT_BOTTOM
	available_layouts = EditorDock.DOCK_LAYOUT_HORIZONTAL | EditorDock.DOCK_LAYOUT_FLOATING
	dock_icon = Glyphs.icon("scare", "#6CB4F5", 16)


func _ready() -> void:
	var s := Glyphs.scale()
	custom_minimum_size = Vector2(0, 360) * s
	var bg := PanelContainer.new()
	bg.add_theme_stylebox_override("panel", BuildTab._box(Color("#1D2127"), Color(0, 0, 0, 0), 0, 0, 0))
	add_child(bg)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	bg.add_child(v)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", int(14 * s))
	var hm := MarginContainer.new()
	for k in ["left", "right"]:
		hm.add_theme_constant_override("margin_" + k, int(14 * s))
	for k in ["top", "bottom"]:
		hm.add_theme_constant_override("margin_" + k, int(8 * s))
	hm.add_child(head)
	v.add_child(hm)
	var logo := Label.new()
	logo.text = "HS"
	logo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	logo.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	logo.custom_minimum_size = Vector2(26, 26) * s
	logo.add_theme_color_override("font_color", Color("#0E1A27"))
	logo.add_theme_font_size_override("font_size", int(11 * s))
	logo.add_theme_stylebox_override("normal", BuildTab._box(Color("#6CB4F5"), Color(0, 0, 0, 0), 7, 0, 0))
	head.add_child(logo)
	var name_l := Label.new()
	name_l.text = "HorrorStudio"
	name_l.add_theme_font_size_override("font_size", int(15 * s))
	var th := EditorInterface.get_editor_theme()
	if th != null and th.has_font("bold", "EditorFonts"):
		name_l.add_theme_font_override("font", th.get_font("bold", "EditorFonts"))
	head.add_child(name_l)
	var tabs := HBoxContainer.new()
	tabs.add_theme_constant_override("separation", int(4 * s))
	head.add_child(tabs)
	for t in [["build", "Build", "What the game is made of: click a card, or drag it onto a model"],
			["story", "Story", "The quests, in order, and what happens in them"], ["test", "Test", "Play it, and what's wrong"]]:
		var b := Button.new()
		b.name = "Tab_" + t[0]
		b.text = t[1]
		b.tooltip_text = t[2]
		b.toggle_mode = true
		b.custom_minimum_size = Vector2(76, 36) * s
		b.add_theme_stylebox_override("normal", BuildTab._box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 7, 0, 8))
		b.add_theme_stylebox_override("pressed", BuildTab._box(Color("#2E3440"), Color(0, 0, 0, 0), 7, 0, 8))
		b.add_theme_stylebox_override("hover_pressed", BuildTab._box(Color("#2E3440"), Color(0, 0, 0, 0), 7, 0, 8))
		b.add_theme_stylebox_override("hover", BuildTab._box(Color("#262B33"), Color(0, 0, 0, 0), 7, 0, 8))
		b.pressed.connect(show_page.bind(t[0]))
		tabs.add_child(b)
		tab_buttons[t[0]] = b
	search = LineEdit.new()
	search.name = "Search"
	search.placeholder_text = "Search everything: kettle, door, key, scare…"
	search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	search.custom_minimum_size = Vector2(240, 40) * s
	search.clear_button_enabled = true
	search.right_icon = Glyphs.icon("search", "#8A93A1", 16)
	search.text_changed.connect(func(t): if build != null: show_page("build"); build.search(t))
	head.add_child(search)
	chip = PanelContainer.new()
	chip.add_theme_stylebox_override("panel", BuildTab._box(Color("#22303F"), Color("#34506E"), 10, 1, 8))
	var ch := HBoxContainer.new()
	ch.add_theme_constant_override("separation", int(8 * s))
	chip.add_child(ch)
	chip_kind = BuildTab._label("Selected", 12, Color("#A9C4E0"))
	ch.add_child(chip_kind)
	chip_name = Label.new()
	chip_name.add_theme_font_size_override("font_size", int(13 * s))
	if th != null and th.has_font("source", "EditorFonts"):
		chip_name.add_theme_font_override("font", th.get_font("source", "EditorFonts"))
	ch.add_child(chip_name)
	var clear := Button.new()
	clear.flat = true
	clear.tooltip_text = "Clear the selection"
	clear.icon = Glyphs.icon("cross", "#A9C4E0", 14)
	clear.pressed.connect(func(): EditorInterface.get_selection().clear())
	ch.add_child(clear)
	head.add_child(chip)
	v.add_child(HSeparator.new())
	var stack := MarginContainer.new()
	stack.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(stack)
	build = BuildTab.new()
	build.name = "Build"
	build.panel = self
	stack.add_child(build)
	pages["build"] = build
	story = StoryTab.new()
	story.name = "Story"
	story.panel = self
	stack.add_child(story)
	pages["story"] = story
	test = VBoxContainer.new()
	test.name = "Test"
	var plays := HBoxContainer.new()
	plays.add_theme_constant_override("separation", int(8 * s))
	var pg := BuildTab._button("Play the game", true)
	pg.icon = Glyphs.icon("play", "#0E1A27", 14)
	pg.pressed.connect(func(): EditorInterface.play_main_scene())
	plays.add_child(pg)
	var pl := BuildTab._button("Play this scene", false)
	pl.tooltip_text = "The scene open now (a level open on its own plays alone: its moments, a free roam)"
	pl.pressed.connect(func(): EditorInterface.play_current_scene())
	plays.add_child(pl)
	test.add_child(plays)
	var ct = CheckTab.new()
	ct.name = "Checks"
	ct.set("dock", dock)
	ct.size_flags_vertical = Control.SIZE_EXPAND_FILL
	test.add_child(ct)
	stack.add_child(test)
	pages["test"] = test
	v.add_child(HSeparator.new())
	var foot := HBoxContainer.new()
	foot.add_theme_constant_override("separation", int(24 * s))
	var fm := MarginContainer.new()
	for k in ["left", "right"]:
		fm.add_theme_constant_override("margin_" + k, int(14 * s))
	for k in ["top", "bottom"]:
		fm.add_theme_constant_override("margin_" + k, int(6 * s))
	fm.add_child(foot)
	v.add_child(fm)
	hints = HBoxContainer.new()
	hints.add_theme_constant_override("separation", int(20 * s))
	for row in [["click", "Click a card: it's added in front of the camera"], ["drag", "Drag it onto a model: that model becomes it"],
			["target", "Or select a model first, then click a card"]]:
		var tr := TextureRect.new()
		tr.texture = Glyphs.icon(row[0], "#9CCBFA", 14)
		tr.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
		hints.add_child(tr)
		hints.add_child(BuildTab._label(row[1], 12, Color("#A3ACB9")))
	foot.add_child(hints)
	status = BuildTab._label("", 12, Color(1.0, 0.8, 0.45))
	status.name = "Status"
	status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	foot.add_child(status)
	show_page("build")
	on_selection()


## the open page's poll (the Story tab: the file changed on disk, the running game moved on)
func _process(_dt: float) -> void:
	if Engine.get_process_frames() % 60 == 0 and is_visible_in_tree():
		var p = pages.get(page)
		if p != null and p.has_method("tick"):
			p.tick()


func show_page(p: String) -> void:
	page = p
	for k in pages:
		pages[k].visible = k == p
		tab_buttons[k].set_pressed_no_signal(k == p)
	if hints != null:
		hints.visible = p == "build"
	refresh()


## the game played from the start (a Player start's Play from here; a Test start's as a test run: F6's start)
const RUN_FILE := "user://hs_director_run.json"
func play_from_start(test: bool) -> void:
	_write_run({"test": test})
	EditorInterface.play_main_scene()


## This object's Try it: the game as a test run, the player standing in front of the thing, facing it (HSGame _try_here)
func play_near(n: Node3D) -> void:
	var lv = build._level_of(n)
	if lv == null:
		say("%s isn't in a level" % n.name)
		return
	var vp := EditorInterface.get_editor_viewport_3d(0)
	var cam: Camera3D = vp.get_camera_3d() if vp != null else null
	var away: Vector3 = (cam.global_position - n.global_position) if cam != null else Vector3(0, 0, 1)
	away.y = 0.0
	if away.length() < 0.01:
		away = Vector3(0, 0, 1)
	var pos: Vector3 = n.global_position + away.normalized() * 1.4
	var room = build.room_of(n)
	pos.y = room.global_position.y if room != null else 0.0
	var d: Vector3 = n.global_position - pos
	_write_run({"test": true, "near": {"level": HSDirector.id_of(lv), "pos": [pos.x, pos.y, pos.z], "yaw": rad_to_deg(atan2(d.x, d.z))}})
	EditorInterface.play_main_scene()
	say("Playing with you in front of %s (F8 stops it)" % n.name)


func _write_run(d: Dictionary) -> void:
	var f := FileAccess.open(RUN_FILE, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(d))
		f.close()


## a word to the user at the panel's foot (what just happened, what's missing)
func say(t: String) -> void:
	if status != null:
		status.text = t


func clear_search() -> void:
	if search != null and search.text != "":
		search.text = ""


## the selection changed (the editor's): the chip, the cards and This object
func on_selection() -> void:
	if chip == null:
		return
	var sel = dock.selected() if dock != null else null
	if sel == null or not is_instance_valid(sel):
		chip_kind.text = "Click a model in your level"
		chip_name.text = ""
		chip.add_theme_stylebox_override("panel", BuildTab._box(Color(0, 0, 0, 0), Color("#4A5260"), 10, 1, 8))
	else:
		var amber: bool = HSDirector.class_of(sel) == "HSPlayerStart"
		chip_kind.text = "Selected"
		chip_name.text = str(sel.name)
		chip.add_theme_stylebox_override("panel", BuildTab._box(Color("#3A3020") if amber else Color("#22303F"), Color("#6B5530") if amber else Color("#34506E"), 10, 1, 8))
	refresh()


func refresh() -> void:
	if pages.is_empty():
		return
	var p = pages.get(page)
	if p != null and p.has_method("refresh"):
		p.refresh()
	if page == "test":
		var ct = test.get_node_or_null("Checks")
		if ct != null and ct.has_method("refresh"):
			ct.refresh()
