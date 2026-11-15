## Pictures of a project the maker made (tools/horror_game.py; the enhancements list): the studio's card, the main menu,
## the game's room with E's prompt on the note, the menu again once there's a save, its Load game page.
##   godot --path PROJECT --rendering-driver vulkan --resolution 1280x720 -s base_shots.gd -- --out=DIR
extends SceneTree

var out := ""


func frames(n: int) -> void:
	for i in n:
		await process_frame


func snap(name: String, hold := 20) -> void:
	await frames(hold)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out.path_join(name + ".png"))
	print("BASESHOTS " + name)


func press(k: Key) -> void:
	var ev := InputEventKey.new()
	ev.physical_keycode = k
	ev.keycode = k
	ev.pressed = true
	Input.parse_input_event(ev)
	await frames(2)
	var off := InputEventKey.new()
	off.physical_keycode = k
	off.keycode = k
	Input.parse_input_event(off)
	await frames(2)


func until_scene(path: String) -> void:
	for i in 300:
		if current_scene != null and current_scene.scene_file_path == path:
			return
		await process_frame


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	create_timer(300.0).timeout.connect(func() -> void:
		print("BASESHOTS never ended")
		quit())
	root.size = Vector2i(1280, 720)
	for sl in [0, 1, 2, 3]:
		var f := ProjectSettings.globalize_path("user://hs_save_%d.save" % sl)
		if FileAccess.file_exists(f):
			DirAccess.remove_absolute(f)
	change_scene_to_file("res://intro.tscn")
	await frames(3)
	await snap("e35_card", 45)                                 # (the words eased in)
	await press(KEY_SPACE)
	await until_scene("res://menu.tscn")
	await snap("e35_menu", 20)
	await press(KEY_ENTER)                                    # New game
	await until_scene("res://main.tscn")
	var main := current_scene
	await frames(20)
	var player := main.get_node("Player") as CharacterBody3D
	var eye := player.get_node("Eye") as Camera3D
	var note := main.get_node("Note") as Node3D
	player.global_position = Vector3(0, 0.05, -1.3)
	var to := note.global_position - eye.global_position
	player.rotation.y = atan2(-to.x, -to.z)
	var pitch := atan2(to.y, Vector2(to.x, to.z).length()) + 0.25
	player.set("pitch", pitch)
	eye.rotation.x = pitch
	await snap("e35_game", 40)
	var story := main.get_node("Story")
	story.call("save_game", 1)
	var pause := main.get_node("Pause")
	pause.call("open")
	await frames(3)
	(main.get_node("Hud").get("menu")).call("open_page", "quit")
	await press(KEY_D)
	await press(KEY_ENTER)
	await until_scene("res://menu.tscn")
	await snap("e35_menu_saved", 20)
	await press(KEY_S)
	await press(KEY_S)
	await press(KEY_ENTER)
	await snap("e35_menu_load", 15)
	for sl in [0, 1, 2, 3]:
		story = null
		var f := ProjectSettings.globalize_path("user://hs_save_%d.save" % sl)
		if FileAccess.file_exists(f):
			DirAccess.remove_absolute(f)
	print("BASESHOTS done")
	quit()
