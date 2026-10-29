## A mirror (mirror.gdshader; docs/GODOT_LOOK.md): a real reflection on a surface, the way games do it: a second
## camera, the player's camera reflected through the glass's plane, renders the room into a SubViewport each frame
## the mirror is in view and the eye is on its side; the glass reads the texel that camera gave each of its points,
## through the camera's view-projection (so the image is never mirrored the wrong way round). The wall the mirror
## hangs on is put on the hidden layer for that camera (a mirror never shows its own wall) and the near plane is set
## at the glass, so what's behind the wall stays out (they go on layer 20 alone: the player's camera draws every layer,
## a mirror's camera all but that one; so one mirror's wall is missing from another's reflection). `HSMirror.attach(mesh_instance, surface, camera, size)` on a
## kit panel's `kit_mirror` surface or any quad; `res` the picture's height in pixels (its width by the window's
## aspect); `active` false when the mirror is out of view (the viewport then isn't drawn).
class_name HSMirror
extends Node3D

const HIDDEN_LAYER := 20

var mi: MeshInstance3D
var surface := 0
var cam: Camera3D
var view: SubViewport
var mcam: Camera3D
var mat: ShaderMaterial
var centre := Vector3.ZERO     # the glass's middle, the mesh's space
var normal := Vector3(0, 0, 1)  # the glass's facing, the mesh's space
var corners: Array = []        # the glass's extent, the mesh's space
var block := false             # a closed block rather than one face: the thin axis faces, either side toward the eye
var half := 0.0                 # the block's half thickness along it
var res := 288
var active := false
var frames := 0
var last: Dictionary = {}       # the last frame's reckoning (the checks read it)


static func attach(mi_: MeshInstance3D, surface_: int, cam_: Camera3D, res_: int = 288) -> HSMirror:
	var m := HSMirror.new()
	m.name = "Mirror"
	m.mi = mi_
	m.surface = surface_
	m.cam = cam_
	m.res = res_
	mi_.add_child(m)
	return m


## the surface named `kit_mirror` (a kit panel's glass), else -1
static func mirror_surface(mi_: MeshInstance3D) -> int:
	if mi_ == null or mi_.mesh == null:
		return -1
	for s in mi_.mesh.get_surface_count():
		var nm: String = str(mi_.mesh.surface_get_name(s)) if mi_.mesh is ArrayMesh else ""
		var old = mi_.get_active_material(s)
		if nm == "kit_mirror" or nm == "mirror" or (old != null and old.resource_name == "mirror"):
			return s
	return -1


func _ready() -> void:
	_measure()
	view = SubViewport.new()
	view.name = "View"
	var aspect := 16.0 / 9.0
	var vp := get_viewport()
	if vp != null and vp.get_visible_rect().size.y > 0:
		aspect = vp.get_visible_rect().size.x / vp.get_visible_rect().size.y
	view.size = Vector2i(int(res * aspect), res)
	view.render_target_update_mode = SubViewport.UPDATE_DISABLED
	view.msaa_3d = Viewport.MSAA_DISABLED
	view.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
	view.use_taa = false
	view.transparent_bg = false
	add_child(view)
	mcam = Camera3D.new()
	mcam.name = "Eye"
	mcam.cull_mask = cam.cull_mask & ~(1 << (HIDDEN_LAYER - 1))
	mcam.near = 0.05
	var w3 := get_viewport().find_world_3d() if get_viewport() != null else null
	if w3 != null and w3.environment != null:        # the room's own light, but tone-mapped once: the glass's picture goes through the main pass's tone map
		var env2: Environment = w3.environment.duplicate()
		env2.tonemap_mode = Environment.TONE_MAPPER_LINEAR
		env2.tonemap_exposure = 1.0
		env2.glow_enabled = false
		env2.adjustment_enabled = false
		mcam.environment = env2
	view.add_child(mcam)
	mcam.current = true
	mat = ShaderMaterial.new()
	mat.shader = load("res://addons/horrorstudio_look/mirror.gdshader")
	mat.set_shader_parameter("mirror_tex", view.get_texture())
	mat.set_shader_parameter("active", 0.0)
	mi.set_surface_override_material(surface, mat)
	mi.layers = 1 << (HIDDEN_LAYER - 1)     # a mirror doesn't see itself (no reading the picture it's drawing): layer 20 alone, which the player's camera draws and this one doesn't
	_hide_wall()


## the glass's middle, facing and corners from its own triangles (the facing the area-weighted normal, so a panel's
## bevels don't turn it)
func _measure() -> void:
	var arrays := mi.mesh.surface_get_arrays(surface)
	var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var idx: PackedInt32Array = arrays[Mesh.ARRAY_INDEX] if arrays[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
	if idx.is_empty():
		for i in verts.size():
			idx.append(i)
	var n := Vector3.ZERO
	var c := Vector3.ZERO
	var area := 0.0
	var i := 0
	while i + 2 < idx.size():
		var a := verts[idx[i]]
		var b := verts[idx[i + 1]]
		var d := verts[idx[i + 2]]
		var fn := (d - a).cross(b - a)      # twice the area, along the face's normal (Godot's front faces wind clockwise)
		var w := fn.length()
		n += fn
		c += (a + b + d) / 3.0 * w
		area += w
		i += 3
	var lo := Vector3(1e9, 1e9, 1e9)
	var hi := -lo
	for v in verts:
		lo = lo.min(v)
		hi = hi.max(v)
	block = n.length() < 0.5 * max(area, 1e-9)   # not one flat face: a closed block (a kit panel's whole slot, a box tagged mirror)
	if block:                                     # its thin axis faces, the side picked toward the eye each frame (both sides reflect)
		var ext := hi - lo
		var ax := Vector3(1, 0, 0) if ext.x <= ext.y and ext.x <= ext.z else (Vector3(0, 1, 0) if ext.y <= ext.z else Vector3(0, 0, 1))
		n = ax
		half = ext.dot(ax) * 0.5
		c = (lo + hi) * 0.5 * max(area, 1e-9)
	normal = n.normalized() if n.length() > 1e-6 else Vector3(0, 0, 1)
	if arrays[Mesh.ARRAY_NORMAL] != null and not block:   # the mesh's own normals settle the side
		var vn := Vector3.ZERO
		for nn in (arrays[Mesh.ARRAY_NORMAL] as PackedVector3Array):
			vn += nn
		if vn.length() > 1e-6 and vn.dot(normal) < 0.0:
			normal = -normal
	centre = c / max(area, 1e-9)
	corners = [lo, Vector3(hi.x, lo.y, lo.z), Vector3(lo.x, hi.y, lo.z), Vector3(hi.x, hi.y, lo.z), Vector3(lo.x, lo.y, hi.z), Vector3(hi.x, lo.y, hi.z), Vector3(lo.x, hi.y, hi.z), hi]


## the wall the mirror hangs on (the body just behind the glass) onto the layer the mirror's camera doesn't draw
func _hide_wall() -> void:
	var space := get_world_3d().direct_space_state
	if space == null:
		return
	var p := mi.global_transform * centre
	var nw := (mi.global_transform.basis * normal).normalized()
	var q := PhysicsRayQueryParameters3D.create(p + nw * 0.01, p - nw * 0.6)
	var body: Node = mi.get_parent()                   # the mirror's own body (a kit's glb sits under it): not the wall
	while body != null and not (body is CollisionObject3D):
		body = body.get_parent()
	if body is CollisionObject3D:
		q.exclude = [body.get_rid()]
	var hit := space.intersect_ray(q)
	if hit.is_empty():
		return
	var col = hit.get("collider")
	if col == null or not (col is Node):
		return
	for v in col.find_children("*", "VisualInstance3D", true, false):
		v.layers = 1 << (HIDDEN_LAYER - 1)
	if col is VisualInstance3D:
		col.layers = 1 << (HIDDEN_LAYER - 1)


func _process(_dt: float) -> void:
	if cam == null or not is_instance_valid(cam) or view == null:
		return
	var xf := mi.global_transform
	var eye := cam.global_position
	var n := (xf.basis * normal).normalized()
	var p := xf * centre
	if block:                                      # the face toward the eye, and its middle
		if (eye - p).dot(n) < 0.0:
			n = -n
		p = p + n * half
	var d := (eye - p).dot(n)
	var seen := d > 0.02 and mi.is_visible_in_tree()
	if seen:
		var any := false
		for c in corners:
			if cam.is_position_in_frustum(xf * c):
				any = true
				break
		seen = any or cam.is_position_in_frustum(p)
	last = {"d": d, "p": p, "n": n, "eye": eye, "visible": mi.is_visible_in_tree(), "seen": seen, "cam": str(cam.get_path()), "current": cam.current}
	if not seen:
		if active:
			active = false
			view.render_target_update_mode = SubViewport.UPDATE_DISABLED
			mat.set_shader_parameter("active", 0.0)
		return
	var eye2 := eye - 2.0 * d * n
	var fwd := -cam.global_transform.basis.z
	var fwd2 := fwd - 2.0 * fwd.dot(n) * n
	var up := cam.global_transform.basis.y
	var up2 := up - 2.0 * up.dot(n) * n
	mcam.fov = cam.fov
	mcam.look_at_from_position(eye2, eye2 + fwd2, up2)
	var near := 1e9
	for c in corners:
		near = min(near, (xf * c - eye2).dot(fwd2))
	mcam.near = clamp(near - 0.02, 0.03, 50.0)
	mcam.far = cam.far
	var vpm := mcam.get_camera_projection() * Projection(mcam.global_transform.affine_inverse())
	mat.set_shader_parameter("mirror_vp", vpm)
	if not active:
		active = true
		view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		mat.set_shader_parameter("active", 1.0)
	frames += 1
