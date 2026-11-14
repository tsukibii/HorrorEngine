@tool
## A character's face worn (docs/MARKERS.md §6.8): an expression by name on her face shapes, eased in, kept until
## another; one for a moment over it (a line of a conversation, an answer); a face clip from `res://faces/` played.
## The expressions are the Character Studio's own presets (tools/character/arkit_mhr.json) written on MHR's 72 face
## shapes, which every Studio export carries in Godot; a model with ARKit's 52 instead wears the same presets on
## those. A model with neither has no face to move: `has_shapes()` says so and nothing else happens.
##
## Her lids are her blinker's (the look plugin's HSBlink) when she has one: what a face asks of them is handed to it.
## Her body's clips never touch her face (the Animator bakes bones only), so any face goes with any marker.
class_name HSNpcFace
extends RefCounted

const MHR := {
	"neutral": {},
	"smile": {"lipCornerPuller_L": 0.7, "lipCornerPuller_R": 0.7, "cheekRaiser_L": 0.4, "cheekRaiser_R": 0.4, "lidTightener_L": 0.2, "lidTightener_R": 0.2},
	"big_smile": {"lipCornerPuller_L": 1.0, "lipCornerPuller_R": 1.0, "jawDrop": 0.25, "cheekRaiser_L": 0.7, "cheekRaiser_R": 0.7, "lidTightener_L": 0.4, "lidTightener_R": 0.4, "upperLipRaiser_L": 0.3, "upperLipRaiser_R": 0.3},
	"open_smile": {"jawDrop": 0.33, "lowerLipDepressor_L": 0.7, "lowerLipDepressor_R": 0.7, "lipCornerPuller_L": 0.45, "lipCornerPuller_R": 0.45, "lipStretcher_L": 0.5, "lipStretcher_R": 0.5, "dimpler_L": 0.5, "dimpler_R": 0.5, "upperLipRaiser_L": 0.05, "upperLipRaiser_R": 0.05, "cheekRaiser_L": 0.3, "cheekRaiser_R": 0.3},
	"surprise": {"innerBrowRaiser_L": 0.9, "innerBrowRaiser_R": 0.9, "outerBrowRaiser_L": 0.9, "outerBrowRaiser_R": 0.9, "upperLidRaiser_L": 0.8, "upperLidRaiser_R": 0.8, "jawDrop": 0.4},
	"fear": {"innerBrowRaiser_L": 0.8, "innerBrowRaiser_R": 0.8, "upperLidRaiser_L": 1.0, "upperLidRaiser_R": 1.0, "lipStretcher_L": 0.5, "lipStretcher_R": 0.5, "jawDrop": 0.2},
	"sad": {"innerBrowRaiser_L": 0.7, "innerBrowRaiser_R": 0.7, "lipCornerDepressor_L": 0.6, "lipCornerDepressor_R": 0.6, "chinRaiser_B": 0.3, "eyesLookDown_L": 0.2, "eyesLookDown_R": 0.2},
	"angry": {"browLowerer_L": 0.9, "browLowerer_R": 0.9, "noseWrinkler_L": 0.5, "noseWrinkler_R": 0.5, "lidTightener_L": 0.4, "lidTightener_R": 0.4, "lipPressor_L": 0.5, "lipPressor_R": 0.5},
	"disgust": {"noseWrinkler_L": 0.8, "noseWrinkler_R": 0.8, "upperLipRaiser_L": 0.6, "upperLipRaiser_R": 0.6, "browLowerer_L": 0.4, "browLowerer_R": 0.4},
	"pout": {"lipPucker_L": 0.7, "lipPucker_R": 0.7, "chinRaiser_T": 0.3},
	"scream": {"jawDrop": 0.95, "upperLidRaiser_L": 1.0, "upperLidRaiser_R": 1.0, "upperLipRaiser_L": 0.6, "upperLipRaiser_R": 0.6, "lipStretcher_L": 0.6, "lipStretcher_R": 0.6, "noseWrinkler_L": 0.5, "noseWrinkler_R": 0.5, "browLowerer_L": 0.5, "browLowerer_R": 0.5},
	"eyes_shut": {"eyesClosed_L": 1.0, "eyesClosed_R": 1.0},
}
const ARKIT := {
	"neutral": {},
	"smile": {"mouthSmileLeft": 0.7, "mouthSmileRight": 0.7, "cheekSquintLeft": 0.4, "cheekSquintRight": 0.4, "eyeSquintLeft": 0.2, "eyeSquintRight": 0.2},
	"big_smile": {"mouthSmileLeft": 1.0, "mouthSmileRight": 1.0, "jawOpen": 0.25, "cheekSquintLeft": 0.7, "cheekSquintRight": 0.7, "eyeSquintLeft": 0.4, "eyeSquintRight": 0.4, "mouthUpperUpLeft": 0.3, "mouthUpperUpRight": 0.3},
	"open_smile": {"mouthSmileLeft": 0.6, "mouthSmileRight": 0.6, "jawOpen": 0.33, "mouthLowerDownLeft": 0.7, "mouthLowerDownRight": 0.7, "cheekSquintLeft": 0.3, "cheekSquintRight": 0.3},
	"surprise": {"browInnerUp": 0.9, "browOuterUpLeft": 0.9, "browOuterUpRight": 0.9, "eyeWideLeft": 0.8, "eyeWideRight": 0.8, "jawOpen": 0.4},
	"fear": {"browInnerUp": 0.8, "eyeWideLeft": 1.0, "eyeWideRight": 1.0, "mouthStretchLeft": 0.5, "mouthStretchRight": 0.5, "jawOpen": 0.2},
	"sad": {"browInnerUp": 0.7, "mouthFrownLeft": 0.6, "mouthFrownRight": 0.6, "mouthShrugLower": 0.3, "eyeLookDownLeft": 0.2, "eyeLookDownRight": 0.2},
	"angry": {"browDownLeft": 0.9, "browDownRight": 0.9, "noseSneerLeft": 0.5, "noseSneerRight": 0.5, "eyeSquintLeft": 0.4, "eyeSquintRight": 0.4, "mouthPressLeft": 0.5, "mouthPressRight": 0.5},
	"disgust": {"noseSneerLeft": 0.8, "noseSneerRight": 0.8, "mouthUpperUpLeft": 0.6, "mouthUpperUpRight": 0.6, "browDownLeft": 0.4, "browDownRight": 0.4},
	"pout": {"mouthPucker": 0.7, "mouthShrugUpper": 0.3},
	"scream": {"jawOpen": 0.95, "eyeWideLeft": 1.0, "eyeWideRight": 1.0, "mouthUpperUpLeft": 0.6, "mouthUpperUpRight": 0.6, "mouthStretchLeft": 0.6, "mouthStretchRight": 0.6, "noseSneerLeft": 0.5, "noseSneerRight": 0.5, "browDownLeft": 0.5, "browDownRight": 0.5},
	"eyes_shut": {"eyeBlinkLeft": 1.0, "eyeBlinkRight": 1.0},
}
const TITLES := {"neutral": "Neutral", "smile": "Smile", "big_smile": "Big smile", "open_smile": "Open smile", "surprise": "Surprised", "fear": "Afraid", "sad": "Sad",
	"angry": "Angry", "disgust": "Disgusted", "pout": "Pout", "scream": "Scream", "eyes_shut": "Eyes shut"}
const FOLDERS := ["res://faces", "res://faces/loops"]

var meshes: Array = []                     ## [[MeshInstance3D, {shape name: its index}]]: every mesh of hers that carries face shapes
var kind := ""                             ## "mhr", "arkit", or "": no face shapes
var blink: Node                            ## her blinker, when she has one
var base := {}                             ## the weights she wears
var base_name := ""
var base_amount := 1.0
var over := {}                             ## a face for a moment
var over_left := 0.0
var cur := {}                              ## what's on her face now
var speed := 4.0                           ## how fast a face comes and goes (1/s: a quarter of a second)
var clip := {}                             ## a face clip playing: {shapes, weights, frames, fps, loop, t}
var _clips := {}


## the expressions there are: the presets' names, then the project's face clips as "clip:<id>"
static func names(with_clips := true) -> PackedStringArray:
	var out := PackedStringArray(MHR.keys())
	if with_clips:
		for folder in FOLDERS:
			if not DirAccess.dir_exists_absolute(folder):
				continue
			for f in DirAccess.get_files_at(folder):
				if f.ends_with(".tres"):
					var id := "clip:" + f.get_basename()
					if not (id in out):
						out.append(id)
	return out


static func title_of(n: String) -> String:
	if n.begins_with("clip:"):
		return n.substr(5).capitalize() + " (clip)"
	return TITLES.get(n, n.capitalize())


func setup(her: Node) -> void:
	meshes = []
	kind = ""
	blink = null
	if her == null:
		return
	var mhr := 0
	var ark := 0
	for mi in her.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null or m.get_blend_shape_count() == 0:
			continue
		var idx := {}
		for i in m.get_blend_shape_count():
			idx[String(m.mesh.get_blend_shape_name(i))] = i
		meshes.append([m, idx])
		if idx.has("lipCornerPuller_L") or idx.has("jawDrop"):
			mhr += 1
		if idx.has("mouthSmileLeft") or idx.has("jawOpen"):
			ark += 1
	kind = "mhr" if mhr > 0 else ("arkit" if ark > 0 else "")
	for n in her.find_children("*", "", true, false):         # (HSBlink: find_children knows no script's class)
		if n.get("hold") is Vector2 and n.has_method("blink_now"):
			blink = n
			break


func has_shapes() -> bool:
	return kind != ""


## an expression's weights on her face: {shape: weight}
func weights_of(n: String, amount := 1.0) -> Dictionary:
	var src: Dictionary = (MHR if kind != "arkit" else ARKIT).get(n, {})
	var out := {}
	for k in src:
		out[k] = clampf(float(src[k]) * amount, 0.0, 1.0)
	return out


## worn from now on ("" leaves what she has; "neutral": none); a clip ("clip:<id>") plays and, looped, goes on
func wear(n: String, amount := 1.0, secs := 0.25) -> void:
	if n == "":
		return
	base_name = n
	base_amount = amount
	speed = 1.0 / maxf(secs, 0.02)
	clip = {}
	if n.begins_with("clip:"):
		base = {}
		_play_clip(n.substr(5), amount)
	else:
		base = weights_of(n, amount)


## for a moment over what she wears
func flash(n: String, amount := 1.0, secs := 1.6) -> void:
	if n == "" or n.begins_with("clip:"):
		return
	over = weights_of(n, amount)
	over_left = secs


func tick(dt: float) -> void:
	if kind == "":
		return
	var want := base
	if not clip.is_empty():
		want = _sample(dt)
	if over_left > 0.0:
		over_left -= dt
		want = over
	var changed := {}
	var sp := 30.0 if not clip.is_empty() and over_left <= 0.0 else speed      # (a clip is followed, not eased toward)
	for k in want:
		var v := move_toward(float(cur.get(k, 0.0)), float(want[k]), dt * sp)
		if absf(v - float(cur.get(k, 0.0))) > 0.0005 or not cur.has(k):
			cur[k] = v
			changed[k] = v
	for k in cur.keys():
		if not want.has(k):
			var v2 := move_toward(float(cur[k]), 0.0, dt * sp)
			changed[k] = v2
			if v2 <= 0.0:
				cur.erase(k)
			else:
				cur[k] = v2
	if changed.is_empty():
		return
	var lids := Vector2(float(cur.get("eyesClosed_L", cur.get("eyeBlinkLeft", 0.0))), float(cur.get("eyesClosed_R", cur.get("eyeBlinkRight", 0.0))))
	var blinker := blink != null and is_instance_valid(blink)
	for row in meshes:
		if not is_instance_valid(row[0]):
			continue
		var mi := row[0] as MeshInstance3D
		var idx: Dictionary = row[1]
		for k in changed:
			if idx.has(k) and not (blinker and String(k).begins_with("eyesClosed_")):
				mi.set_blend_shape_value(idx[k], float(changed[k]))
	if blinker:
		blink.set("hold", lids)


## at once, no easing (the tester's start, a checkpoint)
func snap() -> void:
	var s := speed
	speed = 1e6
	tick(1.0)
	speed = s


func snapshot() -> Dictionary:
	return {"name": base_name, "amount": base_amount}


func restore(d: Dictionary) -> void:
	over_left = 0.0
	wear(String(d.get("name", "")) if String(d.get("name", "")) != "" else "neutral", float(d.get("amount", 1.0)), 0.05)


# ---- a face clip (the Face page's export: res://faces/<id>.tres), read as text so it needs no script of its own --------------
static func _between(text: String, head: String) -> String:
	var at := text.find(head)
	if at < 0:
		return ""
	var end := text.find(")", at)
	return text.substr(at + head.length(), end - at - head.length()) if end > at else ""


static func read_clip(id: String) -> Dictionary:
	for folder in FOLDERS:
		var path := "%s/%s.tres" % [folder, id]
		if not FileAccess.file_exists(path):
			continue
		var text := FileAccess.get_file_as_string(path)
		var shapes := PackedStringArray()
		for s in _between(text, "shapes = PackedStringArray(").split(",", false):
			shapes.append(s.strip_edges().trim_prefix("\"").trim_suffix("\""))
		var weights := PackedFloat32Array()
		for w in _between(text, "weights = PackedFloat32Array(").split(",", false):
			weights.append(float(w.strip_edges()))
		var fps := 30.0
		var loop := false
		for line in text.split("\n"):
			if line.begins_with("fps = "):
				fps = float(line.substr(6))
			elif line.begins_with("loop = "):
				loop = line.substr(7).strip_edges() == "true"
		if shapes.is_empty() or weights.is_empty():
			return {}
		return {"shapes": shapes, "weights": weights, "frames": weights.size() / shapes.size(), "fps": fps, "loop": loop}
	return {}


func _play_clip(id: String, amount: float) -> void:
	if not _clips.has(id):
		_clips[id] = read_clip(id)
	var c: Dictionary = _clips[id]
	if c.is_empty():
		return
	clip = c.duplicate()
	clip["t"] = 0.0
	clip["amount"] = amount


func _sample(dt: float) -> Dictionary:
	var frames := int(clip["frames"])
	var shapes: PackedStringArray = clip["shapes"]
	var weights: PackedFloat32Array = clip["weights"]
	clip["t"] = float(clip["t"]) + dt
	var f := float(clip["t"]) * float(clip["fps"])
	if bool(clip["loop"]):
		f = fposmod(f, float(frames))
	else:
		f = minf(f, float(frames - 1))
	var a := int(floor(f)) % frames
	var b := (a + 1) % frames if bool(clip["loop"]) else mini(a + 1, frames - 1)
	var k: float = f - floor(f)
	var out := {}
	for i in shapes.size():
		var v := lerpf(weights[a * shapes.size() + i], weights[b * shapes.size() + i], k) * float(clip.get("amount", 1.0))
		if v > 0.001:
			out[shapes[i]] = clampf(v, 0.0, 1.0)
	return out
