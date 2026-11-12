## Something to eat or drink with E (sanity.gd: eating mends your sanity): an apple, a bowl of noodles, a can from the
## vending machine. Put it on the thing (a mesh of your own, a made prop); a collider round it is made when the game
## runs (reach.gd), so E finds it. `restores` is how much of the meter it mends (0.25: a quarter); `bites` how many times
## before it's gone. With no Sanity node in the scene it's only eaten.
extends Node3D

const Reach := preload("res://starter/reach.gd")

signal eaten(left: int)

@export_range(0.0, 1.0) var restores := 0.25         ## how much sanity each bite mends
@export var label := ""                               ## what the line calls it ("the noodles")
@export var bites := 1                                ## times it can be eaten before it's gone
@export var say := ""                                 ## the line (empty: "You have <label>.")
@export var sound := ""                               ## off the shelf, played here
@export var tick := ""                                ## a task it ticks off

var _body: StaticBody3D


func _ready() -> void:
	_body = Reach.make(self)


func use(_by: Node = null) -> void:
	if not visible or bites <= 0:
		return
	bites -= 1
	var san := get_tree().get_first_node_in_group("hs_sanity")
	if san != null and san.has_method("eat"):
		san.eat(restores, label if label != "" else str(name))
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null:
		if st.has_method("say"):
			st.say(say if say != "" else "You have %s." % (label if label != "" else "it"))
		if tick != "" and st.has_method("tick"):
			st.tick(tick)
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if sound != "" and snd != null and snd.has_method("play"):
		snd.play(sound, global_position, 0.0, "sfx")
	eaten.emit(bites)
	if bites <= 0:
		visible = false
		if _body != null:
			_body.queue_free()
			_body = null
