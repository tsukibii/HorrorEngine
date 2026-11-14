# guides/

The studio's guides for the user: HTML pages with pictures of the real thing, opened in a browser as files (nothing
loads from outside). `index.html` lists every guide, including the two that live elsewhere.

| Guide | Where | Pictures made by |
|---|---|---|
| The Director in Godot | `director/index.html` (copied into every Director project's `guide/` by `tools/godot_director.py install`, opened by the dock's Guide button and Project > Tools) | `python tools/godot_director.py guide` (the sample played and its editor pictured under xvfb: `tests/guide_game.gd`, `tests/guide_editor.gd`) |
| Your first game, by hand | `first_game/index.html` (the starter scripts beside it, `first_game/starter/`: copied into a project as `res://starter/` by `tools/godot_byhand.py`) | `python tools/godot/first_game.py --pictures` (FIRSTGAME: the game built as its steps say from the real exports, played through headless, drawn by Godot under xvfb) |
| Godot by hand: setting up | `godot_by_hand/index.html` | the same (`interior_top`, `street_top`, `character`) |
| Tutorial v2: Room 304 | `tutorial_v2/index.html` (the same starter kit as the first game's, grown: `first_game/starter/`) | `python tools/godot/tutorial_v2.py --pictures` (TUTORIAL2: the hotel floor set exported, the game built as its steps say, played through headless; Godot's pictures under xvfb, `tutorial_v2_shots.gd`, and the scene builder's in a headless browser, `tutorial_v2_builder.mjs`) |
| The HorrorStudio Look plugin | `look_plugin/index.html` | the plugin's own check (`python tools/godot/plugin_check.py`, LOOKPLUGIN), copied by `first_game.py --pictures` |
| The HorrorStudio Weapons plugin | `weapons/index.html` | the plugin's own check (`python tools/godot/weapons_check.py --pictures`, WEAPONS: `weapons_shots.gd`, `muzzle_shots.gd` under xvfb) |
| Animator v2 | `animator/index.html` | the page's own test (`node tools/animator/pagetest.mjs --out docs/animator_sheets --real anim_chubby_woman`, ANIMATORPAGE) and Godot (`python tools/godot/motion_check.py sheets`): the three test characters made by `node tools/animator/people.mjs`; copied into `animator/img/` |
| NPC markers (the HorrorStudio Markers plugin) | `markers/index.html` | the editor itself, driven by the plugin's check under xvfb (`python tools/godot/markers_check.py --editor --shots DIR`, MARKERSEDITOR: `markers_editor_test.gd`), and the game's two (`markers_shots.gd`); `python tools/godot/markers_check.py guide DIR` gathers them into `markers/img/` as JPEGs |
| The prop customizer | `prop_customizer/index.html` (its two example pictures in `examples/`) | `node tools/propgen/guide_shots.mjs` (GUIDEPROPS: the prop generator's page on a scratch copy of the recipes, driven in a headless browser; the box of shells and a shell made here first) |
| The director's desk | `tools/director/guide.html` (served by the desk at /guide.html) | `node tools/director/guide_shots.mjs` (GUIDE) |
| An exported game's | `guide/index.html` in each exported project (`storykit/godot_guide.py`) | the export (`--pictures`) |

`director/.gdignore` keeps Godot from importing the guide's pictures in a project (a copy, or a link with `--link`).
FIRSTGAME checks the three by-hand guides the same way: every picture shown is there, every one there is shown, every
link (and its `#place`) lands, each has its card in `index.html`.
`python tools/godot_director.py check` (DIRECTOR) checks the Director's guide: every picture it shows is there, every
picture there is shown, every link lands.

A new guide: a folder here with its `index.html` (the desk guide's look: dark, a contents bar that follows the
reading, an accent of its own), a card in `index.html`, a row above.
