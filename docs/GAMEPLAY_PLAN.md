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

They're set by a beat (`{"behave": "mari", "as": "patrol", "routes": ["r_library", "r_hall"]}`) or per flow node, and
a scene takes the actor over and hands them back to their behaviour when it ends (blended, §1). **Routes** are named
lists of spots with optional waits and poses, drawn in the scene builder on the floor plan. Interactive cinematics
can run a route too (she walks between the shelves and back while she talks).

**Talking to someone in gameplay** (no dialogue trees): use them and they answer with one of a few lines for the
state they're in: the first time, again, and a reminder of the current objective; in order, then random, then the
last one repeated. A line can instead start a scene, an interactive cinematic or a choice. Mini-games come later.

## 3. Stealth for the first game: crouch, hide, safe zones

- **Crouch**: eye height eases from 1.65 to 1.05 m, slower walk, quieter, harder to see. Toggle or hold (§9).
- **Hiding places**: a prop with `use: hide` (the locker is one): using it moves the player inside to its `inside`
  spot (blended), stance `hide`, the view through its door. The door (or any props listed) goes **see-through by a
  set amount, a slider on the desk** (`see_through: 0.6`), so the player can watch the room. Leaving reverses it.
- **Safe zones**: volumes (drawn in the builder) where the player can't be spotted. A hiding place is one too.
- **Being seen** (simple, no AI): a view cone (angle, distance; shorter when the player crouches) and a line of
  sight. Outside a safe zone in her cone fills a short suspicion meter, then `caught` fires (the format has it): a
  scene, a death, a checkpoint. Scripted moments can override (she checks a hiding place on a route point).

## 4. What else a game needs (and the first game uses)

- **The interaction point**: a dot at the centre of the screen. What's under it highlights, with a prompt (`E Open`,
  `E Hide`, `E Talk`). Hold-to-use for some things.
- **Doors**: open and close on their hinges or slides (the kit has them), locked by an item, the tricks (slam).
- **Inventory**: pickups and keys, notes you read; examining an item comes later.
- **Objectives** on screen, set by beats (the format has `objective`).
- **Checkpoints, death and retry**: the format has them; Play mode keeps the branch map's progress as the Watch does.
- **The HUD**: subtitles (Japanese over English), the prompt, a hidden or seen cue (a vignette, a quiet heartbeat), the
  objective, the timer for timed tasks. A pause menu with the branch map.
- **Sound hooks**: footsteps (quieter crouched), her barks, music states (calm, uneasy, chase) from the score room's
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
- **player abilities** (`walk`, `crouch`, `hide`; later `torch`, `hands`)

The desk's are JS modules (`tools/director/play/<kind>/<name>.js`); Unreal's are C++ classes (or components)
registered by the same names. One file lists every word, its settings and which side implements it
(`Content/Studio/gameplay.json`): story_check fails a story that uses a word missing from it, and says which side
lacks it. That keeps the rule: a new word grows the runtime, the check and STORY_FORMAT.md in one commit.

## 6. What changes where

- **The format** (STORY_FORMAT.md): scene `enter` and `exit` blends and the rung; `behave`; `routes` and safe zones
  in levels; `use: hide` with `inside` and `see_through`; talk lines per state; crouch.
- **The scene builder**: draw routes (spots in order, waits) and safe zones; place hiding places with their inside spot
  and the see-through slider.
- **The desk**: Play mode (§8), the Watch kept as the quick review.
- **The checks**: the registry; routes reach their spots; every hiding place has an inside spot; no hard cuts unless
  marked.
- **Unreal**: the same parts in the StoryRunner (RUNNER_SPEC.md), replacing the preview's cards a group at a time;
  the preview stays as the review of scenes.

## 7. What stays the same

story.json is the truth; scenes keep their clips, seams and blocking; the desk's bake still feeds Unreal's scene
playback; Generate stays the one button.

## 8. The order

1. **Play mode on the desk**: walk the built level (WASD, mouse look, collision with walls and furniture, stance),
   the interaction point and prompt, doors, pickups, notes, objectives, beats firing from `enter` and `use`.
2. **Scenes from play**: a beat starts a scene; blended in and out on the ladder (§1); interactive cinematics (walk
   while she talks); timed choices.
3. **NPC behaviours**: idle, sit, path on routes; talk lines; routes in the builder.
4. **Stealth**: crouch, hiding places with see-through, safe zones, the view cone and suspicion, caught.
5. **The registry and the checks** (grown alongside 1 to 4, not after).
6. **Unreal**: the same parts in the StoryRunner, a group at a time, Generate carrying routes, zones and hiding
   places across.

## 9. Ask the user first

- Crouch: toggle, hold, or both (a setting)?
- Spotted: straight to `caught`, or a short suspicion meter first (how long)?
- In an interactive cinematic, if the player walks away: does she keep talking, wait, or follow?
- Can a patrol check a hiding place (a scripted route point), or is hiding always safe in the first game?
- See-through: one amount per hiding place (the slider), or one game-wide setting?
