## HSGrip in the 3D view (docs/ANIMATOR_V3.md §4.1): the handle drawn at its thickness and length, a hand round it
## with its fingers wrapped as they will be (HSHandIK's own wrap, on a hand of ordinary size), where the mouth goes
## and where it hits; four handles to drag (thickness, length, mouth, tip), each undoable. Registered by plugin.gd.
@tool
extends EditorNode3DGizmoPlugin

const NAMES := ["Thickness", "Length", "Mouth", "Tip"]
const PROPS := ["size", "length", "mouth", "tip"]
const PHALANX := [0.037, 0.022, 0.02]               # a first finger's bones on an ordinary hand, metres

var undo: EditorUndoRedoManager


func _init() -> void:
	create_material("handle", Color(1.0, 0.72, 0.3), false, true)
	create_material("hand", Color(0.92, 0.94, 0.97), false, true)
	create_material("mouth", Color(1.0, 0.5, 0.6), false, true)
	create_material("tip", Color(0.55, 0.82, 1.0), false, true)
	create_handle_material("handles")


func _get_gizmo_name() -> String:
	return "HSGrip"


func _has_gizmo(node: Node3D) -> bool:
	return node is HSGrip


static func handle_points(g: HSGrip) -> PackedVector3Array:
	return PackedVector3Array([Vector3(0, -g.length * 0.3, -g.size * 0.5), Vector3(0, g.length * 0.5, 0), g.mouth, g.tip])


# a ring of the handle's radius at a height, as line pairs
static func _ring(out: PackedVector3Array, y: float, r: float, n := 20) -> void:
	for i in n:
		var a := TAU * i / n
		var b := TAU * (i + 1) / n
		out.append(Vector3(cos(a) * r, y, sin(a) * r))
		out.append(Vector3(cos(b) * r, y, sin(b) * r))


static func _strip(out: PackedVector3Array, pts: Array) -> void:
	for i in pts.size() - 1:
		out.append(pts[i])
		out.append(pts[i + 1])


## the hand drawn round the handle: line pairs in the grip's own space (g: 1 a right hand, -1 a left)
static func hand_lines(grip: HSGrip, g := 1.0) -> PackedVector3Array:
	var out := PackedVector3Array()
	var r := grip.size * 0.5
	var pad := HSHandIK.PALM
	var rho := r + HSHandIK.FINGER
	var knuckle := Vector3(g * 0.014, 0, r + pad)   # a knuckle: just past the handle's middle the way the fingers go, the palm's thickness off it
	var ys := [0.032, 0.011, -0.01, -0.03]            # the four fingers along the handle, the first finger nearest the thumb
	var scale := [0.96, 1.0, 0.95, 0.8]
	var firsts := []
	for i in 4:
		var lens := [PHALANX[0] * scale[i], PHALANX[1] * scale[i], PHALANX[2] * scale[i]]
		var k := knuckle + Vector3(0, ys[i], 0)
		var bends: Array = HSHandIK._wrap({"p1": k, "len": lens}, Vector3(g, 0, 0), Vector3(0, 0, -1), Vector3(0, ys[i], 0), rho) if grip.shape != 2 else [0.6, 0.8, 0.45]
		var pts := [k]
		var ang := 0.0
		for j in 3:
			ang += float(bends[j])
			pts.append((pts[-1] as Vector3) + Vector3(g * cos(ang), 0, -sin(ang)) * float(lens[j]))
		_strip(out, pts)
		firsts.append(k)
	var wrist := Vector3(-g * 0.066, 0.0, r + pad + 0.004)
	_strip(out, [firsts[0], wrist + Vector3(0, 0.022, 0), wrist + Vector3(0, -0.02, 0), firsts[3]])
	_strip(out, firsts)
	# the thumb: from the wrist's side, over the handle's top end the other way round
	var t0 := wrist + Vector3(g * 0.018, 0.03, 0)
	_strip(out, [t0, Vector3(-g * 0.012, 0.05, r + pad * 0.6), Vector3(g * 0.012, 0.052, r * 0.3), Vector3(g * (r * 0.8 + 0.006), 0.046, -r * 0.5)])
	return out


func _redraw(gizmo: EditorNode3DGizmo) -> void:
	gizmo.clear()
	var g := gizmo.get_node_3d() as HSGrip
	if g == null:
		return
	var r := g.size * 0.5
	var h := g.length * 0.5
	var lines := PackedVector3Array()
	if g.shape == 1:                                    # a ball: three rings
		_ring(lines, 0.0, r)
		for i in 20:
			var a := TAU * i / 20
			var b := TAU * (i + 1) / 20
			lines.append(Vector3(cos(a) * r, sin(a) * r, 0))
			lines.append(Vector3(cos(b) * r, sin(b) * r, 0))
			lines.append(Vector3(0, sin(a) * r, cos(a) * r))
			lines.append(Vector3(0, sin(b) * r, cos(b) * r))
	else:
		_ring(lines, h, r)
		_ring(lines, -h, r)
		for i in 4:
			var a := TAU * i / 4
			lines.append(Vector3(cos(a) * r, h, sin(a) * r))
			lines.append(Vector3(cos(a) * r, -h, sin(a) * r))
		lines.append(Vector3(0, h, 0))                    # which end the thumb is at
		lines.append(Vector3(0, h + 0.03, 0))
	gizmo.add_lines(lines, get_material("handle", gizmo))
	gizmo.add_lines(hand_lines(g, -1.0 if g.hand == 2 else 1.0), get_material("hand", gizmo))
	if g.use != 0:                                      # where the mouth goes: a small ring facing out, joined to the grip
		var m := PackedVector3Array([Vector3.ZERO, g.mouth])
		for i in 12:
			var a := TAU * i / 12
			var b := TAU * (i + 1) / 12
			m.append(g.mouth + Vector3(cos(a), 0, sin(a)) * 0.012)
			m.append(g.mouth + Vector3(cos(b), 0, sin(b)) * 0.012)
		gizmo.add_lines(m, get_material("mouth", gizmo))
	var t := PackedVector3Array([Vector3(0, h, 0), g.tip])
	for d in [Vector3(0.012, 0, 0.012), Vector3(0.012, 0, -0.012)]:
		t.append(g.tip - d)
		t.append(g.tip + d)
	gizmo.add_lines(t, get_material("tip", gizmo))
	gizmo.add_handles(handle_points(g), get_material("handles", gizmo), [0, 1, 2, 3])


func _get_handle_name(_gizmo: EditorNode3DGizmo, id: int, _secondary: bool) -> String:
	return NAMES[id]


func _get_handle_value(gizmo: EditorNode3DGizmo, id: int, _secondary: bool) -> Variant:
	return gizmo.get_node_3d().get(PROPS[id])


## what a drag to `screen_pos` makes of a handle: the property's new value (the check calls this)
static func dragged(g: HSGrip, id: int, camera: Camera3D, screen_pos: Vector2) -> Variant:
	var inv := g.global_transform.affine_inverse()
	var from := inv * camera.project_ray_origin(screen_pos)
	var dir := (inv.basis * camera.project_ray_normal(screen_pos)).normalized()
	if id <= 1:                                         # along one of the grip's own axes: the point on it nearest the mouse's ray
		var p := Vector3(0, -g.length * 0.3, 0) if id == 0 else Vector3.ZERO
		var ax := Vector3(0, 0, -1) if id == 0 else Vector3(0, 1, 0)
		var w := p - from
		var b := ax.dot(dir)
		var den := 1.0 - b * b
		var s := (b * dir.dot(w) - ax.dot(w)) / den if den > 1e-6 else 0.0
		return clampf(2.0 * absf(s), 0.004, 0.16) if id == 0 else snappedf(clampf(2.0 * absf(s), 0.02, 0.8), 0.005)
	var cur: Vector3 = g.mouth if id == 2 else g.tip        # free: on the plane through it that faces the camera
	var nrm := (inv.basis * camera.global_basis.z).normalized()
	var den2 := nrm.dot(dir)
	if absf(den2) < 1e-6:
		return cur
	return (from + dir * (nrm.dot(cur - from) / den2)).snappedf(0.001)


func _set_handle(gizmo: EditorNode3DGizmo, id: int, _secondary: bool, camera: Camera3D, screen_pos: Vector2) -> void:
	var g := gizmo.get_node_3d() as HSGrip
	g.set(PROPS[id], dragged(g, id, camera, screen_pos))


func _commit_handle(gizmo: EditorNode3DGizmo, id: int, _secondary: bool, restore: Variant, cancel: bool) -> void:
	var g := gizmo.get_node_3d() as HSGrip
	if cancel:
		g.set(PROPS[id], restore)
		return
	if undo == null:
		return
	undo.create_action("Grip: " + NAMES[id].to_lower())
	undo.add_do_property(g, PROPS[id], g.get(PROPS[id]))
	undo.add_undo_property(g, PROPS[id], restore)
	undo.commit_action()
