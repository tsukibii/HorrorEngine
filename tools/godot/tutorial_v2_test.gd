## TUTORIAL2's playthrough (tools/godot/tutorial_v2.py): guides/tutorial_v2's main.tscn played headless as a person
## plays it (--fixed-fps 60). Up the stairwell's dog-leg; the stair door; the corridor's lights dimming and coming back;
## 304 locked; the note under its door; the linen closet's key and the corridor's lights going out one by one and back
## (each tube's fitting glass with it);
## 304 unlocked, its moment (the music to dread, the TV's static); the flashlight running low, dying, and the vending
## corner's batteries going in; her in the corridor backing off from the light, flashed twice and the corridor going dark;
## the hush before the jump scare at the fire exit; the fire door and the ending. The air: the stairwell's dustier
## air while in it (an HSAirZone), the flashlight's beam in it, the fog rolling in when the corridor goes dark, the tape
## breaking up at the jump, her wet look. Prints `TUTORIAL <what> <how>` lines
## and `TUTORIAL result {errors}`, quits.
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
	if absf(in_corridor - air.fog) > 0.05:
		bad("out of the stairwell the air didn't go back to the level's (%.2f against %.2f)" % [in_corridor, air.fog])
	# 3. 304 locked; the note under its door
	var dc := d304.global_position + d304.global_basis.x * 0.4 + Vector3.UP * 1.0
	await use_at(Vector3(dc.x, fl + 0.02, dc.z - 0.9), dc)
	await frames(10)
	say("304", "%s, it says %s" % ["SHUT" if not d304.open else "open", story._line.text])
	if d304.open or story._line.text != "Locked.":
		bad("304's door: locked and saying so (door.gd): open %s, '%s'" % [d304.open, story._line.text])
	var note := main.get_node("Things/Note") as Node3D
	await use_at(Vector3(note.global_position.x, fl + 0.02, note.global_position.z - 0.85), note.global_position)
	await frames(5)
	say("note", "its card %s, the task 'key' %s" % ["up" if story.card_up() else "NOT up", "added" if story.has_task("key") else "NOT added"])
	if not story.card_up() or not story.has_task("key"):
		bad("reading the note (note.gd): its card and its task")
	await press(KEY_E)
	if story.card_up():
		bad("E didn't put the note's card away (player.gd)")
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
	# 8. her in the beam: she backs off; flashed twice, the corridor goes dark
	var hx0 := her.global_position.x
	stand(Vector3(hx0 - 4.5, fl + 0.02, cz), her.global_position + Vector3.UP * 1.3)
	await secs(2.5)
	var moved := her.global_position.x - hx0
	look(her.global_position + Vector3(0, 1.3, 4.0))         # off her
	await secs(0.5)
	look(her.global_position + Vector3.UP * 1.3)             # on her again: twice
	await secs(1.5)
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
	print("TUTORIAL result " + JSON.stringify({"errors": errors}))
	quit()
