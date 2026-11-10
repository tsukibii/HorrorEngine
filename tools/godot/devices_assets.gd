extends SceneTree
## The devices plugin's own shop and its laptop prefab, written by Godot itself (its text exactly as Godot writes it):
## shop/items/*.tres, shop/catalog.tres, laptop/laptop.tscn, delivery/package.tscn. In a project with the plugin
## (godot_byhand.py new):
##   godot --headless --path <project> -s res://devices_assets.gd [-- --only=shop,laptop,package]   (this file copied into it)
## then copy those files back into GodotPlugins/HorrorStudioDevices/addons/horrorstudio_devices/. (Saving the shop again
## gives its files new uids: `--only` the part that changed.)
const D := "res://addons/horrorstudio_devices/"


func _initialize() -> void:
	call_deferred("_go")


func _go() -> void:
	var only: PackedStringArray = ["shop", "laptop", "package"]
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = a.substr(7).split(",")
	if "shop" in only:
		_shop()
	if "laptop" in only:
		_laptop()
	if "package" in only:
		_package()
	print("ASSETS made")
	quit()


func _shop() -> void:
	var specs := [
		["batteries", "AA batteries, pair", "Two AA cells for the flashlight. Fresh, or so the packet says.", 4.5, 1, -1, "SUPPLIES", "batteries_aa_2"],
		["candle", "Votive candle", "A short candle in a glass. It burns about an hour. The glass is already black.", 2.0, 1, -1, "SUPPLIES", "candle_votive"],
		["painkillers", "Painkillers", "A bottle of tablets with somebody else's name on the label.", 6.0, 1, 2, "SUPPLIES", "pill_bottle"],
		["water", "Mineral water", "Natural mineral water. Sealed, as far as you can tell.", 1.2, 1, -1, "FOOD & DRINK", "water_bottle"],
		["soda", "Kaze orange soda", "An orange soda. Warm.", 1.5, 1, -1, "FOOD & DRINK", "soda_can"],
		["burger", "Big Bite burger", "Delivered hot. Nobody remembers ordering the second one.", 5.5, 1, 3, "FOOD & DRINK", "burger_box"],
	]
	var items: Array[HSShopItem] = []
	for s in specs:
		var it := HSShopItem.new()
		it.id = s[0]
		it.title = s[1]
		it.about = s[2]
		it.price = s[3]
		it.count = s[4]
		it.stock = s[5]
		it.category = s[6]
		it.model = load(D + "shop/models/%s.glb" % s[7])
		var p: String = D + "shop/items/%s.tres" % s[0]
		var e := ResourceSaver.save(it, p)
		if e != OK:
			printerr("save %s: %d" % [p, e])
		items.append(load(p))
	var cat := HSShopCatalog.new()
	cat.store = "NIGHT-MART"
	cat.currency = "$"
	cat.items = items
	ResourceSaver.save(cat, D + "shop/catalog.tres")


func _laptop() -> void:
	var root := Node3D.new()
	root.name = "Laptop"
	root.set_script(load(D + "laptop/laptop.gd"))
	var model: Node3D = (load(D + "models/laptop.glb") as PackedScene).instantiate()
	model.name = "Model"
	root.add_child(model)
	model.owner = root
	var mouse: Node3D = (load(D + "models/computer_mouse.glb") as PackedScene).instantiate()
	mouse.name = "Mouse"
	root.add_child(mouse)
	mouse.owner = root
	mouse.position = Vector3(0.24, 0.0, 0.03)
	mouse.rotation_degrees = Vector3(0.0, -7.0, 0.0)
	var ps := PackedScene.new()
	ps.pack(root)
	ResourceSaver.save(ps, D + "laptop/laptop.tscn")


func _package() -> void:
	var pk := Node3D.new()                             # the parcel the shop's deliveries come in
	pk.name = "Package"
	pk.set_script(load(D + "delivery/package.gd"))
	var box: Node3D = (load(D + "models/parcel.glb") as PackedScene).instantiate()
	box.name = "Model"
	pk.add_child(box)
	box.owner = pk
	var pp := PackedScene.new()
	pp.pack(pk)
	ResourceSaver.save(pp, D + "delivery/package.tscn")
