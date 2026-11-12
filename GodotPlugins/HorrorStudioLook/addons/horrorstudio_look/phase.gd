## Phasing in and out of the world (docs/GODOT_LOOK.md §5s, DECISIONS 2026-11-12, after the seats: "some effect for
## phasing in and out of the reality/world so it's almost like the creature is in the world but disappears, but not
## super abruptly"): a node to drop under a character. She goes as creature_phase.gdshader draws it: torn into thin
## level slices that jump sideways, drained to her own shadow, the slices going one by one; and comes back the same
## way, backwards. Between, she's on her own shaders (her skin, her eyes, her hair: nothing of this left on her), and
## once she's gone she's hidden, so nothing that asks whether she's there finds her.
##   - `phase_out(secs)` / `phase_in(secs)`: gone, and back;
##   - `stutter(secs)`: she tears for a moment and settles, nothing of her gone (something's wrong with her);
##   - `blink(away)`: gone, `away` seconds of nothing, back where she stood;
##   - `phase_to(where, away)`: gone here, back there (`where`: a Node3D or a place); `next_place()` the next of
##     `places`, in turn;
##   - `fire()`: what the starter kit's areas, cues and hunt spots call on their `target`: `on_fire` says which.
##     $Her/HSPhase.phase_out()                    # she comes apart and is gone
##     $Her/HSPhase.phase_to($Markers/ByTheBed)    # and is somewhere else
##     HSPhase.attach($Her, {"out": true})         # from a script: she starts gone
## A creature skin she wears by an HSLookSwitch beside this node is put back on when she's herself again. Not a tool
## script: in the editor it does nothing.
@icon("res://addons/horrorstudio_look/icons/phase.svg")
class_name HSPhase
extends Node

signal phased(out: bool)                          ## fully gone (true) or fully herself again (false)

@export var target: Node3D = null                 ## the character; empty: the parent
@export var out := false                          ## how she starts: gone
@export_range(0.05, 10.0) var seconds: float = 1.4    ## how long it takes to go or to come
@export var hide_when_out := true                 ## gone, she's hidden (nothing finds her: a threat, a hitbox, a shadow)
@export_enum("toggle", "out", "in", "stutter", "blink", "next place") var on_fire: String = "toggle"   ## what fire() does
@export var places: Array[NodePath] = []          ## where `next place` takes her, in turn (Marker3Ds)
@export_range(0.0, 20.0) var away_secs: float = 1.2   ## blink and phase_to: how long there's nothing of her
@export_group("How it looks")
@export_range(0.005, 0.3) var band_m: float = 0.035   ## a slice's height (m)
@export_range(0.0, 0.5) var tear_m: float = 0.07      ## how far a slice jumps sideways (m)
@export_range(1.0, 30.0) var rate: float = 12.0       ## jumps a second
@export_range(0.0, 0.3) var rise_m: float = 0.05      ## a slice lifts this far as it goes
@export_range(0.0, 1.0) var darken: float = 0.85      ## how far her colour drains to Tone before she goes
@export var tone: Color = Color(0.02, 0.025, 0.03)
@export_group("Sound")
@export var out_sound := ""                       ## off the sound shelf, as she goes (a game by hand: its Sound node)
@export var in_sound := ""

var amount := 0.0                                 # how far gone now: 0 herself, 1 gone
var goal := 0.0
var torn := 0.0                                   # a stutter's tear, falling back to 0
var materials: Array = []
var _rate := 1.0
var _torn_fall := 2.5
var _away := -1.0                                 # seconds of nothing left before she comes back (-1: not coming back by herself)
var _to = null                                    # where she comes back (a Node3D, a Vector3, or null: where she is)
var _place := 0
var _seed := 0.0
const NAME := "HSPhase"


func character() -> Node3D:
	return target if target != null else get_parent() as Node3D


## the phase under a node, or null
static func of(node: Node) -> HSPhase:
	for c in node.get_children():
		if c is HSPhase:
			return c
	return null


## a phase under a node (or the one already there); `settings`: this node's own numbers by name
static func attach(node: Node, settings: Dictionary = {}) -> HSPhase:
	var c := of(node)
	if c != null:
		return c
	c = HSPhase.new()
	c.name = NAME
	for k in settings:
		c.set(k, settings[k])
	node.add_child(c)
	return c


func _ready() -> void:
	if Engine.is_editor_hint():
		set_process(false)
		return
	_seed = float(hash(get_path()) % 997)
	_start.call_deferred()


func _start() -> void:
	if is_inside_tree():
		await get_tree().process_frame            # (after an HSCharacterLook beside it has put her look on)
	if out:
		amount = 1.0
		goal = 1.0
		var t := character()
		if t != null and hide_when_out:
			t.visible = false


func _look() -> Dictionary:
	return {"shader": "phase", "all": true, "shadow": true}


func _settings() -> Dictionary:
	return {"amount": amount, "stutter": torn, "band_m": band_m, "tear_m": tear_m, "rate": rate, "rise_m": rise_m, "darken": darken,
		"tone": tone, "seed": _seed}


func _wear() -> void:
	var t := character()
	materials = HSCreatureSkin.wear(t, _look(), _settings()) if t != null else []


func _sound(which: String) -> void:
	var t := character()
	if which == "" or t == null or not is_inside_tree():
		return
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null and snd.has_method("play"):
		snd.play(which, t.global_position + Vector3.UP * 1.2, 0.0, "event")


func is_out() -> bool:
	return goal > 0.5


## gone, over `secs` (under 0: this node's Seconds)
func phase_out(secs: float = -1.0) -> void:
	if goal < 1.0:
		_sound(out_sound)
	goal = 1.0
	_rate = 1.0 / maxf(secs if secs >= 0.0 else seconds, 0.01)
	if materials.is_empty() and amount < 1.0:
		_wear()


## herself again, over `secs`
func phase_in(secs: float = -1.0) -> void:
	var t := character()
	if t == null:
		return
	if goal > 0.0:
		_sound(in_sound)
	goal = 0.0
	_away = -1.0
	_rate = 1.0 / maxf(secs if secs >= 0.0 else seconds, 0.01)
	if amount > 0.0:
		t.visible = true
		if materials.is_empty():
			_wear()


## she tears for `secs` and settles; nothing of her goes
func stutter(secs: float = 0.4, strength: float = 0.7) -> void:
	torn = maxf(torn, clampf(strength, 0.0, 1.0))
	_torn_fall = torn / maxf(secs, 0.05)
	if materials.is_empty() and amount < 1.0:
		_wear()


## gone, nothing for `away` seconds (under 0: Away Secs), back where she stood
func blink(away: float = -1.0) -> void:
	_to = null
	_away = away if away >= 0.0 else away_secs
	phase_out()


## gone here, back at `where` (a Node3D: its place and the way it faces; a Vector3: that place) after `away` seconds
func phase_to(where, away: float = -1.0) -> void:
	_to = where
	_away = away if away >= 0.0 else away_secs
	phase_out()


## the next of `places`, in turn
func next_place(away: float = -1.0) -> void:
	if places.is_empty():
		blink(away)
		return
	var n := get_node_or_null(places[_place % places.size()]) as Node3D
	_place += 1
	phase_to(n, away)


## what an area's, a cue's or a hunt spot's target is asked to do
func fire() -> void:
	match on_fire:
		"out":
			phase_out()
		"in":
			phase_in()
		"stutter":
			stutter()
		"blink":
			blink()
		"next place":
			next_place()
		_:
			if is_out():
				phase_in()
			else:
				phase_out()


func _process(dt: float) -> void:
	advance(dt)


## a step of `dt` seconds (the game's own frames call it; a check can)
func advance(dt: float) -> void:
	var t := character()
	if t == null:
		return
	var before := amount
	amount = move_toward(amount, goal, _rate * dt)
	torn = move_toward(torn, 0.0, _torn_fall * dt)
	if amount >= 1.0:                             # gone
		if before < 1.0:
			if not materials.is_empty():
				HSCreatureSkin.clear(t)
				materials.clear()
			if hide_when_out:
				t.visible = false
			phased.emit(true)
		if _away >= 0.0:                          # and coming back by herself
			_away -= dt
			if _away <= 0.0:
				if _to is Node3D and is_instance_valid(_to):
					t.global_transform = Transform3D((_to as Node3D).global_basis.orthonormalized() * Basis.from_scale(t.global_basis.get_scale()), (_to as Node3D).global_position)
				elif _to is Vector3:
					t.global_position = _to
				_to = null
				phase_in()
		return
	if amount <= 0.0 and torn <= 0.0:
		if not materials.is_empty():              # herself again: her own shaders back, and the look she wore
			HSCreatureSkin.clear(t)
			materials.clear()
			for sib in (get_parent().get_children() if get_parent() != null else []):
				if sib is HSLookSwitch and (sib as HSLookSwitch).current() != "":
					var was := (sib as HSLookSwitch).current()
					(sib as HSLookSwitch).default(0.0)
					(sib as HSLookSwitch).set_look(was, 0.0)
			phased.emit(false)
		return
	for m in materials:
		if m is ShaderMaterial:
			m.set_shader_parameter("amount", amount)
			m.set_shader_parameter("stutter", torn)
