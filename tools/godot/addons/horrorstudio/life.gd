## The lives of the little things (docs/IMMERSION.md; the desk's life.js, ported): which life a prop has, where it
## starts, what the player can do to it, and its state at any moment from its timers and the thing it stands on.
extends RefCounted

var data: Dictionary = {}          # lives.json
var things: Dictionary = {}        # id -> {life, d, lead}
var e: Dictionary = {}             # id -> {state, since, spent}
var now: float = 0.0
var changes: Array = []            # every change: {t, id, from, to, by}
var first: Dictionary = {}
var followers: Dictionary = {}


static func pick_rule(rule, spec: Dictionary) -> Variant:
	if rule == null:
		return null
	if rule is String:
		return rule
	if rule is Dictionary:
		for k in rule:
			if k == "else" or not spec.has(k) or not (rule[k] is Dictionary):
				continue
			var v := str(spec[k])
			if v == "True":
				v = "true"
			elif v == "False":
				v = "false"
			if rule[k].has(v):
				return rule[k][v]
		return rule.get("else")
	return null


static func kit_spec(kit, presets: Dictionary) -> Variant:
	if kit == null:
		return null
	var s: Dictionary = {"preset": kit} if kit is String else kit
	var p = presets.get(s.get("preset", ""), null) if s.has("preset") and s["preset"] != null else null
	var out: Dictionary = {}
	if p is Dictionary:
		for k in p:
			out[k] = p[k]
	for k in s:
		out[k] = s[k]
	out["preset"] = s.get("preset", null)
	return out


static func life_of(d: Dictionary, data: Dictionary, presets: Dictionary = {}) -> Variant:
	if d.is_empty() or not data.has("lives"):
		return null
	if d.has("life"):
		return d["life"] if (d["life"] and data["lives"].has(d["life"])) else null
	var k = kit_spec(d.get("kit"), presets)
	if k == null:
		return null
	if k.get("preset") != null and data.get("by_preset", {}).has(k["preset"]):
		return data["by_preset"][k["preset"]]
	var name = pick_rule(data.get("by_kit", {}).get(k.get("type", ""), null), k)
	return name if (name != null and data["lives"].has(name)) else null


static func state_def(data: Dictionary, life, s) -> Variant:
	for x in data.get("lives", {}).get(str(life), {}).get("states", []):
		if x.get("id") == s:
			return x
	return null


static func states_of(data: Dictionary, life) -> Array:
	var out: Array = []
	for x in data.get("lives", {}).get(str(life), {}).get("states", []):
		out.append(x.get("id"))
	return out


static func start_of(d: Dictionary, life, data: Dictionary) -> Variant:
	var ids := states_of(data, life)
	if d.has("state") and ids.has(d["state"]):
		return d["state"]
	return ids[0] if ids.size() else null


static func secs_of(data: Dictionary, life, d: Dictionary, s) -> Variant:
	var own = d.get("secs")
	if own is Dictionary and own.has(s):
		return float(own[s])
	var def = state_def(data, life, s)
	if def != null and def.has("secs"):
		return float(def["secs"])
	return null


func _init(data_: Dictionary = {}, things_: Dictionary = {}) -> void:
	data = data_
	for id in things_:
		var t = things_[id]
		if t and t.get("life") and data.get("lives", {}).has(t["life"]):
			things[id] = {"life": t["life"], "d": t.get("d", {}), "lead": null}
	for id in things:
		var t: Dictionary = things[id]
		var lead = t["d"].get("on")
		var L: Dictionary = data["lives"][t["life"]]
		if L.has("follows") and lead is String and things.has(lead):
			if not followers.has(lead):
				followers[lead] = []
			followers[lead].append(id)
			t["lead"] = lead


func def_of(id, s = null) -> Variant:
	var t = things.get(id)
	if t == null:
		return null
	return state_def(data, t["life"], s if s != null else e.get(id, {}).get("state"))


func start(t0: float = 0.0):
	now = t0
	e = {}
	changes = []
	first = {}
	for id in things:
		var t: Dictionary = things[id]
		e[id] = {"state": start_of(t["d"], t["life"], data), "since": t0, "spent": {}}
	for id in things:
		var t: Dictionary = things[id]
		if t["lead"] == null or t["d"].has("state"):
			continue
		var m = data["lives"][t["life"]].get("follows", {}).get(e[t["lead"]]["state"])
		if m != null:
			e[id]["state"] = m
	for id in e:
		first[id] = {"t": t0, "state": e[id]["state"]}
	return self


func history(id) -> Array:
	var out: Array = []
	if first.has(id):
		out.append(first[id])
	for c in changes:
		if c["id"] == id:
			out.append({"t": c["t"], "state": c["to"]})
	return out


func due(id) -> Variant:
	var en = e.get(id)
	var t = things.get(id)
	var def = def_of(id)
	if en == null or def == null or not def.has("next"):
		return null
	var secs = secs_of(data, t["life"], t["d"], en["state"])
	if secs == null or not (secs >= 0):
		return null
	var kept: float = float(en["spent"].get(en["state"], 0.0)) if def.get("keep") else 0.0
	return float(en["since"]) + max(0.0, secs - kept)


func advance(t: float) -> void:
	for guard in 10000:
		var best = null
		for id in e:
			var d = due(id)
			if d != null and d <= t and (best == null or d < best["d"]):
				best = {"id": id, "d": d}
		if best == null:
			break
		enter(best["id"], def_of(best["id"])["next"], best["d"], "timer")
	now = max(now, t)


func enter(id, to, t: float, by: String = "story") -> bool:
	var en = e.get(id)
	if en == null or def_of(id, to) == null or en["state"] == to:
		return false
	en["spent"][en["state"]] = float(en["spent"].get(en["state"], 0.0)) + max(0.0, t - float(en["since"]))
	changes.append({"t": t, "id": id, "from": en["state"], "to": to, "by": by})
	en["state"] = to
	en["since"] = t
	for f in followers.get(id, []):
		var m = data["lives"][things[f]["life"]].get("follows", {}).get(to)
		if m != null and not downstream(f, m):
			enter(f, m, t, "follows")
	return true


func downstream(id, s) -> bool:
	var cur = e[id]["state"]
	var x = s
	for i in 30:
		if x == null:
			break
		if x == cur:
			return true
		var d = def_of(id, x)
		x = d.get("next") if (d != null and d.has("secs")) else null
	return false


func set_state(id, to, t = null, by: String = "story") -> bool:
	var tt: float = now if t == null else float(t)
	advance(tt)
	return enter(id, to, tt, by)


func skip(t: float, secs: float) -> void:
	advance(t)
	if not (secs > 0):
		return
	for id in e:
		e[id]["since"] = float(e[id]["since"]) - secs
	for c in changes:
		c["t"] = float(c["t"]) - secs
	for id in first:
		first[id]["t"] = float(first[id]["t"]) - secs
	advance(t)


func at(id, t = null) -> Variant:
	var tt: float = now if t == null else float(t)
	advance(tt)
	var en = e.get(id)
	if en == null:
		return null
	var th: Dictionary = things[id]
	var def = def_of(id)
	var age: float = max(0.0, tt - float(en["since"]))
	var secs = secs_of(data, th["life"], th["d"], en["state"])
	var kept: float = float(en["spent"].get(en["state"], 0.0)) if (def != null and def.get("keep")) else 0.0
	var p: float = min(1.0, (kept + age) / secs) if (secs != null and secs > 0) else 0.0
	var spent: Dictionary = en["spent"].duplicate()
	spent[en["state"]] = kept + age
	return {"state": en["state"], "since": en["since"], "age": age, "secs": secs, "p": p, "spent": spent, "def": def, "life": th["life"]}


func ready(id, t = null) -> bool:
	if id == null or not things.has(id):
		return false
	var s = at(id, t)
	return s != null and s["def"] != null and bool(s["def"].get("ready", false))


func acts(id, t = null) -> Array:
	var th = things.get(id)
	if th == null or (th["d"].get("acts") is bool and th["d"].get("acts") == false):
		return []
	var s = at(id, t)
	var out: Array = []
	if s == null or s["def"] == null:
		return out
	for a in s["def"].get("acts", []):
		if not a.has("needs") or ready(th["d"].get(a["needs"]), t):
			out.append(a)
	return out


func snapshot() -> Dictionary:
	return {"now": now, "e": e.duplicate(true)}


func restore(s: Dictionary):
	now = s["now"]
	e = s["e"].duplicate(true)
	changes = []
	first = {}
	for id in e:
		first[id] = {"t": e[id]["since"], "state": e[id]["state"]}
	return self
