# Making a game: the pipeline (v2)

One studio project, many games (STUDIO.md). The kind of game we make: **horror romance in first person**,
obsession and yandere as in Japanese anime and games, with Resident Evil 7's point of view: she is close, she talks
to you, she waits for your answer. Mood carries it. The player feels they are the one making the choices: **how they
respond and react decides the ending** through karma; small **replies** change what she says back; **simple
gameplay** (hide, run, tick boxes) sits between the scenes. **The player can die**, and a death opens the **branch
map** (*Five Hearts Under One Roof*'s scene viewer, without its stat gates): pick the branch to return to, and see
the ones you've missed. docs/WRITING.md has the craft (DECISIONS 2026-10-21).

The build plan for the tools this needs is `docs/PIPELINE_V2_PLAN.md` (branch `pipeline-v2`). This page is how a
game goes once they're built. The first game is small, a **15 to 20 minute itch.io game**, to test every stage once
(DECISIONS 2026-10-20).

**Who does what:**
- **You:** the outline, the cast's rough design, refining the dialogue and the flow, the takes (MiniMax image to
  video), the Kimodo motions (prompting in the demo), the MetaHumans, the face mocap, and the final say.
- **Claude:** the script around the local model's drafts (reviews and glue), the Japanese pass, the MiniMax prompts,
  the animation shot list, the blocking, the checks, the Unreal flow, the systems.
- **The local model** (on your RTX 3090): the first drafts of the script, scene by scene, so prompting Claude is
  for reviews and glue.

**The steps are a menu, not a sequence** (DECISIONS 2026-10-21). The usual route is the one below, but the user
chooses what happens next and Claude asks at the start of a session. **Animation-first** (the default for now, since
the user is not a native Japanese speaker): draft script (§3) → Kimodo motions (§7, §8) → the dialogue written to fit
each motion (§5) → the takes (§6). Each line is **7 seconds or less**, a beat at a time like game voice acting; a
motion too short for its line means the line is rewritten, a motion too long gets a waiting loop (`fit: loop` /
`hold`). Dialogue-first (§5, §6, then §7) is still valid for a scene built around its line.

Nothing downstream breaks when a layer changes: timing is elastic (STORY_FORMAT §3.4), everything is found by id.

## 1. The outline (you)

A rough outline of the horror story: the premise, who's in it, how it should feel, roughly how it ends. On the desk's
board (Notes) or in chat.

## 2. The cast in the desk (you)

A rough design of each character on the Shape page (body, proportions, skin), saved to the story. These become
the cast entries, the blocking bodies and, later, the MetaHumans (METAHUMAN_ROUTE.md).

## 3. The draft script in English (the local model, then Claude)

- `tools/scriptgen.py` (plan W7) breaks the outline into a story bible and scene cards, and the local model
  drafts each scene's dialogue and action in English, one scene at a time, inside its context window.
- Claude reviews and glues it, using reference games (Resident Evil 7 and others, `docs/REFERENCES.md`) for
  structure, pacing and scares, and writes the result into `story.json`:
  - the scenes and their clips, in English (`en`)
  - the choices, timed (30 s by default) with their karma, and the **replies** (left or right: what she says back)
  - the **gameplay** between scenes (hide, run, collect, sneak: simple, `play` mechanics), with its deaths
  - the endings, decided by karma (good, neutral, bad), and the deaths that send the player to the branch map
  - each clip's body as **simple life-to-life acting** (the animation budget below)
- **Done:** `CHECKS ok`, and the story plays on the desk as blocks, cards and timed choices.

## 4. You refine (you)

You rewrite the dialogue, change the flow, cut and add scenes, on the desk or in the story file. Notes for Claude go
on the board.

## 5. The Japanese pass (Claude)

In the animation-first route this comes after the motions (§7, §8): each clip's line is written to the motion's mood and
length (`motion.py shotlist` has the seconds), 7 s or less, and rewritten if the motion is shorter.

The second pass makes the script sound right in Japanese, as it would be said in a professional film:
- **`ja`:** rewritten for Japanese, not translated word for word: register, sentence endings, what's left unsaid,
  silences.
- **`ja_note`:** how it's said: the delivery as a film director would give it (breathy, flat, a catch in the voice,
  the pause before the last word).
- **`en` and `zh`:** the subtitles, translated from the Japanese (so all three say the same thing). Your English
  draft is kept as `en_draft`.
- **The takes are cut to 7 to 8 seconds.** MiniMax's audio is only good for 7 to 9 s, so every clip is written as a
  beat that stands alone, and the clips stitch: a line, a pause or an expression, a short question the player answers.
  `clip_max` is 8.
- **Replies and hanging lines:** the Japanese pass writes the reply labels in Japanese too (shown over the English),
  her answers as their own takes (`<take id>_<option>`), and the face she holds while she waits (`wait_expr`).
- **A MiniMax prompt per take**, ready to paste (image to video):
  `she makes a worried expression while she whispers <d> [Japanese] ……来てくれたんだ。 </d>`. The form is
  `<she|he> makes <a|an> <expression> while <she|he> <says | whispers | says angrily | screams> <d> [Japanese] <the
  line> </d>`. `python tools/story.py --game G minimax` prints them all, with each take's name.

## 6. The takes on the timeline (you, then the auto-clean)

- You generate each take in MiniMax and save it under its take id.
- The desk's timeline takes the videos. The video preview can be switched off to keep only the audio.
- Two ways in: `python tools/intake.py --game G <folder>` (copies them to `Footage/<G>/`, measures and cleans them; needs ffmpeg) or the desk's Takes tab → **Load takes folder…** (straight from disk, nothing copied).
- **The auto-clean** fits the director's parts (subtitles, the body, cues, the next clip's start) to each take's real
  length, and trims dead air at either end. You can adjust both by hand: the take's own trim, and the length of the
  director's action against it.

## 7. The motions in Kimodo (you, with Claude's shot list)

- The animation budget: **80% simple** life-to-life acting (stand, sit, turn, walk over, small gestures; the face
  does the acting), **15% activity** (an interesting thing done: cooking, searching a drawer, carrying something),
  **5% action and horror** (a slap, a kick, a fall, a lunge), plus a few detailed hero moments and the final ending's
  animation.
- **The Kimodo helper** (`tools/director/kimodo.html`, plan W5) lists every motion the scenes need, scene by scene:
  - the prompt ("A person ..."), its length in seconds and frames
  - the name to save it under
  - the constraints to set (the root path from the stage marks, the key poses from the blocking)
  - the scene's rules
- **Each motion is one behaviour of at least 2 seconds.** Standing up is one; walking right is the next. Chains are
  several motions, joined in the desk. `docs/KIMODO.md` has the prompting rules and the limits.
- Kimodo is poor at choosing where to look: the head follows the player (or an invisible tracker) by a look-at
  layer on top, clamped, snapping back past its limit (plan W8).
- You go through the demo and make them. A blocking overlay in the demo (plan W6) shows the room and the marks as
  see-through blocks, so the framing is right.

## 8. The motions back in the desk (Claude)

`python tools/motion.py --game G import` finds the saved motions by name and puts each on its clip. The desk plays
them chained (bridges between them), with the look-at and the procedural idle on top: the characters act out the
whole game. **Done:** `MOTION ok`, and you've watched it through, every choice and ending.

## 9. Into Unreal (Claude, then you): docs/UNREAL_FLOW.md has the steps

1. **The blocked game, playable as blocks:** the importer builds the levels from the story; the scenes play with
   the desk's blocking and motions on stand-ins; choices, timers, karma and endings work. You can play the whole
   thing as it was on the desk.
2. **The MetaHumans in their roles** (`cast.<id>.metahuman`), the motions retargeted onto them
   (`tools/retarget.py`, ANIMATION.md §1b).
3. **The face mocap** from the take videos (MetaHuman Animator), on the scene tracks by take id.
4. **The gameplay made real:** the tasks you actually do, with a crosshair as the interaction point (a
   first-person hand comes later, not in the first game).

## 10. Art, atmosphere, polish (you buy, Claude places)

Rooms, props, materials, lighting, atmosphere, camera shakes and effects. `story.py art` gives the shopping list; the
shot review catches what the art broke.

## 11. QA and ship

Play-tests (yours), the bot's playthroughs (Claude's), the checks. `package_game.py --game <Game>` builds only that
game. The first game goes to itch.io.

## 12. Versioning the engine

Everything a game adds that another game could use (a mechanic, a runner verb, a desk tool) goes into the studio
and is versioned (`Content/Studio/VERSION`, `CHANGELOG.md`). Each game records the engine and format versions it
was built with, so the next game starts from more and takes less time.

## The rhythm of a session

1. Claude starts with `story.py notes`: what you asked for since last time.
2. One step, then the checks, then a commit and a push.
3. Claude answers on the notes, ticks what's done, and says what's next.
4. **Anything visual** gets a contact sheet, not a description: you judge the mood, and the sheet proves the frame.
