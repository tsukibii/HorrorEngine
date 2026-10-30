## The game (docs/GODOT_DIRECTOR.md §1): the main scene's root. Under it the levels (HSLevel, built right here or
## instanced from their own scenes) and the story in play order (chapters, tasks, dialogue, choices, endings; plain
## Nodes to group them as you like); its own settings are the game's (the title, the player's name, the time of
## day, the look, the camcorder tape, the grade, the HUD's theme). Played (F5), it compiles all of it into the story
## (compile.gd), takes its levels up as templates and starts the studio's runtime with them: the player, the
## interactions, the HUD, the menu, the saves. F9 in the game shows where the player is and what's set; run from the
## editor, the dock follows along.
@tool
@icon("res://addons/horrorstudio_director/icons/game.svg")
class_name HSGame
extends Node

const RUN_FILE := "user://hs_director_run.json"     # "play from here": the dock's step and state for the next run

@export var title: String = "Untitled"
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

var alone: Node = null              # a level played on its own (F6): the game round it
var runtime: Node = null            # the studio's runtime (addons/horrorstudio/main.tscn) once it's started
var compiled: Dictionary = {}
var templates: Dictionary = {}      # level id -> its HSLevel, out of the tree (the runtime enters a copy)
var _debug: Node = null


func _enter_tree() -> void:
	if not Engine.is_editor_hint() and alone == null:
		HSDirector.holding = true


func _ready() -> void:
	if Engine.is_editor_hint():
		return
	_start.call_deferred()


func _start() -> void:
	var c := HSCompiler.new()
	compiled = c.compile(self, alone)
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
	var ps: PackedScene = load(HSDirector.RUNTIME_MAIN)
	runtime = ps.instantiate()
	runtime.story_data = compiled["story"]
	runtime.level_scenes = templates
	runtime.autostart = false
	runtime.on_step = _on_step
	runtime.on_play = _on_play
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
	if FileAccess.file_exists(RUN_FILE):
		var j = JSON.parse_string(FileAccess.get_file_as_string(RUN_FILE))
		DirAccess.remove_absolute(ProjectSettings.globalize_path(RUN_FILE))
		if j is Dictionary and compiled["story"]["flow"].has(str(j.get("from", ""))):
			from = str(j["from"])
			snap = {"flags": j.get("flags", []), "items": j.get("items", []), "karma": {"karma": float(j.get("karma", 0))}, "counters": {}, "states": {}, "trail": []}
			for k in _before(from):
				snap["flags"].append("@" + k)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--node=") and compiled["story"]["flow"].has(a.substr(7)):
			from = a.substr(7)
			snap = {"flags": [], "items": [], "karma": {"karma": 0.0}, "counters": {}, "states": {}, "trail": []}
	_send("start", [compiled["story"]["game"].get("start"), _problem_lines()])
	runtime.watch(from, snap)


## the flow's nodes before a step on the way there from the start (their @ flags, for a start from that step)
func _before(nid: String) -> Array:
	var flow: Dictionary = compiled["story"]["flow"]
	var out: Array = []
	var n = compiled["story"]["game"].get("start")
	var guard := 0
	while n != null and n != nid and flow.has(n) and guard < 500:
		guard += 1
		out.append(n)
		var f: Dictionary = flow[n]
		n = f.get("next") if f.get("next") != null else ((f.get("options", [{}]) as Array)[0].get("to") if f.get("options") else null)
	return out


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
	var flags: Array = runtime.run["flags"].keys() if runtime.run != null else []
	_send("step", [str(nid), flags])
	if _debug != null:
		_debug.step(str(nid))


func _on_play(rt) -> void:
	rt.on_level = _on_level
	rt.on_event = _on_event
	rt.on_flag = func(f): _send("flag", [str(f)])


func _on_event(ev: Dictionary) -> void:
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
	rt.draw_npcs(0.0)                                  # on their marks now: a dialogue that starts the level shows them too
