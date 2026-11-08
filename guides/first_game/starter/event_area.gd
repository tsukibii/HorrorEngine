## A moment when the player walks in (guides/tutorial_v2): a new objective, tasks added or ticked, a line said, a fact
## set, the music's mood, the air's fog rolling in or clearing (an HSAtmosphere's `fog_to`), or the ending. Only when
## `needs` holds (a task done, task:<id>; an item carried, item:<name>; a fact; ! in front for not; several apart by
## commas): it waits while they're inside until it does. Once, or every time they come in. Its box: `interior` and
## `room` (that room's size), or a CollisionShape3D of your own. Its `fire()` does it all from anything's signal too.
extends Area3D

signal entered

@export var interior: Node3D                ## the interior (with interior.gd) whose `room` this area fills
@export var room := ""
@export var needs := ""
@export var once := true
@export var objective := ""
@export var add_tasks: PackedStringArray = []      ## each "id: what it says"
@export var tick := ""                      ## a task it ticks off
@export var say := ""
@export var fact := ""                      ## a fact it sets (a word the others' `needs` can name)
@export_enum("keep", "silence", "calm", "uneasy", "dread", "chase") var music := "keep"   ## the music's mood after (keep: as it is)
@export_range(-0.01, 1.0, 0.01) var fog := -0.01   ## the air's fog level to roll to (the scene's HSAtmosphere); under 0: as it is
@export var fog_seconds := 4.0              ## how long it takes
@export var ending := false                 ## the Story's ending (its own title and words)

var fired := false
var _here := false


func _ready() -> void:
	body_entered.connect(func(b): if b.is_in_group("hs_player"): _here = true; _try())
	body_exited.connect(func(b): if b.is_in_group("hs_player"): _here = false)
	if interior != null and room != "":
		interior.call_deferred("fit_area", self, room)


func _physics_process(_dt: float) -> void:
	if _here and not fired:
		_try()


func _try() -> void:
	if (once and fired) or not _story_holds():
		return
	fire()


func _story_holds() -> bool:
	var st := get_tree().get_first_node_in_group("hs_story")
	return st == null or st.holds(needs)


## all it does (from a signal too: whatever the signal sends is ignored)
func fire(_a = null, _b = null) -> void:
	if once and fired:
		return
	fired = true
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null:
		if objective != "":
			st.objective(objective)
		for t in add_tasks:
			st.add_line(t)
		if tick != "":
			st.tick(tick)
		if say != "":
			st.say(say)
		if fact != "":
			st.flag(fact)
	if music != "keep":
		var snd := get_tree().get_first_node_in_group("hs_sound")
		if snd != null:
			snd.music(music)
	if fog >= 0.0:
		var air := get_tree().get_first_node_in_group("hs_atmosphere")
		if air != null and air.has_method("fog_to"):
			air.fog_to(fog, fog_seconds)
	entered.emit()
	if ending and st != null:
		st.end()
	if not once:
		fired = false
		_here = false                      # every time: again when they next come in
