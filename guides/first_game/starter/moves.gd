## Her moves: a clip for each thing a character does (DECISIONS 2026-11-12, the hunt: "consider how to attach
## animations to the behaviours (from kimodo)"). Put this node under a character and give each move a clip; whatever
## moves her (hunt.gd, a hunt spot, your own script) asks for a move by name and this plays its clip:
##     her.get_node("Moves").play("stalk", 1.1)      # the move, and how fast she's going (m/s)
## A clip is one of:
##   - a Kimodo motion, an .npz saved from the demo (res://animations/creep_walk.npz): read when the game starts and
##     put onto HER skeleton (the Director's retarget, copied into every by-hand project as res://kimodo/: the
##     Character Studio's MHR, Mixamo's names, Godot's humanoid profile, Kimodo's own SOMA), so one .npz serves every
##     character;
##   - an animation file (.res, .tres, .anim) made for her skeleton;
##   - the name of an animation her model already has (on any AnimationPlayer under her).
## A move with no clip falls back (stalk to walk, lunge to run, watch to idle...) and then to nothing: she slides, as the
## starter's searcher does, and everything still works. Walks are made in place (the script that moves her does the
## travelling) and looped, and played faster or slower by how fast she's really going, so her feet don't skate.
## What to make in Kimodo for a hunter is in guides/tutorial_v2 (The hunt): idle, walk, run, stalk, watch, peek, lunge.
extends Node

signal made(count: int)                               ## her clips are ready (count: how many)

const MOVES := ["idle", "walk", "run", "stalk", "crawl", "watch", "peek", "search", "lunge", "kill", "hit"]
const FALLBACK := {"stalk": "walk", "crawl": "stalk", "run": "walk", "watch": "idle", "search": "idle", "peek": "watch",
	"lunge": "run", "kill": "lunge", "hit": "idle"}
const RETARGET := ["res://kimodo/retarget.gd", "res://addons/horrorstudio_director/kimodo/retarget.gd"]
const NPZ := ["res://kimodo/npz.gd", "res://addons/horrorstudio_director/kimodo/npz.gd"]

@export_group("Her moves")
@export_file("*.npz", "*.res", "*.tres", "*.anim") var idle := ""     ## standing (looped)
@export_file("*.npz", "*.res", "*.tres", "*.anim") var walk := ""     ## walking (looped, in place)
@export_file("*.npz", "*.res", "*.tres", "*.anim") var run := ""      ## running: a dart across a doorway, a rush
@export_file("*.npz", "*.res", "*.tres", "*.anim") var stalk := ""    ## coming slowly: creeping, low, wrong
@export_file("*.npz", "*.res", "*.tres", "*.anim") var crawl := ""    ## on all fours
@export_file("*.npz", "*.res", "*.tres", "*.anim") var watch := ""    ## stood watching you, far off
@export_file("*.npz", "*.res", "*.tres", "*.anim") var peek := ""     ## leaning out round a corner
@export_file("*.npz", "*.res", "*.tres", "*.anim") var search := ""   ## looking round for you
@export_file("*.npz", "*.res", "*.tres", "*.anim") var lunge := ""    ## at you: an ambush, the catch
@export_file("*.npz", "*.res", "*.tres", "*.anim") var kill := ""     ## what she does when she has you
@export_file("*.npz", "*.res", "*.tres", "*.anim") var hit := ""      ## shot
@export var more := {}                                ## moves of your own: {"wave": "res://animations/wave.npz"}
@export_group("How")
@export var in_place := PackedStringArray(["walk", "run", "stalk", "crawl"])   ## made without their travel (the script moves her)
@export var loops := PackedStringArray(["idle", "walk", "run", "stalk", "crawl", "watch", "search"])
@export var blend := 0.25                             ## seconds from one move into the next
@export var fps := 30.0                               ## a Kimodo motion's frames a second
@export var match_speed := true                       ## a walk played by how fast she's going

var now := ""                                         ## the move playing
var ready_now := false
var clips := {}                                       # move -> {player, name, secs, speed (m/s it travels at, 0: unknown)}
var problems: Array = []                              ## what couldn't be made, in words (a check's, the Output's)
var _own: AnimationPlayer


func _ready() -> void:
	make.call_deferred()


func her() -> Node3D:
	return get_parent() as Node3D


## every move's clip, by its name: the exports and `more`
func wanted() -> Dictionary:
	var w := {}
	for m in MOVES:
		if str(get(m)) != "":
			w[m] = str(get(m))
	for k in more:
		if str(more[k]) != "":
			w[str(k)] = str(more[k])
	return w


## Her clips made (again): called when the game starts; call it yourself after changing a clip.
func make() -> void:
	clips = {}
	problems = []
	var h := her()
	if h == null:
		return
	for m in wanted():
		var src: String = wanted()[m]
		var c := _clip(h, m, src)
		if c.is_empty():
			continue
		clips[m] = c
	ready_now = true
	for p in problems:
		push_warning("moves.gd (%s): %s" % [h.name, p])
	made.emit(clips.size())


func _script_at(paths: Array) -> GDScript:
	for p in paths:
		if ResourceLoader.exists(p):
			return load(p) as GDScript
	return null


func _clip(h: Node3D, move: String, src: String) -> Dictionary:
	var is_file := src.begins_with("res://") or src.begins_with("user://")
	if not is_file:                                       # an animation her model has
		for ap in h.find_children("*", "AnimationPlayer", true, false):
			if (ap as AnimationPlayer).has_animation(src):
				var a := (ap as AnimationPlayer).get_animation(src)
				if loops.has(move):
					a.loop_mode = Animation.LOOP_LINEAR
				return {"player": ap, "name": src, "secs": a.length, "speed": 0.0}
		problems.append("%s: no animation named '%s' under her" % [move, src])
		return {}
	var anim: Animation = null
	var travel := 0.0
	if src.get_extension().to_lower() == "npz":
		var R := _script_at(RETARGET)
		var N := _script_at(NPZ)
		if R == null or N == null:
			problems.append("%s: the Kimodo reader isn't in this project (res://kimodo/: `python tools/godot_byhand.py install <project>` puts it there)" % move)
			return {}
		var sks := h.find_children("*", "Skeleton3D", true, false)
		if sks.is_empty():
			problems.append("%s: she has no skeleton (a stand-in slides; a Character Studio export or any rigged model plays it)" % move)
			return {}
		var sk := sks[0] as Skeleton3D
		if str(R.call("detect", sk)) == "":
			problems.append("%s: her skeleton isn't one the retarget knows (MHR, Mixamo, Godot's humanoid, SOMA)" % move)
			return {}
		var frames: Array = N.call("joints", N.call("read", ProjectSettings.globalize_path(src)))
		if frames.is_empty():
			problems.append("%s: %s has no posed_joints (is it a Kimodo .npz?)" % [move, src.get_file()])
			return {}
		anim = R.call("animation", frames, sk, h, h, {"fps": fps, "in_place": in_place.has(move), "loop": loops.has(move)})
		if anim == null:
			problems.append("%s: the retarget of %s failed" % [move, src.get_file()])
			return {}
		# how fast the motion travels (its hips, first frame to last): what a walk is played against
		var soma: Dictionary = R.call("soma")
		var hip := (soma.get("names", []) as Array).find("Hips")
		if hip >= 0 and frames.size() > 1:
			var a0: Vector3 = (frames[0] as PackedVector3Array)[hip]
			var a1: Vector3 = (frames[-1] as PackedVector3Array)[hip]
			travel = Vector2(a1.x - a0.x, a1.z - a0.z).length() / (float(frames.size() - 1) / fps)
	else:
		var r = load(src) if ResourceLoader.exists(src) else null
		if not (r is Animation):
			problems.append("%s: %s isn't an animation" % [move, src])
			return {}
		anim = r
		if loops.has(move):
			anim.loop_mode = Animation.LOOP_LINEAR
	if _own == null or not is_instance_valid(_own):
		_own = AnimationPlayer.new()
		_own.name = "MovesPlayer"
		h.add_child(_own)
		_own.root_node = _own.get_path_to(h)
		_own.add_animation_library("moves", AnimationLibrary.new())
	var lib := _own.get_animation_library("moves")
	if lib.has_animation(move):
		lib.remove_animation(move)
	lib.add_animation(move, anim)
	return {"player": _own, "name": "moves/" + move, "secs": anim.length, "speed": travel}


## the move that will really play for a name: itself, else what it falls back to, else ""
func resolve(move: String) -> String:
	var m := move
	for i in 6:
		if clips.has(m):
			return m
		if not FALLBACK.has(m):
			return ""
		m = FALLBACK[m]
	return ""


func has(move: String) -> bool:
	return resolve(move) != ""


## how long a move's clip is (0: she has none)
func secs(move: String) -> float:
	var m := resolve(move)
	return float(clips[m]["secs"]) if m != "" else 0.0


## Play a move (her clip for it, or what it falls back to). `speed`: how fast she's going in metres a second, for a
## walk to keep step (under 0: the clip as it was made). Returns the clip's length, 0 when she has none.
func play(move: String, speed := -1.0) -> float:
	var m := resolve(move)
	if m == "":
		if now != "":
			stop()
		return 0.0
	var c: Dictionary = clips[m]
	var ap := c["player"] as AnimationPlayer
	if not is_instance_valid(ap):
		return 0.0
	for other in clips.values():                          # (her model's own player and the made one: only one plays)
		var o := other["player"] as AnimationPlayer
		if o != ap and is_instance_valid(o) and o.is_playing():
			o.stop()
	var k := 1.0
	if match_speed and speed >= 0.0 and float(c["speed"]) > 0.05:
		k = clampf(speed / float(c["speed"]), 0.35, 2.5)
	ap.speed_scale = k
	if now != move or not ap.is_playing():
		ap.play(str(c["name"]), blend)
	now = move
	return float(c["secs"])


func stop() -> void:
	for c in clips.values():
		var ap := c["player"] as AnimationPlayer
		if is_instance_valid(ap):
			ap.stop()
	now = ""


## what's there, a check's: {moves: [...], playing, problems}
func report() -> Dictionary:
	var playing := ""
	for m in clips:
		var ap := clips[m]["player"] as AnimationPlayer
		if is_instance_valid(ap) and ap.is_playing() and ap.current_animation == str(clips[m]["name"]):
			playing = m
	return {"moves": clips.keys(), "playing": playing, "now": now, "problems": problems,
		"speeds": clips.keys().map(func(m): return snappedf(float(clips[m]["speed"]), 0.01))}
