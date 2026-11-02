@tool
class_name HSFlow
extends RefCounted
## The story as a flowchart (the Story Flow tab, editor/flow_tab.gd; the user, 2026-11-02: "a flowchart of the quests'
## flow… label easter egg quests… so I don't have to look through them one by one to see the prerequisites"): the
## Director file read as cards and the arrows between them, the way the compiler (story_compile.gd) plays it. A quest's
## `next` in order: each `if` an arrow of its own, the first without one its "then"; with none, the next quest in the
## list, else the first ending, else the free roam ("then", or "otherwise" after its ifs). Its time limit's way out. A
## desk game's scenes and choices as the desk had them; its trigger cutscenes (`desk.interrupts`) hung off the quests
## they're listening during. Plain data, so the checks read it too. Where each card sits is the file's `chart`
## ({id: [x, y]}, in the editor's units at scale 1); the cards not placed by hand are laid out here.

const ROAM := "free_roam"
const COL := 360.0                 # a column's width (a card and the gap after it)
const GAP := 34.0                  # between two cards in a column
const ROW_GAP := 70.0              # between two rows of columns (a long story wrapped like lines of text)


## the chart: {cards: [card], wires: [wire], start: id, eggs}. A card: {id, kind (intro, quest, round, egg, scene, choice,
## ending, roam, trigger), num (its place in the quest list, 1 on), title, sub, info, outs: [{label, to, kind (then,
## else, if, timeout, option, jump), implicit, missing}], during (a trigger's quests, or "all"), editable (the
## file's own, not a desk game's), ending (an ending's kind), main (on the main path)}. A wire: {from, out (the
## card's out, or -1 for its "during" port), to, kind}.
static func chart(f: Dictionary, ctx = null) -> Dictionary:
	if ctx == null:
		ctx = {"talks": f.get("talk", {})}
	var quests: Array = f.get("quests", []) if f.get("quests") is Array else []
	var endings: Array = f.get("endings", []) if f.get("endings") is Array else []
	var cards: Array = []
	var n := 0
	for i in quests.size():
		var q = quests[i]
		if not (q is Dictionary):
			continue
		if q.get("egg", false) == true:            # an easter egg: found during quests, out of their order and numbers
			cards.append(_egg_card(q, ctx))
			continue
		n += 1
		var c := _quest_card(q, i, quests, endings, ctx)
		c["num"] = n
		cards.append(c)
	for e in endings:
		if not (e is Dictionary):
			continue
		var kind := str(e.get("kind", "neutral"))
		cards.append({"id": str(e.get("id", "")), "kind": "ending", "ending": kind, "num": 0,
			"title": str(e.get("title", e.get("id", ""))), "sub": "%s ending" % kind.capitalize(), "info": "",
			"outs": [], "during": [], "editable": true})
	var desk = f.get("desk")
	if desk is Dictionary and desk.get("interrupts") is Array:
		for it in desk["interrupts"]:
			if not (it is Dictionary):
				continue
			cards.append({"id": "trigger:" + str(it.get("id", "")), "kind": "trigger", "num": 0,
				"title": str(it.get("label", it.get("id", ""))), "sub": "when " + HSCommands.trigger_text(it.get("when")),
				"info": "a trigger cutscene (the desk's)", "during": it.get("during", "all"), "editable": false,
				"outs": [{"label": "jumps to", "to": str(it.get("to", "")), "kind": "jump"}]})
	var by_id := {}
	for c in cards:
		by_id[c["id"]] = c
	var roam := false
	for c in cards:
		for o in c["outs"]:
			roam = roam or o["to"] == ROAM
	if roam and not by_id.has(ROAM):
		var r := {"id": ROAM, "kind": "roam", "num": 0, "title": "Free roam", "sub": "the game goes on, no ending yet",
			"info": "", "outs": [], "during": [], "editable": false}
		cards.append(r)
		by_id[ROAM] = r
	var wires: Array = []
	for c in cards:
		for j in (c["outs"] as Array).size():
			var o: Dictionary = c["outs"][j]
			if by_id.has(o["to"]):
				wires.append({"from": c["id"], "out": j, "to": o["to"], "kind": o["kind"]})
			elif not o.get("stay", false):
				o["missing"] = true
		if c["kind"] in ["trigger", "egg"] and c["during"] is Array:
			for qid in c["during"]:
				if by_id.has(str(qid)):
					wires.append({"from": str(qid), "out": -1, "to": c["id"], "kind": "during"})
	var start := ""
	for c in cards:
		if not (c["kind"] in ["ending", "trigger", "egg"]):
			start = c["id"]
			break
	var out := {"cards": cards, "wires": wires, "start": start, "eggs": cards.any(func(x): return x["kind"] == "egg")}
	var at := start
	var seen := {}
	while at != "" and not seen.has(at) and by_id.has(at):   # the main path: from the start along each card's "then"
		seen[at] = true
		by_id[at]["main"] = true
		at = _then_of(by_id[at])
	return out


static func _quest_card(q: Dictionary, i: int, quests: Array, endings: Array, ctx) -> Dictionary:
	var qid := str(q.get("id", ""))
	var c := {"id": qid, "num": i + 1, "outs": [], "during": [], "editable": true, "info": ""}
	var desk = q.get("desk")
	if desk is Dictionary:                       # a desk game's scene or choice, as the desk had it
		c["editable"] = false
		c["title"] = qid
		match str(desk.get("type", "")):
			"ending":
				c["kind"] = "ending"
				c["ending"] = "desk"
				c["sub"] = "an ending (the desk's)"
			"choice":
				c["kind"] = "choice"
				c["sub"] = "a choice by %s (the desk's)" % str(desk.get("by", "act"))
				for o in desk.get("options", []):
					if o is Dictionary:
						c["outs"].append({"label": _option_words(o, str(desk.get("by", "act"))), "to": str(o.get("to", "")), "kind": "option"})
			_:
				c["kind"] = "scene"
				c["sub"] = "a scene: %s (the desk's)" % str(desk.get("ref", "")) if str(desk.get("ref", "")) != "" else "the desk's"
				if desk.get("next") != null and str(desk.get("next")) != "":
					c["outs"].append({"label": "then", "to": str(desk["next"]), "kind": "then"})
		return c
	var rnd = q.get("round")
	var opening := str(q.get("finish", "steps")) == "opening"
	c["kind"] = "intro" if opening else ("round" if rnd is Dictionary and not (rnd as Dictionary).is_empty() else "quest")
	c["title"] = str(q.get("title", qid))
	var obj := str(q.get("objective", ""))
	if obj != "":
		c["sub"] = obj
	elif opening:
		c["sub"] = "its opening, then on"
	elif q.get("list", true) == false:
		c["sub"] = "no to-do list"
	else:
		c["sub"] = ""
	var bits: Array = []
	var n := (q.get("steps", []) as Array).size() if q.get("steps") is Array else 0
	if n:
		bits.append("%d step%s" % [n, "" if n == 1 else "s"])
	if c["kind"] == "round":
		bits.append("a round: " + str(rnd.get("type", "")).replace("_", " "))
	if float(q.get("time_limit", 0)) > 0.0:
		bits.append("%d s to do it" % int(float(q["time_limit"])))
	c["info"] = " · ".join(PackedStringArray(bits))
	var nx: Array = q.get("next", []) if q.get("next") is Array else []
	var then := false
	for k in nx.size():
		var o = nx[k]
		if not (o is Dictionary):
			continue
		if HSCond.empty(o.get("if")):
			c["outs"].append({"label": "then", "to": str(o.get("go", "")), "kind": "then", "src": "next", "k": k})
			then = true
			break
		c["outs"].append({"label": "if " + HSCommands.cond_text(o["if"], ctx), "to": str(o.get("go", "")), "kind": "if", "src": "next", "k": k})
	if not then:
		var ifs: bool = not (c["outs"] as Array).is_empty()
		c["outs"].append({"label": "otherwise" if ifs else "then", "to": _after(quests, endings, i), "kind": "else" if ifs else "then",
			"implicit": true, "src": "list"})
	if float(q.get("time_limit", 0)) > 0.0 and str(q.get("on_timeout", "")) != "":
		c["outs"].append({"label": "out of time", "to": str(q["on_timeout"]), "kind": "timeout", "src": "timeout"})
	return c


## an easter egg's card: how it's found, where (the quests that point at it; none: any), its jump ahead or the game going
## on where it was (a way out with nowhere to go: `stay`)
static func _egg_card(q: Dictionary, ctx) -> Dictionary:
	var eid := str(q.get("id", ""))
	var found = q.get("found")
	var has_found: bool = found is Dictionary and not (found as Dictionary).is_empty()
	var during = q.get("during", [])
	var c := {"id": eid, "kind": "egg", "num": 0, "title": str(q.get("title", eid)), "editable": true,
		"sub": ("found when " + HSCommands.trigger_text(found)) if has_found else "found when: pick it (FOUND WHEN, on the right)",
		"during": during if during is Array else [], "outs": []}
	var bits: Array = ["during any quest" if not (during is Array) or (during as Array).is_empty() else "during %d quest%s" % [during.size(), "" if during.size() == 1 else "s"]]
	if not HSCond.empty(q.get("if")):
		bits.append("only if " + HSCommands.cond_text(q["if"], ctx))
	c["info"] = " · ".join(PackedStringArray(bits))
	var to := HSStoryCompiler._egg_to(q)
	c["outs"].append({"label": "then it jumps to" if to != "" else "then the game goes on where it was", "to": to, "kind": "skip",
		"src": "egg", "stay": to == ""})
	return c


## where a quest goes when nothing else says: the next quest in the list (an easter egg isn't in it), else the first
## ending, else the free roam
static func _after(quests: Array, endings: Array, i: int) -> String:
	for j in range(i + 1, quests.size()):
		if quests[j] is Dictionary and quests[j].get("egg", false) != true:
			return str(quests[j].get("id", ""))
	if endings.size() and endings[0] is Dictionary:
		return str(endings[0].get("id", ""))
	return ROAM


## a desk choice's way, in words
static func _option_words(o: Dictionary, by: String) -> String:
	match by:
		"act":
			return str(o.get("label", "they do it"))
		"result":
			return "if the result is " + str(o.get("result", "?"))
		"karma":
			if o.has("min"):
				return "if karma is %s or more" % _num(o["min"])
			if o.has("max"):
				return "if karma is %s or less" % _num(o["max"])
			return "otherwise"
		_:
			var fl = o.get("if")
			if fl is Array and not fl.is_empty():
				return "if " + ", ".join(PackedStringArray((fl as Array).map(func(x): return str(x))))
			return "otherwise"


static func _num(v) -> String:
	var x := float(v)
	return str(int(x)) if x == floorf(x) else str(x)


## where a card goes on to by default: its "then", else its "otherwise", else (a desk choice) its first answer
static func _then_of(c: Dictionary) -> String:
	for k in ["then", "else", "option"]:
		for o in c["outs"]:
			if o["kind"] == k:
				return str(o["to"])
	return ""


static func card_of(ch: Dictionary, id: String) -> Dictionary:
	for c in ch.get("cards", []):
		if c["id"] == id:
			return c
	return {}


## the ways into a card (its prerequisites): [{from, label, kind}], in the order of the cards they come from
static func incoming(ch: Dictionary, id: String) -> Array:
	var out: Array = []
	for w in ch.get("wires", []):
		if w["to"] != id:
			continue
		var c := card_of(ch, w["from"])
		out.append({"from": w["from"], "label": "during it" if w["out"] < 0 else str(c["outs"][w["out"]]["label"]), "kind": w["kind"]})
	return out


## where each card sits: the file's `chart` where it has one, the rest laid out left to right by how far into the story
## they come (the longest way there from the start), the main path on top of each column, a long story wrapped onto
## rows of `per_row` columns like lines of text (0: one row). In the editor's units at scale 1. `size` (id -> Vector2)
## the cards' sizes where known
static func layout(ch: Dictionary, saved: Dictionary, size := {}, per_row := 0) -> Dictionary:
	var cards: Array = ch.get("cards", [])
	var order := {}
	for i in cards.size():
		order[cards[i]["id"]] = i
	var nexts := {}
	for c in cards:
		nexts[c["id"]] = []
	for w in ch.get("wires", []):
		if nexts.has(w["from"]) and order.has(w["to"]):
			nexts[w["from"]].append(w["to"])
	# the ways that go back (a loop) are left out, found from the start and then from every card not reached
	var state := {}                              # 1 on the way, 2 done
	var back := {}
	var topo: Array = []
	var roots: Array = [ch.get("start", "")]
	for c in cards:
		roots.append(c["id"])
	for r in roots:
		if r == "" or state.has(r) or not order.has(r):
			continue
		var stack: Array = [[r, 0]]
		state[r] = 1
		while stack.size():
			var top: Array = stack.back()
			var id: String = top[0]
			var k: int = top[1]
			if k < (nexts[id] as Array).size():
				top[1] = k + 1
				var nx: String = nexts[id][k]
				if not state.has(nx):
					state[nx] = 1
					stack.append([nx, 0])
				elif state[nx] == 1:
					back["%s>%s" % [id, nx]] = true
			else:
				state[id] = 2
				topo.append(id)
				stack.pop_back()
	topo.reverse()
	var depth := {}
	for id in topo:
		if not depth.has(id):
			depth[id] = 0
		for nx in nexts[id]:
			if back.has("%s>%s" % [id, nx]):
				continue
			depth[nx] = maxi(int(depth.get(nx, 0)), int(depth[id]) + 1)
	var cols := {}
	for c in cards:
		var d := int(depth.get(c["id"], 0))
		if not cols.has(d):
			cols[d] = []
		cols[d].append(c)
	var per := per_row if per_row > 0 else 1 << 20
	var tall := {}                               # a row's height: its tallest column
	for d in cols:
		var col: Array = cols[d]
		col.sort_custom(func(a, b):
			var ma := 0 if a.get("main", false) else 1
			var mb := 0 if b.get("main", false) else 1
			return ma < mb if ma != mb else int(order[a["id"]]) < int(order[b["id"]]))
		var h := 0.0
		for c in col:
			h += (size[c["id"]].y if size.has(c["id"]) else _tall(c)) + GAP
		tall[int(d) / per] = maxf(float(tall.get(int(d) / per, 0.0)), h)
	var row_y := {}
	var y0 := 0.0
	var rows: Array = tall.keys()
	rows.sort()
	for r in rows:
		row_y[r] = y0
		y0 += float(tall[r]) + ROW_GAP
	var pos := {}
	for d in cols:
		var y := float(row_y[int(d) / per])
		for c in cols[d]:
			pos[c["id"]] = Vector2(float(int(d) % per) * COL, y)
			y += (size[c["id"]].y if size.has(c["id"]) else _tall(c)) + GAP
	for id in saved:
		var v = saved[id]
		if pos.has(id) and v is Array and v.size() >= 2:
			pos[id] = Vector2(float(v[0]), float(v[1]))
	return pos


## a card's height, roughly, before it's drawn (its title, its line or two, a row per way out)
static func _tall(c: Dictionary) -> float:
	var rows := 1 + (1 if str(c.get("info", "")) != "" else 0) + (c["outs"] as Array).size()
	return 46.0 + rows * 30.0


# ---- setting it up from the chart (each changes the file in place; the tab does it inside the Story tab's change) ----
static func quest_index(f: Dictionary, id: String) -> int:
	var qs: Array = f.get("quests", []) if f.get("quests") is Array else []
	for i in qs.size():
		if qs[i] is Dictionary and str(qs[i].get("id", "")) == id:
			return i
	return -1


static func ending_index(f: Dictionary, id: String) -> int:
	var es: Array = f.get("endings", []) if f.get("endings") is Array else []
	for i in es.size():
		if es[i] is Dictionary and str(es[i].get("id", "")) == id:
			return i
	return -1


## a quest's way out (the chart's out index) sent to another card: a branch's go, its then (written only when it isn't
## the list's next anyway), its time limit's way out. "" when done, else why not
static func set_way(f: Dictionary, qid: String, out: int, to: String) -> String:
	var i := quest_index(f, qid)
	if i < 0:
		return "%s isn't a quest of the file's" % qid
	var q: Dictionary = f["quests"][i]
	var ti := quest_index(f, to)
	if ti >= 0 and f["quests"][ti].get("egg", false) == true:
		return "an easter egg is found during a quest, not gone to: drag the quest's “easter eggs found during it” onto it"
	if q.get("egg", false) == true:               # an egg: where it jumps the story once it's found (a skip)
		if ti < 0 and ending_index(f, to) < 0:
			return "an easter egg jumps to a quest or an ending"
		q["next"] = [{"go": to}]
		return ""
	if q.get("desk") is Dictionary:
		return "a desk game's ways are changed in the Director Manager"
	if quest_index(f, to) < 0 and ending_index(f, to) < 0:
		return "a way goes to a quest or an ending"
	var c := _quest_card(q, i, f["quests"], f.get("endings", []), null)
	if out < 0 or out >= (c["outs"] as Array).size():
		return "no such way out"
	var o: Dictionary = c["outs"][out]
	match str(o.get("src", "")):
		"next":
			if o["kind"] == "then":
				set_then(f, qid, to)
			else:
				q["next"][int(o["k"])]["go"] = to
		"list":
			set_then(f, qid, to)
		"timeout":
			q["on_timeout"] = to
	return ""


## a quest's then (where it goes when none of its ifs hold): written as its last way, or left to the list's order when
## that's where it goes anyway
static func set_then(f: Dictionary, qid: String, to: String) -> void:
	var i := quest_index(f, qid)
	if i < 0:
		return
	var q: Dictionary = f["quests"][i]
	var ifs: Array = []
	for o in (q.get("next", []) if q.get("next") is Array else []):
		if not (o is Dictionary) or HSCond.empty(o.get("if")):
			break
		ifs.append(o)
	if to != _after(f["quests"], f.get("endings", []), i):
		ifs.append({"go": to})
	if ifs.is_empty():
		q.erase("next")
	else:
		q["next"] = ifs


## a way taken away: a branch (or a then written down: the list's order again), a time limit's way out. "" when done
static func cut_way(f: Dictionary, qid: String, out: int) -> String:
	var i := quest_index(f, qid)
	if i < 0 or f["quests"][i].get("desk") is Dictionary:
		return "a desk game's ways are changed in the Director Manager"
	var q: Dictionary = f["quests"][i]
	if q.get("egg", false) == true:               # an egg's jump taken away: the game goes on where it was
		q.erase("next")
		return ""
	var c := _quest_card(q, i, f["quests"], f.get("endings", []), null)
	if out < 0 or out >= (c["outs"] as Array).size():
		return "no such way out"
	var o: Dictionary = c["outs"][out]
	match str(o.get("src", "")):
		"next":
			(q["next"] as Array).remove_at(int(o["k"]))
			if (q["next"] as Array).is_empty():
				q.erase("next")
		"timeout":
			q.erase("on_timeout")
		_:
			return "a quest always goes on: drag its then onto another card instead"
	return ""


## a branch: a way that's taken only when the condition holds, before the quest's then (the first that holds wins)
static func add_branch(f: Dictionary, qid: String, cond, to := "") -> int:
	var i := quest_index(f, qid)
	if i < 0:
		return -1
	var q: Dictionary = f["quests"][i]
	var nx: Array = q.get("next", []) if q.get("next") is Array else []
	var at := nx.size()
	for k in nx.size():
		if not (nx[k] is Dictionary) or HSCond.empty(nx[k].get("if")):
			at = k
			break
	nx.insert(at, {"if": cond, "go": to})
	q["next"] = nx
	return at


## a branch moved up or down among the quest's ifs (the first that holds wins)
static func move_branch(f: Dictionary, qid: String, k: int, d: int) -> void:
	var i := quest_index(f, qid)
	if i < 0:
		return
	var nx: Array = f["quests"][i].get("next", []) if f["quests"][i].get("next") is Array else []
	var j := k + d
	if k < 0 or j < 0 or k >= nx.size() or j >= nx.size() or HSCond.empty(nx[k].get("if")) or HSCond.empty(nx[j].get("if")):
		return
	var t = nx[k]
	nx[k] = nx[j]
	nx[j] = t


## a new quest at the end of the list (the first a file has is its Intro); the quest that was last keeps going where it
## went (an ending, written down now that the list's order would send it to the new one)
static func add_quest(f: Dictionary, id: String, title: String) -> void:
	var qs: Array = f["quests"]
	var li := qs.size() - 1                        # the last quest in the story's order (the eggs aren't in it)
	while li >= 0 and qs[li] is Dictionary and qs[li].get("egg", false) == true:
		li -= 1
	if li >= 0:
		var last: Dictionary = qs[li]
		var was := _after(qs, f.get("endings", []), li)
		if not (last.get("desk") is Dictionary) and was != ROAM and not _has_then(last):
			var nx: Array = last.get("next", []) if last.get("next") is Array else []
			nx.append({"go": was})
			last["next"] = nx
	var nq: Dictionary = HSStoryFile.INTRO.duplicate(true) if li < 0 else {"id": id, "title": title, "objective": "", "steps": []}
	nq["id"] = id
	if li >= 0 or title != "":
		nq["title"] = title if title != "" else nq["title"]
	qs.append(nq)


static func _has_then(q: Dictionary) -> bool:
	for o in (q.get("next", []) if q.get("next") is Array else []):
		if o is Dictionary and HSCond.empty(o.get("if")):
			return true
	return false


static func add_ending(f: Dictionary, id: String, title: String, kind := "neutral") -> void:
	(f["endings"] as Array).append({"id": id, "kind": kind, "title": title, "text": ""})


## an easter egg (the user, 2026-11-02): found during the quests that point at it (none: any), its FOUND WHEN picked next
static func add_egg(f: Dictionary, id: String, title: String) -> void:
	(f["quests"] as Array).append({"id": id, "title": title, "egg": true, "found": {}, "on_start": []})


## an egg found during a quest, or not any more (when none's left it's found during any quest)
static func set_during(f: Dictionary, eid: String, qid: String, on: bool) -> String:
	var i := quest_index(f, eid)
	if i < 0 or f["quests"][i].get("egg", false) != true:
		return "that's not an easter egg"
	var j := quest_index(f, qid)
	if j < 0 or f["quests"][j].get("egg", false) == true or f["quests"][j].get("desk") is Dictionary:
		return "an easter egg is found during a quest of the file's"
	var e: Dictionary = f["quests"][i]
	var d: Array = e.get("during", []) if e.get("during") is Array else []
	if on and not d.has(qid):
		d.append(qid)
	if not on:
		d.erase(qid)
	if d.is_empty():
		e.erase("during")
	else:
		e["during"] = d
	return ""


static func rename(f: Dictionary, id: String, title: String) -> void:
	var i := quest_index(f, id)
	if i >= 0:
		f["quests"][i]["title"] = title
		return
	var e := ending_index(f, id)
	if e >= 0:
		f["endings"][e]["title"] = title


## a quest or an ending taken away with what pointed at it: a way into a quest goes on where that quest went (its then,
## or the list's next), a way into an ending is taken away; the moments that were the quest's alone go with it, the
## others forget it; its place on the chart too
static func remove(f: Dictionary, id: String) -> void:
	var qs: Array = f["quests"]
	var endings: Array = f.get("endings", [])
	var succ := ""
	var i := quest_index(f, id)
	if i >= 0 and qs[i].get("egg", false) == true:   # an egg: nothing goes to it
		qs.remove_at(i)
		if f.get("chart") is Dictionary:
			(f["chart"] as Dictionary).erase(id)
		return
	if i >= 0:
		var x: Dictionary = qs[i]
		succ = _then_target(x)
		if succ == "":
			succ = _after(qs, endings, i)
		var pi := i - 1                           # the quest before it in the story's order
		while pi >= 0 and qs[pi].get("egg", false) == true:
			pi -= 1
		var prev_by_list := pi >= 0 and not (qs[pi].get("desk") is Dictionary) and not _has_then(qs[pi])
		qs.remove_at(i)
		if prev_by_list and succ != ROAM and succ != id and succ != _after(qs, endings, pi):
			var p: Dictionary = qs[pi]
			var nx: Array = p.get("next", []) if p.get("next") is Array else []
			nx.append({"go": succ})
			p["next"] = nx
		for e in qs:                              # an egg found during it alone is found during any quest now
			if e is Dictionary and e.get("egg", false) == true and e.get("during") is Array and (e["during"] as Array).has(id):
				(e["during"] as Array).erase(id)
				if (e["during"] as Array).is_empty():
					e.erase("during")
		f["moments"] = (f.get("moments", []) as Array).filter(func(m):
			return not (m is Dictionary and m.get("during") is Array and m["during"] == [id]))
		for m in f["moments"]:
			if m is Dictionary and m.get("during") is Array and (m["during"] as Array).has(id):
				(m["during"] as Array).erase(id)
	else:
		var e := ending_index(f, id)
		if e < 0:
			return
		endings.remove_at(e)
	var to_ok := succ != "" and succ != ROAM and succ != id
	for q in qs:
		if not (q is Dictionary) or q.get("desk") is Dictionary:
			continue
		if q.get("next") is Array:
			var keep: Array = []
			for o in q["next"]:
				if o is Dictionary and str(o.get("go", "")) == id:
					if not to_ok:
						continue
					o["go"] = succ
				keep.append(o)
			if keep.is_empty():
				q.erase("next")
			else:
				q["next"] = keep
		if str(q.get("on_timeout", "")) == id:
			if to_ok:
				q["on_timeout"] = succ
			else:
				q.erase("on_timeout")
	if f.get("chart") is Dictionary:
		(f["chart"] as Dictionary).erase(id)


## a quest's own then, written in its next ("" when it goes by the list)
static func _then_target(q: Dictionary) -> String:
	for o in (q.get("next", []) if q.get("next") is Array else []):
		if o is Dictionary and HSCond.empty(o.get("if")):
			return str(o.get("go", ""))
	return ""


## the quests numbered by the flow: the list put in the order the story reaches them (from the first, along each
## card's then first, then its other ways), the ways written down first and made plain again after, so the game plays
## the same. The quest that goes on to the free roam stays last
static func renumber(f: Dictionary) -> void:
	var qs: Array = f.get("quests", []) if f.get("quests") is Array else []
	if qs.size() < 3:
		return
	var endings: Array = f.get("endings", [])
	var roam_last := ""
	for i in qs.size():                           # 1. every quest's way on written down
		var q: Dictionary = qs[i]
		if q.get("desk") is Dictionary or q.get("egg", false) == true or _has_then(q):
			continue
		var to := _after(qs, endings, i)
		if to == ROAM:
			roam_last = str(q.get("id", ""))
			continue
		var nx: Array = q.get("next", []) if q.get("next") is Array else []
		nx.append({"go": to})
		q["next"] = nx
	var ch := chart(f)                            # 2. the order the story reaches them
	var by_id := {}
	for c in ch["cards"]:
		by_id[c["id"]] = c
	var order: Array = []
	var seen := {}
	var first := ""
	for q in qs:
		if q.get("egg", false) != true:
			first = str(q.get("id", ""))
			break
	var stack: Array = [first]
	while stack.size():
		var id: String = stack.pop_back()
		if seen.has(id) or not by_id.has(id) or quest_index(f, id) < 0:
			continue
		seen[id] = true
		if id != roam_last:
			order.append(id)
		var outs: Array = by_id[id]["outs"]
		var others: Array = []
		for o in outs:
			if o["kind"] != "then" and o["kind"] != "else":
				others.append(str(o["to"]))
		others.reverse()
		stack.append_array(others)
		for o in outs:                            # its then on top: the next one taken
			if o["kind"] == "then" or o["kind"] == "else":
				stack.append(str(o["to"]))
	for q in qs:
		var id := str(q.get("id", ""))
		if not seen.has(id) and id != roam_last and q.get("egg", false) != true:
			order.append(id)
	if roam_last != "":
		order.append(roam_last)
	for q in qs:                                  # the eggs last: found, not in the order
		if q.get("egg", false) == true:
			order.append(str(q.get("id", "")))
	var keep := {}
	for q in qs:
		keep[str(q.get("id", ""))] = q
	qs.clear()                                    # 3. the list in that order
	for id in order:
		qs.append(keep[id])
	for i in qs.size():                           # 4. a then that's the list's next again left to the list
		var q: Dictionary = qs[i]
		if q.get("desk") is Dictionary or q.get("egg", false) == true or not (q.get("next") is Array) or (q["next"] as Array).is_empty():
			continue
		var last = q["next"].back()
		if last is Dictionary and HSCond.empty(last.get("if")) and str(last.get("go", "")) == _after(qs, endings, i):
			(q["next"] as Array).pop_back()
			if (q["next"] as Array).is_empty():
				q.erase("next")
