## A chase (docs/research/intensity.md §4: Outlast 2's, Phasmophobia's hunts): put it under the figure who chases (a
## copy of her of its own, or the searcher's: searcher.gd gives chase this way when she sees you in the open, its
## `chase`). start() (from a signal) and, after `start_secs` (a sting, a beat to turn and run), she runs after you at
## `speed` times your run: straight at you while nothing's between, else the way she saw you go (no navigation mesh:
## she goes where you went, through the doors you went through, as far as she saw, and a step on the way you were
## heading when she lost sight of you). A door you shut behind you costs
## her `door_secs` and a bang, then it's open (a locked one holds her). Out of her sight `lose_secs` and she's lost
## you: with a `searcher` she searches the places to hide near where she last saw you, else she's gone. Caught
## (within `catch_m`): a fright in your face (the searcher's, if she has one), then she's gone. Into one of the
## `safe_rooms` (an interior's rooms: the stairwell, where she won't follow) or after `secs_min` to `secs_max`
## seconds she gives up, and goes. The chase mood while it runs (the Sound node's), then the hush and the mood
## before. stop() ends it where it is (so does anything hiding her: a scare's `hide`, the searcher's stop()). While it runs the night's director holds back and the Fear node feels her. `started`, `caught`,
## `escaped` and `lost` to wire anything to; `state` for checks.
extends Node

signal started
signal caught
signal escaped                                    ## into a safe room, or she gave up
signal lost                                       ## out of her sight too long

@export var speed := 0.95                         ## times the player's run speed
@export var secs_min := 20.0                      ## she gives up after this to secs_max seconds
@export var secs_max := 40.0
@export var start_secs := 0.8                     ## the beat before she runs: turn and run
@export var door_secs := 2.0                      ## a door shut in her way holds her this long
@export var lose_secs := 6.0                      ## out of her sight this long and she's lost you
@export var see_m := 14.0
@export var catch_m := 0.8
@export var safe_rooms := PackedStringArray()     ## an interior's rooms she won't follow you into
@export var searcher: Node                        ## searcher.gd: lost, she searches; caught, its fright; over, back to her post
@export var mood := "chase"                       ## the music while it runs ("" leaves it)
@export var start_sound := "sting_short"
@export var door_sound := "slam"                  ## her at a door you shut, off the shelf
@export var start_says := ""

var state := "idle"                               ## idle, starting, chasing, door, done
var seen := false
var last_seen := Vector3.INF
var ran := 0.0                                    ## metres she ran (a check's)
var running_secs := 0.0                           ## seconds she ran (a check's)
var door_waits := 0                               ## doors she was held at (a check's)
var door_secs_held := 0.0                         ## and for how long (a check's)
var how := ""                                     ## how it ended: caught, escaped, lost (a check's)
var _t := 0.0
var _left := 0.0
var _unseen := 0.0
var _trail: Array = []                            # where she saw you go, 0.3 m apart
var _vel := Vector3.ZERO                          # your way when she last saw you
var _door: Node = null
var _mood_was := ""
var _stride := 0.0


func _her() -> Node3D:
	return get_parent() as Node3D


func _player() -> Node3D:
	return get_tree().get_first_node_in_group("hs_player") as Node3D


## after you (from a signal: whatever it sends is ignored)
func start(_a = null, _b = null) -> void:
	if state != "idle" and state != "done":
		return
	var her := _her()
	var pl := _player()
	if her == null or pl == null:
		return
	if searcher != null and searcher.has_method("hold"):
		searcher.hold()
	her.visible = true
	her.set_meta("hs_hidden", false)
	if not her.is_in_group("hs_threat"):
		her.add_to_group("hs_threat")                # (the Fear node feels her near: fear.gd)
	state = "starting"
	how = ""
	_t = start_secs
	_left = randf_range(secs_min, secs_max)
	_unseen = 0.0
	_trail = []
	last_seen = pl.global_position
	ran = 0.0
	running_secs = 0.0
	door_waits = 0
	door_secs_held = 0.0
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null:
		_mood_was = str(snd.get("now_mood")) if snd.get("now_mood") != null else ""
		if mood != "" and snd.has_method("music"):
			snd.music(mood, 0.4)
	_sound(start_sound, her.global_position + Vector3.UP * 1.5, -2.0, "event")
	_dread("raise", 0.3)
	if start_says != "":
		var st := get_tree().get_first_node_in_group("hs_story")
		if st != null and st.has_method("say"):
			st.say(start_says)
	started.emit()


func _process(dt: float) -> void:
	if state == "idle" or state == "done":
		return
	var her := _her()
	var pl := _player()
	if her == null or pl == null:
		return
	if not her.visible or bool(her.get_meta("hs_hidden", false)):
		stop()                                       # something else took her away
		return
	_dread("relax_for", 2.0)                         # nothing else from the night's director while she's after you
	var was_seen := seen
	seen = _sees(her, pl)
	if seen:
		_unseen = 0.0
		last_seen = pl.global_position
		var v = pl.get("velocity")
		_vel = Vector3(v.x, 0.0, v.z) if v is Vector3 else Vector3.ZERO
		if _trail.is_empty() or (_trail[-1] as Vector3).distance_to(last_seen) >= 0.3:
			_trail.append(last_seen)
	else:
		_unseen += dt
		if was_seen and _vel.length() > 0.3:
			_trail.append(last_seen + _vel.normalized() * minf(1.0, _vel.length() * 0.5))   # on the way you were going
	_left -= dt
	if _in_safe(pl) or _left <= 0.0:
		_end("escaped")
		return
	if _unseen >= lose_secs:
		_end("lost")
		return
	match state:
		"starting":
			_face(her, pl.global_position, dt)
			_t -= dt
			if _t <= 0.0:
				state = "chasing"
		"door":
			door_secs_held += dt
			_t -= dt
			if _t <= 0.0:
				if _door != null and is_instance_valid(_door) and (not _door.has_method("lock") or str(_door.lock()) == ""):
					_door.set("open", true)               # (door.gd swings it and plays its sound)
					state = "chasing"
				else:
					_t = door_secs                        # locked: she stays at it, at it again
					_sound(door_sound, (_door as Node3D).global_position + Vector3.UP if _door is Node3D else her.global_position, 0.0)
		"chasing":
			_run(her, pl, dt)
	if state == "chasing" or state == "door":
		var to := pl.global_position - her.global_position
		if Vector2(to.x, to.z).length() <= catch_m and absf(to.y) < 1.2:
			_catch(her, pl)


## over where it is: the music back, nothing handed on (from a signal)
func stop(_a = null, _b = null) -> void:
	if state == "idle" or state == "done":
		return
	_end("stopped")


func _run(her: Node3D, pl: Node3D, dt: float) -> void:
	var goal := Vector3.INF
	if seen and _clear(her.global_position + Vector3.UP, pl.global_position + Vector3.UP, pl):
		goal = pl.global_position
		_trail = [goal]                                # nothing between: straight at you
	elif not _trail.is_empty():
		goal = _trail[0]
	if goal == Vector3.INF:
		_face(her, last_seen, dt)                      # where she lost you: looking round
		return
	var to := goal - her.global_position
	var flat := Vector2(to.x, to.z)
	var step := speed * _run_speed(pl) * dt
	var door := _door_ahead(her, Vector3(to.x, 0.0, to.z).normalized(), 0.8)
	if door != null:
		_door = door
		state = "door"
		_t = door_secs
		door_waits += 1
		_sound(door_sound, (door as Node3D).global_position + Vector3.UP, 0.0)
		return
	running_secs += dt
	if flat.length() <= step:
		ran += flat.length()
		her.global_position = goal
		_trail.pop_front()
		return
	var mv := Vector3(to.x, 0.0, to.z).normalized() * step
	mv.y = to.y * step / flat.length()
	her.global_position += mv
	her.global_rotation.y = lerp_angle(her.global_rotation.y, atan2(to.x, to.z), minf(1.0, dt * 10.0))
	ran += step
	_stride += step
	if _stride >= 1.0:
		_stride = 0.0
		_step(her.global_position)


# over: the music back, and she goes (to the searcher, or gone)
func _end(how_: String) -> void:
	state = "done"
	how = how_
	_trail = []
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null:
		if snd.has_method("hush"):
			snd.hush(1.5)
		if mood != "" and snd.has_method("music"):
			snd.music(_mood_was if _mood_was != "" else "silence", 2.0)
	var her := _her()
	if how_ == "lost":
		lost.emit()
		if searcher != null and searcher.has_method("search_at"):
			searcher.search_at(last_seen)
		elif her != null:
			her.visible = false
	elif how_ == "escaped":
		escaped.emit()
		if searcher != null and searcher.has_method("give_up"):
			searcher.give_up()
		elif her != null:
			her.visible = false


func _catch(her: Node3D, pl: Node3D) -> void:
	_end("caught")
	caught.emit()
	if searcher != null and searcher.has_method("catch"):
		searcher.catch()                             # its fright, then she's gone back to her post
		return
	var eye := pl.get_node_or_null("Eye") as Node3D
	if eye != null:                                  # a fright of its own: in your face, you turned to her
		var from := her.global_position - eye.global_position
		from.y = 0.0
		from = from.normalized() if from.length() > 0.05 else Vector3(0, 0, -1)
		var at := eye.global_position + from * 0.45
		her.global_position = Vector3(at.x, her.global_position.y, at.z)
		her.global_rotation.y = atan2(-from.x, -from.z)
		pl.global_rotation.y = atan2(-from.x, -from.z)
	_sound("sting_big", her.global_position + Vector3.UP * 1.5, 0.0, "event")
	var fear := get_tree().get_first_node_in_group("hs_fear")
	if fear != null and fear.has_method("scare"):
		fear.scare()
	get_tree().create_timer(0.9).timeout.connect(func(): her.visible = false)


# you, within her sight (the chase's: light or dark, she's onto you)
func _sees(her: Node3D, pl: Node3D) -> bool:
	var head := her.global_position + Vector3.UP * 1.5
	var eye := (pl.get_node("Eye") as Node3D).global_position
	return head.distance_to(eye) <= see_m and _clear(head, eye, pl)


func _clear(a: Vector3, b: Vector3, pl: Node3D) -> bool:
	var q := PhysicsRayQueryParameters3D.create(a, b, 1)
	if pl is CollisionObject3D:
		q.exclude = [(pl as CollisionObject3D).get_rid()]
	return _her().get_world_3d().direct_space_state.intersect_ray(q).is_empty()


# a shut door (door.gd) right ahead of her
func _door_ahead(her: Node3D, dir: Vector3, dist: float) -> Node:
	if dir.length() < 0.5:
		return null
	var from := her.global_position + Vector3.UP
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * dist, 1)
	var pl := _player()
	if pl is CollisionObject3D:
		q.exclude = [(pl as CollisionObject3D).get_rid()]
	var hit := her.get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty():
		return null
	var n: Node = hit["collider"]
	while n != null:
		if n.has_method("lock") and "open" in n:
			return null if bool(n.get("open")) else n
		n = n.get_parent()
	return null


# you in one of the safe rooms (an interior's room box)
func _in_safe(pl: Node3D) -> bool:
	if safe_rooms.is_empty():
		return false
	for it in get_tree().get_nodes_in_group("hs_interior"):
		if not it.has_method("room_box"):
			continue
		for room in safe_rooms:
			var b: Dictionary = it.room_box(room)
			if b.is_empty():
				continue
			var lp: Vector3 = (b["xform"] as Transform3D).affine_inverse() * (pl.global_position + Vector3.UP * 0.5)
			var half: Vector3 = (b["size"] as Vector3) * 0.5
			if absf(lp.x) <= half.x and absf(lp.y) <= half.y and absf(lp.z) <= half.z:
				return true
	return false


func _run_speed(pl: Node3D) -> float:
	var r = pl.get("run_speed")
	return float(r) if r != null else 3.2


func _face(her: Node3D, p: Vector3, dt: float) -> void:
	var to := p - her.global_position
	if Vector2(to.x, to.z).length() < 0.05:
		return
	her.global_rotation.y = lerp_angle(her.global_rotation.y, atan2(to.x, to.z), minf(1.0, dt * 6.0))


func _step(at: Vector3) -> void:
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd == null or not snd.has_method("play"):
		return
	var fam := ""
	if snd.has_method("steps_for"):
		fam = str(snd.steps_for(snd.floor_at(at)))
	snd.play(fam, at + Vector3(0, 0.05, 0), 0.0, "sfx")


func _sound(what: String, at: Vector3, db: float, kind := "sfx") -> void:
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if what != "" and snd != null and snd.has_method("play"):
		snd.play(what, at, db, kind)


func _dread(m: String, k: float) -> void:
	var d := get_tree().get_first_node_in_group("hs_dread")
	if d != null and d.has_method(m):
		d.call(m, k)
