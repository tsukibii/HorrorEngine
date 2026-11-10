@tool
@icon("res://addons/horrorstudio_weapons/icons/ooze.svg")
class_name HSOoze
extends MeshInstance3D
## Black ichor as a living liquid where it lands (the user, 2026-11-10: "a shader for the black gothic blood that will
## fit our vhs camhybrid look and look eery and oozy"; docs/research/ooze.md). A box projected onto
## whatever it covers, as a Decal is, its shape made in its own shader (`react/ooze_<kind>.gdshader` over
## `react/ooze.gdshaderinc`) so it moves: a spray
## spreading as it lands and creeping on, drips running down a wall and slowing to a stop (none on a floor: its own
## slope says), a pool reaching out in thin tendrils, a wound oozing down what it's on, a drop's splash; black and
## glossy with an oil's sheen in its highlight, a deep oxblood where it's thin, a slow double beat swelling it, embers
## dying in it. HSHitReact makes them where she bleeds; put one by hand anywhere (a wall that weeps, a pool in a
## doorway): its +Y out of the surface, its +X the way a spray was thrown. Needs Forward+ (it reads the depth and
## normal buffers); HSHitReact falls back to plain decals on the other renderers.

enum Kind { SPRAY, POOL, WOUND, DROP }

const SHADERS := {Kind.SPRAY: "res://addons/horrorstudio_weapons/react/ooze_spray.gdshader",
	Kind.POOL: "res://addons/horrorstudio_weapons/react/ooze_pool.gdshader",
	Kind.WOUND: "res://addons/horrorstudio_weapons/react/ooze_wound.gdshader",
	Kind.DROP: "res://addons/horrorstudio_weapons/react/ooze_drop.gdshader"}
const REACH := {Kind.SPRAY: 0.9, Kind.POOL: 1.12, Kind.WOUND: 1.95, Kind.DROP: 1.1}   # its box's half width over its size

@export var kind := Kind.SPRAY:
	set(v):
		kind = v
		_apply()
@export var size_m := 0.4:                       ## the shape's size (its box is bigger: drips and tendrils run out of it)
	set(v):
		size_m = maxf(v, 0.01)
		_apply()
@export var seed := 0.0:                         ## its shape (0: a new one each time it's made in the game)
	set(v):
		seed = v
		_apply()
@export var depth_m := 0.16:                     ## how far its box reaches into and out of what it's on
	set(v):
		depth_m = maxf(v, 0.01)
		_apply()
@export var embers := 1.0                        ## their strength when it lands
@export var embers_s := 5.0                      ## how long they take to die
@export var settle_s := 40.0                     ## after this long its shape stops growing (its surface still moves)
@export var look: HSWoundLook:                   ## its colours (none: the shader's own)
	set(v):
		look = v
		_apply()
@export var age := 0.0:                          ## seconds since it landed: where it starts (a pool placed long settled: 60)
	set(v):
		age = v
		_set_age(v)
@export var preview := true                      ## in the editor: it lands again and again (off: shown at `age`)

var _t := 0.0
var _box: BoxMesh


func _ready() -> void:
	if not Engine.is_editor_hint() and seed == 0.0:
		seed = randf_range(1.0, 50.0)
	_apply()
	set_process(true)


func _apply() -> void:
	if not is_inside_tree() and _box == null:
		return
	if _box == null:
		_box = BoxMesh.new()
	var hw := size_m * float(REACH.get(kind, 1.0))
	_box.size = Vector3(hw * 2.0, depth_m, hw * 2.0)
	mesh = _box
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	extra_cull_margin = 0.05
	if material_override == null or not (material_override is ShaderMaterial) or (material_override as ShaderMaterial).shader == null \
			or (material_override as ShaderMaterial).shader.resource_path != SHADERS[kind]:
		material_override = make_material(look, kind)
	set_instance_shader_parameter("size_m", size_m)
	set_instance_shader_parameter("seed", seed if seed != 0.0 else 1.0)
	set_instance_shader_parameter("half", _box.size * 0.5)
	_set_age(age + _t)


## A material for oozes of a kind and a look (HSHitReact shares one a kind among all she leaves): its colours, else
## the shader's.
static func make_material(lk: HSWoundLook = null, k: Kind = Kind.SPRAY) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(SHADERS[k])
	if lk != null:
		m.set_shader_parameter("film_color", lk.ooze_film)
		m.set_shader_parameter("sheen", lk.ooze_sheen)
		m.set_shader_parameter("gloss", lk.ooze_gloss)
		m.set_shader_parameter("mirror", lk.ooze_mirror)
		m.set_shader_parameter("pulse", lk.ooze_pulse)
		m.set_shader_parameter("crawl", lk.ooze_crawl)
		m.set_shader_parameter("reach", lk.ooze_reach)
		m.set_shader_parameter("drip", lk.ooze_drip)
		m.set_shader_parameter("ember_color", lk.char_edge)
	return m


func _set_age(a: float) -> void:
	if not is_inside_tree():
		return
	set_instance_shader_parameter("age", a)
	set_instance_shader_parameter("embers", embers * exp(-a / maxf(embers_s, 0.01)))


func _process(dt: float) -> void:
	if Engine.is_editor_hint():
		if preview:
			_t = fmod(_t + dt, clampf(settle_s, 4.0, 16.0))
			_set_age(age + _t)
		elif _t != 0.0:
			_t = 0.0
			_set_age(age)
		return
	_t += dt
	_set_age(age + _t)
	if age + _t > maxf(settle_s, embers_s * 3.0):
		set_process(false)                       # (settled: its surface still moves in its shader)


## How long since it landed (a check's).
func now() -> float:
	return age + _t
