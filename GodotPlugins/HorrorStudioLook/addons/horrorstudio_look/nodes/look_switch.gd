## A character's looks, switched (docs/GODOT_LOOK.md §5r, DECISIONS 2026-11-12, later: "a tool that lets us toggle
## between the eyes and skin shades (allows us to use default too), we should be able to make events or quests trigger
## different looks"). Drop it under a character (beside her HSCharacterLook). It keeps a list of named looks
## (HSLookPreset: a skin, eyes, their numbers) and turns her from one to another over a moment: the old one fades out,
## the new one fades in; **default** is her own skin and eyes, exactly as they were.
##   - by name, from anything: `set_look("angry")`, `default()`, `next()`, `show({...})` for a look made on the spot;
##   - by the story: a look with `needs` is worn while they hold (the starter Story's words: `task:dinner`,
##     `on:tidy`, `item:key`, a fact, `!` for not); the last one in the list that holds wins, none: her `start` look;
##   - by an event: `fire()` is what the starter kit's areas, cues and scares call on their `target`; `on_fire` says
##     which look it turns to (or `next`, or `default`);
##   - by hand while you play: `panel_key` (F8, debug builds) opens the picker (look_picker.gd) on every switch in the
##     scene: every skin and eye look, their colours and amounts, her named looks, Default, Save as a look.
##     $Freddy/HSLookSwitch.set_look("angry")
##     $Freddy/HSLookSwitch.show({"skin": "cloak", "eyes": "glow", "eye_color": Color.GREEN}, 0.4)
##     $Freddy/HSLookSwitch.default()
## It drives HSCreatureSkin and HSEyeFx (her HSCharacterLook's own Creature skin and Creepy eyes rows are for a
## character with one look: leave them on none under a switch). In the editor it does nothing.
@tool
@icon("res://addons/horrorstudio_look/icons/switch.svg")
class_name HSLookSwitch
extends Node

signal look_changed(name: String)                 ## she's wholly in a look now ("" her default; "custom" one shown on the spot)

@export var target: Node3D = null                 ## the character; empty: the parent
@export var looks: Array[HSLookPreset] = []       ## her looks, by name (drag .tres files in, or make them here)
@export var start: String = ""                    ## the look she starts in (empty: her default)
@export_range(0.0, 10.0) var seconds: float = 0.6 ## how long a turn takes (a look's own Seconds over it)
@export var by_story: bool = true                 ## looks with `needs` come and go with the Story
@export var on_fire: String = "next"              ## what fire() turns her to: a look's name, default, or next (through them in turn)
@export var panel_key: Key = KEY_F8               ## in a debug build this key opens the picker (none: never)

const GROUP := "hs_look_switch"
const SKIN_KEYS := ["skin", "skin_tint", "skin_extend", "shadow"]
const EYE_KEYS := ["eyes", "eye_color", "eye_side"]

var now: String = ""                              # the look she's in or turning to ("" default, "custom")
var _cur: Dictionary = {}                         # what she wears now (a preset's words; the amounts as they are this frame)
var _want: Dictionary = {}
var _phase: String = ""                           # "", "out" (the old fading), "in" (the new coming)
var _secs: float = 0.0
var _skin_goes := false
var _eyes_go := false
var _auto: String = ""                            # the look the story last asked for
var _poll := 0.0
var _begun := false
var _last := Vector3.ZERO
var _had_last := false
var _motion := 0.0
var _in_t := 0.0                                  # the new look coming in: how far (0..1), and what it started from
var _in_from := [0.0, 0.0]


func character() -> Node3D:
	return target if target != null else get_parent() as Node3D


## the switch under a node, or null
static func of(node: Node) -> HSLookSwitch:
	for c in node.get_children():
		if c is HSLookSwitch:
			return c
	return null


## a switch under a node (or the one already there)
static func attach(node: Node, settings: Dictionary = {}) -> HSLookSwitch:
	var s := of(node)
	if s != null:
		return s
	s = HSLookSwitch.new()
	s.name = "HSLookSwitch"
	for k in settings:
		s.set(k, settings[k])
	node.add_child(s)
	return s


func _ready() -> void:
	if Engine.is_editor_hint():
		set_process(false)
		return
	add_to_group(GROUP)
	_start.call_deferred()


func _start() -> void:
	if is_inside_tree():
		await get_tree().process_frame            # (after an HSCharacterLook beside it has put her skin and eye shaders on)
	begin()


## she's ready (her own shaders are on): the switch takes her as she is for her default and turns to `start`
func begin() -> void:
	if _begun:
		return
	_begun = true
	_cur = HSLookPreset.new().words()
	_cur["skin_amount"] = 0.0
	_cur["eye_amount"] = 0.0
	if start != "" and start != "default":
		set_look(start, 0.0)


## her looks' names, in the list's order
func names() -> PackedStringArray:
	var out: PackedStringArray = []
	for p in looks:
		if p != null and p.name != "":
			out.append(p.name)
	return out


func preset(look_name: String) -> HSLookPreset:
	for p in looks:
		if p != null and p.name == look_name:
			return p
	return null


func current() -> String:
	return now


func is_turning() -> bool:
	return _phase != ""


## what she wears this frame: {skin, skin_amount, eyes, eye_amount, ...}
func wearing() -> Dictionary:
	return _cur.duplicate()


## turn to a look by its name ("" or "default": her own); `secs` under 0: the look's own, else the switch's
func set_look(look_name: String, secs: float = -1.0) -> bool:
	if look_name == "" or look_name == "default":
		default(secs)
		return true
	var p := preset(look_name)
	if p == null:
		push_warning("HSLookSwitch: no look named '%s' (there are: %s)" % [look_name, ", ".join(names())])
		return false
	_turn(p.words(), look_name, secs if secs >= 0.0 else (p.seconds if p.seconds >= 0.0 else seconds))
	return true


## her own skin and eyes back
func default(secs: float = -1.0) -> void:
	_turn(HSLookPreset.new().words(), "", secs if secs >= 0.0 else seconds)


## a look made on the spot: a preset, or a dictionary of a preset's words ({"skin": "chrome", "eyes": "glow"})
func show(look, secs: float = -1.0) -> void:
	var w: Dictionary = look.words() if look is HSLookPreset else HSLookPreset.make(look).words()
	_turn(w, str(w["name"]) if str(w["name"]) != "" else "custom", secs if secs >= 0.0 else (float(w["seconds"]) if float(w["seconds"]) >= 0.0 else seconds))


## the next look in the list (her default first, then each in turn, round again)
func next(secs: float = -1.0) -> void:
	var all: PackedStringArray = [""]
	all.append_array(names())
	var i := all.find(now)
	set_look(all[(i + 1) % all.size()], secs)


## what an area's, a cue's or a scare's target is asked to do: `on_fire`
func fire(_a = null, _b = null) -> void:
	if on_fire == "next" or on_fire == "":
		next()
	else:
		set_look(on_fire)


func _story() -> Node:
	if not is_inside_tree():
		return null
	var st := get_tree().get_first_node_in_group("hs_story")
	return st if st != null and st.has_method("holds") else null


## the look the story asks for now: the last in the list whose needs hold ("" none)
func asked() -> String:
	var st := _story()
	var got := ""
	if st != null:
		for p in looks:
			if p != null and p.name != "" and p.needs != "" and bool(st.holds(p.needs)):
				got = p.name
	return got


func _same(a: Dictionary, b: Dictionary, keys: Array) -> bool:
	for k in keys:
		if a.get(k) != b.get(k):
			return false
	return true


func _kept_eyes(w: Dictionary) -> bool:           # under the cloak: are her eyes left to see
	return bool(w.get("eyes_show", false)) or str(w.get("eyes", "default")) != "default"


func _turn(w: Dictionary, look_name: String, secs: float) -> void:
	if not _begun:
		begin()
	if character() == null:
		return
	_want = w
	now = look_name
	_secs = maxf(secs, 0.0)
	_eyes_go = not _same(_cur, w, EYE_KEYS)
	_skin_goes = not _same(_cur, w, SKIN_KEYS)
	# the cloak is on her eyes too, or leaves them: when her eyes change under it, it's put on again
	if (str(w["skin"]) == "cloak" or str(_cur["skin"]) == "cloak") and (_eyes_go or _kept_eyes(_cur) != _kept_eyes(w)):
		_skin_goes = true
	_phase = "out"
	if _secs <= 0.0:
		advance(0.0)


func _apply_amounts() -> void:
	var t := character()
	if str(_cur["skin"]) != "default":
		HSCreatureSkin.set_amount(t, float(_cur["skin_amount"]))
	if str(_cur["eyes"]) != "default":
		HSEyeFx.set_amount(t, float(_cur["eye_amount"]))


func _swap() -> void:
	var t := character()
	if _skin_goes:
		HSCreatureSkin.clear(t)                   # (first: under a cloak her eyes' own materials come back)
	if _eyes_go:
		HSEyeFx.clear(t)
		for k in EYE_KEYS:
			_cur[k] = _want[k]
		_cur["eye_amount"] = 0.0
		if str(_cur["eyes"]) != "default":
			HSEyeFx.wear(t, _cur["eyes"], {"color": _cur["eye_color"], "amount": 0.0, "side": _cur["eye_side"]})
	if _skin_goes:
		for k in SKIN_KEYS:
			_cur[k] = _want[k]
		_cur["eyes_show"] = _want["eyes_show"]
		_cur["skin_amount"] = 0.0
		if str(_cur["skin"]) != "default":
			var st := {"amount": 0.0, "tint": _cur["skin_tint"], "extend": _cur["skin_extend"]}
			if str(_cur["skin"]) == "cloak":           # (the cloak's own words: a creature skin never loses her shadow)
				st["eyes"] = _kept_eyes(_want)
				st["shadow"] = _cur["shadow"]
			HSCreatureSkin.wear(t, _cur["skin"], st)
	_skin_goes = false
	_eyes_go = false


func _come_in() -> void:
	_swap()
	_phase = "in"
	_in_t = 0.0
	_in_from = [float(_cur["skin_amount"]), float(_cur["eye_amount"])]


func _process(dt: float) -> void:
	advance(dt)


## a step of `dt` seconds (the game's frames call it; a check can)
func advance(dt: float) -> void:
	if Engine.is_editor_hint() or not _begun:
		return
	var t := character()
	if t == null:
		return
	if by_story:                                     # the story's looks: when what it asks for changes
		_poll -= dt
		if _poll <= 0.0:
			_poll = 0.2
			var a := asked()
			if a != _auto:
				_auto = a
				set_look(a if a != "" else start)
	if _phase == "out":
		var worn := (_skin_goes and str(_cur["skin"]) != "default" and float(_cur["skin_amount"]) > 0.0) or (_eyes_go and str(_cur["eyes"]) != "default" and float(_cur["eye_amount"]) > 0.0)
		if worn and _secs > 0.0:
			var step := dt * 2.0 / _secs                 # half the turn to go
			if _skin_goes:
				_cur["skin_amount"] = move_toward(float(_cur["skin_amount"]), 0.0, step)
			if _eyes_go:
				_cur["eye_amount"] = move_toward(float(_cur["eye_amount"]), 0.0, step)
			_apply_amounts()
			worn = (_skin_goes and str(_cur["skin"]) != "default" and float(_cur["skin_amount"]) > 0.0) or (_eyes_go and str(_cur["eyes"]) != "default" and float(_cur["eye_amount"]) > 0.0)
			if worn:
				_shimmer(t, dt)
				return
			_secs *= 0.5                                 # and half to come
			_come_in()
			_shimmer(t, dt)
			return
		_come_in()
	if _phase == "in":                                   # from what she has to what the look asks, over the seconds left
		var ks := float(_want["skin_amount"]) if str(_cur["skin"]) != "default" else 0.0
		var ke := float(_want["eye_amount"]) if str(_cur["eyes"]) != "default" else 0.0
		_in_t = 1.0 if _secs <= 0.0 else minf(1.0, _in_t + dt / _secs)
		_cur["skin_amount"] = lerpf(_in_from[0], ks, _in_t)
		_cur["eye_amount"] = lerpf(_in_from[1], ke, _in_t)
		_apply_amounts()
		if _in_t >= 1.0:
			_phase = ""
			look_changed.emit(now)
	_shimmer(t, dt)


## cloaked: how fast she's moving, to the cloak (standing still she's nearly gone, moving she shows: as HSCloak does)
func _shimmer(t: Node3D, dt: float) -> void:
	if str(_cur.get("skin", "default")) != "cloak" or dt <= 0.0:
		_had_last = false
		return
	var here := t.global_position if t.is_inside_tree() else t.position
	var speed := here.distance_to(_last) / dt if _had_last else 0.0
	_last = here
	_had_last = true
	var want := clampf(speed / 1.4, 0.0, 1.0)
	_motion = lerpf(_motion, want, clampf(dt * (8.0 if want > _motion else 2.5), 0.0, 1.0))
	for m in HSCreatureSkin.worn(t):
		m.set_shader_parameter("motion", _motion)


func _unhandled_key_input(e: InputEvent) -> void:
	if Engine.is_editor_hint() or panel_key == KEY_NONE or not OS.is_debug_build():
		return
	if e is InputEventKey and e.pressed and not e.echo and e.keycode == panel_key:
		HSLookPicker.toggle(get_tree())
		get_viewport().set_input_as_handled()


func _validate_property(p: Dictionary) -> void:      # her looks' names as a list to pick from
	if p["name"] == "start" or p["name"] == "on_fire":
		var opts: PackedStringArray = ["default"] if p["name"] == "start" else ["next", "default"]
		opts.append_array(names())
		p["hint"] = PROPERTY_HINT_ENUM_SUGGESTION
		p["hint_string"] = ",".join(opts)


func _get_configuration_warnings() -> PackedStringArray:
	var out: PackedStringArray = []
	if character() == null:
		out.append("Put this under the character, or set Target.")
	var seen := {}
	for p in looks:
		if p == null or p.name == "":
			out.append("A look in the list has no name.")
		elif seen.has(p.name):
			out.append("Two looks are named '%s'." % p.name)
		else:
			seen[p.name] = true
	return out
