## A door from an interior's export (its doors/door_<id> node, the origin on the hinge), opened and shut by use() (E, in
## player.gd): it swings about its hinge the way the export's metadata says (`opens`), or slides along its width
## (`slide`). interior.gd puts it on every door when the game runs; put it on one yourself (Editable Children) to set
## its words or wire its signals. Locked: what the scene builder locked it with comes in the export's metadata
## (`locked_by`: an item's name, or flag:<name>), or set `locked_by` here: it opens once the player carries that item
## (the Story's pocket: pickup.gd) or the fact is set; flag:never, never.
extends Node3D

signal opened
signal closed
signal rattled                                  ## tried while it's locked

@export var open := false
@export var swing_degrees := 95.0
@export var seconds := 0.8
@export var locked_by := ""                     ## empty: the export's own lock, if it has one
@export var locked_says := "Locked."
@export var never_says := "It won't open."
@export var unlocked_says := "Unlocked."
@export var tick := ""                          ## a task it ticks off the first time it opens
var unlocked := false
var _t := 0.0
var _shut := Transform3D()
var _set := false
var _was_open := false


func _ready() -> void:
	setup()


func setup() -> void:
	if _set:
		return
	_set = true
	_shut = transform
	_was_open = open
	set_process(true)


## what opens it: its own `locked_by`, else the export's (the scene builder's lock)
func lock() -> String:
	if unlocked:
		return ""
	if locked_by != "":
		return locked_by
	var m: Dictionary = get_meta("extras", {}) if has_meta("extras") else {}
	return str(m.get("locked_by", ""))


func use(_by: Node = null) -> void:
	var lk := lock()
	if lk != "" and not open:
		var st := get_tree().get_first_node_in_group("hs_story")
		var can := false
		if st != null:
			can = (lk.substr(5) != "never" and st.is_set(lk.substr(5))) if lk.begins_with("flag:") else st.has(lk)
		if not can:
			if st != null:
				st.say(never_says if lk == "flag:never" else locked_says)
			_play("Rattle")
			rattled.emit()
			return
		unlocked = true
		if st != null:
			st.say(unlocked_says)
	open = not open


func _play(child: String) -> void:
	var s := get_node_or_null(child)
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if s is AudioStreamPlayer3D and snd != null and snd.has_method("shaped"):
		snd.shaped(s)                            # traced through the rooms (sound.gd): muffled, its reverb, its echo
	elif s != null and s.has_method("play"):
		s.play()


func _process(dt: float) -> void:
	if open != _was_open:
		_was_open = open
		_play("Open" if open else "Close")
		if open:
			opened.emit()
			if tick != "":
				var st := get_tree().get_first_node_in_group("hs_story")
				if st != null:
					st.tick(tick)
		else:
			closed.emit()
	_t = move_toward(_t, 1.0 if open else 0.0, dt / max(0.05, seconds))
	var m: Dictionary = get_meta("extras", {}) if has_meta("extras") else {}
	var k := smoothstep(0.0, 1.0, _t)
	if m.get("slide", false):
		transform = _shut * Transform3D(Basis(), Vector3(-k * float(m.get("width", 0.8)) * 0.95, 0, 0))
	else:
		var s := float(m.get("opens", -1.0))
		if s == 0.0:
			s = -1.0
		transform = _shut * Transform3D(Basis(Vector3.UP, s * k * deg_to_rad(swing_degrees)), Vector3.ZERO)
