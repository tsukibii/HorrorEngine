# The StoryRunner: what to build in SETUP

The game code, built once in C++ for every game in the studio. It reads a game's story.json at runtime and plays
the flow:
- stitches (beats)
- scenes (clips on an elastic timeline, seams, cues, shot sizes and camera moves, events), **never skippable**
- choices
- endings

Every word in STORY_FORMAT.md is one function here. A word the runner lacks fails loudly (`STORY: unknown verb x`),
never silently.

## Shape

- **`UStoryRunnerSubsystem : UGameInstanceSubsystem`** keeps the state across maps:
  - the game, the current flow node, fired beats
  - flags, the inventory, hidden and moved things, door locks
  - event results, the clock
  - it loads `Content/Games/<Game>/story.json` in the editor (the game comes from the map's path,
    `/Game/Games/<Game>/...`), or `Content/StoryData/<Game>/story.json` in a packaged build
- **`UStoryWorldBinder : UWorldSubsystem`**, per map:
  - finds actors by tag: `story:<id>` for things, `room_volume:<room>` for rooms, `cast:<id>` for stand-ins and
    MetaHumans
  - binds overlaps
  - ticks `look` triggers
  - forwards events
- **Events in:** `NotifyEnter`, `NotifyExit`, `NotifyUse`, `NotifyPickup`, `NotifyRead`, `NotifyLook`,
  `NotifyCaught`, `NotifyStruggle(result)`. After each event, the runner tests the current node:
  - a stitch's unfired beats
  - an `act` choice's options
- **Actions run as latent steps** (a small class each, with `Start()` and `Tick()`/`IsDone()`); beats may overlap.

## Flow nodes

| Node | Do |
|---|---|
| stitch | fire `start`; run beats until one runs `done`; then `next`. With a `timer`: an on-screen countdown (`label`); on expiry jump to `fail`. While it runs, **interrupts** listed for it (or `all`) watch their trigger and jump to `to` |
| scene | stage the cast (move `cast:<id>` to the stage spots, show them); set the camera mode; play the clips (below); run `sets`; un-stage (unless `stay`); then `next` |
| choice `act` | wait until one option's trigger fires (the player keeps playing meanwhile); take its `to` |
| choice `flag` | the first option whose `if` holds |
| choice `result` | the event result recorded by scene node `of` (and its clip, if `event` is given) |
| choice `karma` | (format 3) the first option whose `min`/`max` holds for its `axis` (default `karma`); the last is the fallback |
| choice `count` | (format 3) the same for a counter (`game.counters`) |
| stitch with `play` | (format 3) start the mechanic's template (the `seeker` plays her `loops` by role, moved by the AI along her route; her `barks` play by moment, one picked at random, through the round; on a catch the spot is remembered for `pick_by: found_at`) (hide, run, collect, sneak, hold, search, escape: `/Game/Studio/Horror/Play/BP_Play_<type>`) with its `secs`, `rule`, `warn` and `spots`; its result ends the stitch and is stored like an event's |
| ending `death` | (format 3) the death card, then **the branch map**: the flow drawn as chapters, every node reached (from its checkpoint) and the missed ones as locked silhouettes; `retry` highlighted; returning restores that node's checkpoint |
| ending | the ending card (title, kind), credits, back to the menu; it records that the ending was seen (for secret-ending hints) |

## The scene player (the elastic timeline)

- **Build the timeline at the scene's start from the real assets.** Each clip's length is its voice SoundWave's
  duration (`/Game/Games/<Game>/Audio/VO/<take id>`); without one, the placeholder (`dur_tts`, else the estimate);
  plus seam time and event time.
- **Cues are scheduled at clip edges plus offsets, computed then:** a longer take moves them by itself. Nothing in
  the runner uses an absolute scene time.
- **Per clip:**
  - play the voice (2D for the soft and hard cameras, 3D at the actor for free)
  - the face animation if it exists (`/Game/Games/<Game>/Faces/<take id>`)
  - the body animation (`Anim/<take id>`, else the cast's idle)
  - the subtitle (`en`, lower 20 % of the screen, never over a face: move it up if a close-up's face box reaches
    down)
- **Seams run between clips** (TRICKS.md §1 has the timings), with the next clip's start held until the seam's
  cover is at full:
  - `blink`, `dip`: a camera fade
  - `glance`: the soft camera's look target eases to `look` and back
  - `flicker`: the practical lights in the room drop
  - `cutaway`: a view-target blend to an insert camera
  - `jcut`: start the next voice 0.3 s early
  - `heartbeat`: a post-process vignette pulse
- **The ambient blink:** in soft and hard scenes, a natural blink every 4 to 7 s, so seam blinks don't stand out.
- **Camera modes:**
  - `free`: nothing
  - `soft`: lock movement; clamp yaw and pitch to the cone round `look` (the actor's head socket, or the thing),
    with a spring when input stops, and avoid zones as forbidden yaw ranges
  - `hard`: a view-target blend to a cine camera the importer placed (`shot:<scene>.<clip>`, from
    storykit.shotlib)
  - `held`: the grab (ANIMATION.md §4)
- **Hold:** after the last clip, the idle loops and the soft camera stays for `hold.min` to `hold.max` (it moves on
  early once the player looks away for 1 s past `min`).
- **Variants:** play `pick`. The debug command `Story.Variant <scene> <k>` switches at runtime, to compare takes in
  place.

**Scenes can't be skipped:** no skip input during a scene; pause works. A debug-only `Story.Skip` exists for
testing.

**Transitions:** a scene's `enter` and `exit` (`fade`, `cut`, `blink`, `dip` with `secs`) between gameplay and the
scene: a camera fade, and control taken and given back softly.

**Shots and camera:**
- Each clip's `shot` sets the lens (FOV from DIRECTING.md §1).
- `cam.push` narrows it over the clip; `cam.roll` tilts the camera; `cam.shake` adds noise; `cam.look` holds
  another target; `cam.lag` makes the look trail.
- `pov_down` and `pov_up` pitch the eye.
- `camera.through` props are skipped by the soft lock's line-of-sight test.

**Events (QTEs):**
- Shown after their clip: the prompt, the input (`press mash hold breath aim struggle choose`), a time bar, and
  `warn` seconds of "!" before.
- The result is stored for the scene node, and the event's `on` actions run.
- Inputs map to Enhanced Input actions (Interact, mouse delta).
- **Replies (format 3):** after a clip with `reply`, two or three prompts at the bottom centre under her line (in the
  player's language, no Japanese over them: DECISIONS 2026-10-27, notes; each with its `think` under it), for `wait` seconds while her face holds (`wait_expr`, then
  the idle); picking one runs its `sets` and plays its `then` take; on time out the answer is skipped (or the
  `timeout` option's plays), and the next clip follows. Left and right map to the mouse buttons and the pad's
  shoulders.
- **Checkpoints (format 3):** every flow node the player enters saves the state (flags, karma, counters, inventory,
  the doors) as that node's checkpoint; the branch map (pause menu, and after every death) lists them. Unvisited
  nodes show as silhouettes so the player sees what they've missed; there are no stat gates.
- **Format 3:** a `choose` gives 30 s unless it says otherwise; the options show in the player's subtitle language
  (`label`, `ja`, `zh`); the chosen option's `karma` is added to the run's karma (kept per axis, saved with the
  checkpoint); the idle and the look-at keep the character alive while the player decides. A `karma` verb in beats,
  cues and `sets` adds to it too. A death (an ending of kind `death`) opens the branch map instead of the menu.
- A settings option turns timers off (accessibility): the event waits, then takes `default`, or success for
  press-type events.

## The verbs (beats and cues)

| Verb | Do |
|---|---|
| say, think | the voice and subtitle; think is subtitle-only, styled as the player's thought |
| sound | at the `at` actor, 2D without it |
| music | crossfade among `/Game/Studio/Audio/Music/<state>` (two audio components, 2 s) |
| light | visibility; flicker as intensity × noise; `room` = every light tagged `room:<id>` |
| power | the level's power: off, every light not tagged `kind:candle` or `kind:fire` dark (its own on or off kept), the switches dead; on, they come back with a 0.9 s flicker |
| torch | the player's flashlight (below): on, off, flicker (a stutter, then on), dead (flickers out; `IA_Flashlight` only clicks), works |
| door | a class-mapped door through its interface; a greybox door rotates 95° round its hinge edge; a kit door's leaf has its pivot on its hinges (docs/KIT.md §8), so it turns about its own Z; locked = a rattle and "Locked" |
| show, hide | hidden in game, and collision |
| move | only while unseen (`WasRecentlyRendered(0.2)` false) |
| objective, flag, unflag, give, take | state and the HUD |
| fade | camera fade |
| lookat | eased controller rotation, held, control returned softly |
| shot | blend to the close-up camera for the line, then back |
| seq | a level sequence (a 3 s title card naming it until it exists) |
| anim | play `motions` clip on the actor |
| stalker | the class-mapped stalker with a route of spots |
| trick | the composites in TRICKS.md §3 |
| checkpoint | save slot `<Game>_<n>`: the state as JSON in a USaveGame |
| ask | the question as the subtitle; the answers in one widget floating in the world: beside `who` (their shoulder on the side of the screen with more room, projected each frame), at `on` (a door's handle side, else the actor's bounds' middle), else under the crosshair; the camera's focus on them meanwhile (docs/VHS.md §4); input as the desk's (A/D, 1-9, the mouse); `secs` with `default`; then the answer's `do`, and `answered` is heard |
| state | a little thing's state (docs/IMMERSION.md): its actor (tagged `life:<name>`) told through its life's Blueprint (class_map's `life` table, once made); its timers run on the game's clock, so a kettle switched on boils by itself; `{"state": id, "is": s}` holds while it's in that state |
| done | ends the stitch |

**Interaction** (the desk's Play is the reference: GAMEPLAY_PLAN §10, DECISIONS 2026-10-27, later):
- The controls, as Enhanced Input actions (`CONTROLS` in play/menu.js): `IA_Move` (WASD), `IA_Interact` (the left
  mouse button: every interactable), `IA_Inventory` (E: the row shown or hidden), `IA_InventoryScroll` (the wheel),
  `IA_Drop` (G), `IA_Run` (Shift, forward, standing), `IA_Crouch` (C), `IA_Flashlight` (F, once the player has a
  flashlight), Esc pauses; the pause menu lists them on its left (the flashlight's row only once it's had).
- **The flashlight** (an item with `torch`, play/torch.js the reference): picked up or given, it's held, not in the
  inventory's row. A spot light on a spring arm off the camera (rotation lag about 0.09 s, the beam starting 0.2 m right
  and 0.2 m below the eye), a hot cone (26° full, soft edge) over a wide dim spill (62°, a fifth of the strength), 5200 K
  by default (the item's `torch` settings over it), an IES profile or a light function for the ring a real one has;
  shadows on (cheap: one light). F's click from the shelf (`flashlight_01`, `_02`); `torch` heard as on or off. Off
  while a cinematic plays, back on after it if it was.
- Class-mapped template Blueprints call `NotifyUse` through a small interface (one call each, added through MCP).
- Greybox `use:*` blocks get the runner's own 2 m interact trace.
- A little thing with a life (`life:*`) is used like one when its state has an act (Content/Studio/Life/lives.json):
  the prompt is the act's label, a click moves it to the act's state, and `use` is heard.
- **The breaker** (`use: breaker`): `IA_Interact` throws it (the power off or on for its level, `use` heard); a
  `switch` with the power out only clicks and says No power.
- **The peephole** (a door's `peephole`, play/peephole.js the reference): a lens on both faces of the leaf at its
  height, with a collider a hand wide for the trace; used, the view blends to a camera just outside the far face
  looking out (a cine camera with a wide lens and a fisheye post-process: barrel distortion, a round black mask with
  the brass rim, chromatic fringe at the edge), the look held to a cone (32° by 22°), the HUD away; `IA_Interact` or any
  move takes it back. `peeping` holds while there.
- **The latch** (a door's `latch`, play/latch.js the reference): a thumb turn on the leaf's face in the room that holds
  the door, a hand above the handle, with a collider a hand wide; `IA_Interact` on it locks the shut door or unlocks it
  (its bar turned across or upright, the shelf's `latch`), and from that side `IA_Interact` on the locked door unlocks
  it; from the other side it's locked (its `locked_by` key still opens it). It undoes only its own lock (a door the
  story locked or a `locked_by` door won't turn). `locked` holds while it is, by anything.
- **Cleaning** (`use: clean`, play/clean.js the reference): a stain is a decal (its kind's blot) on whatever it lies on,
  with a box collider for the trace; `IA_Interact` held on it scrubs (a progress ring on the reticle, the decal's
  opacity falling with an ease, a cloth sound every 0.36 s, the held mop or rag worked to and fro); the progress is kept
  per stain (let go, it waits); `with` must be the item in the hand; clean, it's hidden and `use` heard.
- **Footsteps** (a room's `floor`, play/steps.js the reference): the importer gives each room's floor a physical
  material by its word (`PM_Wood`, `PM_Stone`, `PM_Carpet`, `PM_Tile`, `PM_Dirt`, `PM_Metal`, `PM_Water`); the player
  steps every 0.7 m of ground covered (1.05 m running, 0.45 m crouched), a trace down picks the sound by the material
  (a MetaSound picking at random, never the one just played; on wood a creak about one step in twelve), -8 dB walking,
  -4 running, -17 crouched; none in a cinematic, seated, hidden or at a lens.
- **The inventory:** a `pickup` or a `carry` thing used goes into one row (its item given), the newest in the hand,
  held in view; the wheel turns the row, the one in the hand in the middle, at most five shown; Drop sets it down in
  front of the player on whatever is under that spot (no physics fall), facing them, and `dropped` (with the rooms it's
  in) is heard; the item is gone with it. Kept with the run (the checkpoint's inventory: the things, their order, the
  one in the hand).
- Widgets (UMG, kept plain): subtitles, the objective, the note reader, the keypad, the inventory's row (frosted glass
  fading at its ends, no border), the ending card, the debug HUD, the floating prompt and the floating choice
  (play/ui/hud.css is the layout: four places, one rule each).

## Debug (the console), for Claude as much as for you

- `Story.Goto <node>`
- `Story.Fire <beat>`
- `Story.Flag <name>`
- `Story.Give <item>`
- `Story.Variant <scene> <k>`
- `Story.Struggle <need>`
- `Story.State` (prints everything)
- `Story.Reload` (rereads story.json in PIE)
- `Story.Autoplay` (the bot)
- `Story.Hud 1`: a corner overlay with the node, the clip and its time, the next seam, flags and the grab's pull
  value. Every screenshot Claude takes is then self-explaining.

## The playthrough bot

1. `python tools/story_check.py --game G --route Saved/Story/G/route.json` writes the main path's steps: `go id`,
   `use id` (with `code` or `with`), `look id`, `choose` (an act choice's trigger), `event result`, `timeout`, `interrupt`, `expect beat`,
   `scene title`.
2. `Story.Autoplay`:
   - walks with `SimpleMoveToLocation` (the importer adds a NavMeshBoundsVolume per level)
   - faces and uses
   - lets scenes play
   - answers events with the scripted result
   - waits up to 20 s for each expected beat
3. It logs one line per step, ends `PLAYTHROUGH ok (<minutes>)` or `PLAYTHROUGH FAILED at <step>: <why>`, and
   writes `Saved/Story/<G>/playthrough.json`.
4. Run it with `UnrealEditor.exe <project> /Game/Games/<G>/Maps/L_<start> -game -ExecCmds="Story.Autoplay" -log`.
