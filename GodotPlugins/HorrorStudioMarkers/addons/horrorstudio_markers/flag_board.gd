## F7 in the game (docs/FLAGS.md §7): beside the chip over each character (what she's doing, what she waits for), a
## list at the left of the screen of every flag the scene names, the ones that are on bright and the rest dim, the
## to-do list's tasks and what's in the pocket, as they change. So why something waits can be read off the screen:
## its flag is there, and it's dim. A debug label, drawn plainly; it's never in a saved scene.
##
## One of these is made under the root the first time a character with markers or a thing's Logic is ready; it is
## also the one place F7 is heard (each character listening for itself flipped it once per character).
class_name HSFlagBoard
extends CanvasLayer

const NAME := "_HSFlagBoard"
var most := 40                                ## flags listed before "+N more" (the ones that are on come first)

var _panel: PanelContainer
var _text: RichTextLabel
var _names: PackedStringArray = []            # every flag the scene names (read when F7 comes on)
var _tasks: PackedStringArray = []
var _poll := 0.0
var _was := false


static var _one: HSFlagBoard                  # (kept: two characters ready in one frame would each make one before either is in the tree)


static func of(tree: SceneTree) -> HSFlagBoard:
	if _one != null and is_instance_valid(_one):
		return _one
	var n := tree.root.get_node_or_null(NAME)
	if n == null:
		n = HSFlagBoard.new()
		n.name = NAME
		tree.root.add_child.call_deferred(n)
	_one = n as HSFlagBoard
	return _one


func _ready() -> void:
	layer = 6
	process_mode = Node.PROCESS_MODE_ALWAYS
	_panel = PanelContainer.new()
	_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.045, 0.06, 0.8)
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(10)
	_panel.add_theme_stylebox_override("panel", sb)
	_panel.position = Vector2(16, 150)
	_text = RichTextLabel.new()
	_text.bbcode_enabled = true
	_text.fit_content = true
	_text.scroll_active = false
	_text.autowrap_mode = TextServer.AUTOWRAP_OFF
	_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_text.add_theme_font_size_override("normal_font_size", 14)
	_text.add_theme_font_size_override("bold_font_size", 14)
	_panel.add_child(_text)
	add_child(_panel)
	_panel.visible = false


func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and (event as InputEventKey).physical_keycode == KEY_F7:
		HSNpc.debug = not HSNpc.debug


func _process(dt: float) -> void:
	if HSNpc.debug != _was:
		_was = HSNpc.debug
		_panel.visible = _was
		if _was:
			read()
		_poll = 0.0
	if not _was:
		return
	_poll -= dt
	if _poll <= 0.0:
		_poll = 0.25
		_text.text = text()


## the scene's names read again (a level loaded since)
func read() -> void:
	var found := HSLogicScan.scan(get_tree().current_scene if get_tree().current_scene != null else get_tree().root)
	_names = HSLogicScan.names(found, "flag")
	_tasks = HSLogicScan.names(found, "task")


# the flags that are on, from whoever keeps them
func _on_now() -> Dictionary:
	var st := HSNpcCond.story(get_tree())
	if st != null and st.get("flags") is Dictionary:
		return st.get("flags")
	return HSNpcCond.flags


## what the board says now (BBCode): the flags (on first), the tasks, the pocket
func text() -> String:
	var on := _on_now()
	var lines := PackedStringArray(["[b]FLAGS[/b]  [color=#8a93a0]F7[/color]"])
	var shown := 0
	var all := Array(_names)
	for f in on:
		if not (String(f) in all):
			all.append(String(f))
	all.sort_custom(func(a, b) -> bool:
		return (on.has(a) and not on.has(b)) or (on.has(a) == on.has(b) and String(a) < String(b)))
	for f2 in all:
		if HSLogicScan.kit_flag(String(f2)) and not on.has(f2):
			continue
		if shown >= most:
			lines.append("[color=#8a93a0]+%d more[/color]" % (all.size() - shown))
			break
		shown += 1
		lines.append(("[color=#81C784]● %s[/color]" if on.has(f2) else "[color=#6b7480]○ %s[/color]") % f2)
	if shown == 0:
		lines.append("[color=#6b7480]none yet[/color]")
	var st := HSNpcCond.story(get_tree())
	if st != null and st.has_method("done") and st.has_method("has_task"):
		var rows := PackedStringArray()
		for t in _tasks:
			if st.has_task(t):
				rows.append(("[color=#BA68C8]☑ %s[/color]" if st.done(t) else "[color=#e0d6ea]☐ %s[/color]") % t)
			else:
				rows.append("[color=#6b7480]· %s[/color]" % t)
		if st.has_method("open_tasks"):
			for t2 in st.open_tasks():
				if not (String(t2) in _tasks):
					rows.append("[color=#e0d6ea]☐ %s[/color]" % t2)
		if not rows.is_empty():
			lines.append("")
			lines.append("[b]TASKS[/b]")
			lines.append_array(rows)
		var items = st.get("items")
		if items is Dictionary and not (items as Dictionary).is_empty():
			lines.append("")
			lines.append("[b]POCKET[/b]")
			for it in (items as Dictionary):
				lines.append("[color=#FFB74D]%s%s[/color]" % [it, ("  ×%d" % int(items[it])) if int(items[it]) > 1 else ""])
	return "\n".join(lines)


## is it up?
func showing() -> bool:
	return _panel != null and _panel.visible
