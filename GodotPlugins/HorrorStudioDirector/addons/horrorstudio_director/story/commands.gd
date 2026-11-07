@tool
class_name HSCommands
extends RefCounted
## The Director's words for what happens (docs/GODOT_DIRECTOR.md §6e): the desk's commands and triggers, the Director
## Manager's too (tools/director/commands.js, tools/director_manager/words.js), as data in `commands.json` (written from
## them by tools/director_manager/commands_json.mjs: every command's label, group, hint, fields and what it's made as;
## the conditions' clauses and fact words), and how each reads as a sentence: commands.js's and words.js's sentences
## said again here, checked against the file's examples (DIRECTOR), so the panel and the Manager say the same.
## n: a Callable (kind, value) -> the name to show (the default: the value itself, "…" when empty).

const FILE := "res://addons/horrorstudio_director/story/commands.json"
static var _data: Dictionary = {}
static var _by_action: Dictionary = {}
static var _by_trigger: Dictionary = {}


static func data() -> Dictionary:
	if _data.is_empty():
		var j = JSON.parse_string(FileAccess.get_file_as_string(FILE)) if FileAccess.file_exists(FILE) else null
		_data = j if j is Dictionary else {"actions": [], "triggers": [], "groups": [], "tricks": {}, "trick_labels": {}, "behave_fields": {}, "clauses": [], "fact_words": [], "examples": []}
		for d in _data["actions"]:
			_by_action[d["verb"]] = d
		for d in _data["triggers"]:
			_by_trigger[d["verb"]] = d
	return _data


static func actions() -> Array:
	return data()["actions"]


static func triggers() -> Array:
	return data()["triggers"]


static func action_def(verb) -> Dictionary:
	data()
	return _by_action.get(str(verb), {})


static func trigger_def(verb) -> Dictionary:
	data()
	return _by_trigger.get(str(verb), {})


## the command's verb: its first key that's one (commands.js verbOfAction)
static func verb_of_action(a) -> String:
	data()
	if not (a is Dictionary) or a.is_empty():
		return ""
	for k in a:
		if _by_action.has(str(k)):
			return str(k)
	return str(a.keys()[0])


static func verb_of_trigger(w) -> String:
	data()
	if not (w is Dictionary) or w.is_empty():
		return ""
	for k in w:
		if _by_trigger.has(str(k)):
			return str(k)
	return str(w.keys()[0])


## the fields a command's form shows: its own, then the ones its choice adds (a trick's, a behaviour's)
static func fields_of(d: Dictionary, a: Dictionary) -> Array:
	var out: Array = (d.get("fields", []) as Array).duplicate()
	match str(d.get("more", "")):
		"tricks":
			out.append_array(data()["tricks"].get(str(a.get("trick", "")), []))
		"behave":
			out.append_array(data()["behave_fields"].get(str(a.get("as", "idle")) if a.get("as") else "idle", []))
	return out


# ---- JavaScript's ways, for the same sentences --------------------------------------------------------------------
## truthy as JavaScript: null, false, 0, "" and NaN aren't (an array or an object always is)
static func _t(v) -> bool:
	if v == null:
		return false
	match typeof(v):
		TYPE_BOOL:
			return v
		TYPE_INT, TYPE_FLOAT:
			return v != 0 and not is_nan(float(v))
		TYPE_STRING, TYPE_STRING_NAME:
			return str(v) != ""
	return true


## a value as JavaScript's `${v}` writes it (2.0 is "2", null "null")
static func js(v) -> String:
	if v == null:
		return "null"
	match typeof(v):
		TYPE_BOOL:
			return "true" if v else "false"
		TYPE_INT:
			return str(v)
		TYPE_FLOAT:
			var f := float(v)
			if is_nan(f):
				return "NaN"
			if f == floorf(f) and absf(f) < 1e15:
				return str(int(f))
			return str(f)
		TYPE_ARRAY:
			return ",".join(PackedStringArray((v as Array).map(func(x): return js(x))))
		TYPE_DICTIONARY:
			return "[object Object]"
	return str(v)


## `a || b`
static func _or(a, b):
	return a if _t(a) else b


## `a ?? b`
static func _qq(a, b):
	return a if a != null else b


static func _num(v) -> float:
	if v is int or v is float:
		return float(v)
	if v is bool:
		return 1.0 if v else 0.0
	if v is String and (v as String).strip_edges().is_valid_float():
		return float(v)
	if v == null:
		return 0.0
	return NAN


static func q(s) -> String:
	return "“%s”" % js(s)


static func plus(n) -> String:
	var x := _num(n)
	return ("+" if x > 0 else "") + js(x)


static func span(s) -> String:
	var x := _num(s)
	if is_nan(x) or x == 0.0:
		x = 0.0
	var h := floori(x / 3600.0)
	var m := floori(fmod(x, 3600.0) / 60.0 + 0.5)
	if h != 0 and m != 0:
		return "%d h %d min" % [h, m]
	if h != 0:
		return "%d h" % h
	if m != 0:
		return "%d min" % m
	return "%s s" % js(x)


static func cap(s: String) -> String:
	return s.substr(0, 1).to_upper() + s.substr(1) if s != "" else s


## the default naming: the value itself, "…" when there's none
static func plain_name(_kind, v) -> String:
	return "…" if v == null or (v is String and v == "") else js(v)


static func _n(n: Callable) -> Callable:
	return n if n.is_valid() else Callable(HSCommands, "plain_name")


# ---- what a command reads as (commands.js actionText) ---------------------------------------------------------------
static func action_text(a, n: Callable = Callable()) -> String:
	n = _n(n)
	if not (a is Dictionary):
		return JSON.stringify(a)
	var v := verb_of_action(a)
	if action_def(v).is_empty():
		return JSON.stringify(a)
	var g := func(k): return a.get(k)
	match v:
		"objective":
			return ("Objective: " + q(a["objective"])) if _t(g.call("objective")) else "Clear the objective"
		"say":
			return "Say " + n.call("line", g.call("say"))
		"think":
			return "Think " + q(_or(g.call("think"), "…")) + ((", then retyped as " + q(a["retype"])) if _t(g.call("retype")) else "") + (", breaking off" if _t(g.call("breaks")) else "")
		"name":
			return "Ask the player's name" + ((" (" + q(a["name"]) + ")") if _t(g.call("name")) else "") + ((", else " + q(a["default"])) if _t(g.call("default")) else "")
		"ask":
			return "Ask " + (n.call("line", a["line"]) if _t(g.call("line")) else q(_or(g.call("text"), g.call("ask")))) + ((" beside " + n.call("cast", a["who"])) if _t(g.call("who")) else "")
		"todo":
			return ("Hidden to do" if _t(g.call("hidden")) else "To do") + ": " + q(_or(g.call("text"), g.call("todo"))) + ((" for " + n.call("cast", a["who"])) if _t(g.call("who")) else "") \
				+ ((", ticked when " + trigger_text(a["ticks"], n)) if _t(g.call("ticks")) else "") + ((" · " + js(a["secs"]) + " s") if _t(g.call("secs")) else "") \
				+ (" · with a marker" if _t(g.call("guide")) else "")
		"tick":
			return "Tick " + n.call("todo", g.call("tick"))
		"fail":
			return "Fail " + n.call("todo", g.call("fail"))
		"untodo":
			return "Clear the to-do list" if g.call("untodo") is bool and g.call("untodo") == true else "Take " + n.call("todo", g.call("untodo")) + " off the list"
		"scene":
			return "Play scene " + n.call("scene", g.call("scene"))
		"flag":
			return "Set flag " + js(_or(g.call("flag"), "…"))
		"unflag":
			return "Clear flag " + js(_or(g.call("unflag"), "…"))
		"give":
			return "Give " + n.call("item", g.call("give"))
		"take":
			return "Take away " + n.call("item", g.call("take"))
		"count":
			return "Counter " + n.call("counter", g.call("count")) + " " + (("= " + js(a["set"])) if a.has("set") else plus(_num(_qq(g.call("add"), 1))))
		"karma":
			var k = g.call("karma")
			if k is int or k is float:
				return "Karma " + plus(k)
			var parts: Array = []
			var kd: Dictionary = k if k is Dictionary else {}
			for ax in kd:
				parts.append("%s %s" % [ax, plus(kd[ax])])
			return "Karma " + ", ".join(PackedStringArray(parts))
		"door":
			return cap(js(_or(g.call("set"), "open"))) + " " + n.call("thing", g.call("door"))
		"open":
			return cap(js(_or(g.call("to"), "open"))) + " " + n.call("thing", g.call("open"))
		"light":
			var lx := ""
			if g.call("set") == "dim" and a.has("to") and a["to"] != null and not (a["to"] is String and a["to"] == ""):
				lx += " to " + js(a["to"])
			if g.call("set") == "flicker" and _t(g.call("mode")):
				lx += " (" + js(a["mode"]) + ")"
			if _t(g.call("secs")):
				lx += " for " + js(a["secs"]) + " s"
			if _t(g.call("over")):
				lx += ", fading over " + js(a["over"]) + " s"
			return (("Lights in " + n.call("thing", a["room"])) if _t(g.call("room")) else ("Light " + n.call("thing", g.call("light")))) + ": " + js(_or(g.call("set"), "on")) + lx
		"power":
			return "The power comes back" if g.call("power") == "on" else "The power goes out"
		"sweep":
			return "A car passes " + (n.call("room", a["sweep"]) if _t(g.call("sweep")) else "…")
		"skin":
			var bits: Array = []
			for kk in ["wet", "sweat", "drips", "oil"]:
				if a.get(kk) != null:
					bits.append("%s %s" % [kk, js(a[kk])])
			return cap(n.call("cast", g.call("skin"))) + "'s skin: " + (", ".join(PackedStringArray(bits)) if bits.size() else "…")
		"torch":
			var T := {"on": "The flashlight comes on", "off": "The flashlight goes off", "flicker": "The flashlight flickers", "dead": "The flashlight dies", "works": "The flashlight works again",
				"dim": "The flashlight dims", "drain": "The flashlight's battery drains"}
			var tx: String = T.get(str(g.call("torch")), "Flashlight: " + js(_or(g.call("torch"), "…")))
			var tv = g.call("torch")
			if (tv == "dim" or tv == "drain") and a.has("to") and a["to"] != null and not (a["to"] is String and a["to"] == ""):
				tx += " to " + js(a["to"])
			if tv == "flicker" and _t(g.call("mode")):
				tx += " (" + js(a["mode"]) + ")"
			if _t(g.call("secs")):
				tx += " for " + js(a["secs"]) + " s"
			if _t(g.call("over")):
				tx += ", over " + js(a["over"]) + " s"
			return tx
		"state":
			return cap(n.call("thing", g.call("state"))) + ": " + js(_or(g.call("to"), "…"))
		"show":
			return "Show " + n.call("thing", g.call("show"))
		"hide":
			return "Hide " + n.call("thing", g.call("hide"))
		"move":
			return "Move " + n.call("thing", g.call("move")) + " to " + n.call("thing", g.call("to"))
		"sound":
			return "Sound " + js(_or(g.call("sound"), "…")) + ((" from " + n.call("thing", a["at"])) if _t(g.call("at")) else "")
		"music":
			return "Music: " + (js(a["music"]) if a.has("music") else "undefined")
		"trick":
			var tt := _trick_text(a, n)
			return "Scare: " + (tt if tt != "" else js(g.call("trick")))
		"behave":
			return n.call("cast", g.call("behave")) + ": " + _behave_text(a, n) + ((" · playing " + n.call("motion", a["motion"])) if _t(g.call("motion")) else "") + (" · watches for you" if _t(g.call("sees")) else "")
		"expr":
			return cap(n.call("cast", g.call("who"))) + "'s face" + (" at rest" if _t(g.call("rest")) else "") + ": " + (n.call("expr", a["expr"]) if _t(g.call("expr")) else "none") + (", over and over" if _t(g.call("loop")) else "")
		"anim":
			var face = g.call("face")
			return "Animate " + n.call("thing", g.call("anim")) + ": " + js(_or(g.call("clip"), "turns" if _t(face) else "…")) \
				+ ((" to " + ("the player" if face is String and face == "player" else n.call("thing", face))) if _t(face) else "") \
				+ ((" for " + js(a["secs"]) + " s") if _t(g.call("secs")) else "")
		"shot":
			return "Close-up on " + n.call("cast", g.call("who")) + ((" for " + n.call("line", a["line"])) if _t(g.call("line")) else "")
		"wait":
			return "Wait " + (js(a["wait"]) if a.has("wait") else "undefined") + " s"
		"skip":
			return "Time skips " + span(g.call("skip"))
		"fade":
			return "Fade " + (js(a["fade"]) if a.has("fade") else "undefined") + " (" + js(_qq(g.call("secs"), 1)) + " s)"
		"focus":
			if not _t(g.call("focus")):
				return "Let the view go"
			var w = g.call("walk")
			return "Hold the view on " + n.call("thing", a["focus"]) + (", closer" if _t(g.call("push")) or _t(g.call("zoom")) else "") \
				+ (", the player still" if w is String and w == "held" else ("" if w is String and w == "free" else ", walking slowed")) \
				+ ((", " + js(a["max"]) + " s at most") if _t(g.call("max")) else "")
		"lookat":
			return "Turn the view to " + n.call("thing", g.call("lookat")) + " (" + js(_qq(g.call("secs"), 1)) + " s)"
		"chapter":
			return "Chapter: " + q(_or(g.call("chapter"), "…")) + ((" · " + js(a["sub"])) if _t(g.call("sub")) else "") + ((", then " + js(a["time"])) if _t(g.call("time")) else "") \
				+ (" (no autosave)" if g.call("save") is bool and g.call("save") == false else "")
		"seq":
			return "Sequence " + js(_or(g.call("seq"), "…"))
		"checkpoint":
			return "Checkpoint (save here)"
		"done":
			return "End the task"
		"stalker":
			return "Stalker: " + (js(a["stalker"]) if a.has("stalker") else "undefined")
	return JSON.stringify(a)


static func _trick_text(a: Dictionary, n: Callable) -> String:
	var g := func(k): return a.get(k)
	match str(a.get("trick", "")):
		"knock":
			return "a knock on " + n.call("thing", g.call("at")) + ((" ×" + js(a["count"])) if _t(g.call("count")) else "")
		"whisper":
			return "a whisper, " + n.call("line", g.call("line")) + ", from " + n.call("thing", g.call("at"))
		"slam_behind":
			return n.call("thing", g.call("door")) + " slams shut behind the player"
		"lights_die":
			return ((n.call("thing", a["light"]) + " dies") if _t(g.call("light")) else ("the lights die in " + n.call("thing", g.call("room")))) + (", one by one toward the player" if g.call("order") == "toward" else "") + ((" for " + js(a["secs"]) + " s") if _t(g.call("secs")) else "")
		"glimpse":
			return "a glimpse of " + n.call("thing", g.call("figure")) + ((" (" + js(a["secs"]) + " s)") if _t(g.call("secs")) else "")
		"jumpscare":
			return "a jump scare: " + n.call("thing", g.call("figure")) + ((", playing " + js(a["clip"])) if _t(g.call("clip")) else "") \
				+ ((", its face " + n.call("expr", a["expr"])) if _t(g.call("expr")) else "") + ((", with " + js(a["sound"])) if _t(g.call("sound")) else "")
		"swap":
			return "while unseen, " + n.call("thing", g.call("hide")) + " becomes " + n.call("thing", g.call("show"))
		"loop_hall":
			return "the hall loops: the end of " + n.call("thing", g.call("trigger")) + " leads back to " + n.call("thing", g.call("back_to"))
		"cut_away":
			return "a cut away to " + n.call("thing", g.call("lookat"))
	return ""


static func _behave_text(a: Dictionary, n: Callable) -> String:
	var g := func(k): return a.get(k)
	var as_ := str(_or(g.call("as"), "idle"))
	match as_:
		"idle":
			var face = g.call("face")
			return "stands at " + n.call("thing", g.call("at")) + ((" (" + js(a["pose"]) + ")") if _t(g.call("pose")) else "") \
				+ ((", facing " + ("you" if face == "player" else n.call("thing", face))) if _t(face) else "")
		"sit":
			return "sits at " + n.call("thing", g.call("at"))
		"path":
			return "walks " + (n.call("route", a["route"]) if _t(g.call("route")) else "a route") + ((" (" + js(a["mode"]) + ")") if _t(g.call("mode")) else "")
		"patrol":
			var rs: Array = (g.call("routes") if g.call("routes") is Array else []).map(func(r): return n.call("route", r))
			var joined := ", ".join(PackedStringArray(rs))
			return "patrols " + (joined if joined != "" else "…") + (" (random)" if g.call("pick") == "random" else "")
		"go":
			var via: Array = g.call("via") if g.call("via") is Array else []
			return "walks to " + n.call("thing", g.call("to")) + ((" by way of " + ", ".join(PackedStringArray(via.map(func(x): return n.call("thing", x))))) if via.size() else "") \
				+ (" and sits" if g.call("then") == "sit" else "")
		"off":
			return "leaves"
	return js(g.call("as"))


# ---- what a trigger reads as (commands.js triggerText) --------------------------------------------------------------
static func trigger_text(w, n: Callable = Callable()) -> String:
	n = _n(n)
	if not (w is Dictionary):
		return JSON.stringify(w)
	var v := verb_of_trigger(w)
	if trigger_def(v).is_empty():
		return JSON.stringify(w)
	var g := func(k): return w.get(k)
	match v:
		"start":
			return "the task starts"
		"enter":
			return "the player enters " + n.call("thing", g.call("enter"))
		"exit":
			return "the player leaves " + n.call("thing", g.call("exit"))
		"use":
			return "the player uses " + n.call("thing", g.call("use"))
		"pickup":
			return "the player picks up " + n.call("item", g.call("pickup"))
		"read":
			return "the player reads " + n.call("note", g.call("read")) + ((" at page " + js(w["page"])) if _t(g.call("page")) else "")
		"look":
			return "the player looks at " + n.call("thing", g.call("look")) + " for " + js(_qq(g.call("secs"), 1)) + " s"
		"after":
			return ((js(w["secs"]) + " s ") if _t(g.call("secs")) else "") + "after " + js(_or(g.call("after"), "…"))
		"flag":
			return "flag " + js(_or(g.call("flag"), "…")) + " is set"
		"caught":
			return "the player is caught" + ("" if g.call("caught") is bool and g.call("caught") == true else " by " + n.call("cast", g.call("caught")))
		"hidden":
			return "the player is hidden" + ("" if g.call("hidden") is bool and g.call("hidden") == true else " in " + n.call("thing", g.call("hidden")))
		"answered":
			return js(_or(g.call("answered"), "…")) + " is answered" + ((" " + q(w["option"])) if _t(g.call("option")) else "")
		"carrying":
			return "the player is carrying " + ("anything" if g.call("carrying") is bool and g.call("carrying") == true else n.call("thing", g.call("carrying")))
		"dropped":
			return n.call("thing", g.call("dropped")) + " is put down" + ((" in " + n.call("thing", w["in"])) if _t(g.call("in")) else "")
		"opened":
			return n.call("thing", g.call("opened")) + " is open"
		"closed":
			return n.call("thing", g.call("closed")) + " is shut"
		"placed":
			return n.call("thing", g.call("placed")) + " is put in" + (("to " + n.call("thing", w["in"])) if _t(g.call("in")) else "")
		"taken":
			return n.call("thing", g.call("taken")) + " is taken out" + ((" of " + n.call("thing", w["from"])) if _t(g.call("from")) else "")
		"moved":
			return n.call("thing", g.call("moved")) + " has been moved"
		"played":
			return "the game at " + n.call("thing", g.call("played")) + " ends" + ((" " + q(w["result"])) if _t(g.call("result")) else "")
		"rolled":
			return n.call("thing", g.call("rolled")) + " rolls" + ((" a " + js(w["face"])) if _t(g.call("face")) else ((" " + js(w["at_least"]) + " or more") if _t(g.call("at_least")) else ""))
		"power":
			return "the power is " + js(_or(g.call("power"), "…"))
		"locked":
			return n.call("thing", g.call("locked")) + " is locked"
		"peeping":
			return "the player looks through " + n.call("thing", g.call("peeping")) + "'s peephole"
		"torch":
			var TT := {"low": "the flashlight runs low", "dead": "the flashlight dies", "changed": "the flashlight gets new batteries"}
			return TT.get(str(g.call("torch")), "the player switches the flashlight " + js(_or(g.call("torch"), "…")))
		"charge":
			return "the flashlight's charge is under " + js(_qq(g.call("charge"), "…"))
		"state":
			return n.call("thing", g.call("state")) + " is " + js(_or(g.call("is"), "…"))
		"gave":
			return ("anything" if g.call("gave") == "*" else n.call("item", g.call("gave"))) + ((" but " + n.call("item", w["except"])) if _t(g.call("except")) else "") + " is given to " + n.call("cast", g.call("to"))
		"arrived":
			return n.call("cast", g.call("arrived")) + " gets to " + (n.call("thing", w["at"]) if _t(g.call("at")) else "where she was going")
		"ticked":
			return "the to-do list is through" if g.call("ticked") is bool and g.call("ticked") == true else n.call("todo", g.call("ticked")) + " is ticked"
		"failed":
			return "a task on the list is failed" if g.call("failed") is bool and g.call("failed") == true else n.call("todo", g.call("failed")) + " is failed"
		"all", "any":
			var subs: Array = (g.call(v) if g.call(v) is Array else []).map(func(x): return trigger_text(x, n))
			return v + " of: " + (" and " if v == "all" else " or ").join(PackedStringArray(subs))
	return JSON.stringify(w)


# ---- talking (words.js) -------------------------------------------------------------------------------------------
## the facts the game writes as the player talks (talked:<person or conversation>, heard:<person or conversation>) in
## words, when `ctx` says who's who: {"talks": the Director file's talk, "name": Callable(kind, id) -> her name}
static func _short_line(s: String) -> String:
	s = s.strip_edges()
	if s.length() <= 40:
		return s
	var i := s.rfind(" ", 40)
	return s.substr(0, i if i > 20 else 40) + "…"


## a conversation's person and how it's called (its title, else its first line, shortened); {} if it isn't one
static func talk_of(talks, id: String) -> Dictionary:
	if not (talks is Dictionary):
		return {}
	for who in talks:
		var list = talks[who]
		if not (list is Array):
			continue
		for t in list:
			if t is Dictionary and str(t.get("id", "")) == id:
				var first := ""
				for l in (t.get("lines") if t.get("lines") is Array else []):
					if l is Dictionary and str(l.get("text", "")).strip_edges() != "":
						first = str(l["text"])
						break
				var label := str(t.get("title", "")).strip_edges() if t.get("title") != null else ""
				if label == "":
					label = _short_line(first)
				return {"who": str(who), "label": label if label != "" else id}
	return {}


static func _name_of(ctx, id: String) -> String:
	if ctx is Dictionary and ctx.get("name") is Callable and (ctx["name"] as Callable).is_valid():
		return str((ctx["name"] as Callable).call("cast", id))
	return id


## a talk fact as {who, how: talked | heard, talk: the conversation's id or "", label}; {} when it isn't one ctx knows
static func talk_fact(f, ctx) -> Dictionary:
	if not (ctx is Dictionary) or not (ctx.get("talks") is Dictionary):
		return {}
	var s := str(f)
	var how := ""
	for h in ["talked", "heard"]:
		if s.begins_with(h + ":") and s.length() > h.length() + 1:
			how = h
	if how == "":
		return {}
	var v := s.substr(how.length() + 1)
	if (ctx["talks"] as Dictionary).has(v):
		return {"who": v, "how": how, "talk": "", "label": ""}
	var t := talk_of(ctx["talks"], v)
	return {"who": t["who"], "how": how, "talk": v, "label": t["label"]} if not t.is_empty() else {}


## a WHEN that's a talk ({"holds": "talked:mari"}, "heard:mari", "heard:t_open"): its talk fact, else {}
static func talk_when(w, ctx) -> Dictionary:
	if not (w is Dictionary) or not w.has("holds") or w.size() != 1:
		return {}
	var p := parse_cond(w["holds"])
	var items: Array = p["items"]
	if items.size() != 1 or items[0]["kind"] != "fact" or items[0].get("not", false):
		return {}
	return talk_fact(items[0]["v"], ctx)


## what a talk WHEN reads as ("the player talks to Mari", "the player hears out Mari's “You found it.”"; "" if it isn't one)
static func talk_when_text(w, ctx) -> String:
	var t := talk_when(w, ctx)
	if t.is_empty():
		return ""
	var n := _name_of(ctx, t["who"])
	if t["talk"] == "":
		return ("the player talks to %s" if t["how"] == "talked" else "the player hears %s out") % n
	return ("the player begins %s's “%s”" if t["how"] == "talked" else "the player hears out %s's “%s”") % [n, t["label"]]


## what a talk with someone can wait for: [fact, how it reads in a picker]: she's clicked, she's heard out, each of her
## conversations heard out
static func talk_hows(talks, who: String) -> Array:
	var out: Array = [["talked:" + who, "when she's clicked"], ["heard:" + who, "when she's heard out"]]
	var list = talks.get(who) if talks is Dictionary else null
	if list is Array:
		for t in list:
			if t is Dictionary and str(t.get("id", "")) != "":
				out.append(["heard:" + str(t["id"]), "when “%s” is heard out" % talk_of(talks, str(t["id"]))["label"]])
	return out


# ---- conditions (words.js) -------------------------------------------------------------------------------------------
## a fact as words: "read:letter" -> "they've read letter", a flag of the story's own -> "saw_figure is set"; a talk in
## its own words when ctx knows it ("they've heard Mari out")
static func fact_text(f, is_not := false, ctx = null) -> String:
	var s := str(f)
	var tk := talk_fact(s, ctx)
	if not tk.is_empty():
		var n := _name_of(ctx, tk["who"])
		var has := "they haven't" if is_not else "they've"
		if tk["talk"] == "":
			return ("%s talked to %s" if tk["how"] == "talked" else "%s heard %s out") % [has, n]
		return ("%s begun %s's “%s”" if tk["how"] == "talked" else "%s heard out %s's “%s”") % [has, n, tk["label"]]
	for fw in data()["fact_words"]:
		var p: String = fw[0]
		if not s.begins_with(p):
			continue
		var v := s.substr(p.length())
		var w: String = fw[2] if is_not else fw[1]
		if p == "gave:":
			var bits := v.split(":")
			return ("%s %s to %s" % [w, bits[0], bits[1]]) if bits.size() > 1 and bits[1] != "" else "%s %s" % [w, bits[0]]
		if p == "answered:":
			var bits := v.split(":")
			return ("%s %s with %s" % [w, bits[0], bits[1]]) if bits.size() > 1 and bits[1] != "" else "%s %s" % [w, bits[0]]
		if p == "result:":
			var i := v.rfind(":")
			return ("%s's round %s %s" % [v.substr(0, i), "didn't end" if is_not else "ended", v.substr(i + 1)]) if i > 0 else "%s %s" % [w, v]
		return "%s %s" % [w, v]
	return "%s %s set" % [s, "isn't" if is_not else "is"]


static func parse_clause(c) -> Dictionary:
	if c is String:
		return {"kind": "fact", "v": c.substr(1), "not": true} if c.begins_with("!") else {"kind": "fact", "v": c, "not": false}
	if not (c is Dictionary):
		return {"kind": "raw", "v": c}
	if c.has("not") and c.size() == 1:
		var x := parse_clause(c["not"])
		if x["kind"] != "raw":
			x["not"] = not x["not"]
			return x
		return {"kind": "raw", "v": c}
	for k in ["fact", "quest", "done", "step", "has", "ending"]:
		if c.has(k) and c.size() == 1:
			return {"kind": k, "v": js(c[k]), "not": false}
	if c.has("count"):
		var o := {"kind": "count", "v": c["count"], "not": false}
		for k in ["at_least", "at_most"]:
			if c.has(k):
				o[k] = c[k]
		return o
	if c.has("karma"):
		var o := {"kind": "karma", "not": false}
		var kd: Dictionary = c["karma"] if c["karma"] is Dictionary else {}
		for k in ["at_least", "at_most"]:
			if kd.has(k):
				o[k] = kd[k]
		return o
	return {"kind": "raw", "v": c}


static func parse_cond(c) -> Dictionary:
	if c == null or (c is String and c == ""):
		return {"mode": "all", "items": []}
	if c is Array:
		return {"mode": "all", "items": (c as Array).map(func(x): return parse_clause(x))}
	if c is Dictionary and c.size() == 1:
		for m in ["all", "any"]:
			if c.get(m) is Array:
				return {"mode": m, "items": (c[m] as Array).map(func(x): return parse_clause(x))}
	return {"mode": "all", "items": [parse_clause(c)]}


static func clause_json(x: Dictionary):
	if x["kind"] == "raw":
		return x["v"]
	if x["kind"] == "fact":
		return ("!" if x["not"] else "") + str(x["v"])
	var j := {}
	if x["kind"] == "count":
		j = {"count": x["v"]}
		for k in ["at_least", "at_most"]:
			if x.has(k):
				j[k] = x[k]
	elif x["kind"] == "karma":
		var kd := {}
		for k in ["at_least", "at_most"]:
			if x.has(k):
				kd[k] = x[k]
		j = {"karma": kd}
	else:
		j = {x["kind"]: x["v"]}
	return {"not": j} if x["not"] else j


## a condition from its clauses (null: none, "always")
static func build_cond(mode: String, items: Array):
	if items.is_empty():
		return null
	if items.size() == 1:
		return clause_json(items[0])
	return {mode: items.map(func(x): return clause_json(x))}


static func _range(x: Dictionary) -> String:
	var bits: Array = []
	if x.has("at_least"):
		bits.append("≥ " + js(x["at_least"]))
	if x.has("at_most"):
		bits.append("≤ " + js(x["at_most"]))
	return " and ".join(PackedStringArray(bits))


static func clause_text(x: Dictionary, ctx = null) -> String:
	var no: bool = x.get("not", false)
	match str(x["kind"]):
		"fact":
			return fact_text(x["v"], no, ctx)
		"quest":
			return "quest %s %s on" % [x["v"], "isn't" if no else "is"]
		"done":
			return "quest %s %s done" % [x["v"], "isn't" if no else "is"]
		"step":
			return "step %s %s ticked" % [x["v"], "isn't" if no else "is"]
		"has":
			return "they %s %s" % ["don't hold" if no else "hold", x["v"]]
		"ending":
			return "ending %s %s reached" % [x["v"], "wasn't" if no else "was"]
		"count":
			return "%s%s %s" % ["not " if no else "", js(x["v"]), _range(x)]
		"karma":
			return "%skarma %s" % ["not " if no else "", _range(x)]
	return JSON.stringify(x["v"])


## a whole condition as words, its clauses joined by and / or ("" when there are none)
static func cond_text(c, ctx = null) -> String:
	var p := parse_cond(c)
	return (" and " if p["mode"] == "all" else " or ").join(PackedStringArray((p["items"] as Array).map(func(x): return clause_text(x, ctx))))


## every example in the file read here as commands.js and words.js read it: the ones that differ ([] when none do)
static func differences() -> Array:
	var out: Array = []
	for e in data()["examples"]:
		var got := ""
		match str(e["what"]):
			"action":
				got = action_text(e["value"])
			"trigger":
				got = trigger_text(e["value"])
			"cond":
				got = cond_text(e["value"], e.get("ctx"))
				var p := parse_cond(e["value"])
				var back = build_cond(p["mode"], p["items"])
				if JSON.stringify(back) != JSON.stringify(e["json"]) or p["mode"] != e["mode"]:
					out.append({"value": e["value"], "want": e["json"], "got": back})
			"talkwhen":
				got = talk_when_text(e["value"], e.get("ctx"))
			"talkhows":
				var want = JSON.parse_string(str(e["text"]))
				var hows := talk_hows((e.get("ctx", {}) as Dictionary).get("talks"), str(e["value"]))
				got = str(e["text"]) if want == hows else JSON.stringify(hows)
		if got != str(e["text"]):
			out.append({"value": e["value"], "want": e["text"], "got": got})
	return out
