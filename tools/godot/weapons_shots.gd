## The weapons plugin's pictures (tools/godot/weapons_check.py --pictures): the double barrel in the hotel's corridor at
## night as the player sees it. idle (only its barrels in the view), aim (held to the eye), fire (the right barrel's
## flash), fire_left (the left's a quarter second later, through the first's smoke), open (broken open in the view, the
## hulls just flicked out), pop (a shell on its way into its chamber), floor (the hulls on the carpet in the
## flashlight), tape (the gun in the tape's 4:3 picture, camhybrid), trail (the smoke left behind as the gun swings);
## what a 12-gauge leaves on a wall (docs/research/shotgun_damage.md), each close in a light raking across it:
## damage_arm (from an arm's length), damage_room (across a room), damage_corridor (down a corridor), damage_concrete;
## explosive (the explosive shell's flash), blast (its ball of fire down the corridor), scorch (the scorch and its
## embers after, the smoke rising); box and box_open (the box of shells where it lies, shut and open); blowup_before,
## blowup_burst, blowup_mug, blowup_after, blowup_close, blowup_cut (things that break when they're shot: HSBlowUp).
##   godot --path PROJECT --rendering-driver vulkan --fixed-fps 30 -s weapons_shots.gd -- --out=DIR [--only=idle,fire]
extends SceneTree

var out_dir := ""
var only: PackedStringArray = []
var main: Node3D
var player: Node3D
var gun: Node


func frames(n: int) -> void:
	for i in n:
		await process_frame


func wanted(name: String) -> bool:
	return only.is_empty() or only.has(name)


func shot(name: String, hold := 30) -> void:
	if not wanted(name):
		return
	await frames(hold)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	print("SHOT %s" % name)


func now(name: String) -> void:
	if not wanted(name):
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	print("SHOT %s" % name)


func idle_gun(secs: float) -> void:
	for i in int(secs * 30.0):
		if not bool(gun.get("busy")):
			return
		await process_frame


func look(p: Vector3) -> void:
	var eye := player.get_node("Eye") as Camera3D
	var d := p - player.global_position
	player.rotation.y = atan2(-d.x, -d.z)
	var e := p - eye.global_position
	var pt := atan2(e.y, Vector2(e.x, e.z).length())
	player.set("pitch", pt)
	eye.rotation.x = pt


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--only="):
			only = a.substr(7).split(",", false)
	root.size = Vector2i(1600, 900)
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	player = main.get_node("Player") as Node3D
	gun = main.get_node("Player/Eye/Shotgun")
	main.get_node("Story").visible = false
	var tape := main.get_node_or_null("Tape")
	if tape != null:
		tape.set("preset", "off")
	for l in main.get_node("Hotel").find_children("*", "Light3D", true, false):
		(l as Light3D).light_energy *= 0.13                       # the corridor at night: its lights low and cold
		(l as Light3D).light_color = Color(0.78, 0.86, 1.0)
	await frames(20)
	await shot("idle", 50)
	gun.set_aim(true)
	await shot("aim", 25)
	gun.set_aim(false)
	await frames(20)
	gun.pull()                                                    # the right barrel
	await frames(1)
	await now("fire")
	await idle_gun(1.0)
	gun.pull()                                                    # the left, a quarter second on: through the first's smoke
	await frames(1)
	await now("fire_left")
	await frames(20)
	gun.reload()
	for i in 120:                                                 # broken open, the hulls just thrown
		await process_frame
		if float(gun.get("opened")) > 0.99:
			break
	await frames(2)
	await now("open")
	for i in 120:                                                 # the second shell on its way in
		await process_frame
		if int(gun.get("loaded")) >= 1:
			break
	await frames(int(float(gun.get("pop_secs")) * 30.0 * 0.5) + 2)
	await now("pop")
	await idle_gun(4.0)
	await frames(10)
	for i in 2:                                                   # two more hulls on the floor
		gun.pull()
		await idle_gun(1.0)
		await frames(6)
	gun.reload()
	await idle_gun(4.0)
	await frames(60)
	var eye := player.get_node("Eye") as Camera3D
	var torch := player.get_node("Eye/Flashlight") as Node3D
	torch.visible = true                                          # the flashlight on: the hulls in its beam
	var hs: Array = (gun.get("_hulls") as Array).filter(func(h): return is_instance_valid(h))
	var mid := Vector3.ZERO
	for h in hs:
		mid += (h as Node3D).global_position / float(maxi(hs.size(), 1))
	var yaw0 := player.rotation.y
	look(mid)                                                     # looking at the hulls where they lie
	var lamps := main.get_node("Hotel").find_children("*", "Light3D", true, false)
	for l in lamps:
		(l as Light3D).light_energy /= 0.13                       # (the lights up for this one: the hulls on the carpet)
	await shot("floor", 30)
	for l in lamps:
		(l as Light3D).light_energy *= 0.13
	torch.visible = false
	player.set("pitch", 0.0)
	eye.rotation.x = 0.0
	player.rotation.y = yaw0
	var vhs = main.get_node("Tape").get("vhs")
	vhs.call("preset", "camhybrid")
	await shot("tape", 40)
	vhs.call("preset", "off")
	await muzzle_shots()
	await box_shots()
	await blowup_shots()
	quit()


# the muzzle and what shots leave: the trail behind the gun as it swings, a wall shot from three distances and a
# concrete one, the explosive shell's flash, its ball of fire, its scorch
func muzzle_shots() -> void:
	var names := ["trail", "damage_arm", "damage_room", "damage_corridor", "damage_concrete", "explosive", "blast", "scorch"]
	if names.all(func(n): return not wanted(n)):
		return
	var eye := player.get_node("Eye") as Camera3D
	var torch := player.get_node("Eye/Flashlight") as Node3D
	var home := player.global_position
	var yaw0 := player.rotation.y
	torch.visible = true                                          # the flashlight under the barrels: its beam through the smoke
	gun.set("loaded", 2)                                          # (the double's chambers follow `loaded`)
	await frames(20)
	gun.pull()
	for i in 54:                                                  # the gun swung right after the shot: the smoke stays behind
		await process_frame
		player.rotation.y -= 0.009
	await now("trail")
	await frames(120)
	player.rotation.y = yaw0
	torch.visible = false
	await damage_shots()
	# the explosive shell: two of them loaded with T's kind, the right barrel fired at the floor down the corridor
	player.global_position = home
	player.rotation.y = yaw0
	var ex = load("res://addons/horrorstudio_weapons/shells/explosive.tres")
	gun.set("loaded", 0)
	await frames(3)
	gun.add_shells(2, ex)
	gun.set_load_kind(ex)
	gun.reload()
	await idle_gun(5.0)
	player.set("pitch", -0.33)
	eye.rotation.x = -0.33
	await frames(30)
	gun.pull()
	await frames(1)
	await now("explosive")
	await frames(5)
	await now("blast")
	await frames(150)
	torch.visible = true
	player.set("pitch", -0.42)
	eye.rotation.x = -0.42
	await frames(10)
	await now("scorch")
	torch.visible = false
	gun.set_load_kind(gun.normal_kind())
	player.set("pitch", 0.0)
	eye.rotation.x = 0.0


# what a 12-gauge leaves on a wall: two panels across the corridor's east end facing west, painted plasterboard and bare
# concrete, shot with the right barrel from an arm's length, across a room and down the corridor (the muzzle 0.15, 2.5
# and 4.5 m off, apart on the panel, the pellets seeded as WEAPONS seeds them), then each close in a light raking across it
func damage_shots() -> void:
	var cases := [["damage_arm", 0.15, 0, 0.1, -0.24, 11], ["damage_room", 2.5, 0, 0.0, 0.22, 23], ["damage_corridor", 4.5, 0, -0.4, -0.05, 37], ["damage_concrete", 2.5, 1, 0.0, 0.0, 41]]
	if cases.all(func(c): return not wanted(str(c[0]))):
		return
	var cfg: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://weapons.json"))
	var corr: Dictionary = cfg["corridor"]
	var fl := float(cfg["floor"])
	var px := float(corr["at"][0]) + float(corr["size"][0]) / 2.0 - 2.4
	var pz := [float(corr["at"][2]) - 0.45, float(corr["at"][2]) + 0.45]
	var panels: Array = []
	for k in 2:
		var body := StaticBody3D.new()
		body.set_meta("hs_surface", "plaster" if k == 0 else "concrete")
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(0.1, 1.5, 0.86)
		cs.shape = bs
		body.add_child(cs)
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = bs.size
		mi.mesh = bm
		var mat := StandardMaterial3D.new()
		if k == 0:
			mat.albedo_color = Color(0.86, 0.84, 0.8)                 # painted plasterboard
			mat.roughness = 0.88
		else:
			var nz := FastNoiseLite.new()                             # bare concrete: grey, its grain fine and uneven
			nz.frequency = 0.3
			nz.fractal_octaves = 4
			var ramp := Gradient.new()
			ramp.set_color(0, Color(0.5, 0.5, 0.48))
			ramp.set_color(1, Color(0.74, 0.73, 0.7))
			var nt := NoiseTexture2D.new()
			nt.width = 512
			nt.height = 512
			nt.seamless = true
			nt.noise = nz
			nt.color_ramp = ramp
			mat.albedo_texture = nt
			mat.roughness = 0.95
			mat.uv1_scale = Vector3(2, 2, 2)
		mi.material_override = mat
		body.add_child(mi)
		main.add_child(body)
		body.global_position = Vector3(px + 0.05, fl + 1.25, pz[k])
		panels.append(body)
	await frames(10)
	var eye := player.get_node("Eye") as Camera3D
	var ahead := -eye.to_local(gun.muzzle(0).global_position).z
	var mids := {}
	for c in cases:
		gun.set("loaded", 2)
		await frames(3)
		var pzi: float = pz[int(c[2])]
		player.global_position = Vector3(px - float(c[1]) - ahead, fl, pzi)
		await frames(2)
		look(Vector3(px, eye.global_position.y + float(c[3]), pzi + float(c[4])))
		await frames(3)
		seed(int(c[5]))                                           # (the pellets are the shot's first randoms)
		gun.pull()
		await frames(2)
		var on: Array = (gun.get("last_hits") as Array).filter(func(h): return h["collider"] == panels[int(c[2])])
		var m := Vector3.ZERO
		for h in on:
			m += (h["point"] as Vector3) / float(maxi(on.size(), 1))
		mids[c[0]] = m
		await frames(12)
	gun.set("owned", false)                                       # (out of the pictures, its flashlight with it)
	await frames(90)                                              # (the dust settled, the smoke gone from the panels)
	for c in cases:
		if not wanted(str(c[0])):
			continue
		var mid: Vector3 = mids[c[0]]
		var nrm := Vector3(-1, 0, 0)
		var cam := Camera3D.new()
		main.add_child(cam)
		cam.fov = 40.0
		cam.global_position = mid + nrm * 0.5 + Vector3(0, 0.02, 0)
		cam.look_at(mid, Vector3.UP)
		var rake := SpotLight3D.new()                             # a light across the wall: the holes' walls catch it
		main.add_child(rake)
		var aside := 0.7 if mid.z < float(corr["at"][2]) else -0.7   # (from the corridor's middle: a wall would hide it)
		rake.global_position = mid + nrm * 0.3 + Vector3(0, 0.25, aside)
		rake.look_at(mid, Vector3.UP)
		rake.spot_angle = 32.0
		rake.light_energy = 2.2
		rake.spot_range = 3.0
		rake.shadow_enabled = true
		rake.light_color = Color(1.0, 0.95, 0.86)
		cam.current = true
		await shot(str(c[0]), 20)
		cam.current = false
		rake.queue_free()
		cam.queue_free()
	eye.current = true
	gun.set("owned", true)
	for p in panels:
		(p as Node).queue_free()
	await frames(20)


# the box of shells where it lies (the ammo family's shells_box_5), close under a held light: shut, then its lid open
func box_shots() -> void:
	if not wanted("box") and not wanted("box_open"):
		return
	var pk := main.get_node_or_null("Shells") as Node3D
	if pk == null:
		return
	var at := pk.global_position + Vector3(0, 0.015, 0)
	var cam := Camera3D.new()
	main.add_child(cam)
	cam.fov = 45.0
	cam.global_position = at + Vector3(-0.10, 0.30, 0.40)
	cam.look_at(at, Vector3.UP)
	cam.current = true
	var sp := SpotLight3D.new()
	main.add_child(sp)
	sp.global_position = at + Vector3(-0.25, 0.55, 0.35)
	sp.look_at(at, Vector3.UP)
	sp.spot_angle = 22.0
	sp.light_energy = 2.5
	sp.spot_range = 3.0
	sp.light_color = Color(1.0, 0.94, 0.84)
	sp.shadow_enabled = true
	await shot("box", 40)
	pk.call("_open_lid", pk.get_child(0), 100.0)
	await shot("box_open", 20)


# things that break when they're shot (HSBlowUp): a kettle, a mug of tea and a box of shells on the corridor's floor
# in the flashlight; the kettle shot (its own pieces flying), the mug (shattering, its tea), the box; the mess after
# from the eye and close under a held light; and the kettle's cut, its pieces laid apart as `preview` shows them
func blowup_shots() -> void:
	var names := ["blowup_before", "blowup_burst", "blowup_mug", "blowup_after", "blowup_close", "blowup_cut"]
	if names.all(func(n): return not wanted(n)):
		return
	var eye := player.get_node("Eye") as Camera3D
	var torch := player.get_node("Eye/Flashlight") as Node3D
	var home := player.global_position
	var yaw0 := player.rotation.y
	var things := {}
	var bus: Array = []
	for spec in [["Kettle", "electric_kettle", Vector3(-1.2, 0, 0.1), 0.5], ["Mug", "mug_stoneware", Vector3(-1.05, 0, -0.26), -0.6],
			["Box", "shells_box_5", Vector3(-0.98, 0, 0.42), 0.3]]:
		var th := (load("res://addons/horrorstudio_weapons/models/%s.glb" % spec[1]) as PackedScene).instantiate() as Node3D
		th.name = spec[0]
		main.add_child(th)
		th.global_position = home + (spec[2] as Vector3)
		th.rotation.y = float(spec[3])
		var b := HSBlowUp.new()
		th.add_child(b)
		things[spec[0]] = th
		bus.append(b)
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 30000:
		var all := true
		for b in bus:
			if not (b as HSBlowUp).is_prepared():
				all = false
		if all:
			break
		await process_frame
	torch.visible = true
	gun.set("loaded", 2)
	gun.set_aim(true)                                             # (held to the eye: the lens narrower, on what you shoot)
	var mid := home + Vector3(-1.1, 0.05, 0.08)
	look(mid)
	await frames(30)
	await shot("blowup_before", 20)
	look((things["Kettle"] as Node3D).global_position + Vector3(0, 0.11, 0))
	await frames(12)
	gun.pull()
	await frames(4)
	await now("blowup_burst")
	await frames(50)
	look((things["Mug"] as Node3D).global_position + Vector3(0, 0.05, 0))
	await frames(12)
	gun.pull()
	await frames(3)
	await now("blowup_mug")
	await frames(40)
	await idle_gun(3.0)
	gun.set("loaded", 2)
	await frames(6)
	look((things["Box"] as Node3D).global_position + Vector3(0, 0.03, 0))
	await frames(12)
	gun.pull()
	await frames(150)
	look(mid + Vector3(-0.35, -0.05, 0.0))
	await frames(15)
	await shot("blowup_after", 15)
	gun.set_aim(false)
	# close, low over the mess, under a held light
	var at := home + Vector3(-1.35, 0.0, 0.05)
	var cam := Camera3D.new()
	main.add_child(cam)
	cam.fov = 50.0
	cam.global_position = at + Vector3(0.55, 0.42, 0.2)
	cam.look_at(at, Vector3.UP)
	cam.current = true
	var sp := SpotLight3D.new()
	main.add_child(sp)
	sp.global_position = at + Vector3(0.45, 0.85, -0.3)
	sp.look_at(at, Vector3.UP)
	sp.spot_angle = 34.0
	sp.light_energy = 3.0
	sp.spot_range = 4.0
	sp.light_color = Color(1.0, 0.94, 0.84)
	sp.shadow_enabled = true
	torch.visible = false
	await shot("blowup_close", 30)
	# the kettle's cut: its pieces laid apart (a fresh one, by the east end), as the editor's preview draws them
	var kt := (load("res://addons/horrorstudio_weapons/models/electric_kettle.glb") as PackedScene).instantiate() as Node3D
	main.add_child(kt)
	var cut_at := home + Vector3(2.4, 0.0, 0.0)
	var lift := Vector3.ZERO
	kt.global_position = cut_at
	var kb := HSBlowUp.new()
	kt.add_child(kb)
	t0 = Time.get_ticks_msec()
	while not kb.is_prepared() and Time.get_ticks_msec() - t0 < 30000:
		await process_frame
	var res: Dictionary = kb.get("_res")
	var R: float = res["radius"]
	var c0: Vector3 = res["center"]
	kt.visible = false
	lift = Vector3(0, R * 0.95, 0)                               # (above the floor, every piece)
	for lf in (res["leaves"] as Array):
		var mi := MeshInstance3D.new()
		mi.mesh = lf["mesh"]
		main.add_child(mi)
		var out := (lf["center"] as Vector3) - c0
		out = out.normalized() if out.length() > 0.001 else Vector3.UP
		mi.global_transform = Transform3D(Basis(), cut_at + lift + out * R * 0.8)
	cam.global_position = cut_at + lift + Vector3(-0.62, 0.3, 0.42)
	cam.look_at(cut_at + lift + c0, Vector3.UP)
	sp.global_position = cut_at + Vector3(-0.5, 1.1, 0.6)
	sp.look_at(cut_at + lift + c0, Vector3.UP)
	sp.light_energy = 4.5
	var fill := OmniLight3D.new()
	main.add_child(fill)
	fill.global_position = cut_at + Vector3(0.6, 0.5, -0.5)
	fill.light_energy = 0.6
	fill.omni_range = 2.5
	await shot("blowup_cut", 30)
	player.rotation.y = yaw0
	player.set("pitch", 0.0)
	eye.rotation.x = 0.0
	eye.current = true
