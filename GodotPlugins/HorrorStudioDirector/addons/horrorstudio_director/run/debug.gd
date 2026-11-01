## The game's debug panel (docs/GODOT_DIRECTOR.md §7), F9 as on the desk: where the player is (the chapter and the
## step), the objective and the to-do list, the flags set, the items held, karma and the counters, and the last events
## as they happen (entered, used, picked up, a flag, a beat fired). Over everything but the menu; off in the
## HSGame's `debug_panel`.
extends CanvasLayer

var game: Node = null                 # the HSGame
var box: PanelContainer
var text: RichTextLabel
var log_lines: Array = []
var now_step := ""
var shown := false


func _ready() -> void:
	layer = 50
	box = PanelContainer.new()
	box.anchor_left = 1.0
	box.anchor_right = 1.0
	box.offset_left = -430
	box.offset_right = -12
	box.offset_top = 12
	box.offset_bottom = 520
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.05, 0.07, 0.82)
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	box.add_theme_stylebox_override("panel", sb)
	text = RichTextLabel.new()
	text.bbcode_enabled = true
	text.fit_content = false
	text.scroll_active = false
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	text.add_theme_font_size_override("normal_font_size", 13)
	text.add_theme_font_size_override("bold_font_size", 13)
	box.add_child(text)
	add_child(box)
	box.visible = false


func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventKey and ev.pressed and not ev.echo and ev.physical_keycode == KEY_F9:
		shown = not shown
		box.visible = shown
		_draw()


func step(nid: String) -> void:
	now_step = nid
	_note("[color=#ffd479]→ %s[/color]" % nid)


func event(ev: Dictionary) -> void:
	var t := str(ev.get("type", ""))
	if t in ["tick", "start"]:
		return
	var what := ""
	for k in ["id", "item", "note", "by", "ask", "option", "state"]:
		if ev.has(k) and ev[k] != null:
			what += " " + str(ev[k])
	_note("%s%s" % [t, what])


func _note(s: String) -> void:
	log_lines.append(s)
	while log_lines.size() > 12:
		log_lines.pop_front()
	if shown:
		_draw()


func _process(_dt: float) -> void:
	if shown and Engine.get_process_frames() % 15 == 0:
		_draw()


func _draw() -> void:
	if text == null or game == null or game.runtime == null:
		return
	var rt = game.runtime
	var run = rt.run
	var st = rt.story
	var out := "[b]HorrorStudio[/b]  F9\n"
	var node: Dictionary = st.flow.get(now_step, {}) if st != null else {}
	var title := str(st.stitches.get(node.get("ref", ""), {}).get("title", st.scenes.get(node.get("ref", ""), {}).get("title", node.get("title", now_step)))) if st != null else now_step
	out += "[color=#9fd3ff]now[/color] %s (%s, %s)\n" % [title, now_step, node.get("type", "")]
	if rt.play != null:
		out += "[color=#9fd3ff]level[/color] %s   [color=#9fd3ff]at[/color] %.1f, %.1f\n" % [rt.play.level, rt.play.player.pos.x, -rt.play.player.pos.z]
		var looks = rt.play.look.get("id")
		if looks != null:
			out += "[color=#9fd3ff]looking at[/color] %s\n" % looks
	if run != null:
		var obj: String = rt.hud.obj.text if rt.hud != null else ""
		if obj != "":
			out += "[color=#9fd3ff]objective[/color] %s\n" % obj
		for t in run.get("todo", []):
			var mark := "✓" if t["state"] == "done" else ("✗" if t["state"] == "failed" else "·")
			out += "   %s %s\n" % [mark, t.get("text", t["id"])]
		var fl: Array = []
		for f in run["flags"]:                    # the facts: not the brain's conditions (?), the moments fired, the steps reached
			var fs := str(f)
			if not fs.begins_with("_fired_") and not fs.begins_with("@") and not fs.begins_with("?"):
				fl.append(fs)
		fl.sort()
		var br = game.get("brain") if game != null else null
		if br != null and br.quest != "":
			out += "[color=#9fd3ff]quest[/color] %s\n" % br.quest
		out += "[color=#9fd3ff]facts[/color] %s\n" % (", ".join(fl) if fl.size() else "none")
		var its: Array = rt.play.items.keys() if rt.play != null else (run["items"] as Dictionary).keys()
		out += "[color=#9fd3ff]items[/color] %s\n" % (", ".join(its) if its.size() else "none")
		out += "[color=#9fd3ff]karma[/color] %s   [color=#9fd3ff]counters[/color] %s\n" % [JSON.stringify(run["karma"]), JSON.stringify(run["counters"])]
		var steps: Array = []
		for f in run["flags"]:
			if str(f).begins_with("@"):
				steps.append(str(f).substr(1))
		out += "[color=#9fd3ff]reached[/color] %s\n" % " › ".join(steps)
	out += "[color=#9fd3ff]events[/color]\n"
	for l in log_lines:
		out += "   " + l + "\n"
	text.text = out
