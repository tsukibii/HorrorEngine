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
## **On stage** (a quest's `stage`, docs/GODOT_ANIMATION_PLAN.md §6): each person's line there (where she is, what she
## does, her face) holds from that quest on, down the flow's ways, until a quest with a line of its own for her
## (`stage_cover`): a state each, before the file's own states (theirs win); the conversation she offers (`talk`: that
## one, or none: she's busy) narrows hers in that quest alone.

var story: Dictionary = {}
var file: Dictionary = {}
var problems: Array = []              # {node: null, text, error}
var brain := {"conds": {}, "talks": {}, "states": [], "achievements": [], "quests": [], "steps": {}}
var _conds := {}                      # a condition's key -> its flag
var _entry := {}                      # a quest's id -> where the flow enters it (its card first, if it has one)
var _ends := {}                       # ending ids
var _actor_level := {}                # a person's id -> the level she's in
var _first_level := ""
var _egg_list: Array = []             # the file's easter eggs (quests with `egg`): found during the others, not in their order
var _stage: Array = []                # On stage: [{who, from, line, quests: [the quests it holds in]}] (_stage_cover)


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
	var all_q: Array = file.get("quests", []) if file.get("quests") is Array else []
	_egg_list = all_q.filter(func(q): return q is Dictionary and q.get("egg", false) == true)
	var quests: Array = all_q.filter(func(q): return not (q is Dictionary and q.get("egg", false) == true))   # an egg is found, not gone to
	for e in file.get("endings", []):
		_ends[str(e.get("id", ""))] = true
		story["flow"][str(e["id"])] = {"type": "ending", "kind": str(e.get("kind", "neutral")), "title": str(e.get("title", "")), "text": str(e.get("text", ""))}
	var seen := {}
	for q in all_q:
		var qid := str(q.get("id", ""))
		if qid == "" or seen.has(qid) or _ends.has(qid):
			err("quest %s: give every quest an id of its own (not an ending's)" % qid)
		seen[qid] = true
		if q.get("egg", false) != true:
			_entry[qid] = (qid + "__card") if q.get("card") is Dictionary else qid
	_stage = stage_cover(quests)
	_talks()
	var lvl := _first_level
	for i in quests.size():
		if quests[i].get("desk") is Dictionary:      # a desk game's scene or choice, as the desk had it (godot_director.py from-desk)
			_desk_item(quests[i])
		else:
			lvl = _quest(quests[i], i, quests, lvl)
	if quests.is_empty():
		_roam()
	else:
		story["game"]["start"] = _entry[str(quests[0]["id"])]
		if _ends.is_empty():                           # no ending yet: after the last quest, a free roam (the game goes on)
			_roam_stitch(lvl)
	_egg_jumps()
	brain["states"] = _stage_states() + file.get("states", []).duplicate(true)   # On stage first: the file's own states over it
	for s in brain["states"]:
		if not (s is Dictionary) or not (s.get("set") is Dictionary):
			err("a state needs `set`: who or what, and how ({\"while\": ..., \"set\": {\"mari\": {\"at\": \"kitchen\"}}})")
	brain["achievements"] = file.get("achievements", []).duplicate(true)
	_reached()


## no quests yet: a free roam of the first level with the moments, the conversations and the states
func _roam() -> void:
	_roam_stitch()
	story["game"]["start"] = "free_roam"


## the free roam: the first level, its moments, conversations and states, no objective, no end
func _roam_stitch(lvl := "") -> void:
	var st := {"title": "Free roam", "level": lvl if lvl != "" else _first_level, "beats": [{"id": "free_roam__start", "when": {"start": true}, "do": [{"objective": ""}, {"untodo": true}]}]}
	_moments(st, "")
	_eggs(st, "")
	_talk_beats(st)
	story["stitches"]["free_roam"] = st
	story["flow"]["free_roam"] = {"type": "stitch", "ref": "free_roam", "next": null}


# ---- a quest ----------------------------------------------------------------------------------------------------
## the rounds the runtime plays and their results, the first the player's success (its story.gd PLAYS: hide -> hidden, found)
static func round_types() -> Dictionary:
	var path := "res://addons/horrorstudio/story.gd"
	return (load(path).PLAYS as Dictionary) if ResourceLoader.exists(path) else {}


func _quest(q: Dictionary, i: int, quests: Array, lvl: String) -> String:
	var qid := str(q["id"])
	var map := str(q.get("map", ""))
	if map != "":
		if not story["levels"].has(map):
			err("quest %s: its map %s isn't a level (an HSLevel's id)" % [qid, map])
		else:
			lvl = map
	var st := {"title": str(q.get("title", qid)), "level": lvl, "beats": []}
	var rnd = q.get("round")
	if rnd is Dictionary and not (rnd as Dictionary).is_empty():   # a round of gameplay (STORY_FORMAT §9.8): the runtime plays it, its result ends the quest
		st["play"] = (rnd as Dictionary).duplicate(true)
		var plays: Dictionary = round_types()
		if not plays.is_empty() and not plays.has(str(rnd.get("type", ""))):
			err("quest %s: its round's type %s isn't one the game plays (%s)" % [qid, rnd.get("type", ""), ", ".join(PackedStringArray(plays.keys()))])
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
		if s.get("hidden", false) or q.get("list", true) == false:   # (a quest with no to-do list: its steps kept unseen)
			td["hidden"] = true
		if str(s.get("who", "")) != "":
			td["who"] = str(s["who"])
		if s.get("guide") is String or (s.get("guide") is bool and s["guide"]):   # a marker over what it needs (STORY_FORMAT §4)
			var gid := _guide_of(s)
			td["guide"] = gid if gid != "" else true
		do.append(td)
	if q.get("checkpoint", true):
		do.append({"checkpoint": true})
	do.append_array((q.get("on_start", []) as Array).duplicate(true))
	if str(q.get("finish", "steps")) == "opening":        # an intro: over once what happens as it starts is
		do.append({"done": true})
	st["beats"].append({"id": qid + "__start", "when": {"start": true}, "do": do})
	var done_do: Array = (q.get("on_done", []) as Array).duplicate(true)
	done_do.append({"done": true})
	match str(q.get("finish", "steps")):
		"steps":
			if st.has("play"):
				pass                                   # a round ends by its result
			elif sids.is_empty():
				err("quest %s finishes when its steps are done, but it has none (or set finish to \"never\": a moment's {\"done\": true} ends it)" % qid)
			else:
				st["beats"].append({"id": qid + "__done", "when": {"ticked": true}, "do": done_do})
		"any":                                     # the first step done ends it (a choice by what the player does)
			for sid in sids:
				st["beats"].append({"id": "%s__done__%s" % [qid, sid], "when": {"ticked": sid}, "do": done_do.duplicate(true)})
		"never", "opening":
			pass
		_:
			err("quest %s: finish is steps, any, opening or never" % qid)
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
		if str(q.get("time_label", "")) != "":
			st["timer"]["label"] = str(q["time_label"])
	_moments(st, qid)
	_eggs(st, qid)
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


## what a step's marker hangs over: the id it gives, else what its `done` names that the runtime can't read from the
## compiled trigger (a talk's person: talked:/heard:; a fact's thing: used:kettle, picked:mug...); "" when the runtime
## can read it from the trigger itself ({"use": "kettle"})
func _guide_of(s: Dictionary) -> String:
	var g = s.get("guide")
	if g is String:
		return g
	var d = s.get("done")
	if not (d is Dictionary):
		return ""
	var tk := HSCommands.talk_when(d, {"talks": file.get("talk", {})})
	if not tk.is_empty():
		return str(tk["who"])
	if not d.has("holds"):
		return ""
	var p := HSCommands.parse_cond(d["holds"])
	if (p["items"] as Array).size() != 1 or p["items"][0]["kind"] != "fact" or p["items"][0].get("not", false):
		return ""
	var f := str(p["items"][0]["v"])
	for pre in ["used:", "picked:", "read:", "entered:", "dropped:", "rolled:", "played:"]:
		if f.begins_with(pre):
			return f.substr(pre.length())
	if f.begins_with("gave:") and f.count(":") >= 2:
		return f.get_slice(":", 2)
	return ""


## a desk game's flow node brought in as it was (a cutscene, a choice by what the player does, by a scene's result, by
## flags or karma): the runtime plays it as the desk's export does; its scene from the file's `desk.scenes`
func _desk_item(q: Dictionary) -> void:
	var qid := str(q["id"])
	var node: Dictionary = (q["desk"] as Dictionary).duplicate(true)
	if not ["scene", "choice", "ending", "stitch"].has(str(node.get("type", ""))):
		err("%s: a desk item is a scene, a choice or an ending (its type %s)" % [qid, node.get("type")])
		return
	if node.get("type") == "scene" and not story["scenes"].has(str(node.get("ref", ""))) and not ((file.get("desk", {}) as Dictionary).get("scenes", {}) as Dictionary).has(str(node.get("ref", ""))):
		err("%s plays the scene %s, which isn't in the file's desk.scenes" % [qid, node.get("ref")])
	story["flow"][qid] = node


## a quest's next: the first `next` whose `if` holds (a choice by flags), else the next quest in the list, else the
## first ending
func _next(q: Dictionary, i: int, quests: Array) -> Variant:
	var qid := str(q["id"])
	var fallback = _entry[str(quests[i + 1]["id"])] if i + 1 < quests.size() else (file.get("endings", [{}])[0].get("id") if file.get("endings", []).size() else "free_roam")
	var nx: Array = q.get("next", []) if q.get("next") is Array else []
	if nx.is_empty():
		if fallback == "free_roam":
			warn("quest %s is the last and there's no ending yet: the game goes on as a free roam after it (add an ending)" % qid)
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
	for e in _egg_list:
		if str(e.get("id", "")) == id:
			err("%s goes to the easter egg %s: an egg is found during a quest, not gone to" % [from, id])
			return null
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
## the easter eggs that can be found during a quest (`during` empty or naming it; "" the free roam: the eggs found any
## time): once a playthrough, by its `found`, when its `if` holds. What it plays is its `on_start`; then the fact
## done:<egg>, and a jump when it has a `next` (the flag its interrupt listens for: _egg_jumps)
func _eggs(st: Dictionary, qid: String) -> void:
	for e in _egg_list:
		var eid := str(e.get("id", ""))
		var during = e.get("during", [])
		if during is Array and not during.is_empty() and not during.has(qid):
			continue
		if not _egg_found(e):
			continue
		var do: Array = [{"flag": "_found_" + eid}]
		do.append_array((e.get("on_start", []) as Array).duplicate(true) if e.get("on_start") is Array else [])
		do.append({"flag": "done:" + eid})
		if _egg_to(e) != "":
			do.append({"flag": "_jump_" + eid})
		var ifs: Array = ["!_found_" + eid]
		if _plain(e.get("if")):
			ifs.append_array(e["if"] if e["if"] is Array else [e["if"]])
		elif not HSCond.empty(e.get("if")):
			ifs.append(flag_for(e["if"]))
		st["beats"].append({"id": "egg_" + eid, "when": _trigger(e["found"]), "if": ifs, "do": do, "optional": true})


static func _egg_found(e: Dictionary) -> bool:
	return e.get("found") is Dictionary and not (e["found"] as Dictionary).is_empty()


## where an egg jumps the story when it's found (its `next`'s first way), "" when the game goes on where it was
static func _egg_to(e: Dictionary) -> String:
	for o in (e.get("next", []) if e.get("next") is Array else []):
		if o is Dictionary and str(o.get("go", "")) != "":
			return str(o["go"])
	return ""


## an egg's jump: an interrupt of the quests it's found in (the runtime's trigger cutscenes, STORY_FORMAT §5.1), on the
## flag its beat sets last; and what's wrong with an egg
func _egg_jumps() -> void:
	for e in _egg_list:
		var eid := str(e.get("id", ""))
		if not _egg_found(e):
			err("easter egg %s: say how it's found (its FOUND WHEN)" % eid)
			continue
		var during = e.get("during", [])
		if during is Array:
			for d in during:
				if not _entry.has(str(d)):
					err("easter egg %s is found during %s, which isn't a quest" % [eid, d])
		var to := _egg_to(e)
		if to == "":
			continue
		var tgt = _target(to, eid, false)
		if tgt == null:
			continue
		story["interrupts"].append({"id": "egg_" + eid, "label": str(e.get("title", eid)), "when": {"flag": "_jump_" + eid},
			"during": (during as Array).duplicate() if during is Array and not during.is_empty() else "all", "to": tgt})


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
		for key in m:                                  # the beat's own words the moment hasn't (a desk game's: its secret, a wait...)
			if not ["id", "when", "if", "do", "once", "every", "during"].has(str(key)):
				b[str(key)] = m[key]
		var ifs: Array = []
		if _plain(m.get("if")):                        # only facts: as the runtime reads them, no flag of the brain's between
			ifs.append_array(m["if"] if m["if"] is Array else [m["if"]])
		elif not HSCond.empty(m.get("if")):
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


## a condition that's only facts (a fact, a fact not there, or a list of them): the runtime's own `if`
static func _plain(c) -> bool:
	if c is String:
		return c != ""
	if c is Array and not c.is_empty():
		for x in c:
			if not (x is String) or str(x) == "":
				return false
		return true
	return false


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
			list.append({"id": tid, "scene": sid, "flag": "?talk__%s__%s" % [who, tid], "if": _talk_if(who, tid, t.get("if")), "once": bool(t.get("once", false))})
		brain["talks"][who] = list
	for ln in _stage:                                  # a line offering a conversation she hasn't got
		var tk = ln["line"].get("talk")
		if tk is String and tk != "" and not (talk.get(ln["who"], []) as Array).any(func(t): return str(t.get("id", "")) == tk):
			warn("quest %s: On stage, %s talks %s, which isn't one of her conversations" % [ln["from"], ln["who"], tk])


## a conversation's offer while On stage narrows it: in the quest a line of hers with a `talk` is written in (not
## carried on: a conversation belongs to its quest), this one only when it's the line's, never when the line says
## another or none ("": she's busy)
func _talk_if(who: String, tid: String, own):
	var mine: Array = []
	var others: Array = []
	for ln in _stage:
		if ln["who"] != who or not ln["line"].has("talk"):
			continue
		(mine if str(ln["line"]["talk"]) == tid else others).append({"quest": ln["from"]})
	if mine.is_empty() and others.is_empty():
		return own
	var c: Array = []
	if not HSCond.empty(own):
		c.append(own)
	if others.size():
		c.append({"not": {"any": others}})
	if mine.size():                                    # the line's own: offered while it holds, whatever its `if`
		return {"any": [{"any": mine}, {"all": c}]} if c.size() else {"any": mine}
	return {"all": c}


## On stage: each person's line in a quest and the quests it holds in: that one, then on down every way out of it
## (its `next`, else the quest after it) until a quest with a line of its own for her
func stage_cover(quests: Array) -> Array:
	var ids: Array = quests.map(func(q): return str(q.get("id", "")))
	var outs := {}
	for i in quests.size():
		var q: Dictionary = quests[i]
		var o: Array = []
		var nx: Array = q.get("next", []) if q.get("next") is Array else []
		var always := false
		for x in nx:
			if ids.has(str(x.get("go", ""))):
				o.append(str(x["go"]))
			if HSCond.empty(x.get("if")):
				always = true
		if not always and i + 1 < quests.size():       # no next, or none that always goes: the quest after it (as _next)
			o.append(ids[i + 1])
		outs[ids[i]] = o
	var out: Array = []
	for q in quests:
		var st = q.get("stage")
		if not (st is Dictionary):
			continue
		for who in st:
			if not (st[who] is Dictionary):
				continue
			var seen := {str(q["id"]): true}
			var todo: Array = (outs.get(str(q["id"]), []) as Array).duplicate()
			while todo.size():
				var n: String = todo.pop_front()
				if seen.has(n):
					continue
				var nq: Dictionary = quests[ids.find(n)]
				if nq.get("stage") is Dictionary and (nq["stage"] as Dictionary).has(who):
					continue
				seen[n] = true
				todo.append_array(outs.get(n, []))
			out.append({"who": str(who), "from": str(q["id"]), "line": st[who], "quests": ids.filter(func(x): return seen.has(x))})
	return out


## On stage's lines as the brain's states: each while one of its quests is on, setting her as the line says (its
## `talk` read by _talk_if, not here)
func _stage_states() -> Array:
	var out: Array = []
	for ln in _stage:
		var set_: Dictionary = (ln["line"] as Dictionary).duplicate(true)
		set_.erase("talk")
		set_["shown"] = str(set_.get("do", "")) != "off"   # on stage, or not there (brought back by a later line)
		set_["_in_between"] = true                     # (the brain walks her to a new spot instead of putting her there)
		out.append({"while": {"any": (ln["quests"] as Array).map(func(q): return {"quest": q})}, "set": {ln["who"]: set_}, "stage": ln["from"]})
	return out


## clicking someone plays the conversation she offers now; heard to its end, the facts heard:<it> and heard:<her> (a
## step or a moment can wait for one conversation, or for her to be heard out at all: the panel's Talk to…)
func _talk_beats(st: Dictionary) -> void:
	for who in brain["talks"]:
		for t in brain["talks"][who]:
			st["beats"].append({"id": "talk__%s__%s" % [who, t["id"]], "when": {"use": who}, "if": [t["flag"]],
				"do": [{"scene": t["scene"]}, {"flag": "heard:" + str(t["id"])}, {"flag": "heard:" + str(who)}], "repeat": true, "every": 0.1, "optional": true})


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
	for it in story.get("interrupts", []):              # the trigger cutscenes' ways (a desk game's interrupts)
		if it is Dictionary:
			todo.append(it.get("to"))
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
