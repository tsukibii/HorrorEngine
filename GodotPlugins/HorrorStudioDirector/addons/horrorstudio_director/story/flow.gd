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


## the chart: {cards: [card], wires: [wire], start: id}. A card: {id, kind (intro, quest, round, scene, choice,
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
	for i in quests.size():
		var q = quests[i]
		if not (q is Dictionary):
			continue
		cards.append(_quest_card(q, i, quests, endings, ctx))
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
			else:
				o["missing"] = true
		if c["kind"] == "trigger" and c["during"] is Array:
			for qid in c["during"]:
				if by_id.has(str(qid)):
					wires.append({"from": str(qid), "out": -1, "to": c["id"], "kind": "during"})
	var start := ""
	for c in cards:
		if c["kind"] != "ending" and c["kind"] != "trigger":
			start = c["id"]
			break
	var out := {"cards": cards, "wires": wires, "start": start}
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
	for o in nx:
		if not (o is Dictionary):
			continue
		if HSCond.empty(o.get("if")):
			c["outs"].append({"label": "then", "to": str(o.get("go", "")), "kind": "then"})
			then = true
			break
		c["outs"].append({"label": "if " + HSCommands.cond_text(o["if"], ctx), "to": str(o.get("go", "")), "kind": "if"})
	if not then:
		var after := ROAM
		if i + 1 < quests.size() and quests[i + 1] is Dictionary:
			after = str(quests[i + 1].get("id", ""))
		elif endings.size() and endings[0] is Dictionary:
			after = str(endings[0].get("id", ""))
		var ifs: bool = not (c["outs"] as Array).is_empty()
		c["outs"].append({"label": "otherwise" if ifs else "then", "to": after, "kind": "else" if ifs else "then", "implicit": true})
	if float(q.get("time_limit", 0)) > 0.0 and str(q.get("on_timeout", "")) != "":
		c["outs"].append({"label": "out of time", "to": str(q["on_timeout"]), "kind": "timeout"})
	return c


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
