## UltraVHS over the picture (docs/VHS.md; the plugin's presets, tools/ultravhs/preview.py): a layer
## under the HUD with the tape shader on a full-screen rect. `preset("camcorder" | "worn" | "nightmare" | "off")`,
## `set_night(k)` (black records as a cool blue: Light Kit's night stays blue), `strength` the one number (docs/VHS.md
## §5: calm about 0.45, a scare pulses to 0.8). The story's `game.vhs` names the preset; Film grain in the menu caps
## the noise. The HUD sits above it, sharp (VHS.md §4). **Ghosting** (the plugin's persistence): a viewport of its own
## copies the screen's last frame each frame (`vhs_hold.gdshader`) and the tape mixes a little of it in (0.15 on the
## camcorder, 0.2 worn, 0.3 nightmare); `ghost(false)` turns the copy off (a still picture, the look check).
extends CanvasLayer

const CAMCORDER := {"tape_lines": 480.0, "crop_4x3": true, "distortion": 0.085, "chromatic_aberration": 0.0, "vignette": 0.08,
	"black_level": Vector3(0.035, 0.027, 0.022), "white_level": Vector3(0.82, 0.81, 0.78), "saturation": 0.8,
	"luma_blur": 1.4, "sharpen": 1.0, "sharpen_radius": 3.0, "chroma_blur": 2.0, "chroma_shift": 0.0, "chroma_vertical_blend": 0.5,
	"luma_noise": 0.0, "chroma_noise": 0.0, "tracking_jitter": 0.0, "tracking_error": 0.0, "head_switch": 0.0, "dropouts": 0.0, "scanlines": 0.0, "glitch": 0.0, "ghosting": 0.15}
const PRESETS := {
	"camcorder": {},
	"camhybrid": {"distortion": 0.062, "luma_blur": 0.88, "chroma_blur": 1.65, "sharpen": 1.06, "vignette": 0.074, "ghosting": 0.13, "soften": [0.85, 5.75, 1.55, 0.55]},   # the user's (2026-10-29): the camcorder with less fisheye and its blur mostly with distance (HSSoften: near, far, pixels, least); the strength they picked from seven (between B and C on docs/godot_sheets/2026-10-29_camhybrid_pick.jpg)
	"worn": {"saturation": 0.7, "luma_blur": 1.6, "chroma_blur": 3.0, "chroma_shift": 1.5, "luma_noise": 0.25, "chroma_noise": 0.35, "tracking_jitter": 0.4, "head_switch": 0.6, "dropouts": 0.3, "ghosting": 0.2},
	"nightmare": {"tape_lines": 360.0, "saturation": 0.55, "black_level": Vector3(0.06, 0.045, 0.045), "white_level": Vector3(0.74, 0.72, 0.70), "luma_blur": 1.8, "chroma_blur": 4.5,
		"chroma_shift": 3.0, "luma_noise": 0.5, "chroma_noise": 0.7, "tracking_jitter": 1.0, "tracking_error": 0.5, "head_switch": 1.0, "dropouts": 1.0, "scanlines": 0.15, "ghosting": 0.3},
}

@export var preset_name: String = "off"   ## the tape's look by name (camcorder, camhybrid, worn, nightmare, off)
@export_range(0.0, 1.0) var strength: float = 1.0   ## how much of the tape's look: 0 a clean picture
var rect: ColorRect
const Soften := preload("res://addons/horrorstudio_look/soften.gd")   # the softener (camhybrid), by its path: no class cache needed
var mat: ShaderMaterial
var frame: int = 0
var grain_cap: float = 1.0      # the menu's Film grain: 0 caps the noise off
var history: SubViewport = null # the last frame, copied (ghosting)
var hold: ColorRect = null
var ghost_on: bool = true


func _ready() -> void:
	layer = 5
	add_to_group("hs_tape")                          # (the HUD and the starter's words lay themselves inside its picture: picture())
	rect = ColorRect.new()
	rect.name = "Tape"
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mat = ShaderMaterial.new()
	mat.shader = load("res://addons/horrorstudio_look/vhs.gdshader")
	rect.material = mat
	add_child(rect)
	history = SubViewport.new()
	history.name = "History"
	history.disable_3d = true
	history.transparent_bg = false
	history.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	history.size = get_viewport().size if get_viewport() != null else Vector2i(1280, 720)
	hold = ColorRect.new()
	hold.name = "Hold"
	hold.set_anchors_preset(Control.PRESET_FULL_RECT)
	var hm := ShaderMaterial.new()
	hm.shader = load("res://addons/horrorstudio_look/vhs_hold.gdshader")
	hold.material = hm
	history.add_child(hold)
	add_child(history)
	call_deferred("_wire_history")
	preset(preset_name)


## the history copies the screen (the root viewport's texture, last frame) and the tape reads the copy
func _wire_history() -> void:
	var vp := get_viewport()
	if vp == null or history == null:
		return
	history.size = vp.size
	hold.size = Vector2(vp.size)
	hold.material.set_shader_parameter("current", vp.get_texture())
	mat.set_shader_parameter("history_tex", history.get_texture())
	mat.set_shader_parameter("has_history", ghost_on)
	if not vp.size_changed.is_connected(_wire_history):
		vp.size_changed.connect(_wire_history)


## the persistence on or off (off: a still picture to measure, or a machine where the copy costs too much)
func ghost(on: bool) -> void:
	ghost_on = on
	if history != null:
		history.render_target_update_mode = SubViewport.UPDATE_ALWAYS if on else SubViewport.UPDATE_DISABLED
	if mat != null:
		mat.set_shader_parameter("has_history", on)


func preset(name: String) -> void:
	preset_name = name
	if name == "off" or name == "" or not PRESETS.has(name):
		visible = false
		_soften(null)
		return
	visible = true
	var p: Dictionary = CAMCORDER.duplicate()
	for k in PRESETS[name]:
		p[k] = PRESETS[name][k]
	_soften(p.get("soften"))
	for k in p:
		if k == "soften":
			continue
		var v = p[k]
		if (k == "luma_noise" or k == "chroma_noise") and v is float:
			v = float(v) * grain_cap
		mat.set_shader_parameter(k, v)
	mat.set_shader_parameter("strength", strength)


## the softener on the viewport's camera's compositor (HSSoften) for a preset that asks for it ([near, far, pixels, least]), off for one that doesn't
func _soften(amounts) -> void:
	var vp := get_viewport()
	var cam: Camera3D = vp.get_camera_3d() if vp != null else null
	if cam == null:
		return
	if amounts == null or not (amounts is Array):
		Soften.detach(cam)
		return
	var sft = Soften.attach(cam)
	sft.set_amounts(float(amounts[0]), float(amounts[1]), float(amounts[2]), float(amounts[3]) if amounts.size() > 3 else 0.25)


## Where the tape's picture is on the screen, in the viewport's own coordinates (`view` its size; the viewport's when
## it's left out): 4:3 in the middle of a wider view while the tape is on (the bars either side are black: vhs.gdshader
## pillarboxes, it never letterboxes), else the whole view. The HSHud lays its corners inside it, and the starter's own
## words and meters (the user, 2026-11-15: "make sure the quests align to not be in the black letter boxes (no matter
## what vhs style or res), should be inside the frame")
func picture(view: Vector2 = Vector2.ZERO) -> Rect2:
	var vs := view
	if vs == Vector2.ZERO and is_inside_tree():
		vs = get_viewport().get_visible_rect().size
	var whole := Rect2(Vector2.ZERO, vs)
	if not visible or mat == null or vs.y <= 0.0:
		return whole
	if float(mat.get_shader_parameter("strength")) <= 0.0 or not bool(mat.get_shader_parameter("crop_4x3")):
		return whole                                  # (no tape drawn, or a tape as wide as the view: no bars)
	if vs.x / vs.y <= 4.0 / 3.0:
		return whole
	var w := vs.y * 4.0 / 3.0
	return Rect2((vs.x - w) * 0.5, 0.0, w, vs.y)


## The picture of whichever tape is on in `node`'s tree (the Look plugin's, in the group `hs_tape`), in its viewport's
## coordinates: the whole view when there's none. For a script that has no tape of its own to ask.
static func picture_of(node: Node) -> Rect2:
	if node == null or not node.is_inside_tree():
		return Rect2()
	var vs := node.get_viewport().get_visible_rect().size
	for t in node.get_tree().get_nodes_in_group("hs_tape"):
		if t.has_method("picture") and t.get_viewport() == node.get_viewport():
			var r: Rect2 = t.call("picture", vs)
			if r.size.x < vs.x - 0.5:
				return r
	return Rect2(Vector2.ZERO, vs)


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
