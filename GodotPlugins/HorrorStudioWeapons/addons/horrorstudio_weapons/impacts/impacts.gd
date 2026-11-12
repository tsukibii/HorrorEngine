@icon("res://addons/horrorstudio_weapons/icons/impact.svg")
class_name HSImpacts
extends Node3D
## Where shots land: plays an HSImpact at a hit (DECISIONS 2026-11-09, latest). One in a scene, made by the first shot
## (`HSImpacts.of(get_tree())`), holding the marks it's left (the oldest go past each impact's `keep`).
##
## A hit's surface is what it's made of: a collider's (or its parents') `hs_surface` metadata, its `acoustic` one (the
## sound physics' word), the starter's Sound node's rooms (each room's floor, walls and ceiling from the interior's
## export), else plaster. SURFACES says how each looks broken: the mark's tint, the dust's and the chips' colours,
## sparks, how big the mark is; an impact's `surfaces` can change them.
##
## A blast (an impact with a `radius_m`): its fireball (an HSMuzzle laid out as a burst at the hit, facing out of the
## surface), what it reaches within the radius and in its line of sight pushed (RigidBody3D) and told (shot(info), its
## `damage` falling to nothing at the edge, `blast` true), the view shaken near it, listeners hearing it, the ears
## ringing, its sound. `play` returns what a blast reached, as hits (the gun adds them to its shot's).
##
## A shot's pellets (`play_shot`) leave what a 12-gauge leaves indoors (docs/research/shotgun_damage.md): close up one
## torn hole with the smoke's soot and the powder's grains round it, a few metres out a torn middle with pellet holes
## round it and the wad's dent, farther each pellet its own hole; on concrete, stone or steel lead smears instead.
##
## The easter egg shells' impacts break nothing (DECISIONS 2026-11-11): a `heart` or a `wet` mark is a print or a wet
## patch on the wall as it is (no tint, no lead smear, upright on a wall, the water's running down it), fading away
## after the impact's `fade_s`; `_spray` throws hearts that float up, drops of water and mist; `douse` puts out what
## burns near a splash.

const DIR := "res://addons/horrorstudio_weapons/"
const MARK_MASK := 0x3FFFF                               # every layer but 19 (only in mirrors) and 20 (the gun in your hands)
const SURFACES := {
	"plaster": {"tint": Color(0.95, 0.93, 0.88), "dust": Color(0.9, 0.88, 0.83), "chip": Color(0.93, 0.91, 0.87), "sparks": 0.0, "size": 1.0},
	"concrete": {"tint": Color(0.66, 0.65, 0.62), "dust": Color(0.7, 0.68, 0.64), "chip": Color(0.6, 0.59, 0.56), "sparks": 0.2, "size": 0.85, "hard": true},
	"stone": {"tint": Color(0.6, 0.58, 0.55), "dust": Color(0.66, 0.64, 0.6), "chip": Color(0.55, 0.53, 0.5), "sparks": 0.3, "size": 0.8, "hard": true},
	"tile": {"tint": Color(0.94, 0.93, 0.9), "dust": Color(0.92, 0.92, 0.9), "chip": Color(0.97, 0.97, 0.95), "sparks": 0.1, "size": 1.1},
	"wood": {"tint": Color(0.86, 0.7, 0.48), "dust": Color(0.64, 0.52, 0.38), "chip": Color(0.74, 0.58, 0.38), "sparks": 0.0, "size": 0.9, "splinters": true},
	"door": {"tint": Color(0.86, 0.7, 0.48), "dust": Color(0.64, 0.52, 0.38), "chip": Color(0.74, 0.58, 0.38), "sparks": 0.0, "size": 0.9, "splinters": true},
	"metal": {"tint": Color(0.42, 0.42, 0.44), "dust": Color(0.45, 0.45, 0.47), "chip": Color(0.62, 0.62, 0.64), "sparks": 1.0, "size": 0.45, "dust_k": 0.25, "chips_k": 0.3, "hard": true},
	"glass": {"tint": Color(0.8, 0.86, 0.88), "dust": Color(0.92, 0.96, 0.98), "chip": Color(0.85, 0.93, 0.96), "sparks": 0.0, "size": 0.8},
	"plastic": {"tint": Color(0.92, 0.92, 0.92), "dust": Color(0.9, 0.9, 0.9), "chip": Color(0.92, 0.92, 0.92), "sparks": 0.0, "size": 0.9},
	"carpet": {"tint": Color(0.36, 0.3, 0.28), "dust": Color(0.52, 0.46, 0.42), "chip": Color(0.42, 0.35, 0.32), "sparks": 0.0, "size": 0.6, "chips_k": 0.4},
	"cloth": {"tint": Color(0.42, 0.38, 0.36), "dust": Color(0.6, 0.56, 0.52), "chip": Color(0.5, 0.45, 0.42), "sparks": 0.0, "size": 0.6, "chips_k": 0.4},
	"tatami": {"tint": Color(0.72, 0.66, 0.46), "dust": Color(0.7, 0.66, 0.5), "chip": Color(0.76, 0.7, 0.5), "sparks": 0.0, "size": 0.7, "splinters": true},
	"water": {"tint": Color(1, 1, 1), "dust": Color(0.86, 0.9, 0.95), "chip": Color(0.8, 0.86, 0.92), "sparks": 0.0, "size": 0.0, "mark": false, "chips_k": 0.0},
	# a thing's (HSBlowUp's kinds): thin metal holed (a kettle, a can), glazed ware, card
	"sheet_metal": {"tint": Color(0.36, 0.36, 0.38), "dust": Color(0.5, 0.5, 0.52), "chip": Color(0.7, 0.7, 0.72), "sparks": 0.6, "size": 0.4, "dust_k": 0.3, "chips_k": 0.3},
	"ceramic": {"tint": Color(0.92, 0.9, 0.86), "dust": Color(0.92, 0.9, 0.86), "chip": Color(0.95, 0.94, 0.9), "sparks": 0.0, "size": 0.6},
	"cardboard": {"tint": Color(0.45, 0.36, 0.26), "dust": Color(0.7, 0.62, 0.5), "chip": Color(0.66, 0.55, 0.4), "sparks": 0.0, "size": 0.55, "chips_k": 0.6},
	# someone who bleeds her own way (HSHitReact: the ichor, its smoke): no crater, no dust, nothing of the wall's
	"ichor": {"tint": Color(0.02, 0.016, 0.018), "dust": Color(0.03, 0.025, 0.03), "chip": Color(0.02, 0.016, 0.018), "sparks": 0.0, "size": 0.0, "mark": false, "dust_k": 0.0, "chips_k": 0.0},
}

const VARIANTS := {"crater": 4, "scorch": 2, "blast": 3, "smear": 2, "wad": 1, "soot": 1, "grains": 1, "heart": 2, "wet": 3, "wet_drip": 2}   # each mark's maps in fx/
const HOLE := 0.4                                       # a torn hole's share of its decal's width (fx/blast_*)

var marks: Array = []                                   ## the marks in the world, oldest first
var last := {}                                          ## the last impact, a check's: {surface, mark, dust, chips, sparks, blast, torn}
var last_shot := {}                                     ## the last shot's marks, a check's: {pellets, torn (each torn hole's pellets), alone, soot, grains, wad, surface, muzzle_m, marks, hearts, droplets}
var blasts := 0                                         ## blasts so far
var doused := 0                                         ## embers and flames put out so far (a check's)

var _tex := {}
var _chip: Mesh
var _splinter: Mesh
var _puff: Mesh
var _spark: Mesh
var _heart: Mesh
var _water: Mesh
var _mist: Mesh
var _fx_nodes: Array = []                               # the scene's HSPropFX nodes (looked for now and then)
var _fx_at := -1000.0


## The scene's HSImpacts (made under the running scene the first time).
static func of(tree: SceneTree) -> HSImpacts:
	var n := tree.get_first_node_in_group("hs_impacts") as HSImpacts
	if n != null:
		return n
	n = HSImpacts.new()
	n.name = "Impacts"
	var host: Node = tree.current_scene if tree.current_scene != null else tree.root
	host.add_child(n)
	return n


func _init() -> void:
	add_to_group("hs_impacts")


## One hit (`{point, normal, collider, dir, from}`): its mark, its debris (`debris` false: the mark alone), its blast.
## Returns what a blast reached, as hits.
func play(imp: HSImpact, hit: Dictionary, debris := true) -> Array:
	if imp == null:
		imp = default_impact()
	var kind := surface_of(hit)
	var look := surface_look(kind, imp)
	var d := _mark(imp, hit, look)
	var info := {"surface": kind, "mark": d, "dust": 0, "chips": 0, "sparks": 0, "blast": [], "torn": 0}
	if debris:
		_debris(imp, hit, look, info)
	if imp.douse_m > 0.0:
		info["doused"] = douse(hit.get("point", Vector3.ZERO), imp.douse_m)
	if imp.radius_m > 0.0:
		info["blast"] = _blast(imp, hit)
	last = info
	return info["blast"]


## A shot's hits: pellets landing within the impact's `merge_m` of each other run into one torn hole (as many as
## `merge_min` or more), the rest each its own mark; debris for the first `debris_max`; the smoke's soot, the powder's
## grains and the wad's dent by the muzzle's distance (each hit's `muzzle`); `last_shot` says what it left. Returns what
## blasts reached, as hits.
func play_shot(imp: HSImpact, hits: Array) -> Array:
	if imp == null:
		imp = default_impact()
	var out: Array = []
	var made: Array = []
	var torn: Array = []
	var alone := 0
	var main: Array = []
	var near := {}
	var n_hearts := 0
	var n_drops := 0
	if imp.radius_m > 0.0 or imp.merge_m <= 0.0:
		for i in hits.size():
			out.append_array(play(imp, hits[i], i < imp.debris_max))
			made.append(last.get("mark"))
			n_hearts += int(last.get("hearts", 0))
			n_drops += int(last.get("droplets", 0))
		alone = hits.size()
		if imp.radius_m <= 0.0 and imp.sound != null and not hits.is_empty():
			var mid := Vector3.ZERO                          # (its sound once a shot, where the pattern's middle lands)
			for h in hits:
				mid += (h["point"] as Vector3) / float(hits.size())
			_sound_at(imp.sound, mid)
	else:
		var n_debris := 0
		for g in clusters(hits, imp.merge_m):
			if (g as Array).size() > main.size():
				main = g
			if (g as Array).size() >= imp.merge_min:
				_torn(imp, g, n_debris < imp.debris_max)
				made.append(last.get("mark"))
				torn.append((g as Array).size())
				n_debris += 1
			else:
				for h in g:
					out.append_array(play(imp, h, n_debris < imp.debris_max))
					made.append(last.get("mark"))
					alone += 1
					n_debris += 1
		if not main.is_empty():
			near = _powder_and_wad(imp, main)
			made.append_array(near.get("marks", []))
	last_shot = {"pellets": hits.size(), "torn": torn, "alone": alone, "soot": float(near.get("soot", 0.0)),
			"grains": float(near.get("grains", 0.0)), "wad": bool(near.get("wad", false)), "muzzle_m": float(near.get("dist", -1.0)),
			"surface": surface_of(main[0]) if not main.is_empty() else str(last.get("surface", "")),
			"marks": made.filter(func(d) -> bool: return d != null), "hearts": n_hearts, "droplets": n_drops}
	return out


## The shot's hits in groups, pellets on one thing within `merge_m` of another in one group (biggest first).
static func clusters(hits: Array, merge_m: float) -> Array:
	var n := hits.size()
	var up: Array = range(n)
	var find := func(i: int) -> int:
		while up[i] != i:
			up[i] = up[up[i]]
			i = up[i]
		return i
	for i in n:
		for j in range(i + 1, n):
			if hits[i].get("collider") != hits[j].get("collider"):
				continue
			if (hits[i]["point"] as Vector3).distance_to(hits[j]["point"]) < merge_m:
				var a: int = find.call(i)
				var b: int = find.call(j)
				if a != b:
					up[a] = b
	var by := {}
	for i in n:
		var r: int = find.call(i)
		if not by.has(r):
			by[r] = []
		by[r].append(hits[i])
	var out: Array = by.values()
	out.sort_custom(func(x, y): return (x as Array).size() > (y as Array).size())
	return out


## The plugin's pellet impact.
static func default_impact() -> HSImpact:
	var r = load(DIR + "impacts/pellet.tres")
	return r if r is HSImpact else HSImpact.new()


## What a hit is made of (see the class doc): a word of SURFACES.
func surface_of(hit: Dictionary) -> String:
	var n := hit.get("collider") as Node
	var k := n
	for i in 5:
		if k == null:
			break
		if k.has_meta("hs_surface"):
			return str(k.get_meta("hs_surface"))
		if k.has_meta("acoustic"):
			return str(k.get_meta("acoustic"))
		k = k.get_parent()
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null:
		var s := ""
		if snd.has_method("surface_of"):
			s = str(snd.surface_of(hit))
		elif snd.has_method("_surface"):
			s = str(snd.call("_surface", hit))
		if s != "":
			return s
	return "plaster"


## How a surface looks broken: SURFACES' row (plaster's for one it doesn't know).
func surface_look(kind: String, _imp: HSImpact = null) -> Dictionary:
	return SURFACES.get(kind, SURFACES["plaster"])


# ---- the mark ----------------------------------------------------------------------------------------------------

func _mark(imp: HSImpact, hit: Dictionary, look: Dictionary, kind := "", size := -1.0) -> Decal:
	var mk := kind if kind != "" else imp.mark
	if mk == "none" or not bool(look.get("mark", true)) or float(look.get("size", 1.0)) <= 0.0:
		return null
	var hard := bool(look.get("hard", false))
	if hard and (mk == "crater" or mk == "blast"):
		mk = "smear"                                     # (the lead doesn't go in: a smear and chips)
	var whole := mk == "heart" or mk == "wet"            # (nothing of the wall missing: a print on it, a wet patch)
	var y := (hit.get("normal", Vector3.UP) as Vector3).normalized()
	var wall := absf(y.y) < 0.55
	var maps := "wet_drip" if (mk == "wet" and wall) else mk   # (water on a wall runs down it)
	var nm := "%s_%d" % [maps, randi() % int(VARIANTS.get(maps, 1))]
	var flat := mk == "soot" or mk == "grains"           # (colour only: the wall's own relief under it)
	var d := Decal.new()
	d.name = "Mark"
	d.texture_albedo = _t(nm + "_albedo")
	if not flat:
		d.texture_normal = _t(nm + "_normal")
		d.texture_orm = _t(nm + "_orm")
	var scorch := mk == "scorch"
	var glows := imp.embers_s > 0.0 and (scorch or mk == "heart")
	if glows:
		d.texture_emission = _t(nm + "_emission")
		d.emission_energy = imp.embers_energy
	var s := size
	if s <= 0.0:
		s = imp.mark_size_m * (1.0 if (scorch or whole) else float(look.get("size", 1.0))) * randf_range(1.0 - imp.mark_jitter, 1.0 + imp.mark_jitter)
		if mk == "smear":
			s *= 0.75
		if maps == "wet_drip":
			s *= 1.5                                     # (its runs are most of its square)
	d.size = Vector3(s, clampf(s * 0.6, 0.05, 0.6), s)
	d.modulate = Color.WHITE if (scorch or flat or whole or mk == "smear" or mk == "wad") else (look.get("tint", Color.WHITE) as Color)
	if mk == "wet":
		d.albedo_mix = 0.2                               # (water darkens a wall a little, and patches overlap; its gloss and its domes are all there)
	d.normal_fade = 0.35                                 # (never wrapped round a corner onto the next face)
	d.upper_fade = 0.15
	d.lower_fade = 0.15
	d.cull_mask = MARK_MASK
	d.distance_fade_enabled = true
	d.distance_fade_begin = 30.0
	d.distance_fade_length = 10.0
	if flat or mk == "wad":
		d.sorting_offset = -0.01                         # (under the holes it's round)
	var on = hit.get("collider")
	var host: Node = on if on is Node3D and is_instance_valid(on) and not (on as Node).is_queued_for_deletion() else self
	host.add_child(d)                                    # (a door swings with its holes, a crate carries them away)
	var x := y.cross(Vector3.UP if absf(y.y) < 0.9 else Vector3.RIGHT).normalized()
	var b := Basis(x, y, x.cross(y)).rotated(y, randf() * TAU)
	if whole and wall:                                   # upright on a wall: its picture's bottom down it (a heart a little askew)
		var z := (Vector3.DOWN - y * Vector3.DOWN.dot(y)).normalized()
		b = Basis(y.cross(z).normalized(), y, z)
		if mk == "heart":
			b = b.rotated(y, randf_range(-0.3, 0.3))
	d.global_transform = Transform3D(b, (hit.get("point", Vector3.ZERO) as Vector3) + y * 0.004)
	if glows:
		var tw := d.create_tween()                       # the embers dying: a flicker, then out
		tw.tween_property(d, "emission_energy", imp.embers_energy * 0.55, imp.embers_s * 0.25).set_trans(Tween.TRANS_SINE)
		tw.tween_property(d, "emission_energy", 0.0, imp.embers_s * 0.75).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		d.set_meta("hs_glow", tw)                        # (a splash of water puts it out: douse)
	if imp.fade_s > 0.0:
		var tf := d.create_tween()                       # gone after a while: water drying, a heart fading
		tf.tween_interval(imp.fade_s * 0.5)
		tf.tween_property(d, "modulate:a", 0.0, imp.fade_s * 0.5)
		tf.tween_callback(d.queue_free)
		marks = marks.filter(func(m) -> bool: return is_instance_valid(m) and not (m as Node).is_queued_for_deletion())
	d.set_meta("hs_mark", mk)
	marks.append(d)
	while marks.size() > maxi(imp.keep, 1):
		var o = marks.pop_front()
		if is_instance_valid(o):
			o.queue_free()
	return d


# pellets that landed together: one torn hole the size of where they landed (fx/blast_*: its hole two fifths of it),
# the dust and chips of all of them
func _torn(imp: HSImpact, g: Array, debris: bool) -> void:
	var mid := Vector3.ZERO
	var nrm := Vector3.ZERO
	for h in g:
		mid += (h["point"] as Vector3) / float(g.size())
		nrm += (h["normal"] as Vector3)
	nrm = nrm.normalized() if nrm.length() > 0.01 else Vector3.UP
	var reach := 0.0
	for h in g:
		reach = maxf(reach, (h["point"] as Vector3).distance_to(mid))
	var hit := {"point": mid, "normal": nrm, "collider": g[0].get("collider")}
	var kind := surface_of(hit)
	var look := surface_look(kind, imp)
	var hole := 2.0 * reach + 0.012                      # (each pellet's own hole round its point)
	var s := hole / HOLE * float(look.get("size", 1.0)) * randf_range(0.95, 1.08)
	if bool(look.get("hard", false)):
		s = (2.0 * reach + 0.02) / 0.6
	var d := _mark(imp, hit, look, "blast", s)
	var info := {"surface": kind, "mark": d, "dust": 0, "chips": 0, "sparks": 0, "blast": [], "torn": g.size()}
	if debris:
		var more := imp.duplicate() as HSImpact          # (a torn hole throws more of the wall out)
		more.dust = int(imp.dust * 2)
		more.chips = int(imp.chips * 2)
		more.debris_scale = imp.debris_scale * 1.3
		_debris(more, hit, look, info)
	last = info


# what's left near the pattern's middle by how far the muzzle was (docs/research/shotgun_damage.md): the smoke's soot
# from under `soot_m` (darker and smaller the nearer), the powder's grains from under `powder_m` (wider and fainter the
# farther), the wad's own dent from `wad_m.x` (nearer, it went into the hole with the shot) to `wad_m.y`. Returns
# {dist, soot, grains, wad, marks}: soot and grains how strong (1 at the muzzle)
func _powder_and_wad(imp: HSImpact, g: Array) -> Dictionary:
	var mid := Vector3.ZERO
	var nrm := Vector3.ZERO
	for h in g:
		mid += (h["point"] as Vector3) / float(g.size())
		nrm += (h["normal"] as Vector3)
	nrm = nrm.normalized() if nrm.length() > 0.01 else Vector3.UP
	var out := {"dist": -1.0, "soot": 0.0, "grains": 0.0, "wad": false, "marks": []}
	var muz = g[0].get("muzzle", g[0].get("from"))
	if not (muz is Vector3):
		return out
	var dist: float = (muz as Vector3).distance_to(mid)
	out["dist"] = dist
	var hit := {"point": mid, "normal": nrm, "collider": g[0].get("collider")}
	var look := surface_look(surface_of(hit), imp)
	if imp.soot_m > 0.0 and dist < imp.soot_m:
		var k := clampf(dist / imp.soot_m, 0.0, 1.0)
		var d := _mark(imp, hit, look, "soot", 0.07 + 0.22 * k)
		if d != null:
			d.modulate = Color(1, 1, 1, 1.0 - 0.5 * k)   # (fainter as it spreads)
			out["marks"].append(d)
		out["soot"] = 1.0 - k
	if imp.powder_m > 0.0 and dist < imp.powder_m:
		var k := clampf(dist / imp.powder_m, 0.0, 1.0)
		var d := _mark(imp, hit, look, "grains", 0.08 + 0.34 * k)
		if d != null:
			d.modulate = Color(1, 1, 1, 1.0 - 0.6 * k)
			out["marks"].append(d)
		out["grains"] = 1.0 - k
	if imp.wad_m.y > 0.0 and dist >= imp.wad_m.x and dist <= imp.wad_m.y:
		var off := Vector3(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * (0.006 + 0.004 * dist)
		off -= nrm * off.dot(nrm)                        # (it drifts off the shot's line the farther it flies)
		hit["point"] = mid + off
		var d := _mark(imp, hit, look, "wad", randf_range(0.04, 0.055))
		if d != null:
			out["marks"].append(d)
		out["wad"] = true
	if not last.is_empty():
		last["powder"] = maxf(float(out["soot"]), float(out["grains"]))
		last["wad"] = out["wad"]
	return out


func _t(nm: String) -> Texture2D:
	if not _tex.has(nm):
		_tex[nm] = HSMuzzle.tex("fx/%s.png" % nm)
	return _tex[nm]


# ---- what flies off ------------------------------------------------------------------------------------------------

func _debris(imp: HSImpact, hit: Dictionary, look: Dictionary, info: Dictionary) -> void:
	var p: Vector3 = hit.get("point", Vector3.ZERO)
	var nrm := (hit.get("normal", Vector3.UP) as Vector3).normalized()
	var at := p + nrm * 0.01
	var b := _up_along(nrm)
	var k := imp.debris_scale
	var n_dust := int(round(imp.dust * float(look.get("dust_k", 1.0))))
	if n_dust > 0:
		if _puff == null:
			_puff = HSMuzzle.puff_mesh(_t("puff"), 0.0)     # (dust only adds its light: it never hides the wall)
		var dc: Color = look.get("dust", Color(0.8, 0.78, 0.74))
		var g := Gradient.new()
		g.set_color(0, Color(dc, 0.0))
		g.set_color(1, Color(dc, 0.0))
		g.add_point(0.06, Color(dc, 0.55))
		g.add_point(0.35, Color(dc, 0.35))
		_burst(_puff, n_dust, 1.3, Vector2(0.25, 0.9) * imp.debris_speed / 1.4, 38.0, Vector3(0, -0.25, 0), Vector2(0.018, 0.045) * k, g, at, b, false, _grow(3.0), 1.8)
		info["dust"] = n_dust
	var n_chips := int(round(imp.chips * float(look.get("chips_k", 1.0))))
	if n_chips > 0:
		var splinters := bool(look.get("splinters", false))
		var cc: Color = look.get("chip", Color(0.8, 0.78, 0.74))
		var g2 := Gradient.new()
		g2.set_color(0, Color(cc, 1.0))
		g2.set_color(1, Color(cc * 0.85, 1.0))
		_burst(_splinter_mesh() if splinters else _chip_mesh(), n_chips, 0.75, Vector2(0.8, 2.4) * imp.debris_speed / 1.4, 55.0,
			Vector3(0, -7.0, 0), Vector2(0.004, 0.011) * k * (1.4 if splinters else 1.0), g2, at, b, splinters, _grow(0.6), 0.0)
		info["chips"] = n_chips
	var n_sparks := int(round(imp.sparks * float(look.get("sparks", 0.0)) * 3.0))
	if n_sparks > 0:
		if _spark == null:
			_spark = HSMuzzle.spark_mesh()
		var g3 := Gradient.new()
		g3.set_color(0, Color(1.0, 0.82, 0.45, 1.0))
		g3.set_color(1, Color(0.9, 0.25, 0.05, 0.0))
		_burst(_spark, n_sparks, 0.32, Vector2(2.0, 6.0), 62.0, Vector3(0, -6.0, 0), Vector2(0.02, 0.05), g3, at, b, true, _grow(0.3), 0.5)
		info["sparks"] = n_sparks
	_spray(imp, at, b, info)


# what an easter egg shell throws off where it lands, none of it the wall's own: hearts popping out and floating up,
# drops of water splashing off, a puff of fine spray
func _spray(imp: HSImpact, at: Vector3, b: Basis, info: Dictionary) -> void:
	var k := imp.debris_scale
	var c := imp.spray_color
	if imp.hearts > 0:
		hearts(at, b, imp.hearts, c, k)
		info["hearts"] = imp.hearts
	if imp.droplets > 0:
		var g := Gradient.new()
		g.set_color(0, Color(c, 0.8))
		g.set_color(1, Color(c, 0.35))
		_burst(water_mesh(), imp.droplets, 0.7, Vector2(1.0, 3.6) * imp.debris_speed / 1.4, 62.0, Vector3(0, -9.8, 0), Vector2(0.005, 0.013) * k, g, at, b, false, _grow(0.7), 0.3)
		info["droplets"] = imp.droplets
	if imp.mist > 0:
		if _mist == null:
			_mist = HSMuzzle.puff_mesh(_t("puff"), 0.0)     # (it only adds its light, as dust does)
			(_mist.material as ShaderMaterial).set_shader_parameter("glow", 0.2)
		var g2 := Gradient.new()
		g2.set_color(0, Color(c, 0.0))
		g2.set_color(1, Color(c, 0.0))
		g2.add_point(0.08, Color(c, 0.5))
		g2.add_point(0.4, Color(c, 0.3))
		_burst(_mist, imp.mist, 0.9, Vector2(0.3, 1.1) * imp.debris_speed / 1.4, 50.0, Vector3(0, -0.4, 0), Vector2(0.04, 0.09) * k, g2, at, b, false, _grow(3.0), 1.6)
		info["mist"] = imp.mist


## A burst of hearts at `at`, out along `b`'s Y and floating up: `n` of them in shades of `color`, `k` times as big
## (a love-heart shell's where it lands; HSHitReact's when someone's smitten). Freed when it's done.
func hearts(at: Vector3, b: Basis, n: int, color: Color, k := 1.0) -> CPUParticles3D:
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 0.0))
	g.set_color(1, Color(1, 1, 1, 0.0))
	g.add_point(0.06, Color(1, 1, 1, 1.0))
	g.add_point(0.72, Color(1, 1, 1, 1.0))
	var pop := Curve.new()                               # popping out, settling, a little smaller as it goes
	pop.max_value = 1.3
	pop.add_point(Vector2(0, 0.3))
	pop.add_point(Vector2(0.14, 1.3))
	pop.add_point(Vector2(0.3, 1.0))
	pop.add_point(Vector2(1, 0.75))
	var e := _burst(heart_mesh(), n, 1.6, Vector2(0.35, 1.2), 70.0, Vector3(0, 0.9, 0), Vector2(0.035, 0.075) * k, g, at, b, false, pop, 1.3, false)
	heart_shades(e, color)
	e.emitting = true
	return e


## An emitter's hearts each a shade of `color` (paler to deeper), upright give or take, swaying.
static func heart_shades(e: CPUParticles3D, color: Color) -> void:
	var shades := Gradient.new()
	shades.set_color(0, color.lerp(Color.WHITE, 0.45))
	shades.set_color(1, color.lerp(Color(1.0, 0.1, 0.3), 0.35))
	shades.add_point(0.5, color)
	e.color_initial_ramp = shades
	e.angle_min = -28.0
	e.angle_max = 28.0
	e.angular_velocity_min = -50.0
	e.angular_velocity_max = 50.0


## The hearts' mesh: the plugin's heart turned to the eye (one for the scene).
func heart_mesh() -> Mesh:
	if _heart == null:
		_heart = HSMuzzle.sprite_mesh(_t("heart"), 1.15)
	return _heart


## A drop of water: a small glossy bead the lights find (one for the scene).
func water_mesh() -> Mesh:
	if _water == null:
		var m := SphereMesh.new()
		m.radius = 0.5
		m.height = 1.0
		m.radial_segments = 8
		m.rings = 4
		var mat := StandardMaterial3D.new()
		mat.vertex_color_use_as_albedo = true
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.roughness = 0.04
		mat.metallic_specular = 1.0
		mat.emission_enabled = true                      # (a little light of its own: seen in a dark corridor)
		mat.emission = Color(0.55, 0.7, 0.85)
		mat.emission_energy_multiplier = 0.25
		m.material = mat
		_water = m
	return _water


## Put out what burns within `r` of `at` (a water shell's splash): a scorch's embers, a prop's candle flames (the Look
## plugin's HSPropFX), anything in the group hs_flame with a douse() method. Returns how many.
func douse(at: Vector3, r: float) -> int:
	var n := 0
	for d in marks:
		if not is_instance_valid(d) or not (d is Decal) or (d as Decal).emission_energy <= 0.0:
			continue
		if str(d.get_meta("hs_mark", "")) != "scorch" or (d as Decal).global_position.distance_to(at) > r + (d as Decal).size.x * 0.5:
			continue
		var tw = d.get_meta("hs_glow", null)
		if tw is Tween and (tw as Tween).is_valid():
			(tw as Tween).kill()
		(d as Decal).emission_energy = 0.0
		n += 1
	for f in get_tree().get_nodes_in_group("hs_flame"):
		if f is Node3D and f.has_method("douse") and (f as Node3D).global_position.distance_to(at) <= r:
			f.douse()
			n += 1
	var now := Time.get_ticks_msec() / 1000.0
	if now - _fx_at > 4.0:                               # (the scene's HSPropFX nodes: looked for now and then, never a shot)
		_fx_at = now
		_fx_nodes = get_tree().root.find_children("*", "HSPropFX", true, false)
	for fx in _fx_nodes:
		if not is_instance_valid(fx) or not bool(fx.get("flame")) or not (fx.get("info") is Dictionary) or not (fx.get("info") as Dictionary).has("flame"):
			continue
		var host = fx.host() if fx.has_method("host") else null
		if host is Node3D and (host as Node3D).global_position.distance_to(at) <= r + 0.15:
			fx.set("flame", false)                       # (its flame, its light and the wax's glow with it)
			n += 1
	doused += n
	return n


# a sound where something landed (through the starter's Sound node when there is one)
func _sound_at(st: AudioStream, at: Vector3, db := 0.0) -> void:
	var snd := get_tree().get_first_node_in_group("hs_sound")
	if snd != null and snd.has_method("play"):
		snd.play(st, at, db, "sfx")
		return
	var a := AudioStreamPlayer3D.new()
	a.stream = st
	a.volume_db = db
	add_child(a)
	a.global_position = at
	a.play()
	a.finished.connect(a.queue_free)


# a one-shot burst of particles at `at`, flying out along `b`'s Y within `spread` degrees, freed when it's done.
# Made not emitting and started once it's placed: a CPUParticles3D that's emitting as it enters the tree throws its
# first particles there and then, from wherever it is (the scene's origin: LESSONS). `go` false: the caller starts it
# (`emitting = true`) after changing more of it.
func _burst(mesh: Mesh, amount: int, life: float, speed: Vector2, spread: float, gravity: Vector3, size: Vector2,
		ramp: Gradient, at: Vector3, b: Basis, align: bool, scale_curve: Curve, damping: float, go := true) -> CPUParticles3D:
	var e := CPUParticles3D.new()
	e.emitting = false
	e.one_shot = true
	e.amount = maxi(amount, 1)
	e.lifetime = life
	e.explosiveness = 1.0
	e.local_coords = false
	e.direction = Vector3(0, 1, 0)
	e.spread = spread
	e.initial_velocity_min = speed.x
	e.initial_velocity_max = speed.y
	e.gravity = gravity
	e.damping_min = damping
	e.damping_max = damping * 1.5
	e.scale_amount_min = size.x
	e.scale_amount_max = size.y
	e.scale_amount_curve = scale_curve
	e.color_ramp = ramp
	e.particle_flag_align_y = align
	e.angle_min = -180.0
	e.angle_max = 180.0
	if not align:
		e.angular_velocity_min = -360.0
		e.angular_velocity_max = 360.0
	e.mesh = mesh
	e.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(e)
	e.global_transform = Transform3D(b, at)
	if go:
		e.emitting = true
	get_tree().create_timer(life + 0.4).timeout.connect(e.queue_free)
	return e


# a size over a particle's life: `from` at its start to `to` at its end
func _grow(to: float, from := 1.0) -> Curve:
	var c := Curve.new()
	c.max_value = maxf(maxf(to, from), 1.0)
	c.add_point(Vector2(0, from))
	c.add_point(Vector2(1, to))
	return c


func _chip_mesh() -> Mesh:
	if _chip == null:
		var m := BoxMesh.new()
		m.size = Vector3(1.0, 0.45, 0.8)
		var mat := StandardMaterial3D.new()
		mat.vertex_color_use_as_albedo = true
		mat.roughness = 0.95
		m.material = mat
		_chip = m
	return _chip


func _splinter_mesh() -> Mesh:
	if _splinter == null:
		var m := BoxMesh.new()
		m.size = Vector3(0.35, 2.6, 0.25)                # long along Y: the particles' Y is their way (align_y)
		var mat := StandardMaterial3D.new()
		mat.vertex_color_use_as_albedo = true
		mat.roughness = 0.9
		m.material = mat
		_splinter = m
	return _splinter


func _up_along(nrm: Vector3) -> Basis:
	var y := nrm.normalized()
	var x := y.cross(Vector3.UP if absf(y.y) < 0.9 else Vector3.RIGHT).normalized()
	return Basis(x, y, x.cross(y))


# ---- a blast -------------------------------------------------------------------------------------------------------

func _blast(imp: HSImpact, hit: Dictionary) -> Array:
	blasts += 1
	var p: Vector3 = hit.get("point", Vector3.ZERO)
	var nrm := (hit.get("normal", Vector3.UP) as Vector3).normalized()
	var center := p + nrm * 0.08
	# the ball of fire: an HSMuzzle laid out as a burst, its -Z out of the surface; its light, sparks and smoke
	if imp.fireball != null:
		var m := HSMuzzle.new()
		m.name = "Fireball"
		m.light_energy = imp.light_energy
		add_child(m)
		var z := -nrm
		var x := z.cross(Vector3.UP if absf(z.y) < 0.9 else Vector3.RIGHT).normalized()
		m.global_transform = Transform3D(Basis(x, z.cross(x), z), p + nrm * 0.03)
		m.fire(imp.fireball)
		var life := maxf(maxf(imp.fireball.puff_life_s, imp.fireball.spark_life_s), maxf(imp.fireball.trail_life_s, imp.fireball.light_s)) + 0.8
		get_tree().create_timer(life).timeout.connect(m.queue_free)
	# what it reaches: pushed and told, if nothing solid stands between
	var out: Array = []
	var space := get_world_3d().direct_space_state
	if imp.radius_m > 0.0 and space != null:
		var q := PhysicsShapeQueryParameters3D.new()
		var sh := SphereShape3D.new()
		sh.radius = imp.radius_m
		q.shape = sh
		q.transform = Transform3D(Basis(), center)
		q.collision_mask = HSGun.SHOT_MASK                # (the world and her hitboxes: HSHitReact takes a blast once)
		var seen := {}
		var player := get_tree().get_first_node_in_group("hs_player")
		for r in space.intersect_shape(q, 64):
			var c = r.get("collider")
			if not (c is Node3D) or seen.has(c) or c == player:
				continue
			seen[c] = true
			var cn := c as Node3D
			if not cn.is_visible_in_tree():
				continue
			var told := _teller(cn)
			if not (cn is RigidBody3D) and told == null and not _shootable(cn):
				continue                                 # (the room itself: marked, not pushed)
			var at := cn.global_position
			if cn is CollisionObject3D:
				at = _middle(cn as CollisionObject3D)
			var ray := PhysicsRayQueryParameters3D.create(center, at, 1)
			ray.exclude = [(cn as CollisionObject3D).get_rid()] if cn is CollisionObject3D else []
			var block := space.intersect_ray(ray)
			if not block.is_empty():
				continue                                 # (behind a wall)
			var dv := at - center
			var dist := dv.length()
			var dir := dv / dist if dist > 1e-4 else nrm
			var kf := clampf(1.0 - dist / imp.radius_m, 0.15, 1.0)
			if cn is RigidBody3D:
				(cn as RigidBody3D).apply_impulse(dir * imp.power * kf, (at - cn.global_position) * 0.5)
			var info := {"point": at, "normal": -dir, "collider": cn, "dir": dir, "from": center, "pellet": -1,
				"damage": imp.damage * kf, "blast": true, "radius": imp.radius_m}
			if told != null:
				told.shot(info)
			out.append(info)
	# felt and heard
	var cam := get_viewport().get_camera_3d()
	if cam != null and imp.shake > 0.0:
		var near := clampf(1.0 - cam.global_position.distance_to(p) / maxf(imp.shake_m, 0.1), 0.0, 1.0)
		if near > 0.0:
			_shake(cam, imp.shake * near)
	if imp.noise > 0.0:
		get_tree().call_group("hs_listener", "heard", p, imp.noise)
	var fear := get_tree().get_first_node_in_group("hs_fear")
	if fear != null and imp.ring_secs > 0.0 and fear.has_method("ring") and cam != null and cam.global_position.distance_to(p) < imp.shake_m:
		fear.ring(imp.ring_secs)
	var st: AudioStream = imp.sound
	if st == null and ResourceLoader.exists(DIR + "sounds/shell_burst.ogg"):
		st = load(DIR + "sounds/shell_burst.ogg")
	if st != null:
		var snd := get_tree().get_first_node_in_group("hs_sound")
		if snd != null and snd.has_method("play"):
			snd.play(st, p, 0.0, "event")
		else:
			var a := AudioStreamPlayer3D.new()
			a.stream = st
			add_child(a)
			a.global_position = p
			a.play()
			a.finished.connect(a.queue_free)
	return out


# the node a blast tells: the first with a shot() method, it or up its parents
func _teller(n: Node) -> Node:
	var k := n
	for i in 6:
		if k == null:
			return null
		if k.has_method("shot"):
			return k
		k = k.get_parent()
	return null


# under an HSShootable's parent: it counts the hit itself (from the gun's fired)
func _shootable(n: Node) -> bool:
	for s in get_tree().get_nodes_in_group("hs_shootable"):
		var host := (s as Node).get_parent()
		if host != null and (host == n or host.is_ancestor_of(n)):
			return true
	return false


# a body's middle: its shapes' centres, else where it stands
func _middle(c: CollisionObject3D) -> Vector3:
	var sum := Vector3.ZERO
	var n := 0
	for ch in c.get_children():
		if ch is CollisionShape3D and not (ch as CollisionShape3D).disabled:
			sum += (ch as CollisionShape3D).global_position
			n += 1
	return sum / n if n > 0 else c.global_position


# the view shaken for a moment (the camera's offsets, put back after)
func _shake(cam: Camera3D, deg: float) -> void:
	var h0 := cam.h_offset
	var v0 := cam.v_offset
	var amp := tan(deg_to_rad(deg)) * 0.6
	var t := 0.0
	while t < 0.5 and is_instance_valid(cam):
		var k := 1.0 - t / 0.5
		cam.h_offset = h0 + randf_range(-1.0, 1.0) * amp * k * k
		cam.v_offset = v0 + randf_range(-1.0, 1.0) * amp * k * k
		await get_tree().process_frame
		t += get_process_delta_time()
	if is_instance_valid(cam):
		cam.h_offset = h0
		cam.v_offset = v0
