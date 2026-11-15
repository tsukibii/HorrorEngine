## HORRORGAME's player (tools/horror_game.py check): a project the maker made, started as a player starts it: Godot's own
## boot screen black, the studio's card ("[Artist] presents"), skipped with a key, the main menu (no Continue before
## there's a save), New game: the look, the room, its note, the player, the Story's objective and task, the HSHud with the
## game's keys, the checkpoint's autosave, E on the note (its card, the task ticked), Esc (the pause menu up, the game
## held) and back; a save, Quit to the menu (Continue and Load game now), Load game's Slot 1 (the game where it was
## saved), the menu's Settings and back; a save made in a second scene opened there, a way into it (starter/travel.gd)
## carrying the pocket, the list, the facts and the cash (not in the pack Godot exports from
## the project, `-- --packed`, where nothing can be written into res://). Prints `HORRORGAME <what> <how>` lines and
## `HORRORGAME result {errors}`.
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
	ok(card != null and card.get_script() != null and line != null and line.text == "Check Studio presents", "the card: the studio's name (made with --artist)", line.text if line != null else "")
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
	# the HUD inside the tape's picture (the user, 2026-11-15: "make sure the quests align to not be in the black letter
	# boxes"): at 1280 x 720 the look's tape is 4:3 between black bars, the objective 24 px in from its left, and the keys'
	# chips are not over the game ("they shouldn't be visible inside the main game unless I pause")
	root.size = Vector2i(1280, 720)
	await frames(4)
	var fr: Rect2 = hud.call("frame_rect")
	var tl_x := (hud.get("tl") as Control).get_global_rect().position.x
	ok(fr.is_equal_approx(Rect2(160, 0, 960, 720)) and absf(tl_x - 184.0) < 0.6 and not (hud.get("hint_el") as Control).visible,
		"at 1280 x 720: the tape's picture 4:3 between black bars, the objective inside it, no keys over the game", "%s, the objective at %.0f" % [fr, tl_x])
	# Esc: the pause menu up and the game held, the game's keys as the HUD's chips at its foot; Esc again: on
	await press(KEY_ESCAPE)
	var m = hud.get("menu")
	var keys_said: Array = []
	var krow: Control = m.get("keys_row") if m != null else null
	if krow != null and is_instance_valid(krow):
		for pair in krow.get_children():
			keys_said.append(str(((pair as Node).get_child(1) as Label).text))
	ok(m != null and bool(pause.get("up")) and paused and bool(m.get("up")), "Esc: the pause menu up, the game held")
	var last_key: Rect2 = (krow.get_child(krow.get_child_count() - 1) as Control).get_global_rect() if krow != null and krow.get_child_count() > 0 else Rect2()
	ok(keys_said == ["walk", "run", "use", "pocket", "flashlight", "menu"] and krow.is_visible_in_tree() and absf(last_key.end.x - 1232.0) < 1.0 and absf(last_key.get_center().y - 657.0) < 4.0,
		"and the game's keys in it, as the HUD's chips on its legend's line at the right", "%s, the last ending at %.0f, its middle at %.0f" % [keys_said, last_key.end.x, last_key.get_center().y])
	await press(KEY_ESCAPE)
	ok(not paused and not bool(pause.get("up")) and not (hud.get("hint_el") as Control).visible, "Esc again: the game goes on, no keys over it")
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
	if OS.get_cmdline_user_args().has("--packed"):          # (an exported game: its res:// is the pack, nothing written there)
		for sl in [0, 1, 2, 3]:
			current_scene.get_node("Story").call("delete_save", sl)
		print("HORRORGAME result " + JSON.stringify({"errors": errors}))
		quit()
		return
	# a game of two scenes: a save made in the second, loaded from the menu, opens that scene
	DirAccess.copy_absolute(ProjectSettings.globalize_path("res://main.tscn"), ProjectSettings.globalize_path("res://level_two.tscn"))
	change_scene_to_file("res://level_two.tscn")
	var in_two := await until_scene("res://level_two.tscn")
	await frames(20)
	var st_two := current_scene.get_node_or_null("Story")
	var two_saved: bool = in_two and st_two != null and bool(st_two.call("save_game", 2))
	change_scene_to_file("res://menu.tscn")
	await until_scene("res://menu.tscn")
	await frames(5)
	(current_scene as Node).call("start", 2)
	var two_again := await until_scene("res://level_two.tscn")
	ok(two_saved and two_again, "a save made in a second scene: the menu's Load opens that scene", "saved %s, opened %s" % [two_saved, two_again])
	await frames(10)
	# a way into the next level (starter/travel.gd, the Story's go_to): what you carry comes with you
	change_scene_to_file("res://main.tscn")
	await until_scene("res://main.tscn")
	await frames(20)
	var st_here := current_scene.get_node("Story")
	var way_down := Area3D.new()
	way_down.set_script(load("res://starter/travel.gd"))
	way_down.set("scene", "res://level_two.tscn")
	way_down.set("at", "Checkpoint")
	way_down.set("needs", "item:key")
	current_scene.add_child(way_down)
	way_down.position = Vector3(0, -40, 0)
	way_down.call("fire")
	await frames(6)
	var stayed := current_scene != null and current_scene.scene_file_path == "res://main.tscn"
	st_here.call("give", "key", "Cellar key")
	st_here.call("add_task", "down", "Go down to the cellar.")
	st_here.call("flag", "lights_out")
	st_here.call("earn", 7.5)
	var cash_was := float(st_here.get("cash"))
	way_down.call("fire")
	var through := await until_scene("res://level_two.tscn")
	await frames(10)
	var st_next := current_scene.get_node_or_null("Story") if through else null
	var p_next := current_scene.get_node_or_null("Player") as Node3D if through else null
	var cp_next := current_scene.get_node_or_null("Checkpoint") as Node3D if through else null
	ok(stayed and through and st_next != null and bool(st_next.call("holds", "item:key")) and bool(st_next.call("has_task", "down")) and bool(st_next.call("has_task", "read"))
		and bool(st_next.call("holds", "lights_out")) and is_equal_approx(float(st_next.get("cash")), cash_was)
		and p_next != null and cp_next != null and p_next.global_position.distance_to(cp_next.global_position) < 0.3,
		"a way to the next level: not without the key; then there with the pocket, the list (and its own task), the facts and the cash, at its Checkpoint",
		"stayed %s, through %s" % [stayed, through])
	DirAccess.remove_absolute(ProjectSettings.globalize_path("res://level_two.tscn"))
	var st2 := current_scene.get_node_or_null("Story")
	if st2 != null:
		for sl in [0, 1, 2, 3]:
			st2.call("delete_save", sl)
	print("HORRORGAME result " + JSON.stringify({"errors": errors}))
	quit()
