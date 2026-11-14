@tool
## Who names what (docs/FLAGS.md §3): every flag, task and thing carried that anything in a scene asks for or changes,
## read off the nodes' own fields, nothing run. The Flags tab lists them, the pickers offer them, a rename moves every
## use, and F7 in the game shows them.
##
## One table (`FIELDS`) says which fields hold names and how each holds them; a marker's Starts when, a door's
## Locked By, an area's Needs and Fact, a flag switch's Flags, the Story's Task Flags are all read by it. A new script
## that names its fields the same way is read with no change here.
##     var found := HSLogicScan.scan(scene_root)       # {flag: {name: [use]}, task: {...}, item: {...}, nodes: [...]}
##     HSLogicScan.renamed(value, "cond", "flag", "old", "new")
## A use is {node, prop, kind, name, role}: kind "flag", "task" or "item"; role what the field does with it:
##     needs, needs_not   it must be so (or not) for something to happen
##     on, off, flip      a flag switched            start   a flag on when the game starts
##     ticks, adds        a task ticked, or put on the list
##     open, not_open     a task on the list and not ticked yet
##     gives              a thing put in the pocket
class_name HSLogicScan
extends RefCounted

## which fields hold names, and how (their encoding):
##   cond        a condition's words: "met_alex, !task:key, item:soda"     conds   several, one a line
##   lock        a door's lock: "flag:<name>", else a thing's name
##   switch      flags switched: "+a, -b, ~c"                              switches   the same, one a line
##   flag        one flag's name, turned on                                 flags   names, one a line, on at the start
##   task        one task's id, ticked                                      tasks   "id: what it says" lines, put on the list
##   task_flags  the Story's: "id: +a, -b" as a task is ticked, "added id: +a" as it's listed
##   item        one thing's name, put in the pocket
##   rules       a marker's face rules: "cond => face"                      talks   a marker's conversations
const FIELDS := {
	"needs": "cond", "when": "cond", "start_when": "cond", "starts_when": "cond", "repeat_until": "cond",
	"shown_when": "cond", "hidden_when": "cond", "ends_when": "cond", "while_needs": "cond", "sleep_needs": "cond",
	"no_sleep": "conds", "locked_by": "lock",
	"set_flags": "switch", "flags": "switches", "fact": "flag", "flag": "flag", "slept_fact": "flag",
	"flags_start": "flags", "task_flags": "task_flags",
	"tick": "task", "reveal_task": "task", "low_task": "task", "add_tasks": "tasks", "tasks": "tasks",
	"item": "item", "face_rules": "rules", "talks": "talks",
}
## fields whose names are too plain to trust on a script that isn't the studio's (a `flags` of your own may be numbers)
const PLAIN := ["when", "flags", "flag", "fact", "tick", "item", "tasks"]
## what a field is called in plain words
const SAYS := {
	"needs": "Needs", "when": "When", "start_when": "Starts when", "starts_when": "Starts when", "repeat_until": "Repeats until",
	"shown_when": "Shown when", "hidden_when": "Hidden when", "ends_when": "Ends when", "while_needs": "While",
	"sleep_needs": "Sleep needs", "no_sleep": "No sleep while", "locked_by": "Locked by",
	"set_flags": "Then", "flags": "Switches", "fact": "Sets", "flag": "Sets", "slept_fact": "Sets",
	"flags_start": "On at the start", "task_flags": "When a task is ticked",
	"tick": "Ticks", "reveal_task": "Shows the task", "low_task": "Adds the task", "add_tasks": "Adds the task", "tasks": "On the list at the start",
	"item": "Gives", "face_rules": "Face rule", "talks": "Conversation",
}
const TYPES := {"cond": TYPE_STRING, "lock": TYPE_STRING, "switch": TYPE_STRING, "flag": TYPE_STRING, "task": TYPE_STRING, "item": TYPE_STRING,
	"conds": TYPE_PACKED_STRING_ARRAY, "switches": TYPE_PACKED_STRING_ARRAY, "flags": TYPE_PACKED_STRING_ARRAY, "tasks": TYPE_PACKED_STRING_ARRAY,
	"task_flags": TYPE_PACKED_STRING_ARRAY, "rules": TYPE_PACKED_STRING_ARRAY, "talks": TYPE_ARRAY}
const SETS := ["on", "off", "flip", "start", "ticks", "adds", "gives"]          # roles that change something
const ASKS := ["needs", "needs_not", "open", "not_open"]                         # roles that ask


## A field of lines as lines. (In the editor a script that isn't a tool is a stand-in for itself, and a list nobody
## has set yet reads as a plain empty Array there, not as the PackedStringArray it's declared as.)
static func lines(v) -> PackedStringArray:
	if v is PackedStringArray:
		return v
	if v is Array:
		var out := PackedStringArray()
		for x in (v as Array):
			out.append(str(x))
		return out
	return PackedStringArray()


## is this script one of the studio's (the starter kit's, a HorrorStudio plugin's)?
static func studio(node: Object) -> bool:
	var sc: Script = node.get_script() if node != null else null
	var path := sc.resource_path if sc != null else ""
	return path.begins_with("res://starter/") or path.begins_with("res://addons/horrorstudio_")


## the fields of a node that hold names: [[prop, encoding]]
static func fields_of(node: Object) -> Array:
	var out := []
	if node == null or node.get_script() == null:
		return out
	var mine := studio(node)
	for prop in FIELDS:
		if not (prop in node):
			continue
		if prop in PLAIN and not mine:
			continue
		var enc := String(FIELDS[prop])
		var have := typeof(node.get(prop))
		if have != int(TYPES[enc]) and not (int(TYPES[enc]) == TYPE_PACKED_STRING_ARRAY and have == TYPE_ARRAY):
			continue
		if enc == "task" and prop == "tick" and node.has_method("tick"):       # (the Story's own tick() is a method, not a field)
			continue
		out.append([prop, enc])
	return out


## the names a value holds: [{kind, name, role}]
static func names_in(value, enc: String) -> Array:
	var out := []
	match enc:
		"cond":
			for w in HSNpcCond.words(String(value)):
				var p := HSNpcCond.parse(w)
				var a := String(p["arg"])
				var neg := bool(p["neg"])
				if a == "":
					continue
				match String(p["kind"]):
					"flag":
						if not String(p["word"]).begins_with("@"):
							out.append({"kind": "flag", "name": a, "role": "needs_not" if neg else "needs"})
					"task":
						out.append({"kind": "task", "name": a, "role": "needs_not" if neg else "needs"})
					"on":
						out.append({"kind": "task", "name": a, "role": "not_open" if neg else "open"})
					"item":
						out.append({"kind": "item", "name": a, "role": "needs_not" if neg else "needs"})
		"conds":
			for line in lines(value):
				out.append_array(names_in(String(line), "cond"))
		"lock":
			var s := String(value).strip_edges()
			if s.begins_with("flag:"):
				if s.substr(5) != "never" and s.substr(5) != "":
					out.append({"kind": "flag", "name": s.substr(5), "role": "needs"})
			elif s != "":
				out.append({"kind": "item", "name": s, "role": "needs"})
		"switch":
			for f in HSNpcCond.switched(String(value)):
				out.append({"kind": "flag", "name": String(f["name"]), "role": {"+": "on", "-": "off", "~": "flip"}[String(f["op"])]})
		"switches":
			for line in lines(value):
				out.append_array(names_in(String(line), "switch"))
		"flag":
			var f := String(value).strip_edges().trim_prefix("+").strip_edges()
			if f != "":
				out.append({"kind": "flag", "name": f, "role": "on"})
		"flags":
			for line in lines(value):
				for f2 in HSNpcCond.switched(String(line)):
					out.append({"kind": "flag", "name": String(f2["name"]), "role": "start"})
		"task":
			if String(value).strip_edges() != "":
				out.append({"kind": "task", "name": String(value).strip_edges(), "role": "ticks"})
		"tasks":
			for line in lines(value):
				var id := String(line).get_slice(":", 0).strip_edges()
				if id != "":
					out.append({"kind": "task", "name": id, "role": "adds"})
		"task_flags":
			for line in lines(value):
				var at := String(line).find(":")
				if at <= 0:
					continue
				var key := String(line).substr(0, at).strip_edges()
				var listed := key.begins_with("added ")
				var tid := key.substr(6).strip_edges() if listed else key
				if tid != "":
					out.append({"kind": "task", "name": tid, "role": "open" if listed else "needs"})
				out.append_array(names_in(String(line).substr(at + 1), "switch"))
		"item":
			if String(value).strip_edges() != "":
				out.append({"kind": "item", "name": String(value).strip_edges(), "role": "gives"})
		"rules":
			for line in lines(value):
				var cut := String(line).find("=>")
				if cut >= 0:
					out.append_array(names_in(String(line).substr(0, cut), "cond"))
		"talks":
			for c in (value as Array):
				if not (c is Dictionary):
					continue
				out.append_array(names_in(String((c as Dictionary).get("when", "")), "cond"))
				out.append_array(names_in(String((c as Dictionary).get("sets", "")), "switch"))
				for a2 in ((c as Dictionary).get("answers", []) as Array):
					if a2 is Dictionary:
						out.append_array(names_in(String((a2 as Dictionary).get("sets", "")), "switch"))
	return out


## every use a node makes of a flag, a task or a thing carried: [{node, prop, enc, kind, name, role}]
static func uses_of(node: Node) -> Array:
	var out := []
	for f in fields_of(node):
		for u in names_in(node.get(f[0]), String(f[1])):
			u["node"] = node
			u["prop"] = f[0]
			u["enc"] = f[1]
			out.append(u)
	return out


## The whole scene read: {flag: {name: [use]}, task: {...}, item: {...}, nodes: [every node with a use]}. A character
## with markers (an HSNpc) also sets three flags by herself: talked:<id>, shot:<id>, down:<id> (prop "": by itself).
static func scan(root: Node) -> Dictionary:
	var out := {"flag": {}, "task": {}, "item": {}, "nodes": []}
	if root == null:
		return out
	var todo: Array = [root]
	while not todo.is_empty():
		var n: Node = todo.pop_back()
		var kids := n.get_children()
		kids.reverse()
		todo.append_array(kids)
		if String(n.name).begins_with("_"):
			continue
		var us := uses_of(n)
		if n is HSNpc:
			for k in ["talked:", "shot:", "down:"]:
				us.append({"node": n, "prop": "", "enc": "", "kind": "flag", "name": k + (n as HSNpc).id(), "role": "on"})
		if us.is_empty():
			continue
		out["nodes"].append(n)
		for u in us:
			var by: Dictionary = out[u["kind"]]
			if not by.has(u["name"]):
				by[u["name"]] = []
			(by[u["name"]] as Array).append(u)
	return out


## the names of a kind a scene knows, sorted
static func names(found: Dictionary, kind: String) -> PackedStringArray:
	var out := PackedStringArray()
	for k in (found.get(kind, {}) as Dictionary).keys():
		out.append(String(k))
	out.sort()
	return out


## how many of a name's uses change it, and how many ask for it
static func counts(uses: Array) -> Dictionary:
	var c := {"sets": 0, "asks": 0}
	for u in uses:
		if String(u["role"]) in SETS:
			c["sets"] += 1
		else:
			c["asks"] += 1
	return c


## a flag the kit sets by itself: a name with a colon (talked:alex, hunt:night, sanity:shaken)
static func kit_flag(name: String) -> bool:
	return name.contains(":")


## Whose a name is, worked out from who uses it: "" the game's (a thing uses it, or more than one character),
## "<npc id>" one character's, "<npc id>/<quest>" one quest's. `uses`: its uses.
static func home_of(uses: Array) -> String:
	var npcs := {}
	var quests := {}
	var things := false
	for u in uses:
		var node := u["node"] as Node
		var npc := HSNpcFlow.npc_of(node)
		if npc == null or String(u["prop"]) == "":
			if npc == null:
				things = true
			continue
		npcs[npc] = true
		var q := HSNpcFlow.quest_of(node)
		if q != null:
			quests[q] = true
		else:
			quests[npc] = true
	if things or npcs.size() != 1:
		return ""
	var who := (npcs.keys()[0] as HSNpc).id()
	if quests.size() == 1 and quests.keys()[0] is HSNpcQuest:
		return who + "/" + (quests.keys()[0] as HSNpcQuest).label()
	return who


## where a use is, in plain words: "Alex › The missing book › 3 Talk", "Door304 (door)"
static func place(node: Node) -> String:
	if node == null or not is_instance_valid(node):
		return "(gone)"
	var npc := HSNpcFlow.npc_of(node) as HSNpc
	if npc != null:
		var parts := PackedStringArray([npc.display_name()])
		var q := HSNpcFlow.quest_of(node)
		if q != null:
			parts.append(q.label())
		if node is HSNpcMarker:
			parts.append("%s %s" % [HSNpcFlow.label_of(node), (node as HSNpcMarker).title()])
		elif node is HSNpcWay:
			parts.append("%s %s" % [HSNpcFlow.label_of(node), (node as HSNpcWay).title()])
		return " › ".join(parts)
	if node is HSLogic:                                        # a thing's Logic is said as the thing; one by itself as a rule
		var lg := node as HSLogic
		var t := lg.thing_node()
		if lg.on == "itself" and lg.thing.is_empty():
			return "%s (rule)" % lg.name
		if t != null and t != node:
			return "%s (%s)" % [t.name, what(t)]
	return "%s (%s)" % [node.name, what(node)]


## what kind of thing a node is, by its script: "door", "pickup", "Logic", "event area"
static func what(node: Node) -> String:
	if node is HSLogic:
		return "Logic"
	var sc: Script = node.get_script()
	if sc == null:
		return node.get_class()
	var g := String(sc.get_global_name())
	if g != "":
		return g.trim_prefix("HSNpc").trim_prefix("HS") if g.begins_with("HS") else g
	return sc.resource_path.get_file().get_basename().replace("_", " ")


## what a use does, in plain words: "needs it on", "turns it on", "ticks it"
static func role_says(role: String, kind := "flag") -> String:
	match role:
		"needs":
			return "needs it on" if kind == "flag" else ("needs it done" if kind == "task" else "needs it carried")
		"needs_not":
			return "needs it off" if kind == "flag" else ("needs it not done" if kind == "task" else "needs it not carried")
		"on":
			return "turns it on"
		"off":
			return "turns it off"
		"flip":
			return "flips it"
		"start":
			return "on at the start"
		"ticks":
			return "ticks it"
		"adds":
			return "puts it on the list"
		"open":
			return "needs it open"
		"not_open":
			return "needs it not open"
		"gives":
			return "gives it"
	return role


# ---- a name changed everywhere -------------------------------------------------------------------------------------------------
# one condition word with its name changed ("" out: the word dropped)
static func _cond_renamed(text: String, kind: String, old: String, new: String) -> String:
	var ws := PackedStringArray()
	for w in HSNpcCond.words(text):
		var p := HSNpcCond.parse(w)
		var pk := String(p["kind"])
		var hit := String(p["arg"]) == old and not String(p["word"]).begins_with("@") and \
				((kind == "flag" and pk == "flag") or (kind == "task" and pk in ["task", "on"]) or (kind == "item" and pk == "item"))
		if not hit:
			ws.append(w)
		elif new != "":
			ws.append(("!" if bool(p["neg"]) else "") + ("" if pk == "flag" else pk + ":") + new)
	return ", ".join(ws)


static func _switch_renamed(text: String, old: String, new: String) -> String:
	var ws := PackedStringArray()
	for part in text.split(",", false):
		var w := part.strip_edges()
		if w == "":
			continue
		var op := w[0] if w[0] in ["+", "-", "~"] else ""
		var nm := w.substr(1).strip_edges() if op != "" else w
		if nm != old:
			ws.append(w)
		elif new != "":
			ws.append(op + new)
	return ", ".join(ws)


static func _lines(value, change: Callable) -> PackedStringArray:
	var out := PackedStringArray()
	for line in lines(value):
		var now := String(change.call(String(line)))
		if now.strip_edges() != "" or String(line).strip_edges() == "":
			out.append(now)
	return out


## A field's value with a name changed to another (`new` "": taken out). kind: "flag", "task" or "item".
static func renamed(value, enc: String, kind: String, old: String, new: String):
	match enc:
		"cond":
			return _cond_renamed(String(value), kind, old, new)
		"conds":
			return _lines(value, func(l: String) -> String: return _cond_renamed(l, kind, old, new))
		"lock":
			var s := String(value).strip_edges()
			if kind == "flag" and s == "flag:" + old:
				return ("flag:" + new) if new != "" else ""
			if kind == "item" and s == old:
				return new
			return value
		"switch":
			return _switch_renamed(String(value), old, new) if kind == "flag" else value
		"switches":
			return _lines(value, func(l: String) -> String: return _switch_renamed(l, old, new)) if kind == "flag" else value
		"flag":
			return new if kind == "flag" and String(value).strip_edges().trim_prefix("+").strip_edges() == old else value
		"flags":
			return _lines(value, func(l: String) -> String: return _switch_renamed(l, old, new)) if kind == "flag" else value
		"task":
			return new if kind == "task" and String(value).strip_edges() == old else value
		"item":
			return new if kind == "item" and String(value).strip_edges() == old else value
		"tasks":
			if kind != "task":
				return value
			return _lines(value, func(l: String) -> String:
				var at := l.find(":")
				var id := (l.substr(0, at) if at >= 0 else l).strip_edges()
				if id != old:
					return l
				return (new + l.substr(at)) if new != "" and at >= 0 else new)
		"task_flags":
			return _lines(value, func(l: String) -> String:
				var at := l.find(":")
				if at <= 0:
					return l
				var key := l.substr(0, at).strip_edges()
				var rest := l.substr(at + 1)
				if kind == "flag":
					var sw := _switch_renamed(rest, old, new)
					return (key + ": " + sw) if sw != "" else ""
				if kind == "task":
					var listed := key.begins_with("added ")
					var tid := key.substr(6).strip_edges() if listed else key
					if tid == old:
						return (("added " if listed else "") + new + ":" + rest) if new != "" else ""
				return l)
		"rules":
			return _lines(value, func(l: String) -> String:
				var cut := l.find("=>")
				if cut < 0:
					return l
				return _cond_renamed(l.substr(0, cut), kind, old, new) + " " + l.substr(cut).strip_edges())
		"talks":
			var out: Array[Dictionary] = []
			for c in (value as Array):
				var d: Dictionary = (c as Dictionary).duplicate(true)
				if d.has("when"):
					d["when"] = _cond_renamed(String(d["when"]), kind, old, new)
				if kind == "flag":
					if d.has("sets"):
						d["sets"] = _switch_renamed(String(d["sets"]), old, new)
					for a in (d.get("answers", []) as Array):
						if a is Dictionary and (a as Dictionary).has("sets"):
							a["sets"] = _switch_renamed(String(a["sets"]), old, new)
				out.append(d)
			return out
	return value


## every change a rename needs: [[node, prop, new value]] (only the fields that really change)
static func rename_plan(found: Dictionary, kind: String, old: String, new: String) -> Array:
	var out := []
	var seen := {}
	for u in ((found.get(kind, {}) as Dictionary).get(old, []) as Array):
		var node := u["node"] as Node
		var prop := String(u["prop"])
		if prop == "" or not is_instance_valid(node) or seen.has([node, prop]):
			continue
		seen[[node, prop]] = true
		var was = node.get(prop)
		if int(TYPES[String(u["enc"])]) == TYPE_PACKED_STRING_ARRAY:
			was = lines(was)
		var now = renamed(was, String(u["enc"]), kind, old, new)
		if typeof(now) != typeof(was) or now != was:
			out.append([node, prop, now])
	return out


# ---- what can't work -----------------------------------------------------------------------------------------------------------
## What's wrong with the names of a scene: [{kind, name, level, text, node}]. `notes`: the flags written down in
## res://flags.json ({name: {note, home}}): one written down and used nowhere is said, one that belongs to a quest and
## is used outside it is said.
static func problems(found: Dictionary, notes := {}) -> Array:
	var out := []
	var flags: Dictionary = found.get("flag", {})
	for name in flags:
		var uses: Array = flags[name]
		var c := counts(uses)
		if c["sets"] == 0 and not kit_flag(String(name)):
			out.append({"kind": "flag", "name": name, "level": "warn", "node": uses[0]["node"],
				"text": "'%s' is asked for (%s) and nothing turns it on." % [name, place(uses[0]["node"])]})
		elif c["asks"] == 0 and not kit_flag(String(name)):
			out.append({"kind": "flag", "name": name, "level": "tip", "node": uses[0]["node"],
				"text": "'%s' is switched (%s) and nothing asks for it yet." % [name, place(uses[0]["node"])]})
		var home := String((notes.get(name, {}) as Dictionary).get("home", ""))
		if home != "" and home != "game":
			for u in uses:
				if not _inside(u["node"], home) and String(u["prop"]) != "":
					out.append({"kind": "flag", "name": name, "level": "warn", "node": u["node"],
						"text": "'%s' belongs to %s, and %s uses it. Make it the game's, or use another flag there." % [name, home.replace("/", " › "), place(u["node"])]})
					break
	for name in notes:
		if not flags.has(name):
			out.append({"kind": "flag", "name": name, "level": "tip", "node": null, "text": "'%s' is written down and nothing uses it yet." % name})
	var tasks: Dictionary = found.get("task", {})
	for name in tasks:
		var adds := false
		for u in (tasks[name] as Array):
			if String(u["role"]) == "adds":
				adds = true
		if not adds:
			out.append({"kind": "task", "name": name, "level": "warn", "node": tasks[name][0]["node"],
				"text": "The task '%s' is used (%s) and nothing puts it on the list." % [name, place(tasks[name][0]["node"])]})
	var items: Dictionary = found.get("item", {})
	for name in items:
		var given := false
		for u in (items[name] as Array):
			if String(u["role"]) == "gives":
				given = true
		if not given:
			out.append({"kind": "item", "name": name, "level": "tip", "node": items[name][0]["node"],
				"text": "'%s' is asked for (%s) and nothing in this scene gives it (the laptop's shop, a script?)." % [name, place(items[name][0]["node"])]})
	return out


# is a node inside a home ("<npc id>" or "<npc id>/<quest>")?
static func _inside(node: Node, home: String) -> bool:
	var npc := HSNpcFlow.npc_of(node) as HSNpc
	if npc == null or npc.id() != home.get_slice("/", 0):
		return false
	if not home.contains("/"):
		return true
	var q := HSNpcFlow.quest_of(node)
	return q != null and q.label() == home.get_slice("/", 1)
