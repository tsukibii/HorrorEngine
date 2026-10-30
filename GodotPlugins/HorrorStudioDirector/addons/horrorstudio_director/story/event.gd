## An event (docs/GODOT_DIRECTOR.md §4): WHEN something happens (`when`), IF the flags and items say so, THEN its
## actions in order. "When the player enters the hallway, if they've found the key and haven't seen the ghost:
## the ghost shows for a second with a sting, set saw_ghost."
## Where it sits says when it listens: inside a task, while that task is on; inside a chapter, through its tasks;
## anywhere else (the game, a level, a trigger, a thing), through the whole game; `only_after` holds it back until
## the run has reached that step. Inside a trigger, a room or a thing, an empty `when` is entering it or using it.
## `once`: it fires once a playthrough; off, every time (`every` seconds apart at least).
@tool
@icon("res://addons/horrorstudio_director/icons/event.svg")
class_name HSEvent
extends Node

@export var id: String = ""
## what sets it off (empty inside a trigger or room: the player enters it; inside a thing: the player uses it)
@export var when: HSWhen
## flags that must all be set
@export var require_flags: PackedStringArray = PackedStringArray()
## flags none of which may be set
@export var block_flags: PackedStringArray = PackedStringArray()
## items the player must hold
@export var require_items: PackedStringArray = PackedStringArray()
## what it does, in order
@export var actions: Array[HSAction] = []
@export var once: bool = true
## (not once) the seconds before it can fire again
@export var every: float = 1.0
## only once the run has reached this step (a task, a dialogue...)
@export var only_after: NodePath
## optional: the story doesn't need it to happen (the check won't ask for it)
@export var optional: bool = true


func _enter_tree() -> void:
	if id == "":
		id = HSDirector.snake(str(name))


func _validate_property(p: Dictionary) -> void:
	if p["name"] in ["require_flags", "block_flags"]:
		p["hint"] = PROPERTY_HINT_TYPE_STRING
		p["hint_string"] = "%d/%d:%s" % [TYPE_STRING, PROPERTY_HINT_ENUM_SUGGESTION, HSDirector.suggest("flag")]
	elif p["name"] == "require_items":
		p["hint"] = PROPERTY_HINT_TYPE_STRING
		p["hint_string"] = "%d/%d:%s" % [TYPE_STRING, PROPERTY_HINT_ENUM_SUGGESTION, HSDirector.suggest("item")]
	elif p["name"] == "every" and once:
		p["usage"] = PROPERTY_USAGE_STORAGE


## the id of what it sits in when that answers an empty `when`: a trigger or room (entered), a thing (used)
func host() -> Array:
	var p := get_parent()
	while p != null:
		var c := HSDirector.class_of(p)
		if c in ["HSTrigger", "HSRoom"]:
			return ["enter", HSDirector.id_of(p)]
		if c in ["HSThing", "HSDoor", "HSActor"]:
			return ["use", HSDirector.id_of(p)]
		if c in ["HSTask", "HSChapter", "HSGame", "HSLevel", "HSDialogue"]:
			return ["", ""]
		p = p.get_parent()
	return ["", ""]


## the trigger as the story writes it
func trigger(beats: Dictionary = {}) -> Dictionary:
	var h := host()
	if when == null:
		if h[0] == "enter":
			return {"enter": h[1]}
		if h[0] == "use":
			return {"use": h[1]}
		return {"start": true}
	return when.to_story(h[1], beats)


## its conditions as the story's `if` (flags, `!` for not, item:<id>)
func conditions() -> Array:
	var out: Array = []
	for f in require_flags:
		if f != "":
			out.append(f)
	for f in block_flags:
		if f != "":
			out.append("!" + f)
	for it in require_items:
		if it != "":
			out.append("item:" + it)
	return out


## its actions as the story's
func story_actions() -> Array:
	var out: Array = []
	for a in actions:
		if a != null:
			out.append_array(a.to_story())
	return out


## the event as words (the dock's list)
func describe() -> String:
	var h := host()
	var w := when.describe(h[1]) if when != null else ("the player enters %s" % h[1] if h[0] == "enter" else ("the player uses %s" % h[1] if h[0] == "use" else "the task starts"))
	var cond: Array = []
	for f in require_flags:
		cond.append(f)
	for f in block_flags:
		cond.append("not " + f)
	for it in require_items:
		cond.append("has " + it)
	var acts: Array = []
	for a in actions:
		if a != null:
			acts.append(a.describe())
	return "When %s%s, then %s%s" % [w, (", if " + ", ".join(cond)) if cond.size() else "", "; ".join(acts) if acts.size() else "(nothing yet)", "" if once else " (every time)"]
