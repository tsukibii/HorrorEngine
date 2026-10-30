## DIRECTOR's level-alone part (tools/godot_director.py check): the sample's house saved as a scene of its own
## (house.tscn, its root an HSLevel) and played the way F6 plays the open scene: a game made round it, its events
## the whole game's, the player at its start, free to roam (the kitchen's jumpscare still fires after the letter).
## Prints ALONECHECK {...}.
extends SceneTree


## the house's own nodes (owned by the game's root) owned by the house; an instanced model's insides stay its own
func _own(n: Node, from: Node, o: Node) -> void:
	for c in n.get_children():
		if c.owner == from:
			c.owner = o
		_own(c, from, o)


func _initialize() -> void:
	var rep := {}
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
	var hs = null
	for i in 600:
		await process_frame
		for c in root.get_children():
			if c.get_script() != null and str(c.get_script().resource_path).ends_with("story/game.gd"):
				hs = c
		if hs != null and hs.runtime != null and hs.runtime.play != null and hs.runtime.play.active:
			break
	rep["game_made"] = hs != null
	if hs != null and hs.runtime != null and hs.runtime.play != null:
		var rt = hs.runtime.play
		var st: Dictionary = hs.compiled["story"]
		rep["start"] = st["game"]["start"]
		rep["beats"] = st["stitches"].get("free_roam", {}).get("beats", []).map(func(b): return b["id"])
		rep["active"] = rt.active
		rep["at_start"] = rt.player.pos.distance_to(Vector3(0, 0, 1.2)) < 0.3
		rt.flags["read_letter"] = true
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
	print("ALONECHECK " + JSON.stringify(rep))
	quit()
