# The writers' room: a game's story as your flowchart, before the director (2026-10-27)

The user's ask (DECISIONS 2026-10-27): before anything is built in the director or the Character Studio, **a place to
write the story** as a rough flowchart you can follow (the points, the arrows between them, how it ends), with nothing
else on screen; then **Build** turns it into a rough but working outline in the director, which Claude refines there.
At first an assistant drafted it; then (DECISIONS 2026-10-27, the change of course) **the user writes it all**: "the
entire story gets written by me and flow (using drag and drop things like Lucidchart that make it easy for Claude to
set it up later in director tool). No longer do I want AI to generate the story." No model runs in the room: it's an
editor, and Claude reads what you made (room.py show) and builds from it. And the story can start in your notes,
written any way you like: Claude makes the chart from them (`/chart`, §9; DECISIONS 2026-10-27, later), you look it
over here, and `/build-game` takes it into the director.

## 1. How it's used

1. `python tools/writers/serve.py` (or the dashboard's Writers' room), then **New** (or open a session). A session is
   one game, kept in `Content/Prototypes/<id>/prototype.json`.
2. **About:** what kind of game it is, the reference stories (real events, articles, your research), the story's
   heart (the logline, why it's relatable, the truth, the believability ladder, the tone), your notes, the feats.
3. **Cast & places:** who's in it (she or he, who they are to you, what they want and hide, how the face gives them
   away) and where it happens (Build makes a greybox room for each place). The shapes also add them as you go.
4. **Flow:** the chart. Drag shapes from the palette, write your gist in them, join them with arrows (§2).
5. **Faces:** every face your talks and lines name, as its MiniMax post prompt (copy it), and the library.
6. **Build:** the chart becomes `Content/Games/<Game>/` (§5). Then, in Claude Code: "build <Game> from its BUILD.md".

Or write the story in your notes first: `/chart <the file>` in Claude Code makes the session (§9), and it opens here.

## 2. The chart

Like a flowchart tool (Lucidchart's way): shapes on a dotted canvas, arrows between them, frames round groups.

- **Shapes from the palette:** drag one onto the chart (or click it to drop it in the middle, or double-click the
  chart for a menu there); it lands ready to type its title, Enter keeps it.
- **Arrows:** hover a shape for its four dots; drag a dot onto another shape for an arrow, or into empty space to pick
  what to make there, already joined. Double-click an arrow to label it (a choice's way: what the player does).
- **Moving:** drag a shape (the picked ones move together, snapping to the grid); Shift-drag on the chart picks the
  shapes in a box; the arrow keys nudge.
- **Acts:** frames behind groups of shapes (a night, a chapter of the story): drag Act from the palette, or pick
  shapes and "Put an act round them"; drag a frame by its title (its shapes come along), resize it by its corner.
- **The view:** drag the background (or the middle button) to pan, the wheel to zoom, F or Fit to see everything.
- **Keys:** Delete removes; Ctrl+C, Ctrl+V, Ctrl+D copy, paste, duplicate (the arrows between them come along);
  Ctrl+A picks all; Ctrl+Z, Ctrl+Shift+Z undo and redo (every change is saved, with the versions kept); Enter retitles.
- **The inspector** (right): what's picked, in full: a shape's gist and fields, an arrow's label or condition, an act's
  title and colour, and with nothing picked a short guide. A shape Claude made from your notes shows its **script**
  there: what happens in it, line by line (to change it, tell Claude, or change it in the director once it's built).
- **Claude changes it while it's open:** when the session changes on disk (`/chart` made it again), the page takes the
  new one in by itself, and Ctrl+Z goes back to what was on screen; a save of yours made over a newer file is refused,
  the newer one shown, and Ctrl+Z brings your edit back.
- **The bar** (bottom): a playthrough's minutes by the shapes' minutes (of the hour), the counts, and the problems
  (click to list them; click one to go to its shape, marked on the chart).

**The shapes:**

| Shape | What it is | What you write |
|---|---|---|
| **Start** | where the story begins (one) | an arrow to the first moment |
| **Scene** | people talk to you: a cutscene from your eye | the title, what happens (the gist), where, who, minutes; the lines you have (who, the words, a face) |
| **Talk** | **an L.A. Noire close-up**: she asks, you answer, her face answers before her words do; the faces carry the truth | the question (who asks, the words), her face while she waits, 2 or 3 answers (what you say, karma, what her face does, its face, a flag), what reading her face tells you |
| **Task** | light gameplay: a to-do list, something to find or do | the to-dos (asked by, done when, how it can fail) |
| **Chapter** | a night ends: you sleep, a title card, the time of day | the card's title and line, the time from here on |
| **Choice** (a diamond) | a decision: an arrow for each way | the question; who decides: **the player** (each arrow labelled with what they do, maybe remembered as a flag), **karma** (each arrow "at least", "at most" or the rest), or **an earlier answer** (each arrow a talk's answer, or the rest) |
| **Secret** (dashed, gold) | a side stream for the curious | how it's found, what it shows, its achievement; one arrow in from the point it's found after, one out to where the story picks up |
| **Ending** (a double border) | an ending cutscene | the intended one or another, what happens, how a player gets here, its achievement |
| **Note** (a sticky note) | for whoever reads the chart, Claude too | anything |

## 3. The games it's for (the rules the chart is checked by)

**About an hour, and played again** (55 to 65 minutes on a first playthrough), **relatable first** (a distant friend
invites you over; you house-sit; a late shift alone), **the believability ladder** (the strange arrives in steps, each
with an ordinary explanation first), **an interactive story with light gameplay that matters** (no quick-time events,
no game overs: bad things happen in endings), **choices whose ways join again** (no branch cut off and replayed from a
menu), **secrets that come back** (a short extra moment, an achievement, then the story picks up), **three endings**
(the intended one and two others, as ending cutscenes), **achievements** (one per secret and ending, and a few feats).
DECISIONS 2026-10-27 (last thing) has the user's words; docs/WRITING.md the craft.

The check (`proto.check`, the bar's problems) holds the chart to what Build needs: one start; every point one arrow on
(a choice decides between ways); a choice two ways or more, each saying what decides it (by karma or an answer, one for
the rest); a secret one arrow in from a point and one out; an ending none out; no loops (the story goes one way);
everything reachable from the start; who and where from the cast and places; a talk's 2 or 3 answers, each with what
you say and what her face does; faces that exist. Notes (not errors): three endings, one intended; a playthrough of 45
to 75 minutes; karma bounds the answers can reach (the kindest add up to at least an ending's "at least", a player who
says nothing has 0 and gets the rest).

## 4. The faces: MiniMax post prompts (4 seconds)

A face (on a line, a talk's question, her waiting face, an answer's face) is a **MiniMax post prompt**: what the face
visibly does, after your own prompt for the character:

> her eyes roll up as she bites her lower lip, she nervously looks down and then back at the viewer.

4 seconds of video (two or three moves, the last held) that the expression tool stretches (8 to 10 s still reads as
natural) and loops (EXPRESSIONS_PLAN §2b); present tense, lower case, no speech, no camera. The library
(`Content/Studio/Expressions/prompts.json`) has reusable ones (listening faces, the tells, warm, unsettling, sad,
afraid); "New face…" in any face picker writes the story's own. A he wears them written for him.

## 5. Build: into the director

**Build** (the header's button, or `python tools/writers/room.py build ID [--game G]`) writes, in
`Content/Games/<Game>/` (the name from the title unless you give one):

- `story.json` (format 3): **a rough, working outline** that opens on the director's desk **laid out as your chart**
  (each node's `xy` where its shape sits, the acts as the board's frames), plays in the Watch and in Play from the
  start to each ending, and passes check_all (STORY, LEVEL, SHOTS):
  - `game.draft: true` (the scenes hold only their key lines, so the playtime targets warn), `game.voice: "none"` (the
    lines are text), `game.prototype` (the session).
  - **the place:** a greybox room per place (6 × 5 m, in a row, joined by doorways), each with the player's eye
    (`<room>_view`), every cast member's marks (`<room>_<cast>` across the room, `<room>_<cast>_close` 0.65 m away for
    the close-ups) and a lamp.
  - **a scene** is its lines, each face's post prompt its clip's `expr`; **a talk** is a close-up (MCU, the one asking
    on the close mark): its lines, then the question as a hanging line with your 2 or 3 answers, her listening face
    its `wait_expr`, each answer's face her answer (`then`: “…”, the face's prompt, what it gives away as the acting
    note), its karma and its flag (STORY_FORMAT §9.9).
  - **a task** is a stitch with its to-do list, each to-do ticked by using its box (a stand-in on the room's east wall);
    **a chapter** is its lines, then the chapter card; **a choice** by the player is a choice by act (a box for each
    way), by karma a karma choice, by an answer a choice on the flag that answer sets.
  - **a secret** is found in its point's task, or after a scene in a short look round the room (walk on to the
    doorway when you're ready); found, a choice on its flag plays what it shows, then the story goes on where its
    arrow out says.
  - **an ending** is its ending scene (final), then the ending. A karma bound the answers can't reach moves into
    reach, and BUILD.md says so.
  - **achievements** (STORY_FORMAT §9.13): each secret's and ending's own, the feats on flags of their own (to set
    where they happen); the Watch and Play say each as it's unlocked. **Notes** go on the game's board for Claude.
- **from a shape's script** (a chart Claude made from your notes, §9): a task's steps are one stitch, a new beat after each
  thing you do (`{"use": door}`, `{"pickup": key}`, `{"read": letter}`, `{"hidden": closet}`, `{"enter": kitchen}`,
  a list through: `{"ticked": true}`, a wait: `{"after": ..., "secs"}`); a scene's are its clips (your thoughts as
  `think` clips, what happens as each clip's acting note, sounds and lights as cues on its clips' edges, a fade a dip
  seam), cut into scene, stitch, scene where it stops for you (your name, a thing to do); a talk's question, answers,
  thoughts and replies its hanging line; **the things** (the session's `items`) are blocks of their size with their use
  (a door in the room's wall, a bed, a seat, a closet to hide in, a switch, a note, something to pick up, the rest to
  look at), small ones on a stand, placed along the walls of the room each is first used in; sounds off the sound shelf
  by their words.
- `prototype.json`: the chart as it was built (the receipt).
- `BUILD.md`: **the handoff for Claude**: the story's heart (the truth, the ladder, the cast and their tells, the
  places), what's rough everywhere, then shape by shape in the chart's order (act by act, each secret after its point)
  what you wrote, what was built and what needs doing to make it the game, as boxes to tick; your notes, the
  achievements and the checks.
- `faces.md`: every face to make in MiniMax, prompt by prompt (written for him where a he wears it), its length to
  stretch to, the part to loop, who and where, and whether it's in the expression library already.

Built again from its session, the story it replaces is kept in the desk's history first (`Saved/Story/<Game>/history`);
a story built from another session, or by hand, is replaced only when you say so (force).

**Into a set** (the place designed first in the scene builder, docs/SCENE_BUILDER.md §1; the Build dialog's *The place*,
or `room.py build ID --set NAME`): the game's level is the set's (`SetRooms` in build.py) instead of greybox rooms. Each
place goes on one of its rooms (by name, then by what kind of room its words mean, else the biggest one not taken; two
places can share one); its marks a little in from the room's south wall (the eye facing north, the cast across and
close) and a lamp if the room has no light; the things, the tasks' and the finds' boxes fitted against free stretches
of its walls, clear of its furniture, of every doorway's clearance and of the marks (a room that's full sends the next
one to the biggest room with space, and BUILD.md says so); a door the story opens is one of the room's own doors. The
set's furniture, lights, switches, seats, beds and hiding places stay; what belongs to a game (things to take, notes,
people, keys) is left out. BUILD.md's first box names each place's room, for Claude to move each block where it
belongs (`/build-game`).

## 6. For Claude

`python tools/writers/room.py show ID` prints the whole chart as text (the brief, the story's heart, the cast and
places, every shape in reading order under its act with its arrows, the notes, the feats), `show ID SHAPE` one shape
in full with its faces' prompts, `now` what the page shows (the session, the tab, the shapes picked), `list` the
sessions. The page writes `Saved/Writers/now.json` as you pick things. `import SCRIPT [--into ID] [--notes FILE]`
reads a script into a session and `script ID` prints a session's chart as one (§9); each keeps the version before in
the session's history, as the page does.

## 7. The format (`prototype.json`, format 3)

`brief` (`kind`, `references`, `notes`, `minutes`), `story` (`logline`, `hook`, `truth`, `ladder`, `tone`, `setting`,
`player`, `time`, `karma`), `cast`, `places`, **`nodes`** (`id`, `type`, `x`, `y`, `title`, `text` and the type's own:
`who`, `where`, `minutes`, `lines`, `player`, `shot`, `notes`; `talk` {`line`, `listen`, `options` [{`id`, `say`,
`karma`, `tell`, `face`, `sets`}], `reveals`}; `tasks` [{`id`, `text`, `who`, `done`, `fails`}]; `chapter` {`title`,
`sub`, `time`}; a choice's `by` and `question`; a secret's `find`, `shows`, `achievement`; an ending's `kind`, `how`,
`achievement`; a note's `color`), **`edges`** (`id`, `from`, `to`, `label`, `when` ({`min`}, {`max`}, {`talk`,
`answer`} or {} for the rest), `sets`), **`frames`** (`id`, `title`, `x`, `y`, `w`, `h`, `color`), `faces` (the story's
own post prompts), `feats`, `built`. Format 3 adds what a script holds: a shape's **`steps`**, in order, each `do`
one of `say` (`who`, `text`, `face`), `you`, `think`, `see`, `cast` (someone does something), `sound`, `light`
(`set`: on, off, flicker, dim), `power` (`set`: off or on: the house's power), `music` (`mood`), `fade`, `act` (`verb`, `item`: something you do), `todo` (`text`,
`who`, `secs`, `hidden`), `name` (you type your name), `wait` (`secs`), `save`, `feat`; a talk's answers' `think`
(your thought with it) and `then` (her reply); **`items`** (`id`, `name`, `size`: small, medium or large, `kind`: door,
bed, seat, hideout, switch, note, carry, pickup, stain (a mess to mop: `use: clean`), breaker (the fuse box), peephole (its
room's door gets one) or inspect, `where`: the place it's first used in; a flashlight is a small pickup whose item has
`torch`; DECISIONS 2026-10-28); `script` (the
script it was read from) and `script_chart` (the chart as it was then: changed on the page since, they differ). A
format 2 chart's lines and to-dos become steps as it's read; the first format (a river of points the old assistant
drafted) is upgraded too: each act a row, a fork's other ways below it, the secrets above, the endings after a choice.

## 8. Files and checks

`tools/writers/`: `serve.py` (the page's server, port 8795; `WRITERS_HOME` for a scratch home), `canvas.js` (the
chart: shapes, dots, arrows, frames, the view), `app.js` (the page: the inspector, the tabs, sessions, Build),
`index.html`, `ui.css`, `room.py` (the command line), `build.py` (Build), `script_example.txt` (a story in the script
using every part of it); `Content/Python/storykit/proto.py` (the format, its check, the text, the upgrade) and
`chartscript.py` (a script into the chart and back); `.claude/skills/chart/` (`/chart`: SKILL.md, `script.md` the
script) and `.claude/skills/build-game/` (`/build-game`). Checks: **WRITERS** (`room.py check`: the post prompt library,
a chart of every shape with no problems, each of thirteen faults found at its shape, the chart as text, the first
format upgraded, a build through check_all's STORY, LEVEL and SHOTS; the user's first example read as they wrote it,
the example script made into a chart with no problems and built through STORY, LEVEL and SHOTS, the chart written back
as a script reading as the same story, a chart drawn by hand written as a script and read back into itself keeping
every shape's id and place, typing habits, and what a script can't read said at its line), **WRITERSPAGE**
(`pagetest.mjs`: the page in a headless browser on a scratch home: shapes dragged on and joined, the inspector, labels,
undo, copy and paste, an act, the problems, About, now.json, Build; a script read in by room.py shown with each
shape's script, read in again while the page is open and taken in by itself, a moved shape keeping its place, Ctrl+Z).

## 9. Your notes, through Claude (`/chart`, `/build-game`)

The user's ask (DECISIONS 2026-10-27, later): "I should just be able to write the game out anyway I want in notepad
... and then we will use Claude to convert it into a writer block game ... you'd make that into the writer block flow
chart so I can inspect, if that looks good you convert it into the director tool and that's where I start refining
everything, swapping out block objects for real ones." The commands are Claude Code skills in the project's
`.claude/skills/`:

1. **You write** the story in any notepad, any way (docs/NOTES.md suggests a few marks, all optional).
2. **`/chart <the file> [what you roughly want]`**: Claude reads it and writes it out as **the chart's script**
   (`.claude/skills/chart/script.md`, a precise version of the way you write), keeping your words and making the
   structure explicit; guesses go on the chart as sticky notes. `room.py import` makes the session, your notes kept
   beside it (`notes.txt`); Claude fixes whatever the report says it couldn't read, then hands you the chart.
3. **You look it over here.** Move, rename or rewire what you like; a shape's script is in the inspector. Ask Claude
   for changes: it reads the chart as it is now (`room.py script`), changes that, and reads it in again: what you moved
   stays put, and an open page takes it in by itself.
4. **`/build-game <the session> [Game] [set <name>]`**: Build (§5) into `Content/Games/<Game>/`, into your own set if
   you designed the place first in the scene builder, checked by check_all; then you refine it on the director's desk,
   blocks swapped for the real things in the Database.
