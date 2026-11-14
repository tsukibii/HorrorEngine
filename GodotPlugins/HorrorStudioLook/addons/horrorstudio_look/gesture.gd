## Small movements laid over whatever she's doing, and a thing carried in any pose (docs/ANIMATOR_V3.md §11, §12,
## docs/GODOT_LOOK.md §5z; DECISIONS 2026-11-14, later: "'add life' animations ... looking at an object they are
## holding, scratching, little life flourish stuff ... as ik blendables meaning if the lower body and chest is in a
## position e.g. walking or sitting, we can still blend in these animations ... use ik to allow them to hold objects
## in any of the current animation positions").
##
## A SkeletonModifier3D, the first under her skeleton. Her clip is played as it was made; after it, each frame:
##   a flourish   one of her `life_` clips (the Animator bakes them: a scratch, a look at what she holds, a stretch)
##                laid over the pose she's in. Its arm, from the collarbone to the fingertips, takes the clip's own
##                turns, faded in as the hand leaves where it was and out as it comes back; her spine, neck and head
##                take only how far the clip has turned them from where it started, added to what they're doing; her
##                pelvis and her legs are never touched. Where the clip's hand touches her (her head, her neck, her
##                other arm, her side), the same point of the hand is kept where the clip has it on that bone as that
##                bone is now (HSHandIK brings it there): a hand scratches a head that's turned to follow you.
##                The rule is tools/animator/core/layer.js, line for line: the Animator's page shows what this does.
##   a carry      the arm that holds a thing kept in one of her `carry_` poses (at her side, in front of her, to her
##                chest, over her shoulder, raised) over whatever clip plays; hung by gravity however her chest
##                leans; a thing that should stay the way up it stands turned so.
##     var g := HSGesture.attach($Her)
##     g.alive = true                      # now and then, one that suits what she's doing, with a hand that's free
##     g.play("scratch_head")              # one now ("life_" or not; {"left": true}: her other hand's)
##     g.carry("r", "front", {"thing": $Cup, "upright": true})      # carry_off("r") lets go
## Nothing of it is kept in her pose: with nothing playing and nothing carried she is exactly her clip.
class_name HSGesture
extends SkeletonModifier3D

signal started(name: String)                        ## a flourish began (its clip's name)
signal finished(name: String)                       ## and ended

const SIDES := ["l", "r"]
const CLAV := {"l": ["l_clavicle", "LeftShoulder", "mixamorig_LeftShoulder", "mixamorig:LeftShoulder", "clavicle_l"], "r": ["r_clavicle", "RightShoulder", "mixamorig_RightShoulder", "mixamorig:RightShoulder", "clavicle_r"]}
const SPINE := ["c_spine0", "c_spine1", "c_spine2", "c_spine3", "Spine", "Spine1", "Spine2", "Chest", "UpperChest", "mixamorig_Spine", "mixamorig_Spine1", "mixamorig_Spine2", "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2", "spine_01", "spine_02", "spine_03"]
const DOING := {"idle_loop": "stand", "idle": "stand", "walk_loop": "walk", "walk": "walk", "sit_loop": "sit", "sit": "sit"}   # what she's doing, by the loop that's playing (anything else: an act has her)
const CARRIES := ["side", "front", "chest", "shoulder", "raised"]

@export var alive := false:                         ## now and then she does one that suits what she's doing
	set(v):
		alive = v
		_wait = randf_range(0.4, 1.0) * every.x
@export var every := Vector2(6.0, 14.0)            ## seconds between them, from and to
@export var only: PackedStringArray = []           ## only these (names without "life_"); empty: any she has
@export_range(0.0, 1.0) var amount := 1.0          ## how much of a flourish is taken: 1 all of it
@export var doing := ""                             ## what she's doing, said by whoever moves her: "stand", "walk", "sit", "busy" (an act has her); "": worked out from the loop that's playing

var record := {}                                    ## the Animator's record of her clips
var now := ""                                       ## the flourish that's playing (its clip's name); "": none
var t := 0.0                                        ## seconds into it
var weight := 0.0                                   ## how much of its arm is on, 0..1
var carries := {}                                   ## side -> {how, shown, clip, from, mix, w, goal, secs, hold, hold_goal, hold_secs, thing, upright}
var last := {}                                      ## what the last frame did (a check's): {touch: {bone, target, weight}, plumb: {side: degrees}, upright: {side: degrees}}
var played: Array = []                              ## the flourishes done, in order (a check's)

var _ap: AnimationPlayer
var _clips := {}                                    # name -> {anim, rot: {bone: track}, pos: {bone: track}, secs, first: {bone: Quaternion}}
var _arm := {}                                      # side -> bones from the collarbone down to the fingertips
var _add: Array = []                                # her spine, her neck, her head
var _clav := {}
var _chest := -1
var _life := {}                                     # the flourish that's playing: {clip, meta, sides, bone, point, side, speed, fade, fading, fade_secs}
var _wait := 4.0
var _last_pick := ""
var _ready_for: Skeleton3D
var _top: Node                                      # whatever she is: the scene her skeleton, her meshes and her animations are under
var _ik: HSHandIK
var _track: HSHeadTrack


## one under `character`'s skeleton, before her other modifiers: the one already there, or a new one (null when she has no skeleton)
static func attach(character: Node, settings: Dictionary = {}) -> HSGesture:
	var g := of(character)
	if g == null:
		var sk := HSHeadTrack._skeleton(character)
		if sk == null:
			return null
		g = HSGesture.new()
		g.name = "HSGesture"
		sk.add_child(g)
		for n in sk.get_children():                        # first: what follows (her head's follower, her hands' IK, her soft tissue) works on the pose this leaves
			if n is SkeletonModifier3D and n != g:
				sk.move_child(g, n.get_index())
				break
	for k in settings:
		g.set(k, settings[k])
	return g


static func of(character: Node) -> HSGesture:
	if character == null:
		return null
	if character is HSGesture:
		return character
	for n in character.find_children("*", "SkeletonModifier3D", true, false):
		if n is HSGesture:
			return n
	return null


# ---- what's asked of it ---------------------------------------------------------------------------------------------------
## one flourish now. name: "scratch_head" or "life_scratch_head"; o: {left: her other hand's, speed, force: whatever
## she's doing}. False when she hasn't got it, a hand it needs is busy, or it isn't made to be laid over what she's doing.
func play(name: String, o: Dictionary = {}) -> bool:
	_ensure()
	var n := name if name.begins_with("life_") else "life_" + name
	if bool(o.get("left", false)) and not n.ends_with("_l"):
		n += "_l"
	var meta := life_of(n)
	if meta.is_empty():
		return false
	var hand := String(meta.get("hand", ""))
	if hand in SIDES and not _free(hand, bool(meta.get("free", true))):       # that hand's busy: her other hand's, when she has it
		var other := n.trim_suffix("_l") if n.ends_with("_l") else n + "_l"
		var m2 := life_of(other)
		if m2.is_empty() or not _free(String(m2.get("hand", "")), bool(m2.get("free", true))):
			return false
		n = other
		meta = m2
		hand = String(meta.get("hand", ""))
	elif hand == "both" and not (_free("l", true) and _free("r", true)):
		return false
	if not bool(o.get("force", false)):
		var d := what_doing()
		if d == "" or not (d in (meta.get("over", []) as Array)):
			return false
	var c := _clip(n)
	if c.is_empty():
		return false
	if now != "":
		_end()
	var sides: Array = ["l", "r"] if hand == "both" else ([hand] if hand in SIDES else [])
	_life = {"clip": c, "meta": meta, "sides": sides, "speed": float(o.get("speed", 1.0)), "fade": 1.0, "fading": false, "fade_secs": 0.2, "bone": -1, "point": Vector3.ZERO, "side": hand}
	var touch: Dictionary = meta.get("touch", {})
	if not touch.is_empty() and hand in SIDES:
		var bn := String(touch.get("bone", ""))
		if touch.has("side"):
			bn = "%s_%s" % [touch["side"], bn]
		var p: Array = touch.get("point", [0, 0, 0])
		_life["bone"] = get_skeleton().find_bone(bn)
		_life["point"] = Vector3(p[0], p[1], p[2])
	now = n
	t = 0.0
	_last_pick = n.trim_suffix("_l")
	played.append(n)
	started.emit(n)
	return true


## the flourish that's playing let go of, over `secs`
func stop(secs := 0.2) -> void:
	if now != "":
		_life["fading"] = true
		_life["fade_secs"] = maxf(0.01, secs)


## her arm kept in a carry pose from now on. how: "side", "front", "chest", "shoulder", "raised"; o: {thing: what's
## in that hand (for `upright`), upright: it's kept the way up it stands, secs: how long the arm takes to get there}
func carry(side: String, how := "side", o: Dictionary = {}) -> bool:
	_ensure()
	if not (side in SIDES) or not (how in CARRIES):
		return false
	var c := _carry_clip(side, how)
	if c.is_empty():
		return false
	var had: Dictionary = carries.get(side, {})
	var k := {"how": how, "shown": how, "clip": c, "from": {}, "mix": 1.0, "w": float(had.get("w", 0.0)), "goal": 1.0, "secs": maxf(0.01, float(o.get("secs", 0.35))),
		"hold": float(had.get("hold", 1.0)), "hold_goal": float(had.get("hold_goal", 1.0)), "hold_secs": 0.3, "thing": o.get("thing", had.get("thing")), "upright": bool(o.get("upright", had.get("upright", false)))}
	if not had.is_empty() and String(had["shown"]) != how:      # from the pose she was carrying it in
		k["from"] = had["clip"]
		k["mix"] = 0.0
	carries[side] = k
	return true


## her arm given back to her animation, over `secs`
func carry_off(side: String, secs := 0.3) -> void:
	if carries.has(side):
		carries[side]["goal"] = 0.0
		carries[side]["secs"] = maxf(0.01, secs)


## an act takes that hand for a while (eating, a blow, a door): the carry lets go of the arm over `secs`, and takes it back
func carry_pause(side: String, on := true, secs := 0.3) -> void:
	if carries.has(side):
		carries[side]["hold_goal"] = 0.0 if on else 1.0
		carries[side]["hold_secs"] = maxf(0.01, secs)


## how that hand's thing is carried ("": it isn't)
func carrying(side: String) -> String:
	return String(carries[side]["how"]) if carries.has(side) and float(carries[side]["goal"]) > 0.0 else ""


## a flourish's record (`life`), or {} when she hasn't got it
func life_of(clip: String) -> Dictionary:
	_ensure()
	var c: Dictionary = (record.get("clips", {}) as Dictionary).get(clip, {})
	var m = c.get("life", {})
	return m if m is Dictionary else {}


## the flourishes she has (their clips' names)
func flourishes() -> Array:
	_ensure()
	var out := []
	for n in (record.get("clips", {}) as Dictionary):
		if String(n).begins_with("life_"):
			out.append(n)
	return out


## what she's doing: "stand", "walk", "sit", or "" when an act has her
func what_doing() -> String:
	if doing != "":
		return "" if doing == "busy" else doing
	if _ap == null or not _ap.is_playing():
		return ""
	return String(DOING.get(String(_ap.current_animation).get_slice("/", String(_ap.current_animation).get_slice_count("/") - 1), ""))


# ---- her bones and her clips ----------------------------------------------------------------------------------------------------
func _skeleton_changed(_old: Skeleton3D, _new: Skeleton3D) -> void:
	_ready_for = null


func _ensure() -> void:
	var sk := get_skeleton()
	if sk != null and _ready_for != sk:
		_setup(sk)


func _setup(sk: Skeleton3D) -> void:
	_ready_for = sk
	_clips = {}
	_arm = {}
	_clav = {}
	_add = []
	for side in SIDES:
		var c := HSHeadTrack._find(sk, CLAV[side])
		_clav[side] = c
		var list := []
		if c >= 0:
			list.append(c)
			var i := 0
			while i < list.size():
				for kid in sk.get_bone_children(list[i]):
					var nm := sk.get_bone_name(kid)
					if not nm.begins_with("soft_") and not nm.begins_with("jiggle_"):
						list.append(kid)
				i += 1
		_arm[side] = list
	for nm in SPINE:
		var b := sk.find_bone(nm)
		if b >= 0 and not (b in _add):
			_add.append(b)
	for names in [HSHeadTrack.NECK, HSHeadTrack.HEAD]:
		var b := HSHeadTrack._find(sk, names)
		if b >= 0:
			_add.append(b)
	_chest = HSHeadTrack._find(sk, HSHeadTrack.CHEST)
	# her clips' record, and what plays them: under whatever she is (the skeleton's own scene)
	record = {}
	_ap = null
	var top: Node = sk
	for i in 4:
		if top.get_parent() == null or top.get_parent().find_children("*", "Skeleton3D", true, false).size() > 1:   # (no further up than she goes: past her are other characters' clips)
			break
		top = top.get_parent()
		var found := false
		for mi in top.find_children("*", "MeshInstance3D", true, false):
			if mi.has_meta("extras"):
				var ex = mi.get_meta("extras")
				if ex is Dictionary and ex.get("hsMotion") is Dictionary:
					record = ex["hsMotion"]
					found = true
					break
		var aps := top.find_children("*", "AnimationPlayer", true, false)
		if not aps.is_empty() and _ap == null:
			_ap = aps[0]
		if found and _ap != null:
			break
	_top = top


# her hands' IK and her head's follower: whichever is under her now (either may be put there after this was)
func _hands() -> HSHandIK:
	if not is_instance_valid(_ik):
		_ik = HSHandIK.of(_top) if is_instance_valid(_top) else null
	return _ik


func _follower() -> HSHeadTrack:
	if not is_instance_valid(_track):
		_track = HSHeadTrack.of(_top) if is_instance_valid(_top) else null
	return _track


# a clip of hers by its name, read for laying: which track turns which bone, and each bone's turn at its start
func _clip(n: String) -> Dictionary:
	if _clips.has(n):
		return _clips[n]
	var sk := get_skeleton()
	var anim: Animation = null
	var players: Array = [_ap] if _ap != null else []
	if is_instance_valid(_top):                               # (whichever of her players has it: something else's player may come first under her)
		for p in _top.find_children("*", "AnimationPlayer", true, false):
			if not (p in players):
				players.append(p)
	for p in players:
		var ap := p as AnimationPlayer
		if ap.has_animation(n):
			anim = ap.get_animation(n)
		else:
			for lib in ap.get_animation_library_list():
				var l := ap.get_animation_library(lib)
				if l != null and l.has_animation(n):
					anim = l.get_animation(n)
					break
		if anim != null:
			break
	if anim == null or sk == null:
		return {}
	var c := {"anim": anim, "rot": {}, "pos": {}, "secs": anim.length, "first": {}}
	for i in anim.get_track_count():
		var b := sk.find_bone(String(anim.track_get_path(i).get_concatenated_subnames()))
		if b < 0:
			continue
		match anim.track_get_type(i):
			Animation.TYPE_ROTATION_3D:
				c["rot"][b] = i
			Animation.TYPE_POSITION_3D:
				c["pos"][b] = i
	_clips[n] = c
	return c


func _carry_clip(side: String, how: String) -> Dictionary:
	return _clip("carry_%s%s" % [how, "_l" if side == "l" else ""])


# a bone's own turn in a clip at a time (one the clip doesn't move: as it rests)
func _rot(c: Dictionary, bone: int, at: float) -> Quaternion:
	if (c["rot"] as Dictionary).has(bone):
		return (c["anim"] as Animation).rotation_track_interpolate(int(c["rot"][bone]), at)
	return get_skeleton().get_bone_rest(bone).basis.get_rotation_quaternion()


func _first(c: Dictionary, bone: int) -> Quaternion:
	var f: Dictionary = c["first"]
	if not f.has(bone):
		f[bone] = _rot(c, bone, 0.0)
	return f[bone]


# where a bone is in a clip's own pose at a time, in her own space: its turns and places down from the root
func _clip_xform(c: Dictionary, bone: int, at: float) -> Transform3D:
	var sk := get_skeleton()
	var chain := []
	var b := bone
	while b >= 0:
		chain.push_front(b)
		b = sk.get_bone_parent(b)
	var x := Transform3D.IDENTITY
	for j in chain:
		var rest := sk.get_bone_rest(j)
		var o: Vector3 = (c["anim"] as Animation).position_track_interpolate(int(c["pos"][j]), at) if (c["pos"] as Dictionary).has(j) else rest.origin
		x = x * Transform3D(Basis(_rot(c, j, at)), o)
	return x


# is that hand free for a flourish (`must`: it has to hold nothing; else it only mustn't be in the middle of something)
func _free(side: String, must: bool) -> bool:
	if not (side in SIDES):
		return true
	var ik := _hands()
	if ik != null:
		if ik.bringing(side) and not (now != "" and String(_life.get("side", "")) == side):
			return false
		if must and ik.gripping(side) > 0.3:
			return false
	if must and carrying(side) != "":
		return false
	return true


# ---- each frame, after her animation ---------------------------------------------------------------------------------------
func _process_modification_with_delta(delta: float) -> void:
	var sk := get_skeleton()
	if sk == null:
		return
	if _ready_for != sk:
		_setup(sk)
	last = {}
	_carry(sk, delta)
	_flourish(sk, delta)
	if alive and now == "":
		_wait -= delta
		if _wait <= 0.0:
			var n := pick()
			_wait = randf_range(every.x, every.y) if n != "" and play(n) else 1.0


## one she could do now: suits what she's doing, its hand free, not the one she did last; by their weights ("": none)
func pick() -> String:
	_ensure()
	var d := what_doing()
	if d == "":
		return ""
	var names := []
	var weights := []
	var total := 0.0
	for n in flourishes():
		var m := life_of(n)
		var bare := String(n).trim_prefix("life_").trim_suffix("_l")
		if not (d in (m.get("over", []) as Array)) or String(n).trim_suffix("_l") == _last_pick or (not only.is_empty() and not (bare in only)):
			continue
		var hand := String(m.get("hand", ""))
		var must := bool(m.get("free", true))
		if (hand in SIDES and not _free(hand, must)) or (hand == "both" and not (_free("l", true) and _free("r", true))):
			continue
		var w := float(m.get("weight", 1.0))
		if hand in SIDES and not must and carrying(hand) != "":      # made for a thing in that hand, and she's carrying one: sooner than the others
			w *= 2.5
		names.append(n)
		weights.append(w)
		total += w
	if names.is_empty():
		return ""
	var r := randf() * total
	for i in names.size():
		r -= float(weights[i])
		if r <= 0.0:
			return names[i]
	return names[names.size() - 1]


func _flourish(sk: Skeleton3D, delta: float) -> void:
	if now == "":
		weight = 0.0
		return
	var L := _life
	var c: Dictionary = L["clip"]
	var meta: Dictionary = L["meta"]
	var secs := float(c["secs"])
	t += delta * float(L["speed"])
	if bool(L["fading"]):
		L["fade"] = move_toward(float(L["fade"]), 0.0, delta / float(L["fade_secs"]))
	if t >= secs or float(L["fade"]) <= 0.0:
		_end()
		return
	var k := amount * float(L["fade"])
	var w := smoothstep(0.0, maxf(0.01, float(meta.get("in", 0.3))), t) * (1.0 - smoothstep(secs - maxf(0.01, float(meta.get("out", 0.3))), secs, t))
	weight = w * k
	var sides: Array = L["sides"]
	for side in sides:
		for b in _arm[side]:
			sk.set_bone_pose_rotation(b, sk.get_bone_pose_rotation(b).slerp(_rot(c, b, t), weight))
	var add := _add.duplicate()
	for side in SIDES:
		if not (side in sides) and int(_clav[side]) >= 0:
			add.append(_clav[side])
	for b in add:
		var d := (_first(c, b).inverse() * _rot(c, b, t)).normalized()
		if k < 1.0:
			d = Quaternion.IDENTITY.slerp(d, k)
		sk.set_bone_pose_rotation(b, (sk.get_bone_pose_rotation(b) * d).normalized())
	# a look: her head's follower waits while she looks at something of her own
	if String(meta.get("head", "")) == "look" and _follower() != null:
		_track.hold_off = weight
	# a hand that touches her: the same point of it kept where the clip has it on that bone, as that bone is now
	var bone := int(L["bone"])
	var side := String(L["side"])
	var touch: Dictionary = meta.get("touch", {})
	if bone >= 0 and not touch.is_empty() and _hands() != null:
		var wt := smoothstep(float(touch["from"]) - 0.3, float(touch["from"]), t) * (1.0 - smoothstep(float(touch["to"]), float(touch["to"]) + 0.3, t)) * k
		if wt > 0.0005:
			var rel: Vector3 = _clip_xform(c, bone, t).affine_inverse() * (_clip_xform(c, _ik.hand_bone(side), t) * (L["point"] as Vector3))
			L["rel"] = rel
			if not _ik.bringing(side) or not bool(L.get("ours", false)):
				_ik.bring(side, {"point": L["point"], "target": Callable(self, "_touch_point"), "weight": wt, "most": 0.25})
				L["ours"] = true
			_ik.set_weight(side, wt)
			last["touch"] = {"bone": sk.get_bone_name(bone), "weight": wt, "target": _touch_point()}
		elif bool(L.get("ours", false)):
			_ik.drop(side)
			L["ours"] = false


# where the hand's point belongs now, in the world: on the bone it touches, as that bone is after everything before the hands' IK has run
func _touch_point() -> Vector3:
	var sk := get_skeleton()
	if sk == null or now == "" or int(_life.get("bone", -1)) < 0 or not _life.has("rel"):
		return Vector3.INF
	return sk.global_transform * (sk.get_bone_global_pose(int(_life["bone"])) * (_life["rel"] as Vector3))


func _end() -> void:
	var n := now
	if bool(_life.get("ours", false)) and _hands() != null:
		_ik.drop(String(_life["side"]))
	if is_instance_valid(_track):
		_track.hold_off = 0.0
	now = ""
	t = 0.0
	weight = 0.0
	_life = {}
	if n != "":
		finished.emit(n)


func _carry(sk: Skeleton3D, delta: float) -> void:
	for side in carries.keys():
		var k: Dictionary = carries[side]
		k["w"] = move_toward(float(k["w"]), float(k["goal"]), delta / float(k["secs"]))
		k["hold"] = move_toward(float(k["hold"]), float(k["hold_goal"]), delta / float(k["hold_secs"]))
		if float(k["w"]) <= 0.0 and float(k["goal"]) <= 0.0:
			carries.erase(side)
			continue
		# sat, a thing carried at her side is carried in front of her: a hand on a thigh has nowhere to put it
		var want := "front" if String(k["how"]) == "side" and what_doing() == "sit" else String(k["how"])
		if want != String(k["shown"]):
			var c2 := _carry_clip(side, want)
			if not c2.is_empty():
				k["from"] = k["clip"]
				k["clip"] = c2
				k["shown"] = want
				k["mix"] = 0.0
		k["mix"] = move_toward(float(k["mix"]), 1.0, delta / 0.4)
		var c: Dictionary = k["clip"]
		var meta: Dictionary = ((record.get("clips", {}) as Dictionary).get("carry_%s%s" % [k["shown"], "_l" if side == "l" else ""], {}) as Dictionary).get("carry", {})
		var w := smoothstep(0.0, 1.0, float(k["w"])) * smoothstep(0.0, 1.0, float(k["hold"]))
		if w <= 0.0005:
			continue
		var mix := smoothstep(0.0, 1.0, float(k["mix"]))
		var wa := w * (1.0 - float(meta.get("keep", 0.0)) * (0.0 if what_doing() == "stand" else 1.0))     # (a share of what her arm was doing is kept: a walk's swing, at her side)
		for b in _arm[side]:
			var to := _rot(c, b, 0.0)
			if mix < 1.0 and not (k["from"] as Dictionary).is_empty():
				to = _rot(k["from"], b, 0.0).slerp(to, mix)
			sk.set_bone_pose_rotation(b, sk.get_bone_pose_rotation(b).slerp(to, wa))
		var up_bone := HSHeadTrack._find(sk, HSHandIK.ARM[side][0])
		var hand := HSHeadTrack._find(sk, HSHandIK.ARM[side][2])
		# hung by gravity: her chest's lean from how the pose was made is taken back out of the arm (not its turn about her own up: the arm stays beside her)
		var plumb := float(meta.get("plumb", 0.0))
		if plumb > 0.0 and _chest >= 0 and up_bone >= 0:
			var q := (_clip_xform(c, _chest, 0.0).basis.get_rotation_quaternion() * sk.get_bone_global_pose(_chest).basis.get_rotation_quaternion().inverse()).normalized()
			var tw := Quaternion(0.0, q.y, 0.0, q.w)
			var sw := (q * tw.normalized().inverse()).normalized() if tw.length() > 1e-6 else q
			sw = Quaternion.IDENTITY.slerp(sw, plumb * w)
			var g := sk.get_bone_global_pose(up_bone)
			sk.set_bone_global_pose(up_bone, Transform3D(Basis(sw) * g.basis, g.origin))
			if not last.has("plumb"):
				last["plumb"] = {}
			last["plumb"][side] = rad_to_deg(sw.get_angle())
		# kept the way up it stands: her hand turned by what's missing (as far as a wrist turns)
		var thing = k.get("thing")
		if bool(k["upright"]) and thing is Node3D and is_instance_valid(thing) and hand >= 0:
			var gh := sk.get_bone_global_pose(hand)
			var world_up := (sk.global_transform.basis.orthonormalized().inverse() * Vector3.UP).normalized()
			var up_now := (gh.basis.orthonormalized() * (thing as Node3D).transform.basis.orthonormalized().y).normalized()
			if up_now.dot(world_up) < 0.99999:
				var qu := Quaternion(up_now, world_up)
				var ang := qu.get_angle()
				var most := deg_to_rad(65.0)
				qu = Quaternion.IDENTITY.slerp(qu, w * (minf(1.0, most / ang) if ang > 1e-5 else 1.0))
				sk.set_bone_global_pose(hand, Transform3D(Basis(qu) * gh.basis, gh.origin))
				if not last.has("upright"):
					last["upright"] = {}
				last["upright"][side] = rad_to_deg(qu.get_angle())


## what it's doing (a check's, a debug label's)
func report() -> Dictionary:
	var c := {}
	for s in carries:
		c[s] = {"how": carries[s]["how"], "shown": carries[s]["shown"], "w": carries[s]["w"], "hold": carries[s]["hold"]}
	return {"now": now, "t": t, "weight": weight, "alive": alive, "doing": what_doing(), "carries": c, "flourishes": flourishes().size(), "played": played, "last": last}
