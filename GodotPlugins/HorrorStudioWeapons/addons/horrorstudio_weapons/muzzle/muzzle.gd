@tool
@icon("res://addons/horrorstudio_weapons/icons/muzzle.svg")
class_name HSMuzzle
extends Node3D
## A gun's muzzle (DECISIONS 2026-11-09, latest: "a generic muzzle system that can be used later for other guns"):
## its flash, the light the flash throws, sparks, the smoke thrown out with the shot and the smoke it trails after it,
## wherever the gun goes. Put it at the end of a barrel, its -Z along the barrel, and call `fire()` with the shell's
## HSMuzzleFlash (or none: its own `flash`). The guns (HSGun: HSDoubleBarrel) make theirs at their muzzles' sockets.
##
## The flash is drawn the user's way: each wing a run of slightly elongated spheres that intersect, their fronts
## culled; a noise is mapped triplanar onto each sphere and blended by the view's normal dotted with the surface's
## through a colour burn (muzzle/flash.gdshader), so every sphere is eaten away from its rim inward, white-hot in its
## middle, orange and red at the edges it burns out at, and where they overlap the fire adds up. All the spheres are one
## MultiMesh, laid out again for every shot (its wings never twice alike).
##
## In the editor, `preview` shows the flash frozen at `preview_age`: change its HSMuzzleFlash in the Inspector and see it.

signal flashed(look: HSMuzzleFlash)                     ## a flash just started

const DIR := "res://addons/horrorstudio_weapons/"
const MAX_SPHERES := 128

@export var flash: HSMuzzleFlash:                       ## how it flashes when fire() isn't given a look
	set(v):
		flash = v
		_dirty = true
@export var view_model := false                         ## a gun's in first person: the flash drawn in front of the world as the gun is (z clip)
@export_range(0.01, 1.0) var z_clip := 0.35
@export var fov := 0.0                                  ## the gun's own lens when it draws itself with one (0: the camera's)
@export var light_energy := 5.0                         ## the flash's light at a look's light_scale of 1 (a gun's flash_energy)
@export var shadows := true                             ## the flash's light casts shadows
@export var smoke := true                               ## the puffs and the trail (off: the flash, its light and sparks)
@export_group("Editor")
@export var preview := false:                           ## in the editor: the flash shown, frozen at preview_age
	set(v):
		preview = v
		_dirty = true
@export_range(0.0, 1.0) var preview_age := 0.0:
	set(v):
		preview_age = v
		_dirty = true
@export var preview_seed := 1:                          ## another seed, other wings
	set(v):
		preview_seed = v
		_dirty = true

var shots := 0                                          ## flashes so far (a check's)
var look: HSMuzzleFlash                                 ## the last flash's look
var spheres := 0                                        ## the spheres it was made of
var wings: MultiMeshInstance3D
var light: OmniLight3D
var sparks: CPUParticles3D
var puffs: CPUParticles3D
var trail: MeshInstance3D

var _mm: MultiMesh
var _layout: Array = []                                 # the last flash's spheres: [transform, custom]
var _mat: ShaderMaterial                                # the look's: one of the two below
var _mats: Array[ShaderMaterial] = []                   # [solid, added]
var _age := -1.0                                        # the flash's age (s); < 0 none
var _light_t := -1.0
var _fresh := false
var _peak := 0.0
var _trail_left := 0.0
var _pts: Array = []                                    # the trail, oldest first: [position, velocity, age, density, when it was left]
var _clock := 0.0
var _last_at := Vector3.INF
var _last_t := -1.0
var _imesh: ImmediateMesh
var _from := Vector3.INF                                # this shot's smoke and light from here (a wall between the eye and the muzzle), else the muzzle
var _dirty := true
var _ed_t := 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	_build()
	set_process(true)


## Flash: `with` the look (else this muzzle's `flash`, else the plugin's buckshot). `clear_m`: the room ahead of the
## muzzle (a wall that near shortens the plume and the wings leaning forward). `from`: where the light and smoke come
## from instead of the muzzle (this side of a wall the muzzle is drawn through).
func fire(with: HSMuzzleFlash = null, clear_m := INF, from := Vector3.INF) -> void:
	look = with if with != null else _look()
	if wings == null:
		_build()
	spheres = _lay(look, clear_m, _rng)
	_shade(look)
	_mat.set_shader_parameter("seed", Vector3(_rng.randf(), _rng.randf(), _rng.randf()) * 37.0)
	_mat.set_shader_parameter("age", 0.0)
	wings.visible = spheres > 0
	_age = 0.0
	_light_t = 0.0
	_fresh = true
	_from = from
	_peak = light_energy * look.light_scale
	light.light_color = look.light_color
	light.omni_range = look.light_range_m
	light.shadow_enabled = shadows
	light.light_volumetric_fog_energy = look.light_fog
	light.light_energy = _peak
	light.visible = _peak > 0.0
	light.position = Vector3(0, 0, -0.05)
	if from != Vector3.INF:
		light.global_position = from
	if look.sparks > 0:
		_set_sparks(look)
		sparks.position = Vector3(0, 0, -0.02)
		if from != Vector3.INF:
			sparks.global_position = from
		sparks.restart()
	if smoke and look.puffs > 0:
		_set_puffs(look)
		puffs.position = Vector3.ZERO
		if from != Vector3.INF:
			puffs.global_position = from
		puffs.restart()
	if smoke and look.trail_s > 0.0:
		_trail_left = look.trail_s
	shots += 1
	flashed.emit(look)


## The last flash for a check: {shots, spheres, drawn, age, light, trail (its points), trailing, sparks, puffs, look}.
func report() -> Dictionary:
	return {"shots": shots, "spheres": spheres, "drawn": wings != null and wings.visible, "age": _age,
		"light": light.light_energy if light != null and light.visible else 0.0, "trail": _pts.size(),
		"trailing": _trail_left > 0.0, "sparks": sparks.amount if sparks != null and sparks.emitting else 0,
		"puffs": puffs.amount if puffs != null and puffs.emitting else 0, "look": look.title if look != null else ""}


## The spheres of the last flash in this muzzle's space: [{transform, along, bright}] (a check's; kept here, since a
## headless renderer keeps no MultiMesh).
func sphere_list() -> Array:
	return _layout.map(func(e): return {"transform": e[0], "along": (e[1] as Color).r, "bright": (e[1] as Color).b})


## The trail's points in the world, oldest first (a check's).
func trail_points() -> Array:
	return _pts.map(func(p): return p[0])


## The trail's points with when each was left: [{at, born}], oldest first (a check follows one by its `born`).
func trail_bits() -> Array:
	return _pts.map(func(p): return {"at": p[0], "born": p[4]})


func _look() -> HSMuzzleFlash:
	if flash != null:
		return flash
	var d = load(DIR + "muzzle/buckshot.tres")
	return d if d is HSMuzzleFlash else HSMuzzleFlash.new()


# ---- the nodes ----------------------------------------------------------------------------------------------------

func _build() -> void:
	if wings != null:
		return
	var noise := _tex("fx/flash_noise.png")
	_mm = MultiMesh.new()
	_mm.transform_format = MultiMesh.TRANSFORM_3D
	_mm.use_custom_data = true
	var sm := SphereMesh.new()
	sm.radius = 1.0
	sm.height = 2.0
	sm.radial_segments = 20
	sm.rings = 10
	_mm.mesh = sm
	_mm.instance_count = MAX_SPHERES
	_mm.visible_instance_count = 0
	wings = MultiMeshInstance3D.new()
	wings.name = "Wings"
	wings.multimesh = _mm
	for sh in ["muzzle/flash_solid.gdshader", "muzzle/flash.gdshader"]:
		var m := ShaderMaterial.new()
		m.shader = load(DIR + sh)
		m.set_shader_parameter("noise_tex", noise)
		_mats.append(m)
	_mat = _mats[0]
	wings.material_override = _mat
	wings.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	wings.custom_aabb = AABB(Vector3(-1.5, -1.5, -2.5), Vector3(3.0, 3.0, 4.0))
	wings.visible = false
	add_child(wings)
	light = OmniLight3D.new()
	light.name = "Light"
	light.light_energy = 0.0
	light.visible = false
	light.shadow_enabled = shadows
	light.add_to_group("hs_no_zone")                     # (a light zone doesn't claim it)
	add_child(light)
	sparks = CPUParticles3D.new()
	sparks.name = "Sparks"
	sparks.emitting = false
	sparks.one_shot = true
	sparks.explosiveness = 1.0
	sparks.local_coords = false
	sparks.direction = Vector3(0, 0, -1)
	sparks.particle_flag_align_y = true
	sparks.mesh = spark_mesh()
	add_child(sparks)
	puffs = CPUParticles3D.new()
	puffs.name = "Puffs"
	puffs.emitting = false
	puffs.one_shot = true
	puffs.explosiveness = 0.85
	puffs.local_coords = false
	puffs.direction = Vector3(0, 0, -1)
	puffs.damping_min = 0.9
	puffs.damping_max = 1.4
	puffs.angle_min = -180.0
	puffs.angle_max = 180.0
	puffs.mesh = puff_mesh(_tex("fx/puff.png"))
	add_child(puffs)
	trail = MeshInstance3D.new()
	trail.name = "Trail"
	trail.top_level = true                               # the trail stays where the muzzle left it
	_imesh = ImmediateMesh.new()
	trail.mesh = _imesh
	var tm := ShaderMaterial.new()
	tm.shader = load(DIR + "muzzle/smoke.gdshader")
	tm.set_shader_parameter("noise_tex", noise)
	trail.material_override = tm
	trail.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(trail)
	trail.global_transform = Transform3D.IDENTITY


## A quad for smoke particles: the plugin's puff, lit with its light capped (muzzle/puff.gdshader), hiding `occlude` of
## what's behind it as much as it covers (0: only added); an impact's dust (added: 0) and an explosion's smoke use it too.
static func puff_mesh(tex: Texture2D, occlude := 0.7) -> QuadMesh:
	var q := QuadMesh.new()
	var m := ShaderMaterial.new()
	m.shader = load(DIR + "muzzle/puff.gdshader")
	m.set_shader_parameter("puff_tex", tex)
	m.set_shader_parameter("occlude", occlude)
	q.material = m
	return q


## A quad for sparks: a streak along its particle's way (muzzle/spark.gdshader; the particles' align_y on).
static func spark_mesh() -> QuadMesh:
	var q := QuadMesh.new()
	var m := ShaderMaterial.new()
	m.shader = load(DIR + "muzzle/spark.gdshader")
	q.material = m
	return q


# a texture of the plugin's: imported, or read from its file (a project that hasn't imported it yet)
func _tex(path: String) -> Texture2D:
	return tex(path)


## A texture of the plugin's (`fx/...`): imported, or read from its file in a project that hasn't imported it yet.
## Always with mipmaps (a project's import leaves them off, and minified the noise aliases into grit).
static func tex(path: String) -> Texture2D:
	var p := DIR + path
	var img: Image = null
	if ResourceLoader.exists(p):
		var t = load(p)
		if t is Texture2D:
			if (t as Texture2D).get_image() == null or (t as Texture2D).get_image().has_mipmaps():
				return t
			img = (t as Texture2D).get_image()
	if img == null:
		img = Image.load_from_file(ProjectSettings.globalize_path(p))
	if img == null or img.is_empty():
		return null
	if img.is_compressed():
		img.decompress()
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


# the shader's numbers from the look
func _shade(lk: HSMuzzleFlash) -> void:
	_mat = _mats[1] if lk.blend == HSMuzzleFlash.Blend.ADD else _mats[0]
	wings.material_override = _mat
	_mat.set_shader_parameter("noise_scale", lk.noise_scale)
	_mat.set_shader_parameter("burn", lk.burn)
	_mat.set_shader_parameter("erode", lk.erode)
	_mat.set_shader_parameter("tip_burn", lk.tip_burn)
	_mat.set_shader_parameter("swell", lk.swell)
	_mat.set_shader_parameter("core_color", lk.core_color)
	_mat.set_shader_parameter("mid_color", lk.mid_color)
	_mat.set_shader_parameter("edge_color", lk.edge_color)
	_mat.set_shader_parameter("energy", lk.energy)
	_mat.set_shader_parameter("z_clip", z_clip if view_model else 1.0)
	_mat.set_shader_parameter("fov_override", fov if view_model else 0.0)
	var tm := trail.material_override as ShaderMaterial
	if tm != null:
		tm.set_shader_parameter("smoke_color", lk.smoke_color)
		tm.set_shader_parameter("glow", lk.smoke_glow)
		tm.set_shader_parameter("density", clampf(lk.smoke_density, 0.0, 2.0))
		tm.set_shader_parameter("light_cap", lk.smoke_light_cap)
	var pm := puffs.mesh.surface_get_material(0) as ShaderMaterial if puffs.mesh != null else null
	if pm != null:
		pm.set_shader_parameter("glow", lk.smoke_glow)
		pm.set_shader_parameter("light_cap", lk.smoke_light_cap)


# the wings and the plume as spheres in the MultiMesh: returns how many
func _lay(lk: HSMuzzleFlash, clear_m: float, rng: RandomNumberGenerator) -> int:
	var i := 0
	_layout.clear()
	var fwd := Vector3(0, 0, -1)
	var j := lk.jitter
	var roll := rng.randf() * TAU
	if lk.core_radius_m > 0.0:
		var r := lk.core_radius_m * rng.randf_range(0.9, 1.1)
		i = _put(i, Transform3D(Basis.from_scale(Vector3(r, r, r * 1.2)), fwd * r * 0.5), Color(0.0, rng.randf(), 1.2, 0.0))
	if lk.plume_length_m > 0.0:
		var pl := minf(lk.plume_length_m * rng.randf_range(1.0 - 0.4 * j, 1.0 + 0.25 * j), clear_m)
		i = _chain(i, fwd, pl, lk.plume_spheres, lk.plume_radius_m, lk, rng, 1.0)
	for w in lk.wings:
		var dir: Vector3
		if lk.layout == HSMuzzleFlash.Layout.STAR:
			var ang := roll + TAU * float(w) / float(lk.wings) + rng.randf_range(-1.0, 1.0) * j * PI / float(lk.wings)
			var lean := deg_to_rad(clampf(lk.wing_angle_deg + rng.randf_range(-1.0, 1.0) * j * 14.0, 0.0, 100.0))
			dir = fwd * cos(lean) + Vector3(cos(ang), sin(ang), 0.0) * sin(lean)
		else:
			var z := lerpf(1.0, cos(deg_to_rad(lk.wing_angle_deg)), rng.randf())   # (even over the cap)
			var phi := rng.randf() * TAU
			dir = fwd * z + Vector3(cos(phi), sin(phi), 0.0) * sqrt(maxf(0.0, 1.0 - z * z))
		dir = dir.normalized()
		var ln := lk.wing_length_m * rng.randf_range(1.0 - 0.45 * j, 1.0 + 0.3 * j)
		var ahead := dir.dot(fwd)
		if ahead > 0.05 and clear_m < INF:
			ln = minf(ln, clear_m / ahead)
		i = _chain(i, dir, ln, lk.wing_spheres, lk.wing_radius_m * rng.randf_range(0.85, 1.15), lk, rng, 0.85)
	_mm.visible_instance_count = i
	return i


# a wing: `count` spheres along `dir`, each elongated along it and overlapping the next by well over half (spaced by their
# own sizes, so the tip's small ones still touch), tapering to the tip, the run fitted to `length`
func _chain(i: int, dir: Vector3, length: float, count: int, r0: float, lk: HSMuzzleFlash, rng: RandomNumberGenerator, bright: float) -> int:
	if length <= 0.002:
		return i
	var b := _along(dir, rng.randf() * TAU)
	var rs: Array[float] = []
	for k in count:
		var t := 0.0 if count < 2 else float(k) / float(count - 1)
		rs.append(r0 * lerpf(1.0, lk.taper, t) * rng.randf_range(0.9, 1.1))
	var at: Array[float] = [rs[0] * 0.45]
	for k in range(1, count):
		at.append(at[k - 1] + (rs[k - 1] + rs[k]) * lk.stretch * 0.3)
	var reach := at[count - 1] + rs[count - 1] * lk.stretch * 0.75   # where the run's tip ends
	var fit := length / maxf(reach, 1e-4)
	for k in count:
		if i >= MAX_SPHERES:
			break
		var t := 0.0 if count < 2 else float(k) / float(count - 1)
		var r: float = rs[k] * clampf(sqrt(fit), 0.6, 1.4)          # (a short wing's spheres a little smaller too)
		var c := dir * at[k] * fit + (b.x * rng.randf_range(-1.0, 1.0) + b.y * rng.randf_range(-1.0, 1.0)) * r * 0.2
		i = _put(i, Transform3D(b * Basis.from_scale(Vector3(r, r, r * lk.stretch)), c), Color(t, rng.randf(), bright * lerpf(1.0, 0.8, t), 0.0))
	return i


func _along(dir: Vector3, roll: float) -> Basis:
	var z := dir.normalized()
	var a := Vector3.UP if absf(z.y) < 0.9 else Vector3.RIGHT
	var x := a.cross(z).normalized()
	return Basis(x, z.cross(x), z).rotated(z, roll)


func _put(i: int, xf: Transform3D, cd: Color) -> int:
	if i >= MAX_SPHERES:
		return i
	_mm.set_instance_transform(i, xf)
	_mm.set_instance_custom_data(i, cd)
	_layout.append([xf, cd])
	return i + 1


func _set_sparks(lk: HSMuzzleFlash) -> void:
	if sparks.amount != lk.sparks:
		sparks.amount = lk.sparks
	sparks.lifetime = lk.spark_life_s
	sparks.spread = lk.spark_spread_deg
	sparks.initial_velocity_min = lk.spark_speed.x
	sparks.initial_velocity_max = lk.spark_speed.y
	sparks.gravity = Vector3(0, -lk.spark_gravity, 0)
	sparks.damping_min = 0.5
	sparks.damping_max = 2.0
	sparks.scale_amount_min = lk.spark_length_m * 0.6
	sparks.scale_amount_max = lk.spark_length_m * 1.2
	var sc := Curve.new()
	sc.add_point(Vector2(0, 1.0))
	sc.add_point(Vector2(1, 0.3))
	sparks.scale_amount_curve = sc
	var g := Gradient.new()
	g.set_color(0, Color(lk.spark_color, 1.0))
	g.set_color(1, Color(lk.spark_color.r * 0.8, lk.spark_color.g * 0.25, lk.spark_color.b * 0.1, 0.0))
	sparks.color_ramp = g


func _set_puffs(lk: HSMuzzleFlash) -> void:
	if puffs.amount != lk.puffs:
		puffs.amount = lk.puffs
	puffs.lifetime = lk.puff_life_s
	puffs.spread = 22.0
	puffs.initial_velocity_min = lk.puff_speed.x
	puffs.initial_velocity_max = lk.puff_speed.y
	puffs.gravity = Vector3(0, 0.12, 0)
	puffs.scale_amount_min = lk.puff_size_m.x
	puffs.scale_amount_max = lk.puff_size_m.y
	var sc := Curve.new()
	sc.max_value = maxf(lk.puff_grow, 1.0)
	sc.add_point(Vector2(0, 0.4))
	sc.add_point(Vector2(1, lk.puff_grow))
	puffs.scale_amount_curve = sc
	# the puffs show only once the flash's light is out: lit by it from a few centimetres, even a faint one glows as a
	# ball the size of the room (LESSONS)
	var g := Gradient.new()
	var a := clampf(0.9 * lk.smoke_density, 0.0, 1.0)
	var life := maxf(lk.puff_life_s, 0.1)
	var t0 := clampf((maxf(lk.light_s, lk.life_s) + 0.012) / life, 0.0, 0.6)
	g.set_color(0, Color(lk.smoke_color, 0.0))
	g.set_color(1, Color(lk.smoke_color, 0.0))
	g.add_point(t0, Color(lk.smoke_color, 0.0))
	g.add_point(minf(t0 + 0.12 / life, 0.8), Color(lk.smoke_color, a))
	g.add_point(minf(t0 + 0.12 / life + 0.1, 0.9), Color(lk.smoke_color, a * 0.85))
	puffs.color_ramp = g


# ---- over time ------------------------------------------------------------------------------------------------------

func _process(dt: float) -> void:
	if Engine.is_editor_hint():
		_editor(dt)
		return
	if look == null:
		return
	if _fresh:
		_fresh = false                                   # the first frame drawn after the shot gets the whole flash
	else:
		if _age >= 0.0:
			_age += dt
			var k := _age / maxf(look.life_s, 0.001)
			if k >= 1.0:
				wings.visible = false
				_age = -1.0
			else:
				_mat.set_shader_parameter("age", k)
		if _light_t >= 0.0:
			_light_t += dt
			var e := _peak * maxf(0.0, 1.0 - _light_t / maxf(look.light_s, 0.001))
			light.light_energy = e
			if e <= 0.0:
				light.visible = false
				_light_t = -1.0
	if _trail_left > 0.0 or not _pts.is_empty():
		_trail(dt)


func _trail(dt: float) -> void:
	var life := maxf(look.trail_life_s, 0.05)
	_clock += dt
	if _trail_left > 0.0:
		_trail_left -= dt
		var k := clampf(_trail_left / maxf(look.trail_s, 0.001), 0.0, 1.0)
		var at := global_position if _from == Vector3.INF else _from
		# a point when the muzzle has moved a few millimetres or a moment has gone by (one a frame zig-zags)
		if _pts.is_empty() or at.distance_to(_last_at) > 0.006 or _clock - _last_t > 0.045:
			var fwd := -global_basis.z
			_pts.append([at, fwd * 0.1 * k + Vector3.UP * look.trail_rise * 0.5, 0.0, look.smoke_density * pow(k, 0.7), _clock])
			_last_at = at
			_last_t = _clock
	var keep: Array = []
	for p in _pts:
		var age: float = p[2] + dt
		p[2] = age
		if age >= life:
			continue
		var born: float = p[4]
		var v: Vector3 = p[1]
		v = v * pow(0.35, dt) + Vector3.UP * look.trail_rise * dt
		# the drift: a slow swirl that changes along the trail smoothly (by when each part was left), so neighbours
		# drift alike and the ribbon bends instead of tearing
		v += Vector3(sin(_clock * 1.1 + born * 2.3), 0.0, cos(_clock * 0.9 + born * 1.9)) * 0.04 * dt
		p[1] = v
		p[0] = (p[0] as Vector3) + v * dt
		keep.append(p)
	_pts = keep
	var cam := get_viewport().get_camera_3d() if is_inside_tree() else null
	_imesh.clear_surfaces()
	if _pts.size() < 2 or cam == null:
		return
	var eye := cam.global_position
	var n := _pts.size()
	var along := 0.0
	var last_side := Vector3.ZERO
	_imesh.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	for i in range(n - 1, -1, -1):                      # from the muzzle out: the noise flows away from it
		var p: Vector3 = _pts[i][0]
		var nxt: Vector3 = _pts[maxi(i - 2, 0)][0]
		var prv: Vector3 = _pts[mini(i + 2, n - 1)][0]
		if i < n - 1:
			along += p.distance_to(_pts[i + 1][0])
		var tg := nxt - prv
		if tg.length() < 1e-5:
			tg = Vector3.UP
		var to_eye := (eye - p).normalized()
		var side := tg.cross(to_eye)
		side = side.normalized() if side.length() > 1e-6 else (last_side if last_side != Vector3.ZERO else Vector3.RIGHT)
		if last_side != Vector3.ZERO and side.dot(last_side) < 0.0:
			side = -side                                 # (never flipped between two points: a twist)
		last_side = side
		var age: float = _pts[i][2]
		var u := clampf(age / life, 0.0, 1.0)
		var w := lerpf(look.trail_width_m.x, look.trail_width_m.y, sqrt(u))
		var dens: float = float(_pts[i][3]) * smoothstep(look.light_s, look.light_s + 0.1, age) * pow(1.0 - u, 1.3)   # (out of the flash's light first)
		var col := Color(1.0, fmod(float(_pts[i][4]) * 0.37, 1.0), 0.0, dens)
		_imesh.surface_set_normal(to_eye)
		_imesh.surface_set_color(col)
		_imesh.surface_set_uv(Vector2(0.0, along))
		_imesh.surface_add_vertex(p - side * w * 0.5)
		_imesh.surface_set_normal(to_eye)
		_imesh.surface_set_color(col)
		_imesh.surface_set_uv(Vector2(1.0, along))
		_imesh.surface_add_vertex(p + side * w * 0.5)
	_imesh.surface_end()


# in the editor: the flash frozen at preview_age while `preview` is on, laid out again as the look changes
func _editor(dt: float) -> void:
	_ed_t += dt
	if not _dirty and _ed_t < 0.4:
		return
	_ed_t = 0.0
	_dirty = false
	if wings == null:
		_build()
	if not preview:
		wings.visible = false
		return
	var lk := _look()
	var rng := RandomNumberGenerator.new()
	rng.seed = preview_seed
	spheres = _lay(lk, INF, rng)
	_shade(lk)
	_mat.set_shader_parameter("seed", Vector3(rng.randf(), rng.randf(), rng.randf()) * 37.0)
	_mat.set_shader_parameter("age", preview_age)
	wings.visible = true
