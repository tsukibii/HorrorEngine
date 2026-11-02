## The guide marker (STORY_FORMAT §4, a `todo`'s `guide`; the user, 2026-11-02: "a helper… so players can see the
## object… the ui should lightly bounce up and down in a fluid hypnotic motion… optional"): over what an open task
## needs (a thing, a person, an area), a small gem hanging on a thread in the HUD theme's accent. The gem bobs on a slow
## sine; its core brightens and dims and its glow swells a beat behind, so the three never move together; the thread
## down to the thing stretches and eases with it. Each marker keeps its own phase. Drawn on the HUD from the camera each
## frame (play.gd guide_points): hidden behind the eye, off the screen and past 30 m, softer up close (where the cursor's
## prompt takes over), fading in as its task opens and out once it's done.
extends Control

const PERIOD := 2.6            # seconds a bob: slow enough to read as breathing, not bouncing
const BOB := 7.0               # pixels up and down (at 1080 lines)
const LIFT := 0.32             # metres the gem hangs over the thing's top
const FAR := 30.0              # metres: gone by here, fading from 22
const NEAR := 1.6              # metres: softer inside this (the prompt says what it is)

var accent := Color("#cfe6ff"):
	set(c):                     # the theme's accent, deeper: a pale glass accent vanishes on a lit wall
		accent = Color.from_hsv(c.h, clampf(c.s * 1.7 + 0.18, 0.0, 1.0), clampf(c.v, 0.75, 1.0), c.a)
var t := 0.0
## id -> {k: how shown 0..1, top: the thing's top on the screen, above: where the gem hangs, d: metres, gem: its centre
## as last drawn, phase}
var marks: Dictionary = {}


func _init() -> void:
	name = "Guide"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


## each frame: the targets (id -> the world point at the top of what it marks) and the eye
func update(targets: Dictionary, cam: Camera3D, dt: float) -> void:
	t += dt
	for id in targets:
		if not marks.has(id):
			marks[id] = {"k": 0.0, "top": Vector2.ZERO, "above": Vector2.ZERO, "d": 0.0, "gem": Vector2.ZERO,
				"phase": float(absi(hash(str(id))) % 628) / 100.0}
	var vp := get_viewport_rect().size
	for id in marks.keys():
		var m: Dictionary = marks[id]
		var want := 0.0
		if targets.has(id) and cam != null:
			var top: Vector3 = targets[id]
			var above := top + Vector3(0, LIFT, 0)
			var d := cam.global_position.distance_to(above)
			m["d"] = d
			if not cam.is_position_behind(above) and d < FAR:
				m["top"] = cam.unproject_position(top)
				m["above"] = cam.unproject_position(above)
				var a: Vector2 = m["above"]
				if a.x > -48 and a.y > -48 and a.x < vp.x + 48 and a.y < vp.y + 48:
					want = clampf((FAR - d) / 8.0, 0.0, 1.0) * (0.45 if d < NEAR else 1.0)
		m["k"] = move_toward(float(m["k"]), want, dt * 2.4)
		m["gem"] = (m["above"] as Vector2) + Vector2(0, sin(TAU * t / PERIOD + float(m["phase"])) * BOB * vp.y / 1080.0)   # where the gem is now
		if float(m["k"]) <= 0.0 and not targets.has(id):
			marks.erase(id)
	queue_redraw()


## the marker shown over that (0 none, 1 fully)
func shown(id: String) -> float:
	return float(marks[id]["k"]) if marks.has(id) else 0.0


func _draw() -> void:
	var s := get_viewport_rect().size.y / 1080.0
	for id in marks:
		var m: Dictionary = marks[id]
		var k := float(m["k"])
		if k <= 0.01:
			continue
		var ph := TAU * t / PERIOD + float(m["phase"])
		var near := clampf(3.4 / maxf(float(m["d"]), 0.5), 0.85, 1.25)         # a little larger close by
		var c: Vector2 = m["gem"]
		var h := 19.0 * s * near                                                # the gem: a slender diamond, taller than wide
		var w := 11.0 * s * near
		var breath := 0.5 + 0.5 * sin(ph - 1.1)                                 # the glow swells a beat behind the bob
		for i in 3:
			var r := (30.0 - i * 8.0) * s * near * (1.0 + 0.16 * breath)
			draw_circle(c, r, Color(accent, (0.04 + 0.045 * i) * k * (0.6 + 0.4 * breath)), true, -1.0, true)
		var bottom := c + Vector2(0, h)                                         # the thread, down to just short of the thing
		var end := Vector2(c.x, maxf(bottom.y + 8.0 * s, (m["top"] as Vector2).y - 4.0 * s))
		draw_polyline_colors(PackedVector2Array([bottom, end]), PackedColorArray([Color(0, 0, 0, 0.25 * k), Color(0, 0, 0, 0.0)]), 3.6 * s, true)
		draw_polyline_colors(PackedVector2Array([bottom, end]), PackedColorArray([Color(accent, 0.8 * k), Color(accent, 0.0)]), 1.8 * s, true)
		var pts := PackedVector2Array([c + Vector2(0, -h), c + Vector2(w, 0), c + Vector2(0, h), c + Vector2(-w, 0)])
		draw_colored_polygon(pts, Color(accent, 0.32 * k))                      # a glassy body
		draw_colored_polygon(PackedVector2Array([c + Vector2(0, -h), c + Vector2(w, 0), c]), Color(1, 1, 1, 0.16 * k))   # its lit facet
		var edge := pts.duplicate()
		edge.append(pts[0])
		draw_polyline(edge, Color(0, 0, 0, 0.38 * k), 5.0 * s, true)           # a dark edge: it reads on a bright wall too
		draw_polyline(edge, Color(accent, k), 2.4 * s, true)
		var core := 0.5 + 0.5 * (0.5 + 0.5 * sin(ph + 0.9))                     # the core: brightening and dimming on its own beat
		draw_circle(c, 3.6 * s * near, Color(accent.lightened(0.5), core * k), true, -1.0, true)
