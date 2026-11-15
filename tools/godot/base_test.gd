## HORRORGAME's player (tools/horror_game.py check): a project the maker made, started as a player starts it: Godot's own
## boot screen black, the studio's card ("[Artist] presents"), skipped with a key, the main menu (no Continue before
## there's a save), New game: the look, the room, its note, the player, the Story's objective and task, the HSHud with the
## game's keys, the checkpoint's autosave, E on the note (its card, the task ticked), Esc (the pause menu up, the game
## held) and back; a save, Quit to the menu (Continue and Load game now), Load game's Slot 1 (the game where it was
## saved), the menu's Settings and back. Prints `HORRORGAME <what> <how>` lines and `HORRORGAME result {errors}`.
extends SceneTree

var errors: Array = []


func ok(cond: bool, what: String, how := "") -> void:
	print("HORRORGAME %s %s" % [what, how])
	if not cond:
		errors.append(what + (" (" + how + ")" if how != "" else ""))


func frames(n: int) -> void:
	for i in n:
		await process_frame


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


func until_scene(path: String, n := 240) -> bool:
	for i in n:
		if current_scene != null and current_scene.scene_file_path == path:
			return true
		await process_frame
	return current_scene != null and current_scene.scene_file_path == path


func labels(menu: Node) -> Array:
	return (menu.get("items") as Array).map(func(it): return str(it["label"]).split("     ")[0])


func _initialize() -> void:
	create_timer(300.0).timeout.connect(func() -> void:
		errors.append("the test never ended")
		print("HORRORGAME result " + JSON.stringify({"errors": errors}))
		quit())
	ok(str(ProjectSettings.get_setting("application/run/main_scene", "")) == "res://intro.tscn"
		and ProjectSettings.get_setting("application/boot_splash/show_image", true) == false
		and ProjectSettings.get_setting("application/boot_splash/bg_color", Color.WHITE) == Color(0, 0, 0, 1),
		"the start: intro.tscn, Godot's boot screen black with no logo")
	for sl in [0, 1, 2, 3]:                                   # (a run before left its saves)
		var f := ProjectSettings.globalize_path("user://hs_save_%d.save" % sl)
		if FileAccess.file_exists(f):
			DirAccess.remove_absolute(f)
	# the studio's card, then the menu
	change_scene_to_file("res://intro.tscn")
	await frames(20)
	var card := current_scene
	var line := card.get_node_or_null("Card/Line") as Label if card != null else null
	ok(card != null and card.get_script() != null and line != null and line.text == "[Artist] presents", "the card: [Artist] presents", line.text if line != null else "")
	await press(KEY_SPACE)
	var at_menu := await until_scene("res://menu.tscn")
	var menu := current_scene
	await frames(5)
	ok(at_menu and labels(menu) == ["New game", "Settings", "Quit"], "a key skips it: the main menu, no Continue before a save", str(labels(menu)) if at_menu else "")
	# the menu's Settings, then back
	await press(KEY_S)
	await press(KEY_ENTER)
	await frames(6)
	var shown := bool(menu.get("settings_up"))
	for i in 2:
		await press(KEY_ESCAPE)
	ok(shown and not bool(menu.get("settings_up")) and current_scene == menu, "Settings: the pause menu's pages, Esc back to the menu")
	# New game
	await press(KEY_W)
	await press(KEY_ENTER)
	var at_game := await until_scene("res://main.tscn")
	var main := current_scene
	await frames(30)
	var player := main.get_node_or_null("Player") as CharacterBody3D
	var story := main.get_node_or_null("Story")
	var hud := main.get_node_or_null("Hud")
	var pause := main.get_node_or_null("Pause")
	var note := main.get_node_or_null("Note") as Node3D
	ok(at_game and player != null and player.is_in_group("hs_player") and story != null and story.is_in_group("hs_story") and hud != null and pause != null and note != null
		and main.get_node_or_null("Look/Environment") is WorldEnvironment and main.get_node_or_null("Room/Floor") is StaticBody3D,
		"New game: the look, the room, the note, the player, the Story, the HUD, the pause menu")
	ok(str(story.call("objective_now")) == "Look around." and bool(story.call("has_task", "read")), "the Story: its objective and its task", str(story.call("objective_now")))
	ok(Array(hud.get("keys")).has("E:use") and Array(hud.get("keys")).has("Esc:menu"), "the HUD's keys", str(hud.get("keys")))
	ok(bool(story.call("has_save", 0)), "the checkpoint where you start: the first autosave (slot 0)")
	# E on the note: its card, the task ticked
	var eye := player.get_node("Eye") as Camera3D
	player.global_position = Vector3(0, 0.05, -1.6)
	var to := note.global_position - eye.global_position
	player.rotation.y = atan2(-to.x, -to.z)
	var pitch := atan2(to.y, Vector2(to.x, to.z).length())
	player.set("pitch", pitch)
	eye.rotation.x = pitch
	await frames(4)
	var used = player.call("use")
	await frames(3)
	ok(used == note and bool(story.call("card_up")), "E on the note: its card", str(used))
	story.call("close_card")
	await frames(2)
	ok(bool(story.call("done", "read")), "and the task ticked")
	# Esc: the pause menu up and the game held; Esc again: on
	await press(KEY_ESCAPE)
	var m = hud.get("menu")
	ok(m != null and bool(pause.get("up")) and paused and bool(m.get("up")), "Esc: the pause menu up, the game held")
	await press(KEY_ESCAPE)
	ok(not paused and not bool(pause.get("up")), "Esc again: the game goes on")
	# a save, then Quit to the menu: Continue and Load game now; Load game's Slot 1 puts the game back where it was saved
	var stood := player.global_position
	var wrote: bool = story.call("save_game", 1)
	pause.set("title_scene", "res://menu.tscn")
	pause.call("open")
	await frames(3)
	m.call("open_page", "quit")
	await frames(2)
	await press(KEY_D)                                        # Stay | Quit to title | Quit to desktop
	await press(KEY_ENTER)
	var back_at_menu := await until_scene("res://menu.tscn")
	menu = current_scene
	await frames(5)
	var said: Array = labels(menu) if back_at_menu else []
	ok(wrote and back_at_menu and said.slice(0, 1) == ["Continue"] and said.has("Load game") and not paused, "a save, Quit to title: the menu with Continue and Load game", str(said))
	await press(KEY_S)
	await press(KEY_S)
	await press(KEY_ENTER)                                    # Load game
	await frames(3)
	var slots: Array = labels(menu)
	var at1 := slots.find("Slot 1")
	for i in at1:
		await press(KEY_S)
	await press(KEY_ENTER)
	var loaded_in := await until_scene("res://main.tscn")
	await frames(20)
	var p2 := current_scene.get_node_or_null("Player") as Node3D if loaded_in else null
	ok(at1 >= 0 and loaded_in and p2 != null and p2.global_position.distance_to(stood) < 0.05, "Load game, Slot 1: the game where it was saved",
		"%s; %.2f m off" % [str(slots), p2.global_position.distance_to(stood) if p2 != null else -1.0])
	var st2 := current_scene.get_node_or_null("Story")
	if st2 != null:
		for sl in [0, 1, 2, 3]:
			st2.call("delete_save", sl)
	print("HORRORGAME result " + JSON.stringify({"errors": errors}))
	quit()
