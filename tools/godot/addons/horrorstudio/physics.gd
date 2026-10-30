## Physics for Play (GAMEPLAY_PLAN §10; the desk's physics.js, ported): things that move as things do. The level's
## blocks are Godot's static bodies already (the export's StaticBody3D with its box); a thing that moves is a
## RigidBody3D that sleeps when it settles: a die (its face on top read then). How a thing moves is its physics
## kind (`rigid`, `plushie`): its body, where the hand holds it (`hand`: metres right, up and ahead of the eye), how
## it follows the hand (`follow` a spring's stiffness, `give` its damping), and the soft shape's squash and its top's
## lean. The thing in the hand is a copy of it (its art or its block) sprung after the hand each frame.
extends RefCounted

const KINDS := {
	"rigid": {"mass": 1.0, "bounce": 0.25, "friction": 0.35, "damping": 0.12, "spin": 0.12, "follow": 1500.0, "give": 0.9, "turn": 30.0, "hand": [0.22, -0.24, -0.55]},
	"plushie": {"mass": 0.35, "bounce": 0.04, "friction": 0.85, "damping": 0.45, "spin": 0.6, "follow": 600.0, "give": 0.4, "turn": 9.0,
		"squash": 0.9, "floppy": 0.45, "jiggle": 1.0, "round": 0.65, "hand": [0.2, -0.27, -0.66]},
}
const STEP := 1.0 / 120.0
const DIE_FACES := [2, 5, 1, 6, 3, 4]                 # +x, -x, +y, -y, +z, -z: opposite faces add up to 7
const AXES := [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, -1, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]
const PIPS := {1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
	5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]}

var rt
var hand = null                   # {entry, node, s, kind, st} the thing in the hand
var rolls: Dictionary = {}        # id -> {t, body, t0, s}
var die_mats: Array = []


func _init(rt_) -> void:
	rt = rt_


static func kind_of(t: Dictionary) -> Dictionary:
	var d: Dictionary = t["piece"].get("d", {}) if t["piece"].get("d") is Dictionary else {}
	var name: String = str(d.get("physics", "rigid"))
	var s: Dictionary = KINDS.get(name, KINDS["rigid"]).duplicate()
	if d.has("jiggle"):
		s["jiggle"] = float(d["jiggle"])
	s["name"] = name
	return s


# ---- the thing in the hand ------------------------------------------------------------------------------------------
## a copy of the thing to hold: its art (the kit's or the library's mesh) when it has one, else its block
static func copy_of(t: Dictionary) -> Node3D:
	var n: Node3D = t["node"]
	var g := Node3D.new()
	g.name = "held_" + str(t["id"])
	var art = n.get_node_or_null("art")
	var src: Node3D = art if art != null else n.get_node_or_null("mesh")
	if src != null:
		var c: Node3D = src.duplicate()
		c.visible = true
		c.transform = src.transform
		g.add_child(c)
	return g


func take(e: Dictionary) -> void:
	e["copy"] = copy_of(e["thing"])
	e["physics"] = kind_of(e["thing"])
	var sz: Array = e["thing"]["size"]
	e["r"] = max(float(sz[0]), float(sz[1])) / 2.0
	e["h"] = float(sz[2])


func release(e: Dictionary) -> void:
	if hand != null and hand["entry"] == e:
		hand = null
	if e.has("copy") and is_instance_valid(e["copy"]):
		e["copy"].queue_free()
	e.erase("copy")


## every frame: the held thing at the hand, springing after it; away while the player can't hold it
func hand_tick(dt: float) -> void:
	var e = rt.carried()
	if hand != null and hand["entry"] != e:          # another thing into the hand: this one's copy waits, unseen
		if is_instance_valid(hand["node"]):
			hand["node"].visible = false
		hand = null
	if e == null or not e.has("copy") or not is_instance_valid(e["copy"]):
		return
	if hand == null:
		var node: Node3D = e["copy"]
		if node.get_parent() == null:
			rt.game.world.add_child(node)
		hand = {"entry": e, "node": node, "s": e["physics"], "st": {"pos": Vector3.ZERO, "vel": Vector3.ZERO, "quat": Quaternion.IDENTITY, "sq": 0.0, "sv": 0.0,
			"bend": Vector3.ZERO, "bv": Vector3.ZERO, "hand": null, "h": e["h"]}}
	var p = rt.player
	var away: bool = not rt.active or rt.playing != null or p.seat != null or p.hiding != null or p.sleeping != null or p.peeping != null or rt.busy or rt.hand_down   # lowered (Q): out of view
	var node: Node3D = hand["node"]
	node.visible = not away
	if away:
		return
	var s: Dictionary = hand["s"]
	var cam: Camera3D = rt.game.camera
	var walk: float = min(1.0, float(p.speed) / 1.2)
	var off := Vector3(float(s["hand"][0]), float(s["hand"][1]), float(s["hand"][2]))
	off.y -= cos(float(rt.step_at) * TAU) * 0.012 * walk       # dipping with each footstep
	if rt.clock - float(rt.scrubbing) < 0.15:
		off.x += sin(rt.clock * 15.0) * 0.05
		off.y -= 0.06
	var eye: Vector3 = cam.global_position
	var want: Vector3 = cam.global_transform * off
	var d := want - eye
	var ln := d.length()
	var hit = rt.ray_hit(eye, d / max(ln, 1e-6), ln + float(e["r"]), rt.blocks())
	if hit != null:
		want = eye + d / max(ln, 1e-6) * max(0.12, float(hit["dist"]) - float(e["r"]))
	follow(hand, want, Quaternion(Vector3.UP, deg_to_rad(float(p.yaw) - 90.0)), dt)


## the spring after the hand (physics.js follow): there at once after a jump; the soft shape worked by the acceleration
func follow(x: Dictionary, target: Vector3, quat: Quaternion, dt: float) -> void:
	var st: Dictionary = x["st"]
	var s: Dictionary = x["s"]
	var c: float = 2.0 * sqrt(float(s["follow"])) * float(s["give"])
	if st["hand"] == null or (st["hand"] as Vector3).distance_to(target) > 1.0:
		st["hand"] = target
		st["pos"] = target
		st["vel"] = Vector3.ZERO
		st["quat"] = quat
	var hv: Vector3 = ((target - st["hand"]) / max(dt, 1e-3)).limit_length(8.0)
	st["hand"] = target
	var n: int = max(1, int(ceil(dt / STEP)))
	var h: float = dt / n
	for i in n:
		var acc: Vector3 = (target - st["pos"]) * float(s["follow"]) + (hv - st["vel"]) * c
		st["vel"] = st["vel"] + acc * h
		st["pos"] = st["pos"] + st["vel"] * h
		if s["name"] == "plushie":
			soft(st, acc, h, s)
	st["quat"] = (st["quat"] as Quaternion).slerp(quat, 1.0 - exp(-float(s["turn"]) * dt))
	var node: Node3D = x["node"]
	node.global_transform = Transform3D(Basis(st["quat"]), st["pos"])
	show_soft(x)


## a plushie: squashes as it's pushed up and stretches as it's let go, its top flops behind a turn and wobbles back
static func soft(st: Dictionary, acc: Vector3, dt: float, s: Dictionary) -> void:
	var j: float = float(s.get("jiggle", 1.0))
	var a := acc.limit_length(60.0)
	st["sv"] = float(st["sv"]) + (-a.y * float(s["squash"]) * j - 180.0 * float(st["sq"]) - 9.0 * float(st["sv"])) * dt
	st["sq"] = clamp(float(st["sq"]) + float(st["sv"]) * dt, -0.4, 0.4)
	var bv: Vector3 = st["bv"]
	bv += Vector3(a.x, 0, a.z) * (-float(s["floppy"]) * j * dt) + (st["bend"] as Vector3) * (-81.0 * dt) + bv * (-4.5 * dt)
	st["bv"] = bv
	st["bend"] = ((st["bend"] as Vector3) + bv * dt).limit_length(0.35 * float(st["h"]))


## the soft shape now: squashed about its own volume, its top leaning (the copy tilted from its base)
func show_soft(x: Dictionary) -> void:
	if x["s"]["name"] != "plushie":
		return
	var st: Dictionary = x["st"]
	var node: Node3D = x["node"]
	var k: float = 1.0 + float(st["sq"])
	var w: float = 1.0 / sqrt(max(0.3, k))
	var bend: Vector3 = st["bend"]
	var h: float = float(st["h"])
	var basis := Basis(st["quat"]).scaled(Vector3(w, k, w))
	if bend.length() > 1e-5 and h > 1e-3:
		var lean := Basis(bend.cross(Vector3.UP).normalized() * -1.0, atan(bend.length() / h))
		basis = lean * basis
	node.global_transform = Transform3D(basis, st["pos"] - Vector3(0, h / 2.0 * (k - 1.0), 0))


# ---- the die -----------------------------------------------------------------------------------------------------
func die_materials() -> Array:                  # ivory faces, dark pips, drawn once
	if die_mats.size():
		return die_mats
	for n in DIE_FACES:
		var img := Image.create(128, 128, false, Image.FORMAT_RGB8)
		img.fill(Color(0.93, 0.91, 0.86))
		for p in PIPS[n]:
			var cx := 28 + int(p[0]) * 36
			var cy := 28 + int(p[1]) * 36
			for y in range(cy - 11, cy + 12):
				for x in range(cx - 11, cx + 12):
					if Vector2(x - cx, y - cy).length() <= 11.0:
						img.set_pixel(x, y, Color(0.15, 0.14, 0.12))
		var m := StandardMaterial3D.new()
		m.albedo_texture = ImageTexture.create_from_image(img)
		m.roughness = 0.45
		die_mats.append(m)
	return die_mats


## a die's mesh: a box with a face (its pips) a surface
func die_mesh(size: Vector3) -> ArrayMesh:
	var am := ArrayMesh.new()
	var mats := die_materials()
	var hx := size.x / 2.0
	var hy := size.y / 2.0
	var hz := size.z / 2.0
	var faces := [
		[Vector3(hx, -hy, hz), Vector3(hx, -hy, -hz), Vector3(hx, hy, -hz), Vector3(hx, hy, hz), Vector3(1, 0, 0)],
		[Vector3(-hx, -hy, -hz), Vector3(-hx, -hy, hz), Vector3(-hx, hy, hz), Vector3(-hx, hy, -hz), Vector3(-1, 0, 0)],
		[Vector3(-hx, hy, hz), Vector3(hx, hy, hz), Vector3(hx, hy, -hz), Vector3(-hx, hy, -hz), Vector3(0, 1, 0)],
		[Vector3(-hx, -hy, -hz), Vector3(hx, -hy, -hz), Vector3(hx, -hy, hz), Vector3(-hx, -hy, hz), Vector3(0, -1, 0)],
		[Vector3(-hx, -hy, hz), Vector3(hx, -hy, hz), Vector3(hx, hy, hz), Vector3(-hx, hy, hz), Vector3(0, 0, 1)],
		[Vector3(hx, -hy, -hz), Vector3(-hx, -hy, -hz), Vector3(-hx, hy, -hz), Vector3(hx, hy, -hz), Vector3(0, 0, -1)]]
	for i in 6:
		var f: Array = faces[i]
		var stool := SurfaceTool.new()
		stool.begin(Mesh.PRIMITIVE_TRIANGLES)
		var uvs := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for tri in [[0, 2, 1], [0, 3, 2]]:
			for k in tri:
				stool.set_normal(f[4])
				stool.set_uv(uvs[k])
				stool.add_vertex(f[k])
		stool.commit(am)
		am.surface_set_material(i, mats[i])
	return am


## throw a die from the player's hand: forward and a little up, spinning; `rolled` with its face when it settles
func throw_die(t: Dictionary, s: Dictionary) -> void:
	var id = t["id"]
	if rolls.has(id):
		return
	var node: Node3D = t["node"]
	var sz: Array = t["size"]
	var size := Vector3(float(sz[0]), float(sz[2]), float(sz[1]))
	var mesh = node.get_node_or_null("mesh")
	if mesh != null and not mesh.has_meta("die"):      # its pips, once
		mesh.mesh = die_mesh(size)
		mesh.material_override = null
		mesh.set_meta("die", true)
	var shape = node.get_node_or_null("shape")
	if shape != null:
		shape.disabled = true                           # not against itself while it rolls
	var kind := kind_of(t)
	var body := RigidBody3D.new()
	body.name = "die_" + str(id)
	body.mass = float(kind["mass"])
	var pm := PhysicsMaterial.new()
	pm.bounce = float(kind["bounce"])
	pm.friction = float(kind["friction"])
	body.physics_material_override = pm
	body.linear_damp = float(kind["damping"])
	body.angular_damp = float(kind["spin"])
	body.can_sleep = true
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	var cam: Camera3D = rt.game.camera
	var dir: Vector3 = -cam.global_transform.basis.z
	var from: Vector3 = rt.eye_pos() + dir * 0.45 + Vector3(0, -0.25, 0)
	body.transform = Transform3D(Basis.from_euler(Vector3(randf() * 6.3, randf() * 6.3, randf() * 6.3)), from)
	rt.game.world.add_child(body)
	body.linear_velocity = dir * float(s.get("speed", 2.6)) + Vector3(0, float(s.get("lift", 1.2)), 0)
	var spin: float = float(s.get("spin", 14))
	body.angular_velocity = Vector3(randf_range(-spin, spin), randf_range(-spin, spin), randf_range(-spin, spin))
	rolls[id] = {"t": t, "body": body, "t0": rt.clock, "s": s}
	node.visible = true


static func top_face(b: Basis) -> int:            # the face whose outward axis points most nearly up
	var best := -2.0
	var face := 1
	for i in 6:
		var up: float = (b * AXES[i]).y
		if up > best:
			best = up
			face = DIE_FACES[i]
	return face


func rolling(id) -> bool:
	return rolls.has(id)


## every frame: the rolling dice ride their bodies; settled (asleep, or 8 s), the face on top is heard
func tick(dt: float) -> void:
	hand_tick(dt)
	for id in rolls.keys():
		var r: Dictionary = rolls[id]
		var body: RigidBody3D = r["body"]
		var node: Node3D = r["t"]["node"]
		node.global_transform = body.global_transform
		if body.sleeping or rt.clock - float(r["t0"]) > 8.0:
			var face := top_face(body.global_transform.basis)
			node.global_transform = body.global_transform
			rt.kept[rt.level]["bodies"][id] = node.transform
			var shape = node.get_node_or_null("shape")
			if shape != null:
				shape.disabled = false
			body.queue_free()
			rolls.erase(id)
			rt.hud.log("rolled %d" % face)
			rt.emit({"type": "rolled", "id": id, "face": face})


func clear() -> void:
	for id in rolls:
		rolls[id]["body"].queue_free()
	rolls = {}
	if hand != null:
		hand["node"].queue_free()
		hand = null
