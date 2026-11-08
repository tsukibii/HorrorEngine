## The air (docs/research/eye_candy.md §2, docs/GODOT_LOOK.md §5j): what HSAtmosphere, HSBeam, HSDust and HSAirZone
## share. The fog level as a density (one number set by eye), the presets, the noise every shader of the air reads the
## same way (the froxel fog's wisps, a beam's, the dust's), a flashlight's cookies, and the air a node's scene is in.
@tool
class_name HSAir

## The fog level (0..1) as the fog's density per metre. 0.25 is the balanced look's haze (0.009); 0.5 sees about 80 m;
## 0.75 about 35 m; 1 about 20 m (to see through ≈ 3 / density).
static func density(level: float) -> float:
	return 0.15 * pow(clampf(level, 0.0, 1.0), 2.03)


static func level_of(d: float) -> float:
	return pow(clampf(d / 0.15, 0.0, 1.0), 1.0 / 2.03)


## the places' air: the level, the ground mist, the dust, how broken up it is, the fog's colour
const PRESETS := {
	"clear": {"fog": 0.0, "mist": 0.0, "dust": 0.0, "noise": 0.3, "color": Color(0.8, 0.84, 0.9)},
	"clean_room": {"fog": 0.15, "mist": 0.0, "dust": 0.12, "noise": 0.3, "color": Color(0.85, 0.85, 0.85)},
	"dusty_room": {"fog": 0.32, "mist": 0.0, "dust": 0.75, "noise": 0.45, "color": Color(0.86, 0.82, 0.76)},
	"hazy_night": {"fog": 0.36, "mist": 0.15, "dust": 0.25, "noise": 0.5, "color": Color(0.78, 0.82, 0.9)},
	"woods_mist": {"fog": 0.42, "mist": 0.6, "dust": 0.35, "noise": 0.7, "color": Color(0.8, 0.85, 0.88)},
	"fog": {"fog": 0.68, "mist": 0.35, "dust": 0.25, "noise": 0.6, "color": Color(0.82, 0.84, 0.86)},
	"thick_fog": {"fog": 0.88, "mist": 0.4, "dust": 0.15, "noise": 0.5, "color": Color(0.84, 0.85, 0.86)},
}

## where a scene's air is when there's no HSAtmosphere (an HSBeam alone): the look's haze
const NO_ATMOSPHERE := {"fog": 0.25, "mist": 0.0, "mist_height": 1.2, "ground": 0.0, "noise": 0.4, "dust": 0.0, "beams": 1.0, "drift": Vector3.ZERO, "wind": Vector3.ZERO}

## the scale the air's noise is read at (1/m: a wisp about 5 m across)
const NOISE_SCALE := 0.18

static var _noise: NoiseTexture3D = null
static var _cookies := {}


## the 3D noise every shader of the air reads (made once: 64³, seamless, smooth simplex in three octaves)
static func noise() -> NoiseTexture3D:
	if _noise == null:
		_noise = NoiseTexture3D.new()
		_noise.width = 64
		_noise.height = 64
		_noise.depth = 64
		_noise.seamless = true
		_noise.normalize = true
		var fn := FastNoiseLite.new()
		fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
		fn.frequency = 0.06
		fn.fractal_octaves = 3
		fn.seed = 11
		_noise.noise = fn
	return _noise


## A flashlight's cookie: its light's projector, and its beam's profile across the cone (radius 1 at the spot's angle).
## - `flashlight`: a reflector's beam, a hot core, a faint ring and a dim spill to a soft edge.
## - `led`: a whiter, flatter core with a sharper edge and a brighter spill.
## - `lantern`: an even wash, soft all the way out.
static func cookie(kind: String) -> ImageTexture:
	if _cookies.has(kind):
		return _cookies[kind]
	var n := 128
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	for y in n:
		for x in n:
			var r := Vector2(x + 0.5 - n * 0.5, y + 0.5 - n * 0.5).length() / (n * 0.5)
			var v := profile(kind, r)
			img.set_pixel(x, y, Color(v, v, v))
	var t := ImageTexture.create_from_image(img)
	_cookies[kind] = t
	return t


## the cookie's brightness at a radius (0 the axis, 1 the spot's angle)
static func profile(kind: String, r: float) -> float:
	var hot := 0.0
	var ring := 0.0
	var spill := 0.0
	match kind:
		"led":
			hot = 1.0 - smoothstep(0.3, 0.46, r)
			ring = 0.12 * exp(-pow((r - 0.5) / 0.03, 2.0))
			spill = 0.3 * (1.0 - smoothstep(0.86, 0.97, r))
		"lantern":
			return 1.0 - 0.85 * smoothstep(0.35, 1.0, r)
		_:
			hot = 1.0 - smoothstep(0.16, 0.34, r)
			ring = 0.22 * exp(-pow((r - 0.4) / 0.035, 2.0))
			spill = 0.2 * (1.0 - smoothstep(0.82, 0.98, r))
	return clampf(maxf(hot, spill) + ring, 0.0, 1.0)


## the scene's atmosphere: the first HSAtmosphere in the tree (one a level; a second waits until the first goes)
static func atmosphere(node: Node) -> Node:
	if node == null or not node.is_inside_tree():
		return null
	return node.get_tree().get_first_node_in_group("hs_atmosphere")


## what a node's scene's air is now: the atmosphere's (its zones' easing included), else NO_ATMOSPHERE over the
## environment's own haze
static func air_of(node: Node) -> Dictionary:
	var a := atmosphere(node)
	if a != null and a.has_method("now"):
		return a.now()
	var out := NO_ATMOSPHERE.duplicate()
	var env := environment_of(node)
	if env != null:
		out["fog"] = level_of(env.volumetric_fog_density) if env.volumetric_fog_enabled else 0.0
	out["density"] = density(out["fog"])
	out["extinction"] = out["density"]
	out["mist_density"] = 0.0
	return out


## the Environment a node's scene is drawn with (the world's, else the first WorldEnvironment's)
static func environment_of(node: Node) -> Environment:
	if node == null or not node.is_inside_tree():
		return null
	var w := node.get_viewport().find_world_3d() if node.get_viewport() != null else null
	if w != null and w.environment != null:
		return w.environment
	var root := node.get_tree().edited_scene_root if Engine.is_editor_hint() else node.get_tree().current_scene
	if root == null:
		root = node.get_tree().root
	for we in root.find_children("*", "WorldEnvironment", true, false):
		if (we as WorldEnvironment).environment != null:
			return (we as WorldEnvironment).environment
	return null


## the eye the air is seen from: the game's camera, or in the editor the 3D view's
static func eye(node: Node) -> Camera3D:
	if node == null or not node.is_inside_tree():
		return null
	if Engine.is_editor_hint():
		var ei = Engine.get_singleton("EditorInterface")
		if ei != null:
			var vp = ei.get_editor_viewport_3d(0)
			if vp != null:
				return vp.get_camera_3d()
		return null
	return node.get_viewport().get_camera_3d()
