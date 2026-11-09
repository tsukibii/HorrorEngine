@icon("res://addons/horrorstudio_weapons/icons/shells.svg")
class_name HSWeaponPickup
extends Node3D
## Something for the weapon, taken with E (the starter's player uses whatever has use()): `kind` double (the shotgun,
## the double barrel itself, lying on its side where you put this, `shells` coming with it into the pocket; a scene's
## old `shotgun` is the double too) or shells (a box of them, for the gun you carry). `shell` the kind of shells
## (HSShellType: the plugin's `shells/explosive.tres`, or one of your own; none, the gun's normal buckshot): its box is
## the kind's own when the plugin has one (`models/shells_box_5_<id>.glb`), or `box_model`. Taken, the player's gun (the
## group hs_weapon) is given the gun or the shells, a line is said (the Story's, `say`) and this is gone. `taken` to
## wire anything to (a scare when you pick it up).
signal taken

const DIR := "res://addons/horrorstudio_weapons/"

@export_enum("double", "shells") var kind := "double"
@export var shells := 5
@export var say := ""
@export_range(0.0, 110.0) var lid_open := 0.0     ## a box of shells' lid, degrees open (0 shut): the shells inside show
@export var shell: HSShellType                    ## the kind of shells (none: the gun's normal kind)
@export var box_model: PackedScene                ## the box (none: the kind's own box, else the plugin's box of five)


func _ready() -> void:
	var box := Vector3(0.9, 0.08, 0.2)
	if kind != "shells":
		var g := (load(DIR + "models/shotgun_double.glb") as PackedScene).instantiate() as Node3D
		add_child(g)
		g.rotation = Vector3(deg_to_rad(90.0), 0.0, 0.0)          # on its side
		g.position = Vector3(0, 0.024, 0)
	else:
		box = Vector3(0.15, 0.06, 0.12)
		var bm: PackedScene = box_model
		if bm == null and shell != null and ResourceLoader.exists(DIR + "models/shells_box_5_%s.glb" % shell.id):
			bm = load(DIR + "models/shells_box_5_%s.glb" % shell.id)
		if bm == null:
			bm = load(DIR + "models/shells_box_5.glb")          # (the prop generator's box of five)
		var b := bm.instantiate() as Node3D
		add_child(b)
		b.rotation = Vector3(0, deg_to_rad(-8.0), 0)
		if lid_open > 0.0:
			_open_lid(b, lid_open)
		var sh: PackedScene = shell.model if shell != null and shell.model != null else load(DIR + "models/shell_12ga.glb")
		for i in 2:                                          # two spilled beside it
			var s := sh.instantiate() as Node3D
			add_child(s)
			s.rotation = Vector3(0, deg_to_rad(25.0 + 70.0 * i), deg_to_rad(90.0))
			s.position = Vector3(0.088 + 0.018 * i, 0.0114, 0.032 - 0.058 * i)
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = box
	cs.shape = bs
	cs.position = Vector3(0, box.y / 2, 0)
	body.add_child(cs)
	add_child(body)


# the box's lid (its glb's part `lid`, at its hinge) turned open by `deg`
func _open_lid(b: Node3D, deg: float) -> void:
	for n in b.find_children("*", "Node3D", true, false):
		var ex: Dictionary = n.get_meta("extras", {}) if n.has_meta("extras") else {}
		var part = ex.get("propgen_part")
		if part is String:
			part = JSON.parse_string(part)                # (the exporter writes it as JSON text)
		if part is Dictionary and str(part.get("name", "")) == "lid":
			var ax: Array = part.get("axis", [-1, 0, 0])
			(n as Node3D).rotate_object_local(Vector3(float(ax[0]), float(ax[1]), float(ax[2])).normalized(), deg_to_rad(deg))
			return


func use(_by: Node = null) -> void:
	var w: Node = null
	for g in get_tree().get_nodes_in_group("hs_weapon"):    # (the gun; shells to the one you carry)
		if kind != "shells" or w == null or bool(g.get("owned")):
			w = g
			if kind != "shells":
				break
	if w == null:
		return
	if kind != "shells":
		w.give(shells, shell)
	else:
		w.add_shells(shells, shell)
	var snd := load(DIR + "sounds/shells_box.ogg") as AudioStream if kind == "shells" else null   # (the gun's own handling plays as it's drawn)
	if snd != null and w.has_method("sound"):
		w.sound(snd, global_position, -4.0, "foley")
	var st := get_tree().get_first_node_in_group("hs_story")
	if say != "" and st != null and st.has_method("say"):
		st.say(say)
	taken.emit()
	queue_free()
