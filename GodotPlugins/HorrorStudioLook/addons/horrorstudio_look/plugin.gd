@tool
extends EditorPlugin
## Enabling the plugin registers one node, HSLookEnvironment (look_env.gd): a WorldEnvironment wearing a look preset
## in the editor's viewport, which steps aside in a running game. Everything else is a script or a shader to load
## (README.md): the plugin needn't be enabled for those.


func _enter_tree() -> void:
	add_custom_type("HSLookEnvironment", "WorldEnvironment", preload("res://addons/horrorstudio_look/look_env.gd"), null)


func _exit_tree() -> void:
	remove_custom_type("HSLookEnvironment")
