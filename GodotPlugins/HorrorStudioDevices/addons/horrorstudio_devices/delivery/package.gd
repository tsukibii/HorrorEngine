@icon("res://addons/horrorstudio_devices/icons/package.svg")
class_name HSPackage
extends Node3D
## A parcel (HorrorStudio Devices; the user, 2026-11-10: "create an 'amazon' package box for the arrived goods, and
## unboxed (press e to unbox/add to inventory)", then "items absorbed towards the player (think minecraft drop item
## collection) that get sucked in toward the player and the box poofs disappears, this is so we can create the illusion
## of bigger items like shotgun fitting inside"). The laptop's shop leaves one where its `deliver_to` says with what was
## ordered in it; or put one in a level by hand and give it `items` (a parcel waiting on the porch).
## E on it (the starter's player calls use() on what it looks at): the tape torn, the box jumps, its four flaps burst
## open (the model's parts: `propgen_part` hinges) and it's gone in a puff of card dust and bits. Out of the puff each
## thing pops up at its own size (the box never has to hold it: a shotgun comes out of a shoebox), turns in the air a
## moment, then is pulled to the player, faster as it comes, shrinking into them with a pop, and is in the pocket as it
## arrives (the Story's give: its own model in the HUD's row). With `keep_box` the flaps open and the box stays, open and
## empty, the things flying out of it all the same.
## The prefab is delivery/package.tscn: the prop generator's `parcel` (a customizable recipe: its print, tape and label are
## its own pictures, PROPGEN §34). Its sounds: a knock and the box set down when it arrives; the tape, the poof, a pop a
## thing.

signal arrived                                       ## set down where it was sent (its knock and its thud)
signal opened                                        ## E: the tape torn and the box burst (or, `keep_box`, its flaps open)
signal taken(item: HSShopItem, count: int)           ## a thing pulled into the player: `count` more of it in the pocket
signal unboxed(items: Array, counts: Array)          ## all of it in the pocket (and the box, unless kept, gone)

const SOUNDS := "res://addons/horrorstudio_devices/sounds/"
const BURST := 0.2                                   # seconds from E to the puff (the squash, the stretch, the flaps flung)
const HANG := 0.42                                   # a thing's seconds in the air before the player pulls it in

@export var items: Array[HSShopItem] = []            ## what's in it: the laptop's delivery fills it, or set it by hand
@export var counts: PackedInt32Array = []            ## how many of each, in the same order (1 where missing)
@export var keep_box := false                        ## off: E bursts the box and it's gone in a puff; on: its flaps open and it stays, empty
@export_range(1, 8) var copies_max := 4              ## the most of one thing seen flying (ten pairs of batteries: four flying, the ten pocketed)
@export_range(0.25, 4.0) var pull := 1.0             ## how hard the player pulls them in (their speed)
@export_range(0.2, 3.0) var open_secs := 0.9         ## the flaps' swing when the box is kept
@export var say_empty := "Empty."                    ## what the Story says when a kept box is used again
@export_group("Sound")
@export var sounds := true
@export_range(-40.0, 6.0) var volume_db := -4.0

var order_number := 0                                ## the order it came for (the laptop's number); 0 when placed by hand
var is_open := false
var is_empty := false
var flaps: Array = []                                ## its flaps in the order they swing: {node, part}
var inside := AABB()                                 ## where things were in it (its own space): the model's `propgen_inside`
var box := AABB()                                    ## the box shut (its own space)
var flying: Array = []                               ## what's in the air: {node, item, count, age, vel, spin, from_d, i}
var puff: Array = []                                 ## the burst's particles (the dust, the bits)
var _model: Node3D
var _body: StaticBody3D
var _t := -1.0                                       # seconds since E (-1: shut)
var _queue: Array = []                               # what's still to come out: {item, count, at, i}
var _burst := false
var _finished := false
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
	_body = get_node_or_null("Body") as StaticBody3D
	if _body != null:
		return
	_body = StaticBody3D.new()                        # so the player's E finds it, and it stands in the way
	_body.name = "Body"
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	var bb := box if box.size != Vector3.ZERO else AABB(Vector3(-0.15, 0, -0.115), Vector3(0.3, 0.16, 0.23))
	bs.size = bb.size
	cs.shape = bs
	cs.position = bb.get_center()
	_body.add_child(cs)
	add_child(_body)


func _make_sounds() -> void:
	for nm in ["knock", "thud", "tape", "poof", "pop", "flaps"]:
		var p: String = SOUNDS + str(nm) + ".ogg"
		if not ResourceLoader.exists(p):
			continue
		var a := AudioStreamPlayer3D.new()
		a.name = "Sound_" + nm
		a.stream = load(p)
		a.volume_db = volume_db + (4.0 if nm == "knock" else 0.0)
		a.unit_size = 4.0 if nm == "knock" else 1.5
		a.max_distance = 30.0 if nm == "knock" else 12.0
		a.max_polyphony = 4 if nm == "pop" else 1
		add_child(a)
		a.position = Vector3(0, box.end.y * 0.5, 0)
		_sfx[nm] = a


## one of its sounds (knock, thud, tape, poof, pop, flaps), `pitch` its playback rate
func sound(nm: String, delay := 0.0, pitch := 1.0) -> void:
	if not sounds or not _sfx.has(nm):
		return
	var a: AudioStreamPlayer3D = _sfx[nm]
	if delay > 0.0:
		get_tree().create_timer(delay, false).timeout.connect(func() -> void:
			if is_instance_valid(a):
				a.pitch_scale = pitch
				a.play())
	else:
		a.pitch_scale = pitch
		a.play()


# ---- arriving, opening -------------------------------------------------------------------------------------------------------
## set down where it was sent: a knock (`knock`), then the box on the floor
func arrive(knock := true) -> void:
	if knock:
		sound("knock")
	sound("thud", 1.1 if knock else 0.0)
	arrived.emit()


## E on it: shut, it's opened and what's inside comes out to the player; a kept box used again with nothing in it: the
## Story says so
func use(_by: Node = null) -> void:
	if not is_open:
		unbox()
	elif is_empty and keep_box and say_empty != "":
		var st := get_tree().get_first_node_in_group("hs_story")
		if st != null and st.has_method("say"):
			st.say(say_empty)


## the tape torn; the box bursts in a puff (or opens, `keep_box`); what's inside comes out to the player
func unbox() -> void:
	if is_open:
		return
	is_open = true
	_t = 0.0
	sound("tape")
	if keep_box:
		sound("flaps", 0.05)
	_queue.clear()
	var k := 0
	for i in items.size():                            # each thing seen as a few copies of its model, its count shared among them
		var it: HSShopItem = items[i]
		if it == null:
			continue
		var count := count_at(i)
		var n := clampi(ceili(float(count) / float(maxi(it.count, 1))), 1, mini(copies_max, count))
		for j in n:
			var share := count / n + (1 if j < count % n else 0)
			_queue.append({"item": it, "count": share, "at": (BURST if not keep_box else open_secs * 0.6) + 0.02 + 0.07 * k, "i": k})
			k += 1
	if _queue.is_empty():
		is_empty = true


## how many of items[i] it holds
func count_at(i: int) -> int:
	return maxi(counts[i], 1) if i < counts.size() else 1


func _process(dt: float) -> void:
	if _t < 0.0 or _finished:
		return
	_t += dt
	if keep_box:
		for i in flaps.size():                         # the flaps in turn, the long ones first
			var a := open_secs * (0.0 if i < 2 else 0.42) + 0.06 * (i % 2)
			var k := clampf((_t - a) / (open_secs * 0.55), 0.0, 1.0)
			_set_flap(flaps[i], 1.0 - pow(1.0 - k, 3.0))
		if _t >= open_secs * 0.6 and not _burst:
			_burst = true
			opened.emit()
	else:
		_bursting()
	for q in _queue.duplicate():                      # out of the puff (or the open box), each in its turn
		if _t >= float(q["at"]):
			_queue.erase(q)
			_launch(q)
	for f in flying.duplicate():
		_fly(f, dt)
	if _queue.is_empty() and flying.is_empty() and _t > (BURST + 1.0 if not keep_box else open_secs + 0.2):
		_finished = true
		is_empty = true
		unboxed.emit(items, Array(counts))
		if not keep_box:
			queue_free()


# the box's last moment: it squashes, stretches as its flaps are flung, and is gone in the puff
func _bursting() -> void:
	if _model == null:
		return
	var t := _t
	var sy := 1.0
	var sxz := 1.0
	if t < 0.08:
		var k := t / 0.08
		sy = lerpf(1.0, 0.9, k)
		sxz = lerpf(1.0, 1.06, k)
	elif t < BURST:
		var k := (t - 0.08) / (BURST - 0.08)
		sy = lerpf(0.9, 1.12, k)
		sxz = lerpf(1.06, 0.96, k)
	else:
		var k := clampf((t - BURST) / 0.09, 0.0, 1.0)
		sy = lerpf(1.12, 0.0, k)
		sxz = lerpf(0.96, 0.0, k)
	_model.scale = Vector3(sxz, sy, sxz)
	var fk := clampf((t - 0.06) / 0.14, 0.0, 1.0)
	for f in flaps:
		_set_flap(f, 1.0 - pow(1.0 - fk, 3.0))
	if t >= BURST and not _burst:
		_burst = true
		_poof()
		opened.emit()
	if t >= BURST + 0.09 and _model.visible:
		_model.visible = false


func _poof() -> void:
	sound("poof")
	if _body != null:                                 # nothing there to walk into or use any more
		_body.collision_layer = 0
		_body.collision_mask = 0
	var c := box.get_center()
	var dust := CPUParticles3D.new()                  # card dust, rising a little and spreading
	dust.name = "Poof"
	dust.one_shot = true
	dust.explosiveness = 0.92
	dust.amount = 22
	dust.lifetime = 0.9
	dust.local_coords = false
	var q := QuadMesh.new()
	q.size = Vector2(0.24, 0.24)
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = _soft_dot()
	m.roughness = 1.0
	m.metallic_specular = 0.0
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	q.material = m
	dust.mesh = q
	dust.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	dust.emission_box_extents = box.size * 0.45
	dust.direction = Vector3.UP
	dust.spread = 180.0
	dust.initial_velocity_min = 0.5
	dust.initial_velocity_max = 1.4
	dust.gravity = Vector3(0, 0.3, 0)
	dust.damping_min = 2.5
	dust.damping_max = 4.0
	dust.angle_min = -180.0
	dust.angle_max = 180.0
	dust.angular_velocity_min = -90.0
	dust.angular_velocity_max = 90.0
	dust.scale_amount_min = 0.8
	dust.scale_amount_max = 1.6
	var sc := Curve.new()
	sc.add_point(Vector2(0.0, 0.45))
	sc.add_point(Vector2(0.3, 1.0))
	sc.add_point(Vector2(1.0, 1.5))
	dust.scale_amount_curve = sc
	var g := Gradient.new()
	g.set_color(0, Color(0.72, 0.6, 0.46, 0.6))
	g.set_color(1, Color(0.55, 0.52, 0.48, 0.0))
	dust.color_ramp = g
	add_child(dust)
	dust.position = c
	var bits := CPUParticles3D.new()                  # torn bits of card flung out, gone before they'd land
	bits.name = "Bits"
	bits.one_shot = true
	bits.explosiveness = 1.0
	bits.amount = 10
	bits.lifetime = 0.55
	bits.local_coords = false
	var bm := BoxMesh.new()
	bm.size = Vector3(0.035, 0.003, 0.025)
	var bmat := StandardMaterial3D.new()
	bmat.albedo_color = Color(0.71, 0.53, 0.36)
	bmat.roughness = 0.9
	bm.material = bmat
	bits.mesh = bm
	bits.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	bits.emission_box_extents = box.size * 0.35
	bits.direction = Vector3.UP
	bits.spread = 70.0
	bits.initial_velocity_min = 1.2
	bits.initial_velocity_max = 2.6
	bits.gravity = Vector3(0, -9.8, 0)
	bits.particle_flag_rotate_y = true
	bits.angle_min = -180.0
	bits.angle_max = 180.0
	bits.angular_velocity_min = -600.0
	bits.angular_velocity_max = 600.0
	var bc := Curve.new()
	bc.add_point(Vector2(0.0, 1.0))
	bc.add_point(Vector2(0.6, 1.0))
	bc.add_point(Vector2(1.0, 0.0))
	bits.scale_amount_curve = bc
	add_child(bits)
	bits.position = c
	puff = [dust, bits]
	dust.emitting = true
	bits.emitting = true


func _soft_dot() -> Texture2D:
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	g.add_point(0.45, Color(1, 1, 1, 0.55))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	t.width = 64
	t.height = 64
	return t


# ---- what's inside, out to the player ---------------------------------------------------------------------------------------
# a thing out of the puff (or the box): a copy of its own model at its own size, popping up and out, turning
func _launch(q: Dictionary) -> void:
	var it: HSShopItem = q["item"]
	var node: Node3D = HSModelSlot.of_scene(it.model) if it.model != null else null
	if node == null:                                  # nothing to see: straight into the pocket
		_absorbed({"node": null, "item": it, "count": q["count"], "i": q["i"]})
		return
	node.name = "Out_" + it.id
	node.top_level = true
	add_child(node)
	var mid := HSModelSlot.bounds_of(node, node).get_center()   # its middle in its own space: it turns and sizes about it
	var from := global_transform * box.get_center()
	if keep_box:
		from = global_transform * Vector3(inside.get_center().x, inside.end.y, inside.get_center().z)
	node.global_transform = Transform3D(Basis() * 0.3, from - mid * 0.3)
	var i := int(q["i"])
	var a := TAU * float(i) * 0.38 + randf_range(-0.4, 0.4)
	var out := randf_range(0.55, 1.05)
	var vel := Vector3(cos(a) * out, randf_range(2.4, 3.0), sin(a) * out)
	flying.append({"node": node, "item": it, "count": q["count"], "age": 0.0, "vel": vel, "s": 0.3,
			"spin": randf_range(2.2, 3.6) * (1.0 if i % 2 == 0 else -1.0), "mid": mid, "from_d": -1.0, "pulled": 0.0, "i": i})


# where the player takes things in: a little under the eye and in front of it (their chest, their hands)
func _target() -> Vector3:
	var p := get_tree().get_first_node_in_group("hs_player") as Node3D
	var eye: Node3D = p.get_node_or_null("Eye") as Node3D if p != null else null
	if eye == null:
		eye = get_viewport().get_camera_3d()
	if eye == null:
		return global_position + Vector3(0, 2.0, 0)
	var b := eye.global_basis
	return eye.global_position - b.y * 0.28 - b.z * 0.12


func _fly(f: Dictionary, dt: float) -> void:
	var node: Node3D = f["node"]
	if not is_instance_valid(node):
		flying.erase(f)
		return
	f["age"] = float(f["age"]) + dt
	var age: float = f["age"]
	var vel: Vector3 = f["vel"]
	var mid: Vector3 = f["mid"]
	var rot := node.global_basis.orthonormalized()
	var s: float = f["s"]
	var at := node.global_position + rot * (mid * s)  # its middle now
	if age < HANG:                                    # out of the puff: up, out, turning, growing to its own size
		vel += Vector3(0, -9.8, 0) * dt
		var k := clampf(age / 0.18, 0.0, 1.0)
		s = lerpf(0.3, 1.0, 1.0 - pow(1.0 - k, 3.0))
	else:                                             # pulled to the player, faster as it comes, shrinking into them
		var to := _target() - at
		var d := to.length()
		if float(f["from_d"]) < 0.0:
			f["from_d"] = maxf(d, 0.3)
		f["pulled"] = float(f["pulled"]) + dt
		var speed := lerpf(1.5, 10.0, clampf(float(f["pulled"]) / 0.45, 0.0, 1.0)) * pull
		vel = vel.lerp(to.normalized() * speed, clampf(dt * 9.0, 0.0, 1.0))
		s = clampf(d / float(f["from_d"]), 0.06, 1.0)
		if d < 0.2 or float(f["pulled"]) > 1.6:
			node.queue_free()
			flying.erase(f)
			_absorbed(f)
			return
	f["vel"] = vel
	f["s"] = s
	rot = Basis(Vector3.UP, float(f["spin"]) * dt) * rot                 # turned and sized about its middle
	var at1 := at + vel * dt
	node.global_transform = Transform3D(rot * s, at1 - rot * (mid * s))


# a thing taken in: into the pocket, with a pop a little higher each time
func _absorbed(f: Dictionary) -> void:
	var it: HSShopItem = f["item"]
	sound("pop", 0.0, minf(1.0 + 0.07 * float(f["i"]), 1.6))
	it.give_to(get_tree(), int(f["count"]), get_tree().get_first_node_in_group("hs_player"))
	taken.emit(it, int(f["count"]))
