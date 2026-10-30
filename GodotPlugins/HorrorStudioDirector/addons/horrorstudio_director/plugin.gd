@tool
extends EditorPlugin
## The HorrorStudio Director in the editor (docs/GODOT_DIRECTOR.md): the dock (Story, Events, Flags, Things, Add,
## Check, Kimodo), the running game's messages (where the player is, the flags as they're set), the index of the
## project's ids kept as scenes are saved (the Inspector's suggestions across scenes). The nodes themselves are
## classes with icons (Add Child Node finds them whether or not the plugin is on).

const DockC := preload("res://addons/horrorstudio_director/editor/dock.gd")
const DebuggerC := preload("res://addons/horrorstudio_director/editor/debugger.gd")

var dock: Control = null
var debugger: EditorDebuggerPlugin = null


func _enter_tree() -> void:
	dock = DockC.new()
	dock.name = "HorrorStudio"
	dock.plugin = self
	add_control_to_dock(DOCK_SLOT_RIGHT_UL, dock)
	debugger = DebuggerC.new()
	debugger.dock = dock
	add_debugger_plugin(debugger)
	scene_saved.connect(_on_saved)
	scene_changed.connect(func(_r): dock.refresh())


func _exit_tree() -> void:
	if debugger != null:
		remove_debugger_plugin(debugger)
	if dock != null:
		remove_control_from_docks(dock)
		dock.queue_free()


## every saved scene's ids into res://.hsdirector/index.json (a level edited alone still suggests the story's ids)
func _on_saved(path: String) -> void:
	var root := EditorInterface.get_edited_scene_root()
	if root == null:
		return
	var idx := HSDirector.read_index()
	var scenes: Dictionary = idx.get("_scenes", {})
	var sc := HSDirector.scan(root)
	sc.erase("sound")
	scenes[path] = sc
	var merged := {"_scenes": scenes}
	for p in scenes:
		for k in scenes[p]:
			if not merged.has(k):
				merged[k] = []
			for v in scenes[p][k]:
				if not merged[k].has(v):
					merged[k].append(v)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.hsdirector"))
	var f := FileAccess.open(HSDirector.INDEX, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(merged, " "))
	if dock != null:
		dock.refresh()
