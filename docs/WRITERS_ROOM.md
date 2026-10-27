# The writers' room: a game's story prototyped before the director (2026-10-27)

The user's ask (DECISIONS 2026-10-27, last thing): before anything is built in the director or the Character Studio,
**a place to prototype the story** with an assistant (Claude, or a local model: a switch), where the story is a rough
flowchart you can follow (the points, the rivers between them, how it ends), with nothing else on screen. Then
**Build** turns the prototype into a rough but working outline in the director, which Claude refines there. The
director is for refining; the writers' room is for prototyping.

## 1. How it's used

1. **New** (or load a session). A session is one game idea, kept in `Content/Prototypes/<id>/prototype.json`.
2. **The brief:** what kind of game it is ("a distant friend invites you over and something isn't quite right"),
   **reference stories** (real events, stories, notes from your research), and **the endings** you already have in
   mind: the intended one and up to two others, each optional. **Suggest** fills the empty ones from the references.
3. **Draft:** the assistant works through it in stages, each shown as it lands: the bible (the hook, the truth, how the
   strange is made believable, the cast and the places, the three endings), the river (the acts and the main points,
   the forks, the secrets), then each point's details (the lines, the close-up talks with the faces, the tasks).
4. **The river:** the story as a map: the main points along the river, its forks splitting off and joining again,
   the secrets as side streams that come back, the three endings at its mouth, the minutes along the bottom. Click a
   point to read it and change it.
5. **The assistant**, beside the river, sees what you see (the brief, the river, the point you picked) and answers in
   words and in changes, applied at once and undone with Undo: "make the second ending colder", "add an easter egg
   in the kitchen", "she should lie at the lake question".
6. **Build:** the prototype becomes `Content/Games/<Game>/story.json`, a rough outline that opens and plays in the
   director (§7), with `BUILD.md`: what Claude does next to make it the game.

## 2. The games (the rules the assistant writes by)

**About an hour, and played again.** The typical first playthrough is 55 to 65 minutes. Three endings and a handful of
secrets bring the player back: the second run sees what the first one missed.

**Relatable first.** The niche is simple: stories the player has nearly lived. A distant friend invites you over; you
house-sit for a neighbour; your sister's new boyfriend; a late shift alone; a grandparent you haven't visited in
years; a date that goes well, too well. The horror is that something isn't quite right with a person or a place you
should be able to trust.

**The believability ladder.** The strange arrives in steps, each with an ordinary explanation at first (she's tired,
the walls are thin, you misremembered the date), then a pattern, then a detail nothing ordinary explains, then the
truth. A bizarre premise (cosmic horror, the supernatural) is grounded in the personal and the physical: what the
player finds (a note, a photo, a voicemail, a receipt) makes the impossible feel documented, as if it really happened.
Nothing is explained by a speech; the player puts it together a beat before the story confirms it. The story never
breaks a rule it set, and the ordinary details stay consistent (the time, the weather, what's in the fridge).

**An interactive story with light gameplay that matters.** It should feel like watching a story unfold with you in it.
What the player does is small and always changes something: what you find changes what you know, what you answer
changes what she says and how it ends, a task done (or failed) changes the next scene. No quick-time events, no combat,
no game overs (DECISIONS 2026-10-27, late): bad things happen in endings.

**The river.** Main points in order, 16 to 24 of them for an hour, 2 to 5 minutes each, grouped in 3 to 5 acts (often
nights: sleep ends one, a chapter card starts the next). Each point is one of:

| Type | What it is |
|---|---|
| `scene` | people talk to you: a cutscene from your eye; you may answer a hanging line |
| `talk` | **an L.A. Noire close-up**: intimate, face to face; she says something, you choose what to say (2 or 3 answers), and her face answers before her words do. The faces carry the truth: a player who watches them learns what she really wants. 1 to 3 an act, planned as close-ups (seated across a table, side by side on a sofa, face to face in a doorway): a face can't be read from across a room |
| `task` | light gameplay: a to-do list (chores, a request: she asks, waits, and walks off when it's done), something to find, a room to look through, a note to read |
| `chapter` | a night ends: you sleep, a title card ("Night 2 · 23:40"), the time of day |
| `choice` | a decision that matters: a **fork** (the story goes two ways for a while, then joins the river again at the next main point) or, at the end, the way to an ending |

**Forks join again.** At most one or two forks a game; each way is one to three points, and both reach the next main
point. No branch is cut off and replayed from a menu (the old branch map, after Five Hearts Under One Roof, is not used
here).

**Secrets come back to the river.** Three to six side streams for the curious: something hidden (a locked phone, a
photo behind another, a room nobody mentions) shows a short extra moment, **unlocks an achievement**, and the story
picks up at the next main point. A secret is never needed for the intended ending, but it deepens the truth.

**Three endings, as ending cutscenes** (no ending cards, DECISIONS 2026-10-27, late night):

- **the intended ending**: the truth understood and faced, earned;
- **two others**: what happens if you misread her, ignore the signs, take her side, leave without knowing...

What decides the ending is what the player noticed and chose: the talks' answers (karma: the story says what it means,
"how much of the truth you let yourself see"), and sometimes a last choice. Each ending should be reachable on a first
playthrough by a natural way of playing.

**Achievements:** one for each secret, one for each ending, and a few small feats (read every note; never lie to her).
Short, evocative titles; hints that don't spoil.

**Lines:** English, typed on screen with a vocal blip (EXPRESSIONS_PLAN §3): one sentence each, 12 words at most; the
pauses are their own beats. The player's answers are short (two to eight words), each believable, each meaning
something different (warm, probing, evasive, honest, a lie).

## 3. The faces: MiniMax post prompts (4 seconds)

Every face in a dialogue moment (a talk's answers, her face while she waits, a key line) is a **MiniMax post prompt**:
a fragment appended after your own prompt for the character, written as what the face visibly does:

> her eyes roll up as she bites her lower lip, she nervously looks down and then back at the viewer.

- **4 seconds of video:** two or three visible moves, the last one **held**, so the expression tool can stretch it
  (**Length**, tweened: 8 to 10 s still looks natural) and loop the held part (EXPRESSIONS_PLAN §2b).
- present tense, third person (she, her; he, his), lower case (it follows your prompt), no speech, no camera moves.
- **The library** (`Content/Studio/Expressions/prompts.json`): reusable ones by what they're for: listening faces
  (loopable, for waiting), tells (the L.A. Noire reactions: the lie's glance away, fear smoothed over, relief that's
  too much), warm, unsettling, sad, afraid. The assistant uses one when it fits and writes a new one only when the
  moment needs it (a prototype's own `faces`). Each has `secs` (its length once stretched) and `loop` (the part to
  loop, as fractions of the clip). A captured expression keeps the prompt's id as its name.

## 4. The prototype (`prototype.json`)

| Field | What |
|---|---|
| `id`, `title` | the session (its folder) and the game's working title |
| `brief` | `kind` (what kind of game), `references` (stories, real events, notes), `notes`, `endings` (the user's ideas: up to three strings, the first the intended), `minutes` (60) |
| `bible` | `logline`, `hook` (why it's relatable), `truth` (what's really going on), `ladder` (how the strange is made believable, step by step), `tone`, `setting`, `player` (who you are), `time` (when it starts: day, dusk, night), `karma` (what the answers measure), `cast` (`id`, `name`, `subject` she/he, `role`, `look`, `wants`, `hides`, `tells`: how the face gives them away), `places` (`id`, `name`, `look`) |
| `endings` | three: `id`, `kind` (`intended` or `other`), `title`, `what` (the ending cutscene), `how` (how the player gets there, in words), `rule` (`{"by": "karma", "min": 2}`, `{"by": "karma", "max": -2}`, `{"by": "karma"}` for the rest, or `{"by": "answer", "point": "p20", "option": "b"}`), `by` (`user` or `suggested`) |
| `acts` | `id`, `title` |
| `points` | the main river in order: `id`, `act`, `type`, `title`, `where` (a place), `who` (cast), `minutes`, `what` (what happens), `player` (what the player does), `shot` (how it's framed); `lines` (the key lines: `who`, `text`, `face`); `talk` (`line`, `listen` (her face while she waits), `options`: `id`, `say`, `face`, `tell` (what her face gives away), `karma`, `sets` (a flag to remember it), `reveals`); `tasks` (`id`, `text`, `who` (when she asked), `done` (what ticks it), `fails` (what fails it, if anything)); `chapter` (`title`, `sub`, `time`); `fork` (`question`, `ways`: `id`, `label`, `points` (one to three points, the same fields), `sets`) |
| `secrets` | `id`, `after` (the point it leaves from), `title`, `find` (how it's found), `shows` (what it shows), `achievement` |
| `achievements` | `id`, `title`, `text`, `for` (`secret:<id>`, `ending:<id>` or `feat`), `hidden` |
| `faces` | the prototype's own expression prompts: `id`, `prompt`, `secs`, `loop`, `for` (who) |
| `notes`, `chat` | notes on points (`by`, `text`, `at`) and the assistant conversation |

A face is named by id: one of the library's or one of `faces`.

## 5. The assistant

**Claude or local, a switch** in the header:

- **Claude through the API** (an `ANTHROPIC_API_KEY`, or an `ant auth login` profile): the official `anthropic` SDK in
  `vendor/writers/venv` (`python tools/writers/room.py setup` makes it); Claude Opus 5.5 by default, the JSON checked
  against the stage's schema, streamed, with Anthropic's server-side fallback when a request is declined.
- **Claude through Claude Code** (no key needed: your Claude Code login): `claude -p` with the stage's JSON schema, no
  tools, its own system prompt, from an empty folder.
- **Local through Ollama**: the model in `setup/scriptgen.json` (the script generator's), JSON by schema.

It sees what the page shows: the brief, the bible, the river (compact), the point you picked and its details, and
which view you're on. Its answer is words and changes (`set`, `add`, `remove`, `move` on a point, a secret, an ending,
the cast, a place, the bible, a face, an achievement), applied at once; Undo takes them back. What's on screen is also
written to `Saved/Writers/now.json`, so Claude in Claude Code can see it: `python tools/writers/room.py now`.

## 6. The river on screen

Left to right: the start, the main points on one line (an icon by type: scene, talk (an eye), task (a box), chapter
(a moon), choice (a fork)), their act as a band behind them with its minutes. A fork splits the river into its ways
and joins it again at the next main point. A secret is a dotted stream above the river with a star (its achievement),
leaving after its point and coming back at the next. The three endings fan out at the mouth, the intended one bright.
The minutes run along the bottom (the hour marked). Hover for a point's summary, click to open it; the wheel zooms,
dragging pans.

## 7. Build: into the director

**Build** writes, in `Content/Games/<Game>/`:

- `story.json` (format 3, `game.draft: true`): a greybox room per place (in a row, joined by doors), the cast, each
  scene and talk a scene of its lines (English, typed), each talk's answers a hanging line's replies with her face
  as the answer (`then.expr`: the post prompt), each task a stitch with its to-do list (placeholder props in its room
  that tick it), chapters as chapter cards, forks as choices that join again, secrets as optional finds that set
  their flag and rejoin, the endings as a choice by karma (or by the last answer) and their ending scenes, the
  achievements on the secrets and the endings. It passes the story check; `draft` turns the timing targets into
  warnings until the scenes are written in full.
- `prototype.json`: the prototype as it was built (the receipt).
- `BUILD.md`: **the handoff for Claude**, point by point: what was built and what needs doing to make it the game
  (lay out the real house in the scene builder, place the props the tasks use, write the full scenes and their
  pauses, block the bodies, the faces to make), with the checks to run.
- `faces.md`: every face to make in MiniMax, prompt by prompt (the library's and the prototype's own), with the length
  to stretch it to and the part to loop.

Then, in Claude Code: "build <Game> from its BUILD.md". A game built before can be built again from its prototype; the
story it replaces is kept in the desk's history first (`Saved/Story/<Game>/history`).

## 8. Files and checks

`tools/writers/`: `serve.py` (the page's server, port 8795), `room.py` (the command line: `new`, `list`, `show`,
`river`, `now`, `draft`, `build`, `setup`, `check`), `llm.py` (the backends), `gen.py` (the stages and the assistant),
`index.html`, `app.js`, `river.js`, `ui.css`; `Content/Python/storykit/proto.py` (the format, its check, the build).
Checks: WRITERS (`room.py check`: the format, the prompt library, the stages and the assistant end to end on a
stand-in model, a build that passes the story check), WRITERSPAGE (`pagetest.mjs`: the page in a headless browser).
