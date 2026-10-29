## The little things' effects (docs/IMMERSION.md §4; the desk's lifefx.js, ported): steam and smoke, an ember burning a
## cigarette back, LEDs and digits, a hob's rings glowing, flames, a cup filling while its kettle pours, a drip and a
## running tap, a clock's hands and pendulum, a rattling lid, a screen's static or programme, a phone buzzing. Each is
## a function of the run's time and the thing's states (life.gd: `at` for now, `history` for what was going on), at
## the kit's sockets (game/kit.json, from the kit index: item space x across, y deep, z up from the base). Nothing here
## is in a ray's way (the effects are plain nodes the cursor never sees: play.gd's ray looks at the blocks). The sounds
## (lifesound.js) are not ported yet.
extends RefCounted

const NO_FX := ["light"]      # a candle's light: play.gd's life_lights

var rt
var kit_index: Dictionary = {}
var items: Dictionary = {}    # id -> the item
var tex_glow: Texture2D = null
var tex_flame: Texture2D = null
var tex_gas: Texture2D = null
var quad: QuadMesh = null
var sm_add: Dictionary = {}   # colour hex -> an additive billboard material
var shader_clip: Shader = null
var shader_puff: Shader = null


func puff_shader() -> Shader:
	if shader_puff == null:
		shader_puff = load("res://addons/horrorstudio/puff.gdshader")
	return shader_puff
var last_T: float = -1.0


static func hash2(a: int, b: int) -> float:
	var h: int = (a * 374761393 + b * 668265263) & 0xffffffff
	h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
	return float((h ^ (h >> 16)) & 0xffffffff) / 4294967296.0


static func noise1(x: float, seed: int = 0) -> float:
	var i := int(floor(x))
	var f := x - i
	var s := f * f * (3.0 - 2.0 * f)
	return (hash2(i, seed) * (1.0 - s) + hash2(i + 1, seed) * s) * 2.0 - 1.0


static func value_at(v, age: float, secs, ease: float = 1.0) -> float:
	if not (v is Array):
		return float(v)
	var k: float = pow(clamp(age / float(secs), 0.0, 1.0), ease) if (secs != null and float(secs) > 0) else 0.0
	return float(v[0]) + (float(v[1]) - float(v[0])) * k


static func t3(a: Array) -> Vector3:        # item space (x, y deep, z up) -> the block's (x, up, -y)
	return Vector3(float(a[0]), float(a[2]), -float(a[1]))


func _init(rt_, kit_index_: Dictionary) -> void:
	rt = rt_
	kit_index = kit_index_


# ---- the pictures: a soft round glow, a candle's flame, a gas flame ----------------------------------------------
func glow_tex() -> Texture2D:
	if tex_glow == null:
		var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
		for y in 64:
			for x in 64:
				var d := Vector2(x - 31.5, y - 31.5).length() / 32.0
				var a: float = 1.0 if d < 0.05 else (0.55 + (1.0 - 0.55) * (1.0 - (d - 0.05) / 0.15) if d < 0.2 else (0.12 + (0.55 - 0.12) * (1.0 - (d - 0.2) / 0.35) if d < 0.55 else max(0.0, 0.12 * (1.0 - (d - 0.55) / 0.45))))
				img.set_pixel(x, y, Color(1, 1, 1, a))
		tex_glow = ImageTexture.create_from_image(img)
	return tex_glow


func flame_tex() -> Texture2D:              # a teardrop: a white-yellow core, an orange skirt, a blue foot
	if tex_flame == null:
		var img := Image.create(64, 128, false, Image.FORMAT_RGBA8)
		for y in 128:
			for x in 64:
				var px := (x - 32.0) / 32.0
				var py := (y - 70.0) / 60.0        # the drop's middle at 70
				var c := Color(0, 0, 0, 0)
				for layer in [[0.8, 1.0, Color(1.0, 0.47, 0.12, 0.55)], [0.52, 0.77, Color(1.0, 0.75, 0.31, 0.9)], [0.28, 0.42, Color(1.0, 0.98, 0.88, 1.0)]]:
					var w: float = layer[0]
					var h: float = layer[1]
					var yy: float = py + 0.1
					var rr: float = w * (1.0 - clamp(-yy / h, 0.0, 1.0)) if yy < 0 else w * sqrt(max(0.0, 1.0 - pow(yy / (h * 0.45), 2)))
					if abs(px) < rr and yy > -h and yy < h * 0.45:
						var col: Color = layer[2]
						c = Color(col.r, col.g, col.b, max(c.a, col.a * (1.0 - pow(abs(px) / max(rr, 1e-3), 3))))
				if Vector2(px * 32.0, (y - 112.0)).length() < 9.0:
					c = Color(0.31, 0.47, 1.0, max(c.a, 0.6))
				img.set_pixel(x, y, c)
		tex_flame = ImageTexture.create_from_image(img)
	return tex_flame


func gas_tex() -> Texture2D:                # a gas flame: a blue cone, a paler inner one
	if tex_gas == null:
		var img := Image.create(32, 64, false, Image.FORMAT_RGBA8)
		for y in 64:
			for x in 32:
				var u := (x - 16.0) / 16.0
				var v := (62.0 - y) / 58.0
				var c := Color(0, 0, 0, 0)
				if v >= 0 and v <= 1 and abs(u) < 0.8 * (1.0 - v):
					c = Color(0.16, 0.35, 1.0, 0.75)
				if v >= 0 and v <= 0.52 and abs(u) < 0.42 * (1.0 - v / 0.52):
					c = Color(0.59, 0.82, 1.0, 0.95)
				img.set_pixel(x, y, c)
		tex_gas = ImageTexture.create_from_image(img)
	return tex_gas


func add_mat(tex: Texture2D, color: Color, key: String) -> StandardMaterial3D:
	if not sm_add.has(key):
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		m.billboard_keep_scale = true
		m.albedo_texture = tex
		m.albedo_color = color
		m.no_depth_test = false
		m.disable_receive_shadows = true
		sm_add[key] = m
	return sm_add[key]


func world() -> Node3D:
	return rt.game.world


# ---- a little thing on the stage: its block, its kit (sockets, slot surfaces) and the effects its life can show -----
func attach() -> void:
	clear()
	if rt.lives == null:
		return
	for id in rt.lives.things:
		var t = rt.by_id.get(id)
		if t == null:
			continue
		var th: Dictionary = rt.lives.things[id]
		var art: Node3D = t["node"].get_node_or_null("art")
		var ref: String = ""
		for tag in t["tags"]:
			if str(tag).begins_with("art:"):
				ref = str(tag).substr(4)
		var info: Dictionary = kit_index.get(ref, {})
		var life_def: Dictionary = rt.lives.data.get("lives", {}).get(th["life"], {"states": []})
		var seed := 7
		for ch in str(id):
			seed = (seed * 31 + ch.unicode_at(0)) & 0xffffffff
		items[id] = {"id": id, "t": t, "node": t["node"], "art": art, "ref": ref, "S": info.get("sockets", {}), "d": th.get("d", {}), "life": th["life"],
			"def": life_def, "seed": seed % 9973, "parts": {}, "home": t["node"].transform, "mesh": null, "slot_nodes": {}, "own_mats": {}, "show": {}, "floor": null, "onMe": []}
		if art != null:
			for mi in art.find_children("*", "MeshInstance3D", true, false):
				items[id]["mesh"] = mi
				break
	for id in items:                         # what stands on a hob: the ring nearest it is the one that's on
		var it: Dictionary = items[id]
		var hob = items.get(it["d"].get("on"))
		if hob == null or not hob["S"].has("ring_1"):
			continue
		var p: Vector3 = it["node"].global_position
		var best = null
		var i := 1
		while hob["S"].has("ring_%d" % i):
			var dd: float = socket_world(hob, hob["S"]["ring_%d" % i])["p"].distance_to(p)
			if best == null or dd < best[1]:
				best = [i, dd]
			i += 1
		if best != null:
			hob["onMe"].append(best[0])


func clear() -> void:
	for id in items:
		for k in items[id]["parts"]:
			var p = items[id]["parts"][k]
			if p is Node and is_instance_valid(p):
				p.queue_free()
	items = {}


## a socket in world space: its point, and the way it points
func socket_world(it: Dictionary, q: Dictionary) -> Dictionary:
	var h: float = float(it["t"]["size"][2])
	var xf: Transform3D = it["node"].global_transform
	var at: Vector3 = t3(q.get("at", [0, 0, 0])) - Vector3(0, h / 2.0, 0)
	var n: Vector3 = (xf.basis * t3(q["n"])).normalized() if q.has("n") else Vector3.UP
	return {"p": xf * at, "n": n}


func rings(it: Dictionary) -> Array:
	if it["d"].get("rings") is Array:
		return it["d"]["rings"]
	if it["onMe"].size():
		return it["onMe"]
	return [1] if it["S"].has("ring_1") else []


func socks(it: Dictionary, at) -> Array:
	if at == "ring" or at == "digit":
		var out: Array = []
		for i in rings(it):
			if it["S"].has("%s_%d" % [at, i]):
				out.append(it["S"]["%s_%d" % [at, i]])
		return out
	return [it["S"][at]] if it["S"].has(at) else []


func state_def(it: Dictionary, state) -> Variant:
	for s in it["def"].get("states", []):
		if s.get("id") == state:
			return s
	return null


func fx_in(it: Dictionary, state, kind: String, at = null) -> Variant:
	var sd = state_def(it, state)
	if sd == null:
		return null
	for f in sd.get("fx", []):
		if f.get("fx") == kind and (at == null or f.get("at") == at):
			return f
	return null


## how much of a kind at a socket was going on at time tb (0..1 or its value), from the history
func rate_at(it: Dictionary, hist: Array, kind: String, at, tb: float, key: String = "rate") -> float:
	var i: int = hist.size() - 1
	while i > 0 and float(hist[i]["t"]) > tb:
		i -= 1
	if i < 0:
		return 0.0
	var h: Dictionary = hist[i]
	var f = fx_in(it, h["state"], kind, at)
	if f == null:
		return 0.0
	var sd = state_def(it, h["state"])
	var secs = f.get("secs", sd.get("secs") if sd != null else null)
	return clamp(value_at(f.get(key, 1), tb - float(h["t"]), secs, float(f.get("ease", 1))), 0.0, 1.0)


## a slot's surface on the kit mesh (its material named kit_<slot>), or -1
func slot_surface(it: Dictionary, slot: String) -> int:
	var mi: MeshInstance3D = it["mesh"]
	if mi == null or mi.mesh == null:
		return -1
	for i in mi.mesh.get_surface_count():
		var m = mi.mesh.surface_get_material(i)
		if m != null and (m.resource_name == "kit_" + slot or mi.mesh.surface_get_name(i) == "kit_" + slot):
			return i
	return -1


## the slot's material, this thing's own (duplicated once), so lighting one thing leaves the rest
func own_mat(it: Dictionary, slot: String) -> Variant:
	if it["own_mats"].has(slot):
		return it["own_mats"][slot]
	var i := slot_surface(it, slot)
	if i < 0:
		return null
	var mi: MeshInstance3D = it["mesh"]
	var m = mi.mesh.surface_get_material(i).duplicate()
	mi.set_surface_override_material(i, m)
	it["own_mats"][slot] = m
	return m


## a slot's surface as a node of its own under the art (a hand that turns, a lid that rattles), made once
func slot_node(it: Dictionary, slot: String) -> Variant:
	if it["slot_nodes"].has(slot):
		return it["slot_nodes"][slot]
	var i := slot_surface(it, slot)
	if i < 0:
		return null
	var mi: MeshInstance3D = it["mesh"]
	if not it.get("mesh_own", false):           # the same glb may stand elsewhere: this one's own mesh
		mi.mesh = mi.mesh.duplicate()
		it["mesh_own"] = true
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(mi.mesh.surface_get_primitive_type(i), mi.mesh.surface_get_arrays(i))
	am.surface_set_material(0, mi.mesh.surface_get_material(i))
	var n := MeshInstance3D.new()
	n.name = "slot_" + slot
	n.mesh = am
	mi.add_child(n)
	mi.mesh.surface_remove(i)
	it["slot_nodes"][slot] = n
	return n


func part(it: Dictionary, key: String, make: Callable) -> Variant:
	if not it["parts"].has(key):
		it["parts"][key] = make.call()
	return it["parts"][key]


func sprite(tex: Texture2D, color: Color, key: String, size: Vector2) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = size
	m.mesh = qm
	m.material_override = add_mat(tex, color, key).duplicate()
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world().add_child(m)
	return m


# ---- every frame --------------------------------------------------------------------------------------------------
func update(T: float) -> void:
	if items.is_empty():
		return
	var dt: float = max(0.0, T - last_T) if last_T >= 0 else 0.0
	last_T = T
	var now: Array = []
	for id in items:
		var st = rt.lives.at(id, T)
		if st != null:
			now.append([items[id], st, rt.lives.history(id)])
	for row in now:                           # what's lifted, first
		var it: Dictionary = row[0]
		for s in it["def"].get("states", []):
			for f in s.get("fx", []):
				if f.get("fx") == "pour":
					pour(it, row[1], T)
					break
	for row in now:
		item(row[0], row[1], row[2], T, dt)


func item(it: Dictionary, st: Dictionary, hist: Array, T: float, dt: float) -> void:
	var fx_now: Array = st["def"].get("fx", []) if st["def"] != null else []
	it["show"]["steam"] = 0.0                  # the strongest of its sockets this frame (each socket's own under steam@<at>)
	it["show"]["smoke"] = 0.0
	var all: Dictionary = {}
	for s in it["def"].get("states", []):
		for f in s.get("fx", []):
			all[str(f.get("fx")) + "@" + str(f.get("at", ""))] = f
	for key in all:
		var f: Dictionary = all[key]
		var kind: String = f.get("fx")
		var on = null
		for g in fx_now:
			if g.get("fx") == kind and (not f.has("at") or g.get("at") == f.get("at")):
				on = g
		if kind == "steam" or kind == "smoke":
			var qs := socks(it, f.get("at"))
			var rate := rate_at(it, hist, kind, f.get("at"), T)
			for i in qs.size():
				var q: Dictionary = qs[i]
				var w := socket_world(it, q)
				var P: Dictionary = part(it, key + str(i), func(): return puffs_new(kind, bool(f.get("fine", false))))
				var p: Vector3 = tip_now(it, st)["p"] if (kind == "smoke" and q == it["S"].get("tip")) else w["p"]
				var area: float = float(q.get("r", 0.05)) * 0.9 if (f.get("at") in ["steam", "lid", "rim"]) else 0.0
				puffs_update(P, T, dt, p, w["n"] if kind == "steam" else Vector3.UP, rate, it["seed"] + i, area)
				it["show"][kind + "@" + str(f.get("at"))] = rate
				it["show"][kind] = max(float(it["show"][kind]), rate)
		elif kind == "led" or kind == "ember":
			var q = it["S"].get(f.get("at"))
			if q == null:
				continue
			var r: float = float(q.get("r", 0.002))
			var g: MeshInstance3D = part(it, key, func(): return sprite(glow_tex(), Color.WHITE, "glow", Vector2.ONE * r * (9.0 if kind == "ember" else 10.0)))
			if on == null:
				g.visible = false
				it["show"][kind] = false
				continue
			var col := Color(1.0, 0.35, 0.08) if kind == "ember" else Color.html(str(on.get("color", "#3c8cff")))
			var k := 1.0
			if kind == "ember":
				k = 0.75 + 0.25 * noise1(T * 1.7, it["seed"]) + 0.3 * max(0.0, noise1(T * 0.23, it["seed"] + 5) - 0.5)
			if on.get("blink") != null:
				k *= 1.0 if sin(T * TAU / max(0.01, float(on["blink"]))) > 0 else 0.08
			var w: Dictionary = tip_now(it, st) if kind == "ember" else socket_world(it, q)
			g.visible = true
			g.global_position = w["p"] + w["n"] * 0.001
			g.material_override.albedo_color = Color(col.r, col.g, col.b, 0.9 * k)
			it["show"][kind] = k
		elif kind == "burn":
			burn(it, st)
		elif kind == "digits":
			var qs := socks(it, f.get("at"))
			for i in qs.size():
				var q: Dictionary = qs[i]
				var lab: Label3D = part(it, key + str(i), func(): return digits_new(q, f.get("at") == "lcd"))
				lab.visible = on != null
				if on == null:
					continue
				var sd = st["def"] if st["def"] != null else {}
				var text := ""
				if on.get("text") == "level":
					text = str(it["d"].get("level", 6))
				elif on.has("text"):
					text = str(on["text"])
				elif on.get("count") == "down":
					var left: float = max(0.0, float(st["secs"] if st["secs"] != null else 0.0) - float(st["age"]))
					text = "%d:%02d" % [int(left / 60), int(fmod(left, 60.0))]
				elif on.has("value"):
					var secs2 = on.get("secs", sd.get("secs", st["secs"]))
					var val: float = value_at(on["value"], float(st["age"]), secs2)
					text = str(int(round(val))) + str(on.get("unit", ""))
				lab.text = text
				var w := socket_world(it, q)
				var up: Vector3 = (it["node"].global_transform.basis * t3(q["up"])).normalized() if q.has("up") else Vector3.UP
				lab.global_transform = Transform3D(Basis(up.cross(w["n"]).normalized(), up, w["n"]), w["p"] + w["n"] * 0.0004)
				it["show"]["digits"] = text
		elif kind == "glow":
			var level := rate_at(it, hist, "glow", f.get("at"), T, "level")
			for i in rings(it):
				var q = it["S"].get("ring_%d" % i)
				if q == null or not q.has("slot"):
					continue
				var flick := 0.92 + 0.08 * noise1(T * 3 + i, it["seed"])
				var m = own_mat(it, q["slot"])
				if m is StandardMaterial3D:
					m.emission_enabled = true
					m.emission = Color(1.0, 0.19, 0.03)
					m.emission_energy_multiplier = 2.2 * level * flick
					m.albedo_color = Color(0.23, 0.06, 0.02) if level > 0.02 else Color(0.07, 0.05, 0.05)
				var g: MeshInstance3D = part(it, key + str(i), func(): return sprite(glow_tex(), Color(1.0, 0.25, 0.06), "glow_hob", Vector2.ONE * float(q.get("r", 0.05)) * 3.2))
				var w := socket_world(it, q)
				g.global_position = w["p"] + Vector3(0, 0.002, 0)
				g.material_override.albedo_color = Color(1.0, 0.25, 0.06, 0.55 * level * flick)
				g.visible = level > 0.01
				it["show"]["glow"] = level
		elif kind == "flame":
			var qs := socks(it, f.get("at"))
			for i in qs.size():
				var q: Dictionary = qs[i]
				if f.get("kind") == "gas":
					var g: Node3D = part(it, key + str(i), func():
						var grp := Node3D.new()
						world().add_child(grp)
						for j in 22:
							var s := sprite(gas_tex(), Color.WHITE, "gas", Vector2(0.011, 0.024))
							s.reparent(grp)
						return grp)
					g.visible = on != null
					if on == null:
						continue
					var w := socket_world(it, q)
					var r: float = float(q.get("r", 0.04))
					for j in g.get_child_count():
						var s: MeshInstance3D = g.get_child(j)
						var a: float = float(j) / g.get_child_count() * TAU
						var fl := 0.75 + 0.25 * noise1(T * 9 + j * 3.1, it["seed"])
						s.global_position = Vector3(w["p"].x + cos(a) * r * 1.02, w["p"].y + 0.006, w["p"].z + sin(a) * r * 1.02)
						s.scale = Vector3(1, fl, 1)
				else:
					var s: MeshInstance3D = part(it, key + str(i), func(): return sprite(flame_tex(), Color.WHITE, "flame", Vector2(0.011, 0.034)))
					s.visible = on != null
					if on == null:
						continue
					var w := socket_world(it, q)
					var big: float = 0.8 if f.get("kind") == "lighter" else 1.0
					var fl := 1.0 + 0.12 * noise1(T * 7, it["seed"]) + 0.06 * noise1(T * 23, it["seed"] + 1)
					s.global_position = w["p"] + Vector3(0.0015 * noise1(T * 3, it["seed"] + 2), 0.017 * big * fl, 0.0015 * noise1(T * 3.3, it["seed"] + 4))
					s.scale = Vector3(big * (2.0 - fl), big * fl, 1)
				it["show"]["flame"] = on != null
		elif kind == "fill":
			fill(it, st)
		elif kind == "drip" or kind == "stream":
			water(it, st, kind, f, T, key)
		elif kind == "hands":
			hands(it, st)
		elif kind == "pendulum":
			var q = it["S"].get("pendulum")
			var m = slot_node(it, q["slot"]) if (q != null and q.has("slot")) else null
			if m == null:
				continue
			var Tp: float = TAU * sqrt(float(q.get("len", 0.25)) / 9.81)
			var run: float = float(st["spent"].get(st["state"], 0.0))
			var ang: float = 0.09 * sin(TAU * run / Tp) if on != null else 0.0
			turn(m, t3(q["at"]), Vector3(0, 0, -1), ang)
		elif kind == "rattle":
			var q = it["S"].get("lid")
			var m = slot_node(it, q["slot"]) if (q != null and q.has("slot")) else null
			if m == null:
				continue
			var k: float = max(0.0, noise1(T * 11, it["seed"]) * noise1(T * 4.3, it["seed"] + 1)) if on != null else 0.0
			m.position = Vector3(0, k * 0.003, 0)
			m.rotation = Vector3(k * 0.03 * noise1(T * 7, it["seed"] + 2), 0, k * 0.03 * noise1(T * 6, it["seed"] + 3))
			it["show"]["rattle"] = k
		elif kind == "screen":
			screen(it, on, T, key)
		elif kind == "buzz":
			var burst: bool = on != null and fmod(T, 2.0) < 0.9
			var xf: Transform3D = it["home"]
			if burst:
				xf.origin += Vector3(noise1(T * 60, it["seed"]) * 0.0012, 0, noise1(T * 57, it["seed"] + 1) * 0.0012)
			it["node"].transform = xf
			it["show"]["buzz"] = burst


# ---- puffs: soft round points born on a schedule from a socket (steam, smoke) ---------------------------------------
func puffs_new(kind: String, fine: bool) -> Dictionary:
	var o: Dictionary
	# the desk's schedule and sizes (lifefx.js); the alphas for alpha blending (the desk adds its puffs)
	if kind == "steam" and fine:
		o = {"color": Color(0.93, 0.95, 0.96), "rate": 14.0, "life": 2.0, "size": [0.012, 0.06], "rise": 0.08, "speed": 0.03, "spread": 0.015, "curl": 0.02, "alpha": 0.3, "spin": 1.2}
	elif kind == "steam":
		o = {"color": Color(0.95, 0.96, 0.97), "rate": 48.0, "life": 1.8, "size": [0.024, 0.16], "rise": 0.22, "speed": 0.4, "spread": 0.05, "curl": 0.04, "alpha": 0.26, "spin": 1.0}
	else:
		o = {"color": Color(0.36, 0.37, 0.4), "rate": 30.0, "life": 2.2, "size": [0.006, 0.045], "rise": 0.15, "speed": 0.02, "spread": 0.01, "curl": 0.03, "alpha": 0.5, "spin": 1.6}
	var n: int = int(ceil(o["rate"] * o["life"])) + 2
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true                  # x the puff's age, y its seed, z its spin (puff.gdshader)
	mm.mesh = QuadMesh.new()
	mm.mesh.size = Vector2.ONE
	mm.instance_count = n
	for i in n:
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ZERO), Vector3(0, -99, 0)))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	var m := ShaderMaterial.new()                # soft noise-eroded discs, lit, faded into the scene (puff.gdshader)
	m.shader = puff_shader()
	m.set_shader_parameter("color", o["color"])
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world().add_child(mi)
	return {"node": mi, "mm": mm, "o": o, "n": n, "born": [], "acc": 0.0, "next": 0}


func puffs_update(P: Dictionary, T: float, dt: float, p: Vector3, dir: Vector3, rate: float, seed: int, area: float) -> void:
	var o: Dictionary = P["o"]
	P["acc"] = float(P["acc"]) + rate * float(o["rate"]) * dt
	var born: Array = P["born"]
	while P["acc"] >= 1.0:
		P["acc"] = float(P["acc"]) - 1.0
		var i: int = P["next"]
		P["next"] = (i + 1) % P["n"]
		var a := hash2(seed, i * 7 + int(T * 50)) * TAU
		var rr: float = sqrt(hash2(seed, i * 11 + int(T * 50))) * area
		var side := dir.cross(Vector3.UP if abs(dir.y) < 0.9 else Vector3.RIGHT).normalized()
		var up2 := side.cross(dir)
		var at := p + side * cos(a) * rr + up2 * sin(a) * rr
		var vel := dir * float(o["speed"]) + Vector3.UP * float(o["rise"]) + (side * cos(a) + up2 * sin(a)) * float(o["spread"]) * (hash2(seed, i + 3) * 2.0 - 1.0)
		var slot := {"i": i, "t0": T, "p": at, "v": vel, "curl": hash2(seed, i + 9) * TAU, "seed": hash2(seed, i + 21), "spin": (hash2(seed, i + 33) * 2.0 - 1.0) * float(o.get("spin", 1.0))}
		if born.size() < P["n"]:
			born.append(slot)
		else:
			born[i] = slot
	var mm: MultiMesh = P["mm"]
	for b in born:
		var age: float = T - float(b["t0"])
		var life: float = float(o["life"])
		if age > life or age < 0:
			mm.set_instance_transform(b["i"], Transform3D(Basis().scaled(Vector3.ZERO), Vector3(0, -99, 0)))
			continue
		var u := age / life
		var size: float = float(o["size"][0]) + (float(o["size"][1]) - float(o["size"][0])) * u
		var pos: Vector3 = b["p"] + b["v"] * age + Vector3(sin(b["curl"] + age * 2.0), 0, cos(b["curl"] + age * 1.7)) * float(o["curl"]) * u
		mm.set_instance_transform(b["i"], Transform3D(Basis().scaled(Vector3.ONE * size), pos))
		var c: Color = o["color"]
		mm.set_instance_color(b["i"], Color(c.r, c.g, c.b, float(o["alpha"]) * (1.0 - u * u) * min(1.0, u * 6.0)))
		mm.set_instance_custom_data(b["i"], Color(u, float(b["seed"]), float(b["spin"]), 0.0))
	P["node"].visible = born.size() > 0


# ---- digits, screens ----------------------------------------------------------------------------------------------
func digits_new(q: Dictionary, lcd: bool) -> Label3D:
	var lab := Label3D.new()
	lab.font_size = 64
	lab.pixel_size = float(q.get("h", 0.018)) / 64.0 * 0.95
	lab.modulate = Color(0.16, 0.09, 0.02) if lcd else Color(1.0, 0.16, 0.1)
	lab.outline_size = 0
	lab.no_depth_test = false
	lab.double_sided = false
	lab.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lab.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	if lcd:                                   # an LCD: its backlight behind the dark digits
		var back := MeshInstance3D.new()
		var qm := QuadMesh.new()
		qm.size = Vector2(float(q.get("w", 0.012)) * 1.4, float(q.get("h", 0.018)) * 1.1)
		back.mesh = qm
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = Color(1.0, 0.73, 0.38)
		back.material_override = m
		back.position = Vector3(0, 0, -0.0002)
		lab.add_child(back)
	world().add_child(lab)
	return lab


func screen(it: Dictionary, on, T: float, key: String) -> void:
	var q = it["S"].get("screen")
	var m: MeshInstance3D = part(it, key, func():
		var mi := MeshInstance3D.new()
		var qm := QuadMesh.new()
		var w: float = float(q["w"]) if q != null else float(it["t"]["size"][0]) * 0.92
		var h: float = float(q["h"]) if q != null else float(it["t"]["size"][2]) * 0.86
		qm.size = Vector2(w, h)
		mi.mesh = qm
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		var img := Image.create(64, 48, false, Image.FORMAT_RGB8)
		img.fill(Color.BLACK)
		mat.albedo_texture = ImageTexture.create_from_image(img)
		mi.material_override = mat
		mi.set_meta("img", img)
		mi.set_meta("frame", -1)
		var lab := Label3D.new()
		lab.name = "words"
		lab.font_size = 48
		lab.pixel_size = h / 48.0 * 0.35
		lab.position = Vector3(0, h * 0.12, 0.0003)
		lab.modulate = Color(0.91, 0.93, 0.96)
		mi.add_child(lab)
		world().add_child(mi)
		return mi)
	if q != null:                              # on its socket (a phone's face); a kit panel's: the block's front
		var w := socket_world(it, q)
		var up: Vector3 = (it["node"].global_transform.basis * t3(q.get("up", [0, 0, 1]))).normalized()
		m.global_transform = Transform3D(Basis(up.cross(w["n"]).normalized(), up, w["n"]), w["p"] + w["n"] * 0.0003)
	else:
		var xf: Transform3D = it["node"].global_transform
		m.global_transform = Transform3D(xf.basis, xf * Vector3(0, 0, float(it["t"]["size"][1]) / 2.0 + 0.0005))
	m.visible = on != null
	it["show"]["screen"] = on.get("mode") if on != null else null
	if on == null:
		return
	var frame := int(floor(T * 15))
	var lab: Label3D = m.get_node("words")
	if int(m.get_meta("frame")) == frame and m.get_meta("mode", "") == on.get("mode"):
		return
	m.set_meta("frame", frame)
	m.set_meta("mode", on.get("mode"))
	var img: Image = m.get_meta("img")
	var W := img.get_width()
	var H := img.get_height()
	var mode = on.get("mode")
	if mode == "static":
		for y in H:
			for x in W:
				var v: float = hash2(y * W + x, frame) * 0.78 + 0.12
				img.set_pixel(x, y, Color(v, v, min(1.0, v * 1.05)))
		for y in range((frame * 3) % 6, H, 6):
			for x in W:
				var c := img.get_pixel(x, y)
				img.set_pixel(x, y, c * 0.75)
		lab.text = ""
	elif mode == "on":                         # a programme seen from across the room: shifting blocks of colour
		var k := int(floor(T / 3.1))
		img.fill(Color(0.05, 0.05, 0.07))
		for i in 6:
			var col := Color.from_hsv(hash2(k, i), 0.3 + hash2(k, i + 3) * 0.4, 0.25 + hash2(k, i + 4) * 0.35)
			var x0 := int(hash2(k, i + 9) * W) - int(W * 0.4)
			var y0 := int(hash2(k, i + 19) * H) - int(H * 0.3)
			img.fill_rect(Rect2i(x0, y0, int(W * 0.8), int(H * 0.6)).intersection(Rect2i(0, 0, W, H)), col)
		lab.text = ""
	else:                                      # a phone: its lock screen, or a call coming in (着信)
		var call: bool = mode == "call"
		for y in H:
			var u := float(y) / H
			var c := Color(0.06, 0.16, 0.11).lerp(Color(0.03, 0.07, 0.05), u) if call else Color(0.11, 0.14, 0.25).lerp(Color(0.23, 0.14, 0.25), u)
			for x in W:
				img.set_pixel(x, y, c)
		if call:
			var r := int(6 + 3 * abs(sin(T * 4)))
			for y in range(max(0, int(H * 0.7) - r), min(H, int(H * 0.7) + r)):
				for x in range(max(0, W / 2 - r), min(W, W / 2 + r)):
					if Vector2(x - W / 2.0, y - H * 0.7).length() < r:
						img.set_pixel(x, y, Color(0.29, 0.87, 0.5))
		lab.text = "着信" if call else "02:47"
	(m.material_override as StandardMaterial3D).albedo_texture.update(img)
	it["show"]["screen_frame"] = frame


# ---- the clock's hands, a burning tip, the cup's fill, the pour, water ---------------------------------------------
func turn(m: Node3D, pivot: Vector3, axis: Vector3, ang: float) -> void:
	var b := Basis(axis.normalized(), ang)
	m.transform = Transform3D(b, pivot - b * pivot)


func hands(it: Dictionary, st: Dictionary) -> void:
	var q = it["S"].get("hub")
	if q == null or not q.has("hands"):
		return
	var run: float = float(st["spent"].get("running", 0.0))
	var hd: Dictionary = q["hands"]
	var ang := {"h": float(hd.get("h", 0)) + run / 120.0, "m": float(hd.get("m", 0)) + run / 10.0, "s": float(hd.get("s", 0)) + floor(run) * 6.0}
	for k in q.get("slots", {}):
		var m = slot_node(it, q["slots"][k])
		if m == null or not hd.has(k):
			continue
		turn(m, t3(q["at"]), Vector3(0, 0, -1), deg_to_rad(float(ang[k]) - float(hd[k])))
	it["show"]["hands"] = ang


func burnt(it: Dictionary, st: Dictionary) -> float:
	var q = it["S"].get("tip")
	if q == null or not q.has("len"):
		return 0.0
	var lit: float = float(st["spent"].get("lit", 0.0))
	var sd = state_def(it, "lit")
	var secs: float = float(sd["secs"]) if (sd != null and sd.has("secs")) else 420.0
	var own = it["d"].get("secs", {}).get("lit") if it["d"].get("secs") is Dictionary else null
	return float(q["len"]) * clamp(lit / (float(own) if own != null else secs), 0.0, 1.0) * 0.97


func tip_now(it: Dictionary, st: Dictionary) -> Dictionary:
	var q = it["S"].get("tip")
	if q == null:
		return {"p": it["node"].global_position, "n": Vector3.UP}
	var w := socket_world(it, q)
	var b := burnt(it, st)
	return {"p": w["p"] - w["n"] * (b + float(q.get("r", 0.004)) * 0.1), "n": w["n"]}


func clip_shader() -> Shader:
	if shader_clip == null:
		shader_clip = Shader.new()
		shader_clip.code = """shader_type spatial;
uniform vec4 albedo : source_color = vec4(1.0);
uniform float roughness : hint_range(0.0, 1.0) = 0.8;
uniform vec3 p0; uniform vec3 n; uniform vec3 side; uniform vec3 up; uniform float r = 0.006; uniform float cap = 0.03;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec3 d = wpos - p0;
	float a = dot(d, n);
	if (a > 0.0 && a < cap && abs(dot(d, side)) < r && abs(dot(d, up)) < r) discard;
	ALBEDO = albedo.rgb; ROUGHNESS = roughness;
}"""
	return shader_clip


## the cigarette burnt back to its line: what's past it clipped away (inside a box round this end only, so the butts
## beside it stay whole), the ash it leaves
func burn(it: Dictionary, st: Dictionary) -> void:
	var q = it["S"].get("tip")
	if q == null or not q.has("len"):
		return
	var w := socket_world(it, q)
	var b := burnt(it, st)
	var r: float = float(q.get("r", 0.004))
	var n: Vector3 = w["n"]
	var p0: Vector3 = w["p"] - n * b
	var side := n.cross(Vector3.UP if abs(n.y) < 0.9 else Vector3.RIGHT).normalized()
	var up := side.cross(n)
	for slot in ["cig", "ash", "ash_2", "tobacco"]:
		var i := slot_surface(it, slot)
		if i < 0:
			continue
		var mi: MeshInstance3D = it["mesh"]
		if b > 0.0002:
			var sm = it["own_mats"].get("clip:" + slot)
			if sm == null:
				var base = mi.mesh.surface_get_material(i)
				sm = ShaderMaterial.new()
				sm.shader = clip_shader()
				if base is StandardMaterial3D:
					sm.set_shader_parameter("albedo", base.albedo_color)
					sm.set_shader_parameter("roughness", base.roughness)
				mi.set_surface_override_material(i, sm)
				it["own_mats"]["clip:" + slot] = sm
			sm.set_shader_parameter("p0", p0)
			sm.set_shader_parameter("n", n)
			sm.set_shader_parameter("side", side)
			sm.set_shader_parameter("up", up)
			sm.set_shader_parameter("r", r * 1.6)
			sm.set_shader_parameter("cap", b + 0.03)
		elif it["own_mats"].has("clip:" + slot):
			mi.set_surface_override_material(i, null)
			it["own_mats"].erase("clip:" + slot)
	var ash: MeshInstance3D = part(it, "burn:ash", func():
		var m := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 1.0
		cm.bottom_radius = 0.96
		cm.height = 1.0
		cm.radial_segments = 14
		m.mesh = cm
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.56, 0.55, 0.53)
		mat.roughness = 1.0
		m.material_override = mat
		world().add_child(m)
		return m)
	var ln: float = fmod(b, 0.011) + 0.0006 if b > 0.0003 else 0.0
	ash.visible = ln > 0.0004
	if ash.visible:
		var basis := Basis(side, n, up).scaled(Vector3(r * 0.97, ln, r * 0.97))
		ash.global_transform = Transform3D(basis, p0 + n * ln / 2.0)
	it["show"]["burn"] = b


## a cup's tea: the inside of the cup filled to its level (the inner wall's profile, turned), the liquid's colour
func fill(it: Dictionary, st: Dictionary) -> void:
	var q = it["S"].get("inner")
	if q == null or not q.has("prof"):
		return
	var f = null
	for x in (st["def"].get("fx", []) if st["def"] != null else []):
		if x.get("fx") == "fill":
			f = x
	var level: float = value_at(f["level"], float(st["age"]), f.get("secs", st["secs"]), float(f.get("ease", 1))) if f != null else 0.0
	var prof: Array = q["prof"]
	var z0 := float(prof[0][1])
	var z1 := float(prof[prof.size() - 1][1])
	var z: float = z0 + (z1 - z0) * clamp(level, 0.0, 1.0)
	var m: MeshInstance3D = part(it, "fill", func():
		var mi := MeshInstance3D.new()
		var mat := StandardMaterial3D.new()
		mat.roughness = 0.08
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color = Color(0.6, 0.35, 0.13, 0.94)
		mi.material_override = mat
		mi.set_meta("z", -1.0)
		it["node"].add_child(mi)
		return mi)
	m.visible = level > 0.005
	it["show"]["fill"] = level
	if not m.visible:
		return
	var liquids: Dictionary = rt.lives.data.get("liquids", {})
	var col := Color.html(str(liquids.get(it["d"].get("liquid", "tea"), "#9a5a22")))
	(m.material_override as StandardMaterial3D).albedo_color = Color(col.r, col.g, col.b, 0.45 if it["d"].get("liquid") == "water" else 0.94)
	if abs(float(m.get_meta("z")) - z) < 0.0003:
		return
	m.set_meta("z", z)
	var pts: Array = [[0.0, z0]]
	for rz in prof:
		if float(rz[1]) >= z:
			break
		pts.append([float(rz[0]) * 0.985, float(rz[1])])
	var rr: float = float(prof[0][0])
	for i in prof.size() - 1:
		if float(prof[i][1]) <= z and float(prof[i + 1][1]) >= z:
			var k: float = (z - float(prof[i][1])) / max(1e-6, float(prof[i + 1][1]) - float(prof[i][1]))
			rr = float(prof[i][0]) + (float(prof[i + 1][0]) - float(prof[i][0])) * k
	pts.append([rr * 0.985, z])
	pts.append([0.0, z])
	m.mesh = lathe(pts, 40)
	var h: float = float(it["t"]["size"][2])
	m.position = Vector3(float(q["at"][0]), -h / 2.0, -float(q["at"][1]))


func lathe(pts: Array, segs: int) -> ArrayMesh:
	var stool := SurfaceTool.new()
	stool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in pts.size() - 1:
		for j in segs:
			var a0 := float(j) / segs * TAU
			var a1 := float(j + 1) / segs * TAU
			var r0 := float(pts[i][0])
			var r1 := float(pts[i + 1][0])
			var y0 := float(pts[i][1])
			var y1 := float(pts[i + 1][1])
			var p00 := Vector3(cos(a0) * r0, y0, sin(a0) * r0)
			var p01 := Vector3(cos(a1) * r0, y0, sin(a1) * r0)
			var p10 := Vector3(cos(a0) * r1, y1, sin(a0) * r1)
			var p11 := Vector3(cos(a1) * r1, y1, sin(a1) * r1)
			for tri in [[p00, p10, p01], [p01, p10, p11]]:
				var nrm: Vector3 = (tri[1] - tri[0]).cross(tri[2] - tri[0])
				if nrm.length() < 1e-12:
					continue
				stool.set_normal(nrm.normalized())
				for v in tri:
					stool.add_vertex(v)
	return stool.commit()


## a pour: the cup's `from` kettle lifted over it and tipped, a stream from its spout into the cup, then put back
func pour(it: Dictionary, st: Dictionary, T: float) -> void:
	var src = items.get(it["d"].get("from"))
	var on := false
	for x in (st["def"].get("fx", []) if st["def"] != null else []):
		if x.get("fx") == "pour":
			on = true
	var stream: Node3D = part(it, "pour:stream", func():
		var g := Node3D.new()
		for i in 11:
			var s := MeshInstance3D.new()
			var sph := SphereMesh.new()
			sph.radius = 0.003
			sph.height = 0.006
			s.mesh = sph
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.79, 0.87, 0.89, 0.75)
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			mat.roughness = 0.05
			s.material_override = mat
			g.add_child(s)
		world().add_child(g)
		return g)
	if src == null or not src["S"].has("spout"):
		stream.visible = false
		return
	var secs: float = float(st["secs"]) if st["secs"] != null else 4.0
	var u: float = clamp(float(st["age"]) / secs, 0.0, 1.0) if on else 0.0
	var sm1: float = clamp(u / 0.22, 0.0, 1.0)
	var sm2: float = clamp((u - 0.82) / 0.18, 0.0, 1.0)
	var lift: float = (sm1 * sm1 * (3 - 2 * sm1)) * (1.0 - sm2 * sm2 * (3 - 2 * sm2)) if on else 0.0
	src["node"].transform = src["home"]
	it["show"]["pour"] = lift
	if lift <= 0:
		stream.visible = false
		return
	var rim := socket_world(it, it["S"].get("rim", it["S"].get("inner", {"at": [0, 0, 0]})))
	var sp := socket_world(src, src["S"]["spout"])
	var centre: Vector3 = src["node"].global_position
	var hor := Vector3(sp["n"].x, 0, sp["n"].z)
	if hor.length_squared() < 1e-6:
		hor = Vector3.RIGHT
	hor = hor.normalized()
	var axis := Vector3.UP.cross(hor).normalized()
	var tilt := Basis(axis, 0.62 * lift)
	var off: Vector3 = tilt * (sp["p"] - centre)
	var target: Vector3 = rim["p"] + Vector3(0, 0.09, 0) - hor * 0.01 - off
	var now: Vector3 = centre.lerp(target, lift)
	var xf: Transform3D = src["home"]
	xf.basis = tilt * xf.basis
	xf.origin = src["node"].get_parent().global_transform.affine_inverse() * now if src["node"].get_parent() is Node3D else now
	src["node"].transform = xf
	var sp2 := socket_world(src, src["S"]["spout"])
	var flow: float = clamp((lift - 0.6) / 0.4, 0.0, 1.0)
	stream.visible = flow > 0.05
	if not stream.visible:
		return
	var bottom: float = rim["p"].y - 0.02
	for i in 11:
		var a: float = i / 10.0 * 0.14
		var p: Vector3 = sp2["p"] + hor * 0.25 * a + Vector3(0, -4.9 * a * a, 0)
		p.y = max(p.y, bottom)
		var s: MeshInstance3D = stream.get_child(i)
		s.global_position = p
		s.scale = Vector3.ONE * (0.6 + 0.6 * flow)


## a drip (a drop every `every` seconds falls to what's under the spout, a ring where it lands) or a running tap
func water(it: Dictionary, st: Dictionary, kind: String, f: Dictionary, T: float, key: String) -> void:
	var q = it["S"].get("spout")
	if q == null:
		return
	var on = null
	for x in (st["def"].get("fx", []) if st["def"] != null else []):
		if x.get("fx") == kind:
			on = x
	var w := socket_world(it, q)
	if it["floor"] == null:                    # what's under the spout: found once
		var among: Array = []
		for s in rt.solid:
			if s["id"] != it["id"]:
				among.append(s)
		var hit = rt.ray_hit(w["p"] + Vector3(0, -0.01, 0), Vector3.DOWN, 1.2, among)
		it["floor"] = float(hit["point"].y) if (hit != null and hit.has("point")) else w["p"].y - 0.35
	var floor_y: float = it["floor"]
	var fall: float = max(0.03, w["p"].y - floor_y)
	if kind == "drip":
		var every: float = float(on.get("every", f.get("every", 2.6))) if on != null else float(f.get("every", 2.6))
		var tf: float = sqrt(2.0 * fall / 9.81)
		var drop: MeshInstance3D = part(it, key + ":d", func():
			var m := MeshInstance3D.new()
			var sph := SphereMesh.new()
			sph.radius = 0.0028
			sph.height = 0.0056
			m.mesh = sph
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.84, 0.9, 0.93, 0.8)
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.material_override = mat
			world().add_child(m)
			return m)
		var ring: MeshInstance3D = part(it, key + ":r", func():
			var m := MeshInstance3D.new()
			var tm := TorusMesh.new()
			tm.inner_radius = 0.8
			tm.outer_radius = 1.0
			m.mesh = tm
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.84, 0.9, 0.93, 0.5)
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			m.material_override = mat
			world().add_child(m)
			return m)
		if on == null:
			drop.visible = false
			ring.visible = false
			return
		var n: float = floor(T / every)
		var a: float = T - n * every - 0.8          # a drop swells 0.8 s at the spout, then falls
		drop.visible = a < tf
		ring.visible = a >= tf and a < tf + 0.35
		if a < 0:
			drop.global_position = w["p"]
			drop.scale = Vector3.ONE * (0.5 + 0.5 * clamp(1.0 + a / 0.8, 0.0, 1.0))
		elif a < tf:
			drop.global_position = w["p"] + Vector3(0, -4.905 * a * a, 0)
			drop.scale = Vector3(0.85, 1.25, 0.85)
		if ring.visible:
			var uu: float = (a - tf) / 0.35
			ring.global_position = Vector3(w["p"].x, floor_y + 0.001, w["p"].z)
			ring.scale = Vector3.ONE * (0.004 + 0.022 * uu)
			(ring.material_override as StandardMaterial3D).albedo_color.a = 0.5 * (1.0 - uu)
		it["show"]["drip"] = a
	else:
		var col: MeshInstance3D = part(it, key + ":c", func():
			var m := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 1.0
			cm.bottom_radius = 1.0
			cm.height = 1.0
			cm.radial_segments = 10
			m.mesh = cm
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.84, 0.9, 0.93, 0.55)
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			mat.roughness = 0.02
			m.material_override = mat
			world().add_child(m)
			return m)
		col.visible = on != null
		it["show"]["stream"] = on != null
		if on == null:
			return
		col.global_transform = Transform3D(Basis().scaled(Vector3(0.0042, fall, 0.0042)), Vector3(w["p"].x + 0.0006 * noise1(T * 13, it["seed"]), (w["p"].y + floor_y) / 2.0, w["p"].z))


## what each thing shows now (the checks): id -> {kind: value}
func report() -> Dictionary:
	var out: Dictionary = {}
	for id in items:
		out[id] = items[id]["show"].duplicate()
	return out
