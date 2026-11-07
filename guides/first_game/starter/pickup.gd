## A thing to pick up with E (guides/tutorial_v2): a key, batteries, anything with a name. It goes into the Story's
## pocket as `item` (a door locked by that name opens for it: door.gd); "batteries" is a spare set for the flashlight
## (flashlight.gd changes it itself when the light dies). Then it's gone. Put it on the thing (a mesh of your own, a
## made prop): a collider round it is made when the game runs (reach.gd), so E finds it.
extends Node3D

signal picked(item: String)

const Reach := preload("res://starter/reach.gd")

@export var item := "key"
@export var label := ""                         ## what the line says it is ("Room 304's key")
@export var tick := ""                          ## a task it ticks off
@export var add_tasks: PackedStringArray = []   ## tasks it adds, each "id: what it says"

var _body: StaticBody3D


func _ready() -> void:
	_body = Reach.make(self)


func use(by: Node = null) -> void:
	if not visible:
		return
	var st := get_tree().get_first_node_in_group("hs_story")
	if item == "batteries":
		var fl = by.get_node_or_null("Eye/Flashlight") if by != null else null
		if fl != null and fl.has_method("add_spare"):
			fl.add_spare()
	if st != null:
		st.give(item)
		st.say("Picked up: %s" % (label if label != "" else item))
		for t in add_tasks:
			st.add_line(t)
		if tick != "":
			st.tick(tick)
	visible = false
	if _body != null:
		_body.queue_free()
		_body = null
	picked.emit(item)
