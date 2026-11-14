## A hand brought the rest of the way, and closed round what it holds (docs/ANIMATOR_V3.md §4.2, docs/GODOT_LOOK.md
## §5y; DECISIONS 2026-11-14, animations v3: "semi ik", "make it look like the npc actually picked it up e.g to eat or
## drink", "punch which tracks the player or npc it's trying to punch, or swing object").
##
## A SkeletonModifier3D under her skeleton, for both hands. Her clip is played as it was made; after it, each frame:
##   bring(side, {...})   a point that rides her hand (in the wrist bone's own space) is brought onto a target in
##                        the world, as much as a weight says: the arm's two bones are solved again for where the
##                        wrist must be for that, the elbow kept on the side her clip had it. One rule, four uses:
##                        her palm onto a thing's grip as her hand closes on it; a held thing's mouth onto her mouth
##                        as she bites or sips (`aim`: the thing is also turned to point at her mouth); her knuckles
##                        onto who she punches; the end of what she holds onto who she swings at.
##                        The weight is an envelope over the clip's time (at(side, t)): rising into `peak`, held,
##                        let go; `freeze`: the target is taken as it was at the peak (a blow thrown doesn't home).
##   grip(side, size)     her fingers closed round a handle that thick (metres): each finger's joints bent so its
##                        bones lie against a circle of the handle's radius set in the palm, a thin handle a fist, a
##                        can an open hand; the thumb laid as the Animator lays a fist's. release(side).
## What it works from is her skeleton's rest pose alone (MHR's bones by name, a Mixamo skeleton's as far as they go):
## no record, so a character baked before this was written has it too. Nothing of it is kept in her pose.
class_name HSHandIK
extends SkeletonModifier3D

const SIDES := ["l", "r"]
const ARM := {
	"l": [["l_uparm", "LeftArm", "mixamorig_LeftArm", "mixamorig:LeftArm", "upperarm_l"], ["l_lowarm", "LeftForeArm", "mixamorig_LeftForeArm", "mixamorig:LeftForeArm", "lowerarm_l"], ["l_wrist", "LeftHand", "mixamorig_LeftHand", "mixamorig:LeftHand", "hand_l"]],
	"r": [["r_uparm", "RightArm", "mixamorig_RightArm", "mixamorig:RightArm", "upperarm_r"], ["r_lowarm", "RightForeArm", "mixamorig_RightForeArm", "mixamorig:RightForeArm", "lowerarm_r"], ["r_wrist", "RightHand", "mixamorig_RightHand", "mixamorig:RightHand", "hand_r"]]}
const FINGERS := ["thumb", "index", "middle", "ring", "pinky"]
const MOUTH := ["c_teeth", "c_tongue3"]
const PALM := 0.016                                 # the palm's flesh over its bones, metres on a hand of ordinary size
const FINGER := 0.0075                              # half a finger's thickness
const LIMITS := [deg_to_rad(92.0), deg_to_rad(112.0), deg_to_rad(80.0)]   # how far each joint of a finger bends

var hands := {}                                     # side -> {up, low, hand, size, c, n, t, f (rest, her own space), inv (the wrist's rest undone), fingers: [{bones, rests, parents, d0, k, base, p1, len}], ok}
var grips := {}                                     # side -> {size, shape, w, goal, secs, pose: {bone: Quaternion}}
var brings := {}                                    # side -> {point, anchor, target, peak, peaks, rise, hold, fall, aim, freeze, most, t, w, offset}
var last := {}                                      # side -> {point, target, error (m), weight}: what the last frame did, in the world (a check's)
var _ready_for: Skeleton3D


## one under `character`'s skeleton: the one already there, or a new one (null when she has no arms it knows)
static func attach(character: Node, settings: Dictionary = {}) -> HSHandIK:
	var m := of(character)
	if m == null:
		var sk := HSHeadTrack._skeleton(character)
		if sk == null or HSHeadTrack._find(sk, ARM["r"][2]) < 0:
			return null
		m = HSHandIK.new()
		m.name = "HSHandIK"
		sk.add_child(m)
	for k in settings:
		m.set(k, settings[k])
	return m


static func of(character: Node) -> HSHandIK:
	if character == null:
		return null
	if character is HSHandIK:
		return character
	for n in character.find_children("*", "SkeletonModifier3D", true, false):
		if n is HSHandIK:
			return n
	return null


## the envelope a `bring` rides: 0 before, rising over `rise` into `peak`, held `hold`, gone after `fall`
static func envelope(t: float, peak: float, rise: float, hold: float, fall: float) -> float:
	return smoothstep(peak - rise, peak, t) * (1.0 - smoothstep(peak + hold, peak + hold + maxf(0.01, fall), t))


# ---- what's asked of it ---------------------------------------------------------------------------------------------------
## her fingers closed round a handle `size` thick (metres) over `secs`; shape: "handle", "ball" or "pinch"
func grip(side: String, size := 0.035, shape := "handle", secs := 0.12) -> void:
	_ensure()
	if not hands.has(side):
		return
	var g: Dictionary = grips.get(side, {"w": 0.0})
	g["size"] = size
	g["shape"] = shape
	g["goal"] = 1.0
	g["secs"] = maxf(0.01, secs)
	g["pose"] = finger_pose(side, size, shape)
	grips[side] = g


func release(side: String, secs := 0.2) -> void:
	if grips.has(side):
		grips[side]["goal"] = 0.0
		grips[side]["secs"] = maxf(0.01, secs)


## how closed that hand is round what it holds, 0..1
func gripping(side: String) -> float:
	return float(grips[side]["w"]) if grips.has(side) else 0.0


## a point that rides the hand brought onto a target. o: {point: Vector3 in the wrist bone's own space (palm_point(),
## knuckles(), or a held thing's), target: a Vector3 in the world, a Node3D or a Callable giving one, peak, rise,
## hold, fall (seconds of the clip: at(side, t) moves it; without them set_weight), aim: also turn the hand so the
## point leads from `anchor` (the wrist's space; the palm when not given) toward the target, peaks: several peaks
## (a second bite), freeze: from the peak on, how far the point had to be moved then is kept as it was (a blow thrown
## doesn't home; a fist rapping on a door keeps rapping, on the door), most: never further than this from where the
## clip had it (m)}
func bring(side: String, o: Dictionary) -> void:
	_ensure()
	if not hands.has(side):
		return
	var peaks: Array = o.get("peaks", [float(o.get("peak", 0.0))])
	var b := {"point": o.get("point", palm_point(side)), "anchor": o.get("anchor", palm_point(side)), "target": o.get("target", Vector3.INF), "peak": float(peaks[0]), "peaks": peaks, "rise": float(o.get("rise", 0.25)),
		"hold": float(o.get("hold", 0.08)), "fall": float(o.get("fall", 0.3)), "aim": bool(o.get("aim", false)), "freeze": bool(o.get("freeze", false)), "most": float(o.get("most", 0.6)),
		"t": -1.0, "w": float(o.get("weight", 0.0)), "offset": Vector3.INF, "timed": o.has("peak") or o.has("peaks")}
	brings[side] = b


## the clip's own time, seconds: the weight follows its envelope
func at(side: String, t: float) -> void:
	if not brings.has(side):
		return
	var b: Dictionary = brings[side]
	b["t"] = t
	if b["timed"]:
		var w := 0.0
		var end := 0.0
		for pk in b["peaks"]:                               # (several: a second bite)
			w = maxf(w, envelope(t, float(pk), b["rise"], b["hold"], b["fall"]))
			end = maxf(end, float(pk))
		b["w"] = w
		if t > end + float(b["hold"]) + float(b["fall"]) + 0.05:
			brings.erase(side)


func set_weight(side: String, w: float) -> void:
	if brings.has(side):
		brings[side]["w"] = clampf(w, 0.0, 1.0)


func drop(side: String) -> void:
	brings.erase(side)


func bringing(side: String) -> bool:
	return brings.has(side)


# ---- her hands, read off her skeleton at rest --------------------------------------------------------------------------------
func _skeleton_changed(_old: Skeleton3D, _new: Skeleton3D) -> void:
	_ready_for = null


func _ensure() -> void:
	var sk := get_skeleton()
	if sk != null and _ready_for != sk:
		_setup(sk)


func _setup(sk: Skeleton3D) -> void:
	_ready_for = sk
	hands = {}
	for side in SIDES:
		var up := HSHeadTrack._find(sk, ARM[side][0])
		var low := HSHeadTrack._find(sk, ARM[side][1])
		var hand := HSHeadTrack._find(sk, ARM[side][2])
		if up < 0 or low < 0 or hand < 0:
			continue
		var h := {"up": up, "low": low, "hand": hand, "ok": false, "fingers": []}
		var gw := sk.get_bone_global_rest(hand)
		h["inv"] = gw.affine_inverse()
		var W := gw.origin
		var chains := []
		for f in FINGERS:
			chains.append(_finger(sk, side, f))
		var first := func(c: Array) -> int:                 # a finger's first knuckle: its bone named 1 (0 is the metacarpal)
			for b in c:
				if sk.get_bone_name(b).ends_with("1"):
					return b
			return c[0] if not c.is_empty() else -1
		var bi: int = first.call(chains[1])
		var bm: int = first.call(chains[2])
		var bp: int = first.call(chains[4])
		if bi < 0 or bm < 0 or bp < 0:                      # no fingers: the arm's IK still works, from a hand guessed along the forearm
			var along := (W - sk.get_bone_global_rest(low).origin).normalized()
			h["f"] = along
			h["n"] = (Vector3.FORWARD if absf(along.z) < 0.9 else Vector3.DOWN)
			h["t"] = along.cross(h["n"]).normalized()
			h["size"] = 1.0
			h["c"] = W + along * 0.085
			hands[side] = h
			continue
		var I := sk.get_bone_global_rest(bi).origin
		var M := sk.get_bone_global_rest(bm).origin
		var P := sk.get_bone_global_rest(bp).origin
		var n := (I - W).cross(P - W).normalized()
		if side == "l":
			n = -n                                          # (index x pinky points out of the back of the left hand, out of the palm of the right)
		var f := ((M - W) - n * (M - W).dot(n)).normalized()
		var t := ((I - P) - n * (I - P).dot(n)).normalized()
		var size := (M - W).length() / 0.079
		h["n"] = n
		h["f"] = f
		h["t"] = t
		h["size"] = size
		h["c"] = W + f * (0.8 * (M - W).length()) + t * ((I + P) * 0.5 - W).dot(t) + n * (PALM * size)   # the palm's middle, on its skin, just behind the knuckles
		var mid_d := _dir_of(sk, chains[2])
		for fi in FINGERS.size():
			var c: Array = chains[fi]
			if c.is_empty():
				continue
			var d0 := _dir_of(sk, c)
			var k := d0.cross(n).normalized()
			var base := Quaternion.IDENTITY                 # the fingers drawn together (a rig's rest pose holds them apart)
			if fi > 0 and fi != 2:
				var kg := d0.cross(mid_d)
				if kg.length() > 1e-4:
					base = Quaternion(kg.normalized(), 0.7 * asin(minf(1.0, kg.length())))
					k = (base * d0).cross(n).normalized()
			var lens := []
			var p1 := Vector3.ZERO
			var seg := []
			for b in c:
				if not sk.get_bone_name(b).ends_with("0"):
					seg.append(b)
			if not seg.is_empty():
				p1 = sk.get_bone_global_rest(seg[0]).origin
				for i in seg.size():
					var a := sk.get_bone_global_rest(seg[i]).origin
					var kids := sk.get_bone_children(seg[i])
					var e := sk.get_bone_global_rest(seg[i + 1]).origin if i + 1 < seg.size() else (sk.get_bone_global_rest(kids[0]).origin if not kids.is_empty() else a + d0 * 0.02 * size)
					lens.append(a.distance_to(e))
			(h["fingers"] as Array).append({"name": FINGERS[fi], "bones": c, "d0": d0, "k": k, "base": base, "p1": p1, "len": lens})
		h["ok"] = true
		hands[side] = h


# a finger's bones down its chain: MHR's <side>_<finger>0..3, or a Mixamo hand's
static func _finger(sk: Skeleton3D, side: String, finger: String) -> Array:
	var out := []
	for k in 4:
		var i := sk.find_bone("%s_%s%d" % [side, finger, k])
		if i >= 0:
			out.append(i)
	if out.is_empty():
		var word := ("Left" if side == "l" else "Right") + "Hand" + finger.capitalize()
		for k in [1, 2, 3]:
			for pre in ["", "mixamorig_", "mixamorig:"]:
				var i := sk.find_bone("%s%s%d" % [pre, word, k])
				if i >= 0:
					out.append(i)
					break
	return out


static func _dir_of(sk: Skeleton3D, chain: Array) -> Vector3:
	if chain.is_empty():
		return Vector3.FORWARD
	var first: int = chain[0]
	for b in chain:
		if not sk.get_bone_name(b).ends_with("0"):
			first = b
			break
	var kids := sk.get_bone_children(first)
	if kids.is_empty():
		return Vector3.FORWARD
	return (sk.get_bone_global_rest(kids[0]).origin - sk.get_bone_global_rest(first).origin).normalized()


func hand_bone(side: String) -> int:
	_ensure()
	return int(hands[side]["hand"]) if hands.has(side) else -1


## the middle of her palm, on its skin, in the wrist bone's own space
func palm_point(side: String) -> Vector3:
	_ensure()
	if not hands.has(side):
		return Vector3.ZERO
	return (hands[side]["inv"] as Transform3D) * (hands[side]["c"] as Vector3)


## the front of her fist, in the wrist bone's own space
func knuckles(side: String) -> Vector3:
	_ensure()
	if not hands.has(side):
		return Vector3.ZERO
	var h: Dictionary = hands[side]
	return (h["inv"] as Transform3D) * ((h["c"] as Vector3) + (h["f"] as Vector3) * (0.035 * float(h["size"])) - (h["n"] as Vector3) * (PALM * float(h["size"])))


## where a grip sits in her hand: a transform in the wrist bone's own space. Its origin is the middle of what the hand
## closes round, +Y along the handle toward her thumb, +Z from the handle to her palm (HSGrip's own frame: a held
## thing is put so its grip is here)
func grip_frame(side: String, size := 0.035, shape := "handle") -> Transform3D:
	_ensure()
	if not hands.has(side):
		return Transform3D.IDENTITY
	var h: Dictionary = hands[side]
	var n: Vector3 = h["n"]
	var t: Vector3 = h["t"]
	var s: float = h["size"]
	var y := t
	var z := -n
	var x := y.cross(z).normalized()
	var o: Vector3 = (h["c"] as Vector3) + n * (size * 0.5 + 0.002)
	if shape == "pinch":                                # between the thumb's and the first finger's tips
		o = (h["c"] as Vector3) + (h["f"] as Vector3) * (0.075 * s) + n * (0.022 * s) + t * (0.02 * s)
	return (h["inv"] as Transform3D) * Transform3D(Basis(x, y, z), o)


## each finger bone's own rotation for a hand closed round a handle `size` thick: {bone: Quaternion}
func finger_pose(side: String, size: float, shape := "handle") -> Dictionary:
	_ensure()
	var out := {}
	if not hands.has(side) or not bool(hands[side]["ok"]):
		return out
	var sk := get_skeleton()
	var h: Dictionary = hands[side]
	var n: Vector3 = h["n"]
	var s: float = h["size"]
	var r := maxf(0.002, size * 0.5)
	var centre: Vector3 = (h["c"] as Vector3) + n * (r + 0.002)
	var fist := clampf(1.0 - (size - 0.02) / 0.07, 0.0, 1.0)      # how much of a fist the thumb makes: all of it round a thin handle, none round a can
	var along: Vector3 = (sk.get_bone_global_rest(_first(sk, (h["fingers"] as Array)[2]["bones"] if (h["fingers"] as Array).size() > 2 else [])).origin - sk.get_bone_global_rest(h["hand"]).origin).normalized() if (h["fingers"] as Array).size() > 2 else (h["f"] as Vector3)
	for fg in h["fingers"]:
		var bones: Array = fg["bones"]
		var d0: Vector3 = fg["d0"]
		var k: Vector3 = fg["k"]
		var turn := {}                                  # bone -> its turn from rest, in her own space at rest, the hand's own turn left out
		if fg["name"] == "thumb":
			var ka := d0.cross(along)
			var la := ka.length()
			var room := asin(minf(1.0, la))
			var add := 0.5 * fist + 0.38 * (1.0 - fist) + (0.25 if shape == "pinch" else 0.0)
			var bend := 0.3 * (1.0 - 0.6 * fist)
			var amt := 0.07 + 0.105 * fist + (0.1 if shape == "pinch" else 0.0)
			var acc := 0.0
			for b in bones:
				var nm := sk.get_bone_name(b)
				var da := Quaternion(ka / la, minf(add + bend * (0.5 if nm.ends_with("2") else (1.0 if nm.ends_with("3") else 0.0)), room + 0.3)) if la > 1e-4 else Quaternion.IDENTITY
				acc += amt * (0.9 if nm.ends_with("1") else (1.15 if nm.ends_with("2") else 0.7)) + fist * (0.3 if nm.ends_with("2") else (0.5 if nm.ends_with("3") else 0.0))
				turn[b] = Quaternion((da * k).normalized(), acc) * da
		else:
			var base: Quaternion = fg["base"] if shape != "ball" else Quaternion.IDENTITY.slerp(fg["base"], 0.3)
			var d := (base * d0).normalized()
			var kk := d.cross(n).normalized()
			var bends := _wrap(fg, d, n, centre, r + FINGER * s) if shape != "pinch" else ([0.6, 0.8, 0.45] if fg["name"] in ["index", "middle"] else [0.95, 1.1, 0.7])
			var acc := 0.0
			var i := 0
			for b in bones:
				if sk.get_bone_name(b).ends_with("0"):
					turn[b] = Quaternion.IDENTITY
					continue
				acc += float(bends[mini(i, bends.size() - 1)])
				i += 1
				turn[b] = Quaternion(kk, acc) * base
		for b in bones:
			var p := sk.get_bone_parent(b)
			var dp: Quaternion = turn.get(p, Quaternion.IDENTITY)
			var gp := sk.get_bone_global_rest(p).basis.orthonormalized().get_rotation_quaternion()
			var gb := sk.get_bone_global_rest(b).basis.orthonormalized().get_rotation_quaternion()
			out[b] = (gp.inverse() * dp.inverse() * (turn[b] as Quaternion) * gb).normalized()
	return out


static func _first(sk: Skeleton3D, chain: Array) -> int:
	for b in chain:
		if not sk.get_bone_name(b).ends_with("0"):
			return b
	return chain[0] if not chain.is_empty() else 0


# a finger wrapped round a circle: how far each of its joints bends so each bone lies against the circle (its middle
# `centre`, its radius `rho` with the finger's own thickness in it), in the plane the finger curls in
static func _wrap(fg: Dictionary, d: Vector3, n: Vector3, centre: Vector3, rho: float) -> Array:
	var lens: Array = fg["len"]
	var c := Vector2(((centre - (fg["p1"] as Vector3)).dot(d)), ((centre - (fg["p1"] as Vector3)).dot(n)))
	var at := Vector2.ZERO
	var was := 0.0
	var out := []
	for i in lens.size():
		var to := c - at
		var dist := to.length()
		var phi := to.angle() - asin(minf(1.0, rho / maxf(dist, 1e-5)))      # the tangent that passes it on the far side, the circle on its left
		var turn := fposmod(phi - was, TAU)             # (the way round the finger curls: an angle past half a turn is a bend the other way)
		if turn > PI:
			turn -= TAU
		var bend := clampf(turn, -0.12 if i == 0 else 0.0, float(LIMITS[mini(i, 2)]))
		out.append(bend)
		was += bend
		at += Vector2(cos(was), sin(was)) * float(lens[i])
	return out


## where her mouth is, in the world (between the lips): from the teeth's bone, else from the head's
func mouth() -> Vector3:
	var sk := get_skeleton()
	if sk == null:
		return Vector3.INF
	var h := HSHeadTrack._find(sk, HSHeadTrack.HEAD)
	if h < 0:
		return Vector3.INF
	var hp := sk.get_bone_global_pose(h)
	var carried := hp.basis.orthonormalized() * sk.get_bone_global_rest(h).basis.orthonormalized().inverse()     # her own axes as her head carries them
	var size := 1.0
	var kids := sk.get_bone_children(h)
	for kd in kids:
		if sk.get_bone_name(kd).ends_with("_null"):
			size = sk.get_bone_global_rest(kd).origin.distance_to(sk.get_bone_global_rest(h).origin) / 0.187
	var t := HSHeadTrack._find(sk, MOUTH)
	if t >= 0 and sk.get_bone_name(t) == "c_teeth":
		return sk.global_transform * (sk.get_bone_global_pose(t).origin + carried * Vector3(0, 0.003, 0.045) * size)
	return sk.global_transform * (hp.origin + carried * Vector3(0, 0.017, 0.086) * size)


# ---- each frame, after her animation ---------------------------------------------------------------------------------------
func _process_modification_with_delta(delta: float) -> void:
	var sk := get_skeleton()
	if sk == null:
		return
	if _ready_for != sk:
		_setup(sk)
	var world := sk.global_transform
	var inv := world.affine_inverse()
	for side in brings.keys():
		var b: Dictionary = brings[side]
		var h: Dictionary = hands.get(side, {})
		var w: float = b["w"]
		if h.is_empty() or w <= 0.0005:
			last.erase(side)
			continue
		var tw := _target_of(b)
		if tw == Vector3.INF and b["offset"] == Vector3.INF:
			continue
		var tgt := inv * tw if tw != Vector3.INF else Vector3.ZERO
		var hp := sk.get_bone_global_pose(h["hand"])
		var hb := hp.basis
		var wrist := hp.origin
		var pt: Vector3 = hp * (b["point"] as Vector3)
		var turned := 0.0
		if b["aim"] and tw != Vector3.INF:              # the hand turned about what it holds so the point leads at the target
			var o: Vector3 = hp * (b["anchor"] as Vector3)
			var v := pt - o
			var u := tgt - o
			if v.length() > 0.004 and u.length() > 0.004:
				var q := Quaternion.IDENTITY.slerp(Quaternion(v.normalized(), u.normalized()), w * w)   # (late: turned in step with the rise, a swung bat pointed at who it was for a tenth of a second before it got there)
				hb = Basis(q) * hb
				wrist = o + q * (wrist - o)
				pt = o + q * v
				turned = q.get_angle()
		var need := tgt - pt                              # how far the point has to go, in her own space
		if b["freeze"]:
			if b["offset"] != Vector3.INF:
				need = b["offset"]
			elif b["timed"] and float(b["t"]) >= float(b["peak"]):
				b["offset"] = need
		var move: Vector3 = need * w
		var most: float = b["most"]
		if move.length() > most:
			move = move.normalized() * most
		_solve(sk, h, wrist + move, hb)
		var done := sk.get_bone_global_pose(h["hand"]) * (b["point"] as Vector3)
		# (`moved`, `turned`: how far the clip's hand was carried and turned to get there. A correction that does most of the work is a clip that's wrong: the checks hold these too)
		last[side] = {"point": world * done, "target": tw, "error": (world * done).distance_to(tw) if tw != Vector3.INF else 0.0, "weight": w, "moved": move.length(), "turned": turned}
	for side in grips.keys():
		var g: Dictionary = grips[side]
		g["w"] = move_toward(float(g["w"]), float(g["goal"]), delta / float(g["secs"]))
		var gw: float = g["w"]
		if gw <= 0.0:
			if float(g["goal"]) <= 0.0:
				grips.erase(side)
			continue
		var k := smoothstep(0.0, 1.0, gw)
		var pose: Dictionary = g["pose"]
		for bone in pose:
			sk.set_bone_pose_rotation(bone, sk.get_bone_pose_rotation(bone).slerp(pose[bone], k))


func _target_of(b: Dictionary) -> Vector3:
	var t = b["target"]
	var p := Vector3.INF
	if t is Vector3:
		p = t
	elif t is Callable:
		var got = (t as Callable).call()
		if got is Vector3:
			p = got
	elif t is Node3D and is_instance_valid(t):
		p = HSHeadTrack.point_of(t)
	return p


# the arm's two bones solved for the wrist at `goal` (her own space), the elbow on the side it was; the hand turned `hb`
func _solve(sk: Skeleton3D, h: Dictionary, goal: Vector3, hb: Basis) -> void:
	var up: int = h["up"]
	var low: int = h["low"]
	var hand: int = h["hand"]
	var S := sk.get_bone_global_pose(up).origin
	var E := sk.get_bone_global_pose(low).origin
	var W := sk.get_bone_global_pose(hand).origin
	var a := S.distance_to(E)
	var c := E.distance_to(W)
	var to := goal - S
	var d := clampf(to.length(), absf(a - c) + 0.001, (a + c) * 0.999)
	var u := to.normalized()
	# the elbow's side: where it is now off the line from the shoulder to the wrist, carried over to the new line
	var line := (W - S).normalized()
	var off := (E - S) - line * (E - S).dot(line)
	if off.length() < 1e-4:
		off = Vector3.DOWN - line * Vector3.DOWN.dot(line)
	off = Quaternion(line, u) * off if line.dot(u) > -0.999 else off
	var side := (off - u * off.dot(u)).normalized()
	var ca := clampf((a * a + d * d - c * c) / (2.0 * a * d), -1.0, 1.0)
	var e2 := S + u * (a * ca) + side * (a * sqrt(maxf(0.0, 1.0 - ca * ca)))
	var g := sk.get_bone_global_pose(up)
	sk.set_bone_global_pose(up, Transform3D(Basis(Quaternion((E - S).normalized(), (e2 - S).normalized())) * g.basis, g.origin))
	var gl := sk.get_bone_global_pose(low)
	var w_now := sk.get_bone_global_pose(hand).origin
	sk.set_bone_global_pose(low, Transform3D(Basis(Quaternion((w_now - gl.origin).normalized(), (S + u * d - gl.origin).normalized())) * gl.basis, gl.origin))
	var gh := sk.get_bone_global_pose(hand)
	sk.set_bone_global_pose(hand, Transform3D(hb, gh.origin))


## what it's doing (a check's)
func report() -> Dictionary:
	var out := {"hands": hands.keys(), "grips": {}, "brings": {}, "last": last}
	for s in grips:
		out["grips"][s] = {"size": grips[s]["size"], "shape": grips[s]["shape"], "w": grips[s]["w"]}
	for s in brings:
		out["brings"][s] = {"w": brings[s]["w"], "t": brings[s]["t"], "aim": brings[s]["aim"]}
	return out
