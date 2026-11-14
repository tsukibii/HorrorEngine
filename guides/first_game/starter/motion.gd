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
## And since animations v3 (DECISIONS 2026-11-14; docs/ANIMATOR_V3.md):
##     m.sneak_to($Door)            # low and careful; she stays crouched after (crawl_to, creep_to, scuttle_to the same;
##                                  #   rise() stands her up again, and so does walk_to)
##     m.peek($Wall/Corner, 3.0)    # stands hidden behind a wall's end, leans out past it, holds 3 s, draws back
##     m.scare("lunge", $Player, true)   # a scare thrown at once toward someone, and she's hidden when it's been shown
##     m.punch($Player)             # walks up to them, turns with them, and the fist is carried onto them (swing: with what she holds)
##     m.eat($Apple)                # takes it and eats it (drink the same); with nothing given, what she holds
##     m.head_follow(true)          # her head follows the player within `head_range` degrees (the look plugin's HSHeadTrack)
##     m.look_around()  m.knock($Door/Spot)  m.cower()  m.take_hit()
## And life and carrying (DECISIONS 2026-11-14, later; docs/ANIMATOR_V3.md §11, §12; the look plugin's HSGesture):
##     m.alive_now(true)            # now and then a small movement, laid over whatever she's doing (standing, walking,
##                                  #   sitting): a scratch, a look at what she holds, a stretch. Or tick Alive in the Inspector
##     m.life("scratch_head")       # one now ("": one that suits what she's doing)
##     m.pick_up($Cup, true)        # kept: carried from then on whatever she does (walks, sits, sneaks), by its grip's
##                                  #   Carry (at her side, in front of her, to her chest, over her shoulder, raised)
##     m.hold($Lantern, false, "raised")   # put straight into her hand and carried; drop() lets go of it
## A thing she picks up sits in her hand by its HSGrip (a node of the look plugin's put under the prop: where a hand
## takes it, how thick it is there, where the mouth goes), her fingers closed round it; with none, by its size.
## One thing after another: each call takes the place of what she was doing (sat, she stands first; asleep, she
## gets up first). `done(what)` when it's finished; an act.gd node does all this from the Inspector, by a quest's own
## words. Where things are:
##   a seat, a bed   a Marker3D on its front edge, at the height you sit at, its blue arrow (+Z) the way she'll face sat
##   a handle        a Marker3D at the handle, its blue arrow pointing into the door (the way she faces to open it)
##   a wall's end    a Marker3D at the foot of the edge she peeks past, its blue arrow the way she looks out
##   anything else   wherever it is
## Her clips move her body's bones only: her face (expressions, blinks) and her hair's springs play over any of them.
## Her soft tissue (bust, belly, seat, hips, thighs) swings in every baked clip; with `live_jiggle` and the look plugin
## in the project it's swung as the game runs instead (JiggleBones' way), so it also answers a stop, a turn and a
## clip of your own.
## A character that wasn't baked still walks if her model has animations called idle, walk and run.
extends Node

signal arrived(where: Vector3)                        ## she got where she was walking to
signal done(what: String)                             ## an act finished: "walk", "sit", "stand", "sleep", "wake", "open", "reach", "pick_up", "play", "face"
signal event(name: String)                            ## a clip's own moments: "step_l", "step_r", "seated", "grab", "open", "release", "put_away", "hit", "bite", "sip", "peak", "over", "knock"...
signal struck(target: Node, kind: String)             ## a punch or a swing of hers landed on someone

@export var walk_speed := 0.0                         ## metres a second; 0: as her own walk was made
@export var run_speed := 0.0                          ## 0: as her own run was made
@export var turn_degrees := 320.0                     ## how fast she turns, a second
@export var blend := 0.3                              ## seconds from one clip into the next
@export var arrive_m := 0.05                          ## how near counts as there
@export var start_with := "idle"                      ## what she does when the game starts ("": nothing)
@export_flags_3d_physics var floor_mask := 1          ## what she stands on (0: she keeps her height)
@export var more := {}                                ## clips of your own: {"dance": "res://animations/dance.res"}
@export var live_jiggle := true                       ## her soft tissue swung as the game runs (the look plugin's HSJiggle, when the project has it); off: only what her clips carry
@export_group("Head")
@export var head_follows := false                     ## her head follows the player (the look plugin's HSHeadTrack): head_follow() switches it
@export_range(0.0, 360.0, 1.0, "degrees") var head_range := 160.0   ## the whole arc she follows in: half to each side of straight ahead
@export_group("Life")
@export var alive := false                            ## small movements now and then while she stands, walks or sits: a scratch, a look at what she holds, a stretch (the look plugin's HSGesture: laid over what she's doing, never instead of it). alive_now() switches it
@export var life_every := Vector2(6.0, 14.0)          ## seconds between them, from and to
@export var life_only: PackedStringArray = []         ## only these ("scratch_head", "look_hand", "stretch"...); empty: any she has that suit what she's doing
@export_group("Blows")
@export var hit_m := 0.3                              ## how near her fist (or what she swings) has to get for a blow to land
@export var short_of_you := 0.16                      ## how far short of the player's eye a blow stops (in your face, not through it)

const LOOK := "res://addons/horrorstudio_look/"
const HANDS_OFF := ["peek", "scare_", "cower", "lie_down", "get_up", "sleep", "hit_react", "reach_low", "sit_down", "stand_up"]   # clips that want both her hands: what she carries goes where the clip has her hand, for as long
const ONE_HAND := ["reach_", "open_", "punch", "swing", "eat", "drink", "knock"]   # clips that want one: their own (the left when the clip's name ends _l)
## a way of going: its loop, the loop she rests in after, and how fast when her record doesn't say
const GAITS := {"walk": ["walk_loop", "", 1.3], "run": ["run_loop", "", 3.0], "sneak": ["sneak_loop", "crouch_loop", 0.42], "crawl": ["crawl_loop", "crawl_idle_loop", 0.38],
	"creep": ["creep_loop", "creep_idle_loop", 0.53], "scuttle": ["scuttle_loop", "crawl_idle_loop", 1.2]}

var record := {}                                      ## the Animator's record of her clips (empty: she wasn't baked)
var now := ""                                         ## what she's doing: "", "idle", "walk", "run", "turn", a clip's name
var busy := false                                     ## something asked of her isn't finished
var seated := false
var asleep := false
var stance := ""                                      ## the loop she rests in when she isn't standing ("": her idle): crouch_loop, crawl_idle_loop, creep_idle_loop, cower_loop
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
var _held_side := "r"
var _held_grip := {}                                  # how what she holds is held (HSGrip.grip_of)
var _ik: Node                                         # her hands' IK (the look plugin's HSHandIK), when the project has it
var _gesture: Node                                    # what lays a flourish or a carry pose over her clips (the look plugin's HSGesture), when the project has it
var _carry_how := ""                                  # how what she holds is carried ("": as its grip says)
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
	elif int(record.get("version", 1)) < 2:
		problems.append("her .glb was baked by an older Animator (before her hands and her soft tissue were reworked): open her in the Animator and Bake again")
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
	if live_jiggle and ResourceLoader.exists("res://addons/horrorstudio_look/jiggle.gd"):   # (attach: one under her if she has soft bones or chains, or the one already there)
		load("res://addons/horrorstudio_look/jiggle.gd").attach(h)
	if head_follows:
		head_follow(true)
	if alive:
		alive_now(true)
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


## how fast a way of going travels as it was made, metres a second ("sneak", "crawl", "creep", "scuttle", "walk", "run")
func gait_speed(gait: String) -> float:
	var s := float(clip_info(String(GAITS[gait][0])).get("speed", 0.0))
	return s if s > 0.05 else float(GAITS[gait][2])


# the loop she rests in: her stance's, else her idle
func _rest_loop() -> String:
	return stance if stance != "" and _names.has(stance) else "idle_loop"


# a script of the look plugin's, when the project has it (never by class name: a project without the plugin still runs)
func _look(file: String) -> GDScript:
	return load(LOOK + file) as GDScript if ResourceLoader.exists(LOOK + file) else null


## her hands' IK (the look plugin's HSHandIK), or null
func hand_ik() -> Node:
	if not is_instance_valid(_ik):
		var cls := _look("hand_ik.gd")
		_ik = cls.attach(her()) if cls != null else null
	return _ik


## what lays her flourishes and her carry poses over her clips (the look plugin's HSGesture), or null
func gesture() -> Node:
	if not is_instance_valid(_gesture):
		var cls := _look("gesture.gd")
		_gesture = cls.attach(her()) if cls != null else null
		if _gesture != null:
			hand_ik()                                         # (a hand that touches her is put on her by her hands' IK)
			_gesture.doing = _doing()
	return _gesture


# ---- what she can be asked ----------------------------------------------------------------------------------------------
func idle() -> void:
	_begin([{"k": "idle"}])


func stop() -> void:
	_queue = []
	_step = {}
	busy = false
	if not seated and not asleep:
		_play(_rest_loop())
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


# ---- animations v3: low gaits, a peek, a scare, a blow, eating and drinking, her head ------------------------------------
## go somewhere low: "sneak" (crouched, careful), "crawl" (hands and knees), "creep" (a creature's hunched stalk),
## "scuttle" (hands and feet, quick). She stays low when she's there: rise() or walk_to() stands her up
func go_low(target, gait := "sneak", face = null) -> void:
	_begin([_go(_point(target), false, face, null, gait), {"k": "idle"}, {"k": "done", "what": gait}])


func sneak_to(target, face = null) -> void:
	go_low(target, "sneak", face)


func crawl_to(target, face = null) -> void:
	go_low(target, "crawl", face)


func creep_to(target, face = null) -> void:
	go_low(target, "creep", face)


func scuttle_to(target, face = null) -> void:
	go_low(target, "scuttle", face)


## down where she is: "crouch_loop", "crawl_idle_loop", "creep_idle_loop" or "cower_loop"; rise() up again
func get_low(loop := "crouch_loop") -> void:
	stance = loop
	_begin([{"k": "idle"}, {"k": "done", "what": "low"}])


func rise() -> void:
	stance = ""
	_begin([{"k": "idle"}, {"k": "done", "what": "rise"}])


func cower(on := true) -> void:
	if on:
		get_low("cower_loop")
	else:
		rise()


## peek round a wall's end: `corner` a Marker3D at the foot of the edge, its +Z the way she looks out. She stands
## hidden behind the wall with the edge to her right (left: to her left), leans out past it, holds `secs`, draws back
func peek(corner: Node3D, secs := 2.5, left := false) -> void:
	var tag := "_l" if left else ""
	var m: Dictionary = clip_info("peek_out" + tag).get("peek", {})
	var e: Array = m.get("edge", [0.25 if left else -0.25, 0.0, 0.2])
	var f := _front(corner)
	var yaw := atan2(f.x, f.z)
	var stand := corner.global_position - _turned(Vector3(e[0], 0, e[2]), yaw)
	_begin([_go(stand, false, null, yaw), {"k": "clip", "clip": "peek_out" + tag}, {"k": "hold", "clip": "peek%s_loop" % tag, "secs": secs},
		{"k": "clip", "clip": "peek_back" + tag}, {"k": "idle"}, {"k": "done", "what": "peek"}])


## a scare, at once: "lunge", "loom", "snap" or "claw" (from all fours). `toward`: who or what she's turned to first;
## `then_hide`: she's hidden when it's been shown (its record's `show`), as a scare that briefly appears is. `event`
## says "peak" and "over". scare_info(kind): {peak, show, reach}: stand her `reach` and a little more from the player
func scare(kind := "lunge", toward = null, then_hide := false) -> void:
	var clip := "scare_" + kind
	var steps: Array = []
	if toward != null:
		var to := _point(toward) - her().global_position
		if Vector2(to.x, to.z).length() > 0.05:
			steps.append({"k": "turn_now", "yaw": atan2(to.x, to.z)})
	var step := {"k": "clip", "clip": clip, "fade": 0.0}
	if then_hide:
		step["until"] = "over"
		step["on"] = {"over": func(): her().visible = false}
	steps.append(step)
	if kind == "claw":
		stance = "crawl_idle_loop"
	_begin(steps + [{"k": "idle"}, {"k": "done", "what": "scare"}])


func scare_info(kind := "lunge") -> Dictionary:
	return clip_info("scare_" + kind).get("scare", {})


## her head follows someone within `head_range` degrees (half to each side of straight ahead): the player when no
## target is given, else a node or a point. The look plugin's HSHeadTrack (null without it): its `beyond`, `snappy`,
## `amount`... are its own
func head_follow(on := true, target = null, range_degrees := -1.0) -> Node:
	var cls := _look("head_track.gd")
	var t: Node = cls.attach(her()) if cls != null else null
	if t == null:
		return null
	if range_degrees >= 0.0:
		head_range = range_degrees
	t.range_degrees = head_range
	t.follow = on
	if target is Node3D:
		t.look_at_node(target)
	elif target is Vector3:
		t.look_at_point(target)
	else:
		t.follow_player()
	head_follows = on
	return t


## small movements now and then, laid over whatever she's doing (standing, walking, sitting): a scratch, a look at
## what she holds, a hand through her hair, a stretch. `every`: seconds between them, from and to. The look plugin's
## HSGesture (null without it); her clips are the Animator's `life_` ones, so a character baked before them has none
func alive_now(on := true, every := Vector2.ZERO) -> Node:
	var g := gesture()
	alive = on
	if g == null:
		return null
	if every != Vector2.ZERO:
		life_every = every
	g.every = life_every
	g.only = life_only
	g.alive = on
	return g


## one small movement now: "scratch_head", "look_hand", "rub_neck", "stretch"... ("": one that suits what she's
## doing). False when she can't just now: an act has her, that hand is busy, she hasn't got it
func life(what := "", left := false) -> bool:
	var g := gesture()
	if g == null:
		return false
	var n: String = what if what != "" else String(g.pick())
	return n != "" and bool(g.play(n, {"left": left}))


## a thing put in her hand, and carried from now on whatever she does: walking, sitting, sneaking (no reaching for it:
## pick_up(thing, true) walks to it and takes it). how: "side", "front", "chest", "shoulder", "raised"; "": as its
## grip says (an HSGrip's Carry), else in front of her if it's drunk from and at her side if not
func hold(thing: Node3D, left := false, how := "") -> void:
	if is_instance_valid(_held) and _held != thing:
		drop()
	_take(thing, left)
	_carry_start(how)


## how what she holds is carried from now on ("": as its grip says)
func carry(how := "") -> void:
	_carry_start(how)


func _carry_start(how := "") -> void:
	if not is_instance_valid(_held):
		return
	var g := gesture()
	var gcls := _look("grip.gd")
	if g == null or gcls == null:
		return
	_carry_how = how
	var by: Array = gcls.carry_of(_held_grip)
	g.carry(_held_side, how if how != "" else String(by[0]), {"thing": _held, "upright": bool(by[1])})


# what she's doing, in the layer's words: a flourish is laid over standing, walking and sitting, and nothing else
func _doing() -> String:
	if asleep or (not _step.is_empty() and String(_step["k"]) in ["clip", "hold", "turn"]):
		return "busy"
	if seated:
		return "sit"
	if now == "walk":
		return "walk"
	if now == "idle" and stance == "":
		return "stand"
	return "busy"


# each tick: the layer told what she's doing; a hand an act needs taken back from the carry, and given back after
func _tell_gesture() -> void:
	if not is_instance_valid(_gesture):
		return
	var d := _doing()
	_gesture.doing = d
	if d == "busy" and String(_gesture.now) != "":
		_gesture.stop(0.15)
	for side in ["l", "r"]:
		if String(_gesture.carrying(side)) == "":
			continue
		var off := asleep
		if not _step.is_empty() and String(_step["k"]) == "clip":
			var cn := String(_step["clip"])
			for w in HANDS_OFF:
				off = off or cn.begins_with(w)
			for w in ONE_HAND:
				off = off or (cn.begins_with(w) and ("l" if cn.ends_with("_l") else "r") == side)
			if _step.has("bring") and String(_step["bring"]["side"]) == side:
				off = true
		if now in ["crawl", "scuttle"] or stance in ["crawl_idle_loop"]:
			off = true
		_gesture.carry_pause(side, off)


## where to hit someone, or look at them: what their aim_point() says, a little under the player's eye, their upper
## chest, else 1.3 m over where they are
func aim_point(target) -> Vector3:
	if target is Vector3:
		return target
	var n := target as Node3D
	if n == null or not is_instance_valid(n):
		return her().global_position + her().global_basis.z
	if n.has_method("aim_point"):
		return n.aim_point()
	var cams := n.find_children("*", "Camera3D", true, false)
	if n is Camera3D or not cams.is_empty():
		var cam: Camera3D = n if n is Camera3D else cams[0]
		var back := her().global_position - cam.global_position
		back.y = 0.0
		return cam.global_position + Vector3(0, -0.1, 0) + (back.normalized() * short_of_you if back.length() > 0.01 else Vector3.ZERO)
	for sk in n.find_children("*", "Skeleton3D", true, false):
		for nm in ["c_spine3", "UpperChest", "Chest", "Spine2", "mixamorig_Spine2", "mixamorig:Spine2"]:
			var b := (sk as Skeleton3D).find_bone(nm)
			if b >= 0:
				return (sk as Skeleton3D).global_transform * (sk as Skeleton3D).get_bone_global_pose(b).origin + Vector3(0, 0.08, 0)
	return n.global_position + Vector3(0, 1.3, 0)


## a punch at someone (a node or a point): she walks up to where it reaches them (approach), turns with them until
## it's thrown, and her fist is carried the rest of the way onto them. `struck` when it lands
func punch(target, left := false, approach := true) -> void:
	_blow("punch", target, left, approach)


## a swing of what she holds (her fist when she holds nothing) down onto someone
func swing(target, left := false, approach := true) -> void:
	_blow("swing", target, left, approach)


func _blow(kind: String, target, left: bool, approach: bool) -> void:
	var clip := kind + ("_l" if left else "")
	var m: Dictionary = clip_info(clip).get(kind, {})
	var at: Array = m.get("at", [0.0, 1.28, 0.72 if kind == "punch" else 0.5])
	var reach := float(at[2])
	var what := "fist"
	if kind == "swing" and is_instance_valid(_held):          # what she holds reaches further: its tip, along the fist's own axis as the blow lands
		var ax: Array = m.get("axis", [0.0, 0.8, 0.55])
		var hold: Transform3D = _held_grip.get("xform", Transform3D.IDENTITY)
		reach += float(ax[2]) * ((_held_grip.get("tip", Vector3.ZERO) as Vector3) - hold.origin).length() * 0.9
		what = "tip"
	var hit_t := 0.5
	for e in clip_info(clip).get("events", []):
		if String(e["name"]) == "hit":
			hit_t = float(e["t"])
	var side := "l" if left else "r"
	var steps: Array = []
	if approach:
		steps.append({"k": "go", "to": her().global_position, "run": false, "chase": target, "reach": reach, "level": float(at[1])})
	steps.append({"k": "clip", "clip": clip, "face": target, "face_until": hit_t - 0.06, "on": {"hit": func(): _land(kind, target, side)},
		"bring": {"what": what, "side": side, "target": func(): return aim_point(target), "peak": hit_t, "rise": 0.22 if kind == "punch" else 0.3, "hold": 0.05, "fall": 0.3, "freeze": true, "most": 0.55}})
	_begin(steps + [{"k": "idle"}, {"k": "done", "what": kind}])


# how far to stand from someone for a blow made to land `reach` ahead at her own shoulder's height, when they are
# `dy` higher or lower than that: nearer, since her arm is no longer (her shoulder is about a seventh of the way out)
func _reach_at(reach: float, dy: float) -> float:
	var arm := 0.86 * reach
	return 0.97 * (0.14 * reach + sqrt(maxf(0.05 * arm * arm, arm * arm - dy * dy)))


# the blow has been thrown: did it get there?
func _land(kind: String, target, side: String) -> void:
	var ik := hand_ik()
	var got := true
	if ik != null and ik.last.has(side):
		got = float(ik.last[side]["error"]) <= hit_m
	else:                                                     # no IK in this project: by how far she is from them
		var d := aim_point(target) - her().global_position
		d.y = 0.0
		got = d.length() <= 1.0
	if not got or not (target is Node):
		return
	struck.emit(target, kind)
	for n in [target] + (target as Node).get_children():
		if n.has_method("take_hit"):                          # someone with a Motion node of their own reels
			n.take_hit(her())
			break
		if n.has_method("struck"):
			n.struck(her(), kind)
			break


## hit: she's thrown back, catches herself and stands again; `from`: who hit her (she's turned to them)
func take_hit(from: Node3D = null) -> void:
	var steps: Array = []
	if from != null:
		var to := from.global_position - her().global_position
		if Vector2(to.x, to.z).length() > 0.05:
			steps.append({"k": "turn_now", "yaw": atan2(to.x, to.z)})
	_begin(steps + [{"k": "clip", "clip": "hit_react", "fade": 0.06}, {"k": "idle"}, {"k": "done", "what": "hit"}])


## eat something: a thing given is taken first (walked to, picked up); with none, what she holds. Two bites; then
## it's gone ("gone"), kept in her hand ("keep") or let go of ("drop"). Its HSGrip says where the mouth goes
func eat(thing: Node3D = null, left := false, finish := "gone") -> void:
	_mouth("eat", thing, left, finish)


## drink from something: one long sip, her head back; it stays in her hand unless `finish` says otherwise
func drink(thing: Node3D = null, left := false, finish := "keep") -> void:
	_mouth("drink", thing, left, finish)


func _mouth(what: String, thing: Node3D, left: bool, finish: String) -> void:
	var steps: Array = []
	if thing != null and thing != _held:
		steps += _reach_steps(thing.global_position, "", left, thing, true)
	var clip := what + ("_l" if left else "")
	var peaks := []
	var done_t := 0.0
	for e in clip_info(clip).get("events", []):
		if String(e["name"]) in ["bite", "sip"]:
			peaks.append(float(e["t"]) + (0.4 if what == "drink" else 0.0))
		elif String(e["name"]) == "done":
			done_t = float(e["t"])
	var after := func() -> void:
		if finish == "gone":
			_put_away(false)
		elif finish == "drop":
			drop()
	var step := {"k": "clip", "clip": clip, "on": {"done": after}}
	if not peaks.is_empty():
		step["bring"] = {"what": "mouth", "side": "l" if left else "r", "peaks": peaks, "rise": 0.4, "hold": 0.5 if what == "drink" else 0.14, "fall": 0.35, "most": 0.3}
	_begin(steps + [step, {"k": "idle"}, {"k": "done", "what": what}])


## looks round: to her left, to her right, and back
func look_around() -> void:
	_begin([{"k": "clip", "clip": "look_around"}, {"k": "idle"}, {"k": "done", "what": "look"}])


## three knocks; `at`: where on a door (a node or a point): she walks to where her fist reaches it. `event` says "knock"
func knock(at = null, left := false) -> void:
	var clip := "knock" + ("_l" if left else "")
	var m: Dictionary = clip_info(clip).get("knock", {})
	var kp: Array = m.get("at", [-0.1, 1.28, 0.42])
	var steps: Array = []
	var step := {"k": "clip", "clip": clip}
	if at != null:
		var p := _point(at)
		var to := p - her().global_position
		to.y = 0.0
		var flat := Vector3(kp[0], 0, kp[2])
		var yaw := (atan2(to.x, to.z) if to.length() > 0.05 else her().global_rotation.y) - atan2(flat.x, flat.z)
		var stand := p - _turned(flat, yaw)
		stand.y = _floor_at(stand)
		steps.append(_go(stand, false, null, yaw))
		var raps := []
		for e in clip_info(clip).get("events", []):
			if String(e["name"]) == "knock":
				raps.append(float(e["t"]))
		if not raps.is_empty():
			step["bring"] = {"what": "fist", "side": "l" if left else "r", "target": p, "peak": raps[0], "rise": 0.35, "hold": float(raps[-1]) - float(raps[0]) + 0.08, "fall": 0.3, "freeze": true, "most": 0.4}
	_begin(steps + [step, {"k": "idle"}, {"k": "done", "what": "knock"}])


## sit on a seat: a Marker3D on its front edge at the height you sit at, its +Z the way she'll face
func sit(seat: Node3D) -> void:
	var m: Dictionary = clip_info("sit_down").get("seat", {})
	var f := _front(seat)
	var stand := seat.global_position - f * float(m.get("edge", -0.05))
	var steps: Array = [_go(stand, false, null, atan2(f.x, f.z))]
	steps.append({"k": "clip", "clip": "sit_down", "lift": _lift_for(seat, stand, float(m.get("height", 0.45)), bool(m.get("high", false)))})
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
	steps.append({"k": "clip", "clip": "lie_down" + side, "lift": _lift_for(bed, stand, float(m.get("height", 0.45)), bool(m.get("high", false)))})
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
	var ahead := handle_ahead(m, handle.global_position.y - _floor_at(handle.global_position))
	var stand := handle.global_position - _turned(Vector3(hp[0], 0, ahead), atan2(f.x, f.z))
	var steps: Array = [_go(stand, false, null, atan2(f.x, f.z))]
	var step := {"k": "clip", "clip": clip, "on": {"open": func(): _use(door)}}
	# her hand onto the handle itself, from the moment she takes it until she lets go. Her clip was made for a handle
	# of some height (a person's metre, or as high as a small body's hand goes: an imp's is 86 cm) and yours is where
	# you put it: the hand's IK carries her hand the rest of the way, as far as her arm goes
	var grab := -1.0
	var let_go := -1.0
	for e in clip_info(clip).get("events", []):
		if String(e["name"]) == "grab":
			grab = float(e["t"])
		elif String(e["name"]) == "release":
			let_go = float(e["t"])
	if grab >= 0.0:
		step["bring"] = {"what": "handle", "side": "l" if left else "r", "target": func(): return handle.global_position if is_instance_valid(handle) else Vector3.ZERO,
			"peak": grab, "rise": 0.4, "hold": maxf(0.05, let_go - grab), "fall": 0.3, "freeze": true, "most": 0.35}
	steps.append(step)
	steps.append({"k": "idle"})
	steps.append({"k": "done", "what": "open"})
	_begin(steps)


## how far in front of her a handle `high` m over the floor has to be for her hand to get to it. Her clip was made
## for one height (the record's `door.handle`) and stands her that far from it; the middle of her closed hand is put on
## the handle by her hand's IK, so her wrist has to get to where that leaves it, and it only can within her arm's
## length of her shoulder: for a handle too low or too high for that from where the clip stands her, she stands
## nearer, never further (`m`: the clip's `door` record: its shoulder, arm and grip)
static func handle_ahead(m: Dictionary, high: float) -> float:
	var hp: Array = m.get("handle", [-0.14, 1.0, 0.45])
	var sh: Array = m.get("shoulder", [])
	var g: Array = m.get("grip", [])
	var arm := float(m.get("arm", 0.0))
	if sh.size() != 3 or g.size() != 3 or arm <= 0.0:
		return float(hp[2])                               # (baked before this: where the clip stands her)
	var up := high - float(g[1]) - float(sh[1])           # her wrist over her shoulder, with the middle of her hand on the handle
	var far := 0.96 * arm
	var flat := sqrt(maxf(0.0, far * far - up * up))
	var toes := 0.55 * float(hp[2])                       # no nearer than this: her feet are in front of her
	return clampf(float(sh[2]) + flat + float(g[2]), toes, float(hp[2]))


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
	_let_go()
	_held = null


## what's in her hand (or null)
func held() -> Node3D:
	return _held if is_instance_valid(_held) else null


func _let_go() -> void:
	var ik := hand_ik()
	if ik != null:
		ik.release(_held_side)
	if is_instance_valid(_gesture):
		_gesture.carry_off(_held_side)


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


func _go(to: Vector3, run: bool, face, yaw = null, gait := "") -> Dictionary:
	var s := {"k": "go", "to": to, "run": run, "gait": gait if gait != "" else ("run" if run else "walk")}
	if yaw != null:
		s["yaw"] = float(yaw)
	elif face != null:
		var d := _point(face) - to
		s["yaw"] = atan2(d.x, d.z)
	return s


## how far she's raised or lowered onto a seat or a bed that isn't the height her clip was made for. A clip that sits
## her with her feet on the floor is good for 12 cm either way. One made for a seat that's high for her (a child, a
## goblin: `high` in the clip's record, the Animator's furniture) sits her with her legs hanging, so she can be lifted
## further, 30 cm: a body too small even for a person's chair is put on it all the same
func _lift_for(seat: Node3D, stand: Vector3, made_for: float, high := false) -> float:
	return clampf((seat.global_position.y - _floor_at(stand)) - made_for, -0.12, 0.3 if high else 0.12)


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
	var step := {"k": "clip", "clip": clip, "on": on}
	if thing != null:
		on["grab"] = func(): _take(thing, left)
		on["put_away"] = func(): _put_away(keep)
		var grab_t := -1.0
		for e in clip_info(clip).get("events", []):
			if String(e["name"]) == "grab":
				grab_t = float(e["t"])
		if grab_t >= 0.0:                                     # her hand brought the rest of the way onto where the thing is taken (its grip)
			step["bring"] = {"what": "grip", "side": "l" if left else "r", "thing": thing, "peak": grab_t, "rise": 0.45, "hold": 0.04, "fall": 0.4, "freeze": true, "most": 0.3}
	return [_go(stand, false, null, yaw), step]


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
	_held = thing
	_held_side = "l" if left else "r"
	_held_grip = {}
	var ik := hand_ik()
	var gcls := _look("grip.gd")
	var tw := thing.create_tween()
	if ik != null and gcls != null:                           # by its grip (an HSGrip under it, else guessed from its size): put so its grip is where her hand's is, her fingers closed round it
		_held_grip = gcls.grip_of(thing)
		var want: Transform3D = (ik.grip_frame(_held_side, float(_held_grip["size"]), String(_held_grip["shape"])) as Transform3D) * (_held_grip["xform"] as Transform3D).affine_inverse()
		tw.tween_property(thing, "transform", want, 0.14)
		ik.grip(_held_side, float(_held_grip["size"]), String(_held_grip["shape"]), 0.14)
	else:
		var palm: Array = (record.get("palm", {}) as Dictionary).get("l" if left else "r", [0.0, -0.07, 0.03])
		tw.tween_property(thing, "position", Vector3(palm[0], palm[1], palm[2]), 0.14)


func _put_away(keep: bool) -> void:
	if keep:
		_carry_start(_carry_how)                              # kept: carried from here on, whatever she does next
		return
	if not is_instance_valid(_held):
		return
	_held.visible = false
	_let_go()
	_held = null


# a clip's hand brought the rest of the way (the look plugin's HSHandIK; without it the clip plays as it was made)
func _bring_start(b: Dictionary) -> void:
	var ik := hand_ik()
	if ik == null:
		return
	var side := String(b["side"])
	var o := {"rise": b.get("rise", 0.25), "hold": b.get("hold", 0.06), "fall": b.get("fall", 0.3), "freeze": b.get("freeze", false), "most": b.get("most", 0.5)}
	if b.has("peaks"):
		o["peaks"] = b["peaks"]
	else:
		o["peak"] = b["peak"]
	match String(b["what"]):
		"mouth":                                              # what she holds, its mouth onto hers, turned to point at it
			if not is_instance_valid(_held) or _held_grip.is_empty() or _held_side != side:
				return
			var x := _held.transform                          # (the thing in the wrist's own space: its parent follows the wrist)
			o["point"] = x * (_held_grip["mouth"] as Vector3)
			o["anchor"] = x * (_held_grip["xform"] as Transform3D).origin
			o["target"] = Callable(ik, "mouth")
			o["aim"] = true
		"tip":                                                # what she holds, its end onto who she swings at: turned to point at them, then carried the rest of the way
			if is_instance_valid(_held) and not _held_grip.is_empty() and _held_side == side:
				o["point"] = _held.transform * (_held_grip["tip"] as Vector3)
				o["anchor"] = _held.transform * (_held_grip["xform"] as Transform3D).origin
				o["aim"] = true
			else:
				o["point"] = ik.knuckles(side)
			o["target"] = b["target"]
		"handle":                                             # the middle of her closed hand onto a door's handle
			o["point"] = (ik.grip_frame(side, 0.03, "handle") as Transform3D).origin
			o["target"] = b["target"]
		"grip":                                               # her hand onto where a thing is taken
			var thing := b["thing"] as Node3D
			var gcls := _look("grip.gd")
			if thing == null or gcls == null:
				return
			var g: Dictionary = gcls.grip_of(thing)
			o["point"] = (ik.grip_frame(side, float(g["size"]), String(g["shape"])) as Transform3D).origin
			o["target"] = thing.global_transform * (g["xform"] as Transform3D).origin
		_:
			o["point"] = ik.knuckles(side)
			o["target"] = b["target"]
	ik.bring(side, o)


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
				_play(_rest_loop())
				now = "idle"
			_next()
		"go":                                                 # how she goes says what she rests in when she's there: low after a low gait, standing after a walk
			stance = String(GAITS[String(_step.get("gait", "walk"))][1])
		"turn_now":
			her().global_rotation.y = float(_step["yaw"])
			_next()
		"hold":                                               # a loop held for a while
			var hn := String(_step["clip"])
			if not _names.has(hn):
				_next()
				return
			_play(hn)
			now = hn
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
				_play(n, 1.0, float(_step.get("fade", -1.0)))
				_step["secs"] = float(clip_info(n).get("secs", _ap.get_animation(_names[n]).length))
				if _step.has("bring"):
					_bring_start(_step["bring"])
			now = n
			if float(_step["secs"]) <= 0.0:                # (a loop of your own: it plays on; she's free)
				_next()


func _play(n: String, rate := 1.0, fade := -1.0) -> void:
	if _ap == null or not _names.has(n):
		return
	_ap.speed_scale = rate
	if _ap.current_animation != _names[n] or not _ap.is_playing():
		_ap.play(_names[n], blend if fade < 0.0 else fade)


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
	_tell_gesture()
	if _step.is_empty():
		return
	var h := her()
	match String(_step["k"]):
		"go":
			var to: Vector3 = _step["to"]
			var chase := _step.has("chase")
			if chase:                                         # after someone: to where her blow reaches them from
				var aim := aim_point(_step["chase"])
				var away := h.global_position - aim
				away.y = 0.0
				to = aim + (away.normalized() if away.length() > 0.01 else -h.global_basis.z) * _reach_at(float(_step["reach"]), aim.y - (h.global_position.y + float(_step.get("level", 1.28))))
			var d := to - h.global_position
			d.y = 0.0
			var dist := d.length()
			if dist <= (maxf(arrive_m, 0.06) if chase else arrive_m):
				if not chase:
					h.global_position = Vector3(to.x, _floor_at(to), to.z)
				arrived.emit(h.global_position)
				if _step.has("yaw"):
					_step = {"k": "turn", "yaw": _step["yaw"]}
					_play(_rest_loop())
					return
				_next()
				return
			var gait := String(_step.get("gait", "walk"))
			var gclip := String(GAITS[gait][0])
			if not _names.has(gclip):                         # (a character with no such gait walks)
				gait = "walk"
				gclip = "walk_loop"
			var run: bool = gait == "run"
			var want := atan2(d.x, d.z)
			var off := absf(angle_difference(h.global_rotation.y, want))
			h.global_rotation.y = rotate_toward(h.global_rotation.y, want, deg_to_rad(turn_degrees) * dt)
			var made := gait_speed(gait)
			var v := run_speed if run else (walk_speed if gait == "walk" else 0.0)
			if v <= 0.0:
				v = made
			v *= clampf(dist / 0.3, 0.4, 1.0) * (1.0 if off < 0.9 else 0.3)       # (slower into the stop, and while she's still turning)
			var stepv := d.normalized() * minf(v * dt, dist)
			var p := h.global_position + stepv
			p.y = _floor_at(p)
			h.global_position = p
			_play(gclip, clampf(v / made, 0.4, 2.2))
			now = gait
			_events(gclip, _ap.current_animation_position if _ap != null else 0.0, true)
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
			if _step.has("face") and _t < float(_step.get("face_until", 0.0)):       # turning with who she's hitting until the blow's thrown
				var to2 := aim_point(_step["face"]) - h.global_position
				if Vector2(to2.x, to2.z).length() > 0.05:
					h.global_rotation.y = rotate_toward(h.global_rotation.y, atan2(to2.x, to2.z), deg_to_rad(turn_degrees) * 0.6 * dt)
			if _step.has("bring") and is_instance_valid(_ik):
				_ik.at(String(_step["bring"]["side"]), _t)
			_events(n, _t, false)
			if not _step.is_empty() and _t >= float(_step.get("secs", secs)):
				if _step.has("lift"):
					_set_lift(float(_step["lift"]))
				_next()
		"hold":
			_t += dt
			if _t >= float(_step.get("secs", 0.0)):
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
		if String(_step.get("until", "")) == nm:              # the clip is over at this moment of it (a scare that's been shown)
			_step["secs"] = t


## what she has and is doing, a check's
func report() -> Dictionary:
	return {"clips": _names.keys(), "now": now, "busy": busy, "seated": seated, "asleep": asleep, "stance": stance, "held": _held.name if is_instance_valid(_held) else "", "baked": not record.is_empty(), "problems": problems,
		"walk": speed_of(false), "run": speed_of(true), "doing": _doing(), "life": _gesture.report() if is_instance_valid(_gesture) else {}}
