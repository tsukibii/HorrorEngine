@tool
extends VBoxContainer
## (filled in by the dock's step: docs/GODOT_DIRECTOR.md §6)

var plugin = null


func refresh() -> void:
	pass


func on_run_start(_start: String, _problems: Array) -> void:
	pass


func on_run_step(_nid: String, _flags: Array) -> void:
	pass


func on_run_flag(_f: String) -> void:
	pass


func on_run_event(_ev: String) -> void:
	pass


func on_run_stop() -> void:
	pass
