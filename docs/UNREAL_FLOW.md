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
| the time of day | `game.time`, each scene's `time` (STORY_FORMAT §3.1) | Light Kit's sky (Day, Dusk, Night) and a Light Kit Window in every window, UltraVHS's night mode with the night: §1c **(built, untested)** |
| a Character Studio character (a cast member's `previs_body: "people/<name>"`) | `Content/Studio/People/<name>/export/<name>.glb` (the Studio's Export for desk / Unreal) | one skeletal mesh on MHR's skeleton in `/Game/Studio/Imported/People/<name>/`, its eyes wearing M_StudioEye (the iris behind a refracting cornea), in the preview and the level: §1d **(built, untested)** |

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
The **time of day** goes across too: the bake holds each scene's own `time` and the time the desk worked out at every
node (`times`), and the preview sets the level's Light Kit Sky to it (found by name: `SetTime`) when it starts, when
you play from a node and when a scene with its own time begins; the sky turns UltraVHS's night mode on and off with it.
Without Light Kit in the project the level keeps the importer's dark interior and says so once in the log.
Not yet: voices and takes (subtitles only), the cues (lights_die, sounds, door tricks), replies (the first option
plays), choices by karma or count (picked by hand), scenes in another level's map (a card says so), MetaHumans (the
shaped MHR bodies stand in).

## 1c. The look: day and night with Light Kit, the camcorder with UltraVHS (built, untested)

The look comes last, per game (DECISIONS 2026-10-21), so neither plugin is on until a game wants it. With Light Kit
on in the project, the importer gives every level **Light Kit's sky** (Dynamic: the time can change in play) at the
time the level is first seen in the flow, and a **Light Kit Window** in every window of the builder's rooms (sized to
the opening, its arrow into the room), instead of its dark interior's held exposure and faint sky light; the rooms'
faint fills stay. The preview then sets each scene's time (§1b).

**Baked lighting** holds one time of day per bake: a game that bakes makes a Lighting Scenario sublevel per time it
uses, each with its own Light Kit Sky set to that time (Baked), builds lighting with each one visible in turn and
loads the scenario a scene needs (LightKit's CLAUDE.md §3). Dynamic (Lumen) needs none of that and is the default.

**UltraVHS** goes on the player (the class map's player Blueprint, SETUP S6): Add Component, Ultra VHS. Its night mode
records black as a cool blue instead of the camcorder's warm lift, so the deep-blue night stays blue; Light Kit's sky
turns it on at night by itself.

## 1d. A Character Studio character, its eyes too (built, untested; 2026-10-26)

A cast member whose `previs_body` is `people/<name>` (STORY_FORMAT §2) is a Character Studio character, and goes
across as itself: the Studio's **Export for desk / Unreal** (`Content/Studio/People/<name>/export/<name>.glb`:
neutral, rigged on MHR's skeleton, every part skinned on it, the eyes on `l_eye` and `r_eye`; CHARACTER_STUDIO.md §3.1).
`storykit.people.import_character(name)` imports it once per version of the file into
`/Game/Studio/Imported/People/<name>/v<hash>` (shared: a character may play in several games; not `/Game/Studio/People`, the Studio's own folder on disk) as one skeletal mesh, and gives
each eye a material instance of **M_StudioEye** with its own paint and numbers. Generate does it by itself: the
preview poses the character from the desk's bake instead of the desk's body (the same bones by name, the same bind),
and the importer puts it in the level wherever the story places that cast member, scaled to their height.

**M_StudioEye** is the Studio's eye (tools/shared/eye.js) as an Unreal material, made from the text in
`people.py` the first time it's needed (and again when the text changes: a version tag on the asset). Clear Coat: two
Custom nodes read the eye's point back from its flat layout (uv = 0.5 + 0.5 xy), bring the camera vector, which a
Transform node gives them in the surface's tangent space, into the eye's own frame (the Studio wrote the tangents as
the eye's X along the surface), bend it at the cornea's dome by Snell's law onto the iris's plane, and read the iris
there from the paint the file carries baked flat; the white is read where the point is. The base layer has no shine on
the iris; the cornea's shine is the clear coat. Its parameters come from the eye material's `extras.studioEye` (the
limbus, the dome, the iris's plane, the IOR, the iris's brightness, the limbus darker from the side, the gloss);
`node tools/character/ueeye.mjs` (UEEYE) runs the same HLSL as GLSL against a traced ray, and compiles it with DXC
when `DXC` is set.

**The first run, with the editor:** `import storykit.people as p; p.import_character("<name>")`, then a close-up of an
eye from the front, from above and from the side, beside the same views in the Studio:
- the iris slides the wrong way when the eye is seen from above or below (it should stay put behind the cornea, the
  pupil seen a little toward you): M_StudioEye's `Handed` to -1 (the importer flipped the tangent frame);
- the paint upside down (the veins at the wrong lid, the inner corner's pink at the outer): `FlipV` to 1;
- the eye grey: its paint didn't import (the log says), or the instance isn't on its slot (the log lists the slots);
- several skeletal meshes in the version folder: Interchange split the character's parts (its glTF pipeline's
  Combine Skeletal Meshes should be on); the one with the eyes plays.
Both switches are on the parent material, never on a character's instance, so one fix serves every character. Write
what you find in `people.py` and here.

**M_StudioSkin** (2026-10-28, back; written blind as the eye was): the export's skin carries its colour, its relief
(a normal map in glTF's convention), one map of R 1, G the roughness and B how thin the skin is (its metalness 0), and
the skin light's numbers (`extras.studioSkin`: the Studio lights its skin after HumanShaders, `tools/shared/skinlight.js`,
CHARACTER_STUDIO.md §3.1). `people.wear_skin` imports the three maps (the relief's green flipped to Unreal's
convention, the ORM linear, as masks) and puts an instance of M_StudioSkin on the skin's slot: Subsurface Profile
(`SP_StudioSkin`, the engine's skin defaults), the colour, the relief, the roughness and the occlusion from the maps,
Specular from the skin's, the scattering's amount (Opacity) more where the skin is thin. Unreal scatters light under
the skin itself, so the numbers are translated (`skin_params`), not copied. **The first run:** a close-up of the face
under one side light and with a lamp behind the head, beside the Studio's: the shadow's edge soft and warm, the ear's
rim red; if the relief looks inverted (pores raised where they should sink, the light coming from below), the
`flip_green_channel` line in `wear_skin` is the one to change. An export made before this has no skin maps: export
it again.

Not yet: the iris lit as a bowl (the caustic: it needs the project's Clear Coat Enable Second Normal and a
ClearCoatBottomNormal output), an eye occlusion and a tear line (the Studio's are drawn in its shader), the lids
following the gaze when an eye bone turns (the export is neutral and has no face shapes yet), the hair as grooms.

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

- **Replies:** the runner's two or three prompts at the bottom centre under her line (English only, each answer's
  thought under it; the bake writes no `ja` now, so AStoryPreview's Japanese line stays empty until it's taken out), while her face holds; her
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
