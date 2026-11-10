extends SceneTree
## LAPTOP (tools/godot/laptop_check.py): the devices plugin's laptop prefab in a project made by godot_byhand.py, its
## office from laptop_scene.gd, played headless at 1280 x 720: its model's parts found, the picture on its glass
## upright, E from the starter's player taking the view in, the boot, a click through the glass on the catalogue,
## its pages (a category a page, NEXT, the numbers, the arrow keys), every thing a card with its own model in the green,
## an order of two paid from the Story's cash and into the pocket (the flashlight's spares, the HUD's row with the
## thing's model), too dear, sold out, a thing added by a file in the catalog's folder, what's for sale (`for_sale`, a
## laptop's `sells`), a thing locked until a task's done (a ?, not to be ordered, hidden with show_locked off; the task
## ticked: NEW, ordered), Esc back to the room, the screen drawing only while near and seen, a $20 note picked up, a shut
## laptop opening before the view goes in, and delivery (DECISIONS 2026-11-10, last): two orders sent to the doorstep,
## waiting while it's seen, two parcels side by side once it isn't; E on one: its tape and flaps, what's inside seen in it,
## then in the pocket; E on the other with take_on_open off: opened, then taken. Ends "LAPTOP ok".
##   godot --headless --fixed-fps 60 --path <project> -s res://laptop_test.gd

const Scene := preload("res://laptop_scene.gd")

var R := {}
var fails := 0
var notes: PackedStringArray = []


func fail(what: String) -> void:
	printerr("LAPTOP FAIL: " + what)
	fails += 1
	quit(1)


func ok(what: String) -> void:
	print("  ok  " + what)
	notes.append(what)


func frames(n: int) -> void:
	for i in n:
		await process_frame


func secs(t: float) -> void:
	await frames(int(ceil(t * 60.0)))


func _initialize() -> void:
	create_timer(400.0, true, false, true).timeout.connect(func() -> void:
		printerr("LAPTOP FAIL: watchdog")
		quit(1))
	call_deferred("_run")


# a click through the glass at a point of the screen's picture: the window's point the laptop's view sees it at
func click(lap: Node, sp: Vector2) -> void:
	var wp: Vector2 = lap.to_window(sp)
	var mm := InputEventMouseMotion.new()
	mm.position = wp
	mm.global_position = wp
	root.push_input(mm)
	await frames(3)
	for pressed in [true, false]:
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		mb.pressed = pressed
		mb.position = wp
		mb.global_position = wp
		root.push_input(mb)
		await frames(3)


func key(k: Key) -> void:
	for pressed in [true, false]:
		var e := InputEventKey.new()
		e.physical_keycode = k
		e.keycode = k
		e.pressed = pressed
		root.push_input(e)
		await frames(2)


func centre(c: Control) -> Vector2:
	return c.get_global_rect().get_center()


func _run() -> void:
	root.size = Vector2i(1280, 720)
	R = Scene.build(root)
	await frames(12)
	var lap: HSLaptop = R["laptop"]
	var st: Node = R["story"]
	var pl: Node3D = R["player"]
	var hud: Node = R["hud"]
	# ---- what it's made of
	if lap._lid == null or lap._screen_mi == null or lap.term == null or lap.screen == null:
		return fail("its model's parts: lid %s, glass %s, terminal %s" % [lap._lid, lap._screen_mi, lap.term])
	for k in ["screen", "screen_up", "screen_right", "webcam"]:
		if lap._sock.get(k) == null or lap._sock[k].get_parent() != lap._lid:
			return fail("the socket %s doesn't ride the lid" % k)
	var f: Dictionary = lap.frame()
	var sz := Vector2(lap.screen.size)
	if absf(sz.x / sz.y - f["hw"] / f["hh"]) > 0.01 or f["hw"] < 0.13 or f["hw"] > 0.17:
		return fail("the picture %s for a screen %.0f x %.0f mm" % [sz, f["hw"] * 2000, f["hh"] * 2000])
	# the picture upright on the glass: the screen's corners where the picture's are, its top at the lid's top
	var arr: Array = lap._screen_mi.mesh.surface_get_arrays(lap._screen_surf)
	var m: Basis = lap._mat.get_shader_parameter("uv_to_screen")
	var worst := 0.0
	for i in (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size():
		var p: Vector3 = lap._screen_mi.global_transform * arr[Mesh.ARRAY_VERTEX][i]
		var uv: Vector2 = arr[Mesh.ARRAY_TEX_UV][i]
		var st_: Vector3 = m * Vector3(uv.x, uv.y, 1.0)
		var d: Vector3 = p - f["c"]
		var want := Vector2(d.dot(f["r"]) / (2.0 * f["hw"]) + 0.5, 0.5 - d.dot(f["u"]) / (2.0 * f["hh"]))
		worst = maxf(worst, Vector2(st_.x, st_.y).distance_to(want))
	if worst > 0.01:
		return fail("the picture isn't where the glass is: off by %.3f of it" % worst)
	ok("its model's parts found (the lid on its hinge, the glass, its sockets riding the lid); a %d x %d picture on a %.0f x %.0f mm screen, upright (worst %.4f)"
			% [sz.x, sz.y, f["hw"] * 2000, f["hh"] * 2000, worst])
	if lap.term.awake or lap.term._rain.amount < 0.5:
		return fail("asleep it should rain: awake %s, rain %.2f" % [lap.term.awake, lap.term._rain.amount])
	# ---- E on it from the starter's player
	var eye: Camera3D = R["eye"]
	var used: Node = pl.call("use")
	await frames(2)
	if used != lap or not lap.using:
		return fail("E didn't reach it (the player's E found %s)" % used)
	if pl.process_mode != Node.PROCESS_MODE_DISABLED or st.visible:
		return fail("the player still walks or the Story's words still show")
	await secs(lap.zoom_secs + 0.3)
	var cam := root.get_camera_3d()
	if cam != lap._cam:
		return fail("the view isn't the laptop's camera")
	var vt := lap.view_transform()
	if cam.global_position.distance_to(vt.origin) > 0.003 or absf(cam.fov - lap.zoom_fov) > 0.1:
		return fail("the view didn't arrive: %.4f m off, fov %.1f" % [cam.global_position.distance_to(vt.origin), cam.fov])
	var tl: Vector2 = lap.to_window(Vector2.ZERO)
	var br: Vector2 = lap.to_window(sz)
	var fill := maxf((br.y - tl.y) / 720.0, (br.x - tl.x) / 1280.0)
	if fill < 0.85 or tl.x < -2 or tl.y < -2 or br.x > 1282 or br.y > 722:
		return fail("the screen in the view: %s to %s (fills %.2f)" % [tl, br, fill])
	if Input.mouse_mode != Input.MOUSE_MODE_HIDDEN and DisplayServer.get_name() != "headless":   # (headless keeps no mouse mode)
		return fail("the system's pointer while the terminal draws its own: %d" % Input.mouse_mode)
	ok("E on it: the player stopped, the view in to its screen in %.1f s at %.0f degrees, the screen %.0f%% of the view, the pointer the terminal's"
			% [lap.zoom_secs, lap.zoom_fov, fill * 100.0])
	await secs(3.0)
	if not lap.term._frame.visible or lap.term.current != "HOME":
		return fail("the boot's lines didn't give way to HOME")
	ok("the boot's lines typed out, then HOME")
	# ---- a click through the glass on the catalogue
	var browse := lap.term.find_child("Browse", true, false) as Button
	await click(lap, centre(browse))
	if lap.term.current != "ORDER":
		return fail("a click on OPEN THE CATALOGUE through the glass: the tab is %s" % lap.term.current)
	var od: Node = lap.term.order
	if od.pages.size() != 2 or od.items.size() != 6 or od.cards.size() != 3 or od._heading.text != "== SUPPLIES ==":
		return fail("the catalog's 6 things: %d pages, %d cards on the first under %s" % [od.pages.size(), od.cards.size(), od._heading.text])
	for pg in 2:
		if pg == 1:
			await click(lap, centre(od._next))
			if od.page != 1:
				return fail("NEXT through the glass: page %d" % (od.page + 1))
		for id in od.cards:
			var slot: TextureRect = od.cards[id].get_meta("slot")
			var vp := slot.get_meta("viewport") as SubViewport
			var meshes := vp.find_children("*", "MeshInstance3D", true, false)
			if meshes.is_empty() or slot.material == null:
				return fail("%s's card: %d meshes in its slot, its green %s" % [id, meshes.size(), slot.material])
	var pn1 := od._numbers.find_child("Page1", false, false) as Button
	var pn2 := od._numbers.find_child("Page2", false, false) as Button
	if pn1 == null or pn2 == null or pn2.text != "[2]" or pn1.text.strip_edges() != "1" or not od._next.disabled or od._prev.disabled \
			or od._heading.text != "== FOOD & DRINK ==" or not od.cards.has("burger"):
		return fail("page 2: its numbers %s %s, NEXT off %s, PREV off %s, its heading %s" % [pn1.text if pn1 else "-", pn2.text if pn2 else "-",
				od._next.disabled, od._prev.disabled, od._heading.text])
	await click(lap, centre(pn1))
	if od.page != 0 or not od.cards.has("batteries") or not od._prev.disabled:
		return fail("the number 1 clicked: page %d" % (od.page + 1))
	await key(KEY_RIGHT)
	var right_page: int = od.page
	await key(KEY_LEFT)
	if right_page != 1 or od.page != 0:
		return fail("the arrow keys: right to page %d, left to page %d" % [right_page + 1, od.page + 1])
	lap.page_size = 1
	od.refresh()
	var many: int = od.pages.size()
	od.show_page(3)
	var pn4 := od._numbers.find_child("Page4", false, false) as Button
	var p4_text := pn4.text if pn4 != null else "-"
	var nums: Array = od.page_numbers(12, 5)
	lap.page_size = 6
	od.refresh()
	od.show_page(0)
	if many != 6 or p4_text != "[4]" or nums != [0, -1, 3, 4, 5, 6, 7, -1, 11]:
		return fail("a page a thing: %d pages, the fourth %s; twelve pages at the sixth: %s" % [many, p4_text, nums])
	ok("ORDER a page at a time: SUPPLIES, then FOOD & DRINK, three cards each, each its own model in its slot (the HUD's HSModelSlot) in the terminal's green; NEXT, the numbers (1 [2]) and the arrow keys turn them through the glass; a page a thing: six pages, [4]; twelve at the sixth: 1 .. 4 5 [6] 7 8 .. 12")
	# ---- two batteries ordered by clicks
	await click(lap, centre(od.cards["batteries"]))
	if od.picked == null or od.picked.id != "batteries":
		return fail("a click on the batteries' card picked %s" % od.picked)
	await click(lap, centre(od._buy.get_parent().find_child("More", true, false)))
	if od.qty != 2:
		return fail("+ made it %d" % od.qty)
	var fl: Node = pl.get_node("Eye/Flashlight")
	var spares0: int = fl.get("spares")
	var cash0: float = st.get("cash")
	await click(lap, centre(od._buy))
	if not is_equal_approx(float(st.get("cash")), cash0 - 9.0) or st.call("count_of", "batteries") != 2:
		return fail("ordering two at $4.50: cash %.2f (was %.2f), in the pocket %d" % [st.get("cash"), cash0, st.call("count_of", "batteries")])
	if int(fl.get("spares")) != spares0 + 2:
		return fail("the flashlight's spares %d (was %d)" % [fl.get("spares"), spares0])
	await frames(4)
	var row_model = hud.get("inv_models").get("batteries")
	var slot_in_row: Node = (hud.get("inv_box") as Node).find_child("Slot_batteries", true, false)
	if row_model == null or slot_in_row == null or (row_model as Node).find_children("*", "MeshInstance3D", true, false).is_empty():
		return fail("the HUD's row: its model %s, its slot %s" % [row_model, slot_in_row])
	if not str(lap.term._status_text).contains("#1001"):
		return fail("the status line: %s" % lap.term._status_text)
	ok("two batteries ordered by clicks (+ then ORDER): $9.00 from the Story's $%.2f, two in the pocket, the flashlight's spares %d to %d, in the HUD's row as their own model; ORDER #1001 said"
			% [cash0, spares0, int(fl.get("spares"))])
	# ---- too dear
	st.set("cash", 3.0)
	lap.term.set_cash(3.0)
	await click(lap, centre(od._next))                 # the burger's on FOOD & DRINK
	await click(lap, centre(od.cards["burger"]))
	await click(lap, centre(od._buy))
	if not is_equal_approx(float(st.get("cash")), 3.0) or st.call("has", "burger") or not str(od._note.text).begins_with("DECLINED"):
		return fail("a $5.50 burger with $3.00: cash %.2f, the pocket %s, said %s" % [st.get("cash"), st.get("items"), od._note.text])
	ok("a $5.50 burger with $3.00: declined (%s), nothing taken, nothing given" % od._note.text)
	# ---- sold out
	st.set("cash", 100.0)
	lap.term.set_cash(100.0)
	await click(lap, centre(od._numbers.find_child("Page1", false, false)))
	await click(lap, centre(od.cards["painkillers"]))
	await click(lap, centre(od._buy.get_parent().find_child("More", true, false)))
	await click(lap, centre(od.cards["painkillers"]))     # picked again: how many back to 1
	await click(lap, centre(od._buy.get_parent().find_child("More", true, false)))
	await click(lap, centre(od._buy))
	if lap.left_of(od.picked) != 0 or not od._buy.disabled or st.call("count_of", "painkillers") != 2:
		return fail("the painkillers' 2: left %d, ORDER disabled %s, in the pocket %d" % [lap.left_of(od.picked), od._buy.disabled, st.call("count_of", "painkillers")])
	var again: Dictionary = lap.place_order(od.picked, 1)
	if again.get("ok", true) or not str(again.get("why", "")).contains("SOLD OUT"):
		return fail("a third: %s" % again)
	ok("the painkillers' stock of 2 sold: their card says SOLD OUT, ORDER can't be pressed, a third refused")
	# ---- a thing added by its file alone
	DirAccess.make_dir_recursive_absolute("res://lab_items")
	var it := HSShopItem.new()
	it.id = "lighter"
	it.title = "Lighter"
	it.price = 1.0
	it.category = "SUPPLIES"
	it.model = load("res://addons/horrorstudio_devices/shop/models/candle_votive.glb")
	ResourceSaver.save(it, "res://lab_items/lighter.tres")
	lap.catalog = lap.catalog.duplicate()
	lap.catalog.folder = "res://lab_items"
	od.refresh()
	if not od.cards.has("lighter") or od.items.size() != 7:
		return fail("a .tres in the catalog's folder: %d things, %s" % [od.items.size(), od.cards.keys()])
	ok("a thing added by saving its HSShopItem in the catalog's folder: 7 things, on SUPPLIES' page")
	# ---- what's for sale, and a thing locked until a task's done
	var sh := HSShopItem.new()
	sh.id = "shells"
	sh.title = "Shotgun shells, 5"
	sh.price = 6.0
	sh.category = "SUPPLIES"
	sh.needs = "task:find_gun"
	sh.locked_text = "FIND THE GUN FIRST."
	sh.model = load("res://addons/horrorstudio_devices/shop/models/batteries_aa_2.glb")
	var its: Array[HSShopItem] = []
	its.assign(lap.catalog.items)
	its.append(sh)
	lap.catalog.items = its
	od.refresh()
	await frames(2)                                    # (the page's new cards laid out before one's clicked)
	var sc: Control = od.cards.get("shells")
	if sc == null or not sc.get_meta("locked") or (sc.get_meta("slot") as Node).name != "Mystery" or (sc.get_meta("price") as Label).text != "LOCKED":
		return fail("a thing that needs task:find_gun: its card %s" % sc)
	await click(lap, centre(sc))
	if od._title.text != "???" or not od._buy.disabled or od._about_text != "FIND THE GUN FIRST." or od._slot.has_meta("viewport"):
		return fail("its ? picked: %s, ORDER off %s, its words %s" % [od._title.text, od._buy.disabled, od._about_text])
	var r_locked: Dictionary = lap.place_order(sh, 1)
	if r_locked.get("ok", true) or str(r_locked.get("why")) != "LOCKED.":
		return fail("a locked thing ordered: %s" % r_locked)
	sh.show_locked = false
	od.refresh()
	var hidden_ok: bool = not od.cards.has("shells") and not od.items.has(sh)
	sh.show_locked = true
	st.call("add_task", "find_gun", "Find the gun")
	st.call("tick", "find_gun")
	od.refresh()
	await frames(2)
	sc = od.cards.get("shells")
	var new_text := (sc.get_meta("price") as Label).text if sc != null else "-"
	if not hidden_ok or sc == null or sc.get_meta("locked") or not (sc.get_meta("slot") as Node).has_meta("viewport") or not new_text.ends_with("NEW"):
		return fail("hidden while locked %s; the task done: its card says %s" % [hidden_ok, new_text])
	await click(lap, centre(sc))
	await click(lap, centre(od._buy))
	if st.call("count_of", "shells") != 1 or (sc.get_meta("price") as Label).text.ends_with("NEW"):
		return fail("the shells unlocked and ordered: %d in the pocket, its card %s" % [st.call("count_of", "shells"), (sc.get_meta("price") as Label).text])
	var candle: HSShopItem = null
	for it2: HSShopItem in od.items:
		if it2.id == "candle":
			candle = it2
	candle.for_sale = false
	od.refresh()
	var no_candle: bool = not od.items.has(candle)
	candle.for_sale = true
	lap.sells = PackedStringArray(["batteries", "soda"])
	od.refresh()
	var only_two: Array = od.items.map(func(i: HSShopItem) -> String: return i.id)
	lap.sells = PackedStringArray()
	od.refresh()
	if not no_candle or only_two != ["batteries", "soda"] or od.items.size() != 8:
		return fail("for sale: the candle gone %s; sells [batteries, soda]: %s; back to %d things" % [no_candle, only_two, od.items.size()])
	ok("what's for sale: the candle's for_sale off and it's gone; a laptop's sells [batteries, soda] and only those; shells needing task:find_gun a ? (???, LOCKED, FIND THE GUN FIRST., not to be ordered), left out with show_locked off; the task ticked: its model, NEW, ordered into the pocket, NEW no more")
	# ---- back to the room
	await key(KEY_ESCAPE)
	await secs(lap.zoom_secs + 0.3)
	if lap.using or root.get_camera_3d() != eye or pl.process_mode != Node.PROCESS_MODE_INHERIT or not st.visible:
		return fail("Esc: using %s, the eye %s, the player %d, the Story %s" % [lap.using, root.get_camera_3d() == eye, pl.process_mode, st.visible])
	if (Input.mouse_mode != Input.MOUSE_MODE_CAPTURED and DisplayServer.get_name() != "headless") or lap.term.awake:
		return fail("Esc: the mouse %d, the terminal awake %s" % [Input.mouse_mode, lap.term.awake])
	ok("Esc: the view back to the eye, the player walking, the Story's words, the mouse captured, the screen asleep")
	# ---- the screen drawn only while near and seen
	var d0: int = lap.idle_draws
	await secs(0.5)
	var drawn: int = lap.idle_draws - d0
	pl.global_position = Vector3(0, 0, 9.0)            # far away (and behind a wall)
	await frames(4)
	var d1: int = lap.idle_draws
	await secs(0.5)
	var far_mode := lap.screen.render_target_update_mode
	if drawn < 4 or drawn > 8 or lap.idle_draws != d1 or far_mode != SubViewport.UPDATE_DISABLED:
		return fail("asleep: drawn %d times in half a second near, %d far, far its mode %d" % [drawn, lap.idle_draws - d1, far_mode])
	pl.global_position = Vector3(0, 0, -0.05)
	ok("asleep its screen drawn %d times in half a second while near and seen, not at all from 9 m" % drawn)
	# ---- the $20 note: the player turned to it, E
	var note: Node3D = R["note"]
	var cash1: float = st.get("cash")
	pl.look_at(Vector3(note.global_position.x, pl.global_position.y, note.global_position.z), Vector3.UP)
	var e_xf := eye.global_transform
	eye.look_at(note.global_position, Vector3.UP)
	await frames(3)
	pl.call("use")
	await frames(3)
	if not is_equal_approx(float(st.get("cash")), cash1 + 20.0):
		return fail("the $20 note: cash %.2f (was %.2f)" % [st.get("cash"), cash1])
	eye.global_transform = e_xf
	ok("a $20 note picked up with E: the Story's cash %.2f to %.2f" % [cash1, st.get("cash")])
	# ---- a shut laptop opens before the view goes in
	pl.rotation = Vector3.ZERO
	eye.rotation = Vector3(deg_to_rad(-42.0), 0, 0)
	lap.lid_open = false
	await frames(2)
	var shut_basis := lap._lid.basis
	var power0: float = lap._mat.get_shader_parameter("power")
	if absf(rad_to_deg(shut_basis.get_euler().x)) < 100.0 or power0 > 0.001:
		return fail("shut: the lid turned %.0f degrees, the screen's power %.2f" % [rad_to_deg(shut_basis.get_euler().x), power0])
	pl.call("use")
	await frames(3)
	if not lap.using or lap._lid_to != 1.0:
		return fail("E on it shut: using %s, the lid going to %s" % [lap.using, lap._lid_to])
	await secs(0.7 + lap.zoom_secs + 0.3)
	if lap._lid_k < 0.999 or root.get_camera_3d() != lap._cam or float(lap._mat.get_shader_parameter("power")) < 0.99:
		return fail("shut, then E: the lid %.2f open, the view %s, the power %.2f" % [lap._lid_k, root.get_camera_3d() == lap._cam, lap._mat.get_shader_parameter("power")])
	ok("shut: its lid down and the screen dark; E opens it and then the view goes in")
	await key(KEY_E)
	await secs(lap.zoom_secs + 0.3)
	if lap.using:
		return fail("E at the screen didn't leave")
	ok("E at the screen leaves it too")
	# ---- delivery: two orders sent to the doorstep, left there once it isn't seen
	var spot: Node3D = R["doorstep"]
	lap.deliver_to = lap.get_path_to(spot)
	lap.deliver_place = "the front door"
	lap.delivery_secs = 2.0
	pl.call("use")
	await secs(lap.zoom_secs + 0.4)
	await click(lap, centre(lap.term.tab_buttons["ORDER"]))
	await click(lap, centre(od._next))
	await click(lap, centre(od.cards["soda"]))
	var soda0: int = st.call("count_of", "soda")
	await click(lap, centre(od._buy))
	if st.call("count_of", "soda") != soda0 or lap.deliveries.size() != 1 or not str(od._note.text).contains("ON ITS WAY TO THE FRONT DOOR: IN 2 SEC"):
		return fail("a soda sent: in the pocket %d (was %d), on its way %d, said %s" % [st.call("count_of", "soda"), soda0, lap.deliveries.size(), od._note.text])
	await click(lap, centre(od._prev))
	await click(lap, centre(od.cards["candle"]))
	var candle0: int = st.call("count_of", "candle")
	await click(lap, centre(od._buy))
	if lap.deliveries.size() != 2:
		return fail("a candle sent too: %d on their way" % lap.deliveries.size())
	ok("with deliver_to set: a soda and a candle ordered, nothing into the pocket yet: ON ITS WAY TO THE FRONT DOOR: IN 2 SEC")
	await key(KEY_ESCAPE)
	await secs(lap.zoom_secs + 0.3)
	var got: Array = []
	lap.delivered.connect(func(p: HSPackage) -> void: got.append(p))
	eye.look_at(spot.global_position + Vector3(0, 0.15, 0), Vector3.UP)
	await secs(2.6)
	var waited: bool = lap.deliveries.size() == 2 and got.is_empty()
	eye.rotation = Vector3(deg_to_rad(-42.0), 0, 0)    # back to the desk: the door behind
	await frames(4)
	var pk: Array = spot.get_children().filter(func(c: Node) -> bool: return c is HSPackage)
	if not waited or pk.size() != 2 or got.size() != 2 or not lap.deliveries.is_empty():
		return fail("due while the door's seen: waited %s; looked away: %d parcels on the doorstep, %d delivered, %d still coming" % [waited, pk.size(), got.size(), lap.deliveries.size()])
	var p0: HSPackage = pk[0]
	var p1x: HSPackage = pk[1]
	var apart := p0.global_position.distance_to(p1x.global_position)
	if p0.items.size() != 1 or p0.items[0].id != "soda" or p1x.items[0].id != "candle" or p1x.order_number != p0.order_number + 1 \
			or absf(apart - (p0.box.size.x + 0.05)) > 0.01 or absf(p0.global_position.y - spot.global_position.y) > 0.002 or p0._sfx.size() != 4:
		return fail("the parcels: %s and %s, orders %d and %d, %.3f m apart, at %.3f m, %d sounds" % [p0.items, p1x.items, p0.order_number, p1x.order_number,
				apart, p0.global_position.y, p0._sfx.size()])
	ok("due while the doorstep was in view: it waited; looked away: two parcels left side by side on it (%.2f m apart, the soda's order #%d and the candle's), a knock and the box set down" % [apart, p0.order_number])
	# ---- E on the first: the tape, the flaps, what's inside seen, then in the pocket
	var unboxed: Array = []
	p0.unboxed.connect(func(a: Array, b: Array) -> void: unboxed.append([a, b]))
	pl.global_position = Vector3(0.7, 0.0, p0.global_position.z)
	pl.rotation = Vector3.ZERO
	eye.look_at(p0.global_position + Vector3(0, 0.12, 0), Vector3.UP)
	await frames(3)
	var u: Node = pl.call("use")
	await frames(2)
	if u != p0 or not p0.is_open:
		return fail("E on the parcel: the player's E found %s, open %s" % [u, p0.is_open])
	await secs(HSPackage.LEAD + p0.open_secs + 0.15)
	var worst_flap := 0.0
	for fp in p0.flaps:
		var part: Dictionary = fp["part"]
		var want := float(part["open"]) - float(part["built"])
		var turned := rad_to_deg((fp["node"] as Node3D).basis.get_rotation_quaternion().get_angle())
		worst_flap = maxf(worst_flap, absf(turned - want))
	var seen_inside: bool = p0.shown.size() == 1 and p0.box.grow(0.005).has_point(HSModelSlot.bounds_of(p0.shown[0], p0).get_center())
	if p0.flaps.size() != 4 or worst_flap > 1.0 or not seen_inside or st.call("count_of", "soda") != soda0:
		return fail("opening: %d flaps, the worst %.1f degrees off open; the soda seen in it %s; in the pocket already %d" % [p0.flaps.size(), worst_flap, seen_inside,
				st.call("count_of", "soda")])
	await secs(1.0)
	if st.call("count_of", "soda") != soda0 + 1 or not p0.is_empty or unboxed.size() != 1 or not p0.shown.is_empty() or hud.get("inv_models").get("soda") == null:
		return fail("unboxed: the soda %d in the pocket, empty %s, said %d times, the HUD's row %s" % [st.call("count_of", "soda"), p0.is_empty, unboxed.size(),
				hud.get("inv_models").get("soda")])
	pl.call("use")
	await frames(2)
	if str((st.get("_line") as Label).text) != "Empty.":
		return fail("E on it empty: the Story said %s" % (st.get("_line") as Label).text)
	ok("E on it: the tape cut, its four flaps swung open in turn (the long ones first, within %.1f degrees), the soda seen inside, then into the pocket with its model (the HUD's row); E again: Empty." % worst_flap)
	# ---- E on the other with take_on_open off: opened, then E takes what's in it
	p1x.take_on_open = false
	pl.global_position = Vector3(0.7, 0.0, p1x.global_position.z)
	eye.look_at(p1x.global_position + Vector3(0, 0.12, 0), Vector3.UP)
	await frames(3)
	pl.call("use")
	await secs(HSPackage.LEAD + p1x.open_secs + 0.8)
	var kept: bool = p1x.is_open and not p1x.is_empty and p1x.shown.size() == 1 and st.call("count_of", "candle") == candle0
	pl.call("use")
	await secs(1.0)
	if not kept or not p1x.is_empty or st.call("count_of", "candle") != candle0 + 1:
		return fail("take_on_open off: opened and kept %s; E again: empty %s, the candle %d (was %d)" % [kept, p1x.is_empty, st.call("count_of", "candle"), candle0])
	ok("take_on_open off: E opened it and the candle stayed inside; E again took it into the pocket")
	print("LAPTOP ok (%d steps: the prefab, E, the boot, clicks through the glass, pages, an order into the pocket and the HUD's row, too dear, sold out, a thing added by file, what's for sale and locked, Esc and E back, idle drawing, cash picked up, a shut lid, delivery and unboxing)" % notes.size())
	quit(0)
