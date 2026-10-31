@tool
extends Node3D
## A kit thing's slots dressed (the story's `mats`, STORY_FORMAT §2; the user, 2026-10-31: the paint bucket on the
## furniture): set on the thing's instanced kit mesh by the export, `slots` the game's material file for each slot's
## set (game/materials/<Name>_uv.tres: laid by the kit's own UVs, which are metres). Each surface whose material is
## kit_<slot> wears it; a slot's tones (kit_wood_2...) wear their base slot's unless they have their own. The mesh is
## this thing's own copy (the glb's stays as it is for the other things made from it), its surfaces keeping their
## kit_<slot> names so the little things' effects (lifefx.gd) still find them. Put back before a save and on again
## after (the look plugin's rule for a node that changes what isn't its own), so only `slots` is ever saved.

@export var slots: Dictionary = {}       ## slot -> Material (the game's file for its set)

var _kept: Array = []                    # [MeshInstance3D, the mesh it had]
var _tone := RegEx.create_from_string("_\\d+$")


func _ready() -> void:
	dress()


## dress the kit mesh's slots; returns how many surfaces wear a slot's material
func dress() -> int:
	if not _kept.is_empty():
		return dressed()
	var n := 0
	for mi in find_children("*", "MeshInstance3D", true, false):
		var mesh: Mesh = mi.mesh
		if mesh == null or not (mesh is ArrayMesh):
			continue
		var copy: ArrayMesh = null
		for i in mesh.get_surface_count():
			var m := mesh.surface_get_material(i)
			var nm: String = m.resource_name if m != null else ""
			if not nm.begins_with("kit_"):
				continue
			var slot := nm.substr(4)
			var mat = slots.get(slot, slots.get(_tone.sub(slot, "")))
			if not (mat is Material):
				continue
			if copy == null:
				copy = mesh.duplicate()
			copy.surface_set_material(i, mat)
			copy.surface_set_name(i, nm)
			n += 1
		if copy != null:
			_kept.append([mi, mesh])
			mi.mesh = copy
	return n


## how many surfaces are dressed now
func dressed() -> int:
	var n := 0
	for k in _kept:
		var mi: MeshInstance3D = k[0]
		if is_instance_valid(mi) and mi.mesh != null:
			for i in mi.mesh.get_surface_count():
				if slots.values().has(mi.mesh.surface_get_material(i)):
					n += 1
	return n


func undress() -> void:
	for k in _kept:
		if is_instance_valid(k[0]):
			k[0].mesh = k[1]
	_kept.clear()


func _notification(what: int) -> void:
	if not Engine.is_editor_hint():
		return
	if what == NOTIFICATION_EDITOR_PRE_SAVE:
		undress()
	elif what == NOTIFICATION_EDITOR_POST_SAVE:
		dress.call_deferred()
