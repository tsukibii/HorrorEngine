## A picture of the game at a spot, at a time of day, lit one way or another (the lighting trial, GODOT_PLAN §4; the
## guide's pictures): --node=n_x --at=x,y,yaw,pitch (story metres, degrees) --time=day|dusk|night
## --choice="Question|first|second|third" (a choice up over the picture, its first row lit) --gi=none|sdfgi|voxel --ao=0|1 --ssil=0|1 --power=0|1 --vhs=off|camcorder|camhybrid|worn --tape=key=val,key=val[;soften=near,far,px,least] (over the preset) --shadows=0|1|2 (the menu's row: hard, soft, softest) --amb=ENERGY --take=id,id (into the row) --behave=cid,as[,route or spot] (a cast member set going) --cast=id (the eye in front of their stand-in) --state=id:state,id:state (little things set going) --mirrors=1 (each mirror's own picture beside the shot) --shot=PATH [--wait=N frames]
extends SceneTree
var g
var n := 0
var o := {"node": "", "at": "", "time": "", "gi": "none", "ao": "0", "ssil": "0", "power": "1", "vhs": "off", "shot": "res://look.png", "wait": "30", "amb": "", "take": "", "cast": "", "behave": "", "sweep": "", "mirrors": "0", "state": "", "tape": "", "shadows": "2", "choice": ""}
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
		if o["sweep"] != "":                              # a car's headlights held mid-pass outside the room's windows: --sweep=lobby (or all)
			rt.sweep(null if o["sweep"] == "all" else o["sweep"])
			for sw in rt.sweeps:
				if sw["node"].passing():
					sw["node"].secs = 100000.0          # the pass made very long, then its clock run on to mid-pass: held there for the picture
					sw["node"].clock += 0.5 * sw["node"].secs
					sw["node"]._process(0.0)
					print("LOOKSHOT sweep %s lamp at %s energy %.1f visible %s aimed %s" % [sw["room"], sw["node"].lamp.global_position, sw["node"].lamp.light_energy, sw["node"].lamp.visible, -sw["node"].lamp.global_transform.basis.z])
		if o["behave"] != "":                             # a cast member set going: --behave=aoi,path,r_atrium (or aoi,at,spot_id)
			var b: PackedStringArray = o["behave"].split(",")
			var spec := {"as": b[1] if b.size() > 1 else "idle"}
			if b.size() > 2:
				spec["route" if spec["as"] == "path" else "at"] = b[2]
			rt.behave(b[0], spec)
		if o["state"] != "":                              # little things set going: --state=kitchen_rice:cooking,kitchen_kettle:heating
			for pair in o["state"].split(","):
				var kv: PackedStringArray = pair.split(":")
				if kv.size() == 2:
					rt.set_state(kv[0], kv[1], "look")
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
		if o["tape"] != "":                               # the tape's knobs over the preset: --tape=distortion=0.06,luma_blur=0.9;soften=0.9,6,1.6,0.4
			var vhsn = g.get_node("VHS")
			for part in o["tape"].split(";"):
				if part.begins_with("soften="):
					var a: PackedStringArray = part.substr(7).split(",")
					if a.size() >= 4:
						HSSoften.attach(g.camera).set_amounts(float(a[0]), float(a[1]), float(a[2]), float(a[3]))
					continue
				for kv in part.split(","):
					var p2: PackedStringArray = kv.split("=")
					if p2.size() == 2:
						vhsn.mat.set_shader_parameter(p2[0], float(p2[1]))
		HSLook.shadows(get_root(), int(o["shadows"]))
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
			for ch in g.pieces():
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
		if o["choice"] != "" and g.hud.choice_over:            # a choice up over the picture (the HUD's glass panel of rows), not awaited
			var parts: PackedStringArray = o["choice"].split("|")
			var opts: Array = []
			for i in range(1, parts.size()):
				opts.append({"label": parts[i]})
			g.hud.choose({"prompt": parts[0], "who": "Aoi", "options": opts})
			n = int(o["wait"]) - 4                        # a few frames for the panel to be drawn
			return false
		if o["cast"] != "" and not cast_placed and rt.cast_nodes.has(o["cast"]):   # the player put in front of a cast member's stand-in, 2.2 m off, facing them
			cast_placed = true
			var cn: Node3D = rt.cast_nodes[o["cast"]]
			var fwd: Vector3 = cn.global_transform.basis.z          # a stand-in's front is its +z (its yaw + 90, as the desk's figure)
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
		for hm in (rt.mirrors if o["mirrors"] == "1" else []):   # --mirrors=1: each mirror's own picture (what its camera sees) beside the shot, and its reckoning
			var vi: Image = hm.view.get_texture().get_image() if hm.view != null else null
			if vi != null:
				vi.save_png(o["shot"].get_basename() + "_mirror%d.png" % k)
			print("MIRROR %d active %s frames %d eye %s near %.2f last %s" % [k, hm.active, hm.frames, hm.mcam.global_position, hm.mcam.near, JSON.stringify(hm.last)])
			k += 1
		quit()
	return false
