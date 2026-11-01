## The game at play (docs/GODOT_DIRECTOR.md §5): the world from the scene's nodes (the HSGame's settings, its levels:
## each HSLevel's start, paths, rooms; the cast, HSActor; the items and notes, HSThing; the little things) and the story
## from the Director file (story/story_compile.gd: its quests, moments, conversations and endings as the runtime's
## flow, stitches and scenes, and what the brain keeps: conditions, conversations, states, achievements). What's wrong
## or missing is a problem (the dock's Check, the console when the game starts), with its node when it's the scene's.
@tool
class_name HSCompiler
extends RefCounted

var game: Node = null
var story: Dictionary = {}
var levels: Dictionary = {}            # level id -> its HSLevel node
var problems: Array = []               # {node, text, error}
var life_things: Dictionary = {}       # the little things (HSThing's life use): {id: {life, d}}, as game/life_things.json
var brain: Dictionary = {}             # the story compiler's: conds, talks, states, achievements, quests, steps


func err(n: Node, text: String) -> void:
	problems.append({"node": n, "text": text, "error": true})


func warn(n: Node, text: String) -> void:
	problems.append({"node": n, "text": text, "error": false})


## the whole game under an HSGame with its story (the Director file read: HSStoryFile.read), or one level played
## alone (F6: a free roam with the story's moments, conversations and states)
func compile(g: Node, alone: Node = null, file: Dictionary = {}) -> Dictionary:
	game = g
	story = {"format": 3, "cast": {}, "items": {}, "notes": {}, "lines": {}, "sounds": {}, "motions": {}, "levels": {}, "scenes": {},
		"stitches": {}, "flow": {}, "interrupts": [], "secrets": {}, "achievements": {}}
	var lvl_nodes: Array = [alone] if alone != null else HSDirector.nodes_of(g, "HSLevel")
	if lvl_nodes.is_empty():
		err(g, "no level: add an HSLevel (the dock's Add tab, Level) with a room in it")
	for lv in lvl_nodes:
		var lid := HSDirector.id_of(lv)
		if levels.has(lid):
			err(lv, "two levels are called %s" % lid)
			continue
		levels[lid] = lv
		story["levels"][lid] = lv.as_story()
		_level_things(lv, lid)
	_game_settings(g)
	if file.has("_error"):
		err(g, str(file["_error"]))
		file = HSStoryFile.EMPTY.duplicate(true)
	var f := file.duplicate(true)
	if alone != null:
		f["quests"] = []
	var sc := HSStoryCompiler.new()
	sc.compile(f, story, levels)
	problems.append_array(sc.problems)
	brain = sc.brain
	for who in brain.get("talks", {}) if not Engine.is_editor_hint() else {}:   # a person the story talks with: the cursor offers Talk on her (at play)
		for lv in levels.values():
			for a in HSDirector.nodes_of(lv, "HSActor"):
				if HSDirector.id_of(a) == who:
					a.talk = true
	_sounds()
	_check_refs(f)
	return {"story": story, "levels": levels, "problems": problems, "life_things": life_things, "brain": brain}


# ---- the game -------------------------------------------------------------------------------------------------
func _game_settings(g: Node) -> void:
	var gs := {"id": HSDirector.snake(str(g.get("title") if g != null and g.get("title") else "game")), "title": str(g.get("title") if g != null else "Game"),
		"voice": "none", "text": "en", "collision": "physics", "track_steps": true, "director": true,
		"karma": {"axes": {"karma": {"min": -10, "max": 10, "label": "karma"}}}}
	if g != null:
		gs["player_name"] = g.player_name
		gs["time"] = g.time_of_day
		gs["fov"] = g.fov
		gs["look"] = g.look
		gs["vhs"] = g.vhs
		gs["grade"] = g.grade
		gs["ui_theme"] = g.ui_theme
		gs["lighting"] = g.lighting
		gs["weather"] = g.weather
		var cs := {}
		for k in g.counters:
			if k != "":
				cs[k] = {"label": k.replace("_", " ")}
		gs["counters"] = cs
	story["game"] = gs


# ---- what's in the levels ---------------------------------------------------------------------------------------
func _level_things(lv: Node, lid: String) -> void:
	var seen := {}
	for n in lv.find_children("*", "", true, false):
		var cls := HSDirector.class_of(n)
		if not (cls in ["HSThing", "HSDoor", "HSTrigger", "HSSpot", "HSRoom", "HSActor", "HSPath"]):
			continue
		var nid := HSDirector.id_of(n)
		if cls != "HSActor" and seen.has(nid):
			err(n, "two things in %s are called %s: give one another id" % [lid, nid])
		seen[nid] = true
		match cls:
			"HSThing":
				_thing(n)
			"HSActor":
				var c: Dictionary = story["cast"].get(nid, {})
				c["name"] = n.display_name if n.display_name != "" else str(n.name)
				c["height"] = n.height
				if n.studio_character != "":
					c["previs_body"] = "people/" + n.studio_character
				story["cast"][nid] = c
				for m in n.motion_names():
					story["motions"][m] = {"who": nid, "loop": true, "in_place": true, "prompt": "", "secs": 4}
				if n.behaviour in ["path", "patrol"] and n.get_node_or_null(n.path) == null and n.patrol.is_empty():
					warn(n, "%s walks a path, but none is set: she'll stand" % nid)
			"HSDoor":
				if n.locked_by != "" and not n.locked_by.begins_with("flag:"):
					_item(n.locked_by, "")
			"HSPath":
				if n.points().size() < 2:
					warn(n, "the path %s has fewer than two points: select it, Add Point, click on the floor (or give it HSSpot children)" % nid)


func _thing(n: Node) -> void:
	match n.use:
		"pickup", "carry":
			var iid: String = n.item_id()
			_item(iid, n.item_name if n.item_name != "" else n.display_name)
			if n.flashlight:
				story["items"][iid]["torch"] = true
		"note":
			story["notes"][HSDirector.id_of(n)] = {"title": n.note_title if n.note_title != "" else str(n.name), "text": n.note_text}
		"use_item":
			if n.needs_item == "":
				err(n, "%s needs an item to be used on it (needs_item)" % HSDirector.id_of(n))
			else:
				_item(n.needs_item, "")
		"clean":
			if n.clean_with != "":
				_item(n.clean_with, "")
		"life":
			if not n.life_ok():
				err(n, "%s's life %s isn't one of lives.json's" % [HSDirector.id_of(n), n.life])
			else:
				life_things[HSDirector.id_of(n)] = {"life": n.life, "d": n.data()}


func _item(iid: String, nm: String) -> void:
	if iid == "":
		return
	var it: Dictionary = story["items"].get(iid, {})
	if nm != "" or not it.has("name"):
		it["name"] = nm if nm != "" else iid.replace("_", " ").capitalize()
	story["items"][iid] = it


# ---- references -------------------------------------------------------------------------------------------------
## the shelf's sounds the story plays, as the runtime finds them
func _sounds() -> void:
	var acts: Array = []
	for sid in story["stitches"]:
		for b in story["stitches"][sid]["beats"]:
			acts.append_array(b.get("do", []))
	for sid in story["scenes"]:
		for c in story["scenes"][sid].get("cues", []):
			acts.append(c.get("do", {}))
	for a in acts:
		if a is Dictionary and a.has("sound") and str(a["sound"]) != "":
			var s := str(a["sound"])
			story["sounds"][s] = {"file": s if s.begins_with("res://") else "sfx/" + s}


## what the story names that the scene hasn't got: an area walked into, a thing used, an item, a note, a person
func _check_refs(f: Dictionary) -> void:
	var known := {}
	for k in HSDirector.KINDS:
		known[k] = {}
	for lv in levels.values():
		var sc := HSDirector.scan(lv)
		for k in sc:
			for v in sc[k]:
				known[k][v] = true
	var seen := {}
	var triggers: Array = []
	for q in f.get("quests", []):
		for s in q.get("steps", []):
			triggers.append([s.get("done"), "quest %s's step %s" % [q.get("id"), s.get("id")]])
			triggers.append([s.get("fail"), "quest %s's step %s" % [q.get("id"), s.get("id")]])
	for m in f.get("moments", []):
		triggers.append([m.get("when"), "moment %s" % m.get("id", "")])
	while triggers.size():
		var pair: Array = triggers.pop_back()
		var w = pair[0]
		if not (w is Dictionary):
			continue
		for k in ["all", "any"]:
			if w.get(k) is Array:
				for x in w[k]:
					triggers.append([x, pair[1]])
		for k in [["enter", "area"], ["exit", "area"], ["use", "thing"], ["pickup", "item"], ["read", "note"], ["state", "life"]]:
			if w.has(k[0]) and not known[k[1]].has(str(w[k[0]])) and not seen.has(str(w[k[0]])):
				seen[str(w[k[0]])] = true
				warn(game, "%s waits for %s %s, which isn't in the scene (no %s with that id)" % [pair[1], k[0], w[k[0]], k[1]])
		if w.has("gave") and not known["actor"].has(str(w.get("to", ""))):
			warn(game, "%s waits for something given to %s, who isn't a character in the scene" % [pair[1], w.get("to", "")])
	for st in f.get("states", []):
		if st is Dictionary and st.get("set") is Dictionary:
			for target in st["set"]:
				var there := false
				for k in ["actor", "thing", "door", "light", "life"]:
					if known[k].has(target):
						there = true
				if not there and not seen.has(target):
					seen[target] = true
					warn(game, "a state sets %s, which isn't in the scene (a character, a thing, a door or a light)" % target)
