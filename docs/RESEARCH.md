# Fast horror pipeline in Unreal: research and plan

Researched 2026-10-19. The goal: a linear, Amnesia-like first-person horror game of 2 to 3 hours. Claude writes the
whole story and blockout as data, and almost no code. The user makes the MetaHumans, the Japanese voice and the face
video.

## 1. The verdict

Almost everything exists already, and one thing has changed since the first answer: **Unreal 5.8 ships an official,
Epic-made MCP plugin, with an Epic-published Claude Code plugin.** Claude can drive the editor directly: actors,
Blueprints, Sequencer, materials, UI widgets, Niagara and automation tests (about 52 toolsets and ~830 tools). The old
problem ("Blueprints are binary, Claude can't touch them") is mostly gone.

The one thing no library has is **"one story file becomes the whole game."** We build that glue once: a story runner,
an importer that builds the level from JSON, and the checks. That's roughly 1.5 to 3k lines, written in the first
month and then reused for every game. After that, each game is a `story.json` plus art swaps, with close to zero new
code.

## 2. The stack (each piece already exists)

| Need | Use | Licence and state | Notes |
| --- | --- | --- | --- |
| Engine | **Unreal 5.8** | free until $1M gross | Last planned UE5 release (UE6 early access is targeted for late 2027). MegaLights is now production-ready (cheap shadowed lights: horror rooms full of candles and lamps) |
| Claude's hands in the editor | **Unreal MCP** (`ModelContextProtocol` plugin plus `AllToolsets`), **Epic's "Unreal Engine MCP" Claude Code plugin** | official, **experimental** | Setup: enable the plugins, run `ModelContextProtocol.StartServer` (or `GenerateClientConfig` for Claude Code). Toolsets are classes in C++ or **Python** (`unreal.ToolsetDefinition`), so we can add our own. It runs on the game thread, one call at a time |
| Play-testing and screenshots through MCP | **GameplayMCPToolset** (third party, UE 5.8: PIE start and stop, simulated input, `game_capture_screenshot`), or our own Python toolset | community | I couldn't confirm the official toolsets cover PIE and screenshots. The Python automation API certainly does (`take_high_res_screenshot`, one shot per CameraActor) |
| First person, flashlight, flicker, sprint | **First Person template, "Survival Horror" variant** (official since 5.6) | Epic | Dark lighting presets, a flashlight, a flickering light, sprint with UI |
| Horror systems | **TirdadMH/Survival-Horror-Game-Template** (GitHub) | **MIT**, UE 5.6, mostly Blueprint, 13 stars | A stalker AI (patrol, investigate, pursue, kill) with a behaviour tree; a "looker" whose head tracks the player; an inventory with examine, use and drop and 3D inspection; keys, batteries and medkits; crouch, lean and head bob; footsteps by surface; doors, lockers, light switches; a **combination lock**; **placeable notes**; two flicker lights; **scripted jumpscares**; objectives; a cutscene player; a HUD. **Audit it first**: it's small and young, so treat it as a parts bin, not gospel |
| Event and story scripting | **Our own story runner** reading `story.json` (the recommendation); **FlowGraph** (MothCocoon, MIT, ~1.9k stars) as the visual layer later | MIT | FlowGraph is the community's standard "level scripting without the level Blueprint" (async nodes, Sequencer and SaveGame integration, debug on wires). Option for later: the importer writes Flow assets so you can *see* the story as a graph |
| Subtitles | **Subtitles and Closed Captions plugin** (Epic) | official | Subtitles independent of sounds, localisable text, `UseSoundDuration`, `StartOffset`. Japanese audio with English text is just text on the sound asset |
| Dialogue | **None for game one** (linear: a line is one beat action) | | If choices come later: **DlgSystem** (NotYetGames, MIT, UE 5.6 to 5.8) |
| Save | **Chapter checkpoints** (a linear game needs only "which beat, which flags, which items"); **SPUD** (MIT) if needed | MIT | Our runner's state is small JSON, so saving it is trivial |
| Settings menu | UE's `GameUserSettings`, plus a cheap Fab menu (FoxSettings, or Nice Settings Menu for 5.3 to 5.7, Blueprint) | paid, small | Settings Widget Constructor (MIT) stops at 5.3 |
| Faces from your generated video | **MetaHuman Animator, mono video**: Live Link Hub, then Capture Manager, then a **Mono Video Ingest** device pointed at a folder of video files | official, in the engine since 5.6 | Yes, pre-recorded files work. Epic's guidance: keep the lip seal and the inside of the upper eyelid visible, frame tightly for face-only, use the highest fps the source allows. Also **audio-driven** facial animation (5.6 on: head movement, adjustable emotion) straight from your Japanese audio |
| Body capture | **MetaHuman Animator markerless mocap** (new in 5.8, experimental, Windows): full body and face **from a single webcam** | official | You can act the body moves at your desk, which may beat text-to-motion for story characters |
| Generated animations | **Uthana Text to Motion 3.0 API** (FBX or GLB at 24, 30 or 60 fps, a UE5 FBX preset, server-side retarget, pay per generated second; also on Replicate) | paid per use | The API flow: a prompt, then FBX, then UE import through Python, then the IK Retargeter onto the MetaHuman. Plus the free **Game Animation Sample** for locomotion |
| Environment art | Fab packs (paid or free monthly), the horror note pack, etc. | | **Megascans stopped being free after 2024**; legacy claims still work |

## 3. The workflow, per game

| Step | Who | Takes | Output |
| --- | --- | --- | --- |
| 1. Rough story | you | an evening | a page: premise, the twist, 6 to 8 chapters |
| 2. Refine | Claude | 1 session | a beat outline, the cast, notes and diaries, the puzzles (each with an item-lock chain) |
| 3. **Write `story.json`** | Claude | 1 to 2 sessions | rooms, props, items, notes, lines, beats (the CLAUDE.md dictionary) |
| 4. Offline check | Claude | minutes | `STORY ok`: references, softlocks, playtime estimate of 150 minutes or more, reading speeds |
| 5. **Build the greybox** | Claude, through MCP or Python | minutes | the importer spawns every room, door, prop, trigger, pickup and stand-in mannequin |
| 6. Play-test bot | Claude | minutes | `PLAYTHROUGH ok`: walks the navmesh beat by beat, triggers every interaction, reaches the end |
| 7. Shot review | Claude | 1 session | a contact sheet per chapter from the player's eye, checked against the review spec |
| — **a playable, unrefined game** | | **about 1 to 3 days after the story** | |
| 8. Script handoff | Claude to you | | `lines.csv` (id, speaker, Japanese text, English text, emotion, shot) for MiniMax |
| 9. Voice, faces, MetaHumans | you | 1 to 2 weeks | audio files and face takes named by line id: the importer finds them by name |
| 10. Art pass | you buy kits, Claude swaps them | 2 to 4 weeks | `"art": "/Game/..."` on each prop in `story.json`; the importer swaps the block for the mesh and keeps the footprint |
| 11. Animation pass | Claude (Uthana) and you (webcam mocap) | 1 week | clips by name per beat |
| 12. Polish and play-test | both | 1 to 2 weeks | lighting, sound, scare timing |

That comes to **about 6 to 8 weeks a game** once the pipeline exists. The first game is about 3 months, because
month one builds the pipeline.

## 4. What we build once (month one)

1. **Project template:** First Person "Survival Horror" variant in C++ mode, the MIT horror template merged in,
   Subtitles plugin, Python Editor Script plugin, PythonAutomationTest, MetaHuman, Live Link Hub, Unreal MCP and
   AllToolsets.
2. **`StoryRunner`** (C++ subsystem, about 800 lines): reads the DataTables built from `story.json` and runs beats:
   triggers in, actions out. It only calls the template's Blueprint interfaces, so the template's internals don't
   matter.
3. **`importer.py`** (editor Python, about 600 lines): `story.json` becomes the level (blocks, doors cut into walls,
   trigger volumes, template actors), the DataTables, the subtitle assets and the audio by id. It is idempotent:
   rerunning it rebuilds only what changed.
4. **The checks** (about 600 lines): `story_check.py` (offline, no editor), `level_check` (overlaps, floating props,
   closed rooms, door clearance), `playthrough` (a PIE bot), `shots` (screenshots, contact sheets, framing metrics).
5. **`CLAUDE.md`**: the dictionary (the draft is next to this file). Every verb in it maps to one runner action, so
   it stays the truth.
6. **Pilot:** a 15-minute chapter end to end (greybox, then one voiced MetaHuman scene, then one art-swapped room) to
   prove every link before game one.

## 5. Where Claude runs

**On your Windows PC with Claude Code**, not in this cloud container (no GPU, and the editor needs one). The editor
stays open with the MCP server on; Claude edits `story.json`, runs the importer and checks through MCP, and reads
screenshots. Version control: Git with LFS (or Perforce or Diversion). `story.json`, the Python and the C++ are text
and diff well; the `.uasset`s are rebuilt by the importer, so the source of truth stays text.

## 6. Risks, plainly

- **The MCP is experimental:** it may change between 5.8 patches. The importer and checks are plain editor Python,
  so they also run without MCP (`UnrealEditor-Cmd -ExecutePythonScript`).
- **Official PIE and screenshot tools are unconfirmed:** the third-party toolset or our own Python toolset covers
  them.
- **The MIT horror template is small (13 stars):** audit it in week one. Whatever is weak, swap for the Epic
  variant's version or a Fab system. The runner only talks to interfaces, so a swap is cheap.
- **Face quality from AI video is untested:** jitter from morphing frames. Try audio-driven first, use video for
  close-ups, and test one line before committing.
- **I can't judge scares:** the review spec checks what's measurable (framing, clipping, light on the subject,
  pacing gaps). Whether it's scary is your call in play-testing.
- **Steam refunds:** under 2 hours played and within 14 days. Aim for 150 minutes or more by the estimator, so a
  fast player still passes 2 hours. Declare the AI voice and the AI-derived animation in the Steam AI disclosure.

## Sources

- [Unreal Engine 5.8 is now available (Epic)](https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available), [the 5.8 forum announcement](https://forums.unrealengine.com/t/unreal-engine-5-8-released/2729274), [DSOGaming's 5.8 details](https://www.dsogaming.com/news/unreal-engine-5-8-released-fully-detailed/)
- [Unreal MCP in the Unreal Editor (Epic docs)](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor?lang=en-US), [Epic's Unreal Engine MCP plugin for Claude Code](https://claude.com/marketplace/plugins/unreal-engine-skills-for-claude-code), [the official toolset catalogue (tc-imba)](https://github.com/tc-imba/ue-official-mcp), [UnrealMCPToolsetExtensions](https://github.com/JaeSeongHa5280/UnrealMCPToolsetExtensions)
- [GameplayMCPToolset (PIE, input, screenshots)](https://github.com/BatSasha52/GameplayMCPToolset), [Efecem07/ue5-mcp-server](https://github.com/Efecem07/ue5-mcp-server), [GenOrca/unreal-mcp](https://github.com/GenOrca/unreal-mcp), [remiphilippe/mcp-unreal](https://github.com/remiphilippe/mcp-unreal), [chongdashu/unreal-mcp](https://github.com/chongdashu/unreal-mcp)
- [The UE 5.6 templates (Epic)](https://www.unrealengine.com/news/updated-game-templates-for-unreal-engine-5-6available-now), [First Person template docs](https://dev.epicgames.com/documentation/unreal-engine/first-person-template-in-unreal-engine)
- [TirdadMH/Survival-Horror-Game-Template](https://github.com/TirdadMH/Survival-Horror-Game-Template), [UE5 PSX Game Template](https://github.com/AnastasisMarinos/UE5-PSX-Game-Template), [True First Person Template](https://github.com/JDSherbert/Unreal-Engine-True-First-Person-Template), [Visq's free horror template](https://visq.itch.io/free-horror-game-template-ue5)
- [FlowGraph](https://github.com/MothCocoon/FlowGraph), [Flow v1.5 notes](https://github.com/MothCocoon/FlowGraph/wiki/Flow-v1.5), [DlgSystem](https://github.com/NotYetGames/DlgSystem), [SPUD (fork listing)](https://github.com/Bigotry0/SPUD), [Settings Widget Constructor](https://github.com/JanSeliv/SettingsWidgetConstructor)
- [Subtitles and Closed Captions plugin (Epic)](https://dev.epicgames.com/documentation/unreal-engine/subtitles-and-closed-captions-plugin-in-unreal-engine)
- [MetaHuman animation from mono video (Epic)](https://dev.epicgames.com/documentation/metahuman/metahuman-animation-from-mono-video-capture-in-unreal-engine?lang=en-US), [video capture guidelines](https://dev.epicgames.com/documentation/metahuman/metahuman-animator-video-capture-guidelines-in-unreal-engine), [MetaHuman 5.6 release](https://metahuman.com/news/metahuman-leaves-early-access-with-a-feature-packed-new-release), [workflow changes](https://dev.epicgames.com/documentation/metahuman/metahuman-workflow-changes)
- [Uthana text to motion](https://uthana.com/models/text-to-motion), [Uthana retargeting API](https://uthana.com/docs/api/capabilities/retargeting), [on Replicate](https://replicate.com/uthana/text-to-motion-diffusion-v2)
- [Python editor tests and screenshots (Epic)](https://dev.epicgames.com/documentation/unreal-engine/write-editor-tests-with-python-in-unreal-engine?lang=ko), [Screenshot comparison tool](https://dev.epicgames.com/documentation/unreal-engine/screenshot-comparison-tool-in-unreal-engine)
- [Megascans no longer free after 2024 (80.lv)](https://80.lv/articles/megascans-no-longer-free-after-2024/)

## Addendum, 2026-10-20: what changed

- **The editor assistant is UnrealClaude** (github.com/Natfii/UnrealClaude, MIT), the user's choice, rather than
  Epic's experimental MCP plugin:
  - an in-editor chat plus an MCP server on port 3000 (bridged to Claude Code over stdio by its `mcp-bridge`)
  - about 28 tools: actors, levels, Blueprints and Anim Blueprints, assets, materials, Enhanced Input, viewport
    capture, the output log, script execution (hidden by default, and permission-gated)
  - built for 5.7; **pull request 48** fixes the 5.8 compile (`FJsonObject` keys are `FSharedString` in 5.8),
    verified by its author on 5.8
  - `setup.py unrealclaude` installs it with the fix
- **Body animation: NVIDIA Kimodo** (github.com/nv-tlabs/kimodo; the code is Apache-2.0, and the SOMA checkpoints
  are under the NVIDIA Open Model License):
  - text-to-motion with keyframe, end-effector and path constraints
  - in Unreal through Animotive's free Kimodo plugin on Fab (local Docker, remote, or hosted)
  - docs/ANIMATION.md has the plan
- **One studio project for every game** (docs/STUDIO.md), **spine first** (docs/PIPELINE.md), the format is v2
  (docs/STORY_FORMAT.md).
