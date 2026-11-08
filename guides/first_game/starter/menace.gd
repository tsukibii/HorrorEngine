## Her menace (docs/research/intensity.md §2.1; Alien: Isolation's menace gauge: "As soon as the player can predict a
## pattern in the Alien, it stops being scary"): put it under her, as light_shy.gd is. A gauge from 0 to 1 that fills
## while you're near her (`near_rate` a second within `near_m`) and more while you can see her (`seen_rate`), and drains
## while you're not (`fall`). When it's full she withdraws: gone (or to `retreat`, a spot as far away as you like) for
## `away_min` to `away_max` seconds, the dread director (dread.gd) holding its relax as long; then she's back where she
## was and the gauge is empty. Never while your light is driving her off (light_shy.gd acting), and not back if a scare
## has hidden her meanwhile. `withdrew` and `returned` to wire anything to.
extends Node

signal withdrew
signal returned

@export var near_m := 8.0
@export var near_rate := 0.05                     ## a second, within near_m
@export var seen_rate := 0.15                     ## a second more, while you can see her
@export var fall := 0.05                          ## a second, while neither
@export var away_min := 60.0
@export var away_max := 120.0
@export var retreat: Node3D                       ## where she withdraws to (empty: gone)

var level := 0.0                                  ## the gauge (a check's)
var away := false
var _left := 0.0
var _home := Transform3D()


func _process(dt: float) -> void:
	var her := get_parent() as Node3D
	var cam := get_viewport().get_camera_3d() if get_viewport() else null
	if her == null or cam == null:
		return
	if away:
		_left -= dt
		if _left <= 0.0:
			_come_back(her)
		return
	if not her.is_visible_in_tree():
		level = maxf(0.0, level - fall * dt)
		return
	var head := her.global_position + Vector3.UP * 1.5
	var d := cam.global_position.distance_to(head)
	var rate := -fall
	if d <= near_m:
		rate = near_rate
		if cam.is_position_in_frustum(head) and _clear(cam, head):
			rate += seen_rate
	level = clampf(level + rate * dt, 0.0, 1.0)
	var shy := her.get_node_or_null("LightShy")
	if level >= 1.0 and not (shy != null and bool(shy.get("_acting"))):
		_withdraw(her)


## she withdraws now (anything may call it)
func withdraw() -> void:
	var her := get_parent() as Node3D
	if her != null and not away:
		_withdraw(her)


func _withdraw(her: Node3D) -> void:
	away = true
	_left = randf_range(away_min, away_max)
	_home = her.global_transform
	her.set_meta("hs_hidden", false)
	if retreat != null:
		her.global_position = retreat.global_position
	else:
		her.visible = false
	var d := get_tree().get_first_node_in_group("hs_dread")
	if d != null and d.has_method("relax_for"):
		d.relax_for(_left)
	withdrew.emit()


func _come_back(her: Node3D) -> void:
	away = false
	level = 0.0
	if bool(her.get_meta("hs_hidden", false)):
		return                                         # a scare hid her while she was away: she stays gone
	her.global_transform = _home
	her.visible = true
	returned.emit()


func _clear(cam: Camera3D, p: Vector3) -> bool:
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, p)
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [pl.get_rid()]
	return get_viewport().find_world_3d().direct_space_state.intersect_ray(q).is_empty()
