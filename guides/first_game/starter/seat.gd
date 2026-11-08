## A place to sit or lie down (guides/tutorial_v2: 304's desk chair and its bed). Put it on a Node3D where your eye goes
## when you're there, its -Z the way you face (a chair: toward the desk; a bed: toward its foot, `look_up_deg` tilting
## you up to the ceiling). E on it (an invisible box `reach_size` at `reach_at` from it, in its own turn, made when the
## game runs: over the chair's back, over the mattress) sits you there or lays you down; E again, or a step, gets you up
## where you stood. While you're there the player's doing() says sitting or lying, which a cue (cue.gd) asks. The box
## is on collision layer 2, the seats': the player's aim looks there, but your body walks, the sound travels and sight
## passes through it, so lying in the bed doesn't muffle the room round you.
extends Node3D

const LAYER := 2                                  ## collision layer 2 (its bit): only E's aim finds what's on it

signal sat(by: Node)                              ## sat down or lay down
signal left(by: Node)                             ## up again

@export_enum("sitting", "lying") var pose := "sitting"
@export_range(-30.0, 85.0) var look_up_deg := 0.0    ## the eye tilted up as you settle (lying on your back: 70)
@export var reach_size := Vector3(0.55, 0.9, 0.55)   ## the box E finds it by (a chair's: from the floor to over its back)
@export var reach_at := Vector3(0, -0.7, 0)           ## the box's middle, from here (a chair's eye is 1.2 m up)
@export var say := ""                                ## a line as you settle

var by: Node = null                               ## who's there


func _ready() -> void:
	var body := StaticBody3D.new()
	body.name = "Reach"
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = reach_size
	shape.shape = box
	shape.position = reach_at
	body.add_child(shape)
	body.collision_layer = LAYER
	body.collision_mask = 0
	add_child(body)


## E: there, or up again
func use(p: Node = null) -> void:
	if p == null:
		p = get_tree().get_first_node_in_group("hs_player")
	if p == null or not p.has_method("settle"):
		return
	if by != null:
		leave()
		return
	by = p
	p.settle(self)
	if say != "":
		var st := get_tree().get_first_node_in_group("hs_story")
		if st != null:
			st.say(say)
	sat.emit(p)


## up again, where they stood
func leave() -> void:
	if by == null:
		return
	var p := by
	by = null
	if p.has_method("rise"):
		p.rise()
	left.emit(p)
