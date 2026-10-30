## Wet surfaces (wet.gdshader; docs/GODOT_LOOK.md): a floor's material swapped for a wet one that keeps its colour,
## texture and roughness: `HSWet.wet(mesh_instance, {wetness, puddles, ripples})`; `HSWet.dry(mesh_instance)` puts
## the old one back. The runtime wets the floors of the rooms the rain falls in (`game.weather`). For the reflections
## the environment needs SSR on (HSLook's realism has it). `HSWet.puddle(parent, at, size, seed)` is one puddle on any
## surface as a Decal (Light Kit's Puddle): an irregular pool from a seed, mirror-smooth in the middle (its ORM map's
## roughness), damp at its edge, its textures made in code.
class_name HSWet

const META := "hs_wet_was"


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/wet.gdshader")


## the mesh's material made wet; settings: wetness 0..1 (0.8), puddles 0..1 (0.5), puddle_scale m (0.9), ripples 0..1 (0),
## water_tint (Color), roughness (the base's, when the old material has none)
static func wet(mi: MeshInstance3D, settings: Dictionary = {}) -> ShaderMaterial:
	if mi == null:
		return null
	var old = mi.material_override if mi.material_override != null else (mi.get_active_material(0) if mi.mesh != null and mi.mesh.get_surface_count() > 0 else null)
	if old is ShaderMaterial and old.shader == shader():
		for k in settings:
			old.set_shader_parameter(k, settings[k])
		return old
	var m := ShaderMaterial.new()
	m.shader = shader()
	var col := Color(0.23, 0.2, 0.18)
	var rough := 1.0
	var tex = null
	var uvs := Vector3.ONE
	if old is StandardMaterial3D:
		col = old.albedo_color
		rough = old.roughness
		tex = old.albedo_texture
		uvs = old.uv1_scale
	m.set_shader_parameter("albedo", col)
	m.set_shader_parameter("roughness", float(settings.get("roughness", rough)))
	m.set_shader_parameter("uv1_scale", uvs)
	if tex != null:
		m.set_shader_parameter("texture_albedo", tex)
		m.set_shader_parameter("use_texture", true)
		if old is StandardMaterial3D and old.uv1_triplanar:
			m.set_shader_parameter("world_uv", true)       # a world-aligned surface keeps its place
	for k in ["wetness", "puddles", "puddle_scale", "ripples", "ripple_rate", "water_tint", "edge", "band_on", "band_centre", "band_axis", "band_half", "band_top", "band_bottom", "band_feather"]:
		if settings.has(k):
			m.set_shader_parameter(k, settings[k])
	mi.set_meta(META, old)
	mi.material_override = m
	return m


## one puddle as a decal over the surface under `at` (a floor: it projects down `depth` metres); size metres across
static func puddle(parent: Node, at: Vector3, size: float = 0.9, seed: int = 1, depth: float = 0.3) -> Decal:
	var d := Decal.new()
	d.name = "puddle_%d" % seed
	var tex := puddle_textures(seed)
	d.texture_albedo = tex["albedo"]
	d.texture_orm = tex["orm"]
	d.texture_normal = tex["normal"]
	d.size = Vector3(size, depth, size * (0.8 + 0.4 * float(seed % 3) / 2.0))
	d.albedo_mix = 1.0
	d.normal_fade = 0.2
	d.upper_fade = 2.0
	d.lower_fade = 2.0
	d.cull_mask = 0xFFFFF
	parent.add_child(d)
	d.global_position = at
	d.rotation.y = float(seed) * 1.7
	return d


static var _puddle_cache: Dictionary = {}


## the puddle's maps from a seed: albedo (a dark water tint, its alpha the pool with a damp rim), ORM (roughness
## near zero in the pool, the surface's own outside it), a flat normal
static func puddle_textures(seed: int) -> Dictionary:
	if _puddle_cache.has(seed):
		return _puddle_cache[seed]
	var n := 128
	var alb := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var orm := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var nrm := Image.create(n, n, false, Image.FORMAT_RGB8)
	nrm.fill(Color(0.5, 0.5, 1.0))
	var rng := RandomNumberGenerator.new()
	rng.seed = seed * 7919
	var lobes: Array = []
	for i in 5:
		lobes.append([rng.randf_range(0.3, 0.7), rng.randf_range(0.3, 0.7), rng.randf_range(0.12, 0.3)])
	for y in n:
		for x in n:
			var u := float(x) / n
			var v := float(y) / n
			var f := 0.0
			for l in lobes:                                 # soft blobs summed: an irregular pool
				var dx: float = u - float(l[0])
				var dy: float = v - float(l[1])
				var r2: float = dx * dx + dy * dy
				f += exp(-r2 / (2.0 * float(l[2]) * float(l[2]) * 0.4))
			f += (rng.randf() - 0.5) * 0.08                 # a ragged edge
			var water: float = clamp((f - 0.55) / 0.12, 0.0, 1.0)
			var damp: float = clamp((f - 0.35) / 0.2, 0.0, 1.0)
			alb.set_pixel(x, y, Color(0.03, 0.04, 0.05, max(water * 0.75, damp * 0.35)))
			orm.set_pixel(x, y, Color(1.0, lerp(1.0, 0.03, water), 0.0, max(water, damp * 0.5)))
	var out := {"albedo": ImageTexture.create_from_image(alb), "orm": ImageTexture.create_from_image(orm), "normal": ImageTexture.create_from_image(nrm)}
	_puddle_cache[seed] = out
	return out


static func dry(mi: MeshInstance3D) -> void:
	if mi != null and mi.has_meta(META):
		mi.material_override = mi.get_meta(META)
		mi.remove_meta(META)


## every floor under a node (the level) made wet: the pieces whose kind is floor (the export's metadata), in the rooms
## named (all when the list is empty); returns how many
static func wet_floors(level: Node, rooms: Array = [], settings: Dictionary = {}) -> int:
	var n := 0
	for ch in level.find_children("*", "", true, false):   # (the export groups a level's nodes in folders by kind)
		if not ch.has_meta("piece"):
			continue
		var p = JSON.parse_string(ch.get_meta("piece"))
		if not (p is Dictionary) or p.get("kind") != "floor":
			continue
		if not rooms.is_empty() and not rooms.has(p.get("room")):
			continue
		var mi = ch.get_node_or_null("mesh")
		if mi is MeshInstance3D:
			wet(mi, settings)
			n += 1
	return n
