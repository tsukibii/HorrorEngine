@tool
extends EditorPlugin
## The guide of sequences' pictures of the editor (guides/sequences/img/board_*.jpg): the built scene opened, the NPC
## Markers tab on each recipe's character and quest, one of its markers picked (its form on the right), the 3D view
## on the part of the place it happens in, pictured. Installed as a plugin of its own by tools/godot/sequences.py
## --editor, under xvfb; nothing is changed or saved. Ends "SEQEDITOR {errors, did}".

var errors: Array = []
var did: Array = []
var out := ""
var views: Array = []
var dock: Control
var plug: EditorPlugin
var vp: SubViewport
var cam: Camera3D
var surface: Control
var root: Node


func ok(c: bool, what: String, how := "") -> void:
	if c:
		did.append(what + ((": " + how) if how != "" else ""))
	else:
		errors.append(what + ((": " + how) if how != "" else ""))


func frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func secs(t: float) -> void:
	await get_tree().create_timer(t).timeout


func _find_script(n: Node, tail: String):
	for c in n.get_children():
		if c.get_script() != null and str(c.get_script().resource_path).ends_with(tail):
			return c
		var f = _find_script(c, tail)
		if f != null:
			return f
	return null


func _done() -> void:
	print("SEQEDITOR " + JSON.stringify({"errors": errors, "did": did}))
	get_tree().quit()


func _enter_tree() -> void:
	_run.call_deferred()


func wheel(n: int) -> void:
	for i in absi(n):
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_WHEEL_DOWN if n > 0 else MOUSE_BUTTON_WHEEL_UP
		e.pressed = true
		e.factor = 1.0
		e.position = surface.size * 0.5
		surface.gui_input.emit(e)
		await frames(2)


func orbit(by: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.button_mask = MOUSE_BUTTON_MASK_MIDDLE
	e.relative = by
	e.position = surface.size * 0.5
	surface.gui_input.emit(e)
	await frames(2)


func shot(name: String) -> void:
	await frames(8)
	var img := EditorInterface.get_base_control().get_viewport().get_texture().get_image()
	img.save_png(out.path_join(name + ".png"))
	did.append("pictured " + name)


# the 3D view on a box of the place: a helper nobody sees selected, and F (focus the selection)
func focus(at: Vector3, size: Vector3) -> void:
	var h := MeshInstance3D.new()
	h.name = "_Focus"
	var bm := BoxMesh.new()
	bm.size = size
	h.mesh = bm
	h.transparency = 1.0
	root.add_child(h)
	h.global_position = at
	EditorInterface.get_selection().clear()
	EditorInterface.get_selection().add_node(h)
	await frames(4)
	var e := InputEventKey.new()
	e.keycode = KEY_F
	e.physical_keycode = KEY_F
	e.pressed = true
	surface.gui_input.emit(e)
	await secs(0.9)
	EditorInterface.get_selection().clear()
	h.queue_free()
	await frames(3)


func _run() -> void:
	get_tree().create_timer(900.0).timeout.connect(func() -> void:
		errors.append("the editor's pictures never ended")
		_done())
	var cfg = JSON.parse_string(FileAccess.get_file_as_string("res://sequences_editor.json"))
	out = str(cfg.get("out", "")) if cfg is Dictionary else ""
	views = cfg.get("views", []) if cfg is Dictionary else []
	await secs(3.0)
	for i in 600:
		if not EditorInterface.get_resource_filesystem().is_scanning():
			break
		await frames(5)
	await secs(1.5)
	EditorInterface.open_scene_from_path("res://main.tscn")
	for i in 600:
		await frames(1)
		root = EditorInterface.get_edited_scene_root()
		if root != null and root.name == "Main":
			break
	ok(root != null and root.name == "Main", "the scene opened in the editor")
	if root == null or out == "":
		_done()
		return
	EditorInterface.set_main_screen_editor("3D")
	await frames(10)
	dock = _find_script(EditorInterface.get_base_control(), "horrorstudio_markers/editor/dock.gd")
	ok(dock != null, "the NPC Markers tab is in the editor")
	if dock == null:
		_done()
		return
	plug = dock.plugin
	dock.make_visible()
	await frames(5)
	vp = EditorInterface.get_editor_viewport_3d(0)
	cam = vp.get_camera_3d()
	for c in vp.get_parent().get_parent().get_children():
		if c.get_class() == "Control":
			surface = c
	ok(cam != null and surface != null, "the 3D view and its camera")
	if surface == null:
		_done()
		return
	for n in ["World/Ceiling", "World/CorridorCeiling"]:           # (lifted off for the pictures: nothing is saved)
		var c := root.get_node_or_null(n) as Node3D
		if c != null:
			c.visible = false
	plug.all_quests = false
	plug.hidden.clear()
	var turned := false
	for v in views:
		var npc := root.get_node_or_null(str(v["npc"])) as HSNpc
		var quest := npc.get_node_or_null(str(v["quest"])) as HSNpcQuest if npc != null else null
		ok(npc != null and quest != null, "%s: its character and quest are in the scene" % str(v["id"]), "%s / %s" % [v["npc"], v["quest"]])
		if quest == null:
			continue
		await focus(Vector3(v["at"][0], v["at"][1], v["at"][2]), Vector3(v["size"][0], v["size"][1], v["size"][2]))
		if not turned:                                             # (once: the view from the south, looking down into the rooms)
			await orbit(Vector2(float(cfg.get("orbit", [0, 0])[0]), float(cfg.get("orbit", [0, 0])[1])))
			turned = true
			await focus(Vector3(v["at"][0], v["at"][1], v["at"][2]), Vector3(v["size"][0], v["size"][1], v["size"][2]))
		plug.solo = npc
		plug.pick_node(quest, false)
		await frames(4)
		var m: Node = quest.get_node_or_null(str(v.get("pick", ""))) if str(v.get("pick", "")) != "" else null
		if m != null:
			plug.pick_node(m)
		dock.refresh()
		plug.update_overlays()
		await frames(8)
		await shot("board_" + str(v["id"]))
	plug.solo = null
	_done()
