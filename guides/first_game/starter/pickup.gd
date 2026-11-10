## A thing to pick up with E (guides/tutorial_v2): a key, batteries, anything with a name. It goes into the Story's
## pocket as `item` (a door locked by that name opens for it: door.gd), with a copy of what it looks like for the HUD's
## inventory row; "batteries" is a spare set for the flashlight (flashlight.gd changes it itself when the light dies).
## `cash` money instead (or as well): the Story's cash goes up by it (the laptop's shop spends it). Then it's gone. Put
## it on the thing (a mesh of your own, a made prop): a collider round it is made when the game runs (reach.gd), so E
## finds it.
extends Node3D

signal picked(item: String)

const Reach := preload("res://starter/reach.gd")

@export var item := "key"
@export var label := ""                         ## what the line says it is ("Room 304's key")
@export var tick := ""                          ## a task it ticks off
@export var add_tasks: PackedStringArray = []   ## tasks it adds, each "id: what it says"
@export var cash := 0.0                         ## money: what it adds to the Story's cash (its `item` left "" for money alone)

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
		if cash > 0.0 and st.has_method("earn"):
			st.earn(cash)
		if item != "":
			if st.get_method_argument_count("give") >= 3:
				st.give(item, label, _copy())
			else:
				st.give(item)                      # an older Story (one argument)
		st.say("Picked up: %s" % (label if label != "" else (item if item != "" else "$%.2f" % cash)))
		for t in add_tasks:
			st.add_line(t)
		if tick != "":
			st.tick(tick)
	visible = false
	if _body != null:
		_body.queue_free()
		_body = null
	picked.emit(item)


# what it looks like, for the HUD's row: its meshes where they are under it, nothing else (no script, no collider)
func _copy() -> Node3D:
	var g := Node3D.new()
	g.name = "copy_" + str(name)
	for m in find_children("*", "MeshInstance3D", true, false):
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
