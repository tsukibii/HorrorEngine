@tool
extends HBoxContainer
## The panel's Build tab (docs/GODOT_DIRECTOR.md §6e, the design on the canvas "Director Panel Design"): what a game is
## made of, as picture cards in categories (parts/catalog.json). A card clicked is added in front of the editor's
## camera; dragged onto a model (in the 3D view or the Scene tree) it makes that model the thing; with a model
## selected, one click does it. This object (the right column) says what the selection is in plain words, its
## settings, its name in the story and who uses it, and makes it plain again. Everything is on the editor's undo.

const Glyphs := preload("res://addons/horrorstudio_director/editor/glyphs.gd")
const CATALOG := "res://addons/horrorstudio_director/parts/catalog.json"
const ROOT := "res://addons/horrorstudio_director/"
const LIVES := "res://game/lives.json"
## an HSThing's use (and life) -> the card it is
const USE_CARD := {"pickup": "pickup", "note": "note", "inspect": "inspect", "switch": "switch", "breaker": "breaker", "sit": "seat",
	"sleep": "bed", "hide": "hiding_place", "carry": "carry", "roll": "die", "code": "code_lock", "use_item": "use_item",
	"clean": "stain", "game": "game_table", "none": "solid"}
## a field's words for a layman (HSThing's FIELDS)
const FIELD_WORDS := {"item": "Its item's name in the story", "item_name": "What the player sees it called", "flashlight": "It's the flashlight",
	"note_title": "The note's title", "note_text": "What it says", "inspect_text": "The words under it", "code": "The code",
	"opens_flag": "The fact it sets when opened", "needs_item": "The item it needs", "consume": "The item is used up",
	"sleep_needs": "Sleeping needs these facts first", "see_through": "How much they see from inside (0 to 1)",
	"clean_with": "Cleaned with (an item; empty: the hands)", "stain": "What kind of stain", "board_game": "Which game"}
const KIND_WORDS := {"HSRoom": ["a room", "Floor, walls and a ceiling from its size. A door on its wall cuts its own opening."],
	"HSDoor": ["a door", "It swings away from the player. Locked by an item, a peephole, a latch: in the Inspector."],
	"HSTrigger": ["an area", "The story hears the player walk into it: a moment can start here (Scares)."],
	"HSSpot": ["a spot", "Where someone stands or is sent, or a point of a path."],
	"HSPath": ["a path", "A way a character walks: its points, round or there and back."],
	"HSActor": ["a character", "She stands, sits, walks, talks and watches: her settings are in the Inspector."],
	"HSLevel": ["a level", "A place the game plays in."], "HSGame": ["the game", "Its title, the time of day, the look: in the Inspector."]}

const C_CARD := Color("#262B33")
const C_CARD_HOVER := Color("#2B313B")
const C_LINE := Color("#353C47")
const C_TEXT := Color("#E8EBF0")
const C_MUTED := Color("#A3ACB9")
const C_FAINT := Color("#8A93A1")
const C_BLUE := Color("#6CB4F5")
const C_BLUE_TEXT := Color("#CFE5FB")
const C_BLUE_BG := Color("#22303F")
const C_BLUE_LINE := Color("#34506E")
const C_AMBER := Color("#F3C27A")
const C_AMBER_BG := Color("#2E281E")
const C_RAIL_ON := Color("#2C3D52")
const C_SIDE := Color("#1A1E23")
const C_DANGER := Color("#F2A79D")

var panel = null                  # the panel (editor/panel.gd): its say(), the plugin, the dock's helpers
var cat: Dictionary = {}
var items_by_cat := {}
var items_by_id := {}
var current := "kitchen"          # the open category
var query := ""                   # what's typed in the search
var rail: VBoxContainer
var grid: HFlowContainer
var heading: Label
var about: Label
var side: VBoxContainer
var cards := {}                   # item id -> its card
var rail_buttons := {}
var lives: Dictionary = {}


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 0)
	cat = load_catalog()
	_index()
	var rs := ScrollContainer.new()
	rs.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rs.custom_minimum_size = Vector2(190, 0) * _s()
	add_child(rs)
	rail = VBoxContainer.new()
	rail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rail.add_theme_constant_override("separation", int(2 * _s()))
	rs.add_child(rail)
	add_child(VSeparator.new())
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.add_theme_constant_override("separation", int(8 * _s()))
	add_child(mid)
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", int(12 * _s()))
	mid.add_child(hb)
	heading = _label("", 17, C_TEXT, true)
	hb.add_child(heading)
	about = _label("", 13, C_MUTED)
	about.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	about.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hb.add_child(about)
	var gs := ScrollContainer.new()
	gs.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	gs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	mid.add_child(gs)
	grid = HFlowContainer.new()
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", int(10 * _s()))
	grid.add_theme_constant_override("v_separation", int(10 * _s()))
	gs.add_child(grid)
	add_child(VSeparator.new())
	var ss := ScrollContainer.new()
	ss.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	ss.custom_minimum_size = Vector2(300, 0) * _s()
	add_child(ss)
	var sp := PanelContainer.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sp.add_theme_stylebox_override("panel", _box(C_SIDE, Color(0, 0, 0, 0), 0, 0, 14))
	ss.add_child(sp)
	side = VBoxContainer.new()
	side.add_theme_constant_override("separation", int(14 * _s()))
	sp.add_child(side)
	_rail()
	show_category(current)
	refresh()


# ---- the catalog ---------------------------------------------------------------------------------------------------
static func load_catalog() -> Dictionary:
	var j = JSON.parse_string(FileAccess.get_file_as_string(CATALOG)) if FileAccess.file_exists(CATALOG) else null
	return j if j is Dictionary else {"categories": [], "items": []}


func _index() -> void:
	items_by_cat = {}
	items_by_id = {}
	for it in cat.get("items", []):
		items_by_id[str(it["id"])] = it
		if not items_by_cat.has(str(it["cat"])):
			items_by_cat[str(it["cat"])] = []
		items_by_cat[str(it["cat"])].append(it)


func category(id: String) -> Dictionary:
	for c in cat.get("categories", []):
		if str(c["id"]) == id:
			return c
	return {}


func tint_of(item: Dictionary) -> String:
	return str(category(str(item.get("cat", ""))).get("tint", "blue"))


## the card an HSThing is (by its life, else its use)
func card_of(n: Node) -> Dictionary:
	if HSDirector.class_of(n) != "HSThing":
		return {}
	if str(n.get("use")) == "life":
		return items_by_id.get(str(n.get("life")), {})
	if str(n.get("use")) == "pickup" and bool(n.get("flashlight")):
		return items_by_id.get("flashlight", {})
	return items_by_id.get(USE_CARD.get(str(n.get("use")), ""), {})


## the parts a model's name suggests (its node's name and its file's, split into words), best first
func suggestions(n: Node, most := 3) -> Array:
	var words := {}
	var src := str(n.name) + " " + str(n.scene_file_path.get_file().get_basename())
	if n is MeshInstance3D and n.mesh != null:
		src += " " + n.mesh.resource_path.get_file().get_basename()
	for w in HSDirector.snake(src).replace("-", "_").replace(" ", "_").split("_", false):
		var t := w.rstrip("0123456789")
		if t.length() >= 2:
			words[t] = true
	var scored: Array = []
	for it in cat.get("items", []):
		if str(it.get("kind")) != "part":
			continue
		var s := 0
		for k in it.get("keywords", []):
			if words.has(str(k)):
				s += 3
		for tw in str(it["title"]).to_lower().split(" ", false):
			if words.has(tw):
				s += 2
		if s > 0:
			scored.append([s, it])
	scored.sort_custom(func(a, b): return a[0] > b[0])
	var out: Array = []
	for x in scored:
		if out.size() < most:
			out.append(x[1])
	return out


# ---- the rail and the cards ------------------------------------------------------------------------------------------
func _rail() -> void:
	for c in rail.get_children():
		c.queue_free()
	rail_buttons = {}
	for c in cat.get("categories", []):
		var n: int = (items_by_cat.get(str(c["id"]), []) as Array).size()
		if n == 0:
			continue
		var b := Button.new()
		b.name = "Cat_" + str(c["id"])
		b.toggle_mode = true
		b.text = "  " + str(c["title"])
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(0, 44) * _s()
		b.tooltip_text = str(c.get("about", ""))
		b.add_theme_stylebox_override("normal", _box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 8, 0, 6))
		b.add_theme_stylebox_override("hover", _box(C_CARD, Color(0, 0, 0, 0), 8, 0, 6))
		b.add_theme_stylebox_override("pressed", _box(C_RAIL_ON, Color(0, 0, 0, 0), 8, 0, 6))
		b.add_theme_stylebox_override("hover_pressed", _box(C_RAIL_ON, Color(0, 0, 0, 0), 8, 0, 6))
		b.add_theme_stylebox_override("focus", _box(Color(0, 0, 0, 0), C_BLUE, 8, 1, 6))
		b.add_theme_color_override("font_color", Color("#C9CED6"))
		b.add_theme_color_override("font_pressed_color", Color.WHITE)
		b.add_theme_color_override("font_hover_pressed_color", Color.WHITE)
		b.icon = Glyphs.tile(str(c.get("glyph", "cube")), str(c.get("tint", "blue")), false, 28)
		b.pressed.connect(func(): query = ""; panel.clear_search(); show_category(str(c["id"])))
		var count := _label(str(n), 12, C_FAINT)
		count.mouse_filter = Control.MOUSE_FILTER_IGNORE
		count.set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE)
		count.offset_left = -34 * _s()
		count.offset_right = -10 * _s()
		count.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		count.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		b.add_child(count)
		rail.add_child(b)
		rail_buttons[str(c["id"])] = b


func show_category(id: String) -> void:
	if not items_by_cat.has(id) and items_by_cat.size():
		id = str((cat["categories"] as Array).filter(func(c): return items_by_cat.has(str(c["id"])))[0]["id"])
	current = id
	for k in rail_buttons:
		rail_buttons[k].set_pressed_no_signal(k == id and query == "")
		rail_buttons[k].icon = Glyphs.tile(str(category(k).get("glyph", "cube")), str(category(k).get("tint", "blue")), k == id and query == "", 28)
	var c := category(id)
	heading.text = str(c.get("title", ""))
	about.text = str(c.get("about", ""))
	_cards(items_by_cat.get(id, []))


## what's typed in the panel's search: every card whose words, title or keywords hold it
func search(t: String) -> void:
	query = t.strip_edges().to_lower()
	if query == "":
		show_category(current)
		return
	var scored: Array = []                             # its title first, then its keywords, then its words
	for it in cat.get("items", []):
		var sc := 0
		if str(it["title"]).to_lower().contains(query):
			sc = 3
		elif " ".join(PackedStringArray(it.get("keywords", []))).to_lower().contains(query):
			sc = 2
		elif str(it.get("desc", "")).to_lower().contains(query):
			sc = 1
		if sc > 0:
			scored.append([sc, scored.size(), it])
	scored.sort_custom(func(a, b): return a[0] > b[0] or (a[0] == b[0] and a[1] < b[1]))
	var found: Array = scored.map(func(x): return x[2])
	for k in rail_buttons:
		rail_buttons[k].set_pressed_no_signal(false)
	heading.text = "Found %d" % found.size()
	about.text = "for “%s”" % t.strip_edges() if found.size() else "Nothing has “%s” in it: try another word (kettle, door, key, scare)" % t.strip_edges()
	_cards(found)


func _cards(list: Array) -> void:
	for c in grid.get_children():
		c.queue_free()
	cards = {}
	for it in list:
		var card := _card(it)
		grid.add_child(card)
		cards[str(it["id"])] = card
	_card_states()


func _card(it: Dictionary) -> Button:
	var b := Button.new()
	b.name = "Card_" + str(it["id"])
	b.custom_minimum_size = Vector2(150, 164) * _s()
	b.tooltip_text = str(it.get("desc", ""))
	b.focus_mode = Control.FOCUS_ALL
	var m := MarginContainer.new()
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side_ in ["left", "right", "top", "bottom"]:
		m.add_theme_constant_override("margin_" + side_, int(12 * _s()))
	b.add_child(m)
	var v := VBoxContainer.new()
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_theme_constant_override("separation", int(6 * _s()))
	m.add_child(v)
	var tile := TextureRect.new()
	tile.name = "Tile"
	tile.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tile.stretch_mode = TextureRect.STRETCH_KEEP
	tile.texture = Glyphs.tile(str(it.get("glyph", "cube")), tint_of(it), false, 40)
	v.add_child(tile)
	var t := _label(str(it["title"]), 14, C_TEXT, true)
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(t)
	var d := _label(str(it.get("desc", "")), 12, C_MUTED)
	d.mouse_filter = Control.MOUSE_FILTER_IGNORE
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(d)
	var f := _label("", 12, C_BLUE_TEXT, true)
	f.name = "Foot"
	f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(f)
	b.pressed.connect(func(): activate(it))
	b.set_drag_forwarding(func(_at): return _drag(b, it), func(_a, _d): return false, func(_a, _d): pass)
	return b


## each card as the selection makes it: in use (the selected thing is it), one click away (a model selected), can't
## (a level's own node selected), or resting
func _card_states() -> void:
	var sel = _sel()
	var cls := HSDirector.class_of(sel) if sel != null else ""
	var mine := card_of(sel) if sel != null else {}
	for id in cards:
		var it: Dictionary = items_by_id[id]
		var b: Button = cards[id]
		var foot: Label = b.find_child("Foot", true, false)
		var tile: TextureRect = b.find_child("Tile", true, false)
		var part := str(it.get("kind")) == "part"
		var amber := tint_of(it) == "amber"
		var normal := _box(C_CARD, C_LINE, 12, 1, 0)
		var hover := _box(C_CARD_HOVER, C_BLUE, 12, 1, 0)
		var on := false
		b.disabled = false
		if not mine.is_empty() and str(mine["id"]) == id:
			normal = _box(C_AMBER_BG if amber else C_BLUE_BG, C_AMBER if amber else C_BLUE, 12, 2, 0)
			hover = normal
			on = true
			foot.text = "✓ It's this now"
		elif part and sel != null and (cls == "HSThing" or is_model(sel)):
			foot.text = "Make it this"
		elif part and sel != null and cls.begins_with("HS"):
			foot.text = "Pick a model first"
			normal = _box(Color("#1D2127"), Color("#3A414C"), 12, 1, 0)
		elif id in ["player_start", "test_start"] and start_of(id == "test_start") != null:
			foot.text = "✓ One in %s" % _level_of(start_of(id == "test_start")).name
		elif str(it.get("kind")) == "window":
			var room = room_of(sel)
			foot.text = ("Into %s's wall" % room.name) if room != null else "Select a room first"
		else:
			foot.text = "Click: add · Drag: onto a model" if part else "Click: add · Drag: into the view"
		foot.add_theme_color_override("font_color", C_AMBER if amber else (C_BLUE_TEXT if foot.text != "Pick a model first" else C_FAINT))
		tile.texture = Glyphs.tile(str(it.get("glyph", "cube")), tint_of(it), on, 40)
		b.add_theme_stylebox_override("normal", normal)
		b.add_theme_stylebox_override("hover", hover)
		b.add_theme_stylebox_override("pressed", _box(C_AMBER_BG if amber else C_BLUE_BG, C_AMBER if amber else C_BLUE, 12, 2, 0))
		b.add_theme_stylebox_override("focus", _box(Color(0, 0, 0, 0), C_BLUE, 12, 2, 0))


## a card dragged: a scene file the 3D view and the Scene tree take (a part, a preset); a scare is the area's preset,
## its moment made when it lands (plugin.gd); a window can't be dragged
func _drag(b: Button, it: Dictionary):
	var kind := str(it.get("kind"))
	var path := ""
	if kind in ["part", "preset"]:
		path = ROOT + str(it["path"])
	elif kind == "scare":
		path = ROOT + "presets/area.tscn"
		panel.plugin.pending_scare = {"item": it, "at": Time.get_ticks_msec()}
	else:
		return null
	var pv := PanelContainer.new()
	pv.add_theme_stylebox_override("panel", _box(C_CARD, C_BLUE, 12, 2, 10))
	var hb := HBoxContainer.new()
	pv.add_child(hb)
	var tr := TextureRect.new()
	tr.texture = Glyphs.tile(str(it.get("glyph", "cube")), tint_of(it), true, 32)
	hb.add_child(tr)
	hb.add_child(_label(str(it["title"]), 14, C_TEXT, true))
	b.set_drag_preview(pv)
	return {"type": "files", "files": [path], "from": b}


# ---- what a card does ------------------------------------------------------------------------------------------------
## a card clicked: with a model (or a thing) selected a part makes it that; else what it is goes in front of the camera
func activate(it: Dictionary) -> void:
	var sel = _sel()
	match str(it.get("kind")):
		"part":
			if sel != null and (HSDirector.class_of(sel) == "HSThing" or is_model(sel)):
				assign(sel, it)
			else:
				var n = place(ROOT + str(it["path"]))
				if n != null:
					panel.say("A %s stands in front of the camera: put your model inside it, or drag the card onto a model instead" % str(it["title"]).to_lower())
		"preset":
			if str(it["id"]) in ["player_start", "test_start"]:
				var have = start_of(str(it["id"]) == "test_start")
				if have != null:                       # one a level: the one there, to move
					panel.dock.select(have)
					panel.say("This level's %s is here: move it where the player should begin, its arrow the way they look" % str(it["title"]).to_lower())
					return
			var n = place(ROOT + str(it["path"]))
			if n != null:
				panel.say("%s added in front of the camera. Ctrl+Z takes it away" % str(it["title"]))
		"window":
			add_window(room_of(sel))
		"scare":
			var a = place(ROOT + "presets/area.tscn")
			if a != null:
				scare_landed(a, it)


## the model made the card's thing (wrapped in its part), or a thing turned into another (its use and life)
func assign(obj: Node, it: Dictionary) -> void:
	var part: Node3D = (load(ROOT + str(it["path"])) as PackedScene).instantiate()
	part.scene_file_path = ""
	if HSDirector.class_of(obj) == "HSThing":
		var ur = panel.plugin.get_undo_redo()
		ur.create_action("HorrorStudio: %s is a %s" % [obj.name, it["title"]])
		for k in ["use", "life", "flashlight"]:
			ur.add_do_property(obj, k, part.get(k))
			ur.add_undo_property(obj, k, obj.get(k))
		ur.commit_action()
		part.free()
	elif HSDirector.class_of(obj).begins_with("HS"):
		part.free()
		panel.say("%s is one of the level's own nodes: select your model (a mesh, or a scene you brought in)" % obj.name)
		return
	else:
		panel.plugin.wrap_object(part, obj)
	panel.say("%s is a %s now. Ctrl+Z puts it back" % [obj.name, str(it["title"]).to_lower()])
	refresh()


## a scene of the plugin's added in front of the editor's camera, in the selected room or level (the old Add tab's way)
func place(path: String) -> Node:
	var dock = panel.dock
	var r = dock.root()
	if r == null:
		panel.say("Open a scene first (the game's main scene, or a level)")
		return null
	var n: Node = (load(path) as PackedScene).instantiate()
	n.scene_file_path = ""
	if n is Path3D and n.curve != null:
		n.curve = n.curve.duplicate()
	var p: Node = dock.level_parent()
	if p == null:
		p = r
	if n is Node3D:
		var xf: Transform3D = dock.view_spot()
		var keep_y: float = n.position.y
		var local: Transform3D = (p.global_transform.affine_inverse() * xf) if p is Node3D else xf
		local.origin.y += keep_y
		n.transform = Transform3D(local.basis, local.origin)
	n.name = dock.fresh_name(p, str(n.name))
	dock.add_node(p, n, "add " + str(n.name))
	return n


## the room a node is in (itself, an ancestor, or the room holding it)
func room_of(n) -> Node:
	if n == null or not is_instance_valid(n):
		return null
	var x: Node = n
	while x != null:
		if HSDirector.class_of(x) == "HSRoom":
			return x
		x = x.get_parent()
	if n is Node3D:
		var r = panel.dock.root()
		for room in HSDirector.nodes_of(r, "HSRoom"):
			if room.holds(n.global_position):
				return room
	return null


## a window (glass, the sky's light) in a room's wall: the wall the editor's camera looks at, where it looks
func add_window(room) -> void:
	if room == null:
		panel.say("Select a room (or something in it) first, then click Window")
		return
	var vp := EditorInterface.get_editor_viewport_3d(0)
	var cam: Camera3D = vp.get_camera_3d() if vp != null else null
	var side_ := "north"
	var offset := 0.0
	if cam != null:
		var inv: Transform3D = room.global_transform.affine_inverse()
		var o: Vector3 = inv * cam.global_position
		var d: Vector3 = (inv.basis * -cam.global_transform.basis.z)
		var sx: float = room.size.x / 2.0
		var sz: float = room.size.z / 2.0
		var best := INF
		for w in [["north", Vector3(0, 0, -1), -sz], ["south", Vector3(0, 0, 1), sz], ["east", Vector3(1, 0, 0), sx], ["west", Vector3(-1, 0, 0), -sx]]:
			var nrm: Vector3 = w[1]
			var den := d.dot(nrm)
			if absf(den) < 1e-4:
				continue
			var tt: float = (float(w[2]) - o.dot(nrm)) / den
			if tt <= 0.0 or tt >= best:
				continue
			var hit := o + d * tt
			var along: float = hit.x if absf(nrm.z) > 0.5 else hit.z
			var half: float = sx if absf(nrm.z) > 0.5 else sz
			if absf(along) <= half:
				best = tt
				side_ = w[0]
				offset = clampf(along, -half + 0.8, half - 0.8)
	var op := HSOpening.new()
	op.side = side_
	op.offset = snappedf(offset, 0.05)
	op.width = 1.2
	op.height = 1.1
	op.sill = 0.9
	op.glass = true
	op.daylight = true
	var was: Array[HSOpening] = room.openings.duplicate()
	var now: Array[HSOpening] = room.openings.duplicate()
	now.append(op)
	var ur = panel.plugin.get_undo_redo()
	ur.create_action("HorrorStudio: a window in %s" % room.name)
	ur.add_do_property(room, "openings", now)
	ur.add_undo_property(room, "openings", was)
	ur.commit_action()
	panel.say("A window in %s's %s wall, with glass and the sky's light. Its place along the wall: the room's Openings in the Inspector" % [room.name, side_])
	refresh()


## a scare's area landed (clicked in front of the camera, or dragged into the view): named for the scare, and its
## moment written into the Director file, listening while the player walks in
func scare_landed(area: Node, it: Dictionary) -> void:
	var dock = panel.dock
	var p := area.get_parent()
	var nm: String = dock.fresh_name(p, str(it.get("name", "Scare")))
	area.name = nm                                     # (its id follows the new name: HSDirector.auto_id)
	var aid := HSDirector.id_of(area)
	var room = room_of(area)
	var acts: Array = (it.get("moment", {}).get("do", []) as Array).duplicate(true)
	for a in acts:
		for k in a:
			if str(a[k]) == "{room}":
				a[k] = HSDirector.id_of(room) if room != null else ""
	var path: String = dock.game().story_file if dock.game() != null else HSStoryFile.DEFAULT
	var f := HSStoryFile.read(path)
	if f.has("_error"):
		panel.say(str(f["_error"]))
		return
	var ids := {}
	for m in f.get("moments", []):
		ids[str(m.get("id", ""))] = true
	var mid := aid
	var k := 2
	while ids.has(mid):
		mid = "%s_%d" % [aid, k]
		k += 1
	(f["moments"] as Array).append({"id": mid, "when": {"enter": aid}, "do": acts, "once": true})
	HSStoryFile.write(f, path)
	dock.select(area)
	panel.say("%s: when the player walks into %s. Its words (who appears, what's said) are in the Story tab" % [it["title"], aid])
	refresh()


## a model of the user's: a Node3D with a mesh in it (itself or below), not one of the level's own nodes, not the scene
func is_model(n) -> bool:
	if n == null or not (n is Node3D) or not is_instance_valid(n):
		return false
	if HSDirector.class_of(n).begins_with("HS") or n == panel.dock.root():
		return false
	if n is MeshInstance3D:
		return true
	return n.find_children("*", "MeshInstance3D", true, false).size() > 0


func _sel():
	var s = panel.dock.selected() if panel != null and panel.dock != null else null
	return s if s != null and is_instance_valid(s) else null


# ---- this object (the right column) ----------------------------------------------------------------------------------
func refresh() -> void:
	if side == null:
		return
	_card_states()
	for c in side.get_children():
		side.remove_child(c)                           # gone at once: what's drawn next is the only This object
		c.queue_free()
	var sel = _sel()
	var cls := HSDirector.class_of(sel) if sel != null else ""
	if sel == null:
		_side_empty()
	elif cls == "HSPlayerStart":
		_side_player(sel)
	elif cls == "HSCheckpoint":
		_side_checkpoint(sel)
	elif cls == "HSThing":
		_side_thing(sel)
	elif cls.begins_with("HS"):
		_side_node(sel, cls)
	elif is_model(sel):
		_side_model(sel)
	else:
		side.add_child(_wrap(_label("%s isn't a model: select a mesh (or a scene you brought in) to make it something." % sel.name, 13, C_MUTED)))


func _side_empty() -> void:
	side.add_child(_label("This object", 12, C_FAINT, true))
	side.add_child(_wrap(_label("Click a model in your level and say what it is here. Or click a card: it's added in front of the camera.", 14, C_TEXT)))
	for row in [["click", "Click a card: it's added in front of the camera"], ["drag", "Drag it onto a model: that model becomes it"],
			["target", "Select a model first, then click a card"]]:
		var hb := HBoxContainer.new()
		var tr := TextureRect.new()
		tr.texture = Glyphs.icon(row[0], "#9CCBFA", 16)
		tr.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
		hb.add_child(tr)
		hb.add_child(_wrap(_label(row[1], 13, C_MUTED)))
		side.add_child(hb)


func _side_model(n: Node) -> void:
	_side_head(Glyphs.tile("cube", "grey", false, 52), str(n.name), "is a model. What is it?")
	var sug := suggestions(n)
	if sug.size():
		side.add_child(_label("It looks like (from its name)", 12, C_FAINT, true))
		var row := HFlowContainer.new()
		row.add_theme_constant_override("h_separation", int(8 * _s()))
		row.add_theme_constant_override("v_separation", int(8 * _s()))
		for i in sug.size():
			var it: Dictionary = sug[i]
			var b := _button(str(it["title"]), i == 0)
			b.icon = Glyphs.icon(str(it.get("glyph", "cube")), "#0E1A27" if i == 0 else "#9CCBFA", 16)
			b.pressed.connect(func(): assign(n, it))
			row.add_child(b)
		side.add_child(row)
	side.add_child(_wrap(_label("Or click any card, or drag one onto it.", 13, C_MUTED)))


func _side_node(n: Node, cls: String) -> void:
	var w: Array = KIND_WORDS.get(cls, ["one of the level's nodes", ""])
	_side_head(Glyphs.tile({"HSRoom": "room", "HSDoor": "door", "HSTrigger": "area", "HSSpot": "spot", "HSPath": "path", "HSActor": "person", "HSLevel": "level"}.get(cls, "cube"), "grey", false, 52), str(n.name), "is " + w[0])
	if w[1] != "":
		side.add_child(_wrap(_label(w[1], 13, C_MUTED)))
	if cls == "HSRoom":
		var b := _button("Add a window here", false)
		b.icon = Glyphs.icon("window", "#9CCBFA", 16)
		b.pressed.connect(func(): add_window(n))
		side.add_child(b)
	_side_story_name(n)


func _side_thing(n: Node) -> void:
	var it := card_of(n)
	var title := str(it.get("title", n.get("use")))
	_side_head(Glyphs.tile(str(it.get("glyph", "cube")), tint_of(it) if not it.is_empty() else "blue", true, 52), str(n.name), "is a " + title.to_lower())
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", int(8 * _s()))
	var ch := _button("Change", false)
	ch.pressed.connect(func(): if not it.is_empty(): show_category(str(it["cat"])))
	row.add_child(ch)
	var model := HSDirector.thing_model(n)
	var plain := _button("Make it plain again" if model != null else "Take it away", false)
	plain.add_theme_color_override("font_color", C_DANGER)
	plain.pressed.connect(func(): _plain(n))
	row.add_child(plain)
	side.add_child(row)
	if str(n.get("use")) == "life":
		_side_life(n)
	else:
		_side_fields(n)
	_side_story_name(n)
	var tr := _button("Try it: play from here", true)
	tr.icon = Glyphs.icon("play", "#0E1A27", 14)
	tr.tooltip_text = "The game, with you standing in front of it (a test run: the level's Test start's things in your pocket)"
	tr.pressed.connect(func(): panel.play_near(n))
	side.add_child(tr)


## a little thing: how it starts (its life's states), what the player can do, where its effects come from
func _side_life(n: Node) -> void:
	var life := _life(str(n.get("life")))
	var states: Array = life.get("states", [])
	if states.size():
		side.add_child(_label("How it starts", 12, C_FAINT, true))
		var ob := OptionButton.new()
		ob.custom_minimum_size = Vector2(0, 40) * _s()
		var now := str(n.get("life_state"))
		for i in states.size():
			ob.add_item(str(states[i].get("id", "")).capitalize(), i)
			if str(states[i].get("id", "")) == now or (now == "" and i == 0):
				ob.select(i)
		ob.item_selected.connect(func(i): _change(n, "life_state", "" if i == 0 else str(states[i].get("id", "")), "how %s starts" % n.name))
		side.add_child(ob)
	var acts: Array = []
	for st in states:
		for a in st.get("acts", []):
			var l := str(a.get("label", a.get("id", ""))) if a is Dictionary else str(a)
			if l != "" and not acts.has(l):
				acts.append(l)
	if acts.size():
		side.add_child(_label("What the player can do", 12, C_FAINT, true))
		side.add_child(_wrap(_label(" · ".join(PackedStringArray(acts)), 13, C_TEXT)))
	var marks: Array = []
	for c in n.get_children():
		if c is Marker3D:
			marks.append(c)
	if marks.size():
		side.add_child(_label("Where its effects come from", 12, C_FAINT, true))
		side.add_child(_wrap(_label("Blue dots in the 3D view: click one here, then move it onto your model.", 12, C_MUTED)))
		var fl := HFlowContainer.new()
		fl.add_theme_constant_override("h_separation", int(6 * _s()))
		fl.add_theme_constant_override("v_separation", int(6 * _s()))
		for mk in marks:
			var b := _button(str(mk.name), false)
			b.pressed.connect(func(): panel.dock.select(mk))
			fl.add_child(b)
		side.add_child(fl)


## any other thing: its use's own fields, in words
func _side_fields(n: Node) -> void:
	var fields: Array = (n.get_script().get_script_constant_map().get("FIELDS", {}) as Dictionary).get(str(n.get("use")), []) if n.get_script() != null else []
	for k in fields:
		var v = n.get(k)
		if v is Array or v is NodePath:
			continue                                   # (lights to switch, set in the Inspector)
		side.add_child(_label(FIELD_WORDS.get(k, str(k).capitalize()), 12, C_FAINT, true))
		if v is bool:
			var cb := CheckBox.new()
			cb.text = "Yes"
			cb.button_pressed = v
			cb.toggled.connect(func(on): _change(n, k, on, str(k)))
			side.add_child(cb)
		elif v is float or v is int:
			var sb := SpinBox.new()
			sb.step = 0.05 if v is float else 1.0
			sb.max_value = 1.0 if k == "see_through" else 100000.0
			sb.value = v
			sb.value_changed.connect(func(x): _change(n, k, x if v is float else int(x), str(k)))
			side.add_child(sb)
		else:
			var le := LineEdit.new()
			le.text = ", ".join(v) if v is PackedStringArray else str(v)
			le.custom_minimum_size = Vector2(0, 40) * _s()
			le.text_submitted.connect(func(_t): le.release_focus())
			le.focus_exited.connect(func():
				var nv = PackedStringArray(Array(le.text.split(",", false)).map(func(s): return s.strip_edges())) if v is PackedStringArray else le.text
				if nv != n.get(k):
					_change(n, k, nv, str(k)))
			side.add_child(le)


## the Player category's start in the level being built (the selected node's level, else the scene's first): the game's
## start or the test start
func start_of(test: bool) -> Node:
	var lv := _level_of(_sel())
	if lv == null:
		var lvs := HSDirector.nodes_of(panel.dock.root(), "HSLevel")
		lv = lvs[0] if lvs.size() else (panel.dock.root() if HSDirector.is_a(panel.dock.root(), "HSLevel") else null)
	if lv == null:
		return null
	for st in HSDirector.nodes_of(lv, "HSPlayerStart"):
		if (st.start_for == "test") == test:
			return st
	return null


func _level_of(n) -> Node:
	var x: Node = n if n != null and is_instance_valid(n) else null
	while x != null:
		if HSDirector.is_a(x, "HSLevel"):
			return x
		x = x.get_parent()
	return null


## a Player start: which way they look, what they have with them, the player's own settings (the game's), play from it
const FACING := [["North", 180.0], ["North-east", 135.0], ["East", 90.0], ["South-east", 45.0], ["South", 0.0], ["South-west", -45.0],
	["West", -90.0], ["North-west", -135.0]]
func _side_player(n: Node) -> void:
	var test: bool = n.start_for == "test"
	var lv := _level_of(n)
	_side_head(Glyphs.tile("test_start" if test else "player", "amber", true, 52), str(n.name), "is where your test play begins" if test else "is where the game begins")
	side.add_child(_wrap(_label(("F6 on %s, and Play from here, begin here; the game itself begins at the Player start." % (lv.name if lv != null else "its level")) if test
		else ("In %s. Move it where the game should begin; its arrow is the way they look." % (lv.name if lv != null else "this level")), 13, C_MUTED)))
	side.add_child(_label("Which way they look", 12, C_FAINT, true))
	var ob := OptionButton.new()
	ob.name = "Facing"
	ob.custom_minimum_size = Vector2(0, 40) * _s()
	var yaw := wrapf(float(n.rotation_degrees.y), -180.0, 180.0)
	var best := 0
	var bd := INF
	for i in FACING.size():
		ob.add_item(FACING[i][0], i)
		var dd := absf(wrapf(yaw - float(FACING[i][1]), -180.0, 180.0))
		if dd < bd:
			bd = dd
			best = i
	ob.select(best)
	ob.item_selected.connect(func(i): _change(n, "rotation_degrees", Vector3(n.rotation_degrees.x, float(FACING[i][1]), n.rotation_degrees.z), "which way %s looks" % n.name))
	side.add_child(ob)
	side.add_child(_label("They have with them", 12, C_FAINT, true))
	var fl := HFlowContainer.new()
	fl.add_theme_constant_override("h_separation", int(6 * _s()))
	fl.add_theme_constant_override("v_separation", int(6 * _s()))
	for item in n.starts_with:
		var b := _button(str(item) + "  ✕", false)
		b.tooltip_text = "Take %s out" % item
		b.pressed.connect(func():
			var now := PackedStringArray(n.starts_with)
			now.remove_at(now.find(item))
			_change(n, "starts_with", now, "%s out of %s's pocket" % [item, n.name]))
		fl.add_child(b)
	var add := MenuButton.new()
	add.name = "AddItem"
	add.text = "+ Add an item"
	add.flat = false
	add.custom_minimum_size = Vector2(0, 40) * _s()
	var items := HSDirector.ids("item", panel.dock.root())
	for i in items.size():
		add.get_popup().add_item(items[i], i)
	add.get_popup().id_pressed.connect(func(i):
		if not n.starts_with.has(items[i]):
			var now := PackedStringArray(n.starts_with)
			now.append(items[i])
			_change(n, "starts_with", now, "%s into %s's pocket" % [items[i], n.name]))
	if items.is_empty():
		add.disabled = true
		add.tooltip_text = "No items in the scene yet: a key, a flashlight (Pick up & look, Lights & power)"
	fl.add_child(add)
	side.add_child(fl)
	var g = panel.dock.game()
	if g != null:
		side.add_child(_label("The player, in every level", 12, C_FAINT, true))
		for row in [["can_run", "Can run (Shift)"], ["can_crouch", "Can crouch (C)"]]:
			var cb := CheckBox.new()
			cb.text = row[1]
			cb.button_pressed = bool(g.get(row[0]))
			cb.toggled.connect(func(on): _change(g, row[0], on, row[1].to_lower()))
			side.add_child(cb)
		var eh := HBoxContainer.new()
		eh.add_child(_wrap(_label("Eye height (m)", 13, C_TEXT)))
		var sb := SpinBox.new()
		sb.min_value = 1.2
		sb.max_value = 2.0
		sb.step = 0.01
		sb.value = float(g.get("eye_height"))
		sb.value_changed.connect(func(x): _change(g, "eye_height", x, "the player's eye height"))
		eh.add_child(sb)
		side.add_child(eh)
		var nh := HBoxContainer.new()
		nh.add_child(_wrap(_label("Their name", 13, C_TEXT)))
		var le := LineEdit.new()
		le.text = str(g.get("player_name"))
		le.custom_minimum_size = Vector2(140, 36) * _s()
		le.text_submitted.connect(func(_t): le.release_focus())
		le.focus_exited.connect(func(): if le.text != str(g.get("player_name")): _change(g, "player_name", le.text, "the player's name"))
		nh.add_child(le)
		side.add_child(nh)
	var pb := _button("Play from here", true)
	pb.name = "PlayFromHere"
	pb.icon = Glyphs.icon("play", "#0E1A27", 14)
	pb.pressed.connect(func(): panel.play_from_start(test))
	side.add_child(pb)
	_side_story_name(n)


func _side_checkpoint(n: Node) -> void:
	_side_head(Glyphs.tile("checkpoint", "amber", true, 52), str(n.name), "is a checkpoint")
	side.add_child(_wrap(_label("Each time the player walks into it the game autosaves here (the pause menu's autosave). Its size: the Inspector.", 13, C_MUTED)))
	_side_story_name(n)


## its name in the story (its id) and what in the Director file names it
func _side_story_name(n: Node) -> void:
	if n.get("id") == null:
		return
	side.add_child(_label("Its name in the story", 12, C_FAINT, true))
	var le := LineEdit.new()
	le.text = HSDirector.id_of(n)
	le.custom_minimum_size = Vector2(0, 40) * _s()
	var th := EditorInterface.get_editor_theme()
	if th != null and th.has_font("source", "EditorFonts"):
		le.add_theme_font_override("font", th.get_font("source", "EditorFonts"))
	le.text_submitted.connect(func(_t): le.release_focus())
	le.focus_exited.connect(func():
		var t := HSDirector.snake(le.text.strip_edges())
		if t != "" and t != HSDirector.id_of(n):
			_change(n, "id", t, "its story name"))
	side.add_child(le)
	var uses := used_by(HSDirector.id_of(n))
	side.add_child(_wrap(_label(("Named by " + "; ".join(PackedStringArray(uses)) + ".") if uses.size() else "Nothing in the story names it yet.", 12, C_MUTED)))


## where the Director file names an id: its quests, moments, conversations and states
func used_by(id: String) -> Array:
	var out: Array = []
	if id == "" or panel.dock.game() == null:
		return out
	var f := HSStoryFile.read(panel.dock.game().story_file)
	var needle := "\"%s\"" % id
	for q in f.get("quests", []):
		if JSON.stringify(q).contains(needle):
			out.append("the quest " + str(q.get("title", q.get("id", ""))))
	for m in f.get("moments", []):
		if JSON.stringify(m).contains(needle):
			out.append("the moment " + str(m.get("id", "")))
	var talk = f.get("talk", {})
	if talk is Dictionary:
		for who in talk:
			if str(who) == id or JSON.stringify(talk[who]).contains(needle):
				out.append(str(who) + "'s conversations")
	for s in f.get("states", []):
		if JSON.stringify(s).contains(needle):
			out.append("a state")
			break
	return out


func _side_head(tex: Texture2D, name_: String, what: String) -> void:
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", int(12 * _s()))
	var tr := TextureRect.new()
	tr.texture = tex
	tr.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	hb.add_child(tr)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var nm := _label(name_, 14, C_TEXT)
	var th := EditorInterface.get_editor_theme()
	if th != null and th.has_font("source", "EditorFonts"):
		nm.add_theme_font_override("font", th.get_font("source", "EditorFonts"))
	v.add_child(nm)
	v.add_child(_wrap(_label(what, 18, C_TEXT, true)))
	hb.add_child(v)
	side.add_child(hb)


func _plain(n: Node) -> void:
	if HSDirector.thing_model(n) != null:
		panel.plugin.unwrap_thing(n)
		panel.say("%s is a plain model again. Ctrl+Z makes it the thing again" % n.name)
	else:
		panel.dock.delete_node(n)
		panel.say("%s taken away. Ctrl+Z brings it back" % n.name)
	refresh()


func _life(name: String) -> Dictionary:
	if lives.is_empty() and FileAccess.file_exists(LIVES):
		var j = JSON.parse_string(FileAccess.get_file_as_string(LIVES))
		lives = j.get("lives", j) if j is Dictionary else {}
	return lives.get(name, {})


func _change(n: Object, prop: String, v, what: String) -> void:
	var ur = panel.plugin.get_undo_redo()
	ur.create_action("HorrorStudio: %s" % what)
	ur.add_do_property(n, prop, v)
	ur.add_undo_property(n, prop, n.get(prop))
	ur.add_do_method(self, "refresh")
	ur.add_undo_method(self, "refresh")
	ur.commit_action()


# ---- small pieces ----------------------------------------------------------------------------------------------------
static func _s() -> float:
	return Glyphs.scale()


static func _box(bg: Color, line: Color, r := 12, bw := 1, pad := 12) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = line
	s.set_border_width_all(int(round(bw * _s())) if line.a > 0.0 else 0)
	s.set_corner_radius_all(int(r * _s()))
	s.set_content_margin_all(pad * _s())
	return s


static func _label(t: String, size: int, color: Color, bold := false) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", int(size * _s()))
	l.add_theme_color_override("font_color", color)
	if bold:
		var th := EditorInterface.get_editor_theme()
		if th != null and th.has_font("bold", "EditorFonts"):
			l.add_theme_font_override("font", th.get_font("bold", "EditorFonts"))
	return l


static func _wrap(l: Label) -> Label:
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l


static func _button(t: String, primary: bool) -> Button:
	var b := Button.new()
	b.text = t
	b.custom_minimum_size = Vector2(0, 40) * _s()
	if primary:
		b.add_theme_stylebox_override("normal", _box(C_BLUE, Color(0, 0, 0, 0), 8, 0, 10))
		b.add_theme_stylebox_override("hover", _box(Color("#8CC5F7"), Color(0, 0, 0, 0), 8, 0, 10))
		b.add_theme_stylebox_override("pressed", _box(Color("#4F9BE0"), Color(0, 0, 0, 0), 8, 0, 10))
		for k in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
			b.add_theme_color_override(k, Color("#0E1A27"))
	else:
		b.add_theme_stylebox_override("normal", _box(Color(0, 0, 0, 0), Color("#45658A"), 8, 1, 10))
		b.add_theme_stylebox_override("hover", _box(C_CARD, C_BLUE, 8, 1, 10))
		b.add_theme_stylebox_override("pressed", _box(C_BLUE_BG, C_BLUE, 8, 1, 10))
	return b
