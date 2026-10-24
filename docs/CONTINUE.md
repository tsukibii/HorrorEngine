# Continue: the next session

Written 2026-10-24 (small hours, the user away; brought up to date in the afternoon) on `claude/experiments-afk`. Read this
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
| `c55732d` | **Things you carry and board games in Play**: `use: carry` (hold E to pick up, hold E to put down; physics kinds `rigid` and `plushie`: lag, squash and stretch, the top's flop, a soft landing, on any mesh; `carrying`, `dropped` `in`) and `use: game` (rules as JS modules in `Content/Studio/BoardGames/`: Russian roulette, high dice, chō-han, spin the cup, find the ball, high card, blackjack; `played` `result`). BOARD; PLAY walks both. |

Earlier the same night (before the list): the eyes' iris softening, eye occlusion and tear line, wet teeth, lipstick
with a guide, soft hair edges, the default "soft cinematic" look after the user's reference.

Then (2026-10-24, the user back), three more asks, built, checked and pushed:

| Commit | What |
|---|---|
| `ff4d1f8` | **Jewellery** (`jewellery.js`): heart lenses; earrings (stud, pearl, gem, huggie, hoop swung clear of the jaw, drop, chain drop; pairs mirrored); a nose hoop and a septum ring; metals by name, the colour, or a PBR set off the shelf; domed charms; **necklaces dropped by gravity** onto the body (chain, pearls, beads, cord; a choker snug round the neck's narrowest part, Looser lets it out), their length kept. The Studio's `open()` guarded against an earlier load finishing last. STUDIO `ONLY=<words>` runs just some steps. |
| `a3c044e` | **Fingernails** painted on the skin (`nails.js` finds each nail on MHR's fingertips once; the skin's shader paints the nail, its half moon, the free edge, the cuticle) and **nail polish** (full, French, half moon, ombré, tips, dots; gloss, matte, chrome, glitter, jelly; presets; Look at the nails). |
| `b65b09c` | **Underwear** in the tailor, skin tight (`bra` and `brief` cuts): six bras, five thongs and briefs, four boxers; lingerie, sporty and boxer outfits; the garment picker grouped by kind. TAILOR ok. |

Then the user asked for a lead developer's review of the director's desk: its ease of use, adding Kimodo motions,
and blending between things (docs/DESK_REVIEW.md has the findings, what changed and what's still open):

| Commit | What |
|---|---|
| `da2674b` | A Kimodo walk **carries its actor into the next clip** (no snap back to the mark); the blend starts from the pose at the cut; the timeline's blend wedges; the clip's **motion picker** (made, its length, or not made yet). |
| `87ca35e` | **Kimodo into the desk:** a take imported again shows at once; Send to Studio by a segment's name links it; MOTION checks the shot list; partly made clips play; **inertial blends**; the blocking's stride eases; travel in metres (Mari stopped 5% short); the shot list's metres in Kimodo's scale; the demo runs in the project folder. |
| `59fbeed` | **Body layers** (`layers`: upper, arms, one arm, head, from a motion or a pose) and the **Kimodo segment editor** on the clip card. |
| `b919cbb` | **Ease of use:** Watch from here, undo and redo, a shortcuts list, clips move down, choices by count, the look row applies at once, Generate shows the checks' errors and gives up after 20 minutes, the launcher's number reopens a running page. |

## 2. Where things are

- Play: `tools/director/play/physics.js` (physics kinds as parts; carrying; the soft bend), `boardgames.js` (the table
  and its pieces), `boardgames-ctx.js` (seeded chance), `runtime.js` (`pickUp`, `putDown`, `carryTick`, `pressE` and
  `holdTick`: hold E; `boardGame`, `seatAt`, `anim`: tweens on the game's clock), `interactables.js` (`carry`,
  `game`), `conditions.js` (`carrying`, `dropped`, `played`), `hud.js` (the hold ring, the score line, the flash).
- The rules: `Content/Studio/BoardGames/` (README: the games, `ctx`, how to add one); `storylib.board_games()` reads
  their one-line JSON `meta`; the desk serves them at `/boardgames/<game>/<id>.js` and lists them at
  `/api/boardgames/<game>`.
- The Studio: `tools/character/accessories.js` and `jewellery.js` (the necklace's drop: `dropNecklace`, `neckRing`,
  `neckWaist`, `BodySDF`); `nails.js` and the `paintNail` part of `skinshader.js`; `serve.py`'s `api/recipe`,
  `api/package`, `api/import`.
- The tailor's underwear: `tailor/pieces.js` `bra`, `brief`, `bust`, the `trim` detail, `fine`; the designs with slot
  `under` in `Content/Studio/Clothes/designs.json`.
- Format: STORY_FORMAT §2 (`carry`, `game`) and §4 (`carrying`, `dropped`, `played`); story_check checks them and its
  walker carries things and plays games.

## 3. Testing

- `python tools/check_all.py`: CHECKS ok. `node tools/director/play/boardtest.mjs`: BOARD ok.
- `node tools/director/playtest.js`: PLAY ok (it adds, in memory only, a plushie in the hall and chō-han on the hall
  table). `node tools/character/studiotest.js`: STUDIO ok (it exports `_studiotest` and imports it back as
  `_studiotest_back`, left in `People/`, git-ignored; about 45 minutes here: `ONLY=jewellery` runs just the steps
  whose words match, after the new character). `node tools/character/tailor/check.mjs`: TAILOR ok (40 designs on seven
  bodies). TIMES ok, BLENDERLOOK ok.
- **Run the browser checks one at a time**: two at once on this machine's software GPU starve each other (LESSONS
  2026-10-24). Restart a desk or Studio server after changing its Python (find the PID, kill it in a second command).

## 4. What's next (ask which)

0. **Look at the jewellery, the nails and the underwear** in the Studio and say what to change: necklace lengths and
   weights, the hoops' size, the nails' length and shape (painted: a long acrylic would need a modelled nail), more
   underwear styles (a lace that reads on small pieces, a push-up's padding, a bodysuit, a slip), and colours.
0b. **Try the desk's new motion work** on a real Kimodo take: a segment from the clip card, Send to Studio by its
   name, a layer (arms over a walk), the blends; then DESK_REVIEW §3, the open items: the shot list loaded into the
   demo by name (needs Kimodo here), the reach into Kimodo, the `motions` table (idles, the seeker's loops) playing
   in the Watch and Play, a mark tool on the desk's stage.
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
