@tool
class_name HSStoryCompiler
extends RefCounted
## The Director file (`director/director.json`, docs/GODOT_DIRECTOR.md §2) into the story the runtime plays, beside
## the world the scene's nodes make (compile.gd): its quests one at a time as stitches (their steps the to-do list,
## listening only while the quest is on), what comes next by condition (a choice by flags), its moments as beats, each
## person's conversations as live scenes, its endings. What the runtime can't read (a condition over facts, which
## conversation a person offers, the states, the achievements) goes to the brain (run/brain.gd): every condition is
## one flag of its own (`?c<n>`), kept true or false by the brain, so the runtime's beats, choices, lines and answers
## read it as a plain flag.
##
## Triggers (`when`, a step's `done` and `fail`) and actions (`do`, `on_start`, `on_done`, a line's `do`) are the story
## format's own (STORY_FORMAT §4), passed through; `{"holds": <condition>}` as a trigger fires when it becomes true.

var story: Dictionary = {}
var file: Dictionary = {}
var problems: Array = []              # {node: null, text, error}
var brain := {"conds": {}, "talks": {}, "states": [], "achievements": [], "quests": [], "steps": {}}
var _conds := {}                      # a condition's key -> its flag
var _entry := {}                      # a quest's id -> where the flow enters it (its card first, if it has one)
var _ends := {}                       # ending ids
var _actor_level := {}                # a person's id -> the level she's in
var _first_level := ""


func err(text: String) -> void:
	problems.append({"node": null, "text": text, "error": true})


func warn(text: String) -> void:
	problems.append({"node": null, "text": text, "error": false})


## the file's flag for a condition: one per distinct condition, however often it's asked
func flag_for(c) -> String:
	var k := HSCond.key(c)
	if not _conds.has(k):
		_conds[k] = "?c%d" % _conds.size()
		brain["conds"][_conds[k]] = c
	return _conds[k]


func compile(f: Dictionary, st: Dictionary, levels: Dictionary) -> void:
	file = f
	story = st
	_first_level = levels.keys()[0] if levels.size() else ""
	for lid in levels:
		for a in HSDirector.nodes_of(levels[lid], "HSActor"):
			if not _actor_level.has(HSDirector.id_of(a)):
				_actor_level[HSDirector.id_of(a)] = lid
	var quests: Array = file.get("quests", [])
	for e in file.get("endings", []):
		_ends[str(e.get("id", ""))] = true
		story["flow"][str(e["id"])] = {"type": "ending", "kind": str(e.get("kind", "neutral")), "title": str(e.get("title", "")), "text": str(e.get("text", ""))}
	var seen := {}
	for q in quests:
		var qid := str(q.get("id", ""))
		if qid == "" or seen.has(qid) or _ends.has(qid):
			err("quest %s: give every quest an id of its own (not an ending's)" % qid)
		seen[qid] = true
		_entry[qid] = (qid + "__card") if q.get("card") is Dictionary else qid
	_talks()
	var lvl := _first_level
	for i in quests.size():
		lvl = _quest(quests[i], i, quests, lvl)
	if quests.is_empty():
		_roam()
	else:
		story["game"]["start"] = _entry[str(quests[0]["id"])]
	brain["states"] = file.get("states", []).duplicate(true)
	for s in brain["states"]:
		if not (s is Dictionary) or not (s.get("set") is Dictionary):
			err("a state needs `set`: who or what, and how ({\"while\": ..., \"set\": {\"mari\": {\"at\": \"kitchen\"}}})")
	brain["achievements"] = file.get("achievements", []).duplicate(true)
	_reached()


## no quests yet: a free roam of the first level with the moments, the conversations and the states
func _roam() -> void:
	var st := {"title": "Free roam", "level": _first_level, "beats": [{"id": "free_roam__start", "when": {"start": true}, "do": [{"objective": ""}]}]}
	_moments(st, "")
	_talk_beats(st)
	story["stitches"]["free_roam"] = st
	story["flow"]["free_roam"] = {"type": "stitch", "ref": "free_roam", "next": null}
	story["game"]["start"] = "free_roam"


# ---- a quest ----------------------------------------------------------------------------------------------------
func _quest(q: Dictionary, i: int, quests: Array, lvl: String) -> String:
	var qid := str(q["id"])
	var map := str(q.get("map", ""))
	if map != "":
		if not story["levels"].has(map):
			err("quest %s: its map %s isn't a level (an HSLevel's id)" % [qid, map])
		else:
			lvl = map
	var st := {"title": str(q.get("title", qid)), "level": lvl, "beats": []}
	var steps: Array = q.get("steps", [])
	var do: Array = []
	if str(q.get("start_at", "")) != "":
		do.append({"move": "player", "to": str(q["start_at"])})
	do.append({"untodo": true})
	do.append({"objective": str(q.get("objective", ""))})
	var sids := []
	for s in steps:
		var sid := str(s.get("id", ""))
		if sid == "":
			err("quest %s: a step with no id" % qid)
			continue
		if brain["steps"].has(sid):
			err("step %s is in two quests: give it another id" % sid)
		brain["steps"][sid] = qid
		sids.append(sid)
		var td := {"todo": sid, "text": str(s.get("text", sid))}
		if s.get("done") != null:
			td["ticks"] = _trigger(s["done"])
		if s.get("fail") != null:
			td["fails"] = _trigger(s["fail"])
		if float(s.get("secs", 0)) > 0.0:
			td["secs"] = float(s["secs"])
		if s.get("hidden", false):
			td["hidden"] = true
		if str(s.get("who", "")) != "":
			td["who"] = str(s["who"])
		do.append(td)
	if q.get("checkpoint", true):
		do.append({"checkpoint": true})
	do.append_array((q.get("on_start", []) as Array).duplicate(true))
	st["beats"].append({"id": qid + "__start", "when": {"start": true}, "do": do})
	var done_do: Array = (q.get("on_done", []) as Array).duplicate(true)
	done_do.append({"done": true})
	match str(q.get("finish", "steps")):
		"steps":
			if sids.is_empty():
				err("quest %s finishes when its steps are done, but it has none (or set finish to \"never\": a moment's {\"done\": true} ends it)" % qid)
			else:
				st["beats"].append({"id": qid + "__done", "when": {"ticked": true}, "do": done_do})
		"any":                                     # the first step done ends it (a choice by what the player does)
			for sid in sids:
				st["beats"].append({"id": "%s__done__%s" % [qid, sid], "when": {"ticked": sid}, "do": done_do.duplicate(true)})
		"never":
			pass
		_:
			err("quest %s: finish is steps, any or never" % qid)
	for s in steps:                                # the right thing given is taken; any other answered (or the step failed)
		var g = s.get("done")
		if g is Dictionary and g.has("gave") and str(g["gave"]) != "*":
			var sid := str(s.get("id", ""))
			st["beats"].append({"id": "%s__%s__take" % [qid, sid], "when": g, "do": [{"take": g["gave"]}]})
			var wr = s.get("wrong")
			if wr is Dictionary:
				var acts: Array = []
				if str(wr.get("say", "")) != "":
					acts.append({"say": str(wr["say"]), "who": str(wr.get("who", g.get("to", "")))})
				if wr.get("fail", false):
					acts.append({"fail": sid})
				st["beats"].append({"id": "%s__%s__wrong" % [qid, sid], "when": {"gave": "*", "to": g.get("to"), "except": g["gave"]}, "do": acts, "repeat": true, "every": 0.5})
	if float(q.get("time_limit", 0)) > 0.0:
		st["timer"] = {"secs": float(q["time_limit"]), "fail": _target(str(q.get("on_timeout", "")), qid, true)}
	_moments(st, qid)
	_talk_beats(st)
	story["stitches"][qid] = st
	story["flow"][qid] = {"type": "stitch", "ref": qid, "next": _next(q, i, quests)}
	var card = q.get("card")
	if card is Dictionary:                         # a chapter's card before it: the view dark, its title, the time from here on
		var cid := qid + "__card"
		var c := {"chapter": str(card.get("title", ""))}
		if str(card.get("sub", "")) != "":
			c["sub"] = str(card["sub"])
		if str(card.get("time", "")) != "":
			c["time"] = str(card["time"])
		story["stitches"][cid] = {"title": str(card.get("title", "")), "level": lvl, "beats": [{"id": cid + "__start", "when": {"start": true}, "do": [c, {"done": true}]}]}
		story["flow"][cid] = {"type": "stitch", "ref": cid, "next": qid}
	brain["quests"].append(qid)
	return lvl


## a quest's next: the first `next` whose `if` holds (a choice by flags), else the next quest in the list, else the
## first ending
func _next(q: Dictionary, i: int, quests: Array) -> Variant:
	var qid := str(q["id"])
	var fallback = _entry[str(quests[i + 1]["id"])] if i + 1 < quests.size() else (file.get("endings", [{}])[0].get("id") if file.get("endings", []).size() else null)
	var nx: Array = q.get("next", []) if q.get("next") is Array else []
	if nx.is_empty():
		if fallback == null:
			warn("quest %s is the last and there's no ending after it: add one (endings)" % qid)
		return fallback
	var opts: Array = []
	var otherwise := false
	for o in nx:
		var to = _target(str(o.get("go", "")), qid, false)
		if HSCond.empty(o.get("if")):
			opts.append({"to": to, "label": str(o.get("go", "")), "if": []})
			otherwise = true
			break
		opts.append({"to": to, "label": str(o.get("go", "")), "if": [flag_for(o["if"])]})
	if opts.size() == 1 and otherwise:
		return opts[0]["to"]
	if not otherwise:
		opts.append({"to": fallback, "label": "otherwise", "if": []})
	var cid := qid + "__next"
	story["flow"][cid] = {"type": "choice", "by": "flag", "title": "", "options": opts}
	return cid


## a quest or an ending by its id, as the flow goes there
func _target(id: String, from: String, may_be_empty: bool) -> Variant:
	if id == "":
		if not may_be_empty:
			err("%s: a next with no go (a quest's or an ending's id)" % from)
		return null
	if _entry.has(id):
		return _entry[id]
	if _ends.has(id):
		return id
	err("%s goes to %s, which is neither a quest nor an ending" % [from, id])
	return null


## a trigger as the runtime reads it; {"holds": <condition>} fires when the condition becomes true
func _trigger(w) -> Variant:
	if w is Dictionary and w.has("holds"):
		return {"flag": flag_for(w["holds"])}
	if w is Dictionary:
		for k in ["all", "any"]:
			if w.get(k) is Array:
				var out: Dictionary = w.duplicate(true)
				out[k] = (w[k] as Array).map(func(x): return _trigger(x))
				return out
	return w


# ---- moments ----------------------------------------------------------------------------------------------------
## the moments listening during a quest (`during` empty or naming it): when, if, do; once a playthrough or every time
func _moments(st: Dictionary, qid: String) -> void:
	var k := 0
	for m in file.get("moments", []):
		k += 1
		var mid := str(m.get("id", "moment_%d" % k))
		var during = m.get("during", [])
		if during is Array and not during.is_empty() and not during.has(qid):
			continue
		if m.get("when") == null:
			err("moment %s has no when" % mid)
			continue
		var b := {"id": "m_" + mid, "when": _trigger(m["when"]), "do": (m.get("do", []) as Array).duplicate(true), "optional": true}
		var ifs: Array = []
		if not HSCond.empty(m.get("if")):
			ifs.append(flag_for(m["if"]))
		if m.get("once", true):
			var fl := "_fired_" + mid
			ifs.append("!" + fl)
			b["do"].push_front({"flag": fl})
		else:
			b["repeat"] = true
			b["every"] = max(0.1, float(m.get("every", 1.0)))
		if ifs.size():
			b["if"] = ifs
		st["beats"].append(b)


# ---- conversations ----------------------------------------------------------------------------------------------
## each person's conversations: a live scene each, offered by condition (the brain keeps one ?talk flag on for the
## first whose condition holds; a `once` one goes when it's had)
func _talks() -> void:
	var talk = file.get("talk", {})
	if not (talk is Dictionary):
		return
	for who in talk:
		if not story["cast"].has(who):
			warn("conversations for %s, who isn't a character (an HSActor) in a level" % who)
		var list: Array = []
		var k := 0
		for t in talk[who]:
			k += 1
			var tid := str(t.get("id", "%s_%d" % [who, k]))
			var sid := "talk__%s__%s" % [who, tid]
			story["scenes"][sid] = _scene(who, t, tid)
			list.append({"id": tid, "scene": sid, "flag": "?talk__%s__%s" % [who, tid], "if": t.get("if"), "once": bool(t.get("once", false))})
		brain["talks"][who] = list


func _talk_beats(st: Dictionary) -> void:
	for who in brain["talks"]:
		for t in brain["talks"][who]:
			st["beats"].append({"id": "talk__%s__%s" % [who, t["id"]], "when": {"use": who}, "if": [t["flag"]],
				"do": [{"scene": t["scene"]}, {"flag": "heard:" + str(t["id"])}], "repeat": true, "every": 0.1, "optional": true})


func _scene(who: String, t: Dictionary, tid: String) -> Dictionary:
	var sc := {"title": str(t.get("title", who)), "level": _actor_level.get(who, _first_level), "camera": {"mode": "live", "look": who}, "clips": [], "cues": []}
	var lines: Array = t.get("lines", [])
	if lines.is_empty():
		err("%s's conversation %s has no lines" % [who, tid])
	var k := 0
	for ln in lines:
		k += 1
		var cid := "c%d" % k
		var clip := {"id": cid, "en": str(ln.get("text", ""))}
		var w := str(ln.get("who", who))
		if w == "" or w == "player":
			clip["who"] = "player"
			clip["think"] = true
		else:
			clip["who"] = w
		if not HSCond.empty(ln.get("if")):
			clip["if"] = [flag_for(ln["if"])]
		if str(ln.get("expr", "")) != "" and clip["who"] != "player":   # her face as she says it (face.gd: once, then back to her rest)
			sc["cues"].append({"at": {"clip": cid, "edge": "start"}, "do": {"expr": str(ln["expr"]), "who": clip["who"]}})
		for a in ln.get("do", []):
			sc["cues"].append({"at": {"clip": cid, "edge": "start"}, "do": a})
		var answers: Array = ln.get("answers", [])
		if answers.size():
			var rp := {"options": []}
			var j := 0
			for o in answers:
				j += 1
				var od := {"id": str(o.get("id", "a%d" % j)), "label": str(o.get("label", ""))}
				if str(o.get("think", "")) != "":
					od["think"] = str(o["think"])
				if not HSCond.empty(o.get("if")):
					od["if"] = [flag_for(o["if"])]
				var sets: Array = [{"flag": "answered:%s:%s" % [tid, od["id"]]}]    # a fact: this answer, to this conversation
				for f in o.get("sets", []):
					sets.append({"flag": str(f)})
				if float(o.get("karma", 0.0)) != 0.0:
					sets.append({"karma": float(o["karma"])})
				if sets.size():
					od["sets"] = sets
				var th: Array = []
				for r in o.get("reply", []):
					th.append({"en": str(r)})
				if th.size():
					od["then"] = th
				if str(o.get("go", "")) != "":
					var to = _target(str(o["go"]), "%s's answer %s" % [who, od["label"]], false)
					if to != null:
						od["go"] = {"node": to}
				rp["options"].append(od)
			if answers.size() > 2:
				warn("%s's conversation %s: more than two answers on a line (the game shows two at most)" % [who, tid])
			clip["reply"] = rp
		sc["clips"].append(clip)
	return sc


# ---- what can't be reached ----------------------------------------------------------------------------------------
func _reached() -> void:
	var flow: Dictionary = story["flow"]
	var start = story["game"].get("start")
	var reached := {}
	var todo: Array = [start]
	while todo.size():
		var n = todo.pop_back()
		if n == null or reached.has(n) or not flow.has(n):
			continue
		reached[n] = true
		var f: Dictionary = flow[n]
		todo.append(f.get("next"))
		for o in f.get("options", []):
			todo.append(o.get("to"))
		if f.get("type") == "stitch":
			var tm = story["stitches"].get(f.get("ref"), {}).get("timer")
			if tm is Dictionary:
				todo.append(tm.get("fail"))
	for sid in story["scenes"]:
		for c in story["scenes"][sid].get("clips", []):
			for o in (c.get("reply", {}) as Dictionary).get("options", []):
				if o.get("go") is Dictionary:
					var g = o["go"].get("node")
					if g != null and not reached.has(g):
						todo.append(g)
	while todo.size():
		var n = todo.pop_back()
		if n == null or reached.has(n) or not flow.has(n):
			continue
		reached[n] = true
		todo.append(flow[n].get("next"))
		for o in flow[n].get("options", []):
			todo.append(o.get("to"))
	for n in flow:
		if not reached.has(n):
			warn("%s can't be reached: nothing leads there (a quest's next, an answer's go)" % n)
