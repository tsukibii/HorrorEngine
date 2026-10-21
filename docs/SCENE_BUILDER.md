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
- **Reference cut-outs:** under *References*, **load a model** (.glb, .gltf or .fbx: the window or door you'll use
  in Unreal; a file in centimetres is read as such). It's measured (width, height, depth) and gets a type (window,
  door, sliding) and a sill; set a **gap** in mm for clearance, or leave 0 for a tight fit. Then *Reference cut-out*
  and click a wall: the hole is that size exactly, its middle snapped to 5 cm. The model shows in the cut in the 3D
  view so you see the fit; it's never saved into the story (you place the real one in Unreal). Change the model's
  size and **Refit cuts** resizes every hole cut with it. The sizes are remembered in this browser.
- **Measure:** drag anywhere: the length in metres and in modules.
- **Plan image** saves the floor shown as an SVG: a backdrop in Unreal, or a printout.
- **Check** runs the story and level checks (`story_check` on the world, `level_check`) on the unsaved plan. **Save
  to story** writes the level into `story.json` (the previous file goes to `Saved/Story/<Game>/history/`). It warns
  first if a check fails, and if the file changed on disk since you opened it.
- **Undo and redo:** Ctrl+Z and Ctrl+Y.

- **Floor thresholds:** where a doorway joins two rooms with different footsteps (wood to tile at the washroom
  door, the genkan step), a thin strip under the door (1.2 cm to start; *threshold* under Finish, 0 for none).
- **Looks:** the selected room's floor, walls, ceiling and trim from the texture sets (`cc0.py fetch`ed ones and the
  ones the stories already use), saved as the room's `look`; *Same look for every <kind>* copies it to each room of
  that kind on the level.

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
| `tools/director/serve.py` | `POST /api/worldcheck/<level>`: the world checks on an unsaved story |
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

## 8. Not done yet

- **Default looks by room kind** (tatami in a washitsu, tile in the bath): *Same look for every <kind>* does it by
  hand until the texture sets for them are fetched.
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
