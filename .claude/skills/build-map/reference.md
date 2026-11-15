# build-map: the formats, compact

Metres; x east, y north, z up. Facing: a kit or a street thing at `rot`/`turn` 0 faces **south (−y)**, 90 east,
180 north, 270 west. So a thing against a north wall (a bookshelf, a mirror, a fridge) faces into the room at
`rot` 0, against a south wall at 180 (the hotel floor's first try had them backwards: a bookshelf showing its back). A start's yaw: 0 east, 90 north, 180 west, 270 south.

## 1. The layout file (layoutset.mjs --file; builder-presets.js PRESETS have the same shape)

```
{ "id", "name", "note",
  "floors": [0, 2.85, ...],                     every storey's floor (one storey: [0])
  "rooms":   [[id, kind, name, x0, y0, x1, y1, {z, h, open, fixtures, light, floorKit, dir, flights, stair, landing, extra}]],
  "doors":   [[roomA, roomB, "door"|"slide"|"arch", {at, w, h, swing, id, locked_by, z, extra}]],
  "windows": [[room, "n"|"e"|"s"|"w", "window"|"door", {at, w, h, sill, frame, locked_by, extra}]],
  "items":   [[room, wall, kind, at]],
  "kits":    [[room, preset, x, y, rot, {z, size, extra, ...the preset's own fields}]],
  "finish":  {"wainscot": 0, "skirting": 0.06, "casing": 0.05},
  "start": [x, y, yaw], "her": [x, y, yaw], "herZ": 0,
  "outside": {...}, "repeat": {...} }
```

- **Room options**: `h` ceiling (2.4 a flat's); `open: ["n", ...]` a side left without a wall: between two rooms only
  where **both** list it (an open plan, an L-shaped room), to the outside on its own (a porch); `fixtures: false`
  (no built-ins: you place them as kits); `light`: dim, bright, off; `floorKit: {"preset": ...}` or null; stairs:
  `dir` (the way up), `flights: 2` (a dog-leg), `stair` (the kit's style: house, house_open, apartment, motel,
  steel: KIT.md §11), `landing` (m of landing at the top); `extra`: any level-room field: `look` (§4), `props` (a raw prop:
  `{"id", "shape": "box w d h", "at": [x, y], "rot", "tag", "mat"}`; `{"id": "<room>_fx_floor", "mats": {...}}` dresses
  a fitting the finish makes: `_fx_floor`, `_fx_kitchen`, `_fx_tub`, `_fx_stairs_1a`...).
- **Doors**: `at` 0..1 along the stretch the two rooms share; `swing: "in"` opens into the room that builds the wall
  (the first of the pair that does), `"out"` the other way (a Japanese front door swings out); `locked_by`: an item or
  `"flag:<name>"` (a flag never set: locked for good); `extra`: `{"kit": {"preset": "door_front"}, "mats": {...},
  "peephole": true, "latch": true}`; `z` for a door on an upper landing of a tall room.
- **Windows**: `at` 0..1 along the wall from its west/south end; `sill` from the room's floor; `frame: {"preset":
  "window_big"}`; type `"door"` is a door to the outside (its own id is `<room>_<wall>_door`).
- **Items** (on a wall, `at` 0..1): poster, frame, mirror, tv, ac, clock, calendar, board, shelf, switch.
- **Kits**: x, y from the room's (x0, y0) corner (wall faces are 0.05 in from the lines); `z` over the room's floor;
  ids `<room>_kt_<preset>_<n>`; a thing on another: `{"z": its top, "extra": {"on": "<that id>"}}`; its slots dressed:
  `{"mats": {"wood": "pbr/wood/WoodOak001_2K-JPG", "fabric": "#5f6b73"}}` (on the thing, as the builder's Paint keeps them).
- **Prop generator props** as kits: `[room, "props/<name>", x, y, rot, {z, extra}]` (made and in the library:
  `python tools/propgen.py make <name>`, then `library <name>`), x, y its box's middle, at its size from the index
  (id `<room>_kt_<name>_<n>`). A blanket made for a futon or bed lies on it from its index's `box_m` (PROPGEN §21: its
  box from the support's middle; maison_1f's layout script's `laid`): put it where its box falls, `z` the box's
  lowest, `on` the bed; give the futon or bed `{"pillows": 0, "duvet": 0}`. A curtain made for a window (PROPGEN §22: its
  `window` and `sill`) the same way from the window's middle on the wall's face (x = room width × the window's `at`,
  y = 0.05), turned 180 on a south wall, `z` its box's lowest; curtains are hollow (no collider, no LEVEL overlap).
- **Stairs**: a shaft as one room from the ground to the top floor + its ceiling (`h`); a dog-leg needs ≥ 1.82 across
  and about 4.6 along `dir` (a run of 1.9 m for a 2.85 m storey); `dir: "s"`: each floor's landing at the north end,
  the first flight up the east half. One flight: the floor above ≤ its `z + h − 1.9`.
- **`repeat`** (storeys alike): `{"floors": [2.85, ...], "rooms": [ids], "add": {"rooms": [...], "doors": [...],
  "windows": [...]}, "bare": true}`: each named room copied to each floor as `<id>_{n}f` with the doors between them
  and their windows; `{n}` (2, 3...) in `add`'s words; bare: no kits, items, fittings or kit floors, lights off.
- **`outside`** (the street builds it round the set): `{"look": {"wall", "trim", "roof_flat", "plinth", "rail",
  "frame", "glass", "tiles"}, "roof": {"kind": "flat"|"rail"|"gable"|"hip"|"shed", "parapet", "pitch", "over",
  "rail": true}, "raise": 0.45, "front": "e", "facade": {"rails": {"h": 1.1, "out": 0.14}}, "parts": [{"kind",
  "face": "front"|"back"|"left"|"right", "x" (from the face's middle, + to the right seen from outside), "z", "w", "h",
  "out", "floors": [2, 4], "text", "fg", "bg", "lit", "slot"}]}`; parts: canopy, sign, lamp, pipe, ac, balcony, block,
  panel, rail, eave, bay, stairs, noren, clock.

## 2. Room kinds (their own fixtures; their kit floor)

genkan (shoe cabinet; stone_450), corridor, ldk (kitchen run), living, dining, kitchen (kitchen run), washitsu
(tatami), bedroom, service, kids, study, bath (tub; tile_300), washroom (vanity, washer), toilet (toilet), closet,
walkin, oshiire, storage (none of these four get a ceiling light), stairs, balcony (no ceiling, 1.1 high), engawa,
common (no kit floor: give it a `look.floor`), garden, garage, other; school: classroom, hallway, staffroom, entrance,
nurse, library, gym. Wood rooms get oak_planks: paint them with a wood floor set (`"props": [{"id": "<room>_fx_floor",
"mats": {"wood": "pbr/floor/FlooringOak001_2K-JPG"}}]` in the room's extra), the kit's boards then laid where the set's are.

## 3. Kit presets (`node -e` on kit.js's resolve for a size; KIT checks them)

- Bedding (the prop generator's, `props/`): makura_sobakawa, pillow_bed, zabuton_real, kakebuton_turned (on a
  futon), comforter_bed (on bed_single), futon_folded (0.55 x 0.82: an oshiire's).
- Japanese home: futon, tatami, tatami_kyo, low_table (chabudai), zabuton, floor_cushion, tokonoma (a raised alcove:
  `holes` its recess), fusuma and shoji (as a slide door's `kit`), genkan_step, shoe_cabinet, sliding_wardrobe,
  a living room's: low_table on rug_plain with zabuton; tea: kyusu, yunomi, tetsubin, donabe, rice_cooker,
  hob_gas_konro, kettle_whistling; koro, incense_stick, kayari_buta.
- Rooms: bed_single, bed_double, desk, dining_table, dining_chair, sofa_3, loveseat, bookshelf, tv_board, tv_55,
  floor_lamp, plant_pot (a pot), rug, rug_plain, runner, bath_mat, curtain_blackout, curtain_sheer (`open` 0..1),
  kitchen_run, kitchen_upper, fridge, washing_machine, vanity_drawers, vanity_mirror, air_conditioner, wall_clock.
- Doors: door_front, door_flush, door_panels, door_glass, door_slide, fusuma, shoji, door_school, gate_bars (a barred
  steel gate); windows: window_slide (the default), window_big, window_small, window_fixed, window_wired.
- Common parts: school_lockers_doors (`grid` [2, 2]: a bank of mailboxes), umbrella_stand, tube_batten (a light:
  `extra: {"use": "light", "kind": "bulb", "lit": true, "lumens": 700}`), whiteboard, corkboard.
- Slots to dress (`mats`): wood, fabric, body, front, counter, metal, steel_paint, frame, glass, tatami, stone, tile.

## 4. PBR sets in git (`pbr/<category>/<set>`; a look takes a ref, a `#colour` or `{"set", "tint", "tint_amount"}`)

wall/Plaster001_1K-PNG (white plaster); floor/Tatami001_1K-PNG (weave), Tatami004_1K-PNG (mats); concrete/Concrete006
(smooth light), 010 (30 cm pavers), 012 (beige), 027 (board-formed), 029 (streaked grey), 032 (stained), 044D (pitted),
021, 022 (patchy); metal/Metal063_1K-PNG (painted, rusting); plastic/white_plastic (a unit bath); building/Paint005
(dark teal paint), Bamboo001C; road/Road012A, Road013A (dark), Road010C (patched, yellow edges); asphalt/Asphalt025C;
gravel/Gravel006, 024; roofing_tiles/RoofingTiles010 (kawara with moss), 001-004 (slate), 006 (terracotta squares),
013A/B, 014C; bark/Bark001, 006, 014; foliage/Moss002, vine_*; ours, made by `tools/woodpbr.py` (2K, ASSETS §6):
floor/FlooringOak001_2K-JPG (light natural oak sheet flooring), FlooringOak002 (stained medium), FlooringBirch001;
wood/WoodOak001_2K-JPG, WoodWalnut001_2K-JPG (glued furniture panels: a kit thing's `wood`, `body` or `front`, a
prop generator table's or chair's `"pbr": {"wood": ...}`).

## 5. What the checks say, usually

- `X and Y overlap by N cm`: move one; a thing resting on another needs `extra.on`. Curtains: window frames stand
  0.17 into the room, so a curtain's centre ≥ 0.25 off the wall line (a sheer 0.22).
- `X blocks <door> (N cm into the 0.8 m clearance)`: nothing in the 0.8 m in front of a door, or of a window with a
  sill ≤ 0.3 and 1.8 tall (raise its sill to 0.35 if it's a window); the zone passes through a closet shallower than
  0.8 into the room behind it.
- `pokes out of <room>`, `is N cm into a wall`: inside the room's wall faces (0.05 in).
- `<door>: walled up by <piece>` / `a wall piece of no width` / `faces in one plane`: a builder bug: fix plan.py
  (storykit), not the layout, and compare every set's walls before and after.
- `nowhere to stand within 1.2 m`: a switch or thing boxed in by furniture.
- STREET `wire and wire in one plane`: a pole's `turn` so its arms cross the road; `X and Y in one plane`: things side
  by side (offset one 0.3 m across).

## 6. The street file

```
{ "format": 1, "name", "about", "time": "day"|"dusk"|"night",
  "look": {"asphalt", "pavement", "kerb", "concrete", "blocks", "ground", "bark", "foliage", ...: ref or #colour},
  "roads": [{"id", "from": [x, y], "via": [[x, y], ...], "to", "width": 6, "walks": [left, right] (left walking
             from → to), "kerb": 0.15, "edge": [0.4, 0.4], "centre": "none"|"dashed"|"solid", "marks": [...]}],
  "buildings": [{"id", "style", "at": [cx, cy], "turn", "w", "d", "floors", "gh", "fh", "seed", "look",
                 "faces": {"front"|"left"|"right"|"back": {"win", "cols", "ww", "wh", "sill", "ground", "door", "lit"}},
                 "roof": {...}, "parts": [...], "tiers": [{"floors", "inset": [front, right, back, left], "edge":
                 "rail"|"wall"}]}],
  "fences": [{"id", "kind", "from", "to", "via" (curved), "h", "slot", "look", "open"}],
  "things": [{"id", "kind", "at", "turn", "h", "w", "seed", "to" (a pole's wires), "lift" (up onto a balcony),
              "prop" (a tree's real one: "props/zelkova_real")}],
  "shots":  [{"id", "name", "eye": [x, y, z], "look": [x, y, z], "vfov": 62, "aspect": [16, 9]}] }
```

- Styles (whole buildings): shop, pencil, office, tower, apartment, house, machiya, danchi, school, gym, kiosk,
  shotengai; windows `win`: punched, band, glass, tall, small, pairs, fins, lattice, shutters, none; `ground`: same,
  shop, shutter, door, glass, open, lattice, wall. A building at `turn` 0 faces south; its `at` is its middle.
- Fences: mesh, wood, panel, block (a wall with its cap: `slot: "concrete"` for poured), blockmesh, rail, bamboo,
  slats, gate, accordion, chain, ribbed, slidegate; `via` bends one through its points (mitred 2 m segments).
- Things: lamp, lantern, postlamp, pole, vending, postbox, bollard, bike, sign, mirror (the bend's orange mirror),
  cone, barrier, manhole, drain, car, person, bench, bin, crates, pot, ac, box, tree (a stand-in: `h`, `w`; its
  `prop` the realistic one in its place: `python tools/propgen.py make zelkova_real` then `propgen.py library
  zelkova_real`, about 25 s a tree; the `*_real` recipes: zelkova (and autumn), cherry, camphor, plane, maple_autumn,
  crape_myrtle, black_pine, cedar, shrub, small_hornbeam; Blender's module: `python tools/retarget.py setup`).
- A bend: centre C and radius R: the road's points C + R(cos θ, sin θ) every 15°; its walks R ± (width/2 + walk); a
  wall along it at R + width/2 + walk + 0.175; trees down a walk's middle; poles at the kerb, `turn` = θ.

## 7. Rules that keep the animations working (docs/ANIMATION_RULES.md: read it; `python tools/anim_rules.py check`)

A character doesn't collide with furniture and doesn't see the room: the model is where her clips expect it.

- **Seats** (sofa_3, loveseat, dining_chair, bench, school_chair; `props/` chairs): seat 0.40 to 0.50 m (works 0.33
  to 0.57); **0.35 m of clear floor in front of the seat's edge**; a chair she sits down on is 0.35 m from the table;
  0.55 m behind the edge before a back (a dining chair is 0.42 deep: its marker goes 0.10 m in front of its edge);
  0.70 m wide. Not seats: zabuton, floor_cushion, zaisu, futon, low_table, the bar stool.
- **Beds** (bed_single, bed_double): mattress 0.50; **one long side free with 0.35 m of floor**; 0.95 m deep from
  that side, 1.95 m long; nothing but a flat duvet and a pillow under 0.12 m on it. A futon needs a character baked
  for it.
- **Doors**: handle 0.95 to 1.05 m (the kit's: 0.95; works 0.90 to 1.25); 0.80 by 2.00 m to walk through; **0.45 m
  of clear, level floor in front on the side a character opens it from**; pushed from the side its hinges are on
  her left, pulled from the side they're on her right (right hand); `swing` accordingly.
- **Things a character takes**: within 0.30 m of the edge of what they're on, standing room in front; on the floor
  to 0.3 m, on a counter at 0.8 to 1.0 m, or on a shelf at 1.3 to 1.6 m (the rules' last table says what's in between).
- **Ways**: 0.75 m between pieces of furniture where a character walks (0.90 where it can be); nothing under 1.0 m
  high across her way (she'd walk on top of it); ceilings 2.1 m.
- **Where a character stands, waits or sits** (she may be given small movements: a scratch, a stretch): 0.50 m free
  to each side and in front of her from her waist up, nothing lower than 2.3 m over her (a shelf, a lamp, a bunk).
  Where she stops facing something with a thing in her hand (a counter, a door): 0.45 m from it.
- **Stairs**: risers 0.20 m or less where characters use them (apartment, motel); level floor wherever a character
  sits, lies, opens, takes, peeks or fights.
- **Streets**: pavements 1.2 m clear; a door's landing 0.6 m deep and level; a bench as a seat; entrance steps 0.20 m
  a riser.
- **Short and tall**: children, goblins and imps use the same furniture; a handle at 0.90 to 1.15 m suits a child
  and a person; a ghoul wants doors 2.05 m high, an ogre a doorway 1.7 by 2.8 m.
