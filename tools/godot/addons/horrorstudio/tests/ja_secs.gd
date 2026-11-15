## GDEXPORT's parity: story.gd's ja_secs on lines handed in (a JSON file of strings), printed as JSON for
## tools/godot_export.py to hold against storylib.ja_secs. Ends "JASECS {...}".
extends SceneTree


func _initialize() -> void:
	var file := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--lines="):
			file = a.substr(8)
	var lines: Array = JSON.parse_string(FileAccess.get_file_as_string(file)) if file != "" else []
	var Story := load("res://addons/horrorstudio/story.gd")
	var out := []
	for t in lines:
		out.append(Story.ja_secs(str(t)))
	print("JASECS " + JSON.stringify(out))
	quit()
