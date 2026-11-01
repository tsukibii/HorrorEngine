@tool
extends EditorInspectorPlugin
## The Inspector's HorrorStudio box (docs/GODOT_DIRECTOR.md §6e): on a model of yours, "What is this?": the parts its
## name suggests and every part by category in "Make it a…", one click making it that (on the editor's undo); on a
## thing, what it is now and "Change it to…". The panel's Build tab does the work (build_tab.gd assign).

const BuildTab := preload("res://addons/horrorstudio_director/editor/build_tab.gd")
const Glyphs := preload("res://addons/horrorstudio_director/editor/glyphs.gd")

var panel = null


func _can_handle(object) -> bool:
	if panel == null or panel.build == null or not (object is Node3D) or not is_instance_valid(object):
		return false
	return HSDirector.class_of(object) == "HSThing" or panel.build.is_model(object)


func _parse_begin(object) -> void:
	add_custom_control(box(object))


func box(obj: Node) -> Control:
	var s := Glyphs.scale()
	var build = panel.build
	var pc := PanelContainer.new()
	pc.name = "HorrorStudioBox"
	pc.add_theme_stylebox_override("panel", BuildTab._box(Color("#1F2D3C"), Color("#34506E"), 12, 1, 12))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", int(8 * s))
	pc.add_child(v)
	var head := HBoxContainer.new()
	var logo := TextureRect.new()
	logo.texture = Glyphs.tile("scare", "blue", true, 22)
	logo.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	head.add_child(logo)
	head.add_child(BuildTab._label("HorrorStudio", 13, Color("#C9DDF2"), true))
	v.add_child(head)
	var thing := HSDirector.class_of(obj) == "HSThing"
	var it: Dictionary = build.card_of(obj) if thing else {}
	v.add_child(BuildTab._wrap(BuildTab._label(("This is a %s" % str(it.get("title", obj.get("use"))).to_lower()) if thing else "What is this?", 15, Color("#E8EBF0"), true)))
	var mb := MenuButton.new()
	mb.name = "MakeIt"
	mb.text = "Change it to…" if thing else "Make it a…"
	mb.flat = false
	mb.custom_minimum_size = Vector2(0, 40) * s
	var pm := mb.get_popup()
	var map := {}
	var k := 0
	for c in build.cat.get("categories", []):
		var parts: Array = (build.items_by_cat.get(str(c["id"]), []) as Array).filter(func(x): return str(x.get("kind")) == "part")
		if parts.is_empty():
			continue
		var sub := PopupMenu.new()
		sub.name = "Cat_" + str(c["id"])
		for p in parts:
			sub.add_icon_item(Glyphs.icon(str(p.get("glyph", "cube")), "#9CCBFA", 16), str(p["title"]), k)
			map[k] = p
			k += 1
		sub.id_pressed.connect(func(i): build.assign(obj, map[i]))
		pm.add_submenu_node_item(str(c["title"]), sub)
	v.add_child(mb)
	if not thing:
		var sug: Array = build.suggestions(obj)
		if sug.size():
			v.add_child(BuildTab._wrap(BuildTab._label("It looks like one of these (from its name):", 12, Color("#A3ACB9"))))
			var row := HFlowContainer.new()
			row.add_theme_constant_override("h_separation", int(6 * s))
			row.add_theme_constant_override("v_separation", int(6 * s))
			for i in sug.size():
				var p: Dictionary = sug[i]
				var b := BuildTab._button(str(p["title"]), i == 0)
				b.name = "Suggest_" + str(p["id"])
				b.pressed.connect(func(): build.assign(obj, p))
				row.add_child(b)
			v.add_child(row)
		v.add_child(BuildTab._wrap(BuildTab._label("Or drag a card from the HorrorStudio panel onto it.", 12, Color("#A3ACB9"))))
	return pc
