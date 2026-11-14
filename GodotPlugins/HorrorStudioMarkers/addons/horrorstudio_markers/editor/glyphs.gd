@tool
## The tab's drawings: one small picture a kind of marker and a few for its buttons, each a few SVG strokes on a
## 24-unit grid, rasterised once at the editor's scale and kept (the Director plugin's way). Nothing is imported.
##     Glyphs.icon("walk", Color.WHITE, 18)
extends RefCounted

const G := {
	"appear": '<path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
	"walk": '<circle cx="13" cy="4.5" r="1.8"/><path d="M13 7.5l-3 4.5 3 2.5-1 6M10 12l-3 1.5M13 14.5l3.5 5.5M11.5 9l3.5 2 2.5-.5"/>',
	"run": '<circle cx="15" cy="4.5" r="1.8"/><path d="M14 7.5l-4 3 .5 3 3.5 1.5-2 5.5M10 10.5l-3.5-.5M14 15l4 1 1.5 4M13.5 8.5l3.5 2.5 3-.5M4 14h3M3 17.5h4"/>',
	"wait": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
	"talk": '<path d="M4 5.5h16v10.5H11l-4.5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
	"sit": '<path d="M7 3.5v10h9.5M7 13.5V20M16.5 13.5V20M7 9.5h7"/>',
	"sleep": '<path d="M3 18v-8M3 15h18v3M21 15v-2.5a2.5 2.5 0 0 0-2.5-2.5H10v5"/><circle cx="6.5" cy="12" r="1.6"/><path d="M14 3h4l-4 4.5h4"/>',
	"grab": '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 6.5-6 6.5-3 0-4.5-1.5-6.5-5l-1.2-2.3a1.4 1.4 0 0 1 2.4-1.4L8 14"/>',
	"pick_up": '<path d="M12 14V4M8 8l4-4 4 4"/><rect x="5" y="15" width="14" height="5.5" rx="1"/>',
	"put_down": '<path d="M12 3v10M8 9l4 4 4-4"/><rect x="5" y="15" width="14" height="5.5" rx="1"/>',
	"open": '<path d="M5 21V3h10v18M3 21h18M15 5.5l4 1.5v14"/><circle cx="12" cy="12.5" r="0.9"/>',
	"animation": '<circle cx="8" cy="17.5" r="2.5"/><circle cx="17" cy="15.5" r="2.5"/><path d="M10.5 17.5V6l9-2v11.5M10.5 9.5l9-2"/>',
	"event": '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
	"scare": '<path d="M5 21V10.5a7 7 0 0 1 14 0V21l-2.4-2-2.3 2-2.3-2-2.3 2-2.3-2z"/><circle cx="9.5" cy="10.5" r="1.2"/><circle cx="14.5" cy="10.5" r="1.2"/>',
	"disappear": '<path d="M5 21V10.5a7 7 0 0 1 14 0V21l-2.4-2-2.3 2-2.3-2-2.3 2-2.3-2z" stroke-dasharray="2.6 2.6"/>',
	"choice": '<path d="M12 21v-7M12 14L6 8V3.5M12 14l6-6V3.5M3.5 6L6 3.5 8.5 6M15.5 6L18 3.5 20.5 6"/>',
	"way": '<path d="M5 12h13M13 7l5 5-5 5"/>',
	"repeat": '<path d="M17 3l3.5 3.5L17 10M20.5 6.5H8a4.5 4.5 0 0 0-4.5 4.5v1M7 21l-3.5-3.5L7 14M3.5 17.5H16a4.5 4.5 0 0 0 4.5-4.5v-1"/>',
	"look": '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>',
	"face": '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><circle cx="9" cy="10" r="0.8"/><circle cx="15" cy="10" r="0.8"/>',
	"eye": '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
	"eye_off": '<path d="M2 12s3.6-6.5 10-6.5c1.6 0 3 .4 4.3 1M22 12s-3.6 6.5-10 6.5c-1.6 0-3-.4-4.3-1M3.5 3.5l17 17"/>',
	"solo": '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
	"plus": '<path d="M12 5v14M5 12h14"/>',
	"trash": '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14M10 10.5v6M14 10.5v6"/>',
	"play": '<path d="M7 4.5v15l12-7.5z"/>',
	"stop": '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
	"warn": '<path d="M12 3.5L2.5 20h19zM12 10v5M12 17.5v.5"/>',
	"target": '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
	"edit": '<path d="M4 20l1-4.5L16.5 4l3.5 3.5L8.5 19zM14 6.5L17.5 10"/>',
	"person": '<circle cx="12" cy="7" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
	"flag": '<path d="M5 21V4M5 4.5h12l-2.5 4 2.5 4H5"/>',
	"logic": '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.500" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M8.500 6.5h3.500l3.500 5.500M8.500 17.500h3.500l3.500-5.500"/>',
	"note": '<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 15.500h7M9 8.500h3"/>',
	"food": '<path d="M12 7c-3-2.500-7.500-.5-7.500 4.500 0 4.500 3 9 5.500 9 1 0 1.500-.5 2-.5s1 .5 2 .5c2.500 0 5.500-4.500 5.500-9 0-5-4.500-7-7.500-4.500zM12 7c0-2 1-3.500 3-4"/>',
	"area": '<path d="M3.500 8.500L12 4l8.500 4.500v8L12 21l-8.500-4.500zM3.500 8.500L12 13l8.500-4.500M12 13v8" stroke-dasharray="3 2.2"/>',
	"checkpoint": '<path d="M6 21V3.500M6 4h12.500l-3 4.500 3 4.500H6"/><path d="M9.500 7l1.800 1.800L14.500 6"/>',
	"task": '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 12.500l3 3 5.500-6.500"/>',
	"carry": '<path d="M5 9h14l-1.200 11H6.200zM8.500 9V7a3.500 3.500 0 0 1 7 0v2"/>',
	"markers": '<path d="M8 20s-4.5-4.2-4.5-7.8a4.5 4.5 0 0 1 9 0C12.500 15.800 8 20 8 20z"/><circle cx="8" cy="12" r="1.4"/><path d="M14 20.5c3 0 5-1.500 5-3.500s-2-2.500-3.500-3.500S14 11 15.500 9.500s3.500-1.200 5-1.200"/>',
	"up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
	"down": '<path d="M12 5v14M6 13l6 6 6-6"/>',
}
const FILLED := ["play", "stop"]

static var _cache := {}


static func scale() -> float:
	return EditorInterface.get_editor_scale() if Engine.is_editor_hint() else 1.0


## a marker's drawing by its kind and what it does
static func of_marker(m: Node) -> String:
	if m is HSNpcWay:
		return "way"
	if not (m is HSNpcMarker):
		return "markers"
	var mk := m as HSNpcMarker
	match mk.kind:
		"walk":
			return "run" if mk.pace == "run" else "walk"
		"wait":
			return "talk" if mk.talk and mk.stay == "talked" else "wait"
		"grab":
			return mk.action if G.has(mk.action) else "grab"
		"event":
			return "scare" if mk.scare else ("look" if (mk.look != "" or mk.look_skin != "" or mk.look_eyes != "") and mk.fire.is_empty() else "event")
	return mk.kind if G.has(mk.kind) else "event"


static func icon(name: String, color = Color.WHITE, px: int = 16) -> Texture2D:
	var col := Color(color) if color is String else color as Color
	var size := int(round(px * scale()))
	var key := "%s|%s|%d" % [name, col.to_html(), size]
	if _cache.has(key):
		return _cache[key]
	var body: String = G.get(name, G["event"])
	var hex := "#" + col.to_html(false)
	var fill := hex if name in FILLED else "none"
	var svg := '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="%s" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" opacity="%.2f">%s</g></svg>' % [fill, hex, col.a, body]
	var img := Image.new()
	if img.load_svg_from_string(svg, float(size) / 24.0) != OK:
		img = Image.create(size, size, false, Image.FORMAT_RGBA8)
	var tex := ImageTexture.create_from_image(img)
	_cache[key] = tex
	return tex


## a flat rounded box (the tab's panels and chips)
static func box(bg: Color, radius := 6, pad := 6, border := Color(0, 0, 0, 0), border_w := 0) -> StyleBoxFlat:
	var s := scale()
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(int(radius * s))
	sb.set_content_margin_all(pad * s)
	sb.border_color = border
	sb.set_border_width_all(int(border_w * s) if border_w > 0 else 0)
	return sb
