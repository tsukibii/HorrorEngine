## The guide marker (STORY_FORMAT §4, a `todo`'s `guide`; the user, 2026-11-02: "a helper… so players can see the
## object… the ui should lightly bounce up and down in a fluid hypnotic motion… optional", then "simplify the ui… the
## duller version… more like a vectorish style"; and 2026-11-08, ui-v3: "so even if it's in another room we can roughly
## see it (but it's more faint, and gets less transparent the closer we get), keep it the diamond shape… without making
## it distract from the horror vibe"): over what an open task needs (a thing, a person, an area), a flat glyph in the HUD
## theme's own accent: a diamond's outline, its corners softly rounded, one stroke width, on a short stem that fades out
## toward the thing. No glow, no pulsing; the whole glyph bobs on a slow sine, each marker on its own phase.
##
## How strongly it shows is one rule, read the same everywhere: the nearer, the clearer. A clear view of it at three
## metres is nearly opaque; across a room it's half that; far off it holds a faint floor (a ghost you can find with the
## corner of your eye) and only gives up at 70 m. Out of sight (a wall, a shut door between: play.gd's `sight`) it's the
## same curve at about half again as faint, small and bare (no stem, no inner line), so you can tell it's in the next room
## and roughly where. Closer than seven metres, in view, it takes a finer line inside the outline and the thing's name
## over it (a person's, an item's, a note's title: whatever the cursor would call it), and it steps back a little when
## it is the very thing you're looking at (the prompt says what it is then).
##
## Off the screen (behind you, to a side) a small diamond with a chevron rides an ellipse near the screen's edge on the
## way to it, fainter still, and only once it has been out of view for a moment, so a glance away never flashes one.
##
## The player's setting (the pause menu's Quest marker): 0 off, 1 subtle (the above), 2 clear (stronger, the names from
## farther, the pointer at once). Drawn on the HUD from the camera each frame (play.gd guide_points and guide_ctx): hidden
## behind the menu and the held scenes with the rest of the HUD, back off a card or a choice, fading in as its task opens
## (rising a little into place) and out, a touch smaller, once it's done.
extends Control

const PERIOD := 2.6            # seconds a bob: slow enough to read as breathing, not bouncing
const BOB := 5.0               # pixels up and down (at 1080 lines)
const LIFT := 0.32             # metres the glyph hangs over the thing's top
const NEAR := 3.0              # metres: as strong as it gets inside this
const FAINT_AT := 36.0         # metres: where it settles to its faint floor
const FADE_FROM := 46.0        # metres: and from here it fades away...
const FAR := 72.0              # ...gone by here
const A_NEAR := 0.90           # how opaque in clear view up close
const A_FAR := 0.20            # and at the faint floor
const HIDDEN := 0.55           # out of sight (another room): this much of what it'd be in the open
const TAKEN := 0.62            # the thing the cursor is on (its prompt says what it is): this much
const DETAIL_FROM := 7.0       # metres: the fine inner line and the name come in inside this (clear: from 14 m)
const ORBIT := Vector2(0.43, 0.39)   # the pointer's ellipse, as a share of the screen's width and height from its middle
const POINTER_AFTER := 1.1     # seconds out of view before its pointer comes (clear: none)

var accent := Color("#cfe6ff") # the HUD theme's accent (hud.gd sets it), drawn as it is
var text_color := Color(1.0, 0.98, 0.94)  # and the theme's text, for the name
var mode := 1                  # the player's setting: 0 off, 1 subtle, 2 clear (menu.gd apply)
var modal := false             # a card or a choice is up: the marks step back (hud.gd modal)
var t := 0.0
## id -> {k: how shown 0..1, top: the thing's top on the screen, above: where the glyph hangs, d: metres, gem: the
## diamond's centre as last drawn, phase, seen: the clear line to it 0..1, on: on the screen 0..1, name, ...}
var marks: Dictionary = {}


func _init() -> void:
	name = "Guide"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


func _new_mark(id: String) -> Dictionary:
	return {"k": 0.0, "top": Vector2.ZERO, "above": Vector2.ZERO, "d": 0.0, "gem": Vector2.ZERO, "seen": 1.0, "on": 0.0,
		"off_t": 0.0, "born": 0.0, "live": true, "name": "", "label": 0.0, "ptr": 0.0, "edge": Vector2.ZERO, "dir": Vector2.DOWN,
		"phase": float(absi(hash(id)) % 628) / 100.0}


## how opaque a clear view of something d metres off is (0..A_NEAR): the nearer the clearer, on a log scale so a
## few metres matter more than a few more at thirty
static func base_alpha(d: float) -> float:
	var u := clampf(log(maxf(d, NEAR) / NEAR) / log(FAINT_AT / NEAR), 0.0, 1.0)
	var a := lerpf(A_NEAR, A_FAR, smoothstep(0.0, 1.0, u))
	return a * (1.0 - smoothstep(FADE_FROM, FAR, d))


## each frame: the targets (id -> the world point at the top of what it marks), the eye, and what play.gd knows: ctx
## {seen: {id: a clear line from the eye}, names: {id: what it's called}, aimed: the id the cursor is on}
func update(targets: Dictionary, cam: Camera3D, dt: float, ctx: Dictionary = {}) -> void:
	t += dt
	var vp := get_viewport_rect().size
	var sc := vp.y / 1080.0
	var seen_in: Dictionary = ctx.get("seen", {})
	var names_in: Dictionary = ctx.get("names", {})
	var aimed := str(ctx.get("aimed", ""))
	if mode > 0:
		for id in targets:
			if not marks.has(id):
				marks[id] = _new_mark(str(id))
	var inv := cam.global_transform.affine_inverse() if cam != null else Transform3D.IDENTITY
	for id in marks.keys():
		var m: Dictionary = marks[id]
		var live: bool = mode > 0 and targets.has(id) and cam != null
		m["live"] = live
		var want := 0.0
		var ptr_want := 0.0
		if live:
			var top: Vector3 = targets[id]
			var above := top + Vector3(0, LIFT, 0)
			var d := cam.global_position.distance_to(above)
			m["d"] = d
			m["name"] = str(names_in.get(id, m["name"]))
			m["born"] = float(m["born"]) + dt
			var behind := cam.is_position_behind(above)
			if not behind:
				m["top"] = cam.unproject_position(top)
				m["above"] = cam.unproject_position(above)
			var a: Vector2 = m["above"]
			var pad := 20.0 * sc
			var in_view: bool = not behind and a.x > pad and a.y > pad and a.x < vp.x - pad and a.y < vp.y - pad
			m["on"] = move_toward(float(m["on"]), 1.0 if in_view else 0.0, dt * 5.0)
			m["off_t"] = 0.0 if in_view else float(m["off_t"]) + dt
			m["seen"] = move_toward(float(m["seen"]), 1.0 if bool(seen_in.get(id, true)) else 0.0, dt * 3.0)
			# how strongly: the distance, then the walls between, then the cursor and the reticle
			var strength := 1.3 if mode == 2 else 1.0
			want = base_alpha(d) * lerpf(HIDDEN, 1.0, float(m["seen"]))
			if mode == 2:
				want = maxf(want, 0.3 * (1.0 - smoothstep(FADE_FROM, FAR, d)))      # clear: never fainter than this
			if aimed == str(id):
				want *= TAKEN
			want = minf(want * strength, 0.95)
			if modal:
				want *= 0.2
			# the pointer: out of view a moment, on an ellipse toward it
			var v: Vector3 = inv * above
			var dir2 := Vector2(v.x, -v.y)                                         # in front, off to a side: out through the edge it left by
			if v.z > 0.0:                                                           # behind: down, leaning to the side of the shorter turn
				var flat := Vector2(v.x, v.z).length()
				dir2 = Vector2(v.x / maxf(flat, 0.001), smoothstep(0.0, 0.7, v.z / maxf(flat, 0.001)))
			if dir2.length() < 0.001:
				dir2 = Vector2.DOWN
			dir2 = dir2.normalized()
			m["dir"] = dir2
			var ang := dir2.angle()
			m["edge"] = vp / 2.0 + Vector2(cos(ang) * ORBIT.x * vp.x, sin(ang) * ORBIT.y * vp.y)
			var ready_k := 1.0 if mode == 2 else smoothstep(POINTER_AFTER, POINTER_AFTER + 1.0, float(m["off_t"]))
			ptr_want = want * 0.62 * ready_k * (1.0 - float(m["on"]))
			var near_name: bool = d < (14.0 if mode == 2 else DETAIL_FROM) and float(m["seen"]) > 0.9 and float(m["on"]) > 0.9 and str(m["name"]) != "" and aimed != str(id) and not modal
			m["label"] = move_toward(float(m["label"]), 1.0 if near_name else 0.0, dt * 2.2)
		var k := float(m["k"])
		if live:
			k += (want - k) * (1.0 - exp(-dt * (4.0 if want > k else 5.0)))        # eased: it unfolds, it doesn't snap
		else:
			k = move_toward(k, 0.0, dt * 2.4)                                         # a task done: gone in under half a second
			m["label"] = move_toward(float(m["label"]), 0.0, dt * 4.0)
		m["k"] = k
		m["ptr"] = move_toward(float(m["ptr"]), ptr_want, dt * 1.2) if live else move_toward(float(m["ptr"]), 0.0, dt * 3.0)
		var rise := 1.0 - pow(1.0 - clampf(float(m["born"]) / 0.9, 0.0, 1.0), 3.0)   # it rises a few pixels into place as it comes
		m["gem"] = (m["above"] as Vector2) + Vector2(0, sin(TAU * t / PERIOD + float(m["phase"])) * BOB * sc + (1.0 - rise) * 9.0 * sc)
		if k <= 0.0 and float(m["ptr"]) <= 0.0 and not targets.has(id):
			marks.erase(id)
	queue_redraw()


## the marker shown over that (0 none, 1 fully)
func shown(id: String) -> float:
	return float(marks[id]["k"]) if marks.has(id) else 0.0


## a rounded diamond's outline, closed, as a polyline: each corner a quadratic bend of `r` along its two edges
static func rounded_diamond(c: Vector2, w: float, h: float, r: float) -> PackedVector2Array:
	var vs := [Vector2(0, -h), Vector2(w, 0), Vector2(0, h), Vector2(-w, 0)]
	var out := PackedVector2Array()
	for i in 4:
		var v: Vector2 = vs[i]
		var p: Vector2 = vs[(i + 3) % 4]
		var n: Vector2 = vs[(i + 1) % 4]
		var a := v + (p - v).normalized() * minf(r, (p - v).length() * 0.45)
		var b := v + (n - v).normalized() * minf(r, (n - v).length() * 0.45)
		for j in 6:
			var u := float(j) / 5.0
			out.append(c + a.lerp(v, u).lerp(v.lerp(b, u), u))
	out.append(out[0])
	return out


func _draw() -> void:
	var sc := get_viewport_rect().size.y / 1080.0
	for id in marks:
		var m: Dictionary = marks[id]
		var k := float(m["k"])
		var on := float(m["on"])
		if k * on > 0.01:
			_glyph(m, sc, k * on)
		if float(m["ptr"]) > 0.01:
			_pointer(m, sc, float(m["ptr"]))


## a stroke with its soft dark edge under it (a wide faint pass and a narrower one: it reads on a lit wall and costs nothing on a dark one)
func _stroke(pts: PackedVector2Array, col: Color, line: float, a: float) -> void:
	draw_polyline(pts, Color(0, 0, 0, 0.16 * a), line + 5.0, true)
	draw_polyline(pts, Color(0, 0, 0, 0.26 * a), line + 2.5, true)
	draw_polyline(pts, Color(col, col.a * a), line, true)


func _glyph(m: Dictionary, sc: float, a: float) -> void:
	var d := float(m["d"])
	var seen := float(m["seen"])
	var leaving := 1.0 if bool(m["live"]) else lerpf(0.82, 1.0, clampf(float(m["k"]) / 0.5, 0.0, 1.0))
	var z := lerpf(1.12, 0.74, smoothstep(1.5, 26.0, d)) * leaving * lerpf(0.9, 1.0, seen)   # larger close by, smaller and bare out of sight
	var c: Vector2 = m["gem"]
	var h := 12.5 * sc * z                                       # the diamond: taller than wide
	var w := 7.7 * sc * z
	var line := maxf(1.9 * sc * z, 1.25)
	var edge := sqrt(w * w + h * h)
	var path := rounded_diamond(c, w, h, edge * 0.09)
	# a faint glass tint inside it, a touch lighter at the top
	var body := path.slice(0, path.size() - 1)
	var tint := PackedColorArray()
	for p in body:
		var u := clampf((p.y - (c.y - h)) / (2.0 * h), 0.0, 1.0)
		tint.append(Color(accent, lerpf(0.17, 0.03, u) * a))
	draw_polygon(body, tint)
	_stroke(path, accent, line, a)
	var detail := (1.0 - smoothstep(DETAIL_FROM * (2.0 if mode == 2 else 1.0), DETAIL_FROM * 3.4, d)) * seen
	if detail > 0.02:                                            # nearer: a small core takes shape inside it, as the eye locks on
		var core := rounded_diamond(c, w * 0.34, h * 0.34, 0.0)
		draw_colored_polygon(core.slice(0, core.size() - 1), Color(accent, 0.8 * a * detail))
	# the stem: from the diamond's foot toward the thing, fading out as it goes
	var foot := c + Vector2(0, h)
	var reach := clampf((m["top"] as Vector2).y - foot.y, 6.0 * sc, 30.0 * sc) * lerpf(0.55, 1.0, seen)
	var stem := PackedVector2Array([foot, foot + Vector2(0, reach * 0.55), foot + Vector2(0, reach)])
	var cols := PackedColorArray([Color(accent, 0.9 * a * lerpf(0.35, 1.0, seen)), Color(accent, 0.45 * a * lerpf(0.3, 1.0, seen)), Color(accent, 0.0)])
	draw_polyline(stem, Color(0, 0, 0, 0.2 * a * seen), line + 2.5, true)
	draw_polyline_colors(stem, cols, line, true)
	var la := float(m["label"])
	if la > 0.01 and str(m["name"]) != "":                      # what it's called, over it, as quiet as it can be and still read
		var font := get_theme_default_font()
		var fs := int(round(maxf(12.0, 13.0 * sc)))
		var label: String = m["name"]
		var sz := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
		var at := Vector2(c.x - sz.x / 2.0, c.y - h - 9.0 * sc)
		draw_string_outline(font, at, label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 3, Color(0, 0, 0, 0.5 * a * la))
		draw_string(font, at, label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(text_color, 0.88 * a * la))


## the pointer: a small diamond and a chevron past it, on the ellipse, toward what's out of view
func _pointer(m: Dictionary, sc: float, a: float) -> void:
	var dir: Vector2 = m["dir"]
	var c: Vector2 = (m["edge"] as Vector2) + dir * (sin(TAU * t / PERIOD + float(m["phase"])) * 2.0 * sc)
	var h := 8.0 * sc
	var w := 5.0 * sc
	var line := maxf(1.6 * sc, 1.2)
	var path := rounded_diamond(c, w, h, sqrt(w * w + h * h) * 0.3)
	_stroke(path, accent, line, a)
	var perp := Vector2(-dir.y, dir.x)
	var tip := c + dir * (h + 9.0 * sc)
	var chevron := PackedVector2Array([tip - dir * 4.2 * sc + perp * 3.8 * sc, tip, tip - dir * 4.2 * sc - perp * 3.8 * sc])
	_stroke(chevron, accent, line, a * 0.85)
