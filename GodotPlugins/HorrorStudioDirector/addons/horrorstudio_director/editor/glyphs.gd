@tool
extends RefCounted
## The panel's pictures (editor/build_tab.gd): a line drawing for each card and category, on a tinted tile, made from
## SVG at the editor's scale (Image.load_svg_from_string), so nothing is imported and every size is sharp. The drawings
## are on a 24-unit grid, strokes 1.8 (the design's, docs/GODOT_DIRECTOR.md §6e).

const COLORS := {
	"blue": {"bg": "#243447", "fg": "#9CCBFA", "bg_on": "#35506F", "fg_on": "#CFE5FB"},
	"amber": {"bg": "#3E3221", "fg": "#F3C27A", "bg_on": "#5A4526", "fg_on": "#FFD9A0"},
	"grey": {"bg": "#22272E", "fg": "#8A93A1", "bg_on": "#2E3440", "fg_on": "#C9CED6"},
}

const G := {
	"player": '<circle cx="12" cy="5" r="2.5"/><path d="M12 8v6M9 21l3-7 3 7M8 11h8"/>',
	"test_start": '<circle cx="9" cy="5" r="2.5"/><path d="M9 8v6M6 21l3-7 3 7M5 11h8"/><path d="M15.5 14.5v6l5-3z"/>',
	"checkpoint": '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
	"door": '<path d="M6 21V4h12v17M3 21h18"/><path d="M14.5 12v1"/>',
	"locked_door": '<path d="M5 21V4h10v17M3 21h14"/><rect x="15" y="12" width="6" height="5" rx="1"/><path d="M16.5 12v-1.5a1.5 1.5 0 0 1 3 0V12"/>',
	"room": '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 12h7M14 12h7"/>',
	"room_big": '<rect x="2" y="4" width="20" height="16" rx="1"/><path d="M2 12h6M12 12h10"/>',
	"corridor": '<rect x="8" y="2" width="8" height="20" rx="1"/><path d="M8 9h3M13 15h3"/>',
	"window": '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 4v16M4 12h16"/>',
	"level": '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
	"cube": '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
	"bulb": '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
	"switch": '<rect x="7" y="3" width="10" height="18" rx="2"/><rect x="10" y="7" width="4" height="6" rx="1"/>',
	"breaker": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8v8M15 8v8M8 11h2M14 13h2"/>',
	"flashlight": '<path d="M3 10h8l4-3v10l-4-3H3z"/><path d="M18 9l3-1M18 12h3.5M18 15l3 1"/>',
	"key": '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
	"note": '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
	"inspect": '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
	"wardrobe": '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M12 3v18M10 11v2M14 11v2"/>',
	"chair": '<path d="M7 3v9h10V3"/><path d="M6 12h12v3H6zM7 15v6M17 15v6"/>',
	"bed": '<path d="M3 18V9h4v9M7 12h11a3 3 0 0 1 3 3v3M3 18h18"/>',
	"kettle": '<path d="M7 20.5h10l-1.2-9.5H8.2z"/><path d="M8.6 11V9.2h6.8V11M12 9.2V7.8"/><path d="M8 13H5.2v5.2h2.3"/><path d="M15.9 13.6l3.8-3.2"/>',
	"whistle_kettle": '<path d="M4 20h16"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/><path d="M9 11.5a3 3 0 0 1 6 0"/><path d="M17.5 16l3.5-3"/>',
	"tetsubin": '<path d="M5 15a7 5 0 0 0 14 0c0-2.8-3.1-5-7-5s-7 2.2-7 5z"/><path d="M7 10c0-4 10-4 10 0"/><path d="M19 14l2.5-1.5"/>',
	"hob": '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="12" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/>',
	"gas_hob": '<circle cx="12" cy="16" r="5"/><path d="M12 4c.8 1.5 2 2.3 2 3.8a2 2 0 0 1-4 0c0-1.1.8-1.7 1.2-2.6.2.7.4 1 .8 1.2 0-1.2-.2-1.7 0-2.4z"/>',
	"pot": '<path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M3 11h2M19 11h2M6 7.5h12M11 5.5h2"/>',
	"cup": '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c1 1-1 2 0 3M12 3.5c1 1-1 2 0 3"/>',
	"teapot": '<path d="M6 11h10v3a5 5 0 0 1-10 0z"/><path d="M8 11a3 3 0 0 1 6 0"/><path d="M16 12.5l4-3"/><path d="M6 12H4.5a2 2 0 0 0 0 4h2"/>',
	"coffee": '<path d="M7 8h10l-1.3 12H8.3z"/><path d="M6 8h12M7.5 8l.7-3h7.6l.7 3M7.6 12.5h8.8"/>',
	"rice_cooker": '<path d="M4 11h16v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M5 11a7 4 0 0 1 14 0"/><path d="M11 15.5h2"/>',
	"fridge": '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M6 10h12M9 5.5v2M9 13v3"/>',
	"tap": '<path d="M5 10h8a4 4 0 0 1 4 4v1.5"/><path d="M9 10V7M6.5 7h5"/><path d="M17 18.5c.8 1 .8 2 0 2.5-.8-.5-.8-1.5 0-2.5z"/>',
	"flame": '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5.5.3 1.5 1 2.5 2 3 0-3-.5-5.5.5-7.5z"/>',
	"candle": '<path d="M9 21h6V10H9z"/><path d="M12 10V8"/><path d="M12 3c1 1.5 1.8 2.4 1.8 3.4a1.8 1.8 0 0 1-3.6 0C10.2 5.4 11 4.5 12 3z"/>',
	"cigarette": '<rect x="2.5" y="13" width="16" height="4" rx="1"/><path d="M15 13v4M20.5 13v4"/><path d="M19 4c1 1-1 2 0 3s-1 2 0 3"/>',
	"lighter": '<rect x="7" y="9" width="10" height="12" rx="2"/><path d="M7 13h10"/><path d="M12 3c1 1.5 1.6 2.3 1.6 3.2a1.6 1.6 0 0 1-3.2 0C10.4 5.3 11 4.5 12 3z"/>',
	"incense": '<path d="M12 21V12M8 21h8"/><path d="M12 10c-2-1.5 2-3 0-4.5s2-2.5 0-3.5"/>',
	"coil": '<path d="M12 12a1.5 1.5 0 1 1 1.5 1.5A3 3 0 1 1 15 10.5a4.5 4.5 0 1 1-6 6 6 6 0 1 1 9-7.5"/>',
	"phone": '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
	"tv": '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 21h6M12 17v4"/>',
	"clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
	"keypad": '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" stroke-width="2.8"/>',
	"slot": '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.2"/><path d="M12 12.2V16"/>',
	"die": '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01" stroke-width="2.8"/>',
	"box": '<path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v9"/>',
	"cards": '<rect x="3.5" y="6" width="9" height="13" rx="1.5" transform="rotate(-10 8 12.5)"/><rect x="11.5" y="5" width="9" height="13" rx="1.5" transform="rotate(8 16 11.5)"/>',
	"stain": '<path d="M7 14c-2-1-2-4 0-5 1-3 5-4 7-2 3-1 6 1 5 4 2 2 0 5-3 5-2 2-6 2-7 0-1 0-2-1-2-2z"/>',
	"person": '<circle cx="12" cy="7" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
	"watcher": '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
	"area": '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
	"area_safe": '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/><path d="M12 8l3 1.2v2.6c0 2-1.4 3.2-3 4-1.6-.8-3-2-3-4V9.2z"/>',
	"spot": '<path d="M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11z"/><circle cx="12" cy="10" r="2"/>',
	"path": '<path d="M5 19c4 0 3-7 7-7s3-7 7-7" stroke-dasharray="2 3"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/>',
	"scare": '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
	"knock": '<path d="M5 21V4h9v17"/><path d="M17 9c1 1 1 3 0 4M19.5 7c2 2 2 6 0 8"/>',
	"lights_die": '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/><path d="M4 4l16 16"/>',
	"door_slam": '<path d="M5 21V4h9v17"/><path d="M17 8h4M17 12h3M17 16h4"/>',
	"whisper": '<path d="M5 5h14v10H10l-4 4v-4H5z"/><path d="M9 10h.01M12 10h.01M15 10h.01" stroke-width="2.6"/>',
	"thought": '<path d="M8 15a4 4 0 1 1 1.5-7.7A5 5 0 0 1 19 9a3.5 3.5 0 0 1-1 6.8z"/><path d="M7 19.5h.01M5 21.5h.01" stroke-width="2.6"/>',
	"check": '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.4"/>',
	"search": '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
	"cross": '<path d="M6 6l12 12M18 6L6 18"/>',
	"click": '<path d="M5 3l14 7-6 2-2 6z"/>',
	"drag": '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
	"target": '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
}
const FILLED := {"play": '<path d="M7 4.5v15l12.5-7.5z"/>'}

static var _cache := {}


## the editor's scale (1 on a plain screen, 2 on a HiDPI one)
static func scale() -> float:
	return EditorInterface.get_editor_scale() if Engine.is_editor_hint() else 1.0


## a drawing alone, `px` pixels square at the editor's scale, in a colour
static func icon(name: String, color: String, px := 16) -> Texture2D:
	return _svg(name, color, "", px, false)


## a drawing on its tile (a rounded square of the tint's background), `px` pixels square at the editor's scale
static func tile(name: String, tint := "blue", on := false, px := 40) -> Texture2D:
	var c: Dictionary = COLORS.get(tint, COLORS["blue"])
	return _svg(name, c["fg_on" if on else "fg"], c["bg_on" if on else "bg"], px, true)


static func _svg(name: String, fg: String, bg: String, px: int, tiled: bool) -> Texture2D:
	var size := int(round(px * scale()))
	var key := "%s|%s|%s|%d" % [name, fg, bg, size]
	if _cache.has(key):
		return _cache[key]
	var body: String
	if FILLED.has(name):
		body = '<g fill="%s">%s</g>' % [fg, FILLED[name]]
	else:
		body = '<g fill="none" stroke="%s" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">%s</g>' % [fg, G.get(name, G["cube"])]
	var svg: String
	if tiled:                                          # the drawing at 55% of the tile, centred
		svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="%s"/><g transform="translate(9 9) scale(0.9167)">%s</g></svg>' % [bg, body]
	else:
		svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">%s</svg>' % body
	var img := Image.new()
	var base := 40.0 if tiled else 24.0
	if img.load_svg_from_string(svg, float(size) / base) != OK:
		return null
	var tex := ImageTexture.create_from_image(img)
	_cache[key] = tex
	return tex
