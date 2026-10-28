## GDEXPORT (headless): the exported project's story reads, every level loads with its pieces, the main scene starts
## and the player stands at the start. Prints one line per level and "GDEXPORT ok".
extends SceneTree
const Story := preload("res://addons/horrorstudio/story.gd")

func _initialize() -> void:
	create_timer(120.0, true, false, true).timeout.connect(func() -> void: print("watchdog"); quit(1))
	var story = Story.load_file("res://game/story.json")
	if story.data.is_empty():
		printerr("GDEXPORT FAIL: no story")
		quit(1)
		return
	var ok := true
	for lid in story.levels:
		var ps: PackedScene = load("res://game/levels/%s.tscn" % lid)
		if ps == null:
			printerr("GDEXPORT FAIL: level %s doesn't load" % lid)
			ok = false
			continue
		var n: Node3D = ps.instantiate()
		var kinds: Dictionary = {}
		var bad := 0
		for ch in n.get_children():
			if ch.has_meta("piece"):
				var p = JSON.parse_string(ch.get_meta("piece"))
				if p == null:
					bad += 1
					continue
				kinds[p["kind"]] = int(kinds.get(p["kind"], 0)) + 1
		print("GDEXPORT level %s: %d nodes %s%s" % [lid, n.get_child_count(), JSON.stringify(kinds), "" if bad == 0 else " BAD META %d" % bad])
		if bad:
			ok = false
		n.free()
	var main: PackedScene = load("res://addons/horrorstudio/main.tscn")
	var g := main.instantiate()
	root.add_child(g)
	await process_frame
	await process_frame
	var cam: Camera3D = g.get_node("Player/Camera")
	print("GDEXPORT start: level %s, eye at %s, fov %.1f, %d things" % [g.level_id, cam.global_position, cam.fov, g.things.size()])
	if g.things.is_empty():
		ok = false
	print("GDEXPORT ok" if ok else "GDEXPORT FAIL")
	quit(0 if ok else 1)
