## The game (the main scene's root): the story loaded, a level in the World, the player's eye at its start. The flow
## walker and Play (the desk's runtime ported) come on top of this (play.gd, flow.gd).
extends Node
const Story := preload("res://addons/horrorstudio/story.gd")

var story
var level_id: String = ""
var level: Node3D = null
var things: Dictionary = {}        # id -> {node, piece}

@onready var world: Node3D = $World
@onready var player: Node3D = $Player
@onready var camera: Camera3D = $Player/Camera
@onready var env: WorldEnvironment = $Env


func _ready() -> void:
	story = Story.load_file("res://game/story.json")
	var start = story.game.get("start")
	var first: String = ""
	if story.flow.has(start):
		first = story.level_of(story.flow[start])
	if first != "":
		enter_level(first)
	elif story.levels.size():
		enter_level(story.levels.keys()[0])
	set_time(story.game.get("time", Story.TIME_DEFAULT))
	place_at_start()


## the level's scene instanced into the World; every node with a piece registered by its id
func enter_level(lid: String) -> void:
	if level_id == lid and level != null:
		return
	if level != null:
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


func place_at_start() -> void:
	var st = story.levels.get(level_id, {}).get("start")
	var t = things.get(st)
	if t == null:
		return
	var pos: Vector3 = t["node"].global_position
	camera.global_position = pos + Vector3(0, Story.EYES["stand"], 0)
	camera.rotation_degrees = Vector3(0, float(t["piece"].get("yaw", 0)) - 90, 0)
	camera.fov = Story.vfov(float(story.game.get("fov", Story.FOV_H)), 16.0 / 9.0)


## the time of day (stage.js TIME_LOOK): the sky, the ambient, the window lights
const TIME_LOOK := {
	"day": {"sky": Color(0.718, 0.776, 0.839), "amb": [Color(0.839, 0.855, 0.886), 0.65], "win": [Color(0.933, 0.953, 1.0), 20.0, 8.0]},
	"dusk": {"sky": Color(0.18, 0.125, 0.188), "amb": [Color(0.627, 0.549, 0.533), 0.32], "win": [Color(1.0, 0.698, 0.478), 6.0, 6.0]},
	"night": {"sky": Color(0.027, 0.039, 0.086), "amb": [Color(0.478, 0.525, 0.667), 0.22], "win": [Color(0.561, 0.659, 1.0), 1.2, 5.0]},
}
var time_of_day: String = "night"

func set_time(t: String) -> void:
	time_of_day = t if TIME_LOOK.has(t) else Story.TIME_DEFAULT
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
