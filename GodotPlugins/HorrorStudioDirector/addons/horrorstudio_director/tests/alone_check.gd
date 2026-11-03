## DIRECTOR's test runs (tools/godot_director.py check), one a run (`-- --mode=...`):
##   alone: the sample's house saved as a scene of its own (house.tscn, its root an HSLevel) and played the way F6
##          plays the open scene: a game made round it, its events the whole game's, the player at its Test start
##          with what it starts with, free to roam (the kitchen's jumpscare still fires after the letter; the bedroom's
##          checkpoint autosaves when it's walked into);
##   test:  the whole game played from the panel's Test start (the play-from-here file's `test`): its first quest, the
##          player at the Test start (not sent to the quest's own start) with the bedroom key;
##   near:  the panel's Try it (`near`): the player in front of the letter, facing it;
##   egg:   the game from the drink errand with the bedroom key: the cat's eyes found (an easter egg any time: its
##          thought, its fact, the errand still on), then the bedroom walked into early: the egg straight to bed (its
##          thought), the story jumping to the night, the errand, the talk and the bedroom's quest skipped.
## Prints ALONECHECK {...}.
extends SceneTree

const RUN_FILE := "user://hs_director_run.json"


## the house's own nodes (owned by the game's root) owned by the house; an instanced model's insides stay its own
func _own(n: Node, from: Node, o: Node) -> void:
	for c in n.get_children():
		if c.owner == from:
			c.owner = o
		_own(c, from, o)


func _initialize() -> void:
	var mode := "alone"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--mode="):
			mode = a.substr(7)
	var rep := {"mode": mode}
	if mode == "alone":
		var game: Node = (load("res://main.tscn") as PackedScene).instantiate()
		var house: Node = game.get_node("House")
		game.remove_child(house)
		_own(house, game, house)
		var ps := PackedScene.new()
		ps.pack(house)
		ResourceSaver.save(ps, "res://house.tscn")
		house.free()
		game.free()
		change_scene_to_file("res://house.tscn")
	else:
		var req := {"from": "q_drink", "items": ["bedroom_key"]} if mode == "egg" else {"test": true}
		if mode == "near":
			req["near"] = {"level": "house", "pos": [-0.4, 0.0, 1.0], "yaw": -90.0}   # in front of the letter, facing it (panel.gd play_near)
		var f := FileAccess.open(RUN_FILE, FileAccess.WRITE)
		f.store_string(JSON.stringify(req))
		f.close()
		change_scene_to_file("res://main.tscn")
	var hs = null
	for i in 900:
		await process_frame
		for c in root.get_children():
			if c.get_script() != null and str(c.get_script().resource_path).ends_with("story/game.gd"):
				hs = c
		var rt0 = hs.runtime.play if hs != null and hs.runtime != null else null
		if rt0 != null and rt0.active and (mode == "alone" or (hs.runtime.run != null and (hs.runtime.run["trail"] as Array).has("q_drink" if mode == "egg" else "q_key"))):
			break
	rep["game_made"] = hs != null
	if hs == null or hs.runtime == null or hs.runtime.play == null:
		print("ALONECHECK " + JSON.stringify(rep))
		quit()
		return
	for i in 30:                                      # the quest's start beat run (a move would have happened by now)
		await process_frame
	var rt = hs.runtime.play
	var st: Dictionary = hs.compiled["story"]
	rep["start"] = st["game"]["start"]
	rep["active"] = rt.active
	rep["at"] = [snappedf(rt.player.pos.x, 0.01), snappedf(rt.player.pos.y, 0.01), snappedf(rt.player.pos.z, 0.01)]
	rep["yaw"] = snappedf(float(rt.player.yaw), 0.1)
	rep["items"] = rt.items.keys()
	rep["level_start"] = st["levels"]["house"]["start"]
	rep["file_gone"] = not FileAccess.file_exists(RUN_FILE)
	if mode == "alone":
		rep["beats"] = st["stitches"].get("free_roam", {}).get("beats", []).map(func(b): return b["id"])
		rep["at_test_start"] = rt.player.pos.distance_to(Vector3(-1.2, 0, -1.0)) < 0.3 and absf(wrapf(float(rt.player.yaw) - 90.0, -180.0, 180.0)) < 5.0
		rt.flags["read:letter"] = true                # the fact the jumpscare moment asks for (the Director file's, read for a level alone too)
		rt.door("kitchen_door", "open")
		for i in 60:
			await process_frame
		rt.place(Vector3(1.8, 0, 0.8), 0.0, 0.0)          # outside the doorway's area, walked in (placing a player inside isn't entering)
		rt.key_event("W", true)
		for i in 240:
			await process_frame
			if rt.flags.has("saw_figure"):
				break
		rt.key_event("W", false)
		rep["scare"] = rt.flags.has("saw_figure")
		var before: int = rt.hud.logs.count("checkpoint")   # the bedroom's checkpoint: walked into, an autosave
		rt.door("bedroom_door", "open")
		for i in 60:
			await process_frame
		rt.place(Vector3(-1.2, 0, -1.4), 90.0, 0.0)          # in the hall, facing the bedroom (north)
		rt.key_event("W", true)
		for i in 240:
			await process_frame
			if rt.hud.logs.count("checkpoint") > before:
				break
		rt.key_event("W", false)
		rep["checkpoint"] = rt.hud.logs.count("checkpoint") > before
	elif mode == "egg":
		var has := func(fl: String) -> bool: return rt.flags.has(fl) or (hs.runtime.run["flags"] as Dictionary).has(fl)
		rep["egg_jump"] = (st.get("interrupts", []) as Array).any(func(it): return it.get("id") == "egg_egg_early" and it.get("during") == ["q_drink"] and it.get("to") == "q_night")
		rt.emit({"type": "use", "id": "ornament"})     # the cat's eyes: found any time, a thought, the errand still on
		for i in 600:
			await process_frame
			if has.call("done:egg_cat"):
				break
		rep["egg_cat"] = has.call("done:egg_cat") and hs.runtime.hud.lines_shown.any(func(l): return str(l).contains("looking at me")) \
			and not (hs.runtime.run["trail"] as Array).has("q_talk")
		rt.emit({"type": "enter", "id": "bedroom"})    # straight to bed: the errand skipped, the story on at the night
		for i in 900:
			await process_frame
			if (hs.runtime.run["trail"] as Array).has("q_night"):
				break
		var tr: Array = hs.runtime.run["trail"]
		rep["trail"] = tr
		rep["egg_skip"] = tr.has("q_night") and not tr.has("q_talk") and not tr.has("q_bedroom") and has.call("done:egg_early")
		rep["egg_thought"] = hs.runtime.hud.lines_shown.any(func(l): return str(l).contains("Mari can wait"))
	else:
		rep["trail"] = hs.runtime.run["trail"]
		rep["todo"] = hs.runtime.hud.tasks.map(func(t): return str(t["id"]))
		var beat: Array = st["stitches"]["q_key"]["beats"].filter(func(b): return b["id"] == "q_key__start")
		rep["start_move"] = (beat[0]["do"] as Array).any(func(a): return a is Dictionary and a.has("move")) if beat.size() else null
		if mode == "test":
			rep["here"] = rt.player.pos.distance_to(Vector3(-1.2, 0, -1.0)) < 0.3 and absf(wrapf(float(rt.player.yaw) - 90.0, -180.0, 180.0)) < 5.0
		else:
			rep["here"] = rt.player.pos.distance_to(Vector3(-0.4, 0, 1.0)) < 0.3 and absf(wrapf(float(rt.player.yaw) - 180.0, -180.0, 180.0)) < 5.0
	print("ALONECHECK " + JSON.stringify(rep))
	quit()
