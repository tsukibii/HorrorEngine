## The guide's picture of the game (guides/flags; tools/godot/logic_check.py guide): the scene the editor check built
## and saved (logic_scene.tscn), lit, started, with F7 on: Ann's chip (what she waits for) and the flag board at the
## left (the scene's flags, the ones that are on bright; the tasks; the pocket).
## Run with a window (under xvfb): `-- --out=DIR`. Prints `LOGICSHOTS <what>` lines and quits.
extends SceneTree

var out := ""


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func snap(name: String) -> void:
	await frames(4)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out.path_join(name + ".png"))
	print("LOGICSHOTS pictured " + name)


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	create_timer(180.0).timeout.connect(func() -> void:
		print("LOGICSHOTS never ended")
		quit())
	var room := (load("res://logic_scene.tscn") as PackedScene).instantiate() as Node3D
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -35, 0)
	sun.shadow_enabled = true
	sun.light_energy = 1.1
	room.add_child(sun)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.04, 0.045, 0.06)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.64, 0.72)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	we.environment = env
	room.add_child(we)
	root.add_child(room)
	await frames(20)
	var player := room.get_node("Player") as CharacterBody3D
	var story := room.get_node("Story")
	var eye := player.get_node("Eye") as Camera3D
	player.global_position = Vector3(-0.6, 0.1, 2.6)
	var at := Vector3(1.4, 1.0, -2.2)
	var d := at - eye.global_position
	player.rotation.y = atan2(-d.x, -d.z)
	player.set("pitch", atan2(d.y, Vector2(d.x, d.z).length()))
	eye.rotation.x = float(player.get("pitch"))
	story.call("add_task", "cellar", "Open the cellar.")
	story.call("set_flag", "power_on")
	story.call("give", "matches")
	HSNpc.debug = true
	await frames(40)
	await snap("play_f7")
	HSNpc.debug = false
	quit()
