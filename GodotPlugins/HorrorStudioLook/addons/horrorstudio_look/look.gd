## The studio's look for a Godot game (docs/GODOT_LOOK.md): the pseudo-realism preset. Small games lit by baked bounce
## (a VoxelGI per room) with the effects overplayed: screen-space reflections so wet floors, blood and glossy things
## carry the lights, SSAO and SSIL for the corners, a little glow on the practicals, a thin volumetric haze, AgX's
## filmic curve with the contrast pushed; temporal anti-aliasing alone (MSAA switches the screen-space reflections
## off in 4.7, measured in the plugin's check; TAA settles the reflections and the specular). `HSLook.apply(viewport, environment, "realism")` on any project;
## "plain" turns all of it off (flat shading for a look at the geometry). The story names it: `game.look`.
## **"balanced"** is the default (DECISIONS 2026-10-30, evening: the realism look with its atmosphere, well optimised,
## a GTX 1060 the target): the same picture with what costs most and shows least taken out (no SSIL, whose
## screen-space bounce also flashed colours as lights flickered; SSR at 48 steps, half-size roughness; SSAO as is; the
## haze kept, thinner); its project settings (`PROJECT`: TAA, the shadow atlas at 4096 and 16 bits with the medium soft
## filter, occlusion culling, the effects' buffers at their cheaper sizes) the export writes into every game and the
## plugin applies to a project when it's enabled (Project > Tools > HorrorStudio: apply the balanced project settings).
class_name HSLook

const PRESETS := {
	"realism": {
		"taa": true, "msaa": Viewport.MSAA_DISABLED, "ssaa": Viewport.SCREEN_SPACE_AA_DISABLED, "debanding": true,   # MSAA kills SSR (measured, 4.7): TAA alone
		"tonemap": Environment.TONE_MAPPER_AGX, "exposure": 1.2, "white": 1.0,
		"ssr": true, "ssr_steps": 128, "ssr_fade_in": 0.15, "ssr_fade_out": 2.0, "ssr_tolerance": 0.2,
		"ssao": true, "ssao_radius": 1.0, "ssao_intensity": 2.5, "ssao_power": 1.5, "ssao_detail": 0.5,
		"ssil": true, "ssil_radius": 1.2, "ssil_intensity": 0.45,   # pared back 2026-10-30 (the user: bright patches on the floor that come and go as you look): it's screen-space, what it bleeds depends on what's in view; the rooms' VoxelGIs carry the bounce
		"glow": true, "glow_intensity": 0.55, "glow_strength": 1.0, "glow_bloom": 0.04, "glow_threshold": 1.05, "glow_blend": Environment.GLOW_BLEND_MODE_SOFTLIGHT,
		"haze": true, "haze_density": 0.012, "haze_anisotropy": 0.55, "haze_albedo": Color(0.85, 0.9, 1.0),
		"adjust": true, "contrast": 1.08, "saturation": 1.04, "brightness": 1.0,
	},
	"balanced": {
		"taa": true, "msaa": Viewport.MSAA_DISABLED, "ssaa": Viewport.SCREEN_SPACE_AA_DISABLED, "debanding": true,
		"tonemap": Environment.TONE_MAPPER_AGX, "exposure": 1.2, "white": 1.0,
		"ssr": true, "ssr_steps": 48, "ssr_fade_in": 0.15, "ssr_fade_out": 2.0, "ssr_tolerance": 0.25,
		"ssao": true, "ssao_radius": 1.0, "ssao_intensity": 2.2, "ssao_power": 1.5, "ssao_detail": 0.5,
		"ssil": false,
		"glow": true, "glow_intensity": 0.55, "glow_strength": 1.0, "glow_bloom": 0.04, "glow_threshold": 1.05, "glow_blend": Environment.GLOW_BLEND_MODE_SOFTLIGHT,
		"haze": true, "haze_density": 0.009, "haze_anisotropy": 0.55, "haze_albedo": Color(0.85, 0.9, 1.0),
		"adjust": true, "contrast": 1.08, "saturation": 1.04, "brightness": 1.0,
	},
	"plain": {
		"taa": false, "msaa": Viewport.MSAA_DISABLED, "ssaa": Viewport.SCREEN_SPACE_AA_DISABLED, "debanding": false,
		"tonemap": Environment.TONE_MAPPER_FILMIC, "exposure": 1.0, "white": 1.0,
		"ssr": false, "ssao": false, "ssil": false, "glow": false, "haze": false, "adjust": false,
	},
}


## the balanced look's project settings (a GTX 1060 at 1080p the target): what a new project needs set by hand
## otherwise; the export writes the same into every game's project.godot (storykit/godot.py PROJECT_LOOK; GDEXPORT's
## load check reads them back against this)
const PROJECT := {
	"rendering/anti_aliasing/quality/use_taa": true,                       # TAA alone: MSAA switches SSR off (4.7)
	"rendering/anti_aliasing/quality/msaa_3d": 0,
	"rendering/anti_aliasing/quality/screen_space_aa": 0,
	"rendering/anti_aliasing/quality/use_debanding": true,
	"rendering/occlusion_culling/use_occlusion_culling": true,             # what's behind a wall isn't drawn (occluders)
	"rendering/lights_and_shadows/positional_shadow/atlas_size": 4096,
	"rendering/lights_and_shadows/positional_shadow/atlas_16_bits": true,
	"rendering/lights_and_shadows/positional_shadow/soft_shadow_filter_quality": 3,   # soft medium
	"rendering/lights_and_shadows/directional_shadow/size": 4096,
	"rendering/lights_and_shadows/directional_shadow/16_bits": true,
	"rendering/lights_and_shadows/directional_shadow/soft_shadow_filter_quality": 3,
	"rendering/environment/ssao/quality": 1,                                # low, at half size
	"rendering/environment/ssao/half_size": true,
	"rendering/environment/screen_space_reflection/roughness_quality": 1,   # low
	"rendering/environment/volumetric_fog/volume_size": 48,
	"rendering/environment/volumetric_fog/volume_depth": 48,
	"rendering/global_illumination/gi/use_half_resolution": true,           # a VoxelGI or SDFGI of yours, at half resolution
	"rendering/textures/default_filters/anisotropic_filtering_level": 2,    # 4x
}


## the balanced settings into this project's settings (saved): the plugin's tool menu, and once when it's enabled
static func apply_project(save := true) -> int:
	var n := 0
	for k in PROJECT:
		if ProjectSettings.get_setting(k) != PROJECT[k]:
			ProjectSettings.set_setting(k, PROJECT[k])
			n += 1
	if save:
		ProjectSettings.save()
	return n


## the preset on a viewport (its anti-aliasing) and an environment (everything else); unknown names are "balanced"
static func apply(vp: Viewport, env: Environment, name: String = "balanced") -> Dictionary:
	var p: Dictionary = PRESETS.get(name, PRESETS["balanced"])
	if vp != null:
		vp.use_taa = bool(p["taa"])
		vp.msaa_3d = p["msaa"]
		vp.screen_space_aa = p["ssaa"]
		vp.use_debanding = bool(p["debanding"])
	if env != null:
		env.tonemap_mode = p["tonemap"]
		env.tonemap_exposure = float(p["exposure"])
		env.tonemap_white = float(p["white"])
		env.ssr_enabled = bool(p["ssr"])
		if env.ssr_enabled:
			env.ssr_max_steps = int(p["ssr_steps"])
			env.ssr_fade_in = float(p["ssr_fade_in"])
			env.ssr_fade_out = float(p["ssr_fade_out"])
			env.ssr_depth_tolerance = float(p["ssr_tolerance"])
		env.ssao_enabled = bool(p["ssao"])
		if env.ssao_enabled:
			env.ssao_radius = float(p["ssao_radius"])
			env.ssao_intensity = float(p["ssao_intensity"])
			env.ssao_power = float(p["ssao_power"])
			env.ssao_detail = float(p["ssao_detail"])
		env.ssil_enabled = bool(p["ssil"])
		if env.ssil_enabled:
			env.ssil_radius = float(p["ssil_radius"])
			env.ssil_intensity = float(p["ssil_intensity"])
		env.glow_enabled = bool(p["glow"])
		if env.glow_enabled:
			env.glow_intensity = float(p["glow_intensity"])
			env.glow_strength = float(p["glow_strength"])
			env.glow_bloom = float(p["glow_bloom"])
			env.glow_hdr_threshold = float(p["glow_threshold"])
			env.glow_blend_mode = p["glow_blend"]
			env.set_glow_level(0, 0.0)
			env.set_glow_level(1, 0.0)
			env.set_glow_level(2, 1.0)
			env.set_glow_level(3, 0.0)
			env.set_glow_level(4, 1.0)
			env.set_glow_level(5, 0.0)
			env.set_glow_level(6, 0.0)
		env.volumetric_fog_enabled = bool(p["haze"])
		if env.volumetric_fog_enabled:
			env.volumetric_fog_density = float(p["haze_density"])
			env.volumetric_fog_anisotropy = float(p["haze_anisotropy"])
			env.volumetric_fog_albedo = p["haze_albedo"]
			env.volumetric_fog_gi_inject = 0.5
			env.volumetric_fog_ambient_inject = 0.3
		env.adjustment_enabled = bool(p["adjust"])
		if env.adjustment_enabled:
			env.adjustment_contrast = float(p["contrast"])
			env.adjustment_saturation = float(p["saturation"])
			env.adjustment_brightness = float(p["brightness"])
	return p


## the pause menu's Graphics rows over the preset (0 Low, 1 Medium, 2 High, 3 Epic): the preset's effects pared back,
## never added. reflections: Low no SSR, Medium half the steps; post: Low no glow, SSAO or SSIL, Medium no SSIL;
## effects: Low no haze; gi: Low no SSIL. Apply the preset first, then this.
static func quality(env: Environment, q: Dictionary) -> void:
	if env == null:
		return
	var refl: int = int(q.get("reflections", 2))
	var post: int = int(q.get("post", 2))
	var fx: int = int(q.get("effects", 2))
	var gi: int = int(q.get("gi", 2))
	if refl <= 0:
		env.ssr_enabled = false
	elif refl == 1 and env.ssr_enabled:
		env.ssr_max_steps = int(env.ssr_max_steps / 2)
	if post <= 0:
		env.glow_enabled = false
		env.ssao_enabled = false
		env.ssil_enabled = false
	elif post == 1:
		env.ssil_enabled = false
	if fx <= 0:
		env.volumetric_fog_enabled = false
	if gi <= 0:
		env.ssil_enabled = false


## the shadows' softness (the pause menu's Shadows row: 0 Low, 1 Medium, 2 High, 3 Epic): the filter over the shadow
## maps (hard, soft, softer with the lights' size as penumbras) and the atlas each light's map is cut from (a bigger one
## gives every light more pixels: the edge of a door's shadow at the top of its frame was a staircase with 4096 shared
## by twenty lights, the user's run of 2026-10-29). Lights carry their own `light_size` and `shadow_blur` (the export
## gives bulbs 6 cm, lamps 15 cm); this sets the rest.
static func shadows(vp: Viewport, q: int) -> void:
	var filt: Array = [RenderingServer.SHADOW_QUALITY_HARD, RenderingServer.SHADOW_QUALITY_SOFT_MEDIUM, RenderingServer.SHADOW_QUALITY_SOFT_HIGH, RenderingServer.SHADOW_QUALITY_SOFT_ULTRA]
	var k: int = clampi(q, 0, 3)
	RenderingServer.positional_soft_shadow_filter_set_quality(filt[k])
	RenderingServer.directional_soft_shadow_filter_set_quality(filt[k])
	if vp != null:
		vp.positional_shadow_atlas_size = [2048, 4096, 8192, 8192][k]
		vp.positional_shadow_atlas_16_bits = k < 2
		vp.positional_shadow_atlas_quad_0 = Viewport.SHADOW_ATLAS_QUADRANT_SUBDIV_4       # a few big maps for the lights nearest the eye...
		vp.positional_shadow_atlas_quad_1 = Viewport.SHADOW_ATLAS_QUADRANT_SUBDIV_16
		vp.positional_shadow_atlas_quad_2 = Viewport.SHADOW_ATLAS_QUADRANT_SUBDIV_64      # ...and smaller ones for the rest of a level's lights
		vp.positional_shadow_atlas_quad_3 = Viewport.SHADOW_ATLAS_QUADRANT_SUBDIV_64
	RenderingServer.directional_shadow_atlas_set_size([2048, 4096, 8192, 8192][k], k < 2)


## the iris (after Light Kit's Sky exposure, 2026-10-29): the eye settling over about a second, as a camcorder's iris
## does, and at night held a stop under so night doesn't turn grey. Auto exposure on the viewport's camera
## (CameraAttributesPractical): `speed` how fast it settles (1 is about a second), `scale` the brightness it settles
## to (0.4), halved at night, within `band` stops either way of the middle sensitivity (a camcorder's iris has a
## range; five stops made the room darken whenever the eye dropped to the floor: the user, 2026-10-30; one stop
## leaves the settling and keeps the room the room). `HSLook.iris(viewport, true, night)` after `apply`; off puts a
## plain attributes back.
static func iris(vp: Viewport, on: bool, night: bool = false, speed: float = 1.0, scale: float = 0.4, band: float = 0.5) -> CameraAttributesPractical:
	if vp == null:
		return null
	var cam := vp.get_camera_3d()
	if cam == null:
		return null
	var ca: CameraAttributesPractical = cam.attributes if cam.attributes is CameraAttributesPractical else CameraAttributesPractical.new()
	ca.auto_exposure_enabled = on
	ca.auto_exposure_speed = speed
	ca.auto_exposure_scale = scale * (0.5 if night else 1.0)
	ca.auto_exposure_min_sensitivity = 300.0 / pow(2.0, band)        # the band about ISO 300: 212 to 424 for half a stop either way
	ca.auto_exposure_max_sensitivity = 300.0 * pow(2.0, band)
	cam.attributes = ca
	return ca


## a player's anti-aliasing choice over the preset (the pause menu: Off, FXAA, TAA, TSR; TSR is TAA with FSR 2)
static func set_aa(vp: Viewport, choice: int) -> void:
	if vp == null:
		return
	vp.use_taa = choice >= 2
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if choice == 1 else Viewport.SCREEN_SPACE_AA_DISABLED
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR2 if choice == 3 else Viewport.SCALING_3D_MODE_BILINEAR
