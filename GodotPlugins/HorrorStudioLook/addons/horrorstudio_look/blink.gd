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
var rng := RandomNumberGenerator.new()
var _wait := 1.0                         # till the next blink
var _t := -1.0                           # how far into a blink (-1: between)
var _again := false                      # a second blink straight after
const CLOSE := 0.07                      # a blink: shut in 70 ms, held 40, open in 130 (people blink in 100 to 400 ms)
const HOLD := 0.04
const OPEN := 0.13


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
		if mi.mesh == null or mi.mesh.get_blend_shape_count() == 0:
			continue
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
	rng.randomize()
	_wait = rng.randf_range(0.5, 3.0)


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
