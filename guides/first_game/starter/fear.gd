## Your body under fear (docs/research/intensity.md §1.6): one number, `level`, 0 calm to 1 terrified, and what your
## body does with it. It rises as a threat comes near (anything in the group hs_threat: light_shy.gd puts her there),
## more when you can see her, and jumps with every scare (each scare_area.gd's `scared`, or scare() from a signal); it
## falls back slowly. What it drives, each with its own switch (players with anxiety or misophonia turn heartbeats off;
## the research says every body effect wants one):
## - **a heartbeat** (the shelf's heart_beat, on the Body bus: never muffled or echoed) from 60 to 140 a minute, a
##   little uneven, heard from a quarter of the way up;
## - **breathing** (the shelf's breaths) quicker and heavier as it climbs; held while hiding (hold_breath);
## - **the world dulled**: the World bus's highs and level going down (sound dimming, which most people in danger
##   report), your heart and breath left as they are;
## - **a vignette** closing in (the scene's grade, HSPost);
## - **the flashlight's beam shaking** in your hand, 8 to 10 times a second (the light only, never the view: shaking
##   the camera makes people sick).
## And ring(secs): the world muffled after a bang and back over four seconds (no ringing tone: tinnitus sufferers).
## Put it in the main scene: a Node called Fear with this script.
extends Node

@export var heartbeat := true
@export var breathing := true
@export var dull := true                          ## the world's sound dulled as fear rises
@export var vignette := true
@export var tremor := true                        ## the beam shaking in your hand
@export_range(0.0, 1.0) var calm := 0.0           ## where it settles when nothing's near
@export var fall := 0.025                         ## a second, back toward calm
@export var rise := 0.6                           ## a second, toward what a threat near you makes it
@export var near_m := 8.0                         ## a threat closer than this raises it (more the closer, more when seen)
@export var scare_jump := 0.35                    ## how much a scare adds at once
@export var body_db := -8.0                       ## the heartbeat's and the breath's level at their loudest

var level := 0.0
var beats := 0                                    ## heartbeats played (a check's)
var breaths := 0
var holding := false                              ## holding your breath (hiding)
var _beat_t := 0.0
var _breath_t := 2.0
var _breath_k := 0
var _ring := 0.0                                  # seconds of ringing left
var _lp: AudioEffectLowPassFilter = null
var _world := -1
var _post = null
var _vig0 := -1.0
var _p: AudioStreamPlayer
var _q: AudioStreamPlayer


func _ready() -> void:
	add_to_group("hs_fear")
	_p = AudioStreamPlayer.new()
	_q = AudioStreamPlayer.new()
	for p in [_p, _q]:
		p.bus = "Body" if AudioServer.get_bus_index("Body") >= 0 else "Master"
		add_child(p)
	_hook.call_deferred()


# every scare in the scene makes you jump; the World bus's low-pass; the grade
func _hook() -> void:
	for a in get_tree().get_nodes_in_group("hs_scare"):
		if a.has_signal("scared") and not a.scared.is_connected(_on_scared):
			a.scared.connect(_on_scared)
	_world = AudioServer.get_bus_index("World")
	if _world >= 0:
		for i in AudioServer.get_bus_effect_count(_world):
			if AudioServer.get_bus_effect(_world, i) is AudioEffectLowPassFilter:
				_lp = AudioServer.get_bus_effect(_world, i)
		if _lp == null:
			_lp = AudioEffectLowPassFilter.new()
			_lp.cutoff_hz = 20000.0
			AudioServer.lock()
			AudioServer.add_bus_effect(_world, _lp)
			AudioServer.unlock()
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		if n.get("mat") is ShaderMaterial and n.has_method("apply") and n.get("preset_name") != null and n.has_method("set_grain_cap"):
			_post = n


func _on_scared() -> void:
	scare()


## a fright: up at once
func scare(amount := -1.0) -> void:
	level = clampf(level + (scare_jump if amount < 0.0 else amount), 0.0, 1.0)


## the world muffled after a bang, back over four seconds
func ring(secs := 4.0) -> void:
	_ring = maxf(_ring, secs)


## holding your breath (hiding): the breathing stops while it's held
func hold_breath(on: bool) -> void:
	holding = on


## how afraid a threat near you makes you, 0..1 (more the closer, more when you can see her)
func threat() -> float:
	var cam := get_viewport().get_camera_3d() if get_viewport() else null
	if cam == null:
		return 0.0
	var best := 0.0
	for t in get_tree().get_nodes_in_group("hs_threat"):
		if not (t is Node3D) or not t.is_visible_in_tree():
			continue
		var head: Vector3 = (t as Node3D).global_position + Vector3(0, 1.4, 0)
		var d := cam.global_position.distance_to(head)
		if d >= near_m:
			continue
		var k := 1.0 - d / near_m
		var seen := cam.is_position_in_frustum(head) and _clear(cam.global_position, head, t)
		best = maxf(best, k * (1.0 if seen else 0.6))
	return best


func _clear(a: Vector3, b: Vector3, t: Node) -> bool:
	var q := PhysicsRayQueryParameters3D.create(a, b)
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [pl.get_rid()]
	var hit := get_viewport().world_3d.direct_space_state.intersect_ray(q)
	return hit.is_empty() or (hit.get("collider") is Node and (t == hit.collider or t.is_ancestor_of(hit.collider)))


func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	var want := maxf(calm, threat())
	level = move_toward(level, want, (rise if want > level else fall) * dt)
	_beat(dt)
	_breathe(dt)
	_ring = maxf(0.0, _ring - dt)
	var k := smoothstep(0.4, 1.0, level) if dull else 0.0
	if _lp != null:
		var hz := lerpf(20000.0, 1500.0, k)
		if _ring > 0.0:
			hz = minf(hz, lerpf(600.0, 20000.0, 1.0 - _ring / 4.0))
		_lp.cutoff_hz = hz
	if _world >= 0:
		AudioServer.set_bus_volume_db(_world, -4.0 * k)
	if _post != null and is_instance_valid(_post) and _post.mat != null:
		if level < 0.02 or _vig0 < 0.0:
			_vig0 = float(_post.mat.get_shader_parameter("vignette")) if _post.mat.get_shader_parameter("vignette") != null else 0.3
		_post.mat.set_shader_parameter("vignette", _vig0 + (0.35 * smoothstep(0.3, 1.0, level) if vignette else 0.0))
	var pl := get_tree().get_first_node_in_group("hs_player")
	var torch: Node = pl.get_node_or_null("Eye/Flashlight") if pl != null else null
	if torch != null and "tremor" in torch:
		torch.tremor = (0.45 * smoothstep(0.3, 1.0, level)) if tremor else 0.0


func _beat(dt: float) -> void:
	_beat_t -= dt
	if _beat_t > 0.0:
		return
	var bpm := lerpf(60.0, 140.0, level)
	_beat_t = 60.0 / bpm * randf_range(0.96, 1.04)
	if not heartbeat or level < 0.25:
		return
	var s: Node = get_tree().get_first_node_in_group("hs_sound")
	var st: AudioStream = s.stream_of("heart_beat") if s != null else null
	if st == null:
		return
	_p.stream = st
	_p.volume_db = body_db + lerpf(-18.0, 0.0, smoothstep(0.25, 1.0, level))
	_p.play()
	beats += 1


func _breathe(dt: float) -> void:
	_breath_t -= dt
	if _breath_t > 0.0:
		return
	_breath_t = lerpf(3.6, 1.2, level) * randf_range(0.9, 1.1)
	if not breathing or holding or level < 0.45:
		return
	var s: Node = get_tree().get_first_node_in_group("hs_sound")
	if s == null:
		return
	_breath_k += 1
	var st: AudioStream = s.stream_of("breath_02" if level > 0.75 or _breath_k % 2 == 0 else "breath")
	if st == null:
		return
	_q.stream = st
	_q.volume_db = body_db - 6.0 + lerpf(-12.0, 0.0, smoothstep(0.45, 1.0, level))
	_q.play()
	breaths += 1


## what it's doing now, for a check
func state() -> Dictionary:
	return {"level": snappedf(level, 0.001), "beats": beats, "breaths": breaths, "cutoff": _lp.cutoff_hz if _lp != null else 0.0,
		"vignette": float(_post.mat.get_shader_parameter("vignette")) if _post != null and _post.mat != null else -1.0}
