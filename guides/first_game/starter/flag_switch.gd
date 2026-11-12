## Flags switched on and off (DECISIONS 2026-11-12, after the intensifiers: "ideally quests can trigger variable
## flags on/off, should be easy to make new flags"). A flag is a name the Story keeps: on or off. Nothing has to
## list it first: type a new name here and it exists. Anything's Needs can ask for it ("table_gone", or
## "!table_gone" for while it's off): a shown.gd's Shown When, a cue, an area, a hunt, a look.
##   flags   what this switches, one a line: "+name" on (or just "name"), "-name" off, "~name" flipped
##   fire()  does it: an event area's, a cue's, a scare's or a moment's Target, or any signal
##   when    the Story's words: it does it by itself the moment they come to hold ("task:key": when that task is
##           ticked; "on:key": when it's put on your list; "item:soda"); `again` for every time they do
##   needs   fire() only does it while these hold
## The Story can do the same without a node: its Task Flags ("key: +table_gone, -lights_ok") and Flags Start.
extends Node

signal switched

@export var flags: PackedStringArray = []           ## "+name" on, "-name" off, "~name" flipped
@export var when := ""                              ## the Story's words: by itself when they come to hold
@export var again := false                          ## every time they come to hold (else once)
@export var needs := ""                             ## fire(): only while these hold
@export var say := ""                               ## a line as it does

var times := 0                                      ## times it's switched them
var _held := false
var _t := 0.0


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


## switch them now (whatever a signal sends is ignored)
func fire(_a = null, _b = null) -> void:
	var st := _story()
	if st == null or not st.has_method("switch_flags"):
		return
	if needs != "" and not st.holds(needs):
		return
	for f in flags:
		st.switch_flags(f)
	if say != "":
		st.say(say)
	times += 1
	switched.emit()


func _process(dt: float) -> void:
	if when == "":
		return
	_t -= dt
	if _t > 0.0:
		return
	_t = 0.15
	var st := _story()
	if st == null or not st.has_method("holds"):
		return
	var now: bool = st.holds(when)
	if now and not _held and (again or times == 0):
		fire()
	_held = now
