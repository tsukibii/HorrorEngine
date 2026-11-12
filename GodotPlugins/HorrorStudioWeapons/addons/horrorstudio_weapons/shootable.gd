@icon("res://addons/horrorstudio_weapons/icons/shootable.svg")
class_name HSShootable
extends Node
## What being shot does to the thing it's under: put one as a child of a character, a doll, a lamp. A shot with a pellet
## landing on its parent (or anything under it) is a hit: `hit(info)`, and after `hits` of them `down`. What a hit does,
## each a switch: `gone_secs` (gone at once and back after that long, its collision with it: a ghost's way; down, gone
## for good), `push_m` (shoved back along the shot), `cry` (a sound there, through the Sound node), `say` (a line, the
## Story's), `target` (its fire(): a scare, a cue, the lights), `lights_out` (a lamp shot out: its lights dark and a few
## sparks when it's down). Listens to every gun (HSDoubleBarrel; the group hs_weapon): a pellet on it, or an explosive shell's
## blast reaching it (its hits carry `blast` and `damage`), is a hit. A harmless shell's pellets (a kind whose damage is
## 0: the love hearts, the water) aren't: nothing's counted, nothing goes down; `touched` says so (a line, a blush).

signal hit(info: Dictionary)                      ## {point, normal, collider, pellet, hits (pellets on it), count}
signal down
signal touched(info: Dictionary)                  ## a harmless shell's pellets on it: {point, normal, collider, touch (its kind's word: charm, soak), kind, hits}

@export var hits := 1                             ## hits until it's down (a hit: one shot, however many pellets)
@export var gone_secs := 0.0                      ## gone for this long when hit (0: it stays); down, gone for good
@export var push_m := 0.0                         ## shoved back along the shot this far, over a moment
@export var cry: AudioStream                      ## a sound where it's hit
@export var say := ""                             ## a line when it's hit (the Story's say)
@export var target: Node                          ## its fire() on every hit (a scare_area, a cue)
@export var lights_out := false                   ## a lamp: every light under it dark when it's down, a few sparks

var count := 0                                    ## hits so far
var is_down := false
var _is_gone := false
var _solid: Array = []                            # what was solid before it went: [node, layer or use_collision]
var _guns: Array = []
var _t := 0.0


func _ready() -> void:
	add_to_group("hs_shootable")                  # (a blast reaching its parent counts it as hit: HSImpacts)
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
	if host == null or is_down or _is_gone:
		return
	if host is Node3D and not (host as Node3D).is_visible_in_tree():
		return                                       # (not there to be shot: hidden at her post, or by a scare)
	var mine := shot_hits.filter(func(h) -> bool:
		var c = h.get("collider")
		return c is Node and is_instance_valid(c) and (c == host or host.is_ancestor_of(c)))
	if mine.is_empty():
		return
	var soft := mine.filter(func(h) -> bool: return not bool(h.get("blast", false)) and float(h.get("damage", 1.0)) <= 0.0)
	if not soft.is_empty():                              # (an easter egg shell: it isn't shot)
		var t: Dictionary = (soft[0] as Dictionary).duplicate()
		t["hits"] = soft.size()
		touched.emit(t)
		mine = mine.filter(func(h) -> bool: return not soft.has(h))
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
			_room(host).add_child(p)
			p.global_position = at
			p.play()
			p.finished.connect(p.queue_free)
	if say != "":
		var st := get_tree().get_first_node_in_group("hs_story")
		if st != null and st.has_method("say"):
			st.say(say)
	if push_m > 0.0 and host is Node3D:
		var d: Vector3 = info.get("dir", Vector3.ZERO)
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
		if lights_out:
			_shot_out(host, at)
		down.emit()
	if gone_secs > 0.0:
		_gone(host, -1.0 if is_down else gone_secs)


# a lamp shot out: its lights dark for good, sparks falling from where it was hit
func _shot_out(host: Node, at: Vector3) -> void:
	var lamps := host.find_children("*", "Light3D", true, false)
	if host is Light3D:
		lamps.append(host)
	for l in lamps:
		(l as Light3D).visible = false
		(l as Light3D).light_energy = 0.0
		l.set_meta("hs_lit", false)                  # (a light zone and the starter's lights turn it on by this: never again)
		l.set_meta("hs_broken", true)
	var sp := CPUParticles3D.new()
	sp.emitting = false                              # (started once it's placed: emitting as it enters the tree, its sparks fly from the scene's origin)
	sp.one_shot = true
	sp.amount = 14
	sp.lifetime = 0.7
	sp.explosiveness = 0.95
	sp.local_coords = false
	sp.direction = Vector3(0, -1, 0)
	sp.spread = 70.0
	sp.initial_velocity_min = 0.6
	sp.initial_velocity_max = 2.2
	sp.gravity = Vector3(0, -9.8, 0)
	sp.scale_amount_min = 0.006
	sp.scale_amount_max = 0.012
	var g := Gradient.new()
	g.set_color(0, Color(1.0, 0.85, 0.5, 1.0))
	g.set_color(1, Color(1.0, 0.4, 0.1, 0.0))
	sp.color_ramp = g
	var m := SphereMesh.new()
	m.radius = 0.5
	m.height = 1.0
	m.radial_segments = 4
	m.rings = 2
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.material = mat
	sp.mesh = m
	_room(host).add_child(sp)
	sp.global_position = at
	sp.emitting = true
	get_tree().create_timer(1.2).timeout.connect(sp.queue_free)


# where to put a sound or the sparks: the running scene, else beside the thing
func _room(host: Node) -> Node:
	var cs := get_tree().current_scene
	return cs if cs != null else (host.get_parent() if host.get_parent() != null else host)


# gone at once (not drawn, not solid, marked hidden so the starter's hunters stand down: chase.gd, searcher.gd and
# menace.gd read `visible` and `hs_hidden`; its scripts keep running), back after `secs` (never, below 0)
func _gone(host: Node, secs: float) -> void:
	if _is_gone:
		return
	_is_gone = true
	var shown := (host as Node3D).visible if host is Node3D else true
	var hidden_before := bool(host.get_meta("hs_hidden", false))
	if host is Node3D:
		(host as Node3D).visible = false
	host.set_meta("hs_hidden", true)
	_solid.clear()
	for n in [host] + host.find_children("*", "", true, false):
		if n is CollisionObject3D:
			_solid.append([n, (n as CollisionObject3D).collision_layer])
			(n as CollisionObject3D).collision_layer = 0
		elif n is CSGShape3D and (n as CSGShape3D).use_collision:
			_solid.append([n, true])
			(n as CSGShape3D).use_collision = false
	if secs < 0.0:
		return
	await get_tree().create_timer(secs).timeout
	if not is_instance_valid(host) or is_down:
		return
	for e in _solid:
		if is_instance_valid(e[0]):
			if e[0] is CollisionObject3D:
				(e[0] as CollisionObject3D).collision_layer = int(e[1])
			else:
				(e[0] as CSGShape3D).use_collision = true
	_solid.clear()
	host.set_meta("hs_hidden", hidden_before)
	if host is Node3D:
		(host as Node3D).visible = shown
	_is_gone = false
