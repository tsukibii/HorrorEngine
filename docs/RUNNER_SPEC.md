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
- **Replies (format 3):** after a clip with `reply`, two prompts at the bottom of the screen, left and right (the
  Japanese over the English, in the player's language), for `wait` seconds while her face holds (`wait_expr`, then
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
| done | ends the stitch |

**Interaction:**
- Class-mapped template Blueprints call `NotifyUse` through a small interface (one call each, added through MCP).
- Greybox `use:*` blocks get the runner's own 2 m interact trace.
- Widgets (UMG, kept plain): subtitles, the objective, the note reader, the keypad, the inventory, the ending card,
  the debug HUD.

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
