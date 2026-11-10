@tool
@icon("res://addons/horrorstudio_devices/icons/item.svg")
class_name HSShopItem
extends Resource
## One thing the laptop's shop sells (HSLaptop's Order tab). To add one: in the FileSystem dock right-click a folder,
## Create New, Resource..., HSShopItem; give it an `id`, a `title`, a `price` and a `model` (any scene: a made prop's
## .glb or .tscn, your own mesh); then drop it into a catalog's `items` (HSShopCatalog), or save it in the catalog's
## `folder`, where every HSShopItem is for sale. Ordered, it goes into the player's pocket (the starter's Story node) as
## `id`, `count` of them, shown in the HUD's inventory row as its own model (or comes in a parcel first: the laptop's
## Delivery); its slot in the shop shows the same model.
## Whether it's in the shop at all is its `for_sale` (and a laptop's own `sells` list); whether it can be ordered yet is
## its `needs` (the DECISIONS of 2026-11-10, last: "make the items unlockable by quests that are done (flags) ... do a ?
## for non unlocked items"): until they hold it's a ? in the shop.

@export var id := ""                          ## the pocket's name for it: what a door, a script or Story.has() asks for ("batteries")
@export var title := ""                       ## its name on the screen and in the pocket ("Batteries, AA x2")
@export_multiline var about := ""             ## a line or two about it, typed out under it
@export var price := 5.0                      ## in the catalog's currency
@export var count := 1                        ## how many one order puts in the pocket
@export var stock := -1                       ## how many the shop has (-1: no end); each laptop counts what it's sold
@export var category := ""                    ## the heading its page has ("SUPPLIES"); the catalog's order otherwise
@export var model: PackedScene                ## what it looks like: in its slot, in the pocket's row, in the hand, in its parcel
@export var model_turn := Vector3.ZERO        ## degrees: how it sits in its slot (a flat thing stood up to be seen)
@export_range(1, 99) var max_per_order := 9   ## the most one order takes
@export_group("For sale")
@export var for_sale := true                  ## off: not in the shop at all (kept for later, or for a script to turn on)
@export var needs := ""                       ## what must have happened before it can be ordered, in the starter Story's words: "task:<id>" that task done, a fact set ("cellar_open"), "item:<id>" carried, "!" in front for not, several apart by commas (all of them). Empty: always. A game without that Story: the laptop's unlock(id)
@export var show_locked := true               ## until it's unlocked: a ? in the shop (on), or not there at all (off: a surprise)
@export_multiline var locked_text := ""       ## what the terminal says when its ? is picked ("FINISH THE CELLAR FIRST."); LOCKED. when empty


## its name on the screen: the title, else its id
func name_of() -> String:
	return title if title != "" else id.replace("_", " ")


## into the pocket: `count` of it to the Story (`give(id, title, model, count)`: the HUD's row shows a copy of its
## model), an older Story's one argument once each; batteries are also the starter flashlight's spares (`add_spare`, as
## its pickup.gd does)
func give_to(tree: SceneTree, n: int, player: Node = null) -> void:
	var st := tree.get_first_node_in_group("hs_story")
	if st != null and st.has_method("give"):
		if st.get_method_argument_count("give") >= 4:
			st.give(id, name_of(), HSModelSlot.of_scene(model) if model != null else null, n)
		else:
			for i in n:
				st.give(id)
	if id == "batteries":
		var p: Node = player if player != null else tree.get_first_node_in_group("hs_player")
		var fl = p.get_node_or_null("Eye/Flashlight") if p != null else null
		if fl != null and fl.has_method("add_spare"):
			for i in n:
				fl.add_spare()
