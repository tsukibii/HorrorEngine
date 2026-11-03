## A Character Studio character's arms down by its sides (it's exported in MHR's pose, the arms out): put this under the
## character, beside its HSCharacterLook. In the editor and the game; `degrees` how far down.
@tool
extends Node

@export var degrees := 52.0:
	set(v):
		degrees = v
		apply()


func _ready() -> void:
	apply()


func apply() -> void:
	var who := get_parent()
	if who == null or not is_inside_tree():
		return
	for sk in who.find_children("*", "Skeleton3D", true, false):
		for side in [["l_uparm", -1.0], ["r_uparm", 1.0]]:
			var bi: int = sk.find_bone(side[0])
			if bi < 0:
				continue
			var rest: Transform3D = sk.get_bone_global_rest(bi)
			sk.set_bone_global_pose(bi, Transform3D(Basis(Vector3(0, 0, 1), deg_to_rad(degrees * float(side[1]))) * rest.basis, rest.origin))
