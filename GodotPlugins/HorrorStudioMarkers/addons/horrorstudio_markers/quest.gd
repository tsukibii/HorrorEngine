@tool
## A character's markers for one quest (docs/MARKERS.md §3, §6.2): a child of her HSNpc, its children her markers in
## order. Her quests are in order too: one with no Starts when starts when the one before is finished (the first: when
## the game starts); one with a Starts when starts the moment it's so, cutting an earlier quest short. She never goes
## back up the list, and a quest runs once.
class_name HSNpcQuest
extends Node3D

@export var title := ""                    ## its name on the tab ("Quest one: the missing book"); empty: the node's name
@export var starts_when := ""              ## the condition's words (cond.gd): "on:book" while that task is open, a flag...


func _get_configuration_warnings() -> PackedStringArray:
	if not (get_parent() is HSNpc):
		return PackedStringArray(["A quest's markers belong under a character's HSNpc node."])
	return PackedStringArray()


func label() -> String:
	return title if title != "" else String(name)
