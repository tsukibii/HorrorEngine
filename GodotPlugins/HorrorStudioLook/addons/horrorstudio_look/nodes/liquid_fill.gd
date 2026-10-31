## Liquid that stays level and sloshes (HSLiquidFill; liquid.gd, docs/PROPGEN.md §10): drop it under a bottle's
## liquid mesh (a made prop's `<name>_liquid`) and it wears the liquid shader, in the editor too. `fill` (-1: the
## prop's own) and the colours change it; moving or turning the bottle sets the surface swinging, a spring that dies
## away (`slosh` how far it swings, `settle` how fast it calms, `swing` how quick it rocks).
@tool
@icon("res://addons/horrorstudio_look/icons/liquid.svg")
class_name HSLiquidFill
extends Node

@export var target: MeshInstance3D = null          ## the liquid's mesh; empty: the parent
@export_range(-1.0, 1.0) var fill: float = -1.0:
	set(v):
		fill = v
		_dirty = true
@export var own_colors := true                    ## the prop's own colours; off: the three below
@export var liquid_color := Color(0.11, 0.03, 0.012):
	set(v):
		liquid_color = v
		_dirty = true
@export var surface_color := Color(0.2, 0.07, 0.03):
	set(v):
		surface_color = v
		_dirty = true
@export var foam_color := Color(0.35, 0.16, 0.07):
	set(v):
		foam_color = v
		_dirty = true
@export var slosh := 0.35
@export var settle := 1.6
@export var swing := 1.4

var mat: ShaderMaterial = null
var _dirty := true
var _last_pos := Vector3.ZERO
var _last_basis := Basis.IDENTITY
var _amount := Vector2.ZERO
var _t := 0.0
var _started := false


func mesh() -> MeshInstance3D:
	return target if target != null else get_parent() as MeshInstance3D


func _ready() -> void:
	_apply()


func _apply() -> void:
	var mi := mesh()
	if mi == null:
		return
	if mat == null:
		mat = load("res://addons/horrorstudio_look/liquid.gd").attach(mi)
	if mat == null:
		return
	if fill >= 0.0:
		mat.set_shader_parameter("fill", fill)
	if not own_colors:
		mat.set_shader_parameter("liquid_color", liquid_color)
		mat.set_shader_parameter("surface_color", surface_color)
		mat.set_shader_parameter("foam_color", foam_color)
	_dirty = false


func _process(dt: float) -> void:
	if _dirty or mat == null:
		_apply()
	var mi := mesh()
	if mi == null or mat == null or dt <= 0.0:
		return
	var gt := mi.global_transform
	if not _started:
		_last_pos = gt.origin
		_last_basis = gt.basis
		_started = true
	var vel := (gt.origin - _last_pos) / dt
	var spin := (gt.basis * _last_basis.inverse()).get_euler() / dt
	_amount = _amount.lerp(Vector2.ZERO, clampf(dt * settle, 0.0, 1.0))
	_amount.x += clampf((vel.x + spin.z * 0.2) * slosh, -slosh, slosh)
	_amount.y += clampf((vel.z + spin.x * 0.2) * slosh, -slosh, slosh)
	_amount = _amount.limit_length(0.8)
	_t += dt
	var w := _amount * sin(TAU * swing * _t)
	mi.set_instance_shader_parameter("wobble", w)
	_last_pos = gt.origin
	_last_basis = gt.basis


func _get_configuration_warnings() -> PackedStringArray:
	var mi := mesh()
	if mi == null:
		return PackedStringArray(["Put this under the liquid's MeshInstance3D (a made prop's <name>_liquid), or set Target."])
	return PackedStringArray()
