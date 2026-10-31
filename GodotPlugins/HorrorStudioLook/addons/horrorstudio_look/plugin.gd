@tool
extends EditorPlugin
## Enabling the plugin registers HSLookEnvironment (look_env.gd) as a custom type: a WorldEnvironment wearing a look
## preset in the editor's viewport, which steps aside in a running game. The effect nodes (nodes/, presets/:
## docs/GODOT_LOOK.md §0) are classes with icons, in Add Child Node whether or not the plugin is enabled.
## The balanced look's project settings (HSLook.PROJECT: TAA, the shadow atlas and filter, occlusion culling, the
## effects' buffers; a GTX 1060 the target) are applied the first time the plugin is enabled in a project (recorded
## in `horrorstudio/look/settings_applied`), and again from Project > Tools > HorrorStudio: apply the balanced project
## settings.
## It also registers HSStreet.Import: a street baked in Blender (tools/street.py bake) wears its dirt, rain streaks and
## worn edges as it's imported (street_import.gd, street.gd, street.gdshader).

const DONE := "horrorstudio/look/settings_applied"
const MENU := "HorrorStudio: apply the balanced project settings"

## a street from the Blender bake wears its wear on import (street.gd)
var _street: EditorScenePostImportPlugin


func _enter_tree() -> void:
	add_custom_type("HSLookEnvironment", "WorldEnvironment", preload("res://addons/horrorstudio_look/look_env.gd"), null)
	_street = preload("res://addons/horrorstudio_look/street_import.gd").new()
	add_scene_post_import_plugin(_street)
	add_tool_menu_item(MENU, _apply)
	if not ProjectSettings.has_setting(DONE):
		ProjectSettings.set_setting(DONE, true)
		var n := HSLook.apply_project()
		print("HorrorStudio Look: the balanced project settings applied (%d changed; Project > Tools to apply them again)" % n)


func _exit_tree() -> void:
	remove_scene_post_import_plugin(_street)
	remove_tool_menu_item(MENU)
	remove_custom_type("HSLookEnvironment")


func _apply() -> void:
	var n := HSLook.apply_project()
	print("HorrorStudio Look: the balanced project settings applied (%d changed)" % n)
