## Does this renderer do global illumination? A closed room, one lamp, no ambient: the far wall's brightness with no
## GI, with SDFGI and with VoxelGI baked at run time. Prints GIPROBE lines (the lighting trial needs a real GPU when
## they're all the same).
extends SceneTree
var n := 0
var stage := 0
var env: Environment
var cam: Camera3D
var vals := {}
var world: Node3D

func box(size: Vector3, at: Vector3, col: Color) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	m.mesh = bm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col
	m.material_override = mat
	m.position = at
	m.gi_mode = GeometryInstance3D.GI_MODE_STATIC
	world.add_child(m)
	return m

func _initialize() -> void:
	world = Node3D.new()
	root.add_child(world)
	var we := WorldEnvironment.new()
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color.BLACK
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_energy = 0.0
	we.environment = env
	world.add_child(we)
	box(Vector3(6, 0.1, 6), Vector3(0, 0, 0), Color(0.7, 0.7, 0.7))
	box(Vector3(6, 0.1, 6), Vector3(0, 3, 0), Color(0.7, 0.7, 0.7))
	box(Vector3(0.1, 3, 6), Vector3(-3, 1.5, 0), Color(0.7, 0.3, 0.3))
	box(Vector3(0.1, 3, 6), Vector3(3, 1.5, 0), Color(0.3, 0.7, 0.3))
	box(Vector3(6, 3, 0.1), Vector3(0, 1.5, -3), Color(0.7, 0.7, 0.7))
	box(Vector3(6, 3, 0.1), Vector3(0, 1.5, 3), Color(0.7, 0.7, 0.7))
	var l := OmniLight3D.new()
	l.position = Vector3(0, 2.6, 1.5)
	l.light_energy = 3.0
	l.omni_range = 6.0
	l.shadow_enabled = true
	world.add_child(l)
	var b := box(Vector3(1, 1, 1), Vector3(0, 0.55, 0.5), Color(0.6, 0.6, 0.6))   # a block in the middle: its shadowed side only GI can light
	cam = Camera3D.new()
	cam.position = Vector3(0, 1.4, 2.8)
	cam.look_at(Vector3(0, 0.8, -1), Vector3.UP)
	world.add_child(cam)
	cam.current = true
	print("GIPROBE gi_mode default ", MeshInstance3D.new().gi_mode)

func measure(label: String) -> void:
	var img := root.get_texture().get_image()
	var w := img.get_width()
	var h := img.get_height()
	var sum := 0.0
	var k := 0
	for y in range(int(h * 0.75), int(h * 0.95), 4):          # the floor's shadowed stretch before the block
		for x in range(int(w * 0.35), int(w * 0.65), 4):
			sum += img.get_pixel(x, y).get_luminance()
			k += 1
	var far := 0.0
	var kf := 0
	for y in range(int(h * 0.3), int(h * 0.5), 4):            # the far wall
		for x in range(int(w * 0.1), int(w * 0.3), 4):
			far += img.get_pixel(x, y).get_luminance()
			kf += 1
	print("GIPROBE %s floor %.4f farwall %.4f" % [label, sum / k, far / kf])

func _process(_d: float) -> bool:
	n += 1
	if n == 20:
		measure("direct")
		env.sdfgi_enabled = true
	elif n == 60:
		measure("sdfgi")
		env.sdfgi_enabled = false
		var vg := VoxelGI.new()
		vg.size = Vector3(7, 4, 7)
		vg.position = Vector3(0, 1.5, 0)
		world.add_child(vg)
		vg.bake(world)
	elif n == 90:
		measure("voxelgi")
		quit()
	return false
