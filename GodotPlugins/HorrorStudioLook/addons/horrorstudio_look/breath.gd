## Breath in the cold (docs/research/intensity.md §5.5; docs/GODOT_LOOK.md §5l): breath shows when the 34 °C breath,
## saturated, mixes with air cold enough (below about 7 °C, warmer in damp air). A breath out every `every` seconds,
## jittered a quarter either way: a few puffs from the mouth, carried out about a metre and slowed by the air, growing
## and thinning over `life` seconds, lit only by the lights that reach them (breath.gdshader: a
## dark room hides it, a flashlight's beam shows it where the breath crosses it). `HSBreath.make(mouth, settings)`: the
## puffs come from `mouth` (a Node3D: the player's eye, a character's head) at `offset` in its own space (an eye's: 10
## cm under it, 15 cm ahead), and stay in the air where they were breathed (top level: you walk into your last breath).
## `on` breathing or not (a cold area turns it on); `strength` how white a puff is; `exhale()` one now. Faint near the
## eye: it's for the cold spot, not weather.
@tool
class_name HSBreath
extends Node3D

signal breathed                                   ## a breath out (a check's)

const PUFFS := 4                                  # puffs a breath, 60 ms apart
const SLOTS := 12                                 # three breaths' worth in the air at once

var mouth: Node3D = null
var offset := Vector3(0.0, -0.1, -0.15)
var on := true
var every := 4.0                                  # seconds between breaths
var life := 2.0                                   # seconds a puff lasts
var strength := 0.6
var speed := 1.4                                  # m/s out of the mouth, slowed by the air: about a metre in all, through
var drag := 1.2                                   # a flashlight's beam (its cone, from the hand, takes the breath in from 60 cm on)
var size := Vector2(0.03, 0.32)                   # a puff's width, born and gone
var count := 0                                    # breaths out so far
var clock := 0.0
var next_at := 0.0
var mm: MultiMesh
var mi: MultiMeshInstance3D
var _puffs: Array = []                            # {slot, t0, p, v, seed, spin}
var _queue: Array = []                            # puffs of the breath now coming, their birth times
var _slot := 0


static func make(at: Node3D, s: Dictionary = {}) -> HSBreath:
	var b := HSBreath.new()
	b.name = "Breath"
	b.mouth = at
	b.settings(s)
	return b


func settings(s: Dictionary) -> void:
	offset = s.get("offset", offset)
	on = bool(s.get("on", on))
	every = maxf(0.5, float(s.get("every", every)))
	life = maxf(0.3, float(s.get("life", life)))
	strength = clampf(float(s.get("strength", strength)), 0.0, 1.0)
	speed = float(s.get("speed", speed))


func _ready() -> void:
	mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true                       # x the puff's age, y its seed, z its spin (breath.gdshader)
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	mm.mesh = q
	mm.instance_count = SLOTS
	for i in SLOTS:
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ZERO), Vector3(0, -99, 0)))
	mi = MultiMeshInstance3D.new()
	mi.name = "Puffs"
	mi.multimesh = mm
	mi.top_level = true                             # in the world: the breath stays where it was breathed
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var m := ShaderMaterial.new()
	m.shader = load("res://addons/horrorstudio_look/breath.gdshader")
	mi.material_override = m
	add_child(mi)                                   # no owner: never saved
	next_at = clock + randf_range(0.2, 0.8)


## a breath out now (whether `on` or not)
func exhale() -> void:
	count += 1
	for k in PUFFS:
		_queue.append(clock + 0.06 * k)
	breathed.emit()


## where the breath comes out now, and the way it goes
func _out() -> Transform3D:
	var m: Node3D = mouth if mouth != null else self
	return m.global_transform.translated_local(offset)


func _process(dt: float) -> void:
	clock += dt
	if Engine.is_editor_hint() and not bool(get_meta("preview", false)):
		return
	if on and clock >= next_at:
		exhale()
		next_at = clock + every * randf_range(0.75, 1.25)
	while not _queue.is_empty() and clock >= float(_queue[0]):
		_queue.pop_front()
		var x := _out()
		var fwd := -x.basis.z.normalized()
		var side := x.basis.x.normalized()
		var up := x.basis.y.normalized()
		var v := fwd * speed * randf_range(0.75, 1.2) - up * randf_range(0.02, 0.12) + side * randf_range(-0.15, 0.15)   # out and a little down (as breath leaves the mouth), spreading: into the beam of a flashlight held at the chest
		var p := {"slot": _slot, "t0": clock, "p": x.origin + side * randf_range(-0.01, 0.01), "v": v, "seed": randf(), "spin": randf_range(-1.2, 1.2)}
		_slot = (_slot + 1) % SLOTS
		_puffs = _puffs.filter(func(o): return int(o["slot"]) != int(p["slot"]))
		_puffs.append(p)
	var live: Array = []
	for o in _puffs:
		var age := clock - float(o["t0"])
		var i: int = o["slot"]
		if age > life:
			mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ZERO), Vector3(0, -99, 0)))
			continue
		live.append(o)
		var u := age / life
		var travelled := (1.0 - exp(-drag * age)) / drag    # out fast, slowed by the air (into a flashlight's beam ahead)
		var pos: Vector3 = o["p"] + (o["v"] as Vector3) * travelled + Vector3.UP * 0.05 * age * age   # the warm air rising as it slows
		var w := lerpf(size.x, size.y, sqrt(u))
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ONE * w), pos))
		mm.set_instance_color(i, Color(1, 1, 1, strength * 0.5 * (1.0 - u * u) * minf(1.0, u * 8.0)))
		mm.set_instance_custom_data(i, Color(u, float(o["seed"]), float(o["spin"]), 0.0))
	_puffs = live
	mi.visible = not _puffs.is_empty()


## puffs in the air now (a check's)
func puffs() -> int:
	return _puffs.size()
