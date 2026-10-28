# Handoff: the director's to-do after `game-research-001` (2026-10-28)

For the session that merges `game-research-001` and works on the director's desk next. The user writes a very rough
outline in the writers' room and **refines the real thing on the desk by playing through and editing in between**, so
the desk must make dialogue, order and staging easy to change. Read first: DECISIONS 2026-10-28 (the entries from
"evening" on: The Visitor), `docs/game_research/TheVisitor/` (the approved abstract), and the writers' room session
`the-visitor` (`python tools/writers/room.py show the-visitor`).

Each item below says what exists today (checked on 2026-10-28), what's missing, and what to build. **Ask the user
before building any of it**; one step per commit, its check passing.

## 1. A conversation card: one dialogue list, mandatory, easy to change (missing; the user's first ask)

**Today.** A scene is a script, a row per line (add after, delete, drag to reorder, screenplay typing). Any line can be
a reply (the Reply tab): she waits with a face, 2 answers or 3, each with one line back, its face and "picking it also
does" (flags, karma, counts). After the answer the scene always carries on to its next row; branching needs a flag
plus a separate flag choice card on the board. The answer's thought (`think`) is in the format and written by Build,
but the Reply tab doesn't show it. At most three answers.

**Wanted** ("1 dialogue menu for an interactive cinematic ... add more/less ... remove an index or add more, or easily
say if this option jump to this, or skip, or increment to next"):
- One card per conversation, one list of rows: her lines, his thoughts, choice rows. **+ Add row** anywhere, **×**
  removes, drag reorders (mostly there).
- Each answer on a choice row: its act and its thought (editable), her reply as a short list of lines (not just one),
  and one **Then**: *Next* (default), *Skip to…* (a later row of this conversation), *End conversation*, *Go to…* (a
  card on the board; the board draws the arrow).
- More than three answers allowed (warn past three for an L.A. Noire talk).
- The player never speaks a line (DECISIONS 2026-10-28, noon): answers are `[ Act ] thought`.

**Build.** The format: a reply option's `then` may be a list of clips, and a new `go` (`"next"` default, `{"clip":
id}` later in the scene, `"end"`, `{"node": id}`); STORY_FORMAT §9.9, the story check (a skip only forward, a node
that exists), the Watch and Play runtime, the desk's Reply tab, `build.py` (a talk's answers with their `go`), CMDS
and DESK tests. One commit (the rule: grow the runner, the check and the format together).

## 2. Slicing and re-attaching the flow (partly there)

**Today.** On the board: a new card added while a card is picked goes in after it and keeps the old continuation (an
insert in between); dragging a card's port onto another card re-points its `next` (re-attach); the inspector's
`next` picker has a blank (—) that cuts the flow there; renaming a node moves every reference.

**Missing.** A cut you can see and do on the wire itself, and a home for the cut-off part:
- Click or right-click an arrow: **Cut here**, **Insert a card here** (scene, task, choice, conversation).
- A card whose `next` is cut keeps a stub; the cards after it stay on the board as a loose chain (dimmed) until it's
  attached again by dragging the stub (or any arrow's end) onto a card.
- **Swap** two picked cards (their places in the flow), and **move a run of cards** elsewhere in one go.
- While a flow is sliced, the Problems list says so as warnings (unreachable, dead end), not errors that stop a Watch
  from the start.

## 3. Writer to director: dialogue, tasks and gameplay only (holds today; keep it so)

**The rule** (the user): when a chart is built into the director, move only the dialogue, the tasks and the gameplay
of each shot; no animations on the cast. Each cast member gets an easily changed starting position and stays still;
the user animates in Kimodo.

**Today.** `tools/writers/build.py` gives a scene its lines and its stage (marks per cast member, a close mark for the
close-ups) and no `body`; a task puts the cast `behave` `idle` at their marks facing the player. Marks are dragged on
the stage (`blocking.js`).

**Build.** A WRITERS check that a built game has no `body` on any clip and no motions; a one-line note in
WRITERS_ROOM §5. Nothing else.

## 4. A cast member's state through a shot, and patrols inside a shot (missing)

**The ask.** "If I animate them walking somewhere, once the animation is done, I in the same shot might want them
sitting on a chair for the rest of the shot; or in the same shot add patrols (a generic looped walk, stand, or patrol
through premade animations that are specific)."

**Today.** A clip's `body` plays one thing per line (a Kimodo `file`, or blocking keys with `move`, `start`/`end`
poses, `fit: hold`, `layers`); a Kimodo walk carries its actor into the next clip (no snap back). In Play (tasks),
`behave` gives `idle` at a spot, `go` then `sit`, `path` and `patrol` along `routes`, and `loops` per role. What's
missing: a state that outlives a motion inside a scene (after the walk, *sit at chair_2 until the shot ends*), and
patrols or looped motions inside a scene (cinematic), not only in tasks.

**Build** (PATTERNS_PLAN §7 is the related plan, not built):
- A **body track** per cast member on the scene's timeline, spanning lines rather than tied to one: segments in order,
  each one of *motion* (a Kimodo file or blocking, played once), *state* (idle, sit, lean, stand at a spot or a thing,
  holding a pose or a looped motion until the next segment or the shot's end), or *patrol* (a route, walked with a
  generic loop or the user's own motions, round and round).
- When a motion ends, the next segment starts from where it left her (the carry that clips already do).
- The desk: segments dragged along the track, a state picked from a list (with a chair or a spot picked on the
  stage); the Watch and Play play them; Unreal later.
- MOTION and DESK checks: a state's spot exists, a patrol's route exists, a motion's file is made or flagged.

## 5. A character's models, picked per scene and carried down the flow (missing)

**The ask** (DECISIONS 2026-10-28, later afternoon): "in database ... make a group per character so I can add diff
models for their diff states and have it always use default, but in scenes be able to override which one to use,
however it should be continuous so if in a later scene I say use y, then the rest of the scenes that branch from that
use that one, until I go to a later scene and default it back, then the rest after that one go to default".

**Today.** A cast member has one body (`previs_body`, e.g. `people/<name>`: a Character Studio export). The time of
day already works the way this should: a scene starts at the time of the scene it branched from, and changing it by
hand carries on down the flow (`flowTimes`, TIMES).

**Build.**
- In the Database's cast tab, a **group of models per character**: named variants (`default`, `lilac eyes`, `wet`...),
  each a body (a Studio export or a desk body), one marked default.
- A scene's **model override** per cast member: a variant, or *default*. Unset, a scene uses whatever the scene it
  branched from used, so an override carries down every branch after it until a later scene sets another or sets it
  back to default; computed along the flow as `flowTimes` is (a `flowModels`), shown on the board's cards and in the
  scene's stage.
- Where branches with different models meet again, the scene says so in the Problems list (a warning: pick one there).
- The story format (the cast's `models`, a scene's `models` override), the check (every variant's file exists), the
  desk, the Watch and Play, the bake for Unreal; a DESK test and a TIMES-like test of the carry.

## 6. What The Visitor needs on the desk when it's built (from its chart's sticky notes)

- A **name variable** in lines and the speaker name (`{her}`: Natsu or Natsuki, by a counter).
- **Two expression tracks** for one character at chosen lines (his version and hers), picked by a counter. No eye
  swap in the engine: her lilac-eyed and brown-eyed looks are two exports of the same character, picked as models
  (§5).
- **Lines left out by a flag** (her lines about Ren off his pills).
- **Memory flickers** (a thought that types out and breaks off) and **thoughts that retype themselves**.
- **Pill tasks**: a timed to-do (*Take your pills*) three times, done or failed, feeding a `doses` counter (the chart
  uses karma for it now).
- **The card game**: `Content/Games/TheVisitor/BoardGames/shinkei_suijaku.js` (Concentration), settings from flags
  (his memory lies, she lets him win), the loser answers a question.
- **The endings as cutscene slots**, each followed by a **title card** with room for more text (DECISIONS 2026-10-28,
  before dawn: this game's endings have title cards).
- A skipped hour (the clock 02:10 to 03:40), the answering machine's messages, the fireworks as flashes and sound.
- The kit: a low table, a butsudan with Obon offerings (two cucumber horses, an eggplant cow), a watermelon, futons in
  an oshiire; the building's little garden as a second small place (a bench, a vending machine).
- A second tea secret (soy sauce) beside the salt one: the chart can't hold two secrets in a row.
