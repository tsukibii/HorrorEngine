## A light shaft (HSShaft's card; docs/GODOT_LOOK.md §0): a window's beam with dust drifting in it, coming *from the
## window*: the window's own rectangle swept along the sunlight, so at the glass the beam is exactly the opening and
## its sides run parallel into the room (sunlight is parallel), crisp at the glass and softer further in, landing on
## the floor instead of fading in mid-air.
##
## Put the node in the window's opening, the glass's middle, its forward (-Z) into the room and its X along the wall
## (the window's plane is the node's XY plane). Set `width` and `height` to the opening (the orange outline in the
## editor shows it: fit it to the window), or scale the node. `sun_down` is how steeply the light comes in (degrees
## below level), `sun_side` how far it slants along the wall. `floor_y` is the floor's height (world): the beam
## lands there (`reach` caps it). With `aim_lights` the light under it (a SpotLight3D or a DirectionalLight3D: the
## window_sun preset has one) is placed outside the window and aimed along the beam, so the patch on the floor and the
## beam line up.
@tool
@icon("res://addons/horrorstudio_look/icons/shaft.svg")
class_name HSLightShaft
extends Node3D

@export_range(0.1, 6.0, 0.01, "suffix:m") var width: float = 1.2
@export_range(0.1, 6.0, 0.01, "suffix:m") var height: float = 1.1
@export_range(0.0, 85.0, 0.5, "suffix:°") var sun_down: float = 35.0
@export_range(-80.0, 80.0, 0.5, "suffix:°") var sun_side: float = 0.0
@export var stop_at_floor := true
@export var floor_y: float = 0.0                     ## the floor's height, world metres
@export_range(0.2, 20.0, 0.1, "suffix:m") var reach: float = 6.0   ## the most it runs (it stops at the floor before that)
@export_range(0.0, 3.0) var strength: float = 1.0
@export_range(0.0, 1.0) var dust: float = 0.5
@export_range(0.0, 1.0) var drift: float = 0.12
@export_range(0.02, 0.6) var soft_near: float = 0.1   ## its sides' softness at the glass (of the half width)
@export_range(0.02, 0.8) var soft_far: float = 0.45   ## and where it lands
@export var color := Color(1.0, 0.93, 0.8)
@export var aim_lights := true                    ## the lights under it put outside the window, along the beam
@export var show_outline := true                  ## the window's rectangle and the beam's edges, in the editor only
var beam: FogVolume = null
var card: MeshInstance3D = null
var outline: MeshInstance3D = null
var length := 0.0                                 ## how far the beam runs now (to the floor, or `reach`)
var _key := 0


func _ready() -> void:
	set_notify_transform(true)
	_rebuild()


func _settings() -> Dictionary:
	return {"w": width, "h": height, "d": sun_down, "s": sun_side, "f": stop_at_floor, "fy": floor_y, "r": reach, "st": strength,
		"du": dust, "dr": drift, "sn": soft_near, "sf": soft_far, "c": color, "al": aim_lights, "o": show_outline}


## the sunlight's way in, the node's own space: down by sun_down, slanting along the wall by sun_side, into the room
func sun_dir() -> Vector3:
	var dn := deg_to_rad(sun_down)
	var sd := deg_to_rad(sun_side)
	return Vector3(sin(sd) * cos(dn), -sin(dn), -cos(sd) * cos(dn)).normalized()


## how far along the sun the beam runs: until its top edge reaches the floor (the bottom edge lands sooner; the
## shader takes it off at the floor), or `reach`
func beam_length() -> float:
	var d := sun_dir()
	if not stop_at_floor or not is_inside_tree():
		return reach
	var wd: Vector3 = global_basis * d
	if wd.y > -0.02:
		return reach
	var top_y: float = (global_transform * Vector3(0, height * 0.5, 0)).y
	var per_m: float = -wd.y                               # world metres down per metre along the beam (the node's scale in it)
	return clamp((top_y - floor_y) / per_m + 0.05, 0.2, reach)


func _rebuild() -> void:
	_key = _key_now()
	length = beam_length()
	if beam == null:
		beam = FogVolume.new()                       # (HSShaft wears a FogVolume: its fog empty, the card its child)
		beam.name = "Beam"
		add_child(beam)                               # no owner: never saved
	beam.position = Vector3.ZERO
	beam.size = Vector3(width, height, length)
	HSShaft.wear(beam, {"strength": strength, "dust": dust, "drift": drift, "color": color, "slices": 14, "planes": 4})
	card = beam.get_node("Card")
	# the card's box (the window at +Z/2, the end at -Z/2) sheared so +Z/2 sits in the window's plane and the box runs
	# along the sun: the slices stay parallel to the glass, the long planes become the beam's parallelograms
	var d := sun_dir()
	card.transform = Transform3D(Basis(Vector3.RIGHT, Vector3.UP, -d), d * length * 0.5)
	for si in card.mesh.get_surface_count():
		var m := card.get_surface_override_material(si) as ShaderMaterial
		m.set_shader_parameter("soft_near", soft_near)
		m.set_shader_parameter("soft_far", soft_far)
		m.set_shader_parameter("tail", 0.88 if stop_at_floor else 0.3)
		m.set_shader_parameter("floor_y", floor_y if stop_at_floor else -100000.0)
	if aim_lights:
		_aim()
	_outline()


func _key_now() -> int:
	return [_settings(), global_transform].hash()


## the lights under it outside the window, shining along the beam through the opening
func _aim() -> void:
	var d := sun_dir()
	var back := 3.0
	for ch in get_children():
		if ch is SpotLight3D:
			ch.position = -d * back
			ch.basis = Basis.looking_at(d, Vector3.UP if absf(d.y) < 0.99 else Vector3.BACK)
			ch.spot_angle = clamp(rad_to_deg(atan(0.5 * max(width, height) * 1.25 / back)), 10.0, 80.0)
			ch.spot_range = back + length + 1.0
		elif ch is DirectionalLight3D:
			ch.basis = Basis.looking_at(d, Vector3.UP if absf(d.y) < 0.99 else Vector3.BACK)


## the window's rectangle and the beam's four edges as orange lines, for fitting it in the editor (never in a game)
func _outline() -> void:
	if outline != null:
		outline.free()
		outline = null
	if not Engine.is_editor_hint() or not show_outline:
		return
	var im := ImmediateMesh.new()
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(1.0, 0.55, 0.1)
	mat.no_depth_test = true
	var hw := width * 0.5
	var hh := height * 0.5
	var c := [Vector3(-hw, -hh, 0), Vector3(hw, -hh, 0), Vector3(hw, hh, 0), Vector3(-hw, hh, 0)]
	var run := sun_dir() * length
	im.surface_begin(Mesh.PRIMITIVE_LINES, mat)
	for i in 4:
		im.surface_add_vertex(c[i])
		im.surface_add_vertex(c[(i + 1) % 4])
		im.surface_add_vertex(c[i])                  # the beam's edges, faint: the dashes of where it goes
		im.surface_add_vertex(c[i] + run * 0.25)
	im.surface_end()
	outline = MeshInstance3D.new()
	outline.name = "Outline"
	outline.mesh = im
	outline.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(outline)                                # no owner: never saved


func _notification(what: int) -> void:
	if what == NOTIFICATION_TRANSFORM_CHANGED and is_node_ready() and stop_at_floor:
		_key = 0                                     # moved: its length to the floor again (next frame)


func _process(_dt: float) -> void:
	if _key_now() != _key:
		_rebuild()
