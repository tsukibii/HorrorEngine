@tool
@icon("res://addons/horrorstudio_weapons/icons/double.svg")
class_name HSDoubleBarrel
extends HSShotgun
## A side-by-side 12-gauge that breaks open: the weapons plugin's v2 (the user's, DECISIONS 2026-11-09: "a v2 double
## barrel shotgun, where only the barrel is visible in frame, unless we reload then it splits in two within frame and
## two shells pop in"). Put it under the player's camera as the pump gun is. Held low so that only its barrels are in
## the view, their muzzles toward its middle. Left click fires a barrel (the right, the front trigger; then the left,
## the rear one). R brings the gun up into the view and breaks it open on its hinge: the top lever over, the barrels
## dropping, the gun in two; the spent hulls flicked out by the ejectors, a live shell left where it is, and a shell
## popping into each empty chamber; then it's snapped shut and goes back down. A click during it stops the loading and
## fires once it's shut. Everything else as the pump gun's (HSShotgun): aim, lower, run, the flashlight under the
## barrels, the holes, the noise, the ears, the pickups; the shells low on the right as two marks and the pocket's count.

signal broke_open                                 ## the barrels dropped: the chambers bare
signal closed                                     ## snapped shut

@export_group("Break")
@export var open_deg := 38.0                      ## how far the barrels drop on the hinge
@export var lever_deg := 30.0                     ## the top lever over to the right
@export var pop_secs := 0.16                      ## a shell from behind the breech into its chamber
@export var open_sound: AudioStream
@export var close_sound: AudioStream
@export var flick_sound: AudioStream

var live := [true, true]                          ## a live shell in the right and the left chamber
var spent := [false, false]                       ## a fired hull still in it
var opened := 0.0                                 ## 0 shut, 1 broken open (a check's)
var flicked := 0                                  ## hulls the ejectors have thrown out (a check's)
var _barrels: Node3D
var _lever: Node3D
var _trigger2: Node3D
var _trig2_0 := Vector3.ZERO
var _barrels0 := Transform3D()
var _lever0 := Transform3D()
var _hinge_axis := Vector3(0, 0, -1)
var _lever_axis := Vector3(0, 1, 0)
var _lever_k := 0.0
var _in_chamber := [null, null]                   # the shell in each chamber (inside the barrels: seen when it's open)


func _init() -> void:
	# held lower than the pump gun: only the barrels in the view, the action and the stock under it
	hold = Vector3(0.10, -0.235, -0.31)
	aim_at_m = 1.3
	aim_hold = Vector3(0.0, -0.07, -0.19)
	capacity = 2
	loaded = 2
	chambered = true
	# the reload's pose: up into the view, near, and turned to show its right side, so broken open it's a V in the
	# frame (the barrels dropping away to the left, the stock down to the right) with the chambers at its point, in the
	# middle of the view a quarter of a metre from the eye
	pose_off = Vector3(-0.07, 0.15, 0.05)
	pose_rot = Vector3(-5.0, 50.0, 30.0)


func _ready() -> void:
	if model == null:
		model = load(DIR + "models/shotgun_double.glb")
	for pair in [["open_sound", "double_open"], ["close_sound", "double_close"], ["flick_sound", "double_flick"]]:
		if get(pair[0]) == null and ResourceLoader.exists(DIR + "sounds/%s.ogg" % pair[1]):
			set(pair[0], load(DIR + "sounds/%s.ogg" % pair[1]))
	super._ready()
	if Engine.is_editor_hint() or _gun == null:
		return
	live = [loaded >= 1, loaded >= 2]
	spent = [false, false]
	for b in 2:
		if live[b]:
			_seat(b, false)
	_count()


# the glb's parts as the pump gun reads them, and the double's own: the barrels on their hinge (the sockets on them
# carried with them: the muzzles, the chambers, the flashlight), the top lever, the rear trigger
func _find_parts() -> void:
	super._find_parts()
	for n in _gun.find_children("*", "", true, false):
		var ex: Dictionary = n.get_meta("extras", {}) if n.has_meta("extras") else {}
		var part = ex.get("propgen_part")
		if part is String:
			part = JSON.parse_string(part)
		if not (part is Dictionary):
			continue
		var ax: Array = part.get("axis", [0, 0, -1])
		var axis := Vector3(float(ax[0]), float(ax[1]), float(ax[2])).normalized()
		match str(part.get("name", "")):
			"barrels":
				_barrels = n as Node3D
				_hinge_axis = axis
				open_deg = float(part.get("open", open_deg)) if open_deg == 38.0 else open_deg
			"lever":
				_lever = n as Node3D
				_lever_axis = axis
			"trigger2":
				_trigger2 = n as Node3D
	if _barrels != null:
		_barrels0 = _barrels.transform
		for nm in ["muzzle", "muzzle_r", "muzzle_l", "chamber_r", "chamber_l", "light"]:
			var s := _sock.get(nm) as Node3D
			if s != null and s.get_parent() != _barrels:
				s.reparent(_barrels, true)
	if _lever != null:
		_lever0 = _lever.transform
	if _trigger2 != null:
		_trig2_0 = _trigger2.rotation


# placed by the barrels shut, whatever they're doing (the muzzle's socket rides on them)
func _place_gun() -> void:
	var was := _barrels.transform if _barrels != null else Transform3D()
	if _barrels != null:
		_barrels.transform = _barrels0
	super._place_gun()
	if _barrels != null:
		_barrels.transform = was


func _count() -> void:
	loaded = int(live[0]) + int(live[1])
	chambered = loaded > 0


## fire a barrel: the right (the front trigger), then the left (the rear); a click when both are spent
func _fire() -> void:
	var b := 0 if live[0] else (1 if live[1] else -1)
	_pull_trigger(1 if b == 1 else 0)
	if b < 0:
		_play(dry_sound, _at("trigger"), -2.0, "foley")
		_show_hud()
		empty.emit()
		return
	live[b] = false
	spent[b] = true
	_seat(b, true)                                   # (the hull in its chamber now spent: seen when it's broken open)
	_count()
	shots += 1
	_fired_t = _t
	busy = true
	_shoot()
	_kick_v += 4.0                                   # (light and short: it kicks harder than the pump gun)
	_show_hud()
	await get_tree().create_timer(0.24).timeout      # (the trigger let go: a double fires as fast as it's pulled)
	busy = false


func _pull_trigger(which: int) -> void:
	var t: Node3D = _trigger2 if which == 1 and _trigger2 != null else _trigger
	if t == null:
		return
	var r0: Vector3 = _trig2_0 if t == _trigger2 else _trig0
	var tw := create_tween()
	tw.tween_property(t, "rotation", r0 + Vector3(0, 0, deg_to_rad(-14.0)), 0.05)
	tw.tween_property(t, "rotation", r0, 0.12)


## the action broken open and shut with nothing to load: the chambers looked into
func rack() -> void:
	await reload()


## R: up into the view, broken open, the spent hulls flicked out, a shell popped into each empty chamber, shut, down
func reload() -> void:
	if _gun == null or _barrels == null or not owned or not raised or busy or _blocked():
		return
	busy = true
	reloading = true
	aiming = false
	_cancel = false
	await _to_pose(1.0, 0.24)
	_play(open_sound, _at("breech"), -3.0, "foley")
	await _turn("_lever_k", 1.0, 0.06, Tween.EASE_OUT)
	await _turn("opened", 1.0, 0.17, Tween.EASE_OUT)
	broke_open.emit()
	var any := false
	for b in 2:                                      # the ejectors throw out what's been fired; a live shell stays
		if spent[b]:
			_flick(b)
			any = true
	if any:
		_play(flick_sound, _at("breech"), -4.0, "foley")
		await get_tree().create_timer(0.2).timeout
	for b in 2:                                      # a shell into each empty chamber, the right first
		if _cancel:
			break
		if not live[b] and spare > 0:
			await _pop_in(b)
			await get_tree().create_timer(0.05).timeout
	await get_tree().create_timer(0.08).timeout
	_play(close_sound, _at("breech"), -2.0, "foley")
	await _turn("opened", 0.0, 0.10, Tween.EASE_IN)
	_kick_v += 2.5
	await _turn("_lever_k", 0.0, 0.05, Tween.EASE_IN)
	closed.emit()
	await _to_pose(0.0, 0.22)
	reloading = false
	busy = false
	_show_hud()
	if _cancel:                                      # a shot asked for while it was open
		_cancel = false
		if owned and raised and not _blocked():
			busy = true
			await _fire()
			busy = false


func _turn(prop: String, to: float, secs: float, ease_: Tween.EaseType) -> void:
	var tw := create_tween()
	tw.tween_property(self, prop, to, secs).set_trans(Tween.TRANS_QUAD).set_ease(ease_)
	await tw.finished


# the shell in a chamber: its base half a millimetre proud of the breech (an extractor's lift), along the bore; a
# child of the barrels, so it's hidden in the barrel while it's shut and seen in the chamber when it's open
func _seat(b: int, as_spent: bool) -> Node3D:
	var old = _in_chamber[b]
	if old != null and is_instance_valid(old):
		old.queue_free()
	var s := (spent_model if as_spent else shell_model).instantiate() as Node3D
	_barrels.add_child(s)
	_view_model(s)
	s.transform = _seated(b)
	_in_chamber[b] = s
	return s


func _seated(b: int) -> Transform3D:
	var sock := _sock.get("chamber_r" if b == 0 else "chamber_l") as Node3D
	var t := sock.transform if sock != null else Transform3D()
	return Transform3D(t.basis, t.origin - t.basis.y.normalized() * 0.0005)


# a spent hull thrown out by its ejector: up and out over the shoulder, then into the room (the pump gun's flight)
func _flick(b: int) -> void:
	var h = _in_chamber[b]
	_in_chamber[b] = null
	spent[b] = false
	if h == null or not is_instance_valid(h):
		return
	(h as Node3D).reparent(_gun, true)
	var side := 1.0 if b == 0 else -1.0             # (the right one out to the right: the gun's +z)
	var v := Vector3(randf_range(-0.9, -0.5), randf_range(2.5, 3.1), side * randf_range(1.0, 1.4))   # (up and out past the face)
	_flying.append([h, v, Vector3(randf_range(-16, 16), 0.0, randf_range(-16, 16)), 0.0, true])
	flicked += 1


# a shell popping in: from behind the breech and a little over it, along the bore into the chamber, quick, seated
func _pop_in(b: int) -> void:
	var s := shell_model.instantiate() as Node3D
	_barrels.add_child(s)
	_view_model(s)
	var seat := _seated(b)
	var bore := seat.basis.y.normalized()
	s.transform = Transform3D(seat.basis, seat.origin - bore * 0.085 + Vector3(0, 0.022, 0))
	var tw := create_tween()
	tw.tween_property(s, "transform", seat, pop_secs).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	await tw.finished
	var old = _in_chamber[b]
	if old != null and is_instance_valid(old):
		old.queue_free()
	_in_chamber[b] = s
	live[b] = true
	spare -= 1
	_count()
	_play(insert_sound, _at("breech"), -3.0, "foley")
	_kick_v += 1.2
	_show_hud()
	shell_in.emit(loaded)


func _process(dt: float) -> void:
	super._process(dt)
	if Engine.is_editor_hint() or _barrels == null:
		return
	_barrels.transform = Transform3D(Basis(_hinge_axis, deg_to_rad(open_deg * opened)) * _barrels0.basis, _barrels0.origin)
	if _lever != null:
		_lever.transform = Transform3D(Basis(_lever_axis, deg_to_rad(lever_deg * _lever_k)) * _lever0.basis, _lever0.origin)


# the shells, low on the right: the right and the left barrel's marks, the pocket's count
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
	var num := str(spare)
	var tw := font.get_string_size(num, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	_hud_ctl.draw_string(font, Vector2(at.x - tw, at.y), num, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(muted, muted.a * k))
	var w := 5.0 * u
	var h := 13.0 * u
	var x := at.x - tw - 14.0 * u - w
	var top := at.y - h + 1.0 * u
	var full := Color(text, text.a * k)
	var empty_c := Color(muted, muted.a * k * 0.7)
	for b in [0, 1]:                                 # (as they lie: the right barrel's mark the right one)
		_mark(Rect2(x, top, w, h), bool(live[b]), full, empty_c, u)
		x -= w + 4.0 * u
