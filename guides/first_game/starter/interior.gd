## An interior from the scene builder's Export for Godot (Exports/interiors/<name>/<name>.glb), made usable: put this on
## the interior's instance (the .glb dragged into your scene). It stands where a street wants it (`street` and `marker`:
## the street's README names its walk-in buildings' markers, inside_<building>), in the editor too; when the game runs
## every door under its doors/ opens and shuts with E (door.gd), and `lights_on` puts its lamps on or off.
@tool
extends Node3D

const DOOR := preload("res://starter/door.gd")

@export var street: Node3D:                  ## the street's instance; empty: the interior stays where you put it
	set(v):
		street = v
		place()
@export var marker := "":                    ## the street's marker for it: inside_<building> (the street's README)
	set(v):
		marker = v
		place()
@export var lights_on := true:
	set(v):
		lights_on = v
		_lights()


func _ready() -> void:
	place()
	_lights()
	if Engine.is_editor_hint():
		return
	for d in doors():
		if d.get_script() == null:
			d.set_script(DOOR)
			d.setup()


## stood at the street's marker (the marker's place and turn are where the level's own origin goes)
func place() -> void:
	if not is_inside_tree() or street == null or marker == "":
		return
	var m := street.find_child(marker, true, false) as Node3D
	if m != null:
		global_transform = m.global_transform


## its doors (doors/door_<id>, each on its hinge) and its lamps (lights/light_<id>)
func doors() -> Array:
	var out := []
	for d in find_children("door_*", "", true, false):
		if d.get_parent() != null and str(d.get_parent().name) == "doors":
			out.append(d)
	return out


func lamps() -> Array:
	return find_children("light_*", "Light3D", true, false)


## a marker of its own (markers/player_start, spot_<id>, trigger_<id>): where it is in the world
func marker_at(marker_name: String) -> Transform3D:
	var m := find_child(marker_name, true, false) as Node3D
	return m.global_transform if m != null else global_transform


func _lights() -> void:
	if is_inside_tree():
		for l in lamps():
			l.visible = lights_on
