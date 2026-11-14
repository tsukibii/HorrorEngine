@tool
## The pickers in the Inspector (docs/FLAGS.md §6): on any node, a field that names flags, tasks or things carried
## (HSLogicScan's table: `needs`, `*_when`, `locked_by`, `set_flags`, `fact`, `tick`...) is drawn with the tabs' own
## chips and pickers instead of a text box: a cue's Needs, a shown thing's Shown When, a hunt's Ends When, a door's
## Locked By, a script of your own that has a `needs`. The scene's flags are in each one's menu, so a flag made for a
## marker is one click away on anything else. Lists of lines (a Story's tasks) stay as the Inspector draws them.
extends EditorInspectorPlugin

const CondEdit := preload("res://addons/horrorstudio_markers/editor/cond_edit.gd")
const SwitchEdit := preload("res://addons/horrorstudio_markers/editor/switch_edit.gd")
const Glyphs := preload("res://addons/horrorstudio_markers/editor/glyphs.gd")
const DRAWN := ["cond", "switch", "switches", "flags", "flag", "task", "item", "lock"]

var plugin: EditorPlugin


func _can_handle(object: Object) -> bool:
	return object is Node and (object as Node).get_script() != null


func _parse_property(object: Object, _type: Variant.Type, name: String, _hint_type: PropertyHint, _hint_string: String, _usage_flags: int, _wide: bool) -> bool:
	if not HSLogicScan.FIELDS.has(name):
		return false
	var enc := ""
	for f in HSLogicScan.fields_of(object):
		if String(f[0]) == name:
			enc = String(f[1])
	if not (enc in DRAWN):
		return false
	var ed := Field.new()
	ed.plugin = plugin
	ed.enc = enc
	add_property_editor(name, ed)
	return true


## one field: chips for a condition or for flags switched, a name with the scene's names to pick from
class Field extends EditorProperty:
	var plugin: EditorPlugin
	var enc := ""
	var ctl: Control
	var line: LineEdit
	var _busy := false

	func _ready() -> void:
		var node := get_edited_object() as Node
		var wiring: RefCounted = plugin.wiring
		match enc:
			"cond":
				var ce := CondEdit.new()
				var hers := node is HSNpcMarker or node is HSNpcQuest or node is HSNpcWay
				ce.none = "always" if not hers else "at once"
				ce.about_her = hers
				ce.waits = hers
				ce.groups = wiring.flag_groups(node)
				ce.tasks = wiring.names("task")
				ce.items = wiring.names("item")
				ce.changed.connect(func(t: String) -> void: _send(t))
				ctl = ce
			"switch", "switches", "flags":
				var se := SwitchEdit.new()
				se.none = "none"
				se.groups = wiring.flag_groups(node)
				se.changed.connect(func(t: String) -> void:
					if enc == "switch":
						_send(t)
						return
					var out := PackedStringArray()
					for p in SwitchEdit.parts(t):
						out.append(String(p[1]) if enc == "flags" else String(p[0]) + String(p[1]))
					_send(out))
				ctl = se
			_:
				var row := HBoxContainer.new()
				line = LineEdit.new()
				line.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				line.text_submitted.connect(func(t: String) -> void: _send(t))
				line.focus_exited.connect(func() -> void: _send(line.text))
				row.add_child(line)
				var mb := MenuButton.new()
				mb.flat = false
				mb.icon = Glyphs.icon("down", Color("#C8D2DC"), 12)
				mb.tooltip_text = "Pick one the scene already has."
				var pm := mb.get_popup()
				mb.about_to_popup.connect(func() -> void:
					pm.clear()
					pm.add_item("(none)")
					pm.set_item_metadata(0, "")
					if enc == "lock":
						for it in wiring.names("item"):
							pm.add_item("carrying %s" % it)
							pm.set_item_metadata(pm.item_count - 1, String(it))
						for f in wiring.names("flag"):
							pm.add_item("the flag %s" % f)
							pm.set_item_metadata(pm.item_count - 1, "flag:" + String(f))
						pm.add_item("never opens")
						pm.set_item_metadata(pm.item_count - 1, "flag:never")
					else:
						for nm in wiring.names(enc):
							pm.add_item(String(nm))
							pm.set_item_metadata(pm.item_count - 1, String(nm)))
				pm.index_pressed.connect(func(i: int) -> void:
					line.text = str(pm.get_item_metadata(i))
					_send(line.text))
				row.add_child(mb)
				ctl = row
		add_child(ctl)
		if enc in ["cond", "switch", "switches", "flags"]:
			set_bottom_editor(ctl)                              # (chips: under the field's name, the Inspector's whole width)
		_update_property()

	func _send(value) -> void:
		if _busy:
			return
		var was = get_edited_object().get(get_edited_property())
		if value is PackedStringArray and was is Array:
			was = HSLogicScan.lines(was)
		if typeof(was) == typeof(value) and was == value:
			return
		plugin.set_prop(get_edited_object(), get_edited_property(), value)     # (the tabs' own way: one undo step, and a list a stand-in script will take)
		plugin.wiring.touch()

	func _update_property() -> void:
		if ctl == null:
			return
		_busy = true
		var v = get_edited_object().get(get_edited_property())
		match enc:
			"cond":
				if (ctl as CondEdit).text != ", ".join(HSNpcCond.words(String(v))):
					(ctl as CondEdit).set_text(String(v))
			"switch":
				if (ctl as SwitchEdit).text != SwitchEdit.joined(SwitchEdit.parts(String(v))):
					(ctl as SwitchEdit).set_text(String(v))
			"switches", "flags":
				var t := ", ".join(HSLogicScan.lines(v))
				if (ctl as SwitchEdit).text != SwitchEdit.joined(SwitchEdit.parts(t)):
					(ctl as SwitchEdit).set_text(t)
			_:
				if line != null and line.text != String(v) and not line.has_focus():
					line.text = String(v)
		_busy = false
