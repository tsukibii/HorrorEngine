class_name HSShootable
extends Node
## What being shot does to the thing it's under: put one as a child of a character, a doll, a lamp. A shot with a pellet
## landing on its parent (or anything under it) is a hit: `hit(info)`, and after `hits` of them `down`. What a hit does,
## each a switch: `gone_secs` (gone at once and back after that long, its collision with it: a ghost's way; down, gone
## for good), `push_m` (shoved back along the shot), `cry` (a sound there, through the Sound node), `say` (a line, the
## Story's), `target` (its fire(): a scare, a cue, the lights). Listens to every HSShotgun (the group hs_weapon).

signal hit(info: Dictionary)                      ## {point, normal, collider, pellet, hits (pellets on it), count}
signal down

@export var hits := 1                             ## hits until it's down (a hit: one shot, however many pellets)
@export var gone_secs := 0.0                      ## gone for this long when hit (0: it stays); down, gone for good
@export var push_m := 0.0                         ## shoved back along the shot this far, over a moment
@export var cry: AudioStream                      ## a sound where it's hit
@export var say := ""                             ## a line when it's hit (the Story's say)
@export var target: Node                          ## its fire() on every hit (a scare_area, a cue)

var count := 0                                    ## hits so far
var is_down := false
var _guns: Array = []
var _t := 0.0


func _ready() -> void:
	_listen()


func _process(dt: float) -> void:
	_t += dt
	if _t > 0.5:                                  # (a gun made after this: listened to once it's there)
		_t = 0.0
		_listen()


func _listen() -> void:
	for w in get_tree().get_nodes_in_group("hs_weapon"):
		if not _guns.has(w) and w.has_signal("fired"):
			w.fired.connect(_on_fired)
			_guns.append(w)


func _on_fired(shot_hits: Array) -> void:
	var host := get_parent() as Node
	if host == null or is_down:
		return
	var mine := shot_hits.filter(func(h) -> bool:
		var c = h.get("collider")
		return c is Node and is_instance_valid(c) and (c == host or host.is_ancestor_of(c)))
	if mine.is_empty():
		return
	count += 1
	var info: Dictionary = (mine[0] as Dictionary).duplicate()
	info["hits"] = mine.size()
	info["count"] = count
	var at: Vector3 = info.get("point", Vector3.ZERO)
	if cry != null:
		var snd := get_tree().get_first_node_in_group("hs_sound")
		if snd != null and snd.has_method("play"):
			snd.play(cry, at, 0.0, "sfx")
		else:
			var p := AudioStreamPlayer3D.new()
			p.stream = cry
			get_tree().current_scene.add_child(p)
			p.global_position = at
			p.play()
			p.finished.connect(p.queue_free)
	if say != "":
		var st := get_tree().get_first_node_in_group("hs_story")
		if st != null and st.has_method("say"):
			st.say(say)
	if push_m > 0.0 and host is Node3D:
		var from: Vector3 = (_guns[0] as Node3D).global_position if not _guns.is_empty() else at
		var d := at - from
		d.y = 0.0
		if d.length() > 0.001:
			var tw := create_tween()
			tw.tween_property(host, "global_position", (host as Node3D).global_position + d.normalized() * push_m, 0.18) \
				.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	if target != null and target.has_method("fire"):
		target.fire()
	hit.emit(info)
	if count >= hits:
		is_down = true
		down.emit()
	if gone_secs > 0.0:
		_gone(host, -1.0 if is_down else gone_secs)


# gone at once (drawn, processed and solid no more), back after `secs` (never, below 0)
func _gone(host: Node, secs: float) -> void:
	var was := host.process_mode
	var shown := (host as Node3D).visible if host is Node3D else true
	if host is Node3D:
		(host as Node3D).visible = false
	host.process_mode = Node.PROCESS_MODE_DISABLED           # (its collision leaves the world with it)
	process_mode = Node.PROCESS_MODE_ALWAYS                    # (this one keeps listening)
	if secs < 0.0:
		return
	await get_tree().create_timer(secs).timeout
	if is_instance_valid(host) and not is_down:
		host.process_mode = was                                # (as it was: inherit, always, pausable...)
		if host is Node3D:
			(host as Node3D).visible = shown
