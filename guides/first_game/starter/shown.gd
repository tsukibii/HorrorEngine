## Something that's there, or isn't (DECISIONS 2026-11-12, after the intensifiers: "a script that makes objects
## disappear (not deleted, just disappear visually), so we can trigger an event that makes it look like the table
## looks different or something is missing; we should also be able to make objects appear back, and be able to start
## them in game from either state, so I can reuse the same droppable script for appearing"). One script for both
## ways. Put it on a thing, or as a child of one (a Node under the table), or point `target` at it.
##   shown        how it starts in the game: there (on) or not (off)
##   shown_when   the Story's words: it's there while they hold, and not while they don't ("task:key" once that
##                task's ticked, "on:key" while it's on your list, a flag's name, "!flag" while it's off, several
##                apart by commas)
##   hidden_when  the other way round: gone while they hold
##   fire()       from an event area's, a cue's, a scare's or a moment's Target, or any signal: `on_fire` says
##                toggle, show or hide. From a script: appear(), vanish(), set_shown(on), toggle()
##   when_unseen  it only changes while you can't see it: you look back, and the cup isn't on the table
##   also         more things that come and go with it; swap_with: things that are there only while it isn't (the
##                table laid another way: put the two in the same place)
##   fade_secs    over this long instead of at once
## Nothing is deleted: it's hidden, and with `with_colliders` its own colliders are switched off with it, so you
## don't walk into a table that isn't there (a piece of an interior's export is part of its room's one collider:
## that stays solid). Its scripts keep running. `changed(shown)` says when it has.
extends Node

const Sight := preload("res://starter/sight.gd")
const WAS := "hs_shown_colliders"                   # on a body: [layer, mask] before it was switched off

signal changed(shown: bool)

@export var shown := true                           ## how it starts: there, or not
@export var target: Node3D                          ## the thing (empty: the node this is on, or its parent)
@export var also: Array[NodePath] = []              ## more things that come and go with it
@export var swap_with: Array[NodePath] = []         ## things there only while it isn't
@export_group("When")
@export var shown_when := ""                        ## the Story's words: there while they hold
@export var hidden_when := ""                       ## gone while they hold
@export_enum("toggle", "show", "hide") var on_fire := "toggle"   ## what fire() does
@export var when_unseen := false                    ## it changes only while you can't see it
@export_group("How")
@export var fade_secs := 0.0                        ## 0: at once
@export var with_colliders := true                  ## its own colliders go with it
@export var sound := ""                             ## off the shelf, played there as it changes (empty: silent)
@export var size_m := 1.0                           ## about how big it is: what "you can see it" goes by

var is_shown := true                                ## what it is now
var want := true                                    ## what it's been asked to be (waiting until you look away)
var changes := 0                                    ## times it's changed since the start
var _t := 0.0
var _started := false
var _tweens := {}                                   # a thing -> its fade


func _thing() -> Node3D:
	if target != null:
		return target
	var me: Node = self
	if me is Node3D:
		return me as Node3D
	return get_parent() as Node3D


func _nodes(paths: Array) -> Array:
	var out: Array = []
	for p in paths:
		var n := get_node_or_null(p) as Node3D
		if n != null:
			out.append(n)
	return out


func _ready() -> void:
	is_shown = shown
	want = shown
	_start.call_deferred()


func _start() -> void:
	var st := get_tree().get_first_node_in_group("hs_story") if is_inside_tree() else null
	if (shown_when != "" or hidden_when != "") and st != null and st.has_method("holds"):
		want = _asked(st)                           # (its words decide from the first frame)
	is_shown = want
	_put(is_shown, 0.0)
	_started = true


func _asked(st: Node) -> bool:
	return (shown_when == "" or st.holds(shown_when)) and not (hidden_when != "" and st.holds(hidden_when))


## there
func appear() -> void:
	set_shown(true)


## gone
func vanish() -> void:
	set_shown(false)


func toggle() -> void:
	set_shown(not want)


## There (true) or gone (false): at once, or once you can't see it when `when_unseen` is on.
func set_shown(on: bool) -> void:
	want = on
	if not _started:
		shown = on
		return
	_settle()


## an area's, a cue's, a scare's or a moment's target, or any signal (whatever it sends is ignored)
func fire(_a = null, _b = null) -> void:
	match on_fire:
		"show":
			appear()
		"hide":
			vanish()
		_:
			toggle()


## Whether the player can see where it is (it, what goes with it, or what takes its place).
func seen() -> bool:
	var cam := get_viewport().get_camera_3d() if get_viewport() != null else null
	if cam == null:
		return false
	var pl := get_tree().get_first_node_in_group("hs_player")
	var all: Array = [_thing()] + _nodes(also) + _nodes(swap_with)
	for n in all:
		if n == null or not (n as Node3D).is_inside_tree():
			continue
		for h in [size_m * 0.5, size_m * 0.95, 0.05]:
			var p: Vector3 = (n as Node3D).global_position + Vector3.UP * h
			if Sight.in_frame(cam, p, 12.0) and _clear(cam.global_position, p, pl):
				return true
	return false


func _clear(a: Vector3, b: Vector3, pl: Node) -> bool:
	var t := _thing()
	if t == null or t.get_world_3d() == null:
		return true
	var q := PhysicsRayQueryParameters3D.create(a, b, 1)
	if pl is CollisionObject3D:
		q.exclude = [(pl as CollisionObject3D).get_rid()]
	var hit := t.get_world_3d().direct_space_state.intersect_ray(q)
	return hit.is_empty() or (hit["position"] as Vector3).distance_to(b) < size_m * 0.6   # (its own collider is it)


func _process(dt: float) -> void:
	if not _started:
		return
	_t -= dt
	if _t > 0.0:
		return
	_t = 0.15
	if shown_when != "" or hidden_when != "":
		var st := get_tree().get_first_node_in_group("hs_story")
		if st != null and st.has_method("holds"):
			want = _asked(st)
	_settle()


func _settle() -> void:
	if want == is_shown or (when_unseen and seen()):
		return
	is_shown = want
	changes += 1
	_put(is_shown, fade_secs)
	var snd := get_tree().get_first_node_in_group("hs_sound")
	var t := _thing()
	if sound != "" and snd != null and snd.has_method("play") and t != null:
		snd.play(sound, t.global_position, -6.0, "sfx")
	changed.emit(is_shown)


# everything put as it should be: the thing and what goes with it `on`, what takes its place the other way
func _put(on: bool, secs: float) -> void:
	for n in [_thing()] + _nodes(also):
		_one(n, on, secs)
	for n in _nodes(swap_with):
		_one(n, not on, secs)


func _one(n: Node3D, on: bool, secs: float) -> void:
	if n == null:
		return
	if with_colliders:
		var bodies: Array = n.find_children("*", "CollisionObject3D", true, false)
		if n is CollisionObject3D:
			bodies.append(n)
		for b in bodies:
			var co := b as CollisionObject3D
			if on and co.has_meta(WAS):
				var was: Array = co.get_meta(WAS)
				co.collision_layer = int(was[0])
				co.collision_mask = int(was[1])
				co.remove_meta(WAS)
			elif not on and not co.has_meta(WAS):
				co.set_meta(WAS, [co.collision_layer, co.collision_mask])
				co.collision_layer = 0
				co.collision_mask = 0
	var geo: Array = n.find_children("*", "GeometryInstance3D", true, false)
	if n is GeometryInstance3D:
		geo.append(n)
	if secs <= 0.0 or geo.is_empty() or not is_inside_tree():
		for g in geo:
			(g as GeometryInstance3D).transparency = 0.0
		n.visible = on
		return
	if on:
		for g in geo:
			(g as GeometryInstance3D).transparency = 1.0
		n.visible = true
	if _tweens.has(n) and is_instance_valid(_tweens[n]):
		(_tweens[n] as Tween).kill()                # (asked again while it was still fading)
	var tw := create_tween().set_parallel(true)
	_tweens[n] = tw
	for g in geo:
		tw.tween_property(g, "transparency", 0.0 if on else 1.0, secs)
	if not on:
		tw.chain().tween_callback(func() -> void:
			n.visible = false
			for g in geo:
				if is_instance_valid(g):
					(g as GeometryInstance3D).transparency = 0.0)


## What it is, a check's.
func report() -> Dictionary:
	return {"shown": is_shown, "want": want, "changes": changes}
