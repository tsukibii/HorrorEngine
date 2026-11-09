## The weapons plugin's pictures (tools/godot/weapons_check.py --pictures): the shotgun in the hotel's corridor at
## night as the player sees it, the tape on (the user's camhybrid). idle, fire (the flash's frame), rack (the pump
## back, the hull in the air), reload (a shell going into the port), floor (the hulls on the carpet).
##   godot --path PROJECT --rendering-driver vulkan --fixed-fps 30 -s weapons_shots.gd -- --out=DIR [--only=idle,fire]
extends SceneTree

var out_dir := ""
var only: PackedStringArray = []
var main: Node3D
var player: Node3D
var gun: Node


func frames(n: int) -> void:
	for i in n:
		await process_frame


func shot(name: String, hold := 30) -> void:
	if not only.is_empty() and not only.has(name):
		return
	await frames(hold)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	print("SHOT %s" % name)


func seconds(prop: String) -> float:
	return float(gun.get(prop))


func now(name: String) -> void:
	if not only.is_empty() and not only.has(name):
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	print("SHOT %s" % name)


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--only="):
			only = a.substr(7).split(",", false)
	root.size = Vector2i(1600, 900)
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	player = main.get_node("Player") as Node3D
	gun = main.get_node("Player/Eye/Shotgun")
	main.get_node("Story").visible = false
	var tape := main.get_node_or_null("Tape")
	if tape != null:
		tape.set("preset", "off")
	for l in main.get_node("Hotel").find_children("*", "Light3D", true, false):
		(l as Light3D).light_energy *= 0.13                       # the corridor at night: its lights low and cold
		(l as Light3D).light_color = Color(0.78, 0.86, 1.0)
	await frames(20)
	await shot("idle", 50)
	gun.pull()
	await frames(1)
	await now("fire")
	await frames(10)
	await now("rack")                                             # the pump back, the hull just out of the port
	await frames(60)
	gun.set("loaded", 1)
	gun.set("spare", 6)
	gun.reload()
	for i in 150:                                                 # the second shell on its way into the port
		await process_frame
		if int(gun.get("loaded")) == 2:
			await frames(int(seconds("insert_gap") * 30.0 + seconds("insert_secs") * 15.0))
			await now("reload")
			break
	await frames(90)
	var eye := player.get_node("Eye") as Camera3D
	player.set("pitch", deg_to_rad(-62.0))
	eye.rotation.x = deg_to_rad(-62.0)
	player.rotation.y += deg_to_rad(-25.0)
	await shot("floor", 30)
	quit()
