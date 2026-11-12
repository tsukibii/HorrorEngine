## A cloak that comes and goes (docs/GODOT_LOOK.md §5p, DECISIONS 2026-11-12: the film Predator's "invisibility
## cloaking"): a node to drop under a character. In the game she wears HSCreatureSkin's `cloak` on everything she has
## (creature_cloak.gdshader: the room behind her, bent through her shape) and this node makes it live:
##   - `motion`: her speed, smoothed, to the shader: standing still she's nearly gone, moving she ripples;
##   - `cloak(secs)` / `reveal(secs)`: it turns in crackling patches over a moment; fully revealed she's on her own
##     shaders again (her skin, her eyes, her hair: nothing of the cloak left on her);
##   - `flicker(secs)`: it breaks up in bands for a moment and settles (she's been shot, she walked through water);
##     with an HSHitReact beside it, every hit does;
##   - `fire()`: what the starter kit's areas and cues call on their `target`: `on_fire` says which of these.
##     $Freddy/HSCloak.reveal(0.8)                 # there he is
##     $Freddy/HSCloak.cloak()                     # and gone
##     HSCloak.attach($Freddy, {"cloaked": false}) # from a script: he starts as himself
## Not a tool script: in the editor it does nothing (put an HSCharacterLook's Creature skin on `cloak` to see it there).
@icon("res://addons/horrorstudio_look/icons/cloak.svg")
class_name HSCloak
extends Node

signal cloaked_changed(on: bool)                  ## fully cloaked (true) or fully herself again (false)

@export var target: Node3D = null                 ## the character; empty: the parent
@export var cloaked := true                       ## how she starts
@export_range(0.05, 10.0) var seconds: float = 1.2    ## how long it takes to come or go
@export var shimmer_when_moving := true           ## standing still she's nearly gone, moving she shows
@export_range(0.2, 6.0) var full_speed: float = 1.4   ## the speed (m/s) at which she shimmers most
@export var shadow := false                       ## cloaked, she still casts a shadow (nobody there, and a shadow on the wall)
@export var eyes_show := false                    ## cloaked, her eyes stay as they are: two eyes in the air
@export_range(0.0, 0.3) var bend: float = 0.035   ## how far the room behind her is shifted at her outline (m): more shows more
@export_range(0.0, 1.0) var glint: float = 0.15   ## how much a lamp catches on her
@export var spark: Color = Color(0.55, 0.8, 1.0)  ## the crackle's colour as it turns
@export_enum("toggle", "reveal", "cloak", "flicker") var on_fire: String = "toggle"   ## what fire() does (a scare area's or a cue's target)
@export_range(0.0, 3.0) var hit_flicker: float = 0.5   ## shot (an HSHitReact beside this node), it breaks up this long; 0: never

var amount := 0.0                                 # how much of the cloak now
var goal := 0.0
var glitch := 0.0
var motion := 0.0
var materials: Array = []
var _rate := 1.0
var _glitch_fall := 2.0
var _last := Vector3.ZERO
var _had_last := false
const NAME := "HSCloak"


func character() -> Node3D:
	return target if target != null else get_parent() as Node3D


## the cloak under a node, or null
static func of(node: Node) -> HSCloak:
	for c in node.get_children():
		if c is HSCloak:
			return c
	return null


## a cloak under a node (or the one already there); `settings`: this node's own numbers by name
static func attach(node: Node, settings: Dictionary = {}) -> HSCloak:
	var c := of(node)
	if c != null:
		return c
	c = HSCloak.new()
	c.name = NAME
	for k in settings:
		c.set(k, settings[k])
	node.add_child(c)
	return c


func _ready() -> void:
	if Engine.is_editor_hint():
		set_process(false)
		return
	_start.call_deferred()


func _start() -> void:
	if is_inside_tree():
		await get_tree().process_frame            # (after an HSCharacterLook beside it has put her look on: the cloak keeps that under it)
	for sib in (get_parent().get_children() if get_parent() != null else []):
		if sib.has_signal("hit") and sib.get_script() != null and str(sib.get_script().get_global_name()) == "HSHitReact":
			sib.connect("hit", _on_hit)
	if cloaked:
		amount = 1.0
		goal = 1.0
		_wear()


func _on_hit(_info = null) -> void:
	if hit_flicker > 0.0 and amount > 0.0:
		flicker(hit_flicker)


func _settings() -> Dictionary:
	return {"amount": amount, "shadow": shadow, "eyes": eyes_show, "bend": bend, "glint": glint, "spark": spark, "motion": motion, "glitch": glitch}


func _wear() -> void:
	var t := character()
	materials = HSCreatureSkin.wear(t, "cloak", _settings()) if t != null else []


func is_cloaked() -> bool:
	return goal > 0.5


## gone, over `secs` (under 0: this node's Seconds)
func cloak(secs: float = -1.0) -> void:
	goal = 1.0
	_rate = 1.0 / maxf(secs if secs >= 0.0 else seconds, 0.01)
	if materials.is_empty():
		_wear()


## herself again, over `secs`
func reveal(secs: float = -1.0) -> void:
	goal = 0.0
	_rate = 1.0 / maxf(secs if secs >= 0.0 else seconds, 0.01)


## it breaks up for `secs` and settles (only while she's cloaked)
func flicker(secs: float = 0.5, strength: float = 1.0) -> void:
	glitch = maxf(glitch, clampf(strength, 0.0, 1.0))
	_glitch_fall = 1.0 / maxf(secs, 0.05)


## what an area's or a cue's target is asked to do
func fire() -> void:
	match on_fire:
		"reveal":
			reveal()
		"cloak":
			cloak()
		"flicker":
			flicker()
		_:
			if is_cloaked():
				reveal()
			else:
				cloak()


func _process(dt: float) -> void:
	advance(dt)


## a step of `dt` seconds (the game's own frames call it; a check can)
func advance(dt: float) -> void:
	var t := character()
	if t == null:
		return
	var before := amount
	amount = move_toward(amount, goal, _rate * dt)
	glitch = move_toward(glitch, 0.0, _glitch_fall * dt)
	var here := t.global_position if t.is_inside_tree() else t.position
	var speed := here.distance_to(_last) / maxf(dt, 1e-4) if _had_last else 0.0
	_last = here
	_had_last = true
	var want := clampf(speed / full_speed, 0.0, 1.0) if shimmer_when_moving else 0.0
	motion = lerpf(motion, want, clampf(dt * (8.0 if want > motion else 2.5), 0.0, 1.0))   # quick to show, slow to settle
	if amount <= 0.0 and goal <= 0.0:
		if not materials.is_empty():              # herself again: her own shaders back
			HSCreatureSkin.clear(t)
			materials.clear()
			cloaked_changed.emit(false)
		return
	for m in materials:
		if m is ShaderMaterial:
			m.set_shader_parameter("amount", amount)
			m.set_shader_parameter("motion", motion)
			m.set_shader_parameter("glitch", glitch)
	if amount >= 1.0 and before < 1.0:
		cloaked_changed.emit(true)
