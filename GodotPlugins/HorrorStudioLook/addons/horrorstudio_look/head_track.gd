## A head that follows you (docs/ANIMATOR_V3.md §3, docs/GODOT_LOOK.md §5x; DECISIONS 2026-11-14, animations v3: "semi
## ik animations where the npc head tracks the user for a given adjustable range (let's say 160 degrees with front
## facing being 0 so the 160 degrees is 80 degrees left and 80 degrees right)").
##
## A SkeletonModifier3D under her skeleton: after her animation each frame it turns a share of her chest, her neck,
## her head and her eyes toward a target, as much as `amount`. Her clip is played as it was made; this only corrects
## where the head it gives her is pointing ("semi IK"). Nothing of it is kept in her pose: with `follow` off, or the
## target out of her range, she is exactly her clip again.
##     var t := HSHeadTrack.attach($Her)        # one under her skeleton (or the one already there)
##     t.range_degrees = 160.0                  # 80 to each side of straight ahead; 0 is the way she faces
##     t.follow = false                         # the switch, eased
##     t.look_at_node($Door)                    # something else than the player; follow_player() back
## The target is the player's eye (the camera in view) unless `target` names a node; a node with a camera under it is
## looked at there, one with a skeleton at its head, one with `aim_point()` where that says.
class_name HSHeadTrack
extends SkeletonModifier3D

const HEAD := ["c_head", "Head", "head", "mixamorig_Head", "mixamorig:Head"]
const NECK := ["c_neck", "Neck", "neck", "mixamorig_Neck", "mixamorig:Neck"]
const CHEST := ["c_spine3", "UpperChest", "Chest", "Spine2", "mixamorig_Spine2", "mixamorig:Spine2", "spine_03"]
const SPINE := ["c_spine2", "Spine1", "mixamorig_Spine1", "mixamorig:Spine1", "spine_02"]
const EYES := [["l_eye", "LeftEye", "eye_l", "mixamorig_LeftEye", "mixamorig:LeftEye"], ["r_eye", "RightEye", "eye_r", "mixamorig_RightEye", "mixamorig:RightEye"]]
const SLACK := 6.0                                  # degrees past the range before she lets go of someone she's following (no flicking at the edge)
const EYE_YAW := 20.0                               # how far the eyes turn in the head, degrees
const EYE_PITCH := 13.0

@export var follow := true                          ## the switch: on, her head follows the target; off, it's her animation's again (eased, not snapped)
@export var target: NodePath                        ## who or what she looks at; empty: the player (the camera in view)
@export_range(0.0, 360.0, 1.0, "degrees") var range_degrees := 160.0   ## the whole arc she follows in: half of it to each side of straight ahead (0: the way she faces)
@export_range(0.0, 89.0, 1.0, "degrees") var up_degrees := 40.0        ## how far she'll look up
@export_range(0.0, 89.0, 1.0, "degrees") var down_degrees := 45.0      ## and down
@export_enum("Lets go", "Holds at the limit") var beyond := 0           ## the target past her range: her head goes back to her animation's, or stays turned as far as it goes
@export_range(0.0, 1.0) var amount := 1.0           ## how much of the way: 1 right at it, 0.5 half way from where her animation has her looking
@export_range(30.0, 900.0, 1.0, "degrees/s") var turn_speed := 260.0   ## never faster than this
@export_range(0.02, 1.0, 0.01, "s") var ease_secs := 0.16              ## how soft the turn is
@export_range(0.0, 0.6) var body_share := 0.22      ## how much of a turn the upper spine takes (the rest the neck and the head)
@export var eyes := true                            ## her eyes lead (when she has eye bones)
@export_range(0.0, 60.0, 0.1, "m") var max_distance := 12.0            ## further than this she doesn't follow (0: any distance)
@export var snappy := false                         ## in sudden steps instead of smoothly (a creature)
@export var forward := Vector3(0, 0, 1)             ## the way a model faces in its own space (a Studio export, any glTF: +Z)

var following := false                              ## the target is in her range and she's on it
var weight := 0.0                                   ## how much of the correction is on, 0..1 (eased)
var yaw := 0.0                                      ## where her head is turned, from straight ahead: radians, to her left
var pitch := 0.0                                    ## and up
var clip_yaw := 0.0                                 ## where her animation alone has it
var clip_pitch := 0.0
var facing := Vector3.ZERO                          ## where her face points after the correction, in the world (a check's)

var _head := -1
var _neck := -1
var _chest := -1
var _spine := -1
var _eyes: Array = []                               # [bone, ...]
var _inv := {}                                      # bone -> its rest's own turn undone (so `forward` is the model's, carried by the bone)
var _point := Vector3.INF
var _node: Node3D
var _have := false
var _goal := Vector2.ZERO
var _snap := 0.0
var _eye := [Vector2.ZERO, Vector2.ZERO]
var _ready_for: Skeleton3D


## one under `character`'s skeleton: the one already there, or a new one (null when she has no head bone)
static func attach(character: Node, settings: Dictionary = {}) -> HSHeadTrack:
	var t := of(character)
	if t == null:
		var sk := _skeleton(character)
		if sk == null or _find(sk, HEAD) < 0:
			return null
		t = HSHeadTrack.new()
		t.name = "HSHeadTrack"
		sk.add_child(t)
		for n in sk.get_children():                        # before the hands' IK: a hand brought to her mouth wants her head where it ends up
			if n is HSHandIK:
				sk.move_child(t, n.get_index())
				break
	for k in settings:
		t.set(k, settings[k])
	return t


static func of(character: Node) -> HSHeadTrack:
	if character == null:
		return null
	if character is HSHeadTrack:
		return character
	for n in character.find_children("*", "SkeletonModifier3D", true, false):
		if n is HSHeadTrack:
			return n
	return null


static func _skeleton(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	var list := n.find_children("*", "Skeleton3D", true, false)
	return list[0] as Skeleton3D if not list.is_empty() else null


static func _find(sk: Skeleton3D, names: Array) -> int:
	for nm in names:
		var i := sk.find_bone(nm)
		if i >= 0:
			return i
	return -1


func look_at_node(n: Node3D) -> void:
	_node = n
	_point = Vector3.INF


func look_at_point(p: Vector3) -> void:
	_point = p
	_node = null


## back to the player (or `target`)
func follow_player() -> void:
	_node = null
	_point = Vector3.INF


## at once, without the ease (after she's put somewhere else)
func reset() -> void:
	weight = 0.0
	_have = false
	following = false
	_eye = [Vector2.ZERO, Vector2.ZERO]


## where she's looking, in the world; INF: nothing to look at
func target_point() -> Vector3:
	if _point != Vector3.INF:
		return _point
	var n: Node3D = _node if is_instance_valid(_node) else null
	if n == null and not target.is_empty():
		n = get_node_or_null(target) as Node3D
	if n == null:
		var vp := get_viewport()
		var cam := vp.get_camera_3d() if vp != null else null
		return cam.global_position if cam != null else Vector3.INF
	return point_of(n)


## where to look at something: what its aim_point() says, its camera (a player), its head (someone), else where it is
static func point_of(n: Node3D) -> Vector3:
	if n.has_method("aim_point"):
		return n.aim_point()
	if n is Camera3D:
		return n.global_position
	var cams := n.find_children("*", "Camera3D", true, false)
	if not cams.is_empty():
		return (cams[0] as Camera3D).global_position
	var sk := _skeleton(n)
	if sk != null:
		var h := _find(sk, HEAD)
		if h >= 0:
			return sk.global_transform * sk.get_bone_global_pose(h).origin
	return n.global_position


func _skeleton_changed(_old: Skeleton3D, _new: Skeleton3D) -> void:
	_ready_for = null


func _setup(sk: Skeleton3D) -> void:
	_ready_for = sk
	_head = _find(sk, HEAD)
	_neck = _find(sk, NECK)
	_chest = _find(sk, CHEST)
	_spine = _find(sk, SPINE)
	_eyes = []
	for names in EYES:
		var e := _find(sk, names)
		if e >= 0:
			_eyes.append(e)
	_inv = {}
	for b in [_head] + _eyes:
		if b >= 0:
			_inv[b] = sk.get_bone_global_rest(b).basis.orthonormalized().inverse()
	reset()


static func _turn(sk: Skeleton3D, bone: int, by: Basis) -> void:
	var g := sk.get_bone_global_pose(bone)
	sk.set_bone_global_pose(bone, Transform3D(by * g.basis, g.origin))


func _process_modification_with_delta(delta: float) -> void:
	var sk := get_skeleton()
	if sk == null:
		return
	if _ready_for != sk:
		_setup(sk)
	if _head < 0:
		return
	var world := sk.global_transform
	var hp := sk.get_bone_global_pose(_head)
	var fa: Vector3 = (hp.basis.orthonormalized() * (_inv[_head] as Basis) * forward).normalized()   # where her animation alone has her face pointing, in her own space
	clip_yaw = atan2(fa.x, fa.z)
	clip_pitch = asin(clampf(fa.y, -1.0, 1.0))
	var half := deg_to_rad(range_degrees) * 0.5
	var tp := target_point() if follow and amount > 0.0 else Vector3.INF
	var seen := false
	var yt := clip_yaw
	var pt := clip_pitch
	var local := Vector3.ZERO
	if tp != Vector3.INF:
		local = world.affine_inverse() * tp
		var d := local - hp.origin
		var dist := d.length() * world.basis.get_scale().x
		if dist > 0.05 and (max_distance <= 0.0 or dist <= max_distance * (1.1 if following else 1.0)):
			d = d.normalized()
			yt = atan2(d.x, d.z)
			pt = clampf(asin(clampf(d.y, -1.0, 1.0)), -deg_to_rad(down_degrees), deg_to_rad(up_degrees))
			if absf(yt) <= half + (deg_to_rad(SLACK) if following else 0.0):
				seen = true
				yt = clampf(yt, -half, half)
			elif beyond == 1:
				seen = true
				yt = clampf(yt, -half, half)
	following = seen
	weight = move_toward(weight, 1.0 if seen else 0.0, delta / 0.3)
	if weight <= 0.0 and not seen:
		_have = false
	if seen:
		if not _have:                                   # she starts from where her animation has her looking
			_have = true
			yaw = clip_yaw
			pitch = clip_pitch
			_goal = Vector2(yt, pt)
			_snap = 0.0
		if snappy:                                      # a creature: where it looks is taken up in sudden steps
			_snap -= delta
			if _snap <= 0.0:
				_snap = randf_range(0.16, 0.55)
				_goal = Vector2(yt, pt)
		else:
			_goal = Vector2(yt, pt)
		var k := 1.0 - exp(-delta / maxf(0.01, ease_secs * (0.3 if snappy else 1.0)))
		var most := deg_to_rad(turn_speed) * delta * (3.0 if snappy else 1.0)
		yaw += clampf(wrapf(_goal.x - yaw, -PI, PI) * k, -most, most)
		pitch += clampf((_goal.y - pitch) * k, -most, most)
	var dy := wrapf(yaw - clip_yaw, -PI, PI) * weight * amount if _have else 0.0
	var dp := (pitch - clip_pitch) * weight * amount if _have else 0.0
	if absf(dy) + absf(dp) > 1e-5:
		# the turn shared out down the chain, parents first: about her own up for the yaw, about the level axis across where she then faces for the pitch
		var s := body_share if (_spine >= 0 and _chest >= 0) else 0.0
		var yaw_of := {}
		if s > 0.0:
			yaw_of[_spine] = 0.5 * s
			yaw_of[_chest] = 0.5 * s
		if _neck >= 0:
			yaw_of[_neck] = (1.0 - s) * 0.38
		yaw_of[_head] = 1.0 - s - (float(yaw_of[_neck]) if _neck >= 0 else 0.0)
		var fy := clip_yaw + dy
		var across := Vector3(-cos(fy), 0.0, sin(fy))
		for b in [_spine, _chest, _neck, _head]:
			if b < 0 or not yaw_of.has(b):
				continue
			var by := Basis(Vector3.UP, dy * float(yaw_of[b]))
			if b == _neck or b == _head:
				by = Basis(across, dp * (0.4 if b == _neck and _head >= 0 else (0.6 if _neck >= 0 else 1.0))) * by
			_turn(sk, b, by)
	# her eyes: on what she's looking at, as far as eyes turn in a head; back to straight when she isn't
	if eyes and not _eyes.is_empty():
		var hb: Basis = sk.get_bone_global_pose(_head).basis.orthonormalized() * (_inv[_head] as Basis)   # the model's own axes, as her head now carries them
		var ke := 1.0 - exp(-delta / 0.06)
		for i in _eyes.size():
			var e: int = _eyes[i]
			var ge := sk.get_bone_global_pose(e)
			var want := Vector2.ZERO
			if seen and tp != Vector3.INF:
				var tl := hb.inverse() * (local - ge.origin).normalized()
				want = Vector2(clampf(atan2(tl.x, tl.z), -deg_to_rad(EYE_YAW), deg_to_rad(EYE_YAW)), clampf(asin(clampf(tl.y, -1.0, 1.0)), -deg_to_rad(EYE_PITCH), deg_to_rad(EYE_PITCH))) * amount
			_eye[i] = (_eye[i] as Vector2).lerp(want, ke)
			var ev: Vector2 = _eye[i]
			if ev.length() > 1e-4:
				var r := Basis(Vector3.UP, ev.x) * Basis(Vector3(-1, 0, 0), ev.y)
				_turn(sk, e, hb * r * hb.inverse())
	var hf := sk.get_bone_global_pose(_head)
	facing = (world.basis.orthonormalized() * (hf.basis.orthonormalized() * (_inv[_head] as Basis) * forward)).normalized()


## what it's doing, for a check or a debug label: degrees
func report() -> Dictionary:
	return {"following": following, "weight": weight, "yaw": rad_to_deg(yaw), "pitch": rad_to_deg(pitch), "clip_yaw": rad_to_deg(clip_yaw), "clip_pitch": rad_to_deg(clip_pitch),
		"range": range_degrees, "facing": facing, "bones": {"head": _head, "neck": _neck, "chest": _chest, "spine": _spine, "eyes": _eyes.size()}}
