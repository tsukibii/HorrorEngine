# HorrorStudio Director: notes for Claude

The studio's third Godot plugin (DECISIONS 2026-10-30, night; docs/GODOT_DIRECTOR.md the notes, guides/director the
user's guide): a game built in Godot's editor. The scene is the world (levels, rooms, doors, things and parts,
characters); the story is the Director file, `director/director.json` (DECISIONS 2026-11-01: the Director puppeteers
the game by id), compiled at play into the runtime's story with the brain beside it. It lives here, once; projects get it from
`tools/godot_director.py` (`new`, `install`). It depends on the runtime add-on (`tools/godot/addons/horrorstudio`), whose
words it compiles to (STORY_FORMAT): grow the runtime, the story check and STORY_FORMAT.md together when a node needs a
word the format doesn't have (as `move` to the player, `anim`, `talk`, `repeat`, `item:` in an `if`,
`game.collision`, `game.track_steps` were).

## Map

| File | What |
|---|---|
| `plugin.gd` | the EditorPlugin: the panel (the bottom) and the Inspector's box, the dock (under the Inspector), the debugger plugin, the ids index (`res://.hsdirector/index.json`, on every save), presets dragged into the 3D view made the scene's own nodes, a part dropped on a model wrapping it (`wrap_object`; in the 3D view `model_under_mouse`: the mouse's ray on the models' triangles), `unwrap_thing`, a dragged scare's moment |
| `core/director.gd` | `HSDirector`: ids (`snake` splits CamelCase; `auto_id` follows renames while the id is the name's), the story's axes (`story_pos`, `story_yaw`: a node's +Z is its facing), `local_aabb`, `stamp` (a runtime piece: `metadata/piece` and the group `hs_piece`), `recentre`, colliders, the scene's ids by kind (`scan`, `ids`, `hint`: the Inspector's suggestions), `holding` (raised while levels are taken up as templates) |
| `core/cond.gd`, `core/opening.gd`, `core/leak.gd` | `HSCond`: a condition over the run's facts (`holds`, `key`, `reads`); `HSOpening` (a room's doorway or window: a window's `glass`, `daylight`, `shaft` and a car passing, which HSRoom makes the runtime's `pane`, `window`, `shaft` and `sweep` pieces at play); `HSRoomLeak` (water down one of a room's walls: the runtime's `leak` at play, the band shown in the editor) |
| `level/*.gd` | the level's nodes: `_rebuild` in the editor and at play (children under `_gen`, no owner), `_setup`/`_stamp` at play only (not while `HSDirector.holding`): the runtime's pieces; `player_start.gd` (HSPlayerStart, an HSSpot: the game's start or the Test start, `starts_with`; `HSLevel.start_node` picks it, the Test start while `HSDirector.testing`), `checkpoint.gd` (HSCheckpoint, an HSTrigger: compile.gd gives it an autosave moment). `HSDirector.nodes_of` and `is_a` count a class built on another (a Player start is a spot) |
| `story/game.gd` | `HSGame`, the main scene's root and the bridge at play: the Director file read (`story_file`), compile, take the levels up (templates), start `addons/horrorstudio/main.tscn` with `story_data`, `level_scenes` and `life_things_data`, the brain beside it (its `event`, `step`, `level` called from the runtime's hooks), the characters' behaviours on each level (`_on_level`), the debugger messages, the play-from-here file (`user://hs_director_run.json`: `from`, `flags`, `test`, `near`; a test run begins at the first quest in the Test start's level, the player kept there: `_test_level`, `_first_in`, `_stay`), what the player starts with (`start_items`) |
| `story/story_file.gd`, `story/story_compile.gd` | `HSStoryFile`: the Director file's shape, `read`, `write`; `HSStoryCompiler`: the file into the runtime's flow, stitches (quests: the steps as to-dos, the finish, the wrong thing, the moments and conversations in each), choices (next by condition), scenes (conversations), endings, and the brain's tables (every condition a `?c<n>` flag, each conversation's turn a `?talk__<who>__<id>`, states, achievements) |
| `compile.gd` | `HSCompiler`: the world from the nodes (levels, cast, items, notes, life things, sounds) and the story through `HSStoryCompiler`; problems with their nodes, the story's names the scene hasn't got |
| `run/brain.gd` | the Director at play: facts from the runtime's events (`used:`, `picked:`, `entered:`, `talked:`, `heard:`, `gave:`, `step:`, `done:`...), the conditions' flags, each person's conversation, the states applied by the runtime's actions (only what changed; again on every level entered; a person's `expr` her resting face), the achievements; an HSActor's `expression` comes in as a state that always holds (`compile.gd`) |
| `run/debug.gd` | F9's panel (the quest, the facts) |
| `editor/panel.gd`, `editor/build_tab.gd`, `editor/glyphs.gd`, `editor/inspector.gd` | **the HorrorStudio panel** (docs/GODOT_DIRECTOR.md §6e): an EditorDock in the bottom slot (Build, Story, Test; the search; what's selected); Build's picture cards in categories from `parts/catalog.json` (click: in front of the camera; drag: onto a model; a model selected: one click makes it the thing; a window; a scare's area and moment), This object in words (a model's suggestions, a thing's settings, its story name and who names it, made plain again); the drawings made from SVG at the editor's scale; the Inspector's box (What is this?, Make it a…) |
| `editor/story_tab.gd`, `story/commands.gd`, `story/commands.json` | **the panel's Story tab** (GODOT_DIRECTOR §6e): the Director file's quests, steps, moments and endings as sentences (WHEN, ONLY IF, THEN, how often), written at once, on the editor's global undo; ready-made moments clicked or dropped onto an area or a door (`landed`: `plugin.gd` `_unlink`); Try this moment (`try_request`). `HSCommands` says the desk's commands and the Manager's conditions as they do: `commands.json` is written by `tools/director_manager/commands_json.mjs` from `tools/director/commands.js` and `tools/director_manager/words.js` (run it after changing either: DIRECTOR fails on a stale file or a sentence that reads differently, `tests/words_check.gd`) |
| `editor/*.gd` (the rest) | the dock and its tabs (director: the file read and the running game's ▶ ✓ ●, ▶ Here, the Manager; things, check, kimodo; its helpers serve the panel), its Guide button (`open_guide`), `open_manager` (the studio's tools/director_manager started on the project), the debugger plugin |
| `desk/desk_build.gd` | a desk game brought in (`tools/godot_director.py from-desk`, docs/GODOT_DIRECTOR.md §6d): the world `storykit/director_desk.py` wrote (`res://director/desk_world.json`, Godot's axes) built as these nodes by their own code and saved as `main.tscn` (DESKBUILD ok); the story is the Director file the converter wrote beside it |
| `kimodo/npz.gd`, `kimodo/retarget.gd`, `kimodo/stage.gd` | Kimodo's .npz read (and written), SOMA's positions onto a skeleton as an Animation (MHR, SOMA, humanoid, Mixamo; the fingers too, the hand turned by SOMA's own palm), a Godot room as Kimodo's stage file |
| `presets/` | the panel's level cards' scenes (`make_presets.py` writes them) |
| `parts/` | **the parts** (DECISIONS 2026-11-01): an HSThing scene per use and per little thing (`make_parts.py`, `parts.json`; `catalog.json` the panel's cards and categories, kept whole by make_parts.py), `life_points.json` each life's effect points as fractions of a kit thing (`tools/kit/life_points.mjs`); dragged onto a model (the 3D view or the Scene tree), or its card clicked in the panel with the model selected, the part wraps the model (`plugin.gd` `wrap_object`, on the scene's undo) |
| `tests/` | `make_sample.gd` (the sample game, built by Godot: the house and its `director/director.json`), `director_check.gd`, `kimodo_check.gd`, `alone_check.gd`, `editor_check.gd` (as a plugin of its own), `shot.gd` (a picture of the game), `guide_game.gd` and `guide_editor.gd` (the guide's pictures, `tools/godot_director.py guide`) |

## Checking it

`python tools/godot_director.py check` (DIRECTOR, about a minute, headless; `tests/shot.gd` under xvfb for a picture).
After a change to the runtime add-on also GDPLAY, GDTESTROOM and GDEXPORT (the export's games must play the same).
After a change to a node a desk game is built from, FROMDESK (`tools/godot_director.py from-desk Pilot --force --play`,
and TestRoom001's: the desk's games played through as Director projects).

## Rules

- **The guide says what the plugin does** (`guides/director/index.html`, the user's): a node, a field, a tab, a
  template or a key changed is changed there too, and its pictures made again when they show it
  (`tools/godot_director.py guide`, a few minutes under xvfb; DIRECTOR checks its pictures and links).
- **A node saves only its numbers.** What it makes goes under `_gen` with no owner, rebuilt when its settings' hash
  changes (polled every few frames in the editor) and at play; nothing it makes is saved (the editor check reads the
  file). No metadata on the user's nodes in the editor either (it's saved). The one exception: a life's effect points
  (Marker3D children, made once and owned: the user's positions; `_auto` moves only the ones nobody has touched).
- **Setup for play only in the copy the runtime enters**: a level node's `_ready` at play returns while
  `HSDirector.holding` (the HSGame raises it in `_enter_tree`, before its children's `_ready`); the runtime duplicates
  the template, and the copy's nodes set themselves up. Keep setup idempotent anyway.
- **Pieces are boxes about their node** (the runtime's math): a thing is recentred on its box at play; a door's piece is
  its leaf, a `_leaf` node at the leaf's middle carrying what moves.
- **The story is data, the scene the world.** No story in the scene's nodes: what happens is the Director file's, named
  by id; the brain changes the world only through the runtime's actions (behave, show, door, light, state), never by
  touching a node. Its conditions are flags to the runtime (`?c<n>`): keep the runtime's `if` lists plain.
- **The brain hears an event before the beats do** (play.gd `emit`: `on_event` first): facts written then are read by
  the beats the same event fires. A fact set by an action arrives as a "flag" event and counts; only "tick" is skipped.
- `@export_enum` can't have an empty option (use "keep" or "game"); `get_meta(key, null)` errors on a missing key
  (check `has_meta`).
- **The editor keeps dock positions per project** (`.godot/editor/editor_layout.cfg`): a slot change shows in a new
  project, not one that already had the dock.
