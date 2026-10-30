# The story format (formats 2 and 3)

A game is one file: **`Content/Games/<Game>/story.json`**. The importer builds its levels, the StoryRunner plays
it, the director's desk edits and previews it, and the offline checks prove it before any of them run. Every word
below is something the code reads. A word that isn't here doesn't exist: add it to the code, the check and this
page in one commit, or don't use it.

The worked example is `Content/Games/Pilot/story.json`. `python tools/story.py --game Pilot flow` shows its shape.
**Format 3** (§9, pipeline v2) adds the Japanese pass, karma, endings by karma, no dying, the animation budget and
Kimodo segments; its worked example is `Content/Games/Sample/story.json`.

A game has three layers:
- **The world:** levels, rooms, props. Blocks first, art later.
- **The spine:** **scenes**, the performed moments with the MetaHuman actors. Their timing comes from their clips.
- **The stitches:** player tasks between scenes, written as beats. Their timing comes from the player.

The **flow** joins scenes and stitches with **choices** and ends at **endings**.

## 0. Conventions

- **Units and axes:** metres and degrees; x east, y north, z up.
- **`rot` and `yaw`:** degrees counter-clockwise from east (90 = facing north). Unreal gets X = x, Y = −y, yaw = −rot.
- **Room space:** each room's origin is its south-west floor corner (`at`). Props are placed in room space.
- **Walls** are 0.1 m thick and centred on the room's edge: a prop of depth d against a wall sits d/2 + 0.05 m from
  the edge.
- **Ids:** `snake_case`, unique across the file. The exception is clip ids, which are unique within their scene
  version (`c1`, `c2`...).
- **A take id names the user's media:** `<Game>_<scene>_<variant or main>_<clip>`, e.g. `Pilot_s_message_main_c2`.
  The voice is `.wav` and the face video `.mp4`. `story.py clips` lists them.
- **The player's eye** is 1.65 m above the floor.

## 1. The file

| Key | Holds |
|---|---|
| `format` | `2` |
| `game` | `id`, `title`, `start` (a flow node), `target_min` (the shortest *typical* path to a normal ending must reach it: **150** for a real game), `fast_min` (the shortest *fast* path must reach it: **120**, Steam's refund window; cutscenes can't be skipped, so they count fully), `voice` (`ja`), `text` (`en`), `clip_max` (seconds one take can be: **10** for MiniMax), `fov` (the player's horizontal field of view, 90 by default: the one lens), `previs_body` (the desk's default body), `time` (the time of day the game starts at: `day`, `dusk` or `night`; `night` when unset, the studio's dark interiors; scenes change it, §3.1), `player_name` (the player's name until they type one, §4 `name`; "Alex" when unset), `hair` (the hair look every imported model's hair wears in Godot, docs/GODOT_LOOK.md §5c: `{"retro": true}` the PSX look (unlit, eight colour levels, the ordered dither), or each of `flat`, `steps` (2 to 64), `dither`, `gain`, `shine`, `soft`, `cut`; a cast member's own `hair` over it) |
| `cast` | `{id: {name, metahuman (asset path or null), height, shape, measures, skin, previs_body}}`: `shape` is up to 45 MHR identity numbers (the desk's Shape page writes it; zero is the average body), `measures` the body's widths in cm at that height (`{height, shoulders, chest, waist, belly, hips, thighs, arms}`, the Shape page writes them too) and `skin` a hex skin tone: what `tools/metahuman.py` gives MetaHuman Creator (docs/METAHUMAN_ROUTE.md); `previs_body` a file in `Content/Studio/Bodies` (default: MHR.fbx; after the MetaHuman is rigged, its exported body), or `people/<name>`: a Character Studio character as it was exported for the desk and Unreal (`Content/Studio/People/<name>/export/<name>.glb`), worn with its own look and its eyes, its own shape (`shape` doesn't apply), scaled to `height`; `models` her other looks, `{name: body file}` (`{"lilac eyes": "people/natsu_lilac", "wet": "people/natsu_wet"}`): variants a scene picks (§3.1 `models`), `previs_body` the default (HANDOFF_DIRECTOR_TODO §5); `hair` their own hair look over the game's (`game.hair`): the salon's cards, brows and lashes on the Studio's hair shader in Godot, `{"retro": true}` for the PSX dither, GODOT_LOOK §5c |
| `items`, `notes`, `sounds` | `{id: {name, shape, inspect, torch}}` (`torch`: a flashlight, below), `{id: {title, text}}`, `{id: {file}}`: a sound's `file` is `sfx/<name>`, a CC0 sound off the Studio's shelf (`Content/Studio/SFX`, `tools/sfx.py list`; the check fails one that isn't on it; docs/SFX.md), or the game's own file under its Audio folder in Unreal |
| `lines` | one-off voice outside scenes (`say`, `whisper`): `{id: {who, ja, en, mood, dur}}` |
| `levels` | the world (§2) |
| `scenes` | the spine (§3) |
| `motions` | reusable body animations: `{id: {who, prompt, secs, loop}}`, e.g. idles and walks (§3.5) |
| `stitches` | the player tasks (§4) |
| `flow` | the graph (§5) |
| `secrets` | `{id: {flag, hint}}`: easter eggs; a beat that finds one says `"secret": id` |
| `achievements` | `{id: {title, text, hidden, for}}`: what a secret found, an ending reached or a flag set unlocks (§9.13) |
| `interrupts` | trigger cutscenes (§5.1): something the player does during a stitch jumps the flow to a scene, usually a death |
| `board` | notes for the whole game (§7) |
| `frames` | the desk's board: acts, coloured frames behind groups of cards (§5) |

## 2. The world

**A level:**

```json
{"start": "start", "rooms": [...], "links": [...]}
```

- Each level becomes one map: `/Game/Games/<Game>/Maps/L_<level>`.
- `start` is a spot.
- `weather` (optional): this level's weather, `clear` or `rain`, over `game.weather` (§9.1): an outdoors level in the
  rain, the house dry.
- `look` (optional): this level's look, `realism` or `plain`, over `game.look` (§9.1): a flat-lit annex, a dream
  level with the effects off (a scene's `look` is its look-at, §3.4: no per-scene preset).
- `routes` (optional): named walks for the cast in play (`behave` path and patrol, §4), each a list of the level's
  spots in order, with a `wait` (seconds, facing the spot's `rot`) and a `pose` (the pose library) where she stops:
  `"routes": {"r_hall": {"points": [{"at": "hall_back", "wait": 2, "pose": "look_left"}, "hall_near"], "mode": "pingpong"}}`.
  `mode`: `loop` (the default), `pingpong`, `once`. She walks straight from point to point, so place the spots where
  the line between them is clear. A point's `check` (a locker) is a hiding place she looks in there (`behave` sees).

**A room:**

```json
{"id": "kitchen", "at": [0, 6, 0], "size": [4, 4, 2.8], "floor": "tile", "light": "dark", "skip": ["s"], "ceiling": true,
 "openings": [...], "props": [...]}
```

- `size` is `[w (x), d (y), h]`.
- `floor` is `wood stone carpet tile dirt metal water`: it sets footsteps.
- `light` is `off dark dim lit`: a mood note for the lighting pass.
- `skip`: two touching rooms share one wall, and **exactly one of them skips it**. A plain letter (`"s"`) skips the whole
  wall; `["e", 1.0, 3.5]` skips only that stretch (metres along the wall from its west or south end), for a room that
  shares part of a wall, like a corridor beside several rooms. Rooms whose heights overlap share walls (a two-storey
  stairwell beside an upstairs room too); the scene builder works all of this out.
- `kind`: what the room is (optional): `genkan corridor ldk living dining kitchen washitsu bedroom service kids study
  bath washroom toilet closet walkin oshiire storage stairs balcony engawa common garden garage other`. The scene
  builder colours and labels by it and gives some kinds their built-ins (below); `name` is its label (optional,
  any text, Japanese welcome); `dir` is the way a `stairs` room climbs (`n e s w`).
- `ceiling: false` for outdoors.
- `wet` (0..1, optional): a wet floor without rain (a bathroom, a cellar): in the Godot export the floor wears the
  look plugin's wet (the damp darkening, pools that carry the lights, no rings: GODOT_LOOK §2) by that much, and from
  0.5 every step in the room is a wet one, on the desk's Play too; the desk's stage shows the floor darker and
  glossy by it. (Rain, `game.weather`, wets a room with no ceiling by itself, on the stage too.)
- `look`: library texture sets for its surfaces, `{"floor": "ambientcg/WoodFloor041", "walls": "...", "ceiling": "..."}`
  (docs/ASSETS.md). Grey until fetched.

**An opening:**

```json
{"wall": "n", "at": 2.0, "w": 0.9, "h": 2.1, "sill": 0, "door": {"id": "cellar_door", "locked_by": "cellar_key", "swing": "out", "creak": true}}
```

- `at` is the opening's centre, measured from the wall's west end (n and s walls) or south end (e and w walls).
- `window: true` is a hole with a `sill`. A window's **`shaft`** (true, or 0..1 how strong) is the beam its light
  throws into the room, dust drifting in it (Godot: HSShaft, a thicker haze along the window's light; needs the
  look's haze; `reach` metres, 3; `dust` 0..1), after Light Kit's Window shaft. The desk draws it as a see-through
  box along the window's light (`tools/director/lightfx.js`).
  A window's **`sweep`** (true, or `{"every": 40, "secs": 3, "out": 6, "span": 10, "energy": 10, "aim": 1.5}`) is a car passing
  outside now and then at night: headlights sliding along the street, aimed in through the glass, the frame's
  shadow crossing the ceiling (Godot: HSSweep; the desk slides the same lamp, with its shadows); `every` 0 means only when
  the `sweep` action fires one. After Light Kit's Sweep. `out` is where the street runs: when the window gives onto
  a room of the level (TestRoom001's yard, four metres deep), keep the car inside it (`"out": 2.5`), or its wall
  stands between the headlights and the glass.
- `locked_by` is an item, or `flag:<name>`.
- `swing` is `in` (into the room that holds the door), `out`, or `slide`: a sliding door (fusuma, shoji, a modern
  sliding door, a glass door onto a balcony), which has no swing.
- `peephole: true` (or its height on the door, 1.0 to 1.9 m; 1.52 by default): a little lens in the leaf, on both
  faces (DECISIONS 2026-10-28). In Play a click on it puts the eye to it: the other side through a wide lens in a round
  hole, a little room to look about; a click or a step takes the eye back. `{"peeping": door}` holds while the eye is
  there (whoever knocked, there or not). The scene builder's door has its box.
- `latch: true`: a thumb turn on the door's face in the room that holds it (DECISIONS 2026-10-28, later: a shift ends
  locking up). In Play a click on it locks the shut door or unlocks it, and from that side a click on the locked door
  unlocks it too; from the other side it's locked (its `locked_by` key, if it has one, still opens it). It undoes only
  its own lock: a door the story locked (`door` `lock`: it slams and locks behind you) or a `locked_by` door stays
  locked from both sides till the story or its key opens it. `{"locked": door}` holds while it's locked, by anything.
  The scene builder's door has its box.
- An opening on a wall that also serves an upper floor (a stairwell's door onto the landing) has its `sill` at that
  floor's height.

**Trim:** `"trim": {"skirting": 0.06, "cornice": 0.03, "casing": 0.06}` on a level (every room) or a room (its own,
key by key; `"trim": false` for none): a skirting board that height along the foot of every wall, a cornice that
deep under the ceiling, a casing that wide round every door and opening on both sides. The planner builds them as
thin boxes (`<room>__skirting_n0`...) wherever a wall stands at that height, its own or its neighbour's, so they stop
at openings and open sides by themselves; `look.trim` textures them. `"threshold": 0.012` lays a strip that high
in every walk-through doorway between two rooms whose `floor` differs (`<room>__threshold_n`, tagged
`trim:threshold`: it may stand proud of the floor).

**Built-ins** (the scene builder, docs/SCENE_BUILDER.md): props with ids `<room>_fx_<what>` are its own, remade on
every save from the room's `kind` (a kitchen counter, a bath tub, a toilet, a vanity and washing machine, a shoe
cabinet, a stair's steps), placed clear of every doorway, and its ceiling light (`<room>_fx_light`) with a light
switch by the door (`<room>_fx_switch`, `use: switch`). Things on its walls are `<room>_wi_<kind>_<n>`: a box against
the wall with its `tag` (mirror, poster, frame, tv, air_conditioner, clock, calendar, board, shelf, light_switch),
read back by the builder as wall items. Edit them as any prop; the builder replaces them only while
the room's built-ins are on. The builder also writes kit props (docs/KIT.md §4):
- `<room>_kt_<preset>_<n>`: furniture.
- `<room>_wf_<n>`: wall fittings.
- `<room>_fx_floor` and `<room>_fx_ceiling`: the room's floor and ceiling step.
- `<room>_fx_win<n>`: a window's frame. It carries `in_wall: true` and `of`, the window it frames.

**A link:**

```json
{"a": "hall", "b": "cellar_stairs", "via": "cellar_door"}
```

`via` is `null` for an archway. A room with no link can't be reached.

**Shapes:**
- `box w d h`
- `cyl r h`
- `sphere r`
- `plane w h`
- `stairs w run rise`
- `person <cast> [stand|sit|lie|hang|kneel]`: a T-pose stand-in placed in the world, like a body or a figure for a
  glimpse. Scene actors are staged instead (§3).
- `asset <lib>/<name> [scale]`: a CC0 library mesh at its real size, e.g. `asset basemesh/wooden_chair_01`
  (`python tools/cc0.py props <word>` lists them with sizes). Its box stands in until it's fetched.

**A kit** (in place of a shape, docs/KIT.md): `"kit": "switch_jp_2"` (a preset of `Content/Studio/Kit/presets.json`) or
`"kit": {"preset": "oak_planks", "seed": 7, "size": [3.9, 2.9, 0.015]}` (a preset with what differs) or `{"type":
"cabinet", "size": [...], ...}`. Its box is its `size` or the preset's; `rot` is the way its front faces. The plan
tags it `kit:<type>` and `art:kit/<type>_<hash>`, the mesh `tools/kit/build.mjs` writes for the importer. Floors,
rugs and ceiling steps are also tagged `surface` (the level check doesn't count them as obstacles). `in_wall: true`
marks a thing that sits in its wall, like a window frame.

**A kit door:** a door's `kit` (a `door` preset, or one with what differs: `{"preset": "door_shaker", "handle":
"bar_pull", "hinge": "right"}`) builds it as a frame (`<id>__frame`), a leaf (the door, turning on its hinges) and a
handle (`<id>__handle`), each tagged `door:<id>` and `door_part:*` (docs/KIT.md §8). The kit's hinge numbers (`hinges`, `hinge_h`, `hinge_w`, `hinge_t`, `barrel`,
`mortise`, `hinge_model`) and `hinge_art` (your own hinge, split into `<id>__hinge<i>_door|frame`) are there too.
A door's `class` (a Blueprint
class path, `…_C`) is that door's Blueprint, in place of class_map's `door`.

**A prop:**

```json
{"id": "kitchen_photo", "shape": "box 0.2 0.02 0.25", "at": [2.3, 2.1], "rot": 0, "on": "kitchen_table", "z": null,
 "tag": "photo", "hidden": false, "art": null, "use": "inspect", "text": "..."}
```

- `on`: rests on that prop: on its top, or at its own `z` when it has one (a cushion on a sofa's seat, below the
  back's top).
- `z`: height above the floor, for things on walls or ceilings, and lights.
- `art`: the asset that replaces the block, scaled evenly to fit it: an Unreal path (`/Game/...`) or a library ref
  (`basemesh/food_prep_table`).
- `mat`: a library texture set on the block (`ambientcg/Wood049`).
- `tag`: what it is, for the art shopping list.

**Uses** (in play, every one is a left click on the thing; DECISIONS 2026-10-27, later):

| `use` | Fields |
|---|---|
| `pickup` | `item`: a click takes it into the inventory (the row E shows, it in the hand), and `{"pickup": item}` is heard; **G** puts the one in the hand down in front of the player, on whatever is under that spot (no falling), and then the player hasn't got it (`{"dropped": id, "in": room}` is heard, as for `carry`) |
| `note` | `note` |
| `inspect` | `text`, optional `line`. In Play a small thing (its longest side 0.6 m or less) is taken up in the hands (DECISIONS 2026-10-28, later): itself in front of the eye, a drag turns it (a photo turned over to read its back), `text` under it, Esc puts it back; a bigger one shows `text` on a card. `{"use": id}` is heard once it's put back |
| `switch` | `light` |
| `leak` | water running down a wall from here (GODOT_LOOK §2b): `wall` (`n e s w`, one the room builds), `at` by it and `z` where it comes in, `width` m at the top (0.4; it spreads as it runs), `drip` seconds between drops (2.6; 0 none), `wet` 0..1 (0.8); Godot wets a band of the wall below it (dark, glossy, in rivulets, drying toward the floor, no pools) and drops the drips; the desk draws the band |
| `light` | `kind` (`bulb candle lamp fire`), `lit`, `flicker` 0..1 (how much), `mode` (which: `fluorescent` a tube's stutter every `interval` s or so, `dying` drops out often and never quite full, `candle` a flame's restless wobble, `pulse` a slow breath at `rate` a second, `custom` your `letters` at `rate` a second: a off, m as placed, z double; none: a plain wobble; a `mode` with no `flicker` is the whole of it; a tube switched on stutters on; after Light Kit's Flicker, the same curves on the desk and in Godot), `lumens`, `radius`, `kelvin` (place with `z` or `on`); **a pattern in its light**: `pattern` (`caustics` water's light on a ceiling or a wall, `leaves` sun or moon through swaying trees, `blinds` a venetian blind's stripes, `clouds` cloud shadows passing) with `aim` [x, y, z] where it falls (the light becomes a spot aimed there), `spread` its cone in degrees (50), `scale` metres per feature, `speed`, `open` 0..1 (the canopy's or the slats' openness, the water's own light, the cloud cover), `angle` the slats' degrees; after Light Kit's Pattern; Godot draws it (the desk shows the spot aimed) |
| `breaker` | the breaker box (DECISIONS 2026-10-28): a click throws it, the level's power goes off or comes back (the lights flickering up), and `{"use": id}` is heard. While the power's out (the `power` action) every bulb and lamp in the level is dark (each keeps its own on or off for when it's back; candles and fires burn on) and a `switch` only clicks: **No power** |
| `locker` | (hide inside: a click gets in, a click gets out) `inside` (a spot: where the player stands in it and the way they face; default its middle, facing its `rot`), `see_through` 0..1 (from inside its walls are slats, this much of them gaps; default `game.see_through`, else 0.6). The player's look stays in a cone out of it; `{"hidden": true}` (or the locker's id) holds while they're in |
| `roll` | a die (`shape: "box 0.3 0.3 0.3"`, six faces): a click throws it from the player's hand, physics rolls it, and when it settles the face on top is heard as `{"rolled": id}` |
| `sit` | (a chair, a sofa, a bed's edge: a click sits the player down, the eye at sitting height, a click stands them up; a beat's `{"use": id}` hears it) |
| `carry` | a thing the player carries in both hands: a click picks it up into the inventory, in the hand; **G** puts it down in front of the player, on whatever is under that spot, facing them (no falling: it's simply there, and stays). Its `shape` (`box`, `cyl`, `sphere`, or `asset` for a library mesh at its size; under 1 m) is its body; `art` dresses it (any library mesh: your own goes in with `python tools/cc0.py add <file> local/<name>`), and in Play a bare plushie's block is drawn rounded, like a cushion. `physics`: how it follows the hand, `rigid` (default: stiffly) or `plushie` (light and soft: it lags and swings, squashes and stretches, bobs with the steps, its top flops behind a turn); `jiggle` 0..2 a plushie's softness (0 still, 1 a plushie, 2 jelly). `{"carrying": id}` holds while it's the one in the hand (the inventory's middle), `{"dropped": id, "in": room}` when it's put down |
| `game` | a table with a board game: a click sits the player down at its long side (their half), leaning in over it, its rules play it out (`game`: one of `Content/Studio/BoardGames/`, or the game's own `BoardGames/`: `russian_roulette`, `high_dice`, `chohan`, `spin_the_cup`, `shell_game`, `high_card`, `blackjack`, `shinkei_suijaku`; their README has each one's results and settings), they stand up, and `{"played": id, "result": ...}` is heard. `vs` the cast member they play (else the dealer), `settings` the game's own (each named in its rules' meta; `seed` plays the same game every time; a setting's value `"flag:off_pills"` is true while that flag is set, `"!flag:off_pills"` while it isn't: his memory lies only off his pills). Needs a `shape` or a `kit`: the table |
| `sleep` | a bed (a `kit` like `bed_single`, `futon`, or a shape): a click lies the player down on it, looking up, and the view goes dark; the story hears `{"use": id}`, and its beat plays a `chapter` (§4), which wakes them in the bed and gets them up where they stood (with no chapter they wake by themselves). `if`: a flag or a list (`"!flag"` for not) that must hold before they can sleep (the chores first); until then the bed says **Not tired yet**, and a click thinks `not_yet` (else "I'm not tired yet."), and nothing is heard |
| `clean` | a stain (DECISIONS 2026-10-28: the shift's chores): a flat block (`"shape": "box 0.6 0.4 0.01"`) drawn as a blot on what it lies on, `stain` its kind (`dirt` by default, `mud`, `blood`, `water`, `ash`). The player holds the left button on it to scrub it away: a ring fills round the reticle and it fades over `secs` of scrubbing (3 by default; let go or look away and it waits where it got to). `with`: an item that must be the one in the hand (the mop, a rag), else it says **Need the mop**. Clean, it's gone and `{"use": id}` is heard (tick a to-do with it: `"ticks": {"use": "hall_stain"}`, or `all` of several) |
| `combo` | `code` (written in some readable text), `then` (a flag), `opens` (a door) |
| `use_on` | `needs`, `then`, `consume` |
| `trigger` | `size [w, d, h]`; `safe: true` makes it a safe zone (no one sees the player in it) |
| `spot` | `rot` (start points, stage marks, look targets, routes) |

Every room also gets an invisible volume, so `enter <room>` works.

**Little things** (docs/IMMERSION.md): a kettle, a hob, a pot, a cup, a cigarette, a clock, a phone, a tap... have a
**life**: states they move through by themselves, what they show and play in each, and what the player can do to them
(a click switches the kettle on). A kit thing has its kit's life (Content/Studio/Life/lives.json says which); any prop can be
given one:

```json
{"id": "kitchen_kettle", "kit": "kettle_jug", "on": "kitchen_counter", "at": [1.4, 0.35], "rot": 180, "state": "off"},
{"id": "kitchen_mug", "kit": "mug", "on": "kitchen_table", "at": [2.1, 1.9], "state": "empty", "liquid": "tea", "from": "kitchen_kettle"},
{"id": "hall_ash", "kit": "ashtray_burning", "on": "hall_table", "at": [3.0, 5.2], "state": "lit"}
```

- `life`: the life it has (the kit's own when it's a kit thing; `false` for none). `state`: where it starts (the
  life's first state otherwise). The lives: `kettle` (off, heating, boiling, boiled), `whistling_kettle` and
  `tetsubin` (on a hob: off, heating, whistling or boiling, cooling), `hob` (off, on, hot), `gas_hob` (off, on), `pot`
  (cold, heating, simmering, boiling, cooling), `cup` (empty, filling, full, cold, drunk), `coffee` (hot, cold),
  `teapot` (empty, full, cold), `cigarette` (unlit, lit, out), `lighter` (off, lit), `candle` (lit, out), `coil` and
  `incense` (lit, out), `clock` (running, stopped), `rice_cooker` (off, cooking, warm), `phone` (off, lit, ringing),
  `tap` (off, dripping, running), `tv` (off, static, on), `fridge` (on, off).
- A state that lasts (`secs` in lives.json) moves on by itself: the kettle boils 30 s after it's switched on, clicks
  off, and cools. A thing that follows stands `on` what it follows: a pot or a stovetop kettle `on` a hob heats while
  the hob is on.
- Its settings: `secs` (how long its states last, `{"heating": 20}`, over the life's), `acts: false` (the player
  can't touch it), and a life's own: `liquid` (a cup or a teapot: `tea green_tea coffee water milk barley_tea soup`),
  `from` (the kettle or teapot it's filled from: Pour needs that one boiled or full), `rings` (a hob's rings that are
  on), `level` (the number on its digits), `light` (a candle's light, `use: light`, lit while it burns).
- The player's acts (a click) are the state's: the kettle's *Switch on*, the cigarette's *Put it out*, the cup's *Pour*. A
  use is heard as `{"use": id}`, and where it leaves the thing as `{"state": id, "is": s}`.

## 3. Scenes (the spine)

A scene is a performed moment. Actors are staged on spots, and it plays as an ordered list of **clips**. **A clip
is one take**, at most `clip_max` seconds. A longer speech is several clips, and every cut between two takes has a
**seam** that hides it.

```json
"s_message": {
  "title": "Mari in the hall", "level": "house", "stage": {"mari": "hall_mari_spot"}, "view": "hall_view_spot",
  "camera": {"mode": "soft", "look": "mari", "cone": [30, 18]},
  "clips": [
    {"id": "c1", "who": "mari", "ja": "……来てくれたんだ。", "en": "...You came.", "act": "lifts her head slowly",
     "body": {"prompt": "slowly raises her head and looks straight ahead", "start": "mari_idle", "end": "mari_idle"}},
    {"id": "c2", "who": "mari", "seam": {"kind": "glance", "look": "hall_lamp"}, "ja": "…", "en": "…", "act": "…"},
    {"id": "c3", "who": "mari", "seam": {"kind": "blink"}, "ja": "…", "en": "…"}
  ],
  "cues": [{"at": {"clip": "c3", "edge": "end", "offset": 0.4}, "do": {"trick": "lights_die", "room": "hall", "secs": 1}}],
  "hold": {"min": 0, "max": 2},
  "sets": [{"flag": "heard_mari"}, {"objective": "Find Father's diary"}],
  "notes": []
}
```

### 3.1 Fields

| Field | Meaning |
|---|---|
| `stage` | `{cast: spot}`: where each actor stands. The runner moves the cast member's stand-in (later their MetaHuman) there at the start and hides them at the end, unless `"stay": true` |
| `view` | the spot where we expect the player: **the camera, since the camera is the player's eye**. It must be a place the player can stand (in its room, not inside a prop, unless that prop is in `camera.through`). It's for the desk, the shot review, the motion jobs (the `player_collar` target) and the playtime estimate; the runner never moves the player there |
| `stance` | the player's eye height in this scene: `stand` (1.65 m, the default) `crouch` (1.05) `kneel` (1.2) `sit` (1.15) `lie` (0.3) `hide` (1.6, in a locker or wardrobe): first person's low and high angles |
| `mood` | `intimate dread panic reveal calm grief chase aftermath`: the recipe (DIRECTING.md §2); the desk can apply its camera and shot defaults |
| `time` | the time of day from this scene on: `day`, `dusk` or `night`. **Left out, the scene keeps the time it was**: the time of the scene it branched from (the nearest scene before it in the flow that set one), back to `game.time` at the start. Stitches play at the time of the scene before them; a stitch whose `chapter` has a `time` (§4: a night's sleep) passes that time on to what comes after it. The desk shows each scene's time on the board (☀ ◐ ☾) and in its picker ("as before: night (from …)"), and lights the stage, the Watch and Play by it (the sky through the windows, the ambient, a light in every window). In Unreal, Light Kit's sky follows it, with UltraVHS's night mode (UNREAL_FLOW §1c). A scene reached at different times by different paths, with no time of its own, is a STORY warning |
| `models` | which model each cast member wears from this scene on: `{"natsu": "lilac eyes"}`, a variant of theirs (§2 `models`) or `"default"` (back to `previs_body`). **Left out, a cast member keeps the model they had**: whatever the scene the flow came from gave them, down every branch after it, until a later scene picks another or sets it back to default (as `time` carries). The desk shows a scene's choice on its board card and in its picker ("as before: …"), and dresses the stage, the Watch and Play by it; the bake writes each scene's bodies for Unreal. Branches meeting with different models on someone in a scene that doesn't pick one is a STORY warning (pick one there) | In Godot the run carries the pick, the stand-in is dressed again and the bake's scene plays on that model's body (GODOT_EXPORT §8).
| `enter`, `exit` | `{"kind": "blend"|"fade"|"cut"|"blink"|"dip", "secs": 0.8}`: how the scene comes in from the game and goes back to it. The default is `blend` (0.8 s): the view eases from wherever the player's eye is into the scene's framing, and at the end the player carries on from the scene's last view, with no black between (GAMEPLAY_PLAN §1). `fade` goes through black; `cut` is for a scare |
| `camera.mode` | `live` (**the eye stays the player's own**, 2026-10-29: where they stood or sat when the scene began, no cut and no shot, the cast acting in the room; standing they look and walk, seated they look within 90° either side of the seat's facing; seams and shots are ignored; the way to watch someone, DIRECTING §1), `free` (the player walks and looks), `soft` (movement stops; the look stays inside a cone round `look`, with a spring back), `hard` (a cinematic camera), `held` (an actor has hold of the player: struggles) |
| `camera.through` | props the camera sees through (a locker's slats): the shot review and the visibility test ignore them |
| `camera.look` | a cast id on stage, or a placed thing |
| `camera.cone` | `[yaw°, pitch°]` either side of `look` |
| clip `who`, `ja`, `en`, `act` | the speaker; the line recorded (Japanese); the subtitle; the acting note for the take |
| clip `think` | `true`: the player's own thought (`who: "player"`), shown in the footer set apart (in brackets, slanted) and never said: no take, no face, and nobody on stage hears it. The desk's screenplay typing writes one as a whole line in quotes (`"She came back."`), as the chart's script does (.claude/skills/chart/script.md) |
| clip `dur` | the take's real length (`story.py durations` or `intake.py` writes it). Without it the length is `dur_tts` (a placeholder voice), else an estimate |
| clip `face: false` | voice only (an offstage or unseen speaker) |
| clip `shot` | the shot size: `ecu cu mcu ms fs ws insert pov_down pov_up` (DIRECTING.md §1). In first person it's a **distance**: how close the actor's face comes to the player's eye (ecu under 0.3 m, cu to 0.55, mcu to 0.9, ms to 1.6, fs to 3, ws beyond). The body check and the shot review measure the clip's closest moment and flag a label it doesn't reach |
| clip `cam` | `{"push" 0..0.35 (the player leans in, metres), "zoom" 0..0.15 (a held focus), "roll" degrees, "shake" 0..2, "look" (another target: the reaction shot), "lag"}`. There is no `fov`: the lens is the game's (`game.fov`, 90° horizontal) |
| clip `body` | the body animation, generated from text (§3.5) |
| clip `event` | a quick-time event after the clip (§3.6): `{"type": "press"|"mash"|"hold"|"breath"|"aim"|"struggle"|"choose", "secs", "prompt", "warn", ...}`. Its result goes to a result choice (§5) and/or runs `on` actions |
| `cues` | actions anchored to a clip's `start` or `end` plus an `offset` (seconds, may be negative). **Cues never use absolute times**, so a longer take carries its cues along |
| `faces` | the cast's expressions over the scene, a row per character: each placed on a clip edge as a cue is (§3.7) |
| `hold` | seconds the scene waits after its last clip (an idle loop, the player can look round) before the flow moves on |
| `sets` | actions when the scene ends (flags, objectives, doors) |
| `variants` + `pick` | prototype versions of the same moment (§3.3) |

### 3.2 Seams (how a cut between two takes is hidden)

`seam` goes on the clip *after* the cut. The cheapest options come first in this table. TRICKS.md has the craft.

| `kind` | What the player gets | Fits |
|---|---|---|
| `blink` | a 0.15 s black blink, as if their own eyes closed | anything; the default |
| `glance` (`look`) | **deprecated** (DECISIONS 2026-10-29: the eye turned for the player breaks the immersion; a STORY warning): the soft camera drifted to `look` for about a second while the cut happened off-screen, then back | nothing new |
| `flicker` | the lights stutter, and the cut sits in the dark frame | lit rooms with a practical light |
| `occlude` | something passes between the player and the actor (a swinging lamp, smoke, another figure) | staged moments |
| `cutaway` (`look`) | **deprecated** (as `glance`): a hard cut to an insert (hands, an object, a photo) and back | nothing new |
| `turn` | the takes end and begin with the actor turned away or head down (written into the take's acting note) | any camera; costs nothing |
| `stumble` | the player is jolted (shake, look down) | after a scare or a struggle |
| `dip` | a longer fade through black (time passes) | between beats of one scene |
| `jcut` | the next line's voice starts while the face is hidden (pairs with the others) | dialogue |
| `heartbeat` | a vignette pulse and heartbeat; the frame softens for a moment | dread |
| `none` | no cover: only for two clips cut from one continuous take | |

### 3.3 Variants: prototyping one moment several ways

```json
"s_cellar": {"title": "Who knocked", "pick": "a", "variants": {
  "a": {"label": "from the dark", "stage": {"mari": "cellar_mari_spot"}, "clips": [...]},
  "b": {"label": "behind you", "stage": {"mari": "cellar_behind_spot"}, "clips": [...], "cues": [...]},
  "c": {"label": "only the voice", "stage": {}, "camera": {...}, "clips": [...]}}}
```

- A variant overrides any of `stage`, `camera`, `clips`, `cues` and `faces`.
- `pick` is the one that plays, unless `pick_by: "found_at"` names it by where the player was caught (§9.8); such
  variants may also set `view` and `stance`.
- The checks prove every variant, and `story.py clips --all` lists every variant's takes, so all of them can be
  recorded and compared in the game before choosing.

### 3.4 Elastic timing

A scene's length is the sum of its clips (real takes once they exist), its seams, its events, and its hold.
Nothing inside a scene uses an absolute time:
- cues ride on clip edges
- body animations are sized to their clip
- stitches aren't timed at all

**So a longer take never breaks the flow:** run `intake.py` (or `story.py durations`), and the timeline, cues,
motions and estimates follow.

### 3.5 Bodies

```json
"body": {"prompt": "lunges forward two steps and grabs with the right hand", "secs": null, "start": "mari_idle", "end": "mari_idle",
         "path": ["cellar_mari_spot", "cellar_grab_spot"], "reach": {"hand": "right", "to": "player_collar", "at": 0.5}}
```

- `secs` defaults to the clip's length.
- `start` and `end` blend from and to a pose (a `motions` id, `idle` or `tpose`).
- `path` gives the stage marks the feet must travel.
- `reach` locks a hand onto something: `{"hand": "right" | "left" | "both", "to": "player_collar" | "player_face" | <a
  placed thing>, "at": 0.5, "from": 0.25, "until": 1, "offset": [x, y, z]}`. The hand eases on between `from` and
  `at` (fractions of the clip), holds until `until`, then lets go; `both` puts the hands either side of the target.
  In the desk it's an IK layer over whatever animation plays (blocking or Kimodo), and the body check says when the
  target is out of arm's reach from the mark; Kimodo jobs get it as an end-effector target.

**Blocking** (posed and previewed in the director, previs skeleton, Content/Studio/poses.json):

```json
"body": {"block": [{"at": 0, "pose": "head_down"},
                   {"at": 0.5, "pose": "lunge", "ease": "snap", "move": "cellar_grab_spot"},
                   {"at": 0.85, "pose": "grab_pull", "ease": "out", "walk": false}],
         "mods": [{"type": "twitch", "amount": 0.25}, {"type": "snap", "at": 0.6, "secs": 0.15}],
         "fit": "stretch", "blend": 0.25, "bridge": {"secs": 0.6}, "file": "Pilot_s_grab_main_c1.json"}
```

| Field | Meaning |
|---|---|
| `block` | pose keys along the clip: `at` 0..1 (or `s` seconds), a `pose` from the library, the `ease` into it (`linear in out inout snap hold overshoot`), `walk` (stride while travelling), `move` (travel to a spot by this key) |
| `mods` | time modifiers, applied in order: `ease {in, out}`, `speed {x}`, `ramp {from, to}`, `hold {at, secs}`, `snap {at, secs}`, `twitch {amount}`, `trim {in, out}`, `loop {from, to, times}`, `mirror` |
| `secs`, `delay` | the action's own length against the take (default: the clip's length) and how long after the take starts it begins: set by hand in the desk when the director's action and the take don't line up |
| `fit` | when a generated motion's length differs from the take: `stretch` (×0.8 to ×1.25), `hold`, `loop`, `pad`, `trim` |
| `blend` | seconds of crossfade from this actor's previous clip (default 0.25), from the pose that clip had reached when it was cut (not its unplayed end). Wherever a generated motion (a walk, a turn) left the actor, the next clip starts there and faces that way; blocking ends where its keys put them. The desk draws each blend as a light wedge over the clip's start |
| `bridge` | an in-between from the previous clip's last pose to this one's first: the desk blends it, `motion.py` makes a Kimodo job for it |
| `layers` | parts of the body played from another motion or a pose, over this one, in order (ANIMATION.md §0c): `[{"mask": "upper", "pose": "arms_crossed", "from": 0.2, "to": 0.7}, {"mask": "right_arm", "file": "x.json", "fit": "hold"}]`. `mask`: `upper` (from the waist up), `arms`, `left_arm`, `right_arm`, `head`; `file` (a made motion) or `pose` (from the library); `from`, `to` the window (0..1 of the clip; 0 and 1); `fade` seconds in and out (0.3; none at the clip's own edges); `weight` 0..1 (1); `fit` how a motion meets its window (`loop`, or any of fit's). The part leans and turns with the body under it and keeps that body's proportions; the bake for Unreal carries it like the rest |
| `file` | the generated motion (`Content/Games/<Game>/Motion/<file>`, made by `motion.py preview` or `import`; picked in the desk's **motion** box from the ones made, which says its length or that it isn't made yet): it plays instead of the blocking |

`tools/motion.py jobs` turns these into Kimodo jobs: the prompt, the constraints, and the blocking as full-body pose
keyframes, so the generated motion follows the staging approved in the desk. ANIMATION.md has the rest.

### 3.6 Events (quick-time events; DIRECTING.md §4)

**Only `choose` is current.** `press`, `mash`, `hold`, `breath`, `aim` and `struggle` are **deprecated** (DECISIONS
2026-10-27: they break the immersion): they still play, the story check warns, the desk offers only `choose`. A
moment that used one becomes a dialogue answer (`choose`, its `default` the silence) or a plain scene.

```json
"event": {"type": "struggle", "secs": 4, "pull": "back", "need": 0.6, "prompt": "Pull free!", "warn": 0.6,
          "on": {"escape": [{"door": "front_door", "set": "unlock"}]}}
"event": {"type": "choose", "secs": 5, "prompt": "", "options": [{"id": "lie", "label": "Lie"}, {"id": "truth", "label": "Tell her"}], "default": "truth"}
"event": {"type": "breath", "secs": 5, "prompt": "Keep still", "warn": 0.8}
```

| `type` | Fields | Results |
|---|---|---|
| `press`, `mash`, `hold` | `key` (E), `need` (mash) | success, fail |
| `breath` | (don't move the mouse) | success, fail |
| `aim` | | success, fail |
| `struggle` | `need` 0..1 (how many presses: about `need` × 20), `pull` (`back left right down any`: the way she's thrown off and the camera leans, not an input); camera `held`. The player mashes E (or Space, or the left button); escape as soon as the bar fills | escape, caught |
| `choose` | `options [{id, label}]`, `default` (taken on timeout: silence is a choice) | the option ids |

- `warn` shows an "!" that many seconds before.
- `on` runs actions per result.
- A result choice right after the scene branches the flow.


### 3.7 Faces: expressions on the timeline

The cast's faces come from **the expression library** (`Content/Studio/Expressions/<id>/expression.json`: a captured
face's ARKit curves, docs/EXPRESSIONS_PLAN.md), placed on the scene's timeline per character. Like a cue, each rides
a clip edge (never a time of its own), so a longer take carries it along:

```json
"faces": [{"who": "mari", "expr": "pout_and_glance", "at": {"clip": "c2", "edge": "start", "offset": 0.4}},
          {"who": "mari", "expr": "pout_and_glance_loop", "at": {"clip": "c3", "edge": "start"}, "in": 0.5, "w": 0.8}]
```

| Field | Meaning |
|---|---|
| `who` | a cast member (on the scene's stage) |
| `expr` | the expression's id in the library: a capture, or **a loop** cut from a range of one (it loops by itself, its end crossfaded into its start: the Expressions tab's preview, *Save the range as a loop*) |
| `at` | `{clip, edge, offset}` as a cue's: where it starts |
| `secs` | its length on the row: a capture stretched to it, a loop run for it. Left out, a capture plays its own length and **a loop runs until the next one on the row takes over** (or the scene ends) |
| `loop` | `true` plays any capture over and over; `false` plays a loop once. Left out, as the expression is |
| `in`, `out` | seconds it fades in over (0.25) and out over (0.3). One that runs into, or touches, the next on its row is **taken over**: the two crossfade over the next one's `in` |
| `w` | its weight (1; 0 to 2) |
| `speed` | faster or slower than its length (1) |

Where nothing is placed the face is at rest. The desk shows a face row per character under the clips (an expression
dragged from the Expressions tab onto it, a block dragged along it, a click for the rest); the stage, the Watch and
Play play it on each body that carries MHR's face (the desk's MHR bodies, a Studio export); the bake carries every
frame's 72 face weights to Unreal (`face` in preview.json). The check: `who` in the cast, `expr` in the library, `at`
a clip of this version, the numbers in range.

### 3.8 Body tracks: what a cast member does across lines

A scene's cue whose action is a `behave` (§4: `idle` at a spot with a `pose` or `face`, `sit`, `go` to a spot by way
of `via` and `then` idle or sit, `path` along a route, `patrol` along routes, `off`; a looped `motion` while she stands,
sits or walks) drives that cast member **from its clip edge until her next one or the shot's end**, over whatever her
clips' bodies would have done: a state that outlives a motion (after the walk, she sits on the chair till the shot
ends), a patrol round and round, someone walking in (she needn't be on the scene's `stage`). It's Play's own behaviour,
replayed from the cue: it starts where her last one left her, else at her mark as far as her clip had moved her, so
a walk's end carries into it. HANDOFF_DIRECTOR_TODO §4.

```json
"cues": [{"at": {"clip": "c2", "edge": "start"}, "do": {"behave": "aoi", "as": "go", "to": "lobby_bench_spot", "then": "sit"}}]
```

The desk draws them as **body rows** under the face rows, a block per cue from its edge to the next (dragged along,
it rides the nearest clip edge; a click opens it; a double-click adds one), and the stage, the Watch, Play's scenes
and the bake for Unreal play them. Once her track starts it has her for the rest of the shot (`sees` is Play's:
nobody is caught in a scene). The story check holds them to §4's rules (the spots, the routes, the motions).

## 4. Stitches (the player's tasks)

```json
"t_search": {"title": "The diary and the key", "level": "house", "goal": "Find the cellar key", "target_min": 6,
             "template": "code", "beats": [...]}
```

- A stitch is the old beat language. It starts with `{"start": true}` and ends when a beat runs `{"done": true}`.
- `target_min` is its intended share of the playtime (the animatic uses it, and the estimator works the real one
  out).
- `template` names its kind, for reuse. TRICKS.md §4 lists the stitch templates.

**A beat:**

```json
{"id": "b_key", "when": {"pickup": "cellar_key"}, "if": ["!cellar_open"], "optional": false, "secret": null,
 "do": [{"trick": "knock", "at": "cellar_door", "count": 3}, {"done": true}]}
```

A beat's actions run in order. The ones that take no time (a flag, a task, the power, a door, a line shown...) run
together, before another beat that hears the same event is looked at; one that takes time (`wait`, `fade`, an `ask`,
a `name`, a `chapter`, a triggered `scene`, a timed trick) holds the rest of its beat until it's over, and other beats
go on meanwhile. So a list that a `{"ticked": true}` beat waits on should be whole from the start: a task added after a
`wait` can come too late, when everything before it was already ticked and the stitch has ended. A stitch's beats
hear an event before its to-do list does, so a beat on the same moment as a task's tick runs its instant actions (the
door slams as the fuse is taken); but the stitch ends the moment its last task ticks, so whatever that beat does after
something that takes time never comes (its scene's end, its `name`, a trick's end). A task whose beat takes time ticks
with `{"tick": "<id>"}` at the end of that beat, not by its own trigger (the story check warns).

**Triggers (`when`):**

| Trigger | Fires when |
|---|---|
| `{"start": true}` | the stitch starts |
| `{"enter": room_or_trigger}`, `{"exit": ...}` | the player enters or leaves it |
| `{"use": id}` | the player interacts with it |
| `{"pickup": item}`, `{"read": note}` | the item is picked up, the note is opened |
| `{"look": id, "secs": 1, "within": 8}` | it's been looked at that long, within that distance |
| `{"after": beat, "secs": 5}` | another beat ended, plus a delay |
| `{"flag": name}` | the flag is set |
| `{"all": [...]}`, `{"any": [...]}` | a combination |
| `{"caught": true}`, `{"caught": "mari"}` | the player is caught (by anyone, or by that cast member): a cast member who `sees` (`behave`) filled the suspicion meter, or found them in a hiding place her route `check`s |
| `{"hidden": true}`, `{"hidden": locker}` | the player is in any hiding place, or in that one (`use: locker`); holds while they stay |
| `{"answered": ask}`, `"option": answer` | an `ask` was answered (any answer, or that one) |
| `{"carrying": id}`, `{"carrying": true}` | the player is carrying it (`use: carry`), or anything; holds while they do |
| `{"played": table}`, `"result": "lose"` | a board game at that table (`use: game`) ended: any result, or that one (its game's `results`). A result is chance, so a beat that needs one is `optional` or `secret` (the check warns otherwise): set a flag, and let the flow branch on it |
| `{"dropped": id}`, `"in": room_or_trigger` | it was put down and has settled (anywhere, or inside that room or trigger on its level): put the doll back in its bed, the box on the shelf |
| `{"state": thing, "is": s}` | a little thing is in that state (by itself, the story or the player); holds while it is: `{"state": "kitchen_kettle", "is": "boiled"}` |
| `{"arrived": cast}`, `"at": spot` | a cast member got where a `behave` `go` sent her (anywhere, or that spot); holds while she's there (§9.12) |
| `{"ticked": task}`, `{"ticked": true}` | that task on the to-do list is ticked, or (true) the list is through: nothing on it open (each ticked or failed); holds while it is |
| `{"failed": task}`, `{"failed": true}` | that task is failed, or (true) any task is; holds while it is |
| `{"power": "off"}`, `{"power": "on"}` | the level's power is out (a `power` action or the player at a breaker) or on; holds while it is |
| `{"peeping": door}` | the player's eye is at that door's peephole (`peephole: true`); holds while it is |
| `{"locked": door}` | that door is locked: its `latch` turned, its `locked_by` key not yet used, or a `door` `lock`; holds while it is |
| `{"torch": "on"}`, `{"torch": "off"}` | the player switched the flashlight on or off with **F** (either: `any` of both) |
| `{"rolled": die, "face": 6}`, `"at_least": 5` | a die (`use: roll`) settled; no face means any roll. A roll is chance, so a beat that needs a face is `optional` or `secret` (the check warns otherwise): `{"when": {"rolled": "big_die", "face": 6}, "secret": true, "do": [{"flag": "lucky"}]}`, then a flag choice sends `lucky` down a side path that rejoins the main line (§5) |

**Actions (`do`, one verb each):**
- `say`, `think`, `sound` (`at`), `music` (`silence calm uneasy dread chase`)
- `name`: **the player types their name** (`{"name": "What's your name?"}`: the question over the box; `default`: the
  name kept when nothing is typed, else `game.player_name`). From then on `{name}` in anything shown (a clip's `en`, a
  line, a thought, an answer, an objective, a to-do, a note) is that name; before it, `game.player_name` ("Alex" when
  unset). It's kept with the run (a checkpoint has it). The walker counts 8 s for the typing. Not in Unreal yet
- `light` (`set`: `on off flicker dim`; or `room`), `door` (`set`: `lock unlock open close slam`)
- `sweep`: a room: a car passes its windows that have a `sweep` now (§2), the headlights across the ceiling.
- `power`: `off` cuts the level's power (every bulb and lamp dark, the switches dead; candles and fires burn on), `on`
  brings it back, flickering up; `level` names another level than the player's. The check warns at a cut nothing
  brings back (no breaker, no `power: on`)
- `torch`: **the player's flashlight** (DECISIONS 2026-10-28): `on`, `off`, `flicker` (a stutter, then on), `dead` (it
  flickers out, and F only clicks until `works`: new batteries). An item with `"torch": true` is a flashlight: picked up
  (`use: pickup`) or given (`give`), it goes in the pocket, not the inventory's row, and **F** switches it (heard as
  `{"torch": "on"}` or `"off"`); its beam comes from the right hand and follows the look a moment late. Its own settings
  ride on the item, `"torch": {"kelvin": 3200, "cone": 20, "range": 12, "strength": 6}` (an old warm one; the default
  is 5200 K, a 26° cone, 18 m). Taken away (`take`), it goes off. The check fails a `torch` with no flashlight item
- `skin`: **a cast member's skin** (DECISIONS 2026-10-29; docs/GODOT_LOOK.md §5): `{"skin": "aoi", "wet": 0.7,
  "sweat": 0.5}`: `wet` the sweat film (a sheen, the skin a touch darker), `sweat` beads standing on it, `drips` runs,
  `oil` oiled up, each 0..1 (left out: unchanged; 0 takes it off). From a beat, a scene's cue or an answer's `do`; it
  stays on her bodies (the stand-in's, a scene's) till set again. Out in the rain (`game.weather`, a room with no
  ceiling) a cast member wets by herself, toward 0.8 in a few seconds, and dries in about a minute once she's in,
  unless the word has set her: then hers is hers till the word changes it. The Godot export plays it on the skin shader; the
  desk's stage draws it the same way on her body (the clay MHR body, a Studio export's skin, the figure of cylinders:
  `tools/shared/skinwet.js`) in Play and in the Watch (a scene's cue at its clip edge); Unreal not yet
- `show`, `hide`, `move` (`to` a spot), `objective`
- `state`: a little thing to one of its states, `{"state": "kitchen_kettle", "to": "heating"}`: in a beat, a scene's
  cue (on its clip edge: what lasts counts from there) or an answer's `do`. States carry on through the run
- `flag`, `unflag`, `give`, `take`
- `wait`, `fade` (`in`/`out`, `secs`), `lookat` (`secs`, `lock`)
- `skip`: **time skipped** (missing time; HANDOFF_DIRECTOR_TODO §7): `{"skip": 5400}` (seconds: an hour and a half, a
  week at most): every little thing lives through it at once, as if each had been that much longer in its state (a
  clock's hands jump on, 02:10 to 03:40; the tea goes cold; a cigarette burns down), and nothing else moves. In a beat,
  a scene's cue (on its clip edge) or an answer's `do`. The walk runs each one's timers through it from its state's
  start
- `shot` (`closeup`, `who`, `line`), `seq` (a level sequence), `anim` (`clip`: a motions id)
- `stalker` (`spawn despawn patrol hunt chase`, `at`, `route`)
- `behave`: what a cast member does in play, until another `behave` (or a scene takes them and hands them back):
  `{"behave": "mari", "as": "path", "route": "r_hall"}`. `as`: `idle` (`at` a spot, `pose`, `face` a thing, a cast
  member or `player`), `sit` (`at`), `path` (`route`: a level's route or a list of spots; `mode`, `speed` m/s,
  `from`: `nearest` or `first` point), `patrol` (`routes`: walks each once, then the next; `pick`: `order` or
  `random`), `go` (`to` a spot, by way of `via`, then `then`: `idle` or `sit` there; heard as `arrived`, §9.12),
  `off` (gone). Not AI: the same steps every time, so a player can learn them.
  `motion` (any of them but `off`): a `motions` id she plays, looped: while she stands (`idle`) or sits, or while she
  walks a `path` or a `patrol` (then `in_place`: the route moves her; a point's `pose` at its waits). Until its
  Kimodo take is made, the desk plays its `block` stand-in, else the pose; Unreal plays the take (its `name`).
  `sees`: she watches for the player (`true`, or some of `angle` 90 (the cone's full width), `range` 9 m,
  `crouched` 0.55 (the reach for a crouched player), `meter` 1.2 s (to fill), `drain` 1.5 s, `calm` 3 s (after a
  catch)). In her cone, in reach and in her line of sight, the suspicion meter fills; out of it, it drains; full,
  `caught` fires. Hidden (a locker) or in a safe zone, she doesn't see the player, unless a route point `check`s
  that locker (`{"at": "hall_back", "wait": 2, "check": "hall_locker"}`): there, she finds them.
- `trick` (TRICKS.md §2), `checkpoint` (an autosave in Play)
- `chapter`: **a chapter card** (nights as chapters; DECISIONS 2026-10-27, late night): the view goes dark, the title
  is held up in the middle (`{"chapter": "Night 2", "sub": "23:40", "time": "night"}`: `sub` small under it, `secs` how
  long it's held, 3 by default), the time of day changes behind it (`time`, from here on: the scenes after the stitch
  keep it, §3.1), the game autosaves (`save: false` for none), and the view comes back; a player asleep in a bed
  (`use: sleep`) wakes there and gets up. A night that gets worse: sleep in the bed, "Night 2 · 23:40", the same house a
  little wrong
- `scene`: a **triggered scene**. It plays a scene in the middle of the stitch, started by what the player does
  (walking into a place, sitting down, using a thing), blended in from where they are and back out to play, and the
  stitch goes on. `{"when": {"use": "sofa"}, "do": [{"scene": "s_talk"}]}`. Its `sets` and events count as usual. A
  scene that should end the stitch or branch the story is a flow node instead (or an interrupt).
- `ask`: a **question with answers**, asked in play. The question is the footer's line, like every line: `line` (a
  line id: spoken, the speaker's name above) or `text` (a thought); the answers sit right under
  it at the bottom centre of the frame, in one panel, the dashes between them (DECISIONS 2026-10-27, notes: the lines
  are text, so the question reads on into its answers), while the camera's focus holds on `who` (a cast member's face)
  or `on` (a placed thing it's about). A reply in a scene (§9.9) and a timed choice show theirs the same way. 2 to 4 `options`, each `id`, `label`, `ja` (optional, small over the label) and `do`
  (actions run when it's picked). `secs` times it, with `default` (an answer's id) taken when time runs out. Picking
  one is heard as `{"answered": ask, "option": id}`, so a later beat in the stitch can follow it; to branch the
  story, the answer's `do` sets a flag and a flag choice (§5) follows it.
  `{"ask": "q_stay", "line": "mari_014", "who": "mari", "options": [{"id": "stay", "label": "I'll stay", "do": [{"karma": 1}]}, {"id": "go", "label": "I should go"}], "secs": 8, "default": "go"}`.
  The walker (STORY, the playthrough's timing) answers with the `default`, else the first.
  A reply inside a scene (§9.9) is the scene's own; `ask` is for the player's tasks.
- `todo`: a task on **the to-do list** (the HUD's list under the objective; DECISIONS 2026-10-27, late night): a
  shift's chores, a request, done in any order. `{"todo": "mop_floor", "text": "Mop the floor"}`; it's ticked by a
  `tick`, or by itself when its own trigger fires (`ticks`: `{"todo": "kettle", "text": "Boil the kettle", "ticks":
  {"state": "kitchen_kettle", "is": "boiled"}}`). It can be **failed**: by `fail`, by its own trigger (`fails`:
  `{"caught": "mari"}`), or by its time running out (`secs`, counting down on the list). A failed task stays on the
  list struck out in the bad colour. `on`: `{"done": [actions], "failed": [actions]}` run when it's ticked or failed
  (set a flag there to branch the flow on it later, §5). `who`: the cast member who asked (a request, §9.12).
  `hidden: true`: kept, timed, ticked, failed and heard like any task, but not on the HUD's list (a task the player
  only knows of from their thoughts: "I should clean up before she gets here"). Ticked
  and failed are heard (`ticked`, `failed`). The list is kept with the run, through the stitches, until `untodo`
  takes a task off (`{"untodo": "mop_floor"}`) or clears it (`{"untodo": true}`).
  `tick`, `fail`: `{"tick": "mop_floor"}` ticks an open task, `{"fail": "mop_floor"}` fails it.
  The walker (STORY) does every task it can (its `ticks` when they can fire) and fails only what the story fails.
- `done`, which ends the stitch

## 5. The flow

```json
"flow": {
  "n_arrive":  {"type": "stitch", "ref": "t_arrive", "next": "n_message"},
  "n_message": {"type": "scene",  "ref": "s_message", "next": "n_search"},
  "n_knock":   {"type": "choice", "by": "act", "prompt": "Open the cellar, or hide?", "options": [
                 {"label": "Open the cellar door", "when": {"enter": "cellar_stairs"}, "to": "n_cellar"},
                 {"label": "Hide in the locker",   "when": {"use": "hall_locker"},     "to": "n_hide"}]},
  "n_hide":    {"type": "stitch", "ref": "t_hide", "next": "n_cellar"},
  "n_grab_result": {"type": "choice", "by": "result", "of": "n_grab", "options": [
                 {"result": "escape", "to": "n_after"}, {"result": "caught", "to": "e_bad"}]},
  "n_after":   {"type": "choice", "by": "flag", "options": [{"if": ["found_photo"], "to": "e_secret"}, {"to": "e_good"}]},
  "e_good":    {"type": "ending", "kind": "good", "title": "Out of the house"},
  "e_bad":     {"type": "ending", "kind": "bad", "title": "Stay with me", "short_ok": true}
}
```

**Choices:**
- **`act`:** the player decides by doing. The first option whose trigger fires wins. No menus: open the door, or
  get in the locker. The player can still act in the world while it waits (use a key, read a note).
- **`flag`:** the story decides from what happened. The first option whose `if` holds wins, and the last option is
  the fallback.
- **`result`:** an event's outcome. `of` names the scene node (`event`: a clip id, when the scene has several);
  every result needs an option.

**Branching and rejoining:** branches may rejoin (`n_hide` → `n_cellar`). Loops need a flag choice to leave.

**On the desk's board:** a node's `xy` is where it sits on the director's desk's flow board (`[x, y]`, pixels at 100%).
The desk writes every node's once you move one (until then they're laid out in reading order); nothing else reads it.
The story's `frames` are the board's acts: `[{"id": "f_act1", "title": "Act 1: the house", "color": "#8a63d2", "nodes":
["n_arrive", "n_message"]}]`, a coloured frame behind each group of cards, moved and folded together on the desk; a node
is in one act at most. Only the desk reads them.

**A cut flow** (sliced on the desk's board while it's reordered, HANDOFF_DIRECTOR_TODO §2): a scene's or task's `next`
may be `null` and a choice's option's `to` empty: the flow's cut there. Until it's joined again the checks say so as
**warnings**, never errors (the cut, the cards nothing reaches, an ending no path reaches, "no path reaches an ending
yet" in STORY's line), the walk stops at the cut, and the Watch ends there with a card saying the flow's cut; a `next`
or `to` naming a node that doesn't exist is still an error.

**Endings:** `kind` is `good neutral bad secret other`. `short_ok` exempts an early death ending from `target_min` and
`fast_min`.

### 5.1 Timed tasks and trigger cutscenes

**A timed stitch** feels like urgency, yet a fast player still spends time:

```json
"t_flee": {"title": "Get out", "timer": {"secs": 25, "label": "Before she gets up", "fail": "e_bad"}, "beats": [...]}
```

If the stitch isn't `done` in time, the flow jumps to `fail`. The checks:
- play both outcomes
- warn when a typical player needs longer than the timer
- fail when even a fast player can't make it

**Interrupts** are trigger cutscenes, as in Alien Isolation:

```json
"interrupts": [{"id": "i_doll", "label": "Takes the doll", "when": {"pickup": "doll"}, "during": ["t_search"], "to": "n_doll"}]
```

- While a listed stitch runs (`during`, or `"all"`), the trigger jumps the flow to `to`: usually a scene, then an
  ending.
- Triggers include `pickup`, `use`, `enter`, `look`, `flag`, and `caught` (the stalker).
- The checks' greedy player leaves bait alone on the main path and plays each interrupt as its own branch.

## 6. The checks (each ends `<NAME> ok`)

**Offline:** `python tools/check_all.py [--game G]` runs, for every game:

`story_check.py`:
- every reference and field
- walls and doors
- **clips within `clip_max`** (a recorded take over it is an error; an estimate over it is a warning to split
  before recording)
- **a seam on every cut**
- subtitles at no more than 17 characters a second
- combination codes written down
- body specs and motions
- the directing rules: a cue before every reveal, scare spacing, forced looks held no more than 2.5 s
- **every path played by a greedy player:**
  - every choice both ways
  - every event both ways (every option of a timed choice)
  - every timed stitch both ways, and every interrupt
  - secrets both missed and found
  - every path must reach an ending with no softlock
  - every ending must be reachable
- **playtime per ending, typical and fast:** the shortest path to every ending not marked `short_ok` must reach
  `target_min` (typical) and `fast_min` (fast)
- shot sizes, cameras, events, blocking (poses exist, eases, modifiers, fits), moods, transitions, timers, interrupts
- times of day: `game.time` and each scene's `time` are `day`, `dusk` or `night`; a scene without one that different
  paths bring at different times is a warning
- a task that would end its stitch before its own beat is done (its `ticks` the trigger that starts a beat that takes
  time, in a stitch that ends when its list is through): a warning, unless that beat opens the way to another task (§4)
- faces: `who` in the cast, `expr` in the expression library, `at` a clip of the version, the numbers in range (§3.7)
- replies: two answers or more (past three a warning), unique ids, each answer's lines spoken by the cast, its `go` one
  of the four and pointing at a later line of the scene or a card on the board (§9.9)
- `--route` writes the main path's steps for the playthrough bot

`level_check.py`: overlaps, props in walls, blocked doorways, standing room at interactables.

`shots_sheet.py --plan`: the shot review's rules that need no pictures.

**In the editor (SETUP builds them):**
- the import
- `PLAYTHROUGH ok` (the bot)
- `SHOTS ok` (pictures at every scripted look, scene start and seam)
- `MOTION ok` (generated bodies hit their marks)

## 7. Notes: how the user and Claude pass ideas

Any scene, stitch or flow node can carry `"notes": [{"by": "user"|"claude", "text": "...", "at": "2026-10-20", "done": false}]`,
and `board` holds notes for the whole game.
- The user writes them on the director's desk (Notes tab, or under any node).
- Claude reads them with `python tools/story.py --game G notes`, answers with notes of its own (`by: "claude"`),
  and sets `done` on what it has handled.

Notes are the conversation that lives with the work.

## 8. The shot review

A shot is the player's eye at every `lookat`, `glimpse`, `jumpscare`, `swap`, `knock`, `whisper`, `slam_behind`
and `cut_away`, at every scene's start (from its `view`), at every seam with a `look`, and at each room's entrance.
`storykit.shots.take(G)` takes the pictures; `tools/shots_sheet.py --game G` measures them and makes one contact
sheet per stitch, scene and level (`Saved/Story/<G>/Shots/`).

**Measured (fail):**
1. The camera isn't inside, or within 15 cm of, a wall, prop or door.
2. At least 70 % of the subject is in frame. In a close-up, the eyes sit within 0.05 of the upper-third line.
3. At least 6 of 9 rays from the eye reach the subject (pictures only).
4. The subject reads: its screen box is at least 0.08 bright, or 1.6 times the frame's mean (pictures only).
5. No stand-in on screen within 3 m unless it's the subject.

**Flagged:**
- subjects under 0.2 % of the screen
- room entrances that are nearly black

**By eye, with the user:**
- the next goal is the brightest thing in a room's entrance shot
- the way out shows unless it's a trap
- scares go quiet, cue, payoff, release
- a chapter peaks in its last third
- 2 minutes with no threat after a chase
- cast look at the player's eye height
- subtitles never cover a face

Report failures as `s_message/s_message.c2.1: rule 4: hall_lamp too dark`, fix them in story.json, rebuild, and
re-shoot that beat only (`storykit.shots.take(G, beat=...)`).

## 9. Format 3: the v2 pipeline (docs/PIPELINE.md)

`"format": 3` keeps everything above and adds the fields below. `Content/Games/Sample/story.json` uses all of them.

### 9.1 The game

| Field | Meaning |
|---|---|
| `clip_max` | **8** by default: MiniMax's audio holds for 7 to 9 s |
| `subtitles` | the subtitle languages, `["en", "zh"]`: every clip with `ja` needs each |
| `karma` | `{"axes": {"karma": {"min": -10, "max": 10, "label": "..."}}}`: one axis by default; more if the story needs them |
| `no_death` | **true** by default: an ending only comes from a karma choice or a node marked `final` (§9.4) |
| `voice` | `ja` (the default): the lines are recorded takes in Japanese. **`none`**: no recorded voices, the lines are text typed on screen (EXPRESSIONS_PLAN §3; DECISIONS 2026-10-27, night): the check asks for no `ja`, and MiniMax makes only the faces |
| `draft` | **true** while the game is a rough outline (the writers' room's Build, docs/WRITERS_ROOM.md §7): its scenes hold only their key lines, so the playtime targets (`target_min`, `fast_min`) are warnings, not errors. Take it out once the scenes are written in full |
| `prototype` | the writers' room session it was built from (`Content/Prototypes/<id>`): Build again replaces only a story built from that session (or with its force) |

### 9.2 Lines (a clip after the Japanese pass)

```json
{"id": "c3", "who": "mari", "en_draft": "But if you hear knocking... don't open it.",
 "ja": "でも、ノックが聞こえても……開けないで。", "ja_note": "close and urgent, the last three words almost soundless",
 "en": "But even if you hear knocking... don't open it.", "zh": "但是，就算听到敲门声……也别开门。",
 "expr": "frightened expression, eyes wide and lips trembling", "voice": "whispers"}
```

| Field | Meaning |
|---|---|
| `en_draft` | the English as you refined it (the first pass); kept for reference |
| `ja` | the line as recorded, written for Japanese (register, endings, silences), not translated word for word |
| `ja_note` | how it's said, as a film director would give it: breath, pace, where the pause falls, what's held back |
| `en`, `zh` | the subtitles, **translated from the Japanese** |
| `expr` | the facial expression for MiniMax, as visible movement (docs/VOICES.md) |
| `voice` | how it's said for MiniMax: `says`, `whispers`, `says angrily`, `screams`... (docs/VOICES.md keeps the list and what's been tested) |
| `trim` | `{"in": s, "out": s}`: dead air cut from the take's start and end (the auto-clean writes it); the clip's length is `dur` minus the trim |

Cast members get `subject` (`she` or `he`) for the prompts. Without `dur`, a clip's length is estimated from the
Japanese (about 6.5 morae a second, plus its pauses: `storylib.ja_secs`). `python tools/story.py --game G minimax`
prints each take's prompt: `she makes a <expr> while she <voice> <d>[Japanese] <ja> </d>`.

### 9.3 Timed choices and karma

```json
"event": {"type": "choose", "default": "o_silent", "options": [
  {"id": "o_kind", "label": "No. I came for you.", "ja": "ううん。君に会いに来た。", "zh": "没有。我是来见你的。", "karma": 1},
  {"id": "o_ask", "label": "Why did you call me here?", "ja": "どうして呼んだの？", "zh": "你为什么叫我来？", "karma": 0},
  {"id": "o_silent", "label": "(Say nothing)", "ja": "（黙っている）", "zh": "（沉默）", "karma": -1}]}
```

- `secs` is **30** unless given. The timeout takes `default`: silence is an answer, and can carry karma.
- `karma` on an option is a number (the default axis) or `{"axis": n}`. A `karma` action does the same from beats,
  cues and `sets`: reactions count (`{"karma": -2}` for taking the doll).
- A karma choice needs no result choice after it: the karma is what it's for. It can still branch with one.

### 9.4 Endings by karma, deaths and the branch map, easter eggs

```json
"n_end": {"type": "choice", "by": "karma", "options": [{"min": 2, "to": "e_good"}, {"max": -2, "to": "e_bad"}, {"to": "e_neutral"}]},
"e_caught": {"type": "ending", "kind": "death", "title": "Found three times", "retry": "n_hide1"}
```

- **Endings:** good, neutral, bad, decided by karma (DECISIONS 2026-10-20).
- **Deaths** (DECISIONS 2026-10-21): an ending of kind `death` is a game over that opens the **branch map** (the
  desk and the game alike): every node the player has reached, the ones they've missed shown as locked silhouettes,
  and `retry`, the branch it suggests returning to (it must lie on the way to the death). The player can return to
  any reached node; the state there (flags, karma, counters) is what it was when they first arrived. Deaths don't
  count for `target_min` or `fast_min`.
- `game.no_death: true` brings back the old rule for a game that wants it (an ending only from a karma choice or a
  node marked `final`; missed tasks guide the player on).
- **Easter eggs** come from what the player found, not karma: a flag choice on a secret's flag leads to its scene,
  which **blends back** into the main story (the check warns when an egg's branch never rejoins the fallback's node).

### 9.5 Bodies: the animation budget and Kimodo segments

```json
"body": {"tier": "simple", "segments": [
  {"name": "sample_message_c2_01_walkforward", "prompt": "A tired person walks forward slowly", "secs": 4,
   "path": ["hall_mari_spot", "hall_mari_near_spot"]},
  {"name": "sample_message_c2_02_glanceleft", "prompt": "A person standing still glances to the left", "secs": 2}]}
```

| Field | Meaning |
|---|---|
| `tier` | `simple` (80% of the game's motion), `activity` (15%), `action` (5%); `hero: true` for the detailed few. The check reports the split |
| `segments` | the Kimodo motions that make this clip's body, in order: each one behaviour, **2 to 10 s**, its prompt starting "A person" (or "A scared person"...), never saying where to look |
| segment `name` | what you save it as in Kimodo: `<game>_<scene>_<clip>_<nn>_<verb>` (docs/KIMODO.md §3); unique, or `reuse: true` |
| segment `path` | stage marks the root travels through (a 2D root path constraint) |
| segment `keys` | `[{"at": 0..1, "pose": ...}]`: full-body keyframes from the pose library for poses Kimodo doesn't know |
| segment `loop` | the demo's Loop checkbox (idles, walk cycles) |
| segment `blend` | seconds it blends in from the segment before (0.25; 0 cuts): inertial, so this one plays at full speed while the join fades |
| segment `file` | the made motion (`motion.py import` writes it, or the demo's Send to Studio named after the segment). A clip plays as soon as any of its segments is made: one not made yet holds where the last one ended for its `secs` |

### 9.6 The look and the trackers (where a head points)

Kimodo can't aim a head, so the look is a layer on top of whatever body plays (desk now, Control Rig in Unreal):

```json
"look": {"mari": {"at": "player", "limit": [70, 20, 30], "past": "hold"}},
"trackers": {"t_noise": {"height": 1.0, "keys": [{"clip": "c1", "at": 0, "to": "hall_mari_spot"}, {"clip": "c1", "at": 1, "to": "hall_walk_spot"}]}}
```

| Field | Meaning |
|---|---|
| scene `look` | per actor on stage, for the whole scene; a clip's own `look` (same fields) wins while it plays |
| `at` | `player` (the eye at the view spot), a tracker, someone on stage, or a placed thing |
| `limit` | `[yaw, up, down]` degrees the head may turn from the chest's facing (70, 20, 30 by default) |
| `past` | beyond the limit: `hold` at the edge (still trying to see you) or `snap` back to forward |
| `lag` | seconds the head trails a moving tracker (0.25) |
| `w` | 0..1, how much of the turn to apply |
| scene `trackers` | invisible boxes a head can follow: `height` above the floor, and `keys` that **ride clip edges** (`clip`, `at` 0..1 of it, `to` a spot, a thing or `[x, y, z]`), eased between keys; never scene time |

The turn is shared down the body: spine 10%, chest 15%, neck 25%, head 50% (on Kimodo's skeleton: neck 25%, head
25%). The desk shows trackers as small blue wire boxes.

### 9.7 The procedural idle

Nothing is a statue: under every pose the desk adds breathing (faster in `panic` and `chase`), a slow weight shift
and small head moves, seeded per cast member and slowed by the scene's mood (`dread`, `grief`, `intimate`). It runs
at full strength while an actor holds still (between lines, during a 30 s choice, while a scene holds) and at 40%
under a moving body. Unreal gets the same layer (plan W9); no field is needed.

The checks: every karma route is played (the kind, the cruel and the silent player at every timed choice, each
with secrets missed and found) and each one's ending and karma are printed; every ending must be reachable.

### 9.8 Gameplay between scenes (`play`)

Simple rules the Roblox generation knows (REFERENCES.md §5): a stitch with `play` is one round of a mechanic, and
its result branches like an event's.

```json
"t_hide1": {"title": "Hide and seek, round 1", "level": "house", "template": "hide", "beats": [],
            "play": {"type": "hide", "secs": 40, "rule": "Hide before she finishes counting to ten",
                     "warn": "she counts out loud, eyes covered", "spots": ["hall_locker"], "on": {"found": [{"count": "found"}]}}},
"n_hide1_r": {"type": "choice", "by": "result", "of": "n_hide1", "options": [{"result": "hidden", "to": "n_hide2"}, {"result": "found", "to": "n_r1_cute"}]}
```

| `type` | Results | The round |
|---|---|---|
| `hide` | hidden, found | a warning, seconds to get into a hiding place; staying too long can turn on you |
| `run` | escaped, caught | a chase to a door the player has seen |
| `collect` | done, failed | tick a short list (items, chores) while she's around |
| `sneak` | made_it, spotted | move only while she isn't looking (or while she can't hear) |
| `hold` | held, broke | keep still, hold the breath, hold the door |
| `search` | found, out_of_time | find one thing before the time's up |
| `escape` | out, caught | get out by a route, against the clock |

- `secs` is the round's length; `rule` the one line a child could say; `warn` what tells the player it's coming;
  `spots` the hiding places or targets (placed things); `on` runs actions per result.
- **The seeker and her assets** (what the round needs made, beyond the scenes):
  - `seeker`: the cast member hunting.
  - `loops`: `{role: motions id}`, her non-cinematic motions by role (`wait count search patrol chase found idle`):
    Kimodo motions in the `motions` table with a `name` (on the shot list), usually `loop: true` and
    `in_place: true` (exported without the root's travel; the game moves her along her route).
  - `barks`: `{moment: [lines ids]}`, what she calls out (`start count search near found lost taunt chase`): lines in
    the `lines` table (each a take named by its id; `face: false` when heard from hiding, an off-screen voice for
    MiniMax). Give a moment two or three lines so it doesn't repeat; the runner picks one at random.
- **Deaths by hiding spot:** a death scene with `"pick_by": "found_at"` and a variant per spot (named by the spot's
  id; each can set its own `stage`, `view`, `stance`, `camera` and `clips`) plays the variant for where the player
  was caught, else `pick`. Every variant is checked, listed for takes and on the Kimodo shot list.
- A play stitch needs no beats and no `done`: its result ends it. A result choice after it branches; without one,
  the first result (the player's success) plays on.
- On the desk it's a card before the next scene: the rule, the timer, and buttons for each result ("did you manage
  to hide?"). In Unreal each type is a template Blueprint the runner starts (RUNNER_SPEC.md).

### 9.9 Replies and hanging lines

A reply is a small dialogue choice that mostly changes what she says back: two answers or more, at the bottom centre
under her line, in English only (no Japanese over it, DECISIONS 2026-10-27, notes: other languages come from a system
that changes the whole dialogue). The clip it's on is a **hanging line**:
she asks, then waits, her face doing the waiting. Three answers make an **L.A. Noire close-up** (the writers' room's talk,
WRITERS_ROOM §2): her face answers yours before her words do (`then.expr`), and a player who watches it learns what she
really wants. More than three are allowed (the check warns: a close-up reads best with two or three). The player never
speaks a line (DECISIONS 2026-10-28, noon): an answer is an act with the thought behind it, `[ Greet ] She's cold...`.

A scene's lines with their replies are **a conversation card** (the desk's script, its Reply tab): each answer has her
reply as a line or a few, and says where the talk goes then (`go`): on to the next line, a later one, its end, or another
card on the board (HANDOFF_DIRECTOR_TODO §1).

```json
{"id": "c1r", "who": "mari", "ja": "今日、どうだった？", "en": "How was your day?", "wait_expr": "hopeful, expectant expression",
 "reply": {"wait": 6, "timeout": null, "options": [
   {"id": "good", "label": "Smile", "think": "It was fine, really.", "then": {"ja": "そう……よかった。", "en": "Good...", "expr": "...", "voice": "says softly"}},
   {"id": "bad", "label": "Look away", "sets": [{"flag": "told_bad_day"}], "go": {"clip": "c4"},
    "then": [{"ja": "かわいそう。", "en": "Poor thing."}, {"ja": "こっちにおいで。", "en": "Come here."}]},
   {"id": "leave", "label": "Leave", "think": "Not tonight.", "then": {"en": "Oh. Goodnight, then."}, "go": {"node": "n_alone"}}]}}
```

- `think`: the player's thought that goes with the answer, shown under it smaller (`{"id": "greet", "label": "Greet",
  "think": "She's probably cold, I should let her inside"}`): the answers can be acts, each with the thought behind it,
  instead of words said (the writers' room's notes write them as `[ Greet ] She's probably cold...`).
- `then` is her answer to that reply: a clip (its own take, `<take id>_<option id>`), or a list of clips (a few lines,
  their takes `<take id>_<option id>`, then `_2`, `_3`...), each the same `who` unless it says (someone else may answer).
  None: she says nothing back.
- `go`: where the conversation goes after her answer:
  - `"next"` (the default): the scene goes on with its next clip, the line it was always going to say;
  - `{"clip": id}`: on from a later line of this scene, the lines between skipped (a conversation only skips forward:
    the check says so);
  - `"end"`: the conversation ends there: the scene's hold, its `sets` and its exit, then the flow's `next`;
  - `{"node": id}`: another card on the board: the scene ends as `"end"` does, and the flow goes there instead of its
    `next` (the board draws the arrow, dashed blue; a card reached only this way is reached). In a triggered scene (a
    beat's `scene`) it just ends the scene: play carries on.
  The check plays every answer that goes somewhere else than its sweep's answer on a path of its own.
- `wait` (6 s by default, 2 to 15): how long she waits. Past it her answer is skipped (`timeout: null`), or a
  `timeout` option's answer plays (an answer to your silence).
- `sets`: actions when the reply is picked (a flag, karma, a count), so a reply can open a branch later through a
  flag choice; most set nothing and are there so it feels like you.
- `wait_expr`: the face she holds while she waits, for the take's end (MiniMax).
- An answer that sets a flag a flag choice reads **opens a branch** (an ending decided by the last answer): the check
  plays each such answer on a path of its own, whatever the karma sweeps would have said.

### 9.10 Counters

`game.counters: {"found": {"label": "times she found you"}}`; the `count` action (`{"count": "found"}` adds 1;
`"add"` or `"set"` for others) from beats, cues, `sets`, replies and plays; and a flow choice `by: "count"`
(`{"count": "found", "min": 3, "to": "n_caught"}`, the last option the fallback). The sample's hide and seek: cute
the first time she finds you, a tease the second, the third is a death.

**The HUD's theme** (Play mode, docs/GAMEPLAY_PLAN.md §10): `game.ui_theme` names a file in
`tools/director/play/ui/themes/` (`glass`, barely-there frosted glass, when a game names none; `glass-rose`, the same in warm romance colours; `neumorph`, the older light kit; `plain`). A theme sets
only colours, radii, shadows and the font; the layout is the same for every game.

**The camcorder look** (docs/VHS.md): `game.vhs` names UltraVHS's preset the game is shot on, `camcorder` (clean),
`camhybrid` (the user's, 2026-10-29: the camcorder with less fisheye and its blur mostly with distance, what's close
nearly sharp; the strength they picked from seven), `worn` or `nightmare`; left out or `off`, the picture is as it is. The Godot export plays it as a shader over the picture
under the HUD (its black turning blue at night, the menu's Film grain capping the noise); Unreal's UltraVHS component
takes the same preset. The desk doesn't show it yet (VHS.md §9).

**The look** (docs/GODOT_LOOK.md): `game.look` names the look plugin's preset the Godot export plays under, `realism`
(the default: baked bounce with the effects overplayed: screen-space reflections, ambient occlusion and indirect
light, a little glow, a thin haze, AgX, temporal anti-aliasing) or `plain` (all of it off). `game.weather`: `rain`
puts rain in every room with no `ceiling`, its floor wet with pools that carry the lights and the rain's rings,
splashes where it lands, the shelf's rain heard there (all round you once you're in the room, at the room's middle
from indoors) and every step in that room wet (the desk's Play the same); `clear` (the default) nothing; a level's
own `weather` (§2) overrides it, and a level's own `look` (§2) overrides `game.look`. A `clean` stain of kind
`blood` wears the plugin's blood: a
pool with a ragged edge and flung drops, glossy, fading as it's scrubbed.

**Hiding places' default:** `game.see_through` (0..1), how much of a locker's slats are gaps when the locker doesn't say.

### 9.11 Room acoustics

`"acoustics"` on a room: one of `closet bathroom bedroom small_room kitchen living_room hallway stairwell basement
large_hall church outdoors car`. Without it the room's size, floor and ceiling pick one (`storylib.acoustics_of`).
The importer puts an AudioVolume with that preset's reverb in each room, so voices and steps sound like the place
(docs/UNREAL_FLOW.md).

### 9.12 Requests (someone asks, waits, then carries on)

A request (DECISIONS 2026-10-27, late night) is a to-do task (§4) with a `who`: she asks for something, it goes on the
list with her name beside it, she waits, and when it's done she **carries on into the next shot herself**: walks to the
sofa and sits down, and the story goes on from there. No new scene is needed for her leaving. The quick task "Someone
asks for something" (the desk's Quick tasks) writes it:

```json
"t_tea": {"title": "Tea for Mari", "level": "house", "template": "request", "beats": [
  {"id": "b_req_ask", "when": {"start": true}, "do": [
    {"behave": "mari", "as": "idle", "at": "kitchen_door_spot", "face": "player"},
    {"say": "mari_tea"},
    {"todo": "req_kettle", "text": "Put the kettle on", "who": "mari", "ticks": {"state": "kitchen_kettle", "is": "boiled"},
     "on": {"done": [{"behave": "mari", "as": "go", "via": ["hall_end"], "to": "sofa_spot", "then": "sit"}]}}]},
  {"id": "b_req_done", "when": {"arrived": "mari", "at": "sofa_spot"}, "do": [{"untodo": "req_kettle"}, {"done": true}]}]}
```

- **`behave` as `go`**: she walks to `to` (a spot), by way of `via` (spots on the way: through a door, round a table;
  she walks straight from one to the next), then stays there: `then: "idle"` stands facing the spot's rot (or `face`),
  `then: "sit"` sits. `speed`, `motion` (played while she walks, in place) as for `path`.
- **`{"arrived": cast, "at": spot}`**: she's got where a `go` sent her (anywhere, or that spot); holds while she's there.
  The task ends on it, so the flow's next node (a scene on the sofa) starts with her already sitting there.
- A request can fail like any task (`fails`, `secs`, `fail`): her `on.failed` can walk her off somewhere else, or set a
  flag the flow branches on.
- The walker (STORY) does the request, sends her where `go` says and counts a few seconds for the walk.

### 9.13 Achievements

```json
"achievements": {
  "ach_turned_away": {"title": "Turned Away", "text": "Some photos hide a second one.", "for": {"secret": "s01"}},
  "ach_handover": {"title": "Ready at Three", "text": "Hand over what was promised.", "hidden": true, "for": {"ending": "e_handover"}},
  "ach_clean": {"title": "Clean Counter", "text": "Finish every chore on the sheet.", "for": {"flag": "feat_clean_counter"}}
}
```

One for each secret, one for each ending and a few small feats (DECISIONS 2026-10-27, last thing: "niche easter eggs
... which unlock achievements"). `for` is what unlocks it: a secret found (its `flag` set), an ending node reached, or
a flag set anywhere (a feat: set it where the feat happens). `title` is what the player sees; `text` a hint that
doesn't spoil; `hidden: true` keeps the title back until it's unlocked. The check names one that no path unlocks (a
feat whose flag nothing sets yet is a warning). The desk's Watch and Play say each one in the corner as it's
unlocked. Steam's list is made from this table; Unreal: not yet.

### 9.14 What's shown, by what's happened: words, lines and faces (HANDOFF_DIRECTOR_TODO §7)

One **condition**, everywhere it's needed, in a choice option's own shape: `if` (flags, `!flag` for not) and a
counter's `count` with `min` and/or `max`; with neither it always holds.

- **Words:** `game.words` fills `{word}` in anything shown (a line, a thought, an answer, an objective, a note, a cast
  member's `name`), as `{name}` is the player's: `{"her": [{"count": "remembered", "min": 2, "say": "Natsuki"}, {"say":
  "Natsu"}]}`, the first option that holds, the last the fallback. A `{word}` that is neither is a STORY warning.
- **A line left out:** a clip with a condition plays only when it holds on the run (`"if": ["!took_pills"]`: her lines
  about Ren off his pills); the walk leaves it out where it doesn't. The desk's script shows every line.
- **Two faces for one character:** a face placement (§3.7) with a condition is worn only when it holds: his version
  and hers at the same lines, picked by a counter.
- **An answer offered by what's happened:** a reply's answer (§9.9) or an ask's (§4) with a condition is offered only
  when it holds (`{"id": "home", "label": "Home"}` always, the others `"if": ["took_pill"]`: off his pills only Home is
  offered). Leave one without a condition (the check warns when every answer has one); a timed ask whose `default`
  isn't offered takes the first that is. The walk answers from what's offered.
- **An ending's title card:** an ending's `text` is what its card says under the title, as long as it needs (an
  epilogue); the ending's scene before it is the cutscene.
- A cue or a face on a line that's left out goes with it.
- **On the desk:** a line's Line tab (*said only if*), an answer in the Reply tab (*offered only if*) and a face row's
  block (*worn only if*) carry a condition as chips (+ a flag, + a count); the Database's Flags & counters tab keeps the
  game's **Words** (each word's choices in order, the last the fallback); an ending's inspector has its **words**. The
  Watch and Play fill and leave out by the run; the desk's script shows every line.

### 9.15 Thoughts that type themselves out: memory flickers and retyping (HANDOFF_DIRECTOR_TODO §7)

A thought (a `think` action, or a player's line with `think: true`) can type itself out, letter by letter (28 a
second, a pause after punctuation):

- **`breaks: true`, a memory flicker:** it types out, its last letters break up (glitching, in the bad colour) and
  it's gone before it's read: `{"think": "Cold water. Her hands on my—", "breaks": true}`. Write it up to where it
  breaks.
- **`retype`, a thought correcting itself:** typed, held a moment, erased back to where the two part, and typed again
  as these words: `{"think": "Natsuki.", "retype": "Natsu."}`. Both at once: retyped, then broken off.

A thought with neither shows whole, as before. Its time is its typing and a moment to read (`storylib.typed_secs`, the
desk's `play/typing.js`: the same numbers); a scene's thought clip is as long as that. Only thoughts type themselves
out (the check refuses `breaks` or `retype` on anyone's spoken line). On the desk: the Line tab of a thought (*breaks
off*, *then erased and retyped as*) and the Think command's fields.
