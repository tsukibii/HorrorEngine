## Writing in the steam (docs/research/intensity.md §5.3; What Lies Beneath's "You know"): a mirror fogs over from its
## bottom edge in `steam_seconds`, and words a finger left on the glass show in it as it comes, clear lines in the fog
## (grease keeps glass from fogging: Rayleigh, 1911). It holds `hold` seconds, then clears over `clear_seconds`, and
## the words go with it: they were only ever the fog not forming. `mirror` is the Look plugin's HSMirrorSurface on the
## glass. fire() from any signal starts it: a cue (you looking into the mirror a moment), an area, a moment. `sound` a
## shelf sound as it starts (a hot tap left running), at the mirror; `steamed` once it's fogged over (the words there),
## `cleared` when it's gone.
extends Node

signal steamed
signal cleared

@export var mirror: Node                          ## the HSMirrorSurface on the glass
@export var text := "308"
@export var steam_seconds := 6.0
@export var hold := 20.0                          ## seconds fogged over, the words there
@export var clear_seconds := 10.0
@export var once := true
@export var sound := ""                           ## off the shelf, at the mirror, as it starts
@export var sound_db := -6.0

var level := 0.0                                  ## the steam now, 0..1 (a check's)
var phase := "idle"                               ## idle, steaming, holding, clearing
var count := 0
var _t := 0.0


## it starts steaming (from any signal: whatever it sends is ignored)
func fire(_a = null, _b = null) -> void:
	if phase != "idle" or (once and count > 0) or mirror == null:
		return
	count += 1
	phase = "steaming"
	_t = 0.0
	mirror.set("writing", text)
	var snd := get_tree().get_first_node_in_group("hs_sound")
	var at: Node3D = mirror.call("mesh") if mirror.has_method("mesh") else null
	if sound != "" and snd != null and snd.has_method("play") and at != null:
		snd.play(sound, at.global_position, sound_db, "sfx")


func _process(dt: float) -> void:
	var was := level
	match phase:
		"steaming":
			level = minf(1.0, level + dt / maxf(steam_seconds, 0.01))
			if level >= 1.0:
				phase = "holding"
				_t = 0.0
				steamed.emit()
		"holding":
			_t += dt
			if _t >= hold:
				phase = "clearing"
		"clearing":
			level = maxf(0.0, level - dt / maxf(clear_seconds, 0.01))
			if level <= 0.0:
				phase = "idle"
				if mirror != null:
					mirror.set("writing", "")
				cleared.emit()
	if level != was and mirror != null:
		mirror.set("steam", level)
