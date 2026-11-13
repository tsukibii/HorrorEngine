## An eye's paint, changed in Godot (eyes v3; docs/GODOT_LOOK.md §5v, DECISIONS 2026-11-12, eyes v3: "make it easy to
## modify some things via sliders (different iris shape / patterns, colors etc)"). A Character Studio export's eyeball
## wears its paint baked flat (the iris, the pupil, the limbus, the white) and carries the numbers that made it in its
## record (`studioEye`: the Studio's own names). This node keeps each eye's record, and when one of its numbers is
## changed it draws the paint again with the Studio's own paint shader (eye_paint.gdshaderinc: tools/shared/eye.js's,
## ported) into a small viewport, once, and hands the eye's shader the new picture; what isn't paint (the cornea's
## bend, the catchlights that stay, the white's brightness, the wet gloss) goes straight to the eye's shader. So the
## eye costs what it cost: a picture read behind the cornea, whatever its iris looks like.
##
##   var paint := HSEyePaint.attach(character)          # after HSEye.wear (an HSCharacterLook does both)
##   paint.set_paint({"iris": "#1a4a8a", "iris2": "#7ab0e8", "pattern": "crypts", "pupilShape": "slit"})
##   paint.use_style("violetSun")                       # one of the Studio's eye styles
##   paint.set_paint({"irisSize": 36.0}, "L")           # one eye only
##   paint.reset()                                      # the export's own again
##
## The words are the Studio's (CONTROLS and CHOICES below are its sliders and dropdowns; COLOURS its colours). Headless
## (no renderer) nothing can be drawn: the numbers are kept and the shader's are set, the picture stays the export's.
class_name HSEyePaint
extends Node

signal painted                              ## the eyes wear what was asked (after the frame that drew it)

const PATTERNS := ["natural", "sunburst", "lightning", "nebula", "crypts", "halo"]
const PUPILS := ["round", "heart", "slit", "goat", "star", "diamond", "cross", "crescent", "flower", "ring", "two", "none"]
## the colours: [key, label]
const COLOURS := [["iris", "Iris (rim)"], ["iris2", "Iris (round the pupil)"], ["accent", "Iris accent (the pattern's)"], ["pupilColor", "Pupil"],
		["sclera", "White"], ["corner", "Corner tint"]]
## the dropdowns: [key, label, values]
const CHOICES := [["pattern", "Iris pattern", PATTERNS], ["pupilShape", "Pupil shape", PUPILS]]
## the sliders: [key, label, lowest, highest, step]: the Studio's own (tools/shared/eye.js EYE_CONTROLS), the ones that
## read in a game
const CONTROLS := [
	["irisSize", "Iris size", 20.0, 46.0, 0.5], ["pupil", "Pupil size", 0.12, 0.6, 0.01], ["pupilTurn", "Pupil turn", -180.0, 180.0, 1.0],
	["patternAmt", "Pattern strength", 0.0, 1.0, 0.01], ["burst", "Pattern reach", 0.0, 1.0, 0.01], ["detail", "Pattern detail", 0.0, 1.0, 0.01],
	["fibres", "Iris fibres", 0.0, 1.0, 0.01], ["limbal", "Limbal ring", 0.0, 1.0, 0.01], ["limbalWidth", "Limbal width", 0.05, 0.45, 0.01],
	["limbalSoft", "Iris edge softness", 0.0, 1.0, 0.01], ["irisBright", "Iris brightness", 0.5, 2.5, 0.01], ["caustic", "Iris caustic", 0.0, 1.0, 0.01],
	["veins", "Veins", 0.0, 1.0, 0.01], ["cornerPink", "Corner pink", 0.0, 1.0, 0.01], ["scleraShade", "White's rim shade", 0.0, 1.0, 0.01],
	["whiteBright", "White brightness", 0.2, 1.2, 0.01], ["whiteWarm", "White warmth", -0.8, 0.8, 0.01], ["gloss", "Wet gloss", 0.0, 1.0, 0.01],
	["catchKeep", "Catchlights that stay", 0.0, 2.0, 0.01], ["catch1", "Catchlight", 0.0, 1.0, 0.01], ["catchSize", "Catchlight size", 0.02, 0.45, 0.005],
	["catchX", "Catchlight across", -0.8, 0.8, 0.01], ["catchY", "Catchlight up", -0.8, 0.8, 0.01], ["catch2", "Second catchlight", 0.0, 1.0, 0.01],
	["catch2Size", "Second's size", 0.2, 1.5, 0.01], ["catch2X", "Second across", -0.8, 0.8, 0.01], ["catch2Y", "Second up", -0.8, 0.8, 0.01],
	["catchLine", "Wet line in the cornea", 0.0, 1.0, 0.01], ["catchRoom", "Room lights in the cornea", 0.0, 1.0, 0.01], ["catchGlow", "Catchlights in the dark", 0.0, 4.0, 0.01]]
## the Studio's defaults for what a record doesn't say (tools/shared/eye.js EYE_DEFAULTS and the eyes v3 controls)
const DEFAULTS := {"real": true, "iris": "#3b2618", "iris2": "#7a5a3a", "accent": "#e8a33a", "pupilColor": "#030303", "sclera": "#f4efe9", "corner": "#e08a8a",
		"pattern": "natural", "pupilShape": "round", "irisSize": 31.0, "pupil": 0.31, "fibres": 0.3, "limbal": 0.5, "limbalWidth": 0.18, "limbalSoft": 0.6,
		"scleraShade": 0.4, "socket": 0.35, "cornerPink": 0.35, "gloss": 0.9, "irisDepth": 0.2, "bulge": 1.0, "ior": 1.336, "caustic": 0.6, "irisBright": 1.3,
		"limbusView": 0.5, "veins": 0.2, "patternAmt": 1.0, "burst": 0.55, "detail": 0.5, "pupilTurn": 0.0,
		"catchKeep": 0.0, "catch1": 0.9, "catchSize": 0.17, "catchX": -0.35, "catchY": 0.4, "catch2": 0.5, "catch2Size": 0.6, "catch2X": 0.3, "catch2Y": -0.1,
		"catchLine": 0.0, "catchLineY": -0.86, "catchRoom": 1.0, "catchLit": 6.0, "catchGlow": 0.0, "whiteBright": 0.58, "whiteWarm": 0.35}
## what's in the picture: a change to one of these draws it again (anything else is the eye shader's own number)
const PAINTED := ["iris", "iris2", "accent", "pupilColor", "sclera", "corner", "pattern", "pupilShape", "irisSize", "bulge", "pupil", "fibres", "limbal",
		"limbalWidth", "limbalSoft", "scleraShade", "cornerPink", "veins", "patternAmt", "burst", "detail", "pupilTurn"]
## the eye's shape follows these (the limbus, the cornea's dome, the iris's plane)
const SHAPED := ["irisSize", "bulge", "irisDepth"]
const PLAIN := {"pattern": "natural", "pupilShape": "round", "pupilTurn": 0.0, "patternAmt": 1.0, "burst": 0.55, "detail": 0.5, "pupilColor": "#030303", "accent": "#e8a33a",
		"pupil": 0.31, "fibres": 0.3, "limbal": 0.5, "limbalWidth": 0.18, "irisBright": 1.3, "veins": 0.2}
## the Studio's eye styles (tools/shared/eye.js EYE_STYLES: the colours, the pattern and the pupil set together; each over
## PLAIN, so a style replaces the last one's), and the eyes v3 look's own iris: [title, what it is, settings]
const STYLES := {
	"v3_dark": ["Dark doll (eyes v3)", "a big, very dark red-brown iris the pupil melts into", {"iris": "#170807", "iris2": "#2c100c", "pupil": 0.42, "fibres": 0.12, "limbal": 0.35, "limbalWidth": 0.22, "irisBright": 1.0, "veins": 0.05}],
	"natural": ["Natural brown", "a real brown eye", {"iris": "#3b2618", "iris2": "#7a5a3a"}],
	"steel": ["Steel grey", "a real grey-blue iris: crypts round the pupil, furrows near the rim, a dark limbal ring", {"iris": "#4f5f6e", "iris2": "#a3b1bb", "accent": "#d8e0e6", "pattern": "crypts", "detail": 0.55, "fibres": 0.65, "limbal": 0.8, "limbalWidth": 0.14, "pupil": 0.27}],
	"violetSun": ["Violet sunburst", "violet with an orange-gold burst round the pupil", {"iris": "#4a1694", "iris2": "#7b3fd0", "accent": "#ffa21f", "pattern": "sunburst", "burst": 0.62, "detail": 0.55, "fibres": 0.55, "limbal": 0.55, "pupil": 0.24}],
	"electric": ["Electric violet", "violet with bright pink streaks branching out from the pupil", {"iris": "#3c1188", "iris2": "#6326c9", "accent": "#f6a8ff", "pattern": "lightning", "burst": 0.85, "detail": 0.6, "fibres": 0.35, "limbal": 0.6, "pupil": 0.29}],
	"nebula": ["Nebula", "deep violet clouds, a fiery orange ring round the pupil, specks of light", {"iris": "#35106e", "iris2": "#1a0838", "accent": "#ff9f1c", "pattern": "nebula", "burst": 0.45, "detail": 0.45, "fibres": 0.2, "limbal": 0.65, "pupil": 0.27}],
	"halo": ["Grey-violet halo", "grey-blue with a jagged violet ring round the pupil", {"iris": "#6f7f96", "iris2": "#97a5bb", "accent": "#7a35ff", "pattern": "halo", "burst": 0.45, "detail": 0.6, "fibres": 0.45, "limbal": 0.6, "pupil": 0.28}],
	"amber": ["Amber", "gold, bright round the pupil, in fine rays", {"iris": "#8a5a08", "iris2": "#f0be3c", "accent": "#ffe17a", "pattern": "sunburst", "burst": 0.4, "detail": 0.85, "patternAmt": 0.7, "fibres": 0.75, "limbal": 0.6, "pupil": 0.27}],
	"emerald": ["Emerald", "green with a bright lime burst", {"iris": "#0b5a26", "iris2": "#2fbf5a", "accent": "#b8ff5a", "pattern": "sunburst", "burst": 0.5, "detail": 0.6, "fibres": 0.6, "limbal": 0.65, "pupil": 0.27}],
	"magenta": ["Magenta", "magenta with fine pale streaks", {"iris": "#7a0f5c", "iris2": "#d0359f", "accent": "#ff9be0", "pattern": "lightning", "burst": 0.6, "detail": 0.85, "patternAmt": 0.6, "fibres": 0.6, "limbal": 0.6, "pupil": 0.29}],
	"blood": ["Blood red", "red with a burning centre, bloodshot", {"iris": "#7a0606", "iris2": "#ff2a12", "accent": "#ffb27a", "pattern": "sunburst", "burst": 0.35, "detail": 0.7, "fibres": 0.6, "limbal": 0.85, "limbalWidth": 0.2, "pupil": 0.22, "veins": 0.7}],
	"heart": ["Yandere heart", "pink with a black heart for a pupil", {"iris": "#c9798f", "iris2": "#f0b5c4", "accent": "#fff0f4", "pattern": "crypts", "detail": 0.4, "patternAmt": 0.5, "pupilShape": "heart", "pupil": 0.36, "fibres": 0.45, "limbal": 0.45}],
	"serpent": ["Serpent", "yellow-green with an orange burst and a slit pupil", {"iris": "#7f8a06", "iris2": "#e6d23a", "accent": "#ff7a00", "pattern": "sunburst", "burst": 0.5, "detail": 0.7, "pupilShape": "slit", "pupil": 0.38, "fibres": 0.5, "limbal": 0.7}],
	"starry": ["Starry", "blue with a star for a pupil", {"iris": "#2c5ac4", "iris2": "#86b4ff", "accent": "#e8f2ff", "pattern": "lightning", "burst": 0.7, "detail": 0.5, "patternAmt": 0.6, "pupilShape": "star", "pupil": 0.34, "pupilColor": "#05081a"}],
	"hypnotised": ["Hypnotised", "a hollow ring for a pupil in a pale violet iris", {"iris": "#5b4a8a", "iris2": "#b9a8e8", "accent": "#ffffff", "pattern": "halo", "burst": 0.3, "pupilShape": "ring", "pupil": 0.36, "limbal": 0.7}],
	"possessed": ["Possessed", "milky and pale, no pupil", {"iris": "#bdbcb4", "iris2": "#ecebe4", "accent": "#ffffff", "pattern": "crypts", "patternAmt": 0.35, "pupilShape": "none", "fibres": 0.25, "limbal": 0.35, "veins": 0.45}],
	"polycoria": ["Two pupils", "dark brown with two pupils side by side", {"iris": "#2e1c10", "iris2": "#5f4128", "pupilShape": "two", "pupil": 0.26, "fibres": 0.45}],
}
const EYE_MM := 12.0                        # an adult eyeball's radius; the cornea's front radius (eye.js eyeShape)
const CORNEA_MM := 7.8

@export_range(64, 2048) var size: int = 1024   ## the picture's side (the Studio bakes 1024)
var eyes: Array = []                        # [{mi, surface, material, side, rec (as worn now), rec0 (the export's), paint0 (its picture)}]
var _views: Array = []                      # a viewport and its rect's material an eye
var _waiting := false
var _again := false
var bakes := 0                              ## how many times a picture was drawn (the checks count)


static func of(node: Node) -> HSEyePaint:
	return node.get_node_or_null("HSEyePaint") as HSEyePaint if node != null else null


## the painter under a character whose eyes are on the Studio's eye (HSEye.wear first); null when it has none
static func attach(node: Node) -> HSEyePaint:
	if node == null:
		return null
	var p := of(node)
	if p == null:
		p = HSEyePaint.new()
		p.name = "HSEyePaint"
		node.add_child(p)
	p.find(node)
	if p.eyes.is_empty():
		p.queue_free()
		return null
	return p


## the eyes under a node: every surface on the eye's shader that carries its record (HSEye.apply leaves it in the
## material's meta)
func find(node: Node) -> void:
	var known := {}
	for e in eyes:
		known[e["material"]] = true
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		for s in mi.mesh.get_surface_count():
			var m = mi.get_surface_override_material(s)
			if not (m is ShaderMaterial) or m.shader != HSEye.shader() or not m.has_meta("hs_eye") or known.has(m):
				continue
			var rec: Dictionary = m.get_meta("hs_eye")["rec"]
			var side := str(rec.get("side", "R" if String(mi.name).ends_with("_R") else "L"))
			eyes.append({"mi": mi, "surface": s, "material": m, "side": side, "rec": rec.duplicate(true), "rec0": rec.duplicate(true), "paint0": m.get_shader_parameter("paint")})


## an eye's numbers now, every one the Studio has (the record's over the defaults)
func paint(side: String = "L") -> Dictionary:
	for e in eyes:
		if e["side"] == side or side == "both":
			var out := DEFAULTS.duplicate()
			out.merge(e["rec"].get("paint", {}), true)
			return out
	return DEFAULTS.duplicate()


## change some of an eye's numbers (the Studio's names; a colour a Color or "#rrggbb"); `side` "L", "R" or "both"
func set_paint(changes: Dictionary, side: String = "both") -> void:
	var redraw := false
	for e in eyes:
		if side != "both" and e["side"] != side:
			continue
		var p: Dictionary = e["rec"].get("paint", {})
		var reshape := false
		for k in changes:
			var v = changes[k]
			if v is Color:
				v = "#" + (v as Color).to_html(false)
			if p.get(k, DEFAULTS.get(k)) == v:
				continue
			p[k] = v
			redraw = redraw or PAINTED.has(k)
			reshape = reshape or SHAPED.has(k)
		e["rec"]["paint"] = p
		if reshape:
			e["rec"]["shape"] = shape_of(paint(e["side"]), float(e["rec0"].get("shape", {}).get("k", 1.0)))
		_apply(e)
	if redraw:
		_ask()
	else:
		painted.emit.call_deferred()


## the eyes' pictures drawn again from their numbers as they are (EYESV3 holds Godot's picture of an export's own
## record against the one the Studio baked into it)
func redraw() -> void:
	_ask()


## one of the Studio's eye styles (STYLES): its colours, pattern and pupil together, over the plain ones
func use_style(style: String, side: String = "both") -> void:
	if STYLES.has(style):
		var st := PLAIN.duplicate()
		st.merge(STYLES[style][2], true)
		set_paint(st, side)


## the export's own eyes again
func reset(side: String = "both") -> void:
	for e in eyes:
		if side != "both" and e["side"] != side:
			continue
		e["rec"] = e["rec0"].duplicate(true)
		_apply(e)
		e["material"].set_shader_parameter("paint", e["paint0"])
		e["material"].set_shader_parameter("mesh_shape", Vector3(-1.0, 0.0, 0.0))
	painted.emit.call_deferred()


## what differs from the export's own, an eye (a look's `eye_paint`: what to hand set_paint to get this eye again)
func changes(side: String = "L") -> Dictionary:
	var out := {}
	for e in eyes:
		if e["side"] != side:
			continue
		var p0: Dictionary = e["rec0"].get("paint", {})
		var p: Dictionary = e["rec"].get("paint", {})
		for k in p:
			if p[k] != p0.get(k, DEFAULTS.get(k)):
				out[k] = p[k]
	return out


## the eye's shape in eye units for an eyeball `k` times 12 mm (tools/shared/eye.js eyeShape): the limbus (rho and its
## plane zl), the cornea's dome (zc, rc), the iris's plane (zi)
static func shape_of(p: Dictionary, k: float = 1.0) -> Dictionary:
	var R := EYE_MM * k
	var rho: float = minf(0.95, EYE_MM * sin(deg_to_rad(float(p.get("irisSize", 31.0)))) / R)
	var zl := sqrt(1.0 - rho * rho)
	var cap := 1.0 - zl
	var ra := CORNEA_MM / R
	var adult := ra - sqrt(maxf(0.0, ra * ra - rho * rho))
	var h: float = maxf(1e-4, cap + float(p.get("bulge", 1.0)) * (adult - cap))
	var rc := (rho * rho + h * h) / (2.0 * h)
	return {"rho": rho, "zl": zl, "zc": zl + h - rc, "rc": rc, "zi": zl - float(p.get("irisDepth", 0.2)) / R, "angle": asin(rho), "k": k}


## the paint shader's uniforms for an eye's numbers and shape (eye.js setUniforms: the same packing)
static func uniforms(p: Dictionary, s: Dictionary, side: String) -> Dictionary:
	var q := DEFAULTS.duplicate()
	q.merge(p, true)
	var col := func(k: String) -> Vector3:
		var c := Color.html(str(q[k])) if Color.html_is_valid(str(q[k])) else Color.html(str(DEFAULTS[k]))
		return Vector3(c.r, c.g, c.b)
	var real: bool = not (q.get("real") is bool and q["real"] == false)
	return {"uIris": col.call("iris"), "uIris2": col.call("iris2"), "uSclera": col.call("sclera"), "uCorner": col.call("corner"),
		"uAccent": col.call("accent"), "uPupilCol": col.call("pupilColor"),
		"uPaint": Vector4(float(s.get("angle", 0.541)), float(q["pupil"]), float(q["fibres"]), float(q["limbal"])),
		"uPaint2": Vector4(float(q["limbalWidth"]), float(q["limbalSoft"]), float(q["scleraShade"]), float(q["cornerPink"])),
		"uPaint3": Vector4(float(q["veins"]), float(q["limbusView"]), -1.0 if side == "L" else 1.0, 1.0 if real else 0.0),
		"uShape": Vector4(float(s.get("rho", 0.5)), float(s.get("zl", 0.866)), float(s.get("zc", 0.4)), float(s.get("rc", 0.65))),
		"uPat": Vector4(maxf(0.0, PATTERNS.find(str(q["pattern"]))), float(q["patternAmt"]), float(q["burst"]), float(q["detail"])),
		"uPup": Vector4(maxf(0.0, PUPILS.find(str(q["pupilShape"]))), deg_to_rad(float(q["pupilTurn"])), 0.0, 0.0)}


## the record onto the eye's shader (its numbers), and the mesh's own shape kept apart when the eye drawn has changed
func _apply(e: Dictionary) -> void:
	var m: ShaderMaterial = e["material"]
	var was: Dictionary = m.get_meta("hs_eye", {})
	HSEye.apply(m, e["rec"], bool(was.get("wet", false)), was.get("over", {}))
	var s0: Dictionary = e["rec0"].get("shape", {})
	var s: Dictionary = e["rec"].get("shape", {})
	var same: bool = is_equal_approx(float(s0.get("rho", 0.5)), float(s.get("rho", 0.5))) and is_equal_approx(float(s0.get("rc", 0.65)), float(s.get("rc", 0.65)))
	m.set_shader_parameter("mesh_shape", Vector3(-1.0, 0.0, 0.0) if same else Vector3(float(s0.get("rho", 0.5)), float(s0.get("zc", 0.4)), float(s0.get("rc", 0.65))))


func _ask() -> void:
	if _waiting:
		_again = true
		return
	_waiting = true
	_draw.call_deferred()


## each eye's paint drawn into its viewport this frame, read back once it's drawn, given its mips and worn
func _draw() -> void:
	if not is_inside_tree() or DisplayServer.get_name() == "headless":
		_waiting = false
		painted.emit()
		return
	while _views.size() < eyes.size():
		var vp := SubViewport.new()
		vp.size = Vector2i(size, size)
		vp.disable_3d = true
		vp.transparent_bg = false
		vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
		var rect := ColorRect.new()
		rect.size = Vector2(size, size)
		var mat := ShaderMaterial.new()
		mat.shader = load("res://addons/horrorstudio_look/eye_paint.gdshader")
		rect.material = mat
		vp.add_child(rect)
		add_child(vp)
		_views.append({"vp": vp, "mat": mat, "rect": rect})
	for i in eyes.size():
		var e: Dictionary = eyes[i]
		var v: Dictionary = _views[i]
		if v["vp"].size.x != size:
			v["vp"].size = Vector2i(size, size)
			v["rect"].size = Vector2(size, size)
		var u := uniforms(e["rec"].get("paint", {}), e["rec"].get("shape", {}), e["side"])
		for k in u:
			v["mat"].set_shader_parameter(k, u[k])
		v["vp"].render_target_update_mode = SubViewport.UPDATE_ONCE
	await RenderingServer.frame_post_draw
	if not is_inside_tree():
		return
	for i in eyes.size():
		var img: Image = _views[i]["vp"].get_texture().get_image()
		if img == null or img.is_empty():
			continue
		img.convert(Image.FORMAT_RGB8)
		img.generate_mipmaps()
		eyes[i]["material"].set_shader_parameter("paint", ImageTexture.create_from_image(img))
	bakes += 1
	_waiting = false
	if _again:
		_again = false
		_ask()
	else:
		painted.emit()
