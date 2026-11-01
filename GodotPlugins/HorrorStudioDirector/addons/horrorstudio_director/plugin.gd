@tool
extends EditorPlugin
## The HorrorStudio Director in the editor (docs/GODOT_DIRECTOR.md): the HorrorStudio panel along the bottom (Build,
## Story, Test: editor/panel.gd) and the Inspector's box on a model (What is this?: editor/inspector.gd), the dock
## (Director, Things, Check, Kimodo; its Guide button, and Project > Tools, open the guide: guides/director), the running game's
## messages (where the player is, the flags as they're set), the index of the project's ids kept as scenes are saved
## (the Inspector's suggestions across scenes). The nodes themselves are classes with icons (Add Child Node finds
## them whether or not the plugin is on).

const DockC := preload("res://addons/horrorstudio_director/editor/dock.gd")
const PanelC := preload("res://addons/horrorstudio_director/editor/panel.gd")
const InspectorC := preload("res://addons/horrorstudio_director/editor/inspector.gd")
const DebuggerC := preload("res://addons/horrorstudio_director/editor/debugger.gd")
const GUIDE_ITEM := "HorrorStudio Director guide"
const PARTS := "res://addons/horrorstudio_director/parts/"

var dock: Control = null
var panel = null                     # the HorrorStudio panel (an EditorDock, the bottom slot)
var inspector: EditorInspectorPlugin = null
var debugger: EditorDebuggerPlugin = null
var pending_scare = null             # a scare card being dragged: {item, at}; its area's moment made when it lands
var _tri := {}                       # a mesh's triangles, for the mouse's ray (model_on_ray)


func _enter_tree() -> void:
	dock = DockC.new()
	dock.name = "HorrorStudio"
	dock.plugin = self
	add_control_to_dock(DOCK_SLOT_RIGHT_BL, dock)            # under the Inspector: a row picked here is edited there, both in view
	panel = PanelC.new()
	panel.name = "HorrorStudioPanel"
	panel.plugin = self
	panel.dock = dock
	add_dock(panel)                                          # the bottom, wide (it can float on a second screen)
	inspector = InspectorC.new()
	inspector.panel = panel
	add_inspector_plugin(inspector)
	EditorInterface.get_selection().selection_changed.connect(_on_selection)
	debugger = DebuggerC.new()
	debugger.dock = dock
	add_debugger_plugin(debugger)
	scene_saved.connect(_on_saved)
	scene_changed.connect(func(_r): dock.refresh(); _on_selection())
	get_tree().node_added.connect(_on_node_added)
	add_tool_menu_item(GUIDE_ITEM, func(): dock.open_guide())     # Project > Tools, as the dock's Guide button


func _exit_tree() -> void:
	remove_tool_menu_item(GUIDE_ITEM)
	if EditorInterface.get_selection().selection_changed.is_connected(_on_selection):
		EditorInterface.get_selection().selection_changed.disconnect(_on_selection)
	if inspector != null:
		remove_inspector_plugin(inspector)
	if panel != null:
		remove_dock(panel)
		panel.queue_free()
	if get_tree().node_added.is_connected(_on_node_added):
		get_tree().node_added.disconnect(_on_node_added)
	if debugger != null:
		remove_debugger_plugin(debugger)
	if dock != null:
		remove_control_from_docks(dock)
		dock.queue_free()


func _on_selection() -> void:
	if panel != null:
		panel.on_selection.call_deferred()


## every saved scene's ids into res://.hsdirector/index.json (a level edited alone still suggests the story's ids)
func _on_saved(path: String) -> void:
	var root := EditorInterface.get_edited_scene_root()
	if root == null:
		return
	HSDirector.write_index(path, root)
	if dock != null:
		dock.refresh()


## a preset dragged from the dock into the 3D view lands as an instance of its file: made the scene's own node (its
## curve its own), as if it had been added with Add Child Node
func _on_node_added(n: Node) -> void:
	if n.scene_file_path.begins_with("res://addons/horrorstudio_director/presets/"):
		_unlink.call_deferred(n)
	elif n.scene_file_path.begins_with(PARTS):
		_dropped_part.call_deferred(n)


## a part dropped onto an object in the Scene tree (it lands as the object's child): the part takes the object's place
## and the object goes inside it (DECISIONS 2026-11-01: "select an object, place a kettle script"); dropped anywhere
## else it stays a thing of its own with a stand-in
func _dropped_part(n: Node) -> void:
	if not is_instance_valid(n) or not n.is_inside_tree():
		return
	var r := EditorInterface.get_edited_scene_root()
	if r == null or n == r or not r.is_ancestor_of(n):
		return
	n.scene_file_path = ""
	var obj := n.get_parent()
	if obj is Node3D and obj != r and not HSDirector.class_of(obj).begins_with("HS"):
		wrap_object(n, obj)
		return
	var hit = model_under_mouse(n)                     # dropped in the 3D view on a model: that model (the drop lands where the
	if hit != null and HSDirector.class_of(hit) == "HSThing":   # editor's physics ray does, past a model with no collider)
		_retype(hit, n)
	elif hit != null:
		wrap_object(n, hit)
	elif dock != null:
		dock.refresh()


## the model of the user's under the mouse in the 3D view, if the mouse is over it: the nearest the mouse's ray meets
func model_under_mouse(exclude: Node = null) -> Node3D:
	var vp := EditorInterface.get_editor_viewport_3d(0)
	var cam: Camera3D = vp.get_camera_3d() if vp != null else null
	if cam == null:
		return null
	var mp := vp.get_mouse_position()
	if not Rect2(Vector2.ZERO, vp.get_visible_rect().size).has_point(mp):
		return null
	return model_on_ray(cam.project_ray_origin(mp), cam.project_ray_normal(mp), exclude)


## the nearest model of the user's a ray meets (its triangles), as the editor selects it (an imported scene whole); a
## model inside a thing is the thing. Not what the level's own nodes make, a character's body or a door's leaf
func model_on_ray(from: Vector3, dir: Vector3, exclude: Node = null) -> Node3D:
	var r := EditorInterface.get_edited_scene_root()
	if r == null:
		return null
	var best: Node = null
	var best_t := INF
	for mi in r.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or not mi.is_visible_in_tree() or (exclude != null and (exclude == mi or exclude.is_ancestor_of(mi))) or not _target(mi, r):
			continue
		var inv: Transform3D = mi.global_transform.affine_inverse()
		var lf: Vector3 = inv * from
		var ld: Vector3 = inv.basis * dir
		if mi.get_aabb().grow(0.01).intersects_ray(lf, ld) == null:
			continue
		var key: int = mi.mesh.get_instance_id()
		if not _tri.has(key):
			_tri[key] = mi.mesh.generate_triangle_mesh()
		var tm: TriangleMesh = _tri[key]
		var hit: Dictionary = tm.intersect_ray(lf, ld) if tm != null else {}
		if hit.is_empty():
			continue
		var t: float = from.distance_to(mi.global_transform * (hit["position"] as Vector3))
		if t < best_t:
			best_t = t
			best = mi
	if best == null:
		return null
	var n: Node = best
	while n != r and n.owner != r and n.get_parent() != null:   # inside an imported scene: the scene's own node
		n = n.get_parent()
	var x: Node = n
	while x != null and x != r:
		if HSDirector.class_of(x) == "HSThing":
			return x
		x = x.get_parent()
	return n if n is Node3D and n != r else null


func _target(mi: Node, r: Node) -> bool:
	var x: Node = mi
	while x != null and x != r:
		if str(x.name).begins_with("_") or HSDirector.class_of(x) in ["HSActor", "HSDoor"]:
			return false
		x = x.get_parent()
	return true


## a part dropped on a thing: the thing becomes that (its use and life), the dropped one goes; on the undo
func _retype(thing: Node, part: Node) -> void:
	var ur := get_undo_redo()
	var host := part.get_parent()
	ur.create_action("HorrorStudio: %s is a %s" % [thing.name, part.name], UndoRedo.MERGE_DISABLE, EditorInterface.get_edited_scene_root())
	for k in ["use", "life", "flashlight"]:
		ur.add_do_property(thing, k, part.get(k))
		ur.add_undo_property(thing, k, thing.get(k))
	ur.add_do_method(host, "remove_child", part)
	ur.add_undo_method(host, "add_child", part)
	ur.add_undo_reference(part)
	ur.commit_action()
	EditorInterface.edit_node(thing)


## an object made a thing: the part (an HSThing, in the tree as the object's child or not yet in it) put in the
## object's place, the object inside it keeping where it is; on the editor's undo
func wrap_object(part: Node3D, obj: Node3D) -> void:
	var host := obj.get_parent()
	var ur := get_undo_redo()
	ur.create_action("HorrorStudio: make %s a %s" % [obj.name, part.name], UndoRedo.MERGE_DISABLE, EditorInterface.get_edited_scene_root())   # the scene's own history: its Ctrl+Z
	ur.add_do_method(self, "_wrap", part, obj, host, obj.get_index())
	ur.add_undo_method(self, "_unwrap", part, obj, host, obj.get_index(), part.get_parent())
	ur.add_do_reference(part)
	ur.commit_action()


func _wrap(part: Node3D, obj: Node3D, host: Node, idx: int) -> void:
	var xf := obj.global_transform
	if part.get_parent() == null:
		host.add_child(part)
		part.owner = EditorInterface.get_edited_scene_root()
	else:
		part.reparent(host, false)
	host.move_child(part, idx)
	part.global_transform = Transform3D(xf.basis.orthonormalized(), xf.origin)
	obj.reparent(part, true)
	part.name = obj.name
	EditorInterface.edit_node(part)
	if dock != null:
		dock.refresh()


## a thing made plain again: its model back in its place, the thing gone (wrap_object the other way); on the undo
func unwrap_thing(thing: Node3D) -> void:
	var obj := HSDirector.thing_model(thing)
	if obj == null:
		return
	var host := thing.get_parent()
	var ur := get_undo_redo()
	ur.create_action("HorrorStudio: %s plain again" % obj.name, UndoRedo.MERGE_DISABLE, EditorInterface.get_edited_scene_root())
	ur.add_do_method(self, "_plain", thing, obj, host, thing.get_index())
	ur.add_undo_method(self, "_unplain", thing, obj, host, thing.get_index())
	ur.add_undo_reference(thing)
	ur.commit_action()


func _plain(thing: Node3D, obj: Node3D, host: Node, idx: int) -> void:
	var nm := str(thing.name)
	thing.name = "_was_" + nm                           # out of the way of the model's own name, which it had taken
	obj.reparent(host, true)
	host.move_child(obj, idx)
	host.remove_child(thing)
	thing.name = nm
	EditorInterface.edit_node(obj)
	if dock != null:
		dock.refresh()


func _unplain(thing: Node3D, obj: Node3D, host: Node, idx: int) -> void:
	var nm := str(obj.name)
	thing.name = "_was_" + nm
	host.add_child(thing)
	host.move_child(thing, idx)
	var r := EditorInterface.get_edited_scene_root()
	thing.owner = r
	for c in thing.get_children():
		if c is Marker3D:
			c.owner = r                                 # its effect points, the user's
	obj.reparent(thing, true)
	thing.name = nm
	EditorInterface.edit_node(thing)
	if dock != null:
		dock.refresh()


func _unwrap(part: Node3D, obj: Node3D, host: Node, idx: int, was: Node) -> void:
	obj.reparent(host, true)
	host.move_child(obj, idx)
	if was == obj:                                     # back on the object as it was dropped there
		part.reparent(obj, false)
		part.transform = Transform3D()
	elif part.get_parent() != null:
		part.get_parent().remove_child(part)
	if dock != null:
		dock.refresh()


func _unlink(n: Node) -> void:
	if not is_instance_valid(n) or not n.is_inside_tree():
		return
	var r := EditorInterface.get_edited_scene_root()
	if r == null or n == r or not r.is_ancestor_of(n):
		return
	n.scene_file_path = ""
	if n is Path3D and n.curve != null:
		n.curve = n.curve.duplicate()
	if pending_scare is Dictionary and HSDirector.class_of(n) == "HSTrigger" and Time.get_ticks_msec() - int(pending_scare["at"]) < 30000 and panel != null:
		if pending_scare.get("from") == "story":
			panel.story.landed(n, pending_scare)        # the Story tab's: on the area or door it fell on, or its own area
		else:
			panel.build.scare_landed(n, pending_scare["item"])   # a scare card dropped into the view: its area, now its moment
	pending_scare = null
	if dock != null:
		dock.refresh()
