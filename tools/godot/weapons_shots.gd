## The weapons plugin's pictures (tools/godot/weapons_check.py --pictures): the shotgun in the hotel's corridor at
## night as the player sees it. idle, aim (held to the eye), fire (the flash's frame), rack (the pump back, the hull in
## the air), reload (a shell going into the port), floor (the hulls on the carpet in the flashlight), tape (the gun in
## the tape's 4:3 picture, camhybrid), box and box_open (the box of shells where it lies, shut and open); the muzzle
## and what shots leave: trail (the smoke left behind as the gun swings, in the flashlight), marks (a wall's craters
## close, the light raking across them), explosive (the explosive shell's flash), blast (its ball of fire down the
## corridor), scorch (the scorch and its embers after, the smoke rising).
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


func shot(name: String, hold := 30) -> void:
	if not only.is_empty() and not only.has(name):
		return
	await frames(hold)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	print("SHOT %s" % name)


func seconds(prop: String) -> float:
	return float(gun.get(prop))


func now(name: String) -> void:
	if not only.is_empty() and not only.has(name):
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	print("SHOT %s" % name)


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
	gun.pull()
	await frames(1)
	await now("fire")
	await frames(10)
	await now("rack")                                             # the pump back, the hull just out of the port
	await frames(60)
	gun.set("loaded", 1)
	gun.set("spare", 6)
	gun.reload()
	for i in 150:                                                 # the second shell on its way into the port
		await process_frame
		if int(gun.get("loaded")) == 2:
			await frames(int(seconds("insert_gap") * 30.0 + seconds("insert_secs") * 15.0))
			await now("reload")
			break
	await frames(90)
	for i in 2:                                                   # two more hulls on the floor
		gun.pull()
		await frames(36)
	await frames(60)
	var eye := player.get_node("Eye") as Camera3D
	var torch := player.get_node("Eye/Flashlight") as Node3D
	torch.visible = true                                          # the flashlight on: the hulls in its beam
	var hs: Array = gun.get("_hulls")
	var mid := Vector3.ZERO
	for h in hs:
		mid += (h as Node3D).global_position / float(hs.size())
	var yaw0 := player.rotation.y
	var d := mid - player.global_position                         # looking at the hulls where they lie
	player.rotation.y = atan2(-d.x, -d.z)
	var e := mid - eye.global_position
	var pt := atan2(e.y, Vector2(e.x, e.z).length())
	player.set("pitch", pt)
	eye.rotation.x = pt
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
	quit()


# the muzzle and what shots leave: the trail behind the gun as it swings, a wall's craters close in a raking light, the
# explosive shell's flash, its ball of fire, its scorch
func muzzle_shots() -> void:
	var names := ["trail", "marks", "explosive", "blast", "scorch"]
	if not only.is_empty() and names.all(func(n): return not only.has(n)):
		return
	var eye := player.get_node("Eye") as Camera3D
	var torch := player.get_node("Eye/Flashlight") as Node3D
	var home := player.global_position
	var yaw0 := player.rotation.y
	torch.visible = true                                          # the flashlight under the barrel: its beam through the smoke
	gun.set("loaded", 3)
	gun.set("chambered", true)
	await frames(20)
	gun.pull()
	for i in 54:                                                  # the gun swung right after the shot: the smoke stays behind
		await process_frame
		player.rotation.y -= 0.009
	await now("trail")
	await frames(120)
	player.rotation.y = yaw0
	# a wall's craters close: two shots at the corridor's south wall from a metre, then up to it, the light raking
	var cz := player.global_position.z
	player.global_position = home + Vector3(-1.0, 0.0, 0.0)
	var south := Vector3(player.global_position.x, eye.global_position.y - 0.25, cz - 3.0)
	var d := south - player.global_position
	player.rotation.y = atan2(-d.x, -d.z)
	player.set("pitch", -0.12)
	eye.rotation.x = -0.12
	await frames(10)
	for i in 2:
		gun.set("chambered", true)
		gun.pull()
		await frames(40)
	await frames(30)
	var im := get_first_node_in_group("hs_impacts")
	var ms: Array = (im.get("marks") as Array).slice(-14) if im != null else []
	var mid := Vector3.ZERO
	var nrm := Vector3.ZERO
	for m in ms:
		mid += (m as Node3D).global_position / float(ms.size())
		nrm += (m as Node3D).global_basis.y / float(ms.size())
	var cam := Camera3D.new()
	main.add_child(cam)
	cam.fov = 40.0
	nrm = nrm.normalized() if nrm.length() > 0.1 else Vector3(0, 0, 1)
	cam.global_position = mid + nrm * 0.55 + Vector3(0, 0.05, 0)
	cam.look_at(mid, Vector3.UP)
	var rake := SpotLight3D.new()                                 # a light across the wall: the craters' walls catch it
	main.add_child(rake)
	rake.global_position = mid + nrm * 0.35 + (nrm.cross(Vector3.UP).normalized()) * 0.7 + Vector3(0, 0.25, 0)
	rake.look_at(mid, Vector3.UP)
	rake.spot_angle = 30.0
	rake.light_energy = 2.2
	rake.spot_range = 3.0
	rake.shadow_enabled = true
	rake.light_color = Color(1.0, 0.95, 0.86)
	gun.set("owned", false)                                       # (out of the picture, its flashlight off the wall)
	torch.visible = false
	cam.current = true
	await shot("marks", 20)
	cam.current = false
	eye.current = true
	gun.set("owned", true)
	torch.visible = true
	rake.queue_free()
	cam.queue_free()
	# the explosive shell: loaded with T's kind, fired at the floor down the corridor
	player.global_position = home
	player.rotation.y = yaw0
	var ex = load("res://addons/horrorstudio_weapons/shells/explosive.tres")
	gun.add_shells(2, ex)
	gun.set_load_kind(ex)
	gun.set("loaded", 0)
	gun.set("chambered", false)
	gun.set("tube", [])
	gun.reload()
	for i in 400:
		await process_frame
		if not bool(gun.get("busy")):
			break
	player.set("pitch", -0.33)
	eye.rotation.x = -0.33
	torch.visible = false
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


# the box of shells where it lies (the ammo family's shells_box_5), close under a held light: shut, then its lid open
func box_shots() -> void:
	if not only.is_empty() and not only.has("box") and not only.has("box_open"):
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
