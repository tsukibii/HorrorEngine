## The level's air (docs/GODOT_LOOK.md §5j, docs/research/eye_candy.md §2): the fog level as one number, the fog's
## colour, ground mist thinning with height, the wind the air drifts on, how broken up it is, the dust seen in the light,
## and how strong the lights' beams (HSBeam) are in it. One a level; a second waits until the first goes.
##
## It sets the environment's volumetric fog: the density from `fog`, and the colour. A World FogVolume of its own
## (air_fog.gdshader) gives the fog its wisps and the mist; it keeps motes round the eye (HSDust) unless the scene has
## its own. HSAirZone boxes change the air while the eye is inside them, eased over their `seconds`; `fog_to` rolls the fog
## in or out for a moment. A preset sets the numbers for a kind of place. The environment's own values go back before a
## save and when this goes; its children are never saved. With the look's effects on Low (HSLook.quality) there are no
## froxels, and the beams and the dust carry the air alone.
@tool
@icon("res://addons/horrorstudio_look/icons/atmosphere.svg")
class_name HSAtmosphere
extends Node3D

@export_enum("custom", "clear", "clean_room", "dusty_room", "hazy_night", "woods_mist", "fog", "thick_fog") var preset: String = "custom":
	set(v):
		preset = v
		if v != "custom" and HSAir.PRESETS.has(v):
			_applying = true
			var p: Dictionary = HSAir.PRESETS[v]
			fog = p["fog"]
			mist = p["mist"]
			dust = p["dust"]
			noise = p["noise"]
			color = p["color"]
			_applying = false
			notify_property_list_changed()
@export_range(0.0, 1.0, 0.01) var fog: float = 0.3:          ## the fog level: 0 clear air, 0.25 the look's haze, 0.5 about 80 m to see through, 0.75 about 35 m, 1 about 20 m
	set(v):
		fog = v
		_custom()
@export var color := Color(0.8, 0.84, 0.9):                  ## the fog's own colour (what it gives back of the light)
	set(v):
		color = v
		_custom()
@export_range(0.0, 1.0, 0.01) var mist: float = 0.0:         ## ground mist: thick at `ground`, thinning with height
	set(v):
		mist = v
		_custom()
@export_range(0.1, 6.0, 0.05, "suffix:m") var mist_height: float = 1.2   ## how far up the mist reaches (it thins to a third over this)
@export var ground: float = 0.0                              ## the ground's height for the mist, world metres
@export var wind := Vector3(0.25, 0.02, 0.1)                 ## metres a second the air drifts
@export_range(0.0, 1.0, 0.01) var noise: float = 0.5:        ## how broken up the fog is: wisps and pockets
	set(v):
		noise = v
		_custom()
@export_range(0.0, 1.0, 0.01) var dust: float = 0.3:         ## motes in the air, seen where light reaches them
	set(v):
		dust = v
		_custom()
@export_range(0.0, 3.0, 0.01) var beams: float = 1.0         ## how strong the lights' beams (HSBeam) are in this air
@export var froxels := true                                  ## Godot's volumetric fog for the lamps and windows (the beams and the dust don't need it)
@export_range(100, 40000) var dust_most: int = 12000         ## the motes at dust 1 (fewer on a slow machine)

var drift := Vector3.ZERO                                    ## the wind's run so far, metres (every shader of the air reads it)
var fog_volume: FogVolume = null
var motes: Node = null
var _applying := false
var _now := {}                                               ## the air now: the level's fog, dust and mist with the zones' pulls
var _pull := {}                                              ## each zone's pull on the air, 0..1, eased in its own seconds
var _env: Environment = null
var _env_own := {}                                           ## the environment's own values, put back before a save
var _tween: Tween = null


func _custom() -> void:
	if not _applying and preset != "custom":
		preset = "custom"


func _ready() -> void:
	add_to_group("hs_atmosphere")
	fog_volume = FogVolume.new()
	fog_volume.name = "Air"
	fog_volume.shape = RenderingServer.FOG_VOLUME_SHAPE_WORLD
	var m := ShaderMaterial.new()
	m.shader = preload("res://addons/horrorstudio_look/air_fog.gdshader")
	m.set_shader_parameter("noise_tex", HSAir.noise())
	m.set_shader_parameter("noise_scale", HSAir.NOISE_SCALE)
	fog_volume.material = m
	add_child(fog_volume)                                    # no owner: never saved
	_now = {"fog": fog, "dust": dust, "mist": mist}


func _exit_tree() -> void:
	_give_back()


func _notification(what: int) -> void:
	if what == NOTIFICATION_EDITOR_PRE_SAVE:
		_give_back()
	elif what == NOTIFICATION_EDITOR_POST_SAVE:
		set_process(true)


## the active one: the first in the group (a second waits)
func active() -> bool:
	return is_inside_tree() and get_tree().get_first_node_in_group("hs_atmosphere") == self


## the air now, for HSBeam and HSDust: the eased level, its density and the rest
func now() -> Dictionary:
	var f: float = _now.get("fog", fog)
	var d := HSAir.density(f)
	var m: float = _now.get("mist", mist)
	return {"fog": f, "density": d, "extinction": d, "mist": m, "mist_density": mist_density(m), "mist_height": mist_height, "ground": ground,
		"noise": noise, "dust": _now.get("dust", dust), "beams": beams, "drift": drift, "wind": wind, "color": color}


## the mist's level as its density at the ground (1: 0.12, about 25 m to see through down there)
static func mist_density(level: float) -> float:
	return 0.12 * level * level


## roll the fog to a level over some seconds (a moment's fog coming in, or clearing)
func fog_to(level: float, seconds := 2.0) -> void:
	air_to({"fog": level}, seconds)


## the same for several at once: fog, mist, dust, noise
func air_to(values: Dictionary, seconds := 2.0) -> void:
	if _tween != null and _tween.is_valid():
		_tween.kill()
	_tween = create_tween().set_parallel(true)
	for k in values:
		if k in ["fog", "mist", "dust", "noise"]:
			_tween.tween_property(self, k, clampf(float(values[k]), 0.0, 1.0), maxf(seconds, 0.01))


func _process(dt: float) -> void:
	if not active():
		return
	drift += wind * dt
	# each zone's pull eases up while the eye is in it (the smallest that holds it) and down after, over its own seconds;
	# the level's own numbers (fog_to, the inspector) apply at once
	var cam := HSAir.eye(self)
	var inside: Node = null
	if cam != null:
		var best_v := INF
		for z in get_tree().get_nodes_in_group("hs_air_zone"):
			if z.has_method("contains") and z.contains(cam.global_position):
				var vol: float = z.size.x * z.size.y * z.size.z
				if vol < best_v:
					best_v = vol
					inside = z
	if inside != null and not _pull.has(inside):
		_pull[inside] = 0.0
	for z in _pull.keys():
		if not is_instance_valid(z):
			_pull.erase(z)
			continue
		var a := 1.0 - exp(-dt / maxf(float(z.seconds), 0.05))
		_pull[z] = lerpf(_pull[z], 1.0 if z == inside else 0.0, a)
		if z != inside and _pull[z] < 0.001:
			_pull.erase(z)
	var base := {"fog": fog, "dust": dust, "mist": mist}
	for k in base:
		var v: float = base[k]
		for z in _pull:
			var zv := float(z.get(k))
			if zv >= 0.0:
				v += _pull[z] * (zv - float(base[k]))
		_now[k] = clampf(v, 0.0, 1.0)
	_apply()


func _apply() -> void:
	var env := HSAir.environment_of(self)
	if env != _env:
		_give_back()
		_env = env
	var d := HSAir.density(float(_now["fog"]))
	var m: float = _now["mist"]
	if _env != null:
		if _env_own.is_empty():
			_env_own = {"on": _env.volumetric_fog_enabled, "density": _env.volumetric_fog_density, "albedo": _env.volumetric_fog_albedo}
		var allowed := froxels and not bool(_env.get_meta("hs_no_haze", false))
		_env.volumetric_fog_enabled = allowed and (d > 0.0 or m > 0.0)
		_env.volumetric_fog_density = d
		_env.volumetric_fog_albedo = color
	if fog_volume != null:
		var fm := fog_volume.material as ShaderMaterial
		fm.set_shader_parameter("haze", d)
		fm.set_shader_parameter("noise_amount", noise)
		fm.set_shader_parameter("drift", drift)
		fm.set_shader_parameter("mist", mist_density(m))
		fm.set_shader_parameter("mist_height", mist_height)
		fm.set_shader_parameter("ground", ground)
		fm.set_shader_parameter("albedo", Vector3(color.r, color.g, color.b))
	_motes()


## motes round the eye: the scene's own HSDust, else one of ours (never saved)
func _motes() -> void:
	var dn := float(_now["dust"])
	if motes == null or not is_instance_valid(motes):
		motes = null
		for n in get_tree().get_nodes_in_group("hs_dust"):
			if n.get_parent() != self:
				return                                        # the scene has its own: it reads this air itself
		if dn <= 0.0:
			return
		motes = HSDust.new()
		motes.name = "Motes"
		motes.most = dust_most
		add_child(motes)                                       # no owner: never saved


func _give_back() -> void:
	if _env != null and not _env_own.is_empty():
		_env.volumetric_fog_enabled = _env_own["on"]
		_env.volumetric_fog_density = _env_own["density"]
		_env.volumetric_fog_albedo = _env_own["albedo"]
	_env_own = {}
	_env = null
