## A thing the player can do something with (docs/GODOT_DIRECTOR.md §3): pick it up, read it, look at it closely,
## flip it (a light switch, the breaker), sit or sleep on it, hide in it, carry it, roll it, type its code, use an
## item on it, clean it, play at it. Put your model in as its child (or none: a stand-in box shows); the cursor
## finds it by its own collider, or by a box round it. Events hear it used ("the player uses old_letter"), taken
## ("picks up cellar_key") or read; `hidden_at_start` keeps it out of the level until an event shows it (a figure
## for a jumpscare, a key that turns up later).
@tool
@icon("res://addons/horrorstudio_director/icons/thing.svg")
class_name HSThing
extends Node3D

const USES := ["none", "pickup", "note", "inspect", "switch", "breaker", "sit", "sleep", "hide", "carry", "roll", "code", "use_item", "clean", "game"]
## each use's own fields in the Inspector
const FIELDS := {
	"pickup": ["item", "item_name", "flashlight"], "carry": ["item", "item_name"], "note": ["note_title", "note_text"],
	"inspect": ["inspect_text"], "switch": ["switches"], "code": ["code", "opens_flag"],
	"use_item": ["needs_item", "opens_flag", "consume"], "sleep": ["sleep_needs"], "hide": ["see_through"],
	"clean": ["clean_with", "stain"], "game": ["board_game"],
}
## the stand-in each use shows with no model: its size (x, y, z) and colour
const STANDIN := {"none": [Vector3(0.5, 0.5, 0.5), Color(0.5, 0.5, 0.5)], "pickup": [Vector3(0.12, 0.05, 0.08), Color(0.85, 0.7, 0.2)],
	"note": [Vector3(0.21, 0.004, 0.297), Color(0.92, 0.9, 0.82)], "inspect": [Vector3(0.15, 0.15, 0.15), Color(0.6, 0.5, 0.8)],
	"switch": [Vector3(0.08, 0.12, 0.02), Color(0.9, 0.9, 0.88)], "breaker": [Vector3(0.3, 0.4, 0.12), Color(0.4, 0.42, 0.45)],
	"sit": [Vector3(0.5, 0.45, 0.5), Color(0.45, 0.3, 0.2)], "sleep": [Vector3(1.0, 0.5, 2.0), Color(0.75, 0.75, 0.8)],
	"hide": [Vector3(1.0, 2.0, 0.6), Color(0.35, 0.25, 0.18)], "carry": [Vector3(0.4, 0.3, 0.3), Color(0.6, 0.45, 0.3)],
	"roll": [Vector3(0.15, 0.15, 0.15), Color(0.95, 0.95, 0.95)], "code": [Vector3(0.12, 0.16, 0.03), Color(0.2, 0.22, 0.25)],
	"use_item": [Vector3(0.3, 0.3, 0.3), Color(0.5, 0.6, 0.5)], "clean": [Vector3(0.7, 0.006, 0.55), Color(0.3, 0.2, 0.12)],
	"game": [Vector3(1.2, 0.75, 0.8), Color(0.3, 0.45, 0.3)]}
## the uses that stop the player by default (furniture); the rest only take the cursor's click
const SOLID := ["none", "breaker", "sit", "sleep", "hide", "roll", "game", "use_item"]

@export var id: String = ""
@export_enum("none", "pickup", "note", "inspect", "switch", "breaker", "sit", "sleep", "hide", "carry", "roll", "code", "use_item", "clean", "game") var use: String = "pickup":
	set(v):
		use = v
		notify_property_list_changed()
## the name the cursor shows ("Cellar key", "Old letter"); empty: the node's name
@export var display_name: String = ""
## pickup, carry: the item's id (what a door, an event or a use asks for)
@export var item: String = ""
@export var item_name: String = ""
## pickup: it's a flashlight (F switches it)
@export var flashlight: bool = false
@export var note_title: String = ""
@export_multiline var note_text: String = ""
@export_multiline var inspect_text: String = ""
## switch: the lights it switches (empty: every light in its room)
@export var switches: Array[NodePath] = []
@export var code: String = "1234"
## code, use_item: the flag set when it works (an event or a door's lock waits for it)
@export var opens_flag: String = ""
@export var needs_item: String = ""
@export var consume: bool = true
## sleep: flags that must be set before the bed lets the player sleep
@export var sleep_needs: PackedStringArray = PackedStringArray()
@export_range(0.0, 1.0) var see_through: float = 0.6
## clean: an item it needs (a mop, a cloth; empty: bare hands)
@export var clean_with: String = ""
@export_enum("dirt", "mud", "blood", "water", "ash") var stain: String = "dirt"
@export var board_game: String = "high_dice"
## stops the player (its own collider, or a box round it); off: only the cursor finds it
@export_enum("auto", "solid", "not solid") var solidity: String = "auto"
@export var hidden_at_start: bool = false

var _gen: Node3D = null
var _key := 0
var _tick := 0


func _enter_tree() -> void:
	if id == "":
		id = HSDirector.snake(str(name))


func _validate_property(p: Dictionary) -> void:
	var nm: String = p["name"]
	var all: Array = []
	for v in FIELDS.values():
		all.append_array(v)
	if all.has(nm) and not (FIELDS.get(use, []) as Array).has(nm):
		p["usage"] = PROPERTY_USAGE_STORAGE
		return
	if nm in ["needs_item", "clean_with"]:
		HSDirector.hint(p, "item")
	elif nm == "opens_flag":
		HSDirector.hint(p, "flag")
	elif nm == "board_game":
		p["hint"] = PROPERTY_HINT_ENUM_SUGGESTION
		p["hint_string"] = "russian_roulette,high_dice,chohan,spin_the_cup,shell_game,high_card,blackjack,shinkei_suijaku"


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
	if _tick % 10 == 0 and _settings().hash() != _key:
		_rebuild()


func _settings() -> Array:
	return [use, own_model() != null]


func own_model() -> Node3D:
	for c in get_children():
		if c is Node3D and not str(c.name).begins_with("_"):
			return c
	return null


func _rebuild() -> void:
	_key = _settings().hash()
	var old := get_node_or_null("_gen")
	if old != null:
		old.free()
	_gen = Node3D.new()
	_gen.name = "_gen"
	add_child(_gen)
	if own_model() != null:
		return
	var st: Array = STANDIN.get(use, STANDIN["none"])
	var sz: Vector3 = st[0]
	var mi := MeshInstance3D.new()
	mi.name = "mesh"
	var bm := BoxMesh.new()
	bm.size = sz
	mi.mesh = bm
	var m := HSDirector.grey(st[1], 0.6)
	if use == "clean":
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = Color(st[1], 0.85)
	mi.material_override = m
	mi.position = Vector3(0, sz.y / 2.0, 0)
	_gen.add_child(mi)


func _solid() -> bool:
	if solidity == "auto":
		return SOLID.has(use)
	return solidity == "solid"


## for play: the box round it made its origin, a collider (its own, or one round it), its piece
func _setup() -> void:
	var a := HSDirector.local_aabb(self)
	if a.size == Vector3.ZERO:
		a = AABB(Vector3(-0.1, 0, -0.1), Vector3(0.2, 0.2, 0.2))
	HSDirector.recentre(self, a)
	var size := a.size
	var mesh = _gen.get_node_or_null("mesh")
	if mesh != null:                                  # the stand-in a direct child named mesh (a stain fades through it: play.gd set_stain)
		var t: Transform3D = mesh.global_transform
		_gen.remove_child(mesh)
		add_child(mesh)
		mesh.global_transform = t
	if not HSDirector.has_collider(self):
		HSDirector.box_collider(self, size, Vector3.ZERO, not _solid() or use == "clean")
	if hidden_at_start:
		visible = false
	var tags: Array = []
	if use != "none":
		tags.append("use:" + ("combo" if use == "code" else "use_on" if use == "use_item" else "locker" if use == "hide" else use))
	if hidden_at_start:
		tags.append("hidden")
	if display_name != "":
		tags.append("tag:" + HSDirector.snake(display_name))
	HSDirector.stamp(self, {"id": HSDirector.id_of(self), "kind": "mesh", "shape": "box", "size": HSDirector.story_size(AABB(Vector3.ZERO, size)),
		"room": room_id(), "yaw": HSDirector.story_yaw(self), "pos": HSDirector.story_pos(global_position), "tags": tags, "d": data()})


## the use's words as the runtime reads them (the piece's `d`)
func data() -> Dictionary:
	var d := {}
	if display_name != "":
		d["name"] = display_name
	match use:
		"pickup", "carry":
			d["item"] = item if item != "" else HSDirector.id_of(self)
		"note":
			d["note"] = HSDirector.id_of(self)
		"inspect":
			d["text"] = inspect_text
		"switch":
			if switches.size() == 1:
				var l = get_node_or_null(switches[0])
				if l != null:
					d["light"] = HSDirector.snake(str(l.name))
		"code":
			d["code"] = code
			d["then"] = opens_flag if opens_flag != "" else HSDirector.id_of(self) + "_open"
		"use_item":
			d["needs"] = needs_item
			d["then"] = opens_flag if opens_flag != "" else HSDirector.id_of(self) + "_done"
			d["consume"] = consume
		"sleep":
			if sleep_needs.size():
				d["if"] = Array(sleep_needs)
		"hide":
			d["see_through"] = see_through
		"clean":
			d["stain"] = stain
			if clean_with != "":
				d["with"] = clean_with
		"game":
			d["game"] = board_game
	return d


## the item it is (pickup, carry): its id
func item_id() -> String:
	return item if item != "" else HSDirector.id_of(self)


func room_id() -> String:
	if not is_inside_tree():
		return ""
	for r in get_tree().get_nodes_in_group("hs_rooms"):
		if r.holds(global_position):
			return HSDirector.id_of(r)
	return ""
