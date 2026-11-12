## A close call: she nearly had you (DECISIONS 2026-11-12, after the sanity meter: "some 'fake' just about made it
## feelings. The game doesn't need to be mathematically fair, just needs to feel like it is ... a monster is running
## towards us as I'm shooting it ... I run out of shells, so I reload, normally it would reach me before I reload and
## I'd die but if x criteria is met or x chance it somewhat slows down or acts in a way that seems like it's about to
## kill me but gives me just enough time for reload to finish and I shoot it. It doesn't have to be with shooting
## either, hiding etc, just needs to feel intense").
##
## Put one under the character who hunts you (beside her chase.gd or her searcher.gd; a hunt.gd's hunter). When she's
## about to have you and one of its cases holds, by its `chance`, she falters: still coming, slower and slower, a
## lunge, her breath in your ear, never quite reaching you. It lasts until what you were doing is done plus a moment
## (`grace`: your shot), and never longer than `max_secs`: then she comes on as before. Its cases, each a switch:
##   reloading   your gun is open (the weapons plugin's, or anything in the group hs_weapon with `reloading`)
##   empty_gun   the beat between the click on an empty gun and your reload (shells left in the pocket)
##   while_needs the Story's words: while they hold ("on:fuse": you're at the fuse box)
##   hiding      the time her searcher would have found you where you hide: she leans in, stays `linger` seconds
##               longer, and goes
## A script can ask for one: call_it("the door", 2.0). How often: `chance` (less as your sanity falls: `sanity_sync`),
## the first one in a game sure (`first_sure`), `per_chase`, a `cooldown` between them, `needs`. `began(kind)` and
## `ended(kind, made_it)` to hang a line or a sound on. It's a cheat in the player's favour, so keep it rare enough
## that they never see it: one a chase, not every chase.
extends Node

signal began(kind: String)
signal ended(kind: String, made_it: bool)             ## made_it: what you were doing got done before she came on

@export_range(0.0, 1.0) var chance := 0.75           ## how likely a chase or a search gets one
@export var first_sure := true                        ## the first that could happen in a game does
@export var per_chase := 1                            ## at most this many in one chase
@export var cooldown := 40.0                          ## seconds before another
@export var needs := ""                               ## the Story's words: only while they hold
@export var sanity_sync := 0.5                        ## how much less likely at no sanity (a Sanity node in the scene): 0 the same; 1 never
@export_group("When")
@export var reloading := true                         ## while your gun is being reloaded
@export var empty_gun := true                         ## and between the click on an empty gun and the reload
@export var while_needs := ""                         ## while these hold (the Story's words): you're busy with something
@export var hiding := true                            ## the time she'd have found you hiding
@export_group("How")
@export var hold_m := 2.8                             ## she starts to falter this far from you
@export var stop_m := 1.3                             ## and comes no nearer than about this while it lasts
@export var max_secs := 4.0                           ## it never lasts longer: then she has you
@export var grace := 0.5                              ## seconds after you're done before she comes on again (your shot)
@export var linger := 1.6                             ## hiding: seconds longer she stays, leaning in
@export var move := "lunge"                           ## her move while it lasts (her moves.gd)
@export var sound := "breath_close"                   ## off the shelf, at her head
@export_range(0.0, 1.0) var scare := 0.35             ## how much the Fear node jumps

var holding := false                                  ## she's faltering now (her chase won't catch you while this is so)
var kind := ""                                        ## why: reloading, empty, busy, hiding, or a script's word
var count := 0                                        ## close calls so far
var made := 0                                         ## the ones you came out of with what you were doing done
var last := {}                                        ## the last one: {kind, secs, nearest, made_it}
var _clock := 0.0
var _last_at := -10000.0
var _this_chase := 0
var _held := 0.0
var _after := 0.0
var _nearest := INF
var _asked := ""
var _asked_secs := 0.0
var _rolled := false
var _roll_ok := false


func _process(dt: float) -> void:
	_clock += dt


## A chase is starting (chase.gd says so): its own count, a new roll.
func new_chase() -> void:
	_this_chase = 0
	_rolled = false


## A close call asked for by a script: the next time she's within reach, for `secs` (a door you're unlocking).
func call_it(why := "asked", secs := 2.0) -> void:
	_asked = why
	_asked_secs = secs


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


# what you're doing that could save you now ("" nothing)
func _doing() -> String:
	if _asked != "":
		return _asked
	if reloading or empty_gun:
		for g in get_tree().get_nodes_in_group("hs_weapon"):
			if not bool(g.get("owned")) or g.get("raised") == false:
				continue
			if reloading and bool(g.get("reloading")):
				return "reloading"
			if empty_gun and g.get("loaded") != null and int(g.get("loaded")) <= 0 and g.get("spare") != null and int(g.get("spare")) > 0:
				return "empty"
	if while_needs != "":
		var st := _story()
		if st != null and st.has_method("holds") and st.holds(while_needs):
			return "busy"
	return ""


# whether one may happen now: its rest, its count, its needs, its roll (made once a chase or a search)
func _may(in_chase := true) -> bool:
	if _clock - _last_at < cooldown or (in_chase and per_chase > 0 and _this_chase >= per_chase):
		return false
	var st := _story()
	if needs != "" and (st == null or not st.has_method("holds") or not st.holds(needs)):
		return false
	if not _rolled:
		_rolled = true
		var p := chance
		var san := get_tree().get_first_node_in_group("hs_sanity")
		if san != null and sanity_sync > 0.0 and san.get("sanity") != null:
			p *= 1.0 - sanity_sync * (1.0 - float(san.get("sanity")))
		_roll_ok = (first_sure and count == 0) or randf() < p
	return _roll_ok


func _begin(k: String, her: Node3D) -> void:
	holding = true
	kind = k
	count += 1
	_this_chase += 1
	_held = 0.0
	_after = 0.0
	_nearest = INF
	if her != null:
		for c in her.get_children():
			if c.has_method("play") and c.has_method("resolve") and move != "":
				c.play(move)
		var snd := get_tree().get_first_node_in_group("hs_sound")
		if sound != "" and snd != null and snd.has_method("play"):
			snd.play(sound, her.global_position + Vector3.UP * 1.5, 2.0, "event")
	var fear := get_tree().get_first_node_in_group("hs_fear")
	if fear != null and fear.has_method("scare") and scare > 0.0:
		fear.scare(scare)
	began.emit(k)


func _end(made_it: bool) -> void:
	holding = false
	_last_at = _clock
	if made_it:
		made += 1
	last = {"kind": kind, "secs": _held, "nearest": _nearest, "made_it": made_it}
	if kind == _asked:
		_asked = ""
	_rolled = false
	ended.emit(kind, made_it)


## How fast she comes this frame, 0..1 of her speed (chase.gd asks every frame she runs): 1 unless it's a close call.
func factor(her: Node3D, pl: Node3D, dt: float) -> float:
	if her == null or pl == null:
		return 1.0
	var to := pl.global_position - her.global_position
	var d := Vector2(to.x, to.z).length()
	if holding:
		_held += dt
		_nearest = minf(_nearest, d)
		var still := _doing()
		if kind == _asked and _asked != "":
			still = _asked if _held < _asked_secs else ""
		if still == "":
			_after += dt
			if _after >= grace:
				_end(true)
				return 1.0
		else:
			_after = 0.0
		if _held >= max_secs:
			_end(false)
			return 1.0
		return _slow(d)
	if d <= hold_m:
		var k := _doing()
		if k != "" and _may():
			_begin(k, her)
			return _slow(d)
	return 1.0


# slower the nearer: her full speed at hold_m, a crawl at stop_m and inside it
func _slow(d: float) -> float:
	var t := clampf((d - stop_m) / maxf(0.05, hold_m - stop_m), 0.0, 1.0)
	return lerpf(0.03, 0.85, t * t)


## Hiding: she'd have found you. True: she doesn't (she leans in and stays `linger` longer: searcher.gd does it).
func spare(why: String, her: Node3D) -> bool:
	if why == "hiding" and not hiding:
		return false
	if holding or not _may(false):                        # (a search isn't a chase: its rest and its roll alone)
		return false
	_begin(why, her)
	_held = linger
	_end(true)
	return true


## What it's done, a check's.
func report() -> Dictionary:
	return {"holding": holding, "kind": kind, "count": count, "made": made, "last": last}
