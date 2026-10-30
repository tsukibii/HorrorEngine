## A light zone (docs/GODOT_LOOK.md §0; the user, 2026-10-30, evening: "presets for room lights with a cubed area
## affected, like VoxelGI, the zone is what will be lit; I'm ok limiting the architecture to boxes"): a box (`size`,
## drawn in the editor as VoxelGI's is) that owns the lights inside it and keeps them to it.
##
## - **Only what's in the box is lit by them** (`keep_inside`): the meshes wholly inside the box (by `margin`, so a
##   wall between two rooms belongs to both) go on the zone's own render layer, and its lights light that layer, layer 1
##   (what moves: doors, things picked up, the cast, effects) and the mirrors' layers (11 to 20). A lamp never lights
##   the next room through an open door, and costs nothing there. Zones that touch get different layers (2 to 10, nine
##   colours: plenty for a house); shadows are cast by everything, so walls still block.
## - **Their reach fitted to the box** (`fit_range`): a light's range brought down to `range_reach` times the farthest
##   corner of the box from it, never raised.
## - **Off while the box can't be seen** (`hide_unseen`, in the game): when the camera is outside the box and the box
##   is out of the view (or farther than `cull_distance`), its lights are switched off, shadows and all.
##
## Put it in the room (its middle), size it to the room, and put lights inside it (as its children, or anywhere in the
## scene: a light inside the box is its). The room_* presets are a zone with lights. The export puts one in every room.
## In the editor the layers, cull masks and ranges are shown as the game will have them and put back before every
## save, so the scene keeps its own.
@tool
@icon("res://addons/horrorstudio_look/icons/zone.svg")
class_name HSLightZone
extends Node3D

const FIRST_LAYER := 2
const LAST_LAYER := 10
const SHARED := 1 | (0x3FF << 10)              # layer 1 (what moves) and 11 to 20 (the mirrors' and the softener's)
const ZONES := 0x1FF << 1                       # layers 2 to 10, the zones' own

@export var size := Vector3(4, 3, 4)
@export var keep_inside := true
@export var fit_range := true
@export_range(1.0, 2.0) var range_reach: float = 1.25
@export var hide_unseen := true
@export_range(5.0, 200.0, 1.0, "suffix:m") var cull_distance: float = 40.0
@export_range(0.0, 1.0, 0.01, "suffix:m") var margin: float = 0.25
@export var show_box := true
var layer := 0                                  ## its render layer (2 to 10; 0: none free, keep_inside off)
var lights: Array = []                           ## the lights it owns
var meshes: Array = []                           ## the meshes it keeps the light to
var seen := true
var _was: Dictionary = {}                        # instance id -> what it changed: {mask, range}
var _key := 0
var _outline: MeshInstance3D = null


func _enter_tree() -> void:
	add_to_group("hs_light_zones")
	if is_node_ready():
		apply_now.call_deferred()


func _ready() -> void:
	apply_now.call_deferred()                    # once the scene's other nodes are in (its lights, its meshes)


func scope() -> Node:
	if Engine.is_editor_hint() and is_inside_tree() and get_tree().edited_scene_root != null:
		return get_tree().edited_scene_root
	return owner if owner != null else get_parent()


func box() -> AABB:
	var b := AABB(-size * 0.5, size)
	return global_transform * b


func inside(p: Vector3, grow: float) -> bool:
	var l: Vector3 = global_transform.affine_inverse() * p
	var h := size * 0.5 + Vector3.ONE * grow
	return absf(l.x) <= h.x and absf(l.y) <= h.y and absf(l.z) <= h.z


func corners() -> Array:
	var out: Array = []
	for i in 8:
		out.append(global_transform * Vector3((1 if i & 1 else -1) * size.x * 0.5, (1 if i & 2 else -1) * size.y * 0.5, (1 if i & 4 else -1) * size.z * 0.5))
	return out


func _key_now() -> int:
	return [size, keep_inside, fit_range, range_reach, margin, global_transform].hash()


## its layer: the lowest of 2 to 10 no zone touching it has
func pick_layer() -> int:
	var mine := box().grow(margin * 2.0 + 0.05)
	var used := {}
	for z in get_tree().get_nodes_in_group("hs_light_zones"):
		if z != self and z.layer > 0 and z.is_inside_tree() and mine.intersects(z.box()):
			used[z.layer] = true
	for k in range(FIRST_LAYER, LAST_LAYER + 1):
		if not used.has(k):
			return k
	return 0


func apply_now() -> void:
	if not is_inside_tree():
		return
	undo()
	_key = _key_now()
	layer = pick_layer() if keep_inside else 0
	var root := scope()
	if root == null:
		return
	for l in root.find_children("*", "Light3D", true, false):
		if l is DirectionalLight3D or l.is_in_group("hs_no_zone"):
			continue
		if l.has_meta("hs_zone") and int(l.get_meta("hs_zone")) != get_instance_id():
			continue
		if not inside(l.global_position, 0.05):
			continue
		lights.append(l)
		l.set_meta("hs_zone", get_instance_id())
		var was := {"mask": l.light_cull_mask}
		if layer > 0:
			l.light_cull_mask = (1 << (layer - 1)) | SHARED
		if fit_range and (l is OmniLight3D or l is SpotLight3D):
			var far := 0.0
			for c in corners():
				far = max(far, l.global_position.distance_to(c))
			var r: float = l.omni_range if l is OmniLight3D else l.spot_range
			was["range"] = r
			var want: float = min(r, far * range_reach)
			if l is OmniLight3D:
				l.omni_range = want
			else:
				l.spot_range = want
		_was[l.get_instance_id()] = was
	if layer > 0:
		for gi in root.find_children("*", "GeometryInstance3D", true, false):
			if is_ancestor_of(gi) or gi.get_parent() is HSLightZone or gi.is_in_group("hs_no_zone") or gi.gi_mode == GeometryInstance3D.GI_MODE_DYNAMIC:
				continue
			if gi.layers & (1 | ZONES) == 0:
				continue                                 # on a layer of its own (a mirror's glass and wall): left alone
			var ab: AABB = gi.global_transform * gi.get_aabb()
			if ab.size == Vector3.ZERO or not (inside(ab.position, margin) and inside(ab.end, margin)):
				continue
			if not gi.has_meta("hs_layers_was"):
				gi.set_meta("hs_layers_was", gi.layers)
			gi.layers = (gi.layers & ~1) | (1 << (layer - 1))
			meshes.append(gi)
	_draw_box()


## everything it changed put back (before a save, when it leaves)
func undo() -> void:
	for l in lights:
		if not is_instance_valid(l):
			continue
		var was: Dictionary = _was.get(l.get_instance_id(), {})
		if was.has("mask"):
			l.light_cull_mask = was["mask"]
		if was.has("range"):
			if l is OmniLight3D:
				l.omni_range = was["range"]
			elif l is SpotLight3D:
				l.spot_range = was["range"]
		if l.has_meta("hs_zone"):
			l.remove_meta("hs_zone")
		if l.has_meta("hs_zone_hidden"):
			l.remove_meta("hs_zone_hidden")
			show_light(l)
	for gi in meshes:                                # its own bit off; the last zone off puts layer 1 back if it was there (what
		if not is_instance_valid(gi) or layer <= 0:  # else changed the layers since, a mirror, keeps its change)
			continue
		var now: int = gi.layers & ~(1 << (layer - 1))
		if now & ZONES == 0 and gi.has_meta("hs_layers_was"):
			now |= int(gi.get_meta("hs_layers_was")) & 1
			gi.remove_meta("hs_layers_was")
		if now == 0:
			now = 1
		gi.layers = now
	lights = []
	meshes = []
	_was.clear()
	seen = true


## a light shown or not by everything that has a say: its own visibility (kept the first time), the power (play.gd's
## mains) and its zone's view
static func show_light(l: Light3D) -> void:
	if not l.has_meta("hs_lit"):
		l.set_meta("hs_lit", l.visible)
	l.visible = bool(l.get_meta("hs_lit")) and not bool(l.get_meta("hs_power_off", false)) and not bool(l.get_meta("hs_zone_hidden", false))


## the camera inside the box, or the box in its view and near enough
func seen_by(cam: Camera3D) -> bool:
	if inside(cam.global_position, 0.5):
		return true
	var b := box()
	var near_pt: Vector3 = cam.global_position.clamp(b.position, b.end)
	if near_pt.distance_to(cam.global_position) > cull_distance:
		return false
	var probe: Vector3 = cam.global_position - cam.global_basis.z * max(cam.near * 2.0, 0.2)   # a point surely in the view
	for pl in cam.get_frustum():
		var ins: bool = pl.is_point_over(probe)
		var any := false
		for c in corners():
			if pl.is_point_over(c) == ins:
				any = true
				break
		if not any:
			return false                             # every corner on the far side of one plane: out of view
	return true


func _process(_dt: float) -> void:
	if _key_now() != _key:
		apply_now()
	if Engine.is_editor_hint() or not hide_unseen:
		return
	var cam := get_viewport().get_camera_3d()
	var now: bool = cam == null or seen_by(cam)
	if now != seen:
		seen = now
		for l in lights:
			if is_instance_valid(l):
				l.set_meta("hs_zone_hidden", not seen)
				show_light(l)


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_EDITOR_PRE_SAVE:
			undo()
		NOTIFICATION_EDITOR_POST_SAVE:
			apply_now.call_deferred()
		NOTIFICATION_EXIT_TREE:
			undo()


## the box as orange lines in the editor, coloured by its layer (never in a game, never saved)
func _draw_box() -> void:
	if _outline != null:
		_outline.queue_free()
		_outline = null
	if not Engine.is_editor_hint() or not show_box:
		return
	var im := ImmediateMesh.new()
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color.from_hsv(0.08 + 0.09 * float(max(layer - FIRST_LAYER, 0)), 0.7, 1.0)
	var h := size * 0.5
	var c: Array = []
	for i in 8:
		c.append(Vector3((1 if i & 1 else -1) * h.x, (1 if i & 2 else -1) * h.y, (1 if i & 4 else -1) * h.z))
	im.surface_begin(Mesh.PRIMITIVE_LINES, mat)
	for e in [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]:
		im.surface_add_vertex(c[e[0]])
		im.surface_add_vertex(c[e[1]])
	im.surface_end()
	_outline = MeshInstance3D.new()
	_outline.name = "Box"
	_outline.mesh = im
	_outline.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_outline)                              # no owner: never saved


func _get_configuration_warnings() -> PackedStringArray:
	return PackedStringArray() if not lights.is_empty() else PackedStringArray(["No light inside the box: put one in (as a child, or anywhere inside it)."])
