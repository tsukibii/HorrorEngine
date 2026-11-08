## In the mirror (docs/research/intensity.md §5.3; Silent Hill 3's mirror room): a figure there only in a mirror, or
## there and missing from it. Put it on a Node3D where she stands (behind where you'll stand at the mirror, over your
## shoulder) with the figure as its child (her copy, facing the mirror). `only_in_mirror` (on): her meshes on the layer
## only the mirrors' cameras draw, casting no shadow (the Look plugin's HSMirror.only_in_mirrors); off: on the layer
## every camera but a mirror's draws (never_in_mirrors: no reflection). Armed (arm() from a signal: walking into the
## bath), she's there.
## - **Only in the mirror**: once she's been in a mirror's glass while you look at it for `seen_secs` (`seen`), the
##   moment you turn to where she stands she's gone (`gone`): nobody behind you, and nobody in the glass when you look
##   back.
## - **Missing from it**: once you've looked at her for `seen_secs` (`seen`), she's gone the next time she's out of your
##   view: turn back to the mirror and she was never in it.
## Once a game at most: after the first, players watch every mirror.
extends Node3D

signal seen                                       ## she's been seen (in the glass, or in the room)
signal gone

@export var figure: Node3D                        ## who; empty: its first Node3D child
@export var armed := false                        ## there (or arm() from a signal)
@export var only_in_mirror := true                ## off: there in the room and missing from the mirror
@export var seen_secs := 0.6                      ## seconds seen before she can go
@export var turn_deg := 40.0                      ## you've turned to her when she's this near the middle of your view
@export var head_y := 1.45                        ## her head over her feet

var shown := false
var seen_for := 0.0                               ## seconds seen so far (a check's)
var was_seen := false
var _done := false


func _ready() -> void:
	if figure == null:
		for c in get_children():
			if c is Node3D:
				figure = c
				break
	if figure != null:
		figure.visible = false


func arm(_a = null, _b = null) -> void:
	if not _done:
		armed = true


func _process(dt: float) -> void:
	if not armed or _done or figure == null:
		return
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	if not shown:
		if only_in_mirror:
			HSMirror.only_in_mirrors(figure)
		else:
			HSMirror.never_in_mirrors(figure)
		figure.visible = true
		shown = true
		return
	var head := figure.global_position + Vector3.UP * head_y
	var facing := _looking_at(cam, head, turn_deg)
	if not was_seen:
		if (only_in_mirror and in_a_glass(head)) or (not only_in_mirror and facing):
			seen_for += dt
			if seen_for >= seen_secs:
				was_seen = true
				seen.emit()
		return
	if only_in_mirror and facing:                      # you turned round to her: nobody
		_go()
	elif not only_in_mirror and not _looking_at(cam, head, 70.0):
		_go()                                          # out of your view: gone, never in the glass


func _go() -> void:
	_done = true
	armed = false
	figure.visible = false
	gone.emit()


func _looking_at(cam: Camera3D, p: Vector3, deg: float) -> bool:
	return rad_to_deg((-cam.global_basis.z).angle_to(p - cam.global_position)) < deg


## whether `p` shows in a mirror's glass now: a mirror you're looking at (HSMirror active) whose camera has `p` within
## the glass's outline
func in_a_glass(p: Vector3) -> bool:
	for m in get_tree().get_nodes_in_group("hs_mirror"):
		var mc = m.get("mcam")
		var mi = m.get("mi")
		if not bool(m.get("active")) or not (mc is Camera3D) or not (mi is MeshInstance3D):
			continue
		if not (mc as Camera3D).is_position_in_frustum(p):
			continue
		var sp: Vector2 = (mc as Camera3D).unproject_position(p)
		var lo := Vector2(1e9, 1e9)
		var hi := Vector2(-1e9, -1e9)
		for c in m.get("corners"):
			var q: Vector2 = (mc as Camera3D).unproject_position((mi as MeshInstance3D).global_transform * (c as Vector3))
			lo = lo.min(q)
			hi = hi.max(q)
		if Rect2(lo, hi - lo).has_point(sp):
			return true
	return false
