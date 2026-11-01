@tool
class_name HSCond
extends RefCounted
## A condition of the Director's (docs/GODOT_DIRECTOR.md §2, DECISIONS 2026-11-01: "has the player done this, if so
## they can now do this"): read from the run's facts, which the brain writes down as the player plays (the run's
## flags, saved with it). The Director file asks one wherever it needs to: a quest's next, a moment's if, a person's
## conversation, a line's or an answer's if, a state's while, an achievement's when.
##
##   "read:letter"        a fact (what the player did: used:<id>, picked:<item>, read:<note>, entered:<area>,
##                        left:<area>, talked:<id>, heard:<id>, answered:<talk>:<answer>, gave:<item>:<who>, step:<id>,
##                        failed:<id>, done:<quest>, ending:<id>; or a flag of your own)
##   "!read:letter"       not that fact
##   {"all": [...]}, {"any": [...]}, {"not": c}; a list is all of it
##   {"quest": "q_tea"}   that quest is the one on now
##   {"done": "q_tea"}, {"step": "s_on"}, {"ending": "e_x"}   finished, ticked, reached
##   {"count": "cups", "at_least": 3, "at_most": 5, "is": 4}; {"karma": {"at_least": 2}}; {"has": "key"} (held)
## Empty (null, "", {}, []) always holds.


## ctx: {flags: Dictionary (a set), counters: Dictionary, karma: float, items: Dictionary (a set), quest: String}
static func holds(c, ctx: Dictionary) -> bool:
	if c == null:
		return true
	if c is String:
		if c == "":
			return true
		if c.begins_with("!"):
			return not ctx["flags"].has(c.substr(1))
		return ctx["flags"].has(c)
	if c is Array:
		for x in c:
			if not holds(x, ctx):
				return false
		return true
	if not (c is Dictionary) or c.is_empty():
		return true
	if c.has("all"):
		return holds(c["all"] if c["all"] is Array else [c["all"]], ctx)
	if c.has("any"):
		var any_: Array = c["any"] if c["any"] is Array else [c["any"]]
		for x in any_:
			if holds(x, ctx):
				return true
		return any_.is_empty()
	if c.has("not"):
		return not holds(c["not"], ctx)
	if c.has("fact"):
		return ctx["flags"].has(str(c["fact"]))
	if c.has("quest"):
		return str(ctx.get("quest", "")) == str(c["quest"])
	if c.has("done"):
		return ctx["flags"].has("done:" + str(c["done"]))
	if c.has("step"):
		return ctx["flags"].has("step:" + str(c["step"]))
	if c.has("ending"):
		return ctx["flags"].has("ending:" + str(c["ending"]))
	if c.has("has"):
		return ctx["items"].has(str(c["has"]))
	if c.has("count"):
		return _range(float(ctx["counters"].get(str(c["count"]), 0)), c)
	if c.has("karma"):
		return _range(float(ctx.get("karma", 0.0)), c["karma"] if c["karma"] is Dictionary else {})
	return true


static func _range(v: float, c: Dictionary) -> bool:
	if c.has("at_least") and v < float(c["at_least"]):
		return false
	if c.has("at_most") and v > float(c["at_most"]):
		return false
	if c.has("is") and absf(v - float(c["is"])) > 1e-6:
		return false
	return true


static func empty(c) -> bool:
	return c == null or (c is String and c == "") or (c is Array and c.is_empty()) or (c is Dictionary and c.is_empty())


## the same condition always the same text (one flag for each, however often it's asked)
static func key(c) -> String:
	return JSON.stringify(c, "", true)


## what a condition reads: {"facts": {}, "quests": {}, "steps": {}, "endings": {}, "counters": {}, "items": {}}
## (the Manager's Facts list, the compiler's checks)
static func reads(c, out: Dictionary = {}) -> Dictionary:
	for k in ["facts", "quests", "steps", "endings", "counters", "items"]:
		if not out.has(k):
			out[k] = {}
	if c is String and c != "":
		out["facts"][c.trim_prefix("!")] = true
	elif c is Array:
		for x in c:
			reads(x, out)
	elif c is Dictionary:
		for k in ["all", "any"]:
			if c.has(k):
				reads(c[k] if c[k] is Array else [c[k]], out)
		if c.has("not"):
			reads(c["not"], out)
		if c.has("fact"):
			out["facts"][str(c["fact"])] = true
		if c.has("quest"):
			out["quests"][str(c["quest"])] = true
		if c.has("done"):
			out["quests"][str(c["done"])] = true
		if c.has("step"):
			out["steps"][str(c["step"])] = true
		if c.has("ending"):
			out["endings"][str(c["ending"])] = true
		if c.has("count"):
			out["counters"][str(c["count"])] = true
		if c.has("has"):
			out["items"][str(c["has"])] = true
	return out
