## The scene player (the desk's watchScene, app.js, ported as data: the bake's camera and bodies come next). A scene's
## timeline is elastic (story.gd timeline): each clip's seconds, its seam, its event, its reply; the eye at the
## scene's view spot looking at `camera.look`, blended in from wherever the player's eye was; the cast at their stage
## spots; each clip's line in the footer; cues at their clip edges (states, sounds, lights); a `choose` event and a
## reply as the HUD's choice; the scene's `sets` at the end; the exit as the story says. What the Watch keeps for the
## run (results, answers, karma, the little things) is kept here the same.
extends Node

const StoryC := preload("res://addons/horrorstudio/story.gd")

const BLEND := {"kind": "blend", "secs": 0.8}

var game
var playing: bool = false
var T: float = 0.0
var title: String = ""
var skip_asked: bool = false
var tl_now: Dictionary = {}


## the dev skip: to the next event or reply, else the scene's end
func skip() -> void:
	skip_asked = true


func story():
	return game.story


func run():
	return game.run


## the player's eye for a scene version: its view spot at its stance's eye height
func eye_of(v: Dictionary) -> Vector3:
	var view = game.things.get(v.get("view"))
	var h: float = StoryC.EYES.get(v.get("stance", "stand"), 1.65)
	if view == null:
		return Vector3(0, h, 0)
	var p: Vector3 = view["node"].global_position
	return Vector3(p.x, p.y + h, p.z)


func target_pos(id) -> Variant:
	var rt = game.play
	if rt != null and rt.cast_nodes.has(id) and rt.cast_nodes[id].visible:
		var n: Node3D = rt.cast_nodes[id]
		var h := float(story().cast.get(id, {}).get("height", 1.7))
		return n.global_position + Vector3(0, h * 0.93, 0)
	var t = game.things.get(id)
	if t != null:
		var s: Array = t["piece"].get("size", [0, 0, 0])
		return t["node"].global_position + Vector3(0, float(s[2]) / 2.0 if t["piece"].get("kind") != "spot" else 0.0, 0)
	return null


func cue_times(tl: Dictionary, v: Dictionary) -> Array:
	var out: Array = []
	for cu in v.get("cues", []):
		if not (cu is Dictionary) or not (cu.get("do") is Dictionary):
			continue
		var a: Dictionary = cu.get("at", {})
		var sg = null
		for s in tl["segs"]:
			if s["type"] == "clip" and s["clip"].get("id") == a.get("clip") and not s.has("answer"):
				sg = s
				break
		if sg == null:
			continue
		var t: float = (float(sg["end"]) if a.get("edge") == "end" else float(sg["start"])) + float(a.get("offset", 0))
		out.append({"t": t, "do": cu["do"]})
	out.sort_custom(func(x, y): return x["t"] < y["t"])
	return out


## a cue's action at its moment: what the Watch plays (a state, a skip, a sound) and what the stage shows (a light)
func fire_cue(c: Dictionary, t0: float) -> void:
	var d: Dictionary = c["do"]
	var rt = game.play
	if d.has("state") and run().has("lives"):
		run()["lives"].set_state(d["state"], d.get("to"), t0 + float(c["t"]))
	elif d.has("skip") and run().has("lives"):
		run()["lives"].skip(t0 + float(c["t"]), float(d["skip"]))
	elif d.has("sound"):
		if rt != null:
			rt.sounds_heard.append({"n": str(story().sounds.get(str(d["sound"]), {}).get("file", "")).substr(4), "at": d.get("at"), "clock": rt.clock})
	elif d.has("light") and rt != null:
		rt.light(d["light"], d.get("room"), d.get("set", "on"))
	elif d.has("trick") and rt != null and d["trick"] == "lights_die":
		rt.light(null, d.get("room"), "off")
		_relight(d.get("room"), float(d.get("secs", 1)))
	elif d.has("behave") and rt != null:
		rt.behave(d["behave"], d)


func _relight(room, secs: float) -> void:
	var t := get_tree().create_timer(secs)
	await t.timeout
	if game.play != null:
		game.play.light(null, room, "on")


func play(sc: Dictionary, nid: String, sid: String) -> Variant:
	var lvl: String = story().level_of(sc)
	var rt = game.play_rt()
	if rt.level != lvl:
		rt.enter_level(lvl)
	var R = run()
	var picks: Dictionary = {}
	var replied: Dictionary = {}
	var tl: Dictionary = story().timeline(sc, picks, R["flags"], R["counters"])
	var v: Dictionary = tl["v"]
	var en: Dictionary = sc.get("enter", BLEND) if sc.get("enter") is Dictionary else BLEND
	var cam: Camera3D = game.camera
	var from_t: Transform3D = cam.global_transform
	var from_fov: float = cam.fov
	var from_black: float = game.fade_alpha()
	title = str(sc.get("title", ""))
	playing = true
	# the cast on their marks, the eye at the view
	for cid in v.get("stage", {}):
		var sp = game.things.get(v["stage"][cid])
		if sp != null and rt.cast_nodes.has(cid):
			var n: Node3D = rt.cast_nodes[cid]
			n.position = sp["node"].global_position
			n.rotation_degrees = Vector3(0, float(sp["piece"].get("yaw", 0)) + 90.0, 0)
			n.visible = true
	var eye := eye_of(v)
	var look_id = (v.get("camera", {}) as Dictionary).get("look", null)
	var target = target_pos(look_id) if look_id != null else null
	var to_t := Transform3D(Basis(), eye)
	if target != null and (target - eye).length() > 0.01:
		to_t = Transform3D(Basis(), eye).looking_at(target, Vector3.UP)
	else:
		var view = game.things.get(v.get("view"))
		var yaw := float(view["piece"].get("yaw", 0)) if view != null else 0.0
		to_t = Transform3D(Basis(Vector3.UP, deg_to_rad(yaw - 90.0)), eye)
	var vp := get_viewport().get_visible_rect().size
	var to_fov := StoryC.vfov(float(story().game.get("fov", StoryC.FOV_H)), (vp.x / vp.y) if vp.y > 0 else 16.0 / 9.0)
	if en.get("kind", "blend") == "blend":
		var secs: float = max(0.05, float(en.get("secs", 0.8)))
		var t := 0.0
		while t < secs and game.run != null:
			var u: float = min(1.0, t / secs)
			var k := u * u * (3.0 - 2.0 * u)
			cam.global_transform = from_t.interpolate_with(to_t, k)
			cam.fov = lerp(from_fov, to_fov, k)
			game.hud.set_fade(from_black * (1.0 - k))
			await get_tree().process_frame
			t += get_process_delta_time()
		cam.global_transform = to_t
		cam.fov = to_fov
		game.hud.set_fade(0.0)
	else:
		cam.global_transform = to_t
		cam.fov = to_fov
		if en.get("kind") != "cut":
			await game.fade(0.0, float(en.get("secs", 0.6)))
		else:
			game.hud.set_fade(0.0)
	T = 0.0
	var spoken = null
	var cues := cue_times(tl, v)
	var t0: float = float(R["secs"])
	while game.run != null and T < float(tl["total"]):
		await get_tree().process_frame
		if game.run == null:
			break
		T += get_process_delta_time()
		while cues.size() and float(cues[0]["t"]) <= T:
			fire_cue(cues.pop_front(), t0)
		if skip_asked:
			skip_asked = false
			var ne = null
			for s in tl["segs"]:
				if (s["type"] == "event" and float(s["start"]) > T and not R["done"].has(s)) or (s["type"] == "reply" and float(s["start"]) > T and not replied.has(s["clip"]["id"])):
					ne = s
					break
			if ne != null:
				T = float(ne["start"])
			else:
				break
		var seg = _seg_at(tl, T)
		if seg != null and seg["type"] == "event" and not R["done"].has(seg):
			R["done"][seg] = true
			var ev: Dictionary = seg["event"]
			var res = await run_event(ev)
			R["results"][nid] = res
			game.karma_act(ev.get("on", {}).get(res, []))
			if ev.get("type") == "choose":
				for o in ev.get("options", []):
					if o.get("id") == res and o.has("karma"):
						StoryC.add_karma(R["karma"], o["karma"])
						R["answers"].append("%s (%s)" % [o.get("label", ""), JSON.stringify(o["karma"])])
			R["secs"] = float(R["secs"]) + StoryC.event_secs(ev, story())
			T = float(seg["end"])
			continue
		if seg != null and seg["type"] == "reply" and not replied.has(seg["clip"]["id"]):
			var c: Dictionary = seg["clip"]
			replied[c["id"]] = true
			var id = await run_reply(c["reply"], c.get("who"))
			picks[c["id"]] = id
			var want = c["reply"].get("timeout") if id == null else id
			var o = null
			for x in c["reply"].get("options", []):
				if x.get("id") == want:
					o = x
			if o != null:
				game.karma_act(o.get("sets", []))
			R["answers"].append("%s: %s" % [c["id"], o.get("label", "") if o != null else "(silence)"])
			tl = story().timeline(sc, picks, R["flags"], R["counters"])
			var rs = null
			for s in tl["segs"]:
				if s["type"] == "reply" and s["clip"]["id"] == c["id"]:
					rs = s
			T = float(rs["end"]) if rs != null else T
			continue
		if seg != null and seg["type"] == "clip" and spoken != seg:
			spoken = seg
			var c: Dictionary = seg["clip"]
			var who: String = story().cast_name(c["who"]) if (c.get("who") != null and not c.get("think", false)) else ""
			game.hud.line(c.get("en", ""), who, float(seg["dur"]) + 0.3, bool(c.get("think", false)))
		elif seg != null and seg["type"] == "seam" and spoken != seg:
			spoken = seg
			if ["blink", "dip", "flicker"].has(seg["seam"].get("kind")):
				_blink(float(seg["end"]) - float(seg["start"]))
	if game.run == null:
		playing = false
		return null
	while cues.size() and R.has("lives"):
		fire_cue(cues.pop_front(), t0)
	game.hud.line("", "", 0.0, false)
	R["secs"] = float(R["secs"]) + float(tl["total"])
	game.karma_act(sc.get("sets", []))
	var ex: Dictionary = sc.get("exit", BLEND) if sc.get("exit") is Dictionary else BLEND
	if ex.get("kind", "blend") != "blend":
		await game.fade(1.0, 0.05 if ex.get("kind") == "cut" else float(ex.get("secs", 0.6)))
	playing = false
	return tl["go"]["node"] if tl.get("go") != null else null


func _blink(secs: float) -> void:
	game.hud.set_fade(1.0)
	var t := get_tree().create_timer(max(0.1, secs))
	await t.timeout
	if playing:
		game.hud.set_fade(0.0)


func _seg_at(tl: Dictionary, t: float) -> Variant:
	for s in tl["segs"]:
		if t >= float(s["start"]) and t < float(s["end"]):
			return s
	return null


## a timed choice: the default is taken when time runs out; the other QTE kinds (deprecated) succeed by themselves
func run_event(ev: Dictionary) -> Variant:
	var secs := StoryC.event_secs(ev, story())
	if ev.get("type") == "choose":
		var opts: Array = ev.get("options", [])
		var labels: Array = []
		for o in opts:
			labels.append({"label": o.get("label", o.get("id")), "think": o.get("think")})
		var def := 0
		for i in opts.size():
			if opts[i].get("id") == ev.get("default"):
				def = i
		var i = await game.hud.choose({"prompt": ev.get("prompt", ""), "options": labels, "secs": secs, "def": def})
		return opts[i].get("id") if (i >= 0 and i < opts.size()) else ev.get("default")
	var t := get_tree().create_timer(min(secs, 1.0))
	await t.timeout
	return "escape" if ev.get("type") == "struggle" else "success"


func run_reply(rp: Dictionary, who) -> Variant:
	var R = run()
	var secs := float(rp.get("wait", StoryC.REPLY_SECS))
	var opts: Array = []
	for o in rp.get("options", []):
		if StoryC.holds(o, R["flags"], R["counters"]):
			opts.append(o)
	var labels: Array = []
	for o in opts:
		labels.append({"label": o.get("label", o.get("id")), "think": o.get("think")})
	var i = await game.hud.choose({"options": labels, "secs": secs, "def": -1})
	return opts[i].get("id") if (i >= 0 and i < opts.size()) else null
