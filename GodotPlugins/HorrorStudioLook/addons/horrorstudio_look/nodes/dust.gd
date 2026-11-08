## Dust in the air (docs/GODOT_LOOK.md §5j, docs/research/eye_candy.md §2.3 H and §2.3b): motes in a box round the
## eye, seen only where light reaches them, the way an eye sees dust in a beam.
## - Flakes tumble and flash when a face catches the light: the twinkle.
## - Fibres glint along their length.
## - Many are faint and a few bright, sharp points and never soft discs.
## - They ride the air: a curl-noise flow of slow eddies (`stir`, a still room's 3 cm/s) with the atmosphere's wind on
##   top, settling slowly, wrapped round the eye so the air round you is the same wherever you walk.
## - Under a `knee` of light they're dark (moonlight shows none).
## (dust.gdshader, dust_particles.gdshader)
##
## An HSAtmosphere keeps one of these itself; put one in your scene to set its numbers by hand (the atmosphere's `dust`
## and wind still drive it). How much shows follows `dust` (its share of `most`). Its particles are a child of its own,
## never saved.
@tool
@icon("res://addons/horrorstudio_look/icons/dust.svg")
class_name HSDust
extends Node3D

@export_range(0.0, 1.0, 0.01) var dust: float = 0.5  ## how much is in the air: its share of `most` (the atmosphere's dust when there is one)
@export_range(100, 40000) var most: int = 12000        ## motes at dust 1, in the box (70 a cubic metre: a dusty room's beam)
@export var box := Vector3(7, 3.5, 7)                  ## the box round the eye, metres (they fade out before its edge: seen to about 3.2 m)
@export_range(0.2, 10.0, 0.1, "suffix:mm") var size_mm: float = 0.9   ## a typical flake (the biggest 2.5 times it, the smallest under half)
@export_range(0.0, 1.0, 0.01) var fibres: float = 0.12 ## the share that are threads of lint
@export_range(0.0, 2000.0, 1.0) var glint: float = 300.0 ## a flake's mirror flash when its face catches the light (a flake under a pixel still lights it)
@export_range(4.0, 400.0, 1.0) var shine: float = 40.0 ## how narrow the flash: higher, rarer and shorter twinkles
@export_range(0.0, 400.0, 0.5) var scatter: float = 8.0  ## a mote's glow between flashes (faint: in an ordinary lit room dust is hardly seen)
@export_range(0.0, 8.0, 0.01) var knee: float = 2.0    ## the light a mote needs before it shows (full at three times it): a strong beam's, not a room's lamps
@export_range(0.0, 0.5, 0.005, "suffix:m/s") var stir: float = 0.03   ## the room's own eddies (a still room's air: 0.01 to 0.1)
@export var wind := Vector3(0.0, 0.0, 0.0)             ## metres a second, when there's no atmosphere

var particles: GPUParticles3D = null
var _process_mat: ShaderMaterial = null
var _draw_mat: ShaderMaterial = null
var _made := []


func _ready() -> void:
	add_to_group("hs_dust")
	_make()


func _make() -> void:
	if particles != null:
		particles.queue_free()
	_made = [most, box]
	particles = GPUParticles3D.new()
	particles.name = "Motes"
	particles.top_level = true
	particles.amount = most
	particles.lifetime = 3600.0
	particles.explosiveness = 1.0
	particles.local_coords = false
	particles.fixed_fps = 30
	particles.interpolate = false
	particles.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	particles.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
	particles.visibility_aabb = AABB(-box * 0.5 - Vector3.ONE, box + Vector3.ONE * 2.0)
	_process_mat = ShaderMaterial.new()
	_process_mat.shader = preload("res://addons/horrorstudio_look/dust_particles.gdshader")
	particles.process_material = _process_mat
	_draw_mat = ShaderMaterial.new()
	_draw_mat.shader = preload("res://addons/horrorstudio_look/dust.gdshader")
	var q := QuadMesh.new()                              # a unit quad: the shader sizes and turns each mote
	q.size = Vector2.ONE
	q.material = _draw_mat
	particles.draw_pass_1 = q
	add_child(particles)                                  # no owner: never saved
	particles.emitting = true


func _process(_dt: float) -> void:
	if particles == null:
		return
	if _made != [most, box]:
		_make()
	var a := HSAir.atmosphere(self)
	var d := dust
	var w := wind
	if a != null and a.has_method("now"):
		var air: Dictionary = a.now()
		d = float(air.get("dust", d))
		w = air.get("wind", w)
	particles.amount_ratio = clampf(d, 0.0, 1.0)
	particles.visible = d > 0.0
	var cam := HSAir.eye(self)
	var at := cam.global_position if cam != null else global_position
	particles.global_position = at                        # the box (and its culling box) round the eye
	_process_mat.set_shader_parameter("eye", at)
	_process_mat.set_shader_parameter("box", box)
	_process_mat.set_shader_parameter("wind", w)
	_process_mat.set_shader_parameter("stir", stir)
	_draw_mat.set_shader_parameter("glint", glint)
	_draw_mat.set_shader_parameter("scatter", scatter)
	_draw_mat.set_shader_parameter("shine", shine)
	_draw_mat.set_shader_parameter("knee", knee)
	_draw_mat.set_shader_parameter("fibres", fibres)
	_draw_mat.set_shader_parameter("far_fade", minf(box.x, box.z) * 0.45)
	_draw_mat.set_shader_parameter("quad_m", size_mm * 0.001)
	_draw_mat.set_shader_parameter("viewport_h", float(get_viewport().get_visible_rect().size.y) if get_viewport() != null else 1080.0)
	_beams(at)


## the beams (HSBeam's lights) nearest the eye, four at most, for dust.gdshader to light the motes in them
func _beams(at: Vector3) -> void:
	var lit := []
	for b in get_tree().get_nodes_in_group("hs_beam"):
		var l: SpotLight3D = b.target() if b.has_method("target") else null
		if l == null or not l.is_visible_in_tree() or l.light_energy <= 0.0005 or float(b.strength) <= 0.0:
			continue
		lit.append([l.global_position.distance_to(at), b, l])
	lit.sort_custom(func(x, y): return x[0] < y[0])
	var pos := PackedVector4Array()
	var dir := PackedVector4Array()
	var col := PackedVector4Array()
	var shape := PackedVector4Array()
	for e in lit.slice(0, 4):
		var b: Node = e[1]
		var l: SpotLight3D = e[2]
		var ang := deg_to_rad(clampf(l.spot_angle, 1.0, 89.0))
		var c := l.light_color.srgb_to_linear() * l.light_energy * float(b.strength)
		var ax := -l.global_basis.z.normalized()
		pos.append(Vector4(l.global_position.x, l.global_position.y, l.global_position.z, l.spot_range))
		dir.append(Vector4(ax.x, ax.y, ax.z, cos(ang)))
		col.append(Vector4(c.r, c.g, c.b, l.spot_angle_attenuation))
		shape.append(Vector4(float(b.cookie_kind()), tan(ang), l.spot_attenuation, 0.0))
	while pos.size() < 4:
		pos.append(Vector4.ZERO)
		dir.append(Vector4(0, 0, -1, 1))
		col.append(Vector4.ZERO)
		shape.append(Vector4.ZERO)
	_draw_mat.set_shader_parameter("beam_count", mini(lit.size(), 4))
	_draw_mat.set_shader_parameter("beam_pos", pos)
	_draw_mat.set_shader_parameter("beam_dir", dir)
	_draw_mat.set_shader_parameter("beam_col", col)
	_draw_mat.set_shader_parameter("beam_shape", shape)
