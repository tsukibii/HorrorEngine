## Light zones (LOOKPLUGIN's nodes part; docs/GODOT_LOOK.md §0): two rooms side by side with a doorway between them,
## room_bulb in the first and room_lamp in the second, as a user would drop them in. Measured (zones.json): the
## rooms on different layers and their shared wall on both; the bulb's reach fitted to its room; from the first room
## looking through the doorway, the second room's floor no brighter with the bulb on than off (the bulb kept to its
## room), and brighter when the zone lets it out (the measure can tell); the second room's lamp switched off while the
## eye looks away from it and on again when it looks back; a save puts every layer, mask and reach back, and after it
## they're on again. Pictured: zones.png (through the doorway).
##   godot --path PROJECT --fixed-fps 60 -s res://addons/horrorstudio_look/demo/zones.gd -- --out=DIR
extends SceneTree

var out_dir := "res://"
var world: Node3D
var cam: Camera3D
var floor_a: MeshInstance3D
var floor_b: MeshInstance3D
var wall_ab: MeshInstance3D
var za: HSLightZone
var zb: HSLightZone
var n := 0
var rep := {}
var on_img: Image = null
var mask0 := 0                     # the bulb's own cull mask, as the preset has it


func box(size: Vector3, at: Vector3, col := Color(0.55, 0.53, 0.5)) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	bm.material = m
	mi.mesh = bm
	world.add_child(mi)
	mi.position = at
	return mi


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
	world = Node3D.new()
	root.add_child(world)
	var we := WorldEnvironment.new()
	we.environment = Environment.new()
	we.environment.background_mode = Environment.BG_COLOR
	we.environment.background_color = Color(0, 0, 0)
	we.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	we.environment.ambient_light_color = Color(1, 1, 1)
	we.environment.ambient_light_energy = 0.02
	world.add_child(we)
	# room A: x -4..0, room B: x 0..4; both z -2..2, 3 m high; the wall between at x = 0 with a doorway (z -0.5..0.5)
	floor_a = box(Vector3(3.9, 0.1, 3.9), Vector3(-2, -0.05, 0), Color(0.5, 0.45, 0.4))
	floor_b = box(Vector3(3.9, 0.1, 3.9), Vector3(2, -0.05, 0), Color(0.5, 0.45, 0.4))
	box(Vector3(8, 0.1, 4), Vector3(0, 3.05, 0))                       # the ceiling over both (in neither alone)
	wall_ab = box(Vector3(0.1, 3, 1.5), Vector3(0, 1.5, -1.25))      # the shared wall, beside the doorway
	box(Vector3(0.1, 3, 1.5), Vector3(0, 1.5, 1.25))
	box(Vector3(0.1, 0.9, 1.0), Vector3(0, 2.55, 0))                 # over the doorway
	for x in [-4.0, 4.0]:
		box(Vector3(0.1, 3, 4), Vector3(x, 1.5, 0))
	for z in [-2.0, 2.0]:
		box(Vector3(8, 3, 0.1), Vector3(0, 1.5, z))
	var fresh: Node = (load("res://addons/horrorstudio_look/presets/room_bulb.tscn") as PackedScene).instantiate()
	mask0 = fresh.get_node("Bulb").light_cull_mask
	fresh.free()
	za = (load("res://addons/horrorstudio_look/presets/room_bulb.tscn") as PackedScene).instantiate()
	world.add_child(za)
	za.position = Vector3(-2, 1.5, 0)
	zb = (load("res://addons/horrorstudio_look/presets/room_lamp.tscn") as PackedScene).instantiate()
	world.add_child(zb)
	zb.position = Vector3(2, 1.5, 0)
	cam = Camera3D.new()
	world.add_child(cam)
	aim(Vector3(2.5, 0.0, 0))
	cam.fov = 70
	cam.current = true


## the eye in room A, by the far wall, looking at `target` (the transform set whole: look_at at the start didn't turn it)
func aim(target: Vector3) -> void:
	var pos := Vector3(-3.4, 1.6, 0)
	cam.transform = Transform3D(Basis.looking_at(target - pos, Vector3.UP), pos)


func lum(img: Image) -> float:
	var p: Vector2 = cam.unproject_position(Vector3(2.0, 0.0, 0.0))  # room B's floor, seen through the doorway
	var s := 0.0
	for dx in range(-6, 7):
		for dy in range(-4, 5):
			var c := img.get_pixel(clampi(int(p.x) + dx, 0, img.get_width() - 1), clampi(int(p.y) + dy, 0, img.get_height() - 1))
			s += 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
	return s / 117.0


func bulb() -> OmniLight3D:
	return za.get_node("Bulb")


func _process(_d: float) -> bool:
	n += 1
	if n == 20:
		rep["layers"] = [za.layer, zb.layer]
		rep["floor_a"] = floor_a.layers
		rep["floor_b"] = floor_b.layers
		rep["wall_ab"] = wall_ab.layers
		rep["bulb_mask"] = bulb().light_cull_mask
		rep["bulb_range"] = bulb().omni_range
		rep["lights"] = [za.lights.size(), zb.lights.size()]
		zb.get_node("Lamp").visible = false                          # room B's own lamp out: only the bulb could light its floor
		zb.get_node("Fill").visible = false
		zb.hide_unseen = false
	elif n == 30:
		on_img = root.get_texture().get_image()
		on_img.save_png(out_dir.path_join("zones.png"))
		bulb().visible = false
	elif n == 34:
		var off := root.get_texture().get_image()
		rep["b_floor_bulb_on"] = lum(on_img)
		rep["b_floor_bulb_off"] = lum(off)
		bulb().visible = true
		bulb().omni_range = 6.0                                       # the bulb let out of its room, with its own reach: the measure must see it
		bulb().light_cull_mask = mask0                                # of its room: the measure must see it
	elif n == 40:
		rep["b_floor_bulb_free"] = lum(root.get_texture().get_image())
		za.apply_now()                                                # kept to its room again
		zb.get_node("Lamp").visible = true
		zb.get_node("Fill").visible = true
		zb.hide_unseen = true
		zb.seen = true
		aim(Vector3(-6, 1.5, 0))                                       # facing away from room B
	elif n == 44:
		rep["b_lamp_away"] = zb.get_node("Lamp").visible
		aim(Vector3(2.5, 0.0, 0))                                      # back through the doorway
	elif n == 48:
		rep["b_lamp_back"] = zb.get_node("Lamp").visible
		world.propagate_notification(Node.NOTIFICATION_EDITOR_PRE_SAVE)
		rep["save_back"] = floor_a.layers == 1 and floor_b.layers == 1 and wall_ab.layers == 1 and bulb().light_cull_mask == mask0 and absf(bulb().omni_range - 6.0) < 0.001 and not floor_a.has_meta("hs_layers_was") and not bulb().has_meta("hs_zone")
		world.propagate_notification(Node.NOTIFICATION_EDITOR_POST_SAVE)
	elif n == 52:
		rep["after_save"] = floor_a.layers != 1 and bulb().omni_range < 6.0
		var f := FileAccess.open(out_dir.path_join("zones.json"), FileAccess.WRITE)
		f.store_string(JSON.stringify(rep, "  "))
		f.close()
		print("LOOKZONES " + JSON.stringify(rep))
		quit()
	return false
