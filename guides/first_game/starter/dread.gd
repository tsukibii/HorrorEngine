## The dread director (docs/research/intensity.md §2: Left 4 Dead's director, Alien: Isolation's menace): the story's
## beats stay where you put them; this fills the gaps between them with small moments (dread_moment.gd), by how intense
## the night is just now. Its intensity rises with every scare (an area's `scared`, +0.35), her being flashed twice
## (+0.3) and its own moments (+0.05 a tier), and falls 0.01 a second. It cycles:
## - **build**: a moment every `gap_min` to `gap_max` seconds (jittered: a steady gap reads as a clock), picked among the
##   ready ones by their weights, never the same one twice running nor the same tier when another will do;
## - **peak**: at `peak` intensity, held `hold` seconds, nothing new;
## - **relax**: `relax_min` to `relax_max` seconds of nothing (and while her menace has sent her away, menace.gd).
## Quiet in the `safe_rooms` (a room of the interior's), under a note's card, after the ending. `pace`: gentle (the
## gaps and the relax half again as long), normal, relentless (two thirds as long). Put it in the main scene: a Node
## called Dread with this script.
extends Node

signal moment(name: String)                       ## a moment came

@export_enum("gentle", "normal", "relentless") var pace := "normal"
@export var gap_min := 25.0
@export var gap_max := 70.0
@export_range(0.0, 1.0) var peak := 0.85
@export var hold := 4.0
@export var relax_min := 30.0
@export var relax_max := 60.0
@export var fall := 0.01                          ## a second
@export var safe_rooms := PackedStringArray()     ## an interior's room names: nothing comes while you're in one

var intensity := 0.0
var phase := "build"
var fired: Array = []                             ## [{name, tier, at, phase}] (a check's)
var _clock := 0.0
var _next := 0.0
var _phase_t := 0.0
var _last: Node = null
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	add_to_group("hs_dread")
	_rng.randomize()
	_next = _gap()
	_hook.call_deferred()


func _hook() -> void:
	for s in get_tree().get_nodes_in_group("hs_scare"):
		if s.has_signal("scared") and not s.scared.is_connected(_on_scare):
			s.scared.connect(_on_scare)
	for t in get_tree().get_nodes_in_group("hs_threat"):
		var shy := t.get_node_or_null("LightShy")
		if shy != null and shy.has_signal("flashed_twice") and not shy.flashed_twice.is_connected(_on_flashed):
			shy.flashed_twice.connect(_on_flashed)


func _on_scare(_a = null) -> void:
	raise(0.35)


func _on_flashed() -> void:
	raise(0.3)


## more intense by `k` (anything can tell it: a moment of your own, a chase)
func raise(k: float) -> void:
	intensity = clampf(intensity + k, 0.0, 1.0)


## nothing for `secs` (her menace sending her away: menace.gd)
func relax_for(secs: float) -> void:
	phase = "relax"
	_phase_t = maxf(_phase_t, secs)


func _scale() -> float:
	return 1.5 if pace == "gentle" else (0.66 if pace == "relentless" else 1.0)


func _gap() -> float:
	return _rng.randf_range(gap_min, gap_max) * _scale()


func _process(dt: float) -> void:
	_clock += dt
	intensity = maxf(0.0, intensity - fall * dt)
	match phase:
		"build":
			if intensity >= peak:
				phase = "peak"
				_phase_t = hold
				return
			_next -= dt
			if _next <= 0.0 and not _quiet():
				if _pick():
					_next = _gap()
				else:
					_next = 2.0                        # nothing ready: look again in a moment
		"peak":
			_phase_t -= dt
			if _phase_t <= 0.0:
				phase = "relax"
				_phase_t = _rng.randf_range(relax_min, relax_max) * _scale()
		"relax":
			_phase_t -= dt
			if _phase_t <= 0.0:
				phase = "build"
				_next = _gap()


func _quiet() -> bool:
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null and ((st.has_method("card_up") and st.card_up()) or bool(st.get("over"))):
		return true
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	if pl != null and not safe_rooms.is_empty():
		for it in get_tree().get_nodes_in_group("hs_interior"):
			for room in safe_rooms:
				var b: Dictionary = it.room_box(room) if it.has_method("room_box") else {}
				if b.is_empty():
					continue
				var lp: Vector3 = (b["xform"] as Transform3D).affine_inverse() * (pl.global_position + Vector3.UP * 0.5)
				var half: Vector3 = (b["size"] as Vector3) * 0.5
				if absf(lp.x) <= half.x and absf(lp.y) <= half.y and absf(lp.z) <= half.z:
					return true
	return false


func _pick() -> bool:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return false
	var ready: Array = get_tree().get_nodes_in_group("hs_dread_moment").filter(func(m): return m != _last and m.ready_now(_clock, cam))
	if ready.is_empty():
		return false
	var last_tier := int(_last.tier) if _last != null and is_instance_valid(_last) else -1
	var other := ready.filter(func(m): return int(m.tier) != last_tier)
	if not other.is_empty():
		ready = other                                  # not the same tier twice running when another will do
	var w := PackedFloat32Array()
	for m in ready:
		w.append(maxf(0.01, float(m.weight)))
	var m: Node = ready[_rng.rand_weighted(w)]
	m.last_at = _clock
	m.fire()
	_last = m
	raise(0.05 * float(m.tier))
	fired.append({"name": str(m.name), "tier": int(m.tier), "at": snappedf(_clock, 0.1), "phase": phase})
	moment.emit(str(m.name))
	return true


func report() -> Dictionary:
	return {"phase": phase, "intensity": snappedf(intensity, 0.01), "moments": fired.size(), "fired": fired}
