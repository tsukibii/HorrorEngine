## GDEXPORT (headless): the exported project's story reads, every level loads with its pieces, the main scene starts
## and the player stands at the start. Prints one line per level and "GDEXPORT ok".
extends SceneTree
const Story := preload("res://addons/horrorstudio/story.gd")

## a value in one form for comparing: JSON's numbers are all floats, a .tscn literal keeps ints; keys sorted
static func canon(v: Variant) -> Variant:
	if v is Dictionary:
		var out := {}
		var keys: Array = v.keys()
		keys.sort()
		for k in keys:
			out[str(k)] = canon(v[k])
		return out
	if v is Array:
		var a := []
		for x in v:
			a.append(canon(x))
		return a
	if v is int:
		return float(v)
	return v


func _initialize() -> void:
	create_timer(120.0, true, false, true).timeout.connect(func() -> void: print("watchdog"); quit(1))
	var story = Story.load_file("res://game/story.json")
	if story.data.is_empty():
		printerr("GDEXPORT FAIL: no story")
		quit(1)
		return
	var ok := true
	var surfaced := 0
	var info: Dictionary = {}
	var ef := FileAccess.open("res://game/export.json", FileAccess.READ)
	if ef != null:
		var parsed = JSON.parse_string(ef.get_as_text())
		if parsed is Dictionary:
			info = parsed
	var levels_last = story.levels.keys().back() if story.levels is Dictionary else null
	for lid in story.levels:
		var ps: PackedScene = load("res://game/levels/%s.tscn" % lid)
		if ps == null:
			printerr("GDEXPORT FAIL: level %s doesn't load" % lid)
			ok = false
			continue
		var n: Node3D = ps.instantiate()
		var kinds: Dictionary = {}
		var bad := 0
		var arts := 0                    # the kit's and the library's meshes instanced in their blocks, with geometry
		var empty := 0
		for ch in n.find_children("*", "", true, false):   # the level's folders by kind (Ground, Walls, Things...)
			if ch.has_meta("piece"):
				var p = JSON.parse_string(ch.get_meta("piece"))
				if p == null:
					bad += 1
					continue
				kinds[p["kind"]] = int(kinds.get(p["kind"], 0)) + 1
				var mi = ch.get_node_or_null("mesh")        # a surface off the shelf: a world-aligned material with its maps
				if mi is MeshInstance3D and mi.material_override is StandardMaterial3D and mi.material_override.albedo_texture != null and mi.material_override.uv1_triplanar:
					surfaced += 1
			var art = ch.get_node_or_null("art")
			if art != null:
				arts += 1
				if art.find_children("*", "MeshInstance3D", true, false).is_empty():
					empty += 1
		print("GDEXPORT level %s: %d nodes %s, %d art meshes%s%s" % [lid, n.get_child_count(), JSON.stringify(kinds), arts, "" if empty == 0 else " (%d EMPTY)" % empty, "" if bad == 0 else " BAD META %d" % bad])
		if lid == levels_last:
			var want := int(info.get("surfaced", 0))
			print("GDEXPORT surfaces: %d pieces wear a texture set off the shelf (the export made %d; sets %s)" % [surfaced, want, JSON.stringify(info.get("surface_sets", []))])
			if surfaced != want:
				ok = false
		if empty:
			ok = false
		if bad:
			ok = false
		n.free()
	# the editable layer: every task's stitch.tscn loads and reads back as story.json has it (its beats in order)
	var acts := 0
	var acts_bad := 0
	for nid in story.flow:
		var n0: Dictionary = story.flow[nid]
		if n0.get("type") != "stitch":
			continue
		var st0: Dictionary = story.stitches.get(n0.get("ref"), {})
		story.acts_read = false
		var st1: Dictionary = story.edited_stitch(nid, {"missing": true})
		if st1.has("missing"):
			printerr("GDEXPORT FAIL: no act scene for %s" % nid)
			acts_bad += 1
			continue
		acts += 1
		var b0: Array = st0.get("beats", [])
		var b1: Array = st1.get("beats", [])
		if b0.size() != b1.size() or JSON.stringify(st0.get("title", null)) != JSON.stringify(st1.get("title", null)):
			printerr("GDEXPORT FAIL: %s reads back with %d beats for %d" % [nid, b1.size(), b0.size()])
			acts_bad += 1
			continue
		for i in b0.size():
			if JSON.stringify(canon(b0[i].get("when", {}))) != JSON.stringify(canon(b1[i].get("when", {}))) or JSON.stringify(canon(b0[i].get("do", []))) != JSON.stringify(canon(b1[i].get("do", []))) or str(b0[i].get("id", "")) != str(b1[i].get("id", "")):
				printerr("GDEXPORT FAIL: %s beat %s reads back differently: %s / %s" % [nid, b0[i].get("id"), JSON.stringify(b0[i]), JSON.stringify(b1[i])])
				acts_bad += 1
	# an edit in a stitch.tscn plays: the first task's title changed in the file reads back changed (the file put back after)
	var first_nid = null
	for nid in story.flow:
		if story.flow[nid].get("type") == "stitch" and story.acts_index.has(nid):
			first_nid = nid
			break
	if first_nid != null:
		var path := "res://game/acts/%s/stitch.tscn" % str(story.acts_index[first_nid])
		var txt := FileAccess.get_file_as_string(path)
		var edited := txt.replace("fields = {\"title\": \"", "fields = {\"title\": \"EDITED IN GODOT ")
		if edited == txt:
			edited = txt.replace("fields = {", "fields = {\"title\": \"EDITED IN GODOT\", ")
		var f := FileAccess.open(path, FileAccess.WRITE)
		f.store_string(edited)
		f.close()
		var ps2 = ResourceLoader.load(path, "PackedScene", ResourceLoader.CACHE_MODE_IGNORE)
		var got := ""
		if ps2 != null:
			var inst = ps2.instantiate()
			got = str(inst.to_stitch().get("title", ""))
			inst.free()
		f = FileAccess.open(path, FileAccess.WRITE)
		f.store_string(txt)
		f.close()
		if not got.begins_with("EDITED IN GODOT"):
			printerr("GDEXPORT FAIL: a title edited in %s didn't read back (got %s)" % [path, got])
			acts_bad += 1
		else:
			print("GDEXPORT acts: a beat file edited by hand plays as edited (%s)" % first_nid)
	print("GDEXPORT acts: %d tasks as editable scenes, every beat read back as the story has it" % acts)
	var timelines := 0
	for nid in story.flow:
		if story.flow[nid].get("type") != "scene" or not story.acts_index.has(nid):
			continue
		var spath := "res://game/acts/%s/scene.tscn" % str(story.acts_index[nid])
		if not FileAccess.file_exists(spath):
			continue
		var sps = load(spath)
		var sn = sps.instantiate() if sps != null else null
		var ap = sn.get_node_or_null("Anim") if sn != null else null
		var an: Animation = ap.get_animation("scene") if ap != null and ap.has_animation("scene") else null
		if an == null or an.length <= 0.0 or an.get_track_count() < 1 or abs(an.length - float(sn.total)) > 0.05:
			printerr("GDEXPORT FAIL: %s has no scrubbable timeline (%s)" % [nid, spath])
			ok = false
		else:
			timelines += 1
		if sn != null:
			sn.free()
	print("GDEXPORT acts: %d recorded scenes as timelines to scrub (the camera along the recording, the lines as keys)" % timelines)
	if acts_bad:
		ok = false
	var main: PackedScene = load("res://addons/horrorstudio/main.tscn")
	var g := main.instantiate()
	root.add_child(g)
	await process_frame
	await process_frame
	var cam: Camera3D = g.get_node("Player/Camera")
	print("GDEXPORT start: level %s, eye at %s, fov %.1f, %d things" % [g.level_id, cam.global_position, cam.fov, g.things.size()])
	if g.things.is_empty():
		ok = false
	print("GDEXPORT ok" if ok else "GDEXPORT FAIL")
	quit(0 if ok else 1)
