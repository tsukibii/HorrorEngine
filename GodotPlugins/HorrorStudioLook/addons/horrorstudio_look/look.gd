## The studio's look for a Godot game (docs/GODOT_LOOK.md): the pseudo-realism preset. Small games lit by baked bounce
## (a VoxelGI per room) with the effects overplayed: screen-space reflections so wet floors, blood and glossy things
## carry the lights, SSAO and SSIL for the corners, a little glow on the practicals, a thin volumetric haze, AgX's
## filmic curve with the contrast pushed; temporal anti-aliasing alone (MSAA switches the screen-space reflections
## off in 4.7, measured in the plugin's check; TAA settles the reflections and the specular). `HSLook.apply(viewport, environment, "realism")` on any project;
## "plain" turns all of it off (flat shading for a look at the geometry). The story names it: `game.look`.
class_name HSLook

const PRESETS := {
	"realism": {
		"taa": true, "msaa": Viewport.MSAA_DISABLED, "ssaa": Viewport.SCREEN_SPACE_AA_DISABLED, "debanding": true,   # MSAA kills SSR (measured, 4.7): TAA alone
		"tonemap": Environment.TONE_MAPPER_AGX, "exposure": 1.2, "white": 1.0,
		"ssr": true, "ssr_steps": 128, "ssr_fade_in": 0.15, "ssr_fade_out": 2.0, "ssr_tolerance": 0.2,
		"ssao": true, "ssao_radius": 1.0, "ssao_intensity": 2.5, "ssao_power": 1.5, "ssao_detail": 0.5,
		"ssil": true, "ssil_radius": 2.5, "ssil_intensity": 1.2,
		"glow": true, "glow_intensity": 0.55, "glow_strength": 1.0, "glow_bloom": 0.04, "glow_threshold": 1.05, "glow_blend": Environment.GLOW_BLEND_MODE_SOFTLIGHT,
		"haze": true, "haze_density": 0.012, "haze_anisotropy": 0.55, "haze_albedo": Color(0.85, 0.9, 1.0),
		"adjust": true, "contrast": 1.08, "saturation": 1.04, "brightness": 1.0,
	},
	"plain": {
		"taa": false, "msaa": Viewport.MSAA_DISABLED, "ssaa": Viewport.SCREEN_SPACE_AA_DISABLED, "debanding": false,
		"tonemap": Environment.TONE_MAPPER_FILMIC, "exposure": 1.0, "white": 1.0,
		"ssr": false, "ssao": false, "ssil": false, "glow": false, "haze": false, "adjust": false,
	},
}


## the preset on a viewport (its anti-aliasing) and an environment (everything else); unknown names are "realism"
static func apply(vp: Viewport, env: Environment, name: String = "realism") -> Dictionary:
	var p: Dictionary = PRESETS.get(name, PRESETS["realism"])
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
## to (0.4), halved at night. `HSLook.iris(viewport, true, night)` after `apply`; off puts a plain attributes back.
static func iris(vp: Viewport, on: bool, night: bool = false, speed: float = 1.0, scale: float = 0.4) -> CameraAttributesPractical:
	if vp == null:
		return null
	var cam := vp.get_camera_3d()
	if cam == null:
		return null
	var ca: CameraAttributesPractical = cam.attributes if cam.attributes is CameraAttributesPractical else CameraAttributesPractical.new()
	ca.auto_exposure_enabled = on
	ca.auto_exposure_speed = speed
	ca.auto_exposure_scale = scale * (0.5 if night else 1.0)
	ca.auto_exposure_min_sensitivity = 50.0
	ca.auto_exposure_max_sensitivity = 1600.0
	cam.attributes = ca
	return ca


## a player's anti-aliasing choice over the preset (the pause menu: Off, FXAA, TAA, TSR; TSR is TAA with FSR 2)
static func set_aa(vp: Viewport, choice: int) -> void:
	if vp == null:
		return
	vp.use_taa = choice >= 2
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if choice == 1 else Viewport.SCREEN_SPACE_AA_DISABLED
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR2 if choice == 3 else Viewport.SCALING_3D_MODE_BILINEAR
