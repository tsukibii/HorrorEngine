## UltraVHS over the picture (docs/VHS.md; the plugin's presets, UnrealPlugins/UltraVHS/Tools/preview.py): a layer
## under the HUD with the tape shader on a full-screen rect. `preset("camcorder" | "worn" | "nightmare" | "off")`,
## `set_night(k)` (black records as a cool blue: Light Kit's night stays blue), `strength` the one number (docs/VHS.md
## §5: calm about 0.45, a scare pulses to 0.8). The story's `game.vhs` names the preset; Film grain in the menu caps
## the noise. The HUD sits above it, sharp (VHS.md §4).
extends CanvasLayer

const CAMCORDER := {"tape_lines": 480.0, "crop_4x3": true, "distortion": 0.085, "chromatic_aberration": 0.0, "vignette": 0.08,
	"black_level": Vector3(0.035, 0.027, 0.022), "white_level": Vector3(0.82, 0.81, 0.78), "saturation": 0.8,
	"luma_blur": 1.4, "sharpen": 1.0, "sharpen_radius": 3.0, "chroma_blur": 2.0, "chroma_shift": 0.0, "chroma_vertical_blend": 0.5,
	"luma_noise": 0.0, "chroma_noise": 0.0, "tracking_jitter": 0.0, "tracking_error": 0.0, "head_switch": 0.0, "dropouts": 0.0, "scanlines": 0.0, "glitch": 0.0}
const PRESETS := {
	"camcorder": {},
	"worn": {"saturation": 0.7, "luma_blur": 1.6, "chroma_blur": 3.0, "chroma_shift": 1.5, "luma_noise": 0.25, "chroma_noise": 0.35, "tracking_jitter": 0.4, "head_switch": 0.6, "dropouts": 0.3},
	"nightmare": {"tape_lines": 360.0, "saturation": 0.55, "black_level": Vector3(0.06, 0.045, 0.045), "white_level": Vector3(0.74, 0.72, 0.70), "luma_blur": 1.8, "chroma_blur": 4.5,
		"chroma_shift": 3.0, "luma_noise": 0.5, "chroma_noise": 0.7, "tracking_jitter": 1.0, "tracking_error": 0.5, "head_switch": 1.0, "dropouts": 1.0, "scanlines": 0.15},
}

@export var preset_name: String = "off"
@export_range(0.0, 1.0) var strength: float = 1.0
var rect: ColorRect
var mat: ShaderMaterial
var frame: int = 0
var grain_cap: float = 1.0      # the menu's Film grain: 0 caps the noise off


func _ready() -> void:
	layer = 5
	rect = ColorRect.new()
	rect.name = "Tape"
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mat = ShaderMaterial.new()
	mat.shader = load("res://addons/horrorstudio_look/vhs.gdshader")
	rect.material = mat
	add_child(rect)
	preset(preset_name)


func preset(name: String) -> void:
	preset_name = name
	if name == "off" or name == "" or not PRESETS.has(name):
		visible = false
		return
	visible = true
	var p: Dictionary = CAMCORDER.duplicate()
	for k in PRESETS[name]:
		p[k] = PRESETS[name][k]
	for k in p:
		var v = p[k]
		if (k == "luma_noise" or k == "chroma_noise") and v is float:
			v = float(v) * grain_cap
		mat.set_shader_parameter(k, v)
	mat.set_shader_parameter("strength", strength)


func set_strength(k: float) -> void:
	strength = clamp(k, 0.0, 1.0)
	if mat != null:
		mat.set_shader_parameter("strength", strength)


func set_night(k: float) -> void:
	if mat != null:
		mat.set_shader_parameter("night", clamp(k, 0.0, 1.0))


func set_grain_cap(k: float) -> void:
	grain_cap = k
	preset(preset_name)


func _process(_dt: float) -> void:
	frame += 1
	if visible and mat != null:
		mat.set_shader_parameter("frame", frame)
