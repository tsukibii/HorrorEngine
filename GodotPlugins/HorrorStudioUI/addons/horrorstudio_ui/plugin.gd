@tool
extends EditorPlugin
## Enabling the plugin adds the UI's project settings (Project Settings > horrorstudio/ui): the HUD's theme and the quest
## marker's default for an HSHud that sets itself up (`standalone`, the default: a game built by hand). HSHud and
## HSQuestMarker are classes with icons, in Add Child Node whether or not the plugin is enabled (like the Look plugin's
## nodes); a game made through the studio (the desk's export, the Director) gets the same HUD from the runtime add-on, which
## uses this plugin's scripts.

const SETTINGS := [
	{"name": "horrorstudio/ui/theme", "type": TYPE_STRING, "def": "glass", "hint": PROPERTY_HINT_ENUM, "hint_string": "glass,glass-rose,neumorph,plain"},
	{"name": "horrorstudio/ui/quest_marker", "type": TYPE_INT, "def": 1, "hint": PROPERTY_HINT_ENUM, "hint_string": "Off:0,Subtle:1,Clear:2"},
]


func _enter_tree() -> void:
	for s: Dictionary in SETTINGS:
		if not ProjectSettings.has_setting(s["name"]):
			ProjectSettings.set_setting(s["name"], s["def"])
		ProjectSettings.set_initial_value(s["name"], s["def"])
		ProjectSettings.add_property_info({"name": s["name"], "type": s["type"], "hint": s["hint"], "hint_string": s["hint_string"]})
