## A picture of the game from a place (docs/GODOT_DIRECTOR.md §8): the sample's main scene played, the player put at
## --at=x,z facing --yaw (degrees, the story's: 0 east, 90 north) with --pitch, a few frames, the picture saved to
## --out (under xvfb in the cloud).
extends SceneTree


func _initialize() -> void:
	var at := Vector2(0, 1.2)
	var yaw := 90.0
	var pitch := -5.0
	var out := "res://shot.png"
	var wait := 90
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--at="):
			var p := a.substr(5).split(",")
			at = Vector2(float(p[0]), float(p[1]))
		elif a.begins_with("--yaw="):
			yaw = float(a.substr(6))
		elif a.begins_with("--pitch="):
			pitch = float(a.substr(8))
		elif a.begins_with("--out="):
			out = a.substr(6)
	var hs = (load("res://main.tscn") as PackedScene).instantiate()
	root.add_child(hs)
	for i in 400:
		await process_frame
		if hs.runtime != null and hs.runtime.play != null and hs.runtime.play.active and not hs.runtime.play.busy:
			break
	var rt = hs.runtime.play
	rt.place(Vector3(at.x, 0, at.y), yaw, pitch)
	for i in wait:
		await process_frame
	var img := root.get_viewport().get_texture().get_image()
	img.save_png(out if out.begins_with("/") else ProjectSettings.globalize_path(out))
	print("SHOT ", out)
	quit()
