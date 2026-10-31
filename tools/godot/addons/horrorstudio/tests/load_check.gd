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


## the bake's joint names (the figure's: pelvis, head...), from game/previs/index.json
func story_index_joints() -> Array:
	if not FileAccess.file_exists("res://game/previs/index.json"):
		return []
	var idx = JSON.parse_string(FileAccess.get_file_as_string("res://game/previs/index.json"))
	return idx.get("joints", []) if idx is Dictionary else []


func _initialize() -> void:
	create_timer(120.0, true, false, true).timeout.connect(func() -> void: print("watchdog"); quit(1))
	var story = Story.load_file("res://game/story.json")
	if story.data.is_empty():
		printerr("GDEXPORT FAIL: no story")
		quit(1)
		return
	var ok := true
	var surfaced := 0
	var shared: Dictionary = {}          # a material file's path -> the instances the pieces wear (one: loaded once, shared)
	var held: Array = []                 # kept alive across the levels, so a level loaded after another gets the same one
	var unfiled := 0                     # a set's material that isn't the game's file for it (game/materials/)
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
					var mat: Material = mi.material_override
					if not mat.resource_path.begins_with("res://game/materials/"):
						unfiled += 1
					else:
						var ids: Dictionary = shared.get(mat.resource_path, {})
						ids[mat.get_instance_id()] = true
						shared[mat.resource_path] = ids
						held.append(mat)
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
			var many := 0                     # a set's file loaded more than once (a piece with its own copy)
			for path in shared:
				if shared[path].size() != 1:
					many += 1
			var files := 0                    # the sets' files (a colour's has no maps: not counted above)
			for ref in info.get("materials", {}):
				if not String(ref).begins_with("#"):
					files += 1
			print("GDEXPORT materials: %d files in game/materials/ (the export wrote %d), each loaded once and shared by its pieces%s%s" % [
				shared.size(), files, "" if many == 0 else " (%d LOADED TWICE)" % many, "" if unfiled == 0 else " (%d pieces wear a set NOT FROM ITS FILE)" % unfiled])
			if many or unfiled or (want > 0 and shared.size() != files):
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
	# the bodies on the timeline: the first recorded scene's body instanced, its bone tracks seeked at a few frames, the head bone on the recording's head joint
	var bodied := 0
	for nid in story.flow:
		if story.flow[nid].get("type") != "scene" or not story.acts_index.has(nid):
			continue
		var spath := "res://game/acts/%s/scene.tscn" % str(story.acts_index[nid])
		if not FileAccess.file_exists(spath):
			continue
		var sn = load(spath).instantiate()
		var body = null
		for c in sn.get_children():
			if c.has_meta("body"):
				body = c
		if body == null:
			sn.free()
			continue
		var sid := str(story.flow[nid].get("ref"))
		var jpath := "res://game/previs/scenes/%s.json" % sid
		var rec = JSON.parse_string(FileAccess.get_file_as_string(jpath)) if FileAccess.file_exists(jpath) else null
		var sk: Skeleton3D = null
		for c in body.find_children("*", "Skeleton3D", true, false):
			sk = c
		var ap: AnimationPlayer = sn.get_node("Anim")
		var joints: Array = story_index_joints()
		var hj := joints.find("head")
		var bmeta = JSON.parse_string(str(body.get_meta("body")))                                                      # read before the scene goes
		var nbones: int = int(bmeta.get("bones", 0)) if bmeta is Dictionary else 0
		var worst := 0.0
		var measured := 0
		if sk != null and rec is Dictionary and hj >= 0 and sk.find_bone("c_head") >= 0:
			root.add_child(sn)
			var fps: float = float(rec.get("fps", 30))
			var frames: Array = rec.get("frames", [])
			for fi in [0, int(frames.size() / 3), int(frames.size() * 2 / 3), frames.size() - 1]:
				ap.play("scene")
				ap.seek(fi / fps, true)
				ap.advance(0.0)
				await process_frame                                  # the mixer's poses land on the skeleton over a frame
				await process_frame
				var cid := str(body.name).trim_prefix("Body_")
				var f: Dictionary = frames[fi]
				var jb = (f.get("bodies", {}) as Dictionary).get(cid)
				if jb == null or jb[hj] == null:
					continue
				var j: Array = jb[hj]
				var rec_head := Vector3(float(j[0]), float(j[2]), float(j[1])) / 100.0
				var head: Vector3 = sk.global_transform * sk.get_bone_global_pose(sk.find_bone("c_head")).origin
				worst = max(worst, (head - rec_head).length())
				measured += 1
			ap.stop()
			await process_frame
			root.remove_child(sn)
		sn.queue_free()                                     # not free(): the mixer's and the skeleton's deferred work still name it this frame
		await process_frame
		if measured < 3 or worst > 0.12:
			printerr("GDEXPORT FAIL: %s's body on the timeline: head %.3f m off the recording over %d frames (the bone tracks)" % [nid, worst, measured])
			ok = false
		else:
			print("GDEXPORT acts: %s's body on the timeline, its head within %.3f m of the recording at %d frames (%d bone tracks)" % [nid, worst, measured, nbones])
			bodied += 1
		break
	# an edit in a scene.tscn plays: the first camera position key moved a metre up in the file, the scene player's camera reads it moved (the file put back after)
	var first_scene = null
	for nid in story.flow:
		if story.flow[nid].get("type") == "scene" and story.acts_index.has(nid) and FileAccess.file_exists("res://game/acts/%s/scene.tscn" % str(story.acts_index[nid])):
			first_scene = nid
			break
	if first_scene != null:
		var spath := "res://game/acts/%s/scene.tscn" % str(story.acts_index[first_scene])
		var ed0 = story.edited_scene(first_scene)
		var c0: Dictionary = story.edited_camera(ed0, 0.0) if ed0 != null else {}
		var txt := FileAccess.get_file_as_string(spath)
		var rx := RegEx.new()
		rx.compile("tracks/0/keys = PackedFloat32Array\\(([-0-9.e]+), 1, ([-0-9.e]+), ([-0-9.e]+), ([-0-9.e]+)")
		var m := rx.search(txt)
		if ed0 == null or not c0.has("xf") or m == null:
			printerr("GDEXPORT FAIL: the scene timeline of %s has no camera to edit (%s)" % [first_scene, c0])
			ok = false
		else:
			var y0 := float(m.get_string(3))
			var edited_txt := txt.substr(0, m.get_start(3)) + str(y0 + 1.0) + txt.substr(m.get_end(3))
			var f := FileAccess.open(spath, FileAccess.WRITE)
			f.store_string(edited_txt)
			f.close()
			var ed1 = story.edited_scene(first_scene)
			var c1: Dictionary = story.edited_camera(ed1, 0.0) if ed1 != null else {}
			f = FileAccess.open(spath, FileAccess.WRITE)
			f.store_string(txt)
			f.close()
			var moved: float = float(c1["xf"].origin.y) - float(c0["xf"].origin.y) if c1.has("xf") else -9.0
			if abs(moved - 1.0) > 0.02:
				printerr("GDEXPORT FAIL: a camera key edited in %s should move the eye a metre up (moved %.3f)" % [spath, moved])
				ok = false
			else:
				print("GDEXPORT acts: a camera key edited by hand in a scene's timeline moves the scene's eye (%s)" % first_scene)
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
	var off: Array = []                                   # the balanced look's project settings, as the look plugin has them (HSLook.PROJECT)
	for k in HSLook.PROJECT:
		if ProjectSettings.get_setting(k) != HSLook.PROJECT[k]:
			off.append("%s %s (wants %s)" % [k, ProjectSettings.get_setting(k), HSLook.PROJECT[k]])
	print("GDEXPORT project settings: %d of the balanced look's %d as the plugin has them%s" % [HSLook.PROJECT.size() - off.size(), HSLook.PROJECT.size(), ("; off: " + ", ".join(off)) if off else ""])
	if off:
		ok = false
	if str(g.story.game.get("look", "balanced")) == "balanced" and not g.env.environment.ssr_enabled:
		print("GDEXPORT the balanced look isn't on the game's environment")
		ok = false
	print("GDEXPORT ok" if ok else "GDEXPORT FAIL")
	quit(0 if ok else 1)
