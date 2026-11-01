## A character's look (HSSkin, HSEye, HSHair; docs/GODOT_LOOK.md §0): a model's skin on HumanShaders' skin shader (its
## own colour and maps kept; wet, sweating, dripping or oiled by the numbers; on a Studio export the skin's detail at its
## true size, its look picked from the export or named here: §5d; and its depth, warm light from under the skin round the
## eyes, the nose, the mouth and the ears: §5g, Ear Glow off when the hair covers the ears), a Character Studio export's eyes on the
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
@export_enum("auto", "young", "natural", "adult", "old", "off") var skin_detail: String = "auto"   ## the pores, furrows and colour's unevenness at their true size (HSSkin.DETAIL_PRESETS; auto: from the export's own age and pores)
@export_range(0.0, 2.0) var detail_amount: float = 1.0                 ## the detail layer as a whole
@export_range(0.0, 3.0) var skin_depth: float = 1.0                    ## light from under the skin, warm round the eyes, the nose, the mouth and the ears (HSSkin.set_depth): times the character's own Depth; 0 off
@export_enum("auto", "on", "off") var ear_glow: String = "auto"        ## the ears' share of it: off when the hair covers the ears (auto: the character's own Ear glow, the Studio's Skin light)
@export_group("Skin depth's parts")
@export_range(0.0, 2.0) var depth_edge: float = 0.6                    ## warmer where the skin turns away from the eye (a cheek's side, the jaw, the neck)
@export_range(0.0, 1.0) var depth_creases: float = 0.3                 ## the creases everywhere else warm instead of grey (under the jaw, the neck's folds, between the fingers)
@export_range(0.0, 2.0) var depth_fingers: float = 0.7                 ## the fingers' thin skin lit through by the room, as an ear's
@export_range(0.0, 2.0) var depth_lips: float = 0.5                    ## the lips themselves
@export_group("")
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
		var st := {"wetness": wetness, "sweat": sweat, "drips": drips, "oil": oil, "detail": 0.0 if skin_detail == "off" else detail_amount,
				"depth": skin_depth, "depth_look": {"depth_edge": depth_edge, "depth_rest": depth_creases, "depth_hands": depth_fingers, "depth_lips": depth_lips}}
		if ear_glow != "auto":
			st["depth_ears"] = ear_glow == "on"
		if skin_detail != "auto" and skin_detail != "off":
			st["detail_preset"] = skin_detail
		materials.append_array(HSSkin.wear(t, st, path if path.ends_with(".glb") else ""))
	if eyes and path.ends_with(".glb"):
		materials.append_array(HSEye.wear(t, path).values())
	if hair:
		materials.append_array(HSHair.wear(t, {}, path if path.ends_with(".glb") else ""))


## the skin's wetness now (0..1 each)
func set_wet(s: Dictionary) -> void:
	for m in materials:
		if m is ShaderMaterial and m.shader == HSSkin.shader():
			HSSkin.set_wet(m, s)


func _get_configuration_warnings() -> PackedStringArray:
	return PackedStringArray() if character() != null else PackedStringArray(["Put this under the character, or set Target."])
