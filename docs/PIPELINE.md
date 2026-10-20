# Making a game: the pipeline

One studio project, many games (STUDIO.md). Each game goes **spine first**:
1. the performed story scenes, plotted and timed
2. a greybox where those scenes play
3. the player's tasks stitched between them
4. the polish layers (takes, faces, bodies, art) swapped in by name

Nothing downstream breaks when a layer changes, because timing is elastic (STORY_FORMAT §3.4) and everything is
found by id.

Who does what: **you** write the rough story and make the MetaHumans, the takes (MiniMax, Japanese) and the face
mocap, then fine-tune. **Claude** is co-lead engineer and assistant artist: story structure, story.json, the
greybox, the systems, the animation passes, the checks and the reviews.

## P1. The story → the spine (a day)

- **You:** a rough story on the board (director's desk → Notes) or in chat.
- **Claude:**
  - writes `docs/games/<Game>.md`: premise, the twist, the cast, the 8 to 12 spine scenes, where the quiet goes, the
    endings (good, bad, secret) and what decides them
  - creates the game (`story.py new <Game>`)
  - writes **only the scenes, the flow and the endings**: every scene with stage marks in a rough level, a mood,
    clips already cut to 10 s or less with shot sizes, seams, cues, events, variants where a moment is worth trying
    several ways, trigger cutscenes and timers where the tension wants them
  - **blocks every body** in the desk (pose keys, eases, modifiers) and runs the body check on every scene
  - leaves stitches as placeholders (one `done` beat with a `goal` and a `target_min`)
- **Done:** `CHECKS ok`, and you've **watched** it on the desk:
  - scenes from the player's eye with the blocked bodies, seams and camera moves
  - tasks as cards with their timers and trigger deaths
  - events playable (drag, hold still, timed choices)
  - the Japanese read by the browser's voice if you like

  You've looked through the **storyboard**, and changed the order, lines, shots and bodies there (or in notes) until
  it plays like the finished storyboard. **Anything that needs fixing is fixed in the desk, before Unreal.**

## P2. The scene greybox (a day or two)

- **Claude:**
  - blocks the rooms the scenes need (world §2) and imports them
  - exports each scene's blocking as glTF from the desk, imports it, retargets it onto the stand-ins: the greybox
    plays exactly what the desk showed
  - stages the stand-ins
  - makes placeholder voices (`voice_placeholder.py`), so the scenes play in the engine with honest timing,
    soft-lock cameras and seams
  - shot review of every scene start and seam (`storykit.shots`, then `shots_sheet.py`)
- **Done:** every scene plays in PIE in flow order (debug `Story.Goto`), `SHOTS ok`, and you've walked it.

## P3. The stitches (two to four days)

- **Claude:**
  - fills each stitch from the templates (TRICKS.md §4): the tasks, the item-and-lock chains, notes that carry the
    lore, the scares on the scare budget
  - widens the levels to hold them
  - keeps going until the estimator says the shortest normal path is at least 150 minutes
  - the bot plays it through
- **Done:** `CHECKS ok` (playtime included), `PLAYTHROUGH ok`, `SHOTS ok`, and you've played the greybox start to
  finish.

## P4. Takes (you, then Claude)

- **Claude:** `story.py clips <csv>` gives the shooting script. Each row is one take: the Japanese, the English, the
  acting note, the start and end frames (bookends: TRICKS.md §1), the seam either side, the length budget.
- **You:** record and generate the takes and face videos, named by take id.
- **Claude:** `intake.py <folder>` measures them, flags anything over length or far off the estimate, and
  rechecks. The scenes stretch to the real takes by themselves.

## P5. Faces (you, with Claude's help)

- **You:** MetaHumans for the cast (ANIMATION.md §3).
- **Claude:** imports the takes (`storykit.media.import_takes`).
- **You:** solve each face with MetaHuman Animator (mono video or audio-driven, whichever won the pilot's face
  test).
- **Claude:** puts the face animations on the scene tracks by take id, and swaps stand-ins for MetaHumans
  (`cast.<id>.metahuman`).

## P6. Bodies (Claude)

- `motion.py jobs`, then generate them with Kimodo (the Fab plugin, or the local CLI), then `motion.py check`
  (durations, hand on target, no foot sliding).
- The shot review again, now with bodies.
- The grabs get the hybrid IK pass (ANIMATION.md §4).
- **Done:** `MOTION ok`, `SHOTS ok`. You fine-tune the hero moments.

## P7. Art and sound (you buy, Claude places)

- `story.py art` gives the shopping list (every block with its size).
- Kits from Fab; the `art` fields swap them in.
- Lights get their final pass.
- Sounds get named in `sounds`.
- The shot review catches what the art broke (clipping, a subject gone dark).

## P8. Polish and ship

- Play-tests (yours), the bot (Claude's), the refund maths (the shortest normal path at 150 minutes or more).
- `package_game.py --game <Game>` builds only that game.
- Steam: the store page, the AI disclosure (the voices and faces are AI-made; see the research notes), the build.

## The rhythm of a session

1. Claude starts with `story.py notes`: what you asked for since last time.
2. One step, then the checks, then a commit and a push.
3. Claude answers on the notes, ticks what's done, and says what's next.
4. **Anything visual** gets a contact sheet, not a description: you judge the mood, and the sheet proves the frame.
