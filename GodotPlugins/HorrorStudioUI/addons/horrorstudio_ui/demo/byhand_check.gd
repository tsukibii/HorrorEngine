## HorrorStudio UI made by hand (GDUI's second half): a project from tools/godot_byhand.py, no runtime, no story: a camera, a
## wall, an HSHud, and HSQuestMarkers on two things (one in the open, one behind the wall). The HUD sets itself up
## (`standalone`): the project's UI settings, no black fade, no pause menu, the markers found in the scene, their sight from
## physics rays. Then the keys (by hand only in the pause menu: `menu_keys`) and the picture: under the Look plugin's
## tape every part at an edge inside its 4:3 (the objective and the list, the log, the stance, the footer, a side card,
## the keys, the dark round the edge, the marker's pointer; a thing in the bars out of view), in every preset and at five
## window sizes, and the starter's own words and sanity meter the same. Ends "BYHAND ok".
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
	# the keys (the user, 2026-11-15: "they shouldn't be visible inside the main game unless I pause"): by hand the chips
	# wait for the pause menu (menu_keys), the starter player's when the HUD has no Keys, Esc's added; Keys In Menu off,
	# over the game as they were
	if hud.hint_el.visible:
		return fail("the keys' chips over the game in a game made by hand")
	var said := chip_words(hud.menu_keys())
	if said != ["walk", "run", "use", "pocket", "flashlight", "hold your breath", "menu"]:
		return fail("the pause menu's keys: %s" % [said])
	hud.keys_in_menu = false
	await frames(2)
	if not hud.hint_el.visible or hud.menu_keys() != null:
		return fail("Keys In Menu off: the chips not over the game (%s)" % hud.hint_el.visible)
	print("  BYHAND the keys: none over the game, the pause menu's %s; with Keys In Menu off over the game" % [said])
	# the picture (the user: "make sure the quests align to not be in the black letter boxes (no matter what vhs style or
	# res), should be inside the frame"): under the Look plugin's tape every part at an edge inside its 4:3
	var tape: CanvasLayer = load("res://addons/horrorstudio_look/vhs.gd").new()
	root.add_child(tape)
	var story: CanvasLayer = load("res://starter/story.gd").new()           # the starter's own words (no HSHud for them)
	story.set("use_hud", false)
	root.add_child(story)
	var sanity: Node = load("res://starter/sanity.gd").new()                # and its meter, top right
	root.add_child(sanity)
	var back_thing := Node3D.new()                                         # behind you: its pointer rides the edge
	world.add_child(back_thing)
	back_thing.position = Vector3(0.0, 1.0, 6.0)
	var m3 := HSQuestMarker.new()
	m3.label = "Behind"
	back_thing.add_child(m3)
	var side_thing := Node3D.new()                                         # far to the right: in a wide view, not in the tape's
	world.add_child(side_thing)
	side_thing.position = Vector3(8.0, 1.0, -6.0)
	var m4 := HSQuestMarker.new()
	m4.label = "Side"
	side_thing.add_child(m4)
	hud.log("A note")
	hud.set_stance("crouched")
	hud.line("Somebody's words, long enough to wrap if there were room for them to run all the way across the view, and further still", "Her", 60.0, false)
	hud.panel({"title": "A book", "text": "Its words", "side": true})
	story.call("objective", "Find the key")
	story.call("say", "The Story's own line, the one it draws itself when there is no HUD for it, long enough to need the room", 60.0)
	await frames(150)                                                      # (the pointer comes after a moment out of view)
	var sizes := [Vector2i(1280, 720), Vector2i(1920, 1080), Vector2i(2560, 1080), Vector2i(1024, 768), Vector2i(1280, 1024)]
	var looks := ["camcorder", "camhybrid", "worn", "nightmare", "off"]
	var tried := 0
	for sz in sizes:
		for look in looks:
			root.size = sz
			tape.call("preset", look)
			await frames(4)
			var vs := Vector2(sz)
			var want := Rect2(Vector2.ZERO, vs)
			if look != "off" and vs.x / vs.y > 4.0 / 3.0 + 0.001:
				want = Rect2((vs.x - vs.y * 4.0 / 3.0) * 0.5, 0.0, vs.y * 4.0 / 3.0, vs.y)
			var why := laid_in(hud, story, sanity, want)
			if why != "":
				return fail("%s at %d x %d: %s" % [look, sz.x, sz.y, why])
			var p3: Dictionary = hud.guide.marks.get(str(m3.get_path()), {})
			if p3.is_empty() or float(p3["ptr"]) < 0.05 or not want.grow(-8.0).has_point(p3["edge"]):
				return fail("%s at %d x %d: the pointer to what's behind you (%s) not inside the picture %s" % [look, sz.x, sz.y, p3.get("edge"), want])
			tried += 1
	root.size = Vector2i(2560, 1080)                                       # a thing in the black beside the tape's picture is out of view
	tape.call("preset", "camhybrid")
	await frames(60)
	var on_taped := float((hud.guide.marks.get(str(m4.get_path()), {}) as Dictionary).get("on", 1.0))
	tape.call("preset", "off")
	await frames(60)
	var on_clear := float((hud.guide.marks.get(str(m4.get_path()), {}) as Dictionary).get("on", 0.0))
	if on_taped > 0.05 or on_clear < 0.95:
		return fail("a thing beside the tape's picture: in view %.2f taped (it's in the black), %.2f without the tape" % [on_taped, on_clear])
	tape.call("preset", "camhybrid")
	tape.call("set_strength", 0.0)                                         # (no tape drawn: no bars, the whole view)
	await frames(4)
	if hud.frame_rect() != Rect2(Vector2.ZERO, Vector2(2560, 1080)):
		return fail("the tape at strength 0 still taken as 4:3: %s" % hud.frame_rect())
	print("  BYHAND the picture: %d looks and window sizes, every part at an edge inside it; a thing in the bars out of view (%.2f), in view without the tape (%.2f)" % [tried, on_taped, on_clear])
	print("BYHAND ok")
	quit(0)


# the words of a row of chips (menu_keys): each pair's label after its keys
func chip_words(row: Control) -> Array:
	var out: Array = []
	if row == null:
		return out
	for pair in row.get_children():
		out.append(str(((pair as Node).get_child(1) as Label).text))
	row.free()
	return out


# every part at an edge inside the picture `fr`, its margin from the picture's edge: "" when so, else what isn't
func laid_in(hud: HSHud, story: CanvasLayer, sanity: Node, fr: Rect2) -> String:
	if not hud.frame.is_equal_approx(fr):
		return "the HUD laid in %s, the picture %s" % [hud.frame, fr]
	var parts := {"the objective and the list": [hud.tl, 24.0], "the log": [hud.log_box, 20.0], "the stance": [hud.stance_el, 24.0],
		"the footer": [hud.foot, 0.0], "the keys": [hud.hint_el, 24.0], "the dark round the edge": [hud.vignette, 0.0],
		"the side card": [hud.panel_el, 36.0], "the Story's own objective": [story.get("_top"), 28.0],
		"the Story's own line": [story.get("_line"), 0.0], "the sanity meter": [sanity.get("_bar"), 34.0]}
	for what in parts:
		var c: Control = parts[what][0]
		if c == null:
			return what + ": not there"
		var r := c.get_global_rect()
		var m: float = parts[what][1]
		if r.position.x < fr.position.x - 0.5 or r.end.x > fr.end.x + 0.5:
			return "%s at %.0f..%.0f, outside the picture %.0f..%.0f" % [what, r.position.x, r.end.x, fr.position.x, fr.end.x]
		if what in ["the objective and the list", "the stance", "the Story's own objective"] and absf(r.position.x - (fr.position.x + m)) > 0.5:
			return "%s at %.0f, not %.0f in from the picture's left (%.0f)" % [what, r.position.x, m, fr.position.x]
		if what in ["the log", "the keys", "the side card", "the sanity meter"] and absf(r.end.x - (fr.end.x - m)) > 0.5:
			return "%s ends at %.0f, not %.0f in from the picture's right (%.0f)" % [what, r.end.x, m, fr.end.x]
	return ""
