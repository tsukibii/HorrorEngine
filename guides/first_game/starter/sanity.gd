## Sanity: a meter that the night wears down and rest mends (DECISIONS 2026-11-12, the last: "a sanity bar/meter ...
## eating food, resting (sitting, sleeping at night) fix sanity, things can prevent from sleeping e.g. current quest
## might have something toggled as cant sleep ... a way to sync the hunts and events to the sanity so we can increase
## things and make things harder as sanity goes down"). One node anywhere in the scene (in the group hs_sanity).
##
## Down: the dark (`dark_drain`: your flashlight off and no lamp reaching you), her near and in the open (`near_drain`),
## a hunt running (`hunt_drain`), every scare (`scare_cost`), time itself (`drain`), dying (`death_cost`).
## Up: sitting (`sit_rate`, no further than `sit_to`), lying down (`lie_rate`, `lie_to`), eating (a thing in the pocket that's
## eatable, the left button held until the Story's eat meter fills: a food.gd thing picked up, a shop item marked
## Eatable, or a pocket thing listed in `foods` here), and sleep, which mends it to `sleep_to`: lie on a bed
## (seat.gd, pose lying) for `sleep_after` seconds, or call sleep().
## Not sleeping: a hunt running (`hunts_stop_sleep`), any of `no_sleep` holding (the Story's words: "on:find304" while
## that task is on the list, "hunt:Hunt", a fact of yours), `sleep_needs` not holding ("night"), or block_sleep("why")
## from a script until allow_sleep("why"). Then lying down says `cant_says` and only rests you.
##
## Syncing things to it:
##   - **facts**: `sanity:uneasy` is set while it's under 0.75, `sanity:shaken` under 0.5, `sanity:breaking` under
##     0.25. Anything's Needs takes them: a cue, a scare area, a moment, a hunt spot, a hunt's own Needs (a hunt that
##     only starts when you're shaken), a look ("!sanity:uneasy" for only while calm).
##   - **hunts** (hunt.gd `sanity_sync`) and **the night's director** (dread.gd `sanity_sync`) go faster as it falls:
##     spots and moments closer together, stages sooner, a shorter rest between rushes, a shorter warning (never under
##     a second), and under 0.25 the rush a stage early. `pressure()` is the number they use: 1 calm, 2 at nothing.
##   - **signals**: `changed`, `band_changed`, `broke` (it reached nothing: `zero_target`'s fire(), or `zero_dies`).
extends Node

const Sight := preload("res://starter/sight.gd")
const BANDS := [["calm", 0.75], ["uneasy", 0.5], ["shaken", 0.25], ["breaking", -1.0]]

signal changed(value: float)
signal band_changed(band: String)                     ## calm, uneasy, shaken, breaking
signal ate(what: String, amount: float)
signal slept
signal couldnt_sleep(why: String)
signal broke                                          ## it reached nothing

@export_range(0.0, 1.0) var sanity := 1.0
@export_group("What wears it down")
@export var drain := 0.0                              ## a second, always (0.001: a quarter gone in four minutes)
@export var dark_drain := 0.004                       ## a second in the dark, on your feet
@export var near_drain := 0.01                        ## a second with her within `near_m`, nothing between you
@export var near_m := 8.0
@export var hunt_drain := 0.003                       ## a second while a hunt runs
@export var scare_cost := 0.06                        ## each scare (anything in the group hs_scare)
@export var death_cost := 0.0                         ## dying
@export_group("What mends it")
@export var sit_rate := 0.01                          ## a second sitting
@export_range(0.0, 1.0) var sit_to := 0.7             ## sitting mends it no further than this
@export var lie_rate := 0.015                         ## a second lying down, awake
@export_range(0.0, 1.0) var lie_to := 0.8
@export var light_rate := 0.0                         ## a second standing in light (0: light only stops the dark's drain)
@export var foods := {}                               ## pocket things made eatable and how much each mends: {"soda": 0.1, "noodles": 0.3} (hold the left button: story.gd)
@export_group("Sleep")
@export var sleep_after := 4.0                        ## seconds lying down before you sleep (0: only sleep() does)
@export_range(0.0, 1.0) var sleep_to := 1.0           ## what sleep mends it to
@export var sleep_secs := 3.0                         ## how long the dark lasts
@export var sleep_needs := ""                         ## the Story's words that must hold to sleep ("night")
@export var no_sleep := PackedStringArray()           ## any of these holding and you can't: "on:find304", "hunt:Hunt"
@export var hunts_stop_sleep := true                  ## no sleep while a hunt runs
@export var cant_says := "You can't sleep. Not now."
@export var slept_says := ""
@export var slept_fact := "slept"                     ## set in the Story each time you've slept
@export_group("At nothing")
@export var zero_dies := false                        ## at nothing you die (the Story's die(): back at its checkpoint)
@export var zero_title := "You lost yourself"
@export var zero_target: Node                         ## its fire() at nothing
@export_range(0.0, 1.0) var revive_to := 0.5          ## back from the dead with at least this
@export_group("The meter")
@export var show_meter := true
@export_enum("always", "when it's not full", "when it changes") var meter_when := "when it's not full"
@export var label := "SANITY"
@export var color := Color(0.88, 0.64, 0.37)
@export var low_color := Color(0.78, 0.17, 0.15)

var sleeping := false
var now_band := "calm"
var why_down := ""                                    ## what's wearing it down now: dark, near, hunt, time (a check's, and yours)
var _blocks := {}
var _lying := 0.0
var _tried := false
var _hook_t := 0.0
var _lit_t := 0.0
var _lit := true
var _broke := false
var _shown := 0.0
var _moved := 0.0
var _last := 1.0
var _bar: Control
var _fill: ColorRect
var _black: ColorRect


func _ready() -> void:
	add_to_group("hs_sanity")
	_last = sanity
	_build()
	_hook.call_deferred()
	_facts.call_deferred()


func _story() -> Node:
	return get_tree().get_first_node_in_group("hs_story")


func _hook() -> void:
	for a in get_tree().get_nodes_in_group("hs_scare"):
		if a.has_signal("scared") and not a.scared.is_connected(_on_scare):
			a.scared.connect(_on_scare)
	var st := _story()
	if st != null:
		if st.has_signal("died") and not st.died.is_connected(_on_died):
			st.died.connect(_on_died)
		if st.has_signal("revived") and not st.revived.is_connected(_on_revived):
			st.revived.connect(_on_revived)
		if st.has_method("set_eatable"):                  # its foods: eatable out of the pocket (the Story's eat meter)
			for item in foods:
				if not st.is_eatable(str(item)):
					st.set_eatable(str(item), float(foods[item]))


func _on_scare() -> void:
	lose(scare_cost)


func _on_died(_how := "") -> void:
	lose(death_cost)


func _on_revived() -> void:
	_broke = false
	set_to(maxf(sanity, revive_to))


## 1 calm to 1 + `sync` at nothing: how much faster a hunt or the director goes (hunt.gd, dread.gd)
func pressure(sync := 1.0) -> float:
	return 1.0 + (1.0 - sanity) * maxf(0.0, sync)


## calm, uneasy, shaken or breaking
func band() -> String:
	for b in BANDS:
		if sanity >= float(b[1]):
			return str(b[0])
	return "breaking"


func set_to(v: float) -> void:
	var was := sanity
	sanity = clampf(v, 0.0, 1.0)
	if absf(sanity - was) < 0.000001:
		return
	changed.emit(sanity)
	var b := band()
	if b != now_band:
		now_band = b
		_facts()
		band_changed.emit(b)
	if sanity <= 0.0 and not _broke:
		_broke = true
		broke.emit()
		if zero_target != null and is_instance_valid(zero_target) and zero_target.has_method("fire"):
			zero_target.fire()
		var st := _story()
		if zero_dies and st != null and st.has_method("die"):
			st.die("sanity", zero_title, "")
	elif sanity > 0.05:
		_broke = false


## better by `k`
func add(k: float) -> void:
	set_to(sanity + k)


## worse by `k`
func lose(k: float) -> void:
	set_to(sanity - k)


# the Story's facts for it: sanity:uneasy under 0.75, sanity:shaken under 0.5, sanity:breaking under 0.25
func _facts() -> void:
	var st := _story()
	if st == null or not st.has_method("flag"):
		return
	for pair in [["sanity:uneasy", 0.75], ["sanity:shaken", 0.5], ["sanity:breaking", 0.25]]:
		if sanity < float(pair[1]):
			st.flag(str(pair[0]))
		elif st.has_method("unflag"):
			st.unflag(str(pair[0]))


## You ate something: better by `amount` (the Story calls this when its eat meter fills).
func eat(amount: float, what := "") -> void:
	add(amount)
	ate.emit(what, amount)


## A script's: one of `item` eaten out of the pocket at once, no meter (the Story's eat_up). False when it isn't
## there or isn't eatable.
func eat_item(item: String) -> bool:
	var st := _story()
	return st != null and st.has_method("eat_up") and st.eat_up(item)


## No sleep until allow_sleep(why): a script's switch (a quest that keeps you up).
func block_sleep(why := "blocked") -> void:
	_blocks[why] = true


func allow_sleep(why := "blocked") -> void:
	_blocks.erase(why)


## Why you can't sleep now ("": you can): blocked, hunt, a word of `no_sleep`, needs.
func why_not_sleep() -> String:
	if not _blocks.is_empty():
		return str(_blocks.keys()[0])
	if hunts_stop_sleep:
		for h in get_tree().get_nodes_in_group("hs_hunt"):
			if bool(h.get("running")):
				return "hunt"
	var st := _story()
	if st != null and st.has_method("holds"):
		for w in no_sleep:
			if w.strip_edges() != "" and st.holds(w):
				return w
		if sleep_needs != "" and not st.holds(sleep_needs):
			return "needs"
	return ""


func can_sleep() -> bool:
	return why_not_sleep() == ""


## Sleep now, if you can: the dark for `sleep_secs`, then mended to `sleep_to`. False (and `cant_says`) when you can't.
func sleep() -> bool:
	if sleeping:
		return false
	var why := why_not_sleep()
	var st := _story()
	if why != "":
		if cant_says != "" and st != null and st.has_method("say"):
			st.say(cant_says)
		couldnt_sleep.emit(why)
		return false
	sleeping = true
	if _black != null:
		_black.visible = true
		create_tween().tween_property(_black, "modulate:a", 1.0, minf(0.8, sleep_secs * 0.4))
	get_tree().create_timer(maxf(0.05, sleep_secs)).timeout.connect(_wake)
	return true


func _wake() -> void:
	set_to(maxf(sanity, sleep_to))
	sleeping = false
	var st := _story()
	if st != null:
		if slept_fact != "" and st.has_method("flag"):
			st.flag(slept_fact)
		if slept_says != "" and st.has_method("say"):
			st.say(slept_says)
	if _black != null:
		var tw := create_tween()
		tw.tween_property(_black, "modulate:a", 0.0, 1.0)
		tw.tween_callback(func() -> void: _black.visible = false)
	slept.emit()


func _process(dt: float) -> void:
	_meter(dt)
	_hook_t += dt
	if _hook_t >= 2.0:                                    # (scares made since: a hunt, a cue added later)
		_hook_t = 0.0
		_hook()
	var st := _story()
	if st != null and (bool(st.get("over")) or (st.has_method("card_up") and st.card_up())):
		return
	if sleeping:
		return
	var pl := get_tree().get_first_node_in_group("hs_player") as Node3D
	var pose := str(pl.get("pose")) if pl != null and pl.get("pose") != null else "standing"
	var d := 0.0
	why_down = ""
	# her near, a hunt on, time
	if pl != null and near_drain > 0.0:
		var eye := pl.global_position + Vector3.UP * 1.6
		for t in get_tree().get_nodes_in_group("hs_threat"):
			var tn := t as Node3D
			if tn != null and tn.is_visible_in_tree() and tn.global_position.distance_to(pl.global_position) <= near_m \
					and Sight.clear(pl, eye, tn.global_position + Vector3.UP * 1.4, [pl]):
				d += near_drain
				why_down = "near"
				break
	if hunt_drain > 0.0:
		for h in get_tree().get_nodes_in_group("hs_hunt"):
			if bool(h.get("running")):
				d += hunt_drain
				if why_down == "":
					why_down = "hunt"
				break
	d += drain
	# rest, or the dark
	var up := 0.0
	if pose == "sitting":
		up = sit_rate if sanity < sit_to else 0.0
	elif pose == "lying":
		up = lie_rate if sanity < lie_to else 0.0
	else:
		_lit_t -= dt
		if _lit_t <= 0.0:
			_lit_t = 0.2
			_lit = Sight.in_light(pl)
		if _lit:
			up = light_rate
		else:
			d += dark_drain
			if why_down == "":
				why_down = "dark"
	if why_down == "" and drain > 0.0:
		why_down = "time"
	var cap := 1.0 if pose != "sitting" and pose != "lying" else (sit_to if pose == "sitting" else lie_to)
	var v := sanity - d * dt
	if up > 0.0 and v < cap:                              # (rest mends it up to its cap, never past it)
		v = minf(v + up * dt, cap)
	if v != sanity:
		set_to(v)
	# sleep: lying down long enough
	if pose == "lying" and sleep_after > 0.0:
		_lying += dt
		if _lying >= sleep_after and not _tried:
			_tried = true
			sleep()
	else:
		_lying = 0.0
		_tried = false


# ---- the meter ----------------------------------------------------------------------------------------------------

func _build() -> void:
	var layer := CanvasLayer.new()
	layer.name = "SanityLayer"
	layer.layer = 4
	add_child(layer)
	_black = ColorRect.new()
	_black.color = Color(0, 0, 0, 1)
	_black.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_black.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_black.modulate.a = 0.0
	_black.visible = false
	layer.add_child(_black)
	if not show_meter:
		return
	_bar = Control.new()
	_bar.name = "Meter"
	_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bar.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_bar.offset_left = -214.0
	_bar.offset_top = 30.0
	_bar.offset_right = -34.0
	_bar.offset_bottom = 60.0
	layer.add_child(_bar)
	var l := Label.new()
	l.text = label
	l.add_theme_font_size_override("font_size", 12)
	l.add_theme_color_override("font_color", Color(0.92, 0.9, 0.85, 0.75))
	l.position = Vector2(0, 0)
	_bar.add_child(l)
	var back := ColorRect.new()
	back.color = Color(0, 0, 0, 0.45)
	back.position = Vector2(0, 20)
	back.size = Vector2(180, 5)
	_bar.add_child(back)
	_fill = ColorRect.new()
	_fill.position = Vector2(0, 20)
	_fill.size = Vector2(180, 5)
	_bar.add_child(_fill)
	_bar.modulate.a = 0.0


func _meter(dt: float) -> void:
	if _bar == null:
		return
	if absf(sanity - _last) > 0.002:
		_moved = 4.0
		_last = sanity
	_moved = maxf(0.0, _moved - dt)
	var want := 1.0
	if meter_when == "when it's not full":
		want = 1.0 if sanity < 0.995 else 0.0
	elif meter_when == "when it changes":
		want = 1.0 if _moved > 0.0 else 0.0
	_shown = move_toward(_shown, want, dt * 2.0)
	var beat := 1.0 if sanity >= 0.25 else 0.75 + 0.25 * sin(Time.get_ticks_msec() * 0.008)   # breaking: it pulses
	_bar.modulate.a = _shown * beat
	_fill.size.x = 180.0 * sanity
	_fill.color = low_color.lerp(color, smoothstep(0.15, 0.6, sanity))


## What it is, a check's.
func report() -> Dictionary:
	return {"sanity": sanity, "band": now_band, "why_down": why_down, "sleeping": sleeping, "can_sleep": can_sleep(),
		"why_not": why_not_sleep(), "meter": _bar != null, "meter_shown": _shown, "fill": _fill.size.x if _fill != null else -1.0}
