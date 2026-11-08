## The beds under the game (docs/HORROR_TODO.md 13.1, docs/research/jump_scares.md §8): the music's mood (the story's
## `music`: calm, uneasy, dread, chase, or silence) and the room's tone (a room's `tone`, else `game.tone`, a loop off
## the sound shelf), each a loop crossfading into the next with equal power; `hush` ducks both to nothing so the last
## half second before a sting is silent, then lets them back slowly. The music plays on the Music bus, the tone on SFX
## (the pause menu's rows). Owned by the main scene, so the music carries through scenes and stitches; the desk's
## play/beds.js is the same numbers. Headless it keeps its numbers all the same: `state()` says what's playing.
extends Node

const MOODS := ["calm", "uneasy", "dread", "chase"]
const MUSIC_DB := -6.0         # the music under the game: the moods made at -20 LUFS (moods.mjs), so about -26
const TONE_DB := -22.0         # a room's hum under everything: the shelf's loops near -16 LUFS, so about -38
const FADE := 2.0              # a mood's crossfade (s): the music action's `secs`
const TONE_FADE := 1.5         # one room's tone into the next
const QUIET := 0.5             # a hush's last half second: nothing at all
const BACK := 6.0              # the beds' way back after a hush (s), slow at first

var game = null
var mood = null                # the mood playing (null: silence)
var tone = null                # the room tone playing (a shelf name, null: none)
var tracks: Dictionary = {}    # "m:<mood>" / "t:<name>" -> {"player", "g", "target", "rate", "kind"}
var hush_ = null               # {"t0", "secs", "back", "k0"}
var clock := 0.0


func _ready() -> void:
	for b in ["Music", "SFX"]:                 # the pause menu's rows set these; a project with only Master gets them
		if AudioServer.get_bus_index(b) < 0:
			AudioServer.add_bus()
			var i := AudioServer.bus_count - 1
			AudioServer.set_bus_name(i, b)
			AudioServer.set_bus_send(i, "Master")
	var st: Dictionary = load("res://addons/horrorstudio_ui/menu.gd").load_settings()
	for pair in [["music", "Music"], ["sfx", "SFX"]]:
		var k: float = float(st.get(pair[0], 8)) / 10.0
		AudioServer.set_bus_volume_db(AudioServer.get_bus_index(pair[1]), linear_to_db(max(0.0001, k)))


## the story's `music`: a mood, or silence (null, "", "silence"), crossfading over `secs`
func music(m, secs: float = FADE) -> void:
	var to = null if (m == null or str(m) in ["", "silence", "none"]) else str(m)
	if to != null and not MOODS.has(to):
		return
	mood = to
	_aim("m:", to, secs)


## the room's tone (a shelf name; null or "none" for none), crossfading over TONE_FADE
func room_tone(name, secs: float = TONE_FADE) -> void:
	var to = null if (name == null or str(name) in ["", "none", "silence"]) else str(name)
	if to == tone:
		return
	tone = to
	_aim("t:", to, secs)


## the story's `hush`: both beds down to nothing over `secs` less its last half second, that half second silent; back
## over `back` after. Returns how long it takes (the caller waits it out before the sting)
func hush(secs: float = 1.5, back: float = BACK) -> float:
	secs = max(secs, QUIET)
	hush_ = {"t0": clock, "secs": secs, "back": max(back, 0.1), "k0": duck()}
	return secs


## how loud the beds are let be now, 0..1 (a hush on them)
func duck() -> float:
	if hush_ == null:
		return 1.0
	var t: float = clock - float(hush_["t0"])
	var secs: float = float(hush_["secs"])
	var fall: float = max(secs - QUIET, 0.01)
	if t < fall:
		return float(hush_["k0"]) * (1.0 - smoothstep(0.0, 1.0, t / fall))
	if t < secs:
		return 0.0
	if t < secs + float(hush_["back"]):
		return smoothstep(0.0, 1.0, (t - secs) / float(hush_["back"]))
	return 1.0


func _aim(prefix: String, to, secs: float) -> void:
	if to != null and not tracks.has(prefix + str(to)):
		var st: AudioStream = _stream(prefix, str(to))
		if st != null:
			var p := AudioStreamPlayer.new()
			p.stream = st
			p.bus = "Music" if prefix == "m:" else "SFX"
			p.volume_db = -80.0
			add_child(p)
			tracks[prefix + str(to)] = {"player": p, "g": 0.0, "target": 0.0, "rate": 1.0, "kind": prefix}
	for key in tracks:
		var tr: Dictionary = tracks[key]
		if tr["kind"] != prefix:
			continue
		tr["target"] = 1.0 if (to != null and key == prefix + str(to)) else 0.0
		tr["rate"] = 1.0 / max(secs, 0.001)
		if secs <= 0.0:
			tr["g"] = tr["target"]
		if float(tr["target"]) > 0.0 and not tr["player"].playing:
			tr["player"].play()


func _stream(prefix: String, name: String) -> AudioStream:
	var path := ""
	if prefix == "m:":
		path = "res://game/music/%s.ogg" % name
	else:
		var s: Dictionary = (game.sfx_index if game != null else {}).get(name, {})
		if str(s.get("file", "")) == "":
			return null
		path = "res://game/sfx/" + str(s["file"])
	var st: AudioStream = null
	if ResourceLoader.exists(path):
		st = load(path)
		if st != null:
			st = st.duplicate()                  # its own copy: looped here whatever the shelf's player does with it
	elif FileAccess.file_exists(path):
		st = AudioStreamOggVorbis.load_from_file(path) if path.ends_with(".ogg") else (AudioStreamWAV.load_from_file(path) if path.ends_with(".wav") else null)
	if st != null and "loop" in st:
		st.loop = true
	return st


func _process(dt: float) -> void:
	dt = min(0.05, dt)                        # the play's own step (play.gd's tick): a hush ends with the beat's wait
	clock += dt
	var k := duck()
	if hush_ != null and clock - float(hush_["t0"]) >= float(hush_["secs"]) + float(hush_["back"]):
		hush_ = null
	for key in tracks:
		var tr: Dictionary = tracks[key]
		tr["g"] = move_toward(float(tr["g"]), float(tr["target"]), float(tr["rate"]) * dt)
		var p: AudioStreamPlayer = tr["player"]
		var amp: float = sin(float(tr["g"]) * PI * 0.5) * k        # equal power: two crossfading sum to one
		p.volume_db = (MUSIC_DB if tr["kind"] == "m:" else TONE_DB) + linear_to_db(max(amp, 0.00001))
		if float(tr["g"]) <= 0.0 and float(tr["target"]) <= 0.0 and p.playing:
			p.stop()


## what the beds are doing, for the checks: the mood and tone, each track's fade (0..1: its loudness is that times the
## duck), the duck (a hush on them)
func state() -> Dictionary:
	var lv := {}
	for key in tracks:
		lv[key] = snappedf(sin(float(tracks[key]["g"]) * PI * 0.5), 0.001)
	return {"music": mood, "tone": tone, "duck": snappedf(duck(), 0.001), "levels": lv, "hushing": hush_ != null}


## everything off at once (the run's end)
func stop_all() -> void:
	mood = null
	tone = null
	hush_ = null
	for key in tracks:
		tracks[key]["g"] = 0.0
		tracks[key]["target"] = 0.0
		tracks[key]["player"].stop()
