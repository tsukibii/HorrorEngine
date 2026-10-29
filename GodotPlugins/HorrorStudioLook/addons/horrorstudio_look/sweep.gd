## A headlight sweep (docs/GODOT_LOOK.md §1d; after Light Kit's Sweep actor): a car passing outside a window at night.
## `HSSweep.make(window_at, outward, along, settings)`: a SpotLight3D (the two headlights as one wide beam) that
## every so often slides along the street outside (`out` metres from the glass, headlight height) from one side to
## the other over `secs`, aimed through the window into the room, so the frame's shadow crosses the ceiling and
## highlights slide over metal and wet floors; off between passes. Settings (the story's `sweep` on a window,
## STORY_FORMAT §2): `every` seconds between passes (40; 0: only when fired), `secs` a pass (3), `out`, `span` metres
## each way (10), `energy` (10), `color`, `aim` metres inside the window the beam points at (1.5). `fire()` starts one now (the story's `sweep` action, a room's windows);
## `passing` while one runs. Drawn from the clock and a seed, so the passes come the same on every run.
class_name HSSweep
extends Node3D

var lamp: SpotLight3D
var window_at: Vector3
var outward: Vector3
var along: Vector3
var every := 40.0
var secs := 3.0
var out := 6.0
var span := 10.0
var energy := 10.0
var aim := 1.5                     # metres inside the window the beam is aimed at
var clock := 0.0
var next_at := 0.0
var started := -1.0
var seed_ := 1
var passes := 0


static func make(window_at_: Vector3, outward_: Vector3, along_: Vector3, s: Dictionary = {}) -> HSSweep:
	var sw := HSSweep.new()
	sw.name = "Sweep"
	sw.window_at = window_at_
	sw.outward = outward_.normalized()
	sw.along = along_.normalized()
	sw.settings(s)
	sw.lamp = SpotLight3D.new()
	sw.lamp.name = "Lamp"
	sw.lamp.light_color = s.get("color", Color(0.95, 0.92, 0.8))
	sw.lamp.light_energy = 0.0
	sw.lamp.spot_range = sw.out + sw.span + 12.0
	sw.lamp.spot_angle = 22.0
	sw.lamp.spot_angle_attenuation = 1.2
	sw.lamp.shadow_enabled = true
	sw.lamp.shadow_blur = 1.5
	sw.lamp.light_size = 0.2
	sw.lamp.light_volumetric_fog_energy = 0.15                            # the haze outside the glass barely glows: at full the window read as a white card, not a beam crossing the room
	sw.lamp.visible = false
	sw.add_child(sw.lamp)
	return sw


## on the export's marker (a Node3D at the window's middle with its `sweep` meta: outward and along as Godot vectors)
static func attach(marker: Node3D, s: Dictionary) -> HSSweep:
	var have = marker.get_node_or_null("Sweep")
	if have != null and have is HSSweep:
		return have
	var o: Array = s.get("outward", [0, 0, 1])
	var al: Array = s.get("along", [1, 0, 0])
	var sw := HSSweep.make(Vector3.ZERO, Vector3(float(o[0]), float(o[1]), float(o[2])), Vector3(float(al[0]), float(al[1]), float(al[2])), s)
	marker.add_child(sw)
	sw.window_at = marker.global_position
	return sw


func settings(s: Dictionary) -> void:
	every = float(s.get("every", 40.0))
	secs = max(0.5, float(s.get("secs", 3.0)))
	out = float(s.get("out", 6.0))
	span = float(s.get("span", 10.0))
	energy = float(s.get("energy", 10.0))
	aim = float(s.get("aim", 1.5))
	seed_ = int(s.get("seed", 1))
	next_at = _gap(0)


func _gap(k: int) -> float:
	if every <= 0.0:
		return INF
	var h: float = float((seed_ * 374761393 + k * 668265263) & 0xffff) / 65536.0
	return every * (0.7 + 0.6 * h)


## a car now
func fire() -> void:
	started = clock


func passing() -> bool:
	return started >= 0.0 and clock - started < secs


func _process(dt: float) -> void:
	clock += dt
	if started < 0.0 and clock >= next_at:
		started = clock
	if started < 0.0:
		return
	var u: float = (clock - started) / secs
	if u >= 1.0:
		started = -1.0
		passes += 1
		next_at = clock + _gap(passes)
		lamp.visible = false
		lamp.light_energy = 0.0
		return
	var x: float = (u * 2.0 - 1.0) * span                                  # along the street, one side to the other
	var at: Vector3 = window_at + outward * out + along * x + Vector3(0.0, -0.9, 0.0)   # headlight height, under the window's middle
	lamp.visible = true
	lamp.top_level = true                                                  # placed in the world, whatever the marker's transform
	lamp.global_position = at
	lamp.look_at(window_at - outward * aim, Vector3.UP)                    # through the glass, into the room
	var ends: float = smoothstep(0.0, 0.15, u) * (1.0 - smoothstep(0.85, 1.0, u))
	lamp.light_energy = energy * ends
