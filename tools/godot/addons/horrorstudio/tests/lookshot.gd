## A picture of the game at a spot, at a time of day, lit one way or another (the lighting trial, GODOT_PLAN §4; the
## guide's pictures): --node=n_x --at=x,y,yaw,pitch (story metres, degrees) --time=day|dusk|night
## --gi=none|sdfgi|voxel --ao=0|1 --ssil=0|1 --power=0|1 --vhs=off|camcorder|worn --amb=ENERGY --shot=PATH [--wait=N frames]
extends SceneTree
var g
var n := 0
var o := {"node": "", "at": "", "time": "", "gi": "none", "ao": "0", "ssil": "0", "power": "1", "vhs": "off", "shot": "res://look.png", "wait": "30", "amb": ""}
var done := false
var placed := false
var baked := false


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
		done = true
		var img := root.get_texture().get_image()
		img.save_png(o["shot"])
		print("LOOKSHOT %s %dx%d" % [o["shot"], img.get_width(), img.get_height()])
		quit()
	return false
