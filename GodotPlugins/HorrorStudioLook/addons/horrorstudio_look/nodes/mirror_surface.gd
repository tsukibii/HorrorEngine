## A real mirror (HSMirror; docs/GODOT_LOOK.md §0): the room reflected in a mesh's glass while the game runs (the
## camera mirrored through the glass's plane into a picture of its own each frame it's in view). Drop it under the
## mirror's mesh: a quad, or a thin box (its side toward the eye). `surface` the glass's surface (-1: the one named
## kit_mirror, else the first). The editor's viewport shows the plain glass; the reflection is the game's. `steam`
## fogs it from its bottom edge and `writing` is a finger's words on the glass, clear lines once it steams (both live:
## a script can raise the steam while you watch, docs/GODOT_LOOK.md §5m).
@tool
@icon("res://addons/horrorstudio_look/icons/mirror.svg")
class_name HSMirrorSurface
extends Node

@export var target: MeshInstance3D = null      ## the glass's mesh; empty: the parent
@export var surface: int = -1
@export_enum("160:160", "288:288", "512:512") var resolution: int = 288
@export_range(0.0, 1.0) var steam: float = 0.0:     ## fogged over from the bottom edge (1 all of it)
	set(v):
		steam = v
		if mirror != null:
			mirror.set_steam(v)
@export var writing := "":                          ## words a finger left on the glass: they show as it steams
	set(v):
		writing = v
		if mirror != null:
			mirror.write(v)
var mirror: HSMirror = null


func mesh() -> MeshInstance3D:
	if target != null:
		return target
	return get_parent() as MeshInstance3D


func _ready() -> void:
	if Engine.is_editor_hint():
		set_process(false)
		return
	add_to_group("hs_mirrors")


func _process(_dt: float) -> void:
	if mirror != null:
		set_process(false)
		return
	var cam := get_viewport().get_camera_3d()
	var mi := mesh()
	if cam == null or mi == null:
		return
	var s := surface if surface >= 0 else max(HSMirror.mirror_surface(mi), 0)
	mi.material_override = null                       # the reflection goes on the surface; an override would hide it (the game's run, never saved)
	mirror = HSMirror.attach(mi, s, cam, resolution)    # (its _ready runs here: the glass made, then the steam and writing on it)
	mirror.set_steam(steam)
	if writing != "":
		mirror.write(writing)


func set_quality(q: int) -> void:
	if mirror != null:
		mirror.set_quality(q)


func _get_configuration_warnings() -> PackedStringArray:
	return PackedStringArray() if mesh() != null else PackedStringArray(["Put this under the mirror's MeshInstance3D, or set Target."])
