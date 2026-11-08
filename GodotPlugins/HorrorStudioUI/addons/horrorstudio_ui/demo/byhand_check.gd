## HorrorStudio UI made by hand (GDUI's second half): a project from tools/godot_byhand.py, no runtime, no story: a camera, a
## wall, an HSHud, and HSQuestMarkers on two things (one in the open, one behind the wall). The HUD sets itself up
## (`standalone`): the project's UI settings, no black fade, no pause menu, the markers found in the scene, their sight from
## physics rays. Ends "BYHAND ok".
##   godot --headless --fixed-fps 60 --path <project> -s res://byhand_check.gd
extends SceneTree

var fails := 0


func fail(what: String) -> void:
	printerr("BYHAND FAIL: " + what)
	fails += 1
	quit(1)


func frames(n: int) -> void:
	for i in n:
		await process_frame


func _initialize() -> void:
	create_timer(120.0, true, false, true).timeout.connect(func() -> void: printerr("BYHAND FAIL: watchdog"); quit(1))
	var world := Node3D.new()
	root.add_child(world)
	var cam := Camera3D.new()
	world.add_child(cam)
	cam.position = Vector3(0, 1.6, 0)
	cam.current = true
	var wall := StaticBody3D.new()                        # a wall across the left half of the view, 3 m ahead
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(5.0, 3.0, 0.2)
	shape.shape = box
	wall.add_child(shape)
	world.add_child(wall)
	wall.position = Vector3(-3.0, 1.5, -3.0)
	var open_thing := Node3D.new()                        # in the open, 6 m ahead and to the right
	world.add_child(open_thing)
	open_thing.position = Vector3(2.0, 0.0, -6.0)
	var m1 := HSQuestMarker.new()
	m1.label = "Key"
	m1.height = 0.5
	open_thing.add_child(m1)
	var behind_thing := Node3D.new()                      # behind the wall, 6 m ahead and to the left
	world.add_child(behind_thing)
	behind_thing.position = Vector3(-3.0, 0.0, -6.0)
	var m2 := HSQuestMarker.new()
	m2.label = "Door"
	m2.height = 0.5
	behind_thing.add_child(m2)
	var hud := HSHud.new()
	root.add_child(hud)
	await frames(240)
	if hud.menu != null:
		return fail("a pause menu in a game made by hand")
	if hud.fade_alpha() > 0.01:
		return fail("the HUD starts under black: %.2f" % hud.fade_alpha())
	if hud.theme_name != "glass" or int(hud.guide.mode) != 1:
		return fail("the project's UI settings weren't worn: %s, marker %s" % [hud.theme_name, hud.guide.mode])
	var a: Dictionary = hud.guide.marks.get(str(m1.get_path()), {})
	var b: Dictionary = hud.guide.marks.get(str(m2.get_path()), {})
	if a.is_empty() or b.is_empty():
		return fail("markers over %s and %s: %s" % [m1.get_path(), m2.get_path(), hud.guide.marks.keys()])
	if float(a["seen"]) < 0.95 or float(b["seen"]) > 0.05:
		return fail("sight: the open one %.2f, the one behind the wall %.2f" % [a["seen"], b["seen"]])
	if float(a["k"]) < 0.4 or float(b["k"]) < 0.08 or float(b["k"]) > float(a["k"]) * 0.8:
		return fail("strength: the open one %.2f, the one behind the wall %.2f (fainter, but there)" % [a["k"], b["k"]])
	if str(a["name"]) != "Key":
		return fail("the name: %s" % a["name"])
	m1.active = false                                     # its task done
	await frames(120)
	if hud.guide.marks.has(str(m1.get_path())):
		return fail("the marker stayed after the node was switched off")
	hud.objective("Find the key")
	hud.todo([{"id": "k", "text": "Find the key", "state": "open", "guide": true}], true)
	await frames(30)
	if hud.obj.text != "Find the key" or hud.todo_box.get_child_count() != 1:
		return fail("the HUD's words: %s, %d rows" % [hud.obj.text, hud.todo_box.get_child_count()])
	print("BYHAND ok")
	quit(0)
