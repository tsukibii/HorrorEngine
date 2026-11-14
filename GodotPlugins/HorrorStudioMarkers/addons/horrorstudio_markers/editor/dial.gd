@tool
## The facing dial (the user's mock-up: "Face Direction", a ring with 360° in it): the way she faces at a marker, seen
## from above, as a needle to drag round. Up on the dial is away from you in a view from above with north up (-Z);
## the needle points where the marker's arrow points. Ctrl snaps to 15 degrees.
##   turning(yaw)   while it's dragged (the marker follows, nothing kept yet)
##   turned(yaw)    let go: the new facing (one undo step)
extends Control

signal turning(yaw: float)
signal turned(yaw: float)

const Glyphs := preload("res://addons/horrorstudio_markers/editor/glyphs.gd")

var yaw := 0.0:                            ## radians: 0 faces +Z, a quarter turn faces +X (a Node3D's own rotation.y)
	set(v):
		yaw = v
		queue_redraw()
var color := Color("#4FC3F7")
var _held := false


func _init() -> void:
	custom_minimum_size = Vector2(54, 54) * Glyphs.scale()
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	tooltip_text = "The way she faces, seen from above. Drag the needle round (Ctrl: steps of 15 degrees), or drag the arrow's tip in the 3D view."


func degrees() -> float:
	return fposmod(rad_to_deg(yaw), 360.0)


func _draw() -> void:
	var s := Glyphs.scale()
	var mid := size * 0.5
	var r := minf(size.x, size.y) * 0.5 - 4.0 * s
	draw_circle(mid, r + 2.5 * s, Color(0.06, 0.07, 0.09, 0.9))
	draw_arc(mid, r, 0, TAU, 48, Color(1, 1, 1, 0.28), 4.0 * s, true)
	for i in 8:
		var a := i * TAU / 8.0
		var d := Vector2(sin(a), cos(a))
		draw_line(mid + d * (r - 4.0 * s), mid + d * (r + 1.0 * s), Color(1, 1, 1, 0.55 if i % 2 == 0 else 0.3), 1.2 * s)
	var dir := Vector2(sin(yaw), cos(yaw))                     # (seen from above with -Z up: +X to the right, +Z down)
	var n := Vector2(-dir.y, dir.x)
	var tip := mid + dir * (r - 1.0 * s)
	draw_line(mid, tip - dir * 5.0 * s, Color(1, 1, 1, 0.95), 2.4 * s, true)
	draw_colored_polygon(PackedVector2Array([tip + dir * 2.0 * s, tip - dir * 7.0 * s + n * 5.0 * s, tip - dir * 7.0 * s - n * 5.0 * s]), color)
	draw_circle(mid, 3.2 * s, color)
	var font := get_theme_default_font()
	var fs := int(9 * s)
	var text := "%d°" % int(round(degrees())) if int(round(degrees())) < 360 else "0°"
	var tw := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	draw_string(font, mid - dir * (r * 0.42) + Vector2(-tw * 0.5, fs * 0.36), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.8))


func _to(pos: Vector2, snap: bool) -> void:
	var d := pos - size * 0.5
	if d.length() < 2.0:
		return
	var y := atan2(d.x, d.y)
	if snap:
		y = deg_to_rad(snappedf(rad_to_deg(y), 15.0))
	yaw = y


func _gui_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and (e as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		var mb := e as InputEventMouseButton
		if mb.pressed:
			_held = true
			_to(mb.position, mb.ctrl_pressed)
			turning.emit(yaw)
		elif _held:
			_held = false
			turned.emit(yaw)
		accept_event()
	elif e is InputEventMouseMotion and _held:
		_to((e as InputEventMouseMotion).position, (e as InputEventMouseMotion).ctrl_pressed)
		turning.emit(yaw)
		accept_event()
