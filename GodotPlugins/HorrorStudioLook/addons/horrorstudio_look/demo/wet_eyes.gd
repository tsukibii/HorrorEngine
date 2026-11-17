## Wet eyes and tall catchlights (docs/GODOT_LOOK.md §5ab, DECISIONS 2026-11-17, cuter eyes; tools/godot/wet_eyes_check.py
## runs it: WETEYES). A dark stage, a lamp, four made-up eyeballs at an eye's own size on the Studio's eye shader (the
## front of a ball in the eye's layout, a painted iris and pupil): a dry one and a wet one, each with a tear line as an
## export carries it (three rows along a lower lid's arc, the fade in the vertices' colour; the wet one's pooled into
## its corners as the Studio builds it), and two with catchlights that stay, round and tall. Pictured without the tear
## lines, with them, with the lamp out, and after the dry eye is made wet in the game (HSEye.set_wet); each tear line
## measured as the light it adds to the picture (all of it, its middle, its corners, how uneven it is), each catchlight
## as the bright spot's width and height over the iris. HSEyePaint's Wet eyes counted (no picture).
##   godot --path PROJECT --rendering-driver vulkan --fixed-fps 60 -s res://addons/horrorstudio_look/demo/wet_eyes.gd -- --out=DIR
extends SceneTree

var out_dir := "res://"
var report := {"shots": {}}
var world: Node3D
var env: Environment
var cam: Camera3D
var key: DirectionalLight3D
var eyes: Array = []              # [{name, holder, mi, tear}]
var stages: Array = ["bare", "lit", "dark", "set"]
var stage := 0
var n := 0
var bare: Image = null
const R := 0.012                  # an eyeball's radius
const NAMES := ["dry", "wet", "round", "tall"]


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
	root.size = Vector2i(1280, 720)
	world = Node3D.new()
	root.add_child(world)
	env = Environment.new()
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	HSLook.apply(root, env, "balanced")
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.012, 0.013, 0.016)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.55, 0.65)
	env.ambient_light_energy = 0.05
	env.volumetric_fog_enabled = false
	env.fog_enabled = false
	env.glow_enabled = false                             # (the glints measured as they're drawn, before the lens's bloom)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL      # every eyeball seen square on, the same
	cam.size = 0.075
	cam.near = 0.01
	world.add_child(cam)
	cam.current = true
	cam.look_at_from_position(Vector3(0, 0, 0.5), Vector3.ZERO)
	key = DirectionalLight3D.new()                       # (a sun: every eyeball lit alike)
	key.light_color = Color(1.0, 0.95, 0.88)
	world.add_child(key)
	key.look_at_from_position(Vector3(-0.3, 0.42, 0.5), Vector3.ZERO)
	var paint := eye_paint()
	var mesh := eye_mesh()
	for i in NAMES.size():
		var name: String = NAMES[i]
		var holder := Node3D.new()
		holder.name = "E_" + name
		world.add_child(holder)
		holder.position = Vector3((i - 1.5) * 0.03, 0, 0)
		var mi := MeshInstance3D.new()
		mi.name = "e_%s_eye_L" % name
		mi.mesh = mesh
		var rec := {"side": "L", "shape": {}, "paint": {"gloss": 0.9, "wet": 1.0 if name == "wet" else 0.0}}
		if name == "round" or name == "tall":
			rec["paint"] = {"gloss": 0.9, "catchKeep": 1.0, "catch1": 1.0, "catch2": 0.0, "catchSize": 0.14, "catchX": 0.0, "catchY": 0.25, "catchRoom": 0.0,
					"catchTall": 3.0 if name == "tall" else 1.0}
		mi.set_surface_override_material(0, eye_material(rec, paint))
		holder.add_child(mi)
		var tear: MeshInstance3D = null
		if name == "dry" or name == "wet":
			tear = MeshInstance3D.new()
			tear.name = "tearline_L"
			tear.mesh = tear_mesh(name == "wet")
			tear.set_surface_override_material(0, HSEye.tear_material({"strength": 0.48 if name == "wet" else 0.4, "wet": 1.0 if name == "wet" else 0.0}))
			tear.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			holder.add_child(tear)
		eyes.append({"name": name, "holder": holder, "mi": mi, "tear": tear})
	counted()
	print("WETEYES stages ", stages)


## the eye shader on a made-up eyeball from a record (as an export's: HSEye.apply leaves it in the material's meta), the
## lids' shadow and the socket off (a bare ball)
func eye_material(rec: Dictionary, paint: Texture2D) -> ShaderMaterial:
	var m := HSEye.material(rec, paint)
	HSEye.apply(m, rec, false, {"occlusion": 0.0, "socket": 0.0, "lid_room": 0.0, "mesh_shape": Vector3(0.5, 0.0, 1.0)})   # (the ball has no dome of its own)
	return m


## a made-up eye's paint in the eye's flat layout: the white, an iris of blue-grey streaks to half the radius, a pupil
func eye_paint() -> ImageTexture:
	var img := Image.create(256, 256, false, Image.FORMAT_RGB8)
	for y in 256:
		for x in 256:
			var p := Vector2((x + 0.5) / 128.0 - 1.0, (y + 0.5) / 128.0 - 1.0)
			var r := p.length()
			var c := Color(0.9, 0.88, 0.86)
			if r < 0.16:
				c = Color(0.004, 0.004, 0.004)
			elif r < 0.5:
				var k := 0.5 + 0.5 * sin(p.angle() * 40.0)
				c = Color(0.1, 0.18, 0.28).lerp(Color(0.16, 0.25, 0.33), k * 0.6)
				if r > 0.475:
					c = c.darkened(0.6)
			img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)


## the front of an eyeball as an export carries it (demo/eyes.gd's, at an eye's own size)
func eye_mesh() -> ArrayMesh:
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	var tans := PackedFloat32Array()
	var uvs := PackedVector2Array()
	var idx := PackedInt32Array()
	var rings := 28
	var segs := 64
	for i in rings + 1:
		var r := sin(float(i) / rings * PI * 0.5 * 0.99)
		for j in segs:
			var a := TAU * j / segs
			var e := Vector3(r * cos(a), r * sin(a), sqrt(maxf(1.0 - r * r, 0.0)))   # in the eye's frame
			var t := Vector3(1.0 - e.x * e.x, -e.x * e.y, -e.x * e.z).normalized()
			verts.append(Vector3(e.x, -e.y, e.z) * R)
			norms.append(Vector3(e.x, -e.y, e.z))
			tans.append_array([t.x, -t.y, t.z, 1.0])
			uvs.append(Vector2(0.5 + 0.5 * e.x, 0.5 - 0.5 * e.y))
	for i in rings:
		for j in segs:
			var a := i * segs + j
			var b := i * segs + (j + 1) % segs
			var c := (i + 1) * segs + j
			var d := (i + 1) * segs + (j + 1) % segs
			for tri in [[a, b, c], [b, d, c]]:
				var face := (verts[tri[1]] - verts[tri[0]]).cross(verts[tri[2]] - verts[tri[0]])
				if face.dot(norms[tri[0]] + norms[tri[1]] + norms[tri[2]]) > 0.0:      # Godot's front faces wind clockwise
					idx.append_array([tri[0], tri[2], tri[1]])
				else:
					idx.append_array(tri)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = norms
	arr[Mesh.ARRAY_TANGENT] = tans
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return m


## a point on the eyeball's front by its angle along the lid (a) and its height (e), `off` over the eyeball
func on_eye(a: float, e: float, off: float) -> Vector3:
	return Vector3(cos(e) * sin(a), sin(e), cos(e) * cos(a)) * (R + off)


## a tear line as the Studio builds and exports one (index.html tearLine): 17 points along a lower lid's arc, three rows
## (onto the eye, the meniscus raised, the lid's rim), the fade in the middle row's colour; wet, wider and pooled into
## the corners (the first point the outer corner)
func tear_mesh(wet: bool) -> ArrayMesh:
	var verts := PackedVector3Array()
	var cols := PackedColorArray()
	var idx := PackedInt32Array()
	var w := 1.0 if wet else 0.0
	for i in 17:
		var s := sin(PI * i / 16.0)
		var pool := w * (0.9 * exp(-pow(i - 1.2, 2.0) / 2.0) + 0.55 * exp(-pow(i - 14.8, 2.0) / 2.0))
		var t := sqrt(s) * (1.0 + 0.35 * w) + 2.4 * pool
		var a := deg_to_rad(lerpf(50.0, -50.0, i / 16.0))
		var e0 := deg_to_rad(-24.0)
		var even := 1.0 - 0.55 * w * (0.5 + 0.5 * sin(i * 2.4 + 1.3))
		var fade := maxf(pow(s, 1.5) * even, minf(1.0, 1.15 * pool))
		verts.append(on_eye(a, e0 + t * 0.0375, 0.0002))
		verts.append(on_eye(a, e0 + t * 0.0083, 0.0002 + 0.00025 * minf(1.3, t)))
		verts.append(on_eye(a, e0 - t * 0.0167, 0.0002))
		cols.append_array([Color(0, 0, 0), Color(fade * (1.0 - 0.5 * minf(1.0, 1.15 * pool)), fade, fade), Color(0, 0, 0)])   # (the pool: the red under the green, as the export writes it)
	for i in 16:
		var a := i * 3
		idx.append_array([a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4])
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for k in verts.size():
		st.set_color(cols[k])
		st.set_normal(verts[k].normalized())
		st.add_vertex(verts[k])
	for k in idx:
		st.add_index(k)
	return st.commit()


## what needs no picture: Wet eyes set in the game on a pair of eyes with tear lines, by HSEye.set_wet and by HSEyePaint
func counted() -> void:
	var rep := {}
	var pair := Node3D.new()
	pair.name = "Pair"
	world.add_child(pair)
	pair.position = Vector3(0, 0, 50)
	var paint := eye_paint()
	var mesh := eye_mesh()
	for side in ["L", "R"]:
		var mi := MeshInstance3D.new()
		mi.name = "pair_eye_" + side
		mi.mesh = mesh
		mi.set_surface_override_material(0, eye_material({"side": side, "shape": {}, "paint": {"gloss": 0.8}}, paint))
		pair.add_child(mi)
		var tear := MeshInstance3D.new()
		tear.name = "tearline_" + side
		tear.mesh = tear_mesh(false)
		tear.set_surface_override_material(0, HSEye.tear_material({"strength": 0.4}))
		pair.add_child(tear)
	var l: ShaderMaterial = pair.get_node("pair_eye_L").get_surface_override_material(0)
	var tl: ShaderMaterial = pair.get_node("tearline_L").get_surface_override_material(0)
	var tr: ShaderMaterial = pair.get_node("tearline_R").get_surface_override_material(0)
	rep["tears_found"] = HSEye.tears(pair).size()
	rep["dry"] = [float(l.get_shader_parameter("wet")), float(tl.get_shader_parameter("wet")), float(l.get_shader_parameter("roughness"))]
	HSEye.set_wet(pair, 1.0)
	rep["set_wet"] = [float(l.get_shader_parameter("wet")), float(tl.get_shader_parameter("wet")), float(tr.get_shader_parameter("wet")), float(l.get_shader_parameter("roughness"))]
	HSEye.set_wet(pair, 0.0)                             # dry again: what her painter takes as her own
	var painter := HSEyePaint.attach(pair)
	rep["painter"] = painter != null
	if painter != null:
		rep["painter_reads"] = float(painter.paint("L").get("wet", -1.0))
		HSEye.set_wet(pair, 0.5)                           # (with a painter under her, through it)
		rep["half"] = [float(l.get_shader_parameter("wet")), float(tl.get_shader_parameter("wet")), float(tr.get_shader_parameter("wet"))]
		painter.set_paint({"catchTall": 2.5})
		rep["tall"] = float(l.get_shader_parameter("kept_tall"))
		painter.reset()
		rep["reset"] = [float(l.get_shader_parameter("wet")), float(tl.get_shader_parameter("wet"))]
	report["counted"] = rep
	pair.visible = false


func lum(p: Color) -> float:
	return p.r * 0.3 + p.g * 0.59 + p.b * 0.11


## where a mesh's points land in the picture: their box, grown by a few pixels
func box_of(mi: MeshInstance3D, grow: int = 3) -> Rect2i:
	var pts: PackedVector3Array = mi.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
	var lo := Vector2(1e9, 1e9)
	var hi := Vector2(-1e9, -1e9)
	for p in pts:
		var q := cam.unproject_position(mi.global_transform * p)
		lo = lo.min(q)
		hi = hi.max(q)
	return Rect2i(int(lo.x) - grow, int(lo.y) - grow, int(hi.x - lo.x) + 2 * grow, int(hi.y - lo.y) + 2 * grow)


## a tear line's light in a picture against the picture without it: all it adds, in its middle and in its two end
## fifths (the corners), how uneven it is along the middle (the glints), its brightest point
func tear_light(img: Image, e: Dictionary) -> Dictionary:
	var b := box_of(e["tear"])
	var total := 0.0
	var mid := 0.0
	var ends := 0.0
	var top := 0.0
	var cols: Array = []
	for x in range(b.position.x, b.end.x):
		var col := 0.0
		for y in range(b.position.y, b.end.y):
			var d := maxf(0.0, lum(img.get_pixel(x, y)) - (lum(bare.get_pixel(x, y)) if bare != null else 0.0))
			col += d
			top = maxf(top, lum(img.get_pixel(x, y)))
		total += col
		var u := float(x - b.position.x) / maxf(1.0, b.size.x - 1.0)
		if u < 0.2 or u > 0.8:
			ends += col
		elif u > 0.3 and u < 0.7:
			mid += col
			cols.append(col)
	var mean := 0.0
	for c in cols:
		mean += c / maxf(1.0, cols.size())
	var dev := 0.0
	for c in cols:
		dev += pow(c - mean, 2.0) / maxf(1.0, cols.size())
	return {"added": total, "middle": mid, "corners": ends, "uneven": sqrt(dev) / maxf(mean, 1e-6), "brightest": top, "box": [b.position.x, b.position.y, b.size.x, b.size.y]}


## an eyeball measured: its white's brightest point (a lamp's glint on it), and the bright spot over its iris as a box
## (a catchlight that stays): its width and height in pixels
func eye_light(img: Image, e: Dictionary) -> Dictionary:
	var mi: MeshInstance3D = e["mi"]
	var c := cam.unproject_position(mi.global_position + Vector3(0, 0, R))
	var r := c.distance_to(cam.unproject_position(mi.global_position + Vector3(0, 0, R) + cam.global_basis.x * R))
	var glint := 0.0
	var white := 0.0
	var wn := 0
	var lo := Vector2i(100000, 100000)
	var hi := Vector2i(-1, -1)
	var spot := 0
	for y in range(int(c.y - r), int(c.y + r) + 1):
		for x in range(int(c.x - r), int(c.x + r) + 1):
			var d := Vector2(x, y).distance_to(c) / r
			if d > 0.92:
				continue
			var p := img.get_pixel(x, y)
			if d > 0.6 and y < c.y - 0.1 * r:               # the white, above the tear line
				glint = maxf(glint, lum(p))
				white += lum(p)
				wn += 1
			elif d < 0.47 and lum(p) > 0.75 and minf(p.r, minf(p.g, p.b)) > 0.6:
				lo = lo.min(Vector2i(x, y))
				hi = hi.max(Vector2i(x, y))
				spot += 1
	return {"white_glint": glint, "white": white / maxf(1.0, wn), "spot": spot, "spot_w": maxi(0, hi.x - lo.x + 1), "spot_h": maxi(0, hi.y - lo.y + 1)}


func setup(name: String) -> void:
	key.light_energy = 0.0 if name == "dark" else 1.6
	env.ambient_light_energy = 0.0 if name == "dark" else 0.05
	for e in eyes:
		if e["tear"] != null:
			e["tear"].visible = name != "bare"
	if name == "set":                                    # the dry eye made wet in the game
		HSEye.set_wet(eyes[0]["holder"], 1.0)


func _process(_d: float) -> bool:
	n += 1
	if n == 1:
		setup(stages[stage])
	if n < 24:                                           # TAA settles
		return false
	var name: String = stages[stage]
	var img := root.get_texture().get_image()
	if img.save_png(out_dir.path_join("wet_%s.png" % name)) != OK:
		print("WETEYES FAIL: can't write into " + out_dir)
		quit(1)
		return true
	if name == "bare":
		bare = img
	var row := {}
	for e in eyes:
		var m := eye_light(img, e)
		if e["tear"] != null and name != "bare":
			m["tear"] = tear_light(img, e)
		row[e["name"]] = m
	report["shots"][name] = row
	stage += 1
	n = 0
	if stage >= stages.size():
		var f := FileAccess.open(out_dir.path_join("wet_eyes.json"), FileAccess.WRITE)
		if f != null:
			f.store_string(JSON.stringify(report, "  "))
			f.close()
		print("WETEYES {done}")
		return true
	return false
