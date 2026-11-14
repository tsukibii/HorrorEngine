@tool
extends EditorPlugin
## Enabling the plugin registers HSLookEnvironment (look_env.gd) as a custom type: a WorldEnvironment wearing a look
## preset in the editor's viewport, which steps aside in a running game. The effect nodes (nodes/, presets/:
## docs/GODOT_LOOK.md §0) are classes with icons, in Add Child Node whether or not the plugin is enabled.
## The balanced look's project settings (HSLook.PROJECT: TAA, the shadow atlas and filter, occlusion culling, the
## effects' buffers; a GTX 1060 the target) are applied the first time the plugin is enabled in a project (recorded
## in `horrorstudio/look/settings_applied`), and again from Project > Tools > HorrorStudio: apply the balanced project
## settings.
## Project > Tools > HorrorStudio: look viewer runs tools/look_viewer.tscn (GODOT_LOOK §5r).
## It also registers HSStreet.Import: a street baked in Blender (tools/street.py bake) wears its dirt, rain streaks and
## worn edges as it's imported (street_import.gd, street.gd, street.gdshader).
## And HSGrip's gizmo (grip_gizmo.gd): a prop's grip drawn and dragged in the 3D view.

const DONE := "horrorstudio/look/settings_applied"
const MENU := "HorrorStudio: apply the balanced project settings"
const VIEWER_MENU := "HorrorStudio: look viewer (a character's skins and eyes)"
const VIEWER := "res://addons/horrorstudio_look/tools/look_viewer.tscn"

## a street from the Blender bake wears its wear on import (street.gd)
var _street: EditorScenePostImportPlugin
## HSGrip in the 3D view: the handle, a hand round it, four handles to drag (grip_gizmo.gd; docs/ANIMATOR_V3.md §4.1)
var _grip: EditorNode3DGizmoPlugin


func _enter_tree() -> void:
	add_custom_type("HSLookEnvironment", "WorldEnvironment", preload("res://addons/horrorstudio_look/look_env.gd"), null)
	_street = preload("res://addons/horrorstudio_look/street_import.gd").new()
	add_scene_post_import_plugin(_street)
	_grip = preload("res://addons/horrorstudio_look/grip_gizmo.gd").new()
	_grip.undo = get_undo_redo()
	add_node_3d_gizmo_plugin(_grip)
	add_tool_menu_item(MENU, _apply)
	add_tool_menu_item(VIEWER_MENU, _viewer)
	# the made props' enhancers (HSPropFX), each kind switched for the whole project here
	for k: String in ["enabled", "glow", "flame", "smoke", "steam", "wax"]:
		var key: String = "horrorstudio/prop_fx/" + k
		if not ProjectSettings.has_setting(key):
			ProjectSettings.set_setting(key, true)
		ProjectSettings.set_initial_value(key, true)
		ProjectSettings.add_property_info({"name": key, "type": TYPE_BOOL})
	if not ProjectSettings.has_setting(DONE):
		ProjectSettings.set_setting(DONE, true)
		var n := HSLook.apply_project()
		print("HorrorStudio Look: the balanced project settings applied (%d changed; Project > Tools to apply them again)" % n)


func _exit_tree() -> void:
	remove_scene_post_import_plugin(_street)
	remove_node_3d_gizmo_plugin(_grip)
	remove_tool_menu_item(MENU)
	remove_tool_menu_item(VIEWER_MENU)
	remove_custom_type("HSLookEnvironment")


## the look viewer run as a scene of its own (tools/look_viewer.gd: every skin and eye look on a character, saved as looks)
func _viewer() -> void:
	EditorInterface.play_custom_scene(VIEWER)


func _apply() -> void:
	var n := HSLook.apply_project()
	print("HorrorStudio Look: the balanced project settings applied (%d changed)" % n)
