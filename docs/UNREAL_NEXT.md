# Unreal: the next local session

What to do the next time you sit at your machine with the editor (DECISIONS 2026-10-28, back: "make a note what we
need to do for the next local session"). A cloud session can't reach the editor, so everything below waits for you,
local Claude and UnrealClaude. Work it top to bottom; each part says when it's done. SETUP.md's open phases are still
the order (S5 on); this note says what's new since and how TestRoom001 fits in.

## 0. Before anything

- [ ] Pull `dev-002` (or `main` once it's merged). `python tools/check_all.py`: `CHECKS ok`.
- [ ] `python setup/setup.py build`, then `python setup/setup.py editor` (`ue`; `UE_WAYLAND=0 ue` if a dialog opens
  blank). `curl http://localhost:3000/mcp/status` answers.
- [ ] Desk: `python tools/director/serve.py`; on this machine's GPU run `node tools/director/testroom.mjs` once
  (TESTROOM ok). It writes **the desk's reference** for the room: `Saved/Story/TestRoom001/reference/states.json` (the
  run's state after each station: flags, karma, counters, the time of day, the items, every door open or shut and
  locked, every little thing's state, the power, the tasks ticked) and a picture per station (`<node>.png`, the view
  as the station ends). Unreal is held to these.

## 1. SETUP S5 (the studio layout): small, finish it

- [ ] The `/Game/Studio/...` and `/Game/Games/` folders, the project settings, the empty start map (SETUP.md S5).

## 2. The room itself into Unreal (S8's importer, on TestRoom001 instead of the Pilot)

TestRoom001 (docs/games/TestRoom001.md) is a harder first build than the Pilot: two levels, 23 rooms, kit things,
kit doors, sliding doors, trim, windows, outdoor rooms, stains, lockers, a breaker, triggers, hidden figures.

- [ ] `unreal_execute_script`: `import storykit.importer as i; i.build("TestRoom001")`, or Generate on the desk. Fix
  `importer.py` until it builds with no warnings (keep the maths in `plan.py`).
- [ ] Both maps (`L_lab`, `L_annex`): every room, wall stretch, opening, door (frame, leaf on its hinges, handle),
  trim piece, kit thing (`Library/meshes/kit/`, `tools/kit_build.py`), light (bulb, lamp, candle; the dark room's off,
  the power room's bulb off), trigger volume and spot where the desk has them. Compare from the player's eye: each
  station's picture in the reference against the same spot in PIE. The level check's numbers say where things are
  (`python tools/level_check.py --game TestRoom001`).
- [ ] The room acoustics (an AudioVolume in each room: the atrium `large_hall`, the yard and court `outdoors`).
- [ ] Light Kit on (`python tools/unreal_plugins.py on LightKit --build`) for the time of day: day until the bed at
  station 17, night after (UNREAL_FLOW §1c).
- **Done:** the user walks both maps in PIE and they're the desk's rooms.

## 3. The preview (built, played once on the Pilot)

- [ ] Generate bakes the Watch (`Previs/preview.json`); play TestRoom001 in `AStoryPreview`: its five scenes as the
  desk records them (Aoi on her marks, the soft camera, the reply's card, the timed choice's card), the stations as
  task cards. **N** jumps to a node.
- [ ] Note what differs from the desk's Watch scene by scene: a figure off its mark, a cue late, a camera that
  doesn't hold its cone. Each is a bake or preview bug to fix before the runner copies it.
- [ ] **Faces** (new, not in AStoryPreview yet): a scene's face rows (STORY_FORMAT §3.7) go in the bake as each
  frame's 72 weights of MHR's face shapes per cast member (`face`, their names in order in `face_shapes`). Import the
  body with its morph targets (Import Morph Targets on; the shapes are named `shape_c_45` to `shape_c_116`, MHR's 72 in
  `face_shapes`' order), and have AStoryPreview set them each frame (`SetMorphTarget`). TestRoom001's lobby scene is
  the check: Aoi's face at rest for the first moment, an expression, at rest again, then a loop to the end, as the
  desk's Watch shows it.

## 4. The StoryRunner (S7): the room is its acceptance test

The runner doesn't exist yet; AStoryPreview only plays the bake. S7 builds it to docs/RUNNER_SPEC.md. Since that was
written, the desk's **Play mode** has become a working version of everything the runner must do, part by part, and
tested (PLAY, TESTROOM): `tools/director/play/` (one file a part, `parts.js` the registry). **Proposal (your call):**
build the runner to RUNNER_SPEC with Play's parts as the reference for behaviour, and TestRoom001 as the acceptance
test, station by station: a station is done in Unreal when its to-do list ticks the same way and the state after it
matches the reference's.

The order (each a commit with an automation test, as S7 says):

| Step | Play's part to port | TestRoom001 stations it passes |
|---|---|---|
| 1 | the player (walk, run, crouch, the eye heights), the crosshair and the use (a left click), the HUD's objective and **to-do list** (`todo.js`: ticks, fails, secs, hidden, who), `enter`/`exit` volumes, `after`, `flag` | 1 |
| 2 | doors (open, close, swing in/out, slide, `locked_by` an item or a flag, `door` actions, `slam_behind`), the **latch** (`latch.js`), the **peephole** (`peephole.js`: the wide lens, the look held in a cone) | 1, 2, 3 |
| 3 | pickups and the **inventory** (`inventory.js`: one row, the wheel, E, G), notes, `inspect` (a card) and **examining** (`examine.js`: the thing in your hands, turned by a drag), `combo`, `use_on` | 3, 5, 11, 18 |
| 4 | lights, switches, the **power** (`power`, the breaker, candles burning on), `lights_die` | 4 |
| 5 | **carrying** (`physics.js`: rigid and plushie), `dropped` `in` | 5 |
| 6 | the **little things** (IMMERSION.md §5: a life per thing, its states on a timer, the acts, `state`; `life.js` is the reference) | 4, 6, 12, 17 |
| 7 | **cleaning** (`clean.js`: held, the ring, the blot fading; `with`) | 7 |
| 8 | `sit`, triggered `scene`, the **name** box and `{name}` | 8 |
| 9 | `roll` (physics, the face), **board games** (`boardgames.js`; the rules in `Content/Studio/BoardGames/` are JS: port the few the games use, or run them in a script host), `ask` | 9 |
| 10 | the **flashlight** (`torch.js`: F, the beam from the hand, flicker, dead, works), `glimpse`, `whisper`, `show`/`hide` | 10 |
| 11 | `look` (seconds looked at, within a distance), secrets, **interrupts** | 11 |
| 12 | `locker` (hiding: the look held in a cone, the slats), the look-away `swap` | 12 |
| 13 | **the cast in play** (`behaviours.js`: idle, sit, go and `arrived`, path, patrol on routes with waits and poses; `sees`: the cone, the meter, `caught`; safe zones), `jumpscare` | 2, 6, 16 |
| 14 | rounds (`play`: a template Blueprint per type, UNREAL_FLOW §4b), result choices, **deaths and the branch map** (`retry`), `count` | 14 |
| 15 | timed tasks (`timer`, its fail), `music` | 15 |
| 16 | `sleep` and the **chapter** card (the time of day changes behind it: Light Kit), `checkpoint` | 17 |
| 17 | another level (`L_annex`), choices by act, flag and karma, endings, achievements | 18, the end |
| 18 | **footsteps** (`steps.js`: by the floor, a stride a step, the cast's placed at them) and the sound shelf (`Content/Studio/SFX/`, docs/SFX.md §4: not imported yet) | all |

- [ ] **The order things happen in**, which TestRoom001 found the hard way (STORY_FORMAT §4, LESSONS 2026-10-28): an
  event goes to the stitch's beats before its to-do list; a beat's instant actions run together, one that takes time
  holds only the rest of its own beat; a stitch ends the moment its last task ticks; `place`-ing the player inside a
  trigger isn't entering it; a checkpoint keeps the pocket and the little things. The runner does the same, or the
  stations' lists won't tick the same way.
- [ ] **The comparison:** the runner's debug command `Story.State` (RUNNER_SPEC) dumps the same fields the reference
  has, and the playthrough bot (`Story.Autoplay`, S10) writes them after each station to
  `Saved/Story/TestRoom001/unreal/states.json`. A small script (write it then: `tools/testroom_compare.py`) diffs the
  two station by station; the pictures go side by side on one sheet. What differs is either a runner bug or a desk
  bug: fix the one that's wrong, and say which in DECISIONS when it's a choice.
- **Done:** TestRoom001 plays through in PIE, every station's list ticking, and the comparison is clean (or every
  difference explained).

## 5. Built on the desk, untested in Unreal (the editor's first run)

- [ ] A Character Studio character with its eyes (UNREAL_FLOW §1d): `import storykit.people as p;
  p.import_character("<name>")`, then the eye close-ups against the Studio's (the `Handed` and `FlipV` switches).
- [ ] Light Kit and UltraVHS (`tools/unreal_plugins.py`), the day and night look (UNREAL_FLOW §1c).
- [ ] The PBR shelf: `surfaces.sync_pbr()` imports a set the first time a game uses it (docs/ASSETS.md §6).
- [ ] Kimodo's motions onto the MetaHumans: `tools/retarget.py ... unreal`, its VERIFY lines (SETUP S12).
- [ ] The skin (the Character Studio's skin light, after HumanShaders): §6 below.
- [ ] A painted placeholder (docs/ASSETS.md §7, not written for Unreal yet): the importer builds its block with the
  template's UVs (`Art/Textures/<thing>/<thing>.json`: each face's island; Unreal's UVs from the top left, `(px / W,
  py / H)`, where the desk's `painted.js` flips v) and wears `<thing>.png` as its base colour; a close look beside the
  desk's at the same thing (the front faces the player as it does there).

## 6. The skin in Unreal

The Character Studio lights its skin after HumanShaders now (`tools/shared/skinlight.js`) and its export carries what
that needs: the colour, the relief as a normal map, one map of roughness and thinness, and the light's numbers
(CHARACTER_STUDIO.md §3.1). `storykit.people` turns them into **M_StudioSkin** (Subsurface Profile) on the character's
skin, written without an editor (UNREAL_FLOW §1d says what to look at):
- [ ] Export a character again from the Studio (an older export has no skin maps), then
  `import storykit.people as p; p.import_character("<name>", force=True)`.
- [ ] A close-up under one side light and with a lamp behind the head, beside the Studio's same views (its Reference
  light, Skin light on): the shadow's edge soft and warm, an ear's rim red against the lamp, the pores sunk, not raised.
- [ ] Tune `SP_StudioSkin` (the scatter's colour and distance) and `skin_params` by eye, and write the numbers back
  into `people.py` so every character gets them.

## 7. After the session

- [ ] Tick SETUP.md's phases that finished; write what you found here (fixes, what's still different), and in
  docs/LESSONS.md what took a second try.
- [ ] `docs/CONTINUE.md`: where it stopped.
