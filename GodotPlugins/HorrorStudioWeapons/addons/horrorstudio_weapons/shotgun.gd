@tool
class_name HSShotgun
extends Node3D
## A pump-action 12-gauge held in first person (the weapons plugin, DECISIONS 2026-11-09). Put it under the player's
## camera. It holds the prop generator's `shotgun_pump` (its pump a part that slides, its bolt's face a part there only
## while the action is shut, its sockets) low on the right, the barrel's line meeting the middle of the view
## `aim_at_m` ahead, as a gun carried at the hip, and no hands on it (the user's, DECISIONS 2026-11-09). It sways
## behind the view as it turns, bobs as you walk, breathes, and never pokes through a wall (its materials' z clip
## scale: drawn in front of the world it's in, lit by it).
##
## Left click fires: nine pellets in a cone of `spread_deg` from the middle of the view, a hole and dust where each
## lands (a thing that moves pushed, one with a shot(info) method told), the flash lighting the room for a moment,
## smoke from the muzzle, the gun kicking and the view with it, the blast through the Sound node (the room's echo), a
## noise every listener hears (`noise`: a run is 1) and your ears ringing (the Fear node's ring). Then the pump is
## racked by itself: back (the bolt open, the spent hull thrown out of the ejection port, onto the floor), forward (a
## shell from the tube into the chamber, if there's one). An empty chamber clicks. R reloads like a shotgun: the gun
## turned to bare its loading port, a shell at a time from the pocket rising nose first into the port and pushed
## forward into the tube, until the tube's full or the pocket's empty (a shot stops it after the shell going in), then
## the pump racked if the chamber was empty. Q raises and lowers it. `light`: the flashlight carried under the barrel
## while it's raised.
signal fired(hits: Array)                         ## after a shot: [{point, normal, collider}], a pellet that hit each
signal racked(spent: bool)                        ## the pump run back and forward
signal shell_in(loaded: int)                      ## a shell pushed into the tube
signal empty                                      ## the trigger pulled on an empty chamber
signal raised_changed(up: bool)

const DIR := "res://addons/horrorstudio_weapons/"

@export var model: PackedScene
@export var shell_model: PackedScene
@export var spent_model: PackedScene
@export var owned := true                         ## carried: a pickup gives it (HSWeaponPickup)
@export var raised := true                        ## up in view (false: lowered out of it)
@export var capacity := 4                         ## the tube's
@export var loaded := 4                           ## in the tube now
@export var chambered := true
@export var spare := 4                            ## shells in the pocket (few: every one counts)
@export var pellets := 9                          ## 00 buckshot
@export var spread_deg := 2.6                     ## the cone's half angle
@export var reach_m := 45.0
@export var push := 0.9                           ## the impulse a pellet gives a thing that moves
@export var noise := 3.0                          ## how loud a shot is to listeners (noise.gd: a step 0.35, a run 1)
@export var ring_secs := 2.5                      ## the ears ringing after a shot (the Fear node's ring; 0 none)
@export var recoil_deg := 3.2                     ## the view kicked up by a shot
@export var recover := 0.6                        ## how much of the kick the view settles back by itself
@export var flash_energy := 5.0                   ## the muzzle flash's light (for a frame or two)
@export var insert_secs := 0.34                   ## a shell from under the gun into the tube
@export var insert_gap := 0.12                    ## between one shell and the next
@export var light: Light3D                        ## a flashlight (the starter's) carried under the barrel while raised
@export var input := true                         ## left click fires, right aims, R reloads, Q raises and lowers
@export var hud := true                           ## the shells, low on the right: the tube's, the chamber's, the pocket's
@export_group("Hold")
@export var hold := Vector3(0.16, -0.13, -0.32)   ## where the chamber sits from the eye (metres: x right, y up, -z ahead)
@export var aim_at_m := 4.0                       ## the barrel's line meets the middle of the view this far ahead
@export var cant_deg := 7.0                       ## the gun leaned in
@export var fov := 0.0                            ## the gun's own lens (0: the camera's)
@export var sway := 1.0
@export var bob := 1.0
@export var fit_tape := true                      ## drawn in to sit in the tape's 4:3 picture when one's on (HSTape)
@export_group("Aim")
@export var aim := true                           ## the right button raises it to the eye, the barrel straight ahead
@export var aim_hold := Vector3(0.0, -0.064, -0.21)   ## where the chamber sits from the eye when aimed (the stock under the view)
@export var aim_zero_m := 8.0                     ## aimed, the bore's line crosses the view's middle this far ahead
@export var aim_fov := 58.0                       ## the camera's lens while aimed (0: as it is)
@export var aim_spread := 0.75                    ## the cone narrowed by aiming
@export_group("Sounds")
@export var fire_sound: AudioStream
@export var back_sound: AudioStream
@export var forward_sound: AudioStream
@export var insert_sound: AudioStream
@export var dry_sound: AudioStream
@export var drop_sound: AudioStream
@export var handle_sound: AudioStream

var busy := false                                 ## racking, reloading or raising (a check's)
var reloading := false
var shots := 0
var ejected := 0                                  ## hulls thrown out (a check's)
var last_hits: Array = []

var _rig: Node3D
var _gun: Node3D
var _pump: Node3D
var _pump0 := Vector3.ZERO
var _travel := Vector3(-0.09, 0, 0)
var _bolt: Node3D
var _trigger: Node3D
var _trig0 := Vector3.ZERO
var _sock := {}
var _flash: MeshInstance3D
var _flash_light: OmniLight3D
var _flash_t := 0.0
var _smoke: CPUParticles3D
var _cancel := false
var _kick := 0.0
var _kick_v := 0.0
var _pose := 0.0                                  # 0 held, 1 turned for the loading port
var _pumping := 0.0                               # 0..1 the pump's way back: the gun rocks with it
var _run := 0.0                                   # 0..1 carried low and turned while running
var _fired_t := -10.0
var _lower := 0.0                                 # 0 raised, 1 lowered out of view
var _last_fwd := Vector3.ZERO
var _sway := Vector2.ZERO
var _sway_v := Vector2.ZERO
var _t := 0.0
var _bob_t := 0.0
var _prev := Vector3.INF
var aiming := false                               ## held to the eye (a check's: set_aim)
var _aim := 0.0                                   # 0 at the hip, 1 at the eye
var _fov0 := 0.0
var _fov_mine := -1.0
var _recover := 0.0                               # radians of kick the view still settles back
var _gun_hip := Transform3D()
var _gun_aim := Transform3D()
var _tape: Node = null
var _tape_on := false
var _hud_ctl: Control
var _hud_c := {}
var _hud_font: Font
var _hud_ui: Node = null                          # the studio's HSHud, if the game has one
var _hud_look := 0.0
var _hud_t := 0.0
var _dust_mesh: Mesh
var _holes: Array = []
var _hulls: Array = []                            # the hulls in the room (the last 16)
var _falling: Array = []                          # those still on their way: {node, v, spin, hits, floor, still}
var _flying: Array = []                           # [node, velocity (gun frame), spin, age]
var _light: Light3D
var _light_rest := Transform3D()
var _hole_tex: Texture2D
var _view_mats := {}


func _ready() -> void:
	if Engine.is_editor_hint():
		_preview()
		return
	add_to_group("hs_weapon")
	model = model if model != null else load(DIR + "models/shotgun_pump.glb")
	shell_model = shell_model if shell_model != null else load(DIR + "models/shell_12ga.glb")
	spent_model = spent_model if spent_model != null else load(DIR + "models/shell_12ga_spent.glb")
	for pair in [["fire_sound", "shotgun_fire"], ["back_sound", "shotgun_pump_back"], ["forward_sound", "shotgun_pump_forward"],
			["insert_sound", "shotgun_shell_insert"], ["dry_sound", "shotgun_dry"], ["drop_sound", "shell_drop"], ["handle_sound", "shotgun_handle"]]:
		if get(pair[0]) == null:
			set(pair[0], load(DIR + "sounds/%s.ogg" % pair[1]))
	if model == null or shell_model == null or spent_model == null:
		push_error("HSShotgun: its models didn't load (%smodels/): the plugin's files are missing" % DIR)
		set_process(false)
		set_physics_process(false)
		return
	_rig = Node3D.new()
	_rig.name = "Rig"
	add_child(_rig)
	_gun = model.instantiate() as Node3D
	_gun.name = "Gun"
	_rig.add_child(_gun)
	_find_parts()
	_tape = _find_tape()
	_tape_on = _tape != null and bool(_tape.get("visible"))
	_place_gun()
	_make_flash()
	_view_model(_rig)
	_hole_tex = _make_hole()
	if hud:
		_make_hud()
	_light = light
	if _light != null:
		_light_rest = _light.transform
	_lower = 0.0 if (owned and raised) else 1.0
	visible = owned
	var cam := get_parent() as Node3D
	if cam != null:
		_last_fwd = -cam.global_basis.z
	if cam is Camera3D:
		_fov0 = (cam as Camera3D).fov


# in the editor: the gun alone where it's held under the camera (never saved: its nodes have no owner), placed again
# as the hold's numbers change in the Inspector
func _preview() -> void:
	var m: PackedScene = model if model != null else load(DIR + "models/shotgun_pump.glb")
	if m == null:
		return
	_rig = Node3D.new()
	add_child(_rig)
	_gun = m.instantiate() as Node3D
	_rig.add_child(_gun)
	_find_parts()
	_place_gun()


# the glb's parts (propgen_part extras) and sockets (socket_<name> empties)
func _find_parts() -> void:
	for n in _gun.find_children("*", "", true, false):
		var nm := str(n.name)
		if nm.begins_with("socket_"):
			_sock[nm.substr(7)] = n
			continue
		var ex: Dictionary = n.get_meta("extras", {}) if n.has_meta("extras") else {}
		var part = ex.get("propgen_part")
		if part is String:
			part = JSON.parse_string(part)                # (the exporter writes it as JSON text)
		if part is Dictionary:
			match str(part.get("name", "")):
				"pump":
					_pump = n as Node3D
					var ax: Array = part.get("axis", [-1, 0, 0])
					_travel = Vector3(float(ax[0]), float(ax[1]), float(ax[2])) * (float(part.get("open", 0.09)) - float(part.get("shut", 0.0)))
				"bolt":
					_bolt = n as Node3D
				"trigger":
					_trigger = n as Node3D
	if _pump != null:
		_pump0 = _pump.position
	if _trigger != null:
		_trig0 = _trigger.rotation


func _sock_at(nm: String) -> Vector3:
	var s := _sock.get(nm) as Node3D
	return _gun.to_local(s.global_position) if s != null else Vector3.ZERO


# the gun turned and moved so its chamber sits at `hold` and its bore's line meets the view's middle `aim_at_m` ahead
# (at the hip), and at `aim_hold` with the bore straight ahead (aimed); `_process` goes between them
func _place_gun() -> void:
	var c := _sock_at("chamber")
	var m := _sock_at("muzzle")
	var a := (m - c).normalized() if (m - c).length() > 0.01 else Vector3(1, 0, 0)
	var gup := (Vector3.UP - a * a.dot(Vector3.UP)).normalized()
	var gb := Basis(a, gup, a.cross(gup))
	var h := _hip()
	_gun_hip = _held(gb, c, h, (Vector3(0, 0, -aim_at_m) - h).normalized(), cant_deg)
	_gun_aim = _held(gb, c, aim_hold, (Vector3(0, 0, -aim_zero_m) - aim_hold).normalized(), 0.0)
	_gun.transform = _gun_hip.interpolate_with(_gun_aim, _aim)


func _held(gb: Basis, c: Vector3, at: Vector3, dir: Vector3, cant: float) -> Transform3D:
	var up := Vector3.UP.rotated(dir, deg_to_rad(-cant))
	up = (up - dir * dir.dot(up)).normalized()
	var r := Basis(dir, up, dir.cross(up)) * gb.inverse()
	return Transform3D(r, at - r * c)


# where the chamber sits at the hip: drawn in toward the middle under a 4:3 tape, so the gun sits in its picture as it
# does in the whole view
func _hip() -> Vector3:
	return Vector3(hold.x * (0.75 if _tape_on and fit_tape else 1.0), hold.y, hold.z)


# the Look plugin's tape (vhs.gd, a CanvasLayer over the game): drawn while it's on, its picture 4:3
func _find_tape() -> Node:
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		var sc := n.get_script() as Script
		if sc != null and sc.resource_path.ends_with("horrorstudio_look/vhs.gd"):
			return n
	return null


func _make_flash() -> void:
	var mz := _sock.get("muzzle") as Node3D
	var at: Node3D = mz if mz != null else _gun
	_flash = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.2, 0.2)
	_flash.mesh = q
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	fm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	fm.albedo_texture = _make_star()
	fm.albedo_color = Color(1.0, 0.78, 0.45)
	fm.cull_mode = BaseMaterial3D.CULL_DISABLED
	_flash.material_override = fm
	_flash.visible = false
	_flash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	at.add_child(_flash)
	_flash.position = Vector3(0, 0.03, 0) if mz != null else Vector3.ZERO
	_flash_light = OmniLight3D.new()
	_flash_light.light_color = Color(1.0, 0.72, 0.42)
	_flash_light.light_energy = 0.0
	_flash_light.omni_range = 9.0
	_flash_light.shadow_enabled = true
	_flash_light.add_to_group("hs_no_zone")           # (a light zone doesn't claim it)
	at.add_child(_flash_light)
	_flash_light.position = Vector3(0, 0.05, 0)
	_smoke = CPUParticles3D.new()
	_smoke.emitting = false
	_smoke.one_shot = true
	_smoke.amount = 10
	_smoke.lifetime = 1.6
	_smoke.explosiveness = 0.85
	_smoke.local_coords = false
	_smoke.direction = Vector3(0, 1, 0)               # the socket's +Y is the barrel's way
	_smoke.spread = 22.0
	_smoke.initial_velocity_min = 0.35
	_smoke.initial_velocity_max = 0.9
	_smoke.damping_min = 0.9
	_smoke.damping_max = 1.4
	_smoke.gravity = Vector3(0, 0.12, 0)
	_smoke.scale_amount_min = 0.06
	_smoke.scale_amount_max = 0.11
	var sc := Curve.new()
	sc.add_point(Vector2(0, 0.4))
	sc.add_point(Vector2(1, 3.2))
	_smoke.scale_amount_curve = sc
	var g := Gradient.new()
	g.set_color(0, Color(0.8, 0.79, 0.77, 0.5))
	g.set_color(1, Color(0.8, 0.79, 0.77, 0.0))
	_smoke.color_ramp = g
	var sq := QuadMesh.new()
	var sm := StandardMaterial3D.new()
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	sm.vertex_color_use_as_albedo = true
	sm.albedo_texture = _make_puff()
	sm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD                # smoke scatters the light that reaches it: it never darkens
	sm.diffuse_mode = BaseMaterial3D.DIFFUSE_LAMBERT_WRAP          # what's behind it (a dark cloud in a dim room otherwise)
	sm.backlight_enabled = true
	sm.backlight = Color(0.7, 0.7, 0.7)
	sm.cull_mode = BaseMaterial3D.CULL_DISABLED
	sq.material = sm
	_smoke.mesh = sq
	at.add_child(_smoke)


# every mesh the gun is drawn with: in front of the world it's in (its depth pulled toward the eye), no shadow of its own
func _view_model(root: Node) -> void:
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		var gi := n as GeometryInstance3D
		gi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if gi.material_override != null:
			gi.material_override = _vm(gi.material_override)
		if gi is MeshInstance3D and (gi as MeshInstance3D).mesh != null:
			var mi := gi as MeshInstance3D
			for i in mi.mesh.get_surface_count():
				var m := mi.get_surface_override_material(i)
				if m == null:
					m = mi.mesh.surface_get_material(i)
				if m != null:
					mi.set_surface_override_material(i, _vm(m))


func _vm(m: Material) -> Material:
	if not (m is BaseMaterial3D):
		return m
	if _view_mats.has(m):
		return _view_mats[m]
	var d := (m as BaseMaterial3D).duplicate() as BaseMaterial3D
	d.use_z_clip_scale = true
	d.z_clip_scale = 0.35
	if fov > 0.0:
		d.use_fov_override = true
		d.fov_override = fov
	_view_mats[m] = d
	_view_mats[d] = d
	return d


func _make_hud() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 5
	add_child(layer)
	_hud_ctl = Control.new()
	_hud_ctl.name = "Shells"
	_hud_ctl.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hud_ctl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_hud_ctl)
	_hud_ctl.draw.connect(_draw_hud)
	var th := "res://addons/horrorstudio_ui/theme.gd"                 # the studio's HUD, when it's there: its colours
	if ResourceLoader.exists(th):
		var T: Script = load(th)
		_hud_c = T.call("colors", str(ProjectSettings.get_setting("horrorstudio/ui/theme", "glass")))
		_hud_font = T.call("tracked", 2.0)
	_show_hud()


func _show_hud() -> void:
	_hud_t = 2.5


# the shells, low on the right: a mark for each place in the tube, one for the chamber after a gap (filled where
# there's a shell), the pocket's count; flat, one stroke, faint at rest and clear for a moment after a change
func _draw_hud() -> void:
	var k := (0.32 + 0.6 * clampf(_hud_t, 0.0, 1.0)) * (1.0 - _lower)
	if k < 0.01:
		return
	var sz := _hud_ctl.size
	var u := clampf(sz.y / 1080.0, 0.5, 3.0)
	var text: Color = _hud_c.get("text", Color(1.0, 0.98, 0.94, 0.93))
	var muted: Color = _hud_c.get("muted", Color(1.0, 0.98, 0.94, 0.58))
	var font: Font = _hud_font if _hud_font != null else ThemeDB.fallback_font
	var fs := int(round(17.0 * u))
	var at := _hud_at(sz, u)
	var right := at.x
	var base := at.y
	var num := str(spare)
	var tw := font.get_string_size(num, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	_hud_ctl.draw_string(font, Vector2(right - tw, base), num, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(muted, muted.a * k))
	var w := 4.0 * u
	var h := 13.0 * u
	var x := right - tw - 14.0 * u - w
	var top := base - h + 1.0 * u
	var full := Color(text, text.a * k)
	var empty := Color(muted, muted.a * k * 0.7)
	_mark(Rect2(x, top, w, h), chambered, full, empty, u)                # the chamber
	x -= 9.0 * u
	for i in capacity:                                                   # the tube, its front shell nearest the chamber
		x -= w + 3.0 * u
		_mark(Rect2(x, top, w, h), i < loaded, full, empty, u)


# where the shells' row ends (its right) and stands (its baseline): low on the right, inside a tape's 4:3 picture,
# above the studio HUD's keys when the game has them
func _hud_at(sz: Vector2, u: float) -> Vector2:
	var fw := minf(sz.x, sz.y * 4.0 / 3.0) if (_tape_on and fit_tape) else sz.x
	var at := Vector2(sz.x * 0.5 + fw * 0.5 - 46.0 * u, sz.y - 42.0 * u)
	var chips := _hud_chips()
	if chips != null and chips.is_visible_in_tree() and chips.modulate.a > 0.02 and chips.get_child_count() > 0:
		at.y = minf(at.y, chips.get_global_rect().position.y - 12.0 * u)
	return at


# the HorrorStudio UI's HSHud, when the game has one: its keys' chips sit at the same corner
func _hud_chips() -> Control:
	if _hud_ui == null or not is_instance_valid(_hud_ui):
		_hud_ui = null
		if _hud_look == 0.0 or _t - _hud_look > (1.0 if _t < 5.0 else 4.0):   # (looked for now and then: a HUD added later)
			_hud_look = maxf(_t, 0.001)
			for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
				if n.get_script() != null and (n.get_script() as Script).get_global_name() == &"HSHud":
					_hud_ui = n
					break
	return _hud_ui.get("hint_el") as Control if _hud_ui != null else null


func _mark(r: Rect2, on: bool, full: Color, empty: Color, u: float) -> void:
	if on:
		_hud_ctl.draw_rect(r, full, true)
	else:
		_hud_ctl.draw_rect(r.grow(-0.5 * u), empty, false, maxf(1.0, u))


func _blocked() -> bool:
	var st := get_tree().get_first_node_in_group("hs_story")
	if st != null and ((st.has_method("card_up") and st.card_up()) or bool(st.get("over"))):
		return true
	var pl := get_tree().get_first_node_in_group("hs_player")
	return pl != null and pl.get("seat") != null


func _unhandled_input(e: InputEvent) -> void:
	if Engine.is_editor_hint() or not input or not owned:
		return
	if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
		if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:     # (the click that takes the mouse back never fires)
			pull()
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_RIGHT:
		set_aim(e.pressed and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED)
	elif e is InputEventKey and e.pressed and not e.echo:
		match e.physical_keycode:
			KEY_R:
				reload()
			KEY_Q:
				set_raised(not raised)


## pull the trigger: a shot if one's chambered (then the pump racked by itself), a click if not; during a reload it
## stops the reload after the shell going in, and the gun fires as soon as it's back up (racked first if it must be)
func pull() -> void:
	if _gun == null or not owned or not raised or _lower > 0.05 or _blocked():
		return
	if reloading:
		_cancel = true
		return
	if busy:
		return
	await _fire()


func _fire() -> void:
	_trigger_pull()
	if not chambered:
		_play(dry_sound, _at("trigger"), -2.0, "foley")
		_show_hud()                                  # (the shells shown: the tube's empty)
		empty.emit()
		return
	chambered = false
	shots += 1
	_fired_t = _t
	_shoot()
	_show_hud()
	busy = true
	await get_tree().create_timer(0.17).timeout
	await _rack(true)
	busy = false


## run the pump by hand: a live shell thrown out if one's chambered, the next one in
func rack() -> void:
	if _gun == null or not owned or not raised or busy or reloading:
		return
	busy = true
	await _rack(chambered)
	busy = false


## R: shells from the pocket into the tube one at a time, through the loading port (a full tube and an empty chamber:
## the pump racked)
func reload() -> void:
	if _gun == null or not owned or not raised or busy or _blocked():
		return
	if loaded >= capacity or spare <= 0:
		_show_hud()                                  # (nothing to load: the shells shown)
		if not chambered and loaded > 0:
			await rack()
		return
	busy = true
	reloading = true
	aiming = false
	_cancel = false
	await _to_pose(1.0, 0.28)
	while not _cancel and loaded < capacity and spare > 0:
		await _insert_one()
		if not _cancel and loaded < capacity and spare > 0:
			await get_tree().create_timer(insert_gap).timeout
	await _to_pose(0.0, 0.24)
	reloading = false
	if not chambered and loaded > 0:
		await _rack(false)
	busy = false
	_show_hud()
	if _cancel:                                      # a shot asked for while reloading
		_cancel = false
		if owned and raised and not _blocked():
			busy = true
			await _fire()
			busy = false


## held to the eye (the right button): the barrel straight ahead, the lens narrower (`aim_fov`), the cone tighter
## (`aim_spread`), the sway and bob less; never while reloading or lowered
func set_aim(on: bool) -> void:
	aiming = on and aim and owned and raised and not reloading and _lower < 0.05


## give it (a pickup), and some shells with it
func give(shells := 0) -> void:
	spare += shells
	if not owned:
		owned = true
		raised = false                               # (lowered out of view until now: drawn up into it)
		set_raised(true)
	_show_hud()


## shells into the pocket (a box picked up)
func add_shells(n: int) -> void:
	spare += max(n, 0)
	_show_hud()


func set_raised(up: bool) -> void:
	if not owned or busy or up == raised:
		return
	raised = up
	if not up:
		aiming = false
	busy = true
	_play(handle_sound, global_position, -6.0, "foley")
	var tw := create_tween()
	tw.tween_property(self, "_lower", 0.0 if up else 1.0, 0.34).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	await tw.finished
	busy = false
	raised_changed.emit(up)


# ---- the shot ----------------------------------------------------------------------------------------------------------

func _shoot() -> void:
	var cam := get_viewport().get_camera_3d()
	var from := cam.global_position if cam != null else global_position
	var fwd := -(cam.global_basis.z if cam != null else global_basis.z)
	var up := cam.global_basis.y if cam != null else Vector3.UP
	var space := get_world_3d().direct_space_state
	var ex: Array = []
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl is CollisionObject3D:
		ex.append((pl as CollisionObject3D).get_rid())
	var hits: Array = []
	var side := fwd.cross(up).normalized()
	var cone := deg_to_rad(spread_deg * lerpf(1.0, aim_spread, _aim))
	for i in pellets:
		var r := cone * sqrt(randf())
		var a := randf() * TAU
		var dir := (fwd + (side * cos(a) + up * sin(a)) * tan(r)).normalized()
		var q := PhysicsRayQueryParameters3D.create(from, from + dir * reach_m, 1)
		q.exclude = ex
		var hit := space.intersect_ray(q)
		if hit.is_empty():
			continue
		var h := {"point": hit["position"], "normal": hit["normal"], "collider": hit["collider"], "pellet": i}
		hits.append(h)
		_hole(hit["position"], hit["normal"], hit["collider"])
		var c: Object = hit["collider"]
		if c is RigidBody3D:
			(c as RigidBody3D).apply_impulse(dir * push, (hit["position"] as Vector3) - (c as RigidBody3D).global_position)
		var n := c as Node
		while n != null:
			if n.has_method("shot"):
				n.shot({"point": hit["position"], "normal": hit["normal"], "dir": dir, "from": from, "pellet": i})
				break
			n = n.get_parent()
	if hits.size() > 0:
		_dust(hits)
	last_hits = hits
	# the flash, the smoke, the kick
	_flash.visible = true
	_flash.rotation.z = randf() * TAU
	_flash.scale = Vector3.ONE * randf_range(0.8, 1.25)
	_flash_t = 0.06
	_flash_light.light_energy = flash_energy
	_smoke.restart()
	_kick_v += 16.0
	_turn_view(deg_to_rad(recoil_deg), deg_to_rad(randf_range(-0.12, 0.12) * recoil_deg))   # up, and a little aside
	_recover += deg_to_rad(recoil_deg) * recover
	_play(fire_sound, _at("muzzle"), 0.0, "event")
	get_tree().call_group("hs_listener", "heard", from, noise)    # (noise.gd's way: every listener hears it)
	var fear := get_tree().get_first_node_in_group("hs_fear")
	if fear != null and ring_secs > 0.0 and fear.has_method("ring"):
		fear.ring(ring_secs)
	fired.emit(hits)


# the view turned by the kick: the starter's player keeps its pitch (and turns its body for the yaw); a bare camera
# is turned itself
func _turn_view(dp: float, dy: float) -> void:
	var cam := get_viewport().get_camera_3d()
	var pl := get_tree().get_first_node_in_group("hs_player")
	if pl != null and "pitch" in pl:
		var p := clampf(float(pl.get("pitch")) + dp, -1.4, 1.4)
		pl.set("pitch", p)
		if cam != null and cam.get_parent() == pl:
			cam.rotation.x = p
		if dy != 0.0 and pl is Node3D:
			(pl as Node3D).rotate_y(dy)
	elif cam != null:
		cam.rotation.x += dp
		cam.rotation.y += dy


# a hole where a pellet landed, on what it hit (a door swings with its holes, a crate carries them away)
func _hole(p: Vector3, n: Vector3, on: Object = null) -> void:
	var d := Decal.new()
	d.texture_albedo = _hole_tex
	d.size = Vector3(0.026, 0.05, 0.026)
	d.cull_mask = 1
	var host: Node = on as Node3D if on is Node3D and not (on as Node).is_queued_for_deletion() else _host()
	host.add_child(d)
	var y := n.normalized()
	var x := y.cross(Vector3.UP if absf(y.y) < 0.9 else Vector3.RIGHT).normalized()
	d.global_transform = Transform3D(Basis(x, y, x.cross(y)).rotated(y, randf() * TAU), p + y * 0.005)
	_holes.append(d)
	while _holes.size() > 180:
		var o = _holes.pop_front()
		if is_instance_valid(o):
			o.queue_free()


func _dust(hits: Array) -> void:
	var host := _host()
	for h in hits.slice(0, 6):
		var p := CPUParticles3D.new()
		p.one_shot = true
		p.amount = 6
		p.lifetime = 0.7
		p.explosiveness = 1.0
		p.local_coords = false
		p.direction = Vector3(0, 1, 0)
		p.spread = 40.0
		p.initial_velocity_min = 0.4
		p.initial_velocity_max = 1.4
		p.gravity = Vector3(0, -2.5, 0)
		p.scale_amount_min = 0.01
		p.scale_amount_max = 0.025
		if _dust_mesh == null:
			var bm := BoxMesh.new()
			bm.size = Vector3.ONE
			var mm := StandardMaterial3D.new()
			mm.vertex_color_use_as_albedo = true
			mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			bm.material = mm
			_dust_mesh = bm
		var g := Gradient.new()
		g.set_color(0, Color(0.55, 0.52, 0.48, 0.7))
		g.set_color(1, Color(0.55, 0.52, 0.48, 0.0))
		p.color_ramp = g
		p.mesh = _dust_mesh
		host.add_child(p)
		var nrm := (h["normal"] as Vector3).normalized()
		p.global_position = h["point"] + nrm * 0.01
		p.global_basis = Basis(nrm.cross(Vector3.FORWARD if absf(nrm.z) < 0.9 else Vector3.RIGHT).normalized(), nrm,
			nrm.cross(Vector3.FORWARD if absf(nrm.z) < 0.9 else Vector3.RIGHT).normalized().cross(nrm)).orthonormalized()
		p.emitting = true
		get_tree().create_timer(1.2).timeout.connect(p.queue_free)


# ---- the action ---------------------------------------------------------------------------------------------------------

func _rack(spent: bool) -> void:
	if _pump == null:
		return
	_play(back_sound, _at("eject"), -3.0, "foley")
	var tw := create_tween()
	tw.tween_property(_pump, "position", _pump0 + _travel, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(self, "_pumping", 1.0, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	await tw.finished
	if _bolt != null:
		_bolt.visible = false                        # the action open: the port dark
	if spent or chambered:
		_eject(spent)
		chambered = false
	await get_tree().create_timer(0.05).timeout
	_play(forward_sound, _at("eject"), -2.0, "foley")
	var tw2 := create_tween()
	tw2.tween_property(_pump, "position", _pump0, 0.14).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw2.parallel().tween_property(self, "_pumping", 0.0, 0.14).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	await tw2.finished
	if _bolt != null:
		_bolt.visible = true
	if loaded > 0:
		loaded -= 1
		chambered = true
	_kick_v += 3.0
	_show_hud()
	racked.emit(spent)


# a hull out of the ejection port: drawn as the gun is for a moment, then a body falling to the floor
func _eject(spent: bool) -> void:
	var s := _sock.get("eject") as Node3D
	if s == null:
		return
	var hull := (spent_model if spent else shell_model).instantiate() as Node3D
	_gun.add_child(hull)
	hull.position = _gun.to_local(s.global_position)
	hull.basis = Basis(Vector3(0, 0, 1), deg_to_rad(90.0)) * Basis(Vector3(1, 0, 0), deg_to_rad(randf_range(-15, 15)))
	_view_model(hull)
	var v := Vector3(randf_range(-0.4, -0.1), randf_range(1.2, 1.8), randf_range(1.9, 2.6))   # gun frame: up, out to the right
	_flying.append([hull, v, Vector3(randf_range(-14, 14), randf_range(-6, 6), randf_range(10, 18)), 0.0, spent])
	ejected += 1


func _fly(dt: float) -> void:
	for f in _flying.duplicate():
		var hull: Node3D = f[0]
		if not is_instance_valid(hull):
			_flying.erase(f)
			continue
		var v: Vector3 = f[1]
		var g := _gun.global_basis.inverse() * Vector3(0, -9.8, 0)
		v += g * dt
		f[1] = v
		hull.position += v * dt
		hull.rotate_object_local(Vector3(1, 0, 0), (f[2] as Vector3).x * dt)
		hull.rotate_object_local(Vector3(0, 0, 1), (f[2] as Vector3).z * dt)
		f[3] = float(f[3]) + dt
		if float(f[3]) > 0.22:
			_flying.erase(f)
			_drop(hull, _gun.global_basis * v, f[4])


# the hull in the room: falling, bouncing off what it meets, rolling along the floor on its side and lying still (by
# rays of its own: a body this small sinks through a level's thin floor in a physics engine's slop)
func _drop(hull: Node3D, vel: Vector3, spent: bool) -> void:
	var at := hull.global_transform
	hull.queue_free()
	var m := (spent_model if spent else shell_model).instantiate() as Node3D
	_host().add_child(m)
	m.global_transform = at
	for gi in m.find_children("*", "GeometryInstance3D", true, false):
		(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var spin := Vector3(randf_range(-14, 14), randf_range(-6, 6), randf_range(-14, 14))
	_falling.append({"node": m, "v": vel, "spin": spin, "hits": 0, "floor": false, "still": 0.0})
	_hulls.append(m)
	while _hulls.size() > 16:
		var o = _hulls.pop_front()
		if is_instance_valid(o):
			o.queue_free()


const HULL_R := 0.0112                            # a hull's rim: what it lies on


func _physics_process(dt: float) -> void:
	if Engine.is_editor_hint() or _falling.is_empty():
		return
	var space := get_world_3d().direct_space_state
	var pl := get_tree().get_first_node_in_group("hs_player")
	var ex: Array = [(pl as CollisionObject3D).get_rid()] if pl is CollisionObject3D else []
	for f in _falling.duplicate():
		var h := f["node"] as Node3D
		if not is_instance_valid(h):
			_falling.erase(f)
			continue
		var v: Vector3 = f["v"]
		var mid := h.global_transform * Vector3(0, 0.033, 0)        # the hull's middle (its origin is its base)
		if not f["floor"]:
			v += Vector3(0, -9.8, 0) * dt
			var step := v * dt
			var q := PhysicsRayQueryParameters3D.create(mid, mid + step + step.normalized() * HULL_R, 1)
			q.exclude = ex
			var hit := space.intersect_ray(q)
			if hit.is_empty():
				h.global_position += step
				var sp: Vector3 = f["spin"]
				h.rotate_object_local(Vector3(1, 0, 0), sp.x * dt)
				h.rotate_object_local(Vector3(0, 1, 0), sp.y * dt)
				h.rotate_object_local(Vector3(0, 0, 1), sp.z * dt)
			else:
				var n: Vector3 = hit["normal"]
				var vn := v.dot(n)
				var vt := v - n * vn
				h.global_position += (hit["position"] as Vector3) + n * HULL_R - mid
				if f["hits"] < 3 and absf(vn) > 0.6:
					_play(drop_sound, h.global_position, -6.0 - 5.0 * f["hits"], "sfx")
				f["hits"] = int(f["hits"]) + 1
				v = vt * 0.7 - n * vn * 0.32                           # it bounces a third back, the rest slides on
				f["spin"] = (f["spin"] as Vector3) * 0.4
				if n.y > 0.7 and absf(vn) < 1.2:                        # on a floor, down for good: lying on its side
					f["floor"] = true
					var ax := (h.global_basis.y - n * h.global_basis.y.dot(n))
					ax = ax.normalized() if ax.length() > 0.05 else n.cross(Vector3(1, 0, 0)).normalized()
					h.global_basis = Basis(ax.cross(n).normalized(), ax, n)     # its axis flat, its side down
					var base := (hit["position"] as Vector3) + n * HULL_R
					h.global_position = base - ax * 0.033
					f["n"] = n
					v = vt * 0.6
		else:
			# rolling along the floor across its axis, sliding a little along it, till it lies still
			var n: Vector3 = f["n"]
			var ax := h.global_basis.y
			v -= n * v.dot(n)
			var across := v - ax * v.dot(ax)
			var along := ax * v.dot(ax)
			h.global_position += v * dt
			if across.length() > 0.001:
				h.rotate(ax, across.length() / HULL_R * dt * signf(n.cross(across).dot(ax)))
			across = across.move_toward(Vector3.ZERO, 1.6 * dt)                     # rolling stops slowly
			along = along.move_toward(Vector3.ZERO, 5.0 * dt)                       # sliding along its length quickly
			v = across + along
			# off an edge (a step, the stairwell): falling again
			var q2 := PhysicsRayQueryParameters3D.create(mid, mid - n * (HULL_R + 0.03), 1)
			q2.exclude = ex
			if space.intersect_ray(q2).is_empty():
				f["floor"] = false
			if v.length() < 0.01:
				f["still"] = float(f["still"]) + dt
				if float(f["still"]) > 0.1:
					_falling.erase(f)
		f["v"] = v


func _trigger_pull() -> void:
	if _trigger == null:
		return
	var tw := create_tween()
	tw.tween_property(_trigger, "rotation", _trig0 + Vector3(0, 0, deg_to_rad(-14.0)), 0.05)
	tw.tween_property(_trigger, "rotation", _trig0, 0.12)


# ---- the reload -------------------------------------------------------------------------------------------------------

func _to_pose(k: float, secs: float) -> void:
	var tw := create_tween()
	tw.tween_property(self, "_pose", k, secs).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	await tw.finished


# one shell, no hands: up from under the gun with its nose raised into the loading port, levelled on the tube's line,
# then pushed forward into the tube until its rim's past the latch (the click)
func _insert_one() -> void:
	var port := _sock_at("port")
	var shell := shell_model.instantiate() as Node3D
	_gun.add_child(shell)
	_view_model(shell)
	var level := Basis(Vector3(0, 0, -1), deg_to_rad(90.0))          # the shell's +Y (its crimp) toward the muzzle
	var tilt := Basis(Vector3(0, 0, 1), deg_to_rad(30.0)) * level     # its nose up toward the port
	var tube := _pump0.y - port.y if _pump != null else 0.0135        # the tube's axis over the port's face
	var s_from := Transform3D(tilt, port + Vector3(-0.075, -0.15, 0.025))
	var s_tip := Transform3D(tilt, port + Vector3(-0.052, -0.030, 0.0))          # its nose just in the port
	var s_up := Transform3D(level, port + Vector3(-0.030, tube, 0.0))            # in the port on the tube's line
	var s_in := Transform3D(level, port + Vector3(0.046, tube, 0.0))             # its base past the tube's mouth
	shell.transform = s_from
	var tw := create_tween()
	tw.tween_property(shell, "transform", s_tip, insert_secs * 0.5).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(shell, "transform", s_up, insert_secs * 0.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(shell, "transform", s_in, insert_secs * 0.3).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	await tw.finished
	_play(insert_sound, _at("port"), -4.0, "foley")
	shell.queue_free()
	loaded += 1
	spare -= 1
	_kick_v += 1.5
	_show_hud()
	shell_in.emit(loaded)


# ---- each frame -------------------------------------------------------------------------------------------------------

func _process(dt: float) -> void:
	if Engine.is_editor_hint():
		_t += dt
		if _gun != null and fmod(_t, 0.25) < dt:
			_place_gun()                              # (the Inspector's hold, aim, cant: seen as they change)
		return
	_t += dt
	var cam := get_parent() as Node3D
	if aiming and (reloading or not raised or not owned or _lower > 0.05):
		aiming = false
	_aim = move_toward(_aim, 1.0 if aiming else 0.0, dt / 0.2)
	var ak := _aim * _aim * (3.0 - 2.0 * _aim)
	if _tape == null and _t < 3.0 and fmod(_t, 0.5) < dt:   # (a tape made after the gun: looked for a few times)
		_tape = _find_tape()
	var t_on := _tape != null and is_instance_valid(_tape) and bool(_tape.get("visible"))
	if t_on != _tape_on:
		_tape_on = t_on
		_place_gun()
	_gun.transform = _gun_hip.interpolate_with(_gun_aim, ak)
	if _recover > 0.0:                                # the view settling back after the kick
		var back := _recover * (1.0 - exp(-dt / 0.16)) if _recover > 0.0002 else _recover
		_recover -= back
		_turn_view(-back, 0.0)
	if aim_fov > 0.0 and cam is Camera3D:             # the lens: narrower while aimed, the game's own otherwise
		var c3 := cam as Camera3D
		if ak <= 0.0:
			if _fov_mine >= 0.0 and absf(c3.fov - _fov_mine) < 0.001:
				c3.fov = _fov0
			_fov_mine = -1.0
			_fov0 = c3.fov
		else:
			c3.fov = lerpf(_fov0, aim_fov, ak)
			_fov_mine = c3.fov
	# sway: the gun lags behind the view as it turns, on a spring
	if cam != null:
		var fwd := -cam.global_basis.z
		if _last_fwd != Vector3.ZERO:
			var v := cam.global_basis.inverse() * _last_fwd
			_sway_v += Vector2(v.x, v.y) * 45.0 * sway * (1.0 - 0.6 * _aim)
		_last_fwd = fwd
	_sway_v += (-_sway * 160.0 - _sway_v * 18.0) * dt
	_sway += _sway_v * dt
	_sway = _sway.clamp(Vector2(-0.25, -0.25), Vector2(0.25, 0.25))
	# bob: from how fast the eye moves over the ground
	var spd := 0.0
	if cam != null:
		var p := cam.global_position
		if _prev != Vector3.INF and dt > 0.0:
			spd = minf(Vector2(p.x - _prev.x, p.z - _prev.z).length() / dt, 6.0)
		_prev = p
	var amp := clampf(spd / 3.2, 0.0, 1.0) * bob * (1.0 - 0.75 * ak)
	# running (the starter's 3.2 m/s; walking is 1.6): carried low and turned in, up again to aim, shoot or reload
	var want_run := clampf((spd - 2.2) / 0.8, 0.0, 1.0) if not (aiming or busy or reloading) and _t - _fired_t > 0.5 else 0.0
	_run = move_toward(_run, want_run, dt * (2.5 if want_run > _run else 5.0))
	var rk := _run * _run * (3.0 - 2.0 * _run)
	_bob_t += dt * (2.0 + spd * 2.3)
	# the recoil's spring
	_kick_v += (-_kick * 120.0 - _kick_v * 16.0) * dt
	_kick += _kick_v * dt
	var off := Vector3(sin(_bob_t) * 0.007 * amp, -absf(cos(_bob_t)) * 0.009 * amp + sin(_t * 1.7) * 0.0012, 0.0)
	off += Vector3(0.0, 0.0, 0.05 * _kick + 0.012 * _pumping)
	off += Vector3(-0.07, 0.035, 0.035) * _pose
	off += Vector3(0.02, -0.26, 0.06) * _lower
	off += Vector3(-0.02, -0.035, 0.03) * rk
	var rx := deg_to_rad(9.0) * _kick + deg_to_rad(2.2) * _pumping - deg_to_rad(16.0) * rk + deg_to_rad(10.0) * _pose - deg_to_rad(38.0) * _lower + _sway.y * 0.5 + sin(_t * 1.7) * 0.003
	var ry := _sway.x * 0.6 + deg_to_rad(8.0) * _pose + deg_to_rad(7.0) * rk
	var rz := deg_to_rad(-48.0) * _pose + deg_to_rad(1.4) * _pumping + deg_to_rad(9.0) * rk + _sway.x * 0.3 + sin(_bob_t) * 0.01 * amp
	var pivot := _hip().lerp(aim_hold, ak)
	var r := Basis.from_euler(Vector3(rx, ry, rz))
	_rig.transform = Transform3D(Basis(), pivot + off) * Transform3D(r, Vector3.ZERO) * Transform3D(Basis(), -pivot)
	visible = owned and _lower < 0.999
	# the flash: out after a frame or two, the light falling off
	if _flash_t > 0.0:
		_flash_t -= dt
		if _flash_t <= 0.0:
			_flash.visible = false
	_flash_light.light_energy = maxf(0.0, _flash_light.light_energy - dt * 110.0)
	if _flying.size() > 0:
		_fly(dt)
	_carry_light(cam)
	if _hud_ctl != null:
		_hud_t = maxf(0.0, _hud_t - dt)
		_hud_ctl.queue_redraw()


# the flashlight under the barrel while it's raised, its beam along the bore; back on the eye when it's lowered
func _carry_light(cam: Node3D) -> void:
	if _light == null or cam == null or _light.get_parent() != cam:
		return
	var s := _sock.get("light") as Node3D
	if s == null:
		return
	var k := 1.0 - _lower
	var g := cam.global_transform.affine_inverse() * s.global_transform
	var fwd := g.basis.y.normalized()                  # a socket's arrow is its +Y
	var b := Basis.looking_at(fwd, Vector3.UP)
	var want := Transform3D(b, g.origin)
	var xf := _light_rest.interpolate_with(want, k)
	_light.position = xf.origin
	_light.rotation = xf.basis.get_euler()
	if "_rot0" in _light:
		_light.set("_rot0", _light.rotation)          # (flashlight.gd shakes the beam round it)


# ---- small things -----------------------------------------------------------------------------------------------------

## play a sound as the gun plays its own (through the starter's Sound node when there is one): a pickup's
func sound(st: AudioStream, at: Vector3, db := 0.0, kind := "foley") -> void:
	_play(st, at, db, kind)


func _at(sock: String) -> Vector3:
	var s := _sock.get(sock) as Node3D
	return s.global_position if s != null else global_position


func _host() -> Node:
	var cs := get_tree().current_scene
	if cs != null:
		return cs
	var n: Node = self
	while n.get_parent() != null and n.get_parent() != get_tree().root:
		n = n.get_parent()
	return n


func _play(st: AudioStream, at: Vector3, db: float, kind: String) -> void:
	if st == null:
		return
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null and snd.has_method("play"):
		snd.play(st, at, db, kind)                     # the starter's Sound node: traced through the rooms, its reverb
		return
	var p := AudioStreamPlayer3D.new()
	p.stream = st
	p.volume_db = db
	_host().add_child(p)
	p.global_position = at
	p.play()
	p.finished.connect(p.queue_free)


func _make_star() -> Texture2D:
	var n := 128
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var rays: Array = []
	for i in 7:
		rays.append([rng.randf() * TAU, rng.randf_range(0.55, 1.0), rng.randf_range(0.05, 0.12)])
	for y in n:
		for x in n:
			var u := (x + 0.5) / n * 2.0 - 1.0
			var v := (y + 0.5) / n * 2.0 - 1.0
			var r := sqrt(u * u + v * v)
			var a := atan2(v, u)
			var c := exp(-r * r * 22.0) * 1.2
			for ray in rays:
				var da := absf(wrapf(a - float(ray[0]), -PI, PI))
				c += exp(-da * da / (float(ray[2]) * float(ray[2]))) * clampf(1.0 - r / float(ray[1]), 0.0, 1.0) * 0.7
			c = clampf(c, 0.0, 1.0)
			img.set_pixel(x, y, Color(1.0, 0.85 + 0.15 * c, 0.6 + 0.4 * c, c))
	return ImageTexture.create_from_image(img)


func _make_puff() -> Texture2D:
	var n := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var noise_t := FastNoiseLite.new()
	noise_t.seed = 3
	noise_t.frequency = 0.08
	for y in n:
		for x in n:
			var u := (x + 0.5) / n * 2.0 - 1.0
			var v := (y + 0.5) / n * 2.0 - 1.0
			var r := sqrt(u * u + v * v)
			var a := clampf(1.0 - r, 0.0, 1.0)
			a = a * a * (0.65 + 0.35 * noise_t.get_noise_2d(x, y))
			img.set_pixel(x, y, Color(1, 1, 1, clampf(a, 0.0, 1.0)))
	return ImageTexture.create_from_image(img)


func _make_hole() -> Texture2D:
	var n := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var noise_t := FastNoiseLite.new()
	noise_t.seed = 5
	noise_t.frequency = 0.2
	for y in n:
		for x in n:
			var u := (x + 0.5) / n * 2.0 - 1.0
			var v := (y + 0.5) / n * 2.0 - 1.0
			var r := sqrt(u * u + v * v) + 0.12 * noise_t.get_noise_2d(x, y)
			var hole := clampf((0.32 - r) / 0.06, 0.0, 1.0)            # the hole, black
			var ring := clampf(1.0 - absf(r - 0.42) / 0.16, 0.0, 1.0) * 0.6   # the chipped edge round it, lighter
			var a := maxf(hole, ring * 0.7)
			var c := Color(0.02, 0.02, 0.02).lerp(Color(0.55, 0.52, 0.48), ring * (1.0 - hole))
			c.a = a
			img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)
