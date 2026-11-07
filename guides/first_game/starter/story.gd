## The story on screen, for a game built by hand (guides/tutorial_v2): the objective, a to-do list whose tasks are
## ticked off, a line at the bottom, a card in the middle (a note's words), and the ending; what the player carries
## (`items`) and the facts set (`flags`). Put it in the main scene: a CanvasLayer called Story with this script. The
## other starter scripts find it by its group, hs_story: a pickup gives into it, a note opens its card, a door asks it
## for the key, an area ticks its tasks.
##   objective("Find room 304")      add_task("key", "Find the master key")      tick("key")
##   say("Locked.")                  card("A note", "...")                        end()  (or end_with(title, words))
##   give("key_304"), has("key_304"), flag("met_her"), is_set("met_her"), holds("task:key") (what areas' `needs` say)
extends CanvasLayer

signal task_added(id: String)
signal task_done(id: String)
signal got(item: String)
signal flagged(fact: String)
signal ended(title: String)

@export var objective_text := ""                      ## the objective when the game starts
@export var tasks: PackedStringArray = []             ## the to-do list when it starts, each "id: what it says"
@export var ending_title := "The end"                 ## what end() shows
@export_multiline var ending_text := ""
@export var accent := Color(0.88, 0.64, 0.37)         ## the list's ticks and the cards' titles

var items := {}
var flags := {}
var over := false
var _tasks: Array = []                                # {id, text, done}
var _obj: Label
var _list: RichTextLabel
var _line: Label
var _line_left := 0.0
var _card: PanelContainer
var _card_title: Label
var _card_text: Label
var _end: ColorRect
var _end_title: Label
var _end_text: Label


func _ready() -> void:
	add_to_group("hs_story")
	layer = 5
	_build()
	if objective_text != "":
		objective(objective_text)
	for t in tasks:
		var i := t.find(":")
		if i > 0:
			add_task(t.substr(0, i).strip_edges(), t.substr(i + 1).strip_edges())


# ---- what the other scripts call ---------------------------------------------------------------------------------
func objective(text: String) -> void:
	_obj.text = text
	_obj.visible = text != ""


func add_task(id: String, text: String) -> void:
	for t in _tasks:
		if t["id"] == id:
			return
	_tasks.append({"id": id, "text": text, "done": false})
	_draw_list()
	task_added.emit(id)


## "id: what it says" (an export's line) as a task
func add_line(line: String) -> void:
	var i := line.find(":")
	if i > 0:
		add_task(line.substr(0, i).strip_edges(), line.substr(i + 1).strip_edges())


func tick(id: String) -> void:
	for t in _tasks:
		if t["id"] == id and not t["done"]:
			t["done"] = true
			_draw_list()
			task_done.emit(id)
			return


func has_task(id: String) -> bool:
	return _tasks.any(func(t): return t["id"] == id)


func done(id: String) -> bool:
	return _tasks.any(func(t): return t["id"] == id and t["done"])


func say(text: String, secs := 3.0) -> void:
	_line.text = text
	_line.visible = true
	_line_left = secs


func card(title: String, text: String) -> void:
	_card_title.text = title
	_card_title.visible = title != ""
	_card_text.text = text
	_card.visible = true


func card_up() -> bool:
	return _card.visible


func close_card() -> void:
	_card.visible = false


func give(item: String) -> void:
	items[item] = true
	got.emit(item)


func has(item: String) -> bool:
	return items.has(item)


func take(item: String) -> void:
	items.erase(item)


func flag(fact: String) -> void:
	if fact != "" and not flags.has(fact):
		flags[fact] = true
		flagged.emit(fact)


func is_set(fact: String) -> bool:
	return flags.has(fact)


## what an area's or a door's `needs` says: "" always, "task:<id>" that task done, "item:<name>" carried, any other word
## a fact set, "!" in front for not; several apart by commas, all of them
func holds(needs: String) -> bool:
	for part in needs.split(",", false):
		var w := part.strip_edges()
		var neg := w.begins_with("!")
		if neg:
			w = w.substr(1)
		var ok := false
		if w.begins_with("task:"):
			ok = done(w.substr(5))
		elif w.begins_with("item:"):
			ok = has(w.substr(5))
		elif w != "":
			ok = is_set(w)
		else:
			ok = true
		if ok == neg:
			return false
	return true


## the ending: the screen goes black over a second, its title and words; the player stops
func end() -> void:
	end_with(ending_title, ending_text)


func end_with(title: String, text: String = "") -> void:
	if over:
		return
	over = true
	_end_title.text = title
	_end_text.text = text
	_end.visible = true
	_end.modulate.a = 0.0
	create_tween().tween_property(_end, "modulate:a", 1.0, 1.2)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	ended.emit(title)


# ---- on screen ---------------------------------------------------------------------------------------------------
func _process(dt: float) -> void:
	if _line_left > 0.0:
		_line_left -= dt
		if _line_left <= 0.0:
			_line.visible = false


func _draw_list() -> void:
	var a := accent.to_html(false)
	var s := ""
	for t in _tasks:
		s += ("[color=#%s]■[/color] [color=#8a8780][s]%s[/s][/color]\n" % [a, t["text"]]) if t["done"] else ("[color=#%s]□[/color] %s\n" % [a, t["text"]])
	_list.text = s
	_list.visible = not _tasks.is_empty()


func _label(size: int, col := Color(0.92, 0.9, 0.85)) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("shadow_offset_x", 1)
	l.add_theme_constant_override("shadow_offset_y", 1)
	return l


func _build() -> void:
	var top := VBoxContainer.new()
	top.position = Vector2(28, 22)
	top.custom_minimum_size = Vector2(460, 0)
	add_child(top)
	_obj = _label(20)
	_obj.visible = false
	top.add_child(_obj)
	_list = RichTextLabel.new()
	_list.bbcode_enabled = true
	_list.fit_content = true
	_list.scroll_active = false
	_list.custom_minimum_size = Vector2(460, 0)
	_list.add_theme_font_size_override("normal_font_size", 17)
	_list.add_theme_color_override("default_color", Color(0.9, 0.88, 0.83))
	_list.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	_list.visible = false
	top.add_child(_list)
	_line = _label(20)
	_line.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_line.offset_top = -86
	_line.offset_bottom = -50
	_line.offset_left = -500
	_line.offset_right = 500
	_line.visible = false
	add_child(_line)
	_card = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.08, 0.92)
	sb.border_color = accent.darkened(0.35)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(26)
	_card.add_theme_stylebox_override("panel", sb)
	_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_card.custom_minimum_size = Vector2(520, 0)
	_card.offset_left = -260
	_card.offset_right = 260
	_card.offset_top = -170
	_card.grow_vertical = Control.GROW_DIRECTION_BOTH
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	_card.add_child(col)
	_card_title = _label(22, accent)
	col.add_child(_card_title)
	_card_text = _label(18)
	_card_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_card_text.custom_minimum_size = Vector2(468, 0)
	col.add_child(_card_text)
	var hint := _label(13, Color(0.6, 0.58, 0.54))
	hint.text = "E to put it away"
	col.add_child(hint)
	_card.visible = false
	add_child(_card)
	_end = ColorRect.new()
	_end.color = Color(0, 0, 0, 1)
	_end.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_end.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ec := VBoxContainer.new()
	ec.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	ec.alignment = BoxContainer.ALIGNMENT_CENTER
	ec.custom_minimum_size = Vector2(700, 0)
	ec.offset_left = -350
	ec.offset_right = 350
	_end.add_child(ec)
	_end_title = _label(34, accent)
	_end_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ec.add_child(_end_title)
	_end_text = _label(18)
	_end_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_end_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_end_text.custom_minimum_size = Vector2(700, 0)
	ec.add_child(_end_text)
	_end.visible = false
	add_child(_end)
