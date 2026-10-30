## A character (docs/GODOT_DIRECTOR.md §3): one of the cast, standing where you put her, facing her +Z, what she does
## while the player plays (`behaviour`: stand there, sit on a seat, walk a path, patrol several, or off until an event
## brings her), whether she watches for the player (`sees_player`: the suspicion meter, "caught"), whether a click
## talks to her (`talk`: heard as "the player uses <her id>", an event plays the conversation). Put her model in as a
## child (a Character Studio export, any rigged glb; none: a stand-in figure); its AnimationPlayer's animations are
## her motions (a Kimodo motion brought in by the dock's Kimodo tab lands there): `idle_motion` while she stands,
## `walk_motion` while she walks.
@tool
@icon("res://addons/horrorstudio_director/icons/actor.svg")
class_name HSActor
extends Node3D

@export var id: String = ""
@export var display_name: String = ""
@export_range(1.0, 2.3) var height: float = 1.62
@export_enum("idle", "sit", "path", "patrol", "off") var behaviour: String = "idle":
	set(v):
		behaviour = v
		notify_property_list_changed()
## sit: the seat (an HSThing that's sat on, or a spot)
@export var seat: NodePath
## path: the HSPath she walks; patrol: each in turn
@export var path: NodePath
@export var patrol: Array[NodePath] = []
@export_range(0.3, 4.0) var speed: float = 1.1
## stand turned to the player
@export var face_player: bool = false
@export var sees_player: bool = false
@export_range(10.0, 180.0) var sight_angle: float = 90.0
@export_range(1.0, 30.0) var sight_range: float = 9.0
@export var talk: bool = false
## stops the player (a capsule round her)
@export var solid: bool = true
@export var idle_motion: String = ""
@export var walk_motion: String = ""
## the Character Studio export she wears (People/<name>, copied in by tools/godot_director.py), instead of a model child
@export var studio_character: String = ""
@export var hidden_at_start: bool = false

var _gen: Node3D = null
var _key := 0
var _tick := 0


func _enter_tree() -> void:
	HSDirector.auto_id(self)
	if display_name == "":
		display_name = str(name)


func _validate_property(p: Dictionary) -> void:
	var nm: String = p["name"]
	if (nm == "seat" and behaviour != "sit") or (nm == "path" and behaviour != "path") or (nm == "patrol" and behaviour != "patrol"):
		p["usage"] = PROPERTY_USAGE_STORAGE
	elif nm in ["sight_angle", "sight_range"] and not sees_player:
		p["usage"] = PROPERTY_USAGE_STORAGE
	elif nm in ["idle_motion", "walk_motion"]:
		p["hint"] = PROPERTY_HINT_ENUM_SUGGESTION
		p["hint_string"] = ",".join(PackedStringArray(motion_names()))


func _ready() -> void:
	if not Engine.is_editor_hint() and HSDirector.holding:
		return
	_rebuild()
	if not Engine.is_editor_hint():
		_setup()


func _process(_dt: float) -> void:
	if not Engine.is_editor_hint():
		return
	_tick += 1
	if _tick % 10 == 0 and [height, own_model() != null].hash() != _key:
		_rebuild()


func own_model() -> Node3D:
	for c in get_children():
		if c is Node3D and not str(c.name).begins_with("_"):
			return c
	return null


## the animations on her AnimationPlayers (her motions), by the names an event or a behaviour plays them by
func motion_names() -> Array:
	var out: Array = []
	for ap in find_children("*", "AnimationPlayer", true, false):
		for lib in ap.get_animation_library_list():
			for a in ap.get_animation_library(lib).get_animation_list():
				if str(a) != "RESET" and not out.has(str(a)):
					out.append(str(a))
	return out


func _rebuild() -> void:
	_key = [height, own_model() != null].hash()
	var old := get_node_or_null("_gen")
	if old != null:
		old.free()
	_gen = Node3D.new()
	_gen.name = "_gen"
	add_child(_gen)
	if own_model() == null and studio_character == "":
		var m := HSDirector.grey(Color(0.55, 0.5, 0.62), 0.7)
		var body := MeshInstance3D.new()
		body.name = "body"
		var cap := CapsuleMesh.new()
		cap.radius = 0.2
		cap.height = max(0.5, height - 0.25)
		body.mesh = cap
		body.material_override = m
		body.position = Vector3(0, (height - 0.25) / 2.0, 0)
		_gen.add_child(body)
		var head := MeshInstance3D.new()
		head.name = "head"
		var sm := SphereMesh.new()
		sm.radius = 0.11
		sm.height = 0.22
		head.mesh = sm
		head.material_override = m
		head.position = Vector3(0, height - 0.12, 0)
		_gen.add_child(head)
		var nose := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.05, 0.05, 0.12)
		nose.mesh = bm
		nose.material_override = m
		nose.position = Vector3(0, height - 0.14, 0.12)
		_gen.add_child(nose)


## for play: her stand-in as the runtime's (a person of the cast), a collider, the click
func _setup() -> void:
	if solid:
		var b := StaticBody3D.new()
		b.name = "_solid"
		var cs := CollisionShape3D.new()
		var c := CapsuleShape3D.new()
		c.radius = 0.25
		c.height = height
		cs.shape = c
		cs.position = Vector3(0, height / 2.0, 0)
		b.add_child(cs)
		add_child(b)
	elif talk:
		HSDirector.box_collider(self, Vector3(0.5, height, 0.5), Vector3(0, height / 2.0, 0), true)
	var tags: Array = ["cast:" + HSDirector.id_of(self), "standin"]
	if talk:
		tags.append("use:talk")
	HSDirector.stamp(self, {"id": HSDirector.id_of(self), "kind": "person", "shape": "box", "size": [0.5, 0.3, height], "room": "",
		"yaw": HSDirector.story_yaw(self), "pos": HSDirector.story_pos(global_position), "tags": tags, "d": {"name": display_name}})


## where she stands at the level's start: a spot of its own (the level makes it, play's behaviours need one)
func home_id() -> String:
	return HSDirector.id_of(self) + "__home"


## her behaviour as the story's `behave`, with the ids of the level's nodes
func behave() -> Dictionary:
	var b := {"behave": HSDirector.id_of(self), "as": behaviour, "speed": speed}
	match behaviour:
		"idle":
			b["at"] = home_id()
			if face_player:
				b["face"] = "player"
		"sit":
			var s = get_node_or_null(seat)
			b["at"] = HSDirector.id_of(s) if s != null else home_id()
		"path":
			var p = get_node_or_null(path)
			if p == null:
				b["as"] = "idle"
				b["at"] = home_id()
			else:
				b["route"] = HSDirector.id_of(p)
		"patrol":
			var rs: Array = []
			for np in patrol:
				var p = get_node_or_null(np)
				if p != null:
					rs.append(HSDirector.id_of(p))
			if rs.is_empty():
				b["as"] = "idle"
				b["at"] = home_id()
			else:
				b["routes"] = rs
	if sees_player:
		b["sees"] = {"angle": sight_angle, "range": sight_range}
	var mo := walk_motion if b["as"] in ["path", "patrol"] else idle_motion
	if mo != "":
		b["motion"] = mo
	if b["as"] in ["path", "patrol"] and idle_motion != "":
		b["rest"] = idle_motion
	return b
