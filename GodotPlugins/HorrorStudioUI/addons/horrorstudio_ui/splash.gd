@icon("res://addons/horrorstudio_ui/icons/splash.svg")
class_name HSSplash
extends Control
## A studio's card before the game (the user, 2026-11-15: "an overridable launcher (override the godot opener logo with
## our own for now just a black screen with [Artist Presents] then main menu"): black, the words (and a picture above
## them, when given) easing in, held, easing out, then the next scene. Any key or click skips it. Godot's own boot screen
## goes black with it: the project maker sets application/boot_splash (a black background, no image).
## Put it as a scene's root (the project maker's intro.tscn) and set it as the main scene. Yours to change: `line`,
## `picture`, the times, `next_scene`.

signal finished                                       ## over (or skipped): the next scene's on its way

@export_multiline var line := "[Artist] presents"     ## the words (the studio's name)
@export var picture: Texture2D                        ## a logo above the words (none: the words alone)
@export_file("*.tscn") var next_scene := "res://menu.tscn"   ## the scene after it (the main menu)
@export_range(0.0, 5.0, 0.05) var fade_in := 1.2      ## seconds for the words to come up out of the black
@export_range(0.0, 10.0, 0.05) var hold := 1.8        ## seconds they stay
@export_range(0.0, 5.0, 0.05) var fade_out := 1.0     ## seconds for them to go back into the black
@export var skippable := true                         ## any key or click goes on at once
@export var text_color := Color(0.86, 0.84, 0.8)      ## the words' colour
@export_range(10, 96) var text_size := 26             ## the words' size in pixels

var _t := 0.0
var _gone := false
var _box: VBoxContainer


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.name = "Black"
	bg.color = Color.BLACK
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_box = VBoxContainer.new()
	_box.name = "Card"
	_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_box.add_theme_constant_override("separation", 22)
	add_child(_box)
	_box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if picture != null:
		var tr := TextureRect.new()
		tr.texture = picture
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tr.custom_minimum_size = Vector2(0, 220)
		_box.add_child(tr)
	var l := Label.new()
	l.name = "Line"
	l.text = line
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", text_size)
	l.add_theme_color_override("font_color", text_color)
	var f: Font = load("res://addons/horrorstudio_ui/theme.gd").tracked(3.0)
	if f != null:
		l.add_theme_font_override("font", f)
	_box.add_child(l)
	_box.modulate.a = 0.0
	if Engine.is_editor_hint():
		_box.modulate.a = 1.0
		set_process(false)


func _process(dt: float) -> void:
	_t += dt
	var a := 0.0
	if _t < fade_in:
		a = _t / maxf(fade_in, 0.001)
	elif _t < fade_in + hold:
		a = 1.0
	elif _t < fade_in + hold + fade_out:
		a = 1.0 - (_t - fade_in - hold) / maxf(fade_out, 0.001)
	else:
		_next()
	_box.modulate.a = clampf(a, 0.0, 1.0)


func _input(e: InputEvent) -> void:
	if not skippable or _gone or Engine.is_editor_hint():
		return
	if (e is InputEventKey and e.pressed and not e.echo) or (e is InputEventMouseButton and e.pressed):
		get_viewport().set_input_as_handled()
		_next()


func _next() -> void:
	if _gone:
		return
	_gone = true
	finished.emit()
	if next_scene != "" and ResourceLoader.exists(next_scene):
		get_tree().change_scene_to_file.call_deferred(next_scene)
