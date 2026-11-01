# The street builder

`tools/director/street.html` (the dashboard's **Street builder** tile, or `http://127.0.0.1:8780/street.html`, the
desk's server) makes the outside world: streets, the outsides of buildings, lamps, poles and wires, fences and the
clutter of a lived-in street. It's the map the enterable buildings go into: those are made in the scene builder
(docs/SCENE_BUILDER.md) as floor plans; here a building is only its outside, low poly and quick, for the look of the
place. The user's words (DECISIONS 2026-10-30, night): "aesthetic but low-poly buildings and streets... very simple to
use like our existing tools (easy to add protrusions, windows, doors, roofs)... paste in a front and side view
reference... even a layman can use it"; "the overall maps should feel tight and filled so the player doesn't feel
isolated but cozy, even in horror games"; fences of every kind, lamps and street things "easy to apply PBR to but low
poly".

A street is a file, `Content/Studio/Streets/<name>/street.json` (§4): text is the truth. `street-gen.js` builds it
(plain JS: the page and node share it), `street3.js` draws it, `street-presets.js` holds the building styles.

## 1. Using it

The page has the **palette** (left), the **map** or the **facade** (middle), and the **3D view** with the
**inspector** under it (right). Nothing needs numbers typed; every number is there to type if you want it.

- **A street**: pick *Street*, *Lane* (one way, a white line for walkers), *Alley*, *Wide road* or *Old town road*,
  then drag on the map from one end to the other (a click makes one 30 m long). Drag its ends to move them (they snap
  to other streets' ends and onto another street's middle, taking its height there; Shift keeps it square), the yellow
  square on its side to widen it. **Curves**: drag the small dot in the middle of a street (or between two of its
  points) and it bends there, a smooth curve through its points; drag a bend about, double-click it to take it out.
  **Slopes**: in the inspector's *Heights*, each point's height (or *it rises* so many metres from start to end, or
  *Level it*); the street climbs smoothly between them, and the ground beside it, the buildings, the things and the
  fences follow (a building on a slope stands at its front's ground and is carried down to the lowest ground under it
  by a plinth). In the inspector: the
  pavements each side, the kerb, the white lines, the middle line, the surface, and the **marks**: 止まれ, a stop line,
  a zebra crossing, the ◇ of a crossing ahead, an arrow, a line, each at its distance along the street.
- **Fill a street** (the one-click way to a street that feels lived in): click a street, pick what kind of place it
  is (*City lane*, *Shopping street*, *Quiet houses*, *Old post town*, *Abandoned blocks*), then **Fill it all**:
  buildings shoulder to shoulder down both sides (each a style of that place, facing the street, skipping where
  there's already something), lamps along both kerbs (lanterns on a shopping street), utility poles down one side with
  their wires, and the clutter: bikes, vending machines, pots, crates, AC units, bins. The four buttons above it do
  each part alone. Fill again on another street; Undo takes a fill back whole.
- **A building**: pick a style (§3) and click on the map. It turns to face the nearest street and stands on its
  pavement's back edge; dragged along the street it snaps to the next building's side, so a row has no gaps (Alt
  drags it freely). Drag its corners to size it, the blue dot to turn it (15° steps, Shift free); R turns it 90°.
  In the inspector: its size, its floors (the ground floor's height and the others'), the front's windows (§2) and
  ground floor, the sides' and the back's windows (a side against a neighbour is usually blank), the roof, setbacks
  (floors set back on top), and its materials. *New one* rolls a new building of the style in its place.
- **The facade** (double-click a building, or the Facade tab): its front and a side, flat on, side by side. **Drag
  its roof** up or down for floors, **its right edge** for its width (or depth on a side). **Click a floor** to give
  that floor windows of its own. **Add** (the bar above): pick a part, click on the wall. Openings are cut into the
  wall (a window, a door, a shop front, a shutter, glass blocks, a dark opening, a lattice window); the rest stand on
  it (a box sticking out, a balcony, a sign board, a blade sign, an awning, a canopy slab, an eave, an AC unit, a
  pipe, a wall lamp, a hanging lantern, outside stairs, a small box, a panel, a railing, a noren curtain). Drag a part
  to move it, its corners to size it; *on every floor* repeats it up the building (balconies, boxes, AC units).
- **A photo behind a side** (the reference): with the pointer over the front or the side panel, press **Ctrl+V** (or
  *Paste photo*, *Load…*, or drop the file on it). It goes behind the building, see-through as much as *see* says,
  *on top* to trace over it. *Move photo*: drag it, drag its corner to size it, until the building's outline sits on
  the photo's; *Fit* sizes it to the building's width. The photos are kept beside the street (`refs/`, git-ignored:
  most aren't ours).
- **Things**: lamps (a street lamp, the shopping street's lanterns, a post lamp, globes), utility poles (*wires to*
  another pole in the inspector), vending machines, post boxes, bollards, bicycles, road signs (止まれ, one way,
  straight on, no entry, 30, walkers, school, no parking), traffic mirrors, cones, barriers, manholes, drains, cars,
  benches, bins, crates, pots, AC units, a plain block of any size, and a person (a stand-in for scale and a shot's
  composition). Click on the map; lamps, poles and signs snap to the kerb, machines, bikes and pots to the building
  line, each turned to the street.
- **Fences and walls**: wire mesh, wooden boards, the long metal panels round a building site, a block wall, a block
  wall with mesh on it, a pipe railing, bamboo, wooden slats. Drag on the map from end to end.
- **The 3D view**: drag to orbit, right-drag to pan, the wheel to zoom; click a thing to pick it. **Walk** (the View
  menu, or double-click the street) puts you at the player's eye, 1.65 m, WASD or the arrows, Shift runs, drag to
  look; the map shows where you are.
- **Shots and matching a photo**: **+ Shot** keeps the view as a shot (`shots`). Look through it (the View menu),
  **Photo…** or Ctrl+V puts a photo over it, *see* sets how much of the photo shows, and with **adjust** ticked:
  drag to turn the shot, WASD to move it, Q and E down and up, the wheel for the lens. Then build until the street
  sits on the photo. The frame takes the photo's shape.
- **Time**: day, dusk (the blue hour) or night: the sky, the light, the lit windows, signs and lamps.
- **Keys**: Del removes, R turns, Ctrl+D copies, the arrows nudge (Shift a metre), Ctrl+Z / Ctrl+Y, Ctrl+S saves,
  Esc stops placing. **Export .glb** downloads the street (a node a piece, a material a surface) for Godot or Blender.

## 2. Windows and ground floors

A face's windows, floor by floor (`win`): *windows* (punched, `cols` a floor, `ww` × `wh`, `sill`), *a band of
glass*, *all glass* (a curtain wall), *tall windows*, *small windows*, *windows in pairs*, *fins* (vertical fins,
no windows: a shop's blank upper floors), *wooden lattice*, *shuttered windows* (storm shutters down), *blank wall*.
The ground floor (`ground`): *as the floors above*, *a shop front* (glazed, lit, a door in it), *shutters* (a
roll-down shutter a bay, its box over it), *a door and a window*, *a glass lobby*, *open* (parking, a passage), *a
wooden lattice front* (the old town), *blank wall*. Each window is a hole in the wall with its reveals (the wall's
thickness), a frame and the glass; which ones are lit at dusk is the face's `lit` share, rolled from the building's
seed (*Shuffle lights*); `cool` is the share lit cold (offices) rather than warm.

## 3. The building styles

After the user's reference pictures (2026-10-30): each makes a whole building from a seed, written into the building
(so changing a style later never changes the buildings made with it).

| Style | After | What it makes |
|---|---|---|
| Shop building | the Shibuya lane | 4 to 8 floors, a lit shop front, a fascia sign, a blade sign, floor bands, a railing and a tank on the roof |
| Pencil building | the narrow one on the Shibuya lane | 3.4 to 5 m wide, 6 to 9 floors, a box sticking out on every floor |
| Glass office | the city | bands of glass, a lit lobby, cool light, a stair hut |
| White tower | the white tower with its glass-block stairwell | white, small windows, a strip of glass blocks, big windows high up, a hut, an antenna, a tank |
| Apartment block | the city's flats | balconies the length of every floor (solid or bars), AC units on them, a lit entrance |
| House | the quiet residential street | two storeys of stucco, a door with a little canopy, windows (some shuttered), a fire box and a meter on the wall |
| Old wooden house | the old post town at dusk | dark timber, a lattice front, a tiled eave between the floors, a deep gable roof, a lantern, a noren |
| Concrete block | the abandoned concrete flats | long and low, shutters, a heavy canopy, pipes, a stair up the side; mostly dark |
| Kiosk / shed | the hut on the Shibuya lane | one storey, a hip roof, a door, a meter box |
| Shopping-street shop | the shopping street under the mountain | two or three floors, a shop or a shutter, an awning or a canopy, a big sign board |
| School building (校舎) | a small Japanese school (2026-11-01) | two or three storeys, a big window a 3 m bay on every floor, the corridor's windows along the back, floor bands, a flat roof with its fence, a water tank and a stair hut; the middle bay stood out as a tower with a clock on it; the entrance at one end under a canopy |
| School gym (体育館) | a small Japanese school | one tall hall under a low gable, a band of high windows along each side, doors at one end |

The mixes (*Fill a street*) are in `street-presets.js` (`MIXES`, and `EDGES`: each place's lamp, how far apart, poles or
not, its clutter).

**A clock** (a part, `clock`: a white face in a dark rim, its hours marked and its hands at ten past ten, each hand in a
plane of its own) goes on any face; on a box's front (the school's tower) give it an `out` past the box's.

**The school street** (`Content/Studio/Streets/school`, the user, 2026-11-01: "consider the hallway and exterior building
too (a small japanese school)"): the road past it with a school-zone crossing, a low block wall with a mesh fence along
it and the gate half open between two posts, the yard, the three-storey classroom building and the gym to the west.
Since "the school building needs to be to scale" (the same day) the classroom building is the school kit's set
`school_showa` walked into (every room at its real size on every storey, §5f), no longer a style's box and a stacked
wing. Shots: the school through its gate, the building from the yard, its east end. (A stacked set shaped like an L
still puts its floor bands on east- and west-facing faces a GAP lower, so two meeting at an inner corner are never in
one plane.)

## 4. The format (`street.json`)

Metres; x east, y north, z up (the story's space). A piece is made in its own space, its front toward its own -y,
turned by `turn` (degrees, anticlockwise) and set down at `at` (its middle); a road and a fence run from `from` to
`to`. Ids are unique in the street.

```
{ "format": 1, "name": "shibuya_lane", "about": "...", "time": "dusk",
  "look": {"asphalt": "#2d3034", "wall": "pbr/concrete_03"},                 a slot: a colour or a PBR set, everywhere
  "roads": [{"id", "from": [x, y], "to": [x, y], "via": [[x, y], ...] (bends: a smooth curve through them),
             "z": a height, one a point (from, the bends, to), or [at from, at to],
             "width": 6 (kerb to kerb), "walks": [left, right] (m, 0 none),
             "kerb": 0.15, "edge": [left, right] (a white line that far in from each edge, 0 none),
             "centre": "none|dashed|solid|yellow", "surface", "walk",
             "marks": [{"kind": "stop|text|zebra|diamond|arrow|line", "at": m from `from`, "x": m across (+ right),
                        "w", "len", "text", "gap"}]}],
  "buildings": [{"id", "style", "at", "turn", "w" (its front), "d", "floors", "gh" (the ground floor), "fh", "seed",
                 "look": {slot: colour or pbr/...}, 
                 "faces": {"front|right|back|left": {"win", "cols", "ww", "wh", "sill", "ground", "door" (0..1 across),
                           "bands", "lit", "cool", "groundSlot", "pitch", "fin", "floors": {"3": {"win": "band"}}}},
                 "roof": {"kind": "flat|rail|gable|hip|shed|none", "parapet", "pitch", "over", "ridge": "x|y",
                          "things": [{"kind": "tank|ac|antenna|hut|billboard|mast", "x", "y", "text"}]},
                 "tiers": [{"floors", "inset": [front, right, back, left]}],
                 "parts": [{"kind" (PART_KINDS), "face", "x" (from the face's middle), "z", "w", "h", "out",
                            "floors": [from, to], "text", "fg", "bg", "dir": "h|v|r", "lit", "slot", "in", ...}],
                 "refs": {"front|right|back|left": {"file": "refs/<name>", "x", "z", "w", "op", "top"}}}],
  "things": [{"id", "kind" (THING_KINDS), "at", "turn", "lift" (above what's under it), "h", "slot", "look", "to" (a pole's next pole), ...}],
  "fences": [{"id", "kind" (FENCE_KINDS), "from", "to", "h", "step", "look"}],
  "shots": [{"id", "name", "eye": [x, y, z], "look": [x, y, z], "vfov" (degrees tall), "aspect": [w, h],
             "ref": "refs/<photo>", "op", "pins": [{"name", "px": [0..1, 0..1], "at": [x, y, z]}]}] }
```

`pins` say where a point of the street is in the shot's photo: the check (§6) holds the shot to them.

**The ground** is the roads' to say: on a road its height, on a pavement its top, between the roads a blend of the
roads beside (the lots at their road's height). A building stands at the ground just inside its front (or its own
`z`), things and fence posts on whatever is under them (`terrain` and `footing` in street-gen.js). A flat street's
ground is one quad; a sloped one's a grid (`cell`, 3 m) following the roads.
`python tools/street.py show <name>` reads a street as text.

## 5. Materials, PBR and low poly

Every surface is a **slot** (`SLOTS` in `street-gen.js`: walls, trim, frames, glass, the lit glass, shutters, roof
tiles, asphalt, paving, kerbs, chain-link, boards, panels, blocks, bamboo, posts, steel...), a material each. A slot is
a flat colour, a pattern made in code (a shutter's ribs, roof tiles, paving, glass blocks, a fan's grille, hazard
stripes, ribbed panels, a block wall), or a cut-out (chain-link, boards with gaps, a lattice, bamboo, bars, a grate: a
single quad each, the pattern in its alpha). In the inspector's Materials, or the street's *Surfaces everywhere*, any
slot takes a colour or **a set from the PBR shelf** (`assets/pbr`): every UV is in metres, laid square on each face,
so a set keeps its real size (`tile_m`) on anything; a cut-out keeps its cut with a set on it. The geometry is boxes,
quads and 6 to 10-sided cylinders: a building is about a thousand triangles, a street of forty a hundred thousand or
so. **Big streets**: the street is drawn in chunks (48 m squares), each merged into one mesh a material, a building's
own colours riding on its vertices, so ninety buildings and two hundred things are about 450 draws (they were 1,700),
each chunk culled whole out of view; a piece is built again only when its own numbers (or the ground under it) change,
a chunk merged again only when one of its pieces did (moving a building on that street: about 50 ms on the cloud's
CPU drawing). The look is flat-shaded at dusk by default: the sky, a hemisphere, the lit windows and signs glowing, the nearest
sixteen lamps and shop fronts lighting the street (AgX, as the Godot look).

## 5b. Into Godot: drop the .glb in

**Export .glb** (or `node tools/director/streetexport.mjs --street <name>`) writes one file to drop into a Godot
project's folder (DECISIONS 2026-10-30, later: "as long as the export is as simple as drag and drop into a Godot folder").
Godot 4.7 imports it into a scene with:

- `visual`: a node a chunk (48 m), a surface a material and colour (Godot leaves a glTF's vertex colours off the albedo,
  so the export gives each colour its own material: the reference town is 451 meshes, 84 colours).
- `collision`: a `-colonly` mesh a chunk, which Godot turns into a StaticBody3D with its shape: the roads' and the
  pavements' tops and kerbs, the ground, a box a building (down to the ground on a slope), a ramp a stair, a fence's
  bays, the things you'd bump into (a pillar for a lamp, a pole or a sign; nothing for a stand-in person). **The
  kerbs' ramps** (collider only, never drawn): a 30° slope in front of every kerb face (from the road, from behind the
  walk, onto a walk's cut ends), since a plain CharacterBody3D capsule takes a 15 cm step for a wall (its edge meets the
  capsule at 60°, steeper than its 45° floor) and stops at every kerb. GDSTREET checks it (DECISIONS 2026-10-31: "so I
  don't fall through"): a body a person's size dropped on each road and pavement stands there, and walked at a
  building's front it goes up the kerb and stops at the wall (on the Shibuya lane and the hill: 2.20 m from 2.5 m out,
  its 0.3 m radius short), then walks back.
- `occluders`: `-occonly` boxes inside the buildings, which Godot merges into one OccluderInstance3D (turn occlusion
  culling on in the project, as the look plugin's balanced settings do).
- `lamps`: the lamps' lights as OmniLight3Ds (energy 0.3 to 3, their reach); untick *lamps* beside the button to leave
  them out and light the street by hand.
- `insides`: a marker where each inside's level goes (§5c), its set in the node's metadata.

Story space (x east, y north, z up) is Godot's (x, z, -y), as the game's own export, so a street lines up with a
level built at the same place. `python tools/godot/street_check.py [--street N]` (GDSTREET) does exactly this in a
project of its own and checks it: rays land on the road, the pavement and the roofs where the street says.

**Through Blender first** (docs/STREET_TEXTURING.md): `python tools/street.py bake <street>` gives every surface a
procedural finish that tiles at its real size and the street's own wear (dirt, rain streaks, worn edges), and writes a
.glb and a .blend with the same colliders, occluders, lamps and markers; the HorrorStudio Look plugin lays the wear on
in Godot as it's imported. Add foliage in the .blend's Foliage collection, colliders by Godot's name suffixes.

## 5c. Buildings to walk into: a set inside

The user (DECISIONS 2026-10-30, later night): "integrate the interiors we designed into the street map... a motel...
sync the door shape and let a player enter, exit; we also need stairs so they could reach the second floor, maybe
gates... we will stick to 1 floor for our game interiors for now; the other scenario is a bungalow; I don't know if the
interior builder already builds the exterior."

**What the scene builder builds outside**: only the backs of its rooms' walls (10 cm, in the rooms' own colours, cut
round their doors and windows) and a flat ceiling slab on top. No roof, no eaves, no plinth, no outside materials, nothing
for a car park or a walkway. So the street builds the outside, round the level:

- **An inside**: any building's inspector, *Inside*, picks a **set** (a place made in the scene builder,
  `Content/Studio/Sets/<name>`; *open the set in the scene builder* is beside it). The street reads the set's level, its
  rooms on the ground floor, and keeps them in the building (`inside.rooms`); it reads them again whenever the street
  opens (STREET fails if a set changed since and the street wasn't opened). The building turns the level so its way in
  (a door on an outside wall, one called `front_...` first) faces the building's front, and takes its size.
- **Its outside**: the enclosed rooms' outline (any shape the rooms make: an L, a T), a wall 5 cm outside the level's
  own, **the level's outside doors and windows cut through it at their places and sizes** (the doors' shapes are the
  set's: there's nothing to keep in step by hand), no wall where the level has none (an open veranda), a plinth down to
  the ground, the floor `raise`d (a Japanese house's 45 cm) with steps up to each door, one roof over the rooms (hip,
  gable, flat...), the building's own parts on its box (a canopy, signs, lamps). The roof is **boxed**: it stands on a
  soffit at the walls' top, 1 cm over the level's own walls and ceilings, so nothing of the level ever shows through
  it; a gable's or a shed's ends are flush with its walls. Rooms that don't fill a box (an L, a T, steps) get **one
  roof over their outline**: a flat one is one slab with its parapet (or railing) round the outline only; a pitched one
  is a roof over each arm of it (an L's two bars), each cut away where it's inside another, so they meet in valleys;
  a gable's or a single slope's wing starts at the ridge of the bigger roof it runs into, so its one end is out in the
  open (the classic L and T), and the plan in the scene builder draws that outline (§5d).
  Inside, a dark stand-in for each room (so a door shows a room), never exported.
- **Its outside from the set** (DECISIONS 2026-10-31): a set's level can carry its own outside, designed in the
  scene builder (its Outside panel, SCENE_BUILDER §8: a street style, the walls, the roof, the raise, the front, the
  fittings). A building with that set inside wears it: its `look`, `roof`, `parts` and its inside's `raise`, `slot` and
  `front` are the set's, read again with the rooms whenever the street opens (`inside.from` marks what was put on).
  Change any of them in the street and the building keeps its own from then on (`inside.own`; its inspector: *Follow
  the set's outside* takes it back). STREET fails if a building that follows its set no longer matches it (open the
  street and save). The motel preset is the street's own composition (`own` from the start).
- **Copies**: `rows` side by side and `floors` stacked: **a motel** or a block of flats, a set a room. *+ walkway and
  stairs* adds a walkway along the front of the upper floors with a railing and a stair up to it at the left end.
- **The palette's** *Buildings to walk into*: every set (put it down, build the street round it), and **Motel** (the set `motel_room`: a room, a bath and a closet, its door
  with a peephole and a latch; six rooms on two floors, a walkway on posts, a stair, a lamp by each door, AC units, a
  neon sign) and **Bungalow** (the set `bungalow`: the scene builder's single-storey house round an engawa, raised 45
  cm, one hip roof with deep eaves).
- **Gates** (fences): a two-leaf barred gate, the red and white folding gate across a car park's way in, a chain between
  two posts; `open` 0 to 1 (an open gate has no collider). **Parking bays** are a road mark.
- **In Godot**: the street's .glb has the shell with its door holes open (its colliders are its walls, not a block), the
  walkway and the stair to walk on, and in `insides` a node for each copy, `inside_<building>_<floor>_<copy>`, at the
  level's origin and turned as it is, its set in its metadata: put the set's level scene there (as a child of it) and the
  level's door stands in the shell's doorway: open it and walk in. The set itself goes into Godot through the game's
  own export, which takes a set: `python tools/godot_export.py --game set:motel_room --zip`, its level
  `game/levels/motel_room.tscn`. GDSTREET does exactly this: the street's .glb dropped into the set's exported project,
  the level put at the first room's marker, a ray from outside through the street's doorway meets the set's own door
  leaf (`motel_door`, the bungalow's `front_door`) a metre in; and a ray onto the walkway lands 3.05 m up.
- One floor a set for now (the user); a two-storey interior would need its stairs inside the set.

The example street **hill_motel**: a winding road climbing 8.5 m, the motel and its car park (bays, the folding gate,
a block wall with mesh, a chain) at the bottom, the bungalow up the hill behind a block wall with a gate, houses the
rest of the way (Fill), and three shots.

## 5f. A building in storeys: a school round its rooms

The user (2026-11-01): "the school building needs to be to scale, so the actual rooms could fit in, stairs, door way
etc", and two photos to build 1:1. A set built in storeys (the scene builder's school kit, SCENE_BUILDER §10b: a room on
every floor, stair shafts through all of them) is walked into like any set (§5c), and its outside is built **storey by
storey round the rooms of each**: every storey's outline (a shaft stands in all of them), every door and window cut at
its own height (a window across a floor's line, the top porthole, cut from both walls), the floors' heights the level's
own (`insideFrame` finds the storeys from the rooms; the roof at the top storey's floor and one storey more, where its
stairs land). One marker for the whole level (`inside_<b>_1_1`), its storeys in the metadata.

- **The roof**: flat, its slab over the top storey's rooms, its parapet, coping and railing (`roof.rail`) round it but
  never along a penthouse: the shafts going on up through the roof (the set's `penthouse`) get walls and roofs of their
  own (`pent_parapet`).
- **The facade** (`facade` on the set's outside, STORY_FORMAT §2), all from the rooms: `eaves` (庇: a slab over each
  run of windows on every storey, `out`, `t`, `over` the heads, `ends` past them, runs closer than `join` one),
  `pilasters` (where the rooms meet along a face and in the walls between windows at least `gap` wide, from the ground
  to the parapet, never over a hole of any storey), `bands` (the floors' edges), `rails` (guard rails across windows
  whose sill is lower than `below` above their floor, two bars on posts). Each a box out of the wall with no face back
  into it.
- **Seen from the street**: the windows' sashes and glass by their frames (`window_ribbon`'s two sashes under a transom,
  `window_steel`'s grid, frosted and wired glass), curtains drawn some of the way, a door's leaf, and the rooms dark
  behind them: stand-ins (`inside`, never exported: in Godot the level's own windows are there). A round window
  (`window_porthole`) is round in the shell too: the shell over the square hole's corners, a round reveal back to the
  level's wall, a painted ring (`ring`) proud of the face.
- **New parts and things**: `roofsign` (a panel a letter along the roof's edge, standing behind the parapet on a frame
  or, `back` below 0, on its face), `clock`; fences `ribbed` (precast concrete ribbed both sides, posts, a coping: a
  school's front) and `slidegate` (a school's blue gate of bars on wheels, `open` slides it back); the thing `tree` (a
  trunk and a lumpy crown `w` across from `base` of its height: a stand-in, Blender's Foliage for the real ones).
- **One storey with a facade goes the same way** (a set's outside with `facade`, even `{}`): its glass seen from the
  street, its flat roof and parapet, its parts on the box round its walls. **A porch** (a room open to the outside on a
  whole side: a recess cut into the building) is under the roof but outside the walls: the shell runs round its back and
  sides, the doors and windows there cut through them (a glass front), its paving and its soffit drawn for the street.
- **The two photos, matched**: `school_white` (the set `school_white` behind a ribbed wall and a blue sliding gate,
  planters, a notice board, trees, the long low building beyond; its shot `photo`: a phone's 49° lens 1.5 m up, tilted
  4.4° up, the main front 45.3 m off and square to it, the central pilaster 1.17 m left of the axis, measured off the
  photo: a bay 150 px, a storey 74 px) and `school_showa` (the set `school_showa` across its gravel yard at dusk, a
  covered walkway on thin posts, a lamp; its shot `photo` solved from nine window corners to 1.6 px: 23.8 m off the
  front looking 37° along it, tilted 7.7° up, a 47° lens). The photos stay on the user's machine (`refs/`).
- **`tokyo_school`**: the concrete private school (the set `school_tokyo`, SCENE_BUILDER §10c) on a Tokyo corner: a
  6 m road and a side street (止まれ), its forecourt behind a low concrete wall and a steel sliding gate, flats and houses
  round it (the residential styles), poles and their wires, a vending machine and a traffic mirror at the corner, the
  courtyard's tree over the roof. Shots: across the road, the corner, from above.

## 5d. No clipping

The user (2026-10-31): "it looks like there is clipping on the roof (wall top lines peeking through) etc, refine the
system so we never see clipping". Two faces facing the same way in one plane, over each other, flicker as the depth
buffer picks between them (z-fighting); a face just behind another shows through it at a distance. The generator now
keeps every pair apart by construction, and STREET measures it (§6):

- **Layers a GAP apart** (`GAP`, 1 cm): what lies on a surface (a sign's words, a fan's grille, a lamp's glass, a
  vending machine's lit panel, a bollard's band, a drain's grate, a car's glass) stands a GAP off it, never a few
  millimetres. **Road paint** is the one exception (DECISIONS 2026-10-31, late morning: "it should look part of the
  road"): the lines lie 5 mm over the asphalt, a mark 5 mm over them, and a mark painted over an earlier one 5 mm over
  that (only where they overlap: `markSpan`); paint and decals cast no shadow anywhere (here, Blender, Godot), and the
  page draws the paint over the road by a depth offset. 5 mm is over the clash test's 4 mm.
- **A part's sides, top and bottom 6 mm in** from where they're asked to be (`SIDE_IN`), so a part ending at a
  corner, a floor's line, a fin's end or a slab's top is never in its plane; a part stood on its floor keeps its
  bottom there. A part repeated up the floors is never taller than the way to its own copy on the next floor (a hole
  leaves 10 cm of wall between).
- **Things that meet, meet once**: a balcony's slab and its side rails stop at the wall and the front's corner posts; a
  railing round a roof has one post at each corner and its rails stop at the posts' sides; a stair's top step meets
  its landing; a fascia board runs a GAP past its eave; fence posts end inside their top rail; a gate's two leaves
  leave a gap where they meet; the folding gate's lattices are two layers; a bike's tubes differ in thickness where
  they join, its stays either side of the wheel; a lamp's two arms start either side of its pole; the ◇ mark is one
  mitred ring.
- **Parts that meet each other**: a blade sign over a bay hangs off the bay's front instead of through it; the pencil
  building's blade is on the side its bays leave open.
- **Roofs**: a walk-in building's roof is boxed and 1 cm over the level's top (§5c); a flat roof's parapet runs along
  x across the corners and along y between them, its coping the same; roofs over an outline that isn't a box are
  joined into one, each cut away where it's inside another's volume (on a face of both, the first keeps it).

## 6. Checks

- `python tools/street.py check` (STREET, in check_all): every style at six seeds, every window and ground floor
  style, every part on every face, every roof and roof thing, every road mark, thing and fence builds with no stray
  number, inside its triangle budget, the same twice, and **with no clipping**: no two faces of a piece facing the
  same way within 4 mm of one plane over each other by more than a square centimetre (faces down on the ground
  aside; the test tries itself first on two slabs); a pavement is cut where another road crosses it; a hip roof's
  slopes face up; a wall's rectangles and its holes tile it exactly; sets shaped L, T, U, steps and apart under every
  roof kind build one roof over their outline, every roof over the level's top; every street is well formed and
  builds; each shot's pins land within 2% of the frame's height on average (4.5% at most).
- `node tools/director/streettest.mjs` (STREETPAGE, the desk's server running): the page driven as a person would (a
  lane drawn, filled, a building's floors changed, a sign added on its facade, a photo behind it, a fence and a vending
  machine placed, a shot kept, undo, saved and read back the same, the .glb exported, the Shibuya lane drawn through
  its shot with its white line where the photo has it).
- `python tools/godot/street_check.py [--street N]` (GDSTREET, the desk's server running, Godot 4.7): the street's .glb
  imported in a Godot project of its own: its colliders, occluders, lamps, colours and insides' markers, rays onto
  the road, the pavement and three roofs, through an inside's door (open) and onto a motel's walkway; with a set inside,
  the set exported too and its level put at the marker: through the doorway a ray meets the set's own door (`--no-sets`
  skips that part).
- `python tools/street.py shot <name> [shot]` (or `node tools/director/streetshot.mjs`): the street drawn through a
  shot into `Saved/Streets/<name>/`, and beside its photo: the photo, the drawing, the two blended.

## 7. The Shibuya lane (the first reference, matched)

`Content/Studio/Streets/shibuya_lane`: a one-way lane in Udagawacho at the blue hour, its shot `photo` framing it as
the user's photo does. The photo's camera, measured from it: a phone's main camera (26 mm: 67.3° tall in the 2:3
portrait frame, the road text's foreshortening agreeing), the eye 1.6 m up (the walker's head on the horizon), turned
2° right of the lane and 2° up (the lane's vanishing point 20 px left of and below the middle). Everything was placed
by casting the photo's pixels through that camera onto the ground, the shop's front or the far block's faces; 13 pins
hold it (0.5% of the frame off on average, 1.4% at most). The photo itself is only on the user's machine
(`refs/`, git-ignored): paste it into the shot to see the two together, or `python tools/street.py shot shibuya_lane`.

## 7b. The reference town (the other five references)

`Content/Studio/Streets/reference_town`: a small town with a corner for each of the user's other references, made
the way a person would with the page (four streets drawn, each filled with its place's mix, then a few touches by
hand): **the shopping street** (lantern lamps with their ほんちょう plates, poles and wires, an orange middle line, the ◇
of a crossing ahead, shops with awnings and sign boards, a van), **the quiet lane** (stucco houses, their fire boxes
and meters, vending machines, a block wall with mesh, a wooden fence, 止まれ at its mouth), **the old post town**
(timber machiya with lattice fronts and tiled eaves, post lamps, a red post box, a bamboo fence), **the abandoned
blocks** (concrete flats with shutters and canopies, a building site's long panels, cones and barriers) and **the
white tower** on the corner. A shot each, framed as its reference was (not matched: the matching is the Shibuya
lane's). 89 buildings and 224 things in 88,000 triangles.

## 8. Not yet

- An inside's level placed in Godot by the export itself (today: a marker where it goes; the set's level, exported as
  above, is dropped there by hand).

- Streets into Godot: the .glb is exported by hand for now; a game's level taking a street (and the scene builder's
  enterable buildings put into it through a building's door) is the next step to plan with the user.
- Foliage (the user: "don't worry about foliage for now"): pots stand empty.
- Steps and terraces on a slope (a stair street, a retaining wall): the ground blends between the roads for now.
