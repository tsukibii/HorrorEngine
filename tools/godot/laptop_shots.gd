extends SceneTree
## The laptop guide's pictures (tools/godot/laptop_check.py --pictures): the office from laptop_scene.gd under xvfb at
## 1600 x 900, the same steps as LAPTOP: the room with the screen raining, the boot, HOME, ORDER's first page with a
## thing picked and a box of shells still a ?, two batteries ordered (the HUD's row shows them), the ? picked, the shells
## unlocked (NEW), the second page with a burger too dear, the laptop seen close from the side, shut, the pocket
## afterwards, ORDER on the camhybrid tape; then delivery: a soda sent to the front door, its parcel left there (a shotgun
## put in it too), E: the box bursting in a puff, the soda and the shotgun out of it at their own sizes, pulled into the
## player, the box gone and the pocket's row.
##   godot --path <project> --rendering-driver vulkan --fixed-fps 30 -s res://laptop_shots.gd -- --out=DIR [--only=room,home]

const Scene := preload("res://laptop_scene.gd")

var R := {}
var out := ""
var only: PackedStringArray = []


func frames(n: int) -> void:
	for i in n:
		await process_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 30.0)))


func shot(nm: String) -> void:
	if not only.is_empty() and not only.has(nm):
		return
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var im := root.get_texture().get_image()
	im.save_png(out.path_join(nm + ".png"))
	print("SHOT " + nm)


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--only="):
			only = a.substr(7).split(",")
	create_timer(900.0, true, false, true).timeout.connect(func() -> void: quit(1))
	call_deferred("_run")


func click(lap: Node, sp: Vector2, hold := false) -> void:
	var wp: Vector2 = lap.to_window(sp)
	var mm := InputEventMouseMotion.new()
	mm.position = wp
	mm.global_position = wp
	root.push_input(mm)
	await frames(3)
	if hold:
		return
	for pressed in [true, false]:
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		mb.pressed = pressed
		mb.position = wp
		mb.global_position = wp
		root.push_input(mb)
		await frames(3)


func centre(c: Control) -> Vector2:
	return c.get_global_rect().get_center()


func _run() -> void:
	root.size = Vector2i(1600, 900)
	R = Scene.build(root)
	var lap: HSLaptop = R["laptop"]
	var st: Node = R["story"]
	var pl: Node3D = R["player"]
	var eye: Camera3D = R["eye"]
	# a box of shells the shop sells once the gun's been found (a task): a ? until then
	var sh := HSShopItem.new()
	sh.id = "shells"
	sh.title = "Shotgun shells, 5"
	sh.about = "Five 12-gauge shells in a card box. Someone has written a name on the lid."
	sh.price = 7.5
	sh.category = "SUPPLIES"
	sh.needs = "task:find_gun"
	sh.locked_text = "NOT FOR YOU. NOT YET.\nFIND THE GUN FIRST."
	sh.model = load("res://addons/horrorstudio_weapons/models/shells_box_5.glb")
	sh.model_turn = Vector3(25, 0, 0)
	lap.catalog = lap.catalog.duplicate()
	var its: Array[HSShopItem] = []
	its.assign(lap.catalog.items)
	its.append(sh)
	lap.catalog.items = its
	await secs(1.5)
	await shot("room")
	pl.call("use")
	await secs(lap.zoom_secs * 0.5)
	await shot("zoom")
	await secs(lap.zoom_secs * 0.5 + 0.9)
	await shot("boot")
	await secs(2.5)
	await shot("home")
	var od: Node = lap.term.order
	await click(lap, centre(lap.term.find_child("Browse", true, false)))
	await click(lap, centre(od.cards["batteries"]))
	await click(lap, centre(od._buy.get_parent().find_child("More", true, false)))
	await click(lap, centre(od.cards["candle"]), true)          # the pointer over the candle: its card lit, turning
	await secs(1.5)
	await shot("order")
	await click(lap, centre(od._buy))
	await secs(1.2)
	await shot("ordered")
	await click(lap, centre(od.cards["shells"]))
	await secs(1.6)
	await shot("locked")
	st.call("add_task", "find_gun", "Find the gun")
	st.call("tick", "find_gun")
	od.refresh()                                                   # (the laptop does it each time it wakes)
	await frames(3)
	await click(lap, centre(od.cards["painkillers"]), true)
	await secs(1.6)
	await shot("unlocked")
	st.set("cash", 2.0)
	lap.term.set_cash(2.0)
	await click(lap, centre(od._next))
	await click(lap, centre(od.cards["burger"]))
	await click(lap, centre(od._buy))
	await secs(1.2)
	await shot("declined")
	st.set("cash", 40.0)
	lap.term.set_cash(40.0)
	await click(lap, centre(od._prev))
	await click(lap, centre(od.cards["painkillers"]))
	await click(lap, centre(od._buy))
	lap.leave()
	await secs(lap.zoom_secs + 0.6)
	var cam := Camera3D.new()                                    # the laptop seen close, from the side and above
	R["world"].add_child(cam)
	cam.fov = 45.0
	cam.global_position = lap.global_position + Vector3(0.55, 0.36, 0.42)
	cam.look_at(lap.global_position + Vector3(0.04, 0.09, -0.02), Vector3.UP)
	cam.make_current()
	await secs(1.0)
	await shot("close")
	eye.make_current()
	var ev := InputEventKey.new()
	ev.physical_keycode = KEY_TAB
	ev.pressed = true
	root.push_input(ev)
	await frames(2)
	ev = InputEventKey.new()
	ev.physical_keycode = KEY_TAB
	ev.pressed = false
	root.push_input(ev)
	await secs(1.2)
	await shot("pocket")
	for pressed in [true, false]:                                # Tab again: the row down
		ev = InputEventKey.new()
		ev.physical_keycode = KEY_TAB
		ev.pressed = pressed
		root.push_input(ev)
		await frames(2)
	lap.lid_open = false
	cam.make_current()
	await secs(0.6)
	await shot("shut")
	eye.make_current()
	lap.lid_open = true
	pl.call("use")
	await secs(lap.zoom_secs + 0.6)
	await click(lap, centre(lap.term.tab_buttons["ORDER"]))
	await click(lap, centre(od._next))
	await click(lap, centre(od.cards["soda"]))
	var tape: Node = (load("res://addons/horrorstudio_look/presets/tape_camhybrid.tscn") as PackedScene).instantiate()
	root.add_child(tape)
	await secs(1.2)
	await shot("order_tape")
	tape.queue_free()
	# ---- delivery: the soda sent to the front door, its parcel there, opened with E
	lap.deliver_to = lap.get_path_to(R["doorstep"])
	lap.deliver_place = "the front door"
	lap.delivery_secs = 0.0
	await click(lap, centre(od._buy))
	await secs(1.4)
	await shot("sent")
	lap.leave()
	await secs(lap.zoom_secs + 0.6)                              # (the door behind the desk: left while unseen)
	var spot: Node3D = R["doorstep"]
	var pkg: HSPackage = null
	for c in spot.get_children():
		if c is HSPackage:
			pkg = c
	if pkg == null:
		printerr("SHOTS no parcel came")
		quit(1)
		return
	pl.global_position = Vector3(0.3, 0.0, 1.75)
	pl.rotation = Vector3.ZERO
	eye.look_at(spot.global_position + Vector3(0.0, 0.42, -0.12), Vector3.UP)
	await secs(1.0)
	await shot("parcel_door")
	var cam2 := Camera3D.new()                                   # the parcel close: its tape and its label
	R["world"].add_child(cam2)
	cam2.fov = 42.0
	cam2.global_position = pkg.global_position + Vector3(-0.62, 0.52, 0.34)
	cam2.look_at(pkg.global_position + Vector3(0.0, 0.1, 0.0), Vector3.UP)
	cam2.make_current()
	await secs(0.6)
	await shot("parcel_close")
	eye.make_current()
	var gun := HSShopItem.new()                                   # a shotgun in it too: three times the box's length
	gun.id = "shotgun"
	gun.title = "Double-barrel shotgun"
	gun.model = load("res://addons/horrorstudio_weapons/models/shotgun_double.glb")
	pkg.items.append(gun)
	pkg.counts = PackedInt32Array([1, 1])
	pl.global_position = Vector3(0.52, 0.0, pkg.global_position.z)
	eye.look_at(pkg.global_position + Vector3(0, 0.08, 0), Vector3.UP)
	await frames(3)
	pl.call("use")                                                # E on it
	eye.look_at(pkg.global_position + Vector3(0, 0.3, 0), Vector3.UP)   # then a little up: what comes out rises
	await secs(HSPackage.BURST + 0.05)
	await shot("unbox_burst")
	cam2.global_position = pkg.global_position + Vector3(-0.4, 0.6, 1.25)
	cam2.look_at(pkg.global_position + Vector3(-0.25, 0.38, 0.0), Vector3.UP)
	cam2.make_current()
	await secs(0.12)
	await shot("unbox_side")
	eye.make_current()
	await secs(0.28)
	await shot("unbox_pull")
	await secs(1.6)
	await shot("unboxed")
	print("SHOTS done")
	quit(0)
