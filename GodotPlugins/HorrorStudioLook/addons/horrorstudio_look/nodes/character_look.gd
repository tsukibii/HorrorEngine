## A character's look (HSSkin, HSEye, HSHair; docs/GODOT_LOOK.md §0): a model's skin on HumanShaders' skin shader (its
## own colour and maps kept; wet, sweating, dripping or oiled by the numbers), a Character Studio export's eyes on the
## Studio's refracting eye, and card hair, lashes and brows on the hair shader. Drop it under the character (an
## imported glb, or any model whose meshes are named skin/body/head, eye, hair/lash/brow). Put on when the game runs.
## The cast the game places itself already wear it (the story's `skin` word wets them).
@tool
@icon("res://addons/horrorstudio_look/icons/character.svg")
class_name HSCharacterLook
extends Node

@export var target: Node3D = null              ## the character; empty: the parent
@export var skin := true
@export_range(0.0, 1.0) var wetness: float = 0.0
@export_range(0.0, 1.0) var sweat: float = 0.0
@export_range(0.0, 1.0) var drips: float = 0.0
@export_range(0.0, 1.0) var oil: float = 0.0
@export var eyes := true
@export var hair := true
@export_file("*.glb") var glb_path: String = ""  ## the export's glb (its skin and eye records); empty: the character's own file
var materials: Array = []


func character() -> Node3D:
	return target if target != null else get_parent() as Node3D


func _ready() -> void:
	if not Engine.is_editor_hint():
		wear.call_deferred()


func wear() -> void:
	var t := character()
	if t == null:
		return
	var path := glb_path if glb_path != "" else t.scene_file_path
	materials.clear()
	if skin:
		materials.append_array(HSSkin.wear(t, {"wetness": wetness, "sweat": sweat, "drips": drips, "oil": oil}, path if path.ends_with(".glb") else ""))
	if eyes and path.ends_with(".glb"):
		materials.append_array(HSEye.wear(t, path).values())
	if hair:
		materials.append_array(HSHair.wear(t, {}))


## the skin's wetness now (0..1 each)
func set_wet(s: Dictionary) -> void:
	for m in materials:
		if m is ShaderMaterial and m.shader == HSSkin.shader():
			HSSkin.set_wet(m, s)


func _get_configuration_warnings() -> PackedStringArray:
	return PackedStringArray() if character() != null else PackedStringArray(["Put this under the character, or set Target."])
