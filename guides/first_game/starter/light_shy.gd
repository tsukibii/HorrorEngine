## A character who doesn't like the light (guides/tutorial_v2; docs/FLASHLIGHT_PLAN.md §2, the games' `beam`): a Node
## under her. When the player's flashlight holds her (`after` seconds at `bright` or more: flashlight.gd's beam_on) she
## backs off (`distance` metres, facing the player, stopping at walls), freezes (her AnimationPlayers held), vanishes
## until the light's been off her `keep` seconds, or comes toward it. Signals to wire anything to: `lit` when the light
## starts holding her, `flashed` each time the beam lands on her, `flashed_twice` the second time within 3 seconds.
extends Node

signal lit
signal flashed
signal flashed_twice

@export_enum("backs off", "freezes", "vanishes", "comes", "nothing") var does := "backs off"
@export var after := 0.4                        ## seconds in the light before she does it
@export_range(0.0, 1.0) var bright := 0.3       ## how bright it must be on her
@export var distance := 2.5                     ## backs off: metres
@export var speed := 1.2                        ## metres a second
@export var keep := 4.0                         ## vanishes, freezes: seconds after the light leaves her
@export var height := 1.6                       ## where her eyes are (the beam's tested there and at her chest)

var lit_now := 0.0                              # how lit she is, 0..1
var lit_for := 0.0
var moved := 0.0
var _was := false
var _flashes: Array = []
var _acting := false
var _dark_for := 0.0
var _clock := 0.0


func _ready() -> void:
	if get_parent() != null:
		get_parent().add_to_group.call_deferred("hs_threat")   # (the Fear node feels her near)


func _process(dt: float) -> void:
	_clock += dt
	var her := get_parent() as Node3D
	var me := get_tree().get_first_node_in_group("hs_player") as Node3D
	var fl = me.get_node_or_null("Eye/Flashlight") if me != null else null
	if her == null or fl == null or not fl.has_method("beam_on"):
		return
	var shown := her.is_visible_in_tree() or (does == "vanishes" and _acting)
	lit_now = 0.0
	if shown:
		var at := her.global_position
		lit_now = maxf(fl.beam_on(at + Vector3.UP * height * 0.72), fl.beam_on(at + Vector3.UP * height))
	var on := lit_now >= bright
	if on and not _was:
		_flashes.append(_clock)
		_flashes = _flashes.filter(func(t): return _clock - t <= 3.0)
		flashed.emit()
		if _flashes.size() == 2:
			flashed_twice.emit()
	_was = on
	lit_for = lit_for + dt if on else 0.0
	_dark_for = 0.0 if on else _dark_for + dt
	if on and lit_for >= after and not _acting and does != "nothing":
		_acting = true
		moved = 0.0
		lit.emit()
		if does == "vanishes":
			her.visible = false
		elif does == "freezes":
			for ap in her.find_children("*", "AnimationPlayer", true, false):
				ap.pause()
	if not _acting:
		return
	var to := me.global_position - her.global_position
	to.y = 0.0
	match does:
		"backs off", "comes":
			if to.length() > 0.01:
				her.rotation.y = atan2(to.x, to.z)          # her front (+Z, a glTF character's) to the player
			var away := does == "backs off"
			var go := (moved < distance) if away else (on and to.length() > 1.3)
			if go:
				var dir := to.normalized() * (-1.0 if away else 1.0)
				var step := speed * dt
				if away:
					step = minf(step, distance - moved)
				if _clear(her, dir, step):
					her.global_position += dir * step
					moved += step
			if (away and moved >= distance and _dark_for > keep) or (not away and not on):
				_acting = false
		"vanishes", "freezes":
			if _dark_for >= keep:
				_acting = false
				if does == "vanishes":
					her.visible = true
				else:
					for ap in her.find_children("*", "AnimationPlayer", true, false):
						ap.play()


## nothing in her way for the next step (a ray at her knees)
func _clear(her: Node3D, dir: Vector3, step: float) -> bool:
	var from := her.global_position + Vector3.UP * 0.5
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * (step + 0.35))
	var hit := her.get_world_3d().direct_space_state.intersect_ray(q)
	return hit.is_empty()
