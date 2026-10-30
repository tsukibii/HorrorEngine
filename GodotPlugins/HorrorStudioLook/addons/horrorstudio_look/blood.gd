## Blood (blood.gdshader; docs/GODOT_LOOK.md): a splat material for a flat thing (`HSBlood.material(seed)`, the
## story's `clean` stains of kind blood wear it; `set_opacity` as it's scrubbed, `set_dry` as it dries), and a splat
## dropped anywhere as a quad over a surface (`HSBlood.splat(parent, at, normal, size, seed)`: on a floor or up a wall,
## drips when the surface is upright).
class_name HSBlood


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/blood.gdshader")


static func material(seed: float = 1.0, settings: Dictionary = {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader()
	m.set_shader_parameter("seed", seed)
	for k in settings:
		m.set_shader_parameter(k, settings[k])
	return m


static func set_opacity(m: Material, k: float) -> void:
	if m is ShaderMaterial:
		m.set_shader_parameter("opacity", clamp(k, 0.0, 1.0))


static func set_dry(m: Material, k: float) -> void:
	if m is ShaderMaterial:
		m.set_shader_parameter("dry", clamp(k, 0.0, 1.0))


## a splat as a quad 2 mm over the surface at `at` facing `normal` (its up along the wall for drips), `size` metres
static func splat(parent: Node, at: Vector3, normal: Vector3, size: float = 0.6, seed: float = 1.0, settings: Dictionary = {}) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = "blood_%d" % int(seed * 100)
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	mi.mesh = q
	var upright: bool = abs(normal.y) < 0.5
	var s := settings.duplicate()
	if upright and not s.has("drips"):
		s["drips"] = 0.5
	mi.material_override = material(seed, s)
	parent.add_child(mi)
	var n := normal.normalized()
	var up := Vector3.UP if upright else Vector3.FORWARD
	mi.global_position = at + n * 0.002
	mi.look_at(at + n * 0.002 + n, up)        # the quad's -z faces along -n; QuadMesh faces +z, so look along -n... flipped below
	mi.rotate_object_local(Vector3.UP, PI)
	return mi
