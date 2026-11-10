# HorrorStudio Devices: notes for Claude

The studio's own Godot plugin for things used in first person whose screens are the UI (DECISIONS 2026-11-10, later
still, the user's `laptop`: "when a player interacts with it the camera zooms in on the screen and a usable ui appears
... a order tab, a player can order items with cash they have ... using the existing inventory system where we display
the actual model in the slot that's visible ... make it so its easy to add items ... a preset scene (godot prefab)
object ... the typical green matrix style terminal look"; DECISIONS 2026-11-10, last: a place to deliver to and a
parcel to unbox with E, what's for sale, things unlocked by quests and facts shown as a ? till then, pages not
scrolling). `tools/godot_byhand.py` copies `addons/horrorstudio_devices/`
into every project made by hand and enables it. Needs the UI plugin beside it (`HSModelSlot`, `HSHud`). The export and
the Director's projects don't copy it yet.

## Map

| File | What |
|---|---|
| `laptop/laptop.gd` | `HSLaptop` (@tool, a Node3D; the prefab's root). `_ready`: `_find` (its `Model` child's sockets `socket_*`, the surface whose material ends `_screen`, the lid by its `propgen_part` extras: JSON text, parsed), the screen's sockets reparented under the lid (they ride it), `_make_body` (a StaticBody3D box over its meshes: E's ray finds it), `_make_screen` (a SubViewport the screen's shape, `screen_px` wide, `disable_3d`; an `HSTerminal` in it; the glass's ShaderMaterial on the screen surface with the picture, `_uv_map`: the surface's UVs fitted to the picture's corners over its own vertices by least squares, so it's upright however the model's UVs were laid), `_make_sounds` (`sounds/*.ogg` as AudioStreamPlayer3Ds at `socket_keys`). `_set_lid(k)` (shut 0 to open 1 about the part's axis from its `built`; the glass's `power` with it). `use(by)` / `open_for(p)`: the player's `process_mode` DISABLED, the Story hidden, the HSHud's `modal(true)`, a Camera3D of its own (top level) from the eye, eased in `_process` to `view_transform()` (square to the screen, `fill` of the view at `zoom_fov`, recomputed each frame so it follows the lid opening), `_arrived` (the mouse HIDDEN: the terminal draws its pointer, unless `system_pointer`). `_input` while `using`: every event marked handled; Esc and E (unless `term.typing()`) `leave()`; keys pushed into the SubViewport; mouse events mapped by `_to_screen` (the view's ray onto the glass's plane, `frame()`) and pushed with local coordinates. `leave()` eases back to the eye, `_gone` restores. `_idle`: the screen drawn always while used; asleep a dozen times a second while the camera's within `wake_m` and the screen's in its frustum (`idle_draws` counts them); else not at all. The shop: `items()` (the catalog's things with `for_sale` on, only `sells` when it lists ids, a locked one only when `show_locked`), `unlocked(item)` (no `needs`, `unlock(id)`'s `unlocked_ids`, or the Story's `holds(needs)`), `is_new(item)` (unlocked by its needs and not in `seen`: the order tab marks a picked one; `leave()` marks every id the order tab showed, `shown_ids`), `left_of(item)` (each laptop's `sold`), `cash_now()` (the Story's `cash`, else its own), `place_order(item, n)` (LOCKED refused; `_pay` the Story's `pay` or its own cash; with `deliver_to` a Node3D: into `deliveries` {number, items, counts, due} by `_clock`, `where` its `place_name()`; else the item's `give_to`; `ordered`, `last_order`, `term.log`; returns `where` and `eta`), `eta_text(secs)`. **Delivery**: `_deliver_due()` in `_process` (the spot gone: into the pocket; each due one left unless `when_unseen` and `_seen(spot)`: the current camera's frustum and a ray, the player excluded), `_drop` (the `package` scene, delivery/package.tscn when empty, an HSPackage, its `items`, `counts`, `order_number`; under the spot, side by side along its X then a layer up, turned PI so its front faces the spot's -Z, a few degrees off; `arrive(knock)`; `delivered`). `to_window(screen_pos)` (a check's: where to click) |
| `laptop/laptop.tscn` | the prefab: `Laptop` (HSLaptop) with `Model` (models/laptop.glb) and `Mouse` (models/computer_mouse.glb) beside it. Godot wrote it, with the shop's .tres files (`tools/godot/devices_assets.gd`: a SceneTree script, `PackedScene.pack`, `ResourceSaver.save`) |
| `laptop/screen.gdshader` | the glass: the picture through `uv_to_screen` (a mat3), its glow (eight taps), the rows faded by `fwidth` where they'd be finer than a pixel, a vignette, the flicker; dark glass (`power` 0: off) under an anti-glare coat (`matte` 0.42: a bulb behind you a soft sheen, not a spot over the words) |
| `terminal/terminal.gd` | `HSTerminal` (a Control filling the SubViewport): `setup(laptop, look)` builds it in code: the paper, the rain, the idle name, a MarginContainer of the header (the system's name, a toggle Button a tab in one ButtonGroup, the cash, the clock), the body (the tabs, one visible), the foot (the typed status line, LOG OFF), the boot's label, the `Pointer` (drawn arrow). `wake()` (the boot's lines the first time, `_boot_t` in `_process`), `sleep()`, `set_cash`, `money`, `say` (typed at 70 a second with a blinking `_`), `log`, `pointer(p)`, `add_tab(name, control)`, `show_tab`, `typing()`, `box()` (a square StyleBoxFlat), `_make_theme` (the look's font and size, the Button's five boxes, PanelContainer, the scrollbar). **Every full-rect control uses `set_anchors_and_offsets_preset`** (LESSONS) |
| `terminal/order_tab.gd` | the Order tab, **a page at a time** (the user: "a next page ... prev and next ... [2]"): `refresh()` (`pages` from `laptop.items()`: a new page at each category and when one has `page_size`; the page shown kept), `show_page(i)` (the heading `== CATEGORY ==`, PAGE n OF m, the `Cards` GridContainer of 3, `cards` this page's, `shown_ids`), `_draw_pager()` (`Prev`, `Numbers` (`Page<n>` flat Buttons, the shown one `[n]` disabled in `hot`), `Next`), `page_numbers(n, cur)` (all up to nine, else the first, the last, two each side, -1 a gap), `page_of(id)`, the arrow keys and Page Up/Down (`_unhandled_input`: the laptop pushes keys into the screen); `_card` (a PanelContainer: `slot_of` (HSModelSlot.make, the phosphor shader unless `look.models_in_ink` is off) or `mystery` (a ? where a locked thing's model would be: `???`, LOCKED), the name, price and stock, NEW; hover turns its slot live), `select` (the big live slot or ?, the words or `locked_text` typed out; picked by the player: `seen`), `_step`, `_update` (how many by what's left, the total dimmed when too dear, ORDER disabled when sold out or LOCKED), `order_now` (the laptop's `place_order`; IN YOUR POCKET or ON ITS WAY TO <place>: IN <eta>). **A card's rect is only right a frame after `refresh()`** (containers lay out on the next frame: LESSONS) |
| `terminal/rain.gd` | the rain: columns of glyphs (`look.glyphs`) with their heads and tails, a glyph changing now and then, drawn 12 times a second, `amount` its strength |
| `terminal/look.gd` | `HSTerminalLook`: ink, dim, faint, paper, hot, font (VT323 when empty), text_px, rain, rain_idle, glyphs, scanlines, glow, flicker, boot, models_in_ink |
| `terminal/phosphor.gdshader` | a slot's model in the green: its light lifted (`gain`, a curve) and mapped paper to ink to hot, its outline lit from the alpha's edge, the rows |
| `shop/item.gd`, `shop/catalog.gd` | `HSShopItem` (id, title, about, price, count, stock, category, model, model_turn, max_per_order; For sale: `for_sale`, `needs` (the starter Story's `holds` words), `show_locked`, `locked_text`; `name_of()`, `give_to(tree, n, player)`: into the pocket by the Story's `give(id, title, model copy, n)`, an older Story's `give(id)` n times, batteries the flashlight's `add_spare`), `HSShopCatalog` (store, currency, items, folder; `all_items()`: the list then the folder's, each id once, grouped by category; `scan(dir)` through `ResourceLoader.list_directory`, so an export's remapped files are found) |
| `shop/catalog.tres`, `shop/items/*.tres`, `shop/models/*.glb` | the plugin's own six (NIGHT-MART): batteries, candle, painkillers (stock 2), water, soda, burger (stock 3); their models the prop generator's at 512 px |
| `delivery/package.gd`, `delivery/package.tscn` | `HSPackage` (a Node3D; the parcel prefab: `Model` the parcel glb): `items` (Array[HSShopItem]), `counts`, `take_on_open`, `open_secs`, `say_empty`, sounds; `_find` (the hinge parts by their `propgen_part` extras, in `propgen_parcel`'s `order`; `inside` from `propgen_inside` through the nodes' transforms; `box` the model shut), `_make_body` (a StaticBody3D box: E finds it), `arrive(knock)` (knock, then thud), `use()` (shut: `unbox()`; open with things: `take()`; empty: the Story's `say`), `unbox()` (the tape, the flaps from `LEAD` in turn, the long ones first, each over `open_secs` * 0.55 eased; `_show_goods`: a copy of each thing's model an order, at most four, too tall laid along x, rows and layers in `inside`, shrunk together to fit, moved to the middle of its floor), `take()` (the copies rise 0.24 m and shrink, then `_give`: each item's `give_to`, `is_empty`, `unboxed`). package.tscn written by Godot (`tools/godot/devices_assets.gd --only=package`) |
| `models/` | `laptop.glb`, `computer_mouse.glb`, `parcel.glb` (the prop generator's `laptop`, `computer_mouse`, `parcel` at 1024: copy from `Saved/Props/<name>/` when they're made again) |
| `sounds/` | `tools/device_sounds.py` writes them: blip, tick, key, order, error, boot, wake, sleep, hum (a loop); the parcel's knock, thud, tape, flaps |
| `fonts/` | VT323-Regular.ttf and its OFL.txt |
| `icons/` | laptop.svg, item.svg, catalog.svg, package.svg |

## Rules

- **The terminal is one green** (the user's "typical green matrix style terminal look"): green phosphor on black, a
  pixel font, square frames, the rain; no red even for a refusal (said, with a buzz).
- **The things are shown as their own models**, through the UI plugin's `HSModelSlot` (the HUD's row's own slot), never
  pictures; ordered, the model goes into the pocket with the thing.
- **Adding a thing to sell is a file**: an `HSShopItem` in a catalog's list or its folder. Nothing in the code names
  the plugin's own six (but `batteries`, which the starter flashlight takes as spares, as pickup.gd does).
- **Nothing else hears the input while someone's at it**, and the player's own processing waits (`process_mode`), so any
  player works, not only the starter's.
- **The screen draws only when it can be seen** (always while used; asleep near and in the frustum at 12 a second).
- **The picture is placed by the screen's own geometry and sockets**, never by numbers for this model.
- **A parcel is never seen arriving** (`when_unseen`), and it's the prop generator's (a customizable recipe, PROPGEN
  §34: no one's brand on it); its flaps swing by its own parts' extras, never by numbers for this box.
- **What's for sale and what's locked are the things' own files** (`for_sale`, `needs`) and a laptop's `sells`; a locked
  thing is a ? (never its model or its name) until its needs hold.

## Checking it

`python tools/godot/laptop_check.py [--reuse] [--pictures [--only room,home]] [--keep DIR]` (LAPTOP): a
`godot_byhand.py new` project, the office from `tools/godot/laptop_scene.gd` (a door with the `Doorstep` before it; also
its `main.tscn` to play, delivering there), played headless at 1280 x 720 by `tools/godot/laptop_test.gd`: the parts found
and the picture upright on the glass; E from the starter's player (stopped, the view in at 40 degrees, 92% of the view);
the boot then HOME; a click through the glass on OPEN THE CATALOGUE; two pages of three cards each with its model, NEXT,
the numbers and the arrow keys, a page a thing, twelve pages' numbers; two batteries ordered by clicks (the cash, the
pocket, the flashlight's spares, the HSHud's row with the model, the order's number); too dear; sold out; a thing added
by a file in the catalog's folder; for_sale off, a laptop's sells, a thing needing a task a ? (not to be ordered, hidden
with show_locked off), the task ticked: NEW and ordered; Esc back; drawn asleep near, not far; a $20 note picked up; a
shut laptop opening before the view goes in; E leaving; delivery: two orders on their way, waiting while the doorstep's
seen, two parcels side by side once it isn't, E on one (its flaps at their open angles, the soda inside, then in the
pocket, Empty.), take_on_open off (opened, then taken). `--pictures` (`laptop_shots.gd`, xvfb, 1600 x 900): room, zoom,
boot, home, order, ordered, locked, unlocked, declined, close, pocket, shut, order_tape, sent, parcel_door, parcel_close,
unbox_flaps, unbox, unboxed into `guides/laptop/img/`. Also after a change: GDUI (HSModelSlot is the HUD's), FIRSTGAME
and TUTORIAL2 (the starter's Story and pickup).
