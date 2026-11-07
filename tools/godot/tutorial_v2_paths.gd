## TUTORIAL2's look at the hotel's export (tools/godot/tutorial_v2.py): where its markers, lamps and the meshes the
## guide dresses are, as res://hotel.json (Godot's axes, the interior at the origin). Quits.
extends SceneTree


func _initialize() -> void:
	var ps := load("res://exports/interiors/hotel_floor/hotel_floor.glb") as PackedScene
	if ps == null:
		print("PATHS the hotel's export isn't imported")
		quit()
		return
	var h := ps.instantiate() as Node3D
	root.add_child(h)
	await process_frame
	var out := {"markers": {}, "rooms": {}, "lights": {}, "paths": {}, "boxes": {}}
	for m in h.find_children("*", "Node3D", true, false):
		var p := str(h.get_path_to(m))
		if p.contains("/markers/"):
			var e: Dictionary = m.get_meta("extras", {}) if m.has_meta("extras") else {}
			out["markers"][str(m.name)] = {"at": _v(m.global_position), "turn": rad_to_deg(m.global_rotation.y)}
			if str(m.name).ends_with("__volume"):
				var s: Array = e.get("size", [1, 1, 1])
				out["rooms"][str(e.get("room", ""))] = {"at": _v(m.global_position), "size": [s[0], s[2], s[1]]}
		elif m is Light3D:
			out["lights"][str(m.name)] = _v(m.global_position)
	var want := {"tv_screen": ["r304_kt_tv_55_1", "kit_screen"], "mirror": ["r304_bath_kt_vanity_mirror_1", "kit_mirror"],
		"end_glass": ["corridor_fx_win1", "kit_glass"], "window_304": ["r304_fx_win1", "kit_glass"]}
	for k in want:
		var top := h.find_child(want[k][0], true, false)
		if top != null:
			for mi in top.find_children("*", "MeshInstance3D", true, false):
				if str(mi.name).begins_with(want[k][1]):
					out["paths"][k] = str(h.get_path_to(mi))
					var ab: AABB = mi.global_transform * mi.get_aabb()
					out["boxes"][k] = {"at": _v(ab.get_center()), "size": _v(ab.size)}
					break
	for k in ["r304_bath_fx_floor", "linen_kt_bookshelf_1", "vending_kt_desk_1", "r304_bath_fx_tub"]:
		var n := h.find_child(k, true, false) as Node3D
		if n != null:
			out["paths"][k] = str(h.get_path_to(n))
			var box := AABB()
			var first := true
			for mi in n.find_children("*", "MeshInstance3D", true, false) + ([n] if n is MeshInstance3D else []):
				var ab: AABB = mi.global_transform * mi.get_aabb()
				box = ab if first else box.merge(ab)
				first = false
			out["boxes"][k] = {"at": _v(box.get_center()), "size": _v(box.size), "top": snappedf(box.end.y, 0.001)}
	for d in h.find_children("door_*", "", true, false):
		if str(d.get_parent().name) == "doors":
			out["paths"][str(d.name)] = str(h.get_path_to(d))
			out["boxes"][str(d.name)] = {"at": _v((d as Node3D).global_position)}
	var f := FileAccess.open("res://hotel.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(out, "  "))
	f.close()
	print("PATHS ok %d markers, %d rooms, %d lights, %d paths" % [out["markers"].size(), out["rooms"].size(), out["lights"].size(), out["paths"].size()])
	quit()


func _v(p: Vector3) -> Array:
	return [snappedf(p.x, 0.001), snappedf(p.y, 0.001), snappedf(p.z, 0.001)]
