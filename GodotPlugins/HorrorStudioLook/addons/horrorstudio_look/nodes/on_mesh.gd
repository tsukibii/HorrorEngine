## The base of the effects that go on a mesh you already have (a wet floor, a window pane, a leak down a wall): drop
## the node under the mesh (or under the node holding the meshes, or point `target` at one). It changes the meshes'
## materials while it's there, in the editor and the game, and puts them back before the scene is saved and when the
## node is removed, so your scene keeps its own materials.
@tool
class_name HSOnMesh
extends Node3D

@export var target: Node = null       ## the mesh, or the node whose meshes it goes on; empty: the parent
var applied: Array = []                ## the meshes it's on now
var _was: Dictionary = {}              ## each mesh's own material_override and shadow casting, put back by _undo
var _key := 0


func _ready() -> void:
	apply_now()


## the meshes it goes on: the target (or the parent) if it's a mesh, else every mesh under it but its own
func meshes() -> Array:
	var t: Node = target if target != null else get_parent()
	var out: Array = []
	if t is MeshInstance3D:
		out.append(t)
	elif t != null:
		for mi in t.find_children("*", "MeshInstance3D", true, false):
			if mi != self and not is_ancestor_of(mi):
				out.append(mi)
	return out


func _key_now() -> int:
	return [_settings(), target.get_instance_id() if target != null else 0, _extra_key()].hash()


func apply_now() -> void:
	undo()
	_key = _key_now()
	applied = meshes()
	for mi in applied:
		_was[mi.get_instance_id()] = [mi.material_override, mi.cast_shadow]
	_apply(applied)


func undo() -> void:
	_unapply()
	for mi in applied:
		if is_instance_valid(mi) and _was.has(mi.get_instance_id()):
			var w: Array = _was[mi.get_instance_id()]
			mi.material_override = w[0]
			mi.cast_shadow = w[1]
			if mi.has_meta(HSWet.META):
				mi.remove_meta(HSWet.META)
	applied = []
	_was.clear()


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_EDITOR_PRE_SAVE:
			undo()                                     # the scene is saved with its own materials
		NOTIFICATION_EDITOR_POST_SAVE:
			apply_now.call_deferred()                  # (no children added or freed inside a notification sent down the tree)
		NOTIFICATION_EXIT_TREE:
			undo()
		NOTIFICATION_ENTER_TREE:
			if is_node_ready():
				apply_now.call_deferred()


func _process(_dt: float) -> void:
	if _key_now() != _key:
		apply_now()


func _get_configuration_warnings() -> PackedStringArray:
	return PackedStringArray() if not meshes().is_empty() else PackedStringArray(["No mesh to go on: put this under a MeshInstance3D (or a node holding some), or set Target."])


# what a kind sets (overridden)
func _settings() -> Dictionary:
	return {}


func _extra_key():
	return 0


func _apply(_ms: Array) -> void:
	pass


func _unapply() -> void:
	pass
