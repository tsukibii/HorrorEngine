## A made prop's enhancers (docs/PROPGEN.md §14), each a switch: what it glows with (an LED, a screen's backlight,
## an ember: the emission map the prop generator painted, turned up, down, off, or set flickering), its candle flames
## (a flame drawn by flame.gdshader and a flickering candle light, HSFlickerLight), the smoke from its incense and the
## steam from its spout or vent (soft puffs, puff.gdshader), and wax the light shines into (subsurface scattering and
## backlight on its wax). The prop says what it has in its glb (`propgen_fx` in its extras: Godot's metadata
## `extras`): its glowing materials and its sockets (`socket_flame`, `socket_tip_1`, `socket_spout`...).
##
## Where it comes from: a prop's own `<name>.tscn` (beside its glb) has one; the game puts one on every made prop as it
## enters a level (`HSPropFX.auto`); drop one under any placed prop by hand. Switch an enhancer off here, or every one
## of a kind in the project: Project Settings, `horrorstudio/prop_fx/glow` (flame, smoke, steam, wax), and
## `horrorstudio/prop_fx/enabled` for all of them. A node saves only its numbers: what it makes is never saved, and
## the prop's materials go back as they were before every save.
@tool
@icon("res://addons/horrorstudio_look/icons/prop_fx.svg")
class_name HSPropFX
extends Node3D

const FLAME_SHADER := preload("res://addons/horrorstudio_look/flame.gdshader")
const PUFF_SHADER := preload("res://addons/horrorstudio_look/puff.gdshader")
const LIGHT_SCRIPT := preload("res://addons/horrorstudio_look/nodes/flicker_omni.gd")
const SETTING := "horrorstudio/prop_fx/"
# the puffs: how many a second, how long each lives, its size from birth to the end, how fast it rises (lifefx.gd's)
# a wisp, not a kettle on the boil: the puffs are unlit (puff.gdshader), so in a dark room they're kept grey and faint
const PUFFS := {
	"steam": {"color": Color(0.78, 0.8, 0.82), "rate": 18.0, "life": 1.4, "size": [0.014, 0.085], "rise": 0.16, "speed": 0.08, "spread": 0.03, "curl": 0.045, "alpha": 0.16, "spin": 1.0},
	"smoke": {"color": Color(0.4, 0.41, 0.44), "rate": 12.0, "life": 3.0, "size": [0.003, 0.038], "rise": 0.08, "speed": 0.0, "spread": 0.004, "curl": 0.05, "alpha": 0.3, "spin": 1.6},
}

@export var enabled := true:                  ## every enhancer on this prop
	set(v):
		enabled = v
		_dirty = true
@export var prop: Node3D = null:              ## the prop; empty: the parent
	set(v):
		prop = v
		_dirty = true
@export_group("Glow")
@export var glow := true:                     ## its LEDs, screens and embers
	set(v):
		glow = v
		_dirty = true
@export_range(-1.0, 16.0) var glow_energy := -1.0:   ## -1: the prop's own
	set(v):
		glow_energy = v
		_dirty = true
@export_range(0.0, 1.0) var glow_flicker := 0.0      ## a dying screen, a faulty LED
@export_group("Flame")
@export var flame := true:
	set(v):
		flame = v
		_dirty = true
@export var flame_light := true:              ## a flickering candle light at each flame
	set(v):
		flame_light = v
		_dirty = true
@export var flame_shadows := true:
	set(v):
		flame_shadows = v
		_dirty = true
@export_range(0.2, 3.0) var flame_size := 1.0:
	set(v):
		flame_size = v
		_dirty = true
@export var flame_color := Color(1.0, 0.62, 0.3):
	set(v):
		flame_color = v
		_dirty = true
@export_group("Smoke and steam")
@export var smoke := true:                    ## from incense
	set(v):
		smoke = v
		_dirty = true
@export var steam := false:                   ## from a spout, a vent or an open pot: off until it's hot
	set(v):
		steam = v
		_dirty = true
@export_range(0.0, 3.0) var puff_rate := 1.0
@export_range(0.0, 2.0) var puff_brightness := 1.0:   ## the puffs are unlit: lower in a dark room, higher in a bright one
	set(v):
		puff_brightness = v
		_dirty = true
@export_group("Wax")
@export var wax := true:                      ## light shining into a candle's wax
	set(v):
		wax = v
		_dirty = true
@export_range(0.0, 1.0) var wax_glow := 0.4:
	set(v):
		wax_glow = v
		_dirty = true

var info := {}                 # the prop's enhancers, from its extras
var _dirty := true
var _made: Array = []          # what this made (flames, lights, puffs): never owned, never saved
var _over: Array = []          # [mesh, surface, the override it had] for each surface changed
var _glows: Array = []         # [material, its energy] for each glowing surface that's on
var _puffs: Array = []
var _t := 0.0
var _rng := RandomNumberGenerator.new()


## the enhancers a node's glb gave it (its metadata `extras`, `propgen_fx`), or {}
static func read(n: Node) -> Dictionary:
	if n == null:
		return {}
	var ex = n.get_meta("extras", {})
	if ex is Dictionary and ex.has("propgen_fx"):
		var v = ex["propgen_fx"]
		var d = JSON.parse_string(v) if v is String else v
		if d is Dictionary:
			return d
	return {}


## one HSPropFX on every made prop below root that has enhancers and none yet (the game, as it enters a level);
## nothing when the project's horrorstudio/prop_fx/enabled is off. Returns how many.
static func auto(root: Node) -> int:
	if root == null or not bool(ProjectSettings.get_setting(SETTING + "enabled", true)):
		return 0
	var n := 0
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var d := read(mi)
		if d.is_empty():
			continue
		var host: Node = mi.get_parent()
		if host == null or host.get_node_or_null("HSPropFX") != null or mi.get_node_or_null("HSPropFX") != null:
			continue
		var fx = load("res://addons/horrorstudio_look/nodes/prop_fx.gd").new()
		fx.name = "HSPropFX"
		fx.take(d)
		host.add_child(fx)
		n += 1
	return n


## its switches as the prop has them at first: a kind the prop marks `on: false` starts off (a pot not yet steaming,
## a new candle not lit)
func take(d: Dictionary) -> void:
	for k in ["flame", "smoke", "steam"]:
		if d.get(k) is Dictionary and d[k].has("on"):
			set(k, bool(d[k]["on"]))


func _kind(k: String) -> bool:
	return bool(ProjectSettings.get_setting(SETTING + "enabled", true)) and bool(ProjectSettings.get_setting(SETTING + k, true))


func host() -> Node3D:
	return prop if prop != null else get_parent() as Node3D


func _ready() -> void:
	_rng.seed = hash(str(get_path()))
	_dirty = true


func _exit_tree() -> void:
	_clear()


func _notification(what: int) -> void:
	if what == NOTIFICATION_EDITOR_PRE_SAVE:
		_restore()                                     # the prop's own materials saved, not ours
	elif what == NOTIFICATION_EDITOR_POST_SAVE:
		_dirty = true                                  # built again on the next frame


func _process(dt: float) -> void:
	if _dirty:
		_dirty = false
		_build()
	_t += dt
	if glow_flicker > 0.0:
		for g in _glows:
			var f := 1.0 - glow_flicker * clampf(0.5 + 0.5 * HSFlicker.noise1(_t * 9.0, 7) + (0.6 if HSFlicker.noise1(_t * 2.3, 11) > 0.7 else 0.0), 0.0, 1.0)
			(g[0] as StandardMaterial3D).emission_energy_multiplier = float(g[1]) * f
	for P in _puffs:
		_puff_tick(P, dt)


## what's on now, from the prop's extras and the switches
func report() -> Dictionary:
	var lights := 0
	var flames := 0
	for n in _made:
		if n is OmniLight3D:
			lights += 1
		elif n is MeshInstance3D:
			flames += 1
	var glowing := 0
	for g in _glows:
		if (g[0] as StandardMaterial3D).emission_enabled:
			glowing += 1
	var waxed := 0
	for o in _over:
		var m = (o[0] as MeshInstance3D).get_surface_override_material(o[1])
		if m is StandardMaterial3D and m.subsurf_scatter_enabled:
			waxed += 1
	var puffs := 0
	for P in _puffs:
		puffs += (P["born"] as Array).size()
	return {"glowing": glowing, "flames": flames, "lights": lights, "puff_sources": _puffs.size(), "puffs": puffs, "waxed": waxed, "info": info.keys()}


func _restore() -> void:
	for o in _over:
		var mi: MeshInstance3D = o[0]
		if is_instance_valid(mi):
			mi.set_surface_override_material(o[1], o[2])
	_over.clear()
	_glows.clear()


func _clear() -> void:
	for n in _made:
		if is_instance_valid(n):
			n.queue_free()
	_made.clear()
	_puffs.clear()
	_restore()


func _build() -> void:
	_clear()
	var h := host()
	if h == null:
		return
	info = read(h) if not read(h).is_empty() else {}
	if info.is_empty():
		for mi in h.find_children("*", "MeshInstance3D", true, false):
			info = read(mi)
			if not info.is_empty():
				break
	if info.is_empty() or not enabled:
		return
	_materials(h)
	if flame and _kind("flame") and info.get("flame") is Dictionary:
		var i := 0
		for s in info["flame"].get("sockets", []):
			var at := h.find_child("socket_" + str(s), true, false) as Node3D
			if at != null:
				_flame(at, i)
				i += 1
	for k in ["smoke", "steam"]:
		if bool(get(k)) and _kind(k) and info.get(k) is Dictionary:
			for s in info[k].get("sockets", []):
				var at := h.find_child("socket_" + str(s), true, false) as Node3D
				if at != null:
					_puff_new(k, at)


func _materials(h: Node3D) -> void:
	var g: Dictionary = info.get("glow", {}) if info.get("glow") is Dictionary else {}
	var w: Dictionary = info.get("wax", {}) if info.get("wax") is Dictionary else {}
	var follows := str(g.get("follows", ""))
	var glow_on := glow and _kind("glow") and (follows == "" or (bool(get(follows)) and _kind(follows)))
	var wax_on := wax and _kind("wax")
	var glow_mats: Array = g.get("materials", [])
	var wax_mats: Array = w.get("materials", [])
	for mi in h.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var had: Material = mi.get_surface_override_material(i)
			var base: Material = had if had != null else mi.mesh.surface_get_material(i)
			if not (base is StandardMaterial3D):
				continue
			var nm := str(base.resource_name)
			var is_glow := glow_mats.has(nm)
			var is_wax := wax_mats.has(nm) and wax_on
			if not is_glow and not is_wax:
				continue
			var m: StandardMaterial3D = base.duplicate()
			_over.append([mi, i, had])
			mi.set_surface_override_material(i, m)
			if is_glow:
				m.emission_enabled = glow_on
				if glow_on:
					if glow_energy >= 0.0:
						m.emission_energy_multiplier = glow_energy
					_glows.append([m, m.emission_energy_multiplier])
			if is_wax:
				m.subsurf_scatter_enabled = true
				m.subsurf_scatter_strength = wax_glow
				m.subsurf_scatter_skin_mode = false
				m.backlight_enabled = true
				m.backlight = Color(0.78, 0.52, 0.3) * wax_glow


func _flame(at: Node3D, i: int) -> void:
	var s := flame_size
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.013, 0.036) * s
	mi.mesh = q
	var m := ShaderMaterial.new()
	m.shader = FLAME_SHADER
	m.set_shader_parameter("tint", flame_color)
	m.set_shader_parameter("seed", float(i) * 7.31 + float(hash(str(at.name)) % 97))
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = Vector3(0, 0.016 * s, 0)            # in the socket's frame: its +Y the way the flame rises
	at.add_child(mi)
	_made.append(mi)
	if flame_light:
		var L := OmniLight3D.new()
		L.set_script(LIGHT_SCRIPT)
		L.light_color = flame_color
		L.light_energy = 0.55
		L.omni_range = 2.6
		L.light_size = 0.012
		L.shadow_enabled = flame_shadows
		L.set("mode", "candle")
		L.set("on_mains", false)
		L.set("seed", i + 1)
		L.position = Vector3(0, 0.024 * s, 0)
		at.add_child(L)
		_made.append(L)


func _puff_new(kind: String, at: Node3D) -> void:
	var o: Dictionary = PUFFS[kind]
	var n: int = int(ceil(float(o["rate"]) * float(o["life"]))) + 2
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true                          # x a puff's age, y its seed, z its spin (puff.gdshader)
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	mm.mesh = q
	mm.instance_count = n
	for k in n:
		mm.set_instance_transform(k, Transform3D(Basis().scaled(Vector3.ZERO), Vector3(0, -99, 0)))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.top_level = true                               # the puffs live in the world, not on the prop
	var m := ShaderMaterial.new()
	m.shader = PUFF_SHADER
	var c: Color = o["color"]
	m.set_shader_parameter("color", Color(c.r * puff_brightness, c.g * puff_brightness, c.b * puff_brightness, 1.0))
	mmi.material_override = m
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)
	_made.append(mmi)
	_puffs.append({"node": mmi, "mm": mm, "o": o, "n": n, "born": [], "acc": 0.0, "next": 0, "at": at})


func _puff_tick(P: Dictionary, dt: float) -> void:
	var at: Node3D = P["at"]
	if not is_instance_valid(at) or not at.is_inside_tree():
		return
	var o: Dictionary = P["o"]
	var p := at.global_position
	var dir := at.global_transform.basis.y.normalized()
	P["acc"] = float(P["acc"]) + float(o["rate"]) * puff_rate * dt
	var born: Array = P["born"]
	while float(P["acc"]) >= 1.0:
		P["acc"] = float(P["acc"]) - 1.0
		var i: int = P["next"]
		P["next"] = (i + 1) % int(P["n"])
		var a := _rng.randf() * TAU
		var side := dir.cross(Vector3.UP if absf(dir.y) < 0.9 else Vector3.RIGHT).normalized()
		var up2 := side.cross(dir)
		var vel: Vector3 = dir * float(o["speed"]) + Vector3.UP * float(o["rise"]) + (side * cos(a) + up2 * sin(a)) * float(o["spread"]) * (_rng.randf() * 2.0 - 1.0)
		var slot := {"i": i, "t0": _t, "p": p, "v": vel, "curl": _rng.randf() * TAU, "seed": _rng.randf(), "spin": (_rng.randf() * 2.0 - 1.0) * float(o["spin"])}
		if born.size() < int(P["n"]):
			born.append(slot)
		else:
			born[i] = slot
	var mm: MultiMesh = P["mm"]
	for b in born:
		var age: float = _t - float(b["t0"])
		var life: float = float(o["life"])
		if age > life or age < 0.0:
			mm.set_instance_transform(b["i"], Transform3D(Basis().scaled(Vector3.ZERO), Vector3(0, -99, 0)))
			continue
		var u := age / life
		var size: float = lerpf(float(o["size"][0]), float(o["size"][1]), u)
		var pos: Vector3 = b["p"] + b["v"] * age + Vector3(sin(float(b["curl"]) + age * 2.0), 0, cos(float(b["curl"]) + age * 1.7)) * float(o["curl"]) * u
		mm.set_instance_transform(b["i"], Transform3D(Basis().scaled(Vector3.ONE * size), pos))
		var c: Color = o["color"]
		mm.set_instance_color(b["i"], Color(c.r, c.g, c.b, float(o["alpha"]) * (1.0 - u * u) * minf(1.0, u * 6.0)))
		mm.set_instance_custom_data(b["i"], Color(u, float(b["seed"]), float(b["spin"]), 0.0))
	(P["node"] as MultiMeshInstance3D).custom_aabb = AABB(p - Vector3(1, 0.2, 1), Vector3(2, 2, 2))
