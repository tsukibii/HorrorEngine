## The game (docs/GODOT_DIRECTOR.md §1): the main scene's root. Under it the levels (HSLevel, built right here or
## instanced from their own scenes): the world. The story is the Director file (`story_file`, director/director.json:
## its quests, states, moments, conversations, endings; written in the panel's Story tab or the Director Manager),
## never the scene's nodes. Its own settings are the game's (the title, the player's name, the time of day, the look,
## the camcorder tape, the grade, the HUD's theme, the player's). Played (F5), it compiles the world and the story
## (compile.gd), takes its levels up as templates, starts the studio's runtime with them (the player, the interactions,
## the HUD, the menu, the saves) and the Director's brain beside it (run/brain.gd: the facts, the conditions, the
## states). F9 in the game shows where the player is and what's set; run from the editor, the dock follows along.
@tool
@icon("res://addons/horrorstudio_director/icons/game.svg")
class_name HSGame
extends Node

const RUN_FILE := "user://hs_director_run.json"     # "play from here": the dock's step and state for the next run

@export var title: String = "Untitled"
## the story: the Director file (the panel's Story tab and the Director Manager write it)
@export_file("*.json") var story_file: String = "res://director/director.json"
@export var player_name: String = "Alex"
@export_enum("night", "dusk", "day") var time_of_day: String = "night"
@export_range(60.0, 110.0) var fov: float = 90.0
@export_enum("balanced", "realism", "plain") var look: String = "balanced"
@export_enum("off", "camcorder", "camhybrid", "worn", "nightmare") var vhs: String = "off"
@export_enum("cinema", "teal-orange", "cold", "sodium", "bleach", "noir", "warm", "none") var grade: String = "cinema"
@export_enum("glass", "glass-rose", "neumorph", "plain") var ui_theme: String = "glass"
## off: a flat test light, for playing before the lighting is made
@export_enum("on", "off") var lighting: String = "on"
@export_enum("clear", "rain") var weather: String = "clear"
## the game's counters (times caught, candles lit...): an event's Counter action counts them
@export var counters: PackedStringArray = PackedStringArray()
## F9 in the game: where the player is, the flags, the items, the events as they fire
@export var debug_panel: bool = true
@export_group("The player")
## Shift runs
@export var can_run: bool = true
## C crouches
@export var can_crouch: bool = true
## the standing eye height, metres (crouching keeps its share of it)
@export_range(1.2, 2.0, 0.01) var eye_height: float = 1.65
@export_group("")

var alone: Node = null              # a level played on its own (F6): the game round it
var runtime: Node = null            # the studio's runtime (addons/horrorstudio/main.tscn) once it's started
var compiled: Dictionary = {}
var templates: Dictionary = {}      # level id -> its HSLevel, out of the tree (the runtime enters a copy)
var _debug: Node = null
var brain: Node = null              # the Director at play (run/brain.gd)


func _enter_tree() -> void:
	if not Engine.is_editor_hint() and alone == null:
		HSDirector.holding = true


func _ready() -> void:
	if Engine.is_editor_hint():
		return
	_start.call_deferred()


func _start() -> void:
	var req := _run_request()
	HSDirector.testing = alone != null or bool(req.get("test", false))   # a level played alone, or Play from here: its Test start
	var c := HSCompiler.new()
	compiled = c.compile(self, alone, HSStoryFile.read(story_file))
	for p in compiled["problems"]:
		var where: String = str(p["node"].name) if p["node"] != null and is_instance_valid(p["node"]) else "game"
		if p["error"]:
			push_error("HorrorStudio Director: %s: %s" % [where, p["text"]])
		else:
			print("HorrorStudio Director: %s: %s" % [where, p["text"]])
	for lid in compiled["levels"]:
		var lv: Node = compiled["levels"][lid]
		var par := lv.get_parent()
		if par != null:
			par.remove_child(lv)
		templates[lid] = lv
	if alone != null and get_tree().current_scene == alone:
		get_tree().current_scene = self
	HSDirector.holding = false
	_try_here(req)
	var ps: PackedScene = load(HSDirector.RUNTIME_MAIN)
	runtime = ps.instantiate()
	runtime.story_data = compiled["story"]
	runtime.level_scenes = templates
	runtime.life_things_data = compiled.get("life_things", {})
	runtime.autostart = false
	runtime.on_step = _on_step
	runtime.on_play = _on_play
	brain = load("res://addons/horrorstudio_director/run/brain.gd").new()
	brain.name = "HSBrain"
	brain.game = self
	brain.runtime = runtime
	brain.data = compiled.get("brain", {})
	brain.unlocked.connect(func(id, t): _send("achievement", [id, t]))
	add_child(brain)
	for we in get_children():                    # a WorldEnvironment put beside the levels: the game's own environment
		if we is WorldEnvironment and we.environment != null:
			var env: Environment = we.environment
			we.queue_free()
			runtime.get_node("Env").environment = env
	add_child(runtime)
	if debug_panel:
		_debug = load("res://addons/horrorstudio_director/run/debug.gd").new()
		_debug.name = "HSDebug"
		_debug.game = self
		add_child(_debug)
	var from = null
	var snap = null
	var test_lv := _test_level(req) if HSDirector.testing and alone == null else ""
	var want := str(req.get("from", ""))
	if want == "" and test_lv != "":                  # a test in a level the game doesn't begin in: from its first quest there
		want = _first_in(test_lv)
	if compiled["story"]["flow"].has(want):
		from = want
		snap = {"flags": req.get("flags", []), "items": req.get("items", []), "karma": {"karma": float(req.get("karma", 0))}, "counters": {}, "states": {}, "trail": []}
		for k in _before(from):
			snap["flags"].append("@" + k)
			if compiled.get("brain", {}).get("quests", []).has(k):
				snap["flags"].append("done:" + k)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--node=") and compiled["story"]["flow"].has(a.substr(7)):
			from = a.substr(7)
			snap = {"flags": [], "items": [], "karma": {"karma": 0.0}, "counters": {}, "states": {}, "trail": []}
	if test_lv != "":
		_stay(from, test_lv)
	var carry := start_items(test_lv if test_lv != "" else _first_level(from))
	if carry.size():                                  # what the player starts with (their Player start's)
		if snap == null:
			snap = {"flags": [], "items": [], "karma": {"karma": 0.0}, "counters": {}, "states": {}, "trail": []}
		for i in carry:
			if not (snap["items"] as Array).has(i):
				snap["items"].append(i)
	HSDirector.testing = false
	_send("start", [compiled["story"]["game"].get("start"), _problem_lines()])
	runtime.watch(from, snap)


## the play-from-here file (the panel's and the dock's: {from, flags, test, near}), read once and gone
func _run_request() -> Dictionary:
	if not FileAccess.file_exists(RUN_FILE):
		return {}
	var j = JSON.parse_string(FileAccess.get_file_as_string(RUN_FILE))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RUN_FILE))
	return j if j is Dictionary else {}


## the panel's Try it: the player put in front of a thing ({level, pos, yaw}: a spot made in that level's template for
## this run, the level's start)
func _try_here(req: Dictionary) -> void:
	var near = req.get("near")
	if not (near is Dictionary) or not templates.has(str(near.get("level", ""))):
		return
	var lid := str(near["level"])
	var lv: Node3D = templates[lid]
	var p: Array = near.get("pos", [0, 0, 0])
	var sp := HSSpot.new()
	sp.name = "_try_here"
	sp.id = "try_here"
	lv.add_child(sp)
	sp.transform = lv.transform.affine_inverse() * Transform3D(Basis(Vector3.UP, deg_to_rad(float(near.get("yaw", 0.0)))), Vector3(float(p[0]), float(p[1]), float(p[2])))
	compiled["story"]["levels"][lid]["start"] = "try_here"


## what the player starts with: the Player start they begin at in that level (the Test start in a test run)
func start_items(lid: String) -> Array:
	var lv = templates.get(lid)
	var st = lv.start_node() if lv != null and lv.has_method("start_node") else null
	return Array(st.starts_with) if st != null and HSDirector.is_a(st, "HSPlayerStart") else []


## the flow from a node (the start when none), each node's next (a choice's first option): the nodes a run meets in order
func _walk(from = null) -> Array:
	var flow: Dictionary = compiled.get("story", {}).get("flow", {})
	var out: Array = []
	var n = from if from != null else compiled.get("story", {}).get("game", {}).get("start")
	while n != null and flow.has(n) and not out.has(n) and out.size() < 500:
		out.append(n)
		var f: Dictionary = flow[n]
		n = f.get("next") if f.get("next") != null else ((f.get("options", [{}]) as Array)[0].get("to") if f.get("options") else null)
	return out


## a run's first quest (a chapter's card is its quest's: its next): the flow node, "" if a scene or an ending comes first
func _first_quest(from = null) -> String:
	var st: Dictionary = compiled.get("story", {})
	for nid in _walk(from):
		var n: Dictionary = st["flow"][nid]
		if n.get("type") != "stitch":
			return ""
		if not str(n.get("ref", "")).ends_with("__card"):
			return str(nid)
	return ""


## the level a run begins in: its first quest's (from a node, the start when none), else the first level
func _first_level(from = null) -> String:
	var q := _first_quest(from)
	var lv := str(compiled.get("story", {}).get("stitches", {}).get(compiled["story"]["flow"][q].get("ref"), {}).get("level", "")) if q != "" else ""
	return lv if templates.has(lv) else (str(templates.keys()[0]) if templates.size() else "")


## a test run's level: the Try it's, else the one with a Test start ("" with neither: the run is the game's)
func _test_level(req: Dictionary) -> String:
	var near = req.get("near")
	if near is Dictionary and templates.has(str(near.get("level", ""))):
		return str(near["level"])
	for lid in templates:
		for st in HSDirector.nodes_of(templates[lid], "HSPlayerStart"):
			if st.start_for == "test":
				return str(lid)
	return ""


## where a test in a level begins: the first quest played there ("" when the game's first quest is, or none is)
func _first_in(lid: String) -> String:
	var st: Dictionary = compiled.get("story", {})
	var first := _first_quest()
	for nid in _walk():
		var n: Dictionary = st["flow"][nid]
		if n.get("type") == "stitch" and not str(n.get("ref", "")).ends_with("__card") and str(st["stitches"].get(n["ref"], {}).get("level", "")) == lid:
			return "" if nid == first else str(nid)
	return ""


## a test run: the player stays where the test put them (the Test start, in front of the thing), not sent to the
## first quest's own start (its start_at)
func _stay(from, lid: String) -> void:
	var q := _first_quest(from)
	var st: Dictionary = compiled["story"]
	if q == "" or str(st["stitches"].get(st["flow"][q].get("ref"), {}).get("level", "")) != lid:
		return
	var ref := str(st["flow"][q]["ref"])
	for b in st["stitches"][ref].get("beats", []):
		if b.get("id") == ref + "__start":
			b["do"] = (b["do"] as Array).filter(func(a): return not (a is Dictionary and str(a.get("move", "")) == "player"))


## the flow's nodes before a step on the way there from the start (their @ flags, for a start from that step)
func _before(nid: String) -> Array:
	var w := _walk()
	var i := w.find(nid)
	return w.slice(0, i) if i >= 0 else w


func _problem_lines() -> Array:
	var out: Array = []
	for p in compiled.get("problems", []):
		out.append(("ERROR " if p["error"] else "") + str(p["text"]))
	return out


## the editor's dock follows the run (EditorDebuggerPlugin: horrorstudio:<what>)
func _send(what: String, data: Array) -> void:
	if EngineDebugger.is_active():
		EngineDebugger.send_message("horrorstudio:" + what, data)


func _on_step(nid) -> void:
	if brain != null:
		brain.step(str(nid))
	var flags: Array = runtime.run["flags"].keys() if runtime.run != null else []
	_send("step", [str(nid), flags])
	if _debug != null:
		_debug.step(str(nid))


func _on_play(rt) -> void:
	rt.on_level = _on_level
	rt.on_event = _on_event
	rt.on_flag = func(f): _send("flag", [str(f)])


func _on_event(ev: Dictionary) -> void:
	if brain != null:
		brain.event(ev)                              # the facts first: the beats hearing this read them
	_send("event", [JSON.stringify(ev)])
	if _debug != null:
		_debug.event(ev)


## a level entered: its characters start doing what they do (their HSActor's behaviour), unless an event already
## gave them something to do here
func _on_level(lid: String) -> void:
	var rt = runtime.play
	var tpl: Node = templates.get(lid)
	if rt == null or tpl == null:
		return
	for a in HSDirector.nodes_of(tpl, "HSActor"):
		var cid := HSDirector.id_of(a)
		var n = rt.npcs.get(cid)
		if n != null and n["level"] == lid:
			continue
		if n != null:
			rt.npcs.erase(cid)
		if a.hidden_at_start or a.behaviour == "off":
			continue
		var b: Dictionary = a.behave()
		rt.behave(cid, b)
	if brain != null:
		brain.level(lid)                             # the story's states over the characters' own
	rt.draw_npcs(0.0)                                  # on their marks now: a dialogue that starts the level shows them too
