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
  to other streets' ends; Shift keeps it square), the yellow square on its side to widen it. In the inspector: the
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

The mixes (*Fill a street*) are in `street-presets.js` (`MIXES`, and `EDGES`: each place's lamp, how far apart, poles or
not, its clutter).

## 4. The format (`street.json`)

Metres; x east, y north, z up (the story's space). A piece is made in its own space, its front toward its own -y,
turned by `turn` (degrees, anticlockwise) and set down at `at` (its middle); a road and a fence run from `from` to
`to`. Ids are unique in the street.

```
{ "format": 1, "name": "shibuya_lane", "about": "...", "time": "dusk",
  "look": {"asphalt": "#2d3034", "wall": "pbr/concrete_03"},                 a slot: a colour or a PBR set, everywhere
  "roads": [{"id", "from": [x, y], "to": [x, y], "width": 6 (kerb to kerb), "walks": [left, right] (m, 0 none),
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
  "things": [{"id", "kind" (THING_KINDS), "at", "turn", "z", "h", "slot", "look", "to" (a pole's next pole), ...}],
  "fences": [{"id", "kind" (FENCE_KINDS), "from", "to", "h", "step", "look"}],
  "shots": [{"id", "name", "eye": [x, y, z], "look": [x, y, z], "vfov" (degrees tall), "aspect": [w, h],
             "ref": "refs/<photo>", "op", "pins": [{"name", "px": [0..1, 0..1], "at": [x, y, z]}]}] }
```

`pins` say where a point of the street is in the shot's photo: the check (§6) holds the shot to them.
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
so. The look is flat-shaded at dusk by default: the sky, a hemisphere, the lit windows and signs glowing, the nearest
sixteen lamps and shop fronts lighting the street (AgX, as the Godot look).

## 6. Checks

- `python tools/street.py check` (STREET, in check_all): every style at six seeds, every window and ground floor
  style, every part on every face, every roof and roof thing, every road mark, thing and fence builds with no stray
  number, inside its triangle budget, the same twice; a pavement is cut where another road crosses it; a hip roof's
  slopes face up; a wall's rectangles and its holes tile it exactly; every street is well formed and builds; each
  shot's pins land within 2% of the frame's height on average (4.5% at most).
- `node tools/director/streettest.mjs` (STREETPAGE, the desk's server running): the page driven as a person would (a
  lane drawn, filled, a building's floors changed, a sign added on its facade, a photo behind it, a fence and a vending
  machine placed, a shot kept, undo, saved and read back the same, the .glb exported, the Shibuya lane drawn through
  its shot with its white line where the photo has it).
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

- Streets into Godot: the .glb is exported by hand for now; a game's level taking a street (and the scene builder's
  enterable buildings put into it through a building's door) is the next step to plan with the user.
- Foliage (the user: "don't worry about foliage for now"): pots stand empty.
- Curved streets and slopes: streets are straight and the ground flat.
- Fewer draw calls: the page and the .glb keep a mesh a surface a piece (a street of ninety buildings is about two
  thousand); a game's export should merge them by material.
