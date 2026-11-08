## A light's beam in the air (docs/GODOT_LOOK.md §5j, docs/research/eye_candy.md §2): what a flashlight in fog looks
## like, a core running out from the hand with its ring and spill, as bright as the air is thick. Put it under a
## SpotLight3D (or point `light` at one): a flashlight, a car's lamps, a street lamp, a searchlight.
##
## It reads its light every frame (on or off, energy, colour, range, angle, falloffs), so a battery running down, a
## flicker or a power cut shows in the air too. It reads the air from the scene's HSAtmosphere (its fog level, mist,
## wisps and wind; the look's haze when there's none). `cookie` gives the light a flashlight's beam (beam.gd's profiles,
## HSAir.cookie): the light's projector and the beam's profile both. `leave_fog` leaves the light out of Godot's
## volumetric fog, which would draw a second, softer beam that trails when the light turns (the research's lab, §2.3).
## Its cone (beam.gdshader) is a child of its own, never saved; the light's projector and fog energy go back before a
## save and when this goes.
@tool
@icon("res://addons/horrorstudio_look/icons/beam.svg")
class_name HSBeam
extends Node3D

const GAIN := 3.0                                     ## the beam's brightness for the air's density: at the look's haze (fog 0.25) a flashlight's beam is faint but there

@export var light: SpotLight3D = null                 ## the light; empty: the parent
@export_range(0.0, 4.0, 0.01) var strength: float = 1.0
@export_enum("light's own", "flashlight", "led", "lantern") var cookie: String = "light's own"   ## a flashlight's beam on the light (its projector); the light's own projector otherwise, if it has one
@export_range(-0.9, 0.9, 0.01) var phase: float = 0.0 ## 0 as bright from every side; above 0 brighter facing the light, below 0 brighter from behind it
@export_enum("12", "24", "32") var quality: String = "24"   ## samples along each ray
@export var leave_fog := true                         ## the light left out of Godot's volumetric fog (no second beam, no trail)

var hull: MeshInstance3D = null
var mat: ShaderMaterial = null
var _key := []
var _own := {}                                        ## the light's own projector and fog energy, while this changes them


func target() -> SpotLight3D:
	return light if light != null else get_parent() as SpotLight3D


func _ready() -> void:
	add_to_group("hs_beam")                           # HSDust lights its motes in the beams (dust.gdshader)
	mat = ShaderMaterial.new()
	mat.shader = preload("res://addons/horrorstudio_look/beam.gdshader")
	mat.set_shader_parameter("noise_tex", HSAir.noise())
	mat.set_shader_parameter("noise_scale", HSAir.NOISE_SCALE)
	hull = MeshInstance3D.new()
	hull.name = "BeamCone"
	hull.top_level = true
	hull.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	hull.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
	hull.material_override = mat
	add_child(hull)                                   # no owner: never saved


func _enter_tree() -> void:
	_take.call_deferred()


func _exit_tree() -> void:
	_give_back()


func _notification(what: int) -> void:
	if what == NOTIFICATION_EDITOR_PRE_SAVE:
		_give_back()
	elif what == NOTIFICATION_EDITOR_POST_SAVE:
		_take.call_deferred()


## the light's projector (a cookie) and its fog energy taken over, its own remembered
func _take() -> void:
	var l := target()
	if l == null or not is_inside_tree():
		return
	if leave_fog:
		if not _own.has("fog"):
			_own["fog"] = l.light_volumetric_fog_energy
		l.light_volumetric_fog_energy = 0.0
	if cookie != "light's own":
		if not _own.has("projector"):
			_own["projector"] = l.light_projector
		l.light_projector = HSAir.cookie(cookie)


func _give_back() -> void:
	var l := target()
	if l != null:
		if _own.has("fog"):
			l.light_volumetric_fog_energy = _own["fog"]
		if _own.has("projector"):
			l.light_projector = _own["projector"]
	_own.clear()


func _process(_dt: float) -> void:
	var l := target()
	if hull == null:
		return
	if l == null:
		hull.visible = false
		return
	var air := HSAir.air_of(self)
	var thick := float(air.get("density", 0.0)) + float(air.get("mist_density", 0.0))
	var on := l.is_visible_in_tree() and l.light_energy > 0.0005 and strength > 0.0 and float(air.get("beams", 1.0)) > 0.0 and thick > 1e-5   # clear air: nothing to draw
	hull.visible = on
	if not on:
		return
	var ang := clampf(l.spot_angle, 1.0, 89.0)
	var key := [l.spot_range, ang]
	var h := l.spot_range * 1.03
	if key != _key:
		_key = key
		var cm := CylinderMesh.new()
		cm.height = h
		cm.bottom_radius = 0.04
		cm.top_radius = h * tan(deg_to_rad(minf(ang * 1.08 + 1.0, 80.0)))
		cm.radial_segments = 24
		cm.rings = 1
		hull.mesh = cm
		mat.set_shader_parameter("hull_height", h)
	hull.global_transform = l.global_transform * Transform3D(Basis(Vector3.RIGHT, -PI / 2.0), Vector3(0, 0, -h * 0.5))
	var k := l.light_energy * strength * float(air.get("beams", 1.0)) * GAIN
	var c := l.light_color.srgb_to_linear()
	mat.set_shader_parameter("light_color", Vector3(c.r, c.g, c.b) * k)
	mat.set_shader_parameter("spot_range", l.spot_range)
	mat.set_shader_parameter("cos_angle", cos(deg_to_rad(ang)))
	mat.set_shader_parameter("tan_angle", tan(deg_to_rad(ang)))
	mat.set_shader_parameter("angle_attenuation", l.spot_angle_attenuation)
	mat.set_shader_parameter("decay", l.spot_attenuation)
	var tex := l.light_projector
	mat.set_shader_parameter("use_profile", tex != null)
	if tex != null:
		mat.set_shader_parameter("profile_tex", tex)
	mat.set_shader_parameter("density", beam_density(float(air.get("density", HSAir.density(float(air.get("fog", 0.25)))))))
	mat.set_shader_parameter("extinction", float(air.get("extinction", 0.0)))
	mat.set_shader_parameter("mist", float(air.get("mist_density", 0.0)))
	mat.set_shader_parameter("mist_height", float(air.get("mist_height", 1.2)))
	mat.set_shader_parameter("mist_ground", float(air.get("ground", 0.0)))
	mat.set_shader_parameter("noise_amount", float(air.get("noise", 0.4)))
	mat.set_shader_parameter("drift", air.get("drift", Vector3.ZERO))
	mat.set_shader_parameter("phase_g", phase)
	mat.set_shader_parameter("steps", int(quality))


## the air's density as the beam's: thin air carries a little more of a beam than its share (the tone curve's toe
## would eat a faint one), thick air a little less (it was too much of the picture)
static func beam_density(d: float) -> float:
	return 0.06 * pow(maxf(d, 0.0) / 0.06, 0.75)


## the cookie as dust.gdshader's index: 0 none, 1 flashlight, 2 led, 3 lantern
func cookie_kind() -> int:
	return {"flashlight": 1, "led": 2, "lantern": 3}.get(cookie, 0)


func _get_configuration_warnings() -> PackedStringArray:
	return PackedStringArray() if target() != null else PackedStringArray(["Put this under a SpotLight3D, or set Light."])
