## A way into another scene (a game of several levels by hand): an Area3D you walk into, taking you to `scene` at `at`
## (a node of that scene: a Marker3D where you arrive, facing its way) with what you carry: the Story's to-do list,
## facts, pocket, cash and objective (story.gd's go_to). `needs` in the Story's words (the stairs down open once you
## have the key: "item:key"); `say` a line when it won't take you yet. Give it a CollisionShape3D, or call `fire()`
## from any signal (a door's opened, a cue).
extends Area3D

@export_file("*.tscn") var scene := ""            ## the scene it takes you to
@export var at := ""                              ## a node of that scene where you arrive (a Marker3D: its place and facing); empty: where its player stands
@export var needs := ""                           ## the Story's words that must hold for it to take you
@export var say := ""                             ## said when they don't, once each time you walk in

var _going := false


func _ready() -> void:
	body_entered.connect(_on_body)


func _on_body(b: Node) -> void:
	if b.is_in_group("hs_player"):
		fire()


## take the player there now (from any signal: whatever it sends is ignored)
func fire(_a = null, _b = null) -> void:
	var st := get_tree().get_first_node_in_group("hs_story")
	if _going or st == null:
		return
	if needs != "" and not st.holds(needs):
		if say != "":
			st.say(say)
		return
	_going = true
	st.go_to(scene, at)
