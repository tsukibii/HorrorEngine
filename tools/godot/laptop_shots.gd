extends SceneTree
## The laptop guide's pictures (tools/godot/laptop_check.py --pictures): the office from laptop_scene.gd under xvfb at
## 1600 x 900, the same steps as LAPTOP: the room with the screen raining, the boot, HOME, ORDER with a thing picked,
## two batteries ordered (the HUD's row shows them), a burger too dear, the laptop seen close from the side, shut, the
## pocket afterwards, and ORDER on the camhybrid tape.
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
	await secs(1.5)
	await shot("room")
	pl.call("use")
	await secs(lap.zoom_secs * 0.5)
	await shot("zoom")
	await secs(lap.zoom_secs * 0.5 + 0.9)
	await shot("boot")
	await secs(2.5)
	await shot("home")
	if only.is_empty() or only.has("screen"):
		lap.screen.get_texture().get_image().save_png(out.path_join("screen.png"))   # the terminal's own picture
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
	st.set("cash", 2.0)
	lap.term.set_cash(2.0)
	await click(lap, centre(od.cards["burger"]))
	await click(lap, centre(od._buy))
	await secs(1.2)
	await shot("declined")
	st.set("cash", 40.0)
	lap.term.set_cash(40.0)
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
	(R["eye"] as Camera3D).make_current()
	var hud: Node = R["hud"]
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
	lap.lid_open = false
	cam.make_current()
	await secs(0.6)
	await shot("shut")
	(R["eye"] as Camera3D).make_current()
	lap.lid_open = true
	pl.call("use")
	await secs(lap.zoom_secs + 0.6)
	await click(lap, centre(lap.term.tab_buttons["ORDER"]))
	await click(lap, centre(od.cards["soda"]))
	var tape: Node = (load("res://addons/horrorstudio_look/presets/tape_camhybrid.tscn") as PackedScene).instantiate()
	root.add_child(tape)
	await secs(1.2)
	await shot("order_tape")
	print("SHOTS done")
	quit(0)
