## The grade (post.gdshader; docs/GODOT_LOOK.md §1d): a film-style colour grade over the finished picture, a
## CanvasLayer between the tape (5) and the HUD (10). Presets after the looks horror films are graded to: `cinema`
## (the default: a gentle teal-and-orange, a soft vignette, fine grain), `teal-orange`, `cold`, `sodium` (the street's
## yellow), `bleach`, `noir`, `warm`, `none`. `HSPost.new()` added to the game, `apply("cinema")` or
## `apply({preset, amount, vignette, grain, warmth, saturation, contrast, fade, aberration})` (the story's
## `game.grade`), `set_grain_cap(k)` the menu's Film grain; `settings_of(name)` the numbers.
class_name HSPost
extends CanvasLayer

const PRESETS := {
	"none": {},
	"cinema": {"lift": Vector3(-0.012, 0.0, 0.028), "gain": Vector3(1.03, 1.0, 0.95), "saturation": 0.94, "contrast": 1.06, "vignette": 0.3, "grain": 0.15, "aberration": 0.6},
	"teal-orange": {"lift": Vector3(-0.02, 0.0, 0.045), "gain": Vector3(1.06, 1.0, 0.9), "saturation": 0.96, "contrast": 1.1, "vignette": 0.32, "grain": 0.15, "aberration": 0.8},
	"cold": {"lift": Vector3(0.0, 0.012, 0.035), "gamma": Vector3(0.98, 1.0, 1.04), "warmth": -0.45, "saturation": 0.8, "contrast": 1.06, "vignette": 0.35, "grain": 0.2},
	"sodium": {"lift": Vector3(0.02, 0.015, 0.0), "gain": Vector3(1.05, 1.0, 0.78), "saturation": 0.85, "contrast": 1.05, "vignette": 0.3, "grain": 0.2},
	"bleach": {"gain": Vector3(1.02, 1.02, 1.0), "saturation": 0.55, "contrast": 1.25, "fade": 0.03, "vignette": 0.25, "grain": 0.3},
	"noir": {"lift": Vector3(0.01, 0.01, 0.015), "saturation": 0.12, "contrast": 1.3, "fade": 0.04, "vignette": 0.45, "grain": 0.35},
	"warm": {"lift": Vector3(0.02, 0.01, 0.0), "warmth": 0.4, "saturation": 1.02, "contrast": 1.04, "vignette": 0.25, "grain": 0.12},
}
const DEFAULTS := {"amount": 1.0, "lift": Vector3(0, 0, 0), "gamma": Vector3(1, 1, 1), "gain": Vector3(1, 1, 1), "warmth": 0.0, "saturation": 1.0, "contrast": 1.0, "fade": 0.0,
	"vignette": 0.0, "vignette_soft": 0.55, "grain": 0.0, "aberration": 0.0}

var rect: ColorRect
var mat: ShaderMaterial
var preset_name: String = "none"


func _ready() -> void:
	layer = 6
	rect = ColorRect.new()
	rect.name = "Grade"
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mat = ShaderMaterial.new()
	mat.shader = load("res://addons/horrorstudio_look/post.gdshader")
	rect.material = mat
	add_child(rect)
	if preset_name != "none":
		apply(preset_name)


func _process(_dt: float) -> void:
	if mat != null:
		mat.set_shader_parameter("seed", float(Engine.get_frames_drawn() % 1000))


## a preset's numbers, the defaults under it
static func settings_of(name: String) -> Dictionary:
	var s := DEFAULTS.duplicate()
	s.merge(PRESETS.get(name, {}), true)
	return s


## the grade: a preset name, or a Dictionary with `preset` and any of the numbers over it; "none" or "" is off
func apply(grade) -> void:
	var s: Dictionary = {}
	if grade is Dictionary:
		preset_name = str(grade.get("preset", "cinema"))
		s = settings_of(preset_name)
		for k in grade:
			if k != "preset" and DEFAULTS.has(k):
				s[k] = grade[k]
	else:
		preset_name = str(grade) if grade != null else "none"
		s = settings_of(preset_name)
	var off := preset_name == "none" or preset_name == ""
	if rect != null:
		rect.visible = not off
	if mat == null:
		return
	for k in s:
		var v = s[k]
		var pname: String = "gamma_" if str(k) == "gamma" else str(k)
		if v is Array and v.size() == 3:
			v = Vector3(float(v[0]), float(v[1]), float(v[2]))
		mat.set_shader_parameter(pname, v)


func set_grain_cap(k: float) -> void:
	if mat != null:
		mat.set_shader_parameter("grain_cap", clamp(k, 0.0, 1.0))
