@icon("res://addons/horrorstudio_weapons/icons/impact.svg")
class_name HSImpacts
extends Node3D
## Where shots land: plays an HSImpact at a hit (DECISIONS 2026-11-09, latest). One in a scene, made by the first shot
## (`HSImpacts.of(get_tree())`), holding the marks it's left (the oldest go past each impact's `keep`).
##
## A hit's surface is what it's made of: a collider's (or its parents') `hs_surface` metadata, its `acoustic` one (the
## sound physics' word), the starter's Sound node's rooms (each room's floor, walls and ceiling from the interior's
## export), else plaster. SURFACES says how each looks broken: the mark's tint, the dust's and the chips' colours,
## sparks, how big the mark is; an impact's `surfaces` can change them.
##
## A blast (an impact with a `radius_m`): its fireball (an HSMuzzle laid out as a burst at the hit, facing out of the
## surface), what it reaches within the radius and in its line of sight pushed (RigidBody3D) and told (shot(info), its
## `damage` falling to nothing at the edge, `blast` true), the view shaken near it, listeners hearing it, the ears
## ringing, its sound. `play` returns what a blast reached, as hits (HSShotgun adds them to its shot's).

const DIR := "res://addons/horrorstudio_weapons/"
const MARK_MASK := 0x3FFFF                               # every layer but 19 (only in mirrors) and 20 (the gun in your hands)
const SURFACES := {
	"plaster": {"tint": Color(0.95, 0.93, 0.88), "dust": Color(0.9, 0.88, 0.83), "chip": Color(0.93, 0.91, 0.87), "sparks": 0.0, "size": 1.0},
	"concrete": {"tint": Color(0.66, 0.65, 0.62), "dust": Color(0.7, 0.68, 0.64), "chip": Color(0.6, 0.59, 0.56), "sparks": 0.2, "size": 0.85},
	"stone": {"tint": Color(0.6, 0.58, 0.55), "dust": Color(0.66, 0.64, 0.6), "chip": Color(0.55, 0.53, 0.5), "sparks": 0.3, "size": 0.8},
	"tile": {"tint": Color(0.94, 0.93, 0.9), "dust": Color(0.92, 0.92, 0.9), "chip": Color(0.97, 0.97, 0.95), "sparks": 0.1, "size": 1.1},
	"wood": {"tint": Color(0.86, 0.7, 0.48), "dust": Color(0.64, 0.52, 0.38), "chip": Color(0.74, 0.58, 0.38), "sparks": 0.0, "size": 0.9, "splinters": true},
	"door": {"tint": Color(0.86, 0.7, 0.48), "dust": Color(0.64, 0.52, 0.38), "chip": Color(0.74, 0.58, 0.38), "sparks": 0.0, "size": 0.9, "splinters": true},
	"metal": {"tint": Color(0.42, 0.42, 0.44), "dust": Color(0.45, 0.45, 0.47), "chip": Color(0.62, 0.62, 0.64), "sparks": 1.0, "size": 0.45, "dust_k": 0.25, "chips_k": 0.3},
	"glass": {"tint": Color(0.8, 0.86, 0.88), "dust": Color(0.92, 0.96, 0.98), "chip": Color(0.85, 0.93, 0.96), "sparks": 0.0, "size": 0.8},
	"plastic": {"tint": Color(0.92, 0.92, 0.92), "dust": Color(0.9, 0.9, 0.9), "chip": Color(0.92, 0.92, 0.92), "sparks": 0.0, "size": 0.9},
	"carpet": {"tint": Color(0.36, 0.3, 0.28), "dust": Color(0.52, 0.46, 0.42), "chip": Color(0.42, 0.35, 0.32), "sparks": 0.0, "size": 0.6, "chips_k": 0.4},
	"cloth": {"tint": Color(0.42, 0.38, 0.36), "dust": Color(0.6, 0.56, 0.52), "chip": Color(0.5, 0.45, 0.42), "sparks": 0.0, "size": 0.6, "chips_k": 0.4},
	"tatami": {"tint": Color(0.72, 0.66, 0.46), "dust": Color(0.7, 0.66, 0.5), "chip": Color(0.76, 0.7, 0.5), "sparks": 0.0, "size": 0.7, "splinters": true},
	"water": {"tint": Color(1, 1, 1), "dust": Color(0.86, 0.9, 0.95), "chip": Color(0.8, 0.86, 0.92), "sparks": 0.0, "size": 0.0, "mark": false, "chips_k": 0.0},
}

var marks: Array = []                                   ## the marks in the world, oldest first
var last := {}                                          ## the last impact, a check's: {surface, mark, dust, chips, sparks, blast}
var blasts := 0                                         ## blasts so far

var _tex := {}
var _chip: Mesh
var _splinter: Mesh
var _puff: Mesh
var _spark: Mesh


## The scene's HSImpacts (made under the running scene the first time).
static func of(tree: SceneTree) -> HSImpacts:
	var n := tree.get_first_node_in_group("hs_impacts") as HSImpacts
	if n != null:
		return n
	n = HSImpacts.new()
	n.name = "Impacts"
	var host: Node = tree.current_scene if tree.current_scene != null else tree.root
	host.add_child(n)
	return n


func _init() -> void:
	add_to_group("hs_impacts")


## One hit (`{point, normal, collider, dir, from}`): its mark, its debris (`debris` false: the mark alone), its blast.
## Returns what a blast reached, as hits.
func play(imp: HSImpact, hit: Dictionary, debris := true) -> Array:
	if imp == null:
		imp = default_impact()
	var kind := surface_of(hit)
	var look := surface_look(kind, imp)
	var d := _mark(imp, hit, look)
	var info := {"surface": kind, "mark": d, "dust": 0, "chips": 0, "sparks": 0, "blast": []}
	if debris:
		_debris(imp, hit, look, info)
	if imp.radius_m > 0.0:
		info["blast"] = _blast(imp, hit)
	last = info
	return info["blast"]


## A shot's hits: a mark for each, debris for the first `debris_max`; what blasts reached, as hits.
func play_shot(imp: HSImpact, hits: Array) -> Array:
	if imp == null:
		imp = default_impact()
	var out: Array = []
	for i in hits.size():
		out.append_array(play(imp, hits[i], i < imp.debris_max))
	return out


## The plugin's pellet impact.
static func default_impact() -> HSImpact:
	var r = load(DIR + "impacts/pellet.tres")
	return r if r is HSImpact else HSImpact.new()


## What a hit is made of (see the class doc): a word of SURFACES.
func surface_of(hit: Dictionary) -> String:
	var n := hit.get("collider") as Node
	var k := n
	for i in 5:
		if k == null:
			break
		if k.has_meta("hs_surface"):
			return str(k.get_meta("hs_surface"))
		if k.has_meta("acoustic"):
			return str(k.get_meta("acoustic"))
		k = k.get_parent()
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null:
		var s := ""
		if snd.has_method("surface_of"):
			s = str(snd.surface_of(hit))
		elif snd.has_method("_surface"):
			s = str(snd.call("_surface", hit))
		if s != "":
			return s
	return "plaster"


## How a surface looks broken: SURFACES' row (plaster's for one it doesn't know).
func surface_look(kind: String, _imp: HSImpact = null) -> Dictionary:
	return SURFACES.get(kind, SURFACES["plaster"])


# ---- the mark ----------------------------------------------------------------------------------------------------

func _mark(imp: HSImpact, hit: Dictionary, look: Dictionary) -> Decal:
	if imp.mark == "none" or not bool(look.get("mark", true)) or float(look.get("size", 1.0)) <= 0.0:
		return null
	var variants := 4 if imp.mark == "crater" else 2
	var v := randi() % variants
	var nm := "%s_%d" % [imp.mark, v]
	var d := Decal.new()
	d.name = "Mark"
	d.texture_albedo = _t(nm + "_albedo")
	d.texture_normal = _t(nm + "_normal")
	d.texture_orm = _t(nm + "_orm")
	var scorch := imp.mark == "scorch"
	if imp.embers_s > 0.0:
		d.texture_emission = _t(nm + "_emission")
		d.emission_energy = imp.embers_energy
	var s := imp.mark_size_m * (1.0 if scorch else float(look.get("size", 1.0))) * randf_range(1.0 - imp.mark_jitter, 1.0 + imp.mark_jitter)
	d.size = Vector3(s, clampf(s * 0.6, 0.05, 0.6), s)
	d.modulate = Color.WHITE if scorch else (look.get("tint", Color.WHITE) as Color)
	d.normal_fade = 0.35                                 # (never wrapped round a corner onto the next face)
	d.upper_fade = 0.15
	d.lower_fade = 0.15
	d.cull_mask = MARK_MASK
	d.distance_fade_enabled = true
	d.distance_fade_begin = 30.0
	d.distance_fade_length = 10.0
	var on = hit.get("collider")
	var host: Node = on if on is Node3D and is_instance_valid(on) and not (on as Node).is_queued_for_deletion() else self
	host.add_child(d)                                    # (a door swings with its holes, a crate carries them away)
	var y := (hit.get("normal", Vector3.UP) as Vector3).normalized()
	var x := y.cross(Vector3.UP if absf(y.y) < 0.9 else Vector3.RIGHT).normalized()
	d.global_transform = Transform3D(Basis(x, y, x.cross(y)).rotated(y, randf() * TAU), (hit.get("point", Vector3.ZERO) as Vector3) + y * 0.004)
	if imp.embers_s > 0.0:
		var tw := d.create_tween()                       # the embers dying: a flicker, then out
		tw.tween_property(d, "emission_energy", imp.embers_energy * 0.55, imp.embers_s * 0.25).set_trans(Tween.TRANS_SINE)
		tw.tween_property(d, "emission_energy", 0.0, imp.embers_s * 0.75).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	marks.append(d)
	while marks.size() > maxi(imp.keep, 1):
		var o = marks.pop_front()
		if is_instance_valid(o):
			o.queue_free()
	return d


func _t(nm: String) -> Texture2D:
	if not _tex.has(nm):
		_tex[nm] = HSMuzzle.tex("fx/%s.png" % nm)
	return _tex[nm]


# ---- what flies off ------------------------------------------------------------------------------------------------

func _debris(imp: HSImpact, hit: Dictionary, look: Dictionary, info: Dictionary) -> void:
	var p: Vector3 = hit.get("point", Vector3.ZERO)
	var nrm := (hit.get("normal", Vector3.UP) as Vector3).normalized()
	var at := p + nrm * 0.01
	var b := _up_along(nrm)
	var k := imp.debris_scale
	var n_dust := int(round(imp.dust * float(look.get("dust_k", 1.0))))
	if n_dust > 0:
		if _puff == null:
			_puff = HSMuzzle.puff_mesh(_t("puff"))
		var dc: Color = look.get("dust", Color(0.8, 0.78, 0.74))
		var g := Gradient.new()
		g.set_color(0, Color(dc, 0.0))
		g.set_color(1, Color(dc, 0.0))
		g.add_point(0.06, Color(dc, 0.55))
		g.add_point(0.35, Color(dc, 0.35))
		_burst(_puff, n_dust, 1.3, Vector2(0.25, 0.9) * imp.debris_speed / 1.4, 38.0, Vector3(0, -0.25, 0), Vector2(0.018, 0.045) * k, g, at, b, false, _grow(3.0), 1.8)
		info["dust"] = n_dust
	var n_chips := int(round(imp.chips * float(look.get("chips_k", 1.0))))
	if n_chips > 0:
		var splinters := bool(look.get("splinters", false))
		var cc: Color = look.get("chip", Color(0.8, 0.78, 0.74))
		var g2 := Gradient.new()
		g2.set_color(0, Color(cc, 1.0))
		g2.set_color(1, Color(cc * 0.85, 1.0))
		_burst(_splinter_mesh() if splinters else _chip_mesh(), n_chips, 0.75, Vector2(0.8, 2.4) * imp.debris_speed / 1.4, 55.0,
			Vector3(0, -7.0, 0), Vector2(0.004, 0.011) * k * (1.4 if splinters else 1.0), g2, at, b, splinters, _grow(0.6), 0.0)
		info["chips"] = n_chips
	var n_sparks := int(round(imp.sparks * float(look.get("sparks", 0.0)) * 3.0))
	if n_sparks > 0:
		if _spark == null:
			_spark = HSMuzzle.spark_mesh()
		var g3 := Gradient.new()
		g3.set_color(0, Color(1.0, 0.82, 0.45, 1.0))
		g3.set_color(1, Color(0.9, 0.25, 0.05, 0.0))
		_burst(_spark, n_sparks, 0.32, Vector2(2.0, 6.0), 62.0, Vector3(0, -6.0, 0), Vector2(0.02, 0.05), g3, at, b, true, _grow(0.3), 0.5)
		info["sparks"] = n_sparks


# a one-shot burst of particles at `at`, flying out along `b`'s Y within `spread` degrees, freed when it's done
func _burst(mesh: Mesh, amount: int, life: float, speed: Vector2, spread: float, gravity: Vector3, size: Vector2,
		ramp: Gradient, at: Vector3, b: Basis, align: bool, scale_curve: Curve, damping: float) -> CPUParticles3D:
	var e := CPUParticles3D.new()
	e.one_shot = true
	e.amount = maxi(amount, 1)
	e.lifetime = life
	e.explosiveness = 1.0
	e.local_coords = false
	e.direction = Vector3(0, 1, 0)
	e.spread = spread
	e.initial_velocity_min = speed.x
	e.initial_velocity_max = speed.y
	e.gravity = gravity
	e.damping_min = damping
	e.damping_max = damping * 1.5
	e.scale_amount_min = size.x
	e.scale_amount_max = size.y
	e.scale_amount_curve = scale_curve
	e.color_ramp = ramp
	e.particle_flag_align_y = align
	e.angle_min = -180.0
	e.angle_max = 180.0
	if not align:
		e.angular_velocity_min = -360.0
		e.angular_velocity_max = 360.0
	e.mesh = mesh
	e.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(e)
	e.global_transform = Transform3D(b, at)
	e.emitting = true
	get_tree().create_timer(life + 0.4).timeout.connect(e.queue_free)
	return e


# a size over a particle's life: `from` at its start to `to` at its end
func _grow(to: float, from := 1.0) -> Curve:
	var c := Curve.new()
	c.max_value = maxf(maxf(to, from), 1.0)
	c.add_point(Vector2(0, from))
	c.add_point(Vector2(1, to))
	return c


func _chip_mesh() -> Mesh:
	if _chip == null:
		var m := BoxMesh.new()
		m.size = Vector3(1.0, 0.45, 0.8)
		var mat := StandardMaterial3D.new()
		mat.vertex_color_use_as_albedo = true
		mat.roughness = 0.95
		m.material = mat
		_chip = m
	return _chip


func _splinter_mesh() -> Mesh:
	if _splinter == null:
		var m := BoxMesh.new()
		m.size = Vector3(0.35, 2.6, 0.25)                # long along Y: the particles' Y is their way (align_y)
		var mat := StandardMaterial3D.new()
		mat.vertex_color_use_as_albedo = true
		mat.roughness = 0.9
		m.material = mat
		_splinter = m
	return _splinter


func _up_along(nrm: Vector3) -> Basis:
	var y := nrm.normalized()
	var x := y.cross(Vector3.UP if absf(y.y) < 0.9 else Vector3.RIGHT).normalized()
	return Basis(x, y, x.cross(y))


# ---- a blast -------------------------------------------------------------------------------------------------------

func _blast(imp: HSImpact, hit: Dictionary) -> Array:
	blasts += 1
	var p: Vector3 = hit.get("point", Vector3.ZERO)
	var nrm := (hit.get("normal", Vector3.UP) as Vector3).normalized()
	var center := p + nrm * 0.08
	# the ball of fire: an HSMuzzle laid out as a burst, its -Z out of the surface; its light, sparks and smoke
	if imp.fireball != null:
		var m := HSMuzzle.new()
		m.name = "Fireball"
		m.light_energy = imp.light_energy
		add_child(m)
		var z := -nrm
		var x := z.cross(Vector3.UP if absf(z.y) < 0.9 else Vector3.RIGHT).normalized()
		m.global_transform = Transform3D(Basis(x, z.cross(x), z), p + nrm * 0.03)
		m.fire(imp.fireball)
		var life := maxf(maxf(imp.fireball.puff_life_s, imp.fireball.spark_life_s), maxf(imp.fireball.trail_life_s, imp.fireball.light_s)) + 0.8
		get_tree().create_timer(life).timeout.connect(m.queue_free)
	# what it reaches: pushed and told, if nothing solid stands between
	var out: Array = []
	var space := get_world_3d().direct_space_state
	if imp.radius_m > 0.0 and space != null:
		var q := PhysicsShapeQueryParameters3D.new()
		var sh := SphereShape3D.new()
		sh.radius = imp.radius_m
		q.shape = sh
		q.transform = Transform3D(Basis(), center)
		q.collision_mask = 1
		var seen := {}
		var player := get_tree().get_first_node_in_group("hs_player")
		for r in space.intersect_shape(q, 64):
			var c = r.get("collider")
			if not (c is Node3D) or seen.has(c) or c == player:
				continue
			seen[c] = true
			var cn := c as Node3D
			if not cn.is_visible_in_tree():
				continue
			var told := _teller(cn)
			if not (cn is RigidBody3D) and told == null and not _shootable(cn):
				continue                                 # (the room itself: marked, not pushed)
			var at := cn.global_position
			if cn is CollisionObject3D:
				at = _middle(cn as CollisionObject3D)
			var ray := PhysicsRayQueryParameters3D.create(center, at, 1)
			ray.exclude = [(cn as CollisionObject3D).get_rid()] if cn is CollisionObject3D else []
			var block := space.intersect_ray(ray)
			if not block.is_empty():
				continue                                 # (behind a wall)
			var dv := at - center
			var dist := dv.length()
			var dir := dv / dist if dist > 1e-4 else nrm
			var kf := clampf(1.0 - dist / imp.radius_m, 0.15, 1.0)
			if cn is RigidBody3D:
				(cn as RigidBody3D).apply_impulse(dir * imp.power * kf, (at - cn.global_position) * 0.5)
			var info := {"point": at, "normal": -dir, "collider": cn, "dir": dir, "from": center, "pellet": -1,
				"damage": imp.damage * kf, "blast": true, "radius": imp.radius_m}
			if told != null:
				told.shot(info)
			out.append(info)
	# felt and heard
	var cam := get_viewport().get_camera_3d()
	if cam != null and imp.shake > 0.0:
		var near := clampf(1.0 - cam.global_position.distance_to(p) / maxf(imp.shake_m, 0.1), 0.0, 1.0)
		if near > 0.0:
			_shake(cam, imp.shake * near)
	if imp.noise > 0.0:
		get_tree().call_group("hs_listener", "heard", p, imp.noise)
	var fear := get_tree().get_first_node_in_group("hs_fear")
	if fear != null and imp.ring_secs > 0.0 and fear.has_method("ring") and cam != null and cam.global_position.distance_to(p) < imp.shake_m:
		fear.ring(imp.ring_secs)
	var st: AudioStream = imp.sound
	if st == null and ResourceLoader.exists(DIR + "sounds/shell_burst.ogg"):
		st = load(DIR + "sounds/shell_burst.ogg")
	if st != null:
		var snd := get_tree().get_first_node_in_group("hs_sound")
		if snd != null and snd.has_method("play"):
			snd.play(st, p, 0.0, "event")
		else:
			var a := AudioStreamPlayer3D.new()
			a.stream = st
			add_child(a)
			a.global_position = p
			a.play()
			a.finished.connect(a.queue_free)
	return out


# the node a blast tells: the first with a shot() method, it or up its parents
func _teller(n: Node) -> Node:
	var k := n
	for i in 6:
		if k == null:
			return null
		if k.has_method("shot"):
			return k
		k = k.get_parent()
	return null


# under an HSShootable's parent: it counts the hit itself (from the gun's fired)
func _shootable(n: Node) -> bool:
	for s in get_tree().get_nodes_in_group("hs_shootable"):
		var host := (s as Node).get_parent()
		if host != null and (host == n or host.is_ancestor_of(n)):
			return true
	return false


# a body's middle: its shapes' centres, else where it stands
func _middle(c: CollisionObject3D) -> Vector3:
	var sum := Vector3.ZERO
	var n := 0
	for ch in c.get_children():
		if ch is CollisionShape3D and not (ch as CollisionShape3D).disabled:
			sum += (ch as CollisionShape3D).global_position
			n += 1
	return sum / n if n > 0 else c.global_position


# the view shaken for a moment (the camera's offsets, put back after)
func _shake(cam: Camera3D, deg: float) -> void:
	var h0 := cam.h_offset
	var v0 := cam.v_offset
	var amp := tan(deg_to_rad(deg)) * 0.6
	var t := 0.0
	while t < 0.5 and is_instance_valid(cam):
		var k := 1.0 - t / 0.5
		cam.h_offset = h0 + randf_range(-1.0, 1.0) * amp * k * k
		cam.v_offset = v0 + randf_range(-1.0, 1.0) * amp * k * k
		await get_tree().process_frame
		t += get_process_delta_time()
	if is_instance_valid(cam):
		cam.h_offset = h0
		cam.v_offset = v0
