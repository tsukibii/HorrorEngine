## The to-do list (STORY_FORMAT §4; the desk's todo.js, ported): tasks ticked off in any order, by a tick or their own
## trigger, failed by fail, their own trigger or their time; kept with the run.
extends RefCounted

const STATES := ["open", "done", "failed"]

var rt
var list: Array = []


static func todo_add(lst: Array, a: Dictionary, now: float) -> Dictionary:
	var id = a["todo"]
	var old = todo_of(lst, id)
	var t: Dictionary = {"id": id, "text": a.get("text", str(id).replace("_", " ")), "state": "open", "at": now}
	for k in ["ticks", "fails", "secs", "on", "who", "hidden"]:
		if a.has(k):
			t[k] = a[k]
	if old != null:
		for k in t:
			old[k] = t[k]
		return old
	lst.append(t)
	return t


static func todo_of(lst: Array, id) -> Variant:
	for t in lst:
		if t["id"] == id:
			return t
	return null


## that task ticked, or (true) the list through: nothing open, at least one task
static func ticked(lst: Array, v) -> bool:
	if v is bool and v:
		if lst.is_empty():
			return false
		for t in lst:
			if t["state"] == "open":
				return false
		return true
	var t = todo_of(lst, v)
	return t != null and t["state"] == "done"


static func failed(lst: Array, v) -> bool:
	if v is bool and v:
		for t in lst:
			if t["state"] == "failed":
				return true
		return false
	var t = todo_of(lst, v)
	return t != null and t["state"] == "failed"


func _init(rt_) -> void:
	rt = rt_
	if rt.run != null:
		if not rt.run.has("todo"):
			rt.run["todo"] = []
		list = rt.run["todo"]
	show(false)


func add(a: Dictionary) -> void:
	todo_add(list, a, rt.clock)
	show(true)


func set_state(id, state: String) -> void:
	var t = todo_of(list, id)
	if t == null or t["state"] != "open":
		return
	t["state"] = state
	show(true)
	rt.emit({"type": "todo", "id": id, "state": state})
	var on = t.get("on", {})
	if on is Dictionary and on.has(state):
		rt.actions.run_all(on[state], rt)


func remove(v) -> void:
	if v is bool and v:
		list.clear()
	else:
		for i in list.size():
			if list[i]["id"] == v:
				list.remove_at(i)
				break
	show(false)


func event(ev: Dictionary) -> void:
	for t in list.duplicate():
		if t["state"] != "open":
			continue
		if t.has("ticks") and rt.conditions.matches(t["ticks"], ev, rt):
			set_state(t["id"], "done")
		elif t.has("fails") and rt.conditions.matches(t["fails"], ev, rt):
			set_state(t["id"], "failed")
		elif t.has("secs") and ev.get("type") == "tick" and rt.clock - float(t["at"]) >= float(t["secs"]):
			set_state(t["id"], "failed")
	if ev.get("type") == "tick":
		for t in list:
			if t["state"] == "open" and t.has("secs") and not t.get("hidden", false):
				show(false)
				break


func show(fresh: bool) -> void:
	var items: Array = []
	for t in list:
		if t.get("hidden", false):
			continue
		var who = null
		if t.has("who"):
			who = rt.story.cast_name(t["who"])
		var left = null
		if t.has("secs") and t["state"] == "open":
			left = max(0.0, float(t["secs"]) - (rt.clock - float(t["at"])))
		items.append({"id": t["id"], "text": t["text"], "state": t["state"], "who": who, "left": left})
	rt.hud.todo(items, fresh)
