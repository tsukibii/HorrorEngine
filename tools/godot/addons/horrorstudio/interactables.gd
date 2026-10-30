## Interactables: what a prop's `use` does when the player uses it, a left click on it (STORY_FORMAT §2; the desk's
## interactables.js, clean.js, latch.js and peephole.js, ported). Each gives the cursor its look and the prompt's
## label; every use sends a `use` event (beats and act choices hear it) before its own. `settings(name)` are a
## part's defaults (the player's own over them: rt.settings).
extends RefCounted

const SETTINGS := {
	"inspect": {"cursor": "look", "label": "Look"},
	"note": {"cursor": "read", "label": "Read"},
	"pickup": {"cursor": "take", "label": "Take"},
	"door": {"cursor": "open", "label": "Open", "close": "Close", "locked": "Locked", "unlock": "Unlock"},
	"combo": {"cursor": "use", "label": "Enter the code"},
	"use_on": {"cursor": "use", "label": "Use", "need": "Needs", "thought": "I need the {item}."},
	"switch": {"cursor": "use", "label": "Switch", "dead": "No power"},
	"breaker": {"cursor": "use", "on": "Power on", "off": "Power off"},
	"sit": {"cursor": "sit", "label": "Sit", "stand": "Stand up", "eye": 1.15, "secs": 0.6},
	"sleep": {"cursor": "sit", "label": "Sleep", "notYet": "Not tired yet", "thought": "I'm not tired yet.", "eye": 0.14, "mattress": 0.55, "pitch": 55, "secs": 1.1, "dark": 1.4, "wake": 1.0},
	"roll": {"cursor": "take", "label": "Roll", "speed": 2.6, "lift": 1.2, "spin": 14},
	"carry": {"cursor": "take", "label": "Pick up"},
	"game": {"cursor": "use", "label": "Play", "eye": 1.15, "secs": 0.7, "back": 0.22, "house": "The dealer"},
	"hide": {"cursor": "hide", "label": "Hide", "leave": "Get out", "eye": 1.6, "secs": 0.7, "look": [70, 35]},
	"locker": {"cursor": "hide", "label": "Hide", "leave": "Get out", "eye": 1.6, "secs": 0.7, "look": [70, 35]},
	"life": {"cursor": "use"},
	"clean": {"cursor": "use", "label": "Hold to clean", "need": "Need", "thought": "I need something to clean this with.", "secs": 3,
		"sounds": ["cloth_01", "cloth_02", "cloth_03", "cloth_04"], "every": 0.36},
	"latch": {"cursor": "use", "lock": "Lock", "unlock": "Unlock", "shut": "Close it first", "stuck": "Locked"},
	"peephole": {"cursor": "look", "label": "Look through", "look": [32, 22]},
	"talk": {"cursor": "talk", "label": "Talk"},
}
const HOLDS := ["clean"]


## the part for a thing: its `use` (a door is a door); a little thing with something to do is `life`
func name_of(t: Dictionary, rt) -> String:
	var p: Dictionary = t["piece"]
	if p.get("kind") == "door":
		return "door"
	var u = t.get("use")
	if u != null and SETTINGS.has(u):
		return u
	if rt != null and rt.life_acts(p["id"]).size():
		return "life"
	return ""


func settings(name: String, rt) -> Dictionary:
	var s: Dictionary = SETTINGS.get(name, {}).duplicate()
	if rt != null and rt.settings.has(name):
		for k in rt.settings[name]:
			s[k] = rt.settings[name][k]
	return s


func holds(name: String) -> bool:
	return HOLDS.has(name)


static func d_of(t: Dictionary) -> Dictionary:
	var d = t["piece"].get("d", {})
	return d if d is Dictionary else {}


## {cursor, label} for the reticle
func prompt(name: String, t: Dictionary, rt, s: Dictionary) -> Dictionary:
	var id = t["piece"]["id"]
	var d := d_of(t)
	match name:
		"door":
			var dr: Dictionary = rt.door_of(id)
			if dr.get("latched", false) and rt.on_latch_side(id):
				return {"cursor": "use", "label": s["unlock"]}
			if dr.get("locked", false) and not rt.can_unlock(dr):
				return {"cursor": "locked", "label": s["locked"]}
			return {"cursor": s["cursor"], "label": s["close"] if dr.get("open", false) else s["label"]}
		"combo":
			return {"cursor": s["cursor"], "label": "Open" if rt.flags.has(d.get("then")) else s["label"]}
		"use_on":
			if d.get("then") != null and rt.flags.has(d["then"]):
				return {"cursor": "none", "label": ""}
			if rt.items.has(d.get("needs")):
				return {"cursor": s["cursor"], "label": "%s: %s" % [s["label"], rt.story.item_name(d["needs"])]}
			return {"cursor": "locked", "label": "%s: %s" % [s["need"], rt.story.item_name(d.get("needs"))]}
		"switch":
			return {"cursor": s["cursor"], "label": s["label"]} if rt.powered() else {"cursor": "locked", "label": s["dead"]}
		"breaker":
			return {"cursor": s["cursor"], "label": s["off"] if rt.powered() else s["on"]}
		"sit":
			return {"cursor": s["cursor"], "label": s["stand"] if rt.player.seat == id else s["label"]}
		"sleep":
			return {"cursor": s["cursor"], "label": s["label"]} if rt.ready(t) else {"cursor": "locked", "label": s["notYet"]}
		"roll":
			return {"cursor": "none", "label": ""} if rt.rolling(id) else {"cursor": "roll", "label": s["label"]}
		"hide", "locker":
			return {"cursor": s["cursor"], "label": s["leave"] if rt.player.hiding == id else s["label"]}
		"life":
			var a: Array = rt.life_acts(id)
			return {"cursor": s["cursor"], "label": a[0].get("label", "") if a.size() else ""}
		"clean":
			if clean_has(t, rt):
				var p: float = clean_progress(t, rt)
				return {"cursor": s["cursor"], "label": ("%s · %d%%" % [s["label"], int(round(p * 100))]) if p > 0 else s["label"]}
			return {"cursor": "locked", "label": "%s %s" % [s["need"], rt.story.item_name(d.get("with")).to_lower()]}
		"latch":
			var dr: Dictionary = rt.door_of(t["door"])
			if dr.get("open", false):
				return {"cursor": "locked", "label": s["shut"]}
			if dr.get("locked", false) and not dr.get("latched", false):
				return {"cursor": "locked", "label": s["stuck"]}
			return {"cursor": s["cursor"], "label": s["unlock"] if dr.get("latched", false) else s["lock"]}
		"peephole":
			return {"cursor": s["cursor"], "label": s["label"]}
		_:
			return {"cursor": s.get("cursor", "use"), "label": s.get("label", "")}


## what a click does; returns false when nothing happened (the story hears no `use`)
func use(name: String, t: Dictionary, rt, s: Dictionary):
	var id = t["piece"]["id"]
	var d := d_of(t)
	match name:
		"inspect":
			await rt.examine(t, rt.name_of(t), str(d.get("text", "")))
			return true
		"note":
			var nid = d.get("note")
			var n: Dictionary = rt.story.notes.get(str(nid), {})
			rt.emit({"type": "read", "note": nid})
			await rt.panel({"title": n.get("title", str(nid)), "text": n.get("text", "")})
			return true
		"pickup", "carry":
			rt.take(t)
			return true
		"door":
			var dr: Dictionary = rt.door_of(id)
			if dr.get("latched", false) and rt.on_latch_side(id):
				rt.latch(id, false)
				return false
			if dr.get("locked", false):
				if not rt.can_unlock(dr):
					rt.hud.shake()
					rt.hud.line(s["locked"] + ".", "", 1.2, false)
					return true
				dr["locked"] = false
				dr["latched"] = false
				rt.turn_latch(id)
				if dr.get("by") != null and not str(dr["by"]).begins_with("flag:"):
					rt.hud.log("used: %s" % rt.story.item_name(dr["by"]))
			rt.door(id, "close" if dr.get("open", false) else "open")
			return true
		"combo":
			if rt.flags.has(d.get("then")):
				return true
			var got = await rt.panel({"title": rt.name_of(t), "code": max(1, str(d.get("code", "")).length()) if d.has("code") else 4})
			if got != null and str(got) == str(d.get("code")):
				rt.set_flag(d.get("then"))
				rt.hud.line("It opens.", "", 1.5, false)
			elif got != null:
				rt.hud.shake()
				rt.hud.line("Wrong.", "", 1.0, false)
			return true
		"use_on":
			if d.get("then") != null and rt.flags.has(d["then"]):
				return false
			if not rt.items.has(d.get("needs")):
				rt.hud.shake()
				rt.hud.line(str(s["thought"]).replace("{item}", rt.story.item_name(d.get("needs")).to_lower()), "", 1.6, false)
				return false
			if d.get("consume", true) != false:
				rt.take_item(d["needs"])
			rt.hud.log("used: %s" % rt.story.item_name(d["needs"]))
			rt.set_flag(d.get("then"))
			return true
		"switch":
			var l = d.get("light")
			if rt.powered():
				rt.light(l, null if l != null else t["piece"].get("room"), "toggle")
			else:
				rt.shelf_sound("switch_01", id)
			return true
		"breaker":
			rt.shelf_sound("switch_02", id)
			rt.power("off" if rt.powered() else "on")
			return true
		"sit":
			if rt.player.seat == id:
				await rt.stand(s)
			else:
				await rt.sit(t, s)
			return true
		"sleep":
			if not rt.ready(t):
				rt.hud.shake()
				rt.hud.line(d.get("not_yet", s["thought"]), "", 1.6, false)
				return false
			await rt.sleep(t, s)
			return true
		"roll":
			if not rt.rolling(id):
				rt.roll(t, s)
			return true
		"game":
			await rt.board_game(t, s)
			return true
		"hide", "locker":
			if rt.player.hiding == id:
				await rt.unhide(s)
			else:
				await rt.hide(t, s)
			return true
		"life":
			var a: Array = rt.life_acts(id)
			if a.size():
				rt.set_state(id, a[0].get("to"), "player")
			return true
		"clean":
			if not clean_has(t, rt):
				rt.hud.line(s["thought"], "", 2.2, true)
			return false
		"latch":
			var dr: Dictionary = rt.door_of(t["door"])
			if not dr.get("open", false) and not (dr.get("locked", false) and not dr.get("latched", false)):
				rt.latch(t["door"], not dr.get("latched", false))
			return false
		"peephole":
			rt.peep(t["door"], s)
			return true
	return true


# ---- cleaning (clean.js): a stain scrubbed away by holding the button on it ----
static func clean_needs(t: Dictionary):
	return d_of(t).get("with", null)


static func clean_has(t: Dictionary, rt) -> bool:
	var w = clean_needs(t)
	if w == null:
		return true
	var c = rt.carried()
	return c != null and c.get("item") == w


static func clean_progress(t: Dictionary, rt) -> float:
	var k: Dictionary = rt.kept_level()
	if not k.has("clean"):
		k["clean"] = {}
	return float(k["clean"].get(t["piece"]["id"], 0.0))


## a frame of scrubbing: true when it's clean
func hold(name: String, t: Dictionary, rt, dt: float, s: Dictionary) -> bool:
	if name != "clean" or not clean_has(t, rt):
		return false
	var d := d_of(t)
	var secs: float = max(0.2, float(d.get("secs", s["secs"])))
	var id = t["piece"]["id"]
	var k: Dictionary = rt.kept_level()
	if not k.has("clean"):
		k["clean"] = {}
	var p: float = min(1.0, float(k["clean"].get(id, 0.0)) + dt / secs)
	k["clean"][id] = p
	rt.set_stain(t, 1.0 - p * p * (3.0 - 2.0 * p) * 0.94)
	rt.scrubbing = rt.clock
	if rt.clock - rt.last_scrub >= float(s["every"]):
		rt.last_scrub = rt.clock
		var snds: Array = s["sounds"]
		rt.shelf_sound(snds[int(rt.clock / float(s["every"])) % snds.size()], id)
	rt.hud.progress(p)
	return p >= 1.0
