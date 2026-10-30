# HorrorStudio Director: notes for Claude

The studio's third Godot plugin (DECISIONS 2026-10-30, night; docs/GODOT_DIRECTOR.md is the user's guide): a game built
in Godot's editor from nodes, compiled at play time into the runtime's story. It lives here, once; projects get it from
`tools/godot_director.py` (`new`, `install`). It depends on the runtime add-on (`tools/godot/addons/horrorstudio`), whose
words it compiles to (STORY_FORMAT): grow the runtime, the story check and STORY_FORMAT.md together when a node needs a
word the format doesn't have (as `move` to the player, `anim`, `talk`, `repeat`, `item:` in an `if`,
`game.collision`, `game.track_steps` were).

## Map

| File | What |
|---|---|
| `plugin.gd` | the EditorPlugin: the dock (under the Inspector), the debugger plugin, the ids index (`res://.hsdirector/index.json`, on every save), presets dragged into the 3D view made the scene's own nodes |
| `core/director.gd` | `HSDirector`: ids (`snake` splits CamelCase; `auto_id` follows renames while the id is the name's), the story's axes (`story_pos`, `story_yaw`: a node's +Z is its facing), `local_aabb`, `stamp` (a runtime piece: `metadata/piece` and the group `hs_piece`), `recentre`, colliders, the scene's ids by kind (`scan`, `ids`, `hint`: the Inspector's suggestions), `holding` (raised while levels are taken up as templates) |
| `core/when.gd`, `core/action.gd`, `core/opening.gd` | `HSWhen` (a trigger), `HSAction` (an action: `VERBS` its fields, `to_story`, `describe`), `HSOpening`; `_validate_property` shows a kind's or verb's fields only |
| `level/*.gd` | the level's nodes: `_rebuild` in the editor and at play (children under `_gen`, no owner), `_setup`/`_stamp` at play only (not while `HSDirector.holding`): the runtime's pieces |
| `story/*.gd` | the story's nodes; `story/game.gd` (HSGame) is also the bridge at play: compile, take the levels up (templates), start `addons/horrorstudio/main.tscn` with `story_data` and `level_scenes`, the characters' behaviours on each level (`_on_level`), the debugger messages, the play-from-here file (`user://hs_director_run.json`) |
| `compile.gd` | `HSCompiler`: the nodes as the story (flow, stitches, scenes, choices, endings, levels, cast, items, notes, sounds, motions) and the problems with their nodes |
| `run/debug.gd` | F9's panel |
| `editor/*.gd` | the dock and its tabs (story, events with the templates, flags, things, add, check, kimodo), the debugger plugin |
| `kimodo/npz.gd`, `kimodo/retarget.gd`, `kimodo/stage.gd` | Kimodo's .npz read (and written), SOMA's positions onto a skeleton as an Animation (MHR, SOMA, humanoid, Mixamo), a Godot room as Kimodo's stage file |
| `presets/` | the Add tab's drag-in scenes (`make_presets.py` writes them) |
| `tests/` | `make_sample.gd` (the sample game, built by Godot), `director_check.gd`, `kimodo_check.gd`, `alone_check.gd`, `editor_check.gd` (as a plugin of its own), `shot.gd` (a picture of the game) |

## Checking it

`python tools/godot_director.py check` (DIRECTOR, about a minute, headless; `tests/shot.gd` under xvfb for a picture).
After a change to the runtime add-on also GDPLAY, GDTESTROOM and GDEXPORT (the export's games must play the same).

## Rules

- **A node saves only its numbers.** What it makes goes under `_gen` with no owner, rebuilt when its settings' hash
  changes (polled every few frames in the editor) and at play; nothing it makes is saved (the editor check reads the
  file). No metadata on the user's nodes in the editor either (it's saved).
- **Setup for play only in the copy the runtime enters**: a level node's `_ready` at play returns while
  `HSDirector.holding` (the HSGame raises it in `_enter_tree`, before its children's `_ready`); the runtime duplicates
  the template, and the copy's nodes set themselves up. Keep setup idempotent anyway.
- **Pieces are boxes about their node** (the runtime's math): a thing is recentred on its box at play; a door's piece is
  its leaf, a `_leaf` node at the leaf's middle carrying what moves.
- **Typed arrays**: `Array[HSAction]` properties take `assign()` from an untyped array; `@export_enum` can't have an empty
  option (use "keep" or "game"); `get_meta(key, null)` errors on a missing key (check `has_meta`).
- **The editor keeps dock positions per project** (`.godot/editor/editor_layout.cfg`): a slot change shows in a new
  project, not one that already had the dock.
