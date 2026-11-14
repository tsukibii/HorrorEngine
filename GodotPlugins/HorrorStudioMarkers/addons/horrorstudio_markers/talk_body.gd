## What the player's E finds on a character you can talk to: a box round her on the layer only E's aim looks at (2),
## made by her runner while the game runs (never saved). The starter kit's player walks up from what its ray hit to
## the first node with use(): this one, which hands it to her HSNpc.
extends StaticBody3D

var npc: Node


func use(by: Node = null) -> void:
	if npc != null and is_instance_valid(npc) and npc.has_method("use"):
		npc.use(by)
