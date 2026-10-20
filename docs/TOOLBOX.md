# What Claude needs to make these games fast

The point of the pipeline: Claude works in text and measurements, and spends tokens on the story and the hard
problems, never on clicking through the editor or describing pictures. Below is every capability, whether it's in
the kit or built in setup, and why it matters.

## Already in the kit (offline, tested)

| Tool | Gives Claude |
|---|---|
| `story_check.py` | proof that the story works, on every path, without opening Unreal: references, softlocks, every choice, event, timer and trigger cutscene both ways, secrets both ways, playtime per ending (typical and fast), seams on every cut, clip lengths, the directing rules |
| `level_check.py` | proof that the blockout is sound: overlaps, props in walls, blocked doors, standing room |
| `shots_sheet.py --plan` + `shotlib` | framing maths for every scripted look, scene start and seam, before any picture exists |
| `plan_view.py` | the level from above as one PNG |
| `story.py` | small views instead of reading the whole file: `flow`, `show`, `rooms`, `stats`, `clips` (the shooting script), `cast`, `art` (the shopping list), `notes` (what you asked for), `durations`, `new` |
| `director/` (the desk) | the shared surface with you, and the reference for Unreal: the flow; scenes and clips with shot sizes, camera moves, events and **blocked bodies** (pose keys, eases, modifiers, blends) on a **3D stage from the player's eye**; the **body check** (visible parts, framing, joins, length fits, one-click fixes); the **storyboard**; **Watch** (the whole game as an animatic: unskippable scenes, task cards with timers and trigger deaths, playable events); **glTF export** of the blocking; notes both ways; the takes list; the pose library page |
| `intake.py`, `voice_placeholder.py` | takes in by name, measured; placeholder voices for honest timing before the takes exist |
| `motion.py` | Kimodo jobs from the story, sized and pinned to the marks; a check that the results land |
| `cc0.py` + `Content/Studio/Library/` | props by name at real size before any file is fetched (900 from The Base Mesh), textures tiled by real size, fetch and record (the ledger, the build's THIRD_PARTY.md); the desk shows them (docs/ASSETS.md) |
| `director/bodies.js`, `bodies.html`, `shape.html` | real bodies driven by the blocking (Meta's MHR by default, or Manny, Mixamo, MetaHuman bodies), checked against every pose; the Shape page designs each cast member's body and exports it as a MetaHuman base |
| `package_game.py` | one game out of the studio, with its credits list |
| `check_all.py` | everything, every game, one line each |

## Built in setup (in the editor)

| Capability | Why | Phase |
|---|---|---|
| **UnrealClaude** MCP (with the 5.8 fix): spawn and move actors, edit Blueprints and Anim Blueprints, assets, materials, input, **capture the viewport**, read the **output log**, **run Python** (`execute_script`, shown at setup) | Claude's hands and eyes in the editor | S4 |
| **storykit in the editor**: `importer.build(game)` (levels, cast stand-ins, NavMesh, manifest, shot cameras) and `shots.take(game)` (pictures from the player's eye) | the world and its pictures from text | S8 |
| **The StoryRunner** with **`Story.*` debug commands** and the **debug HUD** | jump to any node, replay any scene or variant, see the state in every screenshot | S7 |
| **The playthrough bot** (`Story.Autoplay`) | proof that it plays in the engine, every commit | S10 |
| **The scene review**: pictures at every clip edge, seam and grab frame, from the player's eye, as a contact sheet with the measured rules | judging the frame without watching video | S10 |
| **Headless editor runs**: `UnrealEditor-Cmd.exe <project> -ExecutePythonScript=… -unattended` and automation tests (`RUNNER ok`) | checks without the editor window open | S7 |
| **storykit.media**: takes in as SoundWaves, face videos queued for MetaHuman Animator, animations on the right tracks by take id | the polish layers swap in by name | S12 |
| **Kimodo** (the Fab plugin, scriptable if possible; else the local CLI) | body animation from a prompt that Claude can check | S11 |
| **The struggle system** (IK + physical animation) | one grab system for every game | S11 |

## Habits that save tokens

- Read `story.py notes`, `flow` and `show <id>`, not story.json whole. Read check output through `tail`.
- **Pictures:** one contact sheet per scene, never single frames. Read the review's JSON first, and open the sheet
  only for what failed.
- **Change data, not code:** a new scare is a beat, a new scene is JSON, a new game is a folder. The runner grows
  only when the format grows (one commit: the runner, the check and the doc).
- One step, then the checks, then a commit and a push. When something takes a second try, the lesson goes in
  LESSONS.md.
