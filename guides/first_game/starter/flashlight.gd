## The player's flashlight on batteries (guides/tutorial_v2; the studio games' own, docs/FLASHLIGHT_PLAN.md §1: the
## same curves). On the player's Eye/Flashlight (player.tscn has it). F switches it. With `battery` seconds of light it
## runs down while it's on: a bulb dimmer, warmer and shorter-reaching as it empties, browning out under `low_at`; an
## LED full and white to `low_at`, three blinks, then its low mode at a third; near empty it strobes. Dead, it stutters
## out and F only clicks. A spare set (`spares`, or batteries picked up: pickup.gd) goes in by itself after
## `change_seconds` of dark. `beam_on(point)` says how lit a point is, 0..1 (light_shy.gd). `battery` 0: it never runs
## down (the first game's). Its AirBeam (the Look plugin's HSBeam) draws the beam in the air and gives the light a
## flashlight's cookie (a hot core, a ring, a dim spill): beam_on weighs by the same.
extends SpotLight3D

signal low
signal dead
signal changed

const DEAD_AT := 0.03
const WARM := 2100.0

@export var battery := 0.0                      ## seconds of light from full; 0: it never runs down
@export_range(0.0, 1.0) var charge := 1.0
@export_enum("bulb", "led") var kind := "bulb"
@export_range(0.0, 1.0) var low_at := 0.25
@export var spares := 0                         ## sets of batteries in the pocket
@export var change_seconds := 2.0
@export var low_says := ""                      ## the line when it runs low ("It's getting dim.")
@export var low_task := ""                      ## a task it adds then, "id: what it says"
@export var dead_says := ""

var is_dead := false
var changing := false
var tremor := 0.0                               ## degrees the beam shakes in your hand (the Fear node sets it: 8 to 10 a second)
var flick := 1.0                                ## a flicker over its light (presence.gd's, when she's near): 1 none
var _rot0 = null
var b := 1.0                                    # the beam now, 0..1
var _T := 0.0
var _low_t = null
var _full := 1.0
var _range := 14.0
var _color := Color.WHITE


func _ready() -> void:
	add_to_group("hs_no_zone")                   # the Look plugin's light zones leave it alone: it goes everywhere
	_full = light_energy
	_range = spot_range
	_color = light_color


## F: on or off (dead, or the batteries going in: a click)
func toggle() -> void:
	if is_dead or changing:
		return
	visible = not visible


## a set of batteries into the pocket: in at once if it's dead
func add_spare() -> void:
	spares += 1
	if is_dead and not changing:
		_change()


func _process(dt: float) -> void:
	_T += dt
	if _rot0 == null:
		_rot0 = rotation
	if tremor > 0.001 or rotation != _rot0:     # the hand shaking: the light only (its beam with it), never the view
		var a := deg_to_rad(tremor)
		rotation = _rot0 + Vector3(sin(_T * 54.7 + 1.3) * 0.6 + sin(_T * 64.1) * 0.4, sin(_T * 59.3 + 0.4) * 0.6 + sin(_T * 51.2 + 2.1) * 0.4, 0.0) * a
	if battery <= 0.0 and not is_dead and not changing:
		light_energy = _full * flick             # (no batteries: only her flicker)
	if is_dead or changing or battery <= 0.0:
		return
	if visible:
		charge = maxf(0.0, charge - dt / battery)
	if charge < low_at and _low_t == null:
		_low_t = _T
		_story_says(low_says, low_task)
		low.emit()
	if charge <= DEAD_AT:
		_die()
		return
	b = _beam()
	light_energy = _full * b * flick
	spot_range = maxf(0.5, _range * sqrt(b))
	if kind == "bulb":
		var k: float = 3200.0 - (3200.0 - WARM) * (1.0 - charge) * (1.0 - charge)
		light_color = _color * _kelvin(k) / _kelvin(3200.0)


## the curves: a bulb's light the square root of its charge, browning out under low (closer as it empties); an LED's
## full to low, three blinks, a low mode of 35 %, a slow strobe near empty
func _beam() -> float:
	var c := charge
	if kind == "led":
		var t: float = (_T - float(_low_t)) if _low_t != null else -1.0
		if c >= low_at:
			return 1.0
		if c < 0.05:
			return 0.35 if fposmod(_T, 0.55) < 0.4 else 0.0
		if t >= 0.0 and t < 0.6:
			return 0.0 if fmod(t, 0.2) < 0.08 else 1.0
		return 0.35
	var out := sqrt(c)
	if c < low_at:
		var g: float = 0.4 + 2.6 * clampf((c - DEAD_AT) / maxf(1e-6, low_at - DEAD_AT), 0.0, 1.0)
		var i := int(floor(_T / g))
		var at: float = i * g + _hash(i, 4091) * g * 0.6
		if _T >= at and _T < at + 0.06 + 0.14 * _hash(i, 4093):
			out *= 0.4
	return out


func _die() -> void:
	is_dead = true
	for i in 6:                                  # it stutters out
		light_energy = _full * (0.35 if i % 2 == 0 else 0.0)
		await get_tree().create_timer(0.07 + 0.05 * i).timeout
	visible = false
	light_energy = _full
	_story_says(dead_says, "")
	dead.emit()
	if spares > 0:
		_change()


func _change() -> void:
	changing = true
	visible = false
	await get_tree().create_timer(change_seconds).timeout
	spares -= 1
	charge = 1.0
	_low_t = null
	is_dead = false
	changing = false
	b = 1.0
	light_energy = _full
	spot_range = _range
	light_color = _color
	visible = true
	_story_says("New batteries.", "")
	changed.emit()


## how lit a point is by the beam, 0..1: inside its cone (a fifth in the spill round it), full to a third of its reach
## and fading to nothing at its end, nothing when something's in the way
func beam_on(p: Vector3) -> float:
	if not visible or is_dead or b <= 0.0:
		return 0.0
	var d := p - global_position
	var dist := d.length()
	if dist < 0.01 or dist > spot_range:
		return 0.0
	var ang := rad_to_deg((-global_basis.z).angle_to(d))
	var cone := _cone(ang)
	if cone == 0.0:
		return 0.0
	var fall := 1.0 if dist <= spot_range / 3.0 else clampf(1.0 - (dist - spot_range / 3.0) / (spot_range * 2.0 / 3.0), 0.0, 1.0)
	var q := PhysicsRayQueryParameters3D.create(global_position, p)
	var me := get_tree().get_first_node_in_group("hs_player")
	if me is CollisionObject3D:
		q.exclude = [me.get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty() and global_position.distance_to(hit["position"]) < dist - 0.3:
		return 0.0
	return cone * fall * minf(1.0, b)


## how much of the beam a way off its axis gets: the cookie's profile when the beam wears one (the AirBeam's: a hot
## core, a ring, a dim spill), else the whole cone (and a fifth in the spill round it)
func _cone(ang: float) -> float:
	var beam := get_node_or_null("AirBeam")
	var kind := str(beam.get("cookie")) if beam != null else ""
	if kind in ["flashlight", "led", "lantern"]:
		if ang >= spot_angle:
			return 0.0
		return HSAir.profile(kind, tan(deg_to_rad(ang)) / tan(deg_to_rad(spot_angle)))
	return 1.0 if ang <= spot_angle else (0.2 if ang <= spot_angle * 1.6 else 0.0)


func _story_says(text: String, task: String) -> void:
	var st := get_tree().get_first_node_in_group("hs_story")
	if st == null:
		return
	if text != "":
		st.say(text)
	if task != "":
		st.add_line(task)


static func _hash(a: int, c: int) -> float:
	var h: int = (a * 374761393 + c * 668265263) & 0xffffffff
	h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
	return float((h ^ (h >> 16)) & 0xffffffff) / 4294967296.0


## a colour temperature as a light's colour (Tanner Helland's fit, good from 1000 to 12000 K)
static func _kelvin(k: float) -> Color:
	var t := k / 100.0
	var r := 1.0 if t <= 66.0 else clampf(1.292936 * pow(t - 60.0, -0.1332047592), 0.0, 1.0)
	var g := clampf((0.3900815787 * log(t) - 0.6318414437) if t <= 66.0 else 1.129890861 * pow(t - 60.0, -0.0755148492), 0.0, 1.0)
	var bl := 1.0 if t >= 66.0 else (0.0 if t <= 19.0 else clampf(0.5432067891 * log(t - 10.0) - 1.19625408914, 0.0, 1.0))
	return Color(r, g, bl)
