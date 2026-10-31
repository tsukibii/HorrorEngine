## Liquid in a container (liquid.gdshaderinc; docs/PROPGEN.md §10). A made prop's liquid is a node of its own,
## `<name>_liquid`, the container's inside as a closed mesh, its glTF extras (`propgen_liquid`, Godot's metadata
## `extras`) holding its look, its fill and its fill table. `HSLiquid.attach(mesh_instance)` wears the shader with
## all that on it; `HSLiquid.auto(root)` puts an HSLiquidFill (the slosh) under every such mesh below root, which
## the game does for each level it enters. Any other closed mesh of a container's inside takes it too: give
## attach() a dictionary of the same keys (a table with one row and column is a level that doesn't follow volume).
@tool
class_name HSLiquid
extends RefCounted

const OPAQUE := preload("res://addons/horrorstudio_look/liquid.gdshader")
const CLEAR := preload("res://addons/horrorstudio_look/liquid_clear.gdshader")


static func info(mi: Node) -> Dictionary:
	if mi == null:
		return {}
	var ex = mi.get_meta("extras", {})
	if ex is Dictionary and ex.has("propgen_liquid"):
		var v = ex["propgen_liquid"]
		var d = JSON.parse_string(v) if v is String else v
		if d is Dictionary:
			return d
	return {}


static func table_texture(d: Dictionary) -> ImageTexture:
	var w := int(d.get("fills", 1))
	var h := int(d.get("tilts", 1))
	var data := PackedFloat32Array()
	for x in d.get("table", [0.5]):
		data.append(float(x))
	var img := Image.create_from_data(w, h, false, Image.FORMAT_RF, data.to_byte_array())
	return ImageTexture.create_from_image(img)


static func _vec(a, fallback: Vector3) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2])) if a is Array and a.size() == 3 else fallback


static func attach(mi: MeshInstance3D, d: Dictionary = {}) -> ShaderMaterial:
	if d.is_empty():
		d = info(mi)
	if mi == null or d.is_empty():
		return null
	var m := ShaderMaterial.new()
	m.shader = CLEAR if float(d.get("clarity", 0.0)) > 0.05 else OPAQUE
	m.set_shader_parameter("fill_table", table_texture(d))
	m.set_shader_parameter("table_size", Vector2(float(d.get("fills", 1)), float(d.get("tilts", 1))))
	m.set_shader_parameter("h_min", float(d.get("h_min", 0.0)))
	m.set_shader_parameter("h_max", float(d.get("h_max", 0.1)))
	m.set_shader_parameter("fill", float(d.get("fill", 0.6)))
	m.set_shader_parameter("clarity", float(d.get("clarity", 0.0)))
	m.set_shader_parameter("axis_local", _vec(d.get("axis"), Vector3.UP))
	m.set_shader_parameter("origin_local", _vec(d.get("origin"), Vector3.ZERO))
	for k in [["color", "liquid_color"], ["surface", "surface_color"], ["foam", "foam_color"]]:
		if d.has(k[0]):
			m.set_shader_parameter(k[1], Color.html(str(d[k[0]])))
	mi.material_override = m
	return m


## every liquid below root gets its slosh node (once); returns how many
static func auto(root: Node) -> int:
	if root == null:
		return 0
	var n := 0
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		if info(mi).is_empty() or mi.get_node_or_null("HSLiquidFill") != null:
			continue
		var f = load("res://addons/horrorstudio_look/nodes/liquid_fill.gd").new()
		f.name = "HSLiquidFill"
		mi.add_child(f)
		n += 1
	return n
