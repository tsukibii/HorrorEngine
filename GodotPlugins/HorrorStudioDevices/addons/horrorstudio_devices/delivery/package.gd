@icon("res://addons/horrorstudio_devices/icons/package.svg")
class_name HSPackage
extends Node3D
## A parcel (HorrorStudio Devices; the user, 2026-11-10: "create an 'amazon' package box for the arrived goods, and
## unboxed (press e to unbox/add to inventory)"). The laptop's shop leaves one where its `deliver_to` says, with what was
## ordered in it; or put one in a level by hand and give it `items` (a parcel waiting on the porch). E on it (the
## starter's player calls use() on what it looks at): the tape is cut, its four flaps swing open in turn (the model's
## parts: `propgen_part` hinges, in the order its `propgen_parcel` gives), what's inside is shown a moment and then goes
## into the pocket with its own models (the Story's give: the HUD's row peeks); the box stays where it is, open and
## empty. With `take_on_open` off, E opens it and E again takes what's inside.
## The prefab is delivery/package.tscn: the prop generator's `parcel` (a customizable recipe: its print, its tape and its
## label are its own pictures, PROPGEN §34). Its sounds: a knock and the box set down when it arrives, the tape, the
## flaps.

signal arrived                                       ## set down where it was sent (its knock and its thud)
signal opened                                        ## its tape cut and its flaps open
signal unboxed(items: Array, counts: Array)          ## what was in it gone into the pocket

const SOUNDS := "res://addons/horrorstudio_devices/sounds/"
const LEAD := 0.3                                    # the tape's cut before the flaps begin (s)

@export var items: Array[HSShopItem] = []            ## what's in it: the laptop's delivery fills it, or set it by hand
@export var counts: PackedInt32Array = []            ## how many of each, in the same order (1 where missing)
@export var take_on_open := true                     ## E opens it and puts what's inside into the pocket; off: E opens it, E again takes them
@export_range(0.2, 3.0) var open_secs := 0.9         ## the four flaps' swing, one after another
@export var say_empty := "Empty."                    ## what the Story says when it's used again with nothing in it
@export_group("Sound")
@export var sounds := true
@export_range(-40.0, 6.0) var volume_db := -4.0

var order_number := 0                                ## the order it came for (the laptop's number); 0 when placed by hand
var is_open := false
var is_empty := false
var flaps: Array = []                                ## its flaps in the order they swing: {node, part}
var inside := AABB()                                 ## where things go in it (its own space): the model's `propgen_inside`
var box := AABB()                                    ## the box shut (its own space)
var shown: Array = []                                ## the copies of what's inside, while they're seen
var _model: Node3D
var _t := -1.0                                       # seconds since it began to open (-1: shut)
var _taking := -1.0                                  # seconds since what's inside began to leave (-1: not yet)
var _given := false
var _sent_open := false
var _sfx := {}


func _ready() -> void:
	_find()
	for f in flaps:
		_set_flap(f, 0.0)
	add_to_group("hs_package")
	_make_body()
	_make_sounds()


# ---- what it's made of ---------------------------------------------------------------------------------------------------
func _find() -> void:
	_model = get_node_or_null("Model") as Node3D
	if _model == null:
		for c in get_children():
			if c is Node3D and not (c as Node3D).find_children("*", "MeshInstance3D", true, false).is_empty():
				_model = c
				break
	if _model == null:
		return
	var parts := {}
	var order: Array = []
	var nodes: Array = [_model]
	nodes.append_array(_model.find_children("*", "", true, false))
	for n in nodes:
		if not n.has_meta("extras"):
			continue
		var ex: Dictionary = n.get_meta("extras")
		var part = _json(ex.get("propgen_part"))
		if part is Dictionary and str(part.get("kind", "")) == "hinge":
			parts[str(part.get("name", n.name))] = {"node": n, "part": part}
		var parcel = _json(ex.get("propgen_parcel"))
		if parcel is Dictionary:
			order = parcel.get("order", [])
		var ins = _json(ex.get("propgen_inside"))
		if ins is Array and ins.size() == 2 and n is Node3D:
			var a := Vector3(float(ins[0][0]), float(ins[0][1]), float(ins[0][2]))
			var b := Vector3(float(ins[1][0]), float(ins[1][1]), float(ins[1][2]))
			inside = _to_me(n) * AABB(a, b - a)
	var names: Array = []
	for k in order:
		if parts.has(str(k)):
			names.append(str(k))
	for k in parts:
		if not k in names:
			names.append(k)
	for k in names:
		flaps.append(parts[k])
	box = HSModelSlot.bounds_of(_model, self)
	if inside.size == Vector3.ZERO:
		inside = box.grow(-0.006)


func _json(v: Variant) -> Variant:
	return JSON.parse_string(v) if v is String else v    # (the exporter writes its extras as JSON text)


func _to_me(n: Node) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var p: Node = n
	while p != null and p != self:
		if p is Node3D:
			xf = (p as Node3D).transform * xf
		p = p.get_parent()
	return xf


## a flap between shut (0) and open (1), about its hinge as the model's part says
func _set_flap(f: Dictionary, k: float) -> void:
	var part: Dictionary = f["part"]
	var ax: Array = part.get("axis", [1.0, 0.0, 0.0])
	var axis := Vector3(float(ax[0]), float(ax[1]), float(ax[2])).normalized()
	var ang := lerpf(float(part.get("shut", 0.0)), float(part.get("open", 100.0)), k) - float(part.get("built", 0.0))
	(f["node"] as Node3D).basis = Basis(axis, deg_to_rad(ang))


func _make_body() -> void:
	if get_node_or_null("Body") != null:
		return
	var b := StaticBody3D.new()                       # so the player's E finds it, and it stands in the way
	b.name = "Body"
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	var bb := box if box.size != Vector3.ZERO else AABB(Vector3(-0.15, 0, -0.115), Vector3(0.3, 0.16, 0.23))
	bs.size = bb.size
	cs.shape = bs
	cs.position = bb.get_center()
	b.add_child(cs)
	add_child(b)


func _make_sounds() -> void:
	for nm in ["knock", "thud", "tape", "flaps"]:
		var p: String = SOUNDS + str(nm) + ".ogg"
		if not ResourceLoader.exists(p):
			continue
		var a := AudioStreamPlayer3D.new()
		a.name = "Sound_" + nm
		a.stream = load(p)
		a.volume_db = volume_db + (4.0 if nm == "knock" else 0.0)
		a.unit_size = 4.0 if nm == "knock" else 1.5
		a.max_distance = 30.0 if nm == "knock" else 12.0
		add_child(a)
		a.position = Vector3(0, box.end.y * 0.5, 0)
		_sfx[nm] = a


## one of its sounds (knock, thud, tape, flaps)
func sound(nm: String, delay := 0.0) -> void:
	if not sounds or not _sfx.has(nm):
		return
	var a: AudioStreamPlayer3D = _sfx[nm]
	if delay > 0.0:
		get_tree().create_timer(delay, false).timeout.connect(func() -> void:
			if is_instance_valid(a):
				a.play())
	else:
		a.play()


# ---- arriving, opening, taking ----------------------------------------------------------------------------------------------
## set down where it was sent: a knock (`knock`), then the box on the floor
func arrive(knock := true) -> void:
	if knock:
		sound("knock")
	sound("thud", 1.1 if knock else 0.0)
	arrived.emit()


## E on it: shut, it opens (and what's inside goes into the pocket, `take_on_open`); open, what's still inside is taken;
## empty, the Story says so
func use(_by: Node = null) -> void:
	if not is_open:
		unbox()
	elif not is_empty and _taking < 0.0 and _t >= LEAD + open_secs:
		take()
	elif is_empty and say_empty != "":
		var st := get_tree().get_first_node_in_group("hs_story")
		if st != null and st.has_method("say"):
			st.say(say_empty)


## the tape cut, the flaps swung open in turn, what's inside seen
func unbox() -> void:
	if is_open:
		return
	is_open = true
	_t = 0.0
	sound("tape")
	sound("flaps", LEAD)
	_show_goods()
	if shown.is_empty() and items.is_empty():
		is_empty = true


## what's inside out of the box and into the pocket: each copy rises and is gone, then the Story gets them
func take() -> void:
	if is_empty or _taking >= 0.0:
		return
	_taking = 0.0


## how many of items[i] it holds
func count_at(i: int) -> int:
	return maxi(counts[i], 1) if i < counts.size() else 1


func _process(dt: float) -> void:
	if _t >= 0.0 and _t < LEAD + open_secs + 1.0:
		_t += dt
		var n := flaps.size()
		for i in n:
			# each flap's own stretch of the swing: the long ones first (they lie over the short ones), overlapping
			var a := LEAD + open_secs * (0.0 if i < 2 else 0.42) + (0.06 * (i % 2))
			var k := clampf((_t - a) / (open_secs * 0.55), 0.0, 1.0)
			_set_flap(flaps[i], 1.0 - pow(1.0 - k, 3.0))
		if not _sent_open and _t >= LEAD + open_secs:
			_sent_open = true
			opened.emit()
			if take_on_open and not is_empty:
				take()
	if _taking >= 0.0 and not _given:
		_taking += dt
		var m := shown.size()
		for i in m:
			var c: Node3D = shown[i]
			if not is_instance_valid(c):
				continue
			var k := clampf((_taking - 0.25 - 0.07 * i) / 0.45, 0.0, 1.0)
			var e := k * k * (3.0 - 2.0 * k)
			c.position = c.get_meta("rest_pos") + Vector3(0, 0.24 * e, 0)
			c.scale = c.get_meta("rest_scale") * maxf(1.0 - e, 0.02)
		if _taking >= 0.25 + 0.07 * maxi(m - 1, 0) + 0.45:
			_give()


func _give() -> void:
	_given = true
	for c in shown:
		if is_instance_valid(c):
			c.queue_free()
	shown.clear()
	var p := get_tree().get_first_node_in_group("hs_player")
	for i in items.size():
		if items[i] != null:
			items[i].give_to(get_tree(), count_at(i), p)
	is_empty = true
	unboxed.emit(items, Array(counts))


# ---- what's inside, shown ------------------------------------------------------------------------------------------------
## copies of what's in it laid in its inside: a model an order (at most four of each), too tall laid down along its
## length, rows across it and layers up it, all made smaller together when they don't fit
func _show_goods() -> void:
	var copies: Array = []
	for i in items.size():
		var it: HSShopItem = items[i]
		if it == null or it.model == null:
			continue
		var n := clampi(ceili(float(count_at(i)) / float(maxi(it.count, 1))), 1, 4)
		for j in n:
			var c := HSModelSlot.of_scene(it.model)
			if c != null:
				copies.append(c)
	if copies.is_empty():
		return
	var room := inside.grow(-0.004)
	var sizes: Array = []
	for c in copies:
		var b := HSModelSlot.bounds_of(c, c)
		if b.size.y > room.size.y * 0.92 and b.size.y > b.size.x:     # too tall: on its side along the box
			c.rotate_z(PI * 0.5)
			b = c.transform * HSModelSlot.bounds_of(c, c)
		sizes.append(b)
	var s := 1.0                                     # shrink all of them until the rows and layers fit
	for attempt in 12:
		if _lay(copies, sizes, room, s, false):
			break
		s *= 0.85
	_lay(copies, sizes, room, s, true)
	var all := AABB()                                # then the lot moved to the middle of its floor
	for i in copies.size():
		var c: Node3D = copies[i]
		var b: AABB = sizes[i]
		var a := AABB(c.position + b.position * s, b.size * s)
		all = a if i == 0 else all.merge(a)
	var shift := room.get_center() - all.get_center()
	shift.y = 0.0
	for c in copies:
		c.position += shift
		add_child(c)
		c.set_meta("rest_pos", c.position)
		c.set_meta("rest_scale", c.scale)
		shown.append(c)


func _lay(copies: Array, sizes: Array, room: AABB, s: float, place: bool) -> bool:
	var gap := 0.008
	var x := room.position.x
	var z := room.position.z
	var y := room.position.y
	var row_d := 0.0
	var layer_h := 0.0
	var fits := true
	for i in copies.size():
		var b: AABB = sizes[i]
		var w := b.size.x * s
		var d := b.size.z * s
		var h := b.size.y * s
		if x + w > room.end.x + 1e-4 and x > room.position.x:    # the next row
			x = room.position.x
			z += row_d + gap
			row_d = 0.0
		if z + d > room.end.z + 1e-4 and z > room.position.z:    # the next layer up
			z = room.position.z
			x = room.position.x
			y += layer_h + gap
			layer_h = 0.0
			row_d = 0.0
		if w > room.size.x + 1e-4 or d > room.size.z + 1e-4 or y + h > room.end.y + 0.02:
			fits = false
		if place:
			var c: Node3D = copies[i]
			c.scale = Vector3.ONE * s
			# its box's corner to (x, y, z): the copy's origin moved by where its box starts
			c.position = Vector3(x, y, z) - b.position * s
		x += w + gap
		row_d = maxf(row_d, d)
		layer_h = maxf(layer_h, h)
	return fits
