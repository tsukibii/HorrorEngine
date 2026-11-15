---
name: build-map
description: Build a coherent map from a floor plan, a photo or words - an interior (a set, the scene builder's own model) and the street it stands in (the street builder's) - from the command line and cheaply - a layout file into a set, a street file synced with it, the checks, Godot's pictures of the real thing. Use when the user asks for a map, an interior, a building's floors or a street.
argument-hint: <a floor plan or what the place is> [set name] [street name]
---

# /build-map: a floor plan and its street, cheaply

Asked with: $ARGUMENTS

The editors' own code does the building; you write two small files and run commands. **Never read** a set's
`story.json`, a `street.json`, `builder-presets.js` or `street-gen.js` whole: the formats are in
[reference.md](reference.md). Look at results as **one picture** each (a plan PNG, a contact sheet), and at checks by
their last lines. A worked example of everything below: `Content/Studio/Sets/maison_1f/layout.json` (image 1's flat,
four storeys, a locked gate on the stairs), its street `Content/Studio/Streets/maison_lane/street.json` (a lane bending
round the block, a curved concrete wall) and `Content/Studio/Sets/maison_1f/shots.json`.

**Before placing anything a character will use**, read `docs/ANIMATION_RULES.md` (its §0 is the short list): a
character's animations are made for furniture of certain sizes with certain floor left free, and she doesn't see
the room. `reference.md` §7 has the numbers.

## 1. The interior: a layout file

1. **Plan in metres first** (in your head or a scratch note, not a file): x east, y north, every room a rectangle on
   **wall centrelines**, neighbours sharing edges exactly. Feet and inches: ×0.3048, then add a wall (0.1) between rooms
   to read a plan's inside sizes as centrelines. An L-shaped room is two rooms with `open` on the side between them.
2. Write `Content/Studio/Sets/<set>/layout.json` (the set's source, kept beside its story.json; a short Python script
   that writes it is fine when numbers repeat): `rooms`, `doors`, `windows`, `items`, `kits`, `floors`, `finish`,
   `start`, `her`, `outside`, `repeat` (reference.md §1). Furnish with kit presets by room (§3), dress surfaces with
   PBR sets from git (§4).
3. `node tools/director/layoutset.mjs --file Content/Studio/Sets/<set>/layout.json <set> --dry` until it says no
   problems, then without `--dry` (it writes the set; a set already there keeps all but its level).
4. `python tools/plan_view.py --game set:<set> [--floor Z]` and Read the PNG (`Saved/Story/<set>/plan_<set>[_Z].png`;
   `--floor` one storey of several): rooms, doors (red: locked), furniture, the start's arrow.
5. `python tools/level_check.py --game set:<set>` and `python tools/story_check.py --game set:<set>`: fix by each
   error line (§5 of reference.md says what each usually means), run layoutset again, until `LEVEL ok`, `STORY ok`.

**Storeys alike** ("one flat a floor"): `floors` lists every storey's height; `repeat` copies the ground floor's rooms
up (bare: no furniture, lights off), `add` gives each copy its landing and its doors (`{n}` the storey). A stair: one
room the whole building high, `flights: 2` (a dog-leg) and `dir`; a door onto it on every landing.

## 2. The street: a street file

1. Write `Content/Studio/Streets/<street>/street.json` with a scratch script when anything curves (arcs as `via`
   points every 15°, reference.md §6). The walk-in building: `"style": "set", "floors": 1, "inside": {"set": "<set>",
   "level": "<set>", "rows": 1, "floors": 1, "raise": 0.45}` at the centre of the set's rooms' box, turned by its
   front (`{"s": 0, "e": 90, "n": 180, "w": 270}`): the street's metres are then the set's own, so you place
   everything else round it by the plan's numbers.
2. `node tools/director/streetsync.mjs <street>`: the building takes the set's rooms, its outside and its size.
3. `node tools/director/streetcheck.mjs --street <street>` until `STREET ok` (warnings: things side by side in one
   plane; offset them).

Trees: the street's `tree` is a stand-in; give it `"prop": "props/zelkova_real"` (a `*_real` recipe made and in the
library: reference.md §6) for the realistic one in its place, on the page and in the export.

Keep clear: the building's shell is 0.2 m outside its wall lines; leave 2-3 m to the pavement in front of an entrance
(steps, a canopy), 1 m at corners. Poles turn so their arms cross the road. Shots stand on pavements, not behind
walls.

## 3. Pictures by Godot (the real thing)

`python tools/director/serve.py &` (restart it after changing any Python under `Content/Python/storykit`: it keeps the
modules it started with), then:

    python tools/godot/map_shots.py --set <set> --street <street> --shots Content/Studio/Sets/<set>/shots.json --time dusk

Read `Saved/Godot/_map/<set>/shots_<time>/sheet.jpg` (one image). The shots file: `[{"name", "eye": [x, y, z],
"look": [x, y, z], "in": true}]` in the street's metres, `in` making z over the interior's floor (an eye: 1.6). Look
for: a wall where the plan has a door or an open side, furniture through walls, the street through the windows,
the outside against the user's reference. `--nofog` judges far things without the look's haze; `--reuse` keeps the
last exports when only the shots changed.

## 4. Hand it over

- The exports for the user's Godot project: `node tools/director/levelexport.mjs --game set:<set>` (into
  `Exports/interiors/<set>/`) and `node tools/director/streetexport.mjs --street <street>` (`Exports/streets/`); the
  interior goes in at the street's marker `inside_<building>_1_1` (guides/first_game).
- Docs: the set and street in docs/SCENE_BUILDER.md and docs/STREET_BUILDER.md if they teach something; a line in
  docs/DECISIONS.md for what the user asked; docs/CONTINUE.md.
- Checks before the push: `python tools/check_all.py` (LEVEL runs on every set), STREET, KIT if a kit changed, EXPORTS
  if an exporter changed. Commit the layout, the set, the street, the shots file; send the user the sheet.
