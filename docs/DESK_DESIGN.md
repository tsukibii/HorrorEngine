# The director's desk: how it's designed

The desk (`tools/director/`, `python tools/director/serve.py`, http://127.0.0.1:8780) is where a game is plotted,
blocked and played before Unreal builds it. The user directs there; Claude writes the same `story.json` by hand. Since
DECISIONS 2026-10-24 (evening) it is built to feel like RPG Maker MV: nothing typed as JSON, things picked from lists,
commands that read as sentences, dragged to place, connect and reorder. This file is its design: the rules every new
part follows, the parts to build with, and how to grow it.

## 1. The rules

1. **Pick, don't type.** Every reference (a line, an item, a door, a spot, a flag, a node) is a list of what exists
   (`CTX.refs` in app.js). What doesn't exist yet is made there and then: `+ New…` at the end of a picker opens a small
   dialog over the one you're in, and the new entry is chosen.
2. **Everything reads as a sentence.** A beat is "When the player picks up the doll: Set flag took_doll, Play scene
   …"; a trigger cutscene is "When the player picks up Porcelain doll". The sentence comes from the command's data
   (`commands.js`, `text`), never from code in the editor.
3. **Drag to arrange.** Cards on the flow board, beats and the commands in them (into another beat too), a scene's
   lines, the trigger cutscenes; a take's file onto its line. Drags have a grip (⋮⋮) so text stays selectable.
4. **One vocabulary, as data.** `commands.js` is the format's actions and triggers: the palette, the forms, the
   sentences and the CMDS check all read it. A new word is one entry there, story_check and STORY_FORMAT in one commit
   (CLAUDE.md's rule), and CMDS fails until all three agree.
5. **Undo everything; save on purpose.** Every edit is a snapshot (Ctrl+Z, 150 back, the toolbar's arrows); Save is
   explicit (Ctrl+S) and Check and Unreal never run on text that isn't on disk.
6. **Text is the truth.** The desk writes `story.json` and nothing else, the board's layout too (`xy` on a flow node).
   A form that doesn't cover something yet keeps the old JSON box behind **Advanced**; nothing else is JSON.
7. **Show where things are used.** The Database lists every place an entry is used (click one to go there); a rename
   moves every use (`refs.js`; REFS proves it on every game).
8. **Show, don't name.** Whatever has a look is a picture where it's chosen or listed: a line is what the player
   sees on it, a cast member their face, a pose the body holding it, a motion its body at four moments
   (`pictures.js`). A picker of such things is a grid of pictures (`picPick`).
9. **Type it like a script; place it on the set.** Lines are typed as a screenplay ("Mari: …", "(a note)") and a
   whole scene edited as text; actors and the player are dragged onto marks on the stage; cues along the timeline;
   a take's trims on its waveform. What the hand does becomes the story's own words, never a time or a coordinate
   the format doesn't have (a cue rides a clip edge, an actor stands on a mark).
10. **Nothing gets lost.** Every edit undoes; unsaved edits are kept in the browser until saved; every save keeps the
   version before it; Claude's edits merge with yours and say what they changed.
11. **Quiet, dark, colour-coded.** Node types have colours (scene violet, task teal, choice amber, ending red), command
   groups too (story, flags and items, the house, people, camera and time, flow), and each speaker their own. The
   icons are line drawings made for the desk (`icons.js`, no icon set), in the text's colour.

## 2. The layout

- **The toolbar**, in groups like RPG Maker's: the game (picker, New) · Save, Reload · Undo, Redo · Database ·
  Playtest, Check, Unreal · Tools (the other pages: scene builder, Kimodo shot list, Shape, Poses, Bodies, Fat suit),
  Help. Under 1280 px wide the labels go and the icons and tooltips stay.
- **The views** (the tabs under it): **Flow** (the palette and outline · the board · the inspector, the stage under
  the board, the divider dragged), **Storyboard**, **Watch** (the game played), **Branches**, **Takes**, **Database**,
  **Notes** (with the count of notes still open).
- **The inspector** edits what's selected on the board: a task's beats as event pages, a scene as a script (a row a
  line; a line's settings in tabs: Line, Take, Camera, Body, Event, Reply), a choice's options, an ending.
- **The Database** holds what the game is made of, a tab each: the game's settings, Cast, Items, Notes, Sounds, Lines,
  Motions, Flags & counters (with the karma axes), Secrets, Trigger cutscenes. A list on the left (search, New), the
  chosen entry's form on the right, and under it where it's used.

## 3. The parts

| Part | File | What it does, how to use it |
|---|---|---|
| `modal({title, body, ok, cancel, wide, danger, extra, ready})` | ui.js | a dialog: resolves true (OK, Enter) or null (Cancel, Esc); over another dialog, only the top one answers keys |
| `pickVerb(kind)` | ui.js | the command palette: every command by group, search, Enter takes the first |
| `form(fields, obj, ctx)`, `fieldInput` | ui.js | a form from a command's fields; a field's `kind` names what it lists (`text`, `longtext`, `number`, `bool`, `choice`, `flag`, `karma`, `anyone`, `facing`, `routes`, `answer`, or a reference kind: `line`, `item`, `door`, `spot`, `scene`...) |
| `triggerPill(slot, ctx)`, `editTrigger` | ui.js | "When …" as a pill; click to change it (all of / any of nest) |
| `actionList(arr, ctx)` | ui.js | a list of commands: add from the palette, edit, duplicate, delete, drag; an ask's answers as branches |
| `beatCard`, `beatsEditor` | ui.js | a task's beats as event pages: when, only if (flags), optional, secret, its commands |
| `sortable(box, arr, kind, ctx, rowSel)`, `grip(row, arr, i, kind)` | ui.js | drag rows by their grip, within a list or into another list of the same `kind` |
| `Board` | board.js | the flow board: cards, ports, edges, pan and zoom, drop from the palette; callbacks into app.js |
| the script | app.js `clipRow`, `clipCard` | a scene's clips as rows; tabs open under the row |
| the scene's setting | app.js `sceneLookEditor`, `trackersEditor`, `throughEditor` | each actor's look, the trackers and their keys on clip edges, the props the camera sees through |
| `Database` | database.js | the tabs; `open(tab, id)`, `quickNew(kind)` (what `+ New…` calls) |
| `allRefs`, `usesOf`, `renameRef`, `placeOf`, `allIds` | refs.js | where the story names an entry (by the keys that hold it), a rename everywhere, a use's place for people, every id in the file |
| `icon(name, size)` | icons.js | a 24 px line drawing; `ICONS` lists them |
| `Pictures` (`PICS.img(kind, id)`) | pictures.js | an `<img>` of a cast member (`cast`), a pose, a made motion (`motion`), a motions table entry (`table`), what the player sees on a line (`line`: `[sid, variant, clip]`); made off screen a few a frame, kept until what it shows changes |
| `picPick({get, set, choices, pic})`, `pickGrid` | ui.js | a picker with pictures: a button with the chosen one's, a searchable grid; `fieldInput` uses it for any kind `CTX.pic(kind)` has pictures of |
| `contextMenu(x, y, items, head)`, `toast(text, {action})` | ui.js | a right-click menu (items: label, icon, kbd, on, danger, disabled); a passing message with one action (Undo) |
| `pick`, `picked`, `copyNow`, `CLIP` | ui.js, clipboard.js | what's picked (cards, lines, beats, commands), the desk's clipboard (also the system's, as JSON) |
| `lint(S, …)` | lint.js | the live checks as you edit: each problem with its place (`at`), for the Problems panel and the badges |
| `merge3`, `changedPaths` | merge.js | the desk's edits and the disk's together; what differs between two versions (the saves kept use it) |
| `openGoto(D)` | goto.js | Ctrl+K: one box over cards, lines, beats, entries, flags and the desk's actions |
| `buildTask`, `buildBeat` | templates.js | the quick tasks and beats from their blanks |
| `parse`, `toText`, `applyTo` | screenplay.js | a scene as script text and back; lines still there keep their clips |
| `wireStageDrag(stage, D)` | blocking.js (+ marks.js) | blocking by mouse on the stage: drags onto marks, the right-click menu, the player's marker |
| `DebugPanel` | debug.js | F9 in the Watch: the state live, the beats as they fire, a start from any node |
| `CTX` | app.js | what the parts ask the desk: `refs(kind)`, `name(kind, v)`, `changed()`, `rerender()`, `creates(kind)`, `create(kind)` |

## 4. Growing it

- **A command or a trigger:** an entry in `commands.js` (`verb`, `label`, `icon`, `group`, `fields`, `make`, `text`;
  `more` for fields that depend on a choice), the word in story_check's `ACTIONS` or `TRIGGERS`, and STORY_FORMAT, in
  one commit. CMDS checks the three agree and that every one in the games reads as a sentence.
- **A field kind:** a case in `fieldInput` (ui.js) and, for a reference, one in `CTX.refs` and `CTX.name` (app.js).
- **A Database tab:** an entry in `TABS`, its rows in `entries()`, a `<tab>Form(entry, id)`; for a new table, its kind
  in refs.js (`KINDS`, and the keys that name it in `VALUE`, `VALUES_OF` or `KEYED`). REFS renames every entry in
  every game and runs the story check on the result, so a key refs.js misses fails it.
- **A view:** a button in the nav with `data-v` and `data-ic`, a `section.view`, and its render in the nav's click.
- **An icon:** a path on the 24 px grid in `icons.js`, stroked (no fills), round caps.

## 5. Not yet a form

- Behind **Advanced**: a scene's cues and sets, a task's play round and its beats, as JSON; the forms above them cover
  the same, the box is the way out for what they don't.
- The level is edited in the scene builder (its own page, Tools).
- Built since (2026-10-25): the minimap, several cards picked and moved at once, copy and paste of anything picked,
  quick tasks and beats, acts, Ctrl+K, pictures, screenplay typing, blocking by mouse, the waveform, the saves kept.

## 6. Checks

DESK (`node tools/director/desktest.mjs`: the live checks, the merge, copy and paste, quick events, acts, marks,
reusable motions, screenplay typing), CMDS (`node tools/director/cmdtest.mjs`), REFS (`node tools/director/refstest.mjs`),
and with the desk's server running, one browser check at a time: PLAY (`playtest.js`) first, then TIMES (`timetest.js`)
and GUIDE (`guide_shots.mjs`: every part the guide shows, driven and pictured).

## 7. The guide

`guide.html` (served by the desk, opened from Help and Tools) is the desk for the person using it, in the order they'd
use it, with pictures `guide_shots.mjs` makes by driving the desk (`guide/*.jpg`; it also sizes the guide's `<img>`
tags). A new part gets a paragraph there and, when it has a look, a picture in the script.
