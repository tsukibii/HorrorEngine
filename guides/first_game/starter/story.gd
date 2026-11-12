## The story on screen, for a game built by hand (guides/tutorial_v2): the objective, a to-do list whose tasks are
## ticked off, a line at the bottom, a card in the middle (a note's words), and the ending; what the player carries
## (`items`) and the facts set (`flags`). Put it in the main scene: a CanvasLayer called Story with this script. The
## other starter scripts find it by its group, hs_story: a pickup gives into it, a note opens its card, a door asks it
## for the key, an area ticks its tasks.
##   objective("Find room 304")      add_task("key", "Find the master key")      tick("key")
##   say("Locked.")                  card("A note", "...")                        end()  (or end_with(title, words))
##   give("key_304"), has("key_304"), flag("met_her"), is_set("met_her"), holds("task:key") (what areas' `needs` say),
##   holds("on:out") (that task on the list and not done yet: you're on it)
## The pocket counts (give("batteries", "Batteries", model, 2), count_of, take), knows each thing's name and its model,
## and when the scene has an HSHud (the UI plugin's) it's that HUD's inventory row: the things themselves in their
## slots, the one in the hand in the middle; Tab shows it or hides it, the wheel turns it, and it shows a moment when
## something comes in. The player's `cash` too: pay(4.5) (false when there isn't enough), earn(20) (the devices
## plugin's laptop sells for it; a pickup with `cash` gives it).
extends CanvasLayer

signal task_added(id: String)
signal task_done(id: String)
signal got(item: String)
signal flagged(fact: String)
signal ended(title: String)
signal kept                                           ## a checkpoint was kept (checkpoint())
signal died(how: String)                              ## die()
signal revived                                        ## back at the checkpoint after dying
signal pocket_changed                                 ## something came into the pocket or went out of it
signal cash_changed(cash: float)

@export var objective_text := ""                      ## the objective when the game starts
@export var tasks: PackedStringArray = []             ## the to-do list when it starts, each "id: what it says"
@export var ending_title := "The end"                 ## what end() shows
@export_multiline var ending_text := ""
@export var accent := Color(0.88, 0.64, 0.37)         ## the list's ticks and the cards' titles
@export var cash := 0.0                               ## the player's money: what the laptop's shop takes
@export var pocket_row := true                        ## the pocket shown as an HSHud's inventory row (when the scene has one)

var items := {}                                       # what's carried: its name -> how many
var names := {}                                       # what each is called on screen
var models := {}                                      # what each looks like in its slot (a copy of the thing)
var flags := {}
var over := false
var dead := false                                     ## between die() and the checkpoint
var deaths := 0
var death_secs := 2.6                                 ## how long the death card stays
var _kept := {}                                       # the checkpoint: what you'd done and where you stood
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
var _at := 0                                          # the pocket's thing in the hand
var _shown := false                                   # the row up (Tab)
var _peek := 0.0                                      # the row up for a moment: something came in
var _hud: Node = null


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


## into the pocket: `label` what it's called (its name when not given), `model` what it looks like in its slot (a copy of
## the thing: the pocket keeps it), `count` how many
func give(item: String, label := "", model: Node3D = null, count := 1) -> void:
	items[item] = int(items.get(item, 0)) + max(count, 1)
	if label != "":
		names[item] = label
	if model != null:
		if models.has(item) and is_instance_valid(models[item]) and models[item] != model:
			model.queue_free()                         # one model a thing: the first one's kept
		else:
			models[item] = model
	_at = _order().find(item)
	_peek = 2.5
	_draw_pocket()
	got.emit(item)
	pocket_changed.emit()


func has(item: String) -> bool:
	return int(items.get(item, 0)) > 0


func count_of(item: String) -> int:
	return int(items.get(item, 0))


## out of the pocket (`count` of them; all of it at 0)
func take(item: String, count := 1) -> void:
	var n: int = int(items.get(item, 0)) - maxi(count, 1)
	if n > 0:
		items[item] = n
	else:
		items.erase(item)
		names.erase(item)
		var m = models.get(item)
		models.erase(item)
		if m != null and is_instance_valid(m) and not m.is_inside_tree() and _find_hud() == null:
			m.free()                                   # (the HUD's row frees the ones it held)
	_draw_pocket()
	pocket_changed.emit()


## pay out of the cash: false (and nothing taken) when there isn't enough
func pay(amount: float) -> bool:
	if amount > cash + 0.0001:
		return false
	cash = snappedf(cash - amount, 0.01)
	cash_changed.emit(cash)
	return true


func earn(amount: float) -> void:
	cash = snappedf(cash + amount, 0.01)
	cash_changed.emit(cash)


## the pocket's things in the order they came in
func _order() -> Array:
	return items.keys()


## the pocket as the HUD's inventory row (an HSHud anywhere in the scene), the one in the hand in the middle
func _draw_pocket() -> void:
	var h := _find_hud()
	if h == null or not pocket_row or not h.has_method("inventory"):
		return
	var keys := _order()
	_at = clampi(_at, 0, max(keys.size() - 1, 0))
	var list: Array = []
	for id in keys:
		var n := int(items[id])
		var nm := str(names.get(id, str(id).replace("_", " ")))
		list.append({"id": id, "name": nm + (("  x%d" % n) if n > 1 else ""), "model": models.get(id)})
	h.inventory(list, _at, _shown or _peek > 0.0, false)


func _find_hud() -> Node:
	if _hud != null and is_instance_valid(_hud):
		return _hud
	_hud = null
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		var sc: Script = n.get_script()
		if sc != null and sc.get_global_name() == &"HSHud":
			_hud = n
			break
	return _hud


func _unhandled_input(e: InputEvent) -> void:
	if items.is_empty() or _find_hud() == null or not pocket_row:
		return
	if e is InputEventKey and e.pressed and not e.echo and e.physical_keycode == KEY_TAB:
		_shown = not _shown
		_draw_pocket()
	elif e is InputEventMouseButton and e.pressed and (_shown or _peek > 0.0) and items.size() > 1 \
			and e.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
		_at = posmod(_at + (1 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -1), items.size())
		_peek = max(_peek, 1.5)
		_draw_pocket()


func flag(fact: String) -> void:
	if fact != "" and not flags.has(fact):
		flags[fact] = true
		flagged.emit(fact)


func is_set(fact: String) -> bool:
	return flags.has(fact)


## a fact taken back (a hunt's "it's running"; most facts are never unset)
func unflag(fact: String) -> void:
	flags.erase(fact)


# ---- dying, and coming back (a lethal hunt: hunt.gd) ---------------------------------------------------------------

func _doors() -> Array:
	var out := []
	for it in get_tree().get_nodes_in_group("hs_interior"):
		for n in it.find_children("*", "", true, false):
			if n.has_method("lock") and "open" in n:
				out.append(n)
	return out


## Keep where you are and what you've done: the tasks, the facts, the pocket and the cash, the objective, the doors.
## die() comes back to it. A checkpoint.gd area calls this; a lethal hunt does when it starts.
func checkpoint() -> void:
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	_kept = {"flags": flags.duplicate(), "tasks": _tasks.duplicate(true), "items": items.duplicate(), "names": names.duplicate(),
		"cash": cash, "objective": _obj.text, "doors": {}}
	if pl != null:
		_kept["at"] = pl.global_transform
		_kept["pitch"] = float(pl.get("pitch")) if pl.get("pitch") != null else 0.0
	for d in _doors():
		_kept["doors"][d.get_path()] = [bool(d.get("open")), bool(d.get("unlocked"))]
	kept.emit()


func has_checkpoint() -> bool:
	return not _kept.is_empty()


## You died: black, a card with `title` and `text`, then back at the checkpoint as you were (no checkpoint: where you
## are, with what you have). `how` is who or what did it, for the `died` signal.
func die(how := "", title := "You died", text := "") -> void:
	if over or dead:
		return
	dead = true
	over = true                                           # (the player stops, the director and the hunts wait)
	deaths += 1
	_end_title.text = title
	_end_text.text = text
	_end.visible = true
	_end.modulate.a = 0.0
	create_tween().tween_property(_end, "modulate:a", 1.0, 0.35)
	died.emit(how)
	get_tree().create_timer(death_secs).timeout.connect(revive)


## Back at the checkpoint (die() calls it after its card).
func revive() -> void:
	if not dead:
		return
	if not _kept.is_empty():
		flags = (_kept["flags"] as Dictionary).duplicate()
		_tasks = (_kept["tasks"] as Array).duplicate(true)
		items = (_kept["items"] as Dictionary).duplicate()
		names = (_kept["names"] as Dictionary).duplicate()
		cash = float(_kept["cash"])
		objective(str(_kept["objective"]))
		for path in _kept["doors"]:
			var d := get_node_or_null(path)
			if d != null:
				d.set("unlocked", _kept["doors"][path][1])
				d.set("open", _kept["doors"][path][0])
		var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
		if pl != null and _kept.has("at"):
			if pl.get("seat") != null and pl.has_method("rise"):
				pl.rise()
			pl.global_transform = _kept["at"]
			pl.set("velocity", Vector3.ZERO)
			pl.set("pitch", _kept["pitch"])
			var eye := pl.get_node_or_null("Eye") as Node3D
			if eye != null:
				eye.rotation.x = float(_kept["pitch"])
		_draw_list()
		_draw_pocket()
		cash_changed.emit(cash)
	dead = false
	over = false
	_card.visible = false
	var tw := create_tween()
	tw.tween_property(_end, "modulate:a", 0.0, 0.6)
	tw.tween_callback(func() -> void:
		if not over:
			_end.visible = false)
	revived.emit()


## what an area's, a door's or a cue's `needs` says: "" always, "task:<id>" that task done, "on:<id>" that task on the
## list and not done yet (you're on it), "item:<name>" carried, any other word a fact set, "!" in front for not; several
## apart by commas, all of them
func holds(needs: String) -> bool:
	for part in needs.split(",", false):
		var w := part.strip_edges()
		var neg := w.begins_with("!")
		if neg:
			w = w.substr(1)
		var ok := false
		if w.begins_with("task:"):
			ok = done(w.substr(5))
		elif w.begins_with("on:"):
			ok = has_task(w.substr(3)) and not done(w.substr(3))
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
	if _peek > 0.0:
		_peek -= dt
		if _peek <= 0.0:
			_draw_pocket()                             # the row down again (unless Tab put it up)
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
