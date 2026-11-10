@tool
@icon("res://addons/horrorstudio_devices/icons/laptop.svg")
class_name HSLaptop
extends Node3D
## A laptop to sit at (HorrorStudio Devices; the user, 2026-11-10: "when a player interacts with it the camera zooms in
## on the screen and a usable ui appears"). E on it (the starter's player calls use() on what it looks at): its lid
## opens if it's shut, the view goes in to its screen, the mouse is its pointer and its terminal (HSTerminal, a green
## terminal of tabs in a SubViewport on the glass) answers. Its ORDER tab sells what `catalog` holds (HSShopCatalog:
## HSShopItems, each with its own model) for the player's cash; what's ordered goes into the pocket (the starter's Story
## node: `cash`, `give`) and shows in the HUD's inventory row as its own model. Esc, E or LOG OFF and the view comes
## back. While nobody's at it its screen rains code, drawn only when you're near and it's in view.
## What it sells: the catalog's things whose `for_sale` is on (only `sells` when it lists ids); a thing whose `needs`
## don't hold yet is a ? (the starter Story's words: a task done, a fact set; or `unlock(id)`), shown NEW once it opens
## up. Delivery (DECISIONS 2026-11-10, last): with `deliver_to` set, what's bought comes in a parcel (HSPackage,
## delivery/package.tscn) left on that spot after `delivery_secs`, while the player isn't looking, a knock and the box set
## down; E on it unboxes it into the pocket.
## The prefab is laptop/laptop.tscn (the user's laptop and mouse, made by the prop generator): drag it onto a desk.

signal opened                                       ## the view went in to its screen
signal closed                                       ## back to the room
signal ordered(item: HSShopItem, count: int, total: float)   ## an order paid (into the pocket, or on its way): count things for total
signal delivered(package: HSPackage)                ## a parcel left on `deliver_to`

const SCREEN := preload("res://addons/horrorstudio_devices/laptop/screen.gdshader")
const CATALOG := "res://addons/horrorstudio_devices/shop/catalog.tres"
const SOUNDS := "res://addons/horrorstudio_devices/sounds/"
const PACKAGE := "res://addons/horrorstudio_devices/delivery/package.tscn"

@export var catalog: HSShopCatalog                  ## what it sells (the plugin's own, shop/catalog.tres, when empty)
@export var sells: PackedStringArray = []           ## only these ids of the catalog's (empty: all its things for sale)
@export_range(1, 12) var page_size := 6             ## things a page of the Order tab shows (three a row)
@export var cash := 40.0                            ## the player's cash when the scene has no Story node (story.gd keeps `cash`)
@export var user := "guest"                         ## who it greets
@export var system_name := "VESPER//OS"
@export_multiline var home_text := "WELCOME, {user}.\n\n{store}: ORDERS TAKEN AT ANY HOUR,\nDELIVERED STRAIGHT TO YOUR POCKET.\n\nCASH ON ACCOUNT ..... {cash}\nLAST LOGIN 03:12 FROM THIS DEVICE"
@export var clock := ""                             ## a time it always shows ("03:13"); the real time when empty
@export var lid_open := true:                       ## shut, E opens it before the view goes in
	set(v):
		lid_open = v
		if is_inside_tree():
			_set_lid(1.0 if v else 0.0)
@export_group("Delivery")
@export var deliver_to: NodePath                    ## where what's bought is left in a parcel (a Marker3D, any Node3D: the box's bottom on it, facing its -Z); none: straight into the pocket
@export var deliver_place := ""                     ## what the terminal calls that place ("THE FRONT DOOR"); THE DOOR when empty
@export_range(0.0, 3600.0, 0.5, "suffix:s") var delivery_secs := 0.0   ## how long it takes to come
@export var when_unseen := true                     ## left only while the player can't see the place (no box appearing in view)
@export var knock := true                           ## a knock where it's left, then the box set down
@export var package: PackedScene                    ## the box it comes in (delivery/package.tscn when empty)
@export var mark_parcels := true                    ## a quest marker over each parcel left till it's opened (the UI plugin's HSQuestMarker: an HSHud in the scene draws it)
@export_group("The view")
@export_range(0.2, 3.0) var zoom_secs := 0.8
@export_range(15.0, 90.0) var zoom_fov := 40.0      ## the lens while you're at it: narrow, so the screen's flat
@export_range(0.5, 1.2) var fill := 0.92            ## how much of the view the screen fills
@export var system_pointer := false                 ## the system's pointer instead of the terminal's own
@export_group("The screen")
@export var look: HSTerminalLook                    ## its colours, font, rain and glass
@export_range(256, 2048) var screen_px := 1024      ## its picture's width (its height by the screen's shape)
@export_range(0.0, 4.0) var brightness := 1.7
@export_range(0.0, 50.0) var wake_m := 7.0          ## nearer than this (and in view) its screen keeps drawing
@export_group("Sound")
@export var sounds := true
@export_range(-40.0, 6.0) var volume_db := -8.0

var using := false                                  ## someone's at it (the view in, or going in or out)
var term: HSTerminal                                ## its screen's terminal
var screen: SubViewport                             ## its screen's picture
var sold := {}                                      ## id -> how many this laptop has sold
var orders := 0                                     ## orders placed on it
var last_order := {}                                ## {number, id, count, total, where}
var deliveries: Array = []                          ## on their way: {number, items, counts, due}
var unlocked_ids := {}                              ## ids unlock() opened up, whatever their needs say
var seen := {}                                      ## ids whose unlocked card has been seen (no longer NEW)
var idle_draws := 0                                 ## times its screen was drawn while nobody was at it (a check's)
var _model: Node3D
var _lid: Node3D
var _lid_part := {}
var _lid_rest := Basis()
var _lid_k := 1.0                                   # 1 open, 0 shut
var _lid_to := -1.0
var _screen_mi: MeshInstance3D
var _screen_surf := -1
var _mat: ShaderMaterial
var _sock := {}                                     # socket name -> its node
var _player: Node3D
var _eye: Camera3D
var _cam: Camera3D
var _zoom := 0.0                                    # 0 at the eye, 1 at the screen
var _zoom_dir := 0
var _player_mode := Node.PROCESS_MODE_INHERIT
var _story_seen := true
var _idle_acc := 0.0
var _sfx := {}
var _hum: AudioStreamPlayer3D
var _clock := 0.0                                   # seconds it's been running (deliveries come by it)


func _ready() -> void:
	_find()
	_set_lid(1.0 if lid_open else 0.0)
	if Engine.is_editor_hint():
		return
	add_to_group("hs_laptop")
	if look == null:
		look = HSTerminalLook.new()
	if catalog == null and ResourceLoader.exists(CATALOG):
		catalog = load(CATALOG)
	for k in ["screen", "screen_up", "screen_right", "webcam"]:     # the screen's sockets ride the lid
		var s: Node3D = _sock.get(k)
		if s != null and _lid != null and s.get_parent() != _lid:
			s.reparent(_lid, true)
	_make_body()
	_make_screen()
	_make_sounds()


# ---- what it's made of: the model's lid, screen and sockets --------------------------------------------------------------
func _find() -> void:
	_model = get_node_or_null("Model") as Node3D
	if _model == null:
		for c in get_children():
			if c is Node3D and not (c as Node3D).find_children("*", "MeshInstance3D", true, false).is_empty():
				_model = c
				break
	if _model == null:
		return
	for n in _model.find_children("*", "", true, false):
		var nm := str(n.name)
		if nm.begins_with("socket_"):
			_sock[nm.substr(7)] = n
			continue
		if n is MeshInstance3D and (n as MeshInstance3D).mesh != null:
			var me: Mesh = (n as MeshInstance3D).mesh
			for i in me.get_surface_count():
				var mt := me.surface_get_material(i)
				if mt != null and mt.resource_name.ends_with("_screen"):
					_screen_mi = n
					_screen_surf = i
		var ex: Dictionary = n.get_meta("extras", {}) if n.has_meta("extras") else {}
		var part = ex.get("propgen_part")
		if part is String:
			part = JSON.parse_string(part)                # (the exporter writes it as JSON text)
		if part is Dictionary and str(part.get("name", "")) == "lid":
			_lid = n
			_lid_part = part
			# the glb builds a part at its `built` angle unturned (a scene saved with the lid shut has its node turned:
			# never taken as its rest)
			_lid_rest = Basis()


## the lid between shut (0) and open (1), about its hinge as the model's part says
func _set_lid(k: float) -> void:
	_lid_k = clampf(k, 0.0, 1.0)
	if _lid == null:
		return
	var ax: Array = _lid_part.get("axis", [-1.0, 0.0, 0.0])
	var axis := Vector3(float(ax[0]), float(ax[1]), float(ax[2])).normalized()
	var ang := lerpf(float(_lid_part.get("shut", 0.0)), float(_lid_part.get("open", 100.0)), _lid_k) - float(_lid_part.get("built", 0.0))
	_lid.basis = Basis(axis, deg_to_rad(ang)) * _lid_rest
	if _mat != null:
		_mat.set_shader_parameter("power", clampf((_lid_k - 0.55) / 0.45, 0.0, 1.0))


func _make_body() -> void:
	if get_node_or_null("Body") != null:
		return
	var b := StaticBody3D.new()                       # so the player's E finds it (and walks round it)
	b.name = "Body"
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	var bb := HSModelSlot.bounds_of(_model, self) if _model != null else AABB(Vector3(-0.17, 0, -0.11), Vector3(0.34, 0.25, 0.22))
	box.size = bb.size
	cs.shape = box
	cs.position = bb.get_center()
	b.add_child(cs)
	add_child(b)


## its screen's frame now (it rides the lid): its middle, right, up and out of it, and its half sizes, in the world
func frame() -> Dictionary:
	var c: Vector3 = (_sock["screen"] as Node3D).global_position
	var u: Vector3 = (_sock["screen_up"] as Node3D).global_position - c
	var r: Vector3 = (_sock["screen_right"] as Node3D).global_position - c
	var hh := u.length()
	var hw := r.length()
	u /= max(hh, 1e-6)
	r /= max(hw, 1e-6)
	return {"c": c, "r": r, "u": u, "n": r.cross(u).normalized(), "hw": hw, "hh": hh}


func _make_screen() -> void:
	if _screen_mi == null or not _sock.has("screen") or not _sock.has("screen_up") or not _sock.has("screen_right"):
		push_warning("HSLaptop: its model has no surface named *_screen or no screen sockets (the prop generator's laptop has both)")
		return
	var f := frame()
	screen = SubViewport.new()
	screen.name = "Screen"
	screen.size = Vector2i(screen_px, int(round(screen_px * f["hh"] / f["hw"])))
	screen.disable_3d = true
	screen.transparent_bg = false
	screen.gui_embed_subwindows = false
	screen.render_target_update_mode = SubViewport.UPDATE_ONCE
	add_child(screen)
	term = HSTerminal.new()
	term.name = "Terminal"
	term.size = Vector2(screen.size)                  # the whole picture (anchors set in the tree keep a size: LESSONS)
	screen.add_child(term)
	term.setup(self, look)
	term.sleep()
	_mat = ShaderMaterial.new()
	_mat.shader = SCREEN
	_mat.set_shader_parameter("screen_tex", screen.get_texture())
	_mat.set_shader_parameter("px", Vector2(screen.size))
	_mat.set_shader_parameter("uv_to_screen", _uv_map(f))
	_mat.set_shader_parameter("brightness", brightness)
	_mat.set_shader_parameter("scanlines", look.scanlines)
	_mat.set_shader_parameter("glow", look.glow)
	_mat.set_shader_parameter("flicker", look.flicker)
	_mat.set_shader_parameter("power", clampf((_lid_k - 0.55) / 0.45, 0.0, 1.0))
	_screen_mi.set_surface_override_material(_screen_surf, _mat)


## the screen surface's UVs to the picture's (0 0 its top left, 1 1 its bottom right): fitted over its own vertices,
## so the picture's upright however the model's UVs were laid
func _uv_map(f: Dictionary) -> Basis:
	var arr := _screen_mi.mesh.surface_get_arrays(_screen_surf)
	var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var uvs: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV]
	var xf := _screen_mi.global_transform
	var ata := [Vector3.ZERO, Vector3.ZERO, Vector3.ZERO]
	var bs := Vector3.ZERO
	var bt := Vector3.ZERO
	for i in vs.size():
		var d: Vector3 = xf * vs[i] - f["c"]
		var s: float = d.dot(f["r"]) / (2.0 * f["hw"]) + 0.5
		var t: float = 0.5 - d.dot(f["u"]) / (2.0 * f["hh"])
		var a := Vector3(uvs[i].x, uvs[i].y, 1.0)
		ata[0] += a * a.x
		ata[1] += a * a.y
		ata[2] += a * a.z
		bs += a * s
		bt += a * t
	var m := Basis(ata[0], ata[1], ata[2])           # symmetric: its columns are its rows
	if absf(m.determinant()) < 1e-12:
		return Basis()
	var inv := m.inverse()
	var ms := inv * bs
	var mt := inv * bt
	return Basis(Vector3(ms.x, mt.x, 0.0), Vector3(ms.y, mt.y, 0.0), Vector3(ms.z, mt.z, 1.0))


func _make_sounds() -> void:
	for nm in ["blip", "tick", "key", "order", "error", "boot", "wake", "sleep", "hum"]:
		var p: String = SOUNDS + str(nm) + ".ogg"
		if not ResourceLoader.exists(p):
			continue
		var a := AudioStreamPlayer3D.new()
		a.name = "Sound_" + nm
		a.stream = load(p)
		a.volume_db = volume_db - (12.0 if nm == "hum" else 0.0)
		a.unit_size = 1.5
		a.max_distance = 12.0
		add_child(a)
		a.position = (_sock["keys"] as Node3D).position if _sock.has("keys") else Vector3(0, 0.05, 0)
		_sfx[nm] = a
	_hum = _sfx.get("hum")


## one of its sounds (blip, tick, key, order, error, boot, wake, sleep)
func sound(nm: String) -> void:
	if not sounds or not _sfx.has(nm):
		return
	var a: AudioStreamPlayer3D = _sfx[nm]
	a.pitch_scale = randf_range(0.97, 1.03) if nm in ["blip", "tick", "key"] else 1.0
	a.play()


# ---- going in and coming out ---------------------------------------------------------------------------------------------
## E on it: the view goes in to its screen (the starter's player calls this on what it's looking at)
func use(by: Node = null) -> void:
	if Engine.is_editor_hint() or using or term == null:
		return
	var p: Node3D = by as Node3D if by is Node3D else get_tree().get_first_node_in_group("hs_player") as Node3D
	if p != null:
		open_for(p)


## the view in to its screen from `p`'s eye (its Eye camera, else the one in use); p stops while it's at the laptop
func open_for(p: Node3D) -> void:
	if using or term == null:
		return
	var eye := p.get_node_or_null("Eye") as Camera3D
	_eye = eye if eye != null else get_viewport().get_camera_3d()
	if _eye == null:
		return
	using = true
	_player = p
	_player_mode = p.process_mode
	p.process_mode = Node.PROCESS_MODE_DISABLED       # its walking, looking and E wait here
	var st := _story()
	if st != null:
		_story_seen = st.visible
		st.visible = false                             # its corner words away from the screen
	var hud := _hud()
	if hud != null and hud.has_method("modal"):
		hud.modal(true)                                # no reticle over the screen
	_cam = Camera3D.new()
	_cam.name = "View"
	_cam.top_level = true
	add_child(_cam)
	_cam.global_transform = _eye.global_transform
	_cam.fov = _eye.fov
	_cam.near = 0.01
	_cam.far = _eye.far
	_cam.cull_mask = _eye.cull_mask & ~(1 << 19)      # the view models' layer (a gun under the eye) left out
	_cam.environment = _eye.environment
	_cam.attributes = _eye.attributes
	_cam.make_current()
	if _lid_k < 0.999:
		_lid_to = 1.0
		sound("wake")
	_zoom_dir = 1
	term.process_mode = Node.PROCESS_MODE_INHERIT
	screen.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	if _hum != null and sounds:
		_hum.play()
	term.wake()


## back to the room (Esc, E, LOG OFF)
func leave() -> void:
	if not using or _zoom_dir < 0:
		return
	_zoom_dir = -1
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	for id in term.order.shown_ids:                    # what was on the pages it showed isn't new any more
		seen[id] = true
	term.sleep()
	sound("sleep")


func _arrived() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if system_pointer else Input.MOUSE_MODE_HIDDEN
	var mid := get_viewport().get_visible_rect().size * 0.5
	Input.warp_mouse(mid)
	term.pointer(_to_screen(mid))
	opened.emit()


func _gone() -> void:
	if _eye != null and is_instance_valid(_eye):
		_eye.make_current()
	if _cam != null:
		_cam.queue_free()
		_cam = null
	if _player != null and is_instance_valid(_player):
		_player.process_mode = _player_mode
	var st := _story()
	if st != null:
		st.visible = _story_seen
	var hud := _hud()
	if hud != null and hud.has_method("modal"):
		hud.modal(false)
	if _hum != null:
		_hum.stop()
	using = false
	closed.emit()


## where the view sits at the screen: square on to it, the screen `fill` of the view, at the lens `zoom_fov`
func view_transform() -> Transform3D:
	var f := frame()
	var half := deg_to_rad(zoom_fov) * 0.5
	var vs := get_viewport().get_visible_rect().size
	var aspect := vs.x / maxf(vs.y, 1.0)
	var d := maxf(f["hh"] / tan(half), f["hw"] / (tan(half) * aspect)) / fill
	return Transform3D(Basis.looking_at(-f["n"], f["u"]), f["c"] + f["n"] * d)


func _process(dt: float) -> void:
	if Engine.is_editor_hint():
		return
	_clock += dt
	if not deliveries.is_empty():
		_deliver_due()
	if _lid_to >= 0.0:
		_set_lid(move_toward(_lid_k, _lid_to, dt / 0.6))
		if is_equal_approx(_lid_k, _lid_to):
			_lid_to = -1.0
	if _zoom_dir != 0 and _cam != null:
		var go := 0.0 if _lid_to >= 0.0 and _zoom_dir > 0 else dt / zoom_secs   # the lid up first
		_zoom = clampf(_zoom + _zoom_dir * go, 0.0, 1.0)
		var e := _zoom * _zoom * (3.0 - 2.0 * _zoom)
		_cam.global_transform = _eye.global_transform.interpolate_with(view_transform(), e)
		_cam.fov = lerpf(_eye.fov, zoom_fov, e)
		if _zoom >= 1.0 and _zoom_dir > 0:
			_zoom_dir = 0
			_arrived()
		elif _zoom <= 0.0 and _zoom_dir < 0:
			_zoom_dir = 0
			_gone()
	_idle(dt)


# the screen draws while someone's at it; else a dozen times a second while it's near and in view; else not at all
func _idle(dt: float) -> void:
	if screen == null or using:
		return
	var cam := get_viewport().get_camera_3d()
	var at: Vector3 = (_sock["screen"] as Node3D).global_position if _sock.has("screen") else global_position
	var near := cam != null and cam.global_position.distance_to(at) < wake_m
	if _lid_k < 0.5 or not near or not cam.is_position_in_frustum(at):
		screen.render_target_update_mode = SubViewport.UPDATE_DISABLED
		term.process_mode = Node.PROCESS_MODE_DISABLED  # nothing on it moves while it isn't drawn
		return
	term.process_mode = Node.PROCESS_MODE_INHERIT
	_idle_acc += dt
	if _idle_acc >= 1.0 / 12.0:
		_idle_acc = 0.0
		screen.render_target_update_mode = SubViewport.UPDATE_ONCE
		idle_draws += 1


# ---- the mouse and keys on the screen --------------------------------------------------------------------------------------
func _input(ev: InputEvent) -> void:
	if Engine.is_editor_hint() or not using:
		return
	get_viewport().set_input_as_handled()            # nothing else in the room hears it while you're at the screen
	if _zoom_dir != 0:
		return
	if ev is InputEventKey:
		var k := ev as InputEventKey
		if k.pressed and not k.echo and (k.physical_keycode == KEY_ESCAPE or (k.physical_keycode == KEY_E and not term.typing())):
			leave()
			return
		if k.pressed and not k.echo:
			sound("key")
		screen.push_input(ev, true)
	elif ev is InputEventMouse:
		var p := _to_screen((ev as InputEventMouse).position)
		var e2 := ev.duplicate() as InputEventMouse
		e2.position = p
		e2.global_position = p
		screen.push_input(e2, true)
		term.pointer(p)


## a point of the window to the screen's picture's pixels: the view's ray through it onto the glass
func to_screen(window_pos: Vector2) -> Vector2:
	return _to_screen(window_pos)


func _to_screen(mp: Vector2) -> Vector2:
	var cam := _cam if _cam != null else get_viewport().get_camera_3d()
	if cam == null or screen == null:
		return Vector2(-1, -1)
	var f := frame()
	var o := cam.project_ray_origin(mp)
	var dir := cam.project_ray_normal(mp)
	var den: float = dir.dot(f["n"])
	if absf(den) < 1e-6:
		return Vector2(-1, -1)
	var t: float = (f["c"] - o).dot(f["n"]) / den
	var d: Vector3 = o + dir * t - f["c"]
	var s: float = d.dot(f["r"]) / (2.0 * f["hw"]) + 0.5
	var v: float = 0.5 - d.dot(f["u"]) / (2.0 * f["hh"])
	var sz := Vector2(screen.size)
	return Vector2(clampf(s, 0.0, 1.0) * sz.x, clampf(v, 0.0, 1.0) * sz.y)


## a point of the screen's picture (its pixels) back to the window: where to click to press what's there (for checks)
func to_window(screen_pos: Vector2) -> Vector2:
	var cam := _cam if _cam != null else get_viewport().get_camera_3d()
	var f := frame()
	var sz := Vector2(screen.size)
	var p: Vector3 = f["c"] + f["r"] * ((screen_pos.x / sz.x - 0.5) * 2.0 * f["hw"]) - f["u"] * ((screen_pos.y / sz.y - 0.5) * 2.0 * f["hh"])
	return cam.unproject_position(p)


# ---- the shop: what the terminal asks ------------------------------------------------------------------------------------
## what its shop shows: the catalog's things for sale (only `sells`, when it lists any), in its order; a locked one only
## when it's to show as a ?
func items() -> Array:
	var out: Array = []
	if catalog == null:
		return out
	for it: HSShopItem in catalog.all_items():
		if not it.for_sale or (not sells.is_empty() and not sells.has(it.id)):
			continue
		if not it.show_locked and not unlocked(it):
			continue
		out.append(it)
	return out


## whether it can be ordered yet: no `needs`, or the Story holds them (a task done, a fact set...), or unlock() said so
func unlocked(it: HSShopItem) -> bool:
	if it.needs.strip_edges() == "" or unlocked_ids.has(it.id):
		return true
	var st := _story()
	return st != null and st.has_method("holds") and bool(st.holds(it.needs))


## a thing opened up by a script, whatever its needs say (a game without the starter's Story, or a reward)
func unlock(id: String) -> void:
	unlocked_ids[id] = true
	if term != null:
		term.order.refresh()


## unlocked by its needs and not seen since: its card says NEW
func is_new(it: HSShopItem) -> bool:
	return it.needs.strip_edges() != "" and unlocked(it) and not seen.has(it.id)


func store_name() -> String:
	return catalog.store if catalog != null else "STORE"


func currency() -> String:
	return catalog.currency if catalog != null else "$"


func clock_text() -> String:
	return clock if clock != "" else Time.get_time_string_from_system().substr(0, 5)


## how many of it are left here (-1: no end)
func left_of(it: HSShopItem) -> int:
	return -1 if it.stock < 0 else maxi(it.stock - int(sold.get(it.id, 0)), 0)


## the player's cash: the Story's when there's one, else this laptop's own
func cash_now() -> float:
	var st := _story()
	if st != null and "cash" in st:
		return float(st.get("cash"))
	return cash


## an order: n of it (each `count` things), paid from the cash and into the pocket. {ok, number, total, count} or
## {ok: false, why}
func place_order(it: HSShopItem, n: int) -> Dictionary:
	n = clampi(n, 1, it.max_per_order)
	if not unlocked(it):
		sound("error")
		return {"ok": false, "why": "LOCKED."}
	var left := left_of(it)
	if left == 0:
		sound("error")
		return {"ok": false, "why": "SOLD OUT."}
	if left > 0 and n > left:
		sound("error")
		return {"ok": false, "why": "ONLY %d LEFT." % left}
	var total := snappedf(it.price * n, 0.01)
	if not _pay(total):
		sound("error")
		return {"ok": false, "why": "NOT ENOUGH CASH: %s%.2f SHORT." % [currency(), total - cash_now()]}
	sold[it.id] = int(sold.get(it.id, 0)) + n
	orders += 1
	var count := it.count * n
	var number := 1000 + orders
	var where := "pocket"
	if get_node_or_null(deliver_to) is Node3D:         # it comes in a parcel, later
		deliveries.append({"number": number, "items": [it], "counts": [count], "due": _clock + delivery_secs})
		where = place_name()
	else:
		it.give_to(get_tree(), count, _player)
	sound("order")
	term.set_cash(cash_now())
	term.log("ORDER #%04d  %dx %s  %s%.2f%s" % [number, n, it.name_of().to_upper(), currency(), total, "" if where == "pocket" else "  TO " + where])
	last_order = {"number": number, "id": it.id, "count": count, "total": total, "where": where}
	ordered.emit(it, count, total)
	return {"ok": true, "number": number, "total": total, "count": count, "where": where, "eta": delivery_secs if where != "pocket" else 0.0}


## what the terminal calls the place parcels are left
func place_name() -> String:
	return deliver_place.to_upper() if deliver_place != "" else "THE DOOR"


## how long until it comes, as the terminal says it ("NOW", "2 MIN", "40 SEC")
func eta_text(secs: float) -> String:
	if secs < 1.0:
		return "NOW"
	return "%d MIN" % ceili(secs / 60.0) if secs >= 90.0 else "%d SEC" % ceili(secs)


func _pay(total: float) -> bool:
	var st := _story()
	if st != null and st.has_method("pay"):
		return st.pay(total)
	if total > cash + 0.0001:
		return false
	cash = snappedf(cash - total, 0.01)
	return true


# ---- delivery ---------------------------------------------------------------------------------------------------------------
# the parcels whose time has come, left on the spot while the player can't see it
func _deliver_due() -> void:
	var spot := get_node_or_null(deliver_to) as Node3D
	if spot == null:                                  # the spot's gone: straight into the pocket
		for d in deliveries:
			for i in d["items"].size():
				(d["items"][i] as HSShopItem).give_to(get_tree(), int(d["counts"][i]), _player)
		deliveries.clear()
		return
	for d in deliveries.duplicate():
		if _clock < float(d["due"]):
			continue
		if when_unseen and _seen(spot):
			return
		deliveries.erase(d)
		_drop(spot, d)


## whether the player can see the spot now: in the view and nothing solid between
func _seen(spot: Node3D) -> bool:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return false
	var at := spot.global_position + spot.global_basis.y * 0.12
	if not cam.is_position_in_frustum(at):
		return false
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, at)
	var p := get_tree().get_first_node_in_group("hs_player")
	if p is CollisionObject3D:
		q.exclude = [(p as CollisionObject3D).get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit.is_empty() or (hit["position"] as Vector3).distance_to(at) < 0.4


func _drop(spot: Node3D, d: Dictionary) -> void:
	var scene: PackedScene = package if package != null else (load(PACKAGE) as PackedScene)
	if scene == null:
		return
	var pkg := scene.instantiate() as Node3D
	if not pkg is HSPackage:
		pkg.queue_free()
		return
	var k := spot.get_children().filter(func(c: Node) -> bool: return c is HSPackage).size()
	(pkg as HSPackage).items.assign(d["items"])
	(pkg as HSPackage).counts = PackedInt32Array(d["counts"])
	(pkg as HSPackage).order_number = int(d["number"])
	(pkg as HSPackage).marker = mark_parcels
	spot.add_child(pkg)
	var b: AABB = (pkg as HSPackage).box
	var w := b.size.x + 0.05
	var row := [0.0, 1.0, -1.0]
	var x := float(row[k % 3]) * w                    # side by side along the spot's X, then a layer on top
	var y := float(k / 3) * (b.size.y + 0.002)
	pkg.position = Vector3(x, y, 0.0)
	pkg.rotation.y = PI + deg_to_rad(randf_range(-7.0, 7.0))   # its front (+Z) to the spot's -Z
	(pkg as HSPackage).arrive(knock)
	delivered.emit(pkg)


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story") if is_inside_tree() else null


func _hud() -> Node:
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		var sc: Script = n.get_script()
		if sc != null and sc.get_global_name() == &"HSHud":
			return n
	return null
