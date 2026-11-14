## Where a hand takes a prop (docs/ANIMATOR_V3.md §4.1, docs/GODOT_LOOK.md §5y; DECISIONS 2026-11-14, animations v3:
## "a gizmo we can add to props and adjust to handle size so for pickup object animations we can make it look like
## the npc actually picked it up e.g to eat or drink").
##
## Put one under a prop, where a hand closes on it. Its place is the middle of what the hand closes round; its green
## arrow (+Y) runs along the handle toward the thumb; its blue arrow (+Z) points at the palm, where the hand comes
## from. In the 3D view it draws the handle at its thickness with a hand round it, and four handles to drag: the
## thickness, the length, where the mouth goes when it's eaten or drunk from, where it hits when it's swung.
## When someone picks the prop up (the starter kit's motion.gd, a marker's Grab) it's put in their hand by this, and
## their fingers close round a handle that thick (HSHandIK). The same node serves either hand. A prop with none is
## still held, by a grip guessed from its size (`guess`).
@tool
@icon("res://addons/horrorstudio_look/icons/grip.svg")
class_name HSGrip
extends Node3D

const SHAPES := ["handle", "ball", "pinch"]
const USES := ["", "eat", "drink"]
const CARRIES := ["", "side", "front", "chest", "shoulder", "raised"]

@export_enum("Handle", "Ball", "Pinch") var shape := 0:                 ## a handle to close a fist round (a bat, a bottle, a can); a ball in the whole hand (an apple); a small thing between finger and thumb (a key, a pill)
	set(v):
		shape = v
		update_gizmos()
@export_range(0.004, 0.16, 0.001, "suffix:m") var size := 0.035:      ## how thick it is where the fingers close: a bat 0.035, a can 0.066, a mug's handle 0.012
	set(v):
		size = v
		update_gizmos()
@export_range(0.02, 0.8, 0.005, "suffix:m") var length := 0.1:        ## how long the handle is
	set(v):
		length = v
		update_gizmos()
@export_enum("Either hand", "Right hand", "Left hand") var hand := 0:   ## a mug's handle is on one side
	set(v):
		hand = v
		update_gizmos()
@export_enum("Just held", "Eaten", "Drunk from") var use := 0:          ## what it's for, in someone's hand
	set(v):
		use = v
		update_gizmos()
@export_enum("As it suits it", "At her side", "In front of her", "To her chest", "Over her shoulder", "Raised") var carry := 0   ## how it's carried while she does other things (HSGesture, docs/ANIMATOR_V3.md §12): a bottle at her side, a cup in front of her, a book to her chest, a bat over her shoulder, a lantern raised. Left alone: in front of her if it's drunk from, else at her side
@export var upright := false                                           ## kept the way up it stands, however her hand turns: a cup, a candle, a lantern, a plate
@export var mouth := Vector3(0, 0.08, 0):                              ## where the mouth goes when it's eaten or drunk from (the rim, the bite), from here
	set(v):
		mouth = v
		update_gizmos()
@export var tip := Vector3(0, 0.3, 0):                                 ## where it hits when it's swung (a bat's end), from here
	set(v):
		tip = v
		update_gizmos()


func shape_name() -> String:
	return SHAPES[clampi(shape, 0, 2)]


func use_name() -> String:
	return USES[clampi(use, 0, 2)]


func carry_name() -> String:
	return CARRIES[clampi(carry, 0, 5)]


## how a thing held this way is carried while she does other things, and whether it's kept upright: [how, upright].
## What its grip says; left alone, in front of her and upright if it's drunk from, else at her side
static func carry_of(grip: Dictionary) -> Array:
	var how := String(grip.get("carry", ""))
	var up := bool(grip.get("upright", false))
	if how == "":
		how = "front" if String(grip.get("use", "")) == "drink" else "side"
		up = up or String(grip.get("use", "")) == "drink"
	return [how, up]


## the grip under a thing (or the thing itself); null when it has none
static func of(thing: Node) -> HSGrip:
	if thing == null:
		return null
	if thing is HSGrip:
		return thing
	for n in thing.find_children("*", "Node3D", true, false):
		if n is HSGrip:
			return n
	return null


## how a thing is held: {xform (the grip's frame in the thing's own space), size, length, shape, use, mouth, tip (in
## the thing's own space), hand ("" either, "r", "l"), guessed}: from its HSGrip, else guessed from its size
static func grip_of(thing: Node3D) -> Dictionary:
	var g := of(thing)
	if g == null:
		return guess(thing)
	var x := thing.global_transform.affine_inverse() * g.global_transform
	return {"xform": x, "size": g.size, "length": g.length, "shape": g.shape_name(), "use": g.use_name(), "mouth": x * g.mouth, "tip": x * g.tip, "hand": ["", "r", "l"][clampi(g.hand, 0, 2)], "carry": g.carry_name(), "upright": g.upright, "guessed": false}


## a grip guessed from a thing's own size: its longest side the handle, taken a third of the way up from the end
## nearer the thing's own origin (a model's origin is by its handle or its base); round things in the whole hand
static func guess(thing: Node3D) -> Dictionary:
	var box := AABB()
	var any := false
	var inv := thing.global_transform.affine_inverse()
	var list: Array = thing.find_children("*", "MeshInstance3D", true, false)
	if thing is MeshInstance3D:
		list.append(thing)
	for mi in list:
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		var b := (inv * m.global_transform) * m.get_aabb()
		box = b if not any else box.merge(b)
		any = true
	if not any:
		return {"xform": Transform3D.IDENTITY, "size": 0.035, "length": 0.1, "shape": "handle", "use": "", "mouth": Vector3(0, 0.08, 0), "tip": Vector3(0, 0.2, 0), "hand": "", "guessed": true}
	var s := box.size * thing.global_transform.basis.get_scale()          # its size in the world
	var ax := 0
	for i in 3:
		if s[i] > s[ax]:
			ax = i
	var o1 := (ax + 1) % 3
	var o2 := (ax + 2) % 3
	var thin := o1 if s[o1] <= s[o2] else o2
	var centre := box.get_center()
	var y := Vector3.ZERO
	y[ax] = 1.0
	if centre[ax] < 0.0:                                # the long way runs from the end nearer its origin to the far one
		y[ax] = -1.0
	var z := Vector3.ZERO
	z[thin] = 1.0
	var x := y.cross(z)
	var round_thing := s[ax] < 1.35 * maxf(s[o1], s[o2])
	var at := centre
	if not round_thing and s[ax] > 0.2:
		at = centre - y * (box.size[ax] * (0.5 - 0.3))
	var far := centre + y * (box.size[ax] * 0.5)
	var size := clampf((s[o1] + s[o2]) * 0.5 if round_thing else minf(s[o1], s[o2]), 0.006, 0.12)
	return {"xform": Transform3D(Basis(x, y, z), at), "size": size, "length": clampf(s[ax], 0.02, 0.8), "shape": "ball" if round_thing else "handle", "use": "", "mouth": far, "tip": far, "hand": "", "guessed": true}
