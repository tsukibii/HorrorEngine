## PARSE's player (tools/godot/parse_check.py): every runtime script of the by-hand plugins and the starter kit loaded
## and every preset and prefab instanced, so Godot prints any parse error or broken reference now, not when a long
## suite happens to load that file. Editor scripts (in an editor/ folder, a plugin.gd, `extends Editor...`) are the
## editor checks' (MARKERSEDITOR, LOGICEDITOR). Prints `PARSEALL <n> scripts, <m> scenes; failed [...]` and quits.
extends SceneTree


func _walk(dir: String, ext: String, out: Array) -> void:
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(ext):
			out.append(dir.path_join(f))
	for d in DirAccess.get_directories_at(dir):
		if d.begins_with(".") or d == "demo" or d == "tests":
			continue
		_walk(dir.path_join(d), ext, out)


func _initialize() -> void:
	var scripts: Array = []
	for top in ["res://addons", "res://starter", "res://kimodo"]:
		if DirAccess.dir_exists_absolute(top):
			_walk(top, ".gd", scripts)
	var failed: Array = []
	var n := 0
	for f in scripts:
		var src := FileAccess.get_file_as_string(f)
		if f.contains("/editor/") or f.ends_with("/plugin.gd") or src.contains("extends Editor"):
			continue
		n += 1
		if load(f) == null:
			failed.append(f)
	var scenes: Array = []
	for top in ["res://addons", "res://starter"]:
		if DirAccess.dir_exists_absolute(top):
			_walk(top, ".tscn", scenes)
	var m := 0
	for f in scenes:
		var ps = load(f)
		if not ps is PackedScene:
			failed.append(f)
			continue
		var inst := (ps as PackedScene).instantiate()
		if inst == null:
			failed.append(f)
			continue
		m += 1
		inst.free()
	print("PARSEALL %d scripts, %d scenes; failed %s" % [n, m, JSON.stringify(failed)])
	quit()
