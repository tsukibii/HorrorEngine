# guides/

The studio's guides for the user: HTML pages with pictures of the real thing, opened in a browser as files (nothing
loads from outside). `index.html` lists every guide, including the two that live elsewhere.

| Guide | Where | Pictures made by |
|---|---|---|
| The Director in Godot | `director/index.html` (copied into every Director project's `guide/` by `tools/godot_director.py install`, opened by the dock's Guide button and Project > Tools) | `python tools/godot_director.py guide` (the sample played and its editor pictured under xvfb: `tests/guide_game.gd`, `tests/guide_editor.gd`) |
| Your first game, by hand | `first_game/index.html` (the starter scripts beside it, `first_game/starter/`: copied into a project as `res://starter/` by `tools/godot_byhand.py`) | `python tools/godot/first_game.py --pictures` (FIRSTGAME: the game built as its steps say from the real exports, played through headless, drawn by Godot under xvfb) |
| Godot by hand: setting up | `godot_by_hand/index.html` | the same (`interior_top`, `street_top`, `character`) |
| The HorrorStudio Look plugin | `look_plugin/index.html` | the plugin's own check (`python tools/godot/plugin_check.py`, LOOKPLUGIN), copied by `first_game.py --pictures` |
| The director's desk | `tools/director/guide.html` (served by the desk at /guide.html) | `node tools/director/guide_shots.mjs` (GUIDE) |
| An exported game's | `guide/index.html` in each exported project (`storykit/godot_guide.py`) | the export (`--pictures`) |

`director/.gdignore` keeps Godot from importing the guide's pictures in a project (a copy, or a link with `--link`).
FIRSTGAME checks the three by-hand guides the same way: every picture shown is there, every one there is shown, every
link (and its `#place`) lands, each has its card in `index.html`.
`python tools/godot_director.py check` (DIRECTOR) checks the Director's guide: every picture it shows is there, every
picture there is shown, every link lands.

A new guide: a folder here with its `index.html` (the desk guide's look: dark, a contents bar that follows the
reading, an accent of its own), a card in `index.html`, a row above.
