## The guide's pictures (tools/godot/tutorial_v2.py --pictures): guides/tutorial_v2's main.tscn drawn by Godot as the
## player sees it, the Story's words on screen where the guide shows them. Each shot a camera of its own at the eye's
## height, held a while (TAA and the iris settle), saved as <out>/<name>.png. `--only=a,b` makes only those (the rest of
## the walk still set up as it goes). The UI plugin's HUD is shown only in the pictures of the parts that add it (every
## system since, DECISIONS 2026-11-10, after that: the markers, the laptop, its shop, the parcels, the gun through the
## player's own eye, the tea things in pieces, the candle, her shot down).
##   godot --path PROJECT --rendering-driver vulkan -s tutorial_v2_shots.gd -- --out=DIR [--only=glimpse,closer]
extends SceneTree

const Lights := preload("res://starter/lights.gd")

var out_dir := ""
var only: PackedStringArray = []
var cam: Camera3D
var main: Node3D
var torch: SpotLight3D
var cfg: Dictionary


func v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func shot(name: String, from: Vector3, at: Vector3, hold := 40) -> void:
	if not only.is_empty() and not only.has(name):
		return
	cam.global_position = from
	cam.look_at(at, Vector3.UP)
	for i in hold:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	print("SHOT %s" % name)


func tubes() -> Array:
	return main.get_node("Zones/Corridor").get_children().filter(func(n): return n is Light3D)


## the frame as it is, held a while (the current camera's: the laptop's, the player's eye)
func snap(name: String, hold := 40) -> void:
	if not only.is_empty() and not only.has(name):
		return
	for i in hold:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	print("SHOT %s" % name)


## the player's own eye at `from` looking at `at`, the current camera (what's under it seen: the gun)
func eye_at(player: Node3D, from: Vector3, at: Vector3) -> Camera3D:
	var e := player.get_node("Eye") as Camera3D
	player.global_position = from - Vector3(0, e.position.y, 0)
	var d := at - from
	player.rotation = Vector3(0, atan2(-d.x, -d.z), 0)
	var pt := atan2(d.y, Vector2(d.x, d.z).length())
	player.set("pitch", pt)
	e.rotation = Vector3(pt, 0, 0)
	e.make_current()
	return e


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--only="):
			only = a.substr(7).split(",", false)
	root.size = Vector2i(1600, 900)
	cfg = JSON.parse_string(FileAccess.get_file_as_string("res://tutorial.json"))
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	var player := main.get_node("Player") as Node3D
	player.process_mode = Node.PROCESS_MODE_DISABLED            # the pictures' own camera, the player standing by
	(player.get_node("Eye") as Camera3D).current = false
	player.global_position = Vector3(0, -40, 0)                 # out of the way (its body would block the areas)
	cam = Camera3D.new()
	cam.fov = 70.0
	cam.near = 0.03
	cam.cull_mask &= ~(1 << 18)                                 # as the player's eye: what's only in mirrors left out
	main.add_child(cam)
	cam.current = true
	torch = SpotLight3D.new()                                  # the starter's flashlight: its light, its beam in the air and its cookie
	torch.light_energy = 4.0
	torch.spot_range = 14.0
	torch.spot_angle = 24.0
	torch.spot_angle_attenuation = 2.5
	torch.shadow_enabled = true
	torch.light_color = Color(1, 0.94, 0.84)
	torch.add_to_group("hs_no_zone")
	torch.visible = false
	cam.add_child(torch)
	torch.position = Vector3(0.18, -0.2, -0.1)
	var tb := HSBeam.new()
	tb.cookie = "flashlight"
	torch.add_child(tb)
	var story := main.get_node("Story")
	var hud_on := func(on: bool): story.visible = on
	hud_on.call(false)
	var hud := main.get_node("HUD") as CanvasLayer
	hud.visible = false                                        # (the UI plugin's HUD only where the guide's added it)
	await process_frame
	await process_frame
	var fl := float(cfg["floor"])
	var eye := fl + 1.6
	var R: Dictionary = cfg["rooms"]
	var cz := float(R["corridor"]["at"][2])
	var st: Dictionary = R["stairs"]
	var her := main.get_node("Her") as Node3D
	var again := main.get_node("HerAgain") as Node3D
	her.get_node("Presence").process_mode = Node.PROCESS_MODE_DISABLED   # her signs held still: no lamp caught mid-dip
	main.get_node("Weather/Lightning").every = 0.0                        # no strike of its own in the pictures (one is set by hand below)
	her.get_node("Uncanny").mimic = false                                 # (her head stays bent; she doesn't walk in the pictures)
	# the stairwell from its foot, up the first flight
	var sx := float(st["at"][0])
	var south := float(st["at"][2]) + float(st["size"][2]) / 2.0
	var north := float(st["at"][2]) - float(st["size"][2]) / 2.0
	await shot("stairs", Vector3(sx + 0.5, 1.6, south - 0.3), Vector3(sx - 0.2, 1.9, north + 0.6))
	# the stairwell's window from the first flight: the street lamp's shaft, the leak under the window, the puddle on the landing
	var sg := v3(cfg["boxes"]["stair_glass"]["at"])
	var land_top := float(cfg["boxes"]["stairs_fx_half_1"]["top"])
	await shot("landing", Vector3(sg.x - 0.55, land_top + 0.9, sg.z + 2.4), Vector3(sg.x + 0.05, land_top + 0.55, sg.z + 0.1), 50)
	# the corridor from the stair door, down to the fire exit
	var x0 := 1.3
	await shot("corridor", Vector3(x0, eye, cz + 0.35), Vector3(x0 + 12.0, eye - 0.25, cz - 0.1))
	for l in tubes():
		Lights.set_level(l, 0.15)
	await shot("corridor_dim", Vector3(x0, eye, cz + 0.35), Vector3(x0 + 12.0, eye - 0.25, cz - 0.1), 8)   # before the iris opens up: as the player sees it happen
	# the air: the corridor dark, the flashlight's beam in its haze, dust in the beam
	for l in tubes():
		Lights.set_on(l, false)
	torch.visible = true
	await shot("air", Vector3(x0, eye, cz + 0.15), Vector3(x0 + 9.0, eye - 0.45, cz - 0.05), 40)
	torch.visible = false
	for l in tubes():
		Lights.set_on(l, true)
		Lights.set_level(l, 1.0)
	# 304's door, the note on the carpet, the to-do list and the line
	var d304n := main.get_node("Hotel").find_child("door_door_304", true, false) as Node3D
	var dmid := d304n.global_position + d304n.global_basis.x * 0.4
	var note := v3(cfg["note"])
	hud_on.call(true)
	story.say("Locked.", 30.0)
	await shot("door304", Vector3(dmid.x - 0.35, eye, dmid.z - 1.75), Vector3(dmid.x, fl + 0.95, dmid.z))
	story._line.visible = false
	story.card("Under 304's door", main.get_node("Things/Note").text)
	await shot("note", Vector3(note.x - 0.1, eye, note.z - 0.9), note + Vector3(0, 0.1, 0))
	story.close_card()
	story.add_line("key: Find the master key in the linen closet")
	story._line.visible = false
	# the corner of your eye: her at 308's door, 36 degrees off where you look
	var gl := main.get_node("Events/Glimpse") as Node3D
	var gfig: Node3D = gl.get("figure")
	gfig.visible = true
	var gfrom := Vector3(8.0, eye, cz)
	var gto := gl.global_position + Vector3.UP * 1.3
	await shot("glimpse", gfrom, gfrom + (gto - gfrom).normalized().rotated(Vector3.UP, deg_to_rad(36.0)) * 5.0)
	gfig.visible = false
	# the linen closet in the flashlight's beam: the key on the shelf
	var key := v3(cfg["key"])
	torch.visible = true
	await shot("linen", Vector3(key.x + 0.35, eye, key.z + 1.25), key + Vector3(0, -0.1, 0))
	# 304: the bed, the TV's static, the lamp; the bath: the mirror, the wet floor, the blood
	torch.visible = false
	var r: Dictionary = R["r304"]
	var rc := v3(r["at"])
	await shot("room304", Vector3(rc.x - 1.6, eye, rc.z + 1.3), Vector3(rc.x + 2.3, fl + 1.2, rc.z - 0.2))
	# closer each time: her on her second mark, where the entry opens into the room, from where you stood at the TV
	var cl := main.get_node("Events/Closer") as Node3D
	var cfig: Node3D = cl.get("figure")
	var m1 := (cl.get_node("EntryMouth") as Node3D).global_position
	var cfrom := Vector3(rc.x + 0.6, eye, rc.z + 0.4)
	cfig.global_position = m1
	cfig.global_rotation = Vector3(0.0, atan2(cfrom.x - m1.x, cfrom.z - m1.z), 0.0)
	cfig.visible = true
	await shot("closer", cfrom, m1 + Vector3(0, 1.05, 0))
	cfig.visible = false
	# a shadow that isn't yours: someone crossing behind you, her shadow on the bath's wall, the floor lamp behind you
	var sp := main.get_node("Events/ShadowPass")
	var you := Vector3(rc.x - 0.9, fl, rc.z - 1.2)
	sp.pose(you, 0.5)
	await shot("shadow", you + Vector3(0, 1.6, 0), Vector3(you.x + 0.15, fl + 1.15, you.z - 2.0), 50)
	(sp.get("figure") as Node3D).visible = false
	# a cue: lying in 304's bed, looking up past its foot, her on the ceiling in the top right corner of your view
	var bfig: Node3D = main.get_node("Events/BedCeiling").get("appear")
	bfig.visible = true
	hud_on.call(false)                                         # (the cue comes on the way out: the pictures' list is still the way in)
	var be := v3(cfg["bed_eye"])
	await shot("cue", be, be + Vector3(0.342, 0.940, 0.0), 50)
	bfig.visible = false
	hud_on.call(true)
	var b: Dictionary = R["r304_bath"]
	var bc := v3(b["at"])
	await shot("bath", Vector3(bc.x + 0.85, eye - 0.15, bc.z + 0.7), Vector3(bc.x - 0.4, fl + 0.45, bc.z - 0.4))
	# only in the mirror: her standing in the tub behind you, in the bath's mirror
	var mh := main.get_node("Events/MirrorHer")
	mh.arm()
	var mg := v3(cfg["boxes"]["mirror"]["at"])
	await shot("mirror", Vector3(mg.x + 0.15, eye, mg.z + 1.03), mg + Vector3(0, -0.05, 0), 50)
	mh.set("armed", false)                                     # (stood down: with --only her first frame could still come after this)
	(mh.get("figure") as Node3D).visible = false
	# writing in the steam: the same mirror fogged over, 308 in it (once she's gone from it, on the way out)
	var mirror_n := main.get_node("Dressing/Mirror")
	mirror_n.steam = 1.0
	mirror_n.writing = "308"
	hud_on.call(false)
	await shot("steam", Vector3(mg.x + 0.15, eye, mg.z + 1.03), mg + Vector3(0, -0.05, 0), 30)
	hud_on.call(true)
	mirror_n.steam = 0.0
	mirror_n.writing = ""
	# the vending corner: its dying bulb, the batteries on the counter
	var bat := v3(cfg["batteries"])
	var bulb := main.get_node("Zones/Vending/Bulb")
	bulb.amount = 0.0                                          # the dying bulb caught on, for the picture
	await shot("vending", Vector3(bat.x - 0.4, eye, bat.z + 1.6), bat + Vector3(-0.3, 0.2, 0))
	bulb.amount = 1.0
	# the end window: rain on it
	await shot("window", Vector3(1.05, eye, cz + 0.15), Vector3(0.0, eye - 0.15, cz - 0.05))
	# the cold: the end window frosted up from its bottom edge, your breath in the flashlight's beam
	var pane_n := main.get_node("Weather/Pane")
	pane_n.frost = 0.8
	var cb := HSBreath.make(cam, {"on": false, "strength": 1.0})
	main.add_child(cb)
	torch.visible = true
	hud_on.call(false)
	for l in tubes():                                          # the corridor dark (as it will be): the breath shows in the beam, not against a lit wall
		Lights.set_on(l, false)
	var cold_from := Vector3(2.3, eye, cz + 0.25)                  # back from the window: the breath crosses the beam against the dim wall under it
	var cold_to := Vector3(0.0, eye - 0.45, cz - 0.05)
	cam.global_position = cold_from
	cam.look_at(cold_to, Vector3.UP)
	await shot("cold", cold_from, cold_to, 42)
	# and your breath there, facing down the dark corridor: the beam carried off into the dark, the breath crossing it
	var breath_from := Vector3(0.55, eye, cz + 0.1)
	var breath_to := Vector3(10.0, eye - 0.35, cz)
	cam.global_position = breath_from
	cam.look_at(breath_to, Vector3.UP)
	for i in 20:
		await process_frame
	cb.exhale()
	await shot("breath", breath_from, breath_to, 40)
	pane_n.frost = 0.0
	torch.visible = false
	hud_on.call(true)
	for l in tubes():
		Lights.set_on(l, true)
	cb.queue_free()
	# lightning: the corridor from the middle toward the end window, the flash through it, someone standing there in it
	var storm := main.get_node("Weather/Lightning")
	await process_frame
	var flash: HSLightning = storm.get("storm")
	var flash_fig := main.get_node("Events/InTheFlash") as Node3D
	flash.light.visible = true
	flash.light.light_energy = flash.strength
	flash_fig.visible = true
	await shot("lightning", Vector3(6.5, eye, cz + 0.2), Vector3(0.0, eye - 0.25, cz - 0.05), 8)   # as the eye meets it: before the iris closes
	flash.light.visible = false
	flash.light.light_energy = 0.0
	flash_fig.visible = false
	# her at the end of the corridor, in the flashlight's beam; then the corridor dark
	her.visible = true
	torch.visible = true
	var hp := her.global_position
	story.objective("Get out. The fire exit is at the end of the corridor.")
	await shot("her", Vector3(hp.x - 4.2, eye, cz + 0.2), hp + Vector3(0, 1.3, 0))
	for l in tubes():
		Lights.set_on(l, false)
	main.get_node("Air").fog = 0.55                             # LightsOut's fog, rolled in
	await shot("dark", Vector3(hp.x - 6.5, eye, cz - 0.3), hp + Vector3(0, 1.2, 0), 60)
	# feet under 308's door: its light in the dark corridor, someone standing behind it
	var ft := main.get_node("Events/Feet308") as Node3D
	ft.pose()
	her.visible = false
	torch.visible = false                                      # the light under the door alone
	var fp := ft.global_position
	await shot("feet", fp + ft.global_basis.z * 1.3 + Vector3(-1.4, 1.55, 0.0), fp + Vector3(0.0, 0.05, 0.0), 60)
	# hiding: from the linen closet's corner, her in its doorway (the close pass), the dark corridor behind her
	var hunter := main.get_node("Events/Hunter") as Node3D
	var he := v3(cfg["hide_eye"])
	var ha := v3(cfg["hide_app"])
	var linen := main.get_node("Hotel").find_child("door_door_linen", true, false)
	if linen != null:
		linen.set("open", true)                                # she opened it coming in
	hunter.global_position = Vector3(ha.x, fl, ha.z)
	var hto := he - hunter.global_position
	hunter.global_rotation.y = atan2(hto.x, hto.z)             # facing your corner
	hunter.visible = true
	hud_on.call(false)
	await shot("hunt", he, Vector3(ha.x, fl + 1.2, ha.z), 60)
	hunter.visible = false
	hud_on.call(true)
	# the jump scare: her right there by the fire door
	her.visible = false
	again.visible = true
	var ap := again.global_position
	hud_on.call(false)
	var vhs: Node = null
	for n in root.find_children("*", "CanvasLayer", true, false):
		if n.has_method("preset") and n.get("preset_name") != null:
			vhs = n
	if vhs != null:
		vhs.preset("nightmare")                                   # the jump's tape breaking up
	await shot("jump", Vector3(ap.x - 1.15, eye, cz + 0.1), ap + Vector3(0, 1.4, 0), 30)
	if vhs != null:
		vhs.preset("off")
	# ---- every system since: the HUD's markers, the laptop, its shop, the parcels, the gun, things that break and glow, her shot
	again.visible = false
	hud_on.call(true)
	hud.visible = true
	for l in tubes():
		Lights.set_on(l, true)
		Lights.set_level(l, 1.0)
	main.get_node("Air").fog = 0.3
	story.tick("up")
	story.tick("find304")
	story.add_line("out: Get out by the fire exit")
	if linen != null:
		linen.set("open", false)                               # (the hiding picture's open door shut again)
	for i in 40:
		await process_frame
	# the quest markers: down the corridor, the fire exit's with its name (within 7 m), the to-do list's out
	var fx := float(cfg["fire"][0])
	await shot("markers", Vector3(fx - 5.6, eye, cz + 0.3), Vector3(fx, eye - 0.1, cz - 0.15), 60)
	# the laptop on 304's desk, its screen raining; the $20 note; the kettle on the boil, the mug of tea
	var lpos := v3(cfg["laptop"])
	await shot("laptop", Vector3(lpos.x - 1.3, eye - 0.1, lpos.z + 0.6), lpos + Vector3(0.05, 0.02, -0.4), 50)
	# the shop: at the laptop on its DEFENCE page, the knocks come: the shotgun and the shells, the explosive shells a ?
	var lap := main.get_node("Things/Laptop")
	story.flag("knocked_304")
	story.add_line("gun: Something to defend yourself with (the laptop on the desk)")
	story.earn(20.0)
	lap.use(player)
	for i in int((float(lap.zoom_secs) + 3.6) * 30.0):
		await process_frame
	lap.term.show_tab("ORDER")
	var od: Node = lap.term.order
	od.refresh()
	od.show_page(od.page_of("explosive"), false)
	for i in 3:
		await process_frame
	var ex_item: HSShopItem = null
	for it in od.items:
		if (it as HSShopItem).id == "explosive":
			ex_item = it
	od.select(ex_item, false)
	await snap("shop", 50)
	lap.leave()
	for i in int((float(lap.zoom_secs) + 0.5) * 30.0):
		await process_frame
	player.process_mode = Node.PROCESS_MODE_DISABLED
	cam.make_current()
	# the parcels left at 304's door, a marker over each
	var spot := main.get_node("Things/Doorstep") as Node3D
	var sg_item: HSShopItem = load("res://shop/items/shotgun.tres")
	var sh_item: HSShopItem = load("res://shop/items/shells.tres")
	lap.call("_drop", spot, {"number": 1001, "items": [sg_item], "counts": [1]})
	lap.call("_drop", spot, {"number": 1002, "items": [sh_item], "counts": [1]})
	var sp0 := spot.global_position
	await shot("parcels", Vector3(sp0.x - 1.9, eye, sp0.z - 0.95), sp0 + Vector3(0.1, 0.25, 0.25), 50)
	# E on the gun's: the box gone in a puff, the double out of it at its own size, about to be pulled into you
	var pk: HSPackage = null
	for c in spot.get_children():
		if c is HSPackage and (c as HSPackage).items.size() > 0 and ((c as HSPackage).items[0] as HSShopItem).id == "shotgun":
			pk = c
	var ufrom := Vector3(pk.global_position.x + 0.25, eye, pk.global_position.z - 1.15)
	player.global_position = ufrom - Vector3(0, 1.6, 0)          # (what comes out is pulled to the player's eye)
	pk.unbox()
	await shot("unbox", ufrom, pk.global_position + Vector3(0, 0.45, 0), 13)
	for i in 60:
		await process_frame
	# the double in your hands in 304, the tea things ahead; both barrels: the kettle and the mug in pieces, the tea spilled
	var gun := player.get_node("Eye/Shotgun") as Node3D
	gun.process_mode = Node.PROCESS_MODE_ALWAYS
	gun.call("give", 5, null)
	var kp := v3(cfg["kettle"])
	var mp := v3(cfg["mug"])
	var tfrom := Vector3(kp.x - 1.7, eye, kp.z + 0.3)
	var pe := eye_at(player, tfrom, kp + Vector3(-0.1, 0.05, 0.12))
	torch.reparent(pe, false)
	torch.position = Vector3(0.18, -0.2, -0.1)
	torch.visible = true
	await snap("gun", 50)
	eye_at(player, tfrom, kp + Vector3(0, 0.1, 0))
	for i in 3:
		await process_frame
	gun.call("pull")
	for i in 12:
		await process_frame
	eye_at(player, tfrom, mp + Vector3(0, 0.05, 0))
	for i in 3:
		await process_frame
	gun.call("pull")
	for i in 40:
		await process_frame
	eye_at(player, tfrom, kp + Vector3(-0.1, -0.05, 0.12))
	await snap("blown", 45)
	# a candle burning on the bath's floor (its flame and its light: HSPropFX), the bath's light low
	torch.visible = false
	cam.make_current()
	var bath_l := main.get_node("Zones/Bath304/Light") as Light3D
	var bath_was := bath_l.light_energy
	bath_l.light_energy = 0.12
	var cp := v3(cfg["candle"])
	await shot("candle", Vector3(cp.x + 0.25, fl + 1.25, cp.z + 1.05), cp + Vector3(-0.05, 0.04, 0), 50)
	bath_l.light_energy = bath_was
	# her who hunts, coming at you down the dark corridor: both barrels, black ichor and smoke; then she's smoke
	for l in tubes():
		Lights.set_on(l, false)
	main.get_node("Air").fog = 0.45
	var post := v3(cfg["her"])
	hunter.global_position = Vector3(post.x - 3.0, fl, cz)
	hunter.global_rotation = Vector3(0.0, -PI / 2.0, 0.0)          # (her front, +Z, to the west: at you)
	hunter.visible = true
	gun.set("loaded", 2)
	var hfrom := Vector3(post.x - 6.3, eye, cz + 0.1)
	pe = eye_at(player, hfrom, hunter.global_position + Vector3(0, 1.25, 0))
	torch.visible = true
	for i in 20:
		await process_frame
	gun.call("pull")
	await snap("her_shot", 12)
	eye_at(player, hfrom, hunter.global_position + Vector3(0, 1.25, 0))
	gun.call("pull")
	await snap("her_smoke", 55)
	torch.visible = false
	torch.reparent(cam, false)
	cam.make_current()
	hud.visible = false
	# the ending
	again.visible = false
	hud_on.call(true)
	story.end()
	await shot("ending", Vector3(ap.x - 1.2, eye, cz), ap + Vector3(1.0, 1.4, 0), 90)
	quit()
