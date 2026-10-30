@tool
extends EditorPlugin
## Enabling the plugin registers HSLookEnvironment (look_env.gd) as a custom type: a WorldEnvironment wearing a look preset
## in the editor's viewport, which steps aside in a running game. Everything else is a script or a shader to load
## (README.md). The effect nodes (nodes/, presets/: docs/GODOT_LOOK.md §0) are classes with icons, in Add Child Node
## whether or not the plugin is enabled.


func _enter_tree() -> void:
	add_custom_type("HSLookEnvironment", "WorldEnvironment", preload("res://addons/horrorstudio_look/look_env.gd"), null)


func _exit_tree() -> void:
	remove_custom_type("HSLookEnvironment")
