## The guide marker (STORY_FORMAT §4, a `todo`'s `guide`; the user, 2026-11-02: "a helper… so players can see the
## object… the ui should lightly bounce up and down in a fluid hypnotic motion… optional", then "simplify the ui… the
## duller version… more like a vectorish style"): over what an open task needs (a thing, a person, an area), a flat
## glyph in the HUD theme's own accent, as it is: a diamond's outline on a short stem pointing down at it, one stroke
## width, no fill, no glow. The whole glyph bobs on a slow sine, each marker on its own phase. Drawn on the HUD from
## the camera each frame (play.gd guide_points): hidden behind the eye, off the screen and past 30 m, softer up close
## (where the cursor's prompt takes over), fading in as its task opens and out once it's done.
extends Control

const PERIOD := 2.6            # seconds a bob: slow enough to read as breathing, not bouncing
const BOB := 5.0               # pixels up and down (at 1080 lines)
const LIFT := 0.32             # metres the glyph hangs over the thing's top
const FAR := 30.0              # metres: gone by here, fading from 22
const NEAR := 1.6              # metres: softer inside this (the prompt says what it is)

var accent := Color("#cfe6ff") # the HUD theme's accent (hud.gd sets it), drawn as it is
var t := 0.0
## id -> {k: how shown 0..1, top: the thing's top on the screen, above: where the glyph hangs, d: metres, gem: the
## diamond's centre as last drawn, phase}
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
		m["gem"] = (m["above"] as Vector2) + Vector2(0, sin(TAU * t / PERIOD + float(m["phase"])) * BOB * vp.y / 1080.0)   # where it is now
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
		var near := clampf(3.4 / maxf(float(m["d"]), 0.5), 0.8, 1.2)            # a little larger close by
		var c: Vector2 = m["gem"]
		var h := 12.0 * s * near                                                # the diamond: taller than wide
		var w := 7.5 * s * near
		var line := maxf(2.0 * s, 1.25)                                         # one stroke for all of it
		var glyph := PackedVector2Array([c + Vector2(0, -h), c + Vector2(w, 0), c + Vector2(0, h), c + Vector2(-w, 0), c + Vector2(0, -h)])
		var stem := PackedVector2Array([c + Vector2(0, h), c + Vector2(0, h + 0.9 * h)])
		draw_polyline(glyph, Color(0, 0, 0, 0.22 * k), line + 2.0 * s, true)   # a faint dark edge: it reads on a lit wall
		draw_polyline(stem, Color(0, 0, 0, 0.22 * k), line + 2.0 * s, true)
		draw_polyline(glyph, Color(accent, 0.9 * k), line, true)
		draw_polyline(stem, Color(accent, 0.9 * k), line, true)
