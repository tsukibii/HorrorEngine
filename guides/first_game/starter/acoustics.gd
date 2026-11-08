## Sound physics for a game built by hand (docs/research/intensity.md §1.1-1.2; lifted from Woohill's
## game/audio/acoustics.gd, the user, 2026-11-08: "for reverb you can lift the system we made in Woohill repo"): rays
## traced from a sound through the level work out how it reaches the listener. Woohill's own take on the method of
## Sound Physics Remastered (a Minecraft mod, GPL; read for its ideas and defaults, no code taken), on Godot's physics:
## - **Occlusion:** what stands between the sound and the listener (the straight line and 8 lines offset round it, the
##   least blocked one counts) sums each thing's `occlude`, by how thick it is where the line crosses it (a share of
##   `thick` m: a door muffles less than a concrete wall); the direct sound keeps exp(-occlusion * absorb) of its highs.
## - **Reflections:** `rays` rays leave the sound over a Fibonacci sphere and bounce `bounces` times off the level's
##   colliders; each bounce keeps its material's `reflect`. Every bounce point that can see the listener adds to the
##   reverb, in a slot chosen by how long the path is and how reflective (short paths the short slot, long reflective
##   ones the long tails), and to where the sound seems to come from.
## - **Out:** {gains: [slot gain 0..1 x4], bright: [0..1 x4] (the sends' highs), direct_gain, direct_bright,
##   occlusion, airspace (0..1), dir (where it seems to come from: a unit vector from the listener, ZERO: as it is),
##   echo ({delay s, gain, at} of the strongest late reflection that reaches the listener, or {})}.
## What a ray hit is made of comes from `surface` (the Sound node's: an interior's room by which way the hit faces, its
## floor, walls or ceiling as the export's markers say; a door; a node's own `acoustic` metadata). The table is
## res://starter/acoustics.json.
##   var ac := Acoustics.new(); ac.space = get_world_3d().direct_space_state; var r := ac.trace(src, ear)
extends RefCounted

const PATH := "res://starter/acoustics.json"
const SPEED := 343.0
## The golden angle's turn (2 pi phi), the Fibonacci sphere's step.
const LON_STEP := TAU * 1.6180339887

static var _cfg := {}

## The physics world, the collision mask the rays hit, and colliders they skip (the player).
var space: PhysicsDirectSpaceState3D
var mask := 1
var exclude: Array[RID] = []
## What a hit is made of: (hit: Dictionary from intersect_ray) -> a material's id in the table ("" for the default).
var surface: Callable
## Rays cast by the last trace (for the cost), and what its rays hit ({material: count}).
var cast := 0
var _hits := {}


## The table (acoustics.json), read once.
static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d: Variant = JSON.parse_string(FileAccess.get_file_as_string(PATH)) if FileAccess.file_exists(PATH) else null
		_cfg = d if d is Dictionary else {}
	return _cfg


## A material's row {reflect, occlude} (the default row for one not in the table).
static func material(id: String) -> Dictionary:
	return (cfg().get("materials", {}) as Dictionary).get(id, cfg().get("default", {"reflect": 0.8, "occlude": 1.0}))


## What a surface's set or colour sounds like (a room's walls, ceiling or floor from the export's markers): the table's
## material by the words in its name (pbr/concrete/Concrete006, pbr/plastic/white_plastic, a colour: plaster), or by
## the floor's kind (carpet, tatami, tile, stone, wood).
static func material_of(ref: String, floor_kind := "") -> String:
	var k := floor_kind.to_lower()
	if k != "":
		for row: Array in cfg().get("floor_kinds", []):
			if k.contains(str(row[0])):
				return str(row[1])
	var r := ref.to_lower()
	for row: Array in cfg().get("words", []):
		for w in str(row[0]).split("|"):
			if w != "" and r.contains(w):
				return str(row[1])
	return str(cfg().get("plain", "plaster"))


## The `n` ray directions (a Fibonacci sphere: even over every direction).
static func directions(n: int) -> Array[Vector3]:
	var out: Array[Vector3] = []
	for i in n:
		var lon := i * LON_STEP
		var lat := asin(clampf(2.0 * (i + 0.5) / n - 1.0, -1.0, 1.0))
		out.append(Vector3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon)))
	return out


## How a sound at `source` reaches a listener at `listener` (see the class doc). `max_distance`: the sound's reach,
## for the tails' fade.
func trace(source: Vector3, listener: Vector3, max_distance := 30.0) -> Dictionary:
	var c := cfg()
	cast = 0
	_hits = {}
	var n := int(c.get("rays", 32))
	var bounces := maxi(2, int(c.get("bounces", 4)))
	var reach := float(c.get("ray_len", 30.0))
	var absorb := float(c.get("absorb", 3.0))
	var rcp := 1.0 / (n * bounces)
	var occlusion := occlusion_between(source, listener)
	var g := [0.0, 0.0, 0.0, 0.0]
	var ratio := []
	ratio.resize(bounces)
	ratio.fill(0.0)
	var count := []
	count.resize(bounces)
	count.fill(0)
	var shared := 0
	var heard := Vector3.ZERO                     # where the reflections reaching the listener come from
	var direct_len := source.distance_to(listener)
	var echo := {}
	var echo_min := float((c.get("echo", {}) as Dictionary).get("min_ms", 60.0)) / 1000.0
	for d0: Vector3 in directions(n):
		var hit := _ray(source, d0 * reach)
		if hit.is_empty():
			continue
		var at: Vector3 = hit.position
		var normal: Vector3 = hit.normal
		var length := source.distance_to(at)
		var refl := float(material(str(hit.material)).reflect)
		if _sees(at + normal * 0.01, listener):
			shared += 1
			var total := length + at.distance_to(listener)
			heard += (at - listener).normalized() / maxf(1.0, total * total)
			echo = _louder_echo(echo, at, total, direct_len, refl, echo_min)
		var dir := d0
		for j in bounces:
			dir = dir - 2.0 * dir.dot(normal) * normal
			var energy := 0.25 * (0.25 + 0.75 * refl)
			var nxt := _ray(at + normal * 0.01, dir * reach)
			if nxt.is_empty():
				length += at.distance_to(listener)        # (escaped: counted as reaching the listener, as the mod does)
			else:
				ratio[j] = float(ratio[j]) + refl
				count[j] = int(count[j]) + 1
				length += at.distance_to(nxt.position)
			var t := maxf(length, 0.0) * 0.12 * refl
			var w := [1.0 - clampf(absf(t), 0.0, 1.0), 1.0 - clampf(absf(t - 1.0), 0.0, 1.0),
				1.0 - clampf(absf(t - 2.0), 0.0, 1.0), clampf(t - 2.0, 0.0, 1.0)]
			g[0] = float(g[0]) + float(w[0]) * energy * 6.4 * rcp
			for k in range(1, 4):
				g[k] = float(g[k]) + float(w[k]) * energy * 12.8 * rcp
			if nxt.is_empty():
				break
			at = nxt.position
			normal = nxt.normal
			refl = float(material(str(nxt.material)).reflect)
			if _sees(at + normal * 0.01, listener):
				shared += 1
				var total2 := length + at.distance_to(listener)
				heard += (at - listener).normalized() / maxf(1.0, total2 * total2)
				echo = _louder_echo(echo, at, total2, direct_len, refl, echo_min)
	var open_p := float(c.get("enclosure_power", 0.5))
	for j in bounces:              # the bounces' mean reflectivity, times how many rays got that far (to a power)
		var got := int(count[j])
		ratio[j] = float(ratio[j]) / maxf(1.0, got) * pow(float(got) / n, open_p) if got > 0 else 0.0
	var s := shared * 64.0 * rcp
	var air := [clampf(s / 20.0, 0.0, 1.0), clampf(s / 15.0, 0.0, 1.0), clampf(s / 10.0, 0.0, 1.0), clampf(s / 10.0, 0.0, 1.0)]
	var blocked := exp(-occlusion * absorb)
	var bright := []
	for k in 4:
		bright.append(blocked * (1.0 - float(air[k])) + float(air[k]))
	g[1] = float(g[1]) * float(ratio[1])
	g[2] = float(g[2]) * pow(float(ratio[2]), 3.0) if bounces > 2 else float(g[2])
	g[3] = float(g[3]) * pow(float(ratio[3]), 4.0) if bounces > 3 else float(g[3])
	g[0] = clampf(float(g[0]), 0.0, 1.0)
	g[1] = clampf(float(g[1]), 0.0, 1.0)
	g[2] = clampf(1.05 * float(g[2]) - 0.05, 0.0, 1.0)
	g[3] = clampf(1.05 * float(g[3]) - 0.05, 0.0, 1.0)
	var fade := 1.0 - minf(1.0, direct_len / maxf(1.0, max_distance * float(c.get("reverb_distance", 1.5))))
	for k in 4:
		g[k] = float(g[k]) * pow(float(bright[k]), 0.1) * fade
	var avg := (float(air[0]) + float(air[1]) + float(air[2]) + float(air[3])) / 4.0
	var direct_bright := maxf(blocked, 0.2 * sqrt(avg))
	var dir := Vector3.ZERO
	if occlusion > 0.0:                                 # heard round the corner: from where the reflections come
		if _sees(source, listener):
			heard += (source - listener).normalized()
		if heard.length() > 0.0001:
			dir = heard.normalized()
	return {"gains": g, "bright": bright, "direct_gain": pow(direct_bright, 0.1), "direct_bright": direct_bright,
		"occlusion": occlusion, "airspace": avg, "dir": dir, "echo": echo, "rays": cast, "bounce_reflect": ratio, "hits": _hits}


## The occlusion between two points: the least blocked of the straight line and 8 lines offset by `variation` round
## it (the same offset at both ends), each the sum of the `occlude` of everything it passes through, at most
## `max_occlusion`. A thing counts by how thick it is where the line crosses it, a share of `thick` m.
func occlusion_between(a: Vector3, b: Vector3) -> float:
	var v := float(cfg().get("variation", 0.25))
	var best := _occluded(a, b)
	if best <= 0.0 or v <= 0.0:
		return best
	for x in [-v, v]:
		for y in [-v, v]:
			for z in [-v, v]:
				var o := Vector3(x, y, z)
				best = minf(best, _occluded(a + o, b + o))
				if best <= 0.0:
					return 0.0
	return best


func _occluded(a: Vector3, b: Vector3) -> float:
	var top := float(cfg().get("max_occlusion", 10.0))
	var sum := 0.0
	var from := a
	var skip: Array[RID] = exclude.duplicate()
	for k in 16:
		var hit := _ray(from, b - from, skip)
		if hit.is_empty():
			break
		var along := (b - from).normalized()
		var thick := float(cfg().get("thick", 0.2))
		var through := thick
		if hit.has("rid"):                                 # where the line comes out of it again
			var back := _ray(hit.position + along * thick, -along * thick)
			if not back.is_empty() and back.get("rid") == hit.rid:
				through = hit.position.distance_to(back.position)
			skip.append(hit.rid)
		sum += float(material(str(hit.material)).occlude) * clampf(through / thick, 0.15, 1.0)
		if sum >= top:
			return top
		from = hit.position + along * 0.05
	return sum


# the loudest late reflection that reaches the listener (an echo): {delay, gain, at}
func _louder_echo(best: Dictionary, at: Vector3, total: float, direct: float, refl: float, min_s: float) -> Dictionary:
	var delay := (total - direct) / SPEED
	if delay < min_s:
		return best
	var gain := clampf(refl, 0.0, 1.0) * direct / maxf(1.0, total)
	if best.is_empty() or gain > float(best.gain):
		return {"delay": delay, "gain": gain, "at": at}
	return best


# true when nothing stands between two points
func _sees(a: Vector3, b: Vector3) -> bool:
	return _ray(a, b - a).is_empty()


# a ray from `from` along `along` (its length the reach): {position, normal, material, rid} or {} for a miss
func _ray(from: Vector3, along: Vector3, skip: Array[RID] = []) -> Dictionary:
	cast += 1
	var q := PhysicsRayQueryParameters3D.create(from, from + along, mask)
	q.exclude = skip if not skip.is_empty() else exclude
	var hit := space.intersect_ray(q) if space else {}
	if hit.is_empty():
		return {}
	var m := str(surface.call(hit)) if surface.is_valid() else ""
	var out := {"position": hit.position, "normal": hit.normal, "material": m if m != "" else "default", "rid": hit.rid}
	_hits[out.material] = int(_hits.get(out.material, 0)) + 1
	return out
