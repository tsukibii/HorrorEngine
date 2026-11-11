## A Character Studio export's blink in Godot (docs/GODOT_LOOK.md §5f). The export carries each eye's closing as morph
## targets by MHR's names on the skin, the lashes, the lash line and the brows (`eyesClosed_L`, `eyesClosed_R`), the lids
## kept off the eyeball by the Studio and their edges met; a morph target moves each point along a straight line and a
## lid's way down over the round eye and its cornea is a curve, so the way is kept at in-between weights too
## (`eyesClosed_L_in1250` ... `_in9375`, the weight in ten-thousandths: each what the lid lacks there over the straight
## line), each set by its hat (1 at its weight, nothing at its neighbours') beside the blink's own w: the eye stays
## behind the lids all the way down.
## HSBlink sets them on every mesh that has them, each frame: the larger of what's asked (`hold`: a scene's face) and its
## own idle blink (every 2 to 6 s, a fifth of a second shut and open again, now and then twice). `HSEye.wear` adds one
## to a character whose export blinks; `HSBlink.of(node)` finds it (the pictures turn `idle` off and set `hold`).
class_name HSBlink
extends Node

@export var idle := true                 # blink by itself
@export var hold := Vector2.ZERO         # how shut each eye is asked to be (x the left eye, y the right): a scene's face
var shapes: Array = []                   # a row a mesh: [MeshInstance3D, left, right], each eye's [[blend shape, its weight (1 the blink itself)]...]
var movers: Array = []                   # the face's shapes that move a lid (MHR's, by name: the bake's), on the mesh that carries most of them: [MeshInstance3D, [[blend shape, its share]...]]
var eyes: Array = []                     # the eyes' materials that take `lid_room` (the Studio's eye and its wet layer)
var room := 0.0                          # how much deeper than they are the eyeballs are drawn now (m)
var room_scale := 1.0                    # how much of that room (HSEye.wear's `lid_room` override over LID_ROOM; 0: never)
var room_most := LID_ROOM                # the most room her face asks for: her copy's own word (its skin's `lidRoom`, measured by the bake over ordinary mixes of shapes; 0: her lids never reach her eyes), else LID_ROOM
var rng := RandomNumberGenerator.new()
var _wait := 1.0                         # till the next blink
var _t := -1.0                           # how far into a blink (-1: between)
var _again := false                      # a second blink straight after
const CLOSE := 0.07                      # a blink: shut in 70 ms, held 40, open in 130 (people blink in 100 to 400 ms)
const HOLD := 0.04
const OPEN := 0.13
## The eyeballs drawn a little deeper than they are while the face moves its lids (GODOT_LOOK §5f, DECISIONS 2026-11-11).
## MHR's face shapes are baked with the lids kept off the eye one shape at a time; a smile is several at once and their
## sum slid a lid up to 1.2 mm into the eye, which showed through it. Drawn `LID_ROOM` deeper (eye.gdshader's lid_room),
## the lid covers it. Only while such shapes are on: at rest and in the blink (the export's own, exact) the eye is drawn
## where it is, so a face at rest is the Studio's to the pixel (on a creature's deep-set eyes the room would thicken
## the lids' edges: a fifth of a demon's opening). Each shape's share: how much of the room its full weight asks for.
const LID_ROOM := 0.0012
const LID_MOVERS := {"cheekRaiser": 1.0, "lidTightener": 1.0, "upperLidRaiser": 0.8, "eyesLookDown": 1.0, "eyesLookUp": 0.8, "eyesLookLeft": 0.7, "eyesLookRight": 0.7,
	"noseWrinkler": 0.8, "browLowerer": 0.6, "lipCornerPuller": 0.5, "upperLipRaiser": 0.4, "innerBrowRaiser": 0.3, "outerBrowRaiser": 0.3}


## the blinker under a node, or null
static func of(node: Node) -> HSBlink:
	for c in node.get_children():
		if c is HSBlink:
			return c
	return null


## a blinker under node when any mesh under it carries the blink's targets (or the one already there); null when none does
static func attach(node: Node) -> HSBlink:
	var b := of(node)
	if b != null:
		return b
	b = HSBlink.new()
	b.name = "HSBlink"
	b.find(node)
	if b.shapes.is_empty():
		b.free()
		return null
	node.add_child(b)
	return b


func find(node: Node) -> void:
	shapes.clear()
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or (mi.mesh as ArrayMesh).get_blend_shape_count() == 0:
			continue                                   # (a primitive mesh, a stand-in's or a thing in her hand, has no blend shapes to ask about)
		var row := [mi, [], []]
		for i in mi.mesh.get_blend_shape_count():
			var nm := String(mi.mesh.get_blend_shape_name(i))
			for k in 2:
				var base: String = ["eyesClosed_L", "eyesClosed_R"][k]
				if nm == base:
					row[1 + k].append([i, 1.0])
				elif nm.begins_with(base + "_in") and nm.substr(base.length() + 3).is_valid_int():
					row[1 + k].append([i, int(nm.substr(base.length() + 3)) / 10000.0])   # its weight in ten-thousandths
		for k in 2:
			row[1 + k].sort_custom(func(a, b): return a[1] < b[1])
		if not row[1].is_empty() or not row[2].is_empty():
			shapes.append(row)
	# the lid-moving shapes of the face (a copy baked for Godot carries them), on the mesh with the most of them (the skin)
	movers.clear()
	var most := 0
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh):
			continue
		var list := []
		for i in mi.mesh.get_blend_shape_count():
			var nm := String(mi.mesh.get_blend_shape_name(i))
			var stem := nm.substr(0, nm.rfind("_")) if nm.rfind("_") > 0 else nm
			if LID_MOVERS.has(stem):
				list.append([i, float(LID_MOVERS[stem])])
		if list.size() > most:
			most = list.size()
			movers = [mi, list]
	room_most = LID_ROOM
	if not movers.is_empty() and (movers[0] as Node).has_meta("extras"):
		var ex = (movers[0] as Node).get_meta("extras")
		if ex is Dictionary and ex.has("lidRoom"):
			room_most = clampf(float(ex["lidRoom"]), 0.0, 0.003)
	# and the eyes that take the room: the Studio's eye and its wet layer (HSEye.wear puts them on before or after: found again while there are none)
	_find_eyes(node)
	rng.randomize()
	_wait = rng.randf_range(0.5, 3.0)


func _find_eyes(node: Node) -> void:
	eyes.clear()
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		var mats: Array = [mi.material_overlay]
		for k in mi.mesh.get_surface_count():
			mats.append(mi.get_surface_override_material(k))
		for m in mats:
			if m is ShaderMaterial and m.shader != null and m.get_shader_parameter("lid_room") != null and not eyes.has(m):
				eyes.append(m)


## how much room the face asks for now: 0 at rest, LID_ROOM with a lid-moving shape full on (several add up to it sooner)
func lid_room_now() -> float:
	if movers.is_empty() or not is_instance_valid(movers[0]):
		return 0.0
	var mi: MeshInstance3D = movers[0]
	var sum := 0.0
	for row in movers[1]:
		sum += mi.get_blend_shape_value(row[0]) * row[1]
	return room_most * room_scale * smoothstep(0.0, 0.7, sum * 0.5)   # (left and right both count: a smile's cheeks at 0.8 each are already the whole room)


## how shut the idle blink has the eyes now (0 open, 1 shut)
func blink_now() -> float:
	if _t < 0.0:
		return 0.0
	if _t < CLOSE:
		return smoothstep(0.0, CLOSE, _t)
	if _t < CLOSE + HOLD:
		return 1.0
	return 1.0 - smoothstep(CLOSE + HOLD, CLOSE + HOLD + OPEN, _t)


func _process(delta: float) -> void:
	if not idle:
		_t = -1.0
	elif _t >= 0.0:
		_t += delta
		if _t > CLOSE + HOLD + OPEN:
			_t = 0.0 if _again else -1.0
			_again = false
	else:
		_wait -= delta
		if _wait <= 0.0:
			_t = 0.0
			_again = rng.randf() < 0.15
			_wait = rng.randf_range(2.0, 6.0)
	var b := blink_now()
	apply(Vector2(maxf(hold.x, b), maxf(hold.y, b)))
	var want := lid_room_now()
	if eyes.is_empty() and want > 0.0:
		_find_eyes(get_parent())
	if not is_equal_approx(want, room) or (want == 0.0 and room != 0.0):
		room = want
		for m in eyes:
			if is_instance_valid(m):
				m.set_shader_parameter("lid_room", room)


## each eye's blink at w (x the left, y the right) on every mesh that has it: the blink itself w, each in-between its hat
func apply(w: Vector2) -> void:
	for row in shapes:
		var mi: MeshInstance3D = row[0]
		if not is_instance_valid(mi):
			continue
		for k in 2:
			var v := clampf(w[k], 0.0, 1.0)
			var keys: Array = row[1 + k]
			for j in keys.size():
				var at: float = keys[j][1]
				if at >= 1.0:
					mi.set_blend_shape_value(keys[j][0], v)
					continue
				var lo: float = keys[j - 1][1] if j > 0 else 0.0
				var hi: float = keys[j + 1][1] if j + 1 < keys.size() else 1.0
				var h := 0.0
				if v >= lo and v <= at:
					h = (v - lo) / maxf(1e-6, at - lo)
				elif v > at and v <= hi:
					h = (hi - v) / maxf(1e-6, hi - at)
				mi.set_blend_shape_value(keys[j][0], h)
