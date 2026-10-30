## A level (docs/GODOT_DIRECTOR.md §3): a place the game plays in, its rooms, doors, things, areas, spots, paths, the
## cast standing in it and the lights you set up by hand. Build it right in the game's main scene under the HSGame,
## or as a scene of its own (root an HSLevel) dropped into the main scene. `start` is where the player begins (else
## a spot named start, else the first spot). The lights in it (OmniLight3D, SpotLight3D) are the story's: a switch
## flips the ones in its room, the power cut darkens them, an event's Light action or the lights dying finds them by
## their node's name; a light with candle or fire in its name burns on through the power cut.
## Played on its own (F6 with it open) it's a free roam: its events, nothing else.
@tool
@icon("res://addons/horrorstudio_director/icons/level.svg")
class_name HSLevel
extends Node3D

@export var id: String = ""
@export var start: NodePath
@export_enum("keep", "day", "dusk", "night") var time_of_day: String = "keep"
@export_enum("game", "balanced", "realism", "plain") var look: String = "game"
@export_enum("game", "clear", "rain") var weather: String = "game"

var _alone := false


func _enter_tree() -> void:
	if id == "":
		id = HSDirector.snake(str(name))
	if not Engine.is_editor_hint() and get_parent() == get_tree().root and not HSDirector.holding and get_tree().current_scene in [null, self]:
		_alone = true                                    # played on its own (F6): its nodes wait, a game round it plays it
		HSDirector.holding = true


func _ready() -> void:
	if Engine.is_editor_hint():
		return
	if _alone:
		var g: Node = load("res://addons/horrorstudio_director/story/game.gd").new()
		g.name = "HSGame"
		g.title = str(name)
		g.alone = self
		get_tree().root.add_child.call_deferred(g)
		return
	if HSDirector.holding:
		return
	_setup()


## the start spot's id
func start_id() -> String:
	var s = get_node_or_null(start) if not start.is_empty() else null
	if s != null:
		return HSDirector.id_of(s)
	var spots := HSDirector.nodes_of(self, "HSSpot")
	for sp in spots:
		if HSDirector.id_of(sp) == "start" or str(sp.name).to_lower().begins_with("start"):
			return HSDirector.id_of(sp)
	return HSDirector.id_of(spots[0]) if spots.size() else id + "__origin"


## for play: the cast's spots where they stand now, the lights as the story's, an origin spot if it has none
func _setup() -> void:
	for a in HSDirector.nodes_of(self, "HSActor"):
		var m := Marker3D.new()
		m.name = "_" + a.home_id()
		add_child(m)
		m.global_transform = a.global_transform
		HSDirector.stamp(m, {"id": a.home_id(), "kind": "spot", "shape": "box", "size": [0.3, 0.3, 0.0], "room": "",
			"yaw": HSDirector.story_yaw(a), "pos": HSDirector.story_pos(a.global_position), "tags": ["use:spot"], "d": {}})
	if HSDirector.nodes_of(self, "HSSpot").is_empty():
		var o := Marker3D.new()
		o.name = "_origin"
		add_child(o)
		HSDirector.stamp(o, {"id": id + "__origin", "kind": "spot", "shape": "box", "size": [0.3, 0.3, 0.0], "room": "", "yaw": -90.0,
			"pos": [0, 0, 0], "tags": ["use:spot"], "d": {}})
	var rooms := HSDirector.nodes_of(self, "HSRoom")
	var seen := {}
	for l in find_children("*", "Light3D", true, false):
		if l is DirectionalLight3D or l.has_meta("piece") or HSDirector.class_of(l).begins_with("HSFlicker"):
			continue
		var lid := HSDirector.snake(str(l.name))
		if seen.has(lid):
			lid = "%s_%d" % [lid, seen.size()]
		seen[lid] = true
		var room := ""
		for r in rooms:
			if r.holds(l.global_position):
				room = HSDirector.id_of(r)
				break
		var nm := str(l.name).to_lower()
		var kind := "candle" if nm.contains("candle") else ("fire" if nm.contains("fire") else ("lamp" if nm.contains("lamp") else "bulb"))
		HSDirector.stamp(l, {"id": lid, "kind": "light", "shape": "box", "size": [0.1, 0.1, 0.1], "room": room, "yaw": 0.0,
			"pos": HSDirector.story_pos(l.global_position), "tags": [], "d": {"kind": kind}})
		l.set_meta("light", JSON.stringify({"kind": kind, "room": room, "base": l.light_energy, "on": l.visible}))
		l.visible = true                                  # the runtime switches it by its energy (a light off at the start is on: false)


## the level as the story keeps it: its start, its paths as routes, its rooms
func as_story() -> Dictionary:
	var lv := {"start": start_id(), "routes": {}, "rooms": []}
	for p in HSDirector.nodes_of(self, "HSPath"):
		lv["routes"][HSDirector.id_of(p)] = p.as_story()
	for r in HSDirector.nodes_of(self, "HSRoom"):
		lv["rooms"].append(r.as_story())
	if look not in ["", "game"]:
		lv["look"] = look
	if weather not in ["", "game"]:
		lv["weather"] = weather
	return lv
