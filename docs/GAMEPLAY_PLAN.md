# Gameplay: the plan (start here next session)

Written 2026-10-21 from the user's brief (DECISIONS 2026-10-21, "gameplay"). **Desk first**: the director's desk gets a
Play mode you walk through, built as one runtime with pluggable parts, then Unreal's StoryRunner gets the same parts
one group at a time, with the desk as the reference. Nothing here is built yet. Read it, ask the user the open
questions (§9), then start with §8 step 1.

## 1. The feel: Resident Evil 7, never a hard cut

The camera is always the player's eye (CLAUDE.md, DIRECTING.md §1). Every moment sits on one ladder of how much
control the player keeps, and moving between rungs is always a **blend**, never a cut: the view eases from wherever
the player was looking into the scene's framing (and back out), movement slows to a stop rather than freezing, and
control comes back the same way.

| rung | what the player can do | for |
|---|---|---|
| **gameplay** | walk, crouch, look, use things, hide | exploring, tasks, stealth |
| **interactive cinematic** | walk and look freely while someone talks or acts; may get a timed choice | someone folding laundry and talking, a conversation you can walk around |
| **soft cinematic** | movement eases to a stop, the look stays inside a cone round the subject (with a spring back) | the face-to-face line, a reveal |
| **cinematic** | the view is driven; can still hold timed moments (choose A or B, a QTE) | the grab, the scare |

The format has three of these as `camera.mode` (`free`, `soft`, `hard`). Interactive cinematic is `free` with a
scene playing. What's new is the **blend in and out** (secs and ease, per scene, with defaults so most scenes need
nothing) and the rule that a scene never starts or ends on a cut (`enter.kind: cut` stays only as a deliberate scare;
the check flags it).

## 2. The NPCs: behaviours, not AI

During gameplay each cast member runs **one behaviour** (a function with a few settings), switched by the story:

- `idle` at a spot (the procedural idle under a motion), `sit` on a seat, `stand` facing something
- `path`: walk a **route** (`loop`, `pingpong` or `once`), with a pause and a pose at chosen points
- `patrol`: cycle or pick among several routes; the story can swap the set
- `follow` the player at a distance (later)

States (calm, uneasy, hunting...), reusable patterns of them and the motions each state plays (a character's motion
set by style and role, falling back to the pose library): docs/PATTERNS_PLAN.md (a plan, 2026-10-24).

They're set by a beat (`{"behave": "mari", "as": "patrol", "routes": ["r_library", "r_hall"]}`) or per flow node, and
a scene takes the actor over and hands them back to their behaviour when it ends (blended, §1). **Routes** are named
lists of spots with optional waits and poses, drawn in the scene builder on the floor plan. Interactive cinematics
can run a route too (she walks between the shelves and back while she talks). A behaviour's `motion` (the motions
table, **built on the desk 2026-10-25**) is what she plays meanwhile: an idle loop where she stands, an in-place walk
along her route; the desk plays the Kimodo take when it's made, its stand-in blocking until then. In a round, the
seeker's `loops` play by its phase in the Watch (count, then search, then chase), behind the round's card.

**Talking to someone in gameplay** (no dialogue trees): use them and they answer with one of a few lines for the
state they're in: the first time, again, and a reminder of the current objective; in order, then random, then the
last one repeated. A line can instead start a scene, an interactive cinematic or a choice. Mini-games come later.

## 3. Stealth for the first game: crouch, hide, safe zones

- **Crouch**: eye height eases from 1.65 to 1.05 m, slower walk, quieter, harder to see. Toggle or hold (§9).
- **Hiding places** (**built on the desk 2026-10-21**): a prop with `use: locker`: E moves the player inside to its
  `inside` spot (blended; else its middle, facing its `rot`), stance `hide`, the look held to a cone out of it, no
  walking; from inside its walls are **slats** you see through, `see_through` of them gaps (a number, no slider: the
  locker's, else `game.see_through`, else 0.6). E gets out. `{"hidden": true}` holds while inside; a scene played
  from inside keeps the player hidden after it.
- **Safe zones**: volumes (drawn in the builder) where the player can't be spotted. A hiding place is one too.
- **Being seen** (simple, no AI): a view cone (angle, distance; shorter when the player crouches) and a line of
  sight. Outside a safe zone in her cone fills a short suspicion meter, then `caught` fires (the format has it): a
  scene, a death, a checkpoint. Scripted moments can override (she checks a hiding place on a route point).

## 4. What else a game needs (and the first game uses)

- **The interaction point is a cursor** that changes with what's under it (look, open, take, hide, talk, roll), and
  the thing highlights, with a prompt (`E Open`, `E Hide`, `E Talk`). Hold-to-use for some things. Styled by the UI
  theme (§10).
- **Doors**: open and close on their hinges or slides (the kit has them), locked by an item, the tricks (slam).
- **Inventory**: pickups and keys, notes you read; examining an item comes later.
- **Objectives** on screen, set by beats (the format has `objective`).
- **Checkpoints, death and retry**: the format has them; Play mode keeps the branch map's progress as the Watch does.
- **The HUD**: subtitles (English only: DECISIONS 2026-10-27, notes), the prompt, a hidden or seen cue (a vignette, a quiet heartbeat), the
  objective, the timer for timed tasks. A pause menu with the branch map.
- **Sound hooks**: footsteps (quieter crouched: built 2026-10-28, `play/steps.js`), her barks, music states (calm, uneasy, chase) from the score room's
  palette later.
- **Settings**: mouse sensitivity, crouch toggle or hold, subtitle size.
- **For a romance game, the same parts**: conversations are interactive cinematics with timed choices, affection is
  the karma axes the format already has, gifts are items used on someone.

## 5. Built to grow: one registry of parts

Every gameplay word is one small module with the same shape, registered by name, so a future game adds a torch, the
player's hands or a mini-game by adding a file, not by changing the runtime:

- **conditions** (`when`: `enter`, `use`, `pickup`, `look`, `flag`, `caught`, `crouched`, `hidden`...)
- **actions** (`do`: `objective`, `door`, `behave`, `scene`, `hide`, `trick`...)
- **behaviours** (`idle`, `sit`, `path`, `patrol`...)
- **interactables** (`inspect`, `note`, `pickup`, `door`, `hide`, `talk`, `switch`...)
- **player abilities** (`walk`, `crouch`, `hide`, `torch`: the flashlight, built 2026-10-28; `steps`: footsteps, the same day; later `hands`)

The desk's are JS modules (`tools/director/play/<kind>/<name>.js`); Unreal's are C++ classes (or components)
registered by the same names. One file lists every word, its settings and which side implements it
(`Content/Studio/gameplay.json`): story_check fails a story that uses a word missing from it, and says which side
lacks it. That keeps the rule: a new word grows the runtime, the check and STORY_FORMAT.md in one commit.

## 6. What changes where

- **The format** (STORY_FORMAT.md): scene `enter` and `exit` blends and the rung; `behave`; `routes` and safe zones
  in levels; `use: locker` with `inside` and `see_through` (built); talk lines per state; crouch.
- **The scene builder**: draw routes (spots in order, waits) and safe zones; place hiding places with their inside spot
  and its see-through number.
- **The desk**: Play mode (§8), the Watch kept as the quick review.
- **The checks**: the registry; routes reach their spots; every hiding place has an inside spot; no hard cuts unless
  marked.
- **Unreal**: the same parts in the StoryRunner (RUNNER_SPEC.md), replacing the preview's cards a group at a time;
  the preview stays as the review of scenes.

## 7. What stays the same

story.json is the truth; scenes keep their clips, seams and blocking; the desk's bake still feeds Unreal's scene
playback; Generate stays the one button.

## 8. The order

1. **Play mode on the desk** (**walking, collision, crouch, the cursor, doors, pickups, notes, the code lock, beats,
   act choices, timers and interrupts: built 2026-10-21**, `tools/director/play/`, `playtest.js` PLAY ok on the Pilot;
   the neumorphic theme and the physics die next): walk the built level (WASD, mouse look, collision with walls and furniture, stance), the
   CSS UI and its first theme (§10), the physics die,
   the interaction point and prompt, doors, pickups, notes, objectives, beats firing from `enter` and `use`.
2. **Scenes from play** (**built 2026-10-21**: `blend` is the default enter and exit, a beat's `scene` action plays a
   triggered scene and play goes on, `use: sit`; still to do: interactive cinematics where you walk while she talks,
   and Unreal's preview, which fades a blend for now): a beat starts a scene; blended in and out on the ladder (§1); interactive cinematics (walk
   while she talks); timed choices.
3. **NPC behaviours** (**built on the desk 2026-10-21**: `play/behaviours.js`, a `behaviour` part kind; `idle`, `sit`,
   `path`, `patrol`, `off` by the `behave` action; `levels.<id>.routes`; a scene takes the actor and play hands them
   back where they were; still to do: talk lines, drawing routes in the builder, the blend when a scene takes them):
   idle, sit, path on routes; talk lines; routes in the builder.
4. **Stealth** (**built on the desk 2026-10-21**: hiding places with slats, `behave` `sees` (cone, reach shorter
   crouched, line of sight), the suspicion meter under the cursor (1.2 s, drains), `caught` by whom, safe zones
   (`trigger` `safe`), route points that `check` a locker; still to do: drawing safe zones and routes in the builder,
   footstep noise): crouch, hiding places with see-through, safe zones, the view cone and suspicion, caught.
5. **The registry and the checks** (grown alongside 1 to 4, not after).
6. **Unreal**: the same parts in the StoryRunner, a group at a time, Generate carrying routes, zones and hiding
   places across.

## 10. Added 2026-10-21: physics things, the cursor, the CSS UI (DECISIONS)

- **Physics things** (**the die built 2026-10-21**: `use: roll`, the `rolled` trigger, `play/physics.js` on cannon-es;
  no dragging: DECISIONS 2026-10-21, buttons only): an interactable can be `physics` (thrown, rolled, by E). The first test is a
  large die: `when: rolled` with the face that lands up, so a roll at the right moment can open an easter-egg scene
  or a **side path that rejoins the main line** (a flow branch whose last node's `next` is back on the spine). The
  desk needs a physics engine beside three.js (vendored, like three.js). Doors and drawers open and close with E,
  never dragged (the user dropped Amnesia's dragging, 2026-10-21).
- **Things you carry** (**built 2026-10-24**, DECISIONS 2026-10-24; into the inventory since 2026-10-27, later: `use:
  carry`, the `carrying` and `dropped` (`in`) triggers): how a thing follows the hand is a **physics kind**, a part
  (`register("physics", name, ...)` in `play/physics.js`, `inHand` and `follow` its spring): `rigid` follows stiffly,
  `plushie` lags, swings past, squashes and stretches with the hand's acceleration, bobs with the steps and flops its
  top behind a turn (a vertex bend by height, so any imported mesh goes soft; `jiggle` 0..2). A new kind (glass that
  breaks, a liquid that slops) is a new part and a word in `storylib.PHYSICS`. Put down with G it doesn't fall: it's
  set on whatever is under the spot (kept per level, like the die).
- **The controls and the inventory** (**built 2026-10-27, later**, DECISIONS 2026-10-27, later: "typical simple horror
  game mechanics"): **a left click uses** whatever is under the reticle (every interactable: a door, a pickup, a thing
  to carry, a note, a seat, a bed, a hiding place, a switch, a board game, a die, a little thing's act; the prompt's key
  chip is the mouse's button), **WASD** walks, **Shift** runs (forward, standing: `walk.run`, 2.8 m/s), **C** crouches,
  **E** shows or hides **the inventory**, the **mouse wheel** turns it, **G** puts the one in the hand down, **Esc**
  pauses. The inventory (`play/inventory.js`): every thing picked up (a pickup's item, a thing to carry) goes into one
  row at the bottom centre, the newest in the hand; the one in the hand always in the middle, the rest either side
  round a wheel, at most five shown, the farther ones smaller and fading out; a picture of each (rendered from the
  thing itself); in front of frosted glass that fades out at its ends, no border; its name under it. Hidden, it peeks
  for a moment when something changes; it steps aside while someone talks or asks. The one in the hand is held in view
  (a copy of it on its physics kind's spring), put away while seated, hiding, asleep, at a board game or in a scene.
  G sets it down 0.55 m ahead (nearer a wall), facing you, on the floor or a table, and the player no longer has its
  item; set down in another level, a copy of it stays there. A click takes it back. The pause menu shows the controls
  on its left as the Studio's own symbols (DECISIONS 2026-10-28: each key a frosted tile standing on its lip, W A S D a
  pad round the dot that is you, the mouse a pebble without a cable, the button or the wheel it means lit; beside each,
  in the accent, what it does as the HUD shows it: the reticle's ring, the inventory's row, a thing set down, speed
  lines, your eye coming down; `CONTROLS` in `play/menu.js`, each its Enhanced Input action for Unreal).
- **The flashlight** (built 2026-10-28, DECISIONS: "simple game systems we are missing for Chilla's Art style horror
  games"): an item with `torch` is one; picked up or given it's in the pocket, not the row, and **F** switches it (its
  beam from the right hand, a moment behind the look, bobbing with the steps); the story's `torch` flickers it, kills
  it (F only clicks) or brings it back, and hears it switched (`play/torch.js`; RUNNER_SPEC has Unreal's).
- **Cleaning** (built 2026-10-28, the same ask): a stain (`use: clean`, its `stain` kind) scrubbed away by holding the
  left button on it, with the mop or rag in the hand if it says `with`: a ring fills round the reticle, the blot fades,
  and its `use` ticks the chore (`play/clean.js`, `stain.js`).
- **The power cut** (built 2026-10-28, the same ask): `power: off` darkens every bulb and lamp in the level (candles and
  fires burn on) and kills the switches, till the player finds the breaker box (`use: breaker`) and the lights
  flicker back; `{"power": "on"}` hears it.
- **The peephole** (built 2026-10-28, the same ask): a door with `peephole` has a lens on both faces; a click puts the
  eye to it (the other side through a wide lens in a round hole, a little room to look about), a click or a step takes
  it back, and `{"peeping": door}` holds meanwhile: the knock, the look, nobody there (`play/peephole.js`).
- **Footsteps** (built 2026-10-28, the same ask): the player's own steps off the sound shelf by the room's `floor` (wood
  the wooden ones, a creak now and then; stone, tile and metal the hard ones; carpet and dirt the soft ones; water the
  wet ones), a step each 0.7 m of ground really covered (1.05 m running, 0.45 m crouched and 9 dB softer), none
  standing or walking into a wall, never the same sound twice running (`play/steps.js`, the ability `steps`, its
  settings the game's).
- **Board games** (**built 2026-10-24**: `use: game`, the `played` trigger with `result`): the rules are plain
  JavaScript modules in `Content/Studio/BoardGames/` (a game's own in its `BoardGames/`), one file each with a one-line
  JSON `meta` (title, results, settings) and `play(ctx)`, which decides everything and says so through `ctx`: lines,
  choices floating at the table, and pieces (dice, cards, cups, a ball, a revolver) that `play/boardgames.js` draws and
  moves on the game's clock. Seven to start: Russian roulette, high dice, chō-han, spin the cup, find the ball,
  high card, blackjack. `boardtest.mjs` (BOARD) plays each hundreds of times offline. Not in Unreal yet.
- **The UI is CSS, in themes**: `tools/director/play/ui/` holds the HUD as HTML (cursor, prompt, subtitles,
  objective, choices, notes, pause), and every colour, radius and shadow comes from a theme file
  (`themes/<name>.css`: `glass` is the default now, `glass-rose` its warm romance colours, `neumorph` and `plain` stay; the layout's four places, on the thing, the corners, the footer and the middle, are at the top of `hud.css`; Esc opens the pause menu and Esc closes it (closed by Esc it doesn't ask for the pointer lock back: the browser would take that same Esc as leaving the lock and pause again; a click takes it, Resume with Enter takes it at once), `play/menu.js`, whose `SETTINGS` name their Unreal console variables); `game.ui_theme` picks one. The
  neumorphic buttons pop out of the surface and press in when used. Text keeps enough contrast to read over a dark
  frame (neumorphism's weak point). Mini-games are small HTML panels in the same theme.
- **In Unreal later**: either the same HTML through a web widget (CSS stays the truth) or UMG rebuilt from the theme's
  numbers; decided when we port it.
- **The look and post-processing come last**, per game; Unreal doesn't have to match the desk's colour.

## 11. Added 2026-10-21: borrowed mechanics, gaze, one part per idea (DECISIONS)

- **One part per idea, grown by settings.** A part takes a settings object with defaults; a new possibility is a new
  setting or option on the same part, never a near-copy. `gameplay.json` lists each part's settings, so the check
  knows them.
- **Gaze** (romance and horror): the desk already has a clip's `look` (the head follows the player, a tracker or
  someone, with limits; stage.js `lookLayer`). It becomes one `gaze` part for gameplay and interactive cinematics
  too: `at`, `ratio` (how much of the turn the head takes, the eyes and chest share the rest), `limit`, a speed, and
  what happens past the limit. In Unreal, a look-at on the head and neck with the same numbers.
- **The tracker** (after Florence): a named number that interactions add to (`do: {"track": "closeness", "add": 1}`),
  read by conditions (`when: {"track": "closeness", "at_least": 3}`), so it can swap a scene's version, change a
  stitch, or branch the flow. The karma axes already do this for choices; the tracker is the same thing fed by play.
- ~~Physical interaction by dragging (after Amnesia)~~: **dropped 2026-10-21.** Every interactable is a button (E or
  a click); the UI still answers in the theme: the cursor presses in, a locked thing shakes. The grab's struggle is
  mashed (E, Space or the left button), not dragged.
- **From Chilla's Art:** chores as stitches (stock the shelf, clean the room, answer the phone) built from the same
  parts, and a place that comes back changed (a level's props and lights swapped by flags between visits).
- Later: a chat-window panel (Emily Is Away) for a romance horror; per-vignette play (Edith Finch).

## 9. Ask the user first

- Crouch: toggle, hold, or both (a setting)?
- Spotted: straight to `caught`, or a short suspicion meter first (how long)?
- In an interactive cinematic, if the player walks away: does she keep talking, wait, or follow?
- Can a patrol check a hiding place (a scripted route point), or is hiding always safe in the first game?
- See-through: one amount per hiding place, or one game-wide setting? (Answered: both, a number each; no slider.)
