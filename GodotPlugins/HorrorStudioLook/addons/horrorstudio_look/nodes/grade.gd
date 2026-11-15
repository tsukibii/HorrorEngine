## A colour grade (HSPost; docs/GODOT_LOOK.md §0): a film-style grade over the finished picture. In the game it is the
## level's own grade while the level is loaded, over the story's `game.grade` (which comes back when the level goes);
## in a project of your own it adds the grade itself. Picking a `preset` in the inspector fills the numbers with
## that preset's, to tune from. Seen when the game runs (a screen effect isn't drawn in the editor's 3D view).
@tool
@icon("res://addons/horrorstudio_look/icons/grade.svg")
class_name HSGrade
extends Node

## a look to start from: picking one fills the numbers below with its own, to tune from there
@export_enum("cinema", "teal-orange", "cold", "sodium", "bleach", "noir", "warm", "none") var preset: String = "cinema":
	set(v):
		preset = v
		if Engine.is_editor_hint() and is_node_ready():
			_fill()
@export_range(0.0, 1.0) var amount: float = 1.0   ## how much of the grade: 0 the picture as it is, 1 all of it
@export var lift := Vector3(-0.012, 0.0, 0.028)   ## the shadows raised (above 0) or sunk, red, green and blue apart: (-0.01, 0, 0.03) cool shadows
@export var gamma := Vector3(1, 1, 1)   ## the midtones, red, green and blue apart: above 1 brighter, below 1 darker
@export var gain := Vector3(1.03, 1.0, 0.95)   ## the highlights times this, red, green and blue apart: (1.03, 1, 0.95) warm highlights
@export_range(-1.0, 1.0) var warmth: float = 0.0   ## the whole picture toward orange (above 0) or blue (below 0)
@export_range(0.0, 2.0) var saturation: float = 0.94   ## colour: 0 grey, 1 as it is, 2 twice
@export_range(0.5, 2.0) var contrast: float = 1.06   ## about the middle grey: 1 as it is, more the darks darker and the lights lighter
@export_range(0.0, 0.3) var fade: float = 0.0   ## a film fade: the blacks lifted toward a milky grey-blue
@export_range(0.0, 1.0) var vignette: float = 0.3   ## the picture darkened toward its edges and corners
@export_range(0.05, 1.0) var vignette_soft: float = 0.55   ## how far in the vignette starts: small only the corners, 1 from near the middle
@export_range(0.0, 1.0) var grain: float = 0.15   ## film grain (the players' Film grain setting caps it)
@export_range(0.0, 3.0) var aberration: float = 0.6   ## the colours pulled apart toward the picture's edge, in pixels there
var post: HSPost = null
var _prev = null
var _own := false

const KEYS := ["amount", "lift", "gamma", "gain", "warmth", "saturation", "contrast", "fade", "vignette", "vignette_soft", "grain", "aberration"]


func _fill() -> void:
	var s := HSPost.settings_of(preset)
	for k in KEYS:
		set(k, s[k])
	notify_property_list_changed()


func grade() -> Dictionary:
	var g := {"preset": preset}
	for k in KEYS:
		g[k] = get(k)
	return g


func _ready() -> void:
	if Engine.is_editor_hint():
		return
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		if n is HSPost and n != post:
			post = n
			break
	if post == null:
		post = HSPost.new()
		post.name = "Grade"
		_own = true
		add_child(post)
	else:
		_prev = post.last
	post.apply(grade())


func _exit_tree() -> void:
	if not Engine.is_editor_hint() and post != null and not _own and is_instance_valid(post):
		post.apply(_prev if _prev != null else "none")
