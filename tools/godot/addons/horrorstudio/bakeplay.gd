## A scene as the desk recorded it (docs/UNREAL_FLOW.md §1b; the bake, `game/previs/`): the camera, each cast member's
## body (a skinned mesh posed from the bake's skinning matrices, or the desk's figure of cylinders from its joints),
## the black and the lights' flicker, frame by frame at the bake's fps. The scene player drives it by time: it
## computes nothing of its own, so what plays is what the desk worked out. The faces (MHR's 72 shapes) wait on a body
## with morph targets (the exported body has none yet).
extends RefCounted

var game
var index: Dictionary = {}            # previs/index.json
var sid: String = ""
var sc: Dictionary = {}               # the scene's recording: frames, subs, events, lights
var fps: float = 30.0
var bodies: Dictionary = {}           # cid -> {node, skeleton, map: bake bone -> idx, rests: idx -> global rest, parts: [MeshInstance3D] (cylinders)}
var frame_at: int = -1
var frames_shown: int = 0
var recording: String = ""           # the reply branch playing ("" the default: every first answer)
var face_max: float = 0.0            # the strongest face weight set so far (a measure)


static func three(v: Array) -> Vector3:   # the bake's Unreal centimetres (x, y = three z, z = three y) -> metres, y up
	return Vector3(float(v[0]), float(v[2]), float(v[1])) / 100.0


static func three_dir(v: Array) -> Vector3:
	return Vector3(float(v[0]), float(v[2]), float(v[1]))


func _init(game_, index_: Dictionary) -> void:
	game = game_
	index = index_
	fps = float(index.get("fps", 30))


## the scene's recording from its file (key: a reply branch's, "" the default); false when the bake has none for it
func open(sid_: String, key: String = "") -> bool:
	sid = sid_
	var recs: Dictionary = index.get("scenes", {}).get(sid, {}).get("recordings", {})
	var path := "res://game/previs/scenes/%s.json" % sid
	if key != "":
		if not recs.has(key):
			return false
		path = "res://game/previs/scenes/%s__%s.json" % [sid, recs[key]]
	recording = key
	if not FileAccess.file_exists(path):
		return false
	var d = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (d is Dictionary) or (d.get("frames", []) as Array).is_empty():
		return false
	sc = d
	frame_at = -1
	frames_shown = 0
	return true


func total() -> float:
	return float(sc.get("total", 0.0))


func frame_of(t: float) -> int:
	var n: int = (sc["frames"] as Array).size()
	return clampi(int(round(t * fps)), 0, n - 1)


## the cast's bodies for this scene: a skinned body where the bake carries one, else the figure of cylinders
func make_bodies(world: Node3D) -> void:
	clear_bodies()
	for cid in sc.get("cast", []):
		var b := {"node": null, "skeleton": null, "map": {}, "rests": {}, "parts": [], "joints": index.get("joints", [])}
		var skinned: bool = index.get("bodies", {}).has(cid)
		if skinned:
			var file: String = index["bodies"][cid]["file"]
			var ps = game.body_scene(cid, file)
			if ps != null:
				var n: Node3D = ps.instantiate()
				n.name = "baked_" + cid
				world.add_child(n)
				var sk: Skeleton3D = null
				for c in n.find_children("*", "Skeleton3D", true, false):
					sk = c
				if sk != null:
					b["node"] = n
					b["skeleton"] = sk
					var shapes: Array = index.get("face_shapes", [])      # the face: the bake's 72 weights onto the glb's morph targets
					for mi in n.find_children("*", "MeshInstance3D", true, false):
						if mi.mesh != null and mi.mesh.get_blend_shape_count() > 0:
							b["face_mesh"] = mi
							b["face_idx"] = []
							for nm in shapes:
								b["face_idx"].append(mi.find_blend_shape_by_name(str(nm)))
							break
					var names: Array = index["bodies"][cid]["bones"]
					for i in names.size():
						var bi := sk.find_bone(str(names[i]))
						if bi >= 0:
							b["map"][i] = bi
							b["rests"][bi] = sk.get_bone_global_rest(bi)
				else:
					n.queue_free()
		if b["node"] == null:
			var n := Node3D.new()
			n.name = "figure_" + cid
			world.add_child(n)
			b["node"] = n
			for bone in index.get("bones", []):
				var m := MeshInstance3D.new()
				var cm := CapsuleMesh.new()
				cm.radius = float(bone[2])
				cm.height = 0.2
				m.mesh = cm
				var mat := StandardMaterial3D.new()
				mat.albedo_color = Color(0.79, 0.75, 0.7)
				m.material_override = mat
				n.add_child(m)
				b["parts"].append(m)
		bodies[cid] = b


func clear_bodies() -> void:
	for cid in bodies:
		var n = bodies[cid]["node"]
		if n != null and is_instance_valid(n):
			n.queue_free()
	bodies = {}


## the frame's camera as a transform (the bake's position, forward and up) and its horizontal fov
func camera_of(fi: int) -> Dictionary:
	var c: Array = sc["frames"][fi]["cam"]
	var pos := three(c.slice(0, 3))
	var fwd := three_dir(c.slice(3, 6))
	var up := three_dir(c.slice(6, 9))
	var xf := Transform3D(Basis(), pos)
	if fwd.length() > 1e-6:
		xf = xf.looking_at(pos + fwd, up if abs(up.dot(fwd.normalized())) < 0.99 else Vector3.UP)
	return {"xf": xf, "hfov": float(c[9])}


## the frame onto the bodies, the lights and the black; true when a new frame was shown
func show(fi: int, rt) -> bool:
	if fi == frame_at:
		return false
	frame_at = fi
	frames_shown += 1
	var f: Dictionary = sc["frames"][fi]
	for cid in bodies:
		var b: Dictionary = bodies[cid]
		var there: bool = f.get("bodies", {}).has(cid)
		b["node"].visible = there
		if not there:
			continue
		if b.has("face_mesh"):
			var w = f.get("face", {}).get(cid, null)
			var mi: MeshInstance3D = b["face_mesh"]
			var idx: Array = b["face_idx"]
			for i in idx.size():
				if idx[i] >= 0:
					var v: float = float(w[i]) if (w != null and i < w.size()) else 0.0
					mi.set_blend_shape_value(idx[i], v)
					if v > face_max:
						face_max = v
		if b["skeleton"] != null and f.get("skin", {}).has(cid):
			var m: Array = f["skin"][cid]
			var sk: Skeleton3D = b["skeleton"]
			var k: float = float(index["bodies"][cid].get("skin_lin", 100))
			var G: Dictionary = {}                 # every bone's global pose first (the bake's bone order isn't parents first)
			for i in b["map"]:
				var o: int = i * 12
				if o + 12 > m.size():
					break
				var bi: int = b["map"][i]
				var basis := Basis(Vector3(float(m[o]), float(m[o + 1]), float(m[o + 2])) / k, Vector3(float(m[o + 3]), float(m[o + 4]), float(m[o + 5])) / k, Vector3(float(m[o + 6]), float(m[o + 7]), float(m[o + 8])) / k)
				var skin := Transform3D(basis, Vector3(float(m[o + 9]), float(m[o + 10]), float(m[o + 11])))
				G[bi] = skin * b["rests"][bi]
			for bi in G:                           # then each as a local pose under its parent's new global
				var pi := sk.get_bone_parent(bi)
				var parent: Transform3D = G[pi] if (pi >= 0 and G.has(pi)) else (sk.get_bone_global_rest(pi) if pi >= 0 else Transform3D())
				sk.set_bone_pose(bi, parent.affine_inverse() * G[bi])
		elif b["parts"].size():
			var js: Array = f["bodies"][cid]
			var names: Array = b["joints"]
			var bones: Array = index.get("bones", [])
			for i in b["parts"].size():
				var p: MeshInstance3D = b["parts"][i]
				var a = js[names.find(bones[i][0])] if names.find(bones[i][0]) >= 0 else null
				var c = js[names.find(bones[i][1])] if names.find(bones[i][1]) >= 0 else null
				if a == null or c == null:
					p.visible = false
					continue
				p.visible = true
				var pa := three(a)
				var pc := three(c)
				var d := pc - pa
				var cm: CapsuleMesh = p.mesh
				cm.height = max(0.02, d.length())
				var xf := Transform3D(Basis(), (pa + pc) / 2.0)
				if d.length() > 1e-4:
					xf = xf.looking_at(pc, Vector3.UP if abs(d.normalized().y) < 0.99 else Vector3.RIGHT)
					xf.basis = xf.basis * Basis(Vector3.RIGHT, PI / 2.0)   # a capsule stands along y
				p.transform = xf
	if rt != null:
		rt.scene_light_k.clear()
		for id in sc.get("lights", {}):
			var ks: Array = sc["lights"][id]
			if fi < ks.size():
				rt.scene_light_k[id] = float(ks[fi])
	return true


func black_of(fi: int) -> float:
	return float(sc["frames"][fi].get("black", 0.0))


## a joint's recorded position this frame (the desk's figure: pelvis, head...), or null
func joint_pos(cid: String, joint: String, fi: int = -1) -> Variant:
	var f: Dictionary = sc["frames"][fi if fi >= 0 else max(0, frame_at)]
	var names: Array = index.get("joints", [])
	var j := names.find(joint)
	if j < 0 or not f.get("bodies", {}).has(cid) or f["bodies"][cid][j] == null:
		return null
	return three(f["bodies"][cid][j])


## a skinned body's bone where it is now, or null
func bone_pos(cid: String, bone: String) -> Variant:
	var b = bodies.get(cid)
	if b == null or b["skeleton"] == null:
		return null
	var sk: Skeleton3D = b["skeleton"]
	var bi := sk.find_bone(bone)
	if bi < 0:
		return null
	return sk.global_transform * sk.get_bone_global_pose(bi).origin


func close(rt) -> void:
	clear_bodies()
	if rt != null:
		rt.scene_light_k.clear()
