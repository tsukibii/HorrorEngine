## Her own animations, played (DECISIONS 2026-11-13, animation v2: "the exported characters ... will utilize their own
## custom animations which we can just event in like walk from here to here, pick this up"). Put this node under a
## character whose .glb the Animator baked (dashboard: Animator v2): it finds her clips and what the bake says of them
## (how fast her walk travels, where her hand closes on a handle), and does things with them:
##     var m := $Her/Motion
##     m.walk_to($Door)             # walks there (run_to: runs), turning as she goes, her feet keeping step
##     m.sit($Chair/Seat)           # walks to it, sits; stand() gets her up again
##     m.sleep($Bed/Edge)           # sits on the bed's edge, lies down, sleeps; wake() gets her up
##     m.open($Door/Handle, $Door)  # a hand to the handle; the door's own use() as she opens it ("push", "pull", "slide")
##     m.pick_up($Key)              # walks to it, takes it (from the floor, a table or a shelf by how high it is)
##     m.play("dance")              # any other animation: her model's, or one of `more`
## One thing after another: each call takes the place of what she was doing (sat, she stands first; asleep, she
## gets up first). `done(what)` when it's finished; an act.gd node does all this from the Inspector, by a quest's own
## words. Where things are:
##   a seat, a bed   a Marker3D on its front edge, at the height you sit at, its blue arrow (+Z) the way she'll face sat
##   a handle        a Marker3D at the handle, its blue arrow pointing into the door (the way she faces to open it)
##   anything else   wherever it is
## Her clips move her body's bones only: her face (expressions, blinks) and her hair's springs play over any of them.
## A character that wasn't baked still walks if her model has animations called idle, walk and run.
extends Node

signal arrived(where: Vector3)                        ## she got where she was walking to
signal done(what: String)                             ## an act finished: "walk", "sit", "stand", "sleep", "wake", "open", "reach", "pick_up", "play", "face"
signal event(name: String)                            ## a clip's own moments: "step_l", "step_r", "seated", "grab", "open", "release", "put_away"...

@export var walk_speed := 0.0                         ## metres a second; 0: as her own walk was made
@export var run_speed := 0.0                          ## 0: as her own run was made
@export var turn_degrees := 320.0                     ## how fast she turns, a second
@export var blend := 0.3                              ## seconds from one clip into the next
@export var arrive_m := 0.05                          ## how near counts as there
@export var start_with := "idle"                      ## what she does when the game starts ("": nothing)
@export_flags_3d_physics var floor_mask := 1          ## what she stands on (0: she keeps her height)
@export var more := {}                                ## clips of your own: {"dance": "res://animations/dance.res"}

var record := {}                                      ## the Animator's record of her clips (empty: she wasn't baked)
var now := ""                                         ## what she's doing: "", "idle", "walk", "run", "turn", a clip's name
var busy := false                                     ## something asked of her isn't finished
var seated := false
var asleep := false
var problems: Array = []                              ## what's missing, in words
var serial := 0                                       ## goes up each time she's asked for something (an act knows it was interrupted)

var _ap: AnimationPlayer
var _names := {}                                      # the record's clip name -> the name her player knows it by
var _queue: Array = []
var _step := {}
var _t := 0.0
var _fired := 0
var _lift := 0.0                                      # how far she's raised or lowered to meet a seat that isn't the height she was baked for
var _lift_from := 0.0
var _held: Node3D
var _side := ""                                       # the bed's side she lay down to ("": her left, "_r": her right)
var _ready_now := false


func _ready() -> void:
	setup.call_deferred()


func her() -> Node3D:
	return get_parent() as Node3D


## find her clips (again): called when the game starts
func setup() -> void:
	var h := her()
	problems = []
	record = {}
	_names = {}
	if h == null:
		return
	for mi in h.find_children("*", "MeshInstance3D", true, false):
		if mi.has_meta("extras"):
			var ex = mi.get_meta("extras")
			if ex is Dictionary and ex.get("hsMotion") is Dictionary:
				record = ex["hsMotion"]
				break
	var players := h.find_children("*", "AnimationPlayer", true, false)
	var want: Array = (record.get("clips", {}) as Dictionary).keys() if not record.is_empty() else ["idle_loop", "walk_loop", "run_loop"]
	for n in want:
		for cand in [n, String(n).replace("_loop", ""), String(n).replace("_loop", "-loop")]:
			var found := false
			for ap in players:
				if (ap as AnimationPlayer).has_animation(cand):
					if _ap == null:
						_ap = ap
					if ap == _ap:
						_names[n] = cand
						found = true
						break
			if found:
				break
	if _ap == null and not players.is_empty():
		_ap = players[0]
	if _ap == null:
		problems.append("she has no animations: bake her .glb in the Animator (dashboard: Animator v2)")
	elif record.is_empty():
		problems.append("her .glb wasn't baked by the Animator: only what her model calls idle, walk and run will play")
	for n in _names:
		var a := _ap.get_animation(_names[n])
		a.loop_mode = Animation.LOOP_LINEAR if String(n).ends_with("_loop") else Animation.LOOP_NONE
	for k in more:                                        # your own clips: files into her player; names she already has are just names
		var src := str(more[k])
		if src.begins_with("res://") or src.begins_with("user://"):
			var r = load(src) if ResourceLoader.exists(src) else null
			if r is Animation and _ap != null:
				if not _ap.has_animation_library("more"):
					_ap.add_animation_library("more", AnimationLibrary.new())
				var lib := _ap.get_animation_library("more")
				if lib.has_animation(str(k)):
					lib.remove_animation(str(k))
				lib.add_animation(str(k), r)
			else:
				problems.append("%s: %s isn't an animation" % [k, src])
	for p in problems:
		push_warning("motion.gd (%s): %s" % [h.name, p])
	_ready_now = true
	if not _queue.is_empty():                             # asked for something before her clips were found (a script's _ready): now
		_next()
	elif start_with == "idle":
		idle()
	elif start_with != "":
		play(start_with, true)


func has_clip(n: String) -> bool:
	return _names.has(n)


func clip_info(n: String) -> Dictionary:
	return (record.get("clips", {}) as Dictionary).get(n, {})


## how fast her walk (or run) travels as it was made, metres a second
func speed_of(run := false) -> float:
	var s := float(clip_info("run_loop" if run else "walk_loop").get("speed", 0.0))
	return s if s > 0.05 else (3.0 if run else 1.3)


# ---- what she can be asked ----------------------------------------------------------------------------------------------
func idle() -> void:
	_begin([{"k": "idle"}])


func stop() -> void:
	_queue = []
	_step = {}
	busy = false
	if not seated and not asleep:
		_play("idle_loop")
		now = "idle"


## walk to a place (a node, or a Vector3); `face`: a node or a point to end up facing
func walk_to(target, face = null) -> void:
	_begin([_go(_point(target), false, face), {"k": "idle"}, {"k": "done", "what": "walk"}])


func run_to(target, face = null) -> void:
	_begin([_go(_point(target), true, face), {"k": "idle"}, {"k": "done", "what": "walk"}])


## along several places, one after another
func go(points: Array, run := false) -> void:
	var steps: Array = []
	for p in points:
		steps.append(_go(_point(p), run, null))
	_begin(steps + [{"k": "idle"}, {"k": "done", "what": "walk"}])


func face(target) -> void:
	var to := _point(target) - her().global_position
	_begin([{"k": "turn", "yaw": atan2(to.x, to.z)}, {"k": "done", "what": "face"}])


## sit on a seat: a Marker3D on its front edge at the height you sit at, its +Z the way she'll face
func sit(seat: Node3D) -> void:
	var m: Dictionary = clip_info("sit_down").get("seat", {})
	var f := _front(seat)
	var stand := seat.global_position - f * float(m.get("edge", -0.05))
	var steps: Array = [_go(stand, false, null, atan2(f.x, f.z))]
	steps.append({"k": "clip", "clip": "sit_down", "lift": _lift_for(seat, stand, float(m.get("height", 0.45)))})
	steps.append({"k": "state", "seated": true, "loop": "sit_loop"})
	steps.append({"k": "done", "what": "sit"})
	_begin(steps)


func stand() -> void:
	if seated:
		_begin([])                                        # (the getting up is put in front of whatever comes next: nothing)
	else:
		done.emit("stand")


## sleep on a bed: a Marker3D on the edge she gets in from, at the mattress's height, its +Z pointing away from the
## bed; `pillow`: a node where her head should be (which way she lies, and where along the edge she sits)
func sleep(bed: Node3D, pillow: Node3D = null) -> void:
	var f := _front(bed)
	var left := Vector3(f.z, 0, -f.x)                     # her left when she faces out from the bed
	var side := ""
	var m: Dictionary = clip_info("lie_down").get("bed", {})
	var at := bed.global_position
	if pillow != null:
		var d := (pillow.global_position - bed.global_position).dot(left)
		side = "" if d >= 0.0 else "_r"
		m = clip_info("lie_down" + side).get("bed", m)
		var head: Array = m.get("head", [0.7, 0.6, -0.5])
		at += left * (d - float(head[0]))                 # along the edge, so her head comes down on the pillow
	var stand := at - f * float(m.get("edge", -0.05))
	var steps: Array = [_go(stand, false, null, atan2(f.x, f.z))]
	steps.append({"k": "clip", "clip": "lie_down" + side, "lift": _lift_for(bed, stand, float(m.get("height", 0.45)))})
	steps.append({"k": "state", "asleep": true, "side": side, "loop": "sleep%s_loop" % side})
	steps.append({"k": "done", "what": "sleep"})
	_begin(steps)


func wake() -> void:
	if asleep:
		_begin([])
	else:
		done.emit("wake")


## open a door: `handle` a Marker3D at its handle (its +Z into the door); `door`: what opens (its use() or fire() is
## called as her hand moves it); how: "push", "pull" or "slide"; left: with her left hand
func open(handle: Node3D, door: Node = null, how := "push", left := false) -> void:
	var clip := "open_%s%s" % [how, "_l" if left else ""]
	var m: Dictionary = clip_info(clip).get("door", {})
	var f := _front(handle)
	var hp: Array = m.get("handle", [-0.14, 1.0, 0.45])
	var stand := handle.global_position - _turned(Vector3(hp[0], 0, hp[2]), atan2(f.x, f.z))
	var steps: Array = [_go(stand, false, null, atan2(f.x, f.z))]
	steps.append({"k": "clip", "clip": clip, "on": {"open": func(): _use(door)}})
	steps.append({"k": "idle"})
	steps.append({"k": "done", "what": "open"})
	_begin(steps)


## reach for something (a node or a point) and come back: level "" (by how high it is), "low", "mid" or "high"
func reach(target, level := "", left := false) -> void:
	_begin(_reach_steps(_point(target), level, left, null, false) + [{"k": "idle"}, {"k": "done", "what": "reach"}])


## walk to a thing, take it: it goes into her hand as her hand closes, and is put away (hidden) as she straightens
## (keep: it stays in her hand; drop() lets go of it)
func pick_up(thing: Node3D, keep := false, left := false) -> void:
	_begin(_reach_steps(thing.global_position, "", left, thing, keep) + [{"k": "idle"}, {"k": "done", "what": "pick_up"}])


## whatever she holds let go of, where it is
func drop() -> void:
	if is_instance_valid(_held):
		_held.reparent(her().get_parent(), true)
	_held = null


## any animation by name: her model's, or one of `more`; looped until she's asked for something else when `loop`
func play(clip: String, loop := false) -> void:
	_begin([{"k": "clip", "clip": clip, "own": true, "loop": loop}] + ([] if loop else [{"k": "idle"}]) + [{"k": "done", "what": "play"}])


# ---- how ------------------------------------------------------------------------------------------------------------------
func _point(target) -> Vector3:
	if target is Vector3:
		return target
	if target is Node3D:
		return (target as Node3D).global_position
	return her().global_position


func _front(n: Node3D) -> Vector3:
	var f := n.global_basis.z
	f.y = 0.0
	return f.normalized() if f.length() > 0.001 else Vector3(0, 0, 1)


func _turned(v: Vector3, yaw: float) -> Vector3:
	return Vector3(v.x * cos(yaw) + v.z * sin(yaw), v.y, -v.x * sin(yaw) + v.z * cos(yaw))


func _go(to: Vector3, run: bool, face, yaw = null) -> Dictionary:
	var s := {"k": "go", "to": to, "run": run}
	if yaw != null:
		s["yaw"] = float(yaw)
	elif face != null:
		var d := _point(face) - to
		s["yaw"] = atan2(d.x, d.z)
	return s


func _lift_for(seat: Node3D, stand: Vector3, made_for: float) -> float:
	return clampf((seat.global_position.y - _floor_at(stand)) - made_for, -0.12, 0.12)


func _reach_steps(at: Vector3, level: String, left: bool, thing: Node3D, keep: bool) -> Array:
	var h := her()
	var fl := _floor_at(at)
	var high := at.y - fl
	var tall := float((record.get("body", {}) as Dictionary).get("height", 165.0)) / 100.0
	if level == "":
		level = "low" if high < 0.3 * tall else ("mid" if high < 0.74 * tall else "high")
	var clip := "reach_%s%s" % [level, "_l" if left else ""]
	var m: Dictionary = clip_info(clip).get("reach", {})
	var rp: Array = m.get("at", [-0.12, 0.85, 0.45])
	var to := at - h.global_position
	to.y = 0.0
	var yaw := atan2(to.x, to.z) if to.length() > 0.05 else h.global_rotation.y
	# where to stand so the hand comes down on it: back from it by the clip's own reach, turned so the hand's side lines up
	var flat := Vector3(rp[0], 0, rp[2])
	yaw -= atan2(flat.x, flat.z)
	var stand := at - _turned(flat, yaw)
	stand.y = fl
	var on := {}
	if thing != null:
		on["grab"] = func(): _take(thing, left)
		on["put_away"] = func(): _put_away(keep)
	return [_go(stand, false, null, yaw), {"k": "clip", "clip": clip, "on": on}]


func _take(thing: Node3D, left: bool) -> void:
	if not is_instance_valid(thing):
		return
	var sks := her().find_children("*", "Skeleton3D", true, false)
	if sks.is_empty():
		return
	var sk := sks[0] as Skeleton3D
	var nm := "l_wrist" if left else "r_wrist"
	var att := sk.get_node_or_null("Hold_" + nm) as BoneAttachment3D
	if att == null:
		att = BoneAttachment3D.new()
		att.name = "Hold_" + nm
		sk.add_child(att)
		att.bone_name = nm
	for c in thing.find_children("*", "CollisionObject3D", true, false):       # (in her hand it's nothing to bump into)
		(c as CollisionObject3D).process_mode = Node.PROCESS_MODE_DISABLED
	if thing is RigidBody3D:
		(thing as RigidBody3D).freeze = true
	thing.reparent(att, true)
	var palm: Array = (record.get("palm", {}) as Dictionary).get("l" if left else "r", [0.0, -0.07, 0.03])
	var tw := thing.create_tween()
	tw.tween_property(thing, "position", Vector3(palm[0], palm[1], palm[2]), 0.14)
	_held = thing


func _put_away(keep: bool) -> void:
	if keep or not is_instance_valid(_held):
		return
	_held.visible = false
	_held = null


func _use(door: Node) -> void:
	if door == null:
		return
	if door.has_method("use"):
		door.use(her())
	elif door.has_method("fire"):
		door.fire()
	elif door.has_method("open"):
		door.open()


func _floor_at(p: Vector3) -> float:
	var h := her()
	if floor_mask == 0 or h == null or not h.is_inside_tree():
		return h.global_position.y if h != null else p.y
	var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, h.global_position.y + 1.0, p.z), Vector3(p.x, h.global_position.y - 1.5, p.z), floor_mask)
	var hit := h.get_world_3d().direct_space_state.intersect_ray(q)
	return float(hit["position"].y) if not hit.is_empty() else h.global_position.y - _lift


# what's asked takes the place of what she was doing; sat or asleep, she gets up first
func _begin(steps: Array) -> void:
	var pre: Array = []
	if asleep:
		pre.append({"k": "clip", "clip": "get_up" + _side, "lift": 0.0})
		pre.append({"k": "state", "asleep": false, "seated": false})
		pre.append({"k": "idle"})
		pre.append({"k": "done", "what": "wake"})
	elif seated:
		pre.append({"k": "clip", "clip": "stand_up", "lift": 0.0})
		pre.append({"k": "state", "seated": false})
		pre.append({"k": "idle"})
		pre.append({"k": "done", "what": "stand"})
	_queue = pre + steps
	_step = {}
	serial += 1
	busy = not _queue.is_empty()
	if not _ready_now:
		return
	_next()


func _next() -> void:
	if _queue.is_empty():
		_step = {}
		busy = false
		return
	_step = _queue.pop_front()
	_t = 0.0
	_fired = 0
	match String(_step["k"]):
		"idle":
			if not seated and not asleep:
				_play("idle_loop")
				now = "idle"
			_next()
		"state":
			if _step.has("seated"):
				seated = bool(_step["seated"])
			if _step.has("asleep"):
				asleep = bool(_step["asleep"])
				seated = seated and not asleep
			if _step.has("side"):
				_side = String(_step["side"])
			if _step.has("loop"):
				_play(String(_step["loop"]))
				now = String(_step["loop"])
			_next()
		"done":
			done.emit(String(_step["what"]))
			_next()
		"clip":
			var n := String(_step["clip"])
			_lift_from = _lift
			if _step.get("own", false):
				if not _play_own(n, bool(_step.get("loop", false))):
					_next()
					return
				_step["secs"] = _ap.get_animation(_ap.current_animation).length if not bool(_step.get("loop", false)) else 0.0
			else:
				if not _names.has(n):                      # (a character with no such clip: the act still happens, without the motion)
					for k in (_step.get("on", {}) as Dictionary):
						(_step["on"][k] as Callable).call()
					if _step.has("lift"):
						_set_lift(float(_step["lift"]))
					_next()
					return
				_play(n)
				_step["secs"] = float(clip_info(n).get("secs", _ap.get_animation(_names[n]).length))
			now = n
			if float(_step["secs"]) <= 0.0:                # (a loop of your own: it plays on; she's free)
				_next()


func _play(n: String, rate := 1.0) -> void:
	if _ap == null or not _names.has(n):
		return
	_ap.speed_scale = rate
	if _ap.current_animation != _names[n] or not _ap.is_playing():
		_ap.play(_names[n], blend)


func _play_own(n: String, loop: bool) -> bool:
	if _ap == null:
		return false
	var name := ""
	for cand in [n, "more/" + n, n + "_loop"]:
		if _ap.has_animation(cand):
			name = cand
			break
	if name == "":
		var mv := get_parent().get_node_or_null("Moves")           # a Kimodo motion on a Moves node beside this one
		if mv != null and mv.has_method("has") and mv.has(n):
			_ap.stop()
			mv.play(n)
			return false
		push_warning("motion.gd (%s): no animation called '%s'" % [her().name, n])
		return false
	_ap.get_animation(name).loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
	_ap.speed_scale = 1.0
	_ap.play(name, blend)
	return true


func _set_lift(v: float) -> void:
	var h := her()
	h.global_position.y += v - _lift
	_lift = v


func _physics_process(dt: float) -> void:
	if _step.is_empty():
		return
	var h := her()
	match String(_step["k"]):
		"go":
			var to: Vector3 = _step["to"]
			var d := to - h.global_position
			d.y = 0.0
			var dist := d.length()
			if dist <= arrive_m:
				h.global_position = Vector3(to.x, _floor_at(to), to.z)
				arrived.emit(h.global_position)
				if _step.has("yaw"):
					_step = {"k": "turn", "yaw": _step["yaw"]}
					_play("idle_loop")
					return
				_next()
				return
			var run: bool = _step["run"]
			var want := atan2(d.x, d.z)
			var off := absf(angle_difference(h.global_rotation.y, want))
			h.global_rotation.y = rotate_toward(h.global_rotation.y, want, deg_to_rad(turn_degrees) * dt)
			var made := speed_of(run)
			var v := (run_speed if run else walk_speed)
			if v <= 0.0:
				v = made
			v *= clampf(dist / 0.3, 0.4, 1.0) * (1.0 if off < 0.9 else 0.3)       # (slower into the stop, and while she's still turning)
			var stepv := d.normalized() * minf(v * dt, dist)
			var p := h.global_position + stepv
			p.y = _floor_at(p)
			h.global_position = p
			var clip := "run_loop" if run and _names.has("run_loop") else "walk_loop"
			_play(clip, clampf(v / speed_of(clip == "run_loop"), 0.4, 2.2))
			now = "run" if clip == "run_loop" else "walk"
			_events(clip, _ap.current_animation_position if _ap != null else 0.0, true)
		"turn":
			var want2: float = _step["yaw"]
			h.global_rotation.y = rotate_toward(h.global_rotation.y, want2, deg_to_rad(turn_degrees) * dt)
			if absf(angle_difference(h.global_rotation.y, want2)) < 0.01:
				h.global_rotation.y = want2
				_next()
		"clip":
			_t += dt
			var secs := float(_step.get("secs", 0.0))
			var n := String(_step["clip"])
			if _step.has("lift") and secs > 0.0:
				_set_lift(lerpf(_lift_from, float(_step["lift"]), smoothstep(0.1, 0.7, _t / secs)))
			_events(n, _t, false)
			if _t >= secs:
				if _step.has("lift"):
					_set_lift(float(_step["lift"]))
				_next()


# a clip's own moments, as its time passes them
func _events(n: String, t: float, looped: bool) -> void:
	var evs: Array = clip_info(n).get("events", [])
	if evs.is_empty():
		return
	if looped:
		var i := 0
		for e in evs:
			if t >= float(e["t"]):
				i += 1
		if i != _fired:
			if i > 0:
				event.emit(String(evs[i - 1]["name"]))
			_fired = i
		return
	while _fired < evs.size() and t >= float(evs[_fired]["t"]):
		var nm := String(evs[_fired]["name"])
		_fired += 1
		event.emit(nm)
		var on: Dictionary = _step.get("on", {})
		if on.has(nm):
			(on[nm] as Callable).call()


## what she has and is doing, a check's
func report() -> Dictionary:
	return {"clips": _names.keys(), "now": now, "busy": busy, "seated": seated, "asleep": asleep, "baked": not record.is_empty(), "problems": problems,
		"walk": speed_of(false), "run": speed_of(true)}
