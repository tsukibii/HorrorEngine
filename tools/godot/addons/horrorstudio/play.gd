## Play mode (the desk's play/runtime.js, ported): walk the level from the player's eye, use what's there, and run a
## stitch's beats from what the player does. The runtime owns the player (feet, look, eye height), the collision with
## the level's solid blocks (its own, as the desk's: an upright circle against boxes, stepping onto low ones, so the
## two agree), the trigger volumes, doors, lights and the power, the cursor, the inventory, the cast's behaviours,
## being seen, the little things' states, the to-do list, and the stitch and the act choice that listen to it all.
extends Node

signal stitch_ended(result)
signal choice_made(option)

const StoryC := preload("res://addons/horrorstudio/story.gd")
const TorchBeam := preload("res://addons/horrorstudio/torch_beam.gd")   # the flashlight's battery and beam (FLASHLIGHT_PLAN §1)
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
	"steps": {"stride": 0.7, "run": 1.05, "crouch": 0.45, "db": -8, "runDb": -4, "crouchDb": -17, "creak": 0.08, "castStride": 0.65, "castDb": -2, "riser": 2.5},
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
var room_tones: Dictionary = {}      # this level's rooms' tones (a room's `tone`, else game.tone): beds.gd plays the one you're in
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
var stitch_now: Dictionary = {}      # the stitch playing (its beats and to-dos say who wants something: wants_from)
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
var torch := {"on": false, "dead": false, "flick": 0.0, "dying": false, "dir": null, "made": false,
	"item": null, "bat": null, "charge": 1.0, "low_at": null, "low_heard": false, "rest_t": 0.0, "rests": 2, "changing": null,
	"layers": [], "mode": null, "fl": {}}   # its battery (torch_beam.gd): the charge, when it ran low, a rest, a change of batteries; the story's timed dims and flickers
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
const MenuC := preload("res://addons/horrorstudio_ui/menu.gd")      # the saved settings (the mirrors follow the Reflections row)
const LifeSoundC := preload("res://addons/horrorstudio/lifesound.gd")
const PhysC := preload("res://addons/horrorstudio/physics.gd")
const PartsC := preload("res://addons/horrorstudio/parts.gd")     # parts that open: lids, doors, a book's cover (PROPGEN §26)
const BookC := preload("res://addons/horrorstudio/book.gd")       # a book in the hands, its pages in a hand (the `book` use)
var physics = null                   # physics.gd: the thing in the hand, the dice
var parts = null                     # parts.gd: the things' parts between shut and open
var book = null                      # book.gd: the book in the hands
var held_move = null                 # the moveable held in both hands (use: moveable), placed where aimed
var moveables: Array = []            # this level's moveables: {t, body}
const FaceC := preload("res://addons/horrorstudio/face.gd")
var faces = null                     # face.gd: the cast's expressions (`expr`), what each rests in and what plays over it
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
var on_event: Callable = Callable()       # every event as it's sent (the Director plugin's debug panel and the editor's dock)
var on_level: Callable = Callable()       # a level entered (the Director plugin starts its characters' own behaviours there)
const CollideC := preload("res://addons/horrorstudio/collide.gd")
var collide = null                        # Godot's physics for the player, the cursor and sight (game.collision: physics), else null: the boxes
var by_node: Dictionary = {}              # a thing's node -> the thing (the physics rays' hits)
var anim_players: Dictionary = {}         # a cast member's AnimationPlayer under the stand-in (their motions), null when there's none
var speaking := ""                         # the cast member whose line is up in a scene (her move `talk`)
var listening := ""                        # the one the player is answering (her move `listen`)


func setup(game_, run_, opts: Dictionary = {}) -> void:
	game = game_
	story = game.story
	hud = game.hud
	if not hud.choosing.is_connected(_on_choosing):
		hud.choosing.connect(_on_choosing)
	run = run_
	if run != null:
		flags = run["flags"]
	settings = opts.get("settings", {})
	player.eye = stand_eye()
	lives = run["lives"] if (run != null and run.has("lives")) else opts.get("lives", null)
	lives_seen = lives.changes.size() if lives != null else 0
	play_scene = opts.get("play_scene", Callable())
	on_set_time = opts.get("set_time", Callable())
	on_quit = opts.get("quit", Callable())
	todo = TodoC.new(self)
	parts = PartsC.new(self)
	book = BookC.new(self)
	if str(story.game.get("collision", "boxes")) == "physics":
		collide = CollideC.new(self)
	hud.locked(false)
	if run != null:
		for i in run.get("items", {}):
			items[i] = true


func stop() -> void:
	active = false
	listener = Callable()
	stopped = true
	focus = null
	if collide != null:
		collide.free_body()
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
## a left click while a card of words is up puts it away, like Esc: taken here, before the HUD's own controls get it
## (the card is a Control under the pointer, so it never reached _unhandled_input: the user's note, 2026-10-29)
## A thing in the hands (examine): a drag with the left button turns it, a click with no drag puts it back.
func _input(ev: InputEvent) -> void:
	if book != null and book.up() and hud != null and hud.panel_el != null and ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_LEFT:
			var vp := get_viewport().get_visible_rect().size
			book.turn(1 if ev.position.x > vp.x * 0.5 else -1)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			book.turn(1)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_UP:
			book.turn(-1)
		elif ev.button_index == MOUSE_BUTTON_RIGHT:
			hud._finish_panel(true)
		get_viewport().set_input_as_handled()
		return
	if exam != null and hud != null and hud.panel_el != null:
		if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
			if ev.pressed:
				exam["drag"] = true
				exam["moved"] = 0.0
			elif exam["drag"]:
				exam["drag"] = false
				if float(exam["moved"]) < 6.0:
					hud.panel_click()
			get_viewport().set_input_as_handled()
			return
		if ev is InputEventMouseMotion and exam["drag"] and not exam.get("lock", false):
			exam_turn(ev.relative.x, ev.relative.y)
			exam["moved"] = float(exam["moved"]) + ev.relative.length()
			get_viewport().set_input_as_handled()
			return
	if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT and hud != null and hud.panel_el != null:
		if hud.panel_click():
			get_viewport().set_input_as_handled()


func _unhandled_input(ev: InputEvent) -> void:
	if hud != null and not hud.choice_over:                 # a choice up: its keys go to it (a live scene's walking keys never did: the user's "I can't pick anything", 2026-10-30), the mouse is free for its rows
		if ev is InputEventKey:
			key_event(OS.get_keycode_string(ev.physical_keycode), ev.pressed, ev.echo)
		return
	if ev is InputEventMouseMotion and mouse_captured and (active or live_scene) and not busy:
		ability_look(ev.relative.x, ev.relative.y)
	elif live_scene and ev is InputEventKey:                   # a live scene: only the walk's keys
		var code := OS.get_keycode_string(ev.physical_keycode)
		if ["W", "A", "S", "D", "Up", "Down", "Left", "Right", "Shift", "C"].has(code):
			keys[code] = ev.pressed
			if code == "C" and player.seat == null and can("crouch"):
				var cs := setting("crouch")
				if cs["mode"] == "hold":
					player.crouched = ev.pressed
				elif ev.pressed and not ev.echo:
					player.crouched = not player.crouched
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


## a choice up: the mouse freed to hover and click its rows, the walk stopped; taken back for the look when it's done
var _captured_before_choice := false


func _on_choosing(on: bool) -> void:
	if on:
		_captured_before_choice = mouse_captured
		keys = {}
		capture_mouse(false)
	elif _captured_before_choice:
		capture_mouse(true)


func capture_mouse(on: bool) -> void:
	mouse_captured = on
	if DisplayServer.get_name() != "headless":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if on else Input.MOUSE_MODE_VISIBLE
	hud.locked(on)


## a key by its name (W, A, S, D, E, G, C, F, Shift, Space, Escape, Enter, digits...)
func key_event(code: String, down: bool, repeat: bool = false) -> void:
	if book != null and book.up() and down and ["Right", "D", "PageDown", "Down", "Space"].has(code):
		book.turn(1)
		return
	if book != null and book.up() and down and ["Left", "A", "PageUp", "Up"].has(code):
		book.turn(-1)
		return
	if examining != null and hud.panel_el != null and down and (code == "Escape" or code == "E"):
		hud._finish_panel(true)
		return
	if hud.panel_el != null:
		if down:
			hud.panel_key(code)
		return
	if down and not hud.choice_over:
		hud.choice_key(code)
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
	if down and not repeat and code == "Q":
		hand_lower(not hand_down)
	if player.hiding == null and down and not repeat and can("crouch"):
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


## the player's abilities (game.player, STORY_FORMAT §9.10: the Director's Player settings): run and crouch unless told not
func can(what: String) -> bool:
	var gp = story.game.get("player", {}) if story != null else {}
	return not (gp is Dictionary and gp.get(what) == false)


## the standing eye height (game.player.eye, 1.65 m)
func stand_eye() -> float:
	var gp = story.game.get("player", {}) if story != null else {}
	return clampf(float(gp.get("eye", StoryC.EYES["stand"])), 1.2, 2.0) if gp is Dictionary else StoryC.EYES["stand"]


func ability_walk(dt: float) -> void:
	var s := setting("walk")
	var k := keys
	var f := (1 if (k.get("W", false) or k.get("Up", false)) else 0) - (1 if (k.get("S", false) or k.get("Down", false)) else 0)
	var r := (1 if (k.get("D", false) or k.get("Right", false)) else 0) - (1 if (k.get("A", false) or k.get("Left", false)) else 0)
	player.running = can("run") and not player.crouched and bool(k.get("Shift", false)) and f > 0
	player["try_speed"] = 0.0                       # the walk asked for this frame (a moveable in the way is shoved by it, blocked or not)
	if f == 0 and r == 0:
		if collide != null:
			collide.settle(float(s["step"]))
		return
	var a := deg_to_rad(float(player.yaw))
	var ln := sqrt(float(f * f + r * r))
	var v := float(s["crouched"] if player.crouched else (s["run"] if player.running else s["speed"])) * dt / ln * focus_walk()
	if v <= 0.0:
		return
	player["try_speed"] = v * ln / dt
	player["try_dir"] = Vector3(cos(a) * f + sin(a) * r, 0.0, -sin(a) * f + cos(a) * r).normalized()
	move((cos(a) * f + sin(a) * r) * v, (-sin(a) * f + cos(a) * r) * v, s)


func ability_crouch(dt: float) -> void:
	var se := stand_eye()
	var want: float = StoryC.EYES["crouch"] * se / StoryC.EYES["stand"] if player.crouched else se
	player.eye = float(player.eye) + (want - float(player.eye)) * min(1.0, dt * float(setting("crouch")["ease"]))


# ---- the level -----------------------------------------------------------------------------------------------
## what play changed (doors, things shown or taken) is kept per level and put back
func enter_level(lid: String) -> void:
	if level == lid and game.level != null and game.level_id == lid:
		return
	stop_sfx()                                 # the old level's loops end with it
	sfx_players = []
	room_tones = {}
	var gtone = story.game.get("tone")
	for rm in story.levels.get(lid, {}).get("rooms", []):
		if rm is Dictionary and rm.has("id"):
			room_tones[str(rm["id"])] = rm.get("tone", gtone)
	focus_off("a new level")
	var first := not kept.has(lid)
	if first or game.level_id != lid:
		game.enter_level(lid, first)
	level = lid
	mains_was = null                                             # a new level: its own lights on the mains looked at again
	by_id = {}
	things = {}
	doors = {}
	solid = []
	lights = []
	sweeps = []
	leaks = []
	cast_nodes = {}
	light_state = {}
	lenses = []
	latches = []
	if not kept.has(lid):
		kept[lid] = {"vis": {}, "doors": {}, "bodies": {}, "opened": {}, "inside": {}}
	var k: Dictionary = kept[lid]
	for kk in ["opened", "inside"]:
		if not k.has(kk):
			k[kk] = {}
	held_move = null
	moveables = []
	var leak_nodes: Array = []
	for n in game.pieces():
		if n is Node3D and n.has_meta("leak"):
			leak_nodes.append(n)
		if n is FogVolume and n.has_meta("shaft"):                        # a window's light shaft (HSShaft): the beam's shader onto the export's FogVolume
			var ss = JSON.parse_string(n.get_meta("shaft"))
			if ss is Dictionary:                                              # the beam by the time of day: full by day, a little at night (a glowing box in a dark room read as a bright patch on the floor: the user, 2026-10-30)
				var tod := str(game.time_of_day) if game != null else "night"
				ss = ss.duplicate()
				ss["strength"] = float(ss.get("strength", 1.0)) * (1.0 if tod == "day" else 0.6 if tod == "dusk" else 0.25)
				ss["color"] = Color(1.0, 0.97, 0.9) if tod == "day" else Color(1.0, 0.85, 0.65) if tod == "dusk" else Color(0.72, 0.8, 1.0)   # the beam's colour: the sky's by day, amber at dusk, the moon's blue at night
			HSShaft.wear(n, ss if ss is Dictionary else {})
		if n is Node3D and n.has_meta("sweep") and not (n is Light3D):   # a car passing outside a window now and then (HSSweep)
			var sm: Dictionary = JSON.parse_string(n.get_meta("sweep"))
			sweeps.append({"room": sm.get("room"), "node": HSSweep.attach(n, sm)})
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
				light_state[p["id"]] = {"on": bool(lm.get("on", true)), "flicker": float(lm.get("flicker", 0)), "base": float(lm.get("base", LIT)), "dim": null, "surge": null, "kind": lm.get("kind", "bulb"), "room": lm.get("room")}
				light_state[p["id"]].merge(HSFlicker.of(lm, str(p["id"])), true)   # its flicker's mode, interval, rate, letters, seed (flicker.gd)
				light_own(light_state[p["id"]])
				if n.has_meta("pattern") and n is SpotLight3D:              # its pattern (caustics, leaves, blinds, clouds) drawn into the light's projector (HSPattern)
					var pm: Dictionary = JSON.parse_string(n.get_meta("pattern"))
					HSPattern.attach(n, pm, float(pm.get("distance", 3.0)))
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
	for n in leak_nodes:                                             # water running down a wall (HSLeak): the band on the room's wall below the leak, the drips
		var lm: Dictionary = JSON.parse_string(n.get_meta("leak"))
		var prefix: String = str(lm.get("room", "")) + "__wall_" + str(lm.get("wall", "n"))
		var meshes: Array = []
		for id in by_id:
			if str(id).begins_with(prefix) and by_id[id].get("mesh") != null:
				meshes.append(by_id[id]["mesh"])
		var ax: Array = lm.get("axis", [1, 0, 0])
		var inw: Array = lm.get("inward", [0, 0, 1])
		var lk := HSLeak.make(meshes, {"centre": n.global_position, "axis": Vector3(float(ax[0]), float(ax[1]), float(ax[2])), "inward": Vector3(float(inw[0]), float(inw[1]), float(inw[2])),
			"width": float(lm.get("width", 0.4)), "top": float(lm.get("top", n.global_position.y)), "bottom": float(lm.get("bottom", 0.0)), "drip": float(lm.get("drip", 2.6)), "wet": float(lm.get("wet", 0.8))})
		n.add_child(lk)
		var pid = JSON.parse_string(n.get_meta("piece")).get("id") if n.has_meta("piece") else n.name
		leaks.append({"id": pid, "room": lm.get("room"), "node": lk, "walls": meshes})
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
	parts_attach(k)

	by_node = {}
	anim_players = {}
	body_moves = {}
	for id in by_id:
		by_node[by_id[id]["node"]] = by_id[id]
	if collide != null:
		collide.make()
		for id in by_id:
			if not by_id[id]["node"].visible:
				CollideC.enable(by_id[id]["node"], false)
	lifefx = LifeFxC.new(self, game.kit_index)   # the little things' effects, on this level's things
	lifefx.attach()
	if lifesound != null:
		lifesound.stop()
	else:
		lifesound = LifeSoundC.new(self)
	panes = []
	weather_attach()
	blood_attach()
	mirror_attach()
	standin_bodies()
	if physics != null:
		physics.clear()
	physics = PhysC.new(self)
	if on_level.is_valid():
		on_level.call(lid)

func _tag(tags: Array, pre: String):
	for t in tags:
		if str(t).begins_with(pre):
			return str(t).substr(pre.length())
	return null


## a small clear disc riding a door's leaf (a peephole's lens, a latch's thumb turn): a thing of its own for the reticle,
## drawn as the desk draws it (peephole.js, latch.js): a brass ring round dark glass; a brass rose with its bar, upright
## open and across locked. The node's +y points out of the leaf's face (follow_leaf turns it by the side).
func _attach_disc(door: Dictionary, local: Vector3, side: int, id: String, use: String) -> Dictionary:
	var n := Node3D.new()
	n.name = id.replace(":", "_")
	game.level.add_child(n)
	var brass := StandardMaterial3D.new()
	brass.albedo_color = Color(0.54, 0.51, 0.45)
	brass.metallic = 0.85
	brass.roughness = 0.32
	if use == "peephole":
		var ring := MeshInstance3D.new()
		var rm := CylinderMesh.new()
		rm.top_radius = LENS["r"]
		rm.bottom_radius = LENS["r"] * 1.25
		rm.height = 0.012
		rm.radial_segments = 20
		ring.mesh = rm
		ring.material_override = brass
		n.add_child(ring)
		var glass := MeshInstance3D.new()
		var gm := CylinderMesh.new()
		gm.top_radius = LENS["r"] * 0.55
		gm.bottom_radius = LENS["r"] * 0.55
		gm.height = 0.001
		gm.radial_segments = 16
		glass.mesh = gm
		var dark := StandardMaterial3D.new()
		dark.albedo_color = Color(0.04, 0.05, 0.06)
		dark.metallic = 0.2
		dark.roughness = 0.05
		glass.material_override = dark
		glass.position = Vector3(0, 0.0065, 0)
		n.add_child(glass)
	elif use == "latch":
		var rose := MeshInstance3D.new()
		var rm := CylinderMesh.new()
		rm.top_radius = 0.024
		rm.bottom_radius = 0.027
		rm.height = 0.008
		rm.radial_segments = 24
		rose.mesh = rm
		rose.material_override = brass
		n.add_child(rose)
		var bar := MeshInstance3D.new()
		bar.name = "bar"
		var bm := BoxMesh.new()
		bm.size = Vector3(0.012, 0.016, 0.042)
		bar.mesh = bm
		bar.material_override = brass
		bar.position = Vector3(0, 0.011, 0)
		n.add_child(bar)
	if collide != null:                                  # Godot's physics: an area the cursor's ray finds, a little proud of the leaf
		var area := Area3D.new()
		area.collision_layer = CollideC.INTERACT
		area.collision_mask = 0
		area.monitoring = false
		var cs := CollisionShape3D.new()
		var bx := BoxShape3D.new()
		bx.size = Vector3(0.12, 0.024, 0.12)
		cs.shape = bx
		cs.position = Vector3(0, 0.006, 0)
		area.add_child(cs)
		n.add_child(area)
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
		place(Vector3(t["node"].global_position.x, t["node"].global_position.y if collide != null else 0.0, t["node"].global_position.z), float(t["piece"].get("yaw", 0)), 0.0)


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
	player["glide"] = 0.0
	inside = {}
	for t in triggers:
		if is_in(t):
			inside[t["id"]] = true


# ---- collision: the player is an upright circle against every solid block, stepping onto low ones ------------
func blocks() -> Array:
	var out: Array = []
	for t in solid:
		if t["node"].visible and t["use"] != "carry" and not t.get("held", false):
			out.append(t)
	return out


func extent(t: Dictionary) -> Dictionary:
	var s: Array = t["size"]
	var cy: float = t["node"].global_position.y
	if t["shape"] == "cyl" or t["shape"] == "sphere":
		return {"r": float(s[0]) / 2.0, "hy": float(s[2]) / 2.0, "cy": cy}
	return {"hx": float(s[0]) / 2.0, "hy": float(s[2]) / 2.0, "hz": float(s[1]) / 2.0, "cy": cy}


func move(dx: float, dz: float, s: Dictionary) -> void:
	var y0: float = player.pos.y
	if collide != null:
		collide.move(dx, dz, s)
		glide_step(y0, float(s["step"]))
		return
	player.pos.x += dx
	player.pos.z += dz
	for i in 3:
		push_out(s)
	var g := ground_at(player.pos, float(s["step"]))
	if g > -INF:
		player.pos.y = g
	glide_step(y0, float(s["step"]))


## a step taken (the feet moved up or down within a step, not a fall): the eye keeps its height and glides to the new
## one over a tenth of a second (every engine's stair smoothing), so a flight reads as a slope to the eye, not a
## stutter of risers; `glide` is what the eye still has to make up (eye_pos adds it), decayed in tick
func glide_step(y0: float, step: float) -> void:
	var dy: float = float(player.pos.y) - y0
	if abs(dy) < 0.004 or abs(dy) > step + 0.001:
		return
	var gl: float = clampf(float(player.get("glide", 0.0)) - dy, -step, step)
	player["glide"] = gl
	player["glide_rate"] = max(1.0, abs(gl) / 0.12)


func push_out(s: Dictionary) -> void:
	var p := player
	var r := float(s["radius"])
	var feet: float = p.pos.y
	var step: float = float(s["step"])
	var head: float = feet + float(p.eye) + 0.1
	for t in blocks():
		var e := extent(t)
		var top: float = float(e["cy"]) + float(e["hy"])
		if top <= feet + step or float(e["cy"]) - float(e["hy"]) >= head:
			continue
		var inv_t: Transform3D = t["node"].global_transform.affine_inverse()
		var L: Vector3 = inv_t * p.pos
		var px := 0.0
		var pz := 0.0
		var cx: float = 0.0
		var cz: float = 0.0
		if e.has("r"):
			var d := sqrt(L.x * L.x + L.z * L.z)
			if d >= float(e["r"]) + r:
				continue
			var k := (float(e["r"]) + r - d) / d if d > 1e-6 else 0.0
			px = L.x * k
			pz = L.z * k if d > 1e-6 else float(e["r"]) + r
			cx = L.x / d * float(e["r"]) if d > 1e-6 else 0.0          # where the circle touches the cylinder's side
			cz = L.z / d * float(e["r"]) if d > 1e-6 else 0.0
		else:
			cx = clamp(L.x, -float(e["hx"]), float(e["hx"]))
			cz = clamp(L.z, -float(e["hz"]), float(e["hz"]))
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
		if top <= feet + 2.0 * step:
			# a stair's next tread but one is in reach before the feet are on the next (a steep flight: the tread two
			# risers up stands within the radius): a block is walked onto when its top is a step above the GROUND
			# where the player touches it, not above where their feet are now (the foot of a steep stair never let
			# the player on at all, till 2026-11-05)
			var tx: float = cx + (L.x - cx) * 0.03 / max(0.03, abs(L.x - cx) + abs(L.z - cz))
			var tz: float = cz + (L.z - cz) * 0.03 / max(0.03, abs(L.x - cx) + abs(L.z - cz))
			var touch: Vector3 = t["node"].global_transform * Vector3(tx, L.y, tz)
			var ref: float = max(feet, ground_at(Vector3(touch.x, feet, touch.z), step))
			if top <= ref + step:
				continue
		var W: Vector3 = t["node"].global_transform * Vector3(L.x + px, L.y, L.z + pz)
		p.pos.x = W.x
		p.pos.z = W.z


## the feet rest on the highest top under them within a step up; `SUPPORT` out from the centre, a foot's reach: a hair's
## gap between two tops (a landing's slab and the wall it meets, 2026-11-05) is never a hole to fall through
const SUPPORT := 0.06
func ground_at(pos: Vector3, step: float) -> float:
	if collide != null:
		return collide.ground_at(pos, step)
	var best := -INF
	for t in blocks():
		var e := extent(t)
		var top := float(e["cy"]) + float(e["hy"])
		if top > pos.y + step:
			continue
		var L: Vector3 = t["node"].global_transform.affine_inverse() * pos
		var ins: bool = (sqrt(L.x * L.x + L.z * L.z) <= float(e["r"]) + SUPPORT) if e.has("r") else (abs(L.x) <= float(e["hx"]) + SUPPORT and abs(L.z) <= float(e["hz"]) + SUPPORT)
		if ins and top > best:
			best = top
	return best if best > -INF else pos.y


func floor_under(p = null) -> String:
	var pos: Vector3 = player.pos if p == null else p
	if collide != null:
		return collide.floor_under(pos)
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
	if on_event.is_valid() and ev.get("type") != "tick":
		on_event.call(ev)
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
	elif f.begins_with("res://"):                        # a sound file of the project's own (the Director plugin's sounds)
		if not game.sfx_index.has(f):
			game.sfx_index[f] = {"file": f, "loop": bool(s.get("loop", false))}
		shelf_sound(f, at)


func shelf_sound(name: String, at = null, db: float = 0.0, floor_ = null) -> Node:
	if not active:
		return null
	sounds_heard.append({"n": name, "at": at, "db": db, "clock": clock, "floor": floor_})
	if sounds_heard.size() > 400:
		sounds_heard.pop_front()
	return play_sfx(name, at, db)


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


## the story's `music`: the mood's bed (beds.gd), crossfading over `secs`; kept in the run, so a save comes back to it
func music(m, a: Dictionary = {}) -> void:
	var to = null if (m == null or str(m) == "silence") else str(m)
	if run != null:
		run["music"] = to
	if game.beds != null:
		game.beds.music(to, float(a.get("secs", 2.0)))
	hud.log("music: %s" % (to if to != null else "silence"))


## the story's `hush`: the beds down to nothing, the last half second silent, back over `back`; its seconds (to wait)
func hush(a: Dictionary) -> float:
	var secs := float(a.get("hush", a.get("quiet", 1.5)))
	hud.log("hush %.1f s" % secs)
	return game.beds.hush(secs, float(a.get("back", 6.0))) if game.beds != null else max(secs, 0.5)


## the room you're in its tone (the room tones of this level, else the game's), crossfading as you walk between them
func tone_tick() -> void:
	if game.beds == null:
		return
	var want = story.game.get("tone")
	for id in inside:
		if room_tones.has(id):
			want = room_tones[id]
			break
	game.beds.room_tone(want)


## a sound off the shelf (game/sfx/, docs/SFX.md): placed in the room when it has a place (quieter across it, from its
## side), else on the player; looping ones loop as the shelf says. Headless, the stream still loads: audio_log says
func play_sfx(name: String, at = null, db: float = 0.0) -> Node:
	var s: Dictionary = game.sfx_index.get(name, {})
	var st: AudioStream = sfx_stream(name, str(s.get("file", "")))
	var pos = sound_pos(at)
	audio_log.append({"n": name, "loaded": st != null, "at": pos})
	if audio_log.size() > 200:
		audio_log.pop_front()
	if st == null:
		return null
	var p = null
	for q in sfx_players:
		if is_instance_valid(q) and not q.playing and ((q is AudioStreamPlayer3D) == (pos != null)):
			p = q
			break
	if p == null:
		if sfx_players.size() >= 24:
			return null
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
	return p


func sfx_stream(name: String, file: String) -> AudioStream:
	if sfx_streams.has(name):
		return sfx_streams[name]
	var st: AudioStream = null
	if file != "":
		var path := file if file.begins_with("res://") else "res://game/sfx/" + file
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
	if collide != null:
		CollideC.enable(t["node"], on)
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
	var b: Transform3D = _global_base(t)
	var d: Vector3 = floor_t["node"].global_position - b.origin
	return 1 if d.dot(b.basis * Vector3(0, 0, 1)) >= 0 else -1


## a thing's resting transform in the world (its base is in its parent's space: the export's folders sit at the
## origin, a Director door sits in its room)
func _global_base(t: Dictionary) -> Transform3D:
	var par = t["node"].get_parent()
	return (par.global_transform if par is Node3D else Transform3D()) * (t["base"] as Transform3D)


func on_latch_side(id) -> bool:
	for x in latches:
		if x["door"] == id:
			var b: Transform3D = _global_base(by_id[id])
			return (player.pos - b.origin).dot(b.basis * Vector3(0, 0, 1)) * float(x["side"]) > 0
	return false


## the thumb turn's bar on each of the door's latches: upright open, across locked
func turn_latch(id) -> void:
	var d = doors.get(id)
	for x in latches:
		if x["door"] != id:
			continue
		var bar = x["node"].get_node_or_null("bar")
		if bar != null:
			bar.rotation = Vector3(0, PI / 2.0 if (d != null and d.get("latched", false)) else 0.0, 0)


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


var sweeps: Array = []               # the windows' headlight sweeps: {room, node (HSSweep)}
var leaks: Array = []                # water running down walls: {id, room, node (HSLeak)}
## the story's `sweep` action: a car passes the room's windows now
func sweep(room) -> void:
	for sw in sweeps:
		if room == null or sw["room"] == room:
			sw["node"].fire()


func sweeping(room = null) -> bool:
	return sweeps.any(func(sw): return (room == null or sw["room"] == room) and sw["node"].passing())


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
				u["surge"] = clock + 0.9                          # flickering up (light_k), then its own flicker again
				HSFlicker.on(u, clock)                           # a tube's starter clicks
	emit({"type": "power", "on": on})


func _electric(u: Dictionary) -> bool:
	return not ["candle", "fire"].has(u.get("kind"))


## a light's own flicker kept (the story's `flicker` and `mode`), its lasting state's (`b_flicker`, `b_mode`: what the
## story's lasting changes leave it at), the story's timed changes over it (`layers`) and a lasting change's fade
func light_own(u: Dictionary) -> void:
	u["own"] = {"flicker": u.get("flicker", 0.0), "mode": u.get("mode"), "on": u.get("on", true)}   # (on: as the level has it, a Director state let go)
	u["b_flicker"] = u.get("flicker", 0.0)
	u["b_mode"] = u.get("mode")
	u["layers"] = []
	u["fade"] = null
	u["s"] = 1.0 if u.get("on", true) else 0.0


## the ids of one light, or of every light in a room
func lights_of(id, room) -> Array:
	var ls: Array = []
	if id != null and str(id) != "":
		if light_state.has(id):
			ls.append(id)
	else:
		for t in lights:
			if light_state[t["id"]]["room"] == room:
				ls.append(t["id"])
	return ls


## the story's `light` (STORY_FORMAT §4), or a switch's `toggle`: `set` on, off, flicker, dim or normal; `to` how bright
## a dim is (0..1, DIM), `mode` a flicker's (the lamps' own modes), `fade` seconds to change (and to come back), `secs`
## how long. Without `secs` the change lasts: the light's own state changes, and the story's timed changes on it go (a
## switch's toggle leaves them). With `secs` it's laid over the light's own state and goes by itself after (a moment
## of dark, `lights_die`, the same): a light switched off before stays off. `on` and `normal` bring back the light's own
## brightness and flicker, undoing the story's dim and flicker (`on` switches it on too). `delay` holds a timed change
## back (the lights dying one by one)
const DIM := 0.35
func light(id, room, set_to: String, o: Dictionary = {}) -> void:
	var secs := float(o.get("secs", 0.0)) if o.get("secs") != null else 0.0
	var fade := maxf(0.0, float(o.get("over", 0.0)) if o.get("over") != null else 0.0)   # (`over`: `fade` is the screen's verb)
	var to := clampf(float(o.get("to", DIM)) if o.get("to") != null else DIM, 0.0, 1.0)
	var mode = o.get("mode") if HSFlicker.MODES.has(o.get("mode")) else null
	for lid in lights_of(id, room):
		var u: Dictionary = light_state[lid]
		var was: bool = u["on"]
		if secs > 0.0:
			var t0: float = clock + maxf(0.0, float(o.get("delay", 0.0)) if o.get("delay") != null else 0.0)
			u["layers"].append({"set": set_to, "to": to, "mode": mode, "t0": t0, "end": t0 + secs, "fade": fade})
			continue
		if set_to != "toggle":
			u["layers"].clear()
		if fade > 0.0:
			u["fade"] = {"from": float(u.get("s", 0.0)), "t0": clock, "secs": fade}
		match set_to:
			"toggle":
				u["on"] = not u["on"]
			"on", "normal":
				if set_to == "on":
					u["on"] = true
				u["dim"] = null
				u["b_flicker"] = u["own"]["flicker"]
				u["b_mode"] = u["own"]["mode"]
			"off":
				u["on"] = false
			"flicker":
				u["on"] = true
				u["b_flicker"] = maxf(0.6, float(u["b_flicker"]))
				if mode != null:
					u["b_mode"] = mode
			"dim":
				u["on"] = true
				u["dim"] = to
		if u["on"] and not was:
			HSFlicker.on(u, clock)                                   # switched on: a tube stutters on


## the story's `lights_die` (TRICKS.md §2): a room's lights, or one, out for `secs` and back as they were; `order`
## "toward": out one by one toward the player, `gap` seconds apart (0.4), the farthest first, all back together `secs`
## after the last went out. Its seconds
func lights_die(a: Dictionary) -> float:
	var secs: float = float(a.get("secs", 1)) if a.get("secs") != null else 1.0
	var ids: Array = lights_of(a.get("light"), a.get("room"))
	if str(a.get("order", "")) != "toward" or ids.size() < 2:
		light(a.get("light"), a.get("room"), "off", {"secs": secs})
		return secs
	var gap: float = float(a.get("gap", 0.4)) if a.get("gap") != null else 0.4
	var me: Vector3 = player.pos
	ids.sort_custom(func(x, y): return (by_id[x]["node"].global_position - me).length() > (by_id[y]["node"].global_position - me).length())
	var n := ids.size()
	for i in n:
		light(ids[i], null, "off", {"secs": secs + gap * (n - 1 - i), "delay": gap * i})
	return secs + gap * (n - 1)


## a timed change's weight now: 0 before it starts and after it's gone, 1 while it holds, smoothed over its fade both ways
static func layer_w(L: Dictionary, T: float) -> float:
	var fd: float = float(L["fade"])
	var a: float = clampf((T - float(L["t0"])) / fd, 0.0, 1.0) if fd > 0.0 else (1.0 if T >= float(L["t0"]) else 0.0)
	var b: float = clampf((float(L["end"]) + fd - T) / fd, 0.0, 1.0) if fd > 0.0 else (1.0 if T < float(L["end"]) else 0.0)
	return smoothstep(0.0, 1.0, minf(a, b))


## the multiplier on a light's energy now: its steady brightness (on or off, dimmed, the power) from its own state, a
## lasting change's fade and the story's timed changes over it, times its flicker (its own, the power's surge, a timed
## flicker's), the effective amount and mode kept in `flicker` and `mode` (what the checks and flicker.gd read)
func light_k(u: Dictionary, T: float) -> float:
	var lit_ok: bool = powered() or not _electric(u)
	var own_s: float = (float(u["dim"]) if u["dim"] != null else 1.0) if lit_ok else 0.0
	var s: float = own_s if u["on"] else 0.0
	var f = u.get("fade")
	if f != null:
		var x: float = (T - float(f["t0"])) / maxf(0.001, float(f["secs"]))
		if x >= 1.0:
			u["fade"] = null
		else:
			s = lerpf(float(f["from"]), s, smoothstep(0.0, 1.0, x))
	var amt: float = float(u["b_flicker"])
	var mode = u["b_mode"]
	if u["surge"] != null:
		if T >= float(u["surge"]):
			u["surge"] = null
		else:
			amt = maxf(amt, 0.8)
	var keep: Array = []
	for L in u["layers"]:
		if T >= float(L["end"]) + float(L["fade"]):
			if L["set"] == "off" and u["on"]:
				HSFlicker.on(u, T)                                   # back after the dark: a tube stutters on
			continue
		keep.append(L)
		var w := layer_w(L, T)
		if w <= 0.0:
			continue
		match str(L["set"]):
			"off":
				s = lerpf(s, 0.0, w)
			"on":
				s = lerpf(s, own_s, w)
			"dim":
				s = lerpf(s, float(L["to"]) if lit_ok else 0.0, w)
			"flicker":
				s = lerpf(s, own_s, w)
				amt = lerpf(amt, maxf(0.6, amt), w)
				if L["mode"] != null and w >= 0.5:
					mode = L["mode"]
			"normal":
				s = lerpf(s, (1.0 if lit_ok else 0.0) if u["on"] else 0.0, w)
				amt = lerpf(amt, float(u["own"]["flicker"]), w)
				if w >= 0.5:
					mode = u["own"]["mode"]
	u["layers"] = keep
	u["s"] = s
	u["flicker"] = amt
	u["mode"] = mode
	return s * HSFlicker.k(u, T)


func light_energy(id) -> float:
	var t = by_id.get(id)
	if t == null:
		return 0.0
	if t["node"] is Light3D:
		return t["node"].light_energy
	return float(light_state.get(id, {}).get("level", 0.0))   # a fitting's light: how bright the story has it


## a light with a fitting (the story's light with a `kit`; the user, 2026-10-31: "lights as furniture", no light source
## of the export's): its fitting's glass (the kit's emit surface, a material of its own) glows as bright as the light is,
## and every light the user put under the light's node follows it (switched, cut, flickering), each at its own energy
## times the light's level
func fitting_light(t: Dictionary, k: float) -> void:
	for c in t["node"].find_children("*", "Light3D", true, false):
		if not c.has_meta("hs_energy"):
			c.set_meta("hs_energy", c.light_energy)
		c.light_energy = float(c.get_meta("hs_energy")) * k
	if not t.has("glow"):
		t["glow"] = _fitting_glow(t)
	var g: Dictionary = t["glow"]
	if g.is_empty() or absf(float(g["k"]) - k) < 0.004:
		return
	g["k"] = k
	for m in g["mats"]:
		m.emission_energy_multiplier = float(g["e0"]) * k


func _fitting_glow(t: Dictionary) -> Dictionary:
	var lm = JSON.parse_string(t["node"].get_meta("light")) if t["node"].has_meta("light") else {}
	var f = by_id.get(lm.get("fitting", "") if lm is Dictionary else "")
	if f == null:
		return {}
	var mats: Array = []
	var e0 := 1.0
	for mi in f["node"].find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or mi.name == "mesh":
			continue
		for i in mi.mesh.get_surface_count():
			var m: Material = mi.get_surface_override_material(i) if mi.get_surface_override_material(i) != null else mi.mesh.surface_get_material(i)
			if m is StandardMaterial3D and (m.resource_name == "kit_emit" or mi.mesh.surface_get_name(i) == "kit_emit"):
				var own: StandardMaterial3D = m.duplicate()
				own.emission_enabled = true
				e0 = maxf(own.emission_energy_multiplier, 1.0)
				mi.set_surface_override_material(i, own)
				mats.append(own)
	return {"mats": mats, "e0": e0, "k": -1.0} if not mats.is_empty() else {}


## how bright a fitting's glass is now (0 out, 1 full; -1 no fitting): the checks
func fitting_glow(id) -> float:
	var t = by_id.get(id)
	if t == null or not t.has("glow") or (t["glow"] as Dictionary).is_empty():
		return -1.0
	return float(t["glow"]["k"])


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


## an expression on a cast member's face (STORY_FORMAT §4 `expr`: face.gd): opts loop, w, in, out, rest
func face_play(who: String, id, opts: Dictionary = {}) -> void:
	if faces == null:
		faces = FaceC.new(self)
	if not faces.play(who, cast_nodes.get(who), id, opts):
		hud.log("no face %s in the project (res://faces/: tools/face_export.mjs)" % str(id))


## looking at a thing (`use: inspect`): a small one (its longest side EXAMINE.most or less) is taken up in the hands, as
## the desk's examine.js does (DECISIONS 2026-11-01: "pick up temporarily to inspect, turn around"): the thing itself in
## front of the eye, lit by a lamp at the shoulder and drawn over the room (it's in the hands: never inside a wall), a
## drag turns it, its name and words on a card under it; Esc, E or a click (no drag) puts it back where it was. A
## bigger thing (a shelf, a wardrobe) keeps the card alone and stays where it is (the user's note, 2026-10-29). The story
## hears the `use` once it's put back, as before.
## most: the longest side taken up (m); dist: how far from the eye; up: above the eye's line; fill: its longest side in
## the hands (m); turn: radians a pixel dragged; ease: how fast it follows; light: the shoulder lamp
const EXAMINE := {"most": 0.6, "dist": 0.36, "up": 0.03, "fill": 0.14, "turn": 0.012, "ease": 12.0, "light": 1.2}
const EXAM_LAYER := 1 << 19                   # the render layer the shoulder lamp lights: the thing in the hands alone
var exam = null                               # the thing in the hands: {node, was, pivot, turner, want, lamp, drag, moved}
static var _exam_hole: Shader = null


func examine(t: Dictionary, title: String, text: String) -> void:
	examining = t
	var held := exam_small(t) and exam_up(t)
	await modal(func(): return await hud.examine({"title": title, "text": text, "held": held}))
	exam_down()
	examining = null


## small enough to take up: its longest side EXAMINE.most or less, with something to show (its model or its block)
func exam_small(t: Dictionary) -> bool:
	var sz: Array = t.get("size", [1, 1, 1])
	var m: float = max(float(sz[0]), float(sz[1]), float(sz[2]))
	var n = t.get("node")
	return m > 0.01 and m <= float(EXAMINE["most"]) and n is Node3D and (n.get_node_or_null("art") != null or n.get_node_or_null("mesh") != null)


## the thing taken up: a copy of it (its art or its block, without what isn't its look) centred in a turner, at a size the
## hands hold, in front of the eye on the camera; the thing itself hidden till it's put back. Drawn after the room: first
## its silhouette writes a depth a little behind it over whatever the room had there (the hole), then its own materials,
## their depth kept among themselves, so it's never inside a wall and its faces still hide each other
func exam_up(t: Dictionary) -> bool:
	var cam: Camera3D = game.camera
	var copy: Node3D = PhysC.copy_of(t)
	for x in copy.find_children("*", "", true, false):
		if is_instance_valid(x) and (x is Light3D or x is CollisionObject3D or x is CollisionShape3D or x is GPUParticles3D or x is CPUParticles3D
				or x is AudioStreamPlayer3D or x is Camera3D or x is Marker3D):
			x.free()
	var box: AABB = hud.bounds_of(copy)
	var mx: float = max(box.size.x, box.size.y, box.size.z)
	if cam == null or mx <= 0.0:
		copy.free()
		return false
	if _exam_hole == null:
		_exam_hole = Shader.new()
		_exam_hole.code = EXAM_HOLE
	var hole := ShaderMaterial.new()
	hole.shader = _exam_hole
	hole.render_priority = Material.RENDER_PRIORITY_MAX - 1
	for mi in copy.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
		mi.layers |= EXAM_LAYER
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var m = mi.get_active_material(i)
			mi.set_surface_override_material(i, exam_mat(m if m != null else StandardMaterial3D.new()))
		mi.material_override = null
		var h := MeshInstance3D.new()                 # the hole: the same mesh, the silhouette's depth pushed back
		h.mesh = mi.mesh
		h.skin = mi.skin
		h.skeleton = NodePath("../" + str(mi.skeleton)) if not mi.skeleton.is_empty() else NodePath()
		h.material_override = hole
		h.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		h.layers = mi.layers
		mi.add_child(h)
	copy.position = -box.get_center()
	var turner := Node3D.new()
	turner.add_child(copy)
	turner.scale = Vector3.ONE * clamp(float(EXAMINE["fill"]) / mx, 0.4, 3.0)
	var flat: bool = box.size.y <= min(box.size.x, box.size.z)     # lying flat (its thinnest side up): tilted to show its top; standing (a photo): facing you
	var want := Quaternion(Vector3.RIGHT, 0.6) if flat else Quaternion.IDENTITY
	turner.quaternion = want
	var pivot := Node3D.new()
	pivot.name = "examine"
	pivot.add_child(turner)
	pivot.position = Vector3(0, float(EXAMINE["up"]), -float(EXAMINE["dist"]))
	var lamp := OmniLight3D.new()
	lamp.light_energy = float(EXAMINE["light"])
	lamp.omni_range = 1.6
	lamp.light_color = Color(1.0, 0.95, 0.89)
	lamp.light_cull_mask = EXAM_LAYER
	lamp.position = Vector3(0.18, 0.16, -0.04)
	pivot.add_child(lamp)
	cam.add_child(pivot)
	var node: Node3D = t["node"]
	exam = {"node": node, "was": node.visible, "pivot": pivot, "turner": turner, "want": want, "from": want, "lamp": lamp, "drag": false, "moved": 0.0}
	node.visible = false                          # in the hands, not where it was
	return true


## its own copy of a material, drawn after the room (in the transparent pass, which comes after everything solid) with
## its depth written; a texture with an alpha of its own keeps its look and is drawn over instead (its alpha would show)
func exam_mat(m: Material) -> Material:
	var c: Material = m.duplicate()
	c.render_priority = Material.RENDER_PRIORITY_MAX
	if c is BaseMaterial3D:
		if c.transparency == BaseMaterial3D.TRANSPARENCY_DISABLED:
			var img: Image = c.albedo_texture.get_image() if c.albedo_texture != null else null
			if img != null and img.is_compressed():
				img.decompress()
			if img != null and img.detect_alpha() != Image.ALPHA_NONE:
				c.no_depth_test = true
			else:
				c.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		c.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_ALWAYS
	return c


const EXAM_HOLE := """shader_type spatial;
render_mode unshaded, cull_disabled, depth_test_disabled, depth_draw_always, skip_vertex_transform, shadows_disabled;
// a thing in the hands (play.gd exam_up): its silhouette's depth written a little behind it over whatever the room had
// there, pushed along each eye ray (so the same pixels), no colour; the thing drawn next is never inside a wall
void vertex() {
	VERTEX = (MODELVIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX *= 1.0 + 0.3 / max(length(VERTEX), 0.01);
	NORMAL = normalize((MODELVIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	ALBEDO = vec3(0.0);
	ALPHA = 0.0;
}
"""


## a drag: turned about the view's up (across) and its side (up and down), whatever way it's facing now
func exam_turn(dx: float, dy: float) -> void:
	if exam == null:
		return
	var w: Quaternion = exam["want"]
	w = Quaternion(Vector3.UP, dx * float(EXAMINE["turn"])) * w
	w = Quaternion(Vector3.RIGHT, dy * float(EXAMINE["turn"])) * w
	exam["want"] = w.normalized()


## how far it's turned from how it came up (radians)
func exam_angle() -> float:
	return exam["turner"].quaternion.angle_to(exam["from"]) if exam != null else 0.0


func exam_tick(dt: float) -> void:
	var tn: Node3D = exam["turner"]
	tn.quaternion = tn.quaternion.slerp(exam["want"], min(1.0, dt * float(EXAMINE["ease"])))


## put back where it was
func exam_down() -> void:
	if exam == null:
		return
	if is_instance_valid(exam["pivot"]):
		exam["pivot"].queue_free()
	if is_instance_valid(exam["node"]):
		exam["node"].visible = exam["was"]
	exam = null


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
	focus_off("ended")
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


## an item that's batteries for the flashlight (`battery`: how full a set it is, 1 a new one)
func is_battery(item) -> bool:
	var it = story.items.get(str(item), null)
	return it is Dictionary and (it.get("battery") is float or it.get("battery") is int) and float(it["battery"]) > 0.0


## the batteries in the pocket, in the order they were picked up
func batteries() -> Array:
	var out: Array = []
	for id in items:
		if is_battery(id):
			out.append(id)
	return out


func take(t: Dictionary) -> void:
	var id = t["id"]
	var d: Dictionary = t["piece"].get("d", {}) if t["piece"].get("d") is Dictionary else {}
	var k: Dictionary = kept[level]
	for e in inv:
		if e["id"] == id:
			return
	if t.get("in") != null:
		var cid = t["in"]
		contain_detach(t)
		emit({"type": "taken", "id": id, "from": cid})
	if d.has("item") and (is_torch(d["item"]) or is_battery(d["item"])):   # a flashlight or its batteries: into the pocket, not the row
		set_visible(id, false)
		k["bodies"].erase(id)
		give(d["item"])
		if is_torch(d["item"]):
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
	if hand_down and n > 0:                        # the wheel brings the thing back up before turning the row
		hand_lower(false)
		return
	if n < 2 or d == 0:
		return
	inv_at = posmod(inv_at + sign(d), n)
	inv_draw(true)


## Q: the thing in the hand lowered out of view (it stays in the row, in the hand's slot, dimmed), or raised again;
## the wheel raises it too (the user's ask, 2026-10-29: not to see what you carry when you don't want to)
var hand_down := false
func hand_lower(down: bool) -> void:
	if carried() == null:
		down = false
	hand_down = down
	if physics != null and physics.hand != null and physics.hand.get("node") != null and is_instance_valid(physics.hand["node"]):
		physics.hand["node"].visible = not down
	inv_draw(true)


func inv_toggle() -> void:
	inv_shown = not inv_shown
	inv_draw(false)


func inv_draw(peek: bool) -> void:
	var lst: Array = []
	for e in inv:
		lst.append({"id": e["id"], "name": e["name"], "model": e.get("icon")})
	hud.inventory(lst, inv_at, inv_shown, peek, hand_down)


## G: the one in the hand set down on whatever is under a spot just in front of you, facing you
func drop() -> void:
	if held_move != null:
		move_place()
		return
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


# ---- parts that open (parts.gd): lids, doors, covers; containers; moveables --------------------------------------
## the things with parts, read off their nodes once a level is in (after the kept bodies are put back); their state as
## kept (or as the story starts them, `opened`); what was put into a container back inside it; the moveables' bodies
func parts_attach(k: Dictionary) -> void:
	for id in by_id:
		var t: Dictionary = by_id[id]
		var u = t.get("use")
		if not ["open", "container", "book", "hide", "locker", "moveable"].has(u):
			continue
		var d := InteractablesC.d_of(t)
		t["parts"] = PartsC.scan(t["node"])
		var info := PartsC.info(t["node"])
		t["prop_root"] = info.get("root")
		t["inside"] = info.get("inside")
		t["pages"] = info.get("pages")
		t["parent0"] = t["node"].get_parent()
		t["contents"] = []
		var s0: float = 1.0 if bool(k["opened"].get(id, d.get("opened", false))) else 0.0
		t["open_s"] = s0
		PartsC.apply(t["parts"], s0)
		if u == "moveable":
			move_body(t, k)
	for id in k["inside"].keys():
		var rec = k["inside"][id]
		if by_id.has(id) and rec is Dictionary and by_id.has(rec.get("in")):
			contain_attach(by_id[id], by_id[rec["in"]], rec["local"])
		else:
			k["inside"].erase(id)


## true while the thing's parts are open (the `opened` condition)
func open_state(id) -> bool:
	var t = by_id.get(id)
	return t != null and float(t.get("open_s", 0.0)) > 0.5


## a thing's parts to open or shut over a moment, with their sound; the story hears `opened` or `closed` at the end
func open_set(t: Dictionary, open: bool, secs: float = -1.0) -> void:
	var id = t["id"]
	if not t.has("parts"):
		return
	var s := setting(t["use"] if InteractablesC.SETTINGS.has(t["use"]) else "open")
	var sec: float = float(s.get("secs", 0.8)) if secs < 0 else secs
	var was: bool = float(t.get("open_s", 0.0)) > 0.5
	kept[level]["opened"][id] = open
	if was != open:
		var snd := PartsC.sounds(t["parts"], t["use"])
		shelf_sound(snd["open"] if open else snd["close"], id, -3.0)
	parts.go(t, 1.0 if open else 0.0, sec)
	if sec > 0.0:
		await wait(sec)
	emit({"type": "opened" if open else "closed", "id": id})


## the story's `open` action: {open: id, to: open | shut | lock | unlock}
func open_action(id, to: String) -> void:
	var t = by_id.get(id)
	if t == null:
		hud.log("no %s to open" % id)
		return
	if to == "lock" or to == "unlock":
		t["locked"] = to == "lock"
		return
	open_set(t, to != "shut" and to != "close")


## a thing put into an open container: the one in the hand goes in, laid where the next free spot is, and stays there
## through closing, carrying and opening again (it's the container's child); the story hears `placed`
func container_put(c: Dictionary, e: Dictionary) -> bool:
	var t: Dictionary = e["thing"]
	var id = t["id"]
	var d := InteractablesC.d_of(c)
	var holds: int = int(d.get("holds", 6))
	if c["contents"].size() >= holds:
		hud.shake()
		hud.line("There's no room in it.", "", 1.4, true)
		return false
	var box = inside_of(c)
	if box == null:
		return false
	var lo: Vector3 = box[0]
	var hi: Vector3 = box[1]
	var sz: Array = t["size"]
	var w := float(sz[0])
	var dp := float(sz[1])
	var h := float(sz[2])
	var n: int = c["contents"].size()
	var cols: int = max(1, int((hi.x - lo.x) / max(w, 0.05)))
	var rows: int = max(1, int((hi.z - lo.z) / max(dp, 0.05)))
	cols = min(cols, 3)
	rows = min(rows, 3)
	var cell: int = n % cols
	var row: int = int(n / cols) % rows
	var layer: int = int(n / (cols * rows))
	var x: float = lo.x + (hi.x - lo.x) * (cell + 0.5) / cols
	var z: float = lo.z + (hi.z - lo.z) * (row + 0.5) / rows
	var y: float = lo.y + layer * (h + 0.004) + h / 2.0 + 0.002
	var yaw_world := Basis(Vector3.UP, deg_to_rad(float(player.yaw) - 90.0))
	var local := Transform3D(c["node"].global_transform.basis.inverse() * yaw_world, Vector3(x, y, z))
	contain_attach(t, c, local)
	set_visible(id, true)
	inv_remove(id)
	if e.get("item") != null:
		items.erase(e["item"])
		if run != null:
			run["items"].erase(e["item"])
	var k: Dictionary = kept[level]
	k["inside"][id] = {"in": c["id"], "local": local}
	k["bodies"].erase(id)
	shelf_sound("cloth_02", c["id"], -8.0)
	hud.log("put in %s: %s" % [name_of(c), name_of(t)])
	emit({"type": "placed", "id": id, "in": c["id"]})
	return true


## a container's inside box in its node's own space: [lo, hi], from the prop's extras (its root's space)
func inside_of(c: Dictionary) -> Variant:
	var box = c.get("inside")
	var root = c.get("prop_root")
	if box == null or root == null or not (root is Node3D):
		return null
	var lo := Vector3(float(box[0][0]), float(box[0][1]), float(box[0][2]))
	var hi := Vector3(float(box[1][0]), float(box[1][1]), float(box[1][2]))
	var to_c: Transform3D = c["node"].global_transform.affine_inverse() * root.global_transform
	var mn := Vector3(INF, INF, INF)
	var mx := Vector3(-INF, -INF, -INF)
	for cx in [lo.x, hi.x]:
		for cy in [lo.y, hi.y]:
			for cz in [lo.z, hi.z]:
				var p: Vector3 = to_c * Vector3(cx, cy, cz)
				mn = Vector3(min(mn.x, p.x), min(mn.y, p.y), min(mn.z, p.z))
				mx = Vector3(max(mx.x, p.x), max(mx.y, p.y), max(mx.z, p.z))
	return [mn, mx]


func contain_attach(t: Dictionary, c: Dictionary, local: Transform3D) -> void:
	var n: Node3D = t["node"]
	var p = n.get_parent()
	if p != c["node"]:
		if p != null:
			p.remove_child(n)
		c["node"].add_child(n)
	n.transform = local
	t["in"] = c["id"]
	if not c["contents"].has(t["id"]):
		c["contents"].append(t["id"])
	if collide != null:
		CollideC.enable(n, n.visible)


func contain_detach(t: Dictionary) -> void:
	var cid = t.get("in")
	if cid == null:
		return
	var c = by_id.get(cid)
	var n: Node3D = t["node"]
	var g: Transform3D = n.global_transform
	var p = n.get_parent()
	var home = t.get("parent0")
	if p != null and home != null and p != home:
		p.remove_child(n)
		home.add_child(n)
		n.global_transform = g
	t.erase("in")
	if c != null:
		c["contents"].erase(t["id"])
	kept[level]["inside"].erase(t["id"])


## a moveable's body: the thing under a rigid body of its size (its own colliders off), asleep till it's touched
func move_body(t: Dictionary, k: Dictionary) -> void:
	var n: Node3D = t["node"]
	var d := InteractablesC.d_of(t)
	var body := RigidBody3D.new()
	body.name = "move_" + str(t["id"])
	body.mass = float(d.get("mass", setting("moveable").get("mass", 5.0)))
	var pm := PhysicsMaterial.new()
	pm.friction = 0.65
	pm.bounce = 0.04
	body.physics_material_override = pm
	body.linear_damp = 0.9
	body.angular_damp = 1.4
	body.can_sleep = true
	body.continuous_cd = true
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	var sz: Array = t["size"]
	bs.size = Vector3(max(0.05, float(sz[0])), max(0.05, float(sz[2])), max(0.05, float(sz[1])))
	cs.shape = bs
	body.add_child(cs)
	PhysC.shapes_off(n)
	var parent = n.get_parent()
	var g: Transform3D = n.global_transform
	parent.remove_child(n)
	parent.add_child(body)
	body.global_transform = Transform3D(g.basis.orthonormalized(), g.origin)
	body.add_child(n)
	n.transform = Transform3D(Basis().scaled(g.basis.get_scale()), Vector3.ZERO)
	body.sleeping = true
	t["body"] = body
	t["rest_pos"] = g.origin
	t["awake"] = false
	moveables.append(t)


## every frame: the held one in both hands before the player, upright, facing as it was picked up; the others pushed
## when the player walks into them; where one comes to rest kept, and `moved` heard when it's not where it was
func move_tick(dt: float) -> void:
	var p := player
	var s := setting("moveable")
	for t in moveables:
		var body = t.get("body")
		if body == null or not is_instance_valid(body):
			continue
		var sz: Array = t["size"]
		var w: float = max(float(sz[0]), float(sz[1]))
		var h := float(sz[2])
		if held_move == t:
			var dist: float = float(s.get("dist", 0.5)) + w / 2.0
			var a := deg_to_rad(float(p.yaw))
			var fwd := Vector3(cos(a), 0, -sin(a))
			var pos := Vector3(p.pos.x, p.pos.y + 0.1 + h / 2.0, p.pos.z) + fwd * dist
			body.global_transform = Transform3D(Basis(Vector3.UP, deg_to_rad(float(p.yaw) + float(t.get("hold_yaw", 0.0)))), pos)
			continue
		var sp: float = max(float(p.speed), float(p.get("try_speed", 0.0)))   # the walk asked for, blocked by it or not
		if not busy and player.hiding == null and player.seat == null and sp > 0.15:
			var inv_t: Transform3D = body.global_transform.affine_inverse()
			var L: Vector3 = inv_t * p.pos
			var r := float(setting("walk").get("radius", 0.3)) + 0.06
			if abs(L.x) < float(sz[0]) / 2.0 + r and abs(L.z) < float(sz[1]) / 2.0 + r and p.pos.y < body.global_position.y + h / 2.0 and p.pos.y + 1.7 > body.global_position.y - h / 2.0:
				var away: Vector3 = body.global_position - p.pos
				away.y = 0
				var dir: Vector3 = p.get("try_dir", away)
				if away.length() > 1e-4 and dir.dot(away.normalized()) > 0.2:   # walking into it, not away along it
					away = away.normalized()
					# a shove, not a kick: brought up toward a share of the walking speed, a bit of it each frame, applied
					# about hip height so a light chair can tip and a crate just slides
					var want: float = clamp(sp, 0.5, 2.2) * 0.7
					var have: float = Vector3(body.linear_velocity.x, 0, body.linear_velocity.z).dot(away)
					if have < want:
						var push: float = (want - have) * float(body.mass) * 0.35
						var at_y: float = clamp(p.pos.y + 0.85 - body.global_position.y, -h / 2.0, h / 2.0) * 0.5
						body.sleeping = false
						body.apply_impulse(away * push, Vector3(0, at_y, 0))
		if body.sleeping:
			if t.get("awake", false):
				t["awake"] = false
				kept[level]["bodies"][t["id"]] = body.global_transform
				if body.global_position.distance_to(t["rest_pos"]) > 0.12 or abs(body.global_transform.basis.y.y) < 0.8:
					t["rest_pos"] = body.global_position
					emit({"type": "moved", "id": t["id"]})
		else:
			t["awake"] = true


## picked up into both hands: upright, the way it faced relative to the player kept
func move_pick(t: Dictionary) -> void:
	var body = t.get("body")
	if body == null or held_move != null:
		return
	body.freeze_mode = RigidBody3D.FREEZE_MODE_KINEMATIC
	body.freeze = true
	body.linear_velocity = Vector3.ZERO
	body.angular_velocity = Vector3.ZERO
	body.collision_layer = 0
	var yaw_now: float = rad_to_deg(atan2(-body.global_transform.basis.z.x, body.global_transform.basis.z.z))
	t["hold_yaw"] = rad_to_deg(body.global_transform.basis.get_euler().y) - float(player.yaw)
	t["held"] = true
	held_move = t
	shelf_sound("cloth_03", t["id"], -10.0)
	hud.log("picked up: %s" % name_of(t))
	emit({"type": "carry", "id": t["id"]})


## put down where the player aims, upright, facing as held; off a surface it falls
func move_place() -> void:
	var t = held_move
	if t == null:
		return
	var body = t["body"]
	var sz: Array = t["size"]
	var h := float(sz[2])
	var w: float = max(float(sz[0]), float(sz[1]))
	var cam: Camera3D = game.camera
	var dir: Vector3 = -cam.global_transform.basis.z
	var hit = null
	if collide != null:
		hit = collide.ray(cam.global_position, dir, 3.0)
	else:
		var among: Array = []
		for b in blocks():
			if b != t:
				among.append(b)
		hit = ray_hit(cam.global_position, dir, 3.0, among)
	var pos: Vector3
	var falls := false
	if hit == null and dir.y < -0.05:                  # nothing in the way: the floor where the look meets it
		var gy := ground_at(Vector3(player.pos.x, player.pos.y + 1.2, player.pos.z), 1.2)
		if gy == -INF:
			gy = player.pos.y
		var tt: float = (gy - cam.global_position.y) / dir.y
		if tt > 0.0 and tt <= 3.0:
			hit = {"point": cam.global_position + dir * tt}
	if hit != null and hit.get("point") != null:
		var pt: Vector3 = hit["point"]
		var back: Vector3 = dir
		back.y = 0
		pos = Vector3(pt.x, pt.y, pt.z) - back.normalized() * (w * 0.5) + Vector3(0, h / 2.0 + 0.01, 0)
		if dir.y > -0.2:                               # aimed at a wall or ahead: at its foot, on the floor under it
			var g := ground_at(Vector3(pos.x, player.pos.y + 1.2, pos.z), 1.2)
			pos.y = (g if g > -INF else player.pos.y) + h / 2.0 + 0.01
	else:
		pos = body.global_position
		falls = true
	body.global_transform = Transform3D(body.global_transform.basis, pos)
	body.freeze = false
	body.collision_layer = 1
	body.linear_velocity = Vector3.ZERO
	body.angular_velocity = Vector3.ZERO
	body.sleeping = not falls
	t["held"] = false
	t["awake"] = falls
	t["rest_pos"] = pos                            # where it's put is where it rests: `moved` only once it's shoved from here
	held_move = null
	kept[level]["bodies"][t["id"]] = body.global_transform
	shelf_sound("thud_wood_03", t["id"], -12.0)
	var ins: Array = []
	for tr in triggers:
		if point_in(tr, pos.x, -pos.z, pos.y):
			ins.append(tr["id"])
	hud.log("put down: %s" % name_of(t))
	emit({"type": "dropped", "id": t["id"], "in": ins})


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
	player["seat_yaw"] = float(player.yaw) + 180.0      # the way the seat faces: a live scene's look is 90° either side of it
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
	if t.get("parts", []).size():                 # a closet: its doors open, the player steps in, the doors shut behind them
		await open_set(t, true)
	await tween({"pos": Vector3(at.x, player.pos.y, at.z), "eye": s["eye"], "yaw": yaw, "pitch": 0.0, "secs": s["secs"]})
	if t.get("parts", []).size():
		await open_set(t, false)
	emit({"type": "hidden", "id": id})


func unhide(s: Dictionary) -> void:
	var st = player.stood
	var ht = by_id.get(player.hiding) if player.hiding != null else null
	if ht != null and ht.get("parts", []).size():
		await open_set(ht, true)
	leave_hiding()
	if st != null:
		await tween({"pos": st["pos"], "eye": st["eye"], "yaw": player.yaw, "pitch": player.pitch, "secs": s["secs"]})
	if ht != null and ht.get("parts", []).size():
		await open_set(ht, false)


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
		points.append({"pos": spot_pos(t), "yaw": float(t["piece"].get("yaw", 0)), "wait": float(q.get("wait", 0)), "pose": q.get("pose"), "check": q.get("check"),
			"clip": q.get("clip")})
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
		"level": npc["level"] if npc != null else level, "pose": "idle", "walking": false, "t0": clock,
		"prev_pose": str(npc.get("pose", "")) if npc != null else "sit"}   # (one who's just come in doesn't sit down: she's there)
	var seated: bool = npc != null and str(npc.get("pose", "")) == "sit" and as_ != "sit"
	if npc != null and (seated or spec.get("leave") != null):   # getting up first (her stand_up, or the behaviour's `leave`), once, then off
		var c = spec["leave"] if spec.get("leave") != null else move_of(str(cid), "stand_up")
		var secs := move_secs(str(cid), c)
		if secs > 0.0:
			n["once"] = {"clip": c, "until": clock + secs}
			n["hold"] = clock + secs
			n["pose"] = "sit" if seated else str(npc.get("pose", "idle"))
	npcs[cid] = n
	if n.has("hold"):
		n["start_at"] = n["hold"]                         # the behaviour starts once she's up
		return
	BehavioursC.start(as_, n, self, n["s"])


## a cast member's moves (STORY_FORMAT §2 cast `moves`: role -> motion), each role falling back to another she has, so a
## game always plays: run to walk; sitting, talk, listen and look_around to idle; sit_down and stand_up to nothing
const MOVE_FALLBACK := {"run": "walk", "sitting": "idle", "talk": "idle", "listen": "idle", "look_around": "idle"}
const RUN_SPEED := 2.2                     # m/s: a behaviour this fast plays her run (STORY_FORMAT §2 `moves`)
const LOOK_POSES := ["look", "search", "check"]   # a route point's pose where she looks round (her look_around)


## A body's own clips (DECISIONS 2026-11-13, animation v2: "director tool will use the animations the model comes with
## rather than the current ones"): a character baked by the Animator (docs/ANIMATOR_V2.md) carries her idle, walk, run
## and sitting in her own .glb, made from her body. A role the cast gives no motion plays her own clip for it. The names
## as the file has them (read at run time) and as the editor's importer leaves them (a loop's "_loop" taken off)
const BODY_MOVES := {"idle": ["idle_loop", "idle"], "walk": ["walk_loop", "walk"], "run": ["run_loop", "run"], "sitting": ["sit_loop", "sit"],
	"sit_down": ["sit_down"], "stand_up": ["stand_up"]}
var body_moves: Dictionary = {}            # cid|role -> her own clip's name ("": she has none)


## the motion a role plays on her: her own move, else her body's own clip for it, else what it falls back to (`fall`
## false: hers only), else null
func move_of(cid: String, role: String, fall: bool = true) -> Variant:
	var mv = story.cast.get(cid, {}).get("moves") if story.cast.get(cid) is Dictionary else null
	var r := role
	while r != "":
		if mv is Dictionary and str(mv.get(r, "")) != "":
			return str(mv[r])
		var own := body_move(cid, r)
		if own != "":
			return own
		r = str(MOVE_FALLBACK.get(r, "")) if fall else ""
	return null


## her body's own clip for a role ("": none), found once
func body_move(cid: String, role: String) -> String:
	if not BODY_MOVES.has(role) or not cast_nodes.has(cid):
		return ""
	var key := cid + "|" + role
	if body_moves.has(key):
		return body_moves[key]
	var got := ""
	for nm in BODY_MOVES[role]:
		if player_with(cast_nodes[cid], nm) != null:
			got = nm
			break
	body_moves[key] = got
	return got


## what the Animator wrote of a body's clips (on its skin's node, from the .glb): how fast its walk travels; or {}
func body_record(node: Node) -> Dictionary:
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if mi.has_meta("extras"):
			var ex = mi.get_meta("extras")
			if ex is Dictionary and ex.get("hsMotion") is Dictionary:
				return ex["hsMotion"]
	return {}


## what a cast member plays now, [motion, loops] (STORY_FORMAT §4 behave's `motion` and `rest`, §2 her `moves`): a move
## begun once (sitting down, getting up) till it ends; walking, the behaviour's motion or her walk (her run when it's
## fast); at a route's wait that looks round, her look_around; the behaviour's `rest` while she isn't walking; sitting,
## the behaviour's motion or her sitting; her talk while her line is up, her listen while the player answers her; the
## behaviour's motion; her idle
func npc_want(cid: String, n: Dictionary) -> Array:
	var once = n.get("once")
	if once is Dictionary and clock < float(once["until"]):
		return [once["clip"], false]
	var s: Dictionary = n["s"]
	if bool(n.get("walking", false)):
		if s.get("walk") != null:                      # this behaviour's own walk (On stage's "walks with…")
			return [s["walk"], true]
		return [s["motion"] if s.get("motion") != null else move_of(cid, "run" if float(s.get("speed", 1.1)) >= RUN_SPEED else "walk"), true]
	var st: Dictionary = n["st"]
	if float(st.get("wait", 0.0)) > 0.0 and st.get("clip") != null:   # a route's stop with a clip of its own (she looks round there)
		return [st["clip"], true]
	if float(st.get("wait", 0.0)) > 0.0 and str(st.get("pose", "")) in LOOK_POSES and move_of(cid, "look_around", false) != null:
		return [move_of(cid, "look_around"), true]
	if s.get("rest") != null:
		return [s["rest"], true]
	if str(n.get("pose", "")) == "sit":
		return [s["motion"] if s.get("motion") != null else move_of(cid, "sitting"), true]
	for k in [["talk", speaking], ["listen", listening]]:
		if k[1] == cid and move_of(cid, k[0], false) != null:
			return [move_of(cid, k[0]), true]
	return [s["motion"] if s.get("motion") != null else move_of(cid, "idle"), true]


# ---- a cutscene in the level: the soft lock (STORY_FORMAT §4 `focus`; docs/GODOT_ANIMATION_PLAN.md step 7) ---------
## the user (DECISIONS 2026-11-02, night): no black bars, no skipping, everything as if it happens in your gameplay; the
## view turned onto what the scene is about, then helped to stay on it (a cone to look round in, drawn back when it
## drifts out of it), a lean in or a held focus if it asks for one; and a safety release, so no glitch can keep the
## player in it: its `max` (20 s, 60 at most), the target gone (hidden, out of the level), an ending, a new level, the
## run stopped, or `{"focus": ""}` (the Director's cutscene moment ends with it). cone: its width (degrees, the pitch
## 0.6 of it); pull: how fast the view is drawn back (1/s); ease: seconds the lean and the zoom take in and out; slow:
## the walk's pace while it holds; turn: at most this long it first turns the view onto it (the same pull, to its
## middle), before the cone holds it
const FOCUS := {"cone": 50.0, "pull": 5.0, "ease": 1.0, "max": 20.0, "most": 60.0, "slow": 0.35, "turn": 1.5}
var focus = null                              # {id, cone, push, zoom, walk, until, k (its lean and zoom, eased), going, turning}
var last_focus = null                         # the last one let go: {id, why, clock} (the checks read it)


## the view held on `id` (a cast member, a thing, a spot): a = the action's cone, push, zoom, walk (free, slow, held), max
func focus_on(id, a: Dictionary = {}) -> void:
	if id == null or str(id) == "":
		focus_off("released")
		return
	focus = {"id": str(id), "cone": clampf(float(a.get("cone", FOCUS["cone"])), 10.0, 170.0), "push": clampf(float(a.get("push", 0.0)), 0.0, 0.35),
		"zoom": clampf(float(a.get("zoom", 0.0)), 0.0, 0.15), "walk": str(a.get("walk", "slow")),
		"until": clock + clampf(float(a.get("max", FOCUS["max"])), 0.5, float(FOCUS["most"])), "k": float(focus["k"]) if focus is Dictionary else 0.0,
		"going": "", "since": clock, "turning": true}
	hud.log("the view held on %s" % id)


## let go (its lean and zoom ease back out): released by the story, `safety` (its max), `gone` (its target), an ending
func focus_off(why: String) -> void:
	if focus is Dictionary and str(focus["going"]) == "":
		focus["going"] = why
		last_focus = {"id": focus["id"], "why": why, "clock": clock}
		hud.log("the view let go (%s)" % why)


## where it looks: a cast member's eyes, a thing's middle, a spot at eye height; null when it's gone
func focus_at(id: String) -> Variant:
	var n = npcs.get(id)
	if n != null:
		if n["pos"] == null or n["level"] != level or (cast_nodes.has(id) and not cast_nodes[id].visible):
			return null
		var c = story.cast.get(id)
		var up := 0.62 if str(n.get("pose", "")) == "sit" else 0.93     # her eyes, standing or seated
		return (n["pos"] as Vector3) + Vector3(0, (float(c.get("height", 1.7)) if c is Dictionary else 1.7) * up, 0)
	var t = by_id.get(id)
	if t != null:
		return middle_of(t) if t["node"].is_visible_in_tree() else null
	var sp = things.get(id)
	if sp != null:
		return spot_pos(sp) + Vector3(0, float(player.eye), 0)
	return null


## each frame: let go when it's over (max, gone, the run not on); else the view drawn back into its cone
func focus_tick(dt: float) -> void:
	var F: Dictionary = focus
	if str(F["going"]) == "":
		if clock >= float(F["until"]):
			focus_off("safety")
		elif not active:
			focus_off("ended")
		elif focus_at(str(F["id"])) == null:
			focus_off("gone")
	var going := str(F["going"]) != ""
	F["k"] = move_toward(float(F["k"]), 0.0 if going else 1.0, dt / float(FOCUS["ease"]))
	if going:
		if float(F["k"]) <= 0.0:
			focus = null
		return
	var d: Vector3 = (focus_at(str(F["id"])) as Vector3) - eye_pos()
	var want_yaw := rad_to_deg(atan2(-d.z, d.x))
	var want_pitch := rad_to_deg(atan2(d.y, Vector2(d.x, d.z).length()))
	var half := float(F["cone"]) / 2.0
	var pull := 1.0 - exp(-float(FOCUS["pull"]) * dt)
	var dy := fposmod(want_yaw - float(player.yaw) + 180.0, 360.0) - 180.0
	if bool(F["turning"]):                          # first the view turned onto it, as a look does; then held in its cone
		half = 0.0
		if (absf(dy) < 2.0 and absf(want_pitch - float(player.pitch)) < 2.0) or clock - float(F["since"]) > FOCUS["turn"]:
			F["turning"] = false
	if absf(dy) > half:
		player.yaw = float(player.yaw) + signf(dy) * (absf(dy) - half) * pull
	var dp := want_pitch - float(player.pitch)
	if absf(dp) > half * 0.6:
		player.pitch = float(player.pitch) + signf(dp) * (absf(dp) - half * 0.6) * pull


## the walk's pace while it holds: slow (FOCUS.slow), held (0) or free (1)
func focus_walk() -> float:
	if not (focus is Dictionary) or str(focus["going"]) != "":
		return 1.0
	match str(focus["walk"]):
		"held":
			return 0.0
		"free":
			return 1.0
	return float(FOCUS["slow"])


## the lean in toward it (`push` metres, eased) and the held focus (`zoom`, the view narrowed by up to 15 %)
func focus_lean() -> Vector3:
	if not (focus is Dictionary) or float(focus["push"]) <= 0.0:
		return Vector3.ZERO
	var at = focus_at(str(focus["id"]))
	if at == null:
		return Vector3.ZERO
	var d: Vector3 = (at as Vector3) - eye_pos()
	return d.normalized() * minf(float(focus["push"]), d.length() * 0.5) * float(focus["k"])


func focus_zoom() -> float:
	return float(focus["zoom"]) * float(focus["k"]) if focus is Dictionary else 0.0


## a cast member's reaction (the story's `anim`, STORY_FORMAT §4; her `caught` move): a clip played once, her behaviour
## held where she is while it plays (she stops walking; it goes on after), turned to `face` (`player`, a thing or a cast
## member) if it's given and back the way she was after; with no clip she only turns, for `secs` (REACT_SECS). `secs`
## also cuts the clip short or holds its last frame. Its seconds, 0 when there's nothing to play
const REACT_SECS := 2.5
func react(cid: String, clip, face = null, secs: float = 0.0) -> float:
	var n = npcs.get(cid)
	if n == null:
		return 0.0
	var c = clip if clip != null and str(clip) != "" else null
	var len_ := move_secs(cid, c) if c != null else 0.0
	var t := secs if secs > 0.0 else (len_ if len_ > 0.0 else (REACT_SECS if face != null and str(face) != "" else 0.0))
	if t <= 0.0:
		return 0.0
	if len_ > 0.0:
		n["once"] = {"clip": str(c), "until": clock + t}
	var was = n.get("react")
	n["react"] = {"until": clock + t, "face": face if face != null and str(face) != "" else null, "clip": c,
		"yaw0": float(was["yaw0"]) if was is Dictionary else float(n["yaw"])}
	n.erase("turn_back")
	return t


## while a reaction plays: her behaviour held (not walking), turned to what it faces; true while it holds. Once it's
## over she turns back the way she was (draw_npcs' turn_back)
func react_hold(n: Dictionary, dt: float) -> bool:
	var rc = n.get("react")
	if not (rc is Dictionary):
		return false
	if clock >= float(rc["until"]):
		n.erase("react")
		if rc.get("face") != null:
			n["turn_back"] = float(rc["yaw0"])
		return false
	n["walking"] = false
	if rc.get("face") != null:
		BehavioursC.face_thing(n, self, {"face": rc["face"]}, dt)
	return true


## a once-only move's seconds on her (sitting down, getting up: its animation's length), 0 when she hasn't got it; a
## thing's too (a jumpscare's figure that isn't in play: its own AnimationPlayer)
func move_secs(cid: String, clip) -> float:
	var node = cast_nodes.get(cid)
	if node == null and by_id.has(cid):
		node = by_id[cid]["node"]
	if clip == null or node == null:
		return 0.0
	var ap := player_with(node, str(clip))
	var a: Animation = ap.get_animation(anim_name(ap, str(clip))) if ap != null else null
	return a.length if a != null else 0.0


## her sitting down begun (her sit_down, once): the moment her pose becomes a seat's from standing; a `go`'s arrival
## plays the behaviour's `arrive` once (On stage's "arrives with…") instead
func npc_seated(cid: String, n: Dictionary) -> void:
	var pose := str(n.get("pose", ""))
	if pose == "sit" and str(n.get("prev_pose", "sit")) != "sit":
		var c = move_of(cid, "sit_down")
		var secs := move_secs(cid, c)
		if secs > 0.0:
			n["once"] = {"clip": c, "until": clock + secs}
	n["prev_pose"] = pose
	if n["s"].get("arrive") != null and n["st"].get("arrived") != null and not n.has("arrive_done"):
		n["arrive_done"] = true
		var secs2 := move_secs(cid, n["s"]["arrive"])
		if secs2 > 0.0:
			n["once"] = {"clip": n["s"]["arrive"], "until": clock + secs2}


## a cast member's motion: npc_want's, the animation of that name on the AnimationPlayer under her stand-in (a Director
## character's Kimodo motions, GODOT_DIRECTOR §6; an export's stand-ins have none yet, so nothing plays there), looped
## unless it's a move played once
func npc_motion(cid: String, n: Dictionary, node: Node3D) -> void:
	var w := npc_want(cid, n)
	var want = w[0]
	if want == null:
		return
	var key := cid + "|" + str(want)
	var ap = anim_players.get(key, false)
	if ap is bool:
		ap = player_with(node, str(want))
		anim_players[key] = ap
	if ap == null:
		return
	var nm := anim_name(ap, str(want))
	if nm != "" and ap.current_animation != nm:
		var a: Animation = ap.get_animation(nm)
		if a != null:
			if bool(w[1]) and a.loop_mode == Animation.LOOP_NONE:
				a.loop_mode = Animation.LOOP_LINEAR          # a behaviour's motion loops (a copy in memory: the file stays as it is)
			elif not bool(w[1]):
				a.loop_mode = Animation.LOOP_NONE            # a move played once (sitting down, getting up)
		ap.play(nm, 0.3)
	# her own walk keeps step with how fast she's really going (the Animator says how fast it travels as made)
	var pace := 1.0
	if bool(n.get("walking", false)) and nm != "":
		var info: Dictionary = (body_record(node).get("clips", {}) as Dictionary).get(str(want) if str(want).ends_with("_loop") else str(want) + "_loop", {})
		if float(info.get("speed", 0.0)) > 0.05:
			pace = clampf(float((n["s"] as Dictionary).get("speed", 1.1)) / float(info["speed"]), 0.4, 2.2)
	if ap.speed_scale != pace:
		ap.speed_scale = pace


## the AnimationPlayer under a node that has a motion (a model's own player and the Kimodo imports' can both be there)
static func player_with(node: Node, name: String) -> AnimationPlayer:
	for ap in node.find_children("*", "AnimationPlayer", true, false):
		if anim_name(ap, name) != "":
			return ap
	return null


## an animation by its motion's name on a player: itself, or in any of its libraries (the Kimodo imports' `kimodo/`)
static func anim_name(ap: AnimationPlayer, name: String) -> String:
	if ap.has_animation(name):
		return name
	for lib in ap.get_animation_library_list():
		if ap.has_animation(str(lib) + "/" + name):
			return str(lib) + "/" + name
	return ""


## the story's `anim` (STORY_FORMAT §4): a cast member or a thing plays a motion once (`clip`), back to her behaviour's
## after; `wait: true` holds the beat till it ends. A cast member in play reacts (`react`: held, turned to `face`, for
## `secs`); one who isn't (a jumpscare's figure) and a thing play it on their AnimationPlayer
func play_motion(who, clip, hold_beat: bool = false, opts: Dictionary = {}) -> void:
	if npcs.has(who):
		var t := react(str(who), clip, opts.get("face"), float(opts.get("secs", 0.0)))
		if t <= 0.0:
			hud.log("anim: %s has no motion %s" % [who, clip])
		elif hold_beat:
			await wait(t)
		return
	var node = cast_nodes.get(who)
	if node == null and by_id.has(who):
		node = by_id[who]["node"]
	if node == null:
		hud.log("anim: no %s here" % who)
		return
	var ap: AnimationPlayer = player_with(node, str(clip))
	if ap == null:
		hud.log("anim: %s has no motion %s" % [who, clip])
		return
	var nm := anim_name(ap, str(clip))
	ap.play(nm, 0.2)
	if hold_beat:
		var a: Animation = ap.get_animation(nm)
		await wait(a.length if a != null else 1.0)


## the story's `move` (STORY_FORMAT §4): a placed thing, a cast member or the player (`player`) to a spot, facing its way
func move_thing(id, to) -> void:
	var sp = things.get(to)
	if sp == null:
		hud.log("move: no spot %s" % to)
		return
	var at: Vector3 = sp["node"].global_position
	var yaw := float(sp["piece"].get("yaw", 0))
	if str(id) == "player":
		player.seat = null
		leave_hiding()
		unpeep()
		moving = null
		place(Vector3(at.x, at.y if collide != null else 0.0, at.z), yaw, 0.0)
		return
	if npcs.has(id):
		npcs[id]["pos"] = at
		npcs[id]["yaw"] = yaw
		return
	var t = by_id.get(id)
	if t == null:
		hud.log("move: no %s here" % id)
		return
	t["node"].global_position = at
	t["base"] = t["node"].transform
	kept_level()["bodies"][id] = t["node"].global_transform


func draw_npcs(dt: float) -> void:
	for cid in npcs:
		var n: Dictionary = npcs[cid]
		if n.has("start_at"):                         # getting up: the behaviour waits for her
			if clock < float(n["start_at"]):
				var node0 = cast_nodes.get(cid)
				if node0 != null and node0.visible:
					npc_motion(str(cid), n, node0)
				continue
			n.erase("start_at")
			n["pose"] = "idle"
			n["prev_pose"] = "idle"
			BehavioursC.start(n["as"], n, self, n["s"])
		if not react_hold(n, dt) and not beam_hold(n, dt):   # a reaction (the story's `anim`, her caught, the light on her): her behaviour waits for it
			BehavioursC.update(n["as"], n, self, dt, n["s"])
			if n.has("turn_back"):                     # turned back the way she was once it's over (a behaviour that faces or walks sees to it)
				if bool(n.get("walking", false)) or n["s"].get("face") != null or BehavioursC.turn_to(n, float(n["turn_back"]), dt):
					n.erase("turn_back")
		npc_seated(str(cid), n)
		var node = cast_nodes.get(cid)
		if node == null:
			continue
		if baked_cast.has(cid):           # a scene's recorded body stands in for the stand-in while the bake plays
			node.visible = false
			continue
		node.visible = n["pos"] != null and n["level"] == level and not bool(n.get("vanished", false))   # (gone in the light: her `beam` vanishes)
		if collide != null and (not node.has_meta("hs_collides") or node.get_meta("hs_collides") != node.visible):   # Godot's physics: she stops the player and takes the click only while she's there
			CollideC.enable(node, node.visible)
			node.set_meta("hs_collides", node.visible)
		if not node.visible:
			continue
		node.global_position = n["pos"]
		node.global_rotation_degrees = Vector3(0, float(n["yaw"]) + 90.0, 0)
		npc_motion(str(cid), n, node)


# ---- what feels the flashlight's beam (FLASHLIGHT_PLAN §2, DECISIONS 2026-11-07) -------------------------------------
## each cast member (and each thing a `lit` or `flashed` trigger names) tested against the beam every frame: in its
## reach, in its cone (the hot cone whole, the spill a fifth), whole within a third of the reach and fading to its end,
## nothing in between (a ray to her chest and one to her head); `lit` how strongly (0..1, times the beam's brightness:
## a dying battery scares less), `lit_for` the seconds at her `bright` or more, `flashes` the times the beam landed on
## her. Her `beam` (the cast's, or a `beam` action's over it) says what she does: nothing, backs_off, freezes, flees,
## vanishes, covers, comes, charges. Her `near` (metres) makes the flashlight (`near_torch`) and the lamps
## (`near_lamps`) flicker, dim or die by her, more the nearer she is
const BEAM := {"does": "nothing", "after": 0.4, "bright": 0.3, "dist": 2.5, "speed": 1.6, "keep": 4.0, "near": 0.0, "near_torch": "none", "near_lamps": "none"}
const BEAM_DOES := ["nothing", "backs_off", "freezes", "flees", "vanishes", "covers", "comes", "charges"]
var beam_st := {}                   # cid or thing id -> {lit, lit_for, prev, flashes, react, wait_unlit}
var beam_over := {}                 # cid -> a `beam` action's settings over her cast's
var lit_ids := {}                   # things (not the cast) a lit or flashed trigger names: watched too
var near_light_k := {}              # light id -> its multiplier from someone near it (her near_lamps)
var near_torch_k := 1.0
var near_fl := {}                   # cid -> the flicker state of her presence (flicker.gd's)


## her light settings now: the cast's `beam` with a `beam` action's over it; null when she has none
func beam_cfg(cid) -> Variant:
	var c = story.cast.get(str(cid), {})
	var b = c.get("beam") if c is Dictionary else null
	var o = beam_over.get(str(cid))
	if not (b is Dictionary) and not (o is Dictionary):
		return null
	var out := BEAM.duplicate()
	for src in [b, o]:
		if src is Dictionary:
			for k in src:
				out[k] = src[k]
	return out


## the story's `beam` action: her light settings changed from now (a field left out stays as it was)
func beam_set(cid, a: Dictionary) -> void:
	var cur: Dictionary = beam_over.get(str(cid), {}).duplicate() if beam_over.get(str(cid)) is Dictionary else {}
	for k in a:
		if k != "beam":
			cur[k] = a[k]
	beam_over[str(cid)] = cur
	var b = beam_st.get(str(cid))
	if b is Dictionary and b.get("react") != null:
		beam_end(str(cid), false)


## the beam's strength at a point (0..1): its reach, its cone, the fall-off and a clear way to it
func beam_at(p: Vector3) -> float:
	if torch_hot == null or not torch["on"] or player.peeping != null or not torch.has("from"):
		return 0.0
	var kb: float = float(torch.get("k", 0.0))
	if kb <= 0.0:
		return 0.0
	var from: Vector3 = torch["from"]
	var d := p - from
	var dist := d.length()
	var reach: float = float(torch["reach_m"])
	if dist < 0.01 or dist > reach:
		return 0.0
	var ang := rad_to_deg(acos(clampf((torch["aim"] as Vector3).dot(d / dist), -1.0, 1.0)))
	var cone_k := 1.0 if ang <= float(torch["cone"]) / 2.0 else (0.2 if ang <= float(torch["spill"]) / 2.0 else 0.0)
	if cone_k <= 0.0:
		return 0.0
	var dist_k := 1.0 if dist <= reach / 3.0 else clampf(1.0 - (dist - reach / 3.0) / (reach * 2.0 / 3.0), 0.0, 1.0)
	var hit = ray_hit(from, d / dist, dist, blocks())
	if hit != null and float(hit["dist"]) < dist - 0.25:
		return 0.0
	return cone_k * dist_k * minf(1.0, kb)


## how strongly the beam's on someone or something now, and for how long (the triggers `lit`, `flashed`)
func lit_now(id) -> float:
	var b = beam_st.get(str(id))
	return float(b["lit"]) if b is Dictionary else 0.0


func lit_for(id) -> float:
	var b = beam_st.get(str(id))
	return float(b["lit_for"]) if b is Dictionary else 0.0


func flashes(id, within: float) -> int:
	var b = beam_st.get(str(id))
	if not (b is Dictionary):
		return 0
	var n := 0
	for t in b["flashes"]:
		if clock - float(t) <= within:
			n += 1
	return n


func _beam_feel(id: String, lit: float, bright: float, dt: float) -> Dictionary:
	if not beam_st.has(id):
		beam_st[id] = {"lit": 0.0, "lit_for": 0.0, "prev": false, "flashes": [], "react": null, "wait_unlit": false}
	var b: Dictionary = beam_st[id]
	var on := lit >= bright
	b["lit"] = lit
	b["lit_for"] = float(b["lit_for"]) + dt if on else 0.0
	if on and not b["prev"]:                                          # the beam landed on it: a flash
		b["flashes"].append(clock)
		while (b["flashes"] as Array).size() > 12:
			(b["flashes"] as Array).pop_front()
		emit({"type": "flashed", "who": id})
	b["prev"] = on
	if not on:
		b["wait_unlit"] = false
	return b


## the things the story's lit and flashed triggers name (not the cast): read once
var lit_read := false
func lit_things() -> void:
	lit_read = true
	var txt := JSON.stringify(story.data) + JSON.stringify(story.stitches)   # (the stitches as played: an act edited by hand too)
	for key in ["\"lit\":", "\"flashed\":"]:
		var i := txt.find(key)
		while i >= 0:
			var q0 := txt.find("\"", i + key.length())
			var q1 := txt.find("\"", q0 + 1)
			if q0 >= 0 and q1 > q0 and q0 - (i + key.length()) <= 1:
				var id := txt.substr(q0 + 1, q1 - q0 - 1)
				if not story.cast.has(id):
					lit_ids[id] = true
			i = txt.find(key, i + 1)


func beam_watch(dt: float) -> void:
	if not lit_read:
		lit_things()
	var tk := 1.0
	var lk := {}
	for cid in npcs:
		var n: Dictionary = npcs[cid]
		var node = cast_nodes.get(cid)
		var cfg = beam_cfg(cid)
		var here: bool = n["pos"] != null and n["level"] == level and node != null and node.visible
		var lit := 0.0
		if here:
			var h := float(story.cast.get(cid, {}).get("height", 1.7))
			lit = maxf(beam_at(n["pos"] + Vector3(0, h * 0.7, 0)), beam_at(n["pos"] + Vector3(0, h * 0.93, 0)))
		var b := _beam_feel(str(cid), lit, float(cfg["bright"]) if cfg != null else BEAM["bright"], dt)
		if cfg == null:
			continue
		if b["react"] == null and not b["wait_unlit"] and str(cfg["does"]) != "nothing" and float(b["lit_for"]) >= float(cfg["after"]) and here:
			beam_start(str(cid), n, cfg)
		elif b["react"] != null and str(b["react"]["cfg"]["does"]) == "flees":
			var r: Dictionary = b["react"]
			if lit >= float(cfg["bright"]):
				r["last_lit"] = clock
			if n["st"].get("arrived") != null and clock - float(r["last_lit"]) >= float(cfg["keep"]):
				beam_end(str(cid), true)
		var near: float = float(cfg["near"])
		if here and near > 0.0:                                         # her presence on the lights round her
			var seed: int = 0
			for ch in str(cid).to_utf8_buffer():
				seed = (seed * 31 + int(ch)) & 0xffff
			if str(cfg["near_torch"]) != "none" and torch["on"]:
				var pr := clampf(1.0 - Vector3(n["pos"] - player.pos).length() / near, 0.0, 1.0)
				tk *= _near_k(str(cfg["near_torch"]), pr, str(cid) + "/torch", seed)
			if str(cfg["near_lamps"]) != "none":
				for t in lights:
					var pr := clampf(1.0 - Vector3((t["node"] as Node3D).global_position - n["pos"]).length() / near, 0.0, 1.0)
					if pr > 0.0:
						lk[t["id"]] = float(lk.get(t["id"], 1.0)) * _near_k(str(cfg["near_lamps"]), pr, str(cid) + "/" + str(t["id"]), seed + 7)
	for id in lit_ids:                                                  # the things the triggers name
		var t = by_id.get(id)
		var lit := 0.0
		if t != null and (t["node"] as Node3D).is_visible_in_tree():
			lit = beam_at((t["node"] as Node3D).global_position)
		_beam_feel(str(id), lit, BEAM["bright"], dt)
	near_torch_k = tk
	near_light_k = lk


## a light's multiplier from someone near it: flicker (a dying tube's, as much as she's near), dim, die
func _near_k(how: String, pr: float, key: String, seed: int) -> float:
	match how:
		"flicker":
			if not near_fl.has(key):
				near_fl[key] = {"mode": "dying", "interval": 1.2, "seed": seed, "flicker": 0.0}
			near_fl[key]["flicker"] = pr
			return HSFlicker.k(near_fl[key], clock)
		"dim":
			return 1.0 - 0.7 * pr
		"die":
			return clampf(1.0 - pr * 1.6, 0.0, 1.0)
	return 1.0


## the light on her long enough: what she does (FLASHLIGHT_PLAN §2b), her sound and face as it starts
func beam_start(cid: String, n: Dictionary, cfg: Dictionary) -> void:
	var b: Dictionary = beam_st[cid]
	var r := {"cfg": cfg, "t0": clock, "last_lit": clock, "moved": 0.0}
	b["react"] = r
	if cfg.get("sound") != null and str(cfg["sound"]) != "":
		sound(cfg["sound"], cid)
	if cfg.get("face") != null and str(cfg["face"]) != "":
		face_play(cid, cfg["face"], {})
	hud.log("%s in the light: %s" % [cid, cfg["does"]])
	match str(cfg["does"]):
		"covers":                                                       # her move (or her `lit` move), held where she is
			var clip = cfg.get("clip") if cfg.get("clip") != null and str(cfg["clip"]) != "" else move_of(cid, "lit", false)
			react(cid, clip, null, float(cfg["keep"]))
			b["react"] = null
			b["wait_unlit"] = true
		"flees":
			var spot = cfg.get("flee")
			if spot == null or str(spot) == "" or not by_id.has(str(spot)):
				hud.log("%s flees, but has no flee spot" % cid)
				b["react"] = null
				b["wait_unlit"] = true
				return
			r["prev"] = {"as": n["as"], "s": n["s"].duplicate(true)}
			n["as"] = "go"
			n["s"] = BehavioursC.settings_of("go", {"to": spot, "then": "idle", "speed": float(cfg["speed"])})
			n["st"] = {}
			BehavioursC.start("go", n, self, n["s"])
		"vanishes":
			n["vanished"] = true


## her reaction over: her behaviour again from where she is (`resume`: started again, a path or patrol from the nearest)
func beam_end(cid: String, resume: bool) -> void:
	var b: Dictionary = beam_st[cid]
	var r = b["react"]
	b["react"] = null
	b["wait_unlit"] = true
	var n = npcs.get(cid)
	if n == null or not (r is Dictionary):
		return
	n.erase("vanished")
	if r.has("prev"):
		n["as"] = r["prev"]["as"]
		n["s"] = r["prev"]["s"]
	if resume:
		n["st"] = {}
		BehavioursC.start(n["as"], n, self, n["s"])


## while the light holds her (backs_off, freezes, vanishes, comes, charges): her behaviour waits; true while it does
func beam_hold(n: Dictionary, dt: float) -> bool:
	var b = beam_st.get(str(n["cid"]))
	if not (b is Dictionary) or b["react"] == null:
		return false
	var r: Dictionary = b["react"]
	var cfg: Dictionary = r["cfg"]
	var does := str(cfg["does"])
	if does == "flees":
		return false                                                 # (her go walks her there)
	var lit: bool = float(b["lit"]) >= float(cfg["bright"])
	if lit:
		r["last_lit"] = clock
	var over: bool = not lit and clock - float(r["last_lit"]) >= float(cfg["keep"])
	n["walking"] = false
	if does in ["backs_off", "comes", "charges"] and n["pos"] != null:
		var away := does == "backs_off"
		var to_p: Vector3 = player.pos - n["pos"]
		to_p.y = 0.0
		var dist := to_p.length()
		if dist > 0.01:
			BehavioursC.turn_to(n, rad_to_deg(atan2(-to_p.z, to_p.x)), dt)   # facing the player all the while
		var go := (away and float(r["moved"]) < float(cfg["dist"]) and not over) or (not away and lit and dist > (0.8 if does == "charges" else 1.3))
		if go and dist > 0.01:
			var dirv: Vector3 = (-to_p if away else to_p) / dist
			var step := float(cfg["speed"]) * (2.0 if does == "charges" else 1.0) * dt
			if away:
				step = minf(step, float(cfg["dist"]) - float(r["moved"]))
			var hit = ray_hit(n["pos"] + Vector3(0, 0.9, 0), dirv, step + 0.35, blocks())
			if hit == null:
				n["pos"] = n["pos"] + dirv * step
				r["moved"] = float(r["moved"]) + step
				n["walking"] = true
		if does == "charges" and dist < 0.9:
			beam_end(str(n["cid"]), true)
			caught(n["cid"], null)
			return true
	if over:
		beam_end(str(n["cid"]), does != "freezes")
		return false
	return true


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


## the player's flashlight seen by her (her sight's `torch`, FLASHLIGHT_PLAN §2b: the light gives you away): on, within
## her range, from any side, a clear way from her eye to it
func torch_seen(n: Dictionary) -> bool:
	var c = sight_of(n)
	if c == null or float(c.get("torch", 0.0)) <= 0.0 or n["pos"] == null or n["level"] != level or not torch["on"] or float(torch.get("k", 0.0)) <= 0.05 or not torch.has("from"):
		return false
	var h := float(story.cast.get(n["cid"], {}).get("height", 1.7))
	var eye: Vector3 = n["pos"] + Vector3(0, h * 0.93, 0)
	var d: Vector3 = (torch["from"] as Vector3) - eye
	var dist := d.length()
	if dist > float(c["range"]) or dist < 0.01:
		return false
	var hit = ray_hit(eye, d / dist, dist, blocks())
	return not (hit != null and float(hit["dist"]) < dist - 0.3)


func watch(dt: float) -> void:
	if calm > 0:
		calm -= dt
		suspicion = max(0.0, suspicion - dt / SIGHT["drain"])
		hud.seen(suspicion)
		return
	var by = null
	var rate := 1.0
	for cid in npcs:
		if sees(npcs[cid]):
			by = npcs[cid]
			if torch_seen(by):                                    # seen with the light on: at least as fast as her `torch` says
				rate = maxf(1.0, float(sight_of(by)["torch"]))
			break
	if by == null:
		for cid in npcs:
			if torch_seen(npcs[cid]):                             # only the light: her meter at her `torch`'s rate
				by = npcs[cid]
				rate = float(sight_of(by)["torch"])
				break
	if by != null:
		suspicion += dt / float(sight_of(by)["meter"]) * rate
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
	if n != null and move_of(str(by), "caught", false) != null:   # her caught move (STORY_FORMAT §2 `moves`), once, turned to the player
		react(str(by), move_of(str(by), "caught", false), "player")
	hud.log("caught by %s%s" % [by, (" in " + str(at)) if at != null else ""])
	emit({"type": "caught", "by": by, "at": at})


# ---- the player's use and the cursor ----------------------------------------------------------------------------
func eye_pos() -> Vector3:
	return player.pos + Vector3(0, float(player.eye) + float(player.get("glide", 0.0)), 0)


## a ray against the things' boxes (and cylinders as their boxes): the nearest {thing, dist, point} or null
func ray_hit(from: Vector3, dir: Vector3, far: float, among: Array) -> Variant:
	if collide != null:                                  # Godot's physics: whatever collides, the first hit (among is the boxes' own list)
		return collide.ray(from, dir, far)
	var best = null
	for t in among:
		var h = box_hit(t, from, dir, far)
		if h != null and (best == null or float(h["dist"]) < float(best["dist"])):
			best = h
	return best


## the ray against one thing's box (its size about its node): {thing, dist, point} or null
func box_hit(t: Dictionary, from: Vector3, dir: Vector3, far: float) -> Variant:
	var n: Node3D = t["node"]
	if not n.visible:
		return null
	var inv_t: Transform3D = n.global_transform.affine_inverse()
	var o: Vector3 = inv_t * from
	var d: Vector3 = inv_t.basis * dir
	var e := extent(t)
	var hx: float = float(e["r"]) if e.has("r") else float(e["hx"])
	var hz: float = float(e["r"]) if e.has("r") else float(e["hz"])
	var hy := float(e["hy"])
	var tmin := 0.0
	var tmax := far
	for ax in 3:
		var oo: float = [o.x, o.y, o.z][ax]
		var dd: float = [d.x, d.y, d.z][ax]
		var h: float = [hx, hy, hz][ax]
		if abs(dd) < 1e-9:
			if abs(oo) > h:
				return null
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
			return null
	return {"thing": t, "dist": tmin, "point": from + dir * tmin}


func aim() -> Variant:
	var cam: Camera3D = game.camera
	var hit = null
	if collide != null:
		hit = collide.aim()
	else:
		var among: Array = []
		for id in by_id:
			var t: Dictionary = by_id[id]
			if ["wall", "floor", "ceiling", "door", "mesh"].has(t["kind"]) and t["node"].visible and not t["hollow"]:
				among.append(t)
		hit = ray_hit(cam.global_position, -cam.global_transform.basis.z, LOOK_RANGE, among)
	# an open container: what's in it is aimed at through its open side (its own box holds theirs)
	if hit != null and hit.get("thing") != null and hit["thing"].get("contents", []).size() and float(hit["thing"].get("open_s", 0.0)) > 0.5:
		var best = null
		for cid in hit["thing"]["contents"]:
			var ct = by_id.get(cid)
			if ct == null:
				continue
			var h2 = box_hit(ct, cam.global_position, -cam.global_transform.basis.z, LOOK_RANGE)
			if h2 != null and (best == null or float(h2["dist"]) < float(best["dist"])):
				best = h2
		if best != null:
			return best
	return hit


func use(press: bool) -> void:
	if player.sleeping != null or in_chapter:
		return
	if player.peeping != null:
		hud.press()
		unpeep()
		return
	if held_move != null:
		hud.press()
		move_place()
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
	var held = carried()                          # someone who wants something now (a `gave` trigger names her): the hand offers it
	if held != null and not hand_down and t.get("kind") == "person" and wants_from(t["id"]):
		hud.press()
		emit({"type": "gave", "item": held["item"] if held.get("item") != null else held["id"], "to": t["id"]})
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
	if held_move != null:
		target = null
		hud.set_cursor("take", setting("moveable")["place"], title_of(held_move))
		return
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
var rain_sounds: Array = []          # {p: the rain's player, room, at}: the shelf's rain in each open room (rain_follow)
var wet_rooms: Array = []            # the open rooms' ids while it rains, and the rooms with their own `wet`: steps there sound wet
var rain_rooms: Array = []           # the open rooms' ids while it rains: a cast member out there gets wet (rain_wet)
const RAIN_BOX := 12.0               # metres across: the level's one rain box, riding with the player
var rain_box: HSRain = null
var rain_box_y := 0.0
func weather_attach() -> void:
	rain_sounds = []
	rain_box = null
	wet_rooms = []
	rain_rooms = []
	var lvl: Dictionary = game.story.levels.get(level, {})
	var rooms: Array = lvl.get("rooms", [])
	if game.level != null:
		for r in rooms:                                 # a room's own `wet` (STORY_FORMAT §2): its floor damp with pools, no rain's rings; wet steps from 0.5
			var w: float = float(r.get("wet", 0.0))
			if w > 0.0:
				HSWet.wet_floors(game.level, [r["id"]], {"wetness": w, "puddles": w * 0.7, "puddle_scale": 1.0, "ripples": 0.0})
				if w >= 0.5:
					wet_rooms.append(r["id"])
	if str(lvl.get("weather", game.story.game.get("weather", "clear"))) != "rain" or game.level == null:   # the level's own weather over the game's
		return
	var open: Array = []
	for r in rooms:
		var c = r.get("ceiling", true)
		if c is bool and c == false:
			open.append(r)
	if open.is_empty():
		return
	var ids: Array = []
	var boxes: Array = []                            # the open rooms as world boxes: the one rain box only draws drops inside them
	var top := 0.0
	var floor_y := INF
	for r in open:
		var at: Array = r["at"]
		var sz: Array = r["size"]
		var lo := Vector3(float(at[0]), float(at[2]), -(float(at[1]) + float(sz[1])))
		var hi := Vector3(float(at[0]) + float(sz[0]), float(at[2]) + float(sz[2]), -float(at[1]))
		boxes.append([lo, hi])
		top = max(top, hi.y)
		floor_y = min(floor_y, lo.y)
		ids.append(r["id"])
		var middle := (lo + hi) * 0.5
		if game.sfx_index.has("rain"):              # heard at the room's middle from indoors, all round you once you're in it (rain_follow)
			var rp = play_sfx("rain", middle, -6.0)     # (play_sfx, not shelf_sound: the level loads before the run is active)
			if rp != null:
				rain_sounds.append({"p": rp, "room": str(r["id"]), "at": middle})
	# one box of rain for the level that rides with the player (GODOT_LOOK §7: a street needn't be one huge thin box, nor a box a room):
	# a dozen metres across, the open rooms' full height, its drops on a world lattice, drawn only inside the open rooms
	var size := Vector3(RAIN_BOX, max(top - floor_y, 2.5) + 0.5, RAIN_BOX)
	rain_box = HSRain.make(size, 3000, 0.55)
	rain_box.name = "Rain"
	game.level.add_child(rain_box)
	rain_box_y = floor_y + size.y / 2.0 - 0.25
	var e0: Vector3 = eye_pos()
	rain_box.global_position = Vector3(e0.x, rain_box_y, e0.z)
	rain_box.set_follow(true)
	rain_box.set_rooms(boxes)
	for id in ids:
		if not wet_rooms.has(id):
			wet_rooms.append(id)
	rain_rooms = ids
	HSWet.wet_floors(game.level, ids, {"wetness": 0.9, "puddles": 0.6, "puddle_scale": 1.2, "ripples": 1.0})
	for n in game.pieces():                             # the rain on every window's pane
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
var standin_mats: Dictionary = {}    # cid -> its skin materials (HSSkin)
var standin_hair: Dictionary = {}    # cid -> its hair materials (HSHair: the salon's cards, brows and lashes, on the Studio's hair look)
var skin_wet: Dictionary = {}        # cid -> {wet, sweat, drips, oil}: the `skin` action, on every body she wears
var panes: Array = []                # the windows' panes wearing the rain


func standin_bodies() -> void:
	standins = {}
	for cid in cast_nodes:
		standin_body(str(cid))


## a model's name as the bake files it: Body_<cid>__<tag>.glb (bake.js: the name's runs of anything but letters and digits as one _)
static func model_tag(name: String) -> String:
	var out := ""
	var gap := false
	for ch in name:
		if (ch >= "a" and ch <= "z") or (ch >= "A" and ch <= "Z") or (ch >= "0" and ch <= "9"):
			if gap and out != "":
				out += "_"
			gap = false
			out += ch
		else:
			gap = true
	if gap and out != "":
		out += "_"
	return out


## the file a cast member's stand-in wears now: the model the run carries (a scene's pick, STORY_FORMAT §3.1), else
## their default body: a Character Studio export (people/<name>) or the bake's shaped body; {file, people}
func standin_file(cid: String) -> Dictionary:
	var c: Dictionary = game.story.cast.get(cid, {}) if game.story.cast is Dictionary else {}
	var model = (game.run.get("models", {}) if game.run != null and game.run.get("models") is Dictionary else {}).get(cid)
	var refs: Array = []
	if model != null and (c.get("models", {}) is Dictionary) and c["models"].has(model):
		var ref := str(c["models"][model])
		if ref.begins_with("people/"):
			refs.append({"file": "res://game/people/" + ref.substr(7) + ".glb", "people": true})
		refs.append({"file": "res://game/previs/Body_" + cid + "__" + model_tag(str(model)) + ".glb", "people": false})
	var pb := str(c.get("previs_body", ""))
	if pb.begins_with("people/"):
		refs.append({"file": "res://game/people/" + pb.substr(7) + ".glb", "people": true})
	refs.append({"file": "res://game/previs/Body_" + cid + ".glb", "people": false})
	for r in refs:
		if ResourceLoader.exists(r["file"]) or FileAccess.file_exists(r["file"]):
			return r
	return {"file": "", "people": false}


## the stand-in dressed again (a scene picked another model for them): the old body off, the new one on
func standin_redress(cid: String) -> void:
	if not cast_nodes.has(cid):
		return
	var old = standins.get(cid)
	if old != null and is_instance_valid(old):
		if old.get_meta("file", "") == standin_file(cid)["file"]:
			return
		old.queue_free()
		standins.erase(cid)
		standin_mats.erase(cid)
		standin_hair.erase(cid)
	standin_body(cid)


func standin_body(cid: String) -> void:
	if not cast_nodes.has(cid):
		return
	var n: Node3D = cast_nodes[cid]
	var sf := standin_file(cid)
	var file: String = sf["file"]
	var people: bool = sf["people"]
	if file == "":
		return
	var body: Node3D = glb_scene(file)             # read by GLTFDocument, not the importer: its bone frames are the file's own (arms_down counts on them)
	if body == null:
		return
	body.set_meta("file", file)
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
	# the export faces +z, and +z is the stand-in's front (the node turns its +z to the spot's rot, as the desk's figure: stage.js yawToThree), so it's worn unturned
	for sk in body.find_children("*", "Skeleton3D", true, false):
		arms_down(sk)
	standin_mats[cid] = HSSkin.wear(body, skin_wet.get(cid, {}), file if people else "")   # a Studio export: its relief, roughness and thinness maps and its studioSkin numbers
	standin_hair[cid] = HSHair.wear(body, hair_look(cid), file if people else "")   # a Studio export: the salon's bake MetaHuman's way (its records in the file)
	if people:
		HSEye.wear(body, file)
		HSCloth.wear(body, {}, file)             # her garments on the fabric sets they say they wear (the look plugin's cloth shader)
	standins[cid] = body
	for k in body_moves.keys():                      # (her own clips are looked for again on this body)
		if str(k).begins_with(cid + "|"):
			body_moves.erase(k)
	for k in anim_players.keys():
		if str(k).begins_with(cid + "|"):
			anim_players.erase(k)
	var mesh_names: Array = []                       # said once a body, so a stand-in wearing the wrong file or an unskinned mesh can be read off the console
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		mesh_names.append(str(mi.name))
	print("standin %s wears %s (%s): %d skin surfaces (%d with the export's maps), %d hair surfaces on %s" % [cid, file, "a Character Studio export" if people else "the bake's body", standin_mats[cid].size(), with_maps(standin_mats[cid]), standin_hair[cid].size(), ", ".join(mesh_names)])


## how many of a body's skin materials carry the export's normal map
static func with_maps(mats: Array) -> int:
	var k := 0
	for m in mats:
		if m is ShaderMaterial and m.get_shader_parameter("normal_gl") == true:
			k += 1
	return k


## the hair look a cast member's bodies wear (STORY_FORMAT §2 `hair`): the game's over the plugin's defaults, theirs over the game's
func hair_look(cid: String) -> Dictionary:
	var out := {}
	var g = story.game.get("hair") if story.game is Dictionary else null
	if g is Dictionary:
		out.merge(g, true)
	var c = story.cast.get(cid) if story.cast is Dictionary else null
	if c is Dictionary and c.get("hair") is Dictionary:
		out.merge(c["hair"], true)
	return out


## the `skin` action: a cast member's skin wet, sweating, dripping, oiled (0..1 each; the keys left out stay): on her
## stand-in's body now, on a scene's body as it's made (bakeplay), and remembered for her next bodies
func skin_set(cid: String, a: Dictionary, by_word: bool = true) -> void:
	var cur: Dictionary = skin_wet.get(cid, {}).duplicate()
	for k in ["wet", "sweat", "drips", "oil"]:
		if a.has(k):
			cur[k] = float(a[k])
	if by_word:
		cur["by_word"] = true                          # the story's word: hers till the word changes it (the rain leaves her alone)
	skin_wet[cid] = cur
	for m in standin_mats.get(cid, []):
		HSSkin.set_wet(m, skin_settings(cid))
	var sp = game.scene_player
	if sp != null and sp.bk != null and sp.bk.bodies.has(cid):
		for m in sp.bk.bodies[cid].get("skin_mats", []):
			HSSkin.set_wet(m, skin_settings(cid))


## HSSkin's words for a cast member's skin (the story's `wet` is the shader's `wetness`)
func skin_settings(cid: String) -> Dictionary:
	var w: Dictionary = skin_wet.get(cid, {})
	var out := {}
	for k in w:
		if k != "by_word":
			out["wetness" if k == "wet" else k] = w[k]
	return out


## out in the rain a cast member's skin wets by itself (toward 0.8 in a few seconds) and dries slowly once she's in
## (about a minute), unless the story's `skin` word has set her: then hers is hers till the word changes it
func rain_wet(dt: float) -> void:
	for cid in npcs:
		var n: Dictionary = npcs[cid]
		if n.get("pos") == null:
			continue
		var sw: Dictionary = skin_wet.get(cid, {})
		if sw.get("by_word", false):
			continue
		var p: Vector3 = n["pos"]
		var out := false
		for t in triggers:
			if rain_rooms.has(t["id"]) and point_in(t, p.x, -p.z, p.y + 0.5):
				out = true
				break
		var cur := float(sw.get("wet", 0.0))
		var nw: float = min(0.8, cur + 0.15 * dt) if out else max(0.0, cur - 0.02 * dt)
		if nw != cur:
			skin_set(cid, {"wet": nw}, false)


## a glb read at run time (GLTFDocument): the file's own node and bone frames, the same on every machine
static func glb_scene(path: String) -> Node3D:
	if not FileAccess.file_exists(path):
		return null
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(path, st) != OK:
		return null
	var n := doc.generate_scene(st)
	scrub_meshes(n)
	return n


## a surface with an index buffer and nothing in it (a glb's empty primitive: a garment cut to nothing, a scalp with no
## hair) makes the renderer say `draw_list_bind_index_array: index_array is null` every frame it's drawn (the user,
## 2026-10-30): such surfaces are left out of the mesh, the rest kept with their materials
static func scrub_meshes(root: Node) -> int:
	if root == null:
		return 0
	var dropped := 0
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m = mi.mesh
		if not (m is ArrayMesh):
			continue
		var bad: Array = []
		for s in m.get_surface_count():
			var fmt: int = m.surface_get_format(s)
			if m.surface_get_array_len(s) == 0 or ((fmt & Mesh.ARRAY_FORMAT_INDEX) != 0 and m.surface_get_array_index_len(s) == 0):
				bad.append(s)
		if bad.is_empty():
			continue
		var am := ArrayMesh.new()
		am.blend_shape_mode = m.blend_shape_mode
		for b in m.get_blend_shape_count():               # its blend shapes (a face's) first: a surface's blend shape arrays need them there
			am.add_blend_shape(m.get_blend_shape_name(b))
		for s in m.get_surface_count():
			if s in bad:
				continue
			am.add_surface_from_arrays(m.surface_get_primitive_type(s), m.surface_get_arrays(s), m.surface_get_blend_shape_arrays(s), {}, m.surface_get_format(s))
			am.surface_set_name(am.get_surface_count() - 1, m.surface_get_name(s))
			am.surface_set_material(am.get_surface_count() - 1, m.surface_get_material(s))
		mi.mesh = am
		dropped += bad.size()
		print("%s: %d empty surface(s) left out of its mesh (nothing to draw in them)" % [mi.name, bad.size()])
	return dropped


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
## every mirror on the level (a kit panel with a `kit_mirror` face, or a prop tagged mirror) reflects the room for
## real (HSMirror: the player's camera reflected through the glass into a viewport of its own, drawn while it's in view)
var mirrors: Array = []
func mirror_attach() -> void:
	mirrors = []
	for id in things:
		var t: Dictionary = things[id]
		var tags: Array = t["tags"]
		var kit: String = str(t["piece"].get("kit", ""))
		if not (kit == "mirror" or tags.has("tag:mirror")):
			continue
		var m = t.get("mesh")                             # its block (a Director thing with a model has none: its art alone)
		var target: MeshInstance3D = null                 # the kit's glass (the art child's kit_mirror surface), else the block itself
		var s := -1
		var art = t["node"].get_node_or_null("art")
		if art != null:
			for mi in art.find_children("*", "MeshInstance3D", true, false):
				s = HSMirror.mirror_surface(mi)
				if s >= 0:
					target = mi
					break
		if target == null and m is MeshInstance3D and m.visible:
			target = m
			s = 0
		if target == null:
			continue
		var hm := HSMirror.attach(target, s, game.camera, 288)
		t["mirror"] = hm
		mirrors.append(hm)
	mirrors_quality(int(MenuC.load_settings().get("reflections", 2)))


## the pause menu's Reflections row on the mirrors: Low off (dull glass), Medium half the lines, else full
func mirrors_quality(q: int) -> void:
	for hm in mirrors:
		if is_instance_valid(hm):
			hm.set_quality(q)
	for n in get_tree().get_nodes_in_group("hs_mirrors"):      # the user's own mirrors (HSMirrorSurface, the look plugin's nodes)
		n.set_quality(q)


## the lights the user placed by hand on the mains (the look plugin's flicker lights with on_mains, or any light put
## in the group hs_mains): out in a power cut, on again with it (a tube's starter clicking)
var mains_was = null


func mains_tick() -> void:
	var pw := powered()
	if pw == mains_was:
		return
	mains_was = pw
	for n in get_tree().get_nodes_in_group("hs_mains"):
		if not (n is Light3D):
			continue
		n.set_meta("hs_power_off", not pw)
		HSLightZone.show_light(n)                                  # its own visibility, the power and its light zone's view, together
		if pw and n.has_method("power_on"):
			n.power_on()


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
	stitch_now = st
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
			if x["fired"] or not if_holds(x["b"].get("if")) or not conditions.matches(x["b"].get("when"), ev, self):
				continue
			x["fired"] = true
			if on_beat.is_valid():
				on_beat.call(st, x["b"], (float(run["secs"]) if run != null else 0.0) + clock)
			if x["b"].get("repeat", false):
				_run_again(x)
			else:
				_run_beat(x["b"])
	go()
	emit({"type": "start"})
	var r = await stitch_ended
	return r


## a beat's `if` (STORY_FORMAT §4): flags set (`!` for not), and `item:<id>` for an item the player holds (the Director
## plugin's events: "if they have the key")
func if_holds(ifs) -> bool:
	if ifs == null:
		return true
	for fl in (ifs if ifs is Array else [ifs]):
		var s := str(fl)
		var neg := s.begins_with("!")
		if neg:
			s = s.substr(1)
		var has: bool = items.has(s.substr(5)) if s.begins_with("item:") else flags.has(s)
		if has == neg:
			return false
	return true


func _run_beat(b: Dictionary) -> void:
	await actions.run_all(b.get("do", []), self)
	ended[b.get("id")] = clock


## a beat that fires every time (`repeat: true`, STORY_FORMAT §4): heard again once its actions are over and `every`
## seconds have gone (1 by default: a trigger that holds, a flag, fires once a second while it holds)
func _run_again(x: Dictionary) -> void:
	await _run_beat(x["b"])
	await wait(float(x["b"].get("every", 1.0)))
	x["fired"] = false


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
	var bat := {}                                              # the flashlight's battery: its charge, the sets in the pocket, a change (FLASHLIGHT_PLAN §1d)
	if torch_item() != null and torch["bat"] != null and float(torch["bat"]["battery"]) > 0.0:
		bat = {"charge": torch_charge(), "sets": batteries().size(), "change": torch_change}
	var r = await hud.menu.open({"game": str(story.game.get("id", "game")), "where": str(story.game.get("title", "")), "secs": now(), "has": {"torch": torch_item() != null}, "battery": bat})
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
	hud.held(true)                              # the play HUD back, the footer (the scene's lines) kept
	if torch_hot != null:
		torch_hot.light_energy = 0
		torch_spill.light_energy = 0


func go() -> void:
	if stopped:
		return
	hud.root.visible = true
	hud.held(false)
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
	if torch["dead"] or torch["changing"] != null:
		hud.log("the flashlight is dead")
		return
	torch["on"] = not torch["on"]
	torch["flick"] = 0.0
	emit({"type": "torch", "on": torch["on"]})


## the story's `torch` (STORY_FORMAT §4): on, off, flicker (a stutter; with `secs` or `mode` that long in a lamp's
## mode), dim (`to` how bright, `secs`, `over`), dead (the charge gone: a stutter and out), works (full: new
## batteries), drain (`to`: the charge; FLASHLIGHT_PLAN §1)
func torch_set(v: String, a: Dictionary = {}) -> void:
	if torch_item() == null and (v == "on" or v == "flicker"):
		hud.log("torch %s: the player has no flashlight" % v)
		return
	torch_make()
	torch_battery()
	var secs: float = float(a["secs"]) if a.get("secs") != null else 0.0
	var over: float = maxf(0.0, float(a["over"])) if a.get("over") != null else 0.0
	match v:
		"on":
			if not torch["dead"]:
				torch["on"] = true
			torch["layers"].clear()
		"off":
			torch["on"] = false
		"flicker":
			torch["on"] = not torch["dead"]
			if secs > 0.0 or HSFlicker.MODES.has(a.get("mode")):
				var m = a.get("mode") if HSFlicker.MODES.has(a.get("mode")) else "dying"
				torch["layers"].append({"set": "flicker", "mode": m, "t0": clock, "end": clock + (secs if secs > 0.0 else 1.4), "fade": over, "to": 1.0})
			else:
				torch["flick"] = 1.4
		"dim":
			var to: float = clampf(float(a["to"]) if a.get("to") != null else DIM, 0.0, 1.0)
			torch["layers"].append({"set": "dim", "to": to, "t0": clock, "end": clock + (secs if secs > 0.0 else 1.0e9), "fade": over, "mode": null})
		"dead":
			if torch["on"]:
				torch["flick"] = 1.1
				torch["dying"] = true
			elif not torch["dead"]:
				torch_died()
			torch["dead"] = true
			torch["charge"] = 0.0
		"works":
			torch["dead"] = false
			torch["dying"] = false
			torch["charge"] = 1.0
			torch["low_heard"] = false
			torch["low_at"] = null
			torch["rests"] = TorchBeam.RESTS
		"drain":
			var c: float = clampf(float(a["to"]) if a.get("to") != null else 0.0, 0.0, 1.0)
			torch["charge"] = c
			if c <= 0.0:
				torch_set("dead")
			elif torch["bat"] != null and c >= float(torch["bat"]["low"]):
				torch["low_heard"] = false
				torch["low_at"] = null


## the flashlight's battery from its item (torch_beam.gd battery_of), read again when the flashlight changes
func torch_battery() -> void:
	var it = torch_item()
	if it == null or torch["item"] == it:
		return
	torch["item"] = it
	torch["bat"] = TorchBeam.battery_of(it.get("torch"))
	torch["charge"] = float(torch["bat"]["charge"])
	torch["low_heard"] = torch["charge"] < float(torch["bat"]["low"])
	torch["low_at"] = null
	torch["rests"] = TorchBeam.RESTS


## out for good (its stutter over): heard as {"torch": "dead"}; a set of batteries in the pocket is then changed by
## itself (torch_tick)
func torch_died() -> void:
	emit({"type": "torch", "dead": true})


## the batteries changed, from the pocket (by itself once it's dead, or from the pause menu): about two seconds of dark
## with its sounds, then the light full; heard as {"torch": "changed"}. False with none to change
func torch_change() -> bool:
	var sets := batteries()
	if sets.is_empty() or torch_item() == null or torch["changing"] != null:
		return false
	torch_battery()
	torch["changing"] = {"at": clock + TorchBeam.CHANGE_SECS, "item": sets[0]}
	torch["on"] = false
	torch["flick"] = 0.0
	torch["dying"] = false
	shelf_sound("flashlight_02")
	hud.log("changing the flashlight's batteries")
	return true


func _torch_changed() -> void:
	var c: Dictionary = torch["changing"]
	torch["changing"] = null
	var full: float = clampf(float(story.items.get(str(c["item"]), {}).get("battery", 1.0)), 0.0, 1.0)
	take_item(c["item"])
	torch["charge"] = full
	torch["dead"] = false
	torch["low_heard"] = torch["bat"] != null and full < float(torch["bat"]["low"])
	torch["low_at"] = null
	torch["rests"] = TorchBeam.RESTS
	torch["on"] = true
	shelf_sound("flashlight_01")
	emit({"type": "torch", "changed": true})
	emit({"type": "torch", "on": true})


## the charge now (0..1); 1 for a flashlight with no battery, or none at all
func torch_charge() -> float:
	return float(torch["charge"]) if torch["bat"] != null and float(torch["bat"]["battery"]) > 0.0 else 1.0


static func kelvin_color(k: float) -> Color:
	var t := k / 100.0
	var r: float = 255.0 if t <= 66 else 329.698727446 * pow(t - 60, -0.1332047592)
	var g: float = (99.4708025861 * log(t) - 161.1195681661) if t <= 66 else 288.1221695283 * pow(t - 60, -0.0755148492)
	var b: float = 255.0 if t >= 66 else (0.0 if t <= 19 else 138.5177312231 * log(t - 10) - 305.0447927307)
	return Color(clamp(r, 0, 255) / 255.0, clamp(g, 0, 255) / 255.0, clamp(b, 0, 255) / 255.0)


func torch_tick(dt: float) -> void:
	if torch_hot == null:
		return
	torch_battery()
	var s := setting("torch")
	var it = torch_item()
	if it != null and it.get("torch") is Dictionary:
		for k in it["torch"]:
			s[k] = it["torch"][k]
	var bat = torch["bat"]
	var on_battery: bool = bat != null and float(bat["battery"]) > 0.0
	if torch["changing"] != null and clock >= float(torch["changing"]["at"]):
		_torch_changed()
	if on_battery:                                                  # its battery (FLASHLIGHT_PLAN §1)
		if torch["on"] and not torch["dead"] and not torch["dying"]:
			torch["charge"] = maxf(0.0, float(torch["charge"]) - dt / float(bat["battery"]))
			torch["rest_t"] = 0.0
		if float(torch["charge"]) < float(bat["low"]) and not torch["low_heard"]:
			torch["low_heard"] = true
			torch["low_at"] = clock
			emit({"type": "torch", "low": true})
		if float(torch["charge"]) <= 0.0 and torch["on"] and not torch["dying"] and not torch["dead"]:
			torch["flick"] = 1.1                                     # the last of it: a stutter, then out
			torch["dying"] = true
			torch["dead"] = true
		if bool(bat["rest"]) and not torch["on"] and float(torch["charge"]) < float(bat["low"]) and int(torch["rests"]) > 0:
			torch["rest_t"] = float(torch["rest_t"]) + dt              # a rest: a bulb's cells give a little more
			if float(torch["rest_t"]) >= TorchBeam.REST_SECS:
				torch["rest_t"] = 0.0
				torch["rests"] = int(torch["rests"]) - 1
				torch["charge"] = float(torch["charge"]) + TorchBeam.REST_GAIN
				torch["dead"] = false
	if torch["dead"] and not torch["dying"] and torch["changing"] == null and not batteries().is_empty():
		torch_change()                                               # a set in the pocket: changed by itself
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
			torch_died()
	var kelvin: float = float(s["kelvin"])
	var reach := 1.0
	if on_battery:                                                  # the beam by its charge (torch_beam.gd)
		var bm: Dictionary = TorchBeam.beam({"kind": bat["kind"], "charge": torch["charge"], "low": bat["low"], "low_at": torch["low_at"],
			"kelvin": float(bat["kelvin"]) if float(bat["kelvin"]) > 0.0 else kelvin}, clock)
		k *= float(bm["b"])
		reach = float(bm["reach"])
		if float(bm["kelvin"]) > 0.0:
			kelvin = float(bm["kelvin"])
	var keep: Array = []                                            # the story's timed dims and flickers on the beam (as a lamp's)
	for L in torch["layers"]:
		if clock >= float(L["end"]) + float(L["fade"]):
			continue
		keep.append(L)
		var w := layer_w(L, clock)
		if w <= 0.0:
			continue
		if L["set"] == "dim":
			k *= lerpf(1.0, float(L["to"]), w)
		else:
			torch["fl"]["flicker"] = 1.0
			torch["fl"]["mode"] = L["mode"]
			torch["fl"]["seed"] = 7
			torch["fl"]["interval"] = 1.0
			k *= lerpf(1.0, HSFlicker.k(torch["fl"], clock), w)
	torch["layers"] = keep
	k *= near_torch_k                                               # someone near (her `near`): the beam flickers, dims or dies (FLASHLIGHT_PLAN §2b)
	torch["k"] = k
	torch["kelvin_now"] = kelvin
	torch["from"] = from                                            # where the beam falls, for what feels it (beam_at)
	torch["aim"] = torch["dir"]
	torch["cone"] = float(s["cone"])
	torch["spill"] = float(s["spill"])
	torch["reach_m"] = float(s["range"]) * maxf(0.05, reach)
	var col := kelvin_color(kelvin)
	for pair in [[torch_hot, float(s["cone"]), 1.0], [torch_spill, float(s["spill"]), 0.22]]:
		var l: SpotLight3D = pair[0]
		l.light_color = col
		l.spot_range = float(s["range"]) * maxf(0.05, reach)
		l.spot_angle = float(pair[1]) / 2.0
		l.light_energy = float(s["strength"]) * float(pair[2]) * k
		l.global_position = from
		if (aim_at - from).length() > 0.001:
			l.look_at(aim_at, Vector3.UP)


func torch_state() -> Dictionary:
	return {"on": torch["on"], "dead": torch["dead"], "k": torch_hot.light_energy if torch_hot != null else 0.0, "made": torch["made"],
		"charge": torch_charge(), "changing": torch["changing"] != null, "sets": batteries().size()}


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
	var dy: float = abs(at.y - last.y)
	if dy > 0.004 and dy <= float(setting("walk")["step"]) + 0.001:
		d += dy * float(s.get("riser", 2.5))          # a riser climbed or dropped: a footfall a tread on a stair
	step_at += d / float(s["crouch"] if player.crouched else (s["run"] if player.running else s["stride"]))
	if step_at < 1:
		return
	step_at -= 1
	var floor_ := floor_under()
	var fam: String = FLOOR_STEPS.get(floor_, "step_wood")
	if wet_rooms.any(func(r): return inside.has(str(r))):   # out in the rain: the ground's wet whatever it is
		fam = "step_wet"
	elif fam == "step_wood" and randf() < float(s["creak"]):
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
	if exam != null:
		exam_tick(delta)
	if held:
		return
	if faces != null:
		faces.tick(min(0.05, delta))
	if live_scene:
		live_tick(min(0.05, delta))
		return
	if not active:
		return
	tick(min(0.05, delta))


## a live scene (STORY_FORMAT §3 `camera.mode: live`): play is held (no beats, no use, no HUD) but the eye stays the
## player's: they look round and, standing, walk; seated, the look stays within 90° either side of the seat's facing
var live_scene := false
var live_limit = null
func live_start() -> void:
	live_scene = true
	keys = {}
	live_limit = player.limit
	if player.seat != null:
		player.limit = {"yaw": float(player.get("seat_yaw", player.yaw)), "dy": 90.0, "dp": 60.0}
	live_tick(0.0)


func live_end() -> void:
	live_scene = false
	player.limit = live_limit
	live_limit = null
	keys = {}


func live_tick(dt: float) -> void:
	var p := player
	var feet: Vector3 = p.pos
	if dt > 0.0 and not busy and p.seat == null and p.hiding == null and p.sleeping == null and p.peeping == null and moving == null:
		ability_walk(dt)
		ability_crouch(dt)
		ability_steps(dt)
	p.speed = p.pos.distance_to(feet) / dt if dt > 0 else 0.0
	for cid in npcs:                                   # the cast hold still in a live scene, their moves following it (talk, listen)
		var node = cast_nodes.get(cid)
		if node != null and node.visible and not baked_cast.has(cid):
			npc_motion(str(cid), npcs[cid], node)
	var cam: Camera3D = game.camera
	cam.global_position = eye_pos()
	cam.rotation_degrees = Vector3(float(p.pitch), float(p.yaw) - 90.0, 0.0)
	var vp := get_viewport().get_visible_rect().size
	cam.fov = StoryC.vfov(float(story.game.get("fov", StoryC.FOV_H)), (vp.x / vp.y) if vp.y > 0 else 16.0 / 9.0)
	if not rain_sounds.is_empty():
		rain_follow()


## the rain's sound rides with the player while they stand in its room (it's all round them there), else sits at
## the room's middle, heard through the doorway (a room's volume trigger carries the room's id)
func rain_follow() -> void:
	if rain_box != null and is_instance_valid(rain_box):      # the rain box rides with the eye (its drops keep their world seats)
		var e: Vector3 = eye_pos()
		rain_box.global_position = Vector3(e.x, rain_box_y, e.z)
	for rs in rain_sounds:
		var p = rs["p"]
		if p == null or not is_instance_valid(p) or not (p is AudioStreamPlayer3D):
			continue
		p.global_position = eye_pos() if inside.has(rs["room"]) else rs["at"]


# ---- the guide markers (STORY_FORMAT §4: a todo's `guide`) ------------------------------------------------------------
## the open tasks' markers: each over the top of what it needs, by its id (two tasks on one thing: one marker)
func guide_points() -> Dictionary:
	var out := {}
	if todo == null or not active:
		return out
	for t in todo.list:
		if t["state"] != "open" or not t.has("guide"):
			continue
		var id := guide_target(t)
		var p = top_of(id) if id != "" else null
		if p != null:
			out[id] = p
	return out


## what a task's marker hangs over: the id it gives, else (true) what its own trigger names (a thing used, read,
## looked at, picked up; an area walked into; who something is given to; where she gets to...)
func guide_target(t: Dictionary) -> String:
	var g = t.get("guide")
	if g is String:
		return g
	if not (g is bool and g) or not (t.get("ticks") is Dictionary):
		return ""
	var w: Dictionary = t["ticks"]
	for k in ["use", "read", "pickup", "look", "enter", "hidden", "peeping", "locked", "state", "played", "rolled", "dropped", "carrying", "arrived"]:
		if w.get(k) is String and w[k] != "":
			return str(w[k])
	if w.get("to") is String:                               # (gave: to whom)
		return str(w["to"])
	return ""


## the world point at the top of a person, a thing (an item or a note: the thing that holds it) or an area; null when
## it isn't in this level, isn't shown, or isn't there
func top_of(id: String) -> Variant:
	var n = npcs.get(id)
	if n != null:
		if n.get("pos") == null or n.get("level") != level:
			return null
		var node = cast_nodes.get(id)
		if node != null and not node.visible:
			return null
		return (n["pos"] as Vector3) + Vector3(0, float(story.cast.get(id, {}).get("height", 1.7)), 0)
	for tr in triggers:                                     # an area or a room: over its middle, about chest high
		if tr["id"] == id:
			var mn: Array = tr["min"]
			var mx: Array = tr["max"]
			return Vector3((float(mn[0]) + float(mx[0])) / 2.0, float(mn[2]) + 1.3, -(float(mn[1]) + float(mx[1])) / 2.0)
	var t = guide_thing(id)
	if t == null:
		return null
	var nd: Node3D = t["node"]
	if not is_instance_valid(nd) or not nd.is_visible_in_tree():
		return null
	return nd.global_position + Vector3(0, float((t["size"] as Array)[2]) / 2.0, 0)


## the thing a marker's id means: a thing by its id, or (an item's or a note's id) the thing that holds it; null for a
## person, an area or nothing here
func guide_thing(id: String) -> Variant:
	var t = things.get(id)
	if t == null:
		for x in things.values():
			var d = x["piece"].get("d", {})
			if d is Dictionary and (str(d.get("item", "")) == id or str(d.get("note", "")) == id):
				return x
	return t


## what a marker is called when it's near enough to say: a person by her name now (a word: "the guide" till she's met),
## a thing by what the cursor would call it (its item, its note's title, its own name); an area and the rest, nothing
func guide_name(id: String) -> String:
	if npcs.has(id) or story.cast.has(id):
		return hud.named(story.cast_name(id))
	var t = guide_thing(id)
	if t == null:
		return ""
	var ti = title_of(t)
	return hud.named(str(ti)) if ti != null else ""


var guide_los: Dictionary = {}                 # id -> {clear: bool, at: the clock}: the markers' lines of sight, looked at a few times a second
var guide_among: Array = []                    # the structure a line of sight is stopped by (walls, floors, ceilings, doors), refreshed with them
var guide_among_at: float = -9.0


## is there a clear line from the eye to that point, that is: nothing of the building between (furniture doesn't count: a
## marker over a table across the room is still in the room)
func guide_clear(id: String, p: Vector3, eye: Vector3) -> bool:
	var e = guide_los.get(id)
	if e != null and clock - float(e["at"]) < 0.12:
		return bool(e["clear"])
	var to := p + Vector3(0, 0.15, 0)
	var d := to - eye
	var dist := d.length()
	var clear := true
	if dist > 0.5:
		if clock - guide_among_at > 0.12:
			guide_among = []
			for tid in by_id:
				var t: Dictionary = by_id[tid]
				if ["wall", "floor", "ceiling", "door"].has(t["kind"]) and t["node"].visible and not t["hollow"]:
					guide_among.append(t)
			guide_among_at = clock
		var hit = ray_hit(eye, d / dist, dist, guide_among)
		if hit != null and float(hit["dist"]) < dist - 0.35:
			var ht = hit.get("thing")                    # (Godot's physics returns whatever collided first: only the building stops it)
			clear = ht != null and not ["wall", "floor", "ceiling", "door"].has(str(ht.get("kind", "wall")))
	guide_los[id] = {"clear": clear, "at": clock}
	return clear


## what the marker needs besides where things are: which ones the eye has a clear line to, what each is called, which the
## cursor is on, and whether a card or a choice has the player's eye
func guide_ctx(pts: Dictionary, eye: Vector3) -> Dictionary:
	var seen := {}
	var names := {}
	var aimed := ""
	for id in pts:
		seen[id] = guide_clear(str(id), pts[id], eye)
		names[id] = guide_name(str(id))
		if target != null and (str(target.get("id", "")) == str(id) or guide_thing(str(id)) == target):
			aimed = str(id)
	return {"seen": seen, "names": names, "aimed": aimed}


func tick(dt: float) -> void:
	clock += dt
	if lives != null:
		lives.advance(now())
		life_events()
	if not rain_sounds.is_empty():
		rain_follow()
	if not rain_rooms.is_empty() or not skin_wet.is_empty():
		rain_wet(dt)
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
	if focus != null:
		focus_tick(dt)
	var feet: Vector3 = p.pos
	if not busy and playing == null and p.seat == null and p.hiding == null and p.sleeping == null and p.peeping == null and moving == null:
		ability_walk(dt)
		ability_crouch(dt)
		ability_steps(dt)
	p.speed = p.pos.distance_to(feet) / dt if dt > 0 else 0.0
	var gl: float = float(p.get("glide", 0.0))
	if gl != 0.0:                                      # the eye catching up with the feet after a step (glide_step)
		p["glide"] = move_toward(gl, 0.0, float(p.get("glide_rate", 2.0)) * dt)
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
	if parts != null:
		parts.tick(dt)
	if not moveables.is_empty():
		move_tick(dt)
	for t in triggers:
		var now_in := is_in(t)
		var was: bool = inside.has(t["id"])
		if now_in and not was:
			inside[t["id"]] = true
			emit({"type": "enter", "id": t["id"]})
		if not now_in and was:
			inside.erase(t["id"])
			emit({"type": "exit", "id": t["id"]})
	tone_tick()
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
	cam.global_position = eye + (focus_lean() if p.peeping == null else Vector3.ZERO)
	cam.rotation_degrees = Vector3(float(p.pitch), float(p.yaw) - 90.0, 0.0)
	var vp := get_viewport().get_visible_rect().size
	cam.fov = float(LENS["fov"]) if p.peeping != null else StoryC.vfov(float(story.game.get("fov", StoryC.FOV_H)), (vp.x / vp.y) if vp.y > 0 else 16.0 / 9.0) * (1.0 - focus_zoom())
	if hud.guide != null:
		var gp: Dictionary = guide_points() if hud.guide.mode > 0 else {}
		hud.guide.update(gp, cam, dt, guide_ctx(gp, cam.global_position) if not gp.is_empty() else {})
	var T := clock
	for t in lights:
		var u: Dictionary = light_state[t["id"]]
		var k: float = light_k(u, T)                              # its state, the story's changes over it, its flicker by mode (flicker.gd, as the desk's)
		k *= float(scene_light_k.get(t["id"], 1.0))
		k *= float(near_light_k.get(t["id"], 1.0))                 # someone near it (her `near` lamps, FLASHLIGHT_PLAN §2b)
		u["level"] = float(u["base"]) * k
		if t["node"] is Light3D:
			t["node"].light_energy = float(u["level"])
		else:
			fitting_light(t, k)
	mains_tick()
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
	beam_watch(dt)
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


## whether a person wants something from the player now: a `gave` trigger naming her in the playing stitch's beats or
## to-dos (STORY_FORMAT §4: she asked for it; anything in the hand is offered, the trigger says if it's the right one)
func wants_from(who) -> bool:
	for b in stitch_now.get("beats", []):
		if _gives_to(b.get("when"), who):
			return true
	if todo != null:
		for td in todo.list:
			if td.get("state", "open") == "open" and (_gives_to(td.get("ticks"), who) or _gives_to(td.get("fails"), who)):
				return true
	return false


func _gives_to(w, who) -> bool:
	if not (w is Dictionary):
		return false
	if w.has("gave"):
		return w.get("to") == who
	for k in ["all", "any"]:
		if w.get(k) is Array:
			for c in w[k]:
				if _gives_to(c, who):
					return true
	return false
