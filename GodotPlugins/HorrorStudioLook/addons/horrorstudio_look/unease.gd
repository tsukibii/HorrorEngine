## Unease over the picture (unease.gdshader; docs/GODOT_LOOK.md §5t, DECISIONS 2026-11-12, after the seats: "things
## that make the player think, am I going crazy"): the edges of the view swimming and breathing, a second picture
## drifting off the first, something dark growing in from the corners, the colour going. One node anywhere in the
## scene; a layer under the tape (5) and the grade (6), so they're laid over it. At `amount` 0 it draws nothing.
##   - **by itself**: with `follow_sanity` on it reads a Sanity node (the starter kit's sanity.gd, the group
##     hs_sanity): nothing while sanity is over `from`, all of it at `full`;
##   - `set_amount(k)`: by hand (follow_sanity off);
##   - `spike(k, secs)`: that much more for a moment, falling away (a scare, a hit, a look at her);
##   - `fire()`: a spike of `fire_amount`, for an area's, a cue's or a moment's `target`.
## Seen when the game runs (a screen effect isn't drawn in the editor's 3D view).
@icon("res://addons/horrorstudio_look/icons/unease.svg")
class_name HSUnease
extends CanvasLayer

@export_range(0.0, 1.0) var amount: float = 0.0   ## how much of it now (by hand: with Follow Sanity off)
@export var follow_sanity := true                 ## read the scene's Sanity node (sanity.gd)
@export_range(0.0, 1.0) var from: float = 0.6     ## sanity under this: it begins
@export_range(0.0, 1.0) var full: float = 0.1     ## sanity at this or under: all of it
@export_group("Parts")
@export_range(0.0, 1.0) var warp: float = 0.6     ## the edges of the view swim and breathe
@export_range(0.0, 1.0) var doubled: float = 0.5  ## a second picture drifting off the first
@export_range(0.0, 1.0) var crawl: float = 0.6    ## something dark growing in from the corners
@export_range(0.0, 1.0) var drain: float = 0.4    ## the colour going
@export_group("")
@export_range(0.0, 1.0) var most: float = 1.0     ## the most of it ever drawn (a player's setting: 0 turns it off)
@export_range(0.0, 1.0) var fire_amount: float = 0.6   ## fire(): a spike of this much
@export var fire_secs := 3.0

var shown := 0.0                                  # what's drawn now: amount and any spike, eased
var rect: ColorRect
var mat: ShaderMaterial
var hold_clock := -1.0                            # a check's: the shader's clock held at this (under 0: it runs)
var _spike := 0.0
var _spike_fall := 1.0
var _clock := 0.0


func _ready() -> void:
	layer = 3
	rect = ColorRect.new()
	rect.name = "Unease"
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mat = ShaderMaterial.new()
	mat.shader = load("res://addons/horrorstudio_look/unease.gdshader")
	rect.material = mat
	rect.visible = false
	add_child(rect)


func set_amount(k: float) -> void:
	amount = clampf(k, 0.0, 1.0)


## `k` more of it now, gone again over `secs`
func spike(k: float = 0.6, secs: float = 3.0) -> void:
	_spike = maxf(_spike, clampf(k, 0.0, 1.0))
	_spike_fall = _spike / maxf(secs, 0.05)


func fire() -> void:
	spike(fire_amount, fire_secs)


## what a sanity of `s` (0..1) asks for, 0..1
func of_sanity(s: float) -> float:
	if from <= full:
		return 1.0 if s <= full else 0.0
	return clampf((from - s) / (from - full), 0.0, 1.0)


func _process(dt: float) -> void:
	if follow_sanity and is_inside_tree():
		var san := get_tree().get_first_node_in_group("hs_sanity")
		if san != null and san.get("sanity") != null:
			amount = of_sanity(float(san.get("sanity")))
	_spike = move_toward(_spike, 0.0, _spike_fall * dt)
	var want := minf(clampf(amount + _spike, 0.0, 1.0), most)
	shown = move_toward(shown, want, dt * (1.5 if want > shown else 0.4))   # it comes on in a second, and takes its time going
	_clock += dt
	if rect == null:
		return
	rect.visible = shown > 0.002
	if rect.visible:
		mat.set_shader_parameter("amount", shown)
		mat.set_shader_parameter("warp", warp)
		mat.set_shader_parameter("doubled", doubled)
		mat.set_shader_parameter("crawl", crawl)
		mat.set_shader_parameter("drain", drain)
		mat.set_shader_parameter("clock", hold_clock if hold_clock >= 0.0 else _clock)
