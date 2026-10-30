## Water running down a wall (docs/GODOT_LOOK.md §2b; the story's `use: leak`, STORY_FORMAT §2): a band of the wall wet
## below where it comes in (HSWet's shader with its band: darker, glossy, running in rivulets, wider as it spreads
## down, drying in patches toward the floor, no pools) and drips falling from the top to the floor, a ring where
## each lands (lifefx's drip, here on its own). `HSLeak.make(walls, settings)`: the wall meshes the band lies on (a
## wall split by its openings is several), settings {centre (world, the top on the wall's face), axis (along the
## wall), inward (into the room), width, top, bottom, drip (seconds between drops; 0 none), wet 0..1}; the node goes
## anywhere in the tree (its drops are placed in the world). `set_wet(k)` dries it or wets it again.
@tool
class_name HSLeak
extends Node3D

var walls: Array = []
var s: Dictionary = {}
var drop: MeshInstance3D = null
var ring: MeshInstance3D = null
var clock := 0.0
var drops := 0                       # how many have fallen (the checks read it)


static func make(wall_meshes: Array, settings: Dictionary) -> HSLeak:
	var lk := HSLeak.new()
	lk.name = "Leak"
	lk.walls = wall_meshes
	lk.s = settings
	lk.apply()
	return lk


func apply() -> void:
	var c: Vector3 = s.get("centre", Vector3.ZERO)
	var ax: Vector3 = s.get("axis", Vector3.RIGHT)
	for mi in walls:
		if mi is MeshInstance3D:
			HSWet.wet(mi, {"wetness": float(s.get("wet", 0.8)), "puddles": 0.0, "ripples": 0.0, "band_on": true, "band_centre": c, "band_axis": ax.normalized(),
				"band_half": float(s.get("width", 0.4)) * 0.5, "band_top": float(s.get("top", c.y)), "band_bottom": float(s.get("bottom", 0.0))})


func set_wet(k: float) -> void:
	s["wet"] = k
	for mi in walls:
		if mi is MeshInstance3D and mi.material_override is ShaderMaterial:
			mi.material_override.set_shader_parameter("wetness", k)


func _ready() -> void:
	if float(s.get("drip", 2.6)) <= 0.0:
		return
	drop = MeshInstance3D.new()
	var sph := SphereMesh.new()
	sph.radius = 0.0028
	sph.height = 0.0056
	drop.mesh = sph
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.84, 0.9, 0.93, 0.8)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	drop.material_override = mat
	drop.top_level = true
	drop.visible = false
	add_child(drop)
	ring = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.8
	tm.outer_radius = 1.0
	ring.mesh = tm
	var rm := StandardMaterial3D.new()
	rm.albedo_color = Color(0.84, 0.9, 0.93, 0.5)
	rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = rm
	ring.top_level = true
	ring.visible = false
	add_child(ring)


func _process(dt: float) -> void:
	if drop == null:
		return
	clock += dt
	var every: float = max(0.3, float(s.get("drip", 2.6)))
	var c: Vector3 = s.get("centre", Vector3.ZERO)
	var inward: Vector3 = s.get("inward", Vector3.FORWARD)
	var top: Vector3 = c + inward.normalized() * 0.012 + Vector3(0.0, -0.02, 0.0)   # the drop hangs just off the wall's face
	var floor_y: float = float(s.get("bottom", 0.0))
	var fall: float = max(0.03, top.y - floor_y)
	var tf: float = sqrt(2.0 * fall / 9.81)
	var n: float = floor(clock / every)
	var a: float = clock - n * every - 0.8          # a drop swells 0.8 s, then falls
	if int(n) > drops:
		drops = int(n)
	drop.visible = a < tf
	ring.visible = a >= tf and a < tf + 0.35
	if a < 0.0:
		drop.global_position = top
		drop.scale = Vector3.ONE * (0.5 + 0.5 * clamp(1.0 + a / 0.8, 0.0, 1.0))
	elif a < tf:
		drop.global_position = top + Vector3(0.0, -4.905 * a * a, 0.0)
		drop.scale = Vector3(0.85, 1.25, 0.85)
	if ring.visible:
		var uu: float = (a - tf) / 0.35
		ring.global_position = Vector3(top.x, floor_y + 0.001, top.z)
		ring.scale = Vector3.ONE * (0.004 + 0.022 * uu)
		(ring.material_override as StandardMaterial3D).albedo_color.a = 0.5 * (1.0 - uu)
