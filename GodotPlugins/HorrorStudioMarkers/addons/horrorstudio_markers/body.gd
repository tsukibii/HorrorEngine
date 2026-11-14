@tool
## A character's body driven (docs/MARKERS.md §4): put somewhere, hidden and switched off, walked along a path with
## her feet keeping step and her height the floor's, stood, sat, laid down, a hand put out, a thing taken, a clip
## played. The runner asks; each thing asked takes the place of what she was doing (sat, she stands first; asleep,
## she gets up first), and `busy` is true until it's finished. Between things she holds what she's in: standing she
## idles (or the loop she was left in), sat she stays sat, asleep she sleeps.
##
## It reads the Animator's record of her clips when her .glb was baked (how fast her walk travels, where a seat, a
## handle and a reach are: the starter kit's motion.gd, the same numbers). A character that wasn't baked plays what
## her model calls idle, walk, run, sit...; one with no animations at all still gets there (she slides). Nothing here
## stops the game for a missing clip: `problems` says what's missing.
##
## It never changes an animation of hers: each clip it plays is a copy in a library of its own ("hsm") on her
## player, with the loop it wants. So it's safe on the editor's copy of her (the tester) and on a model the editor
## imported.
class_name HSNpcBody
extends RefCounted

const WALK := 1.3                          # her speeds when nothing says (m/s)
const RUN := 3.0
const RETARGET := ["res://kimodo/retarget.gd", "res://addons/horrorstudio_director/kimodo/retarget.gd"]
const NPZ := ["res://kimodo/npz.gd", "res://addons/horrorstudio_director/kimodo/npz.gd"]
const GUESS := {                           # an unbaked model's clips, found by what their names hold
	"idle_loop": ["idle", "breath", "stand"], "walk_loop": ["walk"], "run_loop": ["run", "jog", "sprint"],
	"sit_down": ["sit_down", "sitdown", "sitting_down", "sit down"], "sit_loop": ["sit_loop", "sit_idle", "sitting", "seated"],
	"stand_up": ["stand_up", "standup", "standing_up", "stand up"],
	"lie_down": ["lie_down", "liedown", "lay_down"], "sleep_loop": ["sleep", "lying"], "get_up": ["get_up", "getup", "wake"],
}
const HANDS := {false: ["r_wrist", "RightHand", "mixamorig_RightHand", "mixamorig:RightHand", "hand_r", "Hand.R", "hand.R"],
	true: ["l_wrist", "LeftHand", "mixamorig_LeftHand", "mixamorig:LeftHand", "hand_l", "Hand.L", "hand.L"]}

var her: Node3D
var set := {"walk_speed": 0.0, "run_speed": 0.0, "turn_degrees": 320.0, "floor_mask": 1, "preview": false, "waits": true}
var record := {}                           ## the Animator's record of her clips (empty: she wasn't baked)
var names := {}                            ## a clip's role -> [her player, its name there]
var problems: Array = []                   ## what's missing, in words
var posture := "standing"                  ## standing, sitting, lying
var side := ""                             ## lying: "" her head to her left as she sat, "_r" to her right
var hidden := false
var released := false                      ## another script moves her: nothing here touches her
var busy := false                          ## something asked of her isn't finished
var now := ""                              ## what she's doing: "idle", "walk", "run", "turn", a clip's role
var hold_clip := ""                        ## the loop she stands in ("": her idle)
var hold_rate := 1.0
var lift := 0.0                            ## how far she's raised or lowered to meet a seat that isn't the height she was baked for
var held: Node3D                           ## what's in her hand
var avoid := Vector3.INF                   ## where the player is (she waits a moment for them to move); INF: nobody
var skip: Array[RID] = []                  ## bodies her floor ray leaves out (her own, the player's)
var on_event := Callable()                 ## (name): a clip's own moments: step_l, step_r, grab, open...
var waited := 0.0                          ## how long she's been waiting for the player to move
var travelled := 0.0                       ## metres walked on the path she's on

var _players: Array = []
var _queue: Array = []
var _step := {}
var _t := 0.0
var _fired := 0
var _lift_from := 0.0
var _player: AnimationPlayer
var _playing := ""
var _files := {}
var _mode_was := Node.PROCESS_MODE_INHERIT
var _own: AnimationPlayer


# ---- finding what she has -------------------------------------------------------------------------------------------------
## the Animator's record on a character's skin (hsMotion), or nothing
static func record_of(node: Node) -> Dictionary:
	if node == null:
		return {}
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if mi.has_meta("extras"):
			var ex = mi.get_meta("extras")
			if ex is Dictionary and ex.get("hsMotion") is Dictionary:
				return ex["hsMotion"]
	return {}


static func players_of(node: Node) -> Array:
	var out := []
	if node == null:
		return out
	for p in node.find_children("*", "AnimationPlayer", true, false):
		if not String(p.name).begins_with("_"):
			out.append(p)
	return out


## the names of every animation a character has (the tab's list): her model's own, no library of ours
static func clips_of(node: Node) -> PackedStringArray:
	var out := PackedStringArray()
	for p in players_of(node):
		for n in (p as AnimationPlayer).get_animation_list():
			var s := String(n)
			if s.begins_with("hsm/") or s == "RESET" or s.ends_with("/RESET"):
				continue
			if not (s in out):
				out.append(s)
	return out


static func skeleton_of(node: Node) -> Skeleton3D:
	if node == null:
		return null
	var sks := node.find_children("*", "Skeleton3D", true, false)
	return sks[0] as Skeleton3D if not sks.is_empty() else null


func setup(character: Node3D, settings: Dictionary = {}) -> void:
	her = character
	set.merge(settings, true)
	problems = []
	names = {}
	record = record_of(her)
	_players = players_of(her)
	var want: Array = (record.get("clips", {}) as Dictionary).keys() if record.get("clips") is Dictionary else []
	for role in want:
		_find_exact(String(role))
	if record.is_empty():
		for role in GUESS:
			if not _find_exact(role):
				_find_like(role, GUESS[role])
	if _players.is_empty():
		problems.append("no animations: the character slides from marker to marker (bake the .glb in the Animator)")
	elif record.is_empty():
		problems.append("the .glb wasn't baked by the Animator: only the animations the model has play (idle, walk, run by their names)")
	for need in ["idle_loop", "walk_loop"]:
		if not _players.is_empty() and not names.has(need):
			problems.append("no animation for '%s'" % need.trim_suffix("_loop"))


func _find_exact(role: String) -> bool:
	for cand in [role, role.replace("_loop", ""), role.replace("_loop", "-loop")]:
		for p in _players:
			if (p as AnimationPlayer).has_animation(cand):
				names[role] = [p, cand]
				return true
	return false


func _find_like(role: String, parts: Array) -> bool:
	for part in parts:
		for p in _players:
			for n in (p as AnimationPlayer).get_animation_list():
				var s := String(n).to_lower()
				if s.contains(part) and not s.begins_with("hsm/") and not (role == "idle_loop" and (s.contains("sit") or s.contains("walk"))):
					names[role] = [p, String(n)]
					return true
	return false


func has_clip(role: String) -> bool:
	return names.has(role) or not _source(role).is_empty()


func clip_info(role: String) -> Dictionary:
	var c = (record.get("clips", {}) as Dictionary).get(role, {}) if record.get("clips") is Dictionary else {}
	return c if c is Dictionary else {}


## how fast her walk (or run) travels as it was made, metres a second
func speed_of(run := false) -> float:
	var s := float(clip_info("run_loop" if run else "walk_loop").get("speed", 0.0))
	return s if s > 0.05 else (RUN if run else WALK)


## the speed she walks or runs at: her HSNpc's when it says, else her clip's own
func pace(run := false) -> float:
	var v := float(set["run_speed"] if run else set["walk_speed"])
	return v if v > 0.0 else speed_of(run)


func _source(n: String) -> Array:
	if names.has(n):
		return names[n]
	for cand in [n, n + "_loop", n.trim_suffix("_loop")]:
		for p in _players:
			if (p as AnimationPlayer).has_animation(cand):
				return [p, cand]
	if _own != null and _own.has_animation("files/" + n):
		return [_own, "files/" + n]
	return []


## how long a clip of hers is, seconds (0: she hasn't one)
func clip_secs(n: String) -> float:
	var src := _source(n)
	if src.is_empty():
		return 0.0
	var info := clip_info(n)
	return float(info.get("secs", (src[0] as AnimationPlayer).get_animation(src[1]).length))


# a clip played: a copy of it in our own library on her player, with the loop wanted; -> its length (0: she hasn't it)
func _play(n: String, loop: bool, rate := 1.0, blend := 0.25, restart := false) -> float:
	var src := _source(n)
	if src.is_empty():
		return 0.0
	var p := src[0] as AnimationPlayer
	var key := String(src[1]).replace("/", "~") + ("@loop" if loop else "@once")
	if not p.has_animation_library("hsm"):
		p.add_animation_library("hsm", AnimationLibrary.new())
	var lib := p.get_animation_library("hsm")
	if not lib.has_animation(key):
		var a := p.get_animation(src[1]).duplicate() as Animation
		a.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
		lib.add_animation(key, a)
	if _player != null and _player != p and is_instance_valid(_player):
		_player.stop(true)
	_player = p
	p.speed_scale = rate
	var full := "hsm/" + key
	if restart or p.current_animation != full or not p.is_playing():
		if restart and p.current_animation == full:
			p.stop(true)
		p.play(full, blend)
	_playing = full
	return lib.get_animation(key).length


func _rate(rate: float) -> void:
	if _player != null and is_instance_valid(_player):
		_player.speed_scale = rate


# ---- a clip from a file (a Kimodo .npz, a Godot animation) --------------------------------------------------------------------
static func _script_at(paths: Array) -> GDScript:
	for p in paths:
		if ResourceLoader.exists(p):
			return load(p) as GDScript
	return null


## a file's animation made hers: -> the name to play it by ("" and a problem when it can't be)
func clip_from(path: String) -> String:
	if path == "":
		return ""
	if _files.has(path):
		return _files[path]
	var key := path.get_file().get_basename()
	var anim: Animation
	if path.get_extension().to_lower() == "npz":
		var r := _script_at(RETARGET)
		var nz := _script_at(NPZ)
		var sk := skeleton_of(her)
		if r == null or nz == null:
			problems.append("%s: the Kimodo reader isn't in this project (res://kimodo/: tools/godot_byhand.py install puts it there)" % path.get_file())
		elif sk == null or str(r.call("detect", sk)) == "":
			problems.append("%s: the skeleton isn't one a Kimodo motion can be fitted to (MHR, Mixamo, Godot's humanoid)" % path.get_file())
		elif not FileAccess.file_exists(path):
			problems.append("%s isn't there" % path)
		else:
			var frames: Array = nz.call("joints", nz.call("read", ProjectSettings.globalize_path(path)))
			if frames.is_empty():
				problems.append("%s has no motion in it" % path.get_file())
			else:
				anim = r.call("animation", frames, sk, her, her, {"fps": 30.0, "in_place": true, "loop": false})
	else:
		var res = load(path) if ResourceLoader.exists(path) else null
		if res is Animation:
			anim = res
		elif res is AnimationLibrary and not (res as AnimationLibrary).get_animation_list().is_empty():
			anim = (res as AnimationLibrary).get_animation((res as AnimationLibrary).get_animation_list()[0])
		else:
			problems.append("%s isn't an animation" % path)
	if anim == null:
		_files[path] = ""
		return ""
	if _own == null or not is_instance_valid(_own):
		_own = AnimationPlayer.new()
		_own.name = "_MarkerClips"
		her.add_child(_own)
		_own.root_node = _own.get_path_to(her)
		_own.add_animation_library("files", AnimationLibrary.new())
		_players.append(_own)
	var lib := _own.get_animation_library("files")
	if lib.has_animation(key):
		lib.remove_animation(key)
	lib.add_animation(key, anim)
	_files[path] = key
	return key


# ---- what she can be asked --------------------------------------------------------------------------------------------------
## put somewhere, standing, at once
func place(pos: Vector3, yaw: float) -> void:
	_clear()
	posture = "standing"
	side = ""
	lift = 0.0
	if her != null:
		her.global_position = Vector3(pos.x, floor_y(pos, pos.y), pos.z)
		her.global_rotation = Vector3(0, yaw, 0)
	_hold(0.0)


## not drawn, not animated, not processed, her colliders out of the physics: she still exists
func hide_now() -> void:
	if her == null or hidden:
		return
	hidden = true
	if not bool(set["preview"]):
		_mode_was = her.process_mode
		her.process_mode = Node.PROCESS_MODE_DISABLED
	her.visible = false


func show_now() -> void:
	if her == null:
		return
	var react := react_of(her)
	if react != null and bool(react.get("is_down")) and react.has_method("restore"):
		react.restore()
	if hidden and not bool(set["preview"]):
		her.process_mode = _mode_was
	hidden = false
	her.visible = true
	if her.has_meta("hs_hidden"):
		her.remove_meta("hs_hidden")
	_playing = ""
	_hold(0.0)


## the weapons plugin's hit reaction under her (anything with hit and down signals), or nothing
static func react_of(node: Node) -> Node:
	if node == null:
		return null
	for c in node.get_children():
		if c.has_signal("down") and c.has_signal("hit"):
			return c
	return null


## along a path (points a step apart, the first where she is), at `speed` m/s; `yaw`: the way she ends up facing
## (null: the way she came); `run`: with her run; `floor`: her height from the floor under the path
func walk(points: PackedVector3Array, speed: float, run := false, yaw = null, floor := true, blend := 0.25) -> void:
	if points.size() < 2 or HSNpcFlow.length(points) < 0.03:
		if yaw != null:
			_begin([{"k": "turn", "yaw": float(yaw)}])
		else:
			_begin([])
		return
	var step := _path_step(points, speed, run, floor, blend)
	var steps: Array = [step]
	if yaw != null:
		steps.append({"k": "turn", "yaw": float(yaw)})
	_begin(steps)


## after someone who moves (`where`: a Callable giving their place), until `stop` metres from them
func follow(where: Callable, speed: float, run := false, stop := 0.8, blend := 0.25) -> void:
	_begin([{"k": "follow", "to": where, "v": speed, "run": run, "stop": stop, "blend": blend}])


func turn_to(yaw: float) -> void:
	_begin([{"k": "turn", "yaw": yaw}])


## the loop she stands in from now on ("": her idle), and how fast it plays
func stand(clip := "", rate := 1.0, blend := 0.25) -> void:
	hold_clip = clip
	hold_rate = rate
	_begin([{"k": "blend", "s": blend}])


## sit: `seat` the seat's front edge at the height she sits at, `front` the way she faces sat
func sit(seat: Vector3, front: Vector3, blend := 0.25) -> void:
	var m: Dictionary = clip_info("sit_down").get("seat", {})
	var yaw := atan2(front.x, front.z)
	var stand_at := seat - front * float(m.get("edge", HSNpcFlow.SEAT_EDGE))
	var up := clampf((seat.y - ground()) - float(m.get("height", 0.45)), -0.12, 0.12)
	_begin(_go(stand_at, yaw) + [{"k": "clip", "clip": "sit_down", "lift": up, "blend": blend, "to": {"posture": "sitting"}}])


## lie down: `bed` its edge at the mattress's height, `front` pointing away from the bed; right: her head to her right
func lie(bed: Vector3, front: Vector3, right := false, blend := 0.25) -> void:
	var sd := "_r" if right else ""
	var m: Dictionary = clip_info("lie_down" + sd).get("bed", {})
	var yaw := atan2(front.x, front.z)
	var stand_at := bed - front * float(m.get("edge", HSNpcFlow.SEAT_EDGE))
	var up := clampf((bed.y - ground()) - float(m.get("height", 0.45)), -0.12, 0.12)
	_begin(_go(stand_at, yaw) + [{"k": "clip", "clip": "lie_down" + sd, "lift": up, "blend": blend, "to": {"posture": "lying", "side": sd}}])


## up again (sat or asleep); nothing when she's standing
func rise() -> void:
	_begin([])


## a hand put out to a point, facing `yaw`, and back: `clip` the reach played (the runner picks it by how high the
## point is: flow.gd reach_of), `flat` where her hand is in it from where she stands; thing: taken as her hand closes
## (keep: it stays in her hand); put: what she holds is left there; rate: how fast the clip plays
func reach(at: Vector3, yaw: float, clip: String, flat: Vector3, thing: Node3D = null, keep := true, put := false, rate := 1.0, blend := 0.25) -> void:
	var stand_at := at - HSNpcFlow.turned(Vector3(flat.x, 0, flat.z), yaw)
	var left := clip.ends_with("_l")
	var on := {}
	if thing != null:
		on["grab"] = func(): _take(thing, left)
		on["put_away"] = func(): _put_away(keep)
	elif put:
		on["grab"] = func(): put_down(at)
	_begin(_go(stand_at, yaw) + [{"k": "clip", "clip": clip, "on": on, "rate": rate, "blend": blend}])


## a door opened: a hand to its handle at `at`, facing `yaw` (into the door), by the clip `clip`, `flat` where the
## handle is in it; the door's own use() as her hand moves it
func open(at: Vector3, yaw: float, clip: String, flat: Vector3, door: Node, rate := 1.0, blend := 0.25) -> void:
	var stand_at := at - HSNpcFlow.turned(Vector3(flat.x, 0, flat.z), yaw)
	_begin(_go(stand_at, yaw) + [{"k": "clip", "clip": clip, "on": {"open": func(): _use(door)}, "rate": rate, "blend": blend}])


## any clip by name (one of hers, or one made hers by clip_from), `times` times
func play(clip: String, times := 1, rate := 1.0, blend := 0.25) -> void:
	_begin([{"k": "clip", "clip": clip, "times": maxi(times, 1), "rate": rate, "blend": blend, "own": true}])


## what she was doing dropped where it is
func interrupt() -> void:
	if not _step.is_empty() and String(_step.get("k", "")) == "clip" and _step.has("to"):
		_apply_state(_step["to"])                          # (half way into a chair: she's sat)
		if _step.has("lift"):
			_set_lift(float(_step["lift"]))
	_clear()
	_hold(0.2)


func _clear() -> void:
	_queue = []
	_step = {}
	busy = false
	waited = 0.0


## whatever she holds left where it is (or at a place)
func put_down(at = null) -> void:
	if is_instance_valid(held) and not bool(set["preview"]):
		var to: Node = her.get_parent() if her != null else null
		if to != null:
			held.reparent(to, true)
		if at is Vector3:
			held.global_position = at
		held.visible = true
		for c in held.find_children("*", "CollisionObject3D", true, false):
			(c as CollisionObject3D).process_mode = Node.PROCESS_MODE_INHERIT
		if held is RigidBody3D:
			(held as RigidBody3D).freeze = false
	held = null


# ---- how ------------------------------------------------------------------------------------------------------------------
## the height of the floor she stands on
func ground() -> float:
	return her.global_position.y - lift if her != null else 0.0


# the last step to where she sits, lies down or puts a hand out: straight there at the height she's at (a seat's own
# top isn't a floor to climb), then turned
func _go(to: Vector3, yaw: float) -> Array:
	if her == null:
		return []
	var from := her.global_position
	var flat := Vector2(to.x - from.x, to.z - from.z).length()
	var steps: Array = []
	if flat > 0.04:
		var pts := HSNpcFlow.sampled(PackedVector3Array([Vector3(from.x, ground(), from.z), Vector3(to.x, ground(), to.z)]), false)
		steps.append(_path_step(pts, pace(false), false, false, 0.25))
	steps.append({"k": "turn", "yaw": yaw})
	return steps


func _path_step(points: PackedVector3Array, speed: float, run: bool, floor: bool, blend: float) -> Dictionary:
	var acc := PackedFloat32Array([0.0])
	for i in points.size() - 1:
		acc.append(acc[i] + points[i].distance_to(points[i + 1]))
	return {"k": "path", "pts": points, "acc": acc, "len": acc[acc.size() - 1], "s": 0.0, "i": 0, "v": speed, "run": run, "floor": floor, "blend": blend}


func _at(step: Dictionary, s: float) -> Vector3:
	var pts: PackedVector3Array = step["pts"]
	var acc: PackedFloat32Array = step["acc"]
	var i := int(step["i"])
	while i < acc.size() - 2 and acc[i + 1] < s:
		i += 1
	while i > 0 and acc[i] > s:
		i -= 1
	step["i"] = i
	var seg := acc[i + 1] - acc[i]
	return pts[i].lerp(pts[i + 1], clampf((s - acc[i]) / seg, 0.0, 1.0) if seg > 1e-6 else 0.0)


## the floor's height under a point, looked for from just over `near` to just under it (so on two storeys it's the
## floor the path lies on); `near` itself when there's nothing
func floor_y(p: Vector3, near: float) -> float:
	if her == null or int(set["floor_mask"]) == 0 or not her.is_inside_tree():
		return near
	var w := her.get_world_3d()
	var space := w.direct_space_state if w != null else null
	if space == null:
		return near
	var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, near + 0.9, p.z), Vector3(p.x, near - 1.3, p.z), int(set["floor_mask"]))
	q.exclude = skip
	var hit := space.intersect_ray(q)
	return float(hit["position"].y) if not hit.is_empty() else near


func _apply_state(st: Dictionary) -> void:
	if st.has("posture"):
		posture = String(st["posture"])
	if st.has("side"):
		side = String(st["side"])


func _set_lift(v: float) -> void:
	if her != null:
		her.global_position.y += v - lift
	lift = v


# what's asked takes the place of what she was doing; sat or asleep, she gets up first
func _begin(steps: Array) -> void:
	if her == null:
		return
	if not _step.is_empty() and String(_step.get("k", "")) == "clip" and _step.has("to"):
		_apply_state(_step["to"])
		if _step.has("lift"):
			_set_lift(float(_step["lift"]))
	var pre: Array = []
	if posture == "lying":
		pre.append({"k": "clip", "clip": "get_up" + side, "lift": 0.0, "to": {"posture": "standing", "side": ""}})
	elif posture == "sitting":
		pre.append({"k": "clip", "clip": "stand_up", "lift": 0.0, "to": {"posture": "standing"}})
	_queue = pre + steps
	_step = {}
	busy = not _queue.is_empty()
	released = false
	if busy:
		_next()
	else:
		_hold(0.25)


func _next() -> void:
	while true:
		if _queue.is_empty():
			_step = {}
			busy = false
			_hold(0.25)
			return
		_step = _queue.pop_front()
		_t = 0.0
		_fired = 0
		waited = 0.0
		match String(_step["k"]):
			"blend":
				_hold(float(_step["s"]))
				continue
			"clip":
				var n := String(_step["clip"])
				_lift_from = lift
				var secs := _play(n, false, float(_step.get("rate", 1.0)), float(_step.get("blend", 0.25)), true)
				if secs <= 0.0:                                # (she has no such clip: the act still happens, without the motion)
					for k in (_step.get("on", {}) as Dictionary):
						(_step["on"][k] as Callable).call()
					if _step.has("lift"):
						_set_lift(float(_step["lift"]))
					if _step.has("to"):
						_apply_state(_step["to"])
					if bool(_step.get("own", false)) and not (("no animation called '%s'" % n) in problems):
						problems.append("no animation called '%s'" % n)
					continue
				_step["secs"] = float(clip_info(n).get("secs", secs)) / maxf(float(_step.get("rate", 1.0)), 0.05)
				_step["left"] = int(_step.get("times", 1)) - 1
				now = n
				return
			"path":
				travelled = 0.0
				return
			_:
				return


# what she holds when nothing's asked of her
func _hold(blend: float) -> void:
	if her == null or hidden or released:
		return
	var n := "idle_loop"
	var rate := 1.0
	match posture:
		"sitting":
			n = "sit_loop"
		"lying":
			n = "sleep%s_loop" % side
		_:
			if hold_clip != "":
				n = hold_clip
				rate = hold_rate
	if _play(n, true, rate, blend) <= 0.0 and n != "idle_loop" and posture == "standing":
		_play("idle_loop", true, 1.0, blend)
	now = "idle" if n == "idle_loop" else n


## every frame (the runner's): `dt` seconds on
func tick(dt: float) -> void:
	if her == null or not is_instance_valid(her) or hidden or released:
		return
	if _step.is_empty():
		if _player != null and is_instance_valid(_player) and not _player.is_playing():
			_playing = ""
			_hold(0.1)
		return
	match String(_step["k"]):
		"path":
			_tick_path(dt)
		"follow":
			_tick_follow(dt)
		"turn":
			var want: float = _step["yaw"]
			her.global_rotation.y = rotate_toward(her.global_rotation.y, want, deg_to_rad(float(set["turn_degrees"])) * dt)
			if posture == "standing":
				_hold(0.2)
			now = "turn"
			if absf(angle_difference(her.global_rotation.y, want)) < 0.01:
				her.global_rotation.y = want
				_next()
		"clip":
			_t += dt
			var secs := float(_step.get("secs", 0.0))
			var n := String(_step["clip"])
			if _step.has("lift") and secs > 0.0:
				_set_lift(lerpf(_lift_from, float(_step["lift"]), smoothstep(0.1, 0.7, _t / secs)))
			_events(n, _t * maxf(float(_step.get("rate", 1.0)), 0.05), false, secs)
			if _t >= secs:
				if int(_step.get("left", 0)) > 0:
					_step["left"] = int(_step["left"]) - 1
					_t = 0.0
					_fired = 0
					_play(n, false, float(_step.get("rate", 1.0)), 0.0, true)
					return
				if _step.has("lift"):
					_set_lift(float(_step["lift"]))
				if _step.has("to"):
					_apply_state(_step["to"])
				_next()


func _tick_path(dt: float) -> void:
	var total := float(_step["len"])
	var s := float(_step["s"])
	var rem := total - s
	if rem <= 0.02:
		var end: Vector3 = (_step["pts"] as PackedVector3Array)[(_step["pts"] as PackedVector3Array).size() - 1]
		her.global_position = Vector3(end.x, (floor_y(end, end.y) if bool(_step["floor"]) else end.y) + lift, end.z)
		_next()
		return
	_t += dt
	var ahead := _at(_step, minf(s + 0.25, total))
	var here := _at(_step, s)
	var dir := ahead - here
	dir.y = 0.0
	var yaw := her.global_rotation.y
	var off := 0.0
	if dir.length() > 0.001:
		var want := atan2(dir.x, dir.z)
		off = absf(angle_difference(yaw, want))
		her.global_rotation.y = rotate_toward(yaw, want, deg_to_rad(float(set["turn_degrees"])) * dt)
	var v := float(_step["v"])
	v *= clampf(_t / 0.3, 0.25, 1.0) * clampf(rem / 0.3, 0.35, 1.0) * (1.0 if off < 0.9 else 0.3)    # eased in, eased out, slower while she's still turning onto it
	var run := bool(_step["run"]) and has_clip("run_loop")
	if not run and v > 0.5 * (speed_of(false) + speed_of(true)) and has_clip("run_loop"):
		run = true                                             # (a walk asked to go at a run's pace runs)
	var np := _at(_step, minf(s + v * dt, total))
	if bool(set["waits"]) and avoid != Vector3.INF:
		var to_you := avoid - her.global_position
		var blocked := Vector2(np.x - avoid.x, np.z - avoid.z).length() < 0.55 and absf(to_you.y) < 1.3 and Vector2(to_you.x, to_you.z).dot(Vector2(dir.x, dir.z)) > 0.0
		if blocked and waited < 2.5:
			waited += dt                                       # you're in her way: she waits a moment for you to move, then passes
			_hold(0.2)
			now = "wait"
			return
		if not blocked:
			waited = maxf(0.0, waited - dt)
	s = minf(s + v * dt, total)
	travelled += v * dt
	_step["s"] = s
	var y := np.y
	if bool(_step["floor"]):
		var fy := floor_y(np, np.y)
		if dir.length() > 0.001:                               # the highest floor a little ahead of her and a little behind: up a stair she
			var a := dir.normalized() * 0.16                   # rises before each riser, down it she comes off each step late, never inside one
			fy = maxf(fy, maxf(floor_y(np + a, np.y), floor_y(np - a, np.y)))
		var cur := her.global_position.y - lift
		y = fy if absf(fy - cur) > 0.6 else lerpf(cur, fy, 1.0 - exp(-11.0 * dt))      # (eased: she glides over the risers)
	her.global_position = Vector3(np.x, y + lift, np.z)
	var clip := "run_loop" if run else "walk_loop"
	_play(clip, true, clampf(v / speed_of(run), 0.4, 2.2), float(_step["blend"]))
	now = "run" if run else "walk"
	_events(clip, _player.current_animation_position if _player != null else 0.0, true, 0.0)


func _tick_follow(dt: float) -> void:
	var where: Callable = _step["to"]
	var to = where.call() if where.is_valid() else null
	if not (to is Vector3):
		_next()
		return
	var d: Vector3 = (to as Vector3) - her.global_position
	d.y = 0.0
	var dist := d.length()
	if dist <= float(_step["stop"]):
		_next()
		return
	_t += dt
	var want := atan2(d.x, d.z)
	var off := absf(angle_difference(her.global_rotation.y, want))
	her.global_rotation.y = rotate_toward(her.global_rotation.y, want, deg_to_rad(float(set["turn_degrees"])) * dt)
	var v := float(_step["v"]) * clampf(_t / 0.3, 0.25, 1.0) * (1.0 if off < 0.9 else 0.3)
	var np := her.global_position + d.normalized() * minf(v * dt, dist - float(_step["stop"]) + 0.01)
	var cur := her.global_position.y - lift
	var fy := floor_y(np, cur)
	np.y = (fy if absf(fy - cur) > 0.6 else lerpf(cur, fy, 1.0 - exp(-14.0 * dt))) + lift
	her.global_position = np
	var run := bool(_step["run"]) and has_clip("run_loop")
	var clip := "run_loop" if run else "walk_loop"
	_play(clip, true, clampf(v / speed_of(run), 0.4, 2.2), float(_step["blend"]))
	now = "run" if run else "walk"
	_events(clip, _player.current_animation_position if _player != null else 0.0, true, 0.0)


# a clip's own moments, as its time passes them; a clip with none of its own: what's waiting on it happens half way
func _events(n: String, t: float, looped: bool, secs: float) -> void:
	var evs: Array = clip_info(n).get("events", [])
	if evs.is_empty():
		if not looped and _fired == 0 and secs > 0.0 and _t >= secs * 0.5:
			_fired = 1
			for k in (_step.get("on", {}) as Dictionary):
				(_step["on"][k] as Callable).call()
		return
	if looped:
		var i := 0
		for e in evs:
			if t >= float(e["t"]):
				i += 1
		if i != _fired:
			if i > 0 and on_event.is_valid():
				on_event.call(String(evs[i - 1]["name"]))
			_fired = i
		return
	while _fired < evs.size() and t >= float(evs[_fired]["t"]):
		var nm := String(evs[_fired]["name"])
		_fired += 1
		if on_event.is_valid():
			on_event.call(nm)
		var on: Dictionary = _step.get("on", {})
		if on.has(nm):
			(on[nm] as Callable).call()


func _take(thing: Node3D, left: bool) -> void:
	if not is_instance_valid(thing) or her == null or bool(set["preview"]):      # (the tester never moves a thing of the scene's)
		return
	var sk := skeleton_of(her)
	if sk == null:
		thing.visible = false
		held = thing
		return
	var bone := ""
	for cand in HANDS[left]:
		if sk.find_bone(cand) >= 0:
			bone = cand
			break
	if bone == "":
		thing.visible = false
		held = thing
		return
	var att := sk.get_node_or_null("Hold_" + bone.validate_node_name()) as BoneAttachment3D
	if att == null:
		att = BoneAttachment3D.new()
		att.name = "Hold_" + bone.validate_node_name()
		sk.add_child(att)
		att.bone_name = bone
	for c in thing.find_children("*", "CollisionObject3D", true, false):       # (in her hand it's nothing to bump into)
		(c as CollisionObject3D).process_mode = Node.PROCESS_MODE_DISABLED
	if thing is RigidBody3D:
		(thing as RigidBody3D).freeze = true
	thing.reparent(att, true)
	var palm: Array = (record.get("palm", {}) as Dictionary).get("l" if left else "r", [0.0, -0.07, 0.03]) if record.get("palm") is Dictionary else [0.0, -0.07, 0.03]
	thing.position = Vector3(palm[0], palm[1], palm[2])
	held = thing


func _put_away(keep: bool) -> void:
	if keep or not is_instance_valid(held):
		return
	held.visible = false
	held = null


func _use(door: Node) -> void:
	if door == null or bool(set["preview"]):
		return
	if door.has_method("use"):
		door.use(her)
	elif door.has_method("fire"):
		door.fire()
	elif door.has_method("open"):
		door.open()


# ---- put straight into a state (the tester's start, a checkpoint) -----------------------------------------------------------
## sat at a seat at once
func sit_now(seat: Vector3, front: Vector3) -> void:
	var m: Dictionary = clip_info("sit_down").get("seat", {})
	var stand_at := seat - front * float(m.get("edge", HSNpcFlow.SEAT_EDGE))
	_place_under(stand_at, seat.y, float(m.get("height", 0.45)), atan2(front.x, front.z))
	posture = "sitting"
	_hold(0.0)


func lie_now(bed: Vector3, front: Vector3, right := false) -> void:
	var sd := "_r" if right else ""
	var m: Dictionary = clip_info("lie_down" + sd).get("bed", {})
	var stand_at := bed - front * float(m.get("edge", HSNpcFlow.SEAT_EDGE))
	_place_under(stand_at, bed.y, float(m.get("height", 0.45)), atan2(front.x, front.z))
	posture = "lying"
	side = sd
	_hold(0.0)


# stood in front of a seat at `top`: on the floor under it (looked for from under the seat's top, so the seat itself
# isn't taken for the floor), raised or lowered to meet it
func _place_under(at: Vector3, top: float, made_for: float, yaw: float) -> void:
	_clear()
	posture = "standing"
	side = ""
	lift = 0.0
	var fl := floor_y(at, top - 1.1)
	if absf(fl - (top - 1.1)) < 0.0005:
		fl = top - made_for
	her.global_position = Vector3(at.x, fl, at.z)
	her.global_rotation = Vector3(0, yaw, 0)
	_set_lift(clampf((top - fl) - made_for, -0.12, 0.12))


## what she is, to keep at a checkpoint
func snapshot() -> Dictionary:
	return {"pos": her.global_position if her != null else Vector3.ZERO, "yaw": her.global_rotation.y if her != null else 0.0, "posture": posture, "side": side,
		"lift": lift, "hidden": hidden, "hold_clip": hold_clip, "hold_rate": hold_rate, "released": released}


func restore(d: Dictionary) -> void:
	if her == null or d.is_empty():
		return
	_clear()
	if bool(d.get("hidden", false)):
		hide_now()
	else:
		show_now()
	her.global_position = d.get("pos", her.global_position)
	her.global_rotation = Vector3(0, float(d.get("yaw", 0.0)), 0)
	posture = String(d.get("posture", "standing"))
	side = String(d.get("side", ""))
	lift = float(d.get("lift", 0.0))
	hold_clip = String(d.get("hold_clip", ""))
	hold_rate = float(d.get("hold_rate", 1.0))
	released = bool(d.get("released", false))
	_playing = ""
	_hold(0.0)


func report() -> Dictionary:
	return {"now": now, "busy": busy, "posture": posture, "hidden": hidden, "baked": not record.is_empty(), "clips": names.keys(), "problems": problems,
		"walk": pace(false), "run": pace(true), "playing": _playing, "held": String(held.name) if is_instance_valid(held) else ""}
