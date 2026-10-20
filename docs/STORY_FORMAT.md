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
| `game` | `id`, `title`, `start` (a flow node), `target_min` (the shortest *typical* path to a normal ending must reach it: **150** for a real game), `fast_min` (the shortest *fast* path must reach it: **120**, Steam's refund window; cutscenes can't be skipped, so they count fully), `voice` (`ja`), `text` (`en`), `clip_max` (seconds one take can be: **10** for MiniMax), `fov` (the player's horizontal field of view, 90 by default: the one lens), `previs_body` (the desk's default body) |
| `cast` | `{id: {name, metahuman (asset path or null), height, shape, measures, skin, previs_body}}`: `shape` is up to 45 MHR identity numbers (the desk's Shape page writes it; zero is the average body), `measures` the body's widths in cm at that height (`{height, shoulders, chest, waist, belly, hips, thighs, arms}`, the Shape page writes them too) and `skin` a hex skin tone: what `tools/metahuman.py` gives MetaHuman Creator (docs/METAHUMAN_ROUTE.md); `previs_body` a file in `Content/Studio/Bodies` (default: MHR.fbx; after the MetaHuman is rigged, its exported body) |
| `items`, `notes`, `sounds` | `{id: {name, shape, inspect}}`, `{id: {title, text}}`, `{id: {file}}` |
| `lines` | one-off voice outside scenes (`say`, `whisper`): `{id: {who, ja, en, mood, dur}}` |
| `levels` | the world (§2) |
| `scenes` | the spine (§3) |
| `motions` | reusable body animations: `{id: {who, prompt, secs, loop}}`, e.g. idles and walks (§3.5) |
| `stitches` | the player tasks (§4) |
| `flow` | the graph (§5) |
| `secrets` | `{id: {flag, hint}}`: easter eggs; a beat that finds one says `"secret": id` |
| `interrupts` | trigger cutscenes (§5.1): something the player does during a stitch jumps the flow to a scene, usually a death |
| `board` | notes for the whole game (§7) |

## 2. The world

**A level:**

```json
{"start": "start", "rooms": [...], "links": [...]}
```

- Each level becomes one map: `/Game/Games/<Game>/Maps/L_<level>`.
- `start` is a spot.

**A room:**

```json
{"id": "kitchen", "at": [0, 6, 0], "size": [4, 4, 2.8], "floor": "tile", "light": "dark", "skip": ["s"], "ceiling": true,
 "openings": [...], "props": [...]}
```

- `size` is `[w (x), d (y), h]`.
- `floor` is `wood stone carpet tile dirt metal water`: it sets footsteps.
- `light` is `off dark dim lit`: a mood note for the lighting pass.
- `skip`: two touching rooms share one wall, and **exactly one of them skips it**.
- `ceiling: false` for outdoors.
- `look`: library texture sets for its surfaces, `{"floor": "ambientcg/WoodFloor041", "walls": "...", "ceiling": "..."}`
  (docs/ASSETS.md). Grey until fetched.

**An opening:**

```json
{"wall": "n", "at": 2.0, "w": 0.9, "h": 2.1, "sill": 0, "door": {"id": "cellar_door", "locked_by": "cellar_key", "swing": "out", "creak": true}}
```

- `at` is the opening's centre, measured from the wall's west end (n and s walls) or south end (e and w walls).
- `window: true` is a hole with a `sill`.
- `locked_by` is an item, or `flag:<name>`.

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

**A prop:**

```json
{"id": "kitchen_photo", "shape": "box 0.2 0.02 0.25", "at": [2.3, 2.1], "rot": 0, "on": "kitchen_table", "z": null,
 "tag": "photo", "hidden": false, "art": null, "use": "inspect", "text": "..."}
```

- `on`: rests on that prop.
- `z`: height above the floor, for things on walls or ceilings, and lights.
- `art`: the asset that replaces the block, scaled evenly to fit it: an Unreal path (`/Game/...`) or a library ref
  (`basemesh/food_prep_table`).
- `mat`: a library texture set on the block (`ambientcg/Wood049`).
- `tag`: what it is, for the art shopping list.

**Uses:**

| `use` | Fields |
|---|---|
| `pickup` | `item` |
| `note` | `note` |
| `inspect` | `text`, optional `line` |
| `switch` | `light` |
| `light` | `kind` (`bulb candle lamp fire`), `lit`, `flicker` 0..1, `lumens`, `radius`, `kelvin` (place with `z` or `on`) |
| `locker` | (hide inside) |
| `combo` | `code` (written in some readable text), `then` (a flag), `opens` (a door) |
| `use_on` | `needs`, `then`, `consume` |
| `trigger` | `size [w, d, h]` |
| `spot` | `rot` (start points, stage marks, look targets, routes) |

Every room also gets an invisible volume, so `enter <room>` works.

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
| `enter`, `exit` | `{"kind": "fade"|"cut"|"blink"|"dip", "secs": 0.6}`: how the scene comes in from the game and goes back to it (default fade 0.6 s; `cut` for a scare) |
| `camera.mode` | `free` (the player walks and looks), `soft` (movement stops; the look stays inside a cone round `look`, with a spring back), `hard` (a cinematic camera), `held` (an actor has hold of the player: struggles) |
| `camera.through` | props the camera sees through (a locker's slats): the shot review and the visibility test ignore them |
| `camera.look` | a cast id on stage, or a placed thing |
| `camera.cone` | `[yaw°, pitch°]` either side of `look` |
| clip `who`, `ja`, `en`, `act` | the speaker; the line recorded (Japanese); the subtitle; the acting note for the take |
| clip `dur` | the take's real length (`story.py durations` or `intake.py` writes it). Without it the length is `dur_tts` (a placeholder voice), else an estimate |
| clip `face: false` | voice only (an offstage or unseen speaker) |
| clip `shot` | the shot size: `ecu cu mcu ms fs ws insert pov_down pov_up` (DIRECTING.md §1). In first person it's a **distance**: how close the actor's face comes to the player's eye (ecu under 0.3 m, cu to 0.55, mcu to 0.9, ms to 1.6, fs to 3, ws beyond). The body check and the shot review measure the clip's closest moment and flag a label it doesn't reach |
| clip `cam` | `{"push" 0..0.35 (the player leans in, metres), "zoom" 0..0.15 (a held focus), "roll" degrees, "shake" 0..2, "look" (another target: the reaction shot), "lag"}`. There is no `fov`: the lens is the game's (`game.fov`, 90° horizontal) |
| clip `body` | the body animation, generated from text (§3.5) |
| clip `event` | a quick-time event after the clip (§3.6): `{"type": "press"|"mash"|"hold"|"breath"|"aim"|"struggle"|"choose", "secs", "prompt", "warn", ...}`. Its result goes to a result choice (§5) and/or runs `on` actions |
| `cues` | actions anchored to a clip's `start` or `end` plus an `offset` (seconds, may be negative). **Cues never use absolute times**, so a longer take carries its cues along |
| `hold` | seconds the scene waits after its last clip (an idle loop, the player can look round) before the flow moves on |
| `sets` | actions when the scene ends (flags, objectives, doors) |
| `variants` + `pick` | prototype versions of the same moment (§3.3) |

### 3.2 Seams (how a cut between two takes is hidden)

`seam` goes on the clip *after* the cut. The cheapest options come first in this table. TRICKS.md has the craft.

| `kind` | What the player gets | Fits |
|---|---|---|
| `blink` | a 0.15 s black blink, as if their own eyes closed | anything; the default |
| `glance` (`look`) | the soft camera drifts to `look` (a flicker, a noise) for about a second while the cut happens off-screen, then drifts back | soft and free cameras |
| `flicker` | the lights stutter, and the cut sits in the dark frame | lit rooms with a practical light |
| `occlude` | something passes between the player and the actor (a swinging lamp, smoke, another figure) | staged moments |
| `cutaway` (`look`) | a hard cut to an insert (hands, an object, a photo) and back | hard and soft cameras |
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

- A variant overrides any of `stage`, `camera`, `clips` and `cues`.
- `pick` is the one that plays.
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
| `blend` | seconds of crossfade from this actor's previous clip (default 0.25) |
| `bridge` | an in-between from the previous clip's last pose to this one's first: the desk blends it, `motion.py` makes a Kimodo job for it |
| `file` | the generated motion (`Content/Games/<Game>/Motion/<file>`, made by `motion.py preview`): it plays instead of the blocking |

`tools/motion.py jobs` turns these into Kimodo jobs: the prompt, the constraints, and the blocking as full-body pose
keyframes, so the generated motion follows the staging approved in the desk. ANIMATION.md has the rest.

### 3.6 Events (quick-time events; DIRECTING.md §4)

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
| `struggle` | `pull` (`back left right down any`), `need` 0..1; camera `held` | escape, caught |
| `choose` | `options [{id, label}]`, `default` (taken on timeout: silence is a choice) | the option ids |

- `warn` shows an "!" that many seconds before.
- `on` runs actions per result.
- A result choice right after the scene branches the flow.

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
| `{"caught": true}` | the stalker catches the player |

**Actions (`do`, one verb each):**
- `say`, `think`, `sound` (`at`), `music` (`silence calm uneasy dread chase`)
- `light` (`set`: `on off flicker dim`; or `room`), `door` (`set`: `lock unlock open close slam`)
- `show`, `hide`, `move` (`to` a spot), `objective`
- `flag`, `unflag`, `give`, `take`
- `wait`, `fade` (`in`/`out`, `secs`), `lookat` (`secs`, `lock`)
- `shot` (`closeup`, `who`, `line`), `seq` (a level sequence), `anim` (`clip`: a motions id)
- `stalker` (`spawn despawn patrol hunt chase`, `at`, `route`)
- `trick` (TRICKS.md §2), `checkpoint`
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

### 9.4 Endings by karma, no dying, easter eggs

```json
"n_end": {"type": "choice", "by": "karma", "options": [{"min": 2, "to": "e_good"}, {"max": -2, "to": "e_bad"}, {"to": "e_neutral"}]}
```

- **Endings:** good, neutral, bad (the bad one may kill the hero: it's the story's end, not a game over).
- **No dying:** a timer's `fail`, a struggle's `caught`, an interrupt and every other edge into an ending is an
  error unless it comes from a karma choice or a node (or its scene or stitch) marked `"final": true`. Guide the
  player on instead: they're found, they wake, they're pulled along (the sample's `s_found`, `s_held`, `s_shut`).
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
| segment `file` | the made motion (`motion.py import` writes it) |

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
