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
	for lv in levels.values():                        # a checkpoint (the Player category): a moment of its own, an autosave each time it's walked into
		for cp in HSDirector.nodes_of(lv, "HSCheckpoint"):
			var cid := HSDirector.id_of(cp)
			if not (f.get("moments") is Array):
				f["moments"] = []
			(f["moments"] as Array).append({"id": cid + "__checkpoint", "when": {"enter": cid}, "do": [{"checkpoint": true}], "once": false, "every": 5.0})
	_desk(f)
	var sc := HSStoryCompiler.new()
	sc.compile(f, story, levels)
	problems.append_array(sc.problems)
	brain = sc.brain
	brain["rooms"] = _room_map()
	var rests: Array = []                             # each character's own resting face (HSActor.expression): a state that always holds, under the story's
	for lv in levels.values():
		for a in HSDirector.nodes_of(lv, "HSActor"):
			if str(a.expression) != "":
				rests.append({"while": null, "set": {HSDirector.id_of(a): {"expr": str(a.expression)}}})
				if not ResourceLoader.exists("res://faces/loops/%s.tres" % a.expression) and not ResourceLoader.exists("res://faces/%s.tres" % a.expression):
					warn(a, "%s's expression %s isn't in the project's faces/ (the Animate tab's Face side: python tools/godot_director.py faces <project> %s)" % [HSDirector.id_of(a), a.expression, a.expression])
	if rests.size():
		brain["states"] = rests + brain.get("states", [])
	for who in brain.get("talks", {}) if not Engine.is_editor_hint() else {}:   # a person the story talks with: the cursor offers Talk on her (at play)
		for lv in levels.values():
			for a in HSDirector.nodes_of(lv, "HSActor"):
				if HSDirector.id_of(a) == who:
					a.talk = true
	_sounds()
	_check_refs(f)
	return {"story": story, "levels": levels, "problems": problems, "life_things": life_things, "brain": brain}


# ---- a desk game brought in (godot_director.py from-desk) ------------------------------------------------------------
## the file's `desk`: what a desk game has that the Director file doesn't say itself, as the runtime reads it: its
## scenes (the cutscenes its desk items play), lines, sounds, motions, secrets, trigger cutscenes (`interrupts`), and
## more of its items', cast's and game's words; the scene's own (the nodes) come first where both have one
func _desk(f: Dictionary) -> void:
	var dk = f.get("desk")
	if not (dk is Dictionary):
		return
	for k in ["scenes", "lines", "sounds", "motions", "secrets"]:
		if dk.get(k) is Dictionary:
			if not story.has(k) or not (story[k] is Dictionary):
				story[k] = {}
			for id in dk[k]:
				if not story[k].has(id):
					story[k][id] = (dk[k][id] as Variant)
	if dk.get("interrupts") is Array:
		story["interrupts"] = (dk["interrupts"] as Array).duplicate(true)
	for k in ["items", "cast"]:                         # more words on what the nodes made (an item's inspect, a cast member's skin)
		if dk.get(k) is Dictionary:
			for id in dk[k]:
				var mine: Dictionary = story[k].get(id, {})
				for w in dk[k][id]:
					if not mine.has(w):
						mine[w] = dk[k][id][w]
				story[k][id] = mine
	if dk.get("game") is Dictionary:                    # the game's words the HSGame hasn't got (karma's axes, the counters' labels, the words...)
		for w in dk["game"]:
			if not story["game"].has(w) or w in ["karma", "counters", "words"]:
				story["game"][w] = dk["game"][w]


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
		gs["player"] = {"run": bool(g.get("can_run") if g.get("can_run") != null else true), "crouch": bool(g.get("can_crouch") if g.get("can_crouch") != null else true),
			"eye": float(g.get("eye_height") if g.get("eye_height") != null else 1.65)}
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
		if not (cls in ["HSThing", "HSDoor", "HSTrigger", "HSSpot", "HSRoom", "HSActor", "HSPath", "HSPlayerStart", "HSCheckpoint"]):
			continue
		var nid := HSDirector.id_of(n)
		if cls != "HSActor" and seen.has(nid):
			err(n, "two things in %s are called %s: give one another id" % [lid, nid])
		seen[nid] = true
		match cls:
			"HSThing":
				_thing(n)
			"HSActor":
				var cid: String = n.cast_id()
				var c: Dictionary = story["cast"].get(cid, {})
				c["name"] = n.display_name if n.display_name != "" else str(n.name)
				c["height"] = n.height
				if n.studio_character != "":
					c["previs_body"] = "people/" + n.studio_character
				story["cast"][cid] = c
				for m in n.motion_names():
					story["motions"][m] = {"who": cid, "loop": true, "in_place": true, "prompt": "", "secs": 4}
				var mv: Dictionary = n.all_moves()           # her moves (STORY_FORMAT §2 `moves`), the ones she has
				for role in mv.keys():
					if not n.motion_names().has(mv[role]):
						warn(n, "%s's move %s is %s, which she hasn't got: give it to her on the panel's Animate tab" % [nid, role, mv[role]])
						mv.erase(role)
				if mv.size():
					c["moves"] = mv
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
				if float(n.flashlight_battery) > 0.0:             # on batteries (FLASHLIGHT_PLAN §1): its seconds of light, its kind, how full
					story["items"][iid]["torch"] = {"battery": float(n.flashlight_battery) * 60.0, "kind": str(n.flashlight_kind), "charge": float(n.flashlight_charge)}
			elif float(n.batteries) > 0.0:
				story["items"][iid]["battery"] = float(n.batteries)   # a set of batteries: into the pocket
		"note":
			story["notes"][n.note if n.note != "" else HSDirector.id_of(n)] = {"title": n.note_title if n.note_title != "" else str(n.name), "text": n.note_text}
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
		if a is Dictionary and a.has("sound") and str(a["sound"]) != "" and not story["sounds"].has(str(a["sound"])):   # a sound the story names (a desk game's its own file)
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
			if not known.has(k):
				known[k] = {}
			for v in sc[k]:
				known[k][v] = true
	var seen := {}
	var triggers: Array = []
	for q in f.get("quests", []):
		for s in q.get("steps", []):
			triggers.append([s.get("done"), "quest %s's step %s" % [q.get("id"), s.get("id")]])
			triggers.append([s.get("fail"), "quest %s's step %s" % [q.get("id"), s.get("id")]])
		if q.get("egg", false) == true:               # an easter egg's FOUND WHEN names the scene's things too
			triggers.append([q.get("found"), "easter egg %s" % q.get("id")])
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
	_check_clips(f)


## the rooms' map for the brain's walks (On stage's in-between going through doorways, run/brain.gd `way`): each
## place's room (the level's spots, the characters' homes, the seats, the doorways' sides) and each door's two sides
## as a way between the rooms it joins ({places: {spot: room}, links: [[room, room, its side there, its side here]]})
func _room_map() -> Dictionary:
	var places := {}
	var links: Array = []
	var up := Vector3(0, 0.5, 0)
	for lv in levels.values():
		var rooms: Array = HSDirector.nodes_of(lv, "HSRoom")
		var room_at := func(p: Vector3) -> String:
			for r in rooms:
				if r.holds(p + up):
					return HSDirector.id_of(r)
			return ""
		for n in HSDirector.nodes_of(lv, "HSSpot"):
			places[HSDirector.id_of(n)] = room_at.call(n.global_position)
		for a in HSDirector.nodes_of(lv, "HSActor"):
			places[a.home_id()] = room_at.call(a.global_position)
		for t in HSDirector.nodes_of(lv, "HSThing"):
			if str(t.get("use")) == "sit":
				places[HSDirector.id_of(t)] = room_at.call(t.global_position)
		for d in HSDirector.nodes_of(lv, "HSDoor"):
			var z: Vector3 = d.global_transform.basis.z.normalized() * HSLevel.DOORWAY
			var did := HSDirector.id_of(d)
			var a_room: String = room_at.call(d.global_position + z)
			var b_room: String = room_at.call(d.global_position - z)
			places[did + "__in"] = a_room
			places[did + "__out"] = b_room
			if a_room != "" and b_room != "" and a_room != b_room:
				links.append([a_room, b_room, did + "__in", did + "__out"])
	return {"places": places, "links": links}


## a clip the story plays on someone (`anim`, a jumpscare's figure's `clip`) that she hasn't got on her: the library's
## (core/library.gd) given to her on the Animate tab, or not in the project at all
func _check_clips(f: Dictionary) -> void:
	var hers := {}
	for lv in levels.values():
		for a in HSDirector.nodes_of(lv, "HSActor"):
			hers[a.cast_id()] = a.motion_names()
	var lib := HSLibrary.ids()
	var seen := {}
	var todo: Array = [f]
	while todo.size():
		var o = todo.pop_back()
		if o is Array:
			todo.append_array(o)
		elif o is Dictionary:
			var who0 = o.get("anim") if o.get("anim") is String else (o.get("figure") if o.get("trick") == "jumpscare" else null)   # a jumpscare's figure plays its clip
			if who0 is String and o.get("clip") is String and hers.has(who0) and str(o["clip"]) != "":
				var who := str(who0)
				var clip := str(o["clip"])
				if not (hers[who] as Array).has(clip) and not seen.has(who + "/" + clip):
					seen[who + "/" + clip] = true
					warn(game, "the story animates %s with %s, which she hasn't got: %s" % [who, clip,
						"give it to her on the panel's Animate tab (Hers, for the story to play)" if lib.has(clip) else "no clip of that name in res://animations/ either"])
			todo.append_array(o.values())
