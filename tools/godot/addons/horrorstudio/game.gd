## The game (the main scene's root; the desk's Watch loop, app.js watch(), ported): the story loaded, the flow walked
## node by node: a stitch is played (play.gd, the desk's Play), a scene is played (scene_player.gd), a choice by act is
## played, the other choices decided from what happened, an ending ends it. One run (RUN) through the whole game:
## flags, karma, counters, the pocket, the to-do list, the little things' states, the trail; every node reached keeps
## its checkpoint for a death's retry.
extends Node

const StoryC := preload("res://addons/horrorstudio/story.gd")
const PlayC := preload("res://addons/horrorstudio/play.gd")
const HudC := preload("res://addons/horrorstudio/hud.gd")
const LifeC := preload("res://addons/horrorstudio/life.gd")
const ScenePlayerC := preload("res://addons/horrorstudio/scene_player.gd")

const TIME_LOOK := {
	"day": {"sky": Color(0.718, 0.776, 0.839), "amb": [Color(0.839, 0.855, 0.886), 0.65], "win": [Color(0.933, 0.953, 1.0), 20.0, 8.0]},
	"dusk": {"sky": Color(0.18, 0.125, 0.188), "amb": [Color(0.627, 0.549, 0.533), 0.32], "win": [Color(1.0, 0.698, 0.478), 6.0, 6.0]},
	"night": {"sky": Color(0.027, 0.039, 0.086), "amb": [Color(0.478, 0.525, 0.667), 0.22], "win": [Color(0.561, 0.659, 1.0), 1.2, 5.0]},
}

@export var autostart: bool = true
@export var fast: bool = false          # the desk's wFast: rounds and task cards go by themselves

var story
var level_id: String = ""
var level: Node3D = null
var things: Dictionary = {}        # id -> {node, piece}
var hud
var play
var scene_player
var lives_data: Dictionary = {}
var life_things: Dictionary = {}
var run = null
var progress: Dictionary = {"visited": {}, "endings": []}
var watch_end = null
var ending_words: String = ""
var sfx_index: Dictionary = {}     # game/sfx/index.json: the sound shelf (name -> file, loop...)
var kit_index: Dictionary = {}     # game/kit.json: the kit things' sockets and slots, by their mesh ref (lifefx.gd)
var bake = null                    # the desk's bake (game/previs/index.json): the scenes as recorded, or null
var body_scenes: Dictionary = {}   # cast id -> the PackedScene of its baked body
var time_of_day: String = "night"
var fading = null

@onready var world: Node3D = $World
@onready var player: Node3D = $Player
@onready var camera: Camera3D = $Player/Camera
@onready var env: WorldEnvironment = $Env


func _ready() -> void:
	story = StoryC.load_file("res://game/story.json")
	hud = HudC.new()
	hud.name = "Hud"
	add_child(hud)
	hud.words = func(w): return story.word_of(w, run["flags"] if run != null else {}, run["counters"] if run != null else {})
	scene_player = ScenePlayerC.new()
	scene_player.name = "ScenePlayer"
	scene_player.game = self
	add_child(scene_player)
	if FileAccess.file_exists("res://game/lives.json"):
		lives_data = JSON.parse_string(FileAccess.get_file_as_string("res://game/lives.json"))
	if FileAccess.file_exists("res://game/life_things.json"):
		life_things = JSON.parse_string(FileAccess.get_file_as_string("res://game/life_things.json"))
	if FileAccess.file_exists("res://game/sfx/index.json"):
		var sj = JSON.parse_string(FileAccess.get_file_as_string("res://game/sfx/index.json"))
		if sj is Dictionary:
			sfx_index = sj.get("sounds", {})
	if FileAccess.file_exists("res://game/kit.json"):
		kit_index = JSON.parse_string(FileAccess.get_file_as_string("res://game/kit.json"))
	if FileAccess.file_exists("res://game/previs/index.json"):
		bake = JSON.parse_string(FileAccess.get_file_as_string("res://game/previs/index.json"))
	set_time(story.game.get("time", StoryC.TIME_DEFAULT))
	if autostart:
		call_deferred("watch", null, null)


## the level's scene instanced into the World; every node with a piece registered by its id. `fresh`: the level as the
## story builds it, even if it's the one that's there (a run's first time)
## a cast member's baked body (previs/Body_<who>.glb) as a scene, loaded once; null without one
func body_scene(cid: String, file: String) -> Variant:
	if body_scenes.has(cid):
		return body_scenes[cid]
	var path := "res://game/previs/" + file
	var ps = load(path) if ResourceLoader.exists(path) else null
	if ps == null and FileAccess.file_exists(path):   # not imported yet (a headless run): read the glb itself
		var doc := GLTFDocument.new()
		var st := GLTFState.new()
		if doc.append_from_file(path, st) == OK:
			var n = doc.generate_scene(st)
			if n != null:
				ps = PackedScene.new()
				ps.pack(n)
				n.free()
	body_scenes[cid] = ps
	return ps


func enter_level(lid: String, fresh: bool = false) -> void:
	if level_id == lid and level != null and not fresh:
		return
	if level != null:
		world.remove_child(level)
		level.queue_free()
	var ps: PackedScene = load("res://game/levels/%s.tscn" % lid)
	level = ps.instantiate()
	world.add_child(level)
	level_id = lid
	things.clear()
	for n in level.get_children():
		if n.has_meta("piece"):
			var p = JSON.parse_string(n.get_meta("piece"))
			if p is Dictionary:
				things[p["id"]] = {"node": n, "piece": p}
	set_time(time_of_day)


func set_time(t: String) -> void:
	time_of_day = t if TIME_LOOK.has(t) else StoryC.TIME_DEFAULT
	var L: Dictionary = TIME_LOOK[time_of_day]
	var e: Environment = env.environment
	e.background_color = L["sky"]
	e.ambient_light_color = L["amb"][0]
	e.ambient_light_energy = L["amb"][1]
	if level == null:
		return
	for n in level.get_children():
		if n is SpotLight3D and n.has_meta("window"):
			var w = JSON.parse_string(n.get_meta("window"))
			n.light_color = L["win"][0]
			n.light_energy = L["win"][1] * float(w.get("area", 1.0))
			n.spot_range = L["win"][2]


## the black over everything, eased over secs (the desk's fade)
func fade(to: float, secs: float) -> void:
	var from: float = hud.fade_alpha()
	var f := {"t": 0.0}
	fading = f
	while f["t"] < secs and fading == f:
		await get_tree().process_frame
		f["t"] = float(f["t"]) + get_process_delta_time()
		hud.set_fade(lerp(from, to, clamp(float(f["t"]) / max(0.001, secs), 0.0, 1.0)))
	if fading == f:
		hud.set_fade(to)
		fading = null


func fade_alpha() -> float:
	return hud.fade_alpha()


# ---- the run ----------------------------------------------------------------------------------------------------
func new_run() -> Dictionary:
	return {"secs": 0.0, "flags": {}, "results": {}, "trail": [], "done": {}, "karma": {}, "counters": {}, "answers": [], "items": {}, "todo": [], "name": null, "time": null, "models": {}}


func play_rt() -> Variant:
	if play == null:
		play = PlayC.new()
		play.name = "Play"
		add_child(play)
		play.setup(self, run, {"play_scene": func(sid): return await play_triggered(sid), "set_time": func(t): run["time"] = t; set_time(t), "quit": func(): stop_watch()})
	return play


func play_place(rt, lvl: String) -> void:
	var a = run.get("after_scene")
	run["after_scene"] = null
	if a != null and a["level"] == lvl:
		rt.place_from_camera(lvl, a["cam"])
	elif rt.level != lvl:
		rt.place_at(lvl, story.levels[lvl]["start"])
	else:
		rt.enter_level(lvl)


func play_triggered(sid) -> Variant:
	var sc0 = story.scenes.get(sid)
	if sc0 == null or run == null:
		return null
	await scene_player.play(StoryC.version(sc0), sid, sid)
	return {"level": story.level_of(StoryC.version(sc0)), "cam": camera.global_transform}


func play_stitch(st: Dictionary, n: Dictionary, lvl: String) -> Variant:
	var rt = play_rt()
	var t0 := Time.get_ticks_msec()
	play_place(rt, lvl)
	var its: Array = []
	for it in story.interrupts:
		var during = it.get("during", "all")
		if (during is String and during == "all") or (during is Array and during.has(n.get("ref"))):
			its.append(it)
	fade(0.0, 0.5)
	var r = await rt.run_stitch(st, n, its)
	rt.hold()
	run["secs"] = float(run["secs"]) + (Time.get_ticks_msec() - t0) / 1000.0
	var nx = story.flow.get(r.get("to"), null)
	if r.get("timeout", false) or nx == null or nx.get("type") == "ending" or (nx.get("type") == "stitch" and story.stitches.get(nx.get("ref"), {}).has("play")):
		await fade(1.0, 0.4)
	return r.get("to")


func play_choice(n: Dictionary) -> Variant:
	var rt = play_rt()
	var lvl: String = rt.level if rt.level != "" else ((run["after_scene"]["level"] if run.get("after_scene") != null else story.levels.keys()[0]))
	play_place(rt, lvl)
	fade(0.0, 0.4)
	var o = await rt.run_choice(n)
	rt.hold()
	return o


## a round of gameplay (a stitch with `play`: hide and seek): the player picks how it went, until it's real gameplay
func play_round(st: Dictionary, nid: String, n: Dictionary) -> Variant:
	var pl: Dictionary = st["play"]
	var results: Array = StoryC.PLAYS.get(pl.get("type"), ["success", "fail"])
	var labels: Array = []
	for r in results:
		labels.append({"label": str(r).replace("_", " ")})
	var res = null
	if fast:
		res = results[0]
	else:
		var i = await hud.choose({"prompt": "%s · %s" % [st.get("title", ""), pl.get("rule", "")], "options": labels, "secs": float(pl.get("secs", 30))})
		res = results[i] if (i >= 0 and i < results.size()) else results[0]
	run["results"][nid] = res
	karma_act(pl.get("on", {}).get(res, []))
	run["answers"].append("%s: %s" % [st.get("title", nid), res])
	if res != results[0] and (pl.get("spots", []) as Array).size() > 1:
		var sl: Array = []
		for sp in pl["spots"]:
			sl.append({"label": str(sp).replace("_", " ")})
		var j = await hud.choose({"prompt": "Where did she find you?", "options": sl, "secs": null})
		run["found_at"] = pl["spots"][j] if (j >= 0 and j < sl.size()) else pl["spots"][0]
	elif res != results[0] and (pl.get("spots", []) as Array).size() == 1:
		run["found_at"] = pl["spots"][0]
	run["secs"] = float(run["secs"]) + float(pl.get("secs", 0))
	await fade(1.0, 0.4)
	return n.get("next")


func karma_act(acts, t = null) -> void:
	if acts == null or run == null:
		return
	for a in acts:
		if not (a is Dictionary):
			continue
		if a.has("flag"):
			run["flags"][a["flag"]] = true
		if a.has("karma"):
			StoryC.add_karma(run["karma"], a["karma"])
		if a.has("count"):
			var c: Dictionary = run["counters"]
			c[a["count"]] = float(a["set"]) if a.has("set") else float(c.get(a["count"], 0)) + float(a.get("add", 1))
		if a.has("state") and run.has("lives"):
			run["lives"].set_state(a["state"], a.get("to"), float(t) if t != null else float(run["secs"]))
		if a.has("skip") and run.has("lives"):
			run["lives"].skip(float(t) if t != null else float(run["secs"]), float(a["skip"]))


func snap_of() -> Dictionary:
	var rt = play
	var T: float = rt.now() if rt != null else float(run["secs"])
	var states: Dictionary = {}
	if run.has("lives"):
		for id in run["lives"].things:
			var s = run["lives"].at(id, T)
			if s != null:
				states[id] = s["state"]
	return {"secs": run["secs"], "flags": run["flags"].keys(), "results": run["results"].duplicate(), "karma": run["karma"].duplicate(), "counters": run["counters"].duplicate(),
		"answers": run["answers"].duplicate(), "trail": run["trail"].duplicate(), "todo": (run.get("todo", []) as Array).duplicate(true), "name": run.get("name"),
		"items": (rt.items.keys() if rt != null else run["items"].keys()), "states": states}


func reach(nid: String) -> void:
	if not progress["visited"].has(nid):
		progress["visited"][nid] = snap_of()
	if story.flow[nid].get("type") == "ending" and not progress["endings"].has(nid):
		progress["endings"].append(nid)


func stop_watch() -> void:
	if play != null:
		play.stop()
		play.queue_free()
		play = null
	run = null


## the run, from a node (the start when none), with a checkpoint's state when given
func watch(from_nid = null, snap = null) -> void:
	stop_watch()
	watch_end = null
	run = new_run()
	run["lives"] = LifeC.new(lives_data, life_things).start(0.0)
	if snap != null:
		for k in ["secs", "results", "karma", "counters", "answers", "name"]:
			if snap.has(k):
				run[k] = snap[k].duplicate() if (snap[k] is Dictionary or snap[k] is Array) else snap[k]
		run["flags"] = {}
		for f in snap.get("flags", []):
			run["flags"][f] = true
		run["trail"] = (snap.get("trail", []) as Array).duplicate()
		run["items"] = {}
		for i in snap.get("items", []):
			run["items"][i] = true
		run["todo"] = (snap.get("todo", []) as Array).duplicate(true)
		for id in snap.get("states", {}):
			run["lives"].set_state(id, snap["states"][id], 0.0, "start")
	if run["name"] == null:
		run["name"] = story.game.get("player_name", "Alex")
	hud.player_name = str(run["name"])
	hud.set_fade(1.0)
	var nid = from_nid if from_nid != null else story.game.get("start")
	var guard := 0
	var times: Dictionary = story.flow_times()
	run["time"] = times.get(nid, story.game.get("time", StoryC.TIME_DEFAULT))
	set_time(run["time"])
	while run != null and nid != null and story.flow.has(nid) and guard < 300:
		guard += 1
		var n: Dictionary = story.flow[nid]
		reach(nid)
		run["trail"].append(nid)
		if n.get("type") == "scene" and story.scenes.get(n.get("ref"), {}).has("time"):
			run["time"] = story.scenes[n["ref"]]["time"]
			set_time(run["time"])
		if n.get("type") == "scene":
			var sc0: Dictionary = story.scenes.get(n.get("ref"), {})
			if sc0.get("pick_by") == "found_at" and run.get("found_at") != null and sc0.get("variants", {}).has(run["found_at"]):
				sc0 = sc0.duplicate()
				sc0["pick"] = run["found_at"]
			var to = await scene_player.play(StoryC.version(sc0), nid, n.get("ref"))
			if run == null:
				break
			nid = to if (to != null and story.flow.has(to)) else n.get("next")
			run["after_scene"] = {"level": story.level_of(StoryC.version(sc0)), "cam": camera.global_transform}
		elif n.get("type") == "stitch":
			var st: Dictionary = story.stitches.get(n.get("ref"), {})
			var ct: String = story.chapter_time(n)
			if st.has("play"):
				nid = await play_round(st, nid, n)
			else:
				nid = await play_stitch(st, n, story.level_of(st))
			if run != null and ct != "":
				run["time"] = ct
				set_time(ct)
		elif n.get("type") == "choice":
			match n.get("by"):
				"act":
					var o = await play_choice(n)
					nid = o.get("to")
				"result":
					var res = run["results"].get(n.get("of"))
					var pick = null
					for o in n.get("options", []):
						if o.get("result") == res:
							pick = o
							break
					nid = (pick if pick != null else n["options"][0]).get("to")
				"karma":
					nid = story.karma_pick(n, run["karma"]).get("to")
				"count":
					var opts: Array = n.get("options", [])
					var pick = opts[opts.size() - 1]
					for o in opts:
						var v := float(run["counters"].get(o.get("count"), 0))
						if (not o.has("min") or v >= float(o["min"])) and (not o.has("max") or v <= float(o["max"])):
							pick = o
							break
					nid = pick.get("to")
				_:
					var opts: Array = n.get("options", [])
					var pick = opts[opts.size() - 1]
					for o in opts:
						if StoryC.flags_hold(o.get("if", []), run["flags"]):
							pick = o
							break
					nid = pick.get("to")
		else:
			await ending(nid, n)
			break
	if run != null and nid == null and run["trail"].size():
		var last = run["trail"][run["trail"].size() - 1]
		watch_end = "cut:" + str(last)
		hud.log("the flow's cut after %s" % last)


func ending(nid: String, n: Dictionary) -> void:
	var death: bool = n.get("kind") == "death"
	hud.set_fade(0.8 if death else 0.6)
	var words: String = hud.named(n.get("text", ""))
	ending_words = words
	var text := "%s\n\n%s\n%.1f min of story time on this path\nkarma %s" % ["YOU DIED" if death else "ENDING · " + str(n.get("kind", "")), words, float(run["secs"]) / 60.0, JSON.stringify(run["karma"])]
	watch_end = n.get("title", nid)
	hud.objective(null)
	hud.todo([], false)
	if play != null:
		play.hold()
	hud.panel({"title": n.get("title", nid), "text": text, "ending": true})
