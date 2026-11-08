## A room's tone (guides/tutorial_v2): an Area3D the player walks into; its `tone` (a quiet loop: the sound shelf's
## room tones, hums and winds, in the project's sfx/ambience) is played by the Sound node (sound.gd) while they're in
## it, crossing into the next room's as they walk through. Its box: `interior` and `room` (the room's own size, from the
## interior's export), or a CollisionShape3D of your own.
extends Area3D

@export var tone: AudioStream
@export var interior: Node3D                ## the interior (with interior.gd) whose `room` this area fills
@export var room := ""

static var inside: Array = []               # the tone areas the player is in, the last one entered last


func _ready() -> void:
	body_entered.connect(_in)
	body_exited.connect(_out)
	if interior != null and room != "":
		interior.call_deferred("fit_area", self, room)


func _in(body: Node3D) -> void:
	if not body.is_in_group("hs_player"):
		return
	inside.erase(self)
	inside.append(self)
	_play()


func _out(body: Node3D) -> void:
	if not body.is_in_group("hs_player"):
		return
	inside.erase(self)
	_play()


func _play() -> void:
	var s := get_tree().get_first_node_in_group("hs_sound")
	if s != null:
		var last = inside.back() if not inside.is_empty() else null
		s.tone(last.tone if last != null else null)
