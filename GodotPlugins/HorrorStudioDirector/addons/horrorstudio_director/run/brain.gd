extends Node
## The Director at play (docs/GODOT_DIRECTOR.md §2, DECISIONS 2026-11-01: "the director script just puppeteers the whole
## game"): beside the runtime, it never touches the scene's nodes itself. It writes down what the player does as facts
## (the run's flags, so a save keeps them: used:<id>, picked:<item>, read:<note>, entered:<area>, left:<area>,
## talked:<id> (a conversation begun), heard:<id> (one finished), answered:<talk>:<answer>, gave:<item>:<who>,
## step:<id>, failed:<id>, done:<quest>, ending:<id>), keeps
## every condition the story asks true or false as a flag of its own (?c<n>: the runtime's beats, choices, lines and
## answers read them as plain flags), keeps on the one conversation each person offers now (?talk__<who>__<id>), and
## works out the **states**: who is where doing what, what's shown, what's locked or lit, applying only what changed;
## again after every change and every level entered (a load, a retry), so the world always matches the story.
## Achievements are worked out the same way (achievement:<id>, `unlocked`): Steam later (docs/GODOT_DIRECTOR_PLAN.md §6).

signal unlocked(id: String, title: String)

var game = null                     # the HSGame
var runtime = null                  # the studio's runtime (its run, its play)
var data: Dictionary = {}           # the story compiler's brain: conds, talks, states, achievements, quests, steps
var quest := ""                     # the quest on now ("" between them)
var applied := {}                   # who or what -> the state last applied
var log_lines: Array = []           # what it did, newest last (F9, the dock)
var _busy := false
var _again := false


func ctx() -> Dictionary:
	var run = runtime.run if runtime != null else null
	if run == null:
		return {"flags": {}, "counters": {}, "karma": 0.0, "items": {}, "quest": quest}
	var k = run.get("karma", {})
	return {"flags": run["flags"], "counters": run.get("counters", {}), "karma": float(k.get("karma", 0.0)) if k is Dictionary else 0.0,
		"items": run.get("items", {}), "quest": quest}


func fact(f: String) -> void:
	if runtime == null or runtime.run == null or f == "":
		return
	runtime.run["flags"][f] = true


func note(s: String) -> void:
	log_lines.append(s)
	if log_lines.size() > 40:
		log_lines.pop_front()


# ---- what happens -------------------------------------------------------------------------------------------------
## every event the runtime sends (play.gd emit, before its beats hear it): the facts it makes, then everything again
func event(ev: Dictionary) -> void:
	var t := str(ev.get("type", ""))
	match t:
		"use":
			var id := str(ev.get("id", ""))
			fact("used:" + id)
			for tk in data.get("talks", {}).get(id, []):          # the conversation she offers now is the one had
				if ctx()["flags"].has(tk["flag"]):
					fact("talked:" + id)
					fact("talked:" + str(tk["id"]))
		"pickup":
			fact("picked:" + str(ev.get("item", "")))
		"read":
			fact("read:" + str(ev.get("note", "")))
		"enter":
			fact("entered:" + str(ev.get("id", "")))
		"exit":
			fact("left:" + str(ev.get("id", "")))
		"answered":
			fact("answered:%s:%s" % [ev.get("ask", ""), ev.get("option", "")])
		"gave":
			fact("gave:%s:%s" % [ev.get("item", ""), ev.get("to", "")])
		"todo":
			if ev.get("state") == "done":
				fact("step:" + str(ev.get("id", "")))
			elif ev.get("state") == "failed":
				fact("failed:" + str(ev.get("id", "")))
		"caught":
			fact("caught:" + str(ev.get("by", "")))
		"rolled":
			fact("rolled:%s:%s" % [ev.get("id", ""), ev.get("face", "")])
		"played":
			fact("played:%s:%s" % [ev.get("id", ""), ev.get("result", "")])
		"dropped":
			fact("dropped:" + str(ev.get("id", "")))
		"tick":
			return                                 # every frame: nothing new (a flag the story sets comes as "flag", and counts)
	refresh()


## the flow reached a node (game.gd on_step): a quest on, the one before it done, an ending reached
func step(nid: String) -> void:
	var was := quest
	quest = nid if data.get("quests", []).has(nid) else ""
	if was != "" and was != quest:
		fact("done:" + was)
		note("done " + was)
	if quest != "":
		note("quest " + quest)
	var flow: Dictionary = runtime.story.flow if runtime != null and runtime.story != null else {}
	if flow.get(nid, {}).get("type") == "ending":
		fact("ending:" + nid)
	refresh()


## a level entered (its things fresh, a load or a retry): every state applied again
func level(_lid: String) -> void:
	applied.clear()
	refresh()


# ---- working it out -------------------------------------------------------------------------------------------------
func refresh() -> void:
	if _busy:
		_again = true
		return
	_busy = true
	for i in 6:                                    # until nothing more changes (applying a state can make a fact)
		_again = false
		_conds()
		_talks()
		_states()
		_achievements()
		if not _again:
			break
	_busy = false


func _conds() -> void:
	var c := ctx()
	var flags: Dictionary = c["flags"]
	for f in data.get("conds", {}):
		var on := HSCond.holds(data["conds"][f], c)
		if on and not flags.has(f):
			flags[f] = true
		elif not on and flags.has(f):
			flags.erase(f)


func _talks() -> void:
	var c := ctx()
	var flags: Dictionary = c["flags"]
	for who in data.get("talks", {}):
		var chosen := ""
		for t in data["talks"][who]:
			if t["once"] and flags.has("heard:" + str(t["id"])):      # a once-only one goes when it's been heard out (not as it starts)
				continue
			if HSCond.holds(t["if"], c):
				chosen = t["flag"]
				break
		for t in data["talks"][who]:
			if t["flag"] == chosen:
				flags[t["flag"]] = true
			else:
				flags.erase(t["flag"])


## the states that hold, in order (a later one's settings over an earlier one's), against what was last applied
func wanted() -> Dictionary:
	var c := ctx()
	var want := {}
	for s in data.get("states", []):
		if not (s is Dictionary) or not (s.get("set") is Dictionary) or not HSCond.holds(s.get("while"), c):
			continue
		for target in s["set"]:
			var cur: Dictionary = want.get(target, {})
			var set_: Dictionary = s["set"][target] if s["set"][target] is Dictionary else {}
			for k in set_:
				cur[k] = set_[k]
			want[target] = cur
	return want


func _states() -> void:
	var rt = runtime.play if runtime != null else null
	if rt == null or rt.level == "":
		return
	var want := wanted()
	for target in want:
		var w: Dictionary = want[target]
		var had: Dictionary = applied.get(target, {})
		if HSCond.key(w) == HSCond.key(had):
			continue
		applied[target] = w.duplicate(true)
		for a in _acts(target, w, had):
			note("%s: %s" % [target, JSON.stringify(a)])
			rt.actions.run(a, rt)


## a state as the runtime's actions: a person placed or set going (behave), a motion, shown or hidden, a door locked
## or opened, a light, a little thing's state
func _acts(target: String, w: Dictionary, had: Dictionary) -> Array:
	var acts: Array = []
	var moved := false
	for k in ["do", "at", "to", "path", "paths", "sees"]:
		if w.get(k) != had.get(k):
			moved = true
	if moved and (w.has("do") or w.has("at") or w.has("to") or w.has("path") or w.has("paths")):
		var b := {"behave": target, "as": str(w.get("do", "idle"))}
		if w.has("at"):
			b["at"] = w["at"]
		if w.has("to"):
			b["to"] = w["to"]
		if w.has("path"):
			b["route"] = w["path"]
		if w.has("paths"):
			b["routes"] = w["paths"]
		if w.has("sees"):
			b["sees"] = w["sees"]
		acts.append(b)
	if w.has("shown") and w["shown"] != had.get("shown"):
		acts.append({"show": target} if w["shown"] else {"hide": target})
	if w.has("motion") and w["motion"] != had.get("motion"):
		acts.append({"anim": target, "clip": w["motion"]})
	if w.has("locked") and w["locked"] != had.get("locked"):
		acts.append({"door": target, "set": "lock" if w["locked"] else "unlock"})
	if w.has("open") and w["open"] != had.get("open"):
		acts.append({"door": target, "set": "open" if w["open"] else "close"})
	if w.has("light") and w["light"] != had.get("light"):
		acts.append({"light": target, "set": str(w["light"])})
	if w.has("state") and w["state"] != had.get("state"):
		acts.append({"state": target, "to": w["state"]})
	return acts


func _achievements() -> void:
	var c := ctx()
	for a in data.get("achievements", []):
		var id := str(a.get("id", ""))
		if id == "" or c["flags"].has("achievement:" + id):
			continue
		if HSCond.holds(a.get("when"), c) and not HSCond.empty(a.get("when")):
			fact("achievement:" + id)
			note("achievement " + id)
			unlocked.emit(id, str(a.get("title", id)))
