@tool
extends EditorPlugin
## The grip's gizmo pictured in Godot's editor (tools/godot/motion_check.py gizmo; docs/ANIMATOR_V3.md §4.1): installed
## as a plugin of its own in the check's by-hand project. It makes a small scene (a water bottle and a bat, an HSGrip
## under each), opens it, selects each grip in turn and pictures the editor: the whole window (the Inspector with the
## grip's fields beside the 3D view) and the 3D view alone, close. Then it quits the editor.
## Prints GRIPSHOTS {json}. The folder for the pictures is in res://grip_shots.json.

var out_dir := ""
var surface: Control
var vp: SubViewport
var cam: Camera3D
var did: Array = []
var errors: Array = []


func _enter_tree() -> void:
	_run.call_deferred()


func frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func secs(t: float) -> void:
	await get_tree().create_timer(t).timeout


## the editor still starting, or at something: its scan of the project, and its own progress boxes ("Updating Scene
## Groups", "Loading editor"), which are drawn over the middle of the window
func busy() -> bool:
	if EditorInterface.get_resource_filesystem().is_scanning():
		return true
	for w in get_tree().root.find_children("*", "ProgressDialog", true, false):
		if w is CanvasItem and (w as CanvasItem).is_visible_in_tree():
			return true
		if w is Window and (w as Window).visible:
			return true
	return false


func settled() -> void:
	var quiet := 0
	for i in 400:
		quiet = 0 if busy() else quiet + 1
		if quiet >= 5:
			return
		await secs(0.5)
	errors.append("the editor never settled")


func pick(n: Node) -> void:
	EditorInterface.get_selection().clear()
	EditorInterface.get_selection().add_node(n)
	EditorInterface.edit_node(n)
	await frames(8)


## a key sent to the 3D view (F: the view's own Focus Selection)
func key(code: Key) -> void:
	for down in [true, false]:
		var e := InputEventKey.new()
		e.keycode = code
		e.physical_keycode = code
		e.pressed = down
		surface.gui_input.emit(e)
		await frames(3)


## the view brought to `dist` metres from `at` by the wheel (the view's own zoom steps)
func zoom_to(at: Vector3, dist: float) -> void:
	for i in 80:
		var d := cam.global_position.distance_to(at)
		if d > dist * 1.08:
			await wheel(-1)
		elif d < dist * 0.92:
			await wheel(1)
		else:
			break


func wheel(n: int) -> void:
	for i in absi(n):
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_WHEEL_DOWN if n > 0 else MOUSE_BUTTON_WHEEL_UP
		e.pressed = true
		e.factor = 1.0
		e.position = surface.size * 0.5
		surface.gui_input.emit(e)
		await frames(1)


func orbit(by: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.button_mask = MOUSE_BUTTON_MASK_MIDDLE
	e.relative = by
	e.position = surface.size * 0.5
	surface.gui_input.emit(e)
	await frames(2)


func pan(by: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.button_mask = MOUSE_BUTTON_MASK_MIDDLE
	e.shift_pressed = true
	e.relative = by
	e.position = surface.size * 0.5
	surface.gui_input.emit(e)
	await frames(2)


func shot(name: String, close: bool) -> void:
	await frames(8)
	await RenderingServer.frame_post_draw
	var img := EditorInterface.get_base_control().get_viewport().get_texture().get_image()
	if close:
		var r := Rect2i(surface.get_global_rect())
		var side := mini(r.size.x, r.size.y)
		img = img.get_region(Rect2i(r.position + (r.size - Vector2i(side, side)) / 2, Vector2i(side, side)))
	img.save_png(out_dir.path_join(name + ".png"))
	did.append(name)


func _done() -> void:
	print("GRIPSHOTS " + JSON.stringify({"shots": did, "errors": errors}))
	get_tree().quit()


func _run() -> void:
	get_tree().create_timer(400.0).timeout.connect(func() -> void:
		errors.append("it never ended")
		_done())
	await secs(3.0)
	await settled()                                              # (the editor's first scan and its loading done: a picture taken before has a progress box over its middle)
	var cfg = JSON.parse_string(FileAccess.get_file_as_string("res://grip_shots.json"))
	out_dir = String((cfg if cfg is Dictionary else {}).get("out", ""))
	if out_dir == "":
		errors.append("no folder for the pictures")
		_done()
		return
	DirAccess.make_dir_recursive_absolute(out_dir)
	# the scene: a table, a bottle on it with a grip to drink it by, a bat stood on it with a grip to swing it by
	var root := Node3D.new()
	root.name = "Props"
	var table := MeshInstance3D.new()
	table.name = "Table"
	var top := BoxMesh.new()
	top.size = Vector3(1.4, 0.04, 0.9)
	table.mesh = top
	var oak := StandardMaterial3D.new()
	oak.albedo_color = Color(0.46, 0.4, 0.34)
	oak.roughness = 0.8
	table.material_override = oak
	root.add_child(table)
	table.owner = root
	table.position = Vector3(0, -0.02, 0)
	var bottle_file := "res://addons/horrorstudio_devices/shop/models/water_bottle.glb"
	var bottle: Node3D = (load(bottle_file) as PackedScene).instantiate() as Node3D if ResourceLoader.exists(bottle_file) else Node3D.new()
	bottle.name = "WaterBottle"
	root.add_child(bottle)
	bottle.owner = root
	var g1 := HSGrip.new()
	g1.name = "Grip"
	bottle.add_child(g1)
	g1.owner = root
	g1.position = Vector3(0, 0.086, 0)
	g1.size = 0.064
	g1.length = 0.1
	g1.use = 2
	g1.mouth = Vector3(0, 0.119, 0)
	g1.tip = Vector3(0, 0.119, 0)
	var bat := MeshInstance3D.new()
	bat.name = "Bat"
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.03
	cyl.bottom_radius = 0.0175
	cyl.height = 0.78
	bat.mesh = cyl
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.72, 0.55, 0.36)
	wood.roughness = 0.6
	bat.material_override = wood
	root.add_child(bat)
	bat.owner = root
	bat.position = Vector3(0.45, 0.39, 0)
	var g2 := HSGrip.new()
	g2.name = "Grip"
	bat.add_child(g2)
	g2.owner = root
	g2.position = Vector3(0, -0.27, 0)
	g2.size = 0.036
	g2.length = 0.2
	g2.tip = Vector3(0, 0.6, 0)
	g2.mouth = Vector3(0, 0.1, 0)
	var ps := PackedScene.new()
	ps.pack(root)
	ResourceSaver.save(ps, "res://grip_demo.tscn")
	root.free()
	EditorInterface.open_scene_from_path("res://grip_demo.tscn")
	var scene: Node = null
	for i in 400:
		await frames(1)
		scene = EditorInterface.get_edited_scene_root()
		if scene != null and scene.name == "Props":
			break
	if scene == null or scene.name != "Props":
		errors.append("the scene didn't open")
		_done()
		return
	EditorInterface.set_main_screen_editor("3D")
	await frames(10)
	await settled()
	vp = EditorInterface.get_editor_viewport_3d(0)
	cam = vp.get_camera_3d()
	for c in vp.get_parent().get_parent().get_children():
		if c.get_class() == "Control":
			surface = c
	if surface == null or cam == null:
		errors.append("no 3D view")
		_done()
		return
	# the bottle's grip: the view on the bottle (the view's own Focus Selection), turned a little and brought in; then
	# its grip picked: the whole editor with the grip's fields in the Inspector, then the view alone
	await pick(scene.get_node("WaterBottle"))
	await key(KEY_F)
	await frames(30)
	await orbit(Vector2(-60, 0))
	await zoom_to(Vector3(0, 0.1, 0), 0.42)
	await pick(scene.get_node("WaterBottle/Grip"))
	did.append("the camera %.2f m from the bottle" % cam.global_position.distance_to(Vector3(0, 0.1, 0)))
	await shot("grip_editor", false)
	await zoom_to(Vector3(0, 0.1, 0), 0.31)
	await frames(40)                                             # (the view's zoom bar gone again)
	await shot("grip_bottle", true)
	# the bat's: the view on its handle, the bat going up out of it to its end
	await pick(scene.get_node("Bat"))
	await key(KEY_F)
	await frames(30)
	await zoom_to(Vector3(0.45, 0.39, 0), 0.8)
	await frames(40)
	await pick(scene.get_node("Bat/Grip"))
	did.append("the camera %.2f m from the bat" % cam.global_position.distance_to(Vector3(0.45, 0.39, 0)))
	await shot("grip_bat", true)
	_done()
