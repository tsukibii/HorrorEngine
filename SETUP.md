# Setup: from a fresh Unreal install to the studio pipeline

Work the phases in order, and tick each (`- [x]`) in the commit that finishes it.
- **Done** is the check's line, not a feeling.
- Steps marked **(user)** need the person at the keyboard: say exactly what to click, then wait.
- The user approves each phase before the next one starts (they QA as they go).
- Keep commits small, and push after each.

## S0. Read and ask (Claude)

- [ ] Read `CLAUDE.md`, `docs/DECISIONS.md`, `docs/PIPELINE.md`, then skim `docs/STORY_FORMAT.md` and
  `docs/TOOLBOX.md`.
- [ ] Ask the user, in one message:
  1. **the project's name:** `HorrorStudio` unless they prefer another neutral name; it becomes every game's `.exe`
     name
  2. **where it lives:** a fast drive, short path, no spaces
  3. **git hosting:** a private GitHub repo (Git LFS quotas apply), Azure DevOps, or Diversion
  4. **script permissions:** whether UnrealClaude may show Claude its Python tool (`--show-scripts`; every script
     still asks in the editor), and whether to **auto-approve** scripts in this project (`--auto-approve`: faster,
     and the editor logs each one; only on their own machine)

## S1. Prerequisites (Claude runs, user installs)

- [ ] `python setup/setup.py env`. If Python is missing: `winget install Python.Python.3.12`, then
  `pip install pillow numpy`.
- [ ] For each `MISS`, give the one command or click, and rerun until `ENV ok`. The usual misses:
  - **Visual Studio 2022 Community** with "Game development with C++" (and the Windows SDK)
  - Git for Windows
  - Git LFS (`git lfs install`)
  - **Node.js LTS** (`winget install OpenJS.NodeJS.LTS`)
  - Claude Code CLI (already there if you're reading this in it)
- **Done:** `ENV ok`.

## S2. Make the studio project (user, 2 minutes)

- [ ] **(user)** Epic Games Launcher → Unreal Engine 5.8 → Launch → Games → **First Person**, then:
  - variant **Survival Horror**
  - **C++**
  - Desktop, Maximum quality
  - Starter Content off
  - name it the S0 answer, in the S0 folder
  - Create
- [ ] **(user)** When the editor has opened (it compiles shaders once, and that's the point of one studio project),
  close it.
- [ ] **(user)** Copy everything inside the zip's `HorrorStudio` folder into the project folder, next to the
  `.uproject` (merge `Content`).
- [ ] **(user)** Open Claude Code in that folder and say "continue the setup".
- **Done:** `python setup/setup.py env` shows the `.uproject` as ok.

## S3. Git (Claude)

- [ ] `python setup/setup.py configure` (writes `.gitignore`, `.gitattributes` and the ini lines).
- [ ] `git init`, `git lfs install`, commit everything.
- [ ] Add the remote from S0, and push.
- **Done:** a clean `git status`, and the remote has the commit.

## S4. UnrealClaude, with the UE 5.8 fix (Claude, user approves)

UnrealClaude (github.com/Natfii/UnrealClaude, MIT) is built for UE 5.7. On 5.8 it fails to compile because
`FJsonObject`'s keys became `FSharedString`. **Pull request 48** fixes it at 10 call sites, compiles unchanged on
5.7, and was verified on 5.8 by its author: the module loads and serves all 28 tools. Pull request 46 is the same
fix; use 48.

- [ ] `python setup/setup.py unrealclaude` plus the S0 flags (`--show-scripts`, `--auto-approve`). It:
  - clones the source to `vendor/UnrealClaude-src` with its MCP-bridge submodule
  - merges pull request 48
  - copies the plugin to `Plugins/UnrealClaude` and sets its EngineVersion to your engine's
  - runs `npm install` for the bridge
  - writes `.mcp.json` (server `unreal` → `node Plugins/UnrealClaude/Resources/mcp-bridge/index.js`, at
    `http://localhost:3000`)
- [ ] `python setup/setup.py plugins`, fix names in `setup/plugins.json` if your engine differs, then
  `python setup/setup.py enable`.
- [ ] `python setup/setup.py build` (the first build takes 5 to 20 minutes), then `python setup/setup.py editor`.
- [ ] **(user)** If the editor asks to rebuild modules: Yes.
- [ ] With the editor open: `curl http://localhost:3000/mcp/status` returns JSON.
- [ ] **(user)** Restart Claude Code in the folder and approve the `unreal` MCP server.
- [ ] Prove the hands and eyes:
  - `unreal_status`
  - spawn a cube, then delete it
  - `unreal_capture_viewport`
  - `unreal_get_output_log`
  - run Python through `unreal_execute_script`: `import storykit.storylib as L; print(L.games())`
- [ ] Write `docs/MCP_TOOLS.md`: the tools that exist, one line each, and any quirks met.
- **Done:** all of the above work, and MCP_TOOLS.md is committed.

## S5. The studio layout (Claude)

- [ ] Make the folders of `docs/STUDIO.md`: `/Game/Studio/{Greybox,Horror,Audio/Music,Widgets,Anim}`, and
  `/Game/Games/`.
- [ ] Project settings:
  - the default GameMode is the template's
  - Python developer mode is on (setup.py configure did it)
  - the editor's start map is an empty `/Game/Studio/L_Studio`
- [ ] `python tools/check_all.py`: `CHECKS ok` for the pilot.
- **Done:** the layout is committed.

## S6. The horror parts (Claude)

- [ ] `python setup/setup.py fetch` clones the MIT horror template to `vendor/`.
- [ ] Open a copy in 5.8 (it's a 5.6 project: let it convert the copy) and list its Blueprints, interfaces and data
  tables.
- [ ] Write `docs/TEMPLATE_AUDIT.md`: each system, its Blueprint, what triggers it, whether it works in 5.8, and
  use, fix or skip.
- [ ] Migrate the "use" parts into `/Game/Studio/Horror/`.
- [ ] Fill `Content/Studio/class_map.json`.
- **Done:** the audit and class map are committed, and the template's own map still plays in this project.

## S7. The StoryRunner (Claude)

- [ ] Build it to `docs/RUNNER_SPEC.md`, one group per commit, each with an automation test:
  1. loading, state, the debug commands and the HUD
  2. stitches, beats and triggers
  3. the verbs and widgets
  4. **scenes**: staging, the elastic timeline, cues, enter and exit transitions, never skippable
  5. **seams, shot sizes and camera** (the lens per shot, push, roll, shake, the soft lock with cone, spring, avoid
     zones and `through`)
  6. choices and endings; **events** (press, mash, hold, breath, aim, struggle, choose, with warnings); **timers**;
     **interrupts**
  7. checkpoints and saves
- [ ] Run the tests headless:
  `UnrealEditor-Cmd.exe <project> -ExecCmds="Automation RunTests Story; Quit" -unattended -nullrhi -log`.
- **Done:** `RUNNER ok`, and `Story.State` prints the pilot's state in PIE.

## S8. The importer, for real (Claude)

- [ ] `unreal_execute_script`: `import storykit.importer as i; i.build("Pilot")`. Fix `Content/Python/storykit/importer.py`
  until it builds with no warnings. It was written before it ever ran in an editor; keep the maths in `plan.py`,
  where the offline checks see it.
- [ ] Add to the importer:
  - a NavMeshBoundsVolume per level
  - the shot cameras (`shot:<scene>.<clip>`)
  - **the manifest** `/Game/Games/<Game>/Manifest/DA_<Game>_Manifest` (soft references to every asset the story
    names)
- [ ] Add to story_check: no asset paths into another game's folder.
- [ ] **The blocking into Unreal:**
  - in the desk, Export glTF for each pilot scene (into `Content/Games/Pilot/Previs/`)
  - import with Interchange (the skeletal mesh and its animations)
  - make one IK Retargeter, previs → the UE mannequin, and later one per MetaHuman body type (the previs bones use
    mannequin names and a T-pose rest)
  - the stand-ins play the retargeted blocking per take id
  - compare against the desk's storyboard (a screenshot per clip from the player's eye): the pictures should match
- [ ] The CC0 library (docs/ASSETS.md §5): the pilot's chairs, desk and kitchen table are library meshes (they
  ship, fetched); the build imports them into `/Game/Studio/Library/Meshes/`. Screenshot the kitchen from the player's
  start: if the chairs face the wrong way, set `library_yaw` in `class_map.json` (90, 180 or -90) and rebuild.
- [ ] Textures: `python tools/cc0.py textures wood floor`, pick one, `cc0.py get ambientcg/<id> --tile 1.5`, give the
  pilot's hall a `look` (`floor`, `walls`), rebuild. This is the first real run of the ambientCG fetch and of
  `surfaces.master_material()`: fix either if it fails (or build M_StudioSurface by hand to §5's spec). Compare the
  hall with the desk's frame.
- [ ] **(user)** Play the pilot in PIE.
- **Done:** `IMPORT house: … pieces`, and the user has walked it.

## S9. The director's desk (user and Claude)

- [ ] (optional, user) The desk already uses Meta's MHR body. To also block on the game's own skeleton: export
  `SKM_Manny_Simple` (Characters/Mannequins/Meshes, right-click → Asset Actions → Export → FBX) to
  `Content/Studio/Bodies/Manny.fbx`. It stays on this machine.
- [ ] `python tools/director/serve.py`, then the user opens http://127.0.0.1:8780.
- [ ] Open the **Shape** page (top bar) with the user: shape Mari, fit her widths, save, and see her in the
  storyboard. The **Bodies** page shows any body file following every pose (MHR: under 1° per limb).
- [ ] Walk the user through the desk:
  - the flow board, and a scene's clips with the elastic timeline
  - variants
  - the takes list
  - notes
  - the Flow tab's 3D stage under the board (select a scene, press ▶ scene, scrub; Free cam to inspect the set)
  - "Check bodies" on the hall scene (what the player sees, framing, joins)
  - the Storyboard tab (Draw)
  - Watch (Play from the start: hide in the locker and keep still, drag free of the grab, beat the timer)
  - the Poses page
- [ ] The user leaves a note; Claude answers it (`story.py notes`, then a reply note).
- **Done:** the note loop has gone round once, and the user has shaped a cast member.

## S10. The playthrough bot and the scene review (Claude)

- [ ] `Story.Autoplay` to the spec: `PLAYTHROUGH ok` on the pilot (main path).
- [ ] `storykit.shots.take("Pilot")`, then `python tools/shots_sheet.py --game Pilot`: `SHOTS ok`. Read
  `Saved/Story/Pilot/Shots/*.png` and fix what fails.
- [ ] Add both to CLAUDE.md's checks.
- **Done:** CHECKS, PLAYTHROUGH and SHOTS all ok on the pilot.

## S11. Bodies and the grab (Claude)

- [ ] **(user)** Kimodo, built from source with uv (no Docker: everything in one folder you choose):
  1. Install uv if it isn't there (one small program): `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`.
  2. Ask for access to **meta-llama/Meta-Llama-3-8B-Instruct** on huggingface.co (Kimodo's text encoder is gated;
     approval is usually quick) and make a read token.
- [ ] `python setup/setup.py kimodo` (or `--home D:/Kimodo` for another drive; `--cuda cu126` for an older driver;
  `--text-cpu` if the GPU has under 17 GB). It clones Kimodo into `<home>/src`, installs Python 3.11, PyTorch with
  CUDA and Kimodo into `<home>/.venv`, and compiles its motion correction with Visual Studio's C++. Every cache (uv,
  Python, about 20 GB of models, torch, temp files) stays under `<home>/cache`. Rerun it to repair.
- [ ] `python tools/kimodo.py login` (the token, stored in `<home>/cache/hf`), or skip step 2 and the token with
  `python tools/kimodo.py encoder` (the same Llama weights from the public `unsloth/llama-3-8b-Instruct`, about 16 GB
  in `<home>/encoders`, which Kimodo uses through `TEXT_ENCODERS_DIR`); then `python tools/kimodo.py check`:
  `KIMODO ok` (CUDA, VRAM, the package, access to the text encoder). `python tools/kimodo.py demo` opens NVIDIA's
  timeline demo.
- [ ] `motion.py jobs`, `motion.py constrain` (the blocking as Kimodo full-body keyframes and root paths, solved on
  its own skeleton), `motion.py run` (the first run downloads the models), `motion.py check` (`MOTION ok`), then
  `motion.py preview`: the desk plays them on MHR, every bone (fingers, toes, neck) driven.
- [ ] Retarget onto the stand-in or MetaHuman in Unreal (`kimodo_gen --bvh` writes BVH too; or export the desk's
  glTF): set up the IK Retargeter from the SOMA skeleton once.
- [ ] The grab (ANIMATION.md §4): IK to the camera's `GrabSocket`, physical animation in proportion to the pull,
  directional stumbles, the `struggle` event's result into the flow. `Story.Struggle` replays it.
- [ ] **(user)** Try the grab: win it, lose it.
- **Done:** MOTION ok, generated motions play in the desk (`motion.py preview`) and pass its body check, the grab
  works both ways, and the user approves the feel.

## S12. Faces and takes (user, then Claude)

- [ ] Mari's body from the desk, by numbers (docs/METAHUMAN_ROUTE.md): `python tools/metahuman.py --game Pilot mari`
  writes `Saved/Story/Pilot/metahuman_mari.py`; run it in the editor (UnrealClaude `unreal_execute_script`). It's
  untested: fix the lines marked VERIFY against `Engine/Plugins/MetaHuman/MetaHumanCharacter/Content/Python/examples`,
  put the real constraint names in the tool's `MEASURES`, and write what worked in docs/LESSONS.md. Then the rigged
  body's FBX is in `Content/Studio/Bodies/mari.fbx` and `previs_body` points at it: the storyboard plays on her.
  The conform (Export OBJ (A) on the Shape page → Creator's body conform) is the fallback for a shape the parametric
  body refuses.
- [ ] Mari's t-shirt into Unreal (docs/METAHUMAN_ROUTE.md §6): `python tools/garment.py setup`, then
  `python tools/garment.py --game Pilot pattern mari t-shirt`; import `Content/Games/Pilot/Garments/mari_t-shirt/
  mari_t-shirt_panels.obj` into a Chaos Cloth Asset (the Dataflow editor's static-mesh panel import), add the
  stitches from the `.seams.json`, collision from her body, and an Outfit Asset with sized sources so it resizes
  with the parametric body; write what worked in docs/LESSONS.md.
- [ ] **(user)** Make Mari's MetaHuman (from that conform, then the face and finer detail by hand). Record `Pilot_s_message_main_c1` to `c3` (MiniMax, from
  `story.py clips`): the Japanese voice as `.wav`, a close-up face video as `.mp4`, starting and ending on her
  anchor frame. Put them in one folder.
- [ ] `python tools/intake.py --game Pilot <folder>`, then the checks.
- [ ] Write `storykit.media.import_takes(game)`: SoundWaves into `Audio/VO`; face videos queued for MetaHuman
  Animator.
- [ ] Make the face both ways for c2 and compare them on the MetaHuman: the mono video solve, and audio-driven.
  Record the winner in DECISIONS.md.
- [ ] Set `cast.mari.metahuman`.
- **Done:** the hall scene plays with Mari's MetaHuman, her voice and face, a generated body, and seams you can't
  see. The user signs off.

## S13. Package the pilot (Claude)

- [ ] `python tools/package_game.py --game Pilot --dry`, read it, then run it for real. Fix what UAT complains about.
- [ ] Run the `.exe`. Check that it starts in the pilot, plays to an ending, and that no other game's assets are in
  the build (the cook's log).
- **Done:** `PACKAGE ok`, the build plays, and its size is reasonable.

## S14. Ready

- [ ] Every check in one go. Update CLAUDE.md's tables with what S4 to S13 learned.
- [ ] Tell the user the studio is ready. The next message is game one's rough story (PIPELINE.md P1).
