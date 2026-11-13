## The Animator's soft bones swung live (docs/ANIMATOR_V2.md §7, docs/GODOT_LOOK.md §5w; DECISIONS 2026-11-13, the hands
## and the jiggle: "For soft jiggle see if you can emulate the following free open source plugins style": JiggleBones).
## A character baked by the Animator carries up to nine extra bones its flesh hangs from (soft_bust_l, soft_belly,
## soft_seat_r, soft_hip_l, soft_thigh_r...) and, in each of its clips, how they swing in that clip. What a clip can't
## know is what the game does with her: that she stops, turns, is shoved, blends into another clip, or plays a clip of
## your own that has no soft tracks at all. HSSoftJiggle swings the same bones as the game runs, each as a jiggle bone:
##
## JiggleBones' way (the asset library's 1595: BauxiteDev, Cory Petkovsek, Yael Atletl; MIT), written again here and in
## the Animator (tools/animator/core/soft.js: the same steps, so what's baked and what's live are one look). The bone
## is a rod from where the flesh is rooted (the bone's joint) to where its weight is. The weight is a point in the
## world that keeps going as it was going, is pulled each tick toward where the rod points at rest (times
## `stiffness`), loses a share of its speed (`damping`), and is put back at the rod's length from the joint; the bone
## is turned to point at it. Sixty ticks a second, as the plugin steps in the physics tick, whatever the frame rate.
## On top, what flesh needs and a tail doesn't: where it rests follows which way is down (lying, bent over), how much
## of the swing shows comes from her body's measures (the bake's record on her skin's node), and it has a limit.
##
## It's a SkeletonModifier3D under her skeleton: it runs after her animation each frame and takes over the soft bones'
## turn (a clip's own swing for them is left out: no doubling), leaving their shift (thighs squashed where they meet,
## a seat pressed flat: the clip's). HSJiggle puts one on every skeleton that has soft bones (`HSJiggle.attach`, which
## HSEye.wear, HSCharacterLook and the starter kit's Motion node call); without it she still has what her clips carry.
class_name HSSoftJiggle
extends SkeletonModifier3D

const TICK := 1.0 / 60.0                           # the plugin's step: Godot's physics tick
const DEFAULTS := {"length": 0.08, "stiffness": 0.55, "damping": 2.0, "gravity": 0.4, "gain": 1.0, "limit": 0.45}

@export_range(0.0, 2.0) var amount: float = 1.0    ## how much of the swing shows: 0 holds them still, 1 as her bake has it, 2 twice that
@export_range(0.1, 4.0) var stiffness: float = 1.0 ## times each bone's own stiffness (JiggleBones': low for big, sluggish parts, high for springy ones)
@export_range(0.0, 4.0) var damping: float = 1.0   ## times each bone's own damping (JiggleBones': low keeps it ringing, high stops it at once)
@export var use_gravity := true                    ## where the flesh rests follows which way is down (lying down, bent over)
@export var prefix: String = "soft_"               ## the bones it swings: every bone whose name starts so
var bones: Array = []                              # [{idx, parent, name, origin, rest, axis, down, length, stiffness, damping, gravity, gain, limit, x, xp, joint, tj, tjp (the joint at the last tick and the one before), ready}]
var clock := 0.0
var ticks_run := 0                                 # how many ticks so far (for the checks)


## the bones' numbers: from the bake's record (hsMotion.soft, each {bone, axis, length, stiffness, damping, gravity,
## gain, limit}) where it names the bone, else made up from the bone's own place. Call again after the skeleton changes.
func setup(record: Dictionary = {}) -> void:
	bones.clear()
	var sk := get_skeleton()
	if sk == null:
		return
	var by_name := {}
	for item in record.get("soft", []):
		if item is Dictionary and item.has("bone"):
			by_name[String(item["bone"])] = item
	for i in sk.get_bone_count():
		var nm := sk.get_bone_name(i)
		var p := sk.get_bone_parent(i)
		if not nm.begins_with(prefix) or p < 0:
			continue
		var info: Dictionary = by_name.get(nm, {})
		var inv := sk.get_bone_global_rest(p).basis.orthonormalized().inverse()    # the model's directions as the parent's own
		var axis := Vector3(0, -0.4, 0.9)                                         # (no record: a rod forward and a little down, or the way the bone lies from its parent)
		if info.get("axis") is Array and (info["axis"] as Array).size() == 3:
			axis = Vector3(info["axis"][0], info["axis"][1], info["axis"][2])
		elif nm.contains("seat"):
			axis = Vector3(0, -0.6, -0.8)
		elif nm.contains("hip") or nm.contains("thigh"):
			axis = Vector3(1.0 if nm.ends_with("_l") == nm.contains("hip") else -1.0, -0.5, 0)
		bones.append({"idx": i, "parent": p, "name": nm, "origin": sk.get_bone_rest(i).origin, "rest": sk.get_bone_rest(i).basis.orthonormalized().get_rotation_quaternion(),
			"axis": (inv * axis).normalized(), "down": (inv * Vector3.DOWN).normalized(),
			"length": float(info.get("length", DEFAULTS["length"])), "stiffness": float(info.get("stiffness", DEFAULTS["stiffness"])), "damping": float(info.get("damping", DEFAULTS["damping"])),
			"gravity": float(info.get("gravity", DEFAULTS["gravity"])), "gain": float(info.get("gain", DEFAULTS["gain"])), "limit": float(info.get("limit", DEFAULTS["limit"])),
			"x": Vector3.ZERO, "xp": Vector3.ZERO, "joint": Vector3.ZERO, "tj": Vector3.ZERO, "tjp": Vector3.ZERO, "ready": false})


## back to rest at once (after a teleport: a weight left behind across the level swings its bone to its limit)
func reset() -> void:
	clock = 0.0
	for b in bones:
		b["ready"] = false


func _skeleton_changed(_old: Skeleton3D, _new: Skeleton3D) -> void:
	bones.clear()


## which way a bone rests: along its own direction as its parent carries it, tipped by how far down has moved against
## the body since it stood (soft.js pullOf)
static func pull_of(rest_w: Vector3, down_body: Vector3, grav: float) -> Vector3:
	return (rest_w + grav * (Vector3.DOWN - down_body)).normalized()


## one tick of a jiggle bone's weight (soft.js jiggleTick): [x, xp] stepped: the point now and a tick ago. `was`: where
## the joint was a tick ago. One thing is not the plugin's: `damping` slows the weight's speed against its joint's, not
## against the world's (flesh is held by the body it's on, not by the air: on a rod of a few centimetres a drag against
## the world would lean every soft bone back at walking pace). With the joint still it's the plugin's rule exactly.
static func tick(x: Vector3, xp: Vector3, joint: Vector3, pull: Vector3, length: float, stiff: float, damp: float, was: Vector3 = Vector3.INF) -> Array:
	var k := maxf(0.0, 1.0 - damp * TICK)
	var nx := x + ((x - xp) + pull * (9.81 * stiff * length * TICK)) * k       # (times length: `stiffness` then means what it means on the plugin's rod of one unit)
	if was != Vector3.INF:
		nx += (joint - was) * (1.0 - k)
	var d := nx - joint
	var l := d.length()
	return [joint + d * (length / l) if l > 1e-9 else joint + pull * length, x]


## how a jiggle bone rings: {f (Hz), half (s: the time it takes to lose half its swing)}: the plugin's rule solved (soft.js ringOf)
static func ring_of(stiff: float, damp: float) -> Dictionary:
	var c := 1.0 / (1.0 + 9.81 * stiff * TICK)
	var k := maxf(0.0, 1.0 - damp * TICK)
	var r := sqrt(c * k)
	var co := c * (1.0 + k) / (2.0 * r) if r > 0.0 else 2.0
	if co >= 1.0:
		var m := c * (1.0 + k) / 2.0
		return {"f": 0.0, "half": log(0.5) / log(m + sqrt(maxf(0.0, m * m - c * k))) * TICK}
	return {"f": acos(co) / (TAU * TICK), "half": log(0.5) / log(r) * TICK}


func _process_modification_with_delta(delta: float) -> void:
	var sk := get_skeleton()
	if sk == null or bones.is_empty():
		return
	if delta > 0.25:                                   # a long stall: don't run after it
		reset()
	clock += delta
	var n := int(clock / TICK)
	clock -= n * TICK
	n = mini(n, 6)
	ticks_run += n
	var world := sk.global_transform
	var size := world.basis.get_scale().x              # (a skeleton scaled as a whole: the rods with it)
	for b in bones:
		var pg: Transform3D = world * sk.get_bone_global_pose(b["parent"])
		var pq := pg.basis.orthonormalized().get_rotation_quaternion()
		var joint: Vector3 = pg * (b["origin"] as Vector3)                       # (where the bone is at rest on its parent: a clip's shift of it is not part of the swing)
		var rest_w: Vector3 = (pq * (b["axis"] as Vector3)).normalized()
		var pull := pull_of(rest_w, pq * (b["down"] as Vector3), b["gravity"]) if use_gravity else rest_w
		var length: float = b["length"] * size
		if not b["ready"] or joint.distance_to(b["joint"]) > 0.6 * maxf(size, 0.01):   # the first frame, or she was put somewhere else: at rest there
			b["x"] = joint + pull * length
			b["xp"] = b["x"]
			b["ready"] = true
			b["tj"] = joint
			b["tjp"] = joint
		elif n > 0:
			var j0: Vector3 = b["tj"]
			for t in n:                                    # (several ticks in a slow frame: the joint brought along evenly from where it was at the last tick)
				var jt := j0.lerp(joint, float(t + 1) / n)
				var s: Array = tick(b["x"], b["xp"], jt, pull, length, b["stiffness"] * stiffness, b["damping"] * damping, b["tj"])
				b["x"] = s[0]
				b["xp"] = s[1]
				b["tjp"] = b["tj"]
				b["tj"] = jt
		b["joint"] = joint
		# The bone turned to point at its weight, as much of it as shows. Between ticks: the weight as it stood from
		# its joint at each of the last two, by how far into the next this frame is. (From the joint as it was then,
		# not as it is now: at a run the joint has gone 5 cm on since the tick, most of a rod's length.)
		var to: Vector3 = ((b["xp"] as Vector3) - (b["tjp"] as Vector3)).lerp((b["x"] as Vector3) - (b["tj"] as Vector3), clampf(clock / TICK, 0.0, 1.0)).normalized()
		var ax := rest_w.cross(to)
		var sn := ax.length()
		var lim: float = b["limit"] * maxf(amount, 0.001)
		var show := lim * tanh(b["gain"] * amount * atan2(sn, rest_w.dot(to)) / lim)
		if sn < 1e-9 or show < 1e-7:
			sk.set_bone_pose_rotation(b["idx"], b["rest"])
		else:
			sk.set_bone_pose_rotation(b["idx"], pq.inverse() * Quaternion(ax / sn, show) * pq * (b["rest"] as Quaternion))


## each bone as it is now: [{name, degrees (its swing from rest), f, half}]
func report() -> Array:
	var out := []
	var sk := get_skeleton()
	for b in bones:
		var ring := ring_of(b["stiffness"] * stiffness, b["damping"] * damping)
		var deg := 0.0
		if sk != null:
			deg = rad_to_deg(sk.get_bone_pose_rotation(b["idx"]).angle_to(b["rest"]))
		out.append({"name": b["name"], "degrees": deg, "f": ring["f"], "half": ring["half"], "length": b["length"], "gain": b["gain"]})
	return out
