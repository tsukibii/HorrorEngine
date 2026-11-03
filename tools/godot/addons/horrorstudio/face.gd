## Faces in play (STORY_FORMAT §4 `expr`, DECISIONS 2026-11-01): an expression from the studio's library (an HSFaceClip,
## tools/face_export.mjs: res://faces/<id>.tres, the loops in res://faces/loops/) on a cast member's face: the mesh
## carrying MHR's face shapes, by Meta's names (the bake's bodies, a Character Studio export carrying them) or as the
## plain MHR body has them (shape_c_45 on, in MHR's order). Each face has what it rests in (a loop running; none: at
## rest) and what plays over it: a capture once, faded in and out, then gone; a loop until another takes over. The
## newest takes over from the one before over its fade in, as the desk's face rows do (face.js faceAt).
extends RefCounted

const ClipC := preload("res://addons/horrorstudio/face_clip.gd")
## MHR's 72 face shapes in its order (Meta's names: tools/character/pack_mhr.py)
const MHR72 := [
	"browLowerer_L", "browLowerer_R", "cheekPuff_L", "cheekPuff_R", "cheekRaiser_L", "cheekRaiser_R", "cheekSuck_L",
	"cheekSuck_R", "chinRaiser_B", "chinRaiser_T", "dimpler_L", "dimpler_R", "eyesClosed_L", "eyesClosed_R",
	"eyesLookDown_L", "eyesLookDown_R", "eyesLookLeft_L", "eyesLookLeft_R", "eyesLookRight_L", "eyesLookRight_R",
	"eyesLookUp_L", "eyesLookUp_R", "innerBrowRaiser_L", "innerBrowRaiser_R", "jawDrop", "jawSidewaysLeft",
	"jawSidewaysRight", "jawThrust", "lidTightener_L", "lidTightener_R", "lipCornerDepressor_L", "lipCornerDepressor_R",
	"lipCornerPuller_L", "lipCornerPuller_R", "lipFunneler_LB", "lipFunneler_LT", "lipFunneler_RB", "lipFunneler_RT",
	"lipPressor_L", "lipPressor_R", "lipPucker_L", "lipPucker_R", "lipStretcher_L", "lipStretcher_R", "lipSuck_LB",
	"lipSuck_LT", "lipSuck_RB", "lipSuck_RT", "lipTightener_L", "lipTightener_R", "lipsToward_LB", "lipsToward_LT",
	"lipsToward_RB", "lipsToward_RT", "lowerLipDepressor_L", "lowerLipDepressor_R", "mouthLeft", "mouthRight",
	"nasolabialFurrow_L", "nasolabialFurrow_R", "noseWrinkler_L", "noseWrinkler_R", "nostrilCompressor_L",
	"nostrilCompressor_R", "nostrilDilator_L", "nostrilDilator_R", "outerBrowRaiser_L", "outerBrowRaiser_R",
	"upperLidRaiser_L", "upperLidRaiser_R", "upperLipRaiser_L", "upperLipRaiser_R"]

var rt = null
var people := {}             # who -> {node, mesh, idx: {shape: blend index}, rest: [layers], over: [layers], live: {}}
static var _clips := {}


func _init(runtime = null) -> void:
	rt = runtime


## an expression's baked clip by its id (cached; null when the project hasn't got it: tools/face_export.mjs)
static func clip(id: String):
	if _clips.has(id):
		return _clips[id]
	var c = null
	for p in ["res://faces/%s.tres" % id, "res://faces/loops/%s.tres" % id]:
		if ResourceLoader.exists(p):
			c = load(p)
			break
	_clips[id] = c
	return c


## the mesh on a person carrying MHR's face shapes, each one's blend index by its Meta name ({} when she has none)
static func face_of(node: Node) -> Dictionary:
	if node == null:
		return {}
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or not (mi.mesh is ArrayMesh) or (mi.mesh as ArrayMesh).get_blend_shape_count() == 0:
			continue
		var idx := {}
		for i in MHR72.size():
			var b: int = mi.find_blend_shape_by_name(MHR72[i])
			if b < 0:
				b = mi.find_blend_shape_by_name("shape_c_%d" % (45 + i))
			if b >= 0:
				idx[MHR72[i]] = b
		if idx.size() > 0:
			return {"mesh": mi, "idx": idx}
	return {}


## `id` on who's face: opts `loop` (else as the clip is), `w` its weight (1), `in` and `out` its fades (0.25, 0.3),
## `rest` true: the face she rests in. An empty id: what plays over her face fades out (with rest: her rest goes).
## False when there's no such clip (the face is left as it was).
func play(who: String, node: Node, id, opts: Dictionary = {}) -> bool:
	var p: Dictionary = people.get(who, {})
	if p.is_empty():
		p = {"node": null, "mesh": null, "idx": {}, "rest": [], "over": [], "live": {}}
		people[who] = p
	var rest := bool(opts.get("rest", false))
	var list: Array = p["rest"] if rest else p["over"]
	var c = null
	if id != null and str(id) != "":
		c = clip(str(id))
		if c == null:
			return false
	var fin := float(opts.get("in", 0.25))
	for l in list:                                    # the ones before fade out as this comes in
		if not l["going"]:
			l["going"] = true
			l["end"] = min(float(l["end"]), float(l["age"]) + max(0.05, fin if c != null else float(opts.get("out", 0.3))))
			l["fout"] = max(0.05, fin if c != null else float(opts.get("out", 0.3)))
	if c != null:
		var loop := bool(opts.get("loop", c.loop)) or rest
		list.append({"clip": c, "id": str(id), "age": 0.0, "w": clamp(float(opts.get("w", 1.0)), 0.0, 2.0), "fin": max(0.0, fin),
			"fout": max(0.0, float(opts.get("out", 0.3))), "end": INF if loop else float(c.secs), "loop": loop, "going": false, "buf": PackedFloat32Array()})
	if node != null:
		p["node"] = null                              # found again on the next tick (a new level's copy)
	return true


static func _smooth(x: float) -> float:
	return 0.0 if x <= 0.0 else (1.0 if x >= 1.0 else x * x * (3.0 - 2.0 * x))


func _env(l: Dictionary) -> float:
	var a: float = l["age"]
	var e_in: float = 1.0 if float(l["fin"]) <= 0.0 else a / float(l["fin"])
	var e_out: float = 1.0 if (float(l["fout"]) <= 0.0 or is_inf(float(l["end"]))) else (float(l["end"]) - a) / float(l["fout"])
	return _smooth(min(e_in, e_out))


## a set of layers' weights summed into acc (each shape by name), scaled by k; returns their envelopes' sum
func _mix(list: Array, acc: Dictionary, k: float) -> float:
	var sum := 0.0
	var envs: Array = []
	for l in list:
		var e := _env(l)
		envs.append(e)
		sum += e
	var norm := 1.0 / sum if sum > 1.0 else 1.0
	for i in list.size():
		var l: Dictionary = list[i]
		var e: float = envs[i] * norm * k * float(l["w"])
		if e <= 0.0:
			continue
		var c = l["clip"]
		var buf: PackedFloat32Array = l["buf"]
		c.at(float(l["age"]), buf)
		l["buf"] = buf
		for j in c.shapes.size():
			acc[c.shapes[j]] = float(acc.get(c.shapes[j], 0.0)) + buf[j] * e
	return min(sum, 1.0)


## every frame: the layers aged, the gone ones dropped, each face's shapes set (over her rest by how far what plays
## over it has come in)
func tick(dt: float) -> void:
	for who in people:
		var p: Dictionary = people[who]
		for key in ["rest", "over"]:
			var keep: Array = []
			for l in p[key]:
				l["age"] = float(l["age"]) + dt
				if float(l["age"]) < float(l["end"]):
					keep.append(l)
			p[key] = keep
		var node = rt.cast_nodes.get(who) if rt != null else null
		if node == null or not is_instance_valid(node):
			continue
		if p["node"] != node or p["mesh"] == null or not is_instance_valid(p["mesh"]):
			var f := face_of(node)
			p["node"] = node
			p["mesh"] = f.get("mesh")
			p["idx"] = f.get("idx", {})
			p["live"] = {}
		if p["mesh"] == null:
			continue
		var acc := {}
		var over := _mix(p["over"], acc, 1.0)
		_mix(p["rest"], acc, 1.0 - over)
		var mi: MeshInstance3D = p["mesh"]
		var idx: Dictionary = p["idx"]
		var live: Dictionary = p["live"]
		for nm in live:                               # what was on and isn't now: back to 0
			if not acc.has(nm) and idx.has(nm):
				mi.set_blend_shape_value(idx[nm], 0.0)
		for nm in acc:
			if idx.has(nm):
				mi.set_blend_shape_value(idx[nm], clamp(float(acc[nm]), 0.0, 1.0))
		p["live"] = acc


## what's on who's face now, for the checks and F9: {rest: id or "", over: id or "", weight: the biggest shape's}
func state(who: String) -> Dictionary:
	var p: Dictionary = people.get(who, {})
	if p.is_empty():
		return {"rest": "", "over": "", "weight": 0.0}
	var big := 0.0
	for nm in p.get("live", {}):
		big = max(big, float(p["live"][nm]))
	var r: Array = p["rest"].filter(func(l): return not l["going"])
	var o: Array = p["over"].filter(func(l): return not l["going"])
	return {"rest": r[-1]["id"] if r.size() else "", "over": o[-1]["id"] if o.size() else "", "weight": big, "mesh": p.get("mesh") != null}
