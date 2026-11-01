@tool
extends EditorPlugin
## The HorrorStudio Director in the editor (docs/GODOT_DIRECTOR.md): the dock (Story, Events, Flags, Things, Add,
## Check, Kimodo; its Guide button, and Project > Tools, open the guide: guides/director), the running game's
## messages (where the player is, the flags as they're set), the index of the project's ids kept as scenes are saved
## (the Inspector's suggestions across scenes). The nodes themselves are classes with icons (Add Child Node finds
## them whether or not the plugin is on).

const DockC := preload("res://addons/horrorstudio_director/editor/dock.gd")
const DebuggerC := preload("res://addons/horrorstudio_director/editor/debugger.gd")
const GUIDE_ITEM := "HorrorStudio Director guide"
const PARTS := "res://addons/horrorstudio_director/parts/"

var dock: Control = null
var debugger: EditorDebuggerPlugin = null


func _enter_tree() -> void:
	dock = DockC.new()
	dock.name = "HorrorStudio"
	dock.plugin = self
	add_control_to_dock(DOCK_SLOT_RIGHT_BL, dock)            # under the Inspector: a row picked here is edited there, both in view
	debugger = DebuggerC.new()
	debugger.dock = dock
	add_debugger_plugin(debugger)
	scene_saved.connect(_on_saved)
	scene_changed.connect(func(_r): dock.refresh())
	get_tree().node_added.connect(_on_node_added)
	add_tool_menu_item(GUIDE_ITEM, func(): dock.open_guide())     # Project > Tools, as the dock's Guide button


func _exit_tree() -> void:
	remove_tool_menu_item(GUIDE_ITEM)
	if get_tree().node_added.is_connected(_on_node_added):
		get_tree().node_added.disconnect(_on_node_added)
	if debugger != null:
		remove_debugger_plugin(debugger)
	if dock != null:
		remove_control_from_docks(dock)
		dock.queue_free()


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
	elif dock != null:
		dock.refresh()


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
	if dock != null:
		dock.refresh()
