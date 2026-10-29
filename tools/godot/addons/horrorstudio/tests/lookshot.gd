## A picture of the game at a spot, at a time of day, lit one way or another (the lighting trial, GODOT_PLAN §4; the
## guide's pictures): --node=n_x --at=x,y,yaw,pitch (story metres, degrees) --time=day|dusk|night
## --gi=none|sdfgi|voxel --ao=0|1 --ssil=0|1 --power=0|1 --vhs=off|camcorder|worn --amb=ENERGY --take=id,id (into the row) --behave=cid,as[,route or spot] (a cast member set going) --cast=id (the eye in front of their stand-in) --shot=PATH [--wait=N frames]
extends SceneTree
var g
var n := 0
var o := {"node": "", "at": "", "time": "", "gi": "none", "ao": "0", "ssil": "0", "power": "1", "vhs": "off", "shot": "res://look.png", "wait": "30", "amb": "", "take": "", "cast": "", "behave": ""}
var done := false
var placed := false
var baked := false
var cast_placed := false


func _initialize() -> void:
	create_timer(900.0, true, false, true).timeout.connect(func() -> void: print("watchdog"); quit(1))
	for a in OS.get_cmdline_user_args():
		for k in o:
			if a.begins_with("--%s=" % k):
				o[k] = a.substr(k.length() + 3)
	g = (load("res://addons/horrorstudio/main.tscn") as PackedScene).instantiate()
	g.autostart = false
	root.add_child(g)
	await process_frame
	g.watch(o["node"] if o["node"] != "" else null, {"flags": [], "items": [], "karma": {"karma": 0.0}, "counters": {}, "states": {}, "trail": []} if o["node"] != "" else null)


func _process(_d: float) -> bool:
	n += 1
	var rt = g.play
	if done or rt == null or not rt.active:
		return false
	if not placed:
		placed = true
		if o["at"] != "":
			var p: PackedStringArray = o["at"].split(",")
			rt.place(Vector3(float(p[0]), 0.0, -float(p[1])), float(p[2]) if p.size() > 2 else 90.0, float(p[3]) if p.size() > 3 else 0.0)
		if o["time"] != "":
			g.set_time(o["time"])
		if o["behave"] != "":                             # a cast member set going: --behave=aoi,path,r_atrium (or aoi,at,spot_id)
			var b: PackedStringArray = o["behave"].split(",")
			var spec := {"as": b[1] if b.size() > 1 else "idle"}
			if b.size() > 2:
				spec["route" if spec["as"] == "path" else "at"] = b[2]
			rt.behave(b[0], spec)
		if o["take"] != "":                               # things into the inventory's row, shown (its live slots pictured)
			for id in o["take"].split(","):
				if rt.things.has(id):
					rt.take(rt.things[id])
			rt.inv_shown = true
			rt.inv_draw(false)
		var e: Environment = g.env.environment
		if o["amb"] != "":
			e.ambient_light_energy = float(o["amb"])      # the flat fill down, so a GI's bounce shows for itself
		e.sdfgi_enabled = o["gi"] == "sdfgi"
		e.ssao_enabled = o["ao"] == "1"
		e.ssil_enabled = o["ssil"] == "1"
		if o["power"] == "0":
			rt.power("off")
		g.get_node("VHS").preset(o["vhs"])
		if o["gi"] == "voxelrooms" and g.level != null:        # a VoxelGI per room: cells fine enough for 10 cm walls
			var rooms: Array = g.story.levels[g.level_id].get("rooms", [])
			for r in rooms:
				var vg := VoxelGI.new()
				vg.name = "VoxelGI_" + str(r["id"])
				var at: Array = r["at"]
				var sz: Array = r["size"]
				vg.size = Vector3(float(sz[0]) + 1.0, float(sz[2]) + 1.0, float(sz[1]) + 1.0)
				vg.subdiv = VoxelGI.SUBDIV_64
				g.level.add_child(vg)
				vg.global_position = Vector3(float(at[0]) + float(sz[0]) / 2.0, float(at[2]) + float(sz[2]) / 2.0, -(float(at[1]) + float(sz[1]) / 2.0))
				vg.bake(g.level)
			print("VOXELGI baked per room: ", rooms.size())
		if o["gi"] == "voxel" and g.level != null:
			var vg := VoxelGI.new()
			vg.name = "VoxelGI"
			var lo := Vector3(INF, INF, INF)
			var hi := Vector3(-INF, -INF, -INF)
			for ch in g.level.get_children():
				if ch is Node3D and ch.has_meta("piece"):
					lo = lo.min(ch.global_position)
					hi = hi.max(ch.global_position)
			vg.size = (hi - lo) + Vector3(2, 4, 2)
			vg.subdiv = VoxelGI.SUBDIV_128
			g.level.add_child(vg)
			vg.global_position = (lo + hi) / 2.0 + Vector3(0, 1.5, 0)
			vg.bake(g.level)
			baked = true
			print("VOXELGI baked, size ", vg.size)
		n = 0
		return false
	if n >= int(o["wait"]):
		if o["cast"] != "" and not cast_placed and rt.cast_nodes.has(o["cast"]):   # the player put in front of a cast member's stand-in, 2.2 m off, facing them
			cast_placed = true
			var cn: Node3D = rt.cast_nodes[o["cast"]]
			var fwd: Vector3 = -cn.global_transform.basis.z
			var at: Vector3 = cn.global_position + fwd * 2.2
			var yaw: float = rad_to_deg(atan2(-(cn.global_position.z - at.z), cn.global_position.x - at.x))   # the story's compass: east 0, north 90
			rt.place(Vector3(at.x, 0.0, at.z), yaw, -8.0)
			print("LOOKSHOT cast %s at %s, visible %s" % [o["cast"], cn.global_position, cn.visible])
			n = int(o["wait"]) - 3                        # a few frames for the eye to move
			return false
		done = true
		var img := root.get_texture().get_image()
		img.save_png(o["shot"])
		print("LOOKSHOT %s %dx%d" % [o["shot"], img.get_width(), img.get_height()])
		var k := 0
		for hm in rt.mirrors:                              # each mirror's own picture (what its camera sees) beside the shot, and its reckoning
			var vi: Image = hm.view.get_texture().get_image() if hm.view != null else null
			if vi != null:
				vi.save_png(o["shot"].get_basename() + "_mirror%d.png" % k)
			print("MIRROR %d active %s frames %d eye %s near %.2f last %s" % [k, hm.active, hm.frames, hm.mcam.global_position, hm.mcam.near, JSON.stringify(hm.last)])
			k += 1
		quit()
	return false
