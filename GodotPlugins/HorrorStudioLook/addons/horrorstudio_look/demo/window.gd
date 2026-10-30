## The window sun in a room (LOOKPLUGIN's nodes part; docs/GODOT_LOOK.md §0): a wall with a window cut in it, the
## window_sun preset dropped into the opening as a user would (sized to it, the floor's height given), a dim room,
## pictured from inside (window_sun.png) and measured (window.json): the beam bright just inside the glass and dark
## just beside the opening (it starts at the window, not floating near it), its sides parallel (as wide a metre in as
## at the glass), landing on the floor where the light's patch is, and the beam's length the way to the floor.
##   godot --path PROJECT --fixed-fps 60 -s res://addons/horrorstudio_look/demo/window.gd -- --out=DIR
extends SceneTree

var out_dir := "res://"
var view := "room"                 # --view=side: from the side, the beam's whole run to the floor
var n := 0
var cam: Camera3D
var sun: HSLightShaft
var rep := {}
const WIN_W := 1.2
const WIN_H := 1.1
const SILL := 0.9                  # the opening's bottom above the floor
const WALL_Z := -3.0               # the window's wall (its room face), the room toward +Z


func box(parent: Node, size: Vector3, at: Vector3, col: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = 0.85
	bm.material = m
	mi.mesh = bm
	parent.add_child(mi)
	mi.position = at
	return mi


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		if a.begins_with("--view="):
			view = a.substr(7)
	var world := Node3D.new()
	root.add_child(world)
	var we := WorldEnvironment.new()
	we.environment = Environment.new()
	we.environment.background_mode = Environment.BG_COLOR
	we.environment.background_color = Color(0.55, 0.65, 0.8)
	we.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	we.environment.ambient_light_color = Color(0.5, 0.55, 0.65)
	we.environment.ambient_light_energy = 0.12
	HSLook.apply(root, we.environment, "realism")
	we.environment.volumetric_fog_enabled = false
	world.add_child(we)
	var wall_c := Color(0.55, 0.53, 0.5)
	var t := 0.2
	var room_w := 6.0
	var room_h := 2.6
	var wz := WALL_Z - t * 0.5
	box(world, Vector3(room_w, 0.1, 7.0), Vector3(0, -0.05, 0.5), Color(0.4, 0.34, 0.28))          # the floor
	box(world, Vector3((room_w - WIN_W) * 0.5, room_h, t), Vector3(-(WIN_W + (room_w - WIN_W) * 0.5) * 0.5, room_h * 0.5, wz), wall_c)   # the wall beside the window, left
	box(world, Vector3((room_w - WIN_W) * 0.5, room_h, t), Vector3((WIN_W + (room_w - WIN_W) * 0.5) * 0.5, room_h * 0.5, wz), wall_c)    # and right
	box(world, Vector3(WIN_W, SILL, t), Vector3(0, SILL * 0.5, wz), wall_c)                                                               # under the sill
	var top := SILL + WIN_H
	box(world, Vector3(WIN_W, room_h - top, t), Vector3(0, top + (room_h - top) * 0.5, wz), wall_c)                                       # over the head
	box(world, Vector3(t, room_h, 7.0), Vector3(-room_w * 0.5, room_h * 0.5, 0.5), wall_c)                                                 # the side walls
	box(world, Vector3(t, room_h, 7.0), Vector3(room_w * 0.5, room_h * 0.5, 0.5), wall_c)
	box(world, Vector3(room_w, 0.1, 7.0), Vector3(0, room_h + 0.05, 0.5), wall_c)                         # the ceiling
	cam = Camera3D.new()
	cam.position = Vector3(1.9, 1.6, 2.6) if view != "side" else Vector3(2.75, 1.5, 1.4)
	world.add_child(cam)
	cam.look_at(Vector3(-0.2, 0.9, WALL_Z + 1.2) if view != "side" else Vector3(-1.0, 0.8, -1.8), Vector3.UP)
	cam.fov = 70
	cam.current = true
	sun = (load("res://addons/horrorstudio_look/presets/window_sun.tscn") as PackedScene).instantiate()
	sun.width = WIN_W                                 # fitted to the opening, as the outline is in the editor
	sun.height = WIN_H
	sun.floor_y = 0.0
	sun.sun_side = 15.0
	world.add_child(sun)
	sun.position = Vector3(0, SILL + WIN_H * 0.5, WALL_Z - t * 0.5)   # the glass's middle, in the opening
	sun.rotation.y = PI                               # its forward (-Z) into the room, which lies toward +Z here


func px(p: Vector3) -> Vector2:
	return cam.unproject_position(p)


func lum(img: Image, p: Vector2, r := 3) -> float:
	var s := 0.0
	var k := 0
	for dx in range(-r, r + 1):
		for dy in range(-r, r + 1):
			var x := clampi(int(p.x) + dx, 0, img.get_width() - 1)
			var y := clampi(int(p.y) + dy, 0, img.get_height() - 1)
			var c := img.get_pixel(x, y)
			s += 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
			k += 1
	return s / k


var with_img: Image = null
var p_in: Vector3
var p_side: Vector3


func _process(_dt: float) -> bool:
	n += 1
	if n == 60:                                         # the picture, then the same frame without the beam: what the card adds
		with_img = root.get_texture().get_image()
		with_img.save_png(out_dir.path_join("window_sun.png" if view != "side" else "window_sun_side.png"))
		var d: Vector3 = sun.global_basis * sun.sun_dir()
		var c: Vector3 = sun.global_position
		p_in = c + d * 0.35                             # in the beam just inside the glass
		p_side = p_in + Vector3(WIN_W * 0.5 + 0.35, 0, 0)   # as far in, beside the opening: no beam there
		rep["length"] = sun.length
		rep["reach"] = sun.reach
		rep["lands_at_y"] = c.y + (d.y * sun.length)
		var b: Basis = sun.card.transform.basis
		rep["parallel"] = b.z.normalized().dot(-sun.sun_dir()) > 0.999 and b.x.is_equal_approx(Vector3.RIGHT) and b.y.is_equal_approx(Vector3.UP)
		var lamp: Node3D = sun.get_node("Sun")
		rep["light_aimed"] = (-lamp.global_basis.z).dot(d) > 0.999
		rep["light_outside"] = (lamp.global_position - c).dot(sun.global_basis.z) > 0.5
		sun.beam.visible = false
	elif n == 64:
		var without := root.get_texture().get_image()
		rep["beam_gain_in"] = lum(with_img, px(p_in)) - lum(without, px(p_in))
		rep["beam_gain_beside"] = lum(with_img, px(p_side)) - lum(without, px(p_side))
		var f := FileAccess.open(out_dir.path_join("window.json"), FileAccess.WRITE)
		f.store_string(JSON.stringify(rep, "  "))
		f.close()
		print("LOOKWINDOW " + JSON.stringify(rep))
		quit()
	return false
