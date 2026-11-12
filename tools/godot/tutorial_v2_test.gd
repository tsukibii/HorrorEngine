## TUTORIAL2's playthrough (tools/godot/tutorial_v2.py): guides/tutorial_v2's main.tscn played headless as a person
## plays it (--fixed-fps 60). Up the stairwell's dog-leg; the stair door; the corridor's lights dimming and coming back;
## 304 locked; the note under its door; the linen closet's key and the corridor's lights going out one by one and back
## (each tube's fitting glass with it);
## 304 unlocked, its moment (the music to dread, the TV's static); the flashlight running low, dying, and the vending
## corner's batteries going in; her in the corridor backing off from the light, flashed twice and the corridor going dark;
## the hush before the jump scare at the fire exit; the fire door and the ending. The air: the stairwell's dustier
## air while in it (an HSAirZone), the flashlight's beam in it, the fog rolling in when the corridor goes dark, the tape
## breaking up at the jump, her wet look. Making it intense: the sound physics (the rooms' surfaces, the floors' steps,
## the stairwell ringing longer than the corridor, a knock muffled behind 304's door), the steps behind you, your body
## under fear, the figure at the corner of your eye (at 308's door, gone as you turn to it), the one closer each time
## you look away (out of 304's bath, then behind you), her in the bath's mirror only (in the tub behind you, nobody when
## you turn round), a shadow that isn't yours (crossing 304's wall, the lamp behind you), feet under 308's door once the
## corridor's dark, her signs (the tubes by her and your flashlight dipping, the radio's static), her menace sending her
## away a while, being hunted once the corridor's dark (heard running, she comes for the linen closet's corner and stands
## in its doorway, your breath held; your gasp brings her back and she pulls you out), and the night's director (its moments, never in the stairwell or under a card, its peak and relax).
## Every system since (DECISIONS 2026-11-10, after that): the UI plugin's HUD and quest markers coming and going with the
## to-do list; a $20 note into the Story's cash; the devices plugin's laptop on 304's desk (its own catalog a page a
## category, the shotgun a ? until the knocks, the explosive shells until the gun's come), clicked through its glass,
## parcels left at 304's door unseen with a marker each, E: the gun flying into the hands and drawn up, the shells into
## its pocket; the weapons plugin: the kettle (its LED and steam) and the mug of tea (its level) shot to pieces, a reload,
## the entry's bulb shot out, the explosive's kind picked with T, her who hunts shot down into black smoke (the hunt
## stopped, her dissolving, the line). Prints `TUTORIAL <what> <how>` lines and `TUTORIAL result {errors}`, quits.
extends SceneTree

const Lights := preload("res://starter/lights.gd")

var errors: Array = []
var main: Node3D
var player: CharacterBody3D
var story: Node
var sound: Node
var torch: SpotLight3D
var cfg: Dictionary


func say(what: String, how: String) -> void:
	print("TUTORIAL %s %s" % [what, how])


func bad(e: String) -> void:
	errors.append(e)
	print("TUTORIAL ERROR %s" % e)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 60.0)))


func v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func key(code: int, down: bool) -> void:
	var e := InputEventKey.new()
	e.physical_keycode = code as Key
	e.keycode = code as Key
	e.pressed = down
	Input.parse_input_event(e)


func hold(code: int, t: float) -> void:
	key(code, true)
	await secs(t)
	key(code, false)
	await frames(2)


func press(code: int) -> void:
	key(code, true)
	await frames(2)
	key(code, false)
	await frames(2)


## the player standing at `at` (its feet), looking at `p`
func stand(at: Vector3, p: Vector3) -> void:
	player.global_position = at
	player.velocity = Vector3.ZERO
	look(p)


func look(p: Vector3) -> void:
	var eye := player.get_node("Eye") as Camera3D
	var d := p - player.global_position
	player.rotation = Vector3(0, atan2(-d.x, -d.z), 0)
	var e := p - eye.global_position
	player.pitch = atan2(e.y, Vector2(e.x, e.z).length())
	eye.rotation = Vector3(player.pitch, 0, 0)


func use_at(at: Vector3, p: Vector3) -> Node:
	stand(at, p)
	await frames(3)
	return player.use()


func tubes() -> Array:
	return main.get_node("Zones/Corridor").get_children().filter(func(n): return n is Light3D)


## the tape's preset now: the VHS layer's, "off" when it's hidden
func _tape_now() -> String:
	for n in root.find_children("*", "CanvasLayer", true, false):
		if n.has_method("preset") and n.get("preset_name") != null:
			return str(n.preset_name) if n.visible else "off"
	return "none"


## the view turned, a little at a time, until the cue's spot is in `region` of the frame (true when it is)
func aim_region(cue: Node, region: String) -> bool:
	var eye := player.get_node("Eye") as Camera3D
	for i in 60:
		await frames(1)
		if cue.regions(eye).has(region):
			return true
		player.rotation.y += deg_to_rad(2.0)                # turning left: the spot slides right
		player.pitch -= deg_to_rad(1.2)                     # looking down: it rises
		eye.rotation.x = player.pitch
	return false


func door(id: String) -> Node3D:
	return main.get_node("Hotel").find_child("door_" + id, true, false) as Node3D


## a step that never comes back (a script error stops a coroutine where it is): what's known so far, then out
func _watchdog() -> void:
	bad("the playthrough stopped before the end (a script error above?)")
	print("TUTORIAL result " + JSON.stringify({"errors": errors}))
	quit()


func _initialize() -> void:
	create_timer(1000.0).timeout.connect(_watchdog)
	cfg = JSON.parse_string(FileAccess.get_file_as_string("res://tutorial.json"))
	var ms := load("res://main.tscn") as PackedScene
	if ms == null:
		bad("main.tscn doesn't load")
		print("TUTORIAL result " + JSON.stringify({"errors": errors}))
		quit()
		return
	main = ms.instantiate() as Node3D
	root.add_child(main)
	await frames(5)
	player = main.get_node("Player") as CharacterBody3D
	story = main.get_node("Story")
	sound = main.get_node("Sound")
	torch = player.get_node("Eye/Flashlight") as SpotLight3D
	var her := main.get_node("Her") as Node3D
	var again := main.get_node("HerAgain") as Node3D
	var fl := float(cfg["floor"])
	# the night's director (dread.gd): faster for the check (the game's own gaps are 25 to 70 s); each moment checked as it comes
	main.get_node("Weather/Lightning").every = 0.0         # (the check's: its own strikes only when asked, below)
	var dread: Node = main.get_node("Dread")
	dread.gap_min = 6.0
	dread.gap_max = 9.0
	dread.relax_min = 8.0
	dread.relax_max = 10.0
	var phases := {}
	process_frame.connect(func() -> void: phases[dread.phase] = true)
	var moment_bad: Array = []
	var moment_prev := [""]
	dread.moment.connect(func(nm: String) -> void:
		var stairs_y := player.global_position.y < fl - 0.5 or player.global_position.z < float(cfg["rooms"]["corridor"]["at"][2]) - float(cfg["rooms"]["corridor"]["size"][2]) / 2.0 - 0.2 and player.global_position.x < 2.6
		if story.card_up() or story.over or nm == moment_prev[0] or stairs_y:
			moment_bad.append("%s (card %s, over %s, again %s, in the stairwell %s)" % [nm, story.card_up(), story.over, nm == moment_prev[0], stairs_y])
		moment_prev[0] = nm)
	# 0. the scene as the guide builds it
	var d304 := door("door_304")
	var fire := door("corridor_e_door")
	say("scene", "%d doors with door.gd, 304 locked by %s, the fire door's %s; the to-do: %s; she's %s" % [
		main.get_node("Hotel").doors().filter(func(d): return d.has_method("lock")).size(), d304.lock() if d304 else "?",
		"wired" if fire and fire.is_connected("opened", Callable(story, "end")) else "NOT wired", str(story._tasks.map(func(t): return t["id"])),
		"hidden" if not her.visible and not again.visible else "SHOWN"])
	if d304 == null or d304.lock() != "key_304":
		bad("304's door isn't locked by key_304 (the export's locked_by, door.gd)")
	if fire == null or not fire.is_connected("opened", Callable(story, "end")):
		bad("the fire door's opened isn't wired to the Story's end")
	if her.visible or again.visible:
		bad("she's there before her scare (scare_area.gd hides who appears)")
	# her looks (guide §30: the look plugin's HSLookSwitch): the two saved looks in their switches, both of them in her default so far
	var her_looks: Node = main.get_node_or_null("Her/Looks")
	var hunt_looks: Node = main.get_node_or_null("Events/Hunter/Looks")
	if her_looks == null or hunt_looks == null:
		bad("no HSLookSwitch under her or under the one who hunts (Her/Looks, Events/Hunter/Looks)")
	else:
		say("her looks", "her switch has %s, the hunter's %s (fire: %s); so far she's in %s and %s" % [str(Array(her_looks.names())), str(Array(hunt_looks.names())), hunt_looks.on_fire,
			"her default" if her_looks.current() == "" else her_looks.current(), "her default" if hunt_looks.current() == "" else hunt_looks.current()])
		if Array(her_looks.names()) != ["empty"] or Array(hunt_looks.names()) != ["hunting"] or her_looks.current() != "" or hunt_looks.current() != "" or HSEyeFx.worn(her).size() != 0:
			bad("her looks at the start (looks/empty.tres under her, looks/hunting.tres under the hunter, both in their default): %s %s, in '%s' and '%s'" % [
				str(Array(her_looks.names())), str(Array(hunt_looks.names())), her_looks.current(), hunt_looks.current()])
	var m304: Node = main.get_node("Markers/Room304")
	var mkey: Node = main.get_node("Things/Key/Marker")
	var marks0 := [m304.shown(), mkey.shown(), main.get_node("Markers/FireExit").shown()]
	say("markers", "at the start: 304's %s (find304 open), the key's %s (no task yet), the fire exit's %s" % marks0)
	if marks0 != [true, false, false]:
		bad("the quest markers' needs (HSQuestMarker): 304's on:find304 shown, the key's on:key and the fire exit's on:out not yet: %s" % str(marks0))
	# 1. the stairwell: standing on the second floor's landing, up the dog-leg
	await frames(60)
	var y0 := player.global_position.y
	say("landed", "on the stairwell's landing at %.2f m: %s" % [y0, "standing" if player.is_on_floor() else "NOT on a floor"])
	if not player.is_on_floor() or absf(y0) > 0.1:
		bad("the player didn't land on the stairwell's landing (y %.2f)" % y0)
	var knock: AudioStream = sound.stream_of("knock_wood_01")
	var ahead: Vector3 = player.global_position + Vector3(0, 1.4, 0) - (player.get_node("Eye") as Node3D).global_basis.z * 2.0
	var in_well: Dictionary = sound.shape(knock, "SFX", ahead)
	var well_r: Dictionary = sound.last.get("result", {})
	var st: Dictionary = cfg["rooms"]["stairs"]
	var sx := float(st["at"][0])
	var half := float(st["size"][0]) / 4.0
	var north := float(st["at"][2]) - float(st["size"][2]) / 2.0
	var south := float(st["at"][2]) + float(st["size"][2]) / 2.0
	var climbed := false
	for side in [-1.0, 1.0]:                         # the first flight on one half, the second back on the other
		stand(Vector3(sx + side * half, 0.05, south - 0.6), Vector3(sx + side * half, 0.05 + 1.6, north))
		await frames(20)
		await hold(KEY_W, 3.5)
		if player.global_position.y > 1.0:
			var y1 := player.global_position.y
			stand(Vector3(sx - side * half, y1 + 0.05, player.global_position.z), Vector3(sx - side * half, y1 + 1.6, south))
			await frames(10)
			await hold(KEY_W, 3.5)
			say("stairs", "up the flight on the %s half to %.2f m, back up the other to %.2f m" % ["west" if side < 0 else "east", y1, player.global_position.y])
			climbed = player.global_position.y > fl - 0.15
			break
	if not climbed:
		bad("the stairwell's dog-leg wasn't climbed to the third floor (at %.2f m)" % player.global_position.y)
		player.global_position = Vector3(sx, fl + 0.05, south - 0.6)
	var air: Node = main.get_node("Air")
	var in_stairs := float(air.now()["fog"])
	var shaft: Node = main.get_node("Weather/StairShaft")
	var leak: Node = main.get_node("Dressing/Leak")
	var puddle: Node = main.get_node("Dressing/Puddle")
	var glass_mi := main.get_node("Hotel").find_child("stairs_fx_win1", true, false).find_child("kit_glass", true, false) as GeometryInstance3D
	var glass_clear := glass_mi != null and glass_mi.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	say("stairwell's air", "the fog at %.2f (the zone's 0.45, the level's %.2f); its window: the shaft %s, the glass %s, the leak %s, the puddle %s" % [in_stairs, air.fog,
		"drawn" if shaft.beam != null else "MISSING", "letting the lamp through" if glass_clear else "CASTING A SHADOW",
		"wet" if leak.leak != null else "DRY", "laid" if puddle.decal != null else "MISSING"])
	if in_stairs < 0.4:
		bad("the stairwell's air zone didn't thicken the air (HSAirZone: %.2f)" % in_stairs)
	if shaft.beam == null or leak.leak == null or puddle.decal == null:
		bad("the stairwell's window: the shaft, the leak and the puddle (the Look plugin's nodes)")
	if not glass_clear:
		bad("the stairwell window's glass casts a shadow: the street lamp's light can't come through (interior.gd clear_glass)")
	# 2. the stair door, into the corridor: up ticked, the lights dim for 3 s and come back
	var sd := door("stair_door")
	var sdp := sd.global_position + sd.global_basis.x * 0.42 + Vector3.UP * 1.0
	await use_at(Vector3(sdp.x, fl + 0.02, sdp.z - 0.9), sdp)
	await frames(50)
	say("stair door", "open" if sd.open else "SHUT")
	if not sd.open:
		bad("the stair door didn't open with E")
	var cz := float(cfg["rooms"]["corridor"]["at"][2])
	stand(Vector3(sdp.x + 0.6, fl + 0.02, cz), Vector3(sdp.x + 10.0, fl + 1.5, cz))
	await secs(0.8)
	var t1: Light3D = tubes()[0]
	var t5: Light3D = tubes()[4]
	var dimmed := maxf(Lights.level(t1), Lights.level(t5))
	await secs(4.0)
	var back := 0.0
	for i in 20:
		back = maxf(back, minf(Lights.level(t1), Lights.level(t5)))
		await frames(3)
	say("corridor", "up ticked: %s; the tubes at %.2f of their light, then %.2f; the music %s, a room tone %s" % [story.done("up"), dimmed, back, sound.now_mood, "playing" if sound.now_tone != null else "NONE"])
	if not story.done("up"):
		bad("walking into the corridor didn't tick 'up' (event_area.gd)")
	if not (dimmed < 0.3):
		bad("the corridor's lights didn't dim (scare_area.gd dim: %.2f)" % dimmed)
	if not (back > 0.8):
		bad("the corridor's lights didn't come back after 3 s (%.2f)" % back)
	if sound.now_mood != "uneasy" or sound.now_tone == null:
		bad("the Sound: music %s (uneasy), a tone %s" % [sound.now_mood, sound.now_tone])
	var in_corridor := float(air.now()["fog"])
	say("corridor's air", "the fog back to %.2f (the level's %.2f), dust %.2f" % [in_corridor, air.fog, float(air.now()["dust"])])
	# the sound physics (sound.gd, acoustics.gd: Woohill's): the rooms' surfaces, the floors' steps, the reverb
	var rooms: Dictionary = sound.rooms()
	var ahead2: Vector3 = player.global_position + Vector3(0, 1.4, 0) - (player.get_node("Eye") as Node3D).global_basis.z * 2.0
	sound.shape(knock, "SFX", ahead2)
	var corr_r: Dictionary = sound.last.get("result", {})
	var long_well := float(well_r.get("gains", [0, 0, 0, 0])[2]) + float(well_r.get("gains", [0, 0, 0, 0])[3])
	var long_corr := float(corr_r.get("gains", [0, 0, 0, 0])[2]) + float(corr_r.get("gains", [0, 0, 0, 0])[3])
	var floor_here: String = sound.floor_at(player.global_position)
	say("sound", "rooms %d (the stairwell's walls %s, the corridor's floor %s); the steps here %s (%d played so far); a knock's long tails in the stairwell %.3f, in the corridor %.3f; its stairwell hits %s" % [
		rooms.size(), rooms.get("stairs", {}).get("walls", "?"), rooms.get("corridor", {}).get("floor", "?"), sound.steps_for(floor_here),
		player.steps_heard, long_well, long_corr, str(well_r.get("hits", {}))])
	if rooms.get("stairs", {}).get("walls", "") != "concrete" or rooms.get("corridor", {}).get("floor", "") != "carpet":
		bad("the Sound didn't read the rooms' surfaces off the hotel's markers (the export's floor and sets): %s" % str(rooms).left(300))
	if sound.steps_for(floor_here) != "step_carpet" or player.steps_heard < 6:
		bad("the footsteps: the corridor's should be carpet (%s), and steps played on the way up (%d)" % [sound.steps_for(floor_here), player.steps_heard])
	if not (long_well > long_corr * 1.5 and long_well > 0.05):
		bad("the concrete stairwell should ring longer than the carpeted corridor: long tails %.3f against %.3f" % [long_well, long_corr])
	if absf(in_corridor - air.fog) > 0.05:
		bad("out of the stairwell the air didn't go back to the level's (%.2f against %.2f)" % [in_corridor, air.fog])
	# 3. 304 locked; the note under its door
	var dc := d304.global_position + d304.global_basis.x * 0.4 + Vector3.UP * 1.0
	await use_at(Vector3(dc.x, fl + 0.02, dc.z - 0.9), dc)
	await frames(10)
	say("304", "%s, it says %s" % ["SHUT" if not d304.open else "open", story._line.text])
	if d304.open or story._line.text != "Locked.":
		bad("304's door: locked and saying so (door.gd): open %s, '%s'" % [d304.open, story._line.text])
	var inside := dc + (dc - player.global_position).normalized() * 2.2   # through the door, in 304
	inside.y = fl + 1.2
	var shut_bus := str(sound.shape(knock, "SFX", inside).get("bus", "?"))
	var shut_bright := float(sound.last.get("result", {}).get("direct_bright", 1.0))
	var note := main.get_node("Things/Note") as Node3D
	await use_at(Vector3(note.global_position.x, fl + 0.02, note.global_position.z - 0.85), note.global_position)
	await frames(5)
	say("note", "its card %s, the task 'key' %s, its marker %s" % ["up" if story.card_up() else "NOT up", "added" if story.has_task("key") else "NOT added",
		"shown" if mkey.shown() else "NOT SHOWN"])
	if not story.card_up() or not story.has_task("key"):
		bad("reading the note (note.gd): its card and its task")
	if not mkey.shown():
		bad("the key's quest marker (needs on:key) should show once the note's added the task")
	await press(KEY_E)
	if story.card_up():
		bad("E didn't put the note's card away (player.gd)")
	# the corner of your eye (glimpse.gd, armed by the note): at 308's door 36 degrees off where you look, gone as you turn to it
	var gl: Node3D = main.get_node("Events/Glimpse")
	var gfig: Node3D = gl.figure
	var gp := gl.global_position + Vector3.UP * 1.3
	var gat := Vector3(8.0, fl + 0.02, cz)
	var geye := gat + Vector3.UP * 1.6
	var gdir := (gp - geye).normalized()
	var was_armed: bool = gl.armed
	stand(gat, geye + gdir.rotated(Vector3.UP, deg_to_rad(36.0)) * 5.0)
	var g_seen := false
	var g_ang := -1.0
	for i in 20:
		await frames(1)
		if gl.shown and not g_seen:
			g_seen = true
			g_ang = float(gl.off_view()[0])
	var tube5: Light3D = tubes()[4]
	var g_blink := 1.0
	var ga := 36.0
	while ga > 0.0 and gl.shown:                     # turning to it, a hundred degrees a second
		ga -= 1.7
		look(geye + gdir.rotated(Vector3.UP, deg_to_rad(ga)) * 5.0)
		await frames(1)
	for i in 14:
		g_blink = minf(g_blink, float(tube5.get_meta("hs_flick", 1.0)))
		await frames(1)
	say("glimpse", "armed by the note %s; at 308's door %s %.0f deg off where you looked; gone as you turned to it at %.0f deg (%s), the tube by it blinking to %.2f" % [
		was_armed, "seen" if g_seen else "NOT SEEN", g_ang, gl.went_at, "hidden" if not gfig.visible else "STILL THERE", g_blink])
	if not was_armed or not g_seen or g_ang < 29.0 or g_ang > 43.0:
		bad("the glimpse (glimpse.gd): armed by the note's read %s, shown 30 to 42 deg off where you look %s (%.0f)" % [was_armed, g_seen, g_ang])
	if gfig.visible or gl.went_at < 25.0 or g_blink > 0.5:
		bad("the glimpse should go as you turn to it, before 25 deg, in the tube's blink: still there %s, at %.0f deg, the tube to %.2f" % [gfig.visible, gl.went_at, g_blink])
	# the director's moments, brought on here in the corridor (its gap cut to nothing twice): two, not the same, each played
	var asked := []
	for k in 2:
		dread.intensity = 0.2
		dread.phase = "build"
		dread._next = 0.0
		await frames(3)
		asked.append(dread.fired.back()["name"] if not dread.fired.is_empty() else "")
	var played: bool = asked.all(func(nm): return nm != "" and int(main.get_node("Moments/" + nm).count) >= 1)
	say("the director here", "brought on twice in the corridor: %s, each played %s" % [str(asked), played])
	if asked[0] == asked[1] or not played:
		bad("the dread director's moments (dread.gd, dread_moment.gd): %s, played %s (two, not the same)" % [str(asked), played])
	# lightning (the Look plugin's HSLightningStorm): a strike while you look down the corridor to the end window; someone there in the flash
	var storm: Node = main.get_node("Weather/Lightning")
	var flash_fig: Node3D = main.get_node("Events/InTheFlash")
	look(Vector3(0.5, fl + 1.4, cz))
	storm.fire()
	var lit_seen := false
	var fig_in_flash := false
	var fig_after := true
	var lit_max := 0.0
	for i in 40:
		await frames(1)
		var st2: HSLightning = storm.storm
		lit_max = maxf(lit_max, st2.light.light_energy)
		lit_seen = lit_seen or st2.level > 0.9
		fig_in_flash = fig_in_flash or (flash_fig.visible and st2.level > 0.5)
	for i in 60:
		await frames(1)
	fig_after = flash_fig.visible
	var thunder_heard := false
	for i in 180:
		await frames(1)
		thunder_heard = thunder_heard or storm.storm.player.playing
	say("lightning", "a strike: the flash to %.1f (%s), someone by the end window in it %s, gone after %s; the thunder 3.6 s later on %s %s" % [
		lit_max, lit_seen, fig_in_flash, not fig_after, storm.storm.player.bus, "heard" if thunder_heard else "NOT HEARD"])
	if not lit_seen or lit_max < 3.9 or not fig_in_flash or fig_after or not thunder_heard:
		bad("the lightning (HSLightningStorm): the flash %.1f, the figure in it %s and gone after %s, the thunder %s" % [lit_max, fig_in_flash, not fig_after, thunder_heard])
	# the cold (cold_area.gd, the Look plugin's HSBreath and HSGlass.frost): the metre by the end window is freezing. Your
	# breath shows, the window frosts up from its bottom edge; walk away and the breath stops, the frost going
	var cold: Area3D = main.get_node("Events/ColdSpot")
	var pane_n: Node = main.get_node("Weather/Pane")
	var lvl0 := float(cold.level)
	stand(Vector3(0.45, fl + 0.02, cz + 0.2), Vector3(0.0, fl + 1.3, cz))     # at the end window, looking at it
	await secs(2.5)
	var br: HSBreath = player.get_node_or_null("Eye/Breath")
	var breaths: int = br.count if br != null else 0
	var puffs_now: int = br.puffs() if br != null else 0
	var lvl1 := float(cold.level)
	var glass_frost := 0.0
	for gm in pane_n.applied:
		var sm := (gm as MeshInstance3D).material_override as ShaderMaterial
		if sm != null:
			glass_frost = maxf(glass_frost, float(sm.get_shader_parameter("frost")))
	stand(Vector3(4.0, fl + 0.02, cz), Vector3(8.0, fl + 1.5, cz))              # back down the corridor
	await secs(1.0)
	var lvl2 := float(cold.level)
	var still_breathing: bool = br != null and br.on
	say("the cold", "by the end window (frost %.2f before): %d breaths out in 2.5 s (%d puffs in the air), the window frosting up to %.2f (its glass at %.2f); walked away: breathing %s, the frost going to %.2f" % [
		lvl0, breaths, puffs_now, lvl1, glass_frost, still_breathing, lvl2])
	if lvl0 > 0.01 or breaths < 1 or puffs_now < 1 or lvl1 < 0.2 or absf(glass_frost - lvl1) > 0.02 or still_breathing or lvl2 >= lvl1:
		bad("the cold (cold_area.gd): frost before %.2f, breaths %d, puffs %d, the frost %.2f (its glass %.2f), still breathing after %s, thawing %.2f to %.2f" % [lvl0, breaths, puffs_now, lvl1, glass_frost, still_breathing, lvl1, lvl2])
	# 4. the linen closet: its door, the key; the corridor's lights out one by one, the farthest first, and back
	var ld := door("door_linen")
	var lc := ld.global_position + ld.global_basis.x * 0.38 + Vector3.UP * 1.0
	await use_at(Vector3(lc.x, fl + 0.02, lc.z + 0.9), lc)
	await frames(50)
	var kk := main.get_node("Things/Key") as Node3D
	var on_before := tubes().filter(func(l): return Lights.is_on(l)).size()
	var used = await use_at(Vector3(kk.global_position.x, fl + 0.02, kk.global_position.z + 0.75), kk.global_position)
	var order := []
	for i in 180:
		await frames(1)
		for l in tubes():
			if not Lights.is_on(l) and not order.has(l.name):
				order.append(l.name)
	say("key", "%s; the tubes going out: %s" % ["picked" if story.has("key_304") else "NOT picked (used %s)" % used, order])
	if not story.has("key_304") or not story.done("key"):
		bad("the key (pickup.gd): in the pocket and its task ticked")
	if order.size() != on_before or (order.size() > 1 and order[0] != "Tube5"):
		bad("the lights didn't go out one by one, the farthest first (%s)" % [order])
	await secs(4.5)
	if tubes().any(func(l): return not Lights.is_on(l)):
		bad("the corridor's lights didn't come back after the one by one")
	var czone: Node = main.get_node("Zones/Corridor")
	var lit_glass := tubes().filter(func(l): return czone.glass_of(l) > 0.5).size()
	say("glass", "%d of %d tubes' fittings glowing with their lights back" % [lit_glass, tubes().size()])
	if lit_glass != tubes().size():
		bad("each tube's fitting glass didn't come back with its light (HSLightZone glass_follows: %d of %d)" % [lit_glass, tubes().size()])
	# 5. 304 opened with the key; its moment
	await use_at(Vector3(dc.x, fl + 0.02, dc.z - 0.9), dc)
	await frames(60)
	say("304", "%s with the key" % ("open" if d304.open else "STILL SHUT"))
	await frames(40)
	stand(Vector3(dc.x, fl + 0.02, dc.z - 0.9), dc)
	await frames(4)
	var open_bus := str(sound.shape(knock, "SFX", inside).get("bus", "?"))
	var open_bright := float(sound.last.get("result", {}).get("direct_bright", 0.0))
	say("through 304's door", "a knock inside: shut, on %s (its highs %.2f); open, on %s (%.2f)" % [shut_bus, shut_bright, open_bus, open_bright])
	if not shut_bus.begins_with("Muffled") or open_bright <= shut_bright + 0.2:
		bad("a sound behind 304's shut door should be muffled, and clearer once it's open: %s %.2f, then %s %.2f" % [shut_bus, shut_bright, open_bus, open_bright])
	if not d304.open:
		bad("304 didn't open with the key")
	var r304: Dictionary = cfg["rooms"]["r304"]
	stand(v3(r304["at"]) + Vector3(0.6, -float(r304["size"][1]) / 2.0 + 0.05, 0.4), v3(r304["at"]) + Vector3(2.0, 0.0, 0.0))
	await secs(1.0)
	var tv := main.get_node("Dressing/TV") as MeshInstance3D
	var crt_on := tv.material_override is ShaderMaterial or (tv.get_surface_override_material_count() > 0 and tv.get_surface_override_material(0) is ShaderMaterial)
	say("in 304", "find304 %s, music %s, the task 'out' %s, the TV's static %s" % [story.done("find304"), sound.now_mood, story.has_task("out"), "on" if crt_on else "OFF (" + str(tv) + ")"])
	if not story.done("find304") or sound.now_mood != "dread" or not story.has_task("out"):
		bad("304's moment (event_area.gd): find304, dread, the task out")
	if not crt_on:
		bad("the TV's screen hasn't the CRT shader (HSCrtScreen)")
	# closer each time you look away (closer.gd, armed by In304's entered): out of the bath a mark at a time, then behind you
	var cl: Node3D = main.get_node("Events/Closer")
	var cfig: Node3D = cl.figure
	# her face, wrong (uncanny.gd): a made-up face with MHR's shapes under her (the stand-in has none), her blinker
	var face := MeshInstance3D.new()
	face.name = "FaceProbe"
	var am := ArrayMesh.new()
	var shape_names := ["eyesClosed_L", "eyesClosed_R", "lipCornerPuller_L", "lipCornerPuller_R", "cheekRaiser_L", "cheekRaiser_R"]
	for nm in shape_names:
		am.add_blend_shape(nm)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(0, 1.5, 0.1), Vector3(0.05, 1.5, 0.1), Vector3(0, 1.55, 0.1)])
	var blends := []
	for nm in shape_names:
		var b := []
		b.resize(Mesh.ARRAY_MAX)
		b[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(0, 1.5, 0.11), Vector3(0.05, 1.5, 0.11), Vector3(0, 1.55, 0.11)])
		blends.append(b)
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, blends)
	face.mesh = am
	cfig.add_child(face)
	face.set_blend_shape_value(face.find_blend_shape_by_name("cheekRaiser_L"), 1.0)   # a real smile's cheeks, which she mustn't have
	var blinker := HSBlink.attach(cfig)
	var unc: Node = cfig.get_node("Uncanny")
	unc.stare = true
	unc._hook()
	await frames(3)
	var smile_l := face.get_blend_shape_value(face.find_blend_shape_by_name("lipCornerPuller_L"))
	var cheek_l := face.get_blend_shape_value(face.find_blend_shape_by_name("cheekRaiser_L"))
	say("her face, wrong", "the wrong smile: her mouth's corners %.2f, her cheeks %.2f; the dead stare: her blinker %s, idle %s" % [smile_l, cheek_l, "there" if blinker != null else "MISSING", blinker.idle if blinker != null else "?"])
	if absf(smile_l - 0.6) > 0.01 or cheek_l != 0.0 or blinker == null or blinker.idle:
		bad("uncanny.gd's face: the smile %.2f (0.6) with the cheeks %.2f (0), the blink off %s" % [smile_l, cheek_l, blinker != null and not blinker.idle])
	face.queue_free()
	if blinker != null:
		blinker.queue_free()
	var win := v3(cfg["boxes"]["window_304"]["at"])
	var caught := [0]
	cl.caught.connect(func() -> void: caught[0] += 1)
	var marks_seen := [cl.mark]
	look(cfig.global_position + Vector3.UP * 1.4)              # looked at, she stays
	await secs(2.5)
	var stayed: bool = cl.mark == 0
	for i in 3:
		look(win)                                              # away, at the window
		await secs(1.8)
		marks_seen.append(cl.mark)
		if i < 2:
			look(cfig.global_position + Vector3.UP * 1.4)       # and back: she's nearer
			await secs(0.4)
	var eye := player.get_node("Eye") as Camera3D
	var hd := cfig.global_position + Vector3.UP * 1.5
	var gap := Vector2(hd.x - eye.global_position.x, hd.z - eye.global_position.z).length()
	var at_back := (hd - eye.global_position).dot(-eye.global_basis.z) < 0.0
	var lamp304 := main.get_node("Zones/Room304/Lamp") as Light3D
	var fear_n: Node = main.get_node("Fear")
	var fear0 := float(fear_n.level)
	look(hd)                                                   # turn round
	var lamp_min := 1.0
	var fear1 := fear0
	for i in 90:
		await frames(1)
		lamp_min = minf(lamp_min, float(lamp304.get_meta("hs_flick", 1.0)))
		fear1 = maxf(fear1, float(fear_n.level))
	say("closer", "on the marks %s (stayed while looked at %s, steps taken while seen %d); behind you %.2f m from your eye (behind %s); turned round: caught %d, gone %s in the lamp's blink to %.2f, fear %.2f to %.2f" % [
		str(marks_seen), stayed, cl.moved_seen, gap, at_back, caught[0], not cfig.visible, lamp_min, fear0, fear1])
	if marks_seen != [0, 1, 2, 3] or not stayed or cl.moved_seen != 0:
		bad("closer each time (closer.gd): the marks %s (0, 1, 2, then 3: behind you), stayed while seen %s, steps taken while seen %d" % [str(marks_seen), stayed, cl.moved_seen])
	if absf(gap - 0.35) > 0.08 or not at_back:
		bad("she should end 0.35 m behind your eye: %.2f m, behind %s" % [gap, at_back])
	if caught[0] != 1 or cfig.visible or lamp_min > 0.5 or fear1 < fear0 + 0.2:
		bad("turned round: caught %d, then gone in the lamp's blink (gone %s, the lamp to %.2f), the Fear node's scare (%.2f to %.2f)" % [caught[0], not cfig.visible, lamp_min, fear0, fear1])
	# cues (cue.gd): what must be so, then what happens. Lying in 304's bed, her on the ceiling in the corner of your view
	# (a jump scare); sitting at its desk, three knocks at the door after watching the TV a while (not a scare). Here,
	# before she's in the corridor (she'd copy the steps walked below), and in the game's 16:9 frame (the regions are
	# the frame's: headless, Godot's window is 64 px square), put back after
	var size0 := root.size
	root.size = Vector2i(1600, 900)
	await frames(2)
	var bc: Node = main.get_node("Events/BedCeiling")
	var bfig: Node3D = bc.appear
	var bed_seat: Node3D = main.get_node("Things/Bed")
	var on_words := [story.holds("on:out"), story.holds("on:find304"), story.holds("on:batteries")]   # on the way out; 304 found; batteries not asked for yet
	var by_bed := Vector3(bed_seat.global_position.x + 0.9, fl + 0.02, bed_seat.global_position.z + 1.05)
	stand(by_bed, bc.where())
	var corner_standing: bool = await aim_region(bc, "any corner")
	await secs(3.5)
	var standing_count: int = bc.count                       # standing: nothing, her corner in view or not
	await use_at(by_bed, bed_seat.global_position + Vector3(0.9, -0.15, 0))   # E on the bed
	await frames(3)
	var lying_ok: bool = player.pose == "lying" and player.doing() == "lying" and eye.global_position.distance_to(bed_seat.global_position) < 0.05
	look(bc.where())                                         # straight at her place: the middle, not a corner
	await secs(3.5)
	var middle_count: int = bc.count
	player.rotation = Vector3(0, bed_seat.global_rotation.y, 0)   # the bed's own view, up past its foot
	player.pitch = deg_to_rad(70.0)
	eye.rotation = Vector3(player.pitch, 0, 0)
	await frames(1)
	var regs: Array = bc.regions(eye)
	var fear_b := float(fear_n.level)
	var dread_b := float(dread.intensity)
	var p0 := bfig.position
	var t_in := -1.0
	var t_out := -1.0
	var dropped := 0.0
	var lamp_lo := 1.0
	var fear_hi := fear_b
	var dread_hi := dread_b
	for i in 420:
		await frames(1)
		var t := (i + 1) / 60.0
		if t_in < 0.0 and bfig.visible:
			t_in = t
		if t_in >= 0.0 and t_out < 0.0:
			if bfig.visible:
				dropped = maxf(dropped, p0.y - bfig.position.y)
			else:
				t_out = t
		lamp_lo = minf(lamp_lo, float(lamp304.get_meta("hs_flick", 1.0)))
		fear_hi = maxf(fear_hi, float(fear_n.level))
		dread_hi = maxf(dread_hi, float(dread.intensity))
		if t_out > 0.0 and t > t_out + 0.3:
			break
	var sting: String = str(bc.heard.stream.resource_path) if bc.heard != null and bc.heard.stream != null else "none"
	var fired1: int = bc.count
	var shown1 := float(bc.shown_for)
	# and again with Until Looked At (the check's: no sound, not a scare): there while her place is in the corner of
	# your view, gone at once as you turn to her
	bc.once = false
	bc.cooldown = 0.0
	bc.hush = 0.0
	bc.after_secs = 0.3
	bc.appear_for = 3.0
	bc.until_looked_at = true
	bc.vanish = "at once"
	bc.sound = ""
	bc.scare = false
	var seen2 := false
	for i in 90:
		await frames(1)
		if bfig.visible:
			seen2 = true
			break
	await frames(10)
	var stayed2: bool = bfig.visible
	look(bc.where())                                         # turn to her
	var gone_in := -1
	for i in 30:
		await frames(1)
		if not bfig.visible:
			gone_in = i + 1
			break
	bc.armed = false
	await press(KEY_E)                                       # up again
	var up_ok: bool = player.pose == "standing" and player.global_position.distance_to(by_bed) < 0.05 and absf(eye.position.y - 1.6) < 0.01
	say("cue in the bed", "on:out %s, on:find304 %s, on:batteries %s; standing with her corner in a corner of your view (%s): %d; lying %s; looking straight at it: %d; the bed's view %s: after %.2f s she was there %.2f s (shown %.2f), the sting %s, the lean %s (down %.2f m), the lamp's blink to %.2f, fear %.2f to %.2f, the director %.2f to %.2f; again until looked at: there %s, stayed in the corner of your view %s, gone %d frames after you turned to her; E: up where you stood %s" % [
		on_words[0], on_words[1], on_words[2], corner_standing, standing_count, lying_ok, middle_count, str(regs), t_in, t_out - t_in, shown1, sting.get_file(),
		bc.animated, dropped, lamp_lo, fear_b, fear_hi, dread_b, dread_hi, seen2, stayed2, gone_in, up_ok])
	if on_words != [true, false, false]:
		bad("the Story's on:<task> (story.gd holds): on:out %s (true), on:find304 %s (done: false), on:batteries %s (not on the list: false)" % on_words)
	if not corner_standing or standing_count != 0 or not lying_ok or middle_count != 0:
		bad("the bed's cue fired where it shouldn't, or you didn't lie down: her corner in view standing %s, fired %d; lying %s; looking straight at her place, fired %d" % [corner_standing, standing_count, lying_ok, middle_count])
	if not regs.has("top right") or not regs.has("any corner") or regs.has("middle"):
		bad("from the bed her place should be in the top right corner of your view: %s" % str(regs))
	if fired1 != 1 or t_in < 2.9 or t_in > 3.5 or absf(t_out - t_in - 1.0) > 0.12 or absf(shown1 - 1.0) > 0.05 or not sting.contains("sting_big") or bc.animated != "lean" or dropped < 0.2:
		bad("the bed's cue (cue.gd): fired %d, there after %.2f s (2 s lying, a 1 s hush), for %.2f s (1; its own count %.2f), the sting %s, the lean %s (down %.2f m)" % [fired1, t_in, t_out - t_in, shown1, sting, bc.animated, dropped])
	if lamp_lo > 0.5 or fear_hi < minf(1.0, fear_b + 0.2) or dread_hi < minf(1.0, dread_b + 0.25):
		bad("the bed's cue: gone in the lamp's blink (%.2f), you jumped (fear %.2f to %.2f), the director heard it (%.2f to %.2f)" % [lamp_lo, fear_b, fear_hi, dread_b, dread_hi])
	if not seen2 or not stayed2 or gone_in < 1 or gone_in > 3:
		bad("the bed's cue with Until Looked At: there %s, stayed while in the corner of your view %s, gone %d frames after you turned to her (at most 3)" % [seen2, stayed2, gone_in])
	if not up_ok:
		bad("E in the bed should get you up where you stood: %s at %s, the eye at %.2f" % [player.pose, str(player.global_position), eye.position.y])
	var dk: Node = main.get_node("Events/DeskKnock")
	var chair_seat: Node3D = main.get_node("Things/Chair")
	var by_chair := Vector3(chair_seat.global_position.x - 0.75, fl + 0.02, chair_seat.global_position.z + 0.4)
	await use_at(by_chair, chair_seat.global_position + Vector3(0, -0.6, 0))   # E on the chair
	await frames(3)
	var sitting_ok: bool = player.pose == "sitting" and player.doing() == "sitting" and eye.global_position.distance_to(chair_seat.global_position) < 0.05
	look(v3(cfg["boxes"]["window_304"]["at"]))               # the window, not the TV
	await secs(3.0)
	var away_count: int = dk.count
	look(dk.where())                                         # the TV's static, in the middle of your view
	await frames(1)
	var tv_regs: Array = dk.regions(eye)
	var t_knock := -1.0
	for i in 240:
		await frames(1)
		if dk.count > 0:
			t_knock = (i + 1) / 60.0
			break
	await frames(3)
	var knock_heard: String = str(dk.heard.stream.resource_path) if dk.heard != null and dk.heard.stream != null else "none"
	var line: String = story._line.text if story._line.visible else ""
	var knocked: bool = story.is_set("knocked_304")
	var fear_k := float(fear_n.level)
	await press(KEY_E)
	var up2: bool = player.pose == "standing" and player.global_position.distance_to(by_chair) < 0.05
	look(player.global_position + Vector3(0.0, 1.6, -3.0))   # north, into the room (west is the bed)
	key(KEY_W, true)
	await frames(20)
	var walking: String = player.doing()
	key(KEY_SHIFT, true)
	await frames(20)
	var running: String = player.doing()
	key(KEY_SHIFT, false)
	key(KEY_W, false)
	await frames(6)
	var still: String = player.doing()
	say("cue at the desk", "sitting %s; looking at the window 3 s: %d; at the TV (%s): three knocks after %.2f s (%s), the line \"%s\", the fact %s, not a scare (fear %.2f); up %s; walking %s, running %s, then %s; %.0f s into the playthrough" % [
		sitting_ok, away_count, str(tv_regs), t_knock, knock_heard.get_file(), line, knocked, fear_k, up2, walking, running, still, Engine.get_physics_frames() / 60.0])
	if not sitting_ok or away_count != 0 or not tv_regs.has("middle") or dk.count != 1 or t_knock < 1.95 or t_knock > 2.3 or not knock_heard.contains("knock_three") or line != "Three knocks. Someone is at the door." or not knocked:
		bad("the desk's cue (cue.gd): sitting %s, fired looking away %d, the TV in the middle %s, fired %d after %.2f s (2), its knock %s, the line \"%s\", the fact %s" % [sitting_ok, away_count, str(tv_regs), dk.count, t_knock, knock_heard, line, knocked])
	if not up2 or walking != "walking" or running != "running" or still != "standing":
		bad("the player's doing(): up from the chair %s, walking %s, running %s, still %s" % [up2, walking, running, still])
	root.size = size0
	await frames(2)
	# only in the mirror (mirror_figure.gd, armed by InBath): her in the tub behind you in the bath's mirror; nobody when you turn round
	var bd := door("door_304_bath")
	var bdp := bd.global_position + bd.global_basis.x * 0.38 + Vector3.UP * 1.0
	await use_at(Vector3(bdp.x + 0.9, fl + 0.02, bdp.z), bdp)
	await frames(50)
	var mg := v3(cfg["boxes"]["mirror"]["at"])
	var mh: Node3D = main.get_node("Events/MirrorHer")
	var mfig: Node3D = mh.figure
	stand(Vector3(mg.x + 0.15, fl + 0.02, mg.z + 1.03), mg + Vector3(0, -0.05, 0))     # at the basin, looking in the mirror
	await secs(1.5)
	var glass_m: Node = null
	for m in get_nodes_in_group("hs_mirror"):
		glass_m = m
	var meshes := mfig.find_children("*", "GeometryInstance3D", true, false)
	var on19 := meshes.size() > 0 and meshes.all(func(g): return g.layers == 1 << 18 and g.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF)
	var eye19 := (eye.cull_mask & (1 << 18)) != 0
	var mirror19: bool = glass_m != null and glass_m.mcam != null and (glass_m.mcam.cull_mask & (1 << 18)) != 0
	var m_seen: bool = mh.was_seen
	var wall_out: int = glass_m.hid.size() if glass_m != null else 0           # the corridor's wall and the bath's lining on it
	look(mfig.global_position + Vector3.UP * 1.45)             # turn round: the tub
	await frames(6)
	say("only in the mirror", "the bath's door %s; at the basin, her in the tub behind you in the glass %.1f s (seen %s); her meshes on layer 19 alone with no shadow %s, your eye drawing 19 %s, the mirror's camera %s, its wall and lining out of its picture %d; turned round: %s" % [
		"open" if bd.open else "SHUT", float(mh.seen_for), m_seen, on19, eye19, mirror19, wall_out, "nobody" if not mfig.visible else "SHE'S THERE"])
	if not bd.open or not m_seen or not on19 or eye19 or not mirror19 or mfig.visible or wall_out < 2:
		bad("only in the mirror (mirror_figure.gd, HSMirror.only_in_mirrors): the door %s, seen in the glass %s, on layer 19 %s, the eye leaving 19 out %s, the mirror's camera drawing it %s, its wall hidden %d, gone when you turned round %s" % [
			bd.open, m_seen, on19, not eye19, mirror19, wall_out, not mfig.visible])
	# a shadow that isn't yours (shadow_pass.gd, armed when she's gone from the mirror): 304's floor lamp behind you, her shadow across the wall ahead
	var sp: Node3D = main.get_node("Events/ShadowPass")
	var sfig: Node3D = sp.figure
	var passed := [0]
	sp.passed.connect(func() -> void: passed[0] += 1)
	var lamp_at := v3(cfg["lamp304"])
	var r3: Dictionary = cfg["rooms"]["r304"]
	var at3 := v3(r3["at"]) + Vector3(-0.9, -float(r3["size"][1]) / 2.0 + 0.05, -1.2)   # between the bed's head and the bath's wall
	var sp_armed: bool = sp.armed
	stand(at3, Vector3(at3.x, fl + 1.3, at3.z - 2.0))              # facing the bath's wall, the floor lamp behind you
	var only_shadow := true
	var behind_ok := false
	var swept := 0.0
	var first := Vector3.INF
	for i in 150:
		await frames(1)
		if sfig.visible:
			for g in sfig.find_children("*", "GeometryInstance3D", true, false):
				only_shadow = only_shadow and g.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
			var off := (sfig.global_position - player.global_position) * Vector3(1, 0, 1)
			behind_ok = behind_ok or (off.length() < 1.3 and off.dot((lamp_at - player.global_position) * Vector3(1, 0, 1)) > 0.0)
			if first == Vector3.INF:
				first = sfig.global_position
			swept = maxf(swept, sfig.global_position.distance_to(first))
	say("a shadow not yours", "armed when she left the mirror %s; facing the bath's wall with the floor lamp behind you: someone crossed behind you %.1f m (between you and the lamp %s, only a shadow %s), over %s, nobody now %s" % [
		sp_armed, swept, behind_ok, only_shadow, passed[0] == 1, not sfig.visible])
	if not sp_armed or passed[0] != 1 or not only_shadow or not behind_ok or swept < 1.0 or sfig.visible:
		bad("a shadow that isn't yours (shadow_pass.gd): armed %s, passed %d, shadows only %s, behind you toward the lamp %s, %.1f m across, gone %s" % [sp_armed, passed[0], only_shadow, behind_ok, swept, not sfig.visible])
	# writing in the steam (steam_mirror.gd, its cue armed when she left the mirror; HSMirror's steam and writing): back at
	# the basin, a moment looking into the mirror and it fogs over from the bottom, 308 showing in it; then it clears
	var steam_cue: Node3D = main.get_node("Events/MirrorSteam")
	var stm: Node = main.get_node("Events/Steam")
	var mirror_n: Node = main.get_node("Dressing/Mirror")
	stm.steam_seconds = 3.0                                    # (the check's: the game's are 6, 20 and 10 s)
	stm.hold = 1.0
	stm.clear_seconds = 1.5
	var ms_armed: bool = steam_cue.armed
	stand(Vector3(mg.x + 0.15, fl + 0.02, mg.z + 1.03), mg + Vector3(0, -0.05, 0))      # at the basin again, looking into the mirror
	player.set("_was", Vector3.INF)                          # (a jump, not a stride: she's out now and would copy it as a step)
	var t_steam := -1.0
	var top_steam := 0.0
	for i in 360:
		await frames(1)
		if t_steam < 0.0 and int(steam_cue.count) > 0:
			t_steam = (i + 1) / 60.0
		top_steam = maxf(top_steam, float(stm.level))
		if stm.phase == "holding":
			break
	var hm: HSMirror = mirror_n.get("mirror")
	var glass_steam: float = float(hm.mat.get_shader_parameter("steam")) if hm != null else -1.0
	var glass_words: String = hm.written if hm != null else ""
	var writing_on: float = float(hm.mat.get_shader_parameter("writing")) if hm != null else 0.0
	for i in 240:
		await frames(1)
		if stm.phase == "idle":
			break
	var cleared_ok: bool = stm.phase == "idle" and float(stm.level) == 0.0 and (hm == null or hm.written == "")
	say("writing in the steam", "armed when she left the mirror %s; looking into it a moment: steaming after %.2f s, fogged to %.2f (the glass at %.2f), the words on it \"%s\" (writing %.1f); cleared %s" % [
		ms_armed, t_steam, top_steam, glass_steam, glass_words, writing_on, cleared_ok])
	if not ms_armed or t_steam < 0.95 or t_steam > 1.3 or top_steam < 0.99 or glass_steam < 0.99 or glass_words != "308" or writing_on < 0.5 or not cleared_ok:
		bad("writing in the steam (steam_mirror.gd, HSMirror): armed %s, after %.2f s (1), steam %.2f, the glass %.2f, the words \"%s\" (%.1f), cleared %s" % [ms_armed, t_steam, top_steam, glass_steam, glass_words, writing_on, cleared_ok])
	# 6. the flashlight: on, low, dead
	await press(KEY_F)
	await frames(5)
	var beam: Node = torch.get_node("AirBeam")
	var beam_on: bool = beam.hull != null and beam.hull.visible
	torch.charge = 0.302
	await secs(1.5)
	var was_low: bool = story.has_task("batteries")
	torch.charge = 0.035
	await secs(2.0)
	var dead_now: bool = torch.is_dead and not torch.visible
	var beam_dead: bool = beam.hull == null or not beam.hull.visible
	await press(KEY_F)
	say("flashlight", "on (its beam in the air %s, the cookie %s), ran low (%s), died (%s, the beam %s), F only clicks: %s" % ["drawn" if beam_on else "NOT DRAWN",
		"on" if torch.light_projector != null else "OFF", was_low, dead_now, "gone" if beam_dead else "STILL THERE", not torch.visible])
	if not beam_on or torch.light_projector == null or not beam_dead:
		bad("the flashlight's beam (its AirBeam, HSBeam): drawn while on %s, the cookie %s, gone when dead %s" % [beam_on, torch.light_projector != null, beam_dead])
	if not was_low or not dead_now or torch.visible:
		bad("the flashlight's battery (flashlight.gd): low %s, dead %s, lit after F %s" % [was_low, dead_now, torch.visible])
	# 7. out through the entry (she's there now), the batteries in the vending corner
	var ent: Dictionary = cfg["rooms"]["r304_entry"]
	stand(v3(ent["at"]) + Vector3(0.3, -float(ent["size"][1]) / 2.0 + 0.05, 0.2), v3(ent["at"]) + Vector3(0.3, 0.0, -2.0))
	await secs(0.6)
	say("she", "%s at the end of the corridor" % ("there" if her.visible else "NOT there"))
	if not her.visible:
		bad("walking back out of 304 didn't show her (scare_area.gd, needs task:find304)")
	var bt := main.get_node("Things/Batteries") as Node3D
	await use_at(Vector3(bt.global_position.x, fl + 0.02, bt.global_position.z + 0.75), bt.global_position)
	await secs(2.6)
	say("batteries", "picked %s, the flashlight %s at %.2f, the task %s" % [story.has("batteries"), "lit" if torch.visible else "DARK", torch.charge, "ticked" if story.done("batteries") else "NOT ticked"])
	if not torch.visible or torch.charge < 0.99 or not story.done("batteries"):
		bad("the batteries (pickup.gd): the flashlight lit again at full, the task ticked")
	# her signs (presence.gd): the radio on the table hissing as she's near
	var pres: Node = her.get_node("Presence")
	pres.false_alarm = 0.0                                   # (the check's own: no chance in it; a warning's tried below)
	var hiss: AudioStreamPlayer3D = pres._static
	var radio_on: bool = hiss != null and hiss.playing
	say("she's near", "%.1f m from her: the signs at %.2f, the radio's static %s at %.0f dB, %d dips so far" % [her.global_position.distance_to(player.global_position),
		float(pres.near), "on" if radio_on else "OFF", hiss.volume_db if hiss != null else -80.0, int(pres.dips)])
	if not radio_on or float(pres.near) <= 0.0 or hiss.volume_db < -40.0:
		bad("her signs (presence.gd) by the batteries: the signs %.2f, the radio's static %s" % [float(pres.near), radio_on])
	# her menace (menace.gd): filling while you're near her; full, she withdraws a while (the director relaxing), then she's back
	var men: Node = her.get_node("Menace")
	var men_level := float(men.level)
	var her_home := her.global_position
	men.away_min = 1.5                                     # (the check's: the game's are 60 to 120 s)
	men.away_max = 1.5
	men.withdraw()
	await frames(2)
	var men_gone := not her.visible
	var men_relax: bool = dread.phase == "relax"
	await secs(2.0)
	say("her menace", "near her the gauge at %.2f; full, she withdrew %s (the director relaxing %s), and came back %s where she stood %s" % [
		men_level, men_gone, men_relax, her.visible, her.global_position.distance_to(her_home) < 0.01])
	if men_level <= 0.0 or not men_gone or not men_relax or not her.visible or her.global_position.distance_to(her_home) > 0.01:
		bad("her menace (menace.gd): the gauge %.2f near her, withdrew %s, the director relaxing %s, back %s" % [men_level, men_gone, men_relax, her.visible])
	# the steps behind you (behind_you.gd, started by the batteries' picked): out of the vending corner
	var unc_her: Node = her.get_node("Uncanny")
	var head := her.get_node_or_null("Head") as Node3D          # a stand-in's head; a Studio export (a machine that has one: _studiotest) has a head bone instead
	var bent := 0.0
	if head != null:
		bent = rad_to_deg(head.global_basis.y.angle_to(her.global_basis.y))
	else:
		for sk in her.find_children("*", "Skeleton3D", true, false):
			for nm in unc_her.tilted:
				var bi: int = (sk as Skeleton3D).find_bone(str(nm))
				if bi >= 0:                                        # how far the bone is turned from where it rests
					bent = rad_to_deg(((sk as Skeleton3D).get_bone_global_pose(bi).basis.orthonormalized() * (sk as Skeleton3D).get_bone_global_rest(bi).basis.orthonormalized().inverse()).get_rotation_quaternion().get_angle())
	var her_x0 := her.global_position.x
	var her_steps0: int = unc_her.steps
	var bh: Node = main.get_node("BehindYou")
	var bh_on: bool = bh.running
	stand(Vector3(bt.global_position.x, fl + 0.02, bt.global_position.z + 0.6), Vector3(bt.global_position.x, fl + 1.6, cz + 0.5))
	await frames(4)
	await hold(KEY_W, 2.2)
	var her_steps: int = unc_her.steps - her_steps0
	var her_came := her_x0 - her.global_position.x
	await secs(1.2)
	var after_stop: int = unc_her.steps - her_steps0 - her_steps
	say("her, wrong", "her head bent %.0f deg (%s); as you walked out she took %d steps toward you (%.2f m), and %d after you stopped" % [bent, str(unc_her.tilted), her_steps, her_came, after_stop])
	if absf(bent - 48.0) > 3.0 or her_steps < 2 or her_came < 0.5 or after_stop != 0:
		bad("uncanny.gd: her head bent %.0f deg (48), her steps copying yours %d (%.2f m), none after you stopped (%d)" % [bent, her_steps, her_came, after_stop])
	var bh_mid: int = bh.heard
	await secs(2.5)
	say("behind you", "started by the batteries %s; %d of its steps behind yours as you walked, then the step too many %s, over %s" % [bh_on, bh_mid, bh.extra, not bh.running])
	if not bh_on or bh_mid < 2 or not bh.extra or bh.running:
		bad("the steps behind you (behind_you.gd): started %s, %d steps, the extra one %s, still running %s" % [bh_on, bh_mid, bh.extra, bh.running])
	# 8. her in the beam: she backs off; flashed twice, the corridor goes dark
	var hx0 := her.global_position.x
	stand(Vector3(hx0 - 4.5, fl + 0.02, cz), her.global_position + Vector3.UP * 1.3)
	var dips0 := int(pres.dips)
	var tube_min := 1.0
	var torch_min := 1.0
	for i in 150:                                            # 2.5 s in the beam: her signs meanwhile
		await frames(1)
		for l in tubes():
			if l.global_position.distance_to(her.global_position) < float(pres.radius):
				tube_min = minf(tube_min, float(l.get_meta("hs_flick", 1.0)))
		torch_min = minf(torch_min, float(torch.flick))
	var dips := int(pres.dips) - dips0
	say("her signs", "%d dips in 2.5 s (the flash limit %.1f a second), the tubes by her down to %.2f, your flashlight to %.2f" % [dips, float(pres.max_dips), tube_min, torch_min])
	if dips < 1 or dips > int(2.5 * float(pres.max_dips)) + 1 or tube_min > 0.5 or torch_min > 0.5:
		bad("her signs (presence.gd) in the corridor: %d dips (1 to %d), the tubes by her to %.2f, the flashlight to %.2f" % [dips, int(2.5 * float(pres.max_dips)) + 1, tube_min, torch_min])
	var moved := her.global_position.x - hx0
	look(her.global_position + Vector3(0, 1.3, 4.0))         # off her
	await secs(0.5)
	look(her.global_position + Vector3.UP * 1.3)             # on her again: twice
	await secs(1.5)
	var fear: Node = main.get_node("Fear")
	var fs: Dictionary = fear.state()
	say("fear", "facing her %.1f m off: fear %.2f, %d heartbeats, %d breaths, the world's highs at %d Hz, the vignette %.2f, the beam shaking %.2f deg" % [
		her.global_position.distance_to(player.global_position), float(fs.level), int(fs.beats), int(fs.breaths), int(fs.cutoff), float(fs.vignette), float(torch.tremor)])
	if float(fs.level) < 0.3 or int(fs.beats) < 2 or float(fs.cutoff) > 19000.0 or float(torch.tremor) <= 0.0:
		bad("the Fear node near her (fear.gd): fear %.2f, beats %d, the world's highs %d Hz, the tremor %.2f" % [float(fs.level), int(fs.beats), int(fs.cutoff), float(torch.tremor)])
	# her look by a fact: the knocks have come (knocked_304: the look's needs), so her eyes are black by now
	if her_looks != null:
		var eyes_n: int = HSEyeFx.worn(her).size()
		say("her look, by a fact", "the knocks came (knocked_304 %s): she's in '%s'%s" % [story.is_set("knocked_304"), her_looks.current(),
			(", her eyes black (%d of them)" % eyes_n) if cfg.get("who") != null else " (a stand-in has no eyes to show it)"])
		if her_looks.current() != "empty" or (cfg.get("who") != null and eyes_n != 2):
			bad("her look didn't follow the story (looks/empty.tres needs knocked_304): she's in '%s', %d eyes changed" % [her_looks.current(), eyes_n])
	var dark := tubes().filter(func(l): return not Lights.is_on(l)).size()
	say("in the beam", "she backed off %.2f m; flashed twice, %d of %d tubes out" % [moved, dark, tubes().size()])
	if not (moved > 0.5):
		bad("she didn't back off from the light (light_shy.gd: %.2f m)" % moved)
	if dark != tubes().size():
		bad("flashing her twice didn't put the corridor's lights out (flashed_twice to LightsOut)")
	var dark_glass := tubes().filter(func(l): return czone.glass_of(l) == 0.0).size()
	say("glass out", "%d of %d tubes' fitting glass out with them" % [dark_glass, tubes().size()])
	if dark_glass != tubes().size():
		bad("the tubes' fitting glass still glowing with their lights out (HSLightZone glass_follows: %d of %d out)" % [dark_glass, tubes().size()])
	await secs(5.5)
	var rolled := float(air.fog)
	say("fog", "rolled in to %.2f with the dark (LightsOut's fog 0.55), the environment's density %.4f" % [rolled, HSAir.environment_of(air).volumetric_fog_density])
	if absf(rolled - 0.55) > 0.02:
		bad("the fog didn't roll in when the corridor went dark (scare_area.gd fog: %.2f)" % rolled)
	# her look by an event: LightsOut's scared fired the hunter's switch, so her eyes are lit in the dark
	if hunt_looks != null:
		var hunter_n: Node3D = main.get_node("Events/Hunter")
		var lit_n: int = HSEyeFx.worn(hunter_n).size()
		say("her look, by an event", "the corridor went dark (LightsOut's scared to her switch's fire): the one who hunts is in '%s'%s" % [hunt_looks.current(),
			(", her eyes lit (%d of them)" % lit_n) if cfg.get("who") != null else " (a stand-in has no eyes to show it)"])
		if hunt_looks.current() != "hunting" or (cfg.get("who") != null and lit_n != 2):
			bad("the hunter's look didn't come with the dark (LightsOut scared -> Events/Hunter/Looks fire, on_fire hunting): she's in '%s', %d eyes lit" % [hunt_looks.current(), lit_n])
	# being hunted (searcher.gd, armed when the corridor went dark): heard running, she listens, comes for the linen
	# closet's corner and stands in its doorway; your breath held, she doesn't find you. Then you hold it too long: the
	# gasp brings her, and this time she pulls you out
	var hunter: Node3D = main.get_node("Events/Hunter")
	var srch: Node = hunter.get_node("Searcher")
	var hide: Node3D = main.get_node("Things/Hide")
	var post := v3(cfg["her"])
	var took := hunter.global_position.distance_to(her.global_position)
	say("hunted", "armed when the corridor went dark %s, she where the first one stood (%.2f m off), that one hidden %s" % [srch.armed, took, not her.visible])
	if not srch.armed or not hunter.visible or her.visible or took > 0.05:
		bad("the hunt (searcher.gd) should start when the corridor goes dark, she in the first one's place and it hidden: armed %s, shown %s, the first one shown %s, %.2f m" % [
			srch.armed, hunter.visible, her.visible, took])
	srch.find_chance = 1.0                                   # (the check's: found for sure, but never while you hold your breath)
	srch.held_factor = 0.0
	if torch.visible:
		torch.toggle()                                       # your light off: she'd find you for sure with it on
	var heard_t := [-1.0]
	var clock := [0.0]
	var over := [0]
	var found_n := [0]
	var out_moments := [0]
	srch.heard_you.connect(func(_at: Vector3) -> void: heard_t[0] = Engine.get_physics_frames() / 60.0)   # (every frame counted: she hears you before the loop below starts)
	srch.search_over.connect(func() -> void: over[0] += 1)
	srch.found.connect(func() -> void: found_n[0] += 1)
	dread.moment.connect(func(_nm: String) -> void:
		if srch.state != "idle" and srch.state != "gone":
			out_moments[0] += 1)
	var via := v3(cfg["hide_via"])
	stand(Vector3(via.x + 2.8, fl + 0.02, cz), Vector3(via.x - 3.0, fl + 1.6, cz))
	await frames(2)
	player.set("_was", Vector3.INF)                          # (a teleport is a step to the player)
	key(KEY_SHIFT, true)
	key(KEY_W, true)
	await secs(0.8)                                          # running past the linen closet: heard 12 m off
	key(KEY_W, false)
	key(KEY_SHIFT, false)
	await frames(2)
	var listening: bool = srch.state == "listening"
	var eye_hide := v3(cfg["hide_eye"])
	var hid := await use_at(eye_hide + (via - eye_hide).normalized() * 0.55 * Vector3(1, 0, 1) + Vector3(0, fl + 0.02 - eye_hide.y, 0), eye_hide + Vector3(0, -0.3, 0))
	var hiding: bool = hid == hide and player.doing() == "hiding"
	var listened := -1.0
	var pass_t := 0.0
	var pass_d := 9.0
	var hunt_fear := 0.0
	var held_all := true
	var she_left := false
	for i in 60 * 45:
		await frames(1)
		clock[0] += 1.0 / 60.0
		if listened < 0.0 and srch.state != "listening" and heard_t[0] >= 0.0:
			listened = Engine.get_physics_frames() / 60.0 - heard_t[0]
		if srch.state == "passing":
			key(KEY_SPACE, true)                             # her in the doorway: your breath held
			pass_t += 1.0 / 60.0
			var eye_at := (player.get_node("Eye") as Node3D).global_position
			pass_d = minf(pass_d, Vector2(hunter.global_position.x - eye_at.x, hunter.global_position.z - eye_at.z).length())
			hunt_fear = maxf(hunt_fear, float(main.get_node("Fear").level))
			if pass_t > 0.1:
				held_all = held_all and bool(player.holding)   # (from the frame after Space went down)
		elif srch.state == "leaving":
			key(KEY_SPACE, false)
			she_left = true
		if over[0] > 0:
			break
	key(KEY_SPACE, false)
	var back_m := Vector2(hunter.global_position.x - post.x, hunter.global_position.z - post.z).length()
	say("the close pass", "heard you running %s, you hiding in the linen closet's corner %s; she listened %.1f s, stood in its doorway %.1f s %.2f m from you (your fear to %.2f), your breath held %s; found %d; she went %s, %d steps, back at 308's door %.2f m, gone for good %s; the director's moments while she was out %d" % [
		listening, hiding, listened, pass_t, pass_d, hunt_fear, held_all, found_n[0], she_left, int(srch.steps), back_m, srch.state == "gone" and not hunter.visible, out_moments[0]])
	if not listening or not hiding or listened < 2.9 or listened > 6.2 or pass_t < 1.9 or pass_t > 4.2 or pass_d < 1.0 or pass_d > 1.6 or not held_all or found_n[0] != 0 \
			or not she_left or int(srch.steps) < 15 or back_m > 0.1 or srch.state != "gone" or hunter.visible or out_moments[0] != 0:
		bad("the search (searcher.gd): heard %s, hiding %s, listened %.1f s (3 to 6), the pass %.1f s (2 to 4) at %.2f m (1 to 1.5), held %s, found %d (0), went %s, %d steps, back %.2f m, gone %s, moments %d" % [
			listening, hiding, listened, pass_t, pass_d, held_all, found_n[0], she_left, int(srch.steps), back_m, srch.state, out_moments[0]])
	# the gasp: she's back hunting (the check's: armed again), you hold your breath too long, she hears it and comes
	srch.searches_done = 0
	srch.arm()
	var gasps := [0]
	player.gasped.connect(func() -> void: gasps[0] += 1)
	heard_t[0] = -1.0
	key(KEY_SPACE, true)
	var near_her := 9.0
	var faced := -1.0
	var pulled := false
	var fear_at := 0.0
	var fear_before := 0.0
	for i in 60 * 50:
		await frames(1)
		clock[0] += 1.0 / 60.0
		if gasps[0] > 0:
			key(KEY_SPACE, false)
		if found_n[0] == 0:
			fear_before = float(main.get_node("Fear").level)
		elif faced < 0.0:
			var eye_n := player.get_node("Eye") as Node3D
			var to_her := hunter.global_position + Vector3.UP * 1.45 - eye_n.global_position
			near_her = Vector2(to_her.x, to_her.z).length()
			faced = (-eye_n.global_basis.z).dot(to_her.normalized())
			pulled = player.seat == null and player.doing() != "hiding"
			fear_at = float(main.get_node("Fear").level)
		if over[0] > 1:
			break
	key(KEY_SPACE, false)
	say("found", "held your breath too long: gasped %d, she heard it %s and came; found %d, pulled out %s, in your face %.2f m off, turned to her %.2f, your fear %.2f to %.2f; she went back, gone %s" % [
		gasps[0], heard_t[0] >= 0.0, found_n[0], pulled, near_her, faced, fear_before, fear_at, srch.state == "gone" and not hunter.visible])
	if gasps[0] != 1 or heard_t[0] < 0.0 or found_n[0] != 1 or not pulled or near_her > 0.6 or faced < 0.9 or fear_at < minf(1.0, fear_before + 0.1) or over[0] != 2 or srch.state != "gone" or hunter.visible:
		bad("found (searcher.gd): gasped %d, heard %s, found %d, pulled out %s, %.2f m off, turned %.2f, fear %.2f to %.2f, over %d, gone %s" % [
			gasps[0], heard_t[0] >= 0.0, found_n[0], pulled, near_her, faced, fear_before, fear_at, over[0], srch.state])
	# a chase (chase.gd): seen in the open while she searches, she's after you; the stairwell is the way out
	var chase: Node = hunter.get_node("Chase")
	var starts := [0]
	var escapes := [0]
	var catches := [0]
	var losts := [0]
	chase.started.connect(func() -> void: starts[0] += 1)
	chase.escaped.connect(func() -> void: escapes[0] += 1)
	chase.caught.connect(func() -> void: catches[0] += 1)
	chase.lost.connect(func() -> void: losts[0] += 1)
	var sdoor := door("stair_door")
	sdoor.open = true
	var sdm := v3(cfg["boxes"]["door_stair_door"]["mid"])
	srch.searches_done = 0
	srch.arm()
	torch.toggle()                                           # your light on: she sees you 7 m off
	stand(Vector3(via.x + 2.8, fl + 0.02, cz), Vector3(via.x - 3.0, fl + 1.6, cz))
	await frames(2)
	player.set("_was", Vector3.INF)
	key(KEY_SHIFT, true)
	key(KEY_W, true)
	await secs(0.8)                                          # heard running past the linen closet
	key(KEY_W, false)
	key(KEY_SHIFT, false)
	stand(Vector3(via.x - 2.2, fl + 0.02, cz + 0.4), Vector3(via.x + 4.0, fl + 1.5, cz + 0.4))   # then out in the open, the way she'll come (clear of the stair door's leaf)
	await frames(2)
	player.set("_was", Vector3.INF)
	var mood_before: String = sound.now_mood
	var waited := 0.0
	while chase.state == "idle" and waited < 30.0:
		await frames(1)
		waited += 1.0 / 60.0
	var seen_at := Vector2(hunter.global_position.x - player.global_position.x, hunter.global_position.z - player.global_position.z).length()
	var mood_in: String = sound.now_mood
	look(player.global_position + Vector3(-5.0, 1.6, 0.0))   # turn and run: west, then into the stairwell
	key(KEY_SHIFT, true)
	key(KEY_W, true)
	var gap_min := 99.0
	for i in 60 * 6:
		await frames(1)
		gap_min = minf(gap_min, Vector2(hunter.global_position.x - player.global_position.x, hunter.global_position.z - player.global_position.z).length())
		if player.global_position.x <= sdm.x and absf(player.rotation.y) > 0.1:
			look(player.global_position + Vector3(0.0, 1.6, -5.0))
		if escapes[0] > 0 or catches[0] > 0:
			break
	key(KEY_W, false)
	key(KEY_SHIFT, false)
	var her_speed := float(chase.ran) / maxf(float(chase.running_secs), 0.01)
	await secs(2.5)
	say("a chase", "seen in the open %.1f m off: the chase on %s, the music %s (it was %s); she ran at %.2f m/s (your run %.1f: %.2f of it), %.1f m behind at the nearest; into the stairwell: escaped %d, caught %d; after, the music %s, she's gone %s" % [
		seen_at, starts[0] == 1, mood_in, mood_before, her_speed, float(player.run_speed), her_speed / float(player.run_speed), gap_min, escapes[0], catches[0], sound.now_mood, srch.state == "gone" and not hunter.visible])
	if starts[0] != 1 or seen_at > 7.3 or mood_in != "chase" or absf(her_speed / float(player.run_speed) - 0.95) > 0.06 or escapes[0] != 1 or catches[0] != 0 \
			or sound.now_mood != mood_before or srch.state != "gone" or hunter.visible or out_moments[0] != 0:
		bad("the chase (chase.gd) to the stairwell: started %d, seen %.1f m off (7 at most), the music %s, her speed %.2f of yours (0.95), escaped %d, caught %d, the music after %s (%s), gone %s, the director's moments %d" % [
			starts[0], seen_at, mood_in, her_speed / float(player.run_speed), escapes[0], catches[0], sound.now_mood, mood_before, srch.state, out_moments[0]])
	# a door you shut behind you holds her 2 s and a bang; then she's through it, and you're caught
	srch.searches_done = 0
	srch.arm()
	d304.open = true
	var dm := v3(cfg["boxes"]["door_door_304"]["mid"])
	stand(Vector3(dm.x, fl + 0.02, cz), Vector3(dm.x, fl + 1.5, dm.z + 3.0))   # in the corridor at 304's open door, facing it
	hunter.global_position = Vector3(dm.x + 5.0, fl, cz)
	await secs(1.0)
	player.set("_was", Vector3.INF)
	var found_b: int = found_n[0]
	chase.start()
	key(KEY_W, true)                                         # in through it
	for i in 60 * 3:
		await frames(1)
		if player.global_position.z > dm.z + 0.9:
			break
	key(KEY_W, false)
	d304.open = false                                        # and shut behind you
	var door_hit := -1.0
	var door_open_again := false
	for i in 60 * 10:
		await frames(1)
		if chase.state == "door" and door_hit < 0.0:
			door_hit = 0.0
		if door_hit >= 0.0 and chase.state != "door" and not door_open_again:
			door_open_again = d304.open
		if catches[0] > 0:
			break
	await secs(1.5)
	say("a door", "you shut 304's door behind you: she was held %d time(s) %.1f s, then it was open %s; caught %d, her fright %s; gone after %s" % [
		int(chase.door_waits), float(chase.door_secs_held), door_open_again, catches[0], found_n[0] == found_b + 1, srch.state == "gone" and not hunter.visible])
	if int(chase.door_waits) != 1 or absf(float(chase.door_secs_held) - 2.0) > 0.2 or not door_open_again or catches[0] != 1 or found_n[0] != found_b + 1 or srch.state != "gone" or hunter.visible:
		bad("a door in a chase (chase.gd): held %d (1) for %.1f s (2), open after %s, caught %d, the fright %s, gone %s" % [
			int(chase.door_waits), float(chase.door_secs_held), door_open_again, catches[0], found_n[0] == found_b + 1, srch.state])
	# out of her sight 6 s, and she's lost you: she searches where she last saw you (you in the linen closet's corner, its
	# door shut: she can't see you from the corridor and goes no further than she saw)
	srch.searches_done = 0
	srch.arm()
	await use_at(eye_hide + (via - eye_hide).normalized() * 0.55 * Vector3(1, 0, 1) + Vector3(0, fl + 0.02 - eye_hide.y, 0), eye_hide + Vector3(0, -0.3, 0))
	var linen := door("door_linen")
	linen.open = false
	hunter.global_position = Vector3(via.x + 4.5, fl, cz)
	await secs(1.0)
	var last_at := player.global_position
	chase.start()
	var unseen_t := 0.0
	for i in 60 * 10:
		await frames(1)
		if not chase.seen:
			unseen_t += 1.0 / 60.0
		if losts[0] > 0:
			break
	var searching: bool = srch.state == "listening" and Vector2(srch.heard_at.x - last_at.x, srch.heard_at.z - last_at.z).length() < 1.2
	say("lost", "out of her sight in the linen closet's corner: lost after %.1f s %s; she searches where she last saw you %s" % [unseen_t, losts[0] == 1, searching])
	if losts[0] != 1 or absf(unseen_t - 6.0) > 0.4 or not searching:
		bad("lost in a chase (chase.gd): lost %d after %.1f s (6), searching where she last saw you %s (%s at %s)" % [losts[0], unseen_t, searching, srch.state, srch.heard_at])
	srch.stop()
	if player.seat != null:
		player.seat.leave()                                  # up again
	if not torch.visible:
		torch.toggle()                                       # your light again
	# feet under 308's door (door_feet.gd, armed when the corridor went dark): the light under it, someone standing behind it
	var ft: Node3D = main.get_node("Events/Feet308")
	var came := [0]
	var went := [0]
	ft.came.connect(func() -> void: came[0] += 1)
	ft.left.connect(func() -> void: went[0] += 1)
	var foot := ft.global_position
	var out_dir := ft.global_basis.z
	var feet_armed: bool = ft.armed and ft.state == "away"       # armed, and not come yet while your eyes were on her
	stand(foot + out_dir * 1.5 + Vector3(-2.0, 0.02, 0.0), foot + Vector3(0, 0.1, 0))
	var standing_seen := false
	for i in 420:
		await frames(1)
		standing_seen = standing_seen or ft.state == "standing"
		if went[0] > 0:
			break
	say("feet under 308's door", "armed when the corridor went dark %s; its light %s, %.2f m wide (the leaf's), facing the corridor %s, on the floor %s; came %d, stood %s, left %d" % [
		feet_armed, "on" if ft.lit else "OFF", float(ft.width), out_dir.dot(Vector3(0, 0, -1)) > 0.9, absf(foot.y - fl) < 0.02, came[0], standing_seen, went[0]])
	if not feet_armed or not ft.lit or absf(float(ft.width) - 0.8) > 0.15 or out_dir.dot(Vector3(0, 0, -1)) < 0.9 or absf(foot.y - fl) > 0.02 or came[0] != 1 or not standing_seen or went[0] != 1:
		bad("feet under 308's door (door_feet.gd): armed %s, at the leaf's foot facing the corridor (%.2f m wide, %s, %.3f off the floor), came %d, stood %s, left %d" % [
			feet_armed, float(ft.width), out_dir, foot.y - fl, came[0], standing_seen, went[0]])
	# 9. the jump scare at the fire exit: the hush, her there for a moment
	var jp := v3(cfg["jump"])
	stand(Vector3(jp.x - 1.4, fl + 0.02, cz), Vector3(jp.x + 2.0, fl + 1.5, cz))
	var duck_at := -1.0
	var seen := false
	var tape_then := ""
	key(KEY_W, true)
	for i in 300:
		await frames(1)
		if player.global_position.x > jp.x - 0.4:
			key(KEY_W, false)
		if again.visible and not seen:
			seen = true
			duck_at = sound.duck()
			await frames(2)
			tape_then = _tape_now()
	key(KEY_W, false)
	await secs(1.2)
	var calm_torch := float(torch.flick)
	if calm_torch != 1.0 or (pres._static != null and pres._static.playing):
		bad("with her gone her signs should stop: the flashlight's flicker %.2f, the static %s" % [calm_torch, pres._static.playing])
	pres.warn(1.5)                                           # a warning without her (a false alarm's, or before she shows)
	var warn_torch := 1.0
	var warn_hiss := false
	for i in 90:
		await frames(1)
		warn_torch = minf(warn_torch, float(torch.flick))
		warn_hiss = warn_hiss or (pres._static != null and pres._static.playing)
	await secs(0.5)
	say("a false alarm", "the signs without her for 1.5 s: your flashlight down to %.2f, the static %s; after, the flashlight %.2f, the static %s" % [
		warn_torch, "on" if warn_hiss else "OFF", float(torch.flick), "on" if pres._static.playing else "off"])
	if warn_torch > 0.5 or not warn_hiss or float(torch.flick) != 1.0 or pres._static.playing:
		bad("a warning without her (presence.gd warn): the flashlight %.2f, the static %s, then back %.2f %s" % [warn_torch, warn_hiss, float(torch.flick), pres._static.playing])
	say("jump", "she was there %s, the beds at %.3f then, gone again %s, the first one hidden %s" % [seen, duck_at, not again.visible, not her.visible])
	if not seen or duck_at > 0.02:
		bad("the jump scare (scare_area.gd quiet): seen %s, the beds at %.3f" % [seen, duck_at])
	if again.visible or her.visible:
		bad("after the jump scare she should be gone (appear_for, hide)")
	var tape_after := _tape_now()
	var look: Node = again.get_node("Look")
	say("tape and her look", "the tape %s at the jump, %s after; her skin %s" % [tape_then, tape_after, "wet (HSCharacterLook)" if look.materials.size() > 0 else "NOT WORN"])
	if tape_then != "nightmare" or tape_after != "off":
		bad("the jump's tape (scare_area.gd tape): %s then, %s after" % [tape_then, tape_after])
	if look.materials.size() == 0:
		bad("her look (HSCharacterLook) isn't worn")
	# 9b. every system since: the HUD, the cash, the laptop and its parcels, the gun, things that break, her shot down
	await every_system(fl, cz)
	# 10. the fire door: the ending
	var fc := fire.global_position + fire.global_basis.x * 0.42 + Vector3.UP * 1.0
	await use_at(Vector3(fc.x - 0.9, fl + 0.02, fc.z), fc)
	await secs(1.5)
	say("ending", "the fire door %s, the story %s, out ticked %s" % ["open" if fire.open else "SHUT", "over" if story.over else "NOT over", story.done("out")])
	if not fire.open or not story.over or not story.done("out"):
		bad("the fire door's ending: open, the story over, out ticked")
	var rep: Dictionary = dread.report()
	var names: Array = rep["fired"].map(func(f): return f["name"])
	say("the director", "%d moments (%s); phases %s; at the end %s at %.2f; out of place: %s" % [int(rep["moments"]), ", ".join(names), str(phases.keys()), rep["phase"], float(rep["intensity"]), str(moment_bad)])
	if int(rep["moments"]) < 2 or not moment_bad.is_empty() or not (phases.has("build") and phases.has("peak") and phases.has("relax")):   # (its own come by chance in a compressed night: two were brought on above)
		bad("the dread director (dread.gd): %d moments, out of place %s, phases %s (build, peak and relax)" % [int(rep["moments"]), str(moment_bad), str(phases.keys())])
	print("TUTORIAL result " + JSON.stringify({"errors": errors}))
	quit()


## the laptop's glass clicked where a control of its terminal is (laptop_test.gd's way: its point on the screen mapped
## to the window through the laptop's camera)
func glass_click(lap: Node, c: Control) -> void:
	if c == null:
		bad("a click through the laptop's glass on nothing")
		return
	var wp: Vector2 = lap.to_window(c.get_global_rect().get_center())
	var mm := InputEventMouseMotion.new()
	mm.position = wp
	mm.global_position = wp
	root.push_input(mm)
	await frames(3)
	for pressed in [true, false]:
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		mb.pressed = pressed
		mb.position = wp
		mb.global_position = wp
		root.push_input(mb)
		await frames(3)


## up to `t` seconds for `cond` to hold
func until(cond: Callable, t: float) -> bool:
	for i in int(ceil(t * 60.0)):
		if cond.call():
			return true
		await frames(1)
	return bool(cond.call())


func shop_item(lap: Node, id: String) -> HSShopItem:
	for it in lap.catalog.all_items():
		if (it as HSShopItem).id == id:
			return it
	return null


## the parcels left at the doorstep
func parcels() -> Array:
	return main.get_node("Things/Doorstep").get_children().filter(func(c: Node) -> bool: return c is HSPackage and not (c as HSPackage).is_open)


## E on a parcel from a step or so away; what's in it pulled into you
func unbox(pk: Node3D) -> void:
	var at := pk.global_position
	await use_at(Vector3(at.x, at.y + 0.02, at.z - 0.75), at + Vector3(0, 0.1, 0))
	await secs(2.6)


## at the laptop: E on it, the view in, the boot's lines (the first time), its catalogue, the page `id` is on
func at_laptop(lap: Node3D, id: String) -> void:
	var lp: Vector3 = lap.global_position
	var fl: float = lp.y - 0.72
	await use_at(Vector3(lp.x - 0.78, fl + 0.02, lp.z + 0.36), lp + Vector3(0, 0.12, 0))
	await frames(2)
	await secs(lap.zoom_secs + 3.2)
	if lap.term.current != "ORDER":
		await glass_click(lap, lap.term.find_child("Browse", true, false))
	var od: Node = lap.term.order
	var pg: int = od.page_of(id)
	if od.page != pg:
		await glass_click(lap, od._numbers.find_child("Page%d" % (pg + 1), false, false))
	await frames(2)


## Every system since (DECISIONS 2026-11-10, after that): the HUD and the markers left; the $20 note; the laptop's shop
## (a page a category, the shotgun unlocked by the knocks, the explosive shells a ? till the gun's come, two orders
## clicked through the glass); the parcels at 304's door (unseen, a marker each), E: the gun into the hands and drawn
## up, the shells into its pocket, the task ticked and the explosive shells unlocked, ordered, T picking them; the
## kettle (its LED, its steam) and the mug of tea (its level) shot to pieces; a reload; the entry's bulb shot out; her
## who hunts shot down (the hunt stopped, her dissolving into black smoke, the line)
func every_system(fl: float, cz: float) -> void:
	var hud: Node = main.get_node("HUD")
	var gun: Node3D = player.get_node("Eye/Shotgun")
	var lap: Node3D = main.get_node("Things/Laptop")
	# ---- the HUD and the markers left (the to-do list's: 304 found, the fire exit and the laptop open)
	var mlap: Node = main.get_node("Things/Laptop/Marker")
	var mfire: Node = main.get_node("Markers/FireExit")
	var m304: Node = main.get_node("Markers/Room304")
	await frames(8)
	var gd: Node = hud.get("guide")
	var live := func(m: Node) -> bool:
		var id := str(m.get_path())
		return gd != null and gd.marks.has(id) and bool(gd.marks[id].get("live", false))
	say("hud and markers", "the HUD by hand %s (the scene's markers %s, %d keys: %s); 304's %s (found), the fire exit's %s (out open), the laptop's %s (gun open: the knocks); in the guide: the fire exit %s, the laptop %s, 304 %s; the gun %s" % [
		hud.standalone, hud.auto_markers, hud.hints.size(), ", ".join(hud.hints.keys()), m304.shown(), mfire.shown(), mlap.shown(), live.call(mfire), live.call(mlap), live.call(m304),
		"not yours yet (hidden)" if not gun.visible and not gun.get("owned") else "SHOWN"])
	if not hud.standalone or not hud.auto_markers or hud.hints.size() != 4 or m304.shown() or not mfire.shown() or not mlap.shown() or not live.call(mfire) \
			or not live.call(mlap) or live.call(m304) or gun.get("owned") or gun.visible:
		bad("the HUD and its quest markers (HSHud keys, HSQuestMarker needs): %d keys; 304's %s, the fire exit's %s, the laptop's %s; live %s %s %s; the gun owned %s" % [
			hud.hints.size(), m304.shown(), mfire.shown(), mlap.shown(), live.call(m304), live.call(mfire), live.call(mlap), gun.get("owned")])
	# ---- her looks by hand: F8 opens the picker over the game on both switches, F8 again closes it and gives the mouse back
	var mouse0 := Input.mouse_mode
	await press(KEY_F8)
	await frames(2)
	var layer := root.get_node_or_null("HSLookPickerLayer")
	var seen_sw: int = layer.get_child(0).switches.size() if layer != null and layer.get_child_count() > 0 else 0
	var mouse1 := Input.mouse_mode
	await press(KEY_F8)
	await frames(3)
	var shut: bool = root.get_node_or_null("HSLookPickerLayer") == null
	say("her looks, by hand", "F8: the picker over the game on %d switches (the mouse let go %s); F8 again: closed %s, the mouse as it was %s" % [seen_sw, mouse1 == Input.MOUSE_MODE_VISIBLE, shut, Input.mouse_mode == mouse0])
	if seen_sw != 2 or mouse1 != Input.MOUSE_MODE_VISIBLE or not shut or Input.mouse_mode != mouse0:
		bad("the look picker over the game (an HSLookSwitch's panel_key, F8): %d switches, closed %s, the mouse back %s" % [seen_sw, shut, Input.mouse_mode == mouse0])
	# ---- the $20 note beside the laptop
	var note: Node3D = main.get_node("Things/Cash")
	var cash0: float = story.cash
	var cn := note.global_position
	await use_at(Vector3(cn.x - 0.35, fl + 0.02, cn.z + 1.05), cn)
	await frames(3)
	say("cash", "the $20 note picked up: the Story's cash $%.2f -> $%.2f, the note %s" % [cash0, story.cash, "gone" if not note.visible else "STILL THERE"])
	if absf(story.cash - cash0 - 20.0) > 0.01 or note.visible:
		bad("the $20 note (pickup.gd cash): the cash $%.2f -> $%.2f" % [cash0, story.cash])
	# ---- the laptop: its own catalogue, the shotgun unlocked by the knocks, the explosive shells a ? till the gun's come
	var sg := shop_item(lap, "shotgun")
	var sh := shop_item(lap, "shells")
	var ex := shop_item(lap, "explosive")
	if sg == null or sh == null or ex == null:
		bad("the shop's own things (res://shop/items: the catalog's folder) aren't in its catalog")
		return
	await at_laptop(lap, "shotgun")
	var od: Node = lap.term.order
	var heads: Array = od.pages.map(func(pg) -> String: return str(pg["category"]))
	var at_it: bool = lap.using
	var page_text: String = od._page_of.text
	var sg_new: bool = lap.is_new(sg)
	var states := [lap.unlocked(sg), lap.unlocked(sh), lap.unlocked(ex)]
	await glass_click(lap, od.cards.get("shotgun"))
	await glass_click(lap, od._buy)
	await frames(3)
	await glass_click(lap, od.cards.get("shells"))
	await glass_click(lap, od._buy)
	await frames(3)
	await glass_click(lap, od.cards.get("explosive"))
	await secs(0.6)
	var ex_off: bool = od._buy.disabled
	var said: String = od._about_text
	var on_way: int = lap.deliveries.size()
	var cash1: float = story.cash
	say("the laptop", "E at it %s; its catalogue %d pages (%s), the shop's own on %s; the shotgun %s and NEW %s (the knocks), the shells %s, the explosive shells %s (the gun first: ORDER off %s, it says \"%s\"); two orders by clicks: %d on their way to %s, $%.2f left" % [
		at_it, od.pages.size(), ", ".join(heads), page_text, "unlocked" if states[0] else "LOCKED", sg_new, "unlocked" if states[1] else "LOCKED", "a ?" if not states[2] else "UNLOCKED",
		ex_off, said.replace("\n", " "), on_way, lap.place_name(), cash1])
	if not at_it or od.pages.size() != 3 or heads != ["SUPPLIES", "FOOD & DRINK", "DEFENCE"] or not states[0] or not states[1] or states[2] or not sg_new \
			or not ex_off or not said.contains("GET THE GUN FIRST") or on_way != 2 or absf(cash1 - 4.0) > 0.01:
		bad("the laptop's shop (HSLaptop, the shop's own catalog): at it %s, %d pages %s, locks %s, NEW %s, the explosive's ORDER off %s \"%s\", %d orders, $%.2f left" % [
			at_it, od.pages.size(), str(heads), str(states), sg_new, ex_off, said, on_way, cash1])
	lap.leave()
	await secs(lap.zoom_secs + 0.4)
	# ---- the parcels: left at 304's door while it's out of sight, a marker over each; E: the gun into the hands
	var arrived: bool = await until(func() -> bool: return parcels().size() >= 2, 14.0)
	var pk: Array = parcels()
	await frames(8)
	var marked := pk.filter(func(p) -> bool: return (p as HSPackage).mark != null and live.call((p as HSPackage).mark)).size()
	var gun_box: HSPackage = null
	var shell_box: HSPackage = null
	for p in pk:
		if (p as HSPackage).items.size() > 0 and ((p as HSPackage).items[0] as HSShopItem).id == "shotgun":
			gun_box = p
		elif (p as HSPackage).items.size() > 0:
			shell_box = p
	if not arrived or gun_box == null or shell_box == null:
		bad("the laptop's delivery: %d parcels at 304's door" % pk.size())
		return
	await unbox(gun_box)
	await until(func() -> bool: return gun.get("raised") and not gun.get("busy"), 3.0)
	var owned: bool = gun.get("owned")
	var shown: bool = gun.visible
	var ticked: bool = story.done("gun")
	await unbox(shell_box)
	var spare: int = gun.get("spare")
	var in_pocket: bool = story.has("shotgun") or story.has("shells")
	say("parcels and the gun", "%d left at 304's door while it was out of sight, %d with a marker in the guide; E on the gun's: the double yours %s, in view %s, raised %s; the task 'gun' ticked %s; E on the shells': %d in its pocket (the Story's pocket has them %s)" % [
		pk.size(), marked, owned, shown, gun.get("raised"), ticked, spare, in_pocket])
	if pk.size() != 2 or marked != 2 or not owned or not shown or not ticked or spare != 5 or in_pocket:
		bad("the parcels and the gun (HSPackage, HSShopItem gun/shells/tick): %d parcels, %d marked; owned %s, shown %s, gun ticked %s; %d shells spare; in the Story's pocket %s" % [
			pk.size(), marked, owned, shown, ticked, spare, in_pocket])
	# ---- the explosive shells unlocked by the task, ordered, a third parcel; T picks them for R
	await at_laptop(lap, "explosive")
	od = lap.term.order
	var ex_open: bool = lap.unlocked(ex)
	var ex_new: bool = lap.is_new(ex)
	await glass_click(lap, od.cards.get("explosive"))
	await glass_click(lap, od._buy)
	await frames(3)
	lap.leave()
	await secs(lap.zoom_secs + 0.4)
	await until(func() -> bool: return parcels().size() >= 1, 14.0)
	var third: Array = parcels()
	if not third.is_empty():
		await unbox(third[0])
	var xk: Resource = load("res://addons/horrorstudio_weapons/shells/explosive.tres")
	var ex_shells: int = gun.call("shells_of", xk)
	await press(KEY_T)
	var load_now: String = str(gun.get("load_kind").get("id")) if gun.get("load_kind") != null else "?"
	await press(KEY_T)
	var load_back: String = str(gun.get("load_kind").get("id")) if gun.get("load_kind") != null else "?"
	say("explosive shells", "unlocked once the gun came %s, NEW %s; ordered ($%.2f left), its parcel %s, %d in the gun's pocket; T: R loads %s, T again: %s" % [
		ex_open, ex_new, story.cash, "opened" if not third.is_empty() else "NEVER CAME", ex_shells, load_now, load_back])
	if not ex_open or not ex_new or third.is_empty() or ex_shells != 2 or load_now != "explosive" or load_back == "explosive" or absf(story.cash) > 0.01:
		bad("the explosive shells (needs task:gun, shell): unlocked %s, NEW %s, parcel %s, %d in it, T %s then %s, $%.2f left" % [ex_open, ex_new, not third.is_empty(), ex_shells, load_now, load_back, story.cash])
	# ---- the tea things: the kettle on the boil (its LED and steam), the mug of tea (its level); shot to pieces
	var kettle: Node3D = main.get_node("Things/Kettle")
	var mug: Node3D = main.get_node("Things/Mug")
	var kfx: Dictionary = main.get_node("Things/Kettle/FX").report()
	var cfx: Dictionary = main.get_node("Things/Candle/FX").report()
	var tea: Node = main.get_node("Things/Mug/mug_stoneware_liquid/Tea")
	var tea_on: bool = tea.get("mat") != null
	var kb: Node = kettle.get_node("BlowUp")
	var mb: Node = mug.get_node("BlowUp")
	var ready: bool = kb.is_prepared() and mb.is_prepared()
	var kp := kettle.global_position
	stand(Vector3(kp.x - 1.6, fl + 0.02, kp.z + 0.25), kp + Vector3(0, 0.1, 0))
	await frames(4)
	gun.call("pull")
	await secs(0.6)
	var mp := mug.global_position
	look(mp + Vector3(0, 0.05, 0))
	await frames(4)
	gun.call("pull")
	await secs(0.8)
	say("the tea things", "the kettle's LED %d glowing and its steam %d sources, the candle's flame %d and its light %d, the tea's level %s; cut when they loaded %s; shot: the kettle %s, the mug %s" % [
		int(kfx["glowing"]), int(kfx["puff_sources"]), int(cfx["flames"]), int(cfx["lights"]), "worn" if tea_on else "NOT WORN", ready,
		"in pieces" if kb.is_broken else "WHOLE", "in pieces" if mb.is_broken else "WHOLE"])
	if int(kfx["glowing"]) < 1 or int(kfx["puff_sources"]) < 1 or int(cfx["flames"]) < 1 or int(cfx["lights"]) < 1 or not tea_on or not ready or not kb.is_broken or not mb.is_broken:
		bad("made props' effects (HSPropFX, HSLiquidFill) and things that break (HSBlowUp): %s %s, the tea %s, ready %s, broken %s %s" % [str(kfx), str(cfx), tea_on, ready, kb.is_broken, mb.is_broken])
	# ---- a reload: R, both barrels from the pocket
	await press(KEY_R)
	await until(func() -> bool: return not gun.get("busy") and int(gun.get("loaded")) == 2, 5.0)
	var loaded: int = gun.get("loaded")
	var left: int = gun.get("spare")
	# ---- the entry's bulb shot out
	var bulb: Node3D = main.get_node("Zones/Entry304/Bulb")
	var bl: OmniLight3D = bulb.get_node("Light")
	var bp := bulb.global_position
	stand(Vector3(bp.x + 0.2, fl + 0.02, bp.z + 0.75), bp)
	await frames(4)
	var lit0: float = bl.light_energy
	gun.call("pull")
	await secs(0.5)
	var sht: Node = bulb.get_node("Shootable")
	say("reload and the bulb", "R: %d loaded, %d left in the pocket; the entry's bulb shot: down %s, its light %.2f -> %.2f" % [loaded, left, sht.is_down, lit0, bl.light_energy if bl.visible else 0.0])
	if loaded != 2 or left != 3 or not sht.is_down or (bl.visible and bl.light_energy > 0.01):
		bad("the reload (%d loaded, %d left) and the bulb shot out (HSShootable lights_out: down %s, its light %.2f)" % [loaded, left, sht.is_down, bl.light_energy])
	# ---- her who hunts, shot down: a chase from 308's door, both barrels; the hunt stopped, dissolving into smoke
	await fill_gun(gun)
	var hunter: Node3D = main.get_node("Events/Hunter")
	var hr: Node = hunter.get_node("HitReact")
	var chase: Node = hunter.get_node("Chase")
	var post := v3(cfg["her"])
	hunter.global_position = post
	var me := Vector3(post.x - 6.0, fl + 0.02, cz)
	stand(me, post + Vector3(0, 1.3, 0))
	await frames(4)
	var hidden_boxes := 0
	for b in hr.get("_boxes"):
		if (b as CollisionObject3D).collision_layer == 0:
			hidden_boxes += 1
	chase.start()
	var near: bool = await until(func() -> bool: return hunter.global_position.distance_to(player.global_position) < 3.4, 6.0)
	look(hunter.global_position + Vector3(0, 1.25, 0))
	await frames(1)
	gun.call("pull")
	await secs(0.25)
	look(hunter.global_position + Vector3(0, 1.25, 0))
	await frames(1)
	gun.call("pull")
	await secs(0.3)
	var down: bool = hr.is_down
	var dissolving: bool = hunter.visible
	var stopped: String = chase.state
	await secs(6.0)
	var gone: bool = not hunter.visible
	var rep: Dictionary = hr.report()
	say("her, shot down", "her hitboxes off while she was hidden %d of %d; she came at you %s; both barrels: down %s (%d hits), the chase %s, the hunt %s; dissolving where you could see %s, gone after %s; the fact %s, the line \"%s\"" % [
		hidden_boxes, (hr.get("_boxes") as Array).size(), near, down, int(rep["hits"]), stopped, main.get_node("Events/Hunter/Searcher").state, dissolving, gone, story.is_set("shot_her"), story._line.text])
	if hidden_boxes != (hr.get("_boxes") as Array).size() or hidden_boxes == 0 or not near or not down or stopped != "done" or not dissolving or not gone or not story.is_set("shot_her"):
		bad("her shot down (HSHitReact on the starter's hunter): hidden boxes off %d/%d, near %s, down %s, the chase %s, dissolving %s, gone %s, the fact %s" % [
			hidden_boxes, (hr.get("_boxes") as Array).size(), near, down, stopped, dissolving, gone, story.is_set("shot_her")])


## both barrels loaded again (a script's: the double's chambers follow `loaded` once it isn't busy)
func fill_gun(gun: Node) -> void:
	await until(func() -> bool: return not gun.get("busy"), 4.0)
	gun.set("loaded", 2)
	await frames(3)
