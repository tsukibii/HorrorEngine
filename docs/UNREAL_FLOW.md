# From the desk to Unreal (pipeline v2, stages 9 to 11)

How a game blocked and approved on the desk becomes a playable Unreal level. What exists today is marked
**(built)**; what the first run has to finish is marked **(to do, local)**, done on your machine with local Claude
and UnrealClaude (the editor's tools aren't reachable from a cloud session). SETUP.md S8 to S12 holds the editor-side
setup these steps rely on.

## 0. What goes across

| From the desk | Where it is | Becomes in Unreal |
|---|---|---|
| the story (levels, rooms, props, spots, scenes, stitches, flow, karma, endings) | `Content/Games/<G>/story.json` | the maps (greybox), the StoryRunner's data **(importer: built, untested; runner: to do, local)** |
| each scene's blocking (bodies, moves, cameras) | the desk's **Export glTF** → `Content/Games/<G>/Previs/` | animation on the stand-ins until real motions exist **(built)** |
| the Kimodo motions | `Saved/Story/<G>/kimodo/*.npz` (the demo) or `motion/*.npz` (the CLI) | FBX on SOMA → retargeted onto each MetaHuman: `tools/retarget.py` **(FBX built and tested; editor script: to do, local)** |
| the takes (MiniMax videos) | `Footage/<G>/<take id>.mp4` (`intake.py`, trimmed) | SoundWaves for the voice, face animation by MetaHuman Animator: `storykit.media.import_takes` **(to do, local: SETUP S11)** |
| the levels' kit things, doors and textures (the scene builder, docs/KIT.md, ASSETS.md §6) | `levels` in story.json; `Library/meshes/kit/` (built by the importer); `Content/Studio/PBR/` | kit meshes (static), doors as frame + leaf on its hinges + handle (tagged `door_part:*`), material instances of M_StudioSurface in `/Game/Studio/PBR/` imported only when missing **(built, untested: docs/HANDOFF_SCENE_BUILDER.md §3)** |
| the look, trackers and idle | scene `look`, `trackers`; the idle has no field | one Control Rig layer for the whole cast, driven by the runner **(to do, local)** |

## 1. The blocked game, playable as blocks

1. `python tools/check_all.py --game G`: `CHECKS ok` first; nothing goes to Unreal that the desk hasn't proved.
2. On the desk, **Generate in Unreal** (or `python tools/unreal_link.py --game G generate`): the checks, then
   `storykit.generate.run("G")` in the editor: through UnrealClaude's port if it's open, or the desk starts it and
   `init_unreal.py` runs the build once it has loaded. One map per level (`/Game/Games/<G>/Maps/L_<level>`), every
   story actor tagged `story`, a stand-in per cast member, the start level left open; the desk shows the result
   (`Saved/Story/<G>/generate/result.json`). No Claude needed. **(built, run on the Pilot 2026-10-21)**
3. On the desk, **Export glTF** for each scene; import them (Interchange) onto the stand-ins.
4. The runner plays the flow with them (RUNNER_SPEC.md): scenes, the 30 s choices with their karma, the karma choice
   at the end, tasks with their timers and guide-backs. **To do, local:** the runner's format 3 parts (karma kept per
   axis and saved with the checkpoint, choose's 30 s default and its labels in the player's language, `by: karma`,
   the guide-backs), and the debug view of the karma.
5. **Done when:** you can play the whole game as blocks, every choice and ending, as it was on the desk.

## 1b. The preview (built 2026-10-21)

Generate also **bakes the Watch**: `tools/director/bake.js` steps the desk's own timeline for every scene at 30 fps and
writes what it computes (the player's camera and lens, every figure's joints, the subtitles, the black, the lights'
flicker, the events) with the flow, stitches and endings to `Content/Games/<G>/Previs/preview.json` (git-ignored).
`AStoryPreview` (Source/StoryRunner, one per level, put there by the importer) plays it in **Play**: scenes as
recorded (the cast in their own bodies: the desk exports each cast member's shaped MHR body as
`Previs/Body_<who>.glb`, Generate imports it to `/Game/Games/<G>/Imported/Bodies/<who>/v<hash>` and the preview poses
its bones from the bake's skinning matrices, fitting Unreal's import axes to the bind positions; without a body, the
desk's figure of cylinders), events and act-choices as cards with buttons,
stitches as task cards (walk the level, then Task done or the interrupts; timers count down; gameplay stitches offer
their results), endings with Return to and Play from the start. **N** the node menu (play from any node), **Tab** the
mouse for the cards or the walk back. It computes nothing: change the desk, Generate, play again.
Not yet: voices and takes (subtitles only), the cues (lights_die, sounds, door tricks), replies (the first option
plays), choices by karma or count (picked by hand), scenes in another level's map (a card says so), MetaHumans (the
shaped MHR bodies stand in).

## 2. The MetaHumans in their roles

1. Set each cast member's `metahuman` (the MetaHuman Character asset) in the story.
2. `python tools/retarget.py --game G fbx` (the motions as FBX on SOMA, checked against Kimodo's own numbers), then
   `python tools/retarget.py --game G unreal --cast <id> [--body <the body skeletal mesh>]` and run the script it
   writes: it imports SK_SOMA and the motions, makes IK_SOMA and the retargeter to MetaHuman once, and retargets every
   motion onto each MetaHuman's body. Fix its VERIFY lines on the first run (SETUP S12).
3. The importer swaps the stand-ins for the MetaHumans; scenes play the retargeted motions, chained in the same order
   and joins as the desk (segment by segment, a 0.25 s blend between).

## 3. The face mocap

1. `python tools/intake.py --game G <folder>` (if the desk's Load takes folder was used, run it once anyway: it
   copies the takes to `Footage/<G>/` with their trims).
2. In the editor: `storykit.media.import_takes("G")`: the voices as SoundWaves (trimmed like the desk), the face
   videos queued for MetaHuman Animator (mono video).
3. Solve each face; the face animations go on the scene tracks by take id, trimmed and timed like the takes.

## 4. The gameplay made real

1. Each placeholder task becomes the real thing (search, solve, carry, hide), from the templates (TRICKS.md §4).
2. **The crosshair:** a small dot at the centre of the screen is the interaction point (no hands in the first game):
   what's under it highlights and **Interact** uses it. Timed tasks show their timer; a missed one plays its
   guide-back scene.
3. The look layer as a Control Rig on the cast (the same numbers as the desk: limits, hold or snap, the 10/15/25/50
   split), and the procedural idle under every pose.
4. **Done when:** `PLAYTHROUGH ok` (the bot) and you've played it through, every ending.

## 4b. Replies, gameplay, deaths and sound (format 3, 0.4)

- **Replies:** the runner's two prompts, left and right (the Japanese over the English), while her face holds; her
  answer's take plays after, or nothing on time out (RUNNER_SPEC.md). **To do, local.**
- **Gameplay:** one template Blueprint per `play` type in `/Game/Studio/Horror/Play/` (`BP_Play_hide` and so on),
  started with the stitch's `secs`, `rule`, `warn` and `spots`, ending with a result; built with the engine's own
  tools and fleshed out with Claude through UnrealClaude. **To do, local.**
- **Deaths and the branch map:** checkpoints at every flow node; the death card, then the map (pause menu too).
  **To do, local.**
- **Reverb:** the importer gives each room an AudioVolume with its `acoustics` preset (**built, untested**); the
  ReverbEffect assets `/Game/Studio/Audio/Reverb/RV_<preset>` are made once (SETUP), tuned by ear in real rooms.

## 5. Then

Art, atmosphere and polish (PIPELINE.md §10), QA and the itch.io build (§11). Each new mechanic goes into the studio
and the changelog (`Content/Studio/CHANGELOG.md`).
