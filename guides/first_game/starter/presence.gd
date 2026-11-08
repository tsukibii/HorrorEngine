## The signs that she's near (docs/research/intensity.md §3; Silent Hill's radio, Phasmophobia's lights): put it under
## her, as light_shy.gd is. While she's shown and within `radius` metres:
## - **the lights near her flicker**: every light within the radius on her floor (from her feet to `storey_m` over them)
##   dips now and then, more often the closer she is to you (never more than `max_dips` a second: the flash limit), your
##   flashlight with them; a scare's dimming and her flicker don't fight (lights.gd set_flicker);
## - **static rises** on a radio, the TV or a phone (`static_on`: its own looped static, louder as she comes; empty: none);
## And now and then, as she goes (`false_alarm`, the chance each time), the signs come back once for a few seconds
## without her, so they never quite mean she's there. warn(secs) starts them from a signal before she shows.
extends Node

const Lights := preload("res://starter/lights.gd")

@export var radius := 10.0
@export var storey_m := 2.8                       ## a light from her feet to this far over them is on her floor
@export var lights := true
@export var flashlight := true
@export_range(0.0, 3.0) var max_dips := 2.5       ## dips a second at most, right by her (three flashes a second is the limit)
@export var static_on: Node3D                     ## a radio, the TV, a phone: static rising as she nears
@export var static_sound := "noise_01"
@export var static_db := -8.0
@export_range(0.0, 1.0) var false_alarm := 0.1

var near := 0.0                                   ## the signs' strength now, 0..1 (a check's)
var dips := 0                                     ## lights dipped (a check's)
var _dip_t := 0.0
var _dipping := 0.0
var _warn := 0.0
var _was_near := false
var _static: AudioStreamPlayer3D = null
var _touched: Array = []
var _lights: Array = []
var _lights_t := 0.0
var _torch_dipped := false


func _ready() -> void:
	if static_on != null:
		_static = AudioStreamPlayer3D.new()
		_static.bus = "SFX"
		_static.volume_db = -80.0
		static_on.add_child.call_deferred(_static)


## the signs on for `secs` without her (a moment before she shows, or a false alarm)
func warn(secs := 3.0, _a = null) -> void:
	_warn = maxf(_warn, secs)


func _process(dt: float) -> void:
	var her := get_parent() as Node3D
	var cam := get_viewport().get_camera_3d() if get_viewport() else null
	if her == null or cam == null:
		return
	var k := 0.0
	if her.is_visible_in_tree():
		var d := her.global_position.distance_to(cam.global_position)
		k = clampf(1.0 - d / maxf(radius, 0.1), 0.0, 1.0)
	_warn = maxf(0.0, _warn - dt)
	if _warn > 0.0:
		k = maxf(k, 0.6)
	if _was_near and k <= 0.0 and randf() < false_alarm:
		warn(randf_range(2.0, 4.0))                    # she's gone: the signs come back once without her
	_was_near = k > 0.0 and _warn <= 0.0
	near = k
	var feet := cam.global_position - Vector3(0, 1.6, 0)
	_flicker(dt, k, her.global_position if her.is_visible_in_tree() else feet)   # a warning without her: the lights round you
	_hiss(k)


# the dips: now and then a light near her goes to a fraction for 50 to 150 ms
func _flicker(dt: float, k: float, at: Vector3) -> void:
	_dipping = maxf(0.0, _dipping - dt)
	_dip_t -= dt
	var dip := 1.0
	if k > 0.0 and _dip_t <= 0.0:
		_dip_t = 1.0 / maxf(0.2, max_dips * k) * randf_range(0.6, 1.4)
		_dipping = randf_range(0.05, 0.15)
		dips += 1
	if _dipping > 0.0:
		dip = randf_range(0.08, 0.35)
	var now: Array = []
	if lights and k > 0.0:
		_lights_t -= dt
		if _lights_t <= 0.0:                           # the level's lights, looked up every couple of seconds
			_lights_t = 2.0
			_lights = get_tree().root.find_children("*", "Light3D", true, false).filter(
				func(l): return not (l is DirectionalLight3D) and not l.is_in_group("hs_no_zone"))
		for l in _lights:
			if not is_instance_valid(l):
				continue
			var h: float = l.global_position.y - at.y
			if h < -0.2 or h > storey_m or l.global_position.distance_to(at) > radius:
				continue
			now.append(l)
			Lights.set_flicker(l, dip)
	for l in _touched:                                 # lights she's left: as they were
		if is_instance_valid(l) and not now.has(l):
			Lights.set_flicker(l, 1.0)
	_touched = now
	var pl := get_tree().get_first_node_in_group("hs_player")
	var torch: Node = pl.get_node_or_null("Eye/Flashlight") if pl != null else null
	if torch != null and "flick" in torch:
		if flashlight and k > 0.0:
			torch.flick = dip
			_torch_dipped = true
		elif _torch_dipped:                            # back as it was once she's gone (and left alone after)
			torch.flick = 1.0
			_torch_dipped = false


func _hiss(k: float) -> void:
	if _static == null or not _static.is_inside_tree():
		return
	if _static.stream == null:
		var snd := get_tree().get_first_node_in_group("hs_sound")
		var st: AudioStream = snd.stream_of(static_sound) if snd != null else null
		if st == null:
			return
		st = st.duplicate()
		if "loop" in st:
			st.loop = true
		_static.stream = st
	if k > 0.0 and not _static.playing:
		_static.play()
	_static.volume_db = static_db + linear_to_db(maxf(k * k, 0.0001)) if k > 0.0 else -80.0
	if k <= 0.0 and _static.playing:
		_static.stop()
