## Something wrong with her (docs/research/intensity.md §5.6): a person, with one thing wrong. Put it under her, beside
## her other nodes, and switch on what's wrong; one thing a face (pile them up and she reads as a monster, not a person).
## - `stare`, the dead stare: her blink off (a Character Studio export's HSBlink idle; people blink about 17 times a
##   minute, so a face that never does is a face that isn't alive);
## - `smile`, the wrong smile: her mouth's corners pulled (MHR's lipCornerPuller, AU12) and her cheeks held still
##   (cheekRaiser, AU6, at 0): a smile with no eyes in it; 0 none;
## - `tilt_deg`, her head bent to the side past where a neck goes (about 42°): a Studio export's head bone, or a
##   stand-in's head and scalp turned about her neck (long hair hangs where it is);
## - `mimic`: she steps when you step and stops when you stop, a step of hers toward you for each of yours (never nearer
##   than `stop_m`, never while your light's on her).
extends Node

@export var stare := false
@export_range(0.0, 1.0) var smile := 0.0
@export_range(-80.0, 80.0) var tilt_deg := 0.0
@export var neck_y := 1.38                        ## a stand-in's neck: where its head turns about (m over its feet)
@export var mimic := false
@export var step_m := 0.4                         ## her step (mimic)
@export var stop_m := 2.5                         ## mimic: never nearer than this

var steps := 0                                    ## her steps so far (a check's)
var tilted: Array = []                            ## what was turned for the tilt (a check's)
var _rest: Dictionary = {}
var _going := 0.0
var _from := Vector3.ZERO
var _to := Vector3.ZERO


func _ready() -> void:
	process_priority = 100                         # after her animations: the smile and the tilt over them
	_hook.call_deferred()


func _hook() -> void:
	var her := get_parent() as Node3D
	if her == null:
		return
	if stare:
		for n in her.find_children("*", "", true, false):   # her blinker (HSBlink: find_children knows no script's class)
			if n.get("idle") != null and n.has_method("blink_now"):
				n.idle = false
	var pl := get_tree().get_first_node_in_group("hs_player")
	if mimic and pl != null and pl.has_signal("stepped") and not pl.stepped.is_connected(_on_step):
		pl.stepped.connect(_on_step)
	_tilt()


## the head bent: the skeleton's head bone if she has one, else the stand-in's head parts about her neck
func _tilt() -> void:
	var her := get_parent() as Node3D
	tilted = []
	if absf(tilt_deg) < 0.01:
		return
	var turn := Basis(Vector3(0, 0, 1), deg_to_rad(tilt_deg))   # about her front (+Z): to her side
	for sk in her.find_children("*", "Skeleton3D", true, false):
		var bi: int = sk.find_bone("head")
		if bi < 0:
			for i in sk.get_bone_count():
				if "head" in sk.get_bone_name(i).to_lower():
					bi = i
					break
		if bi >= 0:
			var rest: Transform3D = sk.get_bone_global_rest(bi)
			sk.set_bone_global_pose(bi, Transform3D(turn * rest.basis, rest.origin))
			tilted.append(sk.get_bone_name(bi))
	if not tilted.is_empty():
		return
	var pivot := Transform3D(Basis(), Vector3(0, neck_y, 0))
	for n in her.get_children():
		if n is Node3D and (n.name.to_lower().contains("head") or n.name.to_lower().contains("scalp")):
			if not _rest.has(n):
				_rest[n] = (n as Node3D).transform
			(n as Node3D).transform = pivot * Transform3D(turn, Vector3.ZERO) * pivot.affine_inverse() * (_rest[n] as Transform3D)
			tilted.append(str(n.name))


func _on_step(_at: Vector3, _run: bool) -> void:
	var her := get_parent() as Node3D
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	if her == null or pl == null or not her.is_visible_in_tree() or _going > 0.0:
		return
	var shy := her.get_node_or_null("LightShy")
	if shy != null and float(shy.get("lit_now")) >= float(shy.get("bright")):
		return                                     # the light's on her: she won't
	var to := pl.global_position - her.global_position
	to.y = 0.0
	if to.length() <= stop_m + step_m * 0.5:
		return
	_from = her.global_position
	_to = her.global_position + to.normalized() * minf(step_m, to.length() - stop_m)
	her.rotation.y = atan2(to.x, to.z)             # her front (+Z) to you
	_going = 0.25
	steps += 1


func _process(dt: float) -> void:
	var her := get_parent() as Node3D
	if her == null:
		return
	if _going > 0.0:                               # the step itself, a quarter of a second
		_going = maxf(0.0, _going - dt)
		var k := 1.0 - _going / 0.25
		her.global_position = _from.lerp(_to, k * k * (3.0 - 2.0 * k))
	if smile > 0.0:
		for mi in her.find_children("*", "MeshInstance3D", true, false):
			var m := mi as MeshInstance3D
			if m.mesh == null or m.get_blend_shape_count() == 0:
				continue
			for nm in ["lipCornerPuller_L", "lipCornerPuller_R"]:
				var i := m.find_blend_shape_by_name(nm)
				if i >= 0:
					m.set_blend_shape_value(i, smile)
			for nm in ["cheekRaiser_L", "cheekRaiser_R"]:
				var i := m.find_blend_shape_by_name(nm)
				if i >= 0:
					m.set_blend_shape_value(i, 0.0)
