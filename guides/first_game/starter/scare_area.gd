## A scare for a first game (guides/first_game): an Area3D the player walks into. The lamps of `lights_of` (the
## interior: every light under it) go out, `appear` (the character, hidden until then) is there, the Sound child (an
## AudioStreamPlayer3D) plays, and it fires once. Give it a CollisionShape3D the size of the place: an interior's
## markers/trigger_<room> says a room's size in its metadata.
extends Area3D

signal scared

@export var lights_of: Node3D
@export var appear: Node3D
@export var once := true


func _ready() -> void:
	body_entered.connect(_entered)
	if appear != null:
		appear.visible = false


func _entered(body: Node3D) -> void:
	if not (body is CharacterBody3D):
		return
	if lights_of != null:
		for l in lights_of.find_children("*", "Light3D", true, false):
			l.visible = false
	if appear != null:
		appear.visible = true
	var s := get_node_or_null("Sound")
	if s != null and s.has_method("play"):
		s.play()
	scared.emit()
	if once:
		set_deferred("monitoring", false)
