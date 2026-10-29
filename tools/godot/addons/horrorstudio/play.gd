## Play mode (the desk's play/runtime.js, ported): walk the level from the player's eye, use what's there, and run a
## stitch's beats from what the player does. The runtime owns the player (feet, look, eye height), the collision with
## the level's solid blocks (its own, as the desk's: an upright circle against boxes, stepping onto low ones, so the
## two agree), the trigger volumes, doors, lights and the power, the cursor, the inventory, the cast's behaviours,
## being seen, the little things' states, the to-do list, and the stitch and the act choice that listen to it all.
extends Node

signal stitch_ended(result)
signal choice_made(option)

const StoryC := preload("res://addons/horrorstudio/story.gd")
const ConditionsC := preload("res://addons/horrorstudio/conditions.gd")
const ActionsC := preload("res://addons/horrorstudio/actions.gd")
const InteractablesC := preload("res://addons/horrorstudio/interactables.gd")
const BehavioursC := preload("res://addons/horrorstudio/behaviours.gd")
const TodoC := preload("res://addons/horrorstudio/todo.gd")
const LifeC := preload("res://addons/horrorstudio/life.gd")

const ABILITIES := ["look", "walk", "crouch", "steps"]
const LIT := 2.2
const USE_RANGE := 2.2
const LOOK_RANGE := 30.0
const DOOR_SECS := 0.6
const SLAM_SECS := 0.15
const DROP_AHEAD := 0.55
const SIGHT := {"angle": 90.0, "range": 9.0, "crouched": 0.55, "meter": 1.2, "drain": 1.5, "calm": 3.0}
const LENS := {"z": 1.52, "r": 0.011, "hit": 0.06, "fov": 118.0}
const ABILITY_SETTINGS := {
	"look": {"sens": 0.12, "pitch": 80.0},
	"walk": {"speed": 1.4, "run": 2.8, "crouched": 0.7, "radius": 0.25, "step": 0.35},
	"crouch": {"mode": "toggle", "key": "C", "ease": 8.0},
	"steps": {"stride": 0.7, "run": 1.05, "crouch": 0.45, "db": -8, "runDb": -4, "crouchDb": -17, "creak": 0.08, "castStride": 0.65, "castDb": -2},
	"torch": {"key": "F", "cone": 26.0, "spill": 62.0, "range": 18.0, "strength": 7.5, "kelvin": 5200.0, "lag": 0.09, "hand": [0.2, -0.2, -0.05]},
}
const FLOOR_STEPS := {"wood": "step_wood", "stone": "step_concrete", "tile": "step_concrete", "carpet": "step_carpet",
	"dirt": "step_carpet", "metal": "step_concrete", "water": "step_wet"}
const STEP_COUNT := {"step_wood": 5, "step_concrete": 5, "step_carpet": 5, "step_wet": 3, "step_creaky": 4}

var game                       # the Game node: story, world, camera, hud, levels
var story
var hud
var conditions := ConditionsC.new()
var actions := ActionsC.new()
var interactables := InteractablesC.new()
var run = null                 # the Watch's run: flags, karma, counters, items, todo, name, lives...
var flags: Dictionary = {}     # a set
var items: Dictionary = {}     # a set
var settings: Dictionary = {}
var player := {"pos": Vector3.ZERO, "yaw": 0.0, "pitch": 0.0, "eye": 1.65, "crouched": false, "seat": null, "hiding": null,
	"sleeping": null, "peeping": null, "limit": null, "stood": null, "running": false, "speed": 0.0}
var keys: Dictionary = {}
var ended: Dictionary = {}
var clock: float = 0.0
var clock0: float = 0.0
var inside: Dictionary = {}
var doors: Dictionary = {}
var waits: Array = []
var anims: Array = []
var npcs: Dictionary = {}
var lives = null
var lives_seen: int = 0
var suspicion: float = 0.0
var calm: float = 0.0
var last_caught = null
var look := {"id": null, "t": 0.0, "dist": INF}
var target = null
var busy: bool = false
var active: bool = false
var held: bool = false
var stopped: bool = false
var level: String = ""
var by_id: Dictionary = {}
var things: Dictionary = {}    # spots and placed things by id (the plan's things): {node, piece}
var solid: Array = []
var triggers: Array = []
var lenses: Array = []
var latches: Array = []
var kept: Dictionary = {}
var lights: Array = []
var cast_nodes: Dictionary = {}
var listener: Callable = Callable()
var has_end: bool = false
var next_node = null
var timer_left = null
var timer_fail = null
var stitch_title = null
var moving = null
var look_tween = null
var holding = null
var scrubbing: float = -9.0
var last_scrub: float = -9.0
var examining = null
var playing = null
var in_chapter: bool = false
var inv: Array = []
var inv_at: int = -1
var inv_shown: bool = true
var torch := {"on": false, "dead": false, "flick": 0.0, "dying": false, "dir": null, "made": false}
var torch_hot: SpotLight3D = null
var torch_spill: SpotLight3D = null
var step_at: float = 0.5
var step_from = null
var step_clock: float = -9.0
var last_step: Dictionary = {}
var step_count: int = 0
var cast_walk: Dictionary = {}
var cast_step: Dictionary = {}
var sounds_heard: Array = []
var audio_log: Array = []            # every shelf sound played: {n, loaded, at}
var sfx_streams: Dictionary = {}     # name -> AudioStream, loaded once
var sfx_players: Array = []          # a pool of AudioStreamPlayer3D / AudioStreamPlayer under the world
const LifeFxC := preload("res://addons/horrorstudio/lifefx.gd")
const LifeSoundC := preload("res://addons/horrorstudio/lifesound.gd")
const PhysC := preload("res://addons/horrorstudio/physics.gd")
var physics = null                   # physics.gd: the thing in the hand, the dice
var lifefx = null                    # the little things' effects (lifefx.gd), on this level
var lifesound = null                 # the little things' sounds (lifesound.gd), made from their recipes, placed
var scene_light_k: Dictionary = {}
var baked_cast: Dictionary = {}      # cast ids whose baked body is showing (their stand-ins hidden)   # a scene's recorded flicker: a multiplier a light while the bake plays
var todo_log: Array = []
var light_state: Dictionary = {}
var rolls: Dictionary = {}
var since: float = 0.0
var todo
var mouse_captured: bool = false
var play_scene: Callable = Callable()
var on_set_time: Callable = Callable()
var on_quit: Callable = Callable()
var on_beat: Callable = Callable()
var on_flag: Callable = Callable()


func setup(game_, run_, opts: Dictionary = {}) -> void:
	game = game_
	story = game.story
	hud = game.hud
	run = run_
	if run != null:
		flags = run["flags"]
	settings = opts.get("settings", {})
	lives = run["lives"] if (run != null and run.has("lives")) else opts.get("lives", null)
	lives_seen = lives.changes.size() if lives != null else 0
	play_scene = opts.get("play_scene", Callable())
	on_set_time = opts.get("set_time", Callable())
	on_quit = opts.get("quit", Callable())
	todo = TodoC.new(self)
	hud.locked(false)
	if run != null:
		for i in run.get("items", {}):
			items[i] = true


func stop() -> void:
	active = false
	listener = Callable()
	stopped = true
	for w in waits:
		w["done"] = true
	waits = []
	for a in anims:
		a["done"] = true
	anims = []


func setting(name: String) -> Dictionary:
	var s: Dictionary = ABILITY_SETTINGS.get(name, {}).duplicate()
	if s.is_empty():
		s = interactables.settings(name, self)
	elif settings.has(name):
		for k in settings[name]:
			s[k] = settings[name][k]
	return s


func counters() -> Dictionary:
	return run["counters"] if run != null else {}


func carried() -> Variant:
	return inv[inv_at] if (inv_at >= 0 and inv_at < inv.size()) else null


# ---- input ---------------------------------------------------------------------------------------------------
func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventMouseMotion and mouse_captured and active and not busy:
		ability_look(ev.relative.x, ev.relative.y)
	elif ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_LEFT:
			if not mouse_captured and active and not busy:
				capture_mouse(true)
			elif active and not busy and playing == null:
				use(true)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN and active and not busy:
			inv_scroll(1)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_UP and active and not busy:
			inv_scroll(-1)
	elif ev is InputEventMouseButton and not ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT and holding != null:
		holding = null
		hud.progress(null)
	elif ev is InputEventKey:
		key_event(OS.get_keycode_string(ev.physical_keycode), ev.pressed, ev.echo)


func capture_mouse(on: bool) -> void:
	mouse_captured = on
	if DisplayServer.get_name() != "headless":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if on else Input.MOUSE_MODE_VISIBLE
	hud.locked(on)


## a key by its name (W, A, S, D, E, G, C, F, Shift, Space, Escape, Enter, digits...)
func key_event(code: String, down: bool, repeat: bool = false) -> void:
	if hud.panel_el != null:
		if down:
			hud.panel_key(code)
		return
	if down and not hud.choice_over:
		hud.choice_key(code)
		return
	if examining != null and down and (code == "Escape" or code == "E"):
		hud._finish_panel(true)
		return
	if held and hud.menu != null and hud.menu.up:
		if down:
			hud.menu.key(code)
		return
	if not active or busy:
		return
	if down and code == "Escape":
		if clock - since > 0.4:
			pause()
		return
	if down and player.peeping != null and ["W", "A", "S", "D", "Up", "Down", "Left", "Right"].has(code):
		unpeep()
		return
	if playing != null:
		return
	keys[code] = down
	if down and not repeat and code == setting("torch")["key"]:
		torch_switch()
	if down and not repeat and code == "E":
		inv_toggle()
	if down and not repeat and code == "G":
		drop()
	if player.hiding == null and down and not repeat:
		var cs := setting("crouch")
		if code == cs["key"]:
			if cs["mode"] == "hold":
				player.crouched = true
			else:
				player.crouched = not player.crouched
	if player.hiding == null and not down and code == setting("crouch")["key"] and setting("crouch")["mode"] == "hold":
		player.crouched = false


func ability_look(dx: float, dy: float) -> void:
	var s := setting("look")
	var p := player
	p.yaw -= dx * float(s["sens"])
	var pm := float(s["pitch"])
	if p.limit != null:
		var d := fposmod(float(p.yaw) - float(p.limit["yaw"]) + 180.0, 360.0) - 180.0
		p.yaw = float(p.limit["yaw"]) + clamp(d, -float(p.limit["dy"]), float(p.limit["dy"]))
		pm = min(pm, float(p.limit["dp"]))
	p.pitch = clamp(float(p.pitch) - dy * float(s["sens"]), -pm, pm)


func ability_walk(dt: float) -> void:
	var s := setting("walk")
	var k := keys
	var f := (1 if (k.get("W", false) or k.get("Up", false)) else 0) - (1 if (k.get("S", false) or k.get("Down", false)) else 0)
	var r := (1 if (k.get("D", false) or k.get("Right", false)) else 0) - (1 if (k.get("A", false) or k.get("Left", false)) else 0)
	player.running = not player.crouched and bool(k.get("Shift", false)) and f > 0
	if f == 0 and r == 0:
		return
	var a := deg_to_rad(float(player.yaw))
	var ln := sqrt(float(f * f + r * r))
	var v := float(s["crouched"] if player.crouched else (s["run"] if player.running else s["speed"])) * dt / ln
	move((cos(a) * f + sin(a) * r) * v, (-sin(a) * f + cos(a) * r) * v, s)


func ability_crouch(dt: float) -> void:
	var want: float = StoryC.EYES["crouch"] if player.crouched else StoryC.EYES["stand"]
	player.eye = float(player.eye) + (want - float(player.eye)) * min(1.0, dt * float(setting("crouch")["ease"]))


# ---- the level -----------------------------------------------------------------------------------------------
## what play changed (doors, things shown or taken) is kept per level and put back
func enter_level(lid: String) -> void:
	if level == lid and game.level != null and game.level_id == lid:
		return
	stop_sfx()                                 # the old level's loops end with it
	sfx_players = []
	var first := not kept.has(lid)
	if first or game.level_id != lid:
		game.enter_level(lid, first)
	level = lid
	by_id = {}
	things = {}
	doors = {}
	solid = []
	lights = []
	cast_nodes = {}
	light_state = {}
	lenses = []
	latches = []
	if not kept.has(lid):
		kept[lid] = {"vis": {}, "doors": {}, "bodies": {}}
	var k: Dictionary = kept[lid]
	for n in game.level.get_children():
		if n.has_meta("piece"):
			var p = JSON.parse_string(n.get_meta("piece"))
			if not (p is Dictionary):
				continue
			var tags: Array = p.get("tags", [])
			var t := {"id": p["id"], "node": n, "piece": p, "kind": p.get("kind"), "tags": tags, "size": p.get("size", [0, 0, 0]), "shape": p.get("shape"),
				"use": _tag(tags, "use:"), "hidden": tags.has("hidden"), "hollow": tags.has("hollow"), "base": n.transform, "room": p.get("room"),
				"attach": _tag(tags, "attach:"), "door_part": _tag(tags, "door_part:")}
			by_id[p["id"]] = t
			things[p["id"]] = t
			if ["wall", "floor", "ceiling", "door", "mesh"].has(t["kind"]):
				var mesh = n.find_child("mesh", false, false)
				t["mesh"] = mesh
				if not t["hollow"] and not t["hidden"] and t["use"] != "clean":
					solid.append(t)
			if t["kind"] == "light":
				lights.append(t)
				var lm = JSON.parse_string(n.get_meta("light")) if n.has_meta("light") else {}
				light_state[p["id"]] = {"on": bool(lm.get("on", true)), "flicker": float(lm.get("flicker", 0)), "base": float(lm.get("base", LIT)), "dim": null, "surge": null, "flicker0": null, "kind": lm.get("kind", "bulb"), "room": lm.get("room")}
			if t["kind"] == "trigger" and n.has_meta("trigger"):
				t["trigger"] = JSON.parse_string(n.get_meta("trigger"))
			if t["kind"] == "person" and _tag(tags, "cast:") != null and tags.has("standin"):
				cast_nodes[_tag(tags, "cast:")] = n
			if t["kind"] == "door":
				var sw = p.get("swing", {})
				var by = _tag(tags, "locked_by:")
				var d: Dictionary = k["doors"].get(p["id"], {"open": false, "locked": by != null, "by": by, "deg": 0.0, "from": 0.0, "to": 0.0, "t": 1.0, "secs": DOOR_SECS, "latched": false})
				k["doors"][p["id"]] = d
				doors[p["id"]] = d
				d["t"] = 1.0
				d["deg"] = d["to"]
				t["swing"] = sw
				if float(d["deg"]) != 0.0:
					swing_door(t, float(d["deg"]))
	triggers = []
	for id in by_id:
		var t: Dictionary = by_id[id]
		if t["kind"] == "trigger" and t.has("trigger"):
			var tr: Dictionary = t["trigger"]
			triggers.append({"id": tr["id"], "safe": bool(tr.get("safe", false)), "min": tr["min"], "max": tr["max"]})
	# a door with a peephole: its lens on both faces; a door with a latch: its thumb turn on the room's side
	for id in doors.keys():
		var t: Dictionary = by_id[id]
		var d: Dictionary = t["piece"].get("d", {})
		var pk = d.get("peephole")
		if pk != null and not (pk is bool and pk == false):
			var z := float(pk) if (pk is float or pk is int) else LENS["z"]
			for side in [1, -1]:
				var l := _attach_disc(t, Vector3(0.0, -float(t["size"][2]) / 2.0 + z, side * (float(t["size"][1]) / 2.0 + 0.006)), side, "%s:peephole:%s" % [id, "a" if side > 0 else "b"], "peephole")
				lenses.append(l)
		if d.get("latch"):
			var side := latch_side(t)
			var sw: Dictionary = t.get("swing", {})
			var w := float(t["size"][0])
			var hinge_x := float(sw["pivot"][0]) if sw.has("pivot") else -w / 2.0
			var x: float = (1.0 if hinge_x <= 0 else -1.0) * max(0.0, w / 2.0 - 0.09)
			var hz = sw.get("handle_z")
			var z := float(hz) + 0.16 if (hz != null and float(hz) > 0.6 and float(hz) < 1.4) else 1.12
			var l := _attach_disc(t, Vector3(x, -float(t["size"][2]) / 2.0 + z, side * (float(t["size"][1]) / 2.0 + 0.006)), side, "%s:latch" % id, "latch")
			latches.append(l)
	for id in k["vis"]:
		set_visible(id, k["vis"][id], true)
	for cid in cast_nodes:
		cast_nodes[cid].visible = false
	for id in k.get("brought", {}):
		pass
	for id in k["bodies"]:
		if by_id.has(id):
			by_id[id]["node"].global_transform = k["bodies"][id]

	lifefx = LifeFxC.new(self, game.kit_index)   # the little things' effects, on this level's things
	lifefx.attach()
	if lifesound != null:
		lifesound.stop()
	else:
		lifesound = LifeSoundC.new(self)
	panes = []
	weather_attach()
	blood_attach()
	standin_bodies()
	if physics != null:
		physics.clear()
	physics = PhysC.new(self)

func _tag(tags: Array, pre: String):
	for t in tags:
		if str(t).begins_with(pre):
			return str(t).substr(pre.length())
	return null


## a small clear disc riding a door's leaf (a peephole's lens, a latch's thumb turn): a thing of its own for the reticle
func _attach_disc(door: Dictionary, local: Vector3, side: int, id: String, use: String) -> Dictionary:
	var n := Node3D.new()
	n.name = id.replace(":", "_")
	game.level.add_child(n)
	var t := {"id": id, "node": n, "piece": {"id": id, "kind": "mesh", "d": {"name": use}, "tags": [], "size": [0.12, 0.12, 0.004], "shape": "box"}, "kind": "mesh",
		"tags": [], "size": [0.12, 0.12, 0.004], "shape": "box", "use": use, "hidden": false, "hollow": false, "door": door["id"], "local": local, "side": side, "disc": true}
	by_id[id] = t
	follow_leaf(t)
	return t


func follow_leaf(t: Dictionary) -> void:
	var door: Dictionary = by_id[t["door"]]
	var dn: Node3D = door["node"]
	var tf := Transform3D(Basis(Vector3(1, 0, 0), float(t["side"]) * PI / 2.0), t["local"])
	t["node"].global_transform = dn.global_transform * tf


func place_at(lid: String, spot) -> void:
	player.seat = null
	leave_hiding()
	unpeep()
	enter_level(lid)
	var t = things.get(spot)
	if t != null:
		place(Vector3(t["node"].global_position.x, 0.0, t["node"].global_position.z), float(t["piece"].get("yaw", 0)), 0.0)


## carry on from where a scene left the eye: no cut back to a spot
func place_from_camera(lid: String, cam_t: Transform3D) -> void:
	unpeep()
	var p := player
	var f := -cam_t.basis.z
	var stay: bool = (p.seat != null or p.hiding != null) and cam_t.origin.distance_to(eye_pos()) < 0.4
	if not stay:
		p.seat = null
		leave_hiding()
	enter_level(lid)
	if stay:
		p.yaw = rad_to_deg(atan2(-f.z, f.x))
		return
	place(Vector3(cam_t.origin.x, max(0.0, cam_t.origin.y - StoryC.EYES["stand"]), cam_t.origin.z), rad_to_deg(atan2(-f.z, f.x)), rad_to_deg(asin(clamp(f.y, -1.0, 1.0))))


func place(feet: Vector3, yaw: float, pitch: float) -> void:
	player.pos = feet
	player.yaw = yaw
	player.pitch = pitch
	player.pos.y = ground_at(player.pos, 0.5)
	inside = {}
	for t in triggers:
		if is_in(t):
			inside[t["id"]] = true


# ---- collision: the player is an upright circle against every solid block, stepping onto low ones ------------
func blocks() -> Array:
	var out: Array = []
	for t in solid:
		if t["node"].visible and t["use"] != "carry":
			out.append(t)
	return out


func extent(t: Dictionary) -> Dictionary:
	var s: Array = t["size"]
	var cy: float = t["node"].global_position.y
	if t["shape"] == "cyl" or t["shape"] == "sphere":
		return {"r": float(s[0]) / 2.0, "hy": float(s[2]) / 2.0, "cy": cy}
	return {"hx": float(s[0]) / 2.0, "hy": float(s[2]) / 2.0, "hz": float(s[1]) / 2.0, "cy": cy}


func move(dx: float, dz: float, s: Dictionary) -> void:
	player.pos.x += dx
	player.pos.z += dz
	for i in 3:
		push_out(s)
	var g := ground_at(player.pos, float(s["step"]))
	if g > -INF:
		player.pos.y = g


func push_out(s: Dictionary) -> void:
	var p := player
	var r := float(s["radius"])
	var feet: float = p.pos.y
	var head: float = feet + float(p.eye) + 0.1
	for t in blocks():
		var e := extent(t)
		if float(e["cy"]) + float(e["hy"]) <= feet + float(s["step"]) or float(e["cy"]) - float(e["hy"]) >= head:
			continue
		var inv_t: Transform3D = t["node"].global_transform.affine_inverse()
		var L: Vector3 = inv_t * p.pos
		var px := 0.0
		var pz := 0.0
		if e.has("r"):
			var d := sqrt(L.x * L.x + L.z * L.z)
			if d >= float(e["r"]) + r:
				continue
			var k := (float(e["r"]) + r - d) / d if d > 1e-6 else 0.0
			px = L.x * k
			pz = L.z * k if d > 1e-6 else float(e["r"]) + r
		else:
			var cx: float = clamp(L.x, -float(e["hx"]), float(e["hx"]))
			var cz: float = clamp(L.z, -float(e["hz"]), float(e["hz"]))
			var ox := L.x - cx
			var oz := L.z - cz
			var d := sqrt(ox * ox + oz * oz)
			if d >= r:
				continue
			if d > 1e-6:
				px = ox / d * (r - d)
				pz = oz / d * (r - d)
			else:
				var fx: float = float(e["hx"]) - abs(L.x)
				var fz: float = float(e["hz"]) - abs(L.z)
				if fx < fz:
					px = (sign(L.x) if L.x != 0 else 1.0) * (fx + r)
				else:
					pz = (sign(L.z) if L.z != 0 else 1.0) * (fz + r)
		var W: Vector3 = t["node"].global_transform * Vector3(L.x + px, L.y, L.z + pz)
		p.pos.x = W.x
		p.pos.z = W.z


func ground_at(pos: Vector3, step: float) -> float:
	var best := -INF
	for t in blocks():
		var e := extent(t)
		var top := float(e["cy"]) + float(e["hy"])
		if top > pos.y + step:
			continue
		var L: Vector3 = t["node"].global_transform.affine_inverse() * pos
		var ins: bool = (sqrt(L.x * L.x + L.z * L.z) <= float(e["r"])) if e.has("r") else (abs(L.x) <= float(e["hx"]) and abs(L.z) <= float(e["hz"]))
		if ins and top > best:
			best = top
	return best if best > -INF else pos.y


func floor_under(p = null) -> String:
	var pos: Vector3 = player.pos if p == null else p
	var best = null
	var top := -INF
	for t in solid:
		if t["kind"] != "floor":
			continue
		var e := extent(t)
		if e.has("r"):
			continue
		var tt := float(e["cy"]) + float(e["hy"])
		if tt > pos.y + 0.05 or tt <= top:
			continue
		var L: Vector3 = t["node"].global_transform.affine_inverse() * pos
		if abs(L.x) <= float(e["hx"]) and abs(L.z) <= float(e["hz"]):
			best = t
			top = tt
	if best == null:
		return "wood"
	var f = _tag(best["tags"], "floor:")
	return f if f != null else "wood"


func is_in(t: Dictionary) -> bool:
	var p: Vector3 = player.pos
	return point_in(t, p.x, -p.z, p.y + 0.5)


func point_in(t: Dictionary, x: float, y: float, z: float) -> bool:
	var mn: Array = t["min"]
	var mx: Array = t["max"]
	return x >= mn[0] and x <= mx[0] and y >= mn[1] and y <= mx[1] and z >= mn[2] and z <= mx[2]


# ---- what the story's parts call ----------------------------------------------------------------------------
func emit(ev: Dictionary) -> void:
	if ev.get("type") == "todo":
		todo_log.append("%s:%s" % [ev.get("id"), ev.get("state")])
	if listener.is_valid():
		listener.call(ev)
	if todo != null:
		todo.event(ev)


func set_flag(f) -> void:
	if f == null:
		return
	flags[f] = true
	emit({"type": "flag", "id": f})
	if on_flag.is_valid():
		on_flag.call(f)


func give(item) -> void:
	items[item] = true
	if run != null:
		run["items"][item] = true
	hud.log("got: %s" % story.item_name(item))


func take_item(item) -> void:
	items.erase(item)
	if run != null:
		run["items"].erase(item)
	for e in inv.duplicate():
		if e.get("item") == item:
			inv_remove(e["id"])


func name_of(t: Dictionary) -> String:
	var d: Dictionary = t["piece"].get("d", {}) if t["piece"].get("d") is Dictionary else {}
	if d.has("name"):
		return str(d["name"])
	var tag = _tag(t["tags"], "tag:")
	if tag != null:
		return str(tag).replace("_", " ")
	return str(t["id"]).replace("_", " ")


func title_of(t: Dictionary) -> Variant:
	var d: Dictionary = t["piece"].get("d", {}) if t["piece"].get("d") is Dictionary else {}
	if d.has("item"):
		return story.item_name(d["item"])
	if d.has("note"):
		return story.notes.get(str(d["note"]), {}).get("title", null)
	if t["use"] == "game" and d.has("game"):
		return str(d["game"]).replace("_", " ")
	return d.get("name", null)


func sound(id, at) -> void:
	var s: Dictionary = story.sounds.get(str(id), {})
	var f := str(s.get("file", ""))
	var n := f.substr(4) if f.begins_with("sfx/") else ""
	hud.log("♪ %s%s%s" % [id, (" at " + str(at)) if at != null else "", "" if n != "" else " (the game's own file)"])
	if n != "":
		shelf_sound(n, at)


func shelf_sound(name: String, at = null, db: float = 0.0, floor_ = null) -> void:
	if not active:
		return
	sounds_heard.append({"n": name, "at": at, "db": db, "clock": clock, "floor": floor_})
	if sounds_heard.size() > 400:
		sounds_heard.pop_front()
	play_sfx(name, at, db)


## where a sound is placed: a thing (its node), a cast member (her stand-in, else her behaviour's spot), a point
func sound_pos(at) -> Variant:
	if at is Vector3:
		return at
	if at == null:
		return null
	var t = by_id.get(at)
	if t != null:
		return t["node"].global_position
	if cast_nodes.has(at):
		return cast_nodes[at].global_position
	var n = npcs.get(at)
	if n != null and n["pos"] != null:
		return n["pos"]
	return null


## a sound off the shelf (game/sfx/, docs/SFX.md): placed in the room when it has a place (quieter across it, from its
## side), else on the player; looping ones loop as the shelf says. Headless, the stream still loads: audio_log says
func play_sfx(name: String, at = null, db: float = 0.0) -> void:
	var s: Dictionary = game.sfx_index.get(name, {})
	var st: AudioStream = sfx_stream(name, str(s.get("file", "")))
	var pos = sound_pos(at)
	audio_log.append({"n": name, "loaded": st != null, "at": pos})
	if audio_log.size() > 200:
		audio_log.pop_front()
	if st == null:
		return
	var p = null
	for q in sfx_players:
		if is_instance_valid(q) and not q.playing and ((q is AudioStreamPlayer3D) == (pos != null)):
			p = q
			break
	if p == null:
		if sfx_players.size() >= 24:
			return
		p = AudioStreamPlayer3D.new() if pos != null else AudioStreamPlayer.new()
		if p is AudioStreamPlayer3D:
			p.unit_size = 1.0
			p.max_distance = 30.0
			p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		game.world.add_child(p)
		sfx_players.append(p)
	p.stream = st
	p.volume_db = db
	if p is AudioStreamPlayer3D:
		p.global_position = pos
	if "loop" in st:
		st.loop = bool(s.get("loop", false))
	p.play()


func sfx_stream(name: String, file: String) -> AudioStream:
	if sfx_streams.has(name):
		return sfx_streams[name]
	var st: AudioStream = null
	if file != "":
		var path := "res://game/sfx/" + file
		if ResourceLoader.exists(path):
			st = load(path)
		elif FileAccess.file_exists(path):
			if file.ends_with(".ogg"):
				st = AudioStreamOggVorbis.load_from_file(path)
			elif file.ends_with(".wav"):
				st = AudioStreamWAV.load_from_file(path)
			elif file.ends_with(".mp3"):
				st = AudioStreamMP3.load_from_file(path)
	sfx_streams[name] = st
	return st


func stop_sfx() -> void:
	for q in sfx_players:
		if is_instance_valid(q):
			q.stop()


func set_visible(id, on: bool, restoring: bool = false) -> void:
	var t = by_id.get(id)
	if t == null:
		hud.log("no %s in this level" % id)
		return
	t["node"].visible = on
	if not restoring:
		kept[level]["vis"][id] = on
	var i := solid.find(t)
	if ["wall", "floor", "ceiling", "door", "mesh"].has(t["kind"]) and on and i < 0 and not t["hollow"] and t["use"] != "clean":
		solid.append(t)
	if not on and i >= 0:
		solid.remove_at(i)


func seen(id) -> bool:
	var t = by_id.get(id)
	return t != null and t["node"].visible and in_view(t["node"])


func in_view(n: Node3D) -> bool:
	var cam: Camera3D = game.camera
	var p: Vector3 = n.global_position
	if cam.is_position_behind(p):
		return false
	var s := cam.unproject_position(p)
	var vp := get_viewport().get_visible_rect().size
	return s.x >= -40 and s.x <= vp.x + 40 and s.y >= -40 and s.y <= vp.y + 40


func door_of(id) -> Dictionary:
	return doors.get(id, {"open": false, "locked": false})


func can_unlock(d: Dictionary) -> bool:
	var by = d.get("by")
	if by == null:
		return false
	var s := str(by)
	return flags.has(s.substr(5)) if s.begins_with("flag:") else items.has(s)


func door(id, set_to: String) -> void:
	var d = doors.get(id)
	if d == null:
		hud.log("no door %s" % id)
		return
	if set_to == "lock" or set_to == "unlock":
		d["locked"] = set_to == "lock"
		if not d["locked"]:
			d["latched"] = false
		turn_latch(id)
		return
	var open := set_to == "open"
	if open == bool(d["open"]):
		return
	d["open"] = open
	d["from"] = d["deg"]
	d["t"] = 0.0
	d["secs"] = SLAM_SECS if set_to == "slam" else DOOR_SECS
	if set_to == "slam":
		hud.log("♪ slam")
		shelf_sound("door_slam_01", id)
	d["to"] = away_deg(by_id[id]) if open else 0.0


## which face of the leaf looks into the room that holds the door (+1 or -1 along its thickness)
func latch_side(t: Dictionary) -> int:
	var floor_t = by_id.get("%s__floor" % t["room"])
	if floor_t == null:
		return 1
	var b: Transform3D = t["base"]
	var d: Vector3 = floor_t["node"].position - b.origin
	return 1 if d.dot(b.basis * Vector3(0, 0, 1)) >= 0 else -1


func on_latch_side(id) -> bool:
	for x in latches:
		if x["door"] == id:
			var b: Transform3D = by_id[id]["base"]
			return (player.pos - b.origin).dot(b.basis * Vector3(0, 0, 1)) * float(x["side"]) > 0
	return false


func turn_latch(id) -> void:
	pass


func latch(id, on: bool) -> void:
	var d = doors.get(id)
	if d == null or d["open"] or (d["locked"] if on else not d.get("latched", false)):
		return
	d["locked"] = on
	d["latched"] = on
	turn_latch(id)
	shelf_sound("latch", id)
	hud.log("%s: %s" % ["locked" if on else "unlocked", id])
	emit({"type": "locked", "id": id, "on": on})


func away_deg(t: Dictionary) -> float:
	var far := func(deg: float) -> float:
		swing_door(t, deg)
		return t["node"].global_position.distance_to(player.pos)
	var a: float = far.call(90.0)
	var b: float = far.call(-90.0)
	swing_door(t, 0.0)
	return 90.0 if a >= b else -90.0


## one door by deg (negative the other way); a door without a kit hinges on its left edge; a sliding one slides
func swing_door(t: Dictionary, deg: float) -> void:
	var sw: Dictionary = t.get("swing", {})
	var w := float(t["size"][0])
	var pivot := Vector3(float(sw["pivot"][0]), 0, float(sw["pivot"][2])) if sw.has("pivot") else Vector3(-w / 2.0, 0, 0)
	var hinge: String = sw.get("hinge", "left")
	var slide: bool = bool(sw.get("slide", false))
	var b: Transform3D = t["base"]
	var kids: Array = []
	for id in by_id:
		if by_id[id].get("attach") == t["id"]:
			kids.append(by_id[id])
	if slide:
		var dx: Vector3 = b.basis * Vector3(-(abs(deg) / 90.0) * float(sw.get("w", w)) * 0.95, 0, 0)
		for o in [t] + kids:
			var ob: Transform3D = o["base"]
			o["node"].transform = Transform3D(ob.basis, ob.origin + dx)
		return
	var P: Vector3 = b.origin + b.basis * pivot
	var th := deg_to_rad(deg) * (1.0 if hinge == "right" else -1.0)
	var R := Transform3D(Basis(Vector3.UP, th), Vector3.ZERO)
	for o in [t] + kids:
		var ob: Transform3D = o["base"]
		var nt := Transform3D(Basis(), P) * R * Transform3D(Basis(), -P) * ob
		o["node"].transform = nt


func powered(lid = null) -> bool:
	var k = kept.get(lid if lid != null else level)
	return k == null or not (k.get("power", true) is bool and k.get("power", true) == false)


func power(set_to, lid = null) -> void:
	var l: String = lid if lid != null else level
	if not kept.has(l):
		kept[l] = {"vis": {}, "doors": {}, "bodies": {}}
	var k: Dictionary = kept[l]
	var on: bool = set_to != "off"
	if on == (not (k.get("power", true) is bool and k.get("power", true) == false)):
		return
	k["power"] = on
	hud.log("the power is back" if on else "the power's out")
	if on and l == level:
		for t in lights:
			var u: Dictionary = light_state[t["id"]]
			if _electric(u):
				if u["flicker0"] == null:
					u["flicker0"] = u["flicker"]
				u["flicker"] = max(float(u["flicker0"]), 0.8)
				u["surge"] = clock + 0.9
	emit({"type": "power", "on": on})


func _electric(u: Dictionary) -> bool:
	return not ["candle", "fire"].has(u.get("kind"))


func light(id, room, set_to: String) -> void:
	var ls: Array = []
	if id != null:
		if light_state.has(id):
			ls.append(id)
	else:
		for t in lights:
			if light_state[t["id"]]["room"] == room:
				ls.append(t["id"])
	for lid in ls:
		var u: Dictionary = light_state[lid]
		match set_to:
			"toggle":
				u["on"] = not u["on"]
			"on", "off":
				u["on"] = set_to == "on"
			"flicker":
				u["on"] = true
				u["flicker"] = max(0.6, float(u["flicker"]))
			"dim":
				u["on"] = true
				u["dim"] = 0.35


func light_energy(id) -> float:
	var t = by_id.get(id)
	return t["node"].light_energy if t != null and t["node"] is Light3D else 0.0


func wait(secs: float) -> void:
	var w := {"at": clock + secs, "done": false}
	waits.append(w)
	while not w["done"]:
		await get_tree().process_frame


func anim(secs: float, fn: Callable) -> void:
	var a := {"t": 0.0, "secs": max(0.01, secs), "fn": fn, "done": false}
	anims.append(a)
	while not a["done"]:
		await get_tree().process_frame


func fade(to: float, secs: float) -> void:
	await game.fade(to, secs)


func look_at(id, secs: float) -> void:
	var t = by_id.get(id)
	if t == null:
		return
	var at: Vector3 = middle_of(t)
	var eye := eye_pos()
	var d := at - eye
	var y1 := rad_to_deg(atan2(-d.z, d.x))
	look_tween = {"y0": player.yaw, "p0": player.pitch, "t": 0.0, "secs": max(0.2, secs * 0.6),
		"y1": float(player.yaw) + fposmod(y1 - float(player.yaw) + 180.0, 360.0) - 180.0,
		"p1": rad_to_deg(atan2(d.y, sqrt(d.x * d.x + d.z * d.z)))}


func looked_at(id, within: float) -> float:
	return float(look["t"]) if (look["id"] == id and float(look["dist"]) <= within) else 0.0


func panel(spec: Dictionary) -> Variant:
	return await modal(func(): return await hud.panel(spec))


func examine(t: Dictionary, title: String, text: String) -> void:
	examining = t
	t["node"].visible = false
	await modal(func(): return await hud.examine({"title": title, "text": text}))
	t["node"].visible = true
	examining = null


func choose(spec: Dictionary) -> Variant:
	var sp := spec.duplicate()
	if sp.get("who") != null:
		sp["who"] = story.cast_name(sp["who"])
	return await modal(func(): return await hud.choose(sp))


func ask_name(question, def) -> String:
	var v = await modal(func(): return await hud.panel({"title": question if question != null else "What's your name?", "name": def if def != null else story.game.get("player_name", "Alex")}))
	var name := str(v).strip_edges()
	if name == "":
		name = str(def if def != null else story.game.get("player_name", "Alex"))
	hud.player_name = name
	if run != null:
		run["name"] = name
	return name


func modal(show: Callable) -> Variant:
	busy = true
	keys = {}
	hud.locked(false)
	var v = await show.call()
	busy = false
	hud.locked(mouse_captured)
	since = clock
	return v


func finish() -> void:
	if has_end:
		end({"to": next_node})


func end(r: Dictionary) -> void:
	if not has_end:
		return
	has_end = false
	listener = Callable()
	timer_left = null
	hud.timer(null)
	stitch_ended.emit(r)


# ---- a die (use: roll): thrown ahead, its face heard when it settles (no physics yet: a moment, then a face) ----
func rolling(id) -> bool:
	return physics != null and physics.rolling(id)


## a die thrown from the hand (physics.gd): forward and a little up, spinning; `rolled` with its face when it settles
func roll(t: Dictionary, s: Dictionary) -> void:
	if physics != null:
		physics.throw_die(t, s)


# ---- the inventory: taking a thing, the one in the hand, setting it down -------------------------------------
func is_torch(item) -> bool:
	var it = story.items.get(str(item), null)
	if it == null or it.get("torch") == null:
		return false
	return not (it["torch"] is bool and it["torch"] == false)


func torch_item() -> Variant:
	for id in items:
		if is_torch(id):
			return story.items[id]
	return null


func take(t: Dictionary) -> void:
	var id = t["id"]
	var d: Dictionary = t["piece"].get("d", {}) if t["piece"].get("d") is Dictionary else {}
	var k: Dictionary = kept[level]
	for e in inv:
		if e["id"] == id:
			return
	if d.has("item") and is_torch(d["item"]):
		set_visible(id, false)
		k["bodies"].erase(id)
		give(d["item"])
		torch_make()
		emit({"type": "pickup", "item": d["item"]})
		return
	set_visible(id, false)
	k["bodies"].erase(id)
	var e := {"id": id, "item": d.get("item"), "name": title_of(t) if title_of(t) != null else name_of(t), "kind": "carry" if t["use"] == "carry" else "pickup", "level": level, "thing": t}
	inv.append(e)
	inv_at = inv.size() - 1
	e["icon"] = PhysC.copy_of(t)                  # a copy of it for the row's slot (hud.gd inventory: the model, not a picture)
	if physics != null:
		physics.take(e)                           # a copy of it for the hand
	inv_draw(true)
	if e["item"] != null:
		give(e["item"])
		emit({"type": "pickup", "item": e["item"]})
	if e["kind"] == "carry":
		emit({"type": "carry", "id": id})


func inv_has(id) -> bool:
	for e in inv:
		if e["id"] == id:
			return true
	return false


func inv_remove(id) -> void:
	for i in inv.size():
		if inv[i]["id"] == id:
			if physics != null:
				physics.release(inv[i])
			inv.remove_at(i)
			if inv.is_empty():
				inv_at = -1
			elif i < inv_at or inv_at >= inv.size():
				inv_at = max(0, inv_at - 1)
			inv_draw(true)
			return


func inv_scroll(d: int) -> void:
	var n := inv.size()
	if n < 2 or d == 0:
		return
	inv_at = posmod(inv_at + sign(d), n)
	inv_draw(true)


func inv_toggle() -> void:
	inv_shown = not inv_shown
	inv_draw(false)


func inv_draw(peek: bool) -> void:
	var lst: Array = []
	for e in inv:
		lst.append({"id": e["id"], "name": e["name"], "model": e.get("icon")})
	hud.inventory(lst, inv_at, inv_shown, peek)


## G: the one in the hand set down on whatever is under a spot just in front of you, facing you
func drop() -> void:
	var e = carried()
	if e == null or busy or playing != null or player.seat != null or player.hiding != null or player.sleeping != null:
		return
	var at = drop_spot(e)
	if at == null:
		hud.shake()
		hud.line("There's no room to put it down.", "", 1.4, true)
		return
	var t: Dictionary = e["thing"]
	var k: Dictionary = kept[level]
	if e["level"] == level:
		t["node"].transform = Transform3D(Basis(Vector3.UP, deg_to_rad(float(player.yaw) - 90.0)), at)
		set_visible(e["id"], true)
	else:
		hud.log("put down in another level: not in Play yet")
	k["bodies"][e["id"]] = t["node"].transform
	inv_remove(e["id"])
	if e["item"] != null:
		items.erase(e["item"])
		if run != null:
			run["items"].erase(e["item"])
	hud.log("put down: %s" % e["name"])
	var ins: Array = []
	for tr in triggers:
		if point_in(tr, at.x, -at.z, at.y):
			ins.append(tr["id"])
	emit({"type": "dropped", "id": e["id"], "in": ins})


func drop_spot(e: Dictionary) -> Variant:
	var a := deg_to_rad(float(player.yaw))
	var fwd := Vector3(cos(a), 0, -sin(a))
	var r: float = max(float(e["thing"]["size"][0]), float(e["thing"]["size"][1])) / 2.0
	var from := Vector3(player.pos.x, player.pos.y + 0.45, player.pos.z)
	var hit = ray_hit(from, fwd, DROP_AHEAD + r + 0.1, blocks())
	var dist: float = min(DROP_AHEAD, float(hit["dist"]) - r - 0.04) if hit != null else DROP_AHEAD
	if dist < 0.12:
		return null
	var x := from.x + fwd.x * dist
	var z := from.z + fwd.z * dist
	var top := max(float(player.eye), 1.2)
	var down = ray_hit(Vector3(x, player.pos.y + top, z), Vector3.DOWN, top + 0.5, blocks())
	var y: float = (float(down["point"].y) if down != null else player.pos.y) + float(e["thing"]["size"][2]) / 2.0
	return Vector3(x, y, z)


# ---- a board game (use: game): the player sits down at the table and its rules play out ----------------------
func board_game(t: Dictionary, s: Dictionary) -> void:
	if playing != null:
		return
	var d: Dictionary = t["piece"].get("d", {}) if t["piece"].get("d") is Dictionary else {}
	var id = t["id"]
	var gname := str(d.get("game", ""))
	playing = id
	keys = {}
	hud.set_cursor("none", "")
	var back := {"pos": player.pos, "eye": player.eye, "yaw": player.yaw, "pitch": player.pitch, "secs": s["secs"]}
	var seat := seat_at(t, s)
	await tween(seat)
	var result = null
	match gname:
		"chohan":
			var die1 := 1 + randi() % 6
			var die2 := 1 + randi() % 6
			var call = await choose({"prompt": "Chō or han?", "options": [{"label": "Chō (even)"}, {"label": "Han (odd)"}], "secs": null})
			await wait(0.8)
			var even := (die1 + die2) % 2 == 0
			result = "win" if ((call == 0) == even) else "lose"
			hud.board("%d + %d: %s" % [die1, die2, "chō" if even else "han"])
		_:
			hud.log("no rules for %s in Play yet" % gname)
	if not stopped:
		await wait(1.0)
	hud.board(null)
	if not stopped:
		await tween(back)
	playing = null
	if result != null:
		hud.log("%s: %s" % [gname.replace("_", " ").capitalize(), result])
		emit({"type": "played", "id": id, "game": gname, "result": result})


func seat_at(t: Dictionary, s: Dictionary) -> Dictionary:
	var hw := float(t["size"][0]) / 2.0
	var hd := float(t["size"][1]) / 2.0
	var inv_t: Transform3D = t["node"].global_transform.affine_inverse()
	var L: Vector3 = inv_t * player.pos
	var side := Vector3(0, 0, sign(L.z) if L.z != 0 else 1.0) if hw > hd else Vector3(sign(L.x) if L.x != 0 else 1.0, 0, 0)
	var at: Vector3 = t["node"].global_transform * (side * (min(hw, hd) + float(s["back"])))
	var mid: Vector3 = t["node"].global_position
	var dx := mid.x - at.x
	var dz := mid.z - at.z
	var top := mid.y + float(t["size"][2]) / 2.0
	var feet := Vector3(at.x, player.pos.y, at.z)
	return {"pos": feet, "eye": s["eye"], "yaw": rad_to_deg(atan2(-dz, dx)), "pitch": rad_to_deg(atan2(top - feet.y - float(s["eye"]), sqrt(dx * dx + dz * dz))), "secs": s["secs"]}


## a triggered scene (the `scene` action): blended in from where the player is; afterwards they carry on from its view
func scene(id) -> void:
	if not play_scene.is_valid():
		hud.log("scene %s: not from here" % id)
		return
	hold()
	moving = null
	var r = await play_scene.call(id)
	if stopped or r == null:
		return
	place_from_camera(r["level"], r["cam"])
	go()


func sit(t: Dictionary, s: Dictionary) -> void:
	var at: Vector3 = t["node"].global_position
	player.seat = t["id"]
	player.stood = {"pos": player.pos, "eye": player.eye}
	await tween({"pos": Vector3(at.x, player.pos.y, at.z), "eye": s["eye"], "yaw": float(player.yaw) + 180.0, "pitch": 0.0, "secs": s["secs"]})


func stand(s: Dictionary) -> void:
	var st = player.stood
	player.seat = null
	if st != null:
		await tween({"pos": st["pos"], "eye": st["eye"], "yaw": player.yaw, "pitch": player.pitch, "secs": s["secs"]})


func ready(t: Dictionary) -> bool:
	var d: Dictionary = t["piece"].get("d", {}) if t["piece"].get("d") is Dictionary else {}
	return StoryC.flags_hold(d.get("if"), flags)


func sleep(t: Dictionary, s: Dictionary) -> void:
	var at: Vector3 = t["node"].global_position
	var top: float = min(at.y + float(t["size"][2]) / 2.0, at.y - float(t["size"][2]) / 2.0 + float(s["mattress"]))
	player.sleeping = {"pos": player.pos, "eye": player.eye, "yaw": player.yaw}
	await tween({"pos": Vector3(at.x, player.pos.y, at.z), "eye": top - player.pos.y + float(s["eye"]), "yaw": player.yaw, "pitch": float(s["pitch"]), "secs": s["secs"]})
	await fade(1.0, float(s["dark"]))
	_wake_later(float(s["wake"]))


func _wake_later(secs: float) -> void:
	await wait(secs)
	if player.sleeping != null and not in_chapter:
		wake()


func wake(secs: float = 1.0) -> void:
	var st = player.sleeping
	if st == null:
		return
	await fade(0.0, secs)
	await wait(0.7)
	await tween({"pos": st["pos"], "eye": st["eye"], "yaw": st["yaw"], "pitch": 0.0, "secs": 1.0})
	player.sleeping = null


func chapter(title, a: Dictionary) -> void:
	in_chapter = true
	busy = true
	keys = {}
	await fade(1.0, 1.0)
	if a.get("time") != null and on_set_time.is_valid():
		on_set_time.call(a["time"])
	if a.get("save", true) != false:
		autosave(title)
	await hud.chapter(title, a.get("sub"), float(a.get("secs", 3)))
	in_chapter = false
	busy = false
	if player.sleeping != null:
		await wake(1.2)
	else:
		await fade(0.0, 1.2)


func autosave(where) -> void:
	if run != null:
		run["autosave"] = {"where": where if where != null else story.game.get("title", "game"), "secs": float(run["secs"]) + clock}
	if hud.menu != null:
		hud.menu.autosave(str(story.game.get("id", "game")), str(where if where != null else story.game.get("title", "game")), now())


func game_title() -> String:
	return story.game.get("title", "game")


func hide(t: Dictionary, s: Dictionary) -> void:
	var id = t["id"]
	var d: Dictionary = t["piece"].get("d", {}) if t["piece"].get("d") is Dictionary else {}
	var spot = things.get(d.get("inside"), null) if d.has("inside") else null
	var at: Vector3 = spot["node"].global_position if spot != null else t["node"].global_position
	var yaw := float(spot["piece"].get("yaw", 0)) if spot != null else float(t["piece"].get("yaw", 0))
	player.stood = {"pos": player.pos, "eye": player.eye}
	player.hiding = id
	player.limit = {"yaw": yaw, "dy": float(s["look"][0]), "dp": float(s["look"][1])}
	await tween({"pos": Vector3(at.x, player.pos.y, at.z), "eye": s["eye"], "yaw": yaw, "pitch": 0.0, "secs": s["secs"]})
	emit({"type": "hidden", "id": id})


func unhide(s: Dictionary) -> void:
	var st = player.stood
	leave_hiding()
	if st != null:
		await tween({"pos": st["pos"], "eye": st["eye"], "yaw": player.yaw, "pitch": player.pitch, "secs": s["secs"]})


func leave_hiding() -> void:
	var id = player.hiding
	if id == null:
		return
	player.hiding = null
	player.limit = null
	emit({"type": "unhidden", "id": id})


func peep(door_id, s: Dictionary) -> void:
	var near = target
	var far = null
	for x in lenses:
		if x["door"] == door_id and (near == null or x["side"] != near.get("side")):
			far = x
	if far == null or player.peeping != null:
		return
	follow_leaf(far)
	var n: Vector3 = far["node"].global_transform.basis * Vector3(0, 1, 0)
	var yaw := rad_to_deg(atan2(-n.z, n.x))
	player.peeping = {"door": door_id, "at": far["node"].global_position + n * 0.03, "back": {"yaw": player.yaw, "pitch": player.pitch}}
	player.limit = {"yaw": yaw, "dy": float(s["look"][0]), "dp": float(s["look"][1])}
	player.yaw = yaw
	player.pitch = 0.0
	keys = {}
	hud.peep(true)
	hud.set_cursor("none", "")


func unpeep() -> void:
	var pk = player.peeping
	if pk == null:
		return
	player.peeping = null
	player.limit = null
	player.yaw = pk["back"]["yaw"]
	player.pitch = pk["back"]["pitch"]
	hud.peep(false)


func tween(to: Dictionary) -> void:
	var m := {"from": {"pos": player.pos, "eye": player.eye, "yaw": player.yaw, "pitch": player.pitch}, "to": to, "t": 0.0, "done": false}
	moving = m
	while not m["done"] and not stopped:
		await get_tree().process_frame


# ---- the cast in play: behaviours --------------------------------------------------------------------------------
func spot_pos(t: Dictionary) -> Vector3:
	var p: Vector3 = t["node"].global_position
	return Vector3(p.x, p.y, p.z)


func route(ref) -> Variant:
	var r = null
	var lvl = null
	if ref is Array:
		r = {"points": ref}
	else:
		for lid in story.levels:
			var rs: Dictionary = story.levels[lid].get("routes", {})
			if rs.has(ref):
				r = rs[ref]
				lvl = lid
	if r == null:
		hud.log("no route %s" % ref)
		return null
	var points: Array = []
	for p in r.get("points", []):
		var q: Dictionary = {"at": p} if p is String else p
		var t = things.get(q.get("at"))
		if t == null:
			hud.log("route %s: no spot %s" % [ref, q.get("at")])
			continue
		if lvl == null:
			lvl = level
		points.append({"pos": spot_pos(t), "yaw": float(t["piece"].get("yaw", 0)), "wait": float(q.get("wait", 0)), "pose": q.get("pose"), "check": q.get("check")})
	return {"level": lvl, "mode": r.get("mode", "loop"), "points": points} if points.size() else null


func behave(cid, spec: Dictionary) -> void:
	var as_ = str(spec.get("as", "idle"))
	var npc = npcs.get(cid)
	if as_ == "off":
		npcs.erase(cid)
		if cast_nodes.has(cid):
			cast_nodes[cid].visible = false
		return
	if not BehavioursC.has(as_):
		hud.log("behaviour not in Play yet: %s" % as_)
		return
	var n := {"cid": cid, "as": as_, "s": BehavioursC.settings_of(as_, spec), "st": {}, "pos": npc["pos"] if npc != null else null, "yaw": float(npc["yaw"]) if npc != null else 0.0,
		"level": npc["level"] if npc != null else level, "pose": "idle", "walking": false, "t0": clock}
	npcs[cid] = n
	BehavioursC.start(as_, n, self, n["s"])


func draw_npcs(dt: float) -> void:
	for cid in npcs:
		var n: Dictionary = npcs[cid]
		BehavioursC.update(n["as"], n, self, dt, n["s"])
		var node = cast_nodes.get(cid)
		if node == null:
			continue
		if baked_cast.has(cid):           # a scene's recorded body stands in for the stand-in while the bake plays
			node.visible = false
			continue
		node.visible = n["pos"] != null and n["level"] == level
		if not node.visible:
			continue
		node.position = n["pos"]
		node.rotation_degrees = Vector3(0, float(n["yaw"]) + 90.0, 0)


# ---- being seen ---------------------------------------------------------------------------------------------------
func sight_of(n: Dictionary) -> Variant:
	var s = n["s"].get("sees")
	if s == null or (s is bool and s == false):
		return null
	var c := SIGHT.duplicate()
	if s is Dictionary:
		for k in s:
			c[k] = float(s[k])
	return c


func sees(n: Dictionary) -> bool:
	var c = sight_of(n)
	if c == null or n["pos"] == null or n["level"] != level or player.hiding != null:
		return false
	for t in triggers:
		if t["safe"] and is_in(t):
			return false
	var h := float(story.cast.get(n["cid"], {}).get("height", 1.7))
	var eye: Vector3 = n["pos"] + Vector3(0, h * 0.93, 0)
	var at: Vector3 = player.pos + Vector3(0, float(player.eye) * 0.9, 0)
	var d := at - eye
	var dist := d.length()
	if dist > float(c["range"]) * (float(c["crouched"]) if player.crouched else 1.0):
		return false
	var a := deg_to_rad(float(n["yaw"]))
	var fwd := Vector3(cos(a), 0, -sin(a))
	var flat := Vector3(d.x, 0, d.z).normalized()
	if rad_to_deg(acos(clamp(fwd.dot(flat), -1.0, 1.0))) > float(c["angle"]) / 2.0:
		return false
	var hit = ray_hit(eye, d.normalized(), dist, blocks())
	return not (hit != null and float(hit["dist"]) < dist - 0.3)


func watch(dt: float) -> void:
	if calm > 0:
		calm -= dt
		suspicion = max(0.0, suspicion - dt / SIGHT["drain"])
		hud.seen(suspicion)
		return
	var by = null
	for cid in npcs:
		if sees(npcs[cid]):
			by = npcs[cid]
			break
	if by != null:
		suspicion += dt / float(sight_of(by)["meter"])
		if suspicion >= 1.0:
			caught(by["cid"], null)
			return
	else:
		suspicion = max(0.0, suspicion - dt / SIGHT["drain"])
	hud.seen(suspicion)


func caught(by, at) -> void:
	var n = npcs.get(by)
	var c = sight_of(n) if n != null else null
	if c == null:
		c = SIGHT
	suspicion = 0.0
	calm = float(c["calm"])
	hud.seen(0.0)
	last_caught = {"by": by, "at": at, "clock": clock}
	hud.log("caught by %s%s" % [by, (" in " + str(at)) if at != null else ""])
	emit({"type": "caught", "by": by, "at": at})


# ---- the player's use and the cursor ----------------------------------------------------------------------------
func eye_pos() -> Vector3:
	return player.pos + Vector3(0, float(player.eye), 0)


## a ray against the things' boxes (and cylinders as their boxes): the nearest {thing, dist, point} or null
func ray_hit(from: Vector3, dir: Vector3, far: float, among: Array) -> Variant:
	var best = null
	for t in among:
		var n: Node3D = t["node"]
		if not n.visible:
			continue
		var inv_t: Transform3D = n.global_transform.affine_inverse()
		var o: Vector3 = inv_t * from
		var d: Vector3 = inv_t.basis * dir
		var e := extent(t)
		var hx: float = float(e["r"]) if e.has("r") else float(e["hx"])
		var hz: float = float(e["r"]) if e.has("r") else float(e["hz"])
		var hy := float(e["hy"])
		var tmin := 0.0
		var tmax := far
		var ok := true
		for ax in 3:
			var oo: float = [o.x, o.y, o.z][ax]
			var dd: float = [d.x, d.y, d.z][ax]
			var h: float = [hx, hy, hz][ax]
			if abs(dd) < 1e-9:
				if abs(oo) > h:
					ok = false
					break
				continue
			var t1 := (-h - oo) / dd
			var t2 := (h - oo) / dd
			if t1 > t2:
				var tmp := t1
				t1 = t2
				t2 = tmp
			tmin = max(tmin, t1)
			tmax = min(tmax, t2)
			if tmin > tmax:
				ok = false
				break
		if not ok:
			continue
		if best == null or tmin < float(best["dist"]):
			best = {"thing": t, "dist": tmin, "point": from + dir * tmin}
	return best


func aim() -> Variant:
	var cam: Camera3D = game.camera
	var among: Array = []
	for id in by_id:
		var t: Dictionary = by_id[id]
		if ["wall", "floor", "ceiling", "door", "mesh"].has(t["kind"]) and t["node"].visible and not t["hollow"]:
			among.append(t)
	return ray_hit(cam.global_position, -cam.global_transform.basis.z, LOOK_RANGE, among)


func use(press: bool) -> void:
	if player.sleeping != null or in_chapter:
		return
	if player.peeping != null:
		hud.press()
		unpeep()
		return
	var seat = player.seat
	if seat != null and (target == null or target["id"] == seat):
		hud.press()
		stand(setting("sit"))
		return
	if player.hiding != null and target == null:
		hud.press()
		unhide(setting("hide"))
		return
	var t = target
	if t == null:
		return
	var name := interactables.name_of(t, self)
	hud.press()
	if name != "" and interactables.holds(name):
		if press and interactables.prompt(name, t, self, setting(name))["cursor"] != "locked":
			holding = t
		else:
			interactables.use(name, t, self, setting(name))
		return
	if name != "":
		var r = await interactables.use(name, t, self, setting(name))
		if r is bool and r == false:
			return
	emit({"type": "use", "id": t["id"]})


func update_cursor(dt: float) -> void:
	var hit = aim()
	var o = hit["thing"] if hit != null else null
	var id = o["id"] if o != null else null
	if id != null and id == look["id"]:
		look["t"] = float(look["t"]) + dt
	else:
		look = {"id": id, "t": 0.0, "dist": float(hit["dist"]) if hit != null else INF}
	if hit != null:
		look["dist"] = hit["dist"]
	var name := ""
	if o != null and float(hit["dist"]) <= USE_RANGE:
		name = interactables.name_of(o, self)
	target = o if name != "" else null
	if name == "":
		hud.set_cursor("none", setting("sit")["stand"] if player.seat != null else "")
		return
	var pr := interactables.prompt(name, o, self, setting(name))
	hud.set_cursor(pr["cursor"], pr["label"], title_of(o))


func hold_tick(dt: float) -> void:
	var t = holding
	var name := interactables.name_of(t, self) if t != null else ""
	if name == "" or not interactables.holds(name) or not t["node"].visible:
		holding = null
		hud.progress(null)
		return
	if target != t:
		return
	if interactables.hold(name, t, self, dt, setting(name)):
		holding = null
		hud.progress(null)
		set_visible(t["id"], false)
		hud.log("clean: %s" % name_of(t))
		emit({"type": "use", "id": t["id"]})


func set_stain(t: Dictionary, opacity: float) -> void:
	var m = t.get("mesh")
	if t.has("blood") and is_instance_valid(t["blood"]):
		HSBlood.set_opacity(t["blood"].material_override, opacity)
		return
	if m != null and m.material_override != null:
		var mat: StandardMaterial3D = m.material_override
		var c := mat.albedo_color
		mat.albedo_color = Color(c.r, c.g, c.b, 0.85 * opacity)


# ---- the look plugin on the level (HorrorStudioLook): the weather, blood -----------------------------------------
## `game.weather` rain: streaks fall through every room with no ceiling, its floor wet with pools and the rain's
## rings on them, the shelf's rain heard there
func weather_attach() -> void:
	if str(game.story.game.get("weather", "clear")) != "rain" or game.level == null:
		return
	var rooms: Array = game.story.levels.get(level, {}).get("rooms", [])
	var open: Array = []
	for r in rooms:
		var c = r.get("ceiling", true)
		if c is bool and c == false:
			open.append(r)
	if open.is_empty():
		return
	var ids: Array = []
	for r in open:
		var at: Array = r["at"]
		var sz: Array = r["size"]
		var size := Vector3(float(sz[0]), float(sz[2]), float(sz[1]))
		var rain := HSRain.make(size, int(clamp(size.x * size.z * 25.0, 200, 2500)), 0.55)
		rain.name = "Rain_" + str(r["id"])
		game.level.add_child(rain)
		rain.global_position = Vector3(float(at[0]) + size.x / 2.0, float(at[2]) + size.y / 2.0, -(float(at[1]) + size.z / 2.0))
		ids.append(r["id"])
		if game.sfx_index.has("rain"):
			shelf_sound("rain", rain.global_position, -6.0, null)
	HSWet.wet_floors(game.level, ids, {"wetness": 0.9, "puddles": 0.6, "puddle_scale": 1.2, "ripples": 1.0})
	for n in game.level.get_children():                 # the rain on every window's pane
		if n is MeshInstance3D and n.has_meta("pane"):
			var pm = JSON.parse_string(n.get_meta("pane"))
			var w: float = float(pm.get("w", 1.2)) if pm is Dictionary else 1.2
			var h: float = float(pm.get("h", 1.1)) if pm is Dictionary else 1.1
			var m := HSGlass.pane(n, Vector2(w, h), float(hash(n.name) % 977) / 31.0)
			HSGlass.set_rain(m, 0.9)
			panes.append(n)


## the cast's stand-ins as their bodies: a Character Studio export (`previs_body` people/<name>, game/people/) with its
## skin and eyes, else the bake's shaped MHR body (game/previs/Body_<cid>.glb) on HSSkin, its arms brought down from
## the bind pose (ARMS_DOWN degrees about the skeleton's x, set as a global pose); the cylinders stay under it, hidden, as the
## figure's size. A body glides on its behaviour's path until the motions come (GAMEPLAY_PLAN: the motion sets).
const ARMS_DOWN := 52.0
var standins: Dictionary = {}        # cid -> the body node under the stand-in
var panes: Array = []                # the windows' panes wearing the rain


func standin_bodies() -> void:
	standins = {}
	for cid in cast_nodes:
		var n: Node3D = cast_nodes[cid]
		var c: Dictionary = game.story.cast.get(cid, {}) if game.story.cast is Dictionary else {}
		var pb := str(c.get("previs_body", ""))
		var file := ""
		var people := false
		if pb.begins_with("people/") and ResourceLoader.exists("res://game/people/" + pb.substr(7) + ".glb"):
			file = "res://game/people/" + pb.substr(7) + ".glb"
			people = true
		elif ResourceLoader.exists("res://game/previs/Body_" + cid + ".glb") or FileAccess.file_exists("res://game/previs/Body_" + cid + ".glb"):
			file = "res://game/previs/Body_" + cid + ".glb"
		if file == "":
			continue
		var body: Node3D = glb_scene(file)             # read by GLTFDocument, not the importer: its bone frames are the file's own (arms_down counts on them)
		if body == null:
			continue
		body.name = "body_" + cid
		n.add_child(body)
		for ch in n.get_children():                  # the cylinders hidden under it
			if ch is MeshInstance3D:
				ch.visible = false
		var lo := INF
		for mi in body.find_children("*", "MeshInstance3D", true, false):
			if mi.mesh != null:
				lo = min(lo, (mi.global_transform * mi.get_aabb()).position.y - n.global_position.y)
		if lo != INF:
			body.position.y = -lo                    # its feet on the stand-in's floor
		body.rotation_degrees.y = 180.0               # the export faces +z, the stand-in's forward is -z
		for sk in body.find_children("*", "Skeleton3D", true, false):
			arms_down(sk)
		HSSkin.wear(body, {})
		if people:
			HSEye.wear(body, file)
		standins[cid] = body


## a glb read at run time (GLTFDocument): the file's own node and bone frames, the same on every machine
static func glb_scene(path: String) -> Node3D:
	if not FileAccess.file_exists(path):
		return null
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(path, st) != OK:
		return null
	return doc.generate_scene(st)


## the T-pose's arms down to the sides: the upper arms turned about the body's forward axis (the bone's rest frame
## turned with them)
static func arms_down(sk: Skeleton3D) -> void:
	for pair in [["l_uparm", -1.0], ["r_uparm", 1.0]]:
		var bi := sk.find_bone(pair[0])
		if bi < 0:
			continue
		var g: Transform3D = sk.get_bone_global_rest(bi)
		var turned := Basis(Vector3(0, 0, 1), deg_to_rad(ARMS_DOWN * float(pair[1]))) * g.basis   # about the skeleton's z: down in the frontal plane (the sign tried)
		sk.set_bone_global_pose(bi, Transform3D(turned, g.origin))


## a `clean` stain of kind blood wears the blood splat (blood.gdshader) on a quad over its block; scrubbing fades it
func blood_attach() -> void:
	for id in things:
		var t: Dictionary = things[id]
		if t["use"] != "clean":
			continue
		var d: Dictionary = t["piece"].get("d", {}) if t["piece"].get("d") is Dictionary else {}
		if str(d.get("stain", "dirt")) != "blood":
			continue
		var m = t.get("mesh")
		if m == null:
			continue
		var q := MeshInstance3D.new()
		q.name = "blood"
		var qm := QuadMesh.new()
		var sz: Array = t["size"]
		qm.size = Vector2(float(sz[0]), float(sz[1]))
		q.mesh = qm
		q.material_override = HSBlood.material(float(hash(str(id)) % 1000) / 37.0, {"pool": 0.75, "drops": 0.7})
		q.rotation_degrees = Vector3(-90, 0, 0)
		q.position = Vector3(0, float(sz[2]) / 2.0 + 0.003, 0)
		t["node"].add_child(q)
		m.visible = false
		t["blood"] = q


func middle_of(t: Dictionary) -> Vector3:
	return t["node"].global_position


# ---- running the story --------------------------------------------------------------------------------------------
## a stitch: its beats fire from what the player does; it ends on `done`, its timer, or an interrupt
func run_stitch(st: Dictionary, n: Dictionary, interrupts: Array = []) -> Dictionary:
	var beats: Array = []
	for b in st.get("beats", []):
		beats.append({"b": b, "fired": false})
	stitch_title = st.get("title", null)
	next_node = n.get("next")
	has_end = true
	timer_left = float(st["timer"]["secs"]) if (st.has("timer") and st["timer"] is Dictionary) else null
	clock0 = clock
	timer_fail = st["timer"].get("fail") if (st.has("timer") and st["timer"] is Dictionary) else null
	listener = func(ev: Dictionary) -> void:
		for it in interrupts:
			if conditions.matches(it.get("when"), ev, self):
				end({"to": it.get("to"), "interrupt": true})
				return
		for x in beats:
			if x["fired"] or not StoryC.flags_hold(x["b"].get("if"), flags) or not conditions.matches(x["b"].get("when"), ev, self):
				continue
			x["fired"] = true
			if on_beat.is_valid():
				on_beat.call(st, x["b"], (float(run["secs"]) if run != null else 0.0) + clock)
			_run_beat(x["b"])
	go()
	emit({"type": "start"})
	var r = await stitch_ended
	return r


func _run_beat(b: Dictionary) -> void:
	await actions.run_all(b.get("do", []), self)
	ended[b.get("id")] = clock


## a choice by act: the first option whose `when` happens
func run_choice(n: Dictionary) -> Dictionary:
	if n.get("prompt") != null:
		hud.log(str(n["prompt"]))
	has_end = false
	clock0 = clock
	listener = func(ev: Dictionary) -> void:
		for o in n.get("options", []):
			if o.has("when") and conditions.matches(o["when"], ev, self):
				listener = Callable()
				choice_made.emit(o)
				return
	go()
	var o = await choice_made
	return o


## Esc: the game holds and the pause menu opens over the HUD (menu.gd); it comes back on Resume, or ends on Quit
func pause() -> void:
	if held:
		return
	held = true
	busy = true
	keys = {}
	if hud.menu == null:
		hud.log("paused (Esc)")
		return
	var r = await hud.menu.open({"game": str(story.game.get("id", "game")), "where": str(story.game.get("title", "")), "secs": now(), "has": {"torch": torch_item() != null}})
	held = false
	busy = false
	since = clock
	if r is Dictionary and r.has("quit"):
		if r["quit"] == "desktop":
			get_tree().quit()
		elif on_quit.is_valid():
			on_quit.call()


func hold() -> void:
	active = false
	keys = {}
	hud.root.visible = false
	if torch_hot != null:
		torch_hot.light_energy = 0
		torch_spill.light_energy = 0


func go() -> void:
	if stopped:
		return
	hud.root.visible = true
	if active:
		return
	active = true
	since = clock


# ---- the little things: their states on the run's clock -----------------------------------------------------------
func now() -> float:
	return (float(run["secs"]) if run != null else 0.0) + (clock - clock0)


func state_of(id) -> Variant:
	if lives == null:
		return null
	var s = lives.at(id, now())
	return s["state"] if s != null else null


func life_acts(id) -> Array:
	return lives.acts(id, now()) if (lives != null and lives.things.has(id)) else []


func set_state(id, to, by: String = "story") -> void:
	if lives == null:
		return
	lives.set_state(id, to, now(), by)
	life_events()


func skip_time(secs: float) -> void:
	if lives == null:
		return
	lives.skip(now(), secs)
	life_events()


func life_events() -> void:
	var ch: Array = lives.changes
	while lives_seen < ch.size():
		var c: Dictionary = ch[lives_seen]
		lives_seen += 1
		emit({"type": "state", "id": c["id"], "is": c["to"], "by": c["by"]})


# ---- the flashlight (torch.js) ---------------------------------------------------------------------------------
func torch_make() -> void:
	if torch["made"]:
		return
	torch["made"] = true
	hud.hint_key("F", "flashlight")
	torch_hot = SpotLight3D.new()
	torch_spill = SpotLight3D.new()
	for l in [torch_hot, torch_spill]:
		l.light_energy = 0
		l.shadow_enabled = l == torch_hot
		game.world.add_child(l)


func torch_switch() -> void:
	if torch_item() == null or player.sleeping != null or in_chapter:
		return
	torch_make()
	shelf_sound("flashlight_02" if torch["on"] else "flashlight_01")
	if torch["dead"]:
		hud.log("the flashlight is dead")
		return
	torch["on"] = not torch["on"]
	torch["flick"] = 0.0
	emit({"type": "torch", "on": torch["on"]})


func torch_set(v: String) -> void:
	if torch_item() == null and (v == "on" or v == "flicker"):
		hud.log("torch %s: the player has no flashlight" % v)
		return
	torch_make()
	match v:
		"on":
			if not torch["dead"]:
				torch["on"] = true
		"off":
			torch["on"] = false
		"flicker":
			torch["on"] = not torch["dead"]
			torch["flick"] = 1.4
		"dead":
			if torch["on"]:
				torch["flick"] = 1.1
				torch["dying"] = true
			torch["dead"] = true
		"works":
			torch["dead"] = false
			torch["dying"] = false


static func kelvin_color(k: float) -> Color:
	var t := k / 100.0
	var r: float = 255.0 if t <= 66 else 329.698727446 * pow(t - 60, -0.1332047592)
	var g: float = (99.4708025861 * log(t) - 161.1195681661) if t <= 66 else 288.1221695283 * pow(t - 60, -0.0755148492)
	var b: float = 255.0 if t >= 66 else (0.0 if t <= 19 else 138.5177312231 * log(t - 10) - 305.0447927307)
	return Color(clamp(r, 0, 255) / 255.0, clamp(g, 0, 255) / 255.0, clamp(b, 0, 255) / 255.0)


func torch_tick(dt: float) -> void:
	if torch_hot == null:
		return
	var s := setting("torch")
	var it = torch_item()
	if it != null and it.get("torch") is Dictionary:
		for k in it["torch"]:
			s[k] = it["torch"][k]
	var cam: Camera3D = game.camera
	var fwd: Vector3 = -cam.global_transform.basis.z
	if torch["dir"] == null:
		torch["dir"] = fwd
	torch["dir"] = (torch["dir"] as Vector3).lerp(fwd, min(1.0, dt / max(0.01, float(s["lag"])))).normalized()
	var hand: Array = s["hand"]
	var from: Vector3 = cam.global_transform * Vector3(float(hand[0]), float(hand[1]), float(hand[2]))
	var walk: float = min(1.0, float(player.speed) / 1.2)
	from.y -= cos(step_at * TAU) * 0.01 * walk
	var aim_at: Vector3 = from + (torch["dir"] as Vector3) * 6.0
	var k: float = 1.0 if (torch["on"] and player.peeping == null) else 0.0
	if float(torch["flick"]) > 0:
		torch["flick"] = float(torch["flick"]) - dt
		var n := sin(clock * 61.3) * sin(clock * 23.9 + 1.7)
		if torch["dying"]:
			k = 1.0 if n > 0.1 - float(torch["flick"]) * 0.4 else 0.05
		else:
			k = 1.0 if n > -0.2 else 0.15
		if float(torch["flick"]) <= 0 and torch["dying"]:
			torch["on"] = false
			torch["dying"] = false
	var col := kelvin_color(float(s["kelvin"]))
	for pair in [[torch_hot, float(s["cone"]), 1.0], [torch_spill, float(s["spill"]), 0.22]]:
		var l: SpotLight3D = pair[0]
		l.light_color = col
		l.spot_range = float(s["range"])
		l.spot_angle = float(pair[1]) / 2.0
		l.light_energy = float(s["strength"]) * float(pair[2]) * k
		l.global_position = from
		if (aim_at - from).length() > 0.001:
			l.look_at(aim_at, Vector3.UP)


func torch_state() -> Dictionary:
	return {"on": torch["on"], "dead": torch["dead"], "k": torch_hot.light_energy if torch_hot != null else 0.0, "made": torch["made"]}


# ---- footsteps (steps.js) ----------------------------------------------------------------------------------------
func _pick_step(k: Dictionary, fam: String) -> String:
	var n: int = STEP_COUNT[fam]
	var prev: int = int(k.get("i", -1)) if k.get("fam") == fam else -1
	var i: int = randi() % (n - 1 if prev >= 0 else n)
	if prev >= 0 and i >= prev:
		i += 1
	k["fam"] = fam
	k["i"] = i
	return "%s_%02d" % [fam, i + 1]


func ability_steps(dt: float) -> void:
	var s := setting("steps")
	var at: Vector3 = player.pos
	var last = step_from
	var gap := clock - step_clock > 0.25
	step_from = at
	step_clock = clock
	if last == null or gap or dt == 0:
		step_at = 0.5
		return
	var d := sqrt(pow(at.x - last.x, 2) + pow(at.z - last.z, 2))
	if d > 1 or d / dt < 0.2:
		step_at = 0.5
		return
	step_at += d / float(s["crouch"] if player.crouched else (s["run"] if player.running else s["stride"]))
	if step_at < 1:
		return
	step_at -= 1
	var floor_ := floor_under()
	var fam: String = FLOOR_STEPS.get(floor_, "step_wood")
	if fam == "step_wood" and randf() < float(s["creak"]):
		fam = "step_creaky"
	var name := _pick_step(last_step, fam)
	last_step["name"] = name
	last_step["floor"] = floor_
	last_step["clock"] = clock
	step_count += 1
	shelf_sound(name, null, float(s["crouchDb"] if player.crouched else (s["runDb"] if player.running else s["db"])), floor_)


func cast_steps(dt: float) -> void:
	var s := setting("steps")
	for cid in cast_nodes:
		var g: Node3D = cast_nodes[cid]
		if not g.visible:
			continue
		var at: Vector3 = g.global_position
		var k = cast_walk.get(cid)
		if k == null or clock - float(k["clock"]) > 0.25:
			cast_walk[cid] = {"from": at, "t": 0.5, "clock": clock}
			continue
		var d := sqrt(pow(at.x - k["from"].x, 2) + pow(at.z - k["from"].z, 2))
		k["from"] = at
		k["clock"] = clock
		if dt == 0 or d > 1 or d / dt < 0.3:
			k["t"] = 0.5
			continue
		k["t"] = float(k["t"]) + d / float(s["castStride"])
		if float(k["t"]) < 1:
			continue
		k["t"] = float(k["t"]) - 1
		var floor_ := floor_under(at)
		var name := _pick_step(k, FLOOR_STEPS.get(floor_, "step_wood"))
		cast_step = {"id": cid, "name": name, "floor": floor_, "clock": clock}
		shelf_sound(name, cid, float(s["castDb"]))


# ---- the frame -----------------------------------------------------------------------------------------------------
func _process(delta: float) -> void:
	if not active or held:
		return
	tick(min(0.05, delta))


func tick(dt: float) -> void:
	clock += dt
	if lives != null:
		lives.advance(now())
		life_events()
	var p := player
	if moving != null:
		var M: Dictionary = moving
		M["t"] = float(M["t"]) + dt
		var u: float = min(1.0, float(M["t"]) / max(0.05, float(M["to"]["secs"])))
		var k := u * u * (3.0 - 2.0 * u)
		p.pos = (M["from"]["pos"] as Vector3).lerp(M["to"]["pos"], k)
		p.eye = float(M["from"]["eye"]) + (float(M["to"]["eye"]) - float(M["from"]["eye"])) * k
		p.yaw = float(M["from"]["yaw"]) + (float(M["to"]["yaw"]) - float(M["from"]["yaw"])) * k
		p.pitch = float(M["from"]["pitch"]) + (float(M["to"]["pitch"]) - float(M["from"]["pitch"])) * k
		if u >= 1.0:
			moving = null
			M["done"] = true
	if look_tween != null:
		var L: Dictionary = look_tween
		L["t"] = float(L["t"]) + dt
		var u: float = min(1.0, float(L["t"]) / float(L["secs"]))
		var k := u * u * (3.0 - 2.0 * u)
		p.yaw = float(L["y0"]) + (float(L["y1"]) - float(L["y0"])) * k
		p.pitch = float(L["p0"]) + (float(L["p1"]) - float(L["p0"])) * k
		if u >= 1.0:
			look_tween = null
	var feet: Vector3 = p.pos
	if not busy and playing == null and p.seat == null and p.hiding == null and p.sleeping == null and p.peeping == null and moving == null:
		ability_walk(dt)
		ability_crouch(dt)
		ability_steps(dt)
	p.speed = p.pos.distance_to(feet) / dt if dt > 0 else 0.0
	if active and not busy:
		cast_steps(dt)
	hud.set_stance("hidden" if p.hiding != null else ("crouched" if p.crouched else ""))
	for id in doors:
		var d: Dictionary = doors[id]
		if float(d["t"]) < 1.0:
			d["t"] = min(1.0, float(d["t"]) + dt / float(d["secs"]))
			var k := 1.0 - (1.0 - float(d["t"])) * (1.0 - float(d["t"]))
			d["deg"] = float(d["from"]) + (float(d["to"]) - float(d["from"])) * k
			swing_door(by_id[id], float(d["deg"]))
			if float(d["t"]) >= 1.0 and not d["open"]:
				emit({"type": "closed", "id": id})
	for x in lenses:
		follow_leaf(x)
	for x in latches:
		follow_leaf(x)
	for t in triggers:
		var now_in := is_in(t)
		var was: bool = inside.has(t["id"])
		if now_in and not was:
			inside[t["id"]] = true
			emit({"type": "enter", "id": t["id"]})
		if not now_in and was:
			inside.erase(t["id"])
			emit({"type": "exit", "id": t["id"]})
	if timer_left != null and has_end:
		timer_left = float(timer_left) - dt
		hud.timer(timer_left)
		if float(timer_left) <= 0:
			var to = timer_fail
			end({"to": to, "timeout": true})
	for w in waits.duplicate():
		if clock >= float(w["at"]):
			waits.erase(w)
			w["done"] = true
	var cam: Camera3D = game.camera
	var eye: Vector3 = p.peeping["at"] if p.peeping != null else eye_pos()
	cam.global_position = eye
	cam.rotation_degrees = Vector3(float(p.pitch), float(p.yaw) - 90.0, 0.0)
	var vp := get_viewport().get_visible_rect().size
	cam.fov = float(LENS["fov"]) if p.peeping != null else StoryC.vfov(float(story.game.get("fov", StoryC.FOV_H)), (vp.x / vp.y) if vp.y > 0 else 16.0 / 9.0)
	var T := clock
	for t in lights:
		var u: Dictionary = light_state[t["id"]]
		var k: float = (float(u["dim"]) if u["dim"] != null else 1.0) if (u["on"] and (powered() or not _electric(u))) else 0.0
		if u["surge"] != null and T >= float(u["surge"]):
			u["flicker"] = float(u["flicker0"]) if u["flicker0"] != null else 0.0
			u["surge"] = null
		if float(u["flicker"]) > 0:
			k *= 1.0 - float(u["flicker"]) * 0.5 * max(0.0, sin(T * 13.7) * sin(T * 7.3))
		k *= float(scene_light_k.get(t["id"], 1.0))
		t["node"].light_energy = float(u["base"]) * k
	life_lights()
	if lifefx != null:
		lifefx.update(now())
	if lifesound != null:
		lifesound.update(now())
	if physics != null:
		physics.tick(dt)
	if torch_hot != null:
		if torch_item() == null:
			torch["on"] = false
		torch_tick(dt)
	for a in anims.duplicate():
		a["t"] = float(a["t"]) + dt
		var k: float = min(1.0, float(a["t"]) / float(a["secs"]))
		a["fn"].call(k)
		if k >= 1.0:
			anims.erase(a)
			a["done"] = true
	draw_npcs(dt)
	watch(dt)
	if not busy and playing == null and p.peeping == null:
		update_cursor(dt)
	if holding != null:
		hold_tick(dt)
	emit({"type": "tick"})


## a little thing with a `light` (a candle's): lit while its state's fx has a light (the desk's lifefx)
func life_lights() -> void:
	if lives == null:
		return
	for id in lives.things:
		var d: Dictionary = lives.things[id]["d"]
		if not d.has("light") or not light_state.has(d["light"]):
			continue
		var s = lives.at(id, now())
		var lit := false
		if s != null and s["def"] != null:
			for fx in s["def"].get("fx", []):
				if fx is Dictionary and fx.get("fx") == "light":
					lit = true
		light_state[d["light"]]["on"] = lit


func kept_level() -> Dictionary:
	if not kept.has(level):
		kept[level] = {"vis": {}, "doors": {}, "bodies": {}}
	return kept[level]
