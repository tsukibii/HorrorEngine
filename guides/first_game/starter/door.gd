## A door from an interior's export (its doors/door_<id> node, the origin on the hinge), opened and shut by use() (E, in
## player.gd): it swings about its hinge the way the export's metadata says (`opens`), or slides along its width
## (`slide`). interior.gd puts it on every door when the game runs.
extends Node3D

@export var open := false
@export var swing_degrees := 95.0
@export var seconds := 0.8
var _t := 0.0
var _shut := Transform3D()
var _set := false


func _ready() -> void:
	setup()


func setup() -> void:
	if _set:
		return
	_set = true
	_shut = transform
	set_process(true)


func use(_by: Node = null) -> void:
	open = not open


func _process(dt: float) -> void:
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
