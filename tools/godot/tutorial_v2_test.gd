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
## away a while, and the night's director (its moments, never in the stairwell or under a card, its peak and relax). Prints `TUTORIAL <what> <how>` lines and `TUTORIAL result {errors}`, quits.
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


func door(id: String) -> Node3D:
	return main.get_node("Hotel").find_child("door_" + id, true, false) as Node3D


## a step that never comes back (a script error stops a coroutine where it is): what's known so far, then out
func _watchdog() -> void:
	bad("the playthrough stopped before the end (a script error above?)")
	print("TUTORIAL result " + JSON.stringify({"errors": errors}))
	quit()


func _initialize() -> void:
	create_timer(480.0).timeout.connect(_watchdog)
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
	say("note", "its card %s, the task 'key' %s" % ["up" if story.card_up() else "NOT up", "added" if story.has_task("key") else "NOT added"])
	if not story.card_up() or not story.has_task("key"):
		bad("reading the note (note.gd): its card and its task")
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
	var head := her.get_node("Head") as Node3D
	var bent := rad_to_deg(head.global_basis.y.angle_to(her.global_basis.y))
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
