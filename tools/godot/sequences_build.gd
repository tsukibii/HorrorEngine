extends SceneTree
## The guide of sequences' scene (guides/sequences), built from res://sequences.json (tools/godot/sequences.py's data)
## and saved as res://main.tscn: what the Things tab's Set up the scene, its cards and the NPC Markers tab's cards save
## when the guide's steps are followed. Nothing here runs: the nodes are made, given their fields, packed and saved.
##
##   godot --headless --path <project> -s sequences_build.gd        -> "SEQBUILD ok"

const MARKERS := "res://addons/horrorstudio_markers/"
const LOOK := "res://addons/horrorstudio_look/"

var root_node: Node3D
var by_name := {}
var mats := {}
var said: Array = []


func _initialize() -> void:
	var data = JSON.parse_string(FileAccess.get_file_as_string("res://sequences.json"))
	if not (data is Dictionary):
		print("SEQBUILD FAILED: res://sequences.json isn't there")
		quit(1)
		return
	root_node = Node3D.new()
	root_node.name = "Main"
	_world(data)
	_setup(data)
	_things(data)
	_areas(data)
	_cast(data)
	var ps := PackedScene.new()
	var err := ps.pack(root_node)
	if err == OK:
		err = ResourceSaver.save(ps, "res://main.tscn")
	for s in said:
		print("SEQBUILD " + s)
	print("SEQBUILD ok" if err == OK else "SEQBUILD FAILED: %d" % err)
	root_node.free()
	quit(0 if err == OK else 1)


func v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func own(n: Node, parent: Node) -> Node:
	parent.add_child(n)
	n.owner = root_node
	return n


func mat(c: String) -> StandardMaterial3D:
	if not mats.has(c):
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(c)
		m.roughness = 0.85
		mats[c] = m
	return mats[c]


# where `to` is from `from` (both under the scene's root, neither in a tree yet)
func rel(from: Node, to: Node) -> NodePath:
	var up := ""
	var n := from
	while n != root_node:
		up += "../"
		n = n.get_parent()
	var down := PackedStringArray()
	n = to
	while n != root_node:
		down.insert(0, String(n.name))
		n = n.get_parent()
	return NodePath(up + "/".join(down)) if not down.is_empty() else NodePath(up.trim_suffix("/") if up != "" else ".")


# ---- the place ------------------------------------------------------------------------------------------------------------
func _world(data: Dictionary) -> void:
	var world := own(Node3D.new(), root_node) as Node3D
	world.name = "World"
	for b in data["boxes"]:
		var size := v3(b["size"])
		var bm := BoxMesh.new()
		bm.size = size
		bm.material = mat(String(b["c"]))
		var mi := MeshInstance3D.new()
		mi.mesh = bm
		if bool(b.get("solid", true)):
			var body := StaticBody3D.new()
			body.name = String(b["n"])
			body.position = v3(b["at"])
			own(body, world)
			var cs := CollisionShape3D.new()
			cs.name = "Shape"
			var sh := BoxShape3D.new()
			sh.size = size
			cs.shape = sh
			own(cs, body)
			mi.name = "Mesh"
			own(mi, body)
			by_name[String(b["n"])] = body
		else:
			mi.name = String(b["n"])
			mi.position = v3(b["at"])
			own(mi, world)
			by_name[String(b["n"])] = mi
	var we := WorldEnvironment.new()
	we.name = "WorldEnvironment"
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.03, 0.035, 0.05)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.58, 0.68)
	env.ambient_light_energy = 0.32
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	we.environment = env
	own(we, root_node)
	for g in data["lights"]:
		var grp := Node3D.new()
		grp.name = String(g["n"])
		own(grp, root_node)
		by_name[grp.name] = grp
		var i := 0
		for l in g["lamps"]:
			i += 1
			var o := OmniLight3D.new()
			o.name = "Lamp%d" % i
			o.position = Vector3(float(l[0]), float(l[1]), float(l[2]))
			o.light_energy = float(l[3])
			o.omni_range = float(l[4])
			o.light_color = Color(String(l[5]))
			o.shadow_enabled = i == 1                          # (one lamp a room casts shadows: the rest only fill)
			own(o, grp)
	said.append("the place: %d boxes, %d rooms of lamps" % [(data["boxes"] as Array).size(), (data["lights"] as Array).size()])


# ---- what Set up the scene adds (the Things tab) ----------------------------------------------------------------------------
func _setup(data: Dictionary) -> void:
	var pl := (load("res://starter/player.tscn") as PackedScene).instantiate() as Node3D
	pl.name = "Player"
	pl.position = v3(data["player"]["at"])
	own(pl, root_node)
	by_name["Player"] = pl
	var st := CanvasLayer.new()
	st.name = "Story"
	st.set_script(load("res://starter/story.gd"))
	var tasks := PackedStringArray()
	for t in data.get("tasks", []):
		tasks.append(String(t))
	st.set("tasks", tasks)
	own(st, root_node)
	if ResourceLoader.exists("res://addons/horrorstudio_ui/hud.gd"):
		var hud := CanvasLayer.new()
		hud.name = "Hud"
		hud.set_script(load("res://addons/horrorstudio_ui/hud.gd"))
		own(hud, root_node)
	if ResourceLoader.exists("res://starter/sound.gd"):
		var snd := Node.new()
		snd.name = "Sound"
		snd.set_script(load("res://starter/sound.gd"))
		own(snd, root_node)


# ---- things: a mesh, then what a card makes of it -------------------------------------------------------------------------------
func _mesh(spec: Array, c: String) -> Mesh:
	var m: PrimitiveMesh
	match String(spec[0]):
		"cyl":
			var cm := CylinderMesh.new()
			cm.top_radius = float(spec[1])
			cm.bottom_radius = float(spec[1]) * 0.92
			cm.height = float(spec[2])
			cm.radial_segments = 20
			m = cm
		"ball":
			var sm := SphereMesh.new()
			sm.radius = float(spec[1])
			sm.height = float(spec[1]) * 2.0
			m = sm
		_:
			var bm := BoxMesh.new()
			bm.size = Vector3(float(spec[1]), float(spec[2]), float(spec[3]))
			m = bm
	m.material = mat(c)
	return m


func _things(data: Dictionary) -> void:
	var things := own(Node3D.new(), root_node) as Node3D
	things.name = "Things"
	for t in data["things"]:
		var mi := MeshInstance3D.new()
		mi.name = String(t["n"])
		mi.mesh = _mesh(t["mesh"], String(t["c"]))
		mi.position = v3(t["at"])
		own(mi, things)
		by_name[mi.name] = mi
		if t.has("script"):                                        # the Things tab's Pickup card: the selected mesh gets the starter's script
			mi.set_script(load(String(t["script"])))
			for k in (t.get("set", {}) as Dictionary):
				mi.set(k, t["set"][k])
		if t.has("grip") and ResourceLoader.exists(LOOK + "grip.gd"):   # Add Child Node: HSGrip (where a hand takes it)
			var g: Node3D = (load(LOOK + "grip.gd") as GDScript).new()
			g.name = "Grip"
			own(g, mi)
			for k in (t["grip"] as Dictionary):
				var val = t["grip"][k]
				g.set(k, v3(val) if val is Array else (int(val) if typeof(g.get(k)) == TYPE_INT else val))
		if t.has("logic"):                                         # the Things tab's Logic card
			var lg: Node = (load(MARKERS + "logic.gd") as GDScript).new()
			lg.name = "Logic"
			own(lg, mi)
			for k in (t["logic"] as Dictionary):
				lg.set(k, t["logic"][k])
	said.append("things: %d" % (data["things"] as Array).size())


func _areas(data: Dictionary) -> void:
	var areas := own(Node3D.new(), root_node) as Node3D
	areas.name = "Areas"
	for a in data["areas"]:
		var ar := Area3D.new()
		ar.name = String(a["n"])
		ar.position = v3(a["at"])
		own(ar, areas)
		var cs := CollisionShape3D.new()
		cs.name = "Shape"
		var bs := BoxShape3D.new()
		bs.size = v3(a["size"])
		cs.shape = bs
		cs.position.y = float(a["size"][1]) * 0.5
		own(cs, ar)
		ar.set_script(load(String(a["script"])))
		for k in (a.get("set", {}) as Dictionary):
			ar.set(k, a["set"][k])
		by_name[ar.name] = ar
	for a in data["areas"]:                                        # (what an area points at: once everything is there)
		for k in (a.get("nodes", {}) as Dictionary):
			var to: Node = by_name.get(String(a["nodes"][k]))
			if to != null:
				(by_name[String(a["n"])] as Node).set(k, to)
	said.append("areas: %d" % (data["areas"] as Array).size())


# ---- the cast: a character, an HSNpc beside her, her quests, her markers -----------------------------------------------------------
func _cast(data: Dictionary) -> void:
	var count := 0
	for c in data["cast"]:
		var her := (load("res://characters/%s.glb" % String(c["model"])) as PackedScene).instantiate() as Node3D
		her.name = String(c["id"])
		her.position = v3(c["at"])
		her.rotation.y = deg_to_rad(float(c.get("yaw", 0.0)))
		own(her, root_node)
		by_name[her.name] = her
	for c in data["cast"]:
		var her: Node3D = by_name[String(c["id"])]
		var npc := HSNpc.new()
		npc.name = "%s markers" % String(c["id"])
		own(npc, root_node)
		npc.character = rel(npc, her)
		npc.npc_name = String(c["id"])
		npc.color = Color(String(c.get("color", "#4FC3F7")))
		for k in (c.get("npc", {}) as Dictionary):
			var val = c["npc"][k]
			npc.set(k, Vector2(float(val[0]), float(val[1])) if val is Array else val)
		for q in c["quests"]:
			var quest := HSNpcQuest.new()
			quest.title = String(q["title"])
			quest.name = quest.title.validate_node_name()
			quest.starts_when = String(q.get("starts", ""))
			own(quest, npc)
			count += _markers(quest, q["markers"], data["cards"])
	said.append("the cast: %d characters, %d markers" % [(data["cast"] as Array).size(), count])


func _markers(parent: Node, list: Array, cards: Dictionary) -> int:
	var n := 0
	for d in list:
		n += 1
		var card: Dictionary = cards[String(d["card"])]
		var m := HSNpcMarker.new()
		m.kind = String(card["kind"])
		for k in (card["set"] as Dictionary):
			_put(m, k, card["set"][k])
		for k in (d as Dictionary):
			if k in ["card", "where", "form", "at", "yaw", "bends", "ways", "inner", "target", "fire", "head_at", "attack_at"]:
				continue
			_put(m, k, d[k])
		m.name = _free_name(parent, m.title())                     # (a name already there gets a number, as the tab's do)
		own(m, parent)
		if d.has("at"):
			m.position = v3(d["at"]) - _origin(parent)
		m.rotation.y = deg_to_rad(float(d.get("yaw", 0.0)))
		for k in ["target", "head_at", "attack_at"]:
			if d.has(k) and by_name.has(String(d[k])):
				m.set(k, rel(m, by_name[String(d[k])]))
		if d.has("fire"):
			var paths: Array[NodePath] = []
			for f in d["fire"]:
				if by_name.has(String(f)):
					paths.append(rel(m, by_name[String(f)]))
			m.fire = paths
		for b in d.get("bends", []):
			var bend := HSNpcBend.new()
			bend.name = "Bend"
			own(bend, m)
			bend.position = v3(b)                                  # (a bend is a place in the world: top_level)
		for w in d.get("ways", []):
			var way := HSNpcWay.new()
			way.when = String(w.get("when", ""))
			way.note = String(w.get("note", ""))
			way.name = (String(w.get("note", "")).capitalize() if String(w.get("note", "")) != "" else ("Way" if way.when != "" else "Otherwise")).validate_node_name()
			own(way, m)
			way.position = -(_origin(parent) + m.position)         # (its own origin the world's: what's inside it is placed in the world's numbers)
			n += _markers(way, w["markers"], cards)
		if d.has("inner"):
			n += _markers(m, d["inner"], cards)
	return n


func _free_name(parent: Node, want: String) -> String:
	var nm := want.validate_node_name()
	if parent.get_node_or_null(nm) == null:
		return nm
	var i := 2
	while parent.get_node_or_null("%s%d" % [nm, i]) != null:
		i += 1
	return "%s%d" % [nm, i]


# where a container's own origin is in the world (markers sit under quests, ways and repeats: all Node3Ds)
func _origin(n: Node) -> Vector3:
	var at := Vector3.ZERO
	var p := n
	while p != null and p != root_node:
		if p is Node3D:
			at += (p as Node3D).position
		p = p.get_parent()
	return at


func _put(m: Object, k: String, val) -> void:
	match k:
		"talks":
			var list: Array[Dictionary] = []
			for t in val:
				list.append((t as Dictionary).duplicate(true))
			m.set(k, list)
		"add_tasks", "face_rules":
			var lines := PackedStringArray()
			for l in val:
				lines.append(String(l))
			m.set(k, lines)
		_:
			var cur = m.get(k)
			if typeof(cur) == TYPE_INT and (val is float or val is int):
				m.set(k, int(val))
			elif typeof(cur) == TYPE_NIL:
				push_error("sequences: a marker has no field '%s'" % k)
			else:
				m.set(k, val)
