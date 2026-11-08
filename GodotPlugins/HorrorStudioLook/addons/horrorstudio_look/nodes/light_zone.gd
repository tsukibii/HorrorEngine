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
## - **Their fittings' glass going with them** (`glass_follows`, in the game): what glows within `glass_reach` of a
##   light (a mesh whose material has emission: an exported fitting's tube or diffuser, your own lamp's bulb) goes out,
##   dims and flickers with it, its own copy of the material driven by the light's output against its full light. A
##   light the game's runtime drives itself (play.gd's fittings) is left to it.
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
@export var glass_follows := true                ## in the game: what glows by each light (its fitting's glass) goes with it
@export_range(0.0, 1.0, 0.01, "suffix:m") var glass_reach: float = 0.3
var layer := 0                                  ## its render layer (2 to 10; 0: none free, keep_inside off)
var lights: Array = []                           ## the lights it owns
var meshes: Array = []                           ## the meshes it keeps the light to
var seen := true
var _was: Dictionary = {}                        # instance id -> what it changed: {mask, range}
var _key := 0
var _outline: MeshInstance3D = null
var glass: Array = []                            ## per light with a glowing fitting: {light, mats (its own copies), e0, was (what each surface wore), full, k}
var _glass_at := -1                              # the frame the glass is looked for (a few after the zone's start: the runtime tags its own first)


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
	_glass_at = -1                               # its glass looked for again
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
	glass_back()
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
	if Engine.is_editor_hint():
		return
	if hide_unseen:
		var cam := get_viewport().get_camera_3d()
		var now: bool = cam == null or seen_by(cam)
		if now != seen:
			seen = now
			for l in lights:
				if is_instance_valid(l):
					l.set_meta("hs_zone_hidden", not seen)
					show_light(l)
	if glass_follows and seen:
		if _glass_at < 0:
			_glass_at = Engine.get_process_frames() + 3
		elif _glass_at > 0 and Engine.get_process_frames() >= _glass_at:
			_glass_at = 0
			find_glass()
		glass_tick()


## each light's glass: the surfaces that glow (a BaseMaterial3D with emission) whose box comes within `glass_reach` of
## a light; each glowing mesh goes to the nearest light that's on (an off one only when none that's on is near: an
## export's hidden lamp markers at the same spots never take it), worn as a copy of its own
func find_glass() -> void:
	glass_back()
	var root := scope()
	if root == null:
		return
	var cands: Array = []
	for l in lights:
		if not is_instance_valid(l) or l.has_meta("hs_energy") or l.has_meta("light") or (l.get_parent() != null and l.get_parent().has_meta("light")):
			continue                                 # an exported game's story light: its runtime drives its fitting (play.gd's fitting_light)
		if l.get("drive") == null and not l.has_meta("hs_full") and l.light_energy < 0.001:
			continue                                 # dark by its energy from the start: its full light isn't known
		cands.append(l)
	if cands.is_empty():
		return
	var by_light := {}
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or mi.has_meta("hs_glass") or not mi.is_visible_in_tree():
			continue
		var surf: Array = []
		for i in mi.mesh.get_surface_count():
			var m: Material = mi.get_surface_override_material(i)
			if m == null:
				m = mi.mesh.surface_get_material(i)
			if m is BaseMaterial3D and m.emission_enabled:
				surf.append(i)
		if surf.is_empty():
			continue
		var ab: AABB = mi.global_transform * mi.get_aabb()
		var grown := ab.grow(glass_reach)
		var best: Light3D = null
		var best_key := INF
		for l in cands:
			if not grown.has_point(l.global_position):
				continue
			var on: bool = bool(l.get_meta("hs_lit")) if l.has_meta("hs_lit") else l.visible
			var key: float = l.global_position.distance_to(ab.get_center()) + (0.0 if on else 1000.0)
			if key < best_key:
				best_key = key
				best = l
		if best == null:
			continue
		if not by_light.has(best):
			by_light[best] = {"light": best, "mats": [], "e0": [], "was": [], "k": -1.0, "full": best.light_energy}
			glass.append(by_light[best])
		var g: Dictionary = by_light[best]
		mi.set_meta("hs_glass", get_instance_id())
		for i in surf:
			var was: Material = mi.get_surface_override_material(i)
			var own: BaseMaterial3D = (was if was != null else mi.mesh.surface_get_material(i)).duplicate()
			mi.set_surface_override_material(i, own)
			g["mats"].append(own)
			g["e0"].append(own.emission_energy_multiplier)
			g["was"].append([mi, i, was])


## a light's full light: the starter's (lights.gd keeps it the first time it dims one), a flickering light's own (its
## drive's), else what it had when its glass was found
static func full_light(l: Light3D, had: float) -> float:
	if l.has_meta("hs_full"):
		return float(l.get_meta("hs_full"))
	var d = l.get("drive")
	if d != null and d.get("base") != null and float(d.get("last")) >= 0.0:
		return float(d.base)
	return had


## the glass as bright as its light is now against its full light (out when it's off or the power is)
func glass_tick() -> void:
	for g in glass:
		var l: Light3D = g["light"]
		if not is_instance_valid(l):
			continue
		var k := 0.0
		if l.visible:
			k = clampf(l.light_energy / maxf(full_light(l, float(g["full"])), 0.0001), 0.0, 1.5)
		if absf(k - float(g["k"])) < 0.004:
			continue
		g["k"] = k
		for j in g["mats"].size():
			(g["mats"][j] as BaseMaterial3D).emission_energy_multiplier = float(g["e0"][j]) * k


## how bright a light's glass is now (0 out, 1 full; -1 it has none): the checks
func glass_of(l: Light3D) -> float:
	for g in glass:
		if g["light"] == l:
			return float(g["k"])
	return -1.0


## the glass's own materials taken off again
func glass_back() -> void:
	for g in glass:
		for w in g["was"]:
			if is_instance_valid(w[0]):
				(w[0] as MeshInstance3D).set_surface_override_material(w[1], w[2])
				if (w[0] as Node).has_meta("hs_glass"):
					(w[0] as Node).remove_meta("hs_glass")
	glass = []


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
