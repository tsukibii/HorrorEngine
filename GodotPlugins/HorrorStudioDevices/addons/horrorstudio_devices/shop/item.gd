@tool
@icon("res://addons/horrorstudio_devices/icons/item.svg")
class_name HSShopItem
extends Resource
## One thing the laptop's shop sells (HSLaptop's Order tab). To add one: in the FileSystem dock right-click a folder,
## Create New, Resource..., HSShopItem; give it an `id`, a `title`, a `price` and a `model` (any scene: a made prop's
## .glb or .tscn, your own mesh); then drop it into a catalog's `items` (HSShopCatalog), or save it in the catalog's
## `folder`, where every HSShopItem is for sale. Ordered, it goes into the player's pocket (the starter's Story node) as
## `id`, `count` of them, shown in the HUD's inventory row as its own model; its slot in the shop shows the same model.

@export var id := ""                          ## the pocket's name for it: what a door, a script or Story.has() asks for ("batteries")
@export var title := ""                       ## its name on the screen and in the pocket ("Batteries, AA x2")
@export_multiline var about := ""             ## a line or two about it, typed out under it
@export var price := 5.0                      ## in the catalog's currency
@export var count := 1                        ## how many one order puts in the pocket
@export var stock := -1                       ## how many the shop has (-1: no end); each laptop counts what it's sold
@export var category := ""                    ## the heading it's listed under ("SUPPLIES"); the catalog's order otherwise
@export var model: PackedScene                ## what it looks like: in its slot, in the pocket's row, in the hand
@export var model_turn := Vector3.ZERO        ## degrees: how it sits in its slot (a flat thing stood up to be seen)
@export_range(1, 99) var max_per_order := 9   ## the most one order takes


## its name on the screen: the title, else its id
func name_of() -> String:
	return title if title != "" else id.replace("_", " ")
