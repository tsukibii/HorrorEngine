# The kit: room things from numbers

Most of what makes a room read as real is rectangles: the gaps between floor boards and tiles, the 3 mm reveals
between cabinet doors, the step where a ceiling drops, the window's frame and sill, the switch plate by the door.
They aren't textures. They're small changes in depth that light falls into, so the bake and Lumen turn them into the
thin dark lines and bright edges your eye expects. The kit makes those things from a handful of numbers, as real
geometry, and the scene builder places them. Complex furniture (a chair with curves, a lamp) is still imported.
Anything made of boxes and cylinders is made here, from presets you change.

- **The kit maker** (`tools/director/kit.html`, the launcher's *Kit maker*): pick a preset, change its numbers, and
  see it beside a 1.62 m person under a raking light. Save your own presets, explode one into free parts, or export a
  .glb.
- **The scene builder** places kit things in rooms, gives every room its floor, hangs fittings on walls and frames
  the windows (docs/SCENE_BUILDER.md §1).
- **The desk** draws them in every view; **the importer** builds them in Unreal as meshes (§5).

## 1. The kit maker

- **Left:** the presets by category (floors, cabinets and built-ins, furniture, on and in the walls, wall fittings,
  ceilings, windows, curtains). The search box filters them. *New from a type* starts from a type's defaults.
- **Middle:** the thing in 3D. Drag to turn it, right-drag to pan, use the wheel to zoom.
  - **Raking light:** a low sun with soft shadows. It's the quickest way to see whether the gaps and bevels are
    deep enough to show.
  - **Person:** 1.62 m tall, for scale.
  - **Size box:** the box the plan and the checks see. Every part stays inside it.
  - **Handles** on the size box: drag a top corner to change width and depth together, the middle of a side for
    one of them, the cone on top for the height. Sizes snap to 1 cm (hold Shift for 1 mm), the thing stays centred
    on its base, and the size shows as you drag. A cabinet re-plans its columns to the new width; free parts scale
    with their box.
- **Right:**
  - The type's numbers. Gaps and bevels are in millimetres; sizes are in metres.
  - Its material slots.
  - Its triangle count.
  - The `kit` text a story prop carries (only what differs from the preset).
- **Catalogue:** every preset rendered once, as a contact sheet. Click one to edit it.
- **Variations:** six other takes on what you're editing, as pictures. Tick what may change:
  - **size:** within about a quarter either way. A sofa grows by its seats; beds come in single, semi-double,
    double and queen.
  - **layout:** a cabinet's columns (doors, pairs, drawers, open shelves, glass, uppers; a void, such as the TV's
    place, stays where it is), a floor's pattern, a window's panes, a curtain's panels.
  - **details:** handles, gaps, bevels, tones, frames, arms, legs, the seed.

  Click one to keep working from it, then *Save as preset* (it offers `<preset>_v<n>`); *More 🎲* rolls six more.
  The same roll always gives the same six (`variations()` in `kit.js`, the rules in its `VARY` table).
- **Save as preset:** writes it into `Content/Studio/Kit/presets.json` (marked yours). The scene builder lists it
  once reloaded.
- **Explode to parts:** turns any thing into a list of free parts, one card each: shape, base position, size,
  material, bevel and turn. Start from the nearest preset, then move, resize, recolour, duplicate or remove single
  boxes. This is how anything boxy gets made: a desk with a drawer, a step stool, a shoe rack, a bath panel.
- **Export .glb:** the mesh for Blender or a hand import. It's in metres, Y up, with the front facing +Z.

## 2. The types

| Type | What | The numbers that matter |
|---|---|---|
| `tiles` | floor or wall tiles: square, rectangular, offset by ½ or ⅓, random lengths, herringbone | tile size, **gap**, **gap varies**, **seed**, gap depth, edge bevel, unevenness (lippage), tones, start (centred on a tile or a joint, or from a corner), runs (0° or 90°), on (floor or wall) |
| `planks` | wood floors: random lengths with staggered joints, half or third offset, herringbone | board width, lengths (min, max), joints at least, then the same as tiles |
| `tatami` | tatami laid in courses so no four corners meet, with their cloth borders (heri) | mat size (Edo 88 × 176, Kyoto 95.5 × 191), heri width, gap, seed |
| `rug` | a rug with a border and a fringe on its short ends | border, fringe length, strands per metre, bevel |
| `cabinet` | frameless built-ins: hinged doors, pairs, drawers, open shelves (dark inside), glass doors, blank panels, voids, an upper part over any column, sliding doors on two tracks, a toe kick, a worktop | **columns** (each: kind, width or auto, shelves or drawers, upper part height and kind), toe kick and its set-back, carcass, front thickness, **gap between fronts**, handles (none, bar, knob, J-pull groove, edge), worktop |
| `buildout` | a false wall in front of the real one, with recesses: a TV niche, a display nook, a tokonoma | recesses (from left, from floor, width, height, depth, shelves) |
| `plate` | switch plates (stacked or side by side), Japanese and Korean/European sockets, panels with a screen (a thermostat, an intercom), blank plates | kind, how many, laid out, margin |
| `panel` | a mirror, a TV, a poster or picture frame (with a mount), a whiteboard, a calendar | face (mirror, screen, paper, white), frame width and material, the slim back of a TV |
| `downlight` | round or square downlights and LED panels: trim ring, recessed lens | shape, trim, lens set in |
| `window` | a window's frame: outer frame, mullions and transoms, sashes (sliding ones overlap on two tracks), glass, the inside sill | panes across and up, frame, mullion, sash, sliding, wall thickness, sill depth and thickness |
| `curtain` | pleated curtains: folds of their own depth, one or two panels, drawn back or closed, a rail | panels, drawn open, fold every, cloth thickness, seed |
| `slats` | a radiator, a convector under a window, a vent grille, a louvre | slats, which way, frame, back plate |
| `table` | tables, desks, low tables, benches, with an apron and a low shelf | top, legs, legs in from the edge, apron, shelf |
| `bed` | a bed or a futon: plinth in shadow, base, mattress, duvet, pillows, headboard | mattress top, base, headboard, pillows, duvet, softness |
| `sofa` | sofas, loveseats, a chaise end: cushions with gaps between them | seats, seat height, arms, back, legs, chaise, softness |
| `cushion` | soft upholstery (§7): a throw pillow (knife edge), a boxed and piped seat cushion, a buttoned floor cushion or pouf, a quilted mattress; standing ones lean on a sofa's back | seam (knife, box, none), filling, pinch, roundness, piping, buttons across × along and their depth, wrinkles, seed, stands up and leans |
| `door` | a door leaf: flush, raised panels, shaker, glass lites, louvres, a shoji's lattice, a sliding slab; hinges on its hinge edge; its mesh turns on them | style, panels across × up, frame width, panel depth, hinges and which side, its **handle** and **frame** (presets of their own), handle height and inset, lining and gaps |
| `handle` | both sides of a door: a lever on a round or square rose or a long plate (with a keyhole), a bar pull, a knob, a short pull, a sliding door's flush cup | kind, rose, keyhole, the door's thickness, which way a lever points |
| `door_frame` | a doorway's lining (sides and head, in the wall's thickness) and the stop the door closes against | lining, stop |
| `bulkhead` | a ceiling step round the room, and the curtain pocket at the window wall | step width per wall, pocket on, pocket width |
| `block` | a single bevelled box: a genkan step (with a nosing), a zabuton, a plinth, a shelf | bevel, nosing |
| `parts` | free parts: anything made of boxes and cylinders | the parts |

The presets cover what's in the two reference photos. The TV wall unit has tall doors, a dark open shelf column and
uppers over the TV, and the ceiling step has its curtain pocket. The large tiles are 600 × 1200 at a ⅓ offset. The
big window has a mullion and a transom. Socket and switch plates are the Japanese and Korean ones. The hall's
floor-to-ceiling sliding wardrobe is there, and so is the vanity with its two big drawers and a mirror. Around
those sit the everyday pieces of a Japanese or Korean flat: tatami, genkan stone, a getabako, an エアコン, a
シーリングライト, a washing machine, a fridge, a futon.

## 3. Gaps, seeds and a bake

The floors take a **gap** (how wide the joints are), then **gap varies** (0 to 1) and a **seed**:
- Each side of each tile or board gets its own share of the gap from the seed, so no two joints are quite alike.
- Every board or tile also gets a random **texture offset**, so the wood grain or marble isn't the same piece
  repeated.
- With **tones** above 1, each board or tile also gets one of up to four material slots (`wood`, `wood_2`...). Give
  them slightly different material instances in Unreal and the floor stops looking like one texture.
- The same seed always gives the same floor; 🎲 rolls a new one.

Under the gaps is a darker base (the grout, or the shadow between boards), set back by the **gap depth**. Each tile
or board has a small **edge bevel**.

What each does in Unreal:
- **The bevels** catch highlights at every lightmap size, because they're in the mesh's normals. A 0.5 to 1 mm bevel
  on boards and 0.5 mm on tiles is what makes a floor read as boards from the player's eye.
- **The gaps** show in a baked lightmap only where a lightmap texel is smaller than the gap. A 4 m floor at
  512 × 512 has 8 mm texels, so a 2 mm joint won't bake dark; it shows through direct shadowing, Lumen and AO
  instead. For baked joints, raise the floor's lightmap resolution (2048 for a big room), or widen the gaps a little
  (3 to 4 mm on tiles) and keep the gap depth. The same holds for cabinet reveals: 3 mm reads at a metre, so keep the
  lightmap resolution of the big built-ins high.
- **Unevenness** (lippage, a fraction of a millimetre) breaks up the reflections across a tiled floor the way real
  ones do.

## 4. In a story

A room prop carries a kit in place of a shape: a preset's name, or an object with what differs (docs/STORY_FORMAT.md
§2).

```json
{"id": "ldk_kt_sofa_3_1", "kit": {"preset": "sofa_3", "seats": 2, "size": [1.6, 0.9, 0.8]}, "at": [5.5, 1.7], "rot": 270}
```

- Its box is its `size` (or the preset's), standing on `at`, its base `z` above the floor.
- `rot` is the way its **front** faces: 0 south, 90 east, 180 north, 270 west. A kit thing's front is its local -y.
- The scene builder writes these props:
  - `<room>_kt_<preset>_<n>`: furniture.
  - `<room>_wf_<n>`: wall fittings.
  - `<room>_fx_floor`, `<room>_fx_ceiling`: the room's floor and ceiling step.
  - `<room>_fx_win<n>`: window frames (`in_wall: true`, `of:` the window).
- Built-ins are drawn with kit presets too: the kitchen run, the shoe cabinet, the vanity, the washing machine.

The checks treat floors, rugs and ceiling steps as surfaces: walked over or under, never bumped. They treat window
frames as part of their wall. Everything else is checked like any prop: overlaps, walls, doorway clearance.

## 5. Into Unreal

`storykit.importer.build(G)` first plans the game and runs `node tools/kit/build.mjs --specs` on every kit mesh it
needs (`python tools/kit_build.py --game G` does the same by hand):
- Every kit prop's mesh is written once to the library as `Content/Studio/Library/meshes/kit/<type>_<hash>.glb`.
  The hash comes from its resolved numbers, so twenty identical switch plates share one mesh, and changing a number
  makes a new one.
- The meshes are generated, so git ignores them; the same numbers always make the same file.
- Each kit prop then gets its mesh at exact size. With no `node` on the PATH it stays a grey block, as before.

Then in Unreal:
1. **Materials:** each mesh has a material slot per kit slot, named `kit_<slot>`: `kit_wood`, `kit_wood_2`,
   `kit_front`, `kit_inner`, `kit_grout`... Make one material instance per slot once, and every kit thing in every
   game uses it. The slot list and colours are `SLOTS` in `kit.js`.
2. **Facing:** check once that a cabinet's handles face the room. If they don't, set `kit_yaw` in
   `Content/Studio/class_map.json` (like `library_yaw` for the CC0 meshes).
3. **Lightmaps:** UV0 is in metres (textures tile at real scale) and offset per board or tile. Let the static mesh
   import generate the lightmap UVs (the default), and raise the lightmap resolution of floors and big built-ins
   (§3).
4. **Draw calls:** a floor is one mesh with a handful of material slots, not hundreds of boards. Merge each room's
   kit things (Merge Actors) once the layout is locked if the draw calls add up.

`node tools/kit/build.mjs --preset tv_wall_unit --out unit.glb` (or `--spec '{...}'`) writes one mesh anywhere. A
door leaf's mesh has its origin on its hinges.

## 6. Files, and adding to it

| File | What |
|---|---|
| `tools/director/kit.js` | the generators, the mesh builder, the material slots, the glb writer. One source for the pages and node; no DOM, no three.js |
| `tools/director/kit3.js` | kit things as three.js objects (the desk, the builder, the kit maker) |
| `tools/director/kit-form.js` | a spec's numbers as a form (the kit maker, the builder's selection panel) |
| `tools/director/kit.html`, `kit-page.js` | the kit maker |
| `Content/Studio/Kit/presets.json` | the presets: a spec each, plus `label`, `cat`, `mount` (floor, back, wall, ceiling, opening, room-floor, room-ceiling) and `z` (its base above the floor) |
| `Content/Python/storykit/kit.py` | the Python side: a spec's preset merged, its size, its mesh ref (the same hash as kit.js) |
| `tools/kit/build.mjs` | the meshes for Unreal |
| `tools/kit/check.mjs` | KIT: every type and preset builds, stays in its box, has no stray numbers and is the same twice; a seed changes the gaps; the glb is well formed; Python and node agree on the refs; every kit prop in every game builds |

A new type is a generator in `kit.js` (parts inside its size box, front at -y), its params in `TYPES`, and a preset or
two. When a generator's output changes, bump `VERSION` in `kit.js` and `version` in `presets.json` together, so the
meshes are made again. Then `node tools/kit/check.mjs` (KIT ok) and `node tools/director/buildertest.js` (BUILDER ok).

## 7. Cushions, mattresses, pillows

Soft things are their own part (`soft`), made the way upholstery is. The filling pushes out against the cover (the
**crown**), and the cover meets a seam:
- **knife:** pinched all round, a throw pillow;
- **box:** a band round the sides, a seat cushion or a mattress;
- **none:** a duvet.

Wrinkles come from the **seed**, strongest near the seams. **Piping** is a real tube along each seam, and **buttons**
pull **tufts** in, in a diamond. Each is a welded mesh with smooth normals, about 1,000 to 3,000 triangles a
cushion (`detail`).
- The sofa's cushions and back cushions are soft now (piped, wrinkled, and buttoned if you ask). So are a bed's
  mattress (quilted if you ask), its duvet and its pillows. Turn *soft* off for the old blocks.
- **Cushions on things:** with *Furniture*, click a cushion onto a sofa, a bed or a table. It lands on the seat, the
  mattress or the top (`on` the thing, at that height), facing the same way. The standing pillows lean on the back.

Nobody on GitHub has an easy procedural cushion to drop in. The best, FurnGen (3ds Max, MIT), describes exactly
this recipe in its own modifiers:
- a ChamferBox;
- a Push that inflates it, "the filling pressing outward";
- Noise for folds;
- TurboSmooth;
- piping as a spline round the seam.

The kit does the same in its own mesh code, so it works in the desk and exports to Unreal. Infinigen (Princeton,
Blender, BSD) has procedural indoor furniture but runs inside Blender; the rest are paid Blender assets. For a hero
close-up, a cloth simulation (Marvelous Designer, Blender cloth) still beats any of them: export the kit's cushion
as a .glb to start from.

## 8. Doors

A doorway's door can come from the kit: `door: {"id": ..., "swing": "in", "kit": {"preset": "door_shaker", "handle":
"bar_pull", "hinge": "right"}}` (the scene builder's door panel writes it; *Doors in every doorway* does them all).
The plan makes three things of it, sized to the doorway:
- **the frame** (`<id>__frame`): the lining and the stop, in the wall, static;
- **the leaf** (`<id>`, the door itself): hinges on its hinge edge, its mesh's origin on their axis, so it turns
  round them. Its front faces the side it opens to; `swing: "out"` turns it round, and a sliding one hangs on the
  room's face;
- **the handle** (`<id>__handle`): both sides of the leaf, its own mesh, attached to the leaf. Change the door's
  `handle` to any handle preset, or swap the mesh in Unreal: it's its own actor.

**In Unreal** (the importer):
- Every part is tagged `door:<id>` and `door_part:frame|leaf|handle`, and sits in the outliner under
  `Story/<room>/doors/<id>`.
- The leaf is tagged `door`, `story:<id>` and `hinge:left|right`. The handle is attached to it.
- **Door functionality, dropped in:**
  - Set `"door": {"class": "/Game/Studio/BP_Door.BP_Door_C"}` in `Content/Studio/class_map.json` for every door, or
    `"class"` on one door for a special one.
  - The importer spawns that Blueprint on the hinge axis as the door (it gets `story:<id>` and `door`) and attaches
    the leaf (with its handle) under it, so whatever the Blueprint turns or slides, the door follows.
  - The Blueprint needs no mesh of its own. A plain rotating actor is enough: turn it about Z, and the leaf turns on
    its hinges.
- Without a Blueprint, the leaf is the door (the StoryRunner turns it, RUNNER_SPEC.md).
- The frame and every other kit thing that doesn't move are **Static**, so they bake. The leaf and handle are
  Movable.
