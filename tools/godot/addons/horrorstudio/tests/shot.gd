## A picture of the main scene from the player's eye after a few frames (xvfb, lavapipe): --shot=PATH
extends SceneTree
const Story := preload("res://addons/horrorstudio/story.gd")
var n := 0
var out := "res://shot.png"

func _initialize() -> void:
	create_timer(120.0, true, false, true).timeout.connect(func() -> void: print("watchdog"); quit(1))
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			out = a.substr(7)
	var g := (load("res://addons/horrorstudio/main.tscn") as PackedScene).instantiate()
	root.add_child(g)

func _process(_d: float) -> bool:
	n += 1
	if n == 12:
		var img := root.get_texture().get_image()
		img.save_png(out)
		print("GDSHOT %s %dx%d" % [out, img.get_width(), img.get_height()])
		quit()
	return false
