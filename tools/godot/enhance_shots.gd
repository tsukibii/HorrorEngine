## Pictures of the enhancements branch's by-hand improvements (docs/TOOLS_REVIEW.md; the user, 2026-11-15: "screenshots
## of all your improvements with id references"), in tutorial v2's own project (tools/godot/tutorial_v2.py made it):
## the hotel floor at night through the player's own eye, the Story and the HSHud as the game shows them. E's prompt
## (E19) at 304's door and at the note; F5's save (E24); the pause menu (E29): its list, Save game, Load game; its
## Settings by hand (E33); the Story's words on the HUD (E34).
##   godot --path PROJECT --rendering-driver vulkan --resolution 1280x720 -s enhance_shots.gd -- --out=DIR
## Prints `ENHANCESHOTS <name>` lines and quits.
extends SceneTree

var out := ""
var main: Node3D
var player: CharacterBody3D


func frames(n: int) -> void:
	for i in n:
		await process_frame


func snap(name: String, hold := 30) -> void:
	await frames(hold)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out.path_join(name + ".png"))
	print("ENHANCESHOTS " + name)


func key(k: Key) -> void:
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


## the player's own eye at `from` looking at `at`
func stand(from: Vector3, at: Vector3) -> void:
	var e := player.get_node("Eye") as Camera3D
	player.global_position = from - Vector3(0, e.position.y, 0)
	player.velocity = Vector3.ZERO
	var d := at - from
	player.rotation = Vector3(0, atan2(-d.x, -d.z), 0)
	var pt := atan2(d.y, Vector2(d.x, d.z).length())
	player.set("pitch", pt)
	e.rotation = Vector3(pt, 0, 0)
	e.make_current()


func v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	create_timer(600.0).timeout.connect(func() -> void:
		print("ENHANCESHOTS never ended")
		quit())
	root.size = Vector2i(1280, 720)
	var cfg: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://tutorial.json"))
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	player = main.get_node("Player") as CharacterBody3D
	var story := main.get_node("Story")
	var her := main.get_node_or_null("Her")
	if her != null and her.get_node_or_null("Presence") != null:
		her.get_node("Presence").process_mode = Node.PROCESS_MODE_DISABLED   # (her signs held still)
	var storm := main.get_node_or_null("Weather/Lightning")
	if storm != null:
		storm.set("every", 0.0)
	var pause := Node.new()                                   # (the pause menu's node, as a game has it from the start)
	pause.name = "Pause"
	pause.set_script(load("res://starter/pause.gd"))
	main.add_child(pause)
	await frames(20)
	var mf: String = load("res://addons/horrorstudio_ui/menu.gd").saves_file(str(pause.call("game_id")))
	if FileAccess.file_exists(mf):                            # (a run before left its slots' words)
		DirAccess.remove_absolute(ProjectSettings.globalize_path(mf))
	var fl := float(cfg["floor"])
	var eye := fl + 1.6
	var door := v3(cfg["door304"])
	var note := v3(cfg["note"])
	# E19: E's prompt and ring over what you're aimed at, on the scene's HSHud: 304's door locked (its key not yours yet)
	stand(Vector3(door.x - 0.15, eye, -7.35), Vector3(door.x, door.y, door.z))
	await snap("e19_prompt_locked", 45)
	stand(Vector3(note.x - 0.1, eye, -7.45), note)
	await snap("e19_prompt_read", 45)
	# E24: F5 saves where you stand (the Story's Save Keys), its line says so
	story.set("save_keys", true)
	for sl in [0, 1, 2, 3]:
		story.call("delete_save", sl)
	stand(Vector3(4.0, eye, -7.0), Vector3(12.0, eye - 0.2, -7.0))
	await frames(10)
	await key(KEY_F5)
	await snap("e24_saved_f5", 12)
	# E29: the pause menu (the starter's pause.gd beside the HSHud, there from the start): its list, Save game, Load game
	await key(KEY_ESCAPE)
	await snap("e29_menu", 20)
	await key(KEY_S)
	await key(KEY_ENTER)
	await snap("e29_menu_save", 12)
	await key(KEY_ENTER)                                      # Slot 1: the Story's save
	await snap("e29_menu_saved", 12)
	await key(KEY_ESCAPE)
	await key(KEY_S)
	await key(KEY_ENTER)
	await snap("e29_menu_load", 12)
	await key(KEY_ESCAPE)                                     # back to the list, on Load game
	await key(KEY_S)                                          # Settings (E33: only what works by hand)
	await key(KEY_ENTER)
	await snap("e33_settings_display", 12)
	await key(KEY_ESCAPE)
	await key(KEY_S)
	await key(KEY_ENTER)
	await snap("e33_settings_graphics", 12)
	await key(KEY_ESCAPE)
	await key(KEY_ESCAPE)
	await key(KEY_ESCAPE)
	# E34: the Story's words on the HSHud (use_hud): the same spot and line, the Story's own first, then the HUD's
	stand(Vector3(4.0, eye, -7.0), Vector3(12.0, eye - 0.2, -7.0))
	var note_text := "Sorry, the card reader on 304 is broken again. The master key is on the shelf in the linen closet, across the corridor. Leave it there after. Please don't knock on 308.\n\n- the night desk"
	story.call("card", "Under 304's door", note_text)
	await snap("e34_card_own", 20)
	story.call("close_card")
	story.call("say", "Someone knocked at 308.", 30.0)
	await snap("e34_story_own", 30)
	story.set("use_hud", true)
	story.call("objective", str(story.call("objective_now")))
	story.call("_draw_list")
	story.call("say", "Someone knocked at 308.", 30.0)
	await snap("e34_story_hud", 30)
	story.call("card", "Under 304's door", note_text)
	await snap("e34_card_hud", 20)
	story.call("close_card")
	for sl in [0, 1, 2, 3]:
		story.call("delete_save", sl)
	print("ENHANCESHOTS done")
	quit()
