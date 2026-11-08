## Lightning (docs/research/intensity.md §5.4; docs/GODOT_LOOK.md §5k): the sky lit through the windows for a moment,
## kept inside what's safe for players with photosensitive epilepsy (ITU-R BT.1702, Ofcom, WCAG 2.3.1: no more than
## three flashes a second, a flash being a pair of opposite changes of a tenth of white or more). A real flash is three
## to five strokes about 60 ms apart; here a strike is **one flash**: a rise to full in 25 ms, then up to `restrikes`
## (0 to 2) re-brightenings riding on a glow that never dips more than a tenth (so none counts as a flash of its own),
## then the fall, and at least `dark_min` seconds of dark before the next (a strike asked for sooner waits).
## `HSLightning.make(settings)`: a DirectionalLight3D (the flash: cold, from the node's -Z, shadows on) that strikes
## every `every` seconds, jittered from a seed (0: only when struck), its thunder `km` kilometres away: `thunder` (an
## AudioStream) played 3 s a kilometre after the flash on `bus`. `figure`: a node shown only while the flash is over
## half (someone at the window, there only in the lightning), in the first `figure_times` strikes from when it's set
## (0: every one). `reduce` 0..1, the players' setting (a menu's Reduce flashes): the flash's strength scaled, the
## strike unchanged.
@tool
class_name HSLightning
extends Node3D

signal struck                                     ## a flash starts
signal thundered                                  ## its thunder now

const RISE := 0.025                               # to full in 25 ms
const DIP := 0.1                                  # how far the glow dips between re-brightenings (a tenth: no flash of its own)
const GAP := 0.35                                 # a re-brightening every 0.35 s (under three a second either way)
const FALL := 0.3                                 # the glow's fall

var light: DirectionalLight3D
var player: AudioStreamPlayer
var every := 45.0
var strength := 4.0
var restrikes := 2
var km := 1.5
var reduce := 1.0
var dark_min := 1.0
var figure: Node3D = null
var figure_times := 0                             # strikes the figure shows in (0: every one)
var figure_shown := 0                             # strikes it has
var clock := 0.0
var next_at := 0.0
var started := -1.0
var ended := -1e9                                 # when the last strike's glow was gone
var asked := false                                # a strike asked for, waiting for the dark between
var seed_ := 1
var strikes := 0
var level := 0.0                                  # the flash now, 0..1 of its strength (the checks read it)
var thunders: Array = []                          # the clock when each flash's thunder is due (a strike's own: a second strike never cancels the first's)
var _shape: Array = []                            # the strike's envelope: [[t, level]...]


static func make(s: Dictionary = {}) -> HSLightning:
	var lg := HSLightning.new()
	lg.name = "Lightning"
	lg.light = DirectionalLight3D.new()
	lg.light.name = "Flash"
	lg.light.light_color = s.get("color", Color(0.78, 0.84, 1.0))
	lg.light.light_energy = 0.0
	lg.light.shadow_enabled = true
	lg.light.directional_shadow_max_distance = 40.0
	lg.light.light_volumetric_fog_energy = 0.15                         # the haze lit a little: the froxels' coarse shadows leaked a whole corridor's air through its walls at 0.4
	lg.light.visible = false
	lg.add_child(lg.light)
	lg.player = AudioStreamPlayer.new()
	lg.player.name = "Thunder"
	lg.add_child(lg.player)
	lg.settings(s)
	return lg


func settings(s: Dictionary) -> void:
	every = float(s.get("every", 45.0))
	strength = float(s.get("strength", 4.0))
	restrikes = clampi(int(s.get("restrikes", 2)), 0, 2)
	km = maxf(0.0, float(s.get("km", 1.5)))
	reduce = clampf(float(s.get("reduce", 1.0)), 0.0, 1.0)
	dark_min = maxf(1.0, float(s.get("dark_min", 1.0)))
	seed_ = int(s.get("seed", 1))
	if s.has("thunder"):
		player.stream = s["thunder"]
	player.bus = str(s.get("bus", "Master"))
	player.volume_db = float(s.get("thunder_db", 0.0))
	if light != null:
		light.light_color = s.get("color", light.light_color)
	figure = s.get("figure", figure)
	figure_times = int(s.get("figure_times", figure_times))
	_shape = shape(restrikes)
	next_at = _gap(0)


## a strike's envelope: [[seconds, level]...], piecewise straight
static func shape(re: int) -> Array:
	var pts: Array = [[0.0, 0.0], [RISE, 1.0]]
	var t := RISE
	for k in re:
		t += GAP - 0.06
		pts.append([t, 1.0 - DIP])                     # the glow sags a tenth, no more
		t += 0.06
		pts.append([t, 1.0])                           # and brightens again
	t += 0.05
	pts.append([t, 1.0])
	t += FALL
	pts.append([t, 0.0])
	return pts


## how long a strike lasts
func length() -> float:
	return float(_shape.back()[0]) if not _shape.is_empty() else 0.0


func _level_at(t: float) -> float:
	for i in range(1, _shape.size()):
		var a: Array = _shape[i - 1]
		var b: Array = _shape[i]
		if t <= float(b[0]):
			var u := (t - float(a[0])) / maxf(float(b[0]) - float(a[0]), 1e-6)
			return lerpf(float(a[1]), float(b[1]), clampf(u, 0.0, 1.0))
	return 0.0


func _gap(k: int) -> float:
	if every <= 0.0:
		return INF
	var h: float = float((seed_ * 374761393 + k * 668265263) & 0xffff) / 65536.0
	return clock + every * (0.6 + 0.8 * h)


## a strike now, or as soon as the dark between allows
func fire() -> void:
	asked = true


func striking() -> bool:
	return started >= 0.0


func _process(dt: float) -> void:
	clock += dt
	if started < 0.0 and (asked or clock >= next_at) and clock - ended >= dark_min:
		asked = false
		started = clock
		strikes += 1
		thunders.append(clock + km * 3.0)
		if figure != null:
			figure_shown += 1
		struck.emit()
	if not thunders.is_empty() and clock >= float(thunders[0]):
		thunders.pop_front()
		if player.stream != null and not Engine.is_editor_hint():
			player.play()
		thundered.emit()
	if started < 0.0:
		return
	var t := clock - started
	level = _level_at(t)
	light.visible = level > 0.0
	light.light_energy = strength * reduce * level
	if figure != null:
		figure.visible = level > 0.5 and (figure_times <= 0 or figure_shown <= figure_times)
	if t >= length():
		started = -1.0
		ended = clock
		level = 0.0
		light.visible = false
		light.light_energy = 0.0
		if figure != null:
			figure.visible = false
		next_at = _gap(strikes)
