class_name HSModelSlot
extends RefCounted
## A thing's own model shown in a slot (DECISIONS 2026-10-29: the things themselves, not pictures): a small viewport
## with a world of its own (a cool fill, a warm key, a rim, no sky), an orthographic camera three-quarters from above,
## the model fitted to it; the TextureRect that shows it. The HUD's inventory row draws its slots with it, and so does
## the devices plugin's shop (HSLaptop's Order tab), so a thing looks the same wherever it's shown.
##   var frame := HSModelSlot.make(model, Vector2i(64, 64), true)     # the one in the hand: drawn every frame
##   frame.get_meta("turn").rotation.y += dt                         # turn it

## `model` (a Node3D outside the tree: it's added to the slot's world), the slot's pixels, and `live`: drawn every frame
## while it shows (else drawn once, when it's made); `turn_deg` how it sits (a flat thing stood up), `zoom` 1 fits it
static func make(model: Node3D, px: Vector2i, live: bool, turn_deg := Vector3.ZERO, zoom := 1.0) -> TextureRect:
	var vc := TextureRect.new()                      # the viewport's texture shown here (a SubViewportContainer would set
	vc.name = "Frame"                                # the update mode itself: every slot every frame)
	vc.custom_minimum_size = Vector2(px)
	vc.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	vc.stretch_mode = TextureRect.STRETCH_SCALE
	var vp := SubViewport.new()
	vp.name = "View"
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.size = px
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_WHEN_VISIBLE if live else SubViewport.UPDATE_ONCE
	vc.add_child(vp)
	vc.texture = vp.get_texture()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0, 0, 0, 0)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.62, 0.75)
	env.ambient_light_energy = 0.7
	var w := World3D.new()
	w.environment = env
	vp.world_3d = w
	var key := DirectionalLight3D.new()
	key.name = "Key"
	key.light_color = Color(1.0, 0.93, 0.82)
	key.light_energy = 1.5
	key.rotation_degrees = Vector3(-42, 35, 0)
	vp.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.name = "Rim"
	rim.light_color = Color(0.6, 0.7, 1.0)
	rim.light_energy = 0.8
	rim.rotation_degrees = Vector3(-15, -150, 0)
	vp.add_child(rim)
	var cam := Camera3D.new()
	cam.name = "Camera"
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 1.25 / max(zoom, 0.05)
	cam.near = 0.05
	cam.far = 20.0
	cam.keep_aspect = Camera3D.KEEP_HEIGHT if px.x >= px.y else Camera3D.KEEP_WIDTH
	cam.position = Vector3(0, 0, 6).rotated(Vector3.RIGHT, deg_to_rad(-24)).rotated(Vector3.UP, deg_to_rad(32))
	cam.look_at_from_position(cam.position, Vector3.ZERO, Vector3.UP)
	vp.add_child(cam)
	var turn := Node3D.new()
	turn.name = "Turn"
	vp.add_child(turn)
	var fit := Node3D.new()
	fit.name = "Fit"
	turn.add_child(fit)
	var sit := Node3D.new()                          # how it sits, about its own middle
	sit.name = "Sit"
	sit.rotation_degrees = turn_deg
	fit.add_child(sit)
	if model.get_parent() != null:
		model.get_parent().remove_child(model)
	sit.add_child(model)
	var b := bounds_of(sit, fit)
	var big: float = max(b.size.x, max(b.size.y, b.size.z))
	var k: float = (1.0 / big) if big > 1e-6 else 1.0
	fit.scale = Vector3(k, k, k)
	fit.position = -b.get_center() * k
	vc.set_meta("viewport", vp)
	vc.set_meta("turn", turn)
	vc.set_meta("model", model)
	return vc


## draw a slot made with live = false again (its model changed)
static func redraw(frame: TextureRect) -> void:
	var vp := frame.get_meta("viewport") as SubViewport
	if vp != null and vp.render_target_update_mode != SubViewport.UPDATE_WHEN_VISIBLE:
		vp.render_target_update_mode = SubViewport.UPDATE_ONCE


## the meshes' bounds under a node, in `space`'s space (that node's own when not given; the node need not be in the
## tree)
static func bounds_of(n: Node3D, space: Node3D = null) -> AABB:
	var box := AABB()
	var first := true
	var ms: Array = n.find_children("*", "MeshInstance3D", true, false)
	if n is MeshInstance3D:
		ms.append(n)
	var top: Node = space if space != null else n
	for m in ms:
		if m.mesh == null:
			continue
		var xf := Transform3D.IDENTITY
		var p: Node = m
		while p != null and p != top:
			if p is Node3D:
				xf = p.transform * xf
			p = p.get_parent()
		var a: AABB = xf * m.get_aabb()
		box = a if first else box.merge(a)
		first = false
	if first:
		box = AABB(Vector3(-0.1, -0.1, -0.1), Vector3(0.2, 0.2, 0.2))
	return box


## a copy of what a node looks like: its meshes (and their materials) where they are under it, nothing else (no script,
## no collider): a thing's model for a slot, taken from the thing in the room
static func copy_of(n: Node3D) -> Node3D:
	var g := Node3D.new()
	g.name = "copy_" + str(n.name)
	var ms: Array = n.find_children("*", "MeshInstance3D", true, false)
	if n is MeshInstance3D:
		ms.append(n)
	for m in ms:
		var mi := m as MeshInstance3D
		if mi.mesh == null or not mi.is_visible_in_tree() and mi != n and n.is_inside_tree():
			continue
		var c := MeshInstance3D.new()
		c.mesh = mi.mesh
		c.material_override = mi.material_override
		c.material_overlay = mi.material_overlay
		for i in mi.get_surface_override_material_count():
			c.set_surface_override_material(i, mi.get_surface_override_material(i))
		var xf := Transform3D.IDENTITY
		var p: Node = mi
		while p != null and p != n:
			if p is Node3D:
				xf = p.transform * xf
			p = p.get_parent()
		c.transform = xf
		g.add_child(c)
	return g


## a scene's model for a slot: an instance of it with its scripts' work left out (a made prop's .glb or .tscn)
static func of_scene(scene: PackedScene) -> Node3D:
	if scene == null:
		return null
	var inst := scene.instantiate()
	if not inst is Node3D:
		inst.free()
		return null
	var c := copy_of(inst as Node3D)
	inst.free()
	return c
