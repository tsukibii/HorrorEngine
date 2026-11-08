## The lights of a scene switched and dimmed by the starter scripts (a scare, a character who doesn't like the light)
## without fighting the Look plugin: a light in a light zone (HSLightZone) is shown by its zone too, so it's switched as
## the plugin composes it (its own visibility, the power, the zone's view), and a flickering one (HSFlickerLight) takes
## the energy it's given as its full light and flickers on from there. Static functions: preload this script.
##     const Lights := preload("res://starter/lights.gd")
##     Lights.set_on(lamp, false); Lights.set_level(lamp, 0.2)
extends RefCounted


## every light under a node, the node too (never a directional one: the moon stays)
static func under(n: Node) -> Array:
	var out := []
	if n == null:
		return out
	if n is Light3D and not (n is DirectionalLight3D):
		out.append(n)
	for l in n.find_children("*", "Light3D", true, false):
		if not (l is DirectionalLight3D):
			out.append(l)
	return out


## on or off
static func set_on(l: Light3D, on: bool) -> void:
	l.set_meta("hs_lit", on)
	l.visible = on and not bool(l.get_meta("hs_power_off", false)) and not bool(l.get_meta("hs_zone_hidden", false))


## whether it's on (its own say: a zone hiding it while it's out of view doesn't count)
static func is_on(l: Light3D) -> bool:
	return bool(l.get_meta("hs_lit")) if l.has_meta("hs_lit") else l.visible


## its brightness: 1 its own full light, 0 none (its full light kept the first time it's dimmed)
static func set_level(l: Light3D, k: float) -> void:
	if not l.has_meta("hs_full"):
		var full: float = l.light_energy
		var d = l.get("drive")                       # a flickering light (the Look plugin's): its full light is its drive's
		if d != null and d.get("base") != null:
			full = float(d.base)
		l.set_meta("hs_full", full)
	l.set_meta("hs_level", maxf(0.0, k))
	l.light_energy = float(l.get_meta("hs_full")) * maxf(0.0, k) * float(l.get_meta("hs_flick", 1.0))


## a flicker over whatever level it's at (presence.gd's dips when she's near): 1 none; kept apart from set_level's, so a
## scare's dimming and her flicker don't fight
static func set_flicker(l: Light3D, k2: float) -> void:
	if absf(k2 - float(l.get_meta("hs_flick", 1.0))) < 0.001:
		return
	l.set_meta("hs_flick", k2)
	set_level(l, float(l.get_meta("hs_level", 1.0)))


## a blink: the lamp (and the player's flashlight, `torch`) out for `secs` (100 to 200 ms: what goes in a blink goes
## unseen; glimpse.gd and closer.gd go in one when they must go in view), then back as they were
static func blink(tree: SceneTree, lamp: Light3D, secs := 0.15, torch := true) -> void:
	if lamp != null:
		set_flicker(lamp, 0.03)
	var t: Node = null
	if torch:
		var pl := tree.get_first_node_in_group("hs_player")
		t = pl.get_node_or_null("Eye/Flashlight") if pl != null else null
		if t != null and "flick" in t:
			t.flick = 0.03
	tree.create_timer(secs).timeout.connect(func() -> void:
		if lamp != null and is_instance_valid(lamp):
			set_flicker(lamp, 1.0)
		if t != null and is_instance_valid(t) and "flick" in t:
			t.flick = 1.0)


## its brightness now, 0..1 of its full light
static func level(l: Light3D) -> float:
	if not l.has_meta("hs_full"):
		return 1.0
	return l.light_energy / maxf(0.0001, float(l.get_meta("hs_full")))
