## Creepy eyes (HSEyeFx, docs/GODOT_LOOK.md §5q; tools/godot/eye_fx_check.py runs it: EYEFX). A dark stage, a lamp,
## fourteen made-up eyeballs the size of a fist on the Studio's eye shader (the front of a ball in the eye's own
## layout, a painted iris and pupil): one plain, one for each look. Pictured lit, a third of a second later (what
## turns and throbs), with the lamp out (what glows), at half the look with the lamp out, with every look's colour
## changed to green, and with the looks taken off; each eye measured where it lands (its iris, its pupil, its white;
## a look's mark as a shape; a spiral's arms round a circle). A pair of eyes for one side alone and a plain ball named
## eye for the stand-in version, counted. Then, given a Studio export (`--glb=`), each look on her face through the
## HSCharacterLook node's Creepy eyes row, lit and with the lamp out, pictured and its glow counted.
##   godot --path PROJECT --rendering-driver vulkan --fixed-fps 60 -s res://addons/horrorstudio_look/demo/eyes.gd -- --out=DIR [--glb=FILE]
extends SceneTree

var out_dir := "res://"
var glb := ""
var looks: Array = []
var report := {"shots": {}}
var world: Node3D
var env: Environment
var cam: Camera3D
var key: DirectionalLight3D
var eyes: Array = []              # [{name, holder, mi}]
var who: Node3D = null
var look_node: HSCharacterLook = null
var stages: Array = []
var stage := 0
var n := 0
const R := 0.2
const GREEN := Color(0.1, 1.0, 0.25)


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.substr(6)
		elif a.begins_with("--glb="):
			glb = a.substr(6)
	looks = Array(HSEyeFx.names())
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
	cam = Camera3D.new()
	cam.fov = 20.0
	world.add_child(cam)
	cam.current = true
	key = DirectionalLight3D.new()                       # (a sun: every eyeball lit alike, wherever it stands)
	key.light_color = Color(1.0, 0.95, 0.88)
	world.add_child(key)
	var paint := eye_paint()
	var mesh := eye_mesh()
	var names: Array = ["plain"] + looks
	var cols := int(ceil(names.size() / 2.0))
	for i in names.size():
		var holder := Node3D.new()
		holder.name = "E_%s" % names[i]
		world.add_child(holder)
		holder.position = Vector3((i % cols - (cols - 1) / 2.0) * 0.5, 1.27 if i < cols else 0.73, 0)
		var mi := MeshInstance3D.new()
		mi.name = "e_%s_eye_L" % names[i]
		mi.mesh = mesh
		mi.set_surface_override_material(0, eye_material(paint))
		holder.add_child(mi)
		eyes.append({"name": names[i], "holder": holder, "mi": mi})
	counted(mesh, paint)
	stages = ["lit", "later", "close", "dark", "half", "green", "none"]
	if glb != "":
		load_who()
		if who != null:
			stages.append("who:none")
			for l in looks:
				stages.append("who:" + str(l))
			stages.append("who:off")
	print("EYES stages ", stages)


## the eye shader on a made-up eyeball: the shape's defaults, the lids' shadow and the socket off (a bare ball)
func eye_material(paint: Texture2D) -> ShaderMaterial:
	var m := HSEye.material({}, paint)
	m.set_shader_parameter("occlusion", 0.0)
	m.set_shader_parameter("socket", 0.0)
	m.set_shader_parameter("lid_room", 0.0)
	m.set_shader_parameter("fx_pupil", 0.32)             # the made-up paint's pupil: 0.16 of an iris of 0.5
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
				c = Color(0.2, 0.36, 0.55).lerp(Color(0.32, 0.5, 0.66), k * 0.6)
				if r > 0.475:
					c = c.darkened(0.6)
			img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)


## the front of an eyeball as an export carries it: the layout's x and y (its +y down the eye) as the UVs, the tangent
## along the eye's +x in the surface (eye.gdshader's eT), the binormal the layout's +y
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


## what needs no picture: one side alone, a look taking another's place, the looks off, the stand-in version
func counted(mesh: Mesh, paint: Texture2D) -> void:
	var rep := {}
	var pair := Node3D.new()
	pair.name = "Pair"
	world.add_child(pair)
	pair.position = Vector3(0, 0, 50)
	for side in ["L", "R"]:
		var mi := MeshInstance3D.new()
		mi.name = "pair_eye_" + side
		mi.mesh = mesh
		mi.set_surface_override_material(0, eye_material(paint))
		pair.add_child(mi)
	rep["eyes_found"] = HSEyeFx.eyes(pair).size()
	rep["one_side"] = HSEyeFx.wear(pair, "black", {"side": "L"}).size()
	var l: ShaderMaterial = pair.get_node("pair_eye_L").get_surface_override_material(0)
	var r: ShaderMaterial = pair.get_node("pair_eye_R").get_surface_override_material(0)
	rep["side_numbers"] = [float(l.get_shader_parameter("fx_black")), float(r.get_shader_parameter("fx_black")) if r.get_shader_parameter("fx_black") != null else 0.0]
	HSEyeFx.wear(pair, "glow", {"color": GREEN})         # another look: the first one's numbers gone
	var gc: Color = l.get_shader_parameter("fx_glow_color")
	rep["replaced"] = [float(l.get_shader_parameter("fx_black")), float(l.get_shader_parameter("fx_glow")), gc.g > gc.r]
	HSEyeFx.set_amount(pair, 0.25)
	rep["amount"] = float(r.get_shader_parameter("fx_amount"))
	HSEyeFx.set_color(pair, Color(0, 0, 1))
	rep["recoloured"] = (r.get_shader_parameter("fx_glow_color") as Color).b > 0.9
	rep["cleared"] = HSEyeFx.clear(pair)
	rep["left"] = HSEyeFx.worn(pair).size()
	rep["after_clear"] = [float(l.get_shader_parameter("fx_glow")), float(l.get_shader_parameter("fx_amount"))]
	var doll := Node3D.new()                            # a stand-in: a plain ball named eye
	doll.name = "Doll"
	world.add_child(doll)
	doll.position = Vector3(0, 0, 60)
	var ball := MeshInstance3D.new()
	ball.name = "doll_eye"
	var sm := SphereMesh.new()
	sm.radius = 0.02
	sm.height = 0.04
	var own := StandardMaterial3D.new()
	own.albedo_color = Color(0.9, 0.9, 0.9)
	sm.material = own
	ball.mesh = sm
	doll.add_child(ball)
	var got: Array = HSEyeFx.wear(doll, "glow", {"color": GREEN})
	var g0: StandardMaterial3D = got[0] if got.size() == 1 else null
	rep["plain_glow"] = g0 != null and g0.emission_enabled and g0.emission.g > 0.9 and g0.emission_energy_multiplier > 1.0
	rep["plain_hearts"] = HSEyeFx.wear(doll, "hearts").size()     # (a look the stand-in has no version of: nothing new)
	HSEyeFx.clear(doll)
	rep["plain_back"] = ball.get_surface_override_material(0) == null
	report["counted"] = rep
	pair.visible = false
	doll.visible = false


func load_who() -> void:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(glb, st) != OK:
		return
	who = doc.generate_scene(st) as Node3D
	if who == null:
		return
	world.add_child(who)
	who.position = Vector3(0, 0.0, 40.0)
	look_node = HSCharacterLook.new()
	look_node.glb_path = glb
	who.add_child(look_node)
	var hint := ""
	for pr in look_node.get_property_list():
		if pr["name"] == "eye_fx":
			hint = str(pr["hint_string"])
	report["who"] = {"node_looks": hint, "looks": ",".join(HSEyeFx.names()), "glow": {}, "worn": {}}


## where an eye lands in the picture: its middle and its radius, in pixels
func disc(mi: MeshInstance3D) -> Array:
	var c := cam.unproject_position(mi.global_position + Vector3(0, 0, R))
	var e := cam.unproject_position(mi.global_position + Vector3(0, 0, R) + cam.global_basis.x * R)
	return [c, c.distance_to(e)]


func lum(p: Color) -> float:
	return p.r * 0.3 + p.g * 0.59 + p.b * 0.11


## is this pixel a look's mark (by the look: the hearts' pink, the star's yellow, a slit's or a cross's black)
func is_mark(look: String, p: Color) -> bool:
	match look:
		"hearts":
			return (p.h > 0.84 or p.h < 0.02) and p.s > 0.15 and p.v > 0.3
		"star":
			return p.h > 0.07 and p.h < 0.2 and p.s > 0.25 and p.v > 0.4
		"slit", "cross":
			return lum(p) < 0.05
	return false


## an eye measured: its iris (a ring clear of the pupil), its pupil, its white; how much of the iris's disc is dark; the
## look's mark as a shape; the colours round a circle through the iris (a spiral's arms)
func measure(img: Image, e: Dictionary) -> Dictionary:
	var d := disc(e["mi"])
	var c: Vector2 = d[0]
	var r: float = d[1]
	var iris := Vector3.ZERO
	var irisn := 0
	var white := Vector3.ZERO
	var whiten := 0
	var pupil := 0.0
	var pupiln := 0
	var darkpx := 0
	var inpx := 0
	var mx := 0.0
	var all := Vector3.ZERO
	var alln := 0
	var marks: Array = []
	for y in range(int(c.y - r), int(c.y + r) + 1):
		for x in range(int(c.x - r), int(c.x + r) + 1):
			var q := Vector2(x + 0.5, y + 0.5).distance_to(c) / r
			if q > 0.93 or x < 0 or y < 0 or x >= img.get_width() or y >= img.get_height():
				continue
			var p := img.get_pixel(x, y)
			var l := lum(p)
			mx = maxf(mx, l)
			all += Vector3(p.r, p.g, p.b)
			alln += 1
			if q < 0.06:
				pupil += l
				pupiln += 1
			if q > 0.26 and q < 0.42:
				iris += Vector3(p.r, p.g, p.b)
				irisn += 1
			if q > 0.64 and q < 0.9:
				white += Vector3(p.r, p.g, p.b)
				whiten += 1
			if q < 0.44:
				inpx += 1
				if l < 0.05:
					darkpx += 1
				if q < (0.4 if e["name"] == "slit" or e["name"] == "cross" else 0.44) and is_mark(e["name"], p):
					marks.append(Vector2i(x, y))
	iris /= maxf(irisn, 1)
	white /= maxf(whiten, 1)
	all /= maxf(alln, 1)
	var ic := Color(iris.x, iris.y, iris.z)
	var wc := Color(white.x, white.y, white.z)
	var out := {"iris": [iris.x, iris.y, iris.z], "iris_lum": lum(ic), "iris_hue": ic.h, "iris_sat": ic.s, "white": [white.x, white.y, white.z], "white_lum": lum(wc), "white_sat": wc.s,
		"pupil": pupil / maxf(pupiln, 1), "dark": float(darkpx) / maxf(inpx, 1), "max": mx, "all": [all.x, all.y, all.z], "marks": marks.size()}
	# a spiral: the colours round a circle through the iris, how many times they change
	var ring := ""
	for k in 180:
		var a := TAU * k / 180.0
		var p := img.get_pixel(int(c.x + cos(a) * r * 0.3), int(c.y + sin(a) * r * 0.3))
		ring += "1" if (p.r > 0.3 and p.r > 2.0 * p.g) else "0"
	ring = steady(ring)
	var changes := 0
	for k in 180:
		if ring[k] != ring[(k + 1) % 180]:
			changes += 1
	out["ring"] = ring
	out["ring_changes"] = changes
	# a mark's shape: its box, how full, its top and bottom rows, its middle
	if marks.size() > 12:
		var x0 := 99999
		var x1 := -1
		var y0 := 99999
		var y1 := -1
		var have := {}
		for m in marks:
			x0 = mini(x0, m.x)
			x1 = maxi(x1, m.x)
			y0 = mini(y0, m.y)
			y1 = maxi(y1, m.y)
			have[m] = true
		var w := x1 - x0 + 1
		var h := y1 - y0 + 1
		var cx := (x0 + x1) / 2
		var widths: Array = []
		for y in range(y0, y1 + 1):
			var cnt := 0
			for x in range(x0, x1 + 1):
				if have.has(Vector2i(x, y)):
					cnt += 1
			widths.append(cnt)
		var widest := 0
		for i in widths.size():
			if widths[i] > widths[widest]:
				widest = i
		var top_y := y0 + int(h * 0.03)                       # the top row: a heart's notch between its lobes
		var notch := not have.has(Vector2i(cx, top_y)) and not have.has(Vector2i(cx - 1, top_y)) and not have.has(Vector2i(cx + 1, top_y))
		var lobes := 0
		for x in range(x0, cx - 1):
			if have.has(Vector2i(x, top_y)):
				lobes |= 1
		for x in range(cx + 2, x1 + 1):
			if have.has(Vector2i(x, top_y)):
				lobes |= 2
		# round a circle about the mark's own middle: a star's points, a cross's arms
		var mid := Vector2.ZERO
		for m in marks:
			mid += Vector2(m)
		mid /= marks.size()
		var cy := int(mid.y)
		var circ := ""
		for k in 180:
			var a := TAU * k / 180.0
			circ += "1" if have.has(Vector2i(int(round(mid.x + cos(a) * h * 0.38)), int(round(mid.y + sin(a) * h * 0.38)))) else "0"
		circ = steady(circ)
		var arms := 0
		for k in 180:
			if circ[k] == "0" and circ[(k + 1) % 180] == "1":
				arms += 1
		out["mark"] = {"w": w, "h": h, "fill": float(marks.size()) / float(w * h), "widest_at": float(widest) / maxf(h - 1, 1), "bottom_w": float(widths[h - 1 - int(h * 0.08)]) / float(w),
			"notch": notch, "lobes": lobes == 3, "middle": have.has(Vector2i(int(mid.x), cy)), "arms": arms}
	return out


## a ring of 0s and 1s with its single stray points smoothed out (each point the majority of the five round it)
func steady(ring: String) -> String:
	var out := ""
	var n := ring.length()
	for k in n:
		var ones := 0
		for j in range(-2, 3):
			if ring[(k + j + n) % n] == "1":
				ones += 1
		out += "1" if ones >= 3 else "0"
	return out


func setup(name: String) -> void:
	key.visible = name != "dark" and name != "half" and not name.ends_with("_dark")
	key.light_energy = 1.8
	if name.begins_with("who:"):
		for e in eyes:                                       # (the eyeballs out of her pictures)
			e["holder"].visible = false
		var l := name.substr(4)
		if l.ends_with("_dark"):                             # the same look again, the lamp out
			return
		if l == "none" or l == "off":
			look_node.set_eyes("none")
			if l == "off":
				report["who"]["left"] = HSEyeFx.worn(who).size()
		else:
			look_node.set_eyes(l)
			report["who"]["worn"][l] = HSEyeFx.worn(who).size()
		var bl = HSBlink.of(who)
		if bl != null:
			bl.idle = false
		var sk: Skeleton3D = null
		for s in who.find_children("*", "Skeleton3D", true, false):
			sk = s
		var bb := AABB()
		var first := true
		for mi in who.find_children("*", "MeshInstance3D", true, false):
			if String(mi.name).to_lower().contains("_eye_"):
				var a: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
				bb = a if first else bb.merge(a)
				first = false
		var at := bb.get_center() if not first else who.global_position + Vector3(0, 1.5, 0)
		var span := maxf(0.16, bb.size.x * 2.0)
		cam.projection = Camera3D.PROJECTION_PERSPECTIVE
		var dist := span / (2.0 * tan(deg_to_rad(cam.fov) / 2.0))
		cam.look_at_from_position(at + Vector3(sin(0.25), 0.03, cos(0.25)) * dist, at + Vector3(0, -0.01, 0))
		key.look_at_from_position(at + Vector3(-0.9, 0.8, 2.0), at)
		key.light_energy = 1.6
		return
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL      # every eyeball seen square on, the same
	cam.size = 2.05
	cam.look_at_from_position(Vector3(0, 1.0, 6.3), Vector3(0, 1.0, 0))
	if name == "close":                                  # the hearts' eyeball alone, large: a heart's shape wants more pixels
		for e in eyes:
			if e["name"] == "hearts":
				cam.size = 0.56
				cam.look_at_from_position(e["holder"].global_position + Vector3(0, 0, 6.3), e["holder"].global_position)
		return
	key.look_at_from_position(Vector3(-3.0, 4.2, 5.0), Vector3(0, 1.0, 0))
	if name == "none":
		for e in eyes:
			HSEyeFx.clear(e["holder"])
		return
	if name == "later":
		return
	for e in eyes:
		if e["name"] == "plain":
			continue
		var st := {"amount": 0.5 if name == "half" else 1.0}
		if name == "green":
			st["color"] = GREEN
		HSEyeFx.wear(e["holder"], e["name"], st)


func _process(_d: float) -> bool:
	n += 1
	if n == 1:
		setup(stages[stage])
	if n < (60 if stages[stage] == "who:none" else 20):      # TAA settles (and her look goes on in her first frames)
		return false
	var name: String = stages[stage]
	var img := root.get_texture().get_image()
	if img.save_png(out_dir.path_join("eyes_%s.png" % name.replace(":", "_"))) != OK:
		print("EYES FAIL: can't write into " + out_dir)
		quit(1)
		return true
	if name.begins_with("who:"):
		var hot := 0                                         # pixels that glow red in the dark
		for y in range(0, img.get_height(), 2):
			for x in range(0, img.get_width(), 2):
				var p := img.get_pixel(x, y)
				if p.r > 0.5 and p.r > 2.0 * p.g and p.r > 2.0 * p.b:
					hot += 1
		report["who"]["glow"][name.substr(4)] = hot
	else:
		var row := {}
		for e in eyes:
			if name != "close" or e["name"] == "hearts":
				row[e["name"]] = measure(img, e)
		report["shots"][name] = row
	if name.begins_with("who:") and name != "who:none" and name != "who:off" and not name.ends_with("_dark") and ["glow", "void", "white", "spiral", "hearts"].has(name.substr(4)):
		stages.insert(stage + 1, name + "_dark")             # the looks that glow: again with the lamp out
	stage += 1
	n = 0
	if stage >= stages.size():
		var f := FileAccess.open(out_dir.path_join("eyes.json"), FileAccess.WRITE)
		if f != null:
			f.store_string(JSON.stringify(report, "  "))
			f.close()
		print("EYES {done}")
		return true
	return false
