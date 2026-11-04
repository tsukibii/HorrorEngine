## A map's pictures (tools/godot/map_shots.py): shots.json's cameras (Godot's coordinates), each held a while (TAA
## settles), saved as <out>/<name>.png. --nofog: the look's haze off (to judge the layout far off).
##   godot --path PROJECT --rendering-driver vulkan -s map_shots.gd -- --out=DIR [--nofog]
extends SceneTree


func _initialize() -> void:
	var out_dir := ""
	var argv := OS.get_cmdline_user_args()
	for a in argv:
		if a.begins_with("--out="):
			out_dir = a.substr(6)
	root.size = Vector2i(1600, 900)
	var shots: Array = JSON.parse_string(FileAccess.get_file_as_string("res://shots.json"))
	var main := (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	if "--nofog" in argv:
		for we in main.find_children("*", "WorldEnvironment", true, false):
			var env: Environment = (we as WorldEnvironment).environment
			if env:
				env.fog_enabled = false
				env.volumetric_fog_enabled = false
	var cam := Camera3D.new()
	cam.near = 0.03
	main.add_child(cam)
	cam.current = true
	for i in 4:
		await process_frame
	for s in shots:
		cam.fov = float(s.get("vfov", 62.0))
		cam.global_position = Vector3(s["eye"][0], s["eye"][1], s["eye"][2])
		cam.look_at(Vector3(s["look"][0], s["look"][1], s["look"][2]), Vector3.UP)
		for k in 30:
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(out_dir.path_join(str(s["name"]) + ".png"))
		print("SHOT %s" % s["name"])
	quit()
