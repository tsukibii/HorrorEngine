@tool
extends EditorDebuggerPlugin
## The running game's messages to the editor (HSGame sends horrorstudio:<what> while it runs from the editor): the
## step the player is at, the flags as they're set, the events; the dock shows them (Story's "now", Flags' set ones).

var dock = null


func _has_capture(prefix: String) -> bool:
	return prefix == "horrorstudio"


func _capture(message: String, data: Array, _session_id: int) -> bool:
	if dock == null:
		return false
	match message:
		"horrorstudio:start":
			dock.on_run_start(str(data[0]) if data.size() else "", data[1] if data.size() > 1 else [])
		"horrorstudio:step":
			dock.on_run_step(str(data[0]), data[1] if data.size() > 1 else [])
		"horrorstudio:flag":
			dock.on_run_flag(str(data[0]))
		"horrorstudio:event":
			dock.on_run_event(str(data[0]))
		_:
			return false
	return true


func _setup_session(session_id: int) -> void:
	var s := get_session(session_id)
	if s != null:
		s.stopped.connect(func(): if dock != null: dock.on_run_stop())
