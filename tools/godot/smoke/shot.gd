extends SceneTree
var n := 0
func _init():
	var root3d := Node3D.new()
	var env := WorldEnvironment.new(); var e := Environment.new()
	e.background_mode = Environment.BG_COLOR; e.background_color = Color(0.02,0.03,0.05)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; e.ambient_light_color = Color(0.1,0.1,0.15)
	env.environment = e; root3d.add_child(env)
	var floor := MeshInstance3D.new(); floor.mesh = PlaneMesh.new(); floor.mesh.size = Vector2(6,6)
	var mat := StandardMaterial3D.new(); mat.albedo_color = Color(0.5,0.45,0.4); floor.material_override = mat; root3d.add_child(floor)
	var box := MeshInstance3D.new(); box.mesh = BoxMesh.new(); box.position = Vector3(0,0.5,0); root3d.add_child(box)
	var light := OmniLight3D.new(); light.position = Vector3(1.5,2.5,1.5); light.light_energy = 4; light.light_color = Color(1,0.8,0.6); light.shadow_enabled = true; root3d.add_child(light)
	var cam := Camera3D.new(); cam.position = Vector3(2.5,1.65,3); cam.look_at(Vector3(0,0.5,0)); cam.fov = 90; root3d.add_child(cam)
	root.add_child(root3d)
	get_root().size = Vector2i(640,360)
func _process(_d):
	n += 1
	if n == 8:
		var img := get_root().get_texture().get_image()
		img.save_png("res://shot.png")
		print("GDSHOT ", img.get_width(), "x", img.get_height(), " mean=", _mean(img))
		quit()
	return false
func _mean(img: Image) -> float:
	var s := 0.0; var c := 0
	for y in range(0, img.get_height(), 8):
		for x in range(0, img.get_width(), 8):
			s += img.get_pixel(x,y).get_luminance(); c += 1
	return s / c
