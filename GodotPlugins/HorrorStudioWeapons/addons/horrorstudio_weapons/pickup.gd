@icon("res://addons/horrorstudio_weapons/icons/shells.svg")
class_name HSWeaponPickup
extends Node3D
## Something for the weapon, taken with E (the starter's player uses whatever has use()): `kind` shotgun (the gun itself,
## lying on its side where you put this, `shells` coming with it into the pocket) or shells (a box of them). Taken, the
## player's HSShotgun (the group hs_weapon) is given the gun or the shells, a line is said (the Story's, `say`) and this
## is gone. `taken` to wire anything to (a scare when you pick it up).
signal taken

const DIR := "res://addons/horrorstudio_weapons/"

@export_enum("shotgun", "shells") var kind := "shotgun"
@export var shells := 5
@export var say := ""


func _ready() -> void:
	var box := Vector3(0.9, 0.08, 0.2)
	if kind == "shotgun":
		var g := (load(DIR + "models/shotgun_pump.glb") as PackedScene).instantiate() as Node3D
		add_child(g)
		g.rotation = Vector3(deg_to_rad(90.0), 0.0, 0.0)          # on its side
		g.position = Vector3(0, 0.024, 0)
	else:
		box = Vector3(0.12, 0.08, 0.1)
		var b := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.11, 0.036, 0.075)
		b.mesh = bm
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.55, 0.12, 0.1)
		m.roughness = 0.8
		b.material_override = m
		b.position = Vector3(0, 0.018, 0)
		add_child(b)
		var sh := load(DIR + "models/shell_12ga.glb") as PackedScene
		for i in 3:
			var s := sh.instantiate() as Node3D
			add_child(s)
			s.rotation = Vector3(0, deg_to_rad(20.0 + 35.0 * i), deg_to_rad(90.0))
			s.position = Vector3(-0.03 + 0.03 * i, 0.0105, 0.07)
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = box
	cs.shape = bs
	cs.position = Vector3(0, box.y / 2, 0)
	body.add_child(cs)
	add_child(body)


func use(_by: Node = null) -> void:
	var w := get_tree().get_first_node_in_group("hs_weapon")
	if w == null:
		return
	if kind == "shotgun":
		w.give(shells)
	else:
		w.add_shells(shells)
	var snd := load(DIR + "sounds/%s.ogg" % ("shotgun_handle" if kind == "shotgun" else "shells_box")) as AudioStream
	if snd != null and w.has_method("sound"):
		w.sound(snd, global_position, -4.0, "foley")
	var st := get_tree().get_first_node_in_group("hs_story")
	if say != "" and st != null and st.has_method("say"):
		st.say(say)
	taken.emit()
	queue_free()
