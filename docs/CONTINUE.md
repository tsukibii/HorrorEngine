# Continue: the next session

Written 2026-10-24 (small hours, the user away) at the end of a long stretch on `claude/experiments-afk`. Read this
after CLAUDE.md's start list (DECISIONS, notes, SETUP), then **ask the user what they're doing now**; §4 is the menu,
not an order. Overwrite this file at the end of the next session.

## 1. Where we are

The user left a list before going AFK (DECISIONS 2026-10-24, small hours); all of it is built, checked and pushed:

| Commit | What |
|---|---|
| `bedf5b7` | **UltraVHS's night mode**: at night black records as a cool blue (0.02, 0.03, 0.05), not the camcorder's warm lift; `r.UltraVHS.Night`, `SetNightMode`; Light Kit's sky turns it on at Night. |
| `5e99709` | **Day or night per scene** on the desk: a scene starts at the time of the scene it branched from, changed by hand (`time`; `game.time`, default night); the stage's sky, ambient and a light in every window by time (`TIME_LOOK`); into Unreal through Light Kit's sky. TIMES. |
| `485a3a7` | **The plugins into any Unreal project in one command**: `python tools/unreal_plugins.py on UltraVHS LightKit [--project X.uproject] [--build]`; Light Kit builds its own materials on the editor's first start. |
| `896a052` | **The same look in Blender**: `tools/blender_look.py` (Light Kit's day, dusk and night, UltraVHS's camcorder as compositor nodes, window lights, the handheld drift), docs/BLENDER_LOOK.md, BLENDERLOOK measured against UltraVHS's reference. |
| `e9cb763` | **Accessories** in the Character Studio: glasses (six styles), piercings, stickers, an eyepatch with its strap, a choker or chain; held to the skin's triangles so they ride every expression; Place by clicking. |
| `a7ebc1a` | **Export for desk / Unreal, and Import**: one GLB of the character (neutral, the eyes' openings cut) carrying its recipe, every file it's made from; Import brings it back editable (CHARACTER_STUDIO §3.1). |
| (the last) | **Things you carry and board games in Play**: `use: carry` (hold E to pick up, hold E to put down; physics kinds `rigid` and `plushie`: lag, squash and stretch, the top's flop, a soft landing, on any mesh; `carrying`, `dropped` `in`) and `use: game` (rules as JS modules in `Content/Studio/BoardGames/`: Russian roulette, high dice, chō-han, spin the cup, find the ball, high card, blackjack; `played` `result`). BOARD; PLAY walks both. |

Earlier the same night (before the list): the eyes' iris softening, eye occlusion and tear line, wet teeth, lipstick
with a guide, soft hair edges, the default "soft cinematic" look after the user's reference.

## 2. Where things are

- Play: `tools/director/play/physics.js` (physics kinds as parts; carrying; the soft bend), `boardgames.js` (the table
  and its pieces), `boardgames-ctx.js` (seeded chance), `runtime.js` (`pickUp`, `putDown`, `carryTick`, `pressE` and
  `holdTick`: hold E; `boardGame`, `seatAt`, `anim`: tweens on the game's clock), `interactables.js` (`carry`,
  `game`), `conditions.js` (`carrying`, `dropped`, `played`), `hud.js` (the hold ring, the score line, the flash).
- The rules: `Content/Studio/BoardGames/` (README: the games, `ctx`, how to add one); `storylib.board_games()` reads
  their one-line JSON `meta`; the desk serves them at `/boardgames/<game>/<id>.js` and lists them at
  `/api/boardgames/<game>`.
- The Studio: `tools/character/accessories.js`; `serve.py`'s `api/recipe`, `api/package`, `api/import`.
- Format: STORY_FORMAT §2 (`carry`, `game`) and §4 (`carrying`, `dropped`, `played`); story_check checks them and its
  walker carries things and plays games.

## 3. Testing

- `python tools/check_all.py`: CHECKS ok. `node tools/director/play/boardtest.mjs`: BOARD ok.
- `node tools/director/playtest.js`: PLAY ok (it adds, in memory only, a plushie in the hall and chō-han on the hall
  table). `node tools/character/studiotest.js`: STUDIO ok (it exports `_studiotest` and imports it back as
  `_studiotest_back`, left in `People/`, git-ignored). TIMES ok, BLENDERLOOK ok.
- **Run the browser checks one at a time**: two at once on this machine's software GPU starve each other (LESSONS
  2026-10-24). Restart a desk or Studio server after changing its Python (find the PID, kill it in a second command).

## 4. What's next (ask which)

1. **Look at the board games and the plushie in play** and say what feels wrong: the pieces' sizes, how close the
   seat leans in, the plushie's softness (`jiggle`, the kind's `follow`, `squash`, `floppy`), the revolver's moment.
2. **More board games or a game's own** (a card game of the story's, hanafuda, a ouija board): one file each, BOARD.
3. **More physics kinds**: glass that breaks when dropped, a bottle that rolls, a liquid that slops (a part each).
4. **The export in the desk**: the desk's bodies could wear a Studio export (`export/<name>.glb`) for a cast member,
   which PERFORMANCE_PLAN wants; then into Unreal.
5. **Unreal's side** of carrying and board games (the StoryRunner; the tables are greybox blocks tagged `use:game`
   there for now), and Kimodo's motions on the characters (task 6, last, with Unreal).
6. From before: routes and safe zones drawn in the scene builder, talk lines, interactive cinematics (GAMEPLAY_PLAN).

## 5. The user's machine (unchanged, outside the repo)

- `ue` starts Unreal on native Wayland (`UE_WAYLAND=0 ue` for XWayland when a dialog opens blank).
- Close MetaHuman Creator's conform tool before editing a mesh (it crashed once); systemd's core dumps can freeze the PC.
- `MHR_feminine.fbx` and `test.json` in the repo root are not ours to commit.
