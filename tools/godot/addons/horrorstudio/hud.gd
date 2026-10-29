## The Play HUD (the desk's hud.js, ported to Controls): the objective and the to-do list top left, the timer, the
## log, the reticle and its prompt, the line (subtitle) in the footer with a choice's options under it, cards (a note,
## a code pad, the player's name), a chapter's title card, the suspicion meter, the inventory's row, the stance, the
## fade to black over everything. The layout is one rule each; a game's theme comes later (play/ui/themes).
extends CanvasLayer

signal panel_done(value)
signal choice_done(index)

const SHOWN := 5

var root: Control
var obj: Label
var todo_box: VBoxContainer
var line_el: Label
var who_el: Label
var prompt_el: Label
var cursor_el: Label
var log_box: VBoxContainer
var timer_el: Label
var stance_el: Label
var seen_el: ProgressBar
var inv_box: HBoxContainer
var inv_name: Label
var hint_el: Label
var fade_el: ColorRect
var peep_el: ColorRect
var chapter_el: VBoxContainer
var chapter_t: Label
var chapter_s: Label
var panel_el: PanelContainer = null
var choice_el: HBoxContainer = null
var choice_bar: ProgressBar = null
var board_el: Label

var cursor_kind: String = "none"
var cursor_label: String = ""
var cursor_name: String = ""
var line_until: float = 0.0
var line_text: String = ""
var typing = null
const Typing := preload("res://addons/horrorstudio/typing.gd")
var line_think: bool = false
var modal_up: bool = false
var choice_keys: Array = []
var choice_sel: int = 0
var choice_spec: Dictionary = {}
var choice_t0: float = 0.0
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

func _ready() -> void:
	layer = 10
	root = Control.new()
	root.name = "Root"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	# top left: the objective and the list
	var tl := VBoxContainer.new()
	tl.name = "TopLeft"
	tl.position = Vector2(24, 20)
	tl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(tl)
	obj = _label("", 18)
	obj.name = "Objective"
	tl.add_child(obj)
	todo_box = VBoxContainer.new()
	todo_box.name = "Todo"
	tl.add_child(todo_box)
	timer_el = _label("", 26)
	timer_el.name = "Timer"
	timer_el.set_anchors_preset(Control.PRESET_CENTER_TOP)
	timer_el.position = Vector2(-40, 20)
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
	cursor_el = _label("·", 22)
	cursor_el.name = "Cursor"
	cursor_el.set_anchors_preset(Control.PRESET_CENTER)
	cursor_el.position = Vector2(-6, -14)
	root.add_child(cursor_el)
	prompt_el = _label("", 16)
	prompt_el.name = "Prompt"
	prompt_el.set_anchors_preset(Control.PRESET_CENTER)
	prompt_el.position = Vector2(18, 4)
	root.add_child(prompt_el)
	seen_el = ProgressBar.new()
	seen_el.name = "Seen"
	seen_el.set_anchors_preset(Control.PRESET_CENTER)
	seen_el.position = Vector2(-60, 40)
	seen_el.size = Vector2(120, 6)
	seen_el.show_percentage = false
	seen_el.visible = false
	root.add_child(seen_el)
	# the footer: who, the line
	var foot := VBoxContainer.new()
	foot.name = "Footer"
	foot.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	foot.position = Vector2(0, -150)
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
	choice_el = HBoxContainer.new()
	choice_el.name = "Choice"
	choice_el.visible = false
	dock.add_child(choice_el)
	choice_bar = ProgressBar.new()
	choice_bar.name = "ChoiceBar"
	choice_bar.custom_minimum_size = Vector2(240, 4)
	choice_bar.show_percentage = false
	choice_bar.visible = false
	foot.add_child(choice_bar)
	inv_box = HBoxContainer.new()
	inv_box.name = "Inventory"
	inv_box.alignment = BoxContainer.ALIGNMENT_CENTER
	inv_box.visible = false
	foot.add_child(inv_box)
	inv_name = _label("", 14)
	inv_name.name = "InventoryName"
	inv_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	foot.add_child(inv_name)
	stance_el = _label("", 14)
	stance_el.name = "Stance"
	stance_el.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	stance_el.position = Vector2(24, -40)
	root.add_child(stance_el)
	hint_el = _label("", 13)
	hint_el.name = "Hint"
	hint_el.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	hint_el.position = Vector2(-520, -30)
	root.add_child(hint_el)
	for k in [["Click", "to play"], ["W A S D", "walk"], ["Shift", "run"], ["Click", "use"], ["E", "inventory"], ["G", "put down"], ["C", "crouch"], ["Esc", "pause"]]:
		hints[k[0] + ":" + k[1]] = true
	_draw_hints()
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
	chapter_el.visible = false
	root.add_child(chapter_el)
	chapter_t = _label("", 34)
	chapter_t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	chapter_el.add_child(chapter_t)
	chapter_s = _label("", 16)
	chapter_s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	chapter_el.add_child(chapter_s)


func _label(text: String, size: int) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


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
	cursor_el.text = {"none": "·", "locked": "✕"}.get(cursor_kind, "○")
	prompt_el.text = (cursor_label + ("  " + cursor_name if cursor_name != "" else "")) if cursor_label != "" else ""


func objective(text) -> void:
	obj.text = named(text)
	obj.visible = text != null and str(text) != ""


func todo(items: Array, fresh: bool) -> void:
	tasks = items
	for c in todo_box.get_children():
		c.queue_free()
	for t in items:
		var l := _label("", 15)
		var box := {"done": "✓", "failed": "✕"}.get(t["state"], "☐")
		var s := "%s %s" % [box, named(t["text"])]
		if t.get("who") != null:
			s += "  · " + named(t["who"])
		if t.get("left") != null:
			s += "  %ds" % int(ceil(float(t["left"])))
		l.text = s
		l.set_meta("task", t["id"])
		l.set_meta("state", t["state"])
		if t["state"] == "failed":
			l.modulate = Color(1, 0.4, 0.4)
		elif t["state"] == "done":
			l.modulate = Color(1, 1, 1, 0.5)
		todo_box.add_child(l)
	todo_box.visible = items.size() > 0


func chapter(title, sub, secs: float) -> void:
	chapter_t.text = str(title if title != null else "")
	chapter_s.text = str(sub if sub != null else "")
	chapter_el.visible = true
	chapter_up = true
	var t := get_tree().create_timer(0.7 + secs)
	await t.timeout
	chapter_el.visible = false
	chapter_up = false


func line(text, who, secs: float, think: bool, how = null) -> void:
	line_text = named(text)
	line_think = think
	typing = null
	line_until = Time.get_ticks_msec() / 1000.0 + secs
	who_el.text = str(who if who != null else "")
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


func log(text: String) -> void:
	logs.append(text)
	var l := _label(text, 13)
	log_box.add_child(l)
	get_tree().create_timer(5.0).timeout.connect(func(): if is_instance_valid(l): l.queue_free())


func timer(secs) -> void:
	timer_el.text = "" if secs == null else "%.1f" % max(0.0, float(secs))


func board(text) -> void:
	board_el.text = str(text if text != null else "")


func seen(k: float) -> void:
	seen_el.visible = k > 0.01
	seen_el.value = min(1.0, k) * 100.0


func set_stance(s: String) -> void:
	stance_el.text = s


func locked(on: bool) -> void:
	hint_el.visible = not on and not modal_up


func peep(on: bool) -> void:
	peep_el.visible = on


func progress(p) -> void:
	cursor_el.text = ("◔" if float(p) < 0.5 else "◕") if p != null else {"none": "·", "locked": "✕"}.get(cursor_kind, "○")


func hint_key(k: String, w: String) -> void:
	hints[k + ":" + w] = true
	_draw_hints()


func _draw_hints() -> void:
	var parts: Array = []
	for h in hints:
		parts.append(h.replace(":", " "))
	hint_el.text = "   ".join(parts)


func press() -> void:
	pass


func shake() -> void:
	pass


func modal(up: bool) -> void:
	modal_up = up
	if up:
		hint_el.visible = false


func inventory(list: Array, at: int, shown: bool, peek: bool) -> void:
	for c in inv_box.get_children():
		c.queue_free()
	var n := list.size()
	for i in n:
		var d := i - at
		if n > 0:
			d = posmod(i - at, n)
			if d > n / 2:
				d -= n
		if abs(d) > (SHOWN - 1) / 2:
			continue
		var l := _label(list[i]["name"], 14 if d == 0 else 11)
		l.set_meta("id", list[i]["id"])
		l.set_meta("d", d)
		if d != 0:
			l.modulate = Color(1, 1, 1, 0.5)
		inv_box.add_child(l)
	inv_name.text = named(list[at]["name"]) if (at >= 0 and at < n) else ""
	inv_box.visible = n > 0 and shown
	inv_name.visible = inv_box.visible


func _process(delta: float) -> void:
	tick(delta)


func tick(dt: float = 0.0) -> void:
	type_tick(dt)
	if line_until > 0 and Time.get_ticks_msec() / 1000.0 > line_until:
		line_el.text = ""
		who_el.text = ""
		line_text = ""
		line_until = 0.0
	if not choice_over and choice_spec.get("secs") != null and float(choice_spec["secs"]) > 0:
		var u := (Time.get_ticks_msec() / 1000.0 - choice_t0) / float(choice_spec["secs"])
		choice_bar.value = max(0.0, 1.0 - u) * 100.0
		if u >= 1.0:
			_finish_choice(int(choice_spec.get("def", 0)))


func fade_alpha() -> float:
	return fade_el.color.a


func set_fade(a: float) -> void:
	fade_el.color = Color(0, 0, 0, clamp(a, 0.0, 1.0))


# ---- cards: a panel to read, a code lock, the player's name; resolves through panel_done ----
func panel(spec: Dictionary) -> Variant:
	if panel_el != null:
		panel_el.queue_free()
	panel_spec = spec
	panel_typed = ""
	panel_el = PanelContainer.new()
	panel_el.name = "Panel"
	panel_el.set_anchors_preset(Control.PRESET_CENTER)
	panel_el.position = Vector2(-260, -160)
	panel_el.custom_minimum_size = Vector2(520, 200)
	var v := VBoxContainer.new()
	panel_el.add_child(v)
	var title := _label(named(spec.get("title", "")), 20)
	title.name = "Title"
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
	else:
		var text := _label(named(spec.get("text", "")), 16)
		text.name = "Text"
		text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.custom_minimum_size = Vector2(500, 0)
		v.add_child(text)
		v.add_child(_label("Esc  Close", 12))
	root.add_child(panel_el)
	modal(true)
	var v2 = await panel_done
	return v2


func _finish_panel(v) -> void:
	if panel_el == null:
		return
	panel_el.queue_free()
	panel_el = null
	modal(false)
	panel_done.emit(v)


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


## a multiple choice (the story's ask, a reply, a timed choice): the question is the footer's line, the options right
## under it; `secs` times it (`def`, an index, when it runs out); resolves with the index picked through choice_done
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
		var l := _label("", 16)
		var lab: String = named(o.get("label", "") if o is Dictionary else o)
		var think = o.get("think") if o is Dictionary else null
		l.text = "%d  %s%s" % [i + 1, lab, ("\n   " + named(think)) if think != null else ""]
		l.name = "Opt%d" % i
		l.set_meta("label", lab)
		choice_el.add_child(l)
		if i < opts.size() - 1:
			choice_el.add_child(_label("  —  ", 16))
	if spec.get("prompt") != null and str(spec["prompt"]) != "":
		line_el.text = named(spec["prompt"])
		line_text = named(spec["prompt"])
		who_el.text = named(spec.get("who", "") if spec.get("who") != null else "")
		line_until = 0.0
	choice_el.visible = true
	choice_bar.visible = spec.get("secs") != null and float(spec.get("secs", 0)) > 0
	choice_bar.value = 100
	choice_t0 = Time.get_ticks_msec() / 1000.0
	modal(true)
	_mark_choice()
	var i = await choice_done
	return i


func _mark_choice() -> void:
	var i := 0
	for c in choice_el.get_children():
		if c.has_meta("label"):
			c.modulate = Color(1, 1, 1, 1) if i == choice_sel else Color(1, 1, 1, 0.55)
			i += 1


func _finish_choice(i: int) -> void:
	if choice_over:
		return
	choice_over = true
	choice_el.visible = false
	choice_bar.visible = false
	if choice_spec.get("prompt") != null:
		line_el.text = ""
		line_text = ""
		who_el.text = ""
	modal(false)
	choice_done.emit(i)


func choice_key(key: String) -> bool:
	if choice_over:
		return false
	var n: int = choice_spec.get("options", []).size()
	if key.length() == 1 and key >= "1" and key <= "9":
		var i := int(key) - 1
		if i < n:
			_finish_choice(i)
		return true
	if key == "A" or key == "Left":
		choice_sel = max(0, choice_sel - 1)
		_mark_choice()
		return true
	if key == "D" or key == "Right":
		choice_sel = min(n - 1, choice_sel + 1)
		_mark_choice()
		return true
	if key == "Enter" or key == "Space":
		_finish_choice(choice_sel)
		return true
	return true


func choice_options() -> Array:
	var out: Array = []
	for c in choice_el.get_children():
		if c.has_meta("label"):
			out.append(c.get_meta("label"))
	return out


func examine(spec: Dictionary) -> Variant:
	return await panel({"title": spec.get("title", ""), "text": spec.get("text", "")})
