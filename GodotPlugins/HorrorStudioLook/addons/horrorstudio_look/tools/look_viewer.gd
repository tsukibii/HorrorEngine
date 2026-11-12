## The look viewer (docs/GODOT_LOOK.md §5r, DECISIONS 2026-11-12, later: "a tool that lets us toggle between the eyes
## and skin shades (allows us to use default too)"): a scene to run by itself (open it and press F6, or Project > Tools >
## HorrorStudio: look viewer). It loads a character (every .glb under the project's `exports/characters` and
## `game/people`, or one opened from disk; with none, a stand-in with a skin and two plain eyes), puts her look on as a
## game does (an HSCharacterLook) and an HSLookSwitch under her, and shows the picker (look_picker.gd) beside her:
## every skin and eye look toggled at once, their colours and amounts, Default, and Save as a look: an HSLookPreset
## in `res://looks/`, to drag into a switch's Looks in your game. Above her: the lamp (off: what glows of itself), what's
## behind her (dark, grey, stripes: the cloak wants something to bend), walking (the cloak shows when she moves), turning.
## Drag to look round her, the wheel to come closer, Face and Body to frame her.
##   godot --path PROJECT res://addons/horrorstudio_look/tools/look_viewer.tscn -- [--glb=FILE] [--look=JSON] [--behind=stripes] [--lamp=off] [--view=body] [--shot=FILE.png]
extends Node3D

const DIRS := ["res://exports/characters", "res://game/people", "res://characters"]
var who: Node3D = null
var sw: HSLookSwitch = null
var picker: HSLookPicker = null
var env: Environment
var cam: Camera3D
var key: SpotLight3D
var fill: OmniLight3D
var wall: MeshInstance3D
var wall_mats := {}
var list: OptionButton
var files: Array = []                 # the characters found: res:// paths ("" the stand-in)
var yaw := 0.35
var pitch := 0.05
var dist := 1.4
var aim := Vector3(0, 1.5, 0)
var tall := 1.7
var walking := false
var turning := false
var clock := 0.0
var shot := ""
var shot_look := {}
var frames := 0
var _drag := false
var face_view := true
var _lamp_box: CheckButton
var _behind_box: OptionButton


func _ready() -> void:
	var args := {}
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--") and a.contains("="):
			args[a.substr(2, a.find("=") - 2)] = a.substr(a.find("=") + 1)
	shot = str(args.get("shot", ""))
	if args.has("look"):
		var parsed = JSON.parse_string(str(args["look"]))
		if parsed is Dictionary:
			for k in parsed:
				shot_look[k] = Color.html(parsed[k]) if (k == "eye_color" or k == "skin_tint") else parsed[k]
	env = Environment.new()
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	HSLook.apply(get_viewport(), env, "balanced")
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.015, 0.016, 0.02)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.55, 0.65)
	env.ambient_light_energy = 0.12
	env.volumetric_fog_enabled = false
	env.fog_enabled = false
	cam = Camera3D.new()
	cam.fov = 35.0
	add_child(cam)
	cam.current = true
	key = SpotLight3D.new()
	key.light_color = Color(1.0, 0.94, 0.85)
	key.light_energy = 3.0
	key.spot_range = 12.0
	key.spot_angle = 40.0
	key.shadow_enabled = true
	add_child(key)
	fill = OmniLight3D.new()
	fill.light_color = Color(0.6, 0.72, 1.0)
	fill.light_energy = 0.4
	fill.omni_range = 10.0
	add_child(fill)
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(12, 12)
	floor_mi.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.11, 0.11, 0.12)
	fm.roughness = 0.9
	floor_mi.material_override = fm
	add_child(floor_mi)
	wall = MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(8, 4)
	wall.mesh = qm
	add_child(wall)
	wall.position = Vector3(0, 2.0, -1.2)
	var grey := StandardMaterial3D.new()
	grey.albedo_color = Color(0.45, 0.45, 0.47)
	grey.roughness = 0.9
	var img := Image.create(256, 8, false, Image.FORMAT_RGB8)
	var cols := [Color(0.85, 0.85, 0.8), Color(0.04, 0.04, 0.05), Color(0.1, 0.55, 0.2), Color(0.8, 0.7, 0.1)]
	for y in 8:
		for x in 256:
			img.set_pixel(x, y, cols[(x / 4) % 4])
	var stripes := StandardMaterial3D.new()
	stripes.albedo_texture = ImageTexture.create_from_image(img)
	stripes.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	stripes.roughness = 0.9
	wall_mats = {"grey": grey, "stripes": stripes}
	_ui()
	behind(str(args.get("behind", "dark")))
	lamp(str(args.get("lamp", "on")) != "off")
	face_view = str(args.get("view", "face")) != "body"
	find_characters()
	var first := str(args.get("glb", ""))
	load_character(first if first != "" else (files[1] if files.size() > 1 else ""))


func _ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var scroll := ScrollContainer.new()
	scroll.position = Vector2(10, 10)
	scroll.size = Vector2(330, 700)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	layer.add_child(scroll)
	picker = HSLookPicker.new()
	scroll.add_child(picker)
	var bar := HBoxContainer.new()
	bar.position = Vector2(352, 10)
	layer.add_child(bar)
	list = OptionButton.new()
	list.item_selected.connect(func(i): load_character(files[i]))
	bar.add_child(list)
	var open := Button.new()
	open.text = "Open…"
	open.pressed.connect(_open)
	bar.add_child(open)
	var lb := CheckButton.new()
	lb.text = "Lamp"
	lb.button_pressed = true
	lb.toggled.connect(func(v): lamp(v))
	bar.add_child(lb)
	_lamp_box = lb
	var bh := OptionButton.new()
	for w in ["dark", "grey", "stripes"]:
		bh.add_item("Behind her: " + w)
	bh.item_selected.connect(func(i): behind(["dark", "grey", "stripes"][i]))
	bar.add_child(bh)
	_behind_box = bh
	var wk := CheckButton.new()
	wk.text = "Walk"
	wk.toggled.connect(_walk)
	bar.add_child(wk)
	var tn := CheckButton.new()
	tn.text = "Turn"
	tn.toggled.connect(_turn)
	bar.add_child(tn)
	var fb := Button.new()
	fb.text = "Face"
	fb.pressed.connect(frame.bind(true))
	bar.add_child(fb)
	var bb := Button.new()
	bb.text = "Body"
	bb.pressed.connect(frame.bind(false))
	bar.add_child(bb)


func _walk(on: bool) -> void:
	walking = on


func _turn(on: bool) -> void:
	turning = on


func _open() -> void:
	var fd := FileDialog.new()
	fd.access = FileDialog.ACCESS_FILESYSTEM
	fd.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	fd.filters = PackedStringArray(["*.glb ; a character exported for Godot"])
	fd.file_selected.connect(func(p): load_character(p))
	add_child(fd)
	fd.popup_centered(Vector2i(800, 500))


func lamp(on: bool) -> void:
	key.visible = on
	fill.visible = on
	_lamp_box.set_pressed_no_signal(on)
	env.ambient_light_energy = 0.12 if on else 0.01


func behind(what: String) -> void:
	wall.visible = wall_mats.has(what)
	_behind_box.select(maxi(0, ["dark", "grey", "stripes"].find(what)))
	if wall.visible:
		wall.material_override = wall_mats[what]


## every character in the project: the .glb files under its exports and its game's people
func find_characters() -> void:
	files = [""]
	for d in DIRS:
		_scan(d, 0)
	list.clear()
	list.add_item("A stand-in (a skin and two plain eyes)")
	for i in range(1, files.size()):
		list.add_item(str(files[i]).get_file().get_basename())


func _scan(dir: String, depth: int) -> void:
	var da := DirAccess.open(dir)
	if da == null or depth > 3:
		return
	for f in da.get_files():
		if f.to_lower().ends_with(".glb") and not files.has(dir.path_join(f)):
			files.append(dir.path_join(f))
	for sub in da.get_directories():
		_scan(dir.path_join(sub), depth + 1)


## a character by her file (a res:// or a disk path; "": the stand-in), her look on, a switch under her, the picker on it
func load_character(path: String) -> void:
	if who != null:
		who.queue_free()
		who = null
	var looks: Array[HSLookPreset] = []
	if sw != null:
		looks = sw.looks                              # (the looks saved so far go with the next character)
	if path == "":
		who = _stand_in()
	else:
		var doc := GLTFDocument.new()
		var st := GLTFState.new()
		var disk := ProjectSettings.globalize_path(path) if path.begins_with("res://") else path
		if doc.append_from_file(disk, st) == OK:
			who = doc.generate_scene(st) as Node3D
		if who == null:
			who = _stand_in()
			path = ""
	add_child(who)
	if path != "":
		var cl := HSCharacterLook.new()
		cl.glb_path = path
		who.add_child(cl)
	sw = HSLookSwitch.attach(who, {"panel_key": KEY_NONE, "by_story": false})
	sw.looks = looks
	for i in files.size():
		if files[i] == path:
			list.select(i)
	_ready_her.call_deferred()


func _ready_her() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	if sw == null or not is_instance_valid(sw):
		return
	sw.begin()
	picker.setup([sw])
	var bl = HSBlink.of(who)
	if bl != null and shot != "":
		bl.idle = false
	var bb := AABB()
	var first := true
	for mi in who.find_children("*", "MeshInstance3D", true, false):
		if not (mi as MeshInstance3D).visible or mi.mesh == null:
			continue
		var a: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		bb = a if first else bb.merge(a)
		first = false
	tall = maxf(bb.size.y, 0.3) if not first else 1.7
	frame(face_view)
	if not shot_look.is_empty():                      # a look asked for on the command line: on her, and in the picker
		sw.show(shot_look, 0.0)
		picker.setup([sw])


## the camera on her face, or on all of her
func frame(face: bool) -> void:
	face_view = face
	if face:
		aim = Vector3(0, tall * 0.9, 0)
		dist = maxf(0.55, tall * 0.45)
	else:
		aim = Vector3(0, tall * 0.52, 0)
		dist = tall * 1.9


## with no character: a skin (a body's ball and a head's) and two plain eyes, named as a character's are
func _stand_in() -> Node3D:
	var n := Node3D.new()
	n.name = "StandIn"
	var skin := StandardMaterial3D.new()
	skin.albedo_color = Color(0.78, 0.56, 0.47)
	skin.roughness = 0.6
	for part in [["standin_skin", 0.3, Vector3(0, 0.95, 0)], ["standin_head_skin", 0.17, Vector3(0, 1.45, 0)]]:
		var mi := MeshInstance3D.new()
		mi.name = part[0]
		var sm := SphereMesh.new()
		sm.radius = part[1]
		sm.height = 2.0 * float(part[1]) * (1.6 if part[0] == "standin_skin" else 1.0)
		sm.material = skin
		mi.mesh = sm
		mi.position = part[2]
		n.add_child(mi)
	var white := StandardMaterial3D.new()
	white.albedo_color = Color(0.92, 0.9, 0.88)
	white.roughness = 0.15
	for side in [["L", -0.065], ["R", 0.065]]:
		var e := MeshInstance3D.new()
		e.name = "standin_eye_" + str(side[0])
		var sm := SphereMesh.new()
		sm.radius = 0.03
		sm.height = 0.06
		sm.material = white
		e.mesh = sm
		e.position = Vector3(side[1], 1.48, 0.145)
		n.add_child(e)
	return n


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton:
		if e.button_index == MOUSE_BUTTON_LEFT or e.button_index == MOUSE_BUTTON_RIGHT:
			_drag = e.pressed
		elif e.button_index == MOUSE_BUTTON_WHEEL_UP and e.pressed:
			dist = maxf(0.25, dist * 0.9)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN and e.pressed:
			dist = minf(8.0, dist * 1.1)
	elif e is InputEventMouseMotion and _drag:
		yaw -= e.relative.x * 0.008
		pitch = clampf(pitch + e.relative.y * 0.006, -0.6, 1.2)


func _process(dt: float) -> void:
	clock += dt
	if who != null:
		who.position.x = sin(clock * 1.6) * 0.7 if walking else 0.0   # side to side at about a walk
		if turning:
			who.rotation.y += dt * 0.6
	var at := aim + Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	cam.look_at_from_position(at, aim)
	key.look_at_from_position(aim + Vector3(-1.2, 1.1, 2.2), aim)
	fill.position = aim + Vector3(1.8, 0.3, 1.4)
	if shot != "":                                    # a picture and out (the guide's and the check's)
		frames += 1
		if frames == 70:
			get_viewport().get_texture().get_image().save_png(shot)
			print("LOOKVIEWER shot ", shot)
			get_tree().quit()
