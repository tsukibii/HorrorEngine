## A desk game brought into the Director (tools/godot_director.py from-desk, docs/GODOT_DIRECTOR.md §6d): the world the
## converter wrote (res://director/desk_world.json: storykit/director_desk.py, everything in Godot's axes) built as the
## Director's own nodes, by their own code, and saved as the main scene: an HSGame with the game's settings, an HSLevel
## a level, its rooms (HSRoom: a size, its walls, its openings, its leaks, its materials), doors (HSDoor), things (HSThing: a use,
## its words, its model inside), people (HSActor: a body, who she is), spots, areas, paths and lights. Its story is the
## Director file the converter wrote beside it (director/director.json). Prints DESKBUILD ok and quits.
extends SceneTree

var root_: Node = null
var made := {}


func own(n: Node, parent: Node, nm: String) -> Node:
	n.name = nm.validate_node_name()
	parent.add_child(n)
	n.owner = root_
	return n


static func v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2])) if a is Array and a.size() >= 3 else Vector3.ZERO


static func xf(a) -> Transform3D:
	if not (a is Array) or a.size() < 12:
		return Transform3D()
	return Transform3D(Basis(Vector3(a[0], a[3], a[6]), Vector3(a[1], a[4], a[7]), Vector3(a[2], a[5], a[8])), Vector3(a[9], a[10], a[11]))


## a texture set as a world-aligned material (the export's surface: triplanar, tiled by the set's metres)
static func material(spec) -> Material:
	if not (spec is Dictionary) or not spec.has("albedo"):
		return null
	var m := StandardMaterial3D.new()
	var tile := float(spec.get("tile", 2.0))
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3.ONE / max(0.05, tile)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	m.albedo_texture = load(str(spec["albedo"]))
	if spec.has("normal"):
		m.normal_enabled = true
		m.normal_texture = load(str(spec["normal"]))
	if spec.has("rough"):
		m.roughness_texture = load(str(spec["rough"]))
		m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
	if spec.has("ao"):
		m.ao_enabled = true
		m.ao_texture = load(str(spec["ao"]))
	if spec.has("metal"):
		m.metallic_texture = load(str(spec["metal"]))
	if spec.has("orm"):
		var orm = load(str(spec["orm"]))
		m.ao_enabled = true
		m.ao_texture = orm
		m.roughness_texture = orm
		m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GREEN
	return m


## a thing's model: a glb or a library mesh at its place in the thing, or a plain shape of its size (a box, a cylinder,
## a sphere, the steps of a stair), turned back by the thing's own turn so it stands as the desk had it
func model(spec, parent: Node3D) -> void:
	if not (spec is Dictionary):
		return
	var turn := Basis(Vector3.UP, deg_to_rad(float(spec.get("turn", 0.0))))
	if spec.has("path"):
		if not ResourceLoader.exists(str(spec["path"])):
			printerr("DESKBUILD: no model %s" % spec["path"])
			return
		var inst: Node3D = (load(str(spec["path"])) as PackedScene).instantiate()
		var t := xf(spec.get("xform"))
		inst.transform = Transform3D(turn, Vector3.ZERO) * t
		own(inst, parent, "art")
		return
	var mi := MeshInstance3D.new()
	var mat := HSDirector.grey(Color(str(spec.get("color", "#8a8278"))), 0.75)
	if spec.has("box"):
		var b := BoxMesh.new()
		b.size = v3(spec["box"])
		mi.mesh = b
		mi.position = turn * Vector3(0, b.size.y / 2.0, 0)
	elif spec.has("cyl"):
		var c := CylinderMesh.new()
		c.top_radius = float(spec["cyl"][0])
		c.bottom_radius = float(spec["cyl"][0])
		c.height = float(spec["cyl"][1])
		mi.mesh = c
		mi.position = Vector3(0, c.height / 2.0, 0)
	elif spec.has("sphere"):
		var s := SphereMesh.new()
		s.radius = float(spec["sphere"])
		s.height = s.radius * 2.0
		mi.mesh = s
		mi.position = Vector3(0, s.radius, 0)
	elif spec.has("steps"):                             # a stair: each step a box (its centre and size in the thing's space)
		var holder := own(Node3D.new(), parent, "art") as Node3D
		holder.transform = Transform3D(turn, Vector3.ZERO)
		var k := 0
		for st in spec["steps"]:
			var smi := MeshInstance3D.new()
			var bb := BoxMesh.new()
			bb.size = v3(st["size"])
			smi.mesh = bb
			smi.position = v3(st["at"])
			smi.material_override = mat
			own(smi, holder, "step%d" % k)
			k += 1
		return
	else:
		return
	mi.basis = turn
	mi.material_override = mat
	own(mi, parent, "mesh")                            # a plain shape is the thing's block, as the export's (a stain's blot reads it)


func _initialize() -> void:
	var w = JSON.parse_string(FileAccess.get_file_as_string("res://director/desk_world.json"))
	if not (w is Dictionary):
		printerr("DESKBUILD FAIL: no res://director/desk_world.json")
		quit(1)
		return
	root_ = HSGame.new()
	root_.name = "Game"
	var gw: Dictionary = w.get("game", {})
	for k in ["title", "player_name", "time_of_day", "fov", "look", "vhs", "grade", "ui_theme", "lighting", "weather"]:
		if gw.has(k):
			root_.set(k, gw[k])
	if gw.get("counters") is Array:
		root_.counters = PackedStringArray(gw["counters"])
	for L in w.get("levels", []):
		var lv: HSLevel = own(HSLevel.new(), root_, str(L["id"]).to_pascal_case())
		lv.id = str(L["id"])
		for k in ["time_of_day", "look", "weather"]:
			if str(L.get(k, "")) != "":
				lv.set(k, str(L[k]))
		for r in L.get("rooms", []):
			var room: HSRoom = own(HSRoom.new(), lv, str(r["id"]).to_pascal_case())
			room.id = str(r["id"])
			room.position = v3(r["pos"])
			room.size = v3(r["size"])
			room.wall = float(r.get("wall", 0.1))
			room.walls = int(r.get("walls", 15))
			room.floor_on = bool(r.get("floor_on", true))
			room.ceiling_on = bool(r.get("ceiling_on", true))
			room.floor_kind = str(r.get("floor_kind", "wood"))
			room.wet = float(r.get("wet", 0.0))
			var ops: Array[HSOpening] = []
			for o in r.get("openings", []):
				var op := HSOpening.new()
				op.side = str(o["side"])
				op.offset = float(o["offset"])
				op.width = float(o["width"])
				op.height = float(o["height"])
				op.sill = float(o.get("sill", 0.0))
				for k in ["glass", "daylight", "shaft", "shaft_reach", "shaft_dust", "sweep_on", "sweep_every", "sweep_secs", "sweep_out", "sweep_span", "sweep_energy", "sweep_aim"]:
					if o.has(k):
						op.set(k, o[k])                     # a window's words
				ops.append(op)
			room.openings = ops
			var lks: Array[HSRoomLeak] = []
			for o in r.get("leaks", []):
				var lk := HSRoomLeak.new()
				for k in ["id", "side", "offset", "height", "width", "drip", "wet"]:
					if o.has(k):
						lk.set(k, o[k])
				lks.append(lk)
			room.leaks = lks
			var mats: Dictionary = r.get("materials", {})
			room.floor_material = material(mats.get("floor"))
			room.wall_material = material(mats.get("walls"))
			room.ceiling_material = material(mats.get("ceiling"))
			made[room.id] = room
		for s in L.get("spots", []):
			var sp: HSSpot = own(HSSpot.new(), lv, str(s["id"]).to_pascal_case())
			sp.id = str(s["id"])
			sp.position = v3(s["pos"])
			sp.rotation_degrees = Vector3(0, float(s.get("yaw", 0.0)), 0)
			made[sp.id] = sp
		for d in L.get("doors", []):
			var dr: HSDoor = own(HSDoor.new(), lv, str(d["id"]).to_pascal_case())
			dr.id = str(d["id"])
			dr.position = v3(d["pos"])
			dr.rotation_degrees = Vector3(0, float(d.get("yaw", 0.0)), 0)
			for k in ["width", "height", "hinge", "sliding", "locked_by", "peephole", "latch"]:
				if d.has(k):
					dr.set(k, d[k])
			made[dr.id] = dr
		for t in L.get("things", []):
			var th: HSThing = HSThing.new()
			th.use = str(t.get("use", "none"))          # its use first: the fields its use shows
			own(th, lv, str(t["id"]).to_pascal_case())
			th.id = str(t["id"])
			th.position = v3(t["pos"])
			th.rotation_degrees = Vector3(0, float(t.get("yaw", 0.0)), 0)
			for k in t.get("fields", {}):
				var v = t["fields"][k]
				if k == "sleep_needs":
					v = PackedStringArray(v)
				th.set(k, v)
			if t.get("extra") is Dictionary:
				th.extra = t["extra"]
			model(t.get("model"), th)
			made[th.id] = th
		for a in L.get("actors", []):
			var ac: HSActor = own(HSActor.new(), lv, str(a["id"]).to_pascal_case())
			ac.id = str(a["id"])
			ac.position = v3(a["pos"])
			ac.rotation_degrees = Vector3(0, float(a.get("yaw", 0.0)), 0)
			for k in ["cast", "display_name", "height", "hidden_at_start", "behaviour", "studio_character", "solid", "face_player"]:
				if a.has(k):
					ac.set(k, a[k])
			if str(a.get("body", "")) != "" and ResourceLoader.exists(str(a["body"])):
				own((load(str(a["body"])) as PackedScene).instantiate(), ac, "Body")
			made[ac.id] = ac
		for t in L.get("triggers", []):
			var tr: HSTrigger = own(HSTrigger.new(), lv, str(t["id"]).to_pascal_case())
			tr.id = str(t["id"])
			tr.position = v3(t["pos"])
			tr.size = v3(t["size"])
			tr.safe = bool(t.get("safe", false))
		for pth in L.get("paths", []):
			var pa: HSPath = own(HSPath.new(), lv, str(pth["id"]).to_pascal_case())
			pa.id = str(pth["id"])
			pa.mode = str(pth.get("mode", "loop"))
			var k := 0
			for pt in pth.get("points", []):
				var s2: HSSpot = own(HSSpot.new(), pa, "%s_%d" % [str(pth["id"]).to_pascal_case(), k])
				s2.id = "%s__%d" % [pth["id"], k]
				s2.position = v3(pt["pos"])                 # the path at the level's origin: its points where they are
				s2.rotation_degrees = Vector3(0, float(pt.get("yaw", 0.0)), 0)
				s2.wait = float(pt.get("wait", 0.0))
				s2.pose = str(pt.get("pose", ""))
				s2.check = str(pt.get("check", ""))
				k += 1
		for l in L.get("lights", []):
			var pat = l.get("pattern")
			var PL := "res://addons/horrorstudio_look/nodes/pattern_light.gd"
			var li: Light3D = null
			if pat is Dictionary and ResourceLoader.exists(PL):
				li = load(PL).new()                         # a pattern in its light: the Look plugin's HSPatternLight, aimed (caustics off a puddle)
			else:
				li = OmniLight3D.new()
			var pos := v3(l["pos"])
			var c: Array = l.get("color", [1, 0.85, 0.7])
			li.light_color = Color(float(c[0]), float(c[1]), float(c[2]))
			li.light_energy = float(l.get("energy", 1.0))
			if li is SpotLight3D:
				var aim := v3(pat["aim"])
				var dist: float = max(0.1, pos.distance_to(aim))
				li.transform = Transform3D(Basis.looking_at(aim - pos, Vector3.UP if absf((aim - pos).normalized().y) < 0.999 else Vector3.BACK), pos)
				li.light_energy = float(l.get("energy", 1.0)) * 1.5
				li.spot_range = max(dist * 1.6, dist + 1.0)
				li.spot_angle = float(pat.get("spread", 50.0)) / 2.0
				li.spot_angle_attenuation = 0.8
				li.set("pattern", str(pat["pattern"]))
				li.set("aim_distance", dist)
				for k in [["scale", "feature_m"], ["speed", "speed"], ["open", "open"], ["angle", "angle"]]:
					if pat.has(k[0]):
						li.set(k[1], float(pat[k[0]]))
			else:
				li.position = pos
				li.omni_range = float(l.get("range", 5.0))
				li.omni_attenuation = 1.6
			li.shadow_enabled = true
			li.light_size = float(l.get("size", 0.06))
			li.visible = bool(l.get("on", true))
			if l.get("light") is Dictionary:
				li.set_meta("hs_light", l["light"])
			own(li, lv, str(l["id"]))                   # in the level (its room found by where it is: HSLevel)
		var st = made.get(str(L.get("start", "")))
		if st != null:
			lv.start = lv.get_path_to(st)
	# a switch's lights, a little thing's light (a candle's flame): by their ids
	for L in w.get("levels", []):
		for t in L.get("things", []):
			if not made.has(str(t["id"])):
				continue
			var th: HSThing = made[str(t["id"])]
			var ids: Array = t.get("switches", [])
			if ids.size():
				var paths: Array[NodePath] = []
				for lid in ids:
					var ln = root_.find_child(str(lid), true, false)
					if ln != null:
						paths.append(th.get_path_to(ln))
				th.switches = paths
			if str(t.get("life_light", "")) != "":
				var ll = root_.find_child(str(t["life_light"]), true, false)
				if ll != null:
					th.life_light = th.get_path_to(ll)
	var ps := PackedScene.new()
	var r := ps.pack(root_)
	if r != OK:
		printerr("DESKBUILD FAIL: pack %d" % r)
		quit(1)
		return
	var e := ResourceSaver.save(ps, "res://main.tscn")
	HSDirector.write_index("res://main.tscn", root_)
	print("DESKBUILD %s (%d levels, %d nodes made)" % ["ok" if e == OK else "FAIL save %d" % e, w.get("levels", []).size(), made.size()])
	root_.free()
	quit(0 if e == OK else 1)
