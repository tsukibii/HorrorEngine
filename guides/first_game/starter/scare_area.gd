## A scare (guides/first_game, guides/tutorial_v2): an Area3D the player walks into, or `fire()` from any signal (a key
## picked up, a character flashed twice). The lights of `lights_of` (every light under it: an interior, a room's light
## zone, one lamp) go out, dim, flicker, or go out one by one toward the player, the farthest first; for good, or for
## `for_seconds` and then back as they were. `appear` (hidden until then) is there, for good or for `appear_for` seconds
## (a jump scare), and `hide` gone; the Sound child (an AudioStreamPlayer3D, a sting) plays; the music changes its
## mood. `quiet` hushes the music and the room's tone first (the Sound node), so its last half second is silent and
## the sting lands in it. `tape` breaks the picture up (the scene's tape, the Look plugin's HSTape: nightmare, worn...) for
## `tape_for` seconds and puts it back; `fog` rolls the air's fog to a level (an HSAtmosphere's `fog_to`).
## Once, or every time; only when `needs` holds (as event_area.gd's). Its box: a CollisionShape3D, or `interior` and
## `room` (that room's size).
extends Area3D

signal scared

const Lights := preload("res://starter/lights.gd")

@export var lights_of: Node3D
@export_enum("out", "dim", "flicker", "one by one") var lights_do := "out"
@export var for_seconds := 0.0                  ## 0: for good; else back as they were after this long
@export_range(0.0, 1.0) var dim_to := 0.2       ## dim: how much light is left
@export var gap := 0.4                          ## one by one: seconds between them
@export var appear: Node3D
@export var appear_for := 0.0                   ## 0: it stays; else gone again after this long (a jump scare)
@export var hide: Node3D                        ## hidden when it fires (she was down the corridor: now she's here)
@export var quiet := 0.0                        ## seconds of hush before it (its last half second silent); 0: none
@export_enum("keep", "silence", "calm", "uneasy", "dread", "chase") var music := "keep"   ## the music's mood after (keep: as it is)
@export_enum("keep", "camcorder", "camhybrid", "worn", "nightmare") var tape := "keep"   ## the picture breaks up: the scene's tape at this for `tape_for` seconds, then as it was
@export var tape_for := 1.0
@export_range(-0.01, 1.0, 0.01) var fog := -0.01   ## the air's fog level to roll to (the scene's HSAtmosphere); under 0: as it is
@export var fog_seconds := 4.0
@export var needs := ""
@export var once := true
@export var walk_in := true                     ## off: only fire() starts it (a signal wired to it)
@export var interior: Node3D                    ## the interior (with interior.gd) whose `room` this area fills
@export var room := ""

var fired := false
var busy := false


func _ready() -> void:
	body_entered.connect(_entered)
	if appear != null:
		appear.visible = false
	if interior != null and room != "":
		interior.call_deferred("fit_area", self, room)


func _entered(body: Node3D) -> void:
	if walk_in and (body.is_in_group("hs_player") or body is CharacterBody3D):
		fire()


## the scare (from a signal too: whatever the signal sends is ignored)
func fire(_a = null, _b = null) -> void:
	if (once and fired) or busy:
		return
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null and not st.holds(needs):
		return
	fired = true
	busy = true
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if quiet > 0.0 and snd != null:
		await get_tree().create_timer(snd.hush(quiet)).timeout
	var lamps := Lights.under(lights_of).filter(func(l): return Lights.is_on(l))
	_lights(lamps)
	if hide != null:
		hide.visible = false
	if appear != null:
		appear.visible = true
		if appear_for > 0.0:
			get_tree().create_timer(appear_for).timeout.connect(func(): appear.visible = false)
	var s := get_node_or_null("Sound")
	if s is AudioStreamPlayer3D and snd != null and snd.has_method("shaped"):
		snd.shaped(s, "event")                   # traced through the rooms (a sting off the shelf's stings plays dry)
	elif s != null and s.has_method("play"):
		s.play()
	if tape != "keep":
		_tape()
	if music != "keep" and snd != null:
		snd.music(music)
	if fog >= 0.0:
		var air := get_tree().get_first_node_in_group("hs_atmosphere")
		if air != null and air.has_method("fog_to"):
			air.fog_to(fog, fog_seconds)
	scared.emit()
	busy = false
	if once:
		set_deferred("monitoring", false)


## the scene's tape (an HSTape's layer, or the game's) at `tape` for `tape_for` seconds, then as it was
func _tape() -> void:
	var vhs: Node = null
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		if n.has_method("preset") and n.get("preset_name") != null:
			vhs = n
			break
	if vhs == null:
		return
	var was := [str(vhs.get("preset_name")), float(vhs.get("strength"))]
	vhs.set("strength", 1.0)
	vhs.preset(tape)
	await get_tree().create_timer(tape_for).timeout
	if is_instance_valid(vhs):
		vhs.set("strength", was[1])
		vhs.preset(was[0])


func _lights(lamps: Array) -> void:
	if lamps.is_empty():
		return
	match lights_do:
		"out":
			for l in lamps:
				Lights.set_on(l, false)
			if for_seconds > 0.0:
				await get_tree().create_timer(for_seconds).timeout
				for l in lamps:
					Lights.set_on(l, true)
		"dim":
			var down := create_tween()
			down.tween_method(_level.bind(lamps), 1.0, dim_to, 0.35)
			if for_seconds > 0.0:
				await get_tree().create_timer(for_seconds).timeout
				var up := create_tween()
				up.tween_method(_level.bind(lamps), dim_to, 1.0, 0.8)
		"flicker":
			var secs := for_seconds if for_seconds > 0.0 else 2.0
			var t := 0.0
			while t < secs:
				for l in lamps:
					Lights.set_level(l, 1.0 if randf() < 0.45 else 0.05)
				var step := randf_range(0.04, 0.16)
				await get_tree().create_timer(step).timeout
				t += step
			for l in lamps:
				Lights.set_level(l, 1.0)
		"one by one":
			var eye := get_viewport().get_camera_3d()
			var at: Vector3 = eye.global_position if eye != null else global_position
			lamps.sort_custom(func(a, b): return a.global_position.distance_to(at) > b.global_position.distance_to(at))
			for l in lamps:
				Lights.set_on(l, false)
				await get_tree().create_timer(gap).timeout
			if for_seconds > 0.0:
				await get_tree().create_timer(for_seconds).timeout
				for l in lamps:
					Lights.set_on(l, true)


func _level(k: float, lamps: Array) -> void:
	for l in lamps:
		Lights.set_level(l, k)
