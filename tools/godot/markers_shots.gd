## The guide's two pictures of the game (guides/markers; tools/godot/markers_check.py guide): the room the editor check
## works in, the starter's Story and player, Alex with markers made here (a walk, a talk), played until Alex is
## walking (F7's label over them) and until you're talking: the line at the foot of the view and your answers on one
## line under it, as the UI plugin's HUD draws them (an HSHud is put in the scene for it, as a game has one). A third,
## `00_play_talk_twin` (not the guide's: its name keeps it out), is the same moment with no HUD in the scene, drawn by
## the Markers plugin itself: the two should look alike.
## Run with a window (under xvfb): `-- --out=DIR`. Prints `MARKERSSHOTS <what>` lines and quits.
extends SceneTree

var out := ""


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func snap(name: String) -> void:
	await frames(4)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out.path_join(name + ".png"))
	print("MARKERSSHOTS pictured " + name)


func look(player: Node3D, at: Vector3) -> void:
	var eye := player.get_node("Eye") as Camera3D
	var d := at - eye.global_position
	player.rotation.y = atan2(-d.x, -d.z)
	player.set("pitch", atan2(d.y, Vector2(d.x, d.z).length()))
	eye.rotation.x = float(player.get("pitch"))


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	create_timer(240.0).timeout.connect(func() -> void:
		print("MARKERSSHOTS never ended")
		quit())
	var room := (load("res://editor_scene.tscn") as PackedScene).instantiate() as Node3D
	for n in room.find_children("*", "HSNpc", true, false):        # (what the editor check left in it: the game's markers are made here)
		n.get_parent().remove_child(n)
		n.free()
	var bob := room.get_node_or_null("Bob")
	if bob != null:
		room.remove_child(bob)
		bob.free()
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
	var story := CanvasLayer.new()
	story.name = "Story"
	story.set_script(load("res://starter/story.gd"))
	story.set("tasks", PackedStringArray(["book: Find the missing book."]))
	room.add_child(story)
	var player := (load("res://starter/player.tscn") as PackedScene).instantiate() as Node3D
	room.add_child(player)
	var alex := room.get_node("Alex") as Node3D
	var npc := HSNpc.new()
	npc.name = "Alex markers"
	npc.npc_name = "Alex"
	var q := HSNpcQuest.new()
	q.name = "The missing book"
	q.title = "The missing book"
	npc.add_child(q)
	var walk := HSNpcMarker.new()
	walk.kind = "walk"
	walk.name = "Walk"
	walk.position = Vector3(0.1, 0, 1.2)
	walk.start_when = "@wait:1"
	q.add_child(walk)
	var bend := HSNpcBend.new()
	bend.position = Vector3(-1.5, 0, 2.5)
	walk.add_child(bend)
	var talk := HSNpcMarker.new()
	talk.kind = "wait"
	talk.name = "Talk"
	talk.talk = true
	talk.stay = "talked"
	var talks: Array[Dictionary] = [{"lines": ["Alex: Looking for something?"], "answers": [
		{"text": "The book on the shelf", "sets": "+alex_shelf", "face": "smile", "reply": "Alex: I'll get it for you."},
		{"text": "Never mind", "sets": "+alex_never", "face": "sad", "reply": ""}]}]
	talk.talks = talks
	q.add_child(talk)
	root.add_child(room)
	alex.global_position = Vector3(-3.2, 0, 1.7)
	alex.global_rotation = Vector3(0, PI * 0.5, 0)
	player.global_position = Vector3(1.6, 0.1, 3.6)
	room.add_child(npc)
	npc.character = npc.get_path_to(alex)
	await frames(20)
	var run: HSNpcRunner = npc.runner
	if run == null:
		print("MARKERSSHOTS the markers never started")
		quit()
		return
	HSNpc.debug = true
	for i in 600:                                              # until he's well on his way
		look(player, alex.global_position + Vector3.UP * 1.25)
		if run.cur == walk and run.phase == "run" and run.body.travelled > 1.6:
			break
		await physics_frame
	await snap("play_f7")
	HSNpc.debug = false
	for i in 900:
		if run.cur == talk and run.phase == "stay" and run.can_talk():
			break
		await physics_frame
	var hud: CanvasLayer = load("res://addons/horrorstudio_ui/hud.gd").new()   # the game's HUD (the UI plugin's): the talk is drawn by it
	hud.name = "Hud"
	room.add_child(hud)
	var box := HSNpcTalkBox.of(root.get_tree())
	box.set("_hud_t", -100000)
	player.global_position = Vector3(0.1, 0.1, 2.75)
	look(player, alex.global_position + Vector3.UP * 1.3)
	await frames(30)
	look(player, alex.global_position + Vector3.UP * 1.3)
	await frames(6)
	await snap("00_play_prompt")
	player.call("use")
	await frames(40)
	print("MARKERSSHOTS with the HUD: open %s, stage %s, the HUD's line '%s', its answers %s" % [box.open_now, box.stage, hud.get("line_el").text, str(hud.call("choice_options"))])
	await snap("play_talk")
	box.close()
	await frames(4)
	room.remove_child(hud)
	hud.queue_free()
	box.set("_hud_t", -100000)
	await frames(20)
	await snap("00_play_prompt_twin")
	player.call("use")
	await frames(40)
	print("MARKERSSHOTS with no HUD: open %s, stage %s, showing %s" % [box.open_now, box.stage, str(box.showing())])
	await snap("00_play_talk_twin")
	quit()
