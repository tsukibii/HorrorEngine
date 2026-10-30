## GDCULL (tools/godot_export.py --cull): drawing only what can be seen (the user, 2026-10-30). The game started at
## its start, the player stood in the middle of every room of the level, looking each way in turn; at each view the
## frame drawn with occlusion culling on (the walls', floors' and ceilings' box occluders, GODOT_EXPORT §8) and off:
## the objects and primitives the renderer drew, and the two pictures compared (nothing that can be seen hidden).
## Prints GDCULL {...}; --views=N per room (4), --wait=N frames before each count (3).
extends SceneTree
var g
var n := 0
var o := {"views": "4", "wait": "3"}
var started := false
var rooms: Array = []
var plan: Array = []              # [room, yaw]
var step := 0
var phase := 0                    # 0 place, 1 count on, 2 count off
var frames := 0
var rep := {"views": 0, "on": {"objects": 0, "primitives": 0, "draws": 0}, "off": {"objects": 0, "primitives": 0, "draws": 0}, "diff_max": 0.0, "diff_mean": 0.0, "worst": ""}
var img_on: Image = null
var diffs := 0.0


func _initialize() -> void:
	create_timer(1500.0, true, false, true).timeout.connect(func() -> void: print("GDCULL FAIL: watchdog"); quit(1))
	for a in OS.get_cmdline_user_args():
		for k in o:
			if a.begins_with("--%s=" % k):
				o[k] = a.substr(k.length() + 3)
	g = (load("res://addons/horrorstudio/main.tscn") as PackedScene).instantiate()
	g.autostart = false
	root.add_child(g)
	await process_frame
	g.watch(null, null)


func info(what: int) -> int:
	return root.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, what)


func _process(_d: float) -> bool:
	var rt = g.play
	if rt == null or not rt.active:
		return false
	if not started:
		started = true
		for r in g.story.levels[g.level_id].get("rooms", []):
			var sz: Array = r.get("size", [0, 0, 0])
			if float(sz[0]) * float(sz[1]) < 2.0:          # a cupboard: no one stands in it
				continue
			var views := int(o["views"])
			for k in views:
				plan.append([r, 360.0 * k / views])
		rep["rooms"] = plan.size() / max(int(o["views"]), 1)
		rep["occluders"] = g.level.find_children("*", "OccluderInstance3D", true, false).size()
		rep["setting"] = bool(ProjectSettings.get_setting("rendering/occlusion_culling/use_occlusion_culling", false))
		return false
	if step >= plan.size():
		var v: int = max(int(rep["views"]), 1)
		rep["diff_mean"] = diffs / v
		rep["saved_objects"] = 1.0 - float(rep["on"]["objects"]) / max(float(rep["off"]["objects"]), 1.0)
		rep["saved_primitives"] = 1.0 - float(rep["on"]["primitives"]) / max(float(rep["off"]["primitives"]), 1.0)
		print("GDCULL " + JSON.stringify(rep))
		quit()
		return false
	frames += 1
	var r: Dictionary = plan[step][0]
	if phase == 0:
		var at: Array = r["at"]
		var sz: Array = r["size"]
		rt.place(Vector3(float(at[0]) + float(sz[0]) / 2.0, 0.0, -(float(at[1]) + float(sz[1]) / 2.0)), float(plan[step][1]), 0.0)
		root.use_occlusion_culling = true
		phase = 1
		frames = 0
	elif phase == 1 and frames >= int(o["wait"]):
		rep["on"]["objects"] += info(Viewport.RENDER_INFO_OBJECTS_IN_FRAME)
		rep["on"]["primitives"] += info(Viewport.RENDER_INFO_PRIMITIVES_IN_FRAME)
		rep["on"]["draws"] += info(Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
		img_on = root.get_texture().get_image()
		root.use_occlusion_culling = false
		phase = 2
		frames = 0
	elif phase == 2 and frames >= int(o["wait"]):
		rep["off"]["objects"] += info(Viewport.RENDER_INFO_OBJECTS_IN_FRAME)
		rep["off"]["primitives"] += info(Viewport.RENDER_INFO_PRIMITIVES_IN_FRAME)
		rep["off"]["draws"] += info(Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
		var img_off := root.get_texture().get_image()
		var dm := _diff(img_on, img_off)
		diffs += dm
		if dm > float(rep["diff_max"]):
			rep["diff_max"] = dm
			rep["worst"] = "%s facing %d" % [r.get("id"), int(plan[step][1])]
		rep["views"] += 1
		step += 1
		phase = 0
	return false


## the share of pixels that differ visibly between the two pictures (on a coarse grid: the TAA's jitter aside)
func _diff(a: Image, b: Image) -> float:
	if a == null or b == null or a.get_size() != b.get_size():
		return 1.0
	var bad := 0
	var tot := 0
	for y in range(4, a.get_height(), 8):
		for x in range(4, a.get_width(), 8):
			var ca := a.get_pixel(x, y)
			var cb := b.get_pixel(x, y)
			tot += 1
			if absf(ca.r - cb.r) + absf(ca.g - cb.g) + absf(ca.b - cb.b) > 0.25:
				bad += 1
	return float(bad) / max(tot, 1)
