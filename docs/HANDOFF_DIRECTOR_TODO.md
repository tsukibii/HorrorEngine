# Handoff: the director's to-do after `game-research-001` (2026-10-28)

For the session that merges `game-research-001` and works on the director's desk next. The user writes a very rough
outline in the writers' room and **refines the real thing on the desk by playing through and editing in between**, so
the desk must make dialogue, order and staging easy to change. Read first: DECISIONS 2026-10-28 (the entries from
"evening" on: The Visitor), `docs/game_research/TheVisitor/` (the approved abstract), and the writers' room session
`the-visitor` (`python tools/writers/room.py show the-visitor`).

Each item below says what exists today (checked on 2026-10-28), what's missing, and what to build. **Ask the user
before building any of it**; one step per commit, its check passing.

**Built on `dev-002` (2026-10-28, the user's ask: "merge game-research-001 ... and do any of the
HANDOFF_DIRECTOR_TODO"):** §1 the conversation card (c110826), §2 cutting and re-attaching the flow (f914d57), §3
WRITERS keeping a build to dialogue, tasks and gameplay (e53c5fc), §4 the body track (e7749b7), §5 a character's
models per scene (3340a5b), §6 the texture templates (bb3acf6); and of §7: the name variable as the game's words, lines,
answers and faces left out or worn by a condition (the two expression tracks by a counter), the card game's settings
by a flag, the endings' words on their title card (f3d83cf); time skipped, memory flickers and retyped thoughts, the
pills quick task (committed with this note). **Still open from §7:** the answering machine's messages, the
fireworks, the kit pieces (a butsudan with its offerings, the watermelon, futons in an oshiire, the garden's bench and
vending machine), the second tea secret, and Build carrying a talk's answers' `go`.

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

**Placeholder things** (DECISIONS 2026-10-28, evening): small items such as pills, playing cards, notes, photos, a
card, a cup stay **flat boxes or planes** (a plain box for a thing, a plane for paper and cards), untextured, at their
real size; the user adds the textures and models later. Build's blocks by size already do this for the things; keep it
so, and the card game's cards are plain planes too (no card faces made in code beyond their value written on them).

**Build.** A WRITERS check that a built game has no `body` on any clip and no motions, and that its things are plain
blocks; a one-line note in WRITERS_ROOM §5. Nothing else.

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

## 6. Texture templates for the placeholder things, to paint in Krita (missing)

**The ask** (DECISIONS 2026-10-28, night): "for small untextured things that we get physically/proportionally correct
could you export a uv map (and a guide layer for the sides) so I can just import it into Krita and texture. If its
photos though consider that I might want the frame to be pbr so I'd only want to export the actual photograph part".

**Build.**
- **The blocks' UVs are the template.** Every placeholder thing Build makes (§3: a box at its real size, a plane for
  paper and cards) gets UVs laid out the same way every time, so a picture painted on the template lands on the block
  exactly:
  - a **box**: a cross net, the front in the middle, the top above it, the bottom below, the left and right beside
    it, the back at the far end; every face at its real size on **one scale** (nothing stretched), 8 px of bleed
    round each island;
  - a **plane** (a note, a card, a playing card): its front and its back side by side, at its real aspect;
  - a **photo**: only **the print** gets a template (its real aspect, e.g. an L print 89 × 127 mm); the frame is a
    separate part wearing a PBR set off the shelf, never in the template.
- **The export**: `python tools/uv_templates.py --game G [thing]` writes, per thing, into
  `Content/Games/<G>/Art/Textures/<thing>/` (the user's hand work's place):
  - `<thing>.ora` (OpenRaster, which Krita opens with its layers): **Guide** (each face's outline and name, FRONT,
    TOP, LEFT..., an arrow for which way is up, the fold lines, the bleed shaded; locked), **Paint** (empty,
    transparent, where the user paints), **Base** (a flat mid grey under it);
  - `<thing>_guide.png` (the guide alone, for other apps).
  - The canvas a power of two, the scale chosen so the layout's longest side fills it (2048 px by default; `--px`).
- **The way back**: a flattened `<thing>.png` saved there (the guide hidden) is the thing's base colour on the desk
  and in Unreal, picked up on the next build; nothing to wire by hand.
- **When a thing's size changes**: its template is made again; a painted `<thing>.png` is kept, and the Problems list
  warns when its proportions no longer match.
- **Checks**: KIT (or WRITERS) that every placeholder's UVs and its template agree, face for face, and that a photo's
  template is its print alone.

## 7. What The Visitor needs on the desk when it's built (from its chart's sticky notes)

- A **name variable** in lines and the speaker name (`{her}`: Natsu or Natsuki, by a counter).
- **Two expression tracks** for one character at chosen lines (his version and hers), picked by a counter. No eye
  swap in the engine: her lilac-eyed and brown-eyed looks are two exports of the same character, picked as models
  (§5).
- **Lines left out by a flag** (her lines about Ren off his pills).
- **Memory flickers** (a thought that types out and breaks off) and **thoughts that retype themselves**.
- **Pill tasks**: a timed to-do (*Take your pills*) three times, done or failed, feeding a `doses` counter (the chart
  uses karma for it now).
- **The card game**: `Content/Games/TheVisitor/BoardGames/shinkei_suijaku.js` (Concentration; the cards plain planes, §3), settings from flags
  (his memory lies, she lets him win), the loser answers a question.
- **The endings as cutscene slots**, each followed by a **title card** with room for more text (DECISIONS 2026-10-28,
  before dawn: this game's endings have title cards).
- A skipped hour (the clock 02:10 to 03:40), the answering machine's messages, the fireworks as flashes and sound.
- The kit: a low table, a butsudan with Obon offerings (two cucumber horses, an eggplant cow), a watermelon, futons in
  an oshiire; the building's little garden as a second small place (a bench, a vending machine).
- A second tea secret (soy sauce) beside the salt one: the chart can't hold two secrets in a row.
