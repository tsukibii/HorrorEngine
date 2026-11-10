## The muzzle flash taken apart for the weapons guide (tools/godot/weapons_check.py --pictures): `flash_parts`, four
## panels in the dark under the game's look: the buckshot flash's spheres bare (lit, half see-through: the wings as runs
## of elongated spheres that intersect, the plume, the core), the same flash burnt (the user's way: fronts culled, the
## noise burnt by the facing), the star it makes seen from in front, and the explosive shell's flash.
##   godot --path PROJECT --rendering-driver vulkan --fixed-fps 60 -s muzzle_shots.gd -- --out=DIR
extends SceneTree

const W := 800
const H := 450
var out := ""


func frames(n: int) -> void:
	for i in n:
		await process_frame


func grab() -> Image:
	await RenderingServer.frame_post_draw
	var im := root.get_texture().get_image()
	im.convert(Image.FORMAT_RGB8)
	im.resize(W, H, Image.INTERPOLATE_LANCZOS)
	return im


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	root.size = Vector2i(1600, 900)
	var w := Node3D.new()
	root.add_child(w)
	var env := WorldEnvironment.new()
	env.set_script(load("res://addons/horrorstudio_look/look_env.gd"))
	env.set("preset", "balanced")
	env.set("editor_only", false)
	w.add_child(env)
	await frames(2)
	if env.environment != null:
		env.environment.background_mode = Environment.BG_COLOR
		env.environment.background_color = Color(0.012, 0.012, 0.016)
		env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.environment.ambient_light_color = Color(0.05, 0.05, 0.06)
	var key := DirectionalLight3D.new()                    # (lights the bare spheres; the fire is its own light)
	key.rotation_degrees = Vector3(-40, 30, 0)
	key.light_energy = 1.2
	w.add_child(key)
	var barrel := MeshInstance3D.new()                     # a barrel stub along +X, its muzzle at the origin
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0115
	cm.bottom_radius = 0.0115
	cm.height = 0.5
	barrel.mesh = cm
	var bm := StandardMaterial3D.new()
	bm.albedo_color = Color(0.08, 0.08, 0.09)
	bm.metallic = 0.8
	bm.roughness = 0.35
	barrel.material_override = bm
	w.add_child(barrel)
	barrel.rotation_degrees = Vector3(0, 0, 90)
	barrel.position = Vector3(-0.25, 0, 0)
	var mz := HSMuzzle.new()
	mz.smoke = false
	mz.light_energy = 0.0
	w.add_child(mz)
	mz.basis = Basis(Vector3.UP, deg_to_rad(-90.0))       # its -Z along +X
	var side := Camera3D.new()
	side.fov = 40.0
	w.add_child(side)
	side.look_at_from_position(Vector3(0.2, 0.06, 0.95), Vector3(0.2, 0, 0))
	var front := Camera3D.new()
	front.fov = 40.0
	w.add_child(front)
	front.look_at_from_position(Vector3(0.95, 0.03, 0.0), Vector3(0, 0, 0))
	await frames(4)
	var buck = load("res://addons/horrorstudio_weapons/muzzle/buckshot.tres")
	var ex = load("res://addons/horrorstudio_weapons/muzzle/explosive.tres")
	var panels: Array[Image] = []
	# 1. the spheres bare: the flash's own layout drawn lit and half see-through
	side.make_current()
	mz.get("_rng").seed = 7
	mz.fire(buck)
	var bare := StandardMaterial3D.new()
	bare.albedo_color = Color(0.95, 0.62, 0.3, 0.42)
	bare.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bare.cull_mode = BaseMaterial3D.CULL_DISABLED
	bare.roughness = 0.6
	var fire_mat: Material = mz.wings.material_override
	mz.wings.material_override = bare
	mz.set("_age", 0.0)
	mz.set("look", null)                                   # (frozen: nothing ages it)
	await frames(3)
	panels.append(await grab())
	# 2. the same spheres burnt: the flash as it's drawn
	mz.wings.material_override = fire_mat
	(fire_mat as ShaderMaterial).set_shader_parameter("age", 0.0)
	await frames(2)
	panels.append(await grab())
	# 3. seen from in front: the star
	front.make_current()
	await frames(2)
	panels.append(await grab())
	# 4. the explosive shell's flash, from the side
	side.make_current()
	mz.get("_rng").seed = 7
	mz.fire(ex)
	mz.set("look", null)
	(mz.wings.material_override as ShaderMaterial).set_shader_parameter("age", 0.0)
	await frames(2)
	panels.append(await grab())
	var sheet := Image.create(W * 2, H * 2, false, Image.FORMAT_RGB8)
	for i in panels.size():
		sheet.blit_rect(panels[i], Rect2i(0, 0, W, H), Vector2i((i % 2) * W, (i / 2) * H))
	sheet.save_png(out.path_join("flash_parts.png"))
	print("SHOT flash_parts")
	quit()
