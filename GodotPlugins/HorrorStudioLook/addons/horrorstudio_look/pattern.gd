## A light's pattern (pattern.gdshader; docs/GODOT_LOOK.md §1b): caustics, leaves, blinds or cloud shadows moving in
## the light a SpotLight3D throws. `HSPattern.attach(spot, settings, aim_distance)` draws a loop of frames of the
## pattern into a small viewport at load (one a frame, a few dozen frames) and then makes them the light's projector
## in turn (a projector is copied into the renderer's atlas once: a texture that changed every frame wouldn't show,
## so the frames are plain textures, cycled; the loop runs back and forth so it never jumps). The pattern lands where
## the light is aimed. Settings (the story's `pattern` words on a light, STORY_FORMAT §2): `pattern` the kind,
## `scale` metres per feature, `speed`, `open` 0..1, `angle` degrees (blinds), `size` pixels (128), `frames` (40 over
## `period` seconds (5); blinds one). `metres` is worked out from the light's spread and the distance to what it's
## aimed at, so a 60 cm caustic is 60 cm on the wall. The spot's shadows are switched on: Godot projects only through
## a shadowed spot (without, the light goes dark). After Light Kit's Pattern actor; the same four light functions.
@tool
class_name HSPattern
extends Node

const KINDS := {"caustics": 0, "leaves": 1, "blinds": 2, "clouds": 3}
const SCALES := {"caustics": 0.6, "leaves": 0.6, "blinds": 0.05, "clouds": 6.0}
const SPEEDS := {"caustics": 0.4, "leaves": 0.4, "blinds": 0.0, "clouds": 0.04}
var mat: ShaderMaterial
var kind := "caustics"
var spot: SpotLight3D
var vp: SubViewport = null
var textures: Array = []           # the loop's frames, ImageTextures
var frames_wanted := 40
var period := 5.0
var drawing := -1                  # the frame being drawn (-1: none pending)
var shown := -1
var clock := 0.0


static func attach(spot_: SpotLight3D, s: Dictionary, aim_distance: float = 3.0) -> HSPattern:
	var have = spot_.get_node_or_null("Pattern")
	if have != null and have is HSPattern:
		have.settings(s, aim_distance)
		return have
	var hp := HSPattern.new()
	hp.name = "Pattern"
	hp.spot = spot_
	spot_.shadow_enabled = true        # a projector only works on a spot with shadows (measured 2026-10-29: without, the light goes dark)
	spot_.add_child(hp)
	hp.settings(s, aim_distance)
	return hp


static func on(spot_: SpotLight3D) -> HSPattern:
	var have = spot_.get_node_or_null("Pattern")
	return have if have != null and have is HSPattern else null


static func detach(spot_: SpotLight3D) -> void:
	var have = spot_.get_node_or_null("Pattern")
	if have != null:
		spot_.light_projector = null
		have.queue_free()


## the pattern's words; the frames drawn again from the start
func settings(s: Dictionary, aim_distance: float) -> void:
	kind = str(s.get("pattern", "caustics"))
	if not KINDS.has(kind):
		kind = "caustics"
	var px: int = int(s.get("size", 128))
	frames_wanted = 1 if kind == "blinds" else int(s.get("frames", 40))
	period = float(s.get("period", 5.0))
	if vp != null:
		vp.queue_free()
		vp = null
	textures.clear()
	shown = -1
	drawing = -1
	if DisplayServer.get_name() == "headless":        # nothing draws headless (the checks): no loop, the spot plain
		return
	vp = SubViewport.new()
	vp.name = "Draw"
	vp.size = Vector2i(px, px)
	vp.disable_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	vp.render_target_clear_mode = SubViewport.CLEAR_MODE_ALWAYS
	var rect := ColorRect.new()
	rect.name = "Rect"
	rect.size = Vector2(px, px)
	mat = ShaderMaterial.new()
	mat.shader = load("res://addons/horrorstudio_look/pattern.gdshader")
	rect.material = mat
	vp.add_child(rect)
	add_child(vp)
	mat.set_shader_parameter("kind", int(KINDS[kind]))
	mat.set_shader_parameter("scale", float(s.get("scale", SCALES[kind])))
	mat.set_shader_parameter("speed", float(s.get("speed", SPEEDS[kind])))
	mat.set_shader_parameter("openness", float(s.get("open", 0.5)))
	mat.set_shader_parameter("angle", float(s.get("angle", 0.0)))
	mat.set_shader_parameter("metres", 2.0 * max(aim_distance, 0.1) * tan(deg_to_rad(spot.spot_angle)))


func _process(dt: float) -> void:
	if vp != null:                                       # drawing the loop: a frame each engine frame, read back the next
		if drawing >= 0:
			var img: Image = vp.get_texture().get_image()
			if img != null and img.get_width() > 0:
				textures.append(ImageTexture.create_from_image(img))
			drawing = -1
		if textures.size() >= frames_wanted:
			vp.queue_free()
			vp = null
		else:
			drawing = textures.size()
			mat.set_shader_parameter("t", (float(drawing) / float(frames_wanted)) * period)
			vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	if textures.is_empty():
		return
	clock += dt
	var n: int = textures.size()
	var idx := 0
	if n > 1:                                            # back and forth over the loop, so the pattern never jumps
		var u: float = fmod(clock / period, 2.0)
		var k: float = u if u < 1.0 else 2.0 - u
		idx = clampi(int(floor(k * float(n))), 0, n - 1)
	if idx != shown:
		shown = idx
		spot.light_projector = textures[idx]
