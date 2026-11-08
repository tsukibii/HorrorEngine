## The guide's pictures (tools/godot/tutorial_v2.py --pictures): guides/tutorial_v2's main.tscn drawn by Godot as the
## player sees it, the Story's words on screen where the guide shows them. Each shot a camera of its own at the eye's
## height, held a while (TAA and the iris settle), saved as <out>/<name>.png. `--only=a,b` makes only those (the rest of
## the walk still set up as it goes).
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
	var b: Dictionary = R["r304_bath"]
	var bc := v3(b["at"])
	await shot("bath", Vector3(bc.x + 0.85, eye - 0.15, bc.z + 0.7), Vector3(bc.x - 0.4, fl + 0.45, bc.z - 0.4))
	# the vending corner: its dying bulb, the batteries on the counter
	var bat := v3(cfg["batteries"])
	var bulb := main.get_node("Zones/Vending/Bulb")
	bulb.amount = 0.0                                          # the dying bulb caught on, for the picture
	await shot("vending", Vector3(bat.x - 0.4, eye, bat.z + 1.6), bat + Vector3(-0.3, 0.2, 0))
	bulb.amount = 1.0
	# the end window: rain on it
	await shot("window", Vector3(1.05, eye, cz + 0.15), Vector3(0.0, eye - 0.15, cz - 0.05))
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
	# the ending
	again.visible = false
	hud_on.call(true)
	story.end()
	await shot("ending", Vector3(ap.x - 1.2, eye, cz), ap + Vector3(1.0, 1.4, 0), 90)
	quit()
