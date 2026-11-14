## Something to eat or drink (sanity.gd: eating mends your sanity): an apple, a bowl of noodles, a can from the
## vending machine. Put it on the thing (a mesh of your own, a made prop); a collider round it is made when the game
## runs (reach.gd), so E finds it. E takes it into the pocket as something eatable; then, with it in the hand, hold
## the left button: the Story's eat meter fills over `eat_secs`, and it's eaten and gone (story.gd: Eating). `restores`
## is how much of the Sanity meter one mends (0.25: a quarter); `count` how many E gives you (a pack of three). With
## no Sanity node in the scene it's only eaten.
extends Node3D

const Reach := preload("res://starter/reach.gd")

signal picked(item: String)

@export var item := ""                                ## the pocket's name for it (empty: this node's name, in small letters)
@export var label := ""                               ## what it's called on screen ("the noodles")
@export_range(0.0, 1.0) var restores := 0.25         ## how much sanity eating one mends
@export var eat_secs := 2.0                           ## how long the left button is held to eat it
@export var count := 1                                ## how many you pick up
@export var say := ""                                 ## the line when it's eaten (empty: "You have <label>.")
@export var sound := ""                               ## off the shelf, as it's eaten
@export var tick := ""                                ## a task it ticks off when it's eaten

var _body: StaticBody3D


func _ready() -> void:
	_body = Reach.make(self)


func id() -> String:
	return item if item != "" else str(name).to_snake_case()


func use(_by: Node = null) -> void:
	if not visible:
		return
	var st := get_tree().get_first_node_in_group("hs_story")
	if st == null or not st.has_method("set_eatable"):
		return
	var more := {}
	if say != "": more["say"] = say
	if sound != "": more["sound"] = sound
	if tick != "": more["tick"] = tick
	st.set_eatable(id(), restores, eat_secs, more)
	st.give(id(), label, _copy(), count)
	st.say("Picked up: %s. Hold the left button to eat it." % (label if label != "" else id().replace("_", " ")))
	visible = false
	if _body != null:
		_body.queue_free()
		_body = null
	picked.emit(id())


# what it looks like, for the HUD's row: its meshes where they are under it
func _copy() -> Node3D:
	var g := Node3D.new()
	g.name = "copy_" + str(name)
	var me: Node = self
	var meshes: Array = ([me] if me is MeshInstance3D else []) + find_children("*", "MeshInstance3D", true, false)   # (the thing itself when it's the mesh: a model the Things tab's card was clicked on)
	for m in meshes:
		var mi := m as MeshInstance3D
		if mi.mesh == null:
			continue
		var c := MeshInstance3D.new()
		c.mesh = mi.mesh
		c.material_override = mi.material_override
		for i in mi.get_surface_override_material_count():
			c.set_surface_override_material(i, mi.get_surface_override_material(i))
		c.transform = global_transform.affine_inverse() * mi.global_transform
		g.add_child(c)
	return g
