## A Kimodo motion onto a character's own skeleton (docs/GODOT_DIRECTOR.md §6b): the SOMA joints' positions each frame
## (npz.gd) as a Godot Animation of the skeleton's bones, the way the desk's bodies.js drives MHR from them: each limb
## bone aimed joint to joint with a side axis from the positions (the elbow's bend, the palm, the toes), so neither
## rig's rotation conventions or rest pose (a T-pose against an A-pose) matter, and the trunk turned by SOMA's own
## turn from its rest (the spine keeps the character's curve). The hips carry the travel, scaled by the legs. Knows
## the Character Studio's MHR skeleton, Kimodo's own SOMA, Godot's humanoid profile (a model imported with a BoneMap)
## and Mixamo's names; the model faces +Z, its left +X (Godot's and glTF's front, as Kimodo's).
@tool
class_name HSRetarget
extends RefCounted

const SOMA_FILE := "res://kimodo/soma77.json"
## the joints the retarget talks about, by family: a key -> the bone (or SOMA joint) that is it
const FAMILIES := {
	"soma": {"hips": "Hips", "spine": "Spine1", "spine2": "Spine2", "chest": "Chest", "neck": "Neck1", "head": "Head", "head_end": "HeadEnd",
		"eye_l": "LeftEye", "eye_r": "RightEye", "clav_l": "LeftShoulder", "arm_l": "LeftArm", "fore_l": "LeftForeArm", "hand_l": "LeftHand",
		"mid_l": "LeftHandMiddle2", "index_l": "LeftHandIndex2", "pinky_l": "LeftHandPinky2", "thigh_l": "LeftLeg", "shin_l": "LeftShin",
		"foot_l": "LeftFoot", "toe_l": "LeftToeBase", "toe_end_l": "LeftToeEnd",
		"thumb1_l": "LeftHandThumb1", "thumb2_l": "LeftHandThumb2", "thumb3_l": "LeftHandThumb3", "thumbe_l": "LeftHandThumbEnd",
		"index1_l": "LeftHandIndex2", "index2_l": "LeftHandIndex3", "index3_l": "LeftHandIndex4", "indexe_l": "LeftHandIndexEnd",
		"middle1_l": "LeftHandMiddle2", "middle2_l": "LeftHandMiddle3", "middle3_l": "LeftHandMiddle4", "middlee_l": "LeftHandMiddleEnd",
		"ring1_l": "LeftHandRing2", "ring2_l": "LeftHandRing3", "ring3_l": "LeftHandRing4", "ringe_l": "LeftHandRingEnd",
		"pinky0_l": "LeftHandPinky1", "pinky1_l": "LeftHandPinky2", "pinky2_l": "LeftHandPinky3", "pinky3_l": "LeftHandPinky4", "pinkye_l": "LeftHandPinkyEnd"},
	"mhr": {"hips": "root", "spine": "c_spine0", "spine1": "c_spine1", "spine2": "c_spine2", "chest": "c_spine3", "neck": "c_neck", "head": "c_head",
		"head_end": "c_head_null", "eye_l": "l_eye", "eye_r": "r_eye", "clav_l": "l_clavicle", "arm_l": "l_uparm", "fore_l": "l_lowarm", "hand_l": "l_wrist",
		"mid_l": "l_middle1", "index_l": "l_index1", "pinky_l": "l_pinky1", "thigh_l": "l_upleg", "shin_l": "l_lowleg", "foot_l": "l_foot", "toe_l": "l_ball",
		"thumb1_l": "l_thumb1", "thumb2_l": "l_thumb2", "thumb3_l": "l_thumb3", "thumbe_l": "l_thumb_null",
		"index1_l": "l_index1", "index2_l": "l_index2", "index3_l": "l_index3", "indexe_l": "l_index_null",
		"middle1_l": "l_middle1", "middle2_l": "l_middle2", "middle3_l": "l_middle3", "middlee_l": "l_middle_null",
		"ring1_l": "l_ring1", "ring2_l": "l_ring2", "ring3_l": "l_ring3", "ringe_l": "l_ring_null",
		"pinky0_l": "l_pinky0", "pinky1_l": "l_pinky1", "pinky2_l": "l_pinky2", "pinky3_l": "l_pinky3", "pinkye_l": "l_pinky_null"},
	"humanoid": {"hips": "Hips", "spine": "Spine", "spine2": "Chest", "chest": "UpperChest", "neck": "Neck", "head": "Head", "eye_l": "LeftEye",
		"eye_r": "RightEye", "clav_l": "LeftShoulder", "arm_l": "LeftUpperArm", "fore_l": "LeftLowerArm", "hand_l": "LeftHand", "mid_l": "LeftMiddleProximal",
		"index_l": "LeftIndexProximal", "pinky_l": "LeftLittleProximal", "thigh_l": "LeftUpperLeg", "shin_l": "LeftLowerLeg", "foot_l": "LeftFoot", "toe_l": "LeftToes",
		"thumb1_l": "LeftThumbMetacarpal", "thumb2_l": "LeftThumbProximal", "thumb3_l": "LeftThumbDistal",
		"index1_l": "LeftIndexProximal", "index2_l": "LeftIndexIntermediate", "index3_l": "LeftIndexDistal",
		"middle1_l": "LeftMiddleProximal", "middle2_l": "LeftMiddleIntermediate", "middle3_l": "LeftMiddleDistal",
		"ring1_l": "LeftRingProximal", "ring2_l": "LeftRingIntermediate", "ring3_l": "LeftRingDistal",
		"pinky1_l": "LeftLittleProximal", "pinky2_l": "LeftLittleIntermediate", "pinky3_l": "LeftLittleDistal"},
	"mixamo": {"hips": "Hips", "spine": "Spine", "spine2": "Spine1", "chest": "Spine2", "neck": "Neck", "head": "Head", "head_end": "HeadTop_End",
		"clav_l": "LeftShoulder", "arm_l": "LeftArm", "fore_l": "LeftForeArm", "hand_l": "LeftHand", "mid_l": "LeftHandMiddle1", "index_l": "LeftHandIndex1",
		"pinky_l": "LeftHandPinky1", "thigh_l": "LeftUpLeg", "shin_l": "LeftLeg", "foot_l": "LeftFoot", "toe_l": "LeftToeBase", "toe_end_l": "LeftToe_End",
		"thumb1_l": "LeftHandThumb1", "thumb2_l": "LeftHandThumb2", "thumb3_l": "LeftHandThumb3", "thumbe_l": "LeftHandThumb4",
		"index1_l": "LeftHandIndex1", "index2_l": "LeftHandIndex2", "index3_l": "LeftHandIndex3", "indexe_l": "LeftHandIndex4",
		"middle1_l": "LeftHandMiddle1", "middle2_l": "LeftHandMiddle2", "middle3_l": "LeftHandMiddle3", "middlee_l": "LeftHandMiddle4",
		"ring1_l": "LeftHandRing1", "ring2_l": "LeftHandRing2", "ring3_l": "LeftHandRing3", "ringe_l": "LeftHandRing4",
		"pinky1_l": "LeftHandPinky1", "pinky2_l": "LeftHandPinky2", "pinky3_l": "LeftHandPinky3", "pinkye_l": "LeftHandPinky4"},
}
## the fingers (DECISIONS 2026-11-01: "we do want to be able to retarget Kimodo's fingers"): each finger bone aimed along
## SOMA's own segment, as the limbs are. The joints by their place, measured from the wrist at rest: SOMA's Index1,
## Middle1, Ring1 are in the palm (no bone of MHR's there), its Index2 the knuckle as MHR's index1 and Mixamo's
## Index1; MHR's thumb1 is SOMA's Thumb1 (its thumb0 a base joint by the wrist, left as it is), its pinky0 SOMA's
## Pinky1 (the palm's cupping). The side axis is the hand's across (pinky to index), the thumb's the palm's normal.
const FINGERS := ["thumb", "index", "middle", "ring", "pinky"]
## what's driven: [the bone's key, the key it aims at, its side axis's rule, mode]; `turn`: SOMA's turn from its own
## rest put on the bone's rest (the trunk), `aim`: the bone pointed where SOMA's points (the limbs)
const DRIVE := [["hips", "spine2", "legs", "turn"], ["spine", "spine2", "legs", "turn"], ["spine1", "chest", "shoulders", "turn"],
	["spine2", "chest", "shoulders", "turn"], ["chest", "neck", "shoulders", "turn"], ["neck", "head", "eyes", "turn"], ["head", "head_end", "eyes", "turn"],
	["clav_l", "arm_l", "torso", "aim"], ["arm_l", "fore_l", "elbow_l", "aim"], ["fore_l", "hand_l", "elbow_l", "aim"], ["hand_l", "mid_l", "across_l", "aim"],
	["thigh_l", "shin_l", "toes_l", "aim"], ["shin_l", "foot_l", "toes_l", "aim"], ["foot_l", "toe_l", "legs", "aim"], ["toe_l", "toe_end_l", "legs", "turn"],
	["clav_r", "arm_r", "torso", "aim"], ["arm_r", "fore_r", "elbow_r", "aim"], ["fore_r", "hand_r", "elbow_r", "aim"], ["hand_r", "mid_r", "across_r", "aim"],
	["thigh_r", "shin_r", "toes_r", "aim"], ["shin_r", "foot_r", "toes_r", "aim"], ["foot_r", "toe_r", "legs", "aim"], ["toe_r", "toe_end_r", "legs", "turn"]]
## the fingers' part of DRIVE: per hand, the pinky's metacarpal, then each finger's three segments to its tip (a rig with
## no tip bone turns its last by SOMA's turn)
static func finger_drive() -> Array:
	var out: Array = []
	for m in ["l", "r"]:
		out.append(["pinky0_" + m, "pinky1_" + m, "across_" + m, "aim"])
		for f in FINGERS:
			var rule: String = ("palm_" if f == "thumb" else "across_") + m
			out.append([f + "1_" + m, f + "2_" + m, rule, "aim"])
			out.append([f + "2_" + m, f + "3_" + m, rule, "aim"])
			out.append([f + "3_" + m, f + "e_" + m, rule, "aim"])
	return out


## SOMA's own segment for a key it has no joint of its own for (MHR's four spine bones over SOMA's three)
const SOMA_SEG := {"spine1": ["Spine2", "Chest"]}

static var _soma: Dictionary = {}


static func soma() -> Dictionary:
	if _soma.is_empty():
		var p := SOMA_FILE if FileAccess.file_exists(SOMA_FILE) else "res://addons/horrorstudio_director/kimodo/soma77.json"
		var j = JSON.parse_string(FileAccess.get_file_as_string(p)) if FileAccess.file_exists(p) else null
		if j is Dictionary:
			_soma = j
	return _soma


## a family's map with the right side's names made from the left's
static func family(name: String) -> Dictionary:
	var f: Dictionary = (FAMILIES.get(name, {}) as Dictionary).duplicate()
	for k in f.keys():
		var ks: String = k
		if ks.ends_with("_l"):
			var v: String = f[k]
			var r: String = ks.substr(0, ks.length() - 2) + "_r"
			if v.begins_with("Left"):
				f[r] = "Right" + v.substr(4)
			elif v.begins_with("l_"):
				f[r] = "r_" + v.substr(2)
	return f


## a bone's name without an exporter's prefix (mixamorig:Hips, mixamorig_Hips, Armature_Hips)
static func bare(n: String) -> String:
	if n.contains(":"):
		return n.substr(n.rfind(":") + 1)
	for pre in ["mixamorig_", "mixamorig1_", "mixamorig2_"]:
		if n.begins_with(pre):
			return n.substr(pre.length())
	return n


## which family a skeleton's bones are: mhr, soma, mixamo, humanoid, or "" (none we know)
static func detect(sk: Skeleton3D) -> String:
	var names := {}
	for i in sk.get_bone_count():
		names[bare(sk.get_bone_name(i))] = true
	if names.has("c_spine0") and names.has("l_uparm"):
		return "mhr"
	if names.has("LeftShin") and names.has("Spine1"):
		return "soma"
	if names.has("LeftUpLeg") and names.has("LeftForeArm"):
		return "mixamo"
	if names.has("LeftUpperLeg") and names.has("LeftLowerArm"):
		return "humanoid"
	return ""


static func _bone(sk: Skeleton3D, nm: String) -> int:
	for i in sk.get_bone_count():
		if bare(sk.get_bone_name(i)) == nm:
			return i
	return -1


## an orthonormal frame from a primary axis and the first usable of the secondaries (bodies.js frame)
static func frame(p: Vector3, secs: Array) -> Basis:
	var a := p.normalized()
	var s := Vector3.ZERO
	for v in secs:
		if v is Vector3 and v.length() > 1e-6 and abs(a.dot(v.normalized())) < 0.92:
			s = v.normalized()
			break
	if s == Vector3.ZERO:
		s = Vector3.UP if abs(a.y) < 0.9 else Vector3(0, 0, 1)
	var c := a.cross(s).normalized()
	var b := c.cross(a).normalized()
	return Basis(a, b, c)


## a side rule's candidate axes from positions by key (bodies.js sideAxis)
static func sides(rule: String, pos: Callable) -> Array:
	var v := func(a: String, b: String):
		var pa = pos.call(a)
		var pb = pos.call(b)
		return (pb - pa) if (pa != null and pb != null) else null
	var parts := rule.split("_")
	var k := parts[0]
	var m := parts[1] if parts.size() > 1 else "l"
	var across = v.call("pinky_" + m, "index_" + m)
	match k:
		"legs":
			return [v.call("thigh_r", "thigh_l")]
		"shoulders":
			return [v.call("arm_r", "arm_l"), v.call("thigh_r", "thigh_l")]
		"eyes":
			return [v.call("eye_r", "eye_l"), v.call("arm_r", "arm_l"), v.call("thigh_r", "thigh_l")]
		"torso":
			return [v.call("spine", "neck"), v.call("thigh_r", "thigh_l")]
		"across":
			return [across, v.call("arm_r", "arm_l")]
		"palm":                                           # the thumb's: the palm's normal (across the hand by along it), then across
			var along = v.call("hand_" + m, "mid_" + m)
			var nrm = across.cross(along) if (across != null and along != null) else null
			return [nrm, across, v.call("arm_r", "arm_l")]
		"toes":
			return [v.call("foot_" + m, "toe_" + m), v.call("thigh_r", "thigh_l")]
		"elbow":
			var a = v.call("arm_" + m, "fore_" + m)
			var b = v.call("fore_" + m, "hand_" + m)
			var n = a.cross(b) if (a != null and b != null) else null
			return [n if (n != null and n.length() > 0.2 * a.length() * b.length()) else null, across, v.call("arm_r", "arm_l")]
	return []


## the motion as an Animation on the skeleton: frames of SOMA joints (77 a frame, character space, metres);
## `char_root` the character's node (its +Z the front), `anim_root` the AnimationPlayer's root (track paths from it);
## opts: fps (30), in_place (the travel taken out, the sway kept), loop, skip (frames between keys, 1)
static func animation(frames: Array, sk: Skeleton3D, char_root: Node3D, anim_root: Node, opts: Dictionary = {}) -> Animation:
	var S := soma()
	if S.is_empty() or frames.is_empty():
		return null
	var fam_name := detect(sk)
	if fam_name == "":
		push_error("HSRetarget: the skeleton's bones aren't MHR's, SOMA's, Mixamo's or Godot's humanoid profile's")
		return null
	var fam := family(fam_name)
	var sf := family("soma")
	var names: Array = S["names"]
	var sidx := {}
	for i in names.size():
		sidx[names[i]] = i
	var rest_s: Array = S["rest"]
	var fps := float(opts.get("fps", 30.0))
	# the skeleton in the character's space (an armature turned or scaled by its exporter)
	var T := Transform3D()
	if char_root != null and char_root.is_inside_tree() and sk.is_inside_tree():
		T = char_root.global_transform.affine_inverse() * sk.global_transform
	var Ti := T.affine_inverse()
	# the target's bones: rest (skeleton space), order parents first
	var nb := sk.get_bone_count()
	var order: Array = []
	var depth := {}
	for i in nb:
		var d := 0
		var p := sk.get_bone_parent(i)
		while p >= 0:
			d += 1
			p = sk.get_bone_parent(p)
		depth[i] = d
		order.append(i)
	order.sort_custom(func(a, b): return depth[a] < depth[b])
	var rest_local: Array = []
	var rest_global: Array = []
	rest_local.resize(nb)
	rest_global.resize(nb)
	for i in nb:
		rest_local[i] = sk.get_bone_rest(i)
		rest_global[i] = sk.get_bone_global_rest(i)
	var key_bone := {}
	for k in fam:
		var b := _bone(sk, fam[k])
		if b >= 0:
			key_bone[k] = b
	# the target's rest positions by key (skeleton space) and SOMA's rest positions by key
	var tpos := func(k: String):
		return (rest_global[key_bone[k]] as Transform3D).origin if key_bone.has(k) else null
	var srest := func(k: String):
		var nm = sf.get(k)
		if nm == null and SOMA_SEG.has(k):
			nm = SOMA_SEG[k][0]
		if nm == null or not sidx.has(nm):
			return null
		var r: Array = rest_s[sidx[nm]]
		return Ti.basis * Vector3(float(r[0]), float(r[1]), float(r[2]))
	# the hips' scale: the target's hips height over SOMA's
	var hips_b: int = key_bone.get("hips", -1)
	if hips_b < 0:
		push_error("HSRetarget: no hips bone")
		return null
	var soma_hip_y := float(rest_s[sidx["Hips"]][1])
	var tgt_hip_y: float = (T * (rest_global[hips_b] as Transform3D).origin).y
	var kscale: float = tgt_hip_y / soma_hip_y if soma_hip_y > 0.01 else 1.0
	# each driven bone's rest frame: aim from the target's own rest positions; turn from SOMA's rest
	var drive: Array = []
	for d in DRIVE + finger_drive():
		var key: String = d[0]
		if not key_bone.has(key):
			continue
		var seg: Array = SOMA_SEG.get(key, [sf.get(key, ""), sf.get(d[1], "")])
		var seg_from: String = seg[0]
		var seg_to: String = seg[1]
		if not sidx.has(seg_from) or not sidx.has(seg_to):
			continue
		var mode: String = d[3]
		if mode == "aim" and not key_bone.has(d[1]):
			mode = "turn"                                   # nothing of the target's to aim it by (a toe with no end): SOMA's turn
		var rf: Basis
		if mode == "aim":
			rf = frame(tpos.call(d[1]) - tpos.call(key), sides(d[2], tpos))
		else:
			rf = frame(_sv(rest_s, sidx, Ti, seg_to) - _sv(rest_s, sidx, Ti, seg_from), sides(d[2], srest))
		drive.append({"bone": key_bone[key], "key": key, "from": seg_from, "to": seg_to, "rule": d[2], "mode": mode, "rf": rf,
			"rw": (rest_global[key_bone[key]] as Transform3D).basis.orthonormalized()})
	var driven := {}
	for d in drive:
		driven[d["bone"]] = d
	# the hips' path, in place: its smoothed travel taken out
	var hips_path: Array = []
	for f in frames:
		hips_path.append((f as PackedVector3Array)[sidx["Hips"]] * kscale)
	if opts.get("in_place", false):                   # Kimodo's own In place: the path smoothed over 0.25 s, pinned at both ends, taken out
		var win := int(max(1.0, fps * 0.125))
		var last := hips_path.size() - 1
		var sm: Array = []
		for i in hips_path.size():
			var acc := Vector3.ZERO
			var n := 0
			for j in range(i - win, i + win + 1):
				acc += hips_path[clamp(j, 0, last)]
				n += 1
			sm.append(acc / n)
		var d0: Vector3 = hips_path[0] - sm[0]
		var d1: Vector3 = hips_path[last] - sm[last]
		for i in hips_path.size():
			var u: float = float(i) / max(1, last)
			var path: Vector3 = sm[i] + d0 * (1.0 - u) + d1 * u
			var h: Vector3 = hips_path[i]
			hips_path[i] = Vector3(h.x - path.x, h.y, h.z - path.z)
	var anim := Animation.new()
	var step := int(opts.get("skip", 1))
	anim.length = max(1.0 / fps, (frames.size() - 1) / fps)
	anim.loop_mode = Animation.LOOP_LINEAR if opts.get("loop", false) else Animation.LOOP_NONE
	var base_path := str(anim_root.get_path_to(sk)) if anim_root != null else "."
	var rot_tracks := {}
	for d in drive:
		var tr := anim.add_track(Animation.TYPE_ROTATION_3D)
		anim.track_set_path(tr, base_path + ":" + sk.get_bone_name(d["bone"]))
		rot_tracks[d["bone"]] = tr
	var pos_track := anim.add_track(Animation.TYPE_POSITION_3D)
	anim.track_set_path(pos_track, base_path + ":" + sk.get_bone_name(hips_b))
	# the hand's own turn: SOMA's palm bases (where its metacarpals start) go only with the hand, the knuckles also with
	# their metacarpals (a palm cupping); the knuckles the side axes read are put where the hand alone takes them, so a
	# finger moving never rolls the hand
	var palm := {}
	for m in ["l", "r"]:
		var S2 := "Left" if m == "l" else "Right"
		var pts := [S2 + "Hand", S2 + "HandMiddle1", S2 + "HandIndex1", S2 + "HandPinky1"]
		if pts.all(func(nm): return sidx.has(nm)) and sf.has("mid_" + m) and sf.has("index_" + m) and sf.has("pinky_" + m):
			var base := func(P: Callable) -> Basis:
				return frame(P.call(pts[1]) - P.call(pts[0]), [P.call(pts[2]) - P.call(pts[3])])
			var R0 := func(nm: String) -> Vector3:
				return _sv(rest_s, sidx, Ti, nm)
			palm[m] = {"pts": pts, "base": base, "rest": base.call(R0), "hand": R0.call(pts[0]),
				"knuckles": {"mid_" + m: R0.call(sf["mid_" + m]), "index_" + m: R0.call(sf["index_" + m]), "pinky_" + m: R0.call(sf["pinky_" + m])}}
	for fi in range(0, frames.size(), step):
		var fr: PackedVector3Array = frames[fi]
		var rigid := {}
		for m in palm:
			var pm: Dictionary = palm[m]
			var C := func(nm: String) -> Vector3:
				return Ti.basis * fr[sidx[nm]]
			var R: Basis = (pm["base"] as Callable).call(C) * (pm["rest"] as Basis).inverse()
			var h: Vector3 = C.call(pm["pts"][0])
			for k in pm["knuckles"]:
				rigid[k] = h + R * ((pm["knuckles"][k] as Vector3) - (pm["hand"] as Vector3))
		var spos := func(k: String):
			if rigid.has(k):
				return rigid[k]
			var nm = sf.get(k)
			if nm == null or not sidx.has(nm):
				return null
			return Ti.basis * fr[sidx[nm]]
		var world: Array = []
		world.resize(nb)
		for i in order:
			var p := sk.get_bone_parent(i)
			var pw: Transform3D = world[p] if p >= 0 else Transform3D()
			var w: Transform3D = pw * (rest_local[i] as Transform3D)
			if i == hips_b:
				w.origin = Ti * hips_path[fi]
			if driven.has(i):
				var d: Dictionary = driven[i]
				var a: Vector3 = Ti.basis * (fr[sidx[d["to"]]] - fr[sidx[d["from"]]])
				var hk: String = str(d["key"])
				if hk.begins_with("hand_") and rigid.has("mid_" + hk.substr(5)):      # the hand aimed by its own turn (its middle knuckle where the hand takes it)
					a = (rigid["mid_" + hk.substr(5)] as Vector3) - Ti.basis * fr[sidx[d["from"]]]
				var cur := frame(a, sides(d["rule"], spos))
				w.basis = (cur * (d["rf"] as Basis).inverse() * (d["rw"] as Basis)).orthonormalized()
			world[i] = w
		var t := fi / fps
		for d in drive:
			var i: int = d["bone"]
			var p2 := sk.get_bone_parent(i)
			var pb: Basis = (world[p2] as Transform3D).basis if p2 >= 0 else Basis()
			anim.rotation_track_insert_key(rot_tracks[i], t, Quaternion((pb.inverse() * (world[i] as Transform3D).basis).orthonormalized()))
		var ph := sk.get_bone_parent(hips_b)
		var pw2: Transform3D = world[ph] if ph >= 0 else Transform3D()
		anim.position_track_insert_key(pos_track, t, pw2.affine_inverse() * (world[hips_b] as Transform3D).origin)
	return anim


static func _sv(rest_s: Array, sidx: Dictionary, Ti: Transform3D, nm: String) -> Vector3:
	var r: Array = rest_s[sidx[nm]]
	return Ti.basis * Vector3(float(r[0]), float(r[1]), float(r[2]))


## the AnimationPlayer a character's motions go on: hers (a child of the character, its root the character), made
## when she has none; the library "kimodo" on it
static func player_of(char_root: Node3D) -> AnimationPlayer:
	for c in char_root.get_children():
		if c is AnimationPlayer:
			return c
	var ap := AnimationPlayer.new()
	ap.name = "Motions"
	char_root.add_child(ap)
	ap.root_node = NodePath("..")
	return ap


static func skeleton_of(char_root: Node) -> Skeleton3D:
	var s := char_root.find_children("*", "Skeleton3D", true, false)
	return s[0] if s.size() else null
