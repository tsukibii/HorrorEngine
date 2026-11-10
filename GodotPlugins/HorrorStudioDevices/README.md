# HorrorStudio Devices

Things you use in first person, their screens your UI. For a Godot 4.7 game built by hand (`tools/godot_byhand.py`
puts it in every new project, enabled). The guide: `guides/laptop/index.html`.

## The laptop

Drag `addons/horrorstudio_devices/laptop/laptop.tscn` onto a desk. With the starter's player, **E** on it and the view
goes in close to its screen: a green terminal (VT323 on black, the code's rain behind) you use with the mouse; **Esc**,
**E** or **LOG OFF** and you're back. A shut laptop (**Lid Open** off) opens first.

Its **Order** tab sells its **Catalog**'s things (`HSShopCatalog`, the plugin's own `shop/catalog.tres` when empty) a
page at a time: **Page Size** cards a page (six), three a row, each category on pages of its own under its name;
`< PREV`, the pages' numbers with the one shown in brackets (`1 [2] 3`) and `NEXT >` under them, the arrow keys and
Page Up/Down too. Each card is its thing's own model (the UI plugin's `HSModelSlot`, the HUD's own slot, in the
terminal's green), its name, price and stock; picked, it's large and turning, its words typed out, how many, the
total, ORDER. An order is paid from the starter's Story node's `cash` (or the laptop's own **Cash** when there's no
Story) and goes into the pocket (`Story.give(id, title, model, count)`), shown in an HSHud's inventory row as its own
model; `batteries` also become the starter flashlight's spares. Too dear or sold out, it says so.

## A thing to sell

One `HSShopItem` file (FileSystem dock, Create New, Resource, HSShopItem): **Id** (the pocket's name for it), **Title**,
**About**, **Price**, **Count**, **Stock** (-1 no end), **Category**, **Model** (any scene: a made prop's .glb), **Model
Turn**. Put it in a catalog's **Items**, or save it in the catalog's **Folder**: every item there is for sale.

**What's for sale**: each thing's **For Sale** (off: not in the shop at all), and a laptop's own **Sells** (only these
ids of its catalog, when it lists any).

**Locked until something's happened**: a thing's **Needs**, in the starter Story's words: `task:find_gun` (that task
done), a fact set (`cellar_open`, `Story.flag("cellar_open")`), `item:key_304` (carried), `!` in front for not, several
apart by commas. Until they hold it's a **?** in the shop: no model, `???`, LOCKED, its **Locked Text** when picked
("FIND THE GUN FIRST."), not to be ordered; with **Show Locked** off it isn't there at all until then. Unlocked, its
card says **NEW** until it's picked or the player logs off. A game without the starter's Story: `$Laptop.unlock("id")`.

## Delivery

Set the laptop's **Deliver To** (a Marker3D on the floor where the parcels go, its -Z toward where you'll come from) and
what's bought comes in a **parcel** instead of straight into the pocket: after **Delivery Secs**, while the player can't
see that place (**When Unseen**), a parcel is left there with what was ordered in it, a **Knock** and the box set down;
the terminal says "ON ITS WAY TO THE FRONT DOOR" (**Deliver Place**). Several orders, several parcels side by side.
**E on a parcel** unboxes it, Minecraft's way: the tape torn, the box jumps, its flaps burst open and it's gone in a
puff of card dust; out of the puff each thing pops up at its own size, turns a moment, then is pulled into you,
shrinking, with a pop, into the pocket as it arrives. Nothing is ever fitted into the box, so a shotgun can come out of
a shoebox. The parcel is `delivery/package.tscn` (`HSPackage`; the laptop's **Package** for your own): put one in a
level by hand with its **Items** and **Counts** (a parcel waiting on the porch); **Keep Box** on and its flaps open
and it stays, empty, the things flying out of it all the same; **Pull** how fast they come, **Copies Max** how many
of one thing you see flying.

## The look

`HSTerminalLook` (the laptop's **Look**): its greens and black, font and size, the rain, the glass's scanlines, glow and
flicker, the boot, the things' models in the green or their own colours. The laptop's own: **System Name**, **User**,
**Home Text**, **Clock**, **Brightness**, **Zoom Fov**, **Fill**, **System Pointer**, **Sounds**.

## Scripts

```gdscript
$Laptop.ordered.connect(func(item, count, total): print(count, " ", item.title))
$Laptop.delivered.connect(func(parcel): print("a parcel at the door"))
$Laptop.unlock("shells")    # a thing opened up by your script
$Laptop.use($Player)        # sit at it            $Laptop.leave()   # back
$Laptop.term.add_tab("MAIL", my_control)            # a tab of your own
$Laptop.term.say("1 NEW MESSAGE.")                  # the status line
$Parcel.taken.connect(func(item, count): print(count, " ", item.title, " in the pocket"))
$Parcel.unboxed.connect(func(items, counts): print("all of it taken"))
```

## Made of

The user's PSX-style laptop and mouse, made real-size and painted by the prop generator (`laptop`, `computer_mouse`:
the `computer` family, docs/PROPGEN.md §32); the parcel is its `parcel` (§34: a corrugated carton whose flaps open,
NIGHT-MART's print, made up; your own print, tape and label in the prop generator's picture editor); the shop's things
are its recipes too (`batteries_aa_2`, `candle_votive`, `pill_bottle`, `water_bottle`, `soda_can`, `burger_box`, made
at 512 px); the sounds made in code (`tools/device_sounds.py`); VT323 (OFL, `fonts/OFL.txt`). Needs the UI plugin
(HSModelSlot) beside it.

The check: `python tools/godot/laptop_check.py` (LAPTOP; `--pictures` the guide's).
