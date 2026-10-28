# Continue: the next session

Written 2026-10-24 (small hours, the user away; brought up to date in the afternoon and the evening, twice on
2026-10-25, on 2026-10-26 (`easier-hair-editing`, the salon's editing; `eyelash-more`, the second reference's five
lash sets), on 2026-10-27 on `clothing-expanded`, and last on `dev-002`: the four merged, the export's colours, the
dashboard and the writers' room) on
`claude/experiments-afk`. Read this
after CLAUDE.md's start list (DECISIONS, notes, SETUP), then **ask the user what they're doing now**; §4 is the menu,
not an order. Overwrite this file at the end of the next session.

## 0. Latest (2026-10-27, later, on `dev-002`): the story from your notes, through Claude

The user's notes-to-chart route went from a syntax they'd write in to **writing any way, Claude converting it**
(DECISIONS 2026-10-27, later). Built:
- **`/chart`** and **`/build-game`**, Claude Code skills in `.claude/skills/`: their notes (any notepad, docs/NOTES.md
  the few marks suggested) → Claude's script (`.claude/skills/chart/script.md`, the former syntax, read by
  `storykit/chartscript.py`) → `room.py import` → the writers' room's chart to inspect (format 3: each shape's script
  as `steps`, the things as `items` sized small, medium, large) → Build → the director, blocks to swap for real things.
- the writers' room page: the Notes tab is gone; a shape's script shows in the inspector; a session changed on disk is
  taken in by an open page (Ctrl+Z goes back), a stale save refused with the newer one shown.
- **English only** on the HUD (no Japanese over the lines) and every choice at the bottom centre: committed before.
- **Play's controls, as the user asked** (GAMEPLAY_PLAN §10): a left click uses everything, E shows or hides **the
  inventory** (`play/inventory.js`: one row at the bottom centre, the one in the hand in the middle and held in view,
  the wheel turns it, at most five shown, frosted glass fading at its ends), G puts the one in the hand down in front of
  you (no fall), Shift runs; the pause menu shows the controls on its left, each key drawn in outline after the user's
  picture. PLAY walks all of it (the faked pointer lock from the start, LESSONS). Not in Unreal yet (RUNNER_SPEC says
  how). The guide's pictures (`guide/help.jpg`) still show the old keys: `guide_shots.mjs` makes them again.
Asked in the same message, next: a place designed first in the scene builder (a set) for `/build-game` to place the
blocks in.

## 0x. Before that (2026-10-27, on `dev-002`): the dashboard and the writers' room

Asked for two things: a dashboard to start and stop every tool, and a writers' room to prototype a game's story
before the director. Built, checked and pushed:
- **the dashboard**: `python dashboard.py` (root), http://127.0.0.1:8790: every launcher tool by section, the pages
  started, opened and stopped, everything else a job with its output (DASH).
- **the writers' room**, first with a local model drafting the story, then **changed course** (DECISIONS 2026-10-27,
  the change of course): the user writes the whole story themselves, no AI anywhere in it. `python
  tools/writers/serve.py` (port 8795) is a Lucidchart-like chart: shapes dragged from a palette (start, scene, talk:
  the L.A. Noire close-up with 2 or 3 answers, task, chapter, choice by the player, karma or an earlier answer,
  secret, ending, note), arrows from the dots, acts as frames; About (the brief, the feats), Cast & places, Faces
  (MiniMax post prompts from `Content/Studio/Expressions/prompts.json`). **Build** writes a rough working outline into
  `Content/Games/<G>/` (`game.draft`, `voice: "none"`, the board laid out as the chart, acts as `frames`) with
  `BUILD.md`, the handoff for Claude, and `faces.md`. docs/WRITERS_ROOM.md; WRITERS and WRITERSPAGE.
- the story format grew for it (STORY_FORMAT §9.1, §9.9, §9.13): `game.draft` (timing as warnings), `voice: "none"`,
  replies of two or three answers (the check forks on an answer a choice reads), and **achievements** (a secret, an
  ending or a flag; the desk's Watch toasts them).
- the example session `ticket-114` (the old model draft, upgraded to the chart) builds and passes STORY, LEVEL and
  SHOTS.

PLAY's bed step waited 8 s for a tween a software GPU takes about that long to finish; it waits 60 s now (LESSONS).
Open from the request: **loops and blends in the expressions** (a timeline range made loopable, the loop's seam
tweened; blending between several expressions dragged on): EXPRESSIONS_PLAN §2b, not started; ask first.

## 0y. Before that (2026-10-27, late night, on `dev-002`): simpler games, after Chilla's Art

The user deprecated quick-time events (the Pilot's grab and locker are dialogue choices now) and asked for a study of
Chilla's Art's games (docs/research/chillas_art.md). From its five suggestions they picked three (DECISIONS 2026-10-27,
late night), all built:
- **the to-do list** with tasks that can fail (`todo`, `tick`, `fail`, `untodo`; `ticked`, `failed`): the HUD's list
  under the objective; the Pilot's search lists the letter and the key;
- **nights as chapters**: a bed (`use: sleep`, gated by its `if` flags) and `chapter` (a title card, the time of day
  carried on after the task, an autosave); the Pilot's study has a bed for a nap ("Later · 02:13");
- **requests**: a task with a `who`; the asker waits, then walks off and sits (`behave` `go`, the `arrived` trigger);
  the quick task "Someone asks for something" (STORY_FORMAT §9.12). PLAY tests one on the Pilot's kettle.
No pocket phone (only analogue phones, if ever) and no ending cards (endings are cutscenes). Not yet in Unreal: the
list, the chapter card and `go` are desk-only (bake.js doesn't carry them). Next: ask what the user's doing; the
expression plan's steps 2 to 5 are still open.

## 0z. Before that (2026-10-27, night, on `dev-002`): the expression library

The user switched direction (DECISIONS 2026-10-27 night): English text with a typewriter blip instead of voices, and
a library of captured expressions placed on the timeline per character, with loops, reactions and look-at by angle in
play. docs/EXPRESSIONS_PLAN.md has the plan (steps 1 to 5). **Step 1 is built:** the desk's Expressions tab beside the
Inspector (import a video of a face, preview it on the default MHR, a cast member or a Studio export, name it,
Accept; cards are the character wearing the expression, played on hover, as the user asked; names only; the red ×
asks first); `tools/face_capture.py` (MediaPipe's 52 scores a frame, the head left out); Studio exports carry their
corners' MHR points so the desk plays expressions on them. The user's test video is in the library as
`pout_and_glance` (its curves; the clip stays on this machine). Open: a blink on a photo-fitted export closes only
part of the way (EXPRESSIONS_PLAN §1). Next: ask which of steps 2 (timeline), 3 (text and blips), 4 (play), 5 (Unreal).

## 0a. Before that (2026-10-27, evening, on `dev-002`)

`dev-002` is `main` with the four branches merged (`claude/inspiring-curie-fntkfv`, `easier-hair-editing`,
`eyelash-more`, `clothing-expanded`; only the docs conflicted, both sides kept), PR #4. Then the user put a Studio
character on the Pilot's Mari and it stood white: the export didn't carry the Studio's colours, which its shaders draw.
Built: **the export bakes them** (`tools/character/albedo.js`, DECISIONS 2026-10-27 evening, docs/CHARACTER_STUDIO.md
§3.1): the skin's every layer at 4096 px on MHR's UVs, each garment part's fabric on its own islands (the metres kept as
`uv1` for a PBR set's other maps), brows and lashes as their strands in their colours. STUDIO has a step for it.

Then two Play fixes the user found on the desk: a second playtest kept the first one's world (a door it opened stood
open, though the new run had it shut and locked: the stage's level wasn't rebuilt when a run first entered it; now it
is), and Esc in the pause menu reopened it (closing it asked for the pointer lock back and the browser took that same
Esc as leaving the lock, which pauses; closed by Esc it no longer asks). PLAY has a step for each.

Open: PEOPLE's eye close-up measures the white at 120 against its > 120 in the cloud container, the same on `main`
(likely the software renderer): run it on the 3090. The bake is the colour before the light; a roughness or normal
bake (the oily T-zone, the pores, the weave) would be the next step if Unreal's look needs it.

## 0b. Before that (2026-10-26, past midnight, on `claude/inspiring-curie-fntkfv`)

Asked: search for open horror sound libraries, then "add everything you can", make the strings swappable with notes,
put new instruments in the expanded scorer, and keep sound effects in the flow, not the orchestra (DECISIONS
2026-10-26, past midnight). Built, checked and pushed:

- **28 more CC0 instruments** in the score room from VSCO-2 CE and VCSL (`tools/score/fetch_samples.py`; docs/MUSIC.md §7).
- **String sets** (`js/32-strings.js`): Woohill's section, full, low, solo, eerie, glass. Pick one in the header or per
  favourite. Each has a note, and the cue says which set it suits.
- **The Expanded orchestra**: twelve cues for the new instruments (`js/66-expanded.js`), and the Instruments list.
- **The sound shelf** (`Content/Studio/SFX`, `tools/sfx.py`, docs/SFX.md): 240 CC0 sound effects. A story sound names
  one as `sfx/<name>`. The Database picks and plays it, Play and the Watch play it, and the Pilot's and Sample's sounds
  use it. SFX joins check_all.

Open: the levels between the added instruments are matched by loudness, not by ear; the user may want some louder or
softer (`adjust` in fetch_samples.py). The shelf sounds were picked by name and tags, not heard; swap any that miss in
the Database. Unreal doesn't import sounds yet (docs/SFX.md §4). Most sound sites (Freesound, OpenGameArt, itch.io)
can't be reached from a cloud session: `tools/sfx.py add` takes files the user downloads.

## 1. Where we are

**Last (2026-10-27, branch `clothing-expanded` off main; DECISIONS of that day): the clothes.** The Clothes tab's
**edit mode** (`cutedit.js`, `tailor/guides.js`: every worn garment as a film on the body with its cut lines, a skirt
as its rings, the handles and the sliders moving them at once, Bake cutting and hanging: a change took minutes before),
the **designer collection** (twelve outfits after the user's five reference images: a lace jeogori and a pleated mini,
four Korean street looks, a long coat over a turtleneck and wide jeans, two modern hanbok dresses, four menswear looks;
25 new designs, `open.shift`, `neck.rise`, a skirt's `straight` and `open.gap`, lined lace and sequin fabrics), the
outfits as **pictures** on cards in groups (`tailor/thumbs.mjs`, `Content/Studio/Clothes/thumbs/`), **hats** as
accessories. TAILOR checks the guides against the cuts; STUDIO has an edit-mode step and a beret. Then the designer
clothes were **reviewed by eye and fixed** (TAILOR.md §2b: a built shoulder for jackets, `ease.shoulder`; blazers and
the coat cut open, `open.closed: false`; quiet fabric tiles; a soft turtleneck; jeans that keep their cut).

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

Then the user parked NPC states (DECISIONS 2026-10-24, evening) and asked for the desk to be made much easier: an
intuitive drag-and-drop tool like RPG Maker MV, Claude as lead designer and UI artist. Built in four steps (docs/DESK_DESIGN.md
has the rules, the parts and how to grow it):

| Commit | What |
|---|---|
| `39eb4d8` | **An event editor after RPG Maker's**: every action and trigger as data (`commands.js`), a beat as an event page ("When the player picks up the doll" as a pill; its commands as sentences), the command palette with search, forms that pick from what exists, commands and beats dragged to reorder or into another beat. CMDS. |
| `1aa249a` | **The flow board by drag and drop** (`board.js`): cards dragged where you want them (`xy` kept in the flow), wired port to port, Scene, Task, Choice and Ending dragged in from the palette, the outline to find a node. |
| `194a91f` | **A scene reads as a script**: a row a line (the speaker in their colour, the words, chips for what's set), dragged to reorder; a line's settings in tabs; the reply as a form; a take's file dropped on its line is stored, measured and trimmed. |
| `ae51947` | **The Database** (`database.js`, `refs.js`): the game's settings, cast, items, notes, sounds, lines, motions, flags and counters, secrets and trigger cutscenes as tabs; each entry's uses, clicked to go there; a rename moves every use (REFS); `+ New…` in any picker. **The toolbar** in groups with icons (Save, Undo, Redo, Database, Playtest, Check, Unreal, Tools, Help); help as a dialog; a scene's look, trackers and see-through props as forms. |

Then the user asked for every further enhancement proposed for the desk, and an HTML guide to using it (2026-10-25):

| Commit | What |
|---|---|
| `cf7f719` | **Problems as you edit** (`lint.js`): each at its card, beat or line, in the Problems panel with the story check's own (run on the unsaved story). DESK. |
| `dff5cc6` | **Claude's edits merged** with the desk's (`merge.js`): a three-way merge, a toast of what came in with Undo, a question only where both changed one thing. |
| `a6ce6d2` | **Copy, paste and right-click menus** (`clipboard.js`): cards, lines, beats, commands; between games too. |
| `697d3d0` | **The debug panel** (F9 in the Watch, `debug.js`): flags, counters, karma, items live; beats as they fire; a start from any node with a state. |
| `3d70f39` | **Quick tasks and beats** (`templates.js`): a locked door and its key, a note, a chase... from a few blanks. |
| `1c342ec` | **Acts on the board** (the story's `frames`), Shift-drag box picking, the minimap. |
| `da6dfce` | **Ctrl+K goes to anything** (`goto.js`). |
| `3e4de9e` | **Pictures instead of names** (`pictures.js`): what the player sees on each line, faces, poses, motions; picker grids. |
| `0684564` | **A take's waveform** with its trims as handles; **cues dragged** along the timeline onto clip edges. |
| `3c42cfd` | **Blocking by mouse** on the stage (`blocking.js`, `marks.js`): drag onto marks or new ones, the right-click menu, the player's marker. |
| `219b28f` | **Reusable motions play**: behave's `motion` (format grown with the check), the seeker's loops by phase in the Watch's rounds, the motions table as pictures. |
| `d6b2c5d` | **Screenplay typing** (`screenplay.js`): "Mari: …" under the script, Edit as text, a pasted draft; lines kept with their takes. |
| `64e380b` | **A draft kept in the browser** and **the saves kept** (the toolbar's clock: what differs, bring one back). |
| `e94c1fc` | **The guide**: `tools/director/guide.html` (Help, Tools), its pictures made by `guide_shots.mjs`, which is also the GUIDE check. |

Then the user asked for immersion (2026-10-25): "kettle steaming, electric hob with leds, steam, cup of tea filling,
kettles etc, little things that help build immersion, maybe cigarettes, lit cigarette". Planned in docs/IMMERSION.md
and built on the desk, in six steps:

| Commit | What |
|---|---|
| `62d12ab` | **The plan** (docs/IMMERSION.md): the catalogue, a life per thing, the `state` word, the desk, Unreal. |
| `ea9964d` | **The things in the kit** (KIT.md §9), at their real size, with **sockets** where their effects come from: kettles (jug, gooseneck, whistling, tetsubin), hobs (ceramic, IH, gas konro), pots, cups (mug, teacup, yunomi, glass, takeaway), teapots, ashtrays, cigarettes, lighters, clocks, a rice cooker, a mosquito coil, incense, phones, taps, candles; 45 presets. KIT ok. |
| `288eb2f` | **Lives** (`Content/Studio/Life/lives.json`, `life.js`, `storykit/life.py`): states with timers, acts, a pot following its hob, a cup poured from its kettle; the word `state` (an action and a trigger) grown with the check, STORY_FORMAT and RUNNER_SPEC; the walker plays a `state` trigger through; Play's E does a thing's act. |
| `1e99bed` | **Effects** on the stage (`lifefx.js`), each a function of time: steam, a cigarette's smoke thread and its burn back, embers, LEDs, digits, glowing rings, gas flames, the fill and the pour, drips, screens (static, a call), a clock's hands. |
| `f3d6260` | **Sounds** (`lifesound.js`) made by Web Audio, no files, placed in the room: the kettle's rumble, its boil and click, a whistle, a hob's beep, the gas and its igniter, a pot's bubbling, the pour, a cigarette's crackle, a clock's tick, a phone ringing, static, a tap's drip and run, a fridge's hum, the rice cooker's tune. PLAY checks each renders and doesn't clip. |
| `7d07175` | **On the desk:** right-click the stage, *Add a little thing here…* from pictures; *It starts …* on a thing; quick beats (a kettle put on, a cigarette still burning, the phone rings, the TV on by itself, the clock stops); the Sample dressed (a kettle and tea in the kitchen, a clock at 2:47, a cigarette burning in the hall, a phone and a TV in the study). |
| `269780d` | **The guide's §11** (Little things, with pictures GUIDE makes), the state command's thing picked by its picture, a form's sentence following a picked state; CLAUDE.md, IMMERSION.md (§5: what goes to Unreal now and what's next). |

Then (2026-10-25, evening) the user, shaping a character, asked for the Character Studio to start from a pose like
their reference (a T-pose) and for a stomach that can be truly flat:

| Commit | What |
|---|---|
| `46f30f0` | **The Studio's view in a T-pose** (`pose.js` on MHR's skinning, `Content/Studio/Bodies/MHR_lod1_rig.bin` from `rig_mhr.mjs`): the arms level, the legs straight, the head untouched; the A-pose a switch in the view bar; the clothes, the circles, the accessories and the nails' close-up follow it; everything still saved and exported in MHR's pose. **Belly** in the sculpt: -1 a flat stomach. POSE (`node tools/character/posetest.mjs`), STUDIO's pose step. |

Then (2026-10-26) the user found the clothes lifeless and asked for a skin-tight slider, a cloth simulation with gravity
and a bake (DECISIONS 2026-10-26):

| Commit | What |
|---|---|
| `3eb3989` | **The drape** (`tailor/drape.js`, docs/TAILOR.md §1c): every garment that hangs falls by gravity onto the body and the clothes under it (XPBD in small steps: lengths, flat-rest bending held to the points' weight, tethers to where it hangs from, the skin's plane per point, friction), held round the neckline, by the waistband, under neckbands and ribbed cuffs and hems, tucked into what closes over it, buttoned fronts closed; fullness falls into folds. The details, buttons and handles sewn on the hanging cloth, the fabric's coordinates the cut's. **Fit** (0 skin tight, 1 as designed, 2 loose) per garment. The Studio: Hang by gravity, each garment's Hang (fullness, stiffness, weight), the cut at once and the hung clothes after (a newer edit stops the drape), baked as `drape.bin` and carried by the export. TAILOR drapes seven outfits on three bodies; STUDIO's drape step. |
| `d8f45ad` | **Sleeves inside sleeves** held as cut (a shirt's in a blazer's: the jacket was cut over the shirt's sagging sleeve and sagged again, ballooning from the elbow down; now 6.2 cm off the skin at most, from 7.9), and **the bake's key** covers what closes over each layer (a t-shirt baked alone came back untucked under trousers, 10.6 cm off); the **bending in each pass** with the lengths (a cardigan's sleeve rocked for ever at some stiffnesses and weights; now every combination settles). TAILOR checks the first two. |
| `d14f46b` | **Slim default bodies** after the user's references (DECISIONS 2026-10-26, later): the Feminine and Masculine bases refitted in `mhr.py` (body only, the heads kept), a base's sculpt (the feminine flat stomach) in the presets, the slider's middle halfway between them; the Studio, the check and the sheet build them alike. **Sleeves end at the wrist:** the frame's wrist round each slice's middle, the elbow a forearm up from it, both within 2.7 cm of MHR's joints, TAILOR holds them there. |
| `6aea007` | **Clothes tailored after the references:** tops cut close and following the waist (tension about halved, a third less ease, the drape's fullness only for soft folds), a **blouse** and one with its sleeves rolled, the pleated skirt high, mid-thigh and full, the pencil skirt high and close, a **fitted blazer** for women, the men's suit closer; outfits `school uniform (summer)`, `office (pencil skirt)`, `skirt suit`, `shirt and shorts` (a fit of 1.5 carried by the outfit), `t-shirt tucked in`; TAILOR hangs them. |
| `6c65afd` | **Lashes over the lid's rim** (DECISIONS 2026-10-26, evening): MHR's lid line is the rim's back edge, so lashes rooted there and sent straight out ran under the rim's skin for 3 mm and a band of bare skin showed between the eye and the lashes. `rimOf` (`index.html`) finds the rim's front edge from each point of the line (the skin's most forward point a little out from it, at most 3 mm, fading at the corners) and the way over the rim's rounded skin by rays; the lashes lie along it and lift from the front edge, the lash line is a strip along it, and the way fades as the eye shuts (shut, they're rooted on the line as before). STUDIO measures the way over the rim: 2.0 mm on average open, 0.2 shut |
| (this) | **The T-pose's neck upright** (DECISIONS 2026-10-26, evening): MHR's rest pose carries the head 6 to 7.5 cm ahead of the shoulders, the neck leaning far forward; `pose.js` moves everything under the head forward, level (the neck's joints part of the way by their height), until the head's joint is `NECK_AHEAD` (0.12 of the neck's height, about 2.2 cm) ahead of the shoulders': the ear over the shoulder's top, the neck's front under the jaw leaning about 14° in the side view (29° in MHR's pose, about 8° in the user's reference). The head stays put to the last bit; the salon's baked hair below it goes with the body (`shiftAt`, `poseHair`). POSE and STUDIO judge the head by its own bones now (by height, the skin under the jaw counted as head) and check the stand |
| `easier-hair-editing` | **Easier hair editing in the salon** (DECISIONS 2026-10-26, later still; docs/SALON_REVIEW.md, docs/SALON.md): the user asked for a list of what's hard about making hair, then "Add all the above and make the flow easy to use". Measured first (`tools/character/salon_audit.js`: a lock placed from the front hung through the head seen from the side, the end re-read on a turn, 37 cm at most before zooming out, a 20 cm reach taking 52 of 54 locks, picking through the head), then nineteen items built in seven commits, each with a SALON step: the pull's **scope** and **locked** locks and groups; the **placing arrow** (a placed lock stays in hand, its arrowhead dragged for length and direction from any view, OK or Enter; the wheel bows every type; Length and Sag sliders; the hint per stage); the **view buttons** with Blender's keys, the crown from above, **Ortho** (the cursor's ray from the camera's own projection); **Split** (two panes with their own orbits, every tool in the pane under the pointer, the view bar moved into the header); **roots that slide**, picking that takes the nearest in depth, never through the head, cycling on a click again, a **dot** where a root would go; **Let it fall**, the Locks list (group picker, rename, solo, fold, delete, lengths), **new locks like the last one**, a **draft** in localStorage offered back; a lock **swung by its body** (Shift: slide; R, G), **several picked** (Ctrl-click, a box), the view panning at a drag's edge, zoom stops (Home). Lessons: a test's root point above the crown's top misses from a level view (the radial field overestimates at the pole); UI over the view steals clicks. |
| `better-eyelashes` | **Anime lashes and the pink eye makeup after the user's references** (DECISIONS 2026-10-26, night): three lash sliders (Spiky clumps: each clump's roots gathered with a gap to the next; Long and short: every other spike shorter; Lower lashes down: the lower lashes down the skin) and three anime styles (an anime lash set, drawn wisps, an anime doll) in a grouped Style picker, a style setting every slider (`styleOf`); the makeup's eye layers (the liner's thickness and its point past the inner corner, the eyeshadow's placement, an under-eye wash, the inner corner, the waterline), the **anime pink** makeup preset and the **anime pink** look (the preset with the anime lashes on; a look can name lashes and brows). The painted liner now runs between the lashes' roots and a line a liner's width up the lid, both found on the skin (`rimOf`'s fourth point), so it shows over the lashes in any pose (before, it ran along the lid line under the lashes and the cut: invisible). STUDIO's two new steps. Then, the user finding the spikes nowhere near the photo: **every lash one fine hair** (`lashAtlas`, one strand to a cell; thin crossed cards, hundreds an eye) in clusters drawn to points, long, medium and short in turn, a short fringe under them (Under-lashes), clusters crossing (Criss-cross), the outer ones swept up and out; every style retuned on it. Then the user's two asks: **no skin between the roots** (the lash line its own mesh with a dense fringe atlas, `lineAtlas`, over the whole rim and up the lid) and **lashes that turn with a blink** (each hair's frame set on the open lid and turned with the lid about the eyeball's middle, with the margin's droop: shut, they point at the viewer, 15° down, still on their rim, on the upper lid's own edge; the painted liner's lines from the same swung lid, so no patch on a shut lid). Then the lower lashes (the user: too angular, fading into the skin): one hair each rooted at the margin's front edge (the waterline showing), leaving along the skin and easing into their direction (no L), at most 57° down; the lash atlas a solid core, black to the tip (crisper upper lashes too). Then the corners (the user: skin showing at the corners of the upper lid, the lower roots off their line): the rim runs to the corners instead of fading to nothing (`rimOf` searches square to the lid's line, drops far picks, fills a corner from its neighbour), no lashes on the innermost 7%, the lower roots one smooth line along the margin. Then **the three eye shapes the user drew, as lashes only** (the opening stays the scan's): styles fox almond, half-lidded and round doll with Sweep, Inner length and Lift below zero added, and a whole look each with its drawn liner (`fox liner`, `half-lidded liner`, `doll pink`). |
| `eyelash-more` | **The second reference's five lash sets** (DECISIONS 2026-10-26, last thing): lash styles sparse (men, older), glam volume, fluffy mink, doll volume and natural medium, each a whole look; a **lower liner** (the painted liner along the lower lashes' roots: amount, thickness, reach), **Eyeshadow size** (a smoky eye up to the crease and out past the corner), lash looks brown, greying and grey, makeup presets smoky plum, bold doll liner and tinted waterline, and **Hooded lids** in the sculpt (the old man's fold; the opening and the lashes' roots kept, no skin turned over). STUDIO measures the sets, the lower band and the fold. |

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

- The desk: docs/DESK_DESIGN.md (the rules, the parts, how to grow it); the guide `tools/director/guide.html` at
  http://127.0.0.1:8780/guide.html; the saves kept in `Saved/Story/<Game>/history/` (git-ignored).
- The little things (docs/IMMERSION.md §4 has the files): the shapes in `kit.js` (`TYPES` with `cat: "small"`,
  sockets from `build()`), the lives in `Content/Studio/Life/lives.json`, their logic in `life.js` (`States`) and
  `storykit/life.py` (`reach`, for the walker), the effects in `lifefx.js` (attached by `stage.js` after `setWorld`;
  the stage's `lifeAt` says the states shown), the sounds in `lifesound.js`; Play's side in `play/runtime.js`
  (`stateOf`, `lifeActs`, `setState`) and the `life` interactable; the desk's in `blocking.js` (the menu),
  `marks.js` (`newThing`) and `app.js` (`addThing`, `thingPic`).

## 3. Testing

- `python tools/check_all.py`: CHECKS ok. `node tools/director/play/boardtest.mjs`: BOARD ok. `node
  tools/director/cmdtest.mjs`: CMDS ok. `node tools/director/refstest.mjs`: REFS ok (both games' entries renamed).
- `node tools/director/playtest.js`: PLAY ok (it adds, in memory only, a plushie in the hall and chō-han on the hall
  table). `node tools/character/studiotest.js`: STUDIO ok (it exports `_studiotest` and imports it back as
  `_studiotest_back`, left in `People/`, git-ignored; about 45 minutes here: `ONLY=jewellery` runs just the steps
  whose words match, after the new character). `node tools/character/tailor/check.mjs`: TAILOR ok (68 designs on seven
  bodies, seven outfits hung by gravity on three bodies; about 7 minutes here). TIMES ok, BLENDERLOOK ok.
  `node tools/character/ueeye.mjs`: UEEYE ok (DXC isn't here: its HLSL ran as GLSL only).
  `node tools/director/peopletest.js`: PEOPLE ok (a Character Studio export as Mari's body, the simple view; it needs
  an export on the machine: STUDIO's `_studiotest` will do). Delete `People/_studiotest_back` before a STUDIO run: an
  old one left there failed the import's "every file the same" once.
- `node tools/director/desktest.mjs`: DESK ok (the desk's logic without a browser; it maps `three` to the vendored
  copy, so modules that draw are tested too; the lives: node and Python agree on every preset, the timers, a pot
  following its hob, the burnt time kept, the acts; every effect and sound known). `node tools/director/guide_shots.mjs`: GUIDE ok (every part the guide
  shows, driven in a browser and pictured; it makes and removes a scratch game `ZzGuide` and a take in
  `Footage/Sample/`).
- **Run the browser checks one at a time**: two at once on this machine's software GPU starve each other (LESSONS
  2026-10-24). Restart a desk or Studio server after changing its Python (find the PID, kill it in a second command).

## 4. What's next (ask which)

0000000g. **Write a story in the writers' room** (`python tools/writers/serve.py`, then http://127.0.0.1:8795, or the
   dashboard's tile): drag shapes from the palette, join them by their dots, type titles and labels on the chart,
   Shift-drag a box round a part for an act, About for the brief; the Problems bar says what's missing. Build it and
   say what to change: the shapes, what a talk asks for, how the outline lands on the desk (`BUILD.md`). Then
   "build <G> from its BUILD.md" when it's time to turn it into the game.

0000000f. **Try the salon's easier editing** (the branch `easier-hair-editing`, off main, 2026-10-26; docs/SALON.md has
   how it's used, docs/SALON_REVIEW.md what was hard and what each item became): place a strand (root, end), drag its
   **arrowhead** for its length and direction, turn the view and drag it again, OK; **Split** for a side pane and drag
   a handle there; Pull's **Scope** and the padlocks; the view buttons (1, 3, 7, Shift for the opposite, 5 ortho);
   drag a lock's **green root** to slide it, its **body** to swing it (Shift: slide; R and G); Ctrl-click or a box
   to pick several; **Let it fall** in Selected; the Locks list (rename, solo, fold, delete, the Group picker); New
   locks like the last one; close the page with an edit and open it again (the draft). Say what's still awkward:
   the arrowhead's size and where OK sits, the default scope (the lock and its twin), whether a click on the
   selected lock's body should swing or pick, the edge pan's speed. Next from SALON_PLAN if wanted: the brushes
   (comb, grow, puff, smooth), the galleries, tracing the outline over the reference; or the salon in the T-pose.
0000000e. **Eyes like MetaHuman's** (DECISIONS 2026-10-26, night; docs/research/eyes.md §4): built on
   `claude/bold-ride-mcg3gt`, merged with the lash work (`better-eyelashes`) into `better-eyes-and-eyelashes`. The Studio's eyes are `tools/shared/eye.js` (the iris behind a refracting cornea, the
   cornea reflecting the lights, the iris lit as a bowl; STUDIO traces the refraction by Snell's law). The export is
   rigged on MHR's skeleton, the eyes on `l_eye`/`r_eye` carrying their paint baked flat and the eye's shape and paint
   (`extras.studioEye`), the lids resting on the eyes (a file has no stencil) and each opening's outline in the skin's
   extras. The desk wears it as a cast member's body (`previs_body: "people/<name>"`, the Database's body picker:
   "<name> (Character Studio)"), its eyes refracting; the toolbar's **Simple** draws everything plain when it lags
   (PEOPLE). In Unreal (written blind: run it once with the editor, UNREAL_FLOW §1d): `storykit.people` imports the
   export as one skeletal mesh, its eyes wearing M_StudioEye (made from text; UEEYE runs its HLSL as GLSL against a
   traced ray), and Generate uses it for a cast member who is the character. Next, if wanted: §4's steps 5 and 6
   (the room in the cornea, photo irises, the eyes' life), the caustic and an eye occlusion in Unreal. Then (DECISIONS
   2026-10-26, late night) iris patterns and pupil shapes after the user's references, a heart among them, and
   sixteen styles (Skin, Eyes, Iris and pupil): say which look right and what to change in the others.
0000000b. **Look at the three eye shapes** (Face, Look: fox almond, half-lidded, round doll; or Face, Lashes, Style, the
   "Eye shapes" group) against the drawing and say what to change: the fox's sweep and wing (Sweep, Outer flare, Inner
   length), how far down the half-lidded lashes lie (Lift) and how dense (Upper lashes, Under-lashes), the doll's spike
   count and length; the liners' wings and points (Skin, Makeup: Liner wing, Liner thickness, Inner corner liner).
000000. **Look at the anime lashes and the pink eye makeup** (Face, Look: anime pink; or Face, Lashes, Style; Skin,
   makeup preset anime pink) against the references and say what to change: the hairs' count, length and thickness
   (Upper lashes, Length, Thickness), the clusters (Clumping, Spiky clumps, Long and short, Under-lashes,
   Criss-cross), the lower lashes' angle and length (Lower lashes down, Lower length),
   the pinks' strength and hues (Eyeshadow, Under-eye shadow, Inner corner, Waterline and their colours), the liner's
   thickness and wing, and whether the look should set the brows too (a look can: `brow` in `looks.js`).
0000000. **Look at the second reference's five lash sets** (DECISIONS 2026-10-26, last thing; built on `eyelash-more`;
   docs/research/lash_reference.md's last section): Face, Look: older man (sparse lashes), glam smoky plum, fluffy
   mink, doll volume, natural medium; or Face, Lashes, Style, the "Lash sets, after the second reference" group. Made
   from the write-up, not the photo: compare them with it and say what to change (the hairs' count, length, lift and
   crossing; the lower lashes; the greying look's grey share; the lower liner's thickness and reach, Skin, Makeup;
   Eyeshadow size for the smoky plum; Hooded lids in Body, the sculpt, for the old man's fold). Men still start with
   the lashes off like everyone: whether a masculine base should start on the sparse set is the user's call.
00000. **Look at the new bodies and the tailored clothes** (Feminine or Masculine, then the outfits named after the
   references: `school uniform (summer)`, `office (pencil skirt)`, `skirt suit`, `shirt and shorts`, `t-shirt tucked
   in`); characters made before have the new bodies too. Say what to change: how loose each design hangs (its Fit, its Hang: fullness, stiffness, weight; the designs' own
   `drape` in designs.json), the folds' size, the tuck, the cardigan's bulk. A drape takes a few seconds a garment here
   in software (an outfit over ten); the RTX 3090's CPU is faster. Next for the drape if wanted: watching the cloth
   fall, keeping a fold off its neighbour (self-collision), hanging in a desk pose, and the clothes into Unreal as
   skeletal meshes with Chaos Cloth on a skirt's hem (TAILOR §4).
0000. **Shape a character in the T-pose** and say what's still awkward: the pose (arms level; a little lower, like
   many references, is one number in `pose.js`), the Belly control's flat (all the way down; a body with a bigger belly
   may want more), whether the salon (the Hair tab, still in MHR's A-pose) should show the T-pose too.
000. **Look at the little things and listen to them**: the Sample's kitchen (the kettle: switch it on in Play with E;
   the tea), the hall's cigarette, the study's phone and TV; the guide's §11. Say what to change: how much steam, the
   sounds (made in the browser, so any of them can be tuned or swapped for a recording), the sizes, and which
   things next (IMMERSION.md §1's "Later": a fan, a kerosene heater, a kotatsu, a wind chime, a microwave, a
   washing machine, a butsudan's bell). Unreal's side is IMMERSION §5 (a Blueprint per life, Niagara, the
   `life` table in class_map), with the editor.

00. **Try the new desk with the guide open** (Help, Open the guide) and say what's still awkward: type a scene, drag
   Mari onto a mark, trim a real take on its waveform, a quick task, an act, Ctrl+K, F9 in the Watch, bring back a
   save. The pictures are made in software here: on the RTX 3090 they're instant.

0. **Look at the jewellery, the nails and the underwear** in the Studio and say what to change: necklace lengths and
   weights, the hoops' size, the nails' length and shape (painted: a long acrylic would need a modelled nail), more
   underwear styles (a lace that reads on small pieces, a push-up's padding, a bodysuit, a slip), and colours.
0b. **Try the desk's new motion work** on a real Kimodo take: a segment from the clip card, Send to Studio by its
   name, a layer (arms over a walk), the blends; then DESK_REVIEW §3, the open items: the shot list loaded into the
   demo by name (needs Kimodo here), the reach into Kimodo, the `motions` table (idles, the seeker's loops) playing
   in the Watch and Play, a mark tool on the desk's stage.
0c. **NPC patterns** (docs/PATTERNS_PLAN.md, a plan): states such as calm, uneasy and hunting, each with its own
   motions (a per-character motion set by style and role); reusable patterns; routines and patrols. Its §13 has
   five questions for the user, and §12 the build order (motion sets on NPCs first).
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
