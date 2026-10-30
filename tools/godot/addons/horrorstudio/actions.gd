## Actions: a beat's `do`, one verb each (STORY_FORMAT §4; the desk's actions.js, ported). A verb with no part yet
## shows on the HUD's log as "not in Play yet", so a stitch still runs end to end and the gap is visible.
extends RefCounted

const Typing := preload("res://addons/horrorstudio/typing.gd")
const VERBS := ["objective", "todo", "tick", "fail", "untodo", "think", "skip", "name", "say", "ask", "flag", "unflag", "give", "take",
	"karma", "count", "state", "show", "hide", "door", "light", "torch", "skin", "power", "sweep", "wait", "fade", "lookat", "sound", "music",
	"checkpoint", "chapter", "done", "scene", "behave", "trick", "move", "anim"]
const TAKES_TIME := ["wait", "fade", "ask", "name", "chapter", "scene", "trick", "say"]


static func line_secs(t) -> float:
	return min(6.0, 1.2 + str(t).length() / 14.0)


func verb_of(act) -> String:
	if not (act is Dictionary):
		return ""
	for k in act:
		if VERBS.has(k):
			return k
	return ""


## a beat's actions in order: those that take no time all at once; only one that takes time is waited for
func run_all(acts, rt) -> void:
	if acts == null:
		return
	for a in acts:
		if not rt.active:
			return
		await run(a, rt)


func run(a: Dictionary, rt) -> void:
	var v := verb_of(a)
	if v == "":
		rt.hud.log("not in Play yet: %s" % (a.keys()[0] if a.size() else "?"))
		return
	var val = a[v]
	match v:
		"objective":
			rt.hud.objective(val)
		"todo":
			rt.todo.add(a)
		"tick":
			rt.todo.set_state(val, "done")
		"fail":
			rt.todo.set_state(val, "failed")
		"untodo":
			rt.todo.remove(val)
		"think":
			var typed: float = Typing.typed_secs(rt.hud.named(val), rt.hud.named(a["retype"]) if a.get("retype") != null else null, bool(a.get("breaks", false)))
			rt.hud.line(val, "", max(1.5, typed + (0.4 if a.get("breaks", false) else 1.0)) if typed > 0 else line_secs(val), true, {"retype": a.get("retype"), "breaks": a.get("breaks", false)} if typed > 0 else null)
		"skip":
			rt.skip_time(float(val))
		"name":
			await rt.ask_name(val, a.get("default"))
		"say":
			var who := ""
			if a.has("who"):
				who = rt.story.cast_name(a["who"])
			var text = a.get("line", val)
			if rt.story.lines.has(str(text)):
				var l: Dictionary = rt.story.lines[str(text)]
				text = l.get("en", l.get("ja", text))
				if who == "" and l.has("who"):
					who = rt.story.cast_name(l["who"])
			rt.hud.line(text, who, line_secs(text), false)
		"ask":
			var opts: Array = []
			for o in a.get("options", []):
				if rt.story.holds(o, rt.flags, rt.counters()):
					opts.append(o)
			var l = rt.story.lines.get(str(a.get("line", "")), null)
			var prompt = (l.get("en", l.get("ja", "")) if l != null else a.get("text", ""))
			var who = a.get("who", l.get("who") if l != null else null)
			var labels: Array = []
			for o in opts:
				labels.append({"label": o.get("label", o.get("id")), "think": o.get("think")})
			var i = await rt.choose({"prompt": prompt, "who": who, "on": a.get("on"), "options": labels})   # waits for an answer (no timed choices)
			if i < 0 or i >= opts.size():
				return
			var o: Dictionary = opts[i]
			rt.emit({"type": "answered", "ask": val, "option": o.get("id")})
			await run_all(o.get("do", []), rt)
		"flag":
			rt.set_flag(val)
		"unflag":
			rt.flags.erase(val)
		"give":
			rt.give(val)
		"take":
			rt.take_item(val)
		"karma":
			if rt.run != null:
				rt.story.add_karma(rt.run["karma"], val)
		"count":
			if rt.run != null:
				var c: Dictionary = rt.run["counters"]
				c[val] = float(a["set"]) if a.has("set") else float(c.get(val, 0)) + float(a.get("add", 1))
		"state":
			rt.set_state(val, a.get("to"))
		"show":
			rt.set_visible(val, true)
		"hide":
			rt.set_visible(val, false)
		"door":
			rt.door(val, a.get("set", "open"))
		"light":
			rt.light(val, a.get("room"), a.get("set", "on"))
		"torch":
			rt.torch_set(val)
		"skin":
			rt.skin_set(val, a)
		"power":
			rt.power(val, a.get("level"))
		"sweep":
			rt.sweep(val)
		"wait":
			await rt.wait(float(val))
		"fade":
			await rt.fade(1.0 if val == "out" else 0.0, float(a.get("secs", 1)))
		"lookat":
			rt.look_at(val, float(a.get("secs", 1)))
		"sound":
			rt.sound(val, a.get("at"))
		"music":
			rt.hud.log("music: %s" % val)
		"checkpoint":
			rt.autosave(rt.stitch_title)
			rt.hud.log("checkpoint")
		"chapter":
			await rt.chapter(val, a)
		"done":
			rt.finish()
		"scene":
			await rt.scene(val)
		"behave":
			rt.behave(val, a)
		"move":
			rt.move_thing(val, a.get("to"))
		"anim":
			await rt.play_motion(val, a.get("clip"), bool(a.get("wait", false)))
		"trick":
			await trick(val, a, rt)


## tricks (docs/TRICKS.md §2): the ones Play can show now; the rest are logged
func trick(v: String, a: Dictionary, rt) -> void:
	match v:
		"slam_behind":
			rt.door(a.get("door"), "slam")
		"knock":
			var n := int(a.get("count", 3))
			for i in n:
				rt.shelf_sound("knock_wood_0%d" % (1 + i % 4), a.get("at"))
				await rt.wait(0.42)
			rt.hud.log("♪ knock ×%d%s" % [n, (" at " + str(a["at"])) if a.has("at") else ""])
		"whisper":
			var t = rt.story.line_text(a.get("line"))
			rt.hud.line(t if t != "" else "(a whisper)", "", 2.5, false)
		"glimpse":
			rt.set_visible(a.get("figure"), true)
			await rt.wait(float(a.get("secs", 0.6)))
			rt.set_visible(a.get("figure"), false)
		"lights_die":
			rt.light(null, a.get("room"), "off")
			await rt.wait(float(a.get("secs", 1)))
			rt.light(null, a.get("room"), "on")
		"swap":
			var until: float = rt.clock + float(a.get("secs", 8))
			while rt.active and (rt.seen(a.get("hide")) or rt.seen(a.get("show"))) and rt.clock < until:
				await rt.wait(0.1)
			rt.set_visible(a.get("hide"), false)
			rt.set_visible(a.get("show"), true)
		"jumpscare":
			rt.set_visible(a.get("figure"), true)
			rt.shelf_sound("sting_big", a.get("figure"))
			rt.hud.log("jumpscare: %s" % a.get("figure"))
			await rt.wait(float(a.get("secs", 0.8)))
			rt.set_visible(a.get("figure"), false)
		_:
			rt.hud.log("trick not in Play yet: %s" % v)
