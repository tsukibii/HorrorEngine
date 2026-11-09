## The double barrel's pictures (tools/godot/weapons_check.py --pictures): the HSDoubleBarrel in the hotel's corridor
## at night as the player sees it. double_idle (only the barrels in the view), double_fire (a barrel's flash),
## double_open (brought up and broken open, the hulls flicked out), double_pop (a shell popping into its chamber),
## double_shut (snapped shut on two live shells).
##   godot --path PROJECT --rendering-driver vulkan --fixed-fps 30 -s weapons_double_shots.gd -- --out=DIR [--only=a,b]
extends SceneTree

var out_dir := ""
var only: PackedStringArray = []
var main: Node3D
var player: Node3D
var gun: Node


func frames(n: int) -> void:
	for i in n:
		await process_frame


func snap(name: String) -> void:
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
	main = (load("res://double.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	player = main.get_node("Player") as Node3D
	gun = main.get_node("Player/Eye/Double")
	main.get_node("Story").visible = false
	var tape := main.get_node_or_null("Tape")
	if tape != null:
		tape.set("preset", "off")
	for l in main.get_node("Hotel").find_children("*", "Light3D", true, false):
		(l as Light3D).light_energy *= 0.13                       # the corridor at night: its lights low and cold
		(l as Light3D).light_color = Color(0.78, 0.86, 1.0)
	await frames(70)
	await snap("double_idle")
	gun.pull()
	await snap("double_fire")
	await frames(20)
	gun.pull()
	await frames(20)
	gun.reload()
	# broken open (the hulls just thrown), then a shell on its way in, then shut on two live shells
	for i in 120:
		await process_frame
		if float(gun.get("opened")) > 0.99:
			break
	await frames(2)
	await snap("double_open")
	for i in 120:
		await process_frame
		if int(gun.get("loaded")) >= 1:
			break
	await frames(int(float(gun.get("pop_secs")) * 30.0 * 0.5) + 2)
	await snap("double_pop")
	for i in 120:
		await process_frame
		if float(gun.get("opened")) < 0.01 and int(gun.get("loaded")) == 2:
			break
	await frames(2)
	await snap("double_shut")
	quit()
