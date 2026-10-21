# HorrorStudio: notes for Claude

One Unreal Engine 5.8 project that makes short (2.5 to 3 hour) first-person horror games, one after another. Every
game lives in this project (docs/STUDIO.md), so shaders, systems and tools are built once.

**The split:**
- **The user** writes rough stories and makes the MetaHumans, the takes (MiniMax, Japanese voice, close-up face
  videos, 10 s or less each) and the face mocap, and fine-tunes.
- **Claude** is co-lead engineer and assistant artist: it turns stories into `Content/Games/<Game>/story.json`
  (docs/STORY_FORMAT.md), builds and checks the greybox, the systems and the animation passes, and reviews every
  frame that matters by measurement.

Games go **spine first** (the actor scenes, timed by their takes), then the player's tasks stitched between them
(docs/PIPELINE.md). **Everything is plotted, blocked (bodies, shots, events) and reviewed in the director's desk
(`tools/director/`) before it's built in Unreal:** the desk's storyboard and glTF blocking are the reference the
Unreal build must match. Directing craft: docs/DIRECTING.md.

**If `SETUP.md` has unticked phases, you're in setup:** work the next phase and nothing else.

## Start every session with

1. `docs/DECISIONS.md`: the user's answers. They override everything, newest first.
2. `python tools/story.py --game <Game> notes`: what the user left on the director's desk. Answer with a note
   (`by: claude`) and tick what you've done.
3. `SETUP.md` while setup isn't finished; then `docs/games/<Game>.md` for the game in progress.

## Where things are

| Path | What |
|---|---|
| `Content/Games/<Game>/story.json` | **a game**: world, scenes, motions, stitches, flow, endings, secrets, notes |
| `Content/Studio/class_map.json` | which Blueprint each story `use` becomes (SETUP S6) |
| `Content/Studio/poses.json` | the previs skeleton (UE mannequin bone names) and the pose library for blocking |
| `Content/Studio/soma77.json` | Kimodo's 77-joint SOMA skeleton (names, parents, T-pose): retargeting its motions onto MHR |
| `Content/Studio/Bodies/` | bodies for the desk: `MHR.fbx` (Meta's MHR, Apache-2.0, ships, the default; `MHR_hi.fbx` for exports) and any local ones (Manny, Mixamo, MetaHuman bodies: never shipped) |
| `Content/Studio/Library/` | **the CC0 library** (docs/ASSETS.md): `index/` (mesh sizes by name: 900 Base Mesh props), `meshes/`, `textures/` (fetched), `LEDGER.json` (where each came from) |
| `Content/Studio/Skin/GlassSkin/` | the glass-skin texture set for MetaHuman faces (`tools/glass_skin.py` makes it; docs/METAHUMAN_LOOKS.md §2) |
| `Content/Games/<Game>/Motion/`, `Previs/` | generated motions as desk files (`motion.py preview`); the desk's glTF blocking exports |
| `Content/Python/storykit/` | `storylib` (loading, placement, clip lengths), `plan` (world → pieces), `shotlib` (shot cameras, projection), `library` (CC0 refs, sizes, the ledger): plain Python. `importer`, `shots`, `surfaces` (library imports, M_StudioSurface) and `skin` (glass skin onto a MetaHuman) are editor-only |
| `studio.cmd`, `tools/launch.py` | **the launcher**: `.\studio` (PowerShell, the project folder) lists every tool by section; a number runs one (asking for the game and any word it needs), words filter, `r1` reruns a recent one; the pages open in their own window and the browser. A new tool gets a line in its `TOOLS` table |
| `tools/` | `check_all`, `story_check`, `level_check`, `shots_sheet`, `plan_view`, `story` (views and handoffs), `intake`, `voice_placeholder`, `motion` (Kimodo jobs, `constrain`, `run`, `check`, `preview`, `shotlist`, `import` from the demo: one file or every shot-list name), `kimodo` (runs Kimodo from its uv environment, caches in one folder: `check`, `login` or `encoder` (the text encoder without a token), `gen`, `demo`, `stage` (a story's rooms for the demo's Stage panel); the demo's studio additions (Loop, In place, Stage, Path, Pose) are `setup/kimodo_studio.patch`, docs/ANIMATION.md has their map), `kimodo_constrain` (blocking -> Kimodo keyframes, runs inside that environment), `kimodo_poses` (the pose library shared by the desk and the demo's pose window), `kimodo_presets` (horror prompt presets, generated and measured), `package_game`, `cc0` (find, fetch, add and record CC0 meshes and textures), `metahuman` (a cast member's desk body as a MetaHuman Creator script: constraints, skin, auto-rig, assembly, the body's FBX back; docs/METAHUMAN_ROUTE.md), `glass_skin` (the glass-skin texture set and recipe; docs/METAHUMAN_LOOKS.md), `scriptgen` (an outline -> a format 3 story drafted scene by scene by a local model through Ollama: bible, cards, scenes, assemble, the review pack; setup/scriptgen.json; docs/REFERENCES.md), `retarget` (Kimodo's motions onto the MetaHumans: NPZ -> BVH -> FBX on SOMA with Blender's module, checked against the NPZ, Kimodo's skinned body as SK_SOMA, a generated editor script that builds the IK Rig and retargeter and batch-retargets onto each MetaHuman body; docs/ANIMATION.md §1b), `garment` (clothing on the go: GarmentCode from its repo with uv, a cast member's measures as its body, a design's sewing pattern, the panels placed in 3D as OBJ plus seams for Unreal's cloth; §6), `director/` (the desk: `serve.py`, `index.html`, `app.js`, `stage.js` (3D, library meshes and textures), `motion.js` (poses, easing, modifiers, blends), `bodies.js` (real bodies driven by the blocking), `poses.html`, `bodies.html` (check a body against every pose), `shape.html` (shape each cast member's MHR body, export it for MetaHuman), `kimodo.html` (the Kimodo shot list: every motion to make in the demo, its save name, import), `flesh.html` + `flesh.js` + `softbone.js` + `lines.js` (the Lines tool: the fat suit's silhouette as vertical lines with points to pull; the fat-suit and water-balloon experiments; soft bones after EZSoftBone: spring chains per soft region, the spread, collisions with the world and the arms; the jiggle slider, the chubby hourglass, the refiner brush (volume and jiggle), jiggle by area, MHR LOD 0 to 4; docs/FLESH.md §5), `vendor/` (three.js)) |
| `tools/score/` | **the score room** (docs/MUSIC.md): `serve.py` (port 8791), the page that writes music cues with the sampled orchestra lifted from Woohill (horror piano and strings, K-drama action cues, romance horror), makes variations and keeps favourites in a palette (`Content/Studio/Music/palette.json`, `Content/Games/<G>/Music/palette.json`) the desk will read; `js/` the engine (Woohill's core, `50-kit` cues and variations, `6x` the cue families, `70-player`), `check.js` (SCORE), `pagetest.js` (SCOREPAGE); samples in `Content/Studio/Music/samples/` (CC0); research in docs/MUSIC_RESEARCH.md, the cue list in docs/MUSIC_CUES.md (generated) |
| `setup/` | `setup.py` (env, plugins, enable, unrealclaude, fetch, configure, build, editor, kimodo, `kimodo-patch`: our demo additions in and out), `plugins.json`, `sources.json`, `kimodo.json` |
| `Plugins/UnrealClaude/` | the MCP bridge into the editor (built with the 5.8 fix; `.mcp.json` points at it) |
| `Source/StoryRunner/` | C++: the StoryRunner and the struggle (docs/RUNNER_SPEC.md), its own module; `Source/HorrorEngine/` is Epic's template code, untouched (docs/STUDIO.md) |
| `docs/` | `DECISIONS`, `PIPELINE` (v2: outline → local-model draft → Japanese pass and MiniMax prompts → takes on the timeline → Kimodo shot list → Unreal), `PIPELINE_V2_PLAN` (its tools, in build order), `UNREAL_FLOW` (the blocked game into Unreal: what goes across, the steps, what's built), `KIMODO` (prompting rules, the shot list rules, motion names), `VOICES` (MiniMax expressions and voices, what's been tested), `REFERENCES` (the shapes our games borrow, Roblox horror mechanics, yandere; what drafts are reviewed against), `WRITING` (horror romance in first person: hanging lines and replies, intimacy for the player's eye, simple gameplay, deaths), `STORY_FORMAT`, `DIRECTING` (shots, moods, scares, QTEs, cutscenes, animation from the player's eye), `TRICKS` (seams, camera, immersion, stitch templates, the grab), `STUDIO`, `ANIMATION`, `ASSETS` (the CC0 library, texturing), `PROCEDURAL` (the future experiment: animation families from generated variations), `FLESH` (the fat suit and the water balloons: jiggle and sag from soft tissue; §5 the soft bones), `METAHUMAN_ROUTE` (design in the desk, make and rig in MetaHuman Creator through its Python API, jiggle with Kawaii), `METAHUMAN_LOOKS` (East Asian faces in Creator, glass skin, hair that fits the head, the hairstyle tools), `assets/awesome-cc0.md` (where to find CC0 things), `RUNNER_SPEC`, `TOOLBOX`, `RESEARCH`, `LESSONS`; later `MCP_TOOLS`, `TEMPLATE_AUDIT`, `games/<Game>.md` |

## Checks (each ends `<NAME> ok`)

**Offline:**
- `python tools/check_all.py [--game G]`: STORY, LEVEL, SHOTS (plan) for every game
- `node tools/score/check.js`: SCORE (the music cues and the palettes)
- `python tools/motion.py --game G check`: MOTION

**Editor:**
- `storykit.importer.build(G)`
- `Story.Autoplay`: PLAYTHROUGH
- `storykit.shots.take(G)` then `tools/shots_sheet.py --game G`: SHOTS
- automation tests: RUNNER

Before every push: CHECKS ok, and PLAYTHROUGH ok on every game the change can touch.

## Rules

- **Text is the truth.** Change story.json and rebuild; never hand-edit a story actor (the importer rebuilds
  everything tagged `story`). The user's hand work lives in `/Game/Studio/`, `/Game/Games/<G>/Art|Audio|Faces|Anim`
  and the `art` fields.
- **Never use a word the format doesn't have.** Grow the runner, the check and STORY_FORMAT.md in one commit.
- **Timing is elastic:** never anchor anything to an absolute scene time. Cues ride on clip edges, bodies on clip
  lengths. A clip is one take of 10 s or less, and every cut has a seam (TRICKS.md §1).
- **A game never references another game's folder.** Shared things move to `/Game/Studio/`.
- **Keep context small:**
  - `story.py flow | show <id> | rooms | notes` instead of reading story.json
  - `tail` on outputs
  - contact sheets, not single frames
  - read the review JSON first
- **The editor through UnrealClaude** (MCP server `unreal`), one call at a time. Python goes through
  `unreal_execute_script`. Save before and after bulk changes. Without the editor:
  `<engine>/Engine/Binaries/Linux/UnrealEditor-Cmd <project> -ExecutePythonScript=…`.
- **First person: the camera is the player.** Only what their eye can see from where they can stand: one lens
  (`game.fov`), shot sizes by distance, `stance` for height, `push` to lean in. Never a `fov` on a clip
  (DIRECTING.md §1).
- **Assets are CC0 or ours.** Place library props by name (`cc0.py props`, `story.py art`), texture rooms with `look`
  (docs/ASSETS.md §4), fetch with `cc0.py fetch`; anything not CC0 (Mixamo, Epic, MetaHumans) stays in the user's
  own project and never in a shared file.
- **You can't judge the scare; you can judge the frame.** Measure (the shot review, MOTION), say what you think the
  mood needs, and let the user decide in play.
- **One step per commit, pushed.** The user changes course quickly. When something takes a second try, write the
  lesson in docs/LESSONS.md first.
- **The user's machine is Omarchy (Arch Linux, Hyprland), RTX 3090:** Unreal 5.8.3 is the Linux prebuilt at
  `/run/media/hal/Derick/Unreal/UnrealEngine` (started with `ue`; notes in `../unreal-omarchy/`), and the project
  is this folder. Commands for the user are bash with full paths; Python is uv. Never `pkill -f` or `pgrep -f`
  in the same command line that names the process (it matches and kills your own shell): find the PID in one
  command, kill it in the next.
