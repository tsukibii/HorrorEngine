## GDFACES (tools/godot/faces_check.py runs it): the runtime's face player (face.gd, the story's `expr`) on a Character
## Studio export as a Godot project wears it: the copy with MHR's 72 face shapes baked beside its blink
## (tools/face_morphs.mjs). Read at run time as play.gd reads a cast member's body (GLTFDocument), under a node that
## stands for her, her blinker put on as HSEye.wear does. Measured: the shapes Godot finds on each mesh (the skin's all
## 72, by Meta's names; the brows' and lashes' those that move them) beside the blink's own; each shape a real move
## in the mesh (the jaw's drop, a lip corner's pull, a brow's: how far its furthest point goes); an expression played
## on every mesh that carries its shapes; its eyesClosed handed to the blinker (never set beside it: the blink's
## in-betweens with it) and taken back when it ends; without a blinker, set on the meshes themselves.
##   godot --headless --fixed-fps 60 --path PROJECT -s res://addons/horrorstudio/tests/faces.gd -- --glb=FILE --out=DIR
extends SceneTree

const FaceC := preload("res://addons/horrorstudio/face.gd")
const ClipC := preload("res://addons/horrorstudio/face_clip.gd")
const PLAYED := {"jawDrop": 0.8, "lipCornerPuller_L": 0.6, "lipCornerPuller_R": 0.6, "browLowerer_L": 0.5, "browLowerer_R": 0.5,
	"upperLidRaiser_L": 0.4, "eyesClosed_L": 0.7, "eyesClosed_R": 0.3}


class Rt:
	var cast_nodes := {}


var out_dir := "res://"
var glb := ""
var rep := {}


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		if a.begins_with("--glb="):
			glb = a.substr(6)
	run.call_deferred()


func body() -> Node3D:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(glb, st) != OK:
		return null
	return doc.generate_scene(st) as Node3D


## how far a blend shape moves its furthest point (m), and how many points it moves at all
func reach(mi: MeshInstance3D, shape: int) -> Dictionary:
	var m := mi.mesh as ArrayMesh
	var far := 0.0
	var moved := 0
	for s in m.get_surface_count():
		var base: PackedVector3Array = m.surface_get_arrays(s)[Mesh.ARRAY_VERTEX]
		var bs: Array = m.surface_get_blend_shape_arrays(s)
		if shape >= bs.size():
			continue
		var to: PackedVector3Array = bs[shape][Mesh.ARRAY_VERTEX]
		var rel := m.blend_shape_mode == Mesh.BLEND_SHAPE_MODE_RELATIVE
		for i in mini(base.size(), to.size()):
			var d := to[i].length() if rel else (to[i] - base[i]).length()
			if d > 1e-6:
				moved += 1
				far = maxf(far, d)
	return {"far": far, "moved": moved}


func values(f: Dictionary, names: Array) -> Dictionary:
	var o := {}
	for row in f.get("meshes", []):
		var mi: MeshInstance3D = row[0]
		var idx: Dictionary = row[1]
		var v := {}
		for nm in names:
			if idx.has(nm):
				v[nm] = mi.get_blend_shape_value(idx[nm])
		o[str(mi.name)] = v
	return o


func frames(n: int) -> void:
	for i in n:
		await process_frame


func run() -> void:
	var her := Node3D.new()
	her.name = "her"
	root.add_child(her)
	var t0 := Time.get_ticks_msec()
	var b := body()
	rep["loaded"] = b != null
	rep["load_ms"] = Time.get_ticks_msec() - t0
	rep["file_mb"] = FileAccess.get_file_as_bytes(glb).size() / 1048576.0
	if b == null:
		return finish()
	her.add_child(b)
	var blink := HSBlink.attach(b)                    # as HSEye.wear does for a Studio export
	rep["blinker"] = blink != null
	if blink != null:
		blink.idle = false                            # (no blink of its own while it's measured)
	var f: Dictionary = FaceC.face_of(her)
	var meshes := []
	for row in f.get("meshes", []):
		var mi: MeshInstance3D = row[0]
		var all: Array = []
		for i in (mi.mesh as ArrayMesh).get_blend_shape_count():
			all.append(str((mi.mesh as ArrayMesh).get_blend_shape_name(i)))
		meshes.append({"name": str(mi.name), "shapes": (row[1] as Dictionary).size(), "all": all.size(),
			"blink": all.filter(func(n): return n.begins_with("eyesClosed_")).size(), "verts": (mi.mesh as ArrayMesh).surface_get_array_len(0)})
	rep["meshes"] = meshes
	rep["found_blink"] = f.get("blink") != null and f.get("blink") == blink
	if f.is_empty():
		return finish()
	var skin: MeshInstance3D = f["mesh"]
	var sidx: Dictionary = f["idx"]
	rep["missing"] = FaceC.MHR72.filter(func(n): return not sidx.has(n))
	var far := {}
	for nm in ["jawDrop", "lipCornerPuller_L", "browLowerer_R", "eyesClosed_L", "noseWrinkler_L"]:
		if sidx.has(nm):
			far[nm] = reach(skin, sidx[nm])
	rep["reach"] = far
	var bb := AABB()
	var first := true
	for mi in her.find_children("*", "MeshInstance3D", true, false):
		var a: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		bb = a if first else bb.merge(a)
		first = false
	rep["tall"] = bb.size.y

	# ---- an expression played: on every mesh that carries its shapes; the lids the blinker's
	var clip = ClipC.new()
	clip.id = "_test"
	clip.secs = 1.0
	clip.fps = 30.0
	clip.frames = 30
	clip.shapes = PackedStringArray(PLAYED.keys())
	var w := PackedFloat32Array()
	for i in 30:
		for nm in PLAYED:
			w.append(PLAYED[nm])
	clip.weights = w
	FaceC._clips["_test"] = clip
	var rt := Rt.new()
	rt.cast_nodes["her"] = her
	var face = FaceC.new(rt)
	if blink != null:
		blink.set_process(false)                      # (first without it running: what the player alone sets)
	rep["played"] = face.play("her", her, "_test", {"in": 0.1, "out": 0.1})
	for i in 10:
		face.tick(0.05)
	rep["state"] = face.state("her")
	rep["alone"] = values(f, PLAYED.keys())
	rep["hold"] = [blink.hold.x, blink.hold.y] if blink != null else []
	if blink != null:
		blink.set_process(true)
		await frames(3)
		face.tick(0.01)                               # (the player again after the blinker: it leaves the lids alone)
		rep["with_blink"] = values(f, PLAYED.keys())
		var inb := {}
		for row in blink.shapes:
			var mi: MeshInstance3D = row[0]
			for key in row[1]:
				inb["%s:%s" % [mi.name, (mi.mesh as ArrayMesh).get_blend_shape_name(key[0])]] = mi.get_blend_shape_value(key[0])
		rep["lids_left"] = inb
	for i in 16:                                      # past its end: everything back
		face.tick(0.05)
	await frames(3)
	rep["after"] = values(f, PLAYED.keys())
	rep["hold_after"] = [blink.hold.x, blink.hold.y] if blink != null else []
	rep["state_after"] = face.state("her")

	# ---- a body with no blinker (an older export's copy, the bake's body): the lids set on the meshes themselves
	var her2 := Node3D.new()
	her2.name = "her2"
	root.add_child(her2)
	var b2 := body()
	her2.add_child(b2)
	rt.cast_nodes["her2"] = her2
	face.play("her2", her2, "_test", {"in": 0.1, "out": 0.1})
	for i in 10:
		face.tick(0.05)
	var f2: Dictionary = FaceC.face_of(her2)
	rep["no_blinker"] = {"found": f2.get("blink") != null, "values": values(f2, ["eyesClosed_L", "eyesClosed_R", "jawDrop"]).get(str((f2["mesh"] as MeshInstance3D).name), {})}
	finish()


func finish() -> void:
	var fa := FileAccess.open(out_dir.path_join("faces.json"), FileAccess.WRITE)
	fa.store_string(JSON.stringify(rep, "  "))
	fa.close()
	print("GDFACES {done}")
	quit()
