# GDLIBRARY's script (tools/godot/library_check.py): a Character Studio export wearing library garments, in Godot.
# Its skin and its clothes are skinned to one skeleton; the body is put through poses (a stride, sitting, bent forward,
# arms raised, a twist) and in each the skin left in the file is looked for through the clothes: every skin point is
# skinned by hand as Godot skins it, and a ray from just under it 8 mm into the body is cast at the clothes as they
# are in that pose. A hit is skin standing through cloth. With --out, a picture of each pose from the front and the side.
#   godot --path <project> -s res://library_test.gd -- --glb=<file> [--out=<dir>]
extends SceneTree

var glb := ""
var out_dir := ""
var DEPTH := 0.008     # how far under a skin point cloth counts as stood through (deeper would find a shoe's sole under a toe)
const POSES := {
	"rest": [],
	"stride": [["l_upleg", "x", -35.0], ["l_lowleg", "x", 30.0], ["r_upleg", "x", 25.0], ["r_lowleg", "x", 10.0], ["l_uparm", "x", 25.0], ["r_uparm", "x", -25.0]],
	"sit": [["l_upleg", "x", -80.0], ["r_upleg", "x", -80.0], ["l_lowleg", "x", 80.0], ["r_lowleg", "x", 80.0]],
	"bend": [["c_spine1", "x", 20.0], ["c_spine2", "x", 15.0]],
	"arms_up": [["l_uparm", "z", 55.0], ["r_uparm", "z", -55.0]],
	"twist": [["c_spine2", "y", 30.0]],
}


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--glb="):
			glb = a.substr(6)
		elif a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--depth="):
			DEPTH = float(a.substr(8))
	run.call_deferred()


func skinned(mi: MeshInstance3D, sk: Skeleton3D) -> Dictionary:
	# {P: the points as the skeleton has them now, T: triangles}: linear blend skinning, as the engine's
	var P := PackedVector3Array()
	var T := PackedInt32Array()
	var skin := mi.skin
	var M: Array[Transform3D] = []
	for i in skin.get_bind_count():
		var b := skin.get_bind_bone(i)
		if b < 0:
			b = sk.find_bone(skin.get_bind_name(i))
		M.append(sk.get_bone_global_pose(b) * skin.get_bind_pose(i))
	for s in mi.mesh.get_surface_count():
		var arr := mi.mesh.surface_get_arrays(s)
		var V: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var B: PackedInt32Array = arr[Mesh.ARRAY_BONES]
		var W: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
		var per := B.size() / V.size()
		var base := P.size()
		for v in V.size():
			var p := Vector3.ZERO
			for k in per:
				var w := W[v * per + k]
				if w > 0.0:
					p += w * (M[B[v * per + k]] * V[v])
			P.append(p)
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		for i in idx:
			T.append(base + i)
	return {"P": P, "T": T}


func pose(sk: Skeleton3D, moves: Array) -> void:
	sk.reset_bone_poses()
	for m in moves:
		var b := sk.find_bone(m[0])
		if b < 0:
			continue
		var g := sk.get_bone_global_pose(b)
		var axis := Vector3.RIGHT if m[1] == "x" else (Vector3.UP if m[1] == "y" else Vector3.BACK)
		sk.set_bone_global_pose(b, Transform3D(Basis(axis, deg_to_rad(m[2])) * g.basis, g.origin))


func run() -> void:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(glb, st) != OK:
		print("GDLIBRARY FAIL: couldn't read ", glb)
		quit(1)
		return
	var who := doc.generate_scene(st) as Node3D
	root.add_child(who)
	var sk: Skeleton3D = null
	for s in who.find_children("*", "Skeleton3D", true, false):
		sk = s
	var skin_mesh: MeshInstance3D = null
	var clothes: Array[MeshInstance3D] = []
	for m in who.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		if mi.skin == null:
			continue
		if String(mi.name).ends_with("_skin"):
			skin_mesh = mi
		elif String(mi.name).begins_with("lib"):
			clothes.append(mi)
	var rep := {"skeleton": sk != null, "skin": skin_mesh != null, "clothes": clothes.map(func(c): return String(c.name)), "poses": {}}
	if sk == null or skin_mesh == null or clothes.is_empty():
		print("GDLIBRARY ", JSON.stringify(rep))
		quit(1)
		return
	var cam: Camera3D = null
	if out_dir != "":
		var env := WorldEnvironment.new()
		env.environment = Environment.new()
		env.environment.background_mode = Environment.BG_COLOR
		env.environment.background_color = Color(0.13, 0.13, 0.15)
		env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.environment.ambient_light_color = Color(0.6, 0.6, 0.65)
		env.environment.ambient_light_energy = 0.6
		root.add_child(env)
		var sun := DirectionalLight3D.new()
		sun.rotation_degrees = Vector3(-35, 30, 0)
		sun.light_energy = 1.6
		root.add_child(sun)
		cam = Camera3D.new()
		cam.fov = 30
		root.add_child(cam)
		root.size = Vector2i(560, 900)
	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	body.add_child(shape)
	root.add_child(body)
	var rest := {}
	for name in POSES:
		pose(sk, POSES[name])
		for i in 2:
			await process_frame
		var S := skinned(skin_mesh, sk)
		var faces := PackedVector3Array()
		var moved := 0.0
		for c in clothes:
			var C := skinned(c, sk)
			for i in C.T:
				faces.append(C.P[i])
			if name == "rest":
				rest[c.name] = C.P
			else:
				for i in C.P.size():
					moved = maxf(moved, C.P[i].distance_to(rest[c.name][i]))
		var tm := ConcavePolygonShape3D.new()
		tm.backface_collision = true
		tm.set_faces(faces)
		shape.shape = tm
		for i in 3:
			await physics_frame
		# the skin's own outward directions in this pose
		var P: PackedVector3Array = S.P
		var T: PackedInt32Array = S.T
		var N := PackedVector3Array()
		N.resize(P.size())
		for t in range(0, T.size(), 3):
			var n := (P[T[t + 2]] - P[T[t]]).cross(P[T[t + 1]] - P[T[t]])   # outward: Godot's triangles face you clockwise
			for k in 3:
				N[T[t + k]] += n
		var space := root.get_world_3d().direct_space_state
		var through := 0
		var worst := 0.0
		for i in P.size():
			var n := N[i].normalized()
			if n == Vector3.ZERO:
				continue
			# from just outside the skin point into the body (a long ray: Godot's physics misses cloth on a ray of a few millimetres): cloth within DEPTH under the point is cloth the skin stands through
			var q := PhysicsRayQueryParameters3D.create(P[i] + n * 0.0005, P[i] - n * 0.03)
			var hit := space.intersect_ray(q)
			if not hit.is_empty() and (P[i] - hit.position).dot(n) > 0.0003 and P[i].distance_to(hit.position) <= DEPTH:
				through += 1
				worst = maxf(worst, P[i].distance_to(hit.position))
		rep.poses[name] = {"skin_points": P.size(), "skin_triangles": T.size() / 3, "cloth_triangles": faces.size() / 3, "through": through, "deepest_mm": snappedf(worst * 1000.0, 0.1), "clothes_moved_m": snappedf(moved, 0.001)}
		if cam != null:
			for view in [["front", 0.0], ["side", 90.0]]:
				var a := deg_to_rad(view[1])
				cam.position = Vector3(sin(a) * 3.6, 0.9, cos(a) * 3.6)
				cam.look_at(Vector3(0, 0.85, 0))
				for i in 3:
					await process_frame
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png(out_dir.path_join("%s_%s.png" % [name, view[0]]))
	print("GDLIBRARY ", JSON.stringify(rep))
	quit(0)
