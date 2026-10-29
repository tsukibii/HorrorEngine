## The story as data (res://game/story.json), with the helpers the desk's stage.js and storylib share: the time of day
## by node, what holds (flags and counters), karma, a clip's seconds, a scene's timeline.
extends RefCounted
# (loaded by preload as `Story` where it's used: a class_name needs Godot's import first)

const TIMES := ["day", "dusk", "night"]
const TIME_DEFAULT := "night"
const EYES := {"stand": 1.65, "crouch": 1.05, "kneel": 1.2, "sit": 1.15, "lie": 0.3, "hide": 1.6}
const FOV_H := 90.0
const SEAM_SECS := {"none": 0.0, "blink": 0.2, "glance": 1.0, "flicker": 0.4, "occlude": 0.8, "cutaway": 1.5, "turn": 0.0, "stumble": 1.0, "dip": 2.0, "jcut": 0.0, "heartbeat": 1.0}
const REPLY_SECS := 6.0
const REPLY_ANSWER := 2.5
const PLAYS := {"hide": ["hidden", "found"], "run": ["escaped", "caught"], "collect": ["done", "failed"], "sneak": ["made_it", "spotted"],
	"hold": ["held", "broke"], "search": ["found", "out_of_time"], "escape": ["out", "caught"]}

var data: Dictionary = {}
var game: Dictionary = {}
var flow: Dictionary = {}
var scenes: Dictionary = {}
var stitches: Dictionary = {}
var levels: Dictionary = {}
var cast: Dictionary = {}
var items: Dictionary = {}
var notes: Dictionary = {}
var lines: Dictionary = {}
var sounds: Dictionary = {}
var motions: Dictionary = {}
var interrupts: Array = []


static func load_file(path: String) -> Variant:
	var s = load("res://addons/horrorstudio/story.gd").new()
	var txt := FileAccess.get_file_as_string(path)
	var parsed = JSON.parse_string(txt)
	if parsed == null:
		push_error("story: can't read %s" % path)
		return s
	s.data = parsed
	s.game = s.data.get("game", {})
	s.flow = s.data.get("flow", {})
	s.scenes = s.data.get("scenes", {})
	s.stitches = s.data.get("stitches", {})
	s.levels = s.data.get("levels", {})
	s.cast = s.data.get("cast", {})
	s.items = s.data.get("items", {})
	s.notes = s.data.get("notes", {})
	s.lines = s.data.get("lines", {})
	s.sounds = s.data.get("sounds", {})
	s.motions = s.data.get("motions", {})
	s.interrupts = s.data.get("interrupts", [])
	return s


## the player's horizontal field of view -> Godot's vertical one for an aspect (the desk's vfov)
static func vfov(hfov: float, aspect: float) -> float:
	return rad_to_deg(2.0 * atan(tan(deg_to_rad(hfov) / 2.0) / aspect))


## a story point (x east, y north, z up) as a Godot point (the desk's s2t)
static func s2g(p: Array) -> Vector3:
	return Vector3(float(p[0]), float(p[2]) if p.size() > 2 else 0.0, -float(p[1]))


static func g2s(v: Vector3) -> Array:
	return [v.x, -v.z, v.y]


## a shown thing's condition (STORY_FORMAT §9.14): `if` flags (! for not), a counter's count with min/max
static func holds(c, flags: Dictionary, counters: Dictionary) -> bool:
	if c == null or not (c is Dictionary):
		return true
	for fl in c.get("if", []):
		var s := str(fl)
		if s.begins_with("!"):
			if flags.has(s.substr(1)):
				return false
		elif not flags.has(s):
			return false
	if c.has("count"):
		var v := float(counters.get(c["count"], 0))
		if c.has("min") and v < float(c["min"]):
			return false
		if c.has("max") and v > float(c["max"]):
			return false
	return true


static func flags_hold(ifs, flags: Dictionary) -> bool:
	if ifs == null:
		return true
	var arr: Array = ifs if ifs is Array else [ifs]
	for fl in arr:
		var s := str(fl)
		if s.begins_with("!"):
			if flags.has(s.substr(1)):
				return false
		elif not flags.has(s):
			return false
	return true


static func karma_of(d) -> Dictionary:
	if d == null:
		return {}
	if d is float or d is int:
		return {"karma": float(d)}
	if d is Dictionary:
		return d.duplicate()
	return {}


static func add_karma(into: Dictionary, d) -> Dictionary:
	for k in karma_of(d):
		into[k] = float(into.get(k, 0.0)) + float(karma_of(d)[k])
	return into


func karma_pick(n: Dictionary, karma: Dictionary) -> Dictionary:
	var axes: Array = (game.get("karma", {}).get("axes", {"karma": 1})).keys()
	var opts: Array = n.get("options", [])
	for o in opts:
		var ax = o.get("axis", "karma" if axes.has("karma") else (axes[0] if axes.size() else "karma"))
		var v := float(karma.get(ax, 0.0))
		if (not o.has("min") or v >= float(o["min"])) and (not o.has("max") or v <= float(o["max"])):
			return o
	return opts[opts.size() - 1] if opts.size() else {}


## how long a Japanese line takes (storylib.ja_secs): kana a mora, kanji about 1.7, pauses for punctuation
const JA_PAUSES := {"…": 0.25, "‥": 0.2, "、": 0.25, "。": 0.45, "？": 0.4, "！": 0.3, "?": 0.4, "!": 0.3, "—": 0.3, "―": 0.3}
const JA_SMALL := "ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ"
static func ja_secs(t: String) -> float:
	var morae := 0.0
	var pauses := 0.0
	for ch in t:
		if JA_PAUSES.has(ch):
			pauses += JA_PAUSES[ch]
		elif JA_SMALL.contains(ch):
			continue
		elif ch == " " or ch == "　":
			continue
		else:
			var code := ch.unicode_at(0)
			if code >= 0x4e00 and code <= 0x9fff:
				morae += 1.7
			elif code >= 0x3040 and code <= 0x30ff:
				morae += 1.0
			else:
				morae += 0.5
	return morae / 6.5 + pauses


const Typing := preload("res://addons/horrorstudio/typing.gd")


static func clip_secs(c: Dictionary) -> float:
	if c.get("think", false) and (c.get("retype") != null or c.get("breaks", false)):
		return max(1.5, Typing.typed_secs(str(c.get("en", "")), c.get("retype"), bool(c.get("breaks", false))) + (0.4 if c.get("breaks", false) else 1.0))
	if c.has("dur") and c["dur"] != null:
		var tr: Dictionary = c.get("trim", {})
		return max(0.1, float(c["dur"]) - float(tr.get("in", 0)) - float(tr.get("out", 0)))
	if c.has("dur_tts") and c["dur_tts"] != null:
		return float(c["dur_tts"])
	var ja := str(c.get("ja", ""))
	var has_ja := false
	for ch in ja:
		var code := ch.unicode_at(0)
		if code >= 0x3000 and code <= 0x9fff:
			has_ja = true
			break
	if has_ja:
		return max(1.5, ja_secs(ja))
	return max(1.5, str(c.get("en", "")).length() / 12.0 + 0.6)


static func event_secs(ev: Dictionary, story) -> float:
	if ev.has("secs") and float(ev["secs"]) > 0:
		return float(ev["secs"])
	return 30.0 if (ev.get("type") == "choose" and int(story.data.get("format", 2)) >= 3) else 3.0


## a scene's version: its picked variant laid over it (stage.js version)
static func version(sc: Dictionary) -> Dictionary:
	if sc.has("variants") and sc.has("pick") and sc["variants"].has(sc["pick"]):
		var v: Dictionary = sc.duplicate()
		for k in sc["variants"][sc["pick"]]:
			v[k] = sc["variants"][sc["pick"]][k]
		return v
	return sc


## her answer to a reply as clips of their own (stage.js thenClips)
static func then_clips(c: Dictionary, o: Dictionary) -> Array:
	var th = o.get("then")
	var lst: Array = []
	if th is Array:
		for x in th:
			if x is Dictionary:
				lst.append(x)
	elif th is Dictionary:
		lst = [th]
	var out: Array = []
	for n in lst.size():
		var cl: Dictionary = {"who": c.get("who")}
		for k in lst[n]:
			cl[k] = lst[n][k]
		cl["id"] = "%s_%s%s" % [c["id"], o["id"], "" if n == 0 else "_" + str(n + 1)]
		out.append(cl)
	return out


static func reply_go(o) -> Array:
	var g = o.get("go", "next") if o is Dictionary else "next"
	if g is Dictionary:
		if g.has("clip"):
			return ["clip", g["clip"]]
		if g.has("node"):
			return ["node", g["node"]]
		return ["next"]
	return ["end"] if g == "end" else ["next"]


## the scene's timeline (stage.js timeline): segments {type: clip|seam|event|reply|hold, start, end, ...}, elastic
## (every length from its clip); picks: {clip id: reply option id, or null}; run_flags/counters: the lines left out
## all_lines: every line whatever the flags (the desk's script and its bake play them all)
func timeline(sc: Dictionary, picks: Dictionary = {}, flags: Dictionary = {}, counters: Dictionary = {}, all_lines: bool = false) -> Dictionary:
	var v := version(sc)
	var clips: Array = v.get("clips", [])
	var segs: Array = []
	var t := 0.0
	var go = null
	var i := 0
	while i < clips.size():
		var c: Dictionary = clips[i]
		if not all_lines and not holds(c, flags, counters):
			i += 1
			continue
		if i > 0 and c.has("seam") and c["seam"] is Dictionary and SEAM_SECS.get(c["seam"].get("kind", ""), 0.0) > 0:
			var ss: float = SEAM_SECS[c["seam"]["kind"]]
			segs.append({"type": "seam", "start": t, "end": t + ss, "seam": c["seam"], "i": i})
			t += ss
		var d := clip_secs(c)
		segs.append({"type": "clip", "start": t, "end": t + d, "dur": d, "clip": c, "i": i})
		t += d
		if c.has("event") and c["event"] is Dictionary:
			var es := event_secs(c["event"], self)
			segs.append({"type": "event", "start": t, "end": t + es, "event": c["event"], "clip": c, "i": i})
			t += es
		if c.has("reply") and c["reply"] is Dictionary:
			var rp: Dictionary = c["reply"]
			var opts: Array = []
			for o in rp.get("options", []):
				if holds(o, flags, counters):
					opts.append(o)
			var picked = picks[c["id"]] if picks.has(c["id"]) else (opts[0].get("id") if opts.size() else null)
			var want = rp.get("timeout") if picked == null else picked
			var o = null
			for x in rp.get("options", []):
				if x.get("id") == want:
					o = x
			var ws := float(rp.get("wait", REPLY_SECS)) if picked == null else min(float(rp.get("wait", REPLY_SECS)), REPLY_ANSWER)
			segs.append({"type": "reply", "start": t, "end": t + ws, "reply": rp, "clip": c, "i": i, "picked": picked})
			t += ws
			if o != null:
				for th in then_clips(c, o):
					var td := clip_secs(th)
					segs.append({"type": "clip", "start": t, "end": t + td, "dur": td, "clip": th, "i": i, "answer": o["id"]})
					t += td
			var g := reply_go(o)
			if g[0] == "clip":
				var j := -1
				for k in clips.size():
					if clips[k].get("id") == g[1]:
						j = k
				if j > i:
					i = j - 1
			elif g[0] == "end" or g[0] == "node":
				go = {"node": g[1], "from": c["id"], "answer": o["id"]} if g[0] == "node" else null
				break
		i += 1
	var hold := 0.0
	if v.has("hold") and v["hold"] is Dictionary and float(v["hold"].get("max", 0)) > 0:
		hold = float(v["hold"]["max"]) / 2.0
	if hold > 0:
		segs.append({"type": "hold", "start": t, "end": t + hold})
		t += hold
	return {"segs": segs, "total": t, "v": v, "go": go}


## the level a stitch or scene happens in (storylib.level_of)
func level_of(node: Dictionary) -> String:
	if node.has("level") and node["level"]:
		return node["level"]
	return levels.keys()[0] if levels.size() else ""


## {nid: time}: the time of day at every node (storylib.flow_times, the desk's flowTimes): a scene's own `time` from it
## on, a chapter's `time` in a stitch too, else the game's
func flow_times() -> Dictionary:
	var out: Dictionary = {}
	var start = game.get("start")
	var base: String = game.get("time", TIME_DEFAULT)
	var queue: Array = [[start, base]]
	var seen: Dictionary = {}
	while queue.size():
		var cur: Array = queue.pop_front()
		var nid = cur[0]
		var tm: String = cur[1]
		if nid == null or not flow.has(nid) or seen.has(nid):
			continue
		var n: Dictionary = flow[nid]
		var own: String = tm
		if n.get("type") == "scene":
			var sc: Dictionary = scenes.get(n.get("ref", ""), {})
			if sc.has("time") and sc["time"] in TIMES:
				own = sc["time"]
		out[nid] = own
		seen[nid] = true
		var after := own
		if n.get("type") == "stitch":
			var ct := chapter_time(n)
			if ct != "":
				after = ct
		for o in flow_outs(nid):
			queue.append([o, after])
	return out


func chapter_time(n: Dictionary) -> String:
	var st: Dictionary = stitches.get(n.get("ref", ""), {})
	for b in st.get("beats", []):
		for a in b.get("do", []):
			if a.has("chapter") and a.has("time") and a["time"] in TIMES:
				return a["time"]
	return ""


func flow_outs(nid) -> Array:
	var n: Dictionary = flow.get(nid, {})
	var out: Array = []
	if n.get("next"):
		out.append(n["next"])
	for o in n.get("options", []):
		if o.get("to"):
			out.append(o["to"])
	if n.get("type") == "stitch":
		var st: Dictionary = stitches.get(n.get("ref", ""), {})
		if st.has("timer") and st["timer"] is Dictionary and st["timer"].get("fail"):
			out.append(st["timer"]["fail"])
		for it in interrupts:
			var during = it.get("during", "all")
			if it.get("to") and ((during is String and during == "all") or (during is Array and during.has(n.get("ref")))):
				out.append(it["to"])
	if n.get("type") == "scene":
		var sc: Dictionary = scenes.get(n.get("ref", ""), {})
		for c in version(sc).get("clips", []):
			if c.has("reply") and c["reply"] is Dictionary:
				for o in c["reply"].get("options", []):
					var g := reply_go(o)
					if g[0] == "node":
						out.append(g[1])
	return out


func item_name(id) -> String:
	var it: Dictionary = items.get(str(id), {})
	return it.get("name", str(id).replace("_", " "))


func cast_name(cid) -> String:
	return cast.get(str(cid), {}).get("name", str(cid))


func line_text(id) -> String:
	var l: Dictionary = lines.get(str(id), {})
	return l.get("en", l.get("ja", ""))


## a word filled into what's shown ({her}: game.words, the first option that holds; storylib.word_of), else null
func word_of(w: String, flags: Dictionary, counters: Dictionary) -> Variant:
	for o in game.get("words", {}).get(w, []):
		if o is Dictionary and holds(o, flags, counters):
			return o.get("say", "")
	return null
