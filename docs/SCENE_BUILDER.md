# The scene builder

`tools/director/builder.html` (the desk's **Scene builder** button, or `http://127.0.0.1:8780/builder.html`) is
a top-down floor plan of one level: rooms you drag and resize, plus doors, sliding doors, openings and windows. Beside
it is the same level seen from the player's eye at the game's field of view, so you can walk the place before it's
built and feel whether it's to scale. It reads and writes the story's `levels` (docs/STORY_FORMAT.md §2) through the
desk's server. What it saves is what the importer builds, and what the 3D view shows is the importer's own plan
(`storykit.plan`).

Most of a game happens in one home, so the plan has to hold a lot of scenes: places to hide, ways round for a chase,
rooms that can change between chapters. The panel under the 3D view counts what it holds (§5).

## 1. Using it

- **A set** (DECISIONS 2026-10-27, later: "predesign a studio before you make the game in director so you can use that
  as a background reference to place objects"): the place designed before its game exists. The game picker's **Sets**
  group lists them, and **+ new set…** makes one (a name like `studio_apartment`; `python tools/story.py new-set
  <name>` does the same); it opens like a game, with one room to start from or a reference layout, and Save keeps it
  in `Content/Studio/Sets/<name>/story.json` (a small story of its own; `--game set:<name>` for story.py's views).
  `/build-game` builds the writers' room's chart into it (`room.py build --set <name>`: each place on its room, the
  story's things fitted round its furniture), and any game can take a set's level as a start (*layout*: **From a set**).
- **Open:** pick the game and the level, or a **reference layout** (§3). A layout is added as a new level
  (`home_<layout>`); anything it shares with the story's other ids is renamed (`genkan_2`, `<level>_start`), because
  ids are unique across the whole file.
- **Rooms:** click a kind under *Add a room* (Japanese names beside the English). It appears at its usual size, in the
  middle of the view.
  - **Drag** a room to move it; drag its handles to resize.
  - Its edges snap to other rooms' edges within 20 cm, so rooms meet exactly and share their walls.
  - **R** turns it; the arrow keys nudge it; **Del** removes it.
  - **Snap** sets the drag step: 10 cm, 20 cm, half a module or a module.
- **Doors and windows:** pick *Door*, *Sliding door*, *Opening* or *Window*, then click on a wall. Drag one along
  its wall. Select one to set its width, height, sill, swing (into its room or out), lock (`locked_by`) and creak.
- **Floors:** the 1F, 2F and + buttons. A `stairs` room is two storeys tall: the builder fills it with steps from a
  0.85 m landing up to the floor above, in the direction it *climbs*. A door on its wall at the upper floor is the
  top.
- **The selected room:**
  - Its `kind`, `name`, size, height, footsteps (`floor`) and `light`.
  - Its **open sides**, for walls left out: a porch's, a railing side.
  - Whether it has a **ceiling**.
  - Its **built-ins**: a kitchen counter, a bath tub, a toilet, a vanity and washing machine, a shoe cabinet, stairs.
    They are placed clear of every doorway and give a room its real scale from the player's eye. One that can't fit
    clear of the doors is left out.
- **The player** (yellow) is the level's start: drag it, and turn it with its small dot. Their field of view is drawn
  on the plan, cut by the walls at eye height. **Her** (pink) is the first cast member, at her height, for scale. The
  line between you shows the distance and the shot it makes (DIRECTING.md: 2.7 m is a full shot).
- **The 3D view:** click it, then use **WASD** or the arrows to walk (Q and E turn) and drag to look. The built walls
  and props stop you, stairs climb, and the plan follows you upstairs.
  - **Eye:** standing (1.65 m), crouching, sitting or hiding.
  - **Work light:** a lamp on your head, since the rooms are dark until the lighting pass.
  - **Doors open:** the doors as built are closed slabs, so this shows the doorways open.
- **Finish** (left): the **skirting** height (6 cm to start; Japanese homes have 4 to 8), a **cornice** under the
  ceiling (a thin mawaribuchi: try 3 cm), **door casings** round every door and opening (6 cm), a **ceiling light**
  in every room (warm 2700 to 3000 K where people live, 4000 K where they wash and cook) and **its switch by the
  door** (an interactable: the lights go off). They're saved as the level's `trim` and as built-ins, and built by the
  importer as their own thin pieces, so they show in Unreal from the first import.
- **Wall items:** pick *Wall item* and a kind, then click inside a room near the wall it hangs on: a mirror, a poster
  (B2), a picture frame, a 55" TV, a wall air conditioner (エアコン, in every Japanese room), a clock, a calendar, a
  whiteboard, a shelf, a light switch. Real sizes; drag one along its wall; select it to change its size and how high
  it hangs. They're props with a `tag`, so the art pass knows what each is, and built-ins keep clear of the ones that
  hang low. One covering a door or window is flagged under *To fix*.
- **Furniture** (the kit, docs/KIT.md): pick a preset (cabinets and built-ins, furniture, rugs, curtains,
  downlights, wall panels), then click in a room.
  - Things that stand against a wall go to the nearest one, back to it, front to the room. Downlights go on the
    ceiling.
  - Drag one to move it: against a wall it slides along it (hold Alt to pull it free). **R** turns it; the arrows
    nudge it 5 cm.
  - **Resize it by its handles:** a corner changes width and depth, a side's middle one of them. The opposite
    corner or side stays put, so a cabinet against a wall keeps its back there. Sizes snap to 1 cm (Shift: 1 mm).
  - **🎲 Vary** gives it another layout and other details at the same size (another cabinet column layout, other
    handles, other cushions); press again for another, Ctrl+Z to go back.
  - Select one to set its size, height and facing. Its numbers show under the 3D view: columns, drawers, handles,
    gaps, cushions...
  - *Open in the kit maker* edits it there and keeps the result as a preset.
  - The built-ins keep clear of what you place.
- **Doors:** select a door or a sliding door, and pick its **door** from the kit: panels, shaker, flush, glass,
  louvred, a front door with a lock, a sliding door, fusuma, shoji. Then pick which side it's **hinged on** and its
  **handle** (levers, a bar pull, a knob, a flush cup); its other numbers show under the 3D view. *Doors in every
  doorway* (under Finish) does them all. In Unreal each door's leaf turns on its hinges and is tagged as a door
  (docs/KIT.md §8).
- **Cushions:** a cushion or pillow clicked onto a sofa, a bed or a table lands on its seat, mattress or top.
- **Wall fittings:** pick a switch plate, a socket, a thermostat or intercom panel, or a vent, then click near a
  wall. Each sits at its usual height: switches at 1.2 m, Japanese sockets at 25 cm, Korean ones at 30 cm. The
  built-ins' light switches are kit plates too, and so are the wall items (a framed poster, a TV with its slim back,
  an エアコン, a clock).
- **Floors and ceilings:** the selected room's *floor* is a pattern with real gaps: planks, tiles, tatami, stone or
  deck boards. Its gaps, seed and pattern show under the 3D view; *This floor in every <kind>* copies it.
  - The layouts and new rooms start with their kind's floor: planks where people live, tatami in a washitsu, tiles
    in the wet rooms, stone in the genkan.
  - *Floors by room kind* (under Finish) fills any room that has none.
  - Its *ceiling* can step down round the edge, with a curtain pocket at the window wall.
- **Windows:** every window gets a frame (sliding sashes, a fixed big window with a mullion and transom...) with its
  inside sill. Its numbers show under the 3D view. *Add curtains* hangs pleated curtains on a rail in front of it.
  *Frames in every window* (under Finish) frames the ones without.
- **Reference cut-outs:** under *References*, **load a model** (.glb, .gltf or .fbx: the window or door you'll use
  in Unreal; a file in centimetres is read as such). It's measured (width, height, depth) and gets a type (window,
  door, sliding) and a sill; set a **gap** in mm for clearance, or leave 0 for a tight fit. Then *Reference cut-out*
  and click a wall: the hole is that size exactly, its middle snapped to 5 cm. The model shows in the cut in the 3D
  view so you see the fit; it's never saved into the story (you place the real one in Unreal). Change the model's
  size and **Refit cuts** resizes every hole cut with it. The sizes are remembered in this browser.
- **Hinges from a model:** load a hinge under References (a small model, or one named *hinge*, is typed **hinge**;
  set its plate thickness, barrel Ø, where the barrel is and which half is the door's), then *Reference cut-out* and
  click near a door. The door's mortises (the thin pockets in its edge and the jamb) are cut to the hinge's plate,
  and the hinge is split at its barrel: the door's half turns with the door, the frame's half stays (docs/KIT.md §8).
  *Refit* splits and fits it again after a change.
- **Swing:** the *swing* slider (by *doors open*) turns every kit door open on its hinges, its handle and hinge
  halves with it, to check the fit.
- **Measure:** drag anywhere: the length in metres and in modules.
- **Plan image** saves the floor shown as an SVG: a backdrop in Unreal, or a printout.
- **Check** runs the story and level checks (`story_check` on the world, `level_check`) on the unsaved plan. **Save
  to story** writes the level into `story.json` (the previous file goes to `Saved/Story/<Game>/history/`). It warns
  first if a check fails, and if the file changed on disk since you opened it.
- **Undo and redo:** Ctrl+Z and Ctrl+Y.

- **Floor thresholds:** where a doorway joins two rooms with different footsteps (wood to tile at the washroom
  door, the genkan step), a thin strip under the door (1.2 cm to start; *threshold* under Finish, 0 for none).
- **Looks:** the selected room's floor, walls, ceiling and trim from the texture sets (`cc0.py fetch`ed ones and the
  ones the stories already use, and your PBR shelf's), saved as the room's `look`; *Same look for every <kind>*
  copies it to each room of that kind on the level. The **PBR** button (top bar) opens the shelf page (docs/ASSETS.md
  §6: each set on a sphere, a cube, a room corner, a close-up; its maps by name or by hand) in its own tab. Back in
  the builder, what was added or changed there is in the pickers and the walk view without a reload (and so are kit
  presets saved in the kit maker).

An existing level opens with its props. They stay in their rooms in room space, so they move with the room. Scenes
and stitches that name a room id keep working as long as the id does; renaming a room that a scene names asks first.

## 2. The script and the environment, both ways

The builder edits the environment a script plays in, and the desk plays the script in what the builder saved.

- **From the desk:** select a scene or stitch and press **Edit environment (<level>) ↗**. The builder opens on that
  game and level (in its own window, reused), with that node's marks lit.
- **Marks** (the header's checkbox): what the script uses, drawn on the plan. Spots and the start as arrows, the
  things you use (`use:`) as blue diamonds, the story's own lights as circles. The selected node's ids are red.
- **The script on this level** (under the stats): each scene and stitch set on this level. *marks* lights its ids;
  *▶ in the desk* opens the desk on it and plays it in Watch (it offers to save first, so it plays your edits).
- **Saving reloads the desk:** an open desk on the same game reloads the story as soon as the builder saves, so the
  next Watch is in the new rooms. If the desk has unsaved edits it shows its "changed on disk" banner instead; if a
  playthrough is running, it reloads when it ends.
- **Another game's level as a start:** *layout* lists *From another game's script*: every level of the other
  games. It comes in as a new level here: rooms, doors, windows, trim, looks and plain props. What that script uses
  (interactables, spots, people, locks and their keys) stays with it. Ids are renamed against this story's.

Moving or resizing a room carries its props and spots with it (they're in room space). A scene keeps working while
the ids it names exist: the checks say when a save would break one.

## 3. Scale: the squares, the bodies, the eye

- **The grid:** 1 m squares with 20 cm lines. That's reported to be Unreal's prototype grid in the templates (a
  1 m cell split 5 by 5), but it isn't confirmed in Epic's documentation; on the editor's own grid, 100 units is
  1 m. Or switch to the **910 mm module**: Japanese houses are drawn on it, and two modules make a tatami's length.
- **The bodies:**
  - **SOMA**, Kimodo's skeleton (`Content/Studio/soma77.json`), measured: 1.76 m to the top of the head, eyes at
    1.65 m.
  - **The player's eye** in the story format is 1.65 m (§0), the same.
  - **On the plan** a person is drawn at their real size from above: 45 cm across the shoulders.
  - **The 3D view** uses the desk's MHR body at each cast member's height (Mari: 1.62 m).
- **Kimodo's grid:**
  - The Pose window in our patch to its demo draws 0.5 m squares.
  - The size of the demo's own ground grid isn't known yet: measure it against the 1.76 m body there.
  - If a person looks about 1¾ squares tall, the squares are 1 m, the same as here.
- **The lens:** the game's one field of view (`game.fov`, 90° across). The view's vertical angle follows its shape,
  as the desk's Watch view does.

## 4. The reference layouts

| Layout | Size | What it's for |
|---|---|---|
| **1LDK mansion** | 52 m² | One person's flat in a mid-rise block: front door off the open-air walkway, a corridor past the wet rooms, a bedroom with a walk-in closet, the LDK on the balcony side. The most common modern home. No loop: a chase here ends in a dead end. |
| **3LDK mansion** (your reference) | 77 m² | The plan you sent: the entrance in the middle, a corridor down the spine, a Western room and a service room either side, the wet rooms on one side, a Japanese room opening onto the LDK with fusuma. One loop: through the washitsu and the LDK. |
| **Two-storey house, 4LDK** | 142 m² over two floors | A detached house (kodate) on the 910 mm grid. Downstairs: entrance hall, Japanese room, LDK, wet rooms, pantry, an engawa. A stair up from the LDK (the "living-room stair", popular now, and steep as Japanese house stairs are) to a landing, three bedrooms, a study, a second toilet and a balcony. Two loops, eight hiding places: the one to start a whole game in. |
| **Single-storey house round an engawa** | 65 m² (plus verandas) | Your second reference: guest room and living room either side of an entrance passage, kitchen and main bedroom behind, a sunroom, engawa front and back. Sliding doors everywhere, five loops: the best for hide and seek. |

They are drawn from the common Japanese patterns:
- **The mansion's corridor plan** (the 田の字 *ta-no-ji* layout's cousin): a long corridor from the walkway door to
  the living room at the back.
- **The detached house with its stair in the LDK.**
- **The traditional hiraya**, rooms opening into each other round verandas.

Room sizes follow listings: a 6帖 room is about 9.7 m², a unit bath about 1.6 × 1.6 m (a "1616"), corridors 0.9 to
1.1 m, ceilings 2.4 m, a floor-to-floor of 2.85 m.

## 5. What the plan holds

The panel under the 3D view counts:
- **Floor area:** in m² and in 帖, per floor.
- **Rooms and doors.**
- **Ways round:** loops in the door graph. One loop lets a chase circle instead of ending in a dead end; hide and
  seek wants two or more.
- **Hiding places:** closets, oshiire, storage, the bath.
- **Dead ends:** rooms with one way in, good for being cornered.
- **Unreachable rooms.**

A flat has no loops. A house with a hall and an LDK has some. Sliding doors between rooms make many: that's why the
traditional house plays best for chases.

## 6. Under the hood

| File | What |
|---|---|
| `tools/director/builder.html`, `builder.js` | the page: the plan (SVG), the panels, the desk's `Stage` from the player's eye, walking |
| `tools/director/builder-model.js` | the model, without the page: layouts and levels in, story rooms out. Shared walls (the taller, then the larger room builds a wall two rooms share; the other skips that stretch), openings on whichever room builds that wall, links from openings, built-ins and stairs clear of every doorway, the start spot, unique ids, the stats |
| `tools/director/builder-presets.js` | the room kinds (colours, Japanese names, footsteps, sizes, built-ins), the built-ins' sizes, the opening defaults, the reference layouts |
| `tools/director/serve.py` | `POST /api/worldcheck/<level>`: the world checks on an unsaved story; `GET /api/kit`, `PUT /api/kit/preset/<name>`: the kit's presets |
| `tools/director/kit.js` and the rest of the kit | furniture, fittings, floors, ceiling steps, window frames from numbers (docs/KIT.md) |
| `tools/director/buildertest.js` | the test: every layout passes the checks with nothing to fix, walking and walls, adding a room and a door, the finish, wall items, a reference cut-out, saving into a scratch game, a desk open on it reloading after the save, another game's level borrowed, and the desk's deep link with its marks and the script panel. Ends `BUILDER ok`; needs the desk's server running and Playwright |
| `tools/director/app.js` | the desk's side: *Edit environment*, reloading when the builder saves (a `BroadcastChannel`, `horrorstudio-story`), and `index.html?game=&node=&watch=1` to play a node |

The format grew with it (STORY_FORMAT.md §2):
- a `skip` stretch;
- room `kind`, `name` and `dir`;
- door `swing: "slide"`;
- shared walls between rooms whose heights overlap;
- the built-ins' ids;
- the `threshold` trim key.

`plan.py`, `story_check.py` and `level_check.py` read all of it, and `level_check.check()` can be called on a story
in memory.

## 7. From here to Unreal, semi-photoreal, quickly

What the builder now hands over, and what to do with it:
1. **The shell is exact:** walls, holes cut to your window and door models, trim, built-ins at real sizes.
   `storykit.importer.build(G)` makes it all; replace the reference cut-outs' holes with the models themselves (they
   fit by construction).
2. **Trim and built-ins are separate pieces:** give them one material each (painted wood for trim, white laminate for
   built-ins) and they read as finished at once. Many small pieces cost draw calls: merge each room's trim (Merge
   Actors) once the layout is locked.
3. **Wall items carry their tag:** a `mirror` wants a mirror material (Lumen reflections handle a small one; a
   bathroom mirror at the player's face may want a planar reflection), a `tv` an emissive screen, posters and frames
   a texture.
4. **Lights are placed and warm:** a point light per ceiling light at its colour temperature; swap for rect lights
   (LED panels) and bake (GPU Lightmass) or leave them to Lumen.

## 8. The outside: the building round the level, for the street

The user (DECISIONS 2026-10-31): "the map will be a mix of enterable buildings made via our interior tool, and the
non-enterable ones made for the street designer; enhance the interior designer too so we can make roofs etc that will
help match the style of our street designs; ideally I can import an interior designed space into the street, then build
the rest around it". So an enterable building is designed whole here, inside and out, with the street builder's own
generator and styles, and a street takes it as it is.

- **The Outside panel** (left, under Finish): *build its outside* gives the level an outside (`outside` in the level,
  STORY_FORMAT §2). Then:
  - **style**: one of the street builder's ten (house, old wooden house, kiosk, shop building, white tower...): its
    colours and roof. ↻ rolls another of the same style. *(your own)* keeps what you set.
  - **front**: which side faces the street. Automatically its way in: a door named `front`/`entr`/`main`, else one from
    the genkan or a hall, else the first outside door.
  - **walls**: their colour, what they are (`wall`, `plaster`, `concrete`, `wood`, `blocks`...), the trim's colour.
  - **roof**: flat (a parapet), a railing, gable, hip, one slope or bare; its colour, slope, overhang, tiles or sheet.
  - **raised**: how high the floor stands over the ground (a Japanese house's 45 cm), with steps up to each door.
  - **on its walls**: the street builder's fittings (air conditioners, signs, lamps, lanterns, pipes, awnings, canopies,
    eaves, noren, balconies, stairs, panels), each on the front, left, back or right, `x` along the wall from its middle,
    `up` from the ground, its size. No windows or doors here: those are the plan's own, cut through the walls where the
    plan has them.
- **The roof never clips the level**: it is boxed, on a soffit at the walls' top and 1 cm over the level's own walls
  and ceilings, so no wall top shows through it from any side; a gable's ends are flush with its walls. Rooms that
  don't fill a box (an L, a T) get one roof over their outline, joined in valleys (STREET_BUILDER §5c, §5d).
- **In the view**: *Round the building* (the view bar) orbits it from outside (drag, the wheel), lit like a street by
  day; *outside* shows or hides it in either view. The building is the street's own (`SG.outsideBuilding`, the shell,
  roof and fittings a street builds), so what you see here is what the street gets.
- **On the plan**: its walls' outline dashed round the rooms, the roof's edge dotted, and an arrow at its front.
- **Into a street**: the street builder's palette, *Buildings to walk into*, has every set (the motel and the bungalow
  as presets): put it down, then build the street round it. The street's building follows the set's outside (save the
  set, open the street: it's read again) until it's changed in the street, then keeps its own (*Follow the set's
  outside* takes it back). STREET_BUILDER §5c.
- **Godot**: the outside goes to Godot in the street's .glb (STREET_BUILDER §5b), round the marker where the level goes;
  the level's own export doesn't build it.

## 9. Paint: the paint bucket in the rooms

The user (2026-10-31): "am I able to use the paint bucket thing in my interiors, if we haven't hooked up our PBRs can
we". The street paint page's brush (`brush.js`, docs/STREET_PAINT.md §1) on the level, in the 3D view:

- **Paint** (the view bar) opens it under the view: the PBR shelf as pictures by category (the project's `pbr/`, your
  `assets/pbr`, your attached folders: ASSETS §6), a colour, and the brush: a tint, brightness, contrast, saturation,
  hue, a fade, its shine, relief, size and turn, and **layers** over it (another set in patches or by its own mask:
  moss, prints, scuffs; decals scattered over it). The bake's wear layers are the street's (a room has no bake), so
  they're not offered here.
- **A click paints** what's under it: a room's **floor**, its **walls**, its **ceiling** or its **trim** (skirting,
  cornice, casings), a **block** the story owns (its `mat`), a **kit thing's material** (the slot under the click: a
  sofa's fabric, a desk's wood, a fridge's body, its tones with it: the thing's `mats`, STORY_FORMAT §2), or, round
  the building, the **outside's** slot under it. The **fittings the finish makes** take it too (the user: "the
  plastic PBR for light switches"): the switch by the door, the built-ins (the kitchen run, the shoe cabinet, the
  vanity), the stairs' steps, a window's frame; and **doors**: a plain door's slab (its `mat`), a kit door's parts by
  slot (its `mats`: the leaf's front, the handle's metal, the frame's body). *Every one like it* paints every room of
  that kind, or that slot on every thing of the same kit preset (every switch, every door of that kit). A drag still
  looks round, the keys still walk.
- **What a fitting wears is kept** though the finish makes it again on every save: on its entry in the room's props
  (a stub with its id, `<room>_fx_switch`, made when it's first painted, read back with the level), which the export
  copies onto the fitting it makes; a window's frame keeps it on its window, a door on its opening (its door's words).
- **A room's walls are its own side.** A wall between two rooms is one piece, built by one of them; the plan lines the
  other room's side with a 4 mm lining wearing that room's own look (`trim:lining`, plan.py `lining_pieces`) wherever
  the two rooms' looks differ, following the wall's pieces, door holes and all. A click on a wall paints the room its
  face looks into.
- **A kit floor takes the floor's look** (the planks, tiles and tatami a room gets by its kind; the user, 2026-10-31:
  "make the floors take a material"): painting a room's floor paints its kit floor's boards too (the `mats` on its
  `<room>_fx_floor`), and the room's own floor under it, so the strip by the walls and a floor taken out later match.
  When the set paints tiles, boards or mats of its own (pavers, a plank floor, tatami mats), the kit floor is laid out
  by them (KIT.md, *Floors laid out by their set*): each board where the set paints one, its real gaps in the set's
  seams; a set with none (grain, a weave) gives each board its own cut. The status says which once it's planned. A
  click on the gaps (or a tatami's borders) paints only those. A ceiling step takes the ceiling's look on its body.
- **Alt-click picks up** what's on a surface: the brush becomes it and tunes that surface live (*tune …* under the
  brush), every change one undo.
- **What it writes** is the story's own words (STORY_FORMAT §1, §2): `look.floor`, `look.walls`, `look.ceiling`,
  `look.trim`, a block's `mat`, a kit thing's `mats`, the level's `outside.look`: a set's ref, a colour, or a tuned set (a look object). The
  desk's server makes a tuned set into `pbr/_made/<hash>` when it plans, the stage draws it, the Godot export writes
  it (GODOT_EXPORT). The Selected panel's Look pickers show the same, a tuned one as its set and "(tuned)".
- **The ceiling lights are fittings** (the user, 2026-10-31: "we don't need to export actual Godot light sources, I'd
  rather take lights as furniture, rounded LEDs: a circular rim with a glass circle, and those kinds of variations"):
  *a ceiling light in every room* (Finish) puts a round LED on each ceiling, flush under it (or under a ceiling step):
  *its fitting* picks one for every room, or *by the room's size* (a downlight in a small room, a flush 300 in a
  middling one, a dome in a big one). Paint colours its rim; its glass is the light (it glows while it's on, so it isn't
  painted). In Godot no light source comes with it: put your own lights under its node and they follow its switch and
  the power cut (GODOT_EXPORT §3b). An older level's bulbs become fittings when it's opened and saved here.

## 10. A school

The user (2026-11-01): "build out a japanese school for a horror game", with a render and a wireframe of a classroom
they made in Blender, "recreate all the parts to be able to create a 1:1 of the reference images. consider the hallway
and exterior building too". The furniture and fittings are the kit's (KIT §10), the books the prop maker's (PROPGEN
§16), the outside the street builder's; here:

- **Room kinds:** *Classroom* 教室 (7.2 × 9 m, the 4 × 5 ken standard, under a 3 m ceiling), *School corridor* 廊下
  (2.4 m wide), *Staff room* 職員室, *School entrance* 昇降口, *Nurse's office* 保健室, *Library* 図書室, *Gym* 体育館.
  Each starts with its floor (a classroom's basket-weave parquet, a corridor's vinyl tiles), its **ceiling** (rock wool
  boards, a T-bar grid: *Ceilings by room kind* under Finish fills any room without one) and its **ceiling lights**:
  fluorescent troughs by the room's kind, as a **grid filling the room** along its long side, a bay each (a
  classroom's six in two rows, a corridor's row): one light, its fitting the grid (`kit` with `grid` and `size`), so
  the switch, the power cut and a flicker take them all. A light of its own more (a classroom's blackboard lights)
  makes the room's switch the room's: it switches every light in it (`switch` with no `light`).
- **The wainscot** (Finish: *wainscot, cm*; the level's `trim.wainscot`): the kit's boards under their cap rail along
  the foot of every wall, stopping at doors, running under the windows; a room's look takes a *wainscot* of its own,
  and Paint paints it apart from the trim.
- **The layout** *School: a classroom and its corridor (your Blender classroom, 1:1)*: the classroom 7.2 × 9 m, three
  window bays on the west (sliding sashes under a transom, curtains tied back), the chalkboard between two cork boards
  on the north wall over the platform (教壇) and the green lectern (教卓), the teacher's steel desk by the windows, the
  clock and the speaker, 30 desks in six rows of five with their chairs pushed in a little askew, lockers and a back
  board along the back wall, the cleaning locker in the corner, columns between the windows and on the corridor wall,
  beams across under the ceiling and along both long walls, two blackboard lights; the corridor along its east side
  with its frosted windows, two sliding doors with glass in their tops (教室の引き戸), the outer windows, wired glass at
  its ends, a hydrant box, a notice board, a speaker, an umbrella stand. A layout can now carry furniture (`kits`:
  `[room, preset, x, y, rot, {z, size, extra, ...}]`, builder-presets.js `classroomKits` makes a classroom's).
  The set `school_classroom` (Content/Studio/Sets) is it, saved.
- **Props on and in the furniture** (the user: "books should be able to fit well on desks and inside shelves"): the
  kit's furniture says where things go (its *places*: a desk's top and its book box, a chair's seat, every cubby and
  shelf cell, the chalk tray). The **Prop** tool places the prop maker's props (the library's `props/<name>`: the books,
  a diary, a can...): clicked on a desk, a shelf or a cubby, one goes into the place under the click that it fits, else
  onto the thing's top, at that height, turned with it, at the front of a shelf (spines out), `on` it so the checks
  know. The kit's own `on` things (its `books`, a cushion) drop the same way. Selected, a thing on another shows **sits
  on / in**: every place of its host to move it to, and *Fit it in* (a kit row of books takes the place's inside).
  The prop maker's props are kept as `<room>_kt_<name>_<n>` with `shape: "asset props/<name>"`.

- **The classroom in PBR sets** (the user: "create a 1:1 ref using the pbrs instead to see if it helps realism"): the set
  `school_classroom_pbr`, the same level with its walls, ceiling and wainscot (room `look`) and every piece of
  furniture's slots (`mats`) wearing the material library's interior sets (STREET_PAINT §3: the oak parquet, the
  varnished pine, the desks' laminate, the chairs' plywood, the frames, the chalkboard, the cork, the curtains, the
  corridor's vinyl). What it showed (2026-11-01): the sets bring the surfaces close (the parquet's and the wainscot's
  grain, the laminate's sheen, the chalk dust); what's left between the scene builder's view and the user's Blender
  render is the light (low sun through the windows, its bounce, a dark polished floor reflecting them), which is the
  Godot look's (SSR, SSAO, the lights set by hand) or Blender's. `python tools/street.py library <names>` bakes the sets
  on a machine that hasn't them yet.

## 10b. The school building kit: every room at its real size, the building round them

The user (2026-11-01), after the first school: "the school building needs to be to scale, so the actual rooms could fit
in, stairs, door way etc", then two photos of school buildings: "build a kit that could build these 1:1". So a school's
building is its rooms: `schoolBuilding(spec)` in builder-presets.js lays a whole building out of **modules**, columns
side by side along x, each a room at its real size on every storey, and the street builds the outside round exactly
those rooms (STREET_BUILDER §5f). Nothing of the outside is drawn apart from the rooms.

- **Modules** (`SCHOOL_MODULES`): `class` (the 1:1 classroom turned a quarter: its windows on the front, y = 0, the
  chalkboard at its west end, its front door by the chalkboard and its back door on the corridor, its frosted windows
  between them, all its furniture from `classroomKits`), `stair`, `wc`, `entrance` (shoe lockers back to back, glass
  doors onto a porch), `staff` (an island of steel desks, lockers), `nurse`, `library`, `prep`, `room`. A column is
  `[kind, {w, out, win, "<storey>": another kind there}]`: its width (a classroom 9 m, or 8 m for the 8 × 8 module),
  how far a stair tower stands out of the front, its own windows, and what it is on a storey (the ground floor's
  entrance under three storeys of classrooms).
- **Storeys** at a real floor-to-floor (`storey`: 3.6 m a Showa school, 3.9 m a Tokyo high school) under 3 m ceilings
  (`ceiling`), the classrooms `depth` deep, the corridor (`corridor`, 2.4 m) along their back on every storey with its own
  windows behind and wired glass at its ends, a speaker over each classroom's door, notice boards, a hydrant box.
- **Stairs** (`stair` columns): one shaft from the ground through every floor, a dog-leg in each storey
  (`flights: 2`, builder-model.js `doglegProps`): flight A climbs from the floor's landing (where its door onto the
  corridor is) toward the front, a half landing at the front (its window there: a strip of wired glass, or `round`: a
  porthole), flight B comes back to the next floor's landing over the first. The ground storey's flights stand solid;
  every other flight floats on a 15 cm waist (`stairs w run rise waist`), so there's head room over the flight below.
  `penthouse` (m, 0 for none) takes the shafts on up through the roof to a last landing under a penthouse (the stair
  tower of the first photo). A batten light over every floor's door.
- **Windows** by module (`win`: `n` of them `w` wide, `gap` between, `sill`, `h`, a `frame` preset: `window_classroom`,
  `window_ribbon` (a ribbon's sash, 4 to a 8 m classroom), `window_steel` (a Showa school's small panes),
  `window_porthole` and `_bar` (the kit's round window: a ring in a square hole, KIT.md)). Columns stand in the gaps
  wider than 45 cm and the beams over the windows are as deep as the wall over them allows; curtains hang over the
  desks' height and under the beams.
- **Its outside** is the layout's `outside` (the set's, §8): the street's facade dressing (eaves, pilasters, rails),
  the roof, the name on the roof, fittings; STREET_BUILDER §5f.
- **The two photos' buildings** (`SCHOOL_BUILDINGS`): `white` (four storeys at 3.9 m, 8 m classrooms (measured: a bay
  is 2.05 storeys wide), ribbons of four sashes behind guard rails, toilets and a dog-leg at the west end, the stair
  tower standing 1.2 m out at the east end with round windows at the half landings, a penthouse; the entrance, the staff
  room and the nurse's office downstairs) and `showa` (three storeys at 3.6 m, two steel windows to a 9 m classroom
  between the columns, a narrow stair standing out between the two blocks, another at the east end, no penthouse).
  Both are layouts in the picker and sets, `school_white` and `school_showa` (27 rooms each, every classroom furnished).
- **A layout as a set from the command line**: `node tools/director/layoutset.mjs <layout> [<set>]` saves any layout
  through the scene builder's own model as the page would (a set already there keeps all but its level).

## 11. Not done yet

- **Default looks by room kind** (texture sets for a washitsu's walls, a bath's tiles): *Same look for every
  <kind>* does it by hand until the texture sets for them are fetched. The floors' geometry already follows the
  kind (the kit).
- **Doors from the kit:** door leaves with panels and handles. Doors are the runner's (they open), so they stay
  slabs for now.
- **Room shapes:** rectangles only. An L-shaped room is two rooms joined by an opening.
- **Building over a doorway:** a door can't sit on a wall that another room builds, so the builder puts it on the
  room that does.
- **Doors in the 3D view:** they show open or closed, never part-open.
- **Rooms changing with the chapters:** not here yet. The plan is the building; chapter states would be a layer on
  top of it, so the walls stay one set of pieces:
  - in the format, a level's `states: { "<state>": { "props": {...}, "lights": {...}, "openings": {...} } }`:
    props added, moved or taken away, lights off or flickering, doors locked or boarded;
  - a flow node names the state it starts (`state: "ch2_night"`), and the runner swaps the dressing at a seam;
  - in the builder, a *state* picker over the plan: edits go into the state, the plan shows the building under it;
  - in Unreal, the dressing per state as data-layers or sublevels, and a Lighting Scenario each when baked.
  It needs the runner's support first (RUNNER_SPEC.md), so it waits for a game that needs it.
