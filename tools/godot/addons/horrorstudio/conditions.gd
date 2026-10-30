## Conditions: a beat's or an act choice's `when` (STORY_FORMAT §4; the desk's conditions.js, ported). The runtime
## sends events as they happen ({type: "enter", id}, {type: "use", id}, {type: "pickup", item}...) and a "tick" every
## frame for the ones that hold over time.
extends RefCounted

const VERBS := ["start", "enter", "exit", "use", "pickup", "read", "caught", "hidden", "answered", "flag", "after", "look", "rolled",
	"power", "locked", "peeping", "torch", "carrying", "dropped", "played", "state", "ticked", "failed", "arrived", "all", "any"]

var Todo := preload("res://addons/horrorstudio/todo.gd")


func verb_of(when) -> String:
	if not (when is Dictionary):
		return ""
	for k in when:
		if VERBS.has(k):
			return k
	return ""


func matches(when, ev: Dictionary, rt) -> bool:
	var v := verb_of(when)
	if v == "":
		return false
	var val = when[v]
	var t: String = ev.get("type", "")
	match v:
		"start":
			return t == "start"
		"enter":
			return t == "enter" and ev.get("id") == val
		"exit":
			return t == "exit" and ev.get("id") == val
		"use":
			return t == "use" and ev.get("id") == val
		"pickup":
			return t == "pickup" and ev.get("item") == val
		"read":
			return t == "read" and ev.get("note") == val
		"caught":
			return t == "caught" and ((val is bool and val) or val == ev.get("by"))
		"hidden":
			return rt.player.hiding != null and ((val is bool and val) or val == rt.player.hiding)
		"answered":
			return t == "answered" and ev.get("ask") == val and (not when.has("option") or ev.get("option") == when["option"])
		"flag":
			return rt.flags.has(val)
		"after":
			return t == "tick" and rt.ended.has(val) and rt.clock - float(rt.ended[val]) >= float(when.get("secs", 0))
		"look":
			return t == "tick" and rt.looked_at(val, float(when.get("within", 8))) >= float(when.get("secs", 1))
		"rolled":
			return t == "rolled" and ev.get("id") == val and (not when.has("face") or ev.get("face") == when["face"]) and (not when.has("at_least") or float(ev.get("face", 0)) >= float(when["at_least"]))
		"power":
			return ("on" if rt.powered() else "off") == val
		"locked":
			return bool(rt.door_of(val).get("locked", false))
		"peeping":
			return rt.player.peeping != null and rt.player.peeping.get("door") == val
		"torch":
			return t == "torch" and val == ("on" if ev.get("on") else "off")
		"carrying":
			return rt.carried() != null and ((val is bool and val) or val == rt.carried()["id"])
		"dropped":
			return t == "dropped" and ev.get("id") == val and (not when.has("in") or (ev.get("in", []) as Array).has(when["in"]))
		"played":
			return t == "played" and ev.get("id") == val and (not when.has("result") or ev.get("result") == when["result"])
		"state":
			return rt.state_of(val) == when.get("is")
		"ticked":
			return Todo.ticked(rt.todo.list, val)
		"failed":
			return Todo.failed(rt.todo.list, val)
		"arrived":
			var n = rt.npcs.get(val)
			return n != null and n["as"] == "go" and n["st"].get("arrived") != null and (not when.has("at") or n["st"]["arrived"] == when["at"])
		"all":
			for c in val:
				if not matches(c, ev, rt):
					return false
			return true
		"any":
			for c in val:
				if matches(c, ev, rt):
					return true
			return false
	return false
