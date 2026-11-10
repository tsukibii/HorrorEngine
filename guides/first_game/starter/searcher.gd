## Hunted (docs/research/intensity.md §4: Alien: Isolation, Outlast, Resident Evil 2's Mr. X): put it under the figure
## who hunts (a copy of her of its own, without her other parts: it walks her), placed at her post, where she goes back
## to (tutorial v2: 308's door). Once armed (arm(), from a signal) she's shown where `replaces`, her other self, stands
## just then, and that one's hidden for good; then she listens. A noise you make (noise.gd: your steps, louder running;
## a door; a gasp when you can't hold your breath any longer) within `hear_m` times its loudness, and she stops and
## listens `listen_min` to `listen_max` seconds, turned toward it (`heard_says` the first time). Then she comes for the
## hiding places nearest where she heard you (within `check_m`, up to `checks` of them, one you've hidden in three
## times first). Each is a seat.gd place to hide (pose hiding) with Marker3D children: `Approach` (where she stands to
## look: 1 to 1.5 m from you) and `Via` (in front of its doorway, if it's in a room off her way: a shut door there she
## opens). She walks to Via, then Approach, and stands there `pass_min` to `pass_max` seconds, breathing: the **close
## pass**. If you're hiding there she may find you: `find_chance`, times `held_factor` while you hold your breath
## (Space; 0: never while you do), certain if your flashlight's on. Seen in the open while she's out (in her view,
## within `see_m` with your flashlight on, `see_dark_m` with it off, nothing between): found too, or with a `chase`
## (chase.gd) she gives chase, and it hands you back: lost, she searches where she last saw you; caught, her fright;
## escaped, she's gone in a blink, back at her post. Found, she pulls you
## out and is in your face for a moment (a sting, you jump, turned to her), and that search is over; then, either way,
## she walks back to her post, her steps going away. After `searches` searches she's gone for good (0: never); stop() ends it any time (a
## scare that shows her elsewhere; a scare that hides her does too). While she's out the night's director holds its
## small moments back (dread.gd), and the Fear node feels her near. `heard_you`, `found` and `search_over` to wire
## anything to; `state` for checks.
extends Node

signal heard_you(at: Vector3)
signal found
signal search_over                                ## back at her post, whether she found you or not

@export var armed := false
@export var replaces: Node3D                      ## her other self: she takes its place when armed, it hidden for good
@export var hiding_places: Array[Node] = []       ## seat.gd places to hide, each with an Approach (and a Via) Marker3D
@export var hear_m := 12.0                        ## a run heard this far; a step (0.35) about a third of it
@export var listen_min := 3.0
@export var listen_max := 6.0
@export var walk_speed := 1.1
@export var checks := 2
@export var check_m := 6.0                        ## hiding places within this of where she heard you
@export var pass_min := 2.0
@export var pass_max := 4.0
@export_range(0.0, 1.0) var find_chance := 0.5
@export_range(0.0, 1.0) var held_factor := 0.5    ## the chance times this while you hold your breath (0: never)
@export var see_m := 7.0                          ## she sees you in the open this far while she's out, your flashlight on
@export var see_dark_m := 3.0                     ## and this far with it off
@export var turn_you := true                      ## found, you're turned to her face
@export var chase: Node                           ## chase.gd: seen in the open, she gives chase instead
@export var searches := 0                         ## after this many she's gone for good (back at her post, hidden); 0: never
@export var heard_says := ""                      ## a line the first time she hears you ("She heard that.")
@export var step_sound := ""                      ## her steps off the shelf; empty: the floor's own (sound.gd)
@export var breath_sound := "breath_close"        ## her breathing at a close pass
@export var found_sound := "sting_big"

var state := "idle"                               ## idle, listening, going, passing, found, leaving, held (a chase has her), gone
var heard_at := Vector3.INF
var passes := 0                                   ## close passes made (a check's)
var times_found := 0
var searches_done := 0
var steps := 0                                    ## her steps played (a check's)
var checked: Array = []                           ## the places checked on the last search (a check's)
var _t := 0.0
var _pass_len := 3.0
var _wait := 0.0
var _route: Array = []                            # [{at, place, door, way}]: a point to walk to; at a place's, the pass; a door there opened
var _place: Node = null
var _inside := Vector3.INF                        # the Via she went in by and hasn't come out of: her way back out
var _rolled := false
var _caught_you := false                          # found you this search: she's done looking
var _from_chase := false                          # found at the end of a chase: gone in a blink after
var _walked := 0.0
var _said := false
var _post := Vector3.INF
var _post_turn := 0.0


func _ready() -> void:
	add_to_group("hs_listener")
	var her := _her()
	if her == null:
		return
	her.add_to_group.call_deferred("hs_threat")      # (the Fear node feels her near: fear.gd)
	_post = her.global_position
	_post_turn = her.global_rotation.y
	if not armed:
		her.visible = false


func _her() -> Node3D:
	return get_parent() as Node3D


## hunting from now (from a signal: whatever it sends is ignored): she's where `replaces` stands, and it's hidden
func arm(_a = null, _b = null) -> void:
	if armed:
		return
	armed = true
	state = "idle"
	var her := _her()
	if her == null:
		return
	if replaces != null:
		her.global_position = replaces.global_position
		her.global_rotation.y = replaces.global_rotation.y
		replaces.visible = false
		replaces.set_meta("hs_hidden", true)          # (her menace won't bring that one back: menace.gd)
	her.set_meta("hs_hidden", false)
	her.visible = true


## the hunt over: she's gone (from a signal: a scare that shows her elsewhere)
func stop(_a = null, _b = null) -> void:
	armed = false
	state = "gone"
	_route = []
	var her := _her()
	if her != null and not bool(her.get_meta("hs_down", false)):   # (shot down, the weapons plugin's HSHitReact takes her away itself)
		her.visible = false


## a noise (noise.gd): heard if it's near enough for how loud it is
func heard(at: Vector3, loud: float) -> void:
	var her := _her()
	if not armed or her == null or (state != "idle" and state != "listening"):
		return
	if her.global_position.distance_to(at) > hear_m * loud:
		return
	heard_at = at
	if state != "idle":
		return
	state = "listening"
	_t = randf_range(listen_min, listen_max)
	heard_you.emit(at)
	_dread("raise", 0.15)
	if heard_says != "" and not _said:
		_said = true
		var st := get_tree().get_first_node_in_group("hs_story")
		if st != null and st.has_method("say"):
			st.say(heard_says)


func _process(dt: float) -> void:
	var her := _her()
	if not armed or her == null:
		return
	if bool(her.get_meta("hs_hidden", false)):
		stop()                                       # a scare hid her: the hunt's over
		return
	if state != "idle":
		_dread("relax_for", 2.0)                     # nothing else from the night's director while she's out
	match state:
		"listening":
			_face(her, heard_at, dt)
			_t -= dt
			if _t <= 0.0:
				_plan()
		"going", "leaving":
			_walk(her, dt)
		"passing":
			_face(her, (_place as Node3D).global_position, dt)
			_t -= dt
			if not _rolled and _t <= _pass_len * 0.5:
				_rolled = true
				if _caught():
					_find(her)
					return
			if _t <= 0.0:
				_next()
		"found":
			_t -= dt
			if _t <= 0.0:
				if _from_chase:
					_vanish_home()
				else:
					_leave()
	if not _caught_you and (state == "going" or state == "passing" or state == "leaving") and _sees_you(her):
		if chase != null and chase.has_method("start"):
			chase.start()                            # after you (it holds her: hold())
		else:
			_find(her)


# the hiding places to check, nearest where she heard you first (one you've hidden in three times before them all)
func _plan() -> void:
	var near: Array = hiding_places.filter(func(p): return p is Node3D and (p as Node3D).global_position.distance_to(heard_at) <= check_m)
	near.sort_custom(func(a, b):
		var ua := int(a.get("uses")) >= 3
		var ub := int(b.get("uses")) >= 3
		if ua != ub:
			return ua
		return (a as Node3D).global_position.distance_to(heard_at) < (b as Node3D).global_position.distance_to(heard_at))
	near = near.filter(func(p):                       # not one behind a locked door: she can't get in
		var v := (p as Node).get_node_or_null("Via") as Node3D
		var d: Node3D = _door_near(v.global_position) if v != null else null
		return d == null or bool(d.get("open")) or not d.has_method("lock") or str(d.lock()) == "")
	checked = near.slice(0, checks)
	_caught_you = false
	_route = []
	for p in checked:
		var via := (p as Node).get_node_or_null("Via") as Node3D
		var app := (p as Node).get_node_or_null("Approach") as Node3D
		if via != null:
			_route.append({"at": via.global_position, "place": null, "door": _door_near(via.global_position), "way": "in"})
		_route.append({"at": app.global_position if app != null else (p as Node3D).global_position, "place": p, "door": null, "way": ""})
		if via != null:
			_route.append({"at": via.global_position, "place": null, "door": null, "way": "out"})   # back out the way she came
	var her := _her()
	if _route.is_empty() and her != null and _clear(her.global_position + Vector3.UP, heard_at + Vector3.UP):
		_route.append({"at": heard_at, "place": null, "door": null, "way": ""})   # nowhere to look: where she heard you (in a straight line), then home
	state = "going"


func _walk(her: Node3D, dt: float) -> void:
	if _wait > 0.0:
		_wait -= dt                                  # a door swinging open
		return
	if _route.is_empty():
		if state == "leaving":
			_home(her)
		else:
			_leave()
		return
	var goal: Vector3 = _route[0]["at"]
	var to := Vector3(goal.x - her.global_position.x, 0.0, goal.z - her.global_position.z)
	var step := walk_speed * dt
	if to.length() <= step:
		her.global_position = Vector3(goal.x, her.global_position.y, goal.z)
		var r: Dictionary = _route.pop_front()
		if r["way"] == "in":
			_inside = goal
		elif r["way"] == "out":
			_inside = Vector3.INF
		var d = r["door"]
		if d != null and is_instance_valid(d) and not bool(d.get("open")) and (not d.has_method("lock") or str(d.lock()) == ""):
			d.set("open", true)                       # (door.gd swings it and plays its sound)
			_wait = 0.9
		var p = r["place"]
		if p != null and state == "going":
			_place = p
			passes += 1
			state = "passing"
			_pass_len = randf_range(pass_min, pass_max)
			_t = _pass_len
			_rolled = false
			_sound(breath_sound, her.global_position + Vector3.UP * 1.5, -4.0)
		return
	her.global_position += to.normalized() * step
	her.global_rotation.y = lerp_angle(her.global_rotation.y, atan2(to.x, to.z), minf(1.0, dt * 8.0))   # her front (+Z) the way she goes
	_walked += step
	if _walked >= 0.6:
		_walked = 0.0
		steps += 1
		_step(her.global_position)


## held still while a chase moves her (chase.gd calls it)
func hold() -> void:
	state = "held"
	_route = []
	_wait = 0.0


## a chase lost you: she searches the places to hide near where she last saw you (a shorter listen first)
func search_at(p: Vector3) -> void:
	heard_at = p
	_caught_you = false
	_inside = Vector3.INF
	state = "listening"
	_t = randf_range(listen_min, listen_max) * 0.5


## a chase is over (you got away, or she gave up): gone in a blink, back at her post
func give_up() -> void:
	_vanish_home()


## a chase caught you: her fright, then gone in a blink, back at her post
func catch() -> void:
	var her := _her()
	if her != null:
		_from_chase = true
		_find(her)


func _vanish_home() -> void:
	var her := _her()
	if her == null:
		return
	_from_chase = false
	her.visible = false
	her.global_position = _post
	_place = null
	_inside = Vector3.INF
	_route = []
	_home(her)                                       # the search over (her last: gone for good)
	if state == "idle":
		her.visible = true                           # back at her post, listening again


# after a pass: the next place, or home
func _next() -> void:
	_place = null
	if _route.any(func(r): return r["place"] != null):
		state = "going"
	else:
		_leave()


# back to her post, out of the room she's in by the way she came in
func _leave() -> void:
	_route = []
	if _inside != Vector3.INF:
		_route.append({"at": _inside, "place": null, "door": null, "way": "out"})
	_route.append({"at": _post, "place": null, "door": null, "way": ""})
	_place = null
	state = "leaving"


# at her post again: the search over (and her last, maybe: then she's gone)
func _home(her: Node3D) -> void:
	her.global_rotation.y = _post_turn
	state = "idle"
	searches_done += 1
	search_over.emit()
	if searches > 0 and searches_done >= searches:
		stop()


# you, hiding in the place she's looking at: found by chance, held breath lowering it, a light on making it certain
func _caught() -> bool:
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl == null or pl.get("seat") != _place or str(pl.get("pose")) != "hiding":
		return false
	if _lit(pl):
		return true
	var chance := find_chance * (held_factor if bool(pl.get("holding")) else 1.0)
	return randf() < chance


func _lit(pl: Node) -> bool:
	var torch: Node = pl.get_node_or_null("Eye/Flashlight")
	return torch is Light3D and (torch as Light3D).visible and not bool(torch.get("is_dead"))


# you in the open, in her sight
func _sees_you(her: Node3D) -> bool:
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	if pl == null or str(pl.get("pose")) == "hiding":
		return false
	var head := her.global_position + Vector3.UP * 1.5
	var eye := (pl.get_node("Eye") as Node3D).global_position
	var to := eye - head
	if to.length() > (see_m if _lit(pl) else see_dark_m) or her.global_basis.z.dot(to.normalized()) < 0.5:
		return false                                 # beyond her sight, or outside 120° of it
	var q := PhysicsRayQueryParameters3D.create(head, eye, 1)
	if pl is CollisionObject3D:
		q.exclude = [(pl as CollisionObject3D).get_rid()]
	return her.get_world_3d().direct_space_state.intersect_ray(q).is_empty()


# found: pulled out of where you hid, she right up in your face for a moment (a sting, you jump), then she goes
func _find(her: Node3D) -> void:
	times_found += 1
	_caught_you = true
	state = "found"
	_t = 0.9
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	if pl == null:
		return
	var seat = pl.get("seat")
	if seat != null and seat.has_method("leave"):
		seat.leave()
	var eye := pl.get_node_or_null("Eye") as Node3D
	if eye != null:
		var from := her.global_position - eye.global_position
		from.y = 0.0
		if from.length() < 0.05:
			from = -eye.global_basis.z
			from.y = 0.0
		from = from.normalized()
		var at := eye.global_position + from * 0.45   # toward where she was: nothing between, she saw you or stood over you
		her.global_position = Vector3(at.x, her.global_position.y, at.z)
		her.global_rotation.y = atan2(-from.x, -from.z)
		if turn_you:
			pl.global_rotation.y = atan2(-from.x, -from.z)
			var p := atan2(her.global_position.y + 1.45 - eye.global_position.y, 0.45)
			pl.set("pitch", p)
			eye.rotation.x = p
	_sound(found_sound, her.global_position + Vector3.UP * 1.5, 0.0, "event")
	var fear := get_tree().get_first_node_in_group("hs_fear")
	if fear != null and fear.has_method("scare"):
		fear.scare()
	_dread("raise", 0.35)
	found.emit()


func _clear(a: Vector3, b: Vector3) -> bool:
	var q := PhysicsRayQueryParameters3D.create(a, b, 1)
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [(pl as CollisionObject3D).get_rid()]
	return _her().get_world_3d().direct_space_state.intersect_ray(q).is_empty()


# the interiors' door nearest `p` (its hinge within 1.2 m across the floor): the doorway she goes through
func _door_near(p: Vector3) -> Node3D:
	var best: Node3D = null
	var bd := 1.2
	for it in get_tree().get_nodes_in_group("hs_interior"):
		if not it.has_method("doors"):
			continue
		for d in it.doors():
			var dd := Vector2((d as Node3D).global_position.x - p.x, (d as Node3D).global_position.z - p.z).length()
			if dd < bd:
				bd = dd
				best = d
	return best


func _face(her: Node3D, p: Vector3, dt: float) -> void:
	var to := p - her.global_position
	if Vector2(to.x, to.z).length() < 0.05:
		return
	her.global_rotation.y = lerp_angle(her.global_rotation.y, atan2(to.x, to.z), minf(1.0, dt * 3.0))


func _step(at: Vector3) -> void:
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd == null or not snd.has_method("play"):
		return
	var fam := step_sound
	if fam == "" and snd.has_method("steps_for"):
		fam = str(snd.steps_for(snd.floor_at(at)))
	snd.play(fam, at + Vector3(0, 0.05, 0), -4.0, "sfx")


func _sound(what: String, at: Vector3, db: float, kind := "sfx") -> void:
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if what != "" and snd != null and snd.has_method("play"):
		snd.play(what, at, db, kind)


func _dread(m: String, k: float) -> void:
	var d := get_tree().get_first_node_in_group("hs_dread")
	if d != null and d.has_method(m):
		d.call(m, k)
