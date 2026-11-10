extends RefCounted
## The room LAPTOP and its pictures use (tools/godot/laptop_check.py): a small office at night in a project made by
## tools/godot_byhand.py: a desk against the wall with the devices plugin's laptop prefab on it, a lamp, a $20 note
## beside it (the starter's pickup), the starter's player standing at the desk looking at the screen, the Story (its
## cash) and an HSHud (the pocket's row).

const PREFAB := "res://addons/horrorstudio_devices/laptop/laptop.tscn"
const DESK_Y := 0.74


static func box(parent: Node3D, nm: String, at: Vector3, size: Vector3, col: Color, rough := 0.8, solid := true) -> Node3D:
	var n: Node3D = StaticBody3D.new() if solid else Node3D.new()
	n.name = nm
	n.position = at
	parent.add_child(n)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = rough
	mi.material_override = m
	n.add_child(mi)
	if solid:
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = size
		cs.shape = sh
		n.add_child(cs)
	return n


static func build(root: Node, cash := 20.0) -> Dictionary:
	var w := Node3D.new()
	w.name = "World"
	root.add_child(w)
	var we := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.006, 0.007, 0.009)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.3, 0.33, 0.4)
	e.ambient_light_energy = 0.12
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	e.glow_enabled = true
	e.glow_intensity = 0.6
	e.glow_bloom = 0.05
	e.glow_hdr_threshold = 0.9
	we.environment = e
	w.add_child(we)
	box(w, "Floor", Vector3(0, -0.05, 0), Vector3(6, 0.1, 6), Color(0.16, 0.14, 0.12))
	box(w, "WallBack", Vector3(0, 1.4, -1.25), Vector3(6, 2.8, 0.1), Color(0.36, 0.36, 0.34), 0.9)
	box(w, "WallLeft", Vector3(-1.6, 1.4, 0), Vector3(0.1, 2.8, 6), Color(0.34, 0.34, 0.32), 0.9)
	box(w, "Ceiling", Vector3(0, 2.85, 0), Vector3(6, 0.1, 6), Color(0.3, 0.3, 0.3), 0.9)
	var wood := Color(0.28, 0.17, 0.1)
	box(w, "Desk", Vector3(0, DESK_Y - 0.02, -0.88), Vector3(1.4, 0.04, 0.68), wood, 0.55)
	for x in [-0.66, 0.66]:
		for z in [-1.18, -0.58]:
			box(w, "Leg", Vector3(x, (DESK_Y - 0.04) / 2.0, z), Vector3(0.05, DESK_Y - 0.04, 0.05), wood.darkened(0.2), 0.6)
	var lap: Node3D = (load(PREFAB) as PackedScene).instantiate()
	lap.name = "Laptop"
	lap.position = Vector3(0.0, DESK_Y, -0.86)
	w.add_child(lap)
	var lamp := OmniLight3D.new()                     # a desk lamp's warm pool, off to the left
	lamp.name = "Lamp"
	lamp.light_color = Color(1.0, 0.78, 0.52)
	lamp.light_energy = 1.1
	lamp.omni_range = 2.6
	lamp.shadow_enabled = true
	lamp.position = Vector3(-0.55, DESK_Y + 0.42, -0.95)
	w.add_child(lamp)
	var note := Node3D.new()                          # a $20 note: the starter's pickup, its script on it before it's in
	note.name = "Cash"                                # the tree (its _ready makes the collider E finds)
	note.set_script(load("res://starter/pickup.gd"))
	note.set("item", "")
	note.set("cash", 20.0)
	note.set("label", "$20.00")
	note.position = Vector3(0.42, DESK_Y + 0.002, -0.72)
	note.rotation_degrees.y = 18.0
	var nm := MeshInstance3D.new()
	var nb := BoxMesh.new()
	nb.size = Vector3(0.155, 0.004, 0.066)
	nm.mesh = nb
	var nmat := StandardMaterial3D.new()
	nmat.albedo_color = Color(0.42, 0.55, 0.38)
	nmat.roughness = 0.85
	nm.material_override = nmat
	note.add_child(nm)
	w.add_child(note)
	var pl: Node3D = (load("res://starter/player.tscn") as PackedScene).instantiate()
	pl.name = "Player"
	pl.position = Vector3(0.0, 0.0, -0.05)
	w.add_child(pl)
	var eye := pl.get_node("Eye") as Camera3D
	pl.set("pitch", deg_to_rad(-42.0))
	eye.rotation.x = deg_to_rad(-42.0)
	var st := CanvasLayer.new()
	st.name = "Story"
	st.set_script(load("res://starter/story.gd"))
	st.set("cash", cash)
	root.add_child(st)
	var hud: Node = load("res://addons/horrorstudio_ui/hud.gd").new()
	hud.name = "HUD"
	root.add_child(hud)
	hud.set("hints", {"W A S D:walk": true, "E:use": true, "Tab:pocket": true, "F:flashlight": true})   # a game by hand's keys
	hud.call("_draw_hints")
	return {"world": w, "laptop": lap, "player": pl, "eye": eye, "story": st, "hud": hud, "note": note, "lamp": lamp}
