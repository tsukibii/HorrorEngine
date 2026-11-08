## A cold spot (docs/research/intensity.md §5.5; guides/tutorial_v2): an Area3D where it's freezing. Walk in and,
## after `breath_after` seconds, your breath shows (the Look plugin's HSBreath at your eye: a breath out every few
## seconds, seen only where a light reaches it, so a dark room hides it and your flashlight's beam shows it), and its
## `panes` (window panes with the plugin's glass: HSWindowPane nodes, or the glass meshes themselves) frost over from
## their bottom edge, up to `frost` in `frost_seconds`, while you watch. Walk out and your breath stops; the frost goes
## again over `thaw_seconds` (0: it stays). Only while `needs` holds (the Story's words). Its box: `interior` and `room`
## (that room's size), or a CollisionShape3D of your own. Saved for one cold place, or it reads as weather.
extends Area3D

signal chilled                                    ## you walked in: it's cold
signal warmed                                     ## you walked out

@export var interior: Node3D                      ## the interior (with interior.gd) whose `room` this area fills
@export var room := ""
@export var needs := ""
@export var panes: Array[Node] = []              ## window panes that frost over (HSWindowPane nodes, or glass meshes)
@export_range(0.0, 1.0) var frost := 0.8          ## how far up they frost (1: three quarters of the way)
@export var frost_seconds := 8.0                  ## the frost creeping up
@export var thaw_seconds := 30.0                  ## and going once you're out (0: it stays)
@export var breath := true                        ## your breath shows in here
@export var breath_after := 1.0                   ## seconds in before it does
@export_range(0.0, 1.0) var breath_strength := 0.6
@export var breath_every := 3.5                   ## seconds between breaths

var inside := false
var level := 0.0                                  ## the panes' frost now (a check's)
var _in_for := 0.0
var _breath: HSBreath = null


func _ready() -> void:
	body_entered.connect(func(b: Node3D) -> void:
		if b.is_in_group("hs_player") and _holds():
			inside = true
			_in_for = 0.0
			chilled.emit())
	body_exited.connect(func(b: Node3D) -> void:
		if b.is_in_group("hs_player") and inside:
			inside = false
			if _breath != null:
				_breath.on = false
			warmed.emit())
	if interior != null and room != "":
		interior.call_deferred("fit_area", self, room)


func _holds() -> bool:
	var st := get_tree().get_first_node_in_group("hs_story")
	return st == null or needs == "" or st.holds(needs)


## the player's breath (made at its eye the first time it's needed)
func breath_of(pl: Node) -> HSBreath:
	if _breath != null and is_instance_valid(_breath):
		return _breath
	var eye := pl.get_node_or_null("Eye") as Node3D
	if eye == null:
		return null
	_breath = eye.get_node_or_null("Breath") as HSBreath
	if _breath == null:
		_breath = HSBreath.make(eye, {"on": false})
		eye.add_child(_breath)
	return _breath


func _process(dt: float) -> void:
	var was := level
	if inside:
		_in_for += dt
		level = minf(frost, level + dt * frost / maxf(frost_seconds, 0.01))
		if breath and _in_for >= breath_after:
			var pl := get_tree().get_first_node_in_group("hs_player")
			var b := breath_of(pl) if pl != null else null
			if b != null and not b.on:
				b.settings({"on": true, "strength": breath_strength, "every": breath_every})
				b.exhale()                                # the first one now: you notice it as it comes
				b.next_at = b.clock + breath_every
	elif thaw_seconds > 0.0:
		level = maxf(0.0, level - dt * frost / thaw_seconds)
	if level != was:
		for p in panes:
			if p == null:
				continue
			if "frost" in p:
				p.frost = level                           # an HSWindowPane: on its glass, live
			elif p is MeshInstance3D:
				HSGlass.frost(p, level)
