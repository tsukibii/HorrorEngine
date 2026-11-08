## The steps behind you (docs/research/intensity.md §1.5; P.T.'s second set of footsteps): while it runs, every step
## you take is answered a moment later from a few metres behind you, on another floor's sound than yours, so it's
## someone else's; stop, and it takes one step too many, then it's quiet. Started from a signal (start(), e.g. a pickup's
## `picked`), or by itself now and then while you're afraid (`chance_per_min` while the Fear node is over `min_fear`),
## never again within `rest` seconds. It plays through the Sound node, so the room is in it.
## Put it anywhere in the main scene: a Node called BehindYou with this script.
extends Node

signal finished

@export var family := "step_wood"                 ## its steps (yours are the floor's: on carpet these are someone else's)
@export var lag := 0.3                            ## seconds after each of yours
@export var behind_m := 3.0                       ## how far behind you
@export var db := -12.0
@export var steps := 14                           ## how many before it gives up by itself
@export var chance_per_min := 0.0                 ## by itself: the chance a minute while you're afraid (0: only start())
@export_range(0.0, 1.0) var min_fear := 0.3
@export var rest := 600.0                         ## seconds before it can come again by itself

var running := false
var heard := 0                                    ## its steps played (a check's)
var extra := false                                ## the step too many, played
var _left := 0
var _mine := 0                                    # your steps since it started (it waits for you to walk)
var _started := 0.0
var _last_mine := 0.0
var _clock := 0.0
var _rest_until := 0.0
var _due: Array = []                              # [time, position]


func _ready() -> void:
	_hook.call_deferred()


func _hook() -> void:
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl != null and pl.has_signal("stepped") and not pl.stepped.is_connected(_on_step):
		pl.stepped.connect(_on_step)


## starts it (any signal's arguments ignored)
func start(_a = null, _b = null) -> void:
	running = true
	extra = false
	_left = steps
	_mine = 0
	_started = _clock
	_last_mine = _clock


func _on_step(at: Vector3, _run: bool) -> void:
	_last_mine = _clock
	if not running:
		return
	_mine += 1
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	var back := pl.global_basis.z if pl != null else Vector3.BACK
	back.y = 0.0
	var side := back.cross(Vector3.UP).normalized() * randf_range(-0.4, 0.4)
	_due.append([_clock + lag * randf_range(0.9, 1.15), at + back.normalized() * behind_m + side])
	_left -= 1


func _process(dt: float) -> void:
	_clock += dt
	for d: Array in _due.duplicate():
		if _clock >= float(d[0]):
			_due.erase(d)
			_play(d[1])
	if not running:
		var fear := get_tree().get_first_node_in_group("hs_fear")
		if chance_per_min > 0.0 and _clock > _rest_until and fear != null and float(fear.level) >= min_fear:
			if randf() < chance_per_min * dt / 60.0:
				start()
		return
	if _mine == 0:                                 # it waits for you to walk (a minute at most)
		if _clock - _started > 60.0:
			running = false
		return
	var stopped := _clock - _last_mine > 1.0
	if (stopped or _left <= 0) and _due.is_empty():
		if not extra:                              # one step too many, then nothing
			extra = true
			var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
			if pl != null:
				var back := pl.global_basis.z
				back.y = 0.0
				_due.append([_clock + 0.6, pl.global_position + back.normalized() * (behind_m - 0.6)])
			return
		running = false
		_rest_until = _clock + rest
		finished.emit()


func _play(at: Vector3) -> void:
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null and snd.has_method("play"):
		snd.play(family, at, db, "sfx")
		heard += 1
