## The light that's turned on her flickers (DECISIONS 2026-11-12, after the seats: "an npc, if you flash a light it has
## a boolean that if a light faces it the light flickers (including flashlights) but not counting atmospheric
## lighting like moonlight"). Put it under her. While `enabled` and she's shown, every lamp whose light reaches her
## (a ceiling tube she stands under, a desk lamp across the room, your flashlight when its beam is on her) falters,
## and is itself again the moment it's off her. The moon and the sun never do (a DirectionalLight3D), nor a light in
## the group hs_ambient, nor one in `ignore`.
##   mode   flicker: it dips and stutters, at most `max_dips` a second (three flashes a second is the limit)
##          dim:     it sinks to `dim_to` while it's on her, and comes back
##          die:     after `die_after` seconds on her it goes out, and stays out `dead_secs` after it's off her
## presence.gd flickers the lights NEAR her, whether they're on her or not; this one only the light that's ON her:
## with both under her, turn the other's Flashlight off, or they both pull at your beam. `lit_by` is what's on her
## now; `lit(light)` and `unlit(light)` say when one comes on her and leaves.
extends Node

const Lights := preload("res://starter/lights.gd")

signal lit(light: Light3D)
signal unlit(light: Light3D)

@export var enabled := true                         ## the boolean: the light on her flickers
@export_enum("flicker", "dim", "die") var mode := "flicker"
@export var lamps := true                           ## the room's lamps
@export var flashlight := true                      ## and your flashlight
@export_range(0.2, 3.0) var max_dips := 2.5         ## flicker: dips a second at most
@export_range(0.0, 1.0) var dim_to := 0.12          ## dim: what it sinks to
@export var die_after := 1.5                        ## die: seconds on her before it goes out
@export var dead_secs := 4.0                        ## die: how long it stays out once it's off her
@export var ignore: Array[NodePath] = []            ## lights that never do
@export var head_m := 1.6                           ## her height: the light is on her when it reaches her head or her middle
@export var needs := ""                             ## the Story's words: only while they hold

var lit_by: Array = []                              ## the lights on her now (a check's, and yours)
var dips := 0                                       ## dips so far (a check's)
var _lights: Array = []
var _lights_t := 0.0
var _look_t := 0.0
var _dip_t := 0.0
var _dipping := 0.0
var _on_secs := {}                                  # a light -> seconds it's been on her (die, dim)
var _dead := {}                                     # a light -> seconds left out
var _touched := {}                                  # every light this has its hand on


func _her() -> Node3D:
	return get_parent() as Node3D


func _torch() -> Light3D:
	var pl := get_tree().get_first_node_in_group("hs_player")
	return pl.get_node_or_null("Eye/Flashlight") as Light3D if pl != null else null


func _clear(a: Vector3, b: Vector3) -> bool:
	var her := _her()
	var q := PhysicsRayQueryParameters3D.create(a, b, 1)
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [(pl as CollisionObject3D).get_rid()]
	var hit := her.get_world_3d().direct_space_state.intersect_ray(q)
	return hit.is_empty() or (hit["position"] as Vector3).distance_to(b) < 0.35


## Whether a light's light reaches her: in its reach, in its cone (a spot's), nothing solid between. Your flashlight
## by its own beam_on() (its batteries, its cookie).
func reaches(l: Light3D) -> bool:
	var her := _her()
	if l == null or her == null or not is_instance_valid(l) or l is DirectionalLight3D:
		return false
	if not l.is_visible_in_tree() and not _touched.has(l):
		return false
	if not Lights.is_on(l) and not _dead.has(l):
		return false
	for h in [head_m, head_m * 0.6]:
		var p: Vector3 = her.global_position + Vector3.UP * h
		if l.has_method("beam_on"):
			if (float(l.get("b")) > 0.0 or _dead.has(l)) and _in_cone(l, p) and _clear(l.global_position, p):
				return true
			continue
		var d := l.global_position.distance_to(p)
		if l is OmniLight3D:
			if d <= (l as OmniLight3D).omni_range and _clear(l.global_position, p):
				return true
		elif l is SpotLight3D:
			if d <= (l as SpotLight3D).spot_range and _in_cone(l, p) and _clear(l.global_position, p):
				return true
	return false


func _in_cone(l: Light3D, p: Vector3) -> bool:
	var s := l as SpotLight3D
	if s == null:
		return true
	var d := p - s.global_position
	if d.length() < 0.01 or d.length() > s.spot_range:
		return false
	return rad_to_deg((-s.global_basis.z).angle_to(d)) <= s.spot_angle


func _put(l: Light3D, k: float) -> void:
	if not is_instance_valid(l):
		return
	_touched[l] = true
	if "flick" in l:                                # the starter's flashlight
		l.flick = k
	else:
		Lights.set_flicker(l, k)


func _process(dt: float) -> void:
	var her := _her()
	if her == null:
		return
	var st := get_tree().get_first_node_in_group("hs_story")
	var on: bool = enabled and her.is_visible_in_tree() and (needs == "" or (st != null and st.has_method("holds") and st.holds(needs)))
	# what's on her now (looked up a few times a second: rays)
	_look_t -= dt
	if _look_t <= 0.0:
		_look_t = 0.08
		var now: Array = []
		if on:
			_lights_t -= 0.08
			if _lights_t <= 0.0:
				_lights_t = 2.0
				var skip := ignore.map(func(p): return get_node_or_null(p))
				_lights = get_tree().root.find_children("*", "Light3D", true, false).filter(
					func(l): return not (l is DirectionalLight3D) and not l.is_in_group("hs_ambient") and not skip.has(l))
			var torch := _torch()
			for l in _lights:
				if not is_instance_valid(l):
					continue
				if l == torch:
					if not flashlight:
						continue
				elif not lamps:
					continue
				if reaches(l):
					now.append(l)
		for l in now:
			if not lit_by.has(l):
				_on_secs[l] = 0.0
				lit.emit(l)
		for l in lit_by:
			if not now.has(l):
				_on_secs.erase(l)
				if is_instance_valid(l):
					if mode != "die" or not _dead.has(l):
						_put(l, 1.0)
					unlit.emit(l)
		lit_by = now
	# the dips' clock: one for every light on her, so they stutter together
	_dipping = maxf(0.0, _dipping - dt)
	_dip_t -= dt
	if not lit_by.is_empty() and mode == "flicker" and _dip_t <= 0.0:
		_dip_t = 1.0 / maxf(0.2, max_dips) * randf_range(0.8, 1.6)
		_dipping = randf_range(0.06, 0.18)
		dips += 1
	for l in lit_by:
		if not is_instance_valid(l):
			continue
		_on_secs[l] = float(_on_secs.get(l, 0.0)) + dt
		match mode:
			"dim":
				_put(l, lerpf(1.0, dim_to, clampf(float(_on_secs[l]) / 0.8, 0.0, 1.0)))
			"die":
				if float(_on_secs[l]) >= die_after:
					_dead[l] = dead_secs
					_put(l, 0.0)
				else:                               # failing first: steadier dips as it goes
					_put(l, 1.0 if _dipping <= 0.0 else 0.3)
					if _dip_t <= 0.0:
						_dip_t = 0.45
						_dipping = 0.12
						dips += 1
			_:
				_put(l, randf_range(0.05, 0.35) if _dipping > 0.0 else 1.0)
	# the dead ones: out until they've been off her long enough
	for l in _dead.keys():
		if not is_instance_valid(l):
			_dead.erase(l)
			continue
		if lit_by.has(l):
			continue
		_dead[l] = float(_dead[l]) - dt
		if float(_dead[l]) <= 0.0:
			_dead.erase(l)
			_put(l, 1.0)


func _exit_tree() -> void:
	for l in _touched:
		if is_instance_valid(l):
			if "flick" in l:
				l.flick = 1.0
			else:
				Lights.set_flicker(l, 1.0)


## What it's doing, a check's.
func report() -> Dictionary:
	return {"lit_by": lit_by.map(func(l): return str(l.name)), "dips": dips, "dead": _dead.size()}
