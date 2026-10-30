## GDTESTROOM: TestRoom001 (docs/games/TestRoom001.md) played headless in Godot from its start to its good ending,
## station by station, as the desk's testroom.mjs plays it: each station's to-do list is its checklist, every task done
## by the thing it names (a click, a walk, a key) and heard ticked, and what the station shows measured on the way.
## Then the branches: a death and its retry (hide and seek), and the doll's trigger cutscene. After each station the
## run's state is written to Saved/Story/TestRoom001/godot_reference/states.json (the desk's reference beside it).
##   godot --headless --fixed-fps 60 --path Saved/Godot/TestRoom001 -s res://addons/horrorstudio/tests/gdtestroom.gd -- [--from=n_station] [--ref=DIR]
## Ends "GDTESTROOM ok".
extends SceneTree

const ORDER := ["n_arrive", "n_hello", "n_front", "n_doors", "n_power", "n_store", "n_kitchen", "n_chores", "n_rest", "n_games",
	"n_dark", "n_library", "n_bath", "n_talk", "n_hide", "n_run", "n_sneak", "n_sleep", "n_night", "n_annex", "n_final"]
const LEAVES := {"n_hello": {"karma": 1, "flags": ["met_aoi"], "states": {"kitchen_tv": "static"}}, "n_doors": {"items": ["key_brass", "fuse"], "flags": ["vault_open"]}, "n_power": {"flags": ["power_cut"]}, "n_kitchen": {"flags": ["phone_rang"], "states": {"kitchen_tv": "off"}},
	"n_chores": {"items": ["mop"], "flags": ["chores_done", "feat_clean"]}, "n_games": {"karma": 1}, "n_dark": {"items": ["flashlight", "batteries"], "flags": ["torch_on"]},
	"n_library": {"flags": ["found_painting"]}, "n_talk": {"karma": 2}, "n_annex": {"flags": ["annex_lit"]}}

var g
var rt
var fails := 0
var t_start := 0
var from_nid = null
var from_i := 0
var ref_dir := ""
var states: Dictionary = {}
var ticked_all: Array = []


const FOLDERS_OF := ["Ground", "Walls", "Ceilings", "Doors", "Things", "Lights", "Glass", "Triggers", "Spots", "People", "GI"]


var mains: Light3D = null          # the power station's hand-placed light (a look plugin preset on the mains)

func snap_for(nid: String) -> Dictionary:
	var s := {"flags": [], "items": [], "karma": {"karma": 0.0}, "counters": {}, "states": {}, "trail": []}
	for n in ORDER.slice(0, ORDER.find(nid)):
		var l: Dictionary = LEAVES.get(n, {})
		s["flags"].append_array(l.get("flags", []))
		s["items"].append_array(l.get("items", []))
		s["karma"]["karma"] += float(l.get("karma", 0))
		for k in l.get("states", {}):
			s["states"][k] = l["states"][k]
	return s


func fail(what: String, why: String) -> void:
	printerr("GDTESTROOM FAIL: %s: %s" % [what, why])
	fails += 1
	quit(1)


func step(what: String, fn: Callable) -> void:
	if fails > 0:
		return
	var r = await fn.call()
	if r is String and r != "":
		fail(what, r + "  " + where())
		return
	print("  ok  %s" % what)


func where() -> String:
	if rt == null:
		return "(no play)"
	return JSON.stringify({"trail": (g.run["trail"] as Array).slice(-3) if g.run != null else null, "active": rt.active, "at": [snapped(rt.player.pos.x, 0.01), snapped(-rt.player.pos.z, 0.01)],
		"busy": rt.busy, "line": g.hud.line_text, "todo": g.hud.tasks.map(func(t): return str(t["id"]) + ":" + str(t["state"])), "heard": (rt.todo_log as Array).slice(-6), "flags": (g.run["flags"].keys() as Array).slice(-6) if g.run != null else null,
		"hiding": rt.player.hiding, "choice": not g.hud.choice_over, "panel": g.hud.panel_el != null})


func frames(n: int) -> void:
	for i in n:
		await process_frame


func game_wait(secs: float) -> void:
	var c0: float = rt.clock
	var n := 0
	while rt.active and rt.clock - c0 < secs and n < 30000:
		await process_frame
		n += 1


## true when fn holds within the frames, else false
func until(fn: Callable, limit := 6000) -> bool:
	var n := 0
	while n < limit:
		if fn.call():
			return true
		await process_frame
		n += 1
	return false


func hold(key: String, secs: float) -> void:
	rt.key_event(key, true)
	await game_wait(secs)
	rt.key_event(key, false)


func press(key: String) -> void:
	rt.key_event(key, true)
	await frames(2)
	rt.key_event(key, false)


func playing(on: bool, limit := 6000) -> bool:
	return await until(func(): return (g.play != null and g.play.active) == on, limit)


func node() -> Variant:
	var R = g.run
	return R["trail"][R["trail"].size() - 1] if (R != null and R["trail"].size()) else null


## the flow has reached nid (and, a stitch, Play has the controls)
func at_node(nid: String) -> String:
	if not await until(func(): return g.run != null and g.run["trail"].has(nid), 12000):
		return "never reached %s" % nid
	var n: Dictionary = g.story.flow[nid]
	if n.get("type") == "stitch" and not g.story.stitches.get(n.get("ref"), {}).has("play"):
		if not await playing(true):
			return "Play never came for %s" % nid
		rt = g.play
	return ""


## a scene: skipped along (the dev skip) to each reply or choice, those answered in turn by `answers` (1-based)
func scene(answers: Array = []) -> String:
	var left := answers.duplicate()
	var n0 = node()
	var n := 0
	while n < 20000:
		n += 1
		if g.play != null and g.play.active:
			rt = g.play
			return ""
		if g.watch_end != null:
			return ""
		if node() != n0 and g.story.flow[node()].get("type") != "scene":
			return ""
		if not g.hud.choice_over:
			var k = left.pop_front() if left.size() else 1
			g.hud.choice_pick(int(k))
			await frames(10)
			continue
		if g.scene_player.playing:
			g.scene_player.skip()
			await frames(6)
		else:
			await process_frame
	return "the scene never ended"


## stand d metres from a thing, facing it, where the cursor lands on it (aimed at its middle, else across its top);
## look: only looked at. Returns {cursor, label} or {err}
func go_to(id: String, d: float = 0.9, look: bool = false) -> Dictionary:
	var n := 0
	while (rt.look_tween != null or rt.moving != null) and n < 3000:
		await process_frame
		n += 1
	var o = rt.by_id.get(id)
	if o == null:
		return {"err": "no " + id}
	var at: Vector3 = o["node"].global_position
	var sz: Array = o["size"]
	var aims: Array = [at]
	var top: float = at.y + float(sz[2]) / 2.0 - 0.002
	for fx in [0.15, 0.38, 0.62, 0.85]:
		for fz in [0.15, 0.38, 0.62, 0.85]:
			var lp := Vector3((fx - 0.5) * float(sz[0]), float(sz[2]) / 2.0 - 0.002, (fz - 0.5) * float(sz[1]))
			aims.append(o["node"].global_transform * lp)
	for dd in [d, d * 1.3, d * 0.8]:
		for k in 24:
			var a := k * PI / 12.0
			var feet := Vector3(at.x + cos(a) * dd, 0.0, at.z - sin(a) * dd)
			rt.place(feet, rad_to_deg(atan2(-(at.z - feet.z), at.x - feet.x)), 0.0)
			var before: Vector3 = rt.player.pos
			rt.push_out(rt.setting("walk"))
			if before.distance_to(rt.player.pos) > 1e-3:
				continue
			var trips := false
			for t in rt.triggers:
				if rt.is_in(t) and not rt.inside.has(t["id"]):
					trips = true
			if trips:
				continue
			var eye: Vector3 = rt.eye_pos()
			for aim in aims:
				rt.player.yaw = rad_to_deg(atan2(-(aim.z - eye.z), aim.x - eye.x))
				rt.player.pitch = rad_to_deg(atan2(aim.y - eye.y, sqrt(pow(aim.x - eye.x, 2) + pow(aim.z - eye.z, 2))))
				g.camera.global_position = eye
				g.camera.rotation_degrees = Vector3(rt.player.pitch, rt.player.yaw - 90.0, 0.0)
				rt.update_cursor(0.0)
				if (rt.look["id"] == id) if look else (rt.target != null and rt.target["id"] == id):
					return {"cursor": g.hud.cursor_kind, "label": g.hud.cursor_label}
	return {"err": "can't get the cursor on %s (hit %s, vis %s, hiding %s)" % [id, rt.look["id"], o["node"].visible, rt.player.hiding]}


func click() -> void:
	rt.use(true)
	await frames(2)


func use(id: String, d: float = 0.9) -> Dictionary:
	var r := await go_to(id, d)
	if r.has("err"):
		return r
	await click()
	return r


func place(x: float, y: float, yaw: float = 90.0, pitch: float = 0.0) -> void:
	rt.place(Vector3(x, 0.0, -y), yaw, pitch)


func flag(f: String) -> bool:
	return g.run != null and g.run["flags"].has(f)


func tasks() -> Array:
	return g.hud.tasks


func task(id: String) -> Variant:
	for t in tasks():
		if t["id"] == id:
			return t["state"]
	return null


func ticked(id: String, what: String = "") -> String:
	if await until(func(): return rt.todo_log.has(id + ":done"), 9000):
		return ""
	return "%s: never" % (what if what != "" else id + " ticked")


func state(id: String) -> Variant:
	return rt.state_of(id)


func door(id: String) -> Dictionary:
	var d: Dictionary = rt.door_of(id)
	return {"open": bool(d.get("open", false)), "locked": bool(d.get("locked", false))}


func close_panel() -> void:
	if g.hud.panel_el != null:
		g.hud._finish_panel(true)
		await frames(3)


func knocks() -> int:
	var n := 0
	for s in rt.sounds_heard:
		if str(s["n"]).begins_with("knock"):
			n += 1
	return n


func steps_on() -> Array:
	var out: Array = []
	for s in rt.sounds_heard:
		if str(s["n"]).begins_with("step_") and s["at"] == null:
			out.append(s.get("floor", "?"))
	return out


## a metre in front of a door on the side away from `into`, facing it, and on through
func walk_through(door_id: String, into: String, secs: float = 2.2) -> void:
	var t: Dictionary = rt.by_id[door_id]
	var b: Transform3D = t["base"]
	var at: Vector3 = b.origin
	var nrm: Vector3 = b.basis * Vector3(0, 0, 1)
	var r = null
	for room in g.story.levels[rt.level]["rooms"]:
		if room["id"] == into:
			r = room
	var mid := Vector3(float(r["at"][0]) + float(r["size"][0]) / 2.0 - at.x, 0, -(float(r["at"][1]) + float(r["size"][1]) / 2.0) - at.z)
	var side: float = sign(nrm.dot(mid))
	if side == 0:
		side = 1.0
	var feet := at - nrm * side * 1.0
	feet.y = 0
	rt.place(feet, rad_to_deg(atan2(-(at.z - feet.z), at.x - feet.x)), 0.0)
	await hold("W", secs)


func enter_room(door_id: String, room: String) -> String:
	if not door(door_id)["open"]:
		var r := await use(door_id, 1.0)
		if r.has("err"):
			return r["err"]
		if r["cursor"] == "locked":
			return "%s is locked" % door_id
		await game_wait(1.0)
	await walk_through(door_id, room)
	if not await until(func(): return rt.inside.has(room), 1800):
		return "in the %s: never (%s)" % [room, where()]
	return ""


func record(nid: String) -> void:
	var R = g.run
	if rt == null:
		rt = g.play
	if rt == null:
		return
	var doors: Dictionary = {}
	for k in rt.doors:
		var d: Dictionary = rt.doors[k]
		doors[k] = ("open" if d["open"] else "shut") + (", locked" if d["locked"] else "")
	var things: Dictionary = {}
	if rt.lives != null:
		for id in rt.lives.things:
			things[id] = rt.state_of(id)
	var fl: Array = R["flags"].keys()
	fl.sort()
	var it: Array = rt.items.keys()
	it.sort()
	for t in rt.todo_log:                 # the run's ticks, kept across a retry's new runtime (the desk's log is one for the run)
		if not ticked_all.has(t):
			ticked_all.append(t)
	states[nid] = {"flags": fl, "karma": R["karma"].duplicate(true), "counters": R["counters"].duplicate(true), "time": R["time"], "name": R["name"], "ticked": ticked_all.duplicate(),
		"level": rt.level, "power": rt.powered(), "items": it, "doors": doors, "things": things}
	if ref_dir != "":
		DirAccess.make_dir_recursive_absolute(ref_dir)
		var f := FileAccess.open(ref_dir.path_join("states.json"), FileAccess.WRITE)
		f.store_string(JSON.stringify({"game": "TestRoom001", "made": Time.get_datetime_string_from_system(), "from": from_nid if from_nid != null else ORDER[0], "states": states}, " "))
		f.close()


func station(nid: String, fn: Callable) -> void:
	if fails > 0 or ORDER.find(nid) < from_i:
		return
	var r := await at_node(nid)
	if r != "":
		fail(nid, r + "  " + where())
		return
	await fn.call()
	if fails == 0:
		record(nid)
		print("       %s done at %.1f min" % [nid, (Time.get_ticks_msec() - t_start) / 60000.0])


func _initialize() -> void:
	create_timer(1500.0, true, false, true).timeout.connect(func() -> void: printerr("GDTESTROOM FAIL: watchdog"); quit(1))
	t_start = Time.get_ticks_msec()
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--from="):
			from_nid = a.substr(7)
		if a.begins_with("--ref="):
			ref_dir = a.substr(6)
	g = (load("res://addons/horrorstudio/main.tscn") as PackedScene).instantiate()
	g.autostart = false
	root.add_child(g)
	await process_frame
	if from_nid != null:
		from_i = ORDER.find(from_nid)
		g.watch(from_nid, snap_for(from_nid))
		print("  from %s" % from_nid)
	else:
		g.watch(null, null)

	await station("n_arrive", func():
		await step("1 · Moving: the arrival in the yard, its two tasks on the list, the walk, the run, the crouch, the steps on dirt", func():
			if not await until(func(): return tasks().size() == 2, 3000):
				return "the list after the fade in: " + JSON.stringify(tasks())
			var t := tasks()
			if t[0]["id"] != "t1_door" or t[1]["id"] != "t1_in" or t.any(func(x): return x["state"] != "open"):
				return "the list " + JSON.stringify(t)
			var rain = g.level.get_node_or_null("Rain")              # game.weather rain: one box for the level, riding with the eye, its drops only in the rooms with no ceiling (the yard)
			if rain == null or not (rain is HSRain) or rain.multimesh == null or rain.multimesh.instance_count < 200:
				return "no rain: " + str(rain)
			var rooms_n = rain.mat.get_shader_parameter("rooms_n")
			var e: Vector3 = rt.eye_pos()
			if int(rooms_n) < 1 or not rain.mat.get_shader_parameter("follow") or abs(rain.global_position.x - e.x) > 0.05 or abs(rain.global_position.z - e.z) > 0.05:
				return "the rain box: rooms %s, follow %s, at %s against the eye %s" % [rooms_n, rain.mat.get_shader_parameter("follow"), rain.global_position, e]
			var yard_floor = null
			for ch in g.pieces():
				if ch.has_meta("piece") and str(ch.get_meta("piece")).contains("\"yard__floor\""):
					yard_floor = ch.get_node_or_null("mesh")
			if yard_floor == null or not (yard_floor.material_override is ShaderMaterial) or yard_floor.material_override.shader != HSWet.shader():
				return "the yard's floor isn't wet: " + str(yard_floor)
			var lo: PackedVector4Array = rain.mat.get_shader_parameter("rooms_lo")
			var hi: PackedVector4Array = rain.mat.get_shader_parameter("rooms_hi")
			var yard_box := false                                    # the yard's box among them (13 by 4 m, south of the lobby: Godot z 5 to 9); the lobby (a ceiling) in none
			var lobby_box := false
			for i in int(rooms_n):
				if hi[i].x - lo[i].x >= 12.9 and hi[i].z - lo[i].z >= 3.9 and lo[i].z >= 4.99 and hi[i].z <= 9.01:
					yard_box = true
				if lo[i].z < 4.99 and hi[i].z > 0.01 and lo[i].x < 1.5 and hi[i].x > 1.5:
					lobby_box = true
			if lo.size() != 8 or not yard_box or lobby_box:
				return "the rain's room boxes: %s / %s" % [lo, hi]
			if rt.panes.size() != 2 or rt.panes.any(func(pn): return not (pn.material_override is ShaderMaterial) or pn.material_override.shader != HSGlass.shader() or float(pn.material_override.get_shader_parameter("rain")) <= 0.0):
				return "the lobby's two panes should wear the glass with the rain on it: " + str(rt.panes.size())
			var shafts: Array = g.level.get_node("Lights").get_children().filter(func(c): return c is FogVolume and c.has_meta("shaft"))   # the lobby's windows throw shafts (HSShaft on the export's FogVolumes)
			if shafts.size() != 2 or shafts.any(func(fv): return not (fv.material is FogMaterial) or fv.material.density > 0.0 or fv.size.z < 2.9):   # the fog emptied: the beam is a card (2026-10-30)
				return "the lobby's two window shafts: %d, %s" % [shafts.size(), shafts.map(func(fv): return [fv.material, fv.size])]
			if shafts.any(func(fv): var card = fv.get_node_or_null("Card"); return card == null or card.mesh == null or card.mesh.get_surface_count() != 7 or not (card.get_surface_override_material(0) is ShaderMaterial) or card.get_surface_override_material(0).shader != HSShaft.shader()):
				return "each shaft's card: seven planes on the card shader (two along the beam, five across)"
			var wl: Array = g.level.get_node("Lights").get_children().filter(func(c): return c is SpotLight3D and c.has_meta("window") and float(c.light_volumetric_fog_energy) >= 4.0 and c.shadow_enabled)
			if wl.size() != 2:
				return "the lobby's window lights should light the haze with shadows: %d" % wl.size()
			var cl = rt.by_id.get("yard_puddle_light")                    # the puddle under the yard's lamp throws its light up the wall (a pattern light: a spot aimed at the wall, caustics in its projector)
			if cl == null or not (cl["node"] is SpotLight3D):
				return "the puddle's light should be a spot: " + str(cl)
			var sp: SpotLight3D = cl["node"]
			var hp = HSPattern.on(sp)
			if hp == null or hp.kind != "caustics" or not sp.shadow_enabled:
				return "no caustics on the puddle's light: %s" % [hp]
			var beam: Vector3 = -sp.global_transform.basis.z
			if beam.z > -0.4 or beam.y < 0.5 or absf(sp.spot_angle - 35.0) > 0.01:         # up the lobby's south wall (north of the yard: Godot -z) from the ground
				return "the puddle's light should aim up the wall: beam %s, angle %.1f" % [beam, sp.spot_angle]
			if DisplayServer.get_name() != "headless" and (sp.light_projector == null or hp.textures.size() < 40):
				return "the caustic loop isn't drawn: %d frames" % hp.textures.size()
			if g.level.find_children("*", "VoxelGI", true, false).size() or g.level.find_children("*", "ReflectionProbe", true, false).size() or g.level.find_children("*", "LightmapGI", true, false).size():
				return "the export should leave the lighting to the user: no VoxelGI, probe or lightmap in the level (DECISIONS 2026-10-30, noon)"
			var ca = g.camera.attributes                                   # the iris: auto exposure on the camera, settling over about a second
			if not (ca is CameraAttributesPractical) or not ca.auto_exposure_enabled or absf(ca.auto_exposure_speed - 1.0) > 0.01 or absf(ca.auto_exposure_scale - 0.4) > 0.01:
				return "the iris should be on by day: " + str(ca)
			if rt.sweeps.size() != 1 or rt.sweeps[0]["room"] != "lobby" or not (rt.sweeps[0]["node"] is HSSweep):   # the lobby's first window: a car passes now and then (HSSweep)
				return "the lobby's sweep: " + str(rt.sweeps)
			rt.sweep("lobby")
			await frames(3)
			var swn: HSSweep = rt.sweeps[0]["node"]
			if not rt.sweeping("lobby") or not swn.lamp.visible or swn.lamp.light_energy <= 0.0 or not swn.lamp.shadow_enabled:
				return "the car should be passing: passing %s, lamp visible %s energy %.2f" % [rt.sweeping("lobby"), swn.lamp.visible, swn.lamp.light_energy]
			var lp0: Vector3 = swn.lamp.global_position
			await game_wait(1.0)
			var lp1: Vector3 = swn.lamp.global_position
			if lp0.distance_to(lp1) < 2.0 or absf(lp1.z - lp0.z) > 0.01 or lp1.z < 5.5:    # along the street (x), outside the south wall (Godot z beyond 5)
				return "the headlights should slide along the street outside: from %s to %s" % [lp0, lp1]
			await game_wait(2.5)
			if rt.sweeping("lobby") or swn.lamp.visible:
				return "the car should have passed"
			if rt.rain_sounds.size() < 1 or not (rt.rain_sounds[0]["p"] is AudioStreamPlayer3D):    # the shelf's rain in the yard, riding with you while you're in it
				return "no rain heard in the yard: " + str(rt.rain_sounds)
			place(1.5, -8.5, 0)
			await game_wait(0.2)
			var rp: AudioStreamPlayer3D = rt.rain_sounds[0]["p"]
			if not rt.inside.has("yard") or rp.global_position.distance_to(rt.eye_pos()) > 0.05:
				return "the rain's sound should ride with the player in the yard: at %s, the eye at %s, inside %s" % [rp.global_position, rt.eye_pos(), rt.inside.keys()]
			rt.sounds_heard.clear()
			place(1.5, -8.5, 0)
			var x0: float = rt.player.pos.x
			await hold("W", 1.2)
			var walked: float = rt.player.pos.x - x0
			place(1.5, -8.0, 0)
			rt.key_event("Shift", true)
			await hold("W", 1.2)
			rt.key_event("Shift", false)
			var ran: float = rt.player.pos.x - 1.5
			if not (walked > 0.8) or not (ran > walked * 1.6):
				return "walked %.2f m, ran %.2f m in the same time" % [walked, ran]
			await press("C")
			await game_wait(0.7)
			var eye: float = rt.player.eye
			await press("C")
			await game_wait(0.7)
			if not (eye < 1.2):
				return "crouched, the eye at %.2f" % eye
			var st := steps_on()
			if st.is_empty() or st.any(func(f): return f != "dirt"):
				return "steps in the yard: " + JSON.stringify(st)
			if not str(rt.last_step.get("name", "")).begins_with("step_wet"):     # the yard's in the rain (game.weather): the steps sound wet
				return "steps in the rain should be wet: " + str(rt.last_step)
			var stepped: Array = rt.audio_log.filter(func(a): return str(a["n"]).begins_with("step_"))   # the steps' sounds loaded
			if stepped.is_empty() or stepped.any(func(a): return not a["loaded"]):
				return "the steps off the shelf: " + JSON.stringify(stepped.slice(0, 3))
			return "")
		await step("the pause menu: Esc holds the game and opens it in the HUD's theme, Save game saves to a slot, Esc twice resumes", func():
			await game_wait(0.5)
			var sf := ProjectSettings.globalize_path("user://saves_TestRoom001.json")   # a fresh slot each run
			if FileAccess.file_exists(sf):
				DirAccess.remove_absolute(sf)
			await press("Escape")
			await frames(3)
			if not rt.held or g.hud.menu == null or not g.hud.menu.up:
				return "the menu didn't open (held %s)" % rt.held
			if g.hud.menu.controls_box.get_child_count() < 6 or g.hud.theme_name == "":
				return "the controls on the left: %d rows, theme %s" % [g.hud.menu.controls_box.get_child_count(), g.hud.theme_name]
			rt.key_event("S", true)
			rt.key_event("Enter", true)
			await frames(2)
			if g.hud.menu.at != "save":
				return "Save game page: at " + g.hud.menu.at
			rt.key_event("Enter", true)
			await frames(2)
			if not g.hud.menu.saves.has("1") or not FileAccess.file_exists("user://saves_TestRoom001.json"):
				return "slot 1 not saved: " + JSON.stringify(g.hud.menu.saves)
			rt.key_event("Escape", true)
			rt.key_event("Escape", true)
			await frames(3)
			if rt.held or g.hud.menu.up:
				return "didn't resume (held %s, up %s)" % [rt.held, g.hud.menu.up]
			return "")
		await step("the level in folders (Ground, Walls, Things, Lights...), and the camhybrid tape's softener on the camera (off takes it away)", func():
			for f in ["Ground", "Walls", "Ceilings", "Doors", "Things", "Lights", "Triggers", "Spots"]:
				var fold = g.level.get_node_or_null(f)
				if fold == null or fold.get_child_count() == 0:
					return "the level has no %s folder with children in it" % f
			if g.pieces().size() < 20 or g.pieces().any(func(n): return FOLDERS_OF.has(str(n.name)) and not n.has_meta("piece")):
				return "pieces() should read through the folders: %d" % g.pieces().size()
			var vhsn = g.get_node("VHS")
			vhsn.preset("camhybrid")
			await frames(2)
			var sft = HSSoften.on(g.camera)                            # on the camera's compositor, after the transparents (the digits, the steam and the glows stay)
			if sft == null or absf(float(sft.far_m) - 5.75) > 0.001 or absf(float(vhsn.mat.get_shader_parameter("distortion")) - 0.062) > 0.001:
				return "camhybrid: softener %s, distortion %s" % [sft, vhsn.mat.get_shader_parameter("distortion")]
			if sft.effect_callback_type != CompositorEffect.EFFECT_CALLBACK_TYPE_POST_TRANSPARENT:
				return "the softener should run after the transparents: %d" % sft.effect_callback_type
			await frames(4)
			if sft.rd != null and (not sft.ready_ or sft.frames < 1):   # headless has no rendering device: the pass can't run there
				return "the softener's pass didn't run: ready %s, frames %d" % [sft.ready_, sft.frames]
			vhsn.preset("off")
			await frames(2)
			if HSSoften.on(g.camera) != null:
				return "off should take the softener off the compositor"
			return "")
		await step("the front door: a click opens it (the task ticks), through it into the lobby (it ticks), and the station ends", func():
			place(1.5, -5.9, 90)
			await use("front_door", 1.0)
			await game_wait(1.0)
			if not door("front_door")["open"]:
				return "not open"
			var r := await ticked("t1_door")
			if r != "":
				return r
			await walk_through("front_door", "lobby", 2.5)
			if not await until(func(): return not rt.has_end or g.run["trail"].size() > 1, 3000):
				return "the station's end: never"
			return ""))

	await station("n_hello", func():
		await step("Aoi in the lobby (a scene): her name a word (the guide, till you've met her), her reply answered as a conversation card (Ready: karma +1, her reply two lines, then on past the line for Not great), her body track (she walks to the bench and sits), the scene's cues (the kitchen's TV to static), its sets (met_aoi)", func():
			if not await until(func(): return not g.hud.choice_over, 6000):
				return "her question never came"
			var who_q: String = g.hud.who_el.text
			if who_q != "the guide":
				return "her name at her question: %s (the guide till you've met her)" % JSON.stringify(who_q)
			var xq: float = rt.cast_nodes["aoi"].position.x
			var rows: Array = g.hud.choice_el.get_children().filter(func(c): return c is Button)   # the choice as the user asked (2026-10-30, evening): the answers on one line, a dash between, no numbers; A/D move, the mouse free to click
			var dashes: Array = g.hud.choice_el.get_children().filter(func(c): return c is Label and str(c.text) == "—")
			if not g.hud.choice_box.visible or rows.size() < 2 or dashes.size() != rows.size() - 1 or str(rows[0].text).substr(0, 2).ends_with(".") or rt.mouse_captured:
				return "the choice: shown %s, %d answers, %d dashes, first %s, the mouse still captured %s" % [g.hud.choice_box.visible, rows.size(), dashes.size(), JSON.stringify(rows[0].text if rows.size() else ""), rt.mouse_captured]
			g.hud.choice_key("1")                                          # a number picks nothing now
			if g.hud.choice_over:
				return "a number key still picks an answer"
			g.hud.choice_key("D")                                          # D moves to the second, A back to the first
			var moved: bool = g.hud.choice_sel == 1
			g.hud.choice_key("A")
			if not moved or g.hud.choice_sel != 0:
				return "A and D don't move between the answers (sel %d)" % g.hud.choice_sel
			rows[0].pressed.emit()                                         # a click on the first answer
			if not g.hud.choice_over:
				return "a click on the choice's first answer didn't pick it"
			var xs: Array = []
			var n := 0
			var line_seen := 0                                           # frames a line was up and its label drawn with the words in it (the user, 2026-10-30: no dialogue seen in a cutscene)
			var line_hidden := 0
			while n < 20000:
				n += 1
				if (g.play != null and g.play.active) or node() != "n_hello":
					break
				if rt.npcs.has("aoi") and rt.npcs["aoi"]["pos"] != null:   # her body track (the behaviour), under the bake's body
					xs.append(rt.npcs["aoi"]["pos"].x)
				if g.hud.line_text != "":
					if g.hud.line_el.is_visible_in_tree() and g.hud.line_el.text != "" and g.hud.line_el.modulate.a > 0.5 and g.hud.line_el.self_modulate.a > 0.5:
						line_seen += 1
					else:
						line_hidden += 1
				await process_frame
			if line_seen == 0 or line_hidden > line_seen:
				return "the lines' label: drawn with words on %d frames, hidden or empty on %d while a line was up (visible %s, text %s)" % [line_seen, line_hidden, g.hud.line_el.is_visible_in_tree(), JSON.stringify(g.hud.line_el.text)]
			var subs: Array = g.hud.lines_shown
			var said := ["Good. Then let's begin.", "The corridor's yours. I'll be watching.", "One thing a room. Fine."]
			var skipped := "Tell me if it gets to be too much."
			for s in said:
				if not subs.has(s):
					return "the conversation said " + JSON.stringify(subs)
			if subs.has(skipped) or subs.find(said[0]) > subs.find(said[1]) or subs.find(said[1]) > subs.find(said[2]):
				return "the conversation's order " + JSON.stringify(subs)
			var tl: Dictionary = g.story.timeline(g.story.version(g.story.scenes["s_hello"]), {"c3": "good"}, {}, {})
			var ids: Array = []
			for s in tl["segs"]:
				if s["type"] == "clip":
					ids.append(s["clip"]["id"])
			if ",".join(ids) != "c1,c2,c3,c3_good,c3_good_2,c4":
				return "its takes: " + ",".join(ids)
			var xmin: float = xs.min() if xs.size() else 99.0
			if not (xmin < -2.9):
				return "her body track: she never got down to the bench (x %.2f at her question, then to %.2f)" % [xq, xmin]
			var R = g.run
			if float(R["karma"].get("karma", 0)) != 1 or not R["flags"].has("met_aoi") or R["lives"].at("kitchen_tv", float(R["secs"]) + 999)["state"] != "static":
				return JSON.stringify({"karma": R["karma"], "met": R["flags"].has("met_aoi"), "tv": R["lives"].at("kitchen_tv", float(R["secs"]) + 999)["state"]})
			if g.bake != null:   # the scene played from the desk's bake: its frames shown, her skinned body's head on the recorded joint
				var bs: Dictionary = g.scene_player.bake_stats
				if int(bs.get("frames", 0)) < 100 or float(bs.get("head_err", 9)) > 0.12 or float(bs.get("mismatch", 9)) > 0.05 or float(bs.get("face_max", 0)) < 0.2 or int(bs.get("held", 0)) > 0:
					return "the bake: " + JSON.stringify(bs)
				if not (bs.get("skin_aoi") is bool and bs["skin_aoi"]):             # her skin on HumanShaders' skin shader (HSSkin), her tone kept
					return "her skin isn't on the skin shader: " + JSON.stringify(bs)
				if FileAccess.file_exists("res://game/previs/Body_aoi__second.glb") and not str(bs.get("body_aoi", "")).ends_with("Body_aoi__second.glb"):   # the scene picks her "second" model (STORY_FORMAT §3.1): played on that model's body
					return "the scene's model: " + str(bs.get("body_aoi", ""))
			if g.run.get("models", {}).get("aoi") != "second":                  # and the run carries the pick from here on
				return "the run's models: " + JSON.stringify(g.run.get("models", {}))
			if rt.standins.has("aoi") and FileAccess.file_exists("res://game/previs/Body_aoi__second.glb") and not str(rt.standins["aoi"].get_meta("file", "")).ends_with("Body_aoi__second.glb"):
				return "her stand-in after the scene: " + str(rt.standins["aoi"].get_meta("file", ""))
			return ""))

	await station("n_front", func():
		await step("2 · The front door: the steps on the lobby's tile; the knock heard at it, Aoi outside; the peephole puts the eye to her (the task ticks, her line), a step back", func():
			rt.sounds_heard.clear()
			place(-2.0, -4.0, 0)
			await hold("W", 1.0)
			var st := steps_on()
			if st.is_empty() or st.any(func(f): return f != "tile"):
				return "the steps in the lobby: " + JSON.stringify(st)
			var tv: Dictionary = rt.lifefx.report().get("kitchen_tv", {})     # static since the lobby's scene set it
			if tv.get("screen") != "static" or int(tv.get("screen_frame", -1)) < 0:
				return "the TV: " + JSON.stringify(tv)
			await game_wait(0.6)
			var lens := ""
			for id in ["front_door:peephole:a", "front_door:peephole:b"]:
				var r := await go_to(id, 0.6)
				if not r.has("err"):
					lens = id
					break
			if lens == "":
				return "the lens"
			await click()
			await game_wait(0.5)
			var p := {"peeping": rt.player.peeping["door"] if rt.player.peeping != null else null, "aoi": rt.npcs["aoi"]["as"] if rt.npcs.has("aoi") else null, "y": -rt.npcs["aoi"]["pos"].z if rt.npcs.has("aoi") and rt.npcs["aoi"]["pos"] != null else 0.0}
			if p["peeping"] != "front_door" or p["aoi"] != "idle" or not (float(p["y"]) < -5):
				return "at the lens: " + JSON.stringify(p)
			var aw := float(rt.skin_wet.get("aoi", {}).get("wet", 0.0))     # out in the yard's rain: her skin wets by itself
			if not (aw > 0.1):
				return "Aoi out in the rain should be wet by now: %s" % aw
			var r2 := await ticked("t2_peep")
			if r2 != "":
				return r2
			if knocks() == 0 and not g.hud.logs.any(func(l): return str(l).contains("knock")):
				return "no knock heard"
			var played: Array = rt.audio_log.filter(func(a): return str(a["n"]).begins_with("knock"))   # off the shelf, placed at the door
			if played.is_empty() or not played[0]["loaded"] or played[0]["at"] == null:
				return "the knock off the shelf: " + JSON.stringify(played.slice(0, 2))
			await press("S")
			await game_wait(0.3)
			return "")
		await step("the latch: the door shut first (Close it first), then its thumb turn locks it (the task ticks), Aoi goes", func():
			if door("front_door")["open"]:
				var r0 := await go_to("front_door:latch", 0.6)
				if r0.get("cursor") != "locked" or not str(r0.get("label", "")).to_lower().contains("close it first"):
					return "the turn on an open door: " + JSON.stringify(r0)
				await use("front_door", 1.0)
				await game_wait(1.2)
				if door("front_door")["open"]:
					return "still open"
			await use("front_door:latch", 0.6)
			await game_wait(0.4)
			if not rt.door_of("front_door").get("locked", false):
				return "not locked"
			return await ticked("t2_lock")))

	await station("n_doors", func():
		await step("3 · Doors and keys: the sliding door to the keys room; the closet locked (Locked) until the brass key's taken, then it opens and you walk in", func():
			place(1.5, 1.2, 90)
			var r := await enter_room("door_keys", "keys")
			if r != "":
				return r
			var c0 := await go_to("closet_door", 1.0)
			if c0.get("cursor") != "locked":
				return "the closet without the key: " + JSON.stringify(c0)
			await use("key_brass_pickup", 0.7)
			r = await ticked("t3_key")
			if r != "":
				return r
			r = await enter_room("closet_door", "closet")
			if r != "":
				return r
			return await ticked("t3_closet"))
		await step("the code on the closet's note (ticks), the store's keypad takes 4071, the vault's flag lock opens, in (ticks), the fuse (ticks), the door slams behind you, and you get out again", func():
			await use("code_note", 0.6)
			await frames(5)
			if g.hud.panel_el == null or not str(g.hud.panel_el.find_child("Text", true, false).text).contains("4071"):
				return "the note"
			await close_panel()
			var r := await ticked("t3_code")
			if r != "":
				return r
			await walk_through("closet_door", "keys")
			place(-2.5, 2.5, 0)
			r = await enter_room("door_keys", "corridor")
			if r != "":
				return r
			r = await enter_room("door_store", "store")
			if r != "":
				return r
			var v0 := await go_to("vault_door", 1.0)
			if v0.get("cursor") != "locked":
				return "the vault before its code: " + JSON.stringify(v0)
			await use("vault_keypad", 0.7)
			await frames(5)
			if g.hud.panel_el == null:
				return "no pad"
			for k in ["4", "0", "7", "1", "Enter"]:
				rt.key_event(k, true)
			await frames(5)
			if not flag("vault_open"):
				return "the keypad didn't set vault_open"
			r = await enter_room("vault_door", "vault")
			if r != "":
				return r
			r = await ticked("t3_vault")
			if r != "":
				return r
			await use("fuse_pickup", 0.6)
			r = await ticked("t3_fuse")
			if r != "":
				return r
			if not await until(func(): return not rt.door_of("vault_door").get("open", false), 1800):
				return "the vault door slammed: never"
			return await enter_room("vault_door", "store")))

	await station("n_power", func():
		await step("4 · Power: into the power room, the power cuts (the lamps dark, the candle burning on, the switch only clicks: No power)", func():
			place(1.5, 2.5, 0)
			mains = (load("res://addons/horrorstudio_look/presets/fluorescent_tube.tscn") as PackedScene).instantiate()   # a light of the user's own (the look plugin's preset), on the mains
			g.level.add_child(mains)
			mains.position = Vector3(2.0, 2.4, -2.0)
			var r := await enter_room("door_power", "power")
			if r != "":
				return r
			if not await until(func(): return not rt.powered(), 1800):
				return "the power cut: never"
			await frames(3)
			var L := {"lamp": rt.light_energy("power_lamp"), "candle": rt.light_energy("power_candle_light"), "corridor": rt.light_energy("corr_lamp_1")}
			if L["lamp"] != 0 or L["corridor"] != 0 or not (L["candle"] > 0):
				return JSON.stringify(L)
			if mains.visible:
				return "a hand-placed light on the mains still on in the cut"
			var s := await go_to("power_switch", 0.7)
			if s.get("cursor") != "locked" or not str(s.get("label", "")).to_lower().contains("no power"):
				return "the switch in the cut: " + JSON.stringify(s)
			await click()
			await game_wait(0.3)
			if task("t4_switch") != "open":
				return "a dead switch ticked its task"
			return "")
		await step("the breaker brings the power back (ticks, the lamp flickering up), the switch lights the bulb (ticks), the candle blown out (ticks)", func():
			await use("breaker_box", 0.7)
			await game_wait(1.2)
			if not rt.powered():
				return "no power"
			if not mains.visible:
				return "the hand-placed light on the mains not back with the power"
			mains.queue_free()
			var r := await ticked("t4_breaker")
			if r != "":
				return r
			await use("power_switch", 0.7)
			await game_wait(0.4)
			if not (rt.light_energy("power_bulb") > 0):
				return "the bulb is dark"
			r = await ticked("t4_switch")
			if r != "":
				return r
			var c := await use("power_candle", 0.6)
			if not str(c.get("label", "")).to_lower().contains("blow"):
				return "the candle says " + JSON.stringify(c)
			await game_wait(0.3)
			r = await ticked("t4_candle")
			if r != "":
				return r
			await frames(3)
			if rt.light_energy("power_candle_light") != 0:
				return "the candle's light is still on"
			var u: Dictionary = rt.light_state["power_lamp"]                  # the lamp is a dying tube (its `mode`): it drops out now and then, never quite full between
			if u.get("mode") != "dying" or float(u.get("interval", 0)) != 4.0 or float(u.get("flicker", 0)) <= 0.0:
				return "the power lamp's flicker mode: " + JSON.stringify({"mode": u.get("mode"), "interval": u.get("interval"), "flicker": u.get("flicker")})
			var es: Array = []
			var t0: float = rt.clock
			while rt.clock < t0 + 6.0:
				await frames(1)
				es.append(rt.light_energy("power_lamp"))
			es.sort()
			var lo: float = es[0]
			var mid: float = es[es.size() / 2]
			if not (lo < float(u["base"]) * 0.5 and mid > float(u["base"]) * 0.6 and mid < float(u["base"]) * 0.9):
				return "the dying lamp over six seconds: lowest %.2f, mostly %.2f of %.2f (it should drop out and sit under full between)" % [lo, mid, float(u["base"])]
			var f: Dictionary = rt.light_state["corr_lamp_2"]
			if f.get("mode") != "fluorescent" or float(f.get("flicker", 0)) != 0.3:
				return "the corridor's second lamp should be a fluorescent at 0.3: " + JSON.stringify({"mode": f.get("mode"), "flicker": f.get("flicker")})
			return ""))

	await station("n_store", func():
		await step("5 · In your hands: the three tins into the inventory's row (each ticks), the box carried to the shelf and put down there (G: it ticks), the plushie in the hand (ticks)", func():
			place(1.5, 7.5, 180)
			var r := await enter_room("door_store", "store")
			if r != "":
				return r
			for t in ["a", "b", "c"]:
				await use("tin_%s_pickup" % t, 0.6)
				r = await ticked("t5_%s" % t)
				if r != "":
					return r
			if rt.inv.size() < 3:
				return "the row holds %d" % rt.inv.size()
			var slots: Array = g.hud.inv_box.get_children()        # the row's slots: the tins themselves in small viewports of their own world
			if slots.size() != min(rt.inv.size(), 5):              # the key and the fuse are in it too from the start
				return "the row shows %d slots for %d things" % [slots.size(), rt.inv.size()]
			var mids := 0
			for sl in slots:
				var vp = sl.get_node_or_null("Frame/View")
				if vp == null or not vp.own_world_3d or not vp.transparent_bg:
					return "a slot without its own world: " + str(sl.name)
				if vp.find_children("*", "MeshInstance3D", true, false).is_empty():
					return "a slot with no model in it: " + str(sl.name)
				if int(sl.get_meta("d")) == 0:
					mids += 1
					if vp.render_target_update_mode != SubViewport.UPDATE_WHEN_VISIBLE or sl.get_meta("id") != rt.carried()["id"]:
						return "the middle slot isn't the one in the hand, drawn live"
				elif not [SubViewport.UPDATE_ONCE, SubViewport.UPDATE_DISABLED].has(vp.render_target_update_mode):   # once, then off
					return "a side slot drawn every frame: " + str(sl.name)
			if mids != 1:
				return "%d middle slots" % mids
			await use("store_box", 0.8)
			await game_wait(0.3)
			if rt.carried() == null or rt.carried()["id"] != "store_box":
				return "the box isn't in the hand"
			place(-2.5, 7.9, 90)
			await game_wait(0.3)
			await press("G")
			await game_wait(0.3)
			r = await ticked("t5_box")
			if r != "":
				return r
			await use("store_plush", 0.8)
			r = await ticked("t5_plush")
			if r != "":
				return r
			await game_wait(0.4)
			var hd = rt.physics.hand                            # the plushie in the hand: its copy sprung after the hand, soft
			if hd == null or hd["s"]["name"] != "plushie" or not hd["node"].visible or hd["node"].get_child_count() == 0:
				return "the plushie in the hand: " + JSON.stringify({"hand": hd != null, "kind": hd["s"]["name"] if hd != null else null})
			await press("Q")                                       # lowered (Q): the copy in the hand goes out of view too, not only the row's slot
			await frames(3)
			if not rt.hand_down or hd["node"].visible:
				return "lowered, the plushie still shows in the hand: down %s, visible %s" % [rt.hand_down, hd["node"].visible]
			await press("Q")
			await frames(3)
			if rt.hand_down or not hd["node"].visible:
				return "raised, the plushie should show again: down %s, visible %s" % [rt.hand_down, hd["node"].visible]
			return ""))

	await station("n_kitchen", func():
		await step("6 · Little things: Aoi asks for the kettle (her name by the task); a click switches it on, it boils by itself and ticks, and she walks off and sits", func():
			place(1.5, 7.5, 0)
			var r := await enter_room("door_kitchen", "kitchen")
			if r != "":
				return r
			var t := tasks()
			var req = null
			for x in t:
				if x["id"] == "t6_kettle":
					req = x
			if req == null:
				return JSON.stringify(t)
			if req.get("who") == null or not str(g.hud.named(req["who"])).contains("Aoi"):
				return "the request has no name by it: " + JSON.stringify(req)
			var sw: Dictionary = rt.skin_wet.get("aoi", {})           # the `skin` action: she sweats in the kitchen, on her stand-in's body
			var sm: Array = rt.standin_mats.get("aoi", [])
			if float(sw.get("wet", 0)) != 0.6 or float(sw.get("sweat", 0)) != 0.4 or sm.is_empty() or float(sm[0].get_shader_parameter("wetness")) != 0.6:
				return "her skin: " + JSON.stringify(sw) + " on %d materials" % sm.size()
			var k := await use("kitchen_kettle", 0.7)
			if not str(k.get("label", "")).to_lower().contains("switch on"):
				return "the kettle says " + JSON.stringify(k)
			await game_wait(0.3)
			if state("kitchen_kettle") != "heating":
				return "not heating: " + str(state("kitchen_kettle"))
			await game_wait(2.0)
			var fx: Dictionary = rt.lifefx.report()        # the kettle's effects at its sockets (lifefx.gd): its LED, its digits, steam coming
			var kk: Dictionary = fx.get("kitchen_kettle", {})
			if not (kk.get("led") is float and kk["led"] > 0.5) or not kk.has("steam"):
				return "the kettle's effects: " + JSON.stringify(kk)
			var ck: Dictionary = fx.get("kitchen_clock", {})
			if not ck.has("hands"):
				return "the clock's hands: " + JSON.stringify(ck)
			var hd: Array = rt.lifesound.heard                     # the sounds made from their recipes (lifesound.gd): the switch once, the rumble while it heats
			if hd.filter(func(h): return h["key"] == "kitchen_kettle:switch" and h["what"] == "once").is_empty() or not rt.lifesound.playing().has("kitchen_kettle:kettle"):
				return "the kettle's sounds: " + JSON.stringify(hd.slice(-6)) + " playing " + JSON.stringify(rt.lifesound.playing())
			if not rt.lifesound.playing().has("kitchen_clock:tick"):
				return "the clock doesn't tick: " + JSON.stringify(rt.lifesound.playing())
			if not await until(func(): return rt.state_of("kitchen_kettle") == "boiling", 9000):
				return "boiling: never"
			await game_wait(0.2)
			if not rt.lifesound.playing().has("kitchen_kettle:kettle_boil") or rt.lifesound.playing().has("kitchen_kettle:kettle"):
				return "at the boil the rumble should give way to the roar: " + JSON.stringify(rt.lifesound.playing())
			await game_wait(0.5)
			var boiling: Dictionary = rt.lifefx.report().get("kitchen_kettle", {})
			if not (float(boiling.get("steam", 0)) > 0.5):            # boiling: steam at the spout at full rate
				return "the boiling kettle's steam: " + JSON.stringify(boiling)
			r = await ticked("t6_kettle", "the kettle boiled")
			if r != "":
				return r
			if not await until(func(): return rt.npcs.has("aoi") and rt.npcs["aoi"]["st"].get("arrived") == "kitchen_chair_spot", 9000):
				return "Aoi sat at the table: never"
			return "")
		await step("the cup poured from the boiled kettle (full: ticks), the cigarette put out, the TV (static since the lobby's scene) off, the hob on and the pot simmering, then the phone rings and is answered", func():
			var c := await use("kitchen_mug", 0.6)
			if not str(c.get("label", "")).to_lower().contains("pour"):
				return "the cup says " + JSON.stringify(c)
			var r := await ticked("t6_cup", "the cup full")
			if r != "":
				return r
			var a := await use("kitchen_ashtray", 0.6)
			if not str(a.get("label", "")).to_lower().contains("put it out"):
				return "the ashtray says " + JSON.stringify(a)
			r = await ticked("t6_cig")
			if r != "":
				return r
			if state("kitchen_tv") != "static":
				return "the TV is " + str(state("kitchen_tv"))
			await use("kitchen_tv", 1.0)
			r = await ticked("t6_tv")
			if r != "":
				return r
			await use("kitchen_hob", 0.7)
			r = await ticked("t6_hob", "the pot simmering")
			if r != "":
				return r
			var fx2: Dictionary = rt.lifefx.report()
			var hob: Dictionary = fx2.get("kitchen_hob", {})
			var mug: Dictionary = fx2.get("kitchen_mug", {})
			var ash: Dictionary = fx2.get("kitchen_ashtray", {})
			if not (float(hob.get("glow", 0)) > 0.3) or not (hob.get("digits") is String) or not (float(mug.get("fill", 0)) > 0.5) or not ash.has("burn"):
				return "the hob's glow, the cup's fill, the cigarette: " + JSON.stringify({"hob": hob, "mug": mug, "ashtray": ash})
			if not await until(func(): return rt.state_of("kitchen_phone") == "ringing", 3000):
				return "the phone ringing: never (%s)" % str(rt.state_of("kitchen_phone"))
			var p := await use("kitchen_phone", 0.6)
			if not str(p.get("label", "")).to_lower().contains("answer"):
				return "the phone says " + JSON.stringify(p)
			return await ticked("t6_phone")))

	await station("n_chores", func():
		await step("7 · Chores: the mud needs the mop (Need the mop), the mop taken, held clicks scrub both stains away (they tick, a feat), the back door's latch locks it (ticks)", func():
			place(1.5, 12.5, 0)
			var r := await enter_room("door_chores", "chores")
			if r != "":
				return r
			var bl = rt.things["chores_stain_2"].get("blood")                 # the blood stain wears the splat (HSBlood), the block's mesh hidden
			if bl == null or not (bl.material_override is ShaderMaterial) or bl.material_override.shader != HSBlood.shader() or rt.things["chores_stain_2"]["mesh"].visible:
				return "the blood stain has no splat: " + str(bl)
			var s0 := await go_to("chores_stain", 1.0)
			if s0.get("cursor") != "locked":
				return "the mud without the mop: " + JSON.stringify(s0)
			await use("mop_pickup", 0.7)
			r = await ticked("t7_mop")
			if r != "":
				return r
			for pair in [["chores_stain", 2.0], ["chores_stain_2", 1.5]]:
				if pair[0] == "chores_stain" and (rt.carried() == null or rt.carried().get("item") != "mop"):
					return "the mop isn't in the hand"
				var gt := await go_to(pair[0], 1.0)
				if gt.has("err"):
					return gt["err"]
				rt.use(true)
				await game_wait(float(pair[1]) + 0.6)
				rt.holding = null
			r = await ticked("t7_mud")
			if r != "":
				return r
			r = await ticked("t7_blood")
			if r != "":
				return r
			if not flag("feat_clean"):
				return "the feat's flag"
			await use("back_door:latch", 0.6)
			await game_wait(0.4)
			if not door("back_door")["locked"]:
				return "the back door isn't locked"
			return await ticked("t7_latch")))

	await station("n_rest", func():
		await step("8 · Sitting: the chair sits you (eye at sitting height, ticks) and stands you; the sofa plays a scene, then the name typed is kept and said", func():
			place(1.5, 12.5, 180)
			var r := await enter_room("door_rest", "rest")
			if r != "":
				return r
			var c := await use("rest_chair", 0.7)
			if c.get("cursor") != "sit":
				return "the chair: " + JSON.stringify(c)
			await game_wait(0.9)
			if rt.player.seat == null or abs(float(rt.player.eye) - 1.15) > 0.05:
				return "seated: eye %.2f seat %s" % [rt.player.eye, rt.player.seat]
			r = await ticked("t8_chair")
			if r != "":
				return r
			await click()
			await game_wait(0.9)
			await use("rest_sofa", 0.9)
			if not await playing(false, 1800):
				return "the sofa's scene never took over"
			r = await scene()
			if r != "":
				return r
			if not await until(func(): return g.hud.panel_el != null and g.hud.panel_spec.has("name"), 3000):
				return "the name's box never came"
			g.hud._finish_panel("Riko")
			if not await until(func(): return g.hud.line_text.contains("Riko. She'll write that"), 3000):
				return "the name said: never (%s)" % g.hud.line_text
			if g.run["name"] != "Riko":
				return "the name isn't kept"
			if rt.player.seat != null:
				await click()
			return ""))

	await station("n_games", func():
		await step("9 · Games: the die thrown and its face heard (ticks); chō-han with Aoi played out at the table (ticks), then her question answered (One more: karma +1, ticks)", func():
			place(1.5, 17.5, 180)
			var r := await enter_room("door_games", "games")
			if r != "":
				return r
			var die0: Vector3 = rt.by_id["games_die"]["node"].global_position
			var d := await use("games_die", 1.1)
			if d.get("cursor") != "roll":
				return "the die: " + JSON.stringify(d)
			await frames(3)
			if not rt.physics.rolling("games_die"):
				return "the die isn't rolling (a rigid body thrown)"
			r = await ticked("t9_die", "the die settled")
			if r != "":
				return r
			var die1: Vector3 = rt.by_id["games_die"]["node"].global_position
			if die1.distance_to(die0) < 0.03 or die1.y < 0.05 or die1.y > 1.2:
				return "the die settled at %s from %s" % [die1, die0]
			await use("games_table", 1.0)
			if not await until(func(): return not g.hud.choice_over, 6000):
				return "the game's call never came"
			g.hud.choice_pick(1)
			r = await ticked("t9_game", "the game played")
			if r != "":
				return r
			if not await until(func(): return not g.hud.choice_over, 6000):
				return "her question never came"
			var q: Array = g.hud.choice_options()
			if not str(q[0]).contains("One more"):
				return "her question: " + JSON.stringify(q)
			g.hud.choice_pick(1)
			r = await ticked("t9_ask")
			if r != "":
				return r
			if float(g.run["karma"].get("karma", 0)) != 2:
				return "karma " + str(g.run["karma"])
			return ""))

	await station("n_dark", func():
		await step("10 · The dark: the flashlight into the pocket (ticks), F lights it (ticks), it flickers and dies (F only clicks), the batteries shown and taken bring it back", func():
			place(1.5, 17.5, 0)
			var r := await enter_room("door_dark", "dark")
			if r != "":
				return r
			await use("torch_pickup", 0.6)
			r = await ticked("t10_torch")
			if r != "":
				return r
			await press("F")
			r = await ticked("t10_on")
			if r != "":
				return r
			if not await until(func(): return rt.torch["dead"] and not rt.torch["on"], 6000):
				return "the flashlight dead (its stutter over, out): never " + JSON.stringify(rt.torch_state())
			await press("F")
			await game_wait(0.3)
			if rt.torch["on"]:
				return "a dead flashlight lit"
			await use("batteries_pickup", 0.6)
			r = await ticked("t10_bat")
			if r != "":
				return r
			await game_wait(0.3)
			if rt.torch["dead"]:
				return "still dead"
			return "")
		await step("on the way out the glimpse: a creak, the figure there for a moment and gone; out of the room (ticks)", func():
			var seen := [false]
			place(5.6, 17.5, 180)
			rt.key_event("W", true)
			var c0: float = rt.clock
			var n := 0
			while rt.clock - c0 < 1.2 and n < 3000:
				if rt.by_id["dark_figure"]["node"].visible:
					seen[0] = true
				await process_frame
				n += 1
			rt.key_event("W", false)
			if not await until(func(): if rt.by_id["dark_figure"]["node"].visible: seen[0] = true; return seen[0], 3000):
				return "the figure seen: never"
			if not await until(func(): return not rt.by_id["dark_figure"]["node"].visible, 3000):
				return "the figure gone again: never"
			await walk_through("door_dark", "corridor")
			return await ticked("t10_out")))

	await station("n_library", func():
		await step("11 · Reading and looking: the diary read (ticks); the photo taken up in the hands, put back (ticks); the bookshelf's card (ticks)", func():
			place(1.5, 22.5, 180)
			var r := await enter_room("door_library", "library")
			if r != "":
				return r
			await use("library_diary", 0.6)
			await frames(5)
			if g.hud.panel_el == null:
				return "the diary's card"
			await close_panel()
			r = await ticked("t11_diary")
			if r != "":
				return r
			await use("library_photo", 0.6)
			await frames(5)
			if rt.examining == null:
				return "the photo isn't in the hands"
			rt.key_event("Escape", true)
			if not await until(func(): return rt.examining == null, 3000):
				return "put back: never"
			r = await ticked("t11_photo")
			if r != "":
				return r
			await use("library_shelf", 1.0)
			await frames(5)
			if g.hud.panel_el == null or not str(g.hud.panel_el.find_child("Text", true, false).text).contains("labelled with your name"):
				return "the shelf's card"
			if not rt.things["library_shelf"]["node"].visible or g.hud.cursor_el.visible or g.hud.prompt_el.visible:   # the shelf stays in view under its card, the dot and "Look" don't
				return "the shelf's card: the shelf gone %s, the dot %s, the word %s" % [not rt.things["library_shelf"]["node"].visible, g.hud.cursor_el.visible, g.hud.prompt_el.visible]
			var click := InputEventMouseButton.new()           # a left click puts the card away, like Esc
			click.button_index = MOUSE_BUTTON_LEFT
			click.pressed = true
			rt._input(click)                                          # (the card is a Control under the pointer: play takes the click in _input)
			if not await until(func(): return g.hud.panel_el == null, 3000):
				return "a click didn't close the card"
			if not g.hud.cursor_el.visible:
				return "the dot should be back after the card"
			return await ticked("t11_shelf"))
		await step("the painting looked at two seconds (ticks): the secret, a note slips out (found_painting), and it reads", func():
			var r := await go_to("library_painting", 1.6, true)
			if r.has("err"):
				return r["err"]
			await game_wait(2.6)
			var t := await ticked("t11_paint")
			if t != "":
				return t
			if not flag("found_painting"):
				return "the secret's flag"
			if not rt.by_id["painting_note"]["node"].visible:
				return "the note isn't shown"
			return ""))

	await station("n_bath", func():
		await step("the bath's old leak: water running down its west wall (HSLeak: the wall's band wet, no pools; a drop every couple of seconds)", func():
			var lk = null
			for x in rt.leaks:
				if x["id"] == "bath_leak":
					lk = x
			if lk == null or not (lk["node"] is HSLeak) or lk["walls"].is_empty():
				return "the bath's leak: " + str(lk)
			var mi: MeshInstance3D = lk["walls"][0]
			var mm = mi.material_override
			if not (mm is ShaderMaterial) or mm.shader != HSWet.shader() or not bool(mm.get_shader_parameter("band_on")) or float(mm.get_shader_parameter("puddles")) != 0.0:
				return "the wall under the leak should wear the wet band: " + str(mm)
			if absf(float(mm.get_shader_parameter("band_top")) - 2.85) > 0.01 or absf(float(mm.get_shader_parameter("wetness")) - 0.85) > 0.01 or absf(float(mm.get_shader_parameter("band_half")) - 0.225) > 0.001:
				return "the band's words: top %s wet %s half %s" % [mm.get_shader_parameter("band_top"), mm.get_shader_parameter("wetness"), mm.get_shader_parameter("band_half")]
			var c: Vector3 = mm.get_shader_parameter("band_centre")
			if absf(c.x - (-4.95)) > 0.02 or absf(c.z - (-27.4)) > 0.02:          # on the west wall's face (story x -5, y 27.4)
				return "the band's centre should be on the west wall's face: " + str(c)
			var d0: int = lk["node"].drops
			await game_wait(4.6)
			if lk["node"].drops < d0 + 2:
				return "two drops should have fallen in 4.6 s: %d" % (lk["node"].drops - d0)
			return "")
		await step("12 · Hiding: the tap turned on (running: ticks); in the locker (hidden), the room changes while you're not looking (the towel gone, writing on the mirror: ticks)", func():
			place(1.5, 27.5, 180)
			var r := await enter_room("door_bath", "bath")
			if r != "":
				return r
			var bath_floor = null                                      # the bath's own `wet` 0.8: its floor on the wet shader, no rain's rings, wet steps
			for ch in g.pieces():
				if ch.has_meta("piece") and str(ch.get_meta("piece")).contains("\"bath__floor\""):
					bath_floor = ch.get_node_or_null("mesh")
			if bath_floor == null or not (bath_floor.material_override is ShaderMaterial) or bath_floor.material_override.shader != HSWet.shader() or float(bath_floor.material_override.get_shader_parameter("ripples")) != 0.0 or not rt.wet_rooms.has("bath"):
				return "the bath's floor isn't wet by its own word: " + str(bath_floor) + " wet rooms " + str(rt.wet_rooms)
			var mir = rt.things["bath_mirror"].get("mirror")           # the bath's mirror reflects the room (HSMirror): seen, its camera draws
			if mir == null or not (mir is HSMirror):
				return "the bath's mirror has no reflection: " + str(mir)
			var mp: Vector3 = mir.mi.global_transform * mir.centre
			rt.place(Vector3(mp.x, 0, mp.z + 1.4), 90.0, 0.0)          # in front of it, facing it (yaw 90: the runtime's forward is -z)
			await game_wait(0.3)
			if not mir.active or mir.frames < 3:
				return "the mirror doesn't draw when looked at: active %s, frames %d, last %s, player %s yaw %s" % [mir.active, mir.frames, JSON.stringify(mir.last), rt.player.pos, rt.player.yaw]
			# (headless: no picture to read; LOOKPLUGIN measures the reflection) its camera behind the glass, looking back out, drawing
			var ep: Vector3 = mir.mcam.global_position
			var fwd: Vector3 = -mir.mcam.global_transform.basis.z
			if not (ep.z < mp.z - 0.5 and fwd.z > 0.9 and mir.mcam.near > 0.5 and mir.view.render_target_update_mode == SubViewport.UPDATE_ALWAYS):
				return "the mirror's camera: at %s looking %s, near %.2f, update %d (the glass at %s)" % [ep, fwd, mir.mcam.near, mir.view.render_target_update_mode, mp]
			if not (mir.layer >= 11 and mir.layer <= 19) or (mir.mcam.cull_mask & (1 << (mir.layer - 1))) != 0 or mir.mi.layers != (1 << (mir.layer - 1)):   # its own layer, which its camera doesn't draw (a mirror seen in a mirror, never itself)
				return "the mirror's own layer: %d, its camera's mask %d, its glass's layers %d" % [mir.layer, mir.mcam.cull_mask, mir.mi.layers]
			rt.mirrors_quality(0)                                      # the menu's Reflections Low: the glass dull, no render
			await game_wait(0.1)
			if mir.enabled or mir.active or mir.view.render_target_update_mode != SubViewport.UPDATE_DISABLED:
				return "Reflections Low should switch the mirror off: enabled %s active %s" % [mir.enabled, mir.active]
			rt.mirrors_quality(2)
			await game_wait(0.2)
			if not mir.active:
				return "the mirror should reflect again at Reflections High"
			await use("bath_tap", 0.6)
			r = await ticked("t12_tap")
			if r != "":
				return r
			await use("bath_locker", 0.8)
			if not await until(func(): return rt.player.hiding == "bath_locker", 3000):
				return "in the locker: never"
			if not await until(func(): return not rt.by_id["bath_towel"]["node"].visible and rt.by_id["bath_mirror_text"]["node"].visible, 6000):
				return "the swap: never"
			return await ticked("t12_hide")))

	await station("n_talk", func():
		await step("Aoi in the workshop (a scene, faded in): the timed choice answered (I trust you: karma +2)", func():
			var k0 := float(g.run["karma"].get("karma", 0))
			var r := await scene([1])
			if r != "":
				return r
			var k := float(g.run["karma"].get("karma", 0))
			if k - k0 != 2:
				return "karma %s then %s" % [k0, k]
			return ""))

	await station("n_hide", func():
		await step("14 · Hide and seek (a round): found in the second locker, the death scene for that locker, the retry back to the round (the pocket and the little things kept)", func():
			if not await until(func(): return not g.hud.choice_over, 6000):
				return "the round's card never came"
			g.hud.choice_pick(2)
			if not await until(func(): return not g.hud.choice_over, 3000):
				return "where she found you: never asked"
			g.hud.choice_pick(2)
			var r := await scene()
			if not await until(func(): return g.watch_end == "Found", 6000):
				return "the death: never (%s, %s)" % [str(g.watch_end), r]
			var rr := {"found": g.run["counters"].get("found"), "at": g.run.get("found_at")}
			if float(rr["found"]) != 1 or rr["at"] != "workshop_locker_2":
				return JSON.stringify(rr)
			await close_panel()
			var snap = g.progress["visited"].get("n_hide")
			g.watch_end = null
			g.watch("n_hide", snap)
			if not await until(func(): return not g.hud.choice_over, 6000):
				return "the round's card after the retry: never"
			var kept := {"items": g.run["items"].keys(), "tv": g.run["lives"].at("kitchen_tv", 0.0)["state"]}
			if not kept["items"].has("fuse") or not kept["items"].has("flashlight") or kept["tv"] != "off":
				return "after the retry: " + JSON.stringify(kept)
			g.hud.choice_pick(1)
			return ""))

	await station("n_run", func():
		await step("15 · Run: its timer counting down on the HUD; into the atrium in time (ticks)", func():
			var t1 := float(rt.timer_left)
			await game_wait(1.0)
			var t2 := float(rt.timer_left)
			if not (t1 > 0 and t2 < t1):
				return "the timer %s then %s" % [t1, t2]
			place(1.5, 28.5, 90)
			await hold("W", 2.5)
			return await ticked("t15_run")))

	await station("n_sneak", func():
		await step("16 · Sneak: the jumpscare as you come in; then Aoi walks her route; her eyes fill the meter in the open, never in the safe corner; the far corner reached (ticks)", func():
			var js := [false]
			place(1.5, 30.4, 90)
			rt.key_event("W", true)
			var c0: float = rt.clock
			var n := 0
			while rt.clock - c0 < 0.8 and n < 3000:
				if rt.by_id["atr_figure"]["node"].visible:
					js[0] = true
				await process_frame
				n += 1
			rt.key_event("W", false)
			if not await until(func(): if rt.by_id["atr_figure"]["node"].visible: js[0] = true; return js[0], 3000):
				return "the jumpscare: never"
			if not await until(func(): return rt.npcs.has("aoi") and rt.npcs["aoi"]["as"] == "path", 3000):
				return "Aoi on her route: never"
			place(-3.8, 31.2, 45)
			await game_wait(2.5)
			if rt.suspicion > 0.05:
				return "seen in the safe corner"
			if not await until(func(): var p = rt.npcs["aoi"]["pos"]; return p != null and p.x > -1 and p.x < 3, 6000):
				return "Aoi mid-route: never"
			var np: Dictionary = rt.npcs["aoi"]
			var a := deg_to_rad(float(np["yaw"]))
			rt.place(Vector3(np["pos"].x + cos(a) * 2.5, 0, np["pos"].z - sin(a) * 2.5), float(np["yaw"]) + 180.0, 0.0)
			await game_wait(0.45)
			var k: float = rt.suspicion
			if not (k > 0.15):
				return "in the open in front of her, the meter at %.2f" % k
			place(-3.8, 31.2, 45)
			await game_wait(2.0)
			if rt.suspicion > 0.05:
				return "the meter didn't drain in the safe corner"
			place(6.5, 33.6, 90)
			await hold("W", 0.6)
			return await ticked("t16_cross")))

	await station("n_sleep", func():
		await step("17 · Night: back to the rest room's bed, it sleeps you (the chapter card Night 2 · 23:40, the time now night), you wake and it ticks; the lobby's clock stopped", func():
			place(1.5, 12.5, 180)
			var r := await enter_room("door_rest", "rest")
			if r != "":
				return r
			await use("rest_bed", 0.9)
			if not await until(func(): return g.hud.chapter_up, 9000):
				return "the chapter card never came"
			var card := [g.hud.chapter_t.text, g.hud.chapter_s.text]
			if card[0] != "Night 2" or card[1] != "23:40":
				return "the card " + JSON.stringify(card)
			if not await until(func(): return rt.player.sleeping == null and not g.hud.chapter_up, 9000):
				return "awake: never"
			r = await ticked("t17_sleep")
			if r != "":
				return r
			var rr := {"time": g.run["time"], "clock": rt.state_of("lobby_clock")}
			if rr["time"] != "night" or rr["clock"] != "stopped":
				return JSON.stringify(rr)
			var ca2 = g.camera.attributes                                  # at night the iris holds a stop under (its scale halved)
			if not (ca2 is CameraAttributesPractical) or absf(ca2.auto_exposure_scale - 0.2) > 0.01:
				return "the iris should be a stop under at night: " + str(ca2.auto_exposure_scale if ca2 != null else null)
			return ""))

	await station("n_night", func():
		await step("Aoi at the door at night (a scene): her name now Aoi (a word); a line kept by the chores done, one left out; the answer for the painting offered, the one for skipped chores not; an hour and a half skipped (the kitchen clock jumps on)", func():
			if not await until(func(): return not g.hud.choice_over, 6000):
				return "her question never came"
			var tl: Dictionary = g.story.timeline(g.story.version(g.story.scenes["s_night"]), {}, g.run["flags"], g.run["counters"])
			var lines: Array = []
			for s in tl["segs"]:
				if s["type"] == "clip" and not s.has("answer"):
					lines.append(s["clip"]["id"])
			var q := {"who": g.hud.who_el.text, "opts": g.hud.choice_options(), "lines": lines}
			if q["who"] != "Aoi" or "|".join(q["opts"]) != "Ready.|I saw the painting." or ",".join(q["lines"]) != "c1,c2,c4":
				return JSON.stringify(q)
			var s = g.run["lives"].at("kitchen_clock", float(g.run["secs"]))
			var ran: float = float(s["spent"].get("running", 0)) if s != null and s.has("spent") else 0.0
			if not (ran > 5400 and ran < 5400 + 3600):
				return "the kitchen clock after the skip ran %.0f s (an hour and a half skipped)" % ran
			g.hud.choice_pick(2)
			var r2 := await scene()
			if r2 != "":
				return r2
			if g.bake != null:   # the answer's branch played from its own recording, no frame held
				var bs: Dictionary = g.scene_player.bake_stats
				if bs.get("recording", "") != "c4=painting" or int(bs.get("held", 0)) > 0 or float(bs.get("mismatch", 9)) > 0.05:
					return "the bake's branch: " + JSON.stringify(bs)
			return ""))

	await station("n_annex", func():
		await step("18 · The annex (another level): dark, a checkpoint; the note read (ticks); the fusebox says it needs the fuse, takes it (gone from the pocket), and the power comes on (ticks)", func():
			if not await until(func(): return rt.level == "annex" and not rt.powered(), 1800):
				return "the annex, dark: never"
			if g.look_now != "plain" or g.get_node("Env").environment.ssr_enabled:   # the annex's own look is plain (STORY_FORMAT §2): the effects off there
				return "the annex's look: %s, ssr %s" % [g.look_now, g.get_node("Env").environment.ssr_enabled]
			await use("annex_note", 0.6)
			await frames(5)
			if g.hud.panel_el == null:
				return "the note's card"
			await close_panel()
			var r := await ticked("t18_note")
			if r != "":
				return r
			var f := await go_to("fusebox", 0.8)
			if not str(f.get("label", "")).to_lower().begins_with("use: fuse"):
				return "the fusebox says " + JSON.stringify(f)
			await click()
			await game_wait(0.4)
			r = await ticked("t18_fuse")
			if r != "":
				return r
			if not rt.powered() or rt.items.has("fuse"):
				return JSON.stringify({"powered": rt.powered(), "fuse": rt.items.has("fuse")})
			return ""))

	await station("n_final", func():
		await step("the end by act (leave by the door), the secret's scene (found_painting), and karma 4: Passed, its title card's words with the name typed", func():
			await enter_room("exit_door", "annex_out")
			var r := await scene()
			if not await until(func(): return g.watch_end != null, 6000):
				return "an ending: never (%s)" % r
			var e := {"end": g.watch_end, "trail": (g.run["trail"] as Array).slice(-4), "karma": g.run["karma"].get("karma")}
			if e["end"] != "Passed" or not e["trail"].has("n_egg"):
				return JSON.stringify(e)
			var who: String = "Riko" if from_i <= ORDER.find("n_rest") else str(g.run["name"])
			if g.ending_words != "Every room passed, %s. The report goes in tomorrow." % who:
				return "the title card's words: " + JSON.stringify(g.ending_words)
			return ""))

	await step("the doll's trigger cutscene: taken in the library, the flow jumps to her scene and the bad ending", func():
		await close_panel()
		g.watch_end = null
		g.watch("n_library", snap_for("n_library"))
		var r := await at_node("n_library")
		if r != "":
			return r
		place(1.5, 22.5, 180)
		r = await enter_room("door_library", "library")
		if r != "":
			return r
		await use("doll_pickup", 0.6)
		r = await scene()
		if not await until(func(): return g.watch_end != null, 6000):
			return "the ending: never (%s)" % r
		if g.watch_end != "She wanted her back":
			return "ending " + str(g.watch_end)
		return "")
	if fails > 0:
		return
	print("GDTESTROOM ok (%.1f min)" % ((Time.get_ticks_msec() - t_start) / 60000.0))
	quit(0)
