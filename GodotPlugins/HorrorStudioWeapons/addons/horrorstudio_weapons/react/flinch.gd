class_name HSFlinch
extends SkeletonModifier3D
## A body's flinches when it's shot (HSHitReact puts one under her Skeleton3D; docs/research/hit_reactions.md): each
## a kick to one bone, additive on top of whatever her animation poses, after it, on a spring (a critically damped one
## struck once: up to its angle in 1/w seconds, back by about 4/w). A bone turned about an axis in the world (away from
## the shot), or the root dropped (a knee giving).

var kicks: Array = []                           # {bone, axis (world), amp (rad), w, t, delay, drop (m)}


## Kicks a bone: turned `amp` radians about `axis_w` (the world's) at its peak, reached in 1/w seconds after `delay`;
## `drop_m` lowers it as much (a root: the body sinking).
func kick(bone: int, axis_w: Vector3, amp: float, w := 11.0, delay := 0.0, drop_m := 0.0) -> void:
	if bone < 0 or (axis_w.length() < 1e-6 and drop_m == 0.0):
		return
	kicks.append({"bone": bone, "axis": axis_w.normalized() if axis_w.length() > 1e-6 else Vector3.UP, "amp": amp,
		"w": maxf(w, 1.0), "t": 0.0, "delay": delay, "drop": drop_m})


## Whether a kick is still moving her.
func busy() -> bool:
	return not kicks.is_empty()


## The strongest turn a kick gives now (radians), a check's.
func peak_now() -> float:
	var m := 0.0
	for k in kicks:
		m = maxf(m, absf(float(k["amp"]) * _shape(float(k["t"]) - float(k["delay"]), float(k["w"]))))
	return m


func _process_modification_with_delta(delta: float) -> void:
	var sk := get_skeleton()
	if sk == null or kicks.is_empty():
		return
	var gb := sk.global_basis.orthonormalized()
	var done: Array = []
	for k in kicks:
		k["t"] = float(k["t"]) + delta
		var s := float(k["t"]) - float(k["delay"])
		if s <= 0.0:
			continue
		var w := float(k["w"])
		if s > 7.0 / w:
			done.append(k)
			continue
		var f := _shape(s, w)
		var b: int = k["bone"]
		var p := sk.get_bone_parent(b)
		# the world's axis in the bone's parent's space (its pose is in that space)
		var pb := gb * (sk.get_bone_global_pose(p).basis.orthonormalized() if p >= 0 else Basis())
		var ax: Vector3 = (pb.inverse() * (k["axis"] as Vector3)).normalized()
		var ang := float(k["amp"]) * f
		if absf(ang) > 1e-5:
			sk.set_bone_pose_rotation(b, Quaternion(ax, ang) * sk.get_bone_pose_rotation(b))
		var drop := float(k["drop"])
		if drop != 0.0:
			var down := (pb.inverse() * Vector3.DOWN).normalized()
			sk.set_bone_pose_position(b, sk.get_bone_pose_position(b) + down * drop * f)
	for k in done:
		kicks.erase(k)


# a critically damped spring struck once: 0 at the strike, 1 at s = 1/w, settling back
static func _shape(s: float, w: float) -> float:
	if s <= 0.0:
		return 0.0
	var x := w * s
	return x * exp(1.0 - x)
