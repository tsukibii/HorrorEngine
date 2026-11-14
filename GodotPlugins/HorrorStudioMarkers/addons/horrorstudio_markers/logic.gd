@tool
## Logic for a thing (docs/FLAGS.md §2): put one under anything (a door, a pickup, a note, a seat, the laptop, an area,
## a lamp) and that thing speaks the markers' language. Three lines, as a marker has:
##
##     Works only when   `needs`: flags, tasks, things carried (the words of a marker's Starts when). While they
##                       aren't so, E on the thing does nothing but say `locked_says`. Empty: it always works.
##     When              `on`: it's used (E), one of its signals is sent (a door's `opened`, a pickup's `picked`, an
##                       area's `body_entered`), or by itself, the moment its needs come to be so.
##     Then              flags switched, a task ticked or added, a line, a sound, things fired.
##
## So a marker and a thing are tied by a flag's name and nothing else: a marker's Then turns `alex_gone` on, the
## door's Logic needs `alex_gone`; the door's Logic turns `cellar_open` on when it's `opened`, a marker starts when
## `cellar_open`. The Flags tab shows both ends of every flag; the Things tab fills this in without typing.
##
## The thing is its parent (or `thing`). The starter's player asks it before it uses a thing (`allows`) and tells it
## after (`used`); nothing else has to know it's there. With no Story in the scene the flags are the plugin's own.
class_name HSLogic
extends Node

signal refused                                ## it was tried while its needs aren't so
signal done                                   ## it did its Then

const WHENS := {"used": "it's used (E)", "signal": "one of its signals", "itself": "by itself, when its needs are so"}

@export var thing: NodePath                   ## what this is the logic of; empty: its parent
@export_group("Works only when")
@export var needs := ""                       ## the condition's words: "alex_gone, item:key, !task:power"; empty: always
@export var locked_says := ""                 ## the line when it's tried while they aren't so
@export var locked_sound := ""                ## and a sound: one of the sound shelf's by name
@export_group("When")
@export_enum("used", "signal", "itself") var on := "used":   ## what sets its Then off
	set(v):
		on = v
		notify_property_list_changed()
@export var on_signal := ""                   ## which signal of the thing (opened, closed, picked, body_entered...)
@export var once := true                      ## only the first time (off: every time)
@export_group("Then")
@export var set_flags := ""                   ## flags switched: "+cellar_open, -door_locked, ~lights"
@export var tick := ""                        ## a task ticked
@export var add_tasks: PackedStringArray = [] ## tasks put on the list: "id: what to do"
@export var say := ""                         ## a line
@export_range(0.5, 20.0, 0.1) var say_secs := 3.0
@export var sound := ""                       ## a sound: one of the sound shelf's by name
@export var fires: Array[NodePath] = []       ## things fired: their fire(), start() or use()

static var _warned := false

var times := 0                                ## how often it has done its Then
var _held := false
var _poll := 0.0
var _kept := 0
var _hooked: Node


func _validate_property(property: Dictionary) -> void:
	if String(property["name"]) == "on_signal" and on != "signal":
		property["usage"] = PROPERTY_USAGE_NO_EDITOR | PROPERTY_USAGE_STORAGE


func _get_configuration_warnings() -> PackedStringArray:
	var out := PackedStringArray()
	var t := thing_node()
	if on == "signal":
		if on_signal == "":
			out.append("Pick which signal sets it off (On Signal).")
		elif t != null and not t.has_signal(on_signal):
			out.append("%s has no signal '%s'." % [t.name, on_signal])
	return out


func _ready() -> void:
	if Engine.is_editor_hint():
		set_process(false)
		return
	add_to_group("hs_logic")
	var t := thing_node()
	if on == "signal" and t != null and on_signal != "" and t.has_signal(on_signal):
		t.connect(on_signal, _heard)
	set_process(on == "itself")
	_hook()
	_player_asks.call_deferred()


func _exit_tree() -> void:
	_unhook()


# A player older than this node uses things without asking their Logic: said once, with what to do
func _player_asks() -> void:
	var t := thing_node()
	if _warned or t == null or not t.has_method("use") or (needs.strip_edges() == "" and on != "used"):
		return
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl != null and not pl.has_method("logic_of"):
		_warned = true
		push_warning("HSLogic (%s): this project's player uses things without asking their Logic (its starter/player.gd is from before it). Copy the studio's over it: python tools/godot_byhand.py install <this project> --starter" % get_path())


## the thing this is the logic of
func thing_node() -> Node:
	if not thing.is_empty():
		return get_node_or_null(thing)
	return get_parent()


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story") if is_inside_tree() else null


# the Story's checkpoints keep how often this has fired, so a flag put back by dying is set again the next time
func _hook() -> void:
	var st := _story()
	if st == null or st == _hooked:
		return
	_hooked = st
	if st.has_signal("kept"):
		st.connect("kept", _on_kept)
	if st.has_signal("revived"):
		st.connect("revived", _on_revived)


func _unhook() -> void:
	if _hooked != null and is_instance_valid(_hooked):
		if _hooked.has_signal("kept") and _hooked.is_connected("kept", _on_kept):
			_hooked.disconnect("kept", _on_kept)
		if _hooked.has_signal("revived") and _hooked.is_connected("revived", _on_revived):
			_hooked.disconnect("revived", _on_revived)
	_hooked = null


func _on_kept() -> void:
	_kept = times


func _on_revived() -> void:
	times = _kept
	_held = false


## is it so now?
func holds() -> bool:
	return HSNpcCond.holds(needs, get_tree())


## May the thing be used? (The player asks before it calls the thing's use().) When not: its line, its sound.
func allows(_by: Node = null) -> bool:
	if needs.strip_edges() == "" or holds():
		return true
	_say(locked_says)
	_sound(locked_sound)
	refused.emit()
	return false


## The thing was used (the player says so after its use()).
func used(_by: Node = null) -> void:
	if on == "used":
		run()


# one of the thing's signals (whatever it sends): an area's body_entered counts only for the player
func _heard(a = null, _b = null, _c = null, _d = null) -> void:
	if on_signal.begins_with("body_") and a is Node and not (a as Node).is_in_group("hs_player"):
		return
	if holds():
		run()


func _process(dt: float) -> void:
	_poll -= dt
	if _poll > 0.0:
		return
	_poll = 0.1
	var now := holds()
	if now and not _held:
		run()
	_held = now


## Its Then, now (from a script or another node's signal too: whatever a signal sends is ignored). False when it has
## already happened and it's a once.
func run(_a = null, _b = null) -> bool:
	if once and times > 0:
		return false
	times += 1
	_hook()
	HSNpcCond.switch_flags(get_tree(), set_flags)
	var st := _story()
	if st != null:
		if tick != "" and st.has_method("tick"):
			st.tick(tick)
		if st.has_method("add_line"):
			for line in add_tasks:
				st.add_line(line)
	_say(say, say_secs)
	_sound(sound)
	for p in fires:
		var t := get_node_or_null(p)
		if t == null:
			continue
		if t.has_method("fire"):
			t.fire()
		elif t.has_method("start"):
			t.start()
		elif t.has_method("use"):
			t.use()
	done.emit()
	return true


## the same as run(): so another node's Target, a marker's Fires or a signal can set it off
func fire(_a = null, _b = null) -> void:
	if holds():
		run()


func _say(text: String, secs := 3.0) -> void:
	if text == "":
		return
	var st := _story()
	if st != null and st.has_method("say"):
		st.say(text, secs)
	else:
		HSNpcTalkBox.of(get_tree()).caption(text, secs)


func _sound(what: String) -> void:
	if what == "":
		return
	var t := thing_node()
	var at: Vector3 = (t as Node3D).global_position if t is Node3D else Vector3.INF
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null and snd.has_method("play") and not what.begins_with("res://"):
		snd.play(what, at)
		return
	var path := what
	if not path.begins_with("res://"):
		for ext in ["ogg", "wav", "mp3"]:
			if ResourceLoader.exists("res://sfx/%s.%s" % [what, ext]):
				path = "res://sfx/%s.%s" % [what, ext]
	var stream = load(path) if ResourceLoader.exists(path) else null
	if stream is AudioStream:
		var p := AudioStreamPlayer.new()
		p.name = "_LogicSound"
		p.stream = stream
		add_child(p)
		p.finished.connect(p.queue_free)
		p.play()


## What a thing's Logic nodes say about using it: false when one of them says no (it has said why). For anything that
## uses things without the starter's player: `if HSLogic.may_use(thing, self): thing.use(self); HSLogic.was_used(thing, self)`.
static func may_use(target: Node, by: Node = null) -> bool:
	for c in of(target):
		if not c.allows(by):
			return false
	return true


static func was_used(target: Node, by: Node = null) -> void:
	for c in of(target):
		c.used(by)


## the Logic nodes of a thing: its children that are one, and any other whose `thing` it is
static func of(target: Node) -> Array:
	var out := []
	if target == null:
		return out
	for c in target.get_children():
		if c is HSLogic and (c as HSLogic).thing_node() == target:
			out.append(c)
	if target.is_inside_tree() and not Engine.is_editor_hint():
		for l in target.get_tree().get_nodes_in_group("hs_logic"):
			if l is HSLogic and not (l in out) and (l as HSLogic).thing_node() == target:
				out.append(l)
	return out
