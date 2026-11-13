## HSSoftJiggle (docs/GODOT_LOOK.md §5w; tools/godot/jiggle_check.py runs it after the chains': JIGGLE). A skeleton made
## here as the Animator leaves a baked character's: a pelvis, a chest, and three soft bones under them (a breast and a
## buttock with the bake's record of them on a mesh's extras, and one the record doesn't name), HSJiggle put on it as a
## game puts it on. Then, a stage at a time at 60 frames a second:
##   made      one HSSoftJiggle on the skeleton, a bone for each soft bone, the record's numbers read, the third's made up;
##             its tick the Animator's (tools/animator/core/soft.js: the same weight after 10, 20 and 30 ticks)
##   rest      standing still, every soft bone as it rests
##   ring      the breast's weight let go from 20 degrees off: it rings at the rate and loses its swing in the time
##             JiggleBones' rule gives for its stiffness and damping
##   jerk      the body shoved 15 cm sideways in three frames: the weight stays behind (the bone turns the other way),
##             then swings and settles back
##   turn      turned 40 degrees in a tenth of a second: it lags again
##   steady    carried along evenly at a run's pace: once going, no bone leans (its damping is against the body, not the air)
##   gravity   laid on her back: where it rests has leaned the way down has gone against her body; gravity off, it rests as stood
##   off       at amount 0 the same shove moves nothing
##   clip      an animation that turns and shifts the soft bone itself: the turn is left out (the live swing takes its
##             place), the shift kept; the modifier switched off, the clip's turn shows
##   teleport  put 5 m away in one frame: no swing
##   godot --headless --fixed-fps 60 --path PROJECT -s res://addons/horrorstudio_look/demo/soft_jiggle.gd -- --out=DIR
extends SceneTree

const BUST := {"bone": "soft_bust_l", "parent": "c_spine3", "amount": 0.7, "axis": [0.0, -0.4711, 0.8821], "length": 0.074, "stiffness": 0.5567, "damping": 2.0, "gravity": 0.5, "gain": 1.0, "limit": 3.0}
const SEAT := {"bone": "soft_seat_l", "parent": "root", "amount": 1.0, "axis": [0.16, -0.6, -0.78], "length": 0.11, "stiffness": 0.95, "damping": 6.0, "gravity": 0.3, "gain": 1.0, "limit": 0.33}

var out_dir := "res://"
var report := {}
var who: Node3D
var sk: Skeleton3D
var jig: HSJiggle
var sj: HSSoftJiggle
var ap: AnimationPlayer
var frame := 0
var stage := "made"
var t0 := 0
var idx := {}                     # a soft bone's name -> its bone
var ang := {}                     # each soft bone's turn from rest this frame, degrees
var dirs := {}                    # where each one's rod points this frame, in the world
var most := {}
var trace: Array = []


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
	who = Node3D.new()
	who.name = "who"
	root.add_child(who)
	sk = Skeleton3D.new()
	sk.name = "Skeleton3D"
	who.add_child(sk)
	var bone := func(nm: String, parent: int, at: Vector3) -> int:
		var b := sk.add_bone(nm)
		sk.set_bone_parent(b, parent)
		sk.set_bone_rest(b, Transform3D(Basis(), at))
		sk.set_bone_pose_position(b, at)
		return b
	var world := bone.call("body_world", -1, Vector3.ZERO)
	var pelvis := bone.call("root", world, Vector3(0, 0.9, 0))
	var chest := bone.call("c_spine3", pelvis, Vector3(0, 0.4, 0))
	idx["soft_bust_l"] = bone.call("soft_bust_l", chest, Vector3(0.08, -0.02, 0.03))
	idx["soft_seat_l"] = bone.call("soft_seat_l", pelvis, Vector3(0.08, 0.0, -0.05))
	idx["soft_other"] = bone.call("soft_other", pelvis, Vector3(0, 0.1, 0.06))      # (not in the record: its numbers are made up)
	var mi := MeshInstance3D.new()                                                   # the skin's node, with the bake's record as a glb's extras arrive
	mi.name = "who_skin"
	mi.set_meta("extras", {"hsMotion": {"version": 2, "soft": [BUST, SEAT]}})
	who.add_child(mi)
	jig = HSJiggle.attach(who)
	sk.skeleton_updated.connect(_seen)


func rod(nm: String) -> Vector3:                        # a soft bone's rod at rest, in the model's space
	for b in sj.bones if sj != null else []:
		if b["name"] == nm:
			return sk.get_bone_global_rest(b["parent"]).basis * (b["axis"] as Vector3)
	return Vector3.FORWARD


func _seen() -> void:                                   # after the modifiers: each soft bone's turn, and where its rod points
	for nm in idx:
		var q := sk.get_bone_pose_rotation(idx[nm])
		ang[nm] = rad_to_deg(q.angle_to(Quaternion.IDENTITY))
		dirs[nm] = (sk.global_transform.basis * sk.get_bone_global_pose(idx[nm]).basis * rod(nm)).normalized()


func next(s: String) -> void:
	stage = s
	t0 = frame
	most.clear()
	trace.clear()


func state(nm: String) -> Dictionary:
	for b in sj.bones:
		if b["name"] == nm:
			return b
	return {}


func signed(nm: String) -> float:                       # a rod's turn from rest about the body's own side-to-side axis, degrees
	var r: Vector3 = (sk.global_transform.basis * rod(nm)).normalized()
	var d: Vector3 = dirs.get(nm, r)
	var x: Vector3 = (sk.global_transform.basis * Vector3.RIGHT).normalized()
	return rad_to_deg(atan2(r.cross(d).dot(x), r.dot(d)))


func _process(_delta: float) -> bool:
	frame += 1
	if frame > 3000 or (jig == null and frame > 4):   # (never left hanging: a script that didn't compile, a stage that never ends)
		print("SOFTJIGGLE FAIL: stopped at stage " + stage)
		quit(1)
		return true
	var f := frame - t0
	for nm in idx:
		most[nm] = maxf(most.get(nm, 0.0), ang.get(nm, 0.0))
	match stage:
		"made":
			if f == 8:
				sj = sk.get_node_or_null("HSSoftJiggle") as HSSoftJiggle
				if sj == null:
					print("SOFTJIGGLE FAIL: no HSSoftJiggle on the skeleton")
					quit(1)
					return true
				# the Animator's own tick: a weight let go 0.3 rad off, a still joint, 30 ticks (soft.js gives -0.154851, 0.074595, -0.032468)
				var rest := Vector3(0, -0.47, 0.88).normalized()
				var x := Basis(Vector3.RIGHT, 0.3) * rest * 0.074
				var xp := x
				var at := []
				for t in range(1, 31):
					var s: Array = HSSoftJiggle.tick(x, xp, Vector3.ZERO, rest, 0.074, 0.5567, 2.0)
					x = s[0]
					xp = s[1]
					if t % 10 == 0:
						var d: Vector3 = x.normalized()
						at.append(atan2(rest.cross(d).dot(Vector3.RIGHT), rest.dot(d)))
				report["made"] = {"modifiers": jig.softs.size(), "bones": sj.report(), "ticks": at, "plugin": HSSoftJiggle.ring_of(1.0, 0.0)}
				next("rest")
		"rest":
			if f == 30:
				report["rest"] = {"most": most.values().max()}
				next("ring")
		"ring":
			if f == 1:                                        # the breast's weight put 20 degrees off, the body still
				var b := state("soft_bust_l")
				var r: Vector3 = ((b["x"] as Vector3) - (b["joint"] as Vector3))
				b["x"] = (b["joint"] as Vector3) + Basis(Vector3.RIGHT, deg_to_rad(20.0)) * r
				b["xp"] = b["x"]
			elif f >= 3:
				trace.append(signed("soft_bust_l"))
			if f == 150:
				var cross := []                                  # where it crosses rest: its rate; its peaks: how fast it dies
				var peaks := []
				for i in range(1, trace.size()):
					if (trace[i - 1] < 0.0) != (trace[i] < 0.0):
						cross.append(i - 1 + absf(trace[i - 1]) / maxf(1e-9, absf(trace[i - 1]) + absf(trace[i])))
				for i in range(1, trace.size() - 1):
					if absf(trace[i]) > absf(trace[i - 1]) and absf(trace[i]) >= absf(trace[i + 1]) and absf(trace[i]) > 0.02:
						peaks.append([i, absf(trace[i])])
				var hz := 0.0
				if cross.size() >= 3:
					hz = 60.0 * (cross.size() - 1) / (2.0 * (cross[-1] - cross[0]))
				var half := 0.0
				if peaks.size() >= 3:
					half = (peaks[-1][0] - peaks[0][0]) / 60.0 * log(0.5) / log(peaks[-1][1] / peaks[0][1])
				report["ring"] = {"first": trace[0], "hz": hz, "half": half, "crossings": cross.size(), "peaks": peaks.size(), "want": HSSoftJiggle.ring_of(BUST["stiffness"], BUST["damping"]), "end": absf(trace[-1])}
				next("jerk")
		"jerk":
			if f >= 1 and f <= 3:
				who.position.x += 0.05
			if f == 1:
				report["jerk"] = {"lag": 0.0}
			if f >= 2 and f <= 12:                             # the weight stays behind: its rod leans against the shove
				report["jerk"]["lag"] = minf(report["jerk"]["lag"], (dirs["soft_bust_l"] as Vector3).x - rod("soft_bust_l").x)
			if f == 160:
				report["jerk"]["most"] = most["soft_bust_l"]
				report["jerk"]["seat"] = most["soft_seat_l"]
				report["jerk"]["other"] = most["soft_other"]
				report["jerk"]["settled"] = ang["soft_bust_l"]
				next("turn")
		"turn":
			if f >= 1 and f <= 6:
				who.rotation.y += deg_to_rad(40.0 / 6.0)
			if f == 130:
				report["turn"] = {"most": most["soft_bust_l"], "settled": ang["soft_bust_l"]}
				who.rotation = Vector3.ZERO
				next("steady")
		"steady":                                             # carried along at a run's pace, evenly: once it's going, nothing leans
			if f >= 1:
				who.position.z += 3.2 / 60.0
			if f == 150:                                     # (the start's own swing has died by now)
				most.clear()
			if f == 240:
				report["steady"] = {"most": most.values().max()}
				next("gravity")
		"gravity":
			if f == 1:
				who.rotation.x = deg_to_rad(-90.0)             # on her back: her front to the ceiling
			if f == 100:
				var as_stood: Vector3 = (sk.global_transform.basis * rod("soft_bust_l")).normalized()
				var moved: Vector3 = (Vector3.DOWN - sk.global_transform.basis * Vector3.DOWN).normalized()      # which way down has gone against her body (a rod can't shorten: it leans that way)
				report["gravity"] = {"angle": ang["soft_bust_l"], "lean": ((dirs["soft_bust_l"] as Vector3) - as_stood).dot(moved)}
				sj.use_gravity = false
			if f == 200:
				report["gravity"]["off"] = ang["soft_bust_l"]
				sj.use_gravity = true
				who.rotation = Vector3.ZERO
				next("off")
		"off":
			if f == 20:
				jig.set_amount(0.0)
				most.clear()
			if f >= 30 and f <= 32:
				who.position.x += 0.05
			if f == 30:
				sj = jig.softs[0] if not jig.softs.is_empty() else null
				most.clear()
			if f == 80:
				report["off"] = {"most": most.values().max(), "modifiers": jig.softs.size()}
				jig.set_amount(1.0)
			if f == 90:
				sj = jig.softs[0]
				next("clip")
		"clip":
			if f == 1:                                        # an animation of the soft bone itself: turned 30 degrees and shifted a centimetre
				var an := Animation.new()
				an.length = 1.0
				an.loop_mode = Animation.LOOP_LINEAR
				var tr := an.add_track(Animation.TYPE_ROTATION_3D)
				an.track_set_path(tr, NodePath("Skeleton3D:soft_bust_l"))
				an.rotation_track_insert_key(tr, 0.0, Quaternion(Vector3.RIGHT, deg_to_rad(30.0)))
				an.rotation_track_insert_key(tr, 1.0, Quaternion(Vector3.RIGHT, deg_to_rad(30.0)))
				var tp := an.add_track(Animation.TYPE_POSITION_3D)
				an.track_set_path(tp, NodePath("Skeleton3D:soft_bust_l"))
				an.position_track_insert_key(tp, 0.0, Vector3(0.08, -0.01, 0.03))
				an.position_track_insert_key(tp, 1.0, Vector3(0.08, -0.01, 0.03))
				var lib := AnimationLibrary.new()
				lib.add_animation("held", an)
				ap = AnimationPlayer.new()
				ap.name = "AnimationPlayer"
				who.add_child(ap)
				ap.add_animation_library("", lib)
				ap.play("held")
			if f == 60:
				report["clip"] = {"angle": ang["soft_bust_l"], "shift": sk.get_bone_pose_position(idx["soft_bust_l"]).y - (-0.02)}
				sj.active = false
			if f == 90:
				report["clip"]["without"] = ang["soft_bust_l"]
				sj.active = true
				ap.stop()
				sk.reset_bone_poses()
				next("teleport")
		"teleport":
			if f == 20:
				most.clear()
				who.position.x += 5.0
			if f == 40:
				report["teleport"] = {"most": most.values().max()}
				return done()
	return false


func done() -> bool:
	var f := FileAccess.open(out_dir.path_join("soft_jiggle.json"), FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(report, "  "))
		f.close()
	print("SOFTJIGGLE " + JSON.stringify(report))
	quit(0)
	return true
