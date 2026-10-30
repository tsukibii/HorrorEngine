## A light shaft (shaft_card.gdshader; docs/GODOT_LOOK.md §1c): the beam a window throws into a room, dust drifting
## in it, drawn as a card: two crossed translucent planes along the beam and five slices across it (Light Kit's
## Window shaft card), each fading as it turns edge-on, added to the picture; one beam from any side, no foot on
## the floor. `HSShaft.make(at, into, width,
## height, reach, settings)` one from the window's middle `at` along `into` (both in the parent's space; -Z runs into
## the room), `width` and `height` the glass, `reach` how far the beam goes. The node is still a FogVolume (the
## export writes one along each window's light with `shaft`, and the demo's and the checks' handles are kept) but it
## holds no fog: its material is empty fog, and the card is its child. Settings: `strength` 0..1 (the density, 0.3
## at 1), `dust` 0..1, `drift`, `color`. The window's own light with its `light_volumetric_fog_energy` raised
## (`HSShaft.light(spot, k)`) still lights the room's haze near the glass.
## (A FogVolume box with a fog shader till 2026-10-30: the froxel grid drew its foot on the floor as a crisp
## rectangle that came and went with the eye and faded with distance: the user's pictures.)
class_name HSShaft
extends FogVolume

var mat: ShaderMaterial


static func make(at: Vector3, into: Vector3, width: float, height: float, reach: float = 3.0, s: Dictionary = {}) -> HSShaft:
	var sh := HSShaft.new()
	sh.name = "Shaft"
	sh.size = Vector3(width * 1.15, height * 1.15, reach)
	var dir := into.normalized()
	var centre := at + dir * reach * 0.5
	var up := Vector3.UP if absf(dir.y) < 0.99 else Vector3.FORWARD
	sh.transform = Transform3D(Basis.looking_at(dir, up), centre)        # looking_at: -Z along the beam
	wear(sh, s)
	return sh


## the beam onto a FogVolume that's there (the export writes one along each window's light with `shaft`): the fog
## emptied, the card made (or redressed) as its child
static func wear(fv: FogVolume, s: Dictionary = {}) -> ShaderMaterial:
	fv.shape = RenderingServer.FOG_VOLUME_SHAPE_BOX
	var empty := FogMaterial.new()
	empty.density = 0.0
	fv.material = empty
	var card: MeshInstance3D = fv.get_node_or_null("Card")
	if card == null:
		card = MeshInstance3D.new()
		card.name = "Card"
		card.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		fv.add_child(card)
	card.mesh = card_mesh(fv.size)
	var m: ShaderMaterial = null
	for si in card.mesh.get_surface_count():                   # a material a surface: the plane's share of the beam
		var sm := ShaderMaterial.new()
		sm.shader = load("res://addons/horrorstudio_look/shaft_card.gdshader")
		sm.set_shader_parameter("density", 0.3 * float(s.get("strength", 1.0)))
		sm.set_shader_parameter("dust", float(s.get("dust", 0.5)))
		sm.set_shader_parameter("drift", float(s.get("drift", 0.12)))
		sm.set_shader_parameter("box_size", fv.size)
		sm.set_shader_parameter("weight", float(card.mesh.surface_get_name(si).substr(1)))
		var col = s.get("color")
		if col is Color:
			sm.set_shader_parameter("beam_color", col)
		elif col is Array and col.size() == 3:
			sm.set_shader_parameter("beam_color", Color(float(col[0]), float(col[1]), float(col[2])))
		card.set_surface_override_material(si, sm)
		if m == null:
			m = sm
	card.material_override = null
	if fv is HSShaft:
		fv.mat = m
	return m


## the beam's planes in the box's own space (the window at +Z/2, the end at -Z/2): two crossed along it (the side
## views) and five slices across it (the view down the beam), each a surface of its own with its share
static func card_mesh(size: Vector3) -> ArrayMesh:
	var am := ArrayMesh.new()
	var z0 := size.z / 2.0
	var z1 := -size.z / 2.0
	var quads: Array = []                                      # [four corners, normal, weight]
	quads.append([[Vector3(0, -size.y / 2, z0), Vector3(0, size.y / 2, z0), Vector3(0, size.y / 2, z1), Vector3(0, -size.y / 2, z1)], Vector3(1, 0, 0), 1.0])
	quads.append([[Vector3(-size.x / 2, 0, z0), Vector3(size.x / 2, 0, z0), Vector3(size.x / 2, 0, z1), Vector3(-size.x / 2, 0, z1)], Vector3(0, 1, 0), 1.0])
	var slices := 5
	for i in slices:
		var z: float = lerp(z0, z1, (float(i) + 0.5) / float(slices))
		quads.append([[Vector3(-size.x / 2, -size.y / 2, z), Vector3(size.x / 2, -size.y / 2, z), Vector3(size.x / 2, size.y / 2, z), Vector3(-size.x / 2, size.y / 2, z)], Vector3(0, 0, 1), 1.0 / float(slices)])
	for q in quads:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for tri in [[0, 1, 2], [0, 2, 3]]:
			for i in tri:
				st.set_normal(q[1])
				st.set_uv(Vector2(0, 0))
				st.add_vertex(q[0][i])
		st.commit(am)
		am.surface_set_name(am.get_surface_count() - 1, "w%.3f" % float(q[2]))
	return am


static func shader() -> Shader:
	return load("res://addons/horrorstudio_look/shaft_card.gdshader")


func settings(s: Dictionary) -> void:
	wear(self, s)


## the window's light into the haze: its volumetric energy up, so the room's haze near the glass shows the light
static func light(spot: Light3D, k: float = 4.0) -> void:
	spot.light_volumetric_fog_energy = k
