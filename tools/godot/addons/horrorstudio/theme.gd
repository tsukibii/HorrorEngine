## The HUD's themes (STORY_FORMAT §9: `game.ui_theme`; the desk's play/ui/themes/<name>.css, ported as Godot Themes):
## `glass` (barely-there frosted glass, the default), `glass-rose` (the same in warm romance colours), `neumorph`
## (the older light kit: pale surfaces, dark text, one blue accent), `plain` (the desk's dark greybox look). A theme
## is colours, a surface, a border and radii; the HUD and the pause menu take everything from it.
extends RefCounted

const THEMES := {
	"glass": {"text": Color(1.0, 0.98, 0.94, 0.93), "muted": Color(1.0, 0.98, 0.94, 0.58), "accent": Color("#cfe6ff"), "who": Color("#f6f1e8"), "bad": Color("#ff8c84"),
		"surface": Color(1, 1, 1, 0.06), "border": Color(1, 1, 1, 0.14), "radius": 12, "radius_l": 18, "shadow": true, "dark": Color(0.01, 0.012, 0.02, 0.9),
		"key_bg": Color(1, 1, 1, 0.12), "key_text": Color("#fffaf0"), "scrim": Color(0.016, 0.024, 0.04, 0.62), "font": "serif"},
	"neumorph": {"text": Color("#4f5a6b"), "muted": Color("#8c96a6"), "accent": Color("#4f9bf0"), "who": Color("#4f5a6b"), "bad": Color("#e0645a"),
		"surface": Color("#e6e9ef"), "border": Color(1, 1, 1, 0.0), "radius": 16, "radius_l": 26, "shadow": false, "dark": Color(0.08, 0.1, 0.15, 0.7),
		"key_bg": Color("#edf0f5"), "key_text": Color("#4f5a6b"), "scrim": Color(0, 0, 0, 0), "font": "sans"},
	"plain": {"text": Color("#e8e4dc"), "muted": Color("#9a978f"), "accent": Color("#e8c27a"), "who": Color("#e8e4dc"), "bad": Color("#e06a5a"),
		"surface": Color(0.094, 0.094, 0.11, 0.82), "border": Color(1, 1, 1, 0.0), "radius": 10, "radius_l": 16, "shadow": true, "dark": Color(0, 0, 0, 0.88),
		"key_bg": Color(1, 1, 1, 0.1), "key_text": Color("#e8e4dc"), "scrim": Color(0, 0, 0, 0.5), "font": "sans"},
}


static func colors(name: String) -> Dictionary:
	var base: String = "glass" if name.begins_with("glass") else name
	var c: Dictionary = THEMES.get(base, THEMES["glass"]).duplicate()
	if name == "glass-rose":                      # the glass, warmer: blush accents, a rose scrim, a gentler red
		c["accent"] = Color("#ffd0dc")
		c["who"] = Color("#ffe6ec")
		c["bad"] = Color("#ff9fb2")
		c["scrim"] = Color(0.125, 0.04, 0.08, 0.58)
	return c


static func box(c: Dictionary, radius: int, bg = null, border = null) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = c["surface"] if bg == null else bg
	sb.set_corner_radius_all(radius)
	var bc: Color = c["border"] if border == null else border
	if bc.a > 0:
		sb.set_border_width_all(1)
		sb.border_color = bc
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 9
	sb.content_margin_bottom = 9
	if c["shadow"]:
		sb.shadow_color = Color(0, 0, 0, 0.22)
		sb.shadow_size = 8
		sb.shadow_offset = Vector2(0, 4)
	return sb


## the Theme a HUD wears: labels in the theme's text, panels its surface, buttons its keys, bars its accent
static func make(name: String) -> Theme:
	var c := colors(name)
	var t := Theme.new()
	t.set_color("font_color", "Label", c["text"])
	t.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0.85 if c["shadow"] else 0.0))
	t.set_constant("shadow_offset_y", "Label", 1)
	t.set_constant("shadow_outline_size", "Label", 2 if c["shadow"] else 0)
	t.set_stylebox("panel", "PanelContainer", box(c, c["radius_l"]))
	t.set_stylebox("normal", "Button", box(c, c["radius"], c["key_bg"], c["border"]))
	t.set_stylebox("hover", "Button", box(c, c["radius"], Color(c["key_bg"].r, c["key_bg"].g, c["key_bg"].b, min(1.0, c["key_bg"].a + 0.08)), c["border"]))
	t.set_stylebox("pressed", "Button", box(c, c["radius"], c["accent"], c["border"]))
	t.set_stylebox("focus", "Button", box(c, c["radius"], Color(c["accent"].r, c["accent"].g, c["accent"].b, 0.25), c["accent"]))
	t.set_color("font_color", "Button", c["key_text"])
	t.set_color("font_hover_color", "Button", c["accent"])
	t.set_color("font_pressed_color", "Button", c["text"])
	var bar_bg := StyleBoxFlat.new()
	bar_bg.bg_color = Color(1, 1, 1, 0.12)
	bar_bg.set_corner_radius_all(2)
	var bar_fill := StyleBoxFlat.new()
	bar_fill.bg_color = c["accent"]
	bar_fill.set_corner_radius_all(2)
	t.set_stylebox("background", "ProgressBar", bar_bg)
	t.set_stylebox("fill", "ProgressBar", bar_fill)
	return t
