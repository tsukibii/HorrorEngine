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
## the low ways of going (animations v3, docs/ANIMATOR_V3.md): its loop, the loop she rests in after, and how fast when her record doesn't say
const LOW := {"sneak": ["sneak_loop", "crouch_loop", 0.42], "crawl": ["crawl_loop", "crawl_idle_loop", 0.38], "creep": ["creep_loop", "creep_idle_loop", 0.53], "scuttle": ["scuttle_loop", "crawl_idle_loop", 1.2]}
const LOOK := "res://addons/horrorstudio_look/"       # the look plugin's head tracker, hands' IK and grips, used when the project has them (never by class name)
const RETARGET := ["res://kimodo/retarget.gd", "res://addons/horrorstudio_director/kimodo/retarget.gd"]
const NPZ := ["res://kimodo/npz.gd", "res://addons/horrorstudio_director/kimodo/npz.gd"]
const GUESS := {                           # an unbaked model's clips, found by what their names hold
	"idle_loop": ["idle", "breath", "stand"], "walk_loop": ["walk"], "run_loop": ["run", "jog", "sprint"],
	"sit_down": ["sit_down", "sitdown", "sitting_down", "sit down"], "sit_loop": ["sit_loop", "sit_idle", "sitting", "seated"],
	"stand_up": ["stand_up", "standup", "standing_up", "stand up"],
	"lie_down": ["lie_down", "liedown", "lay_down"], "sleep_loop": ["sleep", "lying"], "get_up": ["get_up", "getup", "wake"],
}
const HEADS := ["c_head", "head", "Head", "mixamorig_Head", "mixamorig:Head"]
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
var on_struck := Callable()                ## (target, kind): a blow of hers landed
var held_side := "r"
var held_rest := Basis.IDENTITY            ## how what she holds stood before she took it (it's put down that way up)
var held_grip := {}                        ## how what she holds is held (the look plugin's HSGrip.grip_of)
var hit_m := 0.3                           ## how near her fist, or what she swings, has to get to land
var short_of_you := 0.16                   ## how far short of the player's eye a blow stops
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
var _ik: Node                              # her hands' IK (the look plugin's HSHandIK)
var _gesture: Node                         # what lays her flourishes and her carry poses over her clips (the look plugin's HSGesture)
var carry_how := ""                        ## how what she keeps in her hand is carried: side, front, chest, shoulder, raised; "": as its grip says
const HANDS_OFF := ["peek", "scare_", "cower", "lie_down", "get_up", "sleep", "hit_react", "reach_low", "sit_down", "stand_up"]   # clips that want both her hands: what she carries goes where the clip has her hand, for as long
const ONE_HAND := ["reach_", "open_", "punch", "swing", "eat", "drink", "knock"]   # clips that want one: their own (the left when the clip's name ends _l)


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


## how fast a low way of going travels as it was made ("sneak", "crawl", "creep", "scuttle"); a walk's or a run's for those
func gait_pace(gait: String) -> float:
	if not LOW.has(gait):
		return pace(gait == "run")
	var s := float(clip_info(String(LOW[gait][0])).get("speed", 0.0))
	return s if s > 0.05 else float(LOW[gait][2])


# a script of the look plugin's, when the project has it
static func look_script(file: String) -> GDScript:
	return load(LOOK + file) as GDScript if ResourceLoader.exists(LOOK + file) else null


## where her head is now (its bone, after her clip), or null when her model has no skeleton or no head bone by a
## name this knows
func head_point():
	var sk := skeleton_of(her) if her != null else null
	if sk == null:
		return null
	for cand in HEADS:
		var b := sk.find_bone(cand)
		if b >= 0:
			return sk.global_transform * sk.get_bone_global_pose(b).origin
	return null


## her hands' IK (the look plugin's HSHandIK), or null: without it a clip plays as it was made
func ik() -> Node:
	if not is_instance_valid(_ik):
		var cls := look_script("hand_ik.gd")
		_ik = cls.attach(her) if cls != null and her != null else null
	return _ik


## what lays her flourishes and her carry poses over her clips (the look plugin's HSGesture), or null: without the
## plugin, or on the tester's copy of her, her clips play as they are
func gesture() -> Node:
	if not is_instance_valid(_gesture):
		var cls := look_script("gesture.gd")
		_gesture = cls.attach(her) if cls != null and her != null and not bool(set["preview"]) else null
		if _gesture != null:
			ik()                                               # (a hand that touches her is put on her by her hands' IK)
			_gesture.doing = _doing()
	return _gesture


## small movements now and then, laid over whatever she's doing (standing, walking, sitting): a scratch, a look at
## what she holds, a stretch. `every`: seconds between them, from and to. -> the layer, or null (no look plugin; a
## character baked before the Animator's life clips has none to play)
func alive(on: bool, every := Vector2(6.0, 14.0)) -> Node:
	var g: Node = gesture() if on else (_gesture if is_instance_valid(_gesture) else null)
	if g == null:
		return null
	g.every = every
	g.alive = on
	if not on and String(g.now) != "":
		g.stop(0.2)
	return g


## one small movement now: "scratch_head", "look_hand", "stretch"... ("": one that suits what she's doing). False
## when she can't just now
func flourish(what := "", left := false) -> bool:
	var g := gesture()
	if g == null:
		return false
	var n: String = what if what != "" else String(g.pick())
	return n != "" and bool(g.play(n, {"left": left}))


# what she's doing, in the layer's words: a flourish is laid over standing, walking and sitting, and nothing else
func _doing() -> String:
	if her == null or hidden or released or posture == "lying":
		return "busy"
	if not _step.is_empty():
		return "walk" if String(_step["k"]) in ["path", "follow"] and now == "walk" else "busy"   # (a run, a sneak, a crawl: her arms are the gait's)
	if posture == "sitting":
		return "sit"
	return "stand" if hold_clip == "" and now == "idle" else "busy"


## every frame, whatever else happens (the runner's): the layer told what she's doing, and a hand an act needs taken
## back from the carry and given back after. `quiet`: nothing of hers now (she's down)
func layer_tick(quiet := false) -> void:
	if not is_instance_valid(_gesture):
		return
	var d := "busy" if quiet else _doing()
	_gesture.doing = d
	if d == "busy" and String(_gesture.now) != "":
		_gesture.stop(0.15)
	for s in ["l", "r"]:
		if String(_gesture.carrying(s)) == "":
			continue
		var off := quiet or posture in ["lying", "peeking"] or hidden
		if not _step.is_empty() and String(_step["k"]) == "clip":
			var cn := String(_step["clip"])
			for w in HANDS_OFF:
				off = off or cn.begins_with(w)
			for w in ONE_HAND:
				off = off or (cn.begins_with(w) and ("l" if cn.ends_with("_l") else "r") == s)
			if _step.has("bring") and String(_step["bring"]["side"]) == s:
				off = true
		if now in ["crawl", "scuttle"] or hold_clip == "crawl_idle_loop":
			off = true
		_gesture.carry_pause(s, off)


# what she keeps in her hand carried from now on, whatever she does: as `carry_how` says, else as its grip does
func _carry_start() -> void:
	if not is_instance_valid(held) or held_grip.is_empty():
		return
	var g := gesture()
	var gcls := look_script("grip.gd")
	if g == null or gcls == null:
		return
	var by: Array = gcls.carry_of(held_grip)
	g.carry(held_side, carry_how if carry_how != "" else String(by[0]), {"thing": held, "upright": bool(by[1])})


## her head follows someone (the look plugin's HSHeadTrack): on or off, who (a node; null: the player), within how
## many degrees (half to each side of straight ahead). -> the tracker, or null without the plugin
func head(on: bool, target: Node3D = null, range_degrees := 160.0) -> Node:
	var cls := look_script("head_track.gd")
	var t: Node = cls.attach(her) if cls != null and her != null else null
	if t == null:
		return null
	t.range_degrees = range_degrees
	t.follow = on
	if target != null:
		t.look_at_node(target)
	else:
		t.follow_player()
	return t


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
func walk(points: PackedVector3Array, speed: float, run := false, yaw = null, floor := true, blend := 0.25, gait := "") -> void:
	_rest_for(gait)
	if points.size() < 2 or HSNpcFlow.length(points) < 0.03:
		if yaw != null:
			_begin([{"k": "turn", "yaw": float(yaw)}])
		else:
			_begin([])
		return
	var step := _path_step(points, speed, run, floor, blend)
	step["gait"] = gait
	var steps: Array = [step]
	if yaw != null:
		steps.append({"k": "turn", "yaw": float(yaw)})
	_begin(steps)


## after someone who moves (`where`: a Callable giving their place), until `stop` metres from them
func follow(where: Callable, speed: float, run := false, stop := 0.8, blend := 0.25, gait := "") -> void:
	_rest_for(gait)
	_begin([{"k": "follow", "to": where, "v": speed, "run": run, "stop": stop, "blend": blend, "gait": gait}])


## she's resting low (crouched, on all fours, hunched): what a low way of going left her in
func is_low() -> bool:
	return hold_clip in ["crouch_loop", "crawl_idle_loop", "creep_idle_loop"]


# what she rests in after going somewhere: low after a low way of going, standing after a walk
func _rest_for(gait: String) -> void:
	if LOW.has(gait):
		hold_clip = String(LOW[gait][1]) if has_clip(String(LOW[gait][1])) else ""
		hold_rate = 1.0
	elif hold_clip in ["crouch_loop", "crawl_idle_loop", "creep_idle_loop"]:
		hold_clip = ""


# the loop a path or a follow plays: -> [clip, the speed it was made at, what she says she's doing]
func _gait_of(step: Dictionary, v: float) -> Array:
	var g := String(step.get("gait", ""))
	if LOW.has(g) and has_clip(String(LOW[g][0])):
		return [String(LOW[g][0]), gait_pace(g), g]
	var run := bool(step["run"]) and has_clip("run_loop")
	if not run and v > 0.5 * (speed_of(false) + speed_of(true)) and has_clip("run_loop"):
		run = true                                             # (a walk asked to go at a run's pace runs)
	return ["run_loop" if run else "walk_loop", speed_of(run), "run" if run else "walk"]


func turn_to(yaw: float) -> void:
	_begin([{"k": "turn", "yaw": yaw}])


## the loop she stands in from now on ("": her idle), and how fast it plays
func stand(clip := "", rate := 1.0, blend := 0.25) -> void:
	hold_clip = clip
	hold_rate = rate
	_begin([{"k": "blend", "s": blend}])


## how far up she can be put onto a seat or a bed higher than her clip was made for: 12 cm when the clip sits her
## with her feet on the floor; 30 cm when it was made for a seat that's high for her (a child's, a goblin's: `high` in
## the clip's record, the Animator's furniture), since her legs hang from it anyway
static func most_lift(m: Dictionary) -> float:
	return 0.3 if bool(m.get("high", false)) else 0.12


## sit: `seat` the seat's front edge at the height she sits at, `front` the way she faces sat
func sit(seat: Vector3, front: Vector3, blend := 0.25) -> void:
	var m: Dictionary = clip_info("sit_down").get("seat", {})
	var yaw := atan2(front.x, front.z)
	var stand_at := seat - front * float(m.get("edge", HSNpcFlow.SEAT_EDGE))
	var up := clampf((seat.y - ground()) - float(m.get("height", 0.45)), -0.12, most_lift(m))
	_begin(_go(stand_at, yaw) + [{"k": "clip", "clip": "sit_down", "lift": up, "blend": blend, "to": {"posture": "sitting"}}])


## lie down: `bed` its edge at the mattress's height, `front` pointing away from the bed; right: her head to her right
func lie(bed: Vector3, front: Vector3, right := false, blend := 0.25) -> void:
	var sd := "_r" if right else ""
	var m: Dictionary = clip_info("lie_down" + sd).get("bed", {})
	var yaw := atan2(front.x, front.z)
	var stand_at := bed - front * float(m.get("edge", HSNpcFlow.SEAT_EDGE))
	var up := clampf((bed.y - ground()) - float(m.get("height", 0.45)), -0.12, most_lift(m))
	_begin(_go(stand_at, yaw) + [{"k": "clip", "clip": "lie_down" + sd, "lift": up, "blend": blend, "to": {"posture": "lying", "side": sd}}])


## up again (sat or asleep); nothing when she's standing
func rise() -> void:
	_begin([])


## out past the end of a wall, and held there (docs/MARKERS.md §4, Peek): `corner` the wall's end, `front` the way
## she looks past it; left: out to her left. She stands behind the wall where her clip was made to (its record's
## `edge`), looks out, and stays looking until something else is asked of her: then she draws back first
func peek(corner: Vector3, front: Vector3, left := false, blend := 0.25) -> void:
	var sd := "_l" if left else ""
	var yaw := atan2(front.x, front.z)
	_begin(_go(HSNpcFlow.peek_stand(corner, front, left, record), yaw) + [{"k": "clip", "clip": "peek_out" + sd, "blend": blend, "to": {"posture": "peeking", "side": sd}}])


## a thing changes hands between her and someone (docs/MARKERS.md §4, Take from you and Hand to you): she turns to
## `to` (where they stand) and puts her hand out toward them, stood upright (her push of a door is the arm that does
## it: a hand to a handle, then on out in front of her; a character with no such clip reaches as for a table).
## `on_hand` is called the moment her hand is out: the thing goes from one to the other there. `after`: called when
## her hand is back (what she took is carried, or put away)
func hand_over(to: Vector3, on_hand: Callable, after := Callable(), left := false, rate := 1.0, blend := 0.25) -> void:
	if her == null:
		return
	var tag := "_l" if left else ""
	var clip := "open_push" + tag
	var moment := "release"
	var out_at := Vector3(-0.14, 1.0, 0.6)                     # where the clip's own hand is at that moment, from where she stands
	var info := clip_info(clip)
	if _event_at(clip, moment) >= 0.0:
		var h: Array = info.get("door", {}).get("handle", HSNpcFlow.HANDLE_AT)
		var tr: Array = info.get("door", {}).get("travel", [0.05, -0.02, 0.26])
		out_at = Vector3(float(h[0]) + float(tr[0]), float(h[1]) + float(tr[1]), float(h[2]) + float(tr[2]))
	else:
		clip = "reach_mid" + tag
		moment = "grab"
		var r: Array = clip_info(clip).get("reach", {}).get("at", HSNpcFlow.REACH_AT)
		out_at = Vector3(float(r[0]), float(r[1]), float(r[2]) + 0.15)
	var d := to - her.global_position
	d.y = 0.0
	var yaw := atan2(d.x, d.z) if d.length() > 0.05 else her.global_rotation.y
	var step := {"k": "clip", "clip": clip, "on": {moment: on_hand}, "rate": rate, "blend": blend}
	var t := _event_at(clip, moment)
	if t >= 0.0:                                               # her palm carried out toward them: a forearm's length in front of her and never into them, at the height of her lower chest
		var tall := float((record.get("body", {}) as Dictionary).get("height", 163.0)) / 100.0 if record.get("body") is Dictionary else 1.63
		var ahead := clampf(d.length() - 0.38, 0.25, absf(out_at.z) + 0.05)
		var pt := Vector3(her.global_position.x, ground() + 0.68 * tall, her.global_position.z) + HSNpcFlow.turned(Vector3(out_at.x * 0.5, 0, ahead), yaw)
		step["bring"] = {"what": "palm", "side": "l" if left else "r", "target": pt, "peak": t, "rise": 0.45, "hold": 0.3, "fall": 0.4, "most": 0.4}
	var steps: Array = [{"k": "turn", "yaw": yaw}, step]
	if after.is_valid():
		steps.append({"k": "call", "f": after})
	_begin(steps)


## a thing put into her hand that wasn't in the scene (what you handed her: a copy of your pocket's model), by its
## grip; `keep`: carried from now on (off: put away when her hand comes back)
func take_given(thing: Node3D, left := false) -> void:
	if thing == null or her == null or bool(set["preview"]):
		return
	_drop_given()                                              # (handed the same thing again after a checkpoint: one in her hand, not two)
	if thing.get_parent() == null:
		(her.get_parent() if her.get_parent() != null else her).add_child(thing)
	var sk := skeleton_of(her)
	if sk != null:
		for cand in HANDS[left]:
			var b := sk.find_bone(cand)
			if b >= 0:
				thing.global_position = sk.global_transform * sk.get_bone_global_pose(b).origin
				break
	_take(thing, left)


## what she holds given away: out of her hand and gone from the scene's sight (it's in someone's pocket now). -> it
func give_held() -> Node3D:
	var t := held if is_instance_valid(held) else null
	if t != null:
		t.visible = false
		_let_go()
	held = null
	return t


# a thing that was handed to her while the game ran (not the scene's), out of her hand and gone
func _drop_given() -> void:
	if is_instance_valid(held) and held.has_meta("hs_given"):
		var t := held
		_let_go()
		held = null
		t.queue_free()


## a thing's meshes as a model for a pocket's slot (the starter's pickup.gd makes the same): no script, no collider
static func model_of(thing: Node3D) -> Node3D:
	if thing == null:
		return null
	var g := Node3D.new()
	g.name = "copy_" + str(thing.name)
	var inv := thing.global_transform.affine_inverse()
	for mi in thing.find_children("*", "MeshInstance3D", true, false) + ([thing] if thing is MeshInstance3D else []):
		var src := mi as MeshInstance3D
		if src.mesh == null:
			continue
		var c := MeshInstance3D.new()
		c.mesh = src.mesh
		c.material_override = src.material_override
		for i in src.get_surface_override_material_count():
			c.set_surface_override_material(i, src.get_surface_override_material(i))
		c.transform = inv * src.global_transform if src.is_inside_tree() and thing.is_inside_tree() else (Transform3D.IDENTITY if src == thing else src.transform)
		g.add_child(c)
	return g


## a hand put out to a point, facing `yaw`, and back: `clip` the reach played (the runner picks it by how high the
## point is: flow.gd reach_of), `flat` where her hand is in it from where she stands; thing: taken as her hand closes
## (keep: it stays in her hand); put: what she holds is left there; rate: how fast the clip plays
func reach(at: Vector3, yaw: float, clip: String, flat: Vector3, thing: Node3D = null, keep := true, put := false, rate := 1.0, blend := 0.25) -> void:
	var stand_at := at - HSNpcFlow.turned(Vector3(flat.x, 0, flat.z), yaw)
	var left := clip.ends_with("_l")
	_begin(_go(stand_at, yaw) + [_reach_step(at, clip, thing, keep, put, rate, blend)])


func _reach_step(at: Vector3, clip: String, thing: Node3D, keep: bool, put: bool, rate: float, blend: float) -> Dictionary:
	var left := clip.ends_with("_l")
	var on := {}
	var step := {"k": "clip", "clip": clip, "on": on, "rate": rate, "blend": blend}
	if thing != null:
		on["grab"] = func(): _take(thing, left)
		on["put_away"] = func(): _put_away(keep)
		var grab_t := _event_at(clip, "grab")
		if grab_t >= 0.0:                                      # her hand brought the rest of the way onto where the thing is taken
			step["bring"] = {"what": "grip", "side": "l" if left else "r", "thing": thing, "peak": grab_t, "rise": 0.45, "hold": 0.04, "fall": 0.4, "freeze": true, "most": 0.3}
	elif put:
		on["grab"] = func(): put_down(at)
		var down_t := _event_at(clip, "grab")
		if down_t >= 0.0 and is_instance_valid(held):          # what she holds brought the rest of the way to where it's put (a shelf lower than her reach's own)
			step["bring"] = {"what": "held", "side": "l" if left else "r", "target": at, "peak": down_t, "rise": 0.45, "hold": 0.04, "fall": 0.4, "freeze": true, "most": 0.3}
	return step


# when a clip's own moment is, seconds (-1: it has none by that name)
func _event_at(clip: String, name: String) -> float:
	for e in clip_info(clip).get("events", []):
		if String(e["name"]) == name:
			return float(e["t"])
	return -1.0


## she eats ("eat") or drinks from ("drink") something: a thing given is taken first (`at`, `yaw`, `reach_clip`,
## `flat`: as reach), with none it's what she holds. Then it's gone ("gone"), kept ("keep") or let go of ("drop")
func consume(what: String, thing: Node3D, at: Vector3, yaw: float, reach_clip: String, flat: Vector3, left := false, finish := "gone", rate := 1.0, blend := 0.25) -> void:
	var steps: Array = []
	if thing != null and thing != held:
		steps += _go(at - HSNpcFlow.turned(Vector3(flat.x, 0, flat.z), yaw), yaw)
		steps.append(_reach_step(at, reach_clip, thing, true, false, rate, blend))
	var clip := what + ("_l" if left else "")
	var peaks := []
	for e in clip_info(clip).get("events", []):
		if String(e["name"]) in ["bite", "sip"]:
			peaks.append(float(e["t"]) + (0.4 if what == "drink" else 0.0))
	var after := func() -> void:
		if finish == "gone":
			_put_away(false)
		elif finish == "drop":
			put_down()
	var step := {"k": "clip", "clip": clip, "on": {"done": after}, "rate": rate, "blend": blend}
	if not peaks.is_empty():
		step["bring"] = {"what": "mouth", "side": "l" if left else "r", "peaks": peaks, "rise": 0.4, "hold": 0.5 if what == "drink" else 0.14, "fall": 0.35, "most": 0.3}
	_begin(steps + [step])


## where to hit someone: what their aim_point() says, a little under the player's eye and short of it, their upper
## chest, else 1.3 m over where they are
func aim_point(target) -> Vector3:
	if target is Vector3:
		return target
	var n := target as Node3D
	if n == null or not is_instance_valid(n) or her == null:
		return her.global_position + her.global_basis.z if her != null else Vector3.ZERO
	if n.has_method("aim_point"):
		return n.aim_point()
	var cams := n.find_children("*", "Camera3D", true, false)
	if n is Camera3D or not cams.is_empty():
		var cam: Camera3D = n if n is Camera3D else cams[0]
		var back := her.global_position - cam.global_position
		back.y = 0.0
		return cam.global_position + Vector3(0, -0.1, 0) + (back.normalized() * short_of_you if back.length() > 0.01 else Vector3.ZERO)
	for sk in n.find_children("*", "Skeleton3D", true, false):
		for nm in ["c_spine3", "UpperChest", "Chest", "Spine2", "mixamorig_Spine2", "mixamorig:Spine2"]:
			var b := (sk as Skeleton3D).find_bone(nm)
			if b >= 0:
				return (sk as Skeleton3D).global_transform * (sk as Skeleton3D).get_bone_global_pose(b).origin + Vector3(0, 0.08, 0)
	return n.global_position + Vector3(0, 1.3, 0)


## a blow at someone, `times` times: "punch", or "swing" (of what she holds; her fist when she holds nothing). She
## goes to where it reaches them, turns with them until it's thrown, and it's carried the rest of the way onto them
func attack(kind: String, target: Node3D, left := false, times := 1, rate := 1.0, blend := 0.2) -> void:
	var clip := kind + ("_l" if left else "")
	var m: Dictionary = clip_info(clip).get(kind, {}) if clip_info(clip).get(kind) is Dictionary else {}
	var at: Array = m.get("at", [0.0, 1.28, 0.72 if kind == "punch" else 0.5])
	var reach := float(at[2])
	var what := "fist"
	if kind == "swing" and is_instance_valid(held) and not held_grip.is_empty():
		var ax: Array = m.get("axis", [0.0, 0.8, 0.55])
		reach += float(ax[2]) * ((held_grip["tip"] as Vector3) - (held_grip["xform"] as Transform3D).origin).length() * 0.9
		what = "tip"
	var hit_t := _event_at(clip, "hit")
	if hit_t < 0.0:
		hit_t = 0.5
	var side := "l" if left else "r"
	var stand := func():                                       # where the blow reaches them from: nearer for someone above or below her shoulder (her arm is no longer)
		var aim := aim_point(target)
		var away := her.global_position - aim
		away.y = 0.0
		var arm := 0.86 * reach
		var dy := aim.y - (her.global_position.y + float(at[1]))
		var r := 0.97 * (0.14 * reach + sqrt(maxf(0.05 * arm * arm, arm * arm - dy * dy)))
		if away.length() <= r + 0.02:                          # near enough already: she throws it from where she stands (a step away would turn her back on them)
			return her.global_position
		return aim + (away.normalized() if away.length() > 0.01 else -her.global_basis.z) * r
	var steps: Array = []
	for i in maxi(times, 1):
		steps.append({"k": "follow", "to": stand, "v": pace(false), "run": false, "stop": 0.06, "blend": blend, "give_up": 8.0})
		steps.append({"k": "clip", "clip": clip, "rate": rate, "blend": blend, "face": target, "face_until": hit_t - 0.06, "on": {"hit": func(): _land(kind, target, side)},
			"bring": {"what": what, "side": side, "target": func(): return aim_point(target), "peak": hit_t, "rise": 0.22 if kind == "punch" else 0.3, "hold": 0.05, "fall": 0.3, "freeze": true, "most": 0.55}})
	_begin(steps)


# the blow has been thrown: did it get there?
func _land(kind: String, target: Node3D, side: String) -> void:
	if bool(set["preview"]) or not is_instance_valid(target):
		return
	var hik := ik()
	var got := true
	if hik != null and hik.last.has(side):
		got = float(hik.last[side]["error"]) <= hit_m
	else:
		var d := aim_point(target) - her.global_position
		d.y = 0.0
		got = d.length() <= 1.0
	if not got:
		return
	if on_struck.is_valid():
		on_struck.call(target, kind)
	for n in [target] + target.get_children():
		if n.has_method("take_hit"):
			n.take_hit(her)
			break
		if n.has_method("struck"):
			n.struck(her, kind)
			break


## a scare thrown at once ("lunge", "loom", "snap", "claw"): turned to `toward` first when it's given; it's over at
## its own `over` moment (when it's been shown) with `cut`, else at its end
func scare(kind: String, toward = null, cut := true) -> void:
	var clip := "scare_" + kind
	var steps: Array = []
	if toward is Vector3 and her != null:
		var to: Vector3 = (toward as Vector3) - her.global_position
		if Vector2(to.x, to.z).length() > 0.05:
			her.global_rotation.y = atan2(to.x, to.z)
	var step := {"k": "clip", "clip": clip, "blend": 0.0}
	if cut:
		step["until"] = "over"
	if kind == "claw":
		hold_clip = "crawl_idle_loop" if has_clip("crawl_idle_loop") else ""
	_begin(steps + [step])


## a scare's own numbers from her record: {peak, show, reach}
func scare_info(kind: String) -> Dictionary:
	var sc = clip_info("scare_" + kind).get("scare", {})
	return sc if sc is Dictionary else {}


# a clip's hand brought the rest of the way (HSHandIK; without it the clip plays as it was made)
func _bring_start(b: Dictionary) -> void:
	var hik := ik()
	if hik == null or bool(set["preview"]):
		return
	var side := String(b["side"])
	var o := {"rise": b.get("rise", 0.25), "hold": b.get("hold", 0.06), "fall": b.get("fall", 0.3), "freeze": b.get("freeze", false), "most": b.get("most", 0.5)}
	if b.has("peaks"):
		o["peaks"] = b["peaks"]
	else:
		o["peak"] = b["peak"]
	match String(b["what"]):
		"mouth":
			if not is_instance_valid(held) or held_grip.is_empty() or held_side != side:
				return
			var x := held.transform
			o["point"] = x * (held_grip["mouth"] as Vector3)
			o["anchor"] = x * (held_grip["xform"] as Transform3D).origin
			o["target"] = Callable(hik, "mouth")
			o["aim"] = true
		"tip":
			if is_instance_valid(held) and not held_grip.is_empty() and held_side == side:
				o["point"] = held.transform * (held_grip["tip"] as Vector3)
				o["anchor"] = held.transform * (held_grip["xform"] as Transform3D).origin
				o["aim"] = true
			else:
				o["point"] = hik.knuckles(side)
			o["target"] = b["target"]
		"handle":                                             # the middle of her closed hand onto a door's handle
			o["point"] = (hik.grip_frame(side, 0.03, "handle") as Transform3D).origin
			o["target"] = b["target"]
		"palm":                                               # her palm held out (what she holds with it, when she holds something)
			o["target"] = b["target"]
		"held":                                               # the thing in her hand, onto the place it's put down
			if not is_instance_valid(held) or held_side != side:
				return
			o["point"] = held.transform.origin
			o["target"] = b["target"]
		"grip":
			var thing := b["thing"] as Node3D
			var gcls := look_script("grip.gd")
			if thing == null or gcls == null:
				return
			var g: Dictionary = gcls.grip_of(thing)
			o["point"] = (hik.grip_frame(side, float(g["size"]), String(g["shape"])) as Transform3D).origin
			o["target"] = thing.global_transform * (g["xform"] as Transform3D).origin
		_:
			o["point"] = hik.knuckles(side)
			o["target"] = b["target"]
	hik.bring(side, o)


## a door opened: a hand to its handle at `at`, facing `yaw` (into the door), by the clip `clip`, `flat` where the
## handle is in it; the door's own use() as her hand moves it
func open(at: Vector3, yaw: float, clip: String, flat: Vector3, door: Node, rate := 1.0, blend := 0.25) -> void:
	var stand_at := at - HSNpcFlow.turned(Vector3(flat.x, 0, flat.z), yaw)
	var step := {"k": "clip", "clip": clip, "on": {"open": func(): _use(door)}, "rate": rate, "blend": blend}
	# her hand onto the handle itself from when she takes it until she lets go: her clip was made for a handle of some
	# height (a person's metre, or as high as a small body's hand goes) and the pin is where it was put
	var grab := -1.0
	var let_go := -1.0
	for e in clip_info(clip).get("events", []):
		if String(e["name"]) == "grab":
			grab = float(e["t"])
		elif String(e["name"]) == "release":
			let_go = float(e["t"])
	if grab >= 0.0:
		step["bring"] = {"what": "handle", "side": "l" if clip.ends_with("_l") else "r", "target": at, "peak": grab, "rise": 0.4, "hold": maxf(0.05, let_go - grab), "fall": 0.3, "freeze": true, "most": 0.35}
	_begin(_go(stand_at, yaw) + [step])


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
		held.global_basis = held_rest                          # (the way up it stood before she took it: a book lies flat again, a cup stands)
		held.visible = true
		for c in held.find_children("*", "CollisionObject3D", true, false):
			(c as CollisionObject3D).process_mode = Node.PROCESS_MODE_INHERIT
		if held is RigidBody3D:
			(held as RigidBody3D).freeze = false
		_let_go()
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
	elif posture == "peeking":                                # (looking out past a wall: she draws back behind it first)
		pre.append({"k": "clip", "clip": "peek_back" + side, "to": {"posture": "standing", "side": ""}})
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
				if _step.has("bring"):
					_bring_start(_step["bring"])
				return
			"path":
				travelled = 0.0
				return
			"call":                                            # (something to do between two steps: what her hand took, carried or put away)
				(_step["f"] as Callable).call()
				continue
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
		"peeking":
			n = "peek%s_loop" % side
		_:
			if hold_clip != "":
				n = hold_clip
				rate = hold_rate
	if _play(n, true, rate, blend) <= 0.0 and n != "idle_loop" and posture in ["standing", "peeking"]:
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
			var ct := _t * maxf(float(_step.get("rate", 1.0)), 0.05)                 # the clip's own time
			if _step.has("face") and ct < float(_step.get("face_until", 0.0)):         # turning with who she's hitting until the blow's thrown
				var to2 := aim_point(_step["face"]) - her.global_position
				if Vector2(to2.x, to2.z).length() > 0.05:
					her.global_rotation.y = rotate_toward(her.global_rotation.y, atan2(to2.x, to2.z), deg_to_rad(float(set["turn_degrees"])) * 0.6 * dt)
			if _step.has("bring") and is_instance_valid(_ik):
				_ik.at(String(_step["bring"]["side"]), ct)
			_events(n, ct, false, secs)
			if _step.is_empty():
				return
			secs = float(_step.get("secs", secs))
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
	var g := _gait_of(_step, v)
	_play(String(g[0]), true, clampf(v / float(g[1]), 0.4, 2.2), float(_step["blend"]))
	now = String(g[2])
	_events(String(g[0]), _player.current_animation_position if _player != null else 0.0, true, 0.0)


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
	if _step.has("give_up") and _t > float(_step["give_up"]):   # (after someone she can't get to: on with it from where she is)
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
	var g := _gait_of(_step, v)
	_play(String(g[0]), true, clampf(v / float(g[1]), 0.4, 2.2), float(_step["blend"]))
	now = String(g[2])
	_events(String(g[0]), _player.current_animation_position if _player != null else 0.0, true, 0.0)


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
		if String(_step.get("until", "")) == nm:              # the clip is over at this moment of it (a scare that's been shown)
			_step["secs"] = _t


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
	held_rest = thing.global_basis if thing.is_inside_tree() else Basis.IDENTITY
	thing.reparent(att, true)
	held = thing
	held_side = "l" if left else "r"
	held_grip = {}
	var hik := ik()
	var gcls := look_script("grip.gd")
	if hik != null and gcls != null and hik.get_parent() == sk:      # by its grip (an HSGrip under it, else guessed from its size), her fingers closed round it
		held_grip = gcls.grip_of(thing)
		var want: Transform3D = (hik.grip_frame(held_side, float(held_grip["size"]), String(held_grip["shape"])) as Transform3D) * (held_grip["xform"] as Transform3D).affine_inverse()
		thing.create_tween().tween_property(thing, "transform", want, 0.14)
		hik.grip(held_side, float(held_grip["size"]), String(held_grip["shape"]), 0.14)
	else:
		var palm: Array = (record.get("palm", {}) as Dictionary).get("l" if left else "r", [0.0, -0.07, 0.03]) if record.get("palm") is Dictionary else [0.0, -0.07, 0.03]
		thing.position = Vector3(palm[0], palm[1], palm[2])


func _put_away(keep: bool) -> void:
	if not is_instance_valid(held):
		return
	if keep:
		_carry_start()                                         # (kept: carried from here on, whatever she does)
		return
	held.visible = false
	_let_go()
	held = null


func _let_go() -> void:
	if is_instance_valid(_ik):
		_ik.release(held_side)
	if is_instance_valid(_gesture):
		_gesture.carry_off(held_side)


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
	_place_under(stand_at, seat.y, float(m.get("height", 0.45)), atan2(front.x, front.z), most_lift(m))
	posture = "sitting"
	_hold(0.0)


func lie_now(bed: Vector3, front: Vector3, right := false) -> void:
	var sd := "_r" if right else ""
	var m: Dictionary = clip_info("lie_down" + sd).get("bed", {})
	var stand_at := bed - front * float(m.get("edge", HSNpcFlow.SEAT_EDGE))
	_place_under(stand_at, bed.y, float(m.get("height", 0.45)), atan2(front.x, front.z), most_lift(m))
	posture = "lying"
	side = sd
	_hold(0.0)


func peek_now(corner: Vector3, front: Vector3, left := false) -> void:
	place(HSNpcFlow.peek_stand(corner, front, left, record), atan2(front.x, front.z))
	posture = "peeking"
	side = "_l" if left else ""
	_hold(0.0)


# stood in front of a seat at `top`: on the floor under it (looked for from under the seat's top, so the seat itself
# isn't taken for the floor), raised or lowered to meet it
func _place_under(at: Vector3, top: float, made_for: float, yaw: float, most := 0.12) -> void:
	_clear()
	posture = "standing"
	side = ""
	lift = 0.0
	var fl := floor_y(at, top - 1.1)
	if absf(fl - (top - 1.1)) < 0.0005:
		fl = top - made_for
	her.global_position = Vector3(at.x, fl, at.z)
	her.global_rotation = Vector3(0, yaw, 0)
	_set_lift(clampf((top - fl) - made_for, -0.12, most))


## what she is, to keep at a checkpoint
func snapshot() -> Dictionary:
	return {"pos": her.global_position if her != null else Vector3.ZERO, "yaw": her.global_rotation.y if her != null else 0.0, "posture": posture, "side": side,
		"lift": lift, "hidden": hidden, "hold_clip": hold_clip, "hold_rate": hold_rate, "released": released,
		"given": is_instance_valid(held) and held.has_meta("hs_given")}


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
	if not bool(d.get("given", false)):                        # (what you handed her since is back in your pocket: the Story's checkpoint put it there)
		_drop_given()
	_playing = ""
	_hold(0.0)


func report() -> Dictionary:
	return {"now": now, "busy": busy, "posture": posture, "hidden": hidden, "baked": not record.is_empty(), "clips": names.keys(), "problems": problems,
		"walk": pace(false), "run": pace(true), "playing": _playing, "held": String(held.name) if is_instance_valid(held) else "",
		"doing": _doing(), "life": String(_gesture.now) if is_instance_valid(_gesture) else "", "alive": bool(_gesture.alive) if is_instance_valid(_gesture) else false,
		"carried": String(_gesture.carrying(held_side)) if is_instance_valid(_gesture) and is_instance_valid(held) else ""}
