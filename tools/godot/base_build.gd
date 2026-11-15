## The scenes of a new horror game made by tools/horror_game.py, built by Godot from nodes (so they're scenes Godot
## wrote: instances, owners, scripts): res://intro.tscn (the UI plugin's HSSplash: black, "[Artist] presents", then the
## menu), res://menu.tscn (HSTitleMenu: the game's name, Continue, New game, Load game, Settings, Quit) and res://main.tscn,
## the game. What's in the game, all of it yours to change:
## the studio's look (the balanced preset: its environment, tape and grade), moonlight, a small room (a floor, four walls
## with a doorway, a lamp, a table), a note on the table, the starter's player, the Story (an objective, a task the note
## ticks, autosave on), the UI plugin's HSHud with the game's keys, Sound, the pause menu and a checkpoint at the start.
##   godot --headless --path PROJECT -s base_build.gd -- --name="My Game"
## Prints `BASEBUILD saved res://main.tscn` and quits.
extends SceneTree

var top: Node3D                                       # (the scene being built: SceneTree has a `root` of its own)
var title := "your game"


func own(n: Node, parent: Node = null) -> Node:
	(parent if parent != null else top).add_child(n)
	n.owner = top
	return n


func mat(c: Color, rough := 0.85) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	return m


## a solid box: a StaticBody3D, its collider and its mesh, centred at `at`
func box(nm: String, size: Vector3, at: Vector3, m: Material, parent: Node = null) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.name = nm
	b.position = at
	own(b, parent)
	var cs := CollisionShape3D.new()
	cs.name = "Shape"
	var sh := BoxShape3D.new()
	sh.size = size
	cs.shape = sh
	own(cs, b)
	var mi := MeshInstance3D.new()
	mi.name = "Mesh"
	var bm := BoxMesh.new()
	bm.size = size
	bm.material = m
	mi.mesh = bm
	own(mi, b)
	return b


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--name="):
			title = a.substr(7)
	top = Node3D.new()
	top.name = "Main"
	# the look: the studio's balanced preset (its WorldEnvironment, the tape, the grade)
	var look := (load("res://addons/horrorstudio_look/presets/look_balanced.tscn") as PackedScene).instantiate()
	look.name = "Look"
	own(look)
	var moon := DirectionalLight3D.new()
	moon.name = "Moon"
	moon.rotation_degrees = Vector3(-52.0, 28.0, 0.0)
	moon.light_color = Color(0.62, 0.7, 0.95)
	moon.light_energy = 0.35
	moon.shadow_enabled = true
	own(moon)
	# a small room: a floor, four walls (a doorway in the south one), a lamp, a table
	var room := Node3D.new()
	room.name = "Room"
	own(room)
	var floor_m := mat(Color(0.23, 0.19, 0.16))
	var wall_m := mat(Color(0.62, 0.6, 0.56))
	box("Floor", Vector3(10, 0.2, 10), Vector3(0, -0.1, 0), floor_m, room)
	box("WallNorth", Vector3(10, 2.8, 0.2), Vector3(0, 1.4, -5), wall_m, room)
	box("WallEast", Vector3(0.2, 2.8, 10), Vector3(5, 1.4, 0), wall_m, room)
	box("WallWest", Vector3(0.2, 2.8, 10), Vector3(-5, 1.4, 0), wall_m, room)
	box("WallSouthLeft", Vector3(4.1, 2.8, 0.2), Vector3(-2.95, 1.4, 5), wall_m, room)    # a 1 m doorway between them
	box("WallSouthRight", Vector3(4.1, 2.8, 0.2), Vector3(2.95, 1.4, 5), wall_m, room)
	box("OverDoor", Vector3(1.8, 0.75, 0.2), Vector3(0, 2.425, 5), wall_m, room)
	var lamp := OmniLight3D.new()
	lamp.name = "Lamp"
	lamp.position = Vector3(0, 2.5, -1.5)
	lamp.light_color = Color(1.0, 0.78, 0.55)
	lamp.light_energy = 1.4
	lamp.omni_range = 7.0
	lamp.shadow_enabled = true
	own(lamp, room)
	box("Table", Vector3(1.2, 0.75, 0.7), Vector3(0, 0.375, -2.6), mat(Color(0.35, 0.24, 0.16), 0.6), room)
	# a note on the table: E reads it (its card), and it ticks the Story's task
	var note := Node3D.new()
	note.name = "Note"
	note.position = Vector3(0.1, 0.752, -2.55)
	note.rotation_degrees = Vector3(0, 12, 0)
	note.set_script(load("res://starter/note.gd"))
	note.set("title", "Read me")
	note.set("text", "This is %s: the studio's look, a player who walks, runs and uses things with E, a Story with an objective and a to-do list, the HUD, sound, saves and a pause menu (Esc).\n\nEverything here is yours to change. guides/first_game and guides/tutorial_v2 in the studio say what's next." % title)
	note.set("tick", "read")
	own(note)
	var paper := MeshInstance3D.new()
	paper.name = "Paper"
	var pm := BoxMesh.new()
	pm.size = Vector3(0.21, 0.004, 0.297)
	pm.material = mat(Color(0.86, 0.84, 0.78), 0.95)
	paper.mesh = pm
	own(paper, note)
	# the player, at the room's south side, looking at the table
	var player := (load("res://starter/player.tscn") as PackedScene).instantiate() as Node3D
	player.name = "Player"
	player.position = Vector3(0, 0.05, 3.0)
	own(player)
	# the Story, the HUD, the sound and the pause menu
	var story := CanvasLayer.new()
	story.name = "Story"
	story.set_script(load("res://starter/story.gd"))
	story.set("objective_text", "Look around.")
	story.set("tasks", PackedStringArray(["read: Read the note on the table."]))
	story.set("autosave", true)
	own(story)
	var hud := CanvasLayer.new()
	hud.name = "Hud"
	hud.set_script(load("res://addons/horrorstudio_ui/hud.gd"))
	hud.set("keys", PackedStringArray(["W A S D:walk", "Shift:run", "E:use", "Tab:pocket", "F:flashlight", "Esc:menu"]))
	own(hud)
	var sound := Node.new()
	sound.name = "Sound"
	sound.set_script(load("res://starter/sound.gd"))
	own(sound)
	var pause := Node.new()
	pause.name = "Pause"
	pause.set_script(load("res://starter/pause.gd"))
	pause.set("title_scene", "res://menu.tscn")
	own(pause)
	# a checkpoint where you start: with the Story's Autosave, the game's first save (the pause menu's Load game lists it)
	var cp := Area3D.new()
	cp.name = "Checkpoint"
	cp.position = Vector3(0, 1.0, 3.0)
	cp.set_script(load("res://starter/checkpoint.gd"))
	own(cp)
	var cps := CollisionShape3D.new()
	cps.name = "Shape"
	var cb := BoxShape3D.new()
	cb.size = Vector3(2.0, 2.0, 2.0)
	cps.shape = cb
	own(cps, cp)
	var err := save(top, "res://main.tscn")
	# the studio's card before the game (Godot's own boot screen black: the maker's project settings), then the menu
	var intro := Control.new()
	intro.name = "Intro"
	intro.set_script(load("res://addons/horrorstudio_ui/splash.gd"))
	intro.set("line", "[Artist] presents")
	intro.set("next_scene", "res://menu.tscn")
	if err == OK:
		err = save(intro, "res://intro.tscn")
	var menu := Control.new()
	menu.name = "Menu"
	menu.set_script(load("res://addons/horrorstudio_ui/title_menu.gd"))
	menu.set("title", title)
	menu.set("game_scene", "res://main.tscn")
	if err == OK:
		err = save(menu, "res://menu.tscn")
	print("BASEBUILD %s res://main.tscn, res://intro.tscn, res://menu.tscn" % ("saved" if err == OK else "FAILED (%s)" % error_string(err)))
	quit(0 if err == OK else 1)


func save(n: Node, path: String) -> int:
	var ps := PackedScene.new()
	var err := ps.pack(n)
	if err == OK:
		err = ResourceSaver.save(ps, path)
	n.free()
	return err
