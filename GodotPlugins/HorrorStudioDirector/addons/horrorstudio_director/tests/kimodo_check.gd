## DIRECTOR's Kimodo part (tools/godot_director.py check): a motion made on Kimodo's own skeleton (SOMA, from
## kimodo/soma77.json: the arms raised and bent, a knee lifted, the spine turned, the head nodded, the hips walking
## forward), written as an .npz the way Kimodo saves one and read back; retargeted onto a SOMA skeleton (every joint
## where the motion put it) and onto the Character Studio's MHR body (res://bodies/MHR.fbx: the limbs pointing the
## way SOMA's do, the hips at its own height); in place (the travel gone, the sway kept); and the sample house sent to
## Kimodo as a stage from where Mari stands. Prints KIMODOCHECK {...}.
extends SceneTree

var rep := {}


func soma_skeleton() -> Skeleton3D:
	var S := HSRetarget.soma()
	var sk := Skeleton3D.new()
	sk.name = "Skeleton3D"
	var names: Array = S["names"]
	for i in names.size():
		sk.add_bone(names[i])
	for i in names.size():
		var p = S["parents"][i]
		var pi: int = names.find(p) if p != null else -1
		if pi >= 0:
			sk.set_bone_parent(i, pi)
		var r: Array = S["rest"][i]
		var pr: Array = S["rest"][pi] if pi >= 0 else [0, 0, 0]
		sk.set_bone_rest(i, Transform3D(Basis(), Vector3(float(r[0]) - float(pr[0]), float(r[1]) - float(pr[1]), float(r[2]) - float(pr[2]))))
	sk.reset_bone_poses()
	return sk


## a frame of the made motion on the skeleton: some bones turned by t (0..1), the hips walked forward
func pose_at(sk: Skeleton3D, t: float) -> void:
	sk.reset_bone_poses()
	var turns := {"LeftArm": Quaternion(Vector3(0, 0, 1), -0.9 * sin(t * PI)), "LeftForeArm": Quaternion(Vector3(0, 1, 0), 1.2 * t),
		"RightArm": Quaternion(Vector3(1, 0, 0), 0.8 * t), "RightForeArm": Quaternion(Vector3(0, 1, 0), -0.6), "LeftLeg": Quaternion(Vector3(1, 0, 0), -0.9 * t),
		"LeftShin": Quaternion(Vector3(1, 0, 0), 1.3 * t), "RightLeg": Quaternion(Vector3(1, 0, 0), 0.3 * sin(t * TAU)), "Spine2": Quaternion(Vector3(0, 1, 0), 0.35 * t),
		"Neck1": Quaternion(Vector3(1, 0, 0), 0.3 * sin(t * PI)), "LeftHand": Quaternion(Vector3(1, 0, 0), 0.6 * t), "Hips": Quaternion(Vector3(0, 1, 0), 0.25 * t)}
	for nm in turns:
		var i := sk.find_bone(nm)
		sk.set_bone_pose_rotation(i, turns[nm])
	var h := sk.find_bone("Hips")
	sk.set_bone_pose_position(h, sk.get_bone_rest(h).origin + Vector3(0.05 * sin(t * TAU * 2.0), -0.04 * t, 1.2 * t))


func positions(sk: Skeleton3D) -> PackedVector3Array:
	sk.force_update_all_bone_transforms()
	var out := PackedVector3Array()
	for i in sk.get_bone_count():
		out.append(sk.get_bone_global_pose(i).origin)
	return out


## the animation's pose at time t put on the skeleton
func apply(anim: Animation, sk: Skeleton3D, t: float) -> void:
	sk.reset_bone_poses()
	for tr in anim.get_track_count():
		var path := str(anim.track_get_path(tr))
		var bone := path.substr(path.rfind(":") + 1)
		var i := sk.find_bone(bone)
		if i < 0:
			continue
		if anim.track_get_type(tr) == Animation.TYPE_ROTATION_3D:
			sk.set_bone_pose_rotation(i, anim.rotation_track_interpolate(tr, t))
		elif anim.track_get_type(tr) == Animation.TYPE_POSITION_3D:
			sk.set_bone_pose_position(i, anim.position_track_interpolate(tr, t))


func _initialize() -> void:
	await process_frame
	var src := Node3D.new()
	src.name = "Source"
	root.add_child(src)
	var ssk := soma_skeleton()
	src.add_child(ssk)
	var frames: Array = []
	var n := 31
	for f in n:
		pose_at(ssk, f / float(n - 1))
		frames.append(positions(ssk))
	# the motion as an .npz, as Kimodo saves one, and back
	var flat := PackedFloat32Array()
	for fr in frames:
		for p in fr:
			flat.append_array([p.x, p.y, p.z])
	var npz_path := ProjectSettings.globalize_path("user://kimodo_check.npz")
	HSNpz.write(npz_path, {"posed_joints": [[n, 77, 3], flat], "foot_contacts": [[n, 4], PackedFloat32Array()]})
	var back := HSNpz.joints(HSNpz.read(npz_path))
	var rt_err := 0.0
	for f in n:
		for j in 77:
			rt_err = max(rt_err, (back[f][j] as Vector3).distance_to(frames[f][j]))
	rep["npz_frames"] = back.size()
	rep["npz_err"] = rt_err
	# onto a SOMA skeleton
	var tgt := Node3D.new()
	tgt.name = "Soma"
	root.add_child(tgt)
	var tsk := soma_skeleton()
	tgt.add_child(tsk)
	rep["family_soma"] = HSRetarget.detect(tsk)
	var anim := HSRetarget.animation(back, tsk, tgt, tgt, {"fps": 30.0})
	var worst := 0.0
	var worst_at := ""
	for f in [0, 10, 20, 30]:
		apply(anim, tsk, f / 30.0)
		var got := positions(tsk)
		for nm in ["Hips", "Head", "LeftHand", "LeftForeArm", "RightHand", "LeftFoot", "RightFoot", "LeftShin", "Chest", "LeftToeBase"]:
			var j := tsk.find_bone(nm)
			var e: float = got[j].distance_to(frames[f][j])
			if e > worst:
				worst = e
				worst_at = "%s@%d" % [nm, f]
	rep["soma_err_cm"] = snappedf(worst * 100.0, 0.01)
	rep["soma_err_at"] = worst_at
	# in place: the hips' travel gone, the sway kept
	var ip := HSRetarget.animation(back, tsk, tgt, tgt, {"fps": 30.0, "in_place": true, "loop": true})
	var ht := -1
	for tr in ip.get_track_count():
		if ip.track_get_type(tr) == Animation.TYPE_POSITION_3D:
			ht = tr
	var z0: float = ip.position_track_interpolate(ht, 0.0).z
	var z1: float = ip.position_track_interpolate(ht, 1.0).z
	rep["in_place_travel"] = snappedf(abs(z1 - z0), 0.001)
	var xs: Array = []
	for k in 31:
		xs.append(ip.position_track_interpolate(ht, k / 30.0).x)
	rep["in_place_sway"] = snappedf(xs.max() - xs.min(), 0.001)
	rep["full_travel"] = snappedf(abs(anim.position_track_interpolate(ht, 1.0).z - anim.position_track_interpolate(ht, 0.0).z), 0.001)
	rep["in_place_loop"] = ip.loop_mode == Animation.LOOP_LINEAR
	# onto MHR (the Character Studio's body)
	if ResourceLoader.exists("res://bodies/MHR.fbx"):
		var mhr: Node3D = (load("res://bodies/MHR.fbx") as PackedScene).instantiate()
		root.add_child(mhr)
		var msk := HSRetarget.skeleton_of(mhr)
		rep["family_mhr"] = HSRetarget.detect(msk)
		var ma := HSRetarget.animation(back, msk, mhr, mhr, {"fps": 30.0})
		var pairs := [["l_uparm", "l_lowarm", "LeftArm", "LeftForeArm"], ["l_lowarm", "l_wrist", "LeftForeArm", "LeftHand"], ["r_uparm", "r_lowarm", "RightArm", "RightForeArm"],
			["l_upleg", "l_lowleg", "LeftLeg", "LeftShin"], ["l_lowleg", "l_foot", "LeftShin", "LeftFoot"], ["r_upleg", "r_lowleg", "RightLeg", "RightShin"]]
		var worst_deg := 0.0
		var hip_ratio := 0.0
		for f in [0, 15, 30]:
			apply(ma, msk, f / 30.0)
			msk.force_update_all_bone_transforms()
			for pr in pairs:
				var a: Vector3 = msk.get_bone_global_pose(msk.find_bone(pr[1])).origin - msk.get_bone_global_pose(msk.find_bone(pr[0])).origin
				var b: Vector3 = frames[f][tsk.find_bone(pr[3])] - frames[f][tsk.find_bone(pr[2])]
				worst_deg = max(worst_deg, rad_to_deg(a.angle_to(b)))
			msk.force_update_all_bone_transforms()
			var hy: float = (mhr.global_transform.affine_inverse() * msk.global_transform * msk.get_bone_global_pose(msk.find_bone("root"))).origin.y
			hip_ratio = hy / frames[f][tsk.find_bone("Hips")].y
		rep["mhr_limb_deg"] = snappedf(worst_deg, 0.01)
		rep["mhr_hip_ratio"] = snappedf(hip_ratio, 0.001)
		rep["mhr_tracks"] = ma.get_track_count()
	# the sample's house as a stage, from where Mari stands
	var dummy := Node.new()
	root.add_child(dummy)
	current_scene = dummy
	var game: Node = (load("res://main.tscn") as PackedScene).instantiate()
	var house: Node = game.get_node("House")
	game.remove_child(house)
	game.free()
	root.add_child(house)
	await process_frame
	var mari: Node3D = house.get_node("Mari")
	var st := HSKimodoStage.make(mari, house)
	rep["stage_boxes"] = st["boxes"].size()
	rep["stage_kinds"] = st["boxes"].map(func(b): return b["kind"]).reduce(func(acc, k): acc[k] = acc.get(k, 0) + 1; return acc, {})
	rep["stage_marks"] = st["marks"].map(func(m): return "%s:%s" % [m["id"], m["kind"]])
	rep["stage_arcs"] = st["arcs"].size()
	rep["stage_scale"] = st["scale"]
	var floor_b = null
	for b in st["boxes"]:
		if b["id"] == "hall__floor":
			floor_b = b
	var s: float = st["scale"]
	rep["stage_floor"] = floor_b["center"] if floor_b != null else null
	rep["stage_floor_ok"] = floor_b != null and abs(floor_b["center"][0] - (-1.5 * s)) < 0.01 and abs(floor_b["center"][1] - (-0.05 * s)) < 0.01 and abs(floor_b["center"][2] - (1.0 * s)) < 0.01
	print("KIMODOCHECK " + JSON.stringify(rep))
	quit()
