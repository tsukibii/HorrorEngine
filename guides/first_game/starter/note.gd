## Something to read with E (guides/tutorial_v2): a note, a sign, a letter. Its words open on the Story's card (E puts
## them away). Reading it can tick a task, add the tasks it tells you about, and set a new objective. Put it on the
## thing (a mesh of your own: a sheet of paper): a collider round it is made when the game runs (reach.gd).
extends Node3D

signal read

const Reach := preload("res://starter/reach.gd")

@export var title := ""
@export_multiline var text := ""
@export var tick := ""                          ## a task it ticks off
@export var add_tasks: PackedStringArray = []   ## tasks it adds, each "id: what it says"
@export var objective := ""

var was_read := false


func _ready() -> void:
	Reach.make(self)


func use(_by: Node = null) -> void:
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null:
		st.card(title, text)
		if not was_read:
			if objective != "":
				st.objective(objective)
			for t in add_tasks:
				st.add_line(t)
			if tick != "":
				st.tick(tick)
	was_read = true
	read.emit()
