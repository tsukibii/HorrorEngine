## A picture of a scene as the bake plays it (xvfb, lavapipe): the Watch started at a node, the scene's frame at a
## moment saved as PNG: --node=n_hello --at=5 --shot=PATH
extends SceneTree
var g
var out := "res://scene.png"
var at := 5.0
var nid := "n_hello"
var shot := false

func _initialize() -> void:
	create_timer(300.0, true, false, true).timeout.connect(func() -> void: print("watchdog"); quit(1))
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			out = a.substr(7)
		if a.begins_with("--at="):
			at = float(a.substr(5))
		if a.begins_with("--node="):
			nid = a.substr(7)
	g = (load("res://addons/horrorstudio/main.tscn") as PackedScene).instantiate()
	g.autostart = false
	root.add_child(g)
	await process_frame
	g.watch(nid, {"flags": [], "items": [], "karma": {"karma": 0.0}, "counters": {}, "states": {}, "trail": []})

func _process(_d: float) -> bool:
	if shot or g == null or g.scene_player == null:
		return false
	var sp = g.scene_player
	if sp.playing and sp.T >= at:
		shot = true
		var img := root.get_texture().get_image()
		img.save_png(out)
		print("GDSCENESHOT %s %dx%d at %.2f bake %s" % [out, img.get_width(), img.get_height(), sp.T, JSON.stringify(sp.bake_stats)])
		quit()
	return false
