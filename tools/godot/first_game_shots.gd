## The guides' pictures (tools/godot/first_game.py --pictures): guides/first_game's main.tscn drawn by Godot, as the
## player sees it and from above. Each shot a camera of its own, held a while (TAA settles), saved as <out>/<name>.png:
## street, door, inside, scare, her (the first game's) and interior_top, street_top, character (godot_by_hand's).
##   godot --path PROJECT --rendering-driver vulkan -s first_game_shots.gd -- --out=DIR
extends SceneTree

var out_dir := ""
var cam: Camera3D
var main: Node3D


func v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func box_of(n: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		if (mi as MeshInstance3D).mesh == null or not (mi as Node3D).is_visible_in_tree():
			continue
		var b: AABB = mi.global_transform * (mi as MeshInstance3D).get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box


func shot(name: String, from: Vector3, at: Vector3, hold := 24) -> void:
	cam.global_position = from
	cam.look_at(at, Vector3.UP)
	for i in hold:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out_dir.path_join(name + ".png"))
	print("SHOT %s" % name)


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
	root.size = Vector2i(1600, 900)
	var cfg: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://first.json"))
	main = (load("res://main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(main)
	var player := main.get_node("Player") as Node3D
	player.process_mode = Node.PROCESS_MODE_DISABLED            # the pictures' own camera, the player standing by
	(player.get_node("Eye") as Camera3D).current = false
	cam = Camera3D.new()
	cam.fov = 70.0
	cam.near = 0.03
	main.add_child(cam)
	cam.current = true
	await process_frame
	await process_frame
	var bung := main.get_node("Bungalow") as Node3D
	var her := main.get_node("Mari") as Node3D
	var street := main.get_node("Street") as Node3D
	var moon := main.get_node("Moon") as DirectionalLight3D
	var lamps: Array = bung.lamps()
	var a := v3(cfg["street"]["out1"])
	var b := v3(cfg["street"]["in0"])
	var ahead := (b - a).normalized()
	var hp := v3(cfg["her"])
	var hface := (her.global_basis.z).normalized()              # her front (a glTF character's +Z)
	await process_frame
	# the first game, as the player sees it
	await shot("street", a - ahead * 7.0 + Vector3(0, 1.1, 0), b + Vector3(0, 0.6, 0))
	var front: Node3D = null
	for d in bung.doors():
		if str(d.name) == "door_front_door":
			front = d
	if front != null:
		var fb := box_of(front)
		var n := front.global_basis.z.normalized()
		if n.dot(a - fb.get_center()) < 0:
			n = -n
		var floor_y := fb.position.y
		await shot("door", Vector3(fb.get_center().x, floor_y + 1.6, fb.get_center().z) + n * 2.2, Vector3(fb.get_center().x, floor_y + 1.15, fb.get_center().z))
	her.visible = true
	await shot("inside", hp + hface * 1.6 + Vector3(0, 1.55, 0), hp + Vector3(0, 1.25, 0))
	await shot("her", hp + hface * 0.85 + Vector3(0, 1.5, 0), hp + Vector3(0, 1.47, 0))
	for l in lamps:
		(l as Node3D).visible = false
	var torch := SpotLight3D.new()
	torch.light_energy = 3.0
	torch.spot_range = 14.0
	torch.spot_angle = 24.0
	torch.shadow_enabled = true
	torch.light_color = Color(1, 0.94, 0.84)
	cam.add_child(torch)
	torch.position = Vector3(0.18, -0.2, -0.1)
	await shot("scare", hp + hface * 1.6 + Vector3(0, 1.55, 0), hp + Vector3(0, 1.25, 0))
	torch.queue_free()
	for l in lamps:
		(l as Node3D).visible = true
	# the exports on their own, from above (godot_by_hand)
	var sun := DirectionalLight3D.new()
	sun.light_energy = 1.1
	sun.rotation = Vector3(deg_to_rad(-55), deg_to_rad(35), 0)
	main.add_child(sun)
	moon.visible = false
	street.visible = false
	her.visible = false
	for c in bung.find_children("*ceiling*", "", true, false):
		(c as Node3D).visible = false
	var bb := box_of(bung)
	await shot("interior_top", bb.get_center() + Vector3(-bb.size.x * 0.22, maxf(bb.size.x, bb.size.z) * 0.62, bb.size.z * 0.36), bb.get_center())
	for c in bung.find_children("*ceiling*", "", true, false):
		(c as Node3D).visible = true
	street.visible = true
	var sb := box_of(street)
	await shot("street_top", sb.get_center() + Vector3(-sb.size.x * 0.12, maxf(sb.size.x, sb.size.z) * 0.24, sb.size.z * 0.22), sb.get_center(), 30)
	street.visible = false
	bung.visible = false
	her.visible = true
	her.global_position = Vector3(0, -500, 0)                   # alone, under the sun, nothing round her
	var hb := box_of(her)
	cam.fov = 40.0
	await shot("character", hb.get_center() + her.global_basis.z.normalized() * 3.0 + Vector3(0, 0.1, 0), hb.get_center())
	quit()
