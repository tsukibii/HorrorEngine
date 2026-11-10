@tool
@icon("res://addons/horrorstudio_devices/icons/catalog.svg")
class_name HSShopCatalog
extends Resource
## What a laptop's shop sells (HSLaptop's `catalog`): its `items`, and every HSShopItem saved in its `folder` (drop a
## .tres in and it's for sale; nothing to list). The plugin's own is `shop/catalog.tres`: a few things for a night in.

@export var store := "NIGHT-MART"             ## the shop's name at the top of its tab
@export var currency := "$"
@export var items: Array[HSShopItem] = []     ## its things, in this order
@export_dir var folder := ""                  ## and every HSShopItem in this folder (its own .tres files, not its subfolders)


## every thing for sale: the list, then the folder's (by file name), each id once; grouped by category when any has one
func all_items() -> Array[HSShopItem]:
	var out: Array[HSShopItem] = []
	var seen := {}
	for it in items:
		if it != null and it.id != "" and not seen.has(it.id):
			seen[it.id] = true
			out.append(it)
	for it in scan(folder):
		if not seen.has(it.id):
			seen[it.id] = true
			out.append(it)
	if out.any(func(i: HSShopItem) -> bool: return i.category != ""):
		var order := {}
		for i in out.size():
			order[out[i]] = i
		var cats: Array = []
		for it in out:
			if not it.category in cats:
				cats.append(it.category)
		out.sort_custom(func(a: HSShopItem, b: HSShopItem) -> bool:
			var ca := cats.find(a.category)
			var cb := cats.find(b.category)
			return ca < cb if ca != cb else order[a] < order[b])
	return out


## the HSShopItems saved in a folder (an exported game's too: its files are listed through the resource loader)
static func scan(dir: String) -> Array[HSShopItem]:
	var out: Array[HSShopItem] = []
	if dir == "":
		return out
	var files := ResourceLoader.list_directory(dir)
	files.sort()
	for f in files:
		if f.ends_with("/") or not (f.ends_with(".tres") or f.ends_with(".res")):
			continue
		var r = load(dir.path_join(f))
		if r is HSShopItem and (r as HSShopItem).id != "":
			out.append(r)
	return out
