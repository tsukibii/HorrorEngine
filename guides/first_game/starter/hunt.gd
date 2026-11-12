## The hunt: being hunted, as a hidden quest (docs/HUNT_PLAN.md, DECISIONS 2026-11-12: "a 'hidden' quest called survive
## the hunt ... select an npc that is hunting you ... behaviours (animations), jump scaring events, paths, hidden hunt
## event boxes around the map ... goes invisible ... 'kill' the player if it touches them ... the player can survive
## them too ... we don't want the creatures just running up to you, maybe if it's dark they would ... 'hunts' that
## basically act like haunting events, maybe you need to complete a task to get them to stop").
##
## One node anywhere in the scene. Pick the `hunter` (any character: a Studio export, a stand-in), its `kind`, what
## starts it (`needs`, or start()/fire() from any signal) and what ends it (`survive_secs`, `ends_when`: the Story's
## words, as "task:power"; a safe room; her shot down). Then drop hunt spots round the map (hunt_spot.gd): the hunt
## plays the ones that are possible, a few seconds apart, worse as its stage goes up.
##   haunting   she never touches you. Getting close: the lights blink and she's somewhere else
##   stalking   she can rush you; caught is a fright (chase.gd's), no death
##   lethal     caught, you die: back to the Story's checkpoint (checkpoint.gd), the hunt a stage lower
## She keeps her distance. She rushes only when a rule you ticked holds (`rush_dark`: your flashlight off or dead;
## `rush_ran`: you ran; `rush_stared`: you looked at her too long; `rush_back`: she's behind you, close, unseen), from
## `rush_stage` on, after a tell of `tell_secs` (a sound, the flashlight dipping, her look), and never again for
## `rush_rest` seconds. Dark means your flashlight off or dead and no lamp that's on reaching you. The rush is chase.gd under her (one is made when she has none): doors hold her, 6 s out of her
## sight loses her, `safe_rooms` end it, hiding during the tell calls it off.
## Hidden: nothing on the to-do list unless `reveal_task` ("survive: Survive.") at `reveal_at`. While it runs the fact
## `hunt:<its name>` is set, and `hunt:<its name>:<n>` once stage n has come: anything's `needs` can read them. Her
## moves are her moves.gd's (Kimodo clips), her look her HSLookSwitch's, her cloak her HSCloak's. With a Sanity node
## in the scene (sanity.gd) it goes faster as your sanity falls (`sanity_sync`), and its Needs can wait for
## `sanity:shaken`.
extends Node

const Sight := preload("res://starter/sight.gd")
const Lights := preload("res://starter/lights.gd")
const ChaseScript := preload("res://starter/chase.gd")

signal started
signal staged(stage: int)                                 ## a new stage
signal spot_played(spot: Node)
signal scared                                             ## a spot that's a scare (the Fear node and the director hear it)
signal telling                                            ## the tell before a rush
signal rushed                                             ## she's coming
signal touched                                            ## a haunting: you got too close, she's gone
signal caught                                             ## she has you
signal ended(how: String)                                 ## survived, task, safe, shot, stopped

@export var hunter: Node3D                                ## who hunts
@export_enum("haunting", "stalking", "lethal") var kind := "haunting"
@export_group("Starts and ends")
@export var needs := ""                                   ## it starts by itself once these hold (the Story's words); empty: start() or fire()
@export var survive_secs := 0.0                           ## it ends after this long (0: not by time)
@export var ends_when := ""                               ## it ends when these hold: "task:power"
@export var safe_ends := false                            ## reaching a safe room ends it
@export var ends_when_down := true                        ## she's shot down (an HSHitReact or HSShootable under her): it ends
@export var again := false                                ## it can start again after it ends
@export_group("Hidden quest")
@export var reveal_task := ""                             ## a task shown for it, "id: what it says" (empty: wholly hidden)
@export_enum("start", "first sighting", "never") var reveal_at := "first sighting"
@export var start_says := ""
@export var end_says := ""
@export var fact := ""                                    ## set when it's survived
@export var tick := ""                                    ## a task ticked when it's survived (the revealed one is ticked anyway)
@export var target: Node                                  ## its fire() when it's survived
@export_group("Stages and pace")
@export_range(1, 9) var stages := 4
@export var stage_secs := PackedFloat32Array([30.0, 45.0, 60.0])   ## how long stages 1, 2, 3... last (the last one stays)
@export var gap_min := 7.0                                ## seconds between spots
@export var gap_max := 18.0
@export var spots: Array[Node] = []                       ## its hunt spots (empty: every one in the scene that's its own or anyone's)
@export var follow_m := 7.0                               ## follow: how far down your trail she starts
@export var follow_min_m := 2.2                           ## and the nearest she comes
@export var touch_m := 1.1                                ## a haunting: nearer than this and she's gone
@export_group("The rush")
@export_range(1, 9) var rush_stage := 3                   ## no rush before this stage
@export var rush_dark := true                             ## your flashlight off or dead for `dark_secs`
@export var rush_ran := false                             ## you ran for a second
@export var rush_stared := false                          ## you looked at her 4 s
@export var rush_back := false                            ## she's behind you inside 6 m, unseen 3 s
@export var dark_secs := 3.0
@export var tell_secs := 1.4                              ## the warning before she comes (never under a second)
@export var tell_sound := "breath_close"
@export var tell_look := ""                               ## her look for the tell and the rush (her HSLookSwitch)
@export var rush_rest := 20.0                             ## seconds before she can rush again
@export var chase: Node                                   ## her chase.gd (empty: the one under her, or one made)
@export var safe_rooms := PackedStringArray()             ## rooms she won't follow you into
@export_group("Sanity")
@export var sanity_sync := 1.0                            ## how much low sanity speeds it up (a Sanity node in the scene): 0 not at all; 1: twice as fast at nothing
@export_group("Being caught")
@export var kill_sound := "sting_big"
@export var death_title := "You died"
@export_multiline var death_text := ""
@export var mercy_after := 2                              ## deaths in this hunt before she goes easier (0: never)
@export var grace := 10.0                                 ## seconds after a retry with no rush
@export_group("Invisible")
@export var cloaked := false                              ## she's cloaked while it runs (an HSCloak under her), seen when a spot shows her
@export var head_m := 1.5

var running := false
var done := false                                         ## it has ended at least once
var how := ""                                             ## how it last ended
var stage := 0
var clock := 0.0                                          ## seconds it has run
var aggression := 0.0                                     ## 0..1: up in the dark and when you run, down in the light
var deaths := 0
var rushes := 0
var played: Array = []                                    ## the spots played, in order: their names (a check's)
var active: Node = null                                   ## the spot playing
var state := "idle"                                       ## idle, quiet (between spots), spot, tell, rush
var lit_by := ""                                          ## the lamp that's lighting you (why she won't rush), "" in the dark or by your flashlight
var revealed_until := 0.0                                 ## cloaked: seen anyway until then (soaked, lit)
var _stage_t := 0.0
var _next := 0.0
var _sp := {}
var _last_spot: Node = null
var _dark := 0.0
var _ran := 0.0
var _rest := 0.0
var _grace := 0.0
var _tell_t := 0.0
var _trail: Array = []                                    # where you've walked, half a metre apart
var _revealed := false
var _hidden_was := false
var _died_at := 0
var _lamps_at := -1.0
var _lamp_lit := false


func _ready() -> void:
	add_to_group("hs_hunt")
	add_to_group("hs_scare")
	_wire.call_deferred()


func _wire() -> void:
	var st := _story()
	if st != null and st.has_signal("revived") and not st.revived.is_connected(_on_revived):
		st.revived.connect(_on_revived)
	if hunter != null:
		for c in hunter.get_children():
			if c.has_signal("down") and not c.down.is_connected(_on_down):
				c.down.connect(_on_down)
			if c.has_signal("touched") and not c.touched.is_connected(_on_soaked):
				c.touched.connect(_on_soaked)             # (a water shell: a cloaked one shows for a while)


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


func _player() -> Node3D:
	return get_tree().get_first_node_in_group("hs_player") as Node3D


func _cam(pl: Node3D) -> Camera3D:
	return pl.get_node_or_null("Eye") as Camera3D if pl != null else null


func _moves() -> Node:
	if hunter == null:
		return null
	for c in hunter.get_children():
		if c.has_method("play") and c.has_method("resolve"):
			return c
	return null


func _cloak() -> Node:
	if hunter == null:
		return null
	for c in hunter.get_children():
		if c.has_method("cloak") and c.has_method("reveal"):
			return c
	return null


func can_cloak() -> bool:
	return _cloak() != null


func _chase() -> Node:
	if chase != null and is_instance_valid(chase):
		return chase
	if hunter == null:
		return null
	for c in hunter.get_children():
		if c.get_script() == ChaseScript:
			chase = c
	if chase == null:
		chase = Node.new()
		chase.name = "HuntChase"
		chase.set_script(ChaseScript)
		chase.set("mood", "chase")
		hunter.add_child(chase)
	if not chase.caught.is_connected(_on_caught):
		chase.caught.connect(_on_caught)
		chase.escaped.connect(_on_got_away)
		chase.lost.connect(_on_got_away)
	if not safe_rooms.is_empty():
		chase.set("safe_rooms", safe_rooms)
	chase.set("head_m", head_m)
	return chase


func fact_name() -> String:
	return "hunt:" + str(name)


## Start it (from a signal too: whatever it sends is ignored).
func start(_a = null, _b = null, _c = null) -> void:
	if running or hunter == null or (done and not again):
		return
	running = true
	how = ""
	clock = 0.0
	deaths = 0
	_revealed = false
	_set_stage(1)
	_begin_quiet(randf_range(gap_min, gap_max) * 0.5)
	_hide_her()
	var st := _story()
	if st != null:
		if st.has_method("flag"):
			st.flag(fact_name())
		if start_says != "" and st.has_method("say"):
			st.say(start_says)
		if kind == "lethal" and st.has_method("checkpoint"):
			st.checkpoint()                               # (somewhere to come back to, if nothing nearer is kept later)
	if reveal_at == "start":
		_reveal()
	if cloaked and _cloak() != null:
		_cloak().cloak(0.0)
	started.emit()


func fire(_a = null, _b = null, _c = null) -> void:
	start()


## Over (from a signal too): she's gone, nothing set.
func stop(_a = null, _b = null) -> void:
	if running:
		_end("stopped")


func _reveal() -> void:
	if _revealed or reveal_task == "":
		return
	_revealed = true
	var st := _story()
	if st != null and st.has_method("add_line"):
		st.add_line(reveal_task)


func _set_stage(n: int) -> void:
	stage = clampi(n, 1, stages)
	_stage_t = 0.0
	var st := _story()
	if st != null and st.has_method("flag"):
		st.flag("%s:%d" % [fact_name(), stage])
	staged.emit(stage)


func _begin_quiet(secs: float) -> void:
	state = "quiet"
	active = null
	_sp = {}
	_next = secs


func _hide_her() -> void:
	if hunter == null:
		return
	hunter.visible = false
	hunter.set_meta("hs_hidden", true)
	if hunter.is_in_group("hs_threat"):
		hunter.remove_from_group("hs_threat")
	var mv := _moves()
	if mv != null:
		mv.stop()


func _show_her(at: Vector3, face: Vector3, mv_name: String, anim := "", speed := -1.0) -> void:
	hunter.global_position = at
	var to := face - at
	if Vector2(to.x, to.z).length() > 0.05:
		hunter.global_rotation.y = atan2(to.x, to.z)
	hunter.visible = true
	hunter.set_meta("hs_hidden", false)
	if not hunter.is_in_group("hs_threat"):
		hunter.add_to_group("hs_threat")
	if anim != "":
		for ap in hunter.find_children("*", "AnimationPlayer", true, false):
			if (ap as AnimationPlayer).has_animation(anim):
				(ap as AnimationPlayer).play(anim)
				return
	var mv := _moves()
	if mv != null and mv_name != "":
		mv.play(mv_name, speed)


func _vanish(lamp: Light3D = null) -> void:
	Lights.blink(get_tree(), lamp, 0.15)
	get_tree().create_timer(0.07).timeout.connect(func() -> void:
		if state != "rush" and state != "tell":
			_hide_her())


func _end(how_: String) -> void:
	running = false
	done = true
	how = how_
	state = "idle"
	active = null
	var c := chase
	if c != null and is_instance_valid(c) and c.has_method("stop"):
		c.stop()
	_hide_her()
	_look("")
	if cloaked and _cloak() != null:
		_cloak().reveal(0.0)
	var st := _story()
	if st != null:
		if st.has_method("unflag"):
			st.unflag(fact_name())
		if how_ != "stopped":
			var i := reveal_task.find(":")
			if _revealed and i > 0 and st.has_method("tick"):
				st.tick(reveal_task.substr(0, i).strip_edges())
			if fact != "" and st.has_method("flag"):
				st.flag(fact)
			if tick != "" and st.has_method("tick"):
				st.tick(tick)
			if end_says != "" and st.has_method("say"):
				st.say(end_says)
	if how_ != "stopped" and target != null and is_instance_valid(target) and target.has_method("fire"):
		target.fire()
	ended.emit(how_)


func _process(dt: float) -> void:
	var st := _story()
	if not running:
		if needs != "" and (not done or again) and hunter != null and st != null and st.has_method("holds") and st.holds(needs):
			start()
		return
	var pl := _player()
	var cam := _cam(pl)
	if pl == null or cam == null or hunter == null:
		return
	if st != null and (bool(st.get("over")) or (st.has_method("card_up") and st.card_up())):
		return                                            # (under a card, at the ending, dead: nothing moves)
	clock += dt
	var fast := pressure()
	_stage_t += dt * fast
	_rest = maxf(0.0, _rest - dt * fast)
	_grace = maxf(0.0, _grace - dt)
	_dread()
	# where you've walked (follow, a rush's start)
	if _trail.is_empty() or (_trail[-1] as Vector3).distance_to(pl.global_position) >= 0.5:
		_trail.append(pl.global_position)
		if _trail.size() > 80:
			_trail.pop_front()
	# what ends it
	if survive_secs > 0.0 and clock >= survive_secs:
		_end("survived")
		return
	if ends_when != "" and st != null and st.has_method("holds") and st.holds(ends_when):
		_end("task")
		return
	if safe_ends and _in_safe(pl):
		_end("safe")
		return
	# its stage
	if stage < stages and stage - 1 < stage_secs.size() and _stage_t >= stage_secs[stage - 1]:
		_set_stage(stage + 1)
	_feel(pl, dt)
	match state:
		"quiet":
			if _wants_rush(pl, cam) and _begin_tell(pl, cam):
				return
			_next -= dt * fast
			if _next <= 0.0:
				if not _pick(pl, cam):
					_next = 1.0                           # nothing possible this second: again soon
		"spot":
			if kind != "haunting" and _wants_rush(pl, cam) and _sp.get("on_stage", false) and _begin_tell(pl, cam):
				return
			_run_spot(pl, cam, dt)
		"tell":
			_tell_t -= dt
			_face(pl.global_position, dt)
			if str(pl.get("pose")) == "hiding":
				_call_off()                               # you hid in time
			elif _tell_t <= 0.0:
				state = "rush"
				rushes += 1
				rushed.emit()
				_chase().start()
		"caught":
			_tell_t -= dt
			if _tell_t <= 0.0:
				_after_rush()
		"rush":
			var mv := _moves()
			if mv != null:
				mv.play("run", float(pl.get("run_speed")) * 0.95 if pl.get("run_speed") != null else 3.0)
			var c := _chase()
			if str(c.get("state")) == "done" or str(c.get("state")) == "idle":
				_after_rush()


# how afraid of the dark she makes you: her aggression, and the counters the rush rules read
func _feel(pl: Node3D, dt: float) -> void:
	var lit := _lit(pl)
	_dark = 0.0 if lit else _dark + dt
	_ran = _ran + dt if pl.has_method("doing") and str(pl.doing()) == "running" else maxf(0.0, _ran - dt * 2.0)
	var up := (0.0 if lit else 0.03) + (0.06 if _ran > 0.5 else 0.0) + 0.004 * stage
	var down := 0.02 if lit and _ran <= 0.0 else 0.0
	var cap := 1.0 if mercy_after <= 0 or deaths < mercy_after else 0.6
	aggression = clampf(aggression + (up * pressure() - down) * dt, 0.0, cap)


# you're in light: your flashlight on, or a lamp that's on reaching where you stand (looked at five times a second)
func _lit(pl: Node3D) -> bool:
	var t := pl.get_node_or_null("Eye/Flashlight") as Light3D
	if t != null and t.visible and not bool(t.get("is_dead")) and t.light_energy > 0.02:
		lit_by = ""
		return true
	if clock - _lamps_at >= 0.2:
		_lamps_at = clock
		_lamp_lit = false
		lit_by = ""
		var at := pl.global_position + Vector3.UP
		for l in get_tree().root.find_children("*", "Light3D", true, false):
			if l == t or l is DirectionalLight3D or not (l as Light3D).is_visible_in_tree() or not Lights.is_on(l) or (l as Light3D).light_energy <= 0.05:
				continue
			var reach := float(l.get("omni_range")) if l is OmniLight3D else float(l.get("spot_range"))
			var from: Vector3 = (l as Light3D).global_position
			if from.distance_to(at) <= reach * 0.8 and Sight.clear(pl, from, at, [pl]):   # (a lamp behind a wall doesn't light you)
				_lamp_lit = true
				lit_by = str(l.get_path())
				break
	return _lamp_lit


func _wants_rush(pl: Node3D, cam: Camera3D) -> bool:
	if kind == "haunting" or stage < rush_stage - (1 if _sanity() < 0.25 else 0) or _rest > 0.0 or _grace > 0.0:
		return false
	if str(pl.get("pose")) == "hiding" or _in_safe(pl):
		return false
	if rush_dark and _dark >= dark_secs:
		return true
	if rush_ran and _ran >= 1.0:
		return true
	if rush_stared and float(_sp.get("seen_t", 0.0)) >= 4.0:
		return true
	if rush_back and bool(_sp.get("on_stage", false)) and float(_sp.get("unseen_t", 0.0)) >= 3.0 \
			and hunter.global_position.distance_to(pl.global_position) <= 6.0 \
			and Sight.off_deg(cam, hunter.global_position + Vector3.UP * head_m) > 100.0:
		return true
	return false


# the warning: she's somewhere you can't see her yet (where she already is, a spot out of your sight, or back down
# your trail), a sound from there, your flashlight dips, her look. False: nowhere to come from, no rush
func _begin_tell(pl: Node3D, cam: Camera3D) -> bool:
	var from := Vector3.INF
	if bool(_sp.get("on_stage", false)) and hunter.visible:
		from = hunter.global_position
	else:
		var best := INF
		for s in _spots():
			var p: Vector3 = (s as Node3D).global_position
			var d := p.distance_to(pl.global_position)
			if d >= 5.0 and d <= 16.0 and d < best and not Sight.figure_seen(cam, p, head_m, [pl], 8.0):
				best = d
				from = p
		if from == Vector3.INF:
			from = trail_point(follow_m)
	if from == Vector3.INF:
		return false
	active = null
	_sp = {"on_stage": true}
	state = "tell"
	_tell_t = maxf(1.0, tell_secs * (1.5 if mercy_after > 0 and deaths >= mercy_after else 1.0) * lerpf(0.7, 1.0, _sanity()))
	_show_her(from, pl.global_position, "watch")
	if cloaked and _cloak() != null:
		_cloak().reveal(0.3)                              # (never from nothing: she's seen before she comes)
	_look(tell_look)
	_sound(tell_sound, from + Vector3.UP * head_m, 2.0, "event")
	var t := pl.get_node_or_null("Eye/Flashlight")
	if t != null and "flick" in t:
		t.set("flick", 0.35)
		get_tree().create_timer(0.35).timeout.connect(func() -> void:
			if is_instance_valid(t):
				t.set("flick", 1.0))
	telling.emit()
	return true


func _call_off() -> void:
	_rest = rush_rest * 0.5
	aggression *= 0.5
	_look("")
	_hide_her()
	_begin_quiet(randf_range(gap_min, gap_max))


func _after_rush() -> void:
	_rest = rush_rest
	aggression *= 0.3
	_dark = 0.0
	_ran = 0.0
	_look("")
	if cloaked and _cloak() != null:
		_cloak().cloak(0.4)
	if running:
		_hide_her()
		_begin_quiet(randf_range(gap_min, gap_max))


func _on_got_away() -> void:
	pass                                                  # (the rush state sees the chase is done)


func _on_caught() -> void:
	caught.emit()
	if not running:
		return
	state = "caught"                                      # (her in your face a moment: chase.gd's fright, or the kill)
	_tell_t = 1.2
	if kind == "lethal":
		_died_at = stage
		deaths += 1
		_sound(kill_sound, hunter.global_position + Vector3.UP * head_m, 0.0, "event")
		var mv := _moves()
		if mv != null:
			mv.play("kill")
		var st := _story()
		get_tree().create_timer(0.8).timeout.connect(func() -> void:
			if st != null and st.has_method("die"):
				st.die(str(name), death_title, death_text))


# back from the dead (the Story's checkpoint): the hunt a stage lower than it killed you at, no rush for a while
func _on_revived() -> void:
	if not running:
		return
	_hide_her()
	_look("")
	_set_stage(maxi(1, _died_at - 1))
	_grace = grace
	_rest = rush_rest
	_dark = 0.0
	_ran = 0.0
	aggression = 0.0
	_trail = []
	_begin_quiet(gap_max)


func _on_down() -> void:
	if running and ends_when_down:
		_end("shot")


func _on_soaked(info: Dictionary = {}) -> void:
	if str(info.get("touch", "")) == "soak":
		reveal_for(12.0)


## Cloaked, she's seen anyway for `secs` (a water shell does this by itself; a light held on her, your own script).
func reveal_for(secs: float) -> void:
	revealed_until = maxf(revealed_until, clock + secs)
	var c := _cloak()
	if c != null:
		c.reveal(0.4)


# ---- the spots -------------------------------------------------------------------------------------------------

func _spots() -> Array:
	if not spots.is_empty():
		return spots.filter(func(s) -> bool: return s != null and is_instance_valid(s))
	return get_tree().get_nodes_in_group("hs_hunt_spot").filter(func(s) -> bool: return s.get("hunt") == null or s.get("hunt") == self)


func _pick(pl: Node3D, cam: Camera3D) -> bool:
	var ok := _spots().filter(func(s) -> bool: return s.has_method("ready_for") and s.ready_for(self, pl, cam, clock))
	var fresh := ok.filter(func(s) -> bool: return s != _last_spot)
	if not fresh.is_empty():
		ok = fresh
	if ok.is_empty():
		return false
	var sum := 0.0
	for s in ok:
		sum += maxf(0.0, float(s.get("weight")))
	var r := randf() * sum
	var pick: Node = ok[-1]
	for s in ok:
		r -= maxf(0.0, float(s.get("weight")))
		if r <= 0.0:
			pick = s
			break
	play_spot(pick)
	return true


## Play a spot now (the hunt does this itself; a script can: a finale).
func play_spot(s: Node) -> void:
	var pl := _player()
	if s == null or pl == null or hunter == null:
		return
	active = s
	_last_spot = s
	s.set("plays", int(s.get("plays")) + 1)
	s.set("last", clock)
	played.append(str(s.name))
	state = "spot"
	var k := str(s.get("kind"))
	var at: Vector3 = (s as Node3D).global_position
	var face: Vector3 = pl.global_position if bool(s.get("face_you")) else at + (s as Node3D).global_basis.z
	_sp = {"kind": k, "t": 0.0, "seen_t": 0.0, "unseen_t": 0.0, "first": false, "on_stage": false}
	var tg = s.get("target")
	if tg is Node and is_instance_valid(tg) and (tg as Node).has_method("fire"):
		(tg as Node).fire()
	match k:
		"watch", "wait", "peek", "custom":
			_sp["on_stage"] = true
			_show_her(at, face, s.her_move(), str(s.get("animation")))
			_uncloak_for_spot()
		"dart", "pass":
			_sp["on_stage"] = true
			var goal: Vector3 = (s.get("to") as Node3D).global_position
			_sp["goal"] = goal
			_sp["speed"] = float(s.get("speed")) if k == "dart" else 1.4
			_show_her(at, goal, s.her_move(), str(s.get("animation")), float(_sp["speed"]))
			if k == "pass":
				if _cloak() != null:
					_cloak().cloak(0.0)
			else:
				_uncloak_for_spot()
				_scare(s)
			_spot_sound(s, at)
		"ambush":
			_sp["on_stage"] = true
			var eye := _cam(pl)
			var d := at - pl.global_position
			d.y = 0.0
			if d.length() > 1.2:                          # (she comes out to a metre from you)
				at = pl.global_position + d.normalized() * 1.0
				at.y = (s as Node3D).global_position.y
			_show_her(at, pl.global_position, s.her_move(), str(s.get("animation")))
			_uncloak_for_spot()
			_spot_sound(s, at, "sting_big")
			_scare(s, 0.8)
			if eye != null and bool(s.get("catches")) and kind != "haunting" and _grace <= 0.0 \
					and Vector2(d.x, d.z).length() <= 1.3:
				_on_caught()
		"follow":
			_sp["on_stage"] = true
			_sp["back"] = follow_m
			_show_her(trail_point(follow_m), pl.global_position, s.her_move(), str(s.get("animation")))
			_uncloak_for_spot()
		"door":
			var dr = s.get("door")
			if dr is Node:
				(dr as Node).set("open", bool(s.get("door_open")))
			_spot_sound(s, (dr as Node3D).global_position + Vector3.UP if dr is Node3D else at)
			_scare(s)
		"decoy":
			_spot_sound(s, at + Vector3.UP)
	if reveal_at == "first sighting" and bool(_sp["on_stage"]) and k != "pass":
		_sp["reveal"] = true
	s.emit_signal("played")
	spot_played.emit(s)
	if k == "door" or k == "decoy":
		_begin_quiet(randf_range(gap_min, gap_max) * _pace())


func _uncloak_for_spot() -> void:
	if cloaked and _cloak() != null:
		_cloak().reveal(0.5)


func _pace() -> float:
	return lerpf(1.0, 0.55, float(stage - 1) / maxf(1.0, float(stages - 1)))


func _spot_sound(s: Node, at: Vector3, fallback := "") -> void:
	var snd := str(s.get("sound"))
	_sound(snd if snd != "" else fallback, at, float(s.get("sound_db")), "event")


func _scare(s: Node, least := 0.0) -> void:
	var k := maxf(float(s.get("scare")), least)
	if k <= 0.0:
		return
	var fear := get_tree().get_first_node_in_group("hs_fear")
	if fear != null and fear.has_method("scare"):
		fear.scare(k)
	scared.emit()


func _spot_over(lamp: Light3D = null, blink := true) -> void:
	if blink:
		_vanish(lamp)
	else:
		_hide_her()
	if cloaked and _cloak() != null:
		_cloak().cloak(0.0)
	_begin_quiet(randf_range(gap_min, gap_max) * _pace())


func _run_spot(pl: Node3D, cam: Camera3D, dt: float) -> void:
	var s := active
	if s == null or not is_instance_valid(s):
		_begin_quiet(gap_min)
		return
	_sp["t"] = float(_sp["t"]) + dt
	var k := str(_sp["kind"])
	var seen: bool = hunter.visible and Sight.figure_seen(cam, hunter.global_position, head_m, [pl]) \
		and (not cloaked or _cloak() == null or not _cloak().is_cloaked() or clock < revealed_until)
	if seen:
		_sp["seen_t"] = float(_sp["seen_t"]) + dt
		_sp["unseen_t"] = 0.0
		if not bool(_sp["first"]):
			_sp["first"] = true
			if k != "dart" and k != "ambush":
				_scare(s)
				_spot_sound(s, hunter.global_position + Vector3.UP * head_m)
			if bool(_sp.get("reveal", false)):
				_reveal()
	else:
		_sp["unseen_t"] = float(_sp["unseen_t"]) + dt
	var lamp := s.get("blink_lamp") as Light3D
	var near := hunter.global_position.distance_to(pl.global_position)
	# too close to someone who doesn't touch (a haunting; any hunt while she only watches): gone
	if k != "ambush" and near <= touch_m and (kind == "haunting" or k != "dart"):
		touched.emit()
		_scare(s, 0.5)
		_spot_over(lamp)
		return
	match k:
		"watch", "wait", "custom":
			if float(_sp["seen_t"]) >= float(s.get("stare")) or (float(_sp["t"]) >= float(s.get("hold")) and not seen):
				_spot_over(lamp, seen)
		"peek":
			if _sp.has("back_t"):                         # drawing back behind the corner
				_sp["back_t"] = float(_sp["back_t"]) - dt
				hunter.global_position += -(s as Node3D).global_basis.x * (0.8 / 0.25) * dt
				if float(_sp["back_t"]) <= 0.0:
					_spot_over(null, false)
			elif (seen and Sight.off_deg(cam, hunter.global_position + Vector3.UP * head_m) <= 14.0 and float(_sp["seen_t"]) >= 0.3) \
					or float(_sp["seen_t"]) >= float(s.get("stare")) + 1.5:
				_sp["back_t"] = 0.25
			elif float(_sp["t"]) >= float(s.get("hold")) and not seen:
				_spot_over(null, false)
		"dart", "pass":
			var goal: Vector3 = _sp["goal"]
			var to := goal - hunter.global_position
			var step := float(_sp["speed"]) * dt
			if to.length() <= step:
				hunter.global_position = goal
				_spot_over(null, false)
			else:
				hunter.global_position += to.normalized() * step
				hunter.global_rotation.y = atan2(to.x, to.z)
		"ambush":
			if float(_sp["t"]) >= 0.9:
				_spot_over(lamp)
		"follow":
			_face(pl.global_position, dt)
			if float(_sp["seen_t"]) >= float(s.get("stare")) + 0.6 or float(_sp["t"]) >= 45.0:
				_spot_over(lamp, seen)
			elif float(_sp["unseen_t"]) >= 1.3 and float(_sp["back"]) > follow_min_m:
				var nb := maxf(follow_min_m, float(_sp["back"]) - 1.5)
				var p := trail_point(nb)
				if p != Vector3.INF and not Sight.figure_seen(cam, p, head_m, [pl], 12.0):
					_sp["back"] = nb
					_sp["unseen_t"] = 0.0
					hunter.global_position = p
					var mv := _moves()
					if mv != null:
						mv.play(s.her_move())


## the point `back_m` metres back along the way you came (INF: you haven't walked that far)
func trail_point(back_m: float) -> Vector3:
	var left := back_m
	for i in range(_trail.size() - 1, 0, -1):
		var seg := (_trail[i] as Vector3).distance_to(_trail[i - 1])
		if seg >= left:
			return (_trail[i] as Vector3).lerp(_trail[i - 1], left / maxf(seg, 0.001))
		left -= seg
	return Vector3.INF


func _face(p: Vector3, dt: float) -> void:
	var to := p - hunter.global_position
	if Vector2(to.x, to.z).length() > 0.05:
		hunter.global_rotation.y = lerp_angle(hunter.global_rotation.y, atan2(to.x, to.z), minf(1.0, dt * 6.0))


func _look(look_name: String) -> void:
	if hunter == null or (look_name == "" and tell_look == ""):
		return
	for c in hunter.find_children("*", "", true, false):
		if c.has_method("set_look"):
			c.set_look(look_name)
			return


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


func _sound(what: String, at: Vector3, db: float, how_ := "sfx") -> void:
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if what != "" and snd != null and snd.has_method("play"):
		snd.play(what, at, db, how_)


# the night's director holds its own moments back while a hunt runs: the hunt's spots are the moments
func _dread() -> void:
	var d := get_tree().get_first_node_in_group("hs_dread")
	if d != null and d.has_method("relax_for"):
		d.relax_for(2.0)


## How much faster it goes for your sanity: 1 calm (or no Sanity node), 1 + `sanity_sync` at nothing. Spots come
## closer together, stages sooner, her aggression up faster, the rest between rushes shorter.
func pressure() -> float:
	var san := get_tree().get_first_node_in_group("hs_sanity")
	if san == null or sanity_sync <= 0.0 or not san.has_method("pressure"):
		return 1.0
	return float(san.pressure(sanity_sync))


func _sanity() -> float:
	var san := get_tree().get_first_node_in_group("hs_sanity")
	return float(san.get("sanity")) if san != null and sanity_sync > 0.0 and san.get("sanity") != null else 1.0


## What it's doing, a check's.
func report() -> Dictionary:
	return {"running": running, "state": state, "stage": stage, "clock": clock, "aggression": aggression, "deaths": deaths,
		"rushes": rushes, "played": played, "active": str(active.name) if active != null and is_instance_valid(active) else "",
		"how": how, "her": hunter != null and hunter.visible, "rest": _rest, "grace": _grace, "dark": _dark, "pressure": pressure()}
