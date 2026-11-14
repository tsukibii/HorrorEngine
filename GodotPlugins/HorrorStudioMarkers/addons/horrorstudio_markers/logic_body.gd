## The box a Logic puts round a thing that has no use() of its own (logic.gd `_reach`): the starter's player finds it
## with E and its use() is the Logic's. Made when the game runs, never saved.
extends StaticBody3D

var logic: Node


func use(by: Node = null) -> void:
	if logic != null and is_instance_valid(logic):
		logic.press(by)
