## A wet surface (HSWet; docs/GODOT_LOOK.md §0): the mesh's material made wet, keeping its colour and texture: darker,
## a sheen, pools in world-space noise that mirror the room (SSR, the look preset), rain's rings in them with
## `ripples`. Drop it under a floor's mesh (or a piece holding meshes). Your material comes back when it's removed.
@tool
@icon("res://addons/horrorstudio_look/icons/wet.svg")
class_name HSWetSurface
extends HSOnMesh

@export_range(0.0, 1.0) var wetness: float = 0.8
@export_range(0.0, 1.0) var puddles: float = 0.5
@export_range(0.1, 5.0) var puddle_scale: float = 0.9
@export_range(0.0, 1.0) var ripples: float = 0.0
@export_range(0.1, 4.0) var ripple_rate: float = 1.0
@export var water_tint := Color(0.04, 0.05, 0.06)
@export_range(0.0, 0.5) var edge: float = 0.12


func _settings() -> Dictionary:
	return {"wetness": wetness, "puddles": puddles, "puddle_scale": puddle_scale, "ripples": ripples, "ripple_rate": ripple_rate, "water_tint": water_tint, "edge": edge}


func _apply(ms: Array) -> void:
	for mi in ms:
		HSWet.wet(mi, _settings())
