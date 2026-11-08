## An interior from the scene builder's Export for Godot (Exports/interiors/<name>/<name>.glb), made usable: put this on
## the interior's instance (the .glb dragged into your scene). It stands where a street wants it (`street` and `marker`:
## the street's README names its walk-in buildings' markers, inside_<building>), in the editor too; when the game runs
## every door under its doors/ opens and shuts with E (door.gd), `lights_on` puts its lamps on or off, and its windows'
## glass casts no shadow (Godot's importer draws glTF's see-through glass with a depth pre-pass, which casts one: a
## street lamp or the moon outside never got through a window).
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
	add_to_group("hs_interior")                  # (the Sound node reads its rooms' surfaces off its markers)
	place()
	_lights()
	if Engine.is_editor_hint():
		return
	for d in doors():
		if d.get_script() == null:
			d.set_script(DOOR)
			d.setup()
	clear_glass()


## the windows' glass (a mesh named for it with a see-through material) casts no shadow: light comes through
func clear_glass() -> void:
	for mi in find_children("*glass*", "MeshInstance3D", true, false):
		var m: Material = mi.mesh.surface_get_material(0) if mi.mesh != null and mi.mesh.get_surface_count() > 0 else null   # its own (a pane may wear the rain's over it)
		if m is BaseMaterial3D and m.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


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


## a room's box from the export (its markers/trigger_<room>__volume: the room's middle, its size in the metadata):
## {xform: where its middle is in the world, size: its width, height and depth}; empty when there's no such room
func room_box(room: String) -> Dictionary:
	var m := find_child("trigger_%s__volume" % room, true, false) as Node3D
	if m == null:
		return {}
	var e: Dictionary = m.get_meta("extras", {}) if m.has_meta("extras") else {}
	var s: Array = e.get("size", [2.0, 2.0, 2.4])
	var local: Vector3 = global_transform.affine_inverse() * m.global_position
	return {"xform": global_transform * Transform3D(Basis(), local), "size": Vector3(float(s[0]), float(s[2]), float(s[1]))}


## an Area3D the size of one of its rooms, put there (its CollisionShape3D made when the game runs: room_tone.gd,
## event_area.gd and scare_area.gd call this with their `room`)
func fit_area(area: Area3D, room: String) -> bool:
	var b := room_box(room)
	if b.is_empty():
		push_warning("%s: no room %s in %s" % [area.name, room, name])
		return false
	var sh := CollisionShape3D.new()
	sh.name = "_room"
	var bs := BoxShape3D.new()
	bs.size = b["size"]
	sh.shape = bs
	area.add_child(sh)
	sh.global_transform = b["xform"]
	return true


func _lights() -> void:
	if is_inside_tree():
		for l in lamps():
			l.visible = lights_on
