@icon("res://addons/horrorstudio_weapons/icons/hit_react.svg")
class_name HSHitReact
extends Node3D
## A character or an enemy that reacts to being shot (the user, 2026-11-10: "a reactive system for characters/enemies
## to be shot, but dont do blood, instead create some form of demonic dark smoke and dark splatters like black blood";
## docs/research/hit_reactions.md). Put one under her (a Character Studio export, an MHR body, any skinned figure, or a
## stand-in made of meshes).
##
## - **Where she's hit**: capsules on her bones (her skeleton's, found by their names: MHR's, a mannequin's, Mixamo's),
##   on a layer of their own (HITBOX_LAYER) that the gun's pellets and a blast see and the player never bumps into; a
##   stand-in's own collider, or a capsule round her, and the part by the height. The head takes `head_x` the damage,
##   an arm or a leg `limb_x`.
## - **Her reaction**: a flinch on springs on top of her animation (HSFlinch under her skeleton): the bone hit kicked
##   away from the shot, the spine bent, the head whipped back a beat later, an arm swung, a knee giving; a stand-in
##   tilts. Each hit's damage fills a stagger counter: past `stagger` she's held where she is for `stagger_s` (whatever
##   moves her: the starter's chase, a searcher) and shoved back `push_m`; it empties when it fires.
## - **No blood**: black ichor, glossy so the flashlight catches it, embers in it (`fx/ichor_*`): a wound on her riding
##   her bone, droplets flung out, the spray on the wall or the floor behind her (running down a wall), heavy drops
##   splashing where they land; and dark smoke pouring from each wound and trailing after her (the muzzle's smoke and
##   trail, made black: `react/ichor_smoke.tres`). Its look is an HSWoundLook (`react/looks/demon.tres`).
## - **Down** at `health`: DISSOLVE (she chars over from her skin, its edge burning, smoke pouring off her, and she's
##   gone into it, a pool of ichor where she stood), VANISH (gone at once in a burst), RAGDOLL (her PhysicalBoneSimulator3D
##   let go, if she has one; else she dissolves) or NOTHING (only the signal). What hunts with her is stopped
##   (anything under her with a stop(): chase.gd, searcher.gd). `gone_secs` brings her back whole.

signal hit(info: Dictionary)                      ## a shot that hit her: {part, parts, bone, damage, health, point, dir, power, staggered, blast}
signal staggered(secs: float)
signal down

enum Down { DISSOLVE, VANISH, RAGDOLL, NOTHING }

const DIR := "res://addons/horrorstudio_weapons/"
const HITBOX_LAYER := 1 << 10                     ## collision layer 11: her hitboxes (HSGun.SHOT_MASK sees it; the player doesn't)
const SMOKE_LATE := 0.24                          # the smoke starts once a shove has settled (_hold's 0.22 s)
const SKIP := ["twist", "proc", "null", "_end", "roll", "ik_", "pole", "nub", "tip", "pinky", "ring", "middle", "index",
	"thumb", "jaw", "teeth", "tongue", "eye", "toe", "finger", "breast", "twk", "ctrl"]

@export var health := 12.0                        ## damage until she's down (a buckshot pellet's 1, a blast up to 6)
@export var head_x := 2.0                         ## the head's damage times this
@export var limb_x := 0.6                         ## an arm's or a leg's
@export var stagger := 4.0                        ## damage that staggers her (it builds over hits and empties when she staggers)
@export var stagger_s := 0.9                      ## held where she is this long
@export var push_m := 0.35                        ## shoved back this far by a close shot's stagger (a blast's more; a flinch: a fifth of it)
@export var flinch := 1.0                         ## how hard she flinches (0: never)
@export var down_mode := Down.DISSOLVE
@export var gone_secs := 0.0                      ## down, back whole after this long (0: never; a demon stays gone)
@export var look: HSWoundLook                     ## how she bleeds (none: react/looks/demon.tres)
@export var hitboxes := true                      ## capsules on her bones (none: her own colliders, or a capsule round her)
@export var target: Node                          ## its fire() when she's down (a scare, a cue)
@export var cry: AudioStream                      ## a sound of hers when she's hit (the wound's own plays anyway)

var damage := 0.0                                 ## taken so far
var is_down := false
var hit_count := 0                                ## shots that hit her
var wounds := 0                                   ## wounds she's been given
var marks: Array = []                             ## the ichor she's left on the world (Decals), oldest first
var last := {}                                    ## the last hit, a check's (as `hit` gives it)

var _lk: HSWoundLook
var _sk: Skeleton3D
var _flinch: HSFlinch
var _roles := {}                                  # role -> bone (head, neck, pelvis, spine: Array, uparm_l...)
var _fwd := Vector3.BACK                          # where she faces (the skeleton's space)
var _boxes: Array = []
var _attach := {}
var _guns: Array = []
var _t := 0.0
var _acc := 0.0
var _hold_until := -1.0
var _hold_at := Vector3.INF
var _hold_basis := Basis()
var _knock := Vector3.ZERO
var _knock_t0 := 0.0
var _drops: Array = []
var _smoke: Array = []                            # {m: HSMuzzle, bone, local: Transform3D, until, kind: wound or going}
var _stand: Array = []                            # a stand-in's parts as they rest, while it tilts
var _tilt := {}
var _solid: Array = []
var _root: Node3D                                 # the ichor and smoke she leaves (outside her: they stay when she's gone)
var _drop_mesh: Mesh
var _char: ShaderMaterial
var _crumble: ShaderMaterial
var _gone_at := -1.0
var _pending_smoke := 0                           # wound smoke waiting for the shove to settle
var _clock := 0.0                                 # the game's seconds (its frames' own: a fixed rate's check, a slow-motion)


func _ready() -> void:
	if Engine.is_editor_hint():
		return
	add_to_group("hs_shootable")                  # (a blast reaching her counts her as hit: HSImpacts)
	add_to_group("hs_hitreact")
	process_priority = 100                        # after what moves her: a stagger holds her where she is
	process_physics_priority = 100
	_lk = look if look != null else (load(DIR + "react/looks/demon.tres") as HSWoundLook)
	if _lk == null:
		_lk = HSWoundLook.new()
	_listen()
	_setup.call_deferred()


func _her() -> Node3D:
	return get_parent() as Node3D


func _now() -> float:
	return _clock


## What she is, a check's: her health, the damage, her hitboxes, her roles' bones, staggered, down.
func report() -> Dictionary:
	return {"health": health, "damage": damage, "down": is_down, "hits": hit_count, "wounds": wounds, "boxes": _boxes.size(),
		"skeleton": _sk != null, "roles": _roles.keys(), "holding": _now() < _hold_until, "marks": marks.size(),
		"smoking": _smoke.size(), "flinching": _flinch != null and _flinch.busy()}


# ---- set up: her bones, her hitboxes ---------------------------------------------------------------------------------

func _setup() -> void:
	var her := _her()
	if her == null:
		push_warning("HSHitReact: put it under the character (a Node3D).")
		return
	var sks := her.find_children("*", "Skeleton3D", true, false)
	_sk = sks[0] as Skeleton3D if not sks.is_empty() else null
	_root = Node3D.new()
	_root.name = "%s_ichor" % her.name
	var scene: Node = get_tree().current_scene if get_tree().current_scene != null else get_tree().root
	scene.add_child(_root)
	_root.global_transform = Transform3D.IDENTITY
	if _sk != null:
		_roles = _find_roles(_sk)
		_fwd = _facing()
		_flinch = HSFlinch.new()
		_flinch.name = "HSFlinch"
		_sk.add_child(_flinch)
		if hitboxes:
			_make_hitboxes()
	var own := false
	for n in [her] + her.find_children("*", "CollisionObject3D", true, false):
		if n is CollisionObject3D and not _boxes.has(n):
			own = true
			if not (n as Node).has_meta("hs_surface"):
				(n as Node).set_meta("hs_surface", "ichor")     # (the pellets leave no crater on her: the ichor is hers)
	if _boxes.is_empty() and not own:
		_box_round(her)


# her bones by what they are, from their names
func _find_roles(sk: Skeleton3D) -> Dictionary:
	var r := {"spine": []}
	for i in sk.get_bone_count():
		var nm := sk.get_bone_name(i).to_lower()
		var skip := false
		for w in SKIP:
			if nm.contains(w):
				skip = true
				break
		if skip:
			continue
		var side := _side(nm)
		if nm.contains("head"):
			if not r.has("head"):
				r["head"] = i
		elif nm.contains("neck"):
			if not r.has("neck"):
				r["neck"] = i
		elif nm.contains("spine") or nm.contains("chest") or nm.contains("torso"):
			(r["spine"] as Array).append(i)
		elif nm.contains("pelvis") or nm.contains("hips") or nm == "root" or nm.ends_with("_root") or nm.ends_with(":hips"):
			if not r.has("pelvis"):
				r["pelvis"] = i
		elif side != "":
			var role := ""
			if nm.contains("clavicle") or nm.contains("shoulder"):
				role = "clav"
			elif nm.contains("uparm") or nm.contains("upperarm") or nm.contains("upper_arm") or (nm.contains("arm") and not nm.contains("fore") and not nm.contains("low")):
				role = "uparm"
			elif nm.contains("lowarm") or nm.contains("forearm") or nm.contains("lowerarm") or nm.contains("lower_arm"):
				role = "lowarm"
			elif nm.contains("wrist") or nm.contains("hand"):
				role = "hand"
			elif nm.contains("upleg") or nm.contains("thigh") or nm.contains("upperleg") or nm.contains("upper_leg"):
				role = "upleg"
			elif nm.contains("lowleg") or nm.contains("calf") or nm.contains("shin") or nm.contains("lowerleg") or nm.contains("knee") or (nm.contains("leg") and not nm.contains("up")):
				role = "lowleg"
			elif nm.contains("foot") or nm.contains("ankle"):
				role = "foot"
			elif nm.contains("ball"):
				role = "ball"
			if role != "" and not r.has(role + "_" + side):
				r[role + "_" + side] = i
	# the spine root to neck, in order down the hierarchy
	(r["spine"] as Array).sort_custom(func(a: int, b: int) -> bool: return _depth(sk, a) < _depth(sk, b))
	return r


func _side(nm: String) -> String:
	if nm.begins_with("l_") or nm.begins_with("left") or nm.ends_with("_l") or nm.ends_with(".l") or nm.contains("left"):
		return "l"
	if nm.begins_with("r_") or nm.begins_with("right") or nm.ends_with("_r") or nm.ends_with(".r") or nm.contains("right"):
		return "r"
	return ""


func _depth(sk: Skeleton3D, b: int) -> int:
	var d := 0
	var p := sk.get_bone_parent(b)
	while p >= 0:
		d += 1
		p = sk.get_bone_parent(p)
	return d


func _bpos(b: int) -> Vector3:
	return _sk.global_transform * _sk.get_bone_global_pose(b).origin


# where she faces in the world: her eyes ahead of her head, else her feet's balls ahead of her ankles
func _facing() -> Vector3:
	var f := Vector3.ZERO
	for nm in ["l_eye", "r_eye", "lefteye", "righteye", "eye_l", "eye_r"]:
		var b := _sk.find_bone(nm)
		if b >= 0 and _roles.has("head"):
			f += _bpos(b) - _bpos(_roles["head"])
	if f.length() < 1e-4:
		for s in ["l", "r"]:
			if _roles.has("ball_" + s) and _roles.has("foot_" + s):
				f += _bpos(_roles["ball_" + s]) - _bpos(_roles["foot_" + s])
	f.y = 0.0
	return f.normalized() if f.length() > 1e-4 else -_sk.global_basis.z


# capsules along her bones on HITBOX_LAYER, each riding its bone (a BoneAttachment3D): the head, the neck, the spine
# piece by piece, the arms and the legs in two pieces and a hand and a foot
func _make_hitboxes() -> void:
	var segs: Array = []                          # [from bone, to (world), radius, part]
	var R := _roles
	if R.has("head"):
		var top := _bpos(R["head"]) + Vector3.UP * 0.2
		var hn := _sk.find_bone(_sk.get_bone_name(R["head"]) + "_null")
		if hn >= 0:
			top = _bpos(hn)
		elif R.has("neck"):
			top = _bpos(R["head"]) + (_bpos(R["head"]) - _bpos(R["neck"])).normalized() * 0.2
		segs.append([R["head"], top, 0.1, "head"])
	if R.has("neck") and R.has("head"):
		segs.append([R["neck"], _bpos(R["head"]), 0.055, "head"])
	var chain: Array = []
	if R.has("pelvis"):
		chain.append(R["pelvis"])
	chain.append_array(R["spine"])
	if R.has("neck"):
		chain.append(R["neck"])
	for i in chain.size() - 1:
		var a: int = chain[i]
		var b: int = chain[i + 1]
		if _bpos(a).distance_to(_bpos(b)) > 0.04:
			segs.append([a, _bpos(b), 0.14 if i >= chain.size() - 3 else 0.13, "torso"])
	if R.has("pelvis") and not (R["spine"] as Array).is_empty() and _bpos(R["pelvis"]).distance_to(_bpos(R["spine"][0])) <= 0.04:
		segs.append([R["pelvis"], _bpos(R["pelvis"]) + Vector3.DOWN * 0.12, 0.14, "torso"])
	for s in ["l", "r"]:
		for spec in [["uparm", "lowarm", 0.05, "arm"], ["lowarm", "hand", 0.042, "arm"], ["upleg", "lowleg", 0.075, "leg"], ["lowleg", "foot", 0.055, "leg"]]:
			var a_role: String = spec[0] + "_" + s
			var b_role: String = spec[1] + "_" + s
			if R.has(a_role) and R.has(b_role):
				segs.append([R[a_role], _bpos(R[b_role]), spec[2], spec[3]])
		if R.has("hand_" + s) and R.has("lowarm_" + s):
			var hd := (_bpos(R["hand_" + s]) - _bpos(R["lowarm_" + s])).normalized()
			segs.append([R["hand_" + s], _bpos(R["hand_" + s]) + hd * 0.14, 0.045, "arm"])
		if R.has("foot_" + s):
			var to := _bpos(R["ball_" + s]) if R.has("ball_" + s) else _bpos(R["foot_" + s]) + _fwd * 0.14
			segs.append([R["foot_" + s], to, 0.045, "leg"])
	for sg in segs:
		_capsule(sg[0], sg[1], sg[2], sg[3])


func _attach_for(bone: int) -> Node3D:
	if _sk == null or bone < 0:
		return _her()
	if _attach.has(bone) and is_instance_valid(_attach[bone]):
		return _attach[bone]
	var at := BoneAttachment3D.new()
	at.name = "HSBone_%s" % _sk.get_bone_name(bone)
	at.bone_name = _sk.get_bone_name(bone)
	_sk.add_child(at)
	at.global_transform = _sk.global_transform * _sk.get_bone_global_pose(bone)
	_attach[bone] = at
	return at


func _capsule(bone: int, to: Vector3, r: float, part: String) -> void:
	var at := _attach_for(bone)
	var a := _bpos(bone)
	var L := a.distance_to(to)
	if L < 0.02:
		return
	var body := AnimatableBody3D.new()
	body.name = "Hitbox_%s" % _sk.get_bone_name(bone)
	body.sync_to_physics = false
	body.collision_layer = HITBOX_LAYER
	body.collision_mask = 0
	body.set_meta("hs_part", part)
	body.set_meta("hs_bone", bone)
	body.set_meta("hs_surface", "ichor")
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = r
	cap.height = L + 2.0 * r
	cs.shape = cap
	body.add_child(cs)
	at.add_child(body)
	var y := (to - a) / L
	var x := y.cross(Vector3.UP if absf(y.y) < 0.95 else Vector3.RIGHT).normalized()
	body.global_transform = Transform3D(Basis(x, y, x.cross(y)), (a + to) * 0.5)
	_boxes.append(body)


# a stand-in with nothing solid: a capsule round her meshes
func _box_round(her: Node3D) -> void:
	var bb := AABB()
	var first := true
	for mi in her.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		var b := m.global_transform * m.mesh.get_aabb()
		bb = b if first else bb.merge(b)
		first = false
	if first:
		return
	var body := AnimatableBody3D.new()
	body.name = "Hitbox"
	body.sync_to_physics = false
	body.collision_layer = HITBOX_LAYER
	body.collision_mask = 0
	body.set_meta("hs_surface", "ichor")
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = clampf(maxf(bb.size.x, bb.size.z) * 0.4, 0.12, 0.5)
	cap.height = maxf(bb.size.y, cap.radius * 2.0)
	cs.shape = cap
	body.add_child(cs)
	her.add_child(body)
	body.global_position = bb.get_center()
	_boxes.append(body)


# ---- shot ----------------------------------------------------------------------------------------------------------

func _listen() -> void:
	for w in get_tree().get_nodes_in_group("hs_weapon"):
		if not _guns.has(w) and w.has_signal("fired"):
			w.fired.connect(_on_fired)
			_guns.append(w)


func _on_fired(shot_hits: Array) -> void:
	var her := _her()
	if her == null or is_down or not her.is_visible_in_tree():
		return
	var mine := shot_hits.filter(func(h) -> bool:
		var c = h.get("collider")
		return c is Node and is_instance_valid(c) and (c == her or her.is_ancestor_of(c)))
	if mine.is_empty():
		return
	var spots: Array = []
	var blast := {}
	var dmg := 0.0
	for h in mine:
		if bool(h.get("blast", false)):
			if blast.is_empty() or float(h.get("damage", 0.0)) > float(blast.get("damage", 0.0)):
				blast = h
			continue
		var w := _where(h)
		var k := head_x if w["part"] == "head" else (limb_x if w["part"] == "arm" or w["part"] == "leg" else 1.0)
		dmg += float(h.get("damage", 1.0)) * k
		spots.append(w)
	if not blast.is_empty():
		dmg += float(blast.get("damage", 0.0))
	_react(spots, blast, dmg)


## Hit by a script (a cue's, a trap's): `point` where (the world's), `dir` the way, `dmg` how hard (a buckshot pellet's 1).
func shoot(point: Vector3, dir: Vector3, dmg := 4.0) -> void:
	if is_down:
		return
	var w := _where({"point": point, "normal": -dir, "dir": dir.normalized(), "collider": null})
	_react([w], {}, dmg)


# where a pellet landed on her: its hitbox's part and bone, or her own collider's hit cast again at her hitboxes, or a
# stand-in's part by the height
func _where(h: Dictionary) -> Dictionary:
	var c = h.get("collider")
	var p: Vector3 = h.get("point", _her().global_position)
	var dir: Vector3 = (h.get("dir", Vector3.FORWARD) as Vector3).normalized()
	var nrm: Vector3 = h.get("normal", -dir)
	if c is Node and (c as Node).has_meta("hs_part"):
		return {"part": str(c.get_meta("hs_part")), "bone": int(c.get_meta("hs_bone", -1)), "point": p, "normal": nrm, "dir": dir}
	if not _boxes.is_empty():
		var q := PhysicsRayQueryParameters3D.create(p - dir * 0.6, p + dir * 0.9, HITBOX_LAYER)
		var hit2 := get_world_3d().direct_space_state.intersect_ray(q)
		if not hit2.is_empty() and (hit2["collider"] as Node).has_meta("hs_part"):
			var b2 := hit2["collider"] as Node
			return {"part": str(b2.get_meta("hs_part")), "bone": int(b2.get_meta("hs_bone", -1)), "point": hit2["position"],
				"normal": hit2["normal"], "dir": dir}
	var her := _her()
	var tall := _height()
	var f := (p.y - her.global_position.y) / maxf(tall, 0.5)
	var part := "head" if f > 0.86 else ("leg" if f < 0.45 else "torso")
	return {"part": part, "bone": _nearest_bone(p), "point": p, "normal": nrm, "dir": dir}


func _height() -> float:
	if _roles.has("head") and _sk != null:
		return _bpos(_roles["head"]).y - _her().global_position.y + 0.15
	return 1.7


func _nearest_bone(p: Vector3) -> int:
	if _sk == null:
		return -1
	var best := -1
	var bd := INF
	for k in _roles:
		var bs: Array = _roles[k] if _roles[k] is Array else [_roles[k]]
		for b in bs:
			var d := _bpos(b).distance_to(p)
			if d < bd:
				bd = d
				best = b
	return best


func _react(spots: Array, blast: Dictionary, dmg: float) -> void:
	var her := _her()
	hit_count += 1
	damage += dmg
	var power := clampf(dmg / 4.0, 0.3, 4.0)              # (most of a close buckshot shot: about 2)
	var dir := Vector3.ZERO
	for w in spots:
		dir += w["dir"]
	var mid := her.global_position + Vector3.UP * _height() * 0.55
	if not blast.is_empty():
		dir += (mid - (blast.get("from", mid - Vector3.FORWARD) as Vector3)).normalized() * 2.0
	dir = dir.normalized() if dir.length() > 1e-4 else Vector3.FORWARD
	# the wounds: one a bone hit, four at most a shot (a blast tears three more out of her side facing it)
	var made := 0
	var seen := {}
	var parts := {}
	for w in spots:
		parts[w["part"]] = true
		if made >= 4 or (seen.has(w["bone"]) and made >= 2):
			continue
		seen[w["bone"]] = true
		_wound(w, power, made == 0)
		made += 1
	if not blast.is_empty():
		for p in ["torso", "arm", "leg", "head"]:
			parts[p] = true
		for i in 3:
			var aim := mid + Vector3(randf_range(-0.2, 0.2), randf_range(-0.6, 0.4), randf_range(-0.2, 0.2))
			_wound(_where({"point": aim - dir * 0.3, "dir": dir, "normal": -dir, "collider": null}), power * 1.3, i == 0)
	# the flinch, a stagger or a nudge
	_flinch_for(parts.keys(), dir, power, not blast.is_empty())
	_acc += dmg
	var st := not blast.is_empty() or _acc >= stagger
	if st:
		_acc = 0.0
		var secs := stagger_s * (1.3 if parts.has("head") else 1.0) * (1.4 if not blast.is_empty() else 1.0)
		_hold(dir, push_m * clampf(power / 2.0, 0.4, 1.6), secs)
		staggered.emit(secs)
	else:
		_hold(dir, push_m * 0.2 * clampf(power / 2.0, 0.3, 1.2), 0.18)
	var at: Vector3 = spots[0]["point"] if not spots.is_empty() else mid
	_play(_lk.hit_sound if _lk.hit_sound != null else _sound("ichor_hit"), at, clampf(-3.0 + 2.5 * log(maxf(power, 1.0)), -3.0, 2.0))
	if cry != null:
		_play(cry, at, 0.0, "sfx")
	last = {"part": spots[0]["part"] if not spots.is_empty() else "torso", "parts": parts.keys(),
		"bone": spots[0]["bone"] if not spots.is_empty() else -1, "damage": dmg, "health": health - damage,
		"point": at, "dir": dir, "power": power, "staggered": st, "blast": not blast.is_empty(), "wounds": made}
	hit.emit(last)
	if damage >= health:
		_go_down(dir)


# ---- the reaction ----------------------------------------------------------------------------------------------------

func _flinch_for(parts: Array, dir: Vector3, power: float, all := false) -> void:
	if flinch <= 0.0:
		return
	var base := 0.22 * flinch * clampf(sqrt(power), 0.6, 2.0)
	var away := Vector3.UP.cross(dir).normalized()          # turned about this, a bone's top goes along the shot
	if away.length() < 0.5:
		away = Vector3.RIGHT
	if _sk == null or _flinch == null:
		_stand_kick(away, base * (1.6 if all else 1.0))
		return
	var R := _roles
	var spine: Array = R["spine"]
	var top: int = spine[spine.size() - 1] if not spine.is_empty() else -1
	var right := _fwd.cross(Vector3.UP).normalized()       # her right (seen from behind her)
	for part in (["head", "torso", "arm", "leg"] if all else parts):
		match part:
			"head":
				_k("head", away, base * 1.3, 12.0)
				_k("neck", away, base * 0.5, 11.0)
				if top >= 0:
					_flinch.kick(top, away, base * 0.2, 10.0)
			"torso":
				for i in spine.size():
					_flinch.kick(spine[i], away, base * 0.4, 11.0, i * 0.012)
				_k("neck", away, base * 0.3, 9.0, 0.05)
				_k("head", away, base * 0.45, 8.0, 0.07)
				for s in ["l", "r"]:
					_k("uparm_" + s, Vector3(randfn(0, 1), randfn(0, 1), randfn(0, 1)), base * 0.5, 10.0, 0.02)
			"arm":
				var s := _side_hit(dir)
				if R.has("uparm_" + s) and R.has("lowarm_" + s):
					var bd := (_bpos(R["lowarm_" + s]) - _bpos(R["uparm_" + s])).normalized()
					var ax := bd.cross(dir).normalized()
					_k("uparm_" + s, ax, base * 1.3, 11.0)
					_k("lowarm_" + s, ax, base * 0.9, 12.0, 0.03)
				if top >= 0:
					_flinch.kick(top, Vector3.UP * (1.0 if s == "l" else -1.0), base * 0.35, 9.0)
			"leg":
				var s := _side_hit(dir)
				_k("lowleg_" + s, right, base * 1.4, 10.0)        # the knee gives
				_k("upleg_" + s, away, base * 0.6, 10.0)
				if R.has("pelvis"):
					_flinch.kick(R["pelvis"], away, 0.0, 9.0, 0.0, 0.05 * clampf(power, 0.5, 2.0))
				if spine.size() > 1:
					_flinch.kick(spine[spine.size() / 2], -away, base * 0.3, 9.0, 0.03)


func _k(role: String, axis: Vector3, amp: float, w: float, delay := 0.0) -> void:
	if _roles.has(role):
		_flinch.kick(_roles[role], axis, amp, w, delay)


# which side of her was hit: the last hit's bone's side, else the shot's side of her middle
func _side_hit(dir: Vector3) -> String:
	if not last.is_empty() and _sk != null and int(last.get("bone", -1)) >= 0:
		var s := _side(_sk.get_bone_name(int(last["bone"])).to_lower())
		if s != "":
			return s
	var right := _fwd.cross(Vector3.UP)
	return "r" if dir.dot(right) < 0.0 else "l"


# a stand-in tilted whole about her feet, away from the shot
func _stand_kick(axis: Vector3, amp: float) -> void:
	var her := _her()
	if _stand.is_empty():
		for c in her.get_children():
			if c is Node3D and c != self and not _boxes.has(c) and not (c is BoneAttachment3D):
				_stand.append([c, (c as Node3D).transform])
	_tilt = {"axis": (her.global_basis.inverse() * axis).normalized(), "amp": amp, "w": 9.0, "t": 0.0}


# held where she is (whatever moves her), shoved back along the shot over a moment
func _hold(dir: Vector3, push: float, secs: float) -> void:
	var her := _her()
	var now := _now()
	if now >= _hold_until:
		_hold_at = her.global_position
		_hold_basis = her.global_basis
		_knock = Vector3.ZERO
	var d := Vector3(dir.x, 0.0, dir.z)
	d = d.normalized() if d.length() > 1e-4 else Vector3.ZERO
	_hold_at += _knock                                  # (a shove still under way: from where it got to)
	_knock = d * push
	_knock_t0 = now
	_hold_until = maxf(_hold_until, now + secs)


func _process(dt: float) -> void:
	if Engine.is_editor_hint():
		return
	_clock += dt
	_t += dt
	if _t > 0.5:
		_t = 0.0
		_listen()
	var her := _her()
	var now := _now()
	if her != null and now < _hold_until and _hold_at != Vector3.INF:
		var k := clampf((now - _knock_t0) / 0.22, 0.0, 1.0)
		her.global_position = _hold_at + _knock * (1.0 - (1.0 - k) * (1.0 - k))
		her.global_basis = _hold_basis
	elif her != null and _hold_at != Vector3.INF and now >= _hold_until:
		her.global_position = _hold_at + _knock
		_hold_at = Vector3.INF
	# a stand-in's tilt
	if not _tilt.is_empty():
		_tilt["t"] = float(_tilt["t"]) + dt
		var f := HSFlinch._shape(float(_tilt["t"]), float(_tilt["w"]))
		var q := Basis(_tilt["axis"], float(_tilt["amp"]) * f)
		for e in _stand:
			if is_instance_valid(e[0]):
				(e[0] as Node3D).transform = Transform3D(q) * (e[1] as Transform3D)
		if float(_tilt["t"]) > 7.0 / float(_tilt["w"]):
			for e in _stand:
				if is_instance_valid(e[0]):
					(e[0] as Node3D).transform = e[1]
			_tilt = {}
			_stand.clear()
	# the smoke rides her bones (it lives outside her, so it stays when she's gone)
	for e in _smoke.duplicate():
		var m = e["m"]
		if not is_instance_valid(m) or now > float(e["until"]):
			if is_instance_valid(m):
				(m as Node).queue_free()
			_smoke.erase(e)
			continue
		if her != null and her.is_visible_in_tree():
			(m as Node3D).global_transform = _bone_xf(int(e["bone"])) * (e["local"] as Transform3D)
	if is_down and gone_secs > 0.0 and _gone_at > 0.0 and now - _gone_at > gone_secs:
		restore()


func _physics_process(dt: float) -> void:
	if Engine.is_editor_hint():
		return
	var her := _her()
	if her != null and _now() < _hold_until and _hold_at != Vector3.INF:
		var k := clampf((_now() - _knock_t0) / 0.22, 0.0, 1.0)
		her.global_position = _hold_at + _knock * (1.0 - (1.0 - k) * (1.0 - k))
	if _drops.is_empty():
		return
	var space := get_world_3d().direct_space_state
	var ex := _rids()
	for d in _drops.duplicate():
		var n = d["node"]
		if not is_instance_valid(n):
			_drops.erase(d)
			continue
		var v: Vector3 = d["v"]
		v.y -= 9.8 * dt
		var from := (n as Node3D).global_position
		var to := from + v * dt
		var q := PhysicsRayQueryParameters3D.create(from, to, 1)
		q.exclude = ex
		var hit := space.intersect_ray(q)
		d["age"] = float(d["age"]) + dt
		if not hit.is_empty():
			_decal("drop", randf_range(0.05, 0.12) * float(d["k"]), hit["position"], hit["normal"], v, _root)
			(n as Node).queue_free()
			_drops.erase(d)
		elif float(d["age"]) > 2.5 or to.y < -60.0:
			(n as Node).queue_free()
			_drops.erase(d)
		else:
			(n as Node3D).global_position = to
			d["v"] = v


# what of hers is solid (the rays that carry her ichor never stop on her)
func _rids() -> Array:
	var out: Array = []
	var her := _her()
	if her == null:
		return out
	for n in [her] + her.find_children("*", "CollisionObject3D", true, false):
		if n is CollisionObject3D:
			out.append((n as CollisionObject3D).get_rid())
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		out.append((pl as CollisionObject3D).get_rid())
	return out


# ---- the ichor and the smoke -----------------------------------------------------------------------------------------

# a wound: its mark on her (riding her bone), smoke out of it, droplets flung out, the spray behind her, drops
func _wound(w: Dictionary, power: float, spray_behind: bool) -> void:
	var her := _her()
	var at: Vector3 = w["point"]
	var nrm: Vector3 = (w["normal"] as Vector3).normalized() if (w["normal"] as Vector3).length() > 1e-4 else -(w["dir"] as Vector3)
	var dir: Vector3 = w["dir"]
	var bone: int = w["bone"]
	wounds += 1
	var host := _attach_for(bone)
	var size := randf_range(_lk.wound_m.x, _lk.wound_m.y) * clampf(sqrt(power), 0.8, 1.4)
	var mk := _decal("wound", size, at, nrm, Vector3.UP, host, false)
	if mk != null:
		mk.size.y = 0.09                             # (on her skin, never the wall behind her)
	# smoke out of the wound, riding her (outside her: it stays when she goes); a moment after the hit, once the shove
	# has settled (the smoke rides her bone: shoved with her, it drew a line through the air)
	if _lk.bleed_wounds > 0 and _bleeding() < _lk.bleed_wounds:
		var bore := (Vector3.UP + nrm * 0.35).normalized()       # (it rises out of the wound, a little off her)
		var z := -bore
		var x := z.cross(nrm if absf(nrm.dot(bore)) < 0.95 else Vector3.RIGHT).normalized()
		var wt := Transform3D(Basis(x, z.cross(x), z), at + nrm * 0.012)
		var b := bone if _sk != null and bone >= 0 else -2
		var local := (_bone_xf(b)).affine_inverse() * wt
		_pending_smoke += 1
		get_tree().create_timer(SMOKE_LATE).timeout.connect(_start_smoke.bind(b, local, "wound"))
	# droplets out of it: most along the shot, a few back toward the gun
	var imp := HSImpacts.of(get_tree())
	var g := Gradient.new()
	g.set_color(0, Color(0.015, 0.012, 0.014, 1.0))
	g.set_color(1, Color(0.04, 0.008, 0.01, 1.0))
	var n := int(round(float(_lk.spray) * clampf(power * 0.6, 0.3, 1.6)))
	if n > 0:
		imp._burst(_drop(), n, 0.45, Vector2(1.2, 3.2), 32.0, Vector3(0, -9.8, 0), Vector2(0.003, 0.007), g, at, imp._up_along(dir), false, imp._grow(0.8), 0.4)
		imp._burst(_drop(), maxi(n / 4, 1), 0.35, Vector2(0.6, 1.6), 50.0, Vector3(0, -9.8, 0), Vector2(0.002, 0.005), g, at, imp._up_along(-dir), false, imp._grow(0.8), 0.4)
	# heavy drops that splash where they land
	var nd := int(round(float(_lk.drops) * clampf(power * 0.5, 0.3, 1.5)))
	for i in nd:
		var dm := MeshInstance3D.new()
		dm.mesh = _drop()
		dm.scale = Vector3.ONE * randf_range(0.006, 0.012)
		dm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_root.add_child(dm)
		dm.global_position = at + dir * 0.03
		var spread := Vector3(randfn(0, 1), randfn(0, 1), randfn(0, 1)) * 0.9
		var vel := dir * randf_range(1.3, 3.4) + spread + Vector3.UP * randf_range(0.4, 1.6)
		_drops.append({"node": dm, "v": vel, "age": 0.0, "k": clampf(sqrt(power), 0.7, 1.4)})
	# the spray on the wall or the floor behind her
	if spray_behind:
		_spray(at, dir, power)


func _spray(at: Vector3, dir: Vector3, power: float) -> void:
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(at + dir * 0.02, at + dir * _lk.splat_reach_m, 1)
	q.exclude = _rids()
	var hit := space.intersect_ray(q)
	if hit.is_empty():
		# nothing behind her within reach: it falls to the floor under its way
		var fall := at + dir * minf(1.0, _lk.splat_reach_m * 0.4)
		var q2 := PhysicsRayQueryParameters3D.create(fall, fall + Vector3.DOWN * 3.0, 1)
		q2.exclude = q.exclude
		hit = space.intersect_ray(q2)
		if hit.is_empty():
			return
	var p: Vector3 = hit["position"]
	var n: Vector3 = hit["normal"]
	var far := clampf(at.distance_to(p) / _lk.splat_reach_m, 0.0, 1.0)
	var size := lerpf(_lk.splat_m.x, _lk.splat_m.y, clampf((power - 0.5) / 2.5, 0.0, 1.0)) * (0.75 + 0.5 * far)
	_decal("drip" if absf(n.y) < 0.55 else "splat", size, p, n, dir, _root)


# a mark of ichor: the decal's maps from fx/, black and glossy, its embers fading; on the world (`root`) or on her
func _decal(kind: String, size: float, at: Vector3, nrm: Vector3, along: Vector3, host: Node, world := true) -> Decal:
	if host == null or not is_instance_valid(host):
		return null
	var count := {"splat": 3, "drip": 2, "wound": 2, "drop": 2}[kind] as int
	var nm := "ichor_%s_%d" % [kind, randi() % count]
	var d := Decal.new()
	d.name = "Ichor"
	d.texture_albedo = HSMuzzle.tex("fx/%s_albedo.png" % nm)
	d.texture_normal = HSMuzzle.tex("fx/%s_normal.png" % nm)
	d.texture_orm = HSMuzzle.tex("fx/%s_orm.png" % nm)
	d.texture_emission = HSMuzzle.tex("fx/%s_emission.png" % nm)
	d.emission_energy = _lk.embers
	d.modulate = _lk.ichor_color
	d.size = Vector3(size, clampf(size * 0.5, 0.06, 0.4), size)
	d.normal_fade = 0.3
	d.upper_fade = 0.2
	d.lower_fade = 0.2
	d.cull_mask = HSImpacts.MARK_MASK
	d.sorting_offset = 0.01
	host.add_child(d)
	var y := nrm.normalized()
	var x: Vector3
	var z: Vector3
	if kind == "drip":
		z = Vector3.DOWN - y * Vector3.DOWN.dot(y)       # its runs down the wall
		z = z.normalized() if z.length() > 1e-3 else y.cross(Vector3.RIGHT).normalized()
		x = y.cross(z).normalized()
	else:
		x = along - y * along.dot(y)                     # thrown along the shot
		x = x.normalized() if x.length() > 1e-3 else y.cross(Vector3.UP if absf(y.y) < 0.9 else Vector3.RIGHT).normalized()
		if kind != "splat":
			x = Basis(y, randf() * TAU) * x
		z = x.cross(y).normalized()
	d.global_transform = Transform3D(Basis(x, y, z), at + y * 0.004)
	if _lk.embers > 0.0 and _lk.embers_s > 0.0:
		var tw := d.create_tween()
		tw.tween_property(d, "emission_energy", 0.0, _lk.embers_s).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	if world:
		marks.append(d)
		while marks.size() > _lk.keep:
			var o = marks.pop_front()
			if is_instance_valid(o):
				(o as Node).queue_free()
		if _lk.evaporate_s > 0.0:
			var tv := d.create_tween()
			tv.tween_interval(_lk.evaporate_s)
			tv.tween_property(d, "modulate:a", 0.0, 3.0)
			tv.tween_callback(d.queue_free)
	return d


func _drop() -> Mesh:
	if _drop_mesh == null:
		var s := SphereMesh.new()
		s.radius = 0.5
		s.height = 1.0
		s.radial_segments = 8
		s.rings = 4
		var mat := StandardMaterial3D.new()
		mat.vertex_color_use_as_albedo = true
		mat.albedo_color = Color(0.015, 0.012, 0.014)
		mat.roughness = 0.06
		mat.metallic_specular = 0.9
		s.material = mat
		_drop_mesh = s
	return _drop_mesh


# ---- down ------------------------------------------------------------------------------------------------------------

func _go_down(dir: Vector3) -> void:
	if is_down:
		return
	is_down = true
	var her := _her()
	her.set_meta("hs_down", true)
	_hold_until = INF
	if _hold_at == Vector3.INF:
		_hold_at = her.global_position
		_hold_basis = her.global_basis
	for c in her.get_children():
		if c != self and c.has_method("stop"):
			c.call_deferred("stop")
	_flinch_for([], dir, 2.5, true)
	_play(_lk.down_sound if _lk.down_sound != null else _sound("ichor_down"), her.global_position + Vector3.UP, 0.0)
	match down_mode:
		Down.DISSOLVE:
			_dissolve()
		Down.VANISH:
			_smoke_off(0.4)
			_gone()
		Down.RAGDOLL:
			var sims := her.find_children("*", "PhysicalBoneSimulator3D", true, false)
			if sims.is_empty():
				_dissolve()
			else:
				(sims[0] as PhysicalBoneSimulator3D).physical_bones_start_simulation()
				_gone_at = _now()
		Down.NOTHING:
			_gone_at = _now()
	down.emit()
	if target != null and target.has_method("fire"):
		target.fire()


# she chars over from her skin, its edge burning (an overlay on her own look), smoke pouring off her; charred all over,
# her surfaces are the char's and crumble away into the smoke, each hole's rim burning
func _dissolve() -> void:
	var her := _her()
	var meshes: Array = []
	for mi in her.find_children("*", "GeometryInstance3D", true, false):
		if mi is MeshInstance3D and (mi as MeshInstance3D).is_visible_in_tree():
			meshes.append(mi)
	var sd := Vector3(randf() * 30.0, randf() * 30.0, randf() * 30.0)
	_char = _char_mat("char.gdshader", sd)
	_char.set_shader_parameter("burn", 0.0)
	_crumble = _char_mat("crumble.gdshader", sd)
	_crumble.set_shader_parameter("crumble", 0.0)
	for m in meshes:
		(m as MeshInstance3D).material_overlay = _char
	var s := _lk.dissolve_s
	get_tree().create_timer(SMOKE_LATE).timeout.connect(_smoke_off.bind(s - SMOKE_LATE))
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: _char.set_shader_parameter("burn", v), 0.0, 1.0, s * 0.45).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void:
		for m in meshes:
			if is_instance_valid(m):
				(m as MeshInstance3D).material_overlay = null
				(m as MeshInstance3D).material_override = _crumble)
	tw.tween_method(func(v: float) -> void: _crumble.set_shader_parameter("crumble", v), 0.0, 1.0, s * 0.55).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tw.tween_callback(_gone)


func _char_mat(shader: String, sd: Vector3) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(DIR + "react/" + shader)
	m.set_shader_parameter("char_color", _lk.char_color)
	m.set_shader_parameter("edge_color", _lk.char_edge)
	m.set_shader_parameter("edge_energy", _lk.char_edge_energy)
	m.set_shader_parameter("seed", sd)
	return m


# smoke pouring off her: her chest, her head, her hands, her knees, her middle
func _smoke_off(secs: float) -> void:
	var her := _her()
	if her == null:
		return
	var spots: Array = []
	var spine: Array = _roles.get("spine", [])
	for r in ["head", "hand_l", "hand_r", "lowleg_l", "lowleg_r"]:
		if _roles.has(r):
			spots.append(_roles[r])
	if not spine.is_empty():
		spots.append(spine[spine.size() / 2])
		spots.append(spine[spine.size() - 1])
	if spots.is_empty() or _sk == null:
		spots = [-2]
	for b in spots:
		var p: Vector3 = _bpos(b) if b >= 0 else her.global_position + Vector3.UP * _height() * 0.55
		var wt := Transform3D(Basis.looking_at(Vector3.UP, Vector3.FORWARD), p)   # (its -Z up: the smoke rises off her)
		_start_smoke(b, _bone_xf(b).affine_inverse() * wt, "going", secs)


# a bone's transform in the world (-2: hers)
func _bone_xf(b: int) -> Transform3D:
	if b >= 0 and _sk != null:
		return _sk.global_transform * _sk.get_bone_global_pose(b)
	return _her().global_transform


func _bleeding() -> int:
	return _pending_smoke + _smoke.filter(func(e) -> bool: return e["kind"] == "wound").size()


# smoke out of her at `local` from a bone, riding it (it lives outside her, so it stays when she's gone)
func _start_smoke(b: int, local: Transform3D, kind: String, secs := 0.0) -> void:
	if kind == "wound":
		_pending_smoke = maxi(_pending_smoke - 1, 0)
	var her := _her()
	if her == null or _root == null or not is_instance_valid(_root) or (kind == "wound" and not her.is_visible_in_tree()):
		return
	var lk: HSMuzzleFlash
	if kind == "wound":
		lk = _lk.wound_smoke if _lk.wound_smoke != null else load(DIR + "react/ichor_smoke.tres")
	else:
		lk = _lk.down_smoke if _lk.down_smoke != null else load(DIR + "react/dissolve_smoke.tres")
	var m := HSMuzzle.new()
	m.name = "WoundSmoke" if kind == "wound" else "GoingSmoke"
	_root.add_child(m)
	m.global_transform = _bone_xf(b) * local
	m.fire(lk)
	_smoke.append({"m": m, "bone": b, "local": local, "until": _now() + secs + lk.trail_s + lk.trail_life_s + 1.0, "kind": kind})


# gone: not drawn, nothing of her solid, hidden for whatever hunts (scare_area's word), a pool where she stood
func _gone() -> void:
	var her := _her()
	if her == null:
		return
	_gone_at = _now()
	if her.visible:
		her.visible = false
	her.set_meta("hs_hidden", true)
	_solid.clear()
	for n in [her] + her.find_children("*", "CollisionObject3D", true, false):
		if n is CollisionObject3D:
			_solid.append([n, (n as CollisionObject3D).collision_layer])
			(n as CollisionObject3D).collision_layer = 0
	if _lk.pool_m > 0.0:
		var space := get_world_3d().direct_space_state
		var from := her.global_position + Vector3.UP * 0.4
		var q := PhysicsRayQueryParameters3D.create(from, from + Vector3.DOWN * 2.0, 1)
		q.exclude = _rids()
		var hit := space.intersect_ray(q)
		if not hit.is_empty():
			_decal("drop", _lk.pool_m, hit["position"], hit["normal"], Vector3.FORWARD, _root)


## Back as she was before she was shot: shown, solid, whole (her char, her fade and her wounds gone), her health full.
func restore() -> void:
	var her := _her()
	if her == null:
		return
	her.visible = true
	her.set_meta("hs_hidden", false)
	her.set_meta("hs_down", false)
	for e in _solid:
		if is_instance_valid(e[0]):
			(e[0] as CollisionObject3D).collision_layer = int(e[1])
	_solid.clear()
	for mi in her.find_children("*", "GeometryInstance3D", true, false):
		if mi is MeshInstance3D:
			(mi as MeshInstance3D).material_overlay = null
			if (mi as MeshInstance3D).material_override == _crumble and _crumble != null:
				(mi as MeshInstance3D).material_override = null
	for at in _attach.values():
		if is_instance_valid(at):
			for c in (at as Node).get_children():
				if c is Decal:
					c.queue_free()
	damage = 0.0
	_acc = 0.0
	is_down = false
	_gone_at = -1.0
	_hold_until = -1.0
	_hold_at = Vector3.INF


# ---- sound -----------------------------------------------------------------------------------------------------------

func _sound(nm: String) -> AudioStream:
	var p := DIR + "sounds/%s.ogg" % nm
	return load(p) if ResourceLoader.exists(p) else null


func _play(st: AudioStream, at: Vector3, db := 0.0, kind_word := "event") -> void:
	if st == null:
		return
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null and snd.has_method("play"):
		snd.play(st, at, db, kind_word)
		return
	var p := AudioStreamPlayer3D.new()
	p.stream = st
	p.volume_db = db
	(_root if _root != null else self).add_child(p)
	p.global_position = at
	p.play()
	p.finished.connect(p.queue_free)
