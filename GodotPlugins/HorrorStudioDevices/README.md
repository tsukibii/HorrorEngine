# HorrorStudio Devices

Things you use in first person, their screens your UI. For a Godot 4.7 game built by hand (`tools/godot_byhand.py`
puts it in every new project, enabled). The guide: `guides/laptop/index.html`.

## The laptop

Drag `addons/horrorstudio_devices/laptop/laptop.tscn` onto a desk. With the starter's player, **E** on it and the view
goes in close to its screen: a green terminal (VT323 on black, the code's rain behind) you use with the mouse; **Esc**,
**E** or **LOG OFF** and you're back. A shut laptop (**Lid Open** off) opens first.

Its **Order** tab sells its **Catalog**'s things (`HSShopCatalog`, the plugin's own `shop/catalog.tres` when empty):
each a card with its own model (the UI plugin's `HSModelSlot`, the HUD's own slot, in the terminal's green), its name,
price and stock; picked, large and turning, its words typed out, how many, the total, ORDER. An order is paid from the
starter's Story node's `cash` (or the laptop's own **Cash** when there's no Story) and goes into the pocket
(`Story.give(id, title, model, count)`), shown in an HSHud's inventory row as its own model; `batteries` also become the
starter flashlight's spares. Too dear or sold out, it says so.

## A thing to sell

One `HSShopItem` file (FileSystem dock, Create New, Resource, HSShopItem): **Id** (the pocket's name for it), **Title**,
**About**, **Price**, **Count**, **Stock** (-1 no end), **Category**, **Model** (any scene: a made prop's .glb), **Model
Turn**. Put it in a catalog's **Items**, or save it in the catalog's **Folder**: every item there is for sale.

## The look

`HSTerminalLook` (the laptop's **Look**): its greens and black, font and size, the rain, the glass's scanlines, glow and
flicker, the boot, the things' models in the green or their own colours. The laptop's own: **System Name**, **User**,
**Home Text**, **Clock**, **Brightness**, **Zoom Fov**, **Fill**, **System Pointer**, **Sounds**.

## Scripts

```gdscript
$Laptop.ordered.connect(func(item, count, total): print(count, " ", item.title))
$Laptop.use($Player)        # sit at it            $Laptop.leave()   # back
$Laptop.term.add_tab("MAIL", my_control)            # a tab of your own
$Laptop.term.say("1 NEW MESSAGE.")                  # the status line
```

## Made of

The user's PSX-style laptop and mouse, made real-size and painted by the prop generator (`laptop`, `computer_mouse`:
the `computer` family, docs/PROPGEN.md §32); the shop's things are its recipes too (`batteries_aa_2`, `candle_votive`,
`pill_bottle`, `water_bottle`, `soda_can`, `burger_box`, made at 512 px); the sounds made in code
(`tools/device_sounds.py`); VT323 (OFL, `fonts/OFL.txt`). Needs the UI plugin (HSModelSlot) beside it.

The check: `python tools/godot/laptop_check.py` (LAPTOP; `--pictures` the guide's).
