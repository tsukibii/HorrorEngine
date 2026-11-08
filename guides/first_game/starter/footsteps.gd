## When a step sounds (lifted from Woohill's game/audio/footsteps.gd): one every so many metres walked on the ground,
## not on animation frames (Minecraft's way), so nothing a clip does breaks them. The stride grows with speed, so
## running steps come faster but not machine-gun fast. Nothing in the air or standing still; the first step comes soon
## after setting off. player.gd keeps one and asks the Sound node for the floor's step (sound.gd step()).
extends RefCounted

## Metres a step at walking speed (1.6 m/s: a step every 0.5 s).
const WALK_STRIDE := 0.8
## The walking speed the stride is measured from (player.gd's walk_speed).
const WALK_SPEED := 1.6
## Metres more stride for every m/s over walking speed (running at 3.2 m/s: 1.23 m, 0.38 s).
const STRIDE_GROWTH := 0.27
## Slower than this (m/s) is standing still.
const MIN_SPEED := 0.35
## How much of a stride is walked before the first step after setting off.
const FIRST_STEP := 0.6
## A move longer than this in one update is a teleport, not walking (m).
const JUMP_CUT := 3.0

var _acc := 0.0
var _speed := 0.0
var _moving := false


## The speed over the ground now (m/s, eased).
func speed() -> float:
	return _speed


## The stride (m) at a speed (m/s).
static func stride_for(speed: float) -> float:
	return WALK_STRIDE + maxf(0.0, speed - WALK_SPEED) * STRIDE_GROWTH


## One frame: `dist` metres moved across the ground in `dt` seconds, and whether the feet are on it. True when a step
## sounds now.
func update(dist: float, dt: float, on_ground: bool) -> bool:
	if dist > JUMP_CUT or dt <= 0.0:
		return false
	var raw := dist / dt
	_speed = lerpf(_speed, raw, minf(1.0, dt * 12.0))
	if not on_ground or _speed < MIN_SPEED:
		_moving = false
		return false
	var stride := stride_for(_speed)
	if not _moving:
		_moving = true
		_acc = stride * (1.0 - FIRST_STEP)
	_acc += dist
	if _acc >= stride:
		_acc = fmod(_acc, stride)
		return true
	return false


## Landed (a step sounds for it elsewhere): the next comes a whole stride later.
func landed() -> void:
	_acc = 0.0
	_moving = _speed >= MIN_SPEED
