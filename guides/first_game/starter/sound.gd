## The music and the room's sound, for a game built by hand (guides/tutorial_v2; the studio games' own beds, the same
## numbers): the studio's four moods (calm, uneasy, dread, chase: made by tools/score/moods.mjs, in the project's music/
## folder) looped under the game and crossfading with equal power; a room's tone (a quiet loop off the sound shelf: the
## room_tone.gd areas set it); and the hush before a scare: both fade to nothing, the last half second silent, then
## come back slowly. Put it in the main scene: a Node called Sound with this script. The music plays on the Music bus,
## the tone on SFX (both made when the project hasn't them).
##   music("dread")    music("silence")    tone(stream)    await get_tree().create_timer(hush(1.5)).timeout
extends Node

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

var now_mood := "silence"
var now_tone: AudioStream = null
var _tracks := {}                                     # key -> {player, g, target, rate, kind}
var _hush = null                                      # {t0, secs, back, k0}
var _clock := 0.0


func _ready() -> void:
	add_to_group("hs_sound")
	for b in ["Music", "SFX"]:
		if AudioServer.get_bus_index(b) < 0:
			AudioServer.add_bus()
			var i := AudioServer.bus_count - 1
			AudioServer.set_bus_name(i, b)
			AudioServer.set_bus_send(i, "Master")
	if mood != "silence":
		music(mood, 1.0)


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
		p.bus = "Music" if prefix == "m:" else "SFX"
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
