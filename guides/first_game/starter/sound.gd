## The music and the room's sound, for a game built by hand (guides/tutorial_v2; the studio games' own beds, the same
## numbers): the studio's four moods (calm, uneasy, dread, chase: made by tools/score/moods.mjs, in the project's music/
## folder) looped under the game and crossfading with equal power; a room's tone (a quiet loop off the sound shelf: the
## room_tone.gd areas set it); and the hush before a scare: both fade to nothing, the last half second silent, then
## come back slowly. Put it in the main scene: a Node called Sound with this script.
##
## **Sound physics** (docs/research/intensity.md §1.1-1.2; Woohill's cinema mix and sound bank, lifted, the user,
## 2026-11-08): every sound played through it (`play`, `step`, `shaped`) is traced through the level from where it is
## to your ear (acoustics.gd): muffled behind walls and doors (the Muffled buses) and heard from where its reflections
## come, its reverb as rendered tails (the shelf's sfx/_tails, tools/sfx.py tails: Godot's own reverb rings on sharp
## hits) at the levels the rays give, short to long (a carpeted corridor dry, a concrete stairwell long), and an echo off
## the loudest late reflection. Your own steps get only the short tails and no echo, so nothing trails them. The room's
## surfaces come from the interiors' markers (the export's floor kind and sets: concrete, tile, carpet, plaster...).
##
## The buses (made when the project hasn't them): Music and Body to the Master; everything heard in the world to World
## (SFX placed sounds, Foley your steps, Events the big moments, Tone the rooms' loops, Verb and Verb Dull the tails,
## Echo, Muffled 1 to 3), so the world can be dulled as one. The tone is ducked by what's close and by the big moments.
##   music("dread")    tone(stream)    await get_tree().create_timer(hush(1.5)).timeout
##   play("knock_slow", spot.global_position)    play("door_slam_01", at, -3.0, "event")    shaped($Knock)
extends Node

const Acoustics := preload("res://starter/acoustics.gd")
const QUIET := 0.5                                    # a hush's last half second: nothing at all

@export var calm: AudioStream                         ## empty: res://music/calm.ogg
@export var uneasy: AudioStream
@export var dread: AudioStream
@export var chase: AudioStream
@export_enum("silence", "calm", "uneasy", "dread", "chase") var mood := "silence"   ## the music when the game starts
@export var music_db := -6.0                          ## the moods are made at -20 LUFS: about -26 under the game
@export var tone_db := -22.0                          ## the shelf's loops are near -16 LUFS: about -38, under everything
@export var fade := 2.0                               ## seconds a mood takes to cross into the next
@export var back := 6.0                               ## seconds the beds take to come back after a hush
@export_group("Sound physics")
@export var physics := true                           ## sounds traced through the level (off: dry, unmuffled)
@export var tails := true                             ## the rooms' reverb
@export var echoes := true
@export var step_db := -12.0                          ## your footsteps (running a little louder)
@export var unit_size := 2.0                          ## placed sounds: metres at which they're at their own level
@export var max_distance := 25.0

const BUS_WORLD := "World"
const BUS_SFX := "SFX"
const BUS_FOLEY := "Foley"
const BUS_EVENTS := "Events"
const BUS_TONE := "Tone"
const BUS_BODY := "Body"
const VERB := "Verb"
const VERB_DULL := "Verb Dull"
const ECHO := "Echo"
const MUFFLED := ["Muffled 1", "Muffled 2", "Muffled 3"]
const MUFFLED_HZ := [2500.0, 1000.0, 450.0]
## The direct sound's brightness (direct_bright, 0..1) under which it goes to each muffled bus.
const MUFFLED_AT := [0.7, 0.3, 0.08]
## A send whose brightness is under this plays on the dull bus.
const DULL_AT := 0.5
## How much of the dry sound's distance falloff the tails take (reverb carries further: far sounds grow wetter).
const TAIL_FALLOFF := 0.35

var now_mood := "silence"
var now_tone: AudioStream = null
var last := {}                                        # the last traced play: {what, at, result} (a check's, `report`)
var _tracks := {}                                     # key -> {player, g, target, rate, kind}
var _hush = null                                      # {t0, secs, back, k0}
var _clock := 0.0
var _ac = null                                        # the tracer
var _cache := {}                                      # "source cell|listener cell" -> [ms, result]
var _rooms := {}                                      # a collider's name (an interior's room) -> {floor, walls, ceiling, kind}
var _wet: Array = []                                  # [AABB] where the floor is wet (HSWetSurface, HSPuddle)
var _shelf := {}                                      # the sound shelf's names -> {file, category}
var _streams := {}                                    # path -> AudioStream (or null)
var _last_pick := {}                                  # a family -> the variation played last
var _p3: Array[AudioStreamPlayer3D] = []
var _p2: Array[AudioStreamPlayer] = []
var _echoes: Array = []                               # [due s, stream, pitch, db, at]


func _ready() -> void:
	add_to_group("hs_sound")
	_build()
	if mood != "silence":
		music(mood, 1.0)
	_read_shelf()
	_learn.call_deferred()                            # once the level is in (its interiors, its wet floors)


## a mood ("calm", "uneasy", "dread", "chase"), or "silence", crossing over `secs`
func music(m: String, secs := -1.0) -> void:
	if m == "" or m == "none":
		m = "silence"
	now_mood = m
	_aim("m:", m if m != "silence" else "", _mood_stream(m), fade if secs < 0.0 else secs)


## a room's tone (a loop), or null for none, crossing over `secs`
func tone(stream: AudioStream, secs := 1.5) -> void:
	if stream == now_tone:
		return
	now_tone = stream
	_aim("t:", str(stream.get_instance_id()) if stream != null else "", stream, secs)


## the music and the tone down to nothing over all but the last half second, which is silent, then back over `back_s`
## (the node's `back` when left out). Its seconds: wait them out, then the scare
func hush(secs := 1.5, back_s := -1.0) -> float:
	secs = maxf(secs, QUIET)
	_hush = {"t0": _clock, "secs": secs, "back": maxf(back if back_s < 0.0 else back_s, 0.1), "k0": duck()}
	return secs


## how loud the beds are let be now, 0..1
func duck() -> float:
	if _hush == null:
		return 1.0
	var t: float = _clock - float(_hush["t0"])
	var secs: float = float(_hush["secs"])
	var fall: float = maxf(secs - QUIET, 0.01)
	if t < fall:
		return float(_hush["k0"]) * (1.0 - smoothstep(0.0, 1.0, t / fall))
	if t < secs:
		return 0.0
	if t < secs + float(_hush["back"]):
		return smoothstep(0.0, 1.0, (t - secs) / float(_hush["back"]))
	return 1.0


## what's playing, for a check: the mood, whether a tone plays, each track's fade, the hush
func state() -> Dictionary:
	var lv := {}
	for key in _tracks:
		lv[key] = snappedf(sin(float(_tracks[key]["g"]) * PI * 0.5), 0.001)
	return {"music": now_mood, "tone": now_tone != null, "duck": snappedf(duck(), 0.001), "levels": lv, "hushing": _hush != null}


# ---- sound physics -------------------------------------------------------------------------------------------------

## Plays a sound in the world, shaped by where it is (see the class doc). `what`: a name off the shelf ("knock_slow"),
## a family's start ("step_carpet": one of its variations, never the same twice running), a path or an AudioStream.
## `at`: where (Vector3.INF: not placed, as your own body is). `kind`: "sfx" (placed things), "foley" (your body:
## short tails, no echo), "event" (a big moment: the tones duck). The player it plays on (null when nothing to play).
func play(what, at := Vector3.INF, db := 0.0, kind := "sfx", pitch := 1.0) -> Node:
	var st := stream_of(what)
	if st == null:
		return null
	pitch *= randf_range(0.96, 1.04)
	var bus := BUS_FOLEY if kind == "foley" else (BUS_EVENTS if kind == "event" else BUS_SFX)
	var sh := shape(st, bus, at)
	var p: Node
	if at == Vector3.INF:
		var p2 := _free2()
		p2.bus = str(sh.get("bus", bus))
		p = p2
	else:
		var p3 := _free3()
		p3.bus = str(sh.get("bus", bus))
		p3.unit_size = unit_size
		p3.max_distance = max_distance
		p3.global_position = sh.get("at", at)
		p = p3
	p.stream = st
	p.volume_db = db + float(sh.get("volume_db", 0.0))
	p.pitch_scale = pitch
	p.play()
	_reverb(st, p.volume_db, pitch, sh)
	return p


## A footstep at `at` (the feet) on the floor there: the shelf's steps for its material (acoustics.json `steps`), wet
## where a wet floor or a puddle is. `run`: a little louder.
func step(at: Vector3, run := false) -> Node:
	var fam := steps_for(floor_at(at))
	return play(fam, at + Vector3(0, 0.05, 0), step_db + (4.0 if run else 0.0), "foley")


## The floor's material under `at` ("carpet", "concrete", "tile", "wood"... "wet" on a wet floor; "" when nothing's
## under it): the interior's room it's in, by its collider, and the export's floor kind.
func floor_at(at: Vector3) -> String:
	for b: AABB in _wet:
		if b.grow(0.05).has_point(at + Vector3(0, 0.02, 0)):
			return "wet"
	var w := get_viewport().world_3d if get_viewport() else null
	if w == null:
		return ""
	var q := PhysicsRayQueryParameters3D.create(at + Vector3(0, 0.4, 0), at - Vector3(0, 1.2, 0))
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		q.exclude = [pl.get_rid()]
	var hit := w.direct_space_state.intersect_ray(q)
	if hit.is_empty():
		return ""
	var m := _surface(hit)
	return m if m != "" else "default"


## The shelf family for a floor's material.
func steps_for(mat: String) -> String:
	var t: Dictionary = Acoustics.cfg().get("steps", {})
	return str(t.get(mat, t.get("default", "step_wood")))


## Plays one of your own AudioStreamPlayer3D nodes (a knock, a slam under a scare) shaped as `play` shapes: its bus
## muffled when something's between, its level, its reverb and echo. Its own volume is kept as its level.
func shaped(p: AudioStreamPlayer3D, kind := "sfx") -> void:
	if p == null or p.stream == null:
		return
	if not p.has_meta("hs_db0"):
		p.set_meta("hs_db0", p.volume_db)
		p.set_meta("hs_bus0", p.bus)
	var bus0 := str(p.get_meta("hs_bus0"))
	var bus := bus0 if bus0 != "Master" else (BUS_EVENTS if kind == "event" else BUS_SFX)
	var sh := shape(p.stream, bus, p.global_position)
	p.bus = str(sh.get("bus", bus))
	p.volume_db = float(p.get_meta("hs_db0")) + float(sh.get("volume_db", 0.0))
	p.play()
	_reverb(p.stream, p.volume_db, p.pitch_scale, sh)


## How a play of `st` on `bus` at `at` (INF: your own) reaches the ear: {bus (a muffled one when blocked), volume_db
## (added to the dry), at (where it seems to come from), tails: [[slot, dB against the dry, dull]], echo: {delay, db,
## at} or {}}. {} when not traced (physics off, a dry sound).
func shape(st: AudioStream, bus: String, at: Vector3) -> Dictionary:
	if not physics or st == null:
		return {}
	var c := Acoustics.cfg()
	var cat := _category(st)
	if cat in c.get("dry", []):
		return {}
	var ear := listener()
	var own := bus == BUS_FOLEY or at == Vector3.INF
	var src := at
	if at == Vector3.INF:
		var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
		src = pl.global_position + Vector3(0, 1.2, 0) if pl else ear
	elif bus == BUS_FOLEY:
		src += Vector3(0, 0.4, 0)                      # (steps sound at the feet: traced from just above the floor)
	var r := _traced(src, ear)
	last = {"what": st.resource_path.get_file(), "at": src, "result": r}
	var out := {"bus": bus, "volume_db": 0.0, "at": at, "tails": [], "echo": {}}
	var d := maxf(0.1, src.distance_to(ear))
	if not own:
		var db := float(r.direct_bright)
		for i in MUFFLED.size():
			if db < float(MUFFLED_AT[i]):
				out.bus = MUFFLED[i]
		out.volume_db = linear_to_db(maxf(0.001, float(r.direct_gain)))
		if (r.dir as Vector3) != Vector3.ZERO:
			out.at = ear + (r.dir as Vector3) * d
	if tails:
		var slots: Array = c.get("slots", [])
		var allowed: Array = (c.get("foley_slots", [0, 1]) as Array).map(func(v: Variant) -> int: return int(v)) if own else [0, 1, 2, 3]
		var att := 0.0
		if at != Vector3.INF:
			att = clampf(linear_to_db(unit_size / d), -60.0, 3.0) * TAIL_FALLOFF
		for k in mini(4, slots.size()):
			var g := pow(float(r.gains[k]), float(c.get("gain_power", 1.0))) * float(slots[k].get("gain", 0.2)) * float(c.get("late_gain", 1.26))
			if not allowed.has(k) or g < 0.002:
				continue
			out.tails.append([k, linear_to_db(g) + float(c.get("reverb_db", 0.0)) + att, float(r.bright[k]) < DULL_AT])
	if echoes and not own and not (r.echo as Dictionary).is_empty():
		var e: Dictionary = r.echo
		var ec: Dictionary = c.get("echo", {})
		var total := d + float(e.delay) * Acoustics.SPEED
		var edb := linear_to_db(maxf(0.0001, float(e.gain))) + float(ec.get("gain_db", 0.0))
		edb += clampf(linear_to_db(unit_size / total), -60.0, 3.0)
		if edb > -50.0:
			out.echo = {"delay": float(e.delay), "db": edb, "at": e.at}
	return out


## Where the ear is: the current camera, else the player, else the origin.
func listener() -> Vector3:
	var cam := get_viewport().get_camera_3d() if get_viewport() else null
	if cam:
		return cam.global_position
	var p := get_tree().get_first_node_in_group("hs_player") as Node3D
	return p.global_position if p else Vector3.ZERO


## A short report of the last traced play (its slot gains, occlusion, echo, rays).
func report() -> String:
	var r: Dictionary = last.get("result", {})
	if r.is_empty():
		return "nothing traced yet"
	var e: Dictionary = r.echo
	return "%s: slots %s, occlusion %.2f (direct %.2f), airspace %.2f, echo %s, %d rays, hits %s" % [str(last.what),
		(r.gains as Array).map(func(v: float) -> String: return "%.2f" % v), float(r.occlusion), float(r.direct_bright),
		float(r.airspace), "%d ms" % int(float(e.delay) * 1000.0) if not e.is_empty() else "none", int(r.rays), str(r.hits)]


## An AudioStream from a shelf name, a family's start, a path or a stream (null when there's none).
func stream_of(what) -> AudioStream:
	if what is AudioStream:
		return what
	var s := str(what)
	if s == "":
		return null
	if s.begins_with("res://") or s.begins_with("user://"):
		return _load(s)
	if _shelf.has(s):
		return _load("res://sfx/" + str(_shelf[s]["file"]))
	var fam: Array = []
	for k in _shelf:
		if str(k).begins_with(s + "_"):
			fam.append(k)
	if fam.is_empty():
		return null
	fam.sort()
	var pick: String = fam[randi() % fam.size()]
	if fam.size() > 1 and pick == str(_last_pick.get(s, "")):
		pick = fam[(fam.find(pick) + 1 + randi() % (fam.size() - 1)) % fam.size()]
	_last_pick[s] = pick
	return _load("res://sfx/" + str(_shelf[pick]["file"]))


# the shelf's category of a stream (by its folder in res://sfx/), "" when it's not off the shelf
func _category(st: AudioStream) -> String:
	var p := st.resource_path
	if not p.begins_with("res://sfx/"):
		return ""
	var rel := p.trim_prefix("res://sfx/")
	return rel.get_slice("/", 0) if rel.contains("/") else ""


# a play's reverb (its tails) and echo, as the sound physics shaped it
func _reverb(st: AudioStream, db: float, pitch: float, sh: Dictionary) -> void:
	for t: Array in sh.get("tails", []):
		var ts := _tail(st, int(t[0]))
		if ts == null:
			continue
		var w := _free2()
		w.stream = ts
		w.pitch_scale = pitch
		w.volume_db = db + float(t[1])
		w.bus = VERB_DULL if bool(t[2]) else VERB
		w.play()
	var e: Dictionary = sh.get("echo", {})
	if not e.is_empty():
		_echoes.append([_clock + float(e.delay), st, pitch, db + float(e.db), e.at])


# a sound's rendered tail for a slot (sfx/_tails/<category>/<name>.<slot>.ogg; the generic one, the slot's tail alone,
# for a sound without its own)
func _tail(st: AudioStream, slot: int) -> AudioStream:
	var names: Array = (Acoustics.cfg().get("slots", []) as Array).map(func(r: Dictionary) -> String: return str(r.name))
	if slot >= names.size():
		return null
	var p := st.resource_path
	if p.begins_with("res://sfx/"):
		var own := "res://sfx/_tails/%s.%s.ogg" % [p.trim_prefix("res://sfx/").get_basename(), names[slot]]
		var s := _load(own)
		if s != null:
			return s
	return _load("res://sfx/_tails/_generic/%s.ogg" % names[slot])


func _load(path: String) -> AudioStream:
	if not _streams.has(path):
		_streams[path] = load(path) if ResourceLoader.exists(path) else null
	return _streams[path]


# a trace, kept a moment per (sound cell, listener cell)
func _traced(src: Vector3, ear: Vector3) -> Dictionary:
	var cc: Dictionary = Acoustics.cfg().get("cache", {})
	var cell := float(cc.get("cell", 1.0))
	var key := "%s|%s" % [Vector3i((src / cell).floor()), Vector3i((ear / cell).floor())]
	if _cache.has(key) and _clock - float(_cache[key][0]) < float(cc.get("s", 0.5)):   # (the game's clock: a door opened since counts)
		return _cache[key][1]
	if _cache.size() > 256:
		_cache.clear()
	var r: Dictionary = _tracer().trace(src, ear, max_distance)
	_cache[key] = [_clock, r]
	return r


func _tracer():
	if _ac == null:
		_ac = Acoustics.new()
		_ac.surface = _surface
	_ac.space = get_viewport().world_3d.direct_space_state if get_viewport() and get_viewport().world_3d else null
	_ac.exclude.clear()
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		_ac.exclude.append(pl.get_rid())
	return _ac


# what a hit is made of: a node's own `acoustic` metadata (it or a parent), a door, the room's floor, walls or ceiling
# by which way the hit faces (an interior's colliders are named by their room)
func _surface(hit: Dictionary) -> String:
	var n := hit.get("collider") as Node
	var k := n
	for i in 4:
		if k == null:
			break
		if k.has_meta("acoustic"):
			return str(k.get_meta("acoustic"))
		k = k.get_parent()
	if n == null:
		return ""
	var nm := str(n.name)
	if nm.begins_with("door_"):
		return "door"
	var room: Dictionary = _rooms.get(nm, {})
	if room.is_empty():
		return ""
	var ny: float = (hit.normal as Vector3).y
	return str(room.floor) if ny > 0.7 else (str(room.ceiling) if ny < -0.7 else str(room.walls))


# the level's rooms (every interior's markers: the export's floor kind and sets) and wet floors
func _learn() -> void:
	_rooms.clear()
	for it in get_tree().get_nodes_in_group("hs_interior"):
		var mk: Node = it.find_child("markers", true, false)
		if mk == null:
			continue
		for m in mk.get_children():
			var nm := str(m.name)
			if not (nm.begins_with("trigger_") and nm.ends_with("__volume")):
				continue
			var e: Dictionary = m.get_meta("extras", {}) if m.has_meta("extras") else {}
			var room := str(e.get("room", nm.trim_prefix("trigger_").trim_suffix("__volume")))
			var mats: Dictionary = e.get("mats", {}) if e.get("mats") is Dictionary else {}
			var fk := str(e.get("floor", "wood"))
			_rooms[room] = {"floor": Acoustics.material_of(str(mats.get("floor", "")), fk),
				"walls": Acoustics.material_of(str(mats.get("walls", ""))), "ceiling": Acoustics.material_of(str(mats.get("ceiling", ""))), "kind": fk}
	_wet.clear()
	for n in get_tree().root.find_children("*", "Node3D", true, false):
		var sc = n.get_script()
		var cls: String = sc.get_global_name() if sc != null else ""
		if cls == "HSPuddle":
			var r := float(n.get("size")) * 0.5 if n.get("size") != null else 0.4
			_wet.append(AABB(n.global_position - Vector3(r, 0.1, r), Vector3(r * 2.0, 0.3, r * 2.0)))
		elif cls == "HSWetSurface":
			var mi: Node = n.get("target") if n.get("target") is Node else n.get_parent()
			if mi is VisualInstance3D:
				_wet.append(mi.global_transform * (mi as VisualInstance3D).get_aabb())


## The rooms the sound knows, for a check: {room: {floor, walls, ceiling, kind}}.
func rooms() -> Dictionary:
	return _rooms


func _read_shelf() -> void:
	var path := "res://sfx/index.json"
	if not FileAccess.file_exists(path):
		return
	var d: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if d is Dictionary and d.get("sounds") is Dictionary:
		_shelf = d["sounds"]


func _free3() -> AudioStreamPlayer3D:
	for p in _p3:
		if not p.playing:
			return p
	var p := AudioStreamPlayer3D.new()
	p.attenuation_filter_cutoff_hz = 9000.0
	p.attenuation_filter_db = -12.0
	add_child(p)
	_p3.append(p)
	return p


func _free2() -> AudioStreamPlayer:
	for p in _p2:
		if not p.playing:
			return p
	var p := AudioStreamPlayer.new()
	add_child(p)
	_p2.append(p)
	return p


# the buses and their effects (made once; kept when they exist): the world's under World, the body's and the music
# beside it
func _build() -> void:
	_bus(BUS_WORLD, "Master")
	_bus("Music", "Master")
	_bus(BUS_BODY, "Master")
	for b in [BUS_SFX, BUS_FOLEY, BUS_EVENTS, BUS_TONE]:
		_bus(b, BUS_WORLD)
	_fx(_bus(VERB, BUS_WORLD), _lowpass(9000.0))
	_fx(_bus(VERB_DULL, BUS_WORLD), _lowpass(1200.0))
	_fx(_bus(ECHO, BUS_WORLD), _lowpass(4500.0))
	for i in MUFFLED.size():
		_fx(_bus(MUFFLED[i], BUS_WORLD), _lowpass(float(MUFFLED_HZ[i])))
	var tone_bus := AudioServer.get_bus_index(BUS_TONE)
	if AudioServer.get_bus_effect_count(tone_bus) == 0:
		var hard := _comp(-24.0, 2.5, 5000.0, 700.0)     # the big moments duck the rooms' tones
		hard.sidechain = BUS_EVENTS
		_fx(tone_bus, hard)
		for src in [BUS_FOLEY, BUS_SFX]:                 # what's close comes first: a gentle duck
			var d := _comp(-28.0, 1.6, 8000.0, 400.0)
			d.sidechain = src
			_fx(tone_bus, d)
	var master := AudioServer.get_bus_index("Master")
	var has_limit := false
	for i in AudioServer.get_bus_effect_count(master):
		if AudioServer.get_bus_effect(master, i) is AudioEffectHardLimiter:
			has_limit = true
	if not has_limit:
		var l := AudioEffectHardLimiter.new()
		l.ceiling_db = -0.5
		_fx(master, l)


## The bus `name` (made, sending to `send`, when it doesn't exist; an old SFX bus sent on to World): its index. Under
## the mixer's lock (Woohill's bug 68: add_bus() and set_bus_send() don't take it, and the audio thread can read the
## bus map while it grows).
static func _bus(name: String, send: String) -> int:
	var i := AudioServer.get_bus_index(name)
	AudioServer.lock()
	if i == -1:
		AudioServer.add_bus()
		i = AudioServer.bus_count - 1
		AudioServer.set_bus_name(i, name)
	if AudioServer.get_bus_send(i) != StringName(send) and name != "Master":
		AudioServer.set_bus_send(i, send)
	AudioServer.unlock()
	return i


static func _fx(bus: int, fx: AudioEffect) -> AudioEffect:
	for k in AudioServer.get_bus_effect_count(bus):
		if AudioServer.get_bus_effect(bus, k).get_class() == fx.get_class() and not (fx is AudioEffectCompressor):
			return AudioServer.get_bus_effect(bus, k)     # (made already: a scene played twice)
	AudioServer.lock()
	AudioServer.add_bus_effect(bus, fx)
	AudioServer.unlock()
	return fx


static func _comp(threshold: float, ratio: float, attack_us: float, release_ms: float) -> AudioEffectCompressor:
	var c := AudioEffectCompressor.new()
	c.threshold = threshold
	c.ratio = ratio
	c.attack_us = attack_us
	c.release_ms = release_ms
	return c


static func _lowpass(hz: float) -> AudioEffectLowPassFilter:
	var f := AudioEffectLowPassFilter.new()
	f.cutoff_hz = hz
	return f


# ---- the beds -------------------------------------------------------------------------------------------------------

func _mood_stream(m: String) -> AudioStream:
	var s: AudioStream = get(m) if m in ["calm", "uneasy", "dread", "chase"] else null
	if s == null and m in ["calm", "uneasy", "dread", "chase"]:
		var path := "res://music/%s.ogg" % m
		if ResourceLoader.exists(path):
			s = load(path)
	return s


func _aim(prefix: String, key: String, stream: AudioStream, secs: float) -> void:
	if key != "" and stream != null and not _tracks.has(prefix + key):
		var st: AudioStream = stream.duplicate()      # its own copy, looped here
		if "loop" in st:
			st.loop = true
		var p := AudioStreamPlayer.new()
		p.stream = st
		p.bus = "Music" if prefix == "m:" else BUS_TONE
		p.volume_db = -80.0
		add_child(p)
		_tracks[prefix + key] = {"player": p, "g": 0.0, "target": 0.0, "rate": 1.0, "kind": prefix}
	for k in _tracks:
		var tr: Dictionary = _tracks[k]
		if tr["kind"] != prefix:
			continue
		tr["target"] = 1.0 if (key != "" and k == prefix + key) else 0.0
		tr["rate"] = 1.0 / maxf(secs, 0.001)
		if secs <= 0.0:
			tr["g"] = tr["target"]
		if float(tr["target"]) > 0.0 and not tr["player"].playing:
			tr["player"].play()


func _process(dt: float) -> void:
	dt = minf(0.05, dt)
	_clock += dt
	var k := duck()
	if _hush != null and _clock - float(_hush["t0"]) >= float(_hush["secs"]) + float(_hush["back"]):
		_hush = null
	for key in _tracks:
		var tr: Dictionary = _tracks[key]
		tr["g"] = move_toward(float(tr["g"]), float(tr["target"]), float(tr["rate"]) * dt)
		var p: AudioStreamPlayer = tr["player"]
		var amp: float = sin(float(tr["g"]) * PI * 0.5) * k          # equal power: two crossing sum to one
		p.volume_db = (music_db if tr["kind"] == "m:" else tone_db) + linear_to_db(maxf(amp, 0.00001))
		if float(tr["g"]) <= 0.0 and float(tr["target"]) <= 0.0 and p.playing:
			p.stop()
	for e: Array in _echoes.duplicate():                   # the echoes due
		if _clock < float(e[0]):
			continue
		_echoes.erase(e)
		var p3 := _free3()
		p3.stream = e[1]
		p3.pitch_scale = float(e[2])
		p3.volume_db = float(e[3])
		p3.bus = ECHO
		p3.unit_size = unit_size
		p3.max_distance = max_distance
		p3.global_position = e[4]
		p3.play()
