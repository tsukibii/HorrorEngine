## The scene's nodes as the story the runtime plays (docs/GODOT_DIRECTOR.md §5): the HSGame's settings, its levels
## (each HSLevel: its start, its paths as routes, its rooms), the cast (HSActor), the items and notes (HSThing), the
## steps in the tree's order as the flow (HSTask a stitch with its to-dos and events as beats, HSDialogue a live
## scene, HSChoice a choice, HSEnding an ending; a chapter's card before its first step), the events that listen
## through the whole game or a chapter put in every task they cover. What's wrong or missing is a problem with the
## node it's about (the dock's Check, the console when the game starts).
@tool
class_name HSCompiler
extends RefCounted

var game: Node = null
var story: Dictionary = {}
var levels: Dictionary = {}            # level id -> its HSLevel node
var problems: Array = []               # {node, text, error}
var steps: Array = []                  # the flow's steps in order (nodes)
var ids: Dictionary = {}               # a step node -> its flow id
var _events_global: Array = []         # [event, scope node or null]
var _used_ids: Dictionary = {}


func err(n: Node, text: String) -> void:
	problems.append({"node": n, "text": text, "error": true})


func warn(n: Node, text: String) -> void:
	problems.append({"node": n, "text": text, "error": false})


## the whole game under an HSGame (or one level played alone)
func compile(g: Node, alone: Node = null) -> Dictionary:
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
	_collect_steps(g if alone == null else null)
	_flow()
	_check_refs()
	return {"story": story, "levels": levels, "problems": problems}


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


func _item(iid: String, nm: String) -> void:
	if iid == "":
		return
	var it: Dictionary = story["items"].get(iid, {})
	if nm != "" or not it.has("name"):
		it["name"] = nm if nm != "" else iid.replace("_", " ").capitalize()
	story["items"][iid] = it


# ---- the steps --------------------------------------------------------------------------------------------------
func _collect_steps(root: Node) -> void:
	if root == null:
		return
	for c in root.get_children():
		var cls := HSDirector.class_of(c)
		if cls == "HSLevel":
			_walk_events(c, null)
			continue
		if cls in HSDirector.STEPS:
			steps.append(c)
			var sid := HSDirector.id_of(c)
			if _used_ids.has(sid):
				err(c, "two steps are called %s: give one another id" % sid)
				sid = "%s_%d" % [sid, steps.size()]
			_used_ids[sid] = true
			ids[c] = sid
			continue
		if cls == "HSEvent":
			_events_global.append([c, _scope_of(c)])
			continue
		_collect_steps(c)


## events in a level (in its triggers, rooms, things): they listen through the whole game
func _walk_events(n: Node, scope) -> void:
	for c in n.get_children():
		if HSDirector.class_of(c) == "HSEvent":
			_events_global.append([c, scope])
		_walk_events(c, scope)


## the chapter an event listens through (null: the whole game)
func _scope_of(ev: Node):
	var p := ev.get_parent()
	while p != null and p != game:
		if HSDirector.class_of(p) == "HSChapter":
			return p
		p = p.get_parent()
	return null


func _chapter_of(n: Node):
	var p := n.get_parent()
	while p != null and p != game:
		if HSDirector.class_of(p) == "HSChapter":
			return p
		p = p.get_parent()
	return null


func _flow_id(path_from: Node, np: NodePath) -> String:
	if np.is_empty():
		return ""
	var t = path_from.get_node_or_null(np)
	if t == null:
		err(path_from, "%s points at %s, which isn't there" % [HSDirector.id_of(path_from), str(np)])
		return ""
	if not ids.has(t):
		err(path_from, "%s points at %s, which isn't a step (a task, dialogue, choice or ending)" % [HSDirector.id_of(path_from), t.name])
		return ""
	return ids[t]


func _level_id(n: Node, np: NodePath) -> String:
	if np.is_empty():
		return ""
	var t = n.get_node_or_null(np)
	if t == null or HSDirector.class_of(t) != "HSLevel":
		err(n, "%s's level isn't an HSLevel" % HSDirector.id_of(n))
		return ""
	return HSDirector.id_of(t)


func _flow() -> void:
	var flow: Dictionary = story["flow"]
	var first_level: String = levels.keys()[0] if levels.size() else ""
	if steps.is_empty():                       # no story yet: a free roam of the first level with every event
		var roam := Node.new()
		roam.name = "free_roam"
		steps.append(roam)
		ids[roam] = "free_roam"
		story["stitches"]["free_roam"] = {"title": "Free roam", "level": first_level, "beats": [{"id": "free_roam__start", "when": {"start": true}, "do": [{"objective": ""}]}]}
		_add_events(story["stitches"]["free_roam"], roam)
		flow["free_roam"] = {"type": "stitch", "ref": "free_roam", "next": null}
		story["game"]["start"] = "free_roam"
		roam.free()
		return
	var cur_level := first_level
	var chapters_done := {}
	var cards := {}                               # a step -> the chapter card that comes before it
	var start := ""
	for i in steps.size():
		var s: Node = steps[i]
		var sid: String = ids[s]
		var cls := HSDirector.class_of(s)
		var nxt := ""
		if i + 1 < steps.size() and cls != "HSEnding":
			nxt = ids[steps[i + 1]]
		var ch = _chapter_of(s)
		var chap_level := _level_id(ch, ch.level) if ch != null else ""
		# a chapter's card before its first step
		if ch != null and not chapters_done.has(ch):
			chapters_done[ch] = true
			if ch.show_card or ch.time() != "":
				var cid := "%s__card" % HSDirector.id_of(ch)
				var card := {"chapter": ch.title}
				if ch.subtitle != "":
					card["sub"] = ch.subtitle
				if ch.time() != "":
					card["time"] = ch.time()
				var lv0 := chap_level if chap_level != "" else cur_level
				if cls == "HSTask" and not s.level.is_empty():
					lv0 = _level_id(s, s.level)
				story["stitches"][cid] = {"title": ch.title, "level": lv0, "beats": [{"id": cid + "__start", "when": {"start": true},
					"do": ([card] if ch.show_card else []) + ([{"chapter": "", "time": ch.time(), "secs": 0.1, "save": false}] if not ch.show_card else []) + [{"done": true}]}]}
				flow[cid] = {"type": "stitch", "ref": cid, "next": sid}
				cards[sid] = cid
				if start == "":
					start = cid
		if start == "":
			start = sid
		match cls:
			"HSTask":
				var lv := _level_id(s, s.level)
				cur_level = lv if lv != "" else (chap_level if chap_level != "" else cur_level)
				var to := _flow_id(s, s.next)
				story["stitches"][sid] = _stitch(s, sid, cur_level)
				flow[sid] = {"type": "stitch", "ref": sid, "next": to if to != "" else (nxt if nxt != "" else null)}
			"HSDialogue":
				var lv := _level_id(s, s.level)
				cur_level = lv if lv != "" else (chap_level if chap_level != "" else cur_level)
				var to := _flow_id(s, s.next)
				story["scenes"][sid] = _scene(s, cur_level)
				flow[sid] = {"type": "scene", "ref": sid, "next": to if to != "" else (nxt if nxt != "" else null)}
			"HSChoice":
				flow[sid] = _choice(s)
			"HSEnding":
				flow[sid] = {"type": "ending", "kind": s.kind, "title": s.title, "text": s.text}
	for sid in cards:
		_redirect(sid, cards[sid])
	story["game"]["start"] = start
	# a step nothing leads to (after an ending, with no option or next pointing at it)
	var reached := {start: true}
	var todo: Array = [start]
	while todo.size():
		var n: String = todo.pop_back()
		for o in _outs(flow.get(n, {})):
			if o != null and o != "" and not reached.has(o):
				reached[o] = true
				todo.append(o)
	for s in steps:
		if not reached.has(ids[s]):
			warn(s, "%s can't be reached: nothing leads to it (an ending ends its way; point an option's go_to or a step's next at it)" % ids[s])


## a chapter's card takes its first step's place wherever the story led to it: a next, an option, a timer, an answer
func _redirect(sid: String, cid: String) -> void:
	for k in story["flow"]:
		var n: Dictionary = story["flow"][k]
		if k == cid:
			continue
		if n.get("next") == sid:
			n["next"] = cid
		for o in n.get("options", []):
			if o.get("to") == sid:
				o["to"] = cid
	for k in story["stitches"]:
		var tm = story["stitches"][k].get("timer")
		if tm is Dictionary and tm.get("fail") == sid:
			tm["fail"] = cid
	for k in story["scenes"]:
		for c in story["scenes"][k].get("clips", []):
			for o in (c.get("reply", {}) as Dictionary).get("options", []):
				var g = o.get("go")
				if g is Dictionary and g.get("node") == sid:
					g["node"] = cid


func _outs(n: Dictionary) -> Array:
	var out: Array = [n.get("next")]
	for o in n.get("options", []):
		out.append(o.get("to"))
	if n.get("type") == "stitch":
		var st: Dictionary = story["stitches"].get(n.get("ref"), {})
		if st.has("timer"):
			out.append(st["timer"].get("fail"))
	if n.get("type") == "scene":
		var sc: Dictionary = story["scenes"].get(n.get("ref"), {})
		for c in sc.get("clips", []):
			for o in (c.get("reply", {}) as Dictionary).get("options", []):
				var g = o.get("go")
				if g is Dictionary and g.has("node"):
					out.append(g["node"])
	return out


# ---- a task -----------------------------------------------------------------------------------------------------
func _stitch(t: Node, sid: String, lid: String) -> Dictionary:
	var st := {"title": t.title, "level": lid, "beats": []}
	if lid == "":
		err(t, "%s has no level to play in" % sid)
	var do: Array = []
	if not t.start_at.is_empty():
		var sp = t.get_node_or_null(t.start_at)
		if sp == null:
			err(t, "%s's start_at isn't there" % sid)
		else:
			do.append({"move": "player", "to": HSDirector.id_of(sp)})
	do.append({"untodo": true})
	do.append({"objective": t.objective})
	var tds: Array = t.todos()
	for td in tds:
		do.append(td.to_story())
	if t.checkpoint:
		do.append({"checkpoint": true})
	st["beats"].append({"id": sid + "__start", "when": {"start": true}, "do": do})
	if t.finish == "todos":
		if tds.is_empty():
			err(t, "%s finishes when its to-dos are ticked, but it has none: add an HSTodo, or set finish to event (an event's Finish task ends it)" % sid)
		else:
			st["beats"].append({"id": sid + "__done", "when": {"ticked": true}, "do": [{"done": true}]})
	if t.time_limit > 0.0:
		var to := _flow_id(t, t.on_timeout)
		st["timer"] = {"secs": t.time_limit, "fail": to if to != "" else null}
		if to == "":
			warn(t, "%s's time runs out into nothing: set on_timeout (a death ending, a chase)" % sid)
	_add_events(st, t)
	if t.finish == "event" and not _finishes(st):
		warn(t, "%s finishes by an event, but none of its events has Finish task" % sid)
	return st


func _finishes(st: Dictionary) -> bool:
	for b in st["beats"]:
		for a in b.get("do", []):
			if a is Dictionary and a.has("done"):
				return true
	return false


## the events listening during a task: its own, its chapter's, the whole game's
func _add_events(st: Dictionary, t: Node) -> void:
	var beats: Dictionary = {}
	var evs: Array = []
	for c in t.get_children():
		if HSDirector.class_of(c) == "HSEvent":
			evs.append(c)
	var ch = _chapter_of(t)
	for pair in _events_global:
		if pair[1] == null or pair[1] == ch:
			evs.append(pair[0])
	for ev in evs:
		beats[HSDirector.id_of(ev)] = HSDirector.id_of(ev)
	for ev in evs:
		var b := {"id": HSDirector.id_of(ev), "when": ev.trigger(beats), "do": []}
		var ifs: Array = ev.conditions()
		if not ev.only_after.is_empty():
			var to := _flow_id(ev, ev.only_after)
			if to != "":
				ifs.append("@" + to)
		var acts: Array = ev.story_actions()
		if acts.is_empty():
			warn(ev, "the event %s does nothing yet: add its actions" % HSDirector.id_of(ev))
		if ev.once:
			var fl := "_fired_" + HSDirector.id_of(ev)
			ifs.append("!" + fl)
			acts.push_front({"flag": fl})
		else:
			b["repeat"] = true
			b["every"] = max(0.1, ev.every)
		if ifs.size():
			b["if"] = ifs
		if ev.optional:
			b["optional"] = true
		b["do"] = acts
		for a in acts:
			_sound_of(a)
		st["beats"].append(b)


func _sound_of(a: Dictionary) -> void:
	if a.has("sound") and str(a["sound"]) != "":
		var s := str(a["sound"])
		story["sounds"][s] = {"file": s if s.begins_with("res://") else "sfx/" + s}


# ---- a dialogue -------------------------------------------------------------------------------------------------
func _scene(d: Node, lid: String) -> Dictionary:
	var sc := {"title": d.title, "level": lid, "camera": {"mode": "live"}, "clips": [], "cues": []}
	var lines: Array = d.lines()
	if lines.is_empty():
		err(d, "%s has no lines: add HSLine children" % ids.get(d, ""))
	var look: String = d.look_at
	var k := 0
	for ln in lines:
		k += 1
		var cid := "c%d" % k
		var clip := {"id": cid, "en": ln.text}
		if ln.who == "" or ln.who == "player":
			clip["who"] = "player"
			clip["think"] = true
		else:
			clip["who"] = ln.who
			if look == "":
				look = ln.who
			if not story["cast"].has(ln.who):
				warn(ln, "%s says a line, but there's no character %s in a level" % [ln.who, ln.who])
		if ln.act != "":
			clip["act"] = ln.act
		for a in ln.actions:
			if a != null:
				for x in a.to_story():
					if not x.has("wait"):
						sc["cues"].append({"at": {"clip": cid, "edge": "start"}, "do": x})
						_sound_of(x)
		var opts: Array = ln.options()
		if opts.size():
			var rp := {"options": []}
			for o in opts:
				var od := {"id": o.option_id(), "label": o.label}
				if o.think != "":
					od["think"] = o.think
				var sets: Array = []
				for f in o.set_flags:
					if f != "":
						sets.append({"flag": f})
				if o.karma != 0.0:
					sets.append({"karma": o.karma})
				if sets.size():
					od["sets"] = sets
				var th: Array = []
				for r in o.reply_lines:
					if r != "":
						th.append({"en": r})
				if th.size():
					od["then"] = th
				var to := _flow_id(o, o.go_to)
				if to != "":
					od["go"] = {"node": to}
				rp["options"].append(od)
			if opts.size() > 2:
				warn(ln, "more than two answers: the game shows two at most on its line (DECISIONS 2026-10-30)")
			clip["reply"] = rp
		sc["clips"].append(clip)
	if look != "":
		sc["camera"]["look"] = look
	return sc


# ---- a choice ---------------------------------------------------------------------------------------------------
func _choice(c: Node) -> Dictionary:
	var n := {"type": "choice", "title": c.title, "options": []}
	var opts: Array = c.options()
	if opts.is_empty():
		err(c, "%s has no options: add HSOption children, each with go_to" % ids.get(c, ""))
	match c.by:
		"act":
			n["by"] = "act"
			if c.prompt != "":
				n["prompt"] = c.prompt
		"karma":
			n["by"] = "karma"
		_:
			n["by"] = "flag"
	for o in opts:
		var to := _flow_id(o, o.go_to)
		if to == "":
			err(o, "the option %s goes nowhere: set its go_to" % o.label)
		var od := {"to": to if to != "" else null, "label": o.label}
		match c.by:
			"act":
				if o.when == null:
					err(o, "the option %s of a choice by act needs its when" % o.label)
				else:
					od["when"] = o.when.to_story()
			"karma":
				if o.karma_min > -INF:
					od["min"] = o.karma_min
				if o.karma_max < INF:
					od["max"] = o.karma_max
			_:
				var ifs: Array = []
				for f in o.if_flags:
					if f != "":
						ifs.append(f)
				od["if"] = ifs
		n["options"].append(od)
	return n


# ---- references -------------------------------------------------------------------------------------------------
## ids named and never made: an event's area, thing or item; flags checked and never set
func _check_refs() -> void:
	var known := {}
	for k in HSDirector.KINDS:
		known[k] = {}
	for lv in levels.values():
		var sc := HSDirector.scan(lv)
		for k in sc:
			for v in sc[k]:
				known[k][v] = true
	if game != null:
		var gs := HSDirector.scan(game)
		for k in gs:
			for v in gs[k]:
				known[k][v] = true
	var set_flags := {}
	var checked := {}
	for st_id in story["stitches"]:
		for b in story["stitches"][st_id]["beats"]:
			for a in b.get("do", []):
				if a is Dictionary and a.has("flag"):
					set_flags[str(a["flag"])] = true
				if a is Dictionary and a.has("ask"):
					for o in a.get("options", []):
						for x in o.get("do", []):
							if x.has("flag"):
								set_flags[str(x["flag"])] = true
			for f in b.get("if", []):
				var s := str(f).lstrip("!")
				if not s.begins_with("item:") and not s.begins_with("@") and not s.begins_with("_fired_"):
					checked[s] = b["id"]
	for sid in story["scenes"]:
		for c in story["scenes"][sid]["clips"]:
			for o in (c.get("reply", {}) as Dictionary).get("options", []):
				for x in o.get("sets", []):
					if x.has("flag"):
						set_flags[str(x["flag"])] = true
	for t in levels.values():
		for n in HSDirector.nodes_of(t, "HSThing"):
			if n.use in ["code", "use_item"]:
				set_flags[n.data().get("then", "")] = true
	for k in story["flow"]:
		for o in story["flow"][k].get("options", []):
			for f in o.get("if", []):
				checked[str(f).lstrip("!")] = k
	for f in checked:
		if not set_flags.has(f):
			warn(game, "the flag %s is checked (%s) but nothing sets it" % [f, checked[f]])
	for pair in _events_global:
		var ev: Node = pair[0]
		var w = ev.trigger({})
		for key in ["enter", "exit"]:
			if w.has(key) and not known["area"].has(str(w[key])):
				warn(ev, "the event %s waits for the player in %s, which isn't an area (an HSTrigger or HSRoom)" % [HSDirector.id_of(ev), w[key]])
		if w.has("use") and not known["thing"].has(str(w["use"])):
			warn(ev, "the event %s waits for %s to be used, which isn't a thing here" % [HSDirector.id_of(ev), w["use"]])
